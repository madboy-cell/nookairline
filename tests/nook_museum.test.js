import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  MUSEUM_TIMELINE_CHAPTERS,
  MUSEUM_GACHA_EXHIBITS,
  MUSEUM_SCENERY_PORTALS,
  PORTAL_FLOOR_ART_DIRECTION,
  getPortalFloorArtDirection,
  buildPortalTileMap,
  NOOK_MUSEUM,
  getNookMuseumConfig,
  NookMuseumScene,
} from '../client/js/nook_museum_scene.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, '../client');

test('NookMuseum catalog exports 6 timeline chapters, 12 Gacha exhibits, and 16 Living Scenery & Season Portals with valid metadata', () => {
  const cfg = getNookMuseumConfig();
  assert.equal(cfg.ID, 'nook_museum');
  assert.equal(cfg.SIZE, 36);
  assert.equal(MUSEUM_TIMELINE_CHAPTERS.length, 6);
  assert.equal(MUSEUM_GACHA_EXHIBITS.length, 12);
  assert.equal(MUSEUM_SCENERY_PORTALS.length, 16);

  for (const ch of MUSEUM_TIMELINE_CHAPTERS) {
    assert.ok(ch.id && ch.title && ch.date && ch.story);
    assert.ok(Array.isArray(ch.snapshots) && ch.snapshots.length >= 1);
  }

  for (const ex of MUSEUM_GACHA_EXHIBITS) {
    assert.ok(ex.id && ex.season && ex.title && ex.story && ex.portalId);
    assert.equal(typeof ex.x, 'number');
    assert.equal(typeof ex.z, 'number');
    assert.equal(ex.r, 2.3);
    assert.ok(ex.bannerUrl.startsWith('/assets/museum/v1/'));
    assert.ok(ex.maleSprite.startsWith('/assets/museum/v1/'));
    assert.ok(ex.femaleSprite.startsWith('/assets/museum/v1/'));
    assert.ok(MUSEUM_SCENERY_PORTALS.some((p) => p.id === ex.portalId));
  }

  const portalIds = MUSEUM_SCENERY_PORTALS.map((p) => p.id);
  assert.deepEqual(portalIds, [
    'fuji',
    'paris',
    'swiss',
    'dubai',
    'maldives',
    'cabin',
    'bangkok',
    'montecarlo',
    'atlantis',
    'starlight',
    'fairytale',
    'permafrost',
    'luxor',
    'venice',
    'olympus',
    'cat_lounge',
  ]);

  const fuji = MUSEUM_SCENERY_PORTALS.find((p) => p.id === 'fuji');
  assert.equal(fuji.v1Snap, '/assets/museum/v1/scene_kyoto_wide.jpg');
  assert.equal(fuji.x, 0);
  assert.equal(fuji.z, -13.4);
  assert.equal(fuji.r, 2.2);
});

test('Every referenced /assets/museum/v1/... file in timeline, exhibits, and portals exists on disk in client/assets/museum/v1/', () => {
  const referenced = new Set();

  for (const ch of MUSEUM_TIMELINE_CHAPTERS) {
    for (const snap of ch.snapshots) {
      if (snap.startsWith('/assets/museum/v1/')) referenced.add(snap);
    }
  }

  for (const ex of MUSEUM_GACHA_EXHIBITS) {
    referenced.add(ex.bannerUrl);
    referenced.add(ex.maleSprite);
    referenced.add(ex.femaleSprite);
    for (const extra of ex.extraSprites || []) {
      if (extra.startsWith('/assets/museum/v1/')) referenced.add(extra);
    }
  }

  for (const p of MUSEUM_SCENERY_PORTALS) {
    referenced.add(p.v1Snap);
  }

  assert.ok(referenced.size >= 70, `Expected at least 70 unique V1 assets referenced, got ${referenced.size}`);

  for (const relUrl of referenced) {
    const diskPath = path.join(CLIENT_DIR, relUrl.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Missing V1 archival asset on disk: ${relUrl} (${diskPath})`);
  }

  // Also verify every single literal /assets/... (.png|.jpg) string in client/js/nook_museum_scene.js exists on disk
  const sceneSrc = fs.readFileSync(path.join(CLIENT_DIR, 'js/nook_museum_scene.js'), 'utf8');
  const literalAssetMatches = sceneSrc.match(/\/assets\/[a-zA-Z0-9_./-]+\.(?:png|jpg)/g) || [];
  assert.ok(literalAssetMatches.length >= 120, `Expected at least 120 literal asset URLs in nook_museum_scene.js`);
  for (const relUrl of new Set(literalAssetMatches)) {
    const diskPath = path.join(CLIENT_DIR, relUrl.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Missing asset referenced in nook_museum_scene.js: ${relUrl} (${diskPath})`);
  }
});

