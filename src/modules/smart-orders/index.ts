/**
 * KarWand Smart Orders - Zero-G Ultra-Low Latency Module
 * Protected behind Feature Flag FEATURES.ENABLE_ZERO_G_SMART_ORDERS
 */

import React from 'react';
import { SmartOrdersContainer, SmartOrdersContainerProps } from './SmartOrdersContainer';
import { FeaturesConfig } from './types';

export const FEATURES: FeaturesConfig = {
  ENABLE_ZERO_G_SMART_ORDERS: true,
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
export { CafeOSTerminalCore } from './components/CafeOSTerminalCore';
export type { CafeOSTerminalCoreProps } from './components/CafeOSTerminalCore';
export * from './types';
export * from './utils/farsiFormatting';
export * from './utils/zeroGMotionTokens';
export * from './hooks/useBilingualHotkeys';
export * from './hooks/useSlaCountdown';
export * from './hooks/useOptimisticDispatch';

export default SmartOrdersGate;
