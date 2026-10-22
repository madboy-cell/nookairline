// client/js/basecamp_ui.js — Stage 3 "Village Base Camp" client UI (Master Plan v2 §5.8 / §11).
// Parchment panels for the Story board, Build menu, production buildings, farm plots, the Order
// Board and the Warehouse / Pantry, plus the Sky Frontier food pouch + energy sheet.
//
// Self-contained: injects its own stylesheet and DOM. Every server action goes through the
// `request(type, payload)` callback (resolves with the action_result); the authoritative profile
// arrives through `onProfile(profile)` (called by main.js on auth_ok / profile_update).
import { MATERIALS, FOOD } from '/shared/materials_catalog.js';
import {
  RECIPES, PRODUCTION_BUILDINGS, CROPS, storeCap, storeOf, storeUsed, storeUpgradeCost, queueSlots,
} from '/shared/production_rules.js';
import { CHAPTERS, currentSteps, isChapterComplete, unlockedBuildings, unlockedForVillage } from '/shared/story_rules.js';
import { CORE, MAX_CORE_LV, DECOR, WONDERS } from '/shared/catalog_landmarks.js';
import { maxCopies, plotCap, utcDay } from '/shared/village_rules.js';
import { RESIDENTS, MEAL_QUALITY, isFed, housingCap, cottageCap, buildingSpeedMult } from '/shared/resident_rules.js';
import { MONUMENTS, CAMP_PROPS, COSMETIC_DECOR, isUnlocked as monumentUnlocked } from '/shared/monument_rules.js';
import { ENERGY, utcDayOf } from '/shared/sky_frontier_rules.js';

// ------------------------------------------------------------------------------------------------
// Cost tables mirrored from server/basecamp_service.js (server-only module: it imports
// economy_service). Keep in sync with BUILD_COSTS / buildCost / upgradeCost / castleLevelCap there.
// The server stays authoritative: these values only drive labels and button states.
// ------------------------------------------------------------------------------------------------
const BUILD_COSTS = Object.freeze({
  windmill_bakery: { wood: 20, stone: 10 },
  patisserie: { wood: 25, stone: 15, gold: 300 },
  mint: { stone: 30, wood: 15 },
  workshop: { wood: 30, stone: 20 },
  flower_greenhouse: { wood: 20, crystal_glass: 4 },
  owl_post_office: { wood: 15, plank: 10 },
  cottage: { plank: 20, stone: 10 },
  farm_plot: { wood: 4 },
  tent: { wood: 8 },
  nest: { plank: 20, herb: 5 },
});
const DEFAULT_BUILD_COST = Object.freeze({ plank: 30, ingot: 10 });
const MAX_STORE_LV = 10;

