// client/js/chibi_rig.js — 9-bone 2.5D chibi rig with Tree of Savior 4-diagonal facing.
//
// Bones: ROOT (ground) → HIP (hop) → TORSO (sway/breath) → HEAD (counter-tilt),
//        ARM_L / ARM_R (swing), LEG_L / LEG_R (scissor step), WINGS_L / WINGS_R (flap).
//
// Step 1 renders each lineage from a single full-body Front-3/4 and Back-3/4 sprite using
// UV bone-weight auto-skinning (Section 3, "UV Bone-Weight Auto-Skinning"): a 12×16
// subdivided plane whose vertices are weighted to HEAD / TORSO / ARM / LEG regions and
// deformed in the vertex shader. Wings are a separate layer so the Back-3/4 Z-order
// inversion (L1/L2) works. Modular 6-slot paper-doll layers plug into the same bones in Step 3.
import * as THREE from 'three';
import { loadSprite } from './assets.js';
import { FacingState, CHIBI_FACING } from '/shared/locomotion.js';
import { ATTACH, getAttachDef, getWingScale, resolveWingDimensions, RIG_METRICS, OUTFIT_FALLBACK, visibleSlotId, outfitHem, resolveAccessoryLayout, resolveHairLayout } from '/shared/accessory_attach.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { HAIRSTYLES, hairSpriteName, hairAttach, hairHatFit, resolveHairColor } from '/shared/hair_catalog.js';
import { WearAura } from './wear_aura.js?v=cd37';
import { getToolTexture, TOOL_ATTACH_DEFS, clearToolTextureCache } from './frontier/tool_sprites.js';

export { clearToolTextureCache };

export const CHIBI_HEIGHT = RIG_METRICS.CHIBI_HEIGHT; // world metres for the Front-3/4 sprite
const BILLBOARD_TILT = 0.55;                          // fraction of camera pitch the sprite leans back (reduces foreshortening)
const _scratchEuler = new THREE.Euler();

// Region boundaries in normalized sprite space (y: 0 feet → 1 top of ears)
const R = {
  HIP_Y: RIG_METRICS.HIP_Y,
  WAIST_Y: RIG_METRICS.WAIST_Y,
  SHOULDER_Y: RIG_METRICS.SHOULDER_Y,
  NECK_Y: RIG_METRICS.NECK_Y,
  ARM_X: 0.19,
};

