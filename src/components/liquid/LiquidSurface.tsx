import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

export interface LiquidSurfaceProps {
  as?: 'div' | 'button' | 'section' | 'article' | 'aside';
  variant?: 'surface' | 'modal' | 'button' | 'node';
  enableSheen?: boolean;
  enableRipple?: boolean;
  enableTilt?: boolean;
  magnetic?: boolean;
  rippleColor?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  role?: string;
  tabIndex?: number;
  id?: string;
  title?: string;
  dir?: string;
  'data-floor-node'?: string;
  'data-station-id'?: string;
  'data-table-id'?: string;
  'data-testid'?: string;
  // Motion overrides
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  whileHover?: any;
  whileTap?: any;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * LiquidSurface: Unified sensory micro-interaction primitive for Modendo Liquid Glass UI.
 * Provides pointer sheen (rAF-throttled), liquid ripple on touch/mouse, micro-tilt (max ±2.5deg),
 * press squish (scale 0.975 + brightness 1.05), and optional magnetic drift (max 4px).
 *
 * Guardrails:
 * - Reduced motion: tilt, ripple, sheen, squish disabled. Simple fades preserved.
 * - Non-hover (touch screens): tilt, sheen, magnetic disabled. Ripple remains active for tactile feedback.
 * - Zero layout thrashing: only transform, opacity, filter animated.
 */
export const LiquidSurface: React.FC<LiquidSurfaceProps> = ({
  as = 'div',
  variant = 'surface',
  enableSheen = true,
  enableRipple = true,
  enableTilt = true,
  magnetic = false,
  rippleColor = 'rgba(110, 231, 183, 0.25)',
  disabled = false,
  className = '',
  style = {},
  children,
  onClick,
  onDoubleClick,
  onPointerDown,
  role,
  tabIndex,
  id,
  title,
  dir,
  'data-floor-node': dataFloorNode,
  'data-station-id': dataStationId,
  'data-table-id': dataTableId,
  'data-testid': dataTestId,
  initial,
  animate,
  exit,
  transition,
  whileHover,
  whileTap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [canHover, setCanHover] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  // Sensory Motion Values
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rawMagX = useMotionValue(0);
  const rawMagY = useMotionValue(0);

  // Calibrated spring physics (Stiffness 380, Damping 26)
  const springRotateX = useSpring(rawRotateX, { stiffness: 380, damping: 26 });
  const springRotateY = useSpring(rawRotateY, { stiffness: 380, damping: 26 });
  const springMagX = useSpring(rawMagX, { stiffness: 400, damping: 28 });
  const springMagY = useSpring(rawMagY, { stiffness: 400, damping: 28 });

  // Environment Capabilities Detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hoverMq = window.matchMedia('(hover: hover)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    setCanHover(hoverMq.matches);
    setPrefersReducedMotion(motionMq.matches);

    const onHoverChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    hoverMq.addEventListener('change', onHoverChange);
    motionMq.addEventListener('change', onMotionChange);

    return () => {
      hoverMq.removeEventListener('change', onHoverChange);
      motionMq.removeEventListener('change', onMotionChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const isModal = variant === 'modal';
  const tiltActive = enableTilt && !isModal && canHover && !prefersReducedMotion && !disabled;
  const magneticActive = magnetic && canHover && !prefersReducedMotion && !disabled;
  const sheenActive = enableSheen && canHover && !prefersReducedMotion && !disabled;
  const rippleActive = enableRipple && !prefersReducedMotion && !disabled;

  // Pointer Move (rAF throttled to prevent layout thrash)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // 1. Pointer sheen coordinates
        if (sheenActive) {
          containerRef.current.style.setProperty('--mx', `${clientX - rect.left}px`);
          containerRef.current.style.setProperty('--my', `${clientY - rect.top}px`);
        }

        // 2. Micro-tilt (max ±2.5deg) & Magnetic Drift (max ±4px)
        if (tiltActive || magneticActive) {
          const px = (clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
          const py = (clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

          if (tiltActive) {
            rawRotateX.set(-py * 5); // ±2.5deg max
            rawRotateY.set(px * 5);  // ±2.5deg max
          }

          if (magneticActive) {
            rawMagX.set(Math.max(-4, Math.min(4, px * 8))); // ±4px max
            rawMagY.set(Math.max(-4, Math.min(4, py * 8))); // ±4px max
          }
        }
      });
    },
    [sheenActive, tiltActive, magneticActive, rawRotateX, rawRotateY, rawMagX, rawMagY]
  );

  const handlePointerEnter = useCallback(() => {
    if (canHover && !prefersReducedMotion && !disabled) {
      setIsHovered(true);
    }
  }, [canHover, prefersReducedMotion, disabled]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    rawRotateX.set(0);
    rawRotateY.set(0);
    rawMagX.set(0);
    rawMagY.set(0);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [rawRotateX, rawRotateY, rawMagX, rawMagY]);

  // Liquid Ripple Trigger (Pointerdown for both mouse & touch)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (!rippleActive || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) * 2;

      const newRipple: Ripple = {
        id: Date.now() + Math.random(),
        x,
        y,
        size,
      };
      setRipples((prev) => [...prev, newRipple]);
    },
    [rippleActive, onPointerDown]
  );

