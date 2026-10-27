// client/js/ui_components.js — Reusable Style 2 (Tree of Savior × Cookie Run: Kingdom)
// Data-Driven UI Component Primitives for NEORA WORLD V2 (Steps 3, 4, and 5).
// Zero hardcoded per-item HTML: resolves all sprites, rarities, stats, and paper-doll layers
// automatically from shared catalogs and client/assets/asset_manifest.json.

import * as THREE from 'three';
import { ACCESSORIES, DICE_SKINS, PETS, PET_FAMILIES, petLocomotion, resolveWeaponClass } from '/shared/catalog_gear_pets.js';
import { resolvePetSpriteKey, resolvePetUiScale } from '/shared/pet_catalog.js';
import { computePetPassives, normalizeActivePoses } from '/shared/pet_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { WONDERS, DECOR, CORE, BLUEPRINT_CARDS } from '/shared/catalog_landmarks.js';
import { SLOTS, slotCP, recalcPlayerCP } from '/shared/progression.js';
import { itemDef, itemSlot, FEATURED_OUTFIT, MYTHIC_DICE, petPassivePct, forgeReady } from '/shared/rpg_rules.js';
import { computePaperDollParts, OUTFIT_FALLBACK, activeWeaponClass, visibleSlotId } from '/shared/accessory_attach.js';
import { HAIRSTYLES, HAIR_COLORS, hairSpriteName } from '/shared/hair_catalog.js';
import { normalizeItemStats, matchMods } from '/shared/monopoly_rules.js';
import { computeUniversalStats, inspectItemAttune, skyFrontierMods } from '/shared/universal_stats.js';
import { detectBuild, BUILDS, BUILD_PERKS } from '/shared/dash_builds.js';
import { loadManifest, spriteInfo } from './assets.js';
import { ChibiRig } from './chibi_rig.js?v=cd37';

export const fmtNum = (n) => (n >= 100000 ? `${(n / 1000).toFixed(1)}K` : Number(n || 0).toLocaleString('en-US'));

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const SLOT_LABELS = {
  outfit: 'Outfit',
  hat: 'Hat',
  face: 'Face',
  gloves: '⚔️ Hands & Weapon',
  boots: 'Boots',
  wings: 'Wings',
  dice: '3D Dice',
};

export const SLOT_SHORT_LABELS = {
  outfit: 'Outfit',
  hat: 'Hat',
  face: 'Face',
  gloves: '⚔️ Weapon',
  boots: 'Boots',
  wings: 'Wings',
  dice: '3D Dice',
};

export const SLOT_ROLE_GUIDE = {
  outfit: {
    icon: '👘',
    badge: '🌈 Ultimate + 4 Stats',
    text: 'Unlocks your [🌈 Ultimate] skill in 🎲 Monopoly, 🏝️ Sky Frontier & ☁️ Cloud Dash + boosts Universal Stats (+0→+10).',
  },
  hat: {
    icon: '🎩',
    badge: 'Universal 4-Stat Gear',
    text: 'Boosts 🔥 Power, ⚡ Swiftness, 💖 Vitality & 🍀 Luck across all 3 modes! Wear any cute hat & Forge +0→+10.',
  },
  face: {
    icon: '👓',
    badge: 'Universal 4-Stat Gear',
    text: 'Boosts 🔥 Power, ⚡ Swiftness, 💖 Vitality & 🍀 Luck across all 3 modes! Wear any glasses/blush & Forge +0→+10.',
  },
  gloves: {
    icon: '⚔️',
    badge: 'Hands & Weapon (Class + 4 Stats)',
    text: 'Sets your Sky Frontier Combat Class (⚔️ Melee / 🏹 Ranged / 🪄 Magic via Visible Glamour || Equipped) & boosts 🔥 Power, ⚡ Swiftness, 💖 Vitality & 🍀 Luck (+0→+10).',
  },
  boots: {
    icon: '🥾',
    badge: 'Universal 4-Stat Gear',
    text: 'Boosts ⚡ Swiftness, 🔥 Power, 💖 Vitality & 🍀 Luck in 🎲 Monopoly, 🏝️ Sky Frontier & ☁️ Cloud Dash (+0→+10).',
  },
  wings: {
    icon: '🪽',
    badge: '4 Stats + Star Aura',
    text: 'Boosts your 4 Universal Stats across all 3 modes + radiates +5 / +8 / +10 Blacksmith Star-Force Aura!',
  },
  dice: {
    icon: '🎲',
    badge: '3D Dice + 4 Stats',
    text: 'Custom 3D Dice skin on the Monopoly board + boosts your 4 Universal Stats across all 3 modes (+0→+10).',
  },
};

const PET_FAMILY_SPRITE = {
  cats:     'cat_front',
  dragons:  'dragon_front',
  pups:     'pup_front',
  fae:      'bunny_front',
  chonkers: 'capybara_front',
  spirits:  'wisp_front',
};

const protectionScrollDef = {
  name: '+10 Artisan Scroll',
  desc: '+25% forge success and double pity on a miss (upgrades to +5 … +10)',
  url: '/assets/ui/item_protection_scroll.png',
  rarity: 3,
};

const dupeBoxDef = {
  name: 'Random Dupe Chest',
  desc: 'Grants +1 Duplicate for Blacksmith Star-Force',
  url: '/assets/ui/item_dupe_box.png',
  rarity: 2,
};

export const BAG_ITEM_CATALOG = {
  ticket_standard: {
    name: 'Standard Summon Ticket',
    desc: '1× Free Pull in Box 1: Goddess Fashion Gacha',
    url: '/assets/ui/item_ticket_standard.png',
    rarity: 2,
  },
  ticket_gold: {
    name: 'Golden Architect Ticket',
    desc: '1× Free Pull in Box 2: Royal Architect Gacha',
    url: '/assets/ui/item_ticket_gold.png',
    rarity: 2,
  },
  ticket_royal_hair: {
    name: 'Royal Hair Coupon',
    desc: '1× Free Pull at Fluffé’s Hair Studio (Royal & Celestial Gacha)',
    url: '/assets/ui/item_ticket_royal_hair.png',
    rarity: 3,
    action: 'open_hair_studio',
  },
  vip_communicator: {
    name: 'VIP Starlight Communicator',
    desc: 'Permanent Unlimited 1-on-1 Voice Calls + +20💎/15m',
    url: '/assets/ui/item_vip_communicator.png',
    rarity: 3,
  },
  protection_scroll: protectionScrollDef,
  scroll_forge_boost: protectionScrollDef,
  streak_freeze: {
    name: 'Streak Freeze Crystal',
    desc: 'Protects your Couple Harmony Streak for 24h',
    url: '/assets/ui/item_streak_freeze.png',
    rarity: 2,
  },
  dupe_box: dupeBoxDef,
  random_dupe_box: dupeBoxDef,
  mythic_selector_box: {
    name: 'Mythic Outfit Selector Box',
    desc: 'Founder Heritage Chest — Unlocks any ★3 Season Mythic Outfit',
    url: '/assets/ui/item_dupe_box.png',
    rarity: 3,
  },
  vip_call_day_pass: {
    name: 'Sky Call Day-Pass',
    desc: '24h Unlimited 1-on-1 Voice Calls',
    url: '/assets/ui/item_ticket_standard.png',
    rarity: 2,
  },
  vip_telelink_box: {
    name: 'Tele-Link Couple Box',
    desc: 'Unlocks Permanent Free Calls for Both Bound Partners',
    url: '/assets/ui/vip_card_telelink.png',
    rarity: 3,
  },
  vip_black: {
    name: 'Sovereign Black VIP Card',
    desc: 'All Friends Free Calls + +30💎/15m Couple Talk',
    url: '/assets/ui/vip_card_black_sovereign.png',
    rarity: 3,
  },
};

export const STAT_PILL_META = {
  power:     { icon: '🔥', label: 'Power',     short: 'PWR', cls: 'stat-power' },
  swiftness: { icon: '⚡', label: 'Swiftness', short: 'SWF', cls: 'stat-swiftness' },
  fortune:   { icon: '💖', label: 'Vitality',  short: 'VIT', cls: 'stat-fortune' },
  luck:      { icon: '🍀', label: 'Luck',      short: 'LCK', cls: 'stat-luck' },
};

export const WEAPON_CLASS_META = {
  melee:  { id: 'melee',  icon: '⚔️', label: 'Melee',  badge: '⚔️ Melee',  cls: 'wc-melee' },
  ranged: { id: 'ranged', icon: '🏹', label: 'Ranged', badge: '🏹 Ranged', cls: 'wc-ranged' },
  magic:  { id: 'magic',  icon: '🪄', label: 'Magic',  badge: '🪄 Magic',  cls: 'wc-magic' },
};

