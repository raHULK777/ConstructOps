'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-brand border border-white/20 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? 'Signing out…' : label}
    </button>
  );
}
