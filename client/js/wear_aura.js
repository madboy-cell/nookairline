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

export const AURA_MAX_PARTICLES = 60;
const POINTS = 54;
const FOOTPRINTS = AURA_MAX_PARTICLES - POINTS;
const SUIT_UP_S = 1.5;
export const TWIN_RANGE = 3.2;         // metres (xz) between partners for the Twin Eclipse link
const H = RIG_METRICS.CHIBI_HEIGHT || 1.55;
const AURA_ATTR_KEYS = Object.freeze(['position', 'aColor', 'aSize', 'aAlpha', 'aShape', 'aRot']);

// shape ids (fragment shader): 0 soft glow · 1 four-point star · 2 ember · 3 petal
const PROFILES = {
  eclipse: {
    wisp: 14, motes: 24, burst: 16,
    gold: new THREE.Color(1.0, 0.78, 0.25), deep: new THREE.Color(0.85, 0.32, 0.06), ember: new THREE.Color(1.0, 0.5, 0.12),
    pillar: new THREE.Color(1.0, 0.82, 0.35), foot: 'sun', footTint: new THREE.Color(1.0, 0.75, 0.3),
  },
  aurora: {
    wisp: 8, motes: 30, burst: 16,     // wisp = sparkles riding the ribbons
    teal: new THREE.Color(0.25, 1.0, 0.85), violet: new THREE.Color(0.62, 0.42, 1.0), pink: new THREE.Color(1.0, 0.55, 0.85),
    star: new THREE.Color(0.85, 0.92, 1.0),
    pillar: new THREE.Color(0.6, 0.85, 1.0), foot: 'petal', footTint: new THREE.Color(0.8, 0.85, 1.0),
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
    if (vShape < 0.5) a = exp(-r * r * 3.2);                                            // soft glow
    else if (vShape < 1.5) a = max(exp(-r * r * 9.0), exp(-abs(p.x * p.y) * 60.0) * (1.0 - r)); // star
    else if (vShape < 2.5) a = exp(-r * r * 5.0) + exp(-r * r * 40.0);                  // ember (hot core)
    else a = smoothstep(1.0, 0.7, length(vec2(p.x * 1.9, p.y)));                         // petal
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
  };
  return glyphTex;
}

