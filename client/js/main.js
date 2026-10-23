// client/js/main.js — boot: gate → sign-in → world + realtime session.
// Step 2: village HUD (Harvest All + bubbles, Edit Grid, mood, couple blessing, Wonder actions),
// building / upgrade / Cloud Territory / Welcome-Back modals, Finger Pick-Up & Drop and Dock fishing.
import { WorldEngine } from './world_engine.js?v=sf3';
import { loadManifest } from './assets.js';
import { Net, session, login, fetchMe, claimA2HS, logoutApi, bindEmailApi, changePasswordApi } from './net.js?v=nm18';
import { env, initGate, registerServiceWorker } from './pwa_gate.js?v=id4';
import { GridEditor, humanError, resolveMood } from './village_plaza.js?v=tos4';
import { DockFishing } from './minigames/dock_fishing.js';
import { RpgUI } from './gacha_forge_ui.js?v=wd6';
import { renderOutfitThumbLayers } from './ui_components.js?v=wd6';


import { MonopolyBridge } from './monopoly_bridge.js?v=nm20';
import { NetRoom } from './minigames/monopoly_25d/room_client.js';
import { TownHallScene, getTownHallConfig } from './town_hall_scene.js?v=cd44';
import { NookMuseumScene, MUSEUM_SCENERY_PORTALS } from './nook_museum_scene.js?v=nm19';
import { TownHallRadar } from './town_hall_radar.js?v=nm5';
import { HallOfFameUI } from './hall_of_fame_ui.js';
import { CouplePhotoboothUI } from './couple_photobooth.js?v=nm18';
import { SkyFrontierScene } from './frontier/sky_frontier_scene.js?v=sf6';
import { BasecampUI } from './basecamp_ui.js?v=tos7';
import { HeartIsleUI } from './heart_isle_ui.js?v=hi1';
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
let basecampUI = null;      // Stage 3 Base Camp panels (story / build / production / orders / storage)
let mono = null;            // Step 4: Table Hub + Sky Monopoly bridge (rebuilt with every socket session)
let townHallScene = null;
let nookMuseumScene = null;
let radar = null;
let hallOfFameUI = null;
let couplePhotobooth = null;
let casinoUI = null;
let pendingCasinoTable = null;
let pendingCasinoMsg = null;
let moonDefenseUI = null;
let pendingMoonTable = null;
let pendingMoonMsg = null;
let cloudDashUI = null;
let pendingCdTable = null;
let pendingCdMsg = null;
let voiceClient = null;
let cheerTimer = null;
let selectedLineage = 'bkk';
let selectedHairColor = 'chestnut';
let toastTimer = 0;
const S = { profile: null, coupled: false, visitingOwner: null, partnerCompanion: null, serverOffset: 0, pending: new Map(), reqId: 0, layoutKey: '' };
const serverNow = () => Date.now() + S.serverOffset;

export function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function renderHud(p) {
  if (!p) return;
  S.profile = p;
  S.coupled = !!p.partner_id;
  $('hud-name').textContent = p.username;
  $('hud-level').textContent = `Lv. ${p.level}`;
  $('hud-cp').textContent = Number(p.cp || 0).toLocaleString('en-US');
  $('hud-gold').textContent = fmt(p.gold);
  $('hud-berries').textContent = fmt(p.berries);
  $('hud-diamonds').textContent = fmt(p.diamonds);
  const need = expToNext(p.level);
  $('hud-exp').style.width = `${Number.isFinite(need) ? Math.min(100, (p.exp / need) * 100) : 100}%`;
  const eqOut = p.equipped?.outfit?.id || (typeof p.equipped?.outfit === 'string' ? p.equipped.outfit : null);
  const hudAvaEl = $('hud-avatar');
  if (hudAvaEl) {
    hudAvaEl.style.backgroundImage = 'none';
    hudAvaEl.innerHTML = renderOutfitThumbLayers(eqOut || 'newbie_outfit', {
      lineage: p.lineage,
      appearance: p.appearance,
      headCrop: true,
    });
  }
  const acctBadge = $('hud-account-badge');
  if (acctBadge) {
    acctBadge.classList.toggle('has-dot', !p.email);
    acctBadge.title = p.email ? `Bound: ${p.email}` : 'Account & Settings • Bind Gmail (+100 💎)';
  }
  const couplePill = $('hud-couple-pill');
  if (couplePill) {
    const reqCount = (p.friend_requests_in?.length || 0) + (p.couple_requests_in?.length || 0);
    const reqBadge = reqCount > 0 ? ` <span style="background:#ef4444;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:900;">${reqCount}</span>` : '';
    if (S.visitingOwner && S.visitingOwner !== p.id) {
      couplePill.innerHTML = `🏝️ Visiting <b>${esc(S.visitingOwner)}</b> • Tap 🏡 Village to return${reqBadge}`;
    } else if (p.partner_id) {
      couplePill.innerHTML = `💞 Bound with <b>${esc(p.partner_id)}</b> • <b>+${p.couple_streak || 1}d Streak</b>${reqBadge}`;
    } else {
      couplePill.innerHTML = `💞 Couple &amp; Friends Hub • <b>${(p.friends || []).length} Friends</b>${reqBadge}`;
    }
  }
  fishing?.setProfile(p);
  syncSelfVillage();
  tickVillage();
}

function villageBadgeState(v, now) {
  if (!v) return '';
  const plotBits = Object.entries(v.plots || {}).map(([u, pl]) => `${u}:${pl?.crop || ''}:${pl?.crop ? (Number(pl.readyAt || 0) <= now ? 'R' : 'G') : 'E'}`);
  const prodBits = Object.entries(v.production || {}).map(([u, st]) => {
    const out = Object.values(st?.output || {}).some((n) => n > 0) || (st?.tools || []).length > 0 || (st?.queue || []).some((j) => Number(j?.doneAt || 0) <= now);
    const run = (st?.queue || []).some((j) => Number(j?.doneAt || 0) > now);
    return `${u}:${out ? 'R' : run ? 'W' : 'I'}`;
  });
  return `${plotBits.join(',')}|${prodBits.join(',')}`;
}

