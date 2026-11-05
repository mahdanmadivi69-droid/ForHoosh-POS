# VAT Mode Per Venue — Implementation Task List

**v1.0 · 2026-11-05 · derived from decision memo v1.2 §8.2, AC-6…AC-10**
**Repo:** `C:\Users\mahda\OneDrive\Documenti\KarWand Smart Orders` · base branch `feature/shared-core-preparation` (7d40229)
**Total effort:** ~4.75 dev-days + 1 QA-day · **blocked on:** two answers in §7

---

## 0. The contract — everyone codes against this first

### 0.1 Types

```ts
// src/types/rbac-settings.ts:115
export type VatMode = 'OFF' | 'INCLUSIVE' | 'EXCLUSIVE';

export interface FiscalRulesConfig {
  vat_mode: VatMode;              // NEW. Absent in stored settings ⇒ 'EXCLUSIVE' (see T4)
  vat_tax_percentage: number;     // 9.0 — unchanged field, now actually read everywhere
  dine_in_service_charge_percentage: number;
  takeaway_pack_fee_fixed: number;
  currency_display: 'TOMAN' | 'IRR' | 'USD';
}
```

Snapshot fields (additive, optional at read — see T2/T3):

```ts
// src/types/order-domain.ts:57 OrderAggregate
vatModeSnapshot?: VatMode;   // absent = pre-tax-record order (legacy), never back-filled
vatRatePctSnapshot?: number;
vatAmountToman?: number;

// shift record (storage.ts:1910 openShift / ShiftCloseoutService)
vatModeSnapshot: VatMode;
vatRatePctSnapshot: number;
vatTotalToman: number;       // replaces the hardcoded math at ShiftCloseoutService.ts:110 and :640
```

### 0.2 One resolver — the only place tax math may live

```ts
// src/services/taxService.ts  (new, ~80 lines, no React, no storage access)
export interface TaxBreakdown {
  mode: VatMode; ratePct: number;
  netToman: number; vatToman: number; totalToman: number;
}
export function assertToman(v: number, label: string): number; // integer, finite, >= 0, else throw
export function computeTax(menuSubtotalToman: number, mode: VatMode, ratePct: number): TaxBreakdown;
export function resolveActiveTax(tenantId?: string): { mode: VatMode; ratePct: number };
```

**Semantics** (input = the number the cashier sees on the menu tile):

| Mode | net | vat | total |
|---|---|---|---|
| `INCLUSIVE` | `round(subtotal × 100 / (100 + r))` | `subtotal − net` | `subtotal` |
| `EXCLUSIVE` | `subtotal` | `round(subtotal × r / 100)` | `net + vat` |
| `OFF` | `subtotal` | `0` | `subtotal` |

**Invariants to enforce in code and assert in tests:** `net + vat === total`, all three are `Number.isInteger`, `vat >= 0`. Inclusive mode computes **net first** so the sum closes exactly — do not compute vat and subtract.

Worked values at r = 9: `INCLUSIVE` 100,000 → net 91,743 / vat 8,257 / total 100,000. `EXCLUSIVE` 100,000 → 100,000 / 9,000 / 109,000. `OFF` 100,000 → 100,000 / 0 / 100,000.

> **Trap:** `toToman()` (`order-domain.ts`, below line 100) clamps NaN and negatives to `0` and rounds silently. Do **not** route tax inputs through it — a negative or fractional subtotal must throw, not become zero. Use `assertToman`.

---

## 1. Tasks in order

| # | Task | Owner | Effort | Depends on |
|---|---|---|---|---|
| T1 | `VatMode` type + `taxService.ts` + unit tests | Full-Stack | 0.5 d | — |
| T2 | Order snapshot at creation + checkout total display | Full-Stack | 0.5 d | T1 |
| T3 | Shift snapshot at open, close reads it, legacy backfill | Full-Stack | 0.5 d | T1 |
| T4 | Settings: new `fiscal` tab, save path, default migration rule | Full-Stack | 1 d | T1, T5 |
| T5 | RBAC guard + audit entry + mid-shift refusal | Full-Stack | 0.25 d | T1 |
| T6 | Receipt through resolver; delete name-sniffing tenant resolver | Full-Stack | 0.5 d | T1, T2 |
| T7 | Z-report + CSV render the snapshot, not the live setting | Full-Stack | 0.5 d | T3 |
| T8 | Delete dead fiscal block in `tenant-config.ts` + guard test | Full-Stack | 0.25 d | T4 |
| T9 | QA matrix (§3), 100% critical pass | QA | 1 d | T1–T8 |
| T10 | Review gate + clean build | Reviewer / DevOps | 0.25 d | T9 |

