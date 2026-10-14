import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../config/index.js';

// Forma de un error de clave duplicada de MongoDB (p.ej. email único
// repetido). No viene tipado por el driver, así que lo comprobamos
// con un type guard en vez de un `any` suelto.
type MongoDuplicateKeyError = { code: number; keyValue?: Record<string, unknown> };

const isDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 11000;

// Error que lanza body-parser (express.json()) cuando el JSON del
// body está mal formado. Sí lo tipa como SyntaxError + status/body.
const isJsonParseError = (
  error: unknown,
): error is SyntaxError & { status: number; body: unknown } =>
  error instanceof SyntaxError && 'body' in error;

/**
 * ERROR-HANDLING MIDDLEWARE (4 argumentos: Express lo reconoce por eso)
 * ============================================================
 * Único punto de la aplicación que decide status code + forma del
 * JSON de error. Todo lo demás (controllers, middlewares, services)
 * solo necesita hacer `throw` o `next(error)`; nunca construye la
 * respuesta de error a mano. Así garantizamos el contrato
 * { message, code } en TODAS las respuestas de error de la API.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // 1) Errores de negocio ya tipados (throw notFound(...), etc.)
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) {
      logger.error(error, '%s %s', req.method, req.url);
    } else {
      logger.warn('%s %s -> %d %s', req.method, req.url, error.statusCode, error.code);
    }
    res.status(error.statusCode).json({ message: error.message, code: error.code });
    return;
  }

  // 2) Body/params/query que no cumplen el esquema Zod -> 422
  // (400 se reserva para peticiones mal formadas, no para datos
  // sintácticamente válidos que incumplen una regla de negocio/forma).
  if (error instanceof ZodError) {
    logger.warn('Validation error on %s %s', req.method, req.url);
    res.status(422).json({
      message: 'Validation failed',
      code: 'UNPROCESSABLE_ENTITY',
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // 3) Un :id de la URL que no tiene forma de ObjectId -> 400
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({
      message: `Invalid ${error.path}: '${String(error.value)}'`,
      code: 'BAD_REQUEST',
    });
    return;
  }

  // 4) Choque con un índice único (p.ej. email duplicado) -> 409
  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({
      message: `A resource with that ${field} already exists`,
      code: 'CONFLICT',
    });
    return;
  }

  // 5) JSON mal formado en el body -> 400
  if (isJsonParseError(error)) {
    res.status(400).json({ message: 'Malformed JSON body', code: 'BAD_REQUEST' });
    return;
  }

  // 6) Cualquier otra cosa: no la esperábamos, es un fallo nuestro -> 500
  logger.error(error, 'Unexpected error on %s %s', req.method, req.url);
  res.status(500).json({ message: 'Internal Server Error', code: 'INTERNAL_ERROR' });
};
