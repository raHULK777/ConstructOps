import type { ChangeOrderStatus, ProjectStatus } from '@/lib/types';

const STYLES: Record<ProjectStatus | ChangeOrderStatus, string> = {
  planning: 'bg-slate-100 text-slate-700 ring-slate-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-slate-900 text-white ring-slate-900',
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function StatusBadge({ status }: { status: ProjectStatus | ChangeOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
