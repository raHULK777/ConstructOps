import { createEnv, type Env } from '../../src/config/env';

export const TEST_JWT_SECRET = 'test-only-hmac-secret-with-more-than-32-characters';
export const TEST_PASSWORD = 'TestPassword123!';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '8080',
  DATABASE_URL: 'postgresql://constructops:constructops@localhost:5432/constructops_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: TEST_JWT_SECRET,
  JWT_EXPIRES_IN: '1h',
  JWT_ISSUER: 'constructops',
  JWT_AUDIENCE: 'constructops-api',
  REFRESH_TOKEN_TTL_DAYS: '30',
  APP_PORTAL_URL: 'http://localhost:3000',
  RESET_TOKEN_TTL_MINUTES: '60',
  MAIL_TRANSPORT: 'console',
  PLATFORM_ROOT_DOMAIN: 'constructops.test',
  TRUST_PROXY: 'false',
  CORS_ORIGINS: '',
  BCRYPT_ROUNDS: '4',
  TENANT_CACHE_TTL_SECONDS: '3600',
};

export function createTestEnv(overrides: Record<string, string> = {}): Env {
  return createEnv({ ...BASE_ENV, ...overrides });
}
