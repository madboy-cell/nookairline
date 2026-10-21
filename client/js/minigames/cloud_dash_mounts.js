// client/js/minigames/cloud_dash_mounts.js — Zero-Allocation Unique Pet Riding Rig & Choreographer
// Builds and animates species-specific saddles, golden starlight reins, signature riding auras,
// smooth 0.26s mount vault transitions, and synchronized Chibi-astride-Pet 3D spline kinematics
// for all 4 canonical companions (pet_ragdoll, pet_nyx, pet_kitsune, pet_skywhale).

import * as THREE from 'three';
import { normalizePetId } from '../../../shared/pet_catalog.js';

const ASSET_BASE = '/assets/cloud_dash/';
const MOUNT_VAULT_DUR = 0.26;

export const PET_MOUNT_CONFIGS = Object.freeze({
  pet_ragdoll: Object.freeze({
    id: 'pet_ragdoll',
    style: 'pounce',
    saddleTex: 'cd_mount_ragdoll_cushion',
    mountScale: 2.15,
    seatY: 0.56,
    seatZ: 0.38,
    reinsY: 0.78,
    tint: 0xff9ad5,
    gaitHz: 4.2,
  }),
  pet_nyx: Object.freeze({
    id: 'pet_nyx',
    style: 'flight',
    saddleTex: 'cd_mount_nyx_harness',
    mountScale: 2.25,
    seatY: 0.62,
    seatZ: 0.42,
    reinsY: 0.84,
    tint: 0x44e5ff,
    gaitHz: 3.8,
  }),
  pet_kitsune: Object.freeze({
    id: 'pet_kitsune',
    style: 'blink',
    saddleTex: 'cd_mount_kitsune_palanquin',
    mountScale: 2.18,
    seatY: 0.55,
    seatZ: 0.38,
    reinsY: 0.76,
    tint: 0xff77a8,
    gaitHz: 5.0,
  }),
  pet_skywhale: Object.freeze({
    id: 'pet_skywhale',
    style: 'surf',
    saddleTex: 'cd_mount_skywhale_surfboard',
    mountScale: 2.30,
    seatY: 0.60,
    seatZ: 0.40,
    reinsY: 0.82,
    tint: 0x66e0ff,
    gaitHz: 3.2,
  }),
});

const STYLE_TO_PET_ID = Object.freeze({
  pounce: 'pet_ragdoll',
  flight: 'pet_nyx',
  blink: 'pet_kitsune',
  surf: 'pet_skywhale',
});

export function getMountConfig(petIdOrStyle) {
  if (petIdOrStyle && STYLE_TO_PET_ID[petIdOrStyle]) {
    return PET_MOUNT_CONFIGS[STYLE_TO_PET_ID[petIdOrStyle]];
  }
  const canon = normalizePetId(petIdOrStyle || 'pet_ragdoll');
  return PET_MOUNT_CONFIGS[canon] || PET_MOUNT_CONFIGS.pet_ragdoll;
}

// Pre-allocated module-level scratch math objects (0 per-frame heap allocations)
const _vPetPos = new THREE.Vector3();
const _vRiderPos = new THREE.Vector3();
const _vDefaultUp = new THREE.Vector3(0, 1, 0);
const _vDefaultRight = new THREE.Vector3(1, 0, 0);
const _vDefaultTan = new THREE.Vector3(0, 0, 1);

const _texCache = new Map();

