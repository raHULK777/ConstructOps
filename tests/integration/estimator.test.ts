import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, createTestContext, type TestContext } from '../support/testApp';
import { insertTenant } from '../support/fixtures';

const ALPHA_MATRIX = {
  base_rates: { default: 150, residential_remodel: 145, commercial_retrofit: 215, new_build: 190 },
  material_multipliers: { standard: 1, premium: 1.22, luxury: 1.55 },
  contingency_percent: 10,
};

const SUMMIT_MATRIX = {
  base_rates: { default: 200, residential_remodel: 135 },
  material_multipliers: { standard: 1, premium: 1.2 },
  contingency_percent: 12,
};

describe('estimator module', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await insertTenant(ctx.db, { subdomain: 'alpha', pricingMatrix: ALPHA_MATRIX });
    await insertTenant(ctx.db, { subdomain: 'summit', pricingMatrix: SUMMIT_MATRIX });
    await insertTenant(ctx.db, { subdomain: 'gamma', enableEstimator: false });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('quotes from the tenant pricing matrix', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: 2450, materialTier: 'premium', projectType: 'residential_remodel' });

    // 2450 * 145 * 1.22 = 433405.00 ; +10% contingency = 476745.50
    expect(response.status).toBe(200);
    expect(response.body.calculation).toEqual({
      baseRatePerSqFt: 145,
      materialMultiplier: 1.22,
      estimatedCostLow: 433_405,
      estimatedCostHigh: 476_745.5,
      currency: 'USD',
    });
  });

  it('produces different quotes for the same input on different tenants', async () => {
    const body = { squareFootage: 2450, materialTier: 'standard', projectType: 'residential_remodel' };

    const alpha = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send(body);
    const summit = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.summit)
      .send(body);

    expect(alpha.body.calculation.estimatedCostLow).toBe(355_250);
    // 2450 * 135 * 1 = 330750 ; +12% = 370440
    expect(summit.body.calculation.estimatedCostLow).toBe(330_750);
    expect(summit.body.calculation.estimatedCostHigh).toBe(370_440);
  });

  it('rejects unknown project types and material tiers with guidance', async () => {
    const unknownType = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: 1000, materialTier: 'premium', projectType: 'spaceship' });

    const unknownTier = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: 1000, materialTier: 'unobtainium', projectType: 'new_build' });

    expect(unknownType.status).toBe(400);
    expect(unknownType.body.error).toContain('Supported project types');
    expect(unknownTier.status).toBe(400);
    expect(unknownTier.body.error).toContain('Supported tiers');
  });

  it('validates the numeric payload strictly', async () => {
    const negative = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: -5, materialTier: 'premium', projectType: 'new_build' });

    const asString = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: '2450', materialTier: 'premium', projectType: 'new_build' });

    const fractional = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', HOSTS.alpha)
      .send({ squareFootage: 12.5, materialTier: 'premium', projectType: 'new_build' });

    expect(negative.status).toBe(400);
    expect(negative.body.error).toContain('squareFootage');
    expect(asString.status).toBe(400);
    expect(fractional.status).toBe(400);
  });

  it('honours the premium feature gate', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', 'gamma.constructops.test')
      .send({ squareFootage: 1000, materialTier: 'standard', projectType: 'default' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FEATURE_DISABLED');
    expect(response.body.error).toBe(
      "The premium module 'enable_estimator' is disabled for this tenant.",
    );
  });

  it('falls back to platform defaults when a tenant matrix is malformed', async () => {
    await insertTenant(ctx.db, {
      subdomain: 'delta',
      pricingMatrix: { base_rates: 'not-an-object', material_multipliers: [] },
    });

    const response = await request(ctx.app)
      .post('/api/v1/tools/estimate')
      .set('Host', 'delta.constructops.test')
      .send({ squareFootage: 1000, materialTier: 'standard', projectType: 'default' });

    expect(response.status).toBe(200);
    expect(response.body.calculation.baseRatePerSqFt).toBe(150);
    expect(response.body.calculation.materialMultiplier).toBe(1);
  });
});
