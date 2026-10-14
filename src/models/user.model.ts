import { Schema, model, InferSchemaType, HydratedDocument, Types } from 'mongoose';
import { z } from 'zod';

// ============================================================
// MODELO "User" — FORMA MODERNA InferSchemaType
// ============================================================

export const ROLES = ['ADMIN', 'EDITOR', 'USER'] as const;

export const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  // Guardamos el HASH (nunca la contraseña en claro).
  // `select: false` -> ninguna consulta lo devuelve salvo que se pida
  // explícitamente con `.select('+password')` (solo lo hace auth.service).
  password: { type: String, required: true, select: false },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ROLES, default: 'USER' },
});

// Tipo "plano" inferido del Schema (sin métodos de instancia).
export type UserSchemaType = InferSchemaType<typeof userSchema>;

// Tipo de documento tal cual lo devuelve Mongoose (con métodos).
export type UserDocument = HydratedDocument<UserSchemaType>;

export const UserModel = model<UserSchemaType>('User', userSchema);

// --- TIPOS AUXILIARES ---

// UserWithId = todos los campos de User, pero con el campo "_id" añadido
export type UserWithId = UserSchemaType & { _id: Types.ObjectId };

// PublicUser = lo que la API puede devolver: User SIN password.
// Tenerlo como tipo propio hace que TS impida devolver el hash
// por error en cualquier controller.
export type PublicUser = Omit<UserWithId, 'password'>;

// Función PURA: construye un objeto NUEVO solo con los campos públicos
// (whitelist). Si el documento traía el hash, no se copia.
export const toPublicUser = ({ _id, name, email, role }: PublicUser): PublicUser => ({
  _id,
  name,
  email,
  role,
});

// ============================================================
// VALIDACIÓN DE ENTRADA (Zod) — recurso /users (SIN password)
// ============================================================
// Las piezas se reutilizan en auth.model.ts (registro/login).
export const nameField = z.string().trim().min(2, 'Name is too short');
export const emailField = z.email('Invalid email format');
export const passwordField = z.string().min(6, 'Password must be at least 6 characters long');

// PUT /users/:id -> reemplaza el recurso ENTERO (todos los campos).
// `strictObject`: si llega `password` o `role` -> 422. La contraseña se
// cambia en /users/:id/password y el rol no lo elige el propio usuario
// (evitamos una escalada de privilegios).
export const userUpdateSchema = z.strictObject({
  name: nameField,
  email: emailField,
});

// PATCH /users/:id -> modifica solo una PARTE (al menos un campo).
export const userPatchSchema = userUpdateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required');

export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserPatch = z.infer<typeof userPatchSchema>;

// ============================================================
// QUERY PARAMS (filtros de GET /users)
// ============================================================
export const userQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
});

export type UserQuery = z.infer<typeof userQuerySchema>;
