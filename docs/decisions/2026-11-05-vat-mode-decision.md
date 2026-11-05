# SmartOrders — Payment & Order-Flow Model: Decision Memo

**v1.1 · 2026-11-05 · status: awaiting decision on §8 items 1, 3, 4 — §8 item 2 resolved by your call (per-venue VAT setting)**
**Evidence base:** `KarWand Smart Orders`, branch `feature/shared-core-preparation` (7d40229), demo branches `release/100hich-demo` = `release/modendo-demo` = 0547aa3 (identical trees). Read-only inspection + two test suites run.

---

## 1. Recommendation

**Make venue policy the gate, not the venue itself: keep one order lifecycle, express 100 HICH vs. Modendo as presets over that lifecycle, and delete the parallel tab store.** Do it in two steps — a 2–3 day contradiction fix that changes no behavior, then the lifecycle unification after the demo window closes (currently ports 3000/3001 serve live demos).

The reason is not architectural taste. Today the *product* difference between the two venues is already real and worth keeping (pay-now counter vs. settle-on-departure gaming pods). The problem is that it is implemented as **15 string comparisons inside one 799-line component**, while the configuration object that is supposed to describe it is **inert**: 14 of its 15 policy fields are read nowhere outside their own definition file.

**VAT as a per-venue switch is the right shape — with one condition attached.** It is defensible as product design and it unblocks RSK-04 today. It is only safe if the mode *and* the rate are copied onto the order when it is created and onto the shift when it closes. A switch that is read live at report time silently rewrites every closed Z-report the moment someone flips it — which is the same class of defect as §2 row 9, one layer up.

---

## 2. What the code actually does today

| # | Fact | Evidence | Why it matters |
|---|---|---|---|
| 1 | One codebase ships both venues | `release/100hich-demo` and `release/modendo-demo` point at the **same commit**, zero tree diff; only `.env.100hich` / `.env.modendo` differ (`VITE_TENANT_ID`, `PORT`) | The "two builds" cost is already zero. Any per-venue fork would be a deliberate step *backwards*. |
| 2 | Three modes exist: `COUNTER_QUICK_PAY`, `TAB_PAY_LATER`, `DINE_IN_PAY_BY_ORDER` | `src/types/tenant-config.ts:89`, presets at `:112` (100 HICH) and `:182` (Modendo) | Third mode is unused in production but already in the type union and registry. |
| 3 | Venue differences are enforced by string branching, in one file | 15 × `primaryMode === …` in `src/components/CashierCheckoutPage.tsx`; all 18 `tenantConfig.` references in the repo live in that same file | Every new venue adds branches to a 799-line money-path component. |
| 4 | The policy config is dead weight | Outside `tenant-config.ts`, `allowOpenTabs`, `requireImmediatePayment`, `allowHourlySessionBilling`, `supportedModes`, `requireGuestCount`, `allowSplitBill`, `autoReleaseTableOnSettle`, `quickPayPresets`, `autoPrintReceipt`, `defaultBillingMode`, `roundSeparationEnabled`, `requireCustomerPhone`, `allowRegularOpenTab`, `vatTaxPercentage` = **0 readers each** | The declared contract and the executed behavior are two different systems. Reading the config tells you nothing about what the till does. |
| 5 | Only one policy field actually runs | `dineInPolicy.enforcePayLaterByDefault` → 2 uses (`CashierCheckoutPage.tsx:97`, `:369`) | The one live switch decides the default tab action. |
| 6 | The config contradicts itself at 100 HICH | `features.allowOpenTabs: false` (`tenant-config.ts:115`) vs. `takeawayPolicy.allowRegularOpenTab: true` in the same object, and the checkout path sets `flowType = 'TAB_PAY_LATER'` for regulars' takeaway tabs (`CashierCheckoutPage.tsx:226`) | "Counter venue has no open tabs" is false in practice. Because the feature flag is inert, nothing prevents it. **This is a policy decision disguised as a bug.** |
| 7 | Two silent, *different* default venues | Component defaults to `tenantId = 'tenant-modendo-01'` (`:59`); the resolver falls back to `TENANT_CONFIG_100HICH` for unknown tenants | Forget to pass a tenant and you render a gaming lounge under a coffee-roaster's config. No error, no log. |
| 8 | Table label is hardcoded per mode | `:90` — non-counter venues default to a literal "Table 4 (hall)", including PS5 pods (`PS5-1…4`) and the VIP suite | First tab on any PS5 pod reads as a hall table. Wrong ticket, wrong KDS station, wrong receipt. |
| 9 | Two stores can hold the same sale | `openTabService` (localStorage, tenant-scoped `TABLE_TABS`) vs. `OrderDomainService` (order aggregate with `flowType`); importers: 3 files vs. 2 files | A tab round and its order record are separate objects with no single-owner rule. Reconciliation risk sits directly on the settlement path. |
| 10 | The green tests do not cover the branch layer | `operationalModes.test.ts` 32/32 pass, `dualVenueOrdering.test.ts` 60/60 pass — but they import config + domain service, not the checkout component | The suite certifies the contract that isn't executed, and skips the 15 branches that are. |
| 11 | A fourth venue resolver sniffs the store *name* | `LiveReceiptPreview.tsx:34` picks the tenant by `storeProfile.name_en.includes('MODENDO')` | Venue identity is now inferable four ways (env, resolver fallback, component default, brand-name substring). Rename the shop and the receipt changes tenant. |
| 12 | The till's closing numbers ignore the fiscal settings | Receipt uses `fiscalRules.vat_tax_percentage` (`LiveReceiptPreview.tsx:31`, exclusive); Z-report hardcodes `(netSales * 9) / 109` twice (`ShiftCloseoutService.ts:110`, `:640`) with a comment calling it frozen | Rate is configurable where it is *printed* and hardcoded where it is *reported*. Your switch must reach both, or the discrepancy simply becomes adjustable. |

