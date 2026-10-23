import { forwardMutation } from '@/lib/proxy';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return forwardMutation(
    request,
    `/api/v1/change-orders/${encodeURIComponent(id)}/reject`,
    'PUT',
  );
}