function createFallbackDataTex() {
  const data = new Uint8Array([255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function drawProceduralSaddle(ctx, style) {
  ctx.clearRect(0, 0, 128, 128);
  ctx.save();
  if (style === 'pounce') {
    // Plush royal velvet pink-gold cushion with tassels
    const gr = ctx.createRadialGradient(64, 68, 8, 64, 68, 52);
    gr.addColorStop(0, '#ffe6f5');
    gr.addColorStop(0.55, '#ff85c8');
    gr.addColorStop(1, '#b83280');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(64, 70, 46, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffd86b';
    ctx.stroke();
    // Golden pom-poms
    ctx.fillStyle = '#ffe07d';
    ctx.beginPath();
    ctx.arc(20, 74, 7, 0, Math.PI * 2);
    ctx.arc(108, 74, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'flight') {
    // Midnight wyvern obsidian harness with cyan-violet plasma runes
    const gr = ctx.createLinearGradient(20, 44, 108, 92);
    gr.addColorStop(0, '#2a1f4a');
    gr.addColorStop(0.5, '#191430');
    gr.addColorStop(1, '#3b2468');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(22, 74);
    ctx.quadraticCurveTo(64, 46, 106, 74);
    ctx.quadraticCurveTo(64, 94, 22, 74);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#44e5ff';
    ctx.stroke();
    ctx.fillStyle = '#df88ff';
    ctx.beginPath();
    ctx.arc(64, 68, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'blink') {
    // Inari shrine vermilion-and-gold palanquin cushion with suzu bells
    const gr = ctx.createLinearGradient(20, 48, 108, 90);
    gr.addColorStop(0, '#ff5e7e');
    gr.addColorStop(0.5, '#d92b4b');
    gr.addColorStop(1, '#8c142c');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.roundRect(22, 54, 84, 32, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();
  } else {
    // Sky Whale celestial mother-of-pearl surfboard saddle
    const gr = ctx.createLinearGradient(16, 48, 112, 88);
    gr.addColorStop(0, '#a8f5ff');
    gr.addColorStop(0.5, '#5ce1e6');
    gr.addColorStop(1, '#5271ff');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(64, 70, 50, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.restore();
}

function drawProceduralReins(ctx) {
  ctx.clearRect(0, 0, 128, 128);
  ctx.save();
  const gr = ctx.createLinearGradient(16, 32, 112, 96);
  gr.addColorStop(0, '#fff6b3');
  gr.addColorStop(0.5, '#ffd700');
  gr.addColorStop(1, '#ff9d2e');
  ctx.strokeStyle = gr;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(22, 56);
  ctx.quadraticCurveTo(64, 96, 106, 56);
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.moveTo(26, 54);
  ctx.quadraticCurveTo(64, 90, 102, 54);
  ctx.stroke();
  ctx.restore();
}

function drawProceduralRibbon(ctx) {
  ctx.clearRect(0, 0, 128, 64);
  const gr = ctx.createLinearGradient(0, 32, 128, 32);
  gr.addColorStop(0, 'rgba(68, 229, 255, 0.95)');
  gr.addColorStop(0.5, 'rgba(186, 104, 255, 0.65)');
  gr.addColorStop(1, 'rgba(68, 229, 255, 0.0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.quadraticCurveTo(64, 8, 128, 32);
  ctx.quadraticCurveTo(64, 56, 0, 42);
  ctx.closePath();
  ctx.fill();
}

function drawProceduralOrb(ctx) {
  ctx.clearRect(0, 0, 64, 64);
  const gr = ctx.createRadialGradient(32, 32, 3, 32, 32, 28);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.4, '#ff9ad5');
  gr.addColorStop(0.75, '#ff4d94');
  gr.addColorStop(1, 'rgba(255, 77, 148, 0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
}

function loadMountTexture(name, drawFallback, w = 128, h = 128) {
  if (_texCache.has(name)) return _texCache.get(name);
  if (typeof document === 'undefined') {
    const dt = createFallbackDataTex();
    _texCache.set(name, dt);
    return dt;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx && drawFallback) drawFallback(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { shared: true };

  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        tex.needsUpdate = true;
      }
    };
    img.src = `${ASSET_BASE}${name}.png`;
  }
  _texCache.set(name, tex);
  return tex;
}

export class MountVisualizer {
  constructor(arg1 = null, arg2 = null, arg3 = null) {
    this.racerStates = new WeakMap();
    this.activeMountRigs = new Set();
    this.scene = null;
    this.fx = null;
    this.pet = null;
    this.rig = null;
    this.cfg = PET_MOUNT_CONFIGS.pet_ragdoll;
    this.mountTransition = 0;

    if (arg1 && arg1.isObject3D) {
      this.scene = arg1;
      this.fx = arg2 || null;
    } else if (arg1 && (arg1.root?.isObject3D || arg1.petId)) {
      this.pet = arg1;
      this.rig = arg2 || null;
      this.fx = arg3?.fx || arg1.fx || null;
      this.ensureMountRig(this.pet, arg3?.petId || arg1.petId);
    } else if (arg1 && typeof arg1 === 'object') {
      this.scene = arg1.scene || arg1.runnerGroup || null;
      this.fx = arg1.fx || null;
      this.pet = arg1.pet || null;
      this.rig = arg1.rig || null;
      if (this.pet) {
        this.ensureMountRig(this.pet, arg1.petId || this.pet.petId);
      }
    }
  }

  /**
   * Builds (once) and caches the pooled 3D mount rig on `pet._mountRig` with 0 per-frame allocations.
   */
  ensureMountRig(pet, petIdOrStyle = null) {
    if (!pet || !pet.root) return null;
    const cfg = getMountConfig(petIdOrStyle || pet.petId);
    let m = pet._mountRig || this.racerStates.get(pet);
    if (m) {
      if (m.cfg.id !== cfg.id) {
        m.cfg = cfg;
        m.saddleMat.map = loadMountTexture(cfg.saddleTex, (c) => drawProceduralSaddle(c, cfg.style));
        m.saddleMat.needsUpdate = true;
        m.pounceRingMat.color.setHex(cfg.tint);
      }
      this._mirrorProps(m);
      return m;
    }

    const mountGroup = new THREE.Group();
    mountGroup.name = 'CloudDashMountGroup';
    mountGroup.visible = false;
    pet.root.add(mountGroup);

    // 1. Species Custom Saddle / Cushion / Harness Sprite (renderOrder: 0, on pet's back beneath Chibi rider)
    const saddleMat = new THREE.SpriteMaterial({
      map: loadMountTexture(cfg.saddleTex, (c) => drawProceduralSaddle(c, cfg.style)),
      transparent: true,
      depthWrite: false,
      opacity: 0.96,
    });
    const saddleSprite = new THREE.Sprite(saddleMat);
    saddleSprite.scale.set(0.62, 0.42, 1);
    saddleSprite.position.set(0, 0.34, 0.02);
    saddleSprite.renderOrder = 1.5;
    mountGroup.add(saddleSprite);

    // 2. Golden Starlight Reins Sprite (renderOrder: 8, connecting pet collar to Chibi hands)
    const reinsMat = new THREE.SpriteMaterial({
      map: loadMountTexture('cd_mount_reins_gold', drawProceduralReins),
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    const reinsSprite = new THREE.Sprite(reinsMat);
    reinsSprite.scale.set(0.56, 0.34, 1);
    reinsSprite.position.set(0, 0.46, 0.05);
    reinsSprite.renderOrder = 8;
    mountGroup.add(reinsSprite);

    // 3A. Ragdoll (`pounce`): Plush pink-gold heart-paw aura ring under paws
    const pounceRingMat = new THREE.MeshBasicMaterial({
      color: cfg.tint,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pounceRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.44, 24).rotateX(-Math.PI / 2),
      pounceRingMat,
    );
    pounceRing.position.set(0, 0.03, 0);
    pounceRing.renderOrder = 0.5;
    pounceRing.visible = false;
    mountGroup.add(pounceRing);

    // 3B. Nyx (`flight`): Twin cyan-violet wingtip plasma contrail ribbons + jaw plasma glow flare
    const ribbonTex = loadMountTexture('cd_fx_wind_ribbon', drawProceduralRibbon, 128, 64);
    const wingRibbons = [];
    for (let side of [-1, 1]) {
      const rMat = new THREE.MeshBasicMaterial({
        map: ribbonTex,
        color: side < 0 ? 0x44e5ff : 0xc77dff,
        transparent: true,
        opacity: 0.82,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rGeo = new THREE.PlaneGeometry(0.85, 0.18, 6, 1);
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(side * 0.34, 0.48, -0.32);
      rMesh.rotation.y = Math.PI / 2;
      rMesh.renderOrder = 8;
      rMesh.visible = false;
      rMesh.userData.side = side;
      mountGroup.add(rMesh);
      wingRibbons.push(rMesh);
    }

    const jawFlareMat = new THREE.SpriteMaterial({
      map: loadMountTexture('cd_fx_foxfire_orb', drawProceduralOrb, 64, 64),
      color: 0x66f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const jawFlare = new THREE.Sprite(jawFlareMat);
    jawFlare.position.set(0, 0.52, 0.18);
    jawFlare.scale.set(0.65, 0.65, 1);
    jawFlare.renderOrder = 12;
    jawFlare.visible = false;
    mountGroup.add(jawFlare);

    // 3C. Kitsune (`blink`): 5 orbiting Foxfire Spirit Orbs + sakura torii flash on lane blink
    const orbTex = loadMountTexture('fx_foxfire', drawProceduralOrb, 64, 64);
    const foxfireOrbs = [];
    for (let i = 0; i < 5; i++) {
      const oMat = new THREE.SpriteMaterial({
        map: orbTex,
        color: i % 2 === 0 ? 0xff77a8 : 0x5ce1e6,
        transparent: true,
        opacity: 0.9,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const orb = new THREE.Sprite(oMat);
      orb.scale.set(0.26, 0.26, 1);
      orb.renderOrder = 10;
      orb.visible = false;
      mountGroup.add(orb);
      foxfireOrbs.push(orb);
    }

    const toriiFlashMat = new THREE.MeshBasicMaterial({
      color: 0xff85c8,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const toriiFlash = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.58, 20), toriiFlashMat);
    toriiFlash.position.set(0, 0.45, 0);
    toriiFlash.visible = false;
    mountGroup.add(toriiFlash);

    // 3D. Sky Whale (`surf`): Rolling 3D starlight-and-seafoam surf wave crest beneath belly
    const surfGeo = new THREE.CylinderGeometry(0.42, 0.62, 0.24, 18, 1, true, 0, Math.PI * 1.35);
    surfGeo.rotateY(-Math.PI * 0.675);
    const surfMat = new THREE.MeshBasicMaterial({
      color: 0x66e0ff,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const surfMesh = new THREE.Mesh(surfGeo, surfMat);
    surfMesh.position.set(0, 0.12, -0.06);
    surfMesh.renderOrder = 4;
    surfMesh.visible = false;
    mountGroup.add(surfMesh);

    m = {
      cfg,
      mountGroup,
      saddleSprite,
      saddleMat,
      reinsSprite,
      reinsMat,
      pounceRing,
      pounceRingMat,
      wingRibbons,
      jawFlare,
      jawFlareMat,
      foxfireOrbs,
      toriiFlash,
      toriiFlashMat,
      surfMesh,
      surfMat,
      wasRiding: false,
      mountTransition: 0,
      vaultTimer: 0,
      gaitPhase: 0,
      cheerTimer: 0,
      squashTimer: 0,
      breathFlareTimer: 0,
      blinkFlashTimer: 0,
      lastBlinkStacks: 0,
      rideObj: {
        style: cfg.style,
        phase: 0,
        pitch: 0,
        bank: 0,
        reinPull: 0,
        cheer: 0,
        squash: 0,
      },
      ownerTrackObj: {
        x: 0,
        z: 0,
        vx: 0,
        vz: -3.2,
        speed: 3.2,
        moving: true,
        right: false,
        idleFor: 0,
        directTrackSpace: true,
        mounted: false,
        rideStyle: cfg.style,
      },
    };

    pet._mountRig = m;
    this.racerStates.set(pet, m);
    this.activeMountRigs.add(m);
    this._mirrorProps(m);
    return m;
  }

  _mirrorProps(m) {
    this.cfg = m.cfg;
    this.mountGroup = m.mountGroup;
    this.saddleSprite = m.saddleSprite;
    this.reinsSprite = m.reinsSprite;
    this.pounceRing = m.pounceRing;
    this.wingRibbons = m.wingRibbons;
    this.jawFlare = m.jawFlare;
    this.foxfireOrbs = m.foxfireOrbs;
    this.toriiFlash = m.toriiFlash;
    this.surfMesh = m.surfMesh;
    this.mountTransition = m.mountTransition;
  }

  /**
   * Triggers reactive mount/rider choreography on in-race Pet Ride events (`ride_start`, `pounce`, `breath`, `blink`).
   */
  onEvent(evOrKind, pet = this.pet) {
    const kind = typeof evOrKind === 'string' ? evOrKind : evOrKind?.e;
    if (!kind || !pet) return;
    const m = this.ensureMountRig(pet);
    if (!m) return;
    if (kind === 'ride_start') {
      m.vaultTimer = MOUNT_VAULT_DUR;
      m.cheerTimer = 0.55;
    } else if (kind === 'pounce') {
      m.squashTimer = 0.24;
      m.cheerTimer = 0.42;
      pet._squash = 0.22;
    } else if (kind === 'breath') {
      m.breathFlareTimer = 0.48;
      m.cheerTimer = 0.52;
    } else if (kind === 'blink') {
      m.blinkFlashTimer = 0.32;
      m.cheerTimer = 0.35;
    }
  }

  triggerAction(kind, pet = this.pet) {
    this.onEvent(kind, pet);
  }

  /**
   * Flexible zero-allocation update entry point.
   * Supports both:
   *  - `update(dt, { rig, pet, s, lane, y, opts, cam, posFn, fUp, fRight, fTan })`
   *  - `update(rig, pet, s, lane, y, opts, dt, cam, trackCtx)`
   */
  update(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    if (typeof arg0 === 'number') {
      const dt = arg0;
      const st = arg1 || {};
      return this.updateRacer(
        st.rig || this.rig,
        st.pet || this.pet,
        st.s ?? 0,
        st.lane ?? 0,
        st.y ?? 0,
        st.opts || st,
        dt,
        st.cam || null,
        st.trackCtx || st,
      );
    }
    return this.updateRacer(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
  }

  /**
   * Updates the pet mount rig, saddle, golden reins, signature species aura,
   * 0.26s mount vault arc, and exact 3D spline world positions for `pet.root` and `rig.ROOT`.
   */
  updateRacer(rig, pet, s = 0, lane = 0, y = 0, opts = {}, dt = 0.016, cam = null, trackCtx = null) {
    if (!pet || !pet.root) return null;
    const styleHint = opts?.style || opts?.rideStyle || pet.petId;
    const m = this.ensureMountRig(pet, styleHint);
    const cfg = m.cfg;
    const riding = Boolean(opts?.ride || opts?.riding || opts?.mounted);
    const laneVel = opts?.laneVel || 0;
    const vy = opts?.vy || 0;
    const blinkStacks = opts?.blink || 0;

    // Detect false -> true mount transition for snappy 0.26s golden vault arc
    if (riding && !m.wasRiding) {
      m.vaultTimer = MOUNT_VAULT_DUR;
      m.cheerTimer = 0.45;
    }
    m.wasRiding = riding;

    if (blinkStacks > m.lastBlinkStacks && riding) {
      m.blinkFlashTimer = 0.30;
      m.cheerTimer = 0.32;
    }
    m.lastBlinkStacks = blinkStacks;

    if (pet._squash > 0 && m.squashTimer < pet._squash) {
      m.squashTimer = pet._squash;
    }

    // Advance smooth transition (0..1) over 0.26s when mounting, or 0.20s when dismounting
    if (riding) {
      m.mountTransition = Math.min(1, m.mountTransition + dt / MOUNT_VAULT_DUR);
    } else {
      m.mountTransition = Math.max(0, m.mountTransition - dt / 0.20);
    }
    if (m.vaultTimer > 0) m.vaultTimer = Math.max(0, m.vaultTimer - dt);
    if (m.cheerTimer > 0) m.cheerTimer = Math.max(0, m.cheerTimer - dt);
    if (m.squashTimer > 0) m.squashTimer = Math.max(0, m.squashTimer - dt);
    if (m.breathFlareTimer > 0) m.breathFlareTimer = Math.max(0, m.breathFlareTimer - dt);
    if (m.blinkFlashTimer > 0) m.blinkFlashTimer = Math.max(0, m.blinkFlashTimer - dt);

    const speedBoost = opts?.ult ? 1.35 : 1.0;
    m.gaitPhase += dt * cfg.gaitHz * Math.PI * 2 * speedBoost;

    // Resolve spline frame vectors (zero allocation)
    let up = _vDefaultUp;
    let right = _vDefaultRight;
    let tan = _vDefaultTan;
    if (trackCtx) {
      if (trackCtx.fUp && typeof trackCtx._frameAt === 'function') {
        const { i: fi } = trackCtx._frameAt(s);
        up = trackCtx.fUp[fi] || _vDefaultUp;
        right = trackCtx.fRight?.[fi] || _vDefaultRight;
        tan = trackCtx.fTan?.[fi] || _vDefaultTan;
      } else {
        if (trackCtx.up) up = trackCtx.up;
        if (trackCtx.right) right = trackCtx.right;
        if (trackCtx.tan) tan = trackCtx.tan;
      }
    }

    // Drive PetController in direct track space so it ALWAYS faces forward down the track ('back' / 'side')
    pet.directTrackSpace = true;
    pet.mounted = riding;
    pet.rideStyle = cfg.style;
    const ot = m.ownerTrackObj;
    ot.vx = laneVel * 1.45;
    ot.vz = -3.4;
    ot.speed = Math.hypot(ot.vx, ot.vz);
    ot.moving = true;
    ot.right = laneVel > 0.15 ? true : laneVel < -0.15 ? false : lane < 0;
    ot.directTrackSpace = true;
    ot.mounted = riding;
    ot.rideStyle = cfg.style;

    if (!opts?.skipPetUpdate) {
      try { pet.update(dt, ot, cam); } catch {}
    }

    const tr = m.mountTransition;
    const isVisible = tr > 0.01;
    m.mountGroup.visible = isVisible;

    if (riding || isVisible) {
      if (pet.mat) pet.mat.depthWrite = false;
      if (pet.mesh) pet.mesh.renderOrder = 1;
      // Smooth scale interpolation from 1.0 -> cfg.mountScale
      const curScale = 1.0 + (cfg.mountScale - 1.0) * tr;
      const shrinkMul = opts?.shrunk ? 0.65 : 1.0;
      pet.root.scale.setScalar(curScale * shrinkMul);

      // Vault leap arc: sin(t * PI) * 0.45m during the 0.26s mount transition
      const vaultProgress = m.vaultTimer > 0 ? 1.0 - m.vaultTimer / MOUNT_VAULT_DUR : 1.0;
      const vaultArc = m.vaultTimer > 0 ? Math.sin(vaultProgress * Math.PI) * 0.45 : 0;

      // Species-specific vertical/rotational dynamics
      const petY = cfg.style === 'surf' ? y * 0.65 : y;
      let bobOffset = 0;
      let pitch = 0;
      let bank = THREE.MathUtils.clamp(-laneVel * 0.028, -0.24, 0.24);
      const squashNorm = m.squashTimer > 0 ? m.squashTimer / 0.24 : 0;

      if (cfg.style === 'pounce') {
        const inAir = y > 0.08;
        pitch = inAir ? THREE.MathUtils.clamp(vy * 0.035, -0.22, 0.28) : 0;
        if (inAir && vy > 1.5) {
          pet.mesh.scale.y *= 1.18;
          pet.mesh.scale.x *= 0.86;
        }
        if (squashNorm > 0) {
          pet.mesh.scale.y *= (1 - 0.32 * squashNorm);
          pet.mesh.scale.x *= (1 + 0.22 * squashNorm);
        }
        m.pounceRing.visible = true;
        const ringPulse = 0.92 + Math.sin(m.gaitPhase) * 0.12 + squashNorm * 0.45;
        m.pounceRing.scale.set(ringPulse, ringPulse, 1);
        m.pounceRingMat.opacity = (0.55 + squashNorm * 0.35) * tr;
        // Bouncy cushion squash/stretch
        m.saddleSprite.scale.set(
          0.62 * (1 + 0.18 * squashNorm),
          0.42 * (1 - 0.20 * squashNorm),
          1,
        );
      } else {
        m.pounceRing.visible = false;
        m.saddleSprite.scale.set(0.62, 0.42, 1);
      }

      if (cfg.style === 'flight') {
        bobOffset = Math.sin(m.gaitPhase * 0.5) * 0.12;
        pitch = THREE.MathUtils.clamp(-vy * 0.02, -0.14, 0.14);
        const flap = pet.lastBoneState?.wingFlap || Math.sin(m.gaitPhase) * 0.1;
        for (let i = 0; i < m.wingRibbons.length; i++) {
          const rb = m.wingRibbons[i];
          rb.visible = true;
          const side = rb.userData.side;
          rb.position.set(side * (0.34 + Math.abs(flap) * 0.45), 0.46 + flap * 0.65, -0.30);
          rb.rotation.z = side * flap * 1.4;
          rb.material.opacity = (0.68 + 0.22 * Math.sin(m.gaitPhase + i)) * tr;
        }
        if (m.breathFlareTimer > 0) {
          m.jawFlare.visible = true;
          const fk = m.breathFlareTimer / 0.48;
          const fSc = 0.55 + Math.sin(fk * Math.PI) * 0.55;
          m.jawFlare.scale.set(fSc, fSc, 1);
          m.jawFlareMat.opacity = Math.min(1, fk * 1.6) * tr;
        } else {
          m.jawFlare.visible = false;
        }
      } else {
        for (let i = 0; i < m.wingRibbons.length; i++) m.wingRibbons[i].visible = false;
        m.jawFlare.visible = false;
      }

      if (cfg.style === 'blink') {
        const activeOrbs = Math.max(1, Math.min(5, blinkStacks || 1));
        for (let i = 0; i < 5; i++) {
          const orb = m.foxfireOrbs[i];
          if (i < activeOrbs) {
            orb.visible = true;
            const ang = m.gaitPhase * 0.65 + (i * Math.PI * 2) / activeOrbs;
            orb.position.set(
              Math.cos(ang) * 0.52,
              0.42 + Math.sin(ang * 2) * 0.08,
              Math.sin(ang) * 0.36,
            );
            const oSc = 0.24 + 0.04 * Math.sin(m.gaitPhase + i);
            orb.scale.set(oSc, oSc, 1);
          } else {
            orb.visible = false;
          }
        }
        if (m.blinkFlashTimer > 0) {
          m.toriiFlash.visible = true;
          const bk = 1 - m.blinkFlashTimer / 0.32;
          const tSc = 0.65 + bk * 1.25;
          m.toriiFlash.scale.set(tSc, tSc, 1);
          m.toriiFlashMat.opacity = (1 - bk) * 0.85 * tr;
        } else {
          m.toriiFlash.visible = false;
        }
      } else {
        for (let i = 0; i < 5; i++) m.foxfireOrbs[i].visible = false;
        m.toriiFlash.visible = false;
      }

      if (cfg.style === 'surf') {
        const waveRoll = Math.sin(m.gaitPhase * 0.5) * 0.11;
        bank += waveRoll;
        bobOffset = Math.cos(m.gaitPhase * 0.5) * 0.07;
        m.surfMesh.visible = false; // Hand-painted fx_bubble_wave sprite (_surfWave) renders at renderOrder 0.5 beneath Skywhale
      } else {
        m.surfMesh.visible = false;
      }

      // Position Saddle & Reins relative to pet's animated back height
      const petAnimBob = pet.mesh?.position?.y || 0;
      const saddleLocalY = (cfg.seatY / cfg.mountScale) + petAnimBob * 0.65;
      m.saddleSprite.position.set(0, saddleLocalY, 0.04);
      m.saddleMat.opacity = 0.96 * tr;

      const reinPull = Math.min(1, Math.abs(laneVel) * 0.18 + (opts?.ult ? 0.5 : 0));
      const reinsLocalY = (cfg.reinsY / cfg.mountScale) + petAnimBob * 0.7;
      m.reinsSprite.position.set(bank * -0.12, reinsLocalY, 0.08);
      const reinPulse = 1 + 0.08 * Math.sin(m.gaitPhase) + reinPull * 0.12;
      m.reinsSprite.scale.set(0.56 * reinPulse, 0.34 * reinPulse, 1);
      m.reinsMat.opacity = (0.86 + reinPull * 0.14) * tr;

      // Apply exact 3D spline positions for pet.root and rig.ROOT so Chibi sits squarely in the saddle
      if (trackCtx && typeof trackCtx._pos === 'function') {
        _vPetPos.copy(trackCtx._pos(s, lane, petY));
      } else if (rig?.ROOT) {
        _vPetPos.copy(rig.ROOT.position);
      }
      _vPetPos.addScaledVector(up, bobOffset);
      pet.root.position.copy(_vPetPos);
      pet.mesh.rotation.x = -pitch;
      pet.mesh.rotation.z = bank;

      if (rig && rig.ROOT) {
        // Exact world-space saddle height: seatY + animated pet back bob + vault leap arc
        const worldSeatH = (cfg.seatY * tr + petAnimBob * curScale * 0.52) * shrinkMul + vaultArc;
        _vRiderPos.copy(_vPetPos)
          .addScaledVector(up, worldSeatH)
          .addScaledVector(tan, -cfg.seatZ)
          .addScaledVector(right, -bank * 0.16);
        rig.ROOT.position.copy(_vRiderPos);
        rig.ROOT.rotation.x = -pitch * 0.6;
        rig.ROOT.rotation.z = bank * 0.6;

        // Populate zero-allocation `m.rideObj` and apply seated astride riding pose on ChibiRig
        const ro = m.rideObj;
        ro.style = cfg.style;
        ro.phase = m.gaitPhase;
        ro.pitch = pitch;
        ro.bank = bank;
        ro.reinPull = reinPull;
        ro.cheer = m.cheerTimer > 0 || opts?.ult ? 1 : 0;
        ro.squash = squashNorm;

        rig.riding = ro;
        rig.applyRidingPose?.(ro, cam);
      }
    } else {
      // Unmounted companion running alongside in track space
      if (pet.mat) pet.mat.depthWrite = true;
      if (pet.mesh) pet.mesh.renderOrder = 0;
      if (rig) {
        rig.riding = null;
        if (rig.shadow && !rig.shadow.visible) rig.shadow.visible = true;
      }
      pet.root.scale.setScalar(1);
      pet.mesh.rotation.x = 0;
      pet.mesh.rotation.z = 0;
      if (rig?.ROOT) {
        rig.ROOT.rotation.x = 0;
        rig.ROOT.rotation.z = 0;
      }
      if (trackCtx && typeof trackCtx._pos === 'function') {
        const side = lane >= 0.5 ? -0.55 : 0.55;
        pet.root.position.copy(trackCtx._pos(s - 0.9, lane + side, y * 0.6 + 0.15));
      }
    }

    this._mirrorProps(m);
    return m;
  }

  dispose() {
    for (const m of this.activeMountRigs) {
      if (m.mountGroup?.parent) {
        m.mountGroup.parent.remove(m.mountGroup);
      }
      m.mountGroup?.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    }
    this.activeMountRigs.clear();
  }
}
