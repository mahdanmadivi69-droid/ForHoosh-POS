/**
 * KarWand Smart Orders - Zero-G Ultra-Low Latency Module
 * Protected behind Feature Flag FEATURES.ENABLE_ZERO_G_SMART_ORDERS
 */

import { FeaturesConfig } from './types';

export const FEATURES: FeaturesConfig = {
  ENABLE_ZERO_G_SMART_ORDERS: true,
};

export { SmartOrdersContainer } from './SmartOrdersContainer';
export type { SmartOrdersContainerProps } from './SmartOrdersContainer';
export * from './types';
export * from './utils/farsiFormatting';
export * from './utils/zeroGMotionTokens';
export * from './hooks/useBilingualHotkeys';
export * from './hooks/useSlaCountdown';
export * from './hooks/useOptimisticDispatch';
