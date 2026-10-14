import pino from 'pino';
import { nodeEnv } from './env.js';

/**
 * PINO LOGGER CONFIGURATION
 * We use 'pino-pretty' in development for readable logs,
 * but in production, it sends structured JSON.
 */

export const logger = pino({
  level: nodeEnv === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty', // Makes logs readable in the terminal
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});
