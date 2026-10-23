'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BrandButton } from '@/components/BrandButton';
import { Notice } from '@/components/Notice';
import { readableTextColor } from '@/lib/branding';
import type { PublicBranding } from '@/lib/types';

export function BrandingForm({ branding }: { branding: PublicBranding }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(branding.companyName);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(branding.secondaryColor);
  const [fontFamily, setFontFamily] = useState(branding.brandingConfig.typography.font_family);
  const [radius, setRadius] = useState(branding.brandingConfig.layout.border_radius);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const onPrimary = readableTextColor(primaryColor);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    try {
      const response = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          logoUrl: logoUrl.trim(),
          primaryColor,
          secondaryColor,
          brandingConfig: {
            typography: { font_family: fontFamily.trim() },
            layout: { border_radius: radius },
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not save branding.');
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-brand border border-slate-200/80 bg-brandSurface p-6 shadow-sm"
      >
        {error ? <Notice>{error}</Notice> : null}
        {saved ? <Notice tone="success">Branding saved. The portal re-themed instantly.</Notice> : null}

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">
            Company name
          </label>
          <input
            id="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            minLength={2}
            maxLength={255}
            required
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
        </div>

        <div>
          <label htmlFor="logoUrl" className="block text-sm font-medium text-slate-700">
            Logo URL
          </label>
          <input
            id="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://cdn.example.com/logo.svg"
            className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
          />
          <p className="mt-1 text-xs text-slate-500">Leave empty to remove the logo.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-slate-700">
              Primary colour
            </label>
            <input
              id="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-brand border border-slate-300 bg-white p-1"
            />
          </div>
          <div>
            <label htmlFor="secondaryColor" className="block text-sm font-medium text-slate-700">
              Accent colour
            </label>
            <input
              id="secondaryColor"
              type="color"
              value={secondaryColor}
              onChange={(event) => setSecondaryColor(event.target.value)}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-brand border border-slate-300 bg-white p-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fontFamily" className="block text-sm font-medium text-slate-700">
              Font family
            </label>
            <input
              id="fontFamily"
              value={fontFamily}
              onChange={(event) => setFontFamily(event.target.value)}
              maxLength={120}
              className="mt-1.5 w-full rounded-brand border border-slate-300 px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            />
          </div>
          <div>
            <label htmlFor="radius" className="block text-sm font-medium text-slate-700">
              Corner radius
            </label>
            <select
              id="radius"
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              className="mt-1.5 w-full rounded-brand border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brandPrimary focus:outline-none focus:ring-2 focus:ring-brandPrimary/20"
            >
              <option value="0px">Sharp / industrial</option>
              <option value="0.5rem">Standard modern</option>
              <option value="12px">Soft / consumer</option>
            </select>
          </div>
        </div>

        <BrandButton type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save branding'}
        </BrandButton>
      </form>

      <aside className="rounded-brand border border-slate-200/80 bg-brandSurface p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Live preview</h2>
        <div
          className="mt-4 overflow-hidden rounded-brand border border-slate-200"
          style={{ borderRadius: radius }}
        >
          <div className="flex items-center gap-2 p-4" style={{ backgroundColor: primaryColor, color: onPrimary }}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">
              {companyName.slice(0, 1).toUpperCase() || 'C'}
            </span>
            <span className="truncate text-sm font-semibold">{companyName || 'Your company'}</span>
          </div>
          <div className="space-y-3 p-4" style={{ fontFamily: `"${fontFamily}", system-ui, sans-serif` }}>
            <p className="text-sm text-slate-600">Projects stay on schedule.</p>
            <span
              className="inline-block px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: secondaryColor, color: readableTextColor(secondaryColor), borderRadius: radius }}
            >
              Approve change order
            </span>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          These tokens are injected as CSS variables, so the portal re-skins without a rebuild.
        </p>
      </aside>
    </div>
  );
}
