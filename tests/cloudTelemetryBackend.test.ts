/**
 * tests/cloudTelemetryBackend.test.ts
 * 
 * Verification suite for Cloud Telemetry & License Backend (Phase 2 Stage B)
 * Authored by: alpha (Cloud Telemetry & License Specialist)
 * Checked by: argus (Quality & Invariant Gate)
 * 
 * Enforces:
 *  - [INTEGER_TOMAN_PRECISION]: Schema rejection for decimal prices
 *  - [TENANT_ISOLATION_MANDATORY]: Complete partition between 100 HICH and Modendo
 *  - [ZERO_DEPENDENCY_JWT]: RFC 7519 HMAC-SHA256 lease validation
 *  - [ZERO_IDLE_RESILIENCE]: Rapid bootstrap and disk persistence
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import {
  CloudTelemetryService,
  getCloudTelemetryService,
} from '../server/cloudTelemetryService';
import {
  createCloudTelemetryRouter,
  handleNativeHttpRequest,
} from '../server/cloudTelemetryRoutes';
import { createServerApp } from '../server';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- Running Cloud Telemetry & License Backend Verification Suite (Stage B) ---\n');

  const testTmpDir = path.resolve(process.cwd(), '.test_telemetry_tmp');
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  }

  const service = new CloudTelemetryService({
    storageDir: testTmpDir,
    jwtSecret: 'test_secret_key_stage_b_123',
  });

  // SUITE 1: Command Push & Strict Integer Toman Invariant
  console.log('[Suite 1: Remote Command Queue & Integer Toman Invariant]');
  {
    // Valid integer price
    const cmd1 = service.pushCommand('100hich', 'UPDATE_PRICE', {
      productId: 'espresso-single',
      newPriceToman: 65000,
      reason: 'Standard price adjustment',
    });
    assert(cmd1.seq === 1, 'First command receives seq 1');
    assert(cmd1.payload.newPriceToman === 65000, 'Price stored as integer 65000 Toman');
    assert(cmd1.tenantId === '100hich', 'Command strictly tagged with tenant 100hich');

    // Float rejection
    let floatCaught = false;
    try {
      service.pushCommand('100hich', 'UPDATE_PRICE', {
        productId: 'espresso-single',
        newPriceToman: 70000.5, // VIOLATION
      });
    } catch (e: any) {
      floatCaught = e.message.includes('Financial Invariant Violation');
    }
    assert(floatCaught, 'Strictly rejects float prices (70000.5 Toman)');

    // Negative rejection
    let negCaught = false;
    try {
      service.pushCommand('100hich', 'UPDATE_PRICE', {
        productId: 'espresso-single',
        newPriceToman: -100, // VIOLATION
      });
    } catch (e: any) {
      negCaught = e.message.includes('Financial Invariant Violation');
    }
    assert(negCaught, 'Strictly rejects negative prices (-100 Toman)');

    // Stock toggle
    const stockCmd = service.pushCommand('100hich', 'TOGGLE_STOCK', {
      productId: 'espresso-single',
      inStock: false,
    });
    assert(stockCmd.seq === 2, 'Next command receives seq 2');
    assert(stockCmd.payload.inStock === false, 'Stock toggle payload accepted');
  }

  // SUITE 2: Multi-Tenant Queue Isolation
  console.log('\n[Suite 2: Multi-Tenant Queue Isolation & Sequence Filtering]');
  {
    const modendoCmd = service.pushCommand('modendo', 'UPDATE_PRICE', {
      productId: 'boardgame-pass',
      newPriceToman: 120000,
    });
    assert(modendoCmd.seq === 1, 'Modendo sequence starts independently at seq 1');

    // Pull 100hich from seq 0
    const pull100 = service.pullCommands('100hich', 0);
    assert(pull100.commands.length === 2, '100 HICH has 2 pending commands');
    assert(pull100.latestSeq === 2, '100 HICH latestSeq is 2');
    assert(
      !pull100.commands.some((c) => c.tenantId === 'modendo'),
      'Zero leakage: Modendo command not present in 100 HICH pull'
    );

    // Pull 100hich from seq 1 (incremental)
    const pull100Inc = service.pullCommands('100hich', 1);
    assert(pull100Inc.commands.length === 1, 'Incremental pull returns only commands with seq > 1');
    assert(pull100Inc.commands[0].seq === 2, 'Incremental command is seq 2');

    // Pull modendo
    const pullMod = service.pullCommands('modendo', 0);
    assert(pullMod.commands.length === 1, 'Modendo pull has exactly 1 command');
    assert(pullMod.commands[0].payload.newPriceToman === 120000, 'Modendo command price is 120000 Toman');
  }

  // SUITE 3: Telemetry Event Ingestion
  console.log('\n[Suite 3: Telemetry Ingestion & Memory Safeguards]');
  {
    const tel1 = service.recordTelemetry({
      tenantId: '100hich',
      terminalId: 'POS_MAIN_01',
      appVersion: '0.15.0',
      timestamp: Date.now(),
      type: 'HEARTBEAT',
      metrics: {
        memoryUsageMb: 35,
        errorCount: 0,
        offlineQueueSize: 0,
      },
    });
    assert(tel1.id.startsWith('tel_'), 'Telemetry event assigned unique ID');

    const telErr = service.recordTelemetry({
      tenantId: '100hich',
      terminalId: 'POS_MAIN_01',
      appVersion: '0.15.0',
      timestamp: Date.now(),
      type: 'PRINT_FAILURE',
      errorDetails: 'Thermal paper cutter jam detected on EP58',
    });
    assert(telErr.type === 'PRINT_FAILURE', 'Recorded print failure alert');

    const records = service.getTelemetry('100hich', 10);
    assert(records.length === 2, 'Retrieved 2 telemetry records for 100hich');
  }

  // SUITE 4: License Verification & Lease-Based JWT
  console.log('\n[Suite 4: License Verification & Lease-Based JWT]');
  {
    const lease = service.generateLicenseLease('100hich', 'POS_MAIN_01');
    assert(typeof lease.token === 'string' && lease.token.split('.').length === 3, 'Generated 3-segment RFC 7519 JWT');
    assert(lease.expiresAt > Math.floor(Date.now() / 1000), 'Expiration is in future (7-day lease)');

    // Verify valid token
    const verification = service.verifyLicenseLease(lease.token);
    assert(verification.valid === true, 'Lease JWT verified successfully');
    assert(verification.payload?.sub === '100hich', 'Subject matches 100hich');
    assert(
      verification.payload?.features.includes('INTEGER_TOMAN_ACCOUNTING'),
      'Lease contains mandatory INTEGER_TOMAN_ACCOUNTING feature flag'
    );

    // Tampered token rejection
    const tampered = lease.token.slice(0, -5) + 'AAAAA';
    const tamperedVerif = service.verifyLicenseLease(tampered);
    assert(!tamperedVerif.valid, 'Tampered token signature rejected');
  }

  // SUITE 5: Zero-Idle Persistence Recovery
  console.log('\n[Suite 5: Zero-Idle Disk Persistence & Bootstrap Recovery]');
  {
    service.flushToDisk();

    // Reconstruct new instance from identical directory
    const recoveredService = new CloudTelemetryService({
      storageDir: testTmpDir,
      jwtSecret: 'test_secret_key_stage_b_123',
    });

    const recoveredPull = recoveredService.pullCommands('100hich', 0);
    assert(recoveredPull.commands.length === 2, 'Successfully recovered all commands from disk on cold restart');
    assert(recoveredPull.latestSeq === 2, 'Recovered sequence counter from disk');

    const recoveredTel = recoveredService.getTelemetry('100hich', 10);
    assert(recoveredTel.length === 2, 'Successfully recovered telemetry logs from disk on cold restart');
  }

  // SUITE 6: Native HTTP Dispatcher (Liara Microservice Interface)
  console.log('\n[Suite 6: Standalone Native HTTP Server & Express Integration]');
  {
    const server = http.createServer(async (req, res) => {
      const handled = await handleNativeHttpRequest(req, res, service);
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Test GET /api/v1/sync/pull via fetch
      const pullRes = await fetch(`${baseUrl}/api/v1/sync/pull?tenantId=100hich&lastSeq=1`);
      assert(pullRes.status === 200, 'Native HTTP GET /api/v1/sync/pull returns 200');
      const pullData: any = await pullRes.json();
      assert(pullData.commands.length === 1, 'Returned 1 command with seq > 1');

      // Test POST /api/v1/commands/push with float price via HTTP
      const floatRes = await fetch(`${baseUrl}/api/v1/commands/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: '100hich',
          type: 'UPDATE_PRICE',
          payload: {
            productId: 'test-item',
            newPriceToman: 45000.99, // Float error
          },
        }),
      });
      assert(floatRes.status === 400, 'HTTP POST /commands/push rejects float price with 400 Bad Request');
      const floatJson: any = await floatRes.json();
      assert(
        floatJson.error.includes('Financial Invariant Violation'),
        'Returns Financial Invariant Violation error message'
      );

      // Test POST /api/v1/license/verify via HTTP
      const licRes = await fetch(`${baseUrl}/api/v1/license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: '100hich',
          terminalId: 'POS_MAIN_01',
        }),
      });
      assert(licRes.status === 200, 'HTTP POST /license/verify returns 200');
      const licJson: any = await licRes.json();
      assert(licJson.status === 'ACTIVE_LEASE', 'Returned status ACTIVE_LEASE');
      assert(typeof licJson.token === 'string', 'Returned valid lease token');

      // Test GET /api/v1/health
      const healthRes = await fetch(`${baseUrl}/api/v1/health`);
      assert(healthRes.status === 200, 'HTTP GET /health returns 200');
      const healthJson: any = await healthRes.json();
      assert(healthJson.health.status === 'HEALTHY', 'Health status is HEALTHY');
      assert(healthJson.health.memoryUsageMb < 128, 'RAM footprint is strictly under 128MB');
    } finally {
      server.close();
    }
  }

  // Cleanup test directory
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  }

  console.log(`\n========================================`);
  console.log(`Cloud Telemetry Backend Suite: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
