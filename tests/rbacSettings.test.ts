/**
 * Automated Verification Suite for CafeOS RBAC, Settings & Hardware Hub (v2.4.0)
 * Tests 4-Level RBAC Permissions, Cryptographic Salted SHA-256 Hashes,
 * Elevation Policy, ESC/POS Binary Specifications, and Roll Width Adapters.
 */

import {
  RBACService,
  ROLE_DEFINITIONS,
  ELEVATION_POLICY,
} from '../src/services/RBACService';
import { CryptoSecurity } from '../src/services/cryptoSecurity';
import {
  EscPosGenerator,
} from '../src/services/escposGenerator';
import {
  DEFAULT_STORE_PROFILE,
  DEFAULT_FISCAL_RULES,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_PRINTER_PROFILES,
} from '../src/services/settingsService';
import { HardwareDeviceProfile } from '../src/types/rbac-settings';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    failedTests++;
  }
}

console.log('\n--- Running CafeOS RBAC, Settings & Hardware Hub Invariants Test Suite ---\n');

// =========================================================================
// SUITE 1: 4-Level RBAC Role Hierarchy & Level Mapping
// =========================================================================
console.log('[Suite 1: 4-Level Role Hierarchy & Authority Levels]');
{
  assert(ROLE_DEFINITIONS.OWNER.level === 4, 'OWNER authority is Level 4');
  assert(ROLE_DEFINITIONS.ACCOUNTANT.level === 3, 'ACCOUNTANT authority is Level 3');
  assert(ROLE_DEFINITIONS.MANAGER.level === 2, 'MANAGER authority is Level 2');
  assert(ROLE_DEFINITIONS.BARISTA.level === 1, 'BARISTA authority is Level 1');

  assert(
    ROLE_DEFINITIONS.OWNER.permissions.includes('ALL'),
    'OWNER role has wildcard ALL permissions'
  );

  assert(
    ROLE_DEFINITIONS.ACCOUNTANT.permissions.includes('VIEW_FINANCIALS') &&
    ROLE_DEFINITIONS.ACCOUNTANT.permissions.includes('EXPORT_TAX_LEDGER') &&
    ROLE_DEFINITIONS.ACCOUNTANT.permissions.includes('EDIT_BOM_COSTS') &&
    ROLE_DEFINITIONS.ACCOUNTANT.permissions.includes('VIEW_Z_REPORT'),
    'ACCOUNTANT role has financial and BOM ledger permissions'
  );

  assert(
    !ROLE_DEFINITIONS.ACCOUNTANT.permissions.includes('ORDER_DISPATCH' as any),
    'ACCOUNTANT does not have order dispatch permission'
  );

  assert(
    ROLE_DEFINITIONS.MANAGER.permissions.includes('ORDER_DISPATCH') &&
    ROLE_DEFINITIONS.MANAGER.permissions.includes('OVERRIDE_DISCOUNT_20') &&
    ROLE_DEFINITIONS.MANAGER.permissions.includes('VOID_DISPATCHED_ITEM') &&
    ROLE_DEFINITIONS.MANAGER.permissions.includes('PRINTER_DIAGNOSTICS'),
    'MANAGER has operational override and printer diagnostics permissions'
  );

  assert(
    ROLE_DEFINITIONS.BARISTA.permissions.includes('ORDER_DISPATCH') &&
    ROLE_DEFINITIONS.BARISTA.permissions.includes('ORDER_SETTLE') &&
    ROLE_DEFINITIONS.BARISTA.permissions.includes('REPRINT_LAST_TICKET'),
    'BARISTA has operational dispatch and settle permissions'
  );

  assert(
    !ROLE_DEFINITIONS.BARISTA.permissions.includes('VOID_DISPATCHED_ITEM' as any) &&
    !ROLE_DEFINITIONS.BARISTA.permissions.includes('OVERRIDE_DISCOUNT_20' as any),
    'BARISTA is prohibited from voiding dispatched items or overriding discounts'
  );
}

