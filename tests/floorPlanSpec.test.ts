/**
 * Modendo POS — Floor Plan (v6.3-Final Settled) Test Suite
 * Verifies spatial schema, entity registries, geometric operations,
 * snap-to-grid, shortcut invariants, and billing mode behaviors.
 */

import { floorPlanService } from '../src/services/floorPlanService';
import { INITIAL_MODENDO_FLOOR_PLAN } from '../src/data/modendoFloorPlanData';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- Running Modendo POS Floor Plan v6.3 Test Suite ---\n');

// Reset to initial spec seed before testing
floorPlanService.resetToDefault();

console.log('[Suite 1: Spatial Schema & Level Distribution]');
const schema = floorPlanService.getSchema();
assert(schema.modendo_schema_version === '6.3', 'Modendo schema version is 6.3');
assert(schema.venue.floor_levels.length === 2, 'Venue defines exactly 2 split levels (Level 0 and 1)');

const l0Tables = floorPlanService.getTablesByLevel(0);
const l1Tables = floorPlanService.getTablesByLevel(1);
assert(l0Tables.length > 0, `Level 0 contains ${l0Tables.length} spatial entities`);
assert(l1Tables.length > 0, `Level 1 contains ${l1Tables.length} spatial entities`);

// Check required entities from Section 3
const lobbySofa = floorPlanService.getTableById('sofa_lobby');
const lobbyTable = floorPlanService.getTableById('table_lobby');
const loungeZone = floorPlanService.getTableById('LZ-ZONE');
const ps1 = floorPlanService.getTableById('ps5_pod_1');
const ps4 = floorPlanService.getTableById('ps5_pod_4');
const m01 = floorPlanService.getTableById('M-01');
const mSide = floorPlanService.getTableById('M-Side');
const t01 = floorPlanService.getTableById('T-01');
const t05 = floorPlanService.getTableById('T-05');

assert(Boolean(lobbySofa), 'Lobby sofa (sofa_lobby) is mapped on Level 0');
assert(Boolean(lobbyTable), 'Lobby table (table_lobby) is mapped on Level 0');
assert(Boolean(loungeZone), 'Lounge U-shape zone (LZ-ZONE) is mapped on Level 0');
assert(Boolean(ps1 && ps4), 'PS5 gaming pods 1 through 4 are mapped on Level 0');
assert(Boolean(m01 && mSide), 'Main hall boardgame tables (M-01, M-Side) are mapped on Level 1');
assert(Boolean(t01 && t05), 'Terrace tables (T-01, T-05) are mapped on Level 1');

console.log('\n[Suite 2: Billing Modes & Entity Capabilities]');
assert(ps1?.billing_mode === 'hourly_timer', 'PS5 pod billing mode is hourly_timer');
assert(ps1?.capabilities.game_timer === true, 'PS5 pod has game_timer enabled');
assert(loungeZone?.billing_mode === 'token', 'Lounge zone billing mode is token-based');
assert(loungeZone?.capabilities.token_required === true, 'Lounge zone requires token');
assert(m01?.billing_mode === 'standard_table', 'M-01 billing mode is standard_table');
assert(m01?.capabilities.mergeable === true, 'M-01 table is mergeable with neighboring tables');

console.log('\n[Suite 3: Geometric Engine & Snap-to-Grid Invariants]');
// 10px snap
assert(floorPlanService.snap(43) === 40, 'Snap 43px rounds to 40px');
assert(floorPlanService.snap(47) === 50, 'Snap 47px rounds to 50px');
assert(floorPlanService.snap(105) === 110, 'Snap 105px rounds to 110px');

// Update geometry with snap
floorPlanService.updateTableGeometry('ps5_pod_1', { x: 63, y: 538 }, true);
const updatedPs1 = floorPlanService.getTableById('ps5_pod_1');
assert(updatedPs1?.geometry.x === 60, 'Geometry x=63 snapped to 60 on 10px grid');
assert(updatedPs1?.geometry.y === 540, 'Geometry y=538 snapped to 540 on 10px grid');

console.log('\n[Suite 4: Editor Shortcuts (Ctrl+D, R, Delete)]');
// Ctrl + D (Clone table with 20px offset)
const cloned = floorPlanService.cloneTable('M-01');
assert(Boolean(cloned), 'Cloning M-01 returns new cloned entity');
assert(cloned?.geometry.x === floorPlanService.snap((m01?.geometry.x || 0) + 20), 'Cloned entity has +20px offset on X');
assert(cloned?.geometry.y === floorPlanService.snap((m01?.geometry.y || 0) + 20), 'Cloned entity has +20px offset on Y');
assert(cloned?.status === 'AVAILABLE', 'Cloned entity is initially AVAILABLE');

// R (Rotate 90 degrees)
const origW = cloned?.geometry.width || 0;
const origH = cloned?.geometry.height || 0;
floorPlanService.rotateTable(cloned!.id);
const rotated = floorPlanService.getTableById(cloned!.id);
assert(rotated?.geometry.rotation === 90, 'Table rotated by 90 degrees');
assert(rotated?.geometry.width === origH && rotated?.geometry.height === origW, 'Width and height swapped on 90deg rotation');

// Delete
const deleteSuccess = floorPlanService.deleteTable(cloned!.id);
assert(deleteSuccess === true, 'Delete table operation succeeded');
assert(floorPlanService.getTableById(cloned!.id) === undefined, 'Deleted entity no longer exists in floor plan');

console.log('\n[Suite 5: Live State Machine & Timer Sessions]');
// Start PS5 session
floorPlanService.startSession('ps5_pod_2', 2);
const activePs2 = floorPlanService.getTableById('ps5_pod_2');
assert(activePs2?.status === 'GAMING_ACTIVE', 'Starting PS5 session transitions status to GAMING_ACTIVE');
assert(Boolean(activePs2?.sessionStartTime), 'Session start time is recorded as ISO string');

// Settle / Clear session
floorPlanService.clearSession('ps5_pod_2');
const clearedPs2 = floorPlanService.getTableById('ps5_pod_2');
assert(clearedPs2?.status === 'AVAILABLE', 'Clearing session returns status to AVAILABLE');
assert(clearedPs2?.sessionStartTime === undefined, 'Session start time is cleared');

console.log('\n========================================');
console.log(`Floor Plan Test Summary: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
