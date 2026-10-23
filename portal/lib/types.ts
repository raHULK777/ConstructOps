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
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  projectName: string;
  status: ProjectStatus;
  currentPhase: string | null;
  progressPercentage: number;
  estimatedCost: number;
  updatedAt: string;
}

export type StageStatus = 'pending' | 'in_progress' | 'completed';

export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  position: number;
  status: StageStatus;
  completedAt: string | null;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  costImpact: number;
  status: ChangeOrderStatus;
  signedBy: string | null;
  signedByName: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export interface ChangeOrderComment {
  id: string;
  changeOrderId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
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
