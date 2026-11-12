import React, { useEffect, useState } from 'react';
import {
  checkForKarWandUpdate,
  DEFAULT_REPO_NAME,
  DEFAULT_REPO_OWNER,
  type UpdateCheckResult,
} from '../services/updater/releaseUpdater';
import { logSystemError } from '../utils/telemetry/crashLogger';

export interface UpdateToastProps {
  currentVersion: string;
  repoOwner?: string;
  repoName?: string;
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export const UpdateToast: React.FC<UpdateToastProps> = ({
  currentVersion,
  repoOwner = DEFAULT_REPO_OWNER,
  repoName = DEFAULT_REPO_NAME,
}) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    const runCheck = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const result = await checkForKarWandUpdate(currentVersion, repoOwner, repoName);
        if (active && result.hasUpdate) {
          setUpdateInfo(result);
          setDismissed(false);
        }
      } catch (err) {
        void logSystemError(
          'updater',
          err instanceof Error ? err.message : 'Failed to check GitHub release'
        );
      }
    };

    const initialTimer = setTimeout(() => {
      void runCheck();
    }, 10_000);

    const intervalId = setInterval(() => {
      void runCheck();
    }, FOUR_HOURS_MS);

    return () => {
      active = false;
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [currentVersion, repoOwner, repoName]);

  if (!updateInfo || !updateInfo.hasUpdate || dismissed) {
    return null;
  }

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-emerald-700/60 bg-[#121417]/95 p-4 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            نسخه جدید کاروند آماده است (v{updateInfo.latestVersion})
          </p>
          <p className="mt-1 text-xs text-gray-300">
            Update Available — بدون اختلال در سفارش فعلی قابل دریافت است.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-[#005A3E] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
        >
          دانلود آپدیت (Download)
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/10"
        >
          بعداً (Later)
        </button>
      </div>
    </div>
  );
};
