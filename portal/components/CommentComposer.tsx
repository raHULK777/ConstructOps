'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';

export function CommentComposer({ changeOrderId }: { changeOrderId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/change-orders/${changeOrderId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'The comment could not be posted.');
        return;
      }

      setBody('');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? <Notice>{error}</Notice> : null}
      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Ask a question or add context…"
        className="w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
      />
      <BrandButton type="submit" variant="secondary" disabled={pending || !body.trim()}>
        {pending ? 'Posting…' : 'Post comment'}
      </BrandButton>
    </form>
  );
}
