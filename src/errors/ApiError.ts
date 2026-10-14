// ============================================================
// ApiError
// ============================================================
// Un error "tipado" que ya sabe qué status HTTP y qué código de
// error le corresponde. Los controllers y services simplemente
// hacen `throw notFound('User not found')` (o similar) y dejan que
// el error suba por la cadena de promesas; el error-handling
// middleware (src/middlewares/errorHandler.ts) es el ÚNICO sitio
// que decide cómo se serializa esa información a JSON.
//
// Esto es lo que nos permite cumplir "Keep error responses
// consistent": todas las respuestas de error comparten la misma
// forma { message, code }, sin repetir `res.status(...).json(...)`
// en cada controller.
// ============================================================
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// --- FÁBRICAS: una por cada status code que usa la API ---
// Encapsulan el par (statusCode, code) para que el resto del código
// nunca tenga que recordar "¿qué código va con un 404?".

export const badRequest = (message: string): ApiError => new ApiError(400, 'BAD_REQUEST', message);

// `code` opcional: en 401 interesa distinguir TOKEN_EXPIRED (el
// cliente debe llamar a /refresh) de UNAUTHORIZED (debe hacer login).
export const unauthorized = (message: string, code: string = 'UNAUTHORIZED'): ApiError =>
  new ApiError(401, code, message);

export const forbidden = (message: string): ApiError => new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message: string): ApiError => new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string): ApiError => new ApiError(409, 'CONFLICT', message);

export const unprocessable = (message: string): ApiError =>
  new ApiError(422, 'UNPROCESSABLE_ENTITY', message);
