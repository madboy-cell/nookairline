// client/js/wear_aura.js — ✦ Super Mythic wear auras (Dopamine Patch §1A, "Twin Eclipse" couple set).
//
// One pooled, additive particle aura per chibi wearing an outfit whose catalog entry has `aura`
// (shared/costumes_catalog.js): 'eclipse' (☀️ Eclipse Dragon Sovereign) | 'aurora' (🌙 Aurora Celestial Empress).
//   • idle:      eclipse → slow-orbiting gold-black dragon wisp + ember motes
//                aurora  → 2 drifting aurora ribbons + star dust
//   • footsteps: sun-glyph imprints / starlight petals that fade (world-space ground decals)
//   • equip:     1.5 s "suit-up" (light pillar → dragon coils | aurora curtain → star burst → pose)
//   • duo:       "Twin Eclipse" light ribbon linking an eclipse + aurora wearer standing close together
// Budget: ≤ 60 particles per aura (54 points + 6 footprint decals), one draw call for the points.
// Auto quality: particle count halves when frame time stays > 20 ms; prefers-reduced-motion = calm mode.
//
// API (all calls are safe no-ops for non-aura outfits):
//   WearAura.sync(rig, outfitId, { suitUp })  mount / swap / unmount on a ChibiRig (called by chibi_rig.setOutfit)
//   rig._wearAura.update(dt)                  per-frame (called by chibi_rig.update)
//   WearAura.playSuitUp(rig)                  replay the 1.5 s equip moment (gacha runway, dressing room)
//   WearAura.updateTwinLinks(rigs?, dt?)      Twin Eclipse ribbons; runs automatically once per frame from the
//                                             aura updates, call explicitly to restrict to a rig list.
//                                             Returns [{ a: rig, b: rig, dist }] for combined-pose hooks.
//   WearAura.dispose(rig)                     tear down (called by chibi_rig.dispose)
import * as THREE from 'three';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { RIG_METRICS } from '/shared/accessory_attach.js';

export const AURA_MAX_PARTICLES = 76;
const POINTS = 68;
const FOOTPRINTS = AURA_MAX_PARTICLES - POINTS;
const SUIT_UP_S = 1.5;
export const TWIN_RANGE = 3.2;         // metres (xz) between partners for the Twin Eclipse link
const H = RIG_METRICS.CHIBI_HEIGHT || 1.55;
const AURA_ATTR_KEYS = Object.freeze(['position', 'aColor', 'aSize', 'aAlpha', 'aShape', 'aRot']);

// shape ids (fragment shader): 0 glossy bubble/pearl · 1 four-point star · 2 ember/flame · 3 4-petal blossom/clover
const PROFILES = {
  eclipse: {
    wisp: 14, motes: 24, burst: 16,
    gold: new THREE.Color(1.0, 0.78, 0.25), deep: new THREE.Color(0.85, 0.32, 0.06), ember: new THREE.Color(1.0, 0.5, 0.12),
    pillar: new THREE.Color(1.0, 0.82, 0.35), foot: 'sun', footTint: new THREE.Color(1.0, 0.75, 0.3),
    linkColor: new THREE.Color(1.0, 0.78, 0.25),
  },
  aurora: {
    wisp: 8, motes: 30, burst: 16,     // wisp = sparkles riding the ribbons
    teal: new THREE.Color(0.25, 1.0, 0.85), violet: new THREE.Color(0.62, 0.42, 1.0), pink: new THREE.Color(1.0, 0.55, 0.85),
    star: new THREE.Color(0.85, 0.92, 1.0),
    pillar: new THREE.Color(0.6, 0.85, 1.0), foot: 'petal', footTint: new THREE.Color(0.8, 0.85, 1.0),
    linkColor: new THREE.Color(0.62, 0.42, 1.0),
  },
  seraphim: {
    wisp: 12, motes: 26, burst: 16,    // 🌹 Seraphim Rose Sovereign: rose-gold halo stars + swirling silk ribbons & petals
    rose: new THREE.Color(1.0, 0.48, 0.72), gold: new THREE.Color(1.0, 0.84, 0.45), pearl: new THREE.Color(1.0, 0.90, 0.96),
    star: new THREE.Color(1.0, 0.96, 0.84),
    pillar: new THREE.Color(1.0, 0.65, 0.82), foot: 'rose', footTint: new THREE.Color(1.0, 0.62, 0.82),
    linkColor: new THREE.Color(1.0, 0.55, 0.78),
  },
  cyber: {
    wisp: 12, motes: 26, burst: 16,    // 💠 Quantum Singularity Cyber-Archon: tilted gyroscopic hard-light rings + quantum nodes
    cyan: new THREE.Color(0.15, 0.98, 1.0), magenta: new THREE.Color(1.0, 0.28, 0.88), violet: new THREE.Color(0.58, 0.38, 1.0),
    gold: new THREE.Color(1.0, 0.88, 0.35),
    pillar: new THREE.Color(0.25, 0.95, 1.0), foot: 'hex', footTint: new THREE.Color(0.25, 0.98, 1.0),
    linkColor: new THREE.Color(0.18, 0.96, 1.0),
  },
  ribbon: {
    wisp: 12, motes: 26, burst: 16,    // 🎀 Dreamweaver Starlight Ribbon: pastel-pink & sky-blue figure-8 ribbons + shooting stars
    pink: new THREE.Color(1.0, 0.56, 0.82), sky: new THREE.Color(0.45, 0.86, 1.0), gold: new THREE.Color(1.0, 0.88, 0.42),
    lavender: new THREE.Color(0.78, 0.62, 1.0),
    pillar: new THREE.Color(1.0, 0.75, 0.92), foot: 'ribbon', footTint: new THREE.Color(1.0, 0.72, 0.9),
    linkColor: new THREE.Color(1.0, 0.64, 0.88),
  },

  // =========================================================================
  // 🎐 16 STARLIGHT AURA CHARMS (Strict Progression: Tier 4 > Tier 3 > Tier 2 > Tier 1)
  // =========================================================================
  // --- TIER 1: Meadow Keepsakes (Petite knee/waist mini-wisp 0.22m + Footstep Blooms + Ankle Sparkles; NO Ground Seal, NO Ribbon Tail) ---
  charm_berry_perfume: {
    tier: 1, wisp: 6, motes: 12, burst: 10, noRibbons: true, spirit: true,
    c1: new THREE.Color(1.0, 0.48, 0.74), c2: new THREE.Color(1.0, 0.78, 0.90), c3: new THREE.Color(1.0, 0.88, 0.52),
    star: new THREE.Color(1.0, 0.92, 0.96),
    pillar: new THREE.Color(1.0, 0.62, 0.82), foot: 'rose', footTint: new THREE.Color(1.0, 0.52, 0.76),
    linkColor: new THREE.Color(1.0, 0.52, 0.76),
  },
  charm_clover_bell: {
    tier: 1, wisp: 6, motes: 12, burst: 10, noRibbons: true, spirit: true,
    c1: new THREE.Color(0.28, 0.96, 0.56), c2: new THREE.Color(1.0, 0.88, 0.36), c3: new THREE.Color(0.65, 1.0, 0.78),
    star: new THREE.Color(0.88, 1.0, 0.90),
    pillar: new THREE.Color(0.38, 0.96, 0.62), foot: 'petal', footTint: new THREE.Color(0.35, 0.98, 0.60),
    linkColor: new THREE.Color(0.35, 0.96, 0.58),
  },
  charm_ribbon_musicbox: {
    tier: 1, wisp: 6, motes: 12, burst: 10, noRibbons: true, spirit: true,
    c1: new THREE.Color(1.0, 0.58, 0.84), c2: new THREE.Color(1.0, 0.86, 0.44), c3: new THREE.Color(0.82, 0.68, 1.0),
    star: new THREE.Color(1.0, 0.95, 0.88),
    pillar: new THREE.Color(1.0, 0.68, 0.88), foot: 'ribbon', footTint: new THREE.Color(1.0, 0.64, 0.86),
    linkColor: new THREE.Color(1.0, 0.62, 0.84),
  },
  charm_honeybee_lantern: {
    tier: 1, wisp: 6, motes: 12, burst: 10, noRibbons: true, spirit: true,
    c1: new THREE.Color(1.0, 0.82, 0.22), c2: new THREE.Color(1.0, 0.62, 0.14), c3: new THREE.Color(1.0, 0.94, 0.62),
    star: new THREE.Color(1.0, 0.92, 0.55),
    pillar: new THREE.Color(1.0, 0.78, 0.28), foot: 'hex', footTint: new THREE.Color(1.0, 0.80, 0.25),
    linkColor: new THREE.Color(1.0, 0.78, 0.25),
  },

  // --- TIER 2: Sanctuary Relics (Compact Single Ground Seal 0.78m + Whisper Wisp 0.28m + Sparkle Wake; NO Ribbon Tail) ---
  charm_cinderella_watch: {
    tier: 2, wisp: 8, motes: 16, burst: 12, noRibbons: true, spirit: true,
    seal: 'clock', sealR: 0.78, sealColor: new THREE.Color(0.42, 0.82, 1.0),
    c1: new THREE.Color(0.38, 0.80, 1.0), c2: new THREE.Color(1.0, 0.88, 0.48), c3: new THREE.Color(0.75, 0.92, 1.0),
    star: new THREE.Color(0.90, 0.96, 1.0),
    pillar: new THREE.Color(0.45, 0.84, 1.0), foot: 'sun', footTint: new THREE.Color(0.48, 0.86, 1.0),
    linkColor: new THREE.Color(0.42, 0.82, 1.0),
  },
  charm_siren_pearl: {
    tier: 2, wisp: 8, motes: 16, burst: 12, noRibbons: true, spirit: true,
    seal: 'coral', sealR: 0.78, sealColor: new THREE.Color(0.28, 0.96, 0.90),
    c1: new THREE.Color(0.25, 0.96, 0.88), c2: new THREE.Color(1.0, 0.60, 0.82), c3: new THREE.Color(0.68, 0.96, 1.0),
    star: new THREE.Color(0.88, 1.0, 0.98),
    pillar: new THREE.Color(0.32, 0.94, 0.88), foot: 'petal', footTint: new THREE.Color(0.32, 0.96, 0.90),
    linkColor: new THREE.Color(0.28, 0.94, 0.88),
  },
  charm_roulette_watch: {
    tier: 2, wisp: 8, motes: 16, burst: 12, noRibbons: true, spirit: true,
    seal: 'roulette', sealR: 0.78, sealColor: new THREE.Color(1.0, 0.78, 0.24),
    c1: new THREE.Color(1.0, 0.82, 0.25), c2: new THREE.Color(1.0, 0.28, 0.36), c3: new THREE.Color(1.0, 0.92, 0.58),
    star: new THREE.Color(1.0, 0.90, 0.45),
    pillar: new THREE.Color(1.0, 0.76, 0.28), foot: 'sun', footTint: new THREE.Color(1.0, 0.78, 0.26),
    linkColor: new THREE.Color(1.0, 0.76, 0.25),
  },
  charm_phantom_mirror: {
    tier: 2, wisp: 8, motes: 16, burst: 12, noRibbons: true, spirit: true,
    seal: 'mirror', sealR: 0.78, sealColor: new THREE.Color(0.76, 0.46, 1.0),
    c1: new THREE.Color(0.76, 0.44, 1.0), c2: new THREE.Color(1.0, 0.42, 0.72), c3: new THREE.Color(0.88, 0.82, 1.0),
    star: new THREE.Color(0.92, 0.85, 1.0),
    pillar: new THREE.Color(0.76, 0.48, 1.0), foot: 'rose', footTint: new THREE.Color(0.78, 0.48, 1.0),
    linkColor: new THREE.Color(0.76, 0.46, 1.0),
  },

  // --- TIER 3: Sovereign Treasures (Large Sacred Ground Seal 0.96m + Radiant Spirit Wisp 0.35m + 1 Silk Comet Ribbon + Weather Motes) ---
  charm_kitsune_omamori: {
    tier: 3, wisp: 11, motes: 22, burst: 14, ribbonCount: 1, spirit: true,
    seal: 'torii', sealR: 0.96, sealColor: new THREE.Color(1.0, 0.45, 0.65),
    c1: new THREE.Color(1.0, 0.42, 0.62), c2: new THREE.Color(0.32, 0.96, 1.0), c3: new THREE.Color(1.0, 0.86, 0.42),
    star: new THREE.Color(1.0, 0.92, 0.82),
    pillar: new THREE.Color(1.0, 0.52, 0.68), foot: 'petal', footTint: new THREE.Color(1.0, 0.48, 0.66),
    linkColor: new THREE.Color(1.0, 0.48, 0.66),
  },
  charm_glacial_snowglobe: {
    tier: 3, wisp: 11, motes: 22, burst: 14, ribbonCount: 1, spirit: true,
    seal: 'snowflake', sealR: 0.96, sealColor: new THREE.Color(0.38, 0.92, 1.0),
    c1: new THREE.Color(0.35, 0.92, 1.0), c2: new THREE.Color(0.72, 0.88, 1.0), c3: new THREE.Color(0.62, 0.52, 1.0),
    star: new THREE.Color(0.92, 0.98, 1.0),
    pillar: new THREE.Color(0.45, 0.92, 1.0), foot: 'hex', footTint: new THREE.Color(0.42, 0.94, 1.0),
    linkColor: new THREE.Color(0.38, 0.92, 1.0),
  },
  charm_pharaoh_ankh: {
    tier: 3, wisp: 11, motes: 22, burst: 14, ribbonCount: 1, spirit: true,
    seal: 'sundial', sealR: 0.96, sealColor: new THREE.Color(1.0, 0.82, 0.25),
    c1: new THREE.Color(1.0, 0.84, 0.26), c2: new THREE.Color(1.0, 0.48, 0.16), c3: new THREE.Color(1.0, 0.95, 0.65),
    star: new THREE.Color(1.0, 0.92, 0.55),
    pillar: new THREE.Color(1.0, 0.82, 0.28), foot: 'sun', footTint: new THREE.Color(1.0, 0.82, 0.28),
    linkColor: new THREE.Color(1.0, 0.82, 0.26),
  },
  charm_tsukuyomi_mirror: {
    tier: 3, wisp: 11, motes: 22, burst: 14, ribbonCount: 1, spirit: true,
    seal: 'moonphase', sealR: 0.96, sealColor: new THREE.Color(0.62, 0.72, 1.0),
    c1: new THREE.Color(0.58, 0.68, 1.0), c2: new THREE.Color(1.0, 0.86, 0.48), c3: new THREE.Color(0.84, 0.62, 1.0),
    star: new THREE.Color(0.92, 0.94, 1.0),
    pillar: new THREE.Color(0.62, 0.72, 1.0), foot: 'ribbon', footTint: new THREE.Color(0.68, 0.76, 1.0),
    linkColor: new THREE.Color(0.62, 0.72, 1.0),
  },

  // --- TIER 4 MVP: Secret Rare Sovereigns (Double Counter-Rotating Seals 1.14m + Grand Sovereign Familiar 0.44m + 3-Layer Corona + 2 Orbiting Star-Moons + 2 Braided Comet Tails + Footsteps) ---
  charm_emperor_mochi_crown: {
    tier: 4, wisp: 14, motes: 28, burst: 16, ribbonCount: 2, spirit: true,
    seal: 'imperial', sealInner: 'sundial', sealR: 1.12,
    sealColor: new THREE.Color(1.0, 0.82, 0.25), sealInnerColor: new THREE.Color(1.0, 0.38, 0.52),
    c1: new THREE.Color(1.0, 0.84, 0.25), c2: new THREE.Color(1.0, 0.36, 0.52), c3: new THREE.Color(1.0, 0.96, 0.68),
    star: new THREE.Color(1.0, 0.94, 0.62),
    pillar: new THREE.Color(1.0, 0.84, 0.30), foot: 'sun', footTint: new THREE.Color(1.0, 0.84, 0.28),
    linkColor: new THREE.Color(1.0, 0.84, 0.26),
  },
  charm_golden_pinata_trophy: {
    tier: 4, wisp: 14, motes: 28, burst: 16, ribbonCount: 2, spirit: true,
    seal: 'roulette', sealInner: 'clock', sealR: 1.12,
    sealColor: new THREE.Color(1.0, 0.85, 0.24), sealInnerColor: new THREE.Color(0.32, 0.96, 0.88),
    c1: new THREE.Color(1.0, 0.86, 0.24), c2: new THREE.Color(1.0, 0.45, 0.78), c3: new THREE.Color(0.32, 0.96, 0.88),
    star: new THREE.Color(1.0, 0.95, 0.55),
    pillar: new THREE.Color(1.0, 0.86, 0.28), foot: 'ribbon', footTint: new THREE.Color(1.0, 0.86, 0.28),
    linkColor: new THREE.Color(1.0, 0.85, 0.25),
  },
  charm_seraphim_rose_halo: {
    tier: 4, wisp: 14, motes: 28, burst: 16, ribbonCount: 2, spirit: true,
    seal: 'cathedral', sealInner: 'torii', sealR: 1.14,
    sealColor: new THREE.Color(1.0, 0.54, 0.78), sealInnerColor: new THREE.Color(1.0, 0.86, 0.46),
    c1: new THREE.Color(1.0, 0.50, 0.74), c2: new THREE.Color(1.0, 0.86, 0.46), c3: new THREE.Color(1.0, 0.92, 0.96),
    star: new THREE.Color(1.0, 0.96, 0.84),
    pillar: new THREE.Color(1.0, 0.62, 0.82), foot: 'rose', footTint: new THREE.Color(1.0, 0.58, 0.80),
    linkColor: new THREE.Color(1.0, 0.55, 0.78),
  },
  charm_eclipse_dragon_core: {
    tier: 4, wisp: 14, motes: 28, burst: 16, ribbonCount: 2, spirit: true,
    seal: 'eclipse_void', sealInner: 'sundial', sealR: 1.14,
    sealColor: new THREE.Color(1.0, 0.78, 0.25), sealInnerColor: new THREE.Color(0.68, 0.38, 1.0),
    c1: new THREE.Color(1.0, 0.80, 0.25), c2: new THREE.Color(0.68, 0.38, 1.0), c3: new THREE.Color(1.0, 0.48, 0.16),
    star: new THREE.Color(1.0, 0.90, 0.55),
    pillar: new THREE.Color(1.0, 0.78, 0.32), foot: 'sun', footTint: new THREE.Color(1.0, 0.76, 0.28),
    linkColor: new THREE.Color(1.0, 0.78, 0.25),
  },
};

