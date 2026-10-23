import type { Config } from 'tailwindcss';

/**
 * Utilities are bound to CSS custom properties, never to literal colours.
 * The root layout writes the tenant's tokens onto <html>, so a branding change
 * re-skins the whole portal without a rebuild (rebranding.md, section 2).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brandPrimary: 'var(--primary-color)',
        brandSecondary: 'var(--secondary-color)',
        brandBackground: 'var(--brand-bg)',
        brandSurface: 'var(--brand-surface)',
      },
      borderRadius: {
        brand: 'var(--brand-radius)',
      },
      fontFamily: {
        brand: ['var(--brand-font)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
