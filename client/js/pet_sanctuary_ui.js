// client/js/pet_sanctuary_ui.js — Pet System V2.5 ("Soul-Bond Companions") Sanctuary UI
// Pure Level & Bond Progression (Lv. 1 -> Lv. 30):
// - No egg gacha, no egg hatching, no duplicate pet farming, no Essence evolution.
// - Block 1: Sakura Sky-Island Sanctuary Stage (Single Active Companion + Form Toggle + Multi-Pose Rotation + 8 Emotes)
// - Block 2: Progress & Care Card (♥ Companion Level 1-30 + 🍓 Hunger 🟢/🟠/🔴 + Feed Star-Berry)
// - Block 3: Soul-Link Ultimate (with green +X% Trait Bonuses & Lv.15 Costume Override) + 2 Companion Trait Slots
// - Block 4: 4 Canonical Soul-Bond Companions Switcher (Nyx, Princess Ragdoll, Sakura Kitsune, Baby Sky Whale)

import {
  PETS, PET_FAMILIES, PET_EMOTES, getPetDef, petLocomotion, resolvePetSpriteKey, resolvePetEmoteKey, resolvePetUiScale,
} from '/shared/pet_catalog.js';
import {
  PET2, MAX_TRAIT_SLOTS, HUNGER, hungerZone, PET_MILESTONES, unlockedPosesForLevel,
  unlockedSelectablePosesForLevel, normalizeActivePoses, starsForLevel, minLevelForStars, openSlotCountForPet,
  rerollCost, bondXpToNext, unlockedEmotesForBond, ALL_SLOT_LINES, sanitizeNickname,
  slotSoulLinkBonus, computePetSoulLinkBonuses,
} from '/shared/pet_rules.js';
import { petMatchStats } from '/shared/monopoly_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { skillFor, GENERIC_SKILLS } from '/shared/season_skills.js';
import { PET } from '/shared/rpg_rules.js';
import { fmtNum, escapeHtml, resolveItemVisual } from './ui_components.js';
import { spriteInfo } from './assets.js';

const GOLD_ICO_HTML = '<img class="s2-inline-ico" src="/assets/ui/icon_gold.png" alt="Gold">';
function formatGoldIcons(escapedStr) {
  return String(escapedStr || '').replace(/🪙/g, GOLD_ICO_HTML);
}

export function utcDayStr(ms = Date.now()) {
  return String(Math.floor(ms / 86_400_000));
}

export function normalizePetsList(petsField) {
  if (!petsField) return [];
  if (Array.isArray(petsField)) {
    return petsField.filter(Boolean).map((pet) => ({
      ...pet,
      uid: pet.uid || pet.id,
      id: pet.id || pet.uid,
    }));
  }
  if (typeof petsField === 'object') {
    return Object.entries(petsField)
      .filter(([, rec]) => rec && typeof rec === 'object')
      .map(([id, rec]) => ({
        ...rec,
        id: rec.id || id,
        uid: rec.uid || id,
      }));
  }
  return [];
}

export function formatPetStarProgressV2(pet) {
  if (!pet) return '★1';
  const rawStars = Math.max(1, Math.min(3, pet.stars ?? PETS[pet.id]?.rarity ?? 1));
  const bondLv = Math.max(1, Math.min(30, Math.max(Number(pet.bond_lv) || 1, minLevelForStars(rawStars))));
  const stars = Math.max(rawStars, starsForLevel(bondLv));
  if (stars >= PET2.MAX_STARS) return 'MAX ★3 RADIANT';
  return `★${stars}`;
}

function formatSlotLine(slot) {
  if (slot && slot.stat && ALL_SLOT_LINES[slot.stat]) {
    const def = ALL_SLOT_LINES[slot.stat];
    const tier = slot.tier || 'common';
    const val = slot.value ?? def.values[tier] ?? def.values.common;
    const valStr = def.isFlat ? `+${val}` : `+${Math.round(val * 100)}%`;
    return {
      tier,
      icon: def.icon === '🪙' ? GOLD_ICO_HTML : (def.icon || '✨'),
      name: `${def.name} (${valStr})`,
      shortTitle: `${def.name} (${valStr})`,
      desc: def.desc,
      locked: Boolean(slot.locked),
      isPerk: def.kind === 'perk',
      slBonus: slotSoulLinkBonus(slot),
    };
  }
  return null;
}