test('NookMuseumScene constructs cleanly in headless Node, builds hall & realm groups, and switches into all 6 portals and back', () => {
  const dummyScene = new THREE.Scene();
  const emittedFx = [];
  const smoothPartner = {
    id: 'companion_neen',
    name: 'Neen',
    isCompanion: true,
    smooth: { x: 1, z: 8, tx: 1, tz: 8, vx: 0, vz: 0, age: 0 },
    get x() { return this.smooth.x; },
    get z() { return this.smooth.z; },
  };
  const world = {
    scene: dummyScene,
    local: { x: 0, z: 8, tx: 0, tz: 8 },
    remotes: new Map([
      ['companion_neen', smoothPartner],
    ]),
    fx: {
      emit(type, payload) {
        emittedFx.push({ type, payload });
      },
    },
  };

  const museum = new NookMuseumScene({ world });
  assert.equal(museum.root.name, 'nook_museum_root');
  assert.equal(museum.hallGroup.name, 'museum_main_hall');
  assert.equal(museum.realmGroup.name, 'museum_portal_realm');
  assert.equal(museum.root.visible, false);

  museum.setActive(true);
  assert.equal(museum.active, true);
  assert.equal(museum.root.visible, true);
  assert.equal(museum.hallGroup.visible, true);
  assert.equal(museum.realmGroup.visible, false);

  // Verify Village-Grid Main Hall ground, cliff rim, merged tiles, curbs, and 36° depth-sorted sprites
  const hallNames = new Set();
  let globeMesh = null;
  museum.hallGroup.traverse((obj) => {
    if (obj.name) hallNames.add(obj.name);
    if (obj.name === 'museum_legacy_globe_monument') globeMesh = obj;
  });
  assert.ok(hallNames.has('museum_painting_floor'));
  assert.ok(hallNames.has('museum_cliff_rim_turf'));
  assert.ok(hallNames.has('museum_cliff_wall_south'));
  assert.ok(hallNames.has('museum_tiles_cobble'));
  assert.ok(hallNames.has('museum_tiles_cream'));
  assert.ok(hallNames.has('museum_tiles_water'));
  assert.ok(hallNames.has('museum_tiles_bridge'));
  assert.ok(hallNames.has('museum_road_curbs'));
  assert.ok(hallNames.has('museum_bridge_curbs'));
  assert.ok(globeMesh);
  assert.equal(globeMesh.material.depthWrite, true);
  assert.ok(Math.abs(globeMesh.rotation.x - (-THREE.MathUtils.degToRad(36))) < 0.001);

  // Check triggers in Main Hall: Rotunda, Gacha Exhibit S1, and Mount Fuji Portal
  const rotundaHit = museum.checkTrigger(0.2, -0.2);
  assert.ok(rotundaHit);
  assert.equal(rotundaHit.id, 'rotunda_chronicle');
  assert.equal(rotundaHit.action, 'open_timeline');

  const ex1 = MUSEUM_GACHA_EXHIBITS[0];
  const exHit = museum.checkTrigger(ex1.x + 0.3, ex1.z - 0.2);
  assert.ok(exHit);
  assert.equal(exHit.id, 'exhibit_s1');
  assert.equal(exHit.action, 'exhibit:exhibit_s1');

  const fujiPortalHit = museum.checkTrigger(0, -13.0);
  assert.ok(fujiPortalHit);
  assert.equal(fujiPortalHit.id, 'fuji');
  assert.equal(fujiPortalHit.action, 'portal:fuji');

  // Step into Mount Fuji 2.5D Portal
  museum.enterPortal('fuji');
  assert.equal(museum.currentPortalId, 'fuji');
  assert.equal(museum.hallGroup.visible, false);
  assert.equal(museum.realmGroup.visible, true);
  assert.equal(museum.petalParticles.length, 70);

  // Verify Mount Fuji horizon, Torii gates, lanterns, and pagoda exist in realmGroup
  const names = new Set();
  museum.realmGroup.traverse((obj) => {
    if (obj.name) names.add(obj.name);
  });
  assert.ok(names.has('fuji_mountain_horizon'));
  assert.ok(names.has('fuji_torii_gate_primary'));
  assert.ok(names.has('fuji_torii_gate_secondary'));
  assert.ok(names.has('fuji_stone_lantern_front'));
  assert.ok(names.has('fuji_stone_lantern_mid'));
  assert.ok(names.has('fuji_kyoto_pagoda_hill'));
  assert.ok(names.has('fuji_engawa_step_ledge'));

  // Check trigger at Mount Fuji Couple Viewing Spot (0, 1.5)
  const coupleHit = museum.checkTrigger(0.1, 1.4);
  assert.ok(coupleHit);
  assert.equal(coupleHit.id, 'couple_viewing_spot');
  assert.equal(coupleHit.action, 'couple_pose');

  // Trigger couple pose & verify partner sync + heart FX
  museum.triggerCoupleMoment();
  assert.equal(world.local.pose, 'happy');
  const partner = world.remotes.get('companion_neen');
  assert.equal(partner.pose, 'cast');
  assert.ok(emittedFx.length >= 8);

  // Tick update(dt) to animate sakura petals
  museum.update(0.05);

  // Step through all 16 portals cleanly and verify switch_portal action callback + custom return spawn + Tile-Builder foundation
  const actions = [];
  museum.onAction = (act, arg, spawn) => actions.push({ act, arg, spawn });
  for (const p of MUSEUM_SCENERY_PORTALS) {
    museum.enterPortal(p.id);
    assert.equal(museum.currentPortalId, p.id);
    assert.equal(museum.realmGroup.visible, true);
    assert.equal(world.local.x, -0.55);
    assert.equal(world.local.z, 2.6);
    const realmNames = new Set();
    museum.realmGroup.traverse((obj) => {
      if (obj.name) realmNames.add(obj.name);
      if (obj.userData?.assetUrl) {
        const diskPath = path.join(CLIENT_DIR, obj.userData.assetUrl.replace(/^\//, ''));
        assert.ok(fs.existsSync(diskPath), `Missing assetUrl in portal ${p.id}: ${obj.userData.assetUrl}`);
      }
    });
    assert.ok(realmNames.has(`portal_tile_foundation_${p.id}`), `Missing tile foundation in ${p.id}`);
    assert.ok(realmNames.has(`portal_sky_wing_left_${p.id}`), `Missing left panoramic wing in ${p.id}`);
    assert.ok(realmNames.has(`portal_sky_wing_right_${p.id}`), `Missing right panoramic wing in ${p.id}`);
    assert.ok(realmNames.has('portal_tiles_cobble'), `Missing cobble village grid tiles in ${p.id}`);
    assert.ok(realmNames.has('portal_tiles_cream'), `Missing cream village grid tiles in ${p.id}`);
    assert.ok(realmNames.has('portal_tiles_sakura'), `Missing sakura village grid tiles in ${p.id}`);
    assert.ok(realmNames.has('portal_road_curbs'), `Missing 3D raised road curbs in ${p.id}`);
    assert.ok(realmNames.has('terrace_south_cliff_rim'), `Missing south sky-island cliff rim in ${p.id}`);
    assert.ok(realmNames.has('terrace_south_cliff_wall'), `Missing south sky-island cliff wall in ${p.id}`);
    assert.ok(realmNames.has('couple_plaza_medallion'), `Missing couple plaza medallion in ${p.id}`);
    if (p.id !== 'cabin' && p.id !== 'cat_lounge') {
      assert.ok(realmNames.has('portal_tiles_water'), `Missing north canal water tiles in ${p.id}`);
      assert.ok(realmNames.has('portal_tiles_bridge'), `Missing central canal footbridge in ${p.id}`);
      assert.ok(realmNames.has('portal_bridge_curbs'), `Missing bridge curbs in ${p.id}`);
    }
    assert.ok(museum.realmLeanSprites.length >= 6, `Expected realmLeanSprites in ${p.id}`);
    museum.update(0.016, null, 0.59);
    for (const sp of museum.realmLeanSprites) {
      assert.ok(Math.abs(sp.rotation.x - (-0.59)) < 0.001, `Expected -pitch tilt on ${sp.name} in ${p.id}`);
    }
  }
  assert.equal(actions.length, 16);
  assert.deepEqual(actions[0], { act: 'switch_portal', arg: 'fuji', spawn: { x: -0.55, z: 2.6 } });

  // Verify fromServer: true does NOT re-emit switch_portal
  museum.enterPortal('fuji', { fromServer: true });
  assert.equal(actions.length, 16);

  // Exit back to Museum Hall (from fuji at (0, -13.4) -> return spawn (0, -11.2))
  museum.exitPortalToHall();
  assert.equal(museum.currentPortalId, null);
  assert.equal(museum.hallGroup.visible, true);
  assert.equal(museum.realmGroup.visible, false);
  assert.equal(actions.length, 17);
  assert.deepEqual(actions[16], { act: 'switch_portal', arg: null, spawn: { x: 0, z: -11.2 } });

  // Verify Gacha Floor HUD command uses teleportLocal when in hall
  let teleported = null;
  world.teleportLocal = (x, z, opts) => {
    teleported = { x, z, opts };
  };
  museum.handleHudCommand('gacha_floor');
  assert.ok(teleported);
  assert.equal(teleported.x, -6.2);
  assert.equal(teleported.z, 2.2);

  museum.dispose();
});

test('Client-server WebSocket movement & zoneSeq across Museum Hall and all 16 Living Scenery Portals has zero position_correct rubber-banding + sends popup invite to partner', async () => {
  const os = await import('node:os');
  const { WebSocket } = await import('ws');
  const { startServer } = await import('../server/server.js');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-museum-ws-'));
  const silentLog = { info() {}, warn() {}, error() {} };
  const srv = await startServer({ port: 0, dataDir: tmpDir, log: silentLog });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nook', password: '1234', lineage: 'bkk' }),
    }).then((r) => r.json());
    assert.ok(loginRes.token);

    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    const inbox = [];
    const waiters = [];
    const positionCorrections = [];

    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'position_correct') positionCorrections.push(m);
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
        const timer = setTimeout(() => reject(new Error('Timeout waiting for WS message')), timeoutMs);
        waiters.push({
          pred,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    };

    await new Promise((resolve) => ws.once('open', resolve));
    ws.send(JSON.stringify({ type: 'auth', token: loginRes.token }));
    const authOk = await waitFor((m) => m.type === 'auth_ok');
    assert.ok(authOk.zoneSeq >= 1);

    // 1. Switch from Village into NookAirline V1 Museum Hall (`nook_museum`)
    ws.send(JSON.stringify({ type: 'instance_switch', to: 'museum', spawn: { x: -0.6, z: 2.2 } }));
    const snapHall = await waitFor((m) => m.type === 'instance_snapshot' && m.instanceId === 'nook_museum');
    assert.equal(snapHall.layout.kind, 'museum');
    assert.equal(snapHall.layout.portalId, null);
    assert.deepEqual(snapHall.self, { x: -0.6, z: 2.2 });
    let zoneSeq = snapHall.zoneSeq;

    // 2. Teleport to Gacha Painting Floor `(-10.4, 0)` with `teleport: true` and walk around
    ws.send(JSON.stringify({ type: 'move_step', x: -10.4, z: 0, vx: 0, vz: 0, right: true, back: false, zoneSeq, teleport: true }));
    ws.send(JSON.stringify({ type: 'move_step', x: -10.1, z: -0.4, vx: 1.5, vz: -2.0, right: true, back: true, zoneSeq }));

    // 3. Step into each of the 16 Living Scenery Portal Worlds, walk on the deck, and verify zero position_correct
    for (const p of MUSEUM_SCENERY_PORTALS) {
      ws.send(JSON.stringify({ type: 'instance_switch', to: `museum:${p.id}`, spawn: { x: -0.55, z: 2.6 } }));
      const snapPortal = await waitFor((m) => m.type === 'instance_snapshot' && m.instanceId === `nook_museum:${p.id}`);
      assert.equal(snapPortal.layout.kind, 'museum');
      assert.equal(snapPortal.layout.portalId, p.id);
      assert.deepEqual(snapPortal.self, { x: -0.55, z: 2.6 });
      zoneSeq = snapPortal.zoneSeq;

      // Walk forward to the Couple Viewing Spot `(0, 1.5)` inside the portal
      ws.send(JSON.stringify({ type: 'move_step', x: -0.2, z: 2.1, vx: 1.8, vz: -2.2, right: true, back: true, zoneSeq }));
      ws.send(JSON.stringify({ type: 'move_step', x: 0, z: 1.5, vx: 0, vz: 0, right: true, back: false, zoneSeq }));
    }

    // 4. Verify `auth_resume` while inside the last portal world (`nook_museum:cat_lounge`) returns valid museum layout
    ws.send(JSON.stringify({ type: 'auth_resume' }));
    const resumeOk = await waitFor((m) => m.type === 'resume_ok');
    assert.equal(resumeOk.layout.kind, 'museum');
    assert.equal(resumeOk.layout.portalId, 'cat_lounge');

    // 5. Exit portal back to Museum Hall at custom archway return coordinates `(6.12, 9.4)` and walk
    ws.send(JSON.stringify({ type: 'instance_switch', to: 'museum', spawn: { x: 6.12, z: 9.4 } }));
    const snapReturn = await waitFor((m) => m.type === 'instance_snapshot' && m.instanceId === 'nook_museum');
    assert.equal(snapReturn.layout.kind, 'museum');
    assert.equal(snapReturn.layout.portalId, null);
    assert.deepEqual(snapReturn.self, { x: 6.12, z: 9.4 });
    zoneSeq = snapReturn.zoneSeq;

    ws.send(JSON.stringify({ type: 'move_step', x: 5.8, z: 8.9, vx: -1.5, vz: -2.0, right: false, back: true, zoneSeq }));

    // 6. Connect partner `neen` in the Village and verify `nook` stepping into `fairytale` sends a `museum_partner_invite` popup banner (NOT a forced teleport!)
    const neenLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'neen', password: '1234', lineage: 'dxb' }),
    }).then((r) => r.json());
    const wsNeen = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    const neenInbox = [];
    wsNeen.on('message', (raw) => neenInbox.push(JSON.parse(String(raw))));
    await new Promise((resolve) => wsNeen.once('open', resolve));
    wsNeen.send(JSON.stringify({ type: 'auth', token: neenLogin.token }));
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        if (neenInbox.some((m) => m.type === 'auth_ok')) { clearInterval(iv); resolve(); }
      }, 15);
    });

    ws.send(JSON.stringify({ type: 'instance_switch', to: 'museum:fairytale', spawn: { x: -0.55, z: 2.6 } }));
    await waitFor((m) => m.type === 'instance_snapshot' && m.instanceId === 'nook_museum:fairytale');
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        if (neenInbox.some((m) => m.type === 'museum_partner_invite' && m.portalId === 'fairytale')) {
          clearInterval(iv);
          resolve();
        }
      }, 15);
    });
    const inviteMsg = neenInbox.find((m) => m.type === 'museum_partner_invite' && m.portalId === 'fairytale');
    assert.ok(inviteMsg);
    assert.equal(inviteMsg.fromId, 'nook');
    assert.equal(inviteMsg.instanceId, 'nook_museum:fairytale');
    // Verify Neen was NOT forcibly switched into nook_museum:fairytale automatically
    assert.equal(neenInbox.some((m) => m.type === 'instance_snapshot' && m.instanceId === 'nook_museum:fairytale'), false);

    // Manual `museum_invite_partner` button test
    ws.send(JSON.stringify({ type: 'museum_invite_partner', portalId: 'olympus' }));
    const sentAck = await waitFor((m) => m.type === 'museum_invite_sent');
    assert.equal(sentAck.ok, true);
    assert.equal(sentAck.portalId, 'olympus');

    assert.equal(positionCorrections.length, 0, `Expected 0 position_correct events, got ${JSON.stringify(positionCorrections)}`);
    wsNeen.close();
    ws.close();
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('All 16 Portal Worlds have bespoke Art-Director floor palettes (pattern, groundColor, cobbleColor, creamColor, sakuraColor, curbColor) and unique 36x36 tile layouts', () => {
  const portalIds = MUSEUM_SCENERY_PORTALS.map((p) => p.id);
  assert.equal(portalIds.length, 16);
  assert.equal(Object.keys(PORTAL_FLOOR_ART_DIRECTION).length, 16);

  const patterns = new Set();
  const groundColors = new Set();
  const cobbleColors = new Set();
  const creamColors = new Set();
  const sakuraColors = new Set();
  const curbColors = new Set();
  const tileLayoutSignatures = new Set();

  const dummyScene = new THREE.Scene();
  const museum = new NookMuseumScene({
    world: {
      scene: dummyScene,
      local: { x: 0, z: 8, tx: 0, tz: 8 },
      remotes: new Map(),
    },
  });
  museum.setActive(true);

  const nonGrassWorlds = new Set([
    'swiss',
    'permafrost',
    'atlantis',
    'starlight',
    'dubai',
    'luxor',
    'maldives',
    'cabin',
    'cat_lounge',
  ]);

  for (const portalId of portalIds) {
    const spec = getPortalFloorArtDirection(portalId);
    assert.ok(spec, `Missing floor art spec for ${portalId}`);
    assert.equal(spec.id, portalId);

    patterns.add(spec.pattern);
    groundColors.add(spec.groundColor);
    cobbleColors.add(spec.cobbleColor);
    creamColors.add(spec.creamColor);
    sakuraColors.add(spec.sakuraColor);
    curbColors.add(spec.curbColor);

    const tileMap = buildPortalTileMap(portalId, 36);
    const sig = [...tileMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    tileLayoutSignatures.add(sig);

    museum.enterPortal(portalId);
    const byName = new Map();
    let curbTuftCount = 0;
    museum.realmGroup.traverse((obj) => {
      if (obj.name) byName.set(obj.name, obj);
      if (obj.name === 'portal_curb_tuft') curbTuftCount++;
    });

    assert.equal(byName.get(`portal_floor_${portalId}`)?.material?.color?.getHex(), spec.groundColor);
    assert.equal(byName.get('portal_tiles_cobble')?.material?.color?.getHex(), spec.cobbleColor);
    assert.equal(byName.get('portal_tiles_cream')?.material?.color?.getHex(), spec.creamColor);
    assert.equal(byName.get('portal_tiles_sakura')?.material?.color?.getHex(), spec.sakuraColor);
    assert.equal(byName.get('portal_road_curbs')?.material?.color?.getHex(), spec.curbColor);
    assert.equal(byName.get('terrace_south_cliff_rim')?.material?.color?.getHex(), spec.cliffRimColor);
    assert.equal(byName.get('terrace_south_cliff_wall')?.material?.color?.getHex(), spec.cliffWallColor);

    if (nonGrassWorlds.has(portalId)) {
      assert.equal(curbTuftCount, 0, `Expected 0 green grass curb tufts in ${portalId}, got ${curbTuftCount}`);
    }
  }

  assert.equal(patterns.size, 16, 'Expected 16 unique floor pattern archetypes');
  assert.equal(groundColors.size, 16, 'Expected 16 unique groundColor hex values');
  assert.equal(cobbleColors.size, 16, 'Expected 16 unique cobbleColor hex values');
  assert.equal(creamColors.size, 16, 'Expected 16 unique creamColor hex values');
  assert.equal(sakuraColors.size, 16, 'Expected 16 unique sakuraColor hex values');
  assert.equal(curbColors.size, 16, 'Expected 16 unique curbColor hex values');
  assert.equal(tileLayoutSignatures.size, 16, 'Expected 16 unique 36x36 tile cell layouts');

  museum.dispose();
});
