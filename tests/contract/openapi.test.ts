import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { parse } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOSTS, bearer, createTestContext, login, type TestContext } from '../support/testApp';
import { insertTenant, insertUser } from '../support/fixtures';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

interface Operation {
  path: string;
  method: HttpMethod;
  operationId: string;
  spec: Record<string, unknown>;
}

interface OpenApiDocument {
  openapi: string;
  info: { description?: string };
  paths: Record<string, Record<string, unknown>>;
}

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'delete'];

const PUBLIC_OPERATIONS = new Set([
  'getLiveness',
  'getReadiness',
  'login',
  'refreshSession',
  'logoutSession',
  'forgotPassword',
  'resetPassword',
  'getTenantBranding',
  'estimateProject',
]);

function loadDocument(): OpenApiDocument {
  const raw = readFileSync(path.resolve(process.cwd(), 'docs', 'openapi.yaml'), 'utf8');
  return parse(raw) as OpenApiDocument;
}

function collectOperations(doc: OpenApiDocument): Operation[] {
  const operations: Operation[] = [];

  for (const [routePath, item] of Object.entries(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const spec = item[method];
      if (!spec || typeof spec !== 'object') continue;
      const operation = spec as Record<string, unknown>;
      operations.push({
        path: routePath,
        method,
        operationId: String(operation.operationId ?? ''),
        spec: operation,
      });
    }
  }

  return operations;
}

function invoke(app: Express, method: HttpMethod, routePath: string) {
  switch (method) {
    case 'get':
      return request(app).get(routePath);
    case 'post':
      return request(app).post(routePath);
    case 'put':
      return request(app).put(routePath);
    case 'delete':
      return request(app).delete(routePath);
  }
}

describe('OpenAPI contract', () => {
  const document = loadDocument();
  const operations = collectOperations(document);

  it('is an OpenAPI 3.1 document', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.description).toContain('Host header');
  });

  it('documents the full implemented surface', () => {
    expect(operations).toHaveLength(27);
    expect(new Set(operations.map((operation) => operation.operationId)).size).toBe(27);
  });

  it('gives every operation an id, summary, tag and success response', () => {
    for (const { operationId, spec, path: routePath, method } of operations) {
      expect(operationId, `${method.toUpperCase()} ${routePath}`).toMatch(/^[a-zA-Z][a-zA-Z0-9]+$/);
      expect(typeof spec.summary, `${operationId} summary`).toBe('string');
      expect(Array.isArray(spec.tags) && (spec.tags as unknown[]).length > 0, `${operationId} tags`).toBe(true);

      const responses = spec.responses as Record<string, unknown> | undefined;
      expect(responses, `${operationId} responses`).toBeTruthy();
      const successCodes = Object.keys(responses ?? {}).filter((code) => /^2\d\d$/.test(code));
      expect(successCodes.length, `${operationId} success response`).toBeGreaterThan(0);
    }
  });

  it('declares bearer security on protected operations and none on public ones', () => {
    for (const { operationId, spec } of operations) {
      if (PUBLIC_OPERATIONS.has(operationId)) {
        expect(spec.security, `${operationId} should be public`).toEqual([]);
      } else {
        expect(spec.security, `${operationId} should require a bearer token`).toEqual([
          { bearerAuth: [] },
        ]);
      }
    }
  });

  it('uses UUIDv4 path parameters for every identifier route', () => {
    for (const [routePath, item] of Object.entries(document.paths)) {
      if (!routePath.includes('{id}')) continue;
      const params = (item.parameters ?? []) as Array<Record<string, unknown>>;
      const idParam = params.find((param) => param.$ref === '#/components/parameters/IdPath');
      expect(idParam, `${routePath} id parameter`).toBeTruthy();
    }
  });

  describe('route coverage', () => {
    let ctx: TestContext;
    let token: string;

    beforeEach(async () => {
      ctx = await createTestContext();
      const tenantId = await insertTenant(ctx.db, { subdomain: 'alpha' });
      await insertUser(ctx.db, tenantId, 'admin@alpha.test', 'admin');
      token = await login(ctx.app, HOSTS.alpha, 'admin@alpha.test');
    });

    afterEach(async () => {
      await ctx.close();
    });

    it('resolves every documented operation to a mounted route', async () => {
      for (const { path: routePath, method, operationId } of operations) {
        const concretePath = routePath.replace('{id}', randomUUID());
        let call = invoke(ctx.app, method, concretePath).set('Host', HOSTS.alpha);

        if (!PUBLIC_OPERATIONS.has(operationId)) {
          call = call.set(bearer(token));
        }
        if (method === 'post' || method === 'put') {
          call = call.send({});
        }

        const response = await call;
        // A documented route may legitimately 400/401/403/404 on this probe;
        // only the "route not found" envelope proves the contract has drifted.
        expect(response.body?.error, `${method.toUpperCase()} ${routePath}`).not.toBe(
          'Route not found.',
        );
      }
    });
  });
});
