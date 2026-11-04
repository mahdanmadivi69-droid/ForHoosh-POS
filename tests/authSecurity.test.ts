/**
 * CAFE OS — Authentication & Security Boundaries Verification Suite
 * Compliant with CODA P2 Security Directives & Engineering Invariants
 *
 * Authored by: A05-SENTINEL (QA and Regression Engineer)
 * Target under test: server/authService.ts, server/authMiddleware.ts, server/authRoutes.ts (owned by A07-GATEKEEPER)
 */

import { getAuthService, AuthService, UserRole } from '../server/authService';
import {
  extractSessionToken,
  parseCookies,
  requireAuth,
  requireTenantMembership,
  requireRole,
  strictOriginValidation,
  AuthenticatedRequest,
} from '../server/authMiddleware';
import { createServerApp } from '../server';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual !== expected) {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    throw new Error(`Assertion failed: ${message} (Expected: ${expected}, Got: ${actual})`);
  }
  passedTests++;
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n--- Running CODA P2 Authentication & Security Verification Suite ---');

const authService = new AuthService();

async function runAuthTests() {
  // =========================================================================
  // Suite 1: Native Node crypto.scrypt Password Hashing & Verification
  // =========================================================================
  console.log('\n[Suite 1: Native Node crypto.scrypt Password Verification]');

  const testPass = 'SpecialtyCoffee@2026';
  const { hash, salt } = await authService.hashPassword(testPass);

  assert(typeof hash === 'string' && hash.length === 128, 'Scrypt hash is 128 hex chars (64 bytes)');
  assert(typeof salt === 'string' && salt.length === 32, 'Salt is 32 hex chars (16 bytes)');

  const verifyValid = await authService.verifyPassword(testPass, hash, salt);
  assert(verifyValid === true, 'Valid password successfully verifies via scrypt');

  const verifyInvalid = await authService.verifyPassword('WrongPassword123', hash, salt);
  assert(verifyInvalid === false, 'Incorrect password strictly rejected');

  const verifyEmpty = await authService.verifyPassword('', hash, salt);
  assert(verifyEmpty === false, 'Empty password strictly rejected');

  // Verify uniqueness of salts across different hash generations
  const { hash: hash2, salt: salt2 } = await authService.hashPassword(testPass);
  assert(salt !== salt2, 'Salts are cryptographically unique for each hash');
  assert(hash !== hash2, 'Identical password produces distinct digests with distinct salts');

  // =========================================================================
  // Suite 2: Server-Managed Sessions & Token Hashing (Zero Raw Tokens in DB)
  // =========================================================================
  console.log('\n[Suite 2: Server-Managed Sessions & Token Hashing]');

  // 100 HICH login with seeded user
  const hichLogin = await authService.login('tenant-100hich-01', 'sara_manager', 'Sara@100');
  assert(hichLogin.success === true, 'Seeded manager login successful');
  assert(typeof hichLogin.token === 'string', 'Random session token returned to client');
  assertEqual(hichLogin.token?.length, 64, 'Session token is 64 hex characters (256-bit cryptorandom)');
  assertEqual(hichLogin.user?.tenantId, 'tenant-100hich-01', 'User tenantId is tenant-100hich-01');
  assertEqual(hichLogin.user?.role, 'MANAGER', 'User role is MANAGER');

  // Verify Raw Token is NOT stored directly (only token hash)
  const tokenHash = authService.hashToken(hichLogin.token!);
  const validatedSession = authService.validateSession(hichLogin.token!);
  assert(!!validatedSession, 'Session successfully validated via raw token lookup');
  assertEqual(validatedSession?.tokenHash, tokenHash, 'Server stores SHA-256 tokenHash, NEVER raw token');
  assertEqual(validatedSession?.username, 'sara_manager', 'Session username matches');

  // =========================================================================
  // Suite 3: Session Expiry, Invalidation & Revocation Lifecycle
  // =========================================================================
  console.log('\n[Suite 3: Session Expiry, Invalidation & Revocation Lifecycle]');

  // Revoke session (Logout)
  const revoked = authService.revokeSession(hichLogin.token!);
  assert(revoked === true, 'Session revocation reported true');

  // Subsequent validation must fail
  const postRevokeValidate = authService.validateSession(hichLogin.token!);
  assert(postRevokeValidate === null, 'CRITICAL: Revoked session returns null (access denied)');

  // Fake / non-existent token validation
  const fakeValidate = authService.validateSession('fake_token_0000000000000000000000000000000000000000000000000000000000000000');
  assert(fakeValidate === null, 'Non-existent session token returns null');

  // =========================================================================
  // Suite 4: Challenge Bypass Attempt Rejection
  // =========================================================================
  console.log('\n[Suite 4: Challenge Bypass Attempt Rejection]');

  // Attempt to log in with challenge ID or mock password shortcut
  const bypassAttempt1 = await authService.login('tenant-100hich-01', 'owner_100hich', 'challenge_id_bypass_token');
  assert(bypassAttempt1.success === false, 'CRITICAL INVARIANT: Challenge ID is strictly rejected as password');
  assertEqual(bypassAttempt1.token, undefined, 'No session issued on challenge ID shortcut');

  const bypassAttempt2 = await authService.login('tenant-modendo-01', 'owner_modendo', '');
  assert(bypassAttempt2.success === false, 'Empty password strictly rejected');

  // =========================================================================
  // Suite 5: Cross-Tenant Authorization & Spoof Denial
  // =========================================================================
  console.log('\n[Suite 5: Cross-Tenant Authorization & Spoof Denial]');

  // 1. Modendo login
  const modendoLogin = await authService.login('tenant-modendo-01', 'mahsa_cashier', 'Mahsa@Mod');
  assert(modendoLogin.success === true, 'Modendo cashier login successful');

  // 2. Modendo user trying to log into 100 HICH with Modendo credentials
  const crossTenantLogin = await authService.login('tenant-100hich-01', 'mahsa_cashier', 'Mahsa@Mod');
  assert(crossTenantLogin.success === false, 'User from Modendo cannot log into 100 HICH');

  // 3. Test requireTenantMembership middleware:
  // User belongs to tenant-modendo-01 but requests tenant-100hich-01 via X-Tenant-Id header
  const mockReq: any = {
    user: authService.validateSession(modendoLogin.token!),
    headers: { 'x-tenant-id': 'tenant-100hich-01' },
    params: {},
    query: {},
  };

  let middlewareErrorStatus = 0;
  let middlewareErrorMessage = '';
  const mockRes: any = {
    status(code: number) {
      middlewareErrorStatus = code;
      return this;
    },
    json(body: any) {
      middlewareErrorMessage = body.error;
    },
  };

  const tenantGuard = requireTenantMembership('x-tenant-id');
  let nextCalled = false;
  tenantGuard(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert(!nextCalled, 'Cross-tenant request was blocked before reaching handler');
  assertEqual(middlewareErrorStatus, 403, 'Cross-tenant request rejected with HTTP 403 Forbidden');
  assert(middlewareErrorMessage.includes('Cross-tenant access denied'), 'Error message confirms cross-tenant denial');

  // =========================================================================
  // Suite 6: Role Escalation Prevention (RBAC)
  // =========================================================================
  console.log('\n[Suite 6: Role Escalation Prevention (RBAC)]');

  const cashierSession = authService.validateSession(modendoLogin.token!);
  const mockCashierReq: any = { user: cashierSession };
  let rbacStatus = 0;
  const mockRbacRes: any = {
    status(code: number) {
      rbacStatus = code;
      return this;
    },
    json() {},
  };

  const ownerGuard = requireRole(['OWNER', 'MANAGER']);
  let rbacNextCalled = false;
  ownerGuard(mockCashierReq, mockRbacRes, () => {
    rbacNextCalled = true;
  });

  assert(!rbacNextCalled, 'Cashier blocked from accessing Owner-restricted route');
  assertEqual(rbacStatus, 403, 'Role escalation attempt rejected with HTTP 403 Forbidden');

  // =========================================================================
  // Suite 7: Strict Origin Validation for CSRF Protection
  // =========================================================================
  console.log('\n[Suite 7: Strict Origin Validation for CSRF Protection]');

  const originMiddleware = strictOriginValidation();

  // Attack from malicious site
  const evilReq: any = {
    method: 'POST',
    headers: { origin: 'https://malicious-phishing-attacker.com' },
  };
  let originStatus = 0;
  const mockOriginRes: any = {
    status(code: number) {
      originStatus = code;
      return this;
    },
    json() {},
  };

  let originNextCalled = false;
  originMiddleware(evilReq, mockOriginRes, () => {
    originNextCalled = true;
  });

  assert(!originNextCalled, 'Malicious external origin blocked on mutating request');
  assertEqual(originStatus, 403, 'Rejected with HTTP 403 Forbidden');

  // Legitimate request from localhost
  const legitReq: any = {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  };
  let legitNextCalled = false;
  originMiddleware(legitReq, mockOriginRes, () => {
    legitNextCalled = true;
  });
  assert(legitNextCalled, 'Legitimate local origin allowed through');

  // =========================================================================
  // Suite 8: Account Lockout after Repeated Failed Attempts
  // =========================================================================
  console.log('\n[Suite 8: Account Lockout after Repeated Failed Attempts]');

  // Attempt 5 incorrect passwords
  for (let i = 0; i < 5; i++) {
    await authService.login('tenant-100hich-01', 'nima_barista', `WrongPass${i}`);
  }

  // 6th attempt even with correct password should be locked
  const lockedAttempt = await authService.login('tenant-100hich-01', 'nima_barista', 'Nima@100');
  assert(lockedAttempt.success === false, 'Account locked after 5 consecutive failed attempts');
  assert(lockedAttempt.error?.includes('locked') === true, 'Error indicates account lockout');

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n========================================');
  console.log(`Authentication & Security Summary: ${passedTests} Passed, 0 Failed`);
  console.log('========================================\n');
}

runAuthTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
