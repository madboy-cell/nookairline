// server/server.js — Express + WebSocket entry point.
// Step 1: auth, persistence, presence & movement sync.
// Step 2: Twin Sky-Islands instance layout, authoritative village economy, grid editor saves,
//         Finger Pick-Up & Drop, couple blessing, Wonder actions and Dock fishing.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Database } from './db.js';
import {
  createStarterProfile, seedProfiles, verifyPassword, publicProfile, publicVillage, migrateProfile, upgradeSeedVillage, LINEAGES,
} from './profile_factory.js';
import { recalcPlayerCP } from '../shared/progression.js';
import { FISHING } from '../shared/catalog_landmarks.js';
import { instanceLayout, clampToArea, spawnPoint, dockNear, findPlaced, buildCellIndex } from '../shared/village_rules.js';
import * as eco from './economy_service.js';
import * as rpg from './rpg_service.js';
// Step 4: Universal 4-Seat Table Hub + 2.5D Sky Monopoly (table_* / mono_* messages, podium payouts)
import { createTableService } from './table_service.js';
import { OUTFITS } from '../shared/costumes_catalog.js';
import { ACCESSORIES, DICE_SKINS, getPetDef } from '../shared/catalog_gear_pets.js';
import { petPassivePct } from '../shared/rpg_rules.js';
import { CORE } from '../shared/catalog_landmarks.js';

