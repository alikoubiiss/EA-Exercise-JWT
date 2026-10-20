import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiPort, frontendUrl } from './config/index.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import { httpLogger } from './middlewares/loggerMiddleware.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

/**
 * APPLICATION SETTINGS
 */
app.set('port', apiPort);

/**
 * MIDDLEWARES
 */

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(cookieParser());

// Built-in middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Logging middleware: Logs every incoming HTTP request using Pino
app.use(httpLogger);

/**
 * HEALTH CHECK / PING
 * Simple, stateless endpoint to verify the server is running.
 */
app.get('/ping', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * API ROUTES
 */
// authRoutes se monta en /api porque define /auth/* y /users/:id/password
// (credenciales). userRoutes gestiona el recurso /users SIN password.
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);

/**
 * ERROR HANDLING
 */
// Catch-all para rutas que no existen (404 Not Found). Mismo contrato
// { message, code } que el resto de errores de la API.
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Resource not found', code: 'NOT_FOUND' });
});

// Middleware de errores: SIEMPRE el último `app.use`. Express lo
// reconoce como error-handler porque declara 4 parámetros
app.use(errorHandler);

export default app; // Default export for the server entry point
