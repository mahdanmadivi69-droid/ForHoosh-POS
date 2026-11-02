-- =========================================================================
-- MIGRATION 000: PREFLIGHT INTEGRITY CHECKS & ROLLBACK SPECIFICATION
-- Component: CafeOS / SmartOrders Multi-Tenant Core
-- Author: A04-FORGE (Database and Migration Engineer)
-- Safety: READ-ONLY PREFLIGHT CHECKS + IDEMPOTENT ROLLBACK STATEMENTS
-- RULE: DO NOT EXECUTE AUTOMATICALLY OR CONNECT TO PRODUCTION
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: PREFLIGHT INTEGRITY CHECKS
-- Run these checks before applying migrations 001 and 002.
-- -------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Starting CafeOS Schema Preflight Verifications...';

  -- Check 1: PostgreSQL Version (requires >= 12 for robust RLS features)
  IF current_setting('server_version_num')::integer < 120000 THEN
    RAISE EXCEPTION 'PostgreSQL version must be >= 12. Current version: %', current_setting('server_version');
  END IF;

  -- Check 2: Transaction-local Tenant Variable Setting capability
  PERFORM set_config('app.current_tenant_id', 'test-tenant-preflight', true);
  IF current_setting('app.current_tenant_id', true) <> 'test-tenant-preflight' THEN
    RAISE EXCEPTION 'Preflight verification failed: app.current_tenant_id could not be established.';
  END IF;

  -- Check 3: Check tenants table presence or requirement
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) THEN
    RAISE NOTICE 'Note: tenants table does not exist yet. Will be initialized with base schema.';
  END IF;

  RAISE NOTICE 'Preflight Verifications completed successfully.';
END $$;


-- -------------------------------------------------------------------------
-- PART 2: IDEMPOTENT COMPLETE ROLLBACK SCRIPT
-- Execute this block ONLY if migration 001 or 002 fails or rollback is requested.
-- -------------------------------------------------------------------------

/*
-- === ROLLBACK MIGRATION 002 (AUTH & SESSIONS) ===
DROP POLICY IF EXISTS user_sessions_tenant_isolation ON user_sessions;
DROP TABLE IF EXISTS user_sessions CASCADE;

DROP POLICY IF EXISTS user_credentials_tenant_isolation ON user_credentials;
DROP TABLE IF EXISTS user_credentials CASCADE;

DROP POLICY IF EXISTS tenant_users_tenant_isolation ON tenant_users;
DROP TABLE IF EXISTS tenant_users CASCADE;

-- === ROLLBACK MIGRATION 001 (KDS TICKETS) ===
DROP POLICY IF EXISTS kds_ticket_items_tenant_isolation ON kds_ticket_items;
DROP TABLE IF EXISTS kds_ticket_items CASCADE;

DROP POLICY IF EXISTS kds_station_tickets_tenant_isolation ON kds_station_tickets;
DROP TABLE IF EXISTS kds_station_tickets CASCADE;

-- Drop custom types if unused
DROP TYPE IF EXISTS kds_ticket_status CASCADE;
DROP TYPE IF EXISTS kds_station_type CASCADE;
*/
