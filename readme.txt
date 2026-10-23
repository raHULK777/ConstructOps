
🏗️ ConstructOps – Multi-Tenant Construction Platform Engine

A high-performance, cost-effective, multi-tenant SaaS engine built with Node.js and PostgreSQL. This platform enables solo developers or freelancers to deploy fully branded client portals, quotation calculators, and operations dashboards for mid-sized construction and trade contractors ($7M–$15M revenue) using a single codebase.

🏛️ System Architecture Overview

This platform uses a logical data isolation model (Single Database, Shared Schema) where every data row is structurally partitioned using a tenant_id.
[ Client Traffic ] ---> ( Wildcard Subdomain or Custom Domain )
                                     |
                                     v
                       [ Reverse Proxy / SSL Gateway ]
                                     |
                          [ Node.js API Cluster ]
                                     |
                        ( Tenant Resolver Middleware )
                                     |
               ---------------------------------------------

              |                                             |
              v                                             v
     [ Redis Cache Layer ]                         [ PostgreSQL Cluster ]
  (Tenant Theme configs, Toggles)                (Data Isolated Schema via RLS)

📂 Core Database Schema (Crucial Implementation)

To ensure high data integrity and performance, run this initialization script against your PostgreSQL instance.
sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MASTER TENANTS TABLE
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL, 
    custom_domain VARCHAR(255) UNIQUE,     
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#0F172A',
    secondary_color VARCHAR(7) DEFAULT '#3B82F6',
    
    -- Feature Module Flags
    enable_estimator BOOLEAN DEFAULT TRUE,
    enable_client_portal BOOLEAN DEFAULT TRUE,
    enable_change_orders BOOLEAN DEFAULT FALSE,
    
    -- Estimator Engine Configuration
    estimator_pricing_matrix JSONB DEFAULT '{}'::jsonb, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. UNIFIED USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'field_staff', 'client')), 
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- 3. PROJECTS TABLE
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
    current_phase VARCHAR(100) DEFAULT 'Permitting',
    progress_percentage INT DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    estimated_cost NUMERIC(12, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CRITICAL CHANGE ORDERS TABLE (Legal Scrutiny Audit)
CREATE TABLE change_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cost_impact NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    signed_by UUID REFERENCES users(id),
    signed_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PERFORMANCE CRITICAL INDEXES
CREATE INDEX idx_tenants_domains ON tenants(subdomain, custom_domain);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_change_orders_project ON change_orders(project_id);
Use code with caution.

🛡️ Critical Implementation Components


1. Tenant Resolution & Context Injection (Middleware)

Every incoming request must hit the tenantResolver before any controller logic executes. This middleware parses the domain, hits Redis for sub-millisecond lookups, and maps the entire request environment.
javascript
// middleware/tenantResolver.js
const db = require('../config/database');
const redisClient = require('../config/redis');

async function tenantResolver(req, res, next) {
    const host = req.headers.host; // e.g., "alpha.constructops.io" or "customdomain.com"
    const cacheKey = `tenant:${host}`;

    try {
        // Step A: Attempt fast memory-cache read
        let cachedTenant = await redisClient.get(cacheKey);
        if (cachedTenant) {
            req.tenant = JSON.parse(cachedTenant);
            return next();
        }

        // Step B: Database Fallback Lookup
        const queryText = `
            SELECT id, company_name, primary_color, secondary_color, 
                   enable_estimator, enable_client_portal, enable_change_orders 
            FROM tenants 
            WHERE subdomain = $1 OR custom_domain = $2 LIMIT 1`;
            
        const cleanSubdomain = host.split('.')[0];
        const result = await db.query(queryText, [cleanSubdomain, host]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant domain context not found.' });
        }

        const tenantData = result.rows[0];

        // Step C: Set Cache with a 1-hour expiration
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(tenantData));

        req.tenant = tenantData;
        next();
    } catch (error) {
        console.error('Tenant resolution failure:', error);
        return res.status(500).json({ error: 'Platform routing engine failure.' });
    }
}

module.exports = tenantResolver;
Use code with caution.

2. Multi-Tenant Cross-Contamination Security

To guarantee that a user from Tenant A can never access data belonging to Tenant B, your authentication layer must hardcode the tenant_id context into your system queries.
javascript
// middleware/authenticate.js
const jwt = require('jsonwebtoken');

function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token missing or invalid.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // CRITICAL CROSS-TENANT SECURITY CHECK
        if (decoded.tenant_id !== req.tenant.id) {
            return res.status(403).json({ error: 'Token scope does not match current tenant domain context.' });
        }

        req.user = decoded; // { id, email, role, tenant_id }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid.' });
    }
}
Use code with caution.

3. Feature Gating Logic

Prevent client access to premium modules (like Change Order approvals) if the contractor has not enabled or paid for that specific engine option.
javascript
// middleware/featureGate.js
function requireFeature(featureKey) {
    return (req, res, next) => {
        if (!req.tenant || !req.tenant[featureKey]) {
            return res.status(403).json({ 
                error: `The premium module '${featureKey}' is disabled for this tenant.` 
            });
        }
        next();
    };
}

module.exports = requireFeature;
Use code with caution.

🎨 Dynamic Frontend Integration Strategy

Your monolithic web frontend changes skin automatically at run-time without deployment rebuilds.
1. Theme Initialization: The frontend fetches the matching client metadata configuration via req.tenant properties on load.
2. Global CSS Mapping: Root tokens are configured using Tailwind CSS variable bindings:html
<!-- HTML Layout Hydration Wrapper -->
<html style="--primary-color: ${tenant.primary_color}; --secondary-color: ${tenant.secondary_color};">
Use code with caution.
3. Tailwind Configurations:javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brandPrimary: 'var(--primary-color)',
        brandSecondary: 'var(--secondary-color)',
      }
    }
  }
}
Use code with caution.

🚀 Instant Tenant Onboarding Script

To onboard a brand new paying contractor client, use this unified transactional script. It creates their system instance, registers their master administrator account, and provisions standard feature access definitions in a single atomic database execution block.
javascript
// scripts/onboardTenant.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

async function onboardNewClient({ companyName, subdomain, adminEmail, rawPassword }) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // 1. Provision the base Tenant
        const tenantQuery = `
            INSERT INTO tenants (company_name, subdomain, enable_change_orders)
            VALUES ($1, $2, true) RETURNING id`;
        const tenantRes = await client.query(tenantQuery, [companyName, subdomain]);
        const tenantId = tenantRes.rows[0].id;

        // 2. Hash and provision the Administrator Account
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

        const userQuery = `
            INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
            VALUES ($1, $2, $3, 'admin', 'Company', 'Administrator')`;
        await client.query(userQuery, [tenantId, adminEmail, passwordHash]);

        await client.query('COMMIT');
        console.log(`Successfully provisioned tenant: ${companyName} (${subdomain}.constructops.io)`);
        return { tenantId, success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to provision tenant transaction:', error);
        throw error;
    } finally {
        client.release();
    }
}
Use code with caution.

⚡ Deployment Checklist for Freelancers

• SSL Automation Engine: Setup Cloudflare for Platforms (SSL for SaaS) or use a custom reverse proxy setup via Caddy Server to automatically provision free Let's Encrypt SSL certificates dynamically whenever a custom domain is saved into the tenants database table.
• Environmental Security Flags: Ensure all web session cookies use HttpOnly, Secure, and SameSite=Lax configuration protocols.
• Cross-Tenant Query Auditing: Enforce a strict coding policy requiring all database transactions to explicitly append WHERE tenant_id = req.tenant.id.
