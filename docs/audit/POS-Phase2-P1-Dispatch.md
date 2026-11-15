# POS Phase 2 — P1 Security & Cleanup · Dispatch Order

**Issuer:** CEO / Lead · **Date:** 2026-11-07
**Target repo:** `reviews/ForHoosh-POS` · **Branch:** `fix/p0-financial-leaks` (HEAD `853a53a`)
**Rule:** one commit per item, `git diff --stat` reported per commit. No new features. Zero-G stays hard-off — do not touch it.
**Gate after every commit:** `npm run lint` (exit 0) · `npm test` (65 passed, 0 failed) · `npm run build` (exit 0).

Phase 1 is certified at `POS-Phase1-Gate-Certification.md`. Phase 2 is **security + cleanup only**. Nothing here is allowed to change money math, order state machine, or the Dexie mirror.

---

## P1-1 — Kill plaintext credentials and one-click login
**Anchors:** `src/services/storage.ts:46-87` (`DEFAULT_USERS`), `:1219` (`login`), `:1771-1776` (restore fallback) · `src/components/LoginView.tsx:32-47` (`handleLogin`), `:49-66` (`handleQuickSelect`) · `RUN_100HICH.bat` lines echoing `admin / sara / nima | رمز: 123`

**Do:**
1. New `src/services/credentials.ts`:
   - `SecureCredential = { v: 1; algo: 'PBKDF2-SHA256'; iter: 120000; salt: string; hash: string }` (base64).
   - `hashPassword(pw, salt?)` and `verifyPassword(pw, rec)` via WebCrypto `crypto.subtle.deriveBits` — **constant-time compare**, never `===` on hex.
2. `User` type: replace `password?: string` with `credential?: SecureCredential` + `mustChangePassword?: boolean`.
3. Boot migration (inside the existing boot path in `App.tsx`): any legacy user with `password` gets hashed once, the plaintext field is **deleted**, `mustChangePassword: true`.
4. Seeds: **no** `password: '123'`. Seed `mustChangePassword: true` with no credential → first-run credential setup screen.
5. `SmartOrdersStore.login` becomes `async`; update every caller. Add attempt throttling: 5 failures → 30 s lock per username.
6. Delete `handleQuickSelect` auto-login. Tiles may prefill **username only** — the password is always typed. Remove both `u.password || '123'` fallbacks (`:52`, `:58`).
7. Backup export strips `credential`. Backup import marks users `mustChangePassword: true`.
8. `RUN_100HICH.bat`: remove the three plaintext credential echo lines.

**Accept:**
- `grep -rn "password: '123'" src/ server.ts` → 0 hits; built bundle contains no `123` credential literal.
- Wrong password fails; correct password succeeds; switching role requires typing a password.
- `localStorage` JSON for users contains no `password` key, ever (fresh and migrated installs).
- Gate green — note `login()` is now async, so fix callers rather than making it sync.

---

## P1-2 — Delete dead shims, drop `@google/genai`, single order boundary
**Anchors:** the 11 re-export shims (all <50 bytes, verified):
`src/offline-sync-queue.ts`, `src/order-domain.ts`, `src/sync-controller.ts`, `src/sync-order-handler.ts`, `src/websocket-server.ts`, `src/components/offline-sync-queue.ts`, `src/components/order-domain.ts`, `src/components/sync-order-handler.ts`, `src/components/useInventoryAlerts.ts`, `src/services/offline-sync-queue.ts`, `src/services/order-domain.ts`
· `package.json:19` `@google/genai` · `src/types/domain.ts` (`Order`) vs `src/types/order-domain.ts` (`OrderAggregate`)

**Do:**
1. Rewrite importers to canonical paths, then delete all 11 shims. Delete `src/components/CashierCheckoutPage.tsx` **if** it is still unmounted (it is the only live consumer of two shims) — confirm with a mount-site search before deleting.
2. Remove `@google/genai` (zero source usages — verified). Refresh both `package-lock.json` and `bun.lock`; confirm the transitive `protobufjs` / `google-auth-library` chain is gone. `ws` stays only if something actually imports it.
3. **Order boundary, not a big-bang merge:** `Order` (`types/domain.ts`) stays the single UI-facing model. `OrderAggregate` is demoted to a server-only DTO. Add `src/types/order-adapter.ts` with `toOrderAggregate(order)` / `fromOrderAggregate(agg)` and route `server.ts` + `dbOrderService.ts` through it.
4. Correct stale docs: `docs/PROJECT_BRIEF.md`, `docs/DATA_MODEL.md`, `agents/*` — same truth standard as Phase 1.

