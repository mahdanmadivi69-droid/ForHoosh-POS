/**
 * CAFE OS — Full-Stack Server HTTP Integration & Endpoint Verification Suite
 * Compliant with CODA P2 Acceptance Gate
 *
 * Authored by: A05-SENTINEL (QA and Regression Engineer)
 * Target under test: server.ts, server/authRoutes.ts, server/kdsService.ts
 */

import http from 'http';
import { createServerApp } from '../server';
import { getAuthService } from '../server/authService';
import { getKdsService } from '../server/kdsService';

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

console.log('\n--- Running CODA P2 Server HTTP Integration Verification Suite ---');

async function runHttpTests() {
  getKdsService().clearForTest();
  getAuthService().clearSessionsForTest();

  const app = createServerApp();
  const server = http.createServer(app);

  // Start on an ephemeral free OS port
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // =========================================================================
    // Suite 1: Unauthenticated Endpoint Protection
    // =========================================================================
    console.log('\n[Suite 1: Unauthenticated Endpoint Protection]');

    // GET /api/v1/kds/tickets without session
    const unauthRes = await fetch(`${baseUrl}/api/v1/kds/tickets`);
    assertEqual(unauthRes.status, 401, 'Unauthenticated request to KDS tickets returns 401 Unauthorized');

    // POST /api/v1/kds/tickets/dispatch without session
    const unauthDispatchRes = await fetch(`${baseUrl}/api/v1/kds/tickets/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'test' }),
    });
    assertEqual(unauthDispatchRes.status, 401, 'Unauthenticated request to KDS dispatch returns 401 Unauthorized');

    // =========================================================================
    // Suite 2: HTTP Login & Cookie Management
    // =========================================================================
    console.log('\n[Suite 2: HTTP Login & Cookie Management]');

    // Login as 100 HICH barista
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-100hich-01',
        username: 'nima_barista',
        password: 'Nima@100',
      }),
    });

    assertEqual(loginRes.status, 200, 'Barista login returns 200 OK');
    const loginData = await loginRes.json();
    assert(loginData.success === true, 'Login response success is true');
    assertEqual(loginData.user.tenantId, 'tenant-100hich-01', 'Tenant is tenant-100hich-01');

    const setCookieHeader = loginRes.headers.get('set-cookie');
    assert(!!setCookieHeader, 'Set-Cookie header present');
    assert(setCookieHeader!.includes('HttpOnly'), 'Cookie is marked HttpOnly');
    assert(setCookieHeader!.includes('coda_session='), 'Cookie contains coda_session token');

    const cookieValue = setCookieHeader!.split(';')[0]; // e.g. coda_session=xxx
    const rawToken = loginData.token;

    // =========================================================================
    // Suite 3: Authenticated KDS Dispatch via HTTP
    // =========================================================================
    console.log('\n[Suite 3: Authenticated KDS Dispatch via HTTP]');

    const uniqueSuffix = Date.now();
    const dispatchOrderPayload = {
      orderId: `ord_http_${uniqueSuffix}`,
      orderNumber: 777,
      tableLabel: 'میز ۱۰',
      items: [
        { id: `it_capp_${uniqueSuffix}`, title: 'کاپوچینو تخصصی ۱۰۰هیچ', categoryId: 'espresso', quantity: 2 },
        { id: `it_panini_${uniqueSuffix}`, title: 'پنینی بوقلمون دودی', categoryId: 'sandwiches', quantity: 1 },
      ],
    };

    const dispatchHttpRes = await fetch(`${baseUrl}/api/v1/kds/tickets/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieValue,
      },
      body: JSON.stringify(dispatchOrderPayload),
    });

    assertEqual(dispatchHttpRes.status, 200, 'KDS dispatch via HTTP returns 200 OK');
    const dispatchData = await dispatchHttpRes.json();
    assert(dispatchData.success === true, 'KDS dispatch success is true');
    assert(!!dispatchData.result.barTicket, 'BAR ticket returned in response');
    assert(!!dispatchData.result.kitchenTicket, 'KITCHEN ticket returned in response');
    assertEqual(dispatchData.result.dispatchedCount, 2, '2 items dispatched');

    const barTicketId = dispatchData.result.barTicket.id;
    const kitchenTicketId = dispatchData.result.kitchenTicket.id;

    // =========================================================================
    // Suite 4: Authenticated Ticket Retrieval & Tenant Isolation
    // =========================================================================
    console.log('\n[Suite 4: Authenticated Ticket Retrieval & Tenant Isolation]');

    // Retrieve tickets as 100 HICH barista
    const getTicketsRes = await fetch(`${baseUrl}/api/v1/kds/tickets`, {
      headers: { Cookie: cookieValue },
    });
    assertEqual(getTicketsRes.status, 200, 'GET /kds/tickets returns 200 OK');
    const ticketsData = await getTicketsRes.json();
    assert(ticketsData.tickets.some((t: any) => t.id === barTicketId), 'Created BAR ticket present in list');

    // Attempt Cross-Tenant Request: 100 HICH user asking for tenant-modendo-01 via X-Tenant-Id header
    const crossTenantRes = await fetch(`${baseUrl}/api/v1/kds/tickets`, {
      headers: {
        Cookie: cookieValue,
        'X-Tenant-Id': 'tenant-modendo-01',
      },
    });
    assertEqual(crossTenantRes.status, 403, 'Cross-tenant request with forged X-Tenant-Id returns 403 Forbidden');

    // =========================================================================
    // Suite 5: Status Mutation & Cross-Station Enforcement
    // =========================================================================
    console.log('\n[Suite 5: Status Mutation & Cross-Station Enforcement]');

    // Barista updates BAR ticket to IN_PREP
    const updateBarRes = await fetch(`${baseUrl}/api/v1/kds/tickets/${barTicketId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieValue,
      },
      body: JSON.stringify({ prepStatus: 'IN_PREP', callerStation: 'BAR' }),
    });
    assertEqual(updateBarRes.status, 200, 'BAR status update returns 200 OK');

    // Barista tries to mutate KITCHEN ticket
    const crossStationRes = await fetch(`${baseUrl}/api/v1/kds/tickets/${kitchenTicketId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieValue,
      },
      body: JSON.stringify({ prepStatus: 'COMPLETED', callerStation: 'BAR' }),
    });
    assertEqual(crossStationRes.status, 403, 'BAR caller mutating KITCHEN ticket returns 403 Forbidden');

    // =========================================================================
    // Suite 6: Ticket Cancellation & Reopening via HTTP
    // =========================================================================
    console.log('\n[Suite 6: Ticket Cancellation & Reopening via HTTP]');

    const cancelRes = await fetch(`${baseUrl}/api/v1/kds/tickets/${barTicketId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieValue,
      },
      body: JSON.stringify({ reason: 'دستگاه اسپرسو خاموش شد' }),
    });
    assertEqual(cancelRes.status, 200, 'Cancel ticket returns 200 OK');
    const cancelData = await cancelRes.json();
    assertEqual(cancelData.ticket.status, 'CANCELLED', 'Ticket status updated to CANCELLED');

    const reopenRes = await fetch(`${baseUrl}/api/v1/kds/tickets/${barTicketId}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieValue,
      },
      body: JSON.stringify({}),
    });
    assertEqual(reopenRes.status, 200, 'Reopen ticket returns 200 OK');
    const reopenData = await reopenRes.json();
    assertEqual(reopenData.ticket.status, 'PENDING', 'Ticket status reset to PENDING');

    // =========================================================================
    // Suite 7: HTTP Logout & Post-Logout Invalidation
    // =========================================================================
    console.log('\n[Suite 7: HTTP Logout & Post-Logout Invalidation]');

    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieValue },
    });
    assertEqual(logoutRes.status, 200, 'Logout returns 200 OK');

    // Request with now-revoked cookie
    const postLogoutReq = await fetch(`${baseUrl}/api/v1/kds/tickets`, {
      headers: { Cookie: cookieValue },
    });
    assertEqual(postLogoutReq.status, 401, 'Post-logout request is rejected with 401 Unauthorized');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n========================================');
    console.log(`Server HTTP Integration Summary: ${passedTests} Passed, 0 Failed`);
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

runHttpTests().catch((err) => {
  console.error('HTTP test execution failed:', err);
  process.exit(1);
});
