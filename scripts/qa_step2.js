#!/usr/bin/env node
// scripts/qa_step2.js — Step 2 test gate (Roadmap: "Both agents harvest 🪙/🍓/💎, edit 24×24 grid
// (Screen 02), cross Couple Bridge (Screen 17) & Co-Op Fish!").
//   Part A: WebSocket agents nook + beam against an isolated server (temp DB, seeded RNG).
//   Part B: two real Chrome sessions: village render, harvest, grid editor, bridge walk, pick-up,
//           fishing HUD. Screenshots -> qa_artifacts/step2/.
// Usage: npm run qa:step2   |   node scripts/qa_step2.js --no-browser
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startServer } from '../server/server.js';
import { harvestPreview } from '../shared/village_rules.js';
import { CORE, WONDERS } from '../shared/catalog_landmarks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'qa_artifacts', 'step2');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '  ✅' : '  ❌'} ${name}${detail ? `  — ${detail}` : ''}`);
}
function seeded(seed = 7) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function http(base, p, body) {
  const res = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function agent(port, token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const inbox = [], waiters = [], used = new Set();
  let req = 0;
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: m.t }));
    inbox.push(m);
    for (const w of [...waiters]) if (!used.has(m) && w.pred(m)) { used.add(m); waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));
  const a = {
    inbox, send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 4000) => new Promise((resolve, reject) => {
      const hit = inbox.find((m) => !used.has(m) && pred(m));
      if (hit) { used.add(hit); resolve(hit); return; }
      const w = { pred, resolve }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error(`timeout waiting: ${pred.toString().slice(0, 90)}`)); } }, ms);
    }),
    async act(type, payload = {}) {
      await sleep(270);                                  // server action cooldown is 250 ms
      const reqId = ++req;
      const p = a.wait((m) => m.type === 'action_result' && m.reqId === reqId);
      a.send({ type, reqId, ...payload });
      return p;
    },
    profile: () => [...inbox].reverse().find((m) => m.type === 'profile_update' || m.type === 'auth_ok')?.profile,
    close: () => ws.close(),
  };
  return a;
}