### T1 — Tax service
**Files:** new `src/services/taxService.ts`; `src/types/rbac-settings.ts`.
**Change:** the three exports above, pure functions, no I/O. `resolveActiveTax` reads the tenant's `FiscalRulesConfig` through `SettingsService.loadSettings(tenantId)` and returns `{ mode: 'EXCLUSIVE', ratePct: 9 }` when the stored object has no `vat_mode`.
**Done when:** `npm run check` green; unit tests cover the three modes, r = 0, r = 100, and the closure invariant on 10k generated values.

### T2 — Order snapshot
**Files:** `src/services/orderService.ts:54` (`createOrder`), `src/services/storage.ts` `createOrder`, `src/types/order-domain.ts:57`, `src/components/CashierCheckoutPage.tsx`.
**Change:** compute the breakdown once at creation via `computeTax(itemsSubtotal, mode, rate)`; write `vatModeSnapshot`, `vatRatePctSnapshot`, `vatAmountToman`; set `netTotalToman`/`grossAmountToman` from the same breakdown so there is exactly one source. In `EXCLUSIVE` mode the cart must show a tax line **before** payment (memo §8.2 display rule) — never let the total differ silently from the menu tile.
**Done when:** a created order's stored fields satisfy the closure invariant for all three modes; no caller computes tax itself.

### T3 — Shift snapshot
**Files:** `src/services/storage.ts:1910` `openShift`, `:1945` `closeShift`, `src/services/ShiftCloseoutService.ts:110`, `:640`, `:586` (comment).
**Change:** write `vatModeSnapshot` + `vatRatePctSnapshot` at **open**; close computes `vatTotalToman` from those fields and stores it. Replace both hardcoded `(netSales * 9) / 109` sites. Legacy: shifts already closed get `INCLUSIVE` / 9 backfilled, because that is the math they actually ran — their stored `vatTotalToman` is **not** recomputed. Orders created before this change keep `vatModeSnapshot = undefined` (render no tax line; do not invent history).
**Done when:** closing a shift under each mode produces a stored total equal to the sum of its orders' `vatAmountToman`.

### T4 — Settings tab
**Files:** `src/views/settings/SettingsView.tsx:52` (`SettingsTab` union + sidebar), new `src/views/settings/SettingsFiscal.tsx`, `src/views/settings/SettingsGeneral.tsx` (remove the tax input block), `src/services/settingsService.ts:93` and `:274` (`saveSettings` already tenant-scoped).
**Change:** add `'fiscal'` to the tab union and a sidebar entry; move VAT (switch + mode + rate), service charge, pack fee and currency into it. Three controls, not two: a switch (`OFF` vs on) and, when on, a two-option mode. Copy states the consequence with live numbers from `computeTax` — e.g. *prices include tax: a ۱۰۰,۰۰۰ item prints ۱۰۰,۰۰۰ (۸,۲۵۷ tax inside)* / *tax is added: the same item prints ۱۰۹,۰۰۰*.
**Done when:** a saved change survives reload **per tenant** (`VITE_TENANT_ID` switch), and the other venue's settings are untouched.

### T5 — Authority and audit
**Files:** `src/services/RBACService.ts`, settings save path, `src/types/domain.ts:154` `AuditLog`.
**Change:** only `OWNER` (and `ACCOUNTANT` if you want an accounting role to flip it — say so) may change `vat_mode`; the save requires a non-empty reason; write one audit row with `action: 'FISCAL_VAT_MODE_CHANGED'`, `details` carrying old mode, new mode, rate, reason. Refuse the save while a shift is open, with a message naming the shift.
**Done when:** `CASHIER` is refused, a missing reason is refused, an open shift is refused, and the successful path leaves exactly one audit row.

### T6 — Receipt
**Files:** `src/components/LiveReceiptPreview.tsx:31`, `:34`.
**Change:** replace `Math.round((subtotal * fiscalRules.vat_tax_percentage) / 100)` and the `+ vat` total with `computeTax(...)` on the order's **snapshot** (fallback to active settings only for previews of uncreated drafts). Delete the `storeProfile.name_en.includes('MODENDO')` tenant inference — take `tenantId` from the order/config, not from the shop's name.
**Done when:** the receipt line reads *ارزش افزوده* with the snapshot rate, total equals the order's stored total, and renaming the store profile changes nothing.

### T7 — Z-report
**Files:** `src/components/modals/ZReportModal.tsx`, the CSV export path, `ShiftCloseoutService` output.
**Change:** every tax figure comes from the shift snapshot; label the column with the mode actually used. No live read of `FiscalRulesConfig` anywhere in reporting.
**Done when:** flipping the setting does not change a closed shift's report by one toman (AC-7), and CSV matches the modal.

### T8 — One fiscal config
**Files:** `src/types/tenant-config.ts` (`fiscal` block, `vatTaxPercentage`), plus any residual reader.
**Change:** delete the dead block; add a guard test asserting no second source of truth for `vat` exists outside `FiscalRulesConfig`.
**Done when:** AC-10 passes and grep for `vatTaxPercentage` returns nothing.

