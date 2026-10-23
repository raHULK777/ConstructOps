import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app';
import { createEnv } from './config/env';
import { assertDatabaseReachable, createPool } from './config/database';
import { assertRedisReachable, createRedis } from './config/redis';
import { createLogger } from './utils/logger';

async function main(): Promise<void> {
  const env = createEnv();
  const logger = createLogger({
    level: env.nodeEnv === 'development' ? 'debug' : 'info',
    pretty: !env.isProduction,
  });

  const pool = createPool(env, logger);
  const redis = createRedis(env, logger);

  // PostgreSQL is required: without it nothing can be served. Redis is a
  // latency optimization, so a cold cache warms up instead of blocking boot.
  await assertDatabaseReachable(pool, logger);
  try {
    await assertRedisReachable(redis, logger);
  } catch (error) {
    logger.warn('Redis unreachable at boot; tenant cache will be bypassed', {
      error: (error as Error).message,
    });
  }

  const app = createApp({ env, db: pool, redis, logger });
  const server = createServer(app);

  server.listen(env.port, () => {
    logger.info('ConstructOps Engine listening', {
      port: env.port,
      environment: env.nodeEnv,
      platformRootDomain: env.platformRootDomain,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown requested', { signal });

    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close((closeError) => {
      if (closeError) logger.error('HTTP server failed to close', { error: closeError.message });

      void (async () => {
        try {
          await pool.end();
        } catch (error) {
          logger.warn('PostgreSQL pool close failed', { error: (error as Error).message });
        }
        try {
          await redis.quit();
        } catch {
          redis.disconnect();
        }
        clearTimeout(forceExit);
        process.exit(closeError ? 1 : 0);
      })();
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
