import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken } from '../../src/utils/jwt';
import { HOSTS, bearer, createTestContext, loginSession, type TestContext } from '../support/testApp';
import { insertSession, insertTenant, insertUser } from '../support/fixtures';

describe('sessions, refresh rotation and revocation', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit' });
    await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('issues a refresh token and explicit expiries at login', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: 'TestPassword123!' });

    expect(response.status).toBe(200);
    expect(typeof response.body.refreshToken).toBe('string');
    expect(response.body.refreshToken.length).toBeGreaterThan(30);
    expect(new Date(response.body.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(response.body.refreshTokenExpiresAt).getTime()).toBeGreaterThan(
      new Date(response.body.accessTokenExpiresAt).getTime(),
    );
  });

  it('rotates the refresh token and invalidates the previous access token', async () => {
    const session = await loginSession(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    const before = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(session.token));
    expect(before.status).toBe(200);

    const rotated = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: session.refreshToken });

    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(session.refreshToken);
    expect(rotated.body.token).not.toBe(session.token);

    // Rotation revokes the session the old access token was bound to.
    const staleAccess = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(session.token));
    expect(staleAccess.status).toBe(401);

    const freshAccess = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(rotated.body.token as string));
    expect(freshAccess.status).toBe(200);
  });

  it('detects refresh-token reuse and revokes every session for the user', async () => {
    const session = await loginSession(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    const rotated = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: session.refreshToken });
    expect(rotated.status).toBe(200);

    // Replaying the consumed token is treated as theft.
    const replay = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: session.refreshToken });
    expect(replay.status).toBe(401);

    // The legitimate successor was revoked too, and its access token is dead.
    const successorRefresh = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: rotated.body.refreshToken as string });
    expect(successorRefresh.status).toBe(401);

    const successorAccess = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(rotated.body.token as string));
    expect(successorAccess.status).toBe(401);
  });

  it('revokes the session on logout, immediately invalidating the access token', async () => {
    const session = await loginSession(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    const loggedOut = await request(ctx.app)
      .post('/api/v1/auth/logout')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: session.refreshToken });
    expect(loggedOut.status).toBe(200);

    const afterLogout = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(session.token));
    expect(afterLogout.status).toBe(401);

    const refreshAfterLogout = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: session.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('returns success for logout with an unknown token (no oracle)', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/logout')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: 'x'.repeat(40) });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('rejects a valid refresh token presented on another tenant host', async () => {
    const session = await loginSession(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    const response = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.summit)
      .send({ refreshToken: session.refreshToken });

    expect(response.status).toBe(401);
  });

  it('rejects an access token whose session has expired or been revoked', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'admin@alpha.test'",
    );
    const userId = rows[0]?.id;
    if (!userId) throw new Error('user fixture missing');

    const expiredSession = await insertSession(ctx.db, alphaTenantId, userId, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const expiredToken = signAccessToken(
      { id: userId, tenant_id: alphaTenantId, email: 'admin@alpha.test', role: 'admin' },
      expiredSession,
      ctx.env,
    );

    const expired = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(expiredToken));
    expect(expired.status).toBe(401);

    const revokedSession = await insertSession(ctx.db, alphaTenantId, userId, {
      revokedAt: new Date().toISOString(),
    });
    const revokedToken = signAccessToken(
      { id: userId, tenant_id: alphaTenantId, email: 'admin@alpha.test', role: 'admin' },
      revokedSession,
      ctx.env,
    );

    const revoked = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(revokedToken));
    expect(revoked.status).toBe(401);
  });

  it('rejects a syntactically valid but unknown refresh token', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: randomUUID() + randomUUID() });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid or expired refresh token.');
  });

  it('validates the refresh payload', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/refresh')
      .set('Host', HOSTS.alpha)
      .send({ refreshToken: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