async function partA() {
  console.log('\n— Part A: two WebSocket agents (nook 💞 beam) —');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa2-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true, rng: seeded(42) });
  const base = `http://localhost:${srv.port}`;
  try {
    const tn = (await http(base, '/api/auth/login', { username: 'nook', password: '1234' })).data.token;
    const tb = (await http(base, '/api/auth/login', { username: 'neen', password: '1234' })).data.token;
    const N = agent(srv.port, tn), B = agent(srv.port, tb);
    const okN = await N.wait((m) => m.type === 'auth_ok');
    const okB = await B.wait((m) => m.type === 'auth_ok');
    check('both agents join the Twin Sky-Islands instance', okN.instanceId === 'couple:neen|nook' && okB.instanceId === okN.instanceId);
    const L = okN.layout;
    check('layout: neen island at X=0, nook at X=+40, bridge centre +20 (Section 21.B)', L.islands[0].owner === 'neen' && L.islands[0].cx === 0 && L.islands[1].cx === 40 && L.bridge?.cx === 20);
    check('seeded villages: comfort 4,850 / 6,660, CP 15,420 each', okN.profile.village.comfort === 4850 && okB.profile.village.comfort === 6660 && okN.profile.cp === 15420 && okB.profile.cp === 15420);
    check('nook spawns on his own island, neen on hers', Math.abs(okN.self.x - 40) < 3 && Math.abs(okB.self.x) < 3);
    check('serverNow sent for the authoritative clock', Number.isFinite(okN.serverNow));

    // --- harvest 🪙 / 🍓 / 💎 ---
    const pvN = harvestPreview(okN.profile, okN.serverNow, { coupled: true });
    const hN = await N.act('village_harvest_all');
    check('nook Harvest All pays 🪙 + 🍓 + 💎 (2 h seeded production, couple +25%)', hN.ok && hN.gold > 0 && hN.berries > 0 && hN.diamonds > 0, `+${hN.gold}🪙 +${hN.berries}🍓 +${hN.diamonds}💎`);
    check('payout matches the shared preview (±1%)', Math.abs(hN.gold - pvN.gold) <= pvN.gold * 0.01 + 2, `preview ${pvN.gold}`);
    const pN = N.profile();
    check('profile pushed: gold/berries/diamonds/EXP updated', pN.gold === okN.profile.gold + hN.gold && pN.exp === okN.profile.exp + 15);
    const hB = await B.act('village_harvest_all');
    check('neen Harvest All pays too (Shrine + World-Tree daily 💎)', hB.ok && hB.gold > 0 && hB.diamonds === CORE.shrine.perDay(6) + WONDERS.wnd_world_tree.perDay(1), `+${hB.gold}🪙 +${hB.berries}🍓 +${hB.diamonds}💎`);
    const again = await N.act('village_harvest_all');
    check('second harvest within 60 s is refused (server clock)', !again.ok && again.error === 'not_ready');

    // --- grid editor save (Screen 02) ---
    const v = pN.village;
    const layout = { buildings: v.buildings.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })), tiles: v.tiles.map((t) => ({ ...t })), ground: 'ground_sakura' };
    Object.assign(layout.buildings.find((b) => b.type === 'dec_gramophone'), { x: 20, y: 9 });
    layout.tiles.push({ x: 2, y: 2, t: 'road_sakura' }, { x: 3, y: 2, t: 'road_cream' });
    const updP = B.wait((m) => m.type === 'village_updated' && m.owner === 'nook');
    const save = await N.act('village_save_grid', { layout });
    check('nook saves an edited layout (move decor + paint 2 tiles + Sakura skin)', save.ok && save.comfort === 4860, `comfort ${save.comfort}`);
    const upd = await updP;
    check('partner receives the live village_updated broadcast', upd.village.ground === 'ground_sakura' && upd.village.buildings.find((b) => b.type === 'dec_gramophone').x === 20);
    const badLayout = JSON.parse(JSON.stringify(layout));
    Object.assign(badLayout.buildings.find((b) => b.type === 'dock'), { x: 14, y: 2 });
    const bad = await N.act('village_save_grid', { layout: badLayout });
    check('invalid layout rejected server-side (dock away from water)', !bad.ok && bad.error === 'dock_needs_water');
    const steal = JSON.parse(JSON.stringify(layout));
    steal.buildings.push({ type: 'wnd_casino_dome', x: 0, y: 18, rot: 0 });
    check('cannot place a Wonder you do not own', (await N.act('village_save_grid', { layout: steal })).error === 'not_owned');

    // --- couple bridge: move across ---
    let x = okN.self.x;
    N.send({ type: 'move_step', x, z: 3.0, vx: 0, vz: 0, right: false, back: false });
    for (let i = 0; i < 70 && x > 18; i++) { x -= 0.32; N.send({ type: 'move_step', x, z: 3.0, vx: -4.5, vz: 0, right: false, back: false }); await sleep(72); }
    const seen = await B.wait((m) => m.type === 'player_moved' && m.id === 'nook' && m.x < 20, 3000).catch(() => null);
    check('nook walks onto the Rainbow Heart Bridge (x≈18–20) and neen sees it', !!seen, seen ? `x=${seen.x.toFixed(2)}` : '');
    N.send({ type: 'move_step', x: x, z: -6, vx: 0, vz: 0, right: false, back: false });
    const corr = await N.wait((m) => m.type === 'position_correct' && m.z > 1.5, 2000).catch(() => null);
    check('stepping off the bridge into the sky is clamped back', !!corr, corr ? `z=${corr.z.toFixed(2)}` : '');

    // --- bless partner ---
    const bl = await N.act('village_bless_partner');
    check('nook blesses neen: +50 🪙 to nook, +15% for 12 h on neen', bl.ok && bl.gold === 50 && bl.blessedUntil > Date.now() + 11 * 3600_000);
    check('neen is notified', !!(await B.wait((m) => m.type === 'blessed', 2000).catch(() => null)));
    check('blessing is once per day', (await N.act('village_bless_partner')).error === 'already_blessed_today');

    // --- finger pick-up & drop into the Onsen ---
    N.send({ type: 'chibi_pickup_drop', targetId: 'nook', x: 33.5, z: 8.35, propId: 'wnd_onsen_seed' });
    const drop = await N.wait((m) => m.type === 'drop_result', 2000);
    check('drop Chibi into the Capybara Onsen -> +15% Blacksmith buff for 1 h', drop.ok && drop.buff === 'blacksmith' && drop.pct === 15);
    check('partner sees the drop (player_dropped)', !!(await B.wait((m) => m.type === 'player_dropped' && m.id === 'nook', 2000).catch(() => null)));
    N.send({ type: 'chibi_pickup_drop', targetId: 'neen', x: 0, z: 0 });
    await sleep(200);
    check('cannot pick up someone else\'s Chibi', !N.inbox.some((m) => m.type === 'drop_result' && m.x === 0 && m.z === 0));

    // --- fountain toss on neen's island ---
    const ft = await B.act('village_wonder_action', { action: 'fountain_toss', owner: 'neen' });
    check('neen tosses 100 🪙 into the Fountain of 1,000 Wishes', ft.ok && (ft.diamonds >= 10 || ft.ticket === 1), JSON.stringify({ d: ft.diamonds, t: ft.ticket }));

    // --- co-op fishing on nook's dock ---
    await sleep(900);
    N.send({ type: 'chibi_pickup_drop', targetId: 'nook', x: 47.5, z: 3.3 });
    await N.wait((m) => m.type === 'drop_result' && m.x === 47.5, 2000);
    await sleep(900);
    B.send({ type: 'chibi_pickup_drop', targetId: 'neen', x: 46.2, z: 3.4 });
    await B.wait((m) => m.type === 'drop_result' && m.x === 46.2, 2000);
    const berriesBefore = N.profile().berries;
    N.send({ type: 'fishing_cast', bait: true });
    const cast = await N.wait((m) => m.type === 'fishing_cast_ok', 2000);
    check('cast with Golden Berry Bait at the dock (−5 🍓)', cast.bait === true && (await N.wait((m) => m.type === 'profile_update' && m.profile.berries === berriesBefore - 5, 2000).catch(() => null)));
    check('co-op buff active with neen on the dock: chest 13.5%', cast.coop === true && Math.abs(cast.table.chest - 0.135) < 1e-9);
    N.send({ type: 'fishing_reel_complete', castId: cast.castId, success: true });
    check('reeling faster than the gauge allows is rejected', (await N.wait((m) => m.type === 'fishing_error', 2000)).error === 'too_fast');
    await sleep(cast.biteMs + 3600);
    N.send({ type: 'fishing_reel_complete', castId: cast.castId, success: true });
    const fr = await N.wait((m) => m.type === 'fishing_result', 3000);
    check('catch landed after bite + 3.5 s reel (server reveals loot)', fr.ok && fr.key && fr.exp >= 25, `${fr.key} +${fr.gold}🪙 +${fr.berries}🍓${fr.dupe ? ` dupe ${fr.dupe}` : ''}`);
    check('first catch of a species pays the +50 💎 codex milestone', fr.milestone === 50);
    B.send({ type: 'fishing_cast', bait: false });
    const castB = await B.wait((m) => m.type === 'fishing_cast_ok', 2000);
    check('neen co-op casts too (free cast = pond fish only)', castB.coop && Object.keys(castB.table).join() === 'minnow,crab');
    await sleep(castB.biteMs + 3600);
    B.send({ type: 'fishing_reel_complete', castId: castB.castId, success: true });
    const frB = await B.wait((m) => m.type === 'fishing_result', 3000);
    check('neen lands a pond fish', frB.ok && (frB.key === 'minnow' || frB.key === 'crab'), frB.key);
    await sleep(300);
    B.send({ type: 'chibi_pickup_drop', targetId: 'neen', x: -5, z: -8 });
    await B.wait((m) => m.type === 'drop_result' && m.x === -5, 2000);
    B.send({ type: 'fishing_cast', bait: false });
    check('casting away from a dock is refused', (await B.wait((m) => m.type === 'fishing_error', 2000)).error === 'not_at_dock');

    // --- upgrades / expansion / mood ---
    check('castle upgrade needs landmark levels (nook Lv6→7 needs 10, has 27 ✓) & gold', (await N.act('village_upgrade', { target: 'castle' })).ok);
    check('blueprint upgrade without cards refused', (await N.act('village_upgrade', { target: 'mint' })).error === 'not_enough_cards');
    const ex = await N.act('village_expand_cloud');
    check('Cloud Territory tier 1 (Castle Lv2 + 2,500 🪙) expands nook to 26×26', ex.ok && ex.grid_size === 26);
    const upd2 = await B.wait((m) => m.type === 'village_updated' && m.owner === 'nook' && m.layout?.islands.some((i) => i.owner === 'nook' && i.S === 26), 2000).catch(() => null);
    check('partner layout re-centres nook\'s island (PartnerCenterX = 12 + 16 + 13 = 41)', upd2?.layout.islands.find((i) => i.owner === 'nook').cx === 41);
    check('mood switch persists', (await N.act('village_set_mood', { mood: 'night' })).ok && N.profile().village.mood === 'night');

    N.close(); B.close();
    await sleep(100);
  } finally {
    await srv.close();
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'db.json'), 'utf8'));
    const n = saved.profiles.find((p) => p.id === 'nook');
    check('everything persisted to the JSON DB on shutdown', n.village.grid_size === 26 && n.village.ground === 'ground_sakura' && n.fish_codex && Object.keys(n.fish_codex).length >= 1);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function partB() {
  console.log('\n— Part B: 2 real browsers (nook & neen) —');
  if (!fs.existsSync(CHROME)) { check('Chrome found for browser QA', false, CHROME); return; }
  const { default: puppeteer } = await import('puppeteer-core');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa2b-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true, rng: seeded(9) });
  fs.mkdirSync(SHOTS, { recursive: true });
  const launch = () => puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const browsers = [await launch(), await launch()];
  const errors = [];
  try {
    const open = async (user, b) => {
      const page = await b.newPage();
      await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => errors.push(`${user}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${user}: ${m.text()}`); });
      await page.goto(`http://localhost:${srv.port}/?dev=1&debug=1&user=${user}&pass=1234`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.__neora?.debug()?.islands?.length > 0, { timeout: 20000 });
      return page;
    };
    const nook = await open('nook', browsers[0]);
    const beam = await open('neen', browsers[1]);
    const dbg = (p) => p.evaluate(() => window.__neora.debug());
    // teleport = a real Finger Pick-Up & Drop round trip, so the server agrees on the position
    const tp = async (page, x, z) => { await page.evaluate((x, z) => { const w = window.__neora.world; w.setLocalPosition(x, z); w.followDetached = false; w.onDrop({ x, z, propId: null }); }, x, z); await sleep(950); };
    await sleep(2500);
    const d0 = await dbg(nook);
    check('village renders twin islands + bridge', d0.islands.length === 2 && d0.bridge, JSON.stringify(d0.islands));
    check('VILLAGE camera preset 36° / 24 m', d0.pitchDeg === 36 && d0.camDist === 24);
    await nook.screenshot({ path: path.join(SHOTS, '01_village_nook.png') });
    await beam.screenshot({ path: path.join(SHOTS, '02_village_beam.png') });

    // harvest via the HUD button
    const before = await nook.evaluate(() => window.__neora.state.profile.gold);
    await nook.waitForFunction(() => !document.getElementById('act-harvest').disabled, { timeout: 5000 }).catch(() => {});
    await nook.click('#act-harvest');
    await nook.waitForFunction((g) => window.__neora.state.profile.gold > g, { timeout: 5000 }, before).then(() => check('HUD [🍓 Harvest All] adds gold', true)).catch(() => check('HUD [🍓 Harvest All] adds gold', false));
    await sleep(500);
    await nook.screenshot({ path: path.join(SHOTS, '03_after_harvest.png') });

    // grid editor (Screen 02)
    await nook.click('#act-edit');
    await sleep(900);
    const de = await dbg(nook);
    check('Edit Grid switches to VILLAGE_EDIT (42°) with grid overlay', de.editMode && Math.abs(de.pitchDeg - 42) < 1.5, `${de.pitchDeg}°`);
    await nook.click('#ed-tabs [data-tab="tiles"]');
    await sleep(300);
    await nook.screenshot({ path: path.join(SHOTS, '04_editor_paint.png') });
    // drag the swing via the editor API at the cell level (pointer drag on swiftshader is flaky)
    const moved = await nook.evaluate(() => {
      const ed = window.__neora.world.editor;
      const b = ed.draft.buildings.find((q) => q.type === 'dec_swing');
      ed.pushUndo(); ed.selected = b.uid; b.x = 19; b.y = 10; ed.refresh();
      return { valid: ed.valid, x: b.x };
    });
    check('editor: move a prop -> green valid footprint', moved.valid);
    const blocked = await nook.evaluate(() => {
      const ed = window.__neora.world.editor;
      const b = ed.draft.buildings.find((q) => q.type === 'dec_swing');
      const keep = { x: b.x, y: b.y }; b.x = 10; b.y = 4; ed.refresh();
      const status = document.getElementById('ed-status').textContent; const v = ed.valid;
      Object.assign(b, keep); ed.refresh();
      return { v, status };
    });
    check('editor: overlapping the castle shows red ✕ Blocked', !blocked.v && /Blocked/.test(blocked.status), blocked.status);
    await nook.screenshot({ path: path.join(SHOTS, '05_editor_moved.png') });
    await nook.click('#ed-save');
    await nook.waitForFunction(() => !window.__neora.world.editMode, { timeout: 5000 }).then(() => check('✅ Save Layout persists and exits edit mode', true)).catch(() => check('✅ Save Layout persists and exits edit mode', false));
    await beam.waitForFunction(() => window.__neora.world.layout.islands.find((i) => i.owner === 'nook').village.buildings.find((b) => b.type === 'dec_swing').x === 19, { timeout: 5000 })
      .then(() => check("beam's view updates nook's island live", true)).catch(() => check("beam's view updates nook's island live", false));

    // road speed boost
    await tp(nook, 39.5, 5.5);
    const road = true;
    const dr = await dbg(nook);
    check('standing on the cobblestone avenue = +15% speed', road && dr.onRoad && dr.speedMult === 1.15);

    // walk across the Rainbow Heart Bridge to beam's island
    await tp(nook, 36, 3.5);
    await nook.keyboard.down('ArrowLeft');
    const t0 = Date.now();
    let s = await dbg(nook);
    while (Date.now() - t0 < 30000 && s.x > 10.5) { await sleep(200); s = await dbg(nook); }
    await nook.keyboard.up('ArrowLeft');
    check('nook walks across the Rainbow Heart Bridge onto beam\'s island', s.x < 11.5, `x=${s.x}`);
    await sleep(600);
    await beam.screenshot({ path: path.join(SHOTS, '06_bridge_crossed_beam_view.png') });
    await nook.screenshot({ path: path.join(SHOTS, '06b_bridge_crossed_nook_view.png') });
    const seenByBeam = (await dbg(beam)).remotes.find((r) => r.id === 'nook');
    check('beam sees nook arrive on her island', seenByBeam && seenByBeam.x < 13, JSON.stringify(seenByBeam));

    // collision: walking into the castle stops
    await tp(nook, 39.5, 9.5);
    await nook.keyboard.down('ArrowUp'); await sleep(6000); await nook.keyboard.up('ArrowUp');
    const sc = await dbg(nook);
    check('buildings block movement (stops south of the castle footprint)', sc.z > -4.3, `z=${sc.z}`);

    // finger pick-up (real long-press on the chibi)
    await tp(nook, 38, 3.5);
    await sleep(800);
    const scr = await nook.evaluate(() => { const w = window.__neora.world, L = w.local; return w.worldToScreen(L.x, 0.7, L.z); });
    await nook.mouse.move(scr.x, scr.y); await nook.mouse.down();
    await sleep(450);
    const lifted = (await dbg(nook)).lifted;
    check('0.25 s long-press on your Chibi lifts it (>o< dangling pose)', lifted && (await dbg(nook)).shownView === 'lifted');
    await nook.mouse.move(scr.x - 60, scr.y + 20, { steps: 6 });
    await nook.screenshot({ path: path.join(SHOTS, '07_finger_pickup.png') });
    await nook.mouse.up();
    await sleep(1000);                                  // server drop cooldown is 800 ms
    check('release drops it back on walkable ground', !(await dbg(nook)).lifted);

    // fishing HUD at nook's dock
    await tp(nook, 47.5, 3.3);
    await nook.waitForFunction(() => !document.getElementById('fish-open').hidden, { timeout: 4000 }).then(() => check('🎣 Fish! button appears next to the dock', true)).catch(() => check('🎣 Fish! button appears next to the dock', false));
    await sleep(300);
    await nook.click('#fish-open');
    await nook.click('#fish-cast');
    await nook.waitForFunction(() => !document.getElementById('fish-gauge').hidden, { timeout: 9000 }).then(() => check('bite -> Sweet-Spot Tension Gauge appears', true)).catch(() => check('bite -> Sweet-Spot Tension Gauge appears', false));
    // auto-play the gauge: hold when the fish is left of the zone centre
    const tPlay = Date.now();
    while (Date.now() - tPlay < 20000) {
      const st = await nook.evaluate(() => {
        const f = window.__neora; const fx = document.getElementById('fish-icon').style.left, zl = document.getElementById('fish-zone').style.left, zw = document.getElementById('fish-zone').style.width;
        return { fish: parseFloat(fx), z: parseFloat(zl) + parseFloat(zw) / 2, done: document.getElementById('fish-gauge').hidden, f: !!f };
      });
      if (st.done) break;
      if (st.fish < st.z) await nook.keyboard.down('Space'); else await nook.keyboard.up('Space');
      await sleep(40);
    }
    await nook.keyboard.up('Space');
    await nook.waitForFunction(() => !document.getElementById('fish-result').hidden, { timeout: 6000 }).catch(() => {});
    const resultText = await nook.evaluate(() => document.getElementById('fish-result').textContent);
    check('reel-in shows the catch card', /!/.test(resultText), resultText.slice(0, 80));
    await nook.screenshot({ path: path.join(SHOTS, '08_fishing_result.png') });
    await nook.click('#fish-close');

    // bottom-right cliff & overhanging grass rim inspection shot
    await tp(beam, 11.0, 11.2);
    await sleep(350);
    await beam.screenshot({ path: path.join(SHOTS, '10_bottom_edge_cliff.png') });

    // mood switch
    await nook.click('#act-mood');
    await sleep(400);
    await nook.screenshot({ path: path.join(SHOTS, '09_mood.png') });
    check('no page errors in either browser', errors.length === 0, errors.slice(0, 4).join(' | '));
  } finally {
    await Promise.all(browsers.map((b) => b.close()));
    await srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const noBrowser = process.argv.includes('--no-browser');
try {
  await partA();
  if (!noBrowser) await partB();
} catch (e) {
  check('QA run completed without crashing', false, e.stack);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '❌' : '✅'} Step 2 QA: ${results.length - failed.length}/${results.length} checks passed${noBrowser ? ' (browser part skipped)' : ''}`);
if (!noBrowser) console.log(`Screenshots: ${path.relative(process.cwd(), SHOTS)}/`);
process.exit(failed.length ? 1 : 0);
