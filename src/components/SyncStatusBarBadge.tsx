import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { SyncEngineStatus } from '../services/centralSyncBridge';

export interface SyncStatusBarBadgeProps {
  status: SyncEngineStatus;
  onManualFlush?: () => void;
  className?: string;
}

const physicsSpring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

export const SyncStatusBarBadge: React.FC<SyncStatusBarBadgeProps> = ({
  status,
  onManualFlush,
  className = '',
}) => {
  const { isSyncing, pendingCount, isLockedOut, lastError } = status;
  const [isHovered, setIsHovered] = useState(false);

  let palette = {
    bg: 'bg-[#121417]',
    border: 'border-[#293444]',
    hoverBorder: 'hover:border-emerald-500/50',
    text: 'text-emerald-400',
    indicator: 'bg-emerald-400',
    glow: 'shadow-[0_0_12px_rgba(52,211,153,0.35)]',
    label: 'همگام ابری',
    badge: null as string | null,
    icon: CheckCircle2,
  };

  if (isLockedOut) {
    palette = {
      bg: 'bg-[#180A0E]',
      border: 'border-rose-900/60',
      hoverBorder: 'hover:border-rose-600',
      text: 'text-rose-400',
      indicator: 'bg-rose-500',
      glow: 'shadow-[0_0_14px_rgba(244,63,94,0.45)]',
      label: 'تعلیق اشتراک',
      badge: 'قفل',
      icon: ShieldAlert,
    };
  } else if (isSyncing) {
    palette = {
      bg: 'bg-[#19150B]',
      border: 'border-amber-900/60',
      hoverBorder: 'hover:border-amber-500',
      text: 'text-amber-400',
      indicator: 'bg-amber-400',
      glow: 'shadow-[0_0_14px_rgba(251,191,36,0.4)]',
      label: 'تخلیه صف...',
      badge: `${pendingCount}`,
      icon: RefreshCw,
    };
  } else if (pendingCount > 0) {
    palette = {
      bg: 'bg-[#0A1624]',
      border: 'border-sky-900/60',
      hoverBorder: 'hover:border-sky-500',
      text: 'text-sky-300',
      indicator: 'bg-sky-400',
      glow: 'shadow-[0_0_12px_rgba(56,189,248,0.35)]',
      label: 'صف آفلاین',
      badge: `${pendingCount}`,
      icon: AlertTriangle,
    };
  }

  const Icon = palette.icon;
  const isInteractive = Boolean(onManualFlush && !isSyncing && !isLockedOut);

  return (
    <motion.button
      type="button"
      layout
      transition={physicsSpring}
      whileHover={isInteractive ? { scale: 1.02 } : undefined}
      whileTap={isInteractive ? { scale: 0.96 } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isInteractive ? onManualFlush : undefined}
      title={lastError || (isLockedOut ? 'دسترسی ابری تعلیق شده است' : 'کلیک جهت تحریک همگامسازی فوری')}
      className={`relative inline-flex items-center gap-2 h-8 px-3 rounded-lg border backdrop-blur-md transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${palette.bg} ${palette.border} ${isInteractive ? palette.hoverBorder + ' cursor-pointer' : 'cursor-default'} ${className}`}
    >
      <div className="relative flex items-center justify-center w-2.5 h-2.5">
        <span
          className={`absolute w-full h-full rounded-full ${palette.indicator} ${
            isSyncing ? 'animate-ping opacity-75' : 'opacity-20'
          }`}
        />
        <span className={`relative w-2 h-2 rounded-full ${palette.indicator} ${palette.glow}`} />
      </div>

      <motion.div
        animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
        transition={
          isSyncing
            ? { repeat: Infinity, duration: 1.2, ease: 'linear' }
            : physicsSpring
        }
        className="flex items-center justify-center text-current"
      >
        <Icon className={`w-3.5 h-3.5 ${palette.text}`} />
      </motion.div>

      <span className={`text-[11px] font-bold font-['Pinar',sans-serif] tracking-tight ${palette.text}`}>
        {palette.label}
      </span>

      <AnimatePresence mode="popLayout">
        {palette.badge && (
          <motion.span
            key={palette.badge}
            initial={{ opacity: 0, scale: 0.6, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 2 }}
            transition={physicsSpring}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-white/10 text-white/90 border border-white/10 tabular-nums shadow-inner"
          >
            {palette.badge}
          </motion.span>
        )}
      </AnimatePresence>

      {isInteractive && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-lg pointer-events-none bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        />
      )}
    </motion.button>
  );
};
