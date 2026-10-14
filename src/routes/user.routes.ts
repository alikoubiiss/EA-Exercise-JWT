import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { validate } from '../middlewares/validatorMiddleware.js';
import { authenticate, isOwner } from '../middlewares/jwtMiddleware.js';
import { userQuerySchema, userUpdateSchema, userPatchSchema } from '../models/user.model.js';

// ============================================================
// RUTAS DEL RECURSO /users (montadas en /api/users) — SIN password
// ============================================================

const router = Router();

// Composición: `authenticate` se aplica a TODAS las rutas de este
// router (todas exigen access token). Las que modifican, además, `isOwner`.
router.use(authenticate);

// GET all users (?role= para refinar la colección)
router.get('/', validate(userQuerySchema, 'query'), userController.getAllUsers);

// GET a specific user by ID
router.get('/:id', userController.getUser);

// PUT reemplaza el recurso ENTERO (name + email)
router.put('/:id', isOwner, validate(userUpdateSchema), userController.updateExistingUser);

// PATCH modifica solo una PARTE del recurso
router.patch('/:id', isOwner, validate(userPatchSchema), userController.updateExistingUser);

// DELETE a user (y sus sesiones)
router.delete('/:id', isOwner, userController.removeUser);

export default router;
