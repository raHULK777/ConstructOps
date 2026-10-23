import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/env';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

interface LoginResponse {
  success: true;
  token: string;
  user: { id: string; email: string; role: string };
}

/**
 * Server-side login: the API token never touches JavaScript. It is stored in an
 * httpOnly cookie and only ever forwarded by the portal's own route handlers.
 */
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

    const token = result.data?.token;
    if (result.status !== 200 || typeof token !== 'string') {
      return NextResponse.json(
        result.data ?? { success: false, error: 'Sign-in failed.' },
        { status: result.status || 502 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
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
  const response = NextResponse.json({ success: true });
  response.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
