import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createAuthRouter } from './authRoutes.js';
import { createCloudTelemetryRouter } from './cloudTelemetryRoutes.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function ensureTables() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS synced_orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_synced_orders_tenant ON synced_orders(tenant_id);

    CREATE TABLE IF NOT EXISTS remote_commands (
      id SERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      command TEXT NOT NULL,
      params JSONB DEFAULT '{}'::jsonb,
      executed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

app.get('/health', async (_req, res) => {
  let db = 'unconfigured';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      db = 'connected';
    } catch {
      db = 'error';
    }
  }
  res.json({
    status: 'ok',
    service: 'karwand-sync-api',
    version: '0.16.0',
    db,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', createAuthRouter());
app.use('/api/telemetry', createCloudTelemetryRouter());

app.post('/api/sync/orders', async (req, res) => {
  const tenantId = String(req.headers['x-tenant-id'] || req.body?.tenantId || 'default');
  const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL not configured' });

  for (const order of orders) {
    if (!order?.id) continue;
    await pool.query(
      `INSERT INTO synced_orders (id, tenant_id, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [String(order.id), tenantId, JSON.stringify(order)]
    );
  }
  res.json({ ok: true, syncedCount: orders.length, tenantId });
});

app.get('/api/commands/:tenantId', async (req, res) => {
  if (!pool) return res.json({ commands: [] });
  const { rows } = await pool.query(
    `SELECT id, command, params, created_at FROM remote_commands
     WHERE tenant_id = $1 AND executed = FALSE ORDER BY id ASC`,
    [req.params.tenantId]
  );
  res.json({ commands: rows });
});

ensureTables()
  .catch((err) => console.error('DB init warning:', err))
  .finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`KarWand Sync API listening on port ${port}`);
    });
  });
