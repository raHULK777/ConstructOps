import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApproveButton } from '@/components/ApproveButton';
import { DataCard } from '@/components/DataCard';
import { Notice } from '@/components/Notice';
import { ProgressBar } from '@/components/ProgressBar';
import { ProgressForm } from '@/components/ProgressForm';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, Project } from '@/lib/types';

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

  const projectResult = await safeApiRequest<{ success: true; project: Project }>(
    `/api/v1/projects/${encodeURIComponent(id)}`,
    { host, token },
  );

  if (projectResult.status === 401) redirect('/login?expired=1');
  if (projectResult.status === 404) notFound();

  const project = projectResult.data?.project ?? null;
  if (!project) {
    return (
      <Notice tone="error">
        This project could not be loaded. The operations API may be unavailable.
      </Notice>
    );
  }

  const ordersResult = await safeApiRequest<{ success: true; changeOrders: ChangeOrder[] }>(
    `/api/v1/change-orders?projectId=${encodeURIComponent(id)}&limit=200`,
    { host, token },
  );

  const orders = ordersResult.data?.changeOrders ?? [];
  const canEditProgress = claims?.role === 'admin' || claims?.role === 'field_staff';
  const canApprove = claims?.role === 'client';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← All projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {project.projectName}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {formatCurrency(project.estimatedCost)} · updated {formatDate(project.updatedAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <DataCard title="Progress">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{project.currentPhase ?? 'Phase not set'}</span>
                <span className="font-semibold text-slate-900">{project.progressPercentage}%</span>
              </div>
              <ProgressBar percentage={project.progressPercentage} />
            </div>
          </DataCard>

          {canEditProgress ? (
            <DataCard title="Update progress">
              <ProgressForm
                projectId={project.id}
                currentPhase={project.currentPhase}
                progressPercentage={project.progressPercentage}
              />
            </DataCard>
          ) : null}
        </div>

        <DataCard title="Change orders">
          {ordersResult.status === 403 ? (
            <Notice tone="info">Change orders are not enabled for this workspace.</Notice>
          ) : ordersResult.status === 0 ? (
            <Notice tone="error">Change orders could not be loaded right now.</Notice>
          ) : orders.length === 0 ? (
            <p className="text-slate-500">No change orders yet.</p>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
                <li key={order.id} className="rounded-brand border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{order.title}</p>
                      {order.description ? (
                        <p className="mt-1 text-sm text-slate-600">{order.description}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="text-sm font-semibold text-slate-800">
                      {formatCurrency(order.costImpact)}
                    </span>
                    <span>Created {formatDate(order.createdAt)}</span>
                    {order.status === 'approved' && order.signedAt ? (
                      <span>
                        Signed {formatDate(order.signedAt)} · IP {order.ipAddress ?? 'unknown'}
                      </span>
                    ) : null}
                  </div>

                  {canApprove && order.status === 'pending' ? (
                    <div className="mt-4">
                      <ApproveButton
                        changeOrderId={order.id}
                        title={order.title}
                        costImpact={order.costImpact}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </div>
    </div>
  );
}
