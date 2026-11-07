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

async function runAuthTests() {
  console.log('\n--- Running Authentication & Security Hardening Test Suite ---');
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

  // 1. Initial credential setup & login
  const users = SmartOrdersStore.getUsers();
  const testUser = users[0]; // admin
  const setupRes = await SmartOrdersStore.login(testUser.username, 'Admin@100Hich');
  assert(setupRes.success === true, 'First-run setup with password succeeds');
  assert(setupRes.user?.credential !== undefined, 'User receives SecureCredential after first login');
  assert(setupRes.user?.mustChangePassword === false, 'mustChangePassword cleared after setup');

  // 2. Correct password verification
  const validLogin = await SmartOrdersStore.login(testUser.username, 'Admin@100Hich');
  assert(validLogin.success === true, 'Subsequent login with correct password succeeds');

  // 3. Wrong password verification
  const wrongLogin = await SmartOrdersStore.login(testUser.username, 'WrongPassword');
  assert(wrongLogin.success === false, 'Login with incorrect password fails');
  assert(wrongLogin.error?.includes('نادرست') === true, 'Returns incorrect password error');

  // 4. Throttling: 5 consecutive failures triggers lockout
  for (let i = 0; i < 4; i++) {
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