// ------------------------------------------------------------------ shared GPU resources (built once)
const reducedMQ = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!reducedMQ?.matches;

const quality = { level: 1, slowFor: 0, fastFor: 0, lastNow: 0, frameId: 0 };
const registry = new Set();            // live WearAura instances
const links = new Map();               // pairKey -> { mesh, alpha, a, b }

const _v = new THREE.Vector2();
const POINT_VERT = /* glsl */`
  attribute float aSize; attribute float aAlpha; attribute float aShape; attribute float aRot; attribute vec3 aColor;
  uniform float uViewH;
  varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
  void main() {
    vColor = aColor; vAlpha = aAlpha; vShape = aShape; vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uViewH * 0.5 / max(gl_Position.w, 0.05), 0.0, 96.0);
  }`;
const POINT_FRAG = /* glsl */`
  varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vRot;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vRot), s = sin(vRot);
    p = mat2(c, -s, s, c) * p;
    float r = length(p), a;
    if (vShape < 0.5) {
      // 0: glossy pearl / soap bubble (translucent fill + bright rim + specular glint)
      float rim = smoothstep(0.96, 0.80, r) * (0.35 + 0.65 * smoothstep(0.45, 0.86, r));
      float spec = exp(-length(p - vec2(-0.28, -0.28)) * 9.0) * 0.85;
      a = clamp(rim + spec, 0.0, 1.0);
    } else if (vShape < 1.5) {
      // 1: crisp 4-point celestial star sparkle
      a = max(exp(-r * r * 8.5), exp(-abs(p.x * p.y) * 52.0) * max(0.0, 1.0 - r));
    } else if (vShape < 2.5) {
      // 2: glowing spirit flame / ember
      a = exp(-r * r * 4.8) + exp(-r * r * 36.0);
    } else {
      // 3: 4-petal clover / sakura blossom (replaces old flat oval)
      float ang = atan(p.y, p.x);
      float pet = 0.58 + 0.34 * cos(ang * 4.0);
      a = smoothstep(pet, pet * 0.35, r);
    }
    a *= vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }`;

const RIBBON_VERT = /* glsl */`
  attribute float aU; attribute float aSide; varying float vU; varying float vSide;
  void main() { vU = aU; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIBBON_FRAG = /* glsl */`
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uAlpha; uniform float uTime; uniform float uFlow;
  varying float vU; varying float vSide;
  void main() {
    vec3 col = vU < 0.5 ? mix(uA, uB, vU * 2.0) : mix(uB, uC, vU * 2.0 - 1.0);
    float edge = 1.0 - pow(abs(vSide), 2.0);
    float shimmer = 0.65 + 0.35 * sin(vU * 18.0 - uTime * 3.0 + vSide * 2.0);
    float pulse = uFlow > 0.0 ? 0.55 + 0.9 * pow(max(0.0, sin(vU * 9.0 - uTime * 6.0)), 6.0) : 1.0;
    float a = uAlpha * edge * sin(vU * 3.14159) * shimmer * pulse;
    gl_FragColor = vec4(col * a, a);
  }`;

const PILLAR_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv;
  void main() {
    float a = uAlpha * pow(1.0 - vUv.y, 1.6) * (0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 8.0));
    gl_FragColor = vec4(uColor * a, a);
  }`;
