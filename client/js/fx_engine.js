// client/js/fx_engine.js — one 4×4 particle atlas, one instanced draw call (Section 3 "5-Hook Lego FX Composer").
// Step 1 uses it for footstep dust, pet teleport poofs, hearts and notes; costume hooks plug in at Step 3.
//
// Perf contract (Dopamine patch): fixed pool (no allocations after construction, none per frame), a soft
// active cap that the auto quality tier can halve (`setQuality`), and only the live slice of each instance
// attribute is uploaded to the GPU each frame.
import * as THREE from 'three';
import { atlasInfo } from './assets.js';

const MAX = 384;

const vertexShader = /* glsl */`
  attribute vec3 aOffset;
  attribute float aSize;
  attribute float aCell;
  attribute float aAlpha;
  attribute float aRot;
  attribute vec3 aTint;
  uniform float uCols;
  uniform float uRows;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    float c = mod(aCell, uCols), r = floor(aCell / uCols);
    vUv = vec2((c + uv.x) / uCols, 1.0 - (r + 1.0 - uv.y) / uRows);
    vAlpha = aAlpha;
    vTint = aTint;
    float cs = cos(aRot), sn = sin(aRot);
    vec2 q = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y) * aSize;
    vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
    mv.xy += q;                                   // camera-facing billboard
    gl_Position = projectionMatrix * mv;
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 c = texture2D(map, vUv);
    c.rgb *= vTint;
    c.a *= vAlpha;
    if (c.a < 0.02) discard;
    gl_FragColor = c;
    #include <colorspace_fragment>
  }
`;

const WHITE = [1, 1, 1];

