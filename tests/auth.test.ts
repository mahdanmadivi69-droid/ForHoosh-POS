// tests/auth.test.ts

// Mock localStorage for headless Node environment
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.getItem) {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    get length() {
      return store.size;
    },
  };
}

import { SmartOrdersStore } from '../src/services/storage';
import { hashPassword, verifyPassword } from '../src/services/credentials';

// P1-7: the OWNER install code is validated by the local server.
// Mirror that endpoint here so the enrolment gate can be tested headlessly.
const INSTALL_CODE = '123456';
(globalThis as any).fetch = async (_url: any, init?: any) => {
  let code = '';
  try {
    code = JSON.parse(String(init?.body ?? '{}')).code ?? '';
  } catch {
    code = '';
  }
  const ok = code === INSTALL_CODE;
  return {
    ok,
    status: ok ? 200 : 403,
    json: async () => ({ ok }),
  } as any;
};

async function runAuthTests() {
  console.log('\n--- Running Authentication & Security Hardening Test Suite ---');
  SmartOrdersStore.setActiveTenantId('tenant-100hich-01');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 0. P1-7: no implicit claim of any account
  const blockedOwner = await SmartOrdersStore.login('admin', 'AnyPassword1');
  assert(blockedOwner.success === false, 'Credential-less OWNER cannot be claimed by typing a password');
  assert(blockedOwner.requiresEnrollment === true, 'Login reports that enrolment is required');
  assert(blockedOwner.enrollmentRequiresSetupCode === true, 'OWNER enrolment demands the install code');

  const staffBeforeOwner = await SmartOrdersStore.enrollCredential('ali', 'StaffPass1');
  assert(staffBeforeOwner.success === false, 'Staff cannot enrol before the OWNER is set up');

  const ownerNoCode = await SmartOrdersStore.enrollCredential('admin', 'Admin@100Hich');
  assert(ownerNoCode.success === false, 'OWNER enrolment without the install code is rejected');

  const ownerWrongCode = await SmartOrdersStore.enrollCredential('admin', 'Admin@100Hich', '000000');
  assert(ownerWrongCode.success === false, 'OWNER enrolment with a wrong install code is rejected');

  const ownerEnrolled = await SmartOrdersStore.enrollCredential('admin', 'Admin@100Hich', INSTALL_CODE);
  assert(ownerEnrolled.success === true, 'OWNER enrolment with the install code succeeds');
  assert(SmartOrdersStore.hasOwnerCredential() === true, 'hasOwnerCredential() is true after enrolment');

  // 1. Login with the enrolled credential
  const users = SmartOrdersStore.getUsers();
  const testUser = users[0]; // admin
  const setupRes = await SmartOrdersStore.login(testUser.username, 'Admin@100Hich');
  assert(setupRes.success === true, 'Login with the enrolled password succeeds');
  assert(setupRes.user?.credential !== undefined, 'User has a SecureCredential after enrolment');
  assert(setupRes.user?.mustChangePassword === false, 'mustChangePassword is cleared after enrolment');

  // 2. Correct password verification
  const validLogin = await SmartOrdersStore.login(testUser.username, 'Admin@100Hich');
  assert(validLogin.success === true, 'Subsequent login with correct password succeeds');

  // 3. Wrong password verification
  const wrongLogin = await SmartOrdersStore.login(testUser.username, 'WrongPassword');
  assert(wrongLogin.success === false, 'Login with incorrect password fails');
  assert(wrongLogin.error?.includes('نادرست') === true, 'Returns incorrect password error');

  // 3b. P1-7: restoring a backup must never erase established credentials
  const backupJson = SmartOrdersStore.exportBackupData();
  const importRes = SmartOrdersStore.importBackupData(backupJson);
  assert(importRes.success === true, 'Backup round-trip imports successfully');
  const ownerAfterRestore = SmartOrdersStore.getUsers().find((u) => u.id === 'user-01');
  assert(!!ownerAfterRestore?.credential, 'OWNER credential survives a backup restore');
  const ownerStillLogsIn = await SmartOrdersStore.login('admin', 'Admin@100Hich');
  assert(ownerStillLogsIn.success === true, 'OWNER can still log in after a backup restore');

  // 4. Throttling: 5 consecutive failures triggers lockout
  for (let i = 0; i < 5; i++) {
    await SmartOrdersStore.login(testUser.username, 'WrongPassword');
  }
  const lockedLogin = await SmartOrdersStore.login(testUser.username, 'Admin@100Hich');
  assert(lockedLogin.success === false, 'Account locked out after 5 consecutive failures');
  assert(lockedLogin.error?.includes('بیش از حد مجاز') === true, 'Lockout error message returned');

  // 5. Plaintext password strip invariant
  const rawUsers = SmartOrdersStore.getUsers();
  const hasPlaintext = rawUsers.some((u) => (u as any).password !== undefined);
  assert(!hasPlaintext, 'No user in storage contains a plaintext password field');

  // 6. localStorage JSON contains no 'password' key
  const storedJson = localStorage.getItem('smartorders_users_v1');
  const jsonHasPassword = storedJson ? /"password"\s*:/.test(storedJson) : false;
  assert(!jsonHasPassword, 'localStorage JSON for users contains no "password" key');

  console.log(`\nAuth Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runAuthTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
