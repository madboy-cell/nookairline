// tests/sky_frontier_server.test.js — Sky Frontier server WebSocket integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

import { startServer } from '../server/server.js';
import { isFrontierInstance } from '../shared/sky_frontier_rules.js';

test('Sky Frontier server WebSocket integration (shard routing, clamp, gate lock, strike & energy, home/museum, co-op shard)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-sf-server-test-'));
  const dataFile = path.join(tmpDir, 'db.json');
  const srv = await startServer({ port: 0, dataFile, quiet: true });
  const baseUrl = `http://127.0.0.1:${srv.port}`;
  const openSockets = [];

  function createWsClient() {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    const inbox = [];
    const waiters = [];

    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      for (let i = 0; i < waiters.length; i++) {
        if (waiters[i].pred(m)) {
          const w = waiters.splice(i, 1)[0];
          w.resolve(m);
          return;
        }
      }
      inbox.push(m);
    });

    const waitFor = (pred, timeoutMs = 4000) => {
      for (let i = 0; i < inbox.length; i++) {
        if (pred(inbox[i])) return Promise.resolve(inbox.splice(i, 1)[0]);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for WS message: ' + pred.toString())), timeoutMs);
        waiters.push({
          pred,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    };

    const send = (msg) => ws.send(JSON.stringify(msg));

    openSockets.push(ws);
    return { ws, send, waitFor, inbox };
  }

  async function login(username, lineage = 'bkk', password = '1234') {
    return fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, lineage }),
    }).then((r) => r.json());
  }

  try {
    // Authenticate primary test player (nook)
    const nookAuth = await login('nook');
    assert.ok(nookAuth.token, 'Expected token from login');

    const c1 = createWsClient();
    await new Promise((resolve) => c1.ws.once('open', resolve));
    c1.send({ type: 'auth', token: nookAuth.token });
    const authOk = await c1.waitFor((m) => m.type === 'auth_ok');
    assert.ok(authOk.zoneSeq >= 1);
    await c1.waitFor((m) => m.type === 'instance_snapshot');

    let frontierSnap;

    // -----------------------------------------------------------------------------------------
    // 1. instance_switch to frontier
    // -----------------------------------------------------------------------------------------
    await t.test('1. Logged-in player switches to frontier without crashing; receives meadow snapshot with nodes', async () => {
      c1.send({ type: 'instance_switch', to: 'frontier' });
      frontierSnap = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');
      assert.equal(frontierSnap.layout.kind, 'sky_frontier');
      assert.equal(frontierSnap.layout.regionId, 'meadow');
      assert.ok(frontierSnap.instanceId.startsWith('frontier:'), `instanceId must start with frontier: (got ${frontierSnap.instanceId})`);
      assert.ok(frontierSnap.instanceId.includes('~meadow'), `instanceId must contain ~meadow (got ${frontierSnap.instanceId})`);
      assert.ok(Array.isArray(frontierSnap.layout.nodes) && frontierSnap.layout.nodes.length > 0, 'layout.nodes must be non-empty');
      assert.equal(typeof frontierSnap.zoneSeq, 'number');
    });

    // -----------------------------------------------------------------------------------------
    // 2. move_step clamping
    // -----------------------------------------------------------------------------------------
    await t.test('2. move_step far outside region (x: 500, z: 500) gets clamped with |x| and |z| <= 36', async () => {
      const zoneSeq = frontierSnap.zoneSeq;
      // Send a small valid step first to establish last accepted time and velocity
      c1.send({
        type: 'move_step',
        x: 0.1,
        z: 28.1,
        vx: 0.5,
        vz: 0.5,
        right: true,
        back: false,
        zoneSeq,
      });

      // Send far out-of-bounds step
      c1.send({
        type: 'move_step',
        x: 500,
        z: 500,
        vx: 0,
        vz: 0,
        right: true,
        back: false,
        zoneSeq,
      });

      const pc = await c1.waitFor((m) => m.type === 'position_correct');
      assert.ok(Math.abs(pc.x) <= 36, `Expected |pc.x| <= 36, got ${pc.x}`);
      assert.ok(Math.abs(pc.z) <= 36, `Expected |pc.z| <= 36, got ${pc.z}`);
    });

    // -----------------------------------------------------------------------------------------
    // 3. direct hollow request lands in meadow
    // -----------------------------------------------------------------------------------------
    await t.test('3. Direct instance_switch request for hollow without unlock lands in meadow, not hollow', async () => {
      // Direct request with force: true while in frontier
      c1.send({ type: 'instance_switch', to: 'frontier:sf_1~hollow', force: true });
      const snapDirect = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');
      assert.equal(snapDirect.layout.regionId, 'meadow');
      assert.ok(snapDirect.instanceId.includes('~meadow'));
      assert.equal(snapDirect.layout.regionId === 'hollow', false);

      // Also verify entering from home directly requesting hollow lands in meadow
      c1.send({ type: 'instance_switch', to: 'home' });
      await c1.waitFor((m) => m.type === 'instance_snapshot' && !isFrontierInstance(m.instanceId));

      c1.send({ type: 'instance_switch', to: 'frontier:sf_1~hollow' });
      const snapFromHome = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');
      assert.equal(snapFromHome.layout.regionId, 'meadow');
      assert.ok(snapFromHome.instanceId.includes('~meadow'));
      assert.equal(snapFromHome.layout.regionId === 'hollow', false);
    });

    // -----------------------------------------------------------------------------------------
    // 4. sf_region gate checks: too_far when far, gate_locked when near
    // -----------------------------------------------------------------------------------------
    await t.test('4. sf_region to hollow gets too_far while far, and gate_locked when teleported near gate', async () => {
      // Player is currently near spawn (0, 28); gate to hollow is at (0, -32)
      c1.send({ type: 'sf_region', to: 'hollow' });
      const farResult = await c1.waitFor((m) => m.type === 'action_result' && m.action === 'sf_region');
      assert.equal(farResult.ok, false);
      assert.equal(farResult.error, 'too_far');

      // Teleport near the gate at (0, -32)
      c1.send({ type: 'instance_switch', to: 'frontier', force: true, spawn: { x: 0, z: -32 } });
      const nearSnap = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.self?.z === -32);
      assert.equal(nearSnap.self.z, -32);

      // Attempt gate transition when near the gate
      c1.send({ type: 'sf_region', to: 'hollow' });
      const lockedResult = await c1.waitFor((m) => m.type === 'action_result' && m.action === 'sf_region');
      assert.equal(lockedResult.ok, false);
      assert.equal(lockedResult.error, 'gate_locked');
    });

    // -----------------------------------------------------------------------------------------
    // 5. sf_strike: range check, energy spend, rate limit too_fast
    // -----------------------------------------------------------------------------------------
    await t.test('5. sf_strike: out_of_range when far, reduces energy when near, and too_fast on immediate second strike', async () => {
      const targetNode = frontierSnap.layout.nodes[0];
      assert.ok(targetNode && targetNode.id, 'Expected valid target node');

      // 5a. Strike while far away (currently at (0, -32))
      c1.send({ type: 'sf_strike', nodeId: targetNode.id });
      const farStrike = await c1.waitFor((m) => m.type === 'action_result' && m.action === 'sf_strike');
      assert.equal(farStrike.ok, false);
      assert.equal(farStrike.error, 'out_of_range');

      // 5b. Teleport within strike range (3.2m) of node
      c1.send({ type: 'instance_switch', to: 'frontier', force: true, spawn: { x: targetNode.x + 1, z: targetNode.z } });
      await c1.waitFor((m) => m.type === 'instance_snapshot');

      // 5c. Valid strike followed immediately by rapid second strike
      c1.send({ type: 'sf_strike', nodeId: targetNode.id });
      c1.send({ type: 'sf_strike', nodeId: targetNode.id });

      const firstStrike = await c1.waitFor((m) => m.type === 'action_result' && m.action === 'sf_strike' && m.ok === true);
      assert.equal(firstStrike.ok, true);
      assert.ok(typeof firstStrike.energy?.cur === 'number', 'Expected energy.cur number');
      assert.ok(firstStrike.energy.cur < 200, `Expected energy to be reduced below 200, got ${firstStrike.energy.cur}`);
      assert.equal(typeof firstStrike.nodeHp, 'number');

      const secondStrike = await c1.waitFor((m) => m.type === 'action_result' && m.action === 'sf_strike' && m.ok === false);
      assert.equal(secondStrike.ok, false);
      assert.equal(secondStrike.error, 'too_fast');
    });

    // -----------------------------------------------------------------------------------------
    // 6. Switching back home & museum
    // -----------------------------------------------------------------------------------------
    await t.test('6. instance_switch to home returns to non-frontier village, and switch to museum gives museum kind', async () => {
      c1.send({ type: 'instance_switch', to: 'home' });
      const homeSnap = await c1.waitFor((m) => m.type === 'instance_snapshot' && !isFrontierInstance(m.instanceId));
      assert.equal(isFrontierInstance(homeSnap.instanceId), false);
      assert.notEqual(homeSnap.layout?.kind, 'sky_frontier');

      c1.send({ type: 'instance_switch', to: 'museum' });
      const museumSnap = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'museum');
      assert.equal(museumSnap.layout.kind, 'museum');
      assert.equal(museumSnap.instanceId, 'nook_museum');
    });

    // -----------------------------------------------------------------------------------------
    // 7. Matchmaking: two users land in the same shard
    // -----------------------------------------------------------------------------------------
    await t.test('7. Two different users joining the frontier land in the same shard (fullest with space)', async () => {
      // User 1 re-enters frontier
      c1.send({ type: 'instance_switch', to: 'frontier' });
      const snap1 = await c1.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');
      const shardId1 = snap1.layout.shardId;
      assert.ok(shardId1);

      // User 2 (leo, unpartnered) logs in and joins frontier
      const leoAuth = await login('leo');
      assert.ok(leoAuth.token);

      const c2 = createWsClient();
      await new Promise((resolve) => c2.ws.once('open', resolve));
      c2.send({ type: 'auth', token: leoAuth.token });
      await c2.waitFor((m) => m.type === 'auth_ok');
      await c2.waitFor((m) => m.type === 'instance_snapshot');

      c2.send({ type: 'instance_switch', to: 'frontier' });
      const snap2 = await c2.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');
      const shardId2 = snap2.layout.shardId;

      assert.equal(shardId2, shardId1, `User 2 shard (${shardId2}) should match User 1 shard (${shardId1})`);
      assert.equal(snap2.instanceId, snap1.instanceId);
      assert.ok(snap2.players.some((p) => p.id === 'nook'), 'User 2 player list must contain User 1 (nook)');

      const joinBroadcast = await c1.waitFor((m) => m.type === 'player_joined' && m.player?.id === 'leo');
      assert.equal(joinBroadcast.player.id, 'leo');

      // 8. After completing Chapter 2 (story.chapter >= 2), player can enter Crystal Hollow both via Play Hub and via gate warp
      const leoProf = srv.db.getProfile('leo');
      leoProf.story = { chapter: 2, progress: {}, completed: [0, 1], claimed: [0, 1] };
      srv.db.markProfile('leo');

      // 8a. Direct Play Hub entry (`frontier:~hollow`) lands in hollow and completes c2_visit_gate_hollow
      c2.send({ type: 'instance_switch', to: 'frontier:~hollow', force: true });
      const hollowDirect = await c2.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.regionId === 'hollow');
      assert.equal(hollowDirect.layout.regionId, 'hollow');
      assert.ok(hollowDirect.instanceId.endsWith('~hollow'));
      assert.equal(srv.db.getProfile('leo').story.progress.c2_visit_gate_hollow, 1);

      // 8b. Return through hollow's south gate (0, 30) -> meadow, then step through meadow's north gate (0, -32) -> hollow
      c2.send({ type: 'instance_switch', to: 'frontier:~hollow', force: true, spawn: { x: 0, z: 30 } });
      await c2.waitFor((m) => m.type === 'instance_snapshot' && m.self?.z === 30);
      c2.send({ type: 'sf_region', to: 'meadow' });
      const backToMeadow = await c2.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.regionId === 'meadow');
      assert.equal(backToMeadow.layout.regionId, 'meadow');
      assert.ok(backToMeadow.self.z > -28.5, `Arrival from hollow should clear gate ring (got z=${backToMeadow.self.z})`);

      c2.send({ type: 'instance_switch', to: 'frontier', force: true, spawn: { x: 0, z: -31.5 } });
      await c2.waitFor((m) => m.type === 'instance_snapshot' && m.self?.z === -31.5);
      c2.send({ type: 'sf_region', to: 'hollow' });
      const warpRes = await c2.waitFor((m) => m.type === 'action_result' && m.action === 'sf_region');
      assert.equal(warpRes.ok, true);
      const hollowViaGate = await c2.waitFor((m) => m.type === 'instance_snapshot' && m.layout?.regionId === 'hollow');
      assert.equal(hollowViaGate.layout.regionId, 'hollow');
      assert.ok(hollowViaGate.self.z < 26.5, `Arrival in hollow should clear return gate ring (got z=${hollowViaGate.self.z})`);
    });
  } finally {
    for (const ws of openSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
