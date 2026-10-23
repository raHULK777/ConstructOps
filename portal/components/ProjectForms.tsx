'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import type { Project, ProjectStatus } from '@/lib/types';

export function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [projectName, setProjectName] = useState(project.projectName);
  const [estimatedCost, setEstimatedCost] = useState(String(project.estimatedCost));
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: projectName.trim(),
          estimatedCost: Number(estimatedCost) || 0,
          status,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'Could not update the project.');
        return;
      }

      router.push(`/dashboard/projects/${project.id}`);
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-5 rounded-brand border border-slate-200 bg-brandSurface p-6 shadow-sm"
    >
      {error ? <Notice>{error}</Notice> : null}

      <div>
        <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700">
          Project name
        </label>
        <input
          id="edit-name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          required
          minLength={2}
          maxLength={255}
          className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-cost" className="block text-sm font-medium text-slate-700">
            Contract budget (USD)
          </label>
          <input
            id="edit-cost"
            type="number"
            min={0}
            step="0.01"
            value={estimatedCost}
            onChange={(event) => setEstimatedCost(event.target.value)}
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
        </div>
        <div>
          <label htmlFor="edit-status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <BrandButton type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </BrandButton>
    </form>
  );
}

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const confirmed = window.confirm(
      'Delete this project? Its stages and change orders will be removed permanently.',
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not delete the project.');
        return;
      }
      router.push('/dashboard/projects');
      router.refresh();
    } catch {
      setError('Unable to reach the server.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <BrandButton variant="danger" onClick={remove} disabled={pending}>
        {pending ? 'Deleting…' : 'Delete project'}
      </BrandButton>
      {error ? (
        <div className="mt-2">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
