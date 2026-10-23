import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertTenant, insertUser } from '../support/fixtures';
import { TEST_PASSWORD } from '../support/testEnv';

const GENERIC_MESSAGE = 'If an account exists for that email, a reset link has been sent.';
const NEW_PASSWORD = 'BrandNewPass123!';

describe('password reset', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;
  let adminId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit' });
    adminId = await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function forgot(host: string, email: string) {
    return request(ctx.app).post('/api/v1/auth/forgot-password').set('Host', host).send({ email });
  }

  async function reset(host: string, token: string, newPassword = NEW_PASSWORD) {
    return request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .set('Host', host)
      .send({ token, newPassword });
  }

  it('emails a reset link for a known address and keeps the response generic', async () => {
    const response = await forgot(HOSTS.alpha, 'admin@alpha.test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    expect(ctx.mailer.messages).toHaveLength(1);
    expect(ctx.mailer.last?.to).toBe('admin@alpha.test');
    expect(ctx.mailer.last?.text).toContain('/reset-password?token=');

    const token = ctx.mailer.lastResetToken();
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(30);
  });

  it('gives an identical response and sends nothing for an unknown address', async () => {
    const response = await forgot(HOSTS.alpha, 'ghost@alpha.test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    expect(ctx.mailer.messages).toHaveLength(0);
  });

  it('stores only the hash of the reset token', async () => {
    await forgot(HOSTS.alpha, 'admin@alpha.test');
    const token = ctx.mailer.lastResetToken()!;

    const { rows } = await ctx.db.query<{ token_hash: string }>(
      'SELECT token_hash FROM password_reset_tokens WHERE tenant_id = $1',
      [alphaTenantId],
    );

    expect(rows[0]?.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(rows[0]?.token_hash).not.toBe(token);
  });

  it('resets the password exactly once and the new password works', async () => {
    await forgot(HOSTS.alpha, 'admin@alpha.test');
    const token = ctx.mailer.lastResetToken()!;

    const response = await reset(HOSTS.alpha, token);
    expect(response.status).toBe(200);

    const newLogin = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);

    const oldLogin = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const replay = await reset(HOSTS.alpha, token);
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe('This reset link is invalid or has expired.');
  });

  it('revokes existing sessions when the password changes', async () => {
    const existingToken = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    await forgot(HOSTS.alpha, 'admin@alpha.test');
    await reset(HOSTS.alpha, ctx.mailer.lastResetToken()!);

    const stale = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(existingToken));

    expect(stale.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = 'expired-token-value-for-testing-123456';
    await ctx.db.query(
      `INSERT INTO password_reset_tokens (id, tenant_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        alphaTenantId,
        adminId,
        createHash('sha256').update(token).digest('hex'),
        new Date(Date.now() - 60_000).toISOString(),
      ],
    );

    const response = await reset(HOSTS.alpha, token);
    expect(response.status).toBe(400);
  });

  it('does not accept a token on another tenant host', async () => {
    await forgot(HOSTS.alpha, 'admin@alpha.test');
    const token = ctx.mailer.lastResetToken()!;

    const response = await reset(HOSTS.summit, token);
    expect(response.status).toBe(400);
  });

  it('validates the new password and the token shape', async () => {
    const weak = await reset(HOSTS.alpha, 'a'.repeat(40), 'short');
    const missing = await reset(HOSTS.alpha, 'short-token');

    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('VALIDATION_ERROR');
    expect(missing.status).toBe(400);
  });
});