export function buildCost(type, copyIndex = 0) {
  const base = BUILD_COSTS[type] || DEFAULT_BUILD_COST;
  const mult = (copyIndex | 0) >= 1 ? 2 : 1;
  const out = {};
  for (const [k, n] of Object.entries(base)) out[k] = n * mult;
  return out;
}
export function upgradeCost(type, lv) {
  const l = Math.max(1, lv | 0 || 1);
  const out = { plank: 8 * l, ingot: l >= 3 ? 4 * l : 0, gold: 200 * l };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
const castleLevelCap = (story) => Math.min(MAX_CORE_LV, (Array.isArray(story?.completed) ? story.completed.length : 0) * 2 + 2);
// Stage 5 mirrors of server/basecamp_service.js (EXTRA_RECIPES / ONSEN_COOLDOWN_MS / WISH_COST / CRAFTABLE_DECOR).
const EXTRA_RECIPES = Object.freeze({
  matcha_tea: { id: 'matcha_tea', building: 'wnd_tea_pavilion', monument: 'wnd_tea_pavilion', inputs: { herb: 3, honey: 1 }, outputs: { matcha_tea: 1 }, ms: 300_000, minLv: 1 },
});
const EXTRA_BUILDINGS = Object.freeze({ wnd_tea_pavilion: ['matcha_tea'] });
const ONSEN_COOLDOWN_MS = 4 * 3600_000;
const WISH_COST = 100;
const LAUNCH_MONUMENTS = Object.keys(MONUMENTS).filter((k) => MONUMENTS[k].launch);
const recipeOf = (id) => RECIPES[id] || EXTRA_RECIPES[id] || null;
const recipesFor = (type) => PRODUCTION_BUILDINGS[type] || EXTRA_BUILDINGS[type] || [];
const placeDef = (type) => CORE[type] || WONDERS[type] || DECOR[type] || { name: String(type).replace(/_/g, ' '), emoji: '🏠' };
const MON_EFFECT = {
  wnd_onsen: '♨️ Soak for Well-Rested: +15% gather yield for 30 min (every 4 h)',
  wnd_tea_pavilion: '🍵 Brew Matcha Tea (tap the Tea House on your island)',
  wnd_ferris: '🎡 Couple date buff — Heart Isle only',
  wnd_fountain: '⛲ Daily wish: 100 🪙 → a rare material',
};

// ------------------------------------------------------------------------------------------------
const BC_ERR = Object.freeze({
  missing_inputs: 'missing ingredients for this recipe',
  queue_full: 'the queue is full — collect finished goods or wait',
  level: 'upgrade this building to unlock the recipe',
  locked: 'locked — progress the 📜 Story to unlock it',
  story_locked: 'the Story caps this level — finish the next chapter first',
  not_built: 'construct this building first',
  missing_items: "you don't have all the items yet",
  not_ready: 'not ready yet',
  busy: 'this plot is already growing something',
  missing_seed: 'you need seeds for that crop',
  claimed: 'already claimed today',
  limit: 'daily limit reached',
  diamonds: 'not enough Diamonds 💎',
  missing_materials: 'missing materials',
  not_enough_gold: 'not enough Gold',
  max_copies: 'you own the maximum number of copies',
  plot_cap: 'farm plot cap reached — upgrade the Castle',
  nothing_to_collect: 'nothing to collect yet',
  storage_full: 'storage is full — upgrade the Warehouse / Pantry',
  incomplete: 'finish every step first',
  done: 'all chapters are complete',
  already_watered: 'already watered 💧',
  already_ready: 'already ready to harvest',
  owner: "you can't water your own plot",
  not_placed: 'place this building on your island first',
  not_plot: 'that is not a farm plot',
  already_gifted: 'already gifted energy today',
  no_couple: 'bind a Couple Soul-Link first',
  no_partner: 'partner not found',
  none: 'none left in your Pantry',
  not_food: 'that is not food',
  not_needed: 'the Big Order needs none of your items',
  already_complete: 'the Big Order is already complete',
  empty_slot: 'that order slot is empty',
  no_big_order: 'no Big Order today',
  max_level: 'already max level',
  unique: 'there can be only one',
  no_state: 'frontier data not loaded yet',
  timeout: 'the server took too long — try again',
  no_housing: 'every cottage bed is taken — build & place another Settler Cottage',
  wrong_building: 'this resident only works in their own building',
  not_resident: 'that resident has not moved in yet',
  unknown: 'unknown resident',
  cottage_cap: 'raise Comfort to build more cottages',
  monument_not_built: 'build this Monument first',
  not_craftable: "that decor can't be crafted",
  bad_decor: 'unknown decor',
  already_wished_today: 'you already made a wish today',
  already_claimed_today: 'already claimed today',
  no_tent: 'place a Tent & Campfire first',
  cooldown: 'still cooling down',
  heart_isle_only: 'the Ferris Wheel can only stand on Heart Isle',
  retired: 'this Wonder was retired',
  locked_monument: 'locked — progress the Story',
  monuments_are_built: 'Monuments are built in the Base Camp now',
});

const TOOL_ICON = { pickaxe: '⛏️', axe: '🪓', staff: '🪄' };
const STEP_ICON = { gather: '🏝️', craft: '⚒️', build: '🔨', deliver_orders: '📋', visit: '🧭', defeat: '⚔️', harvest: '🌾' };
const BUFF_LABEL = { regen: 'Regen', yield: '+20% Yield', yield_plus: '+35% Yield', party: 'Party Boost', speed: 'Swift Steps' };
const RESIDENT_NAME = { baker: 'Baker', miner: 'Miner', smith: 'Smith', botanist: 'Botanist', pet_keeper: 'Pet Keeper' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const matOf = (id) => MATERIALS[id] || { id, name: String(id).replace(/_/g, ' '), emoji: '📦' };
const coreOf = (type) => CORE[type] || { name: String(type).replace(/_/g, ' '), emoji: '🏠' };
function fmtDur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
  return `${s}s`;
}
const recipeIcon = (r) => (r.tool ? TOOL_ICON[r.tool.kind] || '🛠️' : matOf(Object.keys(r.outputs || {})[0]).emoji);
const recipeName = (r) => (r.tool ? `${r.tool.kind[0].toUpperCase()}${r.tool.kind.slice(1)} T${r.tool.tier}` : matOf(Object.keys(r.outputs || {})[0]).name);
const itemsLine = (items) => Object.entries(items || {}).filter(([, n]) => n > 0).map(([k, n]) => `${matOf(k).emoji}×${fmtN(n)}`).join(' ');

const STYLE = `
.bc-hud-row { display: flex; gap: 5px; justify-content: flex-end; pointer-events: auto; }
.bc-hud-btn {
  position: relative; width: 48px; height: 48px; border-radius: 14px; border: 2.5px solid #3B2A20;
  background: linear-gradient(180deg, #F4EAD6 0%, #E9DCC0 60%, #D9C59C 100%); color: #3B2A20;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0;
  font: 900 9.5px Georgia, "Times New Roman", serif; letter-spacing: .2px; cursor: pointer;
  box-shadow: inset 0 2px 0 #fffaf0, inset 0 -2px 0 #C9A45C, 0 3px 0 #3B2A20, 0 5px 10px rgba(0,0,0,.3);
}
.bc-hud-btn .bc-ico { font-size: 19px; line-height: 1; }
.bc-hud-btn:active { transform: translateY(2px); box-shadow: inset 0 1px 0 #fffaf0, 0 1px 0 #3B2A20; }
.bc-hud-btn.bc-locked { filter: grayscale(.7); opacity: .78; }
.bc-hud-btn.bc-locked::after { content: '🔒'; position: absolute; right: -4px; top: -6px; font-size: 12px; }
.bc-hud-btn .bc-dot { position: absolute; right: -3px; top: -3px; width: 12px; height: 12px; border-radius: 50%; background: #e2462f; border: 2px solid #fff4dc; display: none; }
.bc-hud-btn.bc-has-dot .bc-dot { display: block; animation: bcPulse 1.1s ease-in-out infinite; }
@keyframes bcPulse { 50% { transform: scale(1.25); } }

.bc-overlay { position: absolute; inset: 0; z-index: 36; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(24, 14, 8, .55); pointer-events: auto;
  /* stays under the persistent bottom dock (z 38) like the other panels, so leave room for it */
  padding: calc(env(safe-area-inset-top, 0px) + 64px) 8px calc(env(safe-area-inset-bottom, 0px) + 80px); }
.bc-overlay[hidden] { display: none !important; }
#sf-hud .bc-overlay { position: fixed; z-index: 60; padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); }
.bc-sheet { width: 100%; max-width: 380px; max-height: 100%; display: flex; flex-direction: column;
  background: #E9DCC0; color: #3B2A20; border: 3px solid #3B2A20; border-radius: 18px; overflow: hidden;
  box-shadow: 0 0 0 2px #C9A45C inset, 0 10px 30px rgba(0,0,0,.5); font: 600 12.5px system-ui, -apple-system, "Segoe UI", sans-serif; }
.bc-sheet.bc-small { max-width: 340px; }
.bc-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; background: linear-gradient(180deg, #4a3527, #3B2A20);
  color: #F4EAD6; border-bottom: 2px solid #C9A45C; }
.bc-head h3 { flex: 1; margin: 0; font: 700 16px Georgia, "Times New Roman", serif; letter-spacing: .3px; }
.bc-x { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #C9A45C; background: #E9DCC0; color: #3B2A20; font: 900 14px system-ui; cursor: pointer; }
.bc-body { overflow-y: auto; padding: 10px 12px 12px; -webkit-overflow-scrolling: touch; }
.bc-foot { display: flex; gap: 6px; padding: 8px 12px 10px; border-top: 2px solid #cdb88f; background: #E2D2B0; flex-wrap: wrap; }
.bc-foot .bc-btn { flex: 1; }
.bc-sec { font: 700 13.5px Georgia, "Times New Roman", serif; margin: 10px 0 6px; color: #3B2A20; display: flex; align-items: center; gap: 6px; }
.bc-sec:first-child { margin-top: 0; }
.bc-sec small { font: 700 11px system-ui; color: #6E5339; margin-left: auto; }
.bc-card { background: #F4EAD6; border: 2px solid #b99f74; border-radius: 12px; padding: 8px 9px; margin-bottom: 7px; }
.bc-card.bc-done { border-color: #6c9a4b; background: #eef3dc; }
.bc-card.bc-dim { opacity: .62; }
.bc-row { display: flex; align-items: center; gap: 8px; }
.bc-row .bc-grow { flex: 1; min-width: 0; }
.bc-big-ico { font-size: 26px; width: 34px; text-align: center; flex-shrink: 0; }
.bc-title { font: 700 13px Georgia, "Times New Roman", serif; }
.bc-sub { font-size: 11px; color: #6E5339; margin-top: 1px; }
.bc-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.bc-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px; background: #fffaf0; border: 1.5px solid #cdb88f; font: 800 11px system-ui; color: #3B2A20; white-space: nowrap; }
.bc-chip.ok { border-color: #6c9a4b; color: #2f5a1a; }
.bc-chip.bad { border-color: #c4523d; color: #9a2a17; background: #fff1ec; }
.bc-chip.brass { border-color: #C9A45C; background: #fbf1d6; }
.bc-btn { border: 2px solid #3B2A20; border-radius: 11px; padding: 6px 11px; cursor: pointer; white-space: nowrap;
  background: linear-gradient(180deg, #f6dc9a, #C9A45C); color: #3B2A20; font: 900 12px system-ui; box-shadow: 0 2px 0 #3B2A20; }
.bc-btn.green { background: linear-gradient(180deg, #b8e49a, #5fa73f); color: #133a05; }
.bc-btn.red { background: linear-gradient(180deg, #f2b3a3, #c4523d); color: #fff; text-shadow: 0 1px 0 #6b1d10; }
.bc-btn.plain { background: #F4EAD6; }
.bc-btn:disabled { filter: grayscale(.8); opacity: .55; cursor: default; }
.bc-btn:active:not(:disabled) { transform: translateY(1.5px); box-shadow: 0 0.5px 0 #3B2A20; }
.bc-bar { position: relative; height: 12px; border-radius: 999px; background: #d8c6a2; border: 1.5px solid #8a6f4c; overflow: hidden; margin-top: 5px; }
.bc-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #C9A45C, #f0d58c); border-radius: 999px; transition: width .4s linear; }
.bc-bar.ok > i { background: linear-gradient(90deg, #5fa73f, #a8dc84); }
.bc-bar > b { position: absolute; inset: 0; text-align: center; font: 900 9px/10px system-ui; color: #3B2A20; }
.bc-note { font-size: 11px; color: #6E5339; background: #f7efdc; border: 1.5px dashed #b99f74; border-radius: 10px; padding: 6px 8px; margin: 6px 0; }
.bc-note.good { border-color: #6c9a4b; color: #2f5a1a; background: #eef3dc; }
.bc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 5px; }
.bc-cell { background: #fffaf0; border: 1.5px solid #cdb88f; border-radius: 10px; padding: 4px 2px; text-align: center; font: 800 10px system-ui; }
.bc-cell .e { font-size: 19px; display: block; line-height: 1.15; }
.bc-cell .n { color: #6E5339; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-steps .bc-card { padding: 6px 9px; }
.bc-check { font-size: 15px; width: 20px; text-align: center; }
.bc-tag { font: 900 10px system-ui; padding: 1px 6px; border-radius: 999px; background: #3B2A20; color: #F4EAD6; }
.bc-tabs { display: flex; gap: 4px; margin: 0 0 9px; }
.bc-tab { flex: 1; border: 2px solid #b99f74; border-radius: 10px; padding: 5px 2px; background: #F4EAD6; color: #6E5339; font: 800 11px system-ui; cursor: pointer; white-space: nowrap; }
.bc-tab.on { background: linear-gradient(180deg, #4a3527, #3B2A20); color: #F4EAD6; border-color: #3B2A20; box-shadow: inset 0 -2px 0 #C9A45C; }
.bc-sel { border: 2px solid #3B2A20; border-radius: 10px; padding: 5px 6px; background: #fffaf0; color: #3B2A20; font: 800 11.5px system-ui; max-width: 140px; }

/* --- Sky Frontier: food pouch / energy + / meal buff --- */
.bc-sf-plus { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #C9A45C; background: #3B2A20; color: #FFE27A;
  font: 900 17px/1 system-ui; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,.4); }
.bc-sf-buff { display: none; align-items: center; gap: 4px; height: 28px; padding: 2px 9px; border-radius: 14px; background: rgba(36,24,18,.78);
  border: 2px solid #C9A45C; color: #FFF3C4; font: 800 11.5px system-ui; pointer-events: auto; }
.bc-sf-buff.on { display: inline-flex; }
.bc-sf-pouch { position: absolute; left: 8px; top: 34%; display: flex; flex-direction: column; gap: 6px; pointer-events: auto; }
.bc-sf-slot { position: relative; width: 46px; height: 46px; border-radius: 13px; border: 2.5px solid #3B2A20; background: #E9DCC0;
  box-shadow: inset 0 0 0 1.5px #C9A45C, 0 3px 8px rgba(0,0,0,.4); font-size: 22px; display: flex; align-items: center; justify-content: center;
  padding: 0; cursor: pointer; touch-action: manipulation; -webkit-touch-callout: none; }
.bc-sf-slot.empty { color: #8a6f4c; font: 900 18px system-ui; background: rgba(233,220,192,.72); }
.bc-sf-slot.zero { filter: grayscale(.85); opacity: .7; }
.bc-sf-slot b { position: absolute; right: -4px; bottom: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #3B2A20; color: #FFE27A;
  border: 1.5px solid #C9A45C; font: 900 10px/15px system-ui; padding: 0 3px; text-align: center; }
.bc-sf-edit { width: 46px; height: 24px; border-radius: 10px; border: 2px solid #3B2A20; background: #C9A45C; color: #3B2A20; font: 900 10px system-ui; cursor: pointer; padding: 0; }
`;

export class BasecampUI {
  constructor({ request, toast, getProfile, humanError, now, onEnterEdit, onEnergy, onOpenLegacy } = {}) {
    this.request = request;
    this.toast = toast || (() => {});
    this.getProfile = getProfile || (() => null);
    this.humanError = humanError || ((e) => e);
    this.now = typeof now === 'function' ? now : () => Date.now();
    this.onEnterEdit = onEnterEdit || null;
    this.onEnergy = onEnergy || null;
    this.onOpenLegacy = onOpenLegacy || null;
    this.profile = null;
    this.view = null;            // { kind, ...args }
    this.board = null;           // last bc_orders board
    this.justBuilt = null;
    this._acts = new Map();
    this._actSeq = 0;
    this._busy = false;
    this._hud = null;
    this._sf = null;
    this._edgeAt = Infinity;     // next timestamp at which the open view must re-render
    this._injectStyle();
    this._buildOverlay();
    this._timer = setInterval(() => this._tick(), 1000);
  }

  // ---------------------------------------------------------------------------------- plumbing
  _injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('bc-ui-style')) return;
    const s = document.createElement('style');
    s.id = 'bc-ui-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  _buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 'bc-overlay';
    ov.hidden = true;
    ov.innerHTML = `<section class="bc-sheet" role="dialog" aria-modal="true">
      <header class="bc-head"><h3 class="bc-h">—</h3><button type="button" class="bc-x" aria-label="Close">✕</button></header>
      <div class="bc-body"></div><footer class="bc-foot"></footer></section>`;
    this.overlay = ov;
    this.sheetEl = ov.querySelector('.bc-sheet');
    this.titleEl = ov.querySelector('.bc-h');
    this.bodyEl = ov.querySelector('.bc-body');
    this.footEl = ov.querySelector('.bc-foot');
    ov.querySelector('.bc-x').onclick = () => this.close();
    ov.addEventListener('click', (e) => {
      if (e.target === ov) { this.close(); return; }
      const btn = e.target.closest?.('[data-bc]');
      if (btn && ov.contains(btn)) this._run(btn);
    });
    // <select data-bc-sel> dropdowns (resident assignment)
    ov.addEventListener('change', (e) => {
      const sel = e.target.closest?.('select[data-bc-sel]');
      const fn = sel && this._acts.get(sel.dataset.bcSel);
      if (fn && !this._busy) { this._busy = true; Promise.resolve(fn(sel.value)).catch((err) => console.warn('[basecamp]', err)).finally(() => { this._busy = false; }); }
    });
    // swallow pointer input so the 3D world underneath never sees taps on the sheet
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'wheel']) ov.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    (document.getElementById('app') || document.body).appendChild(ov);
  }

  /** Register a click handler and return the data attribute to put on a button. */
  _act(fn) {
    const id = String(++this._actSeq);
    this._acts.set(id, fn);
    return `data-bc="${id}"`;
  }

  /** Like _act for a <select>: `fn(value)` runs on change. */
  _actSel(fn) {
    const id = String(++this._actSeq);
    this._acts.set(id, fn);
    return `data-bc-sel="${id}"`;
  }

  async _run(btn) {
    const fn = this._acts.get(btn.dataset.bc);
    if (!fn || btn.disabled || this._busy) return;
    this._busy = true;
    btn.disabled = true;
    try { await fn(); } catch (err) { console.warn('[basecamp]', err); } finally {
      this._busy = false;
      if (btn.isConnected) btn.disabled = false;
    }
  }

  err(code) { return BC_ERR[code] || this.humanError?.(code) || String(code || 'error'); }

  async _req(type, payload = {}, icon = '⚠️') {
    if (typeof this.request !== 'function') return { ok: false, error: 'no_socket' };
    const r = (await this.request(type, payload)) || { ok: false, error: 'server_error' };
    if (!r.ok) this.toast(`${icon} ${this.err(r.error)}`, 2600);
    return r;
  }

  _p() { return this.profile || this.getProfile?.() || null; }
  _stores(p = this._p()) {
    const fr = p?.frontier || {};
    return { warehouse: fr.warehouse || { lv: 1, items: {} }, pantry: fr.pantry || { lv: 1, items: {} } };
  }
  _have(id, p = this._p()) {
    if (!p) return 0;
    if (id === 'gold') return p.gold | 0;
    if (id === 'diamonds') return p.diamonds | 0;
    const st = this._stores(p)[storeOf(id)];
    return st?.items?.[id] | 0;
  }
  _canAfford(cost, p = this._p()) { return Object.entries(cost || {}).every(([k, n]) => this._have(k, p) >= n); }
  _costChips(cost, p = this._p()) {
    return Object.entries(cost || {}).map(([k, n]) => {
      const have = this._have(k, p);
      const ico = k === 'gold' ? '🪙' : k === 'diamonds' ? '💎' : matOf(k).emoji;
      const label = k === 'gold' || k === 'diamonds' ? `${fmtN(n)}` : `${fmtN(have)}/${fmtN(n)}`;
      return `<span class="bc-chip ${have >= n ? 'ok' : 'bad'}" title="${esc(k === 'gold' ? 'Gold' : matOf(k).name)}">${ico} ${label}</span>`;
    }).join('');
  }
  _story(p = this._p()) {
    const s = p?.story;
    return s && typeof s.chapter === 'number' ? s : { chapter: 0, progress: {}, completed: [], claimed: [] };
  }
  _bar(start, end, label = '') {
    const now = this.now();
    const pct = end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
    if (end > now) this._edgeAt = Math.min(this._edgeAt, end);
    return `<div class="bc-bar${pct >= 100 ? ' ok' : ''}" data-bar-start="${start}" data-bar-end="${end}"><i style="width:${pct.toFixed(1)}%"></i><b data-until="${end}" data-label="${esc(label)}">${esc(label)}${end > now ? ` ${fmtDur(end - now)}` : ' ✓'}</b></div>`;
  }

  // ---------------------------------------------------------------------------------- lifecycle
  onProfile(profile) {
    if (!profile) return;
    this.profile = profile;
    if (profile.orders) this.board = profile.orders;
    this._refreshHud();
    this._renderFrontier();
    if (this.view && !this.overlay.hidden) this.render({ keepScroll: true });
  }

  isOpen() { return !!this.view && !this.overlay.hidden; }

  open(kind, args = {}) {
    this.view = { kind, ...args };
    const sfHud = document.getElementById('sf-hud');
    const inFrontier = document.getElementById('hud')?.dataset.scene === 'SKY_FRONTIER' && sfHud;
    const host = inFrontier ? sfHud : (document.getElementById('app') || document.body);
    if (this.overlay.parentNode !== host) host.appendChild(this.overlay);
    this.overlay.hidden = false;
    this.render();
    if (kind === 'orders') this._loadOrders();
  }

  close() {
    this.view = null;
    this.overlay.hidden = true;
    this._acts.clear();
    this.justBuilt = null;
  }

  render({ keepScroll = false } = {}) {
    if (!this.view) return;
    const scroll = keepScroll ? this.bodyEl.scrollTop : 0;
    this._acts.clear();
    this._edgeAt = Infinity;
    const p = this._p();
    let out = { title: '—', body: '', foot: '', small: false };
    try {
      switch (this.view.kind) {
        case 'story': out = this._viewStory(p); break;
        case 'build': out = this._viewBuild(p); break;
        case 'production': out = this._viewProduction(p); break;
        case 'plot': out = this._viewPlot(p); break;
        case 'orders': out = this._viewOrders(p); break;
        case 'storage': out = this._viewStorage(p); break;
        case 'pouch': out = this._viewPouch(p); break;
        case 'energy': out = this._viewEnergy(p); break;
        default: break;
      }
    } catch (err) {
      console.warn('[basecamp] render failed', err);
      out = { title: '⚠️ Base Camp', body: '<div class="bc-note">Something went wrong drawing this panel.</div>', foot: '' };
    }
    this.titleEl.textContent = out.title;
    this.bodyEl.innerHTML = out.body;
    this.footEl.innerHTML = out.foot || '';
    this.footEl.hidden = !out.foot;
    this.sheetEl.classList.toggle('bc-small', !!out.small);
    this.bodyEl.scrollTop = scroll;
  }

  _tick() {
    const now = this.now();
    if (this.isOpen()) {
      if (now >= this._edgeAt) { this.render({ keepScroll: true }); return; }
      for (const el of this.bodyEl.querySelectorAll('[data-bar-end]')) {
        const s = Number(el.dataset.barStart), e = Number(el.dataset.barEnd);
        const pct = e > s ? Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100)) : 100;
        const fill = el.firstElementChild;
        if (fill) fill.style.width = `${pct.toFixed(1)}%`;
      }
      for (const el of this.bodyEl.querySelectorAll('[data-until]')) {
        const u = Number(el.dataset.until);
        el.textContent = `${el.dataset.label || ''}${u > now ? ` ${fmtDur(u - now)}` : ' ✓'}`;
      }
    }
    this._renderBuff();
  }

  // ---------------------------------------------------------------------------------- HUD buttons
  /** Create the Story / Build / Orders / Storage buttons inside `containerEl` (e.g. #village-actions). */
  mountHud(containerEl) {
    if (!containerEl || this._hud) return;
    const row = document.createElement('div');
    row.className = 'bc-hud-row';
    row.id = 'bc-hud-row';
    const defs = [
      ['story', '📜', 'Story'], ['build', '🔨', 'Build'], ['orders', '📋', 'Orders'], ['storage', '📦', 'Storage'],
    ];
    const btns = {};
    for (const [kind, ico, label] of defs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bc-hud-btn';
      b.id = `bc-btn-${kind}`;
      b.innerHTML = `<span class="bc-ico">${ico}</span><span>${label}</span><i class="bc-dot"></i>`;
      b.onclick = (e) => { e.stopPropagation(); this._onHudButton(kind); };
      row.appendChild(b);
      btns[kind] = b;
    }
    containerEl.insertBefore(row, containerEl.firstChild);
    this._hud = { row, btns };
    this._refreshHud();
  }

  _onHudButton(kind) {
    if (kind === 'orders' && !this._ordersUnlocked()) {
      const ch = CHAPTERS.find((c) => c.rewards?.unlockBuildings?.includes('owl_post_office'));
      this.toast(`🔒 The Order Board opens with the Owl Post Office — finish Chapter ${ch ? `${ch.id + 1}: ${ch.title}` : 'the Story'} 📜`, 3200);
      return;
    }
    this.open(kind);
  }

  _ordersUnlocked(p = this._p()) { return unlockedForVillage(this._story(p), p?.village).includes('owl_post_office'); }

  _refreshHud() {
    if (!this._hud) return;
    const p = this._p();
    if (!p) return;
    const { btns } = this._hud;
    btns.story.classList.toggle('bc-has-dot', isChapterComplete(this._story(p)));
    const unlocked = this._ordersUnlocked(p);
    btns.orders.classList.toggle('bc-locked', !unlocked);
    btns.orders.title = unlocked ? 'Order Board' : 'Locked — progress the Story';
    const crate = p.frontier?.campCrate?.items || {};
    btns.storage.classList.toggle('bc-has-dot', Object.values(crate).some((n) => n > 0));
    const hasReady = this._anyProductionReady(p);
    btns.build.classList.toggle('bc-has-dot', false);
    btns.storage.classList.toggle('bc-has-dot', btns.storage.classList.contains('bc-has-dot') || hasReady);
  }

  _anyProductionReady(p) {
    const now = this.now();
    for (const st of Object.values(p?.village?.production || {})) {
      if (Object.values(st?.output || {}).some((n) => n > 0) || (st?.tools || []).length) return true;
      if ((st?.queue || []).some((j) => j.doneAt <= now)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------------- 1. Story
  _viewStory(p) {
    const story = this._story(p);
    const idx = CHAPTERS.findIndex((c) => c.id === story.chapter);
    const ch = idx >= 0 ? CHAPTERS[idx] : null;
    let body = '';
    let foot = '';
    if (!ch) {
      body = `<div class="bc-note good">🌟 Every chapter of the Base Camp story is complete. More chapters are on the way!</div>`;
      return { title: '📜 Story Board', body, foot: '' };
    }
    const steps = currentSteps(story);
    const complete = steps.length > 0 && steps.every((s) => s.done);
    const doneN = steps.filter((s) => s.done).length;
    body += `<div class="bc-sec">Chapter ${ch.id + 1} · ${esc(ch.title)}<small>${doneN}/${steps.length} steps</small></div>`;
    body += '<div class="bc-steps">';
    for (const s of steps) {
      const pct = Math.min(100, Math.round((s.have / Math.max(1, s.count)) * 100));
      body += `<div class="bc-card${s.done ? ' bc-done' : ''}"><div class="bc-row">
        <span class="bc-check">${s.done ? '✅' : STEP_ICON[s.kind] || '•'}</span>
        <div class="bc-grow"><div class="bc-title">${esc(s.text)}</div>
        <div class="bc-bar${s.done ? ' ok' : ''}"><i style="width:${pct}%"></i><b>${fmtN(s.have)} / ${fmtN(s.count)}${s.done ? ' ✓' : ''}</b></div></div>
      </div></div>`;
    }
    body += '</div>';
    body += `<div class="bc-sec">🎁 Chapter Rewards</div><div class="bc-chips">${this._rewardChips(ch)}</div>`;
    const next = CHAPTERS[idx + 1];
    if (next) {
      body += `<div class="bc-sec">🔒 Next · Chapter ${next.id + 1}: ${esc(next.title)}</div>
        <div class="bc-card bc-dim"><div class="bc-sub">${next.steps.length} steps · unlocks ${esc((next.rewards.unlockBuildings || []).map((b) => coreOf(b).name).join(', ') || 'new adventures')}</div></div>`;
    }
    const hint = steps.find((s) => !s.done);
    if (hint) body += `<div class="bc-note">${this._stepHint(hint)}</div>`;
    foot = `<button type="button" class="bc-btn green" ${complete ? '' : 'disabled'} ${this._act(() => this._claimStory(ch))}>${complete ? '🎉 Claim Chapter Rewards' : `⏳ ${doneN}/${steps.length} steps done`}</button>`;
    return { title: '📜 Story Board', body, foot };
  }

  _rewardChips(ch) {
    const rw = ch.rewards || {};
    const chips = [];
    if (rw.gold) chips.push(`<span class="bc-chip brass">🪙 ${fmtN(rw.gold)}</span>`);
    for (const b of rw.unlockBuildings || []) if (b !== 'castle') chips.push(`<span class="bc-chip">${coreOf(b).emoji} ${esc(coreOf(b).name)}</span>`);
    for (const r of rw.unlockRegions || []) chips.push(`<span class="bc-chip">🗺️ ${esc(r)}</span>`);
    for (const r of rw.residents || []) chips.push(`<span class="bc-chip">🧑‍🌾 ${esc(RESIDENT_NAME[r] || r)}</span>`);
    if (rw.expandTo) chips.push(`<span class="bc-chip">🏝️ Island ${rw.expandTo}×${rw.expandTo}</span>`);
    for (const [k, n] of Object.entries(rw.items || {})) chips.push(`<span class="bc-chip">${matOf(k).emoji} ×${n}</span>`);
    return chips.join('') || '<span class="bc-chip">✨ Story progress</span>';
  }

  _stepHint(s) {
    switch (s.kind) {
      case 'gather': return `🏝️ Gather <b>${esc(matOf(s.target).name)}</b> out in the Sky Frontier.`;
      case 'visit': return '🧭 Explore the Sky Frontier to find this place.';
      case 'build': return `🔨 Construct a <b>${esc(coreOf(s.target).name)}</b> in the Build menu, then place it with 🛠️ Edit Grid.`;
      case 'craft': return `⚒️ Queue <b>${esc(matOf(s.target).name)}</b> in a production building and collect it.`;
      case 'deliver_orders': return '📋 Fill orders on the Order Board.';
      case 'harvest': return `🌾 Plant and harvest <b>${esc(matOf(s.target).name)}</b> on a Farm Plot.`;
      case 'defeat': return '⚔️ Defeat the guardian out in the Sky Frontier.';
      default: return '✨ Keep exploring!';
    }
  }

  async _claimStory(ch) {
    const r = await this._req('bc_story_claim', {}, '📜');
    if (!r.ok) return;
    const bits = [];
    if (r.gold) bits.push(`+${fmtN(r.gold)} 🪙`);
    const itemTxt = itemsLine(r.items);
    if (itemTxt) bits.push(itemTxt);
    const unlocked = (r.unlockBuildings || []).filter((b) => b !== 'castle').map((b) => `${coreOf(b).emoji} ${coreOf(b).name}`);
    if (unlocked.length) bits.push(`Unlocked ${unlocked.join(', ')}`);
    this.toast(`🎉 Chapter "${ch.title}" complete! ${bits.join(' • ')}`, 4200);
  }

  // ---------------------------------------------------------------------------------- 2. Build
  /** Build panel = 4 tabs: Build · Craft (camp props + cosmetic decor) · Residents · Monuments. */
  _viewBuild(p) {
    const tab = this.view?.tab || 'build';
    const tabs = [['build', '🔨 Build'], ['craft', '🪵 Craft'], ['residents', '🧑‍🌾 Residents'], ['monuments', '🏛️ Monuments']];
    const bar = `<div class="bc-tabs">${tabs.map(([k, label]) => `<button type="button" class="bc-tab${k === tab ? ' on' : ''}" ${this._act(() => this._setBuildTab(k))}>${label}</button>`).join('')}</div>`;
    let out;
    if (tab === 'craft') out = this._viewCraft(p);
    else if (tab === 'residents') out = this._viewResidents(p);
    else if (tab === 'monuments') out = this._viewMonuments(p);
    else out = this._viewBuildCore(p);
    return { ...out, body: bar + out.body };
  }

  _setBuildTab(tab) {
    if (!this.view) return;
    this.view.tab = tab;
    this.render();
    // read-only loads run the server's lazy tick (residents eat, camp props accrue) → fresh profile push
    if (tab === 'residents') this.request?.('bc_residents', {});
    else if (tab === 'monuments' || tab === 'craft') this.request?.('bc_monuments', {});
  }

  _viewBuildCore(p) {
    const v = p?.village || {};
    const story = this._story(p);
    const unlocked = unlockedForVillage(story, v);
    const copies = v.copies || {};
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    let body = '';
    if (this.justBuilt) {
      const d = coreOf(this.justBuilt);
      body += `<div class="bc-note good">✅ ${d.emoji} <b>${esc(d.name)}</b> is ready in your Bag. Open <b>🛠️ Edit Grid</b> and place it from the Bag tab.
        ${this.onEnterEdit ? `<div style="margin-top:6px"><button type="button" class="bc-btn green" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Place it now</button></div>` : ''}</div>`;
    }
    // Castle (Starlight Keep)
    const cLv = v.castle_lv || 1;
    const cCap = castleLevelCap(story);
    const cCost = upgradeCost('castle', cLv);
    body += `<div class="bc-sec">🏰 Starlight Keep<small>Lv. ${cLv} · Story cap Lv. ${cCap}</small></div>
      <div class="bc-card"><div class="bc-row"><span class="bc-big-ico">🏰</span><div class="bc-grow">
        <div class="bc-title">${esc(coreOf('castle').name)}${v.castle_ruins ? ' <span class="bc-tag">Ruins</span>' : ''}</div>
        <div class="bc-sub">${v.castle_ruins ? 'Finish Chapter 1 (Landfall) to clear the rubble.' : cLv >= MAX_CORE_LV ? `👑 Max level · ${plotCap(cLv)} farm plots` : `Upgrade to Lv. ${cLv + 1} — more farm plots (${plotCap(cLv)} → ${plotCap(cLv + 1)})`}</div>
        ${cLv < MAX_CORE_LV ? `<div class="bc-chips">${this._costChips(cCost, p)}</div>` : ''}
      </div>
      ${cLv >= MAX_CORE_LV ? '<span class="bc-tag">MAX</span>'
        : `<button type="button" class="bc-btn" ${cLv + 1 > cCap || !this._canAfford(cCost, p) ? 'disabled' : ''} ${this._act(() => this._upgrade('castle'))}>${cLv + 1 > cCap ? '🔒 Story' : '⬆️ Upgrade'}</button>`}
      </div></div>`;

    body += '<div class="bc-sec">🔨 Buildings</div>';
    const types = unlocked.filter((t) => t !== 'castle' && CORE[t]);
    if (!types.length) body += '<div class="bc-note">Complete the first 📜 Story chapter to unlock your first buildings.</div>';
    for (const type of types) {
      const d = coreOf(type);
      const have = copies[type] | 0;
      const cap = type === 'farm_plot' ? plotCap(v.castle_lv) : maxCopies(v, type);
      const cost = buildCost(type, have);
      const full = have >= cap;
      const lv = v.levels?.[type] || 1;
      const prod = PRODUCTION_BUILDINGS[type];
      const sub = prod ? `Makes ${prod.map((id) => recipeIcon(RECIPES[id])).join(' ')}` : type === 'farm_plot' ? 'Grow crops for your kitchen' : type === 'tent' ? 'Rest spot for your camp' : '';
      body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(d.name)}</div>
          <div class="bc-sub">Owned ${have}/${cap} · placed ${placed[type] || 0}${have ? ` · Lv. ${lv}` : ''}${sub ? ` · ${sub}` : ''}</div>
          ${full ? '' : `<div class="bc-chips">${this._costChips(cost, p)}</div>`}
        </div>
        <button type="button" class="bc-btn green" ${full || !this._canAfford(cost, p) ? 'disabled' : ''} ${this._act(() => this._construct(type))}>${full ? 'Max' : have ? '+ Copy' : 'Construct'}</button>
      </div>`;
      if (have > 0 && type !== 'farm_plot' && type !== 'tent') {
        const uc = upgradeCost(type, lv);
        body += lv >= MAX_CORE_LV
          ? '<div class="bc-sub" style="margin-top:5px">👑 Max level</div>'
          : `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub">⬆️ Lv. ${lv} → ${lv + 1}${prod ? ` · queue ${queueSlots(lv)} → ${queueSlots(lv + 1)}` : ''}</div><div class="bc-chips">${this._costChips(uc, p)}</div></div>
             <button type="button" class="bc-btn" ${this._canAfford(uc, p) ? '' : 'disabled'} ${this._act(() => this._upgrade(type))}>Upgrade</button></div>`;
      }
      body += '</div>';
    }
    // Locked preview (next chapter)
    const next = CHAPTERS.find((c) => c.id === story.chapter);
    const lockedNext = (next?.rewards?.unlockBuildings || []).filter((t) => !unlocked.includes(t) && CORE[t]);
    if (lockedNext.length) {
      body += `<div class="bc-sec">🔒 Unlocks with Chapter ${next.id + 1}: ${esc(next.title)}</div>`;
      for (const t of lockedNext) {
        body += `<div class="bc-card bc-dim"><div class="bc-row"><span class="bc-big-ico">${coreOf(t).emoji}</span><div class="bc-grow"><div class="bc-title">${esc(coreOf(t).name)}</div><div class="bc-chips">${this._costChips(buildCost(t, 0), p)}</div></div><span class="bc-tag">🔒</span></div></div>`;
      }
    }
    body += '<div class="bc-note">New buildings go to your Bag — place them with <b>🛠️ Edit Grid</b>.</div>';
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🔨 Build', body, foot };
  }

  async _construct(type) {
    const r = await this._req('bc_construct', { building: type }, '🔨');
    if (!r.ok) return;
    this.justBuilt = type;
    this.toast(`🔨 ${coreOf(type).emoji} ${coreOf(type).name} built! Place it from your Bag with 🛠️ Edit Grid.`, 3400);
    this.render({ keepScroll: false });
  }

  async _upgrade(type) {
    const r = await this._req('bc_upgrade', { building: type }, '⬆️');
    if (!r.ok) return;
    this.toast(`⬆️ ${coreOf(type).emoji} ${coreOf(type).name} is now Lv. ${r.lv}!`, 2800);
  }

  // ---------------------------------------------------------------------------------- 3/4. Placed buildings
  /** Should main.js route a tap on this placed building type to Base Camp? */
  handles(type) { return !!PRODUCTION_BUILDINGS[type] || !!EXTRA_BUILDINGS[type] || type === 'farm_plot'; }

  /**
   * Open the production / farm-plot sheet for a placed building.
   * @param {{owner:string, uid:string, type:string, village?:object}} pick  `village` = the owner's
   *        village when it isn't mine (from the instance layout; publicVillage carries production/plots).
   */
  openBuilding(pick) {
    if (!pick?.uid || !this.handles(pick.type)) return false;
    this.open(pick.type === 'farm_plot' ? 'plot' : 'production', { owner: pick.owner, uid: pick.uid, type: pick.type, village: pick.village || null });
    return true;
  }

  _villageFor(view, p) {
    if (view.owner && p && view.owner === p.id) return p.village || {};
    return view.village || {};
  }

  _viewProduction(p) {
    const view = this.view;
    const mine = !!p && view.owner === p.id;
    const v = this._villageFor(view, p);
    const d = placeDef(view.type);
    const lv = EXTRA_BUILDINGS[view.type] ? (v.wonders?.[view.type]?.stars || 1) : (v.levels?.[view.type] || 1);
    const slots = queueSlots(lv);
    const st = v.production?.[view.uid] || { queue: [], output: {}, tools: [] };
    const now = this.now();
    const ready = { ...(st.output || {}) };
    const readyTools = [...(st.tools || [])];
    const running = [];
    for (const job of st.queue || []) {
      const rc = recipeOf(job.recipe);
      if (job.doneAt <= now) {
        if (rc?.tool) readyTools.push(rc.tool);
        else for (const [k, n] of Object.entries(rc?.outputs || {})) ready[k] = (ready[k] || 0) + n;
      } else running.push(job);
    }
    const used = (st.queue || []).length;
    const anyReady = Object.values(ready).some((n) => n > 0) || readyTools.length > 0;
    let body = `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
      <div class="bc-title">${esc(d.name)} <span class="bc-tag">Lv. ${lv}</span></div>
      <div class="bc-sub">${mine ? 'Queue goods from your Warehouse materials.' : `🏝️ ${esc(view.owner)}'s workshop`}</div></div></div></div>`;

    // Ready output
    body += `<div class="bc-sec">📦 Ready to collect</div>`;
    if (anyReady) {
      body += `<div class="bc-chips">${Object.entries(ready).filter(([, n]) => n > 0).map(([k, n]) => `<span class="bc-chip ok">${matOf(k).emoji} ${esc(matOf(k).name)} ×${n}</span>`).join('')}${readyTools.map((t) => `<span class="bc-chip ok">${TOOL_ICON[t.kind] || '🛠️'} ${esc(t.kind)} T${t.tier}</span>`).join('')}</div>`;
    } else body += '<div class="bc-sub">Nothing waiting yet.</div>';

    // Queue
    body += `<div class="bc-sec">⏳ Queue<small>${used}/${slots} slots</small></div>`;
    if (running.length) {
      for (const job of running) {
        const rc = recipeOf(job.recipe) || { outputs: {} };
        const started = job.startAt <= now;
        body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico" style="font-size:20px">${recipeIcon(rc)}</span><div class="bc-grow">
          <div class="bc-title">${esc(recipeName(rc))}</div>${started ? this._bar(job.startAt, job.doneAt, '') : `<div class="bc-sub" data-until="${job.startAt}" data-label="Starts in">Starts in ${fmtDur(job.startAt - now)}</div>`}
        </div></div></div>`;
        if (!started) this._edgeAt = Math.min(this._edgeAt, job.startAt);
        this._edgeAt = Math.min(this._edgeAt, job.doneAt);
      }
    } else body += '<div class="bc-sub">The queue is idle.</div>';
    if (used >= slots && anyReady) body += '<div class="bc-note">Finished goods still occupy queue slots — collect them to free space.</div>';

    // Recipes
    body += '<div class="bc-sec">📖 Recipes</div>';
    const staff = mine ? (p.village?.residents || []).find((r) => r && r.building === view.type) : null;
    if (staff) {
      const def = RESIDENTS[staff.id] || {};
      const mult = buildingSpeedMult(p.village.residents, view.type, now);
      body += `<div class="bc-note good">${def.emoji || '🧑'} <b>${esc(def.name || staff.id)}</b> staffs this building · +${Math.round((mult - 1) * 100)}% speed${isFed(staff, now) ? '' : ' (hungry — half bonus)'}</div>`;
    }
    for (const rid of recipesFor(view.type)) {
      const rc = recipeOf(rid);
      if (!rc) continue;
      const lockedLv = lv < (rc.minLv || 1);
      const afford = this._canAfford(rc.inputs, p);
      const disabled = !mine || lockedLv || used >= slots || !afford;
      const label = !mine ? '—' : lockedLv ? `🔒 Lv.${rc.minLv}` : used >= slots ? 'Full' : 'Queue';
      const outTxt = rc.tool ? `${TOOL_ICON[rc.tool.kind] || '🛠️'} Tool tier ${rc.tool.tier}` : itemsLine(rc.outputs);
      body += `<div class="bc-card${lockedLv ? ' bc-dim' : ''}"><div class="bc-row"><span class="bc-big-ico">${recipeIcon(rc)}</span><div class="bc-grow">
          <div class="bc-title">${esc(recipeName(rc))} <span class="bc-sub">→ ${outTxt} · ⏱ ${fmtDur(rc.ms)}</span></div>
          <div class="bc-chips">${mine ? this._costChips(rc.inputs, p) : `<span class="bc-chip">${itemsLine(rc.inputs)}</span>`}</div>
        </div>
        <button type="button" class="bc-btn" ${disabled ? 'disabled' : ''} ${this._act(() => this._enqueue(view.uid, rid))}>${label}</button>
      </div></div>`;
    }
    let foot = '';
    if (mine) {
      foot += `<button type="button" class="bc-btn green" ${anyReady ? '' : 'disabled'} ${this._act(() => this._collect(view.uid))}>📦 Collect</button>`;
      if (this.onOpenLegacy) foot += `<button type="button" class="bc-btn plain" ${this._act(() => { const pk = { owner: view.owner, uid: view.uid }; this.close(); this.onOpenLegacy(pk); })}>⚙️ Move / Bag</button>`;
    }
    return { title: `${d.emoji} ${d.name}`, body, foot };
  }

  async _enqueue(uid, recipe) {
    const r = await this._req('bc_enqueue', { uid, recipe }, '⏳');
    if (!r.ok) return;
    const rc = recipeOf(recipe);
    const ms = Math.round(rc.ms / (r.speedMult > 0 ? r.speedMult : 1));
    this.toast(`⏳ Queued ${recipeIcon(rc)} ${recipeName(rc)} — ready in ${fmtDur(ms)}`, 2200);
  }

  async _collect(uid) {
    const r = await this._req('bc_collect', { uid }, '📦');
    if (!r.ok) return;
    const bits = [itemsLine(r.collected)];
    for (const t of r.tools || []) bits.push(`${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}!`);
    const bonus = itemsLine(r.bonus);
    if (bonus) bits.push(`(✨ staff bonus ${bonus})`);
    const left = itemsLine(r.leftover);
    this.toast(`📦 Collected ${bits.filter(Boolean).join(' ')}${left ? ` • storage full, left ${left}` : ''}`, 2800);
  }

  _viewPlot(p) {
    const view = this.view;
    const mine = !!p && view.owner === p.id;
    const v = this._villageFor(view, p);
    const plot = v.plots?.[view.uid] || { crop: null };
    const now = this.now();
    let body = '';
    let foot = '';
    if (!plot.crop) {
      if (!mine) {
        body = `<div class="bc-note">🌱 This plot is resting — nothing to water right now.</div>`;
      } else {
        body = '<div class="bc-sec">🌱 Choose a crop</div>';
        for (const [cid, c] of Object.entries(CROPS)) {
          const seed = c.plant || {};
          const free = !Object.keys(seed).length;
          const ok = this._canAfford(seed, p);
          body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${matOf(cid).emoji}</span><div class="bc-grow">
              <div class="bc-title">${esc(matOf(cid).name)} <span class="bc-sub">⏱ ${fmtDur(c.ms)} · yields ${itemsLine(c.yield)}</span></div>
              <div class="bc-chips">${free ? '<span class="bc-chip ok">🌱 Free seeds</span>' : this._costChips(seed, p)}</div>
            </div><button type="button" class="bc-btn green" ${ok ? '' : 'disabled'} ${this._act(() => this._plant(view.uid, cid))}>Plant</button></div></div>`;
        }
      }
    } else {
      const c = CROPS[plot.crop] || { ms: 1, yield: {} };
      const m = matOf(plot.crop);
      const isReady = plot.readyAt <= now;
      body += `<div class="bc-card${isReady ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">${m.emoji}</span><div class="bc-grow">
        <div class="bc-title">${esc(m.name)} ${isReady ? '<span class="bc-tag">Ready!</span>' : ''}</div>
        ${isReady ? `<div class="bc-sub">Yields ${itemsLine(c.yield)}</div>` : this._bar(plot.plantedAt || (plot.readyAt - c.ms), plot.readyAt, 'Growing')}
        <div class="bc-sub">${plot.wateredBy ? `💧 Watered by ${esc(plot.wateredBy === true ? 'a friend' : plot.wateredBy)} (−25% time)` : '💧 Not watered yet — friends can speed it up'}</div>
      </div></div></div>`;
      if (!isReady) this._edgeAt = Math.min(this._edgeAt, plot.readyAt);
      if (mine) {
        foot = `<button type="button" class="bc-btn green" ${isReady ? '' : 'disabled'} ${this._act(() => this._harvestPlot(view.uid))}>${isReady ? '🌾 Harvest' : '⏳ Growing…'}</button>`;
      } else if (!isReady) {
        foot = `<button type="button" class="bc-btn green" ${plot.wateredBy ? 'disabled' : ''} ${this._act(() => this._water(view.owner, view.uid))}>${plot.wateredBy ? '💧 Already watered' : '💧 Water (−25% time)'}</button>`;
      }
    }
    if (!mine && !plot.crop) foot = '';
    if (mine && this.onOpenLegacy) foot += `<button type="button" class="bc-btn plain" ${this._act(() => { const pk = { owner: view.owner, uid: view.uid }; this.close(); this.onOpenLegacy(pk); })}>⚙️ Move</button>`;
    return { title: `🌾 Farm Plot${mine ? '' : ` · ${view.owner}`}`, body, foot, small: true };
  }

  async _plant(uid, crop) {
    const r = await this._req('bc_plant', { uid, crop }, '🌱');
    if (r.ok) this.toast(`🌱 Planted ${matOf(crop).emoji} ${matOf(crop).name} — ready in ${fmtDur(CROPS[crop].ms)}`, 2400);
  }

  async _harvestPlot(uid) {
    const r = await this._req('bc_harvest_plot', { uid }, '🌾');
    if (r.ok) this.toast(`🌾 Harvested ${itemsLine(r.items)}`, 2400);
  }

  async _water(owner, uid) {
    const r = await this._req('bc_water', { owner, uid }, '💧');
    if (!r.ok) return;
    this.toast(`💧 You watered ${owner}'s crops — 25% faster!`, 2400);
    // reflect it locally until the next village_updated / layout arrives
    const plot = this.view?.village?.plots?.[uid];
    if (plot) { plot.wateredBy = this._p()?.id || true; if (Number.isFinite(r.readyAt)) plot.readyAt = r.readyAt; }
    this.render({ keepScroll: true });
  }

  // ---------------------------------------------------------------------------------- 2b. Craft (camp props + decor)
  _viewCraft(p) {
    const v = p?.village || {};
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    const today = utcDay(this.now());
    let body = '';
    // camp-prop actions
    const ready = {};
    for (const st of Object.values(v.prop_state || {})) for (const [k, n] of Object.entries(st?.ready || {})) ready[k] = (ready[k] || 0) + n;
    const hasTent = (placed.dec_tent | 0) > 0;
    const breadToday = v.tent_bread_day === today;
    const anyProducer = (placed.dec_honey_beehive | 0) + (placed.dec_koi_barrel_pond | 0) > 0;
    if (hasTent || anyProducer) {
      body += '<div class="bc-sec">🏕️ Camp Prop perks</div><div class="bc-card"><div class="bc-row" style="flex-wrap:wrap">';
      if (hasTent) body += `<button type="button" class="bc-btn green" ${breadToday ? 'disabled' : ''} ${this._act(() => this._tentBread())}>${breadToday ? '⛺ Bread claimed today' : '⛺ Free Bread'}</button>`;
      if (anyProducer) {
        const txt = itemsLine(ready);
        body += `<button type="button" class="bc-btn" ${txt ? '' : 'disabled'} ${this._act(() => this._collectProps())}>${txt ? `📦 Collect ${txt}` : '🐝 Props working…'}</button>`;
      }
      body += '</div></div>';
    }
    const card = (key, cost) => {
      const d = DECOR[key];
      if (!d) return '';
      const owned = v.decor?.[key] | 0;
      return `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(d.name)}</div>
          <div class="bc-sub">${esc(d.effect || '')} · owned ${owned} · placed ${placed[key] || 0}</div>
          <div class="bc-chips">${this._costChips(cost, p)}</div>
        </div><button type="button" class="bc-btn green" ${this._canAfford(cost, p) ? '' : 'disabled'} ${this._act(() => this._craftDecor(key))}>Craft</button></div></div>`;
    };
    body += '<div class="bc-sec">🏕️ Camp Props<small>functional</small></div>';
    for (const [k, def] of Object.entries(CAMP_PROPS)) body += card(k, def.cost);
    body += '<div class="bc-sec">🌸 Cosmetic Decor<small>+Comfort</small></div>';
    for (const [k, def] of Object.entries(COSMETIC_DECOR)) body += card(k, def.cost);
    body += '<div class="bc-note">Crafted decor goes to your Bag — place it with <b>🛠️ Edit Grid</b>. Retired decor you already own stays placeable.</div>';
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🪵 Craft Decor', body, foot };
  }

  async _craftDecor(key) {
    const r = await this._req('bc_craft_decor', { decor: key }, '🪵');
    if (r.ok) this.toast(`🪵 Crafted ${DECOR[key]?.emoji || ''} ${DECOR[key]?.name || key}! Place it from your Bag.`, 2800);
  }

  async _tentBread() {
    const r = await this._req('bc_tent_bread', {}, '⛺');
    if (r.ok) this.toast('⛺ Fresh campfire Bread! 🍞 +1', 2200);
  }

  async _collectProps() {
    const r = await this._req('bc_props_collect', {}, '📦');
    if (r.ok) this.toast(`📦 Camp props gave ${itemsLine(r.collected)}`, 2400);
  }

  // ---------------------------------------------------------------------------------- 2c. Residents
  _viewResidents(p) {
    const v = p?.village || {};
    const now = this.now();
    const residents = Array.isArray(v.residents) ? v.residents : [];
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    const cottages = placed.cottage | 0;
    const used = residents.filter((r) => r?.building).length;
    const beds = housingCap(cottages);
    let body = `<div class="bc-sec">🏡 Settler Cottages<small>${used}/${beds} beds · cottage cap ${cottageCap(v.comfort)}</small></div>`;
    if (!residents.length) {
      body += '<div class="bc-note">No residents yet — finish 📜 Story chapters to welcome settlers to your camp.</div>';
      return { title: '🧑‍🌾 Residents', body, foot: '' };
    }
    const pantryItems = p?.frontier?.pantry?.items || {};
    const meals = Object.keys(MEAL_QUALITY).filter((k) => (pantryItems[k] | 0) > 0);
    body += `<div class="bc-note${meals.length ? '' : ''}">🍽️ Residents eat 1 meal every 4 h from the Pantry (best meal first)${meals.length ? `: ${meals.map((k) => `${matOf(k).emoji}×${pantryItems[k]}`).join(' ')}` : ' — <b>the Pantry has no meals!</b> Hungry residents give half their bonus.'}</div>`;
    for (const r of residents) {
      const def = RESIDENTS[r.id] || { name: r.id, emoji: '🧑', building: null, speed: 0, bonusChance: 0 };
      const fed = isFed(r, now);
      const home = def.building;
      const homePlaced = (placed[home] | 0) > 0;
      if (fed && r.fedUntil > now) this._edgeAt = Math.min(this._edgeAt, r.fedUntil);
      const mult = r.building ? buildingSpeedMult(residents, r.building, now) : 1 + (def.speed || 0);
      const opts = [`<option value="">💤 Off duty</option>`];
      if (home) opts.push(`<option value="${esc(home)}" ${r.building === home ? 'selected' : ''} ${homePlaced ? '' : 'disabled'}>${coreOf(home).emoji} ${esc(coreOf(home).name)}${homePlaced ? '' : ' (not placed)'}</option>`);
      body += `<div class="bc-card${r.building ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">${def.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(def.name)}</div>
          <div class="bc-sub">Works at ${coreOf(home).emoji} ${esc(coreOf(home).name)} · +${Math.round((def.speed || 0) * 100)}% speed · ${Math.round((def.bonusChance || 0) * 100)}% bonus output</div>
          <div class="bc-chips">
            <span class="bc-chip ${fed ? 'ok' : 'bad'}">${fed ? `🍞 Fed · ${fmtDur(r.fedUntil - now)}` : '😣 Hungry'}</span>
            <span class="bc-chip brass">😊 Mood ${Math.round(r.mood ?? 50)}</span>
            ${r.building ? `<span class="bc-chip ok">⚡ ×${mult.toFixed(2)}</span>` : ''}
          </div>
        </div>
        <select class="bc-sel" aria-label="Assign ${esc(def.name)}" ${this._actSel((val) => this._assignResident(r.id, val || null))}>${opts.join('')}</select>
      </div></div>`;
    }
    if (used >= beds) body += '<div class="bc-note">All beds are taken — build and place another 🏡 Settler Cottage to staff more buildings.</div>';
    return { title: '🧑‍🌾 Residents', body, foot: '' };
  }

  async _assignResident(id, building) {
    const r = await this._req('bc_resident_assign', { residentId: id, building }, '🧑‍🌾');
    const def = RESIDENTS[id] || { name: id, emoji: '🧑' };
    if (r.ok) this.toast(building ? `${def.emoji} ${def.name} now staffs the ${coreOf(building).name}!` : `${def.emoji} ${def.name} is off duty.`, 2400);
    else this.render({ keepScroll: true });   // snap the dropdown back
  }

  // ---------------------------------------------------------------------------------- 2d. Monuments
  _viewMonuments(p) {
    const v = p?.village || {};
    const now = this.now();
    const mons = v.monuments || {};
    const st = { unlocked: [...(v.monument_unlocks || [])] };
    for (const id of Object.keys(MONUMENTS)) st[id] = mons[id] || { stage: 0, built: false };
    const placed = new Set((v.buildings || []).map((b) => b.type));
    let body = '<div class="bc-note">🏛️ Monuments are built stage by stage from materials + Gold. Stage 1 puts one in your Bag; place it with 🛠️ Edit Grid to use its power.</div>';
    for (const id of LAUNCH_MONUMENTS) {
      const def = MONUMENTS[id];
      const w = WONDERS[id] || { emoji: '🏛️' };
      const m = st[id];
      const stage = m.stage | 0;
      const total = def.stages.length;
      const unlocked = monumentUnlocked(id, st.unlocked, st);
      const next = def.stages[stage] || null;
      const built = stage >= 1;
      let actions = '';
      if (built && id === 'wnd_onsen') {
        const readyAt = (v.onsen_used_at || 0) + ONSEN_COOLDOWN_MS;
        const cd = readyAt > now;
        if (cd) this._edgeAt = Math.min(this._edgeAt, readyAt);
        actions = `<button type="button" class="bc-btn green" ${!placed.has(id) || cd ? 'disabled' : ''} ${this._act(() => this._useOnsen())}>${cd ? `♨️ ${fmtDur(readyAt - now)}` : '♨️ Soak'}</button>`;
      } else if (built && id === 'wnd_fountain') {
        const wished = v.wish_day === utcDay(now);
        actions = `<button type="button" class="bc-btn green" ${!placed.has(id) || wished || (p?.gold | 0) < WISH_COST ? 'disabled' : ''} ${this._act(() => this._wish())}>${wished ? '⛲ Wished today' : `⛲ Wish · ${WISH_COST} 🪙`}</button>`;
      }
      const rest = id === 'wnd_onsen' && p?.frontier?.restBuff?.until > now ? `<span class="bc-chip ok">😌 Well-Rested ${fmtDur(p.frontier.restBuff.until - now)}</span>` : '';
      body += `<div class="bc-card${unlocked ? '' : ' bc-dim'}${stage >= total ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">${w.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(def.name)} <span class="bc-tag">${stage}/${total}</span>${def.heartIsleOnly ? ' <span class="bc-tag">💞 Heart Isle</span>' : ''}</div>
          <div class="bc-sub">${esc(MON_EFFECT[id] || '')}</div>
          ${built && !placed.has(id) && !def.heartIsleOnly ? '<div class="bc-sub">📦 In your Bag — place it with 🛠️ Edit Grid.</div>' : ''}
          ${rest ? `<div class="bc-chips">${rest}</div>` : ''}
          ${unlocked && next ? `<div class="bc-sub" style="margin-top:3px">Stage ${stage + 1} cost:</div><div class="bc-chips">${this._costChips(next, p)}</div>` : ''}
          ${unlocked ? '' : `<div class="bc-sub">🔒 ${id === 'wnd_onsen' ? 'Unlocks with Chapter 5: Feathered Things' : 'Unlocks when the Capybara Hot Spring is complete'}</div>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${next ? `<button type="button" class="bc-btn" ${unlocked && this._canAfford(next, p) ? '' : 'disabled'} ${this._act(() => this._contributeMonument(id))}>${stage ? '⬆️ Build' : '🏗️ Build'}</button>` : '<span class="bc-tag">✨ Complete</span>'}
          ${actions}
        </div></div></div>`;
    }
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🏛️ Monuments', body, foot };
  }

  async _contributeMonument(id) {
    const r = await this._req('bc_monument_contribute', { monument: id }, '🏛️');
    if (!r.ok) return;
    const name = MONUMENTS[id]?.name || id;
    this.toast(r.built ? `🏛️ ${name} is complete! ✨` : `🏗️ ${name} stage ${r.stage} built — find it in your Bag!`, 3200);
  }

  async _useOnsen() {
    const r = await this._req('bc_monument_use', { monument: 'wnd_onsen' }, '♨️');
    if (r.ok) this.toast('♨️ Ahh~ Well-Rested! +15% gather yield for 30 min', 2800);
  }

  async _wish() {
    const r = await this._req('bc_wish', {}, '⛲');
    if (r.ok) this.toast(`⛲ Your wish came true: ${itemsLine(r.items)}`, 3000);
  }

  // ---------------------------------------------------------------------------------- 5. Orders
  async _loadOrders() {
    this._ordersLoading = true;
    const r = await this._req('bc_orders', {}, '📋');
    this._ordersLoading = false;
    if (r.ok && r.board) this.board = r.board;
    if (this.view?.kind === 'orders') this.render({ keepScroll: true });
  }

  _viewOrders(p) {
    const board = p?.orders || this.board;
    if (!board) {
      return { title: '📋 Order Board', body: `<div class="bc-note">${this._ordersLoading ? '🦉 The owls are fetching today\'s orders…' : 'No orders yet.'}</div>`, foot: '' };
    }
    const now = this.now();
    let body = `<div class="bc-sec">🦉 Orders<small>${(board.slots || []).filter(Boolean).length}/${(board.slots || []).length}</small></div>`;
    (board.slots || []).forEach((o, i) => {
      if (!o) {
        const at = board.nextRefreshAt?.[i] || 0;
        body += `<div class="bc-card bc-dim"><div class="bc-row"><span class="bc-big-ico">✉️</span><div class="bc-grow"><div class="bc-title">Waiting for a new order</div>
          ${at > now ? `<div class="bc-sub" data-until="${at}" data-label="Next owl in">Next owl in ${fmtDur(at - now)}</div>` : '<div class="bc-sub">Tap 🔄 Refresh to fetch it.</div>'}</div></div></div>`;
        return;
      }
      const can = this._canAfford(o.items, p);
      body += `<div class="bc-card${can ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">🧑‍🍳</span><div class="bc-grow">
          <div class="bc-title">${esc(o.npc || 'Villager')}</div>
          <div class="bc-chips">${this._costChips(o.items, p)}</div>
          <div class="bc-chips"><span class="bc-chip brass">🪙 ${fmtN(o.gold)}</span><span class="bc-chip brass">✨ ${fmtN(o.xp)} XP</span>${itemsLine(o.extra) ? `<span class="bc-chip brass">🎁 ${itemsLine(o.extra)}</span>` : ''}</div>
        </div></div>
        <div class="bc-row" style="margin-top:6px;justify-content:flex-end;gap:6px">
          <button type="button" class="bc-btn red" ${this._act(() => this._discardOrder(i))}>Discard</button>
          <button type="button" class="bc-btn green" ${can ? '' : 'disabled'} ${this._act(() => this._fillOrder(i, o))}>Deliver</button>
        </div></div>`;
    });
    const big = board.big;
    body += '<div class="bc-sec">🏆 Daily Big Order</div>';
    if (!big) {
      body += '<div class="bc-note">No Big Order today — build more production buildings to unlock one.</div>';
    } else {
      const items = big.items || {};
      const fulfilled = big.fulfilled || {};
      const total = Object.values(items).reduce((s, n) => s + n, 0);
      const doneU = Object.entries(items).reduce((s, [k, n]) => s + Math.min(n, fulfilled[k] || 0), 0);
      const contrib = this._bigContribution(big, p);
      body += `<div class="bc-card${big.complete ? ' bc-done' : ''}">
        <div class="bc-chips">${Object.entries(items).map(([k, n]) => {
          const f = Math.min(n, fulfilled[k] || 0);
          return `<span class="bc-chip ${f >= n ? 'ok' : ''}">${matOf(k).emoji} ${f}/${n}${f < n ? ` · have ${this._have(k, p)}` : ' ✓'}</span>`;
        }).join('')}</div>
        <div class="bc-bar${big.complete ? ' ok' : ''}"><i style="width:${total ? Math.round((doneU / total) * 100) : 0}%"></i><b>${doneU}/${total}</b></div>
        <div class="bc-chips"><span class="bc-chip brass">🪙 ${fmtN(big.gold)}</span><span class="bc-chip brass">✨ ${fmtN(big.xp)} XP</span><span class="bc-chip">👥 ${Object.keys(big.contributors || {}).length} helpers</span></div>
        <div class="bc-sub" style="margin-top:4px">Rewards are shared by everyone who contributes, in proportion to what they gave.</div>
        ${big.complete ? '<div class="bc-note good">🎉 Completed! Rewards were paid out.</div>'
          : `<div class="bc-row" style="margin-top:6px;justify-content:flex-end"><button type="button" class="bc-btn green" ${Object.keys(contrib).length ? '' : 'disabled'} ${this._act(() => this._contributeBig(contrib))}>🤝 Contribute ${itemsLine(contrib) || '(nothing needed in stock)'}</button></div>`}
      </div>`;
    }
    const foot = `<button type="button" class="bc-btn plain" ${this._act(() => this._loadOrders())}>🔄 Refresh</button>`;
    return { title: '📋 Order Board', body, foot };
  }

  _bigContribution(big, p) {
    const out = {};
    for (const [k, n] of Object.entries(big.items || {})) {
      const need = Math.max(0, n - (big.fulfilled?.[k] || 0));
      const give = Math.min(need, this._have(k, p));
      if (give > 0) out[k] = give;
    }
    return out;
  }

  async _fillOrder(slot, o) {
    const r = await this._req('bc_order_fill', { slot }, '📋');
    if (!r.ok) return;
    if (r.board) this.board = r.board;
    this.toast(`📋 Delivered to ${o.npc || 'a villager'}! +${fmtN(r.gold)} 🪙 +${fmtN(r.xp)} XP${r.levelsGained ? ' 🎉 LEVEL UP!' : ''}`, 2800);
    this.render({ keepScroll: true });
  }

  async _discardOrder(slot) {
    const r = await this._req('bc_order_discard', { slot }, '📋');
    if (!r.ok) return;
    if (r.board) this.board = r.board;
    this.toast('🗑️ Order discarded — a new owl will arrive soon.', 2000);
    this.render({ keepScroll: true });
  }

  async _contributeBig(items) {
    const r = await this._req('bc_big_contribute', { items }, '🏆');
    if (!r.ok) return;
    if (r.big && this.board) this.board = { ...this.board, big: r.big };
    const me = r.rewards?.[this._p()?.id];
    this.toast(r.complete ? `🏆 Big Order complete!${me ? ` +${fmtN(me.gold)} 🪙 +${fmtN(me.xp)} XP` : ''}` : `🤝 Contributed ${itemsLine(r.contributed)}`, 3000);
    this.render({ keepScroll: true });
  }

  // ---------------------------------------------------------------------------------- 6. Storage
  _viewStorage(p) {
    const stores = this._stores(p);
    const fr = p?.frontier || {};
    let body = '';
    for (const kind of ['warehouse', 'pantry']) {
      const st = stores[kind];
      const lv = st.lv || 1;
      const cap = storeCap(kind, lv);
      const used = storeUsed(st);
      const pct = Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
      const entries = Object.entries(st.items || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      const cost = storeUpgradeCost(kind, lv);
      body += `<div class="bc-sec">${kind === 'warehouse' ? '🏚️ Warehouse' : '🧺 Pantry'}<small>Lv. ${lv}</small></div>
        <div class="bc-card"><div class="bc-bar${pct >= 100 ? '' : ' ok'}"><i style="width:${pct}%;${pct >= 90 ? 'background:linear-gradient(90deg,#c4523d,#f2b3a3)' : ''}"></i><b>${fmtN(used)} / ${fmtN(cap)}</b></div>
        ${entries.length ? `<div class="bc-grid" style="margin-top:7px">${entries.map(([k, n]) => `<div class="bc-cell" title="${esc(matOf(k).name)}"><span class="e">${matOf(k).emoji}</span>${fmtN(n)}<span class="n">${esc(matOf(k).name)}</span></div>`).join('')}</div>`
          : `<div class="bc-sub" style="margin-top:6px">${kind === 'warehouse' ? 'Empty — gather materials in the Sky Frontier.' : 'Empty — cook food in the Patisserie.'}</div>`}
        ${lv >= MAX_STORE_LV ? '<div class="bc-sub" style="margin-top:6px">👑 Max level</div>'
          : `<div class="bc-row" style="margin-top:7px"><div class="bc-grow"><div class="bc-sub">⬆️ Lv. ${lv + 1}: ${fmtN(storeCap(kind, lv + 1))} capacity</div><div class="bc-chips">${this._costChips(cost, p)}</div></div>
             <button type="button" class="bc-btn" ${this._canAfford(cost, p) ? '' : 'disabled'} ${this._act(() => this._storeUpgrade(kind))}>Upgrade</button></div>`}
        </div>`;
    }
    const crate = fr.campCrate || { items: {}, expiresAt: 0 };
    const crateItems = Object.entries(crate.items || {}).filter(([, n]) => n > 0);
    if (crateItems.length) {
      const now = this.now();
      body += `<div class="bc-sec">📦 Camp Crate<small>${crate.expiresAt > now ? `<span data-until="${crate.expiresAt}" data-label="expires in">expires in ${fmtDur(crate.expiresAt - now)}</span>` : ''}</small></div>
        <div class="bc-card"><div class="bc-sub">Overflow from full storage waits here for 24h.</div>
        <div class="bc-grid" style="margin-top:6px">${crateItems.map(([k, n]) => `<div class="bc-cell"><span class="e">${matOf(k).emoji}</span>${fmtN(n)}<span class="n">${esc(matOf(k).name)}</span></div>`).join('')}</div>
        <div class="bc-row" style="margin-top:7px;justify-content:flex-end"><button type="button" class="bc-btn green" ${this._act(() => this._crateClaim())}>📥 Move into storage</button></div></div>`;
    }
    const tb = fr.toolbelt;
    if (tb) {
      body += `<div class="bc-sec">🧰 Toolbelt</div><div class="bc-chips">${['pickaxe', 'axe', 'staff'].map((k) => `<span class="bc-chip ${tb[k] ? 'brass' : ''}">${TOOL_ICON[k]} ${k} ${tb[k] ? `T${tb[k]}` : '—'}</span>`).join('')}</div>`;
    }
    const foot = `<button type="button" class="bc-btn green" ${this._anyProductionReady(p) ? '' : 'disabled'} ${this._act(() => this._collectAll())}>📦 Collect all production</button>`;
    return { title: '📦 Storage', body, foot };
  }

  async _storeUpgrade(kind) {
    const r = await this._req('bc_store_upgrade', { kind }, '⬆️');
    if (r.ok) this.toast(`⬆️ ${kind === 'warehouse' ? 'Warehouse' : 'Pantry'} is now Lv. ${r.lv} (${fmtN(storeCap(kind, r.lv))} capacity)`, 2600);
  }

  async _crateClaim() {
    const r = await this._req('sf_crate_claim', {}, '📦');
    if (!r.ok) return;
    const moved = itemsLine(r.moved);
    this.toast(moved ? `📥 Moved ${moved} into storage` : '📦 No room yet — upgrade your storage', 2600);
  }

  async _collectAll() {
    const r = await this._req('bc_collect_all', {}, '📦');
    if (!r.ok) return;
    const bits = [itemsLine(r.collected)];
    for (const t of r.tools || []) bits.push(`${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}!`);
    this.toast(`📦 Collected ${bits.filter(Boolean).join(' ')}`, 2600);
  }

  // ---------------------------------------------------------------------------------- 7. Frontier HUD
  _renderFrontier() {
    const hud = typeof document !== 'undefined' ? document.getElementById('sf-hud') : null;
    if (!hud) return;
    if (!this._sf || !hud.contains(this._sf.pouch)) this._mountFrontier(hud);
    if (!this._sf) return;
    const p = this._p();
    const fr = p?.frontier || {};
    const pouch = Array.isArray(fr.foodPouch) ? fr.foodPouch : [null, null, null, null];
    this._sf.slots.forEach((el, i) => {
      const id = pouch[i] || null;
      const n = id ? this._have(id, p) : 0;
      el.classList.toggle('empty', !id);
      el.classList.toggle('zero', !!id && n <= 0);
      el.innerHTML = id ? `${matOf(id).emoji}<b>${n}</b>` : '+';
      el.title = id ? `${matOf(id).name} (+${FOOD[id]?.energy || 0} ⚡) — tap to eat, hold to change` : 'Tap to choose a food';
    });
    this._renderBuff();
  }

  _mountFrontier(hud) {
    const topLeft = hud.querySelector('.sf-top-left');
    const vial = hud.querySelector('#sf-vial');
    if (!topLeft) return;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'bc-sf-plus';
    plus.id = 'bc-sf-plus';
    plus.textContent = '+';
    plus.title = 'Energy refills';
    plus.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open('energy'); };
    if (vial?.parentNode === topLeft) vial.after(plus); else topLeft.prepend(plus);
    const buff = document.createElement('div');
    buff.className = 'bc-sf-buff';
    buff.id = 'bc-sf-buff';
    topLeft.appendChild(buff);
    const pouch = document.createElement('div');
    pouch.className = 'bc-sf-pouch';
    pouch.id = 'bc-sf-pouch';
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bc-sf-slot empty';
      b.dataset.slot = String(i);
      this._bindSlot(b, i);
      pouch.appendChild(b);
      slots.push(b);
    }
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'bc-sf-edit';
    edit.textContent = '✎ Edit';
    edit.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open('pouch', { slot: 0 }); };
    pouch.appendChild(edit);
    hud.appendChild(pouch);
    this._sf = { plus, buff, pouch, slots };
  }

  _bindSlot(el, i) {
    let timer = 0;
    let long = false;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      long = false;
      clearTimeout(timer);
      timer = setTimeout(() => { long = true; this.open('pouch', { slot: i }); }, 520);
    });
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(timer);
      if (long) { long = false; return; }
      const id = (this._p()?.frontier?.foodPouch || [])[i];
      if (!id) { this.open('pouch', { slot: i }); return; }
      this._eat(id);
    });
  }

  async _eat(foodId) {
    if (this._busy) return;
    if (this._have(foodId) <= 0) { this.toast(`🧺 No ${matOf(foodId).name} left — cook more at the Patisserie`, 2400); return; }
    this._busy = true;
    try {
      const r = await this._req('sf_eat', { foodId }, '🍞');
      if (!r.ok) return;
      if (r.energy) this.onEnergy?.(r.energy);
      const f = FOOD[foodId] || {};
      this.toast(`${matOf(foodId).emoji} Yum! +${f.energy || 0} ⚡${r.buff ? ` • ${BUFF_LABEL[r.buff.id] || r.buff.id} for 30 min` : ''}`, 2400);
    } finally { this._busy = false; }
  }

  _renderBuff() {
    if (!this._sf?.buff) return;
    const b = this._p()?.frontier?.mealBuff;
    const now = this.now();
    const on = !!b && b.until > now;
    this._sf.buff.classList.toggle('on', on);
    if (on) {
      const mins = Math.max(1, Math.ceil((b.until - now) / 60000));
      const txt = `${matOf(b.food).emoji} ${BUFF_LABEL[b.id] || b.id} · ${mins}m`;
      if (this._sf.buff.textContent !== txt) this._sf.buff.textContent = txt;
    }
  }

  _viewPouch(p) {
    const fr = p?.frontier || {};
    const pouch = Array.isArray(fr.foodPouch) ? fr.foodPouch : [null, null, null, null];
    const slot = Math.max(0, Math.min(3, this.view.slot | 0));
    let body = `<div class="bc-sec">🎒 Food Pouch</div><div class="bc-row" style="gap:6px">${[0, 1, 2, 3].map((i) => `<button type="button" class="bc-btn ${i === slot ? '' : 'plain'}" style="flex:1;font-size:16px" ${this._act(() => { this.view.slot = i; this.render({ keepScroll: true }); })}>${pouch[i] ? matOf(pouch[i]).emoji : '·'}</button>`).join('')}</div>`;
    body += `<div class="bc-sec">Choose food for slot ${slot + 1}</div>`;
    for (const [id, f] of Object.entries(FOOD)) {
      const n = this._have(id, p);
      const cur = pouch[slot] === id;
      body += `<div class="bc-card${cur ? ' bc-done' : ''}${n ? '' : ' bc-dim'}"><div class="bc-row"><span class="bc-big-ico">${matOf(id).emoji}</span><div class="bc-grow">
        <div class="bc-title">${esc(matOf(id).name)} <span class="bc-sub">×${n} in Pantry</span></div>
        <div class="bc-chips"><span class="bc-chip ok">⚡ +${f.energy}</span>${f.buff ? `<span class="bc-chip brass">✨ ${esc(BUFF_LABEL[f.buff] || f.buff)} 30m</span>` : ''}</div></div>
        <button type="button" class="bc-btn" ${cur ? 'disabled' : ''} ${this._act(() => this._pouchSet(slot, id))}>${cur ? 'Set ✓' : 'Set'}</button></div></div>`;
    }
    const foot = `<button type="button" class="bc-btn red" ${pouch[slot] ? '' : 'disabled'} ${this._act(() => this._pouchSet(slot, null))}>Clear slot ${slot + 1}</button>`;
    return { title: '🎒 Food Pouch', body, foot, small: true };
  }

  async _pouchSet(slot, foodId) {
    const r = await this._req('sf_pouch_set', { slot, foodId }, '🎒');
    if (!r.ok) return;
    const p = this._p();
    if (p?.frontier && Array.isArray(r.foodPouch)) p.frontier.foodPouch = r.foodPouch;
    this._renderFrontier();
    this.toast(foodId ? `🎒 Slot ${slot + 1}: ${matOf(foodId).emoji} ${matOf(foodId).name}` : `🎒 Slot ${slot + 1} cleared`, 1600);
    this.render({ keepScroll: true });
  }

  _viewEnergy(p) {
    const fr = p?.frontier || {};
    const e = fr.energy || {};
    const now = this.now();
    const day = utcDayOf(now);
    const dailyDone = e.dailyFreeDay === day;
    const refills = e.diamondRefillsDay === day ? (e.diamondRefillsCount | 0) : 0;
    const limit = refills >= ENERGY.DIAMOND_REFILLS_PER_DAY;
    const cost = ENERGY.DIAMOND_COSTS[Math.min(refills, ENERGY.DIAMOND_COSTS.length - 1)];
    const coupled = !!p?.partner_id;
    const giftDone = e.partnerGiftDay === day;
    let body = `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">⚡</span><div class="bc-grow"><div class="bc-title">${fmtN(Math.floor(e.cur ?? ENERGY.MAX))} / ${fmtN(e.max || ENERGY.MAX)} Energy</div>
      <div class="bc-sub">Regenerates +1 every ${Math.round(ENERGY.REGEN_MS / 60000)} min. Food and refills can overfill to ${fmtN((e.max || ENERGY.MAX) * 2)}.</div></div></div></div>`;
    body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">🌅</span><div class="bc-grow"><div class="bc-title">Daily free refill</div><div class="bc-sub">+${ENERGY.DAILY_FREE} ⚡ once per day</div></div>
      <button type="button" class="bc-btn green" ${dailyDone ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_daily', `🌅 +${ENERGY.DAILY_FREE} ⚡ daily energy!`))}>${dailyDone ? 'Claimed ✓' : 'Claim'}</button></div></div>`;
    body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">💎</span><div class="bc-grow"><div class="bc-title">Diamond refill</div><div class="bc-sub">+${ENERGY.DIAMOND_REFILL} ⚡ · ${refills}/${ENERGY.DIAMOND_REFILLS_PER_DAY} used today · you have ${fmtN(p?.diamonds)} 💎</div></div>
      <button type="button" class="bc-btn" ${limit || (p?.diamonds | 0) < cost ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_diamond', `💎 +${ENERGY.DIAMOND_REFILL} ⚡ refilled!`))}>${limit ? 'Limit' : `${cost} 💎`}</button></div></div>`;
    if (coupled) {
      body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">💞</span><div class="bc-grow"><div class="bc-title">Gift your partner</div><div class="bc-sub">Send ${esc(p.partner_id)} +${ENERGY.PARTNER_GIFT} ⚡ once per day</div></div>
        <button type="button" class="bc-btn green" ${giftDone ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_gift', `💞 Sent +${ENERGY.PARTNER_GIFT} ⚡ to ${p.partner_id}!`))}>${giftDone ? 'Sent ✓' : 'Gift'}</button></div></div>`;
    }
    const b = fr.mealBuff;
    if (b && b.until > now) {
      body += `<div class="bc-note good">${matOf(b.food).emoji} <b>${esc(BUFF_LABEL[b.id] || b.id)}</b> active · <span data-until="${b.until}" data-label="">${fmtDur(b.until - now)}</span> left</div>`;
    }
    return { title: '⚡ Energy', body, foot: '', small: true };
  }

  async _energy(type, okMsg) {
    const r = await this._req(type, {}, '⚡');
    if (!r.ok) return;
    if (r.energy) this.onEnergy?.(r.energy);
    this.toast(okMsg, 2400);
  }
}
