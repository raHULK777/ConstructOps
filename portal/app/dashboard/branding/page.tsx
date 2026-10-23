import { redirect } from 'next/navigation';
import { BrandingForm } from '@/components/BrandingForm';
import { PageHeader } from '@/components/PageHeader';
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
      <PageHeader
        eyebrow="Workspace"
        title="Branding"
        description="These tokens re-skin the portal for every user in your workspace — colours, typography and corner radius. Changes apply immediately and never require a deployment."
      />

      <BrandingForm branding={branding} />
    </div>
  );
}
