-- =============================================================================
-- 004_project_workspace.sql
-- Project stages, change-order discussion threads, customer contact details and
-- rejection audit columns.
-- =============================================================================

-- Customer onboarding details (client-role users).
ALTER TABLE users ADD COLUMN phone VARCHAR(30);

-- -----------------------------------------------------------------------------
-- PROJECT STAGES
-- Ordered, per-project phases. Completing stages drives project progress and the
-- current phase, so the contractor defines their own workflow per project.
-- -----------------------------------------------------------------------------
CREATE TABLE project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_stages_project ON project_stages(tenant_id, project_id, position);

-- -----------------------------------------------------------------------------
-- CHANGE ORDER COMMENTS
-- Discussion thread attached to a change order; visible to staff and to the
-- client who owns the project.
-- -----------------------------------------------------------------------------
CREATE TABLE change_order_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_order_comments_thread
    ON change_order_comments(tenant_id, change_order_id, created_at);

-- -----------------------------------------------------------------------------
-- REJECTION AUDIT
-- Approval keeps the legal signature columns; rejection gets its own actor/time
-- so the two decisions stay distinguishable in an audit.
-- -----------------------------------------------------------------------------
ALTER TABLE change_orders ADD COLUMN rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE change_orders ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
