/**
 * CAFE OS — Cloud PostgreSQL Backup & Persistence Service
 * Manages Cloud Database Connection, Schema Auto-Initialization,
 * Row-Level Security (RLS) enforcement, and Automated Daily Backups.
 */

import pg from 'pg';
import { POSTGRES_RLS_SCHEMA_DDL, insertOrderAggregateAtomic, DbSyncResult } from './dbOrderService';
import { OrderAggregate } from '../types/order-domain';

const { Pool } = pg;

export interface DailyBackupPayload {
  tenantId: string;
  backupDate: string; // YYYY-MM-DD
  tenant: any;
  categories: any[];
  menuItems: any[];
  shifts: any[];
  orders: any[];
  payments: any[];
  expenses: any[];
  auditLogs: any[];
  metadata?: {
    totalOrders: number;
    totalRevenueToman: number;
    totalExpensesToman: number;
    exportedBy?: string;
  };
}

export interface CloudDbStatus {
  connected: boolean;
  provider: 'PostgreSQL-Cloud' | 'In-Memory-Fallback';
  host?: string;
  database?: string;
  latencyMs?: number;
  lastBackupAt?: string;
  totalCloudOrders?: number;
  error?: string;
}

export interface DailyBackupRecord {
  id: string;
  tenantId: string;
  backupDate: string;
  totalOrders: number;
  totalRevenueToman: number;
  createdAt: string;
  snapshotPayload?: any;
}

class CloudBackupDbService {
  private pool: pg.Pool | null = null;
  private isInitialized = false;
  private lastBackupTimestamps: Map<string, string> = new Map();
  private inMemoryBackups: Map<string, DailyBackupRecord[]> = new Map();

  constructor() {
    this.initPool();
  }

  private initPool(): void {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

    if (databaseUrl) {
      try {
        const isSecure = databaseUrl.includes('sslmode=require') || !databaseUrl.includes('localhost');
        this.pool = new Pool({
          connectionString: databaseUrl,
          ssl: isSecure ? { rejectUnauthorized: false } : false,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
          console.error('[CloudBackupDb] Unexpected error on idle PostgreSQL client:', err);
        });
      } catch (err) {
        console.warn('[CloudBackupDb] Failed to instantiate pg.Pool:', err);
        this.pool = null;
      }
    } else {
      console.log('[CloudBackupDb] No DATABASE_URL provided. Operating in verified in-memory fallback mode.');
    }
  }

