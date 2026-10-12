const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Telemetry log store ("mini Sentry"): every event is appended as one JSON line
// to logs/telemetry-YYYY-MM-DD.jsonl and kept in memory for the /debug dashboard.
// ---------------------------------------------------------------------------
const LOG_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const RECENT_LIMIT = 8000;
const recentEvents = [];

function writeLog(entry) {
  const file = path.join(LOG_DIR, `telemetry-${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFile(file, JSON.stringify(entry) + '\n', () => {});
  recentEvents.push(entry);
  if (recentEvents.length > RECENT_LIMIT) recentEvents.splice(0, recentEvents.length - RECENT_LIMIT);
}

// Timestamp every server console line and persist it alongside client telemetry
const rawLog = console.log.bind(console);
const rawError = console.error.bind(console);
console.log = (...args) => {
  const ts = new Date().toISOString();
  rawLog(`[${ts}]`, ...args);
  writeLog({ t: Date.now(), ts, src: 'server', kind: 'server_log', data: { msg: args.join(' ') } });
};
console.error = (...args) => {
  const ts = new Date().toISOString();
  rawError(`[${ts}]`, ...args);
  writeLog({ t: Date.now(), ts, src: 'server', kind: 'server_error', data: { msg: args.map(String).join(' ') } });
};

function serverEvent(kind, terminal, data) {
  writeLog({ t: Date.now(), ts: new Date().toISOString(), src: 'server', kind, terminal, data: data || {} });
}

// ---------------------------------------------------------------------------
// Sky Monopoly: Server-Side Game State Persistence
// Keeps games persistent across disconnects, WiFi blips, and browser refreshes
// without requiring a heavy database.
// ---------------------------------------------------------------------------
const MonopolyCards = require('./public/monopoly_cards.js');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const MONOPOLY_STATE_FILE = path.join(DATA_DIR, 'monopoly_state.json');
const MONOPOLY_PLAYED_CARDS_FILE = path.join(DATA_DIR, 'monopoly_played_cards.json');

let serverMonopolyState = null;
try {
  if (fs.existsSync(MONOPOLY_STATE_FILE)) {
    const raw = fs.readFileSync(MONOPOLY_STATE_FILE, 'utf8');
    serverMonopolyState = JSON.parse(raw);
    if (serverMonopolyState) serverMonopolyState.isRolling = false;
    console.log('[Monopoly] Restored active game state from disk.');
  }
} catch (e) {
  console.error('[Monopoly] Failed to load saved state:', e.message);
}

let serverPlayedCardIds = [];
try {
  if (fs.existsSync(MONOPOLY_PLAYED_CARDS_FILE)) {
    const raw = fs.readFileSync(MONOPOLY_PLAYED_CARDS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      serverPlayedCardIds = parsed.map(Number).filter(MonopolyCards.isValidCardId);
    }
  } else if (serverMonopolyState && Array.isArray(serverMonopolyState.playedCardIds)) {
    serverPlayedCardIds = serverMonopolyState.playedCardIds.map(Number).filter(MonopolyCards.isValidCardId);
  }
  console.log(`[Monopoly] Restored ${serverPlayedCardIds.length} valid played cards from disk.`);
} catch (e) {
  console.error('[Monopoly] Failed to load played cards history:', e.message);
}

let serverCardDeck = [];

function persistMonopolyState(state) {
  if (!state) return;
  try {
    const cleanState = { ...state, isRolling: false };
    fs.writeFile(MONOPOLY_STATE_FILE, JSON.stringify(cleanState, null, 2), () => {});
  } catch (e) {}
}

function persistPlayedCards(ids) {
  if (!Array.isArray(ids)) return;
  try {
    serverPlayedCardIds = [...new Set(ids.map(Number).filter(MonopolyCards.isValidCardId))];
    fs.writeFile(MONOPOLY_PLAYED_CARDS_FILE, JSON.stringify(serverPlayedCardIds, null, 2), () => {});
  } catch (e) {}
}

function ensureServerCardDeck() {
  serverPlayedCardIds = serverPlayedCardIds.filter(MonopolyCards.isValidCardId);
  const { deck, didReset } = MonopolyCards.createShuffledDeck(serverPlayedCardIds);
  if (didReset) {
    console.log('[Monopoly] All 100 cards have been played! Resetting discard history.');
    serverPlayedCardIds = [];
    persistPlayedCards([]);
  }
  serverCardDeck = deck;
  if (serverMonopolyState) {
    serverMonopolyState.cardDeck = [...serverCardDeck];
    serverMonopolyState.playedCardIds = [...serverPlayedCardIds];
    persistMonopolyState(serverMonopolyState);
  }
  console.log(`[Monopoly] Authoritative server deck ready: ${serverCardDeck.length} unplayed cards remaining.`);
  return serverCardDeck;
}

// Initialize server card deck on startup with full unplayed pool
const playedSet = new Set(serverPlayedCardIds);
const totalUnplayed = MonopolyCards.VALID_CARD_IDS.filter((id) => !playedSet.has(id));
if (serverMonopolyState && Array.isArray(serverMonopolyState.cardDeck) && serverMonopolyState.cardDeck.length >= totalUnplayed.length) {
  serverCardDeck = serverMonopolyState.cardDeck.map(Number).filter((id) => MonopolyCards.isValidCardId(id) && !playedSet.has(id));
  console.log(`[Monopoly] Restored active deck from state: ${serverCardDeck.length} unplayed cards remaining.`);
} else {
  ensureServerCardDeck();
}


// ---------------------------------------------------------------------------
// 💎 Vault: per-person global profiles (diamonds, costumes, gacha pity)
// Identity = terminal link (/bkk or /dxb). Server is the single source of truth
// and rolls every gacha pull so results can't be refreshed or desynced.
// ---------------------------------------------------------------------------
let Costumes = require('./public/costumes.js');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
let ECON = Costumes.ECONOMY;

function makeProfile() {
  return {
    diamonds: ECON.WELCOME_GIFT,
    stardust: 0,
    tickets: 0,           // 🎟️ Lucky Flight Tickets (VIP gacha pulls)
    fish: 0,              // 🐟 King Salmon / cat treats
    owned: {},            // costumeId -> copies
    equipped: null,       // last equipped costume/character id (classic or season)
    pity: { epic: 0, mythic: 0 },
    stats: { wins: 0, losses: 0, pulls: 0, earned: 0, gifted: 0, received: 0 },
    botStats: { played: 0, wins: 0, hardStreak: 0, hardLossStreak: 0, net: 0 },
    lastDaily: '',
    envelopes: [],        // received red envelopes
    envelopesSent: []     // sent red envelopes
  };
}

let vault = { bkk: makeProfile(), dxb: makeProfile(), awardedGames: [] };
try {
  if (fs.existsSync(PROFILES_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    ['bkk', 'dxb'].forEach((r) => {
      vault[r] = { ...makeProfile(), ...(parsed[r] || {}) };
      if (!Array.isArray(vault[r].envelopes)) vault[r].envelopes = [];
      if (!Array.isArray(vault[r].envelopesSent)) vault[r].envelopesSent = [];
    });
    vault.awardedGames = Array.isArray(parsed.awardedGames) ? parsed.awardedGames : [];
    if (parsed.couple && typeof parsed.couple === 'object') vault.couple = parsed.couple;
    if (parsed.cats && typeof parsed.cats === 'object') vault.cats = parsed.cats;
    console.log(`[Vault] Restored profiles. BKK ${vault.bkk.diamonds}💎 · DXB ${vault.dxb.diamonds}💎`);
  } else {
    console.log('[Vault] Created fresh profiles with welcome gift.');
  }
} catch (e) {
  console.error('[Vault] Failed to load profiles:', e.message);
}

function persistVault() {
  try {
    const tmp = PROFILES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(vault, null, 2));
    fs.renameSync(tmp, PROFILES_FILE);
  } catch (e) {
    console.error('[Vault] Failed to save profiles:', e.message);
  }
}
persistVault();

const BANNER_SCHEDULES_FILE = path.join(DATA_DIR, 'banner_schedules.json');
let bannerSchedules = {};
function loadBannerSchedules() {
  try {
    if (fs.existsSync(BANNER_SCHEDULES_FILE)) {
      bannerSchedules = JSON.parse(fs.readFileSync(BANNER_SCHEDULES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Vault] Failed to load banner schedules:', e.message);
  }
  const now = Date.now();
  let changed = false;
  if (!bannerSchedules.s1 || !bannerSchedules.s1.endsAt) {
    bannerSchedules.s1 = {
      id: 's1',
      name: 'Bangkok After Dark',
      startsAt: now - 14 * 86400 * 1000,
      endsAt: now - 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s2 || !bannerSchedules.s2.endsAt) {
    bannerSchedules.s2 = {
      id: 's2',
      name: 'Tokyo Sakura Reverie',
      startsAt: now,
      endsAt: now + 10 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s3 || !bannerSchedules.s3.endsAt) {
    bannerSchedules.s3 = {
      id: 's3',
      name: 'Dubai Desert Mirage',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s4 || !bannerSchedules.s4.endsAt) {
    bannerSchedules.s4 = {
      id: 's4',
      name: 'Monte Carlo Casino Royale',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s5 || !bannerSchedules.s5.endsAt) {
    bannerSchedules.s5 = {
      id: 's5',
      name: 'Atlantis: Bioluminescent Abyss',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s6 || !bannerSchedules.s6.endsAt) {
    bannerSchedules.s6 = {
      id: 's6',
      name: 'Starlight Odyssey: Celestial Gala',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s7 || !bannerSchedules.s7.endsAt) {
    bannerSchedules.s7 = {
      id: 's7',
      name: 'Enchanted Fairytales & Royal Crowns',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (!bannerSchedules.s8 || !bannerSchedules.s8.endsAt) {
    bannerSchedules.s8 = {
      id: 's8',
      name: 'Nordic Aurora & Glacial Royalty',
      startsAt: now,
      endsAt: now + 14 * 86400 * 1000
    };
    changed = true;
  }
  if (changed) persistBannerSchedules();
}
function persistBannerSchedules() {
  try {
    fs.writeFileSync(BANNER_SCHEDULES_FILE, JSON.stringify(bannerSchedules, null, 2));
  } catch (e) {
    console.error('[Vault] Failed to save banner schedules:', e.message);
  }
}
loadBannerSchedules();

function publicProfiles() {
  return { bkk: vault.bkk, dxb: vault.dxb, couple: vault.couple || null, cats: vault.cats || null, banners: bannerSchedules };
}

// 🔥 Daily Flight Log: call-time rewards, couple streak, daily quests (see server_daily.js)
const createDaily = require('./server_daily.js');
const daily = createDaily({
  vault,
  persistVault,
  sendToRole: (role, msg) => sendTo(role === 'bkk' ? bkkSocket : dxbSocket, msg),
  broadcastVault: (extra) => broadcastVault(extra),
  features: () => ({ cats: !!vault.cats, couple: !!(vault.couple && vault.couple.active && bkkSocket && dxbSocket) })
});

// 🐾 Purrst Class Lounge: shared cats, Kitty Capsule, 🐟 fish (see server_cats.js)
const createCats = require('./server_cats.js');
const cats = createCats({
  vault,
  persistVault,
  sendToRole: (role, msg) => sendTo(role === 'bkk' ? bkkSocket : dxbSocket, msg),
  broadcastVault: (extra) => broadcastVault(extra),
  publicProfiles: () => publicProfiles(),
  daily,
  features: () => ({ couple: !!(vault.couple && vault.couple.active && bkkSocket && dxbSocket) })
});

// 🤖 Sky Monopoly Solo Bot: server authority for Captain Whiskers matches (see server_monobot.js)
const createMonoBot = require('./server_monobot.js');
const monoBot = createMonoBot({
  vault,
  persistVault,
  sendToRole: (role, msg) => sendTo(role === 'bkk' ? bkkSocket : dxbSocket, msg),
  broadcastVault: (extra) => broadcastVault(extra),
  publicProfiles: () => publicProfiles(),
  daily
});

function rollRarity(p) {
  p.pity.epic += 1;
  p.pity.mythic += 1;
  let mythicChance = ECON.RATES.mythic;
  if (p.pity.mythic > ECON.MYTHIC_SOFT_PITY) mythicChance += (p.pity.mythic - ECON.MYTHIC_SOFT_PITY) * ECON.MYTHIC_SOFT_STEP;
  if (p.pity.mythic >= ECON.MYTHIC_HARD_PITY || Math.random() < mythicChance) {
    p.pity.mythic = 0;
    p.pity.epic = 0;
    return 'mythic';
  }
  if (p.pity.epic >= ECON.EPIC_PITY || Math.random() < ECON.RATES.epic / (1 - ECON.RATES.mythic)) {
    p.pity.epic = 0;
    return 'epic';
  }
  return 'rare';
}

function vaultPull(role, count, season = 's1', useTicket = false) {
  loadBannerSchedules();
  const sched = bannerSchedules[season];
  if (sched && sched.endsAt && Date.now() > sched.endsAt) {
    return { error: `Season ${sched.name || season} banner has ended!` };
  }
  const p = vault[role];
  if (useTicket) {
    if ((p.tickets || 0) < 1) return { error: 'No Lucky Flight Tickets remaining' };
    p.tickets -= 1;
    count = 1;
  } else {
    const cost = count === 10 ? ECON.PULL_10 : ECON.PULL_1;
    if (p.diamonds < cost) return { error: 'Not enough diamonds' };
    p.diamonds -= cost;
  }
  let pool = Costumes.poolFor(role, season);
  if (!pool || pool.length === 0) {
    try {
      delete require.cache[require.resolve('./public/costumes.js')];
      Costumes = require('./public/costumes.js');
      ECON = Costumes.ECONOMY;
      pool = Costumes.poolFor(role, season);
    } catch (_) {}
  }
  if (!pool || pool.length === 0) return { error: 'Invalid season pool' };
  const results = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(p);
    const options = pool.filter((c) => c.rarity === rarity);
    const pick = options[Math.floor(Math.random() * options.length)];
    const dupe = (p.owned[pick.id] || 0) > 0;
    p.owned[pick.id] = (p.owned[pick.id] || 0) + 1;
    let dust = 0;
    if (dupe) {
      dust = Costumes.RARITY[rarity].dust;
      p.stardust += dust;
    }
    results.push({ id: pick.id, rarity, dupe, dust });
  }
  p.stats.pulls += count;
  persistVault();
  return { results };
}

function vaultExchange(role, costumeId) {
  loadBannerSchedules();
  const p = vault[role];
  let c = Costumes.BY_ID[costumeId];
  if (!c) {
    try {
      delete require.cache[require.resolve('./public/costumes.js')];
      Costumes = require('./public/costumes.js');
      ECON = Costumes.ECONOMY;
      c = Costumes.BY_ID[costumeId];
    } catch (_) {}
  }
  if (!c || c.role !== role) return { error: 'Unknown costume' };
  const sched = bannerSchedules[c.season];
  if (sched && sched.endsAt && Date.now() > sched.endsAt) {
    return { error: `Season ${sched.name || c.season} exchange has ended!` };
  }
  if ((p.owned[c.id] || 0) > 0) return { error: 'Already owned' };
  const price = Costumes.RARITY[c.rarity].shop;
  if (p.stardust < price) return { error: 'Not enough stardust' };
  p.stardust -= price;
  p.owned[c.id] = 1;
  persistVault();
  return { results: [{ id: c.id, rarity: c.rarity, dupe: false, dust: 0, exchanged: true }] };
}

function vaultEquip(role, costumeId) {
  const c = Costumes.BY_ID[costumeId];
  if (c && (c.role !== role || !(vault[role].owned[c.id] > 0))) return { error: 'Not owned' };
  const next = String(costumeId || '').slice(0, 64) || null;
  const changed = vault[role].equipped !== next;
  vault[role].equipped = next;
  persistVault();
  return { ok: true, changed };
}

function vaultAward(gameKey, winner, matches, partyData) {
  if (!gameKey) return null;
  if (vault.awardedGames.includes(gameKey)) return null;
  vault.awardedGames.push(gameKey);
  if (vault.awardedGames.length > 100) vault.awardedGames.splice(0, vault.awardedGames.length - 100);

  const today = new Date().toISOString().slice(0, 10);
  const dailyTracker = {};
  ['bkk', 'dxb'].forEach((r) => {
    if (vault[r].lastDaily !== today) {
      dailyTracker[r] = true;
      vault[r].lastDaily = today;
    }
  });

  let payouts;
  if (partyData && (partyData.mode === '4p' || Array.isArray(partyData.placements))) {
    const tierKey = Costumes.getPartyThreatTier(partyData.players || partyData.botConfig || []);
    payouts = Costumes.computePartyPayouts(
      tierKey,
      partyData.placements || [winner, otherRole(winner)],
      matches,
      partyData.bounties || {},
      dailyTracker
    );
  } else {
    // 2P Couple Duel
    const placements = winner === 'bkk' ? ['bkk', 'dxb'] : winner === 'dxb' ? ['dxb', 'bkk'] : ['bkk', 'dxb'];
    payouts = Costumes.computePartyPayouts(
      'couple',
      placements,
      matches,
      (partyData && partyData.bounties) || {},
      dailyTracker
    );
  }

  // Update Vault accounts authoritatively
  ['bkk', 'dxb'].forEach((r) => {
    const pay = payouts[r];
    if (!pay) return;
    const p = vault[r];
    p.diamonds = (p.diamonds || 0) + pay.total;
    p.stats.earned = (p.stats.earned || 0) + pay.total;
    if (pay.won) p.stats.wins = (p.stats.wins || 0) + 1;
    else p.stats.losses = (p.stats.losses || 0) + 1;

    if (pay.tickets) p.tickets = (p.tickets || 0) + pay.tickets;
    if (pay.fish) p.fish = (p.fish || 0) + pay.fish;
    if (pay.stardust) p.stardust = (p.stardust || 0) + pay.stardust;
  });

  persistVault();
  console.log(`[Vault] Game ${gameKey} paid out:`, JSON.stringify(payouts));
  return payouts;
}

function vaultSendEnvelope(senderRole, amount, messageText, blessingKey) {
  const amt = Math.floor(Number(amount));
  if (!amt || isNaN(amt) || amt < 1) return { error: 'Please enter at least 1 diamond' };
  const sender = vault[senderRole];
  if (!sender) return { error: 'Invalid sender' };
  if (sender.diamonds < amt) return { error: `Not enough diamonds (you have ${sender.diamonds}💎)` };

  const receiverRole = senderRole === 'bkk' ? 'dxb' : 'bkk';
  const receiver = vault[receiverRole];
  if (!receiver) return { error: 'Invalid recipient' };

  const cleanMsg = String(messageText || '').trim().slice(0, 100);
  const cleanBlessing = String(blessingKey || 'luck').slice(0, 32);

  // Transfer diamonds
  sender.diamonds -= amt;
  receiver.diamonds += amt;

  sender.stats = sender.stats || {};
  sender.stats.gifted = (sender.stats.gifted || 0) + amt;

  receiver.stats = receiver.stats || {};
  receiver.stats.received = (receiver.stats.received || 0) + amt;

  const env = {
    id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: senderRole,
    to: receiverRole,
    amount: amt,
    message: cleanMsg,
    blessing: cleanBlessing,
    timestamp: new Date().toISOString(),
    claimed: false
  };

  if (!Array.isArray(receiver.envelopes)) receiver.envelopes = [];
  receiver.envelopes.unshift(env);
  if (receiver.envelopes.length > 50) receiver.envelopes.length = 50;

  if (!Array.isArray(sender.envelopesSent)) sender.envelopesSent = [];
  sender.envelopesSent.unshift(env);
  if (sender.envelopesSent.length > 50) sender.envelopesSent.length = 50;

  persistVault();
  return { ok: true, envelope: env };
}

function vaultClaimEnvelope(role, envId) {
  const p = vault[role];
  if (!p || !Array.isArray(p.envelopes)) return { ok: false };
  const env = p.envelopes.find((e) => e.id === envId);
  if (env) {
    env.claimed = true;
    persistVault();
    return { ok: true, env };
  }
  return { ok: false };
}

function sendTo(sock, msg) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    try { sock.send(JSON.stringify(msg)); } catch (e) {}
  }
}
function broadcastVault(extra = {}) {
  const msg = { type: 'vault_profiles', profiles: publicProfiles(), ...extra };
  sendTo(bkkSocket, msg);
  sendTo(dxbSocket, msg);
}

function handleVaultMessage(ws, message) {
  const role = ws.terminal;
  if (role !== 'bkk' && role !== 'dxb') return;
  const partner = role === 'bkk' ? dxbSocket : bkkSocket;
  if (message.type.startsWith('vault_cat_')) {
    cats.handle(ws, role, message, sendTo);
    return;
  }
  if (message.type.startsWith('vault_bot_')) {
    monoBot.handle(ws, role, message, sendTo);
    return;
  }
  switch (message.type) {
    case 'vault_hello':
      daily.checkIn(role);
      monoBot.checkSessionExpiry(role);
      sendTo(ws, { type: 'vault_profiles', profiles: publicProfiles() });
      break;
    case 'vault_pull': {
      const useTicket = !!message.useTicket;
      const count = useTicket ? 1 : (message.count === 10 ? 10 : 1);
      const season = String(message.season || 's3').slice(0, 16);
      const out = vaultPull(role, count, season, useTicket);
      if (out.error) { sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId }); break; }
      sendTo(ws, { type: 'vault_pull_result', role, results: out.results, reqId: message.reqId, profiles: publicProfiles(), season, usedTicket: useTicket });
      const best = out.results.reduce((a, b) => (Costumes.RARITY[b.rarity].rank > Costumes.RARITY[a.rarity].rank ? b : a));
      sendTo(partner, { type: 'vault_event', kind: 'pull', role, count, best, profiles: publicProfiles(), season });
      console.log(`[Vault] ${role.toUpperCase()} pulled x${count} (${season})${useTicket ? ' [🎟️ TICKET]' : ''}: ${out.results.map((r) => r.rarity[0].toUpperCase()).join('')}`);
      daily.track(role, 'pull', 1);
      break;
    }
    case 'vault_exchange': {
      const out = vaultExchange(role, message.costumeId);
      if (out.error) { sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId }); break; }
      sendTo(ws, { type: 'vault_pull_result', role, results: out.results, reqId: message.reqId, profiles: publicProfiles(), exchanged: true });
      sendTo(partner, { type: 'vault_profiles', profiles: publicProfiles() });
      break;
    }
    case 'vault_equip': {
      const out = vaultEquip(role, message.costumeId);
      if (out.error) { sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId }); break; }
      broadcastVault();
      if (out.changed && message.manual) daily.track(role, 'equip', 1);
      break;
    }
    case 'vault_award': {
      const payouts = vaultAward(
        String(message.gameKey || '').slice(0, 80),
        message.winner,
        message.matches,
        message.partyData
      );
      if (payouts) {
        broadcastVault({ award: { gameKey: message.gameKey, winner: message.winner, payouts } });
        daily.track('bkk', 'monopoly', 1);
        daily.track('dxb', 'monopoly', 1);
      }
      break;
    }
    case 'vault_send_envelope': {
      const out = vaultSendEnvelope(role, message.amount, message.message, message.blessing);
      if (out.error) {
        sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId });
        break;
      }
      sendTo(ws, {
        type: 'vault_envelope_sent',
        envelope: out.envelope,
        reqId: message.reqId,
        profiles: publicProfiles()
      });
      sendTo(partner, {
        type: 'vault_envelope_received',
        envelope: out.envelope,
        profiles: publicProfiles()
      });
      broadcastVault();
      console.log(`[Vault] 🧧 ${role.toUpperCase()} sent Red Envelope (${out.envelope.amount}💎) to ${role === 'bkk' ? 'DXB' : 'BKK'}: "${out.envelope.message}"`);
      daily.track(role, 'envelope', 1);
      break;
    }
    case 'vault_claim_envelope': {
      vaultClaimEnvelope(role, message.envelopeId);
      broadcastVault();
      break;
    }
    // 🔥 Daily Flight Log
    case 'vault_call_tick':
      daily.callTick(role);
      break;
    case 'vault_quest_claim': {
      const out = daily.claimQuest(role, String(message.questId || ''));
      if (out.error) sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId });
      break;
    }
    case 'vault_bonus_claim': {
      const out = daily.claimBonus(role);
      if (out.error) sendTo(ws, { type: 'vault_error', error: out.error, reqId: message.reqId });
      break;
    }
  }
}

// Serve static frontend files.
// Code (html/js/css/json): `no-cache` = always revalidate via ETag, so edits show up instantly
//   (cheap 304s instead of full re-downloads every time).
// Images/audio/fonts: cache for a day — costume sprites are 300–800 KB each and the Vault
//   re-renders often; `no-store` here made every costume re-download on every tap.
const LONG_CACHE_EXT = /\.(png|jpe?g|webp|gif|svg|ico|mp3|wav|ogg|m4a|woff2?|ttf)$/i;
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (LONG_CACHE_EXT.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    } else {
      res.set('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// Specific terminal routes
app.get('/bkk', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dxb', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Telemetry ingestion (text/plain so sendBeacon works without preflight) ---
app.post('/api/telemetry', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const events = Array.isArray(payload.events) ? payload.events : [];
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    const country = req.headers['cf-ipcountry'] || null;
    events.forEach((ev) => {
      writeLog({
        t: ev.t,
        ts: new Date(ev.t || Date.now()).toISOString(),
        recvTs: new Date().toISOString(),
        src: 'client',
        ip,
        country,
        terminal: ev.terminal,
        session: ev.session,
        callId: ev.callId,
        kind: ev.kind,
        data: ev.data
      });
    });
    res.status(204).end();
  } catch (err) {
    rawError('[Telemetry] Bad payload:', err.message);
    res.status(400).end();
  }
});

// Recent events for the dashboard: /api/telemetry?since=<ms>&limit=<n>&terminal=<bkk|dxb>
app.get('/api/telemetry', (req, res) => {
  const since = Number(req.query.since || 0);
  const limit = Math.min(Number(req.query.limit || 1500), RECENT_LIMIT);
  const terminal = req.query.terminal;
  let list = recentEvents.filter((e) => (e.t || 0) > since);
  if (terminal) list = list.filter((e) => e.terminal === terminal);
  res.set('Cache-Control', 'no-store');
  res.json(list.slice(-limit));
});

// Live debug dashboard
app.get('/debug', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Production Health Check & Telemetry Endpoint (Railway / Cloud Orchestrator)
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  const activeRoomsCount = (typeof roomRegistry !== 'undefined' && roomRegistry.rooms) ? roomRegistry.rooms.size : 0;
  const publicRoomsCount = (typeof roomRegistry !== 'undefined' && typeof roomRegistry.listPublicRooms === 'function') ? roomRegistry.listPublicRooms().length : 0;
  const activeSocketsCount = (typeof wss !== 'undefined' && wss.clients) ? wss.clients.size : 0;

  res.status(200).json({
    status: 'ok',
    service: 'sky-party-terminal',
    platform: 'railway',
    region: process.env.RAILWAY_REGION || 'singapore',
    uptimeSec: Math.floor(process.uptime()),
    activeRooms: activeRoomsCount,
    publicRooms: publicRoomsCount,
    activeSockets: activeSocketsCount,
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for all other routes
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket Signaling Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Store dedicated terminals (Bangkok and Dubai)
let bkkSocket = null;
let dxbSocket = null;
// Grace period timers for temporary mobile signal blips (15s)
let bkkDisconnectTimer = null;
let dxbDisconnectTimer = null;
const DISCONNECT_GRACE_MS = 15000;

// Meta (Facebook/Instagram/Messenger) link-preview crawlers. Real users browsing inside the
// Instagram app connect from their own ISP, so only Meta's own network + crawler UAs match.
const META_IPV4_CIDRS = [
  '31.13.24.0/21', '31.13.64.0/18', '45.64.40.0/22', '57.141.0.0/16', '57.144.0.0/14',
  '66.220.144.0/20', '69.63.176.0/20', '69.171.224.0/19', '74.119.76.0/22', '102.132.96.0/20',
  '103.4.96.0/22', '129.134.0.0/16', '147.75.208.0/20', '157.240.0.0/16', '163.70.128.0/17',
  '173.252.64.0/18', '179.60.192.0/22', '185.60.216.0/22', '185.89.216.0/22', '204.15.20.0/22'
];
const BOT_UA_RE = /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot/i;

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function inCidr(ip, cidr) {
  const [base, bits] = cidr.split('/');
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

function isLinkPreviewBot(req) {
  const ua = req.headers['user-agent'] || '';
  if (BOT_UA_RE.test(ua)) return true;
  let ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '').toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.startsWith('2a03:2880:')) return true; // Meta IPv6 (AS32934)
  return META_IPV4_CIDRS.some((c) => inCidr(ip, c));
}

// ---------------------------------------------------------------------------
// Sky Party: Flight Rooms & Departure Board Matchmaking
// ---------------------------------------------------------------------------
const RoomRegistry = require('./server_rooms.js');
const roomRegistry = new RoomRegistry();
const departureBoardSubscribers = new Set();

// Initialize RoomRegistry from persistent database/storage
roomRegistry.initFromDatabase().then(() => {
  console.log(`[RoomRegistry] Persistent room registry ready. Active rooms: ${roomRegistry.rooms.size}`);
}).catch((err) => {
  console.warn('[RoomRegistry] Database init warning:', err.message);
});

function sanitizeRoom(room) {
  if (!room) return null;
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    flightNumber: room.flightNumber,
    hostUid: room.hostUid,
    hostName: room.hostName,
    hostAvatar: room.hostAvatar,
    description: room.description || 'Relaxed game, make friends! All are welcome ♡',
    tags: room.tags || ['Casual', 'Make Friends', 'Voice Chat'],
    game: room.game || 'monopoly',
    autoFill: !!room.autoFill,
    messages: Array.isArray(room.messages) ? room.messages : [],
    isPublic: room.isPublic,
    status: room.status,
    slots: room.slots,
    activeHumans: room.slots.filter((s) => s.type === 'human' && s.occupiedBy).length,
    openSeats: room.slots.filter((s) => s.type === 'human' && !s.occupiedBy).length,
    totalSeats: room.slots.filter((s) => s.type !== 'closed').length,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function broadcastToRoom(room, msg) {
  if (!room || !room.clients) return;
  const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
  room.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(raw); } catch (e) {}
    }
  });
}

function broadcastDepartureBoard() {
  if (departureBoardSubscribers.size === 0) return;
  const msg = JSON.stringify({
    type: 'room_list_update',
    rooms: roomRegistry.listPublicRooms()
  });
  departureBoardSubscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch (e) {}
    } else {
      departureBoardSubscribers.delete(ws);
    }
  });
}

const BotTakeoverManager = require('./server_bot_takeover.js');
const botTakeoverManager = new BotTakeoverManager(roomRegistry, broadcastToRoom, broadcastDepartureBoard);
roomRegistry.botTakeoverManager = botTakeoverManager;

function handleRoomMessage(ws, message) {
  if (message.type === 'room_check_session') {
    const uid = message.uid;
    const cachedRoomId = message.roomId;
    let active = uid ? roomRegistry.findActiveRoomForUser(uid) : null;
    if (!active && cachedRoomId) {
      const r = roomRegistry.getRoom(cachedRoomId);
      if (r && r.status !== 'finished' && uid) {
        const slot = r.slots.find((s) => s.occupiedBy === uid);
        if (slot) {
          active = { room: r, slot, inFlight: r.status === 'in_flight', gameState: r.gameState };
        }
      }
    }

    if (active && active.room && active.room.status !== 'finished') {
      ws.send(JSON.stringify({
        type: 'room_session_status',
        hasActiveRoom: true,
        room: sanitizeRoom(active.room),
        slot: active.slot,
        inFlight: active.inFlight,
        gameState: active.gameState || (active.inFlight ? roomRegistry.createDefaultGameState(active.room.slots) : null)
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'room_session_status',
        hasActiveRoom: false,
        expired: !!cachedRoomId
      }));
    }
    return;
  }

  if (message.type === 'room_rejoin') {
    const playerInfo = {
      uid: message.uid,
      name: message.name,
      avatar: message.avatar
    };
    const res = roomRegistry.rejoinRoom(message.roomId, playerInfo, ws);
    if (!res.success) {
      ws.send(JSON.stringify({
        type: 'room_error',
        error: res.error,
        message: res.message
      }));
      return;
    }

    ws.send(JSON.stringify({
      type: 'room_rejoined',
      room: sanitizeRoom(res.room),
      slot: res.slot,
      inFlight: res.inFlight,
      gameState: res.gameState || (res.inFlight ? roomRegistry.createDefaultGameState(res.room.slots) : null)
    }));

    broadcastToRoom(res.room, {
      type: 'room_update',
      room: sanitizeRoom(res.room),
      reconnectedUser: message.uid
    });

    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_browse_start') {
    departureBoardSubscribers.add(ws);
    ws.send(JSON.stringify({
      type: 'room_list_update',
      rooms: roomRegistry.listPublicRooms()
    }));
    return;
  }

  if (message.type === 'room_browse_stop') {
    departureBoardSubscribers.delete(ws);
    return;
  }

  if (message.type === 'room_create') {
    const room = roomRegistry.createRoom({
      hostUid: message.hostUid || `user_${ws.terminal}_${Date.now().toString(36)}`,
      hostName: message.hostName || (ws.terminal === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺'),
      hostAvatar: message.hostAvatar || (ws.terminal === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png'),
      hostRole: ws.terminal || 'bkk',
      flightName: message.flightName || message.name || null,
      description: message.description || null,
      tags: message.tags || null,
      game: message.game || 'monopoly',
      autoFill: !!message.autoFill,
      isPublic: message.isPublic !== undefined ? message.isPublic : true,
      slots: message.slots || null,
      ws
    });

    ws.send(JSON.stringify({
      type: 'room_created',
      room: sanitizeRoom(room),
      slot: room.slots[0]
    }));
    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_quick_join') {
    const playerInfo = {
      uid: message.uid || `user_${ws.terminal}_${Date.now().toString(36)}`,
      name: message.name || (ws.terminal === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺'),
      avatar: message.avatar || (ws.terminal === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png')
    };

    let targetRoom = roomRegistry.findQuickJoinRoom();
    if (targetRoom) {
      const res = roomRegistry.joinRoom(targetRoom.id, playerInfo, ws);
      if (res.success) {
        ws.send(JSON.stringify({
          type: 'room_joined',
          room: sanitizeRoom(res.room),
          slot: res.slot
        }));
        broadcastToRoom(res.room, {
          type: 'room_update',
          room: sanitizeRoom(res.room)
        });
        broadcastDepartureBoard();
        return;
      }
    }

    // No open room found: auto-create fresh room
    const newRoom = roomRegistry.createRoom({
      hostUid: playerInfo.uid,
      hostName: playerInfo.name,
      hostAvatar: playerInfo.avatar,
      hostRole: ws.terminal || 'bkk',
      flightName: 'Monopoly · Chill Game',
      description: 'Relaxed game, make friends! All are welcome ♡',
      tags: ['Casual', 'Make Friends', 'Voice Chat'],
      game: 'monopoly',
      isPublic: true,
      ws
    });

    ws.send(JSON.stringify({
      type: 'room_created',
      room: sanitizeRoom(newRoom),
      slot: newRoom.slots[0]
    }));
    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_join' || message.type === 'room_join_code') {
    const key = message.type === 'room_join' ? message.roomId : message.code;
    const playerInfo = {
      uid: message.uid || `user_${ws.terminal}_${Date.now().toString(36)}`,
      name: message.name || (ws.terminal === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺'),
      avatar: message.avatar || (ws.terminal === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png'),
      spectator: !!message.spectator
    };
    const res = roomRegistry.joinRoom(key, playerInfo, ws);
    if (!res.success) {
      ws.send(JSON.stringify({
        type: 'room_error',
        error: res.error,
        message: res.message
      }));
      return;
    }

    ws.send(JSON.stringify({
      type: 'room_joined',
      room: sanitizeRoom(res.room),
      slot: res.slot,
      spectator: !!res.spectator,
      state: res.spectator ? (res.room.gameState || (res.room.status === 'in_flight' ? roomRegistry.createDefaultGameState(res.room.slots) : null)) : null
    }));

    broadcastToRoom(res.room, {
      type: 'room_update',
      room: sanitizeRoom(res.room)
    });

    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_chat') {
    const room = roomRegistry.getRoom(message.roomId) || roomRegistry.getClientRoom(ws);
    if (!room) return;
    const msgObj = roomRegistry.addMessage(room.id, {
      uid: message.sender?.uid || `user_${ws.terminal || 'guest'}`,
      name: message.sender?.name || (ws.terminal === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺'),
      avatar: message.sender?.avatar || (ws.terminal === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png'),
      text: message.text
    });
    if (msgObj) {
      broadcastToRoom(room, {
        type: 'room_chat',
        roomId: room.id,
        message: msgObj
      });
    }
    return;
  }

  if (message.type === 'room_toggle_ready') {
    const room = roomRegistry.getRoom(message.roomId) || roomRegistry.getClientRoom(ws);
    if (!room) return;
    const data = room.clientData.get(ws);
    if (data && data.slotId) {
      roomRegistry.toggleSlotReady(room.id, data.slotId);
      broadcastToRoom(room, {
        type: 'room_update',
        room: sanitizeRoom(room)
      });
    }
    return;
  }

  if (message.type === 'room_autofill') {
    const room = roomRegistry.getRoom(message.roomId) || roomRegistry.getClientRoom(ws);
    if (!room) return;
    roomRegistry.toggleAutoFill(room.id, message.autoFill);
    broadcastToRoom(room, {
      type: 'room_update',
      room: sanitizeRoom(room)
    });
    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_start') {
    const room = roomRegistry.getRoom(message.roomId) || roomRegistry.getClientRoom(ws);
    if (!room) return;

    // 1. Authorization: Host only
    const clientData = room.clientData ? room.clientData.get(ws) : null;
    const isHost = !ws || (clientData && clientData.slotId === 1) || room.hostUid === message.hostUid;
    if (!isHost) {
      ws.send(JSON.stringify({
        type: 'room_error',
        error: 'NOT_AUTHORIZED',
        message: 'Only the flight Captain (Host) can start the match.'
      }));
      return;
    }

    // 2. Idempotency: Reject if already started or finished
    if (room.status === 'in_flight') {
      console.log(`[RoomRegistry] Duplicate room_start ignored for active flight ${room.id}`);
      return;
    }
    if (room.status === 'finished') {
      ws.send(JSON.stringify({
        type: 'room_error',
        error: 'ROOM_FINISHED',
        message: 'This flight match has already finished.'
      }));
      return;
    }

    // 3. Minimum active participants check (>= 2 players or bots)
    const activeSlots = (room.slots || []).filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy));
    if (activeSlots.length < 2) {
      ws.send(JSON.stringify({
        type: 'room_error',
        error: 'NOT_ENOUGH_PLAYERS',
        message: 'At least 2 active players or bots are required to take off.'
      }));
      return;
    }

    room.status = 'in_flight';
    room.updatedAt = Date.now();
    if (message.state || message.initialState) {
      room.gameState = message.state || message.initialState;
    } else if (!room.gameState) {
      room.gameState = roomRegistry.createDefaultGameState(room.slots);
    }
    roomRegistry.db.updateRoom(room.id, { status: 'in_flight', game_state: room.gameState }).catch(() => {});
    broadcastToRoom(room, {
      type: 'room_start',
      roomId: room.id,
      game: room.game || 'monopoly',
      room: sanitizeRoom(room),
      state: room.gameState
    });
    broadcastDepartureBoard();
    return;
  }

  if (message.type === 'room_leave') {
    const res = roomRegistry.leaveRoom(ws, { explicit: true, uid: message.uid });
    if (res && res.room) {
      broadcastToRoom(res.room, {
        type: 'room_update',
        room: sanitizeRoom(res.room),
        hostMigrated: res.wasHost,
        newHost: res.newHost
      });
    }
    broadcastDepartureBoard();
    ws.send(JSON.stringify({ type: 'room_left' }));
    return;
  }

  if (message.type === 'room_set_privacy') {
    const res = roomRegistry.setPrivacy(message.roomId, message.isPublic, ws);
    if (res && res.success) {
      broadcastToRoom(res.room, {
        type: 'room_update',
        room: sanitizeRoom(res.room)
      });
      broadcastDepartureBoard();
    }
    return;
  }

  if (message.type === 'room_kick_player') {
    const res = roomRegistry.kickPlayer(message.roomId, message.slotId, ws);
    if (res && res.success) {
      if (res.kickedWs) {
        try {
          res.kickedWs.send(JSON.stringify({
            type: 'room_kicked',
            roomId: message.roomId,
            reason: 'You were removed from the flight room by the captain.'
          }));
        } catch (e) {}
      }
      broadcastToRoom(res.room, {
        type: 'room_update',
        room: sanitizeRoom(res.room)
      });
      broadcastDepartureBoard();
    }
    return;
  }

  if (message.type === 'room_update_slots') {
    const res = roomRegistry.updateSlot(message.roomId, message.slotId, message.update, ws);
    if (res && res.success) {
      if (res.kickedWs) {
        try {
          res.kickedWs.send(JSON.stringify({
            type: 'room_kicked',
            roomId: message.roomId,
            reason: 'Seat configuration was updated by the captain.'
          }));
        } catch (e) {}
      }
      broadcastToRoom(res.room, {
        type: 'room_update',
        room: sanitizeRoom(res.room)
      });
      broadcastDepartureBoard();
    }
    return;
  }
}

// Clean stale deserted rooms every 5 minutes
const staleRoomSweeper = setInterval(() => {
  roomRegistry.cleanStaleRooms();
}, 5 * 60 * 1000);
staleRoomSweeper.unref();

wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const terminal = (parsedUrl.query.terminal || '').toLowerCase();

  console.log(`[Signaling] Terminal connection request: "${terminal}"`);
  serverEvent('ws_connect', terminal, {
    ip: req.headers['cf-connecting-ip'] || req.socket.remoteAddress,
    country: req.headers['cf-ipcountry'] || null,
    userAgent: req.headers['user-agent'] || null
  });

  // Link-preview crawlers (Instagram/Messenger) run the page and would steal a seat
  if (isLinkPreviewBot(req)) {
    serverEvent('ws_bot_blocked', terminal, {
      ip: req.headers['cf-connecting-ip'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || null
    });
    try { ws.close(4003, 'bot'); } catch (e) {}
    return;
  }

  // Heartbeat: measures signaling round-trip and detects silent socket stalls
  ws.lastPingAt = 0;
  ws.missedPongs = 0;
  ws.on('pong', () => {
    const rtt = Date.now() - ws.lastPingAt;
    ws.missedPongs = 0;
    if (rtt > 1500) serverEvent('ws_slow_pong', ws.terminal, { rttMs: rtt });
  });

  if (terminal === 'bkk') {
    if (bkkDisconnectTimer) {
      clearTimeout(bkkDisconnectTimer);
      bkkDisconnectTimer = null;
      console.log('[Signaling] BKK reconnected within grace period.');
    }
    if (bkkSocket && bkkSocket !== ws) {
      console.log('[Signaling] Closing older BKK session.');
      try { bkkSocket.close(4001, 'replaced'); } catch (e) {}
    }
    bkkSocket = ws;
    ws.terminal = 'bkk';
  } else if (terminal === 'dxb') {
    if (dxbDisconnectTimer) {
      clearTimeout(dxbDisconnectTimer);
      dxbDisconnectTimer = null;
      console.log('[Signaling] DXB reconnected within grace period.');
    }
    if (dxbSocket && dxbSocket !== ws) {
      console.log('[Signaling] Closing older DXB session.');
      try { dxbSocket.close(4001, 'replaced'); } catch (e) {}
    }
    dxbSocket = ws;
    ws.terminal = 'dxb';
  } else {
    // Auto-assign: if BKK is free, assign BKK. Otherwise assign DXB.
    if (!bkkSocket) {
      bkkSocket = ws;
      ws.terminal = 'bkk';
    } else {
      dxbSocket = ws;
      ws.terminal = 'dxb';
    }
  }

  console.log(`[Signaling] Passenger assigned to [${ws.terminal.toUpperCase()}]. BKK online: ${!!bkkSocket}, DXB online: ${!!dxbSocket}`);

  // Send assignment confirmation to this client
  ws.send(JSON.stringify({
    type: 'assigned',
    terminal: ws.terminal,
    partnerOnline: ws.terminal === 'bkk' ? !!dxbSocket : !!bkkSocket
  }));

  // Push global vault profiles (diamonds, costumes) to the newly connected passenger
  daily.checkIn(ws.terminal);
  sendTo(ws, { type: 'vault_profiles', profiles: publicProfiles() });

  // Auto-sync persistent Monopoly state & played cards to newly connected/reconnected passenger
  if (serverMonopolyState || serverPlayedCardIds.length > 0) {
    if (serverMonopolyState) {
      if (serverPlayedCardIds.length) {
        serverMonopolyState.playedCardIds = [...new Set([...(serverMonopolyState.playedCardIds || []), ...serverPlayedCardIds])];
      }
      if (!Array.isArray(serverMonopolyState.cardDeck) || serverMonopolyState.cardDeck.length === 0) {
        serverMonopolyState.cardDeck = [...serverCardDeck];
      }
    }
    ws.send(JSON.stringify({
      type: 'monopoly_sync',
      state: serverMonopolyState,
      playedCardIds: serverPlayedCardIds,
      cardDeck: serverCardDeck
    }));
  }

  // If both are now online, notify both and tell DXB to initiate the offer
  if (bkkSocket && dxbSocket) {
    bkkSocket.send(JSON.stringify({
      type: 'partner_status',
      online: true,
      role: 'receiver'
    }));
    dxbSocket.send(JSON.stringify({
      type: 'partner_status',
      online: true,
      role: 'caller' // DXB initiates offer to BKK
    }));
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // 🛫 Sky Party: Flight Rooms & Departure Board
      if (message.type && message.type.startsWith('room_')) {
        handleRoomMessage(ws, message);
        return;
      }

      // 💎 Vault (global currency, gacha, wardrobe) is fully server-authoritative
      if (message.type && message.type.startsWith('vault_')) {
        handleVaultMessage(ws, message);
        return;
      }

      // Sky Monopoly Server-Side State Management & Auto-Healer
      if (message.type === 'monopoly_request_sync') {
        if (serverMonopolyState) {
          serverMonopolyState.isRolling = false;
          if (serverPlayedCardIds.length) {
            serverMonopolyState.playedCardIds = [...new Set([...(serverMonopolyState.playedCardIds || []), ...serverPlayedCardIds])];
          }
          if (!Array.isArray(serverMonopolyState.cardDeck) || serverMonopolyState.cardDeck.length === 0) {
            serverMonopolyState.cardDeck = [...serverCardDeck];
          }
          ws.send(JSON.stringify({ type: 'monopoly_sync', state: serverMonopolyState, playedCardIds: serverPlayedCardIds, cardDeck: serverCardDeck }));
        } else if (message.clientState) {
          serverMonopolyState = { ...message.clientState, isRolling: false };
          if (serverPlayedCardIds.length) {
            serverMonopolyState.playedCardIds = [...new Set([...(serverMonopolyState.playedCardIds || []), ...serverPlayedCardIds])];
          }
          if (!Array.isArray(serverMonopolyState.cardDeck) || serverMonopolyState.cardDeck.length === 0) {
            serverMonopolyState.cardDeck = [...serverCardDeck];
          }
          persistMonopolyState(serverMonopolyState);
          ws.send(JSON.stringify({ type: 'monopoly_sync', state: serverMonopolyState, playedCardIds: serverPlayedCardIds, cardDeck: serverCardDeck }));
        } else if (serverPlayedCardIds.length) {
          ws.send(JSON.stringify({ type: 'monopoly_sync', state: null, playedCardIds: serverPlayedCardIds, cardDeck: serverCardDeck }));
        }
        return;
      }

      if (message.type && message.type.startsWith('monopoly_')) {
        const incomingCards = (message.state && Array.isArray(message.state.playedCardIds))
          ? message.state.playedCardIds
          : (Array.isArray(message.playedCardIds) ? message.playedCardIds : null);
        if (incomingCards && incomingCards.length) {
          const validIncoming = incomingCards.filter(MonopolyCards.isValidCardId);
          const union = [...new Set([...serverPlayedCardIds, ...validIncoming])];
          if (union.length !== serverPlayedCardIds.length) {
            persistPlayedCards(union);
            serverCardDeck = serverCardDeck.filter((id) => !union.includes(id));
            if (serverCardDeck.length === 0) ensureServerCardDeck();
          }
        }

        if (message.type === 'monopoly_close') {
          if (serverMonopolyState) {
            serverMonopolyState.active = false;
            persistMonopolyState(serverMonopolyState);
          }
        }

        if (message.action === 'reset_game' || message.type === 'monopoly_start_party') {
          serverMonopolyState = message.state ? { ...message.state, isRolling: false } : null;
          if (serverMonopolyState) {
            serverMonopolyState.playedCardIds = [...serverPlayedCardIds];
            if (!Array.isArray(serverCardDeck) || serverCardDeck.length === 0) {
              ensureServerCardDeck();
            }
            serverMonopolyState.cardDeck = [...serverCardDeck];
            persistMonopolyState(serverMonopolyState);
          } else {
            try { fs.unlinkSync(MONOPOLY_STATE_FILE); } catch (e) {}
          }
          console.log(`[Monopoly] ${message.type === 'monopoly_start_party' ? 'Party flight started' : 'Game reset by passenger'}. Retaining ${serverPlayedCardIds.length} played cards.`);
        } else if (message.state) {
          serverMonopolyState = { ...serverMonopolyState, ...message.state, isRolling: false };
          if (serverPlayedCardIds.length) {
            serverMonopolyState.playedCardIds = [...new Set([...(serverMonopolyState.playedCardIds || []), ...serverPlayedCardIds])];
          }
          if (Array.isArray(message.state.cardDeck) && message.state.cardDeck.length) {
            const playedSet = new Set(serverPlayedCardIds);
            serverCardDeck = message.state.cardDeck.map(Number).filter((id) => MonopolyCards.isValidCardId(id) && !playedSet.has(id));
            serverMonopolyState.cardDeck = [...serverCardDeck];
          }
          persistMonopolyState(serverMonopolyState);
        }
      }

      // Room-aware message routing: forward within room or fallback to 1-to-1 BKK/DXB
      daily.observe(ws.terminal, message);
      const currentRoom = roomRegistry.getClientRoom(ws);
      if (currentRoom) {
        if (message.type === 'monopoly_action') {
          const clientData = currentRoom.clientData.get(ws);
          if (clientData && clientData.spectator) {
            ws.send(JSON.stringify({
              type: 'monopoly_action_rejected',
              error: 'ACTION_UNAUTHORIZED',
              action: message.action,
              message: 'Spectators cannot execute actions or mutate match state.'
            }));
            return;
          }

          const myRole = clientData ? clientData.role : null;
          const currentTurn = currentRoom.gameState ? currentRoom.gameState.currentTurn : null;
          const isBotTurn = currentRoom.gameState && currentRoom.gameState.players && currentRoom.gameState.players[currentTurn]?.isBot;
          const isHost = clientData && clientData.slotId === 1;

          if (message.action === 'roll') {
            const isAuthorized = (myRole === currentTurn) || (isBotTurn && isHost);
            if (!isAuthorized && currentTurn != null) {
              ws.send(JSON.stringify({
                type: 'monopoly_action_rejected',
                error: 'OUT_OF_TURN',
                action: 'roll',
                message: `Not your turn to roll (active turn: ${currentTurn}).`
              }));
              return;
            }
            if (currentRoom.rollLock) {
              ws.send(JSON.stringify({
                type: 'monopoly_action_rejected',
                error: 'ROLL_IN_PROGRESS',
                action: 'roll',
                message: 'A roll is already being processed.'
              }));
              return;
            }
            currentRoom.rollLock = true;
            setTimeout(() => { currentRoom.rollLock = false; }, 800);
          } else if (message.action === 'buy') {
            const tileId = message.tileId;
            const prop = currentRoom.gameState && currentRoom.gameState.properties ? currentRoom.gameState.properties[tileId] : null;
            if (prop && prop.owner && prop.owner !== myRole) {
              ws.send(JSON.stringify({
                type: 'monopoly_action_rejected',
                error: 'ILLEGAL_ACTION',
                action: 'buy',
                message: 'Cannot directly purchase an already owned property without takeover.'
              }));
              return;
            }
          }
        }

        if (message.state) {
          const oldTurn = currentRoom.gameState ? currentRoom.gameState.currentTurn : null;
          roomRegistry.updateGameState(currentRoom.id, message.state);
          const newTurn = message.state.currentTurn;
          if (newTurn && newTurn !== oldTurn && botTakeoverManager) {
            botTakeoverManager.onTurnAdvance(currentRoom, newTurn);
          }
          if (message.state.gameOver) {
            currentRoom.status = 'finished';
            currentRoom.rollLock = false;
            broadcastToRoom(currentRoom, {
              type: 'room_finished',
              roomId: currentRoom.id,
              winner: message.state.gameOver.winner,
              reason: message.state.gameOver.reason,
              state: message.state
            });
            broadcastDepartureBoard();
          }
        }
        currentRoom.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      } else {
        const target = ws.terminal === 'bkk' ? dxbSocket : bkkSocket;
        const delivered = !!(target && target.readyState === WebSocket.OPEN);
        if (delivered) {
          target.send(JSON.stringify(message));
        }
        if (['offer', 'answer', 'hangup', 'media_state'].includes(message.type)) {
          serverEvent('sig_relay', ws.terminal, { type: message.type, delivered });
        } else if (message.type === 'candidate' && !delivered) {
          serverEvent('sig_relay', ws.terminal, { type: 'candidate', delivered: false });
        }
      }
    } catch (err) {
      console.error('[Signaling] Error forwarding message:', err.message);
    }
  });

  ws.on('close', (code, reasonBuf) => {
    console.log(`[Signaling] Terminal [${ws.terminal.toUpperCase()}] disconnected.`);
    serverEvent('ws_close', ws.terminal, { code, reason: reasonBuf ? reasonBuf.toString() : '' });

    departureBoardSubscribers.delete(ws);
    const discRes = roomRegistry.handleDisconnect(ws);
    if (discRes && discRes.room) {
      broadcastToRoom(discRes.room, {
        type: 'room_update',
        room: sanitizeRoom(discRes.room),
        disconnectedUser: discRes.disconnectedUser
      });
      broadcastDepartureBoard();
    }
    if (ws.terminal === 'bkk' && bkkSocket === ws) {
      bkkSocket = null;
      if (bkkDisconnectTimer) clearTimeout(bkkDisconnectTimer);
      bkkDisconnectTimer = setTimeout(() => {
        if (!bkkSocket && dxbSocket && dxbSocket.readyState === WebSocket.OPEN) {
          console.log('[Signaling] BKK grace period expired. Broadcasting offline.');
          dxbSocket.send(JSON.stringify({ type: 'partner_status', online: false }));
        }
        bkkDisconnectTimer = null;
      }, DISCONNECT_GRACE_MS);
    } else if (ws.terminal === 'dxb' && dxbSocket === ws) {
      dxbSocket = null;
      if (dxbDisconnectTimer) clearTimeout(dxbDisconnectTimer);
      dxbDisconnectTimer = setTimeout(() => {
        if (!dxbSocket && bkkSocket && bkkSocket.readyState === WebSocket.OPEN) {
          console.log('[Signaling] DXB grace period expired. Broadcasting offline.');
          bkkSocket.send(JSON.stringify({ type: 'partner_status', online: false }));
        }
        dxbDisconnectTimer = null;
      }, DISCONNECT_GRACE_MS);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Signaling] Socket error on [${ws.terminal}]:`, err.message);
  });
});