  // Automatic cleanup safeguard for ripples
  useEffect(() => {
    if (ripples.length === 0) return;
    const timer = setTimeout(() => {
      setRipples([]);
    }, 700);
    return () => clearTimeout(timer);
  }, [ripples]);

  // Modal vs Standard Animation Variants
  const computedInitial = isModal
    ? { opacity: 0, scale: 0.98, filter: 'blur(8px)' }
    : initial;
  const computedAnimate = isModal
    ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
    : animate;
  const computedExit = isModal
    ? { opacity: 0, scale: 0.98, filter: 'blur(8px)' }
    : exit;
  const computedTransition = isModal
    ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
    : transition;

  const tapAnimation =
    whileTap ??
    (!disabled && !prefersReducedMotion
      ? {
          scale: 0.975,
          filter: 'brightness(1.05)',
          transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
        }
      : undefined);

  const Component =
    as === 'button'
      ? motion.button
      : as === 'section'
      ? motion.section
      : as === 'article'
      ? motion.article
      : as === 'aside'
      ? motion.aside
      : motion.div;

  return (
    <Component
      ref={containerRef}
      id={id}
      dir={dir}
      title={title}
      role={role}
      tabIndex={tabIndex}
      data-floor-node={dataFloorNode}
      data-station-id={dataStationId}
      data-table-id={dataTableId}
      data-testid={dataTestId}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      initial={computedInitial}
      animate={computedAnimate}
      exit={computedExit}
      transition={computedTransition}
      whileHover={whileHover}
      whileTap={tapAnimation}
      style={{
        ...(tiltActive ? { transformPerspective: 800 } : {}),
        ...(tiltActive ? { rotateX: springRotateX, rotateY: springRotateY } : {}),
        ...(magneticActive ? { x: springMagX, y: springMagY } : {}),
        ...style,
      }}
      className={`relative select-none ${className}`}
    >
      {/* 1. Pointer Sheen: radial gradient moving with cursor on hover */}
      {sheenActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: isHovered ? 1 : 0,
            background:
              'radial-gradient(240px at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.10), transparent 60%)',
          }}
        />
      )}

      {/* 2. Liquid Ripple: spawned on pointerdown (touch + mouse) */}
      {rippleActive && ripples.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden z-25 rounded-[inherit]"
        >
          {ripples.map((r) => (
            <span
              key={r.id}
              className="liquid-ripple-span"
              style={{
                left: r.x - r.size / 2,
                top: r.y - r.size / 2,
                width: r.size,
                height: r.size,
                backgroundColor: rippleColor,
              }}
              onAnimationEnd={() => {
                setRipples((prev) => prev.filter((item) => item.id !== r.id));
              }}
            />
          ))}
        </div>
      )}

      {/* 3. Surface Content */}
      {children}
    </Component>
  );
};
export default LiquidSurface;
