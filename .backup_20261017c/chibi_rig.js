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
import { ATTACH, getAttachDef, getWingScale, RIG_METRICS, OUTFIT_FALLBACK, visibleSlotId, outfitHem, resolveAccessoryLayout } from '/shared/accessory_attach.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { HAIRSTYLES, hairSpriteName, hairAttach, hairHatFit, resolveHairColor } from '/shared/hair_catalog.js';
import { WearAura } from './wear_aura.js';

export const CHIBI_HEIGHT = RIG_METRICS.CHIBI_HEIGHT; // world metres for the Front-3/4 sprite
const BILLBOARD_TILT = 0.55;                          // fraction of camera pitch the sprite leans back (reduces foreshortening)

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
      vec2 ftL = vec2((xN + 0.16) / 0.13, (vUv.y - 0.032) / 0.042);
      vec2 ftR = vec2((xN - 0.22) / 0.16, (vUv.y - 0.032) / 0.042);
      if (dot(ftL, ftL) < 1.0 || dot(ftR, ftR) < 1.0) discard;
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
    if (uClipTopY < -0.5) {
      // Open-crown winged helm / diadem clip (hairCover: 'helm'): keeps the rounded center skull dome,
      // all forehead bangs, and all hair below yHead = 0.84 100% visible, while smoothly tucking
      // high outer buns (hair_double_buns at yHead > 0.86 outside the skull dome) into the helm wings.
      float domeCenterX = uClipTopY < -1.5 ? -0.12 : 0.04;
      vec2 skullP = vec2((xFacing - domeCenterX) / 0.53, (yHead - 0.56) / 0.60);
      float skullR = length(skullP);
      float sideMask = uClipTopY < -1.5 ? (1.0 - smoothstep(-0.18, -0.05, xFacing)) : 1.0;
      float bunClip = sideMask * smoothstep(0.84, 0.90, yHead) * smoothstep(0.96, 1.05, skullR);
      c.a *= 1.0 - bunClip;
    } else if (uClipTopY < 1.5) {
      // Full-crown hat clip in physical HEAD_H coordinates: follows the angled brim in front/side views
      // (lower on the left/back bun side, higher on the right forehead/bangs side) and level in back view.
      float hatClipY = uClipTopY > 0.5 ? (0.81 + 0.24 * xFacing) : 0.78;
      c.a *= smoothstep(hatClipY + 0.02, hatClipY - 0.03, yHead);
    }
    if (uFrontViewMode > 0.5) {
      // True 3/4 & profile anime depth: bangs (yHead > 0.52) and near-side locks (xFacing < 0.06) stay IN FRONT
      // of the head, while far-side locks below the eyebrow line tuck BEHIND the far eye/cheek (drawn by behind copy).
      float xCut = uFrontViewMode > 1.5 ? 0.14 : 0.07;
      float yBrow = uFrontViewMode > 1.5 ? 0.54 : 0.52;
      float inFarFace = smoothstep(xCut - 0.04, xCut + 0.04, xFacing) * (1.0 - smoothstep(yBrow - 0.04, yBrow + 0.04, yHead));
      c.a *= 1.0 - inFarFace;
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
  front: { boots: 0.01, gloves: 0.05, hat: 0.08, face: 0.10 },
  side: { boots: 0.01, gloves: 0.05, hat: 0.08, face: 0.10 },
  back: { boots: 0.01, gloves: 0.03, hat: 0.08, face: 0.08 },
};
const ACC_ORDER = { boots: 1, gloves: 2, hat: 3, face: 4 };

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
      const view = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: s.hem || 'short' });
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
    const view = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: s.hem || 'short' });
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
    const key = JSON.stringify(['outfit', ...ACC_SLOTS, 'wings'].map(vis));
    if (key === this.equipKey) {
      if (this.equipPromise) await this.equipPromise;
      return;
    }
    if (!this.views) { this.pendingEquip = eq; return; }
    this.equipKey = key;
    this.equipPromise = (async () => {
      await this.setOutfit(vis('outfit'));
      await this.setWings(vis('wings'));
      await this.setAccessories(Object.fromEntries(ACC_SLOTS.map((s) => [s, vis(s)])));
    })();
    await this.equipPromise;
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
        const mk = (s, ppm) => ({ tex: s.texture, size: new THREE.Vector2(s.w * ppm, s.h * ppm), nativeRight: s.faces !== 'left', hem: outfitHem(id, s.hem) });
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
    // ✦ Super Mythic wear aura (client/js/wear_aura.js): suit-up only on an in-session equip change
    try { WearAura.sync(this, id, { suitUp: !!this._outfitApplied }); } catch (e) { /* cosmetic only */ }
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
        mesh.renderOrder = 2 + ACC_ORDER[slot];
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
    const longHem = bodyHem === 'long' && v !== 'side';
    let maskHands = 0;
    let maskFeet = 0;
    for (const a of this.accMeshes) {
      const name = a.def.views[v];
      const s = name && a.sprites[name];
      const isBoot = a.def.bone === 'LEG';
      // side view (arms only) or single-hand held weapon: only the leading arm is visible
      const hiddenSide = ((v === 'side' && !isBoot) || a.def.singleHand) && a.side !== 0 && a.side !== flip;
      if (!s || s.fallback || hiddenSide) { a.mesh.visible = false; continue; }
      a.mesh.visible = true;
      const u = a.mesh.material.uniforms;
      if (u.map.value !== s.texture) u.map.value = s.texture;
      u.uClipTopY.value = isBoot && longHem ? 0.56 : 2.0;
      if (a.def.bone === 'ARM') maskHands = a.def.singleHand ? flip : 2;
      if (isBoot) maskFeet = longHem ? 2 : 1;
      // headwear sits on the hair volume: hats are calibrated on the reference wig, other wigs declare `hatFit`
      const spriteAspect = s.h / s.w;
      const { effScale, ox, effOy } = resolveAccessoryLayout({
        def: a.def,
        slot: a.slot,
        view: v,
        spriteAspect,
        hairId: this.hair?.id || null,
        longHem,
      });
      const wM = effScale * HEAD_H, hM = wM * spriteAspect;
      // Boots always point in the walking direction (flip); two-handed gloves mirror left (-1) vs right (+1), and thumb-forward (-flip) in side profile
      const isGlove = a.def.bone === 'ARM' && !a.def.singleHand;
      const scaleSign = isBoot || a.def.singleHand ? flip : isGlove && v === 'side' ? -flip : v === 'side' || a.side === 0 ? flip : a.side;
      const posSign = isBoot || a.def.singleHand || v === 'side' || a.side === 0 ? flip : a.side;
      // In 3/4 and side views, the leading foot sits slightly lower and in front of the trailing foot
      const stepY = isBoot ? (a.side === flip ? -0.008 : 0.008) : 0;
      const stepZ = isBoot && a.side === flip ? 0.004 : 0;
      const armTilt = isGlove && v !== 'side' ? -a.side * 0.14 : 0;
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
      mesh.renderOrder = layer === 'front' ? 2 + ACC_ORDER.hat - 0.5 : 0;   // front copy sits under hats/helms and facewear
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
    const flip = right === (s.faces !== 'left') ? 1 : -1;   // mirror only when the wig art faces the other way
    const def = this.hair.def;
    const wM = (def.scales?.[v] ?? def.scale) * HEAD_H, hM = (wM * s.h) / s.w;
    const [ox, oy] = def.offsets?.[v] || def.offset;
    const uvSign = s.faces === 'left' ? -1 : 1;
    // neck line in the wig's own UV: the HEAD pivot (y = 0) plus a small margin under the chin
    const neckV = Math.min(1, Math.max(0, (hM / 2 - oy * HEAD_H + 0.06 * HEAD_H) / hM));
    const activeHatCover = this.accMeshes.find((a) => a.slot === 'hat' && a.mesh.visible && a.def?.hairCover)?.def?.hairCover;
    const topClipV = activeHatCover === 'top' ? (v === 'back' ? 0.25 : 1.0) : activeHatCover === 'helm' ? (v === 'side' ? -2.0 : -1.0) : 2.0;
    for (const m of this.hairMeshes) {
      const front = m.userData.layer === 'front';
      const u = m.material.uniforms;
      if (u.map.value !== s.texture) u.map.value = s.texture;
      u.uHairBox.value.set(ox * uvSign, oy, (wM / HEAD_H) * uvSign, hM / HEAD_H);
      u.uClipTopY.value = topClipV;
      if (v === 'back') {
        m.visible = front;                 // back of the head: one full copy over the body
        u.uClipBottomY.value = -1;
        u.uFrontViewMode.value = 0;
      } else {
        m.visible = true;
        u.uClipBottomY.value = front ? neckV : -1;
        u.uFrontViewMode.value = front ? (v === 'side' ? 2 : 1) : 0;
      }
      m.scale.set(wM * flip, hM, 1);
      m.position.set(ox * HEAD_H * flip, oy * HEAD_H, front ? ACC_Z[v].hat - 0.02 : -0.05);
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
    const wingScale = getWingScale(id);
    const w = s.w * this.ppm * wingScale, h = s.h * this.ppm * wingScale;
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

  setPosition(x, z) { this.ROOT.position.set(x, 0, z); }

  triggerCast(dur = 1.15) {
    this.castMax = Math.max(0.2, dur);
    this.castT = this.castMax;
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
    const wasTurning = f.turn;
    f.update(dt, m.vx, m.vz);
    if (f.turn && f.turn !== wasTurning) this.onTurn?.(f.turn.fromBack, f.back);
    this.walkWeight = m.walkWeight ?? Math.min(1, speed / 1.5);
    const ww = this.walkWeight;
    this.legPhase += dt * (5 + 6 * Math.min(1, speed / 4.5)) * (ww > 0.01 ? 1 : 0);
    const ph = this.legPhase * 2.0;

    // pop turn: the art swaps at the bottom of the crouch (front -> side -> back for up/down turns)
    const s = f.shown(this.hasSide);
    if (this.lifted) {
      if (this.shownView !== 'lifted' && this.views?.lifted) this.applyView('lifted', this.shownRight);
    } else if (s.view !== this.shownView || s.right !== this.shownRight) this.applyView(s.view, s.right);

    const u = this.material.uniforms;
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
        const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        this.billboard.rotation.set(e.x * BILLBOARD_TILT, e.y, 0, 'YXZ');
      }
      return;
    }
    const step = Math.sin(ph);
    u.uTime.value = this.t;
    let castArc = 0;
    if (this.castT > 0) {
      this.castT = Math.max(0, this.castT - dt);
      const ck = 1 - this.castT / Math.max(0.01, this.castMax || 1.15);
      castArc = Math.sin(ck * Math.PI);
    }
    const legAmp = this.tailBody ? 0 : 0.30;
    u.uLegL.value = step * legAmp * ww - castArc * (this.tailBody ? 0 : 0.16);
    u.uLegR.value = -step * legAmp * ww + castArc * (this.tailBody ? 0 : 0.16);
    u.uArmL.value = -step * 0.22 * ww - castArc * 0.68;
    u.uArmR.value = step * 0.22 * ww + castArc * 0.68;
    u.uTorso.value = Math.sin(ph) * 0.05 * ww + Math.sin(this.t * 10) * 0.03 * castArc;
    // head/hair lags behind the turn for a beat (secondary motion)
    u.uHead.value = -Math.sin(ph - 0.45) * 0.06 * ww + Math.sin(this.t * 1.3) * 0.025 * (1 - ww) + f.turnLag * 0.09 - castArc * 0.05;
    u.uBreath.value = Math.sin(this.t * 2.2) * 0.015 * (1 - ww) + castArc * 0.03;
    u.uCloth.value = 0.006 + (this.tailBody ? 0.022 : 0.01) * ww + Math.abs(f.turnLag) * 0.02 + castArc * 0.025;
    u.uRim.value = 0.6 + castArc * 1.8;
    this.syncBones();
    if (this.tail) this.tail.pivot.rotation.z = (Math.sin(this.t * 2.1) * 0.10 + Math.sin(ph) * 0.16 * ww) * (this.shownRight ? 1 : -1) * (this.shownView === 'back' ? 0.6 : 1);

    // HIP: rhythmic waddle-hop + pop-turn hop + cast levitation + squash/stretch (width never collapses)
    const hop = Math.abs(Math.sin(ph)) * (this.tailBody ? 0.025 : 0.08) * ww + f.turnHop * 0.06 + castArc * 0.42;
    this.HIP.position.y = hop;
    const walkSquash = 1 - (1 - Math.abs(Math.sin(ph))) * 0.03 * ww;
    const ts = f.turnSquash;
    this.HIP.scale.set(ts.sx * (2 - walkSquash), ts.sy * walkSquash * (1 + castArc * 0.04), 1);
    this.shadow.scale.set(Math.max(0.35, 0.95 - hop * 1.1), 1, Math.max(0.2, 0.5 - hop * 0.45));

    // WINGS: 1.2 Hz idle → 3.4 Hz moving → 5.0 Hz casting
    const flap = Math.sin(this.t * Math.PI * 2 * (1.2 + 2.2 * ww + 3.8 * castArc));
    for (const w of this.wingMeshes) {
      w.scale.x = 1 - 0.16 * (0.5 + 0.5 * flap);
      w.rotation.z = w.userData.side * (0.05 + (0.06 + 0.12 * castArc) * flap);
    }

    // billboard: face the camera's yaw and lean back a bit so 2.8-head proportions read well
    if (cam) {
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      this.billboard.rotation.set(e.x * BILLBOARD_TILT, e.y, 0, 'YXZ');
    }
  }

  dispose() {
    try { WearAura.dispose(this); } catch (e) { /* cosmetic only */ }
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
