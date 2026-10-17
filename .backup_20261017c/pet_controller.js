// client/js/pet_controller.js — Companion Pet V2 rig + 8-pose state machine + visual tier shader + Yard Pets.
import * as THREE from 'three';
import { loadSprite } from './assets.js';
import { FacingState, PET_FACING, PetFollower, damp } from '/shared/locomotion.js';
import {
  PETS, POSE_KEYS, petLocomotion, normalizePetId, resolvePetSpriteKey, resolvePetHeight, resolvePetPoseSize,
} from '/shared/pet_catalog.js';
import { normalizeActivePoses } from '/shared/pet_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';
import { blobShadowTexture } from './chibi_rig.js';
import { PetActionDriver } from './pet_actions.js';

const LOCO = {
  HOP_WADDLE: { baseY: 0 },
  FLY_FLUTTER: { baseY: 0.30 },
  FLOAT_SPIRIT: { baseY: 0.38 },
  SKY_SWIM: { baseY: 0.34 },
};

export const NUZZLE_RADIUS = 2.2;
const IDLE_TRICK_EVERY = 6.5;

const emojiTexCache = new Map();
const nameplateTexCache = new Map();

function emojiSprite(char, scale = 0.45) {
  let t = emojiTexCache.get(char);
  if (!t) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(char, 48, 54);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.userData = { shared: true };
    emojiTexCache.set(char, t);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(scale, scale, 1);
  s.renderOrder = 11;
  return s;
}

function buildNameplateSprite(nickname, stars = 1, bondLv = 1) {
  const isCrown = (Number(bondLv) || 1) >= 30;
  const key = `${nickname}|${stars}|${isCrown ? 1 : 0}`;
  let tex = nameplateTexCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 56;
    const g = c.getContext('2d');
    const prefix = isCrown ? '👑 ' : '';
    const label = `${prefix}${'★'.repeat(Math.max(1, Math.min(3, stars)))} ${nickname}`;
    g.font = 'bold 22px "Nunito", "Quicksand", system-ui, sans-serif';
    const textW = Math.min(220, Math.max(84, g.measureText(label).width + 28));
    const x0 = (256 - textW) / 2;
    const y0 = 10;
    const h = 36;
    const r = 18;
    g.fillStyle = 'rgba(32, 22, 48, 0.78)';
    g.beginPath();
    g.roundRect(x0, y0, textW, h, r);
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = isCrown ? '#ffd700' : (stars >= 3 ? '#ffd86b' : stars === 2 ? '#b695ff' : '#f5c2d7');
    g.stroke();
    g.fillStyle = isCrown ? '#fff8cc' : (stars >= 3 ? '#fff3b8' : '#ffffff');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 128, y0 + h / 2 + 1);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { shared: true };
    nameplateTexCache.set(key, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.95, 0.21, 1);
  sp.renderOrder = 12;
  return sp;
}

const petVertShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const petFragShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uShimmer;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.06) discard;
    vec3 col = tex.rgb * uTint;
    if (uShimmer > 0.01) {
      float diag = vUv.x * 0.85 + vUv.y * 1.15;
      float wave = sin(diag * 7.0 - uTime * 2.8);
      float band = smoothstep(0.75, 0.99, wave);
      vec3 glowCol = mix(vec3(1.0, 0.92, 0.68), vec3(0.78, 0.94, 1.0), 0.5 + 0.5 * sin(uTime * 1.9 + vUv.y * 4.0));
      col = mix(col, col + glowCol * 0.38, band * uShimmer);
    }
    gl_FragColor = vec4(col, tex.a);
  }
