// shared/skill_vfx_defs.js — Pure 3D Pre-Built Effekseer (.efkefc) Skill & Combo VFX Recipes (EffekseerForWebGL 1.80.7).
// Every Monster Skill, Goddess Ultimate, and Weapon-Class Combo owns 100% exclusive CC0 3D `.efkefc` layers at full power from Day 1.

export const PREBUILT_EFFEKSEER_SPECS = Object.freeze({
  // ==========================================================================
  // 20 MONSTER SKILL SCROLLS + 1 GODDESS CHARM ULTIMATE
  // ==========================================================================
  sk_pollen_ring: Object.freeze({
    peakMs: 680,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_MagicHeal2.efkefc', at: 'caster', scale: 0.72, yOffset: 0.06, maxLifeMs: 2800 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Holy2.efkefc', at: 'caster', scale: 1.68, yOffset: 0.06, delayMs: 380, maxLifeMs: 2200 }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Cure3.efkefc', at: 'caster', scale: 0.50, yOffset: 0.12, maxLifeMs: 2400 }),
    ]),
  }),

  sk_jelly_shield: Object.freeze({
    peakMs: 640,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk03/Tktk03_ToonWater.efkefc', at: 'caster', scale: 0.74, yOffset: 0.06 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine11.efkefc', at: 'caster', scale: 1.96, yOffset: 0.08 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_AquaPoint.efkefc', at: 'caster', scale: 1.58, yOffset: 0.08 }),
    ]),
  }),

  sk_tusk_rush: Object.freeze({
    peakMs: 215,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/AndrewFM01/AndrewFM01_drill.efkefc',
        at: 'caster',
        forwardOffset: 0.65,
        followCaster: true,
        yawOffset: Math.PI,
        scale: 0.42,
        yOffset: 0.44,
        maxLifeMs: 680,
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph11.efkefc', at: 'midpoint', scale: 1.62, yOffset: 0.12, maxLifeMs: 880 }),
    ]),
  }),

  sk_crystal_fan: Object.freeze({
    peakMs: 500,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/Tktk01/Tktk01_Light4.efkefc',
        at: 'caster',
        forwardOffset: 0.65,
        scale: 0.56,
        yOffset: 0.25,
        yawOffset: 0,
        color: Object.freeze([130, 235, 255, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_IcicleBroken.efkefc', at: 'target', scale: 1.42, yOffset: 0.15 }),
    ]),
  }),

  sk_echo_drain: Object.freeze({
    peakMs: 600,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Pierre02/Pierre02_BloodLance.efkefc', at: 'caster', scale: 0.66, yOffset: 0.06 }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Dark2.efkefc', at: 'caster', scale: 0.50, yOffset: 0.10 }),
    ]),
  }),

  sk_gravity_spin: Object.freeze({
    peakMs: 620,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/NextSoft01/NextSoft01_MagicTornade.efkefc',
        at: 'caster',
        scale: 0.62,
        yOffset: 0.08,
        color: Object.freeze([195, 145, 255, 250]),
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Gohlem1.efkefc', at: 'caster', scale: 1.88, yOffset: 0.08 }),
      Object.freeze({ url: '/assets/effekseer/AndrewFM01/AndrewFM01_smallTexturesSquareWave_orbital.efkefc', at: 'caster', scale: 0.48, yOffset: 0.28 }),
    ]),
  }),

  sk_earthshatter: Object.freeze({
    peakMs: 500,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Gohlem5.efkefc', at: 'midpoint', scale: 1.42, yOffset: 0.08 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Rock2.efkefc', at: 'caster', scale: 1.62, yOffset: 0.08, delayMs: 100 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Rock1.efkefc', at: 'target', scale: 1.68, yOffset: 0.08, delayMs: 60 }),
    ]),
  }),

  sk_prism_beam: Object.freeze({
    peakMs: 440,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/Basic/Basic_Laser01.efkefc',
        at: 'caster',
        forwardOffset: 1.35,
        scale: Object.freeze([0.40, 0.40, 0.74]),
        yOffset: 0.64,
        yawOffset: 0,
      }),
      Object.freeze({
        url: '/assets/effekseer/MAGICALxSPIRAL/MxS_MagicArea.efkefc',
        at: 'caster',
        scale: 2.02,
        yOffset: 0.06,
        color: Object.freeze([175, 235, 255, 245]),
      }),
      Object.freeze({ url: '/assets/effekseer/Basic/Basic_Laser03.efkefc', at: 'caster', scale: 0.52, yOffset: 0.88 }),
    ]),
  }),

  sk_zephyr_vault: Object.freeze({
    peakMs: 460,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Arrow2.efkefc', at: 'caster', forwardOffset: 0.70, scale: 0.50, yOffset: 0.46, delayMs: 50 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph4.efkefc', at: 'target', scale: 1.58, yOffset: 0.14 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph10.efkefc', at: 'caster', scale: 1.48, yOffset: 0.08, delayMs: 100 }),
    ]),
  }),

  sk_frost_nova: Object.freeze({
    peakMs: 360,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine3.efkefc', at: 'caster', scale: 2.05, yOffset: 0.06, color: Object.freeze([155, 240, 255, 250]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_A_Undine2.efkefc', at: 'caster', scale: 1.95, yOffset: 0.08, color: Object.freeze([165, 242, 255, 245]) }),
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_MagicCold.efkefc', at: 'caster', scale: 0.74, yOffset: -2.45, speed: 2.6 }),
    ]),
  }),

  sk_foxfire_wisps: Object.freeze({
    peakMs: 520,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_FirePot2.efkefc', at: 'caster', forwardOffset: 0.55, scale: 1.56, yOffset: 0.22, color: Object.freeze([255, 55, 235, 245]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Salamander3.efkefc', at: 'target', scale: 1.54, yOffset: 0.12, delayMs: 40, color: Object.freeze([255, 65, 235, 245]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Magic2_wind.efkefc', at: 'target', scale: 1.58, yOffset: 0.28, delayMs: 240, color: Object.freeze([255, 135, 215, 250]) }),
    ]),
  }),

  sk_mirror_shell: Object.freeze({
    peakMs: 440,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine13.efkefc', at: 'caster', scale: 1.78, yOffset: 0.08, delayMs: 60, color: Object.freeze([185, 245, 255, 235]) }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_hozyo2.efkefc', at: 'caster', scale: 0.54, yOffset: 0.10, color: Object.freeze([185, 242, 255, 235]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Water_Impact.efkefc', at: 'caster', scale: 1.56, yOffset: 0.12 }),
    ]),
  }),

  sk_tailwind_gale: Object.freeze({
    peakMs: 420,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Wind2.efkefc', at: 'caster', scale: 0.40, yOffset: 0.08, color: Object.freeze([185, 255, 225, 175]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Magic1_wind.efkefc', at: 'caster', scale: 2.10, yOffset: 0.06, delayMs: 140 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_A_Sylph2.efkefc', at: 'caster', scale: 1.78, yOffset: 0.08, delayMs: 60 }),
    ]),
  }),

  sk_koi_whirlpool: Object.freeze({
    peakMs: 560,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine8.efkefc', at: 'target', scale: 1.72, yOffset: 0.08 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine4.efkefc', at: 'target', scale: 1.82, yOffset: 0.06, delayMs: 200 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Magic1_water.efkefc', at: 'target', scale: 2.05, yOffset: 0.05, delayMs: 280 }),
    ]),
  }),

  sk_sakura_tempest: Object.freeze({
    peakMs: 500,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph15.efkefc', at: 'caster', followCaster: true, scale: 2.22, yOffset: 0.08, delayMs: 120, color: Object.freeze([255, 150, 208, 235]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Holy1.efkefc', at: 'caster', followCaster: true, scale: 2.02, yOffset: 0.08, delayMs: 200 }),
      Object.freeze({ url: '/assets/effekseer/Pierre02/Pierre02_FeatherBomb.efkefc', at: 'caster', followCaster: true, scale: 0.44, yOffset: 0.22, speed: 1.75, color: Object.freeze([255, 155, 205, 170]) }),
    ]),
  }),

  sk_solar_meteor: Object.freeze({
    peakMs: 690,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_meteo1.efkefc', at: 'target', scale: 1.62, yOffset: 0.08 }),
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_MagicMeteo.efkefc', at: 'target', scale: 0.56, yOffset: 0.06 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Salamander1.efkefc', at: 'target', scale: 1.56, yOffset: 0.08, delayMs: 220, color: Object.freeze([255, 165, 70, 245]) }),
    ]),
  }),

  sk_chain_lightning: Object.freeze({
    peakMs: 450,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/AndrewFM01/AndrewFM01_electric_dust.efkefc', at: 'midpoint', scale: 0.94, yOffset: 0.38 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Thunder3.efkefc', at: 'target', scale: 1.68, yOffset: 0.14 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Thunder1.efkefc', at: 'target', scale: 1.82, yOffset: 0.06, delayMs: 170, color: Object.freeze([135, 235, 255, 250]) }),
    ]),
  }),

  sk_star_brand: Object.freeze({
    peakMs: 340,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack2.efkefc', at: 'target', scale: 1.76, yOffset: 0.36, yawOffset: -0.48, pitchOffset: 0.25, delayMs: 100, color: Object.freeze([255, 85, 115, 255]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack6.efkefc', at: 'target', scale: 1.76, yOffset: 0.36, yawOffset: 1.05, pitchOffset: -0.35, delayMs: 100, color: Object.freeze([255, 215, 95, 255]) }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_hozyo1.efkefc', at: 'caster', scale: 0.50, yOffset: 0.08, speed: 1.35, color: Object.freeze([255, 215, 95, 240]) }),
    ]),
  }),

  sk_time_dilation: Object.freeze({
    peakMs: 420,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Magic2_holy.efkefc', at: 'caster', scale: 0.84, yOffset: 0.07, delayMs: 120, color: Object.freeze([255, 218, 110, 245]) }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Magic1.efkefc', at: 'caster', scale: 0.52, yOffset: 0.12, color: Object.freeze([255, 222, 115, 235]) }),
      Object.freeze({ url: '/assets/effekseer/AndrewFM01/AndrewFM01_magic_circle.efkefc', at: 'caster', scale: 1.38, yOffset: 0.06, pitchOffset: -1.5708, lockWorldYaw: true, delayMs: 60, color: Object.freeze([255, 210, 95, 240]) }),
    ]),
  }),

  sk_supernova_cleave: Object.freeze({
    peakMs: 460,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Pierre01/Pierre01_SonicBoom.efkefc', at: 'midpoint', forwardOffset: 0.65, scale: 0.46, yOffset: 0.30, color: Object.freeze([255, 225, 160, 215]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Salamander11.efkefc', at: 'target', scale: 1.75, yOffset: 0.08, delayMs: 40, color: Object.freeze([255, 215, 145, 215]) }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Impact.efkefc', at: 'target', scale: 2.10, yOffset: 0.10, delayMs: 200 }),
    ]),
  }),

  ult_charm_sanctuary: Object.freeze({
    peakMs: 1160,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Pierre02/Pierre02_Benediction.efkefc', at: 'caster', scale: 0.38, yOffset: 0.22 }),
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_PowerUp.efkefc', at: 'caster', scale: 0.58, yOffset: 0.08, delayMs: 480 }),
      Object.freeze({
        url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine5.efkefc',
        at: 'caster',
        scale: 1.50,
        yOffset: 0.06,
        delayMs: 280,
        color: Object.freeze([255, 240, 175, 205]),
      }),
    ]),
  }),

  // ==========================================================================
  // 9 WEAPON-CLASS 1–2–3 COMBOS (MELEE / RANGED / MAGIC)
  // ==========================================================================
  combo_melee_1: Object.freeze({
    peakMs: 220,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack1.efkefc', at: 'caster', forwardOffset: 1.05, scale: 1.50, yOffset: 0.36 }),
    ]),
  }),

  combo_melee_2: Object.freeze({
    peakMs: 230,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Sword7.efkefc', at: 'caster', forwardOffset: 1.00, scale: 0.42, yOffset: 0.38 }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Sword2.efkefc', at: 'target', scale: 0.20, yOffset: 0.44 }),
    ]),
  }),

  combo_melee_3: Object.freeze({
    peakMs: 290,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_MagicSword.efkefc', at: 'caster', forwardOffset: 1.05, scale: 0.46, yOffset: 0.12 }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Sword11.efkefc', at: 'caster', forwardOffset: 0.95, scale: 0.40, yOffset: 0.38, delayMs: 60 }),
    ]),
  }),

  combo_ranged_1: Object.freeze({
    peakMs: 155,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Gun5.efkefc', at: 'caster', forwardOffset: 0.58, scale: 0.50, yOffset: 0.52 }),
      Object.freeze({
        url: '/assets/effekseer/Basic/Basic_Simple_Sprite_BillBoard.efkefc',
        at: 'projectile',
        forwardOffset: 0.58,
        yOffset: 0.62,
        targetYOffset: 0.54,
        travelMs: 165,
        arcHeight: 0.10,
        scale: 0.22,
        color: Object.freeze([255, 238, 155, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/Tktk03/Tktk03_ToonHit.efkefc', at: 'target', scale: 0.34, yOffset: 0.46, delayMs: 145 }),
    ]),
  }),

  combo_ranged_2: Object.freeze({
    peakMs: 165,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Gun3.efkefc', at: 'caster', forwardOffset: 0.58, scale: 0.46, yOffset: 0.52 }),
      Object.freeze({
        url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Lance3.efkefc',
        at: 'projectile',
        forwardOffset: 0.58,
        yOffset: 0.62,
        targetYOffset: 0.54,
        travelMs: 170,
        arcHeight: 0.12,
        scale: 1.65,
        color: Object.freeze([235, 255, 195, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Spear2.efkefc', at: 'target', scale: 0.44, yOffset: 0.45, delayMs: 150 }),
    ]),
  }),

  combo_ranged_3: Object.freeze({
    peakMs: 175,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/Tktk01/Tktk01_Arrow1.efkefc',
        at: 'projectile',
        forwardOffset: 0.58,
        yOffset: 0.64,
        targetYOffset: 0.56,
        travelMs: 175,
        arcHeight: 0.15,
        scale: 0.42,
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack5.efkefc', at: 'target', scale: 1.65, yOffset: 0.32, delayMs: 150 }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack5.efkefc', at: 'target', scale: 1.38, yOffset: 0.56, delayMs: 225 }),
    ]),
  }),

  combo_magic_1: Object.freeze({
    peakMs: 185,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/Tktk01/Tktk01_Magic2.efkefc',
        at: 'caster',
        forwardOffset: 0.55,
        scale: 0.34,
        yOffset: 0.56,
        color: Object.freeze([155, 225, 255, 245]),
      }),
      Object.freeze({
        url: '/assets/effekseer/Basic/Basic_Homing_Laser01.efkefc',
        at: 'projectile',
        forwardOffset: 0.50,
        yOffset: 0.66,
        targetYOffset: 0.54,
        travelMs: 210,
        arcHeight: 0.20,
        scale: 0.40,
        color: Object.freeze([165, 230, 255, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/NextSoft01/NextSoft01_MagicThunder.efkefc', at: 'target', scale: 0.54, yOffset: 0.15, delayMs: 185 }),
    ]),
  }),

  combo_magic_2: Object.freeze({
    peakMs: 195,
    layers: Object.freeze([
      Object.freeze({
        url: '/assets/effekseer/Pierre02/Pierre02_FireBall.efkefc',
        at: 'caster',
        forwardOffset: 0.55,
        scale: 0.34,
        yOffset: 0.02,
        color: Object.freeze([225, 170, 255, 255]),
      }),
      Object.freeze({
        url: '/assets/effekseer/Basic/Basic_Laser02.efkefc',
        at: 'projectile',
        forwardOffset: 0.50,
        yOffset: 0.66,
        targetYOffset: 0.54,
        travelMs: 205,
        arcHeight: 0.18,
        scale: Object.freeze([0.16, 0.16, 0.20]),
        color: Object.freeze([215, 150, 255, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Thunder2.efkefc', at: 'target', scale: 1.26, yOffset: 0.15, delayMs: 185 }),
    ]),
  }),

  combo_magic_3: Object.freeze({
    peakMs: 215,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Magic1_holy.efkefc', at: 'caster', scale: 1.15, yOffset: 0.08, maxLifeMs: 620 }),
      Object.freeze({
        url: '/assets/effekseer/Basic/Basic_Simple_Track1.efkefc',
        at: 'projectile',
        forwardOffset: 0.52,
        yOffset: 0.68,
        targetYOffset: 0.56,
        travelMs: 220,
        arcHeight: 0.32,
        scale: 0.48,
        color: Object.freeze([175, 255, 210, 255]),
      }),
      Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph3.efkefc', at: 'target', scale: 1.95, yOffset: 0.25, delayMs: 190 }),
    ]),
  }),
});

