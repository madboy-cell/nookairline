// client/js/main.js — boot: gate → sign-in → world + realtime session.
// Step 2: village HUD (Harvest All + bubbles, Edit Grid, mood, couple blessing, Wonder actions),
// building / upgrade / Cloud Territory / Welcome-Back modals, Finger Pick-Up & Drop and Dock fishing.
import { WorldEngine } from './world_engine.js';
import { loadManifest } from './assets.js';
import { Net, session, login, fetchMe, claimA2HS } from './net.js';
import { env, initGate, registerServiceWorker } from './pwa_gate.js';
import { GridEditor, humanError, resolveMood } from './village_plaza.js';
import { DockFishing } from './minigames/dock_fishing.js';
import { RpgUI } from './gacha_forge_ui.js';
import { MonopolyBridge } from './monopoly_bridge.js';
import { NetRoom } from './minigames/monopoly_25d/room_client.js';
import { expToNext } from '/shared/progression.js';
import {
  CORE, WONDERS, DECOR, MOODS, EXPANSION_TIERS, BLUEPRINT_CARDS, MAX_CORE_LV, MAX_CASTLE_LV, CORE_LANDMARKS,
  castleUpgradeCost, castlePrereq, placeable, buildingCaps,
} from '/shared/catalog_landmarks.js';
import { harvestPreview, storageCapHrs, comfortBonusPct, islandOf, findPlaced, utcDay } from '/shared/village_rules.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n >= 100000 ? `${(n / 1000).toFixed(1)}K` : Number(n || 0).toLocaleString('en-US'));
const MOOD_ICON = { auto: '🔄', sunny: '☀️', sakura: '🌸', sunset: '🌅', night: '🌙' };
const MOOD_NAME = { auto: 'Auto', sunny: 'Sunny', sakura: 'Sakura', sunset: 'Sunset', night: 'Night' };

let world = null;
let net = null;
let editor = null;
let fishing = null;
let rpg = null;
let mono = null;            // Step 4: Table Hub + Sky Monopoly bridge (rebuilt with every socket session)
let selectedLineage = 'bkk';
let selectedHairColor = 'chestnut';
let toastTimer = 0;
const S = { profile: null, coupled: false, serverOffset: 0, pending: new Map(), reqId: 0, layoutKey: '' };
const serverNow = () => Date.now() + S.serverOffset;

export function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function renderHud(p) {
  S.profile = p;
  $('hud-name').textContent = p.username;
  $('hud-level').textContent = `Lv. ${p.level}`;
  $('hud-cp').textContent = Number(p.cp || 0).toLocaleString('en-US');
  $('hud-gold').textContent = fmt(p.gold);
  $('hud-berries').textContent = fmt(p.berries);
  $('hud-diamonds').textContent = fmt(p.diamonds);
  const need = expToNext(p.level);
  $('hud-exp').style.width = `${Number.isFinite(need) ? Math.min(100, (p.exp / need) * 100) : 100}%`;
  $('hud-avatar').style.backgroundImage = `url(/assets/chibi/${p.lineage}_base_front.png)`;
  fishing?.setProfile(p);
  syncSelfVillage();
  tickVillage();
}

/** Keep the renderer's copy of MY island = my authoritative profile.village (full data, incl. bag). */
function syncSelfVillage() {
  const p = S.profile;
  if (!world?.layout || !p?.village || editor?.active) return;
  const isl = islandOf(world.layout, p.id);
  if (!isl) return;
  const v = p.village;
  const key = JSON.stringify([v.grid_size, v.castle_lv, v.ground, v.buildings, v.tiles, v.levels, v.wonders]);
  if (key !== S.layoutKey || isl.S !== v.grid_size) {
    S.layoutKey = key;
    world.plaza.setVillage(p.id, v);
  } else isl.village = v;
}

function renderNet() {
  const pill = $('net-pill');
  if (!net?.connected) { pill.textContent = '● reconnecting…'; pill.classList.add('offline'); return; }
  pill.classList.remove('offline');
  pill.textContent = `● online${net.rtt != null ? ` • ${net.rtt} ms` : ''}`;
}

function showGate(message = '') {
  $('gate').classList.remove('hidden');
  $('hud').dataset.scene = 'BOOT';
  $('login-error').textContent = message;
}