  /**
   * Initializes PostgreSQL schema and daily_backups table
   */
  public async ensureSchema(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (!this.pool) return false;

    let client: pg.PoolClient | null = null;
    try {
      client = await this.pool.connect();

      // 1. Core Orders & RLS Tables
      await client.query(POSTGRES_RLS_SCHEMA_DDL);

      // 2. Daily Backups Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_backups (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          backup_date DATE NOT NULL,
          total_orders INT NOT NULL DEFAULT 0,
          total_revenue_toman BIGINT NOT NULL DEFAULT 0,
          snapshot_payload JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(tenant_id, backup_date)
        );

        CREATE INDEX IF NOT EXISTS idx_daily_backups_tenant_date ON daily_backups(tenant_id, backup_date);
        ALTER TABLE daily_backups ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS daily_backups_tenant_isolation ON daily_backups;
        CREATE POLICY daily_backups_tenant_isolation ON daily_backups
          FOR ALL
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
      `);

      this.isInitialized = true;
      console.log('✅ [CloudBackupDb] Cloud PostgreSQL schema & RLS initialized successfully.');
      return true;
    } catch (err: any) {
      console.error('[CloudBackupDb] Schema initialization failed:', err.message);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Test connection and return connection health metrics
   */
  public async testConnection(): Promise<CloudDbStatus> {
    if (!this.pool) {
      return {
        connected: false,
        provider: 'In-Memory-Fallback',
        lastBackupAt: this.lastBackupTimestamps.get('default'),
      };
    }

    const start = Date.now();
    let client: pg.PoolClient | null = null;
    try {
      client = await this.pool.connect();
      const res = await client.query('SELECT NOW() as current_time, current_database() as db_name');
      const latencyMs = Date.now() - start;

      return {
        connected: true,
        provider: 'PostgreSQL-Cloud',
        database: res.rows[0]?.db_name,
        latencyMs,
        lastBackupAt: this.lastBackupTimestamps.get('default'),
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: 'In-Memory-Fallback',
        error: err.message,
        lastBackupAt: this.lastBackupTimestamps.get('default'),
      };
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Syncs a single order aggregate to PostgreSQL with RLS
   */
  public async syncOrderAggregate(tenantId: string, order: OrderAggregate): Promise<DbSyncResult> {
    let client: pg.PoolClient | null = null;
    if (this.pool) {
      try {
        await this.ensureSchema();
        client = await this.pool.connect();
        return await insertOrderAggregateAtomic(tenantId, order, client);
      } catch (err: any) {
        console.warn(`[CloudBackupDb] PostgreSQL write failed, falling back to in-memory: ${err.message}`);
      } finally {
        if (client) client.release();
      }
    }

    // In-memory fallback
    return insertOrderAggregateAtomic(tenantId, order);
  }

  /**
   * Persists a full daily backup snapshot into cloud database
   */
  public async saveDailyBackup(payload: DailyBackupPayload): Promise<DailyBackupRecord> {
    const { tenantId, backupDate, metadata } = payload;
    const totalOrders = metadata?.totalOrders ?? (payload.orders ? payload.orders.length : 0);
    const totalRevenueToman = metadata?.totalRevenueToman ?? (
      (payload.orders || []).reduce((sum, o) => sum + (o.netTotalToman || 0), 0)
    );

    const backupId = `bkp-${tenantId}-${backupDate}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let client: pg.PoolClient | null = null;
    if (this.pool) {
      try {
        await this.ensureSchema();
        client = await this.pool.connect();
        await client.query('BEGIN');
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

        // Upsert daily backup record
        await client.query(
          `INSERT INTO daily_backups (
            id, tenant_id, backup_date, total_orders, total_revenue_toman, snapshot_payload, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (tenant_id, backup_date) DO UPDATE SET
            total_orders = EXCLUDED.total_orders,
            total_revenue_toman = EXCLUDED.total_revenue_toman,
            snapshot_payload = EXCLUDED.snapshot_payload,
            created_at = EXCLUDED.created_at`,
          [
            backupId,
            tenantId,
            backupDate,
            totalOrders,
            totalRevenueToman,
            JSON.stringify(payload),
            nowIso,
          ]
        );

        await client.query('COMMIT');
        this.lastBackupTimestamps.set(tenantId, nowIso);
        this.lastBackupTimestamps.set('default', nowIso);

        return {
          id: backupId,
          tenantId,
          backupDate,
          totalOrders,
          totalRevenueToman,
          createdAt: nowIso,
        };
      } catch (err: any) {
        if (client) await client.query('ROLLBACK');
        console.warn(`[CloudBackupDb] Failed to save daily backup to PostgreSQL: ${err.message}`);
      } finally {
        if (client) client.release();
      }
    }

    // In-Memory Fallback Persistence
    const record: DailyBackupRecord = {
      id: backupId,
      tenantId,
      backupDate,
      totalOrders,
      totalRevenueToman,
      createdAt: nowIso,
      snapshotPayload: payload,
    };

    const tenantList = this.inMemoryBackups.get(tenantId) || [];
    const existingIdx = tenantList.findIndex((b) => b.backupDate === backupDate);
    if (existingIdx >= 0) {
      tenantList[existingIdx] = record;
    } else {
      tenantList.unshift(record);
    }
    this.inMemoryBackups.set(tenantId, tenantList);
    this.lastBackupTimestamps.set(tenantId, nowIso);
    this.lastBackupTimestamps.set('default', nowIso);

    return record;
  }

  /**
   * List recent daily backups for tenant
   */
  public async getDailyBackups(tenantId: string, limit = 30): Promise<DailyBackupRecord[]> {
    let client: pg.PoolClient | null = null;
    if (this.pool) {
      try {
        await this.ensureSchema();
        client = await this.pool.connect();
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

        const res = await client.query(
          `SELECT id, tenant_id as "tenantId", backup_date as "backupDate",
                  total_orders as "totalOrders", total_revenue_toman as "totalRevenueToman",
                  created_at as "createdAt"
           FROM daily_backups
           WHERE tenant_id = $1
           ORDER BY backup_date DESC
           LIMIT $2`,
          [tenantId, limit]
        );

        return res.rows;
      } catch (err: any) {
        console.warn(`[CloudBackupDb] Query failed, falling back to in-memory: ${err.message}`);
      } finally {
        if (client) client.release();
      }
    }

    const records = this.inMemoryBackups.get(tenantId) || [];
    return records.slice(0, limit);
  }

  /**
   * Get single backup snapshot for restore
   */
  public async getBackupById(tenantId: string, backupId: string): Promise<any | null> {
    let client: pg.PoolClient | null = null;
    if (this.pool) {
      try {
        client = await this.pool.connect();
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
        const res = await client.query(
          'SELECT snapshot_payload FROM daily_backups WHERE id = $1 AND tenant_id = $2',
          [backupId, tenantId]
        );
        if (res.rows.length > 0) {
          return res.rows[0].snapshot_payload;
        }
      } catch (err: any) {
        console.warn(`[CloudBackupDb] Query by id failed: ${err.message}`);
      } finally {
        if (client) client.release();
      }
    }

    const records = this.inMemoryBackups.get(tenantId) || [];
    const found = records.find((b) => b.id === backupId);
    return found ? found.snapshotPayload : null;
  }
}

export const cloudBackupDb = new CloudBackupDbService();
