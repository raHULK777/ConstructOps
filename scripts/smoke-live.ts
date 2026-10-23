import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/**
 * Live contract smoke test against a *running* API backed by real PostgreSQL
 * and Redis (used by the CI `integration` job, and runnable locally).
 *
 *   npm run smoke:live
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8080';
const ALPHA_HOST = process.env.ALPHA_HOST ?? 'alpha-builders.constructops.test';
const SUMMIT_HOST = process.env.SUMMIT_HOST ?? 'summit-renovations.constructops.test';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!123';

/**
 * CI runs with a real Redis service. A local PostgreSQL-only run (no Redis
 * available) sets EXPECT_REDIS=down and asserts the documented degradation.
 */
const EXPECT_REDIS = process.env.EXPECT_REDIS === 'down' ? 'down' : 'up';

interface ApiResponse {
  status: number;
  body: Record<string, unknown> | null;
}

function call(options: {
  method?: string;
  path: string;
  host: string;
  token?: string;
  body?: unknown;
}): Promise<ApiResponse> {
  const url = new URL(options.path, API_BASE_URL);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method ?? 'GET',
        headers: {
          Host: options.host,
          Accept: 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          raw += chunk;
        });
        response.on('end', () => {
          let body: Record<string, unknown> | null = null;
          try {
            body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          } catch {
            body = null;
          }
          resolve({ status: response.statusCode ?? 0, body });
        });
      },
    );

    request.setTimeout(10_000, () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function login(
  host: string,
  email: string,
): Promise<{ token: string; refreshToken: string }> {
  const response = await call({
    method: 'POST',
    path: '/api/v1/auth/login',
    host,
    body: { email, password: SEED_PASSWORD },
  });
  assert.equal(response.status, 200, `login failed for ${email}: ${JSON.stringify(response.body)}`);
  const token = response.body?.token;
  const refreshToken = response.body?.refreshToken;
  assert.equal(typeof token, 'string');
  assert.equal(typeof refreshToken, 'string');
  return { token: token as string, refreshToken: refreshToken as string };
}

function pass(step: string): void {
  console.log(`  ok  ${step}`);
}

async function main(): Promise<void> {
  const health = await call({ path: '/healthz', host: ALPHA_HOST });
  assert.equal(health.status, 200);
  pass('GET  /healthz');

  // Readiness requires PostgreSQL *and* Redis to answer.
  const ready = await call({ path: '/readyz', host: ALPHA_HOST });
  const checks = ready.body?.checks as { database?: string; redis?: string } | undefined;

  if (EXPECT_REDIS === 'up') {
    assert.equal(ready.status, 200, `readyz: ${JSON.stringify(ready.body)}`);
    assert.equal(checks?.database, 'ok');
    assert.equal(checks?.redis, 'ok');
    pass('GET  /readyz (postgres + redis)');
  } else {
    assert.equal(ready.status, 503);
    assert.equal(checks?.database, 'ok');
    assert.equal(checks?.redis, 'down');
    pass('GET  /readyz (postgres ok, redis degraded)');
  }

  const branding = await call({ path: '/api/v1/tenant/branding', host: ALPHA_HOST });
  assert.equal(branding.status, 200);
  const tenant = branding.body?.tenant as { companyName?: string };
  assert.equal(tenant.companyName, 'Alpha Builders Pro');
  pass('GET  /api/v1/tenant/branding');

  const adminSession = await login(ALPHA_HOST, 'admin@alphabuilders.com');
  const adminToken = adminSession.token;
  pass('POST /api/v1/auth/login (admin)');

  // Exercising PUT branding proves cache invalidation deletes the Redis entry,
  // then the public read re-populates it (get + setex + del against real Redis).
  const original = await call({ path: '/api/v1/tenant/branding', host: ALPHA_HOST });
  const originalColor = (original.body?.tenant as { primaryColor?: string } | undefined)
    ?.primaryColor;
  assert.equal(typeof originalColor, 'string');

  const updated = await call({
    method: 'PUT',
    path: '/api/v1/tenant/branding',
    host: ALPHA_HOST,
    token: adminToken,
    body: { primaryColor: '#123456' },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));

  const reread = await call({ path: '/api/v1/tenant/branding', host: ALPHA_HOST });
  assert.equal((reread.body?.tenant as { primaryColor?: string }).primaryColor, '#123456');

  const restored = await call({
    method: 'PUT',
    path: '/api/v1/tenant/branding',
    host: ALPHA_HOST,
    token: adminToken,
    body: { primaryColor: originalColor },
  });
  assert.equal(restored.status, 200);
  pass('PUT  /api/v1/tenant/branding (cache invalidation)');

  const projects = await call({ path: '/api/v1/projects', host: ALPHA_HOST, token: adminToken });
  assert.equal(projects.status, 200);
  const projectList = (projects.body?.projects ?? []) as Array<{ id: string; projectName: string }>;
  assert.equal(projectList.length, 2);
  const downtown = projectList.find((project) => project.projectName.startsWith('Downtown'));
  assert.ok(downtown);
  pass('GET  /api/v1/projects (tenant scoped)');

  const progress = await call({
    method: 'PUT',
    path: `/api/v1/projects/${downtown.id}/progress`,
    host: ALPHA_HOST,
    token: adminToken,
    body: { currentPhase: 'Drywall & Inspection', progressPercentage: 62 },
  });
  assert.equal(progress.status, 200, JSON.stringify(progress.body));
  pass('PUT  /api/v1/projects/:id/progress');

  const clientSession = await login(ALPHA_HOST, 'client@alphabuilders.com');
  const clientToken = clientSession.token;
  pass('POST /api/v1/auth/login (client)');

  const orders = await call({
    path: '/api/v1/change-orders?status=pending',
    host: ALPHA_HOST,
    token: clientToken,
  });
  assert.equal(orders.status, 200);
  const pending = (orders.body?.changeOrders ?? []) as Array<{ id: string; title: string }>;
  assert.equal(pending.length, 1, 'seed should expose exactly one pending order to the client');
  const pendingOrder = pending[0];
  assert.ok(pendingOrder);

  const approval = await call({
    method: 'PUT',
    path: `/api/v1/change-orders/${pendingOrder.id}/approve`,
    host: ALPHA_HOST,
    token: clientToken,
  });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));
  const audit = approval.body?.auditTrail as
    | {
        status?: string;
        signedBy?: string;
        signedAt?: string;
        ipAddress?: string;
      }
    | undefined;
  assert.equal(audit?.status, 'approved');
  assert.equal(typeof audit?.signedAt, 'string');
  assert.equal(typeof audit?.ipAddress, 'string');
  pass('PUT  /api/v1/change-orders/:id/approve (audit trail)');

  const duplicate = await call({
    method: 'PUT',
    path: `/api/v1/change-orders/${pendingOrder.id}/approve`,
    host: ALPHA_HOST,
    token: clientToken,
  });
  assert.equal(duplicate.status, 409);
  pass('PUT  approve twice -> 409');

  const summitSession = await login(SUMMIT_HOST, 'admin@summitrenovations.com');

  const crossTenant = await call({
    path: '/api/v1/projects',
    host: ALPHA_HOST,
    token: summitSession.token,
  });
  assert.equal(crossTenant.status, 403);
  assert.equal(
    crossTenant.body?.error,
    'Access token scope does not match current tenant domain context.',
  );
  pass('cross-tenant token -> 403');

  const gated = await call({
    path: '/api/v1/change-orders',
    host: SUMMIT_HOST,
    token: summitSession.token,
  });
  assert.equal(gated.status, 403);
  assert.equal(gated.body?.code, 'FEATURE_DISABLED');
  pass('disabled premium module -> 403');

  const unknownHost = await call({ path: '/api/v1/tenant/branding', host: 'nobody.constructops.test' });
  assert.equal(unknownHost.status, 404);
  pass('unknown host -> 404');

  // Rotation: the new pair replaces the old one, and the old access token dies
  // with its session. Logout then revokes the rotated session immediately.
  const rotationLogin = await login(ALPHA_HOST, 'admin@alphabuilders.com');
  const rotated = await call({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    host: ALPHA_HOST,
    body: { refreshToken: rotationLogin.refreshToken },
  });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
  const rotatedAccess = rotated.body?.token;
  const rotatedRefresh = rotated.body?.refreshToken;
  assert.equal(typeof rotatedAccess, 'string');
  assert.equal(typeof rotatedRefresh, 'string');
  assert.notEqual(rotatedRefresh, rotationLogin.refreshToken);

  const staleAccess = await call({
    path: '/api/v1/projects',
    host: ALPHA_HOST,
    token: rotationLogin.token,
  });
  assert.equal(staleAccess.status, 401);

  const replay = await call({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    host: ALPHA_HOST,
    body: { refreshToken: rotationLogin.refreshToken },
  });
  assert.equal(replay.status, 401);
  pass('POST /api/v1/auth/refresh (rotation + replay rejection)');

  const revokedLogin = await login(ALPHA_HOST, 'admin@alphabuilders.com');
  const logout = await call({
    method: 'POST',
    path: '/api/v1/auth/logout',
    host: ALPHA_HOST,
    body: { refreshToken: revokedLogin.refreshToken },
  });
  assert.equal(logout.status, 200);

  const afterLogout = await call({
    path: '/api/v1/projects',
    host: ALPHA_HOST,
    token: revokedLogin.token,
  });
  assert.equal(afterLogout.status, 401);
  pass('POST /api/v1/auth/logout (immediate access revocation)');

  console.log('smoke:live PASS');
}

main().catch((error: unknown) => {
  console.error('smoke:live FAIL', error);
  process.exit(1);
});
