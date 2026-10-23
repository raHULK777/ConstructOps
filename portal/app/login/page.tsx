import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { Notice } from '@/components/Notice';
import { readableTextColor } from '@/lib/branding';
import { fetchBranding } from '@/lib/branding-server';
import { initials } from '@/lib/format';
import { getSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const HIGHLIGHTS = [
  'Live project phases and progress from the field',
  'Change orders signed and time-stamped in one place',
  'Every contractor sees only their own workspace',
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; reset?: string }>;
}) {
  const token = await getSessionToken();
  if (token) redirect('/dashboard');

  const branding = await fetchBranding();
  const { expired, reset } = await searchParams;
  const onPrimary = readableTextColor(branding.primaryColor);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section
        className="hidden flex-col justify-between p-10 lg:flex"
        style={{ backgroundColor: branding.primaryColor, color: onPrimary }}
      >
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-8 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-bold">
              {initials(branding.companyName)}
            </span>
          )}
          <span className="text-sm font-semibold tracking-tight">{branding.companyName}</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight">
            Your projects, without the paper trail.
          </h1>
          <ul className="mt-6 space-y-3 text-sm opacity-80">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs opacity-60">
          Powered by ConstructOps · workspace {branding.subdomain}
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>
              {branding.companyName}
            </p>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sign in to your workspace
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {branding.companyName} · secured by your workspace domain
          </p>

          <div className="mt-6 space-y-4">
            {expired ? (
              <Notice tone="info">Your session expired. Sign in again to continue.</Notice>
            ) : null}
            {reset ? (
              <Notice tone="success">
                Password updated. Sign in with your new password.
              </Notice>
            ) : null}
            <LoginForm />
            <p className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Forgot your password?
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
