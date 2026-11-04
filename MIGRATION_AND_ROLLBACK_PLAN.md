# MIGRATION AND ROLLBACK PLAN

**Mission:** Safe Production Migration & Rollback Protocol  
**Phase:** Phase 1 — Critical Isolation Remediation  
**Scope:** BOM Raw Ingredients, Open Table Sessions, Barista KDS Tickets, IndexedDB  
**Lead Database Engineer & QA Orchestrator:** Antigravity Engineering Swarm  

---

## 1. Data Ownership Determination

Before designing the migration, ownership of legacy un-scoped records was mathematically and operationally verified against the codebase:

| Store Tier | Legacy Storage Key | Discovered Content & Identity | Verified Owner Tenant | Action |
| :--- | :--- | :--- | :--- | :--- |
| **BOM Raw Ingredients** | `cafeos_raw_ingredients_v2` | Specialty espresso beans, Colombian Supremo, Ethiopian Yirgacheffe, Dairy milk, Oat milk, Vanilla/Caramel syrups, French butter croissants, Belgian fudge cookies. | **100 HICH** (`tenant-100hich-01`) | Migrate to `cafeos_raw_ingredients_tenant-100hich-01_v2`. Modendo receives independent Modendo seeds. |
| **BOM Product Recipes** | `cafeos_product_recipes_v2` | Flat White, Single Espresso, Double Espresso, Americano, Latte, Cappuccino, V60 Brews. | **100 HICH** (`tenant-100hich-01`) | Migrate to `cafeos_product_recipes_tenant-100hich-01_v2`. Modendo receives Modendo burger/espresso recipes. |
| **Open Table Sessions** | `cafeos_table_tabs_v2` | Sample open tab on Table 2 (`میز ۲`), server `سارا رضایی` (100 HICH Shift Manager), ordering `فلت وایت` (Flat White). | **100 HICH** (`tenant-100hich-01`) | Migrate to `cafeos_table_tabs_tenant-100hich-01_v2`. Modendo initializes with clean isolated table store. |
| **Reserved Tables** | `cafeos_reserved_tables_v1` | Table reservation IDs. | **100 HICH** (`tenant-100hich-01`) | Migrate to `cafeos_reserved_tables_tenant-100hich-01_v1`. |
| **Barista Tickets** | `cafeos_barista_tickets` | Mix of legacy dispatched orders. | **Partition by Tenant** | Tickets carrying `tenantId === 'tenant-modendo-01'` land in Modendo; un-tagged or 100 HICH tickets land in 100 HICH. |
| **IndexedDB** | `CafeOS_LocalDB` | Local offline cache of orders, inventory, settings. | **100 HICH** (`tenant-100hich-01`) | Copy to `CafeOS_LocalDB_tenant-100hich-01`. Legacy database preserved intact. |

---

## 2. Migration Execution Order & Safety Invariants

### 2.1 Pre-Flight Safety Checks
1. Verified external backup exists outside the repository: `C:\Users\mahda\Downloads\Documents\KarWand_Backup_Pre_Phase1`.
2. Verified that target scoped keys do NOT overwrite existing data if already populated.
3. Created secondary backups of each legacy key prior to migration:
   - `cafeos_raw_ingredients_v2_legacy_backup`
   - `cafeos_table_tabs_v2_legacy_backup`
   - `cafeos_reserved_tables_v1_legacy_backup`
   - `cafeos_barista_tickets_legacy_backup`
4. Created persistent audit log entries:
   - `cafeos_inventory_migration_log`
   - `cafeos_open_tabs_migration_log`
   - `cafeos_barista_migration_log`

### 2.2 Idempotency Rules
* Every migration function (`inventoryBomService.migrateLegacyData()`, `openTabService.migrateLegacyData()`, `baristaDispatcher.migrateLegacyData()`, `migrateLegacyCafeDatabase()`) checks whether the target tenant store is already initialized.
* If the target store already exists, the migration safely aborts with status `SKIPPED`, returning `{ migrated: false, recordCount: 0 }`.
* Running the migration multiple times produces identical state and zero data duplication.

### 2.3 Unit & Quantity Preservation
* Floating-point quantities (e.g. `11450`g espresso blend, `18500`ml milk) and 3-decimal precision are preserved verbatim.
* Costs per unit, minimum safety thresholds, and last restock timestamps are strictly maintained.

---

## 3. Automated Rollback Procedures

If any operational issue arises post-migration, the following automated rollback functions can be executed:

### 3.1 Inventory BOM Rollback
```ts
import { inventoryBomService } from './src/services/inventoryBomService';
const rolledBack = inventoryBomService.rollbackLegacyMigration();
// 1. Restores 'cafeos_raw_ingredients_v2' from 'cafeos_raw_ingredients_v2_legacy_backup'.
// 2. Removes 'cafeos_raw_ingredients_tenant-100hich-01_v2'.
// 3. Flushes in-memory cache.
```

### 3.2 Open Table Tabs Rollback
```ts
import { openTabService } from './src/services/openTabService';
const rolledBack = openTabService.rollbackLegacyMigration();
// 1. Restores 'cafeos_table_tabs_v2' from 'cafeos_table_tabs_v2_legacy_backup'.
// 2. Removes 'cafeos_table_tabs_tenant-100hich-01_v2'.
// 3. Flushes in-memory tabs cache.
```

### 3.3 Barista KDS Rollback
```ts
import { baristaDispatcher } from './src/services/baristaDispatcher';
const rolledBack = baristaDispatcher.rollbackLegacyMigration();
// 1. Restores 'cafeos_barista_tickets' from backup.
// 2. Removes 'cafeos_barista_tickets_tenant-100hich-01'.
```

### 3.4 IndexedDB Rollback
* Legacy `CafeOS_LocalDB` is **NEVER DELETED OR RESET**.
* Rolling back simply requires directing `getCafeDatabase()` or the default database constructor to `CafeOS_LocalDB`. No data restoration from external snapshots is necessary because the original database remains untouched on disk.

---

## 4. Manual Disaster Recovery Protocol

In the unlikely event of browser storage corruption:
1. Access browser Developer Tools -> Application -> Local Storage.
2. Verify existence of `*_legacy_backup` keys.
3. If primary keys were corrupted, copy the JSON string from `cafeos_raw_ingredients_v2_legacy_backup` into `cafeos_raw_ingredients_tenant-100hich-01_v2`.
4. Refresh the application. The system will resume operational state immediately.
