/**
 * Zero-G Ultra-Low Latency UI Motion Tokens
 * Includes spring curves and safe fallback for prefers-reduced-motion
 */

export const ZERO_G_MOTION = {
  // Ultra-crisp tactile spring for cards and injectors
  springSnap: {
    type: 'spring' as const,
    stiffness: 550,
    damping: 35,
    mass: 0.8,
  },
  
  // Smooth slide curve for drawer & flyouts
  springDrawer: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 38,
  },

  // Instant transitions (<120ms) for reduced-motion users
  reducedLinear: {
    duration: 0.1,
    ease: 'linear' as const,
  },

  // Micro-flash pulse keyframes for socket pushed tickets (#D71921)
  flashPulse: {
    borderColor: ['rgba(215, 25, 33, 1)', 'rgba(215, 25, 33, 0.2)', 'rgba(41, 52, 68, 1)'],
    boxShadow: [
      '0 0 25px rgba(215, 25, 33, 0.7)',
      '0 0 10px rgba(215, 25, 33, 0.3)',
      '0 0 0px rgba(0, 0, 0, 0)',
    ],
    transition: { duration: 1.2, ease: 'easeOut' },
  },
};

/**
 * Checks if the user or OS environment prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
