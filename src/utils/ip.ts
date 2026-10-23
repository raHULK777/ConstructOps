import { isIP } from 'node:net';
import type { Request } from 'express';

/**
 * Normalised client address for the change-order audit trail. Returns null
 * rather than storing an unparseable value, and strips the IPv4-mapped IPv6
 * prefix so 45-character storage is never overflowed.
 */
export function clientIp(req: Request): string | null {
  const candidate = req.ip ?? req.socket.remoteAddress ?? null;
  if (!candidate) return null;

  const normalized = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;
  return isIP(normalized) ? normalized : null;
}
