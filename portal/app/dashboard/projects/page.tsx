import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { LinkButton } from '@/components/LinkButton';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { ProjectTable } from '@/components/ProjectTable';
import { safeApiRequest } from '@/lib/http';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';
import { resolveTenantHost } from '@/lib/tenant';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const token = await requireSessionToken();
  const host = await resolveTenantHost();
  const claims = decodeSession(token);

  const result = await safeApiRequest<{ success: true; projects: Project[] }>(
    '/api/v1/projects?limit=200',
    { host, token },
  );

  if (result.status === 401) redirect('/login?expired=1');

  const projects = result.data?.projects ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Projects"
        description="Every project in this workspace, with its customer, budget and live progress."
        actions={
          claims?.role === 'admin' ? (
            <LinkButton href="/dashboard/projects/new">New project</LinkButton>
          ) : null
        }
      />

      {result.status === 0 ? (
        <Notice tone="error">The operations API is unreachable.</Notice>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description={
            claims?.role === 'admin'
              ? 'Create a project, onboard the customer and define the delivery stages in a single step.'
              : 'Your contractor will add projects here.'
          }
          action={
            claims?.role === 'admin' ? (
              <LinkButton href="/dashboard/projects/new">Create the first project</LinkButton>
            ) : null
          }
        />
      ) : (
        <ProjectTable projects={projects} />
      )}
    </div>
  );
}
