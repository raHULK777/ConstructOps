import { Pool } from 'pg';
import type { Env } from './env';
import type { Logger } from '../utils/logger';

/**
 * Minimal database surface consumed by repositories. `pg.Pool` satisfies it,
 * and the in-memory test harness (pg-mem) is adapted to it, so services are
 * exercised without a live PostgreSQL instance.
 */
export type Queryable = Pick<Pool, 'query'>;
export type Db = Queryable & Pick<Pool, 'connect' | 'end'>;

export function createPool(env: Env, logger: Logger): Pool {
  const pool = new Pool({
    connectionString: env.databaseUrl,
    application_name: 'constructops-engine',
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // TLS is negotiated from sslmode=require in DATABASE_URL (pg-connection-string).
  });

  pool.on('error', (error) => {
    logger.error('Unexpected idle PostgreSQL client error', { error: error.message });
  });

  return pool;
}

export async function assertDatabaseReachable(db: Db, logger: Logger): Promise<void> {
  await db.query('SELECT 1');
  logger.info('PostgreSQL connection verified');
}
