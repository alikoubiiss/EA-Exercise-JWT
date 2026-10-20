import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { logger, nodeEnv, refreshTokenTtl } from '../config/index.js';
import { requireUserId } from '../middlewares/jwtMiddleware.js';
import type { PublicUser } from '../models/user.model.js';
import type { TokenPair } from '../models/jwtpayload.model.js';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from '../models/auth.model.js';
import type { IdParam } from '../models/http.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: nodeEnv === 'production',
  path: '/api/auth',
};

/**
 * AUTH CONTROLLER
 * Registro, login, refresh, logout y cambio de contraseña.
 * - El body ya viene validado por Zod (validatorMiddleware).
 * - El JWT ya viene DECODIFICADO por jwtMiddleware: aquí solo se
 *   lee el id del usuario (req.userId o res.locals.userId).
 * - Los errores se propagan con next(error) al errorHandler.
 * - `finally` se ejecuta SIEMPRE (éxito o error): útil para trazas.
 */

// POST /api/auth/register -> 201 Created (+ Location del recurso)
export const register = async (
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user: PublicUser = await authService.registerUser(req.body);
    res.status(201).location(`/api/users/${user._id.toString()}`).json(user);
  } catch (error) {
    next(error);
  } finally {
    logger.debug('register attempt for %s', req.body.email);
  }
};

// POST /api/auth/login -> 200 { token, user }
export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { user, tokens } = await authService.login(req.body);
    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: refreshTokenTtl * 1000,
    });
    res.status(200).json({ token: tokens.accessToken, user });
  } catch (error) {
    next(error);
  } finally {
    logger.debug('login attempt for %s', req.body.email);
  }
};

// POST /api/auth/refresh -> 200 { token }
// Forma 1: leemos el id que el middleware dejó en `req.userId`.
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = requireUserId(req.userId);
    const tokens: TokenPair = await authService.rotateRefreshToken(userId, req.cookies.refreshToken);
    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: refreshTokenTtl * 1000,
    });
    res.status(200).json({ token: tokens.accessToken });
  } catch (error) {
    next(error);
  } finally {
    logger.debug('refresh requested by %s', req.userId);
  }
};

// POST /api/auth/logout -> 204 No Content
// Forma 2: leemos el id de `res.locals.userId`.
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = requireUserId(res.locals.userId);
    await authService.revokeRefreshToken(userId, req.cookies.refreshToken);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(204).send();
  } catch (error) {
    next(error);
  } finally {
    logger.debug('logout requested by %s', res.locals.userId);
  }
};

// PUT /api/users/:id/password -> 204 No Content
// `isOwner` ya garantizó que :id === usuario del token.
export const changePassword = async (
  req: Request<IdParam, unknown, ChangePasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = requireUserId(res.locals.userId);
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(userId, currentPassword, newPassword);
    res.status(204).send();
  } catch (error) {
    next(error);
  } finally {
    logger.debug('password change requested for %s', req.params.id);
  }
};
