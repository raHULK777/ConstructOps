-- =============================================================================
-- 000_extensions.sql
-- gen_random_uuid() is built into PostgreSQL 13+, but uuid-ossp is enabled for
-- deployments that still rely on uuid_generate_v4() in operational tooling.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
