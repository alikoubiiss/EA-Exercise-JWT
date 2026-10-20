import 'dotenv/config';

// ============================================================
// VARIABLES DE ENTORNO
// ============================================================
// Única fuente de verdad de la configuración: ningún otro fichero
// lee `process.env` ni "hardcodea" secretos.

export const nodeEnv: string = process.env.NODE_ENV ?? 'development';

export const apiPort: number = Number(process.env.PORT) || 4000;

export const frontendUrl: string = process.env.FRONTEND_URL ?? 'http://localhost:4200';

export const mongoUri: string =
  process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/ea-exercise-jwt';

// --- JWT ---
// Dos secretos DISTINTOS: un access token nunca podrá verificarse
// como refresh token (ni al revés), aunque alguien cambie el `type`.
// En producción SIEMPRE deben venir del .env (los defaults son solo
// para la demo en clase).
export const accessTokenSecret: string = process.env.ACCESS_TOKEN_SECRET ?? 'access+jwt';
export const refreshTokenSecret: string = process.env.REFRESH_TOKEN_SECRET ?? 'refresh+jwt';

// Duraciones en SEGUNDOS (número => sin ambigüedades de formato
// y nos sirve también para calcular `expiresAt` en la BD).
// - Access token: corto (10 min). Si lo roban, caduca pronto.
// - Refresh token: largo (1 día). Se guarda en BD para poder revocarlo.
export const accessTokenTtl: number = Number(process.env.ACCESS_TOKEN_TTL) || 10 * 60;
export const refreshTokenTtl: number = Number(process.env.REFRESH_TOKEN_TTL) || 24 * 60 * 60;
