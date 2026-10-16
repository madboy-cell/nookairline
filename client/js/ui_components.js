// client/js/ui_components.js — Reusable Style 2 (Tree of Savior × Cookie Run: Kingdom)
// Data-Driven UI Component Primitives for NEORA WORLD V2 (Steps 3, 4, and 5).
// Zero hardcoded per-item HTML: resolves all sprites, rarities, stats, and paper-doll layers
// automatically from shared catalogs and client/assets/asset_manifest.json.

import * as THREE from 'three';
import { ACCESSORIES, DICE_SKINS, PETS, PET_FAMILIES, petLocomotion } from '/shared/catalog_gear_pets.js';
import { resolvePetSpriteKey, resolvePetUiScale } from '/shared/pet_catalog.js';
import { computePetPassives } from '/shared/pet_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { WONDERS, DECOR, CORE, BLUEPRINT_CARDS } from '/shared/catalog_landmarks.js';
import { SLOTS, slotCP, recalcPlayerCP } from '/shared/progression.js';
import { itemDef, itemSlot, FEATURED_OUTFIT, MYTHIC_DICE, petPassivePct, forgeReady } from '/shared/rpg_rules.js';
import { computePaperDollParts, OUTFIT_FALLBACK } from '/shared/accessory_attach.js';
import { HAIRSTYLES, HAIR_COLORS, hairSpriteName } from '/shared/hair_catalog.js';
import { loadManifest, spriteInfo } from './assets.js';
import { ChibiRig } from './chibi_rig.js';

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
  gloves: 'Gloves',
  boots: 'Boots',
  wings: 'Wings',
  dice: '3D Dice',
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
};

