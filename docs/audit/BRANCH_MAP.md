# Branch map — single source of truth

**Written:** 2026-11-07 · **Owner of this decision:** CEO · **Status: needs a decision.**

This repository currently carries **three divergent lines**. They are not variants of each other; they are separate product states. Read this before running any command.

---

## 1. The lines

| Line | Tip | Files | Commits ahead of `43a4378` | Last activity | Hardened? |
|---|---|---|---|---|---|
| `main` | `397611a` (merge commit) | 100 | 13 + 12 | 2026-11-07 14:17 | **YES** — all P0/P1 work |
| `feature/shared-core-preparation` | `7cf3108` | **261** | +39 | **2026-11-07 11:58** | NO |
| `feature/p42-4-remediation` | `1d64c0b` | 186 | +10 | 2026-11-03 20:05 | NO |

`feature/p42-4-remediation` is an ancestor of `feature/shared-core-preparation`, so it is already contained in it and is superseded.

## 2. The problem this document exists to prevent

`43a4378` (the old main, 102 files, 2026-11-01) is the base that the P0 and P1 hardening was built on. **Every fix lives on that line only.** The most advanced product line — `shared-core-preparation`, 261 files, touched 11:58 today — contains **none** of it.

So: `main` today is the *safe* code, but it carries the 1 November feature set. `shared-core-preparation` is the *feature-complete* code, and it is unsafe.

Do not deploy `main` and assume it is the product. Do not develop on `main` and assume it reaches the product.

## 3. Defects still alive on `shared-core-preparation`

Verified by reading that branch, not inferred:

| Defect | Evidence on `shared-core-preparation` |
|---|---|
| Invoice numbers collide | `src/services/storage.ts:2013` → `const nextOrderNumber = orders.length + 1;` |
| One-click login with `123` | `src/components/LoginView.tsx:52,58` → `u.password \|\| '123'` |
| Receipt XSS surface | `src/services/receiptPrinter.ts:76` → `doc.write(` with no `sandbox` attribute on the iframe |
| Financial reports reachable by every role | `src/App.tsx:122` guards `menu`, `audit`, `inventory` — **not** `reports` |
| No durable order mirror | no `posOrders` table anywhere → a quota failure still has no fallback copy |
| Zero-G settlement path | `FEATURES.ENABLE_ZERO_G_SMART_ORDERS` gates rendering (`App.tsx:318`, `Header.tsx:139,498`); the settlement guard from P0-1 is not present |

## 4. Porting cost, honestly

The hardening cannot be cherry-picked cleanly: `shared-core-preparation` rewrote `PosView.tsx`, `storage.ts`, `App.tsx`, `Header.tsx` and most of `src/`. Expect to **re-implement**, not apply:

| Hardening item | Port to `shared-core` |
|---|---|
| P0-1 Zero-G settlement lock | re-implement against its settlement path |
| P0-2 loud storage failure + order mirror | re-implement (no Dexie order table exists there) |
| P1-1 PBKDF2 credentials | port the module, re-wire login (its login is still the `123` flow) |
| P1-3 receipt escaping + sandbox | small patch, mostly portable |
| P1-4 invoice sequence | small patch, portable |
| P1-7 owner enrolment gate | re-implement on top of the ported credential module |
| P1-8 reports RBAC | one line |

Rough shape: 2–3 focused days, not a merge.

## 5. Decision required

**Which line is the product?**

- **Option A — `shared-core-preparation` is the product.** Freeze `main` as a reference branch, port the hardening onto `shared-core`, then fast-forward `main` to it. Costs 2–3 days. Recommended if `shared-core` is where the real feature work already happened.
- **Option B — `main` is the product.** Declare `shared-core-preparation` abandoned, keep the 1 November feature set, ship the hardened build. Cheapest today; discards 39 commits of work.
- **Option C — merge them.** Only sensible if `shared-core`'s features are actually wanted; expect a large, conflict-heavy merge and a second full gate.

## 6. Rules while this is unresolved

1. Do not create new long-lived feature branches. One line at a time.
2. No force-push, no history rewrite, on any of the three lines.
3. Every branch that matters must be pushed to `origin` — local-only work is how this divergence happened.
4. Any new fix must state, in its commit message, **which line** it targets.
