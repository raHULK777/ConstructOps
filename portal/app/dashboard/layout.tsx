import Link from 'next/link';
import type { ReactNode } from 'react';
import { SessionKeeper } from '@/components/SessionKeeper';
import { SignOutButton } from '@/components/SignOutButton';
import { readableTextColor } from '@/lib/branding';
import { fetchBranding } from '@/lib/branding-server';
import { initials } from '@/lib/format';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = await requireSessionToken();
  const branding = await fetchBranding();
  const claims = decodeSession(token);
  const onPrimary = readableTextColor(branding.primaryColor);

  const navigation = [
    { href: '/dashboard', label: 'Projects' },
    ...(claims?.role === 'admin'
      ? [{ href: '/dashboard/branding', label: 'Branding' }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <SessionKeeper />
      <header style={{ backgroundColor: branding.primaryColor, color: onPrimary }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-8 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-bold">
                {initials(branding.companyName)}
              </span>
            )}
            <span className="text-sm font-semibold tracking-tight">{branding.companyName}</span>
          </Link>

          <nav aria-label="Workspace" className="flex items-center gap-1 text-sm">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-brand px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {claims ? (
              <span className="hidden text-xs text-white/70 sm:inline">{claims.email}</span>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