export const SKILL_VFX_DEFS = Object.freeze({
  sk_pollen_ring: Object.freeze({
    id: 'sk_pollen_ring',
    label: '🌸 Golden Pollen Sanctuary',
    category: 'monster_skill',
    biomeHint: 'meadow',
    isDirectional: false,
    durationMs: 4600,
    shakeAmp: 0.06,
    bloomFlash: 0.22,
    hitStopMs: 24,
    screenTint: '#FDE047',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 820, weaponScaleBoost: 1.22 }),
    screenJuice: Object.freeze({ shake: 0.06, shakeDur: 0.16, shakeAmp: 0.06, bloomFlash: 0.22, hitStopMs: 24, screenTint: '#FDE047' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_pollen_ring,
  }),

  sk_jelly_shield: Object.freeze({
    id: 'sk_jelly_shield',
    label: '🫧 Dewdrop Aqua Canopy',
    category: 'monster_skill',
    biomeHint: 'meadow',
    isDirectional: false,
    durationMs: 1650,
    shakeAmp: 0.07,
    bloomFlash: 0.22,
    hitStopMs: 28,
    screenTint: '#38BDF8',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 740, weaponScaleBoost: 1.18 }),
    screenJuice: Object.freeze({ shake: 0.07, shakeDur: 0.16, shakeAmp: 0.07, bloomFlash: 0.22, hitStopMs: 28, screenTint: '#38BDF8' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_jelly_shield,
  }),

  sk_tusk_rush: Object.freeze({
    id: 'sk_tusk_rush',
    label: '💨 Gale-Tusk Spiral Charge',
    category: 'monster_skill',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 950,
    shakeAmp: 0.14,
    bloomFlash: 0.24,
    hitStopMs: 40,
    screenTint: '#34D399',
    rigChoreo: Object.freeze({ pose: 'dash_thrust', poseMs: 820, dashDist: 5.2, weaponScaleBoost: 1.28 }),
    screenJuice: Object.freeze({ shake: 0.14, shakeDur: 0.22, shakeAmp: 0.14, bloomFlash: 0.24, hitStopMs: 40, screenTint: '#34D399' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_tusk_rush,
  }),

  sk_crystal_fan: Object.freeze({
    id: 'sk_crystal_fan',
    label: '💎 Prism Shard Volley',
    category: 'monster_skill',
    biomeHint: 'hollow',
    isDirectional: true,
    durationMs: 1200,
    shakeAmp: 0.10,
    bloomFlash: 0.24,
    hitStopMs: 32,
    screenTint: '#67E8F9',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 560, weaponScaleBoost: 1.24 }),
    screenJuice: Object.freeze({ shake: 0.10, shakeDur: 0.18, shakeAmp: 0.10, bloomFlash: 0.24, hitStopMs: 32, screenTint: '#67E8F9' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_crystal_fan,
  }),

  sk_echo_drain: Object.freeze({
    id: 'sk_echo_drain',
    label: '🦇 Crimson Lantern Siphon',
    category: 'monster_skill',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 1400,
    shakeAmp: 0.08,
    bloomFlash: 0.22,
    hitStopMs: 30,
    screenTint: '#F43F5E',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 720, weaponScaleBoost: 1.2 }),
    screenJuice: Object.freeze({ shake: 0.08, shakeDur: 0.18, shakeAmp: 0.08, bloomFlash: 0.22, hitStopMs: 30, screenTint: '#F43F5E' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_echo_drain,
  }),

  sk_gravity_spin: Object.freeze({
    id: 'sk_gravity_spin',
    label: '🪨 Astral Mandala Vortex',
    category: 'monster_skill',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 1500,
    shakeAmp: 0.12,
    bloomFlash: 0.26,
    hitStopMs: 38,
    screenTint: '#C084FC',
    rigChoreo: Object.freeze({ pose: 'spin_cleave', poseMs: 680, weaponScaleBoost: 1.3 }),
    screenJuice: Object.freeze({ shake: 0.12, shakeDur: 0.22, shakeAmp: 0.12, bloomFlash: 0.26, hitStopMs: 38, screenTint: '#C084FC' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_gravity_spin,
  }),

  sk_earthshatter: Object.freeze({
    id: 'sk_earthshatter',
    label: '🌲 Ancient Megalith Quake',
    category: 'boss_skill',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 1650,
    shakeAmp: 0.24,
    bloomFlash: 0.32,
    hitStopMs: 65,
    screenTint: '#F59E0B',
    rigChoreo: Object.freeze({ pose: 'leap_slam', poseMs: 640, weaponScaleBoost: 1.35 }),
    screenJuice: Object.freeze({ shake: 0.24, shakeDur: 0.3, shakeAmp: 0.24, bloomFlash: 0.32, hitStopMs: 65, screenTint: '#F59E0B' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_earthshatter,
  }),

  sk_prism_beam: Object.freeze({
    id: 'sk_prism_beam',
    label: '🕸️ Celestial Prism Ray',
    category: 'boss_skill',
    biomeHint: 'hollow',
    isDirectional: true,
    isBeam: true,
    durationMs: 1500,
    shakeAmp: 0.16,
    bloomFlash: 0.32,
    hitStopMs: 52,
    screenTint: '#A78BFA',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 880, weaponScaleBoost: 1.3 }),
    screenJuice: Object.freeze({ shake: 0.16, shakeDur: 0.28, shakeAmp: 0.16, bloomFlash: 0.32, hitStopMs: 52, screenTint: '#A78BFA' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_prism_beam,
  }),

  sk_zephyr_vault: Object.freeze({
    id: 'sk_zephyr_vault',
    label: '🍃 Zephyr Backstep Volley',
    category: 'monster_skill',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 1050,
    shakeAmp: 0.08,
    bloomFlash: 0.22,
    hitStopMs: 28,
    screenTint: '#34D399',
    rigChoreo: Object.freeze({ pose: 'bow_draw', poseMs: 560, weaponScaleBoost: 1.26 }),
    screenJuice: Object.freeze({ shake: 0.08, shakeDur: 0.16, shakeAmp: 0.08, bloomFlash: 0.22, hitStopMs: 28, screenTint: '#34D399' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_zephyr_vault,
  }),

  sk_frost_nova: Object.freeze({
    id: 'sk_frost_nova',
    label: '❄️ Permafrost Spore Nova',
    category: 'monster_skill',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 1500,
    shakeAmp: 0.14,
    bloomFlash: 0.34,
    hitStopMs: 48,
    screenTint: '#38BDF8',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 700, weaponScaleBoost: 1.24 }),
    screenJuice: Object.freeze({ shake: 0.14, shakeDur: 0.22, shakeAmp: 0.14, bloomFlash: 0.34, hitStopMs: 48, screenTint: '#38BDF8' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_frost_nova,
  }),

  sk_foxfire_wisps: Object.freeze({
    id: 'sk_foxfire_wisps',
    label: '🔥 Fox-Fire Homing Wisps',
    category: 'monster_skill',
    biomeHint: 'reef',
    isDirectional: true,
    durationMs: 1400,
    shakeAmp: 0.09,
    bloomFlash: 0.26,
    hitStopMs: 32,
    screenTint: '#F472B6',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 620, weaponScaleBoost: 1.25 }),
    screenJuice: Object.freeze({ shake: 0.09, shakeDur: 0.18, shakeAmp: 0.09, bloomFlash: 0.26, hitStopMs: 32, screenTint: '#F472B6' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_foxfire_wisps,
  }),

  sk_mirror_shell: Object.freeze({
    id: 'sk_mirror_shell',
    label: '🛡️ Tide-Mirror Carapace',
    category: 'monster_skill',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 1650,
    shakeAmp: 0.07,
    bloomFlash: 0.24,
    hitStopMs: 28,
    screenTint: '#67E8F9',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 740, weaponScaleBoost: 1.20 }),
    screenJuice: Object.freeze({ shake: 0.07, shakeDur: 0.16, shakeAmp: 0.07, bloomFlash: 0.24, hitStopMs: 28, screenTint: '#67E8F9' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_mirror_shell,
  }),

  sk_tailwind_gale: Object.freeze({
    id: 'sk_tailwind_gale',
    label: '🌬️ Tailwind Feather Gale',
    category: 'monster_skill',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 1500,
    shakeAmp: 0.06,
    bloomFlash: 0.22,
    hitStopMs: 24,
    screenTint: '#6EE7B7',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 720, weaponScaleBoost: 1.22 }),
    screenJuice: Object.freeze({ shake: 0.06, shakeDur: 0.15, shakeAmp: 0.06, bloomFlash: 0.22, hitStopMs: 24, screenTint: '#6EE7B7' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_tailwind_gale,
  }),

  sk_koi_whirlpool: Object.freeze({
    id: 'sk_koi_whirlpool',
    label: '💧 Cleansing Koi Whirlpool',
    category: 'monster_skill',
    biomeHint: 'reef',
    isDirectional: true,
    durationMs: 3800,
    shakeAmp: 0.10,
    bloomFlash: 0.26,
    hitStopMs: 36,
    screenTint: '#38BDF8',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 660, weaponScaleBoost: 1.24 }),
    screenJuice: Object.freeze({ shake: 0.10, shakeDur: 0.18, shakeAmp: 0.10, bloomFlash: 0.26, hitStopMs: 36, screenTint: '#38BDF8' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_koi_whirlpool,
  }),

  sk_sakura_tempest: Object.freeze({
    id: 'sk_sakura_tempest',
    label: '🌸 Thousand-Petal Tempest',
    category: 'boss_skill',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 2950,
    shakeAmp: 0.18,
    bloomFlash: 0.36,
    hitStopMs: 55,
    screenTint: '#F472B6',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 920, weaponScaleBoost: 1.34 }),
    screenJuice: Object.freeze({ shake: 0.18, shakeDur: 0.28, shakeAmp: 0.18, bloomFlash: 0.36, hitStopMs: 55, screenTint: '#F472B6' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_sakura_tempest,
  }),

  sk_solar_meteor: Object.freeze({
    id: 'sk_solar_meteor',
    label: '☄️ Solar Meteor Drop',
    category: 'monster_skill',
    biomeHint: 'caldera',
    isDirectional: true,
    durationMs: 2850,
    shakeAmp: 0.26,
    bloomFlash: 0.42,
    hitStopMs: 70,
    screenTint: '#FB923C',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 740, weaponScaleBoost: 1.28 }),
    screenJuice: Object.freeze({ shake: 0.26, shakeDur: 0.26, shakeAmp: 0.26, bloomFlash: 0.42, hitStopMs: 70, screenTint: '#FB923C' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_solar_meteor,
  }),

  sk_chain_lightning: Object.freeze({
    id: 'sk_chain_lightning',
    label: '⚡ Astral Chain Lightning',
    category: 'monster_skill',
    biomeHint: 'caldera',
    isDirectional: true,
    durationMs: 1250,
    shakeAmp: 0.16,
    bloomFlash: 0.34,
    hitStopMs: 45,
    screenTint: '#FACC15',
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 560, weaponScaleBoost: 1.26 }),
    screenJuice: Object.freeze({ shake: 0.16, shakeDur: 0.20, shakeAmp: 0.16, bloomFlash: 0.34, hitStopMs: 45, screenTint: '#FACC15' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_chain_lightning,
  }),

  sk_star_brand: Object.freeze({
    id: 'sk_star_brand',
    label: "🎯 Executioner's Star-Brand",
    category: 'monster_skill',
    biomeHint: 'caldera',
    isDirectional: true,
    durationMs: 1300,
    shakeAmp: 0.12,
    bloomFlash: 0.28,
    hitStopMs: 42,
    screenTint: '#F472B6',
    rigChoreo: Object.freeze({ pose: 'slash_2', poseMs: 540, weaponScaleBoost: 1.30 }),
    screenJuice: Object.freeze({ shake: 0.12, shakeDur: 0.19, shakeAmp: 0.12, bloomFlash: 0.28, hitStopMs: 42, screenTint: '#F472B6' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_star_brand,
  }),

  sk_time_dilation: Object.freeze({
    id: 'sk_time_dilation',
    label: '⏳ Chronos Time-Dilation',
    category: 'monster_skill',
    biomeHint: 'caldera',
    isDirectional: false,
    durationMs: 1650,
    shakeAmp: 0.10,
    bloomFlash: 0.30,
    hitStopMs: 36,
    screenTint: '#FDE047',
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 820, weaponScaleBoost: 1.26 }),
    screenJuice: Object.freeze({ shake: 0.10, shakeDur: 0.20, shakeAmp: 0.10, bloomFlash: 0.30, hitStopMs: 36, screenTint: '#FDE047' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_time_dilation,
  }),

  sk_supernova_cleave: Object.freeze({
    id: 'sk_supernova_cleave',
    label: '🐉 Supernova Star-Cleave',
    category: 'boss_skill',
    biomeHint: 'caldera',
    isDirectional: true,
    durationMs: 1750,
    shakeAmp: 0.30,
    bloomFlash: 0.48,
    hitStopMs: 85,
    screenTint: '#F97316',
    rigChoreo: Object.freeze({ pose: 'leap_slam', poseMs: 760, weaponScaleBoost: 1.38 }),
    screenJuice: Object.freeze({ shake: 0.30, shakeDur: 0.32, shakeAmp: 0.30, bloomFlash: 0.48, hitStopMs: 85, screenTint: '#F97316' }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.sk_supernova_cleave,
  }),

  ult_charm_sanctuary: Object.freeze({
    id: 'ult_charm_sanctuary',
    label: '✨ Goddess Benediction Sanctuary',
    category: 'ultimate',
    biomeHint: 'meadow',
    isDirectional: false,
    durationMs: 2400,
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 960, weaponScaleBoost: 1.28 }),
    screenJuice: Object.freeze({ shake: 0.12, shakeDur: 0.26 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.ult_charm_sanctuary,
  }),

  combo_melee_1: Object.freeze({
    id: 'combo_melee_1',
    label: '⚔️ Vanguard Slash I (Crescent)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 650,
    rigChoreo: Object.freeze({ pose: 'slash_1', poseMs: 340, weaponScaleBoost: 1.22 }),
    screenJuice: Object.freeze({ shake: 0.03, shakeDur: 0.1 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_melee_1,
  }),

  combo_melee_2: Object.freeze({
    id: 'combo_melee_2',
    label: '⚔️ Vanguard Slash II (Cross Sweep)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 700,
    rigChoreo: Object.freeze({ pose: 'slash_2', poseMs: 360, weaponScaleBoost: 1.26 }),
    screenJuice: Object.freeze({ shake: 0.04, shakeDur: 0.12 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_melee_2,
  }),

  combo_melee_3: Object.freeze({
    id: 'combo_melee_3',
    label: '⚔️ Vanguard Finisher III (Sky-Cleave Wave)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 950,
    rigChoreo: Object.freeze({ pose: 'leap_slam', poseMs: 480, weaponScaleBoost: 1.38 }),
    screenJuice: Object.freeze({ shake: 0.09, shakeDur: 0.2 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_melee_3,
  }),

  combo_ranged_1: Object.freeze({
    id: 'combo_ranged_1',
    label: '🏹 Ranger Shot I (Snap Shot)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 650,
    rigChoreo: Object.freeze({ pose: 'bow_draw', poseMs: 360, weaponScaleBoost: 1.2 }),
    screenJuice: Object.freeze({ shake: 0.02, shakeDur: 0.08 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_ranged_1,
  }),

  combo_ranged_2: Object.freeze({
    id: 'combo_ranged_2',
    label: '🏹 Ranger Shot II (Sonic Gale Arrow)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 700,
    rigChoreo: Object.freeze({ pose: 'bow_draw', poseMs: 380, weaponScaleBoost: 1.24 }),
    screenJuice: Object.freeze({ shake: 0.03, shakeDur: 0.1 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_ranged_2,
  }),

  combo_ranged_3: Object.freeze({
    id: 'combo_ranged_3',
    label: '🏹 Ranger Finisher III (Starlight Twin Volley)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 950,
    rigChoreo: Object.freeze({ pose: 'bow_draw', poseMs: 460, weaponScaleBoost: 1.32 }),
    screenJuice: Object.freeze({ shake: 0.06, shakeDur: 0.16 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_ranged_3,
  }),

  combo_magic_1: Object.freeze({
    id: 'combo_magic_1',
    label: '🪄 Mystic Bolt I (Astral Spark)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 700,
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 380, weaponScaleBoost: 1.2 }),
    screenJuice: Object.freeze({ shake: 0.025, shakeDur: 0.09 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_magic_1,
  }),

  combo_magic_2: Object.freeze({
    id: 'combo_magic_2',
    label: '🪄 Mystic Bolt II (Amethyst Star Surge)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 750,
    rigChoreo: Object.freeze({ pose: 'wand_cast', poseMs: 400, weaponScaleBoost: 1.25 }),
    screenJuice: Object.freeze({ shake: 0.035, shakeDur: 0.11 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_magic_2,
  }),

  combo_magic_3: Object.freeze({
    id: 'combo_magic_3',
    label: '🪄 Mystic Finisher III (Sylph Holy Starburst)',
    category: 'class_combo',
    biomeHint: 'meadow',
    isDirectional: true,
    durationMs: 950,
    rigChoreo: Object.freeze({ pose: 'float_chant', poseMs: 540, weaponScaleBoost: 1.34 }),
    screenJuice: Object.freeze({ shake: 0.07, shakeDur: 0.18 }),
    effekseer: PREBUILT_EFFEKSEER_SPECS.combo_magic_3,
  }),
});

export const ALPHA_ELITE_AURA_SPEC = Object.freeze({
  id: 'alpha_elite_aura',
  label: '🌟 Star-Crowned Alpha Aura',
  category: 'elite_aura',
  biomeHint: 'meadow',
  isDirectional: false,
  durationMs: 2000,
  effekseer: Object.freeze({
    peakMs: 440,
    layers: Object.freeze([
      Object.freeze({ url: '/assets/effekseer/Basic/Basic_Simple_Ring_Shape2.efkefc', at: 'caster', scale: Object.freeze([0.48, 0.14, 0.48]), yOffset: 0.03, delayMs: 40, color: Object.freeze([255, 220, 85, 225]) }),
      Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_hozyo4.efkefc', at: 'caster', scale: 0.30, yOffset: 0.03, color: Object.freeze([255, 222, 95, 210]) }),
    ]),
  }),
});

export const COMBO_VFX_DEFS = Object.freeze({
  reaction_conduction: Object.freeze({
    id: 'reaction_conduction',
    label: '⚡💧 Conduction Splash',
    category: 'combo_reaction',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 950,
    screenJuice: Object.freeze({ shake: 0.04, shakeDur: 0.14 }),
    effekseer: Object.freeze({
      peakMs: 160,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Light1.efkefc', at: 'caster', scale: 0.55, yOffset: 0.28, color: Object.freeze([255, 245, 90, 255]) }),
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Topwater1.efkefc', at: 'caster', scale: 1.45, yOffset: 0.08, delayMs: 30, color: Object.freeze([110, 235, 255, 240]) }),
      ]),
    }),
  }),

  reaction_deep_freeze: Object.freeze({
    id: 'reaction_deep_freeze',
    label: '❄️💧 Deep Freeze Encasement',
    category: 'combo_reaction',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 1100,
    screenJuice: Object.freeze({ shake: 0.04, shakeDur: 0.14 }),
    effekseer: Object.freeze({
      peakMs: 130,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Icicle1.efkefc', at: 'caster', scale: 1.5, yOffset: 0.04, color: Object.freeze([160, 240, 255, 255]) }),
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Undine2.efkefc', at: 'caster', scale: 1.25, yOffset: 0.08, delayMs: 30, color: Object.freeze([140, 235, 255, 230]) }),
      ]),
    }),
  }),

  reaction_shatter: Object.freeze({
    id: 'reaction_shatter',
    label: '🧊🔨 Ice Shatter Burst',
    category: 'combo_reaction',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 900,
    screenJuice: Object.freeze({ shake: 0.06, shakeDur: 0.16 }),
    effekseer: Object.freeze({
      peakMs: 180,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Breakdown.efkefc', at: 'caster', scale: 1.45, yOffset: 0.15, color: Object.freeze([150, 235, 255, 255]) }),
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Blow1.efkefc', at: 'caster', scale: 0.42, yOffset: 0.25, delayMs: 30, color: Object.freeze([170, 245, 255, 230]) }),
      ]),
    }),
  }),

  reaction_wildfire: Object.freeze({
    id: 'reaction_wildfire',
    label: '🔥🍃 Wildfire Cyclone',
    category: 'combo_reaction',
    biomeHint: 'caldera',
    isDirectional: false,
    durationMs: 1050,
    screenJuice: Object.freeze({ shake: 0.04, shakeDur: 0.14 }),
    effekseer: Object.freeze({
      peakMs: 220,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Fire2.efkefc', at: 'caster', scale: 0.45, yOffset: 0.15 }),
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph2.efkefc', at: 'caster', scale: 1.35, yOffset: 0.1, delayMs: 30, color: Object.freeze([255, 140, 40, 240]) }),
      ]),
    }),
  }),

  reaction_scald: Object.freeze({
    id: 'reaction_scald',
    label: '♨️ Scald Steam Vapor',
    category: 'combo_reaction',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 850,
    screenJuice: Object.freeze({ shake: 0.02, shakeDur: 0.1 }),
    effekseer: Object.freeze({
      peakMs: 200,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_foot_smoke1.efkefc', at: 'caster', scale: 1.6, yOffset: 0.12, color: Object.freeze([255, 235, 240, 240]) }),
      ]),
    }),
  }),

  reaction_crush: Object.freeze({
    id: 'reaction_crush',
    label: '🌀🪨 Crush Impact',
    category: 'combo_reaction',
    biomeHint: 'meadow',
    isDirectional: false,
    durationMs: 950,
    screenJuice: Object.freeze({ shake: 0.07, shakeDur: 0.18 }),
    effekseer: Object.freeze({
      peakMs: 220,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Gohlem7.efkefc', at: 'caster', scale: 1.4, yOffset: 0.08 }),
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Soil1.efkefc', at: 'caster', scale: 0.5, yOffset: 0.08, delayMs: 40 }),
      ]),
    }),
  }),

  reaction_exposed: Object.freeze({
    id: 'reaction_exposed',
    label: '💫🎯 Exposed Critical Flash',
    category: 'combo_reaction',
    biomeHint: 'caldera',
    isDirectional: false,
    durationMs: 850,
    screenJuice: Object.freeze({ shake: 0.05, shakeDur: 0.14 }),
    effekseer: Object.freeze({
      peakMs: 180,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/AndrewFM01/AndrewFM01_hit_eff.efkefc', at: 'caster', scale: 0.65, yOffset: 0.35, color: Object.freeze([255, 220, 70, 255]) }),
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Light2.efkefc', at: 'caster', scale: 0.48, yOffset: 0.35, delayMs: 25, color: Object.freeze([255, 225, 80, 240]) }),
      ]),
    }),
  }),

  guard_break: Object.freeze({
    id: 'guard_break',
    label: '💥 Guard Break Detonation',
    category: 'combo_reaction',
    biomeHint: 'caldera',
    isDirectional: false,
    durationMs: 1200,
    screenJuice: Object.freeze({ shake: 0.10, shakeDur: 0.22 }),
    effekseer: Object.freeze({
      peakMs: 220,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Attack_Impact.efkefc', at: 'caster', scale: 1.65, yOffset: 0.25, color: Object.freeze([255, 70, 40, 255]) }),
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Blow2.efkefc', at: 'caster', scale: 0.45, yOffset: 0.22, delayMs: 40, color: Object.freeze([255, 210, 75, 240]) }),
      ]),
    }),
  }),

  mob_ward: Object.freeze({
    id: 'mob_ward',
    label: '🔔 Protective Mob Ward',
    category: 'combo_reaction',
    biomeHint: 'reef',
    isDirectional: false,
    durationMs: 1150,
    screenJuice: Object.freeze({ shake: 0.0, shakeDur: 0.0 }),
    effekseer: Object.freeze({
      peakMs: 260,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_hozyo3.efkefc', at: 'caster', scale: 0.50, yOffset: 0.08, color: Object.freeze([80, 235, 210, 220]) }),
      ]),
    }),
  }),

  reaction_frostwind: Object.freeze({
    id: 'reaction_frostwind',
    label: '❄️🍃 Frostwind Freeze',
    category: 'combo_reaction',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 950,
    screenJuice: Object.freeze({ shake: 0.04, shakeDur: 0.14 }),
    effekseer: Object.freeze({
      peakMs: 180,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Sylph8.efkefc', at: 'caster', scale: 1.35, yOffset: 0.08, color: Object.freeze([140, 245, 225, 240]) }),
        Object.freeze({ url: '/assets/effekseer/MAGICALxSPIRAL/MxS_Icicle2.efkefc', at: 'caster', scale: 1.35, yOffset: 0.05, delayMs: 25, color: Object.freeze([175, 245, 255, 255]) }),
      ]),
    }),
  }),

  reaction_judgement: Object.freeze({
    id: 'reaction_judgement',
    label: '✨🌠 Holy Judgement Smite',
    category: 'combo_reaction',
    biomeHint: 'caldera',
    isDirectional: false,
    durationMs: 1000,
    screenJuice: Object.freeze({ shake: 0.06, shakeDur: 0.16 }),
    effekseer: Object.freeze({
      peakMs: 180,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Light4.efkefc', at: 'caster', scale: 0.52, yOffset: 0.20, color: Object.freeze([255, 250, 180, 255]) }),
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Light2.efkefc', at: 'caster', scale: 0.42, yOffset: 0.22, delayMs: 20, color: Object.freeze([255, 240, 130, 240]) }),
      ]),
    }),
  }),

  reaction_siphon: Object.freeze({
    id: 'reaction_siphon',
    label: '🩸 Siphon Essence Drain',
    category: 'combo_reaction',
    biomeHint: 'hollow',
    isDirectional: false,
    durationMs: 950,
    screenJuice: Object.freeze({ shake: 0.03, shakeDur: 0.12 }),
    effekseer: Object.freeze({
      peakMs: 180,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk02/Tktk02_Dark1.efkefc', at: 'caster', scale: 0.48, yOffset: 0.20, color: Object.freeze([215, 40, 110, 255]) }),
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_Cure7.efkefc', at: 'caster', scale: 0.45, yOffset: 0.10, delayMs: 20, color: Object.freeze([235, 45, 125, 230]) }),
      ]),
    }),
  }),

  resonance_prime: Object.freeze({
    id: 'resonance_prime',
    label: '🎶 Harmonic Resonance Prime',
    category: 'combo_reaction',
    biomeHint: 'meadow',
    isDirectional: false,
    durationMs: 1100,
    screenJuice: Object.freeze({ shake: 0.0, shakeDur: 0.0 }),
    effekseer: Object.freeze({
      peakMs: 240,
      layers: Object.freeze([
        Object.freeze({ url: '/assets/effekseer/Tktk01/Tktk01_hozyo5.efkefc', at: 'caster', scale: 0.35, yOffset: 0.03, color: Object.freeze([170, 245, 175, 220]) }),
      ]),
    }),
  }),
});

export function resolveSkillVfxRecipe(vfxId) {
  if (vfxId === 'alpha_elite_aura') return ALPHA_ELITE_AURA_SPEC;
  if (COMBO_VFX_DEFS[vfxId]) return COMBO_VFX_DEFS[vfxId];
  return SKILL_VFX_DEFS[vfxId] || SKILL_VFX_DEFS.ult_charm_sanctuary;
}
