import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  accessTokenSecret,
  refreshTokenSecret,
  accessTokenTtl,
  refreshTokenTtl,
  logger,
} from '../config/index.js';
import { UserModel, PublicUser, toPublicUser } from '../models/user.model.js';
import { RefreshTokenModel } from '../models/refreshToken.model.js';
import type { TokenPair, TokenPayload } from '../models/jwtpayload.model.js';
import type { RegisterInput, LoginInput } from '../models/auth.model.js';
import { conflict, forbidden, notFound, unauthorized } from '../errors/ApiError.js';

// ============================================================
// SERVICE de "Auth"
// Todo lo que toca contraseñas y tokens vive aquí. user.service
// nunca ve un password.
// ============================================================

// ------------------------------------------------------------
// 1) CONTRASEÑAS (scrypt, incluido en Node: sin dependencias)
// ------------------------------------------------------------
const KEY_LENGTH: number = 64;

// `scrypt` usa callbacks: lo envolvemos en una Promesa para poder
// usar async/await (y que los errores lleguen al try/catch).
const deriveKey = (password: string, salt: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error: Error | null, key: Buffer) =>
      error ? reject(error) : resolve(key),
    );
  });

// Formato guardado: "<salt>:<hash>". La sal aleatoria hace que dos
// usuarios con la misma contraseña tengan hashes distintos.
export const hashPassword = async (password: string): Promise<string> => {
  const salt: string = randomBytes(16).toString('hex');
  const key: Buffer = await deriveKey(password, salt);
  return `${salt}:${key.toString('hex')}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const key: Buffer = await deriveKey(password, salt);
  const expected: Buffer = Buffer.from(hash, 'hex');
  // timingSafeEqual: compara en tiempo constante (evita timing attacks).
  // Lanza si las longitudes difieren, por eso lo comprobamos antes.
  return key.length === expected.length && timingSafeEqual(key, expected);
};

// ------------------------------------------------------------
// 2) TOKENS
// ------------------------------------------------------------
// El access token NO se guarda: es stateless y caduca en minutos.
const signAccessToken = (userId: string): string => {
  const payload: TokenPayload = { id: userId, type: 'access' };
  return jwt.sign(payload, accessTokenSecret, { expiresIn: accessTokenTtl });
};

// `jwtid` (claim "jti") aleatorio: garantiza que dos refresh tokens
// emitidos en el mismo segundo para el mismo usuario sean distintos.
const signRefreshToken = (userId: string): string => {
  const payload: TokenPayload = { id: userId, type: 'refresh' };
  return jwt.sign(payload, refreshTokenSecret, {
    expiresIn: refreshTokenTtl,
    jwtid: randomUUID(),
  });
};

// SHA-256 basta aquí (el token ya es aleatorio y largo); scrypt
// sería innecesariamente lento.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// Emite access + refresh y PERSISTE el refresh (su hash) en la BD.
const issueTokenPair = async (userId: string): Promise<TokenPair> => {
  const accessToken: string = signAccessToken(userId);
  const refreshToken: string = signRefreshToken(userId);
  await RefreshTokenModel.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
  });
  logger.debug('Token pair issued for user %s', userId);
  return { accessToken, refreshToken };
};

// ------------------------------------------------------------
// 3) CASOS DE USO
// ------------------------------------------------------------

export const registerUser = async (data: RegisterInput): Promise<PublicUser> => {
  // Comprobación explícita -> 409 con un mensaje claro. (El índice
  // unique de email es la red de seguridad ante condiciones de carrera.)
  const exists = await UserModel.exists({ email: data.email });
  if (exists) throw conflict(`Email '${data.email}' is already registered`);

  const password: string = await hashPassword(data.password);
  const created = await UserModel.create({ ...data, password, role: 'USER' });
  logger.debug('User registered: %s', created.id);
  return toPublicUser(created.toObject());
};

export const login = async ({
  email,
  password,
}: LoginInput): Promise<{ user: PublicUser; tokens: TokenPair }> => {
  // Única consulta que pide el hash (select: false en el Schema)
  const user = await UserModel.findOne({ email }).select('+password').lean();

  // Mismo mensaje si no existe el email o la contraseña es incorrecta:
  // no revelamos qué emails están registrados (user enumeration).
  if (!user || !(await verifyPassword(password, user.password))) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const tokens: TokenPair = await issueTokenPair(user._id.toString());
  return { user: toPublicUser(user), tokens };
};

// ROTACIÓN: cada refresh consume el token usado y emite uno nuevo.
// `findOneAndDelete` es atómico: el mismo token no puede usarse 2 veces.
export const rotateRefreshToken = async (
  userId: string,
  refreshToken: string,
): Promise<TokenPair> => {
  const stored = await RefreshTokenModel.findOneAndDelete({
    user: userId,
    tokenHash: hashToken(refreshToken),
  });

  if (!stored) {
    // Firma válida pero no está en BD: ya se usó o se revocó. Puede
    // ser un token robado -> cerramos TODAS las sesiones del usuario.
    await revokeAllRefreshTokens(userId);
    logger.warn('Refresh token reuse detected for user %s', userId);
    throw unauthorized('Refresh token has been revoked', 'TOKEN_REVOKED');
  }

  return issueTokenPair(userId);
};

// Logout de UNA sesión. Idempotente: si ya no existía, no es error.
export const revokeRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  await RefreshTokenModel.deleteOne({ user: userId, tokenHash: hashToken(refreshToken) });
  logger.debug('Refresh token revoked for user %s', userId);
};

// Logout de TODAS las sesiones (cambio de password, reuse detectado...)
export const revokeAllRefreshTokens = async (userId: string): Promise<number> => {
  const { deletedCount } = await RefreshTokenModel.deleteMany({ user: userId });
  logger.debug('%d refresh tokens revoked for user %s', deletedCount, userId);
  return deletedCount;
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await UserModel.findById(userId).select('+password').lean();
  if (!user) throw notFound(`User '${userId}' not found`);

  // 403 y no 401: el token ES válido (el cliente está autenticado);
  // lo que falla es la prueba extra. Un 401 haría que el cliente
  // intentara refrescar el token sin motivo.
  if (!(await verifyPassword(currentPassword, user.password))) {
    throw forbidden('Current password is incorrect');
  }

  await UserModel.updateOne({ _id: userId }, { password: await hashPassword(newPassword) });
  // Tras cambiar la contraseña, invalidamos todas las sesiones abiertas.
  await revokeAllRefreshTokens(userId);
};

export const deleteAllRefreshTokens = async (): Promise<number> => {
  const { deletedCount } = await RefreshTokenModel.deleteMany({});
  return deletedCount;
};