export function renderPetSanctuary(ui, p) {
  const pets = normalizePetsList(p.pets);
  const lineage = p.lineage === 'dxb' ? 'dxb' : 'bkk';
  const activePet = ui.resolveActivePet();

  if (!activePet) {
    return `
      <div class="rpg-card">
        <div class="rpg-card-title">🐾 Soul-Bond Companion Sanctuary</div>
        <div class="s2-empty-notice">Choose your companion below to begin your Soul-Bond journey!</div>
      </div>
    `;
  }

  const pdef = getPetDef(activePet.id);
  const fam = PET_FAMILIES[pdef?.family];
  const rawStars = Math.max(1, Math.min(3, Number(activePet.stars ?? PETS[activePet.id]?.rarity) || 1));
  const bondLv = Math.max(1, Math.min(30, Math.max(Number(activePet.bond_lv) || 1, minLevelForStars(rawStars))));
  const stars = Math.max(rawStars, starsForLevel(bondLv));
  const visualTier = Math.max(1, Math.min(stars, Number(activePet.visual_tier) || stars));
  const displayName = activePet.nickname ? `${activePet.nickname} (${pdef.name})` : pdef.name;
  const shortDisplayName = activePet.nickname || pdef.name;
  const tierFormTitle = pdef.tierNames?.[visualTier] || (visualTier === 3 ? 'Radiant Form' : visualTier === 2 ? 'Awakened Form' : 'Starter Form');
  const eqPet = p.equipped?.pet;
  const isEquipped = Boolean(eqPet && (eqPet.uid === activePet.uid || eqPet.id === activePet.id));
  const loco = petLocomotion(activePet.id);
  const moveVerbLabel = loco === 'FLY_FLUTTER' ? '🪽 Fly' : loco === 'SKY_SWIM' ? '🌊 Swim' : '🏃 Walk';

  // --------------------------------------------------------------------------
  // BLOCK 1: Sakura Sky-Island Sanctuary Stage (Single Companion + Poses + Emotes)
  // --------------------------------------------------------------------------
  const activePoses = normalizeActivePoses(activePet.active_poses, bondLv);
  const unlockedPoses = unlockedSelectablePosesForLevel(bondLv);
  const dirView = ui.petStageDirView || 'front';
  const heroPose = (ui.petPreviewPose && activePoses.includes(ui.petPreviewPose))
    ? ui.petPreviewPose
    : (activePoses[0] || 'front');
  const stagePose = dirView !== 'front'
    ? dirView
    : (heroPose === 'flip' ? 'happy' : heroPose);
  const heroSpriteKey = resolvePetSpriteKey(activePet.id, visualTier, stagePose);
  const visFallback = resolveItemVisual(activePet.id, lineage);
  const heroUrl = spriteInfo(heroSpriteKey) ? `/assets/pets/${heroSpriteKey}.png` : visFallback.url;
  const heroFilter = spriteInfo(heroSpriteKey) ? '' : (visFallback.filter && visFallback.filter !== 'none' ? `filter:${visFallback.filter};` : '');
  const heroUiScale = resolvePetUiScale(activePet.id, stars, visualTier, stagePose);

  const today = utcDayStr();
  const giftReady = activePet.last_gift_day !== today;

  // Active Emote Bubble on Hero Stage
  const activeEmoteKey = ui.petPreviewEmote ? resolvePetEmoteKey(activePet.id, ui.petPreviewEmote) : null;
  const activeEmoteBubbleHtml = activeEmoteKey && spriteInfo(activeEmoteKey)
    ? `<div class="pet-v2-emote-bubble"><img src="/assets/pets/${activeEmoteKey}.png" alt="${escapeHtml(ui.petPreviewEmote)}" /></div>`
    : '';

  // Interactive Multi-Select Pose & Trick Bar: Stand (Lv.1), Nap (Lv.5), Happy (Lv.10), Cast (Lv.15), 360° Flip (Lv.25)
  const poseList = [
    { pose: 'front', label: '🐾 Stand', reqLv: 1 },
    { pose: 'sleep', label: '💤 Nap', reqLv: 5 },
    { pose: 'happy', label: '😊 Happy', reqLv: 10 },
    { pose: 'cast', label: '🪄 Cast', reqLv: 15 },
    { pose: 'flip', label: '🎪 360° Flip', reqLv: 25 },
  ];
  const poseBarHtml = poseList.map(({ pose, label, reqLv }) => {
    const isUnlocked = bondLv >= reqLv;
    const isSelected = isUnlocked && activePoses.includes(pose);
    const isPreviewing = isUnlocked && heroPose === pose;
    const btnLabel = isUnlocked
      ? (isSelected ? `✓ ${label}` : label)
      : `🔒 ${label.split(' ')[1] || label} (Lv.${reqLv})`;
    return `
      <button type="button" class="pet-v2-pose-btn ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'active' : ''} ${isPreviewing ? 'is-previewing' : ''}" data-pet-pose="${pose}" ${isUnlocked ? '' : 'disabled'} title="${isUnlocked ? (isSelected ? 'Active in rotation (tap to toggle)' : 'Tap to add to active pose rotation') : `Unlocks at Companion Lv.${reqLv}`}">
        ${btnLabel}
      </button>
    `;
  }).join('');

  // 8-Expression Bust buttons
  const unlockedEmotes = new Set(unlockedEmotesForBond(bondLv));
  const emotesHtml = PET_EMOTES.map((emo) => {
    const isUnlocked = unlockedEmotes.has(emo);
    const emoKey = resolvePetEmoteKey(activePet.id, emo);
    const emoUrl = spriteInfo(emoKey) ? `/assets/pets/${emoKey}.png` : heroUrl;
    const isActiveEmo = ui.petPreviewEmote === emo;
    const reqLv = ['joy', 'sleepy'].includes(emo) ? 1 : (['wink', 'surprised'].includes(emo) ? 2 : (['teary', 'shy'].includes(emo) ? 4 : 6));
    return `
      <button type="button" class="pet-v2-emote-btn ${isUnlocked ? 'unlocked' : 'locked'} ${isActiveEmo ? 'active' : ''}" data-pet-emote="${emo}" ${isUnlocked ? '' : 'disabled'} title="${isUnlocked ? `Preview ${emo.toUpperCase()} Emote` : `Unlocks at Soul-Bond Lv.${reqLv}`}">
        <img src="${emoUrl}" alt="${escapeHtml(emo)}" />
        <span>${escapeHtml(emo)}</span>
        ${!isUnlocked ? `<small>Lv.${reqLv}</small>` : ''}
      </button>
    `;
  }).join('');

  // --------------------------------------------------------------------------
  // BLOCK 2: Progress & Hunger State (♥ Companion Level 1–30 + 🍓 Fullness)
  // --------------------------------------------------------------------------
  const bondXp = Math.max(0, Number(activePet.bond_xp) || 0);
  const bondNeed = bondXpToNext(bondLv);
  const bondPct = bondLv >= 30 ? 100 : Math.min(100, Math.round((bondXp / bondNeed) * 100));

  let nextMilestoneText = '';
  if (bondLv >= 30) {
    nextMilestoneText = '🌈 MAX Lv. 30 Sovereign Ground Ring Aura Active!';
  } else {
    const nextM = PET_MILESTONES.find((m) => m.lv > bondLv);
    nextMilestoneText = nextM ? `Next at Lv. ${nextM.lv}: ${nextM.label}` : '';
  }

  const hunger = Math.max(0, Math.min(100, Number(activePet.hunger ?? HUNGER.DEFAULT)));
  const hZone = hungerZone(hunger);
  const hungerColor = hZone.zone === 'green' ? '#38d39f' : hZone.zone === 'orange' ? '#f5a623' : '#ff5e6c';
  const hungerBadge = hZone.zone === 'green' ? '🟢 Full & Happy (2.0× EXP)'
    : hZone.zone === 'orange' ? '🟠 Peckish (1.0× EXP)'
    : '🔴 Hungry (0.25× EXP)';
  const canFeed = (p.berries | 0) >= PET.FEED_COST && (hunger < 100 || bondLv < 30);

  // --------------------------------------------------------------------------
  // BLOCK 3: 2 Companion Trait Slots & Pet Costume Soul-Link Ultimate
  // --------------------------------------------------------------------------
  const openCount = openSlotCountForPet({ stars, bond_lv: bondLv });
  const maxLocksAllowed = Math.max(0, openCount - 1);
  const rawSlotsArr = Array.isArray(activePet.slots) ? activePet.slots : [null, null];
  let lockedCount = 0;
  let hasUnlockedMythic = false;
  const slotsArr = [0, 1].map((i) => {
    const s = rawSlotsArr[i];
    if (!s || i >= openCount) return s || null;
    if (s.locked) {
      if (lockedCount < maxLocksAllowed) {
        lockedCount++;
        return s;
      }
      return { ...s, locked: false };
    }
    if (s.tier === 'mythic') hasUnlockedMythic = true;
    return s;
  });
  for (let i = 0; i < openCount; i++) {
    const s = slotsArr[i];
    if (s && !s.locked && s.tier === 'mythic') hasUnlockedMythic = true;
  }
  const rCost = rerollCost(lockedCount);
  const canAffordReroll = (p.gold | 0) >= rCost.gold && (p.berries | 0) >= rCost.berries;

  const petWithSlots = { stars, bond_lv: bondLv, slots: slotsArr };
  const slBonuses = computePetSoulLinkBonuses(petWithSlots);
  const mStats = petMatchStats({ bond: bondLv, pet: petWithSlots });
  const ratePct = Math.round(mStats.rate * 100);
  const potPct = Math.round(mStats.potency * 100);
  const startPct = Math.round(mStats.start ?? 45);
  const ratePlusHtml = slBonuses.ratePct > 0 ? ` <b class="pet-v2-trait-plus" title="Boosted by Companion Trait">+${slBonuses.ratePct}%</b>` : '';
  const potPlusHtml = slBonuses.potencyPct > 0 ? ` <b class="pet-v2-trait-plus" title="Boosted by Companion Trait">+${slBonuses.potencyPct}%</b>` : '';
  const startPlusHtml = slBonuses.startPct > 0 ? ` <b class="pet-v2-trait-plus" title="Boosted by Companion Trait">+${slBonuses.startPct}%</b>` : '';
  const slStatsBarHtml = `⚡ ${ratePct}%${ratePlusHtml} Charge • 💥 ${potPct}%${potPlusHtml} Echo • 🔋 ${startPct}%${startPlusHtml} Start`;
  const innateSkill = GENERIC_SKILLS[1]; // 🌟 Lucky Star Wish

  let costumeSectionHtml = '';
  if (bondLv < 15) {
    costumeSectionHtml = `
      <div class="pet-v2-costume-card">
        <div class="pet-v2-costume-head">
          <span>🐾 <b>Innate Soul-Link Ultimate (Active from Lv. 1)</b></span>
          <span class="pet-v2-costume-hint">${slStatsBarHtml}</span>
        </div>
        <div class="pet-v2-costume-skill-box">
          <div class="pet-v2-costume-skill-title">
            <span>${escapeHtml(innateSkill.icon || '🌟')} <b>${escapeHtml(innateSkill.name)}</b> <small>(Innate Companion Ultimate)</small></span>
            <span class="pet-v2-costume-skill-tag">🔗 +15% Soul-Link Combo</span>
          </div>
          <div class="pet-v2-costume-skill-desc">${formatGoldIcons(escapeHtml(innateSkill.desc))}</div>
        </div>
        <div class="pet-v2-costume-lock-banner" style="margin-top:6px;">
          🔒 <b>Custom Costume Override &amp; Particle Trail (Unlocks at Companion Lv. 15 — Current: Lv. ${bondLv}/15)</b>
        </div>
      </div>
    `;
  } else {
    const ownedCostumes = Object.keys(p.inventory || {}).filter((cid) => OUTFITS[cid]);
    const currentCostume = activePet.costume_id || '';
    const previewCostumeId = ui.previewPetCostumeId !== undefined ? ui.previewPetCostumeId : currentCostume;
    const previewOutfit = previewCostumeId ? OUTFITS[previewCostumeId] : null;
    const activeSkill = previewOutfit ? skillFor(previewCostumeId, previewOutfit.rarity || 1) : innateSkill;
    const isCustomLinked = Boolean(previewOutfit);

    const optionsHtml = [
      `<option value="" ${!previewCostumeId ? 'selected' : ''}>Innate: ${escapeHtml(innateSkill.icon)} ${escapeHtml(innateSkill.name)} (Default Pet FX)</option>`,
      ...ownedCostumes.map((cid) => {
        const o = OUTFITS[cid];
        const sk = skillFor(cid, o.rarity || 1);
        const isSel = previewCostumeId === cid;
        return `<option value="${cid}" ${isSel ? 'selected' : ''}>${escapeHtml(o.name || cid)} (★${o.rarity || 1} • ${escapeHtml(sk?.icon || '⚡')} ${escapeHtml(sk?.name || 'Skill')})</option>`;
      }),
    ].join('');

    costumeSectionHtml = `
      <div class="pet-v2-costume-card">
        <div class="pet-v2-costume-head">
          <span>👗 <b>Pet Costume Soul-Link (Lv. ${bondLv} Unlocked)</b></span>
          <span class="pet-v2-costume-hint">Auto-Casts Ultimate in Sky Monopoly &amp; Moon Bunny</span>
        </div>
        <div class="pet-v2-costume-row">
          <select id="pet-costume-select" class="rpg-select pet-v2-costume-select">
            ${optionsHtml}
          </select>
          <button type="button" id="pet-costume-save" class="btn-gold s2-btn-blue small">👗 Link Costume</button>
        </div>
        <div class="pet-v2-costume-skill-box">
          <div class="pet-v2-costume-skill-title">
            <span>${escapeHtml(activeSkill.icon || '⚡')} <b>${escapeHtml(activeSkill.name)}</b> <small>(${isCustomLinked ? 'Costume Soul-Echo Ultimate' : 'Innate Companion Ultimate'})</small></span>
            <span class="pet-v2-costume-skill-tag">${slStatsBarHtml}</span>
          </div>
          <div class="pet-v2-costume-skill-desc">${formatGoldIcons(escapeHtml(activeSkill.desc || 'Channels the costume ultimate in Sky Monopoly & Moon Bunny.'))}</div>
        </div>
      </div>
    `;
  }

  // Strictly 2 Companion Trait Slots (Slot 1 = Lv.1, Slot 2 = Lv.10)
  const slotsHtml = [0, 1].map((idx) => {
    const isOpen = idx < openCount;
    if (!isOpen) {
      return `
        <div class="rpg-trait-slot pet-v2-slot-locked" data-trait-slot="${idx}">
          <span class="s2-trait-medal locked">🔒</span>
          <div class="pet-v2-slot-body">
            <div class="s2-trait-tag">[SLOT 2 — LV. 10]</div>
            <div class="s2-trait-name">🔒 Unlocks automatically at Companion Lv. 10 (★2 Awakened)</div>
          </div>
          <span class="s2-trait-lock">Locked</span>
        </div>
      `;
    }

    const line = formatSlotLine(slotsArr[idx]);
    const tier = line?.tier || 'common';
    const isLocked = Boolean(line?.locked);
    const canToggleLock = isLocked || lockedCount < maxLocksAllowed;
    const tagLabel = line ? `[${tier.toUpperCase()} ${line.isPerk ? 'PERK' : 'STAT'}]` : '[OPEN SLOT]';
    const medalIcon = tier === 'mythic' ? '⭐' : tier === 'epic' ? '⚡' : '🧲';
    const slBadgeHtml = line?.slBonus
      ? ` <span class="pet-v2-slot-sl-bonus" title="Boosts Pet Soul-Link Ultimate">${escapeHtml(line.slBonus.label)}</span>`
      : '';

    return `
      <div class="rpg-trait-slot rpg-tier-${tier} ${isLocked ? 'is-slot-locked' : ''}" data-trait-slot="${idx}">
        <span class="s2-trait-medal tier-${tier}">${medalIcon}</span>
        <div class="pet-v2-slot-body">
          <div class="s2-trait-tag">${tagLabel}${slBadgeHtml}</div>
          <div class="s2-trait-name">${line ? `${line.icon} <b>${escapeHtml(line.shortTitle)}:</b> ${formatGoldIcons(escapeHtml(line.desc || ''))}` : 'Empty Slot — Tap Reroll to Awaken'}</div>
        </div>
        <button type="button" class="pet-v2-lock-btn ${isLocked ? 'locked' : ''}" data-pet-lock="${idx}" data-pet-action="toggle-lock" ${canToggleLock ? '' : 'disabled'} title="${isLocked ? 'Unlock Slot' : (canToggleLock ? 'Lock Slot for Next Reroll' : 'At least 1 slot must stay unlocked')}">
          <img src="/assets/ui/icon_pet_lock.png" class="s2-inline-ico" alt="" />
          ${isLocked ? '🔒 Locked' : '🔓 Lock'}
        </button>
      </div>
    `;
  }).join('');

  // --------------------------------------------------------------------------
  // BLOCK 4: 4 Canonical Soul-Bond Companions Switcher (0% RNG Direct Bond)
  // --------------------------------------------------------------------------
  const canonicalIds = ['pet_nyx', 'pet_ragdoll', 'pet_kitsune', 'pet_skywhale'];
  const fourPetsHtml = canonicalIds.map((petId) => {
    const cdef = PETS[petId] || {};
    const owned = pets.find((x) => x.id === petId);
    const shortSpecies = (cdef.name || petId)
      .replace(', the Midnight Drake', '')
      .replace('Princess ', '')
      .replace('Baby ', '');

    if (owned) {
      const pRawStars = Math.max(1, Math.min(3, owned.stars ?? cdef.rarity ?? 1));
      const pLv = Math.max(1, Math.min(30, Math.max(Number(owned.bond_lv) || 1, minLevelForStars(pRawStars))));
      const pStars = Math.max(pRawStars, starsForLevel(pLv));
      const pVTier = Math.max(1, Math.min(pStars, owned.visual_tier || pStars));
      const pSpr = resolvePetSpriteKey(petId, pVTier, 'front');
      const pVis = resolveItemVisual(petId, lineage);
      const pUrl = spriteInfo(pSpr) ? `/assets/pets/${pSpr}.png` : pVis.url;
      const isAct = activePet.uid === owned.uid;
      const isEq = Boolean(eqPet && (eqPet.uid === owned.uid || eqPet.id === owned.id));
      const label = owned.nickname ? `${owned.nickname}` : shortSpecies;

      return `
        <div class="rpg-pet-bubble s2-rarity-${pStars} ${isAct ? 'active' : ''}" data-pet="${owned.uid}">
          <div class="s2-pet-avatar-circle tier-${pStars}">
            <img src="${pUrl}" alt="${escapeHtml(label)}" />
            ${isEq ? '<span class="s2-pet-eq-dot" title="Equipped">✓</span>' : ''}
          </div>
          <span class="s2-pet-b-name">${escapeHtml(label)}</span>
          <span class="rpg-stars">${'★'.repeat(pStars)}</span>
          <span class="s2-pet-b-lv">${isEq ? `✓ Active • Lv.${pLv}` : `Lv. ${pLv}`}</span>
        </div>
      `;
    }

    const pSpr = resolvePetSpriteKey(petId, 1, 'front');
    const pVis = resolveItemVisual(petId, lineage);
    const pUrl = spriteInfo(pSpr) ? `/assets/pets/${pSpr}.png` : pVis.url;
    const canAdopt = (p.gold | 0) >= 2500 || pets.length === 0;
    const adoptCostTitle = pets.length === 0 ? 'Free' : '2,500 Gold';
    const adoptCostHtml = pets.length === 0 ? 'Free' : `2,500 ${GOLD_ICO_HTML}`;

    return `
      <div class="rpg-pet-bubble pet-v2-adopt-bubble" data-adopt-pet="${petId}" title="Bond with ${escapeHtml(cdef.name || petId)} (${adoptCostTitle})">
        <div class="s2-pet-avatar-circle not-owned">
          <img src="${pUrl}" alt="${escapeHtml(cdef.name || petId)}" />
        </div>
        <span class="s2-pet-b-name">${escapeHtml(shortSpecies)}</span>
        <button type="button" class="btn-gold s2-btn-rainbow small pet-v2-adopt-btn" data-adopt-pet="${petId}" ${canAdopt ? '' : 'disabled'}>
          🐾 Bond (${adoptCostHtml})
        </button>
      </div>
    `;
  }).join('');

  return `
    <!-- BLOCK 1: Sakura Sky-Island Sanctuary Stage (Single Companion + Form Toggle + Poses + Emotes) -->
    <div class="s2-pet-sanctuary-stage pet-v2-hero-stage">
      <div class="s2-pet-stage-ribbon">
        <span>🐾 ${escapeHtml(displayName.toUpperCase())} • ★${stars} ${escapeHtml(tierFormTitle.toUpperCase())} (LV. ${bondLv}/30)</span>
      </div>

      <div class="s2-single-nest-diorama">
        <div class="pet-v2-hero-focus s2-single-nest-focus s2-loco-${loco} ${dirView === 'move' ? 'is-moving-preview' : ''}" data-dir-view="${escapeHtml(dirView)}">
          <img class="s2-single-nest-magic" src="/assets/ui/fx_magic_circle.png" alt="" />
          ${activeEmoteBubbleHtml}
          <img class="pet-v2-stage-pet s2-nest-pet-hero pet-v2-tier-${visualTier} s2-loco-${loco} ${visualTier === 3 ? 'pet-v2-shimmer' : ''} ${heroPose === 'flip' && dirView === 'front' ? 'pet-v2-flip-spin' : ''} ${dirView === 'move' ? 'is-moving-preview' : ''}" src="${heroUrl}" style="--pet-ui-scale:${heroUiScale};${heroFilter}" alt="${escapeHtml(displayName)}" />
        </div>
        <div class="s2-nest-pet-tag">
          <b>${escapeHtml(shortDisplayName)}</b>
          <span>${escapeHtml(fam?.icon || '🐾')} ${escapeHtml(fam?.name || 'Soul-Bond Companion')} • ★${stars}</span>
        </div>
      </div>

      <!-- Form Appearance Switcher, Angle/Motion View & Quick Companion Actions -->
      <div class="pet-v2-stage-bar s2-pet-stage-controls">
        <div class="pet-v2-vtier-bar">
          <span class="pet-v2-vtier-label">Form:</span>
          <button type="button" class="pet-v2-vtier-pill ${visualTier === 1 ? 'active' : ''}" data-pet-vtier="1">★1</button>
          <button type="button" class="pet-v2-vtier-pill ${visualTier === 2 ? 'active' : ''}" data-pet-vtier="2" ${stars >= 2 ? '' : 'disabled'} title="${stars >= 2 ? 'Awakened Form' : 'Unlocks at Lv. 10'}">${stars >= 2 ? '★2' : '🔒Lv10'}</button>
          <button type="button" class="pet-v2-vtier-pill ${visualTier === 3 ? 'active' : ''}" data-pet-vtier="3" ${stars >= 3 ? '' : 'disabled'} title="${stars >= 3 ? 'Radiant Form' : 'Unlocks at Lv. 20'}">${stars >= 3 ? '★3' : '🔒Lv20'}</button>
        </div>
        <div class="pet-v2-vtier-bar pet-v2-dir-bar" title="Preview 360° Directional Views & Locomotion">
          <button type="button" class="pet-v2-vtier-pill ${dirView === 'front' ? 'active' : ''}" data-pet-dir-view="front">Front</button>
          <button type="button" class="pet-v2-vtier-pill ${dirView === 'side' ? 'active' : ''}" data-pet-dir-view="side">Side</button>
          <button type="button" class="pet-v2-vtier-pill ${dirView === 'back' ? 'active' : ''}" data-pet-dir-view="back">Back</button>
          <button type="button" class="pet-v2-vtier-pill ${dirView === 'move' ? 'active' : ''}" data-pet-dir-view="move">${moveVerbLabel}</button>
        </div>
        <button type="button" id="pet-interact-btn" class="pet-v2-mini-pill green">👋 Pat (+${PET2.INTERACT_BOND_XP} EXP)</button>
        <button type="button" id="pet-claim-gift-btn" class="pet-v2-mini-pill gold" ${giftReady ? '' : 'disabled'}>
          ${giftReady ? '🎁 Daily Gift!' : '✓ Gift Claimed'}
        </button>
        ${isEquipped
          ? `<span class="pet-v2-mini-pill equipped">✓ Equipped</span>`
          : `<button type="button" class="pet-v2-mini-pill blue" data-equip-pet="${activePet.uid}">✨ Equip</button>`}
      </div>

      <!-- Compact Collapsible Drawer for Poses, 8 Emotes & Nickname -->
      <details class="s2-pet-pose-drawer" ${ui.petPoseDrawerOpen ? 'open' : ''}>
        <summary class="s2-pet-pose-summary">🎭 Poses (${activePoses.length}/${unlockedPoses.length}), 8 Emotes &amp; Nickname ▾</summary>
        <div class="s2-pet-pose-drawer-body">
          <!-- Nickname Row -->
          <div class="pet-v2-rename-row" style="margin-top:4px;">
            <input type="text" id="pet-rename-input" class="pet-v2-rename-input" maxlength="${PET2.NICKNAME_MAX_LEN}" placeholder="Custom nickname (max 14 chars)…" value="${escapeHtml(activePet.nickname || '')}" />
            <button type="button" id="pet-rename-save" class="btn-gold small pet-v2-rename-btn">✏️ Rename</button>
          </div>

          <!-- Interactive Multi-Select Pose & Trick Rotation Bar -->
          <div class="pet-v2-pose-hint">
            <span>🔄 <b>Idle Pose Rotation:</b> ${activePoses.length}/${unlockedPoses.length} active</span>
            <small>Tap unlocked poses to toggle ✓ (cycles in village &amp; stage)</small>
          </div>
          <div class="pet-v2-pose-bar">
            ${poseBarHtml}
          </div>

          <!-- 8-Expression Bust Emotes -->
          <div class="pet-v2-emotes-grid" style="margin-top:4px;">
            ${emotesHtml}
          </div>
        </div>
      </details>
    </div>

    <!-- BLOCK 2: Progress & Care Card (♥ Companion Level 1-30 + 🍓 Hunger 🟢/🟠/🔴) -->
    <div class="rpg-pet-details pet-v2-main-card">
      <div class="pet-v2-bar-container">
        <div class="pet-v2-bar-head">
          <span><img src="/assets/ui/icon_pet_bond.png" class="s2-inline-ico" alt="" /> <b>Companion Level ${bondLv} / 30</b></span>
          <span>${bondLv >= 30 ? 'MAX LV. 30 ✨' : `${bondXp} / ${bondNeed} EXP`}</span>
        </div>
        <div class="rpg-stat-track pet-v2-bond-track">
          <div class="rpg-stat-fill pet-v2-fill-bond" style="width:${bondPct}%;"></div>
        </div>
        <div class="pet-v2-milestone-hint">${escapeHtml(nextMilestoneText)}</div>
      </div>

      <div class="pet-v2-bar-container" style="margin-top:4px;">
        <div class="pet-v2-bar-head">
          <span><img src="/assets/ui/icon_berry.png" class="s2-inline-ico" alt="" /> <b>Fullness / Hunger: ${hunger}%</b></span>
          <span class="pet-v2-hunger-badge" style="color:${hungerColor};">${escapeHtml(hungerBadge)}</span>
        </div>
        <div class="rpg-stat-track pet-v2-hunger-track">
          <div class="rpg-stat-fill" style="width:${hunger}%; background:${hungerColor};"></div>
        </div>
      </div>

      <!-- Candy Care & Reroll Action Row -->
      <div class="pet-v2-care-actions-row" style="margin-top:6px;">
        <button type="button" id="pet-feed" data-pet-action="feed" class="btn-gold s2-btn-green pet-v2-candy-btn" ${canFeed ? '' : 'disabled'}>
          <img src="/assets/ui/icon_berry.png" class="s2-candy-ico" alt="" />
          <div class="s2-candy-label">
            <span>🍓 Feed Star-Berry</span>
            <small>(+35% Fullness &amp; Bond EXP • ${PET.FEED_COST} 🍓)</small>
          </div>
        </button>

        <button type="button" id="pet-reroll-v2" data-pet-action="reroll" class="btn-gold s2-btn-blue pet-v2-candy-btn" ${!canAffordReroll || (hasUnlockedMythic && !ui.confirmMythicWipe) ? 'disabled' : ''}>
          <span class="s2-candy-emoji">🎲</span>
          <div class="s2-candy-label">
            <span>Reroll Unlocked Trait (${lockedCount}/${maxLocksAllowed} 🔒)</span>
            <small>(${GOLD_ICO_HTML} ${rCost.gold.toLocaleString()} + 🍓 ${rCost.berries})</small>
          </div>
        </button>
      </div>
    </div>

    <!-- BLOCK 3: Soul-Link Ultimate & 2 Companion Trait Slots -->
    ${costumeSectionHtml}

    <div class="rpg-traits-box pet-v2-traits-card">
      <div class="s2-traits-heading">
        <span>🧬 <b>2 Companion Trait Slots</b> (Boosts Soul-Link Ultimate &amp; Match Stats):</span>
        <span class="pet-v2-lock-summary">🔒 ${lockedCount}/${maxLocksAllowed} Locked</span>
      </div>
      ${slotsHtml}

      ${hasUnlockedMythic ? `
        <label class="pet-v2-mythic-warn">
          <input type="checkbox" id="pet-confirm-mythic" ${ui.confirmMythicWipe ? 'checked' : ''} />
          <span>⚠️ An unlocked slot has a <b>MYTHIC</b> roll! Check to allow overwriting it.</span>
        </label>
      ` : ''}
    </div>

    <!-- BLOCK 4: 4 Canonical Soul-Bond Companions Switcher -->
    <div class="s2-pet-bottom-dock-area">
      <div class="s2-pet-carousel-head">
        <span>🐾 <b>Soul-Bond Companions</b> — Switch active companion or bond with a new friend!</span>
      </div>
      <div class="rpg-pet-selector pet-v2-4bar">
        ${fourPetsHtml}
      </div>
    </div>
  `;
}

