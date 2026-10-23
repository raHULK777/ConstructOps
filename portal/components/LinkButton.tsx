import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brandSecondary text-slate-950 hover:opacity-90 shadow-sm border border-transparent',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
};

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-brand px-5 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brandPrimary focus:ring-offset-2 active:scale-[0.98] ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}
