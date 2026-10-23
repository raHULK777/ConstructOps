import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChangeOrderComposer } from '@/components/ChangeOrderComposer';
import { DataCard } from '@/components/DataCard';
import { LinkButton } from '@/components/LinkButton';
import { Notice } from '@/components/Notice';
import { ProgressBar } from '@/components/ProgressBar';
import { StageTimeline } from '@/components/StageTimeline';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, Project, ProjectStage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await requireSessionToken();
  const host = await resolveTenantHost();
  const claims = decodeSession(token);

  const [projectResult, stagesResult, ordersResult] = await Promise.all([
    safeApiRequest<{ success: true; project: Project }>(
      `/api/v1/projects/${encodeURIComponent(id)}`,
      { host, token },
    ),
    safeApiRequest<{ success: true; stages: ProjectStage[] }>(
      `/api/v1/projects/${encodeURIComponent(id)}/stages`,
      { host, token },
    ),
    safeApiRequest<{ success: true; changeOrders: ChangeOrder[] }>(
      `/api/v1/change-orders?projectId=${encodeURIComponent(id)}&limit=200`,
      { host, token },
    ),
  ]);

  if (projectResult.status === 401) redirect('/login?expired=1');
  if (projectResult.status === 404) notFound();

  const project = projectResult.data?.project ?? null;
  if (!project) {
    return <Notice tone="error">This project could not be loaded.</Notice>;
  }

  const stages = stagesResult.data?.stages ?? [];
  const orders = ordersResult.data?.changeOrders ?? [];
  const completedStages = stages.filter((stage) => stage.status === 'completed').length;

  const approvedValue = orders
    .filter((order) => order.status === 'approved')
    .reduce((total, order) => total + order.costImpact, 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const pendingValue = pendingOrders.reduce((total, order) => total + order.costImpact, 0);
  const projectedValue = project.estimatedCost + approvedValue;

  const role = claims?.role ?? 'client';
  const isAdmin = role === 'admin';
  const canRaiseChangeOrder = isAdmin || role === 'field_staff';

  return (
    <div className="space-y-7">
      <Link href="/dashboard/projects" className="text-sm font-medium text-slate-500 hover:text-slate-800">
        ← Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {project.projectName}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {project.currentPhase ?? 'No phase'} · updated {formatDate(project.updatedAt)}
          </p>
        </div>
        {isAdmin ? (
          <LinkButton href={`/dashboard/projects/${project.id}/edit`} variant="secondary">
            Edit project
          </LinkButton>
        ) : null}
      </div>

      <section aria-label="Project financials" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contract budget" value={formatCurrency(project.estimatedCost)} />
        <StatCard label="Approved changes" value={formatCurrency(approvedValue)} />
        <StatCard label="Projected total" value={formatCurrency(projectedValue)} />
        <StatCard
          label="Pending decisions"
          value={String(pendingOrders.length)}
          hint={pendingValue > 0 ? `${formatCurrency(pendingValue)} awaiting approval` : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataCard
            title="Delivery stages"
            action={
              <span className="text-xs font-medium text-slate-500">
                {completedStages} of {stages.length} complete
              </span>
            }
          >
            <div className="space-y-4">
              <ProgressBar percentage={project.progressPercentage} />
              <StageTimeline projectId={project.id} stages={stages} role={role} />
            </div>
          </DataCard>

          <DataCard
            title="Change orders"
            action={
              canRaiseChangeOrder ? (
                <ChangeOrderComposer projectId={project.id} />
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  {pendingOrders.length} pending
                </span>
              )
            }
          >
            {ordersResult.status === 403 ? (
              <Notice tone="info">Change orders are not enabled for this workspace.</Notice>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-500">
                No change orders yet.
                {canRaiseChangeOrder ? ' Raise one when the scope changes.' : ''}
              </p>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/dashboard/change-orders/${order.id}`}
                      className="block rounded-brand border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-slate-900">{order.title}</p>
                        <StatusBadge status={order.status} />
                      </div>
                      {order.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{order.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="text-sm font-semibold text-slate-800">
                          {formatCurrency(order.costImpact)}
                        </span>
                        <span>Raised {formatDate(order.createdAt)}</span>
                        {order.status === 'pending' && role === 'client' ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                            Decision required
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        </div>

        <div className="space-y-6">
          <DataCard title="Customer">
            {project.clientName ? (
              <div className="space-y-2">
                <p className="text-base font-semibold text-slate-900">{project.clientName}</p>
                {project.clientEmail ? (
                  <p>
                    <a href={`mailto:${project.clientEmail}`} className="text-slate-600 hover:underline">
                      {project.clientEmail}
                    </a>
                  </p>
                ) : null}
                {project.clientPhone ? <p className="text-slate-600">{project.clientPhone}</p> : null}
                <p className="text-xs text-slate-500">
                  Customer access is read-only: they follow progress and decide on change orders.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No customer assigned. Edit the project to link one.
              </p>
            )}
          </DataCard>

          <DataCard title="Progress">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-semibold tracking-tight text-slate-900">
                  {project.progressPercentage}%
                </span>
                <span className="text-xs text-slate-500">{project.currentPhase ?? '—'}</span>
              </div>
              <ProgressBar percentage={project.progressPercentage} />
              <p className="text-xs text-slate-500">
                Progress is derived from completed stages. {completedStages}/{stages.length} done.
              </p>
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
}
