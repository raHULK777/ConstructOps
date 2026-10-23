import type { BrandingConfig, PricingMatrix } from './tenant';

export const USER_ROLES = ['admin', 'field_staff', 'client'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_STATUSES = ['planning', 'active', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CHANGE_ORDER_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

/** The resolved tenant context attached to every request by tenantResolver. */
export interface TenantRecord {
  id: string;
  company_name: string;
  subdomain: string;
  custom_domain: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  enable_estimator: boolean;
  enable_client_portal: boolean;
  enable_change_orders: boolean;
  estimator_pricing_matrix: PricingMatrix;
  branding_config: BrandingConfig;
}

/** The authenticated principal attached by authenticate. */
export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
}

export interface ProjectRecord {
  id: string;
  tenant_id: string;
  client_id: string | null;
  project_name: string;
  status: ProjectStatus;
  current_phase: string | null;
  progress_percentage: number;
  estimated_cost: string | number;
  updated_at: Date | string;
}

export interface ChangeOrderRecord {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  description: string | null;
  cost_impact: string | number;
  status: ChangeOrderStatus;
  signed_by: string | null;
  signed_at: Date | string | null;
  ip_address: string | null;
  created_at: Date | string;
}
