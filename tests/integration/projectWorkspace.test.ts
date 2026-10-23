import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertProject, insertTenant, insertUser } from '../support/fixtures';

describe('project workspace: customers, editing and custom stages', () => {
  let ctx: TestContext;
  let alphaTenantId: string;
  let summitTenantId: string;
  let clientAId: string;
  let adminToken: string;
  let fieldToken: string;
  let clientAToken: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    alphaTenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
    summitTenantId = await insertTenant(ctx.db, { subdomain: 'summit' });

    await insertUser(ctx.db, alphaTenantId, 'admin@alpha.test', 'admin');
    await insertUser(ctx.db, alphaTenantId, 'field@alpha.test', 'field_staff');
    clientAId = await insertUser(ctx.db, alphaTenantId, 'client-a@alpha.test', 'client');
    await insertUser(ctx.db, alphaTenantId, 'client-b@alpha.test', 'client');
    await insertUser(ctx.db, summitTenantId, 'admin@summit.test', 'admin');

    await insertProject(ctx.db, alphaTenantId, { name: 'Existing Site', clientId: clientAId });

    adminToken = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    fieldToken = await login(ctx.app, HOSTS.alpha, 'field@alpha.test');
    clientAToken = await login(ctx.app, HOSTS.alpha, 'client-a@alpha.test');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('onboards a new customer while creating the project, and that customer can sign in', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Lakeview Kitchen',
        estimatedCost: 185_000,
        status: 'planning',
        customer: {
          firstName: 'Nina',
          lastName: 'Patel',
          email: 'nina@example.com',
          phone: '+1 555 0100',
          password: 'CustomerPass123!',
        },
        stages: ['Permitting', 'Demolition', 'Rough-in', 'Finishes'],
      });

    expect(response.status).toBe(201);
    expect(response.body.project).toMatchObject({
      projectName: 'Lakeview Kitchen',
      clientName: 'Nina Patel',
      clientEmail: 'nina@example.com',
      clientPhone: '+1 555 0100',
      currentPhase: 'Permitting',
      estimatedCost: 185_000,
    });

    const projectId = response.body.project.id as string;

    const customerLogin = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Host', HOSTS.alpha)
      .send({ email: 'nina@example.com', password: 'CustomerPass123!' });

    expect(customerLogin.status).toBe(200);
    expect(customerLogin.body.user.role).toBe('client');

    const visible = await request(ctx.app)
      .get('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(customerLogin.body.token as string));

    expect(visible.body.projects).toHaveLength(1);
    expect(visible.body.projects[0].id).toBe(projectId);

    const stages = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.alpha)
      .set(bearer(customerLogin.body.token as string));

    expect(stages.status).toBe(200);
    expect(stages.body.stages).toHaveLength(4);
    expect(stages.body.stages[0]).toMatchObject({ name: 'Permitting', status: 'in_progress' });
    expect(stages.body.stages[1]).toMatchObject({ name: 'Demolition', status: 'pending' });
  });

  it('links an existing customer instead of creating a duplicate account', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Second Site',
        customer: {
          firstName: 'Client',
          lastName: 'A',
          email: 'client-a@alpha.test',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.project.clientId).toBe(clientAId);

    const { rows } = await ctx.db.query<{ id: string }>(
      "SELECT id FROM users WHERE tenant_id = $1 AND email = 'client-a@alpha.test'",
      [alphaTenantId],
    );
    expect(rows).toHaveLength(1);
  });

  it('rejects a staff email as a customer and requires a password for new customers', async () => {
    const staffEmail = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Bad Customer',
        customer: { firstName: 'A', lastName: 'B', email: 'admin@alpha.test' },
      });

    const noPassword = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'No Password',
        customer: { firstName: 'A', lastName: 'B', email: 'brand-new@example.com' },
      });

    const both = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Both',
        clientId: clientAId,
        customer: { firstName: 'A', lastName: 'B', email: 'x@example.com' },
      });

    expect(staffEmail.status).toBe(400);
    expect(noPassword.status).toBe(400);
    expect(both.status).toBe(400);
  });

  it('lets an admin edit name, status and budget; the customer sees the same budget read-only', async () => {
    const created = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectName: 'Budget Site', clientId: clientAId, estimatedCost: 100_000 });

    const projectId = created.body.project.id as string;

    const updated = await request(ctx.app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectName: 'Budget Site II', status: 'active', estimatedCost: 240_000 });

    expect(updated.status).toBe(200);
    expect(updated.body.project).toMatchObject({
      projectName: 'Budget Site II',
      status: 'active',
      estimatedCost: 240_000,
    });

    const customerView = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));

    expect(customerView.status).toBe(200);
    expect(customerView.body.project.estimatedCost).toBe(240_000);

    const forbidden = await request(ctx.app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken))
      .send({ estimatedCost: 1 });

    expect(forbidden.status).toBe(403);

    const badClient = await request(ctx.app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ clientId: '00000000-0000-4000-8000-000000000000' });

    expect(badClient.status).toBe(400);
  });

  it('drives project progress from custom stage completion', async () => {
    const created = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Staged Site',
        clientId: clientAId,
        stages: ['Permitting', 'Framing', 'Finishes'],
      });

    const projectId = created.body.project.id as string;

    const list = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    const stages = list.body.stages as Array<{ id: string; name: string }>;

    const complete = (stageId: string) =>
      request(ctx.app)
        .put(`/api/v1/projects/${projectId}/stages/${stageId}`)
        .set('Host', HOSTS.alpha)
        .set(bearer(fieldToken))
        .send({ status: 'completed' });

    expect((await complete(stages[0]!.id)).status).toBe(200);

    let project = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    expect(project.body.project.progressPercentage).toBe(33);
    expect(project.body.project.currentPhase).toBe('Framing');

    await complete(stages[1]!.id);
    await complete(stages[2]!.id);

    project = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    expect(project.body.project.progressPercentage).toBe(100);
    expect(project.body.project.currentPhase).toBe('Completed');

    // Field staff may move status but not rename.
    const rename = await request(ctx.app)
      .put(`/api/v1/projects/${projectId}/stages/${stages[0]!.id}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(fieldToken))
      .send({ name: 'Renamed' });
    expect(rename.status).toBe(403);

    // Customers read the workflow but cannot change it.
    const clientWrite = await request(ctx.app)
      .put(`/api/v1/projects/${projectId}/stages/${stages[0]!.id}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken))
      .send({ status: 'pending' });
    expect(clientWrite.status).toBe(403);

    const clientRead = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.alpha)
      .set(bearer(clientAToken));
    expect(clientRead.status).toBe(200);
    expect(clientRead.body.stages).toHaveLength(3);
  });

  it('adds and removes stages, recomputing progress each time', async () => {
    const created = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({
        projectName: 'Mutable Workflow',
        clientId: clientAId,
        stages: ['One', 'Two'],
      });
    const projectId = created.body.project.id as string;

    const added = await request(ctx.app)
      .post(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ name: 'Three' });
    expect(added.status).toBe(201);

    const afterAdd = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    expect(afterAdd.body.project.currentPhase).toBe('One');

    const removed = await request(ctx.app)
      .delete(`/api/v1/projects/${projectId}/stages/${added.body.stage.id as string}`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    expect(removed.status).toBe(200);

    const afterDelete = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken));
    expect(afterDelete.body.stages).toHaveLength(2);
  });

  it('does not expose another tenant’s stages', async () => {
    const created = await request(ctx.app)
      .post('/api/v1/projects')
      .set('Host', HOSTS.alpha)
      .set(bearer(adminToken))
      .send({ projectName: 'Private Workflow', stages: ['Only'] });
    const projectId = created.body.project.id as string;

    const summitToken = await login(ctx.app, HOSTS.summit, 'admin@summit.test');

    const response = await request(ctx.app)
      .get(`/api/v1/projects/${projectId}/stages`)
      .set('Host', HOSTS.summit)
      .set(bearer(summitToken));

    expect(response.status).toBe(404);
  });
});