// ------------------------------------------------------------------ request / reply over the socket
function request(type, payload = {}) {
  const reqId = ++S.reqId;
  return new Promise((resolve) => {
    S.pending.set(reqId, resolve);
    net.send({ type, reqId, ...payload });
    setTimeout(() => { if (S.pending.delete(reqId)) resolve({ ok: false, error: 'timeout' }); }, 6000);
  });
}

// ------------------------------------------------------------------ village HUD tick (1 Hz)
function tickVillage() {
  const p = S.profile;
  if (!p?.village || !world?.layout) return;
  const pv = harvestPreview(p, serverNow(), { coupled: S.coupled });
  const btn = $('act-harvest');
  const any = pv.gold + pv.berries + pv.diamonds > 0;
  btn.disabled = !pv.ready || !any;
  btn.classList.toggle('ready', pv.ready && any);
  const bits = [];
  if (pv.gold) bits.push(`${fmt(pv.gold)}🪙`);
  if (pv.berries) bits.push(`${fmt(pv.berries)}🍓`);
  if (pv.diamonds) bits.push(`${pv.diamonds}💎`);
  $('harvest-sub').textContent = bits.length ? bits.join(' ') : (pv.ready ? 'empty' : 'growing…');
  if (!editor?.active) world.plaza.setBubbles(pv);
  $('act-bless').hidden = !S.coupled;
  // Fountain of 1,000 Wishes within reach (own or partner's island)
  const L = world.local;
  let fountain = null;
  if (L) for (const isl of world.layout.islands) for (const b of isl.village.buildings) {
    if (b.type !== 'wnd_fountain') continue;
    const hit = findPlaced(world.layout, b.uid, L.x, L.z);
    if (hit && hit.d < 2.2) fountain = isl.owner;
  }
  $('act-fountain').hidden = !fountain;
  $('act-fountain').dataset.owner = fountain || '';
}

// ------------------------------------------------------------------ actions
async function harvestAll() {
  const r = await request('village_harvest_all');
  if (!r.ok) { toast(`🍓 ${humanError(r.error)}`); return; }
  const bits = [];
  if (r.gold) bits.push(`+${fmt(r.gold)} 🪙`);
  if (r.berries) bits.push(`+${fmt(r.berries)} 🍓`);
  if (r.diamonds) bits.push(`+${r.diamonds} 💎`);
  toast(`${r.jackpot ? '🌟 DOUBLE JACKPOT! ' : '✨ '}${bits.join('  ')}  • +${r.exp} EXP${r.levelsGained ? `  🎉 LEVEL UP! +${50 * r.levelsGained} 💎` : ''}`, 2600);
  for (const b of world.plaza.bubbles) if (b.visible) world.fx.emit(b.userData.res === 'gold' ? 'fx_star' : b.userData.res === 'diamonds' ? 'fx_stardust' : 'fx_heart', b.position.x, b.position.y, b.position.z, 8, { speed: 2, up: 2.2, size: 0.3, life: 0.8, gravity: 2 });
  world.plaza.setBubbles(null);
}

async function cycleMood() {
  const cur = S.profile.village.mood || 'auto';
  const next = MOODS[(MOODS.indexOf(cur) + 1) % MOODS.length];
  applyMood(next);
  const r = await request('village_set_mood', { mood: next });
  if (!r.ok) toast(humanError(r.error));
}

function applyMood(mood) {
  const shown = world.plaza.setMood(mood);
  $('mood-ico').textContent = MOOD_ICON[mood === 'auto' ? 'auto' : shown];
  $('mood-name').textContent = mood === 'auto' ? `Auto ${MOOD_ICON[shown]}` : MOOD_NAME[shown];
}

async function bless() {
  const r = await request('village_bless_partner');
  toast(r.ok ? `💧 You blessed your partner's land! +15% yield for 12h • +${r.gold} 🪙` : `💧 ${humanError(r.error)}`);
}

async function tossCoin(owner) {
  const r = await request('village_wonder_action', { action: 'fountain_toss', owner });
  if (!r.ok) { toast(`⛲ ${humanError(r.error)}`); return; }
  toast(r.ticket ? '⛲ The fountain sparkles… +1 Free Summon Ticket! 🎟️' : `⛲ Wish granted! +${r.diamonds} 💎`, 2600);
}

// ------------------------------------------------------------------ modals
function openModal(title, body, actions = []) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  const box = $('modal-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn-gold small';
    b.innerHTML = a.label;
    b.disabled = !!a.disabled;
    b.onclick = async () => { b.disabled = true; const keep = await a.onClick?.(); if (!keep) closeModal(); else b.disabled = false; };
    box.appendChild(b);
  }
  $('modal').hidden = false;
}
function closeModal() { $('modal').hidden = true; }