const PILLAR_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

let glyphTex = null;
function footGlyphs() {
  if (glyphTex) return glyphTex;
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32);
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.userData.shared = true;
    return t;
  };
  glyphTex = {
    sun: mk((g) => {                       // sun glyph: ring + 8 rays
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.shadowColor = '#fff'; g.shadowBlur = 6;
      g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 8; i++) {
        g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(15, 0); g.lineTo(i % 2 ? 22 : 27, 0); g.stroke();
      }
    }),
    petal: mk((g) => {                     // starlight petal: 5 soft petals + star core
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.shadowColor = '#fff'; g.shadowBlur = 8;
      for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -13, 6, 11, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
    }),
    rose: mk((g) => {                      // sacred seraphim rose: 6 layered rose petals + outer halo ring + diamond core
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.shadowColor = '#fff'; g.shadowBlur = 7;
      g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.72)';
      for (let i = 0; i < 6; i++) {
        g.rotate(Math.PI / 3);
        g.beginPath(); g.ellipse(0, -12, 7.5, 10, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -8); g.lineTo(8, 0); g.lineTo(0, 8); g.lineTo(-8, 0); g.closePath(); g.fill();
    }),
    hex: mk((g) => {                       // quantum cyber hexagon: concentric hex rings + 6 circuit nodes
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.shadowColor = '#fff'; g.shadowBlur = 7;
      for (const r of [23, 13]) {
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath(); g.stroke();
      }
      g.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.beginPath(); g.arc(Math.cos(a) * 23, Math.sin(a) * 23, 3.2, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(0, 0, 5.5, 0, Math.PI * 2); g.fill();
    }),
    ribbon: mk((g) => {                    // starlight ribbon bow: 4-point star + cute twin bow loops + heart core
      g.strokeStyle = '#fff'; g.lineWidth = 2.8; g.fillStyle = 'rgba(255,255,255,0.78)'; g.shadowColor = '#fff'; g.shadowBlur = 8;
      g.beginPath(); g.ellipse(-13, -3, 9, 6, -0.35, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(13, -3, 9, 6, 0.35, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-5, 3); g.lineTo(-12, 19); g.lineTo(-4, 15); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(5, 3); g.lineTo(12, 19); g.lineTo(4, 15); g.closePath(); g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? 4.5 : 11;
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r - 2);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r - 2);
      }
      g.closePath(); g.fill();
    }),
  };
  return glyphTex;
}

// ------------------------------------------------------------------ Ground Seal, Overhead Halo & 3D Relic Orbiter Textures (Tiers 1-4 Charms)
let sealTexCache = null;
function sealGlyphs() {
  if (sealTexCache) return sealTexCache;
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    // Soft dark-umbral contrast ring so seals pop on both sunlit cobbles & dark stages
    const bg = g.createRadialGradient(0, 0, 12, 0, 0, 122);
    bg.addColorStop(0, 'rgba(20, 10, 34, 0.28)');
    bg.addColorStop(0.76, 'rgba(18, 8, 30, 0.44)');
    bg.addColorStop(0.94, 'rgba(18, 8, 30, 0.22)');
    bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(0, 0, 122, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 12;
    g.scale(1.25, 1.25);
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.userData.shared = true;
    return t;
  };
  const ring = (g, r, w = 3.5, dash = null) => {
    g.save();
    g.lineWidth = w;
    if (dash) g.setLineDash(dash);
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.restore();
  };
  const starPoly = (g, pts, rOut, rIn, w = 3) => {
    g.save();
    g.lineWidth = w;
    g.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = (i * Math.PI) / pts;
      const r = i % 2 === 0 ? rOut : rIn;
      if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.stroke();
    g.restore();
  };
  sealTexCache = {
    clock: mk((g) => {
      ring(g, 84, 4.5); ring(g, 68, 2.5, [6, 5]); ring(g, 30, 3);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        g.lineWidth = i % 3 === 0 ? 5 : 2.5;
        g.beginPath(); g.moveTo(Math.cos(a) * 66, Math.sin(a) * 66); g.lineTo(Math.cos(a) * 82, Math.sin(a) * 82); g.stroke();
      }
      starPoly(g, 4, 62, 20, 2.8);
    }),
    coral: mk((g) => {
      ring(g, 84, 4, [10, 5]); ring(g, 58, 3);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.beginPath(); g.arc(Math.cos(a) * 68, Math.sin(a) * 68, 9, 0, Math.PI * 2); g.stroke();
      }
      starPoly(g, 6, 56, 26, 3);
    }),
    roulette: mk((g) => {
      ring(g, 84, 4.5); ring(g, 66, 3); ring(g, 36, 3.5);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(Math.cos(a) * 36, Math.sin(a) * 36); g.lineTo(Math.cos(a) * 82, Math.sin(a) * 82); g.stroke();
      }
      starPoly(g, 4, 34, 12, 3.2);
    }),
    mirror: mk((g) => {
      ring(g, 84, 4); ring(g, 70, 2.5, [5, 5]);
      starPoly(g, 8, 70, 42, 3);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.beginPath(); g.arc(Math.cos(a) * 56, Math.sin(a) * 56, 10, 0, Math.PI * 2); g.stroke();
      }
    }),
    torii: mk((g) => {
      ring(g, 86, 4.5); ring(g, 74, 2.5);
      starPoly(g, 5, 74, 38, 3.2);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        g.beginPath(); g.arc(Math.cos(a) * 58, Math.sin(a) * 58, 9.5, 0, Math.PI * 2); g.fill();
      }
    }),
    snowflake: mk((g) => {
      ring(g, 86, 4); ring(g, 56, 2.5, [5, 5]);
      starPoly(g, 6, 84, 36, 3.5);
      starPoly(g, 6, 62, 24, 2.5);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 84, Math.sin(a) * 84); g.stroke();
      }
    }),
    sundial: mk((g) => {
      ring(g, 86, 4.5); ring(g, 68, 3);
      starPoly(g, 8, 84, 54, 3.2);
      starPoly(g, 4, 52, 22, 3.2);
      g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
    }),
    moonphase: mk((g) => {
      ring(g, 86, 4); ring(g, 72, 2.5, [8, 5]);
      starPoly(g, 6, 72, 44, 2.8);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.beginPath(); g.arc(Math.cos(a) * 60, Math.sin(a) * 60, 8.5, 0, Math.PI * 2); g.fill();
      }
    }),
    imperial: mk((g) => {
      ring(g, 88, 5); ring(g, 76, 3, [8, 4]); ring(g, 52, 3.5);
      starPoly(g, 8, 86, 56, 3.6);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.beginPath(); g.arc(Math.cos(a) * 76, Math.sin(a) * 76, 6.5, 0, Math.PI * 2); g.fill();
      }
    }),
    cathedral: mk((g) => {
      ring(g, 88, 4.5); ring(g, 74, 3);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        g.lineWidth = 2.6;
        g.beginPath(); g.ellipse(Math.cos(a) * 48, Math.sin(a) * 48, 24, 11, a, 0, Math.PI * 2); g.stroke();
      }
      starPoly(g, 6, 40, 18, 3.2);
    }),
    eclipse_void: mk((g) => {
      ring(g, 88, 5); ring(g, 74, 3, [10, 5]);
      starPoly(g, 12, 86, 62, 3.2);
      starPoly(g, 6, 60, 30, 3.2);
      g.fillStyle = 'rgba(255,255,255,0.62)';
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    }),
  };
  return sealTexCache;
}

let haloTexCache = null;
function haloGlyphs() {
  if (haloTexCache) return haloTexCache;
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    const bg = g.createRadialGradient(0, 0, 8, 0, 0, 114);
    bg.addColorStop(0, 'rgba(24, 12, 38, 0.32)');
    bg.addColorStop(0.75, 'rgba(24, 12, 38, 0.18)');
    bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(0, 0, 114, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 14;
    g.scale(1.22, 1.22);
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.userData.shared = true;
    return t;
  };
  haloTexCache = {
    kitsune: mk((g) => {
      // 5 glowing kitsune orbs arranged in an upper fan arc
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.42 - Math.PI / 2;
        const x = Math.cos(a) * 64, y = Math.sin(a) * 54 + 16;
        g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
        g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(x, y - 10); g.quadraticCurveTo(x, y - 28, x + i * 3, y - 32); g.stroke();
      }
    }),
    aurora_crown: mk((g) => {
      g.lineWidth = 4.2;
      g.beginPath(); g.arc(0, 10, 58, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.28 - Math.PI / 2;
        const r1 = 44, r2 = i === 0 ? 84 : (Math.abs(i) === 1 ? 72 : 60);
        g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 + 12); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 + 12); g.stroke();
      }
    }),
    ankh: mk((g) => {
      g.lineWidth = 5.5;
      g.beginPath(); g.arc(0, -24, 23, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-50, 2); g.lineTo(50, 2); g.stroke();
      g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 58); g.stroke();
    }),
    crescent: mk((g) => {
      g.beginPath();
      g.arc(0, 0, 58, 0.3, Math.PI * 2 - 0.3);
      g.arc(18, -10, 46, Math.PI * 2 - 0.4, 0.4, true);
      g.closePath(); g.fill();
    }),
    crown: mk((g) => {
      g.lineWidth = 4.5;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      g.moveTo(-46, 24);
      g.lineTo(-54, -18);
      g.lineTo(-22, 4);
      g.lineTo(0, -36);
      g.lineTo(22, 4);
      g.lineTo(54, -18);
      g.lineTo(46, 24);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#fff';
      for (const [x, y] of [[-54, -24], [0, -44], [54, -24]]) {
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      }
    }),
    jackpot: mk((g) => {
      g.lineWidth = 4.2;
      g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.stroke();
      g.font = '900 44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('777', 0, 2);
    }),
    seraphim_wings: mk((g) => {
      g.lineWidth = 3.8;
      g.fillStyle = 'rgba(255,255,255,0.68)';
      for (const s of [-1, 1]) {
        for (let w = 0; w < 3; w++) {
          g.save();
          g.translate(s * 14, -8 + w * 18);
          g.rotate(s * (-0.35 + w * 0.32));
          g.beginPath(); g.ellipse(s * 42, 0, 38 - w * 4, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke();
          g.restore();
        }
      }
    }),
    twin_dragons: mk((g) => {
      g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 62, 0.2, Math.PI - 0.2); g.stroke();
      g.beginPath(); g.arc(0, 0, 62, Math.PI + 0.2, Math.PI * 2 - 0.2); g.stroke();
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    }),
  };
  return haloTexCache;
}

