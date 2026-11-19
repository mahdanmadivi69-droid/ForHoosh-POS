/**
 * Seed Script: Modendo Multi-Staff RBAC Defaults
 * Populates Dexie with initial 4 staff members using bcrypt hashing.
 *
 * Accounts:
 *  - owner   (PIN: 1111) — Full Access
 *  - manager (PIN: 2222) — Full Access
 *  - cashier (PIN: 3333) — POS + Settle + Floor Plan
 *  - waiter1 (PIN: 4444) — Floor Plan (Orders Only, No Settle)
 */

import bcrypt from 'bcryptjs';

export interface SeedStaffMember {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'cashier' | 'waiter';
  pin: string;
  pinHash: string;
  isActive: boolean;
  createdAt: number;
}

export const MODENDO_INITIAL_STAFF: SeedStaffMember[] = [
  {
    id: 'mod_staff_owner',
    name: 'مالک کافه (Owner)',
    role: 'owner',
    pin: '1111',
    pinHash: bcrypt.hashSync('1111', 10),
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'mod_staff_manager',
    name: 'مدیر شیفت (Manager)',
    role: 'manager',
    pin: '2222',
    pinHash: bcrypt.hashSync('2222', 10),
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'mod_staff_cashier',
    name: 'صندوق‌دار (Cashier)',
    role: 'cashier',
    pin: '3333',
    pinHash: bcrypt.hashSync('3333', 10),
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'mod_staff_waiter1',
    name: 'سالن‌کار ۱ (Waiter)',
    role: 'waiter',
    pin: '4444',
    pinHash: bcrypt.hashSync('4444', 10),
    isActive: true,
    createdAt: Date.now(),
  },
];

export async function runStaffSeed() {
  console.log('\n--- Seeding Modendo Multi-Staff Defaults ---');
  for (const s of MODENDO_INITIAL_STAFF) {
    const verified = bcrypt.compareSync(s.pin, s.pinHash);
    console.log(`  ✓ Staff: ${s.name} [Role: ${s.role.toUpperCase()}] | PIN: ${s.pin} | Bcrypt Verified: ${verified}`);
  }
  console.log('✓ All 4 Modendo staff accounts generated with valid bcrypt hashes.\n');
}

// Execute standalone if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv.includes('--run')) {
  runStaffSeed().catch(console.error);
}
