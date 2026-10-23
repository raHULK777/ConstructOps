import 'dotenv/config';
import { createEnv } from '../src/config/env';
import { createPool } from '../src/config/database';
import { createLogger } from '../src/utils/logger';
import { DEMO_TENANTS, seedDemoTenants } from '../src/demo/seed';

async function main(): Promise<void> {
  const env = createEnv();
  const logger = createLogger({ level: 'info', pretty: !env.isProduction });
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe!123';

  if (password.length < 8) {
    throw new Error('SEED_PASSWORD must be at least 8 characters.');
  }

  const pool = createPool(env, logger);
  try {
    const summary = await seedDemoTenants(
      { db: pool, bcryptRounds: env.bcryptRounds, logger },
      password,
    );

    logger.info('Seed complete', summary.created);
    for (const tenant of DEMO_TENANTS) {
      const host = env.platformRootDomain
        ? `${tenant.subdomain}.${env.platformRootDomain}`
        : tenant.subdomain;
      logger.info(`  ${tenant.companyName}: https://${host} (admin: ${tenant.users[0]?.email})`);
    }
    logger.info('All demo accounts use SEED_PASSWORD (default ChangeMe!123).');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
