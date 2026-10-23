import type { ReactNode } from 'react';

interface DataCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DataCard({ title, action, children, className = '' }: DataCardProps) {
  return (
    <section
      className={`rounded-brand border border-slate-200/80 bg-brandSurface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}
