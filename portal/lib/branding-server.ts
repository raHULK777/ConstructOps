import { FALLBACK_BRANDING } from './branding';
import { apiRequest } from './http';
import { resolveTenantHost } from './tenant';
import type { PublicBranding } from './types';

export const BRANDING_FALLBACK_NOTE =
  'Showing default branding because the API is unreachable.';

/**
 * Reads the tenant's public theme contract. Failure must never block rendering:
 * the login page still has to be usable while the API is down.
 */
export async function fetchBranding(): Promise<PublicBranding> {
  const host = await resolveTenantHost();

  try {
    const result = await apiRequest<{ success: true; tenant: PublicBranding }>(
      '/api/v1/tenant/branding',
      { host, timeoutMs: 1_500 },
    );
    if (result.status === 200 && result.data?.tenant) {
      return result.data.tenant;
    }
  } catch (error) {
    console.warn(`Tenant branding unavailable: ${(error as Error).message}`);
  }

  return FALLBACK_BRANDING;
}
