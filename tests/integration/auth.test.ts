import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken } from '../../src/utils/jwt';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertTenant, insertUser } from '../support/fixtures';
import { TEST_PASSWORD } from '../support/testEnv';

describe('authentication', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, {
      subdomain: 'alpha',
      companyName: 'Alpha Builders Pro',
    });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit' });

    await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, alphaTenantId, 'client@alpha.test', 'client');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('issues a token and returns the documented login payload', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user).toMatchObject({
      email: 'admin@alpha.test',
      role: 'admin',
    });
    expect(response.body.tenantBranding).toMatchObject({
      companyName: 'Alpha Builders Pro',
      primaryColor: '#0F172A',
    });
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('normalises email casing and whitespace', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: '  ADMIN@Alpha.Test  ', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
  });

  it('returns the same opaque 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'admin@alpha.test', password: 'wrong-password' });

    const unknownEmail = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'ghost@alpha.test', password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe('Invalid email or password.');
    expect(unknownEmail.body.error).toBe('Invalid email or password.');
  });

  it('rejects requests without a bearer token', async () => {
    const response = await request(ctx.app).get('/api/v1/projects').set('Host', HOSTS.alpha);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Access token missing or expired.',
    });
  });

  it('rejects a token minted for a different tenant host with the exact 403 message', async () => {
    const summitToken = await login(ctx.app, HOSTS.summit, 'admin@summit.test');

    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(summitToken));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      'Access token scope does not match current tenant domain context.',
    );
    expect(response.body.code).toBe('TENANT_SCOPE_MISMATCH');
  });

  it('rejects a token whose user has been deleted', async () => {
    const token = await login(ctx.app, HOSTS.alpha, 'client@alpha.test');
    await ctx.db.query('DELETE FROM users WHERE email = $1', ['client@alpha.test']);

    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(token));

    expect(response.status).toBe(401);
  });

  it('ignores a forged role claim and uses the role stored in the database', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'client@alpha.test'",
    );
    const clientId = rows[0]?.id;
    if (!clientId) throw new Error('client fixture missing');

    // An attacker who could re-sign tokens would claim admin. The database wins.
    const forged = signAccessToken(
      { id: clientId, tenant_id: alphaTenantId, email: 'client@alpha.test', role: 'admin' },
      ctx.env,
    );

    const response = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(forged))
      .send({ projectName: 'Forged Project' });

    expect(response.status).toBe(403);
  });

  it('rejects malformed authorization schemes', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(401);
  });

  it('accepts a valid token for the correct tenant', async () => {
    const token = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');

    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
