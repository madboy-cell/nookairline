// client/js/frontier/sky_frontier_scene.js — Self-contained Three.js Sky Frontier scene.
// Manages the 10-player co-op shard stage, nodes, gates, DOM HUD overlays, auto-swing mining,
// and client-side combat (monsters, attacks, ultimates, invasions, outposts, bosses).

import * as THREE from 'three';
import { loadSprite, spriteInfo } from '../assets.js';
import {
  REGIONS,
  NODE_TYPES,
  SWING_MS,
  ENERGY,
  regenEnergy,
  warehouseCap,
  totalStoreUnits,
  FRONTIER_ITEM_SOURCES,
  resolveFrontierTarget,
  ensureFieldBounties,
  FIELD_BOUNTY_STAMP_REWARD,
} from '/shared/sky_frontier_rules.js';
import { CHARMS } from '/shared/charm_catalog.js';
import { MATERIALS } from '/shared/materials_catalog.js';
import {
  ALPHA_ELITE,
  MONSTERS,
  BOSSES,
  WEAPONS,
  WEAPON_CLASSES,
  MONSTER_SKILLS,
  MONSTER_SKILL_IDS,
  MONSTER_CODEX_META,
  buildMonsterCodex,
  attackCooldownMs,
  classAttackCooldownMs,
  skillCooldownMs,
  computeSkillNumbers,
  playerMaxHp,
} from '/shared/combat_rules.js';
import { ALPHA_ELITE_AURA_SPEC } from '/shared/skill_vfx_defs.js';
import { ACCESSORIES } from '/shared/catalog_gear_pets.js';
import { activeWeaponClass, visibleSlotId } from '/shared/accessory_attach.js';
import { computeUniversalStats, skyFrontierMods } from '/shared/universal_stats.js';
import { SkillVfxEngine } from './skill_vfx_engine.js?v=mc2';
import {
  STATUS_TAGS,
  decodeTagMask,
  SKILL_ROLES,
  SKILL_TRAITS,
  SKILL_COMBO,
  REACTIONS,
  REACTION_IDS,
  comboPartners,
  isPayoffAgainst,
  WEAPON_ECHO,
  HIT3_PRIMES,
  MONSTER_PASSIVES,
  MONSTER_PASSIVE_IDS,
  PASSIVE_DROP_RATES,
  passiveBySource,
  passiveDescFor,
  SKILL_SLOT_COUNT,
  PRESET_COUNT,
  SLOT_UNLOCK_RULES,
  skillSlotUnlocks,
  canEssenceCraft,
  essenceCraftCost,
  SCROLL_FLOOR_KILLS,
  ESSENCE,
  archetypeOf,
  weaponEchoFor,
  RESONANCE,
} from '/shared/skill_combos.js';

// Master Crafters build-craft helpers (4 active slots + 1 passive)
const SF_SLOT_COUNT = SKILL_SLOT_COUNT || 4;
const SF_EMPTY_EQ = Object.freeze([null, null, null, null]);
const SF_DEFAULT_UNLOCKS = Object.freeze([true, true, false, false]);
const SF_HC_KEYS = Object.freeze({
  state: Object.freeze(['skState0', 'skState1', 'skState2', 'skState3']),
  txt: Object.freeze(['skTxt0', 'skTxt1', 'skTxt2', 'skTxt3']),
  dash: Object.freeze(['skDash0', 'skDash1', 'skDash2', 'skDash3']),
  reso: Object.freeze(['skReso0', 'skReso1', 'skReso2', 'skReso3']),
});
// Largest Weapon-Echo reach multiplier (ranged +25%) — bounds the "approaching" auto-cast window
const SF_MAX_ECHO_RANGE_MULT = Math.max(1, Number(WEAPON_ECHO?.ranged?.rangeMult) || 1);
const SF_RESONANCE_PRIME_ROLES = new Set(RESONANCE?.primeRoles || ['sustain', 'support']);
/** 🎶 Resonance: Sustain/Support skills PRIME; every other skill is a "damaging" skill that consumes it. */
function sfIsResonancePrimer(skillId) {
  return SF_RESONANCE_PRIME_ROLES.has(SKILL_COMBO[skillId]?.role);
}
const SF_PRESET_NAMES = Object.freeze(['Farm', 'Boss', 'Co-Op', 'Raid', 'Solo']);
const SF_TRAIT_LABEL = Object.freeze({ chill: 'Frost', fire: 'Fire', water: 'Water', shock: 'Shock', wind: 'Wind', heavy: 'Heavy', ground: 'Ground', light: 'Light', drain: 'Drain' });
function sfPadEquipped(eq) {
  const out = Array.isArray(eq) ? eq.slice(0, SF_SLOT_COUNT) : [];
  while (out.length < SF_SLOT_COUNT) out.push(null);
  return out.map((v) => v || null);
}
// PNG art exists for the 7 timed tags + guard_break (broken); derived frozen/stunned/warded use emoji.
const SF_TAG_PNG_IDS = new Set(['soaked', 'burning', 'shocked', 'chilled', 'gathered', 'staggered', 'marked']);
function SF_COMBO_ICON_SRC(id) {
  if (SF_TAG_PNG_IDS.has(id)) return `/assets/combo/tag_${id}.png`;
  if (id === 'broken' || id === 'guard_break') return '/assets/combo/guard_break.png';
  return null;
}
function sfComboIconHtml(kind, id, emoji, size = 14) {
  const safeEmoji = String(emoji || '');
  const src = kind === 'guard' ? '/assets/combo/guard_break.png'
    : kind === 'passive' ? `/assets/combo/${id}.png`
    : SF_COMBO_ICON_SRC(id);
  if (!src) return `<span class="sf-combo-ico-emoji" style="font-size:${Math.round(size * 0.9)}px;">${safeEmoji}</span>`;
  return `<img class="sf-combo-ico" src="${src}" alt="${safeEmoji}" style="width:${size}px;height:${size}px;" onerror="this.replaceWith(document.createTextNode(this.alt))" />`;
}

const EMOJI_MAP = Object.freeze({
  wood: '🪵',
  stone: '🪨',
  sky_wheat: '🌾',
  golden_wheat: '🌾',
  herb_seed: '🌱',
  berries_crop: '🍓',
  bread: '🍞',
  berry_tart: '🥧',
  boba_tea: '🧋',
  fish_pie: '🥧',
  honey_bun: '🥐',
  golden_croissant: '🥐',
  matcha_tea: '🍵',
  potion_small: '🧪',
  honey: '🍯',
  feather: '🪶',
  cloud_silk: '🕸️',
  fish: '🐟',
  crystal_ore: '💎',
  crystal_glass: '🔮',
  ingot: '🪙',
  plank: '🪵',
  flour: '🥡',
  herb: '🌿',
  thread: '🧵',
  ancient_gear: '⚙️',
  starlight_essence: '✨',
  monster_gel: '🫧',
  monster_fang: '🦷',
  boss_core_moss: '🟢',
  boss_core_weaver: '🟣',
  boss_core_kitsune: '🦊',
  boss_core_bahamut: '🐉',
  sakura_timber: '🌸',
  celestial_pearl: '🦪',
  cloud_lotus: '🪷',
  orichalcum_ore: '🔶',
  astral_prism: '💠',
  mithril_ingot: '⛓️',
  repair_kit: '🔧',
});

const REGION_ORDER = Object.freeze(['meadow', 'hollow', 'reef', 'caldera']);

const REGION_META = Object.freeze({
  meadow: Object.freeze({
    id: 'meadow',
    name: 'Whispering Meadow',
    short: 'Meadow',
    icon: '🌲',
    unlockChapter: 1,
    bossId: 'elder_moss_golem',
    bossName: 'Elder Moss Golem',
    bossPoi: 'golem',
    groundKey: 'ground_classic',
    outpostKey: 'sf_outpost_goddess',
    borderKey: 'sf_prop_meadow_tree',
  }),
  hollow: Object.freeze({
    id: 'hollow',
    name: 'Crystal Hollow',
    short: 'Hollow',
    icon: '💎',
    unlockChapter: 2,
    bossId: 'hollow_crystal_weaver',
    bossName: 'Hollow Crystal Weaver',
    bossPoi: 'boss',
    groundKey: 'terrain_hollow_floor',
    outpostKey: 'sf_hollow_outpost',
    borderKey: 'sf_prop_hollow_wall',
  }),
  reef: Object.freeze({
    id: 'reef',
    name: 'Celestial Sakura Reef',
    short: 'Reef',
    icon: '🌸',
    unlockChapter: 5,
    bossId: 'sakura_nine_tail_kitsune',
    bossName: 'Lady Tamamo, Nine-Tail Kitsune',
    bossPoi: 'boss',
    groundKey: 'terrain_reef_floor',
    waterKey: 'terrain_reef_water',
    outpostKey: 'sf_outpost_reef',
    borderKey: 'sf_prop_sakura_torii',
  }),
  caldera: Object.freeze({
    id: 'caldera',
    name: 'Clockwork Star-Caldera',
    short: 'Caldera',
    icon: '⚙️',
    unlockChapter: 6,
    bossId: 'chronos_solar_bahamut',
    bossName: 'Chronos-Solar Bahamut',
    bossPoi: 'boss',
    groundKey: 'terrain_caldera_floor',
    accentKey: 'terrain_caldera_ember',
    outpostKey: 'sf_outpost_caldera',
    borderKey: 'sf_prop_astrolabe_pillar',
  }),
});

const _biomeSkyTexCache = new Map();
function getBiomeSkyTexture(regionId) {
  if (typeof document === 'undefined') return null;
  if (_biomeSkyTexCache.has(regionId)) return _biomeSkyTexCache.get(regionId);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (regionId === 'caldera') {
    grad.addColorStop(0.0, '#0F0B1D');
    grad.addColorStop(0.45, '#1E1830');
    grad.addColorStop(0.80, '#2F2042');
    grad.addColorStop(1.0, '#4B2B39');
  } else if (regionId === 'reef') {
    grad.addColorStop(0.0, '#F9CEE2');
    grad.addColorStop(0.48, '#FFEBF3');
    grad.addColorStop(0.82, '#FFF5F9');
    grad.addColorStop(1.0, '#E8FAF6');
  } else if (regionId === 'hollow') {
    grad.addColorStop(0.0, '#070D1B');
    grad.addColorStop(0.45, '#10203B');
    grad.addColorStop(0.80, '#18344B');
    grad.addColorStop(1.0, '#22475E');
  } else {
    grad.addColorStop(0.0, '#5AA5E6');
    grad.addColorStop(0.48, '#9CD5FA');
    grad.addColorStop(0.82, '#E8F5FF');
    grad.addColorStop(1.0, '#FFF2D6');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _biomeSkyTexCache.set(regionId, t);
  return t;
}

const HUD_STYLE = `
#sf-hud {
  position: fixed;
  inset: 0;
  z-index: 25;
  pointer-events: none;
  font-family: "Comfortaa", "Fredoka", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
}

#sf-hud * {
  box-sizing: border-box;
}

.sf-top-bar {
  position: absolute;
  top: max(10px, env(safe-area-inset-top, 10px));
  left: 10px;
  right: 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  pointer-events: none;
  z-index: 27;
}

.sf-top-left {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
  flex: 1 1 auto;
  pointer-events: none;
}

.sf-bars-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  pointer-events: none;
}

.sf-vial-row {
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

/* Glass vial showing ⚡ cur/max */
.sf-vial {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(36, 24, 18, 0.84);
  border: 2px solid #C9A45C;
  border-radius: 17px;
  padding: 3px 9px;
  height: 32px;
  color: #FFF9E6;
  font-weight: 800;
  font-size: 11.5px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.42), inset 0 1px 2px rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(6px);
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
}

.sf-vial-liquid {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #E8B85A 0%, #FFE27A 100%);
  opacity: 0.42;
  transition: width 0.3s ease;
  pointer-events: none;
}

.sf-vial.low {
  border-color: #F87171;
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.55);
}

.sf-vial-text {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  letter-spacing: 0.3px;
}

/* Tree of Savior MMORPG Overhead Character & Co-Op Ally Plate Layer */
.sf-overhead-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 6;
}

.sf-char-plate {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate3d(-999px, -999px, 0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  will-change: transform;
}

.sf-plate-top {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(28, 18, 12, 0.80);
  border: 1px solid rgba(223, 177, 91, 0.62);
  border-radius: 999px;
  padding: 1px 7px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.sf-char-plate.is-ally .sf-plate-top {
  border-color: rgba(125, 211, 252, 0.62);
}

.sf-char-plate.is-partner .sf-plate-top {
  border-color: rgba(249, 168, 212, 0.85);
  background: rgba(54, 20, 38, 0.82);
}

.sf-plate-cls {
  font-size: 10px;
  line-height: 1;
}

.sf-plate-name {
  font-size: 10px;
  font-weight: 900;
  color: #FFFDF7;
  text-shadow: 0 1px 2px #000;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-plate-lv {
  font-size: 9px;
  font-weight: 800;
  color: #FDE68A;
  text-shadow: 0 1px 2px #000;
}

.sf-plate-buffs {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 9.5px;
  line-height: 1;
}

.sf-cast-callout {
  background: linear-gradient(135deg, rgba(59, 31, 18, 0.95), rgba(92, 45, 22, 0.95));
  border: 1.5px solid #FDE047;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 900;
  color: #FEF9C3;
  white-space: nowrap;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.55), 0 0 12px rgba(250, 204, 21, 0.45);
  text-shadow: 0 1px 2px #000;
  margin-bottom: 1px;
  animation: sfCastPop 0.22s cubic-bezier(0.22, 1.35, 0.36, 1);
}

.sf-cast-callout[hidden] {
  display: none !important;
}

@keyframes sfCastPop {
  from { opacity: 0; transform: translateY(5px) scale(0.86); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Overhead HP + Cyan Shield bar anchored above the Chibi's head */
.sf-hp-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108px;
  height: 13px;
  background: rgba(24, 14, 10, 0.92);
  border: 1.5px solid #4A321F;
  border-radius: 999px;
  padding: 0 5px;
  color: #FFFFFF;
  font-weight: 900;
  font-size: 8.8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255, 240, 200, 0.32);
  overflow: hidden;
  pointer-events: none;
  transition: border-color 0.22s ease, box-shadow 0.22s ease;
}

.sf-char-plate.is-ally .sf-hp-bar {
  width: 82px;
  height: 11px;
  font-size: 8px;
}

.sf-hp-bar.sanctuary {
  border-color: #6EE7B7;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.72), 0 2px 6px rgba(0, 0, 0, 0.62);
}

.sf-hp-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #16A34A 0%, #4ADE80 100%);
  opacity: 0.92;
  transition: width 0.22s ease, background 0.22s ease;
  pointer-events: none;
}

.sf-hp-bar.mid .sf-hp-bar-fill {
  background: linear-gradient(90deg, #D97706 0%, #FBBF24 100%);
}

.sf-hp-bar.low .sf-hp-bar-fill {
  background: linear-gradient(90deg, #DC2626 0%, #FB7185 100%);
}

.sf-hp-bar.sanctuary .sf-hp-bar-fill {
  background: linear-gradient(90deg, #059669 0%, #6EE7B7 100%);
}

.sf-hp-shield-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0%;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.78) 0%, rgba(165, 243, 252, 0.94) 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.85);
  pointer-events: none;
  transition: width 0.20s ease;
}

.sf-hp-bar-text {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px #000, 0 0 4px rgba(0, 0, 0, 0.95);
  letter-spacing: 0.2px;
  white-space: nowrap;
  line-height: 1;
}

/* Targeted Field Monster Overhead Plate */
.sf-mob-plate {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate3d(-999px, -999px, 0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  will-change: transform;
}

.sf-mob-plate[hidden] {
  display: none !important;
}

.sf-mob-plate-top {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(38, 16, 16, 0.86);
  border: 1px solid rgba(252, 165, 165, 0.65);
  border-radius: 999px;
  padding: 1px 6px 1px 7px;
  font-size: 9.5px;
  font-weight: 900;
  color: #FFF1F2;
  text-shadow: 0 1px 2px #000;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.sf-mob-plate.is-alpha .sf-mob-plate-top {
  background: linear-gradient(90deg, rgba(66, 36, 8, 0.94), rgba(45, 22, 10, 0.94));
  border-color: #FDE047;
  color: #FEF08A;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.45), 0 2px 6px rgba(0, 0, 0, 0.6);
}

.sf-alpha-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(120, 53, 15, 0.95);
  border: 1px solid #FDE047;
  color: #FDE047;
  border-radius: 999px;
  padding: 0 5px;
  font-size: 8.5px;
  font-weight: 900;
  letter-spacing: 0.3px;
  line-height: 1.25;
}

.sf-mob-codex-chip {
  pointer-events: auto;
  cursor: pointer;
  border: 1px solid #DFB15B;
  background: #3B2A20;
  color: #FDE68A;
  border-radius: 999px;
  padding: 0 4px;
  font-size: 8.5px;
  font-weight: 900;
  line-height: 1.3;
}

.sf-mob-hp-track {
  position: relative;
  width: 84px;
  height: 11px;
  background: rgba(20, 10, 10, 0.92);
  border: 1.5px solid #5C221E;
  border-radius: 999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.58);
}

.sf-mob-hp-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #DC2626 0%, #F87171 100%);
  transition: width 0.07s linear;
}

.sf-mob-hp-txt {
  position: relative;
  z-index: 1;
  font-size: 8px;
  font-weight: 900;
  color: #FFF;
  text-shadow: 0 1px 2px #000;
}

/* Live Warehouse Storage Pill & Monster Codex Pill in Top Bar */
.sf-bag-pill,
.sf-codex-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: linear-gradient(180deg, #F4EAD6 0%, #E3CFA9 100%);
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 3px 8px;
  height: 32px;
  color: #3B2A20;
  font-weight: 900;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.32);
  pointer-events: auto;
  transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease;
}

.sf-codex-pill {
  background: linear-gradient(180deg, #4A3324 0%, #2C1D14 100%);
  border-color: #DFB15B;
  color: #FFE7A3;
}

@media (max-width: 410px) {
  .sf-top-left {
    gap: 4px;
  }
  .sf-bag-pill,
  .sf-codex-pill {
    padding: 3px 7px;
    font-size: 10.5px;
  }
}

.sf-bag-pill:active,
.sf-codex-pill:active {
  transform: scale(0.95);
}

.sf-bag-pill.warn {
  background: linear-gradient(180deg, #FEF3C7 0%, #FDE68A 100%);
  border-color: #B45309;
  color: #78350F;
}

.sf-bag-pill.full {
  background: linear-gradient(180deg, #FEE2E2 0%, #FCA5A5 100%);
  border-color: #B91C1C;
  color: #7F1D1D;
  animation: sfPulseSoft 1.2s ease-in-out infinite alternate;
}

@keyframes sfPulseSoft {
  from { transform: scale(1); }
  to { transform: scale(1.04); }
}

.sf-bag-crate-tag {
  background: #9A3412;
  color: #FFF7ED;
  font-size: 9.5px;
  font-weight: 900;
  border-radius: 999px;
  padding: 1px 5px;
}

/* Row 2 Left: Dedicated Zero-Overlap Quest, Bounty & Status Dock */
.sf-quest-dock {
  position: absolute;
  top: max(48px, calc(env(safe-area-inset-top, 10px) + 38px));
  left: 10px;
  width: calc(100vw - 102px);
  max-width: 310px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  pointer-events: none;
  z-index: 26;
}

.sf-quest-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  pointer-events: none;
}

.sf-bounty-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 30px;
  padding: 0 8px;
  border-radius: 13px;
  border: 2px solid #C9A45C;
  background: linear-gradient(180deg, #4A3324 0%, #2C1D14 100%);
  color: #FFE7A3;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.42);
  transition: transform 0.1s ease, border-color 0.15s ease;
}

.sf-bounty-btn:active {
  transform: scale(0.94);
}

.sf-bounty-btn.ready {
  background: linear-gradient(180deg, #4B7C2C 0%, #2F5418 100%);
  border-color: #D9F99D;
  color: #FFFFFF;
  box-shadow: 0 0 12px rgba(132, 204, 22, 0.65), 0 3px 8px rgba(0, 0, 0, 0.4);
}

.sf-bounty-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #EF4444;
  border: 1.5px solid #FFFBEB;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  display: none;
}

.sf-bounty-btn.ready .sf-bounty-dot {
  display: block;
}

.sf-status-pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  pointer-events: none;
}

.sf-partner-pill {
  display: none;
  align-items: center;
  gap: 4px;
  background: rgba(46, 24, 34, 0.90);
  border: 1.5px solid #F472B6;
  border-radius: 13px;
  padding: 3px 9px;
  height: 26px;
  color: #FCE7F3;
  font-size: 10.5px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  white-space: nowrap;
  transition: transform 0.08s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.sf-partner-pill.sf-sync-active {
  background: linear-gradient(90deg, rgba(131, 24, 67, 0.94), rgba(113, 63, 18, 0.94));
  border-color: #FDE047;
  color: #FEF08A;
  box-shadow: 0 0 12px rgba(244, 114, 182, 0.55), 0 2px 8px rgba(0, 0, 0, 0.45);
}

.sf-partner-pill:active {
  transform: scale(0.94);
}

/* Home button */
.sf-btn-home {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  background: #E9DCC0;
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 3px 10px;
  height: 32px;
  color: #3B2A20;
  font-weight: 800;
  font-size: 11.5px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.32);
  pointer-events: auto;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}

.sf-btn-home:hover {
  background: #F4EAD6;
  border-color: #C9A45C;
}

.sf-btn-home:active {
  transform: scale(0.95);
}

/* Row 3 Center Stack for Invasion Banner & Boss HP Bar (cleanly below Quest Dock + Mini-Map) */
.sf-top-center {
  position: absolute;
  top: max(138px, calc(env(safe-area-inset-top, 10px) + 128px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  pointer-events: none;
  z-index: 25;
  width: min(92vw, 368px);
}

/* Invasion banner */
.sf-invasion-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #E9DCC0;
  border: 2px solid #5A2A18;
  border-radius: 12px;
  padding: 5px 16px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  text-align: center;
  width: 100%;
  animation: sfBannerDrop 0.28s ease-out;
}

@keyframes sfBannerDrop {
  0% { transform: translateY(-16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.sf-invasion-title {
  font-size: 13px;
  font-weight: 900;
  color: #8B1E0F;
  letter-spacing: 0.5px;
}

.sf-invasion-sub {
  font-size: 11px;
  font-weight: 800;
  color: #3B2A20;
  margin-top: 1px;
}

/* Big Boss HP bar */
.sf-boss-bar {
  width: 100%;
  background: rgba(30, 20, 16, 0.90);
  border: 2px solid #C9A45C;
  border-radius: 12px;
  padding: 6px 12px 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  pointer-events: auto;
  cursor: pointer;
  animation: sfBannerDrop 0.28s ease-out;
}

.sf-boss-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sf-boss-name {
  font-size: 13px;
  font-weight: 900;
  color: #FFECA8;
  text-shadow: 0 1px 2px #000;
}

.sf-boss-stage {
  font-size: 11px;
  font-weight: 800;
  color: #E57373;
}

.sf-boss-bar-track {
  position: relative;
  height: 16px;
  background: rgba(0,0,0,0.55);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.18);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-boss-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #8E24AA 0%, #D81B60 50%, #E53935 100%);
  transition: width 0.25s ease;
}

.sf-boss-bar-text {
  position: relative;
  z-index: 1;
  font-size: 10px;
  font-weight: 900;
  color: #FFF;
  text-shadow: 0 1px 2px #000;
}

/* Floating share text container (above .sf-overhead-layer z-index: 6, below HUD z-index: 25) */
.sf-floating-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 14;
}

.sf-floating-item {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate3d(-999px, -999px, 0) translate(-50%, -50%);
  will-change: transform, opacity;
  background: rgba(59, 42, 32, 0.92);
  border: 1.5px solid #C9A45C;
  border-radius: 12px;
  padding: 4px 10px;
  color: #FFECA8;
  font-weight: 900;
  font-size: 14px;
  white-space: nowrap;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
}

.sf-loot-magnet {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate3d(-999px, -999px, 0) translate(-50%, -50%);
  will-change: transform;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(254, 240, 138, 0.95) 0%, rgba(217, 119, 6, 0.9) 100%);
  border: 2px solid #FFFBEB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.8), 0 3px 8px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 4;
}

.sf-floating-item.sf-float-hit {
  background: rgba(42, 30, 22, 0.85);
  border-color: #B89872;
  color: #FFF8EC;
  font-size: 12px;
  padding: 2px 8px;
}

.sf-floating-item.sf-float-perfect {
  background: linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(180, 83, 9, 0.95));
  border: 2px solid #FDE047;
  color: #FEF08A;
  font-size: 13px;
  padding: 3px 10px;
  box-shadow: 0 0 14px rgba(250, 204, 21, 0.65), 0 3px 8px rgba(0, 0, 0, 0.5);
}

.sf-floating-item.sf-float-uncommon {
  background: linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(16, 185, 129, 0.92));
  border: 2px solid #6EE7B7;
  color: #ECFDF5;
  font-size: 14px;
  box-shadow: 0 0 14px rgba(52, 211, 153, 0.55), 0 4px 10px rgba(0, 0, 0, 0.5);
}

.sf-floating-item.sf-float-rare {
  background: linear-gradient(135deg, rgba(12, 74, 110, 0.96), rgba(2, 132, 199, 0.94));
  border: 2px solid #67E8F9;
  color: #E0F2FE;
  font-size: 15px;
  padding: 5px 12px;
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.7), 0 4px 12px rgba(0, 0, 0, 0.55);
}

.sf-floating-item.sf-float-epic {
  background: linear-gradient(135deg, rgba(88, 28, 135, 0.97), rgba(180, 83, 9, 0.96));
  border: 2.5px solid #FDE047;
  color: #FEF9C3;
  font-size: 16px;
  padding: 6px 14px;
  box-shadow: 0 0 24px rgba(250, 204, 21, 0.85), 0 4px 14px rgba(0, 0, 0, 0.65);
}

.sf-rarity-boost-pill {
  margin-bottom: 6px;
  background: rgba(36, 24, 18, 0.88);
  border: 1.5px solid #C9A45C;
  border-radius: 10px;
  padding: 2px 8px;
  color: #FDE047;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

/* Bottom Center Context Action Buttons (Quick Heal / Repair / Boss Summon) — cleanly above Joystick + Right Dock */
.sf-context-actions {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 238px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 26;
  max-width: min(86vw, 250px);
}

.sf-heal-btn {
  background: linear-gradient(180deg, #DCFCE7 0%, #86EFAC 100%);
  border: 2.5px solid #14532D;
  border-radius: 18px;
  padding: 6px 14px;
  color: #14532D;
  font-weight: 900;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.55), 0 4px 10px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  animation: sfPulseSoft 0.9s ease-in-out infinite alternate;
}

.sf-heal-btn:active { transform: scale(0.94); }

.sf-repair-btn {
  background: #E9DCC0;
  border: 2.5px solid #3B2A20;
  border-radius: 18px;
  padding: 7px 16px;
  color: #3B2A20;
  font-weight: 900;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  pointer-events: auto;
  transition: transform 0.08s ease, background 0.15s ease;
}

.sf-repair-btn:hover { background: #F4EAD6; }
.sf-repair-btn:active { transform: scale(0.95); }

.sf-boss-btn {
  background: #5A2A18;
  border: 2.5px solid #FFE082;
  border-radius: 18px;
  padding: 7px 16px;
  color: #FFF9E6;
  font-weight: 900;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  pointer-events: auto;
  transition: transform 0.08s ease, box-shadow 0.15s ease;
}

.sf-boss-btn:hover { box-shadow: 0 0 16px #FFE082; }
.sf-boss-btn:active { transform: scale(0.95); }

/* Bottom Right Dock: Compact 2-Tier Quarter-Circle Arc Combat Cluster (<= 204px wide x <= 146px tall at 393x852) */
.sf-bottom-right-dock {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  max-width: 208px;
  pointer-events: none;
  z-index: 26;
}

.sf-dock-top-row {
  display: flex;
  /* Master Crafters: stacked right-aligned column so the pills stay clear of the centered context actions */
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 4px;
  pointer-events: none;
}

.sf-dock-top-row .sf-target-pill {
  padding: 4px 6.5px;
  font-size: 10px;
}

.sf-dock-arc-row {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 7px;
  pointer-events: none;
}

/* Compact Charm Ultimate Medallion */
.sf-ult-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
}

.sf-ult-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle, #3D2B1F 20%, #2A1D15 85%, #1A120D 100%);
  border: 2px solid #C9A45C;
  box-shadow: 0 3px 10px rgba(0,0,0,0.5), inset 0 1.5px 3px rgba(255,255,255,0.2);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  touch-action: manipulation;
  transition: transform 0.08s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.2s ease;
}

.sf-ult-btn:active { transform: scale(0.92); }

.sf-ult-btn.sf-ult-ready {
  border-color: #FFE082;
  box-shadow: 0 0 12px rgba(232, 184, 90, 0.75), inset 0 0 5px rgba(255, 238, 88, 0.5);
  animation: sfUltPulse 1.3s infinite alternate ease-in-out;
}

@keyframes sfUltPulse {
  0% { transform: scale(1.0); box-shadow: 0 0 8px rgba(232, 184, 90, 0.5); }
  100% { transform: scale(1.05); box-shadow: 0 0 16px rgba(255, 238, 88, 0.95); }
}

.sf-ult-svg {
  position: absolute;
  inset: -3px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.sf-ult-track {
  fill: none;
  stroke: rgba(201, 164, 92, 0.22);
  stroke-width: 4;
}

.sf-ult-ring {
  fill: none;
  stroke: #E8B85A;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 276;
  stroke-dashoffset: 0;
}

.sf-ult-icon { font-size: 16px; line-height: 1; }
.sf-ult-label {
  font-size: 6.5px;
  font-weight: 900;
  color: #FFECA8;
  margin-top: 1px;
  letter-spacing: 0.2px;
  max-width: 34px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.sf-ult-cd-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  display: none;
  align-items: center;
  justify-content: center;
  color: #FFF;
  font-size: 10.5px;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

/* [Skill 1] & [Skill 2] Quarter-Circle Arc Buttons */
.sf-skill-btn {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #332744 10%, #1E172A 82%, #130E1C 100%);
  border: 2.5px solid #A78BFA;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.48), inset 0 1.5px 3px rgba(255, 255, 255, 0.22);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  touch-action: none;
  pointer-events: auto;
  transition: transform 0.08s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

/* Master Crafters: slot positions now live in the absolute .sf-skill-cluster block below */

.sf-skill-btn.empty {
  background: radial-gradient(circle, rgba(42, 30, 22, 0.85), rgba(26, 18, 13, 0.92));
  border: 2px dashed rgba(201, 164, 92, 0.65);
}

.sf-skill-btn.lv5 {
  border-color: #FDE047;
  box-shadow: 0 0 14px rgba(250, 204, 21, 0.55), 0 4px 12px rgba(0, 0, 0, 0.48);
}

.sf-skill-btn:active,
.sf-skill-btn.aiming {
  transform: scale(0.92);
  border-color: #67E8F9;
  box-shadow: 0 0 16px rgba(103, 232, 249, 0.75);
}

.sf-skill-svg {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.sf-skill-ring {
  fill: none;
  stroke: #A78BFA;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 276;
  stroke-dashoffset: 0;
}

.sf-skill-ico {
  font-size: 20px;
  line-height: 1;
}

.sf-skill-lv {
  position: absolute;
  bottom: -4px;
  padding: 0 5px;
  border-radius: 999px;
  background: #2E1065;
  border: 1px solid #C4B5FD;
  color: #F5F3FF;
  font-size: 8.5px;
  font-weight: 900;
  line-height: 1.3;
}

.sf-skill-btn.lv5 .sf-skill-lv {
  background: #78350F;
  border-color: #FDE047;
  color: #FEF08A;
}

.sf-skill-cd {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(10, 8, 18, 0.72);
  display: none;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 900;
  text-shadow: 0 1px 2px #000;
}

/* Rune Ring Strike Button */
.sf-rune-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  pointer-events: none;
}

.sf-target-pills {
  display: flex;
  gap: 5px;
  pointer-events: auto;
}

.sf-target-pill {
  border: 1.5px solid rgba(201, 164, 92, 0.78);
  background: rgba(36, 24, 18, 0.88);
  color: #F4EAD6;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  pointer-events: auto;
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.sf-target-pill.on {
  background: linear-gradient(180deg, #F6DC9A, #C9A45C);
  color: #3B2A20;
  border-color: #FFF3A8;
  box-shadow: 0 0 12px rgba(232, 184, 90, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
}

.sf-target-pill.species-locked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px 2px 3px !important;
  height: 26px;
  background: linear-gradient(180deg, #FEF08A 0%, #EAB308 100%);
  border: 1.5px solid #FEF9C3;
  color: #3B2A20;
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.65), 0 2px 6px rgba(0, 0, 0, 0.4);
}
.sf-auto-mob-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  background: #FFFDF7;
  border: 1.5px solid #5C2D16;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.sf-auto-mob-lbl {
  font-size: 9.8px;
  font-weight: 900;
  letter-spacing: -0.1px;
  line-height: 1;
}

.sf-target-pill:active {
  transform: scale(0.92);
}

.sf-rarity-boost-pill {
  margin-bottom: 1px;
  /* Master Crafters: narrow right-aligned 2-line clamp so it never reaches the centered context actions */
  max-width: 104px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  text-align: right;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sf-rune-btn {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: radial-gradient(circle, #F8F1E2 20%, #E9DCC0 85%, #DFCBA6 100%);
  border: 3.5px solid #3B2A20;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  touch-action: manipulation;
  pointer-events: auto;
  transition: transform 0.08s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.sf-rune-btn:active,
.sf-rune-btn.sf-held {
  transform: scale(0.93);
  border-color: #E8B85A;
}

.sf-rune-svg {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.sf-rune-track {
  fill: none;
  stroke: rgba(59, 42, 32, 0.22);
  stroke-width: 4;
}

.sf-rune-sweetspot {
  fill: none;
  stroke: rgba(250, 204, 21, 0.42);
  stroke-width: 6;
  stroke-dasharray: 110 264;
  stroke-dashoffset: -153;
}

.sf-rune-ring {
  fill: none;
  stroke: #C9A45C;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 264;
  stroke-dashoffset: 264;
  transition: stroke-dashoffset 0.05s linear;
}

.sf-rune-btn.sf-beat-active {
  border-color: #C9A45C;
  box-shadow: 0 0 18px #E8B85A, 0 0 32px rgba(232, 184, 90, 0.6), inset 0 0 10px #E8B85A;
  animation: sfPulseBeat 0.22s infinite alternate ease-in-out;
}

.sf-rune-btn.sf-beat-active .sf-rune-ring {
  stroke: #FFF3A8;
  stroke-width: 6;
  filter: drop-shadow(0 0 6px #E8B85A);
}

@keyframes sfPulseBeat {
  0% { transform: scale(1.0); }
  100% { transform: scale(1.08); }
}

.sf-rune-icon {
  font-size: 24px;
  line-height: 1;
}

.sf-rune-label {
  font-size: 9px;
  font-weight: 900;
  color: #3B2A20;
  margin-top: 2px;
  letter-spacing: 0.5px;
}

.sf-rune-flash {
  position: absolute;
  top: -34px;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  font-size: 18px;
  font-weight: 900;
  color: #FFF275;
  text-shadow: 0 0 10px #E8B85A, 0 2px 4px #000;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.sf-rune-flash.sf-flash-anim {
  animation: sfFlash 0.65s ease-out forwards;
}

@keyframes sfFlash {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1.3);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) translateY(-14px) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-26px) scale(0.9);
  }
}

/* --- Storybook Astrolabe Mini-Map & Interactive Expedition Map Modal --- */
.sf-minimap-btn {
  position: absolute;
  top: max(48px, calc(env(safe-area-inset-top, 10px) + 38px));
  right: 10px;
  width: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  pointer-events: auto;
  z-index: 26;
  transition: transform 0.14s ease, filter 0.14s ease;
  -webkit-tap-highlight-color: transparent;
}

.sf-minimap-btn:hover {
  transform: scale(1.05);
}

.sf-minimap-btn:active {
  transform: scale(0.95);
}

.sf-minimap-canvas {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2.5px solid #DFB15B;
  box-shadow:
    0 5px 16px rgba(0, 0, 0, 0.52),
    inset 0 0 0 1.5px rgba(255, 240, 195, 0.38);
  display: block;
}

.sf-minimap-pill {
  margin-top: -8px;
  background: linear-gradient(180deg, #F6E7C8 0%, #DFC699 100%);
  border: 1.5px solid #3B2A20;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 9.5px;
  font-weight: 900;
  color: #3B2A20;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  letter-spacing: 0.15px;
}

body:has(.bc-overlay:not([hidden])) .sf-minimap-btn,
body:has(.bc-modal-backdrop:not([hidden])) .sf-minimap-btn,
body:has(.bc-overlay:not([hidden])) .sf-overhead-layer,
body:has(.bc-modal-backdrop:not([hidden])) .sf-overhead-layer,
body:has(#rpg-ui:not([hidden])) #sf-hud > :not(.bc-overlay),
body:has(.hub-wrap:not([hidden])) #sf-hud > :not(.bc-overlay),
body:has(#sf-map-modal:not([hidden])) .sf-minimap-btn,
body:has(#sf-bounty-modal:not([hidden])) .sf-minimap-btn,
body:has(#sf-skill-modal:not([hidden])) .sf-minimap-btn,
body:has(#sf-map-modal:not([hidden])) .sf-overhead-layer,
body:has(#sf-bounty-modal:not([hidden])) .sf-overhead-layer,
body:has(#sf-skill-modal:not([hidden])) .sf-overhead-layer {
  display: none !important;
}

@keyframes sfModalIn {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.sf-map-modal {
  position: fixed;
  inset: 0;
  background: rgba(14, 10, 8, 0.68);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  z-index: 260;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-map-modal[hidden] {
  display: none !important;
}

.sf-map-card {
  width: min(94vw, 410px);
  max-height: min(86vh, 760px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #F7ECD5 0%, #EAD7B3 100%);
  border: 3px solid #4A321F;
  border-radius: 22px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.65);
  padding: 12px 14px 14px;
  color: #3B2A20;
  font-family: system-ui, -apple-system, sans-serif;
  animation: sfModalIn 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.sf-map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sf-map-title {
  font-size: 15px;
  font-weight: 900;
  color: #3B2A20;
  letter-spacing: 0.2px;
}

.sf-map-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #4A321F;
  background: #E5CFA6;
  color: #3B2A20;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-map-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 9px;
}

.sf-map-tab {
  min-height: 34px;
  padding: 5px 4px;
  border-radius: 10px;
  border: 1.5px solid #B5925B;
  background: rgba(255, 251, 240, 0.65);
  color: #5C3D24;
  font-size: 10.5px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-map-tab.active {
  background: linear-gradient(180deg, #3B2A20 0%, #261A13 100%);
  border-color: #DFB15B;
  color: #FFE7A3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.sf-map-tab.locked {
  opacity: 0.68;
}

.sf-bigmap-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #231914 0%, #17100C 100%);
  border: 2.5px solid #8A6236;
  border-radius: 16px;
  padding: 8px;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.55);
}

.sf-bigmap-canvas {
  width: 100%;
  max-width: 248px;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  cursor: crosshair;
  display: block;
  touch-action: manipulation;
}

.sf-bigmap-hint {
  margin-top: 5px;
  font-size: 10.5px;
  font-weight: 800;
  color: #E7D5B4;
  text-align: center;
}

.sf-map-sec-label {
  margin: 10px 0 5px;
  font-size: 11.5px;
  font-weight: 900;
  color: #6B4423;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sf-map-poi-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sf-map-poi-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 252, 244, 0.92);
  border: 1.5px solid #D4B075;
  border-radius: 12px;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.08s ease;
}

.sf-map-poi-row:hover {
  background: #FFFDF7;
}

.sf-map-poi-row:active {
  transform: scale(0.99);
}

.sf-map-poi-ico {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.sf-map-poi-meta {
  flex: 1 1 auto;
  min-width: 0;
}

.sf-map-poi-name {
  font-size: 12px;
  font-weight: 900;
  color: #342011;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-map-poi-sub {
  font-size: 10.5px;
  font-weight: 700;
  color: #7A5330;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-map-poi-btns {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.sf-map-btn {
  padding: 5px 9px;
  min-height: 28px;
  border-radius: 9px;
  border: 1.5px solid #9A6B28;
  background: linear-gradient(180deg, #FCD34D 0%, #D97706 100%);
  color: #2A1606;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-map-btn.warp {
  border-color: #0E7490;
  background: linear-gradient(180deg, #38BDF8 0%, #0284C7 100%);
  color: #FFFFFF;
}

.sf-map-btn.locked-hunt {
  border-color: #94A3B8;
  background: linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%);
  color: #475569;
}

.sf-jump-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 24px;
  padding: 2px 7px;
  margin-left: 4px;
  border-radius: 999px;
  border: 1px solid #C8AA78;
  background: #FFF8E7;
  color: #7C2D12;
  font-size: 9.5px;
  font-weight: 900;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* --- Field Bounties & Daily Goddess Stamp Chest Modal --- */
.sf-bounty-modal {
  position: fixed;
  inset: 0;
  background: rgba(14, 10, 8, 0.68);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  z-index: 265;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-bounty-modal[hidden] {
  display: none !important;
}

.sf-bounty-card-sheet {
  width: min(94vw, 396px);
  max-height: min(85vh, 720px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #F7ECD5 0%, #EAD7B3 100%);
  border: 3px solid #3B2A20;
  border-radius: 22px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.62), inset 0 0 0 2px #C9A45C;
  padding: 12px 14px 14px;
  color: #3B2A20;
  animation: sfModalIn 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.sf-stamp-chest {
  background: linear-gradient(135deg, #3B2A20 0%, #261912 100%);
  border: 2px solid #DFB15B;
  border-radius: 15px;
  padding: 10px 12px;
  color: #FFF8E7;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sf-stamp-dots {
  display: flex;
  gap: 5px;
  margin-top: 4px;
}

.sf-stamp-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(255, 224, 130, 0.45);
  background: rgba(0, 0, 0, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.sf-stamp-dot.lit {
  border-color: #FDE047;
  background: radial-gradient(circle, #FEF08A 0%, #D97706 100%);
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.7);
}

.sf-bounty-item {
  background: rgba(255, 252, 244, 0.94);
  border: 2px solid #C9A45C;
  border-radius: 14px;
  padding: 9px 10px;
  margin-bottom: 8px;
}

.sf-bounty-item.done {
  border-color: #65A30D;
  background: #F7FEE7;
}

.sf-bounty-bar {
  position: relative;
  height: 13px;
  border-radius: 999px;
  background: #DDD0B6;
  border: 1.5px solid #8A6F4C;
  overflow: hidden;
  margin: 6px 0;
}

.sf-bounty-bar > i {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #D97706, #FACC15);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.sf-bounty-item.done .sf-bounty-bar > i {
  background: linear-gradient(90deg, #4D7C0F, #84CC16);
}

.sf-bounty-bar > b {
  position: absolute;
  inset: 0;
  text-align: center;
  font-size: 9.5px;
  line-height: 11px;
  font-weight: 900;
  color: #3B2A20;
}

.sf-bounty-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sf-bounty-chip {
  font-size: 10.5px;
  font-weight: 800;
  background: #FEF3C7;
  border: 1px solid #D4B075;
  border-radius: 999px;
  padding: 1px 7px;
  color: #5C3D24;
}

/* Scope #joystick hit-zone tightly around .joystick-base in Sky Frontier so it never overlaps #bottom-dock, #sf-heal-btn, or 3D node taps */
#hud[data-scene="SKY_FRONTIER"] #joystick {
  left: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  width: calc(140px * var(--ui-scale, 1));
  height: calc(140px * var(--ui-scale, 1));
}

#hud[data-scene="SKY_FRONTIER"] #joystick .joystick-base {
  left: 8px;
  bottom: calc(10px * var(--ui-scale, 1));
}

/* Monster Skill Scroll Drop Celebration Banner */
.sf-scroll-banner {
  position: absolute;
  top: max(118px, calc(env(safe-area-inset-top, 10px) + 108px));
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 356px);
  background: linear-gradient(135deg, rgba(46, 16, 101, 0.96), rgba(88, 28, 135, 0.96));
  border: 2.5px solid #FDE047;
  border-radius: 18px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #FEF9C3;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55), 0 0 22px rgba(250, 204, 21, 0.45);
  z-index: 36;
  pointer-events: auto;
  touch-action: manipulation;
  transition: top 0.18s ease;
  animation: sfScrollPop 0.28s cubic-bezier(0.22, 1.3, 0.36, 1);
}

.sf-scroll-banner.below-top-bar {
  top: max(198px, calc(env(safe-area-inset-top, 10px) + 188px));
}

.sf-scroll-banner[hidden] {
  display: none !important;
}

@keyframes sfScrollPop {
  from { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

/* Skill Book & Glamour Weapon Quick-Swap Modal */
.sf-skill-modal {
  position: fixed;
  inset: 0;
  z-index: 262;
  background: rgba(15, 10, 22, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-skill-modal[hidden] {
  display: none !important;
}

body:has(#sf-skill-modal:not([hidden])) .sf-quest-dock,
body:has(#sf-skill-modal:not([hidden])) .bc-sf-pouch {
  display: none !important;
}

.sf-skill-sheet {
  width: min(95vw, 392px);
  max-height: min(86vh, 760px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #FBF3E0 0%, #EFE0BE 100%);
  border: 3px solid #3B2A20;
  border-radius: 20px;
  padding: 12px;
  color: #2E1C10;
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.55);
  animation: sfModalIn 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.sf-skill-sec {
  font-size: 11.5px;
  font-weight: 900;
  color: #5C3D24;
  margin: 8px 0 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sf-wep-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-x;
  padding-bottom: 4px;
}

.sf-wep-strip::-webkit-scrollbar,
.sf-codex-filters::-webkit-scrollbar {
  display: none;
}

.sf-wep-chip {
  flex: 0 0 auto;
  min-width: 104px;
  max-width: 132px;
  background: #FFF9ED;
  border: 2px solid #C8AA78;
  border-radius: 13px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-wep-chip.active {
  background: linear-gradient(180deg, #FEF3C7, #FDE68A);
  border-color: #B45309;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
}

.sf-sk-card {
  background: #FFFDF7;
  border: 2px solid #D4B88C;
  border-radius: 14px;
  padding: 8px 9px;
  margin-bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-sk-card.equipped {
  border-color: #7C3AED;
  background: linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%);
}

.sf-sk-card.is-focused {
  border-color: #D97706;
  box-shadow: 0 0 0 2.5px rgba(245, 158, 11, 0.35), 0 4px 12px rgba(0, 0, 0, 0.16);
}

.sf-sk-card.locked {
  opacity: 0.78;
  background: #F5EFE2;
}

/* Segmented Tabs (Skill Scrolls | Monster Codex) & Bestiary Cards */
.sf-book-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  background: #DFCBA6;
  border: 2px solid #4A321F;
  border-radius: 13px;
  padding: 3px;
  margin-bottom: 9px;
}

.sf-book-tab {
  border: none;
  border-radius: 9px;
  min-height: 32px;
  padding: 6px 8px;
  font-size: 11.5px;
  font-weight: 900;
  color: #4A321F;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.14s ease, color 0.14s ease;
}

.sf-book-tab.active {
  background: linear-gradient(180deg, #4A3324 0%, #2C1D14 100%);
  color: #FFE7A3;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.32);
}

.sf-codex-filters {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-x;
  padding-bottom: 4px;
  margin-bottom: 7px;
}

.sf-codex-filter {
  flex: 0 0 auto;
  min-height: 28px;
  border: 1.5px solid #B89872;
  background: #FFF9ED;
  color: #4A321F;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 10.5px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.sf-codex-filter.active {
  background: linear-gradient(180deg, #FEF3C7 0%, #FDE68A 100%);
  border-color: #B45309;
  color: #78350F;
}

.sf-codex-card {
  background: #FFFDF7;
  border: 2px solid #D4B88C;
  border-radius: 15px;
  padding: 9px 10px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 2px 6px rgba(59, 42, 32, 0.08);
}

.sf-codex-card.is-boss {
  border-color: #B45309;
  background: linear-gradient(180deg, #FFFDF5 0%, #FEF6DF 100%);
}

.sf-codex-card.is-focused {
  border-color: #7C3AED;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25), 0 4px 12px rgba(0, 0, 0, 0.16);
}

.sf-codex-portrait-wrap {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 13px;
  background: radial-gradient(circle at 50% 42%, #FFF9E6 0%, #E7D5B4 100%);
  border: 2px solid #8C6A43;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.sf-codex-card.is-boss .sf-codex-portrait-wrap {
  background: radial-gradient(circle at 50% 42%, #FEF9C3 0%, #F59E0B 100%);
  border-color: #78350F;
}

.sf-codex-portrait {
  width: 44px;
  height: 44px;
  object-fit: contain;
  display: block;
}

.sf-codex-stat-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sf-codex-stat-pill {
  background: #F4EAD6;
  border: 1px solid #D4B88C;
  border-radius: 8px;
  padding: 2px 6px;
  font-size: 9.8px;
  font-weight: 900;
  color: #3B2A20;
  white-space: nowrap;
}

.sf-codex-drops {
  background: #F8F1E1;
  border: 1.5px solid #DEC79F;
  border-radius: 11px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sf-codex-drop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 800;
  color: #2E1C10;
}

.sf-codex-rate {
  font-size: 10px;
  font-weight: 900;
  border-radius: 7px;
  padding: 1px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.sf-codex-rate.guaranteed {
  background: #DCFCE7;
  color: #166534;
  border: 1px solid #86EFAC;
}

.sf-codex-rate.scroll {
  background: #F3E8FF;
  color: #6B21A8;
  border: 1px solid #D8B4FE;
}

.sf-codex-rate.charm {
  background: #FEF3C7;
  color: #92400E;
  border: 1px solid #FCD34D;
}

.sf-codex-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 2px;
}

/* ============================================================
   Master Crafters — 2x2 skill cluster arcing around the Rune button.
   Fixed 204x140 box; every control absolutely placed (zero overlap at 393x852).
   rune 128,64 (76) | S1 76,90 | S2 76,36 | S3 140,8 | S4 24,90 (46) | ult 30,44 (36) | passive 92,2 (28)
   ============================================================ */
.sf-skill-cluster {
  position: relative;
  display: block;
  width: 204px;
  height: 140px;
  gap: 0;
  pointer-events: none;
}
.sf-skill-cluster > .sf-rune-btn { position: absolute; left: 128px; top: 64px; width: 76px; height: 76px; }
.sf-skill-cluster > .sf-skill-btn { position: absolute; width: 46px; height: 46px; }
.sf-skill-cluster > .sf-skill-btn.slot-0 { left: 76px; top: 90px; }
.sf-skill-cluster > .sf-skill-btn.slot-1 { left: 76px; top: 36px; }
.sf-skill-cluster > .sf-skill-btn.slot-2 { left: 140px; top: 8px; }
.sf-skill-cluster > .sf-skill-btn.slot-3 { left: 24px; top: 90px; }
.sf-skill-cluster > .sf-ult-wrapper { position: absolute; left: 30px; top: 44px; width: 36px; height: 36px; }
.sf-skill-cluster > .sf-passive-chip { position: absolute; left: 92px; top: 2px; }
.sf-skill-cluster .sf-skill-ico { font-size: 18px; }
.sf-skill-cluster .sf-skill-ico img { width: 26px; height: 26px; object-fit: contain; }
.sf-skill-cluster .sf-skill-lv { font-size: 8px; bottom: -3px; }

.sf-skill-key {
  position: absolute;
  top: -3px;
  left: -3px;
  min-width: 14px;
  height: 14px;
  padding: 0 2px;
  border-radius: 7px;
  background: #3B2A20;
  border: 1px solid #C9A45C;
  color: #FFE7A3;
  font-size: 8.5px;
  font-weight: 900;
  line-height: 12px;
  text-align: center;
  pointer-events: none;
  box-sizing: border-box;
}

.sf-skill-btn.locked {
  background: radial-gradient(circle, rgba(40, 36, 34, 0.9), rgba(20, 18, 16, 0.94));
  border: 2px solid rgba(120, 113, 108, 0.75);
  filter: grayscale(0.85);
  opacity: 0.78;
}
.sf-skill-btn.locked .sf-skill-ring { stroke: rgba(120, 113, 108, 0.5); }
.sf-skill-btn.locked .sf-skill-key { background: #44403C; border-color: #A8A29E; color: #E7E5E4; }

.sf-passive-chip {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 35% 30%, #3F2E1E 10%, #241810 85%);
  border: 2px solid #E8B85A;
  box-shadow: 0 0 8px rgba(232, 184, 90, 0.45), 0 2px 6px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
  outline: none;
  transition: transform 0.08s ease;
}
.sf-passive-chip:active { transform: scale(0.9); }
.sf-passive-chip.empty {
  border: 1.5px dashed rgba(201, 164, 92, 0.7);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  opacity: 0.85;
}
.sf-passive-ico { font-size: 13px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.sf-passive-ico img { width: 20px; height: 20px; object-fit: contain; }
.sf-passive-lv {
  position: absolute;
  right: -4px;
  bottom: -3px;
  min-width: 12px;
  height: 12px;
  padding: 0 2px;
  border-radius: 6px;
  background: #78350F;
  border: 1px solid #FDE047;
  color: #FEF08A;
  font-size: 7.5px;
  font-weight: 900;
  line-height: 10px;
  text-align: center;
  box-sizing: border-box;
}

/* Status tags + Guard (poise) on the targeted mob plate — absolute so plate height is unchanged */
.sf-mob-plate { position: absolute; }
.sf-mob-tag-row {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 2px;
  display: flex;
  gap: 2px;
  justify-content: center;
  white-space: nowrap;
  pointer-events: none;
}
.sf-mob-tag-row:empty { display: none; }
.sf-mob-tag-row .sf-tag-chip {
  padding: 1px 6px 1px 3px;
  background: rgba(15, 23, 42, 0.9);
  color: #F8FAFC;
  font-size: 9px;
  font-weight: 900;
  border-width: 1.5px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
.sf-mob-plate.is-frozen {
  border-color: #67E8F9;
  box-shadow: 0 0 12px rgba(103, 232, 249, 0.55);
}
.sf-boss-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.sf-boss-tag-row:empty { display: none; }
.sf-sk-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9.5px;
  font-weight: 900;
  color: #312E81;
  background: linear-gradient(180deg, #E0E7FF, #C7D2FE);
  border: 1px solid #818CF8;
  border-radius: 999px;
  padding: 1px 7px;
}
.sf-sk-scaling-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.sf-sk-scale-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9.5px;
  font-weight: 900;
  background: #FFFBEB;
  border: 1px solid #FCD34D;
  color: #78350F;
  border-radius: 7px;
  padding: 1px 6px;
}
.sf-sk-scale-pill b { color: #B45309; }
.sf-sk-puzzle-hint {
  font-size: 9.8px;
  font-weight: 800;
  color: #1E3A8A;
  background: #EFF6FF;
  border: 1px dashed #93C5FD;
  border-radius: 8px;
  padding: 3px 7px;
  line-height: 1.28;
}
.sf-mob-guard-track {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 2px;
  width: 84px;
  height: 4px;
  border-radius: 3px;
  background: rgba(20, 14, 10, 0.75);
  border: 1px solid rgba(250, 250, 249, 0.55);
  overflow: hidden;
  pointer-events: none;
}
.sf-mob-guard-track[hidden] { display: none; }
.sf-mob-guard-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #E7E5E4, #FDE68A);
  transition: width 0.15s ease;
}
.sf-mob-guard-track.is-broken { border-color: #FCA5A5; }
.sf-mob-guard-track.is-broken .sf-mob-guard-fill { background: #EF4444; animation: sfPulseSoft 0.5s ease-in-out infinite alternate; }

/* Boss Guard bar */
.sf-boss-guard {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.sf-boss-guard-lbl {
  font-size: 9.5px;
  font-weight: 900;
  color: #F5F5F4;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
  min-width: 52px;
}
.sf-boss-guard-track {
  flex: 1;
  height: 6px;
  border-radius: 4px;
  background: rgba(20, 14, 10, 0.75);
  border: 1px solid rgba(250, 250, 249, 0.5);
  overflow: hidden;
}
.sf-boss-guard-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #D6D3D1, #FDE68A);
  transition: width 0.2s ease;
}
.sf-boss-guard.is-broken .sf-boss-guard-lbl { color: #FCA5A5; }
.sf-boss-guard.is-broken .sf-boss-guard-fill { background: #EF4444; animation: sfPulseSoft 0.5s ease-in-out infinite alternate; }

/* Reaction floating text */
.sf-floating-item.sf-float-reaction {
  color: #FDF4FF;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.3px;
  text-shadow: 0 0 10px #C026D3, 0 0 4px #7C3AED, 0 2px 3px #000;
}

/* Combo icons / chips */
.sf-combo-ico { display: inline-block; vertical-align: middle; object-fit: contain; image-rendering: auto; }
.sf-combo-ico-emoji { display: inline-block; vertical-align: middle; line-height: 1; }
.sf-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px 1px 2px;
  border-radius: 999px;
  border: 1.5px solid #A8A29E;
  background: #FFFDF7;
  font-size: 9.5px;
  font-weight: 900;
  color: #3B2A20;
  line-height: 1.2;
  white-space: nowrap;
}
.sf-trait-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #EDE9FE;
  border: 1px solid #C4B5FD;
  color: #4C1D95;
  font-size: 9.5px;
  font-weight: 900;
  white-space: nowrap;
}
.sf-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 6px;
  background: #3B2A20;
  color: #FFE7A3;
  font-size: 9.5px;
  font-weight: 900;
  white-space: nowrap;
}
.sf-combo-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 4px 0;
  padding: 5px 6px;
  border-radius: 9px;
  background: rgba(223, 203, 166, 0.45);
  border: 1px dashed rgba(74, 50, 31, 0.35);
}
.sf-combo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; font-size: 10px; color: #4A3525; }
.sf-combo-lbl { font-size: 9.5px; font-weight: 900; color: #6B4F35; margin-right: 2px; white-space: nowrap; }
.sf-combo-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 900;
  white-space: nowrap;
  background: #F5F5F4;
  border: 1px solid #D6D3D1;
  color: #44403C;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
}
.sf-combo-chip.setup { background: #E0F2FE; border-color: #7DD3FC; color: #075985; }
.sf-combo-chip.payoff { background: #FEF3C7; border-color: #FCD34D; color: #92400E; }

/* Essence craft + slot picker */
.sf-craft-btn { background: linear-gradient(180deg, #F5D0FE, #D8B4FE); color: #581C87; border-color: #7E22CE; }
.sf-craft-btn.is-disabled { filter: grayscale(0.8); opacity: 0.6; }
.sf-craft-btn.is-max {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 9px;
  background: #FEF3C7;
  border: 1.5px solid #F59E0B;
  color: #92400E;
  font-size: 10px;
  font-weight: 900;
}
.sf-slot-pick { min-width: 30px; padding-left: 6px; padding-right: 6px; }
.sf-slot-pick.on { background: linear-gradient(180deg, #4A3324, #2C1D14); color: #FFE7A3; }
.sf-slot-pick.is-locked { filter: grayscale(0.9); opacity: 0.55; }
.sf-map-btn.is-disabled { filter: grayscale(0.8); opacity: 0.55; }
.sf-map-btn.on { box-shadow: 0 0 0 2px #E8B85A inset; }

/* Loadout grid + presets */
.sf-loadout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}
.sf-loadout-slot {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 40px;
  padding: 5px 6px 5px 20px;
  border-radius: 10px;
  border: 2px solid #4A321F;
  background: #FFFDF7;
  color: #3B2A20;
  font: inherit;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}
.sf-loadout-slot.is-empty { border-style: dashed; background: rgba(255, 253, 247, 0.6); cursor: default; }
.sf-loadout-slot.is-locked { border-color: #A8A29E; background: #E7E5E4; color: #78716C; }
.sf-loadout-key {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 13px;
  height: 13px;
  border-radius: 7px;
  background: #3B2A20;
  color: #FFE7A3;
  font-size: 8.5px;
  font-weight: 900;
  line-height: 13px;
  text-align: center;
}
.sf-loadout-ico { font-size: 18px; line-height: 1; flex-shrink: 0; }
.sf-loadout-ico img { width: 24px; height: 24px; object-fit: contain; }
.sf-loadout-name { flex: 1; min-width: 0; font-size: 10px; font-weight: 900; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
.sf-loadout-lv { font-size: 9px; font-weight: 900; color: #7C3AED; white-space: nowrap; }
.sf-loadout-passive {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 8px;
  border-radius: 10px;
  border: 2px solid #C9A45C;
  background: #FEF9C3;
  font-size: 10.5px;
  font-weight: 900;
  color: #3B2A20;
}
.sf-preset-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 9px;
}
.sf-preset-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 5px;
  border-radius: 10px;
  border: 2px solid #4A321F;
  background: #FFFDF7;
  font-size: 9.5px;
  font-weight: 900;
  color: #3B2A20;
  min-width: 0;
}
.sf-preset-card.is-empty { border-style: dashed; background: rgba(255, 253, 247, 0.6); color: #8B7355; }
.sf-preset-card .sf-map-btn { padding: 3px 4px; font-size: 9.5px; }

/* 4-tab Skill Book + Codex combo info */
.sf-book-tabs.sf-book-tabs-4 { grid-template-columns: repeat(4, 1fr); gap: 3px; }
.sf-book-tabs-4 .sf-book-tab { font-size: 10px; padding: 6px 2px; min-height: 30px; }
.sf-codex-combo { display: flex; flex-direction: column; gap: 3px; margin: 4px 0; }
.sf-codex-arch { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 800; line-height: 1.3; }
/* 🎶 Resonance window glow on damaging skill buttons */
.sf-skill-btn.resonant { box-shadow: 0 0 0 2px #86EFAC, 0 0 12px #86EFAC; animation: sfPulseSoft 0.8s ease-in-out infinite alternate; }
/* Inline loadout naming (no window.prompt) */
.sf-preset-name-row { display: flex; gap: 3px; align-items: center; min-width: 0; }
.sf-preset-name-wrap { flex: 1; min-width: 0; overflow: hidden; }
.sf-preset-name-input { font-size: 16px; transform: scale(0.7); transform-origin: left center; width: 143%; margin-right: -43%; border: 1.5px solid #C9A45C; border-radius: 6px; background: #FFFDF7; font-weight: 900; color: #2E1C10; padding: 1px 4px; box-sizing: border-box; font-family: inherit; }
.sf-preset-cycle { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 999px; border: 1.5px solid #C9A45C; background: #FFF8E7; font-size: 11px; line-height: 1; padding: 0; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; touch-action: manipulation; }
.sf-mech-card { margin-bottom: 6px; }
.sf-mech-tag { display: inline-block; border-radius: 999px; padding: 1px 6px; background: #EDE9FE; color: #4C1D95; font-size: 9.5px; font-weight: 900; vertical-align: middle; }
`;

export class SkyFrontierScene {
  constructor({ world, request, toast }) {
    this.world = world;
    this.request = request;
    this.toast = toast;
    this.onExit = null;

    this.active = false;
    this.layout = null;
    this.halfSize = 36;
    this.elapsed = 0;

    // Root Three.js group
    this.root = new THREE.Group();
    this.root.name = 'sky_frontier_root';
    this.root.visible = false;
    if (this.world?.scene) {
      this.world.scene.add(this.root);
    }

    // Node & gate tracking
    this.nodeMeshes = new Map(); // nodeId -> mesh
    this.nodes = this.nodeMeshes;
    this.gateMeshes = new Map(); // gateKey -> mesh

    // Auto-swing state (gathering)
    this.targetNode = null;
    this.targetGate = null;
    this._navTarget = null;
    this._minimapAccum = 0;
    this.mapModalOpen = false;
    this.isSwinging = false;
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this.runeHeld = false;
    this.autoGatherEnabled = false;
    this.preferredTargetType = 'auto';
    this.lockedHuntMobId = null;
    this.lockedHuntAnchor = null;
    this._lastGatheredNodeType = null;
    this._localPerfectStreak = 0;
    this._autoChainTimer = null;
    this.audioCtx = null;

    // Combat state
    this.activeMonsters = new Map(); // id -> monsterData
    this.monsters = this.activeMonsters;
    this._statusCalloutDedup = new Map();
    this.monsterPool = new Map();    // type -> array of pooled THREE.Group
    this.targetMonster = null;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldownMs = 650;
    this._attackInFlight = false;
    this._nextAttackServerAt = 0;
    this._attackCdFromServer = false;
    this._localAtkSeq = 0;
    this._pendingLocalAtk = null;
    this._pendingLocalSkill = null;
    this._heldTool = null;
    this._comboStep = 0;
    this._lastAttackSwingAt = 0;

    // Monster Skills, 4-Phase SkillVfxEngine & 3D Aiming state
    this.skillVfxGroup = new THREE.Group();
    this.skillVfxGroup.name = 'sf_skill_vfx_root';
    this.skillVfx = new SkillVfxEngine({
      root: this.skillVfxGroup,
      camPitch: this.world?.pitch || 0.58,
      onScreenShake: (intensity, dur) => this.punchCamera(intensity, dur),
    });
    this._skillVfxEngine = this.skillVfx;
    this.skillCds = [0, 0, 0, 0];
    this._skillCds = this.skillCds;
    this.skillTotalCds = [8000, 8000, 8000, 8000];
    this._reactionTextAt = new Map(); // monId:reactionId -> last floating text ms (250ms dedupe)
    this._tagSpriteTexCache = new Map(); // tagMask -> { tex, aspect }
    this._presetBusy = false;
    this.skillModalOpen = false;
    this._skillModalTab = 'skills';
    this._codexFilter = 'all';
    this._skillRegionFilter = 'all';
    this._mapInspectRegion = null;
    this._codexFocusId = null;
    this._skillFocusId = null;
    this._skillModalScroll = { skills: 0, codex: 0, filterSkills: 0, filterCodex: 0, wepLeft: 0 };
    this._skillAimState = null;
    this.skillAimGroup = null;
    this._lastLocalSkillFxKey = '';
    this._lastAutoSkillAt = 0;
    this._scrollBannerTimer = null;
    this._alphaTelegraphs = [];
    this._alphaTelegraphPool = [];
    this._activeSkillZones = [];
    this._localBuffs = { hasteUntil: 0, hastePct: 0, dmgReduceUntil: 0, critUpUntil: 0 };
    this._enterGen = 0;
    this._projTmp = { x: 0, y: 0 };
    this._cachedWeaponInfo = null;
    this._hudCache = {};
    this._minimapStaticCanvas = null;
    this._minimapStaticKey = '';
    this._bigmapStaticCanvas = null;
    this._bigmapStaticKey = '';
    this._selfPlateW = 116;
    this._selfPlateH = 32;
    this._mobPlateW = 124;
    this._mobPlateH = 33;

    // Tree of Savior MMORPG Overhead Character & Co-Op Ally Plate state
    this._tmpOverheadVec = new THREE.Vector3();
    this._remotePlates = new Map();
    this._remoteHp = new Map();
    this._castCalloutUntil = 0;
    this._lastOverheadKey = '';

    // Ultimate state
    this.ultReadyAt = 0;
    this.ultTotalCd = 60000;
    this.vfxRings = []; // active expanding VFX ring objects

    // Player HP state
    this.playerHp = { hp: 100, maxHp: 100, shield: 0 };
    this._hasServerPlayerHp = false;
    this._vitalityRegenPerSec = 0;

    // Outpost & Invasion & Boss state
    this.outpostState = null;
    this.outpostPlatform = null;
    this.outpostStatue = null;
    this.outpostRing = null;
    this.sanctuaryRing = null;
    this.bossTelegraphRing = null;
    this._bossTelegraphTimer = 0;
    this._lastBossStage = 0;
    this.lightShafts = [];
    this._breadcrumbs = [];
    this._slashArcs = [];
    this.invasionState = null;
    this.activeBoss = null;
    this.bossCooldownUntil = 0;

    // Quest & Bounty state
    this.bountyModalOpen = false;
    this._bountyBusy = false;
    this._knownReadyBounties = new Set();
    this._pinnedGoal = null;
    this._pendingSeek = null;
    this._healBusy = false;

    // Energy state
    this.energy = { cur: ENERGY?.MAX || 200, max: ENERGY?.MAX || 200 };

    // Floating text & flying loot magnet list
    this.floatingTexts = [];
    this.lootMagnets = [];
    this.dyingMonsters = [];

    // Pre-allocated combat geometries & materials cache
    this._mobGeos = null;
    this._mobMats = null;
    this._initSharedCombatAssets();

    // DOM HUD elements
    this.hudEl = null;
    this.vialEl = null;
    this.vialLiquidEl = null;
    this.vialTextEl = null;
    this.hpBarEl = null;
    this.hpBarFillEl = null;
    this.hpBarTextEl = null;
    this.bagPillEl = null;
    this.bountyBtnEl = null;
    this.bountyTxtEl = null;
    this.bountyModalEl = null;
    this.healBtnEl = null;
    this.regionNameEl = null;
    this.playersEl = null;
    this.homeBtnEl = null;
    this.floatContainerEl = null;
    this.invasionBannerEl = null;
    this.invasionTitleEl = null;
    this.invasionSubEl = null;
    this.bossBarEl = null;
    this.bossNameEl = null;
    this.bossStageEl = null;
    this.bossFillEl = null;
    this.bossTextEl = null;
    this.repairBtnEl = null;
    this.bossBtnEl = null;
    this.ultBtnEl = null;
    this.ultRingEl = null;
    this.ultIconEl = null;
    this.ultLabelEl = null;
    this.ultCdOverlayEl = null;
    this.runeWrapperEl = null;
    this.runeBtnEl = null;
    this.runeRingEl = null;
    this.runeFlashEl = null;

    this._ensureHud();
  }

  // ------------------------------------------------------------------ Shared Asset Cache
  _initSharedCombatAssets() {
    this._mobGeos = {
      // Moss Slime
      slimeBody: new THREE.SphereGeometry(0.5, 12, 10),
      sproutStem: new THREE.CylinderGeometry(0.04, 0.04, 0.25, 5),
      sproutLeaves: new THREE.ConeGeometry(0.12, 0.2, 5),
      // Thornback Boar
      boarBody: new THREE.BoxGeometry(0.7, 0.55, 0.95),
      boarSnout: new THREE.BoxGeometry(0.4, 0.35, 0.4),
      tusk: new THREE.ConeGeometry(0.06, 0.22, 5),
      // Pollen Wisp
      wispCore: new THREE.SphereGeometry(0.32, 12, 10),
      wispGlow: new THREE.SphereGeometry(0.42, 10, 8),
      // Crystal Beetle
      beetleShell: new THREE.DodecahedronGeometry(0.52, 0),
      // Lantern Bat
      batBody: new THREE.SphereGeometry(0.28, 10, 8),
      batWing: new THREE.BoxGeometry(0.45, 0.04, 0.25),
      amberDot: new THREE.SphereGeometry(0.12, 8, 6),
      // Quartz Golemling
      golemBase: new THREE.BoxGeometry(0.65, 0.35, 0.55),
      golemTorso: new THREE.BoxGeometry(0.5, 0.45, 0.45),
      golemHead: new THREE.BoxGeometry(0.35, 0.3, 0.35),
      crystalAccent: new THREE.OctahedronGeometry(0.18, 0),
      // Boss Crown & Alpha Elite Ring
      crownRing: new THREE.TorusGeometry(0.7, 0.08, 8, 24),
      eliteRing: new THREE.RingGeometry(0.56, 0.72, 28),
      // HP Bar
      hpBg: new THREE.PlaneGeometry(0.8, 0.09),
      hpFill: new THREE.PlaneGeometry(0.76, 0.07),
      guardBg: new THREE.PlaneGeometry(0.8, 0.05),
      guardFill: new THREE.PlaneGeometry(0.76, 0.034),
      // Shared unit primitives (scaled per instance to eliminate per-node/mob/telegraph buffer churn)
      unitPlane: (() => {
        const g = new THREE.PlaneGeometry(1, 1);
        g.translate(0, 0.5, 0);
        return g;
      })(),
      unitGroundCircle: (() => {
        const g = new THREE.CircleGeometry(1, 22);
        g.rotateX(-Math.PI / 2);
        return g;
      })(),
      unitGroundRing: (() => {
        const g = new THREE.RingGeometry(0.86, 1.0, 36);
        g.rotateX(-Math.PI / 2);
        return g;
      })(),
    };
    for (const g of Object.values(this._mobGeos)) {
      if (g) g.userData = { ...g.userData, sharedFrontierAsset: true };
    }

    this._mobMats = {
      slime: new THREE.MeshStandardMaterial({ color: 0x52B74B, roughness: 0.6 }),
      sproutStem: new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 }),
      sproutLeaf: new THREE.MeshStandardMaterial({ color: 0x81C784, roughness: 0.6 }),
      boarBody: new THREE.MeshStandardMaterial({ color: 0x6E472A, roughness: 0.85 }),
      boarSnout: new THREE.MeshStandardMaterial({ color: 0x58371F, roughness: 0.85 }),
      tusk: new THREE.MeshStandardMaterial({ color: 0xE8DFC8, roughness: 0.4 }),
      wispCore: new THREE.MeshStandardMaterial({ color: 0xFFE042, emissive: 0xFFB300, emissiveIntensity: 0.65, roughness: 0.3 }),
      wispGlow: new THREE.MeshBasicMaterial({ color: 0xFFF176, transparent: true, opacity: 0.35, depthWrite: false }),
      beetle: new THREE.MeshStandardMaterial({ color: 0x26C6DA, roughness: 0.25, metalness: 0.3, emissive: 0x006064, emissiveIntensity: 0.3 }),
      batBody: new THREE.MeshStandardMaterial({ color: 0x2B2735, roughness: 0.8 }),
      batWing: new THREE.MeshStandardMaterial({ color: 0x1E1A26, roughness: 0.9 }),
      amberDot: new THREE.MeshStandardMaterial({ color: 0xFF9800, emissive: 0xFF9800, emissiveIntensity: 0.9 }),
      golemBase: new THREE.MeshStandardMaterial({ color: 0x787A7D, roughness: 0.9 }),
      golemTorso: new THREE.MeshStandardMaterial({ color: 0x93969A, roughness: 0.85 }),
      golemHead: new THREE.MeshStandardMaterial({ color: 0xA4A7AB, roughness: 0.8 }),
      crystalAccent: new THREE.MeshStandardMaterial({ color: 0x6FE0F0, roughness: 0.3 }),
      crown: new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFA000, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 }),
      eliteRing: new THREE.MeshBasicMaterial({
        color: 0xFDE047,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      hpBg: new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }),
      hpFill: new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide }),
      guardFill: new THREE.MeshBasicMaterial({ color: 0x7DD3FC, side: THREE.DoubleSide }),
      guardBroken: new THREE.MeshBasicMaterial({ color: 0xF43F5E, side: THREE.DoubleSide }),
    };
    for (const m of Object.values(this._mobMats)) {
      if (m) m.userData = { ...m.userData, sharedFrontierAsset: true };
    }
  }

  _disposeObjectTree(rootObj) {
    if (!rootObj) return;
    const disposeMat = (m) => {
      if (!m || m.userData?.sharedFrontierAsset) return;
      m._disposed = true;
      if (m.map && m.map.userData?.ownedByFrontier) {
        m.map.dispose?.();
      }
      m.dispose?.();
    };
    rootObj.traverse?.((obj) => {
      if (obj === rootObj || obj === this.skillVfxGroup) return;
      if (obj.geometry && !obj.geometry.userData?.sharedFrontierAsset) {
        obj.geometry.dispose?.();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(disposeMat);
        else disposeMat(obj.material);
      }
    });
    while (rootObj.children?.length > 0) {
      rootObj.remove(rootObj.children[0]);
    }
  }

  // ------------------------------------------------------------------ DOM HUD
  _ensureHud() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('sf-hud-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'sf-hud-style';
      styleEl.textContent = HUD_STYLE;
      document.head.appendChild(styleEl);
    }

    let hud = document.getElementById('sf-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'sf-hud';
      hud.innerHTML = `
        <div class="sf-top-bar">
          <div class="sf-top-left">
            <div class="sf-bars-col">
              <div class="sf-vial-row" id="sf-vial-row">
                <div class="sf-vial" id="sf-vial" role="button" tabindex="0" title="Tap for Energy Refills">
                  <div class="sf-vial-liquid" id="sf-vial-liquid"></div>
                  <span class="sf-vial-text" id="sf-vial-text">⚡ 200/200</span>
                </div>
              </div>
            </div>
            <button type="button" class="sf-bag-pill" id="sf-bag-pill" title="Open Storage &amp; Camp Crate">
              📦 0/300
            </button>
            <button type="button" class="sf-codex-pill" id="sf-codex-btn" title="Monster Codex &amp; Drop Guide">
              👾 Codex
            </button>
          </div>
          <button type="button" class="sf-btn-home" id="sf-btn-home">🏠 Home</button>
        </div>

        <div class="sf-overhead-layer" id="sf-overhead-layer">
          <div class="sf-char-plate is-self" id="sf-player-overhead">
            <div class="sf-cast-callout" id="sf-cast-callout" hidden></div>
            <div class="sf-plate-top">
              <span class="sf-plate-cls" id="sf-plate-cls">⚔️</span>
              <span class="sf-plate-name" id="sf-plate-name">Adventurer</span>
              <span class="sf-plate-lv" id="sf-plate-lv">Lv.1</span>
              <span class="sf-plate-buffs" id="sf-plate-buffs"></span>
            </div>
            <div class="sf-hp-bar" id="sf-hp-bar">
              <div class="sf-hp-bar-fill" id="sf-hp-bar-fill"></div>
              <div class="sf-hp-shield-fill" id="sf-hp-shield-fill"></div>
              <span class="sf-hp-bar-text" id="sf-hp-bar-text">100/100</span>
            </div>
          </div>
          <div class="sf-mob-plate" id="sf-mob-overhead" hidden>
            <div class="sf-mob-tag-row" id="sf-mob-tag-row"></div>
            <div class="sf-mob-plate-top">
              <span id="sf-mob-plate-name">🫧 Monster</span>
              <button type="button" class="sf-mob-codex-chip" id="sf-mob-codex-chip" title="Open Monster Codex">📖</button>
            </div>
            <div class="sf-mob-hp-track">
              <div class="sf-mob-hp-fill" id="sf-mob-hp-fill"></div>
              <span class="sf-mob-hp-txt" id="sf-mob-hp-txt">30/30</span>
            </div>
            <div class="sf-mob-guard-track" id="sf-mob-guard-track" hidden><div class="sf-mob-guard-fill" id="sf-mob-guard-fill"></div></div>
          </div>
          <div id="sf-remote-plates"></div>
        </div>

        <div class="sf-quest-dock" id="sf-quest-dock">
          <div class="sf-quest-row" id="sf-quest-row">
            <button type="button" class="sf-bounty-btn" id="sf-bounty-btn" title="Field Bounties &amp; Daily Stamp Chest">
              <span id="sf-bounty-txt">📖 0/3</span>
              <span class="sf-bounty-dot" id="sf-bounty-dot"></span>
            </button>
          </div>
          <div class="sf-status-pills" id="sf-status-pills">
            <button type="button" class="sf-partner-pill" id="sf-partner-pill"></button>
          </div>
        </div>

        <button type="button" class="sf-minimap-btn" id="sf-minimap-btn" aria-label="Open Expedition Map">
          <canvas class="sf-minimap-canvas" id="sf-minimap-canvas" width="144" height="144"></canvas>
          <span class="sf-minimap-pill" id="sf-minimap-pill">🌲 1/10</span>
        </button>

        <div class="sf-map-modal" id="sf-map-modal" hidden></div>
        <div class="sf-bounty-modal" id="sf-bounty-modal" hidden></div>
        <div class="sf-skill-modal" id="sf-skill-modal" hidden></div>
        <div class="sf-scroll-banner" id="sf-scroll-banner" hidden></div>

        <div class="sf-top-center">
          <div class="sf-invasion-banner" id="sf-invasion-banner" style="display: none;">
            <span class="sf-invasion-title" id="sf-invasion-title">⚠️ INVASION IMMINENT</span>
            <span class="sf-invasion-sub" id="sf-invasion-sub">Wave 1 starting soon...</span>
          </div>
          <div class="sf-boss-bar" id="sf-boss-bar" style="display: none;" title="Tap to view Boss Drop Table in Monster Codex">
            <div class="sf-boss-bar-header">
              <span class="sf-boss-name" id="sf-boss-name">👑 Elder Moss Golem</span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span class="sf-boss-stage" id="sf-boss-stage">Phase 1</span>
                <span style="font-size:9.5px;font-weight:900;background:rgba(223,177,91,0.22);border:1px solid #DFB15B;color:#FFE7A3;border-radius:999px;padding:0 5px;">📖 Drops</span>
              </span>
            </div>
            <div class="sf-boss-bar-track">
              <div class="sf-boss-bar-fill" id="sf-boss-bar-fill"></div>
              <span class="sf-boss-bar-text" id="sf-boss-bar-text">2400 / 2400</span>
            </div>
            <div class="sf-boss-guard" id="sf-boss-guard" style="display: none;">
              <span class="sf-boss-guard-lbl" id="sf-boss-guard-lbl">🛡️ Guard</span>
              <div class="sf-boss-guard-track"><div class="sf-boss-guard-fill" id="sf-boss-guard-fill"></div></div>
            </div>
            <div class="sf-boss-tag-row" id="sf-boss-tag-row"></div>
          </div>
        </div>

        <div class="sf-floating-container" id="sf-floating-container"></div>

        <div class="sf-context-actions" id="sf-context-actions">
          <button type="button" class="sf-heal-btn" id="sf-heal-btn" style="display: none;">
            🧪 Quick Heal
          </button>
          <button type="button" class="sf-repair-btn" id="sf-repair-btn" style="display: none;">
            🔧 Repair Outpost
          </button>
          <button type="button" class="sf-boss-btn" id="sf-boss-btn" style="display: none;">
            ⚔️ Summon Boss
          </button>
        </div>

        <div class="sf-bottom-right-dock" id="sf-bottom-right-dock">
          <div class="sf-rune-wrapper" id="sf-rune-wrapper">
            <div class="sf-rarity-boost-pill" id="sf-rarity-boost">✨ Tap Node or Auto to Gather</div>
            <div class="sf-dock-top-row">
              <button type="button" class="sf-target-pill" id="sf-skillbook-btn" title="Monster Skill Scrolls &amp; Weapon Class Quick-Swap">📖 Skills</button>
              <div class="sf-target-pills" id="sf-target-pills" role="group" aria-label="Auto Gather Toggle">
                <button type="button" class="sf-target-pill" id="sf-auto-toggle" data-sf-target="auto" aria-pressed="false">✨ Auto: OFF</button>
              </div>
            </div>
            <div class="sf-rune-flash" id="sf-rune-flash">PERFECT!</div>
            <!-- Master Crafters 2x2 skill cluster arcing around the main Rune button (absolute, 204x140 box) -->
            <div class="sf-dock-arc-row sf-skill-cluster" id="sf-skill-cluster">
              <div class="sf-ult-wrapper" id="sf-ult-wrapper">
                <button type="button" class="sf-ult-btn" id="sf-ult-btn" aria-label="Ultimate">
                  <svg class="sf-ult-svg" viewBox="0 0 100 100">
                    <circle class="sf-ult-track" cx="50" cy="50" r="44" />
                    <circle class="sf-ult-ring" id="sf-ult-ring" cx="50" cy="50" r="44" />
                  </svg>
                  <span class="sf-ult-icon" id="sf-ult-icon">✨</span>
                  <span class="sf-ult-label" id="sf-ult-label">ULT</span>
                  <div class="sf-ult-cd-overlay" id="sf-ult-cd-overlay"></div>
                </button>
              </div>
              <button type="button" class="sf-passive-chip empty" id="sf-passive-chip" aria-label="Monster Passive" title="Monster Passive (tap to open 🏅 Passives)">
                <span class="sf-passive-ico" id="sf-passive-ico">🏅</span>
                <span class="sf-passive-lv" id="sf-passive-lv" style="display:none;">1</span>
              </button>
              ${[0, 1, 2, 3].map((i) => `
              <button type="button" class="sf-skill-btn slot-${i} empty" id="sf-skill-btn-${i}" data-skill-slot="${i}" aria-label="Monster Skill Slot ${i + 1}">
                <svg class="sf-skill-svg" viewBox="0 0 100 100">
                  <circle class="sf-skill-ring" id="sf-skill-ring-${i}" cx="50" cy="50" r="44" />
                </svg>
                <span class="sf-skill-ico" id="sf-skill-ico-${i}">➕</span>
                <span class="sf-skill-lv" id="sf-skill-lv-${i}" style="display:none;">Lv.1</span>
                <span class="sf-skill-key">${i + 1}</span>
                <div class="sf-skill-cd" id="sf-skill-cd-${i}"></div>
              </button>`).join('')}
              <button type="button" class="sf-rune-btn" id="sf-rune-btn" aria-label="Gather & Strike">
                <svg class="sf-rune-svg" viewBox="0 0 100 100">
                  <circle class="sf-rune-track" cx="50" cy="50" r="42" />
                  <circle class="sf-rune-sweetspot" cx="50" cy="50" r="42" />
                  <circle class="sf-rune-ring" id="sf-rune-ring" cx="50" cy="50" r="42" />
                </svg>
                <span class="sf-rune-icon" id="sf-rune-icon">⚒️</span>
                <span class="sf-rune-label" id="sf-rune-label">GATHER</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(hud);
    }

    this.hudEl = hud;
    this.vialEl = hud.querySelector('#sf-vial');
    this.vialLiquidEl = hud.querySelector('#sf-vial-liquid');
    this.vialTextEl = hud.querySelector('#sf-vial-text');
    this.hpBarEl = hud.querySelector('#sf-hp-bar');
    this.hpBarFillEl = hud.querySelector('#sf-hp-bar-fill');
    this.hpShieldFillEl = hud.querySelector('#sf-hp-shield-fill');
    this.hpBarTextEl = hud.querySelector('#sf-hp-bar-text');
    this.overheadLayerEl = hud.querySelector('#sf-overhead-layer');
    this.playerOverheadEl = hud.querySelector('#sf-player-overhead');
    this.plateClsEl = hud.querySelector('#sf-plate-cls');
    this.plateNameEl = hud.querySelector('#sf-plate-name');
    this.plateLvEl = hud.querySelector('#sf-plate-lv');
    this.plateBuffsEl = hud.querySelector('#sf-plate-buffs');
    this.castCalloutEl = hud.querySelector('#sf-cast-callout');
    this.mobOverheadEl = hud.querySelector('#sf-mob-overhead');
    this.mobPlateNameEl = hud.querySelector('#sf-mob-plate-name');
    this.mobCodexChipEl = hud.querySelector('#sf-mob-codex-chip');
    this.mobHpFillEl = hud.querySelector('#sf-mob-hp-fill');
    this.mobHpTxtEl = hud.querySelector('#sf-mob-hp-txt');
    this.remotePlatesContainerEl = hud.querySelector('#sf-remote-plates');
    this.bagPillEl = hud.querySelector('#sf-bag-pill');
    this.codexBtnEl = hud.querySelector('#sf-codex-btn');
    this.bountyBtnEl = hud.querySelector('#sf-bounty-btn');
    this.bountyTxtEl = hud.querySelector('#sf-bounty-txt');
    this.bountyModalEl = hud.querySelector('#sf-bounty-modal');
    this.skillModalEl = hud.querySelector('#sf-skill-modal');
    this.scrollBannerEl = hud.querySelector('#sf-scroll-banner');
    this.healBtnEl = hud.querySelector('#sf-heal-btn');
    this.regionNameEl = hud.querySelector('#sf-chip-region');
    this.playersEl = hud.querySelector('#sf-chip-players');
    this.chipEl = hud.querySelector('#sf-chip');
    this.homeBtnEl = hud.querySelector('#sf-btn-home');
    this.minimapBtnEl = hud.querySelector('#sf-minimap-btn');
    this.minimapCanvasEl = hud.querySelector('#sf-minimap-canvas');
    this.minimapCtx = this.minimapCanvasEl?.getContext?.('2d') || null;
    this.minimapPillEl = hud.querySelector('#sf-minimap-pill');
    this.mapModalEl = hud.querySelector('#sf-map-modal');
    this.floatContainerEl = hud.querySelector('#sf-floating-container');

    this.partnerPillEl = hud.querySelector('#sf-partner-pill');
    this.invasionBannerEl = hud.querySelector('#sf-invasion-banner');
    this.invasionTitleEl = hud.querySelector('#sf-invasion-title');
    this.invasionSubEl = hud.querySelector('#sf-invasion-sub');

    this.bossBarEl = hud.querySelector('#sf-boss-bar');
    this.bossNameEl = hud.querySelector('#sf-boss-name');
    this.bossStageEl = hud.querySelector('#sf-boss-stage');
    this.bossFillEl = hud.querySelector('#sf-boss-bar-fill');
    this.bossTextEl = hud.querySelector('#sf-boss-bar-text');

    this.repairBtnEl = hud.querySelector('#sf-repair-btn');
    this.bossBtnEl = hud.querySelector('#sf-boss-btn');

    this.ultWrapperEl = hud.querySelector('#sf-ult-wrapper');
    this.ultBtnEl = hud.querySelector('#sf-ult-btn');
    this.ultRingEl = hud.querySelector('#sf-ult-ring');
    this.ultIconEl = hud.querySelector('#sf-ult-icon');
    this.ultLabelEl = hud.querySelector('#sf-ult-label');
    this.ultCdOverlayEl = hud.querySelector('#sf-ult-cd-overlay');

    this.runeWrapperEl = hud.querySelector('#sf-rune-wrapper');
    this.skillBookBtnEl = hud.querySelector('#sf-skillbook-btn');
    this.skillBtnEls = [0, 1, 2, 3].map((i) => hud.querySelector(`#sf-skill-btn-${i}`));
    this.skillRingEls = [0, 1, 2, 3].map((i) => hud.querySelector(`#sf-skill-ring-${i}`));
    this.skillIcoEls = [0, 1, 2, 3].map((i) => hud.querySelector(`#sf-skill-ico-${i}`));
    this.skillLvEls = [0, 1, 2, 3].map((i) => hud.querySelector(`#sf-skill-lv-${i}`));
    this.skillCdEls = [0, 1, 2, 3].map((i) => hud.querySelector(`#sf-skill-cd-${i}`));
    this.passiveChipEl = hud.querySelector('#sf-passive-chip');
    this.passiveIcoEl = hud.querySelector('#sf-passive-ico');
    this.passiveLvEl = hud.querySelector('#sf-passive-lv');
    this.mobTagRowEl = hud.querySelector('#sf-mob-tag-row');
    this.mobGuardTrackEl = hud.querySelector('#sf-mob-guard-track');
    this.mobGuardFillEl = hud.querySelector('#sf-mob-guard-fill');
    this.bossGuardEl = hud.querySelector('#sf-boss-guard');
    this.bossGuardLblEl = hud.querySelector('#sf-boss-guard-lbl');
    this.bossGuardFillEl = hud.querySelector('#sf-boss-guard-fill');
    this.bossTagRowEl = hud.querySelector('#sf-boss-tag-row');
    this.targetPillsEl = hud.querySelector('#sf-target-pills');
    this.autoToggleEl = hud.querySelector('#sf-auto-toggle');
    this.rarityBoostEl = hud.querySelector('#sf-rarity-boost');
    this.runeBtnEl = hud.querySelector('#sf-rune-btn');
    this.runeRingEl = hud.querySelector('#sf-rune-ring');
    this.runeIconEl = hud.querySelector('#sf-rune-icon');
    this.runeLabelEl = hud.querySelector('#sf-rune-label');
    this.runeFlashEl = hud.querySelector('#sf-rune-flash');

    if (this.skillBookBtnEl) {
      this.skillBookBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openSkillModal('skills');
      };
    }

    if (this.codexBtnEl) {
      this.codexBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openCodexModal();
      };
    }

    if (this.mobCodexChipEl) {
      this.mobCodexChipEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const monType = this.targetMonster?.type || null;
        this.openCodexModal(monType);
      };
    }

    if (this.bossBarEl) {
      this.bossBarEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rMeta = REGION_META[this._currentRegionId()] || REGION_META.meadow;
        const bossId = this.activeBoss?.type || this.activeBoss?.bossId || rMeta.bossId;
        this.openCodexModal(bossId, 'boss');
      };
    }

    if (this.skillModalEl) {
      this.skillModalEl.addEventListener('click', (e) => this._onSkillModalClick(e));
      // Inline loadout-preset naming (no native prompt): keep drafts so re-renders don't lose typing
      this.skillModalEl.addEventListener('input', (e) => {
        const inp = e.target?.closest?.('[data-preset-name-input]');
        if (!inp) return;
        const i = Number(inp.getAttribute('data-preset-name-input')) || 0;
        (this._presetNameDrafts || (this._presetNameDrafts = {}))[i] = String(inp.value || '').slice(0, 12);
      });
      this.skillModalEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target?.closest?.('[data-preset-name-input]')) {
          e.preventDefault();
          e.target.blur();
        }
      });
    }

    if (this.scrollBannerEl) {
      this.scrollBannerEl.addEventListener('click', (e) => this._onScrollBannerClick(e));
    }

    [0, 1, 2, 3].forEach((slotIdx) => {
      const btn = this.skillBtnEls[slotIdx];
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => this._onSkillPointerDown(slotIdx, e));
      btn.addEventListener('pointermove', (e) => this._onSkillPointerMove(slotIdx, e));
      btn.addEventListener('pointerup', (e) => this._onSkillPointerUp(slotIdx, e));
      btn.addEventListener('pointercancel', () => this._cancelSkillAim());
    });

    if (this.passiveChipEl) {
      this.passiveChipEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openSkillModal('passives');
      };
    }

    // Desktop keyboard shortcuts: 1–4 cast Monster Skill slots (ignored while typing in inputs)
    if (typeof window !== 'undefined' && !this._skillKeyHandler) {
      this._skillKeyHandler = (e) => {
        if (!this.active || this.skillModalOpen) return;
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx < 0) return;
        if (!this._skillSlotUnlocked(idx)) {
          this._showSlotLockedToast(idx);
          return;
        }
        this.castMonsterSkill(idx);
      };
      window.addEventListener('keydown', this._skillKeyHandler);
    }

    if (this.vialEl) {
      this.vialEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.__neora?.basecampUI?.open?.('energy');
      };
    }

    if (this.bagPillEl) {
      this.bagPillEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.__neora?.basecampUI?.open?.('storage');
      };
    }

    if (this.bountyBtnEl) {
      this.bountyBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openBountyModal();
      };
    }

    if (this.bountyModalEl) {
      this.bountyModalEl.addEventListener('click', (e) => this._onBountyModalClick(e));
    }

    if (this.healBtnEl) {
      this.healBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onQuickHealTap();
      };
    }

    if (this.homeBtnEl) {
      this.homeBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof this.onExit === 'function') {
          this.onExit();
        }
      };
    }

    if (this.minimapBtnEl) {
      this.minimapBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openMapModal();
      };
    }

    if (this.chipEl) {
      this.chipEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openMapModal();
      };
    }

    if (this.mapModalEl) {
      this.mapModalEl.addEventListener('click', (e) => this._onMapModalClick(e));
    }

    if (this.partnerPillEl) {
      this.partnerPillEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.followPartner();
      };
    }

    if (this.targetPillsEl) {
      this.targetPillsEl.addEventListener('pointerdown', (e) => {
        const pill = e.target.closest('[data-sf-target], #sf-auto-toggle');
        if (!pill) return;
        e.preventDefault();
        e.stopPropagation();
        this.setAutoGather(!this.autoGatherEnabled, { playSfx: true });
      });
    }

    if (this.runeBtnEl) {
      const handleDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.runeHeld = true;
        this.runeBtnEl.classList.add('sf-held');
        this.onRuneTap();
      };
      const handleUp = () => {
        this.runeHeld = false;
        this.runeBtnEl?.classList.remove('sf-held');
      };
      this.runeBtnEl.addEventListener('pointerdown', handleDown);
      this.runeBtnEl.addEventListener('pointerup', handleUp);
      this.runeBtnEl.addEventListener('pointercancel', handleUp);
      this.runeBtnEl.addEventListener('pointerleave', handleUp);
    }

    if (this.ultBtnEl) {
      const handleUlt = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerUltimate();
      };
      this.ultBtnEl.addEventListener('pointerdown', handleUlt);
    }

    if (this.repairBtnEl) {
      this.repairBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onRepairTap();
      };
    }

    if (this.bossBtnEl) {
      this.bossBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onBossSummonTap();
      };
    }

    this.hudEl.style.display = this.active ? 'block' : 'none';
  }

  // ------------------------------------------------------------------ Profile, Storage, Bounties & Smart Seek
  _getProfile() {
    return window.__neora?.state?.profile || this.world?.local?.profile || null;
  }

  _syncPlayerHpSnapshot(playerHpMap, prof = null) {
    if (!playerHpMap || typeof playerHpMap !== 'object') return;
    const p = prof || this._getProfile();
    const localId = this.world?.local?.id || p?.id;
    const localSnap = localId ? playerHpMap[localId] : null;
    if (localSnap && Number.isFinite(Number(localSnap.hp))) {
      const lv = Number(p?.level) || 1;
      const uni = p ? computeUniversalStats(p) : { total: {} };
      const fallbackMax = playerMaxHp(lv, uni.total);
      const snapMax = Math.max(1, Number(localSnap.maxHp) || fallbackMax);
      if (Number.isFinite(Number(localSnap.regenPerSec)) && Number(localSnap.regenPerSec) > 0) {
        this._vitalityRegenPerSec = Number(localSnap.regenPerSec);
      }
      this._hasServerPlayerHp = true;
      this.playerHp = {
        hp: Math.max(0, Math.min(snapMax, Number(localSnap.hp))),
        maxHp: snapMax,
        shield: Math.max(0, Number(localSnap.shieldHp ?? localSnap.shield ?? 0)),
      };
      this.updatePlayerHpBar();
    }
  }

  onProfileUpdate(profile) {
    const p = profile || this._getProfile();
    if (!p) return;
    if (p.frontier?.energy) {
      const now = Date.now() + (this.world?.serverOffset || 0);
      this.energy = regenEnergy(p.frontier.energy, now);
    }
    const uni = computeUniversalStats(p);
    const nextMaxHp = playerMaxHp(p.level || 1, uni.total);
    if (this.playerHp && nextMaxHp !== this.playerHp.maxHp) {
      const wasFull = this.playerHp.hp >= this.playerHp.maxHp;
      this.playerHp.maxHp = nextMaxHp;
      if (wasFull || this.playerHp.hp > nextMaxHp) this.playerHp.hp = nextMaxHp;
      this.updatePlayerHpBar();
    }
    const prevWepKey = this._cachedWeaponInfo?._key;
    this._cachedWeaponInfo = null;
    const nextWep = this._getActiveWeaponInfo(p);
    if (prevWepKey && nextWep._key !== prevWepKey) {
      this._attackCdFromServer = false;
      this.attackCooldownMs = nextWep.cooldownMs || 650;
    }
    this.updateBagPill(p);
    this.updateBountyHud(p, { notifyReady: this.active });
    this.updateUltimateCharm();
    this._serverLockedSlots?.clear?.(); // fresh profile → re-derive slot locks from it
    this.updateSkillButtons(p);
    this._syncRuneButtonState();
    this.updateHud();
    if (this.bountyModalOpen) {
      this._renderBountyModalHtml(p);
    }
    if (this.skillModalOpen) {
      this._renderSkillModalHtml(p);
    }
  }

  updateBagPill(profile = null) {
    if (!this.bagPillEl) return;
    const p = profile || this._getProfile();
    const fr = p?.frontier;
    const used = totalStoreUnits(fr?.warehouse?.items);
    const cap = warehouseCap(fr?.warehouse?.lv || 1);
    const crateUnits = totalStoreUnits(fr?.campCrate?.items);
    const ratio = cap > 0 ? used / cap : 0;

    this.bagPillEl.classList.toggle('full', used >= cap);
    this.bagPillEl.classList.toggle('warn', used < cap && ratio >= 0.85);
    const crateHtml = crateUnits > 0 ? ` <span class="sf-bag-crate-tag">+${crateUnits}</span>` : '';
    const nextHtml = `📦 ${used}/${cap}${crateHtml}`;
    if (this.bagPillEl.innerHTML !== nextHtml) {
      this.bagPillEl.innerHTML = nextHtml;
    }
  }

  updateBountyHud(profile = null, { notifyReady = false } = {}) {
    const p = profile || this._getProfile();
    const fr = p?.frontier;
    if (!fr) return;
    const now = Date.now() + (this.world?.serverOffset || 0);
    const b = fr.bounties || ensureFieldBounties({ ...fr, bounties: fr.bounties ? { ...fr.bounties } : null }, now);
    if (!b || !Array.isArray(b.cards)) return;

    let doneCount = 0;
    let claimableCount = 0;
    for (const c of b.cards) {
      if (!c) continue;
      const complete = c.claimed || (c.have || 0) >= c.goal;
      if (complete) doneCount++;
      if (!c.claimed && (c.have || 0) >= c.goal) {
        claimableCount++;
        if (notifyReady && !this._knownReadyBounties.has(c.id)) {
          this._knownReadyBounties.add(c.id);
          this.playGatherSfx('break_rare');
          this.toast?.(`📖 Field Bounty Complete: ${c.title}! Tap 📖 to claim!`, 3200);
        }
      }
    }
    const stampReady = (b.stamps || 0) >= 3 && !b.bonusClaimed;
    const anyReady = claimableCount > 0 || stampReady;

    if (this.bountyBtnEl) {
      this.bountyBtnEl.classList.toggle('ready', anyReady);
    }
    if (this.bountyTxtEl) {
      const txt = anyReady ? `📖 Claim!` : `📖 ${doneCount}/3`;
      if (this.bountyTxtEl.textContent !== txt) {
        this.bountyTxtEl.textContent = txt;
      }
    }
  }

  openBountyModal() {
    if (!this.active || !this.bountyModalEl) return;
    this.closeMapModal();
    this.closeSkillModal();
    this.bountyModalOpen = true;
    this.playGatherSfx('step_target');
    this._renderBountyModalHtml();
    this.bountyModalEl.hidden = false;
    // Sync authoritative bounty snapshot lazily
    this.request?.('sf_state', {})?.then?.((res) => {
      if (res?.ok) {
        const p = this._getProfile();
        if (res.frontier && p) p.frontier = res.frontier;
        if (res.layout?.playerHp || res.playerHp) {
          this._syncPlayerHpSnapshot(res.layout?.playerHp || res.playerHp, p);
        }
        if (res.frontier) {
          if (this.bountyModalOpen) this._renderBountyModalHtml(p);
          this.updateBountyHud(p);
        }
      }
    })?.catch?.(() => {});
  }

  closeBountyModal() {
    this.bountyModalOpen = false;
    if (this.bountyModalEl) {
      this.bountyModalEl.hidden = true;
      this.bountyModalEl.innerHTML = '';
    }
  }

  _renderBountyModalHtml(profile = null) {
    if (!this.bountyModalEl) return;
    const p = profile || this._getProfile() || {};
    const fr = p.frontier || {};
    const now = Date.now() + (this.world?.serverOffset || 0);
    const b = fr.bounties || ensureFieldBounties({ ...fr, bounties: null }, now);
    const stamps = Math.min(3, Number(b?.stamps) || 0);
    const bonusClaimed = Boolean(b?.bonusClaimed);
    const bonusReady = stamps >= 3 && !bonusClaimed;
    const round = Number(b?.round) || 1;

    const stampDots = [0, 1, 2]
      .map((i) => `<span class="sf-stamp-dot ${i < stamps ? 'lit' : ''}">${i < stamps ? '🌟' : '·'}</span>`)
      .join('');

    const cardsHtml = (b?.cards || [])
      .map((c) => {
        const have = Math.min(c.goal, Math.max(0, Number(c.have) || 0));
        const pct = Math.min(100, Math.round((have / Math.max(1, c.goal)) * 100));
        const canClaim = !c.claimed && have >= c.goal;
        const rewardChips = [];
        if (c.rewards?.gold) rewardChips.push(`<span class="sf-bounty-chip">🪙 +${c.rewards.gold}</span>`);
        if (c.rewards?.energy) rewardChips.push(`<span class="sf-bounty-chip">⚡ +${c.rewards.energy}</span>`);
        for (const [k, qty] of Object.entries(c.rewards?.items || {})) {
          rewardChips.push(`<span class="sf-bounty-chip">${EMOJI_MAP[k] || '📦'} +${qty}</span>`);
        }

        let cta = '';
        if (c.claimed) {
          cta = `<span class="sf-bounty-chip" style="background:#DCFCE7;border-color:#86EFAC;color:#166534;">✓ Claimed</span>`;
        } else if (canClaim) {
          cta = `<button type="button" class="sf-map-btn" style="background:linear-gradient(180deg,#84CC16,#4D7C0F);color:#fff;border-color:#365314;" data-sf-bounty-claim="${c.slot}">🎁 Claim</button>`;
        } else if (c.seekTarget) {
          cta = `<button type="button" class="sf-map-btn warp" data-sf-bounty-seek="${c.seekTarget}">🎯 Seek</button>`;
        }

        return `
          <div class="sf-bounty-item ${canClaim || c.claimed ? 'done' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:900;color:#2E1C10;">${c.icon} ${c.title}</div>
                <div style="font-size:11px;font-weight:700;color:#6E4B2A;">${c.desc}</div>
              </div>
              ${cta}
            </div>
            <div class="sf-bounty-bar">
              <i style="width:${pct}%"></i>
              <b>${have} / ${c.goal}</b>
            </div>
            <div class="sf-bounty-rewards">${rewardChips.join('')}</div>
          </div>
        `;
      })
      .join('');

    const r = FIELD_BOUNTY_STAMP_REWARD;
    let stampAction = '';
    if (bonusClaimed) {
      stampAction = `<span class="sf-bounty-chip" style="background:#065F46;border-color:#34D399;color:#ECFDF5;">✓ Opened Today</span>`;
    } else if (bonusReady) {
      stampAction = `<button type="button" class="sf-map-btn" data-sf-bounty-bonus="1">🎁 Open Chest!</button>`;
    } else {
      stampAction = `<span style="font-size:11px;font-weight:800;color:#FDE68A;white-space:nowrap;">${stamps}/3 Stamps</span>`;
    }

    const innerHtml = `
      <div class="sf-map-head">
        <span class="sf-map-title">📖 Field Bounties <span style="font-size:11px;color:#7A5330;">• Round ${round}</span></span>
        <button type="button" class="sf-map-close" data-sf-bounty-close="1" aria-label="Close">✕</button>
      </div>

      <div class="sf-stamp-chest">
        <div>
          <div style="font-size:12.5px;font-weight:900;color:#FEF08A;">🏆 Goddess Stamp Chest</div>
          <div style="font-size:10.5px;color:#E7D5B4;margin-top:1px;">🪙+${r.gold} · 💎+${r.diamonds} · ⚡+${r.energy} · 🔧+1 · 🍞+1</div>
          <div class="sf-stamp-dots">${stampDots}</div>
        </div>
        ${stampAction}
      </div>

      ${cardsHtml}
      <div style="font-size:10.5px;font-weight:700;color:#6E4B2A;text-align:center;margin-top:4px;">
        ✨ Claiming all 3 deals a fresh higher-reward round automatically!
      </div>
    `;
    let sheet = this.bountyModalEl.querySelector('.sf-bounty-card-sheet');
    if (sheet) {
      const prevTop = sheet.scrollTop;
      sheet.innerHTML = innerHtml;
      sheet.scrollTop = prevTop;
    } else {
      this.bountyModalEl.innerHTML = `<div class="sf-bounty-card-sheet" role="dialog" aria-label="Sky Frontier Field Bounties">${innerHtml}</div>`;
    }
  }

  _onBountyModalClick(e) {
    if (e.target === this.bountyModalEl || e.target.closest('[data-sf-bounty-close]')) {
      e.preventDefault();
      this.closeBountyModal();
      return;
    }
    const claimBtn = e.target.closest('[data-sf-bounty-claim]');
    if (claimBtn) {
      e.preventDefault();
      this.claimBountySlot(Number(claimBtn.dataset.sfBountyClaim));
      return;
    }
    const bonusBtn = e.target.closest('[data-sf-bounty-bonus]');
    if (bonusBtn) {
      e.preventDefault();
      this.claimBountyBonus();
      return;
    }
    const seekBtn = e.target.closest('[data-sf-bounty-seek]');
    if (seekBtn) {
      e.preventDefault();
      const targetId = seekBtn.dataset.sfBountySeek;
      this.closeBountyModal();
      this.seekObjective(targetId, { auto: true });
    }
  }

  async claimBountySlot(slot) {
    if (this._bountyBusy) return;
    this._bountyBusy = true;
    try {
      const res = await this.request('sf_state', { op: 'bounty_claim', slot });
      if (!res?.ok) {
        this.toast?.(res?.error || 'Could not claim bounty yet.', 2200);
        return;
      }
      const p = this._getProfile();
      if (p) {
        if (res.frontier) p.frontier = res.frontier;
        if (Number.isFinite(res.gold)) p.gold = res.gold;
      }
      if (res.energy) this.setEnergy(res.energy);
      if (res.layout?.playerHp || res.playerHp) {
        this._syncPlayerHpSnapshot(res.layout?.playerHp || res.playerHp, p);
      }
      this.playGatherSfx('break_epic');
      const local = this.world?.local;
      if (local) {
        this._showUltRingVfx(local.x, local.z, 3.4, 0xFACC15);
        this.world?.fx?.emit?.('fx_star', local.x, 1.1, local.z, 14, { speed: 1.2, up: 1.4, size: 0.28, life: 0.65 });
      }
      const msg = res.roundAdvanced
        ? `🎉 Bounty Claimed (+${res.goldGain || 0} 🪙)! Round ${res.bounties?.round || 2} Unlocked!`
        : `🎁 Bounty Claimed! +${res.goldGain || 0} 🪙 +${res.rewards?.energy || 0} ⚡`;
      this.toast?.(msg, 3000);
      this.updateBagPill(p);
      this.updateBountyHud(p);
      if (this.bountyModalOpen) this._renderBountyModalHtml(p);
    } catch {
      // ignore
    } finally {
      this._bountyBusy = false;
    }
  }

  async claimBountyBonus() {
    if (this._bountyBusy) return;
    this._bountyBusy = true;
    try {
      const res = await this.request('sf_state', { op: 'bounty_bonus' });
      if (!res?.ok) {
        this.toast?.(res?.error || 'Complete 3 Field Bounties first!', 2200);
        return;
      }
      const p = this._getProfile();
      if (p) {
        if (res.frontier) p.frontier = res.frontier;
        if (Number.isFinite(res.gold)) p.gold = res.gold;
        if (Number.isFinite(res.diamonds)) p.diamonds = res.diamonds;
      }
      if (res.energy) this.setEnergy(res.energy);
      if (res.layout?.playerHp || res.playerHp) {
        this._syncPlayerHpSnapshot(res.layout?.playerHp || res.playerHp, p);
      }
      this.playGatherSfx('break_epic');
      const local = this.world?.local;
      if (local) {
        this._showUltRingVfx(local.x, local.z, 5.0, 0xFDE047);
        this.world?.fx?.emit?.('fx_stardust', local.x, 1.2, local.z, 20, { speed: 1.5, up: 1.6, size: 0.32, life: 0.8 });
      }
      this.toast?.(`🏆 Goddess Chest Opened! +${res.goldGain} 🪙, +${res.diamondGain} 💎, +50 ⚡!`, 3800);
      this.updateBagPill(p);
      this.updateBountyHud(p);
      if (this.bountyModalOpen) this._renderBountyModalHtml(p);
    } catch {
      // ignore
    } finally {
      this._bountyBusy = false;
    }
  }

  setPinnedGoal(goal) {
    this._pinnedGoal = goal && goal.itemId ? { ...goal } : null;
    window.__neora?.basecampUI?.renderFrontierHud?.();
  }

  clearPinnedGoal() {
    this._pinnedGoal = null;
    window.__neora?.basecampUI?.renderFrontierHud?.();
  }

  getPinnedGoal() {
    return this._pinnedGoal;
  }

  _currentRegionId() {
    const raw = String(this.layout?.regionId || '').toLowerCase();
    if (raw.includes('caldera')) return 'caldera';
    if (raw.includes('reef')) return 'reef';
    if (raw.includes('hollow')) return 'hollow';
    return 'meadow';
  }

  _effectiveUnlocks(prof = null) {
    const p = prof || this._getProfile();
    const baseRegs = Array.isArray(p?.frontier?.unlocks?.regions) ? p.frontier.unlocks.regions : ['meadow'];
    const baseGates = Array.isArray(p?.frontier?.unlocks?.gates) ? p.frontier.unlocks.gates : [];
    const regions = new Set(['meadow', ...baseRegs]);
    const gates = new Set(baseGates);
    if (this._isGateUnlocked({ requires: 'hollow' })) {
      regions.add('hollow');
      gates.add('hollow');
    }
    if (this._isGateUnlocked({ requires: 'reef' })) {
      regions.add('reef');
      gates.add('reef');
    }
    if (this._isGateUnlocked({ requires: 'caldera' })) {
      regions.add('caldera');
      gates.add('caldera');
    }
    return { regions: Array.from(regions), gates: Array.from(gates) };
  }

  _nextHopGateToward(fromReg, toReg) {
    const fromIdx = REGION_ORDER.indexOf(fromReg);
    const toIdx = REGION_ORDER.indexOf(toReg);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;
    const nextReg = REGION_ORDER[fromIdx < toIdx ? fromIdx + 1 : fromIdx - 1];
    const GATE_LABELS = {
      meadow: '🌾 Gate: Whispering Meadow',
      hollow: '🌀 Gate: Crystal Hollow',
      reef: '🌸 Gate: Sakura Reef',
      caldera: '⚙️ Gate: Star-Caldera',
    };
    return { to: nextReg, label: GATE_LABELS[nextReg] || `🌀 Gate: ${nextReg}` };
  }

  seekObjective(targetId, opts = {}) {
    if (!targetId) return false;
    this.closeMapModal();
    this.closeBountyModal();
    this.closeSkillModal();

    const p = this._getProfile();
    const unlocks = this._effectiveUnlocks(p);
    const curRegion = this.active ? this._currentRegionId() : 'meadow';
    const target = resolveFrontierTarget(targetId, unlocks, curRegion);
    if (!target) return false;

    if (target.region !== 'meadow' && !this._isGateUnlocked({ requires: target.region })) {
      const rm = REGION_META[target.region];
      this.toast?.(`🔒 ${rm?.name || target.region} unlocks in Story Chapter ${rm?.unlockChapter || 2}!`, 2600);
      return false;
    }

    if (opts.lockSpecies && (target.kind === 'mob' || target.kind === 'boss')) {
      this.lockedHuntMobId = targetId;
      this.lockedHuntAnchor = {
        x: target.x,
        z: target.z,
        region: target.region,
        label: target.label,
        icon: target.icon,
        isBoss: target.kind === 'boss',
      };
      if (opts.auto !== false) {
        this.autoGatherEnabled = true;
      }
      this.stopAutoSwing();
      this.targetNode = null;
      this._renderTargetPills();
      this._syncRuneButtonState();
    } else if (!opts.lockSpecies && target.kind === 'node') {
      this.lockedHuntMobId = null;
      this.lockedHuntAnchor = null;
    }

    if (!this.active || target.region !== curRegion) {
      if (this.active) {
        const hop = this._nextHopGateToward(curRegion, target.region);
        const destUnlocked = target.region === 'meadow' || this._isGateUnlocked({ requires: target.region });
        if (hop && (opts.viaGate || !destUnlocked)) {
          const gate = (this.layout?.gates || []).find((g) => g.to === hop.to);
          if (gate) {
            if (hop.to !== target.region || target.kind !== 'gate') {
              this._pendingSeek = { targetId, opts };
            }
            this.navigateTo(gate.at.x, gate.at.z, { gateTo: hop.to, label: hop.label });
            return true;
          }
        }
      }
      this._pendingSeek = { targetId, opts };
      window.__neora?.enterFrontier?.(target.region, { pendingSeek: { targetId, opts } });
      return true;
    }

    const local = this.world?.local;
    const lx = local?.x ?? 0;
    const lz = local?.z ?? 0;
    const now = Date.now() + (this.world?.serverOffset || 0);

    if (target.kind === 'node' && Array.isArray(target.nodeTypes)) {
      const toolbelt = p?.frontier?.toolbelt || {};
      const allMatching = (this.layout?.nodes || []).filter(
        (n) => target.nodeTypes.includes(n.type) && !(n.depletedUntil && n.depletedUntil > now)
      );
      const harvestable = allMatching.filter((n) => {
        const def = NODE_TYPES[n.type];
        if (!def) return true;
        return (Number(toolbelt[def.tool]) || 1) >= (Number(def.minTier) || 1);
      });

      if (allMatching.length > 0 && harvestable.length === 0) {
        this.toast?.('🔨 Upgrade your Tool to Tier 2 at the Workshop for this vein!', 3200);
        this.navigateTo(target.x, target.z, { label: `${target.icon} ${target.label}` });
        return true;
      }

      if (harvestable.length > 0) {
        let best = harvestable[0];
        let bestD = Infinity;
        for (const n of harvestable) {
          const d = Math.hypot(n.x - lx, n.z - lz);
          if (d < bestD) { bestD = d; best = n; }
        }
        if (opts.auto !== false) {
          this.autoGatherEnabled = true;
          this.preferredTargetType = best.type;
          this._renderTargetPills();
        }
        this.playGatherSfx('step_target');
        this.interact({ kind: 'sf_node', node: best });
        this.toast?.(`🎯 Seeking ${target.icon} ${target.label}!`, 2000);
        return true;
      }
      this.navigateTo(target.x, target.z, { label: `${target.icon} ${target.label}` });
      return true;
    }

    if (target.kind === 'mob') {
      const alive = [];
      for (const m of this.activeMonsters.values()) {
        if (m && m.hp > 0 && !m.isBoss) alive.push(m);
      }
      const hasSpeciesFilter = Array.isArray(target.mobKinds) && target.mobKinds.length > 0;
      const pool = this.lockedHuntMobId
        ? alive.filter((m) => m.type === this.lockedHuntMobId)
        : hasSpeciesFilter
        ? alive.filter((m) => target.mobKinds.includes(m.type))
        : alive;
      if (pool.length > 0) {
        let bestMon = pool[0];
        let bestD = Infinity;
        for (const m of pool) {
          const d = Math.hypot(m.x - lx, m.z - lz);
          if (d < bestD) { bestD = d; bestMon = m; }
        }
        if (opts.auto !== false) {
          this.autoGatherEnabled = true;
          this._renderTargetPills();
        }
        this.playGatherSfx('step_target');
        this.interact({ kind: 'sf_monster', monster: bestMon });
        this.toast?.(`⚔️ Hunting ${target.icon} ${target.label}!`, 2000);
        return true;
      }
      if (opts.auto !== false) {
        this.autoGatherEnabled = true;
        this._renderTargetPills();
      }
      if (this.lockedHuntMobId) {
        this.toast?.(`🎯 Auto-hunting ${target.icon} ${target.label} — waiting at habitat for respawn!`, 2400);
        this.world?.walkTo?.(target.x, target.z);
        this._syncRuneButtonState();
        return true;
      }
      this.navigateTo(target.x, target.z, { label: `${target.icon} ${target.label}` });
      return true;
    }

    if (target.kind === 'boss') {
      let bossMon = null;
      for (const m of this.activeMonsters.values()) {
        if (m && m.isBoss && m.hp > 0 && (!this.lockedHuntMobId || m.type === this.lockedHuntMobId)) {
          bossMon = m;
          break;
        }
      }
      if (opts.auto !== false) {
        this.autoGatherEnabled = true;
        this._renderTargetPills();
      }
      if (bossMon) {
        this.playGatherSfx('step_target');
        this.interact({ kind: 'sf_monster', monster: bossMon });
        this.toast?.(`👑 Engaging ${target.label}!`, 2000);
        return true;
      }
      if (this.lockedHuntMobId) {
        this.toast?.(`🎯 Auto-hunting ${target.icon} ${target.label} — waiting at habitat for respawn!`, 2400);
        this.world?.walkTo?.(target.x, target.z);
        this._syncRuneButtonState();
        return true;
      }
      this.navigateTo(target.x, target.z, { label: `${target.icon} ${target.label}` });
      return true;
    }

    this.navigateTo(target.x, target.z, {
      label: `${target.icon} ${target.label}`,
      gateTo: target.gateTo || null,
    });
    return true;
  }

  async onQuickHealTap() {
    if (this._healBusy) return;
    const p = this._getProfile();
    const pantry = p?.frontier?.pantry?.items || {};
    const potions = Math.floor(Number(pantry.potion_small) || 0);
    if (potions <= 0) {
      const outpost = this.layout?.pois?.outpost || { x: 0, z: 4 };
      this.navigateTo(outpost.x, outpost.z, { label: '🗽 Goddess Sanctuary (Auto-Heal)' });
      return;
    }
    this._healBusy = true;
    try {
      const res = await this.request('sf_eat', { foodId: 'potion_small' });
      if (!res?.ok) {
        if (res?.error === 'cooldown') {
          this.toast?.('🧪 Potion is cooling down — step into the Outpost aura for free healing!', 2200);
        } else if (res?.error === 'hp_full') {
          this.toast?.('❤️ HP is already full!', 1600);
        } else {
          this.toast?.(res?.error || 'Could not use potion', 2000);
        }
        return;
      }
      if (res.pantry && p?.frontier) p.frontier.pantry = res.pantry;
      if (res.energy) this.setEnergy(res.energy);
      if (Number.isFinite(res.hp)) {
        this._hasServerPlayerHp = true;
        this.playerHp = { hp: res.hp, maxHp: res.maxHp || this.playerHp.maxHp, shield: this.playerHp.shield || 0 };
        this.updatePlayerHpBar();
      }
      const local = this.world?.local;
      if (local) {
        this.showFloatingText(`💚 +${res.healed || 35} HP`, local.x, local.z, 'sf-float-uncommon');
        this.world?.fx?.emit?.('fx_heart', local.x, 0.9, local.z, 7, { speed: 0.7, up: 1.1, size: 0.22, life: 0.65 });
      }
      this.playGatherSfx('perfect', 3);
    } catch {
      // ignore
    } finally {
      this._healBusy = false;
    }
  }

  _findNearestLockedMonster() {
    if (!this.lockedHuntMobId) return null;
    const loc = this.world?.local;
    const lx = loc?.x ?? 0;
    const lz = loc?.z ?? 0;
    let best = null;
    let bestD = Infinity;
    for (const m of this.activeMonsters.values()) {
      if (!m || m.hp <= 0 || m.type !== this.lockedHuntMobId) continue;
      const d = Math.hypot(m.x - lx, m.z - lz);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  _renderTargetPills() {
    if (!this.targetPillsEl) return;
    const isOn = Boolean(this.autoGatherEnabled);
    if (isOn && this.lockedHuntMobId) {
      const meta = MONSTER_CODEX_META[this.lockedHuntMobId];
      const mDef = MONSTERS[this.lockedHuntMobId] || BOSSES[this.lockedHuntMobId];
      const sprite = meta?.sprite || '';
      const mName = String(mDef?.name || this.lockedHuntMobId).replace(/["<>]/g, '');
      const avatarHtml = sprite
        ? `<img class="sf-auto-mob-avatar" src="${sprite}" alt="${mName}" />`
        : `<span>${meta?.icon || '🎯'}</span>`;
      this.targetPillsEl.innerHTML = `<button type="button" class="sf-target-pill on species-locked" id="sf-auto-toggle" data-sf-target="auto" data-locked-mob="${this.lockedHuntMobId}" aria-pressed="true" title="Auto-Hunting ${mName} only · Tap to turn off">${avatarHtml}<span class="sf-auto-mob-lbl">🎯 Auto</span></button>`;
    } else {
      this.targetPillsEl.innerHTML = `<button type="button" class="sf-target-pill ${
        isOn ? 'on' : ''
      }" id="sf-auto-toggle" data-sf-target="auto" aria-pressed="${isOn ? 'true' : 'false'}">${
        isOn ? '✨ Auto: ON' : '✨ Auto: OFF'
      }</button>`;
    }
    this.autoToggleEl = this.targetPillsEl.querySelector('#sf-auto-toggle');
  }

  setAutoGather(enabled, { playSfx = false } = {}) {
    this.autoGatherEnabled = Boolean(enabled);
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    if (!this.autoGatherEnabled) {
      this.lockedHuntMobId = null;
      this.lockedHuntAnchor = null;
      this._navTarget = null;
    }
    this._renderTargetPills();
    if (this.autoGatherEnabled) {
      if (this.lockedHuntMobId) {
        const nextLocked = this._findNearestLockedMonster();
        if (nextLocked) {
          this.startAutoAttack(nextLocked);
        }
        if (playSfx) this.playGatherSfx('step_target');
      } else if (!this.targetNode && !this.targetMonster) {
        this.findAndWalkToNextNode(null, { playSfx });
      } else if (playSfx) {
        this.playGatherSfx('step_target');
      }
    } else {
      // Stop completely when Auto is toggled OFF, even if currently harvesting a tree or walking to one
      this.stopAutoSwing();
      this.stopAutoAttack();
      this.targetGate = null;
      const local = this.world?.local;
      if (local && this.world?.walkTo) {
        this.world.walkTo(local.x, local.z);
      }
      if (this.world?.input) {
        this.world.input.tapTarget = null;
      }
    }
    this._syncRuneButtonState();
    return this.autoGatherEnabled;
  }

  _syncRuneButtonState() {
    const NODE_ICONS = {
      tree: '🪵',
      boulder: '🪨',
      wheat: '🌾',
      herb: '🌿',
      crystal: '💎',
      quartz: '💎',
      mithril: '🔮',
      sakura_tree: '🌸',
      pearl_clam: '🦪',
      cloud_lotus: '🪷',
      orichalcum: '🔶',
      astral_prism: '💠',
      monster: '⚔️',
    };
    const CLASS_BADGE = {
      melee: { ico: '⚔️', lbl: 'SLASH' },
      ranged: { ico: '🏹', lbl: 'SHOT' },
      magic: { ico: '🪄', lbl: 'CAST' },
    };
    const wep = this._getActiveWeaponInfo();
    const cb = CLASS_BADGE[wep.weaponClass] || CLASS_BADGE.melee;
    const streakTxt = (this._feverStreak || 0) >= 2 ? `🔥 Fever ×${this._feverStreak} • ` : '';
    if (this.targetMonster) {
      if (this.runeIconEl) this.runeIconEl.textContent = cb.ico;
      if (this.runeLabelEl) this.runeLabelEl.textContent = this.isAttacking ? cb.lbl : 'HUNTING';
      if (this.rarityBoostEl) {
        this.rarityBoostEl.textContent = `${streakTxt}${cb.ico} ${wep.def?.name || 'Combat'} (${this._comboStep || 1}/3)`;
      }
    } else if (this.targetNode) {
      const icon = NODE_ICONS[this.targetNode.type] || '⚒️';
      if (this.runeIconEl) this.runeIconEl.textContent = icon;
      if (this.runeLabelEl) this.runeLabelEl.textContent = this.isSwinging ? 'HOLD/TAP' : 'WALKING';
    } else {
      if (this.runeIconEl) this.runeIconEl.textContent = wep.hasWeapon ? cb.ico : '⚒️';
      if (this.runeLabelEl) {
        this.runeLabelEl.textContent = wep.hasWeapon ? cb.lbl : 'GATHER';
      }
      if (this.rarityBoostEl) {
        if (this.autoGatherEnabled && this.lockedHuntMobId) {
          const lockedName =
            MONSTERS[this.lockedHuntMobId]?.name ||
            BOSSES[this.lockedHuntMobId]?.name ||
            'Monster';
          this.rarityBoostEl.textContent = `${streakTxt}🎯 Auto: ${lockedName} (Waiting…)`;
        } else {
          this.rarityBoostEl.textContent = this.autoGatherEnabled
            ? `${streakTxt}✨ Auto: Gather & Smart Cast`
            : `${streakTxt}${cb.ico} Tap Monster/Node or Auto`;
        }
      }
      this._updateRuneRing(0, false);
    }
  }

  findAndWalkToNextNode(preferredType = null, { playSfx = false } = {}) {
    if (this.autoGatherEnabled && this.lockedHuntMobId) return false;
    if (!this.active || !this.layout?.nodes?.length) return false;
    const local = this.world?.local;
    const px = local?.x ?? 0;
    const pz = local?.z ?? 0;
    const now = Date.now() + (this.world?.serverOffset || 0);
    const toolbelt = local?.profile?.frontier?.toolbelt || {};

    const available = (this.layout.nodes || []).filter((n) => {
      if (n.depletedUntil && n.depletedUntil > now) return false;
      const def = NODE_TYPES[n.type];
      if (def) {
        const myTier = Number(toolbelt[def.tool]) || 1;
        if (myTier < (Number(def.minTier) || 1)) return false;
      }
      return true;
    });

    if (available.length === 0) {
      this.toast?.('🌱 All nearby nodes are regrowing — just a moment!', 1800);
      return false;
    }

    let candidates = available;
    if (preferredType && preferredType !== 'auto') {
      const matching = available.filter(
        (n) => n.type === preferredType || (preferredType === 'crystal' && n.type === 'quartz')
      );
      if (matching.length > 0) {
        candidates = matching;
      }
    }

    let bestNode = null;
    let bestDist = Infinity;
    for (const n of candidates) {
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < bestDist) {
        bestDist = d;
        bestNode = n;
      }
    }

    if (!bestNode) return false;
    if (playSfx) {
      this.playGatherSfx('step_target');
    }
    this.interact({ kind: 'sf_node', node: bestNode });
    return true;
  }

  findAndAttackNextMonster({ playSfx = false } = {}) {
    if (!this.active) return false;
    const local = this.world?.local;
    const px = local?.x ?? 0;
    const pz = local?.z ?? 0;
    const monsters = Array.from(this.activeMonsters.values()).filter((m) => m && m.hp > 0);
    if (monsters.length === 0) {
      this.toast?.('⚔️ Area clear! More monsters will spawn soon.', 1800);
      return false;
    }
    let bestMon = null;
    let bestDist = Infinity;
    for (const m of monsters) {
      const d = Math.hypot(m.x - px, m.z - pz) - (m.isBoss ? 8 : 0);
      if (d < bestDist) {
        bestDist = d;
        bestMon = m;
      }
    }
    if (!bestMon) return false;
    if (playSfx) {
      this.playGatherSfx('step_target');
    }
    this.interact({ kind: 'sf_monster', monster: bestMon });
    return true;
  }

  followPartner() {
    if (!this.active || !this.world) return false;
    const partnerEnt =
      this.world.getPartnerEntity?.() ||
      Array.from(this.world.remotes?.values?.() || [])[0] ||
      null;
    if (!partnerEnt) return false;
    const ax = partnerEnt.smooth?.x ?? partnerEnt.x ?? 0;
    const az = partnerEnt.smooth?.z ?? partnerEnt.z ?? 0;
    this.playGatherSfx('step_target');

    // Check if ally is right next to a monster or resource node so we immediately co-op with them!
    let nearMonster = null;
    let nearMonsterDist = 5.0;
    for (const m of this.activeMonsters.values()) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - ax, m.z - az);
      if (d < nearMonsterDist) {
        nearMonsterDist = d;
        nearMonster = m;
      }
    }
    if (nearMonster) {
      this.toast?.(`💞 Teaming up with ${partnerEnt.id || 'ally'} vs monster!`, 2000);
      this.interact({ kind: 'sf_monster', monster: nearMonster });
      return true;
    }

    const now = Date.now() + (this.world?.serverOffset || 0);
    let nearNode = null;
    let nearNodeDist = 4.5;
    for (const n of this.layout?.nodes || []) {
      if (n.depletedUntil && n.depletedUntil > now) continue;
      const d = Math.hypot(n.x - ax, n.z - az);
      if (d < nearNodeDist) {
        nearNodeDist = d;
        nearNode = n;
      }
    }
    if (nearNode) {
      this.toast?.(`💞 Joining ${partnerEnt.id || 'ally'} for Co-Op Harvest (+25% Sync)!`, 2200);
      this.interact({ kind: 'sf_node', node: nearNode });
      return true;
    }

    this.toast?.(`🧭 Walking to ${partnerEnt.id || 'ally'}!`, 1800);
    this.world.walkTo?.(ax + 0.8, az + 0.8);
    return true;
  }

  onRuneTap() {
    if (!this.targetNode && !this.targetMonster) {
      this.findAndWalkToNextNode(null, { playSfx: true });
      return;
    }
    if (this.inBeatWindow && !this.nextStrikePerfect) {
      this.triggerPerfectLock();
    }
  }

  triggerPerfectLock() {
    if (this.nextStrikePerfect) return;
    this.nextStrikePerfect = true;
    this._localPerfectStreak = (this._localPerfectStreak || 0) + 1;
    this.flashPerfect();
    this.playGatherSfx('perfect', this._localPerfectStreak);
  }

  flashPerfect() {
    if (!this.runeFlashEl) return;
    this.runeFlashEl.classList.remove('sf-flash-anim');
    void this.runeFlashEl.offsetWidth;
    this.runeFlashEl.classList.add('sf-flash-anim');
  }

  playGatherSfx(type, streak = 1) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'step_target') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.09);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit_axe') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(195, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit_pickaxe') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'hit_staff') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === 'perfect') {
        const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
        const baseFreq = scale[Math.min(scale.length - 1, Math.max(0, (streak || 1) - 1))];
        [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.055);
          gain.gain.setValueAtTime(0.13, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.22);
        });
      } else if (type === 'break_common' || type === 'break_rare' || type === 'break_epic') {
        const notes =
          type === 'break_epic'
            ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
            : type === 'break_rare'
            ? [523.25, 659.25, 783.99, 1046.5]
            : [440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.065);
          gain.gain.setValueAtTime(0.14, now + idx * 0.065);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.26);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.065);
          osc.stop(now + idx * 0.065 + 0.26);
        });
      }
    } catch {
      // Ignore WebAudio restrictions
    }
  }

  // ------------------------------------------------------------------ Scene Lifecycle
  enter(layout) {
    this.layout = layout || { kind: 'sky_frontier', halfSize: 36 };
    this.halfSize = Number(this.layout.halfSize) || 36;
    this.active = true;

    // Reset interaction & state
    if (this._pendingSeek?.opts?.lockSpecies && this._pendingSeek?.targetId) {
      this.autoGatherEnabled = true;
      this.lockedHuntMobId = this._pendingSeek.targetId;
      const preTarget = resolveFrontierTarget(
        this._pendingSeek.targetId,
        this._effectiveUnlocks(),
        this._currentRegionId()
      );
      if (preTarget) {
        this.lockedHuntAnchor = {
          x: preTarget.x,
          z: preTarget.z,
          region: preTarget.region,
          label: preTarget.label,
          icon: preTarget.icon,
          isBoss: preTarget.kind === 'boss',
        };
      }
    } else {
      this.autoGatherEnabled = false;
      this.lockedHuntMobId = null;
      this.lockedHuntAnchor = null;
    }
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetGate = null;
    this._gatePending = false;
    this._gateInitDisarmPending = true;
    this._gateCooldownUntil = performance.now() + 1200;
    this._disarmedGates = new Set();
    this.floatingTexts = [];
    if (this.floatContainerEl) {
      this.floatContainerEl.innerHTML = '';
    }

    // Clear active & dying monsters into pool before disposing scene children
    for (const mon of this.activeMonsters.values()) {
      this.root.remove(mon.group);
      this._releaseMonsterMesh(mon.type, mon.group);
    }
    this.activeMonsters.clear();
    for (const dm of this.dyingMonsters) {
      this.root.remove(dm.group);
      this._releaseMonsterMesh(dm.type, dm.group);
    }
    this.dyingMonsters.length = 0;

    // Clear VFX rings, Alpha telegraphs & detach SkillVfxEngine root safely before wiping dynamic children
    for (const v of this.vfxRings) {
      this.root.remove(v.mesh);
      v.mesh.geometry.dispose();
      v.mesh.material.dispose();
    }
    this.vfxRings = [];
    for (const at of this._alphaTelegraphs || []) {
      at.group.visible = false;
      this.root.remove(at.group);
      this._alphaTelegraphPool.push(at);
    }
    this._enterGen = (this._enterGen || 0) + 1;
    const gen = this._enterGen;
    this._alphaTelegraphs = [];
    this._activeSkillZones = [];
    this.skillVfx?.clearAll?.();
    if (this.skillVfxGroup.parent) {
      this.skillVfxGroup.parent.remove(this.skillVfxGroup);
    }

    // Recursively dispose all nested geometries, materials & owned textures from previous region
    this._disposeObjectTree(this.root);
    this.nodeMeshes.clear();
    this.gateMeshes.clear();
    this._minimapStaticKey = '';
    this._bigmapStaticKey = '';

    const regionId = this._currentRegionId();
    const rMeta = REGION_META[regionId] || REGION_META.meadow;
    this._mapInspectRegion = regionId;

    // 0. Biome Sky & Fog Override (preserves world_engine.js untouched)
    if (this.world?.scene) {
      const skyTex = getBiomeSkyTexture(regionId);
      if (skyTex) this.world.scene.background = skyTex;
      if (regionId === 'caldera') {
        this.world.scene.fog = new THREE.FogExp2(0x2A1F3D, 0.0056);
      } else if (regionId === 'reef') {
        this.world.scene.fog = new THREE.FogExp2(0xF8D5E8, 0.0038);
      } else if (regionId === 'hollow') {
        this.world.scene.fog = new THREE.FogExp2(0x0E1D33, 0.0068);
      } else {
        this.world.scene.fog = new THREE.FogExp2(0xE2F0FF, 0.0036);
      }
    }

    // 1. Lights
    if (regionId === 'caldera') {
      const hemiLight = new THREE.HemisphereLight(0x6D5B98, 0x3B2318, 0.68);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xFFB35C, 0.88);
      dirLight.position.set(14, 28, 16);
      this.root.add(dirLight);
    } else if (regionId === 'reef') {
      const hemiLight = new THREE.HemisphereLight(0xFFF0F6, 0x7BAE9E, 0.92);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xFFE4EC, 0.95);
      dirLight.position.set(15, 30, 18);
      this.root.add(dirLight);
    } else if (regionId === 'hollow') {
      const hemiLight = new THREE.HemisphereLight(0x56788F, 0x1E2B33, 0.55);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xA2C2DB, 0.50);
      dirLight.position.set(12, 26, 12);
      this.root.add(dirLight);
    } else {
      const hemiLight = new THREE.HemisphereLight(0xDCF0FF, 0x6E8552, 0.95);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xFFF1D0, 1.0);
      dirLight.position.set(15, 32, 20);
      this.root.add(dirLight);
    }

    // 2. Ground plane (hand-painted Tree of Savior tileable terrain, subdivided to prevent near-plane depth/UV warp)
    const groundSize = 2 * this.halfSize;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundFallbackColor =
      regionId === 'caldera' ? 0x241B35 :
      regionId === 'reef' ? 0xA8DDD2 :
      regionId === 'hollow' ? 0x1F3A44 : 0x7FA35A;
    const groundMat = new THREE.MeshBasicMaterial({
      color: groundFallbackColor,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const groundSpriteKey = rMeta.groundKey || 'ground_classic';
    loadSprite(groundSpriteKey).then((s) => {
      if (gen !== this._enterGen || !s?.texture) return;
      const tex = s.texture.clone();
      tex.userData = { ...tex.userData, ownedByFrontier: true };
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(groundSize / 4, groundSize / 4);
      tex.needsUpdate = true;
      groundMat.map = tex;
      groundMat.color.setHex(regionId === 'meadow' ? 0xE6EFE0 : 0xFFFFFF);
      groundMat.needsUpdate = true;
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.name = 'sf_ground';
    groundMesh.receiveShadow = true;
    this.root.add(groundMesh);

    // Decorative paths, patches & scenic Tree of Savior landmarks
    const camLean = -(this.world?.pitch || 0.58);
    if (regionId === 'meadow') {
      // Winding country dirt road strips connecting Outpost -> Gate, Wheat Mill, and Forest
      const roadMat = new THREE.MeshBasicMaterial({ color: 0xB89872 });
      loadSprite('road_dirt').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        const tex = s.texture.clone();
        tex.userData = { ...tex.userData, ownedByFrontier: true };
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 6);
        tex.needsUpdate = true;
        roadMat.map = tex;
        roadMat.color.setHex(0xFFFFFF);
        roadMat.needsUpdate = true;
      });
      const roadSegments = [
        { x: 0, z: -12, w: 2.6, l: 38, rotY: 0 },
        { x: 10, z: 8, w: 2.4, l: 22, rotY: -Math.PI / 2.6 },
        { x: -9, z: 2, w: 2.2, l: 18, rotY: Math.PI / 2.3 },
      ];
      for (const seg of roadSegments) {
        const rGeo = new THREE.PlaneGeometry(seg.w, seg.l);
        rGeo.rotateX(-Math.PI / 2);
        const rMesh = new THREE.Mesh(rGeo, roadMat);
        rMesh.rotation.y = seg.rotY;
        rMesh.position.set(seg.x, 0.012, seg.z);
        this.root.add(rMesh);
      }

      const wheatPoi = this.layout.pois?.wheat || { x: 20, z: 12 };
      const wheatPatchMat = new THREE.MeshBasicMaterial({ color: 0xD9B866 });
      loadSprite('road_farmland').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        wheatPatchMat.map = s.texture;
        wheatPatchMat.color.setHex(0xE8D096);
        wheatPatchMat.needsUpdate = true;
      });
      const patchOffsets = [
        { dx: 0, dz: 0, r: 3.2 },
        { dx: -2.8, dz: 1.4, r: 2.4 },
        { dx: 2.4, dz: -1.8, r: 2.6 },
        { dx: 1.6, dz: 2.6, r: 2.1 },
      ];
      for (const p of patchOffsets) {
        const patchGeo = new THREE.CircleGeometry(p.r, 20);
        patchGeo.rotateX(-Math.PI / 2);
        const patch = new THREE.Mesh(patchGeo, wheatPatchMat);
        patch.position.set(wheatPoi.x + p.dx, 0.016, wheatPoi.z + p.dz);
        this.root.add(patch);
      }

      // Scenic Whispering Meadow 2.5D landmarks & wildflower props
      this._addScenicSprite('sf_mill_ruins', wheatPoi.x + 2.8, wheatPoi.z - 2.4, 4.6, camLean);
      this._addScenicSprite('sf_prop_scarecrow', wheatPoi.x - 2.6, wheatPoi.z + 1.8, 2.2, camLean);
      this._addScenicSprite('crop_berries_ready', -5.5, 5.2, 1.6, camLean);
      this._addScenicSprite('crop_berries_ready', 5.8, 2.8, 1.5, camLean);
      this._addScenicSprite('env_bush_daisies_white', -3.4, 1.8, 1.3, camLean);
      this._addScenicSprite('env_bush_roses_pink', 3.6, 5.4, 1.3, camLean);
    } else if (regionId === 'hollow') {
      const umberMat = new THREE.MeshBasicMaterial({ color: 0x4A3B33 });
      loadSprite('road_flagstone').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        umberMat.map = s.texture;
        umberMat.color.setHex(0x6E808C);
        umberMat.needsUpdate = true;
      });
      const umberCenters = [
        { x: -16, z: 6, r: 2.8 },
        { x: -10, z: -12, r: 2.5 },
        { x: 12, z: 4, r: 3.0 },
        { x: 15, z: -18, r: 2.4 },
        { x: 0, z: -18, r: 3.6 },
      ];
      for (const c of umberCenters) {
        const patchGeo = new THREE.CircleGeometry(c.r, 20);
        patchGeo.rotateX(-Math.PI / 2);
        const patch = new THREE.Mesh(patchGeo, umberMat);
        patch.position.set(c.x, 0.015, c.z);
        this.root.add(patch);
      }

      // Scenic Crystal Hollow 2.5D cavern arches, minecarts & rope bridge
      this._addScenicSprite('sf_prop_timber_arch', 0, -3.5, 4.4, camLean);
      this._addScenicSprite('sf_prop_timber_arch', 0, -13.5, 4.6, camLean);
      this._addScenicSprite('sf_prop_minecart', -5.2, 2.2, 2.5, camLean);
      this._addScenicSprite('sf_prop_minecart', 6.4, -6.5, 2.5, camLean);
      this._addScenicSprite('sf_prop_rope_bridge', 5.8, 4.2, 3.2, camLean);
    } else if (regionId === 'reef') {
      // Shallow luminous coral tide-pool patches around Pearl Shoals & Tide-Bell Lagoon
      const waterMat = new THREE.MeshBasicMaterial({
        color: 0x7FE3D6,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      loadSprite('terrain_reef_water').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        const tex = s.texture.clone();
        tex.userData = { ...tex.userData, ownedByFrontier: true };
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.needsUpdate = true;
        waterMat.map = tex;
        waterMat.color.setHex(0xFFFFFF);
        waterMat.needsUpdate = true;
      });
      const shoals = this.layout.pois?.pearl_shoals || { x: 22, z: 10 };
      const lagoon = this.layout.pois?.bell_lagoon || this.layout.pois?.bell_shrine || { x: 20, z: -14 };
      const tidePools = [
        { x: shoals.x, z: shoals.z, r: 4.8 },
        { x: shoals.x - 3.6, z: shoals.z + 2.4, r: 3.1 },
        { x: lagoon.x, z: lagoon.z, r: 4.6 },
        { x: lagoon.x - 3.4, z: lagoon.z - 2.2, r: 2.9 },
        { x: 5.5, z: -6.5, r: 2.8 },
      ];
      for (const tp of tidePools) {
        const pGeo = new THREE.CircleGeometry(tp.r, 24);
        pGeo.rotateX(-Math.PI / 2);
        const pMesh = new THREE.Mesh(pGeo, waterMat);
        pMesh.position.set(tp.x, 0.015, tp.z);
        this.root.add(pMesh);
      }

      // Scenic Sakura Torii shrine approaches & blossom accents
      this._addScenicSprite('sf_prop_sakura_torii', 0, -4.2, 4.5, camLean);
      this._addScenicSprite('sf_prop_sakura_torii', 0, -17.5, 4.8, camLean);
      this._addScenicSprite('sf_prop_sakura_torii', -15.5, 8.5, 4.1, camLean);
      this._addScenicSprite('env_bush_roses_pink', -4.2, 2.6, 1.5, camLean);
      this._addScenicSprite('env_bush_roses_pink', 4.4, 2.6, 1.5, camLean);
    } else if (regionId === 'caldera') {
      // Glowing star-forge ember & brass inlays around Cinder Vents, Gear Foundry & Apex Altar
      const emberMat = new THREE.MeshBasicMaterial({
        color: 0xF59E0B,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      loadSprite('terrain_caldera_ember').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        const tex = s.texture.clone();
        tex.userData = { ...tex.userData, ownedByFrontier: true };
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.needsUpdate = true;
        emberMat.map = tex;
        emberMat.color.setHex(0xFFFFFF);
        emberMat.needsUpdate = true;
      });
      const vents = this.layout.pois?.cinder_vents || { x: -22, z: 10 };
      const foundry = this.layout.pois?.gear_foundry || this.layout.pois?.arc_foundry || { x: 22, z: 10 };
      const bossPoi = this.layout.pois?.boss || { x: 0, z: -26 };
      const emberInlays = [
        { x: vents.x, z: vents.z, r: 4.6 },
        { x: vents.x + 3.2, z: vents.z - 2.4, r: 2.8 },
        { x: foundry.x, z: foundry.z, r: 4.2 },
        { x: bossPoi.x, z: bossPoi.z, r: 5.2 },
        { x: 0, z: -12, r: 3.1 },
      ];
      for (const em of emberInlays) {
        const pGeo = new THREE.CircleGeometry(em.r, 24);
        pGeo.rotateX(-Math.PI / 2);
        const pMesh = new THREE.Mesh(pGeo, emberMat);
        pMesh.position.set(em.x, 0.016, em.z);
        this.root.add(pMesh);
      }

      // Scenic Clockwork Astrolabe Obelisk pillars framing the Star-Caldera avenues
      this._addScenicSprite('sf_prop_astrolabe_pillar', -4.6, -3.5, 3.3, camLean);
      this._addScenicSprite('sf_prop_astrolabe_pillar', 4.6, -3.5, 3.3, camLean);
      this._addScenicSprite('sf_prop_astrolabe_pillar', -4.8, -18.5, 3.6, camLean);
      this._addScenicSprite('sf_prop_astrolabe_pillar', 4.8, -18.5, 3.6, camLean);
      this._addScenicSprite('sf_prop_astrolabe_pillar', 15.5, -11.5, 3.2, camLean);
    }

    // 3. Framing border
    this._buildFramingBorder(regionId);

    // 4. Outpost stone platform + 2.5D ToS Goddess / Biome Sanctuary statue + HP ring
    const outpostPoi = this.layout.pois?.outpost || { x: 0, z: 4 };
    const platGeo = new THREE.CircleGeometry(2.35, 28);
    platGeo.rotateX(-Math.PI / 2);
    const platMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.outpostPlatform = new THREE.Mesh(platGeo, platMat);
    this.outpostPlatform.position.set(outpostPoi.x, 0.02, outpostPoi.z);
    this.root.add(this.outpostPlatform);

    const outpostSpriteKey = rMeta.outpostKey || 'sf_outpost_goddess';
    const statueInfo = spriteInfo(outpostSpriteKey);
    const statueAspect = statueInfo ? statueInfo.h / statueInfo.w : 0.92;
    const statueW = 4.2;
    const statueGeo = new THREE.PlaneGeometry(statueW, statueW * statueAspect);
    statueGeo.translate(0, (statueW * statueAspect) * 0.5, 0);
    const statueMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    loadSprite(outpostSpriteKey).then((s) => {
      if (gen !== this._enterGen || !s?.texture) return;
      statueMat.map = s.texture;
      statueMat.needsUpdate = true;
    });
    this.outpostStatue = new THREE.Mesh(statueGeo, statueMat);
    this.outpostStatue.rotation.x = camLean;
    this.outpostStatue.position.set(outpostPoi.x, 0.05, outpostPoi.z);
    this.root.add(this.outpostStatue);

    const ringGeo = new THREE.RingGeometry(2.15, 2.45, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide });
    this.outpostRing = new THREE.Mesh(ringGeo, ringMat);
    this.outpostRing.position.set(outpostPoi.x, 0.035, outpostPoi.z);
    this.root.add(this.outpostRing);

    // 4b. Outpost Sanctuary Healing Aura Ring (5.5m radius)
    const sanctGroup = new THREE.Group();
    const sanctOuterGeo = new THREE.RingGeometry(5.32, 5.52, 48);
    sanctOuterGeo.rotateX(-Math.PI / 2);
    const sanctOuterCol =
      regionId === 'caldera' ? 0xFBBF24 :
      regionId === 'reef' ? 0xF9A8D4 :
      regionId === 'hollow' ? 0x67E8F9 : 0x6EE7B7;
    const sanctDiscCol =
      regionId === 'caldera' ? 0xF59E0B :
      regionId === 'reef' ? 0xF472B6 :
      regionId === 'hollow' ? 0x22D3EE : 0x34D399;
    const sanctOuterMat = new THREE.MeshBasicMaterial({
      color: sanctOuterCol,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sanctDiscGeo = new THREE.CircleGeometry(5.42, 48);
    sanctDiscGeo.rotateX(-Math.PI / 2);
    const sanctDiscMat = new THREE.MeshBasicMaterial({
      color: sanctDiscCol,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    sanctGroup.add(new THREE.Mesh(sanctDiscGeo, sanctDiscMat));
    sanctGroup.add(new THREE.Mesh(sanctOuterGeo, sanctOuterMat));
    sanctGroup.position.set(outpostPoi.x, 0.024, outpostPoi.z);
    sanctGroup.userData = { outerMat: sanctOuterMat, discMat: sanctDiscMat };
    this.sanctuaryRing = sanctGroup;
    this.root.add(sanctGroup);

    // 5. Gate markers (2.5D hand-painted Sky Mist Gate archway + glowing ground ring + portal signpost)
    for (const gate of this.layout.gates || []) {
      const radius = gate.radius || 2.8;
      const unlocked = this._isGateUnlocked(gate);
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.at.x, 0, gate.at.z);
      gateGroup.userData.gate = gate;
      gateGroup.userData.unlocked = unlocked;

      const gDiscGeo = new THREE.CircleGeometry(radius * 0.72, 32);
      gDiscGeo.rotateX(-Math.PI / 2);
      const gDiscMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0x38BDF8 : 0x64748B,
        transparent: true,
        opacity: unlocked ? 0.22 : 0.10,
        depthWrite: false,
      });
      const gDisc = new THREE.Mesh(gDiscGeo, gDiscMat);
      gDisc.position.y = 0.022;
      gateGroup.add(gDisc);

      const gRingGeo = new THREE.RingGeometry(radius * 0.72, radius * 0.96, 36);
      gRingGeo.rotateX(-Math.PI / 2);
      const gRingMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0x7CE8FF : 0x8899AA,
        transparent: true,
        opacity: unlocked ? 0.72 : 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gRing = new THREE.Mesh(gRingGeo, gRingMat);
      gRing.position.y = 0.032;
      gateGroup.add(gRing);

      const gateInfo = spriteInfo('sf_sky_mist_gate');
      const gateAspect = gateInfo ? gateInfo.h / gateInfo.w : 1.35;
      const gateW = 3.8;
      const gatePlaneGeo = new THREE.PlaneGeometry(gateW, gateW * gateAspect);
      gatePlaneGeo.translate(0, (gateW * gateAspect) * 0.5, 0);
      const gatePlaneMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0xFFFFFF : 0x9FB0C2,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
      });
      loadSprite('sf_sky_mist_gate').then((s) => {
        if (gen !== this._enterGen || !s?.texture) return;
        gatePlaneMat.map = s.texture;
        gatePlaneMat.needsUpdate = true;
      });
      const gatePlane = new THREE.Mesh(gatePlaneGeo, gatePlaneMat);
      gatePlane.rotation.x = camLean;
      gateGroup.add(gatePlane);

      const labelSprite = this._makeGateLabelSprite(gate, unlocked);
      if (labelSprite) {
        labelSprite.position.set(0, gateW * gateAspect * 0.88 + 0.45, 0.2);
        gateGroup.add(labelSprite);
      }

      gateGroup.userData.gRingMat = gRingMat;
      gateGroup.userData.gDiscMat = gDiscMat;
      gateGroup.userData.gatePlaneMat = gatePlaneMat;
      gateGroup.userData.labelSprite = labelSprite;

      this.root.add(gateGroup);
      this.gateMeshes.set(gate.to || gate, gateGroup);
    }

    // 6. Nodes
    for (const node of this.layout.nodes || []) {
      const mesh = this._createNodeMesh(node);
      this.root.add(mesh);
      this.nodeMeshes.set(String(node.id), mesh);
    }

    // 6b. 3D Target Reticle, Ambient Particles, Atmospheric Light Shafts, Breadcrumbs, Boss Telegraph & Skill VFX
    this._slashArcs = [];
    this._lastBossStage = 0;
    this._bossTelegraphTimer = 0;
    this.root.add(this.skillVfxGroup);
    this.skillVfx.camPitch = this.world?.pitch || 0.58;
    const eqPriority = (this._getProfile()?.frontier?.skills?.equipped || []).filter(Boolean);
    const regPriority = MONSTER_SKILL_IDS.filter((id) => MONSTER_SKILLS[id]?.region === regionId);
    const priorityVfxIds = [...new Set([...eqPriority, ...regPriority, 'ult_charm_sanctuary'])];
    this.skillVfx.attachRenderer?.(this.world?.renderer, priorityVfxIds);
    this.skillVfx.warmPriority?.(priorityVfxIds);
    this._buildSkillAimIndicator();
    this._buildTargetReticle();
    this._buildAmbientParticles(regionId);
    this._buildLightShafts(regionId);
    this._buildBreadcrumbs();
    this._buildBossTelegraph();

    // 7. Initialize combat snapshots from layout
    if (Array.isArray(this.layout.monsters)) {
      this.onMonsters({ m: this.layout.monsters });
    }
    if (this.layout.outpost) {
      this.onOutpost(this.layout.outpost);
    }
    if (this.layout.invasion) {
      this.onInvasion(this.layout.invasion);
    }
    if (this.layout.boss) {
      this.onBoss(this.layout.boss);
    }
    if (this.layout.bossCooldownUntil) {
      this.bossCooldownUntil = this.layout.bossCooldownUntil;
    }
    // Initialize player HP from server snapshot first (falling back to profile Max HP only if uninitialized)
    const prof = this._getProfile();
    const localId = this.world?.local?.id || prof?.id;
    const lv = Number(prof?.level) || 1;
    const uni = prof ? computeUniversalStats(prof) : { total: {} };
    const maxHp = playerMaxHp(lv, uni.total);
    const localSnap = localId ? this.layout?.playerHp?.[localId] : null;
    if (this.layout.playerHp && typeof this.layout.playerHp === 'object') {
      for (const [uid, hpSnap] of Object.entries(this.layout.playerHp)) {
        if (!hpSnap) continue;
        if (uid === localId) {
          if (hpSnap.buffs) this._applyServerBuffs(hpSnap.buffs);
          if (Number.isFinite(Number(hpSnap.regenPerSec)) && Number(hpSnap.regenPerSec) > 0) {
            this._vitalityRegenPerSec = Number(hpSnap.regenPerSec);
          }
        } else {
          this._remoteHp.set(uid, {
            hp: Number(hpSnap.hp ?? 100),
            maxHp: Math.max(1, Number(hpSnap.maxHp ?? 100)),
            shield: Math.max(0, Number(hpSnap.shieldHp ?? hpSnap.shield ?? 0)),
          });
        }
      }
    }
    if (localSnap && Number.isFinite(Number(localSnap.hp))) {
      const snapMax = Math.max(1, Number(localSnap.maxHp) || maxHp);
      this._hasServerPlayerHp = true;
      this.playerHp = {
        hp: Math.max(0, Math.min(snapMax, Number(localSnap.hp))),
        maxHp: snapMax,
        shield: Math.max(0, Number(localSnap.shieldHp ?? localSnap.shield ?? 0)),
      };
    } else if (!this._hasServerPlayerHp || !this.playerHp || !Number.isFinite(this.playerHp.hp)) {
      this.playerHp = { hp: maxHp, maxHp, shield: 0 };
    } else {
      this.playerHp.maxHp = maxHp;
      this.playerHp.hp = Math.min(maxHp, this.playerHp.hp);
    }
    this.updatePlayerHpBar();

    // 8. Make root visible and show HUD
    this.root.visible = true;
    if (this.hudEl) {
      this.hudEl.style.display = 'block';
    }
    this._renderTargetPills();
    if (this.runeWrapperEl) {
      this.runeWrapperEl.style.display = 'flex';
    }
    this._syncRuneButtonState();
    this.updateBagPill();
    this.updateBountyHud();
    this.updateHud();
    this.updateUltimateCharm();
    this.updateSkillButtons();
    this._navTarget = null;
    this.closeMapModal();
    this.closeBountyModal();
    this.closeSkillModal();
    this._drawMiniMap();

    if (this._pendingSeek) {
      const pending = this._pendingSeek;
      this._pendingSeek = null;
      setTimeout(() => {
        if (this.active && pending?.targetId) {
          this.seekObjective(pending.targetId, pending.opts || {});
        }
      }, 240);
    }
  }

  exit() {
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.autoGatherEnabled = false;
    if (!this._pendingSeek?.opts?.lockSpecies) {
      this.lockedHuntMobId = null;
      this.lockedHuntAnchor = null;
    }
    this.runeHeld = false;
    this.active = false;
    this.root.visible = false;
    this.stopAutoSwing();
    this.stopAutoAttack();
    this._renderTargetPills();
    this.targetGate = null;
    this.targetNode = null;
    this.targetMonster = null;
    this._navTarget = null;
    this.closeMapModal();
    this.closeBountyModal();
    this.closeSkillModal();
    this._enterGen = (this._enterGen || 0) + 1;
    this._cancelSkillAim();
    this.skillVfx?.clearAll?.();
    if (this._scrollBannerTimer) {
      clearTimeout(this._scrollBannerTimer);
      this._scrollBannerTimer = null;
    }
    if (this.scrollBannerEl) this.scrollBannerEl.hidden = true;
    this.activeBoss = null;
    this.invasionState = null;
    this._localBuffs = { hasteUntil: 0, hastePct: 0, dmgReduceUntil: 0, critUpUntil: 0 };
    this._hudCache = {};

    if (this.invasionBannerEl) this.invasionBannerEl.style.display = 'none';
    if (this.bossBarEl) this.bossBarEl.style.display = 'none';
    if (this.healBtnEl) this.healBtnEl.style.display = 'none';
    if (this.repairBtnEl) this.repairBtnEl.style.display = 'none';
    if (this.bossBtnEl) this.bossBtnEl.style.display = 'none';
    if (this.mobOverheadEl) this.mobOverheadEl.hidden = true;
    if (this.castCalloutEl) this.castCalloutEl.hidden = true;
    this._castCalloutUntil = 0;
    this._lastOverheadKey = '';

    // Restore 3D Village nameTags when exiting Sky Frontier
    if (this.world?.local?.rig?.nameTag && this.world.local.rig._sfHidNameTag) {
      this.world.local.rig.nameTag.visible = true;
      this.world.local.rig._sfHidNameTag = false;
    }
    for (const rem of this.world?.remotes?.values?.() || []) {
      if (rem?.rig?.nameTag && rem.rig._sfHidNameTag) {
        rem.rig.nameTag.visible = true;
        rem.rig._sfHidNameTag = false;
      }
    }
    for (const rp of this._remotePlates.values()) {
      rp.el?.remove?.();
    }
    this._remotePlates.clear();
    this._remoteHp.clear();

    // Remove active monsters & release all region GPU meshes cleanly on exit
    for (const mon of this.activeMonsters.values()) {
      this.root.remove(mon.group);
      this._releaseMonsterMesh(mon.type, mon.group);
    }
    this.activeMonsters.clear();
    for (const dm of this.dyingMonsters) {
      this.root.remove(dm.group);
      this._releaseMonsterMesh(dm.type, dm.group);
    }
    this.dyingMonsters.length = 0;
    for (const pool of this.monsterPool.values()) {
      for (const grp of pool) {
        this._disposeObjectTree(grp);
      }
    }
    this.monsterPool.clear();
    for (const at of this._alphaTelegraphs || []) {
      this._disposeObjectTree(at.group);
    }
    this._alphaTelegraphs = [];
    for (const at of this._alphaTelegraphPool || []) {
      this._disposeObjectTree(at.group);
    }
    this._alphaTelegraphPool = [];
    this._activeSkillZones = [];
    this._disposeObjectTree(this.root);
    this.nodeMeshes.clear();
    this.gateMeshes.clear();
    for (const lm of this.lootMagnets) {
      if (lm.el?.parentNode) lm.el.parentNode.removeChild(lm.el);
    }
    this.lootMagnets.length = 0;

    if (this.hudEl) {
      this.hudEl.style.display = 'none';
    }
  }

  // ------------------------------------------------------------------ Pure Bounds
  walkable(x, z) {
    const limit = (this.halfSize || 36) - 0.6;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
  }

  clampWalkable(x, z) {
    const limit = (this.halfSize || 36) - 0.6;
    return {
      x: Math.max(-limit, Math.min(limit, x)),
      z: Math.max(-limit, Math.min(limit, z)),
    };
  }

  // ------------------------------------------------------------------ Picking
  pick(clientX, clientY) {
    if (!this.active || !this.world || !this.layout) return null;

    // 1. Monster picking has priority over nodes
    let bestMonster = null;
    let bestMonsterDist = 45;
    for (const mon of this.activeMonsters.values()) {
      const s = this.world.worldToScreen(mon.x, mon.isBoss ? 1.5 : 0.6, mon.z);
      if (!s) continue;
      const d = Math.hypot(clientX - s.x, clientY - s.y);
      if (d < bestMonsterDist) {
        bestMonsterDist = d;
        bestMonster = mon;
      }
    }
    if (bestMonster) {
      return { kind: 'sf_monster', monster: bestMonster };
    }

    // 2. Check gates BEFORE resource nodes so nearby boulders/trees never block portal taps
    let bestGate = null;
    let bestGateDist = 56;
    for (const gate of this.layout.gates || []) {
      const sArch = this.world.worldToScreen(gate.at.x, 1.35, gate.at.z);
      const sRing = this.world.worldToScreen(gate.at.x, 0.12, gate.at.z);
      const dArch = sArch ? Math.hypot(clientX - sArch.x, clientY - sArch.y) : Infinity;
      const dRing = sRing ? Math.hypot(clientX - sRing.x, clientY - sRing.y) : Infinity;
      const d = Math.min(dArch, dRing);
      if (d < bestGateDist) {
        bestGateDist = d;
        bestGate = gate;
      }
    }
    if (bestGate) {
      return { kind: 'sf_gate', gate: bestGate };
    }

    // 3. Check nodes within ~40 px
    let bestNode = null;
    let bestDist = 40;
    for (const node of this.layout.nodes || []) {
      const s = this.world.worldToScreen(node.x, 0.7, node.z);
      if (!s) continue;
      const d = Math.hypot(clientX - s.x, clientY - s.y);
      if (d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }
    if (bestNode) {
      return { kind: 'sf_node', node: bestNode };
    }

    return null;
  }

  _isGateUnlocked(gate) {
    if (!gate?.requires) return true;
    const prof = window.__neora?.state?.profile || this.world?.local?.profile || null;
    if (!prof) return false;
    const req = gate.requires;
    if (prof.frontier?.unlocks?.regions?.includes(req)) return true;
    if (prof.frontier?.unlocks?.gates?.includes(req)) return true;
    const ch = Number(prof.story?.chapter) || 0;
    const done = prof.story?.completed || [];
    const prog = prof.story?.progress || {};
    if (req === 'hollow') {
      if (ch >= 2 || done.includes?.(1) || (prog.c2_visit_gate_hollow || 0) >= 1) return true;
    }
    if (req === 'reef') {
      if (ch >= 6 || done.includes?.(5) || (ch >= 5 && (prog.c5_visit_gate_reef || 0) >= 1)) return true;
    }
    if (req === 'caldera') {
      if (ch >= 7 || done.includes?.(6)) return true;
    }
    return false;
  }

  _makeGateLabelSprite(gate, unlocked) {
    if (typeof document === 'undefined') return null;
    const destMeta = REGION_META[gate?.to] || null;
    const destName = destMeta?.name || (gate?.to || 'Portal');
    const icon = gate?.to === 'meadow' ? '🌾' : (destMeta?.icon || '🌀');
    const unlockCh = destMeta?.unlockChapter || 2;
    const text = unlocked
      ? `${icon} Warp: ${destName} ▸`
      : `🔒 ${destMeta?.short || destName} (Ch.${unlockCh} Unlock)`;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Storybook pill plaque
    const padX = 24;
    const padY = 16;
    const w = canvas.width - padX * 2;
    const h = canvas.height - padY * 2;
    const r = 38;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, padY, w, h, r);
    const grad = ctx.createLinearGradient(0, padY, 0, padY + h);
    if (unlocked) {
      grad.addColorStop(0, 'rgba(18, 42, 66, 0.92)');
      grad.addColorStop(1, 'rgba(11, 25, 42, 0.95)');
    } else {
      grad.addColorStop(0, 'rgba(38, 34, 32, 0.88)');
      grad.addColorStop(1, 'rgba(24, 20, 18, 0.92)');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = unlocked ? '#67E8F9' : '#94A3B8';
    ctx.stroke();

    ctx.font = '900 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = unlocked ? '#ECFEFF' : '#CBD5E1';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { ...tex.userData, ownedByFrontier: true };
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(3.9, 0.85, 1);
    spr.renderOrder = 12;
    return spr;
  }

  // ------------------------------------------------------------------ Interaction
  interact(picked) {
    if (!picked || !this.active) return;
    this._navTarget = null;

    if (picked.kind === 'sf_monster' && picked.monster) {
      this.stopAutoSwing();
      this.targetGate = null;
      this.targetNode = null;
      this.startAutoAttack(picked.monster);
      return;
    }

    if (picked.kind === 'sf_node' && picked.node) {
      const node = picked.node;
      if (this._autoChainTimer) {
        clearTimeout(this._autoChainTimer);
        this._autoChainTimer = null;
      }
      this.stopAutoAttack();
      this.targetGate = null;

      const now = Date.now() + (this.world?.serverOffset || 0);
      if (node.depletedUntil && node.depletedUntil > now) {
        if (this.autoGatherEnabled) {
          this.toast?.('🌱 This resource is depleted. Finding another nearby!', 1800);
          this.findAndWalkToNextNode(null, { playSfx: true });
        } else {
          this.toast?.('🌱 This resource is regrowing — try another nearby!', 1800);
        }
        return;
      }

      this.targetNode = node;
      this._lastGatheredNodeType = node.type;
      this.world?.walkTo?.(node.x, node.z + 1.2);

      if (this.runeWrapperEl) {
        this.runeWrapperEl.style.display = 'flex';
      }
      this._syncRuneButtonState();

      const local = this.world?.local;
      if (local) {
        const dist = Math.hypot(local.x - node.x, local.z - node.z);
        if (dist <= 3.0 && !this.isSwinging) {
          this.startAutoSwing();
        }
      }
      return;
    }

    if (picked.kind === 'sf_gate' && picked.gate) {
      const gate = picked.gate;
      if (this._autoChainTimer) {
        clearTimeout(this._autoChainTimer);
        this._autoChainTimer = null;
      }
      this.stopAutoSwing();
      this.stopAutoAttack();
      this.targetNode = null;
      this.targetGate = gate;
      this._disarmedGates?.delete?.(gate.to);

      this.world?.walkTo?.(gate.at.x, gate.at.z);

      const local = this.world?.local;
      if (local) {
        const dist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
        const rad = (gate.radius || 2.8) + 0.9;
        if (dist <= rad) {
          this._triggerGate(gate);
        }
      }
    }
  }

  async _triggerGate(gate) {
    if (!gate || this._gatePending) return;
    this.targetGate = null;
    this._gatePending = true;
    this._gateCooldownUntil = performance.now() + 2200;

    // Immediately flush latest local coordinates so server presence is never stale (`too_far`)
    const local = this.world?.local;
    if (local && this.world?.onLocalMove) {
      const f = local.rig?.facing || { right: true, back: true };
      this.world.onLocalMove(
        {
          x: +local.x.toFixed(3),
          z: +local.z.toFixed(3),
          vx: 0,
          vz: 0,
          right: Boolean(f.right ?? true),
          back: Boolean(f.back ?? true),
          zoneSeq: this.world.zoneSeq,
        },
        true
      );
    }

    try {
      const destMeta = REGION_META[gate.to];
      const destLabel = destMeta
        ? `${gate.to === 'meadow' ? '🌾' : destMeta.icon} ${destMeta.name}`
        : gate.to;
      const reqCh = destMeta?.unlockChapter || 2;
      const res = await this.request('sf_region', { to: gate.to });
      if (res && res.ok) {
        this.playGatherSfx('auto_on');
        this.toast?.(`🌀 Warping to ${destLabel}…`, 2000);
      } else if (res && !res.ok) {
        this._disarmedGates?.add?.(gate.to);
        if (res.error === 'gate_locked') {
          this.toast?.(`🌀 The Sky Mist won't part yet — complete Chapter ${reqCh} (or enter with your partner)!`, 3500);
        } else if (res.error === 'too_far') {
          this.world?.walkTo?.(gate.at.x, gate.at.z);
        } else {
          this.toast?.(res.error || 'The gate is locked.', 3000);
        }
      }
    } catch {
      // ignore
    } finally {
      this._gatePending = false;
    }
  }

  // ------------------------------------------------------------------ Auto-Swing Loop (Mining)
  startAutoSwing() {
    this.isSwinging = true;
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this._localPerfectStreak = 0;
    if (this.runeWrapperEl) {
      this.runeWrapperEl.style.display = 'flex';
    }
    if (this.rarityBoostEl) {
      const streakTxt = (this._feverStreak || 0) >= 2 ? `🔥 Fever ×${this._feverStreak} • ` : '';
      this.rarityBoostEl.textContent = `${streakTxt}🎲 Rare+ Chance: 38%`;
    }
    const local = this.world?.local;
    const rig = local?.rig;
    if (this.targetNode && local && rig) {
      const tool = NODE_TYPES[this.targetNode.type]?.tool || 'pickaxe';
      const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
      const tier = local.profile?.frontier?.toolbelt?.[tool] || 1;
      rig.facing?.set?.(this.targetNode.x >= local.x, this.targetNode.z < local.z - 0.35);
      if (rig.setHeldTool && this._heldTool !== `${tool}:${tier}`) {
        rig.setHeldTool(tool, tier);
        this._heldTool = `${tool}:${tier}`;
      }
      rig.triggerAttack?.(swing, { dur: 0.75 });
    }
    this._syncRuneButtonState();
  }

  stopAutoSwing() {
    this.isSwinging = false;
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this._localPerfectStreak = 0;
    this.targetNode = null;
    if (this.runeBtnEl) {
      this.runeBtnEl.classList.remove('sf-beat-active');
    }
    this._syncRuneButtonState();
  }

  async executeStrike() {
    if (!this.targetNode || !this.isSwinging) return;
    const nodeId = this.targetNode.id;
    const perfect = this.nextStrikePerfect;
    this.nextStrikePerfect = false;

    const tool = NODE_TYPES[this.targetNode.type]?.tool || 'pickaxe';
    const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
    const local = this.world?.local;
    const rig = local?.rig;
    const tier = local?.profile?.frontier?.toolbelt?.[tool] || 1;
    if (this.targetNode && local && rig) {
      rig.facing?.set?.(this.targetNode.x >= local.x, this.targetNode.z < local.z - 0.35);
    }
    if (rig?.setHeldTool && this._heldTool !== `${tool}:${tier}`) {
      rig.setHeldTool(tool, tier);
      this._heldTool = `${tool}:${tier}`;
    }
    rig?.triggerAttack?.(swing, { dur: 0.75 });
    if (local && this.targetNode) {
      this._spawnSlashArc(local.x, local.z, this.targetNode.x, this.targetNode.z, tool, perfect);
    }

    try {
      const res = await this.request('sf_strike', { nodeId, perfect });
      if (!res) return;

      if (!res.ok) {
        if (res.error === 'no_energy') {
          this.toast?.('⚡ Out of Energy! Tap ⚡ or eat from your Food Pouch to refill.', 3000);
          this.setAutoGather(false);
        } else if (res.error === 'tool_tier') {
          this.toast?.('🔨 Tier-2 Tool needed — upgrade at your Basecamp Workshop!', 3000);
          this.stopAutoSwing();
        } else if (res.error === 'out_of_range' || res.error === 'depleted') {
          this.stopAutoSwing();
        }
        return;
      }

      if (res.energy) {
        this.setEnergy(res.energy);
      }

      if (res.broke) {
        this.stopAutoSwing();
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Combat Auto-Attack Loop & Class 1-2-3 Combos
  _getActiveWeaponInfo(profile = null) {
    const p = profile || this._getProfile();
    const visGloveId = visibleSlotId(p?.equipped, 'gloves', p?.glamour);
    const mainTool = p?.frontier?.toolbelt?.main || 'pickaxe';
    const cacheKey = `${visGloveId || ''}:${mainTool}`;
    if (!profile && this._cachedWeaponInfo && this._cachedWeaponInfo._key === cacheKey) {
      return this._cachedWeaponInfo;
    }
    const weaponClass = activeWeaponClass(p?.equipped, p?.glamour);
    const cls = WEAPON_CLASSES[weaponClass] || WEAPON_CLASSES.melee;
    const def = visGloveId ? ACCESSORIES[visGloveId] : null;
    const info = {
      _key: cacheKey,
      visGloveId,
      hasWeapon: Boolean(visGloveId),
      weaponClass,
      icon: cls.icon,
      label: cls.label,
      cooldownMs: cls.cooldownMs,
      range: visGloveId ? cls.range : (mainTool === 'staff' ? 6.0 : 1.5),
      def,
    };
    if (!profile) this._cachedWeaponInfo = info;
    return info;
  }

  startAutoAttack(monster) {
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    const liveMon = (monster && this.activeMonsters.get(monster.id)) || monster;
    if (!liveMon) return;
    this.targetMonster = liveMon;
    this.isAttacking = true;
    const now = Date.now() + (this.world?.serverOffset || 0);
    if (now >= (this._nextAttackServerAt || 0)) {
      this.attackTimer = this.attackCooldownMs || 620;
    } else {
      this.attackTimer = Math.max(0, (this.attackCooldownMs || 620) - (this._nextAttackServerAt - now));
    }
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    // Stow gathering tool immediately when entering combat so the equipped/glamour weapon shines!
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    this._syncRuneButtonState();

    const local = this.world?.local;
    const wep = this._getActiveWeaponInfo();
    const range = wep.range;

    // Walk into weapon-class attack range (2.2m Melee, 7.8m Ranged, 6.5m Magic) and halt cleanly at max range
    if (local) {
      const dx = liveMon.x - local.x;
      const dz = liveMon.z - local.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > range * 0.95) {
        const stopDist = Math.max(1.25, range - 0.45);
        const targetWalkX = liveMon.x - (dx / d) * stopDist;
        const targetWalkZ = liveMon.z - (dz / d) * stopDist;
        this.world?.walkTo?.(targetWalkX, targetWalkZ);
        this._combatTapTarget = this.world?.input?.tapTarget || null;
      } else if (this.world?.input?.tapTarget && this.world.input.tapTarget === this._combatTapTarget) {
        this.world?.clearMoveState?.();
        this._combatTapTarget = null;
      }
    }
  }

  stopAutoAttack() {
    this.isAttacking = false;
    this.targetMonster = null;
    this._combatTapTarget = null;
    this.attackTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    if (this.runeBtnEl) {
      this.runeBtnEl.classList.remove('sf-beat-active');
    }
    this._syncRuneButtonState();
  }

  _syncMonsterHpImmediate(mon) {
    if (!mon) return;
    const isTargetedMob = !mon.isBoss && Boolean(this.targetMonster && mon.id === this.targetMonster.id);
    if (mon.hpBar && mon.hpFill) {
      if (!isTargetedMob && mon.hp < mon.maxHp && mon.hp > 0) {
        mon.hpBar.visible = true;
        const pct = Math.max(0, Math.min(1, mon.hp / Math.max(1, mon.maxHp)));
        mon.hpFill.scale.x = pct;
        mon.hpFill.position.x = -0.38 * (1 - pct);
      } else {
        mon.hpBar.visible = false;
      }
    }
    if (mon.isBoss && this.activeBoss) {
      // Carry the wire Guard (mon.poise: -1 broken · 0..100 %) into the boss record; breakUntil is
      // only ever set by guard_break / sf_boss so a stale pre-break delta can't un-break the bar.
      const bossUpd = { ...this.activeBoss, hp: mon.hp };
      const maxPoise = Number(this.activeBoss.maxPoise) || 0;
      if (mon.poise === -1) bossUpd.poise = -1;
      else if (Number.isFinite(mon.poise) && maxPoise > 0) bossUpd.poise = Math.round((mon.poise / 100) * maxPoise);
      this.onBoss(bossUpd);
    }
    if (isTargetedMob) {
      this._lastMobOverheadKey = '';
      const mDef = MONSTERS[mon.type];
      const curHp = Math.max(0, Math.round(mon.hp));
      const maxHp = Math.max(1, Math.round(mon.maxHp || mDef?.hp || 30));
      if (this.mobHpFillEl) {
        const pct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));
        this.mobHpFillEl.style.width = `${pct.toFixed(1)}%`;
      }
      if (this.mobHpTxtEl) {
        this.mobHpTxtEl.textContent = `${curHp}/${maxHp}`;
      }
    }
  }

  _esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _spawnDamageNumber(wx, wz, amount = 0, isCrit = false, color = null, customText = null) {
    const label = customText != null
      ? String(customText)
      : isCrit
      ? `💥 ${amount}!`
      : `-${amount}`;
    const el = this.showFloatingText(label, wx, wz, isCrit ? 'sf-float-perfect' : 'sf-float-hit');
    if (el && color) {
      el.style.color = color;
      el.style.borderColor = color;
    }
    return el;
  }

  _syncBossTagRow(mask = 0) {
    if (!this.bossTagRowEl) return;
    if (mask === this._lastBossTagMask) return;
    this._lastBossTagMask = mask;
    this.bossTagRowEl.innerHTML = mask
      ? decodeTagMask(mask).map((t) => this._tagChipHtml(t, { size: 12, withLabel: true })).join('')
      : '';
  }

  _applyMonsterHitStates(hitStates, frozenIds = null) {
    const frozenSet = Array.isArray(frozenIds) && frozenIds.length ? new Set(frozenIds) : null;
    const rows = Array.isArray(hitStates) ? hitStates.slice() : [];
    if (frozenSet) {
      const seen = new Set(rows.map((r) => (Array.isArray(r) ? r[0] : null)));
      for (const fid of frozenSet) {
        if (!seen.has(fid)) {
          const fMon = this.activeMonsters.get(fid);
          rows.push([fid, ((fMon?.tagMask || 0) | 16 | 8), fMon?.poise ?? null]);
        }
      }
    }
    if (!rows.length) return;
    const now = performance.now();
    if (!this._statusCalloutDedup) this._statusCalloutDedup = new Map();

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const [id, rawMask, rawPoise] = row;
      const mon = this.activeMonsters.get(id);
      if (!mon) continue;
      const prevMask = mon.tagMask || 0;
      const nextMask = (Number(rawMask) || 0) | (frozenSet?.has(id) ? 16 : 0);

      if (rawPoise !== undefined) {
        const nextPoise = rawPoise !== null && Number.isFinite(Number(rawPoise)) ? Number(rawPoise) : null;
        if (mon.poise !== nextPoise) {
          mon.poise = nextPoise;
          this._syncMonsterGuardBar(mon);
        }
      }

      if (prevMask !== nextMask) {
        mon.tagMask = nextMask;
        mon.tags = decodeTagMask(nextMask);
        this._syncMonsterTagSprite(mon);
        if (mon.isBoss && this.activeBoss) {
          this.activeBoss.tagMask = nextMask;
          this._syncBossTagRow(nextMask);
        }

        const added = nextMask & ~prevMask;
        const canPop = (bit) => {
          const key = `${id}:${bit}`;
          const last = this._statusCalloutDedup.get(key) || 0;
          if (now - last < 650) return false;
          this._statusCalloutDedup.set(key, now);
          return true;
        };

        if ((added & 16) && canPop(16)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, true, '#67E8F9', '🧊 FROZEN!');
          this.skillVfx?.spawnEffect?.({
            vfxId: 'reaction_deep_freeze',
            level: 1,
            x: mon.x,
            z: mon.z,
            targetX: mon.x,
            targetZ: mon.z,
            facing: { x: 0, z: 1 },
          });
        } else if ((added & 256) && canPop(256)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, true, '#FDE047', '😵 STUNNED!');
        } else if ((added & 64) && canPop(64)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#F472B6', '🌠 MARKED +25%');
        } else if ((added & 128) && canPop(128)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#C084FC', '🌀 GATHERED');
        } else if ((added & 8) && !(nextMask & 16) && canPop(8)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#7DD3FC', '❄️ CHILLED');
        } else if ((added & 1) && canPop(1)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#38BDF8', '💧 SOAKED');
        } else if ((added & 2) && canPop(2)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#FB923C', '🔥 BURNING');
        } else if ((added & 4) && canPop(4)) {
          this._spawnDamageNumber(mon.x, mon.z, 0, false, '#FACC15', '⚡ SHOCKED');
        }
      }
    }
  }

  _applyMonsterHits(hits, { facing = null, isSkill = false, showFloats = true } = {}) {
    if (!Array.isArray(hits) || hits.length === 0) return;
    const pNow = performance.now();
    for (const hit of hits) {
      if (!Array.isArray(hit)) continue;
      const [id, dealt, crit, monHp, newX, newZ] = hit;
      const mon = this.activeMonsters.get(id);
      if (!mon) continue;
      if (Number.isFinite(monHp)) {
        mon.hp = monHp;
        mon._lastDamageAt = pNow;
      }
      if (Number.isFinite(newX) && Number.isFinite(newZ)) {
        mon.targetX = newX;
        mon.targetZ = newZ;
        mon.knockUntil = pNow + 220;
      }
      this._syncMonsterHpImmediate(mon);
      if (showFloats) {
        mon.shakeTimer = isSkill || crit ? 0.30 : 0.22;
        mon.squashTimer = isSkill || crit ? 0.30 : 0.24;
        mon.hitFlashTimer = isSkill ? 0.18 : 0.16;
        mon.hitDir = (facing?.x ?? 1) >= 0 ? -1 : 1;
        if (crit && !isSkill) {
          this.punchCamera(0.075, 0.16);
          this.world?.fx?.emit?.('fx_shockwave', mon.x, 0.7, mon.z, 1, {
            speed: 0.05,
            up: 0.05,
            size: 0.9,
            sizeEnd: 1.6,
            life: 0.28,
            tint: [1.0, 0.85, 0.35],
          });
        }
        if (!(Number(dealt) > 0)) {
          // Ward-absorbed / zero-damage control hits: flash only, no "-0" floating clutter.
        } else if (isSkill) {
          const label = crit ? `💥 ${dealt}!` : `✨ -${dealt}`;
          this.showFloatingText(label, mon.x, mon.z, crit ? 'sf-float-perfect' : 'sf-float-rare');
        } else {
          const text = crit ? `💥 ${dealt}!` : `-${dealt}`;
          this.showFloatingText(text, mon.x, mon.z, crit ? 'sf-float-perfect' : 'sf-float-hit');
          this.world?.fx?.emit?.(crit ? 'fx_lightning' : 'fx_star', mon.x, 0.9, mon.z, crit ? 9 : 4, {
            speed: crit ? 1.15 : 0.65,
            up: 1.05,
            size: crit ? 0.25 : 0.15,
            life: 0.42,
          });
        }
      }
    }
  }

  async executeAttack() {
    if (!this.targetMonster || !this.isAttacking) return;
    const local = this.world?.local;
    if (!local) return;
    const mon = this.activeMonsters.get(this.targetMonster.id);
    if (!mon || mon.hp <= 0) return;
    this.targetMonster = mon;
    const targetId = mon.id;

    const dx = mon.x - local.x;
    const dz = mon.z - local.z;
    const len = Math.hypot(dx, dz) || 1;
    const facing = { x: +(dx / len).toFixed(3), z: +(dz / len).toFixed(3) };

    this.world?.flushMoveNow?.(Boolean(mon._zeroHitStreak));

    const rig = local?.rig;
    const wep = this._getActiveWeaponInfo();
    const pNow = performance.now();
    const prevCombo = this._comboStep || 0;
    if (pNow - (this._lastAttackSwingAt || 0) > 2200) {
      this._comboStep = 0;
    }
    this._comboStep = ((this._comboStep || 0) % 3) + 1;
    this._lastAttackSwingAt = pNow;
    this._syncRuneButtonState();

    rig?.facing?.set?.(dx >= 0, dz < -0.35);

    if (wep.hasWeapon) {
      if (this._heldTool) {
        rig?.setHeldTool?.(null);
        this._heldTool = null;
      }
      const vfxId = `combo_${wep.weaponClass}_${this._comboStep}`;
      this.skillVfx?.spawnEffect?.({
        vfxId,
        level: 1,
        x: local.x,
        z: local.z,
        targetX: mon.x,
        targetZ: mon.z,
        targetRef: mon,
        facing,
        casterRig: rig,
      });
      this.playGatherSfx(
        wep.weaponClass === 'magic' ? 'hit_staff' : wep.weaponClass === 'ranged' ? 'step_target' : 'hit_axe'
      );
    } else {
      const mainTool = local?.profile?.frontier?.toolbelt?.main || 'pickaxe';
      const swing = mainTool === 'axe' ? 'chop_swing' : mainTool === 'staff' ? 'staff_cast' : 'mine_swing';
      const tier = local?.profile?.frontier?.toolbelt?.[mainTool] || 1;
      if (rig?.setHeldTool && this._heldTool !== `${mainTool}:${tier}`) {
        rig.setHeldTool(mainTool, tier);
        this._heldTool = `${mainTool}:${tier}`;
      }
      rig?.triggerAttack?.(swing, { dur: 0.45 });
      this._spawnSlashArc(local.x, local.z, mon.x, mon.z, mainTool, this.inBeatWindow);
      this.playGatherSfx(mainTool === 'axe' ? 'hit_axe' : mainTool === 'staff' ? 'hit_staff' : 'hit_pickaxe');
    }

    const seq = ++this._localAtkSeq;
    this._pendingLocalAtk = { seq, applied: false, at: performance.now() };
    this._attackInFlight = true;

    try {
      const payload = wep.hasWeapon
        ? { targetId, facing, comboStep: this._comboStep }
        : { targetId, facing };
      const res = await this.request('sf_attack', payload);
      if (!res) return;

      if (res.ok) {
        if (res.cooldownMs) {
          this.attackCooldownMs = res.cooldownMs;
          this._attackCdFromServer = true;
        }
        const sNow = Date.now() + (this.world?.serverOffset || 0);
        this._nextAttackServerAt = res.readyAt || (sNow + (res.cooldownMs || 560));
        const firstArrival = Boolean(
          this._pendingLocalAtk && this._pendingLocalAtk.seq === seq && !this._pendingLocalAtk.applied
        );
        if (this._pendingLocalAtk && this._pendingLocalAtk.seq === seq) {
          this._pendingLocalAtk.applied = true;
        }
        if (Array.isArray(res.hits) && res.hits.length > 0) {
          mon._zeroHitStreak = 0;
          this._applyMonsterHits(res.hits, { facing, isSkill: false, showFloats: firstArrival });
          this._applyMonsterHitStates(res.hitStates, res.frozenIds);
        } else {
          // Self-heal if server returned 0 hits (e.g. server range/position mismatch or stale mob):
          // immediately step closer to the monster and reconcile shard state if repeated!
          mon._zeroHitStreak = (mon._zeroHitStreak || 0) + 1;
          const curLocal = this.world?.local;
          if (curLocal && this.activeMonsters.has(targetId)) {
            const rdx = mon.x - curLocal.x;
            const rdz = mon.z - curLocal.z;
            const rd = Math.hypot(rdx, rdz) || 1;
            const closerDist = Math.max(1.15, rd - 2.0);
            if (rd > 1.25) {
              this.world?.walkTo?.(mon.x - (rdx / rd) * closerDist, mon.z - (rdz / rd) * closerDist);
              this._combatTapTarget = this.world?.input?.tapTarget || null;
            }
          }
          if (mon._zeroHitStreak >= 2) {
            this._reconcileMonstersFromServer();
          }
        }
      } else {
        this._comboStep = prevCombo;
        this._syncRuneButtonState();
        if (res.error === 'no_target') {
          this.onMonsterDead({ id: targetId, despawn: true });
        } else if (res.error === 'cooldown' && res.readyAt) {
          this._nextAttackServerAt = res.readyAt;
          const sNow = Date.now() + (this.world?.serverOffset || 0);
          this.attackTimer = Math.max(0, (this.attackCooldownMs || 620) - (res.readyAt - sNow));
        } else if (res.error === 'down') {
          this.stopAutoAttack();
        } else if (res.error === 'out_of_range') {
          if (Number.isFinite(res.monsterX) && Number.isFinite(res.monsterZ)) {
            mon.x = res.monsterX;
            mon.z = res.monsterZ;
            mon.targetX = res.monsterX;
            mon.targetZ = res.monsterZ;
          }
          const curLocal = this.world?.local;
          if (curLocal) {
            const rdx = mon.x - curLocal.x;
            const rdz = mon.z - curLocal.z;
            const rd = Math.hypot(rdx, rdz) || 1;
            const stopDist = Math.max(1.15, (wep.range || 2.2) - 0.55);
            if (rd > stopDist + 0.05) {
              this.world?.walkTo?.(mon.x - (rdx / rd) * stopDist, mon.z - (rdz / rd) * stopDist);
            } else {
              this.world?.walkTo?.(mon.x, mon.z);
            }
          } else {
            this.world?.walkTo?.(mon.x, mon.z);
          }
          this._combatTapTarget = this.world?.input?.tapTarget || null;
          this.attackTimer = (this.attackCooldownMs || 620) * 0.9;
        }
      }
    } catch {
      // ignore
    } finally {
      this._attackInFlight = false;
    }
  }

  async _reconcileMonstersFromServer() {
    if (this._reconcilingMonsters || !this.active) return;
    this._reconcilingMonsters = true;
    try {
      const snap = await this.request('sf_state', {});
      const list = snap?.layout?.monsters;
      if (!Array.isArray(list)) return;
      const aliveIds = new Set();
      for (const entry of list) {
        if (Array.isArray(entry) && entry[0]) aliveIds.add(entry[0]);
      }
      for (const [id, mon] of [...this.activeMonsters.entries()]) {
        if (!aliveIds.has(id) && !mon.isBoss) {
          this.onMonsterDead({ id, despawn: true });
        }
      }
      this.onMonsters({ m: list });
    } catch {
      // ignore
    } finally {
      this._reconcilingMonsters = false;
    }
  }

  // ------------------------------------------------------------------ Ultimate Medallion
  updateUltimateCharm() {
    const charm = this.world?.local?.profile?.equipped?.charm;
    if (!charm) {
      if (this.ultWrapperEl) this.ultWrapperEl.style.display = 'none';
      if (this.ultBtnEl) this.ultBtnEl.style.opacity = '0.45';
      if (this.ultIconEl) this.ultIconEl.textContent = '✨';
      if (this.ultLabelEl) this.ultLabelEl.textContent = 'NO CHARM';
      return;
    }

    if (this.ultWrapperEl) this.ultWrapperEl.style.display = 'flex';
    if (this.ultBtnEl) this.ultBtnEl.style.opacity = '1.0';
    const def = CHARMS[charm.id] || (charm.uid && CHARMS[charm.uid]);
    if (this.ultIconEl) this.ultIconEl.textContent = def?.icon || '✨';
    if (this.ultLabelEl) this.ultLabelEl.textContent = def?.name ? def.name.split(' ')[0] : 'ULT';
  }

  async triggerUltimate() {
    const local = this.world?.local;
    if (!local) return;
    const now = Date.now() + (this.world?.serverOffset || 0);
    if (this.ultReadyAt && now < this.ultReadyAt) {
      this.toast?.('Ultimate on cooldown!', 1500);
      return;
    }

    let facing = { x: 0, z: -1 };
    if (this.targetMonster) {
      facing = { x: this.targetMonster.x - local.x, z: this.targetMonster.z - local.z };
    } else if (local.rig?.facing) {
      facing = { x: local.rig.facing.right ? 1 : -1, z: local.rig.facing.back ? -1 : 1 };
    }
    const len = Math.hypot(facing.x, facing.z) || 1;
    facing = { x: +(facing.x / len).toFixed(3), z: +(facing.z / len).toFixed(3) };

    try {
      const res = await this.request('sf_ultimate', { facing });
      if (!res) return;
      if (res.ok) {
        if (res.readyAt) {
          this.ultReadyAt = res.readyAt;
          this.ultTotalCd = Math.max(1000, res.readyAt - now);
        }
      } else {
        if (res.error === 'no_ultimate') {
          this.toast?.('No Charm equipped! Equip one in Bag to use Ultimates.', 3000);
        } else if (res.error === 'cooldown') {
          if (res.readyAt) {
            this.ultReadyAt = res.readyAt;
            this.ultTotalCd = Math.max(1000, res.readyAt - now);
          }
        } else if (res.error === 'down') {
          this.toast?.('Cannot cast ultimate while knocked out!', 2000);
        }
      }
    } catch {
      // ignore
    }
  }

  _showUltRingVfx(x, z, maxRadius, color) {
    const ringGeo = new THREE.RingGeometry(0.2, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(x, 0.06, z);
    this.root.add(mesh);
    this.vfxRings.push({ mesh, maxRadius: maxRadius || 6, age: 0, life: 0.75 });
  }

  // ------------------------------------------------------------------ Context Action Buttons
  async onRepairTap() {
    const local = this.world?.local;
    const pantry = local?.profile?.frontier?.pantry?.items || {};
    const kits = Math.floor(Number(pantry.repair_kit) || 0);
    if (kits <= 0) {
      this.toast?.('No Repair Kits in pantry! Craft them at the Glasshouse.', 3000);
      return;
    }
    try {
      const res = await this.request('sf_repair', { outpostId: this.layout.regionId, kits });
      if (!res) return;
      if (res.ok) {
        this.toast?.(`Repaired Outpost with ${res.used} kit(s)! ✨`, 2500);
        if (res.pantry && local?.profile?.frontier) {
          local.profile.frontier.pantry = res.pantry;
        }
      } else {
        if (res.error === 'full') this.toast?.('Outpost is already at full HP!', 2000);
        else if (res.error === 'too_far') this.toast?.('Move closer to the goddess statue to repair.', 2000);
        else this.toast?.(res.error || 'Could not repair', 2000);
      }
    } catch {
      // ignore
    }
  }

  async onBossSummonTap() {
    const rMeta = REGION_META[this._currentRegionId()] || REGION_META.meadow;
    const bossId = rMeta.bossId;
    try {
      const res = await this.request('sf_boss_start', { bossId });
      if (!res) return;
      if (!res.ok) {
        if (res.error === 'cooldown') {
          this.toast?.('Boss is resting — please wait for cooldown!', 2500);
        } else if (res.error === 'boss_active') {
          this.toast?.('A boss is already active!', 2000);
        } else {
          this.toast?.(res.error || 'Could not summon boss', 2000);
        }
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Server Event Handlers
  onMonsters(m) {
    if (!m || !Array.isArray(m.m)) return;
    const pSeen = performance.now();
    for (const entry of m.m) {
      const [id, type, x, z, hp, maxHp, isEliteFlag] = entry;
      const isElite = Boolean(isEliteFlag);
      // Master Crafters wire extension: [7] tagMask, [8] poise (null | -1 broken | 0..100). Old 7-tuples → 0 / null.
      const wireMask = entry.length > 7 ? (Number(entry[7]) || 0) : 0;
      const wirePoise = entry.length > 8 && entry[8] !== null && entry[8] !== undefined && Number.isFinite(Number(entry[8]))
        ? Number(entry[8])
        : null;
      let mon = this.activeMonsters.get(id);
      if (mon) {
        const prevHp = mon.hp;
        const prevPoise = mon.poise;
        if (mon.tagMask !== wireMask || mon.poise !== wirePoise) {
          this._applyMonsterHitStates([[id, wireMask, wirePoise]]);
        }
        if (Math.hypot(x - mon.x, z - mon.z) > 5.0) {
          mon.x = x;
          mon.z = z;
          if (mon.group) {
            mon.group.position.x = x;
            mon.group.position.z = z;
          }
        }
        mon.targetX = x;
        mon.targetZ = z;
        const recentlyDamaged = performance.now() - (mon._lastDamageAt || 0) < 450;
        if (!recentlyDamaged || hp <= mon.hp || hp >= maxHp) {
          mon.hp = hp;
        }
        mon.maxHp = maxHp;
        mon._lastSeenAt = pSeen;
        if (mon.isElite !== isElite) {
          mon.isElite = isElite;
          if (mon.group?.userData?.eliteRing) {
            mon.group.userData.eliteRing.visible = isElite && !mon.isBoss;
          }
          if (mon.group?.userData?.shadow) {
            const sr = mon.group.userData.shadowR || 0.58;
            mon.group.userData.shadow.scale.setScalar(sr * (isElite ? 1.18 : 1.0));
          }
        }
        if (this.targetMonster?.id === id) {
          this._syncMonsterHpImmediate(mon);
        } else if (mon.isBoss && this.activeBoss && (mon.hp !== prevHp || mon.poise !== prevPoise)) {
          // Boss record updates always drive the top boss bar, even when the boss isn't targeted
          this._syncMonsterHpImmediate(mon);
        }
      } else {
        if (this.activeMonsters.size >= 96) continue;
        const isBoss = Boolean(BOSSES[type]);
        const group = this._acquireMonsterMesh(type);
        const initScale = (isBoss ? 2.8 : 1.0) * (isElite ? ALPHA_ELITE.SCALE_MULT : 1.0);
        group.scale.set(initScale, initScale, initScale);
        if (group.userData?.eliteRing) {
          group.userData.eliteRing.visible = isElite && !isBoss;
        }
        if (group.userData?.shadow) {
          const sr = group.userData.shadowR || 0.58;
          group.userData.shadow.scale.setScalar(sr * (isElite ? 1.18 : 1.0));
        }
        group.position.set(x, isBoss ? 0 : group.userData.baseY || 0, z);
        this.root.add(group);
        mon = {
          id,
          type,
          group,
          hp,
          maxHp,
          x,
          z,
          targetX: x,
          targetZ: z,
          isBoss,
          isElite,
          auraTimer: Math.random() * 1.8,
          hpBar: group.userData.hpBar,
          hpFill: group.userData.hpFill,
          baseY: group.userData.baseY || 0,
          bobPhase: Math.random() * Math.PI * 2,
          walkPhase: Math.random() * Math.PI * 2,
          shakeTimer: 0,
          squashTimer: 0,
          hitFlashTimer: 0,
          hitDir: 1,
          tagMask: wireMask,
          tags: decodeTagMask(wireMask),
          poise: wirePoise,
          _lastSeenAt: pSeen,
        };
        this.activeMonsters.set(id, mon);
        this._syncMonsterTagSprite(mon);
        this._syncMonsterGuardBar(mon);
      }
    }
  }

  // ---------------------------------------------------------------- Status tag sprites & Guard bars (allocation-free per frame)
  _ensureComboIconImages() {
    if (this._comboIconImgs || typeof Image === 'undefined') return this._comboIconImgs || null;
    this._comboIconImgs = {};
    this._tagIconGen = 0;
    for (const id of Object.keys(STATUS_TAGS)) {
      const img = new Image();
      const src = SF_COMBO_ICON_SRC(id);
      if (!src) {
        img._failed = true;
        this._comboIconImgs[id] = img;
        continue;
      }
      img.decoding = 'async';
      img.onload = () => {
        // Rebuild cached tag textures once with the real PNG art (debounced)
        if (this._tagIconReloadTimer) return;
        this._tagIconReloadTimer = setTimeout(() => {
          this._tagIconReloadTimer = null;
          this._tagIconGen = (this._tagIconGen || 0) + 1;
          const old = [...this._tagSpriteTexCache.values()];
          this._tagSpriteTexCache.clear();
          for (const mon of this.activeMonsters.values()) {
            if (mon.tagMask) this._syncMonsterTagSprite(mon);
          }
          for (const entry of old) entry.tex?.dispose?.();
        }, 250);
      };
      img.onerror = () => { img._failed = true; };
      img.src = src;
      this._comboIconImgs[id] = img;
    }
    return this._comboIconImgs;
  }

  /** Cached CanvasTexture of the tag icon row for a given mask. */
  _getTagMaskTexture(mask) {
    let entry = this._tagSpriteTexCache.get(mask);
    if (entry) return entry;
    if (typeof document === 'undefined') return null;
    const ids = decodeTagMask(mask);
    if (!ids.length) return null;
    const imgs = this._ensureComboIconImages() || {};
    const cell = 64;
    const canvas = document.createElement('canvas');
    canvas.width = cell * ids.length;
    canvas.height = cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ids.forEach((id, i) => {
      const def = STATUS_TAGS[id];
      const cx = i * cell + cell / 2;
      const borderCol = def?.color || '#67E8F9';
      ctx.beginPath();
      ctx.arc(cx, cell / 2, cell / 2 - 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
      const img = imgs[id];
      if (img && img.complete && img.naturalWidth > 0 && !img._failed) {
        ctx.drawImage(img, cx - 22, cell / 2 - 22, 44, 44);
      } else {
        ctx.font = 'bold 34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(def?.icon || '•', cx, cell / 2 + 2);
      }
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { ...(tex.userData || {}), sharedFrontierAsset: true };
    entry = { tex, count: ids.length };
    // Bound the cache (masks are bitmasks; in practice only a handful occur). Never evict a texture
    // that a live monster's tag sprite is still showing — pick the oldest UNREFERENCED mask instead.
    if (this._tagSpriteTexCache.size >= 256) {
      let inUse = null;
      for (const mon of this.activeMonsters.values()) {
        const spr = mon.group?.userData?.tagSprite;
        if (spr?.material?.map) (inUse || (inUse = new Set())).add(spr.material.map);
      }
      for (const [key, old] of this._tagSpriteTexCache) {
        if (inUse && inUse.has(old.tex)) continue;
        old.tex?.dispose?.();
        this._tagSpriteTexCache.delete(key);
        break;
      }
    }
    this._tagSpriteTexCache.set(mask, entry);
    return entry;
  }

  _syncMonsterTagSprite(mon) {
    const group = mon?.group;
    if (!group) return;
    const ud = group.userData || (group.userData = {});
    const mask = Number(mon.tagMask) || 0;
    if (!mask) {
      if (ud.tagSprite) ud.tagSprite.visible = false;
      return;
    }
    const entry = this._getTagMaskTexture(mask);
    if (!entry) return;
    if (!ud.tagSprite) {
      const mat = new THREE.SpriteMaterial({ map: entry.tex, transparent: true, depthWrite: false, depthTest: false });
      const spr = new THREE.Sprite(mat);
      if (spr.geometry) spr.geometry.userData = { ...(spr.geometry.userData || {}), sharedFrontierAsset: true };
      spr.renderOrder = 12;
      const hpY = ud.hpBar?.position?.y || 1.6;
      spr.position.set(0, hpY + 0.24, 0);
      group.add(spr);
      ud.tagSprite = spr;
    } else if (ud.tagSprite.material.map !== entry.tex) {
      ud.tagSprite.material.map = entry.tex;
      ud.tagSprite.material.needsUpdate = true;
    }
    // Keep icons ~0.34m tall in world space regardless of boss/elite group scale
    const gs = Math.max(0.5, group.scale?.y || 1);
    const h = 0.34 / gs;
    ud.tagSprite.scale.set(h * entry.count, h, 1);
    ud.tagSprite.visible = true;
  }

  /** Floating "⚡💧 Conduction!" text (deduped per monster per 250ms) + `reaction_<id>` Effekseer burst. */
  _handleReactionFx(reactions, localId) {
    const pNow = performance.now();
    // Group this payload's reactions by id so a big AoE combo reads as ONE "×N" callout
    const groups = new Map();
    for (const entry of reactions) {
      if (!Array.isArray(entry)) continue;
      const [monId, reactionId, rx, rz] = entry;
      const r = REACTIONS[reactionId];
      if (!r) continue;
      const mon = this.activeMonsters.get(monId);
      const x = Number.isFinite(rx) ? rx : (mon?.x ?? 0);
      const z = Number.isFinite(rz) ? rz : (mon?.z ?? 0);
      let g = groups.get(reactionId);
      if (!g) {
        g = { r, pts: [] };
        groups.set(reactionId, g);
      }
      g.pts.push({ monId, x, z });
    }
    const styleFloat = (el, r) => {
      if (!el) return;
      el.style.color = r.color;
      el.style.borderColor = r.color;
      el.style.boxShadow = `0 0 14px ${r.color}88, 0 3px 10px rgba(0,0,0,0.5)`;
    };
    const spawnVfx = (reactionId, x, z) => {
      this.skillVfx?.spawnEffect?.({
        vfxId: `reaction_${reactionId}`,
        level: 1,
        x,
        z,
        targetX: x,
        targetZ: z,
        facing: { x: 0, z: 1 },
      });
    };
    for (const [reactionId, g] of groups) {
      const { r, pts } = g;
      if (pts.length >= 3) {
        let cx = 0;
        let cz = 0;
        for (const pt of pts) {
          cx += pt.x;
          cz += pt.z;
          this._reactionTextAt.set(`${pt.monId}:${reactionId}`, pNow);
        }
        cx /= pts.length;
        cz /= pts.length;
        styleFloat(this.showFloatingText(`${r.icon} ${r.label} ×${pts.length}!`, cx, cz, 'sf-float-reaction'), r);
        for (let i = 0; i < Math.min(3, pts.length); i++) spawnVfx(reactionId, pts[i].x, pts[i].z);
        continue;
      }
      for (const pt of pts) {
        const key = `${pt.monId}:${reactionId}`;
        const last = this._reactionTextAt.get(key) || 0;
        if (pNow - last < 250) continue;
        this._reactionTextAt.set(key, pNow);
        styleFloat(this.showFloatingText(`${r.icon} ${r.label}!`, pt.x, pt.z, 'sf-float-reaction'), r);
        spawnVfx(reactionId, pt.x, pt.z);
      }
    }
    // Keep the dedupe map tiny
    if (this._reactionTextAt.size > 64) {
      for (const [k, t] of this._reactionTextAt) {
        if (pNow - t > 1000) this._reactionTextAt.delete(k);
      }
    }
  }

  _syncMonsterGuardBar(mon) {
    const ud = mon?.group?.userData;
    if (!ud?.guardBar) return;
    const poise = mon.poise;
    if (poise === null || poise === undefined || mon.isBoss) {
      ud.guardBar.visible = false;
      return;
    }
    ud.guardBar.visible = true;
    const broken = poise < 0;
    const pct = broken ? 1 : Math.max(0.001, Math.min(1, poise / 100));
    ud.guardFill.scale.x = pct;
    ud.guardFill.position.x = -0.38 * (1 - pct);
    ud.guardFill.material = broken ? this._mobMats.guardBroken : this._mobMats.guardFill;
  }

  onMonsterDead(m) {
    if (!m || !m.id) return;
    const mon = this.activeMonsters.get(m.id);
    const wasMyTarget = Boolean(this.targetMonster && this.targetMonster.id === m.id);
    if (mon) {
      if (wasMyTarget) {
        this.stopAutoAttack();
      }
      this._showDeathPuff(mon.x, mon.z, mon.isBoss || mon.isElite);
      this.activeMonsters.delete(m.id);
      if (mon.hpBar) mon.hpBar.visible = false;
      // Master Crafters: drop status tags + Guard bar immediately so the dying puff reads clean
      if (mon.group?.userData?.tagSprite) mon.group.userData.tagSprite.visible = false;
      if (mon.group?.userData?.guardBar) mon.group.userData.guardBar.visible = false;
      mon.tagMask = 0;
      this.dyingMonsters.push({
        group: mon.group,
        type: mon.type,
        isBoss: mon.isBoss,
        isElite: Boolean(mon.isElite),
        baseY: mon.baseY || 0,
        x: mon.x,
        z: mon.z,
        age: 0,
        life: 0.28,
      });
    }

    const localId = this.world?.local?.id || this._getProfile()?.id;
    const hasMyDrops = Boolean(m.drops && localId && m.drops[localId]);
    if (hasMyDrops) {
      this._feverStreak = (this._feverStreak || 0) + 1;
      const coupleSync = Array.isArray(m.coupleResonanceUsers) && m.coupleResonanceUsers.includes(localId);
      this.playGatherSfx(coupleSync ? 'break_rare' : 'break_common');
      const parts = [];
      for (const [mat, count] of Object.entries(m.drops[localId])) {
        if (count > 0) parts.push(`+${count} ${EMOJI_MAP[mat] || '📦'}`);
      }
      if (parts.length && mon) {
        const prefix = coupleSync ? '💞 COUPLE SYNC (+25%)!  ' : '';
        if (coupleSync) {
          this._showUltRingVfx(mon.x, mon.z, 3.0, 0xF472B6);
        }
        this.punchCamera(0.08, 0.18);
        const local = this.world?.local;
        if (local && this.world?.fx?.emitTo) {
          this.world.fx.emitTo('fx_star', mon.x, 0.9, mon.z, local.x, 0.9, local.z, 8, {
            arc: 1.4,
            time: 0.46,
            size: 0.24,
          });
        }
        this.showFloatingText(`${prefix}${parts.join('  ')}`, mon.x, mon.z, coupleSync ? 'sf-float-rare' : '');
        this.spawnLootMagnets(m.drops[localId], mon.x, mon.z);
      }
      this._syncRuneButtonState();
    }

    // Species-locked Auto-Hunt chains strictly to the locked monster (or waits at habitat); normal Auto resumes gathering
    if (this.autoGatherEnabled && this.lockedHuntMobId && this.active) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || !this.autoGatherEnabled || !this.lockedHuntMobId || this.targetGate) return;
        if (this.targetMonster && this.targetMonster.type === this.lockedHuntMobId) return;
        const nextLocked = this._findNearestLockedMonster();
        if (nextLocked) {
          this.targetNode = null;
          this._navTarget = null;
          this.startAutoAttack(nextLocked);
        } else if (this.lockedHuntAnchor && this.lockedHuntAnchor.region === this._currentRegionId()) {
          const loc = this.world?.local;
          const d = loc ? Math.hypot(loc.x - this.lockedHuntAnchor.x, loc.z - this.lockedHuntAnchor.z) : 0;
          if (d > 2.8) {
            this.world?.walkTo?.(this.lockedHuntAnchor.x, this.lockedHuntAnchor.z);
          } else {
            this.world?.clearMoveState?.();
          }
        }
      }, 280);
    } else if (this.autoGatherEnabled && wasMyTarget && this.active && (this.energy?.cur || 0) >= 2) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || !this.autoGatherEnabled || this.lockedHuntMobId || this.targetMonster || this.targetNode || this.targetGate) return;
        this.findAndWalkToNextNode(this.preferredTargetType);
      }, 380);
    }
  }

  onHit(m) {
    if (!m) return;
    const localId = this.world?.local?.id || this._getProfile()?.id;
    if (m.by && m.by !== localId) {
      const rem = this.world?.remotes?.get?.(m.by);
      if (rem?.rig) {
        const tool = m.tool || 'pickaxe';
        const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
        rem.rig.setHeldTool?.(tool, 1);
        if (m.facing) {
          rem.rig.facing?.set?.(m.facing.x >= 0, m.facing.z < -0.35);
          const rx = rem.smooth?.x ?? rem.x ?? 0;
          const rz = rem.smooth?.z ?? rem.z ?? 0;
          this._spawnSlashArc(rx, rz, rx + m.facing.x * 1.4, rz + m.facing.z * 1.4, tool, false);
        }
        rem.rig.triggerAttack?.(swing, { dur: 0.45 });
      }
    }
    if (Array.isArray(m.hits) && m.hits.length > 0) {
      if (m.by === localId && this._pendingLocalAtk && performance.now() - this._pendingLocalAtk.at < 1500) {
        const firstArrival = !this._pendingLocalAtk.applied;
        this._pendingLocalAtk.applied = true;
        if (m.readyAt) this._nextAttackServerAt = m.readyAt;
        this._applyMonsterHits(m.hits, { facing: m.facing, isSkill: false, showFloats: firstArrival });
      } else {
        this._applyMonsterHits(m.hits, { facing: m.facing, isSkill: false, showFloats: true });
      }
      this._applyMonsterHitStates(m.hitStates, m.frozenIds);
    } else if (m.hitStates || m.frozenIds) {
      this._applyMonsterHitStates(m.hitStates, m.frozenIds);
    }
    if (Array.isArray(m.heals)) {
      for (const [uid, amt] of m.heals) {
        if (amt > 0) {
          if (uid === localId && this.world?.local) {
            this.showFloatingText(`💚 +${amt}`, this.world.local.x, this.world.local.z);
          } else {
            const r = this.world?.remotes?.get(uid);
            if (r) this.showFloatingText(`💚 +${amt}`, r.x, r.z);
          }
        }
      }
    }
  }

  _spawnAlphaTelegraphRing(x, z, radius = 3.4, durationMs = 1100) {
    if (!this.root) return;
    const r = Math.max(1.2, Number(radius) || 3.4);
    let slot = this._alphaTelegraphPool?.pop?.() || null;
    if (!slot) {
      const group = new THREE.Group();
      const ringGeo = this._mobGeos?.unitGroundRing || (() => {
        const g = new THREE.RingGeometry(0.86, 1.0, 36);
        g.rotateX(-Math.PI / 2);
        return g;
      })();
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFACC15,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const fillGeo = this._mobGeos?.unitGroundCircle || (() => {
        const g = new THREE.CircleGeometry(1.0, 22);
        g.rotateX(-Math.PI / 2);
        return g;
      })();
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xEF4444,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      group.add(fillMesh);
      group.add(ringMesh);
      slot = { group, ringMat, fillMat, fillMesh, ringMesh };
    }
    slot.group.visible = true;
    slot.group.position.set(x, 0.044, z);
    slot.ringMesh.scale.set(r, 1, r);
    slot.fillMesh.scale.set(r * 0.18, 1, r * 0.18);
    slot.radius = r;
    slot.age = 0;
    slot.life = Math.max(0.35, (Number(durationMs) || 1100) / 1000);
    this.root.add(slot.group);
    this._alphaTelegraphs.push(slot);
  }

  _spawnSkillZoneRing(kind, x, z, radius = 4.4, durationMs = 4000, followActorId = null) {
    if (!this.root) return;
    const palette = {
      pollen_ring:    { ring: 0x86EFAC, fill: 0xFDE047 },
      koi_whirlpool:  { ring: 0x38BDF8, fill: 0x2DD4BF },
      sakura_tempest: { ring: 0xF9A8D4, fill: 0xF472B6 },
      solar_burn:     { ring: 0xFBBF24, fill: 0xF97316 },
    }[kind] || { ring: 0x67E8F9, fill: 0x38BDF8 };

    const r = Math.max(1.8, Number(radius) || 4.4);
    const group = new THREE.Group();
    const ringGeo = this._mobGeos?.unitGroundRing;
    const fillGeo = this._mobGeos?.unitGroundCircle;
    if (!ringGeo || !fillGeo) return;
    const ringMat = new THREE.MeshBasicMaterial({
      color: palette.ring,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fillMat = new THREE.MeshBasicMaterial({
      color: palette.fill,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    fillMesh.scale.set(0.96, 1, 0.96);
    ringMesh.scale.set(1, 1, 1);
    group.add(fillMesh);
    group.add(ringMesh);
    group.position.set(x, 0.032, z);
    group.scale.set(r, 1, r);
    this.root.add(group);
    const zone = {
      group,
      ringMesh,
      ringMat,
      fillMat,
      x,
      z,
      radius: r,
      followActorId: followActorId || null,
      age: 0,
      life: Math.max(1.0, (Number(durationMs) || 4000) / 1000),
    };
    this._activeSkillZones.push(zone);
    return zone;
  }

  _applyServerBuffs(buffs) {
    if (!buffs || typeof buffs !== 'object') return;
    if (!this._localBuffs) {
      this._localBuffs = { hasteUntil: 0, hastePct: 0, dmgReduceUntil: 0, critUpUntil: 0 };
    }
    this._localBuffs.hasteUntil = Math.max(this._localBuffs.hasteUntil || 0, Number(buffs.hasteUntil) || 0);
    if (Number(buffs.hastePct) > 0) this._localBuffs.hastePct = Number(buffs.hastePct);
    this._localBuffs.dmgReduceUntil = Math.max(this._localBuffs.dmgReduceUntil || 0, Number(buffs.dmgReduceUntil) || 0);
    this._localBuffs.critUpUntil = Math.max(this._localBuffs.critUpUntil || 0, Number(buffs.critUpUntil) || 0);
    // 🎶 Resonance is CONSUMED by the next damaging skill, so the server value is authoritative (not max'd)
    if (Object.prototype.hasOwnProperty.call(buffs, 'resonanceUntil')) {
      this._resonanceUntil = Number(buffs.resonanceUntil) || 0;
    }
  }

  onFx(m) {
    if (!m) return;
    const local = this.world?.local;
    const localId = local?.id || this._getProfile()?.id;

    // Master Crafters combo reactions ride on attack / monster_skill / zone_tick payloads
    if (Array.isArray(m.reactions) && m.reactions.length > 0 && (m.kind === 'attack' || m.kind === 'monster_skill' || m.kind === 'zone_tick')) {
      this._handleReactionFx(m.reactions, localId);
    }

    if (m.kind === 'reaction_discovered') {
      if (m.userId === localId) {
        const r = REACTIONS[m.reactionId];
        const diamonds = Number(m.diamonds) || 30;
        const p = this._getProfile();
        if (p) {
          p.frontier = p.frontier || {};
          p.frontier.skills = p.frontier.skills || { unlocked: {}, equipped: [null, null, null, null] };
          const rf = p.frontier.skills.reactionsFound || (p.frontier.skills.reactionsFound = {});
          rf[m.reactionId] = Math.max(1, Number(rf[m.reactionId]) || 0);
          if (Number.isFinite(Number(m.total))) p.diamonds = Number(m.total);
          if (this.skillModalOpen) this._renderSkillModalHtml(p);
        }
        this.playGatherSfx('break_rare');
        if (local) this._showUltRingVfx(local.x, local.z, 3.2, 0xA78BFA);
        this._showComboBanner(
          `🧪 NEW REACTION DISCOVERED: ${r ? `${r.icon} ${r.label}` : m.reactionId} · +${diamonds}💎`,
          r ? r.desc : '',
          { ms: 5600, actionHtml: '<button type="button" class="sf-map-btn" data-scroll-open-tab="reactions">🧪 View</button>' }
        );
      }
      return;
    }

    if (m.kind === 'guard_break') {
      const gx = Number.isFinite(m.x) ? m.x : (this.activeMonsters.get(m.id)?.x ?? 0);
      const gz = Number.isFinite(m.z) ? m.z : (this.activeMonsters.get(m.id)?.z ?? 0);
      this.skillVfx?.spawnEffect?.({ vfxId: 'guard_break', level: 1, x: gx, z: gz, targetX: gx, targetZ: gz, facing: { x: 0, z: 1 } });
      const dist = local ? Math.hypot(gx - local.x, gz - local.z) : 0;
      if (dist < 18) this.punchCamera(m.isBoss ? 0.14 : 0.09, m.isBoss ? 0.26 : 0.18);
      const el = this.showFloatingText('💥 GUARD BREAK!', gx, gz, 'sf-float-epic');
      if (el) {
        el.style.borderColor = '#F43F5E';
        el.style.color = '#FFE4E6';
      }
      const mon = this.activeMonsters.get(m.id);
      if (mon && !mon.isBoss) {
        mon.poise = -1;
        this._syncMonsterGuardBar(mon);
      }
      if (m.isBoss && this.activeBoss) {
        // Mutate the live boss record so later hp updates keep the Guard broken until breakUntil.
        this.activeBoss.poise = -1;
        this.activeBoss.breakUntil = Math.max(
          Number(this.activeBoss.breakUntil) || 0,
          Number(m.breakUntil) || (Date.now() + (this.world?.serverOffset || 0) + 4000)
        );
        this._syncBossGuardBar(this.activeBoss);
      }
      return;
    }

    if (m.kind === 'mob_ward') {
      const wx = Number.isFinite(m.x) ? m.x : (this.activeMonsters.get(m.id)?.x ?? 0);
      const wz = Number.isFinite(m.z) ? m.z : (this.activeMonsters.get(m.id)?.z ?? 0);
      this.skillVfx?.spawnEffect?.({ vfxId: 'mob_ward', level: 1, x: wx, z: wz, targetX: wx, targetZ: wz, facing: { x: 0, z: 1 } });
      const el = this.showFloatingText(`🔔 Warded${Array.isArray(m.warded) && m.warded.length > 1 ? ` ×${m.warded.length}` : ''}`, wx, wz, 'sf-float-rare');
      if (el) el.style.borderColor = STATUS_TAGS.warded?.color || '#5EEAD4';
      return;
    }

    if (m.kind === 'passive_drop') {
      const ps = MONSTER_PASSIVES[m.passiveId];
      if (!ps) return;
      if (m.userId === localId) {
        const p = this._getProfile();
        if (p) {
          p.frontier = p.frontier || {};
          const sk = p.frontier.skills || (p.frontier.skills = { unlocked: {}, equipped: [null, null, null, null] });
          sk.passives = sk.passives || {};
          sk.passives[m.passiveId] = Number(m.newLevel) || 1;
          if (m.autoEquipped) sk.passive = m.passiveId;
          if (Number(m.essenceGain) > 0) sk.essence = (Number(sk.essence) || 0) + Number(m.essenceGain);
          this.updateSkillButtons(p);
          if (this.skillModalOpen) this._renderSkillModalHtml(p);
        }
        this.playGatherSfx('break_rare');
        if (local) {
          this.punchCamera(0.08, 0.2);
          this._showUltRingVfx(local.x, local.z, 3.6, 0xF59E0B);
        }
        const isNew = Number(m.prevLevel || 0) === 0;
        const maxed = Number(m.prevLevel || 0) >= 3 && Number(m.newLevel || 0) <= Number(m.prevLevel || 0);
        const title = maxed
          ? `🏅 ${ps.icon} ${ps.name} MAX`
          : isNew
          ? `🏅 NEW PASSIVE! ${ps.icon} ${ps.name}`
          : `🏅 PASSIVE UPGRADE! ${ps.icon} ${ps.name} → Lv.${m.newLevel}`;
        const sub = `${passiveDescFor(m.passiveId, Math.max(1, Number(m.newLevel) || 1))}${m.autoEquipped ? ' · Auto-equipped!' : ''}${Number(m.essenceGain) > 0 ? ` · +${m.essenceGain} 🔮 Essence` : ''}`;
        this._showComboBanner(title, sub, {
          ms: 6200,
          actionHtml: m.autoEquipped
            ? '<button type="button" class="sf-map-btn" data-scroll-open-tab="passives">📖 View</button>'
            : `<button type="button" class="sf-map-btn" data-scroll-equip-passive="${m.passiveId}">🏅 Equip</button>`,
        });
      } else {
        const rem = this.world?.remotes?.get?.(m.userId);
        if (rem) {
          this.showFloatingText(`🏅 ${m.username || m.userId}: ${ps.icon} ${ps.name}!`, rem.smooth?.x ?? rem.x ?? 0, rem.smooth?.z ?? rem.z ?? 0, 'sf-float-rare');
        }
      }
      return;
    }
    if (m.kind === 'alpha_spawn') {
      const mName = MONSTERS[m.monsterType || m.mobType]?.name || 'Alpha Elite';
      this.toast?.(`⭐ Alpha Elite sighted — ${mName}!`, 2800);
      if (Number.isFinite(m.x) && Number.isFinite(m.z)) {
        this.showFloatingText(`⭐ ALPHA ELITE!`, m.x, m.z, 'sf-float-epic');
      }
      return;
    }

    if (m.kind === 'alpha_telegraph') {
      const tx = Number.isFinite(m.targetX) ? m.targetX : (m.x || 0);
      const tz = Number.isFinite(m.targetZ) ? m.targetZ : (m.z || 0);
      this._spawnAlphaTelegraphRing(tx, tz, m.radius || 3.4, m.durationMs || 1100);
      // Remember the wind-up so smart auto may spend 🍃 Zephyr Vault to dodge it
      const teleMon = m.id ? this.activeMonsters.get(m.id) : null;
      if (teleMon) teleMon._telegraphUntil = performance.now() + (Number(m.durationMs) || 1100) + 150;
      const skName = MONSTER_SKILLS[m.skillId]?.name || 'Alpha Skill';
      this.showFloatingText(`⚠️ ${skName}!`, m.x ?? tx, m.z ?? tz, 'sf-float-perfect');
      return;
    }

    if (m.kind === 'alpha_skill_cast') {
      const vfxId = m.vfxId || m.skillId;
      if (vfxId) {
        this.skillVfx?.spawnEffect?.({
          vfxId,
          level: 3,
          x: m.x ?? 0,
          z: m.z ?? 0,
          targetX: m.targetX ?? m.x ?? 0,
          targetZ: m.targetZ ?? m.z ?? 0,
          facing: m.facing || { x: 0, z: 1 },
          durationMs: 1500,
        });
      }
      return;
    }

    if (m.kind === 'attack') {
      if (m.by && m.by !== localId) {
        const rem = this.world?.remotes?.get?.(m.by);
        if (rem?.rig) {
          const rx = rem.smooth?.x ?? rem.x ?? 0;
          const rz = rem.smooth?.z ?? rem.z ?? 0;
          const fx = m.facing?.x ?? 0;
          const fz = m.facing?.z ?? 1;
          rem.rig.setHeldTool?.(null);
          rem.rig.facing?.set?.(fx >= 0, fz < -0.35);
          const vfxId = m.vfxId || `combo_${m.weaponClass || 'melee'}_${m.comboStep || 1}`;
          let tx = rx + fx * 3.5;
          let tz = rz + fz * 3.5;
          let targetMonRef = null;
          if (Array.isArray(m.hits) && m.hits.length > 0) {
            const hMon = this.activeMonsters.get(m.hits[0][0]);
            if (hMon) {
              tx = hMon.x;
              tz = hMon.z;
              targetMonRef = hMon;
            }
          }
          this.skillVfx?.spawnEffect?.({
            vfxId,
            level: 1,
            x: rx,
            z: rz,
            targetX: tx,
            targetZ: tz,
            targetRef: targetMonRef,
            facing: { x: fx, z: fz },
            casterRig: rem.rig,
          });
        }
      }

      if (Array.isArray(m.hits) && m.hits.length > 0) {
        if (m.by === localId && this._pendingLocalAtk && performance.now() - this._pendingLocalAtk.at < 1500) {
          const firstArrival = !this._pendingLocalAtk.applied;
          this._pendingLocalAtk.applied = true;
          if (m.readyAt) this._nextAttackServerAt = m.readyAt;
          this._applyMonsterHits(m.hits, { facing: m.facing, isSkill: false, showFloats: firstArrival });
        } else {
          this._applyMonsterHits(m.hits, { facing: m.facing, isSkill: false, showFloats: true });
        }
        this._applyMonsterHitStates(m.hitStates, m.frozenIds);
      } else if (m.hitStates || m.frozenIds) {
        this._applyMonsterHitStates(m.hitStates, m.frozenIds);
      }

      const heals = m.partyHeals || m.heals;
      if (Array.isArray(heals)) {
        for (const [uid, amt] of heals) {
          if (amt > 0) {
            if (uid === localId && local) {
              this.showFloatingText(`💚 +${amt}`, local.x, local.z, 'sf-float-uncommon');
            } else {
              const r = this.world?.remotes?.get?.(uid);
              if (r) this.showFloatingText(`💚 +${amt}`, r.smooth?.x ?? r.x ?? 0, r.smooth?.z ?? r.z ?? 0, 'sf-float-uncommon');
            }
          }
        }
      }
      return;
    }

    if (m.kind === 'zone_tick') {
      const pNow = performance.now();
      if (Array.isArray(m.hits)) {
        for (const hit of m.hits) {
          const [id, dealt, crit, monHp, newX, newZ] = hit;
          const mon = this.activeMonsters.get(id);
          if (mon) {
            if (Number.isFinite(monHp)) {
              mon.hp = monHp;
              mon._lastDamageAt = pNow;
            }
            if (Number.isFinite(newX) && Number.isFinite(newZ)) {
              mon.targetX = newX;
              mon.targetZ = newZ;
              mon.knockUntil = pNow + 220;
            }
            this._syncMonsterHpImmediate(mon);
            mon.hitFlashTimer = 0.12;
            if (dealt > 0) {
              this.showFloatingText(`-${dealt}`, mon.x, mon.z, crit ? 'sf-float-perfect' : 'sf-float-hit');
            }
          }
        }
      }
      if (m.hitStates || m.frozenIds) {
        this._applyMonsterHitStates(m.hitStates, m.frozenIds);
      }
      if (Array.isArray(m.heals)) {
        for (const [uid, amt] of m.heals) {
          if (amt > 0) {
            if (uid === localId && local) {
              this.showFloatingText(`💚 +${amt}`, local.x, local.z, 'sf-float-uncommon');
            } else {
              const r = this.world?.remotes?.get?.(uid);
              if (r) this.showFloatingText(`💚 +${amt}`, r.smooth?.x ?? r.x ?? 0, r.smooth?.z ?? r.z ?? 0, 'sf-float-uncommon');
            }
          }
        }
      }
      return;
    }

    if (m.kind === 'monster_skill') {
      const skillId = m.skillId || m.vfxId;
      const skDef = MONSTER_SKILLS[skillId];
      const level = Math.max(1, Math.min(5, Number(m.level) || 1));
      const isLocal = m.by === localId;
      const facing = m.facing || { x: 0, z: 1 };
      const pNow = performance.now();
      const isMobilitySkill = skillId === 'sk_tusk_rush' || skillId === 'sk_zephyr_vault';
      const hopHeight = skillId === 'sk_zephyr_vault' ? 0.92 : 0;

      if (isLocal && local && isMobilitySkill && Number.isFinite(m.x) && Number.isFinite(m.z)) {
        if (this.world?.reconcileLocalDash) {
          this.world.reconcileLocalDash(m.x, m.z, { hopHeight });
        } else {
          this.world?.setLocalPosition?.(m.x, m.z);
        }
      }
      if (isLocal && Array.isArray(m.skillCds)) {
        for (let si = 0; si < SF_SLOT_COUNT && si < m.skillCds.length; si++) {
          if (Number.isFinite(m.skillCds[si])) this.skillCds[si] = m.skillCds[si];
        }
      }
      if (m.buffs && (isLocal || (Array.isArray(m.partyBuffedIds) && m.partyBuffedIds.includes(localId)))) {
        if (isLocal) {
          this._applyServerBuffs(m.buffs);
        } else {
          // Party buffs only — the caster's own 🎶 Resonance window never transfers to allies
          const { resonanceUntil: _casterReso, ...partyBuffs } = m.buffs;
          this._applyServerBuffs(partyBuffs);
        }
      }

      // 🎶 Resonance callouts (prime on Sustain/Support casts, payoff on the next damaging skill)
      if (m.resonancePrimed || m.resonanceUsed) {
        let cx = m.x;
        let cz = m.z;
        if (isLocal && local) {
          cx = local.x;
          cz = local.z;
        } else if (!Number.isFinite(cx) || !Number.isFinite(cz)) {
          const rem = this.world?.remotes?.get?.(m.by);
          cx = rem?.smooth?.x ?? rem?.x ?? 0;
          cz = rem?.smooth?.z ?? rem?.z ?? 0;
        }
        if (m.resonancePrimed) {
          if (isLocal) {
            const nowSrv = Date.now() + (this.world?.serverOffset || 0);
            this._resonanceUntil = Math.max(this._resonanceUntil || 0, Number(m.buffs?.resonanceUntil) || (nowSrv + (RESONANCE?.windowMs || 5000)));
          }
          this.skillVfx?.spawnEffect?.({ vfxId: 'resonance_prime', level: 1, x: cx, z: cz, targetX: cx, targetZ: cz, facing: { x: 0, z: 1 } });
          const el = this.showFloatingText(`${RESONANCE?.icon || '🎶'} Resonance primed`, cx, cz, 'sf-float-uncommon');
          if (el) el.style.color = RESONANCE?.color || '#86EFAC';
        }
        if (m.resonanceUsed) {
          if (isLocal) this._resonanceUntil = 0;
          const el = this.showFloatingText(`${RESONANCE?.icon || '🎶'} Resonance!`, cx, cz, 'sf-float-reaction');
          if (el) {
            el.style.color = RESONANCE?.color || '#86EFAC';
            el.style.boxShadow = `0 0 14px ${(RESONANCE?.color || '#86EFAC')}88, 0 3px 10px rgba(0,0,0,0.5)`;
          }
        }
      }

      const dedupKey = `${skillId}:${m.skillSlot ?? 0}`;
      const alreadySpawnedLocally =
        isLocal &&
        this._lastLocalSkillFxKey === dedupKey &&
        pNow - (this._lastLocalSkillFxAt || 0) < 950;

      if (!alreadySpawnedLocally) {
        let casterRig = null;
        if (isLocal) {
          casterRig = local?.rig || null;
          casterRig?.setHeldTool?.(null);
          casterRig?.facing?.set?.(facing.x >= 0, facing.z < -0.35);
        } else {
          const rem = this.world?.remotes?.get?.(m.by);
          if (rem) {
            if (isMobilitySkill && Number.isFinite(m.x) && Number.isFinite(m.z)) {
              if (this.world?.startRemoteDash) {
                this.world.startRemoteDash(m.by, m.x, m.z, { durMs: 175, hopHeight });
              } else {
                this.world?.teleportRemote?.(m.by, m.x, m.z);
              }
            }
            casterRig = rem.rig || null;
            casterRig?.setHeldTool?.(null);
            casterRig?.facing?.set?.(facing.x >= 0, facing.z < -0.35);
            if (skDef) {
              this.showOverheadCastCallout(m.by, `${skDef.icon} ${skDef.name}!`);
            }
          }
        }

        const originX = m.startX ?? m.x ?? (local?.x || 0);
        const originZ = m.startZ ?? m.z ?? (local?.z || 0);
        this.skillVfx?.spawnEffect?.({
          vfxId: m.vfxId || skillId,
          level,
          x: originX,
          z: originZ,
          targetX: m.targetX ?? m.x ?? originX,
          targetZ: m.targetZ ?? m.z ?? originZ,
          facing,
          casterRig,
        });

        // Spawn persistent 3D ground indicator ring for duration-based zones (when not already predicted locally)
        const zx = m.targetX ?? m.x ?? (local?.x || 0);
        const zz = m.targetZ ?? m.z ?? (local?.z || 0);
        if (skillId === 'sk_pollen_ring') {
          this._spawnSkillZoneRing('pollen_ring', m.x ?? zx, m.z ?? zz, 4.4, 5000, null);
        } else if (skillId === 'sk_koi_whirlpool') {
          this._spawnSkillZoneRing('koi_whirlpool', zx, zz, 4.6, 4000, null);
        } else if (skillId === 'sk_sakura_tempest') {
          this._spawnSkillZoneRing('sakura_tempest', m.x ?? zx, m.z ?? zz, 5.6, 3000, m.by);
        } else if (skillId === 'sk_solar_meteor') {
          this._spawnSkillZoneRing('solar_burn', zx, zz, 4.4, 3000, null);
        }
      }

      if (Array.isArray(m.hits) && m.hits.length > 0) {
        const pend =
          this._pendingLocalSkill?.bySkill?.[skillId] ||
          (this._pendingLocalSkill && (!this._pendingLocalSkill.skillId || this._pendingLocalSkill.skillId === skillId)
            ? this._pendingLocalSkill
            : null);
        if (isLocal && pend && pNow - pend.at < 1500) {
          const firstArrival = !pend.applied;
          pend.applied = true;
          this._applyMonsterHits(m.hits, { facing, isSkill: true, showFloats: firstArrival });
        } else {
          this._applyMonsterHits(m.hits, { facing, isSkill: true, showFloats: true });
        }
        this._applyMonsterHitStates(m.hitStates, m.frozenIds);
      } else if (m.hitStates || m.frozenIds) {
        this._applyMonsterHitStates(m.hitStates, m.frozenIds);
      }

      if (Number(m.shieldHp) > 0) {
        const sx = m.x ?? (local?.x || 0);
        const sz = m.z ?? (local?.z || 0);
        this.showFloatingText(`🛡️ +${Math.round(m.shieldHp)} Shield!`, sx, sz, 'sf-float-uncommon');
      }
      if (Number(m.healAmount) > 0) {
        const hx = m.x ?? (local?.x || 0);
        const hz = m.z ?? (local?.z || 0);
        this.showFloatingText(`💚 +${Math.round(m.healAmount)}`, hx, hz, 'sf-float-uncommon');
      }
      return;
    }

    if (m.kind === 'skill_scroll_drop') {
      const skDef = MONSTER_SKILLS[m.skillId];
      if (!skDef) return;
      if (m.userId === localId) {
        const p = this._getProfile();
        if (p) {
          p.frontier = p.frontier || {};
          p.frontier.skills = p.frontier.skills || { unlocked: {}, equipped: [null, null, null, null] };
          p.frontier.skills.unlocked = p.frontier.skills.unlocked || {};
          p.frontier.skills.unlocked[m.skillId] = Number(m.newLevel) || 1;
          if (Number.isInteger(m.autoEquippedSlot) && m.autoEquippedSlot >= 0 && m.autoEquippedSlot < SF_SLOT_COUNT) {
            p.frontier.skills.equipped = sfPadEquipped(p.frontier.skills.equipped);
            p.frontier.skills.equipped[m.autoEquippedSlot] = m.skillId;
          }
          if (Number(m.essenceGain) > 0) {
            p.frontier.skills.essence = (Number(p.frontier.skills.essence) || 0) + Number(m.essenceGain);
          }
          if (Number(m.maxedGold) > 0) {
            p.gold = (Number(p.gold) || 0) + Number(m.maxedGold);
          }
          this.updateSkillButtons(p);
          if (this.skillModalOpen) this._renderSkillModalHtml(p);
        }
        this.playGatherSfx('break_rare');
        if (local) {
          this.punchCamera(0.08, 0.2);
          this._showUltRingVfx(local.x, local.z, 3.6, 0xFACC15);
          this.world?.fx?.emit?.('fx_stardust', local.x, 1.0, local.z, 16, {
            speed: 1.3, up: 1.4, size: 0.28, life: 0.85,
          });
        }
        this._showScrollDropBanner(m);
      } else {
        const rem = this.world?.remotes?.get?.(m.userId);
        if (rem) {
          this.showFloatingText(
            `📜 ${m.username || m.userId}: ${skDef.icon} ${skDef.name} Lv.${m.newLevel}!`,
            rem.smooth?.x ?? rem.x ?? 0,
            rem.smooth?.z ?? rem.z ?? 0,
            'sf-float-rare'
          );
        }
      }
    }
  }

  onPlayerHp(m) {
    if (!m || !m.id) return;
    const localId = this.world?.local?.id || this._getProfile()?.id;
    if (m.id === localId) {
      if (Number.isFinite(Number(m.regenPerSec)) && Number(m.regenPerSec) > 0) {
        this._vitalityRegenPerSec = Number(m.regenPerSec);
      }
      this._hasServerPlayerHp = true;
      const prevHp = Number(this.playerHp?.hp ?? m.hp);
      const nextHp = Number(m.hp ?? prevHp);
      const local = this.world?.local;
      if (local) {
        if (nextHp < prevHp - 0.5) {
          const lost = Math.max(1, Math.round(prevHp - nextHp));
          this.showFloatingText(`💔 -${lost}`, local.x, local.z, 'sf-float-hit');
        } else if (Number(m.vitalityTickHeal) > 0) {
          this.showFloatingText(`💚 +${Math.round(m.vitalityTickHeal)} HP`, local.x, local.z, 'sf-float-uncommon');
          this.world?.fx?.emit?.('fx_heart', local.x, 0.9, local.z, 5, { speed: 0.55, up: 1.0, size: 0.20, life: 0.6 });
        } else if (m.source !== 'vitality' && nextHp > prevHp + 3.5 && prevHp > 0) {
          const gained = Math.round(nextHp - prevHp);
          this.showFloatingText(`💚 +${gained}`, local.x, local.z, 'sf-float-uncommon');
        }
      }
      this.playerHp = { hp: m.hp, maxHp: m.maxHp, shield: m.shieldHp ?? m.shield ?? 0 };
      if (m.buffs && typeof m.buffs === 'object') this._applyServerBuffs(m.buffs);
      this.updatePlayerHpBar();
    } else {
      this._remoteHp.set(m.id, {
        hp: Number(m.hp ?? 100),
        maxHp: Math.max(1, Number(m.maxHp ?? 100)),
        shield: Math.max(0, Number(m.shieldHp ?? m.shield ?? 0)),
      });
    }
  }

  onPlayerDown(m) {
    if (!m || !m.id) return;
    const localId = this.world?.local?.id || this._getProfile()?.id;
    if (m.id === localId) {
      this.toast?.('💫 Knocked out — respawning at the outpost…', 4500);
      this.stopAutoAttack();
      this.stopAutoSwing();
      this._hasServerPlayerHp = true;
      this.playerHp = { hp: 0, maxHp: this.playerHp?.maxHp || 100, shield: 0 };
      this.updatePlayerHpBar();
    } else {
      const prev = this._remoteHp.get(m.id);
      this._remoteHp.set(m.id, { hp: 0, maxHp: prev?.maxHp || 100, shield: 0 });
    }
  }

  onPlayerRespawn(m) {
    if (!m || !m.id) return;
    const localId = this.world?.local?.id || this._getProfile()?.id;
    if (m.id === localId) {
      this._hasServerPlayerHp = true;
      this.playerHp = { hp: m.hp, maxHp: m.maxHp, shield: 0 };
      this.updatePlayerHpBar();
    } else {
      this._remoteHp.set(m.id, { hp: Number(m.hp ?? 100), maxHp: Math.max(1, Number(m.maxHp ?? 100)), shield: 0 });
    }
  }

  onOutpost(m) {
    if (!m) return;
    this.outpostState = m;
    const max = m.maxHp || 1000;
    const cur = Math.max(0, m.hp !== undefined ? m.hp : max);
    const pct = Math.max(0, Math.min(1, cur / max));
    const offline = Boolean(m.offline || cur <= 0);

    if (this.outpostStatue) {
      if (offline) {
        this.outpostStatue.material.color.setHex(0x555555);
        this.outpostStatue.material.roughness = 0.95;
      } else {
        this.outpostStatue.material.color.setHex(0xF0EDE6);
        this.outpostStatue.material.roughness = 0.32;
      }
    }

    if (this.outpostRing) {
      if (offline) {
        this.outpostRing.material.color.setHex(0x333333);
      } else {
        const col = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFB300 : 0xE53935;
        this.outpostRing.material.color.setHex(col);
      }
    }

    if (this.sanctuaryRing) {
      this.sanctuaryRing.visible = !offline;
    }
  }

  onInvasion(m) {
    if (!m) return;
    this.invasionState = m;
  }

  onBoss(m) {
    if (!m) return;
    if (m.event === 'expired') {
      this.activeBoss = null;
      this._bossTelegraphTimer = 0;
      if (this.bossBarEl) this.bossBarEl.style.display = 'none';
      return;
    }
    if (m.hp !== undefined) {
      const prevStage = this.activeBoss ? (this.activeBoss.stage || 0) : -1;
      const nextStage = m.stage || 0;
      this.activeBoss = m;
      if (this.bossBarEl) this.bossBarEl.style.display = 'block';
      if (this.bossNameEl) this.bossNameEl.textContent = `👑 ${m.name || 'Boss'}`;
      if (this.bossStageEl) this.bossStageEl.textContent = nextStage ? `Phase ${nextStage + 1} 🔥` : 'Phase 1';
      const cur = Math.max(0, Math.round(m.hp));
      const max = Math.max(1, Math.round(m.maxHp));
      const pct = Math.min(100, Math.max(0, (cur / max) * 100));
      if (this.bossFillEl) this.bossFillEl.style.width = `${pct}%`;
      if (this.bossTextEl) this.bossTextEl.textContent = `${cur} / ${max}`;
      this._syncBossGuardBar(m);
      let bossMask = Number(m.tagMask) || 0;
      if (!bossMask) {
        for (const bm of this.activeMonsters.values()) {
          if (bm && bm.isBoss) {
            bossMask = bm.tagMask || 0;
            break;
          }
        }
      }
      this._syncBossTagRow(bossMask);

      if (cur > 0 && nextStage > prevStage) {
        this._lastBossStage = nextStage;
        this._bossTelegraphTimer = 1.45;
        this.punchCamera(0.09, 0.22);
      }

      if (cur <= 0) {
        this.activeBoss = null;
        this._bossTelegraphTimer = 0;
        if (this.bossBarEl) this.bossBarEl.style.display = 'none';
      }
    }
  }

  /** Boss/Elite Guard (poise) bar under #sf-boss-bar. Shows 💥 BROKEN! while breakUntil is active. */
  _syncBossGuardBar(m) {
    const el = this.bossGuardEl;
    if (!el) return;
    const maxPoise = Number(m?.maxPoise) || 0;
    const rawPoise = m?.poise;
    if (!m || rawPoise === null || rawPoise === undefined || (maxPoise <= 0 && !(rawPoise >= 0) && rawPoise !== -1)) {
      el.style.display = 'none';
      return;
    }
    const now = Date.now() + (this.world?.serverOffset || 0);
    const breakUntil = Number(m.breakUntil) || 0;
    const broken = rawPoise === -1 || breakUntil > now;
    const pct = broken
      ? 0
      : Math.max(0, Math.min(100, maxPoise > 0 ? (Number(rawPoise) / maxPoise) * 100 : Number(rawPoise)));
    el.style.display = 'flex';
    el.classList.toggle('is-broken', broken);
    if (this.bossGuardFillEl) this.bossGuardFillEl.style.width = broken ? '100%' : `${pct}%`;
    if (this.bossGuardLblEl) {
      this.bossGuardLblEl.textContent = broken
        ? `💥 BROKEN!${breakUntil > now ? ` ${Math.ceil((breakUntil - now) / 1000)}s` : ''}`
        : `🛡️ Guard ${Math.round(pct)}%`;
    }
    if (this._bossGuardTimer) {
      clearTimeout(this._bossGuardTimer);
      this._bossGuardTimer = null;
    }
    if (broken && breakUntil > now) {
      // Tick the countdown once per second until the break window closes
      this._bossGuardTimer = setTimeout(() => {
        this._bossGuardTimer = null;
        if (this.activeBoss) this._syncBossGuardBar(this.activeBoss);
      }, Math.min(1000, Math.max(50, breakUntil - now + 20)));
    }
  }

  onBossDefeated(m) {
    if (!m) return;
    this.activeBoss = null;
    if (this.bossBarEl) this.bossBarEl.style.display = 'none';

    const localId = this.world?.local?.id;
    const myLoot = m.loot && localId ? m.loot[localId] : null;
    if (myLoot) {
      const items = Object.entries(myLoot.items || {}).map(([k, v]) => `+${v} ${EMOJI_MAP[k] || '📦'}`).join('  ');
      let msg = `🏆 Boss Defeated! Loot: ${items}`;
      if (myLoot.charm) {
        msg += ` | 🌟 Found Charm: ${myLoot.charm.name} (${myLoot.charm.grade || ''})!`;
      }
      this.toast?.(msg, 5000);
      const local = this.world?.local;
      if (local) this.showFloatingText(msg, local.x, local.z);
    }
  }

  onUlt(m) {
    if (!m) return;
    const effectColors = {
      freeze: 0x00E5FF,
      heal_field: 0x4CAF50,
      shield: 0xFF80AB,
      nuke: 0xFF5722,
      cone: 0xFF5722,
      stun: 0x9C27B0,
      haste: 0xFFEB3B,
      slow: 0x5C6BC0,
      pull: 0x26C6DA,
      summon: 0xFFD54F,
    };
    const color = effectColors[m.effect] || 0xE8B85A;
    this._showUltRingVfx(m.x, m.z, m.radius || 6, color);
    this.skillVfx?.spawnEffect?.({
      vfxId: 'ult_charm_sanctuary',
      level: 1,
      x: m.x,
      z: m.z,
      casterRig: m.by === this.world?.local?.id ? this.world?.local?.rig : this.world?.remotes?.get?.(m.by)?.rig,
    });
    if (m.by) {
      this.showOverheadCastCallout(m.by, `✨ ${m.name || 'Ultimate'}!`, 1900);
    } else {
      this.showFloatingText(`✨ ${m.name || 'Ultimate'}!`, m.x, m.z);
    }
  }

  onNodeHit(m) {
    if (!m || !m.nodeId) return;
    const nodeId = String(m.nodeId);
    const node = (this.layout?.nodes || []).find((n) => String(n.id) === nodeId);
    if (node) {
      node.hp = m.hp;
    }

    const typeDef = NODE_TYPES[node?.type] || {};
    const maxHp = Number(m.maxHp) || Number(typeDef.hp) || 8;
    const curHp = Math.max(0, Number(m.hp) || 0);
    const perfectCount = Number(m.perfectCount) || 0;
    const rareBoostPct = Number(m.rareBoostPct) || 0;

    if (this.rarityBoostEl && this.targetNode && String(this.targetNode.id) === nodeId) {
      const totalChance = Math.min(95, 38 + rareBoostPct);
      this.rarityBoostEl.textContent = perfectCount > 0
        ? `🔥 Perfect ×${perfectCount} • 🎲 Rare+ ${totalChance}%`
        : `🎲 Rare+ Chance: ${totalChance}%`;
    }

    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      let strikerX = this.world?.local?.x ?? mesh.position.x;
      if (m.by && m.by !== this.world?.local?.id) {
        const rem = this.world?.remotes?.get?.(m.by);
        if (rem) {
          strikerX = rem.smooth?.x ?? rem.x ?? strikerX;
          if (rem.rig) {
            const rTool = typeDef.tool || 'pickaxe';
            const rSwing = rTool === 'axe' ? 'chop_swing' : rTool === 'staff' ? 'staff_cast' : 'mine_swing';
            rem.rig.facing?.set?.(mesh.position.x >= strikerX, mesh.position.z < (rem.smooth?.z ?? rem.z ?? 0) - 0.35);
            rem.rig.setHeldTool?.(rTool, 1);
            rem.rig.triggerAttack?.(rSwing, { dur: 0.72 });
          }
        }
      }
      mesh.userData.shakeTimer = m.perfect ? 0.38 : 0.25;
      mesh.userData.pulseTimer = m.perfect ? 0.38 : 0.26;
      mesh.userData.hitFlashTimer = m.perfect ? 0.18 : 0.12;
      mesh.userData.hitDir = strikerX <= mesh.position.x ? -1 : 1;

      // Update 3D Node HP & Rarity Charge Bar
      if (mesh.userData.hpBar && mesh.userData.hpFill) {
        mesh.userData.hpBar.visible = true;
        const pct = Math.max(0.05, Math.min(1, curHp / Math.max(1, maxHp)));
        mesh.userData.hpFill.scale.x = pct;
        mesh.userData.hpFill.position.x = -(1 - pct) * 0.52;
        const chargeColor = perfectCount >= 4
          ? 0xFACC15
          : perfectCount >= 2
          ? 0x38BDF8
          : perfectCount >= 1
          ? 0x34D399
          : 0xE8B85A;
        mesh.userData.hpFill.material.color.setHex(chargeColor);
        if (mesh.userData.auraRing) {
          mesh.userData.auraRing.material.color.setHex(chargeColor);
          mesh.userData.auraRing.material.opacity = Math.min(0.85, 0.40 + perfectCount * 0.12);
        }
      }

      const toolIcon = typeDef.tool === 'axe' ? '🪓' : typeDef.tool === 'staff' ? '✨' : '⛏️';
      const sfxKind = typeDef.tool === 'axe' ? 'hit_axe' : typeDef.tool === 'staff' ? 'hit_staff' : 'hit_pickaxe';
      this.playGatherSfx(sfxKind);
      this._emitNodeMaterialFx(node?.type, mesh.position.x, mesh.position.z, Boolean(m.perfect), false);
      if (m.perfect) {
        this.punchCamera(0.055, 0.14);
        this.showFloatingText(
          `⚡ PERFECT! ×1.5 (+${Math.max(12, rareBoostPct)}% Rare ⬆️)`,
          mesh.position.x,
          mesh.position.z,
          'sf-float-perfect'
        );
      } else {
        this.showFloatingText(
          `${toolIcon} -1 (${curHp}/${maxHp})`,
          mesh.position.x,
          mesh.position.z,
          'sf-float-hit'
        );
      }
    }
  }

  onNodeBreak(m) {
    if (!m || !m.nodeId) return;
    const nodeId = String(m.nodeId);
    const node = (this.layout?.nodes || []).find((n) => String(n.id) === nodeId);
    if (node) {
      node.hp = 0;
      node.depletedUntil = m.depletedUntil || (Date.now() + (this.world?.serverOffset || 0) + 10000);
    }

    const wasMyTarget = Boolean(this.targetNode && String(this.targetNode.id) === nodeId);
    if (wasMyTarget) {
      this.stopAutoSwing();
    }

    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      this._setNodeDepletedMesh(mesh, true);
    }
    if (node) {
      this._emitNodeMaterialFx(node.type, node.x, node.z, true, true);
    }

    const localId = this.world?.local?.id;
    const userShare = m.shares && localId ? m.shares[localId] : null;
    const parts = [];

    if (userShare && typeof userShare === 'object') {
      for (const [mat, count] of Object.entries(userShare)) {
        if (count > 0) {
          const emoji = EMOJI_MAP[mat] || '📦';
          parts.push(`+${count} ${emoji}`);
        }
      }
    }

    if (m.rares && localId && m.rares[localId]) {
      for (const [mat, count] of Object.entries(m.rares[localId])) {
        if (count > 0) {
          const emoji = EMOJI_MAP[mat] || '✨';
          parts.push(`+${count} ${emoji}`);
        }
      }
    }

    if (parts.length > 0 && node) {
      this._feverStreak = (this._feverStreak || 0) + 1;
      const coupleSync = Array.isArray(m.coupleResonanceUsers) && m.coupleResonanceUsers.includes(localId);
      const rarity = m.rarity || { id: 'common', badge: '⚪', label: 'Harvest', mult: 1 };
      let prefix = coupleSync ? '💞 COUPLE SYNC (+25%)!  ' : '';
      let extraClass = coupleSync ? 'sf-float-rare' : '';

      if (coupleSync) {
        this._showUltRingVfx(node.x, node.z, 3.6, 0xF472B6);
      }

      if (rarity.id === 'epic') {
        this.playGatherSfx('break_epic');
        prefix += `${rarity.badge || '🌟'} EPIC JACKPOT (${rarity.mult}×)!  `;
        extraClass = 'sf-float-epic';
        this._showUltRingVfx(node.x, node.z, 4.8, 0xFACC15);
        this.world?.fx?.emit?.('fx_star', node.x, 1.2, node.z, 18, {
          speed: 1.4,
          up: 1.6,
          size: 0.32,
          life: 0.75,
        });
        this.toast?.(`🌟 EPIC JACKPOT HARVEST! ${parts.join('  ')}`, 3500);
      } else if (rarity.id === 'rare') {
        this.playGatherSfx('break_rare');
        prefix += `${rarity.badge || '🔵'} RARE VEIN (${rarity.mult}×)!  `;
        extraClass = 'sf-float-rare';
        this._showUltRingVfx(node.x, node.z, 3.2, 0x38BDF8);
        this.world?.fx?.emit?.('fx_star', node.x, 1.1, node.z, 12, {
          speed: 1.1,
          up: 1.3,
          size: 0.25,
          life: 0.6,
        });
      } else if (rarity.id === 'uncommon') {
        this.playGatherSfx('break_common');
        prefix += `${rarity.badge || '🟢'} FINE HARVEST (${rarity.mult}×)!  `;
        extraClass = 'sf-float-uncommon';
        this.world?.fx?.emit?.('fx_star', node.x, 1.0, node.z, 8, {
          speed: 0.85,
          up: 1.1,
          size: 0.2,
          life: 0.5,
        });
      } else {
        this.playGatherSfx(coupleSync ? 'break_rare' : 'break_common');
      }

      this.showFloatingText(`${prefix}${parts.join('  ')}`, node.x, node.z, extraClass);
      this.punchCamera(rarity.id === 'epic' ? 0.11 : rarity.id === 'rare' ? 0.085 : 0.06, 0.20);
      const local = this.world?.local;
      if (local && this.world?.fx?.emitTo) {
        this.world.fx.emitTo('fx_star', node.x, 1.0, node.z, local.x, 0.9, local.z, 9, {
          arc: 1.5,
          time: 0.46,
          size: rarity.id === 'epic' ? 0.28 : 0.23,
        });
      }
      const mergedLoot = { ...(userShare || {}), ...(m.rares?.[localId] || {}) };
      this.spawnLootMagnets(mergedLoot, node.x, node.z);
      this._syncRuneButtonState();
    }

    // 1-Thumb Auto-Chain: ONLY when Auto is toggled ON, walk to the next closest node after harvest!
    if (this.autoGatherEnabled && (wasMyTarget || parts.length > 0) && this.active && (this.energy?.cur || 0) >= 2) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || !this.autoGatherEnabled || this.targetNode || this.targetMonster || this.targetGate) return;
        this.findAndWalkToNextNode(this.preferredTargetType);
      }, 420);
    }
  }

  showFloatingText(text, wx, wz, extraClass = '') {
    if (!this.floatContainerEl || typeof document === 'undefined') return;

    const el = document.createElement('div');
    el.className = extraClass ? `sf-floating-item ${extraClass}` : 'sf-floating-item';
    el.textContent = text;

    const s = this.world?.worldToScreen?.(wx, 2.58, wz, this._projTmp);
    const sx = s ? s.x : window.innerWidth / 2;
    const sy = s ? s.y : window.innerHeight / 2;
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;

    this.floatContainerEl.appendChild(el);
    const life = extraClass === 'sf-float-epic' ? 2.6 : extraClass === 'sf-float-hit' ? 1.1 : 1.9;
    this.floatingTexts.push({ el, wx, wz, age: 0, life });
    return el;
  }

  spawnLootMagnets(itemsObj, wx, wz) {
    if (!this.floatContainerEl || typeof document === 'undefined' || !itemsObj) return;
    const icons = [];
    for (const [mat, count] of Object.entries(itemsObj)) {
      const n = Math.min(3, Math.max(1, Math.ceil(Number(count || 0) / 2)));
      const emo = EMOJI_MAP[mat] || '📦';
      for (let i = 0; i < n && icons.length < 6; i++) icons.push(emo);
    }
    const s = this.world?.worldToScreen?.(wx, 1.0, wz, this._projTmp);
    const startX = s ? s.x : window.innerWidth / 2;
    const startY = s ? s.y : window.innerHeight / 2;

    icons.forEach((emo, idx) => {
      const el = document.createElement('div');
      el.className = 'sf-loot-magnet';
      el.textContent = emo;
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.transform = `translate3d(${startX.toFixed(1)}px, ${startY.toFixed(1)}px, 0) translate(-50%, -50%)`;
      this.floatContainerEl.appendChild(el);
      const angle = ((idx - (icons.length - 1) / 2) * 0.55) + (Math.random() - 0.5) * 0.25;
      const spreadX = Math.sin(angle) * (42 + Math.random() * 22);
      const peakY = -(55 + Math.random() * 28);
      this.lootMagnets.push({
        el,
        startX,
        startY,
        spreadX,
        peakY,
        delay: idx * 0.045,
        age: 0,
        life: 0.62,
      });
    });
  }

  _showDeathPuff(x, z, isBoss) {
    const fx = this.world?.fx;
    if (!fx?.emit) return;
    fx.emit('fx_shockwave', x, 0.55, z, 1, {
      speed: 0.05, up: 0.05, size: isBoss ? 1.8 : 0.9, sizeEnd: isBoss ? 3.2 : 1.7, life: 0.35, tint: [1.0, 0.72, 0.38],
    });
    fx.emit('fx_stardust', x, 0.65, z, isBoss ? 18 : 9, {
      speed: isBoss ? 1.4 : 1.05,
      up: 1.25,
      size: isBoss ? 0.34 : 0.2,
      life: 0.55,
    });
  }

  _emitNodeMaterialFx(nodeType, x, z, isPerfect = false, isBreak = false) {
    const fx = this.world?.fx;
    if (!fx?.emit) return;
    const nBase = isBreak ? 11 : isPerfect ? 7 : 4;
    const up = isBreak ? 1.35 : isPerfect ? 1.15 : 0.85;
    const speed = isBreak ? 1.15 : isPerfect ? 0.9 : 0.55;
    const t = String(nodeType || 'tree');

    if (t === 'tree') {
      fx.emit('fx_leaf', x, 1.35, z, nBase, { speed, up, gravity: 1.6, size: 0.24, life: 0.65 });
      fx.emit('fx_chip', x, 0.9, z, Math.max(2, nBase - 3), { speed: speed * 0.9, up: up * 0.8, gravity: 3.2, size: 0.16, life: 0.48, tint: [0.82, 0.62, 0.38] });
    } else if (t === 'boulder') {
      fx.emit('fx_chip', x, 0.95, z, nBase + 1, { speed: speed * 1.1, up, gravity: 3.8, size: 0.19, life: 0.52, tint: [0.82, 0.85, 0.9] });
    } else if (t === 'wheat') {
      fx.emit('fx_feather', x, 1.0, z, nBase, { speed: speed * 0.85, up: up * 0.95, gravity: 1.2, size: 0.22, life: 0.65, tint: [1.0, 0.88, 0.42] });
    } else if (t === 'herb') {
      fx.emit('fx_petal', x, 0.85, z, nBase, { speed: speed * 0.8, up, gravity: 1.1, size: 0.21, life: 0.65 });
      fx.emit('fx_leaf', x, 0.75, z, Math.max(2, nBase - 3), { speed: speed * 0.75, up: 0.8, size: 0.18, life: 0.55 });
    } else if (t === 'crystal' || t === 'quartz') {
      const tint = t === 'quartz' ? [0.85, 0.62, 1.0] : [0.45, 0.92, 1.0];
      fx.emit('fx_stardust', x, 1.1, z, nBase + 2, { speed: speed * 1.05, up: up * 1.1, size: 0.24, life: 0.6, tint });
      fx.emit('fx_chip', x, 0.95, z, Math.max(2, nBase - 3), { speed, up: 0.9, gravity: 3.0, size: 0.16, life: 0.48, tint });
    } else if (t === 'mithril') {
      fx.emit('fx_stardust', x, 1.15, z, nBase + 3, { speed: speed * 1.1, up: up * 1.15, size: 0.26, life: 0.65, tint: [0.76, 0.62, 1.0] });
      fx.emit('fx_rune', x, 1.0, z, isBreak ? 5 : 2, { speed: 0.5, up: 1.1, size: 0.22, life: 0.6, tint: [0.88, 0.75, 1.0] });
    } else if (t === 'sakura_tree') {
      fx.emit('fx_petal', x, 1.45, z, nBase + 2, { speed: speed * 0.9, up: up * 1.05, gravity: 0.95, size: 0.25, life: 0.75, tint: [1.0, 0.68, 0.85] });
      fx.emit('fx_chip', x, 0.9, z, Math.max(2, nBase - 3), { speed: speed * 0.85, up: up * 0.8, gravity: 3.0, size: 0.16, life: 0.48, tint: [0.88, 0.62, 0.58] });
    } else if (t === 'pearl_clam') {
      fx.emit('fx_stardust', x, 0.95, z, nBase + 2, { speed: speed * 1.05, up: up * 1.1, size: 0.25, life: 0.62, tint: [0.58, 0.96, 1.0] });
      fx.emit('fx_chip', x, 0.85, z, Math.max(2, nBase - 3), { speed, up: 0.85, gravity: 2.8, size: 0.16, life: 0.46, tint: [0.95, 0.88, 0.96] });
    } else if (t === 'cloud_lotus') {
      fx.emit('fx_petal', x, 0.95, z, nBase + 1, { speed: speed * 0.85, up: up * 1.05, gravity: 0.85, size: 0.23, life: 0.7, tint: [1.0, 0.82, 0.94] });
      fx.emit('fx_feather', x, 0.85, z, Math.max(2, nBase - 3), { speed: speed * 0.75, up: 0.9, size: 0.2, life: 0.6, tint: [0.88, 0.98, 1.0] });
    } else if (t === 'orichalcum') {
      fx.emit('fx_stardust', x, 1.15, z, nBase + 3, { speed: speed * 1.15, up: up * 1.2, size: 0.26, life: 0.62, tint: [1.0, 0.72, 0.25] });
      fx.emit('fx_chip', x, 0.95, z, Math.max(3, nBase - 2), { speed: speed * 1.1, up: 0.95, gravity: 3.4, size: 0.18, life: 0.5, tint: [1.0, 0.58, 0.18] });
    } else if (t === 'astral_prism') {
      fx.emit('fx_stardust', x, 1.2, z, nBase + 3, { speed: speed * 1.1, up: up * 1.15, size: 0.27, life: 0.68, tint: [0.78, 0.62, 1.0] });
      fx.emit('fx_rune', x, 1.05, z, isBreak ? 6 : 3, { speed: 0.55, up: 1.15, size: 0.24, life: 0.65, tint: [1.0, 0.88, 0.45] });
    } else {
      fx.emit('fx_star', x, 1.0, z, nBase, { speed, up, size: 0.2, life: 0.45 });
    }

    if (isPerfect || isBreak) {
      fx.emit('fx_shockwave', x, 0.75, z, 1, {
        speed: 0.04, up: 0.04, size: isBreak ? 1.1 : 0.75, sizeEnd: isBreak ? 2.1 : 1.35, life: 0.28,
        tint: isBreak ? [1.0, 0.9, 0.48] : [1.0, 0.95, 0.65],
      });
    }
  }

  _spawnSlashArc(fromX, fromZ, toX, toZ, tool = 'pickaxe', empowered = false) {
    if (!this.root || (this._slashArcs && this._slashArcs.length >= 8)) return;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const yaw = Math.atan2(dx, dz);
    const isStaff = tool === 'staff';
    const color = empowered
      ? 0xFFF176
      : isStaff
      ? 0x67E8F9
      : tool === 'axe'
      ? 0xFCD34D
      : 0xE2E8F0;

    const rInner = isStaff ? 0.55 : 0.68;
    const rOuter = isStaff ? 1.28 : 1.22;
    const arcGeo = new THREE.RingGeometry(rInner, rOuter, 18, 1, -Math.PI * 0.42, Math.PI * 0.84);
    arcGeo.rotateX(-Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: empowered ? 0.92 : 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(arcGeo, arcMat);
    const midX = isStaff ? fromX + (dx * 0.45) : fromX + Math.sin(yaw) * 0.42;
    const midZ = isStaff ? fromZ + (dz * 0.45) : fromZ + Math.cos(yaw) * 0.42;
    mesh.position.set(midX, 0.68, midZ);
    mesh.rotation.y = yaw - Math.PI * 0.5;
    mesh.rotation.z = isStaff ? 0 : (Math.random() > 0.5 ? 0.22 : -0.22);
    this.root.add(mesh);
    this._slashArcs ||= [];
    this._slashArcs.push({
      mesh,
      isStaff,
      dx: isStaff ? (dx / (Math.hypot(dx, dz) || 1)) * 4.5 : 0,
      dz: isStaff ? (dz / (Math.hypot(dx, dz) || 1)) * 4.5 : 0,
      age: 0,
      life: isStaff ? 0.26 : 0.20,
    });
  }

  _buildLightShafts(regionOrHollow) {
    const reg = typeof regionOrHollow === 'string' ? regionOrHollow : (regionOrHollow ? 'hollow' : 'meadow');
    this.lightShafts = [];
    const configs =
      reg === 'caldera'
        ? [
            { x: -20, z: 9, w: 4.0, h: 10.5, col: 0xFB923C, op: 0.095, tilt: -0.18 },
            { x: 20, z: 9, w: 3.8, h: 10.0, col: 0xFDE047, op: 0.085, tilt: 0.16 },
            { x: 0, z: 5.5, w: 4.2, h: 9.6, col: 0xC084FC, op: 0.09, tilt: -0.14 },
            { x: 0, z: -24, w: 4.8, h: 11.0, col: 0xFBBF24, op: 0.10, tilt: 0.15 },
          ]
        : reg === 'reef'
        ? [
            { x: 0, z: 5.0, w: 4.4, h: 10.2, col: 0xFBCFE8, op: 0.095, tilt: -0.24 },
            { x: -20, z: 9, w: 4.0, h: 9.8, col: 0xF9A8D4, op: 0.09, tilt: -0.22 },
            { x: 20, z: 9, w: 3.8, h: 9.6, col: 0x99F6E4, op: 0.085, tilt: 0.20 },
            { x: 0, z: -24, w: 4.6, h: 10.6, col: 0xFDE68A, op: 0.09, tilt: -0.18 },
          ]
        : reg === 'hollow'
        ? [
            { x: -18, z: 1, w: 3.4, h: 9.5, col: 0x67E8F9, op: 0.085, tilt: -0.22 },
            { x: 18, z: -9, w: 3.6, h: 10.0, col: 0xA855F7, op: 0.08, tilt: 0.20 },
            { x: 0, z: 5.5, w: 4.0, h: 9.0, col: 0x38BDF8, op: 0.09, tilt: -0.15 },
            { x: 0, z: -24, w: 4.4, h: 10.5, col: 0xC084FC, op: 0.075, tilt: 0.18 },
          ]
        : [
            { x: 0, z: 3.5, w: 4.4, h: 10.5, col: 0xFFF3B0, op: 0.095, tilt: -0.28 },
            { x: 19, z: 11, w: 4.0, h: 9.8, col: 0xFDE68A, op: 0.08, tilt: -0.26 },
            { x: -20, z: 7, w: 3.8, h: 9.6, col: 0xFEF08A, op: 0.075, tilt: -0.28 },
            { x: 22, z: -13, w: 3.4, h: 9.2, col: 0xBAE6FD, op: 0.08, tilt: -0.24 },
          ];

    let gradTex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 128;
      const g = c.getContext('2d');
      if (g && typeof g.createLinearGradient === 'function') {
        const lg = g.createLinearGradient(0, 0, 0, 128);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.35, 'rgba(255,255,255,0.65)');
        lg.addColorStop(0.82, 'rgba(255,255,255,0.95)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(0, 0, 32, 128);
        gradTex = new THREE.CanvasTexture(c);
        gradTex.userData = { ...gradTex.userData, ownedByFrontier: true };
      }
    }

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const geo = new THREE.PlaneGeometry(cfg.w, cfg.h);
      geo.translate(0, cfg.h * 0.45, 0);
      const mat = new THREE.MeshBasicMaterial({
        map: gradTex,
        color: cfg.col,
        transparent: true,
        opacity: cfg.op,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cfg.x, 0.05, cfg.z);
      mesh.rotation.x = -(this.world?.pitch || 0.58) * 0.55;
      mesh.rotation.z = cfg.tilt;
      mesh.userData = { baseOp: cfg.op, phase: i * 1.7 };
      this.root.add(mesh);
      this.lightShafts.push(mesh);
    }
  }

  _buildBreadcrumbs() {
    this._breadcrumbs = [];
    const dotGeo = new THREE.CircleGeometry(0.22, 14);
    dotGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFDE047 : 0x7DD3FC,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.visible = false;
      this.root.add(dot);
      this._breadcrumbs.push(dot);
    }
  }

  _buildBossTelegraph() {
    const group = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(4.15, 4.45, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xEF4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fillGeo = new THREE.CircleGeometry(4.2, 48);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xF43F5E,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    group.add(fillMesh);
    group.add(new THREE.Mesh(ringGeo, ringMat));
    group.visible = false;
    group.userData = { ringMat, fillMat, fillMesh };
    this.bossTelegraphRing = group;
    this.root.add(group);
  }

  punchCamera(intensity = 0.075, dur = 0.16) {
    this._camShakeIntensity = Math.max(this._camShakeIntensity || 0, intensity);
    this._camShakeTimer = Math.max(this._camShakeTimer || 0, dur);
  }

  _buildTargetReticle() {
    const group = new THREE.Group();
    const outerGeo = new THREE.RingGeometry(0.95, 1.14, 32);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xFFD54F,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    const innerGeo = new THREE.RingGeometry(0.62, 0.72, 6);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xFFF9C4,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    group.position.set(0, 0.04, 0);
    group.visible = false;
    group.userData = { outerMat, innerMat, innerMesh };
    this.targetRing = group;
    this.root.add(group);
  }

  _buildAmbientParticles(regionOrHollow) {
    const reg = typeof regionOrHollow === 'string' ? regionOrHollow : (regionOrHollow ? 'hollow' : 'meadow');
    const count = 64;
    const positions = new Float32Array(count * 3);
    const hs = (this.halfSize || 36) - 2;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * hs;
      positions[i * 3 + 1] = 0.35 + Math.random() * 2.8;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * hs;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let tex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      if (typeof g.createRadialGradient === 'function') {
        const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
        if (reg === 'caldera') {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.35, '#FDE047');
          grd.addColorStop(0.72, 'rgba(249, 115, 22, 0.72)');
          grd.addColorStop(1, 'rgba(249, 115, 22, 0)');
        } else if (reg === 'reef') {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.4, '#FBCFE8');
          grd.addColorStop(0.75, 'rgba(244, 114, 182, 0.68)');
          grd.addColorStop(1, 'rgba(244, 114, 182, 0)');
        } else if (reg === 'hollow') {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.35, '#6FE0F0');
          grd.addColorStop(0.7, 'rgba(156, 123, 224, 0.65)');
          grd.addColorStop(1, 'rgba(111, 224, 240, 0)');
        } else {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.35, '#FFE885');
          grd.addColorStop(0.7, 'rgba(240, 184, 72, 0.65)');
          grd.addColorStop(1, 'rgba(240, 184, 72, 0)');
        }
        g.fillStyle = grd;
      } else {
        g.fillStyle = reg === 'caldera' ? '#FBBF24' : reg === 'reef' ? '#F9A8D4' : reg === 'hollow' ? '#6FE0F0' : '#FFE885';
      }
      g.fillRect(0, 0, 32, 32);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.userData = { ...tex.userData, ownedByFrontier: true };
    }

    const ptColor =
      reg === 'caldera' ? 0xFCD34D :
      reg === 'reef' ? 0xFCE7F3 :
      reg === 'hollow' ? 0x9EEFFF : 0xFFF2A6;
    const mat = new THREE.PointsMaterial({
      map: tex,
      color: ptColor,
      size: reg === 'caldera' || reg === 'reef' ? 0.34 : reg === 'hollow' ? 0.34 : 0.28,
      transparent: true,
      opacity: reg === 'caldera' ? 0.86 : reg === 'reef' ? 0.84 : reg === 'hollow' ? 0.82 : 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ambientGeo = geo;
    this.ambientMat = mat;
    this.ambientPoints = new THREE.Points(geo, mat);
    this.root.add(this.ambientPoints);
  }

  // ------------------------------------------------------------------ Energy & HP HUD
  setEnergy(energy) {
    if (energy && typeof energy === 'object') {
      this.energy = {
        cur: Number.isFinite(energy.cur) ? energy.cur : this.energy.cur,
        max: Number.isFinite(energy.max) ? energy.max : this.energy.max,
      };
    } else if (Number.isFinite(energy)) {
      this.energy.cur = energy;
    }
    this.updateHud();
  }

  updatePlayerHpBar() {
    if (!this.hpBarFillEl || !this.hpBarTextEl) return;
    const cur = Math.max(0, Math.round(this.playerHp.hp));
    const max = Math.max(1, Math.round(this.playerHp.maxHp));
    const shield = Math.max(0, Math.round(this.playerHp.shield || 0));
    const pct = Math.min(100, Math.max(0, (cur / max) * 100));
    this.hpBarFillEl.style.width = `${pct}%`;
    if (this.hpBarEl) {
      this.hpBarEl.classList.toggle('low', pct <= 25 && !this._inSanctuary);
      this.hpBarEl.classList.toggle('mid', pct > 25 && pct <= 55 && !this._inSanctuary);
    }
    if (this.hpShieldFillEl) {
      const shieldPct = Math.min(100, Math.max(0, (shield / max) * 100));
      this.hpShieldFillEl.style.width = `${shieldPct}%`;
    }
    const regen =
      this._vitalityRegenPerSec ||
      Number(skyFrontierMods(computeUniversalStats(this._getProfile() || {}).total || {}).hpRegenPerSec) ||
      0;
    const sanctTag = this._inSanctuary && cur < max ? ' ✨' : '';
    if (shield > 0) {
      this.hpBarTextEl.textContent = `${cur}/${max} 🛡️+${shield}${sanctTag}`;
    } else if (cur < max && cur > 0 && !this._inSanctuary && regen > 0) {
      this.hpBarTextEl.textContent = `${cur}/${max} +${regen.toFixed(1)}/s`;
    } else {
      this.hpBarTextEl.textContent = `${cur}/${max}${sanctTag}`;
    }
  }

  updateHud() {
    if (this.vialTextEl) {
      const cur = Math.max(0, Math.floor(this.energy.cur));
      const max = Math.max(1, Math.floor(this.energy.max));
      this.vialTextEl.textContent = `⚡ ${cur}/${max}`;
      if (this.vialEl) {
        this.vialEl.classList.toggle('low', cur <= 20);
      }
      if (this.vialLiquidEl) {
        const pct = Math.min(100, Math.max(0, (cur / max) * 100));
        this.vialLiquidEl.style.width = `${pct}%`;
      }
    }

    this.updateBagPill();
    this.updateBountyHud();

    if (this.regionNameEl && this.layout) {
      this.regionNameEl.textContent = this.layout.regionName || this.layout.regionId || 'Sky Frontier';
    }

    if (this.playersEl && this.layout) {
      const curP = this.layout.players || 1;
      const maxP = this.layout.maxPlayers || 10;
      this.playersEl.textContent = `👥 ${curP}/${maxP}`;
    }
  }

  // ------------------------------------------------------------------ Frame Update
  update(dt = 0.016, camera = null) {
    if (!this.active) return;
    this.elapsed += dt;

    const now = Date.now() + (this.world?.serverOffset || 0);
    const pNow = performance.now();
    const local = this.world?.local;
    const curReg = this._currentRegionId();
    const hc = this._hudCache || (this._hudCache = {});

    // 0. Camera micro-punch & ambient world particles
    if (this._camShakeTimer > 0) {
      this._camShakeTimer = Math.max(0, this._camShakeTimer - dt);
      const s = (this._camShakeTimer / 0.18) * (this._camShakeIntensity || 0.07);
      this.root.position.x = (Math.random() - 0.5) * s * 2;
      this.root.position.z = (Math.random() - 0.5) * s * 2;
    } else if (this.root.position.x !== 0 || this.root.position.z !== 0) {
      this.root.position.set(0, 0, 0);
      this._camShakeIntensity = 0;
    }

    if (this.ambientGeo) {
      const pos = this.ambientGeo.attributes.position.array;
      const hs = (this.halfSize || 36) - 2;
      const dtf = Math.min(dt || 0.016, 0.1) * 60;
      for (let i = 0; i < 64; i++) {
        const idx = i * 3;
        pos[idx] += Math.sin(this.elapsed * 1.1 + i * 1.7) * 0.014 * dtf;
        if (curReg === 'caldera') {
          pos[idx + 1] += (0.012 + Math.abs(Math.sin(i * 1.9)) * 0.008) * dtf;
        } else if (curReg === 'reef') {
          pos[idx + 1] -= 0.007 * dtf;
          pos[idx] += 0.008 * dtf;
        } else {
          pos[idx + 1] += Math.cos(this.elapsed * 1.5 + i * 2.3) * 0.008 * dtf;
        }
        pos[idx + 2] += Math.cos(this.elapsed * 0.9 + i * 1.3) * 0.014 * dtf;
        if (pos[idx + 1] < 0.25) pos[idx + 1] = 2.8;
        if (pos[idx + 1] > 3.2) pos[idx + 1] = 0.35;
        if (pos[idx] > hs) pos[idx] = -hs;
        if (pos[idx] < -hs) pos[idx] = hs;
        if (pos[idx + 2] > hs) pos[idx + 2] = -hs;
        if (pos[idx + 2] < -hs) pos[idx + 2] = hs;
      }
      this.ambientGeo.attributes.position.needsUpdate = true;
    }

    if (this.outpostRing) {
      const pulse = 1 + Math.sin(this.elapsed * 2.8) * 0.035;
      this.outpostRing.scale.set(pulse, pulse, 1);
    }

    if (this.sanctuaryRing && this.sanctuaryRing.visible) {
      const sPulse = 1 + Math.sin(this.elapsed * 2.2) * 0.018;
      this.sanctuaryRing.scale.set(sPulse, 1, sPulse);
      if (this.sanctuaryRing.userData.outerMat) {
        this.sanctuaryRing.userData.outerMat.opacity = 0.22 + Math.sin(this.elapsed * 2.8) * 0.08;
      }
    }

    if (this.lightShafts?.length) {
      for (let i = 0; i < this.lightShafts.length; i++) {
        const ls = this.lightShafts[i];
        ls.material.opacity = ls.userData.baseOp * (0.75 + Math.sin(this.elapsed * 1.1 + ls.userData.phase) * 0.25);
      }
    }

    // 1. Grounded node breeze sway, directional hit recoil, squash-stretch, and regrowth pop
    const lx = local ? local.x : 0;
    const lz = local ? local.z : 0;
    for (const mesh of this.nodeMeshes.values()) {
      const node = mesh.userData.node;
      const isDepleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const wasDepleted = Boolean(mesh.userData.isDepleted);

      if (isDepleted !== wasDepleted) {
        this._setNodeDepletedMesh(mesh, isDepleted);
        if (wasDepleted && !isDepleted) {
          node.hp = node.maxHp || 1;
          node.depletedUntil = 0;
          mesh.userData.spawnPopTimer = 0.36;
          this.world?.fx?.emit?.('fx_stardust', node.x, 0.55, node.z, 6, {
            speed: 0.7, up: 1.0, size: 0.2, life: 0.5,
          });
        }
      }

      const hasActiveAnim =
        mesh.userData.shakeTimer > 0 ||
        mesh.userData.pulseTimer > 0 ||
        mesh.userData.spawnPopTimer > 0 ||
        mesh.userData.hitFlashTimer > 0;
      if (!hasActiveAnim && local) {
        const ndx = node.x - lx;
        const ndz = node.z - lz;
        if (ndx * ndx + ndz * ndz > 625) continue;
      }

      if (mesh.userData.shakeTimer > 0) {
        mesh.userData.shakeTimer -= dt;
        const sInt = (mesh.userData.shakeTimer / 0.32) * 0.08;
        mesh.position.x = node.x + (Math.random() - 0.5) * sInt;
        mesh.position.z = node.z + (Math.random() - 0.5) * sInt;
      } else if (mesh.position.x !== node.x || mesh.position.z !== node.z) {
        mesh.position.x = node.x;
        mesh.position.z = node.z;
      }

      let sx = isDepleted ? 0.32 : 1.0;
      let sy = isDepleted ? 0.32 : 1.0;
      let hitTiltZ = 0;
      if (mesh.userData.pulseTimer > 0) {
        mesh.userData.pulseTimer -= dt;
        const p = 1 - Math.max(0, mesh.userData.pulseTimer) / 0.32;
        const sq = Math.sin(p * Math.PI * 2) * (1 - p) * 0.24;
        sx *= 1 + sq;
        sy *= 1 - sq * 0.85;
        hitTiltZ = (mesh.userData.hitDir || 1) * Math.sin(p * Math.PI) * 0.16;
      } else if (mesh.userData.spawnPopTimer > 0) {
        mesh.userData.spawnPopTimer -= dt;
        const p = 1 - Math.max(0, mesh.userData.spawnPopTimer) / 0.36;
        const pop = Math.sin(p * Math.PI) * 0.22;
        sx *= 1 - pop * 0.4;
        sy *= 1 + pop;
      }

      if (mesh.userData.hitFlashTimer > 0) {
        mesh.userData.hitFlashTimer -= dt;
        for (const item of mesh.userData.materials || []) {
          item.mat.color.setHex(mesh.userData.hitFlashTimer > 0 ? 0xFFF3B0 : (isDepleted ? 0x666666 : 0xFFFFFF));
        }
      }

      const spriteMesh = mesh.userData.spriteMesh;
      if (spriteMesh && !isDepleted) {
        const isFoliage =
          node.type === 'tree' ||
          node.type === 'sakura_tree' ||
          node.type === 'wheat' ||
          node.type === 'herb' ||
          node.type === 'cloud_lotus';
        const swayAmp = node.type === 'wheat' || node.type === 'herb' || node.type === 'cloud_lotus' ? 0.055 : isFoliage ? 0.028 : 0.01;
        const breezeZ = Math.sin(this.elapsed * 2.1 + mesh.userData.bobPhase) * swayAmp;
        const breath = Math.sin(this.elapsed * 1.8 + mesh.userData.bobPhase) * (isFoliage ? 0.018 : 0.01);
        spriteMesh.rotation.z = breezeZ + hitTiltZ;
        sx *= 1 + breath;
        sy *= 1 - breath;
      } else if (spriteMesh) {
        spriteMesh.rotation.z = 0;
      }

      mesh.scale.set(sx, sy, sx);
      mesh.position.y = 0;
    }

    // 2. Monster position interpolation, hop-walk, breathing idle, hit recoil & HP billboarding
    for (const mon of this.activeMonsters.values()) {
      const prevX = mon.x;
      const prevZ = mon.z;
      const lerpT = Math.min(1, dt * (pNow < (mon.knockUntil || 0) ? 18 : 10));
      mon.x += (mon.targetX - mon.x) * lerpT;
      mon.z += (mon.targetZ - mon.z) * lerpT;
      const stepDist = Math.hypot(mon.x - prevX, mon.z - prevZ);
      const speed = stepDist / Math.max(0.001, dt);

      if (mon.shakeTimer > 0) {
        mon.shakeTimer -= dt;
        mon.group.position.x = mon.x + (Math.random() - 0.5) * 0.1;
        mon.group.position.z = mon.z + (Math.random() - 0.5) * 0.1;
      } else {
        mon.group.position.x = mon.x;
        mon.group.position.z = mon.z;
      }

      const baseScale = (mon.isBoss ? 2.8 : 1.0) * (mon.isElite ? ALPHA_ELITE.SCALE_MULT : 1.0);
      let sx = baseScale;
      let sy = baseScale;
      let tiltZ = 0;

      if (mon.baseY > 0) {
        // Flying monsters (Pollen Wisp, Lantern Bat, Cloud-Crane, Tide-Bell, Owl, Griffon): hover bob + wing tilt
        mon.group.position.y = mon.baseY + Math.sin(this.elapsed * 4.2 + mon.bobPhase) * 0.12;
        tiltZ = Math.cos(this.elapsed * 4.2 + mon.bobPhase) * 0.06;
        const flap = Math.sin(this.elapsed * 9.0 + mon.bobPhase) * 0.04;
        sx *= 1 + flap;
        sy *= 1 - flap;
      } else if (speed > 0.12) {
        // Ground monsters walking/chasing: bouncy slime/boar hop + waddle + landing squash
        mon.walkPhase = (mon.walkPhase || 0) + dt * (mon.isBoss ? 7.5 : 11.5);
        const hopSin = Math.sin(mon.walkPhase);
        const hopHeight = Math.abs(hopSin) * (mon.isBoss ? 0.14 : 0.22);
        mon.group.position.y = hopHeight;
        tiltZ = hopSin * (mon.isBoss ? 0.05 : 0.09);
        const bounceSq = Math.cos(mon.walkPhase * 2) * 0.075;
        sx *= 1 + bounceSq;
        sy *= 1 - bounceSq;
      } else {
        // Ground monsters idle: lively breathing squash & stretch
        mon.group.position.y = 0;
        const breath = Math.sin(this.elapsed * 3.2 + mon.bobPhase) * 0.042;
        sx *= 1 + breath;
        sy *= 1 - breath;
      }

      if (mon.squashTimer > 0) {
        mon.squashTimer -= dt;
        const p = 1 - Math.max(0, mon.squashTimer) / 0.26;
        const hitSq = Math.sin(p * Math.PI) * 0.24;
        sx *= 1 + hitSq;
        sy *= 1 - hitSq * 0.85;
        tiltZ += (mon.hitDir || 1) * Math.sin(p * Math.PI) * 0.18;
      }

      const mask = mon.tagMask || 0;
      const isFrozen = (mask & 16) !== 0;
      const isStunned = (mask & 256) !== 0;
      const isChilled = (mask & 8) !== 0;
      const isBurning = (mask & 2) !== 0;
      const isShocked = (mask & 4) !== 0;
      const isSoaked = (mask & 1) !== 0;
      const isMarked = (mask & 64) !== 0;
      const isBroken = mon.poise !== null && mon.poise !== undefined && mon.poise < 0;

      if (isFrozen) {
        sx = baseScale;
        sy = baseScale;
        tiltZ = 0;
        mon.group.position.y = mon.baseY || 0;
      } else if (isStunned) {
        tiltZ = Math.sin(this.elapsed * 14.0 + mon.bobPhase) * 0.14;
        sx *= 0.96;
        sy *= 1.04;
      }

      mon.group.scale.set(sx, sy, baseScale);

      const ud = mon.group.userData;
      if (ud?.freezeShell) {
        ud.freezeShell.visible = isFrozen && mon.hp > 0;
        if (ud.freezeShell.visible) {
          ud.freezeShell.rotation.y = this.elapsed * 0.8;
          const pulse = 1 + Math.sin(this.elapsed * 4.5) * 0.035;
          ud.freezeShell.scale.set(pulse, pulse, pulse);
        }
      }

      if (mon.isElite && !mon.isBoss && mon.hp > 0) {
        const eRing = mon.group.userData?.eliteRing;
        if (eRing) {
          eRing.visible = true;
          eRing.rotation.z = this.elapsed * 1.4;
        }
        mon.auraTimer = (mon.auraTimer || 0) + dt;
        if (mon.auraTimer >= 2.85) {
          mon.auraTimer = 0;
          const nearPlayer = !local || Math.hypot(mon.x - local.x, mon.z - local.z) <= 26;
          if (nearPlayer && ALPHA_ELITE_AURA_SPEC?.effekseer) {
            this.skillVfx?.efk?.playRecipe?.(ALPHA_ELITE_AURA_SPEC.effekseer, {
              x: mon.x,
              y: 0,
              z: mon.z,
              casterRef: mon,
              stopIfDead: true,
              durationMs: ALPHA_ELITE_AURA_SPEC.durationMs || 2000,
            });
          }
        }
      }

      const dx = mon.targetX - mon.x;
      const spriteMesh = mon.group.userData?.spriteMesh;
      if (spriteMesh) {
        if (!isFrozen && Math.abs(dx) > 0.008) {
          const absX = Math.abs(spriteMesh.scale.x);
          spriteMesh.scale.x = dx > 0 ? -absX : absX;
        }
        spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
        spriteMesh.rotation.z = tiltZ;
        if (mon.hitFlashTimer > 0) {
          mon.hitFlashTimer -= dt;
          spriteMesh.material.color.setHex(0xFFE082);
        } else if (isFrozen) {
          spriteMesh.material.color.setHex(0x67E8F9);
        } else if (isStunned) {
          spriteMesh.material.color.setHex(0xFDE68A);
        } else if (isBroken) {
          spriteMesh.material.color.setHex(0xFCA5A5);
        } else if (isBurning) {
          spriteMesh.material.color.setHex(0xFDBA74);
        } else if (isShocked) {
          spriteMesh.material.color.setHex(0xFEF08A);
        } else if (isChilled) {
          spriteMesh.material.color.setHex(0x93C5FD);
        } else if (isSoaked) {
          spriteMesh.material.color.setHex(0xA5F3FC);
        } else if (isMarked) {
          spriteMesh.material.color.setHex(0xF5D0FE);
        } else {
          spriteMesh.material.color.setHex(0xFFFFFF);
        }
      }

      if (mon.hpBar) {
        const isTargetedMob = !mon.isBoss && this.targetMonster && mon.id === this.targetMonster.id;
        const hasGuard = mon.poise !== null && mon.poise !== undefined && !mon.isBoss;
        const tagSpr = mon.group.userData?.tagSprite;
        if (tagSpr) {
          tagSpr.visible = (mon.tagMask || 0) > 0;
          const baseH = ud?.baseH || 1.1;
          tagSpr.position.y = isTargetedMob ? baseH + 0.56 : baseH + 0.42;
          // Readability first (no depth test), but soften the x-ray look when a big herd shares the screen
          const tagOp = this.activeMonsters.size > 8 ? 0.72 : 1;
          if (tagSpr.material.opacity !== tagOp) tagSpr.material.opacity = tagOp;
        }
        if (!isTargetedMob && mon.hp > 0 && (mon.hp < mon.maxHp || hasGuard)) {
          mon.hpBar.visible = true;
          const pct = Math.max(0, Math.min(1, mon.hp / mon.maxHp));
          mon.hpFill.scale.x = pct;
          mon.hpFill.position.x = -0.38 * (1 - pct);
          if (camera) mon.hpBar.quaternion.copy(camera.quaternion);
        } else {
          mon.hpBar.visible = false;
        }
      }
    }

    // 2b. Dying monster spin-squash-pop animation
    for (let i = this.dyingMonsters.length - 1; i >= 0; i--) {
      const dm = this.dyingMonsters[i];
      dm.age += dt;
      if (dm.age >= dm.life) {
        this.root.remove(dm.group);
        this._releaseMonsterMesh(dm.type, dm.group);
        this.dyingMonsters.splice(i, 1);
      } else {
        const p = dm.age / dm.life;
        const baseScale = (dm.isBoss ? 2.8 : 1.0) * (dm.isElite ? ALPHA_ELITE.SCALE_MULT : 1.0);
        const popY = Math.sin(p * Math.PI) * 0.45;
        dm.group.position.set(dm.x, (dm.baseY || 0) + popY, dm.z);
        const s = baseScale * (1 - p * 0.75);
        dm.group.scale.set(s * (1 + p * 0.4), s * (1 - p * 0.5), baseScale);
        const sm = dm.group.userData?.spriteMesh;
        if (sm) {
          sm.rotation.z = p * 0.85;
          sm.material.color.setHex(0xFFE082);
        }
      }
    }

    // 3. Gate animation, unlock visual sync & automatic walk-into-portal proximity check
    if (local && Array.isArray(this.layout?.gates) && this.layout.gates.length > 0) {
      if (this._gateInitDisarmPending) {
        this._gateInitDisarmPending = false;
        for (const gate of this.layout.gates) {
          const spawnDist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
          if (spawnDist <= (gate.radius || 3) + 1.8) {
            this._disarmedGates?.add?.(gate.to);
          }
        }
      }

      for (const gate of this.layout.gates) {
        const gGroup = this.gateMeshes.get(gate.to || gate);
        const unlocked = this._isGateUnlocked(gate);
        if (gGroup) {
          if (gGroup.userData.unlocked !== unlocked) {
            gGroup.userData.unlocked = unlocked;
            if (gGroup.userData.gRingMat) gGroup.userData.gRingMat.color.setHex(unlocked ? 0x7CE8FF : 0x8899AA);
            if (gGroup.userData.gDiscMat) {
              gGroup.userData.gDiscMat.color.setHex(unlocked ? 0x38BDF8 : 0x64748B);
              gGroup.userData.gDiscMat.opacity = unlocked ? 0.22 : 0.10;
            }
            if (gGroup.userData.gatePlaneMat) gGroup.userData.gatePlaneMat.color.setHex(unlocked ? 0xFFFFFF : 0x9FB0C2);
            if (gGroup.userData.labelSprite) {
              gGroup.remove(gGroup.userData.labelSprite);
              gGroup.userData.labelSprite.material?.map?.dispose?.();
              gGroup.userData.labelSprite.material?.dispose?.();
            }
            const nextLbl = this._makeGateLabelSprite(gate, unlocked);
            if (nextLbl) {
              nextLbl.position.set(0, 4.95, 0.2);
              gGroup.add(nextLbl);
              gGroup.userData.labelSprite = nextLbl;
            }
          }
          if (gGroup.userData.gRingMat) {
            const pulse = 0.56 + Math.sin(this.elapsed * 3.4) * 0.22;
            gGroup.userData.gRingMat.opacity = unlocked ? pulse : 0.40;
          }
          if (gGroup.userData.labelSprite) {
            gGroup.userData.labelSprite.position.y = 4.95 + Math.sin(this.elapsed * 2.5) * 0.08;
          }
        }

        const dist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
        if (this._disarmedGates?.has?.(gate.to) && dist > Math.max(3.8, (gate.radius || 3) + 0.8)) {
          this._disarmedGates.delete(gate.to);
        }

        if (this.targetGate && this.targetGate.to === gate.to) {
          const rad = (gate.radius || 2.8) + 0.9;
          if (dist <= rad && !this._gatePending) {
            this.targetGate = null;
            this._triggerGate(gate);
            break;
          }
        } else if (
          !this.targetGate
          && !this._gatePending
          && pNow >= (this._gateCooldownUntil || 0)
          && !this._disarmedGates?.has?.(gate.to)
          && dist <= (gate.radius || 2.8)
        ) {
          this._triggerGate(gate);
          break;
        }
      }
    }

    // 4. Auto-swing timing loop (Mining)
    if (this.targetNode && local) {
      const dist = Math.hypot(local.x - this.targetNode.x, local.z - this.targetNode.z);
      const isDepleted = Boolean(this.targetNode.depletedUntil && this.targetNode.depletedUntil > now);

      if (isDepleted) {
        this.stopAutoSwing();
        if (this.autoGatherEnabled && !this.lockedHuntMobId && (this.energy?.cur || 0) >= 2 && !this._autoChainTimer) {
          this._autoChainTimer = setTimeout(() => {
            this._autoChainTimer = null;
            if (this.active && this.autoGatherEnabled && !this.lockedHuntMobId && !this.targetNode && !this.targetMonster && !this.targetGate) {
              this.findAndWalkToNextNode();
            }
          }, 350);
        }
      } else if (!this.isSwinging) {
        const tap = this.world?.input?.tapTarget;
        if (tap && Math.hypot(tap.x - this.targetNode.x, tap.z - (this.targetNode.z + 1.2)) > 1.5) {
          this.stopAutoSwing();
        } else if (dist <= 3.0) {
          this.startAutoSwing();
        }
      } else {
        if (dist > 3.5) {
          this.stopAutoSwing();
        } else {
          const swingDuration = SWING_MS || 750;
          this.swingTimer += dt * 1000;
          const progress = Math.min(1, this.swingTimer / swingDuration);

          this.inBeatWindow = progress >= 0.58;
          if (this.inBeatWindow && this.runeHeld && !this.nextStrikePerfect) {
            this.triggerPerfectLock();
          }
          this._updateRuneRing(progress, this.inBeatWindow);

          if (this.swingTimer >= swingDuration) {
            this.swingTimer -= swingDuration;
            this.executeStrike();
          }
        }
      }
    }

    // 4b. Ghost-monster sweep: a non-target, non-boss mob with no sf_monsters update for >10s → reconcile (throttled ≥10s)
    {
      const pNowStale = performance.now();
      if (this.active && pNowStale - (this._lastStaleSweepAt || 0) >= 10000) {
        this._lastStaleSweepAt = pNowStale;
        const tgtId = this.targetMonster?.id;
        for (const mon of this.activeMonsters.values()) {
          if (mon.isBoss || mon.id === tgtId) continue;
          if (pNowStale - (mon._lastSeenAt || pNowStale) > 10000) {
            this._reconcileMonstersFromServer();
            break;
          }
        }
      }
    }

    // 5. Combat auto-attack loop (Weapon-Class Range + Smart Auto-Skill + Haste Buff)
    if (this.targetMonster && local) {
      const mon = this.activeMonsters.get(this.targetMonster.id);
      if (!mon || mon.hp <= 0) {
        this.stopAutoAttack();
      } else {
        this.targetMonster = mon;
        const dist = Math.hypot(local.x - mon.x, local.z - mon.z);
        const wep = this._getActiveWeaponInfo();
        const range = wep.range || 1.9;
        const tap = this.world?.input?.tapTarget;

        if (tap && tap !== this._combatTapTarget && Math.hypot(tap.x - mon.x, tap.z - mon.z) > range + 2.5) {
          this.stopAutoAttack();
        } else if (dist > range * 0.96) {
          const dx = mon.x - local.x;
          const dz = mon.z - local.z;
          const d = Math.hypot(dx, dz) || 1;
          const stopDist = Math.max(1.25, range - 0.45);
          const targetWalkX = mon.x - (dx / d) * stopDist;
          const targetWalkZ = mon.z - (dz / d) * stopDist;
          if (!tap || Math.hypot(tap.x - targetWalkX, tap.z - targetWalkZ) > 0.6) {
            this.world?.walkTo?.(targetWalkX, targetWalkZ);
            this._combatTapTarget = this.world?.input?.tapTarget || null;
          }
          this._updateRuneRing(0, false);
          // Ranged skills / gap-closers (Tusk Rush) fire from their own reach while closing in;
          // _trySmartAutoCastSkills re-checks each skill's echo-scaled reach, then the melee loop resumes.
          if (this.autoGatherEnabled && dist <= 10.5 * SF_MAX_ECHO_RANGE_MULT) {
            this._trySmartAutoCastSkills(now, mon);
          }
        } else {
          if (tap && tap === this._combatTapTarget) {
            this.world?.clearMoveState?.();
            this._combatTapTarget = null;
          }
          if (this.autoGatherEnabled) {
            this._trySmartAutoCastSkills(now, mon);
          }
          const baseCd = this.attackCooldownMs || wep.cooldownMs || 650;
          const hastePct =
            !this._attackCdFromServer && now < (this._localBuffs?.hasteUntil || 0)
              ? (this._localBuffs.hastePct || 0.25)
              : 0;
          const cd = hastePct > 0 ? Math.max(260, Math.round(baseCd / (1 + hastePct))) : baseCd;
          this.attackTimer += dt * 1000;
          const progress = Math.min(1, this.attackTimer / cd);
          this.inBeatWindow = progress >= 0.58;
          if (this.inBeatWindow && this.runeHeld && !this.nextStrikePerfect) {
            this.triggerPerfectLock();
          }
          this._updateRuneRing(progress, this.inBeatWindow);
          if (this.attackTimer >= cd && !this._attackInFlight && now >= (this._nextAttackServerAt || 0) - 15) {
            this.attackTimer = 0;
            this.nextStrikePerfect = false;
            this.executeAttack();
          }
        }
      }
    }

    // 5a. Species-Locked Codex Auto-Hunt (waits still at habitat when 0 alive) OR Normal Smart Auto-Defense
    if (this.autoGatherEnabled && this.lockedHuntMobId && local && !this.targetGate && !this._gatePending) {
      if (this.targetMonster && this.targetMonster.type !== this.lockedHuntMobId) {
        this.stopAutoAttack();
      }
      if (!this.targetMonster) {
        const nextLocked = this._findNearestLockedMonster();
        if (nextLocked) {
          this.targetNode = null;
          this._navTarget = null;
          this.startAutoAttack(nextLocked);
        } else {
          if (this.targetNode) this.stopAutoSwing();
          const joy = this.world?.input?.joy;
          const manualJoy = joy && Math.hypot(joy.x || 0, joy.y || 0) > 0.18;
          if (!manualJoy && this.lockedHuntAnchor && this.lockedHuntAnchor.region === curReg) {
            const dAnchor = Math.hypot(local.x - this.lockedHuntAnchor.x, local.z - this.lockedHuntAnchor.z);
            if (dAnchor > 2.8) {
              const tap = this.world?.input?.tapTarget;
              if (!tap || Math.hypot(tap.x - this.lockedHuntAnchor.x, tap.z - this.lockedHuntAnchor.z) > 0.8) {
                this.world?.walkTo?.(this.lockedHuntAnchor.x, this.lockedHuntAnchor.z);
              }
            } else {
              if (this.world?.input?.tapTarget) this.world?.clearMoveState?.();
              this._navTarget = null;
            }
          }
        }
      }
    } else if (
      this.autoGatherEnabled &&
      !this.lockedHuntMobId &&
      !this.targetMonster &&
      !this.isSwinging &&
      !this._navTarget &&
      local
    ) {
      let closestThreat = null;
      let closestThreatDist = 2.35;
      for (const mon of this.activeMonsters.values()) {
        if (!mon || mon.hp <= 0) continue;
        const d = Math.hypot(mon.x - local.x, mon.z - local.z);
        if (d < closestThreatDist) {
          closestThreatDist = d;
          closestThreat = mon;
        }
      }
      if (closestThreat) {
        this.targetNode = null;
        this.startAutoAttack(closestThreat);
      }
    }

    // 5a-1. Mini-Map Navigation Waypoint tracking & arrival
    if (this._navTarget && local) {
      const joy = this.world?.input?.joy;
      if (joy && Math.hypot(joy.x || 0, joy.y || 0) > 0.18) {
        this._navTarget = null;
      } else {
        const tap = this.world?.input?.tapTarget;
        if (tap && Math.hypot(tap.x - this._navTarget.x, tap.z - this._navTarget.z) > 2.2) {
          this._navTarget = null;
        } else {
          const navDist = Math.hypot(local.x - this._navTarget.x, local.z - this._navTarget.z);
          if (navDist <= 2.35) {
            const arrived = this._navTarget;
            this._navTarget = null;
            if (!arrived.isGate) {
              this.world?.fx?.emit?.('fx_stardust', local.x, 0.3, local.z, 8, {
                speed: 1.0,
                up: 0.9,
                size: 0.22,
                life: 0.5,
              });
              if (
                this.autoGatherEnabled &&
                !this.lockedHuntMobId &&
                (this.energy?.cur || 0) >= 2 &&
                !this.targetNode &&
                !this.targetMonster
              ) {
                this.findAndWalkToNextNode();
              }
            }
          }
        }
      }
    }

    // 5a-2. 3D Animated Target Reticle Ring under current targetNode, targetMonster, or _navTarget
    if (this.targetRing) {
      if (this.targetMonster) {
        const mon = this.activeMonsters.get(this.targetMonster.id) || this.targetMonster;
        this.targetRing.visible = true;
        this.targetRing.position.set(mon.x, 0.04, mon.z);
        const baseR = mon.isBoss ? 2.1 : mon.isElite ? 1.48 : 1.05;
        const pulse = baseR * (1 + Math.sin(this.elapsed * 7.5) * 0.08);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(mon.isElite ? 0xFACC15 : 0xFF5252);
        this.targetRing.userData.innerMat?.color.setHex(mon.isElite ? 0xFEF08A : 0xFFCDD2);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = this.elapsed * 1.8;
        }
      } else if (this.targetNode) {
        this.targetRing.visible = true;
        this.targetRing.position.set(this.targetNode.x, 0.04, this.targetNode.z);
        const pulse = 1.12 * (1 + Math.sin(this.elapsed * 5.5) * 0.07);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(this.inBeatWindow ? 0xFFF176 : 0xFFD54F);
        this.targetRing.userData.innerMat?.color.setHex(0xFFF9C4);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = -this.elapsed * 1.4;
        }
      } else if (this._navTarget) {
        this.targetRing.visible = true;
        this.targetRing.position.set(this._navTarget.x, 0.04, this._navTarget.z);
        const pulse = 1.25 * (1 + Math.sin(this.elapsed * 6.0) * 0.1);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(0x38BDF8);
        this.targetRing.userData.innerMat?.color.setHex(0xE0F2FE);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = this.elapsed * 1.6;
        }
      } else {
        this.targetRing.visible = false;
      }
    }

    // 5a-3. Live Mini-Map & Open Expedition Map Canvas (~15 Hz)
    this._minimapAccum = (this._minimapAccum || 0) + dt;
    if (this._minimapAccum >= 0.066) {
      this._minimapAccum = 0;
      this._drawMiniMap();
      if (this.mapModalOpen) {
        this._drawBigMap();
      }
    }

    // 5b. Live Partner & Co-Op Radar Pill (allocation-free + dirty-checked)
    if (this.partnerPillEl && local) {
      let partnerEnt = this.world?.getPartnerEntity?.() || null;
      if (!partnerEnt && this.world?.remotes) {
        for (const r of this.world.remotes.values()) {
          if (r) {
            partnerEnt = r;
            break;
          }
        }
      }
      if (partnerEnt) {
        const partnerId = local.profile?.partner_id;
        const isPartner =
          Boolean(partnerId) &&
          String(partnerEnt.id || '').toLowerCase() === String(partnerId).toLowerCase();
        const ax = partnerEnt.smooth?.x ?? partnerEnt.x ?? 0;
        const az = partnerEnt.smooth?.z ?? partnerEnt.z ?? 0;
        const dist = Math.round(Math.hypot(ax - local.x, az - local.z));
        const inSync = dist <= 10;
        const label = inSync
          ? (isPartner ? '💞 Partner Sync Active (+25% Loot!)' : `🤝 Co-Op Sync (${partnerEnt.id}) · Full Loot!`)
          : (isPartner ? `🧭 Partner (${dist}m) · Tap to Join` : `🤝 Ally ${partnerEnt.id} (${dist}m) · Tap to Join`);
        const pKey = `${inSync ? 1 : 0}|${label}`;
        if (hc.partnerKey !== pKey) {
          hc.partnerKey = pKey;
          this.partnerPillEl.style.display = 'inline-flex';
          this.partnerPillEl.classList.toggle('sf-sync-active', inSync);
          this.partnerPillEl.textContent = label;
        }
      } else if (hc.partnerKey !== 'none') {
        hc.partnerKey = 'none';
        this.partnerPillEl.style.display = 'none';
      }
    }

    // 6. Ultimate cooldown sweep & ready state (dirty-checked)
    if (this.ultBtnEl && this.ultRingEl) {
      const remaining = Math.max(0, this.ultReadyAt - now);
      if (remaining > 0) {
        const secTxt = `${Math.ceil(remaining / 1000)}s`;
        const cdTotal = this.ultTotalCd || 60000;
        const frac = Math.min(1, remaining / cdTotal);
        const dashTxt = (276 * (1 - frac)).toFixed(1);
        if (hc.ultReady !== false) {
          hc.ultReady = false;
          this.ultBtnEl.classList.remove('sf-ult-ready');
          if (this.ultCdOverlayEl) this.ultCdOverlayEl.style.display = 'flex';
        }
        if (this.ultCdOverlayEl && hc.ultSec !== secTxt) {
          hc.ultSec = secTxt;
          this.ultCdOverlayEl.textContent = secTxt;
        }
        if (hc.ultDash !== dashTxt) {
          hc.ultDash = dashTxt;
          this.ultRingEl.style.strokeDashoffset = dashTxt;
        }
      } else {
        const hasCharm = Boolean(this.world?.local?.profile?.equipped?.charm);
        const rKey = hasCharm ? 'ready' : 'idle';
        if (hc.ultReady !== rKey) {
          hc.ultReady = rKey;
          hc.ultSec = '';
          hc.ultDash = '0';
          this.ultBtnEl.classList.toggle('sf-ult-ready', hasCharm);
          if (this.ultCdOverlayEl) this.ultCdOverlayEl.style.display = 'none';
          this.ultRingEl.style.strokeDashoffset = '0';
        }
      }
    }

    // 6b. Monster Skill Slots [1] & [2] cooldown sweep (dirty-checked) + 4-Phase SkillVfxEngine tick
    const eqSkills = this._getProfile()?.frontier?.skills?.equipped || SF_EMPTY_EQ;
    const slotUnlocks = this._slotUnlocks || SF_DEFAULT_UNLOCKS;
    for (let sIdx = 0; sIdx < SF_SLOT_COUNT; sIdx++) {
      const btn = this.skillBtnEls?.[sIdx];
      const ring = this.skillRingEls?.[sIdx];
      const cdEl = this.skillCdEls?.[sIdx];
      if (!btn || !ring || !cdEl) continue;
      const skId = slotUnlocks[sIdx] ? (eqSkills[sIdx] || null) : null;
      const remMs = Math.max(0, (this.skillCds[sIdx] || 0) - now);
      const stateKey = SF_HC_KEYS.state[sIdx];
      const txtKey = SF_HC_KEYS.txt[sIdx];
      const dashKey = SF_HC_KEYS.dash[sIdx];
      if (skId && remMs > 0) {
        const txt = remMs >= 9950 ? `${Math.ceil(remMs / 1000)}s` : `${(remMs / 1000).toFixed(1)}s`;
        const total = Math.max(1000, this.skillTotalCds[sIdx] || 8000);
        const frac = Math.min(1, remMs / total);
        const dash = (276 * (1 - frac)).toFixed(1);
        if (hc[stateKey] !== 'cd') {
          hc[stateKey] = 'cd';
          btn.classList.remove('ready');
          cdEl.style.display = 'flex';
        }
        if (hc[txtKey] !== txt) {
          hc[txtKey] = txt;
          cdEl.textContent = txt;
        }
        if (hc[dashKey] !== dash) {
          hc[dashKey] = dash;
          ring.style.strokeDashoffset = dash;
        }
      } else {
        const nextSt = skId ? 'ready' : 'empty';
        if (hc[stateKey] !== nextSt) {
          hc[stateKey] = nextSt;
          hc[txtKey] = '';
          hc[dashKey] = '276';
          cdEl.style.display = 'none';
          ring.style.strokeDashoffset = '276';
          btn.classList.toggle('ready', Boolean(skId));
        }
      }
      // 🎶 Resonance glow on damaging skills while the prime window is open
      const resoOn = Boolean(skId) && now < (this._resonanceUntil || 0) && !sfIsResonancePrimer(skId);
      const resoKey = SF_HC_KEYS.reso[sIdx];
      if (hc[resoKey] !== resoOn) {
        hc[resoKey] = resoOn;
        btn.classList.toggle('resonant', resoOn);
      }
    }

    if (this._skillAimState && this.skillAimGroup && local) {
      this._updateSkillAimMesh();
    }

    this.skillVfx?.update?.(dt, camera || this.world?.camera);

    // 7. Update expanding VFX rings, 3D slash arcs, breadcrumbs, pooled Alpha telegraphs & persistent skill zones
    for (let i = this.vfxRings.length - 1; i >= 0; i--) {
      const v = this.vfxRings[i];
      v.age += dt;
      if (v.age >= v.life) {
        this.root.remove(v.mesh);
        if (!v.mesh.geometry?.userData?.sharedFrontierAsset) v.mesh.geometry?.dispose?.();
        v.mesh.material?.dispose?.();
        this.vfxRings.splice(i, 1);
      } else {
        const p = v.age / v.life;
        const s = 1 + p * (v.maxRadius / 0.45 - 1);
        v.mesh.scale.set(s, 1, s);
        v.mesh.material.opacity = 0.85 * (1 - p);
      }
    }

    if (this._slashArcs?.length) {
      for (let i = this._slashArcs.length - 1; i >= 0; i--) {
        const sa = this._slashArcs[i];
        sa.age += dt;
        if (sa.age >= sa.life) {
          this.root.remove(sa.mesh);
          if (!sa.mesh.geometry?.userData?.sharedFrontierAsset) sa.mesh.geometry?.dispose?.();
          sa.mesh.material?.dispose?.();
          this._slashArcs.splice(i, 1);
        } else {
          const p = sa.age / sa.life;
          const sc = 0.82 + p * 0.55;
          sa.mesh.scale.set(sc, 1, sc);
          sa.mesh.material.opacity = (1 - p) * 0.85;
          if (sa.isStaff) {
            sa.mesh.position.x += sa.dx * dt;
            sa.mesh.position.z += sa.dz * dt;
          } else {
            sa.mesh.rotation.y += dt * 7.5;
          }
        }
      }
    }

    if (this.bossTelegraphRing) {
      if (this._bossTelegraphTimer > 0 && this.activeBoss) {
        this._bossTelegraphTimer = Math.max(0, this._bossTelegraphTimer - dt);
        let bossMon = null;
        for (const m of this.activeMonsters.values()) {
          if (m && m.isBoss && m.hp > 0) {
            bossMon = m;
            break;
          }
        }
        if (bossMon) {
          this.bossTelegraphRing.visible = true;
          this.bossTelegraphRing.position.set(bossMon.x, 0.045, bossMon.z);
          const prog = 1 - this._bossTelegraphTimer / 1.45;
          const fillScale = Math.max(0.15, prog);
          this.bossTelegraphRing.userData.fillMesh?.scale.set(fillScale, 1, fillScale);
          if (this.bossTelegraphRing.userData.ringMat) {
            this.bossTelegraphRing.userData.ringMat.opacity = 0.55 + Math.sin(this.elapsed * 18) * 0.35;
          }
          if (this._bossTelegraphTimer <= 0) {
            this._showUltRingVfx(bossMon.x, bossMon.z, 4.8, 0xEF4444);
          }
        } else {
          this.bossTelegraphRing.visible = false;
        }
      } else {
        this.bossTelegraphRing.visible = false;
      }
    }

    if (this._alphaTelegraphs?.length) {
      for (let i = this._alphaTelegraphs.length - 1; i >= 0; i--) {
        const at = this._alphaTelegraphs[i];
        at.age += dt;
        if (at.age >= at.life) {
          at.group.visible = false;
          this.root.remove(at.group);
          this._alphaTelegraphPool.push(at);
          this._alphaTelegraphs.splice(i, 1);
        } else {
          const prog = Math.max(0.18, Math.min(1, at.age / at.life));
          at.fillMesh?.scale?.set?.(prog, 1, prog);
          if (at.ringMat) {
            at.ringMat.opacity = 0.6 + Math.sin(this.elapsed * 20) * 0.32;
          }
        }
      }
    }

    if (this._activeSkillZones?.length) {
      for (let i = this._activeSkillZones.length - 1; i >= 0; i--) {
        const zn = this._activeSkillZones[i];
        zn.age += dt;
        if (zn.age >= zn.life) {
          this.root.remove(zn.group);
          zn.ringMat?.dispose?.();
          zn.fillMat?.dispose?.();
          this._activeSkillZones.splice(i, 1);
        } else {
          if (zn.followActorId) {
            if (local && zn.followActorId === local.id) {
              zn.group.position.set(local.x, 0.036, local.z);
            } else {
              const rem = this.world?.remotes?.get?.(zn.followActorId);
              if (rem) {
                zn.group.position.set(rem.smooth?.x ?? rem.x ?? zn.x, 0.036, rem.smooth?.z ?? rem.z ?? zn.z);
              }
            }
          }
          const remSec = zn.life - zn.age;
          const fade = remSec < 0.45 ? Math.max(0, remSec / 0.45) : Math.min(1, zn.age / 0.18);
          const pulse = 1 + Math.sin(this.elapsed * 4.5 + i) * 0.025;
          zn.group.scale.set(zn.radius * pulse, 1, zn.radius * pulse);
          if (zn.ringMesh) zn.ringMesh.rotation.z = this.elapsed * 0.7;
          if (zn.ringMat) zn.ringMat.opacity = (0.42 + Math.sin(this.elapsed * 5.2 + i) * 0.14) * fade;
          if (zn.fillMat) zn.fillMat.opacity = 0.10 * fade;
        }
      }
    }

    if (this._breadcrumbs?.length) {
      const route = local ? this._getActiveRoutePoint() : null;
      const rDist = route && local ? Math.hypot(route.x - local.x, route.z - local.z) : 0;
      if (route && local && rDist > 3.2) {
        const count = this._breadcrumbs.length;
        const flow = (this.elapsed * 1.4) % 1;
        for (let i = 0; i < count; i++) {
          const dot = this._breadcrumbs[i];
          const t = ((i + flow) / count);
          if (t < 0.08 || t > 0.94) {
            dot.visible = false;
            continue;
          }
          dot.visible = true;
          dot.position.set(
            local.x + (route.x - local.x) * t,
            0.055 + Math.sin(this.elapsed * 5 + i) * 0.02,
            local.z + (route.z - local.z) * t
          );
          const pulse = 0.78 + Math.sin(this.elapsed * 6 - i * 0.7) * 0.25;
          dot.scale.set(pulse, pulse, 1);
          dot.material.opacity = Math.sin(t * Math.PI) * 0.75;
        }
      } else {
        for (let i = 0; i < this._breadcrumbs.length; i++) {
          this._breadcrumbs[i].visible = false;
        }
      }
    }

    // 8. Invasion banner status update (dirty-checked)
    if (this.invasionBannerEl && this.invasionState) {
      const inv = this.invasionState;
      let disp = 'none';
      let title = '';
      let sub = '';
      if (inv.phase === 'warning') {
        disp = 'flex';
        const sec = Math.max(0, Math.ceil((inv.at - now) / 1000));
        title = '⚠️ INVASION IMMINENT';
        sub = `Wave 1 in ${sec}s — Defend the Outpost!`;
      } else if (inv.phase === 'active') {
        disp = 'flex';
        title = `⚔️ INVASION — Wave ${inv.wave || 1}/${inv.waves || 3}`;
        sub = `${inv.remaining || 0} enemies remaining`;
      } else if (inv.phase === 'ended' || inv.result) {
        disp = 'flex';
        if (inv.result === 'success') {
          title = '🏆 INVASION REPELLED!';
          sub = 'The Outpost is secured!';
        } else {
          title = '💀 OUTPOST OVERRUN!';
          sub = 'The Goddess Statue platform has fallen.';
        }
      }
      const invKey = `${disp}|${title}|${sub}`;
      if (hc.invKey !== invKey) {
        hc.invKey = invKey;
        this.invasionBannerEl.style.display = disp;
        if (disp !== 'none') {
          if (this.invasionTitleEl) this.invasionTitleEl.textContent = title;
          if (this.invasionSubEl) this.invasionSubEl.textContent = sub;
        }
      }
    }

    // 9. Outpost Sanctuary Aura, Quick Heal & Outpost Repair proximity (dirty-checked)
    if (local) {
      const outpostPoi = this.layout?.pois?.outpost || { x: 0, z: 4 };
      const dist = Math.hypot(local.x - outpostPoi.x, local.z - outpostPoi.z);
      const opOffline = Boolean(this.outpostState?.offline || (this.outpostState?.hp !== undefined && this.outpostState.hp <= 0));
      const inSanctuary = !opOffline && dist <= 5.5;
      if (this._inSanctuary !== inSanctuary) {
        this._inSanctuary = inSanctuary;
        this.hpBarEl?.classList.toggle('sanctuary', inSanctuary);
        this.updatePlayerHpBar();
      }

      if (this.healBtnEl) {
        const curHp = Number(this.playerHp?.hp || 0);
        const maxHp = Math.max(1, Number(this.playerHp?.maxHp || 100));
        if (curHp > 0 && curHp <= maxHp * 0.55) {
          const prof = this._getProfile();
          const potions = Math.floor(Number(prof?.frontier?.pantry?.items?.potion_small) || 0);
          const label = potions > 0
            ? `🧪 Quick Heal (×${potions})`
            : inSanctuary
            ? '✨ Sanctuary Healing…'
            : '🗽 Heal at Outpost';
          if (hc.healKey !== label) {
            hc.healKey = label;
            this.healBtnEl.style.display = 'inline-flex';
            this.healBtnEl.textContent = label;
          }
        } else if (hc.healKey !== 'none') {
          hc.healKey = 'none';
          this.healBtnEl.style.display = 'none';
        }
      }

      if (this.repairBtnEl) {
        const damaged = this.outpostState && (opOffline || (this.outpostState.hp !== undefined && this.outpostState.hp < this.outpostState.maxHp));
        if (dist <= 4.5 && damaged) {
          const pantry = this._getProfile()?.frontier?.pantry?.items || {};
          const kits = Math.floor(Number(pantry.repair_kit) || 0);
          const rLabel = `🔧 Repair Outpost (${kits} kits)`;
          if (hc.repairKey !== rLabel) {
            hc.repairKey = rLabel;
            this.repairBtnEl.style.display = 'inline-flex';
            this.repairBtnEl.textContent = rLabel;
          }
        } else if (hc.repairKey !== 'none') {
          hc.repairKey = 'none';
          this.repairBtnEl.style.display = 'none';
        }
      }
    }

    // 10. Boss Summon button proximity (dirty-checked)
    if (this.bossBtnEl && local) {
      const rMeta = REGION_META[curReg] || REGION_META.meadow;
      const bossPoi = this.layout?.pois?.[rMeta.bossPoi] || this.layout?.pois?.boss;
      let nextBossKey = 'none';
      if (bossPoi && !this.activeBoss) {
        const dist = Math.hypot(local.x - bossPoi.x, local.z - bossPoi.z);
        if (dist <= 6.0) {
          nextBossKey = `⚔️ Summon ${rMeta.bossName}`;
        }
      }
      if (hc.bossBtnKey !== nextBossKey) {
        hc.bossBtnKey = nextBossKey;
        if (nextBossKey === 'none') {
          this.bossBtnEl.style.display = 'none';
        } else {
          this.bossBtnEl.style.display = 'block';
          this.bossBtnEl.textContent = nextBossKey;
        }
      }
    }

    // 11. Update floating share text & flying loot magnet positions via GPU-composited translate3d
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.age += dt;
      if (item.age >= item.life) {
        if (item.el?.parentNode) item.el.parentNode.removeChild(item.el);
        this.floatingTexts.splice(i, 1);
      } else {
        const s = this.world?.worldToScreen?.(item.wx, 2.58 + item.age * 1.05, item.wz, this._projTmp);
        if (s && item.el) {
          item.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
          item.el.style.opacity = String(Math.max(0, 1 - (item.age / item.life) ** 2));
        }
      }
    }

    let targetScreenX = (window.innerWidth || 393) * 0.5;
    let targetScreenY = (window.innerHeight || 852) * 0.5;
    if (local && this.lootMagnets.length > 0) {
      const ps = this.world?.worldToScreen?.(local.x, 0.95, local.z, this._projTmp);
      if (ps) {
        targetScreenX = ps.x;
        targetScreenY = ps.y;
      }
    }

    for (let i = this.lootMagnets.length - 1; i >= 0; i--) {
      const lm = this.lootMagnets[i];
      if (lm.delay > 0) {
        lm.delay -= dt;
        continue;
      }
      lm.age += dt;
      if (lm.age >= lm.life) {
        if (lm.el?.parentNode) lm.el.parentNode.removeChild(lm.el);
        this.lootMagnets.splice(i, 1);
        if (local?.rig?.HIP) {
          local.rig.HIP.position.y += 0.06;
        }
      } else {
        const p = lm.age / lm.life;
        let curX;
        let curY;
        let scale = 1;
        if (p < 0.42) {
          const bp = p / 0.42;
          const easeOut = 1 - (1 - bp) * (1 - bp);
          curX = lm.startX + lm.spreadX * easeOut;
          curY = lm.startY + lm.peakY * Math.sin(bp * Math.PI * 0.5);
          scale = 0.7 + 0.45 * Math.sin(bp * Math.PI * 0.5);
        } else {
          const mp = (p - 0.42) / 0.58;
          const easeIn = mp * mp;
          const apexX = lm.startX + lm.spreadX;
          const apexY = lm.startY + lm.peakY;
          curX = apexX + (targetScreenX - apexX) * easeIn;
          curY = apexY + (targetScreenY - apexY) * easeIn - Math.sin(mp * Math.PI) * 18;
          scale = 1.15 - 0.45 * easeIn;
        }
        if (lm.el) {
          lm.el.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
        }
      }
    }

    this._updateOverheadPlates(now);
  }

  showOverheadCastCallout(actorId, text, durMs = 1650) {
    if (!text) return;
    const until = performance.now() + durMs;
    const localId = this.world?.local?.id;
    if (!actorId || actorId === localId) {
      this._castCalloutUntil = until;
      if (this.castCalloutEl) {
        this.castCalloutEl.textContent = text;
        this.castCalloutEl.hidden = false;
        this.castCalloutEl.style.animation = 'none';
        void this.castCalloutEl.offsetWidth;
        this.castCalloutEl.style.animation = '';
        this._selfPlateH = 56;
      }
      return;
    }
    if (!this._remoteCallouts) this._remoteCallouts = new Map();
    this._remoteCallouts.set(actorId, { text, until });
    const plate = this._remotePlates.get(actorId);
    if (plate?.calloutEl) {
      plate.calloutEl.textContent = text;
      plate.calloutEl.hidden = false;
      plate._h = 54;
    }
  }

  _updateOverheadPlates(now) {
    if (!this.active || !this.world?.camera) return;
    this.world.camera.updateMatrixWorld();

    const vw = window.innerWidth || 393;
    const vh = window.innerHeight || 852;
    const perfNow = performance.now();
    const local = this.world.local;
    const p = this._getProfile();

    const placedPlates = [];
    const resolvePlatePos = (rawX, rawY, halfW, h) => {
      let x = Math.max(halfW + 6, Math.min(vw - halfW - 6, rawX));
      let y = Math.max(52 + h, Math.min(vh - 90, rawY));
      // Avoid left-edge Food Pouch (#bc-sf-pouch at x: 8..54, y: 286..340)
      if (x - halfW < 58 && y > 286 && y - h < 342) {
        x = Math.max(x, 58 + halfW);
      }
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const b of placedPlates) {
          if (Math.abs(x - b.cx) < halfW + b.halfW + 3 && y - h < b.bottom + 3 && y > b.top - 3) {
            y = Math.max(52 + h, b.top - 5);
            moved = true;
          }
        }
        if (!moved) break;
      }
      placedPlates.push({ cx: x, halfW, top: y - h, bottom: y });
      return { x, y };
    };

    // 1. Local Player Tree of Savior Overhead Plate (zero forced reflows)
    if (local && this.playerOverheadEl) {
      if (local.rig?.nameTag?.visible) {
        local.rig.nameTag.visible = false;
        local.rig._sfHidNameTag = true;
      }

      if (this.castCalloutEl && !this.castCalloutEl.hidden && perfNow >= this._castCalloutUntil) {
        this.castCalloutEl.hidden = true;
        this._selfPlateH = 32;
      }

      const wepCls = activeWeaponClass(p?.equipped, p?.glamour);
      const clsIcon = WEAPON_CLASSES[wepCls]?.icon || '⚔️';
      const dispName = p?.username || p?.id || local.id || 'Adventurer';
      const lv = Math.max(1, Number(p?.level) || 1);

      let buffs = '';
      if (this.hpBarEl?.classList?.contains('sanctuary')) buffs += '🗽';
      if (Number(this.playerHp?.shield) > 0) buffs += '🫧';
      if (now < (this._localBuffs?.hasteUntil || 0)) buffs += '💨';
      if (now < (this._localBuffs?.dmgReduceUntil || 0)) buffs += '🐚';
      if (now < (this._localBuffs?.critUpUntil || 0)) buffs += '🎯';
      if (p?.frontier?.mealBuff?.until > now) buffs += '🍱';
      if (p?.frontier?.restBuff?.until > now) buffs += '♨️';
      if (this.partnerPillEl?.classList?.contains('sf-sync-active')) buffs += '💞';

      const metaKey = `${clsIcon}|${dispName}|${lv}|${buffs}`;
      if (metaKey !== this._lastOverheadKey) {
        this._lastOverheadKey = metaKey;
        if (this.plateClsEl) this.plateClsEl.textContent = clsIcon;
        if (this.plateNameEl) this.plateNameEl.textContent = dispName;
        if (this.plateLvEl) this.plateLvEl.textContent = `Lv.${lv}`;
        if (this.plateBuffsEl) this.plateBuffsEl.textContent = buffs;
        this._selfPlateW = this.playerOverheadEl.offsetWidth || 116;
        this._selfPlateH = this.playerOverheadEl.offsetHeight || (this.castCalloutEl && !this.castCalloutEl.hidden ? 56 : 32);
      }

      const rigOffsetY = (local.rig?.ROOT?.position?.y || 0) + (local.rig?.billboard?.position?.y || 0);
      const anchor = this.world.worldToScreen(local.x, rigOffsetY + 1.66, local.z, this._projTmp);
      const halfSelfW = Math.max(56, (this._selfPlateW || 116) * 0.5);
      const selfH = this._selfPlateH || 32;
      const { x: sx, y: sy } = resolvePlatePos(anchor.x, anchor.y, halfSelfW, selfH);
      this.playerOverheadEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }

    // 2. Targeted Field Monster Overhead Plate (non-boss; bosses use #sf-boss-bar)
    if (this.mobOverheadEl) {
      const tm = this.targetMonster;
      const liveTm = tm ? this.activeMonsters.get(tm.id) : null;
      if (liveTm && !liveTm.isBoss && liveTm.hp > 0) {
        const isAlpha = Boolean(liveTm.isElite);
        const mobBaseY = liveTm.group?.position?.y || 0;
        const mobCrownY = mobBaseY + (liveTm.hpBar?.position?.y || 1.65) * (isAlpha ? ALPHA_ELITE.SCALE_MULT : 1.0);
        if (this.mobOverheadEl.hidden) this.mobOverheadEl.hidden = false;
        const meta = MONSTER_CODEX_META[liveTm.type];
        const mDef = MONSTERS[liveTm.type];
        const curHp = Math.max(0, Math.round(liveTm.hp));
        const maxHp = Math.max(1, Math.round(liveTm.maxHp || mDef?.hp || 30));
        const mobKey = `${liveTm.id}:${isAlpha ? 1 : 0}:${curHp}/${maxHp}`;
        if (mobKey !== this._lastMobOverheadKey) {
          const prevTargetKey = `${liveTm.id}:${isAlpha ? 1 : 0}`;
          const needMeasure = this._lastMobTargetKey !== prevTargetKey;
          this._lastMobTargetKey = prevTargetKey;
          this._lastMobOverheadKey = mobKey;
          this.mobOverheadEl.classList.toggle('is-alpha', isAlpha);
          if (this.mobPlateNameEl) {
            const rawName = String(mDef?.name || liveTm.type).replace(/[<>&"]/g, '');
            this.mobPlateNameEl.innerHTML = isAlpha
              ? `<span class="sf-alpha-badge">⭐ ALPHA</span> ${meta?.icon || '👾'} ${rawName}`
              : `${meta?.icon || '👾'} ${rawName}`;
          }
          if (this.mobHpFillEl) {
            const pct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));
            this.mobHpFillEl.style.width = `${pct.toFixed(1)}%`;
          }
          if (this.mobHpTxtEl) {
            this.mobHpTxtEl.textContent = `${curHp}/${maxHp}`;
          }
          if (needMeasure) {
            this._mobPlateW = this.mobOverheadEl.offsetWidth || 124;
            this._mobPlateH = this.mobOverheadEl.offsetHeight || 33;
          }
        }
        // Status tag chips + Guard bar (re-rendered only when mask / poise / target changes)
        const tmMask = liveTm.tagMask || 0;
        const tmPoise = liveTm.poise === undefined ? null : liveTm.poise;
        if (tmMask !== this._lastMobTagMask || tmPoise !== this._lastMobPoise || liveTm.id !== this._lastMobComboId) {
          this._lastMobTagMask = tmMask;
          this._lastMobPoise = tmPoise;
          this._lastMobComboId = liveTm.id;
          if (this.mobTagRowEl) {
            this.mobTagRowEl.innerHTML = tmMask
              ? (liveTm.tags || decodeTagMask(tmMask)).map((t) => this._tagChipHtml(t, { size: 12, withLabel: true })).join('')
              : '';
          }
          this.mobOverheadEl.classList.toggle('is-frozen', (tmMask & 16) !== 0);
          if (this.mobGuardTrackEl) {
            const hasGuard = tmPoise !== null;
            this.mobGuardTrackEl.hidden = !hasGuard;
            if (hasGuard) {
              const broken = tmPoise < 0;
              this.mobGuardTrackEl.classList.toggle('is-broken', broken);
              if (this.mobGuardFillEl) this.mobGuardFillEl.style.width = broken ? '100%' : `${Math.max(0, Math.min(100, tmPoise))}%`;
              this.mobGuardTrackEl.title = broken ? '💥 Guard Broken! (+50% DMG)' : `🛡️ Guard ${Math.round(tmPoise)}%`;
            }
          }
        }
        const ms = this.world.worldToScreen(liveTm.x, mobCrownY, liveTm.z, this._projTmp);
        const halfMobW = Math.max(56, (this._mobPlateW || 124) * 0.5);
        const mobH = this._mobPlateH || 33;
        const { x: mx, y: my } = resolvePlatePos(ms.x, ms.y, halfMobW, mobH);
        this.mobOverheadEl.style.transform = `translate3d(${mx.toFixed(1)}px, ${my.toFixed(1)}px, 0) translate(-50%, -100%)`;
      } else if (!this.mobOverheadEl.hidden) {
        this.mobOverheadEl.hidden = true;
        this.mobOverheadEl.classList.remove('is-alpha', 'is-frozen');
        this._lastMobOverheadKey = '';
        this._lastMobTargetKey = '';
        this._lastMobComboId = null;
      }
    }

    // 3. Co-Op Remote Teammate Overhead Plates
    const remotes = this.world.remotes;
    if (this.remotePlatesContainerEl && remotes) {
      const partnerId = String(p?.partner_id || p?.partnerId || '').toLowerCase();
      for (const [id, plate] of this._remotePlates.entries()) {
        if (!remotes.has(id)) {
          if (plate.el?.parentNode) plate.el.parentNode.removeChild(plate.el);
          this._remotePlates.delete(id);
          this._remoteHp.delete(id);
        }
      }
      for (const [id, rem] of remotes.entries()) {
        if (!rem) continue;
        if (rem.rig?.nameTag?.visible) {
          rem.rig.nameTag.visible = false;
          rem.rig._sfHidNameTag = true;
        }
        let plate = this._remotePlates.get(id);
        if (!plate) {
          const el = document.createElement('div');
          el.className = 'sf-char-plate is-ally';
          el.innerHTML = `
            <div class="sf-cast-callout" hidden></div>
            <div class="sf-plate-top">
              <span class="sf-plate-cls">⚔️</span>
              <span class="sf-plate-name"></span>
              <span class="sf-plate-lv"></span>
            </div>
            <div class="sf-hp-bar">
              <div class="sf-hp-bar-fill"></div>
              <div class="sf-hp-shield-fill"></div>
              <span class="sf-hp-bar-text"></span>
            </div>
          `;
          this.remotePlatesContainerEl.appendChild(el);
          plate = {
            el,
            calloutEl: el.querySelector('.sf-cast-callout'),
            clsEl: el.querySelector('.sf-plate-cls'),
            nameEl: el.querySelector('.sf-plate-name'),
            lvEl: el.querySelector('.sf-plate-lv'),
            barEl: el.querySelector('.sf-hp-bar'),
            fillEl: el.querySelector('.sf-hp-bar-fill'),
            shieldEl: el.querySelector('.sf-hp-shield-fill'),
            txtEl: el.querySelector('.sf-hp-bar-text'),
            lastKey: '',
            _w: 116,
            _h: 30,
          };
          this._remotePlates.set(id, plate);
        }

        const callout = this._remoteCallouts?.get?.(id);
        if (callout && perfNow < callout.until) {
          if (plate.calloutEl.hidden || plate.calloutEl.textContent !== callout.text) {
            plate.calloutEl.textContent = callout.text;
            plate.calloutEl.hidden = false;
            plate._h = 54;
          }
        } else if (plate.calloutEl && !plate.calloutEl.hidden) {
          plate.calloutEl.hidden = true;
          plate._h = 30;
        }

        const rData = rem.data || rem;
        const isPartner =
          (Boolean(partnerId) && String(id).toLowerCase() === partnerId) ||
          (Boolean(local?.id) && String(rData?.partner_id || rData?.partnerId || '').toLowerCase() === String(local.id).toLowerCase());
        const remWepCls = activeWeaponClass(rData?.equipped, rData?.glamour);
        const remIcon = isPartner ? '💞' : (WEAPON_CLASSES[remWepCls]?.icon || '⚔️');
        const remName = rData?.username || rData?.name || rem.username || id;
        const remLv = Math.max(1, Number(rData?.level ?? rem.level) || 1);
        const defaultMaxHp = playerMaxHp(remLv, {});
        const hpObj = this._remoteHp.get(id) || { hp: defaultMaxHp, maxHp: defaultMaxHp, shield: 0 };
        const cur = Math.max(0, Math.round(hpObj.hp));
        const max = Math.max(1, Math.round(hpObj.maxHp));
        const shd = Math.max(0, Math.round(hpObj.shield || 0));
        const rKey = `${isPartner ? 1 : 0}|${remIcon}|${remName}|${remLv}|${cur}/${max}+${shd}`;
        if (rKey !== plate.lastKey) {
          const nameKey = `${isPartner ? 1 : 0}|${remIcon}|${remName}|${remLv}`;
          const needMeasure = plate._nameKey !== nameKey;
          plate._nameKey = nameKey;
          plate.lastKey = rKey;
          plate.el.classList.toggle('is-partner', isPartner);
          plate.clsEl.textContent = remIcon;
          plate.nameEl.textContent = remName;
          plate.lvEl.textContent = `Lv.${remLv}`;
          const pct = Math.max(0, Math.min(100, (cur / max) * 100));
          const shPct = shd > 0 ? Math.min(100, (shd / max) * 100) : 0;
          plate.fillEl.style.width = `${pct.toFixed(1)}%`;
          plate.shieldEl.style.width = `${shPct.toFixed(1)}%`;
          plate.barEl.classList.toggle('low', pct <= 35);
          plate.barEl.classList.toggle('mid', pct > 35 && pct <= 65);
          plate.txtEl.textContent = shd > 0 ? `${cur}+${shd}` : `${cur}/${max}`;
          if (needMeasure) {
            plate._w = plate.el.offsetWidth || 116;
          }
        }

        const rx = rem.smooth?.x ?? rem.x ?? 0;
        const rz = rem.smooth?.z ?? rem.z ?? 0;
        const ry = (rem.rig?.ROOT?.position?.y || 0) + (rem.rig?.billboard?.position?.y || 0) + 1.66;
        const rs = this.world.worldToScreen(rx, ry, rz, this._projTmp);
        const halfRemW = Math.max(52, (plate._w || 116) * 0.5);
        const remH = plate._h || 30;
        const { x: sx, y: sy } = resolvePlatePos(rs.x, rs.y, halfRemW, remH);
        plate.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }
  }

  _updateRuneRing(progress, inBeat) {
    if (this.runeRingEl) {
      const circumference = 264;
      const offset = circumference * (1 - progress);
      this.runeRingEl.style.strokeDashoffset = `${offset}`;
    }
    if (this.runeBtnEl) {
      if (inBeat) {
        this.runeBtnEl.classList.add('sf-beat-active');
      } else {
        this.runeBtnEl.classList.remove('sf-beat-active');
      }
    }
  }

  // ------------------------------------------------------------------ Monster Mesh Pooling
  _acquireMonsterMesh(type) {
    let pool = this.monsterPool.get(type);
    if (!pool) {
      pool = [];
      this.monsterPool.set(type, pool);
    }
    while (pool.length > 0) {
      const group = pool.pop();
      const sm = group.userData?.spriteMesh;
      if (!sm?.material || sm.material._disposed) continue;
      if (sm.material.map) {
        sm.visible = true;
      } else if (group.userData?.spriteKey) {
        sm.visible = false;
        loadSprite(group.userData.spriteKey).then((s) => {
          if (sm.material._disposed || !s?.texture) return;
          sm.material.map = s.texture;
          sm.material.needsUpdate = true;
          sm.visible = true;
        });
      }
      group.visible = true;
      return group;
    }
    return this._createMonsterMesh(type);
  }

  _releaseMonsterMesh(type, group) {
    if (!group) return;
    group.visible = false;
    const baseScale = group.userData?.isBoss ? 2.8 : 1.0;
    group.scale.set(baseScale, baseScale, baseScale);
    if (group.userData?.eliteRing) {
      group.userData.eliteRing.visible = false;
    }
    if (group.userData?.shadow) {
      group.userData.shadow.scale.setScalar(group.userData.shadowR || 0.58);
    }
    const sm = group.userData?.spriteMesh;
    if (sm) {
      sm.rotation.z = 0;
      sm.material.color.setHex(0xFFFFFF);
      if (sm.material._disposed) return;
    }
    if (group.userData?.tagSprite) group.userData.tagSprite.visible = false;
    if (group.userData?.guardBar) group.userData.guardBar.visible = false;
    if (group.userData?.freezeShell) group.userData.freezeShell.visible = false;
    let pool = this.monsterPool.get(type);
    if (!pool) {
      pool = [];
      this.monsterPool.set(type, pool);
    }
    pool.push(group);
  }

  _createMonsterMesh(type) {
    const group = new THREE.Group();
    group.name = `sf_mob_${type}`;
    const geos = this._mobGeos;
    const mats = this._mobMats;

    const isBoss = Boolean(BOSSES[type]);
    let baseY = 0;

    const MOB_SPRITE_CONFIG = {
      moss_slime:                { key: 'sf_mob_moss_slime',        w: 1.35, baseY: 0,    shadowR: 0.52 },
      thornback_boar:            { key: 'sf_mob_thornback_boar',    w: 1.75, baseY: 0,    shadowR: 0.68 },
      pollen_wisp:               { key: 'sf_mob_pollen_wisp',       w: 1.45, baseY: 0.25, shadowR: 0.45 },
      meadow_zephyr_hare:        { key: 'sf_mob_zephyr_hare',       w: 1.50, baseY: 0,    shadowR: 0.56 },
      crystal_beetle:            { key: 'sf_mob_crystal_beetle',    w: 1.65, baseY: 0,    shadowR: 0.62 },
      lantern_bat:               { key: 'sf_mob_lantern_bat',       w: 1.75, baseY: 0.35, shadowR: 0.50 },
      quartz_golemling:          { key: 'sf_mob_quartz_golemling',  w: 1.90, baseY: 0,    shadowR: 0.72 },
      hollow_frost_shroom:       { key: 'sf_mob_frost_shroom',      w: 1.55, baseY: 0,    shadowR: 0.58 },
      reef_sakura_kitsune:       { key: 'sf_mob_sakura_kitsune',    w: 1.65, baseY: 0,    shadowR: 0.60 },
      reef_pearl_snapper:        { key: 'sf_mob_pearl_snapper',     w: 1.75, baseY: 0,    shadowR: 0.68 },
      reef_cloud_crane:          { key: 'sf_mob_cloud_crane',       w: 1.80, baseY: 0.30, shadowR: 0.55 },
      reef_bell_spirit:          { key: 'sf_mob_bell_spirit',       w: 1.50, baseY: 0.30, shadowR: 0.48 },
      sanctum_cinder_salamander: { key: 'sf_mob_cinder_salamander', w: 1.75, baseY: 0,    shadowR: 0.66 },
      sanctum_arc_automaton:     { key: 'sf_mob_arc_automaton',     w: 1.75, baseY: 0.25, shadowR: 0.58 },
      sanctum_star_gargoyle:     { key: 'sf_mob_star_gargoyle',     w: 1.90, baseY: 0.30, shadowR: 0.64 },
      sanctum_chrono_sentinel:   { key: 'sf_mob_chrono_sentinel',   w: 1.95, baseY: 0,    shadowR: 0.72 },
      elder_moss_golem:          { key: 'sf_boss_moss_golem',       w: 1.55, baseY: 0,    shadowR: 0.65 },
      hollow_crystal_weaver:     { key: 'sf_boss_crystal_weaver',   w: 1.60, baseY: 0,    shadowR: 0.68 },
      sakura_nine_tail_kitsune:  { key: 'sf_boss_sakura_kitsune',   w: 1.70, baseY: 0,    shadowR: 0.72 },
      chronos_solar_bahamut:     { key: 'sf_boss_solar_bahamut',    w: 1.85, baseY: 0,    shadowR: 0.78 },
    };
    const cfg = MOB_SPRITE_CONFIG[type] || MOB_SPRITE_CONFIG.quartz_golemling;
    baseY = cfg.baseY;

    // Grounding shadow oval (reuses shared unitGroundCircle)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x140E0A,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geos.unitGroundCircle, shadowMat);
    shadow.scale.setScalar(cfg.shadowR);
    shadow.position.y = 0.02;
    group.add(shadow);

    // 2.5D Tree of Savior Monster Sprite (reuses shared bottom-anchored unitPlane)
    const info = spriteInfo(cfg.key);
    const aspect = info ? info.h / info.w : 1.05;
    const w = cfg.w;
    const h = w * aspect;
    const spriteMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    const spriteMesh = new THREE.Mesh(geos.unitPlane, spriteMat);
    spriteMesh.scale.set(w, h, 1);
    spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
    spriteMesh.visible = false;
    loadSprite(cfg.key).then((s) => {
      if (spriteMat._disposed || !s?.texture) return;
      spriteMat.map = s.texture;
      spriteMat.needsUpdate = true;
      spriteMesh.visible = true;
    });
    group.add(spriteMesh);

    // Boss scaling & golden ground aura ring, or Star-Crowned Alpha Elite ring for field mobs
    let eliteRing = null;
    if (isBoss) {
      group.scale.set(2.8, 2.8, 2.8);
      const crown = new THREE.Mesh(geos.crownRing, mats.crown);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 0.04, 0);
      group.add(crown);
    } else if (geos.eliteRing && mats.eliteRing) {
      eliteRing = new THREE.Mesh(geos.eliteRing, mats.eliteRing);
      eliteRing.position.set(0, 0.036, 0);
      eliteRing.visible = false;
      group.add(eliteRing);
    }

    // Mini HP bar above monster
    const hpBar = new THREE.Group();
    const hpY = isBoss ? h * 0.95 : h + 0.18;
    hpBar.position.set(0, hpY, 0);

    const hpBg = new THREE.Mesh(geos.hpBg, mats.hpBg);
    hpBar.add(hpBg);

    const hpFill = new THREE.Mesh(geos.hpFill, mats.hpFill);
    hpFill.position.set(0, 0, 0.005);
    hpBar.add(hpFill);

    // Thin Guard (poise) bar under the HP bar for Elite / Armored mobs (hidden unless poise !== null)
    let guardBar = null;
    let guardFill = null;
    if (geos.guardBg && geos.guardFill && mats.guardFill) {
      guardBar = new THREE.Group();
      guardBar.position.set(0, -0.075, 0);
      guardBar.add(new THREE.Mesh(geos.guardBg, mats.hpBg));
      guardFill = new THREE.Mesh(geos.guardFill, mats.guardFill);
      guardFill.position.set(0, 0, 0.005);
      guardBar.add(guardFill);
      guardBar.visible = false;
      hpBar.add(guardBar);
    }

    hpBar.visible = false;
    group.add(hpBar);

    // 3D Ice Encasement Shell (hidden by default; shown when monster is Frozen — bit 16)
    const freezeShell = new THREE.Group();
    const shellGeo = new THREE.OctahedronGeometry(0.62 * w, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x67E8F9,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.position.set(0, h * 0.48, 0.04);
    shellMesh.scale.set(0.86, 1.08, 0.55);
    freezeShell.add(shellMesh);

    const frostRingGeo = new THREE.RingGeometry(0.42 * w, 0.58 * w, 6);
    frostRingGeo.rotateX(-Math.PI / 2);
    const frostRingMat = new THREE.MeshBasicMaterial({
      color: 0xBAE6FD,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const frostRing = new THREE.Mesh(frostRingGeo, frostRingMat);
    frostRing.position.set(0, 0.045, 0);
    freezeShell.add(frostRing);
    freezeShell.visible = false;
    group.add(freezeShell);

    group.userData = {
      type,
      spriteKey: cfg.key,
      isBoss,
      baseY,
      baseW: w,
      baseH: h,
      shadowR: cfg.shadowR,
      hpBar,
      hpFill,
      guardBar,
      guardFill,
      tagSprite: null,
      spriteMesh,
      shadow,
      eliteRing,
      freezeShell,
    };

    return group;
  }

  // ------------------------------------------------------------------ Mesh Creation Helpers
  _addScenicSprite(spriteKey, x, z, width, camLean = -0.58) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const gen = this._enterGen;
    const geos = this._mobGeos;

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geos.unitGroundCircle, shadowMat);
    shadow.scale.setScalar(width * 0.36);
    shadow.position.y = 0.018;
    group.add(shadow);

    const info = spriteInfo(spriteKey);
    const aspect = info ? info.h / info.w : 1.1;
    const h = width * aspect;
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geos.unitPlane, planeMat);
    plane.scale.set(width, h, 1);
    plane.rotation.x = camLean;
    plane.visible = false;
    loadSprite(spriteKey).then((s) => {
      if (gen !== this._enterGen || planeMat._disposed || !s?.texture) return;
      planeMat.map = s.texture;
      planeMat.needsUpdate = true;
      plane.visible = true;
    });
    group.add(plane);

    this.root.add(group);
    return group;
  }

  _buildFramingBorder(regionOrHollow) {
    const reg = typeof regionOrHollow === 'string' ? regionOrHollow : (regionOrHollow ? 'hollow' : 'meadow');
    const gen = this._enterGen;
    const step = reg === 'reef' ? 3.2 : reg === 'caldera' ? 2.8 : 2.4;
    const outerMargin = 1.0;
    const innerMargin = 2.8;
    const positions = [];

    for (let x = -this.halfSize + 1.5; x <= this.halfSize - 1.5; x += step) {
      const zTop = -this.halfSize + outerMargin + (Math.sin(x * 1.7) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: x + Math.cos(x) * 0.3, z: zTop });
      const zBottom = this.halfSize - outerMargin - (Math.cos(x * 1.3) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: x - Math.sin(x) * 0.3, z: zBottom });
    }
    for (let z = -this.halfSize + 2.5; z <= this.halfSize - 2.5; z += step) {
      const xLeft = -this.halfSize + outerMargin + (Math.sin(z * 1.5) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: xLeft, z: z + Math.sin(z) * 0.3 });
      const xRight = this.halfSize - outerMargin - (Math.cos(z * 1.9) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: xRight, z: z - Math.cos(z) * 0.3 });
    }

    const dummy = new THREE.Object3D();
    const count = positions.length;
    const borderKey = REGION_META[reg]?.borderKey || 'sf_prop_meadow_tree';
    const info = spriteInfo(borderKey);
    const aspect = info ? info.h / info.w : 1.22;
    const baseW = reg === 'caldera' ? 2.8 : reg === 'reef' ? 3.5 : reg === 'hollow' ? 3.0 : 3.4;
    const baseH = baseW * aspect;

    const planeGeo = new THREE.PlaneGeometry(baseW, baseH);
    planeGeo.translate(0, baseH * 0.48, 0);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
    });
    const borderInst = new THREE.InstancedMesh(planeGeo, planeMat, count);
    borderInst.visible = false;
    loadSprite(borderKey).then((s) => {
      if (gen !== this._enterGen || planeMat._disposed || !s?.texture) return;
      planeMat.map = s.texture;
      planeMat.needsUpdate = true;
      borderInst.visible = true;
    });
    const camLean = -(this.world?.pitch || 0.58);

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const s = 0.85 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.35;
      const flip = (i % 2 === 0) ? 1 : -1;
      dummy.position.set(p.x, 0, p.z);
      dummy.scale.set(s * flip, s, s);
      dummy.rotation.set(camLean, 0, 0);
      dummy.updateMatrix();
      borderInst.setMatrixAt(i, dummy.matrix);
    }
    borderInst.instanceMatrix.needsUpdate = true;
    this.root.add(borderInst);
  }

  _createNodeMesh(node) {
    const group = new THREE.Group();
    group.name = `sf_node_${node.id}`;
    const type = String(node.type || 'tree');
    const geos = this._mobGeos;
    const mats = this._mobMats;
    const gen = this._enterGen;

    const NODE_SPRITE_CONFIG = {
      tree:         { key: 'sf_node_wood',         w: 3.1, shadowR: 0.95 },
      boulder:      { key: 'sf_node_stone',        w: 2.2, shadowR: 0.85 },
      wheat:        { key: 'sf_node_wheat',        w: 2.1, shadowR: 0.78 },
      herb:         { key: 'sf_node_herb',         w: 1.9, shadowR: 0.72 },
      crystal:      { key: 'sf_node_crystal',      w: 2.3, shadowR: 0.85 },
      quartz:       { key: 'sf_node_crystal',      w: 2.5, shadowR: 0.92 },
      mithril:      { key: 'sf_node_mithril',      w: 2.5, shadowR: 0.92 },
      sakura_tree:  { key: 'sf_node_sakura_tree',  w: 3.2, shadowR: 0.98 },
      pearl_clam:   { key: 'sf_node_pearl_clam',   w: 2.3, shadowR: 0.85 },
      cloud_lotus:  { key: 'sf_node_cloud_lotus',  w: 2.1, shadowR: 0.78 },
      orichalcum:   { key: 'sf_node_orichalcum',   w: 2.5, shadowR: 0.92 },
      astral_prism: { key: 'sf_node_astral_prism', w: 2.6, shadowR: 0.92 },
    };
    const cfg = NODE_SPRITE_CONFIG[type] || NODE_SPRITE_CONFIG.boulder;

    // Grounding shadow (reuses shared unitGroundCircle)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geos.unitGroundCircle, shadowMat);
    shadow.scale.setScalar(cfg.shadowR);
    shadow.position.y = 0.018;
    group.add(shadow);

    // Warm golden gatherable rim ring on ground (reuses shared unitGroundRing)
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xE8B85A,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraRing = new THREE.Mesh(geos.unitGroundRing, auraMat);
    auraRing.scale.setScalar(cfg.shadowR * 0.98);
    auraRing.position.y = 0.025;
    group.add(auraRing);

    // 2.5D Tree of Savior Node Sprite (reuses shared unitPlane)
    const info = spriteInfo(cfg.key);
    const aspect = info ? info.h / info.w : 1.1;
    const w = cfg.w;
    const h = w * aspect;
    const spriteMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    const spriteMesh = new THREE.Mesh(geos.unitPlane, spriteMat);
    spriteMesh.scale.set(w, h, 1);
    spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
    spriteMesh.visible = false;
    loadSprite(cfg.key).then((s) => {
      if (gen !== this._enterGen || spriteMat._disposed || !s?.texture) return;
      spriteMat.map = s.texture;
      spriteMat.needsUpdate = true;
      spriteMesh.visible = true;
    });
    group.add(spriteMesh);

    // 3D Node HP & Rarity Charge Bar above node (reuses shared hpBg / hpFill geometries)
    const hpBar = new THREE.Group();
    hpBar.position.set(0, h * 0.92, 0.25);
    hpBar.rotation.x = -(this.world?.pitch || 0.58);
    const hpBg = new THREE.Mesh(geos.hpBg, mats.hpBg);
    hpBg.scale.set(1.4, 1.4, 1);
    hpBar.add(hpBg);

    const hpFillMat = new THREE.MeshBasicMaterial({ color: 0xE8B85A, side: THREE.DoubleSide });
    const hpFill = new THREE.Mesh(geos.hpFill, hpFillMat);
    hpFill.scale.set(1.368, 1.5, 1);
    hpFill.position.set(0, 0, 0.005);
    hpBar.add(hpFill);
    hpBar.visible = false;
    group.add(hpBar);

    group.userData.node = node;
    group.userData.baseY = 0;
    group.userData.bobPhase = Math.random() * Math.PI * 2;
    group.userData.shakeTimer = 0;
    group.userData.pulseTimer = 0;
    group.userData.auraRing = auraRing;
    group.userData.spriteMesh = spriteMesh;
    group.userData.hpBar = hpBar;
    group.userData.hpFill = hpFill;
    group.userData.materials = [
      {
        mat: spriteMat,
        baseColor: new THREE.Color(0xFFFFFF),
      },
    ];

    group.position.set(node.x, 0, node.z);

    const now = Date.now() + (this.world?.serverOffset || 0);
    const isDepleted = Boolean(node.depletedUntil && node.depletedUntil > now);
    this._setNodeDepletedMesh(group, isDepleted);

    return group;
  }

  _setNodeDepletedMesh(mesh, isDepleted) {
    mesh.userData.isDepleted = isDepleted;
    if (mesh.userData.auraRing) {
      mesh.userData.auraRing.visible = !isDepleted;
      if (!isDepleted) {
        mesh.userData.auraRing.material.color.setHex(0xE8B85A);
        mesh.userData.auraRing.material.opacity = 0.36;
      }
    }
    if (mesh.userData.hpBar) {
      mesh.userData.hpBar.visible = false;
    }
    if (mesh.userData.hpFill) {
      mesh.userData.hpFill.scale.x = 1;
      mesh.userData.hpFill.position.x = 0;
      mesh.userData.hpFill.material.color.setHex(0xE8B85A);
    }
    if (isDepleted) {
      mesh.scale.set(0.35, 0.35, 0.35);
      for (const item of mesh.userData.materials || []) {
        item.mat.color.setHex(0x666666);
      }
    } else {
      mesh.scale.set(1.0, 1.0, 1.0);
      for (const item of mesh.userData.materials || []) {
        item.mat.color.copy(item.baseColor);
      }
    }
  }

  // ------------------------------------------------------------------ Mini-Map & Expedition Map Navigation
  _getRegionPois(regionOverride = null) {
    const curReg = this._currentRegionId();
    const reg = regionOverride || curReg;
    const pois = (reg === curReg ? this.layout?.pois : null) || REGIONS[reg]?.pois || {};
    const hollowUnlocked = this._isGateUnlocked({ requires: 'hollow' });
    const reefUnlocked = this._isGateUnlocked({ requires: 'reef' });
    const calderaUnlocked = this._isGateUnlocked({ requires: 'caldera' });

    if (reg === 'caldera') {
      return [
        { id: 'outpost', seekId: 'outpost', icon: '🗽', label: 'Starforge Outpost', sub: 'Safe Sanctuary & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 6, color: '#FDE047', short: 'Outpost' },
        { id: 'cinder_vents', seekId: 'sanctum_cinder_salamander', icon: '🦎', label: 'Solar-Ember Vents', sub: '⚔️ Pack · Cinder Salamanders · ⭐ Alpha 8%', x: pois.cinder_vents?.x ?? -22, z: pois.cinder_vents?.z ?? 10, color: '#FB923C', short: 'Vents' },
        { id: 'gear_foundry', seekId: 'sanctum_arc_automaton', icon: '🦉', label: 'Brass Gear Foundry', sub: '⚔️ Pack · Aether-Owl Automatons · ⭐ Alpha 8%', x: pois.gear_foundry?.x ?? 22, z: pois.gear_foundry?.z ?? 10, color: '#FACC15', short: 'Foundry' },
        { id: 'prism_spires', seekId: 'sanctum_star_gargoyle', icon: '🦅', label: 'Amethyst Prism Spires', sub: '⚔️ Pack · Astral-Shard Griffons · ⭐ Alpha 8%', x: pois.prism_spires?.x ?? -20, z: pois.prism_spires?.z ?? -14, color: '#C084FC', short: 'Prisms' },
        { id: 'chrono_ring', seekId: 'sanctum_chrono_sentinel', icon: '🤖', label: 'Grand Orrery Ring', sub: '⚔️ Pack · Chrono-Gear Sentinels · ⭐ Alpha 8%', x: pois.chrono_ring?.x ?? 20, z: pois.chrono_ring?.z ?? -14, color: '#38BDF8', short: 'Orrery' },
        { id: 'boss', seekId: 'chronos_solar_bahamut', icon: '👑', label: 'Solar Astrolabe Altar', sub: '★3 Chronos-Solar Bahamut Boss', x: pois.boss?.x ?? 0, z: pois.boss?.z ?? -26, color: '#FB7185', short: 'Bahamut' },
        { id: 'gate_reef', seekId: 'gate_reef', icon: '🌸', label: 'Gate: Sakura Reef', sub: 'Portal Warp → Region 3', x: pois.gate_reef?.x ?? 0, z: pois.gate_reef?.z ?? 30, color: '#F9A8D4', short: 'Reef Gate', isGate: true, gateTo: 'reef', unlocked: true },
      ];
    }

    if (reg === 'reef') {
      return [
        { id: 'outpost', seekId: 'outpost', icon: '🗽', label: 'Sakura Shrine Outpost', sub: 'Safe Sanctuary & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 6, color: '#FDE047', short: 'Outpost' },
        { id: 'shrine_woods', seekId: 'reef_sakura_kitsune', icon: '🦊', label: 'Torii Sakura Woods', sub: '⚔️ Pack · Sakura Kitsunes · ⭐ Alpha 8%', x: pois.shrine_woods?.x ?? -22, z: pois.shrine_woods?.z ?? 10, color: '#F9A8D4', short: 'Torii Woods' },
        { id: 'pearl_shoals', seekId: 'reef_pearl_snapper', icon: '🐢', label: 'Luminous Pearl Shoals', sub: '🌿 Gentle · Pearl Snappers · ⭐ Alpha 8%', x: pois.pearl_shoals?.x ?? 22, z: pois.pearl_shoals?.z ?? 10, color: '#67E8F9', short: 'Shoals' },
        { id: 'crane_roost', seekId: 'reef_cloud_crane', icon: '🦢', label: 'Cloud-Lotus Roost', sub: '🌿 Gentle · Cloud-Cranes · ⭐ Alpha 8%', x: pois.crane_roost?.x ?? -20, z: pois.crane_roost?.z ?? -14, color: '#FBCFE8', short: 'Roost' },
        { id: 'bell_lagoon', seekId: 'reef_bell_spirit', icon: '🎐', label: 'Tide-Bell Lagoon', sub: '🌿 Gentle · Tide-Bell Spirits · ⭐ Alpha 8%', x: pois.bell_lagoon?.x ?? 20, z: pois.bell_lagoon?.z ?? -14, color: '#5EEAD4', short: 'Lagoon' },
        { id: 'boss', seekId: 'sakura_nine_tail_kitsune', icon: '👑', label: 'Grand Sakura Torii Altar', sub: '★3 Nine-Tail Kitsune Boss', x: pois.boss?.x ?? 0, z: pois.boss?.z ?? -26, color: '#FB7185', short: 'Kitsune' },
        { id: 'gate_hollow', seekId: 'gate_hollow', icon: '💎', label: 'Gate: Crystal Hollow', sub: 'Portal Warp → Region 2', x: pois.gate_hollow?.x ?? -14, z: pois.gate_hollow?.z ?? 30, color: '#67E8F9', short: 'Hollow Gate', isGate: true, gateTo: 'hollow', unlocked: true },
        {
          id: 'gate_caldera',
          seekId: 'gate_caldera',
          icon: '⚙️',
          label: 'Gate: Star-Caldera',
          sub: calderaUnlocked ? 'Open Portal → Region 4' : '🔒 Unlocks after Story Ch.6',
          x: pois.gate_caldera?.x ?? 14,
          z: pois.gate_caldera?.z ?? -30,
          color: calderaUnlocked ? '#FBBF24' : '#94A3B8',
          short: 'Caldera Gate',
          isGate: true,
          gateTo: 'caldera',
          unlocked: calderaUnlocked,
        },
      ];
    }

    if (reg === 'hollow') {
      return [
        { id: 'outpost', seekId: 'outpost', icon: '🗽', label: 'Hollow Outpost', sub: 'Safe Sanctuary & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 6, color: '#FDE047', short: 'Outpost' },
        { id: 'frost_glade', seekId: 'hollow_frost_shroom', icon: '🍄', label: 'Frostcap Glade', sub: '🌿 Gentle · Frostcap Myconids · ⭐ Alpha 8%', x: pois.frost_glade?.x ?? -18, z: pois.frost_glade?.z ?? 16, color: '#7DD3FC', short: 'Frost Glade' },
        { id: 'quartz', seekId: 'crystal_beetle', icon: '🪲', label: 'Violet Quartz Cavern', sub: '⚔️ Pack · Crystal Beetles · ⭐ Alpha 8%', x: pois.quartz?.x ?? -20, z: pois.quartz?.z ?? 0, color: '#C084FC', short: 'Quartz' },
        { id: 'mithril', seekId: 'lantern_bat', icon: '🦇', label: 'Mithril Deep Vein', sub: '⚔️ Pack · Lantern Bats · ⭐ Alpha 8%', x: pois.mithril?.x ?? 20, z: pois.mithril?.z ?? -10, color: '#818CF8', short: 'Mithril' },
        { id: 'sanctum_guard', seekId: 'quartz_golemling', icon: '🗿', label: 'Sanctum Approach', sub: '⚔️ Pack · Quartz Golemlings · ⭐ Alpha 8%', x: pois.sanctum_guard?.x ?? 14, z: pois.sanctum_guard?.z ?? -20, color: '#A78BFA', short: 'Sanctum' },
        { id: 'boss', seekId: 'hollow_crystal_weaver', icon: '👑', label: 'Weaver Boss Sanctum', sub: '★3 Hollow Crystal Weaver Boss', x: pois.boss?.x ?? 0, z: pois.boss?.z ?? -26, color: '#FB7185', short: 'Weaver' },
        { id: 'gate_meadow', seekId: 'gate_meadow', icon: '🌾', label: 'Gate: Whispering Meadow', sub: 'Portal Warp → Region 1', x: pois.gate_meadow?.x ?? 0, z: pois.gate_meadow?.z ?? 30, color: '#86EFAC', short: 'Meadow Gate', isGate: true, gateTo: 'meadow', unlocked: true },
        {
          id: 'gate_reef',
          seekId: 'gate_reef',
          icon: '🌸',
          label: 'Gate: Sakura Reef',
          sub: reefUnlocked ? 'Open Portal → Region 3' : '🔒 Unlocks in Story Ch.5',
          x: pois.gate_reef?.x ?? 24,
          z: pois.gate_reef?.z ?? 18,
          color: reefUnlocked ? '#F9A8D4' : '#94A3B8',
          short: 'Reef Gate',
          isGate: true,
          gateTo: 'reef',
          unlocked: reefUnlocked,
        },
      ];
    }

    return [
      { id: 'outpost', seekId: 'outpost', icon: '🗽', label: 'Goddess Outpost', sub: 'Safe Sanctuary & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 4, color: '#FDE047', short: 'Outpost' },
      { id: 'grove', seekId: 'moss_slime', icon: '🟢', label: 'Whispering Grove', sub: '🌿 Gentle · Moss Slimes & Wood · ⭐ Alpha 8%', x: pois.grove?.x ?? -22, z: pois.grove?.z ?? 8, color: '#4ADE80', short: 'Grove' },
      { id: 'boulders', seekId: 'thornback_boar', icon: '🐗', label: 'Thornback Quarry', sub: '⚔️ Pack · Thornback Boars & Stone · ⭐ Alpha 8%', x: pois.boulders?.x ?? -16, z: pois.boulders?.z ?? -8, color: '#FB923C', short: 'Quarry' },
      { id: 'wheat', seekId: 'pollen_wisp', icon: '🧚', label: 'Windmill & Wheat', sub: '🌿 Gentle · Pollen Wisps & Wheat · ⭐ Alpha 8%', x: pois.wheat?.x ?? 20, z: pois.wheat?.z ?? 12, color: '#FACC15', short: 'Wheat' },
      { id: 'grotto', seekId: 'meadow_zephyr_hare', icon: '🐰', label: 'Crystal Grotto', sub: '🌿 Gentle · Zephyr Hares & Ore · ⭐ Alpha 8%', x: pois.grotto?.x ?? 24, z: pois.grotto?.z ?? -14, color: '#38BDF8', short: 'Grotto' },
      { id: 'golem', seekId: 'elder_moss_golem', icon: '👑', label: 'Moss Golem Arena', sub: '★2 Elder Moss Golem Boss Altar', x: pois.golem?.x ?? -20, z: pois.golem?.z ?? -18, color: '#FB7185', short: 'Golem' },
      {
        id: 'gate_hollow',
        seekId: 'gate_hollow',
        icon: '🌀',
        label: 'Gate: Crystal Hollow',
        sub: hollowUnlocked ? 'Open Portal → Region 2' : '🔒 Unlocks after Story Ch.2',
        x: pois.gate_hollow?.x ?? 0,
        z: pois.gate_hollow?.z ?? -32,
        color: hollowUnlocked ? '#67E8F9' : '#94A3B8',
        short: 'Hollow Gate',
        isGate: true,
        gateTo: 'hollow',
        unlocked: hollowUnlocked,
      },
    ];
  }

  navigateTo(x, z, opts = {}) {
    if (!this.active || !this.world) return;
    this.closeMapModal();
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetNode = null;

    if (opts.gateTo) {
      const gate = (this.layout?.gates || []).find((g) => g.to === opts.gateTo) || {
        to: opts.gateTo,
        at: { x, z },
        radius: 2.8,
      };
      this.targetGate = gate;
      this._disarmedGates?.delete?.(gate.to);
      this._navTarget = { x: gate.at.x, z: gate.at.z, label: opts.label || 'Sky Mist Gate', isGate: true };
      this.world.walkTo?.(gate.at.x, gate.at.z);
      const local = this.world.local;
      if (local && Math.hypot(local.x - gate.at.x, local.z - gate.at.z) <= (gate.radius || 2.8) + 0.9) {
        this._triggerGate(gate);
      } else {
        this.toast?.(`🧭 Walking to ${opts.label || 'Sky Mist Gate'}…`, 1900);
      }
      return;
    }

    this.targetGate = null;
    const clamped = this.clampWalkable(Number(x) || 0, Number(z) || 0);
    this._navTarget = { x: clamped.x, z: clamped.z, label: opts.label || 'Waypoint', isGate: false };
    this.world.walkTo?.(clamped.x, clamped.z);
    this.world.fx?.emit?.('fx_stardust', clamped.x, 0.25, clamped.z, 6, {
      speed: 0.9,
      up: 0.85,
      size: 0.2,
      life: 0.45,
    });
    if (opts.label) {
      this.toast?.(`🧭 Navigating to ${opts.label}…`, 1900);
    }
  }

  openMapModal() {
    if (!this.active || !this.mapModalEl) return;
    this.closeBountyModal();
    this.closeSkillModal();
    this.mapModalOpen = true;
    this._mapInspectRegion = this._currentRegionId();
    this.playGatherSfx('auto_on');
    this._renderMapModalHtml();
    this.mapModalEl.hidden = false;
    this._drawBigMap();
  }

  closeMapModal() {
    this.mapModalOpen = false;
    if (this.mapModalEl) {
      this.mapModalEl.hidden = true;
    }
    this._bigMapCanvasEl = null;
    this._bigMapCtx = null;
  }

  _renderMapModalHtml() {
    if (!this.mapModalEl) return;
    const curReg = this._currentRegionId();
    const inspectReg = REGION_META[this._mapInspectRegion] ? this._mapInspectRegion : curReg;
    const rMeta = REGION_META[inspectReg] || REGION_META.meadow;
    const isSameReg = inspectReg === curReg;
    const inspectUnlocked = inspectReg === 'meadow' || this._isGateUnlocked({ requires: inspectReg });

    const local = this.world?.local;
    const lx = local?.x ?? 0;
    const lz = local?.z ?? 0;
    const pois = this._getRegionPois(inspectReg);

    const tabsHtml = REGION_ORDER.map((rid) => {
      const rm = REGION_META[rid];
      const unlocked = rid === 'meadow' || this._isGateUnlocked({ requires: rid });
      const active = rid === inspectReg;
      return `
        <button type="button" class="sf-map-tab ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}" data-sf-region-tab="${rid}">
          ${rm.icon} ${rm.short}${unlocked ? '' : ' 🔒'}
        </button>
      `;
    }).join('');

    const remoteBanner = !isSameReg
      ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(59,42,32,0.08);border:1.5px solid #D4B88C;border-radius:11px;padding:6px 9px;margin-bottom:8px;font-size:10.5px;font-weight:800;color:#4A321F;">
          <span>${inspectUnlocked ? `✨ ${rMeta.name} is unlocked!` : `🔒 Unlocks in Story Chapter ${rMeta.unlockChapter}`}</span>
          ${inspectUnlocked
            ? `<button type="button" class="sf-map-btn warp" data-sf-warp="${inspectReg}">🚀 Warp Here</button>`
            : `<span style="font-size:10px;font-weight:900;color:#78716C;background:rgba(148,163,184,0.18);border:1px solid #CBD5E1;border-radius:8px;padding:3px 7px;white-space:nowrap;">📖 Ch.${rMeta.unlockChapter}</span>`
          }
        </div>`
      : '';

    const poiRows = pois
      .map((poi) => {
        if (!isSameReg) {
          const actionBtn = inspectUnlocked && poi.seekId
            ? `<button type="button" class="sf-map-btn warp" data-sf-seek="${poi.seekId}">🎯 Navigate</button>`
            : inspectUnlocked
            ? `<button type="button" class="sf-map-btn warp" data-sf-warp="${inspectReg}">🚀 Warp</button>`
            : `<span class="sf-map-btn locked-hunt">🔒 Ch.${rMeta.unlockChapter}</span>`;
          return `
            <div class="sf-map-poi-row" ${inspectUnlocked && poi.seekId ? `data-sf-seek="${poi.seekId}"` : ''}>
              <span class="sf-map-poi-ico">${poi.icon}</span>
              <div class="sf-map-poi-meta">
                <div class="sf-map-poi-name">${poi.label}</div>
                <div class="sf-map-poi-sub">${poi.sub}</div>
              </div>
              <div class="sf-map-poi-btns">${actionBtn}</div>
            </div>
          `;
        }
        const dist = Math.round(Math.hypot(poi.x - lx, poi.z - lz));
        const warpBtn = poi.isGate && poi.unlocked
          ? `<button type="button" class="sf-map-btn warp" data-sf-warp="${poi.gateTo}">🚀 Warp</button>`
          : '';
        return `
          <div class="sf-map-poi-row" data-sf-walk-x="${poi.x}" data-sf-walk-z="${poi.z}" data-sf-label="${poi.label}" ${poi.isGate ? `data-sf-gate="${poi.gateTo}"` : ''}>
            <span class="sf-map-poi-ico">${poi.icon}</span>
            <div class="sf-map-poi-meta">
              <div class="sf-map-poi-name">${poi.label}</div>
              <div class="sf-map-poi-sub">${poi.sub} • ${dist}m</div>
            </div>
            <div class="sf-map-poi-btns">
              ${warpBtn}
              <button type="button" class="sf-map-btn" data-sf-walk-x="${poi.x}" data-sf-walk-z="${poi.z}" data-sf-label="${poi.label}" ${poi.isGate ? `data-sf-gate="${poi.gateTo}"` : ''}>🎯 Navigate</button>
            </div>
          </div>
        `;
      })
      .join('');

    const prof = window.__neora?.state?.profile || local?.profile || {};
    const partnerId = prof.partner_id;
    const remotes = isSameReg ? Array.from(this.world?.remotes?.values?.() || []) : [];
    const playerSection = remotes.length
      ? `
        <div class="sf-map-sec-label">👥 Adventurers in Region (${remotes.length})</div>
        <div class="sf-map-poi-list">
          ${remotes
            .map((r) => {
              const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
              const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
              const d = Math.round(Math.hypot(rx - lx, rz - lz));
              const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
              const name = r.data?.username || r.id || 'Adventurer';
              return `
                <div class="sf-map-poi-row" data-sf-walk-x="${rx.toFixed(1)}" data-sf-walk-z="${rz.toFixed(1)}" data-sf-label="${name}">
                  <span class="sf-map-poi-ico">${isPartner ? '💞' : '🧑'}</span>
                  <div class="sf-map-poi-meta">
                    <div class="sf-map-poi-name">${name}${isPartner ? ' (Partner)' : ''}</div>
                    <div class="sf-map-poi-sub">${isPartner ? '+25% Couple Sync within 10m' : 'Co-op Shardmate'} • ${d}m</div>
                  </div>
                  <div class="sf-map-poi-btns">
                    <button type="button" class="sf-map-btn" data-sf-walk-x="${rx.toFixed(1)}" data-sf-walk-z="${rz.toFixed(1)}" data-sf-label="${name}">🚶 Join</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `
      : '';

    this.mapModalEl.innerHTML = `
      <div class="sf-map-card" role="dialog" aria-label="Sky Frontier Expedition Map">
        <div class="sf-map-head">
          <span class="sf-map-title">🗺️ ${rMeta.name}</span>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <button type="button" class="sf-map-btn" data-sf-open-codex="${inspectReg}">👾 Codex</button>
            <button type="button" class="sf-map-close" data-sf-map-close="1" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="sf-map-tabs">${tabsHtml}</div>
        ${remoteBanner}
        <div class="sf-bigmap-wrap">
          <canvas class="sf-bigmap-canvas" id="sf-bigmap-canvas" width="560" height="560"></canvas>
          <div class="sf-bigmap-hint">👆 Tap any Habitat, Boss Altar, or Gate to navigate! ⭐ = Live Alpha Elite</div>
        </div>
        <div class="sf-map-sec-label">🧭 Habitats, Boss Altar &amp; Portals</div>
        <div class="sf-map-poi-list">${poiRows}</div>
        ${playerSection}
      </div>
    `;

    this._bigMapCanvasEl = this.mapModalEl.querySelector('#sf-bigmap-canvas');
    this._bigMapCtx = this._bigMapCanvasEl?.getContext?.('2d') || null;
  }

  _onMapModalClick(e) {
    if (e.target === this.mapModalEl || e.target.closest('[data-sf-map-close]')) {
      e.preventDefault();
      this.closeMapModal();
      return;
    }

    const codexBtn = e.target.closest('[data-sf-open-codex]');
    if (codexBtn) {
      e.preventDefault();
      const regFilter = codexBtn.getAttribute('data-sf-open-codex') || this._currentRegionId();
      this.openCodexModal(null, regFilter);
      return;
    }

    const curReg = this._currentRegionId();
    const inspectReg = REGION_META[this._mapInspectRegion] ? this._mapInspectRegion : curReg;

    const canvas = e.target.closest('#sf-bigmap-canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const pad = 16 * (rect.width / 280);
      const inner = Math.max(1, rect.width - pad * 2);
      const u = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / inner));
      const v = Math.max(0, Math.min(1, (e.clientY - rect.top - pad) / inner));
      const hs = inspectReg === curReg ? (this.halfSize || 36) : (REGIONS[inspectReg]?.zone?.halfSize || 36);
      const wx = (u * 2 - 1) * hs;
      const wz = (v * 2 - 1) * hs;

      const pois = this._getRegionPois(inspectReg);
      let hitPoi = null;
      let hitDist = 5.4;
      for (const poi of pois) {
        const d = Math.hypot(wx - poi.x, wz - poi.z);
        if (d < hitDist) {
          hitDist = d;
          hitPoi = poi;
        }
      }
      if (inspectReg !== curReg) {
        if (!this._isGateUnlocked({ requires: inspectReg }) && inspectReg !== 'meadow') {
          const rm = REGION_META[inspectReg];
          this.toast?.(`🔒 Complete Story Chapter ${rm?.unlockChapter || 2} to unlock ${rm?.name || inspectReg}!`, 2600);
          return;
        }
        if (hitPoi?.seekId) {
          this.seekObjective(hitPoi.seekId, { auto: true });
        } else {
          this.closeMapModal();
          window.__neora?.enterFrontier?.(inspectReg);
        }
        return;
      }
      if (hitPoi) {
        this.navigateTo(hitPoi.x, hitPoi.z, {
          label: `${hitPoi.icon} ${hitPoi.label}`,
          gateTo: hitPoi.isGate ? hitPoi.gateTo : null,
        });
      } else {
        this.navigateTo(wx, wz, {
          label: `📍 Map Pin (${Math.round(wx)}, ${Math.round(wz)})`,
        });
      }
      return;
    }

    const warpBtn = e.target.closest('[data-sf-warp]');
    if (warpBtn) {
      e.preventDefault();
      e.stopPropagation();
      const region = warpBtn.dataset.sfWarp;
      if (region !== 'meadow' && !this._isGateUnlocked({ requires: region })) {
        const rm = REGION_META[region];
        this.toast?.(`🔒 Complete Story Chapter ${rm?.unlockChapter || 2} to unlock ${rm?.name || region}!`, 2800);
        return;
      }
      this.closeMapModal();
      window.__neora?.enterFrontier?.(region);
      return;
    }

    const seekEl = e.target.closest('[data-sf-seek]');
    if (seekEl) {
      e.preventDefault();
      e.stopPropagation();
      const seekId = seekEl.getAttribute('data-sf-seek');
      if (seekId) {
        this.seekObjective(seekId, { auto: true });
      }
      return;
    }

    const regionTab = e.target.closest('[data-sf-region-tab]');
    if (regionTab) {
      e.preventDefault();
      const targetReg = regionTab.dataset.sfRegionTab;
      if (!REGION_META[targetReg]) return;
      if (this._mapInspectRegion === targetReg && targetReg !== curReg) {
        if (targetReg === 'meadow' || this._isGateUnlocked({ requires: targetReg })) {
          this.closeMapModal();
          window.__neora?.enterFrontier?.(targetReg);
        } else {
          const rm = REGION_META[targetReg];
          this.toast?.(`🔒 Complete Story Chapter ${rm?.unlockChapter || 2} to unlock ${rm?.name}!`, 2800);
        }
        return;
      }
      this._mapInspectRegion = targetReg;
      this.playGatherSfx('step_target');
      this._renderMapModalHtml();
      this._drawBigMap();
      return;
    }

    const walkRow = e.target.closest('[data-sf-walk-x][data-sf-walk-z]');
    if (walkRow) {
      e.preventDefault();
      const wx = parseFloat(walkRow.dataset.sfWalkX);
      const wz = parseFloat(walkRow.dataset.sfWalkZ);
      const label = walkRow.dataset.sfLabel || 'Landmark';
      const gateTo = walkRow.dataset.sfGate || null;
      this.navigateTo(wx, wz, { label, gateTo });
    }
  }

  _getNodeDotColor(type) {
    switch (type) {
      case 'tree': return '#4ADE80';
      case 'boulder': return '#CBD5E1';
      case 'wheat': return '#FACC15';
      case 'herb': return '#34D399';
      case 'crystal': return '#38BDF8';
      case 'quartz': return '#C084FC';
      case 'mithril': return '#818CF8';
      case 'sakura_tree': return '#F9A8D4';
      case 'pearl_clam': return '#67E8F9';
      case 'cloud_lotus': return '#FBCFE8';
      case 'orichalcum': return '#FB923C';
      case 'astral_prism': return '#A78BFA';
      default: return '#FDE68A';
    }
  }

  _getActiveRoutePoint() {
    if (this._navTarget) return this._navTarget;
    if (this.targetGate?.at) return { x: this.targetGate.at.x, z: this.targetGate.at.z };
    if (this.targetNode) return { x: this.targetNode.x, z: this.targetNode.z };
    if (this.targetMonster) return { x: this.targetMonster.x, z: this.targetMonster.z };
    const tap = this.world?.input?.tapTarget;
    if (tap && Number.isFinite(tap.x) && Number.isFinite(tap.z)) return { x: tap.x, z: tap.z };
    return null;
  }

  _gateUnlockMask() {
    return `${this._isGateUnlocked({ requires: 'hollow' }) ? 1 : 0}${this._isGateUnlocked({ requires: 'reef' }) ? 1 : 0}${this._isGateUnlocked({ requires: 'caldera' }) ? 1 : 0}`;
  }

  _drawCanvasStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }

  _ensureMinimapStaticLayer(curReg, hs) {
    const key = `${curReg}:${hs}:${this._gateUnlockMask()}`;
    if (this._minimapStaticCanvas && this._minimapStaticKey === key) {
      return this._minimapStaticCanvas;
    }
    if (typeof document === 'undefined') return null;
    if (!this._minimapStaticCanvas) {
      this._minimapStaticCanvas = document.createElement('canvas');
      this._minimapStaticCanvas.width = 144;
      this._minimapStaticCanvas.height = 144;
    }
    this._minimapStaticKey = key;
    const sctx = this._minimapStaticCanvas.getContext('2d');
    if (!sctx) return null;

    const S = 144;
    const cx = S / 2;
    const cy = S / 2;
    const R = 66;
    const scale = (R - 10) / hs;

    sctx.clearRect(0, 0, S, S);
    sctx.save();
    sctx.beginPath();
    sctx.arc(cx, cy, R, 0, Math.PI * 2);
    const grd = sctx.createRadialGradient(cx, cy, 8, cx, cy, R);
    if (curReg === 'caldera') {
      grd.addColorStop(0, 'rgba(64, 42, 88, 0.95)');
      grd.addColorStop(0.75, 'rgba(34, 24, 54, 0.97)');
      grd.addColorStop(1, 'rgba(18, 12, 32, 0.99)');
    } else if (curReg === 'reef') {
      grd.addColorStop(0, 'rgba(72, 148, 142, 0.94)');
      grd.addColorStop(0.75, 'rgba(42, 102, 104, 0.96)');
      grd.addColorStop(1, 'rgba(24, 62, 68, 0.98)');
    } else if (curReg === 'hollow') {
      grd.addColorStop(0, 'rgba(28, 58, 72, 0.94)');
      grd.addColorStop(0.75, 'rgba(16, 36, 48, 0.96)');
      grd.addColorStop(1, 'rgba(10, 22, 30, 0.98)');
    } else {
      grd.addColorStop(0, 'rgba(62, 86, 46, 0.94)');
      grd.addColorStop(0.75, 'rgba(40, 58, 32, 0.96)');
      grd.addColorStop(1, 'rgba(24, 36, 20, 0.98)');
    }
    sctx.fillStyle = grd;
    sctx.fill();
    sctx.clip();

    // Subtle compass rings & crosshairs
    sctx.strokeStyle = 'rgba(235, 200, 120, 0.16)';
    sctx.lineWidth = 1.2;
    sctx.beginPath();
    sctx.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
    sctx.moveTo(cx, cy - R);
    sctx.lineTo(cx, cy + R);
    sctx.moveTo(cx - R, cy);
    sctx.lineTo(cx + R, cy);
    sctx.stroke();

    // 4-Biome road / crystal-vein / tide-pool / star-vein accents
    if (curReg === 'meadow') {
      sctx.strokeStyle = 'rgba(210, 174, 122, 0.38)';
      sctx.lineWidth = 4.5;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(cx, cy + 28 * scale);
      sctx.lineTo(cx, cy - 32 * scale);
      sctx.moveTo(cx, cy + 4 * scale);
      sctx.lineTo(cx + 20 * scale, cy + 12 * scale);
      sctx.moveTo(cx, cy + 4 * scale);
      sctx.lineTo(cx - 22 * scale, cy + 8 * scale);
      sctx.stroke();
    } else if (curReg === 'hollow') {
      sctx.strokeStyle = 'rgba(103, 232, 249, 0.28)';
      sctx.lineWidth = 2.8;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(cx, cy + 28 * scale);
      sctx.lineTo(cx, cy - 26 * scale);
      sctx.moveTo(cx - 20 * scale, cy);
      sctx.lineTo(cx, cy + 6 * scale);
      sctx.lineTo(cx + 20 * scale, cy - 10 * scale);
      sctx.stroke();
      sctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
      sctx.beginPath();
      sctx.arc(cx - 20 * scale, cy, 6.5, 0, Math.PI * 2);
      sctx.arc(cx, cy - 26 * scale, 7.5, 0, Math.PI * 2);
      sctx.fill();
    } else if (curReg === 'reef') {
      sctx.fillStyle = 'rgba(125, 240, 226, 0.25)';
      sctx.beginPath();
      sctx.arc(cx + 22 * scale, cy + 10 * scale, 8, 0, Math.PI * 2);
      sctx.arc(cx + 20 * scale, cy - 14 * scale, 8, 0, Math.PI * 2);
      sctx.fill();
    } else if (curReg === 'caldera') {
      sctx.strokeStyle = 'rgba(251, 146, 60, 0.32)';
      sctx.lineWidth = 2.6;
      sctx.beginPath();
      sctx.arc(cx, cy - 26 * scale, 8, 0, Math.PI * 2);
      sctx.moveTo(cx - 22 * scale, cy + 10 * scale);
      sctx.lineTo(cx, cy + 6 * scale);
      sctx.lineTo(cx + 22 * scale, cy + 10 * scale);
      sctx.stroke();
    }

    // Key static landmarks (Outpost & Portal Rings)
    const pois = this._getRegionPois(curReg);
    for (const poi of pois) {
      const px = cx + poi.x * scale;
      const py = cy + poi.z * scale;
      if (poi.isGate) {
        sctx.strokeStyle = poi.unlocked ? poi.color || '#67E8F9' : '#94A3B8';
        sctx.lineWidth = 2.4;
        sctx.beginPath();
        sctx.arc(px, py, 5.2, 0, Math.PI * 2);
        sctx.stroke();
      } else if (poi.id === 'outpost') {
        sctx.fillStyle = '#FDE047';
        sctx.beginPath();
        sctx.arc(px, py, 4.2, 0, Math.PI * 2);
        sctx.fill();
      }
    }
    sctx.restore();
    return this._minimapStaticCanvas;
  }

  _drawMiniMap() {
    const ctx = this.minimapCtx;
    if (!ctx || !this.active || !this.layout) return;
    const S = 144;
    const cx = S / 2;
    const cy = S / 2;
    const R = 66;
    const hs = this.halfSize || 36;
    const scale = (R - 10) / hs;
    const curReg = this._currentRegionId();
    const rMeta = REGION_META[curReg] || REGION_META.meadow;
    const now = Date.now() + (this.world?.serverOffset || 0);

    ctx.clearRect(0, 0, S, S);
    const staticCanvas = this._ensureMinimapStaticLayer(curReg, hs);
    if (staticCanvas) {
      ctx.drawImage(staticCanvas, 0, 0);
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
    ctx.clip();

    // 2. Resource nodes (batched by color into single paths — 0 per-node fill churn)
    const buckets = this._mmNodeBuckets || (this._mmNodeBuckets = new Map());
    for (const arr of buckets.values()) arr.length = 0;
    for (const node of this.layout.nodes || []) {
      const depleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const col = depleted ? 'depleted' : this._getNodeDotColor(node.type);
      let arr = buckets.get(col);
      if (!arr) {
        arr = [];
        buckets.set(col, arr);
      }
      arr.push(cx + node.x * scale, cy + node.z * scale);
    }
    for (const [col, pts] of buckets.entries()) {
      if (!pts.length) continue;
      const isDep = col === 'depleted';
      const rad = isDep ? 1.5 : 2.2;
      ctx.fillStyle = isDep ? 'rgba(148, 163, 184, 0.25)' : col;
      ctx.globalAlpha = isDep ? 0.45 : 0.82;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const px = pts[i];
        const py = pts[i + 1];
        ctx.moveTo(px + rad, py);
        ctx.arc(px, py, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Monsters & Star-Crowned Alpha Elites (5-point golden radar star!)
    ctx.fillStyle = '#F87171';
    ctx.beginPath();
    let hasNormalMobs = false;
    for (const mon of this.activeMonsters.values()) {
      if (!mon || mon.hp <= 0 || mon.isBoss || mon.isElite) continue;
      const px = cx + mon.x * scale;
      const py = cy + mon.z * scale;
      ctx.moveTo(px + 2.3, py);
      ctx.arc(px, py, 2.3, 0, Math.PI * 2);
      hasNormalMobs = true;
    }
    if (hasNormalMobs) ctx.fill();

    for (const mon of this.activeMonsters.values()) {
      if (!mon || mon.hp <= 0) continue;
      if (!mon.isBoss && !mon.isElite) continue;
      const px = cx + mon.x * scale;
      const py = cy + mon.z * scale;
      if (mon.isElite && !mon.isBoss) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 5.4 + Math.sin(this.elapsed * 5.5) * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        this._drawCanvasStar(ctx, px, py, 5, 5.1, 2.3);
        ctx.fillStyle = '#FDE047';
        ctx.fill();
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FB7185';
        ctx.strokeStyle = '#FFF1F2';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 4.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 5. Co-op Shardmates
    const local = this.world?.local;
    const partnerId = local?.profile?.partner_id;
    if (this.world?.remotes?.size) {
      for (const r of this.world.remotes.values()) {
        if (!r) continue;
        const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
        const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
        const px = cx + rx * scale;
        const py = cy + rz * scale;
        const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
        ctx.fillStyle = isPartner ? '#F472B6' : '#60A5FA';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, isPartner ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 6. Active Navigation Route Line + Local Player Arrow
    if (local) {
      const lx = cx + local.x * scale;
      const lz = cy + local.z * scale;
      const route = this._getActiveRoutePoint();
      if (route && Math.hypot(route.x - local.x, route.z - local.z) > 1.8) {
        const tx = cx + route.x * scale;
        const tz = cy + route.z * scale;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lx, lz);
        ctx.lineTo(tx, tz);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, tz, 4.2 + Math.sin(this.elapsed * 6) * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const vx = local.mover?.vx || 0;
      const vz = local.mover?.vz || 0;
      const heading = Math.hypot(vx, vz) > 0.12
        ? Math.atan2(vz, vx)
        : (local.rig?.facing?.back ? -Math.PI / 2 : Math.PI / 2);

      ctx.save();
      ctx.translate(lx, lz);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.8, 5.2);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.8, 5.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Cardinal N badge (zero shadowBlur)
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(18, 12, 8, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText('N', cx, 5);
    ctx.fillStyle = '#FDE047';
    ctx.fillText('N', cx, 5);
    ctx.restore();

    if (this.minimapPillEl) {
      let pillTxt;
      if (this._navTarget) {
        const rem = local ? Math.max(0, Math.round(Math.hypot(this._navTarget.x - local.x, this._navTarget.z - local.z))) : 0;
        pillTxt = `🧭 ${rem}m`;
      } else {
        const remoteCount = this.world?.remotes?.size || 0;
        const curP = Math.max(Number(this.layout?.players) || 1, 1 + remoteCount);
        const maxP = Number(this.layout?.maxPlayers) || 10;
        pillTxt = `${rMeta.icon} ${curP}/${maxP}`;
      }
      if (this.minimapPillEl.textContent !== pillTxt) this.minimapPillEl.textContent = pillTxt;
    }
  }

  _ensureBigmapStaticLayer(inspectReg, hs) {
    const key = `${inspectReg}:${hs}:${this._gateUnlockMask()}`;
    if (this._bigmapStaticCanvas && this._bigmapStaticKey === key) {
      return this._bigmapStaticCanvas;
    }
    if (typeof document === 'undefined') return null;
    if (!this._bigmapStaticCanvas) {
      this._bigmapStaticCanvas = document.createElement('canvas');
      this._bigmapStaticCanvas.width = 560;
      this._bigmapStaticCanvas.height = 560;
    }
    this._bigmapStaticKey = key;
    const sctx = this._bigmapStaticCanvas.getContext('2d');
    if (!sctx) return null;

    const S = 280;
    const pad = 16;
    const inner = S - pad * 2;
    const cx = S / 2;
    const cy = S / 2;
    const scale = (inner / 2) / hs;

    sctx.clearRect(0, 0, S * 2, S * 2);
    sctx.save();
    sctx.scale(2, 2);

    // 1. Illustrated Map Square (4-Biome Palette)
    sctx.beginPath();
    sctx.roundRect(pad - 6, pad - 6, inner + 12, inner + 12, 14);
    const grd = sctx.createRadialGradient(cx, cy, 16, cx, cy, inner * 0.72);
    if (inspectReg === 'caldera') {
      grd.addColorStop(0, '#3C2854');
      grd.addColorStop(1, '#1A1128');
    } else if (inspectReg === 'reef') {
      grd.addColorStop(0, '#3D8884');
      grd.addColorStop(1, '#1E4C52');
    } else if (inspectReg === 'hollow') {
      grd.addColorStop(0, '#224759');
      grd.addColorStop(1, '#102430');
    } else {
      grd.addColorStop(0, '#4E6F3A');
      grd.addColorStop(1, '#2D4322');
    }
    sctx.fillStyle = grd;
    sctx.fill();
    sctx.lineWidth = 2;
    sctx.strokeStyle = 'rgba(235, 198, 122, 0.55)';
    sctx.stroke();

    // Grid lines
    sctx.strokeStyle = 'rgba(255, 244, 214, 0.10)';
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let g = -2; g <= 2; g++) {
      const off = (g / 3) * (inner / 2);
      sctx.moveTo(cx + off, pad);
      sctx.lineTo(cx + off, S - pad);
      sctx.moveTo(pad, cy + off);
      sctx.lineTo(S - pad, cy + off);
    }
    sctx.stroke();

    // 4-Biome Roads / Crystal Veins / Lagoon / Caldera Veins
    if (inspectReg === 'meadow') {
      sctx.strokeStyle = 'rgba(218, 181, 128, 0.48)';
      sctx.lineWidth = 8;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(cx, cy + 28 * scale);
      sctx.lineTo(cx, cy - 32 * scale);
      sctx.moveTo(cx, cy + 4 * scale);
      sctx.lineTo(cx + 20 * scale, cy + 12 * scale);
      sctx.moveTo(cx, cy + 4 * scale);
      sctx.lineTo(cx - 22 * scale, cy + 8 * scale);
      sctx.stroke();
    } else if (inspectReg === 'hollow') {
      sctx.strokeStyle = 'rgba(103, 232, 249, 0.30)';
      sctx.lineWidth = 6;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(cx, cy + 30 * scale);
      sctx.lineTo(cx, cy - 26 * scale);
      sctx.moveTo(cx - 20 * scale, cy);
      sctx.lineTo(cx, cy + 6 * scale);
      sctx.lineTo(cx + 20 * scale, cy - 10 * scale);
      sctx.stroke();
      sctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
      sctx.beginPath();
      sctx.arc(cx - 20 * scale, cy, 15, 0, Math.PI * 2);
      sctx.arc(cx + 20 * scale, cy - 10 * scale, 14, 0, Math.PI * 2);
      sctx.arc(cx, cy - 26 * scale, 17, 0, Math.PI * 2);
      sctx.fill();
    } else if (inspectReg === 'reef') {
      sctx.fillStyle = 'rgba(153, 246, 228, 0.24)';
      sctx.beginPath();
      sctx.arc(cx + 22 * scale, cy + 10 * scale, 18, 0, Math.PI * 2);
      sctx.arc(cx + 20 * scale, cy - 14 * scale, 18, 0, Math.PI * 2);
      sctx.fill();
    } else if (inspectReg === 'caldera') {
      sctx.strokeStyle = 'rgba(251, 146, 60, 0.36)';
      sctx.lineWidth = 5;
      sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(cx - 22 * scale, cy + 10 * scale);
      sctx.lineTo(cx, cy + 6 * scale);
      sctx.lineTo(cx + 22 * scale, cy + 10 * scale);
      sctx.moveTo(cx, cy + 6 * scale);
      sctx.lineTo(cx, cy - 26 * scale);
      sctx.stroke();
    }

    sctx.restore();
    return this._bigmapStaticCanvas;
  }

  _drawBigMap() {
    const ctx = this._bigMapCtx;
    if (!ctx || !this.active || !this.layout) return;
    const S = 280;
    const pad = 16;
    const inner = S - pad * 2;
    const cx = S / 2;
    const cy = S / 2;
    const curReg = this._currentRegionId();
    const inspectReg = REGION_META[this._mapInspectRegion] ? this._mapInspectRegion : curReg;
    const isSameReg = inspectReg === curReg;
    const hs = isSameReg ? (this.halfSize || 36) : (REGIONS[inspectReg]?.zone?.halfSize || 36);
    const scale = (inner / 2) / hs;
    const now = Date.now() + (this.world?.serverOffset || 0);

    ctx.clearRect(0, 0, S * 2, S * 2);
    const staticCanvas = this._ensureBigmapStaticLayer(inspectReg, hs);
    if (staticCanvas) {
      ctx.drawImage(staticCanvas, 0, 0);
    }

    ctx.save();
    ctx.scale(2, 2);

    // 2. Resource Nodes (batched by color when inspecting active region)
    if (isSameReg) {
      const buckets = this._bmNodeBuckets || (this._bmNodeBuckets = new Map());
      for (const arr of buckets.values()) arr.length = 0;
      for (const node of this.layout.nodes || []) {
        const depleted = Boolean(node.depletedUntil && node.depletedUntil > now);
        const col = depleted ? 'depleted' : this._getNodeDotColor(node.type);
        let arr = buckets.get(col);
        if (!arr) {
          arr = [];
          buckets.set(col, arr);
        }
        arr.push(cx + node.x * scale, cy + node.z * scale);
      }
      for (const [col, pts] of buckets.entries()) {
        if (!pts.length) continue;
        const isDep = col === 'depleted';
        const rad = isDep ? 2.2 : 3.4;
        ctx.fillStyle = isDep ? 'rgba(148,163,184,0.28)' : col;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 2) {
          const px = pts[i];
          const py = pts[i + 1];
          ctx.moveTo(px + rad, py);
          ctx.arc(px, py, rad, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // 3. Monsters & Star-Crowned Alpha Elites
      ctx.fillStyle = '#F87171';
      ctx.beginPath();
      let hasMobs = false;
      for (const mon of this.activeMonsters.values()) {
        if (!mon || mon.hp <= 0 || mon.isBoss || mon.isElite) continue;
        const px = cx + mon.x * scale;
        const py = cy + mon.z * scale;
        ctx.moveTo(px + 3.2, py);
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        hasMobs = true;
      }
      if (hasMobs) ctx.fill();

      for (const mon of this.activeMonsters.values()) {
        if (!mon || mon.hp <= 0) continue;
        if (!mon.isBoss && !mon.isElite) continue;
        const px = cx + mon.x * scale;
        const py = cy + mon.z * scale;
        if (mon.isElite && !mon.isBoss) {
          this._drawCanvasStar(ctx, px, py, 5, 7.2, 3.3);
          ctx.fillStyle = '#FDE047';
          ctx.fill();
          ctx.strokeStyle = '#92400E';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#FB7185';
          ctx.strokeStyle = '#FFF1F2';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(px, py, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 4. Route line
    const local = this.world?.local;
    if (isSameReg && local) {
      const lx = cx + local.x * scale;
      const lz = cy + local.z * scale;
      const route = this._getActiveRoutePoint();
      if (route && Math.hypot(route.x - local.x, route.z - local.z) > 1.8) {
        const tx = cx + route.x * scale;
        const tz = cy + route.z * scale;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, lz);
        ctx.lineTo(tx, tz);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Landmark Pins & Labels (crisp strokeText — zero shadowBlur stall)
    const pois = this._getRegionPois(inspectReg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const poi of pois) {
      const px = cx + poi.x * scale;
      const py = cy + poi.z * scale;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = poi.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(poi.icon, px, py + 0.5);

      ctx.font = '800 9.5px system-ui, sans-serif';
      const labelY = py < 36 ? py + 16 : py - 15;
      ctx.strokeStyle = 'rgba(10, 12, 20, 0.92)';
      ctx.lineWidth = 2.8;
      ctx.strokeText(poi.short, px, labelY);
      ctx.fillStyle = '#FFFBEB';
      ctx.fillText(poi.short, px, labelY);
    }

    // 6. Co-op Shardmates & 7. Local Player ("YOU") Arrow
    if (isSameReg) {
      const partnerId = local?.profile?.partner_id;
      for (const r of this.world?.remotes?.values?.() || []) {
        const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
        const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
        const px = cx + rx * scale;
        const py = cy + rz * scale;
        const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
        ctx.fillStyle = isPartner ? '#F472B6' : '#60A5FA';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(px, py, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (local) {
        const lx = cx + local.x * scale;
        const lz = cy + local.z * scale;
        const vx = local.mover?.vx || 0;
        const vz = local.mover?.vz || 0;
        const heading = Math.hypot(vx, vz) > 0.12
          ? Math.atan2(vz, vx)
          : (local.rig?.facing?.back ? -Math.PI / 2 : Math.PI / 2);

        ctx.save();
        ctx.translate(lx, lz);
        ctx.rotate(heading + Math.PI / 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(6.5, 7);
        ctx.lineTo(0, 3.5);
        ctx.lineTo(-6.5, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ------------------------------------------------------------------ Monster Skills, Aiming, Scroll Drops & Skill Book
  _buildSkillAimIndicator() {
    const group = new THREE.Group();
    group.name = 'sf_skill_aim_indicator';
    group.visible = false;

    const ringGeo = new THREE.RingGeometry(0.84, 1.0, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.042;
    group.add(ringMesh);

    const fillGeo = new THREE.CircleGeometry(1.0, 36);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.20,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.y = 0.036;
    group.add(fillMesh);

    const lineGeo = new THREE.PlaneGeometry(1.0, 1.0);
    lineGeo.rotateX(-Math.PI / 2);
    lineGeo.translate(0, 0, 0.5);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x7DD3FC,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.position.y = 0.04;
    lineMesh.visible = false;
    group.add(lineMesh);

    group.userData = { ringMesh, ringMat, fillMesh, fillMat, lineMesh, lineMat };
    this.skillAimGroup = group;
    this.root.add(group);
  }

  /** Weapon Echo modifiers for (skill, current weapon class) — cached so per-frame aim updates stay allocation-free. */
  _skillEcho(skillId) {
    const cls = this._getActiveWeaponInfo?.()?.weaponClass || 'melee';
    const cache = this._echoCache || (this._echoCache = new Map());
    let byCls = cache.get(cls);
    if (!byCls) {
      byCls = new Map();
      cache.set(cls, byCls);
    }
    let echo = byCls.get(skillId);
    if (!echo) {
      try {
        echo = weaponEchoFor(skillId, cls);
      } catch {
        echo = null;
      }
      if (!echo) echo = { radiusMult: 1, rangeMult: 1 };
      byCls.set(skillId, echo);
    }
    return echo;
  }

  /** Echo-scaled reach numbers shared by aim preview, drag, auto-aim and smart auto-cast. */
  _skillReach(skDef, skillId) {
    const echo = this._skillEcho(skillId);
    const rangeMult = Number(echo.rangeMult) || 1;
    const radiusMult = Number(echo.radiusMult) || 1;
    return {
      rangeMult,
      radiusMult,
      castRange: (skDef?.castRange || skDef?.range || 7.5) * rangeMult,
      range: (skDef?.range || skDef?.dashDist || 7.8) * rangeMult,
      radius: (skDef?.radius || 4.2) * radiusMult,
    };
  }

  _updateSkillAimMesh() {
    const st = this._skillAimState;
    const local = this.world?.local;
    const grp = this.skillAimGroup;
    if (!st || !local || !grp) return;
    const sk = MONSTER_SKILLS[st.skillId];
    if (!sk) return;
    const echo = this._skillEcho(st.skillId);
    const rangeMult = Number(echo.rangeMult) || 1;
    const radiusMult = Number(echo.radiusMult) || 1;

    grp.visible = true;
    const { ringMesh, fillMesh, lineMesh } = grp.userData;
    const angle = Math.atan2(st.facing.x, st.facing.z);

    if (sk.aimType === 'line' || sk.aimType === 'cone') {
      grp.position.set(local.x, 0, local.z);
      ringMesh.visible = false;
      fillMesh.visible = false;
      lineMesh.visible = true;
      // Ranged Echo stretches cone/line reach; Melee Echo widens the Tusk Rush lane
      const len = (sk.length || sk.range || sk.dashDist || 5.6) * rangeMult;
      const wid = (sk.aimType === 'cone' ? (sk.range || 5.6) * 0.72 * rangeMult : (sk.lineWidth || sk.width || 1.9)) * radiusMult;
      lineMesh.scale.set(wid, 1, len);
      lineMesh.rotation.y = angle;
    } else if (sk.aimType === 'ground' || sk.aimType === 'ground_aoe') {
      grp.position.set(st.targetX, 0, st.targetZ);
      const r = sk.radius || 4.6;
      ringMesh.visible = true;
      fillMesh.visible = true;
      lineMesh.visible = false;
      ringMesh.scale.set(r, 1, r);
      fillMesh.scale.set(r, 1, r);
    } else {
      grp.position.set(local.x, 0, local.z);
      const r = (sk.aimType === 'homing' || sk.aimType === 'chain')
        ? (sk.range || 8.0) * rangeMult // homing/chain preview their (Ranged-Echo) seek radius
        : (sk.radius || 4.2) * radiusMult;
      ringMesh.visible = true;
      fillMesh.visible = true;
      lineMesh.visible = false;
      ringMesh.scale.set(r, 1, r);
      fillMesh.scale.set(r, 1, r);
    }
  }

  _cancelSkillAim() {
    this._skillAimState = null;
    if (this.skillAimGroup) this.skillAimGroup.visible = false;
  }

  _resolveAutoSkillDirection(skDef) {
    const local = this.world?.local;
    if (!local) return { facing: { x: 0, z: 1 }, targetX: 0, targetZ: 0 };
    let mon = this.targetMonster ? this.activeMonsters.get(this.targetMonster.id) : null;
    const reachInfo = this._skillReach(skDef, skDef?.id);
    if (!mon || mon.hp <= 0) {
      let bestD = Math.max(10.5, (skDef?.range || skDef?.castRange || 7.8) * reachInfo.rangeMult + 1.2);
      for (const m of this.activeMonsters.values()) {
        if (!m || m.hp <= 0) continue;
        const d = Math.hypot(m.x - local.x, m.z - local.z);
        if (d < bestD) {
          bestD = d;
          mon = m;
        }
      }
    }
    let fx = 0;
    let fz = 1;
    let tx = local.x;
    let tz = local.z + 2.2;
    if (mon) {
      const dx = mon.x - local.x;
      const dz = mon.z - local.z;
      const d = Math.hypot(dx, dz) || 1;
      fx = dx / d;
      fz = dz / d;
      const maxGroundDist = Math.min(d, reachInfo.castRange);
      const isGroundAim = skDef?.aimType === 'ground' || skDef?.aimType === 'ground_aoe';
      tx = isGroundAim ? local.x + fx * maxGroundDist : mon.x;
      tz = isGroundAim ? local.z + fz * maxGroundDist : mon.z;
    } else if (local.rig?.facing) {
      fx = local.rig.facing.right ? 0.85 : -0.85;
      fz = local.rig.facing.back ? -0.52 : 0.52;
      const d = Math.hypot(fx, fz) || 1;
      fx /= d;
      fz /= d;
      tx = local.x + fx * 3.0;
      tz = local.z + fz * 3.0;
    }
    return {
      facing: { x: +fx.toFixed(3), z: +fz.toFixed(3) },
      targetX: +tx.toFixed(2),
      targetZ: +tz.toFixed(2),
    };
  }

  // ---------------------------------------------------------------- Master Crafters 4-slot helpers
  /** Normalised skills state: equipped padded to 4, passives/presets/essence defaults. */
  _getSkillsState(p = null) {
    const prof = p || this._getProfile();
    const s = prof?.frontier?.skills || {};
    return {
      unlocked: s.unlocked || {},
      equipped: sfPadEquipped(s.equipped),
      passive: s.passive || null,
      passives: s.passives || {},
      presets: Array.isArray(s.presets) ? s.presets : [null, null, null],
      essence: Number(s.essence) || 0,
      reactionsFound: s.reactionsFound || {},
    };
  }

  _getSlotUnlocks(p = null) {
    try {
      const prof = p || this._getProfile();
      const res = skillSlotUnlocks(prof);
      if (Array.isArray(res) && res.length >= SF_SLOT_COUNT) return res;
    } catch {
      // fall through to safe default
    }
    return [true, true, false, false];
  }

  _skillSlotUnlocked(slotIdx) {
    const u = this._slotUnlocks || this._getSlotUnlocks();
    return Boolean(u[slotIdx]);
  }

  _showSlotLockedToast(slotIdx) {
    const hint = SLOT_UNLOCK_RULES?.[slotIdx]?.hint || 'Locked';
    this.toast?.(`🔒 Skill Slot ${slotIdx + 1} locked — ${hint}`, 2200);
  }

  /** First empty UNLOCKED slot, or -1. */
  _firstEmptyUnlockedSlot(eq, unlocks) {
    for (let i = 0; i < SF_SLOT_COUNT; i++) {
      if (unlocks[i] && !eq[i]) return i;
    }
    return -1;
  }

  _onSkillPointerDown(slotIdx, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this._skillSlotUnlocked(slotIdx)) {
      this._showSlotLockedToast(slotIdx);
      return;
    }
    const p = this._getProfile();
    const eq = sfPadEquipped(p?.frontier?.skills?.equipped);
    const skillId = eq[slotIdx] || null;
    if (!skillId || !MONSTER_SKILLS[skillId]) {
      this.openSkillModal();
      return;
    }
    const now = Date.now() + (this.world?.serverOffset || 0);
    if (now < (this.skillCds[slotIdx] || 0)) {
      const sec = Math.max(0.1, ((this.skillCds[slotIdx] - now) / 1000)).toFixed(1);
      this.toast?.(`⏳ ${MONSTER_SKILLS[skillId].name} ready in ${sec}s`, 1200);
      return;
    }

    const skDef = MONSTER_SKILLS[skillId];
    const autoAim = this._resolveAutoSkillDirection(skDef);
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore synthetic events
    }
    this._skillAimState = {
      slotIdx,
      skillId,
      pointerId: e.pointerId,
      startX: e.clientX || 0,
      startY: e.clientY || 0,
      dragged: false,
      facing: autoAim.facing,
      targetX: autoAim.targetX,
      targetZ: autoAim.targetZ,
    };
    this._updateSkillAimMesh();
  }

  _onSkillPointerMove(slotIdx, e) {
    const st = this._skillAimState;
    if (!st || st.slotIdx !== slotIdx || st.pointerId !== e.pointerId) return;
    const dx = (e.clientX || 0) - st.startX;
    const dy = (e.clientY || 0) - st.startY;
    const distPx = Math.hypot(dx, dy);
    if (distPx < 12) return;
    st.dragged = true;
    const len = distPx || 1;
    const fx = dx / len;
    const fz = dy / len;
    st.facing = { x: +fx.toFixed(3), z: +fz.toFixed(3) };
    const local = this.world?.local;
    const skDef = MONSTER_SKILLS[st.skillId];
    if (local) {
      const reach = Math.min(1, (distPx - 12) / 56) * this._skillReach(skDef, st.skillId).castRange;
      st.targetX = +(local.x + fx * Math.max(1.2, reach)).toFixed(2);
      st.targetZ = +(local.z + fz * Math.max(1.2, reach)).toFixed(2);
    }
    this._updateSkillAimMesh();
  }

  _onSkillPointerUp(slotIdx, e) {
    const st = this._skillAimState;
    if (!st || st.slotIdx !== slotIdx) return;
    try {
      e.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const opts = {
      facing: st.facing,
      targetX: st.targetX,
      targetZ: st.targetZ,
    };
    this._cancelSkillAim();
    this.castMonsterSkill(slotIdx, opts);
  }

  updateSkillButtons(profile = null) {
    const p = profile || this._getProfile();
    const skills = p?.frontier?.skills || { unlocked: {}, equipped: [null, null, null, null] };
    const eq = sfPadEquipped(skills.equipped);
    const unlocked = skills.unlocked || {};
    const unlockedCount = Object.values(unlocked).filter((lv) => Number(lv) >= 1).length;
    const slotUnlocks = this._getSlotUnlocks(p).slice();
    if (this._serverLockedSlots?.size) {
      for (const li of this._serverLockedSlots) {
        if (li >= 0 && li < slotUnlocks.length) slotUnlocks[li] = false;
      }
    }
    this._slotUnlocks = slotUnlocks;

    if (this.skillBookBtnEl) {
      this.skillBookBtnEl.textContent = unlockedCount > 0 ? `📖 Skills (${unlockedCount}/20)` : '📖 Skills';
    }

    const eqKey = eq.map((id) => id || '').join('|');
    if (eqKey !== this._lastWarmEqKey) {
      this._lastWarmEqKey = eqKey;
      const validEq = eq.filter((id) => id && MONSTER_SKILLS[id]);
      if (validEq.length) {
        this.skillVfx?.warmPriority?.(validEq);
      }
    }

    for (let i = 0; i < SF_SLOT_COUNT; i++) {
      const btn = this.skillBtnEls?.[i];
      const ico = this.skillIcoEls?.[i];
      const lvEl = this.skillLvEls?.[i];
      if (!btn || !ico || !lvEl) continue;
      const isLocked = !slotUnlocks[i];
      btn.classList.toggle('locked', isLocked);
      if (isLocked) {
        btn.classList.add('empty');
        btn.classList.remove('ready', 'lv5');
        ico.textContent = '🔒';
        lvEl.style.display = 'none';
        btn.title = `Skill Slot ${i + 1} locked — ${SLOT_UNLOCK_RULES?.[i]?.hint || 'Locked'}`;
        continue;
      }
      const skId = eq[i];
      const skDef = skId ? MONSTER_SKILLS[skId] : null;
      const lv = skDef ? Math.max(1, Number(unlocked[skId]) || 1) : 0;
      if (skDef) {
        btn.classList.remove('empty');
        btn.classList.toggle('lv5', lv >= 5);
        ico.textContent = skDef.icon || '✨';
        lvEl.style.display = 'inline-block';
        lvEl.textContent = lv >= 5 ? 'MAX' : `Lv.${lv}`;
        btn.title = `${skDef.name} (Lv.${lv}) — Tap or Drag to Cast! [${i + 1}]`;
      } else {
        btn.classList.add('empty');
        btn.classList.remove('ready', 'lv5');
        ico.textContent = '➕';
        lvEl.style.display = 'none';
        btn.title = `Empty Skill Slot ${i + 1} — Tap to open Monster Skill Book`;
      }
    }

    // Passive chip
    if (this.passiveChipEl) {
      const psId = skills.passive && MONSTER_PASSIVES[skills.passive] ? skills.passive : null;
      const psLv = psId ? Math.max(1, Number(skills.passives?.[psId]) || 1) : 0;
      const psDef = psId ? MONSTER_PASSIVES[psId] : null;
      this.passiveChipEl.classList.toggle('empty', !psDef);
      if (this.passiveIcoEl && this._lastPassiveIcoKey !== (psId || '')) {
        this._lastPassiveIcoKey = psId || '';
        this.passiveIcoEl.innerHTML = psDef ? sfComboIconHtml('passive', psId, psDef.icon, 18) : '🏅';
      }
      if (this.passiveLvEl) {
        this.passiveLvEl.style.display = psDef ? 'inline-block' : 'none';
        this.passiveLvEl.textContent = psLv >= 3 ? 'M' : String(psLv);
      }
      this.passiveChipEl.title = psDef
        ? `🏅 ${psDef.name} Lv.${psLv} — ${passiveDescFor(psId, psLv)}`
        : '🏅 Passive Slot empty — monsters rarely drop Passives (tap to view)';
    }
  }

  async castMonsterSkill(slotIdx, opts = {}) {
    const local = this.world?.local;
    if (!local) return false;
    const p = this._getProfile();
    // Auto-casts never toast (only manual taps explain a rejection)
    const isAuto = Boolean(opts.auto);
    if (!this._skillSlotUnlocked(slotIdx)) {
      if (!isAuto) this._showSlotLockedToast(slotIdx);
      return false;
    }
    const skills = p?.frontier?.skills || { unlocked: {}, equipped: [null, null, null, null] };
    const skillId = skills.equipped?.[slotIdx];
    const skDef = skillId ? MONSTER_SKILLS[skillId] : null;
    if (!skDef) {
      if (!isAuto) this.openSkillModal();
      return false;
    }

    const now = Date.now() + (this.world?.serverOffset || 0);
    if (now < (this.skillCds[slotIdx] || 0)) return false;

    const level = Math.max(1, Math.min(5, Number(skills.unlocked?.[skillId]) || 1));
    const autoAim = this._resolveAutoSkillDirection(skDef);
    const facing = opts.facing || autoAim.facing;
    const targetX = Number.isFinite(opts.targetX) ? opts.targetX : autoAim.targetX;
    const targetZ = Number.isFinite(opts.targetZ) ? opts.targetZ : autoAim.targetZ;

    const uni = computeUniversalStats(p);
    const predCdMs = skillCooldownMs(skillId, uni.total);
    this.skillTotalCds[slotIdx] = predCdMs;
    this.skillCds[slotIdx] = now + predCdMs;

    // Zero-latency local 4-phase ToS × Frieren VFX + ChibiRig choreography + predicted dash/zone!
    const originX = local.x;
    const originZ = local.z;
    this.world?.flushMoveNow?.(true);
    this._lastLocalSkillFxKey = `${skillId}:${slotIdx}`;
    this._lastLocalSkillFxAt = performance.now();
    if (this._heldTool) {
      local.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    local.rig?.facing?.set?.(facing.x >= 0, facing.z < -0.35);

    let predictedDash = false;
    if (skillId === 'sk_tusk_rush') {
      this.world?.startLocalDash?.(originX + facing.x * 5.2, originZ + facing.z * 5.2, { durMs: 175, hopHeight: 0 });
      predictedDash = true;
    } else if (skillId === 'sk_zephyr_vault') {
      this.world?.startLocalDash?.(originX - facing.x * 3.4, originZ - facing.z * 3.4, { durMs: 175, hopHeight: 0.92 });
      predictedDash = true;
    }

    let predictedZone = null;
    if (skillId === 'sk_pollen_ring') {
      predictedZone = this._spawnSkillZoneRing('pollen_ring', originX, originZ, skDef.radius || 4.4, 5000, null);
    } else if (skillId === 'sk_koi_whirlpool') {
      predictedZone = this._spawnSkillZoneRing('koi_whirlpool', targetX, targetZ, skDef.radius || 4.6, 4000, null);
    } else if (skillId === 'sk_sakura_tempest') {
      predictedZone = this._spawnSkillZoneRing('sakura_tempest', originX, originZ, skDef.radius || 5.6, 3000, local.id);
    } else if (skillId === 'sk_solar_meteor') {
      predictedZone = this._spawnSkillZoneRing('solar_burn', targetX, targetZ, skDef.radius || 4.4, 3000, null);
    }
    let spawnedFx = null;
    // P0: a rejected cast must not leave the player dashed or a phantom zone/VFX on the ground
    const rollbackPrediction = () => {
      if (predictedDash) {
        if (this.world?.reconcileLocalDash) this.world.reconcileLocalDash(originX, originZ, { hopHeight: 0 });
        else if (this.world?.startLocalDash) this.world.startLocalDash(originX, originZ, { durMs: 140, hopHeight: 0 });
        else this.world?.setLocalPosition?.(originX, originZ);
      }
      if (predictedZone) {
        predictedZone.age = predictedZone.life; // reaped (removed + disposed) by the zone loop next frame
        if (predictedZone.group) predictedZone.group.visible = false;
      }
      spawnedFx?.stop?.();
      if (this._lastLocalSkillFxKey === `${skillId}:${slotIdx}`) this._lastLocalSkillFxAt = 0;
    };

    spawnedFx = this.skillVfx?.spawnEffect?.({
      vfxId: skillId,
      level,
      x: originX,
      z: originZ,
      targetX,
      targetZ,
      facing,
      casterRig: local.rig,
    });
    this.showOverheadCastCallout(local.id, `${skDef.icon} ${skDef.name}!`);
    this.playGatherSfx('perfect', 2);

    const skillSeq = ++this._localAtkSeq;
    const prevBySkill = this._pendingLocalSkill?.bySkill || {};
    const skillEntry = { seq: skillSeq, skillId, slotIdx, applied: false, at: performance.now() };
    skillEntry.bySkill = { ...prevBySkill, [skillId]: skillEntry };
    this._pendingLocalSkill = skillEntry;

    try {
      const res = await this.request('sf_attack', {
        skillSlot: slotIdx,
        skillId,
        facing,
        targetX,
        targetZ,
      });
      if (!res || !res.ok) rollbackPrediction();
      if (!res) {
        this.skillCds[slotIdx] = Date.now() + (this.world?.serverOffset || 0) + 1500; // short backoff on a dropped reply
        return false;
      }
      if (res.ok) {
        if (res.cooldownMs) this.skillTotalCds[slotIdx] = res.cooldownMs;
        if (res.cooldownUntil) {
          this.skillCds[slotIdx] = res.cooldownUntil;
        }
        // ⏳ Time Lock (sk_time_dilation) refunds the OTHER slots — trust the full server array
        if (Array.isArray(res.skillCds)) {
          for (let si = 0; si < SF_SLOT_COUNT && si < res.skillCds.length; si++) {
            if (Number.isFinite(res.skillCds[si])) this.skillCds[si] = res.skillCds[si];
          }
        }
        if (res.buffs) {
          this._applyServerBuffs?.(res.buffs, Date.now() + (this.world?.serverOffset || 0));
        }
        if (res.resonancePrimed) {
          const nowSrv = Date.now() + (this.world?.serverOffset || 0);
          this._resonanceUntil = Math.max(this._resonanceUntil || 0, Number(res.buffs?.resonanceUntil) || (nowSrv + (RESONANCE?.windowMs || 5000)));
        } else if (res.resonanceUsed) {
          this._resonanceUntil = 0;
        }
        const firstArrival = !skillEntry.applied;
        skillEntry.applied = true;
        if (Array.isArray(res.hits) && res.hits.length > 0) {
          this._applyMonsterHits(res.hits, { facing, isSkill: true, showFloats: firstArrival });
        }
        if (res.hitStates || res.frozenIds) {
          this._applyMonsterHitStates(res.hitStates, res.frozenIds);
        }
        return true;
      }
      // Rejection backoff: never let auto spam the same rejected request (or toasts)
      const nowSrv = Date.now() + (this.world?.serverOffset || 0);
      if (res.error === 'skill_cooldown') {
        this.skillCds[slotIdx] = nowSrv + (Number.isFinite(res.remainingMs) ? Math.max(250, res.remainingMs) : 1500);
      } else if (res.error === 'slot_locked') {
        this.skillCds[slotIdx] = nowSrv + 5000;
        // Mark the slot locked locally (server verdict wins until the next profile update)
        (this._serverLockedSlots || (this._serverLockedSlots = new Set())).add(slotIdx);
        this.updateSkillButtons?.();
        if (!isAuto) this._showSlotLockedToast(slotIdx);
      } else {
        this.skillCds[slotIdx] = nowSrv + 5000;
        if (!isAuto) {
          if (res.error === 'no_skill_equipped') {
            this.toast?.(`➕ Skill Slot ${slotIdx + 1} is empty — open 📖 Skills to equip`, 1800);
          } else if (res.error === 'out_of_range') {
            this.toast?.('📏 Target out of range', 1400);
          } else if (res.error) {
            this.toast?.(`⚠️ ${res.error}`, 1800);
          }
        }
      }
      // Hide the predicted cooldown sweep for a backoff (it's not a real cooldown)
      this.skillTotalCds[slotIdx] = Math.max(1000, this.skillCds[slotIdx] - nowSrv);
    } catch {
      rollbackPrediction();
      this.skillCds[slotIdx] = Date.now() + (this.world?.serverOffset || 0) + 1500;
    }
    return false;
  }

  _trySmartAutoCastSkills(now, targetMon) {
    if (!targetMon || targetMon.hp <= 0) return;
    if (now - (this._lastAutoSkillAt || 0) < 1350) return;
    const local = this.world?.local;
    const distToTarget = local ? Math.hypot(targetMon.x - local.x, targetMon.z - local.z) : 0;
    const p = this._getProfile();
    const eq = sfPadEquipped(p?.frontier?.skills?.equipped);
    const unlocks = this._slotUnlocks || this._getSlotUnlocks(p);
    const hpRatio = (this.playerHp?.hp || 100) / Math.max(1, this.playerHp?.maxHp || 100);
    const mask = Number(targetMon.tagMask) || 0;
    const weaponRange = this._getActiveWeaponInfo?.()?.range || 1.9;
    const resonanceActive = now < (this._resonanceUntil || 0);
    const bigFoe = Boolean(targetMon.isBoss || targetMon.isElite);
    const telegraphActive = bigFoe && (
      performance.now() < (targetMon._telegraphUntil || 0) ||
      (targetMon.isBoss && (this._bossTelegraphTimer || 0) > 0)
    );
    // Combo-ordered priority: 0 = PAYOFF vs current tags, 1 = SETUP (applies tags target lacks), 2 = any ready in range
    // (🎶 Resonance active → a burst/payoff damage skill jumps ahead so the prime is never wasted)
    let bestSlot = -1;
    let bestPrio = 99;
    for (let slotIdx = 0; slotIdx < SF_SLOT_COUNT; slotIdx++) {
      if (!unlocks[slotIdx]) continue;
      const skId = eq[slotIdx];
      const skDef = skId ? MONSTER_SKILLS[skId] : null;
      if (!skDef) continue;
      if (now < (this.skillCds[slotIdx] || 0)) continue;
      const reach = this._skillReach(skDef, skId);
      const isSustainBuff =
        skId === 'sk_pollen_ring' ||
        skId === 'sk_jelly_shield' ||
        skId === 'sk_mirror_shell' ||
        skId === 'sk_tailwind_gale';
      const isVault = skId === 'sk_zephyr_vault';
      // 🍃 Zephyr Vault is an ESCAPE (back-hop): only to dodge a boss/elite wind-up, or when HP < 45%
      if (isVault && !telegraphActive && hpRatio >= 0.45) continue;
      if (isSustainBuff) {
        if (hpRatio > 0.88 && !bigFoe) {
          continue;
        }
        // Must actually be engaged — no buffing while still walking up to the target
        const engageReach = Math.max(reach.radius, weaponRange) + 1.5;
        if (distToTarget > engageReach) continue;
      } else if (isVault) {
        // escape: no reach requirement
      } else if (skDef.aimType === 'self_aoe') {
        const selfReach = (skDef.pullRadius ? skDef.pullRadius * reach.radiusMult : reach.radius) - 0.1;
        if (distToTarget > selfReach) continue;
      } else if (skDef.aimType === 'ground' || skDef.aimType === 'ground_aoe') {
        const groundReach = reach.castRange + reach.radius * 0.55;
        if (distToTarget > groundReach) continue;
      } else {
        const dirReach = reach.range * 0.98;
        if (distToTarget > dirReach) continue;
      }
      let prio = 2;
      const payoff = Boolean(mask && isPayoffAgainst(skId, mask));
      const damaging = !sfIsResonancePrimer(skId) && !isVault;
      if (isVault) {
        prio = telegraphActive ? -2 : -1; // dodge first
      } else if (isSustainBuff) {
        // Low HP → sustain jumps the queue; otherwise it's a filler
        prio = hpRatio < 0.5 ? -1 : 2;
      } else if (resonanceActive && damaging && (payoff || SKILL_COMBO[skId]?.role === 'burst')) {
        prio = payoff ? -0.75 : -0.5;
      } else if (payoff) {
        prio = 0;
      } else {
        const applies = SKILL_COMBO[skId]?.applies || [];
        let setsNew = false;
        for (let k = 0; k < applies.length; k++) {
          const bit = STATUS_TAGS[applies[k]]?.bit || 0;
          if (bit && !(mask & bit)) { setsNew = true; break; }
        }
        if (setsNew) prio = 1;
        // Resonance up but no burst ready: any damaging skill still beats re-priming with another buff
        if (resonanceActive && damaging) prio -= 0.25;
      }
      if (prio < bestPrio) {
        bestPrio = prio;
        bestSlot = slotIdx;
      }
    }
    if (bestSlot >= 0) {
      this._lastAutoSkillAt = now;
      this.castMonsterSkill(bestSlot, { auto: true });
    }
  }

  _showScrollDropBanner(m) {
    if (!this.scrollBannerEl) return;
    const sk = MONSTER_SKILLS[m.skillId];
    if (!sk) return;
    if (this._scrollBannerTimer) clearTimeout(this._scrollBannerTimer);

    const isNew = Number(m.prevLevel || 0) === 0;
    const maxedGold = Number(m.maxedGold || 0);
    const p = this._getProfile();
    const eq = sfPadEquipped(p?.frontier?.skills?.equipped);
    const unlocks = this._getSlotUnlocks(p);
    const alreadyEquipped = eq.includes(m.skillId);
    const openSlots = [];
    for (let i = 0; i < SF_SLOT_COUNT; i++) if (unlocks[i]) openSlots.push(i);
    const allSlotsFull = this._firstEmptyUnlockedSlot(eq, unlocks) < 0;
    const essenceGain = Number(m.essenceGain || 0);
    const autoSlot = Number.isInteger(m.autoEquippedSlot) && m.autoEquippedSlot >= 0 && m.autoEquippedSlot < SF_SLOT_COUNT
      ? m.autoEquippedSlot
      : -1;

    const title = maxedGold > 0
      ? `📜 ${sk.icon} ${sk.name} MAX (+${maxedGold} 🪙)`
      : isNew
      ? `📜 NEW SKILL SCROLL! ${sk.icon} ${sk.name}`
      : `📜 SCROLL UPGRADE! ${sk.icon} ${sk.name} → Lv.${m.newLevel}`;
    const floorTxt = m.floor ? ' · 🎯 Guaranteed by the 30-kill floor!' : '';
    const essTxt = essenceGain > 0 ? ` · +${essenceGain} 🔮 Essence` : '';
    const sub = (autoSlot >= 0
      ? `Auto-equipped to Skill Slot ${autoSlot + 1}! Ready to cast!`
      : maxedGold > 0
      ? `Already Lv.5 MAX — converted into +${maxedGold} Gold!`
      : !alreadyEquipped && allSlotsFull
      ? 'Pick a slot to swap onto your Combat Arc!'
      : 'Tap ⚡ Equip to slot onto your Combat Arc!') + floorTxt + essTxt;

    const hasTopBarAlert = Boolean(this.activeBoss || (this.invasionState && this.invasionState.phase !== 'idle'));
    this.scrollBannerEl.classList.toggle('below-top-bar', hasTopBarAlert);

    const equipActionsHtml = alreadyEquipped
      ? `<button type="button" class="sf-map-btn" data-scroll-open-book="1">📖 View</button>`
      : allSlotsFull
      ? openSlots.map((i) => `<button type="button" class="sf-map-btn" data-scroll-equip="${m.skillId}" data-scroll-slot="${i}" title="Equip in Slot ${i + 1}" style="padding:4px 6px;">⚡${i + 1}</button>`).join('')
      : `<button type="button" class="sf-map-btn" data-scroll-equip="${m.skillId}">⚡ Equip</button>`;

    this.scrollBannerEl.innerHTML = `
      <div style="min-width:0;flex:1;">
        <div style="font-size:12px;font-weight:900;color:#FEF08A;line-height:1.2;">${title}</div>
        <div style="font-size:10.5px;font-weight:700;color:#E9D5FF;margin-top:2px;">${sub}</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
        ${equipActionsHtml}
        <button type="button" class="sf-map-close" data-scroll-dismiss="1" style="width:32px;height:32px;font-size:12px;">✕</button>
      </div>
    `;
    this.scrollBannerEl.hidden = false;
    this._scrollBannerTimer = setTimeout(() => {
      if (this.scrollBannerEl) this.scrollBannerEl.hidden = true;
    }, 6200);
  }

  async _onScrollBannerClick(e) {
    const dismiss = e.target.closest('[data-scroll-dismiss]');
    if (dismiss) {
      e.preventDefault();
      this.scrollBannerEl.hidden = true;
      return;
    }
    const openBook = e.target.closest('[data-scroll-open-book]');
    if (openBook) {
      e.preventDefault();
      this.scrollBannerEl.hidden = true;
      this.openSkillModal();
      return;
    }
    const openTab = e.target.closest('[data-scroll-open-tab]');
    if (openTab) {
      e.preventDefault();
      this.scrollBannerEl.hidden = true;
      this.openSkillModal(openTab.getAttribute('data-scroll-open-tab') || 'skills');
      return;
    }
    const eqPassive = e.target.closest('[data-scroll-equip-passive]');
    if (eqPassive) {
      e.preventDefault();
      await this._equipPassive(eqPassive.getAttribute('data-scroll-equip-passive'));
      this.scrollBannerEl.hidden = true;
      return;
    }
    const equipBtn = e.target.closest('[data-scroll-equip]');
    if (equipBtn) {
      e.preventDefault();
      const skillId = equipBtn.getAttribute('data-scroll-equip');
      const explicitSlot = equipBtn.getAttribute('data-scroll-slot');
      const p = this._getProfile();
      const eq = sfPadEquipped(p?.frontier?.skills?.equipped);
      const unlocks = this._getSlotUnlocks(p);
      const firstEmpty = this._firstEmptyUnlockedSlot(eq, unlocks);
      const slot = explicitSlot !== null && explicitSlot !== undefined
        ? Number(explicitSlot) || 0
        : (firstEmpty >= 0 ? firstEmpty : 0);
      await this._equipSkillSlot(slot, skillId);
      this.scrollBannerEl.hidden = true;
    }
  }

  async _equipSkillSlot(slot, skillId) {
    try {
      const res = await this.request('sf_pouch_set', {
        skillAction: 'equip',
        slot,
        skillId,
      });
      if (res?.ok) {
        const p = this._getProfile();
        if (p && res.skills) {
          p.frontier = p.frontier || {};
          p.frontier.skills = res.skills;
        }
        this.updateSkillButtons(p);
        if (this.skillModalOpen) this._renderSkillModalHtml(p);
        const sk = skillId ? MONSTER_SKILLS[skillId] : null;
        this.playGatherSfx('auto_on');
        if (sk) {
          this.toast?.(`⚡ Equipped ${sk.icon} ${sk.name} in Skill ${slot + 1}!`, 1900);
        } else {
          this.toast?.(`Cleared Skill ${slot + 1}`, 1400);
        }
      } else if (res?.error === 'slot_locked') {
        this._showSlotLockedToast(slot);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
    } catch {
      // ignore
    }
  }

  /** Applies a fresh `skills` object from the server and refreshes HUD + open modal. */
  _applySkillsFromServer(skills) {
    const p = this._getProfile();
    if (p && skills && typeof skills === 'object') {
      p.frontier = p.frontier || {};
      p.frontier.skills = skills;
    }
    this.updateSkillButtons(p);
    if (this.skillModalOpen) this._renderSkillModalHtml(p);
    return p;
  }

  async _equipPassive(passiveId) {
    try {
      const res = await this.request('sf_pouch_set', { skillAction: 'passive_equip', passiveId: passiveId || null });
      if (res?.ok) {
        this._applySkillsFromServer(res.skills);
        const ps = passiveId ? MONSTER_PASSIVES[passiveId] : null;
        this.playGatherSfx('auto_on');
        this.toast?.(ps ? `🏅 Passive equipped: ${ps.icon} ${ps.name}` : '🏅 Passive slot cleared', 1800);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
    } catch {
      // ignore
    }
  }

  /** Current (draft or saved) display name for preset `idx`. */
  _presetNameFor(idx, st = null) {
    const draft = this._presetNameDrafts?.[idx];
    if (typeof draft === 'string' && draft.trim()) return draft.trim().slice(0, 12);
    const cur = (st || this._getSkillsState()).presets?.[idx];
    return String(cur?.name || SF_PRESET_NAMES[idx] || `Set ${idx + 1}`).slice(0, 12);
  }

  /** Tap-to-cycle preset names (Farm → Boss → Co-Op → Raid → Solo) without opening the keyboard. */
  _cyclePresetName(idx) {
    const cur = this._presetNameFor(idx);
    const at = SF_PRESET_NAMES.indexOf(cur);
    const next = SF_PRESET_NAMES[(at + 1) % SF_PRESET_NAMES.length];
    (this._presetNameDrafts || (this._presetNameDrafts = {}))[idx] = next;
    const inp = this.skillModalEl?.querySelector?.(`[data-preset-name-input="${idx}"]`);
    if (inp) inp.value = next;
  }

  async _savePreset(idx) {
    if (this._presetBusy) return;
    // Name comes from the inline input / tap-to-cycle chip inside the preset card (mobile-friendly, no native dialog)
    const inp = this.skillModalEl?.querySelector?.(`[data-preset-name-input="${idx}"]`);
    if (inp && String(inp.value || '').trim()) {
      (this._presetNameDrafts || (this._presetNameDrafts = {}))[idx] = String(inp.value).slice(0, 12);
    }
    const name = this._presetNameFor(idx).replace(/[<>"]/g, '') || `Set ${idx + 1}`;
    if (inp) inp.blur?.();
    this._presetBusy = true;
    try {
      const res = await this.request('sf_pouch_set', { skillAction: 'preset_save', preset: idx, name });
      if (res?.ok) {
        if (this._presetNameDrafts) delete this._presetNameDrafts[idx];
        this._applySkillsFromServer(res.skills);
        this.playGatherSfx('auto_on');
        this.toast?.(`💾 Saved loadout “${name}”`, 1600);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
    } catch {
      // ignore
    } finally {
      this._presetBusy = false;
    }
  }

  async _loadPreset(idx) {
    if (this._presetBusy) return;
    this._presetBusy = true;
    try {
      const res = await this.request('sf_pouch_set', { skillAction: 'preset_load', preset: idx });
      if (res?.ok) {
        const p = this._applySkillsFromServer(res.skills);
        const preset = res.skills?.presets?.[idx];
        this.playGatherSfx('auto_on');
        this.toast?.(`📂 Loadout “${preset?.name || `Set ${idx + 1}`}” equipped`, 1600);
        // Swap glamour weapon too when the preset stored a different one (same message as the quick-weapon swap)
        const wantGlam = res.glamourGloves;
        if (wantGlam !== undefined && p) {
          const curVis = visibleSlotId(p.equipped || {}, 'gloves', p.glamour || {}) || null;
          const curGlam = p.glamour?.gloves || null;
          if (wantGlam && wantGlam !== curVis) {
            await this._applyGlamourGloves(wantGlam);
          } else if (!wantGlam && curGlam) {
            await this._applyGlamourGloves(null);
          }
        }
      } else if (res?.error === 'in_combat') {
        this.toast?.('⚔️ Leave combat for 4s to swap loadouts', 2000);
      } else if (res?.error === 'empty_preset') {
        this.toast?.('📂 That loadout slot is empty — Save one first', 1800);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
    } catch {
      // ignore
    } finally {
      this._presetBusy = false;
    }
  }

  /** Mirrors the `data-quick-weapon` glamour swap (wardrobe_glamour, 0 gold). */
  async _applyGlamourGloves(itemId) {
    try {
      const p = this._getProfile();
      if (!p) return null;
      const baseEqId = p.equipped?.gloves?.id || null;
      let res = null;
      if (!baseEqId && itemId) {
        res = await this.request('wardrobe_equip', { slot: 'gloves', itemId });
      } else {
        const nextGlam = !itemId || itemId === baseEqId ? null : itemId;
        res = await this.request('wardrobe_glamour', { slot: 'gloves', itemId: nextGlam });
      }
      if (res?.ok) {
        const nextProf = res.profile || this._getProfile();
        if (nextProf && this.world?.local) {
          this.world.local.profile = nextProf;
          this.world.applyEquipment?.(nextProf.id, nextProf.equipped, nextProf.appearance);
        }
        this.onProfileUpdate(nextProf);
        if (this.skillModalOpen) this._renderSkillModalHtml(nextProf);
        const cls = WEAPON_CLASSES[activeWeaponClass(nextProf?.equipped, nextProf?.glamour)] || WEAPON_CLASSES.melee;
        this.toast?.(`${cls.icon} Loadout weapon: ${cls.label}`, 1600);
      }
      return res;
    } catch {
      return null;
    }
  }

  async _essenceCraft(id) {
    try {
      const res = await this.request('sf_pouch_set', { skillAction: 'essence_craft', skillId: id });
      const name = MONSTER_SKILLS[id]?.name || MONSTER_PASSIVES[id]?.name || id;
      const icon = MONSTER_SKILLS[id]?.icon || MONSTER_PASSIVES[id]?.icon || '🔮';
      if (res?.ok) {
        this._applySkillsFromServer(res.skills);
        this.playGatherSfx('perfect', 2);
        this.toast?.(`🔮 Crafted ${icon} ${name} → Lv.${res.newLevel} (−${res.cost} Essence)`, 2200);
      } else if (res?.error === 'codex_locked') {
        this.toast?.(`🔒 Hunt more of this monster first (Codex locked)`, 1900);
      } else if (res?.error === 'maxed') {
        this.toast?.(`⭐ ${name} is already MAX`, 1600);
      } else if (res?.error === 'not_enough_essence') {
        this.toast?.(`🔮 Not enough Essence`, 1600);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
    } catch {
      // ignore
    }
  }

  /** Generic top-center celebration banner reusing #sf-scroll-banner styling. */
  _showComboBanner(title, sub = '', { ms = 5200, actionHtml = '' } = {}) {
    if (!this.scrollBannerEl) return;
    if (this._scrollBannerTimer) clearTimeout(this._scrollBannerTimer);
    const hasTopBarAlert = Boolean(this.activeBoss || (this.invasionState && this.invasionState.phase !== 'idle'));
    this.scrollBannerEl.classList.toggle('below-top-bar', hasTopBarAlert);
    this.scrollBannerEl.innerHTML = `
      <div style="min-width:0;flex:1;">
        <div style="font-size:12px;font-weight:900;color:#FEF08A;line-height:1.2;">${title}</div>
        ${sub ? `<div style="font-size:10.5px;font-weight:700;color:#E9D5FF;margin-top:2px;">${sub}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
        ${actionHtml}
        <button type="button" class="sf-map-close" data-scroll-dismiss="1" style="width:32px;height:32px;font-size:12px;">✕</button>
      </div>
    `;
    this.scrollBannerEl.hidden = false;
    this._scrollBannerTimer = setTimeout(() => {
      if (this.scrollBannerEl) this.scrollBannerEl.hidden = true;
    }, ms);
  }

  openSkillModal(tab = 'skills') {
    if (!this.skillModalEl) return;
    this.closeMapModal();
    this.closeBountyModal();
    this._skillModalTab = ['codex', 'passives', 'reactions'].includes(tab) ? tab : 'skills';
    if (this._skillModalTab !== 'codex') {
      this._codexFocusId = null;
    }
    this.skillModalOpen = true;
    this.playGatherSfx('auto_on');
    this.skillModalEl.innerHTML = '';
    this._renderSkillModalHtml(this._getProfile());
    this.skillModalEl.hidden = false;
  }

  openCodexModal(focusMonsterId = null, filter = null) {
    if (!this.skillModalEl) return;
    this.closeMapModal();
    this.closeBountyModal();
    this._skillModalTab = 'codex';
    this._codexFocusId = focusMonsterId || null;
    this._skillFocusId = null;
    if (filter && ['all', 'meadow', 'hollow', 'reef', 'caldera', 'boss'].includes(filter)) {
      this._codexFilter = filter;
      if (this._skillModalScroll) this._skillModalScroll.codex = 0;
    } else if (focusMonsterId) {
      const meta = MONSTER_CODEX_META[focusMonsterId];
      const curF = this._codexFilter || 'all';
      if (meta) {
        const reg = BOSSES[focusMonsterId]?.region || MONSTERS[focusMonsterId]?.region || 'meadow';
        const visible =
          curF === 'all' ||
          (curF === 'boss' && meta.isBoss) ||
          (curF === reg);
        if (!visible) this._codexFilter = 'all';
      }
    }
    const wasOpen = this.skillModalOpen && !this.skillModalEl.hidden;
    this.skillModalOpen = true;
    this.playGatherSfx('auto_on');
    if (!wasOpen) this.skillModalEl.innerHTML = '';
    this._renderSkillModalHtml(this._getProfile(), { skipScrollRestore: Boolean(focusMonsterId) });
    this.skillModalEl.hidden = false;
    if (focusMonsterId) {
      requestAnimationFrame(() => {
        const card = this.skillModalEl?.querySelector?.(`[data-codex-card="${focusMonsterId}"]`);
        card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      });
    }
  }

  closeSkillModal() {
    if (this.skillModalEl && !this.skillModalEl.hidden) {
      const sheet = this.skillModalEl.querySelector('.sf-skill-sheet');
      if (sheet && this._skillModalScroll) {
        this._skillModalScroll[this._skillModalTab || 'skills'] = sheet.scrollTop;
      }
    }
    this.skillModalOpen = false;
    this._skillFocusId = null;
    if (this.skillModalEl) this.skillModalEl.hidden = true;
  }

  _getOwnedItemCount(p, itemId) {
    const wh = Number(p?.frontier?.warehouse?.items?.[itemId]) || 0;
    const bag = Number(p?.basecamp?.bag?.[itemId]) || 0;
    return wh + bag;
  }

  /** Codex card: archetype badge + answer, element weak/resist, passive drop, scroll floor progress. */
  _codexComboInfoHtml(entry, p) {
    const rows = [];
    let arch = null;
    try {
      arch = archetypeOf(entry.id);
    } catch {
      arch = null;
    }
    if (arch?.def) {
      rows.push(`<div class="sf-codex-arch"><span class="sf-role-badge" title="${arch.def.desc}">${arch.def.icon} ${arch.def.label}</span><span style="color:#4A3525;">${arch.def.desc}</span><span style="color:#15803D;font-weight:900;">✅ Answer: ${arch.def.answer}</span></div>`);
      if (arch.archetype === 'elemental') {
        const res = arch.resist ? SKILL_TRAITS[arch.resist] : null;
        const weak = arch.weak ? SKILL_TRAITS[arch.weak] : null;
        const imm = (arch.immune || []).map((t) => this._tagChipHtml(t)).join('');
        rows.push(`<div class="sf-codex-arch">${imm ? `<span>🚫 Immune: ${imm}</span>` : ''}${res ? `<span style="color:#B91C1C;">🛡️ Resists ${res.icon} ${res.label} (×0.6)</span>` : ''}${weak ? `<span style="color:#15803D;">💥 Weak to ${weak.icon} ${weak.label} (×1.35)</span>` : ''}</div>`);
      }
    }
    const ps = passiveBySource(entry.id);
    if (ps) {
      const lv = Number(p?.frontier?.skills?.passives?.[ps.id]) || 0;
      rows.push(`<div class="sf-codex-drop-row" style="border-top:1px dashed #DEC79F;padding-top:4px;">
        <div style="min-width:0;"><span>🏅 ${ps.icon} <b>${ps.name}</b> · ${lv >= 1 ? `<span style="color:#B45309;font-weight:900;">Lv.${lv}/3</span>` : '<span style="color:#78716C;font-weight:800;">🔒 Unowned</span>'}</span>
        <button type="button" class="sf-jump-pill" data-book-tab="passives">Passives ↗</button>
        <div style="font-size:9.5px;color:#6B4F35;font-weight:700;">${passiveDescFor(ps.id, Math.max(1, lv))}</div></div>
        <span class="sf-codex-rate charm">1.2% · ⭐5%</span>
      </div>`);
    }
    if (entry.scrollDrop && !(entry.scrollDrop.level >= 1)) {
      const floor = entry.isBoss ? (SCROLL_FLOOR_KILLS?.boss || 5) : (SCROLL_FLOOR_KILLS?.mob || 30);
      const k = Math.min(floor, Number(entry.kills) || 0);
      const pct = Math.round((k / floor) * 100);
      rows.push(`<div style="font-size:9.5px;font-weight:800;color:#6D28D9;">🎯 First scroll guaranteed at ${floor} kills (${k}/${floor})
        <div style="height:5px;background:#EDE9FE;border-radius:999px;overflow:hidden;margin-top:2px;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#A78BFA,#7C3AED);"></div></div></div>`);
    }
    return rows.length ? `<div class="sf-codex-combo">${rows.join('')}</div>` : '';
  }

  _renderCodexTabBody(p, uni, skills) {
    const entries = buildMonsterCodex({
      stats: uni.total,
      skills,
      killsByMob: p?.frontier?.stats?.killsByMob || null,
    });

    const filter = this._codexFilter || 'all';
    const filtered = entries.filter((e) => {
      if (filter === 'meadow') return e.region === 'meadow';
      if (filter === 'hollow') return e.region === 'hollow';
      if (filter === 'reef') return e.region === 'reef';
      if (filter === 'caldera') return e.region === 'caldera';
      if (filter === 'boss') return e.isBoss;
      return true;
    });

    const sample = entries[0] || { rareFindMult: 1, yieldMult: 1 };
    const luckBoostPct = Math.round((sample.rareFindMult - 1) * 100);
    const vitBoostPct = Math.round((sample.yieldMult - 1) * 100);
    const curRegion = this._currentRegionId();

    // Count live monsters currently roaming this shard instance
    const liveCounts = {};
    const liveAlphas = {};
    for (const mon of this.activeMonsters.values()) {
      if (mon && mon.hp > 0 && mon.type) {
        liveCounts[mon.type] = (liveCounts[mon.type] || 0) + 1;
        if (mon.isElite) liveAlphas[mon.type] = (liveAlphas[mon.type] || 0) + 1;
      }
    }
    if (this.activeBoss && this.activeBoss.hp > 0) {
      const bId = this.activeBoss.type || this.activeBoss.bossId || REGION_META[curRegion]?.bossId || 'elder_moss_golem';
      liveCounts[bId] = Math.max(1, liveCounts[bId] || 0);
    }

    const cardsHtml = filtered.map((entry) => {
      const isFocused = this._codexFocusId === entry.id;
      const regMeta = REGION_META[entry.region] || REGION_META.meadow;
      const regUnlocked = entry.region === 'meadow' ? true : this._isGateUnlocked({ requires: entry.region });
      const regBadge = `${regMeta.icon} ${regMeta.short}${!regUnlocked ? ' 🔒' : ''}`;
      const liveHere = entry.region === curRegion ? (liveCounts[entry.id] || 0) : 0;
      const alphaHere = entry.region === curRegion ? (liveAlphas[entry.id] || 0) : 0;
      const isGentle = entry.aggroStyle === 'passive' || entry.aggroStyle === 'gentle';
      const behaviorBadge = entry.isBoss
        ? '👑 Region Boss'
        : isGentle
        ? `🌿 Gentle Herd (${entry.packSize || 7})`
        : `⚔️ Pack Predator (${entry.packSize || 7})`;

      const matRows = entry.materialDrops.map((d) => {
        const matName = MATERIALS[d.itemId]?.name || d.itemId;
        const ico = EMOJI_MAP[d.itemId] || '📦';
        const owned = this._getOwnedItemCount(p, d.itemId);
        return `
          <div class="sf-codex-drop-row">
            <div style="min-width:0;">
              <span>${ico} <b>${matName}</b> <span style="color:#6B4F35;">${d.qtyText}</span></span>
              <span style="font-size:9.5px;color:#78716C;margin-left:4px;">(Have ${owned})</span>
              ${d.craftNote ? `<div style="font-size:9.5px;color:#92400E;font-weight:800;">⚒️ ${d.craftNote}</div>` : ''}
            </div>
            <span class="sf-codex-rate guaranteed">100%</span>
          </div>
        `;
      }).join('');

      let scrollRow = '';
      if (entry.scrollDrop) {
        const sd = entry.scrollDrop;
        const statusPill = sd.isMax
          ? '<span style="color:#B45309;font-weight:900;">★ Lv.5 MAX</span>'
          : sd.level >= 1
          ? `<span style="color:#6D28D9;font-weight:900;">Lv.${sd.level}/5</span>`
          : '<span style="color:#78716C;font-weight:800;">🔒 Unowned</span>';
        const rateTxt = sd.liveChancePct > sd.baseChancePct + 0.04
          ? `${sd.liveChancePct}% (Base ${sd.baseChancePct}%)`
          : `${sd.liveChancePct}%`;
        const alphaHint = sd.alphaChancePct != null
          ? `<div style="font-size:9.5px;color:#B45309;font-weight:800;margin-top:1px;">⭐ Star-Crowned Alpha Drop: <b>${sd.alphaChancePct}%</b> (Base 8% · 4× Rate!)</div>`
          : '';
        scrollRow = `
          <div class="sf-codex-drop-row" style="border-top:1px dashed #DEC79F;padding-top:4px;">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                <span>📜 ${sd.icon} <b>${sd.name}</b> · ${statusPill}</span>
                <button type="button" class="sf-jump-pill" data-jump-skill="${sd.skillId}">Skills ↗</button>
              </div>
              ${alphaHint}
            </div>
            <span class="sf-codex-rate scroll">${rateTxt}</span>
          </div>
        `;
      }

      const charmRows = entry.charmDrops.map((cd) => {
        const charmRateTxt = cd.liveChancePct > cd.baseChancePct + 0.05
          ? `${cd.liveChancePct}% (Base ${cd.baseChancePct}%)`
          : `${cd.liveChancePct}%`;
        return `
        <div class="sf-codex-drop-row" style="border-top:1px dashed #DEC79F;padding-top:4px;">
          <div style="min-width:0;">
            <div>${cd.icon} <b>${cd.label}</b></div>
          </div>
          <span class="sf-codex-rate charm">${charmRateTxt}</span>
        </div>
      `;
      }).join('');

      const huntLabel = !regUnlocked
        ? `🔒 Ch.${regMeta.unlockChapter}`
        : entry.isBoss
        ? '👑 Altar'
        : '🎯 Hunt';

      return `
        <div class="sf-codex-card ${entry.isBoss ? 'is-boss' : ''} ${isFocused ? 'is-focused' : ''}" data-codex-card="${entry.id}">
          <div style="display:flex;align-items:center;gap:9px;">
            <div class="sf-codex-portrait-wrap">
              <img class="sf-codex-portrait" src="${entry.sprite}" alt="${entry.name}" loading="lazy" />
            </div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <div style="font-size:12.5px;font-weight:900;color:#2E1C10;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${entry.icon} ${entry.name}
                </div>
                <span style="font-size:9.5px;font-weight:900;color:#5C3D24;background:#EFE0BE;border:1px solid #C8AA78;border-radius:999px;padding:1px 6px;white-space:nowrap;">
                  ⚔️ Slain: ${entry.kills}
                </span>
              </div>
              <div style="font-size:10px;font-weight:800;color:#6B4F35;margin-top:2px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                <span>${regBadge}</span>
                <span>·</span>
                <span style="color:${entry.isBoss ? '#9A3412' : isGentle ? '#15803D' : '#B91C1C'};">${behaviorBadge}</span>
                <span>·</span>
                <span>📍 ${entry.habitatName}</span>
              </div>
              <div class="sf-codex-stat-strip" style="margin-top:4px;">
                <span class="sf-codex-stat-pill">❤️ ${entry.hp} HP</span>
                <span class="sf-codex-stat-pill">⚔️ ${entry.dmg} ATK</span>
                <span class="sf-codex-stat-pill">👟 ${entry.speed}m/s</span>
                <span class="sf-codex-stat-pill">${entry.isBoss ? `🔥 ${entry.phases} Phases` : `✨ ${entry.xp} XP`}</span>
              </div>
            </div>
          </div>

          <div style="font-size:10.3px;font-weight:700;color:#4A3525;line-height:1.32;">
            ${entry.lore}
          </div>
          ${this._codexComboInfoHtml(entry, p)}

          <div class="sf-codex-drops">
            <div style="font-size:9.5px;font-weight:900;color:#7A5330;letter-spacing:0.3px;text-transform:uppercase;">
              🎁 Item, Scroll &amp; Charm Drop Rates
            </div>
            ${matRows}
            ${scrollRow}
            ${charmRows}
          </div>

          <div class="sf-codex-foot">
            <div style="min-width:0;font-size:10px;font-weight:800;color:#4A321F;">
              📍 <b>${entry.habitatName}</b> <span style="color:#78716C;">(${entry.coords.x}, ${entry.coords.z})</span>
              ${
                entry.region === curRegion
                  ? liveHere > 0
                    ? `<span style="color:#15803D;font-weight:900;margin-left:3px;">· 🟢 ${liveHere} Active${alphaHere > 0 ? ` (⭐${alphaHere} Alpha)` : ''}</span>`
                    : entry.isBoss
                    ? `<span style="color:#B45309;font-weight:900;margin-left:3px;">· 👑 Summon Altar</span>`
                    : `<span style="color:#78716C;margin-left:3px;">· Respawning</span>`
                  : ''
              }
            </div>
            <button type="button" class="sf-map-btn ${regUnlocked ? 'warp' : 'locked-hunt'}" data-hunt-skill-source="${entry.id}">
              ${huntLabel}
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background:linear-gradient(135deg,#3B2A20,#261810);border:2px solid #DFB15B;border-radius:14px;padding:7px 10px;color:#FFF8E7;font-size:10.5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
        <span>🍀 Luck Drop Boost: <b style="color:#FDE047;">+${luckBoostPct}%</b></span>
        <span>💖 Vitality Loot Yield: <b style="color:#86EFAC;">+${vitBoostPct}%</b></span>
        <span>⭐ Alpha Elites: <b style="color:#FDE047;">4× Scroll · 3× Yield</b></span>
      </div>

      <div class="sf-codex-filters">
        <button type="button" class="sf-codex-filter ${filter === 'all' ? 'active' : ''}" data-codex-filter="all">All (20)</button>
        <button type="button" class="sf-codex-filter ${filter === 'meadow' ? 'active' : ''}" data-codex-filter="meadow">🌲 Meadow (5)</button>
        <button type="button" class="sf-codex-filter ${filter === 'hollow' ? 'active' : ''}" data-codex-filter="hollow">💎 Hollow (5)</button>
        <button type="button" class="sf-codex-filter ${filter === 'reef' ? 'active' : ''}" data-codex-filter="reef">🌸 Reef (5)</button>
        <button type="button" class="sf-codex-filter ${filter === 'caldera' ? 'active' : ''}" data-codex-filter="caldera">⚙️ Caldera (5)</button>
        <button type="button" class="sf-codex-filter ${filter === 'boss' ? 'active' : ''}" data-codex-filter="boss">👑 Bosses (4)</button>
      </div>

      <div>${cardsHtml}</div>
    `;
  }

  // ---------------------------------------------------------------- Master Crafters Skill Book helpers
  _tagChipHtml(tagId, { size = 12, withLabel = true } = {}) {
    const def = STATUS_TAGS[tagId];
    if (!def) return '';
    return `<span class="sf-tag-chip" style="border-color:${def.color};" title="${def.label}">${sfComboIconHtml('tag', tagId, def.icon, size)}${withLabel ? `<span>${def.label}</span>` : ''}</span>`;
  }

  /** Role badge, trait icons, applied tags and "Combos with…" chips for a skill card. */
  _skillComboInfoHtml(skId) {
    const c = SKILL_COMBO[skId];
    if (!c) return '';
    const role = SKILL_ROLES[c.role];
    const traits = (c.traits || []).map((t) => {
      const td = SKILL_TRAITS[t];
      return td ? `<span class="sf-trait-chip" title="${td.label}">${td.icon} ${td.label}</span>` : '';
    }).join('');
    const skDef = MONSTER_SKILLS[skId];
    const applyIds = [...(c.applies || [])];
    if (skDef?.freezeMs > 0 && !applyIds.includes('frozen')) applyIds.unshift('frozen');
    if (skDef?.stunMs > 0 && !applyIds.includes('stunned')) applyIds.push('stunned');
    const applies = applyIds.map((t) => this._tagChipHtml(t)).join('');
    const extra = c.extendTagsPct ? `<span class="sf-trait-chip" title="Extends statuses">⏳ +${Math.round(c.extendTagsPct * 100)}% statuses</span>` : '';
    const resoChip = sfIsResonancePrimer(skId)
      ? `<span class="sf-combo-chip payoff" title="${String(RESONANCE?.desc || 'Primes Resonance: your next damaging skill hits harder.').replace(/"/g, '&quot;')}">🎶 primes next skill</span>`
      : '';
    let partners = [];
    try {
      partners = comboPartners(skId) || [];
    } catch {
      partners = [];
    }
    const partnerChips = partners.slice(0, 8).map((pt) => {
      const psk = MONSTER_SKILLS[pt.skillId];
      const r = REACTIONS[pt.reactionId];
      if (!psk || !r) return '';
      const arrow = pt.direction === 'setup' ? '→' : '←';
      const tip = pt.direction === 'setup'
        ? `This sets up ${psk.name} → ${r.label}`
        : `This cashes in ${psk.name}'s setup → ${r.label}`;
      return `<button type="button" class="sf-combo-chip ${pt.direction}" data-jump-skill="${pt.skillId}" title="${tip}" style="border-color:${r.color};">${arrow} ${psk.icon} <span style="color:${r.color};">${r.icon}</span></button>`;
    }).join('');
    return `
      <div class="sf-combo-info">
        <div class="sf-combo-row">
          ${role ? `<span class="sf-role-badge role-${role.id}" title="${role.desc}">${role.icon} ${role.label}</span>` : ''}
          ${traits}${extra}${resoChip}
          ${applies ? `<span class="sf-combo-lbl">Applies</span>${applies}` : ''}
        </div>
        ${partnerChips ? `<div class="sf-combo-row"><span class="sf-combo-lbl">Combos with…</span>${partnerChips}</div>` : ''}
      </div>
    `;
  }

  /** 🔮 Craft button (soft-disabled so mobile taps can explain why). */
  _essenceCraftBtnHtml(p, id, sourceName = '') {
    let chk = { ok: false, error: 'unknown_skill' };
    try {
      chk = canEssenceCraft(p, id) || chk;
    } catch {
      // keep default
    }
    const cost = essenceCraftCost(id) ?? '?';
    if (chk.error === 'maxed') {
      return `<span class="sf-craft-btn is-max" title="Already MAX">🔮 MAX</span>`;
    }
    let reason = '';
    if (chk.error === 'codex_locked') reason = `Kill ${chk.need} ${sourceName || 'of this monster'} first (${chk.have}/${chk.need})`;
    else if (chk.error === 'not_enough_essence') reason = `Need ${chk.need} Essence (have ${chk.have})`;
    else if (!chk.ok) reason = 'Cannot craft';
    const safeReason = reason.replace(/"/g, '&quot;');
    return chk.ok
      ? `<button type="button" class="sf-map-btn sf-craft-btn" data-essence-craft="${id}" title="Spend ${cost} Essence to craft +1 Lv">🔮 Craft (${cost})</button>`
      : `<button type="button" class="sf-map-btn sf-craft-btn is-disabled" aria-disabled="true" data-craft-reason="${safeReason}" title="${safeReason}">🔮 Craft (${cost})</button>`;
  }

  /** 4 equip slots + passive slot + 3 loadout presets. */
  _renderLoadoutHtml(p, st, slotUnlocks) {
    const slotsHtml = [0, 1, 2, 3].map((i) => {
      if (!slotUnlocks[i]) {
        return `<button type="button" class="sf-loadout-slot is-locked" data-locked-slot="${i}" title="${SLOT_UNLOCK_RULES?.[i]?.hint || 'Locked'}">
          <span class="sf-loadout-key">${i + 1}</span><span class="sf-loadout-ico">🔒</span>
          <span class="sf-loadout-name">${SLOT_UNLOCK_RULES?.[i]?.hint || 'Locked'}</span>
        </button>`;
      }
      const skId = st.equipped[i];
      const sk = skId ? MONSTER_SKILLS[skId] : null;
      const lv = sk ? Math.max(1, Number(st.unlocked[skId]) || 1) : 0;
      return sk
        ? `<button type="button" class="sf-loadout-slot" data-equip-skill="${skId}" data-equip-slot="${i}" title="Tap to unequip ${sk.name}">
            <span class="sf-loadout-key">${i + 1}</span><span class="sf-loadout-ico">${sk.icon}</span>
            <span class="sf-loadout-name">${sk.name}</span><span class="sf-loadout-lv">${lv >= 5 ? 'MAX' : `Lv.${lv}`} ✕</span>
          </button>`
        : `<div class="sf-loadout-slot is-empty"><span class="sf-loadout-key">${i + 1}</span><span class="sf-loadout-ico">➕</span><span class="sf-loadout-name">Empty — pick 1–4 on a card</span></div>`;
    }).join('');

    const psId = st.passive && MONSTER_PASSIVES[st.passive] ? st.passive : null;
    const ps = psId ? MONSTER_PASSIVES[psId] : null;
    const psLv = ps ? Math.max(1, Number(st.passives[psId]) || 1) : 0;
    const passiveRow = `
      <div class="sf-loadout-passive">
        <span class="sf-loadout-ico">${ps ? sfComboIconHtml('passive', psId, ps.icon, 24) : '🏅'}</span>
        <div style="min-width:0;flex:1;">
          <div style="font-size:11px;font-weight:900;color:#2E1C10;">${ps ? `${ps.name} <span style="color:#B45309;">Lv.${psLv}/3</span>` : 'Passive Slot — empty'}</div>
          <div style="font-size:9.5px;font-weight:700;color:#6B4F35;">${ps ? passiveDescFor(psId, psLv) : 'Rare 2nd drop from monsters (1.2% · ⭐ Alpha 5%)'}</div>
        </div>
        ${ps ? `<button type="button" class="sf-map-btn" data-equip-passive="" title="Unequip passive">✕</button>` : ''}
        <button type="button" class="sf-map-btn" data-book-tab="passives">🏅 Passives</button>
      </div>
    `;

    const presetsHtml = Array.from({ length: PRESET_COUNT || 3 }, (_, i) => {
      const pr = st.presets?.[i] || null;
      const icons = pr
        ? sfPadEquipped(pr.equipped).map((id) => (id && MONSTER_SKILLS[id] ? MONSTER_SKILLS[id].icon : '·')).join('')
          + (pr.passive && MONSTER_PASSIVES[pr.passive] ? ` ${MONSTER_PASSIVES[pr.passive].icon}` : '')
          + (pr.glamourGloves && ACCESSORIES[pr.glamourGloves] ? ` ${(WEAPON_CLASSES[ACCESSORIES[pr.glamourGloves].combatClass] || {}).icon || ''}` : '')
        : '—';
      const nm = this._presetNameFor(i, st).replace(/[<>"&]/g, '');
      return `
        <div class="sf-preset-card ${pr ? '' : 'is-empty'}">
          <div class="sf-preset-name-row">
            <span class="sf-preset-name-ico">${pr ? '📂' : '🗂️'}</span>
            <span class="sf-preset-name-wrap"><input type="text" class="sf-preset-name-input" data-preset-name-input="${i}" maxlength="12" value="${nm}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Loadout ${i + 1} name" /></span>
            <button type="button" class="sf-preset-cycle" data-preset-name-cycle="${i}" title="Tap to cycle names (${SF_PRESET_NAMES.join(' · ')})" aria-label="Cycle loadout name">🔄</button>
          </div>
          <div style="font-size:12px;letter-spacing:1px;min-height:16px;">${icons}</div>
          <div style="display:flex;gap:3px;">
            <button type="button" class="sf-map-btn" data-preset-save="${i}" title="Save current loadout here">💾</button>
            <button type="button" class="sf-map-btn ${pr ? '' : 'is-disabled'}" data-preset-load="${i}" title="Load this loadout">📂 Load</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="sf-skill-sec">
        <span>🎒 Combat Loadout (4 Skills + 1 Passive)</span>
        <span style="font-size:10px;color:#6D28D9;">Keys 1–4</span>
      </div>
      <div class="sf-loadout-grid">${slotsHtml}</div>
      ${passiveRow}
      <div class="sf-skill-sec" style="margin-top:6px;">
        <span>🗂️ Loadout Presets</span>
        <span style="font-size:10px;color:#7A5330;">Out of combat 4s</span>
      </div>
      <div class="sf-preset-row">${presetsHtml}</div>
    `;
  }

  _renderPassivesTabBody(p, st) {
    const killsByMob = p?.frontier?.stats?.killsByMob || {};
    const cards = MONSTER_PASSIVE_IDS.map((id) => {
      const ps = MONSTER_PASSIVES[id];
      const lv = Number(st.passives[id]) || 0;
      const owned = lv >= 1;
      const isEq = st.passive === id;
      const showLv = Math.max(1, lv);
      const lvLines = [1, 2, 3].map((l) => `<span style="color:${l <= lv ? '#B45309' : '#A8A29E'};font-weight:${l === showLv ? 900 : 700};">Lv.${l}</span>`).join(' · ');
      const kills = Number(killsByMob[ps.sourceId]) || 0;
      return `
        <div class="sf-sk-card ${isEq ? 'equipped' : ''} ${owned ? '' : 'locked'}" data-passive-card="${id}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;">
              <span style="font-size:20px;display:inline-flex;">${sfComboIconHtml('passive', id, ps.icon, 28)}</span>
              <div style="min-width:0;">
                <div style="font-size:12px;font-weight:900;color:#2E1C10;">${ps.name}
                  <span style="font-size:10px;font-weight:900;color:${owned ? '#B45309' : '#78716C'};">${owned ? (lv >= 3 ? '★ Lv.3 MAX' : `Lv.${lv}/3`) : '🔒 Unowned'}</span>
                </div>
                <div style="font-size:10px;font-weight:800;color:#6B4F35;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                  <span>👾 ${ps.sourceName} · 1.2% / ⭐ Alpha 5% × 🍀</span>
                  <span style="color:#78716C;">(Slain ${kills})</span>
                  <button type="button" class="sf-jump-pill" data-open-codex-mob="${ps.sourceId}">Drops ↗</button>
                </div>
              </div>
            </div>
          </div>
          <div style="font-size:10.5px;font-weight:700;color:#4A3525;line-height:1.3;">${passiveDescFor(id, showLv)}</div>
          <div style="font-size:9.5px;">${lvLines}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;">
            ${owned
              ? `<button type="button" class="sf-map-btn ${isEq ? 'on' : ''}" data-equip-passive="${isEq ? '' : id}">${isEq ? '✓ Equipped (tap to remove)' : '🏅 Equip Passive'}</button>`
              : `<span style="font-size:10px;font-weight:800;color:#78716C;">Hunt ${ps.sourceName} for a rare drop!</span>`}
            <div style="display:flex;gap:4px;align-items:center;">
              ${this._essenceCraftBtnHtml(p, id, ps.sourceName)}
              <button type="button" class="sf-map-btn warp" data-hunt-skill-source="${ps.sourceId}">🎯 Hunt</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    return `
      <div style="background:linear-gradient(135deg,#3B2A20,#261810);border:2px solid #DFB15B;border-radius:14px;padding:7px 10px;color:#FFF8E7;font-size:10.5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
        <span>🏅 1 Passive Slot · Lv.1 → Lv.3 by duplicates</span>
        <span>🔮 Essence: <b style="color:#C4B5FD;">${st.essence}</b></span>
      </div>
      <div>${cards}</div>
    `;
  }

  _reactionRecipeHtml(r) {
    return (r.needs || []).map((n) => {
      const tags = n.tags || [n.tag];
      const tagTxt = tags.map((t) => this._tagChipHtml(t)).join(' / ');
      const td = n.trait ? SKILL_TRAITS[n.trait] : null;
      const lhs = td ? `<span class="sf-trait-chip">${td.icon} ${td.label} hit</span>` : '<span class="sf-trait-chip">✨ Any skill</span>';
      return `${lhs} <b>→</b> ${tagTxt}`;
    }).join('<span style="margin:0 4px;color:#78716C;font-weight:900;">or</span>');
  }

  _renderReactionsTabBody(st) {
    const cards = REACTION_IDS.map((id) => {
      const r = REACTIONS[id];
      const count = Number(st.reactionsFound[id]) || 0;
      const found = count > 0;
      // Which skills set it up / pay it off (static hint list)
      const setupIds = [];
      const payoffIds = [];
      for (const skId of MONSTER_SKILL_IDS) {
        const c = SKILL_COMBO[skId];
        if (!c) continue;
        for (const n of r.needs) {
          const tags = n.tags || [n.tag];
          if (tags.some((t) => c.applies.includes(t) || (t === 'frozen' && c.traits.includes('chill')))) { if (!setupIds.includes(skId)) setupIds.push(skId); }
          if (n.trait && c.traits.includes(n.trait)) { if (!payoffIds.includes(skId)) payoffIds.push(skId); }
        }
      }
      const iconsOf = (ids) => ids.map((sid) => `<button type="button" class="sf-combo-chip" data-jump-skill="${sid}" title="${MONSTER_SKILLS[sid]?.name || sid}">${MONSTER_SKILLS[sid]?.icon || '✨'}</button>`).join('');
      return `
        <div class="sf-sk-card ${found ? 'equipped' : 'locked'}" style="border-color:${found ? r.color : ''};">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <div style="font-size:13px;font-weight:900;color:#2E1C10;">${r.icon} ${found ? r.label : '???'}</div>
            <span style="font-size:10px;font-weight:900;border-radius:999px;padding:1px 7px;${found ? `background:${r.color};color:#1C1917;` : 'background:#E7E5E4;color:#78716C;'}">${found ? `✓ Discovered ×${count}` : '🔒 Undiscovered · +30💎'}</span>
          </div>
          <div style="font-size:10.5px;font-weight:800;color:#4A3525;display:flex;align-items:center;gap:3px;flex-wrap:wrap;">${this._reactionRecipeHtml(r)}</div>
          <div style="font-size:10.5px;font-weight:700;color:#4A3525;line-height:1.3;">${found ? r.desc : r.desc.replace(/[0-9.]+/g, '?')}</div>
          ${setupIds.length ? `<div class="sf-combo-row"><span class="sf-combo-lbl">Setup</span>${iconsOf(setupIds)}</div>` : ''}
          ${payoffIds.length ? `<div class="sf-combo-row"><span class="sf-combo-lbl">Payoff</span>${iconsOf(payoffIds)}</div>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div style="background:linear-gradient(135deg,#2E1065,#1E1B4B);border:2px solid #A78BFA;border-radius:14px;padding:7px 10px;color:#EDE9FE;font-size:10.5px;margin-bottom:8px;line-height:1.35;">
        🧪 <b>Setup</b> skills apply statuses (💧🔥⚡❄️🌀💫🌠). <b>Payoff</b> skills cash them in for Reactions. First discovery of each Reaction grants <b style="color:#FDE047;">+30 💎</b>!
      </div>
      ${this._renderResonanceTimeLockCards()}
      <div>${cards}</div>
    `;
  }

  /** 🎶 Resonance + ⏳ Time Lock explainer cards (Reactions tab). */
  _renderResonanceTimeLockCards() {
    const primerIds = MONSTER_SKILL_IDS.filter((id) => sfIsResonancePrimer(id));
    const iconsOf = (ids) => ids.map((sid) => `<button type="button" class="sf-combo-chip" data-jump-skill="${sid}" title="${MONSTER_SKILLS[sid]?.name || sid}">${MONSTER_SKILLS[sid]?.icon || '✨'}</button>`).join('');
    const reso = RESONANCE || {};
    const resoColor = reso.color || '#86EFAC';
    const windowS = Math.round((reso.windowMs || 5000) / 1000);
    const dmgPct = Math.round(((reso.dmgMult || 1.25) - 1) * 100);
    const durPct = Math.round(((reso.tagDurMult || 1.5) - 1) * 100);
    const tl = MONSTER_SKILLS.sk_time_dilation;
    const tlPct = Math.round((SKILL_COMBO.sk_time_dilation?.extendTagsPct || 0.5) * 100);
    return `
      <div class="sf-sk-card sf-mech-card" style="border-color:${resoColor};">
        <div style="font-size:13px;font-weight:900;color:#2E1C10;">${reso.icon || '🎶'} ${reso.label || 'Resonance'} <span class="sf-mech-tag">Mechanic</span></div>
        <div style="font-size:10.5px;font-weight:700;color:#4A3525;line-height:1.3;">${reso.desc || ''} Window: <b>${windowS}s</b> · <b>+${dmgPct}% DMG</b> · statuses <b>+${durPct}%</b>.</div>
        <div class="sf-combo-row"><span class="sf-combo-lbl">Primers (💚 Sustain / 🛡️ Support)</span>${iconsOf(primerIds)}</div>
        <div style="font-size:10px;font-weight:800;color:#15803D;">Tip: buff → then fire your 💥 Burst or a Payoff while the skill buttons glow green.</div>
      </div>
      ${tl ? `
      <div class="sf-sk-card sf-mech-card" style="border-color:#C4B5FD;">
        <div style="font-size:13px;font-weight:900;color:#2E1C10;">⏳ Time Lock <span class="sf-mech-tag">${tl.icon || '⏳'} ${tl.name || 'Time Dilation'}</span></div>
        <div style="font-size:10.5px;font-weight:700;color:#4A3525;line-height:1.3;">Slows every foe in the field, makes all their statuses last <b>+${tlPct}%</b> (keep combos alive longer) and refunds <b>2.5s</b> from your other skill cooldowns.</div>
        <div class="sf-combo-row"><span class="sf-combo-lbl">Cast</span>${iconsOf(['sk_time_dilation'])}</div>
      </div>` : ''}
    `;
  }

  _renderSkillModalHtml(profile = null, opts = {}) {
    if (!this.skillModalEl) return;
    // Don't yank the keyboard away while the player is naming a loadout — re-render once they finish
    const focused = typeof document !== 'undefined' ? document.activeElement : null;
    if (!opts.force && focused && this.skillModalEl.contains(focused) && focused.matches?.('[data-preset-name-input]')) {
      if (!this._presetRenderDeferred) {
        this._presetRenderDeferred = true;
        focused.addEventListener('blur', () => {
          this._presetRenderDeferred = false;
          // let a tap on 💾 Save / 🔄 (which blurs the input on pointerdown) land its click first
          setTimeout(() => {
            if (this.skillModalOpen && !this._presetRenderDeferred) this._renderSkillModalHtml(this._getProfile());
          }, 350);
        }, { once: true });
      }
      return;
    }
    const p = profile || this._getProfile() || {};
    const skills = p.frontier?.skills || { unlocked: {}, equipped: [null, null, null, null] };
    const unlocked = skills.unlocked || {};
    const eq = sfPadEquipped(skills.equipped);
    const st = this._getSkillsState(p);
    const slotUnlocks = this._getSlotUnlocks(p);
    const uni = computeUniversalStats(p);
    const maxHp = playerMaxHp(p.level || 1, uni.total);
    const unlockedCount = MONSTER_SKILL_IDS.filter((id) => (Number(unlocked[id]) || 0) >= 1).length;
    const BOOK_TABS = ['skills', 'passives', 'reactions', 'codex'];
    const curTab = BOOK_TABS.includes(this._skillModalTab) ? this._skillModalTab : 'skills';
    const isCodex = curTab === 'codex';
    const ownedPassives = MONSTER_PASSIVE_IDS.filter((id) => (Number(st.passives[id]) || 0) >= 1).length;
    const foundReactions = REACTION_IDS.filter((id) => (Number(st.reactionsFound[id]) || 0) > 0).length;

    if (!this._skillModalScroll) this._skillModalScroll = { skills: 0, codex: 0 };

    // Reuse existing .sf-skill-sheet wrapper if already mounted to preserve scrollTop & avoid sfModalIn flash!
    let sheet = this.skillModalEl.querySelector('.sf-skill-sheet');
    const prevFilterScrollLeft = sheet?.querySelector('.sf-codex-filters')?.scrollLeft || 0;
    const prevWepScrollLeft = sheet?.querySelector('.sf-wep-strip')?.scrollLeft || 0;
    if (sheet && sheet.dataset.activeTab === curTab && !opts.resetScroll) {
      this._skillModalScroll[curTab] = sheet.scrollTop;
    }

    const tabsHtml = `
      <div class="sf-book-tabs sf-book-tabs-4" role="tablist">
        <button type="button" class="sf-book-tab ${curTab === 'skills' ? 'active' : ''}" data-book-tab="skills" role="tab" aria-selected="${curTab === 'skills'}">
          📜 Skills ${unlockedCount}/20
        </button>
        <button type="button" class="sf-book-tab ${curTab === 'passives' ? 'active' : ''}" data-book-tab="passives" role="tab" aria-selected="${curTab === 'passives'}">
          🏅 Passives ${ownedPassives}/${MONSTER_PASSIVE_IDS.length}
        </button>
        <button type="button" class="sf-book-tab ${curTab === 'reactions' ? 'active' : ''}" data-book-tab="reactions" role="tab" aria-selected="${curTab === 'reactions'}">
          🧪 Reactions ${foundReactions}/${REACTION_IDS.length}
        </button>
        <button type="button" class="sf-book-tab ${isCodex ? 'active' : ''}" data-book-tab="codex" role="tab" aria-selected="${isCodex}">
          👾 Codex
        </button>
      </div>
    `;

    let sheetInnerHtml = '';
    if (curTab === 'passives' || curTab === 'reactions') {
      sheetInnerHtml = `
        <div class="sf-map-head">
          <div class="sf-map-title">${curTab === 'passives' ? '🏅 Monster Passives' : '🧪 Combo Reactions'}</div>
          <button type="button" class="sf-map-close" data-skill-close="1" aria-label="Close">✕</button>
        </div>
        ${tabsHtml}
        ${curTab === 'passives' ? this._renderPassivesTabBody(p, st) : this._renderReactionsTabBody(st)}
      `;
    } else if (isCodex) {
      sheetInnerHtml = `
        <div class="sf-map-head">
          <div class="sf-map-title">👾 Sky Frontier Monster Codex</div>
          <button type="button" class="sf-map-close" data-skill-close="1" aria-label="Close">✕</button>
        </div>
        ${tabsHtml}
        ${this._renderCodexTabBody(p, uni, skills)}
      `;
    } else {
      const activeVisId = visibleSlotId(p.equipped, 'gloves', p.glamour);
      const baseEqId = p.equipped?.gloves?.id || null;
      const wepInfo = this._getActiveWeaponInfo(p);

      // Stable deterministic sort (rarity DESC -> combatClass ASC -> id ASC) so chips never jump on Glamour swap!
      const invKeys = Object.keys(p.inventory || {}).filter((id) => ACCESSORIES[id]?.slot === 'gloves');
      const classOrder = { melee: 0, ranged: 1, magic: 2 };
      invKeys.sort((a, b) => {
        const da = ACCESSORIES[a];
        const db = ACCESSORIES[b];
        const ra = (db?.rarity || 1) - (da?.rarity || 1);
        if (ra !== 0) return ra;
        const ca = (classOrder[da?.combatClass] ?? 9) - (classOrder[db?.combatClass] ?? 9);
        if (ca !== 0) return ca;
        return a.localeCompare(b);
      });

      const wepChips = invKeys.slice(0, 14).map((id) => {
        const def = ACCESSORIES[id];
        const cls = WEAPON_CLASSES[def.combatClass || 'melee'] || WEAPON_CLASSES.melee;
        const isVis = id === activeVisId;
        const refine = p.inventory?.[id]?.refine || 0;
        const grade = p.inventory?.[id]?.forgeGrade;
        return `
          <div class="sf-wep-chip ${isVis ? 'active' : ''}" data-quick-weapon="${id}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:#7C2D12;">${cls.icon} ${cls.label.split(' ')[0]}</span>
              ${grade ? `<span style="font-size:9px;font-weight:900;background:#FEF08A;border:1px solid #CA8A04;border-radius:6px;padding:0 4px;">${grade}</span>` : ''}
            </div>
            <div style="font-size:11px;font-weight:900;color:#2E1C10;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${def.name}${refine > 0 ? ` +${refine}` : ''}
            </div>
            <div style="font-size:9.5px;font-weight:800;color:${isVis ? '#B45309' : '#6B4F35'};">
              ${isVis ? '✓ Active Style' : baseEqId ? '✨ Glamour Swap' : '⚔️ Equip'}
            </div>
          </div>
        `;
      }).join('');

      const skillFilter = this._skillRegionFilter || 'all';
      const visibleSkillIds = MONSTER_SKILL_IDS.filter((skId) => {
        const sk = MONSTER_SKILLS[skId];
        if (!sk) return false;
        if (skillFilter === 'equipped') return eq.includes(skId) || (Number(unlocked[skId]) || 0) >= 1;
        if (skillFilter === 'meadow' || skillFilter === 'hollow' || skillFilter === 'reef' || skillFilter === 'caldera') {
          return sk.region === skillFilter;
        }
        return true;
      });

      const skillCards = visibleSkillIds.map((skId) => {
        const sk = MONSTER_SKILLS[skId];
        const lv = Number(unlocked[skId]) || 0;
        const isUnlocked = lv >= 1;
        const slotIdx = eq.indexOf(skId);
        const isFocused = this._skillFocusId === skId;
        const nums = computeSkillNumbers(skId, Math.max(1, lv), uni.total, maxHp);
        const cdSec = (skillCooldownMs(skId, uni.total) / 1000).toFixed(1);
        const isBossSk = Boolean(sk.isBossSkill || sk.isBoss);
        const srcName = sk.sourceName || (isBossSk
          ? (BOSSES[sk.sourceId]?.name || sk.sourceId)
          : (MONSTERS[sk.sourceId]?.name || sk.sourceId));
        const skRegMeta = REGION_META[sk.region] || REGION_META.meadow;
        const regUnlocked = sk.region === 'meadow' ? true : this._isGateUnlocked({ requires: sk.region });
        const dropHint = isBossSk
          ? `👑 ${srcName} (${skRegMeta.icon} ${skRegMeta.short} · 10% × 🍀)`
          : `👾 ${srcName} (${skRegMeta.icon} ${skRegMeta.short} · 2% / ⭐ Alpha 8%)`;

        let powerTag = '';
        if (nums.damage > 0) powerTag += `💥 ${nums.damage} DMG`;
        if (nums.healPerTick > 0) powerTag += `${powerTag ? ' · ' : ''}💚 +${nums.healPerTick}/s`;
        if (nums.shieldHp > 0) powerTag += `${powerTag ? ' · ' : ''}🛡️ +${nums.shieldHp}`;
        if (nums.freezeMs > 0) powerTag += `${powerTag ? ' · ' : ''}❄️ Freeze: ${(nums.freezeMs / 1000).toFixed(1)}s`;
        if (nums.stunMs > 0) powerTag += `${powerTag ? ' · ' : ''}😵 Stun: ${(nums.stunMs / 1000).toFixed(1)}s`;

        const roleBadgeHtml = sk.teamRole
          ? `<span class="sf-sk-role-badge">${this._esc(sk.teamRole)}</span>`
          : '';
        const scalingPills = Array.isArray(nums.scaling) && nums.scaling.length
          ? `<div class="sf-sk-scaling-row">${nums.scaling.map((s) => `<span class="sf-sk-scale-pill" title="${this._esc(s.stat)} scaling">${s.icon} ${this._esc(s.label)} <b>${this._esc(s.text || s.value || '')}</b></span>`).join('')}</div>`
          : '';
        const puzzleHintHtml = sk.puzzleHint
          ? `<div class="sf-sk-puzzle-hint">🧩 <b>Co-Op Puzzle:</b> ${this._esc(sk.puzzleHint)}</div>`
          : '';

        return `
          <div class="sf-sk-card ${slotIdx >= 0 ? 'equipped' : ''} ${!isUnlocked ? 'locked' : ''} ${isFocused ? 'is-focused' : ''}" data-skill-card="${skId}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                <span style="font-size:20px;">${sk.icon}</span>
                <div style="min-width:0;">
                  <div style="font-size:12px;font-weight:900;color:#2E1C10;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span>${sk.name}</span>
                    <span style="font-size:10px;font-weight:900;color:${isUnlocked ? '#7C3AED' : '#78716C'};">
                      ${isUnlocked ? (lv >= 5 ? '★ Lv.5 MAX' : `Lv.${lv}/5`) : '🔒 Locked'}
                    </span>
                    ${roleBadgeHtml}
                  </div>
                  <div style="font-size:10px;font-weight:800;color:#6B4F35;display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:1px;">
                    <span>${dropHint}</span>
                    <button type="button" class="sf-jump-pill" data-open-codex-mob="${sk.sourceId}">Drops ↗</button>
                  </div>
                </div>
              </div>
              <span style="font-size:10px;font-weight:900;color:#4C1D95;background:#EDE9FE;border-radius:8px;padding:2px 6px;flex-shrink:0;">⏱️ ${cdSec}s</span>
            </div>
            <div style="font-size:10.5px;font-weight:700;color:#4A3525;line-height:1.3;">
              ${sk.desc || sk.summary || ''}${powerTag ? ` <b style="color:#7C2D12;">(${powerTag})</b>` : ''}
            </div>
            ${scalingPills}
            ${this._skillComboInfoHtml(skId)}
            ${puzzleHintHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;flex-wrap:wrap;">
              ${
                isUnlocked
                  ? `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                      <span style="font-size:9.5px;font-weight:900;color:#6B4F35;">Equip:</span>
                      ${[0, 1, 2, 3].map((si) => {
                        if (!slotUnlocks[si]) {
                          return `<button type="button" class="sf-map-btn sf-slot-pick is-locked" data-locked-slot="${si}" title="${SLOT_UNLOCK_RULES?.[si]?.hint || 'Locked'}">🔒${si + 1}</button>`;
                        }
                        const on = slotIdx === si;
                        return `<button type="button" class="sf-map-btn sf-slot-pick ${on ? 'on' : ''}" data-equip-skill="${skId}" data-equip-slot="${si}" title="${on ? `Unequip from Slot ${si + 1}` : `Equip in Slot ${si + 1}`}">${on ? '✓' : ''}${si + 1}</button>`;
                      }).join('')}
                    </div>`
                  : `<span style="font-size:10px;font-weight:800;color:#78716C;">Hunt ${srcName} to unbox Scroll!</span>`
              }
              <div style="display:flex;gap:4px;align-items:center;">
                ${this._essenceCraftBtnHtml(p, skId, srcName)}
                <button type="button" class="sf-map-btn ${regUnlocked ? 'warp' : 'locked-hunt'}" data-hunt-skill-source="${sk.sourceId}">
                  ${regUnlocked ? '🎯 Hunt' : `🔒 Ch.${skRegMeta.unlockChapter}`}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      sheetInnerHtml = `
        <div class="sf-map-head">
          <div class="sf-map-title">📖 Monster Skills &amp; Combat Style</div>
          <button type="button" class="sf-map-close" data-skill-close="1" aria-label="Close">✕</button>
        </div>
        ${tabsHtml}
        <div style="background:linear-gradient(135deg,#3B2A20,#261810);border:2px solid #DFB15B;border-radius:14px;padding:8px 10px;color:#FFF8E7;font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="min-width:0;">
            <div style="font-weight:900;color:#FDE047;">${wepInfo.icon} Active Class: ${wepInfo.label}${wepInfo.def ? ` · ${wepInfo.def.name}` : ''}</div>
            <div style="font-size:10px;color:#E7D5B4;margin-top:1px;">Range ${wepInfo.range}m · Glamour swaps class while keeping your +10 stats!</div>
            ${(() => {
              const echo = WEAPON_ECHO[wepInfo.weaponClass];
              const prime = HIT3_PRIMES[wepInfo.weaponClass];
              if (!echo && !prime) return '';
              return `<div style="font-size:10px;color:#C4B5FD;margin-top:2px;font-weight:800;">${echo ? `${echo.icon} ${echo.label}: ${echo.desc}` : ''}${prime ? `<br>🎯 Hit-3 Prime: <b style="color:#FDE68A;">${prime.label}</b>` : ''}</div>`;
            })()}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
            <span style="font-size:10px;font-weight:900;background:rgba(255,255,255,0.12);padding:3px 7px;border-radius:999px;white-space:nowrap;">❤️ ${maxHp} HP</span>
            <span style="font-size:10px;font-weight:900;background:rgba(167,139,250,0.22);border:1px solid #A78BFA;padding:2px 7px;border-radius:999px;white-space:nowrap;" title="Skill Essence — earned from duplicate scrolls past MAX; craft scrolls & passives">🔮 Essence: ${st.essence}</span>
          </div>
        </div>

        ${this._renderLoadoutHtml(p, st, slotUnlocks)}

        <div class="sf-skill-sec">
          <span>⚔️ 1-Tap Weapon Style Swap</span>
          <span style="font-size:10px;color:#7A5330;">Preserves Stats!</span>
        </div>
        <div class="sf-wep-strip">${wepChips || '<span style="font-size:11px;">Open Wardrobe to view weapons!</span>'}</div>

        <div class="sf-skill-sec">
          <span>📜 Monster Skill Scrolls (0⚡ Cost!)</span>
          <span style="font-size:10px;color:#6D28D9;">🍀 Pure Luck RNG</span>
        </div>
        <div class="sf-codex-filters">
          <button type="button" class="sf-codex-filter ${skillFilter === 'all' ? 'active' : ''}" data-skill-filter="all">All (20)</button>
          <button type="button" class="sf-codex-filter ${skillFilter === 'equipped' ? 'active' : ''}" data-skill-filter="equipped">⚡ Unlocked (${unlockedCount})</button>
          <button type="button" class="sf-codex-filter ${skillFilter === 'meadow' ? 'active' : ''}" data-skill-filter="meadow">🌲 Meadow (5)</button>
          <button type="button" class="sf-codex-filter ${skillFilter === 'hollow' ? 'active' : ''}" data-skill-filter="hollow">💎 Hollow (5)</button>
          <button type="button" class="sf-codex-filter ${skillFilter === 'reef' ? 'active' : ''}" data-skill-filter="reef">🌸 Reef (5)</button>
          <button type="button" class="sf-codex-filter ${skillFilter === 'caldera' ? 'active' : ''}" data-skill-filter="caldera">⚙️ Caldera (5)</button>
        </div>
        <div>${skillCards || '<div style="padding:14px;text-align:center;font-size:11.5px;color:#6B4F35;font-weight:800;">No unlocked scrolls yet — hunt Monsters or ⭐ Alpha Elites!</div>'}</div>
      `;
    }

    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'sf-skill-sheet';
      sheet.setAttribute('role', 'dialog');
      this.skillModalEl.innerHTML = '';
      this.skillModalEl.appendChild(sheet);
    }
    sheet.dataset.activeTab = curTab;
    sheet.setAttribute('aria-label', isCodex ? 'Monster Codex & Drop Guide' : 'Monster Skill Scrolls & Combat Class');
    sheet.innerHTML = sheetInnerHtml;

    const nextFilterStrip = sheet.querySelector('.sf-codex-filters');
    if (nextFilterStrip && prevFilterScrollLeft > 0) {
      nextFilterStrip.scrollLeft = prevFilterScrollLeft;
    }
    const nextWepStrip = sheet.querySelector('.sf-wep-strip');
    if (nextWepStrip && prevWepScrollLeft > 0) {
      nextWepStrip.scrollLeft = prevWepScrollLeft;
    }
    if (!opts.skipScrollRestore) {
      sheet.scrollTop = opts.resetScroll ? 0 : (this._skillModalScroll[curTab] || 0);
    }
  }

  async _onSkillModalClick(e) {
    if (e.target === this.skillModalEl || e.target.closest('[data-skill-close]')) {
      e.preventDefault();
      this.closeSkillModal();
      return;
    }

    const tabBtn = e.target.closest('[data-book-tab]');
    if (tabBtn) {
      e.preventDefault();
      const rawTab = tabBtn.getAttribute('data-book-tab');
      const nextTab = ['codex', 'passives', 'reactions'].includes(rawTab) ? rawTab : 'skills';
      if (this._skillModalTab !== nextTab) {
        const sheet = this.skillModalEl?.querySelector?.('.sf-skill-sheet');
        if (sheet && this._skillModalScroll) {
          this._skillModalScroll[this._skillModalTab || 'skills'] = sheet.scrollTop;
        }
        this._skillModalTab = nextTab;
        if (nextTab === 'skills') this._codexFocusId = null;
        else this._skillFocusId = null;
        this.playGatherSfx('auto_on');
        this._renderSkillModalHtml(this._getProfile());
      }
      return;
    }

    const filterBtn = e.target.closest('[data-codex-filter]');
    if (filterBtn) {
      e.preventDefault();
      const f = filterBtn.getAttribute('data-codex-filter') || 'all';
      this._codexFilter = f;
      this._codexFocusId = null;
      if (this._skillModalScroll) this._skillModalScroll.codex = 0;
      this._renderSkillModalHtml(this._getProfile(), { resetScroll: true });
      requestAnimationFrame(() => {
        const activePill = this.skillModalEl?.querySelector?.(`[data-codex-filter="${f}"]`);
        activePill?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      return;
    }

    const skillFilterBtn = e.target.closest('[data-skill-filter]');
    if (skillFilterBtn) {
      e.preventDefault();
      const sf = skillFilterBtn.getAttribute('data-skill-filter') || 'all';
      this._skillRegionFilter = sf;
      this._skillFocusId = null;
      if (this._skillModalScroll) this._skillModalScroll.skills = 0;
      this._renderSkillModalHtml(this._getProfile(), { resetScroll: true });
      requestAnimationFrame(() => {
        const activePill = this.skillModalEl?.querySelector?.(`[data-skill-filter="${sf}"]`);
        activePill?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      return;
    }

    const openCodexMob = e.target.closest('[data-open-codex-mob]');
    if (openCodexMob) {
      e.preventDefault();
      const sheet = this.skillModalEl?.querySelector?.('.sf-skill-sheet');
      if (sheet && this._skillModalScroll) this._skillModalScroll.skills = sheet.scrollTop;
      const mobId = openCodexMob.getAttribute('data-open-codex-mob');
      this.openCodexModal(mobId, 'all');
      return;
    }

    const jumpSkill = e.target.closest('[data-jump-skill]');
    if (jumpSkill) {
      e.preventDefault();
      const sheet = this.skillModalEl?.querySelector?.('.sf-skill-sheet');
      if (sheet && this._skillModalScroll) this._skillModalScroll.codex = sheet.scrollTop;
      const skId = jumpSkill.getAttribute('data-jump-skill');
      this._skillModalTab = 'skills';
      this._skillRegionFilter = 'all';
      this._skillFocusId = skId;
      this._renderSkillModalHtml(this._getProfile(), { skipScrollRestore: true });
      requestAnimationFrame(() => {
        const el = this.skillModalEl?.querySelector?.(`[data-skill-card="${skId}"]`);
        el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      });
      return;
    }

    const wepEl = e.target.closest('[data-quick-weapon]');
    if (wepEl) {
      e.preventDefault();
      const itemId = wepEl.getAttribute('data-quick-weapon');
      const p = this._getProfile();
      if (!itemId || !p) return;
      const baseEqId = p.equipped?.gloves?.id || null;
      let res = null;
      if (!baseEqId) {
        res = await this.request('wardrobe_equip', { slot: 'gloves', itemId });
      } else {
        const nextGlam = itemId === baseEqId ? null : itemId;
        res = await this.request('wardrobe_glamour', { slot: 'gloves', itemId: nextGlam });
      }
      if (res?.ok) {
        const nextProf = res.profile || this._getProfile();
        if (nextProf && this.world?.local) {
          this.world.local.profile = nextProf;
          this.world.applyEquipment?.(nextProf.id, nextProf.equipped, nextProf.appearance);
        }
        this.onProfileUpdate(nextProf);
        this._renderSkillModalHtml(nextProf);
        const cls = WEAPON_CLASSES[activeWeaponClass(nextProf?.equipped, nextProf?.glamour)] || WEAPON_CLASSES.melee;
        this.playGatherSfx('perfect', 1);
        this.toast?.(`${cls.icon} Switched to ${cls.label}!`, 1800);
      } else if (res?.error) {
        this.toast?.(`⚠️ ${res.error}`, 1800);
      }
      return;
    }

    const lockedSlotBtn = e.target.closest('[data-locked-slot]');
    if (lockedSlotBtn) {
      e.preventDefault();
      this._showSlotLockedToast(Number(lockedSlotBtn.getAttribute('data-locked-slot')) || 0);
      return;
    }

    const craftReason = e.target.closest('[data-craft-reason]');
    if (craftReason) {
      e.preventDefault();
      this.toast?.(`🔮 ${craftReason.getAttribute('data-craft-reason') || 'Cannot craft yet'}`, 2000);
      return;
    }

    const craftBtn = e.target.closest('[data-essence-craft]');
    if (craftBtn) {
      e.preventDefault();
      await this._essenceCraft(craftBtn.getAttribute('data-essence-craft'));
      return;
    }

    const passiveBtn = e.target.closest('[data-equip-passive]');
    if (passiveBtn) {
      e.preventDefault();
      await this._equipPassive(passiveBtn.getAttribute('data-equip-passive') || null);
      return;
    }

    const presetCycle = e.target.closest('[data-preset-name-cycle]');
    if (presetCycle) {
      e.preventDefault();
      this._cyclePresetName(Number(presetCycle.getAttribute('data-preset-name-cycle')) || 0);
      return;
    }
    if (e.target.closest('[data-preset-name-input]')) return; // focusing the inline name field

    const presetSave = e.target.closest('[data-preset-save]');
    if (presetSave) {
      e.preventDefault();
      await this._savePreset(Number(presetSave.getAttribute('data-preset-save')) || 0);
      return;
    }

    const presetLoad = e.target.closest('[data-preset-load]');
    if (presetLoad) {
      e.preventDefault();
      await this._loadPreset(Number(presetLoad.getAttribute('data-preset-load')) || 0);
      return;
    }

    const eqBtn = e.target.closest('[data-equip-skill]');
    if (eqBtn) {
      e.preventDefault();
      const skId = eqBtn.getAttribute('data-equip-skill');
      const slot = Number(eqBtn.getAttribute('data-equip-slot')) || 0;
      if (!this._getSlotUnlocks()[slot]) {
        this._showSlotLockedToast(slot);
        return;
      }
      const p = this._getProfile();
      const curSlotSk = p?.frontier?.skills?.equipped?.[slot];
      await this._equipSkillSlot(slot, curSlotSk === skId ? null : skId);
      return;
    }

    const huntBtn = e.target.closest('[data-hunt-skill-source]');
    if (huntBtn) {
      e.preventDefault();
      const sourceId = huntBtn.getAttribute('data-hunt-skill-source');
      const reg = BOSSES[sourceId]?.region || MONSTERS[sourceId]?.region || 'meadow';
      const unlocked = reg === 'meadow' || this._isGateUnlocked({ requires: reg });
      if (!unlocked) {
        const rm = REGION_META[reg];
        this.toast?.(`🔒 Complete Story Chapter ${rm?.unlockChapter || 2} to unlock ${rm?.name || reg}!`, 2600);
        return;
      }
      this.closeSkillModal();
      this.seekObjective(sourceId, { auto: true, lockSpecies: true });
    }
  }

  dispose() {
    this.exit();
    if (this._tagIconReloadTimer) { clearTimeout(this._tagIconReloadTimer); this._tagIconReloadTimer = null; }
    this.skillVfx?.dispose?.();
    if (this._skillKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._skillKeyHandler);
      this._skillKeyHandler = null;
    }
    if (this._tagSpriteTexCache) {
      for (const entry of this._tagSpriteTexCache.values()) entry?.tex?.dispose?.();
      this._tagSpriteTexCache.clear();
    }
    if (this.hudEl?.parentNode) {
      this.hudEl.parentNode.removeChild(this.hudEl);
      this.hudEl = null;
    }
    if (this.world?.scene) {
      this.world.scene.remove(this.root);
    }
  }
}
