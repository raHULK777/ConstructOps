import { createServer } from 'node:http';
import { createApp } from '../src/app';
import { seedDemoTenants } from '../src/demo/seed';
import { silentLogger } from '../src/utils/logger';
import { FakeRedis } from '../tests/support/fakeRedis';
import { createTestDb } from '../tests/support/testDb';
import { createTestEnv } from '../tests/support/testEnv';

/**
 * Development API with no PostgreSQL or Redis installed: the real application,
 * middleware and SQL run against an in-memory engine seeded with the demo
 * tenants. Intended for portal development on a laptop.
 *
 *   npm run dev:memory      # API on :8080
 *   npm run portal:dev      # portal on :3000
 */

const PORT = Number(process.env.PORT ?? 8080);
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!123';

async function main(): Promise<void> {
  const db = await createTestDb();
  const redis = new FakeRedis();
  const env = createTestEnv({ PORT: String(PORT) });

  const summary = await seedDemoTenants(
    { db, bcryptRounds: env.bcryptRounds, logger: silentLogger() },
    SEED_PASSWORD,
  );

  const app = createApp({ env, db, redis, logger: silentLogger() });
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  console.log(`in-memory API listening on http://127.0.0.1:${PORT}`);
  console.log(`tenants: ${summary.subdomains.join(', ')} seeded (password: ${SEED_PASSWORD})`);
  console.log('workspace URLs: http://alpha-builders.constructops.test (via portal TENANT_HOST_OVERRIDE)');

  const shutdown = (): void => {
    server.close(() => {
      void db.end().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
