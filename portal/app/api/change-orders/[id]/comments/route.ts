import { forwardMutation } from '@/lib/proxy';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return forwardMutation(
    request,
    `/api/v1/change-orders/${encodeURIComponent(id)}/comments`,
    'POST',
  );
}
