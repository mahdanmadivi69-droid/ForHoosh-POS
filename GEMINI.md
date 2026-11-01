# DESIGN.md Engine Protocol

When asked to generate, clone, or enforce a frontend visual language:

## 1. Context Injection Order
Before generating or reviewing any frontend code (HTML/Tailwind/React/Svelte), verify if a `DESIGN.md` exists in the active workspace.
- If present: Load and strictly enforce its design tokens, padding rules, and constraints.
- If missing: Synthesize a target `DESIGN.md` based on user specification or reference UI before coding.

## 2. Invariant Rules for DESIGN.md Generation
Every synthesized `DESIGN.md` must enforce:
- **Zero Generic Defaults:** Explicit hex colors only; forbid unconfigured stock color palettes.
- **Surface Hierarchy:** 3 distinct background layers (`bg-base: #0B0D11`, `bg-surface-1: #12161D`, `bg-surface-2: #1A222F`, `bg-surface-3: #242E3E`) to guarantee visual depth.
- **Border Strictness:** 1px hairline borders with explicit alpha channels (`rgba(255,255,255,0.08)` on dark modes).
- **Typography Discipline:** Explicit tracking rules (negative letter-spacing on headlines `-0.025em`, neutral on body `0em`, positive on numbers/timers `+0.035em`).
- **Brand Isolation:** Enforce tenant isolation for Modendo Cafe (`tenant-modendo-01`) without contamination from other tenants.

## 3. Output Contract
Always output the complete single-file `DESIGN.md` to disk using standard markdown syntax without conversational packaging.
