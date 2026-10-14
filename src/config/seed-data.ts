import type { UserSchemaType } from '../models/user.model.js';

// ============================================================
// DATOS DE PRUEBA (seed)
// ============================================================

export const usersSeed: UserSchemaType[] = [
  {
    name: 'Bill',
    password: '123456',
    email: 'bill@initech.com',
    role: 'ADMIN' as const,
  },
  {
    name: 'Peter',
    password: '123456',
    email: 'peter@initech.com',
    role: 'USER' as const,
  },
  {
    name: 'Alice',
    password: '123456',
    email: 'alice@umbrella.com',
    role: 'EDITOR' as const,
  },
];
