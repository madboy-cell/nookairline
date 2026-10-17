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
import { TownHallScene, getTownHallConfig } from './town_hall_scene.js';
import { TownHallRadar } from './town_hall_radar.js';
import { HallOfFameUI } from './hall_of_fame_ui.js';
import { expToNext } from '/shared/progression.js';
import {
  CORE, WONDERS, DECOR, MOODS, EXPANSION_TIERS, BLUEPRINT_CARDS, MAX_CORE_LV, MAX_CASTLE_LV, CORE_LANDMARKS,
  castleUpgradeCost, castlePrereq, placeable, buildingCaps,
} from '/shared/catalog_landmarks.js';
import { harvestPreview, storageCapHrs, comfortBonusPct, islandOf, findPlaced, utcDay } from '/shared/village_rules.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n >= 100000 ? `${(n / 1000).toFixed(1)}K` : Number(n || 0).toLocaleString('en-US'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOOD_ICON = { auto: '🔄', sunny: '☀️', sakura: '🌸', sunset: '🌅', night: '🌙' };
const MOOD_NAME = { auto: 'Auto', sunny: 'Sunny', sakura: 'Sakura', sunset: 'Sunset', night: 'Night' };

let world = null;
let net = null;
let editor = null;
let fishing = null;
let rpg = null;
let mono = null;            // Step 4: Table Hub + Sky Monopoly bridge (rebuilt with every socket session)
let townHallScene = null;
let radar = null;
let hallOfFameUI = null;
let casinoUI = null;
let voiceClient = null;
let cheerTimer = null;
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
  const eqOut = p.equipped?.outfit?.id || (typeof p.equipped?.outfit === 'string' ? p.equipped.outfit : null);
  const avaSpr = eqOut && eqOut !== 'newbie_outfit' ? `${p.lineage}_${eqOut}_front` : `${p.lineage}_base_front`;
  const isGirl = p.appearance?.body === 'girl' || (!p.appearance?.body && p.lineage === 'dxb');
  const hairId = p.appearance?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  const hudAvaEl = $('hud-avatar');
  if (hudAvaEl) {
    hudAvaEl.style.backgroundImage = 'none';
    hudAvaEl.innerHTML = `<img class="hud-ava-body" src="/assets/chibi/${avaSpr}.png" alt="" /><img class="hud-ava-hair" src="/assets/chibi/${hairId}_front.png" alt="" />`;
  }
  const couplePill = $('hud-couple-pill');
  if (couplePill) {
    couplePill.innerHTML = S.coupled || p.partner_id
      ? '💚 Sky Kingdom Online • <b>+15% Couple Yield</b>'
      : '💚 Sky Kingdom Online • <b>+15% Couple Yield</b>';
  }
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

async function setMoodTo(next) {
  if (!MOODS.includes(next)) return;
  if (S.profile?.village) S.profile.village.mood = next;
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
function openModal(title, body, actions = [], onMount = null) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  const box = $('modal-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `btn-gold small${a.cls ? ` ${a.cls}` : ''}`;
    b.innerHTML = a.label;
    b.disabled = !!a.disabled;
    b.onclick = async () => { b.disabled = true; const keep = await a.onClick?.(); if (!keep) closeModal(); else b.disabled = false; };
    box.appendChild(b);
  }
  $('modal').hidden = false;
  onMount?.($('modal-body'));
}
function closeModal() { $('modal').hidden = true; }

