import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAuthCookies, setAuthCookies, type TokenPair } from '@/lib/auth-cookies';
import { REFRESH_COOKIE } from '@/lib/env';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

interface RefreshResponse extends TokenPair {
  success: true;
}

/**
 * Rotates the refresh token and rewrites both httpOnly cookies. Called by the
 * SessionKeeper before the short-lived access token expires.
 */
export async function POST(): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: 'No refresh session.' }, { status: 401 });
  }

  const host = await resolveTenantHost();

  try {
    const result = await apiRequest<RefreshResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      host,
      body: { refreshToken },
    });

    if (result.status !== 200 || !result.data?.token || !result.data.refreshToken) {
      const response = NextResponse.json(
        result.data ?? { success: false, error: 'Session expired.' },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.json({ success: true });
    setAuthCookies(response, result.data);
    return response;
  } catch (error) {
    console.error(`Refresh proxy failed: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable.' },
      { status: 502 },
    );
  }
}
