import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-brand border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Record not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This record does not exist in your workspace, or you do not have access to it.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-brand bg-brandSecondary px-5 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90"
        >
          Back to projects
        </Link>
      </div>
    </div>
  );
}
