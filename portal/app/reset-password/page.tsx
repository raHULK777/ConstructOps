import Link from 'next/link';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';
import { fetchBranding } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const branding = await fetchBranding();
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>
            {branding.companyName}
          </p>
        </div>

        <div className="rounded-brand border border-slate-200 bg-brandSurface p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Choose a new password
          </h1>

          {token ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Use at least 10 characters. Signing in again is required afterwards.
              </p>
              <div className="mt-5">
                <ResetPasswordForm token={token} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-rose-700">
              This reset link is missing its token. Request a new link from the sign-in page.
            </p>
          )}

          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-medium text-slate-500 hover:text-slate-800">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