export const FORGE_GRADE_META = {
  SS: { grade: 'SS', label: 'Masterwork', pill: '[SS · Masterwork]', cls: 'grade-ss' },
  S:  { grade: 'S',  label: 'Heroic',     pill: '[S · Heroic]',      cls: 'grade-s' },
  A:  { grade: 'A',  label: 'Fine',       pill: '[A · Fine]',        cls: 'grade-a' },
  B:  { grade: 'B',  label: 'Sturdy',     pill: '[B · Sturdy]',      cls: 'grade-b' },
};

export function renderWeaponClassBadge(itemId, { compact = false } = {}) {
  if (!itemId || itemSlot(itemId) !== 'gloves') return '';
  const wCls = resolveWeaponClass(itemId);
  const meta = WEAPON_CLASS_META[wCls] || WEAPON_CLASS_META.melee;
  return `<span class="s2-weapon-class-badge ${meta.cls}${compact ? ' is-compact' : ''}" title="Sky Frontier Combat Class: ${meta.badge}">${meta.badge}</span>`;
}

export function renderWeaponGradePill(itemId, profile = null, { compact = false } = {}) {
  if (!itemId) return '';
  const def = itemDef(itemId);
  const invEntry = profile?.inventory?.[itemId];
  const slot = itemSlot(itemId);
  const eqEntry = (slot && profile?.equipped?.[slot]?.id === itemId) ? profile.equipped[slot] : null;
  const grade = invEntry?.forgeGrade || eqEntry?.forgeGrade || null;
  if (grade && FORGE_GRADE_META[grade]) {
    const gMeta = FORGE_GRADE_META[grade];
    return `<span class="s2-forge-grade-pill ${gMeta.cls}${compact ? ' is-compact' : ''}" title="Tinker's Workshop Anvil Grade: ${gMeta.pill}">${gMeta.pill}</span>`;
  }
  if (def?.bossCraft) {
    return `<span class="s2-forge-grade-pill grade-uncrafted${compact ? ' is-compact' : ''}" title="Boss-Crafted Weapon at Tinker's Workshop">[⚒️ Boss Craft]</span>`;
  }
  return '';
}

export function renderActiveWeaponClassBanner(profile) {
  const cls = activeWeaponClass(profile?.equipped, profile?.glamour);
  const meta = WEAPON_CLASS_META[cls] || WEAPON_CLASS_META.melee;
  const visId = visibleSlotId(profile?.equipped, 'gloves', profile?.glamour);
  const visDef = visId ? itemDef(visId) : null;
  const visLabel = visDef ? shortenGearName(visDef.name) : 'Bare Hands';
  return `
    <div class="s2-active-combat-banner ${meta.cls}">
      <div class="s2-acb-main">
        <span class="s2-acb-title">Active Combat Style:</span>
        <span class="s2-weapon-class-badge ${meta.cls}">${meta.badge}</span>
        <small class="s2-acb-source">(follows Visible Glamour || Equipped · ${escapeHtml(visLabel)})</small>
      </div>
      <div class="s2-acb-sub">✨ Swap <b>👗 Wear Look</b> on any weapon to switch combat class freely while keeping your highest <b>+10</b> refined stats!</div>
    </div>
  `;
}

export function resolveItemRawStats(itemId, profile = null, rolledStatsOverride = null) {
  const def = itemDef(itemId);
  if (!def) return null;
  const invEntry = profile?.inventory?.[itemId];
  const slot = itemSlot(itemId);
  const eqEntry = (slot && profile?.equipped?.[slot]?.id === itemId) ? profile.equipped[slot] : null;
  const effRarity = def.rarity === 'super_mythic' ? 3 : (def.rarity || 1);
  const rawStats = rolledStatsOverride || invEntry?.rolledStats || eqEntry?.rolledStats || def.stats;
  return rawStats || (effRarity === 3 ? { all: 24 } : { all: 8 });
}

export function getItemEffectiveStats(itemId, refine = 0, attuneStat = null, opts = {}) {
  const def = itemDef(itemId);
  if (!def) return { power: 0, swiftness: 0, fortune: 0, luck: 0, isAll: false, allVal: 0 };
  const mult = 1 + 0.15 * Math.max(0, refine | 0);
  const effRarity = def.rarity === 'super_mythic' ? 3 : (def.rarity || 1);
  const profile = opts?.profile || null;
  const invEntry = profile?.inventory?.[itemId];
  const slot = itemSlot(itemId);
  const eqEntry = (slot && profile?.equipped?.[slot]?.id === itemId) ? profile.equipped[slot] : null;
  const rawStats = opts?.rolledStats || invEntry?.rolledStats || eqEntry?.rolledStats || def.stats;
  const raw = rawStats || (effRarity === 3 ? { all: 24 } : { all: 8 });
  const norm = normalizeItemStats(raw, effRarity);
  const allBonus = Number(norm.all || raw.all || 0);
  if (allBonus > 0 && !norm.power && !norm.swiftness && !norm.fortune && !norm.luck) {
    const v = Math.round(allBonus * mult);
    return { power: v, swiftness: v, fortune: v, luck: v, isAll: true, allVal: v };
  }
  const effAttune = attuneStat ?? invEntry?.attune?.stat ?? eqEntry?.attune?.stat ?? null;
  const info = inspectItemAttune(itemId, refine, effAttune, { rolledStats: rawStats || undefined });
  if (info?.attunable) {
    const out = { power: 0, swiftness: 0, fortune: 0, luck: 0, isAll: false, allVal: 0 };
    if (info.mainStat) out[info.mainStat] += info.mainVal;
    const secKey = (refine >= 5 && effAttune && info.allowedStats?.includes(effAttune))
      ? effAttune
      : (info.activeSecStat || info.defaultSecStat);
    if (secKey) out[secKey] += info.secVal;
    return out;
  }
  const power = Math.round(((norm.power || 0) + allBonus) * mult);
  const swiftness = Math.round(((norm.swiftness || 0) + allBonus) * mult);
  const fortune = Math.round(((norm.fortune || 0) + allBonus) * mult);
  const luck = Math.round(((norm.luck || 0) + allBonus) * mult);
  return { power, swiftness, fortune, luck, isAll: false, allVal: 0 };
}


export function formatStatsSummary(stats, rarity = 1, refine = 0) {
  if (!stats) return '';
  const mult = 1 + 0.15 * Math.max(0, refine | 0);
  if (stats.all && !stats.power && !stats.swiftness && !stats.fortune && !stats.luck && !stats.charm) {
    return `+${Math.round(stats.all * mult)} All 4 Stats`;
  }
  const norm = normalizeItemStats(stats, rarity);
  const parts = [];
  for (const k of ['power', 'swiftness', 'fortune', 'luck']) {
    const v = Math.round((norm[k] || 0) * mult);
    if (v > 0) {
      const m = STAT_PILL_META[k];
      parts.push(`${m.icon} +${v} ${m.label}`);
    }
  }
  return parts.join(' • ');
}

export function formatCharmTooltip(charm) {
  if (!charm) return '';
  const parts = [charm.name || 'Charm'];
  if (charm.ultimate) {
    parts.push(`⚡ Ultimate: ${charm.ultimate.name} (${charm.ultimate.cooldownSec}s) — ${charm.ultimate.desc}`);
  }
  return parts.join(' | ');
}

export function renderCharmCard(charm, { owned = false } = {}) {
  if (!charm) return '';
  const ultText = charm.ultimate ? `⚡ Ultimate: ${charm.ultimate.name} (${charm.ultimate.cooldownSec}s) — ${charm.ultimate.desc}` : '';
  return `
    <div class="s2-charm-card" title="${escapeHtml(ultText)}">
      <span class="s2-charm-name">${escapeHtml(charm.name)}</span>
      ${ultText ? `<div class="s2-charm-ult" style="font-size:11px;color:#fde047;margin-top:2px;">${escapeHtml(ultText)}</div>` : ''}
    </div>
  `;
}

export function renderItemStatPills(itemId, refine = 0, { compact = false, profile = null, attuneStat = null, rolledStats = null } = {}) {
  const eff = getItemEffectiveStats(itemId, refine, attuneStat, { profile, rolledStats });
  if (!eff.power && !eff.swiftness && !eff.fortune && !eff.luck) return '';
  if (eff.isAll) {
    return `<div class="s2-item-stat-pills"><span class="s2-item-stat-pill stat-all" title="Boosts Power, Swiftness, Vitality &amp; Luck across Monopoly, Sky Frontier &amp; Cloud Dash">🌟 +${eff.allVal} ${compact ? 'All Stats' : 'All 4 Stats'}</span></div>`;
  }
  const pills = [];
  for (const k of ['power', 'swiftness', 'fortune', 'luck']) {
    const v = eff[k];
    if (v > 0) {
      const m = STAT_PILL_META[k];
      pills.push(
        `<span class="s2-item-stat-pill ${m.cls}" title="${m.label} (Monopoly • Sky Frontier • Cloud Dash)">${m.icon} +${v} ${compact ? m.short : m.label}</span>`
      );
    }
  }
  return `<div class="s2-item-stat-pills">${pills.join('')}</div>`;
}

