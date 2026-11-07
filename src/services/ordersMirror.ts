/**
 * P0-2 — Dexie / IndexedDB write-through mirror for the POS order ledger.
 *
 * Why this file exists
 * --------------------
 * The POS ledger currently lives in ONE localStorage key
 * (`smartorders_orders_v1`) that is rewritten as a full JSON array on every
 * mutation (create order, status change, cancel) and shares the ~5 MB origin
 * quota with users, menu, payments, expenses and audit logs. When
 * localStorage throws `QuotaExceededError` the old `save()` swallowed it and
 * the cashier still saw a successful receipt (review finding R4).
 *
 * This module mirrors the *orders* array into the existing `CafeOS_LocalDB`
 * Dexie database on every successful localStorage save, and can read the
 * mirror back on boot. That makes the ledger survive a refresh even when the
 * localStorage copy is lost/truncated, without changing the order data shape
 * or the local-first behaviour the cashier UI depends on.
 *
 * DELIBERATELY LIMITED SCOPE (Phase 1 / P0)
 * -----------------------------------------
 *  - Only `orders` are mirrored. `payments`, `shifts`, `expenses`, `menuItems`,
 *    `users` and `auditLogs` are STILL localStorage-only. A payment recovered
 *    from the order mirror therefore has no matching payment record until the
 *    full migration lands. This is documented as a residual risk in
 *    `reviews/POS-Phase1-P0-Report.md`.
 *  - The mirror is a *snapshot* (`clear` + `bulkPut` in one Dexie
 *    transaction), not an incremental write. It is correct but still O(n) per
 *    save; acceptable for the 100 Hich single-terminal pilot.
 *  - Writes are fire-and-forget: a slow/failed IndexedDB write must never
 *    block the cashier. The localStorage write is still the one that gates a
 *    sale (see `SmartOrdersStore.saveOrders`).
 *
 * TODO — full migration (Phase 2+, NOT done in Phase 1):
 *  1. Make Dexie the primary ledger and localStorage a boot cache only.
 *  2. Mirror payments + shifts + expenses + audit logs in the same
 *     transaction, so an order and its money can never diverge.
 *  3. Await the IndexedDB transaction in the settlement path before showing
 *     "paid", and delete the whole-array localStorage rewrite.
 *  4. Add a schema/version check on boot (`db.verno`, `db.tables`) and a
 *     one-time import of pre-existing localStorage data.
 */
import type { Order } from '../types/domain';

/** Table created in `src/db/cafeDb.ts` version(2); do not rename without a Dexie upgrade. */
export const ORDERS_MIRROR_TABLE = 'posOrders';

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getDb() {
  // Dynamic import keeps Dexie/IndexedDB out of environments that have no IDB
  // (Node test scripts, SSR) and avoids evaluating the DB at module load.
  const { db } = await import('../db/cafeDb');
  return db;
}

/**
 * Mirrors the full orders array into Dexie. Resolves only after the Dexie
 * transaction has committed; rejects if IndexedDB itself fails.
 */
export async function writeOrdersMirror(orders: Order[]): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await getDb();
  await db.transaction('rw', db.posOrders, async () => {
    await db.posOrders.clear();
    if (orders.length > 0) {
      await db.posOrders.bulkPut(orders);
    }
  });
}

/** Fire-and-forget variant used by the synchronous `saveOrders()` path. */
export function mirrorOrdersToDexie(orders: Order[]): void {
  if (!isIndexedDbAvailable()) return;
  void writeOrdersMirror(orders).catch((err) => {
    console.error(
      '[ordersMirror] Dexie mirror write failed; the localStorage copy is still authoritative for now.',
      err
    );
  });
}

/** Returns the mirrored orders; [] when IndexedDB is unavailable or empty. */
export async function readMirroredOrders(): Promise<Order[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await getDb();
  return db.posOrders.toArray();
}

/** Clears the mirror (used by the explicit "reset to seed" action). */
export async function clearOrdersMirror(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await getDb();
  await db.posOrders.clear();
}
