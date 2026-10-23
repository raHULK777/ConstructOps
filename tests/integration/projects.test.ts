import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertProject, insertTenant, insertUser } from '../support/fixtures';

describe('projects module', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;
  let adminId: string;
  let fieldToken: string;
  let clientAToken: string;
  let adminToken: string;
  let clientBId: string;
  let projectA: string;
  let projectB: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit' });

    adminId = await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, alphaTenantId, 'field@alpha.test', 'field_staff');
    const clientAId = await insertUser(ctx.db, alphaTenantId, 'client-a@alpha.test', 'client');
    clientBId = await insertUser(ctx.db, alphaTenantId, 'client-b@alpha.test', 'client');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');
    await insertUser(ctx.db, summitTenantId, 'client@summit.test', 'client');

    projectA = await insertProject(ctx.db, alphaTenantId, {
      name: 'Downtown Retrofit',
      clientId: clientAId,
      status: 'active',
      progressPercentage: 45,
      estimatedCost: 750_000,
    });
    projectB = await insertProject(ctx.db, alphaTenantId, {
      name: 'Harborview Remodel',
      clientId: clientBId,
      status: 'planning',
      progressPercentage: 10,
      estimatedCost: 420_000,
    });
    await insertProject(ctx.db, summitTenantId, { name: 'Summit Kitchen' });

    adminToken = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    fieldToken = await login(ctx.app, HOSTS.alpha, 'field@alpha.test');
    clientAToken = await login(ctx.app, HOSTS.alpha, 'client-a@alpha.test');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('lists every tenant project for admins and field staff', async () => {
    for (const token of [adminToken, fieldToken]) {
      const response = await request(ctx.app)
        .get('/api/v1/projects')
        .set('Host', HOSTS.alpha)
        .set(bearer(token));

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.projects[0]).toHaveProperty('projectName');
    }
  });

  it('narrows the list to the client’s own projects only', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.projects).toHaveLength(1);
    expect(response.body.projects[0].id).toBe(projectA);
  });

  it('hides another client’s project behind an opaque 404', async () => {
    const response = await request(ctx.app)
      .get(`/api/v1/projects/${projectB}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Requested record resource not found.');
  });

  it('lets field staff update phase and progress', async () => {
    const response = await request(ctx.app)
      .put(`/api/v1/projects/${projectA}/progress`)
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({ currentPhase: 'Drywall & Inspection', progressPercentage: 60 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Project progress updated successfully.');
    expect(response.body.updatedProject).toMatchObject({
      id: projectA,
      currentPhase: 'Drywall & Inspection',
      progressPercentage: 60,
    });
  });

  it('blocks clients from writing progress', async () => {
    const response = await request(ctx.app)
      .put(`/api/v1/projects/${projectA}/progress`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken))
      .send({ currentPhase: 'Electrical', progressPercentage: 80 });

    expect(response.status).toBe(403);
  });

  it('validates the progress payload', async () => {
    const tooHigh = await request(ctx.app)
      .put(`/api/v1/projects/${projectA}/progress`)
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({ currentPhase: 'Electrical', progressPercentage: 101 });

    const fractional = await request(ctx.app)
      .put(`/api/v1/projects/${projectA}/progress`)
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({ currentPhase: 'Electrical', progressPercentage: 50.5 });

    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.code).toBe('VALIDATION_ERROR');
    expect(tooHigh.body.error).toContain('progressPercentage');
    expect(fractional.status).toBe(400);
  });

  it('blocks field staff from creating projects', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({ projectName: 'Field Project' });

    expect(response.status).toBe(403);
  });

  it('allows an admin to create a project for a client of the same tenant', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'New Warehouse Build',
        clientId: clientBId,
        status: 'planning',
        estimatedCost: 250_000.5,
      });

    expect(response.status).toBe(201);
    expect(response.body.project).toMatchObject({
      projectName: 'New Warehouse Build',
      clientId: clientBId,
      estimatedCost: 250_000.5,
    });
  });

  it('rejects a clientId from another tenant or a non-client user', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'client@summit.test'",
    );
    const foreignClientId = rows[0]?.id;

    const foreign = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectName: 'Leaky Project', clientId: foreignClientId });

    const nonClient = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectName: 'Wrong Role Project', clientId: adminId });

    expect(foreign.status).toBe(400);
    expect(nonClient.status).toBe(400);
  });

  it('does not resolve a project id from another tenant', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM projects WHERE project_name = 'Summit Kitchen'",
    );
    const summitProjectId = rows[0]?.id;

    const response = await request(ctx.app)
      .get(`/api/v1/projects/${summitProjectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(response.status).toBe(404);
  });

  it('filters the list by status and validates the query string', async () => {
    const filtered = await request(ctx.app)
      .get('/api/v1/projects?status=planning')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    const invalid = await request(ctx.app)
      .get('/api/v1/projects?status=lost&unknown=1')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(filtered.status).toBe(200);
    expect(filtered.body.projects).toHaveLength(1);
    expect(filtered.body.projects[0].id).toBe(projectB);
    expect(invalid.status).toBe(400);
  });

  it('rejects a malformed project id before it reaches SQL', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/projects/not-a-uuid')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('lets an admin delete a project and then reports it missing', async () => {
    const deleted = await request(ctx.app)
      .delete(`/api/v1/projects/${projectB}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    const fetchAfter = await request(ctx.app)
      .get(`/api/v1/projects/${projectB}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(deleted.status).toBe(200);
    expect(deleted.body.message).toBe('Project deleted successfully.');
    expect(fetchAfter.status).toBe(404);
  });

  it('returns 404 for an id that is valid but unknown', async () => {
    const response = await request(ctx.app)
      .get(`/api/v1/projects/${randomUUID()}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));

    expect(response.status).toBe(404);
  });
});
