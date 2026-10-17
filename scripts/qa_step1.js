#!/usr/bin/env node
// scripts/qa_step1.js — Step 1 test gate.
//   Part A: server/API/WebSocket checks against an isolated server (temp DB, fast heartbeat).
//   Part B: 2-browser check (nook + beam) in real Chrome via puppeteer-core: rendering,
//           4-diagonal facing, idle turn-to-camera, wings Z inversion, pet follow distance,
//           remote sync, and pet-to-pet nuzzle. Screenshots go to qa_artifacts/step1/.
//
// Usage: npm run qa:step1            (both parts)
//        node scripts/qa_step1.js --no-browser
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startServer, NET } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'qa_artifacts', 'step1');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '  ✅' : '  ❌'} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function http(base, p, body, token) {
  const res = await fetch(base + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function wsClient(port, token, { autoPong = true } = {}) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'ping' && autoPong) ws.send(JSON.stringify({ type: 'pong', t: m.t }));
    inbox.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));
  const closed = new Promise((r) => ws.on('close', (code) => r(code)));
  return {
    ws, inbox, closed,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 3000) => {
      const hit = inbox.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error('timeout')); } }, ms);
      });
    },
    close: () => ws.close(),
  };
}

async function partA() {
  console.log('\n— Part A: server, auth, persistence, realtime —');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa-'));
  const dataFile = path.join(tmp, 'db.json');
  NET.HEARTBEAT_MS = 400;
  let srv = await startServer({ port: 0, dataFile, quiet: true });
  const base = `http://localhost:${srv.port}`;

  const nook = await http(base, '/api/auth/login', { username: 'nook', password: '1234' });
  check('nook signs in with seeded password', nook.status === 200 && nook.data.token);
  check('nook CP = 15,420 (Screens 26/27)', nook.data.profile?.cp === 15420, `cp=${nook.data.profile?.cp}`);
  check('profile never leaks password hash/salt', !('hash' in (nook.data.profile || {})) && !('salt' in (nook.data.profile || {})));
  const beam = await http(base, '/api/auth/login', { username: 'beam', password: '1234' });
  check('beam CP = 15,420 (Screen 07)', beam.data.profile?.cp === 15420, `cp=${beam.data.profile?.cp}`);
  check('wrong password rejected (401)', (await http(base, '/api/auth/login', { username: 'nook', password: 'nope' })).status === 401);
  check('invalid username rejected (400)', (await http(base, '/api/auth/login', { username: 'A!', password: '1234' })).status === 400);

  const reg = await http(base, '/api/auth/login', { username: 'qa_newbie', password: 'pw1234', lineage: 'dxb' });
  const rp = reg.data.profile || {};
  check('new username auto-registers', reg.status === 200 && reg.data.created === true);
  check('starter seed: 2,500🪙 300🍓 600💎 50🌟, Lv 1', rp.gold === 2500 && rp.berries === 300 && rp.diamonds === 600 && rp.shards === 50 && rp.level === 1);
  check('starter pet = Yuzu Capybara for Dragon Princess', rp.equipped?.pet?.id === 'pet_yuzu_capybara');
  check('starter island has 6 buildings + canal bridge', rp.village?.buildings?.length === 6 && rp.village.tiles.some((t) => t.t === 'bridge'));
  const again = await http(base, '/api/auth/login', { username: 'qa_newbie', password: 'pw1234', lineage: 'bkk' });
  check('second login reuses account (lineage unchanged)', again.data.created === false && again.data.profile.lineage === 'dxb');
  const me = await http(base, '/api/me', null, again.data.token);
  check('/api/me works with bearer token', me.status === 200 && me.data.profile.username === 'qa_newbie');
  const c1 = await http(base, '/api/a2hs/claim', {}, again.data.token);
  const c2 = await http(base, '/api/a2hs/claim', {}, again.data.token);
  check('A2HS gift +50💎 granted exactly once', c1.data.granted === 50 && c2.data.granted === 0 && c2.data.profile.diamonds === 650);

  // realtime
  const A = wsClient(srv.port, nook.data.token);
  const okA = await A.wait((m) => m.type === 'auth_ok');
  check('nook WS auth ok', !!okA);
  const B = wsClient(srv.port, beam.data.token);
  const okB = await B.wait((m) => m.type === 'auth_ok');
  check('bound couple share one instance', okA.instanceId === okB.instanceId && okA.instanceId === 'couple:beam|nook', okA.instanceId);
  check('couple spawns side by side, not stacked', Math.hypot(okA.self.x - okB.self.x, okA.self.z - okB.self.z) > 2);
  const snapB = await B.wait((m) => m.type === 'instance_snapshot');
  check('beam snapshot contains nook', snapB.players.some((p) => p.id === 'nook'));
  await A.wait((m) => m.type === 'player_joined' && m.player.id === 'beam');
  check('nook notified when beam joins', true);

  const M = wsClient(srv.port, (await http(base, '/api/auth/login', { username: 'mochi', password: '1234' })).data.token);
  const okM = await M.wait((m) => m.type === 'auth_ok');
  check('non-couple player gets their own village instance', okM.instanceId === 'village:mochi');

  let x = okA.self.x;
  for (let i = 0; i < 6; i++) { x += 0.3; A.send({ type: 'move_step', x, z: 2, vx: 4.5, vz: 0, right: true, back: false }); await sleep(70); }
  A.send({ type: 'move_step', x, z: 1.5, vx: 0, vz: -4.5, right: true, back: true });
  const moved = await B.wait((m) => m.type === 'player_moved' && m.back === true);
  check('beam receives nook movement incl. Back-3/4 facing', moved.id === 'nook' && Math.abs(moved.x - x) < 0.01);
  check('other instances do not receive it', !M.inbox.some((m) => m.type === 'player_moved'));
  A.send({ type: 'move_step', x: x + 12, z: 1.5, vx: 0, vz: 0, right: true, back: false });
  const corr = await A.wait((m) => m.type === 'position_correct');
  check('teleport hack clamped by server (position_correct)', corr && corr.x < x + 2, `x=${corr?.x?.toFixed(2)}`);
  A.send({ type: 'move_step', x: 999, z: 'bad' });
  await sleep(100);
  check('malformed packets ignored (server alive)', (await http(base, '/api/health')).status === 200);

  A.send({ type: 'auth_resume' });
  const res = await A.wait((m) => m.type === 'resume_ok');
  check('auth_resume returns profile + position', res.profile?.username === 'nook' && Number.isFinite(res.self?.x));

  await A.wait((m) => m.type === 'ping' && m.rtt != null, 2000).then(() => check('heartbeat ping/pong measures RTT', true)).catch(() => check('heartbeat ping/pong measures RTT', false));
  const lazy = wsClient(srv.port, beam.data.token, { autoPong: false });
  await lazy.wait((m) => m.type === 'auth_ok');
  const kicked = await B.wait((m) => m.type === 'kicked', 2000).catch(() => null);
  check('second device replaces the first (old socket kicked)', !!kicked);
  const code = await Promise.race([lazy.closed, sleep(2500).then(() => 'alive')]);
  check('dead client (no pongs) terminated after 2 missed heartbeats', code !== 'alive', `close=${code}`);

  const bad = wsClient(srv.port, 'not-a-token');
  check('invalid token rejected', !!(await bad.wait((m) => m.type === 'auth_fail')));

  for (const c of [A, B, M, bad]) c.close();
  await srv.close();
  const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  check('data flushed to local JSON on shutdown', saved.profiles.some((p) => p.id === 'qa_newbie'));
  srv = await startServer({ port: 0, dataFile, quiet: true });
  const relog = await http(`http://localhost:${srv.port}`, '/api/auth/login', { username: 'qa_newbie', password: 'pw1234' });
  check('account survives restart (650💎 kept)', relog.status === 200 && relog.data.profile.diamonds === 650);
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  NET.HEARTBEAT_MS = 25000;
}