const relicTexCache = new Map();
function charmRelicTexture(kind, P) {
  if (relicTexCache.has(kind)) return relicTexCache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const hex1 = '#' + (P.c1 || new THREE.Color(1, 0.8, 0.3)).getHexString();
  const hex2 = '#' + (P.c2 || P.c1 || new THREE.Color(1, 0.9, 0.6)).getHexString();

  const drawBackdrop = () => {
    g.clearRect(0, 0, 256, 256);
    // Soft ethereal wisp-soul radial glow (no hard white sticker ring)
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 122);
    grad.addColorStop(0, '#ffffffcc');
    grad.addColorStop(0.32, hex2 + 'aa');
    grad.addColorStop(0.68, hex1 + '44');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
  };
  drawBackdrop();
  // Synchronous star-spirit fallback before PNG finishes loading
  g.fillStyle = '#ffffff';
  g.shadowColor = hex1;
  g.shadowBlur = 16;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 56 : 22;
    if (i === 0) g.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    else g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
  }
  g.closePath(); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  relicTexCache.set(kind, tex);

  if (typeof Image !== 'undefined' && kind.startsWith('charm_')) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawBackdrop();
      g.save();
      g.shadowColor = hex1;
      g.shadowBlur = 18;
      g.drawImage(img, 20, 20, 216, 216);
      g.restore();
      tex.needsUpdate = true;
    };
    img.src = `/assets/ui/charms/${kind}.png`;
  }
  return tex;
}

let wispGlowTex = null;
function getWispGlowTex() {
  if (wispGlowTex) return wispGlowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  wispGlowTex = new THREE.CanvasTexture(c);
  wispGlowTex.userData.shared = true;
  return wispGlowTex;
}

// ------------------------------------------------------------------ the aura
export class WearAura {
  constructor(rig, kind, grade = 'B') {
    this.rig = rig;
    this.kind = kind;
    this.grade = grade || 'B';
    this.gradeScale = grade === 'SS' ? 1.25 : grade === 'S' ? 1.14 : grade === 'A' ? 1.06 : 1.0;
    this.P = PROFILES[kind];
    this.t = Math.random() * 10;
    this.suitT = 0;                       // > 0 while the suit-up plays (counts down)
    this.twin = 0;                        // 0..1 Twin Eclipse brightness boost
    this.reduced = reducedMotion();
    this.group = new THREE.Group();
    this.group.name = 'wear_aura';
    rig.ROOT.add(this.group);
    this.lastWorld = null;
    this.stepSign = 0;
    this.stepSide = 1;
    this.stageStepTimer = 0;

    // points pool
    const geo = new THREE.BufferGeometry();
    const f = (n) => new THREE.BufferAttribute(new Float32Array(POINTS * n), n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', f(3));
    geo.setAttribute('aColor', f(3));
    geo.setAttribute('aSize', f(1));
    geo.setAttribute('aAlpha', f(1));
    geo.setAttribute('aShape', f(1));
    geo.setAttribute('aRot', f(1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * 0.6, 0), 3);
    this.pmat = new THREE.ShaderMaterial({
      uniforms: { uViewH: { value: 800 } }, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.pmat);
    this.points.renderOrder = 5;
    this.points.onBeforeRender = (renderer) => { this.pmat.uniforms.uViewH.value = renderer.getDrawingBufferSize(_v).y || 800; };
    this.group.add(this.points);
    // particle state: free particles (motes / burst) live in world-ish space, kept in place by subtracting ROOT motion
    this.pt = Array.from({ length: POINTS }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, shape: 0, rot: 0, spin: 0, c: new THREE.Color() }));

    if (kind !== 'eclipse' && !this.P.noRibbons) {
      const rCount = this.P.ribbonCount || 2;
      this.ribbons = Array.from({ length: rCount }, (_, k) => this.makeRibbon(k));
    }
    if (this.P.seal) {
      this.sealGroup = new THREE.Group();
      this.group.add(this.sealGroup);
      this.sealOuter = this.makeSealMesh(this.P.seal, (this.P.sealR || 0.9) * this.gradeScale, this.P.sealColor || this.P.c1 || this.P.pillar, 0.024);
      if (this.P.sealInner) {
        this.sealInner = this.makeSealMesh(this.P.sealInner, (this.P.sealR || 1.0) * 0.68 * this.gradeScale, this.P.sealInnerColor || this.P.c2 || this.P.pillar, 0.032);
      }
    }
    if (this.P.spirit) {
      this.spirit = this.makeSpiritWisp();
    }
    this.pillar = this.makePillar();
    this.feet = [];                       // footprint decals (lazily parented to the scene)
  }

