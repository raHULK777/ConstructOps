'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';

interface ProgressFormProps {
  projectId: string;
  currentPhase: string | null;
  progressPercentage: number;
}

export function ProgressForm({
  projectId,
  currentPhase,
  progressPercentage,
}: ProgressFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState(currentPhase ?? '');
  const [progress, setProgress] = useState(String(progressPercentage));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPhase: phase.trim(),
          progressPercentage: Number(progress),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Update failed. Please try again.');
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Notice>{error}</Notice> : null}
      {saved ? <Notice tone="success">Project progress saved.</Notice> : null}

      <div>
        <label htmlFor="phase" className="block text-sm font-medium text-slate-700">
          Current phase
        </label>
        <input
          id="phase"
          value={phase}
          onChange={(event) => setPhase(event.target.value)}
          maxLength={100}
          required
          className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
        />
      </div>

      <div>
        <label htmlFor="progress" className="block text-sm font-medium text-slate-700">
          Progress: {progress}%
        </label>
        <input
          id="progress"
          type="range"
          min={0}
          max={100}
          step={1}
          value={progress}
          onChange={(event) => setProgress(event.target.value)}
          className="mt-2 w-full accent-[var(--secondary-color)]"
        />
      </div>

      <BrandButton type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save progress'}
      </BrandButton>
    </form>
  );
}
