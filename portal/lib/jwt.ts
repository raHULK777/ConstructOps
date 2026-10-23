export type Role = 'admin' | 'field_staff' | 'client';

export interface SessionClaims {
  sub: string;
  role: Role;
  email: string;
  exp: number;
}

/**
 * Decodes the JWT payload for display only (nav visibility, role-specific
 * controls). It does NOT verify the signature — every read and write is still
 * authorised by the API. Never treat this as a security boundary.
 */
export function decodeSession(token: string): SessionClaims | null {
  const segment = token.split('.')[1];
  if (!segment) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;

    const claims = payload as Record<string, unknown>;
    const role = claims.role;
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      typeof claims.exp !== 'number' ||
      (role !== 'admin' && role !== 'field_staff' && role !== 'client')
    ) {
      return null;
    }

    return { sub: claims.sub, role, email: claims.email, exp: claims.exp };
  } catch {
    return null;
  }
}
