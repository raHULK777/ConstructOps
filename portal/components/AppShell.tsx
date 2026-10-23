import Link from 'next/link';
import type { ReactNode } from 'react';
import { initials } from '@/lib/format';
import type { PublicBranding } from '@/lib/types';
import type { SessionClaims } from '@/lib/jwt';
import { SignOutButton } from './SignOutButton';
import { NavLinks, type NavItem } from './NavLinks';

interface AppShellProps {
  branding: PublicBranding;
  claims: SessionClaims | null;
  items: NavItem[];
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  field_staff: 'Field staff',
  client: 'Customer',
};

export function AppShell({ branding, claims, items, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside
        className="hidden w-64 shrink-0 flex-col justify-between p-5 lg:flex"
        style={{ backgroundColor: branding.primaryColor }}
      >
        <div>
          <Link href="/dashboard" className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-8 w-auto max-w-[150px] object-contain"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">
                {initials(branding.companyName)}
              </span>
            )}
            <span className="truncate text-sm font-semibold text-white">
              {branding.companyName}
            </span>
          </Link>

          <NavLinks items={items} />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4">
          {claims ? (
            <div className="px-1">
              <p className="truncate text-xs font-medium text-white/90">{claims.email}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/50">
                {ROLE_LABELS[claims.role] ?? claims.role}
              </p>
            </div>
          ) : null}
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-4 px-4 py-3 lg:hidden"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">
              {initials(branding.companyName)}
            </span>
            <span className="text-sm font-semibold text-white">{branding.companyName}</span>
          </Link>
          <div className="ml-auto">
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
