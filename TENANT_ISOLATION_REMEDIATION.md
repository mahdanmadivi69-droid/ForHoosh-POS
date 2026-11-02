# TENANT ISOLATION REMEDIATION — ARCHITECTURE & TECHNICAL GUIDE

**Approved Architecture:** Option B — Shared Core + Independent Cafe Applications  
**Focus:** Data Isolation, Operational Integrity, and Operational Safety  
**Lead Architect:** Antigravity Engineering Swarm  
**Status:** **REMEDIATED & VERIFIED**  

---

## 1. Architectural Overview & Problem Context

In Phase 0, the architecture audit revealed that while domain entities (Orders, Shifts, Expenses) in `storage.ts` implemented tenant partitioning via `key_tenantId`, three critical operational tiers remained completely un-scoped, leading to severe cross-tenant contamination:

1. **Bill of Materials (BOM) Raw Inventory:** Shared the global storage key `cafeos_raw_ingredients_v2`, causing Modendo orders to deplete 100 HICH coffee beans, milk, and syrups.
2. **Open Table Sessions:** Shared the global storage keys `cafeos_table_tabs_v2` and `cafeos_reserved_tables_v1`, causing table collisions; and hardcoded `tenantId: 'tenant-100hich-01'` on barista dispatch.
3. **Barista Kitchen Display System (KDS):** Shared a single global `BroadcastChannel('cafeos_barista_channel')`, leaking order chimes and kitchen tickets across brands in multi-tab deployments.
4. **IndexedDB Local Database:** Shared `CafeOS_LocalDB` across tenants with un-prefixed primary keys, creating collision hazards on settings, printer profiles, and inventory sync.

---

## 2. Technical Remediation Design

```
+--------------------------------------------------------------------------+
|                      OPTION B: SHARED CORE PLATFORM                      |
+--------------------------------------------------------------------------+
                                     |
       +-----------------------------+-----------------------------+
       |                                                           |
       v                                                           v
+-------------------------------+           +-------------------------------+
|    100 HICH SPECIALTY LAB     |           |     MODENDO GAMING CAFE       |
|    tenantId: tenant-100hich-01|           |    tenantId: tenant-modendo-01|
+-------------------------------+           +-------------------------------+
| - Raw Ings: Coffee, Milk, Tea |           | - Raw Ings: Patties, Buns, Soda|
| - Store: cafeos_raw_ing_100hich|           | - Store: cafeos_raw_ing_modendo|
| - Tables: Specialty Brew Bar  |           | - Tables: Split-Level, 4 PS5s |
| - Tab Store: table_tabs_100hich|           | - Tab Store: table_tabs_modendo|
| - KDS Channel: barista_100hich|           | - KDS Channel: barista_modendo|
| - DB: CafeOS_LocalDB_100hich  |           | - DB: CafeOS_LocalDB_modendo  |
| - Queue: OfflineDB_100hich    |           | - Queue: OfflineDB_modendo    |
+-------------------------------+           +-------------------------------+
```

---

## 3. Vulnerability Remediations Detailed

### 3.1 RSK-01: BOM Inventory Key Scoping (`inventoryBomService.ts`)

#### Before Remediation:
```
[Modendo Order: 2 Burgers] ---> [deductForItems()] ---> Storage: 'cafeos_raw_ingredients_v2' (100 HICH Beans/Milk)
                                                             |
                                                             v
                                                    Depletes 100 HICH Stock!
```

#### After Remediation:
```
[Modendo Order] ---> [deductForItems(items, 'tenant-modendo-01')]
                           |
                           v
          Storage: 'cafeos_raw_ingredients_tenant-modendo-01_v2'
          (Depletes Modendo Burger Patties & Fries ONLY)

[100 HICH Order] ---> [deductForItems(items, 'tenant-100hich-01')]
                           |
                           v
          Storage: 'cafeos_raw_ingredients_tenant-100hich-01_v2'
          (Depletes 100 HICH Espresso Blend & Dairy Milk ONLY)
```

* **Resolution Rules:**
  - Dynamic key generation: `cafeos_raw_ingredients_${tenantId}_v2` and `cafeos_product_recipes_${tenantId}_v2`.
  - Independent seed catalogs: 100 HICH specialty coffee vs Modendo gaming diner.
  - Multi-tenant in-memory partition cache.
  - Optional `tenantId?: string` parameter on all service operations.

