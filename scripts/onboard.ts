import 'dotenv/config';
import { createEnv } from '../src/config/env';
import { createPool } from '../src/config/database';
import { createRedis } from '../src/config/redis';
import { createMailer } from '../src/services/mailer';
import { createLogger } from '../src/utils/logger';
import { onboardTenantSchema } from '../src/modules/tenant/tenant.schemas';
import { onboardTenant } from '../src/modules/tenant/tenant.service';

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) return undefined;
  return value;
}

const USAGE = `
Provision a white-label tenant (atomic: tenant + administrator).

Usage:
  npm run onboard -- \\
    --company "Acme Builders" \\
    --subdomain acme-builders \\
    --email admin@acme.com \\
    --password "a-strong-password" \\
    [--domain acme.example.com] \\
    [--primary-color "#0F172A"] [--secondary-color "#3B82F6"] \\
    [--change-orders false]
`;

async function main(): Promise<void> {
  const parsed = onboardTenantSchema.safeParse({
    companyName: readFlag('company'),
    subdomain: readFlag('subdomain'),
    customDomain: readFlag('domain'),
    adminEmail: readFlag('email'),
    adminPassword: readFlag('password'),
    primaryColor: readFlag('primary-color'),
    secondaryColor: readFlag('secondary-color'),
    enableChangeOrders: readFlag('change-orders') !== 'false',
  });

  if (!parsed.success) {
    console.error(USAGE);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const env = createEnv();
  const logger = createLogger({ level: 'info', pretty: !env.isProduction });
  const pool = createPool(env, logger);
  const redis = createRedis(env, logger);

  try {
    const result = await onboardTenant(
      { env, db: pool, redis, mailer: createMailer(env.mailTransport, logger), logger },
      parsed.data,
    );
    const host = env.platformRootDomain
      ? `${result.subdomain}.${env.platformRootDomain}`
      : (parsed.data.customDomain ?? result.subdomain);

    console.log('Tenant provisioned successfully.');
    console.log(`  Company:  ${parsed.data.companyName}`);
    console.log(`  Admin:    ${result.adminEmail}`);
    console.log(`  Tenant:   ${result.tenantId}`);
    console.log(`  Endpoint: https://${host}`);
  } finally {
    redis.disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
