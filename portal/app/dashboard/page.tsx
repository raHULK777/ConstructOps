import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LinkButton } from '@/components/LinkButton';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { ProjectTable } from '@/components/ProjectTable';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const token = await requireSessionToken();
  const host = await resolveTenantHost();
  const claims = decodeSession(token);

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
  const pending = orders.filter((order) => order.status === 'pending');
  const pendingValue = pending.reduce((total, order) => total + order.costImpact, 0);
  const projectNames = new Map(projects.map((project) => [project.id, project.projectName]));
  const isClient = claims?.role === 'client';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isClient ? 'Your workspace' : 'Workspace'}
        title={isClient ? 'Your projects' : 'Overview'}
        description={
          isClient
            ? 'Follow progress, review change orders and sign off on scope changes.'
            : 'Portfolio health, pending decisions and the projects your crew is delivering.'
        }
        actions={
          claims?.role === 'admin' ? (
            <LinkButton href="/dashboard/projects/new">New project</LinkButton>
          ) : null
        }
      />

      {apiDown ? (
        <Notice tone="error">
          The operations API is unreachable. Check that the API service is running and retry.
        </Notice>
      ) : null}

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(activeCount)} />
        <StatCard label="Portfolio value" value={formatCurrency(portfolioValue)} />
        <StatCard
          label={isClient ? 'Awaiting your decision' : 'Pending change orders'}
          value={String(pending.length)}
        />
        <StatCard label="Value awaiting approval" value={formatCurrency(pendingValue)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="projects-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="projects-heading" className="text-lg font-semibold tracking-tight text-slate-900">
              Projects
            </h2>
            <Link href="/dashboard/projects" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              View all →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-brand border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-800">No projects yet</p>
              <p className="mt-1 text-sm text-slate-500">
                {claims?.role === 'admin'
                  ? 'Create your first project and onboard the customer in one step.'
                  : 'Your contractor will add projects here.'}
              </p>
            </div>
          ) : (
            <ProjectTable projects={projects.slice(0, 6)} />
          )}
        </section>

        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
            {isClient ? 'Decisions' : 'Pending approvals'}
          </h2>
          <div className="space-y-3 rounded-brand border border-slate-200 bg-brandSurface p-4 shadow-sm">
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Nothing waiting on a decision.</p>
            ) : (
              pending.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/change-orders/${order.id}`}
                  className="block rounded-brand border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{order.title}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {projectNames.get(order.projectId) ?? 'Project'} ·{' '}
                    {formatCurrency(order.costImpact)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