function buildingModal(pick) {
  const p = S.profile;
  const mine = pick.owner === p.id;
  const isl = islandOf(world.layout, pick.owner);
  const v = mine ? p.village : isl.village;
  const b = v.buildings.find((q) => q.uid === pick.uid);
  if (!b) return;
  const d = placeable(b.type);
  const rows = [];
  const actions = [];
  let title = `${d.emoji} ${d.name}`;
  if (b.type === 'castle') {
    const next = v.castle_lv + 1;
    const sum = CORE_LANDMARKS.reduce((s, k) => s + (v.levels?.[k] || 1), 0);
    const caps = buildingCaps(v.castle_lv);
    title += ` • Lv. ${v.castle_lv}`;
    rows.push(['All-Building Yield', `+${v.castle_lv * 2}%`], ['Comfort', `🌸 ${fmt(v.comfort)} (+${comfortBonusPct(v.comfort)}%)`],
      ['Building cap', `${caps.core} landmarks • ${caps.wonders} Wonders`], ['Island', `${v.grid_size}×${v.grid_size}`]);
    if (mine && next <= MAX_CASTLE_LV) {
      rows.push([`Upgrade to Lv. ${next}`, `${fmt(castleUpgradeCost(next))} 🪙`], ['Landmark levels needed', `${sum} / ${castlePrereq(next)}`]);
      actions.push({ label: `⬆️ Upgrade (${fmt(castleUpgradeCost(next))} 🪙)`, disabled: p.gold < castleUpgradeCost(next) || sum < castlePrereq(next), onClick: () => upgrade('castle') });
    }
  } else if (CORE[b.type]) {
    const lv = v.levels?.[b.type] || 1;
    title += ` • Lv. ${lv}`;
    if (d.produces) rows.push(['Production', `${fmt(d.perHour(lv))} ${d.produces === 'gold' ? '🪙' : '🍓'}/hr`]);
    if (d.daily) rows.push(['Daily Diamonds', `${d.perDay(lv)} 💎/day`]);
    if (b.type === 'nest') rows.push(['Mythic/Epic Trait Odds', `${d.traitOdds(lv).toFixed(2)}x`]);
    if (b.type === 'dock') rows.push(['Offline Storage Cap', `${storageCapHrs(v, mine ? p : {}).toFixed(1)} h`], ['Fishing', 'Walk onto the dock and tap 🎣']);
    if (b.type === 'patisserie') rows.push(['Post-Match Gold', `+${d.matchGoldPct(lv)}%`]);
    if (b.type === 'shrine') rows.push(['1-Tap Warp to Town Hall', 'opens in Step 5']);
    if (mine) {
      const cards = v.blueprints?.[b.type] | 0;
      if (lv < MAX_CORE_LV) {
        rows.push(['Blueprint Cards', `${cards} / ${BLUEPRINT_CARDS[lv]}`]);
        actions.push({ label: '⬆️ Upgrade!', disabled: cards < BLUEPRINT_CARDS[lv], onClick: () => upgrade(b.type) });
      } else rows.push(['Level', 'MAX ✨']);
    }
  } else if (WONDERS[b.type]) {
    const stars = v.wonders?.[b.type]?.stars || 1;
    title += ` ${'★'.repeat(stars)}`;
    rows.push(['Active buff', d.effect]);
    if (b.type === 'wnd_fountain') actions.push({ label: '⛲ Toss 100 🪙', onClick: () => tossCoin(pick.owner) });
    if (b.type === 'wnd_onsen') rows.push(['Tip', 'Long-press your Chibi and drop them into the hot spring!']);
  } else if (DECOR[b.type]) {
    rows.push(['Buff', d.effect]);
    if (d.seats) rows.push(['Tip', 'Drop your Chibi onto it to sit 🪑']);
  }
  if (mine) actions.push({ label: '🔨 Move / Edit', onClick: () => { enterEdit(b.uid); } });
  const body = `<img class="big" src="/assets/village/${d.sprite}.png" alt="">${mine ? '' : `<div class="hint-small">🏝️ ${pick.owner}'s island</div>`}`
    + `<div class="rows">${rows.map(([k, val]) => `<span>${k}</span><b>${val}</b>`).join('')}</div>`;
  openModal(title, body, actions);
}

