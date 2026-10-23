import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { setAuthCookies, clearAuthCookies, type TokenPair } from '@/lib/auth-cookies';
import { REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/env';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

interface LoginResponse extends TokenPair {
  success: true;
  user: { id: string; email: string; role: string };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown } | null = null;
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Email and password are required.' },
      { status: 400 },
    );
  }

  const host = await resolveTenantHost();

  try {
    const result = await apiRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      host,
      body: { email: body.email, password: body.password },
    });

    if (result.status !== 200 || !result.data?.token || !result.data.refreshToken) {
      return NextResponse.json(
        result.data ?? { success: false, error: 'Sign-in failed.' },
        { status: result.status || 502 },
      );
    }

    const response = NextResponse.json({ success: true });
    setAuthCookies(response, result.data);
    return response;
  } catch (error) {
    console.error(`Login proxy failed: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable.' },
      { status: 502 },
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null;
  const accessToken = store.get(SESSION_COOKIE)?.value ?? null;
  const host = await resolveTenantHost();

  // Best effort: revoke server-side before clearing the cookies. A failure here
  // must not prevent the client from signing out locally.
  if (refreshToken) {
    try {
      await apiRequest('/api/v1/auth/logout', {
        method: 'POST',
        host,
        token: accessToken ?? undefined,
        body: { refreshToken },
      });
    } catch (error) {
      console.warn(`Logout revocation failed: ${(error as Error).message}`);
    }
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
