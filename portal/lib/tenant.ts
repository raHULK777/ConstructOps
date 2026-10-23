import { headers } from 'next/headers';
import { TENANT_HOST_OVERRIDE } from './env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/**
 * The API resolves tenants from the Host header. On a tenant domain the portal
 * and API share that host, so it is forwarded verbatim. On localhost there is
 * no tenant DNS, so the configured workspace host is used instead.
 */
export async function resolveTenantHost(): Promise<string> {
  const store = await headers();
  const raw = store.get('host') ?? '';
  const host = raw.split(':')[0]?.trim().toLowerCase() ?? '';

  if (!host || LOCAL_HOSTS.has(host)) return TENANT_HOST_OVERRIDE;
  return host;
}
