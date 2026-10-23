import { forwardMutation } from '@/lib/proxy';

export async function POST(request: Request): Promise<Response> {
  return forwardMutation(request, '/api/v1/change-orders', 'POST');
}
