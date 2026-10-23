import { NextResponse } from 'next/server';
import { getSessionToken } from './session';
import { resolveTenantHost } from './tenant';
import { apiRequest } from './http';

type Mutation = 'POST' | 'PUT' | 'DELETE';

/**
 * Shared server-side forwarder for portal mutations. The browser sends the
 * action to the portal; the portal attaches the httpOnly session token and the
 * tenant Host header. Tokens never reach client JavaScript.
 */
export async function forwardMutation(
  request: Request,
  apiPath: string,
  method: Mutation,
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 });
  }

  let body: unknown;
  if (method !== 'DELETE') {
    body = await request.json().catch(() => undefined);
  }

  const host = await resolveTenantHost();

  try {
    const result = await apiRequest(apiPath, { method, host, token, body });
    return NextResponse.json(result.data ?? { success: false, error: 'Request failed.' }, {
      status: result.status || 502,
    });
  } catch (error) {
    console.error(`Proxy failed (${method} ${apiPath}): ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, error: 'Operations service unavailable.' },
      { status: 502 },
    );
  }
}
