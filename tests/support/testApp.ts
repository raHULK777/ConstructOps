import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/config/database';
import type { Env } from '../../src/config/env';
import { silentLogger } from '../../src/utils/logger';
import { createTestDb } from './testDb';
import { createTestEnv, TEST_PASSWORD } from './testEnv';
import { FakeRedis } from './fakeRedis';

export const HOSTS = {
  alpha: 'alpha.constructops.test',
  summit: 'summit.constructops.test',
} as const;

export interface TestContext {
  app: Express;
  db: Db;
  redis: FakeRedis;
  env: Env;
  close: () => Promise<void>;
}

/**
 * The real Express pipeline, real middleware, real SQL, real JWT signing —
 * only PostgreSQL (pg-mem) and Redis (map) are substituted.
 */
export async function createTestContext(
  envOverrides: Record<string, string> = {},
): Promise<TestContext> {
  const db = await createTestDb();
  const redis = new FakeRedis();
  const env = createTestEnv(envOverrides);
  const app = createApp({ env, db, redis, logger: silentLogger() });

  return {
    app,
    db,
    redis,
    env,
    close: async () => {
      await db.end().catch(() => undefined);
    },
  };
}

export async function login(
  app: Express,
  host: string,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<string> {
  const session = await loginSession(app, host, email, password);
  return session.token;
}

export interface LoginSession {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

export async function loginSession(
  app: Express,
  host: string,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<LoginSession> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .set('Host', host)
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return {
    token: response.body.token as string,
    refreshToken: response.body.refreshToken as string,
    user: response.body.user as LoginSession['user'],
  };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