// =========================================================================
// SUITE 2: RBAC Static Permission Evaluation
// =========================================================================
console.log('\n[Suite 2: Permission Evaluation Method Invariants]');
{
  assert(RBACService.hasPermission('OWNER', 'VIEW_FINANCIALS'), 'Owner evaluates true for VIEW_FINANCIALS');
  assert(RBACService.hasPermission('OWNER', 'ORDER_DISPATCH'), 'Owner evaluates true for ORDER_DISPATCH');
  assert(RBACService.hasPermission('ACCOUNTANT', 'EXPORT_TAX_LEDGER'), 'Accountant evaluates true for EXPORT_TAX_LEDGER');
  assert(!RBACService.hasPermission('ACCOUNTANT', 'ORDER_DISPATCH'), 'Accountant evaluates false for ORDER_DISPATCH');
  assert(RBACService.hasPermission('MANAGER', 'PRINTER_DIAGNOSTICS'), 'Manager evaluates true for PRINTER_DIAGNOSTICS');
  assert(!RBACService.hasPermission('MANAGER', 'EDIT_BOM_COSTS'), 'Manager evaluates false for EDIT_BOM_COSTS');
  assert(RBACService.hasPermission('BARISTA', 'ORDER_SETTLE'), 'Barista evaluates true for ORDER_SETTLE');
  assert(!RBACService.hasPermission('BARISTA', 'PRINTER_DIAGNOSTICS'), 'Barista evaluates false for PRINTER_DIAGNOSTICS');
}

// =========================================================================
// SUITE 3: Elevation Policy & Security Gates
// =========================================================================
console.log('\n[Suite 3: Elevation Policy Invariants]');
{
  const requiredActions = [
    'VOID_DISPATCHED_ORDER',
    'CUSTOM_DISCOUNT_ABOVE_ZERO',
    'OPEN_CASH_DRAWER_MANUAL',
    'ACCESS_SETTINGS_PANEL',
    'EDIT_RECIPE_BOM',
  ];

  for (const act of requiredActions) {
    assert(
      ELEVATION_POLICY.require_pin_for.includes(act as any),
      `Action ${act} is strictly registered in require_pin_for elevation policy`
    );
  }

  // Barista Elevation Guard
  assert(
    RBACService.requiresElevation('ACCESS_SETTINGS_PANEL', 'BARISTA'),
    'Barista is strictly blocked from ACCESS_SETTINGS_PANEL without PIN elevation'
  );
  assert(
    RBACService.requiresElevation('VOID_DISPATCHED_ORDER', 'BARISTA'),
    'Barista is blocked from VOID_DISPATCHED_ORDER without PIN elevation'
  );
  assert(
    RBACService.requiresElevation('OPEN_CASH_DRAWER_MANUAL', 'BARISTA'),
    'Barista is blocked from manual cash drawer opening without PIN elevation'
  );

  // Manager Elevation Guard
  assert(
    !RBACService.requiresElevation('ACCESS_SETTINGS_PANEL', 'MANAGER'),
    'Manager does not require elevation for ACCESS_SETTINGS_PANEL'
  );
  assert(
    !RBACService.requiresElevation('VOID_DISPATCHED_ORDER', 'MANAGER'),
    'Manager does not require elevation for VOID_DISPATCHED_ORDER'
  );

  // Owner Elevation Guard
  assert(
    !RBACService.requiresElevation('ACCESS_SETTINGS_PANEL', 'OWNER'),
    'Owner does not require elevation for ACCESS_SETTINGS_PANEL'
  );
  assert(
    !RBACService.requiresElevation('VOID_DISPATCHED_ORDER', 'OWNER'),
    'Owner does not require elevation for VOID_DISPATCHED_ORDER'
  );
}

// =========================================================================
// SUITE 4: Cryptographic Salted SHA-256 PIN Security
// =========================================================================
console.log('\n[Suite 4: Cryptographic Salted SHA-256 PIN Invariants]');
(async () => {
  const salt1 = CryptoSecurity.generateSalt();
  const salt2 = CryptoSecurity.generateSalt();

  assert(salt1.length === 32, 'Cryptographic salt is exactly 32 hex characters (16 bytes)');
  assert(salt1 !== salt2, 'Subsequent salts are mathematically distinct (cryptographic randomness)');

  const { hash: hash1, salt: s1 } = await CryptoSecurity.hashPin('1234', salt1);
  assert(hash1.length === 64, 'Computed SHA-256 hash is exactly 64 hex characters (256 bits)');

  const isValidPin = await CryptoSecurity.verifyPin('1234', hash1, s1);
  assert(isValidPin === true, 'Correct PIN "1234" successfully verifies against stored salted hash');

  const isInvalidPin = await CryptoSecurity.verifyPin('9999', hash1, s1);
  assert(isInvalidPin === false, 'Incorrect PIN "9999" is strictly rejected');

  const isEmptyPin = await CryptoSecurity.verifyPin('', hash1, s1);
  assert(isEmptyPin === false, 'Empty string PIN is strictly rejected');

  // Same PIN with different salts produces completely different hashes (Rainbow Table Immune)
  const { hash: hash2 } = await CryptoSecurity.hashPin('1234', salt2);
  assert(hash1 !== hash2, 'Identical PIN with different salts yields distinct SHA-256 digests');
})();