RSK-04 (exclusive vs. inclusive VAT, receipt vs. Z-report) is adjacent and **frozen pending your accounting decision**. It is a dependency for step 2, not for step 1: you cannot unify settlement onto one lifecycle while two tax formulas still exist, or you will rewrite the same code twice.

---

## 3. The decision, stated precisely

> **Where should venue difference live: in the order lifecycle (one machine, flag-driven transitions) or in the UI layer (mode checks, as today)?**

Falsified / overturned if: a third venue needs a flow that cannot be expressed as order states plus flags — e.g. genuinely different settlement arithmetic or a non-order revenue unit. In that case per-venue forks earn their maintenance cost and this recommendation is wrong.

Not the question: whether the venues should *behave* differently. They should. The question is only who is allowed to know that.

---

## 4. Options

### A — Harden the current gating (keep 3 modes, keep branches)
Fix the contradictions in §2 rows 6–8, make the feature flags authoritative, add tests around the 15 branches.

- **Cost:** 2–3 days. No behavior change, no demo risk.
- **Benefit:** Removes the two silent-default and hardcoded-table defects immediately; makes the config object honest.
- **Risk:** Keeps the 799-line component and the dual-store settlement path. Next venue = next set of branches. Does not fix row 9.
- **Verdict:** correct as **step 1**, insufficient as the destination.

### B — One lifecycle, venue as preset (recommended)
`Order` becomes the only record of a sale. Tabs stop being a parallel store and become an order state (`OPEN → AWAITING_SETTLEMENT → SETTLED`), with rounds as line-item batches. Venue config becomes a preset that sets: default tab action, whether immediate payment is required, hourly billing, split-bill, guest count, table requirement, quick-pay presets. `primaryMode` survives as a **label** for UI copy and reporting, never as a branch condition.

- **Cost:** 1–2 weeks of focused work on the money path + a data migration for existing `TABLE_TABS` localStorage records; assumes §8.2's tax setting lands first, because the state machine reads the tax snapshot.
- **Benefit:** One tested state machine instead of 15 untested branches; one place where a sale can be wrong; third venue ≈ a config entry; component-level tests become possible; settlement reconciliation disappears by construction.
- **Risk:** Highest-blast-radius change in the product, on the live-demo codebase. Requires a full regression gate (the existing 92 contract tests are necessary but not sufficient) and a rollback path for tab data.
- **Verdict:** destination.

