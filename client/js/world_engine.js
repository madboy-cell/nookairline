// client/js/world_engine.js — single shared WebGL canvas, 2.5D camera, input, and entity loop.
// Step 2: the meadow placeholder is replaced by the real Twin Sky-Islands village (village_plaza.js):
// grid collision (buildings + canal water, wings glide over water), +15% road speed, camera presets
// VILLAGE (36°) / VILLAGE_EDIT (42°), editor input routing and Finger Pick-Up & Drop (0.25 s hold).
import * as THREE from 'three';
import { ChibiRig, CHIBI_HEIGHT } from './chibi_rig.js?v=cd47';
import { PetController, YardPetController, updateNuzzles } from './pet_controller.js';
import { FxEngine } from './fx_engine.js';
import { VillagePlaza } from './village_plaza.js?v=tos4';
import { loadSprite } from './assets.js';
import { Mover, RemoteSmoother, MOVE, damp } from '/shared/locomotion.js';
import { ROAD_SPEED_BOOST, FISHING, footprint } from '/shared/catalog_landmarks.js';
import { groundAt, islandAt, onBridge, dockNear, findPlaced, utcDay, clampToArea, isWalkablePos, nearestWalkablePos, findWalkPath } from '/shared/village_rules.js';
import { getEquippedWalkFx, getTrailOffset, TRAIL_INTERVAL, shouldEmitRemoteStep, shouldEmitRemoteTrail } from '/shared/walk_fx.js';

export const CAMERA_PRESETS = {
  VILLAGE: { PITCH_DEG: 36, DIST: 24, MIN: 14, MAX: 34 },
  VILLAGE_EDIT: { PITCH_DEG: 42, DIST: 28, MIN: 16, MAX: 40 },
  SKY_FRONTIER: { PITCH_DEG: 38, DIST: 28.5, MIN: 18, MAX: 40 },
};
const CAMERA = { BASE_FOV: 35, FOLLOW_LAMBDA: 6.5, LOOK_AHEAD: 0.6 };
const JOY = { ZONE_X: 0.42, ZONE_Y: 0.62, RADIUS: 52 };
export const HOLD = { PICKUP_S: 0.25, EDIT_S: 0.40, TAP_PX: 14 };
const BODY_R = 0.28;                                  // chibi collision radius against grid cells

const _projVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndcVec2 = new THREE.Vector2();
const _frontierSkyCache = new Map();

