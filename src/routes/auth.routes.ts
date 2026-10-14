import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validatorMiddleware.js';
import { authenticate, isOwner, verifyRefreshToken } from '../middlewares/jwtMiddleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenBodySchema,
  changePasswordSchema,
} from '../models/auth.model.js';

// ============================================================
// RUTAS DE AUTENTICACIÓN 
// ============================================================
// Todo lo que maneja credenciales vive en este router. Las de
// /auth/* son acciones de sesión (convención de facto); el cambio de
// contraseña sí es un sub-recurso del usuario: /users/{id}/password.
//
// Orden de la cadena: autenticar -> autorizar -> validar -> controller.
// (Un anónimo recibe 401 antes de que se revele nada sobre el body.)
// ============================================================

const router = Router();

// POST crea el usuario -> 201
router.post('/auth/register', validate(registerSchema), authController.register);

// POST inicia sesión: devuelve access + refresh token -> 200
router.post('/auth/login', validate(loginSchema), authController.login);

// POST rota el refresh token: nuevo access + nuevo refresh -> 200
router.post(
  '/auth/refresh',
  validate(refreshTokenBodySchema),
  verifyRefreshToken,
  authController.refresh,
);

// POST revoca el refresh token en la BD -> 204
// No exige access token: así se puede cerrar sesión aunque haya caducado.
router.post(
  '/auth/logout',
  validate(refreshTokenBodySchema),
  verifyRefreshToken,
  authController.logout,
);

// PUT reemplaza la contraseña (protegida y solo para el propio usuario) -> 204
router.put(
  '/users/:id/password',
  authenticate,
  isOwner,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
