-- =============================================================================
-- 005_password_resets.sql
-- Single-use, hashed password-reset tokens. The raw token only exists in the
-- emailed link; the database stores its SHA-256 hash.
-- =============================================================================

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(tenant_id, user_id);
CREATE INDEX idx_password_reset_expiry ON password_reset_tokens(expires_at);
