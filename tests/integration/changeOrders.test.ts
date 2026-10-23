import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertChangeOrder, insertProject, insertTenant, insertUser } from '../support/fixtures';

describe('change orders module', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;
  let clientAId: string;
  let projectA: string;
  let projectB: string;
  let adminToken: string;
  let fieldToken: string;
  let clientAToken: string;
  let clientBToken: string;
  let summitAdminToken: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, {
      subdomain: 'alpha',
      enableChangeOrders: true,
    });
    summitTenantId = await insertTenant(ctx.db, {
      subdomain: 'summit',
      enableChangeOrders: false,
    });

    await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, alphaTenantId, 'field@alpha.test', 'field_staff');
    clientAId = await insertUser(ctx.db, alphaTenantId, 'client-a@alpha.test', 'client');
    const clientBId = await insertUser(ctx.db, alphaTenantId, 'client-b@alpha.test', 'client');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');

    projectA = await insertProject(ctx.db, alphaTenantId, { name: 'Downtown', clientId: clientAId });
    projectB = await insertProject(ctx.db, alphaTenantId, { name: 'Harborview', clientId: clientBId });
    await insertProject(ctx.db, summitTenantId, { name: 'Summit Kitchen' });

    adminToken = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    fieldToken = await login(ctx.app, HOSTS.alpha, 'field@alpha.test');
    clientAToken = await login(ctx.app, HOSTS.alpha, 'client-a@alpha.test');
    clientBToken = await login(ctx.app, HOSTS.alpha, 'client-b@alpha.test');
    summitAdminToken = await login(ctx.app, HOSTS.summit, 'admin@summit.test');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('lets field staff create a pending change order', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/change-orders')
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({
        projectId: projectA,
        title: 'Added rooftop HVAC screening',
        description: 'Required by the revised facade permit.',
        costImpact: 24_500,
      });

    expect(response.status).toBe(201);
    expect(response.body.changeOrder).toMatchObject({
      projectId: projectA,
      title: 'Added rooftop HVAC screening',
      status: 'pending',
      costImpact: 24_500,
      signedBy: null,
    });
  });

  it('blocks clients from creating change orders', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/change-orders')
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken))
      .send({ projectId: projectA, title: 'Client made order', costImpact: 100 });

    expect(response.status).toBe(403);
  });

  it('rejects a project from another tenant', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM projects WHERE project_name = 'Summit Kitchen'",
    );
    const summitProjectId = rows[0]?.id;

    const response = await request(ctx.app)
      .post('/api/v1/change-orders')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectId: summitProjectId, title: 'Cross tenant order', costImpact: 100 });

    expect(response.status).toBe(400);
  });

  it('shows a client only orders on their own projects', async () => {
    await insertChangeOrder(ctx.db, alphaTenantId, projectA, { title: 'Visible to A' });
    await insertChangeOrder(ctx.db, alphaTenantId, projectB, { title: 'Visible to B' });

    const response = await request(ctx.app)
      .get('/api/v1/change-orders')
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.changeOrders).toHaveLength(1);
    expect(response.body.changeOrders[0].title).toBe('Visible to A');
  });

  it('does not expose another client’s order by direct id', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectB, {
      title: 'Not yours',
    });

    const response = await request(ctx.app)
      .get(`/api/v1/change-orders/${orderId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(404);
  });

  it('records the legal signature with user, timestamp and IP', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Upgrade to quartz',
      costImpact: 8_200,
    });

    const response = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/approve`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Change order execution loop closed successfully.');
    expect(response.body.auditTrail).toMatchObject({
      changeOrderId: orderId,
      status: 'approved',
      signedBy: clientAId,
      ipAddress: '127.0.0.1',
    });
    expect(response.body.auditTrail.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const { rows } = await ctx.db.query<{
      status: string;
      signed_by: string;
      signed_at: string | null;
      ip_address: string | null;
    }>('SELECT status, signed_by, signed_at, ip_address FROM change_orders WHERE id = $1', [
      orderId,
    ]);

    expect(rows[0]).toMatchObject({
      status: 'approved',
      signed_by: clientAId,
      ip_address: '127.0.0.1',
    });
    expect(rows[0]?.signed_at).not.toBeNull();
  });

  it('refuses approval by a client who does not own the project', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Owned by A',
    });

    const response = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/approve`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientBToken));

    expect(response.status).toBe(404);
  });

  it('rejects a second signature on an already approved order', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Sign once',
    });

    await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/approve`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    const second = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/approve`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('Change order is already approved.');
  });

  it('refuses approval by administrators and field staff', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Staff cannot sign',
    });

    for (const token of [adminToken, fieldToken]) {
      const response = await request(ctx.app)
        .put(`/api/v1/change-orders/${orderId}/approve`)
        .set('Host', HOSTS.alpha)
        .set(bearer(token));

      expect(response.status).toBe(403);
    }
  });

  it('lets an admin reject a pending order, once', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Reject me',
    });

    const rejected = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/reject`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    const again = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/reject`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(rejected.status).toBe(200);
    expect(rejected.body.changeOrder.status).toBe('rejected');
    expect(again.status).toBe(409);
  });

  it('blocks clients from rejecting orders', async () => {
    const orderId = await insertChangeOrder(ctx.db, alphaTenantId, projectA, {
      title: 'Client reject attempt',
    });

    const response = await request(ctx.app)
      .put(`/api/v1/change-orders/${orderId}/reject`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(403);
  });

  it('enforces the premium feature gate from the resolved tenant', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/change-orders')
      .set('Host', HOSTS.summit)
      .set(bearer(summitAdminToken));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FEATURE_DISABLED');
    expect(response.body.error).toBe(
      "The premium module 'enable_change_orders' is disabled for this tenant.",
    );
  });

  it('does not resolve a change order id from another tenant', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM projects WHERE project_name = 'Summit Kitchen'",
    );
    const summitProjectId = rows[0]?.id;
    if (!summitProjectId) throw new Error('summit project fixture missing');

    const foreignOrderId = await insertChangeOrder(ctx.db, summitTenantId, summitProjectId, {
      title: 'Summit order',
    });

    const response = await request(ctx.app)
      .get(`/api/v1/change-orders/${foreignOrderId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(response.status).toBe(404);
  });

  it('validates the create payload and project filter', async () => {
    const invalidBody = await request(ctx.app)
      .post('/api/v1/change-orders')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectId: projectA, title: 'x', costImpact: -1 });

    const invalidFilter = await request(ctx.app)
      .get('/api/v1/change-orders?projectId=abc')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(invalidBody.status).toBe(400);
    expect(invalidFilter.status).toBe(400);
  });

  it('filters a client list by project id without escaping their scope', async () => {
    await insertChangeOrder(ctx.db, alphaTenantId, projectA, { title: 'A order' });
    await insertChangeOrder(ctx.db, alphaTenantId, projectB, { title: 'B order' });

    const response = await request(ctx.app)
      .get(`/api/v1/change-orders?projectId=${projectB}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.changeOrders).toHaveLength(0);
  });
});
