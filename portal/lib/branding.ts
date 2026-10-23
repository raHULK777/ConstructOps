import type { PublicBranding } from './types';

export type { PublicBranding };

/**
 * Rendered when the API cannot be reached or the host has no tenant yet. The
 * portal must still paint a usable login screen rather than an error page.
 */
export const FALLBACK_BRANDING: PublicBranding = {
  companyName: 'ConstructOps',
  subdomain: 'portal',
  logoUrl: null,
  primaryColor: '#0F172A',
  secondaryColor: '#3B82F6',
  brandingConfig: {
    typography: { font_family: 'Geist Sans', base_size: '16px' },
    layout: { navbar_style: 'glassmorphism', sidebar_position: 'left', border_radius: '0.375rem' },
    assets: { favicon_url: '', email_banner_url: '' },
  },
  features: { estimator: true, clientPortal: true, changeOrders: true },
};

/** CSS custom properties consumed by tailwind.config.ts. */
export function themeVariables(branding: PublicBranding): Record<string, string> {
  const font = branding.brandingConfig.typography.font_family.replace(/["']/g, '').trim();

  return {
    '--primary-color': branding.primaryColor,
    '--secondary-color': branding.secondaryColor,
    '--brand-bg': '#F8FAFC',
    '--brand-surface': '#FFFFFF',
    '--brand-radius': branding.brandingConfig.layout.border_radius,
    '--brand-font': `"${font || 'Geist Sans'}"`,
  };
}

/** Relative luminance check so button text never becomes illegible on a brand colour. */
export function readableTextColor(hex: string): '#0F172A' | '#FFFFFF' {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#0F172A';

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const [r = 0, g = 0, b = 0] = channels;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#0F172A' : '#FFFFFF';
}
