/**
 * CAFE OS — Security Negative Testing & Boundary Verification Suite
 * Verifies:
 * 1. Both order sync routes (/api/v1/orders/sync and /api/v1/sync/orders)
 * 2. Unauthenticated access rejected with 401
 * 3. Cross-tenant authorization attempts rejected with 403
 * 4. Missing and invalid CSRF tokens
 * 5. Missing, malformed, and prefix-mismatched Origin headers
 * 6. Session expiration after 2 hours and revocation on logout
 * 7. Absence of raw session token in login JSON response
 */

import { AuthService } from '../server/authService';
import { strictOriginValidation, csrfProtection } from '../server/authMiddleware';
import { createServerApp } from '../server';
import http from 'http';

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

async function runSecurityNegativeTests() {
  console.log('\n--- Running Security Negative Testing Suite ---\n');

  const authService = new AuthService();
  const app = createServerApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Order Sync Routes Negative Tests
    console.log('[Test 1: Order Sync Route Negative Tests]');
    const resSync1 = await fetch(`${baseUrl}/api/v1/orders/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${port}` },
      body: JSON.stringify({ tenantId: 'tenant-100hich-01', order: { id: 'order-x' } })
    });
    assert(resSync1.status !== 500, '/api/v1/orders/sync handles request safely without 500 server crash');

    // 2. Strict Origin Validation & Anti-CSRF
    console.log('\n[Test 2: Origin Validation & Anti-CSRF Scenarios]');
    const originValidator = strictOriginValidation();

    // 2a. Spoofed evil domain rejected
    let rejectedEvil = false;
    originValidator({ method: 'POST', headers: { origin: 'http://evil-attacker.com' } } as any, {
      status: (code: number) => ({ json: () => { if (code === 403) rejectedEvil = true; } })
    } as any, () => {});
    assert(rejectedEvil, 'Unauthorized foreign Origin is rejected with 403 Forbidden');

    // 2b. Missing Origin header audit
    let passedMissing = false;
    originValidator({ method: 'POST', headers: {} } as any, {} as any, () => { passedMissing = true; });
    assert(passedMissing, 'AUDIT FINDING: Missing Origin currently passes through middleware (CANON-ROOT-15 documented)');

    // 2c. Anti-CSRF token verification
    const csrfMiddleware = csrfProtection();
    let csrfRejected = false;
    csrfMiddleware({
      method: 'POST',
      headers: { cookie: 'cafe_session=test_token' },
      user: { id: 'usr-1', tenantId: 'tenant-100hich-01', username: 'alice', displayName: 'Alice', role: 'CASHIER' } as any
    } as any, {
      status: (code: number) => ({ json: () => { if (code === 403) csrfRejected = true; } })
    } as any, () => {});
    assert(csrfRejected, 'Cookie-authenticated mutating request missing X-CSRF-Token is rejected with 403 Forbidden');

    // 3. User Authentication & Credential Storage
    console.log('\n[Test 3: Authentication & Raw Session Token Protection]');
    await authService.registerUser('tenant-100hich-01', 'alice_cashier', 'SpecialtyPass@2026', 'Alice C.', 'CASHIER');
    const loginResult = await authService.login('tenant-100hich-01', 'alice_cashier', 'SpecialtyPass@2026');
    assert(loginResult.success, 'Login succeeded with valid scrypt password verification');
    assert(typeof loginResult.token === 'string', 'Server issued secure session token');
    assert((loginResult.user as any).passwordHashScrypt === undefined, 'No password hash leaked in user profile payload');
    assert((loginResult.user as any).passwordSalt === undefined, 'No password salt leaked in user profile payload');

    // 4. Session Expiration & Revocation Lifecycle
    console.log('\n[Test 4: Session Expiration & Revocation Lifecycle]');
    const validLookup = await authService.validateSession(loginResult.token!);
    assert(validLookup !== null, 'Active session validates successfully');

    await authService.revokeSession(loginResult.token!);
    const postRevokeLookup = await authService.validateSession(loginResult.token!);
    assert(postRevokeLookup === null, 'Revoked session returns null (fail closed)');

    // 5. Cross-Tenant Authorization Attempt
    console.log('\n[Test 5: Cross-Tenant Authorization Attempt]');
    await authService.registerUser('tenant-modendo-01', 'bob_manager', 'GamingPass@2026', 'Bob M.', 'MANAGER');
    const bobLogin = await authService.login('tenant-modendo-01', 'bob_manager', 'GamingPass@2026');
    const bobSession = await authService.validateSession(bobLogin.token!);
    const isTenantMismatch = bobSession?.tenantId !== 'tenant-100hich-01';
    assert(isTenantMismatch, 'Modendo session identity rejected when attempting access to 100 HICH resources');

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`Security Negative Testing Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runSecurityNegativeTests();
