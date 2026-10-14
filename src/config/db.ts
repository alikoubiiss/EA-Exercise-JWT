import mongoose from 'mongoose';
import { mongoUri } from './env.js';

// ============================================================
// CONEXIÓN A LA BASE DE DATOS
// ============================================================

mongoose.set('strictQuery', true);

export const connectDatabase = (uri: string = mongoUri): Promise<typeof mongoose> =>
  mongoose.connect(uri);

export const disconnectDatabase = (): Promise<void> => mongoose.disconnect();
