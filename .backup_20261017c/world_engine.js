// client/js/world_engine.js — single shared WebGL canvas, 2.5D camera, input, and entity loop.
// Step 2: the meadow placeholder is replaced by the real Twin Sky-Islands village (village_plaza.js):
// grid collision (buildings + canal water, wings glide over water), +15% road speed, camera presets
// VILLAGE (36°) / VILLAGE_EDIT (42°), editor input routing and Finger Pick-Up & Drop (0.25 s hold).
import * as THREE from 'three';
import { ChibiRig, CHIBI_HEIGHT } from './chibi_rig.js';
import { PetController, YardPetController, updateNuzzles } from './pet_controller.js';
import { FxEngine } from './fx_engine.js';
import { VillagePlaza } from './village_plaza.js';
import { Mover, RemoteSmoother, MOVE } from '/shared/locomotion.js';
import { ROAD_SPEED_BOOST, FISHING, footprint } from '/shared/catalog_landmarks.js';
import { groundAt, islandAt, onBridge, dockNear, findPlaced, utcDay } from '/shared/village_rules.js';
import { getEquippedWalkFx, getTrailOffset, TRAIL_INTERVAL, shouldEmitRemoteStep, shouldEmitRemoteTrail } from '/shared/walk_fx.js';

export const CAMERA_PRESETS = {
  VILLAGE: { PITCH_DEG: 36, DIST: 24, MIN: 14, MAX: 34 },
  VILLAGE_EDIT: { PITCH_DEG: 42, DIST: 28, MIN: 16, MAX: 40 },
};
const CAMERA = { BASE_FOV: 35, FOLLOW_LAMBDA: 6.5, LOOK_AHEAD: 0.6 };
const JOY = { ZONE_X: 0.42, ZONE_Y: 0.62, RADIUS: 52 };
export const HOLD = { PICKUP_S: 0.25, EDIT_S: 0.40, TAP_PX: 8 };
const BODY_R = 0.28;                                  // chibi collision radius against grid cells

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [x, y, r] of [[70, 80, 40], [120, 60, 52], [175, 78, 40], [100, 90, 34], [150, 92, 36]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function buildSkyClouds(scene) {
  const ct = cloudTexture();
  const clouds = [];
  const rnd = mulberry(11);
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85 }));
    s.position.set(-50 + rnd() * 140, -5 - rnd() * 6, -40 + rnd() * 80);
    s.scale.set(14 + rnd() * 8, 7 + rnd() * 3, 1);
    s.userData.speed = 0.2 + rnd() * 0.3;
    scene.add(s); clouds.push(s);
  }
  return { clouds };
}