function formatStatsSummary(stats) {
  if (!stats) return '';
  if (stats.all) return `+${stats.all} All Stats`;
  return Object.entries(stats)
    .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
    .join(' • ');
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
    const st = formatStatsSummary(d?.stats);
    sub = d ? `★3 Mythic 3D Dice${st ? ` (${st})` : ''}` : 'Any ★3 Mythic 3D Dice Skin';
  } else if (offer.pick === 'accessory') {
    const acc = curPick && (ACCESSORIES[curPick] || DICE_SKINS[curPick]);
    if (acc) {
      rarity = acc.rarity || rarity;
      const st = formatStatsSummary(acc.stats);
      sub = `${SLOT_LABELS[acc.slot] || acc.slot}${st ? ` (${st})` : ''}`;
    } else {
      sub = BAG_ITEM_CATALOG.dupe_box?.desc || 'Select Accessory for +1 Dupe';
    }
  } else if (offer.item && itemDef(offer.item)) {
    const def = itemDef(offer.item);
    const slot = itemSlot(offer.item);
    const st = formatStatsSummary(def.stats);
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
export function renderIconThumb(id, {
  lineage = 'bkk',
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
  return `
    <div class="s2-thumb s2-rarity-${r} ${round ? 'is-round' : ''} ${extraClass}"${sizeStyle}>
      <img class="s2-thumb-img" src="${vis.url}" alt="${escapeHtml(vis.name)}" style="${filterStyle}" loading="lazy" />
      ${vis.badgeUrl ? `<img class="s2-thumb-corner" src="${vis.badgeUrl}" alt="" />` : ''}
      ${refine != null && refine > 0 ? `<span class="s2-thumb-refine">+${refine}</span>` : ''}
      ${badgeText ? `<span class="s2-thumb-badge">${escapeHtml(badgeText)}</span>` : ''}
    </div>
  `;
}

/**
 * Computes the 4 core RPG stats (Fortune, Swiftness, Power, Luck) dynamically from profile state.
 */
export function computePlayerStats(profile) {
  const lv = Math.max(1, profile?.level | 0);
  const stats = {
    fortune: 20 + lv * 4,
    swiftness: 15 + lv * 3,
    power: 25 + lv * 5,
    luck: 15 + lv * 3,
  };

  const eq = profile?.equipped || {};
  for (const s of SLOTS) {
    const id = eq[s]?.id;
    if (!id) continue;
    const def = itemDef(id);
    if (!def) continue;
    const mult = 1 + 0.15 * Math.max(0, eq[s]?.refine | 0);
    const st = def.stats || (def.rarity === 3 ? { all: 24 } : { all: 8 });
    if (st.all) {
      const v = Math.round(st.all * mult);
      stats.fortune += v;
      stats.swiftness += v;
      stats.power += v;
      stats.luck += v;
    }
    if (st.fortune) stats.fortune += Math.round(st.fortune * mult);
    if (st.swiftness) stats.swiftness += Math.round(st.swiftness * mult);
    if (st.power) stats.power += Math.round(st.power * mult);
    if (st.luck) stats.luck += Math.round(st.luck * mult);
  }

  // Pet passive contribution (V2 random stat slots + family passive)
  const eqPet = eq.pet;
  if (eqPet?.id && PETS[eqPet.id]) {
    const fam = PET_FAMILIES[PETS[eqPet.id].family];
    const pct = petPassivePct(eqPet.id, eqPet.stars || PETS[eqPet.id].rarity, eqPet.level || 1, 100);
    const bonus = Math.round(pct * 2.5);
    if (fam?.passive === 'fortune' || fam?.passive === 'idle_tycoon') stats.fortune += bonus;
    else if (fam?.passive === 'swiftness') stats.swiftness += bonus;
    else if (fam?.passive === 'power' || fam?.passive === 'guardian') stats.power += bonus;
    else stats.luck += bonus;

    const petObj = profile?.pets?.[eqPet.id] || eqPet;
    if (Array.isArray(petObj.slots)) {
      const pPassives = computePetPassives(petObj);
      stats.fortune += Math.round((pPassives.fortune || 0) * 4);
      stats.swiftness += Math.round((pPassives.swiftness || 0) * 6);
      stats.power += Math.round((pPassives.power || 0) * 5);
      stats.luck += Math.round((pPassives.luck || 0) * 6);
    }
  }

  return {
    fortunePct: +(stats.fortune * 0.25).toFixed(1),
    swiftnessPct: +(stats.swiftness * 0.15).toFixed(1),
    powerMult: +(1 + stats.power * 0.008).toFixed(2),
    luckPct: +(stats.luck * 0.12).toFixed(1),
    raw: stats,
  };
}

/**
 * Renders the 2x2 Style-2 Character Stat Breakdown Card (Screen 07).
 */
export function renderStatGrid(profile) {
  const st = computePlayerStats(profile);
  const cp = Number(profile?.cp || recalcPlayerCP(profile) || 0).toLocaleString('en-US');
  return `
    <div class="s2-stat-panel">
      <div class="s2-stat-header">
        <span>⚔️ CHARACTER STATS &amp; POWER</span>
        <span class="s2-cp-pill">CP <b id="rpg-cp">${cp}</b></span>
      </div>
      <div class="s2-stat-grid">
        <div class="s2-stat-cell">
          <img src="/assets/ui/icon_gold.png" alt="" />
          <div>
            <div class="s2-stat-name">Fortune</div>
            <div class="s2-stat-val">+${st.fortunePct}% <small>Yield</small></div>
          </div>
        </div>
        <div class="s2-stat-cell">
          <img src="/assets/ui/fx_feather.png" alt="" />
          <div>
            <div class="s2-stat-name">Swiftness</div>
            <div class="s2-stat-val">+${st.swiftnessPct}% <small>Speed</small></div>
          </div>
        </div>
        <div class="s2-stat-cell">
          <img src="/assets/ui/fx_lightning.png" alt="" />
          <div>
            <div class="s2-stat-name">Power</div>
            <div class="s2-stat-val">${st.powerMult}x <small>Board</small></div>
          </div>
        </div>
        <div class="s2-stat-cell">
          <img src="/assets/ui/fx_star.png" alt="" />
          <div>
            <div class="s2-stat-name">Luck</div>
            <div class="s2-stat-val">+${st.luckPct}% <small>Crit/Drop</small></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a single Paper-Doll Equipment Slot Square (used in Left 3 / Right 3 columns of Screen 07).
 * Preserves [data-slot], [data-hide], and [data-goforge] hooks for automated QA.
 */
function renderPaperDollSlotSquare(slot, equippedSlot, isSelected, lineage, hasRedDot = false) {
  const itemId = equippedSlot?.id || null;
  const refine = equippedSlot?.refine | 0;
  const isHidden = Boolean(equippedSlot?.hide);
  const def = itemId ? itemDef(itemId) : null;
  const vis = itemId ? resolveItemVisual(itemId, lineage) : null;
  const rarity = def?.rarity || (itemId ? 1 : 0);
  const stars = rarity ? '★'.repeat(rarity) : '—';
  const filterStyle = vis?.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
  const forgeLabel = refine >= 10 ? '★MAX' : '🔨 Blacksmith +10';

  return `
    <div class="rpg-slot-card s2-pd-slot rpg-rarity-${rarity} ${isSelected ? 'selected' : ''} ${isHidden ? 'slot-hidden' : ''}" data-slot="${slot}">
      <div class="s2-pd-slot-top">
        <span class="rpg-slot-label">${SLOT_LABELS[slot]}</span>
        ${itemId ? `<span class="rpg-slot-refine">+${refine}</span>` : ''}
      </div>
      <div class="s2-pd-slot-Body">
        <div class="s2-pd-thumb-wrap">
          ${itemId ? `
            <img class="s2-pd-thumb" src="${vis.url}" alt="${escapeHtml(vis.name)}" style="${filterStyle}" />
          ` : `<span class="s2-pd-empty">+</span>`}
        </div>
        <div class="s2-pd-meta">
          <div class="rpg-slot-name">${escapeHtml(def ? def.name : '(Empty)')}</div>
          <div class="rpg-stars">${stars}</div>
        </div>
      </div>
      <div class="rpg-slot-actions">
        ${itemId ? `
          <button class="rpg-eye-btn ${isHidden ? 'is-hidden' : ''}" data-hide="${slot}" title="${isHidden ? 'Hidden (Tap to show)' : 'Visible (Tap to hide)'}">
            ${isHidden ? '🙈' : '👁️'}
          </button>
          <button class="rpg-goforge-btn" data-goforge="${itemId}" title="[🔨 Blacksmith +10]">${forgeLabel}${hasRedDot ? '<span class="rpg-red-dot"></span>' : ''}</button>
        ` : `
          <button class="rpg-eye-btn disabled" disabled title="Empty slot">👁️</button>
        `}
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
  const hairId = appearance?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  const hairColor = appearance?.hairColor || (lineage === 'dxb' ? 'coral' : lineage === 'bkk' ? 'silver' : 'chestnut');
  const pd = computePaperDollParts({
    lineage,
    equipped,
    hair: hairId,
    hairColor,
    view,
    right: true,
    getSpriteInfo: spriteInfo,
  });

  const wingsHtml = pd.wings
    ? pd.wings.socket === 'hip'
      ? `
      <img class="s2-pd-bone-acc s2-pd-acc-tail ${pd.wings.inFrontOfBody ? 'in-front' : 'behind'}"
           src="${pd.wings.url}"
           style="left:calc(50% + ${pd.wings.cxPct.toFixed(2)}%);bottom:${pd.wings.cyPct.toFixed(2)}%;width:${pd.wings.wPct.toFixed(2)}%;height:${pd.wings.hPct.toFixed(2)}%;z-index:${pd.wings.inFrontOfBody ? 16 : 2};transform:translate(-50%, 50%) scaleX(${pd.wings.scaleX});"
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

  const hairHtml = pd.hair
    ? `
      <img class="s2-pd-bone-acc s2-pd-acc-hair"
           src="${pd.hair.url}"
           style="left:calc(50% + ${pd.hair.cxPct.toFixed(2)}%);bottom:${pd.hair.cyPct.toFixed(2)}%;width:${pd.hair.wPct.toFixed(2)}%;height:${pd.hair.hPct.toFixed(2)}%;z-index:${pd.hair.zIndex};transform:translate(-50%, 50%) scaleX(${pd.hair.scaleX});"
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
        ${bodyHtml}
        ${hairHtml}
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Renders the Screen 07 Central Paper-Doll Hero Stage:
 * Left 3 Slots (Outfit, Gloves, Boots) + Center Live Animated ChibiRig Stage + Right 3 Slots (Hat, Face, Wings).
 */
export function renderPaperDollHeroStage(profile, selectedSlot = 'outfit') {
  const lineage = profile?.lineage === 'dxb' ? 'dxb' : 'bkk';
  const eq = profile?.equipped || {};
  const app = profile?.appearance || {};
  const curHairDef = HAIRSTYLES[app.hair] || HAIRSTYLES[lineage === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy'];
  const isCelestialHair = curHairDef?.tier === 'celestial';

  // Highest refine for aura glow
  const maxRefine = Math.max(0, ...SLOTS.map((s) => eq[s]?.refine | 0));
  const hasAura = maxRefine >= 7 || isCelestialHair;

  // Companion pet preview with locomotion-matched animation & evolution tier scaling
  const eqPet = eq.pet;
  const petStars = Math.max(1, Math.min(3, Number(eqPet?.stars) || 1));
  const petVTier = Math.max(1, Math.min(petStars, Number(eqPet?.visual_tier) || petStars));
  const petVis = eqPet?.id ? resolveItemVisual(eqPet.id, lineage) : null;
  if (petVis && eqPet?.id && PETS[eqPet.id]) {
    const tierSpr = resolvePetSpriteKey(eqPet.id, petVTier, 'front');
    if (spriteInfo(tierSpr)) {
      petVis.url = `/assets/pets/${tierSpr}.png`;
      petVis.filter = 'none';
    }
  }
  const petLoco = eqPet?.id ? petLocomotion(eqPet.id) : 'HOP_WADDLE';
  const petUiScale = eqPet?.id ? resolvePetUiScale(eqPet.id, petStars, petVTier, 'front') : 1.0;

  const isForgeReady = forgeReady(profile);

  const leftSlots = ['outfit', 'gloves', 'boots']
    .map((s) => renderPaperDollSlotSquare(s, eq[s], selectedSlot === s, lineage, isForgeReady))
    .join('');

  const rightSlots = ['hat', 'face', 'wings']
    .map((s) => renderPaperDollSlotSquare(s, eq[s], selectedSlot === s, lineage, isForgeReady))
    .join('');

  const titleText = profile?.title || (maxRefine >= 10 ? '★10 Sovereign' : 'Sky Sovereign');

  return `
    <div class="s2-wardrobe-stage">
      <div class="s2-pd-col s2-pd-left">
        ${leftSlots}
      </div>

      <div class="s2-pd-center">
        <div class="s2-pd-badges">
          <span class="s2-badge-gold">👑 ${escapeHtml(titleText)}</span>
          ${profile?.partner_id ? `<span class="s2-badge-pink">💕 Bound: ${escapeHtml(profile.partner_id)}</span>` : ''}
        </div>

        <div class="s2-pd-figure" id="pd-hero-figure">
          <div class="s2-pd-stage-ctrls">
            <button type="button" class="s2-pd-ctrl-btn" data-pd-turn="1" title="Rotate Character View">
              🔄 ${liveStageState.view.toUpperCase()}
            </button>
            <button type="button" class="s2-pd-ctrl-btn ${liveStageState.walking ? 'active' : ''}" data-pd-walk="1" title="Toggle Walk / Idle Motion">
              ${liveStageState.walking ? '🏃 Walk' : '🧍 Idle'}
            </button>
          </div>

          ${hasAura ? `<img class="s2-pd-aura" src="/assets/ui/fx_magic_circle.png" alt="" />` : ''}
          <img class="s2-pd-pedestal" src="/assets/ui/stage_wardrobe_pedestal.png" alt="" />

          ${renderPaperDollDomLayers(lineage, eq, liveStageState.view, profile?.appearance)}

          <div class="s2-pd-webgl-host" id="pd-live-canvas-wrap"></div>

          ${petVis ? `
            <div class="s2-pd-pet-wrap s2-loco-${petLoco} s2-pd-pet-tier-${petVTier}" title="Equipped Companion Pet (★${petStars})">
              <img class="s2-pd-pet ${petVTier >= 3 ? 'pet-v2-shimmer' : ''}" src="${petVis.url}" style="--pet-ui-scale:${petUiScale};${petVis.filter !== 'none' ? `filter:${petVis.filter};` : ''}" alt="" />
            </div>
          ` : ''}
        </div>

        <div class="s2-pd-nameplate ${isCelestialHair ? 'is-celestial-nameplate' : ''}">
          <b>${isCelestialHair ? '✨ ' : ''}${escapeHtml(profile?.username || profile?.id || 'Adventurer')}${isCelestialHair ? ' ✨' : ''}</b>
          <span>Lv.${profile?.level || 1}</span>
        </div>
      </div>

      <div class="s2-pd-col s2-pd-right">
        ${rightSlots}
      </div>
    </div>
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
    gl.rig.shadow.visible = false;
    gl.rig.nameTag.visible = false;
    gl.scene.add(gl.rig.ROOT);
    gl.lineage = lineage;
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
export function renderStarForceArc(refine, max = 10) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const state = i <= refine ? 'filled' : i === refine + 1 ? 'target' : 'empty';
    const arcY = Math.round(Math.pow(i - 5.5, 2) * 1.1); // subtle upward arch
    stars.push(`<span class="s2-sf-star ${state}" style="transform: translateY(${arcY}px);">★</span>`);
  }
  return `<div class="s2-sf-arc">${stars.join('')}</div>`;
}