export class FxEngine {
  constructor(scene) {
    this._active = 0;
    this.quality = 1;          // 1 = full, 0.5 = low tier (counts halved, cap halved)
    this.cap = MAX;
    this.pool = Array.from({ length: MAX }, () => ({
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, max: 0, size: 0,
      cell: 0, rot: 0, vr: 0, g: 0, drag: 0,
      tr: 1, tg: 1, tb: 1,
    }));
    this.particles = this.pool;
    this.cells = {};
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    const aTint = mk(3);
    aTint.array.fill(1);
    this.attr = { aOffset: mk(3), aSize: mk(1), aCell: mk(1), aAlpha: mk(1), aRot: mk(1), aTint };
    this._attrList = Object.values(this.attr);      // cached: no Object.values() per frame
    for (const [k, a] of Object.entries(this.attr)) geo.setAttribute(k, a);
    geo.instanceCount = 0;
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uCols: { value: 4 }, uRows: { value: 4 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.scene = scene;
    scene.add(this.mesh);
    this._lastUploaded = 0;
    this.ready = this.load();
  }

  get activeCount() {
    return this._active;
  }

  /** Auto quality tier hook: q=1 full, q=0.5 halves every burst and the live particle cap. */
  setQuality(q = 1) {
    this.quality = Math.max(0.25, Math.min(1, q));
    this.cap = Math.round(MAX * this.quality);
  }

  async load() {
    const info = atlasInfo('particle_atlas');
    if (!info) return; // no atlas yet: emit() becomes a no-op instead of crashing
    const tex = await new Promise((res) => new THREE.TextureLoader().load(`/assets/${info.file}`, res, undefined, () => res(null)));
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.material.uniforms.map.value = tex;
    this.material.uniforms.uCols.value = info.cols;
    this.material.uniforms.uRows.value = info.rows;
    info.cells.forEach((name, i) => { this.cells[name] = i; });
  }

  _scaled(count) {
    if (count <= 0) return 0;
    return Math.max(1, Math.round(count * this.quality));
  }

  /**
   * emit(cellName, x, y, z, count, opts) → number of particles spawned
   * opts: { speed, up, size, life, spread, gravity, tint, drag, delay, stagger, ring }
   *   delay/stagger: seconds before the (k-th) particle appears (it sits invisible until then)
   *   ring: emit on a flat outward ring (shockwave sparkles) instead of a random cone
   */
  emit(cell, x, y, z, count = 1, o = {}) {
    const idx = this.cells[cell];
    if (idx === undefined) return 0;
    const tint = o.tint || WHITE;
    const tr = tint[0] ?? 1, tg = tint[1] ?? 1, tb = tint[2] ?? 1;
    const n = this._scaled(count);
    const spread = o.spread ?? 0.25, speed = o.speed ?? 0.9, up = o.up ?? 1.1;
    const life = o.life ?? 0.9, size = o.size ?? 0.28, g = o.gravity ?? 1.2;
    const delay = o.delay ?? 0, stagger = o.stagger ?? 0;
    let made = 0;
    for (let i = 0; i < n && this._active < this.cap; i++) {
      const a = o.ring ? (i / n) * Math.PI * 2 + Math.random() * 0.2 : Math.random() * Math.PI * 2;
      const sp = speed * (o.ring ? 0.9 + Math.random() * 0.2 : 0.5 + Math.random() * 0.5);
      const p = this.pool[this._active++];
      p.x = x + (Math.random() - 0.5) * spread;
      p.y = y;
      p.z = z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(a) * sp;
      p.vy = o.ring ? up * (0.8 + Math.random() * 0.4) : up * (0.6 + Math.random() * 0.6);
      p.vz = Math.sin(a) * sp * (o.ring ? 1 : 0.6);
      p.life = -(delay + stagger * i);
      p.max = life * (0.75 + Math.random() * 0.5);
      p.size = size * (0.7 + Math.random() * 0.6);
      p.cell = idx;
      p.rot = Math.random() * 6.28;
      p.vr = (Math.random() - 0.5) * 3;
      p.g = g;
      p.drag = o.drag ?? 0;
      p.tr = tr; p.tg = tg; p.tb = tb;
      made++;
    }
    return made;
  }

  /**
   * Ballistic stream from A to B: every particle lands on (tx,ty,tz) after `time` seconds (coin streams,
   * diamond trails, gold rain). opts: { time, arc (apex height), size, tint, stagger, jitter, gravity }
   */
  emitTo(cell, x, y, z, tx, ty, tz, count = 6, o = {}) {
    const idx = this.cells[cell];
    if (idx === undefined) return 0;
    const tint = o.tint || WHITE;
    const n = this._scaled(count);
    const T = o.time ?? 0.6, g = o.gravity ?? 9, jit = o.jitter ?? 0.25;
    const arc = o.arc ?? 1.2, stagger = o.stagger ?? 0.05, size = o.size ?? 0.3;
    let made = 0;
    for (let i = 0; i < n && this._active < this.cap; i++) {
      const p = this.pool[this._active++];
      const t = T * (0.9 + Math.random() * 0.2);
      p.x = x + (Math.random() - 0.5) * jit; p.y = y; p.z = z + (Math.random() - 0.5) * jit;
      const ex = tx + (Math.random() - 0.5) * jit * 0.6, ez = tz + (Math.random() - 0.5) * jit * 0.6;
      // apex lift on top of the straight ballistic solution, then solve vy so we hit ty at time t
      const gg = g + (8 * arc) / (t * t);
      p.vx = (ex - p.x) / t;
      p.vz = (ez - p.z) / t;
      p.vy = (ty - p.y + 0.5 * gg * t * t) / t;
      p.g = gg;
      p.drag = 0;
      p.life = -stagger * i;
      p.max = t;
      p.size = size * (0.8 + Math.random() * 0.4);
      p.cell = idx;
      p.rot = Math.random() * 6.28;
      p.vr = (Math.random() - 0.5) * 8;
      p.tr = tint[0] ?? 1; p.tg = tint[1] ?? 1; p.tb = tint[2] ?? 1;
      made++;
    }
    return made;
  }

  update(dt) {
    const A = this.attr;
    let i = 0;
    while (i < this._active) {
      const p = this.pool[i];
      p.life += dt;
      if (p.life >= p.max) {
        this._active--;
        if (i < this._active) {
          const last = this.pool[this._active];
          this.pool[i] = last;
          this.pool[this._active] = p;
        }
        continue;
      }
      if (p.life < 0) {                         // delayed particle: parked & invisible
        A.aSize.setX(i, 0); A.aAlpha.setX(i, 0);
        A.aOffset.setXYZ(i, p.x, p.y, p.z);
        i++;
        continue;
      }
      p.vy -= p.g * dt;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vz *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      const k = p.life / p.max;
      A.aOffset.setXYZ(i, p.x, Math.max(0.02, p.y), p.z);
      A.aSize.setX(i, p.size * (k < 0.15 ? k / 0.15 : 1));
      A.aCell.setX(i, p.cell);
      A.aAlpha.setX(i, 1 - k * k);
      A.aRot.setX(i, p.rot);
      A.aTint.setXYZ(i, p.tr, p.tg, p.tb);
      i++;
    }
    this.geo.instanceCount = this._active;
    // upload only the live slice (nothing at all once the pool has been idle for a frame)
    if (this._active || this._lastUploaded) {
      const n = this._active;
      for (let j = 0; j < this._attrList.length; j++) {
        const a = this._attrList[j];
        if (a.clearUpdateRanges) { a.clearUpdateRanges(); if (n) a.addUpdateRange(0, n * a.itemSize); }
        a.needsUpdate = true;
      }
    }
    this._lastUploaded = this._active;
  }

  dispose() {
    this.scene?.remove(this.mesh);
    this.geo.dispose();
    this.material.uniforms.map.value?.dispose?.();
    this.material.dispose();
  }
}
