import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import type { NavItem } from '@/components/NavLinks';
import { SessionKeeper } from '@/components/SessionKeeper';
import { fetchBranding } from '@/lib/branding-server';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = await requireSessionToken();
  const branding = await fetchBranding();
  const claims = decodeSession(token);

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: 'overview' },
    { href: '/dashboard/projects', label: 'Projects', icon: 'projects' },
    { href: '/dashboard/change-orders', label: 'Change orders', icon: 'orders' },
    ...(claims?.role === 'admin'
      ? [{ href: '/dashboard/branding', label: 'Branding', icon: 'branding' as const }]
      : []),
  ];

  return (
    <>
      <SessionKeeper />
      <AppShell branding={branding} claims={claims} items={items}>
        {children}
      </AppShell>
    </>
  );
}