export const SHARD_OFFER_VISUALS = {
  mythic_outfit: {
    rarity: 3,
    resolveId: (pickId) => pickId || FEATURED_OUTFIT,
  },
  vip_wonder: {
    rarity: 3,
    resolveId: (pickId) => pickId || Object.keys(WONDERS).find((k) => WONDERS[k].w === 4 && WONDERS[k].h === 4),
  },
  seraphim_wings: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.item,
  },
  night_fury_egg: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.pet,
  },
  nyx_egg: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.pet,
  },
  ragdoll_egg: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.pet,
  },
  kitsune_egg: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.pet,
  },
  skywhale_egg: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.pet,
  },
  vip_communicator: {
    rarity: 3,
    resolveId: (_pickId, offer) => offer?.bag,
  },
  mythic_dice: {
    rarity: 3,
    resolveId: (pickId) => pickId || MYTHIC_DICE[0] || 'dice_zeus_thunder',
  },
  accessory_dupe_box: {
    rarity: 2,
    resolveId: (pickId) => pickId || 'dupe_box',
  },
};

/**
 * Dynamically resolves visual, rarity, and subtitle for any Shard Shop offer directly from
 * shared catalogs (OUTFITS, WONDERS, ACCESSORIES, DICE_SKINS, PETS, BAG_ITEM_CATALOG) without hardcoding.
 */
export function resolveShardOfferMeta(offerId, offer = {}, curPick = '', lineage = 'bkk') {
  const vmeta = SHARD_OFFER_VISUALS[offerId] || {};
  let targetId = vmeta.resolveId ? vmeta.resolveId(curPick, offer) : (curPick || offer.item || offer.pet || offer.bag || null);

  if (!targetId) {
    if (offer.pick === 'outfit') targetId = curPick || FEATURED_OUTFIT;
    else if (offer.pick === 'wonder') targetId = curPick || Object.keys(WONDERS).find((k) => WONDERS[k].w === 4 && WONDERS[k].h === 4);
    else if (offer.pick === 'dice') targetId = curPick || MYTHIC_DICE[0] || 'dice_zeus_thunder';
    else if (offer.pick === 'accessory') targetId = curPick || 'dupe_box';
  }

  const vis = targetId
    ? resolveItemVisual(targetId, lineage)
    : { url: vmeta.url || '/assets/ui/icon_shard.png', filter: 'none', name: offer.name || offerId, rarity: vmeta.rarity || 3 };

  let rarity = vis.rarity || vmeta.rarity || 3;
  let sub = vmeta.sub || '';

  if (offer.pick === 'outfit') {
    const pickedOutfit = curPick && OUTFITS[curPick];
    if (pickedOutfit) {
      sub = `Season ${pickedOutfit.season} • ${pickedOutfit.name}`;
    } else {
      const seasons = Object.values(OUTFITS).map((o) => o.season).filter(Boolean);
      const minS = seasons.length ? Math.min(...seasons) : 1;
      const maxS = seasons.length ? Math.max(...seasons) : 11;
      sub = `Season ${minS}–${maxS} Mythic Outfit Set`;
    }
  } else if (offer.pick === 'wonder') {
    const w = WONDERS[targetId];
    sub = w ? `${w.w}×${w.h} Wonder (${w.effect})` : 'VIP Wonder Direct Exchange';
  } else if (offer.pick === 'dice') {
    const d = DICE_SKINS[targetId];
    const st = formatStatsSummary(d?.stats, d?.rarity || 3);
    sub = d ? `★3 Mythic 3D Dice${st ? ` (${st})` : ''}` : 'Any ★3 Mythic 3D Dice Skin';
  } else if (offer.pick === 'accessory') {
    const acc = curPick && (ACCESSORIES[curPick] || DICE_SKINS[curPick]);
    if (acc) {
      rarity = acc.rarity || rarity;
      const st = formatStatsSummary(acc.stats, rarity);
      sub = `${SLOT_LABELS[acc.slot] || acc.slot}${st ? ` (${st})` : ''}`;
    } else {
      sub = BAG_ITEM_CATALOG.dupe_box?.desc || 'Select Accessory for +1 Dupe';
    }
  } else if (offer.item && itemDef(offer.item)) {
    const def = itemDef(offer.item);
    const slot = itemSlot(offer.item);
    const st = formatStatsSummary(def.stats, def.rarity || 2);
    sub = `${SLOT_LABELS[slot] || slot}${st ? ` (${st})` : ''}`;
  } else if (offer.pet && PETS[offer.pet]) {
    const pdef = PETS[offer.pet];
    const fam = PET_FAMILIES[pdef.family];
    const passiveLabel = fam?.passive ? fam.passive.replace(/_/g, ' ') : 'bonus';
    sub = `${fam?.name || 'Soul-Bond Pet'} (+${passiveLabel})`;
  } else if (offer.bag && BAG_ITEM_CATALOG[offer.bag]) {
    sub = BAG_ITEM_CATALOG[offer.bag].desc;
  }

  return { vis, rarity, sub };
}


/**
 * Universal data-driven sprite resolver for ANY item ID in NEORA WORLD V2.
 */
export function resolveItemVisual(id, lineage = 'bkk') {
  const lin = lineage === 'dxb' ? 'dxb' : 'bkk';
  if (!id) {
    return {
      url: `/assets/chibi/${lin}_base_front.png`,
      filter: 'none',
      name: 'Empty',
      rarity: 1,
      kind: 'empty',
    };
  }

  // 1. Outfits
  if (OUTFITS[id]) {
    const o = OUTFITS[id];
    const map = OUTFIT_FALLBACK[id];
    if (!map || spriteInfo(`${lin}_${id}_front`)) {
      return {
        url: `/assets/chibi/${lin}_${id}_front.png`,
        filter: 'none',
        name: o.name,
        rarity: o.rarity || 3,
        kind: 'outfit',
        slot: 'outfit',
      };
    }
    const spriteKey = map.base === 'base' ? `${lin}_base_front` : `${lin}_${map.base}_front`;
    return {
      url: `/assets/chibi/${spriteKey}.png`,
      filter: map.filter || 'none',
      name: o.name,
      rarity: o.rarity || 1,
      kind: 'outfit',
      slot: 'outfit',
    };
  }

  // 2. Accessories
  if (ACCESSORIES[id]) {
    const a = ACCESSORIES[id];
    return {
      url: `/assets/chibi/${id}.png`,
      filter: 'none',
      name: a.name,
      rarity: a.rarity || 1,
      kind: 'accessory',
      slot: a.slot,
    };
  }

  // 2b. 3D Dice Skins
  if (DICE_SKINS[id]) {
    const d = DICE_SKINS[id];
    return {
      url: `/assets/ui/${id}.png`,
      filter: 'none',
      name: d.name,
      rarity: d.rarity || 1,
      kind: 'dice',
      slot: 'dice',
    };
  }

  // 3. Pets
  if (PETS[id]) {
    const p = PETS[id];
    const v2Spr = resolvePetSpriteKey(id, 1, 'front');
    if (spriteInfo(v2Spr)) {
      return {
        url: `/assets/pets/${v2Spr}.png`,
        filter: 'none',
        name: p.name,
        rarity: p.rarity || 3,
        kind: 'pet',
        family: p.family,
      };
    }
    const spr = PET_FAMILY_SPRITE[p.family] || 'capybara_front';
    return {
      url: `/assets/pets/${spr}.png`,
      filter: p.filter || 'none',
      name: p.name,
      rarity: p.rarity || 1,
      kind: 'pet',
      family: p.family,
    };
  }

  // 4. Eggs
  if (typeof id === 'string' && id.startsWith('egg_')) {
    return {
      url: `/assets/pets/${id}.png`,
      filter: 'none',
      name: id.replace(/^egg_/, '').toUpperCase() + ' Egg',
      rarity: 3,
      kind: 'egg',
    };
  }

  // 5. VIP Wonders
  if (WONDERS[id]) {
    const w = WONDERS[id];
    return {
      url: `/assets/village/${w.sprite}.png`,
      filter: 'none',
      name: w.name,
      rarity: w.rarity || 3,
      kind: 'wonder',
      effect: w.effect,
    };
  }

  // 6. Decor
  if (DECOR[id]) {
    const d = DECOR[id];
    return {
      url: `/assets/village/${d.sprite}.png`,
      filter: 'none',
      name: d.name,
      rarity: 1,
      kind: 'decor',
      effect: d.effect,
    };
  }

  // 7. Core Landmarks or Blueprints (e.g. 'mint' or 'bp_mint')
  const coreKey = typeof id === 'string' ? id.replace(/^bp_/, '') : '';
  if (CORE[coreKey]) {
    const c = CORE[coreKey];
    const isBp = id.startsWith('bp_');
    return {
      url: `/assets/village/${c.sprite}.png`,
      badgeUrl: isBp ? '/assets/ui/item_blueprint_scroll.png' : null,
      filter: 'none',
      name: isBp ? `${c.name} Blueprint` : c.name,
      rarity: isBp ? 1 : 2,
      kind: isBp ? 'blueprint' : 'core',
      effect: c.effect,
    };
  }

  // 8. Bag / Ticket / Special Items
  if (BAG_ITEM_CATALOG[id]) {
    const b = BAG_ITEM_CATALOG[id];
    return {
      url: b.url,
      filter: 'none',
      name: b.name,
      rarity: b.rarity || 2,
      kind: 'bag',
    };
  }

  // 9. Hairstyles (Step 3.5)
  if (HAIRSTYLES[id]) {
    const h = HAIRSTYLES[id];
    return {
      url: `/assets/chibi/${hairSpriteName(id, 'front')}.png`,
      filter: 'none',
      name: h.name,
      rarity: h.tier === 'celestial' ? 3 : h.tier === 'royal' ? 2 : 1,
      kind: 'hair',
      tier: h.tier,
    };
  }

  return {
    url: '/assets/ui/icon_shard.png',
    filter: 'none',
    name: String(id),
    rarity: 1,
    kind: 'misc',
  };
}

