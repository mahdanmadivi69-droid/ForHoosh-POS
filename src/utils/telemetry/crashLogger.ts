import Dexie, { type Table } from 'dexie';

export type LogSource = 'pos' | 'printer' | 'shift' | 'db' | 'updater' | 'runtime';

export interface SystemLogEntry {
  id?: number;
  timestamp: string;
  appVersion: string;
  source: LogSource;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
  synced: boolean;
}

class KarWandTelemetryDB extends Dexie {
  logs!: Table<SystemLogEntry, number>;

  constructor() {
    super('KarWandTelemetryDB');
    this.version(1).stores({
      logs: '++id, timestamp, source, synced',
    });
  }
}

const telemetryDb = new KarWandTelemetryDB();
const MAX_LOCAL_LOGS = 200;
let currentAppVersion = '0.15.0';
let listenersAttached = false;

async function trimOldLogs(): Promise<void> {
  try {
    const count = await telemetryDb.logs.count();
    if (count > MAX_LOCAL_LOGS) {
      const overflow = count - MAX_LOCAL_LOGS;
      const oldestKeys = await telemetryDb.logs.orderBy('id').limit(overflow).primaryKeys();
      await telemetryDb.logs.bulkDelete(oldestKeys);
    }
  } catch {
    // Never throw from telemetry cleanup
  }
}

export async function logSystemError(
  source: LogSource,
  message: string,
  meta?: Record<string, unknown>,
  stack?: string
): Promise<void> {
  try {
    await telemetryDb.logs.add({
      timestamp: new Date().toISOString(),
      appVersion: currentAppVersion,
      source,
      message: String(message || 'Unknown error'),
      stack,
      meta,
      synced: false,
    });
    await trimOldLogs();
  } catch (err) {
    console.error('[KarWand Telemetry Fallback]', source, message, err);
  }
}

export function initCrashLogger(appVersion: string): void {
  currentAppVersion = appVersion;
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    void logSystemError(
      'runtime',
      event.message || 'Uncaught window error',
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
      event.error instanceof Error ? event.error.stack : undefined
    );
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;
    void logSystemError('runtime', msg, undefined, stack);
  });
}

export async function exportDiagnosticsBundle(): Promise<void> {
  const logs = await telemetryDb.logs.orderBy('id').reverse().toArray();
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: currentAppVersion,
    online: typeof navigator !== 'undefined' ? navigator.onLine : false,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    totalLogs: logs.length,
    logs,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const a = document.createElement('a');
  a.href = url;
  a.download = `karwand-diag-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function flushLogsToWebhook(webhookUrl: string): Promise<number> {
  if (!webhookUrl || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 0;
  }

  const unsynced = await telemetryDb.logs.filter((entry) => !entry.synced).toArray();
  if (unsynced.length === 0) return 0;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appVersion: currentAppVersion,
      sentAt: new Date().toISOString(),
      logs: unsynced,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telemetry flush failed with HTTP ${response.status}`);
  }

  const ids = unsynced.map((item) => item.id).filter((id): id is number => typeof id === 'number');
  await telemetryDb.logs.where('id').anyOf(ids).modify({ synced: true });
  return ids.length;
}
