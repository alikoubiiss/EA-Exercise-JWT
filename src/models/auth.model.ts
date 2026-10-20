import { z } from 'zod';
import { nameField, emailField, passwordField } from './user.model.js';

// ============================================================
// Modelos auxiliares del usuario: son las ÚNICAS entradas de la API
// que contienen una contraseña. El recurso /users nunca la acepta.
// ============================================================

// POST /auth/register — el rol NO se acepta: lo asigna el servidor.
export const registerSchema = z.strictObject({
  name: nameField,
  email: emailField,
  password: passwordField,
});

// POST /auth/login
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

// PUT /users/:id/password
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordField,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
