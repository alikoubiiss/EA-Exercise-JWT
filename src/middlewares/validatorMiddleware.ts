import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Sobre qué parte de la petición valida el esquema: el body (POST/PUT/PATCH)
// o la query string (filtros de un GET, ej. ?role=ADMIN).
type ValidationSource = 'body' | 'query';

/**
 * GENERIC VALIDATOR
 * ============================================================
 * Recibe cualquier esquema de Zod y valida `req.body` o `req.query`.
 * No decide status codes ni formatea la respuesta de error: si el
 * esquema falla, simplemente reenvía el ZodError con `next(error)`
 * para que lo procese el error-handling middleware (única fuente de
 * verdad de "cómo se ve un error" en toda la API).
 * ============================================================
 */
export const validate =
  (schema: z.ZodTypeAny, source: ValidationSource = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Sustituimos por los datos ya parseados (tipados y con defaults
    // de Zod aplicados), no por el JSON crudo que llegó por HTTP.
    req[source] = result.data;
    next();
  };