// =========================================================================
// SUITE 5: ESC/POS Direct Binary Hardware Generation
// =========================================================================
console.log('\n[Suite 5: ESC/POS Binary Protocol Generation Invariants]');
{
  const profile80: HardwareDeviceProfile = {
    id: 'test-p-80',
    alias: 'Barista Counter Thermal',
    station: 'BAR_KDS',
    connection_type: 'WEB_SERIAL',
    target_address: 'COM3',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256 (Persian/Arabic Support)',
    auto_cut: true,
    cash_drawer_kick_pulse: true,
  };

  const output80 = EscPosGenerator.generateTestTicket(profile80);

  // Directive 3 Verification: [0x1B, 0x40] (init), [0x1B, 0x61, 0x01] (center), [0x1D, 0x56, 0x00] (cut)
  assert(
    output80.bytes[0] === 0x1b && output80.bytes[1] === 0x40,
    'ESC/POS byte stream begins with Init command [0x1B, 0x40]'
  );

  // Check Center alignment [0x1B, 0x61, 0x01]
  let hasCenterAlign = false;
  for (let i = 0; i < output80.bytes.length - 2; i++) {
    if (output80.bytes[i] === 0x1b && output80.bytes[i + 1] === 0x61 && output80.bytes[i + 2] === 0x01) {
      hasCenterAlign = true;
      break;
    }
  }
  assert(hasCenterAlign, 'ESC/POS contains Center Alignment command [0x1B, 0x61, 0x01]');

  // Check Cut command [0x1D, 0x56, 0x00]
  let hasCut = false;
  for (let i = 0; i < output80.bytes.length - 2; i++) {
    if (output80.bytes[i] === 0x1d && output80.bytes[i + 1] === 0x56 && output80.bytes[i + 2] === 0x00) {
      hasCut = true;
      break;
    }
  }
  assert(hasCut, 'ESC/POS contains Full Paper Cut command [0x1D, 0x56, 0x00]');

  // Check Cash Drawer Pulse command [0x1B, 0x70, 0x00, 0x19, 0xFA]
  let hasDrawerPulse = false;
  for (let i = 0; i < output80.bytes.length - 4; i++) {
    if (
      output80.bytes[i] === 0x1b &&
      output80.bytes[i + 1] === 0x70 &&
      output80.bytes[i + 2] === 0x00 &&
      output80.bytes[i + 3] === 0x19 &&
      output80.bytes[i + 4] === 0xfa
    ) {
      hasDrawerPulse = true;
      break;
    }
  }
  assert(hasDrawerPulse, 'ESC/POS contains Cash Drawer Kick Pulse [0x1B, 0x70, 0x00, 0x19, 0xFA]');

  // Direct pulse command generator test
  const pulseDirect = EscPosGenerator.generateCashDrawerPulse();
  assert(
    pulseDirect.length === 5 &&
    pulseDirect[0] === 0x1b &&
    pulseDirect[1] === 0x70 &&
    pulseDirect[2] === 0x00 &&
    pulseDirect[3] === 0x19 &&
    pulseDirect[4] === 0xfa,
    'Direct Cash Drawer Pulse matches standard ESC p 0 25 250'
  );

  // Check Auto Cut disabled
  const profileNoCut: HardwareDeviceProfile = {
    ...profile80,
    auto_cut: false,
    cash_drawer_kick_pulse: false,
  };
  const outputNoCut = EscPosGenerator.generateTestTicket(profileNoCut);
  let hasCutWhenDisabled = false;
  for (let i = 0; i < outputNoCut.bytes.length - 2; i++) {
    if (outputNoCut.bytes[i] === 0x1d && outputNoCut.bytes[i + 1] === 0x56 && outputNoCut.bytes[i + 2] === 0x00) {
      hasCutWhenDisabled = true;
      break;
    }
  }
  assert(!hasCutWhenDisabled, 'Auto cut command is omitted when auto_cut is false');
}

