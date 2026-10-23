export type Role = 'admin' | 'field_staff' | 'client';
export type ProjectStatus = 'planning' | 'active' | 'completed';
export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected';

export interface BrandingConfig {
  typography: { font_family: string; base_size: string };
  layout: { navbar_style: 'glassmorphism' | 'solid' | 'minimal'; sidebar_position: 'left' | 'right'; border_radius: string };
  assets: { favicon_url: string; email_banner_url: string };
}

export interface PublicBranding {
  companyName: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  brandingConfig: BrandingConfig;
  features: {
    estimator: boolean;
    clientPortal: boolean;
    changeOrders: boolean;
  };
}

export interface Project {
  id: string;
  clientId: string | null;
  projectName: string;
  status: ProjectStatus;
  currentPhase: string | null;
  progressPercentage: number;
  estimatedCost: number;
  updatedAt: string;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  costImpact: number;
  status: ChangeOrderStatus;
  signedBy: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface LoginResult {
  success: true;
  token: string;
  user: { id: string; email: string; role: Role };
  tenantBranding: {
    companyName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
}