/** Keep the renderer's copy of MY island = my authoritative profile.village (full data, incl. bag). */
function syncSelfVillage() {
  const p = S.profile;
  if (!world?.layout || !p?.village || editor?.active || world.layout?.kind === 'townhall' || world.layout?.kind === 'museum' || !Array.isArray(world.layout?.islands)) return;
  const isl = islandOf(world.layout, p.id);
  if (!isl) return;
  const v = p.village;
  const key = JSON.stringify([v.grid_size, v.castle_lv, !!v.castle_ruins, v.ground, v.buildings, v.tiles, v.levels, v.wonders, villageBadgeState(v, serverNow())]);
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
  try {
    closeModal();
    rpg?.close?.();
    hallOfFameUI?.close?.();
    voiceClient?.closeSwitchboard?.();
    casinoUI?.close?.();
    mono?.hub?.close?.();
    mono?.stopMatchView?.();
  } catch {}
  if (message && $('a2hs-card') && $('login-form')) {
    $('a2hs-card').hidden = true;
    $('login-form').hidden = false;
  }
  if (S.profile?.username && $('login-user') && !$('login-user').value) {
    $('login-user').value = S.profile.username;
    if (env.dev && $('login-pass') && !$('login-pass').value) $('login-pass').value = '1234';
  }
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

// ------------------------------------------------------------------ Sky Frontier routing (Master Plan v2 §2)
/** Server snapshot/auth/resume carried a `kind: 'sky_frontier'` layout → show the frontier scene. */
function applyFrontierLayout(layout, self) {
  if (!world) return;
  S.visitingOwner = null;
  $('hud').dataset.scene = 'SKY_FRONTIER';
  fishing?.setAvailable(false);
  radar?.setActive(false);
  world.serverOffset = S.serverOffset || 0;
  world.setFrontierMode(true, layout);
  if (S.profile?.frontier?.energy) world.frontierScene?.setEnergy?.(S.profile.frontier.energy);
  basecampUI?._renderFrontier?.();
  if (self && world.local) world.setLocalPosition(self.x, self.z);
  // resume into the same shard/region after a reconnect (server re-validates room + unlocks)
  if (net) net.resumeInstanceId = `frontier:${layout.shardId}~${layout.regionId}`;
}

function enterFrontier(regionId = null) {
  if (!net) return;
  const reg = typeof regionId === 'string' ? regionId.trim().toLowerCase() : '';
  const to = reg && reg !== 'meadow' ? `frontier:~${reg}` : 'frontier';
  net.send({ type: 'instance_switch', to, force: true });
}

function exitFrontier() {
  if (!world) return;
  world.setFrontierMode(false);
  $('hud').dataset.scene = 'VILLAGE';
  setActiveDock('village');
  world.setZoneSeq((world.zoneSeq || 1) + 1);
  if (net) {
    net.resumeInstanceId = null;
    net.send({ type: 'instance_switch', to: 'home', force: true });
  }
}

// ------------------------------------------------------------------ village & guide HUD tick (1 Hz)
let currentGuideAction = 'harvest';

function updateGuidePill() {
  const pill = $('hud-guide-pill');
  const txt = $('hud-guide-txt');
  const cta = $('hud-guide-cta');
  const p = S.profile;
  if (!pill || !txt || !cta || !p || !world) return;

  if (world.layout?.kind === 'townhall') {
    pill.classList.remove('quest-ready');
    currentGuideAction = 'sky_frontier';
    txt.textContent = '🏝️ Sky Frontier: Gather, craft & defend the Meadow!';
    cta.textContent = 'Explore ▸';
    return;
  }

  const q = basecampUI?.getQuestGuide?.(p);
  if (q?.active) {
    currentGuideAction = 'story_quest';
    pill.classList.toggle('quest-ready', !!q.complete);
    txt.textContent = q.text;
    cta.textContent = q.cta;
    return;
  }
  pill.classList.remove('quest-ready');

  const pv = p.village ? harvestPreview(p, serverNow(), { coupled: S.coupled }) : null;
  const harvestReady = pv && pv.ready && (pv.gold + pv.berries + pv.diamonds > 0);
  const eqPet = p.equipped?.pet;
  const ownedPet = (p.pets || []).find((x) => x.uid === eqPet?.uid || x.id === eqPet?.id);
  const petGiftReady = ownedPet && ownedPet.last_gift_day !== String(utcDay(serverNow()));

  if (harvestReady) {
    currentGuideAction = 'harvest';
    txt.textContent = '🌾 Crops & Gold ready! Tap to Harvest All';
    cta.textContent = 'Harvest ▸';
  } else if (petGiftReady) {
    currentGuideAction = 'pet_gift';
    txt.textContent = '🎁 Pet has a Daily Gift! Tap to collect';
    cta.textContent = 'Claim ▸';
  } else if (fishing && !fishing.available) {
    currentGuideAction = 'sky_frontier';
    txt.textContent = '🏝️ Explore the Sky Frontier or walk to Dock to Fish!';
    cta.textContent = 'Explore ▸';
  } else {
    currentGuideAction = 'townhall';
    txt.textContent = '🏛️ Visit Town Hall Sanctuary for Co-Op & Hall of Fame!';
    cta.textContent = 'Warp ▸';
  }
}

function runGuideAction() {
  if (currentGuideAction === 'story_quest') {
    basecampUI?.getQuestGuide?.(S.profile)?.run?.();
  } else if (currentGuideAction === 'harvest') {
    harvestAll();
  } else if (currentGuideAction === 'pet_gift') {
    world?.onPetTap?.();
  } else if (currentGuideAction === 'sky_frontier' || currentGuideAction === 'moon_defense') {
    closeModal();
    rpg?.close?.();
    enterFrontier();
  } else if (currentGuideAction === 'townhall') {
    if (editor?.active) editor.close(true);
    closeModal();
    rpg?.close?.();
    $('hud').dataset.scene = 'TOWN_HALL';
    fishing?.setAvailable(false);
    setActiveDock('townhall');
    if (net) net.resumeInstanceId = 'townhall';
    net?.send({ type: 'instance_switch', to: 'townhall' });
  }
}

function tickVillage() {
  const p = S.profile;
  syncSelfVillage();
  basecampUI?._refreshHud?.();
  updateGuidePill();
  if (!p?.village || !world?.layout || world.layout?.kind === 'townhall' || !Array.isArray(world.layout?.islands)) return;
  const hasOwnIsland = !!islandOf(world.layout, p.id);
  const visitingTarget = (S.visitingOwner && S.visitingOwner !== p.id)
    ? S.visitingOwner
    : (!hasOwnIsland ? world.layout.islands[0]?.owner : null);

  const btn = $('act-harvest');
  if (hasOwnIsland) {
    if ($('act-edit')) $('act-edit').hidden = false;
    if ($('act-mood')) $('act-mood').hidden = false;
    const pv = harvestPreview(p, serverNow(), { coupled: S.coupled });
    const anyPassive = pv.ready && (pv.gold + pv.berries + pv.diamonds > 0);
    const bcReady = basecampUI?.getReadySummary?.(p);
    const anyReady = anyPassive || !!bcReady?.anyReady;
    btn.hidden = !anyReady;
    btn.disabled = !anyReady;
    btn.classList.toggle('ready', anyReady);
    const bits = [];
    if (bcReady?.anyReady && bcReady.labelHtml) bits.push(bcReady.labelHtml);
    if (pv.gold) bits.push(`${fmt(pv.gold)} <img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt="">`);
    if (pv.berries) bits.push(`${fmt(pv.berries)} <img class="inline-curr-ico" src="/assets/ui/icon_berry.png" alt="">`);
    if (pv.diamonds) bits.push(`${pv.diamonds} <img class="inline-curr-ico" src="/assets/ui/icon_diamond.png" alt="">`);
    const nextSubHtml = bits.length ? bits.join(' ') : (pv.ready ? 'empty' : 'growing…');
    if ($('harvest-sub').innerHTML !== nextSubHtml) $('harvest-sub').innerHTML = nextSubHtml;
    if (!editor?.active) world.plaza.setBubbles(pv);
  } else {
    btn.hidden = true;
    if ($('act-edit')) $('act-edit').hidden = true;
    if ($('act-mood')) $('act-mood').hidden = true;
    world.plaza.setBubbles(null);
  }

  const blessBtn = $('act-bless');
  if (blessBtn) {
    const canBlessHere = !!(S.coupled || p.partner_id || visitingTarget);
    blessBtn.hidden = !canBlessHere;
    blessBtn.dataset.target = visitingTarget || p.partner_id || '';
  }

  // Fountain of 1,000 Wishes within reach (own or visited island)
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
  const bcReady = basecampUI?.getReadySummary?.(S.profile);
  const pv = S.profile ? harvestPreview(S.profile, serverNow(), { coupled: S.coupled }) : null;
  const anyPassive = Boolean(pv?.ready && (pv.gold + pv.berries + pv.diamonds > 0));
  if (bcReady?.anyReady) {
    await basecampUI.collectAllReady(S.profile);
    if (!anyPassive) {
      tickVillage();
      return;
    }
  }
  const r = await request('village_harvest_all');
  if (!r.ok) {
    if (!bcReady?.anyReady) toast(`🍓 ${humanError(r.error)}`);
    tickVillage();
    return;
  }
  const bits = [];
  if (r.gold) bits.push(`+${fmt(r.gold)} 🪙`);
  if (r.berries) bits.push(`+${fmt(r.berries)} 🍓`);
  if (r.diamonds) bits.push(`+${r.diamonds} 💎`);
  toast(`${r.jackpot ? '🌟 DOUBLE JACKPOT! ' : '✨ '}${bits.join('  ')}  • +${r.exp} EXP${r.levelsGained ? `  🎉 LEVEL UP! +${50 * r.levelsGained} 💎` : ''}`, 2600);
  const L = world.local;
  for (const b of world.plaza.bubbles) {
    if (!b.visible) continue;
    const fxName = b.userData.res === 'gold' ? 'fx_star' : b.userData.res === 'diamonds' ? 'fx_stardust' : 'fx_heart';
    world.fx.emit(fxName, b.position.x, b.position.y, b.position.z, 8, { speed: 2, up: 2.2, size: 0.3, life: 0.8, gravity: 2 });
    if (L && world.fx.emitTo) {
      world.fx.emitTo(fxName, b.position.x, b.position.y, b.position.z, L.x, 0.8, L.z, 6, { time: 0.5, arc: 1.25, size: 0.24, stagger: 0.03 });
    }
  }
  world.plaza.setBubbles(null);
  tickVillage();
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

async function bless(targetOverride = null) {
  const p = S.profile;
  const target = (typeof targetOverride === 'string' && targetOverride)
    ? targetOverride
    : ($('act-bless')?.dataset?.target || p?.partner_id || '');
  const payload = target && target !== p?.partner_id ? { target } : (target ? { target } : {});
  const r = await request('village_bless_partner', payload);
  const label = target ? `${target}'s` : "your partner's";
  toast(r.ok ? `💧 You blessed ${label} land! +15% yield for 12h • +${r.gold} 🪙` : `💧 ${humanError(r.error)}`);
  return r;
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

async function doLogout() {
  try { await logoutApi(); } catch {}
  session.token = null;
  try { net?.close(); } catch {}
  if (world) {
    world.activeScene = null;
    world.clearRemotes?.();
    world.removeLocal?.();
  }
  radar?.setActive?.(false);
  fishing?.close?.();
  fishing?.setAvailable?.(false);
  showGate('');
  toast('👋 Logged out safely — see you soon!', 2200);
}

/** Top-Left Avatar Card Modal: Royal Passport, Gmail Binding (+100 💎), Quick Settings & Log Out */
function openAccountModal({ editEmail = false, showPw = false } = {}) {
  const p = S.profile;
  if (!p) return;
  const need = expToNext(p.level);
  const expPct = Number.isFinite(need) ? Math.min(100, Math.round(((p.exp || 0) / Math.max(1, need)) * 100)) : 100;
  const eqOut = p.equipped?.outfit?.id || (typeof p.equipped?.outfit === 'string' ? p.equipped.outfit : null);
  const avaHtml = renderOutfitThumbLayers(eqOut || 'newbie_outfit', {
    lineage: p.lineage,
    appearance: p.appearance,
    headCrop: true,
  });
  const isBound = Boolean(p.email);
  const isMuted = localStorage.getItem('neora.mute') === '1';
  const isReducedMotion = localStorage.getItem('neora.reduced_motion') === '1';
  const titleLabel = p.title || (p.founder ? '👑 Sky Party Founder' : '⭐ Sky Sovereign');
  const diaIco = '<img class="inline-curr-ico" src="/assets/ui/icon_diamond.png" alt="">';

  const googleSvg = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"/>
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.8 8 22 12 22z"/>
    <path fill="#FBBC05" d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 8.9 2 10.4 2 12s.3 3.1.9 4.4l3.3-2.6z"/>
    <path fill="#4285F4" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8 2 4.6 4.2 2.9 7.6l3.3 2.6c.8-2.5 3.1-4.3 5.8-4.3z"/>
  </svg>`;

  const gmailBodyHtml = isBound && !editEmail
    ? `<div class="acct-bound-row">
        <div>
          <div class="acct-bound-email" id="acct-bound-email">📧 ${esc(p.email)}</div>
          <div class="acct-bound-sub">Account backed up • +100 💎 Bind Reward claimed</div>
        </div>
        <button type="button" class="acct-mini-btn" id="acct-email-change">Change</button>
      </div>`
    : `<div style="font-size:10.5px;color:#5c3416;margin-bottom:5px;font-weight:800;">
        ${p.email_reward_claimed ? 'Update your linked Gmail address for account recovery:' : `Bind your Gmail to protect your Sky Kingdom &amp; claim <b>+100 ${diaIco} Free</b>!`}
      </div>
      <div class="acct-email-row">
        <input id="acct-email-input" class="acct-input" type="email" maxlength="64" placeholder="${esc(p.username)}@gmail.com" value="${esc(p.email || `${p.username}@gmail.com`)}" autocomplete="email" />
        <button type="button" id="acct-email-bind-btn" class="btn-gold small emerald acct-bind-btn">
          ${p.email_reward_claimed ? '🔗 Save Gmail' : `🔗 Bind (+100 ${diaIco})`}
        </button>
      </div>`;

  const body = `
    <div class="bld-card-hero acct-hero-card">
      <div class="acct-ava-wrap">
        ${avaHtml}
        <span class="acct-lv-chip">Lv. ${p.level}</span>
      </div>
      <div class="bld-card-meta">
        <div class="acct-head-row">
          <div class="acct-uname">👑 ${esc(p.username)}</div>
          <button type="button" class="acct-uid-pill" id="acct-copy-id">ID: #${esc(p.id)} 📋</button>
        </div>
        <div class="bld-card-badges">
          <span class="bld-pill gold">${esc(titleLabel)}</span>
          <span class="bld-pill">⚔️ ${fmt(p.cp)} CP</span>
          <span class="bld-pill">${p.partner_id ? `💞 ${esc(p.partner_id)} (${p.couple_streak || 1}d)` : '🌱 Solo'}</span>
        </div>
        <div class="bld-bp-bar">
          <div class="bld-bp-fill ready" style="width:${expPct}%"></div>
          <div class="bld-bp-txt">✨ EXP: ${fmt(p.exp || 0)} / ${Number.isFinite(need) ? fmt(need) : 'MAX'} (${expPct}%)</div>
        </div>
      </div>
    </div>

    <div class="acct-gmail-card${isBound ? ' is-bound' : ''}" id="acct-gmail-card">
      <div class="acct-gmail-top">
        <div class="acct-gmail-brand">
          <span class="acct-g-ico">${googleSvg}</span>
          <span>Google / Gmail Account</span>
        </div>
        <span class="acct-status-pill ${isBound ? 'bound' : 'unbound'}" id="acct-bind-status">
          ${isBound ? '🟢 Bound &amp; Verified' : `🟠 Unbound • +100 ${diaIco}`}
        </span>
      </div>
      ${gmailBodyHtml}
    </div>

    <div class="acct-settings-grid">
      <button type="button" class="acct-set-tile ${!isMuted ? 'on' : ''}" id="acct-toggle-mute">
        <span class="acct-set-ico" id="acct-mute-ico">${isMuted ? '🔇' : '🔊'}</span>
        <span class="acct-set-meta">
          <span class="acct-set-lbl">Sound &amp; BGM</span>
          <span class="acct-set-val" id="acct-mute-val">${isMuted ? 'Muted' : 'ON (Stereo)'}</span>
        </span>
      </button>
      <button type="button" class="acct-set-tile ${!isReducedMotion ? 'on' : ''}" id="acct-toggle-motion">
        <span class="acct-set-ico" id="acct-motion-ico">${isReducedMotion ? '🌿' : '✨'}</span>
        <span class="acct-set-meta">
          <span class="acct-set-lbl">Motion &amp; FX</span>
          <span class="acct-set-val" id="acct-motion-val">${isReducedMotion ? 'Cozy Reduced' : '60 FPS Full'}</span>
        </span>
      </button>
      <button type="button" class="acct-set-tile" id="acct-toggle-pw">
        <span class="acct-set-ico">🔑</span>
        <span class="acct-set-meta">
          <span class="acct-set-lbl">Account Security</span>
          <span class="acct-set-val">Change PIN ▸</span>
        </span>
      </button>
      <button type="button" class="acct-set-tile" id="acct-open-founder">
        <span class="acct-set-ico">👑</span>
        <span class="acct-set-meta">
          <span class="acct-set-lbl">Veteran Perks</span>
          <span class="acct-set-val">${p.founder_claimed ? 'Founder Claimed ✅' : 'Founder Unbox ▸'}</span>
        </span>
      </button>
    </div>

    <div class="acct-pw-drawer" id="acct-pw-drawer" ${showPw ? '' : 'hidden'}>
      <div style="font-size:10.5px;font-weight:900;color:#4a2a10;">🔑 Update Account Password (4–64 chars)</div>
      <div class="acct-pw-grid">
        <input id="acct-pw-cur" class="acct-input" type="password" placeholder="Current PIN" maxlength="64" autocomplete="current-password" />
        <input id="acct-pw-new" class="acct-input" type="password" placeholder="New PIN" maxlength="64" autocomplete="new-password" />
        <button type="button" id="acct-pw-save" class="btn-gold small emerald acct-bind-btn">Save</button>
      </div>
    </div>
  `;

  openModal('🪪 Royal Passport & Account', body, [
    {
      label: '👗 Wardrobe',
      cls: 'secondary',
      onClick: () => {
        setActiveDock('wardrobe');
        rpg?.open('wardrobe');
      },
    },
    { label: '✓ Done', onClick: () => {} },
    {
      label: '🚪 Log Out',
      cls: 'crimson',
      onClick: async () => {
        await doLogout();
      },
    },
  ], (root) => {
    const copyBtn = root.querySelector('#acct-copy-id');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText?.(p.id).catch(() => {});
        toast(`📋 Copied Player ID #${p.id}!`, 1800);
      };
    }

    const changeEmailBtn = root.querySelector('#acct-email-change');
    if (changeEmailBtn) {
      changeEmailBtn.onclick = () => openAccountModal({ editEmail: true });
    }

    const bindBtn = root.querySelector('#acct-email-bind-btn');
    const emailInput = root.querySelector('#acct-email-input');
    if (bindBtn && emailInput) {
      const submitBind = async () => {
        const email = emailInput.value.trim().toLowerCase();
        if (!email) {
          toast('⚠️ Please enter your Gmail address.');
          return;
        }
        bindBtn.disabled = true;
        try {
          const r = await bindEmailApi(email);
          if (r?.profile) renderHud(r.profile);
          toast(r.granted ? `🎉 Gmail Bound (${r.email})! +${r.granted} 💎 Claimed!` : `✅ Linked Gmail updated to ${r.email}!`, 2800);
          openAccountModal({ editEmail: false });
        } catch (err) {
          toast(`⚠️ ${err.message || 'Could not bind Gmail'}`);
          bindBtn.disabled = false;
        }
      };
      bindBtn.onclick = submitBind;
      emailInput.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); submitBind(); }
      };
    }

    const muteBtn = root.querySelector('#acct-toggle-mute');
    if (muteBtn) {
      muteBtn.onclick = () => {
        const nextMute = localStorage.getItem('neora.mute') !== '1';
        localStorage.setItem('neora.mute', nextMute ? '1' : '0');
        window.__neoraMuted = nextMute;
        muteBtn.classList.toggle('on', !nextMute);
        root.querySelector('#acct-mute-ico').textContent = nextMute ? '🔇' : '🔊';
        root.querySelector('#acct-mute-val').textContent = nextMute ? 'Muted' : 'ON (Stereo)';
        toast(nextMute ? '🔇 Game audio muted' : '🔊 Game audio unmuted', 1600);
      };
    }

    const motionBtn = root.querySelector('#acct-toggle-motion');
    if (motionBtn) {
      motionBtn.onclick = () => {
        const nextRed = localStorage.getItem('neora.reduced_motion') !== '1';
        localStorage.setItem('neora.reduced_motion', nextRed ? '1' : '0');
        document.body.classList.toggle('rw-reduced', nextRed);
        motionBtn.classList.toggle('on', !nextRed);
        root.querySelector('#acct-motion-ico').textContent = nextRed ? '🌿' : '✨';
        root.querySelector('#acct-motion-val').textContent = nextRed ? 'Cozy Reduced' : '60 FPS Full';
        toast(nextRed ? '🌿 Cozy Reduced Motion enabled' : '✨ Full 60 FPS Motion FX enabled', 1600);
      };
    }

    const pwBtn = root.querySelector('#acct-toggle-pw');
    const pwDrawer = root.querySelector('#acct-pw-drawer');
    if (pwBtn && pwDrawer) {
      pwBtn.onclick = () => {
        pwDrawer.hidden = !pwDrawer.hidden;
        if (!pwDrawer.hidden) root.querySelector('#acct-pw-cur')?.focus();
      };
    }

    const pwSaveBtn = root.querySelector('#acct-pw-save');
    if (pwSaveBtn) {
      pwSaveBtn.onclick = async () => {
        const cur = root.querySelector('#acct-pw-cur')?.value || '';
        const nw = root.querySelector('#acct-pw-new')?.value || '';
        if (!cur || !nw) {
          toast('⚠️ Enter both your current and new PIN/Password.');
          return;
        }
        pwSaveBtn.disabled = true;
        try {
          await changePasswordApi(cur, nw);
          toast('🔑 Password updated safely!', 2200);
          if (pwDrawer) pwDrawer.hidden = true;
        } catch (err) {
          toast(`⚠️ ${err.message || 'Password update failed'}`);
        } finally {
          pwSaveBtn.disabled = false;
        }
      };
    }

    const founderBtn = root.querySelector('#acct-open-founder');
    if (founderBtn) {
      founderBtn.onclick = () => {
        closeModal();
        setActiveDock('wardrobe');
        rpg?.open('wardrobe', { tab: 'bag' });
        setTimeout(() => {
          const fModal = document.getElementById('founder-modal');
          if (fModal) fModal.hidden = false;
        }, 120);
      };
    }
  });
}

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
        <div style="font-size:10px;color:#6e4119;line-height:1.2;">Toss <b>100 <img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt=""></b> daily for <b>+10–50 💎</b> or <b>1× Ticket 🎟️</b>!</div>
        <button type="button" id="wnd-modal-toss" class="btn-gold small" style="padding:6px 8px;font-size:11px;margin-top:2px;" ${hasFountain ? '' : 'disabled'}>
          ${hasFountain ? '<img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt=""> Toss 100 Gold!' : '📍 Place Fountain First'}
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