// =========================================================================
// SUITE 6: Roll Width Switching (58mm vs 80mm) & Character Density
// =========================================================================
console.log('\n[Suite 6: Roll Width & Line Density Invariants]');
{
  const profile80: HardwareDeviceProfile = {
    id: 'p-80',
    alias: 'Receipt 80mm',
    station: 'CASHIER_RECEIPT',
    connection_type: 'NETWORK_RAW_9100',
    target_address: '192.168.1.200:9100',
    paper_width_mm: 80,
    character_width: 42,
    code_page: 'CP1256',
    auto_cut: true,
    cash_drawer_kick_pulse: true,
  };

  const profile58: HardwareDeviceProfile = {
    id: 'p-58',
    alias: 'Kitchen 58mm',
    station: 'KITCHEN_KDS',
    connection_type: 'BROWSER_SPOOLER',
    target_address: 'SPOOLER:58mm',
    paper_width_mm: 58,
    character_width: 32,
    code_page: 'CP1256',
    auto_cut: true,
    cash_drawer_kick_pulse: false,
  };

  const out80 = EscPosGenerator.generateTestTicket(profile80);
  const out58 = EscPosGenerator.generateTestTicket(profile58);

  assert(profile80.character_width === 42, '80mm profile defaults to 42 characters per row');
  assert(profile58.character_width === 32, '58mm profile defaults to 32 characters per row');

  assert(
    out80.textPreview.includes('Roll Width:   80mm (42 chars/line)'),
    '80mm test ticket renders 42 characters indicator'
  );
  assert(
    out58.textPreview.includes('Roll Width:   58mm (32 chars/line)'),
    '58mm test ticket renders 32 characters indicator'
  );
}

// =========================================================================
// SUITE 7: Default Settings & Store Profile Invariants
// =========================================================================
console.log('\n[Suite 7: Default Settings Schema Invariants]');
{
  assert(DEFAULT_STORE_PROFILE.name_fa === 'قهوه‌فروشی ۱۰۰هیچ', 'Default store profile name is قهوه‌فروشی ۱۰۰هیچ');
  assert(DEFAULT_STORE_PROFILE.name_en === '100 HICH Coffee Roasters', 'Default English brand is 100 HICH Coffee Roasters');
  assert(DEFAULT_STORE_PROFILE.phone === '021-44668090', 'Default store phone is 021-44668090');
  assert(DEFAULT_STORE_PROFILE.tax_registration_no === '14008923451', 'Default tax registration number matches');

  assert(DEFAULT_FISCAL_RULES.vat_tax_percentage === 9.0, 'Default VAT tax percentage is strictly 9.0%');
  assert(DEFAULT_FISCAL_RULES.currency_display === 'TOMAN', 'Default currency display is TOMAN');

  assert(
    DEFAULT_RECEIPT_TEMPLATE.header_lines.length >= 2,
    'Default receipt template includes at least 2 header lines'
  );
  assert(
    DEFAULT_RECEIPT_TEMPLATE.footer_lines.length >= 3,
    'Default receipt template includes at least 3 footer lines'
  );

  assert(DEFAULT_PRINTER_PROFILES.length === 3, 'System defaults to 3 standard hardware printer profiles');
  assert(
    DEFAULT_PRINTER_PROFILES.some((p) => p.connection_type === 'WEB_SERIAL'),
    'Hardware profiles include Web Serial device'
  );
  assert(
    DEFAULT_PRINTER_PROFILES.some((p) => p.connection_type === 'NETWORK_RAW_9100'),
    'Hardware profiles include Network RAW 9100 device'
  );
  assert(
    DEFAULT_PRINTER_PROFILES.some((p) => p.connection_type === 'BROWSER_SPOOLER'),
    'Hardware profiles include Browser Spooler device'
  );
}

// Wait for async suite 4 to finish
setTimeout(() => {
  console.log('\n========================================');
  console.log(`Test Execution Summary: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================\n');
  if (failedTests > 0) {
    process.exit(1);
  }
}, 500);
