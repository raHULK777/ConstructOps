import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataCard } from '@/components/DataCard';
import { Notice } from '@/components/Notice';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const token = await requireSessionToken();
  const host = await resolveTenantHost();

  const [projectsResult, ordersResult] = await Promise.all([
    safeApiRequest<{ success: true; projects: Project[] }>('/api/v1/projects?limit=200', {
      host,
      token,
    }),
    safeApiRequest<{ success: true; changeOrders: ChangeOrder[] }>(
      '/api/v1/change-orders?limit=200',
      { host, token },
    ),
  ]);

  if (projectsResult.status === 401 || ordersResult.status === 401) {
    redirect('/login?expired=1');
  }

  const projects = projectsResult.data?.projects ?? [];
  const orders = ordersResult.data?.changeOrders ?? [];
  const apiDown = projectsResult.status === 0;

  const activeCount = projects.filter((project) => project.status === 'active').length;
  const portfolioValue = projects.reduce((total, project) => total + project.estimatedCost, 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const pendingValue = pendingOrders.reduce((total, order) => total + order.costImpact, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live status across your workspace, updated from the field.
        </p>
      </div>

      {apiDown ? (
        <Notice tone="error">
          The operations API is unreachable. Check that the API service is running and retry.
        </Notice>
      ) : null}

      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(activeCount)} />
        <StatCard label="Portfolio value" value={formatCurrency(portfolioValue)} />
        <StatCard label="Pending change orders" value={String(pendingOrders.length)} />
        <StatCard label="Value awaiting approval" value={formatCurrency(pendingValue)} />
      </section>

      {ordersResult.status === 403 ? (
        <Notice tone="info">
          Change orders are not enabled for this workspace, so approval totals are hidden.
        </Notice>
      ) : null}

      {projects.length === 0 ? (
        <DataCard title="No projects yet">
          <p>
            Projects created by an administrator will appear here. Field staff can update progress
            once work begins.
          </p>
        </DataCard>
      ) : (
        <section aria-label="Project list" className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="group rounded-brand border border-slate-200/80 bg-brandSurface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 group-hover:underline">
                    {project.projectName}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.currentPhase ?? 'Phase not set'} · updated {formatDate(project.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={project.status} />
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span className="font-medium text-slate-700">{project.progressPercentage}%</span>
                </div>
                <ProgressBar percentage={project.progressPercentage} />
              </div>

              <p className="mt-4 text-sm font-medium text-slate-700">
                {formatCurrency(project.estimatedCost)}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
