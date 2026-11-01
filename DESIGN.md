# DESIGN.md — Modendo POS (v6.3) Design System & Visual Specification

**Venue Identity:** کافه بردگیم و گیمینگ مودندو (Modendo Boardgame & Gaming Cafe)  
**Tenant ID:** `tenant-modendo-01`  
**Philosophy:** Zero-G Dark Minimalism — Weightless, high-contrast, tactile spring physics, and micro-precision.

---

## ۱. Surface Hierarchy & Depth Tokens (Zero Generic Defaults)

All colors are strictly defined hex codes or explicit alpha channels. Stock generic Tailwind utilities (e.g., bare `bg-gray-500` or `text-gray-400`) are strictly forbidden.

| Layer Token | Hex Value | Semantic Purpose |
| :--- | :---: | :--- |
| `bg-base` | `#0B0D11` | Root canvas ground, deep background. |
| `bg-surface-1` | `#12161D` | Elevation 1: Sidebars, modals, HUD control bars, canvas toolbars. |
| `bg-surface-2` | `#1A222F` | Elevation 2: Table nodes, order cards, menu items, interactive inputs. |
| `bg-surface-3` | `#242E3E` | Elevation 3: Hover states, active tab pills, popover dropdowns. |

### Hairline Borders & Dividers
* `border-subtle`: `rgba(255, 255, 255, 0.08)` (1px hairline on dark panels).
* `border-grid`: `#27313F` (10px canvas magnetic snap grid lines).
* `border-accent-ps5`: `rgba(59, 130, 246, 0.5)` (Neon blue aura for gaming pods).
* `border-accent-lounge`: `rgba(5, 150, 105, 0.6)` (Emerald velvet border for lounge zone).

---

## ۲. Spatial Zoning & State Color Registry

| Entity / State | Primary Hex | Highlight Hex | Semantic Meaning |
| :--- | :---: | :---: | :--- |
| **PS5 Gaming Pods** | `#3B82F6` | `#60A5FA` | 4 units in Level 0 with live hourly timer (`HH:MM:SS`). |
| **Lounge Sofas** | `#059669` | `#10B981` | U-shaped velvet lounge in Level 0 (Token-based billing). |
| **Boardgame Tables** | `#B45309` | `#D97706` | Tables M-01 to M-04 and M-Side in Level 1 (Hourly entry fee). |
| **Terrace Outdoor** | `#78350F` | `#92400E` | Tables T-01 to T-05 in Level 1 (Open-air / smoking allowed). |
| **Bar & Counter** | `#E11D48` | `#F43F5E` | Counter BAR-01 and Barista prep station. |
| **State: AVAILABLE** | `#10B981` | `#34D399` | Green indicator; ready for customer seating. |
| **State: OCCUPIED** | `#EF4444` | `#F87171` | Crimson indicator; open tab exists. |
| **State: GAMING_ACTIVE** | `#3B82F6` | `#93C5FD` | Neon blue halo; timer ticking for console or boardgame. |
| **State: AWAITING_BILL** | `#F59E0B` | `#FBBF24` | Amber indicator; pre-invoice issued, awaiting checkout. |

---

## ۳. Typography Discipline

* **Primary Body & Interface:** `Vazirmatn`, -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif.
* **Numeric, Currencies & Timers:** Monospace (`font-mono`: JetBrains Mono, SF Mono, Menlo, Consolas).
* **Tracking Rules:**
  * **Display & Section Titles:** `letter-spacing: -0.025em` to `-0.035em` (Tight, assertive headings).
  * **Body Prose & Button Labels:** `letter-spacing: 0em` (Neutral, natural legibility).
  * **Numbers, Timers & Amounts:** `letter-spacing: +0.035em` (High-clarity digit separation).
* **Font Size Floor:** Minimum `12px` (`text-xs`) across all interactive components to ensure touch usability.

---

## ۴. Motion & Tactile Spring Physics (Zero-G Spec)

All animations and interactions must adhere to Zero-G GPU-only transforms (`transform: translate3d/scale`, `opacity`).

```typescript
export const ZeroGMotionTokens = {
  // Tactile click / tap feedback
  tactileTap: {
    scale: 0.97,
    transition: { type: 'spring', stiffness: 500, damping: 30 }
  },
  // Modal / Drawer entrance
  drawerEnter: {
    duration: 0.24,
    ease: [0.16, 1, 0.3, 1]
  },
  // Modal / Drawer exit
  drawerExit: {
    duration: 0.18,
    ease: [0.7, 0, 0.84, 0]
  },
  // Reduced motion accessible fallback
  reducedLinear: {
    duration: 0.1,
    ease: 'linear'
  }
};
```

---

## ۵. Audio Feedback Tokens (Web Audio API)

* **Tap Beep:** Sine oscillator @ `800Hz` for `35ms`, exponential gain decay.
* **Success Chime:** Harmonic chord `[587Hz (D5), 880Hz (A5)]` for `150ms`.
* **Void / Alert Tone:** Sawtooth oscillator @ `220Hz` for `180ms`.

---

## ۶. Rules of Enforcement

1. **Multi-Tenant Segregation:** All components must display Modendo identity (`tenant-modendo-01`) and never contaminate or reference 100 Hich.
2. **ESC/POS Ticket Headers:** Tickets printed to LAN printers (`192.168.1.101:9100` for Bar, `192.168.1.102:9100` for Kitchen) must carry `MODENDO CAFE` header.
3. **Magnetic Canvas Coordinates:** All floor plan elements snap to 10px magnetic grid (`Math.round(val / 10) * 10`).
