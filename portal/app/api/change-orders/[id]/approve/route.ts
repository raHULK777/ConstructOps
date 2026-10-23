import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { apiRequest } from '@/lib/http';
import { resolveTenantHost } from '@/lib/tenant';

/** Forwards the client's signature to the API; the role check happens there. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const host = await resolveTenantHost();

  try {
    const result = await apiRequest(`/api/v1/change-orders/${encodeURIComponent(id)}/approve`, {
      method: 'PUT',
      host,
      token,
    });
    return NextResponse.json(result.data ?? { success: false, error: 'Approval failed.' }, {
      status: result.status || 502,
    });
  } catch (error) {
    console.error(`Approval proxy failed: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Operations service unavailable.' },
      { status: 502 },
    );
  }
}
