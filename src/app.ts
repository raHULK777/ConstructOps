import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { AppDependencies } from './types/dependencies';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimit';
import { requireJsonBody } from './middleware/requireJson';
import { requestContext } from './middleware/requestContext';
import { tenantResolver } from './middleware/tenantResolver';
import { asyncHandler } from './utils/asyncHandler';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { createChangeOrderRoutes } from './modules/changeOrder/changeOrder.routes';
import { createEstimatorRoutes } from './modules/estimator/estimator.routes';
import { createProjectRoutes } from './modules/project/project.routes';
import { createTenantRoutes } from './modules/tenant/tenant.routes';

/**
 * Composition root. Every dependency is injected, so the same pipeline can run
 * against PostgreSQL/Redis in production and against in-memory doubles in tests.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', deps.env.trustProxy);

  app.use(requestContext(deps.logger));
  app.use(helmet());
  app.use(corsMiddleware(deps.env.corsOrigins));
  app.use(express.json({ limit: '256kb' }));
  app.use(requireJsonBody());

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ success: true, status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  app.get(
    '/readyz',
    asyncHandler(async (_req, res) => {
      const results = await Promise.allSettled([deps.db.query('SELECT 1'), deps.redis.ping()]);
      const database = results[0]?.status === 'fulfilled' ? 'ok' : 'down';
      const redis = results[1]?.status === 'fulfilled' ? 'ok' : 'down';
      const ready = database === 'ok' && redis === 'ok';
      res.status(ready ? 200 : 503).json({
        success: ready,
        checks: { database, redis },
      });
    }),
  );

  app.use('/api/v1', createRateLimiter(deps.env, deps.env.rateLimitMax, 'api'));

  const api = Router();
  api.use(tenantResolver(deps));
  api.use('/auth', createAuthRoutes(deps));
  api.use('/tenant', createTenantRoutes(deps));
  api.use('/tools', createEstimatorRoutes(deps));
  api.use('/projects', createProjectRoutes(deps));
  api.use('/change-orders', createChangeOrderRoutes(deps));

  app.use('/api/v1', api);

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));

  return app;
}
