import { isIP } from 'node:net';

/**
 * Host header normalisation and tenant-domain inference.
 *
 * Hardening note: the reference implementation resolves
 * `host.split('.')[0] OR custom_domain = host`. For a custom domain such as
 * `alpha-builders.com` that first label is `alpha-builders`, which could silently
 * match a *different* tenant's subdomain. Here subdomains are only inferred when
 * the host is inside the configured platform root domain; every other host must
 * match `tenants.custom_domain` exactly.
 */

const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeHost(hostHeader: string | undefined | null): string | null {
  if (!hostHeader) return null;

  let host = hostHeader.trim().toLowerCase();
  if (!host) return null;

  // IPv6 literals are never tenant domains.
  if (host.startsWith('[')) return null;

  const portIndex = host.indexOf(':');
  if (portIndex !== -1) host = host.slice(0, portIndex);

  host = host.replace(/\.+$/, '');
  if (!host || host.length > 253) return null;
  if (isIP(host) !== 0) return null;
  if (!HOSTNAME_PATTERN.test(host)) return null;

  if (host.startsWith('www.')) host = host.slice(4);
  return host.length >= 3 ? host : null;
}

/** Returns the subdomain label(s) only for hosts under the platform root domain. */
export function subdomainCandidate(host: string, rootDomain: string | null): string | null {
  const root = rootDomain?.toLowerCase() ?? null;
  if (!root) return null;
  if (host === root) return null;

  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;

  const candidate = host.slice(0, -suffix.length);
  if (!candidate || candidate.length > 100) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(candidate)) {
    return null;
  }
  return candidate;
}

/** Cache key for a normalized host. The version prefix allows a clean flush. */
export function tenantCacheKey(host: string): string {
  return `tenant:v1:${host}`;
}

/** Cache keys for a resolved host, including the `www.` variant. */
export function tenantCacheKeys(host: string): string[] {
  const keys = [tenantCacheKey(host)];
  if (!host.startsWith('www.')) keys.push(tenantCacheKey(`www.${host}`));
  return keys;
}