/**
 * Handles Pet Sanctuary click events inside `RpgUI`. Returns `true` if handled.
 */
export function bindPetSanctuaryClick(ui, e, p) {
  const target = e?.target || e;
  if (!target || typeof target !== 'object') return false;

  const drawerEl = ui.el?.querySelector?.('.s2-pet-pose-drawer');
  if (drawerEl) {
    ui.petPoseDrawerOpen = Boolean(drawerEl.open);
  }

  const sendAction = (type, payload, onSuccess) => {
    if (typeof ui.send === 'function') {
      return ui.send(type, payload, onSuccess);
    }
    if (typeof ui.executeAction === 'function') {
      return ui.executeAction(type, payload, onSuccess);
    }
  };

  // 1. Visual Tier Selector (1..3)
  const vtierBtn = target.closest?.('[data-pet-vtier]');
  if (vtierBtn && !vtierBtn.disabled) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const tier = Number(vtierBtn.dataset.petVtier);
    sendAction('pet_set_visual_tier', { petUid: pet.uid, petId: pet.id, tier }, () => {
      ui.toast(`✨ Switched to ★${tier} appearance form!`);
    });
    return true;
  }

  // 1b. Directional View & Locomotion Preview (Front | Side | Back | Move)
  const dirBtn = target.closest?.('[data-pet-dir-view]');
  if (dirBtn) {
    const dir = dirBtn.dataset.petDirView || 'front';
    ui.petStageDirView = dir;
    const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
    if (worldPet) {
      if (dir === 'back') {
        worldPet.facing?.set?.(true, true);
        worldPet.applyView?.('back', true);
      } else if (dir === 'side' || dir === 'move') {
        worldPet.facing?.set?.(true, false);
        worldPet.applyView?.(dir, true);
      } else {
        worldPet.facing?.set?.(true, false);
        worldPet.applyView?.('front', true);
      }
    }
    ui.render();
    return true;
  }

  // 2. Interactive Multi-Select Pose & Trick Bar
  const poseBtn = target.closest?.('[data-pet-pose]');
  if (poseBtn && !poseBtn.disabled) {
    ui.petPoseDrawerOpen = true;
    ui.petStageDirView = 'front';
    const pose = poseBtn.dataset.petPose;
    const pet = ui.resolveActivePet?.();
    if (pet) {
      const rawStars = Math.max(1, Math.min(3, Number(pet.stars ?? PETS[pet.id]?.rarity) || 1));
      const bondLv = Math.max(1, Math.min(30, Math.max(Number(pet.bond_lv) || 1, minLevelForStars(rawStars))));
      const curPoses = normalizeActivePoses(pet.active_poses, bondLv);
      let nextPoses;
      if (curPoses.includes(pose)) {
        if (curPoses.length > 1) {
          nextPoses = curPoses.filter((x) => x !== pose);
          if (ui.petPreviewPose === pose || !nextPoses.includes(ui.petPreviewPose)) {
            ui.petPreviewPose = nextPoses[0] || 'front';
          }
        } else {
          nextPoses = curPoses;
          ui.petPreviewPose = pose;
          ui.toast?.('🐾 At least 1 pose stays active in rotation!');
        }
      } else {
        nextPoses = normalizeActivePoses([...curPoses, pose], bondLv);
        ui.petPreviewPose = pose;
      }
      pet.active_poses = nextPoses;
      const prof = ui.profile;
      if (prof?.equipped?.pet && (prof.equipped.pet.uid === pet.uid || prof.equipped.pet.id === pet.id)) {
        prof.equipped.pet.active_poses = nextPoses;
      }
      const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
      if (worldPet) {
        worldPet.setActivePoses?.(nextPoses);
        worldPet.act?.(ui.petPreviewPose);
      }
      if (typeof ui.request === 'function') {
        Promise.resolve(ui.request('pet_set_poses', { petUid: pet.uid, petId: pet.id, poses: nextPoses })).catch(() => {});
      }
    } else {
      ui.petPreviewPose = pose;
    }
    ui.render();
    return true;
  }

  // 3. Expression Bust Emote Preview
  const emoteBtn = target.closest?.('[data-pet-emote]');
  if (emoteBtn && !emoteBtn.disabled) {
    ui.petPoseDrawerOpen = true;
    const emo = emoteBtn.dataset.petEmote;
    ui.petPreviewEmote = ui.petPreviewEmote === emo ? null : emo;
    const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
    if (worldPet && ui.petPreviewEmote) {
      worldPet.showEmote(emo);
    }
    ui.render();
    return true;
  }

  // 4. Nickname Save
  const renameBtn = target.closest?.('#pet-rename-save');
  if (renameBtn) {
    ui.petPoseDrawerOpen = true;
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const inp = ui.el?.querySelector('#pet-rename-input');
    const nickname = inp ? inp.value : '';
    sendAction('pet_rename', { petUid: pet.uid, petId: pet.id, nickname }, (r) => {
      ui.toast(r.nickname ? `✏️ Renamed companion to "${r.nickname}"!` : '✏️ Restored original species name.');
    });
    return true;
  }

  // 5. Pat Companion (+10 Bond XP)
  const interactBtn = target.closest?.('#pet-interact-btn');
  if (interactBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    sendAction('pet_interact', { petUid: pet.uid, petId: pet.id }, (r) => {
      ui.petPreviewEmote = 'love';
      const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
      if (worldPet) {
        worldPet.bubble?.('💖');
        worldPet.actions?.act?.('happy', 1.2);
      }
      ui.toast(r.leveledUp
        ? `💖 Soul-Bond Level Up! Lv.${r.bond_lv} unlocked new tricks & expressions!`
        : `💕 Cuddled companion! +${PET2.INTERACT_BOND_XP} EXP (Lv.${r.bond_lv})`);
    });
    return true;
  }

  // 6. Claim Daily Gift
  const giftBtn = target.closest?.('#pet-claim-gift-btn');
  if (giftBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    sendAction('pet_claim_gift', { petUid: pet.uid, petId: pet.id }, (r) => {
      ui.petPreviewEmote = 'joy';
      const g = r.gift || {};
      ui.toast(`🎁 Daily Gift: +${g.gold || 0} 🪙, +${g.berries || 0} 🍓${g.stardust ? `, +${g.stardust} 🌟` : ''}!`);
    });
    return true;
  }

  // 7. Equip Companion
  const equipBtn = target.closest?.('[data-equip-pet]');
  if (equipBtn) {
    const uid = equipBtn.dataset.equipPet;
    sendAction('wardrobe_equip', { slot: 'pet', itemId: uid }, () => {
      ui.toast('✨ Companion equipped!');
    });
    return true;
  }

  // 8. Feed Star-Berry
  const feedBtn = target.closest?.('#pet-feed, [data-pet-action="feed"]');
  if (feedBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    sendAction('pet_feed', { petUid: pet.uid, petId: pet.id, feedBond: true }, (r) => {
      const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
      if (worldPet) {
        worldPet.bubble?.('🍓');
        worldPet.actions?.act?.('happy', 1.0);
      }
      ui.toast(r.leveledUp
        ? `🍓 Fed Star-Berry! Companion Level Up → Lv.${r.bond_lv}!`
        : `🍓 Fed Star-Berry! Fullness: ${r.hunger ?? 100}%, +${r.expGained || 90} EXP (Lv.${r.bond_lv})!`);
    });
    return true;
  }

  // 9. Costume Soul-Link Link Button
  const costumeBtn = target.closest?.('#pet-costume-save');
  if (costumeBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const sel = ui.el?.querySelector('#pet-costume-select');
    const costumeId = sel ? sel.value : '';
    ui.previewPetCostumeId = undefined;
    sendAction('pet_equip_costume', { petUid: pet.uid, petId: pet.id, costumeId }, (r) => {
      ui.handlePetEquipCostumeReply?.(r);
    });
    return true;
  }

  // 10. Trait Slot Lock Toggle
  const lockBtn = target.closest?.('[data-pet-lock], [data-pet-action="toggle-lock"]');
  if (lockBtn) {
    e.stopPropagation?.();
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const slotIdx = Number(lockBtn.dataset.petLock ?? lockBtn.closest?.('[data-trait-slot]')?.dataset?.traitSlot ?? 0);
    sendAction('pet_lock_slot', { petUid: pet.uid, petId: pet.id, slotIdx }, (r) => {
      ui.toast(r.locked ? `🔒 Locked Slot ${slotIdx + 1}!` : `🔓 Unlocked Slot ${slotIdx + 1}.`);
    });
    return true;
  }

  // 11. Confirm Mythic Overwrite Checkbox
  if (target.id === 'pet-confirm-mythic' || target.closest?.('#pet-confirm-mythic')) {
    const cb = target.id === 'pet-confirm-mythic' ? target : target.closest('#pet-confirm-mythic');
    ui.confirmMythicWipe = Boolean(cb.checked);
    ui.render();
    return true;
  }

  // 12. Reroll Unlocked Slots
  const rerollBtn = target.closest?.('#pet-reroll-v2, [data-pet-action="reroll"]');
  if (rerollBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    sendAction('pet_reroll', {
      petUid: pet.uid,
      petId: pet.id,
      confirmMythicWipe: Boolean(ui.confirmMythicWipe),
    }, (r) => {
      ui.confirmMythicWipe = false;
      const summary = (r.slots || [])
        .slice(0, 2)
        .filter(Boolean)
        .map((s) => `${ALL_SLOT_LINES[s.stat]?.name || s.stat} [${(s.tier || '').toUpperCase()}]`)
        .join(' • ');
      ui.toast(r.harmonyTriggered
        ? `💞 Couple Harmony Reroll! ${summary}`
        : `🎲 Rerolled Slots! ${summary}`);
    });
    return true;
  }

  // 13. Switch Active Pet
  const petSelectBtn = target.closest?.('[data-pet]');
  if (petSelectBtn && !target.closest?.('[data-adopt-pet]')) {
    ui.selectedPetUid = petSelectBtn.dataset.pet;
    ui.petPreviewEmote = null;
    ui.petPreviewPose = 'front';
    ui.previewPetCostumeId = undefined;
    ui.render();
    return true;
  }

  // 14. Bond / Adopt Companion
  const adoptBtn = target.closest?.('[data-adopt-pet]');
  if (adoptBtn) {
    const petId = adoptBtn.dataset.adoptPet;
    sendAction('pet_adopt', { petId }, (r) => {
      ui.handlePetAdoptReply?.(r);
    });
    return true;
  }

  return false;
}
