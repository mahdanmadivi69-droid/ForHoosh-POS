-- =========================================================================
-- MIGRATION 001: PERSISTENT KDS STATION TICKETS SCHEMA WITH RLS
-- Component: CafeOS / SmartOrders KDS Engine
-- Author: A04-FORGE (Database and Migration Engineer)
-- Reviewer: A06-TITAN (KDS Backend and Integration Engineer)
-- Safety: IDEMPOTENT DDL. Enforces transaction-local tenant context isolation.
-- Invariants:
--   - Tickets must survive server restarts.
--   - Station completion is independent; one station cannot complete another.
--   - Retail and gaming items are excluded by domain router before ticket creation.
--   - FORCE ROW LEVEL SECURITY enabled to prevent table owner bypass.
-- =========================================================================

-- 1. Ensure UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. KDS Station Tickets Table
CREATE TABLE IF NOT EXISTS kds_station_tickets (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id VARCHAR(64) NOT NULL,
  order_number INT NOT NULL,
  table_label VARCHAR(64) NOT NULL DEFAULT 'میز سالن',
  station VARCHAR(16) NOT NULL CHECK (station IN ('BAR', 'KITCHEN')),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PREP', 'COMPLETED', 'CANCELLED')),
  is_delta BOOLEAN NOT NULL DEFAULT FALSE,
  delta_sequence INT NOT NULL DEFAULT 0 CHECK (delta_sequence >= 0),
  delta_header_flag VARCHAR(128),
  order_notes TEXT,
  cashier_name VARCHAR(128) NOT NULL DEFAULT 'صندوقدار',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for lightning fast station queries and active order recovery
CREATE INDEX IF NOT EXISTS idx_kds_tickets_tenant ON kds_station_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_active ON kds_station_tickets(tenant_id, station, status);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_order ON kds_station_tickets(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_created ON kds_station_tickets(tenant_id, created_at DESC);

-- Enable and FORCE Row Level Security (RLS)
ALTER TABLE kds_station_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_station_tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kds_station_tickets_tenant_isolation ON kds_station_tickets;
CREATE POLICY kds_station_tickets_tenant_isolation ON kds_station_tickets
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 3. KDS Ticket Items Table
CREATE TABLE IF NOT EXISTS kds_ticket_items (
  id VARCHAR(64) PRIMARY KEY,
  ticket_id VARCHAR(64) NOT NULL REFERENCES kds_station_tickets(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  cart_item_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  modifiers_json JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PREPARING', 'SERVED')),
  dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ticket item joins and lookup
CREATE INDEX IF NOT EXISTS idx_kds_items_ticket ON kds_ticket_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kds_items_tenant ON kds_ticket_items(tenant_id);

-- Enable and FORCE Row Level Security (RLS)
ALTER TABLE kds_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_ticket_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kds_ticket_items_tenant_isolation ON kds_ticket_items;
CREATE POLICY kds_ticket_items_tenant_isolation ON kds_ticket_items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
