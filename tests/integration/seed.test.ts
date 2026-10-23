import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, createTestContext, type TestContext } from '../support/testApp';
import { TEST_PASSWORD } from '../support/testEnv';
import { silentLogger } from '../../src/utils/logger';
import { DEMO_TENANTS, seedDemoTenants } from '../../src/demo/seed';

describe('demo seed', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('creates the full demo dataset exactly once', async () => {
    const deps = { db: ctx.db, bcryptRounds: ctx.env.bcryptRounds, logger: silentLogger() };

    const first = await seedDemoTenants(deps, TEST_PASSWORD);
    expect(first.created).toEqual({ tenants: 2, users: 5, projects: 3, changeOrders: 3 });
    expect(first.subdomains).toEqual(['alpha-builders', 'summit-renovations']);

    const second = await seedDemoTenants(deps, TEST_PASSWORD);
    expect(second.created).toEqual({ tenants: 0, users: 0, projects: 0, changeOrders: 0 });

    const counts = await Promise.all([
      ctx.db.query('SELECT id FROM tenants'),
      ctx.db.query('SELECT id FROM users'),
      ctx.db.query('SELECT id FROM projects'),
      ctx.db.query('SELECT id FROM change_orders'),
    ]);

    expect(counts.map((result) => result.rows.length)).toEqual([2, 5, 3, 3]);
  });

  it('produces a workspace a seeded administrator can log into', async () => {
    await seedDemoTenants(
      { db: ctx.db, bcryptRounds: ctx.env.bcryptRounds, logger: silentLogger() },
      TEST_PASSWORD,
    );

    const host = 'alpha-builders.constructops.test';
    const login = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', host)
      .send({ email: 'admin@alphabuilders.com', password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.tenantBranding.companyName).toBe(DEMO_TENANTS[0]?.companyName);

    const projects = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', host)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(projects.status).toBe(200);
    expect(projects.body.projects).toHaveLength(2);
  });

  it('keeps the change-order module disabled for the Summit demo tenant', async () => {
    await seedDemoTenants(
      { db: ctx.db, bcryptRounds: ctx.env.bcryptRounds, logger: silentLogger() },
      TEST_PASSWORD,
    );

    const host = 'summit-renovations.constructops.test';
    const login = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', host)
      .send({ email: 'admin@summitrenovations.com', password: TEST_PASSWORD });

    const response = await request(ctx.app)
      .get('/api/v1/change-orders')
      .set('Host', host)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FEATURE_DISABLED');
  });

  it('refuses a weak seed password', async () => {
    await expect(
      seedDemoTenants(
        { db: ctx.db, bcryptRounds: ctx.env.bcryptRounds, logger: silentLogger() },
        'short',
      ),
    ).rejects.toThrow(/at least 8 characters/);
  });

  it('does not collide with the test fixture hostnames', async () => {
    await seedDemoTenants(
      { db: ctx.db, bcryptRounds: ctx.env.bcryptRounds, logger: silentLogger() },
      TEST_PASSWORD,
    );

    const unknown = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', HOSTS.alpha);
    expect(unknown.status).toBe(404);
  });
});