---

## 2. Ordering and rollback

Day 1 → T1, T2 · Day 2 → T3, T5 · Day 3 → T4 · Day 4 → T6, T7, T8 · Day 5 → T9, T10.

- Branch `feature/fiscal-vat-mode` off `feature/shared-core-preparation`. **Never** touch `release/100hich-demo`, `release/modendo-demo`, the OneDrive live install, or ports 3000/3001.
- Behind `VITE_FISCAL_MODE_ENABLED` (default **off**): when off, receipt and Z-report keep today's formulas, so the demo builds are unaffected. Removal of the flag is the release after.
- No destructive migration: snapshot fields are optional; legacy rows stay legacy and are labelled, never rewritten.
- Every task handoff requires `npm run check` (lint + both suites) and `npm run build` output pasted into the handoff note.

---

## 3. QA matrix (T9)

Critical rows must be 100% green before review — team Definition of Done.

| # | Scenario | Expected | AC |
|---|---|---|---|
| 1 | INCLUSIVE, 100,000 @9 | 91,743 / 8,257 / 100,000 | AC-6 |
| 2 | EXCLUSIVE, 100,000 @9 | 100,000 / 9,000 / 109,000 | AC-6 |
| 3 | OFF, 100,000 | 100,000 / 0 / 100,000 | AC-6 |
| 4 | Property: 10k subtotals 1…2,000,000 × 3 modes | integers, `net+vat===total`, `vat>=0` | AC-6 |
| 5 | Rate 0 in INCLUSIVE / rate 100 in INCLUSIVE | no divide-by-zero; net halved at 100 | AC-6 |
| 6 | Fractional or negative subtotal | throws via `assertToman` (does **not** clamp to 0) | AC-6 |
| 7 | Receipt total = cart total = Z-report total, every mode × both tenants | exact match | AC-6 |
| 8 | Close shift → flip mode → reopen report | stored report byte-identical | AC-7 |
| 9 | Flip on 100 HICH | Modendo setting and report unchanged | AC-8 |
| 10 | Flip while a shift is open | refused, message names the shift, no audit row | AC-9 |
| 11 | `CASHIER` attempts flip / blank reason | refused on both counts | AC-9 |
| 12 | `OWNER` flips with reason | one audit row: old, new, rate, reason, user | AC-9 |
| 13 | Legacy closed shift | labelled INCLUSIVE/9, stored total untouched | AC-7 |
| 14 | Legacy order (no snapshot) | receipt renders no tax line, no crash | AC-7 |
| 15 | Rename `store_profile` to an unrelated string | tenant resolution unchanged (name-sniffing gone) | §2 row 11 |
| 16 | Guard: no second fiscal config | `vatTaxPercentage` absent from src | AC-10 |

---

## 4. Handoff blocks

**→ Full-Stack / Feature Engineer (96eb1df0-a0a4-4be2-a25c-af2ad0426ad9)**
Execute T1–T8 in order on `feature/fiscal-vat-mode`. Treat §0 as frozen contract: if a signature must change, stop and report rather than diverging. Each task ends with `npm run check` + `npm run build` evidence and a commit named `feat(fiscal): T<n> <summary>`. Do not modify the demo branches, `server.ts` auth, or any live-venue folder.

**→ QA & Test Automation Specialist (d563cb06-6226-4d8c-aa45-b889020755bb)**
Build §3 as an executable suite (extend `tests/`, follow `tests/financialMath.test.ts` style). Rows 1–12, 14, 16 are critical: 100% pass required. Report failures as a table with row id, expected, actual, and the file:line of the failing assertion. Do not fix code yourself.

**→ Code Reviewer (a63468e1-a3ca-4269-9371-0a009162088b)**
Check: one tax computation path (§0.2), no live setting read in reporting (T7), snapshot fields never written after creation, RBAC gate unreachable from the client alone, audit row content (T5), integer invariants, and that the legacy labels cannot be produced by new code. Verdict format: APPROVE / REJECT with file:line evidence.

---

## 5. Blocking questions (answered before T4 starts, not before T1)

1. **Default mode per venue:** Modendo `EXCLUSIVE`, 100 HICH `INCLUSIVE` (memo §8.2 recommendation) — confirm or reverse.
2. **May `ACCOUNTANT` flip the mode, or `OWNER` only?**
3. **Do Modendo sessions straddle a shift close?** If yes, T5's refusal must become a split-Z-report design, which adds ~1 day and changes AC-9.

---

## 6. Changelog

| Version | Date | Change | Why |
|---|---|---|---|
| 1.0 | 2026-11-05 | First task list: contract, T1–T10, QA matrix, handoff blocks | Requested implementation breakdown of memo §8.2 |
