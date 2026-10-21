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
  createStarterProfile, seedProfiles, hashPassword, verifyPassword, publicProfile, publicVillage, migrateProfile, upgradeSeedVillage, LINEAGES,
} from './profile_factory.js';
import { recalcPlayerCP } from '../shared/progression.js';
import { FISHING } from '../shared/catalog_landmarks.js';
import { instanceLayout, clampToArea, spawnPoint, dockNear, findPlaced, buildCellIndex, isWalkablePos, nearestWalkablePos } from '../shared/village_rules.js';
import * as eco from './economy_service.js';
import * as rpg from './rpg_service.js';
// Step 4: Universal 4-Seat Table Hub + 2.5D Sky Monopoly (table_* / mono_* messages, podium payouts)
import { createTableService } from './table_service.js';
import { OUTFITS } from '../shared/costumes_catalog.js';
import { ACCESSORIES, DICE_SKINS, getPetDef } from '../shared/catalog_gear_pets.js';
import { petPassivePct } from '../shared/rpg_rules.js';
import { CORE } from '../shared/catalog_landmarks.js';
// Phase 5: Daily RPG Service, WebRTC Voice Calls, Town Hall
import { ensurePhase5, createDailyService } from './daily_service.js';
import { createVoiceCallService } from './voice_call_service.js';
import { createTownHallBotController } from './town_hall_bots.js';
import { TOWNHALL } from '../shared/phase5_rules.js';

