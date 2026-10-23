export function Notice({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-slate-200 bg-slate-50 text-slate-600',
  } as const;

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-brand border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}