**Accept:** `grep -rl "OrderAggregate" src/components` → 0 · no file under `src/` is <200 bytes · `git grep "@google/genai"` → 0 · gate green.

---

## P1-3 — Receipt XSS (real, exploitable today)
**Anchors:** `src/components/ReceiptPrintTemplate.tsx:186-318` — unescaped `order.customerName` (`:244`), `item.name` (`:201`), `item.modifiers` (`:202`), `item.notes` (`:203`), `cashier` (`:248`), `order.orderType` (`:239`), `order.invoiceNo` (`:231`), `order.dateTime` (`:235`), `address`/`phone` (`:222-223`) · `src/services/receiptPrinter.ts:53-66` iframe creation, `:140` `${receiptHtml}` into `doc.write`

**Do:**
1. `src/lib/escapeHtml.ts` — `escapeHtml()` (`& < > " '`) and reuse it for every interpolation in every receipt/summary HTML renderer.
2. `receiptPrinter.ts`: `iframe.setAttribute('sandbox', 'allow-same-origin allow-modals')` — **never** `allow-scripts`. This keeps `contentWindow.print()` working while making injected script inert.
3. Audit **all** `doc.write`, `dangerouslySetInnerHTML`, and template-literal HTML renderers, not just this one.

**Accept:** an item named `<img src=x onerror=alert(1)>` prints as literal text; an item named `<script>localStorage.clear()</script>` empties nothing; printing still works on the physical 80 mm printer.

---

## P1-4 — Unique invoice numbers
**Anchors:** `src/services/storage.ts:1533` `createOrder`, `:1535` `const nextOrderNumber = orders.length + 1;`

**Do:** new `src/services/invoiceSequence.ts` — monotonic per-tenant counter at storage key `cafeos_invoice_seq_<tenantId>`, incremented and persisted **before** the order is written; on boot reconcile to `Math.max(...existing orderNumbers) + 1`. Wire into `createOrder`.

**Accept:** delete the latest order → the next invoice does not reuse its number; restore a backup with a gap → no duplicate; 20 consecutive sales after a deletion produce 20 distinct numbers.

---

## P1-5 — Port drift
**Anchors:** `server.ts:26` default `3001` · `RUN_100HICH.bat:30,37` `localhost:3000`

**Do:** unify on `3001`. Better: move the browser-open into `server.ts` **after** `listen` succeeds, so the script no longer races the server. Any README/runbook port reference must agree.

**Accept:** running the launcher opens the URL that is actually serving; `grep -rn "localhost:3000" .` → 0 excluding `node_modules`.

---

## P1-6 — Vazirmatn fonts are 404 (found by the gate)
**Anchors:** `src/index.css:6,12,18` reference `/fonts/Vazirmatn-{Regular,SemiBold,Bold}.woff2`; **`public/fonts/` does not exist.**

**Do:** bundle the three real weight files under `public/fonts/` (venue machines are offline — a CDN link is not acceptable), or delete the `@font-face` blocks and pin an explicit system stack. Bundling is preferred.

**Accept:** `npm run build` emits no `didn't resolve at build time` font warnings; Persian text renders in Vazirmatn, not Tahoma.

---

## Out of scope for Phase 2
Zero-G re-enable · atomic order+payment transaction (Phase 3, needs a Dexie multi-table transaction design) · offline-queue backoff, ESC/POS dynamic height, `SYNCING` reset · code-splitting the 1.13 MB chunk · any CEO / multi-venue / role-dashboard work · any new screen.

## Reporting format (same as Phase 1)
Per item: commit hash · `git diff --stat` · gate output (lint / test / build) · one line of acceptance evidence.
End with a single `P1` roll-up commit or a linear history — either is fine, but no force-push and no history rewrite.
