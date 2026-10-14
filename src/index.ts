import app from './app.js';
import { connectDatabase, apiPort, logger } from './config/index.js';
import { seedUsers, deleteAllUsers } from './services/user.service.js';
import { deleteAllRefreshTokens } from './services/auth.service.js';

/**
 * SEEDING
 */
async function seedDatabase(): Promise<void> {
  try {
    logger.warn('Cleaning database collections...');
    await Promise.all([deleteAllUsers(), deleteAllRefreshTokens()]);

    logger.info('Seeding initial data...');
    const count: number = await seedUsers();

    logger.info('Database ready: %d users linked.', count);
  } catch (error) {
    logger.error(error, 'Seeding failed');
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    // CRITICAL: await the database setup before starting the server
    await connectDatabase();
    logger.info('Connected to MongoDB');

    await seedDatabase();

    app.listen(apiPort, () => {
      logger.info('Server running on port %d', apiPort);
    });
  } catch (error) {
    logger.fatal(error, 'Failed to start application');
    process.exit(1);
  }
}

void main();
