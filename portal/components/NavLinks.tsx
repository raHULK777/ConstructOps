'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavIcon = 'overview' | 'projects' | 'orders' | 'branding';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

const ICONS: Record<NavIcon, string> = {
  overview: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  projects: 'M3 7h18M5 7l1.5 13h11L19 7M9 7V4h6v3',
  orders: 'M7 3h7l4 4v14H7zM14 3v4h4M9 12h6M9 16h6',
  branding: 'M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z',
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="mt-6 space-y-1">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-brand px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <path d={ICONS[item.icon]} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