async function upgrade(target) {
  const r = await request('village_upgrade', { target });
  toast(r.ok ? (target === 'castle' ? `🏰 Castle upgraded to Lv. ${r.castle_lv}! +${r.exp} EXP` : `⬆️ ${CORE[target].name} is now Lv. ${r.lv}! +${r.exp} EXP`) : `⬆️ ${humanError(r.error)}`);
}

function expansionModal() {
  const v = S.profile.village;
  const tier = EXPANSION_TIERS.findIndex((t) => t.size === v.grid_size);
  const next = EXPANSION_TIERS[tier + 1];
  if (!next) return;
  const ok = v.castle_lv >= next.castleLv && S.profile.gold >= next.gold;
  openModal('☁️ Clear Cloud Territory', `<img class="big" src="/assets/village/env_cloud.png" alt="">`
    + `<div class="rows"><span>Expansion Tier ${tier + 1}</span><b>${v.grid_size}×${v.grid_size} → ${next.size}×${next.size}</b>`
    + `<span>Castle level</span><b>${v.castle_lv} / ${next.castleLv}</b><span>Cost</span><b>${fmt(next.gold)} 🪙</b></div>`,
  [{ label: `☁️ Clear Clouds (${fmt(next.gold)} 🪙)`, disabled: !ok, onClick: async () => { const r = await request('village_expand_cloud'); toast(r.ok ? `☁️ Your kingdom grew to ${r.grid_size}×${r.grid_size}!` : `☁️ ${humanError(r.error)}`); } }]);
}

function welcomeBack(off) {
  const h = Math.floor(off.awayMs / 3600_000), m = Math.floor((off.awayMs % 3600_000) / 60_000);
  const rewards = [];
  if (off.gold) rewards.push(`<span>🪙 +${fmt(off.gold)}</span>`);
  if (off.berries) rewards.push(`<span>🍓 +${fmt(off.berries)}</span>`);
  if (off.diamonds) rewards.push(`<span>💎 +${off.diamonds}</span>`);
  openModal('⏳ Welcome Back!', `<div>While you were resting (<b>${h}h ${m}m</b>), your Sky Kingdom produced:</div>`
    + `<div class="rewards">${rewards.join('')}</div><div class="hint-small">🐢 Storage cap: ${off.capHrs.toFixed(1)} h${off.full ? ' — storage was full!' : ''}</div>`,
  [{ label: '🍓 HARVEST ALL (+15 EXP)', onClick: () => harvestAll() }]);
}

// ------------------------------------------------------------------ editor
function enterEdit(selectUid = null) {
  closeModal();
  if (!editor || editor.active) return;
  $('hud').dataset.scene = 'VILLAGE_EDIT';
  world.setEditMode(true);
  editor.open();
  if (selectUid) { editor.selected = selectUid; editor.refresh(); }
}

function exitEdit() {
  $('hud').dataset.scene = 'VILLAGE';
  world.setEditMode(false);
  S.layoutKey = '';
  syncSelfVillage();
}

// ------------------------------------------------------------------ speech bubble during pick-up
let speechRafId = 0;
function trackSpeech() {
  const el = $('speech');
  const L = world?.local;
  if (L && world.lift) {
    const isPet = world.lift.target === 'pet' && L.pet;
    const tx = isPet ? L.pet.x : L.x;
    const ty = isPet ? 1.55 : 2.75;
    const tz = isPet ? L.pet.z : L.z;
    const s = world.worldToScreen(tx, ty, tz);
    const r = $('app').getBoundingClientRect();
    el.style.left = `${s.x - r.left}px`; el.style.top = `${s.y - r.top}px`;
    el.hidden = false;
    speechRafId = requestAnimationFrame(trackSpeech);
  } else {
    el.hidden = true;
    speechRafId = 0;
  }
}

function startSpeechTracking() {
  if (!speechRafId) {
    speechRafId = requestAnimationFrame(trackSpeech);
  }
}