  // ---------------------------------------------------------------- builders
  makeRibbon(k) {
    const SEG = 24;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const u = new Float32Array(SEG * 2), side = new Float32Array(SEG * 2);
    for (let i = 0; i < SEG; i++) { u[i * 2] = u[i * 2 + 1] = i / (SEG - 1); side[i * 2] = -1; side[i * 2 + 1] = 1; }
    geo.setAttribute('aU', new THREE.BufferAttribute(u, 1));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    const idx = [];
    for (let i = 0; i < SEG - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * 0.6, 0), 2);
    const P = this.P;
    let cA, cB, cC, flow = 0;
    if (this.kind === 'seraphim') {
      cA = k ? P.gold : P.rose; cB = P.pearl; cC = k ? P.rose : P.gold; flow = 0.6;
    } else if (this.kind === 'cyber') {
      cA = k ? P.magenta : P.cyan; cB = P.gold; cC = k ? P.cyan : P.violet; flow = 1.0;
    } else if (this.kind === 'ribbon') {
      cA = k ? P.sky : P.pink; cB = P.gold; cC = k ? P.pink : P.lavender; flow = 0.8;
    } else if (P.c1) {
      cA = k ? (P.c2 || P.c1) : P.c1;
      cB = P.c3 || P.star || P.c1;
      cC = k ? P.c1 : (P.c2 || P.c1);
      flow = (P.tier || 2) >= 3 ? 0.95 : 0.65;
    } else {
      cA = k ? P.violet : P.teal; cB = k ? P.pink : P.violet; cC = k ? P.teal : P.pink;
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: cA.clone() }, uB: { value: cB.clone() }, uC: { value: cC.clone() }, uAlpha: { value: 0.78 }, uTime: { value: 0 }, uFlow: { value: this.reduced ? 0 : flow } },
      vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return { mesh, k, seg: SEG };
  }

  makeSealMesh(sealKey, radius, color, yOffset = 0.024) {
    const tex = sealGlyphs()[sealKey] || sealGlyphs().clock;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: (color || new THREE.Color(1, 1, 1)).clone(),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const size = radius * 2;
    const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, yOffset, 0);
    mesh.renderOrder = 2;
    (this.sealGroup || this.group).add(mesh);
    return mesh;
  }

  makeSpiritWisp() {
    const P = this.P;
    const tier = P.tier || 1;
    // Strict Tier 4 > Tier 3 > Tier 2 > Tier 1 Spirit Wisp scale progression
    const tierSizes = { 1: 0.22, 2: 0.28, 3: 0.35, 4: 0.44 };
    const baseSize = (tierSizes[tier] || 0.28) * Math.min(1.16, this.gradeScale);
    const group = new THREE.Group();
    group.name = 'charm_spirit_wisp';
    this.group.add(group);

    // Tier 4 MVP only: Grand Sovereign outer soul-flame corona
    let outerCorona = null;
    if (tier >= 4) {
      const coronaMat = new THREE.SpriteMaterial({
        map: getWispGlowTex(),
        color: (P.c2 || P.pillar || new THREE.Color(1, 0.85, 0.45)).clone(),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      outerCorona = new THREE.Sprite(coronaMat);
      outerCorona.scale.set(baseSize * 2.25, baseSize * 2.25, 1);
      outerCorona.renderOrder = 4;
      group.add(outerCorona);
    }

    // 1. Primary additive soul-flame aura behind the spirit (scaled by tier)
    const glowScale = tier === 1 ? 1.45 : (tier === 2 ? 1.62 : 1.78);
    const glowMat = new THREE.SpriteMaterial({
      map: getWispGlowTex(),
      color: (P.c1 || P.pillar || new THREE.Color(1, 0.8, 0.4)).clone(),
      transparent: true,
      opacity: tier === 1 ? 0.64 : (tier === 2 ? 0.78 : 0.90),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(baseSize * glowScale, baseSize * glowScale, 1);
    glow.renderOrder = 5;
    group.add(glow);

    // 2. Inner bright wisp-core halo (Tiers 3 & 4 only)
    let innerGlow = null;
    if (tier >= 3) {
      const innerGlowMat = new THREE.SpriteMaterial({
        map: getWispGlowTex(),
        color: (P.star || P.c2 || new THREE.Color(1, 0.96, 0.85)).clone(),
        transparent: true,
        opacity: tier >= 4 ? 0.92 : 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      innerGlow = new THREE.Sprite(innerGlowMat);
      innerGlow.scale.set(baseSize * 1.20, baseSize * 1.20, 1);
      innerGlow.renderOrder = 6;
      group.add(innerGlow);
    }

    // 3. The floating Spirit Wisp Core (clean 256x256 charm relic with inner luminescence)
    const coreMat = new THREE.SpriteMaterial({
      map: charmRelicTexture(this.kind, P),
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.set(baseSize, baseSize, 1);
    core.renderOrder = 7;
    group.add(core);

    const tierHoverY = tier === 1 ? H * 0.44 : (tier === 2 ? H * 0.68 : (tier === 3 ? H * 0.82 : H * 0.89));
    const startX = tier === 1 ? 0.46 : (tier === 2 ? 0.51 : (tier === 3 ? 0.55 : 0.58));
    const startY = tierHoverY;
    const startZ = 0.22;
    group.position.set(startX, startY, startZ);
    const trail = Array.from({ length: 24 }, (_, i) => {
      const u = i / 23;
      return {
        x: startX + u * 0.24,
        y: startY - u * 0.48,
        z: startZ - u * 0.16,
      };
    });

    return {
      group,
      outerCorona,
      glow,
      innerGlow,
      core,
      baseSize,
      pos: { x: startX, y: startY, z: startZ },
      vel: { x: 0, y: 0, z: 0 },
      lag: { x: 0, z: 0 },
      trail,
    };
  }

  makePillar() {
    const geo = new THREE.CylinderGeometry(0.5, 0.62, H * 2.4, 20, 1, true).translate(0, H * 1.2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: this.P.pillar.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: PILLAR_VERT, fragmentShader: PILLAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.renderOrder = 3;
    this.group.add(m);
    return m;
  }

  footprint() {
    const scene = this.rig.ROOT.parent;
    if (!scene) return null;
    let fp = this.feet.find((f) => f.life <= 0);
    if (!fp && this.feet.length < FOOTPRINTS) {
      const mat = new THREE.MeshBasicMaterial({
        map: footGlyphs()[this.P.foot], color: this.P.footTint, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36).rotateX(-Math.PI / 2), mat);
      mesh.renderOrder = 2;
      scene.add(mesh);
      fp = { mesh, life: 0 };
      this.feet.push(fp);
    }
    if (fp && fp.mesh.parent !== scene) scene.add(fp.mesh);
    return fp;
  }

  // ---------------------------------------------------------------- spawning
  spawnMote(p) {
    const P = this.P, a = Math.random() * Math.PI * 2, r = 0.15 + Math.random() * 0.45;
    p.x = Math.cos(a) * r; p.z = Math.sin(a) * r * 0.7;
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 2;
    if (this.kind === 'eclipse') {        // embers: rise from the hem with a little drift
      p.y = 0.05 + Math.random() * 0.5;
      p.vx = (Math.random() - 0.5) * 0.12; p.vz = (Math.random() - 0.5) * 0.12; p.vy = 0.25 + Math.random() * 0.35;
      p.size = 0.05 + Math.random() * 0.05; p.shape = 2; p.max = 1.2 + Math.random() * 1.0;
      p.c.copy(Math.random() < 0.6 ? P.ember : P.gold);
    } else if (this.kind === 'seraphim') { // floating rose petals & champagne diamond sparkles
      p.y = 0.08 + Math.random() * H * 1.05;
      p.vx = (Math.random() - 0.5) * 0.10; p.vz = (Math.random() - 0.5) * 0.10; p.vy = 0.08 + Math.random() * 0.16;
      const isPetal = Math.random() < 0.58;
      p.size = (isPetal ? 0.065 : 0.05) + Math.random() * 0.055; p.shape = isPetal ? 3 : 1; p.max = 1.5 + Math.random() * 1.4;
      p.c.copy([P.rose, P.gold, P.pearl, P.star][(Math.random() * 4) | 0]);
    } else if (this.kind === 'cyber') {    // anti-gravity quantum data nodes & neon plasma sparks
      p.y = 0.05 + Math.random() * H * 0.95;
      p.vx = (Math.random() - 0.5) * 0.09; p.vz = (Math.random() - 0.5) * 0.09; p.vy = 0.22 + Math.random() * 0.32;
      p.size = 0.05 + Math.random() * 0.055; p.shape = Math.random() < 0.65 ? 1 : 2; p.max = 1.1 + Math.random() * 1.1;
      p.c.copy([P.cyan, P.magenta, P.violet, P.gold][(Math.random() * 4) | 0]);
    } else if (this.kind === 'ribbon') {   // dreamy pastel stars, ribbon petals & soft wish bubbles
      p.y = 0.1 + Math.random() * H * 1.05;
      p.vx = (Math.random() - 0.5) * 0.09; p.vz = (Math.random() - 0.5) * 0.09; p.vy = 0.06 + Math.random() * 0.14;
      const roll = Math.random();
      p.size = 0.055 + Math.random() * 0.06; p.shape = roll < 0.5 ? 1 : (roll < 0.8 ? 3 : 0); p.max = 1.5 + Math.random() * 1.5;
      p.c.copy([P.pink, P.sky, P.gold, P.lavender][(Math.random() * 4) | 0]);
    } else if (P.c1) {                     // 16 Starlight Aura Charms bespoke particle physics
      const roll = Math.random();
      if (this.kind === 'charm_berry_perfume' || this.kind === 'charm_siren_pearl') {
        // Glossy strawberry soap-bubbles & iridescent pearls rising from ankles
        p.y = 0.05 + Math.random() * H * 0.55;
        p.vx = (Math.random() - 0.5) * 0.09; p.vz = (Math.random() - 0.5) * 0.09;
        p.vy = 0.18 + Math.random() * 0.22;
        p.shape = roll < 0.68 ? 0 : 1;
      } else if (this.kind === 'charm_clover_bell') {
        // Sprouting 4-leaf clover blossoms around feet & ankles
        p.y = 0.04 + Math.random() * H * 0.45;
        p.vx = (Math.random() - 0.5) * 0.10; p.vz = (Math.random() - 0.5) * 0.10;
        p.vy = 0.14 + Math.random() * 0.16;
        p.shape = roll < 0.68 ? 3 : 1;
      } else if (this.kind === 'charm_kitsune_omamori' || this.kind === 'charm_glacial_snowglobe' || this.kind === 'charm_golden_pinata_trophy') {
        // Falling sakura petal rain / crystalline snow / overhead confetti & gold shower
        p.y = H * (0.65 + Math.random() * 0.45);
        p.vx = (Math.random() - 0.5) * 0.14; p.vz = (Math.random() - 0.5) * 0.14;
        p.vy = -(0.14 + Math.random() * 0.20);
        p.shape = this.kind === 'charm_glacial_snowglobe' ? 1 : (roll < 0.55 ? 3 : 1);
      } else {
        p.y = 0.06 + Math.random() * H * 1.05;
        p.vx = (Math.random() - 0.5) * 0.10; p.vz = (Math.random() - 0.5) * 0.10;
        p.vy = (P.tier >= 3 ? 0.15 : 0.09) + Math.random() * 0.18;
        p.shape = roll < 0.48 ? 1 : (roll < 0.78 ? 3 : 0);
      }
      p.size = (0.065 + (P.tier || 1) * 0.012 + Math.random() * 0.055) * this.gradeScale;
      p.max = 1.3 + Math.random() * 1.2;
      p.c.copy([P.c1, P.c2 || P.c1, P.c3 || P.c1, P.star || P.c1][(Math.random() * 4) | 0]);
    } else {                              // aurora star dust: drifting twinkles around the whole body
      p.y = 0.1 + Math.random() * H * 1.05;
      p.vx = (Math.random() - 0.5) * 0.08; p.vz = (Math.random() - 0.5) * 0.08; p.vy = 0.04 + Math.random() * 0.08;
      p.size = 0.045 + Math.random() * 0.06; p.shape = Math.random() < 0.45 ? 1 : 0; p.max = 1.6 + Math.random() * 1.6;
      p.c.copy([P.star, P.teal, P.violet, P.pink][(Math.random() * 4) | 0]);
    }
    p.life = p.max * (0.3 + 0.7 * Math.random());
  }

  burst() {                               // suit-up finale: radial ring of embers / stars / petals
    const P = this.P, o = P.wisp + P.motes;
    for (let i = 0; i < P.burst; i++) {
      if (o + i >= this.pt.length) break;
      const p = this.pt[o + i], a = (i / P.burst) * Math.PI * 2, sp = 1.4 + Math.random() * 0.8;
      p.x = 0; p.y = H * 0.55; p.z = 0;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp * 0.6; p.vy = 0.6 + Math.random() * 0.9;
      p.size = 0.09 + Math.random() * 0.06;
      p.shape = this.kind === 'eclipse' ? 2 : (this.kind === 'seraphim' && i % 2 === 0 ? 3 : 1);
      p.rot = a; p.spin = 3; p.max = p.life = 0.8 + Math.random() * 0.4;
      if (this.kind === 'eclipse') p.c.copy(i % 2 ? P.gold : P.ember);
      else if (this.kind === 'seraphim') p.c.copy([P.rose, P.gold, P.pearl, P.star][i % 4]);
      else if (this.kind === 'cyber') p.c.copy([P.cyan, P.magenta, P.gold, P.violet][i % 4]);
      else if (this.kind === 'ribbon') p.c.copy([P.pink, P.sky, P.gold, P.lavender][i % 4]);
      else if (P.c1) p.c.copy([P.c1, P.c2 || P.c1, P.c3 || P.c1, P.star || P.c1][i % 4]);
      else p.c.copy([P.teal, P.violet, P.pink, P.star][i % 4]);
    }
  }

  playSuitUp() {
    this.suitT = this.reduced ? 0.6 : SUIT_UP_S;
    this.burstDone = false;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    dt = Math.min(0.05, Math.max(0, dt || 0));
    WearAura.frameTick();
    const rig = this.rig, P = this.P, red = this.reduced;
    const isStage = !!rig._isStagePreview;
    const speedMul = red ? 0.3 : 1;
    this.t += dt * speedMul;
    const t = this.t;

    // ROOT motion this frame (world) → free particles stay put in the world, decals know where the feet are
    const wp = rig.ROOT.position;
    let dx = 0, dz = 0;
    if (this.lastWorld) { dx = wp.x - this.lastWorld.x; dz = wp.z - this.lastWorld.z; } else this.lastWorld = new THREE.Vector3();
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2) { dx = 0; dz = 0; } // teleports: don't smear
    this.lastWorld.copy(wp);
    const moveV = dt > 0 ? Math.hypot(dx, dz) / dt : 0;

    // suit-up timeline (0 → 1)
    let su = -1;
    if (this.suitT > 0) {
      this.suitT = Math.max(0, this.suitT - dt);
      su = 1 - this.suitT / (red ? 0.6 : SUIT_UP_S);
      if (!red && su > 0.72 && !this.burstDone) {
        this.burstDone = true;
        this.burst();
        if ('castT' in rig) { rig.castMax = 0.55; rig.castT = 0.55; } // the "pose" beat
      }
    }
    const pil = this.pillar;
    if (su >= 0 && !red && !this.spirit) {
      pil.visible = true;
      const rise = Math.min(1, su / 0.3), fade = su > 0.75 ? 1 - (su - 0.75) / 0.25 : 1;
      pil.scale.set(1 + 0.3 * (1 - rise), rise, 1 + 0.3 * (1 - rise));
      pil.material.uniforms.uAlpha.value = 0.75 * fade;
      pil.material.uniforms.uTime.value = t;
    } else pil.visible = false;

    const q = quality.level * (red ? 0.4 : 1);
    const nWisp = Math.max(1, Math.round(P.wisp * Math.min(1, q + 0.25)));
    const nMote = Math.round(P.motes * q);
    const glow = (1 + this.twin * 0.6) * this.gradeScale;
    const pos = this.points.geometry.attributes;
    const intro = su >= 0 ? (0.65 + 0.35 * Math.min(1, su / 0.4)) : 1; // keep aura visible right from frame 1

    // Ground Seal animation (Tiers 2-4 Charms)
    if (this.sealGroup) {
      // In the horizontal Wardrobe Preview Stage, tilt the ground seal ~30° toward the viewer so it matches the 3D isometric game camera!
      this.sealGroup.rotation.x = isStage ? 0.52 : 0;
      this.sealGroup.position.set(0, isStage ? 0.14 : 0, isStage ? -0.08 : 0);
    }
    if (this.sealOuter) {
      this.sealOuter.rotation.y = t * 0.55;
      const pulse = (isStage ? 0.76 : 1.0) * (1 + 0.04 * Math.sin(t * 2.6));
      this.sealOuter.scale.set(pulse, 1, pulse);
      this.sealOuter.material.opacity = (0.82 + 0.12 * Math.sin(t * 3.2)) * intro;
    }
    if (this.sealInner) {
      this.sealInner.rotation.y = -t * 0.92;
      const pulse2 = (isStage ? 0.76 : 1.0) * (1 + 0.06 * Math.cos(t * 3.4));
      this.sealInner.scale.set(pulse2, 1, pulse2);
      this.sealInner.material.opacity = (0.88 + 0.10 * Math.cos(t * 4.0)) * intro;
    }

    // Living Spirit Wisp Companion (Tiers 1-4 Charms: strict Tier 4 > Tier 3 > Tier 2 > Tier 1 progression)
    if (this.spirit) {
      const sp = this.spirit;
      const tier = P.tier || 1;
      const ph = t * 1.65;
      // Hover height & side offset scale up per tier (Tier 1 near knee/waist, Tier 2 mid-shoulder, Tier 3 upper shoulder, Tier 4 crown-shoulder)
      const anchorX = tier === 1 ? 0.46 : (tier === 2 ? 0.51 : (tier === 3 ? 0.55 : 0.58));
      const hoverY = tier === 1 ? H * 0.44 : (tier === 2 ? H * 0.68 : (tier === 3 ? H * 0.82 : H * 0.89));
      const bobAmp = tier === 1 ? 0.06 : (tier === 2 ? 0.08 : (tier === 3 ? 0.11 : 0.13));
      const tx = anchorX + bobAmp * Math.sin(ph) + 0.03 * Math.cos(t * 2.7);
      const ty = hoverY + bobAmp * Math.sin(ph * 2) + 0.03 * Math.cos(t * 2.2);
      const tz = 0.22 + 0.09 * Math.cos(ph);

      // Shift by (-dx, -dz) so the Spirit Wisp genuinely trails behind in world space when walking/running
      sp.pos.x -= dx * 0.85;
      sp.pos.z -= dz * 0.85;
      const kSpring = 20.0;
      const damp = Math.exp(-6.2 * dt);
      sp.vel.x = (sp.vel.x + (tx - sp.pos.x) * kSpring * dt) * damp;
      sp.vel.y = (sp.vel.y + (ty - sp.pos.y) * kSpring * dt) * damp;
      sp.vel.z = (sp.vel.z + (tz - sp.pos.z) * kSpring * dt) * damp;
      sp.pos.x += sp.vel.x * dt;
      sp.pos.y += sp.vel.y * dt;
      sp.pos.z += sp.vel.z * dt;

      // Smoothed world-motion lag vector so the comet tail streams backward when running
      const lagDecay = Math.exp(-5.0 * dt);
      sp.lag.x = THREE.MathUtils.clamp(sp.lag.x * lagDecay - dx * 5.2, -0.75, 0.75);
      sp.lag.z = THREE.MathUtils.clamp(sp.lag.z * lagDecay - dz * 5.2, -0.75, 0.75);

      // Clamp max lag distance so dashes/teleports never lose the spirit
      const dist = Math.hypot(sp.pos.x - tx, sp.pos.y - ty, sp.pos.z - tz);
      if (dist > 1.6) {
        const sClamp = 1.6 / dist;
        sp.pos.x = tx + (sp.pos.x - tx) * sClamp;
        sp.pos.y = ty + (sp.pos.y - ty) * sClamp;
        sp.pos.z = tz + (sp.pos.z - tz) * sClamp;
      }

      sp.group.position.set(sp.pos.x, sp.pos.y, sp.pos.z);

      // Breathing scale + banking tilt into flight direction
      const breathe = 1 + 0.07 * Math.sin(t * 3.8);
      const sc = sp.baseSize * breathe;
      sp.core.scale.set(sc, sc * (1 + 0.03 * Math.cos(t * 3.8)), 1);
      sp.core.material.rotation = THREE.MathUtils.clamp(-sp.vel.x * 0.22 + 0.10 * Math.sin(t * 2.8), -0.38, 0.38);
      sp.core.material.opacity = 0.98 * intro;

      if (sp.outerCorona) {
        const cPulse = sp.baseSize * (2.22 + 0.28 * Math.sin(t * 3.9));
        sp.outerCorona.scale.set(cPulse, cPulse, 1);
        sp.outerCorona.material.opacity = (0.64 + 0.18 * Math.sin(t * 3.9)) * intro;
      }

      const glowScale = tier === 1 ? 1.42 : (tier === 2 ? 1.60 : 1.76);
      const glowPulse = sp.baseSize * (glowScale + 0.18 * Math.sin(t * 4.6));
      sp.glow.scale.set(glowPulse, glowPulse, 1);
      const baseGlowOp = tier === 1 ? 0.60 : (tier === 2 ? 0.74 : 0.86);
      sp.glow.material.opacity = (baseGlowOp + 0.12 * Math.sin(t * 4.6)) * intro;

      if (sp.innerGlow) {
        const igPulse = sp.baseSize * (1.18 + 0.14 * Math.cos(t * 5.2));
        sp.innerGlow.scale.set(igPulse, igPulse, 1);
        sp.innerGlow.material.opacity = ((tier >= 4 ? 0.88 : 0.76) + 0.14 * Math.cos(t * 5.2)) * intro;
      }

      // Update 24-node Sinuous Wisp Comet Tail (length strictly scales by Tier 1 < Tier 2 < Tier 3 < Tier 4)
      const tr = sp.trail;
      const tierTailLengths = { 1: 0.30, 2: 0.45, 3: 0.62, 4: 0.88 };
      const tailLen = (tierTailLengths[tier] || 0.48) * Math.min(1.15, this.gradeScale);
      const lerpRate = Math.min(1, dt * 16);
      for (let i = 0; i < tr.length; i++) {
        const u = i / (tr.length - 1);
        const wave1 = Math.sin(t * 5.4 - u * 6.4);
        const wave2 = Math.cos(t * 4.0 - u * 4.8);
        const targetX = sp.pos.x + u * 0.34 * tailLen + sp.lag.x * u + wave1 * 0.12 * Math.pow(u, 0.8);
        const targetY = sp.pos.y - u * 0.68 * tailLen + Math.sin(u * Math.PI) * 0.08 + wave2 * 0.07 * u;
        const targetZ = sp.pos.z - u * 0.22 * tailLen + sp.lag.z * u + wave2 * 0.08 * u;
        if (i === 0) {
          tr[0].x = sp.pos.x;
          tr[0].y = sp.pos.y;
          tr[0].z = sp.pos.z;
        } else {
          tr[i].x += (targetX - tr[i].x) * lerpRate;
          tr[i].y += (targetY - tr[i].y) * lerpRate;
          tr[i].z += (targetZ - tr[i].z) * lerpRate;
        }
      }
    }

    let w = 0;
    const put = (x, y, z, c, size, alpha, shape, rot) => {
      if (w >= POINTS) return;
      pos.position.setXYZ(w, x, y, z);
      pos.aColor.setXYZ(w, c.r, c.g, c.b);
      pos.aSize.setX(w, size); pos.aAlpha.setX(w, Math.min(1, alpha)); pos.aShape.setX(w, shape); pos.aRot.setX(w, rot);
      w++;
    };

    // 1) wisp: signature orbital choreography per Super Mythic or Spirit Comet Wake for Charms
    if (this.kind === 'eclipse') {
      // coil: during suit-up the dragon spirals in from wide + low to its idle orbit
      const coil = su >= 0 ? 1 - Math.min(1, su / 0.72) : 0;
      const R = 0.55 + coil * 0.7, spin = 0.9 + coil * 5;
      for (let i = 0; i < nWisp; i++) {
        const lag = i * 0.16, a = t * spin - lag;
        const y = H * (0.55 + 0.18 * Math.sin(t * 0.7 - lag * 1.3)) - coil * (1 - i / P.wisp) * H * 0.4 + coil * Math.sin(a) * 0.3;
        const head = i === 0, k = i / P.wisp;
        const c = head ? P.gold : (i % 3 === 0 ? P.deep : P.gold);
        put(Math.cos(a) * R, y, Math.sin(a) * R * 0.75, c, (head ? 0.3 : 0.2 * (1 - k * 0.55)) * glow, (head ? 1 : 0.95 * (1 - k * 0.6)) * intro, head ? 1 : 0, a);
      }
    } else if (this.kind === 'seraphim') {
      // seraphim: upper rose-gold diamond halo crown + figure-8 swirling rose petals
      for (let i = 0; i < nWisp; i++) {
        const isHalo = i < (nWisp >> 1);
        const u = i / Math.max(1, nWisp);
        if (isHalo) {
          const a = t * 1.1 + i * ((Math.PI * 2) / Math.max(1, nWisp >> 1));
          const r = 0.42 + 0.04 * Math.sin(t * 2 + i);
          const y = H * 0.88 + 0.06 * Math.sin(a + t * 0.8);
          put(Math.cos(a) * r, y, Math.sin(a) * r * 0.75, i % 2 ? P.gold : P.star, 0.15 * glow, 0.92 * intro, 1, t * 2 + i);
        } else {
          const a = -t * 0.95 + u * Math.PI * 4;
          const r = 0.58 + 0.08 * Math.cos(t * 1.4 + i);
          const y = H * (0.48 + 0.22 * Math.sin(a * 2));
          put(Math.cos(a) * r, y, Math.sin(a) * r * 0.78, i % 2 ? P.rose : P.pearl, 0.17 * glow, 0.9 * intro, 3, a + t);
        }
      }
    } else if (this.kind === 'cyber') {
      // cyber: counter-rotating gyroscopic quantum nodes riding tilted X-rings
      for (let i = 0; i < nWisp; i++) {
        const k = i % 2, dir = k ? -1 : 1;
        const a = t * 1.65 * dir + (i / nWisp) * Math.PI * 2;
        const tilt = (k ? -0.48 : 0.48);
        const r = 0.60 + 0.04 * Math.sin(t * 3 + i);
        const x = Math.cos(a) * r;
        const y = H * 0.56 + Math.sin(a) * r * Math.sin(tilt);
        const z = Math.sin(a) * r * Math.cos(tilt) * 0.8;
        const c = [P.cyan, P.magenta, P.gold, P.violet][i % 4];
        put(x, y, z, c, (i % 3 === 0 ? 0.19 : 0.14) * glow, 0.95 * intro, i % 3 === 0 ? 1 : 2, t * 3 * dir + i);
      }
    } else if (this.kind === 'ribbon') {
      // ribbon: bouncy shooting-star & pastel-petal carousel spiraling around the wearer
      for (let i = 0; i < nWisp; i++) {
        const u = ((t * 0.24 + i / nWisp) % 1);
        const a = t * 0.9 + (i % 2) * Math.PI + u * 3.1;
        const r = 0.56 + 0.09 * Math.sin(t * 1.8 + i * 1.3);
        const y = H * (0.20 + u * 0.72) + 0.07 * Math.cos(t * 2.2 + i);
        const c = [P.gold, P.pink, P.sky, P.lavender][i % 4];
        put(Math.cos(a) * r, y, Math.sin(a) * r * 0.78, c, (i % 2 === 0 ? 0.17 : 0.14) * glow, Math.sin(u * Math.PI) * 0.95 * intro, i % 3 === 0 ? 3 : 1, t * 2.4 + i);
      }
    } else if (P.c1 && this.spirit) {
      // 16 Starlight Aura Charms: Sparkling fairy-dust wake + Tier 4 Star-Moon Satellites orbiting the Spirit Familiar!
      const tier = P.tier || 1;
      const tr = this.spirit.trail;
      const spPos = this.spirit.pos;
      for (let i = 0; i < nWisp; i++) {
        if (tier >= 4 && i < 2) {
          // Tier 4 MVP exclusive: 2 tiny glowing Star-Moon satellites orbiting tightly around the Grand Sovereign Spirit!
          const satA = t * 4.4 + i * Math.PI;
          const satR = this.spirit.baseSize * 0.56;
          const sx = spPos.x + Math.cos(satA) * satR;
          const sy = spPos.y + Math.sin(satA) * satR * 0.85;
          const sz = spPos.z + Math.sin(satA * 2) * 0.08;
          const sc = i === 0 ? (P.star || P.c1) : (P.c2 || P.c1);
          put(sx, sy, sz, sc, 0.19 * glow, 0.98 * intro, 1, t * 3.8 + i);
          continue;
        }
        const u = ((t * 0.55 + i / nWisp) % 1);
        const fIdx = u * (tr.length - 1);
        const idx0 = Math.min(tr.length - 1, fIdx | 0);
        const idx1 = Math.min(tr.length - 1, idx0 + 1);
        const frac = fIdx - idx0;
        const bx = tr[idx0].x + (tr[idx1].x - tr[idx0].x) * frac;
        const by = tr[idx0].y + (tr[idx1].y - tr[idx0].y) * frac;
        const bz = tr[idx0].z + (tr[idx1].z - tr[idx0].z) * frac;
        const curlA = t * 4.2 + i * 1.9 + u * 6.0;
        const curlR = (0.02 + u * 0.09) * (0.7 + tier * 0.14);
        const x = bx + Math.cos(curlA) * curlR;
        const y = by + Math.sin(curlA) * curlR * 0.85;
        const z = bz + Math.sin(curlA * 0.7) * curlR * 0.6;
        const c = [P.c1, P.c2 || P.c1, P.c3 || P.c1, P.star || P.c1][i % 4];
        const sz = (0.10 + tier * 0.026) * (1 - u * 0.45) * glow;
        const sh = (this.kind === 'charm_berry_perfume' || this.kind === 'charm_siren_pearl')
          ? (i % 3 === 0 ? 1 : 0)
          : (i % 2 === 0 ? 1 : 2);
        put(x, y, z, c, sz, Math.sin(Math.pow(u, 0.7) * Math.PI) * (tier === 1 ? 0.78 : (tier === 2 ? 0.88 : 0.98)) * intro, sh, t * 2.8 + i);
      }
    } else {
      for (let i = 0; i < nWisp; i++) {
        const k = i % 2, u = ((t * 0.18 + i / nWisp) % 1);
        const a = t * 0.6 + k * Math.PI + u * 2.2;
        const r = 0.58 + 0.07 * Math.sin(t * 1.1 + u * 5);
        const y = H * (0.22 + u * 0.68) + 0.08 * Math.sin(t * 1.3 + u * 4 + k);
        put(Math.cos(a) * r, y, Math.sin(a) * r * 0.75, P.star, 0.13 * glow, Math.sin(u * Math.PI) * intro, 1, t * 2 + i);
      }
    }

    // 2) motes / star dust + 3) burst pool (free particles)
    const o = P.wisp;
    for (let i = 0; i < P.motes + P.burst; i++) {
      if (o + i >= this.pt.length) break;
      const isBurst = i >= P.motes, p = this.pt[o + i];
      if (!p) continue;
      if (!isBurst && i >= nMote) continue;
      if (p.life <= 0) {
        if (isBurst) continue;
        this.spawnMote(p);
      }
      p.life -= dt * (isBurst ? 1 : speedMul);
      p.x += p.vx * dt * speedMul - dx; p.y += p.vy * dt * speedMul; p.z += p.vz * dt * speedMul - dz;
      if (isBurst) { p.vy -= 1.6 * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; }
      else if (this.kind !== 'eclipse') { p.vx += Math.sin(t * 1.5 + i) * 0.025 * dt; }
      p.rot += p.spin * dt;
      // recycle motes that drift too far from the wearer (e.g. while running)
      if (!isBurst && ((p.x * p.x + p.z * p.z) > 2.2 || p.y < 0.02)) { p.life = 0; continue; }
      const k = p.life / p.max, fade = Math.min(1, (1 - k) * 4) * Math.min(1, k * 2.5);
      const tw = this.kind !== 'eclipse' && !isBurst ? 0.55 + 0.45 * Math.sin(t * 6 + i * 1.7) : 1;
      put(p.x, p.y, p.z, p.c, p.size * glow * (isBurst ? 1 : 0.8 + 0.4 * k), fade * tw * (isBurst ? 1 : intro), p.shape, p.rot);
    }
    this.points.geometry.setDrawRange(0, w);
    for (const k of AURA_ATTR_KEYS) pos[k].needsUpdate = true;

    // 3D ribbons: Spirit Wisp Comet Tail for Tiers 3-4 Charms (never crosses character wings!), or full-body curtain for Super Mythic outfits
    if (this.ribbons) {
      const curtain = su >= 0 ? Math.min(1, su / 0.6) : 1;
      for (const rb of this.ribbons) {
        const arr = rb.mesh.geometry.attributes.position;
        if (this.spirit) {
          // Tapered luminous Spirit Comet Tail streaming behind the Spirit Wisp along its 24-node flight trail
          // Tier 3 = 1 sleek silk ribbon; Tier 4 = 2 wider braided dual-helix comet ribbons
          const tr = this.spirit.trail;
          const tier = P.tier || 3;
          const baseW = (tier >= 4 ? 0.155 : 0.112) * this.gradeScale * curtain;
          for (let i = 0; i < rb.seg; i++) {
            const u = i / (rb.seg - 1);
            const pt = tr[Math.min(tr.length - 1, i)];
            const helixA = t * 5.2 - u * 7.8 + rb.k * Math.PI;
            const spread = tier >= 4 ? (rb.k === 0 ? 0.042 * Math.sin(u * Math.PI) : 0.068 * Math.sin(u * Math.PI)) : (0.015 * u);
            const x = pt.x + Math.cos(helixA) * spread;
            const y = pt.y + Math.sin(helixA) * spread * 0.6;
            const z = pt.z;
            const wv = baseW * Math.sin(Math.pow(u, 0.55) * Math.PI) * (1 - u * 0.32);
            // Offset perpendicular in XY so the comet tail is wide from any camera angle
            arr.setXYZ(i * 2, x - wv * 0.55, y - wv * 0.75, z);
            arr.setXYZ(i * 2 + 1, x + wv * 0.55, y + wv * 0.75, z);
          }
        } else {
          for (let i = 0; i < rb.seg; i++) {
            const u = i / (rb.seg - 1);
            let x, y, z, wv;
            if (this.kind === 'cyber') {
              const dir = rb.k ? -1 : 1;
              const a = t * 1.1 * dir + rb.k * Math.PI + u * Math.PI * 1.85;
              const tilt = (rb.k ? -0.46 : 0.46) * curtain;
              const r = (0.58 + 0.04 * Math.sin(t * 2 + u * 6)) * (0.6 + 0.4 * curtain);
              x = Math.cos(a) * r;
              y = H * 0.56 + Math.sin(a) * r * Math.sin(tilt);
              z = Math.sin(a) * r * Math.cos(tilt) * 0.78;
              wv = 0.12 * Math.sin(u * Math.PI) * curtain;
            } else if (this.kind === 'seraphim') {
              const a = t * 0.5 + rb.k * Math.PI + u * 2.7;
              const r = 0.54 + 0.12 * Math.sin(u * Math.PI) + 0.05 * Math.sin(t * 1.2 + u * 5);
              const yTop = H * 1.02, y0 = H * (0.24 + u * 0.72) + 0.11 * Math.sin(u * Math.PI * 2 + t * 1.4 + rb.k);
              y = yTop - (yTop - y0) * curtain;
              x = Math.cos(a) * r; z = Math.sin(a) * r * 0.76;
              wv = 0.16 * Math.sin(u * Math.PI) * (0.85 + 0.15 * Math.sin(t * 2.4 + u * 6)) * curtain;
            } else if (this.kind === 'ribbon') {
              const a = t * 0.68 + rb.k * Math.PI + u * 3.0;
              const r = 0.52 + 0.10 * Math.cos(u * Math.PI * 2 + t);
              const yTop = H * 0.82, y0 = H * (0.18 + u * 0.58) + 0.12 * Math.sin(u * Math.PI * 2 - t * 1.6 + rb.k * 1.5);
              y = yTop - (yTop - y0) * curtain;
              x = Math.cos(a) * r; z = Math.sin(a) * r * 0.78;
              wv = 0.14 * Math.sin(u * Math.PI) * (0.82 + 0.18 * Math.cos(t * 2.5 + u * 7)) * curtain;
            } else {
              const a = t * 0.55 + rb.k * Math.PI + u * 2.4;
              const r = 0.56 + 0.08 * Math.sin(t * 0.9 + u * 5 + rb.k);
              const yTop = H * 0.98, y0 = H * (0.2 + u * 0.75) + 0.09 * Math.sin(t * 1.25 + u * 4 + rb.k * 2);
              y = yTop - (yTop - y0) * curtain;
              x = Math.cos(a) * r; z = Math.sin(a) * r * 0.75;
              wv = 0.15 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(t * 2 + u * 6)) * curtain;
            }
            arr.setXYZ(i * 2, x, y - wv, z);
            arr.setXYZ(i * 2 + 1, x, y + wv, z);
          }
        }
        arr.needsUpdate = true;
        const u = rb.mesh.material.uniforms;
        u.uTime.value = t; u.uAlpha.value = (this.spirit ? (P.tier >= 4 ? 0.95 : 0.86) : (0.78 + 0.20 * this.twin)) * intro * (quality.level < 1 ? 0.85 : 1);
      }
    }

    // footsteps: one decal per leg-phase zero crossing while walking, OR periodic stage-preview bloom for Tier 1 footstep charms
    const ww = rig.walkWeight || 0;
    const s = Math.sin((rig.legPhase || 0) * 2);
    const sign = s >= 0 ? 1 : -1;
    if (isStage && (P.tier === 1 || ww > 0.2)) {
      this.stageStepTimer -= dt;
      if (this.stageStepTimer <= 0) {
        this.stageStepTimer = 0.55;
        const fp = this.footprint();
        if (fp) {
          this.stepSide = -this.stepSide;
          fp.mesh.position.set(wp.x + 0.24 * this.stepSide, wp.y + 0.10, wp.z + 0.15);
          fp.mesh.rotation.set(0.50, 0, this.stepSide * 0.2);
          fp.life = fp.max = 1.15;
        }
      }
    } else if (ww > 0.35 && moveV > 0.3 && sign !== this.stepSign && !rig.lifted) {
      const fp = this.footprint();
      if (fp) {
        const inv = 1 / Math.max(1e-4, Math.hypot(dx, dz));
        const sx = -dz * inv, sz = dx * inv;   // perpendicular to motion
        this.stepSide = -this.stepSide;
        fp.mesh.position.set(wp.x + sx * 0.12 * this.stepSide, wp.y + 0.02, wp.z + sz * 0.12 * this.stepSide);
        fp.mesh.rotation.set(0, Math.atan2(dx, dz), 0);
        fp.life = fp.max = red ? 0.8 : 1.3;
      }
    }
    this.stepSign = sign;
    for (const fp of this.feet) {
      if (fp.life <= 0) { fp.mesh.visible = false; continue; }
      fp.life -= dt;
      const k = Math.max(0, fp.life / fp.max);
      fp.mesh.visible = true;
      fp.mesh.material.opacity = 0.88 * Math.min(1, k * 1.6) * glow;
      const sc = 0.85 + 0.35 * (1 - k);
      fp.mesh.scale.set(sc, 1, sc);
    }
  }

  dispose() {
    registry.delete(this);
    for (const [key, L] of links) if (L.a === this || L.b === this) dropLink(key);
    this.group.parent?.remove(this.group);
    this.points.geometry.dispose(); this.pmat.dispose();
    this.pillar.geometry.dispose(); this.pillar.material.dispose();
    if (this.sealOuter) { this.sealOuter.geometry.dispose(); this.sealOuter.material.dispose(); }
    if (this.sealInner) { this.sealInner.geometry.dispose(); this.sealInner.material.dispose(); }
    if (this.spirit) {
      if (this.spirit.outerCorona) this.spirit.outerCorona.material.dispose();
      this.spirit.glow.material.dispose();
      if (this.spirit.innerGlow) this.spirit.innerGlow.material.dispose();
      this.spirit.core.material.dispose();
    }
    for (const rb of this.ribbons || []) { rb.mesh.geometry.dispose(); rb.mesh.material.dispose(); }
    for (const fp of this.feet) { fp.mesh.parent?.remove(fp.mesh); fp.mesh.geometry.dispose(); fp.mesh.material.dispose(); }
    this.feet = [];
  }

  // ---------------------------------------------------------------- statics
  /** Aura kind for an outfit id or equipped charm — pure catalog lookup. */
  static kindFor(outfitId, charm = null) {
    const charmKey = typeof charm === 'string' ? charm : (charm?.auraKind || charm?.id || null);
    if (charmKey && PROFILES[charmKey]) return charmKey;
    const k = OUTFITS[outfitId]?.aura;
    return PROFILES[k] ? k : null;
  }

  /** Mount / swap / unmount the aura that matches `outfitId` + `charm` on a ChibiRig. */
  static sync(rig, outfitId, { suitUp = false, charm = undefined } = {}) {
    if (!rig?.ROOT) return null;
    const activeCharm = charm !== undefined ? charm : rig.charm;
    const kind = WearAura.kindFor(outfitId, activeCharm);
    const grade = (typeof activeCharm === 'object' && activeCharm?.grade) || 'B';
    const cur = rig._wearAura;
    if (cur && cur.kind === kind && cur.grade === grade) return cur;
    if (cur) { cur.dispose(); rig._wearAura = null; }
    if (!kind) return null;
    const aura = new WearAura(rig, kind, grade);
    rig._wearAura = aura;
    registry.add(aura);
    if (suitUp) aura.playSuitUp();
    return aura;
  }

  static playSuitUp(rig) { rig?._wearAura?.playSuitUp(); }

  static dispose(rig) {
    if (rig?._wearAura) { rig._wearAura.dispose(); rig._wearAura = null; }
  }

  /** Once per rendered frame (first aura update wins): frame-time monitor + automatic Twin Eclipse links. */
  static frameTick() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - quality.lastNow < 4) return;   // same frame (several auras updating)
    const ft = quality.lastNow ? now - quality.lastNow : 16;
    quality.lastNow = now;
    if (ft < 250) {                          // ignore tab-switch gaps
      if (ft > 20) { quality.slowFor += ft; quality.fastFor = 0; } else { quality.fastFor += ft; quality.slowFor = Math.max(0, quality.slowFor - ft * 0.5); }
      if (quality.level === 1 && quality.slowFor > 1500) { quality.level = 0.5; quality.slowFor = 0; }
      else if (quality.level < 1 && quality.fastFor > 8000) { quality.level = 1; quality.fastFor = 0; }
    }
    if (!WearAura.manualLinks) WearAura.updateTwinLinks(null, Math.min(0.05, ft / 1000));
  }

  /**
   * Twin Eclipse: links every eclipse wearer to the nearest aurora wearer within TWIN_RANGE (same scene).
   * @param rigs optional ChibiRig[] (defaults to every rig with a mounted aura). Passing a list switches off
   *        the automatic per-frame call so the world stays in control.
   * @returns [{ a, b, dist }] active pairs (a = eclipse rig, b = aurora rig)
   */
  static updateTwinLinks(rigs = null, dt = 1 / 60) {
    if (rigs) WearAura.manualLinks = true;
    const auras = rigs ? rigs.map((r) => r?._wearAura).filter(Boolean) : [...registry];
    const ecl = auras.filter((a) => a.kind === 'eclipse'), aur = auras.filter((a) => a.kind === 'aurora');
    const want = new Map(), pairs = [];
    const used = new Set();
    for (const e of ecl) {
      let best = null, bd = TWIN_RANGE;
      for (const a of aur) {
        if (used.has(a) || a.rig.ROOT.parent !== e.rig.ROOT.parent || !e.rig.ROOT.parent) continue;
        const d = Math.hypot(a.rig.ROOT.position.x - e.rig.ROOT.position.x, a.rig.ROOT.position.z - e.rig.ROOT.position.z);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) { used.add(e); used.add(best); want.set(pairKey(e, best), [e, best]); pairs.push({ a: e.rig, b: best.rig, dist: bd }); }
    }
    // Also link any other Super Mythic wearers standing within TWIN_RANGE (couple / duo link)
    const rest = auras.filter((a) => !used.has(a));
    for (let i = 0; i < rest.length; i++) {
      const e = rest[i];
      if (used.has(e) || !e.rig.ROOT.parent) continue;
      let best = null, bd = TWIN_RANGE;
      for (let j = i + 1; j < rest.length; j++) {
        const a = rest[j];
        if (used.has(a) || a.rig.ROOT.parent !== e.rig.ROOT.parent) continue;
        const d = Math.hypot(a.rig.ROOT.position.x - e.rig.ROOT.position.x, a.rig.ROOT.position.z - e.rig.ROOT.position.z);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) { used.add(e); used.add(best); want.set(pairKey(e, best), [e, best]); pairs.push({ a: e.rig, b: best.rig, dist: bd }); }
    }
    for (const [key, [e, a]] of want) if (!links.has(key)) links.set(key, makeLink(e, a));
    for (const [key, L] of links) {
      const on = want.has(key);
      L.alpha = Math.max(0, Math.min(1, L.alpha + (on ? 2.5 : -3) * dt));
      L.a.twin = L.b.twin = L.alpha;
      if (L.alpha <= 0 && !on) { dropLink(key); continue; }
      updateLink(L, dt);
    }
    for (const a of auras) if (![...links.values()].some((L) => L.a === a || L.b === a)) a.twin = 0;
    return pairs;
  }

  static get quality() { return quality.level; }
}

// ------------------------------------------------------------------ Twin Eclipse / Super Mythic Duo link ribbon
let linkSeq = 0;
const pairKey = (e, a) => `${e.id ??= ++linkSeq}:${a.id ??= ++linkSeq}`;
const LINK_SEG = 28;
function makeLink(e, a) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINK_SEG * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const u = new Float32Array(LINK_SEG * 2), side = new Float32Array(LINK_SEG * 2);
  for (let i = 0; i < LINK_SEG; i++) { u[i * 2] = u[i * 2 + 1] = i / (LINK_SEG - 1); side[i * 2] = -1; side[i * 2 + 1] = 1; }
  geo.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  const idx = [];
  for (let i = 0; i < LINK_SEG - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  geo.setIndex(idx);
  const colA = (e.P?.linkColor || PROFILES.eclipse.gold).clone();
  const colC = (a.P?.linkColor || PROFILES.aurora.violet).clone();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: colA }, uB: { value: new THREE.Color(1, 0.95, 0.9) }, uC: { value: colC },
      uAlpha: { value: 0 }, uTime: { value: 0 }, uFlow: { value: reducedMotion() ? 0 : 1 },
    },
    vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  e.rig.ROOT.parent?.add(mesh);
  return { mesh, alpha: 0, a: e, b: a, t: 0 };
}
function updateLink(L, dt) {
  L.t += dt;
  const pa = L.a.rig.ROOT.position, pb = L.b.rig.ROOT.position;
  const arr = L.mesh.geometry.attributes.position;
  const d = Math.hypot(pb.x - pa.x, pb.z - pa.z);
  const y0 = H * 0.62, lift = 0.25 + d * 0.12;
  for (let i = 0; i < LINK_SEG; i++) {
    const u = i / (LINK_SEG - 1);
    const x = pa.x + (pb.x - pa.x) * u, z = pa.z + (pb.z - pa.z) * u;
    const y = pa.y + (pb.y - pa.y) * u + y0 + Math.sin(u * Math.PI) * lift + Math.sin(L.t * 2.4 + u * 7) * 0.04 * Math.sin(u * Math.PI);
    const wv = 0.05 + 0.02 * Math.sin(L.t * 3 + u * 10);
    arr.setXYZ(i * 2, x, y - wv, z);
    arr.setXYZ(i * 2 + 1, x, y + wv, z);
  }
  arr.needsUpdate = true;
  L.mesh.material.uniforms.uTime.value = L.t;
  L.mesh.material.uniforms.uAlpha.value = 0.85 * L.alpha;
}
function dropLink(key) {
  const L = links.get(key);
  if (!L) return;
  L.mesh.parent?.remove(L.mesh);
  L.mesh.geometry.dispose(); L.mesh.material.dispose();
  if (L.a) L.a.twin = 0;
  if (L.b) L.b.twin = 0;
  links.delete(key);
}

export default WearAura;
