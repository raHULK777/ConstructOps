'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import { formatCurrency } from '@/lib/format';

interface ApproveButtonProps {
  changeOrderId: string;
  title: string;
  costImpact: number;
}

export function ApproveButton({ changeOrderId, title, costImpact }: ApproveButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function approve() {
    const confirmed = window.confirm(
      `Approve "${title}" for ${formatCurrency(costImpact)}?\n\nThis records your signature, the timestamp and your IP address.`,
    );
    if (!confirmed) return;

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/change-orders/${changeOrderId}/approve`, {
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Approval failed. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <Notice>{error}</Notice> : null}
      <BrandButton onClick={approve} disabled={pending}>
        {pending ? 'Recording signature…' : 'Review & approve'}
      </BrandButton>
    </div>
  );
}
