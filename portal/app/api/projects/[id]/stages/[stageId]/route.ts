import { forwardMutation } from '@/lib/proxy';

interface StageContext {
  params: Promise<{ id: string; stageId: string }>;
}

export async function PUT(request: Request, context: StageContext): Promise<Response> {
  const { id, stageId } = await context.params;
  return forwardMutation(
    request,
    `/api/v1/projects/${encodeURIComponent(id)}/stages/${encodeURIComponent(stageId)}`,
    'PUT',
  );
}

export async function DELETE(request: Request, context: StageContext): Promise<Response> {
  const { id, stageId } = await context.params;
  return forwardMutation(
    request,
    `/api/v1/projects/${encodeURIComponent(id)}/stages/${encodeURIComponent(stageId)}`,
    'DELETE',
  );
}