/**
 * Renders a reusable Style-2 square or round icon thumbnail with rarity frame and optional badges.
 */
export function shortenGearName(rawName) {
  if (!rawName) return '(Empty)';
  return String(rawName)
    .replace(/^Season\s*\d+:\s*/i, '')
    .replace(/^Oracle\s+Starlight\s+/i, 'Oracle ')
    .replace(/^Golden\s+Seraphim\s+/i, 'Seraphim ')
    .replace(/^Hermes\s+Winged\s+/i, 'Winged ')
    .replace(/^Glowing\s+/i, '')
    .replace(/\s+Sovereign\s+/i, ' ')
    .replace(/\s*&\s*Hera\s+/i, ' ')
    .trim();
}

/**
 * Renders a bone-aligned 2-layer hair + body outfit thumbnail inside a 1:1 square rig box
 * so every hairstyle (short, long waves, braids, twin-tails, celestial) fits the skull 1:1
 * without bald forehead gaps or aspect-ratio distortion.
 */
export function renderOutfitThumbLayers(outfitId, {
  lineage = 'bkk',
  appearance = null,
  url = null,
  filter = 'none',
  alt = '',
  headCrop = false,
} = {}) {
  const isGirl = appearance?.body === 'girl' || (!appearance?.body && (lineage === 'dxb' || lineage === 'girl'));
  const lin = isGirl ? 'dxb' : 'bkk';
  const hairId = appearance?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  const hairColor = appearance?.hairColor || (lin === 'dxb' ? 'coral' : 'silver');
  const pd = computePaperDollParts({
    lineage: lin,
    equipped: { outfit: { id: outfitId || 'newbie_outfit' } },
    hair: hairId,
    hairColor,
    view: 'front',
    right: true,
    getSpriteInfo: spriteInfo,
  });
  const bodyUrl = url || pd.body.url;
  const bodyFilter = (filter && filter !== 'none')
    ? `filter:${filter};`
    : (pd.body.filter && pd.body.filter !== 'none' ? `filter:${pd.body.filter};` : '');
  const h = pd.hair;
  const hairBackHtml = h
    ? `<img class="s2-outfit-rig-hair-back" src="${h.url}" alt="" loading="lazy" style="left:calc(50% + ${h.cxPct.toFixed(2)}%);bottom:${h.cyPct.toFixed(2)}%;width:${h.wPct.toFixed(2)}%;height:${h.hPct.toFixed(2)}%;transform:translate(-50%, 50%) scaleX(${h.scaleX});" />`
    : '';
  const hairFrontHtml = h
    ? `<img class="s2-outfit-rig-hair-front" src="${h.url}" alt="" loading="lazy" style="left:calc(50% + ${h.cxPct.toFixed(2)}%);bottom:${h.cyPct.toFixed(2)}%;width:${h.wPct.toFixed(2)}%;height:${h.hPct.toFixed(2)}%;transform:translate(-50%, 50%) scaleX(${h.scaleX});clip-path:${h.frontClipPolygon || 'none'};" />`
    : '';
  return `
    <div class="s2-outfit-rig-thumb ${headCrop ? 'is-head-crop' : ''}">
      ${hairBackHtml}
      <img class="s2-outfit-rig-body s2-thumb-img" src="${bodyUrl}" alt="${escapeHtml(alt)}" loading="lazy" style="height:100%;width:auto;transform:translateX(-50%) scaleX(${pd.body.scaleX});${bodyFilter}" />
      ${hairFrontHtml}
    </div>
  `;
}

/**
 * Renders a reusable Style-2 square or round icon thumbnail with rarity frame and optional badges.
 * Automatically composites hair on top of outfit sprites so mannequins are never bald.
 */
export function renderIconThumb(id, {
  lineage = 'bkk',
  appearance = null,
  size = 54,
  refine = null,
  stars = null,
  badgeText = null,
  round = false,
  extraClass = '',
} = {}) {
  const vis = resolveItemVisual(id, lineage);
  const r = stars ?? vis.rarity ?? 1;
  const filterStyle = vis.filter && vis.filter !== 'none' ? `filter: ${vis.filter};` : '';
  const sizeStyle = size ? ` style="--thumb-size:${size}px;"` : '';
  const innerHtml = vis.kind === 'outfit'
    ? renderOutfitThumbLayers(id, { lineage, appearance, url: vis.url, filter: vis.filter, alt: vis.name })
    : `<img class="s2-thumb-img" src="${vis.url}" alt="${escapeHtml(vis.name)}" style="${filterStyle}" loading="lazy" />`;
  return `
    <div class="s2-thumb s2-rarity-${r} ${vis.kind === 'outfit' ? 'is-outfit-thumb' : ''} ${round ? 'is-round' : ''} ${extraClass}"${sizeStyle}>
      ${innerHtml}
      ${vis.badgeUrl ? `<img class="s2-thumb-corner" src="${vis.badgeUrl}" alt="" />` : ''}
      ${refine != null && refine > 0 ? `<span class="s2-thumb-refine">+${refine}</span>` : ''}
      ${badgeText ? `<span class="s2-thumb-badge">${escapeHtml(badgeText)}</span>` : ''}
    </div>
  `;
}

/**
 * Computes the 4 core RPG stats (Vitality, Swiftness, Power, Luck) dynamically from profile state.
 */
export function computePlayerStats(profile) {
  const uni = computeUniversalStats(profile);
  const stats = uni.total;
  const petFamily = uni.petFamily;
  const petPct = uni.petPct;

  const monoMods = matchMods(stats, { petFamily, petPct });
  const sf = skyFrontierMods(stats, { petFamily, petPct });
  const sfMods = sf;
  const mbMods = sf;
  const dashMods = {
    topSpeedPct: `+${Math.min(20, +(stats.swiftness * 0.04).toFixed(1))}%`,
    accelPct: `+${Math.min(25, +(stats.swiftness * 0.05).toFixed(1))}%`,
    furyChargePct: `+${Math.min(35, +(stats.power * 0.07).toFixed(1))}%`,
    knockbackResistPct: `-${Math.min(30, +(stats.power * 0.06).toFixed(1))}%`,
    podiumGoldPct: `+${Math.min(60, +(stats.fortune * 0.12).toFixed(1))}%`,
    magnetRadiusPct: `+${Math.min(40, +(stats.fortune * 0.08).toFixed(1))}%`,
    rareBoxPct: `+${Math.min(30, +(stats.luck * 0.06).toFixed(1))}%`,
    miracleShieldPct: `${Math.min(20, +(stats.luck * 0.04).toFixed(1))}%`,
  };

  return {
    fortunePct: +(stats.fortune * 0.25).toFixed(1),
    swiftnessPct: +(stats.swiftness * 0.15).toFixed(1),
    powerMult: +(1 + stats.power * 0.008).toFixed(2),
    luckPct: +(stats.luck * 0.12).toFixed(1),
    raw: stats,
    monoMods,
    sfMods,
    sf,
    mbMods,
    dashMods,
    base: uni.base,
    gear: uni.gear,
    pet: uni.pet,
    bonus: uni.bonus,
    total: uni.total,
  };
}

/**
 * Renders the 2x2 Style-2 Character Stat Breakdown Card (Screen 07 Mockup 07)
 * plus the interactive 3-Mode Universal Stat Bridge inspector.
 */
