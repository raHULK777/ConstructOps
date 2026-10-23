-- =============================================================================
-- 001_tables.sql
-- Authoritative schema for the ConstructOps Engine (DB.md, section 2).
-- Every operational table is structurally partitioned by tenant_id and cascades
-- from the tenants table, so tenant deletion purges the entire footprint.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MASTER TENANTS TABLE
-- Administrative parameters, feature toggles, pricing and branding metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#0F172A',
    secondary_color VARCHAR(7) DEFAULT '#3B82F6',

    -- Feature module flags (boolean toggle switches)
    enable_estimator BOOLEAN NOT NULL DEFAULT TRUE,
    enable_client_portal BOOLEAN NOT NULL DEFAULT TRUE,
    enable_change_orders BOOLEAN NOT NULL DEFAULT FALSE,

    -- Estimator engine configuration (multi-dimensional JSON pricing matrix)
    estimator_pricing_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Deep structural rebranding configuration tokens
    branding_config JSONB NOT NULL DEFAULT '{
      "typography": { "font_family": "Geist Sans", "base_size": "16px" },
      "layout": { "navbar_style": "glassmorphism", "sidebar_position": "left", "border_radius": "0.375rem" },
      "assets": { "favicon_url": "https://constructops.io", "email_banner_url": "https://constructops.io" }
    }'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. UNIFIED USERS TABLE
-- Authentication credentials and role assignment for every platform entity.
-- Email namespaces are unique per tenant, never globally.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'field_staff', 'client')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, email)
);

-- -----------------------------------------------------------------------------
-- 3. PROJECTS TABLE
-- Construction builds, operational phases and budget health.
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'completed')),
    current_phase VARCHAR(100) DEFAULT 'Permitting',
    progress_percentage INT NOT NULL DEFAULT 0
        CHECK (progress_percentage BETWEEN 0 AND 100),
    estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. CHANGE ORDERS TABLE
-- High-scrutiny ledger for legal project and cost revisions.
-- signed_by is RESTRICT: a legally signed order blocks user deletion rather
-- than silently losing the signature.
-- -----------------------------------------------------------------------------
CREATE TABLE change_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cost_impact NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    signed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    signed_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