function buildingModal(pick, { legacy = false } = {}) {
  const p = S.profile;
  const mine = pick.owner === p.id;
  const isl = islandOf(world.layout, pick.owner);
  const v = mine ? p.village : isl.village;
  const b = v.buildings.find((q) => q.uid === pick.uid);
  if (!b) return;
  // Stage 3 Base Camp: production buildings + farm plots open the Base Camp sheet instead.
  if (!legacy && basecampUI?.handles(b.type) && basecampUI.openBuilding({ owner: pick.owner, uid: b.uid, type: b.type, village: mine ? null : v })) return;
  const d = placeable(b.type);
  const rows = [];
  const actions = [];
  let title = `${d.emoji} ${d.name}`;
  let badgeTag = `${d.w}×${d.h} Grid`;
  let levelTag = '';
  let progressBarHtml = '';
  const goldIco = '<img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt="">';
  const berryIco = '<img class="inline-curr-ico" src="/assets/ui/icon_berry.png" alt="">';
  const diaIco = '<img class="inline-curr-ico" src="/assets/ui/icon_diamond.png" alt="">';

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
      rows.push([`Upgrade to Lv. ${next}`, `${fmt(castleUpgradeCost(next))} ${goldIco}`]);
      actions.push({ label: `⬆️ Upgrade (${fmt(castleUpgradeCost(next))} ${goldIco})`, cls: 'emerald', disabled: p.gold < castleUpgradeCost(next) || sum < needSum, onClick: () => upgrade('castle') });
    }
  } else if (CORE[b.type]) {
    const lv = v.levels?.[b.type] || 1;
    levelTag = `⭐ Lv. ${lv}`;
    if (d.produces) rows.push(['Hourly Production', `${fmt(d.perHour(lv))} ${d.produces === 'gold' ? goldIco : berryIco}/hr`]);
    if (d.daily) rows.push(['Daily Diamonds', `${d.perDay(lv)} ${diaIco}/day`]);
    if (b.type === 'nest') rows.push(['Mythic/Epic Trait Odds', `${d.traitOdds(lv).toFixed(2)}x`]);
    if (b.type === 'dock') rows.push(['Offline Storage Cap', `${storageCapHrs(v, mine ? p : {}).toFixed(1)} h`], ['Co-Op Fishing', 'Walk onto the dock and tap 🎣']);
    if (b.type === 'patisserie' && typeof d.matchGoldPct === 'function') rows.push(['Post-Match Gold', `+${d.matchGoldPct(lv)}%`]);
    if (b.type === 'shrine') {
      rows.push(['1-Tap Warp to Town Hall', 'Active ✨']);
      actions.push({
        label: '🏛️ Warp to Town Hall',
        cls: 'emerald',
        onClick: () => {
          $('hud').dataset.scene = 'TOWN_HALL';
          fishing?.setAvailable(false);
          setActiveDock('townhall');
          if (net) net.resumeInstanceId = 'townhall';
          net?.send({ type: 'instance_switch', to: 'townhall' });
        },
      });
    }
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
        if (cards < need) {
          actions.push({
            label: '🎰 Get Blueprints (Gacha)',
            cls: 'secondary',
            onClick: () => {
              setActiveDock('gacha');
              rpg?.open('gacha', { tab: 'box2' });
            },
          });
        }
      } else {
        levelTag = '👑 MAX Lv.10';
      }
    }
  } else if (WONDERS[b.type]) {
    const stars = v.wonders?.[b.type]?.stars || 1;
    levelTag = '★'.repeat(stars);
    rows.push(['VIP Wonder Buff', d.effect], ['Comfort Bonus', `+${stars * 300} 🌸`]);
    if (b.type === 'wnd_fountain') actions.push({ label: `⛲ Toss 100 ${goldIco}`, cls: 'emerald', onClick: () => tossCoin(pick.owner) });
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
    levelTag = b.type === 'dec_nookairline_museum' ? '✈️ V1 Memory Museum' : '🌸 Cute Decor';
    rows.push(['Passive Buff', d.effect], ['Comfort Bonus', '+120 🌸 (1st copy)']);
    if (d.seats) rows.push(['Interactive Seat', `Drop your Chibi onto it to sit (${d.seats} seats) 🪑`]);
    if (b.type === 'dec_nookairline_museum') {
      rows.push(['Archival Exhibits', '6 Timeline Chapters • 12 Gacha Floors • 6 Living 2.5D Portals']);
      actions.unshift(
        {
          label: '🏛️✈️ Enter NookAirline V1 Museum (Together!)',
          cls: 'emerald',
          onClick: () => { enterNookMuseum(); },
        },
        {
          label: '🗻🌸 Step Into Mount Fuji 2.5D Portal',
          onClick: () => { enterNookMuseum('fuji'); },
        }
      );
    } else if (b.type === 'dec_painter_easel') {
      actions.unshift({
        label: '🏛️✈️ Visit NookAirline V1 Museum',
        cls: 'emerald',
        onClick: () => { enterNookMuseum(); },
      });
    }
  }

  if (mine) {
    actions.push({ label: '🔨 Quick Move', onClick: () => { enterQuickMove(b.uid); } });
    if (b.type !== 'castle') {
      actions.push({
        label: '📥 Put in Bag',
        cls: 'secondary',
        onClick: async () => {
          const nextBuildings = (v.buildings || []).filter((x) => x.uid !== b.uid);
          const r = await request('village_save_grid', {
            layout: {
              buildings: nextBuildings,
              tiles: v.tiles || [],
              ground: v.ground,
            },
          });
          if (r?.ok) {
            world.plaza.setVillage(S.profile.id, S.profile.village);
            world.syncYardPets(S.profile);
            toast(`📥 Stored ${d.name} into your Bag!`);
          } else {
            toast(`✕ ${humanError(r?.error)}`);
          }
        },
      });
    }
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
  const goldIco = '<img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt="">';
  openModal('☁️ Clear Cloud Territory', `<img class="big" src="/assets/village/env_cloud.png" alt="">`
    + `<div class="rows"><span>Expansion Tier ${tier + 1}</span><b>${v.grid_size}×${v.grid_size} → ${next.size}×${next.size}</b>`
    + `<span>Castle level</span><b>${v.castle_lv} / ${next.castleLv}</b><span>Cost</span><b>${fmt(next.gold)} ${goldIco}</b></div>`,
  [{ label: `☁️ Clear Clouds (${fmt(next.gold)} ${goldIco})`, cls: 'emerald', disabled: !ok, onClick: async () => { const r = await request('village_expand_cloud'); toast(r.ok ? `☁️ Your kingdom grew to ${r.grid_size}×${r.grid_size}!` : `☁️ ${humanError(r.error)}`); } }]);
}