### C — Fork per venue (two repos or long-lived branches)
- **Cost:** Low today (the releases are already identical), high forever: every fix twice, config divergence, two test suites to keep green.
- **Benefit:** Maximum freedom to tailor each venue fast, no shared-code negotiation.
- **Risk:** Silent divergence on money logic; the VAT question gets answered twice, differently.
- **Verdict:** reject. Nothing in the evidence suggests the venues need different *arithmetic*, only different *defaults*.

| | A | B | C |
|---|---|---|---|
| Time to first safe improvement | 2–3 days | 1–2 weeks (+VAT decision) | ~0 |
| Removes double-booked sale (row 9) | ✗ | ✓ | ✗ |
| Removes silent-venue defaults | ✓ | ✓ | n/a |
| Third venue cost | new branches | config entry | new fork |
| Demo risk | none | medium, gateable | none |

---

## 5. Why B over A as the destination

A leaves the two facts that actually cost money in place: a sale can exist in two stores, and the executed policy is invisible in configuration. Every additional venue multiplies branch surface on the one file where a mistake is a cash discrepancy. B collapses both into a single owner and makes the config object the executed truth by construction.

What would change my mind: if a third venue is signed before the demo window closes (fork pressure), or if the tab data migration proves unverifiable — then ship A now, B after.

---

## 6. Sequencing and guardrails

1. **Step 1 (now, 2–3 days, no behavior change):** kill the two silent defaults (row 7: unknown tenant → explicit error state, no order creation); fix the hardcoded table label (row 8); resolve the 100 HICH open-tab contradiction *by decision*, then encode it in one flag that is actually read (row 6); add a guard test that fails when a config field has no reader.
2. **In parallel (½–1 day):** make the fiscal block real — §8.2. One tenant setting (`vat_mode` + rate), one resolver, snapshot fields on order and shift, owner-only change with audit. This is no longer an accounting ruling; it is a setting with a writer and two readers.
3. **Step 2 (after demos close):** introduce the unified order state machine behind a feature flag; migrate `TABLE_TABS` with a dry-run comparison of totals before cutover; keep the old path one release for rollback. It no longer waits on a VAT decision — it waits on §8.2 landing.
4. **Gate for step 2:** 92 existing contract tests pass, new component-level tests for counter vs. tab flows pass, and a manual settlement replay on migrated data matches to the toman.

Never during step 2: ports 3000/3001, the live venue folders, or the demo branches.

---

## 7. Acceptance criteria

| ID | Criterion | How it is checked |
|---|---|---|
| AC-1 | Zero `primaryMode ===` comparisons outside the resolver/preset module | `rg` count = 0 in review |
| AC-2 | Every field of `TenantOperationalConfig` is either read by production code or deleted | guard test enumerating config keys |
| AC-3 | Unknown/missing tenant cannot create an order; UI shows an explicit state | test asserts refusal + no order written |
| AC-4 | One sale = one record: settling a tab yields exactly one settled order, no duplicate in any second store | test asserts single settled record + totals match |
| AC-5 | PS5 pod and VIP tabs carry their own table identity into ticket, KDS and receipt | test per zone; no literal table fallback |
| AC-6 | Receipt total, cart total and Z-report total agree under **every** enabled tax mode | test both venues × `OFF`/`INCLUSIVE`/`EXCLUSIVE` |
| AC-7 | Flipping the switch changes zero historical orders, receipts, or closed shifts | test: close shift → flip → assert the stored Z-report is byte-identical |
| AC-8 | Mode and rate persist per tenant, not per build | two tenants, one codebase, two settings; test asserts no cross-tenant leak |
| AC-9 | A mode change needs owner role + a reason, is audit-logged, and is refused while a shift is open | RBAC test + audit-entry assertion + refusal path |
| AC-10 | Exactly one fiscal config exists in the codebase | `tenant-config.ts` fiscal block deleted; guard test on config keys |

---

## 8. Decisions only you can make

