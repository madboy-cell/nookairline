// client/js/pet_sanctuary_ui.js — Minimal 3-Block Pet Sanctuary V2.5 UI
// Block 1: Single-Pet Hero Stage & Interactive Pose/Emote Strip
// Block 2: The 2 Progress Bars (♥ Level 1-30 + 🍓 Hunger 🟢/🟠/🔴)
// Block 3: Loadout (👗 Pet Costume Slot + 2 Rollable Trait Slots + 4-Pet Switcher / Adopt)

import {
  PETS, PET_FAMILIES, PET_EMOTES, getPetDef, resolvePetSpriteKey, resolvePetEmoteKey, resolvePetUiScale,
} from '/shared/pet_catalog.js';
import {
  PET2, MAX_TRAIT_SLOTS, HUNGER, hungerZone, PET_MILESTONES, unlockedPosesForLevel, starsForLevel,
  rerollCost, bondXpToNext, unlockedEmotesForBond, ALL_SLOT_LINES, sanitizeNickname,
} from '/shared/pet_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { PET } from '/shared/rpg_rules.js';
import { fmtNum, escapeHtml, resolveItemVisual } from './ui_components.js';
import { spriteInfo } from './assets.js';

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
  const stars = Math.max(1, Math.min(3, pet.stars ?? PETS[pet.id]?.rarity ?? 1));
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
      icon: def.icon || '✨',
      name: `${def.name} (${valStr})`,
      desc: def.desc,
      locked: Boolean(slot.locked),
      isPerk: def.kind === 'perk',
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
        <div class="rpg-card-title">🥚 Soul-Bond Pet Sanctuary</div>
        <div class="s2-empty-notice">No companion found! Adopt one below to begin your journey.</div>
      </div>
    `;
  }

  const pdef = getPetDef(activePet.id);
  const fam = PET_FAMILIES[pdef?.family];
  const bondLv = Math.max(1, Math.min(30, Number(activePet.bond_lv || activePet.level) || 1));
  const stars = Math.max(1, Math.min(3, activePet.stars ?? starsForLevel(bondLv)));
  const visualTier = Math.max(1, Math.min(stars, activePet.visual_tier || stars));
  const displayName = activePet.nickname ? `${activePet.nickname} (${pdef.name})` : pdef.name;
  const tierFormTitle = pdef.tierNames?.[visualTier] || pdef.name;
  const eqPet = p.equipped?.pet;
  const isEquipped = Boolean(eqPet && (eqPet.uid === activePet.uid || eqPet.id === activePet.id));

  // --------------------------------------------------------------------------
  // BLOCK 1: Single-Pet Hero Stage & Interactive Pose/Emote Strip
  // --------------------------------------------------------------------------
  const heroPose = ui.petPreviewPose || 'front';
  const stagePose = heroPose === 'flip' ? 'happy' : heroPose;
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

  // Interactive Pose & Trick Bar: Stand (Lv.1), Nap (Lv.5), Happy (Lv.10), Cast (Lv.15), 360° Flip (Lv.25)
  const poseList = [
    { pose: 'front', label: '🐾 Stand', reqLv: 1 },
    { pose: 'sleep', label: '💤 Nap', reqLv: 5 },
    { pose: 'happy', label: '😊 Happy', reqLv: 10 },
    { pose: 'cast', label: '🪄 Cast', reqLv: 15 },
    { pose: 'flip', label: '🎪 360° Flip', reqLv: 25 },
  ];
  const poseBarHtml = poseList.map(({ pose, label, reqLv }) => {
    const isUnlocked = bondLv >= reqLv;
    const isActive = heroPose === pose;
    const btnLabel = isUnlocked ? label : `🔒 ${label.split(' ')[1] || label} (Lv.${reqLv})`;
    return `
      <button type="button" class="pet-v2-pose-btn ${isUnlocked ? 'unlocked' : 'locked'} ${isActive ? 'active' : ''}" data-pet-pose="${pose}" ${isUnlocked ? '' : 'disabled'}>
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
  // BLOCK 2: The 2 Progress Bars (♥ Level 1–30 + 🍓 Hunger 🟢/🟠/🔴)
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
  const canFeed = (p.berries | 0) >= PET.FEED_COST && hunger < 100;

  // --------------------------------------------------------------------------
  // BLOCK 3: Loadout (👗 Costume Soul-Link + 2 Trait Slots + 4-Pet Switcher/Adopt)
  // --------------------------------------------------------------------------
  // Costume Soul-Link
  let costumeSectionHtml = '';
  if (bondLv < 15 && stars < 2) {
    costumeSectionHtml = `
      <div class="pet-v2-costume-card pet-v2-costume-locked">
        <div class="pet-v2-costume-lock-banner">
          🔒 Unlocks at Lv. 15 — Equip any owned Costume so your pet channels its Ultimate Skill (in Moon Bunny) &amp; Particle Trail!
        </div>
      </div>
    `;
  } else {
    const ownedCostumes = Object.keys(p.inventory || {}).filter((cid) => OUTFITS[cid]);
    const currentCostume = activePet.costume_id || '';
    const optionsHtml = [
      `<option value="" ${!currentCostume ? 'selected' : ''}>None (Default Pet FX)</option>`,
      ...ownedCostumes.map((cid) => {
        const o = OUTFITS[cid];
        const isSel = currentCostume === cid;
        return `<option value="${cid}" ${isSel ? 'selected' : ''}>${escapeHtml(o.name || cid)} (★${o.rarity || 1}${o.walkFx ? ' 🌟 Trail' : ''})</option>`;
      }),
    ].join('');

    costumeSectionHtml = `
      <div class="pet-v2-costume-card">
        <div class="pet-v2-costume-head">
          <span>👗 <b>Pet Costume Soul-Link (Lv. 15)</b></span>
          <span class="pet-v2-costume-hint">Channels Particle Trail &amp; Moon Bunny Ultimate</span>
        </div>
        <div class="pet-v2-costume-row">
          <select id="pet-costume-select" class="rpg-select pet-v2-costume-select">
            ${optionsHtml}
          </select>
          <button type="button" id="pet-costume-save" class="btn-gold s2-btn-blue small">👗 Link Costume</button>
        </div>
      </div>
    `;
  }

  // 2 Companion Trait Slots (MAX_TRAIT_SLOTS = 2: Slot 0 = Lv.1, Slot 1 = Lv.10)
  const openCount = stars >= 2 || bondLv >= 10 ? 2 : 1;
  const slotsArr = Array.isArray(activePet.slots) ? activePet.slots : [null, null];
  let lockedCount = 0;
  let hasUnlockedMythic = false;
  for (let i = 0; i < openCount; i++) {
    const s = slotsArr[i];
    if (s?.locked) lockedCount++;
    else if (s?.tier === 'mythic') hasUnlockedMythic = true;
  }
  const maxLocksAllowed = Math.max(0, openCount - 1);
  const rCost = rerollCost(lockedCount);
  const canAffordReroll = (p.gold | 0) >= rCost.gold && (p.berries | 0) >= rCost.berries;

  const slotsHtml = [0, 1].map((idx) => {
    const isOpen = idx < openCount;
    if (!isOpen) {
      return `
        <div class="rpg-trait-slot pet-v2-slot-locked" data-trait-slot="${idx}">
          <span class="s2-trait-tag">[SLOT 2 — LV. 10]</span>
          <span class="s2-trait-name">🔒 Unlocks automatically at Companion Lv. 10 (★2 Awakened)</span>
          <span class="s2-trait-lock">Locked</span>
        </div>
      `;
    }

    const line = formatSlotLine(slotsArr[idx]);
    const tier = line?.tier || 'common';
    const isLocked = Boolean(line?.locked);
    const canToggleLock = isLocked || lockedCount < maxLocksAllowed;
    const tagLabel = line ? `[${tier.toUpperCase()} ${line.isPerk ? 'PERK' : 'STAT'}]` : '[OPEN SLOT]';

    return `
      <div class="rpg-trait-slot rpg-tier-${tier} ${isLocked ? 'is-slot-locked' : ''}" data-trait-slot="${idx}">
        <span class="s2-trait-tag">${tagLabel}</span>
        <div class="pet-v2-slot-body">
          <span class="s2-trait-name">${line ? `${line.icon} ${escapeHtml(line.name)}` : 'Empty Slot — Reroll to Awaken'}</span>
          ${line?.desc ? `<small class="pet-v2-slot-desc">${escapeHtml(line.desc)}</small>` : ''}
        </div>
        <button type="button" class="pet-v2-lock-btn ${isLocked ? 'locked' : ''}" data-pet-lock="${idx}" ${canToggleLock ? '' : 'disabled'} title="${isLocked ? 'Unlock Slot' : (canToggleLock ? 'Lock Slot for Next Reroll' : 'At least 1 slot must stay unlocked')}">
          <img src="/assets/ui/icon_pet_lock.png" class="s2-inline-ico" alt="" />
          ${isLocked ? '🔒 Locked' : '🔓 Lock'}
        </button>
      </div>
    `;
  }).join('');

  // 4 Canonical Companions Bar (Switch or Adopt)
  const canonicalIds = ['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale'];
  const fourPetsHtml = canonicalIds.map((petId) => {
    const cdef = PETS[petId] || {};
    const owned = pets.find((x) => x.id === petId);
    if (owned) {
      const pStars = Math.max(1, Math.min(3, owned.stars ?? cdef.rarity ?? 1));
      const pVTier = Math.max(1, Math.min(pStars, owned.visual_tier || pStars));
      const pSpr = resolvePetSpriteKey(petId, pVTier, 'front');
      const pVis = resolveItemVisual(petId, lineage);
      const pUrl = spriteInfo(pSpr) ? `/assets/pets/${pSpr}.png` : pVis.url;
      const isAct = activePet.uid === owned.uid;
      const isEq = Boolean(eqPet && (eqPet.uid === owned.uid || eqPet.id === owned.id));
      const label = owned.nickname ? `${owned.nickname}` : (cdef.name || petId);

      return `
        <div class="rpg-pet-bubble s2-rarity-${pStars} ${isAct ? 'active' : ''}" data-pet="${owned.uid}">
          <div class="s2-pet-avatar-circle">
            <img src="${pUrl}" alt="${escapeHtml(label)}" />
          </div>
          <span class="s2-pet-b-name">${escapeHtml(label)}</span>
          <span class="rpg-stars">${'★'.repeat(pStars)}</span>
          <span class="s2-pet-b-lv">${isEq ? '✓ Equipped' : `Lv. ${owned.bond_lv || 1}`}</span>
        </div>
      `;
    }

    // Not owned yet -> Adopt button
    const pSpr = resolvePetSpriteKey(petId, 1, 'front');
    const pVis = resolveItemVisual(petId, lineage);
    const pUrl = spriteInfo(pSpr) ? `/assets/pets/${pSpr}.png` : pVis.url;
    const canAdopt = (p.gold | 0) >= 2500 || pets.length === 0;
    const adoptCostLabel = pets.length === 0 ? 'Free' : '2,500 🪙';

    return `
      <div class="rpg-pet-bubble pet-v2-adopt-bubble">
        <div class="s2-pet-avatar-circle not-owned">
          <img src="${pUrl}" alt="${escapeHtml(cdef.name || petId)}" />
        </div>
        <span class="s2-pet-b-name">${escapeHtml(cdef.name || petId)}</span>
        <button type="button" class="btn-gold s2-btn-rainbow small pet-v2-adopt-btn" data-adopt-pet="${petId}" ${canAdopt ? '' : 'disabled'}>
          🥚 Adopt (${adoptCostLabel})
        </button>
      </div>
    `;
  }).join('');

  return `
    <!-- BLOCK 1: Single-Pet Hero Stage & Interactive Pose/Emote Strip -->
    <div class="s2-pet-sanctuary-stage pet-v2-hero-stage">
      <div class="pet-v2-single-stage">
        <div class="pet-v2-hero-focus">
          ${activeEmoteBubbleHtml}
          <img class="pet-v2-stage-pet pet-v2-tier-${visualTier} ${visualTier === 3 ? 'pet-v2-shimmer' : ''}" src="${heroUrl}" style="--pet-ui-scale:${heroUiScale};${heroFilter}" alt="${escapeHtml(displayName)}" />
          <span class="pet-v2-stage-label">${escapeHtml(tierFormTitle)}</span>
        </div>
      </div>

      <!-- Appearance Form Pills (★1 Cute / ★2 Awakened / ★3 Radiant) -->
      <div class="pet-v2-vtier-bar">
        <span class="pet-v2-vtier-label">✨ Form:</span>
        <button type="button" class="pet-v2-vtier-pill ${visualTier === 1 ? 'active' : ''}" data-pet-vtier="1">
          ★1 Cute
        </button>
        <button type="button" class="pet-v2-vtier-pill ${visualTier === 2 ? 'active' : ''}" data-pet-vtier="2" ${stars >= 2 ? '' : 'disabled'}>
          ${stars >= 2 ? '★2 Awakened' : '🔒 ★2 Awakened'}
        </button>
        <button type="button" class="pet-v2-vtier-pill ${visualTier === 3 ? 'active' : ''}" data-pet-vtier="3" ${stars >= 3 ? '' : 'disabled'}>
          ${stars >= 3 ? '★3 Radiant' : '🔒 ★3 Radiant'}
        </button>
      </div>

      <!-- Inline Nickname Editor -->
      <div class="pet-v2-rename-row">
        <input type="text" id="pet-rename-input" class="pet-v2-rename-input" maxlength="${PET2.NICKNAME_MAX_LEN}" placeholder="Nickname (max 14 chars)…" value="${escapeHtml(activePet.nickname || '')}" />
        <button type="button" id="pet-rename-save" class="btn-gold small pet-v2-rename-btn">✏️ Save</button>
      </div>

      <!-- Quick Action Buttons -->
      <div class="pet-v2-quick-bar">
        <button type="button" id="pet-interact-btn" class="btn-gold s2-btn-green small">
          👋 Pat (+${PET2.INTERACT_BOND_XP} EXP)
        </button>
        <button type="button" id="pet-claim-gift-btn" class="btn-gold s2-btn-rainbow small" ${giftReady ? '' : 'disabled'}>
          ${giftReady ? '🎁 Claim Daily Gift!' : '✓ Gift Claimed'}
        </button>
        ${isEquipped
          ? `<span class="pet-v2-equipped-pill">✓ Equipped Companion</span>`
          : `<button type="button" class="btn-gold s2-btn-blue small" data-equip-pet="${activePet.uid}">✨ Equip Companion</button>`}
      </div>

      <!-- Interactive Pose & Trick Bar -->
      <div class="pet-v2-pose-bar">
        ${poseBarHtml}
      </div>

      <!-- 8-Expression Bust Emotes -->
      <div class="pet-v2-emotes-grid">
        ${emotesHtml}
      </div>
    </div>

    <!-- BLOCK 2: The 2 Progress Bars (♥ Level 1-30 + 🍓 Hunger 🟢/🟠/🔴) -->
    <div class="rpg-pet-details pet-v2-progress-card">
      <div class="pet-v2-bar-container">
        <div class="pet-v2-bar-head">
          <span><b>♥ Companion Level ${bondLv} / 30</b></span>
          <span>${bondLv >= 30 ? 'MAX LV. 30 ✨' : `${bondXp} / ${bondNeed} EXP`}</span>
        </div>
        <div class="rpg-stat-track pet-v2-bond-track">
          <div class="rpg-stat-fill pet-v2-fill-bond" style="width:${bondPct}%;"></div>
        </div>
        <div class="pet-v2-milestone-hint">${escapeHtml(nextMilestoneText)}</div>
      </div>

      <div class="pet-v2-bar-container">
        <div class="pet-v2-bar-head">
          <span><b>🍓 Hunger / Fullness: ${hunger}%</b></span>
          <span class="pet-v2-hunger-badge" style="color:${hungerColor};">${escapeHtml(hungerBadge)}</span>
        </div>
        <div class="pet-v2-hunger-row">
          <div class="rpg-stat-track pet-v2-hunger-track">
            <div class="rpg-stat-fill" style="width:${hunger}%; background:${hungerColor};"></div>
          </div>
          <button type="button" id="pet-feed" class="btn-gold s2-btn-green small pet-v2-feed-btn" ${canFeed ? '' : 'disabled'}>
            🍓 Feed Star-Berry (+35% Hunger &amp; EXP — ${PET.FEED_COST} 🍓)
          </button>
        </div>
      </div>
    </div>

    <!-- BLOCK 3: Loadout (👗 Costume Slot + 2 Trait Slots + 4-Pet Switcher/Adopt) -->
    ${costumeSectionHtml}

    <div class="rpg-traits-box pet-v2-traits-card">
      <div class="s2-traits-heading">
        <span>🧬 <b>2 Companion Trait Slots</b> (Lock favorite rolls before Rerolling):</span>
        <span class="pet-v2-lock-summary">🔒 ${lockedCount}/${maxLocksAllowed} Locked</span>
      </div>
      ${slotsHtml}

      ${hasUnlockedMythic ? `
        <label class="pet-v2-mythic-warn">
          <input type="checkbox" id="pet-confirm-mythic" ${ui.confirmMythicWipe ? 'checked' : ''} />
          <span>⚠️ An unlocked slot has a <b>MYTHIC</b> roll! Check to allow overwriting it.</span>
        </label>
      ` : ''}

      <div class="pet-v2-reroll-row">
        <button type="button" id="pet-reroll-v2" class="btn-gold s2-btn-blue small" ${!canAffordReroll || (hasUnlockedMythic && !ui.confirmMythicWipe) ? 'disabled' : ''}>
          🎲 Reroll Unlocked Slot(s) (${lockedCount} Locked)
          <small>
            <img src="/assets/ui/icon_gold.png" class="s2-inline-ico" alt="" /> ${rCost.gold.toLocaleString()} Gold +
            <img src="/assets/ui/icon_berry.png" class="s2-inline-ico" alt="" /> ${rCost.berries} Berries
          </small>
        </button>
      </div>
    </div>

    <!-- 4 Canonical Companions Bar -->
    <div class="rpg-couple-box pet-v2-collection-card">
      <div class="s2-pet-carousel-label">
        <span>🐾 <b>Soul-Bond Companions</b> — Switch your active companion or adopt a new friend!</span>
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
  if (vtierBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const tier = Number(vtierBtn.dataset.petVtier);
    sendAction('pet_set_visual_tier', { petUid: pet.uid, petId: pet.id, tier }, () => {
      ui.toast(`✨ Switched to ★${tier} appearance form!`);
    });
    return true;
  }

  // 2. Interactive Pose & Trick Bar
  const poseBtn = target.closest?.('[data-pet-pose]');
  if (poseBtn && !poseBtn.disabled) {
    const pose = poseBtn.dataset.petPose;
    ui.petPreviewPose = pose;
    const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
    if (worldPet) {
      worldPet.act(pose);
    }
    ui.render();
    return true;
  }

  // 3. Expression Bust Emote Preview
  const emoteBtn = target.closest?.('[data-pet-emote]');
  if (emoteBtn && !emoteBtn.disabled) {
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
  const feedBtn = target.closest?.('#pet-feed');
  if (feedBtn) {
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    sendAction('pet_feed', { petUid: pet.uid, petId: pet.id }, (r) => {
      const worldPet = ui.world?.local?.pet || (typeof window !== 'undefined' && (window.__neora?.world?.local?.pet || window.world?.local?.pet));
      if (worldPet) {
        worldPet.bubble?.('🍓');
        worldPet.actions?.act?.('happy', 1.0);
      }
      ui.toast(`🍓 Fed Star-Berry! Hunger: ${r.hunger ?? 100}%, +${r.expGained || 50} EXP!`);
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
    sendAction('pet_equip_costume', { petUid: pet.uid, petId: pet.id, costumeId }, (r) => {
      ui.handlePetEquipCostumeReply?.(r);
    });
    return true;
  }

  // 10. Trait Slot Lock Toggle
  const lockBtn = target.closest?.('[data-pet-lock]');
  if (lockBtn) {
    e.stopPropagation?.();
    const pet = ui.resolveActivePet();
    if (!pet) return true;
    const slotIdx = Number(lockBtn.dataset.petLock);
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
  const rerollBtn = target.closest?.('#pet-reroll-v2');
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
        ? `💞 Couple Harmony Reroll! (+20✨) ${summary}`
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
    ui.render();
    return true;
  }

  // 14. Adopt Pet
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
