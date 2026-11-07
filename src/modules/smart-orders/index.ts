/**
 * KarWand Smart Orders - Zero-G Ultra-Low Latency Module
 * Protected behind Feature Flag FEATURES.ENABLE_ZERO_G_SMART_ORDERS
 */

import React from 'react';
import { SmartOrdersContainer, SmartOrdersContainerProps } from './SmartOrdersContainer';
import { FeaturesConfig } from './types';

/**
 * P0-1 (review R5): HARD OFF by default.
 *
 * Zero-G is a prototype working copy of the order flow, not the money path.
 * It must not be reachable in the 100 Hich pilot unless a developer explicitly
 * opts in at build time (`.env`: `VITE_ENABLE_ZERO_G_SMART_ORDERS=true`).
 * The tab is hidden and `App.tsx` falls back to the real `PosView` when off.
 */
const zeroGEnvFlag = (import.meta as any).env?.VITE_ENABLE_ZERO_G_SMART_ORDERS;

export const FEATURES: FeaturesConfig = {
  ENABLE_ZERO_G_SMART_ORDERS: zeroGEnvFlag === 'true',
};

export interface SmartOrdersGateProps extends SmartOrdersContainerProps {
  fallback?: React.ReactNode;
}

/**
 * Feature Flag Isolation Gate:
 * Mounts SmartOrdersContainer if FEATURES.ENABLE_ZERO_G_SMART_ORDERS is true;
 * otherwise renders the fallback view to ensure zero regressions.
 */
export const SmartOrdersGate: React.FC<SmartOrdersGateProps> = ({
  fallback = null,
  ...props
}) => {
  if (!FEATURES.ENABLE_ZERO_G_SMART_ORDERS) {
    return fallback as React.ReactElement | null;
  }
  return React.createElement(SmartOrdersContainer, props);
};

export { SmartOrdersContainer } from './SmartOrdersContainer';
export type { SmartOrdersContainerProps } from './SmartOrdersContainer';
export * from './types';
export * from './utils/farsiFormatting';
export * from './utils/zeroGMotionTokens';
export * from './hooks/useBilingualHotkeys';
export * from './hooks/useSlaCountdown';
export * from './hooks/useOptimisticDispatch';

export default SmartOrdersGate;
