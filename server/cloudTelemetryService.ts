/**
 * server/cloudTelemetryService.ts
 * 
 * CafeOS / SmartOrders Cloud Telemetry & License Backend Engine (Phase 2 Stage B)
 * Authored by: alpha (Cloud Telemetry & License Specialist)
 * Enforces:
 *  - [INTEGER_TOMAN_PRECISION]: Strictly validates integer Toman prices on push
 *  - [TENANT_ISOLATION_MANDATORY]: Strictly partitions queues and telemetry per tenant
 *  - [MINIMAL_MEMORY_FOOTPRINT]: In-memory indexed store with disk persistence (<50MB RAM)
 *  - [ZERO_DEPENDENCY_JWT]: RFC 7519 HMAC-SHA256 license leases via node:crypto
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type RemoteCommandType = 'UPDATE_PRICE' | 'TOGGLE_STOCK';

export interface RemoteCommandPayload {
  productId: string;
  newPriceToman?: number;
  inStock?: boolean;
  reason?: string;
}

export interface RemoteCommand {
  commandId: string;
  tenantId: string;
  seq: number;
  type: RemoteCommandType;
  payload: RemoteCommandPayload;
  issuedAt: number;
}

export interface TelemetryEvent {
  id: string;
  tenantId: string;
  terminalId: string;
  appVersion: string;
  timestamp: number;
  type: 'HEARTBEAT' | 'ERROR_ALERT' | 'PRINT_FAILURE';
  metrics?: {
    memoryUsageMb?: number;
    errorCount?: number;
    offlineQueueSize?: number;
  };
  errorDetails?: string;
  receivedAt: number;
}

export interface LicenseLeasePayload {
  iss: string;
  sub: string; // tenantId
  terminalId: string;
  issuedAt: number;
  validUntil: number; // Unix timestamp
  features: string[];
  brand: {
    brandNameEn: string;
    brandNameFa: string;
  };
}

export interface CloudTelemetryConfig {
  storageDir?: string;
  jwtSecret?: string;
  maxTelemetryRecords?: number;
}

export class CloudTelemetryService {
  private storageDir: string;
  private jwtSecret: string;
  private maxTelemetryRecords: number;

  // In-memory state partitioned by tenant
  private tenantCommands: Map<string, RemoteCommand[]> = new Map();
  private tenantSequenceCounters: Map<string, number> = new Map();
  private telemetryStore: TelemetryEvent[] = [];

  constructor(config?: CloudTelemetryConfig) {
    this.storageDir = config?.storageDir || path.resolve(process.cwd(), '.telemetry_store');
    this.jwtSecret = config?.jwtSecret || process.env.LICENSE_JWT_SECRET || 'cafeos_secure_cloud_secret_2026';
    this.maxTelemetryRecords = config?.maxTelemetryRecords || 5000;

    this.ensureStorageDir();
    this.loadStateFromDisk();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch (e) {
        console.warn('[CloudTelemetryService] Storage dir creation warning:', e);
      }
    }
  }

  private getCommandsFilePath(): string {
    return path.join(this.storageDir, 'commands_store.json');
  }

  private getTelemetryFilePath(): string {
    return path.join(this.storageDir, 'telemetry_store.json');
  }

  /**
   * Restores state from persistent JSON files on disk (zero-idle sleep resilience).
   */
  private loadStateFromDisk(): void {
    const cmdPath = this.getCommandsFilePath();
    if (fs.existsSync(cmdPath)) {
      try {
        const raw = fs.readFileSync(cmdPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [tenant, cmds] of Object.entries(parsed)) {
            if (Array.isArray(cmds)) {
              this.tenantCommands.set(tenant, cmds);
              const maxSeq = cmds.reduce((acc: number, c: RemoteCommand) => Math.max(acc, c.seq || 0), 0);
              this.tenantSequenceCounters.set(tenant, maxSeq);
            }
          }
        }
      } catch (err) {
        console.warn('[CloudTelemetryService] Failed to load commands from disk, starting empty:', err);
      }
    }

    const telPath = this.getTelemetryFilePath();
    if (fs.existsSync(telPath)) {
      try {
        const raw = fs.readFileSync(telPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.telemetryStore = parsed.slice(-this.maxTelemetryRecords);
        }
      } catch (err) {
        console.warn('[CloudTelemetryService] Failed to load telemetry from disk, starting empty:', err);
      }
    }
  }

  /**
   * Persists state to disk safely with atomic rename.
   */
  public flushToDisk(): void {
    try {
      this.ensureStorageDir();
      const obj: Record<string, RemoteCommand[]> = {};
      for (const [t, cmds] of this.tenantCommands.entries()) {
        obj[t] = cmds;
      }
      const tmpCmdPath = `${this.getCommandsFilePath()}.tmp`;
      fs.writeFileSync(tmpCmdPath, JSON.stringify(obj, null, 2), 'utf8');
      fs.renameSync(tmpCmdPath, this.getCommandsFilePath());

      const tmpTelPath = `${this.getTelemetryFilePath()}.tmp`;
      fs.writeFileSync(tmpTelPath, JSON.stringify(this.telemetryStore, null, 2), 'utf8');
      fs.renameSync(tmpTelPath, this.getTelemetryFilePath());
    } catch (err) {
      console.error('[CloudTelemetryService] Failed flushing state to disk:', err);
    }
  }

  /**
   * Pushes a new command into the tenant's command queue.
   * Strictly enforces Integer Toman precision on UPDATE_PRICE.
   */
  public pushCommand(
    tenantId: string,
    type: RemoteCommandType,
    payload: RemoteCommandPayload
  ): RemoteCommand {
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new Error('[CloudTelemetry] tenantId is strictly required');
    }
    const normTenant = tenantId.trim();

    if (!payload || !payload.productId || typeof payload.productId !== 'string') {
      throw new Error('[CloudTelemetry] productId is strictly required in payload');
    }

    // MANDATORY FINANCIAL INVARIANT: INTEGER_TOMAN_PRECISION
    if (type === 'UPDATE_PRICE') {
      if (
        payload.newPriceToman === undefined ||
        !Number.isInteger(payload.newPriceToman) ||
        payload.newPriceToman < 0
      ) {
        throw new Error(
          `[CloudTelemetry] Financial Invariant Violation: newPriceToman must be a non-negative integer. Received: ${payload.newPriceToman}`
        );
      }
    } else if (type === 'TOGGLE_STOCK') {
      if (typeof payload.inStock !== 'boolean') {
        throw new Error(
          `[CloudTelemetry] inStock must be a boolean. Received: ${payload.inStock}`
        );
      }
    } else {
      throw new Error(`[CloudTelemetry] Unrecognized command type: ${type}`);
    }

    const currentSeq = (this.tenantSequenceCounters.get(normTenant) || 0) + 1;
    this.tenantSequenceCounters.set(normTenant, currentSeq);

    const command: RemoteCommand = {
      commandId: `cmd_${normTenant}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      tenantId: normTenant,
      seq: currentSeq,
      type,
      payload: {
        productId: payload.productId,
        newPriceToman: payload.newPriceToman,
        inStock: payload.inStock,
        reason: payload.reason,
      },
      issuedAt: Date.now(),
    };

    if (!this.tenantCommands.has(normTenant)) {
      this.tenantCommands.set(normTenant, []);
    }
    this.tenantCommands.get(normTenant)!.push(command);

    this.flushToDisk();
    return command;
  }

  /**
   * Pulls pending commands for a tenant beyond lastSeq.
   */
  public pullCommands(tenantId: string, lastSeq: number = 0): {
    commands: RemoteCommand[];
    latestSeq: number;
  } {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('[CloudTelemetry] tenantId is required for command pull');
    }
    const normTenant = tenantId.trim();
    const cmds = this.tenantCommands.get(normTenant) || [];
    const latestSeq = this.tenantSequenceCounters.get(normTenant) || 0;

    const filtered = cmds
      .filter((c) => c.seq > lastSeq)
      .sort((a, b) => a.seq - b.seq);

    return {
      commands: filtered,
      latestSeq,
    };
  }

  /**
   * Ingests a telemetry event with FIFO buffer cap.
   */
  public recordTelemetry(event: Omit<TelemetryEvent, 'id' | 'receivedAt'>): TelemetryEvent {
    if (!event.tenantId || typeof event.tenantId !== 'string') {
      throw new Error('[CloudTelemetry] tenantId is required for telemetry');
    }

    const fullEvent: TelemetryEvent = {
      id: `tel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      receivedAt: Date.now(),
      ...event,
    };

    this.telemetryStore.push(fullEvent);
    if (this.telemetryStore.length > this.maxTelemetryRecords) {
      this.telemetryStore = this.telemetryStore.slice(-this.maxTelemetryRecords);
    }

    this.flushToDisk();
    return fullEvent;
  }

  /**
   * Returns recent telemetry records for a tenant.
   */
  public getTelemetry(tenantId?: string, limit: number = 50): TelemetryEvent[] {
    let items = this.telemetryStore;
    if (tenantId) {
      const norm = tenantId.trim();
      items = items.filter((e) => e.tenantId === norm);
    }
    return items.slice(-limit).reverse();
  }

  /**
   * Signs a lease-based RFC 7519 compliant HMAC-SHA256 JWT for tenant offline operation.
   */
  public generateLicenseLease(tenantId: string, terminalId: string = 'POS_MAIN_01'): {
    token: string;
    expiresAt: number;
    tenantId: string;
  } {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('[CloudTelemetry] tenantId is required for license lease');
    }
    const normTenant = tenantId.trim();
    const is100Hich = normTenant.toLowerCase().includes('100hich');

    const now = Math.floor(Date.now() / 1000);
    const leaseDurationSeconds = 7 * 24 * 60 * 60; // 7 days lease
    const expiresAt = now + leaseDurationSeconds;

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: LicenseLeasePayload = {
      iss: 'CafeOS_License_Authority',
      sub: normTenant,
      terminalId,
      issuedAt: now,
      validUntil: expiresAt,
      features: [
        'OFFLINE_POS_CORE',
        'INTEGER_TOMAN_ACCOUNTING',
        'THERMAL_PRINTING_PERSISTENT',
        'MULTI_TENANT_RLS',
        'REMOTE_COMMAND_SYNC',
      ],
      brand: {
        brandNameEn: is100Hich ? '100 Hich Coffee Roasters' : 'Modendo Cafe',
        brandNameFa: is100Hich ? 'قهوه‌فروشی ۱۰۰هیچ' : 'کافه مودندو',
      },
    };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    const token = `${b64Header}.${b64Payload}.${signature}`;

    return {
      token,
      expiresAt,
      tenantId: normTenant,
    };
  }

  /**
   * Verifies a lease-based JWT token.
   */
  public verifyLicenseLease(token: string): {
    valid: boolean;
    payload?: LicenseLeasePayload;
    reason?: string;
  } {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Empty token' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Malformed JWT structure' };
    }

    const [b64Header, b64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      return { valid: false, reason: 'Invalid signature' };
    }

    try {
      const payload: LicenseLeasePayload = JSON.parse(
        Buffer.from(b64Payload, 'base64url').toString('utf8')
      );

      const now = Math.floor(Date.now() / 1000);
      if (payload.validUntil < now) {
        return { valid: false, payload, reason: 'Lease expired' };
      }

      return { valid: true, payload };
    } catch (e: any) {
      return { valid: false, reason: `Failed parsing payload: ${e?.message}` };
    }
  }

  /**
   * Diagnostic health statistics.
   */
  public getHealth(): {
    status: string;
    uptimeSeconds: number;
    tenantsTracked: string[];
    telemetryCount: number;
    memoryUsageMb: number;
  } {
    const mem = process.memoryUsage();
    return {
      status: 'HEALTHY',
      uptimeSeconds: Math.floor(process.uptime()),
      tenantsTracked: Array.from(this.tenantCommands.keys()),
      telemetryCount: this.telemetryStore.length,
      memoryUsageMb: Math.round(mem.rss / (1024 * 1024)),
    };
  }
}

// Global singleton instance
let instance: CloudTelemetryService | null = null;
export function getCloudTelemetryService(config?: CloudTelemetryConfig): CloudTelemetryService {
  if (!instance) {
    instance = new CloudTelemetryService(config);
  }
  return instance;
}
