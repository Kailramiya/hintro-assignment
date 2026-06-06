import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { startScheduler } from './services/scheduler/reminder.scheduler';
import { logger } from './utils/logger';
import app from './app';

async function main() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running`, {
      port: env.PORT,
      env: env.NODE_ENV,
      docs: `http://localhost:${env.PORT}/api-docs`,
    });
  });

  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: String(err) });
  process.exit(1);
});
