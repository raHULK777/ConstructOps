import { z } from 'zod';

/**
 * Tenant-scoped branding contract. Persisted in `tenants.branding_config` (JSONB)
 * and served to the frontend theme engine. Every field is optional at the API
 * boundary and normalised through this schema before it is written.
 */

const cssLengthSchema = z
  .string()
  .trim()
  .regex(/^(0|\d{1,2}px|\d(\.\d+)?rem)$/, 'must be a CSS length such as 12px or 0.375rem');

export { cssLengthSchema };

export const brandingConfigSchema = z.object({
  typography: z
    .object({
      font_family: z.string().trim().min(1).max(120).default('Geist Sans'),
      base_size: cssLengthSchema.default('16px'),
    })
    .default({ font_family: 'Geist Sans', base_size: '16px' }),
  layout: z
    .object({
      navbar_style: z.enum(['glassmorphism', 'solid', 'minimal']).default('glassmorphism'),
      sidebar_position: z.enum(['left', 'right']).default('left'),
      border_radius: cssLengthSchema.default('0.375rem'),
    })
    .default({ navbar_style: 'glassmorphism', sidebar_position: 'left', border_radius: '0.375rem' }),
  assets: z
    .object({
      favicon_url: z.union([z.url(), z.literal('')]).default('https://constructops.io'),
      email_banner_url: z.union([z.url(), z.literal('')]).default('https://constructops.io'),
    })
    .default({
      favicon_url: 'https://constructops.io',
      email_banner_url: 'https://constructops.io',
    }),
});

export type BrandingConfig = z.infer<typeof brandingConfigSchema>;

/**
 * Estimator pricing matrix. Stored per tenant as JSONB so a contractor can tune
 * rates without a deployment. Anything the estimator cannot validate falls back
 * to these platform defaults at read time (never at boot, never fatally).
 */
export const BASE_RATES: Readonly<Record<string, number>> = Object.freeze({
  default: 150,
  residential_remodel: 150,
  commercial_retrofit: 210,
  new_build: 185,
});

export const MATERIAL_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  standard: 1,
  premium: 1.25,
  luxury: 1.6,
});

export const DEFAULT_PRICING_MATRIX = Object.freeze({
  base_rates: BASE_RATES,
  material_multipliers: MATERIAL_MULTIPLIERS,
  contingency_percent: 10,
});

export const pricingMatrixSchema = z.object({
  base_rates: z
    .record(z.string().trim().min(1).max(60), z.number().positive().max(1_000_000))
    .default({ ...BASE_RATES }),
  material_multipliers: z
    .record(z.string().trim().min(1).max(60), z.number().positive().max(100))
    .default({ ...MATERIAL_MULTIPLIERS }),
  contingency_percent: z.number().min(0).max(100).default(10),
});

export type PricingMatrix = z.infer<typeof pricingMatrixSchema>;
