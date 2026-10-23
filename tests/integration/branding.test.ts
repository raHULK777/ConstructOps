import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertTenant, insertUser } from '../support/fixtures';
import { tenantCacheKey } from '../../src/utils/host';

describe('white-label branding', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;
  let adminToken: string;
  let clientToken: string;
  let fieldToken: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, {
      subdomain: 'alpha',
      companyName: 'Alpha Builders Pro',
      customDomain: 'alpha-builders.example.com',
    });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit', companyName: 'Summit Group' });

    await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, alphaTenantId, 'client@alpha.test', 'client');
    await insertUser(ctx.db, alphaTenantId, 'field@alpha.test', 'field_staff');

    adminToken = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    clientToken = await login(ctx.app, HOSTS.alpha, 'client@alpha.test');
    fieldToken = await login(ctx.app, HOSTS.alpha, 'field@alpha.test');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('updates brand colours and invalidates the tenant cache', async () => {
    await request(ctx.app).get('/api/v1/tenant/branding').set('Host', HOSTS.alpha);
    expect(ctx.redis.has(tenantCacheKey(HOSTS.alpha))).toBe(true);

    const updated = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ primaryColor: '#112233', secondaryColor: '#445566', companyName: 'Alpha Rebranded' });

    expect(updated.status).toBe(200);
    expect(updated.body.tenant).toMatchObject({
      companyName: 'Alpha Rebranded',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });
    expect(ctx.redis.has(tenantCacheKey(HOSTS.alpha))).toBe(false);

    const reread = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);
    expect(reread.body.tenant.primaryColor).toBe('#112233');
    expect(ctx.redis.has(tenantCacheKey(HOSTS.alpha))).toBe(true);
  });

  it('merges a partial branding config without wiping other tokens', async () => {
    const response = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        brandingConfig: {
          layout: { border_radius: '12px' },
          typography: { base_size: '18px' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.tenant.brandingConfig.typography.font_family).toBe('Manrope');
    expect(response.body.tenant.brandingConfig.typography.base_size).toBe('18px');
    expect(response.body.tenant.brandingConfig.layout.navbar_style).toBe('solid');
    expect(response.body.tenant.brandingConfig.layout.border_radius).toBe('12px');
    expect(response.body.tenant.brandingConfig.assets.favicon_url).toBe(
      'https://example.com/favicon.ico',
    );
  });

  it('clears the logo with an empty string', async () => {
    const response = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ logoUrl: '' });

    expect(response.status).toBe(200);
    expect(response.body.tenant.logoUrl).toBeNull();
  });

  it('does not let tenant users change another tenant’s branding', async () => {
    const summitBefore = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.summit);

    await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ companyName: 'Alpha Only' });

    const summitAfter = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.summit);

    expect(summitAfter.body.tenant.companyName).toBe(summitBefore.body.tenant.companyName);
    expect(summitTenantId).not.toBe(alphaTenantId);
  });

  it('blocks client and field_staff roles', async () => {
    for (const token of [clientToken, fieldToken]) {
      const response = await request(ctx.app)
        .put('/api/v1/tenant/branding')
        .set('Host', HOSTS.alpha)
        .set(bearer(token))
        .send({ primaryColor: '#000000' });

      expect(response.status).toBe(403);
    }
  });

  it('requires authentication', async () => {
    const response = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .send({ primaryColor: '#000000' });

    expect(response.status).toBe(401);
  });

  it('rejects malformed colours, invalid URLs, unknown keys and empty bodies', async () => {
    const badColour = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ primaryColor: 'red' });

    const badUrl = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ brandingConfig: { assets: { favicon_url: 'not-a-url' } } });

    const unknownKey = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ evil: true });

    const emptyBody = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({});

    expect(badColour.status).toBe(400);
    expect(badColour.body.error).toContain('primaryColor');
    expect(badUrl.status).toBe(400);
    expect(unknownKey.status).toBe(400);
    expect(emptyBody.status).toBe(400);
    expect(emptyBody.body.error).toBe('Validation failed: value: At least one branding field must be provided.');
  });

  it('applies updates on the custom domain host as well', async () => {
    const updated = await request(ctx.app)
      .put('/api/v1/tenant/branding')
      .set('Host', 'alpha-builders.example.com')
      .set(bearer(adminToken))
      .send({ secondaryColor: '#ABCDEF' });

    expect(updated.status).toBe(200);

    const subdomainView = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);
    expect(subdomainView.body.tenant.secondaryColor).toBe('#ABCDEF');
  });
});
