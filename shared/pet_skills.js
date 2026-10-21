// shared/pet_skills.js — Per-pet, per-mode active & passive skill definitions (Tier ★1 / ★2 / ★3).
// Used by Village, Fishing Dock, Sky Monopoly, Moon Bunny Defense, Sky Cloud Dash, and Casino.

import { getPetDef } from './pet_catalog.js';

export const PET_MODE_SCALE = Object.freeze({
  village:    1.00,
  monopoly:   0.75,
  casino:     0.85,
  moon_bunny: 0.95,
  cloud_dash: 0.85,
});

export const PET_SKILLS = {
  royal_charm: {
    id: 'royal_charm',
    petId: 'pet_ragdoll',
    name: '🎀 Royal Charm & Crystal Ribbon',
    icon: '/assets/ui/icon_skill_royal_charm.png',
    summary: [
      '★1: 12% chance for -25% Monopoly rent • 2-bounce Crystal Orb (60% dmg, +10% coins) • +10% Glide hang-time',
      '★2: 16% chance for -25% Monopoly rent • 2-bounce Crystal Orb (75% dmg, +15% coins) • +15% Glide hang-time',
      '★3: 20% chance for -25% Monopoly rent • 3-bounce Crystal Orb (90% dmg, +20% coins) • +20% Glide & Jelly Magnet',
    ],
    modes: {
      village: {
        nuzzleFx: 'fx_heart',
        auraParticles: [0, 1, 2],
      },
      fishing: {
        catchPose: 'happy',
        catchFx: 'fx_heart',
      },
      monopoly: {
        trigger: 'onPayRent',
        charmChancePct: [12, 16, 20],
        rentDiscountPct: [25, 25, 25],
        fxTheme: 'heart',
      },
      moon_bunny: {
        trigger: 'every3rdShot',
        projectileFx: 'fx_heart',
        bounces: [2, 2, 3],
        shotDmgPct: [60, 75, 90],
        coinDropBonusPct: [10, 15, 20],
      },
      cloud_dash: {
        glideHangBonusPct: [10, 15, 20],
        jellyMagnetRadiusM: [0.8, 1.0, 1.3],
      },
      casino: {
        winPose: 'happy',
        winFx: 'fx_heart',
      },
    },
  },

  plasma_blast: {
    id: 'plasma_blast',
    petId: 'pet_nyx',
    name: '⚡ Midnight Plasma Blast',
    icon: '/assets/ui/icon_skill_plasma_blast.png',
    summary: [
      '★1: +10% Ultimate charge on Monopoly doubles • AoE Plasma (1.2m, 70% dmg) • +0.5s Cloud Dash Fever',
      '★2: +15% Ultimate charge on Monopoly doubles • AoE Plasma (1.5m, 85% dmg) • +0.75s Cloud Dash Fever',
      '★3: +20% Ultimate charge on Monopoly doubles • AoE Plasma (1.8m, 100% dmg + 2-target chain lightning) • +1.0s Fever',
    ],
    modes: {
      village: {
        nuzzleFx: 'fx_star',
        auraParticles: [0, 1, 2],
      },
      fishing: {
        catchPose: 'happy',
        catchFx: 'fx_star',
      },
      monopoly: {
        trigger: 'onRollDoubles',
        ultChargeBonusPct: [10, 15, 20],
        fxTheme: 'lightning',
      },
      moon_bunny: {
        trigger: 'every3rdShot',
        projectileFx: 'fx_lightning',
        aoeRadiusM: [1.2, 1.5, 1.8],
        shotDmgPct: [70, 85, 100],
        chainTargets: [0, 0, 2],
      },
      cloud_dash: {
        feverDurationBonusSec: [0.5, 0.75, 1.0],
      },
      casino: {
        winPose: 'happy',
        winFx: 'fx_lightning',
      },
    },
  },

  foxfire: {
    id: 'foxfire',
    petId: 'pet_kitsune',
    name: '🌸 Nine-Tail Shrine Foxfire',
    icon: '/assets/ui/icon_skill_foxfire.png',
    summary: [
      '★1: +5% Pass-GO salary in Monopoly • 1 Homing Foxfire (+10% crit, heals Moon Bunny 1% HP) • +1 Air Hop',
      '★2: +8% Pass-GO salary in Monopoly • 2 Homing Foxfires (+10% crit, heals Moon Bunny 2% HP) • +1 Air Hop',
      '★3: +12% Pass-GO salary in Monopoly • 3 Homing Foxfires (+10% crit, heals Moon Bunny 3% HP) • +2 Air Hops',
    ],
    modes: {
      village: {
        nuzzleFx: 'fx_petal',
        auraParticles: [0, 1, 2],
      },
      fishing: {
        catchPose: 'happy',
        catchFx: 'fx_petal',
      },
      monopoly: {
        trigger: 'onPassGo',
        salaryBonusPct: [5, 8, 12],
        fxTheme: 'petal',
      },
      moon_bunny: {
        trigger: 'every3rdShot',
        projectileFx: 'fx_flame',
        missiles: [1, 2, 3],
        critBonusPct: [10, 10, 10],
        healBunnyPct: [1, 2, 3],
      },
      cloud_dash: {
        extraAirHops: [1, 1, 1],
      },
      casino: {
        winPose: 'happy',
        winFx: 'fx_petal',
      },
    },
  },

  bubble_shield: {
    id: 'bubble_shield',
    petId: 'pet_skywhale',
    name: '🫧 Celestial Bubble Shield',
    icon: '/assets/ui/icon_skill_bubble_shield.png',
    summary: [
      '★1: 4% Monopoly build rebate • Slows Slimes 25% for 3s (1.5m) • Cloud Dash shield every 20s',
      '★2: 6% Monopoly build rebate • Slows Slimes 35% for 3s (1.5m) • Cloud Dash shield every 16s',
      '★3: 8% Monopoly build rebate + blocks 1 rival hex • Slows Slimes 45% for 3s • Cloud Dash shield every 12s',
    ],
    modes: {
      village: {
        nuzzleFx: 'fx_bubble',
        auraParticles: [0, 1, 2],
      },
      fishing: {
        catchPose: 'happy',
        catchFx: 'fx_bubble',
      },
      monopoly: {
        trigger: 'onBuildUpgrade',
        buildRebatePct: [4, 6, 8],
        blockRivalHexPerMatch: [0, 0, 1],
        fxTheme: 'bubble',
      },
      moon_bunny: {
        trigger: 'every3rdShot',
        projectileFx: 'fx_bubble',
        slowPct: [25, 35, 45],
        slowDurationSec: [3, 3, 3],
        aoeRadiusM: [1.5, 1.5, 1.5],
      },
      cloud_dash: {
        shieldCooldownSec: [30, 25, 20],
      },
      casino: {
        winPose: 'happy',
        winFx: 'fx_bubble',
      },
    },
  },
};

export function getPetSkill(petIdOrSkillId) {
  if (PET_SKILLS[petIdOrSkillId]) return PET_SKILLS[petIdOrSkillId];
  const def = getPetDef(petIdOrSkillId);
  return PET_SKILLS[def.skill] || PET_SKILLS.royal_charm;
}

/**
 * Resolves a tier-scaled skill parameter for a given skill/pet ID, mode, key, and star rank (1..3).
 */
export function skillValue(skillIdOrPetId, mode, key, stars = 1) {
  const skill = getPetSkill(skillIdOrPetId);
  const modeCfg = skill?.modes?.[mode];
  if (!modeCfg || !(key in modeCfg)) return null;
  const val = modeCfg[key];
  if (!Array.isArray(val)) return val;
  const idx = Math.max(0, Math.min(val.length - 1, (stars | 0) - 1));
  return val[idx];
}