async function startGame(profile) {
  $('gate').classList.add('hidden');
  $('hud').dataset.scene = 'VILLAGE';
  renderHud(profile);

  if (!world) {
    world = new WorldEngine($('world'));
    await loadManifest(world.renderer);
    world.start();
    rpg = new RpgUI({ request: (t, p) => request(t, p), toast, humanError, getProfile: () => S.profile });
    window.__neora = { world, debug: () => world.debugState(), request: (t, p) => request(t, p), state: S, rpg };
    trackSpeech();
    setInterval(tickVillage, 1000);
    $('act-harvest').onclick = harvestAll;
    $('act-edit').onclick = () => enterEdit();
    $('act-mood').onclick = cycleMood;
    $('act-bless').onclick = bless;
    $('act-fountain').onclick = () => tossCoin($('act-fountain').dataset.owner);
    $('modal-x').onclick = closeModal;
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    world.onPick = (pk) => {
      if (pk.kind === 'bubble') { harvestAll(); return true; }
      if (pk.kind === 'signpost') { expansionModal(); return true; }
      if (pk.kind === 'building') { buildingModal(pk); return true; }
      return false;
    };
    world.onPetTap = async () => {
      const p = S.profile;
      const petCtrl = world?.local?.pet;
      if (!p || !petCtrl) return;
      const eq = p.equipped?.pet;
      const owned = (p.pets || []).find((x) => x.uid === eq?.uid || x.id === eq?.id);
      if (!owned) return;
      const today = String(utcDay(serverNow()));
      if (owned.last_gift_day !== today) {
        const r = await request('pet_claim_gift', { petUid: owned.uid });
        if (r.ok) {
          petCtrl.setGiftReady(false);
          petCtrl.act('happy');
          petCtrl.showEmote('joy');
          const g = r.gift || {};
          const bits = [`+${fmt(g.gold || 0)} 🪙`, `+${g.berries || 0} 🍓`];
          if (g.stardust) bits.push(`+${g.stardust} 🌟`);
          toast(`🎁 Pet Daily Gift: ${bits.join('  ')}! 💕`, 2600);
          return;
        }
      }
      petCtrl.act('happy');
      petCtrl.showEmote('love');
      const r = await request('pet_interact', { petUid: owned.uid });
      if (r.ok) {
        toast(`🐾 Pat-pat! Bond Lv.${r.bond_lv}${r.leveledUp ? ' 🎉 BOND LEVEL UP!' : ' (+10 Bond XP)'}`, 1800);
      }
    };
    world.onLongPressBuilding = (pk) => { enterEdit(pk.uid); return true; };
    world.onLiftStart = (target) => {
      $('speech').textContent = target === 'pet' ? 'Nyaa~ Drop me on the Cushion or Nest! 💕' : 'Waaah! Put me in the Onsen! >o<';
      startSpeechTracking();
    };
    world.onDrop = async (d) => {
      net.send({ type: 'chibi_pickup_drop', targetId: d.targetId || S.profile.id, ...d });
    };
    world.onDockNear = (on) => fishing?.setAvailable(on);
  }
  if (env.standalone && !profile.a2hs_claimed) {
    claimA2HS().then((r) => { if (r.granted) { toast('📲 Fullscreen app installed! +50 💎'); renderHud(r.profile); } }).catch(() => {});
  }

  net?.close();
  net = new Net();
  editor = editor || new GridEditor(world.plaza, {
    onSave: (layout) => request('village_save_grid', { layout }),
    onExit: (saved) => { exitEdit(); if (saved) toast('✅ Layout saved!'); },
    toast,
  });
  world.editor = editor;
  fishing = new DockFishing(net, {
    toast,
    humanError,
    onCatch: () => {
      world?.local?.pet?.act('happy');
      world?.local?.pet?.showEmote('joy');
    },
  });
  fishing.setProfile(S.profile);
  world.onLocalMove = (state, force) => net.sendMove(state, force);
  setupMonopoly(profile);
  net.on('status', renderNet)
    .on('auth_ok', (m) => {
      S.serverOffset = m.serverNow - Date.now();
      S.coupled = !!m.coupled;
      world.plaza.setLayout(m.layout, m.profile.id);
      S.layoutKey = '';
      renderHud(m.profile);
      applyMood(m.profile.village?.mood || 'auto');
      world.clearRemotes();
      if (world.local && world.local.id !== m.profile.id) world.removeLocal();
      if (!world.local) world.spawnLocal(m.profile, m.self);
      else { world.setLocalPosition(m.self.x, m.self.z); world.syncPetGiftAndYard(m.profile); }
      if (m.offline) welcomeBack(m.offline);
    })
    .on('instance_snapshot', (m) => {
      const ids = new Set(m.players.map((p) => p.id));
      for (const id of world.remotes.keys()) if (!ids.has(id)) world.removeRemote(id);
      for (const p of m.players) world.upsertRemote(p);
    })
    .on('player_joined', (m) => { world.upsertRemote(m.player); toast(`${m.player.username} arrived ✨`, 1600); })
    .on('player_left', (m) => world.removeRemote(m.id))
    .on('player_moved', (m) => { const r = world.remotes.get(m.id); if (r) world.upsertRemote({ ...r.data, ...m }); })
    .on('player_dropped', (m) => { if (m.targetId !== 'pet') world.teleportRemote(m.id, m.x, m.z); })
    .on('player_caught', (m) => toast(`🎣 ${m.id} caught something!`, 1400))
    .on('position_correct', (m) => world.setLocalPosition(m.x, m.z))
    .on('profile_update', (m) => {
      if (m.serverNow) S.serverOffset = m.serverNow - Date.now();
      renderHud(m.profile);
      world.applyEquipment(m.profile.id, m.profile.equipped, m.profile.appearance);
      world.syncPetGiftAndYard(m.profile);
      rpg?.onProfile(m.profile);
    })
    .on('player_equipped', (m) => world.applyEquipment(m.id, m.equipped, m.appearance))
    .on('global_cheer_banner', (m) => toast(`🌟 ${m.winnerName} ${m.achievement}! 👏`, 3200))
    .on('couple_egg_hatched', (m) => toast(`🥚💞 ${m.by} hatched a Rainbow Couple Egg with your pet!`, 3000))
    .on('resume_ok', (m) => { S.serverOffset = m.serverNow - Date.now(); world.plaza.setLayout(m.layout, m.profile.id); S.layoutKey = ''; renderHud(m.profile); world.syncPetGiftAndYard(m.profile); })
    .on('village_updated', (m) => {
      const isl = islandOf(world.layout, m.owner);
      const resized = m.layout && (!isl || isl.S !== m.layout.islands.find((i) => i.owner === m.owner)?.S);
      if (resized) { world.plaza.setLayout(m.layout, S.profile.id); S.layoutKey = ''; syncSelfVillage(); world.syncPetGiftAndYard(S.profile); return; }
      if (m.owner === S.profile.id) { syncSelfVillage(); world.syncPetGiftAndYard(S.profile); return; }
      world.plaza.setVillage(m.owner, m.village);
    })
    .on('action_result', (m) => {
      if (m.serverNow) S.serverOffset = m.serverNow - Date.now();
      const res = S.pending.get(m.reqId);
      if (res) { S.pending.delete(m.reqId); res(m); }
    })
    .on('drop_result', (m) => {
      if (m.targetId === 'pet') {
        if (m.buff === 'pet_cozy_spot') toast(`🐾 Cozy nap spot! Bond Lv.${m.bond_lv}${m.leveledUp ? ' 🎉 BOND LEVEL UP!' : ' (+10 Bond XP)'}`, 2400);
        else if (m.prop) toast(`🐾 ${placeable(m.prop.type)?.emoji || '✨'} ${placeable(m.prop.type)?.name || ''}`, 1400);
        return;
      }
      if (!m.ok) { if (Number.isFinite(m.x)) world.setLocalPosition(m.x, m.z); toast(`🤏 ${humanError(m.error)}`, 1200); return; }
      world.setLocalPosition(m.x, m.z);
      if (m.buff === 'blacksmith') toast(`♨️ Ahh~ hot spring soak! +${m.pct}% Blacksmith Success for 1h`, 2600);
      else if (m.prop) toast(`${placeable(m.prop.type)?.emoji || '✨'} ${placeable(m.prop.type)?.name || ''}`, 1400);
    })
    .on('blessed', () => toast('💧 Your partner blessed your land! +15% yield for 12h 💞', 2600))
    .on('auth_fail', (m) => { session.token = null; showGate(m.error); })
    .on('kicked', (m) => showGate(m.reason));
  net.connect();
}

