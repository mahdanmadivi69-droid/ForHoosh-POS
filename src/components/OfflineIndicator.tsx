import React from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 text-stone-950 px-3.5 py-2 text-xs font-bold shadow-2xl border border-amber-400/50 backdrop-blur-xs animate-pulse"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-stone-950" />
      <div className="flex flex-col text-[11px] leading-tight">
        <span>وضعیت آفلاین (Offline Mode)</span>
        <span className="text-[10px] font-normal text-stone-900">
          اطلاعات به صورت محلی ذخیره شده و هیچ داده‌ای از دست نمی‌رود.
        </span>
      </div>
    </div>
  );
};
