import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createEnv } from '../src/config/env';
import { createPool } from '../src/config/database';
import { createLogger } from '../src/utils/logger';

/** Arbitrary constant advisory lock so two deploys cannot migrate concurrently. */
const MIGRATION_LOCK_ID = 4_917_001;

interface AppliedMigration {
  filename: string;
  checksum: string;
}

async function main(): Promise<void> {
  const env = createEnv();
  const logger = createLogger({ level: 'info', pretty: !env.isProduction });
  const pool = createPool(env, logger);
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    const directory = path.resolve(__dirname, '..', 'migrations');
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    if (files.length === 0) {
      throw new Error(`No migration files found in ${directory}`);
    }

    const { rows } = await client.query<AppliedMigration>(
      'SELECT filename, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

    let appliedCount = 0;
    for (const file of files) {
      const sql = await readFile(path.join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previousChecksum = applied.get(file);

      if (previousChecksum !== undefined) {
        if (previousChecksum !== checksum) {
          throw new Error(
            `Migration ${file} was modified after it was applied. ` +
              'Create a new migration instead of editing history.',
          );
        }
        logger.debug(`Already applied: ${file}`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }

      appliedCount += 1;
      logger.info(`Applied migration: ${file}`);
    }

    logger.info(
      appliedCount === 0
        ? 'Database schema is up to date.'
        : `Applied ${appliedCount} migration(s) successfully.`,
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