const PORT = process.env.PORT || 3000;

// Send a WebSocket ping every 20s (also keeps idle tunnels from timing out)
const wsPingInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.lastPingAt && client.missedPongs >= 1) {
      serverEvent('ws_missed_pong', client.terminal, { missed: client.missedPongs });
    }
    client.missedPongs = (client.missedPongs || 0) + 1;
    client.lastPingAt = Date.now();
    try { client.ping(); } catch (e) {}
  });
}, 20000);
wsPingInterval.unref();

// ---------------------------------------------------------------------------
// Production Graceful Shutdown (Railway / Container SIGTERM & SIGINT handlers)
// ---------------------------------------------------------------------------
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);

  // 1. Notify connected WebSocket clients of impending shutdown
  if (typeof wss !== 'undefined' && wss.clients) {
    const shutdownPayload = JSON.stringify({
      type: 'server_shutdown',
      reason: 'Server is restarting or updating. Reconnecting shortly...',
      timestamp: Date.now()
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(shutdownPayload);
          client.close(1001, 'Server shutting down');
        } catch (e) {}
      }
    });
  }

  // 2. Persist active game states
  try {
    if (serverMonopolyState) {
      persistMonopolyState(serverMonopolyState);
    }
    if (serverPlayedCardIds && serverPlayedCardIds.length > 0) {
      persistPlayedCards(serverPlayedCardIds);
    }
  } catch (err) {
    console.error('[Server] Failed to flush state on shutdown:', err.message);
  }

  // 3. Close HTTP/WebSocket server cleanly
  server.close(() => {
    console.log('[Server] HTTP and WebSocket server closed cleanly.');
    process.exit(0);
  });

  // Force termination after 5 seconds if lingering connections keep loop alive
  setTimeout(() => {
    console.warn('[Server] Forcing shutdown after 5s timeout.');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`✨  Sky Party Terminal Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, wss, roomRegistry, gracefulShutdown };

