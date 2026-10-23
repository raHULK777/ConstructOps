import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/Notice';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ChangeOrdersPage() {
  const token = await requireSessionToken();
  const host = await resolveTenantHost();

  const [ordersResult, projectsResult] = await Promise.all([
    safeApiRequest<{ success: true; changeOrders: ChangeOrder[] }>(
      '/api/v1/change-orders?limit=200',
      { host, token },
    ),
    safeApiRequest<{ success: true; projects: Project[] }>('/api/v1/projects?limit=200', {
      host,
      token,
    }),
  ]);

  if (ordersResult.status === 401) redirect('/login?expired=1');

  const orders = ordersResult.data?.changeOrders ?? [];
  const projectNames = new Map(
    (projectsResult.data?.projects ?? []).map((project) => [project.id, project.projectName]),
  );
  const pending = orders.filter((order) => order.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Change orders"
        description="Scope and cost changes raised against your projects, with the decision trail."
      />

      {ordersResult.status === 403 ? (
        <Notice tone="info">Change orders are not enabled for this workspace.</Notice>
      ) : ordersResult.status === 0 ? (
        <Notice tone="error">The operations API is unreachable.</Notice>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No change orders"
          description="Change orders raised from a project will appear here with their approval status."
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {orders.length} total · {pending} awaiting a decision
          </p>
          <div className="overflow-hidden rounded-brand border border-slate-200 bg-brandSurface shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-medium">Change order</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Project</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cost</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/change-orders/${order.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {order.title}
                        </Link>
                        <p className="text-xs text-slate-500 md:hidden">
                          {projectNames.get(order.projectId) ?? 'Project'}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Link
                          href={`/dashboard/projects/${order.projectId}`}
                          className="text-slate-600 hover:underline"
                        >
                          {projectNames.get(order.projectId) ?? 'Project'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {formatCurrency(order.costImpact)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