`;

const shadowVertShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shadowFragShader = /* glsl */ `
  uniform float uTime;
  uniform float uAuraActive;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uCycleSec;
  uniform float uPulseSec;
  varying vec2 vUv;

  void main() {
    float r = length(vUv - vec2(0.5)) * 2.0;
    if (r > 1.0) discard;

    float sh = smoothstep(0.62, 0.08, r) * 0.34;
    vec3 shColor = vec3(0.08, 0.05, 0.14);

    vec3 finalColor = shColor;
    float finalAlpha = sh;

    if (uAuraActive > 0.5) {
      float ct = mod(uTime, uCycleSec);
      if (ct < uPulseSec) {
        float p = ct / uPulseSec;
        float env = sin(p * 3.14159265);
        float r1 = mix(0.26, 0.88, p);
        float r2 = mix(0.16, 0.68, p);
        float ring1 = exp(-pow((r - r1) / 0.065, 2.0));
        float ring2 = exp(-pow((r - r2) / 0.05, 2.0)) * 0.65;
        float glow = smoothstep(0.75, 0.15, r) * 0.22 * env;
        float auraA = clamp((ring1 + ring2) * env * 0.85 + glow, 0.0, 0.92) * smoothstep(1.0, 0.82, r);
        vec3 auraColor = mix(uColor1, uColor2, clamp(r, 0.0, 1.0));
        finalAlpha = max(sh, auraA);
        if (finalAlpha > 0.001) {
          float auraWeight = auraA / max(finalAlpha, 0.001);
          finalColor = mix(shColor, auraColor, auraWeight);
        }
      }
    }

    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

function unpackPetInit(petOrId, opts = {}) {
  if (petOrId && typeof petOrId === 'object') {
    const rawId = petOrId.id || 'pet_ragdoll';
    const canonicalId = normalizePetId(rawId);
    const stars = Math.max(1, Math.min(3, Number(petOrId.stars) || 1));
    const visualTier = Math.max(1, Math.min(stars, Number(petOrId.visual_tier) || stars));
    const bondLv = Math.max(1, Number(petOrId.bond_lv || petOrId.level || opts.bondLv) || 1);
    return {
      rawId,
      petId: canonicalId,
      stars,
      visualTier,
      nickname: String(petOrId.nickname || opts.nickname || ''),
      bondLv,
      costumeId: petOrId.costume_id || opts.costumeId || null,
      activePoses: normalizeActivePoses(petOrId.active_poses || petOrId.activePoses || opts.active_poses || opts.activePoses, bondLv),
      uid: petOrId.uid || null,
    };
  }
  const rawId = String(petOrId || 'pet_ragdoll');
  const canonicalId = normalizePetId(rawId);
  const stars = Math.max(1, Math.min(3, Number(opts.stars) || PETS[rawId]?.rarity || 1));
  const visualTier = Math.max(1, Math.min(stars, Number(opts.visual_tier || opts.visualTier) || stars));
  const bondLv = Math.max(1, Number(opts.bond_lv || opts.level || opts.bondLv) || 1);
  return {
    rawId,
    petId: canonicalId,
    stars,
    visualTier,
    nickname: String(opts.nickname || ''),
    bondLv,
    costumeId: opts.costume_id || opts.costumeId || null,
    activePoses: normalizeActivePoses(opts.active_poses || opts.activePoses, bondLv),
    uid: opts.uid || null,
  };
}

export class PetController {
  constructor(petOrId, scene, fx, opts = {}) {
    const init = unpackPetInit(petOrId, opts);
    this.rawId = init.rawId;
    this.petId = init.petId;
    this.petUid = init.uid;
    this.stars = init.stars;
    this.visualTier = init.visualTier;
    this.nickname = init.nickname;
    this.bondLv = init.bondLv;
    this.costumeId = init.costumeId;
    this.activePoses = init.activePoses;
    this.costumeTrailTimer = 0;

    const pdef = PETS[this.petId] || PETS.pet_ragdoll;
    this.family = pdef.family;
    this.loco = petLocomotion(this.petId);
    this.fx = fx;
    this.follower = new PetFollower();
    this.facing = new FacingState(PET_FACING);
    this.actions = new PetActionDriver(this);

    this.shownView = 'front';
    this.shownRight = true;
    this.mirror = 1;
    this.t = Math.random() * 10;
    this.idleFor = 0;
    this.poseTimer = 1.8 + Math.random() * 1.4;
    this.lastCyclePose = 'front';
    this.trick = null;
    this.nuzzle = null;
    this.heartCooldown = 0;
    this.auraTimer = 0;
    this.trailTimer = 0;
    this.bubbles = [];
    this.emoteBustSprite = null;
    this.giftSprite = null;
    this.nameplateSprite = null;

    this.root = new THREE.Group();
    this.billboard = new THREE.Group();
    this.root.add(this.billboard);
    this.height = resolvePetHeight(this.petId, this.stars, this.visualTier);

    const tint = PETS[this.rawId]?.tint || pdef.tint || [1, 1, 1];
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uTint: { value: new THREE.Color(tint[0], tint[1], tint[2]) },
        uShimmer: { value: this.visualTier >= 3 ? 1.0 : this.visualTier === 2 ? 0.25 : 0.0 },
        uTime: { value: 0 },
      },
      vertexShader: petVertShader,
      fragmentShader: petFragShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), this.mat);
    this.billboard.add(this.mesh);

    const aura = pdef.auraRing || {};
    const col1 = aura.color1 || [0.35, 0.85, 1.0];
    const col2 = aura.color2 || [0.55, 0.70, 1.0];
    this.shadowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAuraActive: { value: this.bondLv >= 30 ? 1.0 : 0.0 },
        uColor1: { value: new THREE.Color(col1[0], col1[1], col1[2]) },
        uColor2: { value: new THREE.Color(col2[0], col2[1], col2[2]) },
        uCycleSec: { value: aura.cycleSec || 6.0 },
        uPulseSec: { value: aura.pulseSec || 2.0 },
      },
      vertexShader: shadowVertShader,
      fragmentShader: shadowFragShader,
      transparent: true,
      depthWrite: false,
    });

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      this.shadowMat,
    );
    this.shadow.position.y = 0.011;
    this.shadow.renderOrder = -1;
    this.root.add(this.shadow);

    scene.add(this.root);
    this.setNickname(this.nickname, this.stars, this.bondLv);
    this.ready = this.loadPoses(this.petId, this.visualTier);
  }

  /**
   * Update visual tier, stars, nickname, or species live without recreating the controller.
   */
  setPetConfig(petOrId, opts = {}) {
    const next = unpackPetInit(petOrId, opts);
    const tierChanged = next.petId !== this.petId || next.visualTier !== this.visualTier || next.stars !== this.stars;
    this.rawId = next.rawId;
    this.petId = next.petId;
    this.petUid = next.uid || this.petUid;
    this.stars = next.stars;
    this.visualTier = next.visualTier;
    this.bondLv = next.bondLv;
    this.costumeId = next.costumeId;
    this.activePoses = next.activePoses;

    const pdef = PETS[this.petId] || PETS.pet_ragdoll;
    this.family = pdef.family;
    this.loco = petLocomotion(this.petId);
    this.height = resolvePetHeight(this.petId, this.stars, this.visualTier);

    const nextAura = pdef.auraRing || {};
    const nextCol1 = nextAura.color1 || [0.35, 0.85, 1.0];
    const nextCol2 = nextAura.color2 || [0.55, 0.70, 1.0];
    if (this.shadowMat?.uniforms) {
      this.shadowMat.uniforms.uAuraActive.value = this.bondLv >= 30 ? 1.0 : 0.0;
      this.shadowMat.uniforms.uColor1.value.setRGB(nextCol1[0], nextCol1[1], nextCol1[2]);
      this.shadowMat.uniforms.uColor2.value.setRGB(nextCol2[0], nextCol2[1], nextCol2[2]);
      this.shadowMat.uniforms.uCycleSec.value = nextAura.cycleSec || 6.0;
      this.shadowMat.uniforms.uPulseSec.value = nextAura.pulseSec || 2.0;
    }

    if (this.mat?.uniforms?.uShimmer) {
      this.mat.uniforms.uShimmer.value = this.visualTier >= 3 ? 1.0 : this.visualTier === 2 ? 0.25 : 0.0;
    }
    this.setNickname(next.nickname, this.stars, this.bondLv);
    if (tierChanged) {
      this.ready = this.loadPoses(this.petId, this.visualTier);
    }
  }

  setNickname(nickname, stars = this.stars, bondLv = this.bondLv) {
    this.nickname = String(nickname || '').trim();
    if (this.nameplateSprite) {
      this.billboard.remove(this.nameplateSprite);
      this.nameplateSprite.material?.dispose();
      this.nameplateSprite = null;
    }
    if (this.nickname) {
      const baseY = (LOCO[this.loco] || LOCO.HOP_WADDLE).baseY;
      this.nameplateSprite = buildNameplateSprite(this.nickname, stars, bondLv);
      this.nameplateSprite.position.set(0, this.height + baseY + 0.16, 0.02);
      this.billboard.add(this.nameplateSprite);
    }
  }

  setGiftReady(ready) {
    if (ready && !this.giftSprite) {
      this.giftSprite = emojiSprite('🎁', 0.38);
      const baseY = (LOCO[this.loco] || LOCO.HOP_WADDLE).baseY;
      this.giftSprite.position.set(0.24, this.height + baseY + 0.34, 0.03);
      this.billboard.add(this.giftSprite);
    } else if (!ready && this.giftSprite) {
      this.billboard.remove(this.giftSprite);
      this.giftSprite.material?.dispose();
      this.giftSprite = null;
    }
  }

  async loadPoses(petId, visualTier = 1) {
    const keys = POSE_KEYS.map((pose) => resolvePetSpriteKey(petId, visualTier, pose));
    const loaded = await Promise.all(keys.map((k) => loadSprite(k)));

    this.views = {};
    POSE_KEYS.forEach((pose, idx) => {
      const sp = loaded[idx];
      if (!sp.fallback || pose === 'front') {
        const sz = resolvePetPoseSize(petId, this.stars, visualTier, pose, sp.w, sp.h);
        this.views[pose] = {
          tex: sp.texture,
          w: sz.w,
          h: sz.h,
          nativeRight: sp.faces !== 'left',
          fallback: !!sp.fallback,
        };
      }
    });
    if (!this.views.back) this.views.back = this.views.front;
    this.applyView(this.shownView, this.shownRight);
  }

  applyView(view, right) {
    this.shownView = view;
    this.shownRight = right;
    if (!this.views) return;
    const v = this.views[view] || this.views.front;
    if (!v) return;
    if (this.mat.uniforms?.uMap) {
      this.mat.uniforms.uMap.value = v.tex;
    } else {
      this.mat.map = v.tex;
    }
    this.mat.needsUpdate = true;
    this.baseW = v.w;
    this.baseH = v.h;
    this.mirror = right === v.nativeRight ? 1 : -1;
  }

  act(kind, dur) {
    this.actions.act(kind, dur);
  }

  setActivePoses(poses) {
    this.activePoses = normalizeActivePoses(poses, this.bondLv);
    this.poseTimer = 0.25;
  }

  setLifted(lifted) {
    this.actions.setLifted(lifted);
  }

  showEmote(emoteName = 'joy') {
    this.actions.showEmote(emoteName);
  }

  async spawnEmoteBustBubble(spriteKey) {
    const sp = await loadSprite(spriteKey);
    if (!sp || sp.fallback) {
      this.bubble('💖');
      return;
    }
    if (this.emoteBustSprite) {
      this.billboard.remove(this.emoteBustSprite);
      this.emoteBustSprite.material?.dispose();
      this.emoteBustSprite = null;
    }
    const mat = new THREE.SpriteMaterial({ map: sp.texture, transparent: true, depthWrite: false });
    const bubble = new THREE.Sprite(mat);
    const baseY = (LOCO[this.loco] || LOCO.HOP_WADDLE).baseY;
    bubble.scale.set(0.46, 0.46, 1);
    bubble.position.set(0, this.height + baseY + 0.38, 0.04);
    bubble.renderOrder = 14;
    bubble.userData = { life: 2.2, maxLife: 2.2, baseY: this.height + baseY + 0.38 };
    this.billboard.add(bubble);
    this.emoteBustSprite = bubble;
  }

  get x() { return this.follower.x; }
  get z() { return this.follower.z; }

  placeNear(owner) {
    const r = this.follower.restSpot(owner);
    this.follower.x = r.x; this.follower.z = r.z;
    this.follower.crumbs.length = 0; this.follower.lastCrumb = null;
  }

  bubble(char) {
    const s = emojiSprite(char);
    const baseY = (LOCO[this.loco] || LOCO.HOP_WADDLE).baseY;
    s.position.set(0, this.height + baseY + 0.28, 0.03);
    s.userData.life = 1.6;
    this.billboard.add(s);
    this.bubbles.push(s);
  }

  /**
   * owner: { x, z, vx, vz, speed, moving, right, idleFor }
   */
  update(dt, owner, cam) {
    this.t += dt;
    if (this.mat.uniforms?.uTime) {
      this.mat.uniforms.uTime.value = this.t;
    }
    if (this.shadowMat?.uniforms?.uTime) {
      this.shadowMat.uniforms.uTime.value = this.t;
    }

    const f = this.follower;

    if (this.actions.mode === 'lifted') {
      // While lifted by finger, stay at current follower x/z
      f.vx = 0;
      f.vz = 0;
    } else if (this.nuzzle && (owner.moving || owner.idleFor < 1)) {
      this.nuzzle = null;
    }

    if (this.actions.mode !== 'lifted') {
      if (this.nuzzle) {
        const px = f.x, pz = f.z;
        const d = Math.hypot(this.nuzzle.x - f.x, this.nuzzle.z - f.z);
        if (d > 0.05) {
          const s = Math.min(d, 1.6 * dt);
          f.x += ((this.nuzzle.x - f.x) / d) * s; f.z += ((this.nuzzle.z - f.z) / d) * s;
        } else {
          this.heartCooldown -= dt;
          if (this.heartCooldown <= 0) {
            this.heartCooldown = 0.9;
            this.bubble('💕');
            this.fx?.emit('fx_heart', this.root.position.x, this.height + 0.3, this.root.position.z, 2);
          }
        }
        f.vx = (f.x - px) / Math.max(dt, 1e-4); f.vz = (f.z - pz) / Math.max(dt, 1e-4);
        f.crumbs.length = 0; f.lastCrumb = null;
      } else {
        f.update(dt, owner);
        if (f.events.includes('teleport')) this.fx?.emit('fx_star', f.x, 0.4, f.z, 10);
      }
    }

    const speed = Math.hypot(f.vx, f.vz);
    if (speed >= 0.05) {
      this.facing.update(dt, f.vx, f.vz);
    } else {
      this.facing.update(dt, 0, 0);
      const want = this.nuzzle ? this.nuzzle.partner.x > f.x : owner.right;
      if (this.facing.idleFor >= PET_FACING.idleTurnTime && this.facing.right !== want && !this.facing.turning) {
        this.facing.set(want, this.facing.back);
      }
    }
    const shown = this.facing.shown(!!this.views?.side);
    const actState = this.actions.update(dt, speed, shown.view);
    const targetPose = this.views?.[actState.pose] ? actState.pose : shown.view;

    if (targetPose !== this.shownView || shown.right !== this.shownRight) {
      this.applyView(targetPose, shown.right);
    }

    // Idle pose rotation among player-selected activePoses (zero array allocation per frame)
    const moving = speed > 0.1;
    if (moving) {
      this.idleFor = 0;
      this.poseTimer = 1.1 + Math.random() * 1.1;
    } else {
      this.idleFor += dt;
      if (!this.nuzzle && this.actions.mode !== 'lifted') {
        const poses = this.activePoses?.length ? this.activePoses : null;
        const len = poses ? poses.length : 1;
        if (len === 1) {
          const only = poses ? poses[0] : 'front';
          if (only === 'sleep') {
            if (this.idleFor > 0.45 && this.actions.mode !== 'sleep' && !this.actions.activeAction) {
              this.actions.act('sleep');
            }
          } else if (only === 'front') {
            if (this.actions.mode === 'sleep') this.actions.act('front');
            if (!this.trick && !this.actions.activeAction && this.idleFor > IDLE_TRICK_EVERY) {
              this.idleFor = 0;
              if (Math.random() < 0.5) {
                this.trick = { kind: 'ear_wiggle', t: 0 };
              } else {
                this.fx?.emit('fx_note', f.x, this.height, f.z, 3);
              }
            }
          } else {
            if (this.actions.mode === 'sleep') this.actions.act('front');
            this.poseTimer -= dt;
            if (this.poseTimer <= 0 && !this.actions.activeAction) {
              this.poseTimer = 3.2 + Math.random() * 1.6;
              this.actions.act(only, only === 'flip' ? 0.95 : 2.2);
            }
          }
        } else {
          this.poseTimer -= dt;
          if (this.poseTimer <= 0 && !this.actions.activeAction) {
            let idx = (Math.random() * len) | 0;
            if (poses[idx] === this.lastCyclePose) {
              idx = (idx + 1 + ((Math.random() * (len - 1)) | 0)) % len;
            }
            const pick = poses[idx];
            this.lastCyclePose = pick;
            this.poseTimer = 3.5 + Math.random() * 2.2;
            if (pick === 'front') {
              this.actions.act('front');
            } else if (pick === 'sleep') {
              this.actions.act('sleep');
            } else if (pick === 'happy') {
              this.actions.act('happy', 2.4);
            } else if (pick === 'cast') {
              this.actions.act('cast', 2.2);
            } else if (pick === 'flip') {
              this.actions.act('flip', 0.95);
            }
          }
        }
      }
    }

    // Costume Soul-Link trail FX (when moving speed > 0.1, emit 1 trail particle every 0.28s)
    if (this.costumeId && OUTFITS[this.costumeId]?.walkFx && moving) {
      this.costumeTrailTimer = (this.costumeTrailTimer || 0) - dt;
      if (this.costumeTrailTimer <= 0) {
        this.costumeTrailTimer = 0.28;
        const wfx = OUTFITS[this.costumeId].walkFx;
        this.fx?.emit(wfx.stepCell, f.x, 0.20, f.z, 1, { tint: wfx.tint });
      }
    }

    // Synchronized Lv. 30 Accent Particle Pop (Once per ~6s cycle at pulse peak)
    if (this.bondLv >= 30) {
      const pdef = PETS[this.petId] || PETS.pet_ragdoll;
      const auraRing = pdef.auraRing || {};
      const cycleSec = auraRing.cycleSec || 6.0;
      const pulseSec = auraRing.pulseSec || 2.0;
      const prevCt = (((this.t - dt) % cycleSec) + cycleSec) % cycleSec;
      const curCt = ((this.t % cycleSec) + cycleSec) % cycleSec;
      const peakT = pulseSec * 0.35;
      if (prevCt < peakT && curCt >= peakT) {
        if (this.fx && (this.fx.activeCount || 0) < 288) {
          const px = f.x + (Math.random() - 0.5) * 0.35;
          const pz = f.z + (Math.random() - 0.5) * 0.35;
          const popOpts = {
            tint: auraRing.accentTint || [1, 1, 1],
            up: 0.35,
            speed: 0.28,
            gravity: -0.12,
            size: 0.24,
            life: 0.75,
          };
          if (auraRing.accentCell) this.fx.emit(auraRing.accentCell, px, 0.18, pz, 1, popOpts);
          if (auraRing.accentCell2) this.fx.emit(auraRing.accentCell2, px, 0.18, pz, 1, popOpts);
        }
      }
    }

    // Visual tier 2/3 trail & radiant aura FX
    if (this.visualTier >= 2 && moving) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.28;
        const trailFx = this.family === 'dragons' ? 'fx_star' : this.family === 'spirits' ? 'fx_petal' : 'fx_sparkle';
        this.fx?.emit(trailFx, f.x, 0.22, f.z, 1);
      }
    }
    if (this.visualTier >= 3) {
      this.auraTimer -= dt;
      if (this.auraTimer <= 0) {
        this.auraTimer = 0.85;
        this.fx?.emit('fx_star', f.x + (Math.random() - 0.5) * 0.4, this.height * 0.65, f.z, 1);
      }
    }

    // Locomotion archetype kinematics
    const L = LOCO[this.loco] || LOCO.HOP_WADDLE;
    let y = L.baseY + actState.bounceY;
    let sx = actState.scalePulse;
    let sy = actState.scalePulse;
    let rz = actState.rollZ;

    if (this.loco === 'HOP_WADDLE') {
      const hop = Math.abs(Math.sin(this.t * 13));
      const w = Math.min(1, speed / 1.5) + (this.nuzzle && speed < 0.05 ? 0.6 : 0);
      y += hop * 0.09 * w;
      sy *= 1 + (hop - 0.5) * 0.16 * w;
      sx *= 2 - (1 + (hop - 0.5) * 0.16 * w);
      rz += Math.sin(this.t * 6.5) * 0.06 * Math.max(w, 0.3);
    } else if (this.loco === 'SKY_SWIM') {
      y += Math.sin(this.t * 2.2) * 0.06;
      rz += Math.sin(this.t * 2.2) * 0.07;
      sx *= 1 + Math.sin(this.t * 3.1) * 0.03;
    } else {
      const bob = this.loco === 'FLY_FLUTTER' ? Math.sin(this.t * 5) * 0.06 : Math.sin(this.t * 2.4) * 0.04;
      y += bob;
      if (this.loco === 'FLY_FLUTTER') sx *= 1 + Math.sin(this.t * Math.PI * 2 * 2.8) * 0.05;
      rz += Math.sin(this.t * 1.7) * 0.04;
    }

    if (this.trick) {
      this.trick.t += dt;
      const k = this.trick.t;
      if (this.trick.kind === 'ear_wiggle') rz += Math.sin(k * 30) * 0.12 * Math.max(0, 1 - k);
      if (k > 1.2) this.trick = null;
    }

    // Pop turn squash-and-stretch
    const ts = this.facing.turnSquash;
    sx *= ts.sx; sy *= ts.sy;
    y += this.facing.turnHop * 0.05;

    this.mesh.scale.set((this.baseW || 0.6) * sx * (this.mirror || 1), (this.baseH || 0.6) * sy, 1);
    this.mesh.position.y = y;
    this.mesh.rotation.z = rz;
    this.root.position.set(f.x, 0, f.z);
    const air = y;
    const auraScale = this.bondLv >= 30 ? 1.35 : 1.0;
    this.shadow.scale.set(
      Math.max(0.25, ((this.baseW || 0.6) * 0.8 - air * 0.4) * auraScale),
      1,
      Math.max(0.12, (0.32 - air * 0.15) * auraScale)
    );

    if (this.giftSprite) {
      this.giftSprite.position.y = this.height + L.baseY + 0.34 + Math.sin(this.t * 4.2) * 0.04;
    }

    if (this.emoteBustSprite) {
      const eb = this.emoteBustSprite;
      eb.userData.life -= dt;
      const age = eb.userData.maxLife - eb.userData.life;
      const pop = age < 0.18 ? 0.5 + (age / 0.18) * 0.58 : 1.0;
      eb.scale.set(0.46 * pop, 0.46 * pop, 1);
      eb.position.y = eb.userData.baseY + Math.sin(age * 4) * 0.03;
      eb.material.opacity = Math.min(1, eb.userData.life * 2.0);
      if (eb.userData.life <= 0) {
        this.billboard.remove(eb);
        eb.material.dispose();
        this.emoteBustSprite = null;
      }
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.userData.life -= dt;
      b.position.y += dt * 0.35;
      b.material.opacity = Math.min(1, b.userData.life * 1.5);
      if (b.userData.life <= 0) { this.billboard.remove(b); b.material.dispose(); this.bubbles.splice(i, 1); }
    }

    if (cam) {
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      this.billboard.rotation.set(e.x * 0.55, e.y, 0, 'YXZ');
    }
  }

  dispose(scene) {
    scene.remove(this.root);
    if (this.emoteBustSprite) {
      this.billboard.remove(this.emoteBustSprite);
      this.emoteBustSprite.material?.dispose();
      this.emoteBustSprite = null;
    }
    if (this.giftSprite) {
      this.billboard.remove(this.giftSprite);
      this.giftSprite.material?.dispose();
      this.giftSprite = null;
    }
    if (this.nameplateSprite) {
      this.billboard.remove(this.nameplateSprite);
      this.nameplateSprite.material?.dispose();
      this.nameplateSprite = null;
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      this.billboard.remove(b);
      b.material?.dispose();
    }
    this.bubbles.length = 0;
    this.root.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const m = o.material.map;
        if (m?.isCanvasTexture && !m.userData?.shared && m !== blobShadowTexture()) {
          m.dispose();
        }
        o.material.dispose?.();
      }
    });
  }
}