// ------------------------------------------------------------------ Step 4: 🎮 Play → Table Hub → Sky Monopoly
function setupMonopoly(profile) {
  mono?.destroy();
  if (world) world.activeScene = null;
  $('hud').hidden = false;
  mono = new MonopolyBridge({
    container: $('app'),
    renderer: world.renderer,
    room: new NetRoom({ net, userId: profile.id }),
    toast,
    onExit: () => { if (world) world.activeScene = null; $('hud').hidden = false; },
    // the board takes over the shared canvas (village paused) and the village HUD hides while playing
    onEnterMatch: (b) => { world.activeScene = b; $('hud').hidden = true; },
    onLeaveMatch: () => { world.activeScene = null; $('hud').hidden = false; },
  });
  window.__neora && (window.__neora.mono = mono);
}

function openPlayHub() {
  if (!mono || editor?.active) return;
  closeModal();
  mono.openHub();
}

function bindGate() {
  document.querySelectorAll('.lineage').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.lineage').forEach((x) => x.classList.toggle('selected', x === b));
    selectedLineage = b.dataset.lineage;
  }));
  document.querySelectorAll('[data-hair-color]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-hair-color]').forEach((x) => x.classList.toggle('selected', x === b));
    selectedHairColor = b.dataset.hairColor || 'chestnut';
    const gateEl = $('gate');
    if (gateEl) gateEl.dataset.hairDye = selectedHairColor;
  }));
  if (env.dev) {
    $('quickfills').hidden = false;
    document.querySelectorAll('[data-qf]').forEach((b) => b.addEventListener('click', () => {
      $('login-user').value = b.dataset.qf; $('login-pass').value = '1234';
    }));
  }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-btn');
    btn.disabled = true; $('login-error').textContent = '';
    try {
      const isGirl = selectedLineage === 'dxb' || selectedLineage === 'girl';
      const appearance = {
        body: isGirl ? 'girl' : 'boy',
        hair: isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy',
        hairColor: selectedHairColor || 'chestnut',
      };
      const r = await login($('login-user').value.trim().toLowerCase(), $('login-pass').value, selectedLineage, appearance);
      session.token = r.token;
      if (r.created) setTimeout(() => toast(`Welcome to Neora World, ${r.profile.username}! 🥚`), 400);
      await startGame(r.profile);
    } catch (err) {
      $('login-error').textContent = err.message;
    } finally { btn.disabled = false; }
  });
  document.querySelectorAll('.dock-btn[data-step]').forEach((b) => b.addEventListener('click', () =>
    toast(`${b.textContent.trim()} unlocks in Step ${b.dataset.step} 🔒`)));
  document.querySelector('.dock-btn[data-dock="play"]')?.addEventListener('click', openPlayHub);
  document.querySelector('.dock-btn[data-dock="wardrobe"]')?.addEventListener('click', () => rpg?.open('wardrobe'));
  document.querySelector('.dock-btn[data-dock="gacha"]')?.addEventListener('click', () => rpg?.open('gacha', { tab: 'box1' }));
}

