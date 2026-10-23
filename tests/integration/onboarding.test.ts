import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support/testApp';
import { TEST_PASSWORD } from '../support/testEnv';
import { silentLogger } from '../../src/utils/logger';
import { isAppError } from '../../src/utils/errors';
import { onboardTenant } from '../../src/modules/tenant/tenant.service';

describe('tenant onboarding', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('provisions a tenant and an administrator that can immediately log in', async () => {
    const result = await onboardTenant(
      { env: ctx.env, db: ctx.db, redis: ctx.redis, mailer: ctx.mailer, logger: silentLogger() },
      {
        companyName: 'Ironclad Construction',
        subdomain: 'ironclad',
        customDomain: '',
        adminEmail: 'owner@ironclad.test',
        adminPassword: TEST_PASSWORD,
        enableChangeOrders: true,
      },
    );

    expect(result.subdomain).toBe('ironclad');
    expect(result.adminEmail).toBe('owner@ironclad.test');

    const login = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', 'ironclad.constructops.test')
      .send({ email: 'owner@ironclad.test', password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');

    const branding = await request(ctx.app)
      .get('/api/v1/tenant/branding')
      .set('Host', 'ironclad.constructops.test');
    expect(branding.body.tenant.companyName).toBe('Ironclad Construction');
    expect(branding.body.tenant.features.changeOrders).toBe(true);
  });

  it('refuses a duplicate subdomain and leaves the original tenant intact', async () => {
    const deps = { env: ctx.env, db: ctx.db, redis: ctx.redis, mailer: ctx.mailer, logger: silentLogger() };
    const input = {
      companyName: 'First Co',
      subdomain: 'duplicate',
      customDomain: '',
      adminEmail: 'first@duplicate.test',
      adminPassword: TEST_PASSWORD,
      enableChangeOrders: true,
    };

    await onboardTenant(deps, input);

    try {
      await onboardTenant(deps, { ...input, companyName: 'Second Co', adminEmail: 'second@duplicate.test' });
      expect.unreachable('duplicate subdomain should have been rejected');
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) {
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    }

    const tenants = await ctx.db.query<{ id: string }>('SELECT id FROM tenants');
    expect(tenants.rows).toHaveLength(1);
  });

  it('rejects an invalid subdomain and a weak password before touching the database', async () => {
    const deps = { env: ctx.env, db: ctx.db, redis: ctx.redis, mailer: ctx.mailer, logger: silentLogger() };

    await expect(
      onboardTenant(deps, {
        companyName: 'Bad Co',
        subdomain: 'Not_Valid!',
        customDomain: '',
        adminEmail: 'bad@bad.test',
        adminPassword: TEST_PASSWORD,
        enableChangeOrders: true,
      }),
    ).rejects.toThrow();

    await expect(
      onboardTenant(deps, {
        companyName: 'Weak Co',
        subdomain: 'weak-co',
        customDomain: '',
        adminEmail: 'weak@weak.test',
        adminPassword: 'short',
        enableChangeOrders: true,
      }) as Promise<unknown>,
    ).rejects.toThrow();
  });
});
