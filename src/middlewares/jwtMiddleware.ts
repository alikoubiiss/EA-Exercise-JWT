import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { accessTokenSecret, refreshTokenSecret, logger } from '../config/index.js';
import { tokenPayloadSchema, TokenPayload, TokenType } from '../models/jwtpayload.model.js';
import type { RefreshTokenBody } from '../models/auth.model.js';
import type { IdParam } from '../models/http.js';
import { ApiError, forbidden, unauthorized } from '../errors/ApiError.js';

// ============================================================
// MIDDLEWARES JWT
// ============================================================
// - AUTENTICACIÓN (¿quién eres?): authenticate, verifyRefreshToken
//   -> DECODIFICAN el token aquí, una sola vez, y dejan el id del
//      usuario en la petición. El controller NUNCA toca el JWT.
// - AUTORIZACIÓN (¿puedes hacer esto?): isOwner
//   -> recibe el token YA decodificado (req.userId / res.locals.userId).
//
// Los errores no se responden aquí: se pasan con next(error) y el
// errorHandler genera el JSON { message, code } (401 / 403).
// ============================================================

// --- Funciones PURAS auxiliares ---

// "Authorization: Bearer <token>" -> "<token>" (o null)
const extractBearerToken = (header: string | undefined): string | null => {
  const [scheme, token] = (header ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

// Traduce los errores de la librería a nuestros ApiError (401).
// TokenExpiredError hereda de JsonWebTokenError: va primero.
const toAuthError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof jwt.TokenExpiredError) return unauthorized('Token expired', 'TOKEN_EXPIRED');
  if (error instanceof jwt.JsonWebTokenError) return unauthorized('Invalid token', 'INVALID_TOKEN');
  return unauthorized('Unauthorized');
};

// Verifica firma + caducidad, valida la FORMA del payload con Zod
// (en lugar de un `as` ciego) y comprueba el tipo de token esperado.
const decodeToken = (token: string, secret: string, expectedType: TokenType): TokenPayload => {
  const raw: string | jwt.JwtPayload = jwt.verify(token, secret);
  const parsed = tokenPayloadSchema.safeParse(raw);
  if (!parsed.success || parsed.data.type !== expectedType) {
    throw unauthorized(`Invalid token type - ${expectedType} token required`, 'INVALID_TOKEN');
  }
  return parsed.data;
};

// Las DOS formas (docentes) de pasar el token decodificado al
// siguiente middleware / controller:
// (`Pick<Request, 'userId'>`: solo necesitamos ese campo, así sirve
// para cualquier Request<Params, ResBody, ReqBody> sin hacer casts.)
const attachUserId = (req: Pick<Request, 'userId'>, res: Response, payload: TokenPayload): void => {
  // 1. Modificando el tipo Request de Express (ver models/jwtpayload.model.ts)
  req.userId = payload.id;
  // 2. Usando res.locals (contenedor oficial de Express por petición)
  res.locals.userId = payload.id;
};

// Para los controllers: el tipo es `string | undefined` porque solo
// existe tras `authenticate`. Esta guarda lo convierte en `string`
// de forma segura (si falta, es un error de configuración de rutas).
export const requireUserId = (userId: string | undefined): string => {
  if (!userId) throw unauthorized('Authentication required');
  return userId;
};

// ------------------------------------------------------------
// AUTENTICACIÓN con ACCESS TOKEN (header Authorization)
// ------------------------------------------------------------
// No consulta la BD: el access token es stateless. Por eso dura
// poco (10 min) — es la ventana máxima si alguien lo roba.
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token: string | null = extractBearerToken(req.headers.authorization);
    // Sin credenciales -> 401 (no 403: 403 es "te conozco y no puedes")
    if (!token) throw unauthorized('No access token provided');

    const payload: TokenPayload = decodeToken(token, accessTokenSecret, 'access');
    attachUserId(req, res, payload);
    logger.debug('Authenticated user %s on %s %s', payload.id, req.method, req.originalUrl);
    next();
  } catch (error) {
    next(toAuthError(error));
  }
};

// ------------------------------------------------------------
// AUTENTICACIÓN con REFRESH TOKEN (body { refreshToken })
// ------------------------------------------------------------
// Solo verifica firma/caducidad/tipo. Que siga existiendo en la BD
// (no revocado) lo comprueba auth.service al rotarlo.
export const verifyRefreshToken = (
  req: Request<unknown, unknown, RefreshTokenBody>,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const payload: TokenPayload = decodeToken(req.body.refreshToken, refreshTokenSecret, 'refresh');
    attachUserId(req, res, payload);
    next();
  } catch (error) {
    next(toAuthError(error));
  }
};

// ------------------------------------------------------------
// AUTORIZACIÓN: el usuario del token es el dueño de /users/:id
// ------------------------------------------------------------
export const isOwner = (req: Request<IdParam>, res: Response, next: NextFunction): void => {
  // Leemos el id por las dos vías para mostrar que son equivalentes.
  const fromRequest: string | undefined = req.userId; // forma 1
  const fromLocals: string | undefined = res.locals.userId; // forma 2
  logger.debug(
    'isOwner: param=%s req.userId=%s res.locals.userId=%s',
    req.params.id,
    fromRequest,
    fromLocals,
  );

  if (!fromRequest) {
    next(unauthorized('Authentication required'));
    return;
  }
  if (req.params.id !== fromRequest) {
    next(forbidden('You can only access your own user'));
    return;
  }
  next();
};