// ------------------------------------------------------------------ the aura
export class WearAura {
  constructor(rig, kind) {
    this.rig = rig;
    this.kind = kind;
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

    if (kind === 'aurora') this.ribbons = [0, 1].map((k) => this.makeRibbon(k));
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
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: (k ? P.violet : P.teal).clone() }, uB: { value: (k ? P.pink : P.violet).clone() }, uC: { value: (k ? P.teal : P.pink).clone() }, uAlpha: { value: 0.5 }, uTime: { value: 0 }, uFlow: { value: 0 } },
      vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return { mesh, k, seg: SEG };
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
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2), mat);
      mesh.renderOrder = 1;
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
    } else {                              // star dust: drifting twinkles around the whole body
      p.y = 0.1 + Math.random() * H * 1.05;
      p.vx = (Math.random() - 0.5) * 0.08; p.vz = (Math.random() - 0.5) * 0.08; p.vy = 0.04 + Math.random() * 0.08;
      p.size = 0.045 + Math.random() * 0.06; p.shape = Math.random() < 0.45 ? 1 : 0; p.max = 1.6 + Math.random() * 1.6;
      p.c.copy([P.star, P.teal, P.violet, P.pink][(Math.random() * 4) | 0]);
    }
    p.life = p.max * (0.3 + 0.7 * Math.random());
  }

  burst() {                               // suit-up finale: radial ring of embers / stars
    const P = this.P, o = P.wisp + P.motes;
    for (let i = 0; i < P.burst; i++) {
      const p = this.pt[o + i], a = (i / P.burst) * Math.PI * 2, sp = 1.4 + Math.random() * 0.8;
      p.x = 0; p.y = H * 0.55; p.z = 0;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp * 0.6; p.vy = 0.6 + Math.random() * 0.9;
      p.size = 0.09 + Math.random() * 0.06; p.shape = this.kind === 'eclipse' ? 2 : 1;
      p.rot = a; p.spin = 3; p.max = p.life = 0.8 + Math.random() * 0.4;
      p.c.copy(this.kind === 'eclipse' ? (i % 2 ? P.gold : P.ember) : [P.teal, P.violet, P.pink, P.star][i % 4]);
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
    if (su >= 0 && !red) {
      pil.visible = true;
      const rise = Math.min(1, su / 0.3), fade = su > 0.75 ? 1 - (su - 0.75) / 0.25 : 1;
      pil.scale.set(1 + 0.3 * (1 - rise), rise, 1 + 0.3 * (1 - rise));
      pil.material.uniforms.uAlpha.value = 0.75 * fade;
      pil.material.uniforms.uTime.value = t;
    } else pil.visible = false;

    const q = quality.level * (red ? 0.4 : 1);
    const nWisp = Math.max(1, Math.round(P.wisp * Math.min(1, q + 0.25)));
    const nMote = Math.round(P.motes * q);
    const glow = 1 + this.twin * 0.6;
    const pos = this.points.geometry.attributes;
    const intro = su >= 0 ? Math.min(1, su / 0.6) : 1;   // aura fades in during the suit-up

    let w = 0;
    const put = (x, y, z, c, size, alpha, shape, rot) => {
      pos.position.setXYZ(w, x, y, z);
      pos.aColor.setXYZ(w, c.r, c.g, c.b);
      pos.aSize.setX(w, size); pos.aAlpha.setX(w, Math.min(1, alpha)); pos.aShape.setX(w, shape); pos.aRot.setX(w, rot);
      w++;
    };

    // 1) wisp: eclipse = serpentine dragon chain on a tilted orbit; aurora = sparkles riding the ribbons
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
      const isBurst = i >= P.motes, p = this.pt[o + i];
      if (!isBurst && i >= nMote) continue;
      if (p.life <= 0) {
        if (isBurst) continue;
        this.spawnMote(p);
      }
      p.life -= dt * (isBurst ? 1 : speedMul);
      p.x += p.vx * dt * speedMul - dx; p.y += p.vy * dt * speedMul; p.z += p.vz * dt * speedMul - dz;
      if (isBurst) { p.vy -= 1.6 * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; }
      else if (this.kind === 'aurora') { p.vx += Math.sin(t + i) * 0.02 * dt; }
      p.rot += p.spin * dt;
      // recycle motes that drift too far from the wearer (e.g. while running)
      if (!isBurst && (p.x * p.x + p.z * p.z) > 2.2) { p.life = 0; continue; }
      const k = p.life / p.max, fade = Math.min(1, (1 - k) * 4) * Math.min(1, k * 2.5);
      const tw = this.kind === 'aurora' && !isBurst ? 0.55 + 0.45 * Math.sin(t * 6 + i * 1.7) : 1;
      put(p.x, p.y, p.z, p.c, p.size * glow * (isBurst ? 1 : 0.8 + 0.4 * k), fade * tw * (isBurst ? 1 : intro), p.shape, p.rot);
    }
    this.points.geometry.setDrawRange(0, w);
    for (const k of AURA_ATTR_KEYS) pos[k].needsUpdate = true;

    // aurora ribbons (curtain unfolds top → down during the suit-up)
    if (this.ribbons) {
      const curtain = su >= 0 ? Math.min(1, su / 0.6) : 1;
      for (const rb of this.ribbons) {
        const arr = rb.mesh.geometry.attributes.position;
        for (let i = 0; i < rb.seg; i++) {
          const u = i / (rb.seg - 1);
          const a = t * 0.55 + rb.k * Math.PI + u * 2.4;
          const r = 0.56 + 0.08 * Math.sin(t * 0.9 + u * 5 + rb.k);
          const yTop = H * 0.98, y0 = H * (0.2 + u * 0.75) + 0.09 * Math.sin(t * 1.25 + u * 4 + rb.k * 2);
          const y = yTop - (yTop - y0) * curtain;
          const wv = 0.15 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(t * 2 + u * 6)) * curtain;
          const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
          arr.setXYZ(i * 2, x, y - wv, z);
          arr.setXYZ(i * 2 + 1, x, y + wv, z);
        }
        arr.needsUpdate = true;
        const u = rb.mesh.material.uniforms;
        u.uTime.value = t; u.uAlpha.value = (0.62 + 0.25 * this.twin) * intro * (quality.level < 1 ? 0.85 : 1);
      }
    }

    // footsteps: one decal per leg-phase zero crossing while walking
    const ww = rig.walkWeight || 0;
    const s = Math.sin((rig.legPhase || 0) * 2);
    const sign = s >= 0 ? 1 : -1;
    if (ww > 0.35 && moveV > 0.3 && sign !== this.stepSign && !rig.lifted) {
      const fp = this.footprint();
      if (fp) {
        const inv = 1 / Math.max(1e-4, Math.hypot(dx, dz));
        const sx = -dz * inv, sz = dx * inv;   // perpendicular to motion
        this.stepSide = -this.stepSide;
        fp.mesh.position.set(wp.x + sx * 0.12 * this.stepSide, wp.y + 0.02, wp.z + sz * 0.12 * this.stepSide);
        fp.mesh.rotation.y = Math.atan2(dx, dz);
        fp.life = fp.max = red ? 0.8 : 1.3;
      }
    }
    this.stepSign = sign;
    for (const fp of this.feet) {
      if (fp.life <= 0) { fp.mesh.visible = false; continue; }
      fp.life -= dt;
      const k = Math.max(0, fp.life / fp.max);
      fp.mesh.visible = true;
      fp.mesh.material.opacity = 0.85 * Math.min(1, k * 1.6) * glow;
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
    for (const rb of this.ribbons || []) { rb.mesh.geometry.dispose(); rb.mesh.material.dispose(); }
    for (const fp of this.feet) { fp.mesh.parent?.remove(fp.mesh); fp.mesh.geometry.dispose(); fp.mesh.material.dispose(); }
    this.feet = [];
  }

  // ---------------------------------------------------------------- statics
  /** Aura kind for an outfit id ('eclipse' | 'aurora' | null) — pure catalog lookup. */
  static kindFor(outfitId) {
    const k = OUTFITS[outfitId]?.aura;
    return PROFILES[k] ? k : null;
  }

  /** Mount / swap / unmount the aura that matches `outfitId` on a ChibiRig. */
  static sync(rig, outfitId, { suitUp = false } = {}) {
    if (!rig?.ROOT) return null;
    const kind = WearAura.kindFor(outfitId);
    const cur = rig._wearAura;
    if (cur && cur.kind === kind) return cur;
    if (cur) { cur.dispose(); rig._wearAura = null; }
    if (!kind) return null;
    const aura = new WearAura(rig, kind);
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
      if (best) { used.add(best); want.set(pairKey(e, best), [e, best]); pairs.push({ a: e.rig, b: best.rig, dist: bd }); }
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

// ------------------------------------------------------------------ Twin Eclipse link ribbon
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
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: PROFILES.eclipse.gold.clone() }, uB: { value: new THREE.Color(1, 0.95, 0.9) }, uC: { value: PROFILES.aurora.violet.clone() },
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
