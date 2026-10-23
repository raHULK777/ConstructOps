import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { themeVariables } from '@/lib/branding';
import { fetchBranding } from '@/lib/branding-server';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ConstructOps Portal',
  description: 'Multi-tenant construction operations portal',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const branding = await fetchBranding();

  return (
    <html lang="en" style={themeVariables(branding) as CSSProperties}>
      <body className="min-h-screen bg-brandBackground font-brand text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