async function partB() {
  console.log('\n— Part B: 2-browser visual + motion check (nook & beam) —');
  if (!fs.existsSync(CHROME)) { check('Chrome found for browser QA', false, CHROME); return; }
  const { default: puppeteer } = await import('puppeteer-core');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa-b-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  const launch = () => puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  // one Chrome per player so each page is the foreground tab (background tabs throttle rAF)
  const browsers = [await launch(), await launch()];
  const browser = { close: () => Promise.all(browsers.map((b) => b.close())) };
  const errors = [];
  try {
    const open = async (user, b) => {
      const page = await b.newPage();
      await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => errors.push(`${user}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${user}: ${m.text()}`); });
      await page.goto(`http://localhost:${srv.port}/?dev=1&debug=1&user=${user}&pass=1234`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.__neora?.debug()?.remotes !== undefined, { timeout: 15000 });
      return page;
    };
    const nook = await open('nook', browsers[0]);
    const beam = await open('beam', browsers[1]);
    const dbg = (p) => p.evaluate(() => window.__neora.debug());
    await nook.waitForFunction(() => window.__neora.debug().remotes.length === 1, { timeout: 8000 });
    check('nook sees beam in the same 2.5D instance', (await dbg(nook)).remotes[0]?.id === 'beam');
    check('beam sees nook', (await dbg(beam)).remotes[0]?.id === 'nook');
    await sleep(1200);
    await nook.screenshot({ path: path.join(SHOTS, '01_spawn_nook_view.png') });

    // Step 2: the meadow is now a real village with buildings — run the motion checks from an open
    // stretch of nook's island and use Finger Pick-Up & Drop to teleport (server-agreed position).
    const tp = async (page, x, z) => { await page.evaluate((x, z) => { const w = window.__neora.world; w.setLocalPosition(x, z); w.followDetached = false; w.onDrop({ x, z, propId: null }); }, x, z); await sleep(1000); };
    await tp(nook, 26.0, 6.5);
    const hold = async (page, keys, ms) => { for (const k of keys) await page.keyboard.down(k); await sleep(ms); for (const k of keys) await page.keyboard.up(k); };
    const sample = async (page, keys, ms) => {
      for (const k of keys) await page.keyboard.down(k);
      let minPet = Infinity; const t0 = Date.now(); let s;
      while (Date.now() - t0 < ms) { s = await dbg(page); if (s.petDist != null && Date.now() - t0 > 400) minPet = Math.min(minPet, s.petDist); await sleep(60); }
      return { s, minPet, release: async () => { for (const k of keys) await page.keyboard.up(k); } };
    };

    // ↘ down-right
    let r = await sample(nook, ['ArrowDown', 'ArrowRight'], 700);
    check('↘ moving down-right = SE Front-3/4', r.s.facing === 'SE' && r.s.view === 'Front-3/4' && !r.s.shownBack, `${r.s.facing} ${r.s.view}`);
    check('↘ face looks down-RIGHT (front art faces right → not mirrored)', r.s.mirror === 1, `mirror=${r.s.mirror}`);
    check('wings behind body on Front-3/4 (z = -0.04)', r.s.wingsZ === -0.04, `z=${r.s.wingsZ}`);
    await nook.screenshot({ path: path.join(SHOTS, '02_walk_SE_front.png') });
    await r.release();
    await sleep(150);
    // record every frame of a down -> up turn
    await nook.evaluate(() => { window.__trace = []; window.__tracing = true; const loop = () => { if (!window.__tracing) return; window.__trace.push(window.__neora.debug()); requestAnimationFrame(loop); }; loop(); });
    // ↖ up-left
    r = await sample(nook, ['ArrowUp', 'ArrowLeft'], 1100);
    const trace = await nook.evaluate(() => { window.__tracing = false; return window.__trace; });
    const views = trace.map((t) => t.shownView).filter((v, i, a) => v !== a[i - 1]);
    const minW = Math.min(...trace.map((t) => Math.abs(t.hipScaleX)));
    check('turn never collapses the width (no paper flip)', minW > 0.85, `min hip scale.x ${minW.toFixed(3)}`);
    check('front → side profile → back during the turn', trace[0]?.hasSide ? views.join('>').includes('front>side>back') : true, views.join(' > '));
    check('↖ moving up-left = NW Back-3/4 (whole body turns)', r.s.facing === 'NW' && r.s.view === 'Back-3/4' && r.s.shownBack, `${r.s.facing} ${r.s.view}`);
    check('↖ looks up-LEFT (back art is drawn facing left → not mirrored)', r.s.mirror === 1, `mirror=${r.s.mirror}`);
    check('wings in front of the back on Back-3/4 (z = +0.12)', r.s.wingsZ === 0.12, `z=${r.s.wingsZ}`);
    check('pet never overlaps owner, even on a full reversal (>= 0.6m)', r.minPet >= 0.6, `min ${r.minPet.toFixed(2)}m`);
    await nook.screenshot({ path: path.join(SHOTS, '03_walk_NW_back.png') });
    const remoteView = (await dbg(beam)).remotes[0];
    check("beam sees nook's Back-3/4 in real time", remoteView.back === true, JSON.stringify(remoteView));
    await beam.screenshot({ path: path.join(SHOTS, '04_beam_view_of_nook_back.png') });
    await r.release();
    // ↗ up-right
    r = await sample(nook, ['ArrowUp', 'ArrowRight'], 500);
    check('↗ moving up-right = NE Back-3/4 (mirrored)', r.s.facing === 'NE' && r.s.shownBack, `${r.s.facing}`);
    check('↗ looks up-RIGHT (left-drawn back art mirrored)', r.s.mirror === -1, `mirror=${r.s.mirror}`);
    await nook.screenshot({ path: path.join(SHOTS, '03b_walk_NE_back.png') });
    await r.release();
    await sleep(350);
    check('still Back-3/4 0.35s after stopping', (await dbg(nook)).back === true);
    await sleep(500);
    const idle = await dbg(nook);
    check('auto-turns to Front-3/4 after 0.6s idle', idle.back === false && idle.shownBack === false);
    await sleep(900);
    const rest = await dbg(nook);
    check('pet settles side-by-side 0.6–1.2m from owner', rest.petDist >= 0.6 && rest.petDist <= 1.2, `${rest.petDist}m`);
    await nook.screenshot({ path: path.join(SHOTS, '05_idle_front_pet_rest.png') });

    // drop nook next to beam (islands are 40 m apart now) and wait for pet nuzzle
    const tb = await dbg(beam);
    await tp(nook, tb.x - 1.6, tb.z);
    const target = (await dbg(beam));
    for (let i = 0; i < 40; i++) {
      const s = await dbg(nook);
      const dx = target.x - 1.2 - s.x, dz = target.z - s.z;
      if (Math.hypot(dx, dz) < 0.35) break;
      const keys = [];
      if (dx > 0.2) keys.push('ArrowRight'); else if (dx < -0.2) keys.push('ArrowLeft');
      if (dz > 0.2) keys.push('ArrowDown'); else if (dz < -0.2) keys.push('ArrowUp');
      await hold(nook, keys, 90);
    }
    await nook.waitForFunction(() => window.__neora.debug().petNuzzle, { timeout: 6000 }).then(() => check('pets nuzzle when owners idle within 2.2m', true))
      .catch(() => check('pets nuzzle when owners idle within 2.2m', false));
    await sleep(1600);
    await nook.screenshot({ path: path.join(SHOTS, '06_pet_nuzzle.png') });
    const fps = (await dbg(nook)).fps;
    check('renders frames (software GL in headless; real devices are faster)', fps > 0, `${fps} fps headless`);

    check('no page errors in either browser', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
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
console.log(`\n${failed.length ? '❌' : '✅'} Step 1 QA: ${results.length - failed.length}/${results.length} checks passed${noBrowser ? ' (browser part skipped)' : ''}`);
if (!noBrowser) console.log(`Screenshots: ${path.relative(process.cwd(), SHOTS)}/`);
process.exit(failed.length ? 1 : 0);
