'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-brand border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          The workspace hit an unexpected error. You can retry, or sign out and back in.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-brand bg-brandSecondary px-5 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