const vertexShader = /* glsl */`
  uniform vec2 uSize;        // world w,h of current sprite
  uniform float uTorso;      // TORSO rotation (rad)
  uniform float uHead;       // HEAD rotation (rad)
  uniform float uLegL, uLegR;// LEG rotations
  uniform float uArmL, uArmR;// ARM rotations
  uniform float uBreath;     // TORSO scale-y offset
  uniform float uCloth;      // soft-cloth wind amplitude
  uniform float uSideView;   // 1 = side profile, 0 = front/back 3/4
  uniform float uTime;
  varying vec2 vUv;

  vec2 rot(vec2 p, vec2 pivot, float a) {
    vec2 d = p - pivot; float c = cos(a), s = sin(a);
    return pivot + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }

  void main() {
    vUv = uv;
    const float HEAD_H = ${RIG_METRICS.HEAD_H.toFixed(6)};
    // Work in true Euclidean world-metre space so shader rotations match Three.js bone groups 1:1
    vec2 m = vec2((uv.x - 0.5) * uSize.x, uv.y * uSize.y);
    float xH = m.x / HEAD_H;

    // 1. LEG_L / LEG_R: scissor step around exact hip pivots (±legX, HIP_Y * h)
    float legX = (uSideView > 0.5 ? ${RIG_METRICS.LEG_X_SIDE.toFixed(4)} : ${RIG_METRICS.LEG_X_FRONT.toFixed(4)}) * HEAD_H;
    float hipY = ${R.HIP_Y} * uSize.y;
    float legW = 1.0 - smoothstep(${R.HIP_Y - 0.06}, ${R.HIP_Y + 0.02}, uv.y);
    float sideL = 1.0 - smoothstep(-0.04, 0.04, xH);
    vec2 legL = rot(m, vec2(-legX, hipY), uLegL);
    vec2 legR = rot(m, vec2( legX, hipY), uLegR);
    vec2 legP = mix(legR, legL, sideL);
    float footLift = max(0.0, mix(uLegR, uLegL, sideL)) * 0.04 * uSize.y * clamp(1.0 - uv.y / ${R.HIP_Y}, 0.0, 1.0);
    legP.y += footLift;
    m = mix(m, legP, legW);

    // 2. Soft-cloth hem wave (dress / tunic / cape band)
    float hem = smoothstep(${R.HIP_Y - 0.08}, ${R.HIP_Y + 0.02}, uv.y) * (1.0 - smoothstep(${R.WAIST_Y}, ${R.WAIST_Y + 0.12}, uv.y));
    m.x += sin(uTime * 3.1 - uv.y * 9.0) * uCloth * hem * uSize.x;

    // 3. ARM_L / ARM_R: local rotation around exact shoulder pivots (±armX, SHOULDER_Y * h)
    //    Evaluated before TORSO so sleeves/hands inherit TORSO breath + sway identically to ARM_L_G / ARM_R_G.
    float armX = (uSideView > 0.5 ? ${RIG_METRICS.ARM_X_SIDE.toFixed(4)} : ${RIG_METRICS.ARM_X_FRONT.toFixed(4)}) * HEAD_H;
    float shoulderY = ${R.SHOULDER_Y} * uSize.y;
    float armBand = smoothstep(0.245, 0.275, uv.y) * (1.0 - smoothstep(${R.SHOULDER_Y - 0.02}, ${R.SHOULDER_Y + 0.03}, uv.y));
    float aL = armBand * (1.0 - smoothstep(-0.36, -0.28, xH));
    float aR = armBand * smoothstep(0.28, 0.36, xH);
    m = mix(m, rot(m, vec2(-armX, shoulderY), uArmL), aL);
    m = mix(m, rot(m, vec2( armX, shoulderY), uArmR), aR);

    // 4. HEAD: local counter-tilt around the neck pivot (0, NECK_Y * h) before TORSO sway
    float headW = smoothstep(${R.NECK_Y - 0.04}, ${R.NECK_Y + 0.05}, uv.y);
    m = mix(m, rot(m, vec2(0.0, ${R.NECK_Y} * uSize.y), uHead - uTorso * 0.6), headW);

    // 5. TORSO: breathing + sway above the waist (carries torso, arms, and head together)
    float waistY = ${R.WAIST_Y} * uSize.y;
    float torsoW = smoothstep(${R.WAIST_Y - 0.09}, ${R.WAIST_Y + 0.02}, uv.y);
    vec2 tp = m;
    tp.y = waistY + (tp.y - waistY) * (1.0 + uBreath);
    tp = rot(tp, vec2(0.0, waistY), uTorso);
    m = mix(m, tp, torsoW);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(m.x, m.y, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform vec2 uSize;
  uniform float uMirror;     // 1 = native, -1 = mirrored (flip in UV so geometry pivots stay put)
  uniform float uMaskHands;  // 0 = none, 2 = both hands, +1/-1 = single-hand weapon side
  uniform float uMaskFeet;   // 0 = none, 1 = short hem (replace boots), 2 = long gown (replace shoe tips)
  uniform float uSideView;   // 1 = side profile, 0 = front/back 3/4
  uniform vec3 uTint;
  uniform float uRim;        // warm ToS rim light strength
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(uMirror > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
    vec4 c = texture2D(map, uv);
    if (c.a < 0.06) discard;
    float xH = (vUv.x - 0.5) * uSize.x / 0.55357;
    float xN = uSideView > 0.5 ? xH : xH * uMirror;
    if (uMaskFeet > 1.5) {
      if (uSideView > 0.5) {
        vec2 ftS = vec2((xN - 0.02) / 0.24, (vUv.y - 0.024) / 0.044);
        if (dot(ftS, ftS) < 1.0) discard;
      } else {
        vec2 ftL = vec2((xN + 0.14) / 0.16, (vUv.y - 0.024) / 0.046);
        vec2 ftR = vec2((xN - 0.18) / 0.18, (vUv.y - 0.024) / 0.046);
        if (dot(ftL, ftL) < 1.0 || dot(ftR, ftR) < 1.0) discard;
      }
    } else if (uMaskFeet > 0.5) {
      bool inSole = vUv.y < 0.115 && (uSideView > 0.5 ? (xN > -0.30 && xN < 0.46) : abs(xH) < 0.51);
      bool inCuff = vUv.y < 0.172 && (uSideView > 0.5 ? (xN > -0.29 && xN < 0.35) : abs(xH) < 0.38);
      if (inSole || inCuff) discard;
    }
    float rim = smoothstep(0.55, 1.0, uv.y) * uRim;
    c.rgb = c.rgb * uTint + vec3(1.0, 0.82, 0.55) * rim * 0.12;
    gl_FragColor = c;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeBodyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uMirror: { value: 1 },
      uMaskHands: { value: 0 }, uMaskFeet: { value: 0 }, uSideView: { value: 0 },
      uTorso: { value: 0 }, uHead: { value: 0 }, uLegL: { value: 0 }, uLegR: { value: 0 },
      uArmL: { value: 0 }, uArmR: { value: 0 }, uBreath: { value: 0 }, uCloth: { value: 0.006 },
      uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uRim: { value: 0.6 },
    },
    vertexShader, fragmentShader, transparent: true, depthWrite: true, side: THREE.DoubleSide,
  });
}

const accVertShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const accFragShader = /* glsl */`
  uniform sampler2D map;
  uniform float uClipTopY;
  uniform float uClipBottomY;  // hair front copy: only the head region above the neck line is drawn
  uniform vec3 uTint;          // primary hair dye (or white for non-hair accessories)
  uniform vec3 uTint2;         // secondary hair dye for Ombre / Celestial gradient
  uniform vec3 uTint3;         // tertiary hair dye for Celestial Prismatic aurora wave
  uniform float uIsHair;       // 1 = hair wig (preserve coloured ornaments & apply shimmer/ombre)
  uniform float uShimmer;      // 0..1 sheen intensity (Royal = 0.25-0.30, Ombre = 0.35-0.40, Celestial = 1.0)
  uniform float uCelestialMode;// 0 = normal/ombre, 1 = Astral Nebula, 2 = Solar-Lunar Sovereign
  uniform float uTime;
  uniform vec4 uHairBox;       // (ox, oy, wH * uvSign, hH) in HEAD_H units for the front hair copy
  uniform float uFrontViewMode;// 0 = behind/back, 1 = front-3/4 front copy, 2 = side-profile front copy
  varying vec2 vUv;
  void main() {
    if (vUv.y < uClipBottomY) discard;
    vec4 c = texture2D(map, vUv);
    c.a *= smoothstep(uClipBottomY, uClipBottomY + 0.04, vUv.y);
    float xFacing = uHairBox.x + (vUv.x - 0.5) * uHairBox.z;
    float yHead = uHairBox.y + (vUv.y - 0.5) * uHairBox.w;
    if (uFrontViewMode > 0.5 && uFrontViewMode < 1.5) {
      if (yHead < 0.08 && xFacing >= -0.01 && xFacing <= 0.22) discard;
    }
    if (uClipTopY < -2.5) {
      // Full hood clip (hairCover: 'hood'): clips the upper crown (yHead > 0.78) and wide lateral hair/buns
      // outside the hood arch while keeping forehead bangs inside the hood window and lower hair tips below the collar!
      if (uClipTopY < -3.75) {
        // Side profile hood: keep front bangs on the right (xFacing > 0.05, yHead < 0.94) and lower hair tips (yHead < 0.16)
        float inSideHood = smoothstep(0.14, 0.22, yHead) * (1.0 - smoothstep(0.02, 0.10, xFacing) * (1.0 - smoothstep(0.90, 0.96, yHead)));
        c.a *= 1.0 - inSideHood;
      } else if (uClipTopY < -3.25) {
        // Back view hood: clip upper head hair covered by the back hood dome (yHead > 0.20), keep lower hair tips
        c.a *= smoothstep(0.24, 0.18, yHead);
      } else {
        // Front 3/4 hood: keep forehead bangs inside the hood opening (abs(xFacing - 0.04) < 0.44, yHead < 0.78) and lower hair tips
        float topMask = smoothstep(0.75, 0.81, yHead);
        float sideBuns = smoothstep(0.44, 0.52, yHead) * smoothstep(0.44, 0.50, abs(xFacing - 0.04));
        c.a *= (1.0 - topMask) * (1.0 - sideBuns);
      }
    } else if (uClipTopY < -0.5) {
      // Open-crown winged helm / diadem clip (hairCover: 'helm'): keeps the entire rounded skull dome
      // and spiky/fluffy hair tips (yHead <= 1.32), forehead bangs, side buns, and ponytails 100% intact.
      float inCrownX = uClipTopY < -1.5
        ? smoothstep(-0.28, -0.18, xFacing) * (1.0 - smoothstep(0.16, 0.24, xFacing))
        : 1.0 - smoothstep(0.30, 0.38, abs(xFacing - 0.01));
      float topOrnClip = inCrownX * smoothstep(1.32, 1.38, yHead);
      c.a *= 1.0 - topOrnClip;
    } else if (uClipTopY < 1.5) {
      // Full-crown hat / beret clip in physical HEAD_H coordinates: clips central upper-crown peaks
      // above the skull dome (yHead > 1.14) so all forehead bangs, parted hairlines, and side tails stay uncut.
      float inHatX = (uClipTopY > 0.6 && uClipTopY < 0.9)
        ? smoothstep(-0.38, -0.28, xFacing) * (1.0 - smoothstep(0.18, 0.26, xFacing))
        : 1.0 - smoothstep(0.32, 0.40, abs(xFacing - 0.01));
      float hatClipY = 1.14;
      float topClip = inHatX * smoothstep(hatClipY - 0.03, hatClipY + 0.03, yHead);
      c.a *= 1.0 - topClip;
    }
    if (c.a < 0.06) discard;
    if (uIsHair > 0.5) {
      float maxC = max(c.r, max(c.g, c.b));
      float ornamentMask = 0.0;
      if (uIsHair > 1.5) {
        // Royal hairstyles: evaluate in perceptual sRGB space and exclude warm taupe hair strands so only
        // vivid ornaments (ribbons, sakura blossoms, gold stars, blue feathers, butterflies) are preserved.
        vec3 s = sqrt(max(c.rgb, vec3(0.0)));
        float sMax = max(s.r, max(s.g, s.b));
        float sMin = min(s.r, min(s.g, s.b));
        float sSat = sMax > 0.01 ? (sMax - sMin) / sMax : 0.0;
        float taupeRatio = (s.g - s.b) / max(s.r - s.b, 0.001);
        float isTaupe = step(s.g - 0.015, s.r) * step(s.b - 0.015, s.g) * (1.0 - smoothstep(0.24, 0.31, sSat))
                      * smoothstep(0.30, 0.37, taupeRatio) * (1.0 - smoothstep(0.59, 0.66, taupeRatio));
        ornamentMask = smoothstep(0.18, 0.28, sSat) * smoothstep(0.25, 0.38, sMax) * (1.0 - isTaupe);
      }
      float dyeMask = 1.0 - ornamentMask;
      vec3 dye = mix(uTint2, uTint, smoothstep(0.14, 0.82, vUv.y));
      vec3 dyed = c.rgb * dye;
      if (uCelestialMode > 0.5) {
        // Celestial hairs have rich multi-hue cosmic gradients painted directly into the art:
        // preserve their vivid native colours and layer an animated iridescent aurora wave + starlight sparkles on top!
        float wave = 0.5 + 0.5 * sin(vUv.y * 5.2 - uTime * 1.8 + vUv.x * 2.4);
        float wave2 = 0.5 + 0.5 * cos(vUv.y * 3.8 + uTime * 1.3 - vUv.x * 3.1);
        vec3 pris = mix(mix(uTint, uTint2, wave), uTint3, wave2 * 0.55);
        dyed = mix(c.rgb, c.rgb * (0.72 + 0.42 * pris), 0.65);
      }
      if (uShimmer > 0.01) {
        // Flowing angel-halo sheen + twinkling starlight micro-glints on hair highlights
        float highlight = smoothstep(0.45, 0.88, maxC);
        float band = pow(max(0.0, sin((vUv.y * 3.6 + vUv.x * 1.8) - uTime * 2.2)), 6.0);
        vec3 sheenCol = uCelestialMode > 1.5 ? vec3(1.0, 0.94, 0.78) : vec3(0.88, 0.94, 1.0);
        dyed += sheenCol * band * highlight * uShimmer * 0.28;
        if (uCelestialMode > 0.5) {
          // Twinkling constellation micro-sparkles embedded in the flowing strands
          float sp1 = sin(vUv.x * 58.0 + uTime * 3.4) * sin(vUv.y * 64.0 - uTime * 2.7);
          float sp2 = sin(vUv.x * 83.0 - uTime * 4.1) * sin(vUv.y * 79.0 + uTime * 3.1);
          float twinkle = pow(max(0.0, sp1 * sp2), 5.0) * smoothstep(0.32, 0.75, maxC);
          float tipGlow = (1.0 - smoothstep(0.12, 0.48, vUv.y)) * smoothstep(0.28, 0.75, maxC);
          dyed += vec3(1.0, 0.97, 0.88) * twinkle * 0.95 + uTint3 * tipGlow * 0.20;
        }
      }
      c.rgb = uCelestialMode > 0.5 ? dyed : mix(c.rgb, dyed, dyeMask);
    } else {
      c.rgb *= uTint;
    }
    gl_FragColor = c;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeAccMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      uClipTopY: { value: 2.0 },
      uClipBottomY: { value: -1.0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uTint2: { value: new THREE.Color(1, 1, 1) },
      uTint3: { value: new THREE.Color(1, 1, 1) },
      uIsHair: { value: 0 },
      uShimmer: { value: 0 },
      uCelestialMode: { value: 0 },
      uTime: { value: 0 },
      uHairBox: { value: new THREE.Vector4(0, 0.5, 1.4, 1.4) },
      uFrontViewMode: { value: 0 },
    },
    vertexShader: accVertShader,
    fragmentShader: accFragShader,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

let shadowTex = null;
export function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(40,24,10,0.55)'); grd.addColorStop(1, 'rgba(40,24,10,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.userData = { shared: true };
  return shadowTex;
}

export function makeNameTag(text, sub = '', { celestial = false } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const label = celestial && text && !text.startsWith('✨') ? `✨ ${text} ✨` : text;
  g.font = '800 46px "Trebuchet MS", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = celestial ? 'rgba(62,32,6,0.92)' : 'rgba(43,28,16,0.85)'; g.lineJoin = 'round';
  if (celestial) {
    g.shadowColor = 'rgba(255,215,100,0.85)';
    g.shadowBlur = 14;
  }
  g.strokeText(label, 256, 52);
  if (celestial) {
    const grd = g.createLinearGradient(96, 26, 416, 78);
    grd.addColorStop(0, '#fff7d6');
    grd.addColorStop(0.5, '#ffd86b');
    grd.addColorStop(1, '#f59e0b');
    g.fillStyle = grd;
  } else {
    g.fillStyle = '#fff6e3';
  }
  g.fillText(label, 256, 52);
  g.shadowBlur = 0;
  if (sub) {
    g.font = '700 30px "Trebuchet MS", system-ui, sans-serif';
    g.strokeText(sub, 256, 100); g.fillStyle = celestial ? '#fff0a8' : '#ffe08a'; g.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  spr.scale.set(2.2, 0.55, 1);
  spr.renderOrder = 10;
  return spr;
}

const WINGS_FOR = { bkk: 'wings_golden_seraphim', dxb: 'wings_pastel_angel', boy: null, girl: null };

// Step 3 paper-doll layers (Section 22.F). Offsets / scales are in head-heights (2.8-head chibi).
export const HEAD_H = CHIBI_HEIGHT / 2.8;
export const ACC_SLOTS = ['hat', 'face', 'gloves', 'boots'];
// Painter's Z stack (Section 3.D.3) relative to the body plane: L3 boots, L5/L9 gloves, L7 hat/helm, L8 face (glasses/masks sit on top of helm temple guards).
const ACC_Z = {
  front: { boots: 0.01, gloves: 0.068, hat: 0.08, face: 0.10 },
  side: { boots: 0.01, gloves: 0.068, hat: 0.08, face: 0.10 },
  back: { boots: 0.01, gloves: 0.068, hat: 0.08, face: 0.08 },
};
const ACC_ORDER = { boots: 1, gloves: 2.75, hat: 3, face: 4 };

export class ChibiRig {
  /**
   * @param {object} o { lineage, appearance, hair, hairColor, name, sub, wings: itemId|null|undefined }
   */
  constructor(o = {}) {
    // v2 bodies ('boy' | 'girl', Section 23) or legacy lineages ('bkk' | 'dxb'): the value is the sprite prefix
    const rawLin = o.appearance?.body || o.lineage;
    this.lineage = ['bkk', 'dxb', 'boy', 'girl'].includes(rawLin) ? rawLin : 'bkk';
    this.facing = new FacingState(CHIBI_FACING);
    this.shownView = 'front';
    this.shownRight = true;
    this.onTurn = null;          // (fromBack, toBack) => void — world hooks dust puffs here
    this.t = Math.random() * 10;
    this.legPhase = 0;
    this.walkWeight = 0;

    // --- bone hierarchy -------------------------------------------------------
    this.ROOT = new THREE.Group();                 // ground point, world position
    this.billboard = new THREE.Group();            // faces the camera (yaw) and leans back
    this.HIP = new THREE.Group();                  // hop / squash
    this.ROOT.add(this.billboard);
    this.billboard.add(this.HIP);
    this.bones = { ROOT: this.ROOT, HIP: this.HIP, TORSO: 'shader:uTorso', HEAD: 'shader:uHead', ARM_L: 'shader:uArmL', ARM_R: 'shader:uArmR', LEG_L: 'shader:uLegL', LEG_R: 'shader:uLegR' };

    this.material = makeBodyMaterial();
    this.body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 12, 16).translate(0, 0.5, 0), this.material);
    this.body.frustumCulled = false; // vertex shader resizes the unit plane
    this.body.renderOrder = 2;       // above mounted pet (1) and saddle (1.5), below accessories (2.5+)
    this.HIP.add(this.body);

    // WINGS_L / WINGS_R (shoulder-blade pivots); z flips in front of the body when facing back
    this.WINGS = new THREE.Group();
    this.HIP.add(this.WINGS);
    this.wingMeshes = [];

    // Paper-doll bone groups: mirror the vertex-shader pivots so accessories follow the deformation.
    this.TORSO_G = new THREE.Group();
    this.HEAD_G = new THREE.Group();
    this.ARM_L_G = new THREE.Group();
    this.ARM_R_G = new THREE.Group();
    this.LEG_L_G = new THREE.Group();
    this.LEG_R_G = new THREE.Group();
    this.HIP.add(this.TORSO_G, this.LEG_L_G, this.LEG_R_G);
    this.TORSO_G.add(this.HEAD_G, this.ARM_L_G, this.ARM_R_G);
    this.accMeshes = [];          // { mesh, slot, side, def }
    this.hairMeshes = [];         // [behind, front] copies of one wig sprite set (Section 23)
    this.hair = null;
    this.tail = null;             // Back-slot item with socket 'hip' (wolf / dragon tail)
    this.heldTool = null;         // Held gathering tool { kind, tier, mesh, def, texture }
    this._heldToolDef = null;
    this.equipKey = '';
    this.outfitId = null;

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.position.y = 0.012;
    this.shadow.scale.set(0.95, 1, 0.5);
    this.shadow.renderOrder = -1;
    this.ROOT.add(this.shadow);

    this.nameText = o.name || '';
    this.subText = o.sub || '';
    this.celestialTag = false;
    this.nameTag = makeNameTag(this.nameText, this.subText, { celestial: false });
    this.nameTag.position.y = CHIBI_HEIGHT + 0.56;
    this.billboard.add(this.nameTag);

    const isGirl = this.lineage === 'girl' || this.lineage === 'dxb';
    if (o.hair !== null) {
      const defHair = o.appearance?.hair || o.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
      const defColor = o.appearance?.hairColor || o.hairColor || (o.lineage === 'dxb' ? 'coral' : o.lineage === 'bkk' ? 'silver' : 'chestnut');
      this.pendingHair = { id: defHair, color: defColor };
    }

    this.ready = this.load(o.wings === undefined ? WINGS_FOR[this.lineage] : o.wings);
  }

  updateNameTag({ name = this.nameText, sub = this.subText, celestial = this.celestialTag } = {}) {
    if (name === this.nameText && sub === this.subText && celestial === this.celestialTag) return;
    this.nameText = name;
    this.subText = sub;
    this.celestialTag = celestial;
    if (!this.nameText && !this.subText) return;
    const wasVisible = this.nameTag ? this.nameTag.visible : true;
    if (this.nameTag) {
      this.billboard.remove(this.nameTag);
      this.nameTag.material?.map?.dispose?.();
      this.nameTag.material?.dispose?.();
    }
    this.nameTag = makeNameTag(this.nameText, this.subText, { celestial: this.celestialTag });
    this.nameTag.position.y = CHIBI_HEIGHT + 0.56;
    this.nameTag.visible = wasVisible;
    this.billboard.add(this.nameTag);
  }

  async setAppearance(appearance = {}) {
    if (!appearance) return;
    const nextBody = appearance.body === 'girl' || appearance.body === 'dxb' ? 'girl' : appearance.body === 'boy' || appearance.body === 'bkk' ? 'boy' : null;
    const curIsGirl = this.lineage === 'girl' || this.lineage === 'dxb';
    const nextIsGirl = nextBody ? nextBody === 'girl' : curIsGirl;
    if (nextBody && nextIsGirl !== curIsGirl) {
      this.lineage = nextBody;
      const [front, back, side, lifted] = await Promise.all([
        loadSprite(`${this.lineage}_base_front`), loadSprite(`${this.lineage}_base_back`), loadSprite(`${this.lineage}_base_side`),
        loadSprite(`${this.lineage}_base_lifted`),
      ]);
      this.ppm = CHIBI_HEIGHT / front.h;
      const view = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: s.hem || 'short', headDiam: s.headDiam, headCX: s.headCX, headTop: s.headTop, eyeX: s.eyeX, eyeY: s.eyeY, eyeSpan: s.eyeSpan });
      this.views = { front: view(front, this.ppm), back: view(back, this.ppm) };
      if (!side.fallback) this.views.side = view(side, (CHIBI_HEIGHT * 0.98) / side.h);
      if (!lifted.fallback) this.views.lifted = view(lifted, (CHIBI_HEIGHT * 1.12) / lifted.h);
      this.baseViews = { ...this.views };
      if (this.outfitId) await this.setOutfit(this.outfitId);
    }
    const hairId = appearance.hair || (nextIsGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
    const colorId = appearance.hairColor || 'chestnut';
    await this.setHair(hairId, colorId);
  }

  async load(wingsId) {
    const [front, back, side, lifted] = await Promise.all([
      loadSprite(`${this.lineage}_base_front`), loadSprite(`${this.lineage}_base_back`), loadSprite(`${this.lineage}_base_side`),
      loadSprite(`${this.lineage}_base_lifted`),
    ]);
    this.ppm = CHIBI_HEIGHT / front.h;           // front/back come from one sheet -> shared pixel scale
    const view = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: s.hem || 'short', headDiam: s.headDiam, headCX: s.headCX, headTop: s.headTop, eyeX: s.eyeX, eyeY: s.eyeY, eyeSpan: s.eyeSpan });
    this.views = { front: view(front, this.ppm), back: view(back, this.ppm) };
    // side art lives on a different sheet: normalise it to the same standing height
    if (!side.fallback) this.views.side = view(side, (CHIBI_HEIGHT * 0.98) / side.h);
    // Finger Pick-Up (Screen 03): dangling >o< pose, a touch taller because the legs hang down
    if (!lifted.fallback) this.views.lifted = view(lifted, (CHIBI_HEIGHT * 1.12) / lifted.h);
    this.baseViews = { ...this.views };
    this.applyView(this.shownView, this.shownRight);
    if (wingsId) await this.setWings(wingsId);
    if (this.pendingHair) { const h = this.pendingHair; this.pendingHair = null; await this.setHair(h.id, h.color); }
    if (this.pendingEquip) { const eq = this.pendingEquip; this.pendingEquip = null; await this.setEquipment(eq); }
  }

  // ------------------------------------------------------------------ Step 3: 6-slot paper doll
  /**
   * Apply profile.equipped ({ outfit, hat, face, gloves, boots, wings: {id, refine, hide?} }).
   * Cheap to call on every profile push: only reloads when something visible changed.
   */
  async setEquipment(eq) {
    if (!eq) return;
    const vis = (s) => visibleSlotId(eq, s);   // 👁️ hide + costume signature parts (headgear / face cover / tail)
    const charmSig = eq.charm ? `${eq.charm.id || eq.charm}:${eq.charm.grade || 'B'}:${eq.charm.level || 1}:${eq.charm.hide ? 1 : 0}` : null;
    const key = JSON.stringify([...['outfit', ...ACC_SLOTS, 'wings'].map(vis), charmSig]);
    if (key === this.equipKey) {
      if (this.equipPromise) await this.equipPromise;
      return;
    }
    if (!this.views) { this.pendingEquip = eq; return; }
    this.equipKey = key;
    const nextCharm = eq.charm && !eq.charm.hide ? eq.charm : null;
    const charmChanged = (this.charm?.id || null) !== (nextCharm?.id || null);
    this.charm = nextCharm;
    this.equipPromise = (async () => {
      await this.setOutfit(vis('outfit'));
      await this.setWings(vis('wings'));
      await this.setAccessories(Object.fromEntries(ACC_SLOTS.map((s) => [s, vis(s)])));
      try { WearAura.sync(this, this.outfitId, { suitUp: charmChanged && !!this._outfitApplied, charm: this.charm }); } catch (e) { /* cosmetic */ }
    })();
    await this.equipPromise;
  }

  /** Live-equip or preview a Starlight Aura Charm on this ChibiRig. */
  setCharm(charmObj, { suitUp = true } = {}) {
    this.charm = charmObj && !charmObj.hide ? charmObj : null;
    try { WearAura.sync(this, this.outfitId, { suitUp, charm: this.charm }); } catch (e) { /* cosmetic */ }
  }

  /** Full-body Mythic costume art per lineage (`<lineage>_<outfitId>_front|back|side`); falls back to mapped silhouette or base body. */
  async setOutfit(id) {
    this.outfitId = id;
    // `lowerBody: 'tail'` (naga / mermaid): no leg scissor, the body glides with a gentle slither sway instead
    this.tailBody = OUTFITS[id]?.lowerBody === 'tail';
    const views = { ...this.baseViews };
    let tint = [1, 1, 1];
    if (id && id !== 'newbie_outfit') {
      const fb = OUTFIT_FALLBACK[id];
      let [front, back, side] = await Promise.all(['front', 'back', 'side'].map((v) => loadSprite(`${this.lineage}_${id}_${v}`)));
      if (front.fallback && fb) {
        tint = fb.tint || [1, 1, 1];
        if (fb.base && fb.base !== 'base') {
          [front, back, side] = await Promise.all(['front', 'back', 'side'].map((v) => loadSprite(`${this.lineage}_${fb.base}_${v}`)));
        }
      }
      if (!front.fallback) {
        const mk = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: outfitHem(id, s.hem), headDiam: s.headDiam, headCX: s.headCX, headTop: s.headTop, eyeX: s.eyeX, eyeY: s.eyeY, eyeSpan: s.eyeSpan });
        const ppm = CHIBI_HEIGHT / front.h;
        views.front = mk(front, ppm);
        if (!back.fallback) views.back = mk(back, (CHIBI_HEIGHT * back.h / front.h) / back.h);
        if (!side.fallback) views.side = mk(side, (CHIBI_HEIGHT * 0.98) / side.h);
      }
    }
    if (this.outfitId !== id) return;          // a newer call won
    this.material.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
    this.views = views;
    this.applyView(this.shownView, this.shownRight);
    // ✦ Super Mythic & Starlight Charm wear aura (client/js/wear_aura.js): suit-up only on an in-session equip change
    try { WearAura.sync(this, id, { suitUp: !!this._outfitApplied, charm: this.charm }); } catch (e) { /* cosmetic only */ }
    this._outfitApplied = true;
  }

  /** Hat / face on HEAD, gloves on ARM_L + ARM_R, boots on LEG_L + LEG_R. */
  async setAccessories(bySlot) {
    for (const a of this.accMeshes) { a.mesh.parent?.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose(); }
    this.accMeshes = [];
    const token = (this.accToken = (this.accToken || 0) + 1);
    const built = [];
    for (const slot of ACC_SLOTS) {
      const id = bySlot[slot];
      const def = getAttachDef(id, slot);
      if (!def) continue;
      const names = [...new Set(Object.values(def.views).filter(Boolean))];
      const sprites = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadSprite(n)])));
      if (Object.values(sprites).every((s) => s.fallback)) continue;   // no art yet: show nothing rather than a placeholder doll
      const sides = def.bone === 'ARM' || def.bone === 'LEG' ? [-1, 1] : [0];
      for (const side of sides) {
        const mat = makeAccMaterial();
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        mesh.renderOrder = def.singleHand ? 6 : 2 + ACC_ORDER[slot];
        built.push({ mesh, slot, side, def, sprites, itemId: id });
      }
    }
    if (token !== this.accToken) { for (const a of built) { a.mesh.geometry.dispose(); a.mesh.material.dispose(); } return; }
    for (const a of built) {
      const g = a.def.bone === 'HEAD' ? this.HEAD_G : a.def.bone === 'ARM' ? (a.side < 0 ? this.ARM_L_G : this.ARM_R_G) : (a.side < 0 ? this.LEG_L_G : this.LEG_R_G);
      g.add(a.mesh);
      this.accMeshes.push(a);
    }
    this.applyView(this.shownView, this.shownRight);
  }

  /** Dress-up calibration (dev): live-edit one item's attach data without reloading. */
  setAttachOverride(itemId, def) {
    for (const a of this.accMeshes) if (a.itemId === itemId) a.def = def;
    this.applyView(this.shownView, this.shownRight);
  }

  /**
   * Bone pivots anchored in HEAD_H (CHIBI_HEIGHT / 2.8) rather than size.x so wide
   * dresses, capes, and tails never shift hand or foot positions on either lineage.
   */
  layoutBones(size, view = this.shownView) {
    const h = size.y;
    const sideView = view === 'side';
    const armX = (sideView ? RIG_METRICS.ARM_X_SIDE : RIG_METRICS.ARM_X_FRONT) * HEAD_H;
    const legX = (sideView ? RIG_METRICS.LEG_X_SIDE : RIG_METRICS.LEG_X_FRONT) * HEAD_H;
    this.TORSO_G.position.set(0, R.WAIST_Y * h, 0);
    this.HEAD_G.position.set(0, (R.NECK_Y - R.WAIST_Y) * h, 0);
    this.ARM_L_G.position.set(-armX, (R.SHOULDER_Y - R.WAIST_Y) * h, 0);
    this.ARM_R_G.position.set(armX, (R.SHOULDER_Y - R.WAIST_Y) * h, 0);
    this.LEG_L_G.position.set(-legX, R.HIP_Y * h, 0);
    this.LEG_R_G.position.set(legX, R.HIP_Y * h, 0);
  }

  /** Per-view sprite, size, offset, mirror and Z for every accessory mesh. */
  layoutAccessories(view, right, bodyHem = 'short') {
    const v = view === 'lifted' ? 'front' : view;
    const flip = right ? 1 : -1;               // accessory art is normalized to face screen-right
    const longHem = bodyHem === 'short' ? false : bodyHem === 'long';
    const bodyMeta = this.views?.[v] || this.views?.front || null;
    let maskHands = 0;
    let maskFeet = 0;
    for (const a of this.accMeshes) {
      const name = a.def.views[v];
      const s = name && a.sprites[name];
      const isBoot = a.def.bone === 'LEG';
      // side view (arms only) or single-hand held weapon: only the leading arm is visible; stow weapons during couple poses or while riding a mount
      const stowWeapon = !!((this.couplePose || this.riding) && a.def.singleHand);
      const hiddenSide = ((v === 'side' && !isBoot) || a.def.singleHand) && a.side !== 0 && a.side !== flip;
      if (!s || s.fallback || hiddenSide || stowWeapon) { a.mesh.visible = false; continue; }
      a.mesh.visible = true;
      const u = a.mesh.material.uniforms;
      if (u.map.value !== s.texture) u.map.value = s.texture;
      u.uClipTopY.value = isBoot && longHem ? 0.56 : 2.0;
      if (a.def.bone === 'ARM') maskHands = a.def.singleHand ? flip : 2;
      if (isBoot) maskFeet = longHem ? 2 : 1;
      // headwear sits on the hair volume: hats are calibrated on the reference wig, other wigs declare `hatFit`
      const spriteAspect = s.h / s.w;
      const { effScale, ox, effOy, rotZ = 0 } = resolveAccessoryLayout({
        def: a.def,
        slot: a.slot,
        view: v,
        spriteAspect,
        hairId: this.hair?.id || null,
        longHem,
        bodyMeta,
      });
      const wM = effScale * HEAD_H, hM = wM * spriteAspect;
      // Boots always point in the walking direction (flip); two-handed gloves mirror left (-1) vs right (+1), and thumb-forward (-flip) in side profile
      const isGlove = a.def.bone === 'ARM' && !a.def.singleHand;
      const scaleSign = isBoot || a.def.singleHand ? flip : isGlove && v === 'side' ? -flip : v === 'side' || a.side === 0 ? flip : a.side;
      const posSign = isBoot || a.def.singleHand || v === 'side' || a.side === 0 ? flip : a.side;
      // In 3/4 and side views, the leading foot sits slightly lower and in front of the trailing foot
      const stepY = isBoot ? (a.side === flip ? -0.008 : 0.008) : 0;
      const stepZ = isBoot && a.side === flip ? 0.004 : (a.def.singleHand && v === 'back' ? 0.062 : 0);
      const armTilt = isGlove && v !== 'side' ? -a.side * 0.14 : rotZ * scaleSign;
      a.mesh.rotation.z = armTilt;
      a.mesh.scale.set(wM * scaleSign, hM, 1);
      a.mesh.position.set(ox * HEAD_H * posSign, (effOy + stepY) * HEAD_H, ACC_Z[v][a.slot] + stepZ);
    }
    this.material.uniforms.uMaskHands.value = view === 'lifted' ? 0 : maskHands;
    this.material.uniforms.uMaskFeet.value = view === 'lifted' ? 0 : maskFeet;
    this.material.uniforms.uSideView.value = view === 'side' ? 1 : 0;
  }

  /** Finger Pick-Up & Drop: dangle at `height` metres above the ground (0 = put down). */
  setLifted(on, height = 0.9) {
    this.lifted = on;
    this.liftHeight = on ? height : 0;
    this.applyView(on && this.views?.lifted ? 'lifted' : this.facing.shown(this.hasSide).view, this.shownRight);
  }

  get hasSide() { return !!this.views?.side; }

  /**
   * Hair module (Section 23): one light-grey wig sprite per view, tinted by `color`.
   * Front/side: a full copy BEHIND the body + a copy IN FRONT clipped to the head (above the neck line), so bangs
   * cover the forehead while long strands fall behind the shoulders. Back view: one full copy in front of the body.
   */
  async setHair(id, color = '#8a5a3c') {
    if (!this.views) { this.pendingHair = { id, color }; return; }
    const resolved = id ? resolveHairColor(color, id) : null;
    if (id && this.hair?.id === id && this.hair?.color === resolved.id) return;
    for (const m of this.hairMeshes) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.hairMeshes = [];
    this.hair = null;
    if (!id) {
      this.updateNameTag({ celestial: false });
      this.applyView(this.shownView, this.shownRight);
      return;
    }
    const token = (this.hairToken = (this.hairToken || 0) + 1);
    const sprites = Object.fromEntries(await Promise.all(['front', 'side', 'back'].map(async (v) => [v, await loadSprite(hairSpriteName(id, v))])));
    if (token !== this.hairToken) return;
    if (sprites.front.fallback) { this.applyView(this.shownView, this.shownRight); return; }
    const tint = new THREE.Color(resolved.hex);
    const tint2 = new THREE.Color(resolved.hex2);
    const tint3 = new THREE.Color(resolved.hex3);
    for (const layer of ['behind', 'front']) {
      const mat = makeAccMaterial();
      mat.uniforms.uIsHair.value = HAIRSTYLES[id]?.tier === 'royal' ? 2 : 1;
      mat.uniforms.uTint.value.copy(tint);
      mat.uniforms.uTint2.value.copy(tint2);
      mat.uniforms.uTint3.value.copy(tint3);
      mat.uniforms.uShimmer.value = resolved.shimmer;
      mat.uniforms.uCelestialMode.value = resolved.celestialMode;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.userData.layer = layer;
      mesh.renderOrder = layer === 'front' ? 2 + ACC_ORDER.hat - 0.5 : 1.8;   // front copy sits under hats/helms; behind copy sits behind body (2) & above pet/saddle (1.5)
      this.HEAD_G.add(mesh);
      this.hairMeshes.push(mesh);
    }
    this.hair = { id, color: resolved.id, sprites, def: hairAttach(id) };
    this.updateNameTag({ celestial: HAIRSTYLES[id]?.tier === 'celestial' });
    this.applyView(this.shownView, this.shownRight);
  }

  /** Dress-up calibration (dev): live-edit the hair attach data. */
  setHairOverride(def) { if (this.hair) { this.hair.def = def; this.applyView(this.shownView, this.shownRight); } }

  layoutHair(view, right) {
    if (!this.hair) return;
    const v = view === 'lifted' ? 'front' : view;
    const s = this.hair.sprites[v]?.fallback ? this.hair.sprites.front : this.hair.sprites[v];
    const hFlip = right === (s.faces !== 'left') ? 1 : -1;  // mirror only when the wig art faces the other way
    const dirSign = v === 'back' ? 1 : (right ? 1 : -1);    // character facing direction for ox offset
    const def = this.hair.def;
    const bodyMeta = this.views?.[v] || this.views?.front || null;
    const isBase = !this.outfitId || this.outfitId === 'newbie_outfit';
    const { wH, hH, ox, oy } = resolveHairLayout({
      def,
      view: v,
      spriteAspect: s.h / s.w,
      bodyMeta,
      isBase,
    });
    const sizeScale = (bodyMeta?.size?.y || CHIBI_HEIGHT) / CHIBI_HEIGHT;
    const effHeadH = HEAD_H * sizeScale;
    const wM = wH * effHeadH, hM = hH * effHeadH;
    const uvSign = s.faces === 'left' ? -1 : 1;
    // neck line in the wig's own UV: yHead = -0.04 below the HEAD pivot (y = 0)
    const neckV = Math.min(1, Math.max(0, 0.5 + (-0.04 - oy) / hH));
    const activeHatCover = this.accMeshes.find((a) => a.slot === 'hat' && a.mesh.visible && a.def?.hairCover)?.def?.hairCover;
    const topClipV = activeHatCover === 'top' ? (v === 'back' ? 0.25 : v === 'side' ? 0.75 : 1.0) : activeHatCover === 'helm' ? (v === 'side' ? -2.0 : -1.0) : activeHatCover === 'hood' ? (v === 'side' ? -4.0 : v === 'back' ? -3.5 : -3.0) : 2.0;
    for (const m of this.hairMeshes) {
      const front = m.userData.layer === 'front';
      const u = m.material.uniforms;
      if (u.map.value !== s.texture) u.map.value = s.texture;
      u.uHairBox.value.set(ox, oy, wH * uvSign, hH);
      u.uClipTopY.value = topClipV;
      if (v === 'back') {
        m.visible = front;                 // back of the head: one full copy over the body
        u.uClipBottomY.value = -1;
        u.uFrontViewMode.value = 0;
      } else {
        m.visible = true;
        u.uClipBottomY.value = front && v !== 'side' ? neckV : -1;
        u.uFrontViewMode.value = front ? (v === 'side' ? 2 : 1) : 0;
      }
      m.scale.set(wM * hFlip, hM, 1);
      m.position.set(ox * effHeadH * dirSign, oy * effHeadH, front ? ACC_Z[v].hat - 0.02 : -0.05);
    }
  }

  async setWings(id) {
    for (const m of this.wingMeshes) {
      this.WINGS.remove(m);
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    }
    this.wingMeshes = [];
    if (this.tail) { this.tail.pivot.parent?.remove(this.tail.pivot); this.tail.mesh.geometry.dispose(); this.tail.mesh.material.dispose(); this.tail = null; }
    if (!id) return;
    const tailDef = getAttachDef(id, 'wings');
    if (tailDef?.socket === 'hip' || tailDef?.socket === 'shoulders') {
      // Back slot, hip or shoulders socket (Section 23): tails/capes hang behind the body (in front of it when facing away)
      // and sway around their ROOT. Each view may have its own art (side/back fall back to the front drawing).
      const names = { front: tailDef.views?.front || id, side: tailDef.views?.side || tailDef.views?.front || id, back: tailDef.views?.back || tailDef.views?.front || id };
      const loaded = Object.fromEntries(await Promise.all([...new Set(Object.values(names))].map(async (n) => [n, await loadSprite(n)])));
      if (loaded[names.front].fallback) return;
      const sprites = Object.fromEntries(Object.entries(names).map(([v, n]) => [v, loaded[n].fallback ? loaded[names.front] : loaded[n]]));
      const mat = makeAccMaterial();
      mat.uniforms.map.value = sprites.front.texture;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      const pivot = new THREE.Group();
      pivot.add(mesh);
      const parentGroup = tailDef.socket === 'shoulders' ? this.TORSO_G : this.HIP;
      parentGroup.add(pivot);
      this.tail = { mesh, pivot, def: tailDef, sprites, itemId: id, socket: tailDef.socket };
      this.applyView(this.shownView, this.shownRight);
      return;
    }
    const s = await loadSprite(id);
    const { w, h } = resolveWingDimensions(id, s.w, s.h, this.ppm);
    for (const side of [-1, 1]) {
      // each half pivots at the wing root (centre of the sprite)
      const geo = new THREE.PlaneGeometry(w / 2, h);
      geo.translate(side * w / 4, 0, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
      const mat = new THREE.MeshBasicMaterial({ map: s.texture, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide, depthWrite: true });
      const m = new THREE.Mesh(geo, mat);
      m.userData.side = side;
      this.WINGS.add(m);
      this.wingMeshes.push(m);
    }
    this.applyView(this.shownView, this.shownRight); // restores the wing Z-order and height
  }

  applyView(view, right) {
    this.shownView = view; this.shownRight = right;
    if (!this.views) return;
    const v = this.views[view] || this.views.front;
    this.material.uniforms.map.value = v.tex;
    this.material.uniforms.uSize.value.copy(v.size);
    // mirror only when the drawing's native facing differs from where we want to look
    this.material.uniforms.uMirror.value = right === v.nativeRight ? 1 : -1;
    // Z-order inversion (Section 3.D, L1/L2): wings behind the body on Front-3/4 and Side,
    // in front of the back on Back-3/4. In profile the wings fold to one narrow silhouette.
    const back = view === 'back';
    this.WINGS.position.z = back ? 0.12 : -0.08;
    this.WINGS.position.y = CHIBI_HEIGHT * (back ? RIG_METRICS.WING_Y_BACK : RIG_METRICS.WING_Y_FRONT);
    this.WINGS.position.x = view === 'side' ? (right ? -0.12 : 0.12) : 0;
    this.WINGS.scale.x = view === 'side' ? 0.55 : 1;
    this.layoutBones(v.size, view);
    this.layoutAccessories(view, right, v.hem);
    this.layoutHair(view, right);
    this.layoutTail(view, right);
    this.layoutHeldTool(view, right);
  }

  layoutTail(view, right) {
    if (!this.tail) return;
    const v = view === 'lifted' ? 'front' : view;
    const { mesh, pivot, def, sprites, socket } = this.tail;
    const s = sprites[v] || sprites.front;
    if (mesh.material.uniforms.map.value !== s.texture) mesh.material.uniforms.map.value = s.texture;
    const flip = right ? 1 : -1;
    const wM = (def.scales?.[v] ?? def.scale) * HEAD_H, hM = (wM * s.h) / s.w;
    const [ox, oy] = def.offsets?.[v] || def.offset;   // where the sprite CENTRE sits (head-heights from socket pivot)
    const defaultRoot = socket === 'shoulders' ? [0, 0.38] : (v === 'back' ? [0, 0.42] : [0.42, 0.18]);
    const [rx, ry] = def.roots?.[v] || defaultRoot;
    const baseSocketY = socket === 'shoulders' ? (R.SHOULDER_Y - R.WAIST_Y) * CHIBI_HEIGHT : 0;
    mesh.scale.set(wM * flip, hM, 1);
    mesh.position.set(-rx * wM * flip, -ry * hM, 0);
    // In back view, z = 0.11 and renderOrder = 5.5 ensures tails/capes render cleanly OVER long waist-length hair (z = 0.06, renderOrder = 4.5)
    pivot.position.set(ox * HEAD_H * flip + rx * wM * flip, baseSocketY + oy * HEAD_H + ry * hM, v === 'back' ? 0.11 : -0.06);
    mesh.renderOrder = v === 'back' ? 5.5 : -0.5;
    this.tail.baseRot = 0;
  }

  /**
   * Attach or remove a procedurally drawn gathering tool (Master Plan v2 §9.1).
   * kind: 'pickaxe' | 'axe' | 'staff' | null.
   * Attaches to the dominant-hand arm group so it rotates with arm bone animations.
   * @param {'pickaxe'|'axe'|'staff'|null} kind
   * @param {number} [tier=1]
   */
  setHeldTool(kind, tier = 1) {
    if (!kind) {
      if (this.heldTool) {
        this.heldTool.mesh.parent?.remove(this.heldTool.mesh);
        this.heldTool.mesh.geometry?.dispose();
        this.heldTool.mesh.material?.dispose();
        this.heldTool = null;
      }
      this._heldToolDef = null;
      return;
    }

    const t = Math.max(1, Math.floor(tier || 1));
    if (this._heldToolDef?.kind === kind && this._heldToolDef?.tier === t && this.heldTool?.mesh) {
      this.layoutHeldTool(this.shownView || 'front', this.shownRight ?? true);
      return;
    }

    if (this.heldTool) {
      this.heldTool.mesh.parent?.remove(this.heldTool.mesh);
      this.heldTool.mesh.geometry?.dispose();
      this.heldTool.mesh.material?.dispose();
      this.heldTool = null;
    }

    const tex = getToolTexture(kind, t);
    const def = TOOL_ATTACH_DEFS[kind] || TOOL_ATTACH_DEFS.pickaxe;
    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = makeAccMaterial();
    mat.uniforms.map.value = tex;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 6;

    this.heldTool = { kind, tier: t, mesh, def, texture: tex };
    this._heldToolDef = { kind, tier: t };
    this.layoutHeldTool(this.shownView || 'front', this.shownRight ?? true);
  }

  layoutHeldTool(view, right) {
    if (!this.heldTool?.mesh) return;
    const v = view === 'lifted' ? 'front' : view;
    const flip = right ? 1 : -1;
    const domArm = right ? this.ARM_R_G : this.ARM_L_G;
    if (this.heldTool.mesh.parent !== domArm) {
      domArm.add(this.heldTool.mesh);
    }

    const stow = !!(this.couplePose || this.riding);
    if (stow) {
      this.heldTool.mesh.visible = false;
      return;
    }
    this.heldTool.mesh.visible = true;

    const def = this.heldTool.def;
    const spriteAspect = 1.0;
    const { effScale, ox, effOy, rotZ = 0 } = resolveAccessoryLayout({
      def,
      slot: 'gloves',
      view: v,
      spriteAspect,
      hairId: this.hair?.id || null,
      longHem: false,
      bodyMeta: this.views?.[v] || this.views?.front || null,
    });

    const wM = effScale * HEAD_H;
    const hM = wM * spriteAspect;
    const scaleSign = flip;
    const posSign = flip;
    const armTilt = rotZ * scaleSign;
    const stepZ = v === 'back' ? 0.062 : 0;
    const z = (ACC_Z[v]?.gloves ?? 0.068) + stepZ;

    this.heldTool.baseRotZ = armTilt;
    this.heldTool.baseScaleX = wM * scaleSign;
    this.heldTool.baseScaleY = hM;
    this.heldTool.mesh.rotation.z = armTilt;
    this.heldTool.mesh.scale.set(wM * scaleSign, hM, 1);
    this.heldTool.mesh.position.set(ox * HEAD_H * posSign, effOy * HEAD_H, z);
  }

  setPosition(x, z) { this.ROOT.position.set(x, 0, z); }

  triggerCast(dur = 1.15) {
    this.castMax = Math.max(0.2, dur);
    this.castT = this.castMax;
  }

  triggerAttack(kind = 'slash', { dur, onImpact } = {}) {
    const isGathering = kind === 'mine_swing' || kind === 'chop_swing' || kind === 'staff_cast';
    const defaultDur = isGathering ? 0.75 : 0.42;
    const effDur = Math.max(0.18, dur !== undefined ? dur : defaultDur);
    if (kind === 'spell_cast') {
      this.triggerCast(effDur);
      return;
    }
    this.combatAnim = {
      kind,
      t: 0,
      dur: effDur,
      onImpact: typeof onImpact === 'function' ? onImpact : null,
      impactFired: false,
    };
  }

  triggerHitRecoil(dur = 0.24) {
    this.hitRecoilT = Math.max(0.1, dur);
    this.hitRecoilMax = this.hitRecoilT;
  }

  /**
   * Synchronized 2-player Couple Pose choreography (Screen 19 & In-World Proximity):
   * pose: 'hug' | 'heart_hands' | 'kiss' | 'dance' | 'picnic'
   * role: 'left' (stands on left, faces right) | 'right' (stands on right, faces left)
   */
  setCouplePose(pose, { role = 'left', dur = 2.5, loop = false } = {}) {
    if (!pose) {
      this.clearCouplePose();
      return;
    }
    const r = role === 'right' ? 'right' : 'left';
    this.facing.turn = null;
    this.walkWeight = 0;
    this.couplePose = {
      pose,
      role: r,
      t: 0,
      dur: Math.max(0.5, dur),
      loop: !!loop,
    };
    if (this.nameTag) this.nameTag.position.x = r === 'right' ? 0.18 : -0.18;
    const wantRight = r !== 'right';
    const wantView = pose === 'kiss' && this.hasSide ? 'side' : 'front';
    if (this.views) this.applyView(wantView, wantRight);
  }

  clearCouplePose() {
    const hadPose = !!this.couplePose;
    this.couplePose = null;
    if (this.nameTag) this.nameTag.position.x = 0;
    if (hadPose && this.views) this.applyView(this.shownView, this.shownRight);
  }

  /** Copy the shader's bone angles onto the paper-doll groups (same pivots, same signs). */
  syncBones() {
    const u = this.material.uniforms;
    const h = u.uSize.value.y || CHIBI_HEIGHT;
    this.TORSO_G.rotation.z = u.uTorso.value;
    this.TORSO_G.scale.y = 1 + u.uBreath.value;
    // HEAD_G is a child of TORSO_G so it already inherits +1.0 * uTorso; subtract 0.6 * uTorso to get +0.4 * uTorso total
    this.HEAD_G.rotation.z = u.uHead.value - u.uTorso.value * 0.6;
    this.ARM_L_G.rotation.z = u.uArmL.value;
    this.ARM_R_G.rotation.z = u.uArmR.value;
    this.LEG_L_G.rotation.z = u.uLegL.value;
    this.LEG_R_G.rotation.z = u.uLegR.value;
    this.LEG_L_G.position.y = R.HIP_Y * h + Math.max(0, u.uLegL.value) * 0.032 * h;
    this.LEG_R_G.position.y = R.HIP_Y * h + Math.max(0, u.uLegR.value) * 0.032 * h;
  }

  /**
   * @param dt seconds
   * @param m { vx, vz, walkWeight } — world velocity of this character
   * @param cam THREE.Camera (for billboard yaw/pitch)
   */
  update(dt, m, cam) {
    this.t += dt;
    if (this._wearAura) { try { this._wearAura.update(dt); } catch (e) { try { WearAura.dispose(this); } catch (_) { this._wearAura = null; } } }
    for (const hm of this.hairMeshes) hm.material.uniforms.uTime.value = this.t;
    const speed = Math.hypot(m.vx, m.vz);
    const f = this.facing;
    if (!this.couplePose || this.lifted) {
      const wasTurning = f.turn;
      f.update(dt, m.vx, m.vz);
      if (f.turn && f.turn !== wasTurning) this.onTurn?.(f.turn.fromBack, f.back);
    }
    this.walkWeight = (this.couplePose && !this.lifted) ? 0 : (m.walkWeight ?? Math.min(1, speed / 1.5));
    const ww = this.walkWeight;
    this.legPhase += dt * (5 + 6 * Math.min(1, speed / 4.5)) * (ww > 0.01 ? 1 : 0);
    const ph = this.legPhase * 2.0;

    const u = this.material.uniforms;
    if (this.couplePose && !this.lifted) {
      const cp = this.couplePose;
      cp.t += dt;
      if (!cp.loop && cp.t >= cp.dur) {
        this.clearCouplePose();
      } else {
        const pt = cp.t;
        const isLeft = cp.role !== 'right';
        const dir = isLeft ? 1 : -1; // +1 = screen-right is toward partner, -1 = screen-left is toward partner
        const wantRight = isLeft;
        const wantView = cp.pose === 'kiss' && this.hasSide ? 'side' : (cp.viewOverride || 'front');
        const effRight = cp.rightOverride !== undefined ? cp.rightOverride : wantRight;
        if (this.shownView !== wantView || this.shownRight !== effRight) {
          this.applyView(wantView, effRight);
        }
        u.uTime.value = this.t;
        let torso = 0, head = 0, armL = 0, armR = 0, legL = 0, legR = 0;
        let hop = 0, sx = 1, sy = 1, wingHz = 3.2;

        if (cp.pose === 'hug') {
          // Warm Embrace: lean chest-to-chest, rest head on shoulder, wrap both arms & gentle cuddle bounce
          const sway = Math.sin(pt * 5.2);
          const pat = Math.sin(pt * 9.5);
          torso = -dir * (0.17 + 0.04 * sway);
          head = -dir * (0.20 + 0.05 * Math.sin(pt * 7.5));
          const innerReach = 0.82 + 0.12 * pat;
          const outerWrap = -0.38 - 0.10 * pat;
          armR = isLeft ? innerReach : -outerWrap;
          armL = isLeft ? outerWrap : -innerReach;
          legL = Math.sin(pt * 5.2) * 0.12;
          legR = -Math.sin(pt * 5.2) * 0.12;
          hop = Math.abs(Math.sin(pt * 5.2)) * 0.065;
          sx = 1.04 - 0.02 * Math.abs(sway);
          sy = 0.97 + 0.03 * Math.abs(sway);
          wingHz = 5.2;
        } else if (cp.pose === 'heart_hands') {
          // Heart-Hands: raise inner arms high to touch overhead, curve outer arms, playful outer-leg kick
          const beat = Math.sin(pt * 4.6);
          torso = -dir * (0.11 + 0.025 * beat);
          head = -dir * (0.14 + 0.04 * beat);
          const innerHigh = 0.98 + 0.07 * beat;
          const outerWave = 0.45 + 0.12 * Math.cos(pt * 4.6);
          armR = isLeft ? innerHigh : outerWave;
          armL = isLeft ? -outerWave : -innerHigh;
          const kick = this.tailBody ? 0 : Math.max(0, beat) * 0.28;
          legL = isLeft ? -kick : 0;
          legR = isLeft ? 0 : kick;
          hop = Math.abs(beat) * 0.075;
          sx = 1.02;
          sy = 1.02;
          wingHz = 4.6;
        } else if (cp.pose === 'kiss') {
          // Sweet Forehead Kiss / Nuzzle: nose-to-nose side profile, left leans in on tiptoes, right blushes & squishes
          const pulse = Math.sin(pt * 5.0);
          if (isLeft) {
            torso = -dir * (0.22 + 0.05 * Math.max(0, pulse));
            head = -dir * (0.16 + 0.04 * pulse);
            armR = 0.68 + 0.08 * pulse;
            armL = 0.25;
            legL = -0.18;
            legR = 0.14;
            hop = 0.06 + Math.max(0, pulse) * 0.04;
            sx = 0.98;
            sy = 1.04;
          } else {
            torso = dir * (0.08 + 0.03 * pulse);
            head = -dir * (0.12 + 0.04 * pulse);
            armL = -0.45 - 0.08 * pulse;
            armR = -0.25;
            hop = Math.abs(Math.sin(pt * 7.0)) * 0.035;
            sx = 1.05;
            sy = 0.94 + 0.03 * Math.abs(pulse);
          }
          wingHz = 6.4;
        } else if (cp.pose === 'dance') {
          // Ballroom Spin & Finale Dip
          const waltz = Math.sin(pt * 6.4);
          const inDip = !cp.loop && pt > cp.dur - 0.65;
          if (inDip) {
            torso = isLeft ? -0.22 : 0.32;
            head = isLeft ? -0.14 : 0.20;
            armL = -0.78;
            armR = 0.78;
            legL = -0.26;
            legR = 0.28;
            hop = isLeft ? 0.03 : -0.04;
          } else {
            torso = waltz * 0.16;
            head = -waltz * 0.10;
            armL = -0.65 + 0.14 * waltz;
            armR = 0.65 + 0.14 * waltz;
            legL = waltz * (this.tailBody ? 0 : 0.28);
            legR = -waltz * (this.tailBody ? 0 : 0.28);
            hop = Math.abs(waltz) * 0.10;
          }
          wingHz = 5.8;
        } else if (cp.pose === 'picnic') {
          // Berry Tart Picnic: seated on the blanket, legs tucked forward, sipping boba & cheering
          const sip = Math.sin(pt * 4.2);
          torso = -dir * 0.08 + Math.sin(pt * 2.6) * 0.05;
          head = -dir * 0.10 + sip * 0.07;
          const toastArm = 0.62 + 0.26 * Math.max(0, sip);
          armR = isLeft ? toastArm : 0.22;
          armL = isLeft ? -0.22 : -toastArm;
          legL = this.tailBody ? 0 : -0.52;
          legR = this.tailBody ? 0 : 0.52;
          hop = -0.15 + Math.abs(sip) * 0.025;
          sx = 1.05;
          sy = 0.91;
          wingHz = 2.4;
        }

        u.uTorso.value = torso;
        u.uHead.value = head;
        u.uArmL.value = armL;
        u.uArmR.value = armR;
        u.uLegL.value = legL;
        u.uLegR.value = legR;
        u.uBreath.value = Math.sin(pt * 4.0) * 0.025;
        u.uCloth.value = 0.018;
        u.uRim.value = 1.45;
        this.syncBones();
        if (this.tail) {
          this.tail.pivot.rotation.z = Math.sin(pt * 6.5) * 0.24 * (this.shownRight ? 1 : -1);
        }
        this.HIP.position.y = hop;
        this.HIP.scale.set(sx, sy, 1);
        this.shadow.scale.set(Math.max(0.4, 0.95 - Math.max(0, hop) * 1.1), 1, 0.48);
        const flap = Math.sin(this.t * Math.PI * 2 * wingHz);
        for (const w of this.wingMeshes) {
          w.scale.x = 1 - 0.16 * (0.5 + 0.5 * flap);
          w.rotation.z = w.userData.side * (0.06 + 0.14 * flap);
        }
        if (cam) {
          _scratchEuler.setFromQuaternion(cam.quaternion, 'YXZ');
          this.billboard.rotation.set(_scratchEuler.x * BILLBOARD_TILT, _scratchEuler.y, 0, 'YXZ');
        }
        return;
      }
    }

    // pop turn: the art swaps at the bottom of the crouch (front -> side -> back for up/down turns)
    const s = f.shown(this.hasSide);
    if (this.lifted) {
      if (this.shownView !== 'lifted' && this.views?.lifted) this.applyView('lifted', this.shownRight);
    } else if (s.view !== this.shownView || s.right !== this.shownRight) this.applyView(s.view, s.right);

    if (this.lifted) {
      // dangling by the scruff: legs kick out of phase, body swings like a pendulum
      const k = Math.sin(this.t * 13);
      u.uTime.value = this.t;
      const kick = this.tailBody ? 0 : 0.35;
      u.uLegL.value = k * kick; u.uLegR.value = -k * kick;
      u.uArmL.value = Math.sin(this.t * 9) * 0.3; u.uArmR.value = -Math.sin(this.t * 9 + 1) * 0.3;
      u.uTorso.value = Math.sin(this.t * 3.2) * 0.12;
      u.uHead.value = Math.sin(this.t * 3.2 - 0.6) * 0.05;
      u.uBreath.value = 0; u.uCloth.value = 0.02;
      this.syncBones();
      this.HIP.position.y = this.liftHeight + Math.sin(this.t * 6) * 0.03;
      this.HIP.scale.set(1, 1, 1);
      this.shadow.scale.set(0.6, 1, 0.3);
      if (cam) {
        _scratchEuler.setFromQuaternion(cam.quaternion, 'YXZ');
        this.billboard.rotation.set(_scratchEuler.x * BILLBOARD_TILT, _scratchEuler.y, 0, 'YXZ');
      }
      return;
    }

    const rideCfg = m?.riding !== undefined ? m.riding : this.riding;
    const wasRiding = !!this._wasRiding;
    this._wasRiding = !!rideCfg;
    if (rideCfg) {
      this.riding = rideCfg;
      this.applyRidingPose(rideCfg, cam);
      return;
    }
    if (wasRiding) {
      this.riding = null;
      if (this.views) this.layoutAccessories(this.shownView, this.shownRight, (this.views[this.shownView] || this.views.front)?.hem);
      if (this.heldTool) this.layoutHeldTool(this.shownView, this.shownRight);
    }
    if (!this.shadow.visible) this.shadow.visible = true;

    const step = Math.sin(ph);
    u.uTime.value = this.t;
    let castArc = 0;
    if (this.castT > 0) {
      this.castT = Math.max(0, this.castT - dt);
      const ck = 1 - this.castT / Math.max(0.01, this.castMax || 1.15);
      castArc = Math.sin(ck * Math.PI);
    }

    let cArmL = 0, cArmR = 0, cLegL = 0, cLegR = 0, cTorso = 0, cHop = 0, cSx = 1, cSy = 1, cRim = 0;
    let cToolRot = 0, cToolScale = 1;
    if (this.combatAnim) {
      this.combatAnim.t += dt;
      if (this.combatAnim.t >= this.combatAnim.dur) {
        if (!this.combatAnim.impactFired && this.combatAnim.onImpact) {
          this.combatAnim.impactFired = true;
          try { this.combatAnim.onImpact(); } catch (err) { console.error('onImpact error:', err); }
        }
        this.combatAnim = null;
        this.TORSO_G.rotation.y = 0;
      } else {
        const ck = this.combatAnim.t / this.combatAnim.dur;
        if (ck >= 0.55 && !this.combatAnim.impactFired && this.combatAnim.onImpact) {
          this.combatAnim.impactFired = true;
          try { this.combatAnim.onImpact(); } catch (err) { console.error('onImpact error:', err); }
        }
        const cArc = Math.sin(ck * Math.PI);
        const dir = this.shownRight ? 1 : -1;
        const kind = this.combatAnim.kind;
        if (kind === 'slash') {
          this.TORSO_G.rotation.y = 0;
          const swing = ck < 0.25
            ? -0.85 * (ck / 0.25)
            : -0.85 + 2.10 * Math.sin(((ck - 0.25) / 0.75) * Math.PI);
          if (this.shownRight) {
            cArmR = swing;
            cArmL = -0.25 * cArc;
          } else {
            cArmL = -swing;
            cArmR = 0.25 * cArc;
          }
          cLegL = -0.18 * cArc;
          cLegR = 0.18 * cArc;
          cTorso = dir * 0.24 * cArc;
          cHop = 0.09 * cArc;
          cRim = 1.4 * cArc;
          cToolRot = dir * swing * 0.45;
          cToolScale = 1 + 0.16 * cArc;
        } else if (kind === 'spin_slash') {
          this.TORSO_G.rotation.y = ck * Math.PI * 2;
          cArmL = -1.05 * cArc;
          cArmR = 1.05 * cArc;
          cHop = 0.16 * cArc;
          cRim = 1.6 * cArc;
          cToolScale = 1 + 0.22 * cArc;
        } else if (kind === 'ground_slam') {
          this.TORSO_G.rotation.y = 0;
          cHop = Math.sin(ck * Math.PI) * 0.52;
          if (ck < 0.6) {
            const uk = Math.sin((ck / 0.6) * (Math.PI * 0.5));
            cArmL = -1.15 * uk;
            cArmR = 1.15 * uk;
            cSx = 0.94;
            cSy = 1.08;
          } else {
            const dk = 1 - (ck - 0.6) / 0.4;
            cArmL = 0.75 * dk;
            cArmR = -0.75 * dk;
            cTorso = dir * 0.18 * dk;
            cSx = 1.18 - 0.18 * (1 - dk);
            cSy = 0.84 + 0.16 * (1 - dk);
          }
          cRim = 1.8 * cArc;
        } else if (kind === 'dash_strike') {
          this.TORSO_G.rotation.y = 0;
          cTorso = dir * 0.34 * cArc;
          cArmL = -0.65 * cArc;
          cArmR = 0.95 * cArc;
          cHop = 0.12 * cArc;
          cRim = 2.2 * cArc;
        } else if (kind === 'mine_swing') {
          this.TORSO_G.rotation.y = 0;
          let swing = 0, torsoAngle = 0;
          if (ck < 0.12) {
            // Phase 1: Ready (0 – 0.12)
            const p = ck / 0.12;
            swing = -0.15 * p;
            torsoAngle = -0.02 * p;
            cHop = 0.01 * p;
            cToolRot = -dir * 0.15 * p;
          } else if (ck < 0.42) {
            // Phase 2: Anticipation (0.12 – 0.42): arm drawn high (~-1.25 rad), torso leaning back ~-0.18, slight hop
            const p = (ck - 0.12) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = -0.15 - 1.10 * s;
            torsoAngle = -0.02 - 0.16 * s;
            cHop = 0.01 + 0.09 * Math.sin(p * Math.PI * 0.5);
            cLegL = -0.18 * s;
            cLegR = 0.18 * s;
            cToolRot = -dir * (0.15 + 0.48 * s);
            cToolScale = 1 + 0.08 * s;
          } else if (ck < 0.55) {
            // Phase 3: Swing (0.42 – 0.55): fast downward arc to ~+1.15 rad, torso snapping forward +0.26
            const p = (ck - 0.42) / 0.13;
            const s = p * p;
            swing = -1.25 + 2.40 * s;
            torsoAngle = -0.18 + 0.44 * s;
            cHop = 0.09 * (1 - p);
            cSx = 1.0 + 0.08 * p;
            cSy = 1.0 - 0.08 * p;
            cLegL = -0.18 + 0.38 * s;
            cLegR = 0.18 - 0.38 * s;
            cToolRot = dir * (-0.63 + 1.25 * s);
            cToolScale = 1.08 + 0.16 * Math.sin(p * Math.PI);
          } else if (ck < 0.70) {
            // Phase 5: Reaction (0.55 – 0.70): recoil to ~+0.85 rad
            const p = (ck - 0.55) / 0.15;
            const s = Math.sin(p * Math.PI * 0.5);
            swing = 1.15 - 0.30 * s;
            torsoAngle = 0.26 - 0.18 * s;
            cSx = 1.08 - 0.08 * s;
            cSy = 0.92 + 0.08 * s;
            cLegL = 0.20 * (1 - s);
            cLegR = -0.20 * (1 - s);
            cRim = 1.8 * (1 - p);
            cToolRot = dir * (0.62 - 0.32 * s);
            cToolScale = 1.0 + 0.10 * (1 - s);
          } else {
            // Phase 6: Recovery (0.70 – 1.00)
            const p = (ck - 0.70) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = 0.85 * (1 - s);
            torsoAngle = 0.08 * (1 - s);
            cToolRot = dir * 0.30 * (1 - s);
          }

          if (this.shownRight) {
            cArmR = swing;
            cArmL = -0.30 * swing;
          } else {
            cArmL = -swing;
            cArmR = 0.30 * swing;
          }
          cTorso = dir * torsoAngle;
        } else if (kind === 'chop_swing') {
          // chop_swing = more horizontal arc + rotate torso around vertical axis
          let swing = 0, torsoAngle = 0, torsoY = 0;
          if (ck < 0.12) {
            // Phase 1: Ready (0 – 0.12)
            const p = ck / 0.12;
            swing = -0.10 * p;
            torsoAngle = -0.02 * p;
            torsoY = -dir * 0.05 * p;
            cHop = 0.01 * p;
            cToolRot = -dir * 0.12 * p;
          } else if (ck < 0.42) {
            // Phase 2: Anticipation (0.12 – 0.42)
            const p = (ck - 0.12) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = -0.10 - 0.85 * s;
            torsoAngle = -0.02 - 0.14 * s;
            torsoY = -dir * (0.05 + 0.40 * s);
            cHop = 0.01 + 0.07 * Math.sin(p * Math.PI * 0.5);
            cLegL = -0.16 * s;
            cLegR = 0.16 * s;
            cToolRot = -dir * (0.12 + 0.42 * s);
            cToolScale = 1 + 0.08 * s;
          } else if (ck < 0.55) {
            // Phase 3: Swing (0.42 – 0.55): fast horizontal chop arc
            const p = (ck - 0.42) / 0.13;
            const s = p * p;
            swing = -0.95 + 2.00 * s;
            torsoAngle = -0.16 + 0.38 * s;
            torsoY = dir * (-0.45 + 0.85 * s);
            cHop = 0.08 * (1 - p);
            cSx = 1.0 + 0.08 * p;
            cSy = 1.0 - 0.08 * p;
            cLegL = -0.16 + 0.34 * s;
            cLegR = 0.16 - 0.34 * s;
            cToolRot = dir * (-0.54 + 1.12 * s);
            cToolScale = 1.08 + 0.16 * Math.sin(p * Math.PI);
          } else if (ck < 0.70) {
            // Phase 5: Reaction (0.55 – 0.70): recoil
            const p = (ck - 0.55) / 0.15;
            const s = Math.sin(p * Math.PI * 0.5);
            swing = 1.05 - 0.25 * s;
            torsoAngle = 0.22 - 0.15 * s;
            torsoY = dir * (0.40 - 0.22 * s);
            cSx = 1.08 - 0.08 * s;
            cSy = 0.92 + 0.08 * s;
            cLegL = 0.18 * (1 - s);
            cLegR = -0.18 * (1 - s);
            cRim = 1.8 * (1 - p);
            cToolRot = dir * (0.58 - 0.30 * s);
            cToolScale = 1.0 + 0.10 * (1 - s);
          } else {
            // Phase 6: Recovery (0.70 – 1.00)
            const p = (ck - 0.70) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = 0.80 * (1 - s);
            torsoAngle = 0.07 * (1 - s);
            torsoY = dir * 0.18 * (1 - s);
            cToolRot = dir * 0.28 * (1 - s);
          }

          this.TORSO_G.rotation.y = torsoY;
          if (this.shownRight) {
            cArmR = swing;
            cArmL = -0.30 * swing;
          } else {
            cArmL = -swing;
            cArmR = 0.30 * swing;
          }
          cTorso = dir * torsoAngle;
        } else if (kind === 'staff_cast') {
          // staff_cast = arms raised forward and up, with no big downswing
          this.TORSO_G.rotation.y = 0;
          let swing = 0, torsoAngle = 0;
          if (ck < 0.12) {
            // Phase 1: Ready (0 – 0.12): arms begin raising forward and up
            const p = ck / 0.12;
            swing = 0.20 * p;
            torsoAngle = -0.02 * p;
            cHop = 0.02 * p;
            cToolRot = dir * 0.08 * p;
          } else if (ck < 0.42) {
            // Phase 2: Anticipation (0.12 – 0.42): channeling forward and up
            const p = (ck - 0.12) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = 0.20 + 0.90 * s;
            torsoAngle = -0.02 - 0.13 * s;
            cHop = 0.02 + 0.10 * Math.sin(p * Math.PI * 0.5);
            cRim = 1.2 * s;
            cToolRot = dir * (0.08 + 0.22 * s);
            cToolScale = 1 + 0.10 * s;
          } else if (ck < 0.55) {
            // Phase 3: Cast thrust (0.42 – 0.55): arms held forward-up with no downswing
            const p = (ck - 0.42) / 0.13;
            const s = Math.sin(p * Math.PI * 0.5);
            swing = 1.10 + 0.15 * s;
            torsoAngle = -0.15 + 0.25 * s;
            cHop = 0.12 + 0.04 * s;
            cRim = 1.2 + 1.2 * s;
            cToolRot = dir * (0.30 + 0.15 * s);
            cToolScale = 1.10 + 0.14 * s;
          } else if (ck < 0.70) {
            // Phase 5: Reaction (0.55 – 0.70): burst recoil, arms settle slightly
            const p = (ck - 0.55) / 0.15;
            const s = Math.sin(p * Math.PI * 0.5);
            swing = 1.25 - 0.35 * s;
            torsoAngle = 0.10 - 0.08 * s;
            cHop = 0.16 - 0.10 * s;
            cRim = 2.4 - 1.2 * s;
            cToolRot = dir * (0.45 - 0.20 * s);
            cToolScale = 1.24 - 0.16 * s;
          } else {
            // Phase 6: Recovery (0.70 – 1.00): return to resting pose
            const p = (ck - 0.70) / 0.30;
            const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
            swing = 0.90 * (1 - s);
            torsoAngle = 0.02 * (1 - s);
            cHop = 0.06 * (1 - s);
            cRim = 1.2 * (1 - s);
            cToolRot = dir * 0.25 * (1 - s);
            cToolScale = 1.08 - 0.08 * s;
          }

          if (this.shownRight) {
            cArmR = swing;
            cArmL = -0.70 * swing;
          } else {
            cArmL = -swing;
            cArmR = 0.70 * swing;
          }
          cTorso = dir * torsoAngle;
        }
      }
    } else if (this.TORSO_G.rotation.y !== 0) {
      this.TORSO_G.rotation.y = 0;
    }

    if (this.hitRecoilT > 0) {
      this.hitRecoilT = Math.max(0, this.hitRecoilT - dt);
      const rk = this.hitRecoilT / Math.max(0.01, this.hitRecoilMax || 0.24);
      cTorso -= (this.shownRight ? 1 : -1) * 0.22 * rk;
      cRim += 2.5 * rk;
    }

    const legAmp = this.tailBody ? 0 : 0.30;
    u.uLegL.value = step * legAmp * ww - castArc * (this.tailBody ? 0 : 0.16) + (this.tailBody ? 0 : cLegL);
    u.uLegR.value = -step * legAmp * ww + castArc * (this.tailBody ? 0 : 0.16) + (this.tailBody ? 0 : cLegR);
    u.uArmL.value = -step * 0.22 * ww - castArc * 0.68 + cArmL;
    u.uArmR.value = step * 0.22 * ww + castArc * 0.68 + cArmR;
    u.uTorso.value = Math.sin(ph) * 0.05 * ww + Math.sin(this.t * 10) * 0.03 * castArc + cTorso;
    // head/hair lags behind the turn for a beat (secondary motion)
    u.uHead.value = -Math.sin(ph - 0.45) * 0.06 * ww + Math.sin(this.t * 1.3) * 0.025 * (1 - ww) + f.turnLag * 0.09 - castArc * 0.05;
    u.uBreath.value = Math.sin(this.t * 2.2) * 0.015 * (1 - ww) + castArc * 0.03;
    u.uCloth.value = 0.006 + (this.tailBody ? 0.022 : 0.01) * ww + Math.abs(f.turnLag) * 0.02 + castArc * 0.025;
    u.uRim.value = 0.6 + castArc * 1.8 + cRim;
    this.syncBones();
    if (this.heldTool?.mesh && this.heldTool.mesh.visible) {
      const idleSway = Math.sin(ph - 0.5) * 0.07 * ww + Math.sin(this.t * 2.5) * 0.035 * (1 - ww);
      this.heldTool.mesh.rotation.z = (this.heldTool.baseRotZ || 0) + cToolRot + idleSway;
      this.heldTool.mesh.scale.set(
        (this.heldTool.baseScaleX || 1) * cToolScale,
        (this.heldTool.baseScaleY || 1) * cToolScale,
        1
      );
    }
    if (this.tail) this.tail.pivot.rotation.z = (Math.sin(this.t * 2.1) * 0.10 + Math.sin(ph) * 0.16 * ww) * (this.shownRight ? 1 : -1) * (this.shownView === 'back' ? 0.6 : 1);

    // HIP: rhythmic waddle-hop + pop-turn hop + cast levitation + combat hop + squash/stretch (width never collapses)
    const hop = Math.abs(Math.sin(ph)) * (this.tailBody ? 0.025 : 0.08) * ww + f.turnHop * 0.06 + castArc * 0.42 + cHop;
    this.HIP.position.y = hop;
    const walkSquash = 1 - (1 - Math.abs(Math.sin(ph))) * 0.03 * ww;
    const ts = f.turnSquash;
    this.HIP.scale.set(ts.sx * (2 - walkSquash) * cSx, ts.sy * walkSquash * (1 + castArc * 0.04) * cSy, 1);
    this.shadow.scale.set(Math.max(0.35, 0.95 - hop * 1.1), 1, Math.max(0.2, 0.5 - hop * 0.45));

    // WINGS: 1.2 Hz idle → 3.4 Hz moving → 5.0 Hz casting
    const flap = Math.sin(this.t * Math.PI * 2 * (1.2 + 2.2 * ww + 3.8 * castArc));
    for (const w of this.wingMeshes) {
      w.scale.x = 1 - 0.16 * (0.5 + 0.5 * flap);
      w.rotation.z = w.userData.side * (0.05 + (0.06 + 0.12 * castArc) * flap);
    }

    // billboard: face the camera's yaw and lean back a bit so 2.8-head proportions read well
    if (cam) {
      _scratchEuler.setFromQuaternion(cam.quaternion, 'YXZ');
      this.billboard.rotation.set(_scratchEuler.x * BILLBOARD_TILT, _scratchEuler.y, 0, 'YXZ');
    }
  }

  /**
   * Seated astride riding pose & kinematics for mounted companions (`m.riding`).
   * Zero per-frame heap allocations.
   */
  applyRidingPose(rideCfg, cam = null) {
    const ride = typeof rideCfg === 'object' && rideCfg !== null ? rideCfg : {};
    const u = this.material.uniforms;
    const rPh = Number.isFinite(ride.phase) ? ride.phase : this.legPhase * 2.0;
    this.shadow.visible = false;
    u.uTime.value = this.t;
    for (let i = 0; i < this.accMeshes.length; i++) {
      const a = this.accMeshes[i];
      if (a.def?.singleHand && a.mesh.visible) a.mesh.visible = false;
    }
    if (this.heldTool?.mesh) this.heldTool.mesh.visible = false;

    // Seated Astride Legs: straddle wide astride the pet's back so boots hug the flanks/stirrups
    const straddle = this.shownView === 'side' ? 0.38 : 0.50;
    u.uLegL.value = this.tailBody ? 0 : (-straddle - Math.sin(rPh) * 0.06);
    u.uLegR.value = this.tailBody ? 0 : ((this.shownView === 'side' ? -0.18 : straddle) + Math.sin(rPh) * 0.06);

    // Reins-Holding & Cheering Arms: hands reach forward holding golden reins; raise right arm high when cheering
    const rein = 0.42 + Math.sin(rPh) * 0.08 + (ride.reinPull || 0) * 0.18;
    u.uArmL.value = -rein;
    u.uArmR.value = (ride.cheer > 0)
      ? (0.88 + Math.sin(this.t * 12) * 0.10)
      : rein;

    // Dynamic Rider Torso, Head & Hair
    const bank = ride.bank || 0;
    u.uTorso.value = bank * 0.45 + Math.sin(rPh) * 0.04;
    u.uHead.value = -bank * 0.25 - Math.sin(rPh - 0.5) * 0.05;
    u.uBreath.value = Math.sin(rPh) * 0.020;
    u.uCloth.value = 0.022;
    u.uRim.value = 1.15;
    this.syncBones();

    if (this.tail) {
      this.tail.pivot.rotation.z = Math.sin(rPh * 1.15) * 0.22 * (this.shownRight ? 1 : -1) * (this.shownView === 'back' ? 0.65 : 1);
    }

    // Absorb mount landing squash on HIP
    const sq = ride.squash || 0;
    this.HIP.position.y = -0.06 * sq;
    this.HIP.scale.set(1 + 0.14 * sq, 1 - 0.16 * sq, 1);

    // Flap equipped Chibi wings gracefully (2.6 Hz glide/assist beat)
    const flap = Math.sin(this.t * Math.PI * 2 * 2.6);
    for (const w of this.wingMeshes) {
      w.scale.x = 1 - 0.16 * (0.5 + 0.5 * flap);
      w.rotation.z = w.userData.side * (0.06 + 0.10 * flap);
    }

    if (cam) {
      _scratchEuler.setFromQuaternion(cam.quaternion, 'YXZ');
      this.billboard.rotation.set(_scratchEuler.x * BILLBOARD_TILT, _scratchEuler.y, 0, 'YXZ');
    }
  }

  dispose() {
    try { WearAura.dispose(this); } catch (e) { /* cosmetic only */ }
    if (this.heldTool) {
      this.heldTool.mesh.parent?.remove(this.heldTool.mesh);
      this.heldTool.mesh.geometry?.dispose();
      this.heldTool.mesh.material?.dispose();
      this.heldTool = null;
      this._heldToolDef = null;
    }
    this.ROOT.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const m = o.material.map;
        if (m?.isCanvasTexture && !m.userData?.shared && m !== shadowTex) {
          m.dispose();
        }
        o.material.dispose?.();
      }
    });
  }
}
