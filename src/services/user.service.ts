import { QueryFilter, Types } from 'mongoose';
import {
  UserModel,
  UserSchemaType,
  UserQuery,
  UserPatch,
  PublicUser,
} from '../models/user.model.js';
import { RefreshTokenModel } from '../models/refreshToken.model.js';
import { usersSeed } from '../config/seed-data.js';
import { hashPassword } from './auth.service.js';
import { logger } from '../config/index.js';

// ============================================================
// SERVICE de "User" — gestión del recurso SIN password.
// `select: false` en el Schema + `lean<PublicUser>()` garantizan que
// ninguna función de este fichero devuelve el hash.
// ============================================================

// --- CRUD básico ---
export const findUserById = async (id: Types.ObjectId | string): Promise<PublicUser | null> =>
  UserModel.findById(id).lean<PublicUser>();

// filters viene ya validado por userQuerySchema (ver user.model.ts):
// refina la colección vía query string (?role=)
export const listAllUsers = async (filters: UserQuery = {}): Promise<PublicUser[]> => {
  const query: QueryFilter<UserSchemaType> = filters.role ? { role: filters.role } : {};
  return UserModel.find(query).lean<PublicUser[]>();
};

// Sirve para PUT (todos los campos) y PATCH (algunos): la diferencia
// la marca el esquema Zod de cada ruta.
export const updateUser = async (
  id: Types.ObjectId | string,
  data: UserPatch,
): Promise<PublicUser | null> =>
  UserModel.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  }).lean<PublicUser>();

// Borrado en CASCADA: al eliminar el usuario, sus refresh tokens
// dejan de tener sentido.
export const deleteUserById = async (id: string): Promise<PublicUser | null> => {
  const deleted = await UserModel.findByIdAndDelete(id).lean<PublicUser>();
  if (deleted) {
    await RefreshTokenModel.deleteMany({ user: id });
    logger.debug('User %s deleted with its sessions', id);
  }
  return deleted;
};

// --- SEED / DELETE ---

// Los datos de seed llevan contraseña en claro: la hasheamos antes
// de insertar (Promise.all -> en paralelo).
export const seedUsers = async (
  users: ReadonlyArray<UserSchemaType> = usersSeed,
): Promise<number> => {
  const hashed: UserSchemaType[] = await Promise.all(
    users.map(async (user: UserSchemaType): Promise<UserSchemaType> => ({
      ...user,
      password: await hashPassword(user.password),
    })),
  );
  const inserted = await UserModel.insertMany(hashed);
  return inserted.length;
};

export const deleteAllUsers = async (): Promise<number> => {
  const { deletedCount } = await UserModel.deleteMany({});
  return deletedCount ?? 0;
};