---

### 3.2 RSK-02: Open Table Tabs & Line 339 Barista Dispatch (`openTabService.ts`)

#### Before Remediation:
- Storage key: `cafeos_table_tabs_v2` (Global).
- Line 339:
  ```ts
  // VULNERABILITY: Hardcoded tenant identity!
  baristaDispatcher.dispatchPaidOrder({
    ...
    tenantId: 'tenant-100hich-01',
    ...
  });
  ```

#### After Remediation:
- Scoped keys:
  `cafeos_table_tabs_${tenantId}_v2`
  `cafeos_reserved_tables_${tenantId}_v1`
- Line 339 Remediation:
  ```ts
  // REMEDIATED: Dynamic validated tenant identity!
  const effectiveTenantId = updatedTab.tenantId || this.getActiveTenantId(tenantId);
  baristaDispatcher.dispatchPaidOrder({
    ...
    tenantId: effectiveTenantId,
    ...
  });
  ```
- Cross-tenant table protection: Operations against foreign tenant tabs return `null` or throw, completely isolating table sessions.

---

### 3.3 RSK-03: Barista KDS BroadcastChannel Scoping (`baristaDispatcher.ts`)

#### Before Remediation:
```
[100 HICH Barista Tab] <===== Global 'cafeos_barista_channel' =====> [Modendo POS Tab]
Orders in 100 HICH chime and display on Modendo screens!
```

#### After Remediation:
```
[100 HICH Barista Tab] <==== 'cafeos_barista_channel_tenant-100hich-01' ====> [100 HICH POS]
[Modendo Barista Tab]  <==== 'cafeos_barista_channel_tenant-modendo-01'  ====> [Modendo POS]
```

* **Channel Security Gate:** Incoming messages on `cafeos_barista_channel_${channelTenantId}` are validated against `ticket.tenantId`. If a ticket from another tenant appears, it is dropped immediately with an audit log warning.
* **Storage Isolation:** Persisted tickets are stored in `cafeos_barista_tickets_${tenantId}`.

---

### 3.4 RSK-07 / RSK-10: IndexedDB & Offline Queue Isolation (`cafeDb.ts` & `offlineSyncQueue.ts`)

#### Technical Remediation Design:
The Phase 0 audit confirmed that Dexie tables (`inventoryItems`, `menuItems`, `orders`, `appSettings`, `printerProfiles`, `authUsers`, etc.) use un-prefixed primary keys:
* `inventoryItems`: Key is `id` (`ing_espresso_blend`).
* `appSettings`: Key is `key` (`store_profile`, `fiscal_rules`, `receipt_template`).
* `printerProfiles`: Key is `id` (`printer-bar`, `printer-kitchen`).

Attempting to store both tenants in a single IndexedDB database would cause immediate primary key overwrite collisions (e.g. Modendo's `store_profile` overwriting 100 HICH's `store_profile`, or `printerProfiles.clear()` wiping all printers).

**Approved Remediation:** Independent local databases per tenant context:
* **100 HICH Database:** `CafeOS_LocalDB_tenant-100hich-01`
* **Modendo Database:** `CafeOS_LocalDB_tenant-modendo-01`
* **100 HICH Offline Queue:** `CafeOS_OfflineDB_tenant-100hich-01`
* **Modendo Offline Queue:** `CafeOS_OfflineDB_tenant-modendo-01`
* **Backward Compatibility:** `export const db` is wrapped in an ES6 `Proxy` that dynamically delegates property access and transactions to `getCafeDatabase(getActiveTenantId())`. Existing callers require 0 modifications.
* **Migration:** `migrateLegacyCafeDatabase()` provides non-destructive data migration from legacy `CafeOS_LocalDB` to `CafeOS_LocalDB_tenant-100hich-01` without deleting the legacy database.

---

## 4. Verification & Testing Proof

All remediations were validated through automated test suites:
* `tests/phase1InventoryBomIsolation.test.ts` (42 tests)
* `tests/phase1OpenTabIsolation.test.ts` (39 tests)
* `tests/phase1BaristaKdsIsolation.test.ts` (20 tests)
* `tests/phase1IndexedDbIsolation.test.ts` (44 tests)
* 9 existing baseline suites (568 tests)

**Total:** 713 passing tests with 0 regressions.
