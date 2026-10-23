'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import { formatCurrency } from '@/lib/format';

interface DecisionButtonsProps {
  changeOrderId: string;
  title: string;
  costImpact: number;
}

export function DecisionButtons({ changeOrderId, title, costImpact }: DecisionButtonsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);

  async function decide(kind: 'approve' | 'reject', reason?: string) {
    setPending(kind);
    setError(null);
    try {
      const response = await fetch(
        `/api/change-orders/${changeOrderId}/${kind}`,
        kind === 'approve'
          ? { method: 'POST' }
          : {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reason ? { reason } : {}),
            },
      );
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'The decision could not be saved.');
        return;
      }

      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(null);
    }
  }

  function approve() {
    const confirmed = window.confirm(
      `Approve "${title}" for ${formatCurrency(costImpact)}?\n\nThis records your signature, the timestamp and your IP address.`,
    );
    if (confirmed) void decide('approve');
  }

  function reject() {
    const reason = window.prompt(
      'Reason for rejecting this change order (optional). It will be posted in the discussion.',
      '',
    );
    if (reason === null) return;
    void decide('reject', reason.trim() || undefined);
  }

  return (
    <div className="space-y-3">
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <BrandButton onClick={approve} disabled={pending !== null}>
          {pending === 'approve' ? 'Signing…' : 'Approve & sign'}
        </BrandButton>
        <BrandButton variant="danger" onClick={reject} disabled={pending !== null}>
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </BrandButton>
      </div>
      <p className="text-xs text-slate-500">
        Approving records a legal signature; rejecting posts your reason to the discussion.
      </p>
    </div>
  );
}