function applyUiScale() {
  const shell = $('app');
  const w = shell.clientWidth || innerWidth, h = shell.clientHeight || innerHeight;
  const s = Math.max(0.82, Math.min(1.25, Math.min(w / 402, h / 874)));
  document.documentElement.style.setProperty('--ui-scale', s.toFixed(3));
}

async function boot() {
  applyUiScale();
  window.addEventListener('resize', applyUiScale);
  registerServiceWorker();
  bindGate();
  const formAllowed = initGate();
  if ($('debug-readout') && env.params.has('debug')) {
    $('debug-readout').hidden = false;
    setInterval(() => {
      const s = world?.debugState();
      if (s) $('debug-readout').textContent = `fps ${s.fps}  pos ${s.x},${s.z}${s.onRoad ? ' 🧱+15%' : ''}\nfacing ${s.facing} ${s.view}\nwings z ${s.wingsZ}  walk ${s.walkWeight}\npet ${s.petDist}m ${s.petBack ? 'back' : 'front'}${s.petNuzzle ? ' 💕' : ''}\nremotes ${s.remotes.length}  cam ${s.pitchDeg}°`;
    }, 200);
  }
  // Step 3 dev calibration page: ?dev=1&dressup=1
  if (env.dev && env.params.has('dressup')) {
    const { startDressUp } = await import('./dressup.js');
    await startDressUp(env.params);
    return;
  }
  // QA / dev autologin: ?dev=1&user=nook&pass=1234
  const u = env.params.get('user'), pw = env.params.get('pass');
  if (env.dev && u && pw) {
    try { const r = await login(u, pw, env.params.get('lineage') || 'bkk'); session.token = r.token; await startGame(r.profile); return; }
    catch (err) { showGate(err.message); return; }
  }
  if (session.token && formAllowed) {
    try { const { profile } = await fetchMe(); await startGame(profile); return; }
    catch { session.token = null; }
  }
  showGate();
}

boot();

export { resolveMood };
