// client/js/gacha_forge_ui.js — Step 3 RPG client UI module for NEORA WORLD V2.
// Implements 4 views: Wardrobe (Screen 07/08), Gacha (Screens 21/22/23), Forge (Screen 20), Pets (Screen 16).
// Powered by client/js/ui_components.js for 100% data-driven sprite resolution & Style 2 layout.

import {
  MAX_REFINE, DUPE_SHARDS, itemDef, itemSlot, FORGE, forgeChance, scrollAllowed, forgeReady,
  FEATURED_OUTFIT, FEATURED_SHARE, BOX1, BOX1_BANNERS, DEFAULT_BANNER, BOX1_POOL, BOX2, BOX2_POOL,
  SHARD_OFFERS, SEASON_OUTFITS, MYTHIC_DICE, VIP_WONDERS, PET, petExpToNext, nextStarDupes, TRAITS, petPassivePct,
  normalizeActivePoses, minLevelForStars, starsForLevel,
  SUPER_MYTHIC, SUPER_MYTHIC_POOL, superMythicEnabled, box1DisplayRates, GIFT_PULL,
} from '/shared/rpg_rules.js';
import { getRunway, tierOf, SM_TIER } from './runway_reveal.js';

import { ACCESSORIES, DICE_SKINS, PETS, PET_FAMILIES } from '/shared/catalog_gear_pets.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { SEASON_SKILLS, skillFor } from '/shared/season_skills.js';
import { THEMES } from '/shared/monopoly_rules.js';
import { HAIRSTYLES, HAIR_COLORS, HAIR_TIERS, HAIR_DYE_TIERS, hairSpriteName } from '/shared/hair_catalog.js';
import { SLOTS, slotCP } from '/shared/progression.js';
import { WONDERS, DECOR, CORE, CORE_LANDMARKS, BLUEPRINT_CARDS } from '/shared/catalog_landmarks.js';

import {
  fmtNum, escapeHtml, SLOT_LABELS, BAG_ITEM_CATALOG, SHARD_OFFER_VISUALS, resolveShardOfferMeta,
  resolveItemVisual, shortenGearName, renderIconThumb, renderOutfitThumbLayers, renderStatGrid, renderPaperDollHeroStage, renderPaperDollDomLayers,
  getPaperDollStageState, renderStarForceArc,
  mountLivePaperDollStage, stopWardrobePreview, cyclePaperDollView, togglePaperDollWalk,
} from './ui_components.js';
import {
  normalizePetsList, formatPetStarProgressV2, renderPetSanctuary, bindPetSanctuaryClick,
} from './pet_sanctuary_ui.js';
import {
  PET_CATALOG_V2, resolvePetSpriteKey, resolvePetUiScale,
} from '/shared/pet_catalog.js';
import { spriteInfo } from './assets.js';

function formatPetStarProgress(pet) {
  return formatPetStarProgressV2(pet);
}

function renderCostumeSkillCard(costumeId, rarityOverride = null) {
  if (!costumeId || !OUTFITS[costumeId]) return '';
  const def = OUTFITS[costumeId];
  const sk = skillFor(costumeId, rarityOverride || def.rarity || 1);
  if (!sk) return '';
  const turfName = sk.homeTheme && THEMES[sk.homeTheme] ? THEMES[sk.homeTheme].name : null;
  return `
    <div class="rpg-costume-skill-banner">
      <div class="rpg-costume-skill-head">
        <span>${escapeHtml(sk.icon || '⚡')} Ultimate Skill: ${escapeHtml(sk.name)}</span>
        ${turfName ? `<span class="rpg-costume-skill-turf">🏠 Turf: ${escapeHtml(turfName)} (+15%)</span>` : ''}
      </div>
      <div class="rpg-costume-skill-desc">${escapeHtml(sk.desc || '')}</div>
    </div>
  `;
}

/**
 * Builds a single unified Gacha prize pool array ranked strictly from ★3 Mythic → ★2 Epic → ★1 Rare.
 * Lightweight & pure data computation (0 Canvas/WebGL allocation).
 */
