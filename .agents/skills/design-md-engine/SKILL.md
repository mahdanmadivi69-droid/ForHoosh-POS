---
name: design-md-engine
description: Ingests existing URLs or UI screenshots, extracts design systems, and synthesizes a local, production-grade DESIGN.md file to constrain frontend code generation.
enabled: true
---

# DESIGN.md Engine Protocol

When asked to generate, clone, or enforce a frontend visual language:

## 1. Context Injection Order
Before generating or reviewing any frontend code (HTML/Tailwind/React/Svelte), verify if a `DESIGN.md` exists in the active workspace.
- If present: Load and strictly enforce its design tokens, padding rules, and constraints.
- If missing: Synthesize a target `DESIGN.md` based on user specification or reference UI before coding.

## 2. Invariant Rules for DESIGN.md Generation
Every synthesized `DESIGN.md` must enforce:
- **Zero Generic Defaults:** Explicit hex colors only; forbid unconfigured stock color palettes.
- **Surface Hierarchy:** 3 distinct background layers (`bg-base`, `bg-surface-1`, `bg-surface-2`, `bg-surface-3`) to guarantee visual depth.
- **Border Strictness:** 1px hairline borders with explicit alpha channels (`rgba(255,255,255,0.08)` on dark modes).
- **Typography Discipline:** Explicit tracking rules (negative letter-spacing on headlines, neutral/positive on body/mono).

## 3. Output Contract
Always output the complete single-file `DESIGN.md` to disk using standard markdown syntax without conversational packaging.
