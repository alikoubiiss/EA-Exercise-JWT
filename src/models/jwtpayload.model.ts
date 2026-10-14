import { z } from 'zod';

// ============================================================
// PAYLOAD de nuestros JWT
// ============================================================
// `jwt.verify` devuelve `string | JwtPayload` (un objeto con claves
// arbitrarias). En vez de hacer un cast ciego (`as ...`), validamos
// la forma con Zod: si el payload no es el esperado, lo rechazamos.
// El tipo TS se DERIVA del esquema -> una sola fuente de verdad.
//
// (Lo llamamos TokenPayload para no confundirlo con el tipo
// `JwtPayload` de la librería jsonwebtoken.)
// ============================================================

export const TOKEN_TYPES = ['access', 'refresh'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export const tokenPayloadSchema = z.object({
  // _id de Mongo: 24 caracteres hexadecimales
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  type: z.enum(TOKEN_TYPES),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

// Respuesta de login / refresh
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

// ============================================================
// DECLARATION MERGING: ampliamos los tipos GLOBALES de Express
// ============================================================
// Dos formas de pasar datos del token decodificado del middleware
// de autenticación al resto de la cadena (autorización, controller):
//
// 1. `req.userId`        -> ampliando la interfaz Request.
// 2. `res.locals.userId` -> ampliando la interfaz Locals (es la vía
//    "oficial" de Express para datos con ámbito de UNA petición).
//
// Ambas son OPCIONALES (`?`): solo existen DESPUÉS de pasar por
// `authenticate`. Así TS nos obliga a comprobarlo antes de usarlas
// en lugar de fingir que siempre están ahí.
// ============================================================
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
    interface Locals {
      userId?: string;
    }
  }
}