export function renderStatGrid(profile, selectedStat = null) {
  const st = computePlayerStats(profile);
  const sfMods = skyFrontierMods(st.total || st.raw);
  const pts = {
    fortune: Math.round(st.raw.fortune || 0),
    swiftness: Math.round(st.raw.swiftness || 0),
    power: Math.round(st.raw.power || 0),
    luck: Math.round(st.raw.luck || 0),
  };
  const topStatKey = ['swiftness', 'power', 'fortune', 'luck'].reduce(
    (best, k) => (pts[k] > pts[best] ? k : best),
    'swiftness',
  );
  const activeStat = ['fortune', 'swiftness', 'power', 'luck'].includes(selectedStat)
    ? selectedStat
    : null;

  const dashBuild = detectBuild(st.bonus);
  const tierRoman = ['', 'I', 'II', 'III', 'IV'][dashBuild.tier] || '';
  const tierStr = dashBuild.tier ? ` (Tier ${tierRoman})` : '';
  const buildPerkOrTip = dashBuild.perk || (dashBuild.id && BUILD_PERKS[dashBuild.id]?.[dashBuild.tier - 1]) || BUILDS[dashBuild.id]?.tip || '';
  let buildProgressTag = '';
  if (dashBuild.next && dashBuild.next.need) {
    const nxtRoman = ['', 'I', 'II', 'III', 'IV'][dashBuild.next.tier] || dashBuild.next.tier;
    const nxtStatLbl = STAT_PILL_META[dashBuild.next.stat]?.label || dashBuild.next.stat;
    buildProgressTag = `Next Tier ${nxtRoman}: ${Math.round(dashBuild.next.have || 0)}/${dashBuild.next.need} ${nxtStatLbl}`;
  } else if (dashBuild.stat && st.bonus?.[dashBuild.stat]) {
    const sharePct = Math.round((dashBuild.share?.[dashBuild.stat] || 0) * 100);
    const curStatLbl = STAT_PILL_META[dashBuild.stat]?.label || dashBuild.stat;
    buildProgressTag = `MAX TIER • ${Math.round(st.bonus[dashBuild.stat])} ${curStatLbl} (${sharePct}% share)`;
  }

  const sfPowerLine = `×${sfMods.attackDamageMult.toFixed(2)} All DMG (Combos &amp; Skills)`;
  const sfSwiftLine = `+${Math.round((sfMods.moveSpeedMult - 1) * 100)}% Spd · +${Math.round((sfMods.skillHasteMult - 1) * 100)}% Skill Haste`;
  const sfVitLine = `+${sfMods.maxHpBonus} Max HP · +${(sfMods.hpRegenPerSec || 0.6).toFixed(1)} HP/s · +${Math.round((sfMods.healShieldMult - 1) * 100)}% Heal/Shield · +${Math.round((sfMods.gatherYieldMult - 1) * 100)}% Yield`;
  const sfLuckLine = `${Math.round(sfMods.critChance * 100)}% Crit · +${Math.round((sfMods.rareFindMult - 1) * 100)}% Rare &amp; Scroll Drop`;

  const bridgeDetails = {
    fortune: {
      icon: '💖',
      label: 'Vitality',
      pts: pts.fortune,
      mono: `Start Cash +${Math.round(st.monoMods.startCashPct * 100)}% • Rent Toll +${Math.round(st.monoMods.rentPct * 100)}% • Podium +${Math.min(200, Math.round(st.raw.fortune))}%`,
      moon: `+${sfMods.maxHpBonus} Max HP • +${(sfMods.hpRegenPerSec || 0.6).toFixed(1)} HP/s Passive Regen • +${Math.round((sfMods.healShieldMult - 1) * 100)}% Heal/Shield • +${Math.round((sfMods.gatherYieldMult - 1) * 100)}% Yield`,
      dash: `Podium/Track Gold ${st.dashMods.podiumGoldPct} • Jelly Magnet ${st.dashMods.magnetRadiusPct}`,
    },
    swiftness: {
      icon: '⚡',
      label: 'Swiftness',
      pts: pts.swiftness,
      mono: `START Lap Salary +${Math.round(st.monoMods.salaryPct * 100)}% • Tempo &amp; Sprint Boost`,
      moon: sfSwiftLine,
      dash: `Top Speed ${st.dashMods.topSpeedPct} • Boost Pad Recovery ${st.dashMods.accelPct}`,
    },
    power: {
      icon: '🔥',
      label: 'Power',
      pts: pts.power,
      mono: `Ultimate Skill &amp; Takeover Power +${Math.round(st.monoMods.ultPct * 100)}%`,
      moon: sfPowerLine,
      dash: `Fury Gauge ${st.dashMods.furyChargePct} • Stumble Resist ${st.dashMods.knockbackResistPct}`,
    },
    luck: {
      icon: '🍀',
      label: 'Luck',
      pts: pts.luck,
      mono: `Buy/Upgrade Discount -${Math.round(st.monoMods.discountPct * 100)}% • Casino &amp; Podium Chest Boost`,
      moon: sfLuckLine,
      dash: `Rare Item Box ${st.dashMods.rareBoxPct} • Miracle Shield ${st.dashMods.miracleShieldPct}`,
    },
  };

  const b = activeStat ? bridgeDetails[activeStat] : null;

  return `
    <div class="s2-stat-panel">
      <div class="s2-stat-grid">
        <div class="s2-stat-cell ${activeStat === 'fortune' ? 'is-active' : ''} ${topStatKey === 'fortune' ? 'is-top-stat' : ''}" data-stat-info="fortune" title="Tap to inspect Vitality bonuses across Monopoly, Sky Frontier &amp; Cloud Dash">
          <span class="s2-stat-ico">💖</span>
          <span class="s2-stat-name">Vitality</span>
          <b class="s2-stat-val">${pts.fortune} <small>pts</small></b>
        </div>
        <div class="s2-stat-cell ${activeStat === 'swiftness' ? 'is-active' : ''} ${topStatKey === 'swiftness' ? 'is-top-stat' : ''}" data-stat-info="swiftness" title="Tap to inspect Swiftness bonuses across Monopoly, Sky Frontier &amp; Cloud Dash">
          <span class="s2-stat-ico">⚡</span>
          <span class="s2-stat-name">Swiftness</span>
          <b class="s2-stat-val">${pts.swiftness} <small>pts</small></b>
        </div>
        <div class="s2-stat-cell ${activeStat === 'power' ? 'is-active' : ''} ${topStatKey === 'power' ? 'is-top-stat' : ''}" data-stat-info="power" title="Tap to inspect Power bonuses across Monopoly, Sky Frontier &amp; Cloud Dash">
          <span class="s2-stat-ico">🔥</span>
          <span class="s2-stat-name">Power</span>
          <b class="s2-stat-val">${pts.power} <small>pts</small></b>
        </div>
        <div class="s2-stat-cell ${activeStat === 'luck' ? 'is-active' : ''} ${topStatKey === 'luck' ? 'is-top-stat' : ''}" data-stat-info="luck" title="Tap to inspect Luck bonuses across Monopoly, Sky Frontier &amp; Cloud Dash">
          <span class="s2-stat-ico">🍀</span>
          <span class="s2-stat-name">Luck</span>
          <b class="s2-stat-val">${pts.luck} <small>pts</small></b>
        </div>
      </div>
      <div class="s2-dash-build-strip">
        <span class="s2-dash-build-main">☁️ ${String(dashBuild.icon || '').replace(/🪙/g, '<img class="s2-inline-ico" src="/assets/ui/icon_gold.png" alt="">')} <b>Dash Build: ${escapeHtml(dashBuild.name)}${tierStr}</b>${buildProgressTag ? ` <small class="s2-dash-build-share">(${escapeHtml(buildProgressTag)})</small>` : ''}</span>
        ${buildPerkOrTip ? `<span class="s2-dash-build-perk">${escapeHtml(buildPerkOrTip).replace(/🪙/g, '<img class="s2-inline-ico" src="/assets/ui/icon_gold.png" alt="">')}</span>` : ''}
      </div>
      <div class="s2-sf-mods-strip" style="display:grid;grid-template-columns:1fr;gap:3px;padding:7px 10px;background:rgba(20,108,148,0.10);border:1px solid rgba(20,108,148,0.32);border-radius:8px;margin-top:6px;font-size:11.5px;color:#3A281E;">
        <div style="font-weight:900;color:#146C94;margin-bottom:1px;">🏝️ Sky Frontier Mods</div>
        <div><b>🔥 Power:</b> ${sfPowerLine}</div>
        <div><b>⚡ Swiftness:</b> ${sfSwiftLine}</div>
        <div><b>💖 Vitality:</b> ${sfVitLine}</div>
        <div><b>🍀 Luck:</b> ${sfLuckLine}</div>
      </div>
      ${b ? `
        <div class="s2-stat-bridge-box" data-active-stat="${activeStat}">
          <div class="s2-stat-bridge-head">
            <span class="s2-stat-bridge-title">${b.icon} <b>${b.label}</b> <small>(${b.pts} pts)</small> — 3-Mode Active Bonuses</span>
            <span class="s2-stat-bridge-hint">Tap to hide ▴</span>
          </div>
          <div class="s2-stat-bridge-rows">
            <div class="s2-stat-bridge-row"><span class="s2-mode-tag">🎲 Monopoly</span><span>${b.mono}</span></div>
            <div class="s2-stat-bridge-row"><span class="s2-mode-tag">🏝️ Sky Frontier</span><span>${b.moon}</span></div>
            <div class="s2-stat-bridge-row"><span class="s2-mode-tag">☁️ Cloud Dash</span><span>${b.dash}</span></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Renders a single Paper-Doll Equipment Slot Square (used in Left 3 / Right 3 columns of Screen 07).
 * Matches Mockup 07 1:1: compact 2-line caption above a 64x64 golden filigree box with +Refine top-left,
 * item icon centered (with hair layer for outfits), and stars + eye visibility toggle along the bottom.
 */
function renderPaperDollSlotSquare(slot, equippedSlot, isSelected, lineage, hasRedDot = false, appearance = null, wardrobeMode = 'stats', profile = null) {
  const statItemId = equippedSlot?.id || null;
  const glamItemId = profile?.glamour?.[slot] || equippedSlot?.glamour || null;
  const hasGlamour = Boolean(glamItemId && glamItemId !== statItemId);
  const isGlamourMode = wardrobeMode === 'glamour';
  const itemId = isGlamourMode ? (glamItemId || statItemId) : statItemId;
  const refine = equippedSlot?.refine | 0;
  const isHidden = Boolean(equippedSlot?.hide);
  const def = itemId ? itemDef(itemId) : null;
  const vis = itemId ? resolveItemVisual(itemId, lineage) : null;
  const rarity = def?.rarity || (itemId ? 1 : 0);
  const effRarity = rarity === 'super_mythic' ? 3 : rarity;
  const stars = effRarity ? '★'.repeat(effRarity) : '—';
  const filterStyle = vis?.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
  const rawName = def ? def.name : '(Empty)';
  const shortName = shortenGearName(rawName);
  const invEntry = itemId ? profile?.inventory?.[itemId] : null;
  const eqEntry = (itemId && equippedSlot?.id === itemId) ? equippedSlot : null;
  const rawStats = def ? (invEntry?.rolledStats || eqEntry?.rolledStats || def.stats || (effRarity === 3 ? { all: 24 } : { all: 8 })) : null;
  const statTip = def ? formatStatsSummary(rawStats, effRarity, refine) : '';
  const roleInfo = SLOT_ROLE_GUIDE[slot];
  const glamourName = hasGlamour ? (itemDef(glamItemId)?.name || glamItemId) : null;
  const attStatKey = equippedSlot?.attune?.stat;
  const attuneStr = attStatKey ? ` | 🎯 Attuned: ${STAT_PILL_META[attStatKey]?.label || attStatKey}` : '';
  const gradeKey = invEntry?.forgeGrade || eqEntry?.forgeGrade || null;
  const gradeStr = gradeKey && FORGE_GRADE_META[gradeKey] ? ` ${FORGE_GRADE_META[gradeKey].pill}` : (def?.bossCraft ? ' [⚒️ Boss Craft]' : '');
  const classStr = (slot === 'gloves' && itemId) ? ` | ${(WEAPON_CLASS_META[resolveWeaponClass(itemId)] || WEAPON_CLASS_META.melee).badge}` : '';
  const ult = def?.ultimate || equippedSlot?.ultimate;
  const ultStr = ult ? ` | ⚡ Ultimate: ${ult.name} (${ult.cooldownSec}s) — ${ult.desc}` : '';
  const fullTooltip = def
    ? (isGlamourMode
        ? `👗 Look: ${rawName}${classStr}${hasGlamour ? ' (Custom Glamour)' : ' (Same as Stat Gear)'}`
        : `${rawName}${gradeStr} (+${refine})${classStr}${statTip ? ` — ${statTip}` : ''}${attuneStr}${ultStr}${hasGlamour ? ` | 👗 Look: ${glamourName}` : ''}${roleInfo ? ` | ${roleInfo.badge}` : ''}`)
    : `${SLOT_LABELS[slot]} (Empty)${roleInfo ? ` — ${roleInfo.text}` : ''}`;
  const slotThumbHtml = itemId
    ? (slot === 'outfit'
        ? renderOutfitThumbLayers(itemId, { lineage, appearance, url: vis.url, filter: vis.filter, alt: vis.name })
        : `<img class="s2-pd-thumb" src="${vis.url}" alt="${escapeHtml(vis.name)}" style="${filterStyle}" />`)
    : `<span class="s2-pd-empty">+</span>`;

  return `
    <div class="rpg-slot-card s2-pd-slot s2-pd-slot-v2 rpg-rarity-${effRarity} ${isSelected ? 'selected' : ''} ${isHidden ? 'slot-hidden' : ''} ${isGlamourMode ? 'is-glamour-mode-slot' : ''} ${hasGlamour ? 'has-glamour-look' : ''}" data-slot="${slot}" title="${escapeHtml(fullTooltip)}">
      <div class="s2-pd-slot-caption" title="${escapeHtml(fullTooltip)}">
        <span class="rpg-slot-label">${SLOT_SHORT_LABELS[slot] || SLOT_LABELS[slot]}</span>
        <span class="rpg-slot-name">${escapeHtml(shortName)}</span>
      </div>
      <div class="s2-pd-slot-box">
        ${isGlamourMode
          ? (itemId ? `<span class="rpg-slot-refine is-glam-pill">${hasGlamour ? '👗 LOOK' : '⚔️=👗'}</span>` : '')
          : (itemId ? `<span class="rpg-slot-refine">+${refine}</span>` : '')}
        ${isGlamourMode && hasGlamour ? `
          <button type="button" class="rpg-slot-glam-reset" data-glamour-clear="${slot}" title="Reset ${SLOT_LABELS[slot]} to Stat Gear look">✕</button>
        ` : (!isGlamourMode && hasGlamour ? `
          <span class="rpg-slot-glamour" title="Custom Costume Look Active: ${escapeHtml(glamourName)}">👗</span>
        ` : '')}
        <div class="s2-pd-thumb-wrap ${slot === 'outfit' ? 'is-outfit' : ''}">
          ${slotThumbHtml}
        </div>
        <div class="rpg-slot-actions s2-pd-slot-foot">
          <span class="rpg-stars">${stars}</span>
          ${itemId ? `
            <button type="button" class="rpg-eye-btn ${isHidden ? 'is-hidden' : ''}" data-hide="${slot}" data-toggle-hide="${slot}" title="${isHidden ? 'Hidden (Tap to show)' : 'Visible (Tap to hide)'}">
              ${isHidden ? '🙈' : '👁️'}
            </button>
          ` : `
            <button type="button" class="rpg-eye-btn disabled" disabled title="Empty slot">👁️</button>
          `}
        </div>
      </div>
    </div>
  `;
}

// Persistent stage pose state (view rotation + idle/walk preview toggle)
const STAGE_VIEWS = ['front', 'side', 'back'];
const liveStageState = {
  view: 'front',
  walking: false,
};

export function cyclePaperDollView() {
  const idx = STAGE_VIEWS.indexOf(liveStageState.view);
  liveStageState.view = STAGE_VIEWS[(idx + 1) % STAGE_VIEWS.length];
  return liveStageState.view;
}

export function togglePaperDollWalk() {
  liveStageState.walking = !liveStageState.walking;
  return liveStageState.walking;
}

export function getPaperDollStageState() {
  return liveStageState;
}

/**
 * Renders the mathematical bone-aligned DOM rig layers (shared 1:1 with ChibiRig via computePaperDollParts).
 * Acts as the instant 0ms underlayer and non-WebGL fallback.
 */
export function renderPaperDollDomLayers(lineage, equipped, view = 'front', appearance = null) {
  const isGirl = appearance?.body === 'girl' || (!appearance?.body && (lineage === 'dxb' || lineage === 'girl'));
  const effLineage = appearance?.body === 'girl'
    ? (lineage === 'dxb' ? 'dxb' : 'girl')
    : appearance?.body === 'boy'
      ? (lineage === 'bkk' ? 'bkk' : 'boy')
      : lineage;
  const hairId = appearance?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  const hairColor = appearance?.hairColor || (isGirl ? 'coral' : lineage === 'bkk' ? 'silver' : 'chestnut');
  const pd = computePaperDollParts({
    lineage: effLineage,
    equipped,
    hair: hairId,
    hairColor,
    view,
    right: true,
    getSpriteInfo: spriteInfo,
  });

  const wingsHtml = pd.wings
    ? (pd.wings.socket === 'hip' || pd.wings.socket === 'shoulders')
      ? `
      <img class="s2-pd-bone-acc s2-pd-acc-tail ${pd.wings.inFrontOfBody ? 'in-front' : 'behind'}"
           src="${pd.wings.url}"
           style="left:calc(50% + ${pd.wings.cxPct.toFixed(2)}%);bottom:${pd.wings.cyPct.toFixed(2)}%;width:${pd.wings.wPct.toFixed(2)}%;height:${pd.wings.hPct.toFixed(2)}%;z-index:${pd.wings.inFrontOfBody ? 15 : 2};transform:translate(-50%, 50%) scaleX(${pd.wings.scaleX});"
           alt="" />
      `
      : `
      <div class="s2-pd-wings-pivot ${pd.wings.inFrontOfBody ? 'in-front' : 'behind'}"
           style="left:calc(50% + ${pd.wings.cxPct.toFixed(2)}%);bottom:${pd.wings.cyPct.toFixed(2)}%;width:${pd.wings.wPct.toFixed(2)}%;height:${pd.wings.hPct.toFixed(2)}%;">
        <div class="s2-pd-wing-half is-left">
          <img src="${pd.wings.url}" alt="" />
        </div>
        <div class="s2-pd-wing-half is-right">
          <img src="${pd.wings.url}" alt="" />
        </div>
      </div>
    `
    : '';

  const bodyFilter = pd.body.filter && pd.body.filter !== 'none' ? `filter:${pd.body.filter};` : '';
  const bodyMaskClass = pd.body.maskFeet === 2 ? 's2-mask-feet-long' : pd.body.maskFeet === 1 ? 's2-mask-feet-short' : '';
  const bodyHtml = `
    <img class="s2-pd-bone-body ${bodyMaskClass}"
         src="${pd.body.url}"
         style="width:${pd.body.wPct.toFixed(2)}%;height:100%;transform:translateX(-50%) scaleX(${pd.body.scaleX});${bodyFilter}"
         alt="" />
  `;

  const hairBehindHtml = pd.hair && view !== 'back'
    ? `
      <img class="s2-pd-bone-acc s2-pd-acc-hair is-behind"
           src="${pd.hair.url}"
           style="left:calc(50% + ${pd.hair.cxPct.toFixed(2)}%);bottom:${pd.hair.cyPct.toFixed(2)}%;width:${pd.hair.wPct.toFixed(2)}%;height:${pd.hair.hPct.toFixed(2)}%;z-index:4;transform:translate(-50%, 50%) scaleX(${pd.hair.scaleX});${pd.hair.behindClipPolygon && pd.hair.behindClipPolygon !== 'none' ? `clip-path:${pd.hair.behindClipPolygon};` : ''}"
           alt="" />
    `
    : '';

  const hairHtml = pd.hair
    ? `
      <img class="s2-pd-bone-acc s2-pd-acc-hair is-front"
           src="${pd.hair.url}"
           style="left:calc(50% + ${pd.hair.cxPct.toFixed(2)}%);bottom:${pd.hair.cyPct.toFixed(2)}%;width:${pd.hair.wPct.toFixed(2)}%;height:${pd.hair.hPct.toFixed(2)}%;z-index:${pd.hair.zIndex};transform:translate(-50%, 50%) scaleX(${pd.hair.scaleX});${pd.hair.frontClipPolygon ? `clip-path:${pd.hair.frontClipPolygon};` : ''}"
           alt="" />
    `
    : '';

  const itemsHtml = pd.items
    .map(
      (it) => `
      <img class="s2-pd-bone-acc s2-pd-acc-${it.slot} ${it.clipLongBoot ? 's2-clip-long-boot' : ''}"
           src="${it.url}"
           style="left:calc(50% + ${it.cxPct.toFixed(2)}%);bottom:${it.cyPct.toFixed(2)}%;width:${it.wPct.toFixed(2)}%;height:${it.hPct.toFixed(2)}%;z-index:${it.zIndex};transform:translate(-50%, 50%) scaleX(${it.scaleX}) rotate(${it.rotDeg}deg);"
           alt="" />
    `,
    )
    .join('');

  return `
    <div class="s2-pd-rig-box ${liveStageState.walking ? 'is-walking' : 'is-idle'}">
      <div class="s2-pd-dom-rig">
        ${wingsHtml}
        ${hairBehindHtml}
        ${bodyHtml}
        ${hairHtml}
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Renders the Screen 07 Central Paper-Doll Hero Stage:
 * Gold Ribbon Title Header + 3 Status Pills + Left 3 Slots + Center Live Animated ChibiRig Stage + Right 3 Slots.
 */
export function renderPaperDollHeroStage(profile, selectedSlot = 'outfit', petPoseOverride = null, wardrobeMode = 'stats') {
  const lineage = profile?.lineage === 'dxb' ? 'dxb' : 'bkk';
  const eq = profile?.equipped || {};
  const app = profile?.appearance || {};
  const curHairDef = HAIRSTYLES[app.hair] || HAIRSTYLES[lineage === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy'];
  const isCelestialHair = curHairDef?.tier === 'celestial';
  const isGlamourMode = wardrobeMode === 'glamour';
  const isHairMode = wardrobeMode === 'hair';
  const isStatsMode = !isGlamourMode && !isHairMode;
  const activeGlamCount = SLOTS.filter((s) => {
    const gId = profile?.glamour?.[s] || eq[s]?.glamour;
    return Boolean(gId && gId !== eq[s]?.id);
  }).length;

  // Highest refine for aura glow
  const maxRefine = Math.max(0, ...SLOTS.map((s) => eq[s]?.refine | 0));
  const hasAura = maxRefine >= 7 || isCelestialHair;

  // Companion pet preview with locomotion-matched animation, evolution tier scaling & active pose rotation
  const eqPet = eq.pet;
  const ownedEqPet = eqPet?.id && Array.isArray(profile?.pets)
    ? profile.pets.find((x) => x && (x.uid === eqPet.uid || x.id === eqPet.id))
    : null;
  const petBondLv = Math.max(1, Number(ownedEqPet?.bond_lv || eqPet?.bond_lv || ownedEqPet?.level || eqPet?.level) || 1);
  const activePoses = normalizeActivePoses(ownedEqPet?.active_poses || eqPet?.active_poses, petBondLv);
  const rawPetPose = (petPoseOverride && activePoses.includes(petPoseOverride))
    ? petPoseOverride
    : (activePoses[0] || 'front');
  const stagePetPose = rawPetPose === 'flip' ? 'happy' : rawPetPose;
  const petStars = Math.max(1, Math.min(3, Number(eqPet?.stars) || 1));
  const petVTier = Math.max(1, Math.min(petStars, Number(eqPet?.visual_tier) || petStars));
  const petVis = eqPet?.id ? resolveItemVisual(eqPet.id, lineage) : null;
  if (petVis && eqPet?.id && PETS[eqPet.id]) {
    const tierSpr = resolvePetSpriteKey(eqPet.id, petVTier, stagePetPose);
    if (spriteInfo(tierSpr)) {
      petVis.url = `/assets/pets/${tierSpr}.png`;
      petVis.filter = 'none';
    }
  }
  const petLoco = eqPet?.id ? petLocomotion(eqPet.id) : 'HOP_WADDLE';
  const petUiScale = eqPet?.id ? resolvePetUiScale(eqPet.id, petStars, petVTier, stagePetPose) : 1.0;

  const isForgeReady = forgeReady(profile);

  const leftSlots = ['outfit', 'gloves', 'boots']
    .map((s) => renderPaperDollSlotSquare(s, eq[s], selectedSlot === s, lineage, isForgeReady, profile?.appearance, wardrobeMode, profile))
    .join('');

  const rightSlots = ['hat', 'face', 'wings']
    .map((s) => renderPaperDollSlotSquare(s, eq[s], selectedSlot === s, lineage, isForgeReady, profile?.appearance, wardrobeMode, profile))
    .join('');

  const titleText = profile?.title || (maxRefine >= 10 ? '+10 Sovereign' : 'Sky Sovereign');
  const cp = Number(profile?.cp || recalcPlayerCP(profile) || 0).toLocaleString('en-US');
  const playerName = profile?.username || profile?.id || 'Adventurer';

  return `
    <div class="s2-avatar-card-header">
      <div class="s2-gold-ribbon-banner ${isCelestialHair ? 'is-celestial-nameplate' : ''}">
        <span class="s2-ribbon-crown">👑</span>
        <b class="s2-ribbon-name">${escapeHtml(playerName)} Lv.${profile?.level || 1}</b>
      </div>
      <div class="s2-avatar-status-pills">
        <span class="s2-status-pill gold">⭐ ${escapeHtml(titleText)}</span>
        <span class="s2-status-pill pink">💞 ${profile?.partner_id ? `Bound with ${escapeHtml(profile.partner_id)}` : 'Bound Partner'}</span>
        <span class="s2-status-pill cp">⚔️ CP <b id="rpg-cp">${cp}</b></span>
      </div>
    </div>

    <div class="s2-pd-big-subtabs is-three-tabs" role="tablist" aria-label="Switch between Gear Stats, Costume Look, and Hair Salon">
      <button type="button" class="s2-pd-big-tab is-stats ${isStatsMode ? 'active' : ''}" data-wardrobe-mode="stats">
        <span class="s2-pd-big-tab-ico">⚔️</span>
        <span class="s2-pd-big-tab-txt">
          <b>GEAR STATS</b>
          <small>Power &amp; ULT</small>
        </span>
      </button>
      <button type="button" class="s2-pd-big-tab is-glamour ${isGlamourMode ? 'active' : ''}" data-wardrobe-mode="glamour">
        <span class="s2-pd-big-tab-ico">👗</span>
        <span class="s2-pd-big-tab-txt">
          <b>COSTUME</b>
          <small>Glamour${activeGlamCount > 0 ? ` (${activeGlamCount}/6)` : ' Look'}</small>
        </span>
      </button>
      <button type="button" class="s2-pd-big-tab is-hair ${isHairMode ? 'active' : ''}" data-wardrobe-mode="hair">
        <span class="s2-pd-big-tab-ico">💇</span>
        <span class="s2-pd-big-tab-txt">
          <b>HAIR SALON</b>
          <small>Cut &amp; Dye</small>
        </span>
      </button>
    </div>

    ${isHairMode ? '' : `
    <div class="s2-wardrobe-stage ${isGlamourMode ? 'is-glamour-stage' : 'is-stats-stage'}">
      <div class="s2-pd-col s2-pd-left">
        ${leftSlots}
      </div>

      <div class="s2-pd-center">
        <div class="s2-pd-figure" id="pd-hero-figure">
          <div class="s2-pd-stage-ctrls">
            <button type="button" class="s2-pd-ctrl-btn" data-pd-turn="1" title="Rotate Character View">
              🔄 ${liveStageState.view.toUpperCase()}
            </button>
            <button type="button" class="s2-pd-ctrl-btn ${liveStageState.walking ? 'active' : ''}" data-pd-walk="1" title="Toggle Walk / Idle Motion">
              ${liveStageState.walking ? '🏃 Walk' : '🧍 Idle'}
            </button>
            <button type="button" class="s2-pd-ctrl-btn" data-pd-photo="1" title="Open Polaroid Photobooth Studio">
              📸 Photo
            </button>
          </div>

          <img class="s2-pd-aura ${hasAura ? 'is-bright' : ''}" src="/assets/ui/fx_magic_circle.png" alt="" />
          <img class="s2-pd-pedestal" src="/assets/ui/stage_wardrobe_pedestal.png" alt="" />

          ${renderPaperDollDomLayers(lineage, eq, liveStageState.view, profile?.appearance)}

          <div class="s2-pd-webgl-host" id="pd-live-canvas-wrap"></div>

          ${petVis ? `
            <div class="s2-pd-pet-wrap s2-loco-${petLoco} s2-pd-pet-tier-${petVTier}" title="Equipped Companion Pet (★${petStars})">
              <img class="s2-pd-pet ${petVTier >= 3 ? 'pet-v2-shimmer' : ''} ${rawPetPose === 'flip' ? 'pet-v2-flip-spin' : ''}" src="${petVis.url}" style="--pet-ui-scale:${petUiScale};${petVis.filter !== 'none' ? `filter:${petVis.filter};` : ''}" alt="" />
            </div>
          ` : ''}
        </div>
      </div>

      <div class="s2-pd-col s2-pd-right">
        ${rightSlots}
      </div>
    </div>
    `}
  `;
}

// ---------------------------------------------------------------------------
// Live Singleton WebGL ChibiRig Stage (reuses client/js/chibi_rig.js 100%)
// ---------------------------------------------------------------------------
let stageGL = null; // { renderer, scene, cam, rig, lineage, rafId, lastTs, token }

function ensureStageGL() {
  if (stageGL) return stageGL;
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(160, 160);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 's2-pd-webgl-canvas';

    const scene = new THREE.Scene();
    // Frustum: y from -0.15m (below boots) to +1.90m (above tall bunny ears); height = 2.05m -> 1.55m = 121px
    const cam = new THREE.OrthographicCamera(-1.025, 1.025, 1.90, -0.15, 0.1, 20);
    cam.position.set(0, 0, 5);

    stageGL = {
      renderer,
      scene,
      cam,
      rig: null,
      lineage: null,
      rafId: 0,
      lastTs: 0,
      token: 0,
      manifestPromise: spriteInfo('bkk_base_front') ? Promise.resolve() : loadManifest(renderer),
    };
    return stageGL;
  } catch {
    return null;
  }
}

/**
 * Mounts and animates the real in-game ChibiRig inside #pd-live-canvas-wrap.
 * Always cancels any previous RAF closure first so detached DOM nodes are never retained.
 */
export async function mountLivePaperDollStage(rootEl, profile) {
  stopWardrobePreview();
  const host = rootEl?.querySelector?.('#pd-live-canvas-wrap');
  const fig = rootEl?.querySelector?.('#pd-hero-figure');
  if (!host || !fig || !profile) return;

  const gl = ensureStageGL();
  if (!gl) return;

  const myToken = ++gl.token;
  if (gl.renderer.domElement.parentElement !== host) {
    host.innerHTML = '';
    host.appendChild(gl.renderer.domElement);
  }

  await gl.manifestPromise;
  if (myToken !== gl.token) return;

  const lineage = profile.lineage === 'dxb' ? 'dxb' : 'bkk';
  if (!gl.rig || gl.lineage !== lineage) {
    if (gl.rig) {
      gl.scene.remove(gl.rig.ROOT);
      gl.rig.dispose();
    }
    gl.rig = new ChibiRig({ lineage, appearance: profile.appearance, name: '', sub: '', wings: null });
    gl.rig._isStagePreview = true;
    gl.rig.shadow.visible = false;
    gl.rig.nameTag.visible = false;
    gl.scene.add(gl.rig.ROOT);
    gl.lineage = lineage;
  }
  gl.rig._isStagePreview = true;

  const isCharmStage = fig.classList.contains('s2-charm-stage-fig') || Boolean(profile.equipped?.charm);
  if (isCharmStage) {
    gl.renderer.setSize(196, 184);
    gl.cam.left = -1.24;
    gl.cam.right = 1.24;
    gl.cam.top = 2.04;
    gl.cam.bottom = -0.22;
    gl.cam.updateProjectionMatrix();
  } else {
    gl.renderer.setSize(160, 160);
    gl.cam.left = -1.025;
    gl.cam.right = 1.025;
    gl.cam.top = 1.90;
    gl.cam.bottom = -0.15;
    gl.cam.updateProjectionMatrix();
  }

  await gl.rig.ready;
  if (myToken !== gl.token) return;

  await gl.rig.setAppearance(profile.appearance || {
    body: lineage === 'dxb' ? 'girl' : 'boy',
    hair: lineage === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy',
    hairColor: lineage === 'dxb' ? 'coral' : 'silver',
  });
  if (myToken !== gl.token) return;

  await gl.rig.setEquipment(profile.equipped || {});
  if (myToken !== gl.token) return;

  const stepRig = (dt) => {
    if (!gl.rig) return;
    const walking = liveStageState.walking;
    const view = liveStageState.view;
    const vz = view === 'back' ? -1.0 : 0.4;
    const vx = walking ? 2.2 : 0;
    gl.rig.update(
      dt,
      {
        vx,
        vz: walking ? vz : 0,
        walkWeight: walking ? 0.85 : 0,
      },
      null,
    );
    if (gl.rig.shownView !== view || !gl.rig.shownRight) {
      gl.rig.applyView(view, true);
      gl.rig.syncBones();
    }
    gl.renderer.render(gl.scene, gl.cam);
  };

  stepRig(0.016);
  fig.classList.add('is-webgl-live');

  if (gl.rafId) {
    cancelAnimationFrame(gl.rafId);
    gl.rafId = 0;
  }
  gl.lastTs = performance.now();
  const tick = (now) => {
    const canvas = gl.renderer.domElement;
    if (myToken !== gl.token || !canvas.isConnected || !canvas.offsetParent || canvas.closest('[hidden]')) {
      gl.rafId = 0;
      return;
    }
    const elapsed = (now - gl.lastTs) / 1000;
    // Cap idle preview at ~30fps on mobile to save battery & GPU while keeping walk smooth
    if (!liveStageState.walking && elapsed < 0.032) {
      gl.rafId = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, elapsed));
    gl.lastTs = now;
    stepRig(dt);
    gl.rafId = requestAnimationFrame(tick);
  };
  gl.rafId = requestAnimationFrame(tick);
}

export function stopWardrobePreview() {
  if (stageGL) {
    stageGL.token++;
    if (stageGL.rafId) {
      cancelAnimationFrame(stageGL.rafId);
      stageGL.rafId = 0;
    }
  }
}

/**
 * Renders the 10-Star Blacksmith Star-Force Arc (Screen 20).
 */
export function renderStarForceArc(refine, max = 10, justForgedStar = 0) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const state = i <= refine ? 'filled' : i === refine + 1 ? 'target' : 'empty';
    const popCls = justForgedStar === i ? 'just-forged' : '';
    const arcY = Math.round(Math.pow(i - 5.5, 2) * 1.1); // subtle upward arch
    stars.push(`<span class="s2-sf-star ${state} ${popCls}" style="--arc-y:${arcY}px;transform:translateY(${arcY}px);">★</span>`);
  }
  return `<div class="s2-sf-arc">${stars.join('')}</div>`;
}

