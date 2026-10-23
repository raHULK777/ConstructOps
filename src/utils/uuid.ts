/**
 * Explicit UUIDv4 validation is a written security requirement
 * (Security-policy.md, 2.B). UUIDv1-8 or arbitrary strings are rejected so a
 * caller cannot smuggle a sequential or malformed identifier into a query.
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}