/** Mockup 03: VIP Wonder Card & Village Atmosphere Selector */
function wonderMoodModal(focusWonderType = null) {
  const p = S.profile;
  if (!p?.village) return;
  const v = p.village;
  const curMood = v.mood || 'auto';
  const placedWonders = v.buildings.filter((b) => WONDERS[b.type]);
  const hasFountain = v.buildings.some((b) => b.type === 'wnd_fountain');
  const hasOnsen = v.buildings.find((b) => b.type === 'wnd_onsen');
  const blacksmithActive = (p.buffs?.blacksmith?.until || 0) > serverNow();

  const wonderRowsHtml = placedWonders.length
    ? placedWonders.map((b) => {
      const wd = WONDERS[b.type];
      const stars = v.wonders?.[b.type]?.stars || 1;
      const hi = focusWonderType === b.type ? ' style="border-color:#e09b22;background:#fff8df;"' : '';
      return `<div class="wnd-buff-row"${hi}>
        <img src="/assets/village/${wd.sprite}.png" alt="" />
        <div>
          <div style="font-weight:900;color:#3a2415;">${wd.name} <span style="color:#d68008;">${'★'.repeat(stars)}</span></div>
          <div style="color:#6e4119;font-size:10px;">${wd.effect}</div>
        </div>
      </div>`;
    }).join('')
    : `<div class="wnd-buff-row"><div><b>No VIP Wonders placed yet</b><div style="font-size:10px;color:#6e4119;">Open Grid Editor or Box 2 Architect Gacha to place Wonders!</div></div></div>`;

  const body = `
    <div class="wnd-hub-grid">
      <div class="wnd-fountain-box">
        <div style="font-weight:900;font-size:11px;color:#4a2a10;">⛲ Daily Fountain Wish</div>
        <img src="/assets/village/wnd_fountain.png" alt="Fountain" />
        <div style="font-size:10px;color:#6e4119;line-height:1.2;">Toss <b>100 🪙</b> daily for <b>+10–50 💎</b> or <b>1× Ticket 🎟️</b>!</div>
        <button type="button" id="wnd-modal-toss" class="btn-gold small" style="padding:6px 8px;font-size:11px;margin-top:2px;" ${hasFountain ? '' : 'disabled'}>
          ${hasFountain ? '🪙 Toss 100 Gold!' : '📍 Place Fountain First'}
        </button>
      </div>
      <div class="wnd-buffs-box">
        <div style="font-weight:900;font-size:11px;color:#4a2a10;">✨ Active Island Wonders (${placedWonders.length})</div>
        ${wonderRowsHtml}
        ${hasOnsen ? `<button type="button" id="wnd-modal-onsen" class="btn-gold small emerald" style="padding:5px 8px;font-size:10.5px;margin-top:2px;">
          ♨️ ${blacksmithActive ? 'Hot Spring Buff Active! ✨' : 'Drop Chibi in Onsen (+Forge%)'}
        </button>` : ''}
      </div>
    </div>
    <div class="mood-strip-box">
      <div class="mood-strip-lbl">🎨 Village Mood &amp; Sky Lighting</div>
      <div class="mood-pills-row">
        ${MOODS.map((m) => `
          <button type="button" class="mood-pill-btn${curMood === m ? ' active' : ''}" data-pick-mood="${m}">
            <span class="m-ico">${MOOD_ICON[m]}</span>
            <span>${MOOD_NAME[m]}${curMood === m ? ' ✓' : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  openModal('⛲✨ VIP Wonders & Village Mood', body, [
    { label: '🏡 Edit Grid / Place Wonders', cls: 'secondary', onClick: () => { enterEdit(); } },
    { label: '✓ Done', onClick: () => {} },
  ], (root) => {
    const tossBtn = root.querySelector('#wnd-modal-toss');
    if (tossBtn && hasFountain) {
      tossBtn.onclick = async () => {
        tossBtn.disabled = true;
        await tossCoin(p.id);
      };
    }
    const onsenBtn = root.querySelector('#wnd-modal-onsen');
    if (onsenBtn && hasOnsen) {
      onsenBtn.onclick = () => {
        closeModal();
        const hit = findPlaced(world.layout, hasOnsen.uid, world.local?.x || 0, world.local?.z || 0);
        if (hit && world.local) {
          world.setLocalPosition(hit.center.x, hit.center.z + 0.35);
          net.send({ type: 'chibi_pickup_drop', targetId: p.id, x: +hit.center.x.toFixed(3), z: +(hit.center.z + 0.35).toFixed(3), propId: hasOnsen.uid });
        }
      };
    }
    root.querySelectorAll('[data-pick-mood]').forEach((btn) => {
      btn.onclick = async () => {
        const m = btn.dataset.pickMood;
        await setMoodTo(m);
        root.querySelectorAll('[data-pick-mood]').forEach((b) => {
          const act = b.dataset.pickMood === m;
          b.classList.toggle('active', act);
          const spans = b.querySelectorAll('span');
          if (spans[1]) spans[1].textContent = `${MOOD_NAME[b.dataset.pickMood]}${act ? ' ✓' : ''}`;
        });
      };
    });
  });
}

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
  let badgeTag = `${d.w}×${d.h} Grid`;
  let levelTag = '';
  let progressBarHtml = '';

  if (b.type === 'castle') {
    const next = v.castle_lv + 1;
    const sum = CORE_LANDMARKS.reduce((s, k) => s + (v.levels?.[k] || 1), 0);
    const caps = buildingCaps(v.castle_lv);
    levelTag = `👑 Lv. ${v.castle_lv}`;
    rows.push(['All-Building Yield', `+${v.castle_lv * 2}%`], ['Comfort Score', `🌸 ${fmt(v.comfort)} (+${comfortBonusPct(v.comfort)}%)`],
      ['Placement Cap', `${caps.core} Landmarks • ${caps.wonders} Wonders`], ['Island Territory', `${v.grid_size}×${v.grid_size} Tiles`]);
    if (mine && next <= MAX_CASTLE_LV) {
      const needSum = castlePrereq(next);
      const pct = Math.min(100, Math.round((sum / Math.max(1, needSum)) * 100));
      progressBarHtml = `
        <div class="bld-bp-bar">
          <div class="bld-bp-fill${sum >= needSum ? ' ready' : ''}" style="width:${pct}%"></div>
          <div class="bld-bp-txt">🏛️ Landmark Levels: ${sum} / ${needSum}</div>
        </div>`;
      rows.push([`Upgrade to Lv. ${next}`, `${fmt(castleUpgradeCost(next))} 🪙`]);
      actions.push({ label: `⬆️ Upgrade (${fmt(castleUpgradeCost(next))} 🪙)`, cls: 'emerald', disabled: p.gold < castleUpgradeCost(next) || sum < needSum, onClick: () => upgrade('castle') });
    }
  } else if (CORE[b.type]) {
    const lv = v.levels?.[b.type] || 1;
    levelTag = `⭐ Lv. ${lv}`;
    if (d.produces) rows.push(['Hourly Production', `${fmt(d.perHour(lv))} ${d.produces === 'gold' ? '🪙' : '🍓'}/hr`]);
    if (d.daily) rows.push(['Daily Diamonds', `${d.perDay(lv)} 💎/day`]);
    if (b.type === 'nest') rows.push(['Mythic/Epic Trait Odds', `${d.traitOdds(lv).toFixed(2)}x`]);
    if (b.type === 'dock') rows.push(['Offline Storage Cap', `${storageCapHrs(v, mine ? p : {}).toFixed(1)} h`], ['Co-Op Fishing', 'Walk onto the dock and tap 🎣']);
    if (b.type === 'patisserie') rows.push(['Post-Match Gold', `+${d.matchGoldPct(lv)}%`]);
    if (b.type === 'shrine') rows.push(['1-Tap Warp to Town Hall', 'Unlocks in Step 5']);
    if (mine) {
      const cards = v.blueprints?.[b.type] | 0;
      if (lv < MAX_CORE_LV) {
        const need = BLUEPRINT_CARDS[lv];
        const pct = Math.min(100, Math.round((cards / Math.max(1, need)) * 100));
        progressBarHtml = `
          <div class="bld-bp-bar">
            <div class="bld-bp-fill${cards >= need ? ' ready' : ''}" style="width:${pct}%"></div>
            <div class="bld-bp-txt">📘 Blueprints: ${cards} / ${need}</div>
          </div>`;
        actions.push({ label: `⬆️ Upgrade to Lv.${lv + 1}!`, cls: 'emerald', disabled: cards < need, onClick: () => upgrade(b.type) });
      } else {
        levelTag = '👑 MAX Lv.10';
      }
    }
  } else if (WONDERS[b.type]) {
    const stars = v.wonders?.[b.type]?.stars || 1;
    levelTag = '★'.repeat(stars);
    rows.push(['VIP Wonder Buff', d.effect], ['Comfort Bonus', `+${stars * 300} 🌸`]);
    if (b.type === 'wnd_fountain') actions.push({ label: '⛲ Toss 100 🪙', cls: 'emerald', onClick: () => tossCoin(pick.owner) });
    if (b.type === 'wnd_onsen' && mine) {
      actions.push({
        label: '♨️ Soak Chibi (+Forge%)',
        cls: 'emerald',
        onClick: () => {
          const hit = findPlaced(world.layout, b.uid, world.local?.x || 0, world.local?.z || 0);
          if (hit && world.local) {
            world.setLocalPosition(hit.center.x, hit.center.z + 0.35);
            net.send({ type: 'chibi_pickup_drop', targetId: p.id, x: +hit.center.x.toFixed(3), z: +(hit.center.z + 0.35).toFixed(3), propId: b.uid });
          }
        },
      });
    }
    if (mine) actions.push({ label: '✨ All Wonders & Mood', cls: 'secondary', onClick: () => { wonderMoodModal(b.type); return true; } });
  } else if (DECOR[b.type]) {
    levelTag = '🌸 Cute Decor';
    rows.push(['Passive Buff', d.effect], ['Comfort Bonus', '+120 🌸 (1st copy)']);
    if (d.seats) rows.push(['Interactive Seat', `Drop your Chibi onto it to sit (${d.seats} seats) 🪑`]);
  }

  if (mine) {
    actions.push({ label: '🔨 Quick Move', onClick: () => { enterQuickMove(b.uid); } });
    actions.push({ label: '🛠️ Grid Editor', cls: 'secondary', onClick: () => { enterEdit(b.uid); } });
  }

  const body = `
    <div class="bld-card-hero">
      <img src="/assets/village/${d.sprite}.png" alt="${d.name}" />
      <div class="bld-card-meta">
        <div class="bld-card-badges">
          <span class="bld-pill">${badgeTag}</span>
          ${levelTag ? `<span class="bld-pill gold">${levelTag}</span>` : ''}
          ${!mine ? `<span class="bld-pill">🏝️ ${pick.owner}'s Island</span>` : ''}
        </div>
        <div style="font-size:11.5px;color:#5c3416;font-weight:800;">${d.effect || 'Sky Kingdom Landmark'}</div>
        ${progressBarHtml}
      </div>
    </div>
    <div class="rows">${rows.map(([k, val]) => `<span>${k}</span><b>${val}</b>`).join('')}</div>
  `;
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
  [{ label: `☁️ Clear Clouds (${fmt(next.gold)} 🪙)`, cls: 'emerald', disabled: !ok, onClick: async () => { const r = await request('village_expand_cloud'); toast(r.ok ? `☁️ Your kingdom grew to ${r.grid_size}×${r.grid_size}!` : `☁️ ${humanError(r.error)}`); } }]);
}

function welcomeBack(off) {
  const h = Math.floor(off.awayMs / 3600_000), m = Math.floor((off.awayMs % 3600_000) / 60_000);
  const rewards = [];
  if (off.gold) rewards.push(`<span>🪙 +${fmt(off.gold)}</span>`);
  if (off.berries) rewards.push(`<span>🍓 +${fmt(off.berries)}</span>`);
  if (off.diamonds) rewards.push(`<span>💎 +${off.diamonds}</span>`);
  openModal('⏳ Welcome Back!', `<div>While you were resting (<b>${h}h ${m}m</b>), your Sky Kingdom produced:</div>`
    + `<div class="rewards">${rewards.join('')}</div><div class="hint-small">🐢 Storage cap: ${off.capHrs.toFixed(1)} h${off.full ? ' — storage was full!' : ''}</div>`,
  [{ label: '🍓 HARVEST ALL (+15 EXP)', cls: 'emerald', onClick: () => harvestAll() }]);
}

// ------------------------------------------------------------------ editor (Dual-Flow: Quick-Move + Full Grid Editor)
function enterQuickMove(uid) {
  closeModal();
  if (!editor) return;
  if (editor.active && !editor.quickMode) {
    editor.selected = uid;
    editor.focusOnBuilding(uid);
    editor.refresh();
    return;
  }
  $('hud').dataset.scene = 'VILLAGE';
  world.setEditMode(false);
  editor.open({ quickUid: uid });
}

function enterEdit(selectUid = null) {
  closeModal();
  if (!editor) return;
  $('hud').dataset.scene = 'VILLAGE_EDIT';
  world.setEditMode(true);
  editor.open({ selectUid });
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
    townHallScene = new TownHallScene({ world, onAction: (act) => handleTownHallAction(act) });
    world.townHallScene = townHallScene;
    world.onLandmarksCheck = (x, z) => townHallScene.checkTrigger(x, z);
    radar = new TownHallRadar({ world, getProfile: () => S.profile, landmarks: getTownHallConfig().LANDMARKS });
    hallOfFameUI = new HallOfFameUI({ request: (t, p) => request(t, p), toast, humanError, getProfile: () => S.profile, rpg });
    window.__neora = { world, debug: () => world.debugState(), request: (t, p) => request(t, p), state: S, rpg, townHallScene, radar, hallOfFameUI };
    trackSpeech();
    setInterval(tickVillage, 1000);
    $('act-harvest').onclick = harvestAll;
    $('act-edit').onclick = () => enterEdit();
    $('act-mood').onclick = () => wonderMoodModal();
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
    world.onLongPressBuilding = (pk) => { enterQuickMove(pk.uid); return true; };
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

  // Route incoming socket messages to CasinoUI + VoiceCallClient first
  const origEmit = net.emit.bind(net);
  net.emit = (type, detail) => {
    if (detail && typeof detail === 'object') {
      if (casinoUI?.handle?.(detail)) return;
      if (voiceClient?.handle?.(detail)) return;
    }
    origEmit(type, detail);
  };

  // Guarded dynamic imports for CasinoUI and VoiceCallClient
  import('./minigames/casino/casino_ui.js')
    .then(({ CasinoUI }) => {
      casinoUI = new CasinoUI({
        net,
        getProfile: () => S.profile,
        toast,
        onExit: () => {
          if (world) world.activeScene = null;
          $('hud').hidden = false;
          setActiveDock('village');
        },
      });
      if (mono?.hub) {
        mono.hub.onCasinoStart = (table) => casinoUI?.open(table);
      }
    })
    .catch(() => {});

  import('./voice_call_client.js')
    .then(({ VoiceCallClient }) => {
      voiceClient = new VoiceCallClient({
        net,
        getProfile: () => S.profile,
        toast,
        getUserName: (id) => {
          if (id === S.profile?.id) return S.profile.username;
          const r = world?.remotes.get(id);
          return r?.data?.username || id;
        },
      });
    })
    .catch(() => {});

  editor = editor || new GridEditor(world.plaza, {
    onSave: (layout) => request('village_save_grid', { layout }),
    onExit: (saved) => { exitEdit(); if (saved) toast('✅ Layout saved!'); },
    onPromoteToFull: () => { $('hud').dataset.scene = 'VILLAGE_EDIT'; world.setEditMode(true); },
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
      if (m.layout?.kind === 'townhall') {
        world.setTownHallMode(true, m.layout);
        radar?.setActive(true);
        setActiveDock('townhall');
      } else {
        world.setTownHallMode(false);
        world.plaza.setLayout(m.layout, m.profile.id);
        radar?.setActive(false);
        setActiveDock('village');
      }
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
      if (m.layout?.kind === 'townhall') {
        world.setTownHallMode(true, m.layout);
        radar?.setActive(true);
        setActiveDock('townhall');
      } else if (m.layout) {
        world.setTownHallMode(false);
        world.plaza.setLayout(m.layout, S.profile.id);
        radar?.setActive(false);
        setActiveDock('village');
      }
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
    .on('global_cheer_banner', (m) => showGlobalCheerBanner(m))
    .on('owl_mail_arrived', (m) => {
      if (m.mail && S.profile) {
        S.profile.mailbox = [m.mail, ...(S.profile.mailbox || [])];
      }
      toast(`🦉 Royal Owl arrived with a gift from ${m.mail?.fromName || 'a friend'}!`, 3000);
      rpg?.render();
    })
    .on('couple_streak_update', (m) => {
      if (S.profile) {
        S.profile.couple_streak = m.streak;
      }
      toast(`💖 Couple Streak Updated: ${m.streak} Days! 🎉`, 3000);
      rpg?.render();
    })
    .on('call_incoming', (m) => voiceClient?.handle?.(m))
    .on('call_ringing', (m) => voiceClient?.handle?.(m))
    .on('call_connected', (m) => voiceClient?.handle?.(m))
    .on('call_ended', (m) => voiceClient?.handle?.(m))
    .on('call_signal', (m) => voiceClient?.handle?.(m))
    .on('call_busy', (m) => voiceClient?.handle?.(m))
    .on('call_reward', (m) => voiceClient?.handle?.(m))
    .on('couple_egg_hatched', (m) => toast(`🥚💞 ${m.by} hatched a Rainbow Couple Egg with your pet!`, 3000))
    .on('resume_ok', (m) => {
      S.serverOffset = m.serverNow - Date.now();
      if (m.layout?.kind === 'townhall') {
        world.setTownHallMode(true, m.layout);
        radar?.setActive(true);
        setActiveDock('townhall');
      } else {
        world.setTownHallMode(false);
        world.plaza.setLayout(m.layout, m.profile.id);
        radar?.setActive(false);
        setActiveDock('village');
      }
      S.layoutKey = '';
      renderHud(m.profile);
      world.syncPetGiftAndYard(m.profile);
    })
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
function setActiveDock(dockName) {
  document.querySelectorAll('#bottom-dock .dock-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.dock === dockName);
  });
}

function setupMonopoly(profile) {
  mono?.destroy();
  if (world) world.activeScene = null;
  $('hud').hidden = false;
  mono = new MonopolyBridge({
    container: $('app'),
    renderer: world.renderer,
    room: new NetRoom({ net, userId: profile.id }),
    toast,
    onExit: () => { if (world) world.activeScene = null; $('hud').hidden = false; setActiveDock('village'); },
    // the board takes over the shared canvas (village paused) and the village HUD hides while playing
    onEnterMatch: (b) => { world.activeScene = b; $('hud').hidden = true; },
    onLeaveMatch: () => { world.activeScene = null; $('hud').hidden = false; setActiveDock('play'); },
  });
  window.__neora && (window.__neora.mono = mono);
}

function openPlayHub() {
  if (!mono || editor?.active) return;
  closeModal();
  rpg?.close?.();
  setActiveDock('play');
  mono.openHub();
}

function showGlobalCheerBanner(m) {
  const el = $('global-cheer-banner');
  if (!el) return;
  if (cheerTimer) {
    clearInterval(cheerTimer);
    cheerTimer = null;
  }

  const expiresAt = m.expiresAt || (serverNow() + 10000);
  const updateTimer = () => {
    const rem = Math.max(0, Math.ceil((expiresAt - serverNow()) / 1000));
    const timerSpan = el.querySelector('.cheer-timer');
    if (timerSpan) timerSpan.textContent = `${rem}s`;
    if (rem <= 0) {
      clearInterval(cheerTimer);
      cheerTimer = null;
      el.hidden = true;
    }
  };

  el.hidden = false;
  el.innerHTML = `
    <div class="cheer-info">
      <div class="cheer-title">🎉 SERVER JACKPOT: ${esc(m.winnerName)}!</div>
      <div class="cheer-sub">${esc(m.achievement)} • <span class="cheer-timer">${Math.max(0, Math.ceil((expiresAt - serverNow()) / 1000))}s</span></div>
    </div>
    <button type="button" class="btn-gold small cheer-claim-btn" data-act="cheer-claim" data-cheer-id="${esc(m.cheerId)}">
      👏 Cheer (+50 🪙 Free!)
    </button>
  `;

  cheerTimer = setInterval(updateTimer, 500);
}

function handleTownHallAction(action) {
  if (editor?.active) return;
  closeModal();
  if (action === 'fountain') {
    mono?.hub?.close({ leave: true });
    setActiveDock('gacha');
    rpg?.open('gacha', { tab: 'box1' });
  } else if (action && action.startsWith('statue_')) {
    hallOfFameUI?.open(action);
  } else if (action === 'casino_palace') {
    closeModal();
    rpg?.close?.();
    setActiveDock('play');
    if (mono?.hub) {
      mono.hub.mode = 'casino';
      mono.openHub();
    } else {
      openPlayHub();
    }
  } else if (action === 'monopoly_arch') {
    closeModal();
    rpg?.close?.();
    setActiveDock('play');
    if (mono?.hub) {
      mono.hub.mode = 'monopoly';
      mono.openHub();
    } else {
      openPlayHub();
    }
  } else if (action === 'forge') {
    mono?.hub?.close({ leave: true });
    rpg?.open('forge');
  } else if (action === 'owl_postbox') {
    mono?.hub?.close({ leave: true });
    setActiveDock('wardrobe');
    rpg?.open('wardrobe');
    setTimeout(() => {
      document.querySelector('#owl-inbox')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } else if (action && action.startsWith('vip_table_')) {
    openPlayHub();
  }
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
  document.querySelector('.dock-btn[data-dock="village"]')?.addEventListener('click', () => {
    if (editor?.active) editor.close(true);
    closeModal();
    rpg?.close?.();
    mono?.hub?.close({ leave: true });
    setActiveDock('village');
    net?.send({ type: 'instance_switch', to: 'home' });
  });
  document.querySelector('.dock-btn[data-dock="townhall"]')?.addEventListener('click', () => {
    if (editor?.active) editor.close(true);
    closeModal();
    rpg?.close?.();
    mono?.hub?.close({ leave: true });
    setActiveDock('townhall');
    net?.send({ type: 'instance_switch', to: 'townhall' });
  });
  document.querySelectorAll('.dock-btn[data-step]').forEach((b) => b.addEventListener('click', () =>
    toast(`${b.textContent.trim()} unlocks in Step ${b.dataset.step} 🔒`)));
  document.addEventListener('click', async (e) => {
    const cheerBtn = e.target.closest('[data-act="cheer-claim"]');
    if (cheerBtn) {
      const cheerId = cheerBtn.dataset.cheerId;
      cheerBtn.disabled = true;
      try {
        const res = await request('cheer_claim', { cheerId });
        if (res && res.ok) {
          toast(`👏 Cheered for the champion! +${res.gold || 50} 🪙 Free!`);
          cheerBtn.textContent = 'Cheered! ✅';
        } else {
          toast(`⚠️ ${humanError(res?.error || 'cheer_expired')}`);
          cheerBtn.disabled = false;
        }
      } catch (err) {
        toast(`⚠️ ${err.message}`);
        cheerBtn.disabled = false;
      }
    }
  });
  document.querySelector('.dock-btn[data-dock="play"]')?.addEventListener('click', openPlayHub);
  document.querySelector('.dock-btn[data-dock="wardrobe"]')?.addEventListener('click', () => {
    if (editor?.active) return;
    closeModal();
    mono?.hub?.close({ leave: true });
    setActiveDock('wardrobe');
    rpg?.open('wardrobe');
  });
  document.querySelector('.dock-btn[data-dock="gacha"]')?.addEventListener('click', () => {
    if (editor?.active) return;
    closeModal();
    mono?.hub?.close({ leave: true });
    setActiveDock('gacha');
    rpg?.open('gacha', { tab: 'box1' });
  });
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