function welcomeBack(off) {
  const h = Math.floor(off.awayMs / 3600_000), m = Math.floor((off.awayMs % 3600_000) / 60_000);
  const rewards = [];
  if (off.gold) rewards.push(`<span><img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt=""> +${fmt(off.gold)}</span>`);
  if (off.berries) rewards.push(`<span><img class="inline-curr-ico" src="/assets/ui/icon_berry.png" alt=""> +${fmt(off.berries)}</span>`);
  if (off.diamonds) rewards.push(`<span><img class="inline-curr-ico" src="/assets/ui/icon_diamond.png" alt=""> +${off.diamonds}</span>`);
  openModal('⏳ Welcome Back!', `<div>While you were resting (<b>${h}h ${m}m</b>), your Sky Kingdom produced:</div>`
    + `<div class="rewards">${rewards.join('')}</div><div class="hint-small">🐢 Storage cap: ${off.capHrs.toFixed(1)} h${off.full ? ' — storage was full!' : ''}</div>`,
  [{ label: '<img class="inline-curr-ico" src="/assets/ui/icon_berry.png" alt=""> HARVEST ALL (+15 EXP)', cls: 'emerald', onClick: () => harvestAll() }]);
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

function enterEdit(selectUid = null, placeType = null) {
  closeModal();
  if (!editor) return;
  $('hud').dataset.scene = 'VILLAGE_EDIT';
  world.setEditMode(true);
  editor.open({ selectUid, placeType });
}

function enterNookMuseum(portalId = null) {
  if (editor?.active) editor.close(true);
  closeModal();
  rpg?.close?.();
  hallOfFameUI?.close?.();
  voiceClient?.closeSwitchboard?.();
  mono?.hub?.close({ leave: true });
  $('hud').dataset.scene = 'NOOK_MUSEUM';
  fishing?.setAvailable(false);
  radar?.setActive(false);
  if (!portalId && world?.local) {
    world.setLocalPosition(-0.6, 2.2);
    world.local.rig?.facing?.set?.(true, true);
    world.local.pet?.placeNear?.({ x: -0.6, z: 2.2, right: true });
    world.camTarget?.set?.(0, 0, 0.2);
  }
  world?.setMuseumMode?.(true, { kind: 'museum', size: 36, portalId });
  if (portalId) {
    nookMuseumScene?.enterPortal?.(portalId, { fromServer: true });
  } else if (nookMuseumScene?.currentPortalId) {
    nookMuseumScene?.exitPortalToHall?.({ fromServer: true, spawn: { x: -0.6, z: 2.2 } });
  }
  if (world) world.setZoneSeq((world.zoneSeq || 1) + 1);
  if (net) net.resumeInstanceId = portalId ? `nook_museum:${portalId}` : 'nook_museum';
  net?.send({
    type: 'instance_switch',
    to: portalId ? `museum:${portalId}` : 'museum',
    spawn: portalId ? { x: -0.55, z: 2.6 } : { x: -0.6, z: 2.2 },
  });
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
    basecampUI = new BasecampUI({
      request: (t, p) => request(t, p), toast, humanError, getProfile: () => S.profile, now: serverNow,
      onEnterEdit: (placeType = null) => enterEdit(null, placeType),
      onEnterFrontier: (regionId = null) => enterFrontier(regionId),
      onOpenLegacy: (pk) => buildingModal(pk, { legacy: true }),
      onEnergy: (e) => world?.frontierScene?.setEnergy?.(e),
    });
    basecampUI.mountHud($('village-actions'));
    townHallScene = new TownHallScene({ world, onAction: (act) => handleTownHallAction(act) });
    world.townHallScene = townHallScene;
    // Sky Frontier scene (Master Plan v2 §2): engine delegates bounds / picking / update while active.
    world.frontierScene = new SkyFrontierScene({ world, request: (t, p) => request(t, p), toast });
    world.frontierScene.onExit = () => exitFrontier();
    // DEV_FRONTIER entry (Stage 1): `?frontier=1` or localStorage.DEV_FRONTIER = '1' shows a launcher button.
    // The Play Hub tab replaces Moon Defense at the Stage 7 cutover.
    try {
      const devFrontier = new URLSearchParams(location.search).get('frontier') === '1' || localStorage.getItem('DEV_FRONTIER') === '1';
      if (devFrontier && !document.getElementById('sf-dev-launch')) {
        const b = document.createElement('button');
        b.id = 'sf-dev-launch';
        b.textContent = '🏝️ Frontier';
        b.style.cssText = 'position:fixed;right:12px;top:calc(env(safe-area-inset-top,0px) + 120px);z-index:60;padding:8px 12px;border-radius:14px;border:2px solid #C9A45C;background:#3B2A20;color:#E9DCC0;font:600 13px system-ui;box-shadow:0 3px 10px rgba(0,0,0,.35)';
        b.onclick = () => (world.activeFrontier ? exitFrontier() : enterFrontier());
        document.body.appendChild(b);
      }
    } catch { /* storage blocked: ignore */ }
    nookMuseumScene = new NookMuseumScene({
      world,
      getProfile: () => S.profile,
      toast,
      onAction: (act, arg, spawn) => {
        if (act?.action === 'couple_moment') {
          request('couple_moment', act).catch(() => {});
          return;
        }
        if (act === 'exit_museum') {
          world.setMuseumMode(false);
          $('hud').dataset.scene = 'VILLAGE';
          setActiveDock('village');
          if (world) world.setZoneSeq((world.zoneSeq || 1) + 1);
          if (net) net.resumeInstanceId = S.visitingOwner ? `village:${S.visitingOwner}` : null;
          net?.send({ type: 'instance_switch', to: 'home', force: true });
        } else if (act === 'switch_portal') {
          if (world) world.setZoneSeq((world.zoneSeq || 1) + 1);
          if (net) net.resumeInstanceId = arg ? `nook_museum:${arg}` : 'nook_museum';
          net?.send({
            type: 'instance_switch',
            to: arg ? `museum:${arg}` : 'museum',
            spawn: spawn || null,
          });
        } else if (act === 'invite_partner') {
          net?.send({
            type: 'museum_invite_partner',
            portalId: arg || null,
          });
        }
      },
    });
    world.nookMuseumScene = nookMuseumScene;
    world.onLandmarksCheck = (x, z) => townHallScene.checkTrigger(x, z);
    radar = new TownHallRadar({ world, getProfile: () => S.profile, landmarks: getTownHallConfig().LANDMARKS });
    hallOfFameUI = new HallOfFameUI({ request: (t, p) => request(t, p), toast, humanError, getProfile: () => S.profile, rpg, getNet: () => net });
    couplePhotobooth = new CouplePhotoboothUI({
      world,
      getProfile: () => S.profile,
      request: (t, p) => request(t, p),
      toast,
      getVoiceClient: () => voiceClient,
      onApplyMood: (m) => applyMood(m),
    });
    window.__neora = { world, net, debug: () => world.debugState(), request: (t, p) => request(t, p), state: S, rpg, basecampUI, townHallScene, nookMuseumScene, enterFrontier, exitFrontier, enterNookMuseum, showMuseumInviteBanner, radar, hallOfFameUI, couplePhotobooth, openAccountModal, doLogout };
    trackSpeech();
    setInterval(tickVillage, 1000);
    $('act-harvest').onclick = harvestAll;
    $('act-edit').onclick = () => enterEdit();
    $('act-mood').onclick = () => wonderMoodModal();
    if ($('act-museum')) $('act-museum').onclick = () => enterNookMuseum();
    if ($('act-th-museum')) $('act-th-museum').onclick = () => enterNookMuseum();
    $('act-bless').onclick = bless;
    $('act-fountain').onclick = () => tossCoin($('act-fountain').dataset.owner);
    if ($('act-th-table')) $('act-th-table').onclick = () => openPlayHub();
    if ($('act-th-social')) $('act-th-social').onclick = () => voiceClient?.openSwitchboard?.();
    if ($('act-th-hof')) $('act-th-hof').onclick = () => hallOfFameUI?.open();
    if ($('hud-player-card')) {
      $('hud-player-card').onclick = () => openAccountModal();
      $('hud-player-card').onkeydown = (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openAccountModal(); }
      };
    }
    if ($('hud-couple-pill')) $('hud-couple-pill').onclick = () => voiceClient?.openSwitchboard?.();
    if ($('hud-guide-pill')) $('hud-guide-pill').onclick = () => runGuideAction();
    setTimeout(updateGuidePill, 200);
    $('modal-x').onclick = closeModal;
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    world.onPick = (pk) => {
      if (pk.kind === 'sf_node' || pk.kind === 'sf_gate' || pk.kind === 'sf_monster') { world.frontierScene?.interact?.(pk); return true; }
      if (pk.kind === 'bubble') { harvestAll(); return true; }
      if (pk.kind === 'signpost') { expansionModal(); return true; }
      if (pk.kind === 'building') { buildingModal(pk); return true; }
      return false;
    };
    const heartIsleUI = new HeartIsleUI({ world, request: (t, p) => request(t, p), toast, humanError, openModal, closeModal }).install($('village-actions'));
    if (window.__neora) window.__neora.heartIsleUI = heartIsleUI;
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
  if (window.__neora) window.__neora.net = net;

  // Route incoming socket messages to CasinoUI + MoonDefenseUI + VoiceCallClient first
  const origEmit = net.emit.bind(net);
  net.emit = (type, detail) => {
    if (detail && typeof detail === 'object') {
      if (casinoUI?.handle?.(detail)) return;
      if (!casinoUI && typeof detail.type === 'string' && detail.type.startsWith('casino_')) {
        pendingCasinoMsg = detail;
        return;
      }
      if (cloudDashUI?.handle?.(detail)) return;
      if (!cloudDashUI && (detail.type === 'cd_state' || detail.type === 'cd_results')) {
        pendingCdMsg = detail;
        return;
      }
      if (moonDefenseUI?.handle?.(detail)) return;
      if (!moonDefenseUI && typeof detail.type === 'string' && detail.type.startsWith('mb_')) {
        pendingMoonMsg = detail;
        return;
      }
      if (voiceClient?.handle?.(detail)) return;
    }
    origEmit(type, detail);
  };

  // Guarded dynamic imports for CasinoUI, MoonDefenseUI, and VoiceCallClient
  if (casinoUI) {
    casinoUI.net = net;
  } else {
    import('./minigames/casino/casino_ui.js?v=nm18')
      .then(({ CasinoUI }) => {
        casinoUI = new CasinoUI({
          net,
          getProfile: () => S.profile,
          toast,
          onExit: () => {
            if (world) world.activeScene = null;
            $('hud').hidden = false;
            setActiveDock(world?.getInstanceKind?.() === 'townhall' ? 'townhall' : 'village');
            if (mono?.hub) {
              if (mono.hub.table?.status !== 'lobby') mono.hub.table = null;
              mono.hub._casinoStarted = false;
              mono.hub._casinoStartedTableId = null;
            }
          },
        });
        if (window.__neora) window.__neora.casinoUI = casinoUI;
        if (pendingCasinoTable) {
          const t = pendingCasinoTable;
          pendingCasinoTable = null;
          casinoUI.open(t);
        }
        if (pendingCasinoMsg) {
          const m = pendingCasinoMsg;
          pendingCasinoMsg = null;
          casinoUI.handle(m);
        }
      })
      .catch(() => {});
  }

  // Moon Defense UI retired in Stage 7 (replaced by Sky Frontier)

  if (cloudDashUI) {
    cloudDashUI.net = net;
  } else {
    import('./minigames/cloud_dash_ui.js?v=cd31')
      .then(({ CloudDashUI }) => {
        cloudDashUI = new CloudDashUI({
          net,
          world,
          getProfile: () => S.profile,
          toast,
          onExit: () => {
            if (world) world.activeScene = null;
            $('hud').hidden = false;
            setActiveDock(world?.getInstanceKind?.() === 'townhall' ? 'townhall' : 'village');
            if (mono?.hub) {
              if (mono.hub.table?.status !== 'lobby') mono.hub.table = null;
              mono.hub._cdStarted = false;
              mono.hub._cdStartedTableId = null;
            }
          },
        });
        if (world) world.cloudDashUI = cloudDashUI;
        if (window.__neora) window.__neora.cloudDashUI = cloudDashUI;
        if (pendingCdTable) {
          const t = pendingCdTable;
          pendingCdTable = null;
          cloudDashUI.open(t);
        }
        if (pendingCdMsg) {
          const m = pendingCdMsg;
          pendingCdMsg = null;
          cloudDashUI.handle(m);
        }
      })
      .catch((e) => console.warn('[cloud_dash] load failed', e));
  }

  if (voiceClient) {
    voiceClient.net = net;
  } else {
    import('./voice_call_client.js?v=nm18')
      .then(({ VoiceCallClient }) => {
        voiceClient = new VoiceCallClient({
          net,
          getProfile: () => S.profile,
          toast,
          request: (t, p) => request(t, p),
          getUserName: (id) => {
            if (id === S.profile?.id) return S.profile.username;
            const r = world?.remotes.get(id);
            return r?.data?.username || id;
          },
          onBlessPartner: (targetId) => bless(targetId),
          onVisitIsland: (targetId) => {
            closeModal();
            rpg?.close?.();
            hallOfFameUI?.close?.();
            mono?.hub?.close({ leave: true });
            $('hud').dataset.scene = 'VILLAGE';
            setActiveDock('village');
            if (net) net.resumeInstanceId = targetId ? `village:${targetId}` : null;
            net?.send({ type: 'instance_switch', to: targetId ? `visit:${targetId}` : 'home' });
          },
          onOpenGift: (toId) => {
            closeModal();
            mono?.hub?.close({ leave: true });
            setActiveDock('wardrobe');
            rpg?.open('wardrobe', { tab: 'bag', giftTo: toId });
          },
          onOpenPlayHub: () => openPlayHub(),
          onCoupleSyncPose: () => {
            voiceClient?.closeSwitchboard?.();
            if (couplePhotobooth) {
              couplePhotobooth.triggerInWorldInteraction('heart_hands');
            } else {
              world?.local?.pet?.act?.('happy');
              world?.local?.pet?.showEmote?.('love');
            }
          },
          onOpenPhotobooth: (opts) => {
            closeModal();
            rpg?.close?.();
            hallOfFameUI?.close?.();
            mono?.hub?.close({ leave: true });
            couplePhotobooth?.openPhotobooth?.(opts);
          },
        });
        if (window.__neora) window.__neora.voiceClient = voiceClient;
      })
      .catch(() => {});
  }

  editor = editor || new GridEditor(world.plaza, {
    onSave: (layout) => request('village_save_grid', { layout }),
    onExit: (saved) => { exitEdit(); if (saved) toast('✅ Layout saved!'); },
    onPromoteToFull: () => { $('hud').dataset.scene = 'VILLAGE_EDIT'; world.setEditMode(true); },
    toast,
  });
  world.editor = editor;
  if (fishing) {
    fishing.net = net;
  } else {
    fishing = new DockFishing(net, {
      toast,
      humanError,
      onCast: (bait) => {
        const L = world?.local;
        if (L) {
          L.rig?.triggerCast?.(0.55);
          world?.fx?.emit?.(bait ? 'fx_star' : 'fx_bubble', L.x + 0.6, 0.2, L.z + 0.6, bait ? 10 : 6, {
            speed: 1.4, up: 1.8, size: 0.32, life: 0.75, gravity: 2.2,
          });
        }
      },
      onBite: () => {
        const L = world?.local;
        if (L) {
          L.pet?.act?.('excited');
          world?.fx?.emit?.('fx_bubble', L.x + 0.7, 0.25, L.z + 0.7, 12, {
            speed: 1.9, up: 2.4, size: 0.36, life: 0.65, gravity: 2.8,
          });
        }
      },
      onCatch: (res) => {
        const L = world?.local;
        if (L) {
          L.rig?.triggerCast?.(0.75);
          L.pet?.act?.('happy');
          L.pet?.showEmote?.('joy');
          const cell = res?.key === 'chest' || res?.key === 'koi' ? 'fx_star' : 'fx_stardust';
          world?.fx?.emit?.(cell, L.x, 0.9, L.z, 16, {
            speed: 2.2, up: 2.6, size: 0.4, life: 0.95, gravity: 1.8,
          });
        }
      },
      onOpenForge: () => {
        rpg?.open?.('forge');
      },
    });
  }
  fishing.setProfile(S.profile);
  world.onLocalMove = (state, force) => {
    if (moonDefenseUI?.active || cloudDashUI?.active) return;
    net.sendMove(state, force);
  };
  setupMonopoly(profile);
  net.on('status', renderNet)
    .on('auth_ok', (m) => {
      if (m.zoneSeq) world.setZoneSeq(m.zoneSeq);
      S.serverOffset = m.serverNow - Date.now();
      S.coupled = !!m.coupled;
      S.visitingOwner = m.visitingOwner || null;
      if (m.layout?.kind === 'sky_frontier') {
        applyFrontierLayout(m.layout, null);
      } else if (m.layout?.kind === 'museum' || m.museum) {
        const mus = m.museum || m.layout;
        const portalId = mus?.portalId || null;
        S.visitingOwner = null;
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'NOOK_MUSEUM';
          fishing?.setAvailable(false);
          world.setTownHallMode(false);
          world.setMuseumMode(true, mus);
          if (portalId) {
            nookMuseumScene?.enterPortal?.(portalId, { fromServer: true });
          } else if (nookMuseumScene?.currentPortalId) {
            nookMuseumScene?.exitPortalToHall?.({ fromServer: true });
          }
          radar?.setActive(false);
        }
        net.resumeInstanceId = portalId ? `nook_museum:${portalId}` : 'nook_museum';
      } else if (m.layout?.kind === 'townhall' || m.townhall) {
        S.visitingOwner = null;
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'TOWN_HALL';
          fishing?.setAvailable(false);
          world.setMuseumMode(false);
          world.setTownHallMode(true, m.layout || m.townhall);
          radar?.setActive(true);
          setActiveDock('townhall');
        }
        net.resumeInstanceId = 'townhall';
      } else {
        S.visitingOwner = m.visitingOwner || null;
        $('hud').dataset.scene = editor?.active ? 'VILLAGE_EDIT' : 'VILLAGE';
        if (!moonDefenseUI?.active) {
          if (world.activeFrontier) world.setFrontierMode(false);
          world.setMuseumMode(false);
          world.setTownHallMode(false);
        }
        world.plaza.setLayout(m.layout || m.village, m.profile.id);
        radar?.setActive(false);
        if (!moonDefenseUI?.active && !cloudDashUI?.active && !casinoUI?.tableId) setActiveDock('village');
        net.resumeInstanceId = S.visitingOwner ? `village:${S.visitingOwner}` : null;
      }
      S.layoutKey = '';
      renderHud(m.profile);
      applyMood(m.profile.village?.mood || 'auto');
      world.clearRemotes();
      if (world.local && world.local.id !== m.profile.id) world.removeLocal();
      if (!world.local) world.spawnLocal(m.profile, m.self);
      else {
        if (!moonDefenseUI?.active && !cloudDashUI?.active && m.self) world.setLocalPosition(m.self.x, m.self.z);
        world.syncPetGiftAndYard(m.profile);
      }
      if (m.offline && (m.offline.gold || m.offline.berries || m.offline.diamonds)) welcomeBack(m.offline);   // server sends null since Stage 3
      basecampUI?.onProfile(m.profile);
    })
    .on('instance_snapshot', (m) => {
      if (m.zoneSeq) world.setZoneSeq(m.zoneSeq);
      S.partnerCompanion = m.partnerCompanion || null;
      if (m.layout?.kind === 'sky_frontier') {
        applyFrontierLayout(m.layout, m.self);
      } else if (m.layout?.kind === 'museum') {
        S.visitingOwner = null;
        net.resumeInstanceId = m.layout.portalId ? `nook_museum:${m.layout.portalId}` : 'nook_museum';
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'NOOK_MUSEUM';
          fishing?.setAvailable(false);
          world.setMuseumMode(true, m.layout);
          radar?.setActive(false);
          if (m.self && world.local) {
            const dist = Math.hypot(m.self.x - world.local.x, m.self.z - world.local.z);
            if (dist > 1.8) world.setLocalPosition(m.self.x, m.self.z);
          }
        }
      } else if (m.layout?.kind === 'townhall') {
        S.visitingOwner = null;
        net.resumeInstanceId = 'townhall';
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'TOWN_HALL';
          fishing?.setAvailable(false);
          world.setMuseumMode(false);
          world.setTownHallMode(true, m.layout);
          radar?.setActive(true);
          setActiveDock('townhall');
          if (m.self) world.setLocalPosition(m.self.x, m.self.z);
          else if (world.local) world.setLocalPosition(0, 6);
        }
      } else if (m.layout) {
        S.visitingOwner = m.visitingOwner || null;
        net.resumeInstanceId = S.visitingOwner ? `village:${S.visitingOwner}` : null;
        $('hud').dataset.scene = editor?.active ? 'VILLAGE_EDIT' : 'VILLAGE';
        if (!moonDefenseUI?.active) {
          if (world.activeFrontier) world.setFrontierMode(false);
          world.setMuseumMode(false);
          world.setTownHallMode(false);
        }
        world.plaza.setLayout(m.layout, S.profile.id);
        radar?.setActive(false);
        if (!moonDefenseUI?.active && !cloudDashUI?.active && !casinoUI?.tableId) setActiveDock('village');
        if (!moonDefenseUI?.active && !cloudDashUI?.active && m.self) world.setLocalPosition(m.self.x, m.self.z);
        if (S.visitingOwner && S.visitingOwner !== S.profile?.id) {
          toast(`🏝️ Visiting ${S.visitingOwner}'s Sky Village!`, 2200);
        }
      }
      renderHud(S.profile);
      const ids = new Set(m.players.map((p) => p.id));
      if (m.partnerCompanion?.id) ids.add(m.partnerCompanion.id);
      for (const id of world.remotes.keys()) if (!ids.has(id)) world.removeRemote(id);
      for (const p of m.players) world.upsertRemote(p);
      if (m.partnerCompanion && !m.players.some((p) => p.id === m.partnerCompanion.id)) {
        world.upsertRemote(m.partnerCompanion);
      }
      if (m.layout?.kind === 'museum') {
        nookMuseumScene?.syncPartnerFollow?.(true);
      }
      couplePhotobooth?.updateProximityBarVisibility?.();
    })
    .on('player_joined', (m) => { world.upsertRemote(m.player); toast(`${m.player.username} arrived ✨`, 1600); })
    .on('sf_node_hit', (m) => world?.frontierScene?.onNodeHit?.(m))
    .on('sf_node_break', (m) => world?.frontierScene?.onNodeBreak?.(m))
    .on('sf_monsters', (m) => world?.frontierScene?.onMonsters?.(m))
    .on('sf_monster_dead', (m) => world?.frontierScene?.onMonsterDead?.(m))
    .on('sf_hit', (m) => world?.frontierScene?.onHit?.(m))
    .on('sf_player_hp', (m) => world?.frontierScene?.onPlayerHp?.(m))
    .on('sf_player_down', (m) => world?.frontierScene?.onPlayerDown?.(m))
    .on('sf_player_respawn', (m) => world?.frontierScene?.onPlayerRespawn?.(m))
    .on('sf_outpost', (m) => world?.frontierScene?.onOutpost?.(m))
    .on('sf_invasion', (m) => world?.frontierScene?.onInvasion?.(m))
    .on('sf_boss', (m) => world?.frontierScene?.onBoss?.(m))
    .on('sf_boss_defeated', (m) => world?.frontierScene?.onBossDefeated?.(m))
    .on('sf_ult', (m) => world?.frontierScene?.onUlt?.(m))
    .on('player_left', (m) => {
      if (S.partnerCompanion && m.id === S.partnerCompanion.id && world?.layout?.kind !== 'townhall') {
        world.upsertRemote(S.partnerCompanion);
      } else {
        world.removeRemote(m.id);
      }
    })
    .on('player_moved', (m) => { const r = world.remotes.get(m.id); if (r) world.upsertRemote({ ...r.data, ...m }); })
    .on('player_dropped', (m) => { if (m.targetId !== 'pet') world.teleportRemote(m.id, m.x, m.z); })
    .on('player_caught', (m) => toast(`🎣 ${m.id} caught something!`, 1400))
    .on('position_correct', (m) => {
      if (moonDefenseUI?.active || cloudDashUI?.active) return;
      world.reconcileServerPosition(m.x, m.z, m.zoneSeq);
    })
    .on('profile_update', (m) => {
      if (m.serverNow) S.serverOffset = m.serverNow - Date.now();
      if (world) world.serverOffset = S.serverOffset || 0;
      if (m.profile?.frontier?.energy) world?.frontierScene?.setEnergy?.(m.profile.frontier.energy);
      renderHud(m.profile);
      world.applyEquipment(m.profile.id, m.profile.equipped, m.profile.appearance);
      world.syncPetGiftAndYard(m.profile);
      rpg?.onProfile(m.profile);
      basecampUI?.onProfile(m.profile);
      voiceClient?.onProfileUpdate?.(m.profile);
    })
    .on('player_equipped', (m) => world.applyEquipment(m.id, m.equipped, m.appearance))
    .on('global_cheer_banner', (m) => showGlobalCheerBanner(m))
    .on('mvp_charm_broadcast', (m) => {
      toast(`👑✨ MVP SECRET RARE DROP! ${m.userName || m.userId} unboxed [${m.charm?.name || 'MVP Charm'}] (${m.charm?.grade || 'SS'}-Grade) on Wave ${m.wave}!`, 5200);
    })
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
    .on('couple_interaction', (m) => {
      couplePhotobooth?.onRemoteInteraction?.(m);
    })
    .on('social_notify', (m) => {
      if (m.kind === 'friend_request') toast(`🤝 ${m.fromName || m.from} sent you a Friend Request!`, 3000);
      else if (m.kind === 'friend_accepted') toast(`🤝 ${m.byName || m.by} is now your friend!`, 2800);
      else if (m.kind === 'couple_proposal') toast(`💞 ${m.fromName || m.from} proposed a Couple Sanctuary bond!`, 3400);
      else if (m.kind === 'couple_bound') toast(`💞 Bound with ${m.partnerName || m.partnerId}! (${m.streak || 1}d Streak)`, 3400);
      else if (m.kind === 'couple_break') toast(`🌙 ${m.byName || m.by} started a gentle break. Your ${m.savedStreak || 1}d streak is saved.`, 3400);
      voiceClient?.onSocialNotify?.(m);
    })
    .on('call_incoming', (m) => voiceClient?.handle?.(m))
    .on('call_ringing', (m) => voiceClient?.handle?.(m))
    .on('call_connected', (m) => voiceClient?.handle?.(m))
    .on('call_ended', (m) => voiceClient?.handle?.(m))
    .on('call_signal', (m) => voiceClient?.handle?.(m))
    .on('call_busy', (m) => voiceClient?.handle?.(m))
    .on('call_error', (m) => voiceClient?.handle?.(m))
    .on('call_reward', (m) => voiceClient?.handle?.(m))
    .on('couple_egg_hatched', (m) => toast(`🥚💞 ${m.by} hatched a Rainbow Couple Egg with your pet!`, 3000))
    .on('museum_partner_invite', (m) => showMuseumInviteBanner(m))
    .on('museum_invite_sent', (m) => {
      if (m.ok) toast('💌 Sent a romantic Museum invite popup to your partner!', 2600);
      else if (m.error === 'partner_offline' || m.reason === 'partner_offline') toast('🕊️ Partner is currently offline — they can join you anytime!', 2800);
      else toast('💞 Invite requires an active Couple Bond!', 2400);
    })
    .on('resume_ok', (m) => {
      if (m.zoneSeq) world.setZoneSeq(m.zoneSeq);
      S.serverOffset = m.serverNow - Date.now();
      if (m.layout?.kind === 'sky_frontier') {
        applyFrontierLayout(m.layout, null);
      } else if (m.layout?.kind === 'museum') {
        net.resumeInstanceId = m.layout.portalId ? `nook_museum:${m.layout.portalId}` : 'nook_museum';
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'NOOK_MUSEUM';
          fishing?.setAvailable(false);
          world.setMuseumMode(true, m.layout);
          radar?.setActive(false);
        }
      } else if (m.layout?.kind === 'townhall') {
        net.resumeInstanceId = 'townhall';
        if (!moonDefenseUI?.active && !cloudDashUI?.active) {
          $('hud').dataset.scene = 'TOWN_HALL';
          fishing?.setAvailable(false);
          world.setMuseumMode(false);
          world.setTownHallMode(true, m.layout);
          radar?.setActive(true);
          setActiveDock('townhall');
        }
      } else {
        net.resumeInstanceId = S.visitingOwner ? `village:${S.visitingOwner}` : null;
        $('hud').dataset.scene = editor?.active ? 'VILLAGE_EDIT' : 'VILLAGE';
        if (!moonDefenseUI?.active) {
          if (world.activeFrontier) world.setFrontierMode(false);
          world.setMuseumMode(false);
          world.setTownHallMode(false);
        }
        world.plaza.setLayout(m.layout, m.profile.id);
        radar?.setActive(false);
        if (!moonDefenseUI?.active && !cloudDashUI?.active && !casinoUI?.tableId) setActiveDock('village');
      }
      if (!moonDefenseUI?.active && !cloudDashUI?.active && m.self) {
        world.setLocalPosition(m.self.x, m.self.z);
      }
      S.layoutKey = '';
      renderHud(m.profile);
      world.syncPetGiftAndYard(m.profile);
    })
    .on('village_updated', (m) => {
      if (world.layout?.kind === 'townhall' || world.layout?.kind === 'museum' || world.layout?.kind === 'sky_frontier' || !Array.isArray(world.layout?.islands)) return;
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
    .on('blessed', (m) => toast(`💧 ${m?.by || 'A friend'} blessed your land! +15% yield for 12h 💞`, 2600))
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
    onExit: () => {
      if (world) world.activeScene = null;
      $('hud').hidden = false;
      setActiveDock(world?.getInstanceKind?.() === 'townhall' ? 'townhall' : 'village');
    },
    // the board takes over the shared canvas (village paused) and the village HUD hides while playing
    onEnterMatch: (b) => { world.activeScene = b; $('hud').hidden = true; },
    onLeaveMatch: () => { world.activeScene = null; $('hud').hidden = false; setActiveDock('play'); },
    onCasinoStart: (table) => {
      if (casinoUI) casinoUI.open(table);
      else pendingCasinoTable = table;
    },
    onMoonDefenseStart: (table) => {
      if (moonDefenseUI) moonDefenseUI.open(table);
      else pendingMoonTable = table;
    },
    onCloudDashStart: (table) => {
      if (cloudDashUI) cloudDashUI.open(table);
      else pendingCdTable = table;
    },
  });
  window.__neora && (window.__neora.mono = mono);
}

