'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';

export function ChangeOrderComposer({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costImpact, setCostImpact] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch('/api/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          costImpact: Number(costImpact) || 0,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'Could not create the change order.');
        return;
      }

      setTitle('');
      setDescription('');
      setCostImpact('0');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <BrandButton onClick={() => setOpen(true)}>Raise change order</BrandButton>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-brand border border-slate-200 bg-slate-50/60 p-4"
    >
      {error ? <Notice>{error}</Notice> : null}

      <div>
        <label htmlFor="co-title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="co-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={255}
          placeholder="Added rooftop HVAC screening"
          className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
        />
      </div>

      <div>
        <label htmlFor="co-description" className="block text-sm font-medium text-slate-700">
          Scope description
        </label>
        <textarea
          id="co-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={5000}
          className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
        />
      </div>

      <div>
        <label htmlFor="co-cost" className="block text-sm font-medium text-slate-700">
          Cost impact (USD)
        </label>
        <input
          id="co-cost"
          type="number"
          min={0}
          step="0.01"
          value={costImpact}
          onChange={(event) => setCostImpact(event.target.value)}
          className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
        />
      </div>

      <div className="flex gap-2">
        <BrandButton type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send for approval'}
        </BrandButton>
        <BrandButton type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </BrandButton>
      </div>
    </form>
  );
}
