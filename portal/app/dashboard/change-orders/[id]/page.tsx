import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CommentComposer } from '@/components/CommentComposer';
import { DataCard } from '@/components/DataCard';
import { DecisionButtons } from '@/components/DecisionButtons';
import { Notice } from '@/components/Notice';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { ChangeOrder, ChangeOrderComment, Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Contractor',
  field_staff: 'Field staff',
  client: 'Customer',
};

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await requireSessionToken();
  const host = await resolveTenantHost();
  const claims = decodeSession(token);

  const result = await safeApiRequest<{ success: true; changeOrder: ChangeOrder }>(
    `/api/v1/change-orders/${encodeURIComponent(id)}`,
    { host, token },
  );

  if (result.status === 401) redirect('/login?expired=1');
  if (result.status === 404) notFound();

  const order = result.data?.changeOrder ?? null;
  if (!order) {
    return <Notice tone="error">This change order could not be loaded.</Notice>;
  }

  const [projectResult, commentsResult] = await Promise.all([
    safeApiRequest<{ success: true; project: Project }>(
      `/api/v1/projects/${encodeURIComponent(order.projectId)}`,
      { host, token },
    ),
    safeApiRequest<{ success: true; comments: ChangeOrderComment[] }>(
      `/api/v1/change-orders/${encodeURIComponent(order.id)}/comments`,
      { host, token },
    ),
  ]);

  const project = projectResult.data?.project ?? null;
  const comments = commentsResult.data?.comments ?? [];
  const canDecide = claims?.role === 'client' && order.status === 'pending';

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/projects/${order.projectId}`}
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← {project?.projectName ?? 'Project'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{order.title}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatCurrency(order.costImpact)} · raised {formatDate(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataCard title="Scope">
            <p className="whitespace-pre-line text-sm text-slate-700">
              {order.description ?? 'No description was provided.'}
            </p>
          </DataCard>

          {canDecide ? (
            <DataCard title="Your decision">
              <DecisionButtons
                changeOrderId={order.id}
                title={order.title}
                costImpact={order.costImpact}
              />
            </DataCard>
          ) : null}

          <DataCard
            title="Discussion"
            action={<span className="text-xs text-slate-500">{comments.length} messages</span>}
          >
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet — start the conversation.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {initials(comment.authorName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-slate-900">{comment.authorName}</span>{' '}
                        <span className="text-xs text-slate-500">
                          {ROLE_LABELS[comment.authorRole] ?? comment.authorRole} ·{' '}
                          {formatDate(comment.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <CommentComposer changeOrderId={order.id} />
            </div>
          </DataCard>
        </div>

        <div className="space-y-6">
          <DataCard title="Decision trail">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Project</dt>
                <dd>
                  <Link href={`/dashboard/projects/${order.projectId}`} className="text-slate-700 hover:underline">
                    {project?.projectName ?? 'View project'}
                  </Link>
                </dd>
              </div>
              {order.status === 'approved' ? (
                <>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Signed by</dt>
                    <dd className="text-slate-700">{order.signedByName ?? 'Customer'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Signed at</dt>
                    <dd className="text-slate-700">{formatDate(order.signedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Client IP</dt>
                    <dd className="font-mono text-xs text-slate-600">{order.ipAddress ?? '—'}</dd>
                  </div>
                </>
              ) : null}
              {order.status === 'rejected' ? (
                <>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Rejected by</dt>
                    <dd className="text-slate-700">{order.rejectedByName ?? 'Staff'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Rejected at</dt>
                    <dd className="text-slate-700">{formatDate(order.rejectedAt)}</dd>
                  </div>
                </>
              ) : null}
              {order.status === 'pending' ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
                  <dd className="text-amber-800">
                    Awaiting {claims?.role === 'client' ? 'your' : 'customer'} decision
                  </dd>
                </div>
              ) : null}
            </dl>
          </DataCard>

          <DataCard title="Need a change?">
            <p className="text-sm text-slate-600">
              Scope changes should be raised from the project workspace so they carry the
              project context and a clean audit trail.
            </p>
          </DataCard>
        </div>
      </div>
    </div>
  );
}
