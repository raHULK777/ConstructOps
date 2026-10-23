export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8080';

/**
 * Local development has no tenant DNS. When the portal is reached on a bare
 * host (localhost / IP), the API is addressed with this configured workspace
 * host instead. In production the real Host header always wins.
 */
export const TENANT_HOST_OVERRIDE =
  process.env.TENANT_HOST_OVERRIDE ?? 'alpha-builders.constructops.test';

export const SESSION_COOKIE = 'co_session';

/** Matches the API's default JWT lifetime (12h). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
