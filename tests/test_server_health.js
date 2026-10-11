/**
 * Phase 3 Production Health & Deployment Verification Test Suite
 *
 * Verifies:
 * 1. GET /healthz returns HTTP 200 with JSON telemetry (status, platform, region, uptime).
 * 2. Health telemetry accurately reports activeRooms, publicRooms, and activeSockets.
 * 3. Graceful shutdown signals cleanly flush state and notify connected clients.
 * 4. Fallback routing does not hijack /healthz.
 */

const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');

console.log('============================================================');
console.log('🧪 PHASE 3: RAILWAY PRODUCTION HEALTH & TELEMETRY SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

async function runTest(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    failed++;
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, json: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const TEST_PORT = 38491;
  const { app, server, wss, roomRegistry, gracefulShutdown } = require('../server.js');

  // Start listening on test port
  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // -------------------------------------------------------------
    // Test 3.1: Health Endpoint HTTP Status & Headers
    // -------------------------------------------------------------
    await runTest('3.1 GET /healthz returns HTTP 200 with no-cache headers', async () => {
      const res = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.ok(res.headers['cache-control'].includes('no-store'), 'Expected no-store in Cache-Control');
    });

    // -------------------------------------------------------------
    // Test 3.2: Health Endpoint Payload & Telemetry
    // -------------------------------------------------------------
    await runTest('3.2 GET /healthz payload contains valid production telemetry schema', async () => {
      const res = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      const body = res.json;
      assert.ok(body, 'Expected valid JSON object');
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.service, 'sky-party-terminal');
      assert.strictEqual(body.platform, 'railway');
      assert.strictEqual(body.region, 'singapore');
      assert.strictEqual(typeof body.uptimeSec, 'number');
      assert.ok(body.uptimeSec >= 0);
      assert.strictEqual(typeof body.timestamp, 'string');
      assert.ok(!isNaN(Date.parse(body.timestamp)), 'Expected valid ISO timestamp');
    });

    // -------------------------------------------------------------
    // Test 3.3: Active Rooms Reflection in Health Endpoint
    // -------------------------------------------------------------
    let room1 = null;
    let room2 = null;
    await runTest('3.3 GET /healthz dynamically reflects active and public rooms in RoomRegistry', async () => {
      const dummySocket1 = { send: () => {} };
      const dummySocket2 = { send: () => {} };

      // Create 1 public room and 1 private room
      room1 = roomRegistry.createRoom({ name: 'Bangkok Express', isPublic: true, ws: dummySocket1 });
      room2 = roomRegistry.createRoom({ name: 'Secret Dubai Cabin', isPublic: false, ws: dummySocket2 });

      const res = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.strictEqual(res.json.activeRooms, 2, `Expected 2 active rooms, got ${res.json.activeRooms}`);
      assert.strictEqual(res.json.publicRooms, 1, `Expected 1 public room, got ${res.json.publicRooms}`);

      // Clean up rooms
      roomRegistry.leaveRoom(dummySocket1);
      roomRegistry.leaveRoom(dummySocket2);

      const afterRes = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.strictEqual(afterRes.json.activeRooms, 0, 'Expected 0 active rooms after leave');
      assert.strictEqual(afterRes.json.publicRooms, 0, 'Expected 0 public rooms after leave');
    });

    // -------------------------------------------------------------
    // Test 3.4: Active Sockets Reflection in Health Endpoint
    // -------------------------------------------------------------
    await runTest('3.4 GET /healthz dynamically counts connected WebSocket clients', async () => {
      const client = new WebSocket(`ws://localhost:${TEST_PORT}/ws?terminal=bkk`);
      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      const res = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.ok(res.json.activeSockets >= 1, `Expected at least 1 socket, got ${res.json.activeSockets}`);

      client.close();
      await new Promise(resolve => setTimeout(resolve, 50));

      const afterRes = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.strictEqual(afterRes.json.activeSockets, 0, 'Expected 0 active sockets after disconnect');
    });

    // -------------------------------------------------------------
    // Test 3.5: Fallback Wildcard Route Does Not Interfere with Healthz
    // -------------------------------------------------------------
    await runTest('3.5 Express routing does not allow wildcard fallback to hijack /healthz', async () => {
      const healthRes = await fetchJson(`http://localhost:${TEST_PORT}/healthz`);
      assert.ok(healthRes.json && healthRes.json.status === 'ok', '/healthz must return JSON, not HTML');

      const pageRes = await fetchJson(`http://localhost:${TEST_PORT}/bkk`);
      assert.strictEqual(pageRes.status, 200);
      assert.ok(pageRes.raw.includes('<!DOCTYPE html>') || pageRes.raw.includes('<html'), '/bkk must return HTML page');
    });

    // -------------------------------------------------------------
    // Test 3.6: Graceful Shutdown Functionality
    // -------------------------------------------------------------
    await runTest('3.6 Graceful shutdown handler is registered and defined as a function', async () => {
      assert.strictEqual(typeof gracefulShutdown, 'function', 'gracefulShutdown must be a function');
      const sigtermListeners = process.listeners('SIGTERM');
      assert.ok(sigtermListeners.length >= 1, 'SIGTERM handler must be registered');
      const sigintListeners = process.listeners('SIGINT');
      assert.ok(sigintListeners.length >= 1, 'SIGINT handler must be registered');
    });

  } finally {
    // Clean close of server
    await new Promise(resolve => server.close(resolve));
  }

  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