// Step 3 & Step 3.5 & Step 5 actions — routed through onAction like the village_* actions.
const RPG_ACTIONS = new Set([
  'wardrobe_equip', 'wardrobe_glamour', 'charm_equip', 'charm_consume', 'charm_salvage', 'charm_lock', 'gear_attune', 'dash_preset_save', 'dash_preset_equip',
  'gacha_pull', 'gacha_set_featured', 'shard_exchange', 'blacksmith_forge', 'pet_feed', 'pet_reroll_trait', 'pet_breed_couple',
  'pet_evolve', 'pet_reroll', 'pet_lock_slot', 'pet_infuse', 'pet_release', 'pet_set_visual_tier', 'pet_rename', 'pet_interact', 'pet_claim_gift',
  'pet_online_tick', 'pet_equip_costume', 'pet_adopt', 'pet_set_poses',
  'hair_classic_buy', 'hair_gacha_pull', 'hair_dye_unlock', 'hair_equip',
  // Phase 5 actions
  'hall_list', 'hall_worship', 'cheer_claim', 'owl_send_gift', 'owl_claim_mail', 'vip_card_buy', 'vip_card_use', 'bag_item_use', 'passport_state', 'passport_claim', 'founder_claim',
  // Social & Couple actions
  'social_directory', 'friend_request_send', 'friend_request_accept', 'friend_request_decline', 'friend_remove',
  'couple_propose', 'couple_accept', 'couple_decline', 'couple_break', 'couple_moment',
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
  MAX_MSGS_PER_SEC: 90,
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
    ensurePhase5(p);
    p.cp = recalcPlayerCP(p);
    db.markProfile(p.id);
  }
  // Reconcile two-way friendship symmetry and clean up non-existent friend IDs.
  for (const p of db.profiles.values()) {
    p.friends = Array.from(new Set(
      (p.friends || [])
        .map((fid) => String(fid || '').toLowerCase())
        .filter((fid) => fid && fid !== p.id && db.getProfile(fid))
    ));
    for (const fid of p.friends) {
      const fProf = db.getProfile(fid);
      if (fProf && Array.isArray(fProf.friends) && !fProf.friends.includes(p.id)) {
        fProf.friends.push(p.id);
        db.markProfile(fProf.id);
      }
    }
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  // --- static -----------------------------------------------------------------
  const noCacheStaticOpts = {
    maxAge: 0,
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html|js|css|json)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  };
  app.get('/vendor/three.module.js', (_req, res) =>
    res.sendFile(path.join(ROOT, 'node_modules', 'three', 'build', 'three.module.js')));
  app.use('/shared', express.static(path.join(ROOT, 'shared'), noCacheStaticOpts));
  app.use(express.static(path.join(ROOT, 'client'), { ...noCacheStaticOpts, extensions: ['html'] }));

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

  app.post('/api/auth/logout', (req, res) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (token) db.deleteSession(token);
    res.json({ ok: true });
  });

  app.post('/api/auth/bind-email', (req, res) => {
    const p = authUser(req);
    if (!p) return res.status(401).json({ error: 'Session expired' });
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const emailRe = /^[a-z0-9._%+-]+@(gmail\.com|googlemail\.com|[a-z0-9.-]+\.[a-z]{2,})$/i;
    if (!rawEmail || rawEmail.length > 64 || !emailRe.test(rawEmail)) {
      return res.status(400).json({ error: 'Please enter a valid Gmail or email address.' });
    }
    for (const other of db.profiles.values()) {
      if (other.id !== p.id && other.email && other.email.toLowerCase() === rawEmail) {
        return res.status(409).json({ error: 'This Gmail is already bound to another account.' });
      }
    }
    p.email = rawEmail;
    p.email_bound_at = Date.now();
    let granted = 0;
    if (!p.email_reward_claimed) {
      p.email_reward_claimed = true;
      granted = 100;
      p.diamonds = (p.diamonds || 0) + granted;
    }
    db.markProfile(p.id);
    pushProfile(p);
    res.json({ ok: true, email: p.email, granted, profile: publicProfile(p, { self: true }) });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const p = authUser(req);
    if (!p) return res.status(401).json({ error: 'Session expired' });
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!verifyPassword(currentPassword, p.salt, p.hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (newPassword.length < 4 || newPassword.length > 64) {
      return res.status(400).json({ error: 'New password must be 4–64 characters.' });
    }
    Object.assign(p, hashPassword(newPassword));
    db.markProfile(p.id);
    res.json({ ok: true });
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

  const sendHealth = (_req, res) => {
    res.json({
      ok: true,
      status: 'ok',
      version: '2.0.0',
      uptimeSec: Math.round(process.uptime()),
      uptime: process.uptime(),
      onlinePlayers: sockets.size,
      players: sockets.size,
      activeTables: tables?.mgr?.tables?.size || 0,
      db: typeof db.getStats === 'function' ? db.getStats() : { profiles: db.profiles.size },
    });
  };
  app.get('/api/health', sendHealth);
  app.get('/healthz', sendHealth);
  app.get(['/bkk', '/dxb'], (_req, res) => res.sendFile(path.join(ROOT, 'client', 'index.html')));

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

  const broadcastAll = (msg) => {
    const data = JSON.stringify(msg);
    for (const s of sockets.values()) {
      if (s?.readyState === 1) s.send(data);
    }
  };

  function onCoupleChanged(userA, userB) {
    // Clear cached couple/village layouts for both users and transition active village instances
    for (const id of [...layouts.keys()]) {
      const owners = ownersOf(id);
      if (owners.includes(userA) || owners.includes(userB)) layouts.delete(id);
    }
    for (const uid of [userA, userB]) {
      if (!uid) continue;
      const ws = sockets.get(uid);
      if (ws && ws.readyState === 1 && ws.instanceId && !isOpen36Instance(ws.instanceId)) {
        switchInstance(ws, 'home', { force: true });
      }
    }
  }

  const dailyService = createDailyService({
    db,
    now: () => Date.now(),
    sendTo: (userId, msg) => send(sockets.get(userId), msg),
    broadcastAll,
    pushProfile,
    rng,
    listProfiles: () => [...db.profiles.values()],
    isOnline: (id) => (sockets.has(id) && sockets.get(id)?.readyState === 1) || !!db.getProfile(id)?.is_bot,
    getPresence: (id) => presence.get(id),
    onCoupleChanged,
  });

  const voiceService = createVoiceCallService({
    getProfile: (id) => db.getProfile(id),
    isOnline: (id) => sockets.has(id) && sockets.get(id)?.readyState === 1,
    send: (id, msg) => send(sockets.get(id), msg),
    now: () => Date.now(),
    canCall: (caller, callee, nowMs) => dailyService.canCall(caller, callee, nowMs),
    grant: (userId, { diamonds, exp }) => {
      const p = db.getProfile(userId);
      if (!p) return;
      if (diamonds) p.diamonds = (p.diamonds || 0) + diamonds;
      if (exp) eco.grantExp(p, exp);
      db.markProfile(p.id);
      pushProfile(p);
    },
    onCallActivity: (callerId, calleeId, ev = {}) => {
      const callerProf = db.getProfile(callerId);
      const calleeProf = db.getProfile(calleeId);
      if (!callerProf || !calleeProf) return;
      if (callerProf.partner_id && callerProf.partner_id.toLowerCase() === calleeProf.id.toLowerCase()) {
        if (ev.kind === 'connected') {
          dailyService.bumpCoupleStat(callerProf, { callSessions: 1 });
        } else if (ev.kind === 'reward') {
          dailyService.bumpCoupleStat(callerProf, {
            callMinutes: ev.minutes || 15,
            callDiamonds: ev.diamonds || 0,
          });
        } else if (ev.kind === 'ended' && (ev.minutes || 0) > 0) {
          dailyService.bumpCoupleStat(callerProf, { callMinutes: ev.minutes });
        }
      }
    },
  });

  const voiceTicker = setInterval(() => {
    voiceService.tick();
  }, 1000);

  const townHallBots = createTownHallBotController({
    db,
    instances,
    presence,
    sockets,
    broadcast,
    rng: Math.random,
  });

  // Step 4 tables: authoritative 4-seat rooms, bots, 12 s watchdog, Victory Podium payouts.
  const tables = createTableService({
    db, log, rng,
    sendTo: (id, msg) => send(sockets.get(id), msg),
    onlineIds: () => sockets.keys(),
    pushProfile,
    onBigHit: ({ winnerId, winnerName, mult, number }) => {
      dailyService.emitCheer({
        winnerId,
        winnerName,
        achievement: `hit ⚡ ${mult}× on #${number} at Zeus Roulette`,
      });
    },
    onHandSettled: (prof) => {
      dailyService.bumpQuest(prof, 'play');
      pushProfile(prof);
    },
    onMatchFinished: (prof) => {
      dailyService.bumpQuest(prof, 'play');
      pushProfile(prof);
    },
    onMvpCharmDrop: ({ playerId, playerName, wave, charm }) => {
      dailyService.emitCheer({
        winnerId: playerId,
        winnerName: playerName,
        achievement: `dropped 🌈 [${charm.name}] (${charm.grade} Grade) on Wave ${wave} in Moon Sanctuary!`,
      });
      broadcastAll({
        type: 'mvp_charm_broadcast',
        playerId,
        playerName,
        wave,
        charm,
      });
    },
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
      if (id && instances.has(id)) {
        const L = layoutFor(id);
        broadcast(id, { type: 'village_updated', owner, village: publicVillage(p.village), layout: layoutWire(L) });
        for (const memberId of instances.get(id)) {
          const s = presence.get(memberId);
          const mp = db.getProfile(memberId);
          const canFly = !!mp?.equipped?.wings?.id;
          if (s && !isWalkablePos(L, s.x, s.z, { canFly })) {
            const safe = nearestWalkablePos(L, s.x, s.z, { canFly });
            s.x = safe.x; s.z = safe.z; s.vx = 0; s.vz = 0;
            const memberWs = sockets.get(memberId);
            send(memberWs, { type: 'position_correct', x: s.x, z: s.z, zoneSeq: memberWs?.zoneSeq });
            broadcast(id, { type: 'player_moved', id: memberId, x: s.x, z: s.z, vx: 0, vz: 0, right: s.right, back: s.back }, memberId);
          }
        }
      }
    }
  }

  const playerState = (id) => {
    const p = db.getProfile(id), s = presence.get(id);
    return { ...publicProfile(p), x: s.x, z: s.z, vx: s.vx, vz: s.vz, right: s.right, back: s.back };
  };

  const MUSEUM_ID = 'nook_museum';
  const isOpen36Instance = (id) => id === TOWNHALL.ID || id === MUSEUM_ID || String(id || '').startsWith('nook_museum:');

  function partnerCompanionFor(userId, instanceId) {
    const p = db.getProfile(userId);
    if (!p || !isCouple(p)) return null;
    const partner = db.getProfile(p.partner_id);
    if (!partner || instanceId === TOWNHALL.ID) return null;
    if (instanceId === MUSEUM_ID || String(instanceId || '').startsWith('nook_museum:')) {
      const inPortal = String(instanceId || '').includes(':');
      return {
        ...publicProfile(partner),
        x: inPortal ? 0.95 : 0.95,
        z: inPortal ? 2.5 : 2.2,
        vx: 0,
        vz: 0,
        right: false,
        back: inPortal,
        isCompanion: true,
      };
    }
    const L = layoutFor(instanceId);
    const br = L?.bridge;
    const cx = br ? br.cx + 0.55 : 18;
    const cz = br ? (br.z0 + br.z1) / 2 : 0;
    return {
      ...publicProfile(partner),
      x: cx,
      z: cz,
      vx: 0,
      vz: 0,
      right: false,
      back: false,
      isCompanion: true,
    };
  }

  const snapshotFor = (ws) => {
    const s = presence.get(ws.userId);
    const isMuseum = ws.instanceId === MUSEUM_ID || String(ws.instanceId || '').startsWith('nook_museum:');
    const portalId = String(ws.instanceId || '').startsWith('nook_museum:') ? ws.instanceId.split(':')[1] : null;
    return {
      type: 'instance_snapshot',
      instanceId: ws.instanceId,
      zoneSeq: ws.zoneSeq || 1,
      layout: ws.instanceId === TOWNHALL.ID
        ? { kind: 'townhall', size: 36 }
        : isMuseum
          ? { kind: 'museum', size: 36, portalId }
          : layoutWire(layoutFor(ws.instanceId)),
      self: s ? { x: s.x, z: s.z } : undefined,
      players: [...(instances.get(ws.instanceId) || [])].filter((id) => id !== ws.userId && presence.has(id)).map(playerState),
      partnerCompanion: partnerCompanionFor(ws.userId, ws.instanceId),
    };
  };

  function switchInstance(ws, to, { force = false, spawn = null } = {}) {
    const p = db.getProfile(ws.userId);
    if (!p) return;
    let targetId;
    let spawnOwnerId = p.id;
    const toStr = String(to || 'home');
    if (toStr === 'townhall') {
      targetId = TOWNHALL.ID;
    } else if (toStr === 'museum' || toStr === 'nook_museum') {
      targetId = MUSEUM_ID;
    } else if (toStr.startsWith('museum:') || toStr.startsWith('nook_museum:')) {
      const pid = toStr.slice(toStr.indexOf(':') + 1).trim().toLowerCase();
      targetId = pid ? `${MUSEUM_ID}:${pid}` : MUSEUM_ID;
    } else if (toStr.startsWith('visit:') || toStr.startsWith('village:')) {
      const visitUser = toStr.slice(toStr.indexOf(':') + 1).trim().toLowerCase();
      const targetProf = db.getProfile(visitUser);
      if (targetProf) {
        targetId = instanceFor(targetProf);
        spawnOwnerId = targetProf.id;
      } else {
        targetId = instanceFor(p);
      }
    } else {
      targetId = instanceFor(p);
    }

    const hasCustomSpawn = Boolean(spawn && finite(spawn.x) && finite(spawn.z));
    const sameInstance = ws.instanceId === targetId;
    if (sameInstance && !force && !hasCustomSpawn && !(toStr.startsWith('visit:') && spawnOwnerId !== p.id)) return;

    // Leave current instance if changing instanceId
    const oldId = ws.instanceId;
    if (oldId && oldId !== targetId) {
      const members = instances.get(oldId);
      members?.delete(ws.userId);
      if (members && !members.size && !isOpen36Instance(oldId)) {
        instances.delete(oldId);
        layouts.delete(oldId);
      }
      broadcast(oldId, { type: 'player_left', id: ws.userId });
    }

    // Join target instance
    ws.instanceId = targetId;
    ws.zoneSeq = (ws.zoneSeq || 0) + 1;
    if (!instances.has(targetId)) instances.set(targetId, new Set());
    instances.get(targetId).add(ws.userId);

    const s = presence.get(ws.userId);
    const now = Date.now();
    let layoutPayload;
    let selfPos;
    if (targetId === TOWNHALL.ID) {
      layoutPayload = { kind: 'townhall', size: 36 };
      const sx = hasCustomSpawn ? Math.max(-17.2, Math.min(17.2, Number(spawn.x))) : 0;
      const sz = hasCustomSpawn ? Math.max(-17.2, Math.min(17.2, Number(spawn.z))) : 6;
      selfPos = { x: sx, z: sz };
      if (s) {
        Object.assign(s, { x: sx, z: sz, vx: 0, vz: 0, t: now, instanceId: targetId });
      } else {
        presence.set(ws.userId, { x: sx, z: sz, vx: 0, vz: 0, right: true, back: false, t: now, instanceId: targetId });
      }
    } else if (targetId === MUSEUM_ID || String(targetId).startsWith('nook_museum:')) {
      const portalId = String(targetId).startsWith('nook_museum:') ? targetId.split(':')[1] : null;
      layoutPayload = { kind: 'museum', size: 36, portalId };
      const defX = portalId ? -0.55 : -0.6;
      const defZ = portalId ? 2.6 : 2.2;
      const sx = hasCustomSpawn ? Math.max(-17.2, Math.min(17.2, Number(spawn.x))) : defX;
      const sz = hasCustomSpawn ? Math.max(-17.2, Math.min(17.2, Number(spawn.z))) : defZ;
      selfPos = { x: sx, z: sz };
      if (s) {
        Object.assign(s, { x: selfPos.x, z: selfPos.z, vx: 0, vz: 0, t: now, instanceId: targetId });
      } else {
        presence.set(ws.userId, { x: selfPos.x, z: selfPos.z, vx: 0, vz: 0, right: true, back: !!portalId, t: now, instanceId: targetId });
      }
    } else {
      const L = layoutFor(targetId);
      layoutPayload = layoutWire(L);
      const sp = spawnPoint(L, spawnOwnerId, p.lineage);
      selfPos = { x: sp.x, z: sp.z };
      if (s) {
        Object.assign(s, { x: sp.x, z: sp.z, vx: 0, vz: 0, t: now, instanceId: targetId });
      } else {
        presence.set(ws.userId, { x: sp.x, z: sp.z, vx: 0, vz: 0, right: p.lineage !== 'dxb', back: false, t: now, instanceId: targetId });
      }
    }

    send(ws, {
      type: 'instance_snapshot',
      instanceId: targetId,
      zoneSeq: ws.zoneSeq,
      visitingOwner: spawnOwnerId !== p.id ? spawnOwnerId : null,
      layout: layoutPayload,
      self: selfPos,
      players: [...instances.get(targetId)].filter((id) => id !== ws.userId && presence.has(id)).map(playerState),
      partnerCompanion: partnerCompanionFor(ws.userId, targetId),
    });
    if (sameInstance) {
      broadcast(targetId, { type: 'player_moved', id: ws.userId, x: selfPos.x, z: selfPos.z, vx: 0, vz: 0, right: s?.right ?? true, back: s?.back ?? false }, ws.userId);
    } else {
      broadcast(targetId, { type: 'player_joined', player: playerState(ws.userId) }, ws.userId);
      // If a coupled partner enters the NookAirline Museum or steps into a Scenery Portal room,
      // send a non-intrusive popup invite banner to their online partner so they can 1-tap Join Together!
      if ((targetId === MUSEUM_ID || String(targetId).startsWith('nook_museum:')) && isCouple(p) && p.partner_id) {
        const partnerWs = sockets.get(p.partner_id);
        if (partnerWs && partnerWs.instanceId !== targetId) {
          const portalId = String(targetId).startsWith('nook_museum:') ? String(targetId).split(':')[1] : null;
          send(partnerWs, {
            type: 'museum_partner_invite',
            fromId: p.id,
            fromName: p.username,
            instanceId: targetId,
            portalId,
          });
        }
      }
    }
  }

  function join(ws, p) {
    ensurePhase5(p);
    dailyService.onDailyLogin(p);
    const old = sockets.get(p.id);
    if (old && old !== ws) { send(old, { type: 'kicked', reason: 'Signed in on another device' }); old.close(4001, 'replaced'); }
    sockets.set(p.id, ws);
    ws.userId = p.id;
    ws.instanceId = instanceFor(p);
    ws.zoneSeq = (ws.zoneSeq || 0) + 1;
    if (!instances.has(ws.instanceId)) instances.set(ws.instanceId, new Set());
    instances.get(ws.instanceId).add(p.id);
    const L = layoutFor(ws.instanceId);
    const prev = presence.get(p.id);
    const canFly = !!p.equipped?.wings?.id;
    if (!prev || prev.instanceId !== ws.instanceId) {
      const sp = spawnPoint(L, p.id, p.lineage);   // couples spawn on their own islands, never stacked
      presence.set(p.id, { x: sp.x, z: sp.z, vx: 0, vz: 0, right: p.lineage !== 'dxb', back: false, t: Date.now(), instanceId: ws.instanceId });
    } else if (!isWalkablePos(L, prev.x, prev.z, { canFly })) {
      const safe = nearestWalkablePos(L, prev.x, prev.z, { canFly });
      prev.x = safe.x; prev.z = safe.z; prev.vx = 0; prev.vz = 0;
    }
    const now = Date.now();
    const offline = eco.computeOfflineGains(p, now, p.last_active_ts, { coupled: isCouple(p) });
    p.last_active_ts = now;
    db.markProfile(p.id);
    send(ws, {
      type: 'auth_ok', profile: publicProfile(p, { self: true }), instanceId: ws.instanceId, zoneSeq: ws.zoneSeq, self: presence.get(p.id),
      layout: layoutWire(L), serverNow: now, coupled: isCouple(p), offline,
    });
    send(ws, snapshotFor(ws));
    broadcast(ws.instanceId, { type: 'player_joined', player: playerState(p.id) }, p.id);
    tables.connect(p.id);
    voiceService.onReconnect(p.id);
    log.info(`[ws] ${p.id} joined ${ws.instanceId} (${sockets.size} online)`);
  }

  function leave(ws) {
    if (!ws.userId || sockets.get(ws.userId) !== ws) return;
    voiceService.onDisconnect(ws.userId);
    sockets.delete(ws.userId);
    tables.disconnect(ws.userId);
    const members = instances.get(ws.instanceId);
    members?.delete(ws.userId);
    if (members && !members.size && !isOpen36Instance(ws.instanceId)) { instances.delete(ws.instanceId); layouts.delete(ws.instanceId); }
    broadcast(ws.instanceId, { type: 'player_left', id: ws.userId });
    const p = db.getProfile(ws.userId);
    if (p) { p.last_active_ts = Date.now(); db.markProfile(p.id); }
    log.info(`[ws] ${ws.userId} left (${sockets.size} online)`);
  }

  function onMove(ws, m) {
    if (![m.x, m.z, m.vx, m.vz].every(finite)) return;
    if (m.zoneSeq != null && ws.zoneSeq != null && Number(m.zoneSeq) !== Number(ws.zoneSeq)) return;
    const s = presence.get(ws.userId);
    if (!s) return;
    const activeTable = typeof tables?.mgr?.tableOf === 'function' ? tables.mgr.tableOf(ws.userId) : null;
    if (activeTable && activeTable.status === 'playing' && (activeTable.mode === 'moon_bunny' || activeTable.mode === 'cloud_dash')) {
      return;
    }
    const now = Date.now();
    const isOpen36 = isOpen36Instance(ws.instanceId);
    let x, z;
    if (isOpen36) {
      x = Math.max(-18, Math.min(18, m.x));
      z = Math.max(-18, Math.min(18, m.z));
    } else {
      const clamped = clampToArea(layoutFor(ws.instanceId), m.x, m.z);
      x = clamped.x;
      z = clamped.z;
    }
    // speed sanity: reject teleports beyond what max speed allows since the last accepted step
    // (except explicit in-scene teleports inside open 36x36 plazas/museums/portals)
    const dt = Math.min(1, (now - s.t) / 1000);
    const allowed = NET.MAX_SPEED * dt + 1.2;
    const moved = Math.hypot(x - s.x, z - s.z);
    let corrected = x !== m.x || z !== m.z;
    const L = !isOpen36 ? layoutFor(ws.instanceId) : null;
    const p = L ? db.getProfile(ws.userId) : null;
    const canFly = !!p?.equipped?.wings?.id;
    const prevStuck = L ? !isWalkablePos(L, s.x, s.z, { canFly, radius: 0.14 }) : false;
    const allowInSceneTeleport = Boolean(m.teleport && isOpen36);
    if (moved > allowed && !prevStuck && !allowInSceneTeleport) {
      const k = allowed / moved;
      x = s.x + (x - s.x) * k; z = s.z + (z - s.z) * k;
      corrected = true;
    }
    if (L && !isWalkablePos(L, x, z, { canFly, radius: 0.14 })) {
      ({ x, z } = nearestWalkablePos(L, x, z, { canFly, radius: 0.20 }));
      corrected = true;
    }
    const sp = Math.hypot(m.vx, m.vz), maxV = NET.MAX_SPEED;
    const vk = sp > maxV ? maxV / sp : 1;
    Object.assign(s, { x, z, vx: m.vx * vk, vz: m.vz * vk, right: !!m.right, back: !!m.back, t: now });
    if (corrected) send(ws, { type: 'position_correct', x, z, zoneSeq: ws.zoneSeq });
    broadcast(ws.instanceId, { type: 'player_moved', id: ws.userId, x, z, vx: s.vx, vz: s.vz, right: s.right, back: s.back }, ws.userId);
  }

  // --- Step 2 actions -------------------------------------------------------------
  /** Reply to an action + push the fresh profile. `changed` = village layout changed (re-broadcast). */
  function reply(ws, p, action, m, result, { changed = false } = {}) {
    if (result.ok) {
      db.markProfile(p.id);
      pushProfile(p);
      if (changed) villageChanged(p.id);
    }
    send(ws, { type: 'action_result', action, reqId: m.reqId ?? null, serverNow: Date.now(), ...result });
  }

  function onAction(ws, m) {
    const p = db.getProfile(ws.userId);
    const now = Date.now();
    const noCooldown = m.type === 'fishing_reel_complete' || m.type === 'pet_online_tick' || m.type === 'pet_set_poses' || m.type === 'hall_list' || m.type === 'passport_state' || m.type === 'social_directory' || m.type === 'couple_moment';
    if (now - (ws.lastAction || 0) < NET.ACTION_COOLDOWN_MS && !noCooldown) {
      return send(ws, { type: 'action_result', action: m.type, reqId: m.reqId ?? null, ok: false, error: 'slow_down' });
    }
    if (!noCooldown) ws.lastAction = now;
    const coupled = isCouple(p);
    switch (m.type) {
      case 'village_harvest_all': {
        const r = eco.harvestAll(p, now, { coupled, rng });
        if (r.ok) dailyService.bumpQuest(p, 'harvest');
        return reply(ws, p, m.type, m, r);
      }
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
        const targetId = m.target ? String(m.target).trim().toLowerCase() : p.partner_id;
        const target = targetId ? db.getProfile(targetId) : null;
        const r = m.target ? eco.blessFriend(p, target, now) : eco.blessPartner(p, target, now);
        if (r.ok && target) {
          if (p.partner_id && p.partner_id.toLowerCase() === target.id.toLowerCase()) {
            dailyService.bumpCoupleStat(p, { blessingsShared: 1 });
          }
          db.markProfile(target.id);
          pushProfile(target);
          villageChanged(target.id);
          send(sockets.get(target.id), { type: 'blessed', by: p.id, until: r.blessedUntil });
        }
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
      case 'wardrobe_glamour': {
        const r = rpg.wardrobeGlamour(p, { slot: String(m.slot || ''), itemId: m.itemId == null ? null : String(m.itemId) });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'charm_equip': {
        const r = rpg.charmEquip(p, {
          charmId: m.charmId == null ? null : String(m.charmId),
          charmUid: m.charmUid == null ? null : String(m.charmUid),
        });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'charm_consume': {
        const r = rpg.charmConsume(p, {
          baseUid: m.baseUid == null ? null : String(m.baseUid),
          materialUid: m.materialUid == null ? null : String(m.materialUid),
          mode: m.mode == null ? 'upgrade' : String(m.mode),
        });
        reply(ws, p, m.type, m, r, { changed: !!r.ok });
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'charm_salvage': {
        const r = rpg.charmSalvage(p, {
          charmUid: m.charmUid == null ? null : String(m.charmUid),
        });
        return reply(ws, p, m.type, m, r, { changed: !!r.ok });
      }
      case 'charm_lock': {
        const r = rpg.charmLock(p, {
          charmUid: m.charmUid == null ? null : String(m.charmUid),
        });
        return reply(ws, p, m.type, m, r, { changed: !!r.ok });
      }
      case 'dash_preset_save': {
        const r = rpg.dashPresetSave(p, { slotIdx: m.slotIdx, name: m.name });
        return reply(ws, p, m.type, m, r);
      }
      case 'dash_preset_equip': {
        const r = rpg.dashPresetEquip(p, { slotIdx: m.slotIdx });
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
        if (r.ok && Array.isArray(r.items)) {
          for (const it of r.items) {
            if (it.rarity === 3) {
              const name = it.name || OUTFITS[it.id]?.name || ACCESSORIES[it.id]?.name || getPetDef(it.id)?.name || it.id;
              dailyService.emitCheer({ winnerId: p.id, winnerName: p.username, achievement: `pulled ${name} ✨ Mythic` });
            }
          }
        }
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
          dailyService.emitCheer({ winnerId: p.id, winnerName: p.username, achievement: `forged ${r.itemId} to +10 Sovereign` });
        }
        if (r.ok && r.success) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'gear_attune': {
        const r = rpg.gearAttune(p, { itemId: String(m.itemId || ''), stat: String(m.stat || ''), useScroll: !!m.useScroll });
        reply(ws, p, m.type, m, r);
        if (r.ok) broadcast(ws.instanceId, { type: 'player_equipped', id: p.id, equipped: p.equipped, appearance: p.appearance, lineage: p.lineage, cp: p.cp }, p.id);
        return null;
      }
      case 'pet_feed':
        return reply(ws, p, m.type, m, rpg.petFeed(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId), feedBond: Boolean(m.feedBond) }));
      case 'pet_reroll_trait':
        return reply(ws, p, m.type, m, rpg.petRerollTrait(p, { petUid: m.petUid == null ? undefined : String(m.petUid), petId: m.petId == null ? undefined : String(m.petId), slotIdx: m.slotIdx }, rng));
      case 'pet_breed_couple': {
        const partner = db.getProfile(String(m.partnerId || p.partner_id || ''));
        const r = rpg.petBreedCouple(p, partner, { myPetUid: String(m.myPetUid), partnerPetUid: m.partnerPetUid == null ? null : String(m.partnerPetUid) }, rng);
        if (r.ok) dailyService.bumpCoupleStat(p, { coopActivities: 1 });
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
      case 'pet_set_poses': {
        const r = rpg.petSetPoses(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
          poses: Array.isArray(m.poses) ? m.poses : undefined,
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
      case 'pet_interact': {
        const r = rpg.petInteract(p, {
          petUid: m.petUid == null ? undefined : String(m.petUid),
          petId: m.petId == null ? undefined : String(m.petId),
        }, now);
        if (r.ok) dailyService.bumpQuest(p, 'pet');
        return reply(ws, p, m.type, m, r);
      }
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
            dailyService.emitCheer({ winnerId: p.id, winnerName: p.username, achievement: `pulled ${cel.name} ✨ Celestial Hair` });
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
      // --- Phase 5: Hall of Fame, Cheer, Owl Gifts, VIP, Passport, Founder, Social & Couple ---
      case 'hall_list':
        return reply(ws, p, m.type, m, dailyService.hallList(p));
      case 'hall_worship':
        return reply(ws, p, m.type, m, dailyService.hallWorship(p));
      case 'cheer_claim':
        return reply(ws, p, m.type, m, dailyService.cheerClaim(p, m));
      case 'owl_send_gift':
        return reply(ws, p, m.type, m, dailyService.owlSendGift(p, m));
      case 'owl_claim_mail':
        return reply(ws, p, m.type, m, dailyService.owlClaimMail(p, m));
      case 'vip_card_buy':
        return reply(ws, p, m.type, m, dailyService.vipCardBuy(p, m));
      case 'vip_card_use':
        return reply(ws, p, m.type, m, dailyService.vipCardUse(p, m));
      case 'bag_item_use':
        return reply(ws, p, m.type, m, dailyService.bagItemUse(p, m));
      case 'passport_state':
        return reply(ws, p, m.type, m, dailyService.passportState(p));
      case 'passport_claim':
        return reply(ws, p, m.type, m, dailyService.passportClaim(p, m));
      case 'founder_claim':
        return reply(ws, p, m.type, m, dailyService.founderClaim(p, m));
      case 'social_directory':
        return send(ws, { type: 'action_result', action: m.type, reqId: m.reqId ?? null, serverNow: Date.now(), ...dailyService.socialDirectory(p) });
      case 'friend_request_send':
        return reply(ws, p, m.type, m, dailyService.friendRequestSend(p, m));
      case 'friend_request_accept':
        return reply(ws, p, m.type, m, dailyService.friendRequestAccept(p, m));
      case 'friend_request_decline':
        return reply(ws, p, m.type, m, dailyService.friendRequestDecline(p, m));
      case 'friend_remove':
        return reply(ws, p, m.type, m, dailyService.friendRemove(p, m));
      case 'couple_propose':
        return reply(ws, p, m.type, m, dailyService.couplePropose(p, m));
      case 'couple_accept':
        return reply(ws, p, m.type, m, dailyService.coupleAccept(p, m));
      case 'couple_decline':
        return reply(ws, p, m.type, m, dailyService.coupleDecline(p, m));
      case 'couple_break':
        return reply(ws, p, m.type, m, dailyService.coupleBreak(p, m));
      case 'couple_moment':
        return reply(ws, p, m.type, m, dailyService.coupleMoment(p, m));
      default: return null;
    }
  }

  /** Finger Pick-Up & Drop: the player lifts their own Chibi or Pet and drops it anywhere walkable. */
  function onPickupDrop(ws, m) {
    if (ws.instanceId === TOWNHALL.ID) return;
    const p = db.getProfile(ws.userId);
    const now = Date.now();
    const isPetDrop = m.targetId === 'pet';
    if ((m.targetId !== ws.userId && !isPetDrop) || !finite(m.x) || !finite(m.z)) return;
    const L = layoutFor(ws.instanceId);
    if (now - (ws.lastDrop || 0) < NET.DROP_COOLDOWN_MS) {
      const s = presence.get(ws.userId);
      const canFly = !!p?.equipped?.wings?.id;
      if (s && !isWalkablePos(L, s.x, s.z, { canFly })) {
        const safe = nearestWalkablePos(L, s.x, s.z, { canFly });
        s.x = safe.x; s.z = safe.z;
      }
      return send(ws, { type: 'drop_result', ok: false, error: 'slow_down', x: s.x, z: s.z });
    }
    ws.lastDrop = now;
    let { x, z } = clampToArea(L, m.x, m.z);
    let prop = null, buff = { buff: null };
    if (typeof m.propId === 'string') {
      const hit = findPlaced(L, m.propId, x, z);
      if (hit && hit.d <= 2.4) {
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
      const canFly = !!p.equipped?.wings?.id;
      if (!isWalkablePos(L, x, z, { canFly })) {
        ({ x, z } = nearestWalkablePos(L, x, z, { canFly }));
      }
      const s = presence.get(ws.userId);
      Object.assign(s, { x, z, vx: 0, vz: 0, t: now });
    }
    if (buff.buff) db.markProfile(p.id);
    send(ws, { type: 'drop_result', ok: true, targetId: isPetDrop ? 'pet' : ws.userId, x, z, prop, ...buff });
    broadcast(ws.instanceId, { type: 'player_dropped', id: ws.userId, targetId: isPetDrop ? 'pet' : ws.userId, x, z, prop }, ws.userId);
  }

  // --- Dock fishing: loot rolled at cast, revealed after the reel minigame -----------
  function onFishing(ws, m) {
    if (ws.instanceId === TOWNHALL.ID && m.type === 'fishing_cast') return;
    const p = db.getProfile(ws.userId);
    if (!p) return;
    const now = Date.now();
    if (m.type === 'fishing_set_target') {
      const res = eco.setFishTarget(p, m.itemId || null);
      if (!res.ok) return send(ws, { type: 'fishing_error', error: res.error });
      db.markProfile(p.id);
      pushProfile(p);
      return send(ws, { type: 'fishing_target_ok', targetItem: res.targetItem });
    }
    if (m.type === 'fishing_exchange') {
      const res = eco.redeemAnglerExchange(p, m.offerId, rng, now);
      if (!res.ok) return send(ws, { type: 'fishing_error', error: res.error, missing: res.missing });
      db.markProfile(p.id);
      pushProfile(p);
      return send(ws, { type: 'fishing_exchange_ok', ...res });
    }
    const L = layoutFor(ws.instanceId);
    const s = presence.get(ws.userId);
    if (m.type === 'fishing_cast') {
      const dock = dockNear(L, s.x, s.z, FISHING.DOCK_REACH);
      if (!dock) return send(ws, { type: 'fishing_error', error: 'not_at_dock' });
      if (ws.cast && now < ws.cast.biteAt + FISHING.REEL_MS) return send(ws, { type: 'fishing_error', error: 'already_casting' });
      const bait = !!m.bait;
      if (bait && p.berries < FISHING.BAIT_COST_BERRIES) return send(ws, { type: 'fishing_error', error: 'not_enough_berries' });
      if (bait) { p.berries -= FISHING.BAIT_COST_BERRIES; db.markProfile(p.id); pushProfile(p); }
      // co-op: partner / friend standing on the same dock OR active 1-on-1 voice call
      const dockCoop = [...(instances.get(ws.instanceId) || [])].some((id) => {
        if (id === ws.userId) return false;
        const o = presence.get(id);
        return o && Math.hypot(o.x - s.x, o.z - s.z) <= FISHING.COOP_RADIUS && dockNear(L, o.x, o.z, FISHING.DOCK_REACH);
      });
      const callCoop = !!(voiceService?.activeCalls?.has?.(ws.userId) || voiceService?.inCall?.(ws.userId));
      const coop = dockCoop || callCoop;
      let loot = eco.rollCatch({ bait, coop }, rng);
      if (bait) {
        p.fish_bait_pity = (p.fish_bait_pity | 0) + 1;
        if (loot === 'chest') {
          p.fish_bait_pity = 0;
        } else if (p.fish_bait_pity >= (FISHING.BAIT_CHEST_PITY || 10)) {
          loot = 'chest';
          p.fish_bait_pity = 0;
        }
        db.markProfile(p.id);
      }
      const biteMs = FISHING.BITE_MIN_MS + Math.floor(rng() * (FISHING.BITE_MAX_MS - FISHING.BITE_MIN_MS));
      ws.cast = { id: crypto.randomBytes(6).toString('hex'), loot, bait, coop, biteAt: now + biteMs };
      return send(ws, {
        type: 'fishing_cast_ok',
        castId: ws.cast.id,
        biteMs,
        bait,
        coop,
        fishKeyHint: loot,
        baitPity: p.fish_bait_pity | 0,
        table: eco.lootTable({ bait, coop }),
      });
    }
    // fishing_reel_complete
    const c = ws.cast;
    if (!c || m.castId !== c.id) return send(ws, { type: 'fishing_error', error: 'no_cast' });
    const minEnd = c.biteAt + FISHING.REEL_MS * 0.9 - 150;              // can't reel faster than the gauge allows
    if (now < minEnd) return send(ws, { type: 'fishing_error', error: 'too_fast' });
    ws.cast = null;
    if (now > c.biteAt + FISHING.CAST_TIMEOUT_MS || !m.success) {
      return send(ws, { type: 'fishing_result', ok: false, escaped: true, key: c.loot, baitPity: p.fish_bait_pity | 0 });
    }
    const out = eco.awardCatch(p, c.loot, rng, { perfectHook: !!m.perfectHook });
    if (c.coop && isCouple(p)) {
      dailyService.bumpCoupleStat(p, { coopActivities: 1 });
    }
    db.markProfile(p.id);
    pushProfile(p);
    send(ws, { type: 'fishing_result', ok: true, coop: c.coop, bait: c.bait, baitPity: p.fish_bait_pity | 0, ...out });
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
            if (p) {
              ensurePhase5(p);
              dailyService.onDailyLogin(p);
            }
            const isTownHall = ws.instanceId === TOWNHALL.ID;
            const isMuseum = ws.instanceId === MUSEUM_ID || String(ws.instanceId || '').startsWith('nook_museum:');
            const portalId = isMuseum && String(ws.instanceId || '').startsWith('nook_museum:')
              ? String(ws.instanceId).split(':')[1]
              : null;
            const L = (isTownHall || isMuseum) ? null : layoutFor(ws.instanceId);
            send(ws, {
              type: 'resume_ok',
              profile: publicProfile(p, { self: true }),
              self: presence.get(ws.userId),
              zoneSeq: ws.zoneSeq || 1,
              layout: isTownHall
                ? { kind: 'townhall', size: 36 }
                : isMuseum
                  ? { kind: 'museum', size: 36, portalId }
                  : layoutWire(L),
              serverNow: now,
            });
            send(ws, snapshotFor(ws));
            tables.connect(ws.userId);
            voiceService.onReconnect(ws.userId);
            break;
          }
          case 'instance_switch':
            switchInstance(ws, m.to, { force: !!m.force, spawn: m.spawn || null });
            break;
          case 'museum_invite_partner': {
            const p = db.getProfile(ws.userId);
            if (p && isCouple(p) && p.partner_id) {
              const partnerWs = sockets.get(p.partner_id);
              const portalId = m.portalId ? String(m.portalId).trim().toLowerCase() : (String(ws.instanceId || '').startsWith('nook_museum:') ? String(ws.instanceId).split(':')[1] : null);
              if (partnerWs) {
                send(partnerWs, {
                  type: 'museum_partner_invite',
                  fromId: p.id,
                  fromName: p.username,
                  instanceId: portalId ? `${MUSEUM_ID}:${portalId}` : MUSEUM_ID,
                  portalId: portalId || null,
                });
                send(ws, { type: 'museum_invite_sent', ok: true, to: p.partner_id, portalId: portalId || null });
              } else {
                send(ws, { type: 'museum_invite_sent', ok: false, error: 'partner_offline' });
              }
            }
            break;
          }
          case 'call_invite':
          case 'call_accept':
          case 'call_decline':
          case 'call_hangup':
          case 'call_heal':
          case 'call_signal':
            voiceService.handle(ws.userId, m);
            break;
          case 'chibi_pickup_drop': onPickupDrop(ws, m); break;
          case 'fishing_cast':
          case 'fishing_reel_complete':
          case 'fishing_set_target':
          case 'fishing_exchange': onFishing(ws, m); break;
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
    clearInterval(voiceTicker);
    townHallBots.close();
    tables.close();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
    await db.close();
  }
  return { port: actualPort, close, db, app, tables, townHallBots };
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
