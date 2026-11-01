/**
 * AntiGravity Physics Profiles for CafeOS & Zero-G Ultra-Low Latency UI
 * Includes exact spring curves, decelerated drawers, and prefers-reduced-motion fallback
 * Compliant with Zero-G UI/UX Architecture & Fluid Motion Standards
 */

export const ZERO_G_COLORS = {
  void: '#07090E',
  canvas: '#121417',
  surface: 'rgba(15, 23, 42, 0.75)',
  surfaceElevated: '#0F223D',
  surfaceCard: '#1B222C',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.18)',
  borderActive: 'rgba(215, 25, 33, 0.45)',
  accentCrimson: '#D71921',
  accentEmerald: '#10B981',
  accentAmber: '#F59E0B',
  accentCyan: '#38BDF8',
  accentPs5Blue: '#3B82F6',
} as const;

export const ZERO_G_PHYSICS = {
  // Spring profiles
  buoyant: { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.8 },
  micro: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.6 },
  drawer: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 },

  // Easing profiles
  reveal: [0.16, 1, 0.3, 1] as [number, number, number, number],
  dismiss: [0.7, 0, 0.84, 0] as [number, number, number, number],

  // Durations (seconds)
  duration: {
    micro: 0.16,
    surface: 0.24,
    staggerInterval: 0.02,
    reduced: 0.10,
  },
} as const;

export const MotionConfig = {
  // Micro-interactions (Card click, Counter adjust, Category switch)
  tactileTap: {
    scale: 0.97,
    transition: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.6 }
  },

  // Modifier Drawer / Modals (Decelerated Enter, Instant Exit)
  drawerEnter: {
    x: 0,
    opacity: 1,
    transition: { ease: [0.16, 1, 0.3, 1] as [number, number, number, number], duration: 0.24 }
  },
  drawerExit: {
    x: '100%',
    opacity: 0,
    transition: { ease: [0.7, 0, 0.84, 0] as [number, number, number, number], duration: 0.18 }
  },

  // Staggered Item Ledger Additions
  ticketItemSpring: {
    type: 'spring' as const,
    stiffness: 420,
    damping: 32,
    mass: 0.7
  }
};

export const ZERO_G_MOTION = {
  // Ultra-crisp tactile spring for cards and injectors mapped to MotionConfig.tactileTap
  springSnap: {
    type: 'spring' as const,
    stiffness: MotionConfig.tactileTap.transition.stiffness,
    damping: MotionConfig.tactileTap.transition.damping,
    mass: MotionConfig.tactileTap.transition.mass,
  },
  
  // Smooth slide curve for drawer & flyouts mapped to MotionConfig.drawerEnter
  springDrawer: {
    type: 'spring' as const,
    stiffness: MotionConfig.ticketItemSpring.stiffness,
    damping: MotionConfig.ticketItemSpring.damping,
    mass: MotionConfig.ticketItemSpring.mass,
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

  // Motion variants for cascade lists
  cascadeContainer: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02,
      },
    },
  },

  cascadeItem: {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 },
    },
  },
};

/**
 * Checks if the user or OS environment prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
