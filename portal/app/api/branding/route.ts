import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

export async function PUT(request: Request): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const host = await resolveTenantHost();

  try {
    const result = await apiRequest('/api/v1/tenant/branding', {
      method: 'PUT',
      host,
      token,
      body,
    });
    return NextResponse.json(result.data ?? { success: false, error: 'Update failed.' }, {
      status: result.status || 502,
    });
  } catch (error) {
    console.error(`Branding proxy failed: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Operations service unavailable.' },
      { status: 502 },
    );
  }
}
