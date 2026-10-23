import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { createApp } from '../src/app';
import { createMailer } from '../src/services/mailer';
import { silentLogger } from '../src/utils/logger';
import { createTestDb } from '../tests/support/testDb';
import { FakeRedis } from '../tests/support/fakeRedis';
import { createTestEnv, TEST_PASSWORD } from '../tests/support/testEnv';
import { insertProject, insertTenant, insertUser } from '../tests/support/fixtures';

/**
 * Contract smoke test over a real TCP socket. It exercises the same composed
 * Express app that `server.ts` boots, with PostgreSQL and Redis substituted by
 * in-memory doubles (no Docker/PG available in this environment).
 */

interface HttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown> | null;
}

function call(
  port: number,
  options: {
    method?: string;
    path?: string;
    host: string;
    body?: unknown;
    token?: string;
  },
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path ?? '/',
        headers: {
          Host: options.host,
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          raw += chunk;
        });
        res.on('end', () => {
          let body: Record<string, unknown> | null = null;
          try {
            body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          } catch {
            body = null;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main(): Promise<void> {
  const db = await createTestDb();
  const redis = new FakeRedis();
  const env = createTestEnv();
  const app = createApp({
    env,
    db,
    redis,
    mailer: createMailer('none', silentLogger()),
    logger: silentLogger(),
  });

  const tenantId = await insertTenant(db, { subdomain: 'smoke', companyName: 'Smoke Builders' });
  await insertUser(db, tenantId, 'admin@smoke.test', 'admin');
  const projectId = await insertProject(db, tenantId, { name: 'Smoke Tower', progressPercentage: 20 });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind smoke server');
  const port = address.port;
  const host = 'smoke.constructops.test';

  console.log(`smoke: listening on 127.0.0.1:${port}`);

  try {
    const health = await call(port, { path: '/healthz', host });
    assert.equal(health.status, 200);
    assert.equal(health.body?.status, 'ok');
    console.log('  ok  GET  /healthz');

    const ready = await call(port, { path: '/readyz', host });
    assert.equal(ready.status, 200);
    console.log('  ok  GET  /readyz');

    const branding = await call(port, { path: '/api/v1/tenant/branding', host });
    assert.equal(branding.status, 200);
    const tenant = branding.body?.tenant as { companyName: string } | undefined;
    assert.equal(tenant?.companyName, 'Smoke Builders');
    console.log('  ok  GET  /api/v1/tenant/branding');

    const login = await call(port, {
      method: 'POST',
      path: '/api/v1/auth/login',
      host,
      body: { email: 'admin@smoke.test', password: TEST_PASSWORD },
    });
    assert.equal(login.status, 200);
    const token = login.body?.token;
    assert.equal(typeof token, 'string');
    console.log('  ok  POST /api/v1/auth/login');

    const projects = await call(port, { path: '/api/v1/projects', host, token: token as string });
    assert.equal(projects.status, 200);
    assert.equal((projects.body?.projects as unknown[]).length, 1);
    console.log('  ok  GET  /api/v1/projects');

    const progress = await call(port, {
      method: 'PUT',
      path: `/api/v1/projects/${projectId}/progress`,
      host,
      token: token as string,
      body: { currentPhase: 'Drywall', progressPercentage: 55 },
    });
    assert.equal(progress.status, 200);
    const updated = progress.body?.updatedProject as { progressPercentage: number };
    assert.equal(updated.progressPercentage, 55);
    console.log('  ok  PUT  /api/v1/projects/:id/progress');

    const estimate = await call(port, {
      method: 'POST',
      path: '/api/v1/tools/estimate',
      host,
      body: { squareFootage: 1000, materialTier: 'premium', projectType: 'residential_remodel' },
    });
    assert.equal(estimate.status, 200);
    const calculation = estimate.body?.calculation as { estimatedCostLow: number };
    assert.ok(calculation.estimatedCostLow > 0);
    console.log('  ok  POST /api/v1/tools/estimate');

    const unknownHost = await call(port, {
      path: '/api/v1/tenant/branding',
      host: 'ghost.constructops.test',
    });
    assert.equal(unknownHost.status, 404);
    console.log('  ok  GET  unknown host -> 404');

    const badToken = await call(port, { path: '/api/v1/projects', host, token: 'not-a-token' });
    assert.equal(badToken.status, 401);
    console.log('  ok  GET  bad token -> 401');

    console.log('smoke: PASS');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error('smoke: FAIL', error);
  process.exit(1);
});