/**
 * Unequipped Yard Pet wandering around the Cozy Pet Nest in the Village (up to 3 per island).
 */
export class YardPetController {
  constructor(petData, scene, fx, home = { x: 0, z: 0 }, idx = 0) {
    this.home = { x: home.x, z: home.z };
    const angle = (idx * Math.PI * 2) / 3 + 0.4;
    this.virtualOwner = {
      x: home.x + Math.cos(angle) * 1.2,
      z: home.z + Math.sin(angle) * 1.1 + 0.6,
      vx: 0,
      vz: 0,
      speed: 0,
      moving: false,
      right: Math.cos(angle) >= 0,
      idleFor: 0,
    };
    this.pet = new PetController(petData, scene, fx);
    this.pet.placeNear(this.virtualOwner);
    this.wanderTimer = 1.5 + idx * 1.3;
    this.target = { x: this.virtualOwner.x, z: this.virtualOwner.z };
  }

  update(dt, cam) {
    this.wanderTimer -= dt;
    const vo = this.virtualOwner;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 3.5 + Math.random() * 3.5;
      if (Math.random() < 0.35) {
        // Take a cozy nap or cheer at the nest
        this.pet.act(Math.random() < 0.5 ? 'sleep' : 'happy');
      } else {
        this.pet.act('wake');
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.8 + Math.random() * 1.15;
        this.target = {
          x: this.home.x + Math.cos(ang) * rad,
          z: this.home.z + Math.sin(ang) * rad + 0.4,
        };
      }
    }
    const dx = this.target.x - vo.x;
    const dz = this.target.z - vo.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.08) {
      const step = Math.min(d, 1.35 * dt);
      vo.vx = (dx / d) * 1.35;
      vo.vz = (dz / d) * 1.35;
      vo.x += (dx / d) * step;
      vo.z += (dz / d) * step;
      vo.speed = 1.35;
      vo.moving = true;
      vo.right = dx >= 0;
      vo.idleFor = 0;
    } else {
      vo.vx = 0;
      vo.vz = 0;
      vo.speed = 0;
      vo.moving = false;
      vo.idleFor += dt;
    }
    this.pet.update(dt, vo, cam);
  }

  dispose(scene) {
    this.pet.dispose(scene);
  }
}

