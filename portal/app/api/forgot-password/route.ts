import { forwardPublic } from '@/lib/proxy';

export async function POST(request: Request): Promise<Response> {
  return forwardPublic(request, '/api/v1/auth/forgot-password');
}
