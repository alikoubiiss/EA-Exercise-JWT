import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import { notFound } from '../errors/ApiError.js';
import type { PublicUser, UserQuery, UserPatch } from '../models/user.model.js';
import type { IdParam } from '../models/http.js';

/**
 * USER CONTROLLER — recurso /users, SIN password.
 * Los errores nunca se formatean aquí: se lanzan (`throw`) o se pasan
 * con `next(error)`, y es el error-handling middleware quien decide
 * el status code y la forma { message, code } de la respuesta.
 * La creación de usuarios es POST /auth/register (auth.controller).
 */

// GET /api/users?role=
export const getAllUsers = async (
  req: Request<unknown, unknown, unknown, UserQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // req.query ya ha pasado por validate(userQuerySchema, 'query')
    const users: PublicUser[] = await userService.listAllUsers(req.query);
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id
export const getUser = async (
  req: Request<IdParam>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user: PublicUser | null = await userService.findUserById(req.params.id);
    if (!user) {
      throw notFound(`User '${req.params.id}' not found`);
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// PUT (reemplazo completo) y PATCH (parcial) comparten controller:
// la diferencia la impone el esquema Zod de cada ruta.
export const updateExistingUser = async (
  req: Request<IdParam, unknown, UserPatch>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const updated: PublicUser | null = await userService.updateUser(req.params.id, req.body);
    if (!updated) {
      throw notFound(`User '${req.params.id}' not found`);
    }
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id -> 204 (también cierra sus sesiones)
export const removeUser = async (
  req: Request<IdParam>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const deletedUser: PublicUser | null = await userService.deleteUserById(req.params.id);
    if (!deletedUser) {
      throw notFound(`User '${req.params.id}' not found`);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
