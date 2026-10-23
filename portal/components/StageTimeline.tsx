'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import { formatDate } from '@/lib/format';
import type { ProjectStage, Role, StageStatus } from '@/lib/types';

const STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};

const STATUS_ICON: Record<StageStatus, string> = {
  pending: 'border-slate-300 bg-white',
  in_progress: 'border-amber-400 bg-amber-100',
  completed: 'border-emerald-500 bg-emerald-500',
};

export function StageTimeline({
  projectId,
  stages,
  role,
}: {
  projectId: string;
  stages: ProjectStage[];
  role: Role;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const canUpdate = role === 'admin' || role === 'field_staff';
  const canManage = role === 'admin';
  const base = `/api/projects/${projectId}/stages`;

  async function request(path: string, init: RequestInit): Promise<boolean> {
    setError(null);
    setBusy(path);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'That change could not be saved.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Unable to reach the server.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  function setStatus(stage: ProjectStage, status: StageStatus) {
    void request(`${base}/${stage.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  function rename(stage: ProjectStage) {
    const name = window.prompt('Stage name', stage.name)?.trim();
    if (!name || name === stage.name) return;
    void request(`${base}/${stage.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  function remove(stage: ProjectStage) {
    if (!window.confirm(`Remove the stage “${stage.name}”?`)) return;
    void request(`${base}/${stage.id}`, { method: 'DELETE' });
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const saved = await request(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (saved) setNewName('');
  }

  return (
    <div className="space-y-3">
      {error ? <Notice>{error}</Notice> : null}

      {stages.length === 0 ? (
        <p className="rounded-brand border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No stages yet. {canManage ? 'Add the first stage below to start tracking progress.' : ''}
        </p>
      ) : (
        <ol className="space-y-2">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex flex-wrap items-center gap-3 rounded-brand border border-slate-200 bg-white px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${STATUS_ICON[stage.status]}`}
              >
                {stage.status === 'completed' ? (
                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                {stage.status === 'in_progress' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                ) : null}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{stage.name}</p>
                <p className="text-xs text-slate-500">
                  {STATUS_LABEL[stage.status]}
                  {stage.completedAt ? ` · ${formatDate(stage.completedAt)}` : ''}
                </p>
              </div>

              {canUpdate ? (
                <div className="flex gap-1.5">
                  {stage.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(stage, 'completed')}
                      disabled={busy !== null}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Complete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatus(stage, 'pending')}
                      disabled={busy !== null}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  {stage.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(stage, 'in_progress')}
                      disabled={busy !== null}
                      className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      Start
                    </button>
                  ) : null}
                </div>
              ) : null}

              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Rename stage"
                    onClick={() => rename(stage)}
                    disabled={busy !== null}
                    className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Remove stage"
                    onClick={() => remove(stage)}
                    disabled={busy !== null}
                    className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {canManage ? (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Add a stage (e.g. Final inspection)"
            maxLength={120}
            className="min-w-0 flex-1 rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
          <BrandButton type="submit" variant="secondary" disabled={!newName.trim() || busy !== null}>
            Add stage
          </BrandButton>
        </form>
      ) : null}

      {!canUpdate ? (
        <p className="text-xs text-slate-500">
          Read-only view — your contractor updates the stages.
        </p>
      ) : null}
    </div>
  );
}
