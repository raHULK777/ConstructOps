import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brandSecondary text-slate-950 hover:opacity-90 shadow-sm border border-transparent',
  secondary:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-transparent shadow-sm',
};

interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function BrandButton({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: BrandButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-brand px-5 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brandPrimary focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
