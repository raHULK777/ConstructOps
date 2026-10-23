import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const token = await getSessionToken();
  redirect(token ? '/dashboard' : '/login');
}
