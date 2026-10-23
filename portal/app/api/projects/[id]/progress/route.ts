import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const host = await resolveTenantHost();

  try {
    const result = await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}/progress`, {
      method: 'PUT',
      host,
      token,
      body,
    });
    return NextResponse.json(result.data ?? { success: false, error: 'Update failed.' }, {
      status: result.status || 502,
    });
  } catch (error) {
    console.error(`Progress proxy failed: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Operations service unavailable.' },
      { status: 502 },
    );
  }
}
