import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Project } from '@/lib/types';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';

export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <div className="overflow-hidden rounded-brand border border-slate-200 bg-brandSurface shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50/80">
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 font-medium">Project</th>
              <th scope="col" className="px-4 py-3 font-medium">Customer</th>
              <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Progress</th>
              <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Budget</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr key={project.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {project.projectName}
                  </Link>
                  <p className="text-xs text-slate-500">{project.currentPhase ?? 'No phase'}</p>
                </td>
                <td className="px-4 py-3">
                  {project.clientName ? (
                    <>
                      <p className="text-slate-800">{project.clientName}</p>
                      <p className="text-xs text-slate-500">{project.clientEmail}</p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Not assigned</span>
                  )}
                </td>
                <td className="hidden w-40 px-4 py-3 md:table-cell">
                  <ProgressBar percentage={project.progressPercentage} />
                  <p className="mt-1 text-xs text-slate-500">{project.progressPercentage}%</p>
                </td>
                <td className="hidden px-4 py-3 font-medium text-slate-800 sm:table-cell">
                  {formatCurrency(project.estimatedCost)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={project.status} />
                </td>
                <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                  {formatDate(project.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
