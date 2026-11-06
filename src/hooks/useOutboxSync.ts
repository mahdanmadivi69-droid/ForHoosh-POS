import { useState, useEffect, useRef } from 'react';
import { CafeDatabase } from '../db/cafeDb';
import { OutboxSyncDaemon } from '../services/outboxSyncDaemon';
import type { SyncEngineStatus } from '../services/centralSyncBridge';

export function useOutboxSync(tenantId: string = '100hich', terminalId: string = 'POS_MAIN_01') {
  const [status, setStatus] = useState<SyncEngineStatus>({
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
    pendingCount: 0,
    isLockedOut: false,
  });

  const daemonRef = useRef<OutboxSyncDaemon | null>(null);

  useEffect(() => {
    const db = new CafeDatabase();
    const daemon = new OutboxSyncDaemon({
      db,
      tenantId,
      terminalId,
      pollIntervalMs: 25000,
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
    });

    daemon.start();
    daemonRef.current = daemon;

    return () => {
      daemon.stop();
    };
  }, [tenantId, terminalId]);

  const triggerFlush = () => {
    if (daemonRef.current) {
      daemonRef.current.flush();
    }
  };

  return { status, triggerFlush };
}