export function buildGachaPrizePool(gtab, bannerId, profile = {}) {
  const lineage = profile?.lineage === 'dxb' ? 'dxb' : 'bkk';
  const inv = profile?.inventory || {};
  const out = [];

  if (gtab === 'box1') {
    const bannerDef = BOX1_BANNERS[bannerId] || BOX1_BANNERS[DEFAULT_BANNER];
    if (bannerDef.kind === 'pet') {
      const ownedPets = normalizePetsList(profile?.pets);
      for (const stars of [3, 2, 1]) {
        const tierRate = bannerDef.rates[stars] || 0;
        const ids = bannerDef.pool[stars] || [];
        const eachPct = ids.length ? (tierRate / ids.length) * 100 : 0;
        const rateStr = eachPct < 1 ? `${eachPct.toFixed(2)}%` : `${eachPct.toFixed(1)}%`;
        for (const petId of ids) {
          const pDef = PET_CATALOG_V2[petId] || PETS[petId] || {};
          const sprKey = resolvePetSpriteKey(petId, stars, 'front');
          const url = `/assets/pets/${sprKey}.png`;
          const uiScale = resolvePetUiScale(petId, stars, stars, 'front');
          const tierTitle = pDef.tiers?.[stars]?.title || (stars === 3 ? 'Celestial' : stars === 2 ? 'Awakened' : 'Hatchling');
          const ownedPet = ownedPets.find((x) => x.id === petId);
          const owned = Boolean(ownedPet && (ownedPet.stars || 1) >= stars);
          const passivePct = petPassivePct(petId, stars, 1, 100);
          const skillName = pDef.signatureSkill?.name || 'Companion Skill';
          const shortName = (pDef.name || petId)
            .replace(', the Midnight Drake', '')
            .replace('Princess ', '')
            .replace('Baby ', '');
          out.push({
            key: `${petId}:${stars}`,
            id: petId,
            rarity: stars,
            stars,
            name: `${pDef.name || petId} (★${stars} ${tierTitle})`,
            shortName,
            url,
            filter: 'none',
            uiScale,
            ratePct: eachPct,
            rateLabel: rateStr,
            tag: stars === 3 ? '★3' : null,
            owned,
            ownedLabel: ownedPet ? `★${ownedPet.stars || 1}` : null,
            kind: 'pet',
            stageTitle: `🐾 ★${stars} ${tierTitle.toUpperCase()} COMPANION • ${rateStr} DROP`,
            stageSub: `${escapeHtml(pDef.name || petId)} — ⚡ ${escapeHtml(skillName)} (+${passivePct}% Passive)${owned ? ' <span class="s2-badge-gold">✓ OWNED</span>' : ''}`,
          });
        }
      }
      return out;
    }

    // Fashion ('season'), Accessories ('relics'), or 3D Dice ('dice') banner
    const activeFeatured = bannerDef.featured
      ? (SEASON_OUTFITS.includes(profile?.gacha?.featured_outfit) ? profile.gacha.featured_outfit : bannerDef.featured)
      : null;

    const smOn = Boolean(bannerDef.superMythic) && superMythicEnabled();
    const shownRates = smOn ? box1DisplayRates(bannerDef.rates, true) : bannerDef.rates;
    if (smOn) {
      const smPct = (SUPER_MYTHIC.BASE_RATE / SUPER_MYTHIC_POOL.length) * 100;
      for (const id of SUPER_MYTHIC_POOL) {
        const def = OUTFITS[id] || {};
        const vis = resolveItemVisual(id, lineage);
        const owned = Boolean(inv[id]);
        const refine = inv[id]?.refine | 0;
        out.push({
          key: id, id, rarity: SM_TIER, superMythic: true, name: def.name || vis.name || id, shortName: def.name || vis.name || id,
          url: vis.url, filter: vis.filter || 'none', ratePct: smPct, rateLabel: `${smPct.toFixed(2)}%`, tag: null,
          owned, ownedLabel: owned ? (refine > 0 ? `+${refine}` : '✓') : null, kind: 'outfit', slot: 'outfit',
          cp: Math.round(slotCP('outfit', id, 0)),
          stageTitle: `✦ SUPER MYTHIC OUTFIT SET • ${smPct.toFixed(2)}% DROP • PITY ${SUPER_MYTHIC.HARD_PITY}`,
          stageSub: `${escapeHtml(def.name || id)} (Mythic power, legendary runway + live aura)${owned ? ' <span class="s2-badge-gold">✓ OWNED</span>' : ''}`,
        });
      }
    }

    for (const rarity of [3, 2, 1]) {
      const tierRate = shownRates[rarity] || 0;
      const rawIds = [...(bannerDef.pool[rarity] || [])];
      const rateUpSet = new Set(bannerDef.rateUp || []);
      rawIds.sort((a, b) => {
        const aFeat = activeFeatured === a ? 2 : rateUpSet.has(a) ? 1 : 0;
        const bFeat = activeFeatured === b ? 2 : rateUpSet.has(b) ? 1 : 0;
        if (bFeat !== aFeat) return bFeat - aFeat;
        const aOut = OUTFITS[a] ? 1 : 0;
        const bOut = OUTFITS[b] ? 1 : 0;
        return bOut - aOut;
      });

      const nonFeaturedCount = Math.max(1, rawIds.filter((k) => k !== activeFeatured).length);
      const totalWeight = bannerDef.rateUp
        ? rawIds.reduce((s, k) => s + (rateUpSet.has(k) ? (bannerDef.rateUpWeight || 2) : 1), 0)
        : rawIds.length;

      for (const id of rawIds) {
        let pct = 0;
        let tag = null;
        if (activeFeatured && rarity === 3) {
          if (id === activeFeatured) {
            pct = tierRate * (bannerDef.featuredShare || 0.5) * 100;
            tag = 'UP';
          } else {
            pct = (tierRate * (1 - (bannerDef.featuredShare || 0.5)) / nonFeaturedCount) * 100;
          }
        } else if (bannerDef.rateUp) {
          const w = rateUpSet.has(id) ? (bannerDef.rateUpWeight || 2) : 1;
          pct = totalWeight ? (tierRate * (w / totalWeight)) * 100 : 0;
          if (rateUpSet.has(id)) tag = '2×';
        } else {
          pct = rawIds.length ? (tierRate / rawIds.length) * 100 : 0;
        }

        const isOutfit = Boolean(OUTFITS[id]);
        const isDice = Boolean(DICE_SKINS[id]);
        const def = OUTFITS[id] || ACCESSORIES[id] || DICE_SKINS[id] || {};
        const slot = isOutfit ? 'outfit' : isDice ? 'dice' : (def.slot || 'hat');
        const cp = Math.round(slotCP(slot, id, 0));
        const vis = resolveItemVisual(id, lineage);
        const owned = Boolean(inv[id]);
        const refine = inv[id]?.refine | 0;
        const rateStr = pct < 1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`;
        const fullName = def.name || vis.name || id;
        const shortName = fullName.replace(/^Season\s*\d+:\s*/i, '');
        const outfitSkill = isOutfit ? skillFor(id, rarity) : null;
        const skillStr = outfitSkill?.name ? ` • ${escapeHtml(outfitSkill.icon || '⚡')} ${escapeHtml(outfitSkill.name)}` : '';
        const tierLabel = rarity === 3 ? 'MYTHIC' : rarity === 2 ? 'EPIC' : 'RARE';
        const kindLabel = isOutfit ? 'OUTFIT SET' : isDice ? '3D DICE SKIN' : (SLOT_LABELS[slot] || 'GEAR').toUpperCase();

        out.push({
          key: id,
          id,
          rarity,
          name: fullName,
          shortName,
          url: vis.url,
          filter: vis.filter || 'none',
          ratePct: pct,
          rateLabel: rateStr,
          tag,
          owned,
          ownedLabel: owned ? (refine > 0 ? `+${refine}` : '✓') : null,
          kind: isOutfit ? 'outfit' : isDice ? 'dice' : 'accessory',
          slot,
          cp,
          stageTitle: `${isOutfit ? '👗' : isDice ? '🎲' : '👑'} ★${rarity} ${tierLabel} ${kindLabel} • ${rateStr} DROP`,
          stageSub: `${escapeHtml(fullName)} (+${cp} CP${skillStr})${owned ? ' <span class="s2-badge-gold">✓ OWNED</span>' : ''}`,
        });
      }
    }
    return out;
  }

  if (gtab === 'box2') {
    const vil = profile?.village || {};
    const wondersOwned = vil.wonders || {};
    const bpsOwned = vil.blueprints || {};
    const decorOwned = vil.decor || {};

    // ★3 VIP Wonders
    const w3Ids = BOX2_POOL[3] || [];
    const w3Pct = w3Ids.length ? (BOX2.RATES[3] / w3Ids.length) * 100 : 0;
    for (const id of w3Ids) {
      const w = WONDERS[id] || {};
      const vis = resolveItemVisual(id, lineage);
      const owned = Boolean(wondersOwned[id]);
      const starsOwned = wondersOwned[id]?.stars || 0;
      const rateStr = `${w3Pct.toFixed(2)}%`;
      out.push({
        key: id,
        id,
        rarity: 3,
        name: w.name || vis.name || id,
        shortName: (w.name || id).replace(/^Royal\s+|^Grand\s+/i, ''),
        url: vis.url,
        filter: vis.filter || 'none',
        ratePct: w3Pct,
        rateLabel: rateStr,
        tag: 'VIP',
        owned,
        ownedLabel: owned ? (starsOwned ? `★${starsOwned}` : '✓') : null,
        kind: 'wonder',
        stageTitle: `${w.emoji || '🎡'} ★3 MYTHIC VIP WONDER (${w.w || 4}×${w.h || 4}) • ${rateStr} DROP`,
        stageSub: `${escapeHtml(w.name || id)} (${escapeHtml(w.effect || '')})${owned ? ' <span class="s2-badge-gold">✓ OWNED</span>' : ''}`,
      });
    }

    // ★2 Epic Wonders
    const w2Ids = BOX2_POOL[2] || [];
    const w2Pct = w2Ids.length ? (BOX2.RATES[2] / w2Ids.length) * 100 : 0;
    for (const id of w2Ids) {
      const w = WONDERS[id] || {};
      const vis = resolveItemVisual(id, lineage);
      const owned = Boolean(wondersOwned[id]);
      const rateStr = `${w2Pct.toFixed(1)}%`;
      out.push({
        key: id,
        id,
        rarity: 2,
        name: w.name || vis.name || id,
        shortName: (w.name || id).replace(/^Celestial\s+/i, ''),
        url: vis.url,
        filter: vis.filter || 'none',
        ratePct: w2Pct,
        rateLabel: rateStr,
        tag: null,
        owned,
        ownedLabel: owned ? '✓' : null,
        kind: 'wonder',
        stageTitle: `${w.emoji || '♨️'} ★2 EPIC WONDER (${w.w || 3}×${w.h || 3}) • ${rateStr} DROP`,
        stageSub: `${escapeHtml(w.name || id)} (${escapeHtml(w.effect || '')})${owned ? ' <span class="s2-badge-gold">✓ OWNED</span>' : ''}`,
      });
    }

    // ★1 Blueprints
    const bpKeys = BOX2_POOL.blueprints || [];
    const bpPct = bpKeys.length ? ((BOX2.RATES[1] * BOX2.COMMON_BLUEPRINT_SHARE) / bpKeys.length) * 100 : 0;
    for (const coreKey of bpKeys) {
      const id = `bp_${coreKey}`;
      const c = CORE[coreKey] || {};
      const vis = resolveItemVisual(id, lineage);
      const cnt = bpsOwned[coreKey] | 0;
      const lv = vil.levels?.[coreKey] || 1;
      const rateStr = `${bpPct.toFixed(1)}%`;
      out.push({
        key: id,
        id,
        rarity: 1,
        name: `${c.name || coreKey} Blueprint`,
        shortName: `${(c.name || coreKey).split(' ').slice(-1)[0]} BP`,
        url: vis.url,
        filter: vis.filter || 'none',
        ratePct: bpPct,
        rateLabel: rateStr,
        tag: 'BP',
        owned: cnt > 0,
        ownedLabel: cnt > 0 ? `x${cnt}` : null,
        kind: 'blueprint',
        stageTitle: `📘 ★1 LANDMARK BLUEPRINT (Lv.${lv}) • ${rateStr} DROP`,
        stageSub: `${escapeHtml(c.name || coreKey)} Blueprint Card (${cnt} owned)`,
      });
    }

    // ★1 Decor
    const decIds = BOX2_POOL.decor || [];
    const decPct = decIds.length ? ((BOX2.RATES[1] * (1 - BOX2.COMMON_BLUEPRINT_SHARE)) / decIds.length) * 100 : 0;
    for (const id of decIds) {
      const d = DECOR[id] || {};
      const vis = resolveItemVisual(id, lineage);
      const cnt = decorOwned[id] | 0;
      const rateStr = `${decPct.toFixed(1)}%`;
      out.push({
        key: id,
        id,
        rarity: 1,
        name: d.name || vis.name || id,
        shortName: d.name || vis.name || id,
        url: vis.url,
        filter: vis.filter || 'none',
        ratePct: decPct,
        rateLabel: rateStr,
        tag: null,
        owned: cnt > 0,
        ownedLabel: cnt > 0 ? `x${cnt}` : null,
        kind: 'decor',
        stageTitle: `🌳 ★1 VILLAGE DECOR (${d.w || 1}×${d.h || 1}) • ${rateStr} DROP`,
        stageSub: `${escapeHtml(d.name || id)} (+${d.prosperity || 15} Prosperity • ${cnt} owned)`,
      });
    }
  }

  return out;
}

function renderGachaPrizePoolHtml(pool, activeKey = null, p = null) {
  if (!pool || !pool.length) return '';
  const lineage = p?.lineage === 'dxb' ? 'dxb' : 'bkk';
  const tilesHtml = pool.map((entry) => {
    const isSelected = activeKey === entry.key;
    const isOutfitEntry = entry.kind === 'outfit';
    const filterStyle = entry.filter && entry.filter !== 'none' ? `filter:${entry.filter};` : '';
    const thumbContentHtml = isOutfitEntry
      ? renderOutfitThumbLayers(entry.id, { lineage, appearance: p?.appearance, url: entry.url, filter: entry.filter, alt: entry.shortName })
      : `<img src="${entry.url}" alt="${escapeHtml(entry.shortName)}" loading="lazy" decoding="async" style="${filterStyle}" />`;
    return `
      <button type="button"
              class="s2-pool-tile s2-rarity-${entry.rarity} ${isSelected ? 'is-selected' : ''} ${entry.owned ? 'is-owned' : ''}"
              data-gacha-preview="${escapeHtml(entry.key)}"
              title="${escapeHtml(entry.name)} (${entry.rateLabel})">
        <div class="s2-pool-tile-top">
          <span class="s2-pool-stars">${entry.rarity === SM_TIER ? '✦ SUPER' : '★'.repeat(entry.rarity)}</span>
          <span class="s2-pool-rate">${entry.tag ? `<b>${escapeHtml(entry.tag)}</b> ` : ''}${escapeHtml(entry.rateLabel)}</span>
        </div>
        <div class="s2-pool-thumb-wrap ${isOutfitEntry ? 's2-thumb-has-hair' : ''}">
          ${thumbContentHtml}
          ${entry.ownedLabel ? `<span class="s2-pool-owned-badge">${escapeHtml(entry.ownedLabel)}</span>` : ''}
        </div>
        <div class="s2-pool-name">${escapeHtml(entry.shortName)}</div>
      </button>
    `;
  }).join('');

  return `
    <div class="s2-pool-section" id="gacha-prize-pool">
      <div class="s2-pool-header">
        <span class="s2-pool-title">🎁 Prize Pool (✦ Super Mythic → ★1 Rare)</span>
        ${activeKey
          ? `<button type="button" class="s2-pool-reset-btn" data-gacha-preview-reset="1">↺ Reset Stage</button>`
          : `<span class="s2-pool-hint">👆 Tap any item to preview</span>`}
      </div>
      <div class="s2-gacha-pool-grid" id="gacha-pool-grid">
        ${tilesHtml}
      </div>
    </div>
  `;
}

function resolveGachaItem(item, lineage = 'bkk') {
  const isPet = Boolean(item.pet);
  const lookupId = item.kind === 'blueprint'
    ? `bp_${item.target || String(item.id || '').replace(/^bp_/, '')}`
    : item.id;
  const vis = resolveItemVisual(lookupId, lineage);
  let rarity = item.rarity || vis.rarity || 1;
  if (tierOf({ ...item, rarity }) === SM_TIER) rarity = SM_TIER;
  else if (typeof rarity !== 'number') rarity = Number(rarity) || 1;
  let kindBadge = '';

  if (isPet) {
    if (item.kind === 'new') {
      kindBadge = 'NEW';
    } else if (item.kind === 'essence') {
      kindBadge = `+${item.essence || 25} ✨ Essence`;
    } else if (item.kind === 'star_dupe') {
      kindBadge = `+1 ★ progress (${item.starDupes}/${item.nextAt})`;
    } else if (item.kind === 'star_up') {
      kindBadge = `★ UP → ★${item.stars}`;
    } else if (item.kind === 'shards') {
      kindBadge = `+${item.shards || 100} 🌟`;
    } else {
      kindBadge = (item.kind || 'NEW').toUpperCase();
    }
  } else {
    if (item.kind === 'blueprint') {
      rarity = 1;
      kindBadge = 'BLUEPRINT';
    } else if (item.kind === 'decor') {
      rarity = 1;
      kindBadge = 'DECOR';
    } else if (item.kind === 'new') {
      kindBadge = 'NEW!';
    } else if (item.kind === 'dupe') {
      kindBadge = 'DUPE +1';
    } else if (item.kind === 'shards') {
      kindBadge = `+${item.shards || DUPE_SHARDS[rarity] || 0} 🌟`;
    } else if (item.kind === 'star_up') {
      kindBadge = `★${item.stars || ''} UP!`;
    } else {
      kindBadge = (item.kind || 'NEW').toUpperCase();
    }
  }

  return {
    name: vis.name,
    rarity,
    kindBadge,
    url: vis.url,
    filter: vis.filter,
    badgeUrl: vis.badgeUrl,
    isPet,
  };
}

export class RpgUI {
  constructor({ request, toast, humanError, getProfile, root = document.getElementById('app') }) {
    this.request = request;
    this.toast = toast || ((msg) => console.log(msg));
    this.humanError = humanError || ((code) => code);
    this.getProfile = getProfile || (() => ({}));
    this.root = root || (typeof document !== 'undefined' ? (document.getElementById('app') || document.body) : null);

    this.currentView = null;
    this.currentOpts = {};
    this.busy = false;

    // View state
    this.selectedWTab = 'fashion'; // 'fashion' | 'accessories' | 'hair' | 'pets' | 'bag'
    this.selectedSlot = 'outfit';
    this.selectedHairSection = 'closet'; // 'closet' | 'classic' | 'gacha' | 'dyes'
    this.selectedGTab = 'box1'; // 'box1' | 'box2' | 'shop'
    this.selectedBanner = DEFAULT_BANNER; // 'season' | 'relics' | 'pets'
    this.gachaPreviewKey = null; // active item key previewed on the Gacha stage
    this.selectedForgeItem = null;
    this.forgeBerries = false;
    this.forgeScroll = false;
    this.selectedPetUid = null;
    this.selectedTraitSlot = 0;
    this.selectedPicks = {}; // offerId -> pickId
    this.closetDrawerOpen = false;
    this.poolDrawerOpen = false;
    this.forgeDrawerOpen = false;
    this.selectedGiftRibbon = 'pink';
    this.founderModalOpen = false;

    // Results state
    this.lastGachaResult = null;
    this.lastForgeResult = null;
    this.lastPetResult = null;
    this.lastHairPullResult = null;

    this.lastUserActivityAt = Date.now();
    if (typeof window !== 'undefined') {
      const onActivity = () => { this.lastUserActivityAt = Date.now(); };
      window.addEventListener('pointerdown', onActivity, { passive: true });
      window.addEventListener('keydown', onActivity, { passive: true });
    }
    this._startOnlinePetTick();

    this.el = null;
    this.initDom();
  }

  _startOnlinePetTick() {
    if (this._onlineTickTimer) clearInterval(this._onlineTickTimer);
    this._onlineTickTimer = setInterval(async () => {
      if (typeof Date === 'undefined') return;
      const now = Date.now();
      if (now - (this.lastUserActivityAt || 0) >= 180_000) return;
      const pet = this.resolveActivePet();
      if (!pet) return;
      try {
        const res = await this.request('pet_online_tick', { petUid: pet.uid, petId: pet.id });
        if (res && res.ok) {
          this.handlePetOnlineTickReply(res);
        }
      } catch (e) {
        // ignore background tick errors
      }
    }, 60_000);
  }

  patchPetReply(res) {
    if (!res || !res.ok) return;
    const p = this.profile;
    if (!p) return;
    const petUid = res.petUid;
    const petId = res.petId;
    if (Array.isArray(p.pets) && (petUid || petId)) {
      const pet = p.pets.find((x) => (petUid && x.uid === petUid) || (petId && x.id === petId));
      if (pet) {
        if (res.bond_lv != null) pet.bond_lv = res.bond_lv;
        if (res.bond_xp != null) pet.bond_xp = res.bond_xp;
        if (res.stars != null) pet.stars = res.stars;
        if (res.visual_tier != null) pet.visual_tier = res.visual_tier;
        if (res.hunger != null) pet.hunger = res.hunger;
        if (res.mood != null) pet.mood = res.mood;
        if (res.essence != null) pet.essence = res.essence;
        if (res.spent_essence != null) pet.spent_essence = res.spent_essence;
        if (res.nickname !== undefined) pet.nickname = res.nickname;
        if (res.costume_id !== undefined) pet.costume_id = res.costume_id;
        if (Array.isArray(res.slots)) pet.slots = res.slots;
        if (Array.isArray(res.active_poses)) pet.active_poses = res.active_poses;
        if (p.equipped?.pet && (p.equipped.pet.uid === pet.uid || p.equipped.pet.id === pet.id)) {
          if (res.bond_lv != null) p.equipped.pet.bond_lv = res.bond_lv;
          if (res.stars != null) p.equipped.pet.stars = res.stars;
          if (res.visual_tier != null) p.equipped.pet.visual_tier = res.visual_tier;
          if (res.hunger != null) p.equipped.pet.hunger = res.hunger;
          if (res.nickname !== undefined) p.equipped.pet.nickname = res.nickname;
          if (res.costume_id !== undefined) p.equipped.pet.costume_id = res.costume_id;
          if (Array.isArray(res.active_poses)) p.equipped.pet.active_poses = res.active_poses;
        }
      }
    }
  }

  handlePetOnlineTickReply(res) {
    if (!res || !res.ok) return;
    this.patchPetReply(res);
    const worldPet = this.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
    if (res.expGained > 0 && worldPet?.bubble) {
      worldPet.bubble('+EXP ♥');
    }
    if (res.leveledUp) {
      this.toast(`🎉 Companion leveled up! Lv.${res.bond_lv}!`);
    }
    if (this.isOpen && this.currentView === 'pets') {
      this.render();
    }
  }

  handlePetEquipCostumeReply(res) {
    if (!res || !res.ok) return;
    const p = this.profile;
    if (p && Array.isArray(p.pets)) {
      const pet = p.pets.find((x) => x.uid === res.petUid || x.id === res.petId);
      if (pet) {
        pet.costume_id = res.costume_id;
      }
    }
    if (p?.equipped?.pet && (p.equipped.pet.uid === res.petUid || p.equipped.pet.id === res.petId)) {
      p.equipped.pet.costume_id = res.costume_id;
    }
    const worldPet = this.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
    if (worldPet) {
      worldPet.costumeId = res.costume_id;
    }
    const cName = res.costume_id ? (OUTFITS[res.costume_id]?.name || res.costume_id) : null;
    this.toast(cName ? `👗 Linked ${cName} to companion!` : '👗 Reset companion costume.');
    if (this.isOpen) {
      this.render();
    }
  }

  handlePetAdoptReply(res) {
    if (!res || !res.ok) return;
    const p = this.profile;
    if (p) {
      if (res.gold != null) p.gold = res.gold;
      if (res.cp != null) p.cp = res.cp;
      if (res.pet) {
        p.pets = Array.isArray(p.pets) ? p.pets : [];
        const exists = p.pets.some((x) => x.id === res.pet.id || x.uid === res.pet.uid);
        if (!exists) p.pets.push(res.pet);
        this.selectedPetUid = res.pet.uid;
      }
    }
    const pDef = PETS[res.petId] || PETS[res.pet?.id];
    const name = pDef?.name || res.petId;
    this.toast(`🎉 Adopted ${name}! Companion joined your sanctuary.`);
    if (this.isOpen) {
      this.render();
    }
  }

  onGiftReceived(gift) {
    const p = this.profile;
    if (p && gift) {
      p.gacha = p.gacha || {};
      p.gacha.gifts_pending = Array.isArray(p.gacha.gifts_pending) ? p.gacha.gifts_pending : [];
      if (!p.gacha.gifts_pending.some((g) => g.id === gift.id)) p.gacha.gifts_pending.push(gift);
    }
    if (this.isOpen && this.currentView === 'gacha') this.render();
  }

  playRunwayForResult(r) {
    if (!r || !Array.isArray(r.items) || !r.items.length) return;
    const p = this.profile || {};
    try {
      const rw = getRunway();
      rw.play({
        items: r.items,
        pullId: r.pullId || null,
        look: { id: p.id, username: p.username, lineage: p.lineage, appearance: p.appearance, equipped: p.equipped },
        pity: { sm: r.smPity ?? (p.gacha?.[SUPER_MYTHIC.PITY_KEY] | 0), smMax: r.smPityMax || SUPER_MYTHIC.HARD_PITY },
      }).finally(() => {
        if (this.isOpen) this.render();
      });
    } catch (e) {
      console.warn('[gacha] runway fallback:', e);
      this.toast(`✨ Summoned ${r.items.length} item${r.items.length > 1 ? 's' : ''}!`);
    }
  }

  get profile() {
    return (this.getProfile ? this.getProfile() : null) || this.cachedProfile || {};
  }

  get isOpen() {
    return Boolean(this.el && !this.el.hidden && this.currentView);
  }

  initDom() {
    if (this.el) return;
    const parent = this.root || (typeof document !== 'undefined' ? (document.getElementById('app') || document.body) : null);
    if (!parent) return;

    const existing = document.getElementById('rpg-ui');
    if (existing) {
      this.el = existing;
    } else {
      const wrap = document.createElement('div');
      wrap.id = 'rpg-ui';
      wrap.className = 'rpg-wrap';
      wrap.hidden = true;
      parent.appendChild(wrap);
      this.el = wrap;
    }
    this.bindEvents();
  }

  open(view = 'wardrobe', opts = {}) {
    this.initDom();
    if (!this.el) return;

    this.currentView = view;
    this.currentOpts = opts || {};
    if (opts && opts.giftTo) {
      this.giftToRecipient = opts.giftTo;
    }

    if (view === 'wardrobe') {
      this.closetDrawerOpen = Boolean(opts.openCloset || opts.tab === 'accessories' || opts.slot);
      if (opts.tab) this.selectedWTab = opts.tab === 'accessories' ? 'fashion' : opts.tab;
      if (opts.slot) this.selectedSlot = opts.slot;
      else if (this.selectedWTab === 'fashion' && !this.selectedSlot) this.selectedSlot = 'outfit';
    } else if (view === 'gacha') {
      this.poolDrawerOpen = false;
      if (opts.tab) {
        if (opts.tab !== this.selectedGTab) {
          this.lastGachaResult = null;
          this.gachaPreviewKey = null;
        }
        this.selectedGTab = opts.tab;
      }
      if (opts.banner && BOX1_BANNERS[opts.banner]) {
        if (opts.banner !== this.selectedBanner) this.gachaPreviewKey = null;
        this.selectedBanner = opts.banner;
      }
    } else if (view === 'forge') {
      this.forgeDrawerOpen = false;
      if (opts.itemId) this.selectedForgeItem = opts.itemId;
    } else if (view === 'pets') {
      if (opts.petUid) this.selectedPetUid = opts.petUid;
    }

    if (typeof document !== 'undefined') {
      document.body?.classList?.toggle('rpg-open', true);
      const dockMap = { wardrobe: 'wardrobe', gacha: 'gacha', forge: 'wardrobe', pets: 'wardrobe' };
      const targetDock = dockMap[view];
      if (targetDock) {
        document.querySelectorAll('#bottom-dock .dock-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.dock === targetDock);
        });
      }
    }

    this.el.hidden = false;
    this.render();
    this._startPoseCycleTimer();
  }

  close() {
    this._stopPoseCycleTimer();
    if (!this.el) return;
    this.el.hidden = true;
    this.currentView = null;
    stopWardrobePreview();
    if (typeof document !== 'undefined') {
      document.body?.classList?.toggle('rpg-open', false);
      const activeDock = document.querySelector('#bottom-dock .dock-btn.active');
      if (activeDock && (activeDock.dataset.dock === 'wardrobe' || activeDock.dataset.dock === 'gacha')) {
        document.querySelectorAll('#bottom-dock .dock-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.dock === 'village');
        });
      }
    }
  }

  _startPoseCycleTimer() {
    this._stopPoseCycleTimer();
    if (typeof window === 'undefined') return;
    this._poseCycleTimer = setInterval(() => {
      if (!this.isOpen || (this.currentView !== 'pets' && this.currentView !== 'wardrobe')) return;
      const pet = this.resolveActivePet();
      if (!pet) return;
      const rawStars = Math.max(1, Math.min(3, Number(pet.stars ?? PETS[pet.id]?.rarity) || 1));
      const bondLv = Math.max(1, Math.min(30, Math.max(Number(pet.bond_lv) || 1, minLevelForStars(rawStars))));
      const poses = normalizeActivePoses(pet.active_poses, bondLv);
      if (poses.length <= 1) return;
      let idx = (Math.random() * poses.length) | 0;
      if (poses[idx] === this.petPreviewPose) {
        idx = (idx + 1 + ((Math.random() * (poses.length - 1)) | 0)) % poses.length;
      }
      const nextPose = poses[idx];
      this.petPreviewPose = nextPose;
      const stagePose = nextPose === 'flip' ? 'happy' : nextPose;
      const stars = Math.max(rawStars, starsForLevel(bondLv));
      const visualTier = Math.max(1, Math.min(stars, Number(pet.visual_tier) || stars));
      const sprKey = resolvePetSpriteKey(pet.id, visualTier, stagePose);
      if (!spriteInfo(sprKey)) return;
      const url = `/assets/pets/${sprKey}.png`;
      const scale = resolvePetUiScale(pet.id, stars, visualTier, stagePose);

      // Update Sanctuary Stage or Wardrobe Stage <img> directly in-place (zero innerHTML rebuild)
      const stageImg = this.el?.querySelector('.pet-v2-stage-pet, .s2-pd-pet');
      if (stageImg) {
        stageImg.src = url;
        stageImg.style.setProperty('--pet-ui-scale', String(scale));
        stageImg.classList.toggle('pet-v2-flip-spin', nextPose === 'flip');
      }
      if (this.currentView === 'pets' && this.el) {
        const btns = this.el.querySelectorAll('.pet-v2-pose-btn[data-pet-pose]');
        for (const b of btns) {
          b.classList.toggle('is-previewing', b.dataset.petPose === nextPose);
        }
      }
    }, 3400);
  }

  _stopPoseCycleTimer() {
    if (this._poseCycleTimer) {
      clearInterval(this._poseCycleTimer);
      this._poseCycleTimer = null;
    }
  }

  onProfile(profile) {
    this.cachedProfile = profile;
    if (this.isOpen) {
      this.render();
    }
  }

  setBusy(busy) {
    this.busy = busy;
    if (!this.el) return;
    this.el.classList.toggle('rpg-busy', busy);
    const elements = this.el.querySelectorAll('button, input, select');
    for (const el of elements) {
      if (busy) {
        if (!el.disabled) {
          el.dataset.wasDisabled = 'false';
          el.disabled = true;
        } else {
          el.dataset.wasDisabled = 'true';
        }
      } else {
        if (el.dataset.wasDisabled === 'false') {
          el.disabled = false;
        }
        delete el.dataset.wasDisabled;
      }
    }
  }

  async executeAction(type, payload, onSuccess) {
    if (this.busy) return;
    this.setBusy(true);
    try {
      const res = await this.request(type, payload);
      if (!res) {
        this.toast('Request timed out. Please try again.');
        return;
      }
      if (!res.ok) {
        let msg = this.humanError ? this.humanError(res.error) : res.error;
        if (res.error === 'scroll_not_allowed') {
          msg = 'Artisan Scrolls only work on upgrades to +5 … +10';
        } else if (res.error === 'not_enough_scrolls') {
          msg = 'You do not have enough Artisan Scrolls';
        }
        this.toast(`⚠️ ${msg || res.error || 'Action failed'}`);
      } else {
        this.patchPetReply(res);
        if (type === 'pet_online_tick') {
          this.handlePetOnlineTickReply(res);
        } else if (type === 'pet_equip_costume') {
          this.handlePetEquipCostumeReply(res);
        } else if (type === 'pet_adopt') {
          this.handlePetAdoptReply(res);
        }
        if (onSuccess) {
          onSuccess(res);
        }
      }
    } catch (err) {
      this.toast(`⚠️ Error: ${err.message || err}`);
    } finally {
      this.setBusy(false);
      this.render();
    }
  }

  send(type, payload, onSuccess) {
    return this.executeAction(type, payload, onSuccess);
  }

  handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (msg.type === 'pet_online_tick' || msg.action === 'pet_online_tick') {
      this.handlePetOnlineTickReply(msg);
      return true;
    }
    if (msg.type === 'pet_equip_costume' || msg.action === 'pet_equip_costume') {
      this.handlePetEquipCostumeReply(msg);
      return true;
    }
    if (msg.type === 'pet_adopt' || msg.action === 'pet_adopt') {
      this.handlePetAdoptReply(msg);
      return true;
    }
    return false;
  }

  bindEvents() {
    if (!this.el || this._eventsBound) return;
    this._eventsBound = true;

    if (typeof document !== 'undefined' && !this._docDockBound) {
      this._docDockBound = true;
      document.addEventListener('click', (e) => {
        if (!this.isOpen) return;
        const dockBtn = e.target.closest('#bottom-dock .dock-btn[data-dock]');
        if (!dockBtn) return;
        const dock = dockBtn.dataset.dock;
        if (dock === 'village' || dock === 'play' || dock === 'townhall') {
          this.close();
        }
      });
    }

    this.el.addEventListener('click', (e) => {
      if (e.target.closest('#rpg-close') || e.target.classList.contains('rpg-backdrop')) {
        this.close();
        return;
      }
      if (this.busy) return;

      // Progressive Disclosure Drawer Toggles (Closet / Pool / Forge)
      if (e.target.closest('[data-toggle-closet-drawer]')) {
        this.closetDrawerOpen = !this.closetDrawerOpen;
        this.render();
        return;
      }
      if (e.target.closest('[data-closet-close]')) {
        this.closetDrawerOpen = false;
        this.render();
        return;
      }
      if (e.target.closest('[data-toggle-pool-drawer]')) {
        this.poolDrawerOpen = !this.poolDrawerOpen;
        this.render();
        return;
      }
      if (e.target.closest('[data-pool-close]')) {
        this.poolDrawerOpen = false;
        this.render();
        return;
      }
      if (e.target.closest('[data-toggle-forge-drawer]')) {
        this.forgeDrawerOpen = !this.forgeDrawerOpen;
        this.render();
        return;
      }
      if (e.target.closest('[data-forge-drawer-close]')) {
        this.forgeDrawerOpen = false;
        this.render();
        return;
      }

      // VIP Card Buy
      const vipBuyBtn = e.target.closest('[data-act="vip-buy"]');
      if (vipBuyBtn) {
        const card = vipBuyBtn.dataset.vipCard;
        const payload = { card };
        if (card === 'telelink_box') {
          payload.target = this.profile?.partner_id || this.profile?.friends?.[0] || 'neen';
        }
        this.executeAction('vip_card_buy', payload, () => {
          this.toast(`💳 Purchased VIP Card: ${card}!`);
        });
        return;
      }

      // VIP Card Gift (buy asGift)
      const vipGiftBtn = e.target.closest('[data-act="vip-gift"]');
      if (vipGiftBtn) {
        const card = vipGiftBtn.dataset.vipCard;
        this.executeAction('vip_card_buy', { card, asGift: true }, () => {
          this.toast(`🎁 Purchased VIP Card as Gift to Bag: ${card}!`);
        });
        return;
      }

      // VIP Card Use
      const vipUseBtn = e.target.closest('[data-act="vip-use"]');
      if (vipUseBtn) {
        const card = vipUseBtn.dataset.vipCard;
        const payload = { card };
        if (card === 'telelink_box') {
          payload.target = this.profile?.partner_id || this.profile?.friends?.[0] || 'neen';
        }
        this.executeAction('vip_card_use', payload, () => {
          this.toast(`✨ Activated VIP Card: ${card}!`);
        });
        return;
      }

      // Partner Gift Ribbon
      const ribbonBtn = e.target.closest('[data-ribbon]') || e.target.closest('[data-gift-ribbon]');
      if (ribbonBtn) {
        this.selectedGiftRibbon = ribbonBtn.dataset.ribbon || ribbonBtn.dataset.giftRibbon;
        this.render();
        return;
      }

      // Owl Send Gift
      const owlSendBtn = e.target.closest('[data-act="owl-send"]') || e.target.closest('[data-owl-dispatch]');
      if (owlSendBtn) {
        const toEl = this.el?.querySelector('#owl-to');
        const to = toEl?.value;
        if (!to) {
          this.toast('⚠️ Please select a recipient (partner or friend)!');
          return;
        }
        const s1Val = this.el?.querySelector('#owl-slot1')?.value;
        const s2Val = this.el?.querySelector('#owl-slot2')?.value;
        let slot1 = undefined;
        let slot2 = undefined;
        if (s1Val) {
          const parts = s1Val.split(':');
          if (parts[0] === 'gear') slot1 = { kind: 'gear', itemId: parts[2], mode: parts[1] };
          else if (parts[0] === 'decor') slot1 = { kind: 'decor', decId: parts[1] };
        }
        if (s2Val) {
          const parts = s2Val.split(':');
          if (parts[0] === 'bag') slot2 = { kind: 'bag', key: parts[1] };
          else if (parts[0] === 'berries') slot2 = { kind: 'berries', amount: Math.min(200, parseInt(parts[1], 10) || 50) };
        }
        if (!slot1 && !slot2) {
          this.toast('⚠️ Please attach at least one gift item in Slot 1 or Slot 2!');
          return;
        }
        const note = (this.el?.querySelector('#owl-note')?.value || '').trim().slice(0, 80);
        const ribbon = this.selectedGiftRibbon || 'pink';
        const payload = { to, ribbon };
        if (slot1) payload.slot1 = slot1;
        if (slot2) payload.slot2 = slot2;
        if (note) payload.note = note;

        this.executeAction('owl_send_gift', payload, (r) => {
          this.toast(`🦉 Royal Owl dispatched your gift! Postage: ${r.postage || 50} 🍓`);
        });
        return;
      }

      // Owl Claim Mail
      const owlClaimBtn = e.target.closest('[data-act="owl-claim"]');
      if (owlClaimBtn) {
        const mailId = owlClaimBtn.dataset.mailId;
        this.executeAction('owl_claim_mail', { mailId }, () => {
          this.toast('🎁 Claimed gift from Royal Owl Inbox!');
        });
        return;
      }

      // Daily Passport Claim
      const passportClaimBtn = e.target.closest('[data-act="passport-claim"]');
      if (passportClaimBtn) {
        const quest = passportClaimBtn.dataset.quest;
        this.executeAction('passport_claim', { quest }, () => {
          this.toast(`📜 Claimed passport quest: ${quest}!`);
        });
        return;
      }

      // Open / Close Founder Modal
      if (e.target.closest('[data-act="open-founder"]')) {
        this.founderModalOpen = true;
        this.render();
        return;
      }
      if (e.target.closest('[data-act="close-founder"]')) {
        this.founderModalOpen = false;
        this.render();
        return;
      }

      // Founder Claim
      const founderClaimBtn = e.target.closest('[data-act="founder-claim"]');
      if (founderClaimBtn) {
        const code = (this.el?.querySelector('#founder-code')?.value || '').trim();
        this.executeAction('founder_claim', code ? { code } : {}, () => {
          this.toast('🎉 Founder\'s Pack Claimed! Equipped \'Sky Party Founder\' title!');
        });
        return;
      }

      // View Navigation Tabs
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        const v = viewBtn.dataset.view;
        if (v) this.open(v);
        return;
      }

      // Wardrobe Sub-Tabs
      const wtabBtn = e.target.closest('[data-wtab]');
      if (wtabBtn) {
        const rawTab = wtabBtn.dataset.wtab;
        if (rawTab === 'accessories') {
          this.selectedWTab = 'fashion';
          if (this.selectedSlot === 'outfit') this.selectedSlot = 'hat';
          this.closetDrawerOpen = true;
        } else {
          this.selectedWTab = rawTab;
          if (rawTab === 'fashion') this.closetDrawerOpen = false;
        }
        this.render();
        return;
      }

      // Wardrobe Slot Selection
      const slotCard = e.target.closest('[data-slot]');
      if (slotCard && !e.target.closest('[data-hide]') && !e.target.closest('[data-goforge]')) {
        const slot = slotCard.dataset.slot;
        this.selectedSlot = slot;
        this.selectedWTab = 'fashion';
        this.closetDrawerOpen = true;
        this.render();
        return;
      }

      // Wardrobe Eye Hide Toggle
      const hideBtn = e.target.closest('[data-hide]');
      if (hideBtn) {
        e.stopPropagation();
        const slot = hideBtn.dataset.hide;
        const cur = this.profile.equipped?.[slot];
        if (!cur) return;
        this.executeAction('wardrobe_equip', { slot, hide: !cur.hide });
        return;
      }

      // Wardrobe Go to Forge
      const goForgeBtn = e.target.closest('[data-goforge]');
      if (goForgeBtn) {
        e.stopPropagation();
        const itemId = goForgeBtn.dataset.goforge;
        this.open('forge', { itemId });
        return;
      }

      // Wardrobe Equip Item in Grid
      const equipBtn = e.target.closest('[data-equip]');
      if (equipBtn) {
        const itemId = equipBtn.dataset.equip;
        const slot = itemSlot(itemId) || this.selectedSlot;
        this.executeAction('wardrobe_equip', { slot, itemId }, () => {
          this.toast(`✨ Equipped ${itemDef(itemId)?.name || itemId}!`);
        });
        return;
      }

      // Wardrobe Unequip Slot
      const unequipBtn = e.target.closest('[data-unequip]');
      if (unequipBtn) {
        const slot = unequipBtn.dataset.unequip;
        this.executeAction('wardrobe_equip', { slot, itemId: null }, () => {
          this.toast(`Unequipped ${SLOT_LABELS[slot] || slot}.`);
        });
        return;
      }

      // Wardrobe Equip Pet
      const equipPetBtn = e.target.closest('[data-equip-pet]');
      if (equipPetBtn) {
        const uid = equipPetBtn.dataset.equipPet;
        this.executeAction('wardrobe_equip', { slot: 'pet', itemId: uid }, () => {
          const p = (this.profile.pets || []).find((x) => x.uid === uid);
          this.toast(`🐾 Equipped ${PETS[p?.id]?.name || 'pet'}!`);
        });
        return;
      }

      // Gacha Sub-Tabs
      const gtabBtn = e.target.closest('[data-gtab]');
      if (gtabBtn) {
        this.selectedGTab = gtabBtn.dataset.gtab;
        this.lastGachaResult = null;
        this.gachaPreviewKey = null;
        this.render();
        return;
      }

      // Box 1 Sub-Banner Selection Pills
      const bannerBtn = e.target.closest('[data-box1-banner]');
      if (bannerBtn) {
        const b = bannerBtn.dataset.box1Banner;
        if (BOX1_BANNERS[b] && b !== 'pets') {
          this.selectedBanner = b;
          this.gachaPreviewKey = null;
          this.render();
        }
        return;
      }

      // Gacha Stage Live Item Preview (from Prize Pool tile or Stage Bubble)
      const previewResetBtn = e.target.closest('[data-gacha-preview-reset]');
      if (previewResetBtn) {
        this.gachaPreviewKey = null;
        this.render();
        return;
      }

      const previewTileBtn = e.target.closest('[data-gacha-preview]');
      if (previewTileBtn) {
        const key = previewTileBtn.dataset.gachaPreview;
        this.gachaPreviewKey = this.gachaPreviewKey === key ? null : key;
        this.render();
        return;
      }

      // Gacha Pulls (all routed through the Grand Royal Opera Runway reveal; no inline spoiler box)
      const pull1Btn = e.target.closest('#pull-1');
      if (pull1Btn) {
        if (this.selectedGTab === 'box1') {
          this.executeAction('gacha_pull', { box: 1, count: 1, currency: 'diamonds', banner: this.selectedBanner }, (r) => {
            this.playRunwayForResult(r);
          });
        } else {
          this.executeAction('gacha_pull', { box: 2, count: 1, currency: 'gold' }, (r) => {
            this.playRunwayForResult(r);
          });
        }
        return;
      }

      const pull10Btn = e.target.closest('#pull-10');
      if (pull10Btn) {
        if (this.selectedGTab === 'box1') {
          this.executeAction('gacha_pull', { box: 1, count: 10, currency: 'diamonds', banner: this.selectedBanner }, (r) => {
            this.playRunwayForResult(r);
          });
        } else {
          this.executeAction('gacha_pull', { box: 2, count: 10, currency: 'gold' }, (r) => {
            this.playRunwayForResult(r);
          });
        }
        return;
      }

      const pull10BerriesBtn = e.target.closest('#pull-10-berries');
      if (pull10BerriesBtn) {
        this.executeAction('gacha_pull', { box: 2, count: 10, currency: 'berries' }, (r) => {
          this.playRunwayForResult(r);
        });
        return;
      }

      const pullTicketBtn = e.target.closest('#pull-ticket');
      if (pullTicketBtn) {
        const box = this.selectedGTab === 'box2' ? 2 : 1;
        const payload = { box, count: 1, currency: 'ticket' };
        if (box === 1) payload.banner = this.selectedBanner;
        this.executeAction('gacha_pull', payload, (r) => {
          this.playRunwayForResult(r);
        });
        return;
      }

      // Gacha Shard Shop Exchange
      const buyBtn = e.target.closest('[data-buy]');
      if (buyBtn) {
        const offerId = buyBtn.dataset.buy;
        const offer = SHARD_OFFERS[offerId];
        let pickId;
        if (offer?.pick) {
          const sel = this.el.querySelector(`[data-pick="${offerId}"]`);
          pickId = sel ? sel.value : this.selectedPicks[offerId];
          if (!pickId) {
            this.toast('Please select an item from the dropdown first!');
            return;
          }
        }
        this.executeAction('shard_exchange', { offerId, pickId }, () => {
          this.toast(`🌟 Exchanged for ${offer.name}!`);
        });
        return;
      }

      // Forge Item Selection
      const forgeItemBtn = e.target.closest('[data-forge-item]');
      if (forgeItemBtn) {
        this.selectedForgeItem = forgeItemBtn.dataset.forgeItem;
        this.lastForgeResult = null;
        this.render();
        return;
      }

      // Forge Berries Checkbox
      if (e.target.id === 'forge-berries' || e.target.closest('#forge-berries')) {
        const cb = e.target.id === 'forge-berries' ? e.target : e.target.closest('#forge-berries');
        this.forgeBerries = cb.checked;
        this.render();
        return;
      }

      // Forge Scroll Checkbox
      if (e.target.id === 'forge-scroll' || e.target.closest('#forge-scroll')) {
        const cb = e.target.id === 'forge-scroll' ? e.target : e.target.closest('#forge-scroll');
        this.forgeScroll = cb.checked;
        this.render();
        return;
      }

      // Forge Action
      const forgeGoBtn = e.target.closest('#forge-go');
      if (forgeGoBtn) {
        if (!this.selectedForgeItem) {
          this.toast('Please select an item to forge!');
          return;
        }
        const it = this.profile.inventory?.[this.selectedForgeItem];
        const refine = it ? (it.refine | 0) : 0;
        const ownedScrolls = this.profile.bag_items?.[FORGE.SCROLL_ITEM] | 0;
        const canUseScroll = Boolean(this.forgeScroll && scrollAllowed(refine) && ownedScrolls >= 1);
        this.executeAction('blacksmith_forge', {
          itemId: this.selectedForgeItem,
          useBerries: this.forgeBerries,
          useScroll: canUseScroll,
        }, (r) => {
          this.lastForgeResult = r;
          if (r.success) {
            this.toast(r.sovereign ? '★10 SOVEREIGN UNLOCKED!' : `🎉 FORGE SUCCESS! +${r.newStar}`);
          } else {
            this.toast(`🛡️ Protected! Artisan Pity is now ${r.pity}/8 (+${r.pityPct}%)`);
          }
        });
        return;
      }

      // Pet Sanctuary V2 Handlers (Evolve, Lock, Reroll, Infuse, Release, Visual Tier, Rename, Pat, Gift)
      if (bindPetSanctuaryClick(this, e)) {
        return;
      }

      // Pets List Selection
      const petBtn = e.target.closest('[data-pet]');
      if (petBtn) {
        this.selectedPetUid = petBtn.dataset.pet;
        this.confirmingPetRelease = false;
        this.petPreviewEmote = null;
        this.lastPetResult = null;
        this.render();
        return;
      }

      // Pet Trait Slot Selection
      const traitSlotBtn = e.target.closest('[data-trait-slot]');
      if (traitSlotBtn) {
        this.selectedTraitSlot = Number(traitSlotBtn.dataset.traitSlot);
        this.render();
        return;
      }

      // Pet Feed
      const petFeedBtn = e.target.closest('#pet-feed');
      if (petFeedBtn) {
        const pet = this.resolveActivePet();
        if (!pet) return;
        this.executeAction('pet_feed', { petUid: pet.uid, petId: pet.id }, (r) => {
          this.toast(`🍓 Fed ${PETS[pet.id]?.name || 'pet'}! Mood: ${r.mood}/100, Lv: ${r.level}`);
        });
        return;
      }

      // Pet Reroll Trait
      const petRerollBtn = e.target.closest('#pet-reroll');
      if (petRerollBtn) {
        const pet = this.resolveActivePet();
        if (!pet) return;
        this.executeAction('pet_reroll_trait', { petUid: pet.uid, petId: pet.id, slotIdx: this.selectedTraitSlot }, (r) => {
          const tName = TRAITS[r.trait]?.name || r.trait;
          this.toast(`🎲 Rerolled! Got ${tName}!`);
        });
        return;
      }

      // Pet Couple Breed
      const petBreedBtn = e.target.closest('#pet-breed');
      if (petBreedBtn) {
        const pet = this.resolveActivePet();
        if (!pet) return;
        this.executeAction('pet_breed_couple', { myPetUid: pet.uid, petId: pet.id }, (r) => {
          this.lastPetResult = r;
          const hName = PETS[r.hatched?.id]?.name || r.hatched?.id;
          this.toast(`🐣 Hatched ${hName} with ${TRAITS[r.trait]?.name || r.trait}!`);
        });
        return;
      }

      // Live Paper-Doll Stage Controls (Rotate View / Toggle Walk)
      if (e.target.closest('[data-pd-turn]')) {
        cyclePaperDollView();
        this.render();
        return;
      }
      if (e.target.closest('[data-pd-walk]')) {
        togglePaperDollWalk();
        this.render();
        return;
      }

      // --- Step 3.5: Fluffé's Hair Studio Handlers ---
      const hsecBtn = e.target.closest('[data-hsec]');
      if (hsecBtn) {
        this.selectedHairSection = hsecBtn.dataset.hsec;
        this.render();
        return;
      }

      const hairEquipBtn = e.target.closest('[data-hair-equip]');
      if (hairEquipBtn) {
        const hairId = hairEquipBtn.dataset.hairEquip;
        const hDef = HAIRSTYLES[hairId];
        const payload = { hairId };
        if (hDef?.tier === 'celestial' && hDef.defaultColor && (this.profile.unlocked_hair_colors || []).includes(hDef.defaultColor)) {
          payload.colorId = hDef.defaultColor;
        }
        this.executeAction('hair_equip', payload, () => {
          this.toast(`💇 Equipped ${hDef?.name || hairId}!`);
        });
        return;
      }

      const colorEquipBtn = e.target.closest('[data-color-equip]');
      if (colorEquipBtn) {
        const colorId = colorEquipBtn.dataset.colorEquip;
        const cDef = HAIR_COLORS[colorId];
        this.executeAction('hair_equip', { colorId }, () => {
          this.toast(`🎨 Dyed hair to ${cDef?.name || colorId} (Free Closet Switch)!`);
        });
        return;
      }

      const bodyEquipBtn = e.target.closest('[data-body-equip]');
      if (bodyEquipBtn) {
        const body = bodyEquipBtn.dataset.bodyEquip;
        this.executeAction('hair_equip', { body }, () => {
          this.toast(`✨ Switched base avatar to ${body === 'girl' ? 'Starlight Girl' : 'Starlight Boy'}!`);
        });
        return;
      }

      const hairBuyBtn = e.target.closest('[data-hair-buy]');
      if (hairBuyBtn) {
        const hairId = hairBuyBtn.dataset.hairBuy;
        const hDef = HAIRSTYLES[hairId];
        this.executeAction('hair_classic_buy', { hairId }, () => {
          this.toast(`✂️ Purchased & equipped ${hDef?.name || hairId}!`);
        });
        return;
      }

      const colorUnlockBtn = e.target.closest('[data-color-unlock]');
      if (colorUnlockBtn) {
        const colorId = colorUnlockBtn.dataset.colorUnlock;
        const cDef = HAIR_COLORS[colorId];
        this.executeAction('hair_dye_unlock', { colorId }, () => {
          this.toast(`🎨 Permanently unlocked ${cDef?.name || colorId} Dye!`);
        });
        return;
      }

      if (e.target.closest('#hair-pull-1')) {
        this.executeAction('hair_gacha_pull', { count: 1, currency: 'diamonds' }, (r) => {
          this.lastHairPullResult = r;
          const cel = r.items?.find((it) => it.tier === 'celestial');
          this.toast(cel ? `✨👑 CELESTIAL MIRACLE! Pulled ${cel.name}!` : `👑 Pulled ${r.items?.[0]?.name || 'Royal Hair'}!`);
        });
        return;
      }

      if (e.target.closest('#hair-pull-10')) {
        this.executeAction('hair_gacha_pull', { count: 10, currency: 'diamonds' }, (r) => {
          this.lastHairPullResult = r;
          const cel = r.items?.find((it) => it.tier === 'celestial');
          this.toast(cel ? `✨👑 CELESTIAL MIRACLE in 10x Salon Pull: ${cel.name}!` : '👑✨ 10x Royal Salon Pull Complete!');
        });
        return;
      }

      if (e.target.closest('#hair-pull-ticket')) {
        this.executeAction('hair_gacha_pull', { count: 1, currency: 'ticket' }, (r) => {
          this.lastHairPullResult = r;
          const cel = r.items?.find((it) => it.tier === 'celestial');
          this.toast(cel ? `✨👑 CELESTIAL MIRACLE! Pulled ${cel.name}!` : `🎟️ Coupon Pull: ${r.items?.[0]?.name || 'Royal Hair'}!`);
        });
        return;
      }
    });

    this.el.addEventListener('change', (e) => {
      if (e.target.id === 'forge-berries') {
        this.forgeBerries = e.target.checked;
        this.render();
      } else if (e.target.id === 'forge-scroll') {
        this.forgeScroll = e.target.checked;
        this.render();
      } else if (e.target.id === 'pet-confirm-mythic') {
        this.confirmMythicWipe = e.target.checked;
        this.render();
      } else if (e.target.id === 'pet-costume-select') {
        this.previewPetCostumeId = e.target.value;
        this.render();
      } else if (e.target.id === 'gacha-featured-wish') {
        const outfitId = e.target.value;
        if (outfitId && SEASON_OUTFITS.includes(outfitId)) {
          this.gachaPreviewKey = null;
          this.executeAction('gacha_set_featured', { outfitId }, () => {
            this.toast(`🌟 Rate-Up Wish set to ${OUTFITS[outfitId]?.name || outfitId}! (50% of ★3 Mythic drops)`);
          });
        }
      } else if (e.target.id === 'owl-to') {
        this.giftToRecipient = e.target.value;
        const isPartner = Boolean(this.profile?.partner_id && e.target.value === this.profile.partner_id);
        const amtEl = this.el?.querySelector('#owl-postage-amount');
        const hintEl = this.el?.querySelector('#owl-postage-hint');
        if (amtEl) amtEl.textContent = isPartner ? '25' : '50';
        if (hintEl) hintEl.textContent = isPartner ? '50% Couple Discount!' : 'Standard Owl Delivery';
      } else if (e.target.id === 'owl-slot1') {
        this.owlSlot1Val = e.target.value;
        this.render();
      } else if (e.target.id === 'owl-slot2') {
        this.owlSlot2Val = e.target.value;
        this.render();
      } else if (e.target.dataset.pick) {
        this.selectedPicks[e.target.dataset.pick] = e.target.value;
        this.render();
      }
    });

    this.el.addEventListener('input', (e) => {
      if (e.target.id === 'owl-note') {
        this.owlNoteText = e.target.value;
      }
    });
  }

  resolveActivePet() {
    const p = this.profile;
    const pets = normalizePetsList(p.pets);
    if (!pets.length) return null;
    const eqUid = p.equipped?.pet?.uid || p.equipped?.pet?.id;
    return pets.find((x) => x.uid === this.selectedPetUid || x.id === this.selectedPetUid)
      || (eqUid && pets.find((x) => x.uid === eqUid || x.id === eqUid))
      || pets[0];
  }

  render() {
    if (!this.el || !this.currentView) return;

    const p = this.profile;
    const view = this.currentView;

    const prevBodyEl = this.el.querySelector('#rpg-body');
    const prevPoolEl = this.el.querySelector('#gacha-pool-grid');
    const prevBodyScroll = prevBodyEl ? prevBodyEl.scrollTop : 0;
    const prevPoolScroll = prevPoolEl ? prevPoolEl.scrollTop : 0;

    const gold = p.gold || 0;
    const berries = p.berries || 0;
    const diamonds = p.diamonds || 0;
    const shards = p.shards || 0;
    const isForgeReady = forgeReady(p);
    const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
    const eqOut = p.equipped?.outfit?.id || (typeof p.equipped?.outfit === 'string' ? p.equipped.outfit : null);
    const avaSpr = eqOut && eqOut !== 'newbie_outfit' ? `${lineage}_${eqOut}_front` : `${lineage}_base_front`;
    const isGirl = p.appearance?.body === 'girl' || (!p.appearance?.body && lineage === 'dxb');
    const hairId = p.appearance?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');

    let bodyHtml = '';
    if (view === 'wardrobe') bodyHtml = this.renderWardrobe(p);
    else if (view === 'gacha') bodyHtml = this.renderGacha(p);
    else if (view === 'forge') bodyHtml = this.renderForge(p);
    else if (view === 'pets') bodyHtml = this.renderPets(p);

    this.el.innerHTML = `
      <div class="rpg-backdrop"></div>
      <div class="rpg-panel parchment s2-view-${view}">
        <header class="rpg-header-bar">
          <div class="rpg-header-strip">
            <div class="rpg-player-mini">
              <div class="rpg-player-ava">
                ${renderOutfitThumbLayers(eqOut || 'newbie_outfit', { lineage, appearance: p.appearance, headCrop: true })}
              </div>
              <div class="rpg-player-txt">
                <b>${escapeHtml(p.username || 'Player')}</b>
                <small>Lv.${p.level || 1}</small>
              </div>
            </div>

            <div class="rpg-currencies">
              <div class="rpg-curr-item" title="Gold">
                <img src="/assets/ui/icon_gold.png" alt="Gold" /><span>${fmtNum(gold)}</span>
              </div>
              <div class="rpg-curr-item" title="Star-Berries">
                <img src="/assets/ui/icon_berry.png" alt="Berries" /><span>${fmtNum(berries)}</span>
              </div>
              <div class="rpg-curr-item" title="Diamonds">
                <img src="/assets/ui/icon_diamond.png" alt="Diamonds" /><span>${fmtNum(diamonds)}</span>
              </div>
              <div class="rpg-curr-item" title="Starlight Shards">
                <img src="/assets/ui/icon_shard.png" alt="Shards" /><span>${fmtNum(shards)}</span>
              </div>
            </div>

            <button id="rpg-close" class="rpg-x-btn" aria-label="Close">✕</button>
          </div>

          <nav class="rpg-top-bar">
            <button class="rpg-view-tab ${view === 'wardrobe' ? 'active' : ''}" data-view="wardrobe">
              <span class="ico">👗</span><span>Wardrobe</span>
            </button>
            <button class="rpg-view-tab ${view === 'gacha' ? 'active' : ''}" data-view="gacha">
              <span class="ico">🗽</span><span>Gacha</span>
            </button>
            <button class="rpg-view-tab ${view === 'forge' ? 'active' : ''}" data-view="forge" title="[🔨 Blacksmith +10]">
              <span class="ico">🔨</span><span>Forge</span>${isForgeReady ? '<span class="rpg-red-dot"></span>' : ''}
            </button>
            <button class="rpg-view-tab ${view === 'pets' ? 'active' : ''}" data-view="pets">
              <span class="ico">🐾</span><span>Pets</span>
            </button>
          </nav>
        </header>

        <div id="rpg-body" class="rpg-body">
          ${bodyHtml}
        </div>
      </div>
    `;

    for (const [offerId, pickId] of Object.entries(this.selectedPicks)) {
      const sel = this.el.querySelector(`[data-pick="${offerId}"]`);
      if (sel && pickId) sel.value = pickId;
    }

    if (prevBodyScroll > 0) {
      const nextBodyEl = this.el.querySelector('#rpg-body');
      if (nextBodyEl) nextBodyEl.scrollTop = prevBodyScroll;
    }
    if (prevPoolScroll > 0) {
      const nextPoolEl = this.el.querySelector('#gacha-pool-grid');
      if (nextPoolEl) nextPoolEl.scrollTop = prevPoolScroll;
    }

    if (view === 'wardrobe' && (this.selectedWTab === 'fashion' || this.selectedWTab === 'accessories' || this.selectedWTab === 'hair')) {
      mountLivePaperDollStage(this.el, p);
    } else {
      stopWardrobePreview();
    }
  }

  // ---------------------------------------------------------------------------------------------
  // VIEW 1: WARDROBE (Screens 07 & 08 + Step 3.5 Fluffé's Hair Studio)
  // ---------------------------------------------------------------------------------------------
  renderWardrobe(p) {
    const wtab = this.selectedWTab || 'fashion';
    const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
    const equipped = p.equipped || {};
    const inv = p.inventory || {};

    const tabsHtml = `
      <div class="rpg-sub-tabs s2-folder-tabs">
        <button class="rpg-sub-tab ${wtab === 'fashion' || wtab === 'accessories' ? 'active' : ''}" data-wtab="fashion">👗 Fashion</button>
        <button class="rpg-sub-tab ${wtab === 'hair' ? 'active' : ''}" data-wtab="hair">💇‍♀️ Hair</button>
        <button class="rpg-sub-tab ${wtab === 'pets' ? 'active' : ''}" data-wtab="pets">🐾 Pets</button>
        <button class="rpg-sub-tab ${wtab === 'bag' ? 'active' : ''}" data-wtab="bag">🎒 Bag &amp; VIP</button>
      </div>
    `;

    if (wtab === 'hair') {
      return this.renderHairStudio(p, tabsHtml);
    }

    if (wtab === 'fashion' || wtab === 'accessories') {
      const curSlot = this.selectedSlot;
      const ownedEntries = Object.entries(inv).filter(([id]) => itemSlot(id) === curSlot);
      const isUnequippable = curSlot !== 'outfit';

      // Slot filter pills for quick switching inside Closet Drawer (incl. 3D Dice Skins)
      const slotPillsHtml = [...SLOTS, 'dice'].map((s) => `
        <button class="s2-slot-pill ${curSlot === s ? 'active' : ''}" data-slot="${s}">
          ${SLOT_LABELS[s]}
        </button>
      `).join('');

      const itemsGridHtml = ownedEntries.length ? ownedEntries.map(([id, itemData]) => {
        const def = itemDef(id);
        const name = def?.name || id;
        const rarity = def?.rarity || 1;
        const refine = itemData.refine | 0;
        const dupes = itemData.dupes | 0;
        const isCurEquipped = equipped[curSlot]?.id === id;
        const cpVal = Math.round(slotCP(curSlot, id, refine));
        const outfitSk = curSlot === 'outfit' ? skillFor(id, rarity) : null;
        const skillPillHtml = outfitSk ? `
          <div class="rpg-closet-skill-pill">
            ${escapeHtml(outfitSk.icon || '⚡')} <b>${escapeHtml(outfitSk.name)}:</b> ${escapeHtml(outfitSk.desc || '')}
          </div>
        ` : '';

        return `
          <div class="rpg-item-card s2-closet-card rpg-rarity-${rarity} ${isCurEquipped ? 'equipped' : ''}" data-equip="${id}">
            ${renderIconThumb(id, { lineage, appearance: p.appearance, size: 58, refine, stars: rarity, badgeText: dupes > 0 ? `x${dupes}` : null })}
            <div class="s2-closet-meta">
              <div class="rpg-item-name">${escapeHtml(name)}</div>
              <div class="s2-closet-sub">
                <span class="rpg-stars">${'★'.repeat(rarity)}</span>
                <span class="s2-cp-mini">+${cpVal} CP</span>
              </div>
              ${skillPillHtml}
              <div class="s2-closet-actions">
                ${isCurEquipped
                  ? '<span class="rpg-equipped-badge">✓ EQUIPPED</span>'
                  : '<button class="rpg-equip-btn">Equip</button>'}
                <button class="rpg-goforge-btn" data-goforge="${id}" title="[🔨 Blacksmith +10]">🔨${forgeReady(p) ? '<span class="rpg-red-dot"></span>' : ''}</button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="s2-empty-notice">
          No owned items for ${SLOT_LABELS[curSlot]} yet. Summon in Goddess Gacha!
        </div>
      `;

      return `
        ${tabsHtml}
        <div class="s2-avatar-parchment-card">
          ${renderPaperDollHeroStage(p, curSlot, this.petPreviewPose)}
          ${renderCostumeSkillCard(equipped.outfit?.id)}
          ${renderStatGrid(p)}

          <div class="s2-wardrobe-candy-row">
            <button type="button" class="s2-candy-btn s2-candy-pink" data-wtab="bag">
              <span>🎁 Send Gift</span>
            </button>
            <button type="button" class="s2-candy-btn s2-candy-gold" data-wtab="hair">
              <span>💇‍♀️ Hair Studio</span>
            </button>
            <button type="button" class="s2-candy-btn s2-candy-blue" data-toggle-closet-drawer="1">
              <span>🗂️ ${this.closetDrawerOpen ? 'Hide Closet' : `Closet (${ownedEntries.length})`}</span>
            </button>
            <button type="button" class="s2-candy-btn s2-candy-amber" data-view="forge" title="[🔨 Blacksmith +10]">
              <span>🔨 Forge +10</span>${forgeReady(p) ? '<span class="rpg-red-dot"></span>' : ''}
            </button>
          </div>
        </div>

        <div class="s2-closet-drawer ${this.closetDrawerOpen ? 'is-open' : ''}">
          <div class="s2-drawer-backdrop" data-closet-close="1"></div>
          <div class="rpg-card rpg-inventory-panel s2-sheet-card">
            <div class="rpg-inventory-head">
              <span class="rpg-card-title">👗 Closet: ${SLOT_LABELS[curSlot]} (${ownedEntries.length})</span>
              <div class="s2-drawer-head-actions">
                ${isUnequippable ? `
                  <button class="rpg-unequip-btn btn-gold small" data-unequip="${curSlot}" style="width:auto;padding:4px 10px;margin:0;" ${equipped[curSlot]?.id ? '' : 'disabled'}>
                    Unequip ${SLOT_LABELS[curSlot]}
                  </button>
                ` : ''}
                <button type="button" class="s2-drawer-close-btn" data-closet-close="1" title="Close Closet Drawer">✕</button>
              </div>
            </div>
            <div class="s2-slot-pills-bar">${slotPillsHtml}</div>
            <div class="rpg-items-grid">
              ${itemsGridHtml}
            </div>
          </div>
        </div>
      `;
    }

    if (wtab === 'pets') {
      return `
        ${tabsHtml}
        ${renderPetSanctuary(this, p)}
      `;
    }

    if (wtab === 'bag') {
      const bag = p.bag_items || {};
      const ticketKey = HAIR_TIERS.royal.price?.ticket || 'ticket_royal_hair';
      const pinnedKeys = new Set([BOX1.TICKET, BOX2.TICKET, ticketKey, SHARD_OFFERS.vip_communicator?.bag].filter(Boolean));
      const allKeys = [...new Set([...Object.keys(BAG_ITEM_CATALOG), ...Object.keys(bag)])];
      const entries = allKeys
        .map((k) => [k, bag[k] | 0])
        .filter(([k, cnt]) => cnt > 0 || pinnedKeys.has(k));

      // VIP Cards (Mockup 08 & 25: 4 ornate calling card passes)
      const vip = p.vip || {};
      const vipCards = [
        {
          key: 'call_day_pass',
          tag: '24H SKY PASS',
          title: 'Sky Call Day-Pass',
          desc: '24h Unlimited 1-on-1 Calls',
          price: 300,
          ownedCount: bag['vip_call_day_pass'] | 0,
          activeBadge: vip.call_until > Date.now() ? `Active (${Math.max(1, Math.round((vip.call_until - Date.now()) / 3600000))}h)` : null,
          colorClass: 's2-vip-blue',
          icon: '/assets/ui/item_ticket_standard.png',
        },
        {
          key: 'vip_communicator',
          tag: 'PERMANENT DEVICE',
          title: 'VIP Communicator',
          desc: 'Permanent Free Calls',
          price: 2500,
          ownedCount: bag['vip_communicator'] | 0,
          activeBadge: vip.communicator ? 'Owned ✅' : null,
          colorClass: 's2-vip-purple',
          icon: '/assets/ui/item_vip_communicator.png',
        },
        {
          key: 'telelink_box',
          tag: 'COUPLE DUAL-UNLOCK',
          title: 'Tele-Link Couple Box',
          desc: 'Unlocks Both Partners Forever!',
          price: 4500,
          ownedCount: bag['vip_telelink_box'] | 0,
          activeBadge: (vip.telelinks || []).length ? `Active (${vip.telelinks.length})` : null,
          colorClass: 's2-vip-gold',
          icon: '/assets/ui/vip_card_telelink.png',
        },
        {
          key: 'black_vip',
          tag: 'SOVEREIGN TIER',
          title: 'Sovereign Black VIP',
          desc: 'All Friends Free + +30💎/15m',
          price: 9900,
          ownedCount: bag['vip_black'] | 0,
          activeBadge: vip.black ? 'Black VIP 👑' : null,
          colorClass: 's2-vip-crimson',
          icon: '/assets/ui/vip_card_black_sovereign.png',
        },
      ];

      const vipCardsHtml = `
        <div class="s2-vip-showcase-row">
          ${vipCards.map((vc) => `
            <div class="s2-vip-card ${vc.colorClass}" data-vip-card="${vc.key}">
              <div class="s2-vip-card-tag">${escapeHtml(vc.tag)}</div>
              <div class="s2-vip-card-art">
                <img src="${vc.icon}" alt="${escapeHtml(vc.title)}" />
              </div>
              <div class="s2-vip-card-title">${escapeHtml(vc.title)}</div>
              <div class="s2-vip-card-desc">${escapeHtml(vc.desc)}</div>
              <div class="s2-vip-card-price">
                <img src="/assets/ui/icon_diamond.png" alt="💎" class="s2-vip-gem-ico" />
                <span>${vc.price.toLocaleString()}</span>
              </div>
              <div class="s2-vip-card-actions">
                <button type="button" class="btn-gold small" data-act="vip-buy" data-vip-card="${vc.key}">🛒 Buy</button>
                <button type="button" class="btn-gold small outline" data-act="vip-gift" data-vip-card="${vc.key}">🎁 Gift</button>
                ${vc.ownedCount > 0 ? `<button type="button" class="btn-gold small active" data-act="vip-use" data-vip-card="${vc.key}">✨ Use (x${vc.ownedCount})</button>` : ''}
              </div>
              ${vc.activeBadge ? `<span class="s2-vip-badge active">${vc.activeBadge}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Bag items shelf (Mockup 08: compact recessed shelf of square painted item tiles)
      const bagItemsHtml = entries.map(([key, count]) => {
        const meta = BAG_ITEM_CATALOG[key] || {
          name: key.replace(/_/g, ' '),
          desc: 'Special Royal Bag Item',
          url: '/assets/ui/item_gift_box.png',
          rarity: 2,
        };
        const isHairTicket = key === ticketKey;
        return `
          <div class="rpg-bag-item rpg-rarity-${meta.rarity || 2}" title="${escapeHtml(meta.desc || meta.name)}">
            <div class="rpg-bag-thumb-wrap">
              ${renderIconThumb(key, { lineage, size: 46, stars: meta.rarity || 2 })}
              <div class="rpg-bag-count">${count > 0 ? `x${count}` : '0'}</div>
            </div>
            <div class="rpg-bag-meta">
              <div class="rpg-bag-title">${escapeHtml(meta.name)}</div>
              <div class="rpg-bag-desc">${escapeHtml(meta.desc)}</div>
            </div>
            ${isHairTicket ? `<button class="rpg-equip-btn rpg-bag-studio-btn" data-wtab="hair" title="Open Fluffé's Hair Studio">💇 Studio</button>` : ''}
          </div>
        `;
      }).join('');

      // Daily Passport Card + 7-Stamp Starlight Track (Mockup 08 & 25)
      const pass = p.passport || {};
      const passProg = pass.progress || {};
      const passClaimed = pass.claimed || {};
      const curStamps = pass.stamps || 0;
      const allQuestsDone = !!(passClaimed.play && passClaimed.harvest && passClaimed.pet);

      const stampSlotsHtml = [1, 2, 3, 4, 5, 6, 7].map((dayIdx) => {
        const filled = curStamps >= dayIdx;
        const isGrand = dayIdx === 7;
        return `
          <div class="passport-stamp-slot ${filled ? 'is-filled' : ''} ${isGrand ? 'is-grand' : ''}">
            <div class="passport-stamp-seal">${filled ? '⭐' : (isGrand ? '🎟️' : dayIdx)}</div>
            <span class="passport-stamp-lbl">${isGrand ? 'Day 7 🎟️' : `Day ${dayIdx}`}</span>
          </div>
        `;
      }).join('');

      const passportCardHtml = `
        <div class="rpg-card s2-passport-card" id="passport-card">
          <div class="rpg-card-title">📜 Daily Starlight Passport &amp; Couple Streak</div>
          <div class="passport-summary-bar">
            <span class="passport-streak">💖 Couple Streak: <b>${p.couple_streak || 0} Days</b> <small>(+15% Yield)</small></span>
            <span class="passport-stamps">📜 Stamps: <b>${curStamps}/7</b> <small>(7/7 = Free Summon Ticket 🎟️!)</small></span>
          </div>
          <div class="passport-stamp-track" aria-label="7-Day Starlight Stamp Track">
            <div class="passport-stamp-row">
              ${stampSlotsHtml}
            </div>
            <div class="passport-stamp-reward-pill">
              <img src="/assets/ui/item_ticket_standard.png" alt="" />
              <span>7/7 Stamps = <b>Free Summon Ticket 🎟️!</b></span>
            </div>
          </div>
          <div class="passport-quests-list">
            <div class="passport-quest-row">
              <div class="quest-info">
                <span class="quest-name">🎮 Play 1 Match</span>
                <span class="quest-prog">(${passProg.play || 0}/1)</span>
                <span class="quest-reward-pill">💎 +25</span>
              </div>
              <button type="button" class="btn-gold small passport-claim-btn" data-act="passport-claim" data-quest="play" ${passClaimed.play || (passProg.play || 0) < 1 ? 'disabled' : ''}>
                ${passClaimed.play ? 'Claimed ✅' : 'Claim 25 💎'}
              </button>
            </div>
            <div class="passport-quest-row">
              <div class="quest-info">
                <span class="quest-name">🌾 Village Harvest</span>
                <span class="quest-prog">(${passProg.harvest || 0}/1)</span>
                <span class="quest-reward-pill">💎 +40</span>
              </div>
              <button type="button" class="btn-gold small passport-claim-btn" data-act="passport-claim" data-quest="harvest" ${passClaimed.harvest || (passProg.harvest || 0) < 1 ? 'disabled' : ''}>
                ${passClaimed.harvest ? 'Claimed ✅' : 'Claim 40 💎'}
              </button>
            </div>
            <div class="passport-quest-row">
              <div class="quest-info">
                <span class="quest-name">🐾 Pet Interaction</span>
                <span class="quest-prog">(${passProg.pet || 0}/3)</span>
                <span class="quest-reward-pill">💎 +25</span>
              </div>
              <button type="button" class="btn-gold small passport-claim-btn" data-act="passport-claim" data-quest="pet" ${passClaimed.pet || (passProg.pet || 0) < 3 ? 'disabled' : ''}>
                ${passClaimed.pet ? 'Claimed ✅' : 'Claim 25 💎'}
              </button>
            </div>
            <div class="passport-quest-row bonus">
              <div class="quest-info">
                <span class="quest-name">✨ All 3 Daily Quests Bonus</span>
                <span class="quest-prog">${allQuestsDone ? 'Complete!' : 'Pending Quests'}</span>
                <span class="quest-reward-pill gold">💎 +30 + ⭐ Stamp</span>
              </div>
              <button type="button" class="btn-gold small passport-claim-btn" data-act="passport-claim" data-quest="bonus" ${passClaimed.bonus || !allQuestsDone ? 'disabled' : ''}>
                ${passClaimed.bonus ? 'Bonus Claimed ✅' : 'Claim 30 💎 + 1 Stamp'}
              </button>
            </div>
          </div>
        </div>
      `;

      // Gear & Decor for Slot 1 (Mockup 08: Carved Wood-Parchment Slot Bars with live item icon & status badge)
      const inventory = p.inventory || {};
      const eq = p.equipped || {};
      const eqIds = new Set(Object.values(eq).map((item) => (typeof item === 'object' ? item?.id : item)).filter(Boolean));
      const slot1Catalog = [];
      for (const [itemId, invItem] of Object.entries(inventory)) {
        const def = itemDef(itemId) || { name: itemId };
        const dupes = invItem.dupes | 0;
        const refine = invItem.refine | 0;
        const rarity = def.rarity || 1;
        const slot = itemSlot(itemId);
        const vis = resolveItemVisual(itemId, lineage);
        const slotLbl = SLOT_LABELS[slot] || 'Gear';
        if (dupes >= 1) {
          slot1Catalog.push({
            value: `gear:dupe:${itemId}`,
            itemId,
            slot,
            refine: 0,
            rarity,
            sortScore: rarity * 10 + 5,
            label: `${def.name} (${slotLbl} • 1x Dupe Copy)`,
            iconUrl: vis?.url || '/assets/ui/item_gift_box.png',
            filter: vis?.filter || 'none',
            badgeText: '✨ 1x Dupe Copy (+0 Refine) • Keeps Yours Safe!',
            badgeKind: 'gold',
          });
        } else if (!eqIds.has(itemId)) {
          slot1Catalog.push({
            value: `gear:transfer:${itemId}`,
            itemId,
            slot,
            refine,
            rarity,
            sortScore: refine * 100 + rarity * 10,
            label: `+${refine} ${def.name} (${slotLbl})`,
            iconUrl: vis?.url || '/assets/ui/item_gift_box.png',
            filter: vis?.filter || 'none',
            badgeText: `✓ +${refine} Upgrade Level Preserved!`,
            badgeKind: 'green',
          });
        }
      }
      slot1Catalog.sort((a, b) => (b.sortScore || 0) - (a.sortScore || 0));

      const decorMap = p.village?.decor || {};
      for (const [decId, cnt] of Object.entries(decorMap)) {
        if (cnt > 0) {
          const dName = DECOR[decId]?.name || decId;
          slot1Catalog.push({
            value: `decor:${decId}`,
            itemId: null,
            slot: 'decor',
            sortScore: 1,
            label: `${dName} (Village Decor x${cnt})`,
            iconUrl: `/assets/village/${decId}.png`,
            filter: 'none',
            badgeText: '🏡 Village Decor Parcel Ready!',
            badgeKind: 'green',
          });
        }
      }

      // Slot 2 Bag Items & Star-Berries
      const slot2Catalog = [
        {
          value: 'berries:200',
          label: '200x Star-Berries (Daily Berry Allowance)',
          iconUrl: '/assets/ui/icon_berry.png',
          badgeText: '🍓 Instant Star-Berry Gift Parcel!',
          badgeKind: 'gold',
        },
        {
          value: 'berries:100',
          label: '100x Star-Berries (Sweet Berry Pouch)',
          iconUrl: '/assets/ui/icon_berry.png',
          badgeText: '🍓 Instant Star-Berry Gift Parcel!',
          badgeKind: 'gold',
        },
        {
          value: 'berries:50',
          label: '50x Star-Berries (Starter Berry Basket)',
          iconUrl: '/assets/ui/icon_berry.png',
          badgeText: '🍓 Instant Star-Berry Gift Parcel!',
          badgeKind: 'gold',
        },
      ];
      const giftableBagKeys = ['streak_freeze', 'vip_call_day_pass', 'vip_communicator', 'vip_telelink_box', 'vip_black'];
      for (const k of giftableBagKeys) {
        if ((bag[k] | 0) > 0) {
          const meta = BAG_ITEM_CATALOG[k] || { name: k.replace(/_/g, ' '), url: '/assets/ui/vip_card_telelink.png' };
          slot2Catalog.push({
            value: `bag:${k}`,
            label: `${meta.name} (x${bag[k]})`,
            iconUrl: meta.url || '/assets/ui/vip_card_telelink.png',
            badgeText: '💎 Instant VIP & Bag Gift Parcel!',
            badgeKind: 'green',
          });
        }
      }

      if (this.owlSlot1Val === undefined) {
        this.owlSlot1Val = slot1Catalog[0]?.value || '';
      }
      if (this.owlSlot2Val === undefined) {
        const preferredBag = slot2Catalog.find((x) => x.value.startsWith('bag:'));
        this.owlSlot2Val = preferredBag ? preferredBag.value : 'berries:200';
      }

      const activeSlot1 = slot1Catalog.find((x) => x.value === this.owlSlot1Val) || {
        value: '',
        itemId: null,
        slot: null,
        iconUrl: '/assets/ui/item_gift_box.png',
        filter: 'none',
        badgeText: '✓ +Refine Upgrade Level Preserved!',
        badgeKind: 'green',
      };
      const activeSlot1ThumbHtml = (activeSlot1.slot === 'outfit' && activeSlot1.itemId)
        ? renderOutfitThumbLayers(activeSlot1.itemId, { lineage, appearance: p.appearance })
        : `<img src="${activeSlot1.iconUrl}" style="filter:${activeSlot1.filter || 'none'}" alt="" />`;

      const activeSlot2 = slot2Catalog.find((x) => x.value === this.owlSlot2Val) || {
        value: '',
        iconUrl: '/assets/ui/icon_berry.png',
        badgeText: '🍓 Attach Star-Berries or VIP Pass!',
        badgeKind: 'gold',
      };

      // Recipient options
      const partnerId = p.partner_id;
      const partnerName = p.partner_name || (partnerId ? `Partner (${partnerId})` : null);
      const friendsList = p.friends || [];
      const selectedRecipient = this.giftToRecipient || partnerId || friendsList[0] || '';
      const isRecipientPartner = Boolean(partnerId && selectedRecipient === partnerId);
      const defaultPostage = isRecipientPartner ? 25 : 50;
      const curRibbon = this.selectedGiftRibbon || 'pink';
      const curNoteText = this.owlNoteText !== undefined ? this.owlNoteText : 'Happy Anniversary my love! ✨';

      // Upgraded Owl Gift Wrapper (Mockup 08 1:1: Carved Wood-Parchment Slot Bars, Custom Pill Select, Note Box & Centered Gold Button)
      const owlWrapperHtml = `
        <div class="rpg-card s2-owl-gift-card">
          <img class="s2-owl-mascot" src="/assets/ui/npc_royal_owl.png" alt="Royal Messenger Owl" />
          <div class="s2-owl-head">
            <img src="/assets/ui/item_gift_box.png" alt="" class="s2-owl-gift-ico" />
            <span>WRAP &amp; SEND GIFT TO PARTNER / FRIEND</span>
          </div>
          <div class="s2-owl-sub">
            <label for="owl-to" class="s2-owl-to-lbl">To:</label>
            <div class="s2-owl-to-pill">
              <select id="owl-to" class="rpg-select s2-owl-to-select">
                ${partnerId ? `<option value="${partnerId}" ${selectedRecipient === partnerId ? 'selected' : ''}>💕 ${escapeHtml(partnerName)} (Bound Partner) • 💌 Free Love-Note!</option>` : ''}
                ${friendsList.map((f) => `<option value="${f}" ${selectedRecipient === f ? 'selected' : ''}>👤 Friend: ${escapeHtml(f)}</option>`).join('')}
                ${!partnerId && !friendsList.length ? '<option value="" disabled selected>No partner or friends available</option>' : ''}
              </select>
              <span class="s2-owl-select-caret" aria-hidden="true">▾</span>
            </div>
          </div>

          <div class="s2-owl-slots-heading">2 Gift Attachment Slots:</div>
          <div class="s2-owl-slots">
            <div class="s2-owl-slot-bar">
              <div class="s2-owl-slot-num">1</div>
              <div class="s2-owl-slot-thumb">
                ${activeSlot1ThumbHtml}
              </div>
              <div class="s2-owl-slot-body">
                <div class="s2-owl-slot-select-wrap">
                  <select id="owl-slot1" class="rpg-select s2-owl-slot-select" aria-label="Slot 1 (Gear or Decor)">
                    <option value="" ${!activeSlot1.value ? 'selected' : ''}>— Empty Slot 1 (Select Unequipped Gear or Decor) —</option>
                    ${slot1Catalog.map((opt) => `<option value="${opt.value}" ${activeSlot1.value === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                  </select>
                  <span class="s2-owl-select-caret" aria-hidden="true">▾</span>
                </div>
                <div class="s2-owl-slot-subrow">
                  <span class="s2-owl-slot-tag">[Slot 1: Gear / Decor]</span>
                  <span class="s2-owl-slot-badge is-${activeSlot1.badgeKind}">${escapeHtml(activeSlot1.badgeText)}</span>
                </div>
              </div>
            </div>

            <div class="s2-owl-slot-bar">
              <div class="s2-owl-slot-num">2</div>
              <div class="s2-owl-slot-thumb">
                <img src="${activeSlot2.iconUrl}" alt="" />
              </div>
              <div class="s2-owl-slot-body">
                <div class="s2-owl-slot-select-wrap">
                  <select id="owl-slot2" class="rpg-select s2-owl-slot-select" aria-label="Slot 2 (Bag Item or Star-Berries)">
                    <option value="" ${!activeSlot2.value ? 'selected' : ''}>— Empty Slot 2 (Select Star-Berries or VIP Item) —</option>
                    ${slot2Catalog.map((opt) => `<option value="${opt.value}" ${activeSlot2.value === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                  </select>
                  <span class="s2-owl-select-caret" aria-hidden="true">▾</span>
                </div>
                <div class="s2-owl-slot-subrow">
                  <span class="s2-owl-slot-tag">[Slot 2: Bag / Berries ≤200]</span>
                  <span class="s2-owl-slot-badge is-${activeSlot2.badgeKind}">${escapeHtml(activeSlot2.badgeText)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="s2-owl-note-row">
            <div class="s2-owl-note-box-wrap">
              <label for="owl-note" class="s2-owl-note-lbl">💌 Note:</label>
              <input type="text" id="owl-note" maxlength="80" class="rpg-input s2-owl-note-input" value="${escapeHtml(curNoteText)}" placeholder="Write a sweet note for recipient (max 80 chars)..." />
            </div>
            <div class="s2-owl-meta-bar">
              <div class="s2-owl-ribbon-group">
                <span class="s2-owl-meta-lbl">Ribbon:</span>
                <div class="s2-owl-ribbon-pills">
                  <button type="button" class="s2-ribbon-pill ${curRibbon === 'pink' ? 'active' : ''}" data-ribbon="pink">🎀 Sakura Pink</button>
                  <button type="button" class="s2-ribbon-pill ${curRibbon === 'gold' ? 'active' : ''}" data-ribbon="gold">👑 Royal Gold</button>
                  <button type="button" class="s2-ribbon-pill ${curRibbon === 'sky' ? 'active' : ''}" data-ribbon="sky">🌌 Sky Blue</button>
                  <button type="button" class="s2-ribbon-pill ${curRibbon === 'mint' ? 'active' : ''}" data-ribbon="mint">🍃 Mint Green</button>
                </div>
              </div>
              <div class="s2-owl-postage-preview">
                <span class="s2-owl-stamp-txt">🏷️ 1x Owl Stamp (<img src="/assets/ui/icon_berry.png" alt="🍓" class="s2-inline-berry-ico" /> <b id="owl-postage-amount">${defaultPostage}</b> Berries — <small id="owl-postage-hint">${isRecipientPartner ? '50% Couple Discount!' : 'Standard Owl Delivery'}</small>)</span>
              </div>
            </div>
          </div>

          <div class="s2-owl-footer-row">
            <button type="button" class="btn-gold s2-owl-dispatch-btn" data-act="owl-send">
              📮 Dispatch Royal Owl Gift Now!
            </button>
          </div>
        </div>
      `;

      // Mailbox / Owl Inbox (Mockup 08 & 25: cream-parchment letter cards with UNBOX & CLAIM)
      const mailbox = p.mailbox || [];
      const owlInboxHtml = `
        <div class="rpg-card s2-owl-inbox-card" id="owl-inbox">
          <div class="rpg-card-title s2-inbox-card-title">
            <img src="/assets/ui/th_owl_postbox.png" alt="" class="s2-inbox-title-ico" />
            <span>Royal Owl Inbox (${mailbox.length})</span>
          </div>
          <div class="owl-inbox-list">
            ${mailbox.length ? mailbox.map((m) => `
              <div class="owl-mail-row ribbon-${escapeHtml(m.ribbon || 'pink')}" data-mail-id="${m.id}">
                <div class="owl-mail-ico-wrap">
                  <img src="/assets/ui/item_gift_box.png" alt="Gift Parcel" class="owl-mail-ico" />
                </div>
                <div class="owl-mail-body">
                  <div class="mail-head">
                    <span class="mail-from">From: <b>${escapeHtml(m.fromName || m.from)}</b></span>
                    <span class="mail-ribbon">${m.ribbon ? `🎀 ${escapeHtml(m.ribbon)}` : '🎀 Gift'}</span>
                    <span class="mail-date">${m.sentAt ? new Date(m.sentAt).toLocaleDateString() : ''}</span>
                  </div>
                  ${m.note ? `<div class="mail-note">“${escapeHtml(m.note)}”</div>` : ''}
                  <div class="mail-items">
                    ${(m.items || []).map((it) => `<span class="mail-item-chip">${it.kind === 'berries' ? `🍓 ${it.amount} Berries` : (it.kind === 'diamonds' ? `💎 ${it.amount} Diamonds` : (it.kind === 'gear' ? `⚔️ ${escapeHtml(itemDef(it.itemId)?.name || it.itemId)}${it.refine ? ` +${it.refine}` : ''}` : (it.kind === 'decor' ? `🏡 ${escapeHtml(DECOR[it.decId]?.name || it.decId)}` : `📦 ${escapeHtml(it.key || it.kind)}`)))}</span>`).join(' ')}
                  </div>
                </div>
                <div class="mail-action">
                  ${m.claimed ? '<span class="s2-badge-green">Claimed ✅</span>' : `<button type="button" class="btn-gold small owl-claim-btn" data-act="owl-claim" data-mail-id="${m.id}">🎁 UNBOX &amp; CLAIM</button>`}
                </div>
              </div>
            `).join('') : '<div class="owl-inbox-empty">No letters or gifts in your Royal Owl Inbox yet 🦉</div>'}
          </div>
        </div>
      `;

      // Founder Unbox Modal (Mockup 18: Hero banner with Royal Owl + Super Trunk + Dressed Chibi with floating 'Sky Party Founder' badge)
      const eqOutfitRaw = p.equipped?.outfit;
      const eqOutfitId = (typeof eqOutfitRaw === 'object' ? eqOutfitRaw?.id : eqOutfitRaw) || 'season1_royal_court';
      const founderChibiHtml = renderOutfitThumbLayers(eqOutfitId, {
        lineage,
        appearance: p.appearance,
        alt: p.username || 'Founder',
      });

      const founderModalHtml = `
        <div id="founder-modal" class="modal-wrap founder-modal" ${this.founderModalOpen ? '' : 'hidden'}>
          <section class="parchment founder-card">
            <div class="parchment-title">WELCOME HOME, SKY PARTY V1 VETERAN!</div>
            <button type="button" class="x-btn" data-act="close-founder">✕</button>
            <div class="founder-subtitle">Claim your Permanent Founder's Heritage Rewards</div>

            <div class="founder-hero-stage">
              <div class="founder-hero-col owl">
                <img src="/assets/ui/npc_royal_owl.png" alt="Royal Messenger Owl" class="founder-hero-owl" />
                <span class="founder-hero-caption">🦉 Royal Courier</span>
              </div>
              <div class="founder-hero-col trunk">
                <img src="/assets/monopoly/gacha_trunk_super.png" alt="Founder's Heritage Chest" class="founder-hero-trunk" />
                <span class="founder-hero-caption">✨ Heritage Trunk</span>
              </div>
              <div class="founder-hero-col founder-col-chibi">
                <div class="founder-floating-title">👑 Sky Party Founder</div>
                <div class="founder-hero-chibi">
                  ${founderChibiHtml}
                </div>
              </div>
            </div>

            <div class="founder-rewards-grid">
              <div class="founder-tile">
                <div class="founder-tile-ico"><img src="/assets/ui/ui_ribbon_gold_title.png" alt="Title" /></div>
                <div class="founder-tile-lbl">TITLE</div>
                <div class="founder-tile-desc">'Sky Party Founder'</div>
              </div>
              <div class="founder-tile">
                <div class="founder-tile-ico"><img src="/assets/ui/icon_diamond.png" alt="Diamonds" /></div>
                <div class="founder-tile-lbl">1,000</div>
                <div class="founder-tile-desc">Diamonds</div>
              </div>
              <div class="founder-tile">
                <div class="founder-tile-ico"><img src="/assets/ui/item_dupe_box.png" alt="Mythic Box" /></div>
                <div class="founder-tile-lbl">MYTHIC</div>
                <div class="founder-tile-desc">Outfit Selector Box</div>
              </div>
              <div class="founder-tile">
                <div class="founder-tile-ico"><img src="/assets/ui/icon_pet_essence.png" alt="Star Essence" /></div>
                <div class="founder-tile-lbl">40</div>
                <div class="founder-tile-desc">Star Essence</div>
              </div>
            </div>
            <div class="founder-code-row">
              <label for="founder-code">Secret Founder Code (optional):</label>
              <input type="text" id="founder-code" class="rpg-input" placeholder="e.g. SKYPARTY-V1" />
            </div>
            <div class="founder-actions">
              <button type="button" class="btn-gold founder-claim-btn" data-act="founder-claim" ${p.founder_claimed ? 'disabled' : ''}>
                ${p.founder_claimed ? 'Founder Pack Claimed ✅' : 'CLAIM FOUNDER\'S PACK &amp; EQUIP TITLE!'}
              </button>
            </div>
          </section>
        </div>
      `;

      return `
        ${tabsHtml}
        <div class="s2-avatar-parchment-card s2-bag-parchment-card">
          <div class="s2-gold-ribbon-banner">
            <span>🎒 ROYAL BAG, TICKETS &amp; PARTNER GIFTING</span>
            <button type="button" class="btn-gold small founder-banner-btn" data-act="open-founder">🏛️ Founder Unbox</button>
          </div>
          ${vipCardsHtml}

          <div class="rpg-card s2-bag-grid-card">
            <div class="rpg-card-title">🗂️ Bag Inventory, Scrolls &amp; Tokens</div>
            <div class="rpg-bag-list">
              ${bagItemsHtml}
            </div>
          </div>

          ${passportCardHtml}
          ${owlWrapperHtml}
          ${owlInboxHtml}
          ${founderModalHtml}
        </div>
      `;
    }

    return tabsHtml;
  }

  // ---------------------------------------------------------------------------------------------
  // STEP 3.5: FLUFFÉ'S STARLIGHT HAIR STUDIO (20 Hairstyles + 20 Permanent Dyes + Royal/Celestial Gacha)
  // ---------------------------------------------------------------------------------------------
  renderHairStudio(p, tabsHtml) {
    const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
    const eq = p.equipped || {};
    const app = p.appearance || {};
    const curBody = app.body === 'girl' || (!app.body && lineage === 'dxb') ? 'girl' : 'boy';
    const curHairId = app.hair && HAIRSTYLES[app.hair]
      ? app.hair
      : (curBody === 'girl' ? 'hair_girl_waves' : 'hair_boy_fluffy');
    const curColorId = app.hairColor && HAIR_COLORS[app.hairColor]
      ? app.hairColor
      : (lineage === 'dxb' ? 'coral' : 'silver');

    const ownedHairs = new Set(Array.isArray(p.owned_hairs) && p.owned_hairs.length
      ? p.owned_hairs
      : ['hair_boy_fluffy', 'hair_girl_waves']);
    const unlockedColors = new Set(Array.isArray(p.unlocked_hair_colors) && p.unlocked_hair_colors.length
      ? p.unlocked_hair_colors
      : ['chestnut', 'midnight', 'honey', 'silver']);

    const hsec = this.selectedHairSection || 'closet';
    const ticketKey = HAIR_TIERS.royal.price?.ticket || 'ticket_royal_hair';
    const coupons = p.bag_items?.[ticketKey] | 0;
    const gold = p.gold | 0;
    const diamonds = p.diamonds | 0;
    const royalPity = p.hair_pity?.royal | 0;
    const celestialPity = p.hair_pity?.celestial | 0;
    const classicGoldCost = HAIR_TIERS.classic.price?.gold || 3000;
    const royalDiaCost = HAIR_TIERS.royal.price?.diamonds || 120;

    const allHairs = Object.entries(HAIRSTYLES).map(([id, h]) => ({ id, ...h }));
    const allColors = Object.entries(HAIR_COLORS).map(([id, c]) => ({ id, ...c }));
    const curHairDef = HAIRSTYLES[curHairId] || allHairs[0];
    const curColorDef = HAIR_COLORS[curColorId] || HAIR_COLORS.chestnut;
    const isCelestialEquipped = curHairDef?.tier === 'celestial';
    const stageState = getPaperDollStageState();

    const renderSwatchStyle = (c) => {
      if (!c) return 'background:#8a5a3c;';
      if ((c.tier === 'celestial' || c.celestialMode) && c.hex2 && c.hex3) {
        return `background:linear-gradient(135deg, ${c.hex} 0%, ${c.hex2} 50%, ${c.hex3} 100%);`;
      }
      if ((c.tier === 'ombre' || c.hex2) && c.hex2) {
        return `background:linear-gradient(180deg, ${c.hex} 20%, ${c.hex2} 90%);`;
      }
      return `background:${c.hex};`;
    };

    const renderHairCard = (h, mode = 'closet') => {
      const isOwned = ownedHairs.has(h.id);
      const isEq = curHairId === h.id;
      const tierBadge = h.tier === 'celestial'
        ? '<span class="s2-hair-tier-badge is-celestial">✨ CELESTIAL</span>'
        : h.tier === 'royal'
          ? '<span class="s2-hair-tier-badge is-royal">👑 ROYAL</span>'
          : '<span class="s2-hair-tier-badge is-classic">✂️ CLASSIC</span>';
      const sprUrl = `/assets/chibi/${hairSpriteName(h.id, 'front')}.png`;
      const bundledColorKey = h.defaultColor || h.bundledColor;
      const bundledColor = bundledColorKey ? HAIR_COLORS[bundledColorKey] : null;

      let actionHtml = '';
      if (isEq) {
        actionHtml = '<span class="rpg-equipped-badge">✓ WEARING</span>';
      } else if (isOwned) {
        actionHtml = `<button class="rpg-equip-btn" data-hair-equip="${h.id}">Equip Free</button>`;
      } else if (h.tier === 'classic' && (mode === 'classic' || mode === 'closet')) {
        const canAfford = gold >= classicGoldCost;
        actionHtml = `<button class="rpg-equip-btn s2-hair-buy-btn" data-hair-buy="${h.id}" ${canAfford ? '' : 'disabled'}>🪙 ${fmtNum(classicGoldCost)}</button>`;
      } else {
        actionHtml = `<button class="rpg-equip-btn s2-hair-goto-gacha" data-hsec="gacha">👑 Summon</button>`;
      }

      return `
        <div class="s2-hair-card tier-${h.tier} ${isEq ? 'equipped' : ''} ${isOwned ? 'owned' : 'locked'}"
             ${isOwned && !isEq ? `data-hair-equip="${h.id}"` : ''}>
          <div class="s2-hair-thumb-wrap tier-${h.tier}">
            <img class="s2-hair-thumb" src="${sprUrl}" alt="${escapeHtml(h.name)}" />
            ${isOwned ? '<span class="s2-hair-owned-dot" title="Owned in Closet">✓</span>' : '<span class="s2-hair-lock-dot" title="Locked">🔒</span>'}
          </div>
          <div class="s2-hair-meta">
            <div class="s2-hair-title-row">
              <span class="rpg-item-name">${escapeHtml(h.name)}</span>
            </div>
            <div class="s2-hair-sub-row">
              ${tierBadge}
              ${bundledColor ? `<span class="s2-hair-bundle-tag" title="Unlocks ${escapeHtml(bundledColor.name)}">🎨 +${escapeHtml(bundledColor.name.split(' ')[0])}</span>` : ''}
            </div>
            <div class="s2-hair-desc">${escapeHtml(h.desc || (h.tier === 'celestial' ? 'Animated Prismatic Aura + Gold-Aurora Nameplate' : h.tier === 'royal' ? 'Woven ornaments keep vivid colour when dyed' : 'Classic Salon Cut • Dyeable in 20 colours'))}</div>
            <div class="s2-hair-actions">
              ${actionHtml}
            </div>
          </div>
        </div>
      `;
    };

    let sectionBodyHtml = '';

    if (hsec === 'closet') {
      const ownedList = allHairs.filter((h) => ownedHairs.has(h.id));
      const unlockedColorList = allColors.filter((c) => unlockedColors.has(c.id));
      const quickSwatchesHtml = unlockedColorList.map((c) => `
        <button type="button"
                class="s2-dye-mini-swatch tier-${c.tier} ${curColorId === c.id ? 'active' : ''}"
                data-color-equip="${c.id}"
                title="${escapeHtml(c.name)} (Free Switch)">
          <span class="s2-dye-circle" style="${renderSwatchStyle(c)}"></span>
        </button>
      `).join('');

      sectionBodyHtml = `
        <div class="rpg-card s2-hair-quick-dye-bar">
          <div class="s2-hair-quick-head">
            <span>🎨 Unlocked Dyes (${unlockedColorList.length}/20) — <b>0🪙 Instant Switch</b></span>
            <button type="button" class="rpg-goforge-btn" data-hsec="dyes">Unlock More Dyes ➜</button>
          </div>
          <div class="s2-hair-quick-swatches">
            ${quickSwatchesHtml}
          </div>
        </div>

        <div class="rpg-card">
          <div class="rpg-card-title">
            <span>🗂️ Your Hair Closet (${ownedList.length}/${allHairs.length} Owned)</span>
            <span class="s2-badge-green">0🪙 Free Switch</span>
          </div>
          <div class="s2-hair-grid">
            ${ownedList.map((h) => renderHairCard(h, 'closet')).join('')}
          </div>
        </div>
      `;
    } else if (hsec === 'classic') {
      const classicHairs = allHairs.filter((h) => h.tier === 'classic');
      const ownedClassicCount = classicHairs.filter((h) => ownedHairs.has(h.id)).length;
      sectionBodyHtml = `
        <div class="rpg-card">
          <div class="rpg-card-title">
            <span>✂️ Classic Salon Catalog (${ownedClassicCount}/${classicHairs.length} Owned)</span>
            <span class="s2-badge-gold">🪙 3,000 Gold • Permanent</span>
          </div>
          <div class="s2-hair-section-note">
            Every Classic cut unlocks permanently in your Hair Closet and can be dyed with any of your 20 colours!
          </div>
          <div class="s2-hair-grid">
            ${classicHairs.map((h) => renderHairCard(h, 'classic')).join('')}
          </div>
        </div>
      `;
    } else if (hsec === 'gacha') {
      const celestialHairs = allHairs.filter((h) => h.tier === 'celestial');
      const royalHairs = allHairs.filter((h) => h.tier === 'royal');
      const royalPct = Math.min(100, Math.round((royalPity / HAIR_TIERS.royal.pity) * 100));
      const celestialPct = Math.min(100, Math.round((celestialPity / HAIR_TIERS.celestial.pity) * 100));

      let pullResultHtml = '';
      const pullItems = this.lastHairPullResult?.items || this.lastHairPullResult?.results;
      if (Array.isArray(pullItems) && pullItems.length) {
        const cards = pullItems.map((r) => {
          const h = HAIRSTYLES[r.id];
          if (!h) return '';
          const sprUrl = `/assets/chibi/${hairSpriteName(r.id, 'front')}.png`;
          const bundledDye = r.unlockedColor ? HAIR_COLORS[r.unlockedColor] : null;
          const isNew = r.kind === 'new' || r.isNew;
          const shards = r.shards || r.shardsGranted || 25;
          return `
            <div class="s2-hair-pull-item tier-${r.tier} ${isNew ? 'is-new' : 'is-dupe'}">
              <img src="${sprUrl}" alt="${escapeHtml(h.name)}" />
              <div class="s2-hair-pull-name">${escapeHtml(h.name)}</div>
              <div class="s2-hair-pull-badge">
                ${isNew ? '✨ NEW UNLOCK!' : `DUPE +${shards} 🌟`}
              </div>
              ${bundledDye ? `<div class="s2-hair-pull-bundle">🌈 +${escapeHtml(bundledDye.name)}</div>` : ''}
            </div>
          `;
        }).join('');
        pullResultHtml = `
          <div class="rpg-card s2-hair-pull-results">
            <div class="rpg-card-title">🎉 Latest Royal Salon Reveal!</div>
            <div class="s2-hair-pull-grid">${cards}</div>
          </div>
        `;
      }

      sectionBodyHtml = `
        <div class="s2-hair-gacha-banner">
          <div class="s2-hair-gacha-head">
            <div class="s2-hair-gacha-title">👑✨ FLUFFÉ'S ROYAL &amp; CELESTIAL GACHA</div>
            <div class="s2-hair-gacha-rates">0.5% ✨ Celestial (150 Pity) • 👑 Royal Guaranteed by Pull 10!</div>
          </div>

          <div class="s2-celestial-showcase">
            ${celestialHairs.map((h) => {
              const sprUrl = `/assets/chibi/${hairSpriteName(h.id, 'front')}.png`;
              const isOwned = ownedHairs.has(h.id);
              const dyeKey = h.defaultColor || h.bundledColor;
              const dye = dyeKey ? HAIR_COLORS[dyeKey] : null;
              return `
                <div class="s2-celestial-spot ${isOwned ? 'owned' : ''}" ${isOwned ? `data-hair-equip="${h.id}"` : ''}>
                  <div class="s2-celestial-halo"></div>
                  <img src="${sprUrl}" alt="${escapeHtml(h.name)}" />
                  <div class="s2-celestial-info">
                    <div class="s2-celestial-tag">✨ CELESTIAL CROWN JEWEL</div>
                    <div class="s2-celestial-name">${escapeHtml(h.name)}</div>
                    <div class="s2-celestial-perk">Includes <b>${escapeHtml(dye?.name || 'Prismatic Dye')}</b> + Gold-Aurora Nameplate!</div>
                    ${isOwned
                      ? (curHairId === h.id ? '<span class="rpg-equipped-badge">✓ WEARING</span>' : `<button class="rpg-equip-btn" data-hair-equip="${h.id}">Equip Free</button>`)
                      : '<span class="s2-celestial-rate-pill">150-Pull Hard Pity</span>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="s2-hair-pity-grid">
            <div class="rpg-pity-wrap">
              <div class="rpg-pity-bar s2-pity-royal">
                <div class="rpg-pity-fill" style="width:${royalPct}%"></div>
                <span class="rpg-pity-text">👑 Royal Guarantee: ${royalPity} / ${HAIR_TIERS.royal.pity}</span>
              </div>
            </div>
            <div class="rpg-pity-wrap">
              <div class="rpg-pity-bar s2-pity-celestial">
                <div class="rpg-pity-fill" style="width:${celestialPct}%"></div>
                <span class="rpg-pity-text">✨ Celestial Pity: ${celestialPity} / ${HAIR_TIERS.celestial.pity}</span>
              </div>
            </div>
          </div>

          <div class="s2-hair-pull-actions">
            <button type="button" id="hair-pull-ticket" class="btn-gold s2-pull-btn ticket" ${coupons > 0 ? '' : 'disabled'}>
              <span>🎟️ Use Coupon</span>
              <small>Royal Coupon (x${coupons})</small>
            </button>
            <button type="button" id="hair-pull-1" class="btn-gold s2-pull-btn one" ${diamonds >= royalDiaCost ? '' : 'disabled'}>
              <span>✂️ 1x Royal Cut</span>
              <small>💎 ${royalDiaCost} Diamonds</small>
            </button>
            <button type="button" id="hair-pull-10" class="btn-gold s2-pull-btn ten" ${diamonds >= royalDiaCost * 10 ? '' : 'disabled'}>
              <span>👑 10x Royal Cut</span>
              <small>💎 ${fmtNum(royalDiaCost * 10)} (Guaranteed 👑!)</small>
            </button>
          </div>
        </div>

        ${pullResultHtml}

        <div class="rpg-card">
          <div class="rpg-card-title">
            <span>👑 Royal &amp; ✨ Celestial Lineup (${[...celestialHairs, ...royalHairs].filter((h) => ownedHairs.has(h.id)).length}/8 Owned)</span>
            <span class="s2-badge-gold">Ornaments Keep Vivid Colour!</span>
          </div>
          <div class="s2-hair-grid">
            ${[...celestialHairs, ...royalHairs].map((h) => renderHairCard(h, 'gacha')).join('')}
          </div>
        </div>
      `;
    } else if (hsec === 'dyes') {
      const renderDyeTierGroup = (tierKey, title, badgeHtml, subtitle) => {
        const colors = allColors.filter((c) => c.tier === tierKey);
        const ownedCount = colors.filter((c) => unlockedColors.has(c.id)).length;
        const cardsHtml = colors.map((c) => {
          const isUnlocked = unlockedColors.has(c.id);
          const isEq = curColorId === c.id;
          let btnHtml = '';
          if (isEq) {
            btnHtml = '<span class="rpg-equipped-badge">✓ ACTIVE</span>';
          } else if (isUnlocked) {
            btnHtml = `<button type="button" class="rpg-equip-btn" data-color-equip="${c.id}">Apply Free</button>`;
          } else if (tierKey === 'basic') {
            const cost = HAIR_DYE_TIERS.basic.price?.gold || 500;
            btnHtml = `<button type="button" class="rpg-equip-btn" data-color-unlock="${c.id}" ${gold >= cost ? '' : 'disabled'}>🪙 ${fmtNum(cost)}</button>`;
          } else if (tierKey === 'ombre') {
            const cost = HAIR_DYE_TIERS.ombre.price?.diamonds || 50;
            btnHtml = `<button type="button" class="rpg-equip-btn" data-color-unlock="${c.id}" ${diamonds >= cost ? '' : 'disabled'}>💎 ${cost}</button>`;
          } else {
            const reqHair = allHairs.find((h) => h.defaultColor === c.id);
            btnHtml = `<button type="button" class="rpg-equip-btn" data-hsec="gacha" title="Bundled with ${escapeHtml(reqHair?.name || 'Celestial Hair')}">✨ Bundled</button>`;
          }

          return `
            <div class="s2-dye-card tier-${c.tier} ${isEq ? 'equipped' : ''} ${isUnlocked ? 'unlocked' : 'locked'}"
                 ${isUnlocked && !isEq ? `data-color-equip="${c.id}"` : ''}>
              <div class="s2-dye-swatch-lg tier-${c.tier}" style="${renderSwatchStyle(c)}">
                ${isUnlocked ? '<span class="s2-dye-check">✓</span>' : '<span class="s2-dye-lock">🔒</span>'}
              </div>
              <div class="s2-dye-meta">
                <div class="s2-dye-name">${escapeHtml(c.name)}</div>
                <div class="s2-dye-sub">
                  ${c.tier === 'celestial' ? '✨ 3-Stop Prismatic' : c.tier === 'ombre' ? '🌈 Root→Tip Ombre' : '🎨 Solid Salon Tint'}
                </div>
                <div class="s2-dye-action">${btnHtml}</div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="rpg-card s2-dye-group-card">
            <div class="rpg-card-title">
              <span>${title} (${ownedCount}/${colors.length})</span>
              ${badgeHtml}
            </div>
            <div class="s2-hair-section-note">${subtitle}</div>
            <div class="s2-dye-grid">
              ${cardsHtml}
            </div>
          </div>
        `;
      };

      sectionBodyHtml = `
        ${renderDyeTierGroup('celestial', '✨ Celestial Prismatic Dyes', '<span class="s2-badge-gold">Bundled w/ Celestial Hair</span>', 'Animated 3-stop iridescent GPU shader tints — automatically unlocked forever when you pull their matching Celestial Hairstyle!')}
        ${renderDyeTierGroup('ombre', '🌈 Two-Tone Ombre Glow Dyes', '<span class="s2-badge-gold">💎 50 Diamonds • Permanent</span>', 'Smooth vertical root-to-tip UV gradient shader while keeping woven ribbons, pearls, and crowns in their original colours!')}
        ${renderDyeTierGroup('basic', '🎨 Basic Salon Dyes', '<span class="s2-badge-gold">🪙 500 Gold • Permanent</span>', 'Classic salon shades unlocked permanently in your Dye Closet — switch anytime for 0 Gold!')}
        ${renderDyeTierGroup('starter', '🌱 Starter Palette', '<span class="s2-badge-green">FREE • Unlocked</span>', 'Included free for every adventurer from day one.')}
      `;
    }

    return `
      ${tabsHtml}

      <div class="s2-fluffe-header">
        <img class="s2-fluffe-mascot" src="/assets/ui/npc_fluffe_poodle.png" alt="Fluffé the Starlight Poodle" />
        <div class="s2-fluffe-info">
          <div class="s2-fluffe-title">✂️✨ Fluffé's Starlight Hair Studio</div>
          <div class="s2-fluffe-sub">Permanent Hair &amp; Dye Closet • 0🪙 Free Switching!</div>
          <div class="s2-fluffe-bar">
            <div class="s2-body-toggle" title="Switch Mannequin Base (Free)">
              <button type="button" class="s2-body-btn ${curBody === 'boy' ? 'active' : ''}" data-body-equip="boy">👦 Boy Base</button>
              <button type="button" class="s2-body-btn ${curBody === 'girl' ? 'active' : ''}" data-body-equip="girl">👧 Girl Base</button>
            </div>
            <div class="s2-coupon-pill" title="Royal Hair Coupons">
              <img src="/assets/ui/item_ticket_royal_hair.png" alt="Coupon" />
              <span>x${coupons}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="s2-hair-mirror-card">
        <div class="s2-pd-figure s2-hair-stage-fig" id="pd-hero-figure">
          <div class="s2-pd-stage-ctrls">
            <button type="button" class="s2-pd-ctrl-btn" data-pd-turn="1" title="Rotate Character View">
              🔄 ${stageState.view.toUpperCase()}
            </button>
            <button type="button" class="s2-pd-ctrl-btn ${stageState.walking ? 'active' : ''}" data-pd-walk="1" title="Toggle Walk / Idle Motion">
              ${stageState.walking ? '🏃 Walk' : '🧍 Idle'}
            </button>
          </div>
          ${isCelestialEquipped ? `<img class="s2-pd-aura" src="/assets/ui/fx_magic_circle.png" alt="" />` : ''}
          <img class="s2-pd-pedestal" src="/assets/ui/stage_wardrobe_pedestal.png" alt="" />
          ${renderPaperDollDomLayers(lineage, eq, stageState.view, p.appearance)}
          <div class="s2-pd-webgl-host" id="pd-live-canvas-wrap"></div>
        </div>

        <div class="s2-hair-current-strip">
          <div class="s2-hair-current-pill ${isCelestialEquipped ? 'is-celestial-nameplate' : ''}">
            <span>${isCelestialEquipped ? '✨' : curHairDef?.tier === 'royal' ? '👑' : '✂️'} ${escapeHtml(curHairDef?.name || curHairId)}</span>
          </div>
          <div class="s2-hair-current-dye">
            <span class="s2-dye-circle" style="${renderSwatchStyle(curColorDef)}"></span>
            <span>${escapeHtml(curColorDef?.name || curColorId)}</span>
          </div>
        </div>
      </div>

      <div class="s2-slot-pills-bar s2-hair-mode-tabs">
        <button type="button" class="s2-slot-pill ${hsec === 'closet' ? 'active' : ''}" data-hsec="closet">
          🗂️ Closet (${ownedHairs.size}/${allHairs.length})
        </button>
        <button type="button" class="s2-slot-pill ${hsec === 'classic' ? 'active' : ''}" data-hsec="classic">
          ✂️ Classic (3k🪙)
        </button>
        <button type="button" class="s2-slot-pill ${hsec === 'gacha' ? 'active' : ''}" data-hsec="gacha">
          👑✨ Royal Gacha
        </button>
        <button type="button" class="s2-slot-pill ${hsec === 'dyes' ? 'active' : ''}" data-hsec="dyes">
          🎨 Dyes (${unlockedColors.size}/20)
        </button>
      </div>

      ${sectionBodyHtml}
    `;
  }

  // ---------------------------------------------------------------------------------------------
  // VIEW 2: GACHA (Screens 21, 22, 23)
  // ---------------------------------------------------------------------------------------------
  renderGacha(p) {
    const gtab = this.selectedGTab || 'box1';
    const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
    const bag = p.bag_items || {};
    const gachaState = p.gacha || {};

    const tabsHtml = `
      <div class="rpg-sub-tabs s2-folder-tabs">
        <button class="rpg-sub-tab ${gtab === 'box1' ? 'active' : ''}" data-gtab="box1">🗽 Box 1: Fashion</button>
        <button class="rpg-sub-tab ${gtab === 'box2' ? 'active' : ''}" data-gtab="box2">🧭 Box 2: Architect</button>
        <button class="rpg-sub-tab ${gtab === 'shop' ? 'active' : ''}" data-gtab="shop">🌟 Shard Shop</button>
      </div>
    `;

    const resultsHtml = '';

    // ---------------- SCREEN 21: BOX 1 GODDESS FASHION GACHA ----------------
    if (gtab === 'box1') {
      const bannerId = (this.selectedBanner && this.selectedBanner !== 'pets') ? this.selectedBanner : DEFAULT_BANNER;
      const bannerDef = BOX1_BANNERS[bannerId] || BOX1_BANNERS[DEFAULT_BANNER];
      const pity = gachaState[bannerDef.pityKey] | 0;
      const pityMax = BOX1.PITY;
      const smActive = Boolean(bannerDef.superMythic && superMythicEnabled());
      const smPity = gachaState[SUPER_MYTHIC.PITY_KEY] | 0;
      const smMax = SUPER_MYTHIC.HARD_PITY;
      const tickets = bag[BOX1.TICKET] | 0;
      const discountPct = Math.round((1 - BOX1.COST_10 / (BOX1.COST_1 * 10)) * 100);
      const pool = buildGachaPrizePool('box1', bannerId, p);
      const previewEntry = this.gachaPreviewKey ? pool.find((x) => x.key === this.gachaPreviewKey) : null;

      // Sub-banner selector pills (concise labels so nothing truncates)
      const shortBannerNames = {
        season: '🌟 Outfits',
        s1_starlight: '🌟 Outfits',
        relics: '🪽 Relics',
        wings_relics: '🪽 Relics',
        dice: '🎲 3D Dice',
      };
      const bannerPillsHtml = Object.entries(BOX1_BANNERS)
        .filter(([id]) => id !== 'pets')
        .map(([id, b]) => `
        <button class="s2-banner-pill ${bannerId === id ? 'active' : ''}" data-box1-banner="${id}" data-banner="${id}">
          ${escapeHtml(shortBannerNames[id] || b.name)}
        </button>
      `).join('');

      // Drop rate percentages
      const dispRates = smActive ? box1DisplayRates(bannerDef.rates, true) : bannerDef.rates;
      const smVal = dispRates.super_mythic ?? dispRates[SUPER_MYTHIC.RARITY] ?? SUPER_MYTHIC.BASE_RATE;
      const rSm = smActive ? (smVal * 100).toFixed(1) : null;
      const r3 = ((dispRates[3] || 0) * 100).toFixed(smActive ? 1 : 0);
      const r2 = ((dispRates[2] || 0) * 100).toFixed(smActive ? 1 : 0);
      const r1 = ((dispRates[1] || 0) * 100).toFixed(smActive ? 1 : 0);

      // Helper to render dressed Prince & Princess Paper-Doll couple on pedestal
      const ragdollFrontSpr = resolvePetSpriteKey('pet_ragdoll', 3, 'front');
      const nyxFrontSpr = resolvePetSpriteKey('pet_nyx', 3, 'front');
      const renderCouplePedestalHtml = (outfitId, outfitName) => {
        const princeVis = resolveItemVisual(outfitId, 'bkk');
        const princessVis = resolveItemVisual(outfitId, 'dxb');
        const princessEquipped = {
          outfit: { id: outfitId, refine: 10 },
          wings: { id: 'wings_golden_seraphim', refine: 10 },
        };
        const princeEquipped = {
          outfit: { id: outfitId, refine: 10 },
          wings: { id: 'wings_golden_seraphim', refine: 10 },
          hat: { id: 'hat_glowing_bunny', refine: 10 },
        };
        return `
          <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
          <div class="s2-arch-figures s2-dressed-couple-stage">
            <img class="s2-couple-pet left" src="/assets/pets/${ragdollFrontSpr}.png" alt="Ragdoll" />
            <div class="s2-dressed-chibi-wrap left">
              ${renderPaperDollDomLayers('dxb', princessEquipped, 'front', { body: 'girl', hair: 'hair_girl_waves', hairColor: 'honey' })}
              <img class="s2-arch-chibi left" src="${princessVis.url}" style="display:none;${princessVis.filter !== 'none' ? `filter:${princessVis.filter};` : ''}" alt="${escapeHtml(outfitName)} Princess" />
            </div>
            <div class="s2-dressed-chibi-wrap right">
              ${renderPaperDollDomLayers('bkk', princeEquipped, 'front', { body: 'boy', hair: 'hair_boy_fluffy', hairColor: 'midnight' })}
              <img class="s2-arch-chibi right" src="${princeVis.url}" style="display:none;${princeVis.filter !== 'none' ? `filter:${princeVis.filter};` : ''}" alt="${escapeHtml(outfitName)} Prince" />
            </div>
            <img class="s2-couple-pet right" src="/assets/pets/${nyxFrontSpr}.png" alt="Nyx" />
          </div>
        `;
      };

      // Data-driven Stage Header, Diorama, and Featured Banner
      let headerPillText = '';
      let dioramaCenterHtml = '';
      let leftBubblesHtml = '';
      let rightBubblesHtml = '';
      let featuredTitleText = '';
      let featuredNameHtml = '';
      let ratesSubHtml = '';
      let wishSelectorHtml = '';

      if (bannerDef.featured) {
        const activeFeatured = SEASON_OUTFITS.includes(gachaState.featured_outfit)
          ? gachaState.featured_outfit
          : bannerDef.featured;
        const featuredDef = OUTFITS[activeFeatured] || {};
        const featuredName = featuredDef.name || activeFeatured;
        const featuredSeason = featuredDef.season || 11;
        const featuredRatePct = Math.round((bannerDef.featuredShare || 0.5) * 100);
        const cleanFeaturedName = featuredName.replace(/^Season\s*\d+:\s*/i, '');

        headerPillText = `✨ SEASON ${featuredSeason}: ${escapeHtml(cleanFeaturedName.toUpperCase())} (${featuredRatePct}% RATE-UP) ✨`;
        dioramaCenterHtml = renderCouplePedestalHtml(activeFeatured, featuredName);

        const renderShowcaseBubble = (id, customCaption) => {
          if (!id) return '';
          const vis = resolveItemVisual(id, lineage);
          const isSel = previewEntry?.key === id;
          const isOutfitBubble = Boolean(OUTFITS[id]);
          const filterCss = vis.filter && vis.filter !== 'none' ? `style="filter:${vis.filter};"` : '';
          const sphereInnerHtml = isOutfitBubble
            ? renderOutfitThumbLayers(id, { lineage, appearance: p?.appearance, url: vis.url, filter: vis.filter, alt: vis.name })
            : `<img class="s2-bubble-item-img" src="${vis.url}" ${filterCss} alt="${escapeHtml(vis.name)}" />`;
          return `
            <button type="button" class="s2-bubble s2-iridescent-bubble s2-rarity-${vis.rarity || 3} ${isSel ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(id)}" title="Preview ${escapeHtml(vis.name)}">
              <div class="s2-bubble-sphere ${isOutfitBubble ? 'has-hair' : ''}">
                ${sphereInnerHtml}
              </div>
              <span class="s2-bubble-caption">${customCaption || `★${vis.rarity || 3} ${escapeHtml(vis.name)}`}</span>
            </button>
          `;
        };
        leftBubblesHtml = [
          renderShowcaseBubble(activeFeatured, `★★★ Mythic<br/>${escapeHtml(cleanFeaturedName)}`),
          renderShowcaseBubble('boots_hermes_greaves', '★★ Hermes<br/>Winged Boots'),
        ].join('');
        rightBubblesHtml = [
          renderShowcaseBubble('wings_golden_seraphim', '★★★ Seraphim<br/>6-Wings'),
          renderShowcaseBubble('hat_glowing_bunny', '★ Glowing<br/>Bunny Ears'),
        ].join('');

        featuredTitleText = '👑 50% Rate-Up Wish';
        featuredNameHtml = `${escapeHtml(cleanFeaturedName)} (S${featuredSeason})`;
        ratesSubHtml = '<span class="s2-badge-gold">50% of Mythics</span> Active Wish Set • All 13 Seasons in Pool!';
        const wishOpts = SEASON_OUTFITS.map((k) => {
          const o = OUTFITS[k] || {};
          return `<option value="${k}" ${activeFeatured === k ? 'selected' : ''}>S${o.season || '?'}: ${escapeHtml(o.name || k)}</option>`;
        }).join('');
        wishSelectorHtml = `
          <div class="s2-wish-selector-bar">
            <span>🌟 Rate-Up Wish:</span>
            <select id="gacha-featured-wish" class="rpg-select">
              ${wishOpts}
            </select>
          </div>
        `;
      } else if (bannerId === 'dice') {
        headerPillText = '🎲 LUCKY 3D DICE BANNER • 2× RATE-UP ON MYTHIC DICE';
        const heroDiceId = (bannerDef.rateUp && bannerDef.rateUp[0]) || 'dice_zeus_thunder';
        const heroDiceVis = resolveItemVisual(heroDiceId, lineage);
        dioramaCenterHtml = `
          <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
          <img class="s2-wonder-hero" src="${heroDiceVis.url}" alt="${escapeHtml(heroDiceVis.name)}" />
        `;
        const renderDiceBubble = (id) => {
          const vis = resolveItemVisual(id, lineage);
          const isSel = previewEntry?.key === id;
          return `
            <button type="button" class="s2-bubble s2-iridescent-bubble s2-rarity-${vis.rarity || 3} ${isSel ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(id)}" title="Preview ${escapeHtml(vis.name)}">
              <div class="s2-bubble-sphere">
                <img class="s2-bubble-item-img" src="${vis.url}" alt="${escapeHtml(vis.name)}" />
              </div>
              <span class="s2-bubble-caption">★${vis.rarity || 3} ${escapeHtml(vis.name)}</span>
            </button>
          `;
        };
        const diceHighlightIds = ['dice_zeus_thunder', 'dice_glacial_crystal', 'dice_astral_galaxy', 'dice_kitsune_foxfire'];
        leftBubblesHtml = diceHighlightIds.slice(0, 2).map(renderDiceBubble).join('');
        rightBubblesHtml = diceHighlightIds.slice(2, 4).map(renderDiceBubble).join('');
        const diceRateUpIds = (bannerDef.rateUp && bannerDef.rateUp.length)
          ? bannerDef.rateUp
          : (bannerDef.pool?.[3] || MYTHIC_DICE);
        featuredTitleText = '🎲 Featured ★3 Mythic 3D Dice';
        featuredNameHtml = diceRateUpIds.map((id) => `<span class="s2-badge-gold">★3</span> ${escapeHtml(DICE_SKINS[id]?.name || id)}`).join(' • ');
        ratesSubHtml = `<span class="s2-badge-gold">2× rate-up</span> Mythic 3D Dice (+Start Gold, Toll &amp; Casino Luck!)`;
      } else if (bannerDef.rateUp) {
        headerPillText = '🪽 WINGS &amp; RELICS BANNER • 2× RATE-UP ON FEATURED RELICS';
        const rateUpHeroVis = resolveItemVisual(bannerDef.rateUp[0] || 'wings_golden_seraphim', lineage);
        dioramaCenterHtml = `
          <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
          <img class="s2-wonder-hero" src="${rateUpHeroVis.url}" alt="${escapeHtml(rateUpHeroVis.name)}" />
        `;
        const renderRelicBubble = (id) => {
          const vis = resolveItemVisual(id, lineage);
          const slot = ACCESSORIES[id]?.slot;
          const isSel = previewEntry?.key === id;
          return `
            <button type="button" class="s2-bubble s2-iridescent-bubble s2-rarity-${vis.rarity || 3} ${isSel ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(id)}" title="Preview ${escapeHtml(vis.name)}">
              <div class="s2-bubble-sphere">
                <img class="s2-bubble-item-img" src="${vis.url}" alt="${escapeHtml(vis.name)}" />
              </div>
              <span class="s2-bubble-caption">★${vis.rarity || 3} ${escapeHtml(ACCESSORIES[id]?.name || SLOT_LABELS[slot] || 'Relic')}</span>
            </button>
          `;
        };
        leftBubblesHtml = bannerDef.rateUp.slice(0, 2).map(renderRelicBubble).join('');
        rightBubblesHtml = bannerDef.rateUp.slice(2, 4).map(renderRelicBubble).join('');
        featuredTitleText = '🪽 2× Rate-Up Relics';
        featuredNameHtml = bannerDef.rateUp.map((id) => `<span class="s2-badge-gold">2×</span> ${escapeHtml(ACCESSORIES[id]?.name || id)}`).join(' • ');
        ratesSubHtml = `<span class="s2-badge-gold">2× rate-up</span> ${bannerDef.rateUp.map((id) => escapeHtml(ACCESSORIES[id]?.name || id)).join(' • ')}`;
      } else if (bannerDef.kind === 'pet') {
        headerPillText = '🐾 SOUL-BOND COMPANIONS • ★3 CELESTIAL TO ★1 HATCHLING';
        dioramaCenterHtml = `
          <img class="s2-wonder-hero" src="/assets/pets/egg_couple_v2.png" alt="Pet Egg" style="max-height:92px;margin-left:0;object-fit:contain;" />
        `;
        const mythicPets = Object.keys(PETS);
        const renderPetBubble = (id) => {
          const pDef = PET_CATALOG_V2[id] || PETS[id] || {};
          const sprKey = resolvePetSpriteKey(id, 3, 'front');
          const shortLabel = (pDef.name || id).replace(', the Midnight Drake', '').replace('Princess ', '').replace('Baby ', '');
          const pKey = `${id}:3`;
          const isSel = previewEntry?.key === pKey;
          return `
            <button type="button" class="s2-bubble s2-iridescent-bubble s2-rarity-3 ${isSel ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(pKey)}" title="Preview ★3 ${escapeHtml(pDef.name || id)}">
              <div class="s2-bubble-sphere">
                <img class="s2-bubble-item-img" src="/assets/pets/${sprKey}.png" alt="${escapeHtml(pDef.name || id)}" />
              </div>
              <span class="s2-bubble-caption">★3 ${escapeHtml(shortLabel)}</span>
            </button>
          `;
        };
        leftBubblesHtml = mythicPets.slice(0, 2).map(renderPetBubble).join('');
        rightBubblesHtml = mythicPets.slice(2, 4).map(renderPetBubble).join('');
        featuredTitleText = '🐾 Soul-Bond Sanctuary';
        featuredNameHtml = 'Princess Ragdoll • Nyx • Sakura Kitsune • Sky Whale';
        ratesSubHtml = '🐾 Pull any Companion at ★3 Celestial (3%), ★2 Awakened (15%), or ★1 Hatchling (82%)';
      }

      if (previewEntry) {
        headerPillText = `🔍 PREVIEWING PRIZE • <button type="button" class="s2-stage-reset-inline" data-gacha-preview-reset="1">↺ Back to Banner</button>`;
        featuredTitleText = previewEntry.stageTitle;
        featuredNameHtml = previewEntry.stageSub;
        if (previewEntry.kind === 'outfit') {
          dioramaCenterHtml = renderCouplePedestalHtml(previewEntry.id, previewEntry.name);
        } else if (previewEntry.kind === 'pet') {
          dioramaCenterHtml = `
            <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
            <img class="s2-wonder-hero ${previewEntry.stars >= 3 ? 'pet-v2-shimmer' : ''}" src="${previewEntry.url}" alt="${escapeHtml(previewEntry.name)}" style="max-height:110px;margin-left:0;transform:scale(${previewEntry.uiScale || 1});" />
          `;
        } else {
          const filterStyle = previewEntry.filter && previewEntry.filter !== 'none' ? `filter:${previewEntry.filter};` : '';
          dioramaCenterHtml = `
            <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
            <img class="s2-wonder-hero" src="${previewEntry.url}" style="max-height:114px;margin-left:0;${filterStyle}" alt="${escapeHtml(previewEntry.name)}" />
          `;
        }
      }

      const stageOutfitId = previewEntry?.kind === 'outfit'
        ? previewEntry.id
        : (!previewEntry && bannerDef.featured
          ? (SEASON_OUTFITS.includes(gachaState.featured_outfit) ? gachaState.featured_outfit : bannerDef.featured)
          : null);
      const stageOutfitSkillHtml = stageOutfitId ? renderCostumeSkillCard(stageOutfitId, previewEntry?.rarity) : '';
      const stageSkillDef = stageOutfitId ? SEASON_SKILLS[stageOutfitId] : null;

      return `
        ${tabsHtml}
        ${resultsHtml}

        <div class="s2-gacha-stage s2-stage-box1 ${previewEntry ? 'is-previewing' : ''}">
          <div class="s2-stage-top-bar">
            <div class="s2-banner-pills-bar">
              ${bannerPillsHtml}
            </div>
            <button type="button" class="s2-stage-pool-btn" data-toggle-pool-drawer="1">
              🔍 ${this.poolDrawerOpen ? 'Hide Pool' : 'Pool &amp; Wish 🌟'}
            </button>
          </div>

          <div class="s2-stage-header-pill">${headerPillText}</div>

          <div class="s2-gacha-diorama">
            <div class="s2-float-bubbles s2-bubbles-left">
              ${leftBubblesHtml}
            </div>

            <div class="s2-stage-centerpiece">
              ${dioramaCenterHtml}
            </div>

            <div class="s2-float-bubbles s2-bubbles-right">
              ${rightBubblesHtml}
            </div>
          </div>

          <div class="rpg-featured-banner s2-stage-footer-pill">
            <span class="rpg-featured-title">${featuredTitleText}:</span>
            <span class="rpg-featured-name">${featuredNameHtml}</span>
            ${stageSkillDef ? `<span class="s2-stage-ult-chip">⚡ ${escapeHtml(stageSkillDef.name)}</span>` : ''}
          </div>
        </div>

        <div class="s2-pool-drawer ${this.poolDrawerOpen ? 'is-open' : ''}">
          <div class="s2-drawer-backdrop" data-pool-close="1"></div>
          <div class="rpg-card s2-pool-drawer-card">
            <div class="s2-drawer-head">
              <span class="rpg-card-title">🌟 Active Wish, Drop Rates &amp; Full Prize Pool</span>
              <button type="button" class="s2-drawer-close-btn" data-pool-close="1">✕</button>
            </div>
            ${wishSelectorHtml}
            ${stageOutfitSkillHtml}
            <div class="rpg-rates-box" id="rpg-rates">
              <div class="rpg-rates-pcts">
                ${rSm != null ? `<span class="super-mythic" style="color:#d946ef;font-weight:900;display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_super.png" style="width:20px;height:20px;object-fit:contain;" alt="" />✦ Super: ${rSm}%</span>` : ''}
                <span class="mythic" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_mythic.png" style="width:20px;height:20px;object-fit:contain;" alt="" />★3 Mythic: ${r3}%</span>
                <span class="epic" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_epic.png" style="width:20px;height:20px;object-fit:contain;" alt="" />★2 Epic: ${r2}%</span>
                <span class="rare" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_rare.png" style="width:20px;height:20px;object-fit:contain;" alt="" />★1 Rare: ${r1}%</span>
              </div>
              <div class="rpg-rates-sub">${ratesSubHtml}</div>
            </div>
            ${renderGachaPrizePoolHtml(pool, previewEntry?.key || null, p)}
          </div>
        </div>

        <div class="s2-box1-pity-callout-row">
          <div class="rpg-card s2-pity-scroll s2-box1-pity-card">
            <div class="rpg-pity-wrap">
              <div id="rpg-pity" class="rpg-pity-bar s2-pity-rainbow" data-pity="${pity}" data-max="${pityMax}">
                <div class="rpg-pity-fill" style="width: ${Math.min(100, (pity / pityMax) * 100)}%;"></div>
                <span class="rpg-pity-text">🌈 ★3 Mythic Pity: ${pity} / ${pityMax} Pulls</span>
              </div>
            </div>
            ${smActive ? `
            <div class="rpg-pity-wrap" style="margin-top:4px;">
              <div id="rpg-sm-pity" class="rpg-pity-bar s2-pity-celestial" data-pity="${smPity}" data-max="${smMax}">
                <div class="rpg-pity-fill" style="width: ${Math.min(100, (smPity / smMax) * 100)}%;"></div>
                <span class="rpg-pity-text">✦ Super Mythic Pity: ${smPity} / ${smMax} (Soft ${SUPER_MYTHIC.SOFT_PITY_START})</span>
              </div>
            </div>` : ''}
          </div>

          <div class="s2-dupe-speech-callout">
            <span>✨ Duplicates Auto-Convert to <b>★2 / ★3 Star-Up Shards!</b></span>
          </div>
        </div>

        <div class="rpg-gacha-buttons">
          <div class="rpg-gacha-btn-row">
            <button id="pull-1" class="btn-gold s2-btn-blue s2-candy-summon-1" ${p.diamonds < BOX1.COST_1 ? 'disabled' : ''}>
              <span>🪄 1x SUMMON</span>
              <small>(<img src="/assets/ui/icon_diamond.png" class="s2-inline-ico" alt="" /> ${BOX1.COST_1} / 🎟️ 1)</small>
            </button>
            <button id="pull-10" class="btn-gold s2-btn-rainbow s2-candy-summon-10" ${p.diamonds < BOX1.COST_10 ? 'disabled' : ''}>
              <span>🌈 10x SUMMON</span>
              <small>— GUARANTEED EPIC+! (<img src="/assets/ui/icon_diamond.png" class="s2-inline-ico" alt="" /> ${BOX1.COST_10.toLocaleString()} • ${discountPct}% OFF!)</small>
            </button>
          </div>
          <button id="pull-ticket" class="btn-gold small s2-ticket-bar-btn" ${tickets < 1 ? 'disabled' : ''}>
            <img src="${BAG_ITEM_CATALOG[BOX1.TICKET]?.url || '/assets/ui/item_ticket_standard.png'}" class="s2-inline-ico" alt="" />
            1x Free Ticket Summon <small>(${tickets} ${escapeHtml(BAG_ITEM_CATALOG[BOX1.TICKET]?.name || 'Standard Tickets')} Owned)</small>
          </button>
        </div>
      `;
    }

    // ---------------- SCREEN 22: BOX 2 ROYAL ARCHITECT GACHA ----------------
    if (gtab === 'box2') {
      const pity = gachaState.box2_pity | 0;
      const pityMax = BOX2.PITY;
      const pityPct = Math.min(100, Math.round((pity / pityMax) * 100));
      const tickets = bag[BOX2.TICKET] | 0;
      const vil = p.village || {};
      const levels = vil.levels || {};
      const bps = vil.blueprints || {};
      const pool = buildGachaPrizePool('box2', null, p);
      const previewEntry = this.gachaPreviewKey ? pool.find((x) => x.key === this.gachaPreviewKey) : null;

      const featuredWonderId = VIP_WONDERS[0] || Object.keys(WONDERS)[0];
      const featuredWonder = WONDERS[featuredWonderId] || {};
      const featuredWonderVis = resolveItemVisual(featuredWonderId, lineage);
      const epicWonderId = (BOX2_POOL[2] && BOX2_POOL[2][0]) || 'wnd_onsen';
      const epicWonder = WONDERS[epicWonderId] || {};
      const epicWonderVis = resolveItemVisual(epicWonderId, lineage);
      const bp1Key = `bp_${CORE_LANDMARKS[0] || 'mint'}`;
      const bp2Key = `bp_${CORE_LANDMARKS[2] || 'patisserie'}`;
      const bp1Vis = resolveItemVisual(bp1Key, lineage);
      const bp2Vis = resolveItemVisual(bp2Key, lineage);
      const decor1Id = (BOX2_POOL.decor && BOX2_POOL.decor[0]) || Object.keys(DECOR)[0];
      const decor1Vis = resolveItemVisual(decor1Id, lineage);

      const bpCardsHtml = CORE_LANDMARKS.map((key) => {
        const c = CORE[key];
        const lv = levels[key] || 1;
        const curBp = bps[key] | 0;
        const needBp = BLUEPRINT_CARDS[lv] || BLUEPRINT_CARDS[BLUEPRINT_CARDS.length - 1] || 50;
        const ready = lv < 10 && curBp >= needBp;
        return `
          <div class="s2-bp-mini ${ready ? 'ready' : ''}">
            <img src="/assets/village/${c.sprite}.png" alt="${escapeHtml(c.name)}" />
            <div class="s2-bp-mini-meta">
              <b>${escapeHtml(c.name.split(' ').slice(-1)[0])} Lv.${lv}</b>
              <span>${lv >= 10 ? 'MAX' : `${curBp}/${needBp} Cards`}</span>
              ${ready ? '<em class="s2-bp-upgrade-pill">Upgrade!</em>' : ''}
            </div>
          </div>
        `;
      }).join('');

      const heroUrl = previewEntry ? previewEntry.url : featuredWonderVis.url;
      const heroAlt = previewEntry ? previewEntry.name : (featuredWonder.name || 'Wonder');
      const box2HeaderHtml = previewEntry
        ? `🔍 PREVIEWING PRIZE • <button type="button" class="s2-stage-reset-inline" data-gacha-preview-reset="1">↺ Back to Banner</button>`
        : `🧭 ROYAL ARCHITECT'S BLUEPRINT &amp; WONDER GACHA`;
      const box2TitleHtml = previewEntry
        ? previewEntry.stageTitle
        : `🎡 ${'★'.repeat(featuredWonder.rarity || 3)} ${escapeHtml(featuredWonder.name || 'Couple Heart Ferris Wheel')}`;
      const box2SubHtml = previewEntry
        ? previewEntry.stageSub
        : `+25% Couple Gold &amp; Berry Yield!`;

      return `
        ${tabsHtml}
        ${resultsHtml}

        <div class="s2-gacha-stage s2-stage-box2 ${previewEntry ? 'is-previewing' : ''}">
          <div class="s2-stage-top-bar">
            <div class="s2-stage-header-pill">${box2HeaderHtml}</div>
            <button type="button" class="s2-stage-pool-btn" data-toggle-pool-drawer="1">
              🔍 ${this.poolDrawerOpen ? 'Hide Pool' : 'Pool &amp; Rates'}
            </button>
          </div>

          <div class="s2-gacha-diorama">
            <div class="s2-float-bubbles s2-bubbles-left">
              <button type="button" class="s2-bubble s2-polaroid-card tilt-left s2-rarity-${bp1Vis.rarity} ${previewEntry?.key === bp1Key ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(bp1Key)}">
                <img src="${bp1Vis.url}" alt="" />
                <span>Waterwheel Mint Blueprint</span>
              </button>
              <button type="button" class="s2-bubble s2-polaroid-card tilt-right s2-rarity-${epicWonderVis.rarity} ${previewEntry?.key === epicWonderId ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(epicWonderId)}">
                <img src="${epicWonderVis.url}" alt="" />
                <span>★${epicWonderVis.rarity} ${escapeHtml(epicWonder.name || 'Yuzu Hot Spring')}</span>
              </button>
            </div>

            <div class="s2-stage-centerpiece">
              <img class="s2-draft-prop" src="/assets/ui/stage_architect_stand.png" alt="" />
              <img class="s2-box1-magic-circle" src="/assets/ui/fx_magic_circle.png" alt="" />
              <img class="s2-wonder-hero" src="${heroUrl}" alt="${escapeHtml(heroAlt)}" />
              <div class="s2-wonder-yield-tag">+25% Couple Gold &amp; Berry Yield!</div>
            </div>

            <div class="s2-float-bubbles s2-bubbles-right">
              <button type="button" class="s2-bubble s2-polaroid-card tilt-right s2-rarity-${bp2Vis.rarity} ${previewEntry?.key === bp2Key ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(bp2Key)}">
                <img src="${bp2Vis.url}" alt="" />
                <span>Cat Boba Bakery Blueprint</span>
              </button>
              <button type="button" class="s2-bubble s2-polaroid-card tilt-left s2-rarity-${decor1Vis.rarity} ${previewEntry?.key === decor1Id ? 'is-selected' : ''}" data-gacha-preview="${escapeHtml(decor1Id)}">
                <img src="${decor1Vis.url}" alt="" />
                <span>Sakura Couple Swing Decor</span>
              </button>
            </div>
          </div>

          <div class="rpg-featured-banner s2-stage-footer-pill">
            <span class="rpg-featured-title">${box2TitleHtml}:</span>
            <span class="rpg-featured-name">${box2SubHtml}</span>
          </div>
        </div>

        <div class="rpg-card s2-pity-scroll s2-architect-scroll">
          <div class="s2-scroll-roller left"></div>
          <div class="s2-scroll-body">
            <div class="s2-architect-pity-head">
              🧭 Architect Pity: <b>${pity} / ${pityMax} Pulls</b> to Guaranteed ★★★ VIP Wonder!
            </div>
            <div class="rpg-pity-wrap">
              <div id="rpg-pity" class="rpg-pity-bar s2-pity-gold" data-pity="${pity}" data-max="${pityMax}">
                <div class="rpg-pity-fill" style="width: ${pityPct}%;"></div>
                <span class="rpg-pity-text">${pityPct}% (${pity}/${pityMax} Pulls) ⭐</span>
              </div>
            </div>

            <div class="s2-bp-strip-title">📘 Village Blueprint Progress</div>
            <div class="s2-bp-strip">${bpCardsHtml}</div>
          </div>
          <div class="s2-scroll-roller right"></div>
        </div>

        <div class="s2-pool-drawer ${this.poolDrawerOpen ? 'is-open' : ''}">
          <div class="s2-drawer-backdrop" data-pool-close="1"></div>
          <div class="rpg-card s2-pool-drawer-card">
            <div class="s2-drawer-head">
              <span class="rpg-card-title">🧭 Royal Architect Drop Rates &amp; Prize Pool</span>
              <button type="button" class="s2-drawer-close-btn" data-pool-close="1">✕</button>
            </div>
            <div class="rpg-rates-box">
              <span class="mythic" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_mythic.png" style="width:20px;height:20px;object-fit:contain;" alt="" />★3 VIP Wonder: ${(BOX2.RATES[3] * 100).toFixed(0)}%</span>
              <span class="epic" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_epic.png" style="width:20px;height:20px;object-fit:contain;" alt="" />★2 ${escapeHtml((epicWonder.name || 'Onsen').split(' ').slice(-2).join(' '))}: ${(BOX2.RATES[2] * 100).toFixed(0)}%</span>
              <span class="rare" style="display:inline-flex;align-items:center;gap:4px;"><img src="/assets/monopoly/gacha_trunk_rare.png" style="width:20px;height:20px;object-fit:contain;" alt="" />Blueprints &amp; Decor: ${(BOX2.RATES[1] * 100).toFixed(0)}%</span>
            </div>
            ${renderGachaPrizePoolHtml(pool, previewEntry?.key || null)}
          </div>
        </div>

        <div class="rpg-gacha-buttons">
          <div class="rpg-gacha-btn-row">
            <button id="pull-1" class="btn-gold s2-candy-amber" ${p.gold < BOX2.COST_1 ? 'disabled' : ''}>
              <span>🧭 1x Architect Pull</span>
              <small>• <img src="/assets/ui/icon_gold.png" class="s2-inline-ico" alt="" /> ${BOX2.COST_1.toLocaleString()} Gold</small>
            </button>
            <button id="pull-10" class="btn-gold s2-btn-rainbow s2-candy-summon-10" ${p.gold < BOX2.COST_10 ? 'disabled' : ''}>
              <span>✨ 10x Architect Pull</span>
              <small>• <img src="/assets/ui/icon_gold.png" class="s2-inline-ico" alt="" /> ${BOX2.COST_10.toLocaleString()} Gold — Guaranteed Epic+ Wonder!</small>
            </button>
          </div>
          <div class="rpg-gacha-btn-row s2-box2-sub-btns">
            <button id="pull-10-berries" class="btn-gold berry small" ${p.berries < BOX2.COST_10_BERRIES ? 'disabled' : ''}>
              🍓 10x Berry Pull <small>(${BOX2.COST_10_BERRIES} Star-Berries)</small>
            </button>
            <button id="pull-ticket" class="btn-gold small" style="margin:0;flex:1;" ${tickets < 1 ? 'disabled' : ''}>
              <img src="${BAG_ITEM_CATALOG[BOX2.TICKET]?.url || '/assets/ui/item_ticket_gold.png'}" class="s2-inline-ico" alt="" /> 1x Golden Ticket
              <small>(${tickets} owned)</small>
            </button>
          </div>
        </div>
      `;
    }

    // ---------------- SCREEN 23: SHARD EXCHANGE PITY SHOP ----------------
    if (gtab === 'shop') {
      const offersHtml = Object.entries(SHARD_OFFERS)
        .filter(([, offer]) => !offer.pet)
        .map(([offerId, offer]) => {
        const curPick = this.selectedPicks[offerId] || '';
        const { vis, rarity, sub } = resolveShardOfferMeta(offerId, offer, curPick, lineage);

        let selectHtml = '';
        if (offer.pick === 'outfit') {
          const opts = SEASON_OUTFITS.map((k) => `<option value="${k}" ${curPick === k ? 'selected' : ''}>${escapeHtml(OUTFITS[k].name)}</option>`).join('');
          selectHtml = `<select class="rpg-select" data-pick="${offerId}"><option value="">Select Outfit Set...</option>${opts}</select>`;
        } else if (offer.pick === 'dice') {
          const opts = MYTHIC_DICE.map((k) => `<option value="${k}" ${curPick === k ? 'selected' : ''}>${escapeHtml(DICE_SKINS[k].name)}</option>`).join('');
          selectHtml = `<select class="rpg-select" data-pick="${offerId}"><option value="">Select Mythic 3D Die...</option>${opts}</select>`;
        } else if (offer.pick === 'wonder') {
          const opts = VIP_WONDERS.map((k) => `<option value="${k}" ${curPick === k ? 'selected' : ''}>${escapeHtml(WONDERS[k].name)}</option>`).join('');
          selectHtml = `<select class="rpg-select" data-pick="${offerId}"><option value="">Select VIP Wonder...</option>${opts}</select>`;
        } else if (offer.pick === 'accessory') {
          const accOpts = Object.keys(ACCESSORIES).map((k) => `<option value="${k}" ${curPick === k ? 'selected' : ''}>${escapeHtml(ACCESSORIES[k].name)} (${SLOT_LABELS[ACCESSORIES[k].slot]})</option>`);
          const diceOpts = Object.keys(DICE_SKINS).map((k) => `<option value="${k}" ${curPick === k ? 'selected' : ''}>${escapeHtml(DICE_SKINS[k].name)} (3D Dice)</option>`);
          selectHtml = `<select class="rpg-select" data-pick="${offerId}"><option value="">Select Accessory / Dice Dupe...</option>${accOpts.concat(diceOpts).join('')}</select>`;
        }

        const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
        const isOutfitCard = offer.pick === 'outfit';
        const shopThumbInnerHtml = isOutfitCard
          ? renderOutfitThumbLayers(curPick || FEATURED_OUTFIT, { lineage, appearance: p?.appearance, url: vis.url, filter: vis.filter, alt: offer.name })
          : `<img class="s2-thumb-img" src="${vis.url}" alt="${escapeHtml(offer.name)}" style="${filterStyle}" loading="lazy" />`;

        return `
          <div class="rpg-offer-card s2-shop-card rpg-rarity-${rarity}" data-offer="${offerId}">
            <div class="s2-shop-card-head">
              <span class="rpg-offer-name" title="${escapeHtml(offer.name)}">${escapeHtml(offer.name)}</span>
              <span class="rpg-stars">${'★'.repeat(rarity)}</span>
            </div>
            <div class="s2-shop-card-body">
              <div class="s2-thumb s2-shop-thumb s2-rarity-${rarity} ${isOutfitCard ? 's2-thumb-has-hair' : ''}">
                ${shopThumbInnerHtml}
              </div>
              <div class="s2-shop-card-info">
                <div class="s2-shop-sub" title="${escapeHtml(sub)}">${escapeHtml(sub)}</div>
                <div class="rpg-offer-cost">
                  <img src="/assets/ui/icon_shard.png" class="s2-inline-ico" alt="" />
                  <b>${offer.cost} Shards</b>
                </div>
              </div>
            </div>
            ${selectHtml}
            <button class="btn-gold small s2-shop-btn" data-buy="${offerId}" ${p.shards < offer.cost ? 'disabled' : ''}>
              <img src="/assets/ui/icon_shard.png" class="s2-inline-ico" alt="" />
              <span>Exchange Now (${offer.cost})</span>
            </button>
          </div>
        `;
      }).join('');

      const heroOutfitId = this.selectedPicks.mythic_outfit || FEATURED_OUTFIT;
      const heroOutfitVis = resolveItemVisual(heroOutfitId, lineage);
      const heroWonderVis = resolveItemVisual(this.selectedPicks.vip_wonder || VIP_WONDERS[0], lineage);
      const heroSkillDef = SEASON_SKILLS[heroOutfitId];
      const dupeConvertSummary = Object.entries(DUPE_SHARDS)
        .map(([r, s]) => `★${r}=+${s}⭐`)
        .join(' | ');
      const heroEquipped = {
        outfit: { id: heroOutfitId, refine: 10 },
        wings: { id: 'wings_golden_seraphim', refine: 10 },
      };

      return `
        ${tabsHtml}
        <div class="s2-shard-hero">
          <div class="s2-shard-ribbon">0% RNG DIRECT MYTHIC PITY EXCHANGE</div>
          <div class="s2-shard-hero-body">
            <div class="s2-shard-showcase">
              <img class="s2-shard-arch" src="/assets/ui/stage_goddess_pedestal.png" alt="" />
              <div class="s2-shard-dressed-chibi">
                ${renderPaperDollDomLayers(lineage, heroEquipped, 'front', p.appearance)}
                <img class="s2-shard-chibi" src="${heroOutfitVis.url}" style="display:none;${heroOutfitVis.filter !== 'none' ? `filter:${heroOutfitVis.filter};` : ''}" alt="" />
              </div>
              <img class="s2-shard-wonder" src="${heroWonderVis.url}" alt="" />
            </div>
            <div class="s2-shard-summary">
              <div class="s2-shard-bal">
                <img src="/assets/ui/icon_shard.png" alt="" />
                <div class="s2-shard-bal-text">
                  <div>⭐ Your Starlight Shards: <b>${fmtNum(p.shards || 0)}</b> <span class="s2-ready-tag">(Ready to Redeem!)</span></div>
                  <small class="s2-dupe-convert-pill">♻️ Excess +${MAX_REFINE} Dupes Auto-Convert: ${dupeConvertSummary}</small>
                </div>
              </div>
              <div class="s2-shard-featured-callout">
                <div class="s2-shard-feat-tag">👑 [FEATURED MYTHIC OUTFIT]</div>
                <div class="s2-shard-feat-name">${escapeHtml(OUTFITS[heroOutfitId]?.name || heroOutfitVis.name)}</div>
                <div class="s2-shard-feat-sub">+250 Base CP • ${heroSkillDef ? `⚡ Ult: ${escapeHtml(heroSkillDef.name)} • ` : ''}Cost: ⭐ ${SHARD_OFFERS.mythic_outfit?.cost || 400} Shards</div>
              </div>
            </div>
          </div>
        </div>

        <div class="rpg-shop-grid">
          ${offersHtml}
        </div>
      `;
    }

    return tabsHtml;
  }

  // ---------------------------------------------------------------------------------------------
  // VIEW 3: BLACKSMITH STAR-FORCE FORGE (Screen 20)
  // ---------------------------------------------------------------------------------------------
  renderForge(p) {
    const inv = p.inventory || {};
    const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
    const ownedIds = Object.keys(inv);

    if (!this.selectedForgeItem || !inv[this.selectedForgeItem]) {
      this.selectedForgeItem = ownedIds[0] || null;
    }

    const itemPickerHtml = ownedIds.length ? ownedIds.map((id) => {
      const def = itemDef(id);
      const vis = resolveItemVisual(id, lineage);
      const isOutfitPick = vis.kind === 'outfit';
      const refine = inv[id].refine | 0;
      const dupes = inv[id].dupes | 0;
      const isActive = id === this.selectedForgeItem;
      const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
      const pickThumbInnerHtml = isOutfitPick
        ? renderOutfitThumbLayers(id, { lineage, appearance: p?.appearance, url: vis.url, filter: vis.filter, alt: def?.name || id })
        : `<img src="${vis.url}" alt="${escapeHtml(def?.name || id)}" style="${filterStyle}" />`;

      return `
        <div class="rpg-forge-item s2-rarity-${vis.rarity || 1} ${isActive ? 'active' : ''}" data-forge-item="${id}">
          <div class="s2-forge-pick-thumb ${isOutfitPick ? 's2-thumb-has-hair' : ''}">
            ${pickThumbInnerHtml}
            <span class="s2-thumb-refine">+${refine}</span>
            ${dupes > 0 ? `<span class="s2-thumb-badge">x${dupes}</span>` : ''}
          </div>
          <span class="s2-forge-pick-name">${escapeHtml(def?.name || id)}</span>
        </div>
      `;
    }).join('') : `<div class="s2-empty-notice">No items in inventory.</div>`;

    if (!this.selectedForgeItem || !inv[this.selectedForgeItem]) {
      return `
        <div class="rpg-card">
          <div class="rpg-card-title">🔨 Star-Force Blacksmith Anvil</div>
          <div class="rpg-forge-picker">${itemPickerHtml}</div>
          <div class="s2-empty-notice">Obtain gear and fashion from Gacha to forge!</div>
        </div>
      `;
    }

    const curId = this.selectedForgeItem;
    const it = inv[curId];
    const def = itemDef(curId);
    const vis = resolveItemVisual(curId, lineage);
    const isCurOutfit = vis.kind === 'outfit';
    const slot = itemSlot(curId) || 'outfit';
    const refine = it.refine | 0;
    const isMax = refine >= MAX_REFINE;
    const target = refine + 1;

    const goldCost = isMax ? 0 : FORGE.GOLD[target];
    const dupesCost = isMax ? 0 : FORGE.DUPES[target];
    const pityFails = it.pity | 0;
    const onsenPct = (p.buffs?.blacksmith && p.buffs.blacksmith.until > Date.now()) ? (p.buffs.blacksmith.pct | 0) : 0;

    const isScrollAllowed = scrollAllowed(refine);
    const ownedScrolls = p.bag_items?.[FORGE.SCROLL_ITEM] | 0;
    const canUseScroll = isScrollAllowed && ownedScrolls >= 1;
    const scrollHint = !isScrollAllowed ? 'Scrolls work on +5 → +10' : ownedScrolls < 1 ? 'No scrolls' : '';
    const activeScroll = Boolean(this.forgeScroll && canUseScroll);

    const liveChance = isMax ? 100 : forgeChance(refine, {
      useBerries: this.forgeBerries,
      useScroll: activeScroll,
      onsenPct,
      pityFails,
    });

    const curCP = Math.round(slotCP(slot, curId, refine));
    const nextCP = isMax ? curCP : Math.round(slotCP(slot, curId, target));

    const canAffordGold = p.gold >= goldCost;
    const canAffordDupes = (it.dupes | 0) >= dupesCost;
    const canAffordBerries = !this.forgeBerries || p.berries >= FORGE.BERRY_COST;
    const canAffordScroll = !activeScroll || ownedScrolls >= 1;
    const canForge = !isMax && canAffordGold && canAffordDupes && canAffordBerries && canAffordScroll;

    let resultHtml = '';
    if (this.lastForgeResult) {
      const res = this.lastForgeResult;
      resultHtml = `
        <div id="forge-result" class="rpg-forge-result ${res.success ? 'success' : 'fail'}">
          ${res.success
            ? `🎉 FORGE SUCCESS! Upgraded to +${res.newStar}!${res.sovereign ? ` ${FORGE.SOVEREIGN_TITLE} Title Unlocked!` : ''}`
            : `🛡️ PROTECTED! No Downgrade • Artisan Pity: ${res.pity}/${FORGE.PITY_FAILS_GUARANTEE} (+${res.pityPct}%)`}
        </div>
      `;
    } else {
      resultHtml = `<div id="forge-result" class="rpg-forge-result" hidden></div>`;
    }

    const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';

    // Build quick 6-slot equipped/top gear strip for 1-tap switching on the main Forge screen
    const equippedIds = Object.values(p.equipped || {})
      .map((e) => e?.id)
      .filter((id) => id && inv[id]);
    const quickIds = [...new Set([...equippedIds, ...ownedIds])].slice(0, 6);
    const quickBarSlotsHtml = quickIds.map((id) => {
      const qDef = itemDef(id);
      const qVis = resolveItemVisual(id, lineage);
      const qIsOutfit = qVis.kind === 'outfit';
      const qRef = inv[id]?.refine | 0;
      const qDupes = inv[id]?.dupes | 0;
      const isAct = id === curId;
      const qFilter = qVis.filter && qVis.filter !== 'none' ? `filter:${qVis.filter};` : '';
      const qInnerHtml = qIsOutfit
        ? renderOutfitThumbLayers(id, { lineage, appearance: p?.appearance, url: qVis.url, filter: qVis.filter, alt: qDef?.name || id })
        : `<img src="${qVis.url}" alt="${escapeHtml(qDef?.name || id)}" style="${qFilter}" />`;
      return `
        <button type="button" class="s2-forge-quick-slot s2-rarity-${qVis.rarity || 1} ${qIsOutfit ? 's2-thumb-has-hair' : ''} ${isAct ? 'active' : ''}" data-forge-item="${id}" title="${escapeHtml(qDef?.name || id)} (+${qRef})">
          ${qInnerHtml}
          <span class="s2-thumb-refine">+${qRef}</span>
          ${qDupes > 0 ? `<span class="s2-thumb-badge">x${qDupes}</span>` : ''}
        </button>
      `;
    }).join('');

    const activePet = this.resolveActivePet();
    const petSprKey = activePet
      ? resolvePetSpriteKey(activePet.id, activePet.visual_tier || activePet.stars || 1, 'happy')
      : resolvePetSpriteKey('pet_ragdoll', 3, 'happy');
    const anvilItemInnerHtml = isCurOutfit
      ? renderOutfitThumbLayers(curId, { lineage, appearance: p?.appearance, url: vis.url, filter: vis.filter, alt: def?.name || curId })
      : `<img src="${vis.url}" alt="${escapeHtml(def?.name || curId)}" style="${filterStyle}" />`;

    return `
      <div class="s2-forge-stage">
        ${renderStarForceArc(refine, MAX_REFINE)}

        <div class="s2-anvil-diorama">
          <div class="s2-anvil-center">
            <img class="s2-anvil-magic" src="/assets/ui/fx_magic_circle.png" alt="" />
            <div class="s2-anvil-item-box s2-rarity-${vis.rarity || 1} ${isCurOutfit ? 's2-thumb-has-hair' : ''}">
              ${anvilItemInnerHtml}
              <span class="s2-anvil-plus">+${refine}</span>
            </div>
            <img class="s2-anvil-prop" src="/assets/ui/stage_blacksmith_anvil.png" alt="Blacksmith Anvil" />
          </div>

          <div class="s2-anvil-chibi-cheer">
            <div class="s2-anvil-dressed-chibi">
              ${renderPaperDollDomLayers(lineage, p.equipped || {}, 'front', p.appearance)}
            </div>
            <img class="s2-anvil-cheer-pet" src="/assets/pets/${petSprKey}.png" alt="" />
            <img class="s2-anvil-smith" src="/assets/chibi/${lineage}_base_front.png" alt="" style="display:none;" />
          </div>
        </div>

        <div class="rpg-forge-target">
          [${escapeHtml(def?.name || curId)}]: +${refine} ${isMax ? `${FORGE.SOVEREIGN_TITLE.toUpperCase()} MAX!` : `➜ +${target}`}
        </div>
      </div>

      <div class="rpg-forge-console">
        <div class="s2-forge-level-header">
          <span>Level +${refine}  ➜  Level +${isMax ? MAX_REFINE : target}</span>
        </div>

        <div class="s2-aura-banner">
          ⚔️ Power: <b>+${curCP} CP ➜ +${nextCP} CP (+15% Boost!)</b> • ✨ ★${MAX_REFINE} Unlocks Golden Sovereign Aura!
        </div>

        <div class="s2-forge-mid-row">
          <div class="rpg-chance-gauge" style="--chance-pct: ${liveChance}%;">
            <div class="rpg-chance-num">${liveChance}%</div>
            <div class="rpg-chance-sub">SUCCESS</div>
          </div>

          <div class="s2-forge-controls-col">
            <div class="rpg-safe-badge">
              <img src="/assets/ui/stage_shield_emblem.png" alt="" class="s2-inline-ico" />
              🛡️ ZERO DESTRUCTION / NO DOWNGRADE ON FAIL!
            </div>

            <label class="rpg-berries-check">
              <input type="checkbox" id="forge-berries" ${this.forgeBerries ? 'checked' : ''} />
              <img src="/assets/ui/icon_berry.png" class="s2-inline-ico" alt="" />
              <span>Use ${FORGE.BERRY_COST} Star-Berries (+${FORGE.BERRY_BONUS}% Rate!)</span>
            </label>

            <label class="rpg-scroll-check ${canUseScroll ? '' : 'disabled'}" ${canUseScroll ? '' : `title="${scrollHint}"`}>
              <input type="checkbox" id="forge-scroll" ${this.forgeScroll && canUseScroll ? 'checked' : ''} ${canUseScroll ? '' : 'disabled'} />
              <img src="/assets/ui/item_protection_scroll.png" class="s2-inline-ico" alt="" />
              <span>Use Artisan Scroll (+25%, double pity on miss) — owned: ${ownedScrolls}${!canUseScroll ? ` (${scrollHint})` : ''}</span>
            </label>
          </div>
        </div>

        <div class="s2-pity-box">
          <div class="s2-pity-box-head">
            <span>🔥 Artisan Pity Energy (+${FORGE.PITY_PER_FAIL}% per Fail)</span>
            <span>${pityFails} / ${FORGE.PITY_FAILS_GUARANTEE} Fails (+${(pityFails * FORGE.PITY_PER_FAIL).toFixed(1)}%)</span>
          </div>
          <div class="rpg-pity-bar s2-pity-bar-slim">
            <div class="rpg-pity-fill" style="width:${Math.min(100, (pityFails / FORGE.PITY_FAILS_GUARANTEE) * 100)}%;"></div>
          </div>
        </div>

        <div class="rpg-cost-rows">
          <span><img src="/assets/ui/icon_gold.png" class="s2-inline-ico" alt="" /> Gold Required:</span>
          <b class="${canAffordGold ? '' : 's2-lack'}">${goldCost.toLocaleString()} Gold (${fmtNum(p.gold)} owned)</b>
          <span><img src="/assets/ui/item_dupe_box.png" class="s2-inline-ico" alt="" /> Duplicate Copies:</span>
          <b class="${canAffordDupes ? '' : 's2-lack'}">${it.dupes | 0} / ${dupesCost} dupes</b>
          ${onsenPct ? `<span>♨️ Yuzu Hot Spring Buff:</span><b>+${onsenPct}% Active!</b>` : ''}
        </div>

        ${resultHtml}
      </div>

      <div class="s2-forge-equipped-bar">
        <div class="s2-forge-quick-slots">${quickBarSlotsHtml}</div>
        <button type="button" class="s2-forge-all-btn" data-toggle-forge-drawer="1">
          🗂️ ${this.forgeDrawerOpen ? 'Hide Gear' : `All Gear (${ownedIds.length})`}
        </button>
      </div>

      <div class="s2-forge-drawer ${this.forgeDrawerOpen ? 'is-open' : ''}">
        <div class="s2-drawer-backdrop" data-forge-drawer-close="1"></div>
        <div class="rpg-card s2-forge-picker-card">
          <div class="s2-drawer-head">
            <span class="rpg-card-title s2-forge-picker-title">Select Gear / Costume to Forge (${ownedIds.length})</span>
            <button type="button" class="s2-drawer-close-btn" data-forge-drawer-close="1">✕</button>
          </div>
          <div class="rpg-forge-picker">
            ${itemPickerHtml}
          </div>
        </div>
      </div>

      <div class="s2-forge-bottom-bar">
        <div class="s2-forge-title-ribbon">
          <span>👑 <b>+${MAX_REFINE} Sovereign</b><br/><small>Title at ★${MAX_REFINE}!</small></span>
        </div>
        <button id="forge-go" class="btn-gold s2-btn-rainbow s2-forge-cta-btn" ${canForge ? '' : 'disabled'}>
          ${isMax
            ? `${FORGE.SOVEREIGN_TITLE.toUpperCase()} MAX REACHED ✨`
            : `🔨 FORGE TO +${target}! (${goldCost.toLocaleString()} Gold${this.forgeBerries ? ` + ${FORGE.BERRY_COST} Berries` : ''}${activeScroll ? ' + 1 Scroll' : ''})`}
        </button>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------------------------
  // VIEW 4: COZY PET NEST & SANCTUARY (Screen 16 V2 — Soul-Bond Companions)
  // ---------------------------------------------------------------------------------------------
  renderPets(p) {
    return renderPetSanctuary(this, p);
  }
}
