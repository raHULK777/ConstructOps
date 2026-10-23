-- =============================================================================
-- 003_auth_sessions.sql
-- Server-side session ledger backing rotating refresh tokens and revocation.
-- Only the SHA-256 hash of a refresh token is stored; the token itself exists
-- solely in the client's httpOnly cookie.
-- =============================================================================

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    refresh_token_hash TEXT NOT NULL UNIQUE,
    replaced_by UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,

    user_agent VARCHAR(255),
    ip_address VARCHAR(45),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(tenant_id, user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
