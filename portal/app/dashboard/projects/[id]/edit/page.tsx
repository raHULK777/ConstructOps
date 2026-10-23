import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DeleteProjectButton, EditProjectForm } from '@/components/ProjectForms';
import { Notice } from '@/components/Notice';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await requireSessionToken();
  const claims = decodeSession(token);
  if (claims?.role !== 'admin') redirect('/dashboard');

  const host = await resolveTenantHost();
  const result = await safeApiRequest<{ success: true; project: Project }>(
    `/api/v1/projects/${encodeURIComponent(id)}`,
    { host, token },
  );

  if (result.status === 401) redirect('/login?expired=1');
  if (result.status === 404) notFound();
  if (!result.data?.project) {
    return <Notice tone="error">This project could not be loaded.</Notice>;
  }

  const project = result.data.project;

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← {project.projectName}
      </Link>
      <PageHeader
        eyebrow="Operations"
        title="Edit project"
        description="Update the contract budget, status or project name."
      />
      <EditProjectForm project={project} />

      <section className="max-w-xl rounded-brand border border-rose-200 bg-rose-50/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-700">Danger zone</h2>
        <p className="mt-1 text-sm text-rose-700/80">
          Deleting a project permanently removes its stages, change orders and discussion threads.
        </p>
        <div className="mt-4">
          <DeleteProjectButton projectId={project.id} />
        </div>
      </section>
    </div>
  );
}
