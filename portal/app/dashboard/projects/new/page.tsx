import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateProjectForm } from '@/components/CreateProjectForm';
import { PageHeader } from '@/components/PageHeader';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const token = await requireSessionToken();
  const claims = decodeSession(token);
  if (claims?.role !== 'admin') redirect('/dashboard');

  return (
    <div className="space-y-6">
      <Link href="/dashboard/projects" className="text-sm font-medium text-slate-500 hover:text-slate-800">
        ← Projects
      </Link>
      <PageHeader
        eyebrow="Operations"
        title="New project"
        description="Set the contract budget, define the delivery stages and onboard the customer — all in one step."
      />
      <CreateProjectForm />
    </div>
  );
}
