import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { fetchBranding } from '@/lib/branding-server';
import { getSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const token = await getSessionToken();
  if (token) redirect('/dashboard');

  const branding = await fetchBranding();

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
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the email associated with your workspace account. If it exists, we will send a
            reset link that expires in 60 minutes.
          </p>

          <div className="mt-5">
            <ForgotPasswordForm />
          </div>

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
