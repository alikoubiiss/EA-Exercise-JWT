import { Schema, model, InferSchemaType } from 'mongoose';

// ============================================================
// MODELO "RefreshToken"
// ============================================================
// Un JWT es "stateless": una vez firmado, es válido hasta que caduca.
// Para el refresh token (larga duración) eso es peligroso, así que
// guardamos una referencia en la BD. Un refresh token solo es válido
// si (1) la firma es correcta Y (2) existe en esta colección.
// Borrar el documento = invalidarlo (logout, cambio de password...).
//
// Una colección aparte (y no un campo en User) permite varias
// sesiones simultáneas por usuario (móvil, portátil...).
// ============================================================

export const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Guardamos el HASH SHA-256 del token, no el token: si se filtra
    // la BD, los tokens no se pueden reutilizar.
    tokenHash: { type: String, required: true, unique: true },
    // Índice TTL: MongoDB borra solo el documento cuando llega esta fecha.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export type RefreshTokenSchemaType = InferSchemaType<typeof refreshTokenSchema>;

export const RefreshTokenModel = model<RefreshTokenSchemaType>('RefreshToken', refreshTokenSchema);