1. **100 HICH open tabs:** are regulars' takeaway tabs a real product feature at the counter venue, or a leak to close? (Evidence says the code currently allows them while the config says no.) My read: keep them — it is the only reason `requireCustomerPhone/Name` exist — but make it an explicit, single flag.
2. **VAT — resolved by you: a switch per venue in financial settings.** Written as a requirement, because the shape matters more than the switch itself:
   - **Three states, not two.** "On/off" plus a mode: `vat_mode: OFF | INCLUSIVE | EXCLUSIVE`. Off = exempt, no tax line at all, Z-report tax column zero. If you only offered inclusive-vs-exclusive you would have no legal way to express an exempt venue — and you would not be able to switch VAT off at a venue where it is not due.
   - **Where.** The settings surface currently has `general | printers | rbac` (`SettingsView.tsx:52`) and "general" is already labelled *تنظیمات عمومی و مالیات*. Add a real `fiscal` tab rather than burying this in general: tax mode, rate, service charge, pack fee and currency are five fields with money consequences, and tab-level RBAC already exists.
   - **One config, not two.** `vat_mode` + `vat_tax_percentage` live in `FiscalRulesConfig` (`settingsService.ts:93`). Delete the dead `fiscal` block in `tenant-config.ts` in the same pass — two fiscal configs is precisely how RSK-04 happened.
   - **The non-negotiable: snapshot.** Mode and rate are copied onto the order at creation and onto the shift at close. Reports read the snapshot, never the current setting (AC-7).
   - **Change window.** Block the flip while a shift is open, or the Z-report must split and label two tax conventions in one shift. I recommend the block; it costs one line of copy on the settings screen. If Modendo's sessions routinely straddle a shift close, say so and we design the split instead.
   - **Who, and what is recorded.** Owner role only via `RBACService`, mandatory reason, old and new value written to the audit log (AC-9). This is the field a tax inspector asks about.
   - **Label by consequence, not by accounting term.** "VAT inclusive / exclusive" is jargon a cashier will get wrong. One sentence with two numbers, updated live as they switch: *prices include tax — a ۱۰۰,۰۰۰ item prints ۱۰۰,۰۰۰ total (۸,۲۵۷ of it tax)* vs. *tax is added — the same item prints ۱۰۹,۰۰۰*. In exclusive mode the cart total must not differ silently from the menu tile; the tax line appears before payment, at the counter, where the customer can see it.
   - **Residual choice for you:** the default per venue. Modendo (itemised bill, settle on departure) reads naturally as exclusive; 100 HICH counter quick-pay reads as inclusive, because the menu price is what the customer hands over. Confirm or reverse.
3. **Unknown tenant behavior:** refuse to start (safest for money) or fall back to a named venue with a visible banner? I recommend refusal.
4. **Timing:** is the demo window closed enough to start step 2 in the next two weeks, or should we ship step 1 only and revisit?

---

## 9. Facts vs. assumptions, and what I could not measure

**Facts** — everything in §2, with file/line or command evidence; test results run today (32/32, 60/60).

**Assumptions (yours to confirm):**
- The live demos on 3000/3001 must keep serving unchanged during step 1.
- No third venue is contracted.
- Both venues are staffed by a small number of cashiers sharing one tablet each — *this is a guess; it drives how much the row-7/8 defects cost in practice.*
- The tax mode is a **business presentation choice** here, not a legal determination. I am not qualified to rule on Iranian VAT law, and the settings copy should not present the switch as a legal election — hence owner-only access and an audit trail.

**No data (not estimated, not invented):**
- No telemetry exists for mis-tabbed orders, wrong-table tickets, or settlement discrepancies — so the cost of rows 7–9 is unquantified.
- No measurement of cashier time per order at either venue.
- No customer complaint or refund records in the repo.

To size the payoff of step 2, the cheapest useful evidence would be two weeks of tab-vs-counter order counts and any manual reconciliation corrections at close-out. That data does not exist yet; it can be captured from the Z-report flow without new code.

---

## 10. Changelog

| Version | Date | Change | Why |
|---|---|---|---|
| 1.0 | 2026-11-05 | First version: options A/B/C, evidence table, sequencing, AC-1…6 | Requested decision memo on one payment model vs. per-venue gating |
| 1.2 | 2026-11-05 | Corrected the worked example in §8.2: inclusive tax on a ۱۰۰,۰۰۰ gross at 9% is **۸,۲۵۷**, not ۹,۱۷۴ | Arithmetic error in v1.1; the wrong figure would have gone into the settings copy and the unit tests |
