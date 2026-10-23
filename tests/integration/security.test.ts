import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, createTestContext, login, type TestContext } from '../support/testApp';
import { insertTenant, insertUser } from '../support/fixtures';
import { TEST_PASSWORD } from '../support/testEnv';

describe('security and platform edge cases', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    const tenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
    await insertUser(ctx.db, tenantId, 'admin@alpha.test', 'admin');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('rejects non-JSON payloads with 415', async () => {
    const textPlain = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .set('Content-Type', 'text/plain')
      .send('email=a');

    const multipart = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .set('Content-Type', 'multipart/form-data; boundary=----x')
      .send('------x--');

    expect(textPlain.status).toBe(415);
    expect(multipart.status).toBe(415);
    expect(textPlain.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Request body must be valid JSON.');
  });

  it('rejects oversized bodies with 413', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: 'x'.repeat(300 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns the standard envelope for unknown routes', async () => {
    const response = await request(ctx.app).get('/api/v1/nope').set('Host', HOSTS.alpha);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Route not found.',
      code: 'NOT_FOUND',
    });
    expect(typeof response.body.requestId).toBe('string');
  });

  it('echoes a well-formed request id and generates one otherwise', async () => {
    const echoed = await request(ctx.app)
      .get('/healthz')
      .set('x-request-id', 'client-request-123');

    const generated = await request(ctx.app).get('/healthz').set('x-request-id', 'short');

    expect(echoed.headers['x-request-id']).toBe('client-request-123');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.headers['x-request-id']).not.toBe('short');
  });

  it('exposes liveness and dependency readiness', async () => {
    const health = await request(ctx.app).get('/healthz');
    const ready = await request(ctx.app).get('/readyz');

    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(ready.status).toBe(200);
    expect(ready.body.checks).toEqual({ database: 'ok', redis: 'ok' });

    ctx.redis.failReads = true;
    const degraded = await request(ctx.app).get('/readyz');

    expect(degraded.status).toBe(503);
    expect(degraded.body.checks).toEqual({ database: 'ok', redis: 'down' });
  });

  it('does not leak internals when a dependency fails', async () => {
    await ctx.db.query('DROP TABLE tenants CASCADE');

    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal server error.');
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toContain('relation');
    expect(JSON.stringify(response.body)).not.toContain('tenants');
    expect(typeof response.body.requestId).toBe('string');
  });

  it('survives SQL injection attempts in the login body', async () => {
    const injection = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: "admin@alpha.test' OR '1'='1", password: "' OR '1'='1" });

    expect(injection.status).toBe(400);
    expect(injection.body.code).toBe('VALIDATION_ERROR');

    // The tenant and its user are untouched by the attempt.
    const token = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    expect(typeof token).toBe('string');
  });

  it('sets defensive response headers without advertising the framework', async () => {
    const response = await request(ctx.app).get('/healthz');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('refuses a bearer prefix with no token', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set('Authorization', 'Bearer ');

    expect(response.status).toBe(401);
  });

  it('keeps the documented password out of any response body', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(TEST_PASSWORD);
  });

  it('emits CORS headers only for configured origins', async () => {
    const corsCtx = await createTestContext({ CORS_ORIGINS: 'https://portal.example.com' });

    try {
      const allowed = await request(corsCtx.app)
        .options('/api/v1/projects')
        .set('Host', HOSTS.alpha)
        .set('Origin', 'https://portal.example.com');

      const denied = await request(corsCtx.app)
        .get('/api/v1/tenant/branding')
        .set('Host', HOSTS.alpha)
        .set('Origin', 'https://evil.example.com');

      expect(allowed.status).toBe(204);
      expect(allowed.headers['access-control-allow-origin']).toBe('https://portal.example.com');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await corsCtx.close();
    }
  });
});