// ---------------------------------------------------------------------------
export class WorldEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.BASE_FOV, 1, 0.5, 260);
    this.preset = CAMERA_PRESETS.VILLAGE;
    this.pitch = THREE.MathUtils.degToRad(this.preset.PITCH_DEG);
    this.camDist = this.preset.DIST;
    this.camTarget = new THREE.Vector3();
    this.followDetached = false;
    this.env = buildSkyClouds(this.scene);
    this.plaza = new VillagePlaza(this);
    this.plaza.setMood('auto');
    this.fx = new FxEngine(this.scene);
    this.clock = new THREE.Clock();
    this.remotes = new Map();
    this.local = null;
    this.yardPets = [];
    this._yardKey = '';
    this.editor = null;            // GridEditor (set by main.js)
    this.editMode = false;
    this.input = { keys: new Set(), joy: null, tapTarget: null, pan: null, pinch: null };
    this.press = null;             // active long-press candidate
    this.lift = null;              // Finger Pick-Up in progress
    this.listeners = [];
    this.onLocalMove = null;       // (state, force) => void
    this.onPick = null;            // (pickData, hit) => boolean  (building / bubble / signpost tap)
    this.onPetTap = null;          // () => void (pat or claim daily pet gift)
    this.onLongPressBuilding = null;
    this.onDrop = null;            // ({ x, z, propId, targetId }) => void
    this.onDockNear = null;        // (bool) => void
    this.frame = 0; this.fps = 0; this._fpsT = 0; this._fpsN = 0; this._dockT = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  get layout() { return this.plaza.layout; }

  // Horizontal-FOV lock (Section 17.A.2) so the board/village never clips on narrow phones.
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const base = THREE.MathUtils.degToRad(CAMERA.BASE_FOV);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(base / 2) / Math.min(aspect / 0.5625, 1)));
    this.camera.updateProjectionMatrix();
  }

  setEditMode(on) {
    this.editMode = on;
    this.preset = on ? CAMERA_PRESETS.VILLAGE_EDIT : CAMERA_PRESETS.VILLAGE;
    this.camDist = THREE.MathUtils.clamp(this.preset.DIST, this.preset.MIN, this.preset.MAX);
    this.input.tapTarget = null;
    if (on && this.plaza.selfIsland) { this.camTarget.set(this.plaza.selfIsland.cx, 0, 0); this.followDetached = true; }
    else this.followDetached = false;
  }

  // ------------------------------------------------------------------ entities
  spawnLocal(profile, pos) {
    const rig = new ChibiRig({ lineage: profile.lineage, appearance: profile.appearance, name: profile.username, sub: `Lv. ${profile.level}`, wings: this.wingsFor(profile) });
    rig.setPosition(pos.x, pos.z);
    this.hookTurnPuff(rig, () => this.local?.profile?.equipped);
    this.scene.add(rig.ROOT);
    const pet = profile.equipped?.pet?.id ? new PetController(profile.equipped.pet, this.scene, this.fx) : null;
    this.local = { id: profile.id, profile, rig, pet, mover: new Mover(), x: pos.x, z: pos.z, idleFor: 0, lastSentMoving: false, lastStepSign: 0, speedMult: 1, trailTimer: 0 };
    pet?.placeNear({ x: pos.x, z: pos.z, right: true });
    rig.setEquipment(profile.equipped);
    if (profile.appearance) rig.setAppearance(profile.appearance);
    this.syncPetGiftAndYard(profile);
    this.camTarget.set(pos.x, 0, pos.z);
  }

  syncPetGiftAndYard(profile = this.local?.profile) {
    if (!profile) return;
    if (this.local) this.local.profile = profile;
    const eqPet = profile.equipped?.pet;
    const ownedEq = (profile.pets || []).find((x) => x.uid === eqPet?.uid || x.id === eqPet?.id);
    if (this.local?.pet && ownedEq) {
      const today = String(utcDay(Date.now()));
      this.local.pet.setGiftReady(ownedEq.last_gift_day !== today);
      this.local.pet.setPetConfig({ ...ownedEq, ...eqPet });
    }
    this.syncYardPets(profile);
  }

  syncYardPets(profile = this.local?.profile) {
    if (!profile || !this.layout) return;
    const eqId = profile.equipped?.pet?.id;
    const eqUid = profile.equipped?.pet?.uid;
    const unequipped = (profile.pets || []).filter((pt) => pt.uid !== eqUid && pt.id !== eqId).slice(0, 3);
    const nestHit = findPlaced(this.layout, 'nest', this.local?.x || 0, this.local?.z || 0);
    const key = JSON.stringify({
      nest: nestHit?.center || null,
      pets: unequipped.map((pt) => [pt.uid, pt.id, pt.stars, pt.visual_tier, pt.nickname]),
    });
    if (key === this._yardKey) return;
    this._yardKey = key;
    for (const yp of this.yardPets) yp.dispose(this.scene);
    this.yardPets = [];
    if (!nestHit?.center) return;
    unequipped.forEach((pt, idx) => {
      this.yardPets.push(new YardPetController(pt, this.scene, this.fx, nestHit.center, idx));
    });
  }

  /**
   * Step 3 / Step 3.5: a player's equipment or appearance changed (wardrobe / forge / pet / hair studio).
   * Updates the paper doll, hairstyle/dye, and companion pet.
   */
  applyEquipment(id, equipped, appearance = null) {
    const e = this.local?.id === id ? this.local : this.remotes.get(id);
    if (!e) return;
    if (appearance) {
      if (e === this.local) e.profile = { ...e.profile, appearance };
      else e.data = { ...e.data, appearance };
      e.rig.setAppearance(appearance);
    }
    if (!equipped) return;
    if (e === this.local) e.profile = { ...e.profile, equipped };
    else e.data = { ...e.data, equipped };
    e.rig.setEquipment(equipped);
    const petCfg = equipped.pet || null;
    const petId = petCfg?.id || null;
    if (!petId) {
      e.pet?.dispose(this.scene);
      e.pet = null;
    } else if (!e.pet || e.pet.rawId !== petId) {
      e.pet?.dispose(this.scene);
      e.pet = new PetController(petCfg, this.scene, this.fx);
      const p = e.rig.ROOT.position;
      e.pet.placeNear({ x: p.x, z: p.z, right: e.right ?? true });
    } else {
      e.pet.setPetConfig(petCfg);
    }
    if (e === this.local) {
      this._yardKey = '';
      this.syncPetGiftAndYard(e.profile);
    }
  }

  hookTurnPuff(rig, getEquipped) {
    rig.onTurn = (fromBack, toBack) => {
      const p = rig.ROOT.position;
      const equipped = getEquipped ? getEquipped() : (this.local?.rig === rig ? this.local?.profile?.equipped : null);
      const walkFx = getEquippedWalkFx(equipped);
      if (walkFx) {
        this.fx.emit(walkFx.stepCell, p.x, 0.05, p.z + 0.05, 3, {
          speed: walkFx.speed ?? 0.5,
          up: walkFx.up ?? 0.45,
          size: walkFx.size ?? 0.2,
          life: walkFx.life ?? 0.4,
          gravity: walkFx.gravity ?? 0.5,
          tint: walkFx.tint,
        });
      } else {
        this.fx.emit('fx_stardust', p.x, 0.05, p.z + 0.05, fromBack !== toBack ? 3 : 1, { speed: 0.5, up: 0.45, size: 0.2, life: 0.4, gravity: 0.5 });
      }
    };
  }

  wingsFor(p) { return p.equipped?.wings?.id || null; }
  get canFly() { return !!this.local?.profile?.equipped?.wings?.id; }

  removeLocal() {
    const L = this.local;
    if (!L) return;
    this.scene.remove(L.rig.ROOT); L.rig.dispose(); L.pet?.dispose(this.scene);
    for (const yp of this.yardPets) yp.dispose(this.scene);
    this.yardPets = [];
    this._yardKey = '';
    this.local = null;
  }

  setLocalPosition(x, z) {
    if (!this.local) return;
    this.local.x = x; this.local.z = z;
    this.local.rig.setPosition(x, z);
  }

  upsertRemote(p) {
    let r = this.remotes.get(p.id);
    if (!r) {
      const partnerTag = this.local && p.partner_id === this.local.id ? `💞 Lv. ${p.level}` : `Lv. ${p.level}`;
      const rig = new ChibiRig({ lineage: p.lineage, appearance: p.appearance, name: p.username, sub: partnerTag, wings: this.wingsFor(p) });
      this.hookTurnPuff(rig, () => this.remotes.get(p.id)?.data?.equipped);
      this.scene.add(rig.ROOT);
      const pet = p.equipped?.pet?.id ? new PetController(p.equipped.pet, this.scene, this.fx) : null;
      r = { id: p.id, data: p, rig, pet, smooth: new RemoteSmoother(p.x, p.z), idleFor: 0, right: p.right ?? true, lastStepSign: 0, trailTimer: 0 };
      pet?.placeNear({ x: p.x, z: p.z, right: r.right });
      rig.setPosition(p.x, p.z);
      rig.setEquipment(p.equipped);
      if (p.appearance) rig.setAppearance(p.appearance);
      this.remotes.set(p.id, r);
    } else if (p.appearance) {
      r.data = { ...r.data, appearance: p.appearance };
      r.rig.setAppearance(p.appearance);
    }
    r.smooth.onPacket(p);
    if (typeof p.right === 'boolean') r.right = p.right;
    return r;
  }

  /** Remote player was dropped somewhere (Finger Pick-Up): snap instead of sliding across the map. */
  teleportRemote(id, x, z) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.smooth = new RemoteSmoother(x, z);
    r.rig.setPosition(x, z);
    r.pet?.placeNear({ x, z, right: r.right });
    this.fx.emit('fx_stardust', x, 0.05, z, 6, { speed: 1, up: 0.8, size: 0.25, life: 0.5, gravity: 0.6 });
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.rig.ROOT); r.rig.dispose(); r.pet?.dispose(this.scene);
    this.remotes.delete(id);
  }

  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); }

  // ------------------------------------------------------------------ input
  bindInput() {
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this.listeners.push([t, ev, fn]); };
    on(window, 'keydown', (e) => { if (e.target.tagName === 'INPUT') return; this.input.keys.add(e.code); this.input.tapTarget = null; });
    on(window, 'keyup', (e) => this.input.keys.delete(e.code));
    on(window, 'blur', () => this.input.keys.clear());

    const joyEl = document.getElementById('joystick');
    const stick = joyEl?.querySelector('.joystick-stick');
    const base = joyEl?.querySelector('.joystick-base');
    if (joyEl) {
      on(joyEl, 'pointerdown', (e) => {
        e.stopPropagation(); joyEl.setPointerCapture(e.pointerId);
        const r = base.getBoundingClientRect();
        this.input.joy = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 };
        this.input.tapTarget = null;
        joyEl.classList.add('active');
        this.updateJoy(e, stick);
      });
      on(joyEl, 'pointermove', (e) => { if (this.input.joy?.id === e.pointerId) this.updateJoy(e, stick); });
      const end = (e) => { if (this.input.joy?.id === e.pointerId) { this.input.joy = null; stick.style.transform = ''; joyEl.classList.remove('active'); } };
      on(joyEl, 'pointerup', end); on(joyEl, 'pointercancel', end);
    }

    // Ground: tap-to-walk (<8px) vs 1-finger camera pan (>=8px), 2-finger pinch zoom (Section 21.G),
    // long-press 0.25 s on your Chibi = Finger Pick-Up, 0.40 s on a building = Edit Grid.
    const pointers = new Map();
    on(this.canvas, 'pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        this.input.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.camDist };
        this.press = null;
        return;
      }
      if (this.editMode && this.editor?.active) {
        p.editor = this.editor.pointerDown(this.raycastGround(e.clientX, e.clientY, true));
        return;
      }
      const onChibi = this.isOverLocalChibi(e.clientX, e.clientY);
      const onPet = !onChibi && this.isOverLocalPet(e.clientX, e.clientY);
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), onChibi, onPet };
    });
    on(this.canvas, 'pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.lift?.id === e.pointerId) { this.moveLift(e.clientX, e.clientY); return; }
      if (pointers.size === 2 && this.input.pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.camDist = THREE.MathUtils.clamp(this.input.pinch.dist * (this.input.pinch.d / Math.max(1, d)), this.preset.MIN, this.preset.MAX);
        p.moved = true;
        return;
      }
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) >= HOLD.TAP_PX) { p.moved = true; if (this.press?.id === e.pointerId) this.press = null; }
      if (p.editor) { this.editor.pointerMove(this.raycastGround(e.clientX, e.clientY, true)); return; }
      if (p.moved && pointers.size === 1) {
        const k = this.camDist / this.canvas.clientHeight * 1.1;
        this.camTarget.x -= dx * k; this.camTarget.z -= dy * k / Math.sin(this.pitch);
        this.followDetached = true;
      }
    });
    const up = (e) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) this.input.pinch = null;
      if (this.press?.id === e.pointerId) this.press = null;
      if (this.lift?.id === e.pointerId) { this.endLift(e.type === 'pointercancel'); return; }
      if (p?.editor) { this.editor.pointerUp(); return; }
      if (!p || p.moved || e.type === 'pointercancel' || p.consumed) return;
      if (this.editMode) return;
      if (this.isOverLocalPet(e.clientX, e.clientY) && this.onPetTap) {
        this.onPetTap();
        return;
      }
      const picked = this.plaza.pick(e.clientX, e.clientY);
      const hit = this.raycastGround(e.clientX, e.clientY);
      if (picked && this.onPick?.(picked, hit)) return;
      if (hit) { this.input.tapTarget = { x: hit.x, z: hit.z }; this.fx.emit('fx_star', hit.x, 0.1, hit.z, 3, { speed: 0.4, up: 0.6, size: 0.18, life: 0.5 }); }
    };
    this._pointers = pointers;
    on(this.canvas, 'pointerup', up); on(this.canvas, 'pointercancel', up);
    on(this.canvas, 'wheel', (e) => { e.preventDefault(); this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.08), this.preset.MIN, this.preset.MAX); }, { passive: false });
  }

  updateJoy(e, stick) {
    const j = this.input.joy;
    let dx = e.clientX - j.cx, dy = e.clientY - j.cy;
    const len = Math.hypot(dx, dy);
    if (len > JOY.RADIUS) { dx *= JOY.RADIUS / len; dy *= JOY.RADIUS / len; }
    j.x = dx / JOY.RADIUS; j.y = dy / JOY.RADIUS;
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** Ray → ground plane. `anywhere` = also return points off the islands (editor clamps itself). */
  raycastGround(cx, cy, anywhere = false) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (!(t > 0)) return null;
    const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    if (anywhere || !this.layout) return p;
    return islandAt(this.layout, p.x, p.z) || onBridge(this.layout, p.x, p.z) ? p : null;
  }

  worldToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  isOverLocalChibi(cx, cy) {
    const L = this.local;
    if (!L) return false;
    const a = this.worldToScreen(L.x, 0.1, L.z), b = this.worldToScreen(L.x, CHIBI_HEIGHT, L.z);
    const h = Math.abs(a.y - b.y);
    return Math.abs(cx - a.x) < h * 0.35 && cy < a.y + h * 0.08 && cy > b.y - h * 0.05;
  }

  isOverLocalPet(cx, cy) {
    const pet = this.local?.pet;
    if (!pet) return false;
    const ph = Math.max(0.55, (pet.height || 0.6) + 0.35);
    const a = this.worldToScreen(pet.x, 0.05, pet.z);
    const b = this.worldToScreen(pet.x, ph, pet.z);
    const h = Math.max(36, Math.abs(a.y - b.y));
    return Math.abs(cx - a.x) < h * 0.52 && cy < a.y + h * 0.15 && cy > b.y - h * 0.25;
  }

  // ------------------------------------------------------------------ Finger Pick-Up & Drop
  startLift(id, target = 'chibi') {
    const L = this.local;
    if (!L || this.lift) return;
    if (target === 'pet' && L.pet) {
      this.lift = { id, target: 'pet', x: L.pet.x, z: L.pet.z };
      this.input.tapTarget = null;
      L.pet.setLifted(true);
      this.fx.emit('fx_heart', L.pet.x, 0.9, L.pet.z, 3, { speed: 0.5, up: 0.9, size: 0.28, life: 0.8 });
      this.onLiftStart?.('pet');
      navigator.vibrate?.(15);
      return;
    }
    this.lift = { id, target: 'chibi', x: L.x, z: L.z };
    L.mover.vx = 0; L.mover.vz = 0;
    this.input.tapTarget = null;
    L.rig.setLifted(true, 0.9);
    this.fx.emit('fx_heart', L.x, 1.6, L.z, 2, { speed: 0.5, up: 0.9, size: 0.3, life: 0.8 });
    this.onLiftStart?.('chibi');
    navigator.vibrate?.(15);
  }

  moveLift(cx, cy) {
    const hit = this.raycastGround(cx, cy + 40, true);       // finger sits above the head, feet under it
    if (!hit || !this.local || !this.lift) return;
    this.lift.x = hit.x; this.lift.z = hit.z;
    if (this.lift.target === 'pet' && this.local.pet) {
      this.local.pet.follower.x = hit.x;
      this.local.pet.follower.z = hit.z;
      this.local.pet.root.position.set(hit.x, 0, hit.z);
    } else {
      this.local.x = hit.x; this.local.z = hit.z;
      this.local.rig.setPosition(hit.x, hit.z);
    }
  }

  endLift(cancel = false) {
    const L = this.local;
    const lift = this.lift;
    this.lift = null;
    if (!L || !lift) return;
    let x = lift.x, z = lift.z, propId = null;
    const g = this.layout && groundAt(this.layout, x, z, { canFly: this.canFly });

    if (lift.target === 'pet' && L.pet) {
      L.pet.setLifted(false);
      if (!cancel && g?.building) {
        propId = g.building.uid;
        const hit = findPlaced(this.layout, propId, x, z);
        if (hit) {
          x = hit.center.x;
          z = hit.center.z + 0.35;
        }
        if (['nest', 'dec_cat_cushion', 'wnd_onsen'].includes(g.building.type)) {
          L.pet.act('sleep');
          L.pet.showEmote('love');
        } else {
          L.pet.act('happy');
        }
      } else if (!g?.walkable) {
        ({ x, z } = this.nearestWalkable(x, z));
      }
      L.pet.follower.x = x;
      L.pet.follower.z = z;
      L.pet.follower.crumbs.length = 0;
      this.fx.emit('fx_heart', x, 0.35, z, 5, { speed: 0.9, up: 0.7, size: 0.24, life: 0.6 });
      this.onDrop?.({ x: +x.toFixed(3), z: +z.toFixed(3), propId, targetId: 'pet' });
      return;
    }

    L.rig.setLifted(false);
    // dropped onto a building / Wonder / decor footprint? -> interact + stand at its front step
    if (!cancel && g?.building) {
      propId = g.building.uid;
      const hit = findPlaced(this.layout, propId, x, z);
      const f = footprint(g.building.type, g.building.rot);
      z = hit.center.z + f.h / 2 + 0.35; x = hit.center.x;
    } else if (!g?.walkable) {
      ({ x, z } = this.nearestWalkable(x, z));
    }
    this.setLocalPosition(x, z);
    L.pet?.placeNear({ x, z, right: L.rig.facing.right });
    this.fx.emit('fx_stardust', x, 0.05, z, 8, { speed: 1.2, up: 0.7, size: 0.26, life: 0.5, gravity: 0.7 });
    this.onDrop?.({ x: +x.toFixed(3), z: +z.toFixed(3), propId, targetId: L.id });
  }

  nearestWalkable(x, z) {
    for (let r = 0.5; r < 12; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (groundAt(this.layout, px, pz, { canFly: this.canFly }).walkable) return { x: px, z: pz };
      }
    }
    return { x: this.local.x, z: this.local.z };
  }

  // ------------------------------------------------------------------ movement
  walkable(x, z) {
    if (!this.layout) return true;
    const fly = this.canFly;
    // body circle: centre + 4 rim samples so the chibi can't clip into a footprint corner
    for (const [ox, oz] of [[0, 0], [BODY_R, 0], [-BODY_R, 0], [0, BODY_R * 0.6], [0, -BODY_R * 0.6]]) {
      if (!groundAt(this.layout, x + ox, z + oz, { canFly: fly }).walkable) return false;
    }
    return true;
  }

  /** Combined input direction in world XZ (-Z = up the screen). */
  readInput() {
    if (this.editMode || this.lift) return { ix: 0, iz: 0 };
    const k = this.input.keys;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (this.input.joy) { ix = this.input.joy.x; iz = this.input.joy.y; }
    if (ix || iz) { this.input.tapTarget = null; return { ix, iz }; }
    const t = this.input.tapTarget;
    if (t && this.local) {
      const dx = t.x - this.local.x, dz = t.z - this.local.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { this.input.tapTarget = null; return { ix: 0, iz: 0 }; }
      const slow = Math.min(1, d / 0.6);  // ease into the target, no overshoot
      return { ix: (dx / d) * slow, iz: (dz / d) * slow };
    }
    return { ix: 0, iz: 0 };
  }

  // ------------------------------------------------------------------ loop
  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      // Step 4 scene hook: a minigame (e.g. Sky Monopoly) takes over the shared canvas; the village pauses.
      if (this.activeScene) { this.activeScene.update(dt); this.activeScene.render(); return; }
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  update(dt) {
    this.frame++;
    this._fpsT += dt; this._fpsN++;
    if (this._fpsT >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsT); this._fpsT = 0; this._fpsN = 0; }

    // long-press: 0.25 s on your Chibi or Pet = Finger Pick-Up · 0.40 s on a building = Edit Grid
    if (this.press && !this.editMode) {
      const held = (performance.now() - this.press.t) / 1000;
      if ((this.press.onChibi || this.press.onPet) && held >= HOLD.PICKUP_S) {
        const id = this.press.id;
        const target = this.press.onPet ? 'pet' : 'chibi';
        this.press = null;
        const p = this._pointers.get(id); if (p) p.consumed = true;
        this.startLift(id, target);
      } else if (!this.press.onChibi && !this.press.onPet && held >= HOLD.EDIT_S) {
        const pk = this.plaza.pick(this.press.x, this.press.y);
        const id = this.press.id; this.press = null;
        if (pk?.kind === 'building' && pk.owner === this.local?.id && this.onLongPressBuilding?.(pk)) {
          const p = this._pointers.get(id); if (p) p.consumed = true;
        }
      }
    }

    const L = this.local;
    const tint = this.plaza.moodTint;
    if (L) {
      const { ix, iz } = this.readInput();
      const here = this.layout ? groundAt(this.layout, L.x, L.z, { canFly: this.canFly }) : { road: false };
      L.speedMult = here.road ? ROAD_SPEED_BOOST : 1;             // +15% on roads & bridges
      L.mover.update(dt, ix, iz, MOVE.BASE_SPEED * L.speedMult);
      if (!this.lift) {
        let nx = L.x + L.mover.vx * dt, nz = L.z + L.mover.vz * dt;
        // wall-slide: try the full step, then each axis on its own
        if (!this.walkable(nx, nz)) {
          if (this.walkable(nx, L.z)) { nz = L.z; L.mover.vz = 0; }
          else if (this.walkable(L.x, nz)) { nx = L.x; L.mover.vx = 0; }
          else { nx = L.x; nz = L.z; L.mover.vx = 0; L.mover.vz = 0; this.input.tapTarget = null; }
        }
        L.x = nx; L.z = nz;
        L.rig.setPosition(L.x, L.z);
      }
      const speed = Math.hypot(L.mover.vx, L.mover.vz);
      const moving = speed > 0.2 && !this.lift;
      L.idleFor = moving ? 0 : L.idleFor + dt;
      L.rig.material.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
      L.rig.update(dt, { vx: this.lift ? 0 : L.mover.vx, vz: this.lift ? 0 : L.mover.vz, walkWeight: this.lift ? 0 : L.mover.walkWeight }, this.camera);

      // footstep dust on each heel strike
      const s = Math.sign(Math.sin(L.rig.legPhase * 2));
      const walkFx = getEquippedWalkFx(L.profile?.equipped);
      const refineLv = Number(L.profile?.equipped?.outfit?.refine) || 0;
      if (moving && s !== L.lastStepSign) {
        if (walkFx) {
          this.fx.emit(walkFx.stepCell, L.x, 0.06, L.z + 0.1, 2, {
            speed: walkFx.speed,
            up: walkFx.up,
            size: (walkFx.size ?? 0.28) * 1.15,
            life: walkFx.life,
            gravity: walkFx.gravity,
            tint: walkFx.tint,
          });
        } else {
          this.fx.emit('fx_stardust', L.x, 0.05, L.z + 0.1, 1, { speed: 0.35, up: 0.5, size: 0.22, life: 0.45, gravity: 0.6 });
        }
      }
      L.lastStepSign = s;

      // movement trail while walking at speed, or gentle ambient Mythic aura while idle
      if (moving && walkFx && L.rig.walkWeight > 0.6) {
        L.trailTimer = (L.trailTimer || 0) + dt;
        if (L.trailTimer >= TRAIL_INTERVAL) {
          L.trailTimer -= TRAIL_INTERVAL;
          const off = getTrailOffset(L.mover.vx, L.mover.vz, 0.15);
          this.fx.emit(walkFx.trailCell, L.x + off.x, 0.10, L.z + off.z, 1, {
            speed: (walkFx.speed ?? 0.3) * 0.45,
            up: (walkFx.up ?? 0.4) * 0.55,
            size: (walkFx.size ?? 0.26) * 0.92,
            life: (walkFx.life ?? 0.6) * 0.85,
            gravity: walkFx.gravity ?? 0.2,
            spread: 0.12,
            tint: walkFx.tint,
          });
        }
      } else {
        L.trailTimer = 0;
        if (!moving && walkFx && !this.lift) {
          L.auraTimer = (L.auraTimer || 0) + dt;
          if (L.auraTimer >= 0.55) {
            L.auraTimer -= 0.55;
            L.auraFlip = !L.auraFlip;
            const ang = Math.random() * Math.PI * 2;
            const rad = 0.18 + Math.random() * 0.14;
            const cell = L.auraFlip ? walkFx.stepCell : walkFx.trailCell;
            this.fx.emit(cell, L.x + Math.cos(ang) * rad, 0.26 + Math.random() * 0.55, L.z + Math.sin(ang) * rad, 1, {
              speed: 0.16,
              up: 0.38,
              size: (walkFx.size ?? 0.26) * 0.88,
              life: 0.85,
              gravity: -0.05,
              spread: 0.08,
              tint: walkFx.tint,
            });
            if (refineLv >= 7 && L.auraFlip) {
              this.fx.emit('fx_star', L.x - Math.cos(ang) * 0.22, 0.55 + Math.random() * 0.45, L.z - Math.sin(ang) * 0.22, 1, {
                speed: 0.14, up: 0.42, size: 0.22, life: 0.75, gravity: -0.08, tint: [1.25, 1.05, 0.45],
              });
            }
          }
        }
      }

      if (moving) this.followDetached = false;
      const f = L.rig.facing;
      const state = { x: +L.x.toFixed(3), z: +L.z.toFixed(3), vx: +L.mover.vx.toFixed(3), vz: +L.mover.vz.toFixed(3), right: f.right, back: f.back };
      if (!this.lift) {
        if (moving) { this.onLocalMove?.(state, false); L.lastSentMoving = true; }
        else if (L.lastSentMoving) { this.onLocalMove?.({ ...state, vx: 0, vz: 0 }, true); L.lastSentMoving = false; }
        else if (L.lastSentBack !== f.back || L.lastSentRight !== f.right) this.onLocalMove?.({ ...state, vx: 0, vz: 0 }, true); // idle turn-to-camera
        L.lastSentBack = f.back; L.lastSentRight = f.right;
      }

      if (this.lift?.target !== 'chibi') {
        L.pet?.update(dt, { x: L.x, z: L.z, vx: L.mover.vx, vz: L.mover.vz, speed, moving, right: f.right, idleFor: L.idleFor }, this.camera);
      }

      // spring-damped look-ahead follow cam
      if (!this.followDetached) {
        const a = 1 - Math.exp(-CAMERA.FOLLOW_LAMBDA * dt);
        this.camTarget.x += (L.x + L.mover.vx * CAMERA.LOOK_AHEAD * 0.25 - this.camTarget.x) * a;
        this.camTarget.z += (L.z + L.mover.vz * CAMERA.LOOK_AHEAD * 0.25 - this.camTarget.z) * a;
      }

      // dock proximity for the fishing HUD (4 Hz is plenty)
      this._dockT += dt;
      if (this._dockT > 0.25 && this.layout) {
        this._dockT = 0;
        this.onDockNear?.(!!dockNear(this.layout, L.x, L.z, FISHING.DOCK_REACH - 0.3));
      }
    }

    for (const r of this.remotes.values()) {
      const px = r.smooth.x, pz = r.smooth.z;
      r.smooth.update(dt);
      const vx = (r.smooth.x - px) / Math.max(dt, 1e-4), vz = (r.smooth.z - pz) / Math.max(dt, 1e-4);
      const speed = Math.hypot(vx, vz);
      const moving = speed > 0.25 && !r.rig.lifted;
      r.idleFor = moving ? 0 : r.idleFor + dt;
      r.rig.setPosition(r.smooth.x, r.smooth.z);
      r.rig.material.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
      // remote facing follows the sender's authoritative facing when idle (keeps idle turn-to-camera in sync)
      r.rig.update(dt, moving ? { vx, vz } : { vx: 0, vz: 0, walkWeight: 0 }, this.camera);
      if (!moving && r.rig.facing.right !== r.right && !r.rig.facing.turning) r.rig.facing.set(r.right, r.rig.facing.back);

      const rWalkFx = getEquippedWalkFx(r.data?.equipped);
      const rRefineLv = Number(r.data?.equipped?.outfit?.refine) || 0;

      // remote footstep dust on each heel strike
      const rs = Math.sign(Math.sin(r.rig.legPhase * 2));
      if (moving && rs !== r.lastStepSign) {
        if (shouldEmitRemoteStep(this.fx.activeCount)) {
          if (rWalkFx) {
            this.fx.emit(rWalkFx.stepCell, r.smooth.x, 0.06, r.smooth.z + 0.1, 1, {
              speed: rWalkFx.speed,
              up: rWalkFx.up,
              size: (rWalkFx.size ?? 0.28) * 1.15,
              life: rWalkFx.life,
              gravity: rWalkFx.gravity,
              tint: rWalkFx.tint,
            });
          } else {
            this.fx.emit('fx_stardust', r.smooth.x, 0.05, r.smooth.z + 0.1, 1, { speed: 0.35, up: 0.5, size: 0.22, life: 0.45, gravity: 0.6 });
          }
        }
      }
      r.lastStepSign = rs;

      // remote movement trail or gentle ambient Mythic aura while idle
      if (moving && rWalkFx && r.rig.walkWeight > 0.6) {
        r.trailTimer = (r.trailTimer || 0) + dt;
        if (r.trailTimer >= TRAIL_INTERVAL) {
          r.trailTimer -= TRAIL_INTERVAL;
          if (shouldEmitRemoteTrail(this.fx.activeCount)) {
            const off = getTrailOffset(vx, vz, 0.15);
            this.fx.emit(rWalkFx.trailCell, r.smooth.x + off.x, 0.10, r.smooth.z + off.z, 1, {
              speed: (rWalkFx.speed ?? 0.3) * 0.45,
              up: (rWalkFx.up ?? 0.4) * 0.55,
              size: (rWalkFx.size ?? 0.26) * 0.92,
              life: (rWalkFx.life ?? 0.6) * 0.85,
              gravity: rWalkFx.gravity ?? 0.2,
              spread: 0.12,
              tint: rWalkFx.tint,
            });
          }
        }
      } else {
        r.trailTimer = 0;
        if (!moving && rWalkFx && !r.rig.lifted) {
          r.auraTimer = (r.auraTimer || 0) + dt;
          if (r.auraTimer >= 0.65) {
            r.auraTimer -= 0.65;
            if (shouldEmitRemoteTrail(this.fx.activeCount)) {
              r.auraFlip = !r.auraFlip;
              const ang = Math.random() * Math.PI * 2;
              const rad = 0.18 + Math.random() * 0.14;
              const cell = r.auraFlip ? rWalkFx.stepCell : rWalkFx.trailCell;
              this.fx.emit(cell, r.smooth.x + Math.cos(ang) * rad, 0.26 + Math.random() * 0.55, r.smooth.z + Math.sin(ang) * rad, 1, {
                speed: 0.16,
                up: 0.38,
                size: (rWalkFx.size ?? 0.26) * 0.88,
                life: 0.85,
                gravity: -0.05,
                spread: 0.08,
                tint: rWalkFx.tint,
              });
              if (rRefineLv >= 7 && r.auraFlip) {
                this.fx.emit('fx_star', r.smooth.x - Math.cos(ang) * 0.22, 0.55 + Math.random() * 0.45, r.smooth.z - Math.sin(ang) * 0.22, 1, {
                  speed: 0.14, up: 0.42, size: 0.22, life: 0.75, gravity: -0.08, tint: [1.25, 1.05, 0.45],
                });
              }
            }
          }
        }
      }

      r.pet?.update(dt, { x: r.smooth.x, z: r.smooth.z, vx, vz, speed, moving, right: r.rig.facing.right, idleFor: r.idleFor }, this.camera);
    }

    for (const yp of this.yardPets) {
      yp.update(dt, this.camera);
    }

    // pet-to-pet nuzzles between idle neighbours
    const entries = [];
    if (L?.pet && !this.lift) entries.push({ pet: L.pet, owner: { x: L.x, z: L.z, moving: L.idleFor === 0, idleFor: L.idleFor } });
    for (const r of this.remotes.values()) if (r.pet) entries.push({ pet: r.pet, owner: { x: r.smooth.x, z: r.smooth.z, moving: r.idleFor === 0, idleFor: r.idleFor } });
    updateNuzzles(entries);

    // camera rig (smoothly blends between VILLAGE 36° and VILLAGE_EDIT 42°)
    const targetPitch = THREE.MathUtils.degToRad(this.preset.PITCH_DEG);
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-8 * dt));
    this.camera.position.set(this.camTarget.x, this.camTarget.y + Math.sin(this.pitch) * this.camDist, this.camTarget.z + Math.cos(this.pitch) * this.camDist);
    this.camera.lookAt(this.camTarget.x, CHIBI_HEIGHT * 0.4, this.camTarget.z);

    for (const c of this.env.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 95) c.position.x = -55; }
    this.plaza.update(dt, this.camera, this.pitch);
    this.fx.update(dt);
  }

  /** Read-only snapshot for the debug readout and automated QA. */
  debugState() {
    const L = this.local;
    if (!L) return null;
    const f = L.rig.facing;
    const dir = `${f.back ? 'N' : 'S'}${f.right ? 'E' : 'W'}`;
    const g = this.layout ? groundAt(this.layout, L.x, L.z, { canFly: this.canFly }) : {};
    return {
      fps: this.fps,
      x: +L.x.toFixed(2), z: +L.z.toFixed(2),
      facing: dir, view: f.back ? 'Back-3/4' : 'Front-3/4', right: f.right, back: f.back, shownBack: L.rig.shownView === 'back',
      shownView: L.rig.shownView, mirror: L.rig.material.uniforms.uMirror.value, hipScaleX: +L.rig.HIP.scale.x.toFixed(3), hasSide: L.rig.hasSide,
      walkWeight: +L.mover.walkWeight.toFixed(2),
      wingsZ: +L.rig.WINGS.position.z.toFixed(2),
      petDist: L.pet ? +Math.hypot(L.pet.x - L.x, L.pet.z - L.z).toFixed(2) : null,
      petBack: L.pet ? L.pet.facing.back : null,
      petNuzzle: !!L.pet?.nuzzle,
      onRoad: !!g.road, speedMult: L.speedMult, lifted: !!this.lift, editMode: this.editMode,
      pitchDeg: +THREE.MathUtils.radToDeg(this.pitch).toFixed(1), camDist: +this.camDist.toFixed(1),
      islands: this.layout?.islands.map((i) => ({ owner: i.owner, cx: i.cx, S: i.S, buildings: i.village.buildings.length })) || [],
      bridge: !!this.layout?.bridge, mood: this.plaza.mood,
      remotes: [...this.remotes.values()].map((r) => ({ id: r.id, x: +r.smooth.x.toFixed(2), z: +r.smooth.z.toFixed(2), back: r.rig.facing.back, right: r.rig.facing.right })),
    };
  }
}
