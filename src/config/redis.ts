import Redis from 'ioredis';
import type { Env } from './env';
import type { Logger } from '../utils/logger';

/**
 * Subset of ioredis used by the tenant cache. Narrowing the surface keeps the
 * middleware testable with an in-memory double and documents the only Redis
 * operations this service is allowed to perform.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
}

export function createRedis(env: Env, logger: Logger): Redis {
  const client = new Redis(env.redisUrl, {
    connectionName: 'constructops-engine',
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    // Never queue commands while disconnected: a down cache must cost a few
    // milliseconds (then fall back to PostgreSQL), not the socket timeout.
    enableOfflineQueue: false,
    enableReadyCheck: true,
    retryStrategy(times: number): number {
      return Math.min(times * 250, 2_000);
    },
  });

  client.on('error', (error: Error) => {
    logger.warn('Redis client error; continuing without cache benefits', { error: error.message });
  });

  return client;
}

export async function assertRedisReachable(redis: RedisLike, logger: Logger): Promise<void> {
  await redis.ping();
  logger.info('Redis connection verified');
}