function frontierSkyTexture(regionId = 'meadow') {
  const key = (regionId === 'hollow' || regionId === 'reef' || regionId === 'caldera') ? regionId : 'meadow';
  if (_frontierSkyCache.has(key)) return _frontierSkyCache.get(key);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (key === 'hollow') {
    grad.addColorStop(0.0, '#070D1B');
    grad.addColorStop(0.45, '#10203B');
    grad.addColorStop(0.80, '#18344B');
    grad.addColorStop(1.0, '#22475E');
  } else if (key === 'reef') {
    grad.addColorStop(0.0, '#72B6EA');
    grad.addColorStop(0.42, '#BAE2FB');
    grad.addColorStop(0.76, '#FFE3EE');
    grad.addColorStop(1.0, '#FFF4E6');
  } else if (key === 'caldera') {
    grad.addColorStop(0.0, '#0E091A');
    grad.addColorStop(0.42, '#241433');
    grad.addColorStop(0.76, '#52232B');
    grad.addColorStop(1.0, '#8A3E24');
  } else {
    grad.addColorStop(0.0, '#5AA5E6');
    grad.addColorStop(0.48, '#9CD5FA');
    grad.addColorStop(0.82, '#E8F5FF');
    grad.addColorStop(1.0, '#FFF2D6');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _frontierSkyCache.set(key, t);
  return t;
}

let _coupleCircleTex = null;
function coupleMagicCircleTexture() {
  if (_coupleCircleTex) return _coupleCircleTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const cx = 256, cy = 256;
  const grad = g.createRadialGradient(cx, cy, 18, cx, cy, 240);
  grad.addColorStop(0, 'rgba(255, 232, 165, 0.55)');
  grad.addColorStop(0.55, 'rgba(255, 182, 210, 0.38)');
  grad.addColorStop(0.88, 'rgba(255, 218, 120, 0.65)');
  grad.addColorStop(1, 'rgba(255, 218, 120, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 240, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = 'rgba(255, 226, 132, 0.92)';
  g.lineWidth = 5;
  for (const r of [218, 196, 146, 86]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  // 8-point star geometry inside the magic circle
  g.strokeStyle = 'rgba(255, 240, 175, 0.78)';
  g.lineWidth = 3.5;
  for (let k = 0; k < 2; k++) {
    g.save();
    g.translate(cx, cy);
    g.rotate((k * Math.PI) / 4);
    g.strokeRect(-102, -102, 204, 204);
    g.restore();
  }
  // Decorative rune ticks around the outer band
  g.fillStyle = 'rgba(255, 238, 168, 0.95)';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rx = cx + Math.cos(a) * 171;
    const ry = cy + Math.sin(a) * 171;
    g.beginPath();
    g.arc(rx, ry, i % 2 === 0 ? 7 : 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _coupleCircleTex = t;
  return t;
}

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
    const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
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
    this.input = { keys: new Set(), joy: null, tapTarget: null, path: null, pan: null, pinch: null };
    this.press = null;             // active long-press candidate
    this.lift = null;              // Finger Pick-Up in progress
    this.listeners = [];
    this.onLocalMove = null;       // (state, force) => void
    this.onPick = null;            // (pickData, hit) => boolean  (building / bubble / signpost tap)
    this.onPetTap = null;          // () => void (pat or claim daily pet gift)
    this.onPartnerTap = null;      // (remoteEntity) => void (tap on bound partner chibi)
    this.onPartnerProximity = null;// ({ near, dist, partner }) => void
    this.coupleStage = null;       // active synchronized 2-player couple interaction stage
    this._partnerProxT = 0;
    this.onLongPressBuilding = null;
    this.onDrop = null;            // ({ x, z, propId, targetId }) => void
    this.onDockNear = null;        // (bool) => void
    this.townHallScene = null;     // TownHallScene (if townhall active)
    this.nookMuseumScene = null;   // NookMuseumScene (if museum active)
    this.onLandmarksCheck = null;  // (x, z) => void (landmarks trigger check hook)
    this._townhallMode = false;
    this._townhallLayout = null;
    this._museumMode = false;
    this._museumLayout = null;
    this.zoneSeq = 1;
    this._reconcileTarget = null;
    this._localDash = null;
    this.frame = 0; this.fps = 0; this._fpsT = 0; this._fpsN = 0; this._dockT = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  setZoneSeq(seq) {
    if (Number.isFinite(seq) && seq > 0) this.zoneSeq = seq;
    this._reconcileTarget = null;
  }

  reconcileServerPosition(x, z, zoneSeq = null) {
    if (this.moonDefenseUI?.active || this.cloudDashUI?.active) return;
    if (zoneSeq != null && this.zoneSeq && Number(zoneSeq) !== Number(this.zoneSeq)) return;
    if (!this.local || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const err = Math.hypot(x - this.local.x, z - this.local.z);
    if (err <= 0.08) return;
    if (err >= 1.8) {
      this.setLocalPosition(x, z);
      this._reconcileTarget = null;
    } else {
      this._reconcileTarget = { x, z, t: 0.18 };
    }
  }

  getInstanceKind() {
    if (this._frontierMode) return 'sky_frontier';
    if (this._museumMode || this.layout?.kind === 'museum') return 'museum';
    if (this._townhallMode || this.layout?.kind === 'townhall') return 'townhall';
    return this.layout?.kind || 'village';
  }

  /** "Scene" kinds own their own bounds/picking and must never reach village-layout helpers. */
  isOpen36Kind() {
    const k = this.getInstanceKind();
    return k === 'townhall' || k === 'museum' || k === 'sky_frontier';
  }

  /** Sky Frontier (Master Plan v2 §2): the active frontier scene, or null. */
  get activeFrontier() {
    return this._frontierMode && this.frontierScene ? this.frontierScene : null;
  }

  setFrontierMode(active, layout = null) {
    const wasFrontier = Boolean(this._frontierMode);
    this._frontierMode = !!active;
    this.clearMoveState();
    if (active) {
      this.preset = CAMERA_PRESETS.SKY_FRONTIER;
      if (!wasFrontier) {
        this.camDist = this.preset.DIST;
      } else {
        this.camDist = THREE.MathUtils.clamp(this.camDist, this.preset.MIN, this.preset.MAX);
      }
      this._townhallMode = false; this._townhallLayout = null;
      this._museumMode = false; this._museumLayout = null;
      if (this.townHallScene) this.townHallScene.setActive(false);
      if (this.nookMuseumScene) this.nookMuseumScene.setActive(false);
      if (this.plaza?.root) this.plaza.root.visible = false;
      for (const yp of this.yardPets) yp.dispose(this.scene);
      this.yardPets = [];
      this._frontierLayout = layout || { kind: 'sky_frontier', halfSize: 36, regionId: 'meadow' };
      const regId = this._frontierLayout.regionId || 'meadow';
      this.scene.background = frontierSkyTexture(regId);
      this.scene.fog = regId === 'hollow'
        ? new THREE.FogExp2(0x0E1D33, 0.0068)
        : regId === 'caldera'
          ? new THREE.FogExp2(0x221226, 0.0056)
          : regId === 'reef'
            ? new THREE.FogExp2(0xFFEBF2, 0.0034)
            : new THREE.FogExp2(0xE2F0FF, 0.0036);
      const showClouds = !(this._frontierMode && (regId === 'hollow' || regId === 'caldera'));
      for (const c of this.env?.clouds || []) c.visible = showClouds;
      this._frontierSettleT = 1.15;
      this.frontierScene?.enter?.(this._frontierLayout);
    } else {
      this._frontierLayout = null;
      this._frontierSettleT = 0;
      this.scene.fog = null;
      this.preset = this.editMode ? CAMERA_PRESETS.VILLAGE_EDIT : CAMERA_PRESETS.VILLAGE;
      if (wasFrontier) {
        this.camDist = THREE.MathUtils.clamp(this.preset.DIST, this.preset.MIN, this.preset.MAX);
      }
      this.frontierScene?.exit?.();
      for (const c of this.env?.clouds || []) c.visible = true;
      if (!this._townhallMode && !this._museumMode) {
        if (this.plaza?.root) this.plaza.root.visible = true;
        this.plaza?.setMood?.(this.plaza.mood || 'auto');
        if (this.local?.profile) this.syncYardPets(this.local.profile);
      }
    }
  }

  addCameraShake(intensity = 0.08, dur = 0.14) {
    const prev = this._camShake;
    if (prev && prev.dur - prev.t > 0 && prev.intensity > intensity) return;
    this._camShake = { intensity: Math.min(0.32, intensity), dur: Math.max(0.05, dur), t: 0 };
  }

  walkTo(x, z) {
    if (this.moonDefenseUI?.active) {
      const safe = this.nearestWalkable(x, z);
      x = safe.x;
      z = safe.z;
      this.input.path = null;
      this.input.tapTarget = { x, z };
      this.followDetached = false;
      this.fx.emit('fx_star', x, 0.1, z, 3, { speed: 0.4, up: 0.6, size: 0.18, life: 0.5 });
      return;
    }
    if (this.isOpen36Kind()) {
      const safe = this.nearestWalkable(x, z);
      x = safe.x;
      z = safe.z;
      this.input.path = null;
      this.input.tapTarget = { x, z };
    } else if (this.layout) {
      const cl = clampToArea(this.layout, x, z);
      if (this.local) {
        const waypoints = findWalkPath(this.layout, this.local.x, this.local.z, cl.x, cl.z, {
          canFly: this.canFly,
          radius: BODY_R,
        });
        this.input.path = waypoints.length > 1 ? waypoints.slice(1) : null;
        this.input.tapTarget = waypoints[0] || { x: cl.x, z: cl.z };
        const finalPt = waypoints[waypoints.length - 1] || this.input.tapTarget;
        x = finalPt.x;
        z = finalPt.z;
      } else {
        this.input.path = null;
        this.input.tapTarget = { x: cl.x, z: cl.z };
      }
    } else {
      this.input.path = null;
      this.input.tapTarget = { x, z };
    }
    this.fx.emit('fx_star', x, 0.1, z, 3, { speed: 0.4, up: 0.6, size: 0.18, life: 0.5 });
  }

  checkLandmarksTrigger(x, z) {
    if (x == null && this.local) { x = this.local.x; z = this.local.z; }
    if (this.getInstanceKind() === 'museum' && this.nookMuseumScene) {
      return this.nookMuseumScene.checkTrigger(x, z);
    }
    return this.onLandmarksCheck ? this.onLandmarksCheck(x, z) : null;
  }

  clearMoveState() {
    this._reconcileTarget = null;
    this._localDash = null;
    if (this.input) {
      this.input.tapTarget = null;
      this.input.path = null;
    }
    const L = this.local;
    if (L) {
      if (L.rig?.billboard && !this.lift && !this.coupleStage?.active) {
        L.rig.billboard.position.y = 0;
      }
      if (L.mover) {
        L.mover.vx = 0;
        L.mover.vz = 0;
        L.mover.walkWeight = 0;
      }
      L.animVx = 0;
      L.animVz = 0;
      L.stuckTimer = 0;
      L.lastTapRef = null;
    }
  }

  setMuseumMode(active, layout = null) {
    this._museumMode = !!active;
    this.clearMoveState();
    if (active) {
      if (this._frontierMode) this.setFrontierMode(false);
      this._townhallMode = false;
      this._townhallLayout = null;
      if (this.townHallScene) this.townHallScene.setActive(false);
      this._museumLayout = layout || { kind: 'museum', size: 36 };
      if (this.plaza?.root) this.plaza.root.visible = false;
      for (const yp of this.yardPets) yp.dispose(this.scene);
      this.yardPets = [];
      for (const c of this.env?.clouds || []) c.visible = !layout?.portalId;
      if (this.nookMuseumScene) {
        this.nookMuseumScene.setActive(true);
        const targetPortal = layout?.portalId || null;
        if (targetPortal) {
          if (this.nookMuseumScene.currentPortalId !== targetPortal) {
            this.nookMuseumScene.enterPortal(targetPortal, { fromServer: true });
          }
        } else if (this.nookMuseumScene.currentPortalId) {
          this.nookMuseumScene.exitPortalToHall({ fromServer: true });
        }
      }
    } else {
      this._museumLayout = null;
      if (this.nookMuseumScene) this.nookMuseumScene.setActive(false);
      for (const c of this.env?.clouds || []) c.visible = true;
      if (!this._townhallMode) {
        if (this.plaza?.root) this.plaza.root.visible = true;
        if (this.local?.profile) this.syncYardPets(this.local.profile);
      }
    }
  }

  setTownHallMode(active, layout = null) {
    this._townhallMode = !!active;
    this.clearMoveState();
    if (active) {
      if (this._frontierMode) this.setFrontierMode(false);
      this._museumMode = false;
      this._museumLayout = null;
      if (this.nookMuseumScene) this.nookMuseumScene.setActive(false);
      this._townhallLayout = layout || { kind: 'townhall', size: 36 };
      if (this.townHallScene) this.townHallScene.setActive(true);
      if (this.plaza?.root) this.plaza.root.visible = false;
      for (const yp of this.yardPets) yp.dispose(this.scene);
      this.yardPets = [];
    } else {
      this._townhallLayout = null;
      if (this.townHallScene) this.townHallScene.setActive(false);
      if (!this._museumMode) {
        if (this.plaza?.root) this.plaza.root.visible = true;
        if (this.local?.profile) this.syncYardPets(this.local.profile);
      }
    }
  }

  get layout() {
    if (this._frontierMode) return this._frontierLayout || { kind: 'sky_frontier', halfSize: 36 };
    if (this._museumMode || this._museumLayout) return this._museumLayout || { kind: 'museum', size: 36 };
    if (this._townhallMode || this._townhallLayout) return this._townhallLayout || { kind: 'townhall', size: 36 };
    return this.plaza.layout;
  }

  // Horizontal-FOV lock (Section 17.A.2) so the board/village never clips on narrow phones.
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this._canvasRect = this.canvas.getBoundingClientRect();
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
    if (on && this.plaza.selfIsland) {
      this.camTarget.set(this.plaza.selfIsland.cx, 0, 0);
      this.followDetached = true;
    } else {
      this.followDetached = false;
      const L = this.local;
      if (L && this.layout && !this.isOpen36Kind() && !this.walkable(L.x, L.z)) {
        const safe = this.nearestWalkable(L.x, L.z);
        L.x = safe.x; L.z = safe.z;
        L.rig.setPosition(L.x, L.z);
        L.pet?.placeNear({ x: L.x, z: L.z, right: L.rig.facing.right });
        const f = L.rig.facing;
        this.onLocalMove?.({ x: +L.x.toFixed(3), z: +L.z.toFixed(3), vx: 0, vz: 0, right: f.right, back: f.back, zoneSeq: this.zoneSeq }, true);
      }
    }
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
    if (!profile || !this.layout || this.isOpen36Kind()) return;
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

  setMood(mood) {
    return this.plaza?.setMood?.(mood);
  }

  setLocalPosition(x, z) {
    if (!this.local || !Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.coupleStage?.active) return;
    if (this.layout && !this.walkable(x, z)) {
      ({ x, z } = this.nearestWalkable(x, z));
    }
    this.clearMoveState();
    this.local.x = x; this.local.z = z;
    this.local.rig.setPosition(x, z);
  }

  teleportLocal(x, z, opts = {}) {
    if (!this.local || !Number.isFinite(x) || !Number.isFinite(z)) return;
    this.clearMoveState();
    this.setLocalPosition(x, z);
    const L = this.local;
    const right = opts.right ?? L.rig?.facing?.right ?? true;
    const back = opts.back ?? L.rig?.facing?.back ?? false;
    L.rig?.facing?.set?.(right, back);
    L.pet?.placeNear?.({ x: L.x, z: L.z, right });
    this.onLocalMove?.(
      {
        x: +L.x.toFixed(3),
        z: +L.z.toFixed(3),
        vx: 0,
        vz: 0,
        right,
        back,
        zoneSeq: this.zoneSeq,
        teleport: true,
      },
      true
    );
    L.lastSentMoving = false;
    L.lastSentRight = right;
    L.lastSentBack = back;
    L.lastSentX = L.x;
    L.lastSentZ = L.z;
  }

  flushMoveNow(forceAlways = false) {
    const L = this.local;
    if (!L || !this.onLocalMove || this.lift || this.coupleStage?.active) return;
    const moved =
      forceAlways ||
      !Number.isFinite(L.lastSentX) ||
      !Number.isFinite(L.lastSentZ) ||
      Math.hypot(L.x - L.lastSentX, L.z - L.lastSentZ) > 0.025;
    if (!moved) return;
    L.lastSentX = L.x;
    L.lastSentZ = L.z;
    this.onLocalMove(
      {
        x: +L.x.toFixed(3),
        z: +L.z.toFixed(3),
        vx: +(L.mover?.vx || 0).toFixed(2),
        vz: +(L.mover?.vz || 0).toFixed(2),
        right: Boolean(L.rig?.facing?.right ?? true),
        back: Boolean(L.rig?.facing?.back ?? false),
        zoneSeq: this.zoneSeq,
      },
      true
    );
  }

  startLocalDash(toX, toZ, { durMs = 175, hopHeight = 0 } = {}) {
    const L = this.local;
    if (!L || !Number.isFinite(toX) || !Number.isFinite(toZ) || this.lift || this.coupleStage?.active) return;
    let tx = toX;
    let tz = toZ;
    if (typeof this.clampWalkable === 'function') {
      const cl = this.clampWalkable(tx, tz);
      if (cl && Number.isFinite(cl.x) && Number.isFinite(cl.z)) {
        tx = cl.x;
        tz = cl.z;
      }
    }
    if (this.input) {
      this.input.tapTarget = null;
      this.input.path = null;
    }
    this._reconcileTarget = null;
    this._localDash = {
      fromX: L.x,
      fromZ: L.z,
      toX: tx,
      toZ: tz,
      elapsed: 0,
      dur: Math.max(0.08, (Number(durMs) || 175) / 1000),
      hopHeight: Math.max(0, Number(hopHeight) || 0),
      lastSentAt: 0,
    };
  }

  reconcileLocalDash(serverX, serverZ, { hopHeight = 0 } = {}) {
    const L = this.local;
    if (!L || !Number.isFinite(serverX) || !Number.isFinite(serverZ)) return;
    if (this._localDash) {
      if (Math.hypot(this._localDash.toX - serverX, this._localDash.toZ - serverZ) <= 0.6) {
        this._localDash.toX = serverX;
        this._localDash.toZ = serverZ;
        return;
      }
      this.startLocalDash(serverX, serverZ, { durMs: 140, hopHeight });
      return;
    }
    if (Math.hypot(L.x - serverX, L.z - serverZ) > 0.15) {
      this.startLocalDash(serverX, serverZ, { durMs: 140, hopHeight });
    }
  }

  startRemoteDash(id, toX, toZ, { durMs = 175, hopHeight = 0 } = {}) {
    const r = this.remotes.get(id);
    if (!r || !Number.isFinite(toX) || !Number.isFinite(toZ)) return;
    r._remoteDash = {
      fromX: r.smooth.x,
      fromZ: r.smooth.z,
      toX,
      toZ,
      elapsed: 0,
      dur: Math.max(0.08, (Number(durMs) || 175) / 1000),
      hopHeight: Math.max(0, Number(hopHeight) || 0),
    };
    r.smooth.tx = toX;
    r.smooth.tz = toZ;
    r.smooth.vx = 0;
    r.smooth.vz = 0;
    r.smooth.age = 0;
  }

  upsertRemote(p) {
    let r = this.remotes.get(p.id);
    if (!r) {
      const isMyPartner = Boolean(
        this.local && (p.partner_id === this.local.id || this.local.profile?.partner_id === p.id)
      );
      const partnerTag = isMyPartner ? `💞 Lv. ${p.level || 1}` : `Lv. ${p.level || 1}`;
      const rig = new ChibiRig({ lineage: p.lineage, appearance: p.appearance, name: p.username, sub: partnerTag, wings: this.wingsFor(p) });
      this.hookTurnPuff(rig, () => this.remotes.get(p.id)?.data?.equipped);
      this.scene.add(rig.ROOT);
      const pet = p.equipped?.pet?.id ? new PetController(p.equipped.pet, this.scene, this.fx) : null;
      r = {
        id: p.id,
        data: p,
        rig,
        pet,
        smooth: new RemoteSmoother(p.x, p.z),
        idleFor: 0,
        right: p.right ?? true,
        lastStepSign: 0,
        trailTimer: 0,
        get x() { return this.smooth.x; },
        set x(v) { if (this.smooth) this.smooth.x = v; },
        get z() { return this.smooth.z; },
        set z(v) { if (this.smooth) this.smooth.z = v; },
      };
      pet?.placeNear({ x: p.x, z: p.z, right: r.right });
      rig.setPosition(p.x, p.z);
      rig.setEquipment(p.equipped);
      if (p.appearance) rig.setAppearance(p.appearance);
      this.remotes.set(p.id, r);
    } else {
      const nextIsCompanion = 'isCompanion' in p ? Boolean(p.isCompanion) : ('username' in p ? false : Boolean(r.data?.isCompanion));
      r.data = { ...r.data, ...p, isCompanion: nextIsCompanion };
      if (p.appearance) r.rig.setAppearance(p.appearance);
      if (p.equipped) r.rig.setEquipment(p.equipped);
    }
    if (this.coupleStage?.active && r === this.getPartnerEntity()) {
      return r;
    }
    if (r._remoteDash && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x - r._remoteDash.toX, p.z - r._remoteDash.toZ) <= 0.8) {
      r._remoteDash.toX = p.x;
      r._remoteDash.toZ = p.z;
    }
    r.smooth.onPacket(p);
    if (typeof p.right === 'boolean') r.right = p.right;
    return r;
  }

  /** Remote player was dropped somewhere (Finger Pick-Up): snap instead of sliding across the map. */
  teleportRemote(id, x, z) {
    const r = this.remotes.get(id);
    if (!r) return;
    r._remoteDash = null;
    if (r.rig?.billboard) r.rig.billboard.position.y = 0;
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
    on(window, 'keydown', (e) => { if (e.target.tagName === 'INPUT') return; this.input.keys.add(e.code); this.input.tapTarget = null; this.input.path = null; });
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
        this.input.path = null;
        joyEl.classList.add('active');
        this.updateJoy(e, stick);
      });
      on(joyEl, 'pointermove', (e) => { if (this.input.joy?.id === e.pointerId) this.updateJoy(e, stick); });
      const end = (e) => { if (this.input.joy?.id === e.pointerId) { this.input.joy = null; stick.style.transform = ''; joyEl.classList.remove('active'); } };
      on(joyEl, 'pointerup', end); on(joyEl, 'pointercancel', end);
    }

    // Ground: tap-to-walk (<14px) vs 1-finger camera pan (>=14px), 2-finger pinch zoom (Section 21.G),
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
      if (this.editor?.active) {
        const hit = this.raycastGround(e.clientX, e.clientY, true);
        const picked = this.plaza.pick(e.clientX, e.clientY);
        p.editor = this.editor.pointerDown(hit, picked);
        return;
      }
      if (this.moonDefenseUI?.active || this.cloudDashUI?.active) {
        this.press = null;
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
      if (this.moonDefenseUI?.active && !p.moved) {
        this.moonDefenseUI.onPointerHover?.(this.raycastGround(e.clientX, e.clientY, true));
      }
      if (p.moved && pointers.size === 1 && !this.cloudDashUI?.active) {
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
      if (this.editMode || this.editor?.active) return;
      const hit = this.raycastGround(e.clientX, e.clientY);
      if (this.moonDefenseUI?.active) {
        if (hit) this.moonDefenseUI.onArenaTap?.(hit);
        return;
      }
      if (this.cloudDashUI?.active) {
        return;
      }
      const picked = this.activeFrontier
        ? this.activeFrontier.pick(e.clientX, e.clientY)
        : this.getInstanceKind() === 'museum' && this.nookMuseumScene
          ? this.nookMuseumScene.pick(e.clientX, e.clientY)
          : this.getInstanceKind() === 'townhall' && this.townHallScene
            ? this.townHallScene.pick(e.clientX, e.clientY)
            : this.plaza.pick(e.clientX, e.clientY);
      if (picked?.kind === 'landmark_walk' || picked?.kind === 'museum_interactive') return;
      if (picked?.kind === 'bubble' && this.onPick?.(picked, hit)) return;
      if (this.isOverLocalPet(e.clientX, e.clientY) && this.onPetTap && !picked) {
        this.onPetTap();
        return;
      }
      const remoteHit = !picked ? this.pickRemoteChibi(e.clientX, e.clientY) : null;
      if (remoteHit && this.onPartnerTap && this.local?.profile?.partner_id && remoteHit.id.toLowerCase() === this.local.profile.partner_id.toLowerCase()) {
        this.onPartnerTap(remoteHit);
        return;
      }
      if (picked && this.onPick?.(picked, hit)) return;
      if (this.isOverLocalPet(e.clientX, e.clientY) && this.onPetTap) {
        this.onPetTap();
        return;
      }
      if (hit) { this.walkTo(hit.x, hit.z); }
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
    const r = (this._canvasRect && this._canvasRect.width > 0) ? this._canvasRect : (this._canvasRect = this.canvas.getBoundingClientRect());
    _ndcVec2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    _raycaster.setFromCamera(_ndcVec2, this.camera);
    const t = -_raycaster.ray.origin.y / _raycaster.ray.direction.y;
    if (!(t > 0)) return null;
    const p = _raycaster.ray.origin.clone().addScaledVector(_raycaster.ray.direction, t);
    if (anywhere) return p;
    if (this.moonDefenseUI?.active) {
      const half = this.moonDefenseUI.halfSize || 30;
      return Math.abs(p.x) <= half && Math.abs(p.z) <= half ? p : null;
    }
    if (this.activeFrontier) {
      const half = this.activeFrontier.halfSize || 36;
      return Math.abs(p.x) <= half && Math.abs(p.z) <= half ? p : null;
    }
    if (this.isOpen36Kind()) {
      return Math.abs(p.x) <= 18 && Math.abs(p.z) <= 18 ? p : null;
    }
    if (!this.layout) return p;
    return islandAt(this.layout, p.x, p.z) || onBridge(this.layout, p.x, p.z) ? p : null;
  }

  worldToScreen(x, y, z, out = null) {
    const v = _projVec.set(x, y, z).project(this.camera);
    const r = (this._canvasRect && this._canvasRect.width > 0) ? this._canvasRect : (this._canvasRect = this.canvas.getBoundingClientRect());
    const sx = r.left + (v.x + 1) / 2 * r.width;
    const sy = r.top + (1 - v.y) / 2 * r.height;
    if (out) {
      out.x = sx;
      out.y = sy;
      return out;
    }
    return { x: sx, y: sy };
  }

  isOverLocalChibi(cx, cy) {
    const L = this.local;
    if (!L) return false;
    const a = this.worldToScreen(L.x, 0.1, L.z), b = this.worldToScreen(L.x, CHIBI_HEIGHT, L.z);
    const h = Math.abs(a.y - b.y);
    return Math.abs(cx - a.x) < h * 0.35 && cy < a.y + h * 0.08 && cy > b.y - h * 0.05;
  }

  pickRemoteChibi(cx, cy) {
    for (const r of this.remotes.values()) {
      if (!r.rig?.ROOT?.visible) continue;
      const a = this.worldToScreen(r.smooth.x, 0.1, r.smooth.z);
      const b = this.worldToScreen(r.smooth.x, CHIBI_HEIGHT, r.smooth.z);
      const h = Math.max(36, Math.abs(a.y - b.y));
      if (Math.abs(cx - a.x) < h * 0.42 && cy < a.y + h * 0.12 && cy > b.y - h * 0.12) {
        return r;
      }
    }
    return null;
  }

  getPartnerEntity() {
    const partnerId = this.local?.profile?.partner_id;
    if (!partnerId) return null;
    const direct = this.remotes.get(partnerId) || this.remotes.get(partnerId.toLowerCase());
    if (direct) return direct;
    for (const r of this.remotes.values()) {
      if (r.id?.toLowerCase() === partnerId.toLowerCase()) return r;
    }
    return null;
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
    const g = this.layout && !this.isOpen36Kind() && groundAt(this.layout, x, z, { canFly: this.canFly });

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
      if (!this.walkable(x, z)) ({ x, z } = this.nearestWalkable(x, z));
    } else if (!this.walkable(x, z)) {
      ({ x, z } = this.nearestWalkable(x, z));
    }
    this.setLocalPosition(x, z);
    L.pet?.placeNear({ x, z, right: L.rig.facing.right });
    this.fx.emit('fx_stardust', x, 0.05, z, 8, { speed: 1.2, up: 0.7, size: 0.26, life: 0.5, gravity: 0.7 });
    this.onDrop?.({ x: +x.toFixed(3), z: +z.toFixed(3), propId, targetId: L.id });
  }

  clampWalkable(x, z) {
    return this.nearestWalkable(x, z);
  }

  nearestWalkable(x, z) {
    if (this.moonDefenseUI?.active) {
      if (this.moonDefenseUI.clampWalkable) return this.moonDefenseUI.clampWalkable(x, z);
      return { x: THREE.MathUtils.clamp(x, -17.2, 17.2), z: THREE.MathUtils.clamp(z, -17.2, 17.2) };
    }
    if (this.activeFrontier) return this.activeFrontier.clampWalkable(x, z);
    if (this.isOpen36Kind()) {
      if (this.getInstanceKind() === 'townhall' && this.townHallScene?.siegeMode && !this.canFly && this.townHallScene.clampWalkable) {
        return this.townHallScene.clampWalkable(x, z);
      }
      return { x: THREE.MathUtils.clamp(x, -17.5, 17.5), z: THREE.MathUtils.clamp(z, -17.5, 17.5) };
    }
    if (!this.layout) return { x, z };
    return nearestWalkablePos(this.layout, x, z, { canFly: this.canFly, radius: BODY_R });
  }

  // ------------------------------------------------------------------ movement
  walkable(x, z) {
    if (this.moonDefenseUI?.active) {
      if (this.moonDefenseUI.isWalkable) return this.moonDefenseUI.isWalkable(x, z);
      return Math.abs(x) <= 17.2 && Math.abs(z) <= 17.2;
    }
    if (this.activeFrontier) return this.activeFrontier.walkable(x, z);
    if (this.isOpen36Kind()) {
      if (this.getInstanceKind() === 'townhall' && this.townHallScene?.siegeMode && !this.canFly && this.townHallScene.isWalkable) {
        return this.townHallScene.isWalkable(x, z, 0.20);
      }
      const half = 18 - BODY_R;
      return x >= -half && x <= half && z >= -half && z <= half;
    }
    if (!this.layout) return true;
    return isWalkablePos(this.layout, x, z, { canFly: this.canFly, radius: Math.min(BODY_R, 0.20) });
  }

  /** Combined input direction in world XZ (-Z = up the screen). */
  readInput() {
    if (this.editMode || this.editor?.active || this.lift) return { ix: 0, iz: 0 };
    const k = this.input.keys;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (this.input.joy) { ix = this.input.joy.x; iz = this.input.joy.y; }
    if (ix || iz) { this.input.tapTarget = null; this.input.path = null; return { ix, iz }; }
    let t = this.input.tapTarget;
    if (t && this.local) {
      let dx = t.x - this.local.x, dz = t.z - this.local.z, d = Math.hypot(dx, dz);
      const hasMore = this.input.path && this.input.path.length > 0;
      if (d < (hasMore ? 0.28 : 0.14)) {
        if (hasMore) {
          this.input.tapTarget = this.input.path.shift();
          t = this.input.tapTarget;
          dx = t.x - this.local.x;
          dz = t.z - this.local.z;
          d = Math.hypot(dx, dz);
        } else {
          this.input.tapTarget = null;
          this.input.path = null;
          return { ix: 0, iz: 0 };
        }
      }
      if (d < 1e-4) return { ix: 0, iz: 0 };
      const slow = this.input.path && this.input.path.length > 0 ? 1 : Math.min(1, d / 0.55);
      return { ix: (dx / d) * slow, iz: (dz / d) * slow };
    }
    return { ix: 0, iz: 0 };
  }

  // ------------------------------------------------------------------ loop
  start() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clock.getDelta();
    });
    let wasHidden = false;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (typeof document !== 'undefined' && document.hidden) {
        wasHidden = true;
        return;
      }
      if (wasHidden) {
        wasHidden = false;
        this.clock.getDelta();
      }
      const dt = Math.min(0.05, this.clock.getDelta());
      // Step 4 scene hook: a minigame (e.g. Sky Monopoly) takes over the shared canvas; the village pauses.
      if (this.activeScene) { this.activeScene.update(dt); this.activeScene.render(); return; }
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.activeFrontier?.skillVfx?.drawPostRender?.(this.renderer, this.camera);
    };
    tick();
  }

  update(dt) {
    this.frame++;
    this._fpsT += dt; this._fpsN++;
    if (this._fpsT >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsT); this._fpsT = 0; this._fpsN = 0; }

    // long-press: 0.25 s on your Chibi or Pet = Finger Pick-Up · 0.40 s on a building = Quick-Move / Edit Grid
    if (this.press && !this.editMode && !this.editor?.active && !this.moonDefenseUI?.active && !this.cloudDashUI?.active) {
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
          const p = this._pointers.get(id);
          if (p) {
            p.consumed = true;
            if (this.editor?.active) {
              p.editor = this.editor.pointerDown(this.raycastGround(p.x, p.y, true), pk);
            }
          }
          navigator.vibrate?.(18);
        }
      }
    }

    const L = this.local;
    const tint = this.activeFrontier?.getMoodTint
      ? this.activeFrontier.getMoodTint()
      : (this.getInstanceKind() === 'townhall' && this.townHallScene?.moodTint
        ? this.townHallScene.moodTint
        : this.plaza.moodTint);
    // Update couple proximity & active stage choreography first so L and P stay 100% locked during poses
    this.updateCoupleStage(dt);
    const inCoupleStage = Boolean(this.coupleStage?.active);
    if (L) {
      if (!inCoupleStage && !this.lift && !this._localDash && !this.editMode && !this.editor?.active && this.layout && !this.walkable(L.x, L.z)) {
        const safe = this.nearestWalkable(L.x, L.z);
        L.x = safe.x; L.z = safe.z;
        L.rig.setPosition(L.x, L.z);
        L.pet?.placeNear({ x: L.x, z: L.z, right: L.rig.facing.right });
        const f = L.rig.facing;
        this.onLocalMove?.({ x: +L.x.toFixed(3), z: +L.z.toFixed(3), vx: 0, vz: 0, right: f.right, back: f.back, zoneSeq: this.zoneSeq }, true);
      }
      const { ix, iz } = inCoupleStage ? { ix: 0, iz: 0 } : this.readInput();
      const here = this.layout && !this.isOpen36Kind() ? groundAt(this.layout, L.x, L.z, { canFly: this.canFly }) : { road: false };
      L.speedMult = here.road ? ROAD_SPEED_BOOST : 1;             // +15% on roads & bridges
      if (inCoupleStage) {
        L.mover.vx = 0; L.mover.vz = 0; L.mover.walkWeight = 0;
        L.animVx = 0; L.animVz = 0;
      } else {
        L.mover.update(dt, ix, iz, MOVE.BASE_SPEED * L.speedMult);
      }
      const prevX = L.x, prevZ = L.z;
      let dashActive = false;
      let dashJustFinished = false;
      let dashPeriodicSend = false;
      if (!this.lift && !inCoupleStage && this._localDash) {
        dashActive = true;
        const d = this._localDash;
        d.elapsed += dt;
        const tDash = Math.min(1, d.elapsed / d.dur);
        L.x = d.fromX + (d.toX - d.fromX) * tDash;
        L.z = d.fromZ + (d.toZ - d.fromZ) * tDash;
        const hopY = d.hopHeight > 0 && tDash < 1 ? Math.sin(tDash * Math.PI) * d.hopHeight : 0;
        L.rig.setPosition(L.x, L.z);
        if (L.rig.billboard) L.rig.billboard.position.y = hopY;
        const nowMs = performance.now();
        if (tDash >= 1) {
          if (L.rig.billboard) L.rig.billboard.position.y = 0;
          this._localDash = null;
          dashJustFinished = true;
        } else if (!d.lastSentAt || nowMs - d.lastSentAt >= 34) {
          d.lastSentAt = nowMs;
          dashPeriodicSend = true;
        }
      } else if (!this.lift && !inCoupleStage) {
        if (L.rig.billboard && L.rig.billboard.position.y !== 0) {
          L.rig.billboard.position.y = 0;
        }
        const dx = L.mover.vx * dt, dz = L.mover.vz * dt;
        let nx = L.x + dx, nz = L.z + dz;
        // Smooth, non-oscillating wall-slide:
        // 1) Axis-aligned vector projection first (grid buildings & canals are axis-aligned)
        // 2) Hysteresis-locked rounded-corner assist (max ±45° from input intent, never ±88°)
        // 3) Flush sub-stepped contact stop when walking straight into a flat wall
        if (!this.walkable(nx, nz)) {
          let slideX = 0, slideZ = 0;
          if (Math.abs(dx) > 1e-4) {
            if (this.walkable(L.x + dx, L.z)) slideX = dx;
            else if (this.walkable(L.x + dx * 0.5, L.z)) slideX = dx * 0.5;
          }
          if (Math.abs(dz) > 1e-4) {
            if (this.walkable(L.x, L.z + dz)) slideZ = dz;
            else if (this.walkable(L.x, L.z + dz * 0.5)) slideZ = dz * 0.5;
          }
          if (slideX !== 0 && slideZ !== 0) {
            const pickX = L.slideAxis === 'x'
              ? Math.abs(dx) >= Math.abs(dz) * 0.7
              : (L.slideAxis === 'z' ? Math.abs(dx) > Math.abs(dz) * 1.4 : Math.abs(dx) >= Math.abs(dz));
            if (pickX) { slideZ = 0; L.slideAxis = 'x'; }
            else { slideX = 0; L.slideAxis = 'z'; }
          } else if (slideX !== 0) {
            L.slideAxis = 'x';
          } else if (slideZ !== 0) {
            L.slideAxis = 'z';
          }

          if (slideX !== 0) {
            nx = L.x + slideX;
            nz = L.z;
            L.mover.vz *= 0.2;
          } else if (slideZ !== 0) {
            nx = L.x;
            nz = L.z + slideZ;
            L.mover.vx *= 0.2;
          } else {
            // Both X and Z blocked: test gentle rounded-corner tangent relative to raw input intent (never > 45°)
            const stepLen = Math.hypot(dx, dz);
            const inAng = (ix || iz) ? Math.atan2(iz, ix) : Math.atan2(dz, dx);
            const s = L.lastSlideSign || 1;
            let cornerSlid = false;
            if (stepLen > 1e-4) {
              for (const deg of [24 * s, 45 * s, -24 * s, -45 * s]) {
                const rad = inAng + (deg * Math.PI) / 180;
                const proj = Math.max(0.55, Math.cos((deg * Math.PI) / 180)) * 0.85;
                const tx = L.x + Math.cos(rad) * stepLen * proj;
                const tz = L.z + Math.sin(rad) * stepLen * proj;
                if (this.walkable(tx, tz)) {
                  nx = tx;
                  nz = tz;
                  L.lastSlideSign = deg >= 0 ? 1 : -1;
                  cornerSlid = true;
                  break;
                }
              }
            }
            if (!cornerSlid) {
              nx = L.x;
              nz = L.z;
              for (const f of [0.5, 0.25]) {
                if (this.walkable(L.x + dx * f, L.z + dz * f)) {
                  nx = L.x + dx * f;
                  nz = L.z + dz * f;
                  break;
                }
              }
              L.mover.vx = 0;
              L.mover.vz = 0;
            }
          }
        } else {
          L.slideAxis = null;
          L.lastSlideSign = 0;
        }
        L.x = nx; L.z = nz;
        if (this._reconcileTarget && !this.moonDefenseUI?.active && !this.cloudDashUI?.active) {
          this._reconcileTarget.t -= dt;
          const rx = this._reconcileTarget.x;
          const rz = this._reconcileTarget.z;
          const rDist = Math.hypot(rx - L.x, rz - L.z);
          if (this._reconcileTarget.t <= 0 || rDist < 0.04) {
            this._reconcileTarget = null;
          } else {
            const blend = Math.min(1, dt * 10);
            const bx = L.x + (rx - L.x) * blend;
            const bz = L.z + (rz - L.z) * blend;
            if (this.walkable(bx, bz)) {
              L.x = bx;
              L.z = bz;
            }
          }
        }
        L.rig.setPosition(L.x, L.z);
      }
      const safeDt = Math.max(dt, 1e-4);
      const realVx = (this.lift || inCoupleStage) ? 0 : (L.x - prevX) / safeDt;
      const realVz = (this.lift || inCoupleStage) ? 0 : (L.z - prevZ) / safeDt;
      L.animVx = inCoupleStage ? 0 : damp(L.animVx || 0, realVx, 0.055, dt);
      L.animVz = inCoupleStage ? 0 : damp(L.animVz || 0, realVz, 0.055, dt);
      const effectiveSpeed = (this.lift || inCoupleStage) ? 0 : Math.min(Math.hypot(L.mover.vx, L.mover.vz), Math.hypot(L.animVx, L.animVz));

      // Net-progress tap-target stuck detection (prevents oscillating at a corner or blocked waypoint)
      if (this.input.tapTarget) {
        const distToTap = Math.hypot(this.input.tapTarget.x - L.x, this.input.tapTarget.z - L.z);
        if (L.lastTapRef !== this.input.tapTarget || L.bestTapDist === undefined) {
          L.lastTapRef = this.input.tapTarget;
          L.bestTapDist = distToTap;
          L.stuckTimer = 0;
        } else if (distToTap < L.bestTapDist - 0.025) {
          L.bestTapDist = distToTap;
          L.stuckTimer = 0;
        } else {
          L.stuckTimer = (L.stuckTimer || 0) + dt;
          if (L.stuckTimer > 0.18) {
            L.stuckTimer = 0;
            if (this.input.path?.length) {
              this.input.tapTarget = this.input.path.shift();
              L.lastTapRef = this.input.tapTarget;
              L.bestTapDist = Math.hypot(this.input.tapTarget.x - L.x, this.input.tapTarget.z - L.z);
            } else {
              this.input.tapTarget = null;
              L.lastTapRef = null;
              L.mover.vx = 0; L.mover.vz = 0; L.mover.walkWeight = 0;
            }
          }
        }
      } else {
        L.stuckTimer = 0;
        L.lastTapRef = null;
      }

      const speed = effectiveSpeed;
      const moving = speed > 0.22 && !this.lift && !inCoupleStage;
      // Scale walkWeight to actual movement speed so the chibi smoothly settles to idle when blocked against an obstacle
      const maxWalkW = (this.lift || inCoupleStage) ? 0 : Math.min(1, speed / 1.8);
      if (L.mover.walkWeight > maxWalkW) {
        L.mover.walkWeight = damp(L.mover.walkWeight, maxWalkW, 0.065, dt);
        if (L.mover.walkWeight < 0.02) L.mover.walkWeight = 0;
      }
      L.idleFor = moving ? 0 : L.idleFor + dt;
      L.rig.material.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
      // Blend actual displacement velocity with raw input intent for facing so wall-sliding never triggers surprise Front/Back pop-turns
      const hasInput = !inCoupleStage && Math.hypot(ix, iz) > 0.08;
      const faceVx = (this.lift || inCoupleStage || dashActive) ? 0 : (hasInput ? L.animVx * 0.55 + ix * 1.6 : (moving ? L.animVx : 0));
      const faceVz = (this.lift || inCoupleStage || dashActive) ? 0 : (hasInput ? L.animVz * 0.55 + iz * 1.6 : (moving ? L.animVz : 0));
      L.rig.update(dt, { vx: faceVx, vz: faceVz, walkWeight: (this.lift || inCoupleStage) ? 0 : L.mover.walkWeight }, this.camera);

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
          const off = getTrailOffset(L.animVx, L.animVz, 0.15);
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

      if ((moving || dashActive) && !this.cloudDashUI?.active) this.followDetached = false;
      const f = L.rig.facing;
      const state = { x: +L.x.toFixed(3), z: +L.z.toFixed(3), vx: +L.animVx.toFixed(3), vz: +L.animVz.toFixed(3), right: f.right, back: f.back, zoneSeq: this.zoneSeq };
      if (!this.lift && !inCoupleStage) {
        if (dashJustFinished) {
          const keepMoving = Math.hypot(ix, iz) > 0.08;
          this.onLocalMove?.(keepMoving ? state : { ...state, vx: 0, vz: 0 }, true);
          L.lastSentMoving = keepMoving;
          L.lastSentX = L.x; L.lastSentZ = L.z;
        } else if (dashPeriodicSend) {
          this.onLocalMove?.(state, true);
          L.lastSentMoving = true;
          L.lastSentX = L.x; L.lastSentZ = L.z;
        } else if (!dashActive) {
          if (moving) { this.onLocalMove?.(state, false); L.lastSentMoving = true; }
          else if (L.lastSentMoving) { this.onLocalMove?.({ ...state, vx: 0, vz: 0 }, true); L.lastSentMoving = false; L.lastSentX = L.x; L.lastSentZ = L.z; }
          else if (L.lastSentBack !== f.back || L.lastSentRight !== f.right) { this.onLocalMove?.({ ...state, vx: 0, vz: 0 }, true); L.lastSentX = L.x; L.lastSentZ = L.z; } // idle turn-to-camera
        }
        L.lastSentBack = f.back; L.lastSentRight = f.right;
      }

      if (this.lift?.target !== 'chibi') {
        L.pet?.update(dt, { x: L.x, z: L.z, vx: L.animVx, vz: L.animVz, speed, moving, right: f.right, idleFor: L.idleFor }, this.camera);
      }

      // spring-damped look-ahead follow cam (uses actual smoothed velocity so blocked walls never jerk the camera)
      if (!this.followDetached) {
        const a = 1 - Math.exp(-CAMERA.FOLLOW_LAMBDA * dt);
        const camX = inCoupleStage ? this.coupleStage.cx : L.x + L.animVx * CAMERA.LOOK_AHEAD * 0.25;
        const camZ = inCoupleStage ? this.coupleStage.cz : L.z + L.animVz * CAMERA.LOOK_AHEAD * 0.25;
        this.camTarget.x += (camX - this.camTarget.x) * a;
        this.camTarget.z += (camZ - this.camTarget.z) * a;
      }

      // dock proximity for the fishing HUD (4 Hz is plenty)
      this._dockT += dt;
      if (this._dockT > 0.25 && this.layout && !this.isOpen36Kind()) {
        this._dockT = 0;
        this.onDockNear?.(!!dockNear(this.layout, L.x, L.z, FISHING.DOCK_REACH - 0.3));
      }

      // landmarks trigger check hook (Town Hall / Museum scene / POIs; skipped inside Sky Frontier)
      if (!this._frontierMode) this.checkLandmarksTrigger(L.x, L.z);
    }

    const hideRemotesForSiege = Boolean(this.moonDefenseUI?.active);
    const partnerEnt = inCoupleStage ? this.getPartnerEntity() : null;
    for (const r of this.remotes.values()) {
      if (r.rig?.ROOT) r.rig.ROOT.visible = !hideRemotesForSiege;
      if (r.pet?.root) r.pet.root.visible = !hideRemotesForSiege;
      if (hideRemotesForSiege) continue;
      const isStagedPartner = inCoupleStage && r === partnerEnt;
      const px = r.smooth.x, pz = r.smooth.z;
      let rDashActive = false;
      if (!isStagedPartner && r._remoteDash) {
        rDashActive = true;
        const rd = r._remoteDash;
        rd.elapsed += dt;
        const rt = Math.min(1, rd.elapsed / rd.dur);
        r.smooth.x = rd.fromX + (rd.toX - rd.fromX) * rt;
        r.smooth.z = rd.fromZ + (rd.toZ - rd.fromZ) * rt;
        r.smooth.tx = rd.toX;
        r.smooth.tz = rd.toZ;
        const hopY = rd.hopHeight > 0 && rt < 1 ? Math.sin(rt * Math.PI) * rd.hopHeight : 0;
        if (r.rig?.billboard) r.rig.billboard.position.y = hopY;
        if (rt >= 1) {
          if (r.rig?.billboard) r.rig.billboard.position.y = 0;
          r._remoteDash = null;
        }
      } else if (!isStagedPartner) {
        if (r.rig?.billboard && r.rig.billboard.position.y !== 0) {
          r.rig.billboard.position.y = 0;
        }
        r.smooth.update(dt);
      }
      const vx = isStagedPartner ? 0 : (r.smooth.x - px) / Math.max(dt, 1e-4);
      const vz = isStagedPartner ? 0 : (r.smooth.z - pz) / Math.max(dt, 1e-4);
      const speed = Math.hypot(vx, vz);
      const moving = !isStagedPartner && speed > 0.25 && !r.rig.lifted;
      r.idleFor = moving ? 0 : r.idleFor + dt;
      r.rig.setPosition(r.smooth.x, r.smooth.z);
      r.rig.material.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
      // remote facing follows the sender's authoritative facing when idle (keeps idle turn-to-camera in sync)
      r.rig.update(dt, (moving && !rDashActive) ? { vx, vz } : { vx: 0, vz: 0, walkWeight: 0 }, this.camera);
      if (!isStagedPartner && !moving && r.rig.facing.right !== r.right && !r.rig.facing.turning) r.rig.facing.set(r.right, r.rig.facing.back);

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

    // pet-to-pet nuzzles between idle neighbours (skip during active couple stage so pets stay flanking)
    if (!inCoupleStage) {
      const entries = [];
      if (L?.pet && !this.lift) entries.push({ pet: L.pet, owner: { x: L.x, z: L.z, moving: L.idleFor === 0, idleFor: L.idleFor } });
      for (const r of this.remotes.values()) if (r.pet) entries.push({ pet: r.pet, owner: { x: r.smooth.x, z: r.smooth.z, moving: r.idleFor === 0, idleFor: r.idleFor } });
      updateNuzzles(entries);
    }

    // camera rig (smoothly blends between VILLAGE / Museum Hall 36°, VILLAGE_EDIT 42°, and 2.5D Portal 34°)
    const isMuseum = this.getInstanceKind() === 'museum';
    const inPortal25D = isMuseum && Boolean(this.nookMuseumScene?.currentPortalId);
    let settleFrac = 0;
    if (this._frontierSettleT > 0) {
      this._frontierSettleT = Math.max(0, this._frontierSettleT - dt);
      const u = this._frontierSettleT / 1.15;
      settleFrac = u * u * (3 - 2 * u);
    }
    const targetPitch = THREE.MathUtils.degToRad((inPortal25D ? 34 : this.preset.PITCH_DEG) + settleFrac * 2.6);
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-8 * dt));
    const effDist = this.camDist + settleFrac * 2.8;
    let shakeX = 0, shakeY = 0, shakeZ = 0;
    if (this._camShake) {
      this._camShake.t += dt;
      if (this._camShake.t >= this._camShake.dur) {
        this._camShake = null;
      } else {
        const decay = 1 - this._camShake.t / this._camShake.dur;
        const amp = this._camShake.intensity * decay * decay;
        shakeX = Math.sin(this._camShake.t * 58) * amp;
        shakeY = Math.cos(this._camShake.t * 47) * amp * 0.65;
        shakeZ = Math.sin(this._camShake.t * 41 + 1.1) * amp * 0.75;
      }
    }
    const lookY = (inPortal25D ? CHIBI_HEIGHT * 0.52 : CHIBI_HEIGHT * 0.4) + shakeY * 0.6;
    const lookZ = (inPortal25D ? this.camTarget.z - 0.55 : this.camTarget.z) + shakeZ * 0.6;
    this.camera.position.set(
      this.camTarget.x + shakeX,
      this.camTarget.y + Math.sin(this.pitch) * effDist + shakeY,
      this.camTarget.z + Math.cos(this.pitch) * effDist + shakeZ
    );
    this.camera.lookAt(this.camTarget.x + shakeX * 0.6, lookY, lookZ);
    this.camera.updateMatrixWorld();

    const regId = this._frontierLayout?.regionId;
    const showClouds = !(this._frontierMode && (regId === 'hollow' || regId === 'caldera')) && !(isMuseum && inPortal25D);
    for (const c of this.env.clouds) {
      c.visible = showClouds;
      if (showClouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 95) c.position.x = -55;
      }
    }
    if (this.activeFrontier) {
      this.activeFrontier.update?.(dt, this.camera);
    } else if (this.getInstanceKind() === 'museum') {
      this.nookMuseumScene?.update?.(dt, this.camera, this.pitch);
    } else if (this.getInstanceKind() === 'townhall') {
      this.townHallScene?.update?.(dt, this.camera);
    } else {
      this.plaza.update(dt, this.camera, this.pitch);
    }
    this.moonDefenseUI?.update?.(dt, this.camera);
    this.fx.update(dt);
  }

  /**
   * Launch a synchronized 2-player Couple Interaction & 3D Stage (In-World Proximity & Screen 19 Photobooth).
   * @param {'hug'|'heart_hands'|'kiss'|'dance'|'picnic'} pose
   * @param {{ loop?: boolean, dur?: number, stageAtBridge?: boolean, x?: number, z?: number, partnerProfile?: object }} opts
   */
  playCoupleStage(pose = 'hug', opts = {}) {
    const L = this.local;
    if (!L) return null;
    let P = this.getPartnerEntity();
    if (!P && opts.partnerProfile && opts.partnerProfile.id) {
      P = this.upsertRemote({
        ...opts.partnerProfile,
        x: L.x + 0.7,
        z: L.z,
        right: false,
        back: false,
        isCompanion: true,
      });
    }
    if (!P) return null;

    const sepByPose = {
      hug: 0.38,
      kiss: 0.40,
      heart_hands: 0.50,
      dance: 0.46,
      picnic: 0.64,
    };
    const sepX = sepByPose[pose] ?? 0.42;
    const dur = opts.dur || (opts.loop ? 9999 : 2.5);

    // Determine staging center (cx, cz) — keep in-world poses near L and 100% walkable on both leftX & rightX
    let cx = L.x + sepX;
    let cz = L.z;
    const br = this.layout?.bridge;
    if (opts.x != null && opts.z != null) {
      cx = opts.x;
      cz = opts.z;
    } else if (opts.stageAtBridge && br && !this.isOpen36Kind()) {
      cx = br.cx;
      cz = (br.z0 + br.z1) / 2 - 0.16;
    } else {
      // Stage right beside L toward P (capped within 0.55m of L so server speed-sanity check never rejects)
      const dxP = Math.max(-0.55, Math.min(0.55, (P.smooth.x - L.x) * 0.35));
      const dzP = Math.max(-0.45, Math.min(0.45, (P.smooth.z - L.z) * 0.35));
      cx = L.x + dxP;
      cz = L.z + dzP;
      const isStageWalkable = (tx, tz) => {
        if (!this.layout || this.isOpen36Kind()) return true;
        if (!this.walkable(tx, tz)) return false;
        if (!this.walkable(tx - sepX, tz)) return false;
        if (!this.walkable(tx + sepX, tz)) return false;
        if (pose === 'dance') {
          if (!this.walkable(tx, tz - sepX * 0.55) || !this.walkable(tx, tz + sepX * 0.55)) return false;
        }
        return true;
      };
      if (!isStageWalkable(cx, cz)) {
        let found = null;
        const baseCandidates = [
          [L.x + sepX, L.z],
          [L.x, L.z],
          [L.x - sepX, L.z],
        ];
        for (const [tx, tz] of baseCandidates) {
          if (isStageWalkable(tx, tz)) {
            found = { x: tx, z: tz };
            break;
          }
        }
        if (!found) {
          for (let r = 0.25; r <= 2.5 && !found; r += 0.25) {
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * Math.PI * 2;
              const tx = L.x + Math.cos(a) * r;
              const tz = L.z + Math.sin(a) * r;
              if (isStageWalkable(tx, tz)) {
                found = { x: tx, z: tz };
                break;
              }
            }
          }
        }
        if (found) {
          cx = found.x;
          cz = found.z;
        } else if (this.layout && !this.isOpen36Kind()) {
          const safe = this.nearestWalkable(L.x, L.z);
          cx = safe.x;
          cz = safe.z;
        }
      }
    }

    // Tear down any previous stage group
    this._disposeCoupleStageGroup();

    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    this.scene.add(group);

    // 1. Glowing Golden Couple Magic Circle on the ground
    const ringMat = new THREE.MeshBasicMaterial({
      map: coupleMagicCircleTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.3).rotateX(-Math.PI / 2), ringMat);
    ringMesh.position.set(0, 0.036, 0.08);
    group.add(ringMesh);

    // 2. Custom 2.5D Kawaii Prop Sprite for the selected pose
    // Overhead emote props float ON TOP above both Chibis' heads & nameplates (aligned with billboard tilt z = -0.72)
    // so the couple's kiss/hug/heart-hands action is 100% unobstructed.
    const propKeyByPose = {
      hug: 'couple_prop_hug_cloud',
      heart_hands: 'couple_prop_heart_hands',
      kiss: 'couple_prop_kiss_blush',
      dance: 'couple_prop_hug_cloud',
      picnic: 'couple_prop_picnic_set',
    };
    const propKey = propKeyByPose[pose] || 'couple_prop_hug_cloud';
    const isPicnic = pose === 'picnic';
    const propMat = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.96,
    });
    const propSprite = new THREE.Sprite(propMat);
    propSprite.renderOrder = isPicnic ? 18 : 32;
    const basePropY = isPicnic ? 0.18 : 2.38;
    const basePropZ = isPicnic ? 0.24 : -0.72;
    const basePropScale = isPicnic ? 0.76 : 0.48;
    propSprite.position.set(0, basePropY, basePropZ);
    propSprite.scale.set(0.01, 0.01, 1);
    group.add(propSprite);
    loadSprite(propKey).then((sp) => {
      if (!sp?.texture) return;
      propMat.map = sp.texture;
      propMat.needsUpdate = true;
      const aspect = sp.w && sp.h ? sp.h / sp.w : 0.78;
      propSprite.userData.targetW = basePropScale;
      propSprite.userData.targetH = basePropScale * aspect;
    });

    // Snap & halt movement so both rigs lock into the choreography cleanly
    this.input.tapTarget = null;
    this.input.path = null;
    L.mover.vx = 0;
    L.mover.vz = 0;
    L.mover.walkWeight = 0;
    L.animVx = 0;
    L.animVz = 0;

    let leftX = cx - sepX;
    let rightX = cx + sepX;
    if (!opts.stageAtBridge && this.layout && !this.isOpen36Kind()) {
      if (!this.walkable(leftX, cz)) {
        const safeL = this.nearestWalkable(leftX, cz);
        leftX = safeL.x;
        cx = leftX + sepX;
        rightX = cx + sepX;
      } else if (!this.walkable(rightX, cz)) {
        const safeR = this.nearestWalkable(rightX, cz);
        rightX = safeR.x;
        cx = rightX - sepX;
        leftX = cx - sepX;
      }
    }
    group.position.set(cx, 0, cz);

    const localRole = opts.role === 'right'
      ? 'right'
      : (opts.role === 'left' ? 'left' : (L.x <= P.smooth.x ? 'left' : 'right'));
    const partnerRole = localRole === 'left' ? 'right' : 'left';
    const myX = localRole === 'left' ? leftX : rightX;
    const partnerX = localRole === 'left' ? rightX : leftX;
    const myFaceRight = localRole === 'left';
    const partnerFaceRight = partnerRole === 'left';

    L.x = myX;
    L.z = cz;
    L.rig.setPosition(myX, cz);
    L.rig.facing.set(myFaceRight, false);
    L.rig.setCouplePose(pose, { role: localRole, dur, loop: !!opts.loop });
    if (!opts.stageAtBridge && (!this.layout || this.walkable(myX, cz))) {
      this.onLocalMove?.({ x: +myX.toFixed(3), z: +cz.toFixed(3), vx: 0, vz: 0, right: myFaceRight, back: false, zoneSeq: this.zoneSeq, teleport: true }, true);
      L.lastSentMoving = false;
      L.lastSentRight = myFaceRight;
      L.lastSentBack = false;
    }

    P.smooth.x = partnerX;
    P.smooth.z = cz;
    P.smooth.tx = partnerX;
    P.smooth.tz = cz;
    P.smooth.vx = 0;
    P.smooth.vz = 0;
    P.right = partnerFaceRight;
    P.rig.setPosition(partnerX, cz);
    P.rig.facing.set(partnerFaceRight, false);
    P.rig.setCouplePose(pose, { role: partnerRole, dur, loop: !!opts.loop });

    // Place both companion pets flanking the couple on the left and right edges of the magic circle
    // (0.85m back & +0.25m Z matches PetFollower.restSpot so PetController.update never pulls them away)
    const myPetX = localRole === 'left' ? leftX - 0.85 : rightX + 0.85;
    const partnerPetX = localRole === 'left' ? rightX + 0.85 : leftX - 0.85;
    const petZ = cz + 0.25;
    if (L.pet) {
      L.pet.nuzzle = null;
      L.pet.follower.x = myPetX;
      L.pet.follower.z = petZ;
      L.pet.follower.vx = 0;
      L.pet.follower.vz = 0;
      L.pet.follower.crumbs.length = 0;
      L.pet.visX = myPetX;
      L.pet.visZ = petZ;
      L.pet.root.position.set(myPetX, 0, petZ);
      L.pet.act?.('happy');
      L.pet.showEmote?.('love');
    }
    if (P.pet) {
      P.pet.nuzzle = null;
      P.pet.follower.x = partnerPetX;
      P.pet.follower.z = petZ;
      P.pet.follower.vx = 0;
      P.pet.follower.vz = 0;
      P.pet.follower.crumbs.length = 0;
      P.pet.visX = partnerPetX;
      P.pet.visZ = petZ;
      P.pet.root.position.set(partnerPetX, 0, petZ);
      P.pet.act?.('happy');
      P.pet.showEmote?.('love');
    }

    // Initial celebratory particle burst
    this.fx.emit('fx_magic_circle', cx, 0.06, cz, 1, { speed: 0, up: 0.02, size: 1.4, life: 1.4 });
    this.fx.emit('fx_heart', cx, 1.35, cz + 0.15, 10, { speed: 1.1, up: 1.2, size: 0.32, life: 1.1, spread: 0.45 });
    this.fx.emit('fx_star', cx, 1.55, cz + 0.1, 8, { speed: 1.3, up: 1.4, size: 0.26, life: 1.0, spread: 0.5 });

    this.camTarget.set(cx, 0.35, cz);

    this.coupleStage = {
      active: true,
      pose,
      cx,
      cz,
      leftX,
      rightX,
      myX,
      partnerX,
      localRole,
      partnerRole,
      sepX,
      t: 0,
      dur,
      loop: !!opts.loop,
      fxTimer: 0,
      group,
      ringMesh,
      propSprite,
      basePropY,
      isPicnic,
    };
    return this.coupleStage;
  }

  _disposeCoupleStageGroup() {
    if (!this.coupleStage?.group) return;
    const g = this.coupleStage.group;
    this.scene.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material && o.material.map !== _coupleCircleTex) {
        o.material.dispose?.();
      }
    });
    this.coupleStage.group = null;
  }

  stopCoupleStage() {
    const hadStage = Boolean(this.coupleStage);
    this._disposeCoupleStageGroup();
    this.coupleStage = null;
    const L = this.local;
    if (L) {
      L.rig?.clearCouplePose?.();
      L.animVx = 0;
      L.animVz = 0;
      if (this.layout && !this.isOpen36Kind() && !this.walkable(L.x, L.z)) {
        const safe = this.nearestWalkable(L.x, L.z);
        L.x = safe.x;
        L.z = safe.z;
        L.rig?.setPosition(L.x, L.z);
      }
      const f = L.rig?.facing;
      if (f) {
        this.onLocalMove?.({ x: +L.x.toFixed(3), z: +L.z.toFixed(3), vx: 0, vz: 0, right: f.right, back: f.back, zoneSeq: this.zoneSeq, teleport: true }, true);
        L.lastSentMoving = false;
        L.lastSentRight = f.right;
        L.lastSentBack = f.back;
      }
    }
    const P = this.getPartnerEntity();
    P?.rig?.clearCouplePose?.();
    if (hadStage) this.onCoupleStageEnd?.();
  }

  updateCoupleStage(dt) {
    const L = this.local;
    const P = this.getPartnerEntity();

    // 1. Proximity detector (fires ~6 Hz so the floating Couple Interaction Bar appears when near partner)
    this._partnerProxT += dt;
    if (this._partnerProxT >= 0.16) {
      this._partnerProxT = 0;
      if (L && P && !this.editMode && !this.editor?.active && !this.moonDefenseUI?.active && !this.cloudDashUI?.active) {
        const dist = Math.hypot(L.x - P.smooth.x, L.z - P.smooth.z);
        this.onPartnerProximity?.({
          near: dist <= 4.2 || !!this.coupleStage,
          dist,
          partner: P.data,
        });
      } else {
        this.onPartnerProximity?.({ near: false, dist: Infinity, partner: null });
      }
    }

    // 2. Active Couple Stage animation & particle emitter
    const st = this.coupleStage;
    if (!st) return;
    if (!L || !P) {
      this.stopCoupleStage();
      return;
    }
    // Cancel non-looping in-world pose immediately if player intentionally moves with joystick, keys, or tap
    const rawIn = this.readInput();
    if (!st.loop && st.t > 0.55 && (Math.hypot(rawIn.ix, rawIn.iz) > 0.16 || this.input.tapTarget || this.lift)) {
      this.stopCoupleStage();
      return;
    }

    st.t += dt;
    if (!st.loop && st.t >= st.dur) {
      this.stopCoupleStage();
      return;
    }

    // Rotate magic circle & animate prop pop-in + float
    if (st.ringMesh) {
      st.ringMesh.rotation.z = st.t * 0.65;
      const pulse = 1 + 0.04 * Math.sin(st.t * 4.2);
      st.ringMesh.scale.set(pulse, pulse, 1);
    }
    if (st.propSprite) {
      const pop = Math.min(1, st.t / 0.28);
      const elastic = pop < 1 ? Math.sin(pop * Math.PI * 0.5) * 1.08 : 1 + 0.06 * Math.sin(st.t * 4.5);
      const tw = (st.propSprite.userData.targetW || 0.92) * elastic;
      const th = (st.propSprite.userData.targetH || 0.72) * elastic;
      st.propSprite.scale.set(tw, th, 1);
      st.propSprite.position.y = st.basePropY + (st.isPicnic ? 0 : Math.sin(st.t * 3.8) * 0.06);
    }

    // Ballroom Spin ('dance'): orbit both Chibis 360° around (cx, cz) with dynamic facing
    if (st.pose === 'dance') {
      const inDip = !st.loop && st.t > st.dur - 0.65;
      const theta = inDip ? Math.PI * 2 : st.t * 3.6;
      const r = inDip ? 0.26 : st.sepX;
      const sign = st.localRole === 'right' ? 1 : -1;
      const lx = st.cx + sign * Math.cos(theta) * r;
      const lz = st.cz + sign * Math.sin(theta) * r * 0.55;
      const rx = st.cx - sign * Math.cos(theta) * r;
      const rz = st.cz - sign * Math.sin(theta) * r * 0.55;
      L.x = lx; L.z = lz; L.rig.setPosition(lx, lz);
      P.smooth.x = rx; P.smooth.z = rz; P.smooth.tx = rx; P.smooth.tz = rz; P.smooth.vx = 0; P.smooth.vz = 0; P.rig.setPosition(rx, rz);
      if (L.rig.couplePose) {
        L.rig.couplePose.rightOverride = sign < 0 ? Math.sin(theta) >= 0 : Math.sin(theta) < 0;
        L.rig.couplePose.viewOverride = (sign < 0 ? Math.cos(theta) < -0.35 : Math.cos(theta) > 0.35) ? 'back' : 'front';
      }
      if (P.rig.couplePose) {
        P.rig.couplePose.rightOverride = sign < 0 ? Math.sin(theta) < 0 : Math.sin(theta) >= 0;
        P.rig.couplePose.viewOverride = (sign < 0 ? Math.cos(theta) > 0.35 : Math.cos(theta) < -0.35) ? 'back' : 'front';
      }
    } else {
      // Keep both partners anchored at their exact stage spots
      const myX = st.myX ?? (st.localRole === 'right' ? st.rightX : st.leftX) ?? (st.cx - st.sepX);
      const partnerX = st.partnerX ?? (st.localRole === 'right' ? st.leftX : st.rightX) ?? (st.cx + st.sepX);
      L.x = myX; L.z = st.cz; L.rig.setPosition(myX, st.cz);
      P.smooth.x = partnerX; P.smooth.z = st.cz; P.smooth.tx = partnerX; P.smooth.tz = st.cz; P.smooth.vx = 0; P.smooth.vz = 0; P.rig.setPosition(partnerX, st.cz);
    }

    // Keep both companion pets flanking the couple on the left and right so they frame the shot without blocking the Chibis
    const petLeftX = (st.leftX ?? (st.cx - st.sepX)) - 0.85;
    const petRightX = (st.rightX ?? (st.cx + st.sepX)) + 0.85;
    const myPetX = st.localRole === 'right' ? petRightX : petLeftX;
    const partnerPetX = st.localRole === 'right' ? petLeftX : petRightX;
    const myPetFaceRight = st.localRole !== 'right';
    const partnerPetFaceRight = st.localRole === 'right';
    const petZ = st.cz + 0.25;
    if (L.pet) {
      L.pet.nuzzle = null;
      L.pet.follower.x = myPetX;
      L.pet.follower.z = petZ;
      L.pet.follower.vx = 0;
      L.pet.follower.vz = 0;
      L.pet.visX = myPetX;
      L.pet.visZ = petZ;
      L.pet.root.position.set(myPetX, 0, petZ);
      L.pet.facing?.set?.(myPetFaceRight, false);
    }
    if (P.pet) {
      P.pet.nuzzle = null;
      P.pet.follower.x = partnerPetX;
      P.pet.follower.z = petZ;
      P.pet.follower.vx = 0;
      P.pet.follower.vz = 0;
      P.pet.visX = partnerPetX;
      P.pet.visZ = petZ;
      P.pet.root.position.set(partnerPetX, 0, petZ);
      P.pet.facing?.set?.(partnerPetFaceRight, false);
    }

    // Continuous romantic particles
    st.fxTimer += dt;
    if (st.fxTimer >= 0.32) {
      st.fxTimer = 0;
      if (st.pose === 'hug' || st.pose === 'kiss') {
        this.fx.emit('fx_heart', st.cx + (Math.random() - 0.5) * 0.7, 1.1 + Math.random() * 0.5, st.cz + 0.1, 2, {
          speed: 0.45, up: 0.85, size: 0.25, life: 0.95, gravity: -0.1,
        });
        this.fx.emit('fx_petal', st.cx + (Math.random() - 0.5) * 1.2, 1.6, st.cz, 2, {
          speed: 0.35, up: 0.2, size: 0.22, life: 1.1, gravity: 0.25,
        });
      } else if (st.pose === 'heart_hands') {
        // Sky heart constellation firework burst above the couple (Screen 19)
        for (let i = 0; i < 6; i++) {
          const tAng = Math.random() * Math.PI * 2;
          const hx = 0.55 * Math.pow(Math.sin(tAng), 3);
          const hy = 0.42 * (0.81 * Math.cos(tAng) - 0.31 * Math.cos(2 * tAng) - 0.12 * Math.cos(3 * tAng));
          this.fx.emit(i % 2 === 0 ? 'fx_heart' : 'fx_star', st.cx + hx, 2.35 + hy, st.cz - 0.2, 1, {
            speed: 0.18, up: 0.22, size: 0.24, life: 0.9, gravity: -0.04, tint: [1.15, 0.75, 1.05],
          });
        }
      } else if (st.pose === 'dance') {
        this.fx.emit('fx_note', st.cx + (Math.random() - 0.5) * 1.1, 0.9 + Math.random() * 0.6, st.cz, 2, {
          speed: 0.55, up: 0.75, size: 0.24, life: 0.95,
        });
        this.fx.emit('fx_stardust', st.cx + (Math.random() - 0.5) * 1.0, 0.2, st.cz + (Math.random() - 0.5) * 0.8, 2, {
          speed: 0.4, up: 0.5, size: 0.22, life: 0.8,
        });
      } else if (st.pose === 'picnic') {
        this.fx.emit('fx_heart', st.cx + (Math.random() - 0.5) * 0.9, 0.85, st.cz + 0.15, 1, {
          speed: 0.3, up: 0.65, size: 0.22, life: 0.9,
        });
        this.fx.emit('fx_petal', st.cx + (Math.random() - 0.5) * 1.3, 1.4, st.cz, 2, {
          speed: 0.3, up: 0.15, size: 0.20, life: 1.1, gravity: 0.22,
        });
      }
    }
  }

  /**
   * Section 17.I: iOS Safari Synchronous WebGL Polaroid Compositor (Screen 19).
   * Renders the active 3D scene synchronously and composites a high-res Polaroid Keepsake Card.
   */
  capturePolaroid(meta = {}) {
    // Synchronous render so WebGL drawing buffer is populated immediately prior to drawImage
    this.renderer.render(this.scene, this.camera);
    this.activeFrontier?.skillVfx?.drawPostRender?.(this.renderer, this.camera);

    const W = 960;
    const H = 1200;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d');

    // 1. Warm Cream Polaroid Card body + Golden Filigree Border
    const cardGrad = g.createLinearGradient(0, 0, 0, H);
    cardGrad.addColorStop(0, '#fffdf9');
    cardGrad.addColorStop(1, '#f8eedc');
    g.fillStyle = cardGrad;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = '#d4af37';
    g.lineWidth = 8;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.strokeStyle = 'rgba(138, 90, 54, 0.28)';
    g.lineWidth = 2;
    g.strokeRect(24, 24, W - 48, H - 48);

    // 2. Blit center-cropped square from WebGL canvas into the 864x864 photo window
    const photoX = 48;
    const photoY = 48;
    const photoSize = 864;
    const srcW = this.canvas.width;
    const srcH = this.canvas.height;
    const cropSize = Math.min(srcW, srcH);
    const sx = Math.floor((srcW - cropSize) * 0.5);
    const sy = Math.floor((srcH - cropSize) * 0.46);

    g.fillStyle = '#181c3a';
    g.fillRect(photoX, photoY, photoSize, photoSize);
    try {
      g.drawImage(this.canvas, sx, sy, cropSize, cropSize, photoX, photoY, photoSize, photoSize);
    } catch (_) {
      // Fallback if context tainted
    }

    // Soft romantic inner vignette + golden photo frame border
    const vig = g.createRadialGradient(
      photoX + photoSize / 2,
      photoY + photoSize / 2,
      photoSize * 0.34,
      photoX + photoSize / 2,
      photoY + photoSize / 2,
      photoSize * 0.68
    );
    vig.addColorStop(0, 'rgba(255, 210, 235, 0)');
    vig.addColorStop(1, 'rgba(26, 16, 42, 0.28)');
    g.fillStyle = vig;
    g.fillRect(photoX, photoY, photoSize, photoSize);

    g.strokeStyle = '#d4af37';
    g.lineWidth = 5;
    g.strokeRect(photoX, photoY, photoSize, photoSize);

    // 3. Keepsake Typography Footer (Screen 19 layout)
    const coupleNames = meta.coupleNames || 'Nook 💖 Neen';
    const streak = meta.streak || 14;
    const callText = meta.callText || '💞 Soul-Linked';
    const poseLabel = meta.poseLabel || '🫶 Heart-Hands';
    const dateStr = meta.dateText || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    g.textAlign = 'center';
    g.fillStyle = '#4a2c18';
    g.font = '800 36px "Nunito", "Quicksand", system-ui, sans-serif';
    g.fillText(`🪐 NEORA WORLD • ${coupleNames}`, W / 2, 976);

    g.fillStyle = '#8b4513';
    g.font = '700 28px "Nunito", "Quicksand", system-ui, sans-serif';
    g.fillText(`🔥 ${streak}-Day Couple Streak • ${callText} • ${poseLabel}`, W / 2, 1026);

    g.fillStyle = '#9c6b43';
    g.font = '600 23px "Nunito", "Quicksand", system-ui, sans-serif';
    g.fillText(`✨ Captured in ${meta.moodLabel || 'Starlight Night'} • ${dateStr} ✨`, W / 2, 1072);

    // Cute decorative heart divider at bottom
    g.fillStyle = '#e86a92';
    g.font = '700 24px system-ui, sans-serif';
    g.fillText('───  ♥  💞  ♥  ───', W / 2, 1126);

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = 400;
    const tg = thumbCanvas.getContext('2d');
    tg.drawImage(out, 0, 0, 320, 400);

    return {
      dataUrl: out.toDataURL('image/png'),
      thumbDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.82),
      width: W,
      height: H,
    };
  }

  /** Read-only snapshot for the debug readout and automated QA. */
  debugState() {
    const L = this.local;
    if (!L) return null;
    const f = L.rig.facing;
    const dir = `${f.back ? 'N' : 'S'}${f.right ? 'E' : 'W'}`;
    const g = this.layout && !this.isOpen36Kind() ? groundAt(this.layout, L.x, L.z, { canFly: this.canFly }) : {};
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
      islands: this.layout?.islands?.map((i) => ({ owner: i.owner, cx: i.cx, S: i.S, buildings: i.village?.buildings?.length || 0 })) || [],
      bridge: !!this.layout?.bridge, mood: this.plaza.mood,
      couplePose: this.coupleStage?.pose || null,
      remotes: [...this.remotes.values()].map((r) => ({ id: r.id, x: +r.smooth.x.toFixed(2), z: +r.smooth.z.toFixed(2), back: r.rig.facing.back, right: r.rig.facing.right })),
    };
  }
}
