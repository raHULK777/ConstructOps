import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb, DataType } from 'pg-mem';
import type { Db } from '../../src/config/database';

const MIGRATION_FILES = ['001_tables.sql', '002_indexes.sql'] as const;

/**
 * In-memory PostgreSQL for the test suite. The production DDL is executed
 * verbatim, so constraints, defaults and cascade rules are the ones that ship.
 * Only the extension file is skipped (pg-mem has no CREATE EXTENSION).
 */
export async function createTestDb(): Promise<Db> {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
  });

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();

  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(path.resolve(process.cwd(), 'migrations', file), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    // Execute statement-by-statement: portable across pg-mem releases and it
    // keeps `--` comments attached to the statement they describe.
    const statements = sql
      .split(/;\s*(?:\n|$)/)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && !/^--\s*$/.test(statement));

    for (const statement of statements) {
      await pool.query(`${statement};`);
    }
  }

  return pool as unknown as Db;
}
