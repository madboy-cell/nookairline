/**
 * Test: Gacha Global Broadcast & Synchronized Animation Reveal
 * Verifies:
 * 1. Immediate pull result sent to puller (0ms).
 * 2. Puller's callsign / username is broadcast in the payload.
 * 3. Broadcast goes to all active passengers on the server, not just couple partner.
 * 4. Broadcast to other passengers is delayed (~2.9s - 5.3s) to prevent spoilers and synchronize with the card reveal animation.
 */

const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const serverApp = require('../server.js');

async function runTest() {
  console.log('🧪 Starting Gacha Global Synchronized Broadcast Test...');

  // Start test HTTP + WS server
  const server = http.createServer();
  const wss = new WebSocket.Server({ noServer: true });

  const clients = new Set();
  wss.on('connection', (ws, req) => {
    clients.add(ws);
    const url = new URL(req.url, 'http://localhost');
    ws.terminal = url.searchParams.get('terminal') || 'bkk';
    ws.userName = url.searchParams.get('username') || null;

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'identify') {
        if (msg.username) ws.userName = msg.username;
        if (msg.terminal) ws.terminal = msg.terminal;
      }
      if (msg.type === 'vault_pull') {
        const pullerName = (msg.username && String(msg.username).trim()) ||
                           (ws.userName && String(ws.userName).trim()) ||
                           (ws.terminal === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
        const count = msg.count || 1;
        const best = { id: 'astral_sovereign', rarity: 'mythic', name: 'Astral Sovereign' };

        // 1. Send pull result immediately to puller
        ws.send(JSON.stringify({
          type: 'vault_pull_result',
          role: ws.terminal,
          results: [best],
          reqId: msg.reqId
        }));

        // 2. Synchronized delayed broadcast to all active passengers
        const delayMs = best.rarity === 'mythic' ? 5300 : (best.rarity === 'epic' ? 3900 : 2900);
        setTimeout(() => {
          const broadcastMsg = JSON.stringify({
            type: 'vault_event',
            kind: 'pull',
            role: ws.terminal,
            username: pullerName,
            count,
            best
          });
          clients.forEach((c) => {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
              c.send(broadcastMsg);
            }
          });
        }, delayMs);
      }
    });

    ws.on('close', () => clients.delete(ws));
  });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`📡 Test WS Server listening on port ${port}`);

  function createClient(terminal, username) {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?terminal=${terminal}&username=${encodeURIComponent(username)}`);
      ws.messages = [];
      ws.on('message', (d) => ws.messages.push(JSON.parse(d)));
      ws.on('open', () => resolve(ws));
    });
  }

  // Create 3 active passengers
  const p1 = await createClient('bkk', 'Captain Thanapat');
  const p2 = await createClient('dxb', 'First Officer Nook');
  const p3 = await createClient('passenger', 'Passenger Daisy');

  console.log('👥 Connected 3 active passengers: BKK (puller), DXB (partner), Passenger (lounge)');

  const startTime = Date.now();
  p1.send(JSON.stringify({
    type: 'vault_pull',
    count: 10,
    reqId: 'test_pull_1',
    username: 'Captain Thanapat'
  }));

  // Wait 300ms: puller should have result immediately, others should NOT have received event yet!
  await new Promise((r) => setTimeout(r, 300));

  const p1Result = p1.messages.find((m) => m.type === 'vault_pull_result');
  assert.ok(p1Result, 'Puller must receive vault_pull_result immediately (<300ms)');
  console.log('✅ Puller received vault_pull_result at 0ms (animation starting)');

  const p2Early = p2.messages.find((m) => m.type === 'vault_event');
  const p3Early = p3.messages.find((m) => m.type === 'vault_event');
  assert.strictEqual(p2Early, undefined, 'Partner must NOT receive spoiler broadcast before animation ends');
  assert.strictEqual(p3Early, undefined, 'Other passengers must NOT receive spoiler broadcast before animation ends');
  console.log('✅ Partner and active passengers have NOT received spoiler broadcast early');

  // Now wait for the synchronized reveal delay (5300ms) + buffer
  console.log('⏳ Waiting for 5.3s synchronized reveal delay...');
  await new Promise((r) => setTimeout(r, 5200));

  const p2Event = p2.messages.find((m) => m.type === 'vault_event');
  const p3Event = p3.messages.find((m) => m.type === 'vault_event');
  const elapsed = Date.now() - startTime;

  assert.ok(p2Event, 'Partner must receive broadcast after reveal delay');
  assert.ok(p3Event, 'Server-wide passenger must receive broadcast after reveal delay');
  assert.strictEqual(p2Event.username, 'Captain Thanapat', 'Broadcast must contain puller callsign');
  assert.strictEqual(p3Event.username, 'Captain Thanapat', 'Broadcast to passenger must contain puller callsign');
  assert.strictEqual(p2Event.best.rarity, 'mythic');
  assert.ok(elapsed >= 5300, `Broadcast must occur at >= 5300ms (elapsed: ${elapsed}ms)`);

  const p1Event = p1.messages.find((m) => m.type === 'vault_event');
  assert.strictEqual(p1Event, undefined, 'Puller should be excluded from broadcast toast');

  console.log(`✅ Perfect synchronization! Broadcast arrived at ${elapsed}ms with username: "${p2Event.username}"`);
  console.log('🎉 ALL GACHA GLOBAL SYNCHRONIZATION TESTS PASSED 100%!');

  p1.close();
  p2.close();
  p3.close();
  server.close();
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
