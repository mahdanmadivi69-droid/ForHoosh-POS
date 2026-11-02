-- =========================================================================
-- MIGRATION 002: AUTHENTICATION FOUNDATIONS & SERVER-MANAGED SESSIONS SCHEMA
-- Component: CafeOS / SmartOrders Security & Identity Engine
-- Author: A04-FORGE (Database and Migration Engineer)
-- Reviewer: A07-GATEKEEPER (Authentication and Authorization Engineer)
-- Safety: IDEMPOTENT DDL. Enforces transaction-local tenant context isolation.
-- Invariants:
--   - Tenant identity must be established by authenticated server-side session.
--   - Native Node crypto.scrypt password hash & salt stored server-side.
--   - HttpOnly hashed session tokens (never plaintext in DB, never exposed to localStorage).
--   - Strict multi-tenant isolation via FORCE ROW LEVEL SECURITY.
--   - No wildcard tenant privileges for any role.
-- =========================================================================

-- 1. Tenant Users Table
CREATE TABLE IF NOT EXISTS tenant_users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  username VARCHAR(64) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN_STAFF', 'GAMEMASTER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_tenant_username UNIQUE (tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_lookup ON tenant_users(tenant_id, username, is_active);

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_users_tenant_isolation ON tenant_users;
CREATE POLICY tenant_users_tenant_isolation ON tenant_users
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 2. User Credentials Table (Scrypt Password & PIN storage)
CREATE TABLE IF NOT EXISTS user_credentials (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  password_hash_scrypt VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  pin_hash_sha256 VARCHAR(64),
  pin_salt VARCHAR(32),
  failed_attempts INT NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_user_credentials UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_tenant ON user_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_credentials_tenant_isolation ON user_credentials;
CREATE POLICY user_credentials_tenant_isolation ON user_credentials
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 3. Server-Managed User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  role VARCHAR(32) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant ON user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_tenant_isolation ON user_sessions;
CREATE POLICY user_sessions_tenant_isolation ON user_sessions
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