// Step 3 & Step 3.5 actions (Section 11 row 4 / Section 23.3) — routed through onAction like the village_* actions.
const RPG_ACTIONS = new Set([
  'wardrobe_equip', 'gacha_pull', 'gacha_set_featured', 'shard_exchange', 'blacksmith_forge', 'pet_feed', 'pet_reroll_trait', 'pet_breed_couple',
  'pet_evolve', 'pet_reroll', 'pet_lock_slot', 'pet_infuse', 'pet_release', 'pet_set_visual_tier', 'pet_rename', 'pet_interact', 'pet_claim_gift',
  'pet_online_tick', 'pet_equip_costume', 'pet_adopt',
  'hair_classic_buy', 'hair_gacha_pull', 'hair_dye_unlock', 'hair_equip',
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- tiny .env loader (no dotenv dependency) --------------------------------
function loadEnv() {
  for (const f of [path.join(ROOT, '.env'), path.join(ROOT, 'server', '.env')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

export const NET = {
  HEARTBEAT_MS: 25000,
  MAX_MISSED_PONGS: 2,
  AUTH_TIMEOUT_MS: 5000,
  MAX_MSGS_PER_SEC: 30,
  MAX_SPEED: 4.5 * 1.15 * 1.6,                                  // base * road boost * tolerance
  ACTION_COOLDOWN_MS: 250,                                      // economy actions per socket
  DROP_COOLDOWN_MS: 800,
};

const USERNAME_RE = /^[a-z0-9_]{3,16}$/;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export async function startServer({ port = Number(process.env.PORT) || 4000, dataFile, quiet = false, rng = Math.random } = {}) {
  loadEnv();
  const log = quiet ? { info() {}, warn() {}, error: console.error } : { info: console.log, warn: console.warn, error: console.error };
  const db = new Database(dataFile || path.join(ROOT, 'server', 'data', 'local_db.json'), { log });
  await db.init();

  // Migrate legacy 'beam' profile to 'neen' before seeding QA accounts.
  if (db.getProfile('beam') && !db.getProfile('neen')) {
    const legacyBeam = db.getProfile('beam');
    legacyBeam.id = 'neen';
    legacyBeam.username = 'neen';
    db.profiles.delete('beam');
    db.putProfile(legacyBeam);
  }
  if (db.getProfile('beam') && db.getProfile('neen')) {
    db.profiles.delete('beam');
  }

  // Seed QA accounts on first boot (never overwrites existing progress).
  for (const p of seedProfiles()) if (!db.getProfile(p.id)) db.putProfile(p);
  // Migrate every save to the Step 2 village model + recompute derived CP / comfort.
  const boot = Date.now();
  for (const p of db.profiles.values()) {
    upgradeSeedVillage(p);
    migrateProfile(p, boot);
    rpg.migrateRpg(p);
    p.cp = recalcPlayerCP(p);
    db.markProfile(p.id);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // --- static -----------------------------------------------------------------
  app.get('/vendor/three.module.js', (_req, res) =>
    res.sendFile(path.join(ROOT, 'node_modules', 'three', 'build', 'three.module.js')));
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: 0 }));
  app.use(express.static(path.join(ROOT, 'client'), { maxAge: 0, extensions: ['html'] }));

  // --- auth ---------------------------------------------------------------------
  const loginAttempts = new Map(); // ip -> { n, reset }
  const tooMany = (ip) => {
    const now = Date.now();
    const a = loginAttempts.get(ip) || { n: 0, reset: now + 60000 };
    if (now > a.reset) { a.n = 0; a.reset = now + 60000; }
    a.n++; loginAttempts.set(ip, a);
    return a.n > 30;
  };

  const issueToken = (userId) => {
    const token = crypto.randomBytes(24).toString('hex');
    db.createSession(token, userId);
    return token;
  };

  const authUser = (req) => {
    const h = req.headers.authorization || '';
    const s = db.getSession(h.startsWith('Bearer ') ? h.slice(7) : null);
    return s ? db.getProfile(s.userId) : null;
  };

  app.post('/api/auth/login', (req, res) => {
    if (tooMany(req.ip)) return res.status(429).json({ error: 'Too many attempts, wait a minute.' });
    const rawUsername = String(req.body?.username || '').trim().toLowerCase();
    const username = rawUsername === 'beam' && db.getProfile('neen') && !db.getProfile('beam') ? 'neen' : rawUsername;
    const password = String(req.body?.password || '');
    const lineage = String(req.body?.lineage || req.body?.body || 'bkk');
    const appIn = req.body?.appearance || {};
    const appearanceOpts = {
      body: req.body?.body || appIn.body,
      hair: req.body?.hair || appIn.hair,
      hairColor: req.body?.hairColor || appIn.hairColor,
    };
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3–16 characters: a–z, 0–9 or _' });
    if (password.length < 4 || password.length > 64) return res.status(400).json({ error: 'Password must be 4–64 characters.' });

    let profile = db.getProfile(username);
    let created = false;
    if (profile) {
      if (!verifyPassword(password, profile.salt, profile.hash)) return res.status(401).json({ error: 'Wrong password for this username.' });
    } else {
      if (!LINEAGES.includes(lineage)) return res.status(400).json({ error: 'Pick a lineage.' });
      profile = rpg.migrateRpg(createStarterProfile(username, password, lineage, appearanceOpts));
      db.putProfile(profile);
      created = true;
      log.info(`[auth] registered ${username} (${profile.appearance?.body || lineage})`);
    }
    // NOTE: last_active_ts is NOT touched here — the WS join uses it for the offline catch-up report.
    db.markProfile(profile.id);
    res.json({ token: issueToken(profile.id), created, profile: publicProfile(profile, { self: true }) });
  });

  app.get('/api/me', (req, res) => {
    const p = authUser(req);
    if (!p) return res.status(401).json({ error: 'Session expired' });
    res.json({ profile: publicProfile(p, { self: true }) });
  });

  // +50 💎 first launch in standalone (Section 13.A.1 / 17.B.3). Client-reported; capped once per account.
  app.post('/api/a2hs/claim', (req, res) => {
    const p = authUser(req);
    if (!p) return res.status(401).json({ error: 'Session expired' });
    if (p.a2hs_claimed) return res.json({ granted: 0, profile: publicProfile(p, { self: true }) });
    p.a2hs_claimed = true;
    p.diamonds += 50;
    db.markProfile(p.id);
    pushProfile(p);
    res.json({ granted: 50, profile: publicProfile(p, { self: true }) });
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, players: sockets.size, uptime: process.uptime() }));

  // Step 3 dress-up calibration (Section 22.F): ?dev=1&dressup=1 writes offset / scale back to the catalog.
  // Dev only: refused in production and from anything but localhost.
  app.post('/api/dev/attach', async (req, res) => {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (process.env.NODE_ENV === 'production' || !local) return res.status(403).json({ error: 'dev only' });
    const { ATTACH, getAttachDef } = await import(`../shared/accessory_attach.js?t=${Date.now()}`);
    const { ACCESSORIES } = await import(`../shared/catalog_gear_pets.js?t=${Date.now()}`);
    const id = String(req.body?.itemId || '');
    const a = req.body?.attach;
    const baseDef = getAttachDef(id, ACCESSORIES[id]?.slot);
    const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    if (!baseDef || !a || !Array.isArray(a.offset) || !a.offset.every((v) => num(v, -3, 3)) || !num(a.scale, 0.05, 4)) {
      return res.status(400).json({ error: 'bad attach' });
    }
    const next = { ...baseDef, offset: a.offset.map((v) => Math.round(v * 1000) / 1000), scale: Math.round(a.scale * 1000) / 1000 };
    if (a.offsets && typeof a.offsets === 'object') {
      next.offsets = {};
      for (const v of ['front', 'side', 'back']) if (Array.isArray(a.offsets[v]) && a.offsets[v].every((x) => num(x, -3, 3))) next.offsets[v] = a.offsets[v].map((x) => Math.round(x * 1000) / 1000);
      if (!Object.keys(next.offsets).length) delete next.offsets;
    }
    if (a.scales && typeof a.scales === 'object') {
      next.scales = {};
      for (const v of ['front', 'side', 'back']) if (num(a.scales[v], 0.05, 4)) next.scales[v] = Math.round(a.scales[v] * 1000) / 1000;
      if (!Object.keys(next.scales).length) delete next.scales;
    }
    const all = { ...ATTACH, [id]: next };
    const file = path.join(ROOT, 'shared', 'accessory_attach.js');
    const src = fs.readFileSync(file, 'utf8');
    const start = src.indexOf('export const ATTACH');
    const end = src.indexOf('\n};\n', start);
    if (start < 0 || end < 0) return res.status(500).json({ error: 'ATTACH block not found' });
    const head = src.slice(0, start);
    const tail = src.slice(end + 4);   // everything after the ATTACH block (OUTFIT_FALLBACK, solvers, ...) is kept verbatim
    const body = Object.entries(all).map(([k, v]) => `  ${k}: ${JSON.stringify(v).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,(?=\S)/g, ', ')},`).join('\n');
    fs.writeFileSync(file, `${head}export const ATTACH = {\n${body}\n};\n${tail}`);
    log.info(`[dev] attach saved for ${id}`);
    res.json({ ok: true, itemId: id, attach: next });
  });

  // --- realtime -------------------------------------------------------------------
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 96 * 1024 }); // full 32×32 layouts fit
  const sockets = new Map();     // userId -> ws
  const instances = new Map();   // instanceId -> Set<userId>
  const presence = new Map();    // userId -> { x, z, vx, vz, right, back, t, instanceId }
  const layouts = new Map();     // instanceId -> Twin Sky-Islands layout (rebuilt on village change)

  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const broadcast = (instanceId, msg, exceptId) => {
    const members = instances.get(instanceId);
    if (!members) return;
    const data = JSON.stringify(msg);
    for (const id of members) if (id !== exceptId) { const s = sockets.get(id); if (s?.readyState === 1) s.send(data); }
  };
  function pushProfile(p) { send(sockets.get(p.id), { type: 'profile_update', profile: publicProfile(p, { self: true }), serverNow: Date.now() }); }

  // Step 4 tables: authoritative 4-seat rooms, bots, 12 s watchdog, Victory Podium payouts.
  const tables = createTableService({
    db, log, rng,
    sendTo: (id, msg) => send(sockets.get(id), msg),
    onlineIds: () => sockets.keys(),
    pushProfile,
    catalogs: {
      outfits: OUTFITS, accessories: ACCESSORIES, diceSkins: DICE_SKINS,
      petFamilyOf: (id) => { try { return getPetDef(id)?.family || null; } catch { return null; } },
      petPctOf: (pet) => { try { return petPassivePct(pet.id, pet.stars, pet.level) || 0; } catch { return 0; } },
      patisseriePct: (lv) => CORE.patisserie?.matchGoldPct?.(lv) || 0,
    },
  });

  const isCouple = (p) => !!(p.partner_id && db.getProfile(p.partner_id)?.partner_id === p.id);
  // Bound couples share one live instance (Twin Sky-Islands); everyone else is in their own village.
  const instanceFor = (p) => (isCouple(p) ? `couple:${[p.id, p.partner_id].sort().join('|')}` : `village:${p.id}`);
  const ownersOf = (instanceId) => instanceId.slice(instanceId.indexOf(':') + 1).split('|');

  function layoutFor(instanceId) {
    let L = layouts.get(instanceId);
    if (!L) {
      L = instanceLayout(ownersOf(instanceId).map((owner) => ({ owner, village: db.getProfile(owner).village })));
      for (const isl of L.islands) buildCellIndex(isl);
      layouts.set(instanceId, L);
    }
    return L;
  }
  const layoutWire = (L) => ({ islands: L.islands.map((i) => ({ owner: i.owner, S: i.S, cx: i.cx, village: publicVillage(i.village) })), bridge: L.bridge });

  /** Village of `owner` changed: rebuild every instance that renders it and tell its members. */
  function villageChanged(owner) {
    for (const id of [...layouts.keys()]) if (ownersOf(id).includes(owner)) layouts.delete(id);
    const p = db.getProfile(owner);
    for (const id of [`village:${owner}`, isCouple(p) ? instanceFor(p) : null]) {
      if (id && instances.has(id)) broadcast(id, { type: 'village_updated', owner, village: publicVillage(p.village), layout: layoutWire(layoutFor(id)) });
    }
  }

  const playerState = (id) => {
    const p = db.getProfile(id), s = presence.get(id);
    return { ...publicProfile(p), x: s.x, z: s.z, vx: s.vx, vz: s.vz, right: s.right, back: s.back };
  };

  const snapshotFor = (ws) => ({
    type: 'instance_snapshot',
    instanceId: ws.instanceId,
    players: [...(instances.get(ws.instanceId) || [])].filter((id) => id !== ws.userId && presence.has(id)).map(playerState),
  });

  function join(ws, p) {
    const old = sockets.get(p.id);
    if (old && old !== ws) { send(old, { type: 'kicked', reason: 'Signed in on another device' }); old.close(4001, 'replaced'); }
    sockets.set(p.id, ws);
    ws.userId = p.id;
    ws.instanceId = instanceFor(p);
    if (!instances.has(ws.instanceId)) instances.set(ws.instanceId, new Set());
    instances.get(ws.instanceId).add(p.id);
    const L = layoutFor(ws.instanceId);
    const prev = presence.get(p.id);
    if (!prev || prev.instanceId !== ws.instanceId) {
      const sp = spawnPoint(L, p.id, p.lineage);   // couples spawn on their own islands, never stacked
      presence.set(p.id, { x: sp.x, z: sp.z, vx: 0, vz: 0, right: p.lineage !== 'dxb', back: false, t: Date.now(), instanceId: ws.instanceId });
    }
    const now = Date.now();
    const offline = eco.computeOfflineGains(p, now, p.last_active_ts, { coupled: isCouple(p) });
    p.last_active_ts = now;
    db.markProfile(p.id);
    send(ws, {
      type: 'auth_ok', profile: publicProfile(p, { self: true }), instanceId: ws.instanceId, self: presence.get(p.id),
      layout: layoutWire(L), serverNow: now, coupled: isCouple(p), offline,
    });
    send(ws, snapshotFor(ws));
    broadcast(ws.instanceId, { type: 'player_joined', player: playerState(p.id) }, p.id);
    tables.connect(p.id);
    log.info(`[ws] ${p.id} joined ${ws.instanceId} (${sockets.size} online)`);
  }

  function leave(ws) {
    if (!ws.userId || sockets.get(ws.userId) !== ws) return;
    sockets.delete(ws.userId);
    tables.disconnect(ws.userId);
    const members = instances.get(ws.instanceId);
    members?.delete(ws.userId);
    if (members && !members.size) { instances.delete(ws.instanceId); layouts.delete(ws.instanceId); }
    broadcast(ws.instanceId, { type: 'player_left', id: ws.userId });
    const p = db.getProfile(ws.userId);
    if (p) { p.last_active_ts = Date.now(); db.markProfile(p.id); }
    log.info(`[ws] ${ws.userId} left (${sockets.size} online)`);
  }

  function onMove(ws, m) {
    if (![m.x, m.z, m.vx, m.vz].every(finite)) return;
    const s = presence.get(ws.userId);
    const now = Date.now();
    let { x, z } = clampToArea(layoutFor(ws.instanceId), m.x, m.z);
    // speed sanity: reject teleports beyond what max speed allows since the last accepted step
    const dt = Math.min(1, (now - s.t) / 1000);
    const allowed = NET.MAX_SPEED * dt + 0.6;
    const moved = Math.hypot(x - s.x, z - s.z);
    let corrected = x !== m.x || z !== m.z;
    if (moved > allowed) {
      const k = allowed / moved;
      x = s.x + (x - s.x) * k; z = s.z + (z - s.z) * k;
      corrected = true;
    }
    const sp = Math.hypot(m.vx, m.vz), maxV = NET.MAX_SPEED;
    const vk = sp > maxV ? maxV / sp : 1;
    Object.assign(s, { x, z, vx: m.vx * vk, vz: m.vz * vk, right: !!m.right, back: !!m.back, t: now });
    if (corrected) send(ws, { type: 'position_correct', x, z });
    broadcast(ws.instanceId, { type: 'player_moved', id: ws.userId, x, z, vx: s.vx, vz: s.vz, right: s.right, back: s.back }, ws.userId);
  }

  // --- Step 2 actions -------------------------------------------------------------
  /** Reply to an action + push the fresh profile. `changed` = village layout changed (re-broadcast). */
  function reply(ws, p, action, m, result, { changed = false } = {}) {
    send(ws, { type: 'action_result', action, reqId: m.reqId ?? null, serverNow: Date.now(), ...result });
    if (result.ok) {
      db.markProfile(p.id);
      pushProfile(p);
      if (changed) villageChanged(p.id);
    }
  }

  function onAction(ws, m) {
    const p = db.getProfile(ws.userId);
    const now = Date.now();
    if (now - (ws.lastAction || 0) < NET.ACTION_COOLDOWN_MS && m.type !== 'fishing_reel_complete' && m.type !== 'pet_online_tick') {
      return send(ws, { type: 'action_result', action: m.type, reqId: m.reqId ?? null, ok: false, error: 'slow_down' });
    }
    if (m.type !== 'pet_online_tick') ws.lastAction = now;
    const coupled = isCouple(p);
    switch (m.type) {
      case 'village_harvest_all':
        return reply(ws, p, m.type, m, eco.harvestAll(p, now, { coupled, rng }));
      case 'village_save_grid':
        return reply(ws, p, m.type, m, eco.saveLayout(p, m.layout), { changed: true });
      case 'village_set_mood':
        return reply(ws, p, m.type, m, eco.setMood(p, String(m.mood)), { changed: true });
      case 'village_upgrade': {
        const r = m.target === 'castle' ? eco.upgradeCastle(p) : eco.upgradeBuilding(p, String(m.target));
        return reply(ws, p, m.type, m, r, { changed: true });
      }
      case 'village_expand_cloud':
        return reply(ws, p, m.type, m, eco.expandTerritory(p), { changed: true });
      case 'village_bless_partner': {
        const partner = db.getProfile(p.partner_id);
        const r = eco.blessPartner(p, partner, now);
        if (r.ok) { db.markProfile(partner.id); pushProfile(partner); send(sockets.get(partner.id), { type: 'blessed', by: p.id, until: r.blessedUntil }); }
        return reply(ws, p, m.type, m, r);
      }
      case 'village_wonder_action': {
        if (m.action !== 'fountain_toss') return reply(ws, p, m.type, m, { ok: false, error: 'bad_action' });
        const owner = String(m.owner || p.id);
        const L = layoutFor(ws.instanceId);
        const isl = L.islands.find((i) => i.owner === owner);
        if (!isl) return reply(ws, p, m.type, m, { ok: false, error: 'not_here' });
        return reply(ws, p, m.type, m, eco.fountainToss(p, isl.village, now, rng));
      }
      // --- Step 3: Wardrobe, Gacha, Forge & Pets -------------------------------------
      case 'wardrobe_equip': {
        const r = rpg.wardrobeEquip(p, { slot: String(m.slot), itemId: m.itemId === null ? null : m.itemId === undefined ? undefined : String(m.itemId), hide: m.hide });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'gacha_pull': {
        const r = rpg.gachaPull(p, {
          box: m.box, count: m.count, currency: m.currency,
          banner: m.banner == null ? undefined : String(m.banner),
          featuredOutfit: m.featuredOutfit == null ? undefined : String(m.featuredOutfit),
        }, rng);
        return reply(ws, p, m.type, m, r, { changed: !!r.changed });
      }
      case 'gacha_set_featured': {
        const r = rpg.setFeaturedOutfit(p, { outfitId: String(m.outfitId || '') });
        return reply(ws, p, m.type, m, r);
      }
      case 'shard_exchange': {
        const r = rpg.shardExchange(p, { offerId: String(m.offerId), pickId: m.pickId == null ? undefined : String(m.pickId) }, rng);
        return reply(ws, p, m.type, m, r, { changed: !!r.changed });
      }
      case 'blacksmith_forge': {
        const r = rpg.blacksmithForge(p, { itemId: String(m.itemId), useBerries: !!m.useBerries, useScroll: !!m.useScroll }, now, rng);
        reply(ws, p, m.type, m, r);
        if (r.ok && r.sovereign) {
          const banner = { type: 'global_cheer_banner', winnerName: p.username, achievement: `forged ${r.itemId} to +10 Sovereign`, cheerId: crypto.randomBytes(4).toString('hex') };
          for (const s of sockets.values()) send(s, banner);
        }
        if (r.ok && r.success) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_feed':
        return reply(ws, p, m.type, m, rpg.petFeed(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId) }));
      case 'pet_reroll_trait':
        return reply(ws, p, m.type, m, rpg.petRerollTrait(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId), slotIdx: m.slotIdx }, rng));
      case 'pet_breed_couple': {
        const partner = db.getProfile(String(m.partnerId || p.partner_id || ''));
        const r = rpg.petBreedCouple(p, partner, { myPetUid: String(m.myPetUid), partnerPetUid: m.partnerPetUid == null ? null : String(m.partnerPetUid) }, rng);
        reply(ws, p, m.type, m, r);
        if (r.ok) send(sockets.get(partner.id), { type: 'couple_egg_hatched', by: p.id, hatched: r.hatched, trait: r.trait });
        return null;
      }
      // --- Pet Sanctuary V2 ("Soul-Bond Companions") ---------------------------------
      case 'pet_evolve': {
        const r = rpg.petEvolve(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId) }, rng);
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_lock_slot':
        return reply(ws, p, m.type, m, rpg.petLockSlot(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          slotIdx: m.slotIdx,
          locked: m.locked,
        }));
      case 'pet_reroll': {
        const instMembers = instances.get(ws.instanceId) || new Set();
        const partnerOnline = [...instMembers].some((id) => id !== p.id && (id === p.partner_id || (p.friends || []).includes(id)));
        const r = rpg.petReroll(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          locks: Array.isArray(m.locks) ? m.locks : undefined,
          confirmMythicWipe: Boolean(m.confirmMythicWipe),
        }, now, rng, { partnerOnline });
        return reply(ws, p, m.type, m, r);
      }
      case 'pet_infuse':
        return reply(ws, p, m.type, m, rpg.petInfuse(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          amount: m.amount,
        }));
      case 'pet_release': {
        const r = rpg.petRelease(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId) });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_set_visual_tier': {
        const r = rpg.petSetVisualTier(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          tier: m.tier,
        });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_rename': {
        const r = rpg.petRename(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          nickname: m.nickname,
        });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_interact':
        return reply(ws, p, m.type, m, rpg.petInteract(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
        }, now));
      case 'pet_claim_gift':
        return reply(ws, p, m.type, m, rpg.petClaimGift(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
        }, now, rng));
      case 'pet_online_tick':
        return reply(ws, p, m.type, m, rpg.petOnlineTick(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
        }, now));
      case 'pet_equip_costume': {
        const r = rpg.petEquipCostume(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          costumeId: m.costumeId == null ? undefined : String(m.costumeId),
        });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_adopt': {
        const r = rpg.petAdopt(p, { petId: String(m.petId || '') }, rng);
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      // --- Step 3.5: Fluffé's Hair Studio --------------------------------------------
      case 'hair_classic_buy': {
        const r = rpg.hairClassicBuy(p, { hairId: String(m.hairId || '') });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'hair_gacha_pull': {
        const r = rpg.hairGachaPull(p, { count: m.count, currency: String(m.currency || 'diamonds') }, rng);
        reply(ws, p, m.type, m, r);
        if (r.ok) {
          const cel = r.items?.find((it) => it.tier === 'celestial' && it.kind === 'new');
          if (cel) {
            const banner = { type: 'global_cheer_banner', winnerName: p.username, achievement: `pulled ${cel.name} ✨ Celestial Hair`, cheerId: crypto.randomBytes(4).toString('hex') };
            for (const s of sockets.values()) send(s, banner);
          }
          broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        }
        return null;
      }
      case 'hair_dye_unlock': {
        const r = rpg.hairDyeUnlock(p, { colorId: String(m.colorId || '') });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'hair_equip': {
        const r = rpg.hairEquip(p, {
          hairId: m.hairId == null ? undefined : String(m.hairId),
          colorId: m.colorId == null ? undefined : String(m.colorId),
          body: m.body == null ? undefined : String(m.body),
        });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      default: return null;
    }
  }

  /** Finger Pick-Up & Drop: the player lifts their own Chibi or Pet and drops it anywhere walkable. */
  function onPickupDrop(ws, m) {
    const p = db.getProfile(ws.userId);
    const now = Date.now();
    const isPetDrop = m.targetId === 'pet';
    if ((m.targetId !== ws.userId && !isPetDrop) || !finite(m.x) || !finite(m.z)) return;
    if (now - (ws.lastDrop || 0) < NET.DROP_COOLDOWN_MS) {
      const s = presence.get(ws.userId);
      return send(ws, { type: 'drop_result', ok: false, error: 'slow_down', x: s.x, z: s.z });
    }
    ws.lastDrop = now;
    const L = layoutFor(ws.instanceId);
    const { x, z } = clampToArea(L, m.x, m.z);
    let prop = null, buff = { buff: null };
    if (typeof m.propId === 'string') {
      const hit = findPlaced(L, m.propId, x, z);
      if (hit && hit.d <= 1.6) {
        prop = { uid: hit.building.uid, type: hit.building.type, owner: hit.island.owner };
        if (isPetDrop) {
          const eqPet = rpg.findOwnedPet(p, {});
          if (eqPet && ['nest', 'dec_cat_cushion', 'wnd_onsen'].includes(hit.building.type)) {
            const bondRes = rpg.petInteract(p, { petUid: eqPet.uid }, now);
            buff = { buff: 'pet_cozy_spot', bond_lv: eqPet.bond_lv, bond_xp: eqPet.bond_xp, leveledUp: bondRes?.leveledUp || false };
            db.markProfile(p.id);
            pushProfile(p);
          }
        } else {
          buff = eco.applyDropOnProp(p, hit.building, hit.island.village, now);
        }
      }
    }
    if (!isPetDrop) {
      const s = presence.get(ws.userId);
      Object.assign(s, { x, z, vx: 0, vz: 0, t: now });
    }
    if (buff.buff) db.markProfile(p.id);
    send(ws, { type: 'drop_result', ok: true, targetId: isPetDrop ? 'pet' : ws.userId, x, z, prop, ...buff });
    broadcast(ws.instanceId, { type: 'player_dropped', id: ws.userId, targetId: isPetDrop ? 'pet' : ws.userId, x, z, prop }, ws.userId);
  }

  // --- Dock fishing: loot rolled at cast, revealed after the reel minigame -----------
  function onFishing(ws, m) {
    const p = db.getProfile(ws.userId);
    const now = Date.now();
    const L = layoutFor(ws.instanceId);
    const s = presence.get(ws.userId);
    if (m.type === 'fishing_cast') {
      const dock = dockNear(L, s.x, s.z, FISHING.DOCK_REACH);
      if (!dock) return send(ws, { type: 'fishing_error', error: 'not_at_dock' });
      if (ws.cast && now < ws.cast.biteAt + FISHING.REEL_MS) return send(ws, { type: 'fishing_error', error: 'already_casting' });
      const bait = !!m.bait;
      if (bait && p.berries < FISHING.BAIT_COST_BERRIES) return send(ws, { type: 'fishing_error', error: 'not_enough_berries' });
      if (bait) { p.berries -= FISHING.BAIT_COST_BERRIES; db.markProfile(p.id); pushProfile(p); }
      // co-op: partner / friend standing on the same dock (voice-call trigger arrives in Step 5)
      const coop = [...(instances.get(ws.instanceId) || [])].some((id) => {
        if (id === ws.userId) return false;
        const o = presence.get(id);
        return o && Math.hypot(o.x - s.x, o.z - s.z) <= FISHING.COOP_RADIUS && dockNear(L, o.x, o.z, FISHING.DOCK_REACH);
      });
      const biteMs = FISHING.BITE_MIN_MS + Math.floor(rng() * (FISHING.BITE_MAX_MS - FISHING.BITE_MIN_MS));
      ws.cast = { id: crypto.randomBytes(6).toString('hex'), loot: eco.rollCatch({ bait, coop }, rng), bait, coop, biteAt: now + biteMs };
      return send(ws, { type: 'fishing_cast_ok', castId: ws.cast.id, biteMs, bait, coop, table: eco.lootTable({ bait, coop }) });
    }
    // fishing_reel_complete
    const c = ws.cast;
    if (!c || m.castId !== c.id) return send(ws, { type: 'fishing_error', error: 'no_cast' });
    const minEnd = c.biteAt + FISHING.REEL_MS * 0.9 - 150;              // can't reel faster than the gauge allows
    if (now < minEnd) return send(ws, { type: 'fishing_error', error: 'too_fast' });
    ws.cast = null;
    if (now > c.biteAt + FISHING.CAST_TIMEOUT_MS || !m.success) {
      return send(ws, { type: 'fishing_result', ok: false, escaped: true, key: c.loot });
    }
    const out = eco.awardCatch(p, c.loot, rng);
    db.markProfile(p.id);
    pushProfile(p);
    send(ws, { type: 'fishing_result', ok: true, coop: c.coop, bait: c.bait, ...out });
    broadcast(ws.instanceId, { type: 'player_caught', id: ws.userId, key: c.loot }, ws.userId);
  }

  wss.on('connection', (ws) => {
    ws.missed = 0;
    ws.rtt = null;
    ws.msgCount = 0;
    ws.msgWindow = Date.now();
    const authTimer = setTimeout(() => { if (!ws.userId) ws.close(4000, 'auth timeout'); }, NET.AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - ws.msgWindow > 1000) { ws.msgWindow = now; ws.msgCount = 0; }
      if (++ws.msgCount > NET.MAX_MSGS_PER_SEC) return; // drop flood silently
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m.type !== 'string') return;

      if (!ws.userId) {
        if (m.type !== 'auth') return;
        const s = db.getSession(String(m.token || ''));
        const p = s && db.getProfile(s.userId);
        if (!p) { send(ws, { type: 'auth_fail', error: 'Session expired, please sign in again.' }); ws.close(4003, 'bad token'); return; }
        clearTimeout(authTimer);
        join(ws, p);
        return;
      }

      try {
        switch (m.type) {
          case 'move_step': onMove(ws, m); break;
          case 'pong':
            ws.missed = 0;
            if (finite(m.t)) ws.rtt = Math.max(0, now - m.t);
            break;
          case 'auth_resume': {
            // wake from background: resend authoritative state in one round trip
            const p = db.getProfile(ws.userId);
            send(ws, { type: 'resume_ok', profile: publicProfile(p, { self: true }), self: presence.get(ws.userId), layout: layoutWire(layoutFor(ws.instanceId)), serverNow: now });
            send(ws, snapshotFor(ws));
            break;
          }
          case 'chibi_pickup_drop': onPickupDrop(ws, m); break;
          case 'fishing_cast':
          case 'fishing_reel_complete': onFishing(ws, m); break;
          default:
            if (tables.isTableMessage(m.type)) tables.handle(ws.userId, m);
            else if (m.type.startsWith('village_') || RPG_ACTIONS.has(m.type)) onAction(ws, m);
            break;
        }
      } catch (e) {
        log.error('[ws] handler error', m.type, e);
        send(ws, { type: 'action_result', action: m.type, reqId: m.reqId ?? null, ok: false, error: 'server_error' });
      }
    });

    ws.on('close', () => { clearTimeout(authTimer); leave(ws); });
    ws.on('error', () => {});
  });

  // 25s app-level heartbeat (Section 21.J): keeps mobile/proxy idle timers alive + measures RTT.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.missed >= NET.MAX_MISSED_PONGS) { ws.terminate(); continue; }
      ws.missed++;
      send(ws, { type: 'ping', t: Date.now(), rtt: ws.rtt });
    }
  }, NET.HEARTBEAT_MS);

  await new Promise((resolve) => server.listen(port, resolve));
  const actualPort = server.address().port;
  log.info(`\n🪐 NEORA WORLD V2 running at http://localhost:${actualPort}  (test accounts: nook / beam / mochi / leo, password 1234)\n`);

  async function close() {
    clearInterval(heartbeat);
    tables.close();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
    await db.close();
  }
  return { port: actualPort, close, db, app, tables };
}

// Run directly: `npm start`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const srv = await startServer();
  const shutdown = async (sig) => {
    console.log(`\n${sig}: flushing data…`);
    await srv.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