function openPlayHub() {
  if (!mono || editor?.active) return;
  closeModal();
  rpg?.close?.();
  hallOfFameUI?.close?.();
  voiceClient?.closeSwitchboard?.();
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
    <div class="cheer-crown-badge">👑</div>
    <div class="cheer-info">
      <div class="cheer-title">🎉 SERVER JACKPOT: ${esc(m.winnerName)}!</div>
      <div class="cheer-sub">${esc(m.achievement)} • <span class="cheer-timer">${Math.max(0, Math.ceil((expiresAt - serverNow()) / 1000))}s</span></div>
    </div>
    <button type="button" class="btn-gold small cheer-claim-btn" data-act="cheer-claim" data-cheer-id="${esc(m.cheerId)}">
      👏 Cheer (+50 <img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt=""> Free!)
    </button>
  `;

  cheerTimer = setInterval(updateTimer, 500);
}

let museumInviteTimer = null;
function showMuseumInviteBanner(m) {
  if (!m) return;
  let el = $('museum-invite-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'museum-invite-banner';
    el.className = 'museum-invite-banner';
    ($('app') || document.body).appendChild(el);
  }
  if (museumInviteTimer) {
    clearTimeout(museumInviteTimer);
    museumInviteTimer = null;
  }
  const portalObj = m.portalId
    ? (MUSEUM_SCENERY_PORTALS || []).find((p) => p.id === m.portalId)
    : null;
  const roomName = portalObj
    ? `${portalObj.emoji || '🌸'} ${portalObj.name}`
    : '✈️ NookAirline V1 Memory Museum';
  const partnerName = m.fromName || m.fromId || 'Your Partner';

  el.hidden = false;
  el.innerHTML = `
    <div class="mib-badge">💞✈️</div>
    <div class="mib-body">
      <div class="mib-title"><b>${esc(partnerName)}</b> ${m.manual ? 'invited you to' : 'stepped into'} <span>${esc(roomName)}</span>!</div>
      <div class="mib-sub">Walk hand-in-hand inside our 2.5D conceptual memory world ✨</div>
    </div>
    <div class="mib-actions">
      <button type="button" class="mib-btn-join" data-act="museum-invite-join">✨ Join Together</button>
      <button type="button" class="mib-btn-dismiss" data-act="museum-invite-dismiss" aria-label="Dismiss">✕</button>
    </div>
  `;
  const joinBtn = el.querySelector('[data-act="museum-invite-join"]');
  if (joinBtn) {
    joinBtn.onclick = () => {
      if (museumInviteTimer) { clearTimeout(museumInviteTimer); museumInviteTimer = null; }
      el.hidden = true;
      enterNookMuseum(m.portalId || null);
      toast(`💞 Teleported to ${partnerName} inside ${roomName}!`, 2800);
    };
  }
  const dismissBtn = el.querySelector('[data-act="museum-invite-dismiss"]');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      if (museumInviteTimer) { clearTimeout(museumInviteTimer); museumInviteTimer = null; }
      el.hidden = true;
    };
  }
  museumInviteTimer = setTimeout(() => {
    el.hidden = true;
    museumInviteTimer = null;
  }, 18000);
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
    rpg?.open('wardrobe', { tab: 'bag' });
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
    hallOfFameUI?.close?.();
    voiceClient?.closeSwitchboard?.();
    mono?.hub?.close({ leave: true });
    world?.setMuseumMode?.(false);
    $('hud').dataset.scene = 'VILLAGE';
    setActiveDock('village');
    if (net) net.resumeInstanceId = null;
    net?.send({ type: 'instance_switch', to: 'home' });
  });
  document.querySelector('.dock-btn[data-dock="townhall"]')?.addEventListener('click', () => {
    if (editor?.active) editor.close(true);
    closeModal();
    rpg?.close?.();
    hallOfFameUI?.close?.();
    voiceClient?.closeSwitchboard?.();
    mono?.hub?.close({ leave: true });
    world?.setMuseumMode?.(false);
    $('hud').dataset.scene = 'TOWN_HALL';
    fishing?.setAvailable(false);
    setActiveDock('townhall');
    if (net) net.resumeInstanceId = 'townhall';
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
    hallOfFameUI?.close?.();
    voiceClient?.closeSwitchboard?.();
    mono?.hub?.close({ leave: true });
    setActiveDock('wardrobe');
    rpg?.open('wardrobe');
  });
  document.querySelector('.dock-btn[data-dock="gacha"]')?.addEventListener('click', () => {
    if (editor?.active) return;
    closeModal();
    hallOfFameUI?.close?.();
    voiceClient?.closeSwitchboard?.();
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
  // QA / dev autologin: ?dev=1&user=nook&pass=1234 (or simply ?user=neen)
  const u = env.params.get('user'), pw = env.params.get('pass') || (u ? '1234' : null);
  if ((env.dev || u) && u && pw) {
    const defaultLineage = u.toLowerCase() === 'neen' ? 'dxb' : 'bkk';
    try { const r = await login(u, pw, env.params.get('lineage') || defaultLineage); session.token = r.token; await startGame(r.profile); return; }
    catch (err) { showGate(err.message); return; }
  }
  if (session.token) {
    try { const { profile } = await fetchMe(); await startGame(profile); return; }
    catch { session.token = null; }
  }
  void formAllowed;
  showGate();
}

boot();

export { resolveMood };