export const NUZZLE_OFFSET_Z = 1.75;
export const NUZZLE_HALF_GAP = 0.42;

/**
 * Pet-to-pet social nuzzle (Section 7.B.4): when two owners stand idle within 2.2m,
 * their pets step out into the foreground yard (+1.75m in Z, 0.84m apart) to nuzzle
 * and pop hearts without blocking the couple's characters.
 */
export function updateNuzzles(entries) {
  for (const e of entries) e.claimed = false;
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (a.claimed || a.owner.moving || a.owner.idleFor < 1) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (b.claimed || b.owner.moving || b.owner.idleFor < 1) continue;
      if (Math.hypot(a.owner.x - b.owner.x, a.owner.z - b.owner.z) > NUZZLE_RADIUS) continue;
      const mx = (a.owner.x + b.owner.x) / 2;
      const mz = Math.max(a.owner.z, b.owner.z) + NUZZLE_OFFSET_Z;
      const dir = Math.sign(a.owner.x - b.owner.x) || 1;
      a.pet.nuzzle = { x: mx + dir * NUZZLE_HALF_GAP, z: mz, partner: b.pet };
      b.pet.nuzzle = { x: mx - dir * NUZZLE_HALF_GAP, z: mz, partner: a.pet };
      a.claimed = b.claimed = true;
      break;
    }
  }
  for (const e of entries) if (!e.claimed) e.pet.nuzzle = null;
}

export { damp };
