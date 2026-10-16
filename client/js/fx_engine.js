// client/js/fx_engine.js — one 4×4 particle atlas, one instanced draw call (Section 3 "5-Hook Lego FX Composer").
// Step 1 uses it for footstep dust, pet teleport poofs, hearts and notes; costume hooks plug in at Step 3.
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

export class FxEngine {
  constructor(scene) {
    this._active = 0;
    this.pool = Array.from({ length: MAX }, () => ({
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, max: 0, size: 0,
      cell: 0, rot: 0, vr: 0, g: 0,
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
    scene.add(this.mesh);
    this.ready = this.load();
  }

  get activeCount() {
    return this._active;
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

  /**
   * emit(cellName, x, y, z, count, opts)
   * opts: { speed, up, size, life, spread, gravity, tint }
   */
  emit(cell, x, y, z, count = 1, o = {}) {
    const idx = this.cells[cell];
    if (idx === undefined) return;
    const tint = o.tint || [1, 1, 1];
    const tr = tint[0] ?? 1, tg = tint[1] ?? 1, tb = tint[2] ?? 1;
    for (let i = 0; i < count && this._active < MAX; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 0.9) * (0.5 + Math.random() * 0.5);
      const p = this.pool[this._active++];
      p.x = x + (Math.random() - 0.5) * (o.spread ?? 0.25);
      p.y = y;
      p.z = z + (Math.random() - 0.5) * (o.spread ?? 0.25);
      p.vx = Math.cos(a) * sp;
      p.vy = (o.up ?? 1.1) * (0.6 + Math.random() * 0.6);
      p.vz = Math.sin(a) * sp * 0.6;
      p.life = 0;
      p.max = (o.life ?? 0.9) * (0.75 + Math.random() * 0.5);
      p.size = (o.size ?? 0.28) * (0.7 + Math.random() * 0.6);
      p.cell = idx;
      p.rot = Math.random() * 6.28;
      p.vr = (Math.random() - 0.5) * 3;
      p.g = o.gravity ?? 1.2;
      p.tr = tr;
      p.tg = tg;
      p.tb = tb;
    }
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
      p.vy -= p.g * dt;
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
    for (const a of Object.values(A)) a.needsUpdate = true;
  }
}
