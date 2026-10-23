import { z } from 'zod';
import { cssLengthSchema } from '../../types/tenant';

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour such as #0F172A');

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/,
    'must be 3-63 lowercase letters, digits or hyphens, starting and ending alphanumeric',
  );

const brandingPatchSchema = z.strictObject({
  typography: z
    .strictObject({
      font_family: z.string().trim().min(1).max(120).optional(),
      base_size: cssLengthSchema.optional(),
    })
    .optional(),
  layout: z
    .strictObject({
      navbar_style: z.enum(['glassmorphism', 'solid', 'minimal']).optional(),
      sidebar_position: z.enum(['left', 'right']).optional(),
      border_radius: cssLengthSchema.optional(),
    })
    .optional(),
  assets: z
    .strictObject({
      favicon_url: z.union([z.url(), z.literal('')]).optional(),
      email_banner_url: z.union([z.url(), z.literal('')]).optional(),
    })
    .optional(),
});

export const updateBrandingBodySchema = z
  .strictObject({
    companyName: z.string().trim().min(2).max(255).optional(),
    logoUrl: z.union([z.url(), z.literal('')]).optional(),
    primaryColor: hexColorSchema.optional(),
    secondaryColor: hexColorSchema.optional(),
    brandingConfig: brandingPatchSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one branding field must be provided.',
  });

export type BrandingConfigPatch = z.infer<typeof brandingPatchSchema>;
export type UpdateBrandingBody = z.infer<typeof updateBrandingBodySchema>;

export const onboardTenantSchema = z.strictObject({
  companyName: z.string().trim().min(2).max(255),
  subdomain: subdomainSchema,
  customDomain: z.union([z.string().trim().toLowerCase().min(3).max(255), z.literal('')]).optional(),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(10, 'must be at least 10 characters').max(200),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  enableChangeOrders: z.boolean().default(true),
});

export type OnboardTenantBody = z.infer<typeof onboardTenantSchema>;
