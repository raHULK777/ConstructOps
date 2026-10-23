-- =============================================================================
-- 002_indexes.sql
-- The tenant_id prefix is what makes isolation cheap: every hot query is served
-- by an index whose leading column is the tenant boundary (DB.md, section 3).
-- =============================================================================

-- Dynamic domain identification routing
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain);

-- Multi-tenant composite query paths
CREATE INDEX idx_users_tenant_lookup ON users(tenant_id, id);
CREATE INDEX idx_projects_tenant_lookup ON projects(tenant_id, status);
CREATE INDEX idx_change_orders_tenant_lookup ON change_orders(tenant_id, project_id, status);

-- Addition beyond the reference matrix: the client portal always filters by
-- (tenant_id, client_id), which the status-leading index cannot serve directly.
CREATE INDEX idx_projects_tenant_client ON projects(tenant_id, client_id);
