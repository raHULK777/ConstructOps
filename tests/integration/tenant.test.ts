import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, createTestContext, type TestContext } from '../support/testApp';
import { insertTenant } from '../support/fixtures';
import { tenantCacheKey } from '../../src/utils/host';

describe('tenant resolution', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('resolves a subdomain and exposes only public branding', async () => {
    await insertTenant(ctx.db, { subdomain: 'alpha', companyName: 'Alpha Builders Pro' });

    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tenant.companyName).toBe('Alpha Builders Pro');
    expect(response.body.tenant.features).toEqual({
      estimator: true,
      clientPortal: true,
      changeOrders: true,
    });

    const serialized = JSON.stringify(response.body);
    expect(response.body.tenant).not.toHaveProperty('id');
    expect(serialized).not.toContain('estimator_pricing_matrix');
    expect(serialized).not.toContain('base_rates');
    expect(serialized).not.toContain('password');
  });

  it('serves a cached tenant after the row disappears, then 404s once the cache is cleared', async () => {
    const tenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });

    const first = await request(ctx.app).get('/api/v1/tenant/branding').set('Host', HOSTS.alpha);
    expect(first.status).toBe(200);
    expect(ctx.redis.has(tenantCacheKey(HOSTS.alpha))).toBe(true);

    await ctx.db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);

    const cached = await request(ctx.app).get('/api/v1/tenant/branding').set('Host', HOSTS.alpha);
    expect(cached.status).toBe(200);

    ctx.redis.clear();

    const afterClear = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);
    expect(afterClear.status).toBe(404);
    expect(afterClear.body.error).toBe('Tenant domain context not found.');
  });

  it('returns the documented 404 envelope for an unknown host', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', 'nobody.constructops.test');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Tenant domain context not found.',
      code: 'NOT_FOUND',
    });
    expect(typeof response.body.requestId).toBe('string');
  });

  it('accepts a host with a port and a www prefix', async () => {
    await insertTenant(ctx.db, { subdomain: 'alpha' });

    const withPort = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', `${HOSTS.alpha}:8080`);
    expect(withPort.status).toBe(200);

    ctx.redis.clear();
    const withWww = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', `www.${HOSTS.alpha}`);
    expect(withWww.status).toBe(200);
  });

  it('prefers an exact custom-domain match over a colliding subdomain', async () => {
    await insertTenant(ctx.db, { subdomain: 'acme', companyName: 'Subdomain Acme' });
    await insertTenant(ctx.db, {
      subdomain: 'beta-custom',
      companyName: 'Custom Domain Co',
      customDomain: 'acme.example.com',
    });

    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', 'acme.example.com');

    expect(response.status).toBe(200);
    expect(response.body.tenant.companyName).toBe('Custom Domain Co');
  });

  it('degrades to PostgreSQL when Redis fails, both on read and on write', async () => {
    await insertTenant(ctx.db, { subdomain: 'alpha' });

    ctx.redis.failReads = true;
    ctx.redis.failWrites = true;

    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);

    expect(response.status).toBe(200);
    expect(response.body.tenant.subdomain).toBe('alpha');
  });

  it('stops calling Redis briefly after a cache failure (circuit breaker)', async () => {
    await insertTenant(ctx.db, { subdomain: 'alpha' });

    ctx.redis.failReads = true;
    const first = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);
    expect(first.status).toBe(200);

    const attemptsAfterFailure = ctx.redis.gets;
    const second = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);

    expect(second.status).toBe(200);
    // The breaker skips Redis for a short window instead of paying the failure
    // cost on every request.
    expect(ctx.redis.gets).toBe(attemptsAfterFailure);
  });

  it('discards a corrupt cache entry and re-resolves from the database', async () => {
    await insertTenant(ctx.db, { subdomain: 'alpha' });
    await ctx.redis.setex(tenantCacheKey(HOSTS.alpha), 60, '{"unexpected":true}');

    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);

    expect(response.status).toBe(200);
    expect(response.body.tenant.subdomain).toBe('alpha');
  });

  it('does not resolve the platform apex as a tenant', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', 'constructops.test');

    expect(response.status).toBe(404);
  });
});
