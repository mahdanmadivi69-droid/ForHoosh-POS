# REMAINING RISKS & PHASE 2 ROADMAP

**Project:** 100 HICH Coffee Roasters × Modendo Cafe  
**Phase:** Phase 1 Completed -> Phase 2 Transition Assessment  
**Date:** November 1, 2026  
**Status:** **PHASE 1 SCOPE FULLY REMEDIATED — REMAINING NON-ISOLATION RISKS CATALOGED**  

---

## 1. Risk Register Status Post-Phase 1

| Risk ID | Initial Severity | Category | Risk Description | Phase 1 Status | Remaining Risk / Phase 2 Action |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **RSK-01** | **CRITICAL** | Data Isolation | Un-scoped BOM inventory storage keys cross-deplete stocks across cafes. | **RESOLVED & VERIFIED** | None. Fully isolated and verified by 42 automated tests. |
| **RSK-02** | **CRITICAL** | Data Isolation | Open table tabs storage keys lack tenant prefix; line 339 hardcodes tenant-100hich-01. | **RESOLVED & VERIFIED** | None. Fully isolated and verified by 39 automated tests. |
| **RSK-03** | **CRITICAL** | Security / Data | Global Barista BroadcastChannel broadcasts order tickets across all open cafe tabs. | **RESOLVED & VERIFIED** | None. Fully scoped and verified by 20 automated tests. |
| **RSK-04** | **HIGH** | Accounting | Contradictory Value-Added Tax (VAT) calculations (Exclusive on Receipt Preview vs Inclusive on Shift Z-Report). | **FROZEN (BLOCKED)** | **Awaiting human policy approval.** Do not touch until leadership formally approves Tax-Inclusive vs Tax-Exclusive standard. |
| **RSK-05** | **HIGH** | Brand Isolation | 100 HICH brand colors (`#0F223D`, `#D71921`) hardcoded into shared shell components (`Header.tsx`, `App.tsx`). | **PENDING PHASE 2** | Outside Phase 1 data isolation scope. Requires Phase 2 theme token abstraction. |
| **RSK-06** | **HIGH** | Development | TypeScript compilation error in cloud backup workstream (`tests/cloudBackupSync.test.ts:166`). | **REPORTED SEPARATELY** | In uncommitted cloud backup stream; preserved untouched. Requires fix in cloud backup branch. |
| **RSK-07** | **HIGH** | Development | Unsafe development environment (dirty branch, lack of isolated worktrees). | **RESOLVED IN WORKTREE** | Dedicated worktree `fix/dual-tenant-isolation` established. Main repo remains dirty until cloud backup is committed. |
| **RSK-08** | **MEDIUM** | Hardware | Python thermal printer gateway (`backend/printer_gateway.py`) hardcodes MODENDO CAFE header into binary ESC/POS dispatch. | **PENDING PHASE 2** | Parameterize receipt header from incoming POS dispatch payload. |
| **RSK-09** | **MEDIUM** | Financial | Split-check ceiling division leaves rounding remainder overage (+2 Toman on 100k split by 3). | **FROZEN** | Accounting freeze. Allocate rounding remainder to final split payment share in Phase 2. |
| **RSK-10** | **LOW** | Code Hygiene | 2,472-line god-file `storage.ts` entangles all domain models, catalog seeds, and tenant loaders. | **PENDING PHASE 2** | Decompose into modular tenant adapters and seed data files. |

---

## 2. Detailed Technical Analysis of Remaining Risks

### 2.1 Risk RSK-04: Contradictory Value-Added Tax (VAT) Logic [CRITICAL ACCOUNTING RISK]
* **Location:** `LiveReceiptPreview.tsx` (Line 31) vs `ShiftCloseoutService.ts` (Line 84).
* **The Contradiction:**
  1. `LiveReceiptPreview.tsx` computes tax **EXCLUSIVELY**:
     `vatAmount = Math.round((subtotal * 9) / 100)`
     `total = subtotal + vatAmount`
  2. `ShiftCloseoutService.ts` computes tax **INCLUSIVELY**:
     `vatTotal = Math.round((netSales * 9) / 109)`
  3. `order-domain.ts` has no VAT field on `OrderAggregate`.
* **Current Status:** In Phase 1, accounting rules were placed under a **STRICT FREEZE**. No tax formulas were modified.
* **Human Action Required:** Leadership must formally approve standardizing all modules on Iranian Tax-Inclusive pricing (`Net * 9 / 109`).

### 2.2 Risk RSK-05: Brand Theme Entanglement in Application Shell
* **Location:** `src/components/Header.tsx` and `src/App.tsx`.
* **Issue:** 100 HICH Cobalt Navy (`#0F223D`) and Crimson Red (`#D71921`) are hardcoded into background colors and active tab navigation states.
* **Current Status:** Not modified in Phase 1 per strict instructions prohibiting UI redesigns.
* **Phase 2 Remedy:** Extract brand tokens into dynamic CSS variables (`--color-brand-primary`, `--color-brand-header`) bound to active tenant context.

### 2.3 Risk RSK-06: TypeScript Error in Cloud Backup Workstream
* **Location:** `tests/cloudBackupSync.test.ts:166`.
* **Issue:** `Property 'orderId' does not exist in type 'OrderItemAggregate'`.
* **Current Status:** Cleanly isolated on `feature/shared-core-preparation` (commit `0547aa3`) and verified in external backup. Worktree `fix/dual-tenant-isolation` compiles with 0 errors.

---

## 3. Recommended Phase 2 Execution Plan

Once Phase 1 has undergone human review and formal sign-off:

1. **Task 201 (Accounting Alignment):** Following human approval, harmonize VAT formulas in `LiveReceiptPreview.tsx` and `ShiftCloseoutService.ts` to Tax-Inclusive (`amount * 9 / 109`), and add `vatAmountToman` to the `Order` entity.
2. **Task 202 (Theme Token Abstraction):** Decouple `Header.tsx` and `App.tsx` styling by injecting brand CSS tokens.
3. **Task 203 (Storage Decomposition):** Decompose the 2,472-line `storage.ts` god-file into `services/storage/` modules (`tenantStorageAdapter.ts`, `catalogSeeds.ts`, `orderStorage.ts`).
4. **Task 204 (Hardware Gateway Decoupling):** Parameterize `backend/printer_gateway.py` binary receipt headers from incoming POS payloads.
5. **Task 205 (Cloud Backup Integration):** Resolve the type mismatch in `tests/cloudBackupSync.test.ts:166` and merge the cloud backup workstream into main.
