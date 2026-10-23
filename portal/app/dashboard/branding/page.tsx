import { redirect } from 'next/navigation';
import { BrandingForm } from '@/components/BrandingForm';
import { fetchBranding } from '@/lib/branding-server';
import { decodeSession } from '@/lib/jwt';
import { requireSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const token = await requireSessionToken();
  const claims = decodeSession(token);

  // UI-level gate only: the API independently rejects non-admin writes.
  if (claims?.role !== 'admin') redirect('/dashboard');

  const branding = await fetchBranding();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Workspace branding</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          These tokens re-skin the portal for every user in your workspace — colours, typography and
          corner radius. Changes apply immediately and never require a deployment.
        </p>
      </div>

      <BrandingForm branding={branding} />
    </div>
  );
}
