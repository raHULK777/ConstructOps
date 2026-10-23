import type { NextResponse } from 'next/server';
import { REFRESH_COOKIE, SESSION_COOKIE } from './env';

export interface TokenPair {
  token: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

function maxAgeSeconds(iso: string, fallback: number): number {
  const remaining = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  return Number.isFinite(remaining) && remaining > 0 ? remaining : fallback;
}

/**
 * The access token cookie is short-lived (minutes); the refresh cookie carries
 * the rotation credential and is only ever read by the portal's own route
 * handlers. Both are httpOnly, so neither is reachable from JavaScript.
 */
export function setAuthCookies(response: NextResponse, tokens: TokenPair): void {
  // Production defaults to Secure cookies. The local Docker stack is served over
  // plain HTTP on localhost, so compose sets COOKIE_SECURE=false explicitly.
  const secure =
    process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: SESSION_COOKIE,
    value: tokens.token,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeSeconds(tokens.accessTokenExpiresAt, 300),
  });

  response.cookies.set({
    name: REFRESH_COOKIE,
    value: tokens.refreshToken,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeSeconds(tokens.refreshTokenExpiresAt, 60 * 60 * 24),
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: REFRESH_COOKIE, value: '', path: '/', maxAge: 0 });
}
