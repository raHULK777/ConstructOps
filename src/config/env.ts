import { z } from 'zod';

/**
 * Environment contract. Missing or malformed values abort the boot instead of
 * surfacing as a confusing runtime failure later (Architecture.md, section 4).
 */

function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'false' || value === '0') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return raw.trim();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(2).default('15m'),
  JWT_ISSUER: z.string().min(1).default('constructops'),
  JWT_AUDIENCE: z.string().min(1).default('constructops-api'),

  /** Lifetime of a refresh token / server-side session. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  PLATFORM_ROOT_DOMAIN: z.string().min(1).optional(),

  TRUST_PROXY: z.string().default('false'),
  CORS_ORIGINS: z.string().default(''),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TENANT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  refreshTokenTtlDays: number;
  platformRootDomain: string | null;
  trustProxy: boolean | number | string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  bcryptRounds: number;
  tenantCacheTtlSeconds: number;
}

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/** Pure parser so tests can build an Env without touching process.env. */
export function createEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n  - ');
    throw new EnvironmentError(`Invalid environment configuration:\n  - ${details}`);
  }

  const value = parsed.data;
  const rootDomain = value.PLATFORM_ROOT_DOMAIN
    ? normalizeRootDomain(value.PLATFORM_ROOT_DOMAIN)
    : null;

  return {
    nodeEnv: value.NODE_ENV,
    isProduction: value.NODE_ENV === 'production',
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    jwtSecret: value.JWT_SECRET,
    jwtExpiresIn: value.JWT_EXPIRES_IN,
    jwtIssuer: value.JWT_ISSUER,
    jwtAudience: value.JWT_AUDIENCE,
    refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
    platformRootDomain: rootDomain,
    trustProxy: parseTrustProxy(value.TRUST_PROXY),
    corsOrigins: value.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim().toLowerCase().replace(/\/+$/, ''))
      .filter(Boolean),
    rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: value.RATE_LIMIT_MAX,
    authRateLimitMax: value.AUTH_RATE_LIMIT_MAX,
    bcryptRounds: value.BCRYPT_ROUNDS,
    tenantCacheTtlSeconds: value.TENANT_CACHE_TTL_SECONDS,
  };
}

function normalizeRootDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '')
    .replace(/^www\./, '');
}
