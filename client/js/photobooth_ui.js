// client/js/photobooth_ui.js — Full Interactive Polaroid Photobooth Studio (Solo & Couple Sanctuary)
// Renders live 3D/2.5D ChibiRig actors (self + bound partner) with bone-driven poses, companion pets,
// scenic backdrops, film filters, draggable stickers, Polaroid frames, handwritten captions,
// 1-tap PNG download / native mobile share, and shared Love Chronicle Scrapbook persistence.

import * as THREE from 'three';
import { ChibiRig } from './chibi_rig.js';
import { loadManifest, spriteInfo } from './assets.js';
import { resolveItemVisual, escapeHtml } from './ui_components.js?v=cd21';
import { PETS } from '/shared/catalog_gear_pets.js';
import { resolvePetSpriteKey } from '/shared/pet_catalog.js';

export const PHOTOBOOTH_BACKDROPS = [
  { id: 'balcony',      icon: '🏛️', label: 'Sanctuary Balcony', url: '/assets/ui/stage_couple_balcony_bridge.jpg', sky: ['#fde2e8', '#f7d6f0'] },
  { id: 'twin_islands', icon: '🌈', label: 'Twin Sky-Islands',  url: '/assets/ui/stage_couple_twin_islands.jpg',  sky: ['#bce4ff', '#ffe2ec'] },
  { id: 'sakura',       icon: '🌸', label: 'Sakura Skyway',     url: '/assets/cloud_dash/sky_sakura.png',         fgUrl: '/assets/ui/stage_sakura_sky_nest.png', sky: ['#ffd6e7', '#fff0f6'] },
  { id: 'aurora',       icon: '🌌', label: 'Aurora Starlight',  url: '/assets/cloud_dash/sky_aurora.png',         sky: ['#1b1947', '#4a3578'] },
  { id: 'olympus',      icon: '⚡', label: 'Olympus Clouds',    url: '/assets/cloud_dash/sky_olympus.png',        sky: ['#ffdfb8', '#fff4d9'] },
  { id: 'ballroom',     icon: '🎰', label: 'Royal Ballroom',    url: '/assets/ui/casino_bg_pokdeng_ballroom.jpg', sky: ['#3b1d16', '#7a3b24'] },
  { id: 'live_world',   icon: '🏝️', label: 'Live 3D Village',   url: null,                                        sky: ['#a8dcff', '#e8f6ff'] },
];

export const PHOTOBOOTH_POSES = [
  { id: 'heart_hands',   icon: '🫶', label: 'Heart Hands',    propUrl: '/assets/ui/couple_prop_heart_hands.png', propY: 0.16, propScale: 0.18 },
  { id: 'sweet_hug',     icon: '🤗', label: 'Cloud Snuggle',  propUrl: '/assets/ui/couple_prop_hug_cloud.png',   propY: 0.72, propScale: 0.46 },
  { id: 'picnic_date',   icon: '🍰', label: 'Boba & Cake',    propUrl: '/assets/ui/couple_prop_picnic_set.png',  propY: 0.84, propScale: 0.34 },
  { id: 'kiss_blush',    icon: '💋', label: 'Sweet Kiss',     propUrl: '/assets/ui/couple_prop_kiss_blush.png',  propY: 0.16, propScale: 0.18 },
  { id: 'peace_jump',    icon: '✌️', label: 'Joyful Jump',    propUrl: null },
  { id: 'sovereign_ult', icon: '⚡', label: 'Sovereign Flex', propUrl: '/assets/ui/fx_magic_circle.png',         propY: 0.78, propScale: 0.52 },
];

export const PHOTOBOOTH_EXPRESSIONS = [
  { id: 'blush',   icon: '😊', label: 'Rosy Blush',   particles: ['💕', '🌸'] },
  { id: 'sparkle', icon: '🤩', label: 'Starry Eyes',  particles: ['✨', '⭐'] },
  { id: 'love',    icon: '😍', label: 'Heart Struck', particles: ['💖', '💗'] },
  { id: 'wink',    icon: '😉', label: 'Playful Wink', particles: ['🎵', '✨'] },
  { id: 'cozy',    icon: '😌', label: 'Sakura Zen',   particles: ['🌸', '🍃'] },
];

export const PHOTOBOOTH_FILTERS = [
  { id: 'warm',    icon: '☀️', label: 'Golden Hour',  tint: 'rgba(255, 212, 148, 0.14)', contrast: 1.04, saturate: 1.10, sepia: 0.06 },
  { id: 'pastel',  icon: '🌸', label: 'Pastel Dream', tint: 'rgba(255, 192, 226, 0.16)', contrast: 0.97, saturate: 1.08, sepia: 0.0 },
  { id: 'vivid',   icon: '✨', label: 'Crystal Vivid',tint: 'rgba(255, 255, 255, 0.0)',  contrast: 1.10, saturate: 1.22, sepia: 0.0 },
  { id: 'vintage', icon: '🎞️', label: '90s Polaroid', tint: 'rgba(244, 210, 158, 0.22)', contrast: 0.95, saturate: 0.88, sepia: 0.24 },
  { id: 'night',   icon: '🌙', label: 'Starlight',    tint: 'rgba(90, 110, 220, 0.20)',  contrast: 1.06, saturate: 1.12, sepia: 0.0 },
];

export const PHOTOBOOTH_FRAMES = [
  {
    id: 'classic',
    icon: '🤍',
    label: 'Classic Cream',
    bg0: '#fffdf9',
    bg1: '#f5ece0',
    border: '#e2d2be',
    innerBorder: '#d5c1a8',
    titleColor: '#4a2c16',
    subColor: '#8c6240',
    cornerGlyph: '✦',
    cornerColor: '#d89b3c',
  },
  {
    id: 'royal_gold',
    icon: '👑',
    label: 'Royal Gold',
    bg0: '#3c2112',
    bg1: '#241209',
    border: '#f0b946',
    innerBorder: '#ffd978',
    titleColor: '#ffe7a8',
    subColor: '#e2b66d',
    cornerGlyph: '👑',
    cornerColor: '#ffd466',
  },
  {
    id: 'sakura_lace',
    icon: '🌸',
    label: 'Sakura Rose',
    bg0: '#fff2f7',
    bg1: '#ffdbe9',
    border: '#f29bb8',
    innerBorder: '#e87ea1',
    titleColor: '#6d2342',
    subColor: '#a64b6f',
    cornerGlyph: '🌸',
    cornerColor: '#e86f9a',
  },
  {
    id: 'starlight_holo',
    icon: '🌌',
    label: 'Starlight Holo',
    bg0: '#1c1836',
    bg1: '#2e2459',
    border: '#9f8fff',
    innerBorder: '#c5baff',
    titleColor: '#f2eeff',
    subColor: '#b9aff5',
    cornerGlyph: '✨',
    cornerColor: '#d4caff',
  },
  {
    id: 'cozy_wood',
    icon: '🪵',
    label: 'Sanctuary Wood',
    bg0: '#f8ebd7',
    bg1: '#e8d0ad',
    border: '#8c5327',
    innerBorder: '#b8763c',
    titleColor: '#42230d',
    subColor: '#7a4924',
    cornerGlyph: '🍃',
    cornerColor: '#a86428',
  },
];

export const PHOTOBOOTH_STICKER_PALETTE = [
  { emoji: '🫶', label: 'Heart Hands' },
  { emoji: '💞', label: 'Revolving Hearts' },
  { emoji: '🌸', label: 'Sakura Blossom' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '👑', label: 'Royal Crown' },
  { emoji: '🐾', label: 'Paw Prints' },
  { emoji: '🧋', label: 'Couple Boba' },
  { emoji: '🍓', label: 'Sweet Berry' },
  { emoji: '💎', label: 'Starlight Gem' },
  { emoji: '💌', label: 'Love Letter' },
];

export const CAPTION_PRESETS = [
  'Our Sky Sanctuary 💖',
  'Best Duo in Cloud Dash ⚡',
  'Boba Date in Neora 🧋',
  'Forever & Always 🌸',
  'Twin Island Sovereigns 👑',
];

export class PhotoboothUI {
  constructor({ getProfile, getPartner, getWorld, request, toast, onSaved } = {}) {
    this.getProfile = getProfile || (() => window.__neora?.state?.profile || {});
    this.getPartner = getPartner || (() => null);
    this.getWorld = getWorld || (() => window.__neora?.world || null);
    this.request = request || ((t, p) => window.__neora?.request?.(t, p));
    this.toast = toast || ((msg) => window.__neora?.toast?.(msg));
    this.onSaved = onSaved || (() => {});

    this.isOpen = false;
    this.activeTab = 'pose'; // 'pose' | 'backdrop' | 'frame' | 'stickers'
    this.mode = 'couple';    // 'couple' | 'solo'
    this.pose = 'heart_hands';
    this.expression = 'blush';
    this.backdrop = 'balcony';
    this.filter = 'warm';
    this.frame = 'classic';
    this.swapSides = false;
    this.showPets = true;
    this.showStreak = true;
    this.showDate = true;
    this.caption = 'Our Sky Sanctuary 💖';
    this.actorOffsetX = 0; // -0.35 .. +0.35 normalized stage pan
    this.actorZoom = 1.0;  // 0.85 .. 1.22

    // Draggable stickers placed on the photo area: [{ id, emoji, x: 0..1, y: 0..1, scale }]
    this.stickers = [
      { id: 'stk_1', emoji: '💞', x: 0.14, y: 0.18, scale: 1.0 },
      { id: 'stk_2', emoji: '✨', x: 0.86, y: 0.16, scale: 1.0 },
    ];
    this.nextStickerId = 3;
    this.dragging = null; // { kind: 'sticker' | 'actors', stickerId, startX, startY, origX, origY }

    // Snapped result state
    this.lastSnap = null; // { pngDataUrl, thumbDataUrl, filename, savedEntry }
    this.snapping = false;
    this.viewingAlbumPhoto = null; // When viewing a saved Polaroid from the Love Chronicle

    // Image cache for 2D canvas compositor
    this.imgCache = new Map();

    // Dedicated WebGL stage for the 2 ChibiRigs
    this.gl = null;
    this.rafId = 0;
    this.lastTs = 0;
    this.stageTime = 0;

    this._injectStyles();
    this._createDom();
  }

  _loadImage(url) {
    if (!url) return null;
    const cached = this.imgCache.get(url);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.imgCache.set(url, img);
    return null;
  }

  _preloadCommonAssets() {
    for (const b of PHOTOBOOTH_BACKDROPS) {
      if (b.url) this._loadImage(b.url);
      if (b.fgUrl) this._loadImage(b.fgUrl);
    }
    for (const p of PHOTOBOOTH_POSES) {
      if (p.propUrl) this._loadImage(p.propUrl);
    }
  }

  _resolvePetSpriteUrl(profile) {
    if (!profile) return null;
    const eqPet = profile.equipped?.pet;
    const petId = eqPet?.id || profile.pets?.[0]?.id || null;
    if (!petId) return null;
    const stars = Math.max(1, Math.min(3, Number(eqPet?.stars) || 1));
    const vTier = Math.max(1, Math.min(stars, Number(eqPet?.visual_tier) || stars));
    if (PETS[petId]) {
      const spr = resolvePetSpriteKey(petId, vTier, 'happy') || resolvePetSpriteKey(petId, vTier, 'front');
      if (spr && spriteInfo(spr)) return `/assets/pets/${spr}.png`;
    }
    const vis = resolveItemVisual(petId, profile.lineage || 'bkk');
    return vis?.url || null;
  }

  async _ensureWebGLStage() {
    if (!this.gl) {
      try {
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(1);
        renderer.setSize(680, 560, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        // Ortho camera framing single or couple chibis cleanly from boots to tall wings/ears
        const cam = new THREE.OrthographicCamera(-1.42, 1.42, 2.02, -0.26, 0.1, 20);
        cam.position.set(0, 0, 5);

        const worldRenderer = this.getWorld()?.renderer || renderer;
        const manifestPromise = spriteInfo('bkk_base_front')
          ? Promise.resolve()
          : loadManifest(worldRenderer);

        this.gl = {
          renderer,
          scene,
          cam,
          selfRig: null,
          partnerRig: null,
          selfKey: '',
          partnerKey: '',
          manifestPromise,
        };
      } catch (err) {
        console.warn('[photobooth] WebGL init error:', err);
        return null;
      }
    }
    await this.gl.manifestPromise;
    return this.gl;
  }

  async _syncRigs() {
    const gl = await this._ensureWebGLStage();
    if (!gl) return;

    const myProf = this.getProfile() || {};
    const partnerProf = this._resolvePartnerData();

    // 1. Self Rig
    const myLin = myProf.lineage === 'dxb' ? 'dxb' : 'bkk';
    const myApp = myProf.appearance || {
      body: myLin === 'dxb' ? 'girl' : 'boy',
      hair: myLin === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy',
      hairColor: myLin === 'dxb' ? 'coral' : 'silver',
    };
    const myKey = `${myLin}|${JSON.stringify(myApp)}|${JSON.stringify(myProf.equipped || {})}`;
    if (!gl.selfRig || gl.selfRig.lineage !== myLin) {
      if (gl.selfRig) {
        gl.scene.remove(gl.selfRig.ROOT);
        gl.selfRig.dispose();
      }
      gl.selfRig = new ChibiRig({ lineage: myLin, appearance: myApp, name: '', sub: '', wings: null });
      gl.selfRig.shadow.visible = true;
      gl.selfRig.nameTag.visible = false;
      gl.scene.add(gl.selfRig.ROOT);
      gl.selfKey = '';
    }
    if (gl.selfKey !== myKey) {
      gl.selfKey = myKey;
      await gl.selfRig.ready;
      await gl.selfRig.setAppearance(myApp);
      await gl.selfRig.setEquipment(myProf.equipped || {});
    }

    // 2. Partner Rig
    const wantPartner = this.mode === 'couple' && partnerProf;
    if (wantPartner) {
      const pLin = partnerProf.lineage === 'dxb' ? 'dxb' : 'bkk';
      const pApp = partnerProf.appearance || {
        body: pLin === 'dxb' ? 'girl' : 'boy',
        hair: pLin === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy',
        hairColor: pLin === 'dxb' ? 'coral' : 'chestnut',
      };
      const pKey = `${pLin}|${JSON.stringify(pApp)}|${JSON.stringify(partnerProf.equipped || {})}`;
      if (!gl.partnerRig || gl.partnerRig.lineage !== pLin) {
        if (gl.partnerRig) {
          gl.scene.remove(gl.partnerRig.ROOT);
          gl.partnerRig.dispose();
        }
        gl.partnerRig = new ChibiRig({ lineage: pLin, appearance: pApp, name: '', sub: '', wings: null });
        gl.partnerRig.shadow.visible = true;
        gl.partnerRig.nameTag.visible = false;
        gl.scene.add(gl.partnerRig.ROOT);
        gl.partnerKey = '';
      }
      gl.partnerRig.ROOT.visible = true;
      if (gl.partnerKey !== pKey) {
        gl.partnerKey = pKey;
        await gl.partnerRig.ready;
        await gl.partnerRig.setAppearance(pApp);
        await gl.partnerRig.setEquipment(partnerProf.equipped || {});
      }
    } else if (gl.partnerRig) {
      gl.partnerRig.ROOT.visible = false;
    }

    // Preload pet sprites
    const myPetUrl = this._resolvePetSpriteUrl(myProf);
    if (myPetUrl) this._loadImage(myPetUrl);
    if (partnerProf) {
      const pPetUrl = this._resolvePetSpriteUrl(partnerProf);
      if (pPetUrl) this._loadImage(pPetUrl);
    }
  }

  _resolvePartnerData() {
    const fromCallback = this.getPartner?.();
    if (fromCallback && (fromCallback.id || fromCallback.username)) return fromCallback;
    const vc = window.__neora?.voiceClient;
    const dirPartner = vc?.directory?.partner;
    if (dirPartner) return dirPartner;
    const myProf = this.getProfile() || {};
    if (!myProf.partner_id) return null;
    // Check if partner is in current 3D instance remotes
    const rem = this.getWorld()?.remotes?.get?.(myProf.partner_id);
    if (rem?.data) {
      return {
        id: rem.data.id || myProf.partner_id,
        username: rem.data.username || myProf.partner_id,
        lineage: rem.data.lineage || (myProf.lineage === 'bkk' ? 'dxb' : 'bkk'),
        appearance: rem.data.appearance || null,
        equipped: rem.data.equipped || {},
        couple_streak: myProf.couple_streak || 1,
      };
    }
    const defGirl = myProf.lineage !== 'dxb';
    return {
      id: myProf.partner_id,
      username: myProf.partner_id,
      lineage: defGirl ? 'dxb' : 'bkk',
      appearance: {
        body: defGirl ? 'girl' : 'boy',
        hair: defGirl ? 'hair_girl_waves' : 'hair_boy_fluffy',
        hairColor: defGirl ? 'chestnut' : 'silver',
      },
      equipped: { outfit: { id: 'newbie_outfit' } },
      couple_streak: myProf.couple_streak || 1,
    };
  }

  /**
   * Applies live procedural bone poses to a ChibiRig for the active Photobooth pose.
   * sideSign: -1 for left actor (facing right), +1 for right actor (facing left), 0 for solo center.
   */
  _poseRig(rig, sideSign, t, dt) {
    if (!rig || !rig.views) return;
    const stowWeapon = sideSign !== 0 && this.pose !== 'sovereign_ult';
    rig.couplePose = stowWeapon ? { pose: this.pose, role: sideSign < 0 ? 'left' : 'right', t: 0, dur: 9999, loop: true } : null;
    rig.update(dt, { vx: 0, vz: 0, walkWeight: 0 }, null);
    rig.couplePose = stowWeapon ? { pose: this.pose, role: sideSign < 0 ? 'left' : 'right', t: 0, dur: 9999, loop: true } : null;

    const faceRight = sideSign <= 0;
    const wantView = (this.pose === 'kiss_blush' && sideSign !== 0 && rig.views?.side) ? 'side' : 'front';
    if (rig.shownView !== wantView || rig.shownRight !== faceRight || rig._lastStow !== stowWeapon) {
      rig._lastStow = stowWeapon;
      rig.applyView(wantView, faceRight);
    }

    const u = rig.material.uniforms;
    const inward = sideSign === 0 ? 1 : -sideSign; // +1 for left actor leaning right, -1 for right actor leaning left
    const zoom = this.actorZoom || 1.0;

    let torso = Math.sin(t * 2.2) * 0.025;
    let head = Math.sin(t * 1.8 - 0.4) * 0.03;
    let armL = -0.08 + Math.sin(t * 2.2) * 0.04;
    let armR = 0.08 - Math.sin(t * 2.2) * 0.04;
    let legL = 0;
    let legR = 0;
    let hopY = 0;
    let rim = 0.75;

    switch (this.pose) {
      case 'heart_hands': {
        torso = inward * 0.08 + Math.sin(t * 2.4) * 0.02;
        head = inward * 0.12 + Math.sin(t * 2.4 - 0.4) * 0.03;
        if (sideSign <= 0) {
          armR = 0.68 + Math.sin(t * 3.0) * 0.05;
          armL = -0.22;
        } else {
          armL = -0.68 - Math.sin(t * 3.0) * 0.05;
          armR = 0.22;
        }
        hopY = Math.abs(Math.sin(t * 2.4)) * 0.03;
        break;
      }
      case 'sweet_hug': {
        torso = inward * 0.13 + Math.sin(t * 2.0) * 0.018;
        head = inward * 0.17 + Math.sin(t * 2.0 - 0.3) * 0.025;
        armL = -0.38;
        armR = 0.38;
        hopY = Math.sin(t * 2.0) * 0.015;
        break;
      }
      case 'picnic_date': {
        const b = Math.sin(t * 3.2);
        torso = b * 0.05;
        head = -b * 0.07 + inward * 0.06;
        armL = -0.45 + b * 0.10;
        armR = 0.45 - b * 0.10;
        hopY = Math.abs(b) * 0.045;
        break;
      }
      case 'kiss_blush': {
        torso = inward * 0.15;
        head = inward * 0.20 + Math.sin(t * 2.2) * 0.02;
        armL = -0.28;
        armR = 0.28;
        legL = sideSign <= 0 ? -0.18 : 0.04;
        legR = sideSign > 0 ? 0.18 : -0.04;
        hopY = 0.02;
        break;
      }
      case 'peace_jump': {
        const j = Math.abs(Math.sin(t * 3.8));
        hopY = 0.16 + j * 0.12;
        torso = inward * 0.05;
        head = -0.06 + Math.sin(t * 3.8) * 0.04;
        armL = -0.82 - j * 0.12;
        armR = 0.82 + j * 0.12;
        legL = -0.28 * j;
        legR = 0.28 * j;
        break;
      }
      case 'sovereign_ult': {
        const f = Math.sin(t * 3.0);
        hopY = 0.22 + (0.5 + 0.5 * f) * 0.08;
        torso = f * 0.04;
        head = -f * 0.05;
        armL = -0.76;
        armR = 0.76;
        legL = -0.14;
        legR = 0.14;
        rim = 1.85;
        break;
      }
      default:
        break;
    }

    u.uTorso.value = torso;
    u.uHead.value = head;
    u.uArmL.value = armL;
    u.uArmR.value = armR;
    u.uLegL.value = legL;
    u.uLegR.value = legR;
    u.uRim.value = rim;
    rig.syncBones();

    rig.HIP.position.y = hopY;
    rig.ROOT.scale.set(zoom, zoom, 1);

    // Extra wing flap on joyful jump & sovereign ult
    const wingSpeed = this.pose === 'sovereign_ult' ? 4.5 : this.pose === 'peace_jump' ? 3.2 : 1.5;
    const flap = Math.sin(t * Math.PI * 2 * wingSpeed);
    for (const w of rig.wingMeshes || []) {
      w.scale.x = 1 - 0.18 * (0.5 + 0.5 * flap);
      w.rotation.z = w.userData.side * (0.06 + 0.10 * flap);
    }
  }

  _stepAndRenderPolaroid(dt, targetCanvas, width = 720, height = 880) {
    if (!targetCanvas) return;
    if (targetCanvas.width !== width || targetCanvas.height !== height) {
      targetCanvas.width = width;
      targetCanvas.height = height;
    }
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    this.stageTime += dt;
    const t = this.stageTime;

    const myProf = this.getProfile() || {};
    const partnerProf = this._resolvePartnerData();
    const isCouple = this.mode === 'couple' && !!partnerProf;
    const frameDef = PHOTOBOOTH_FRAMES.find((f) => f.id === this.frame) || PHOTOBOOTH_FRAMES[0];
    const backdropDef = PHOTOBOOTH_BACKDROPS.find((b) => b.id === this.backdrop) || PHOTOBOOTH_BACKDROPS[0];
    const filterDef = PHOTOBOOTH_FILTERS.find((f) => f.id === this.filter) || PHOTOBOOTH_FILTERS[0];
    const poseDef = PHOTOBOOTH_POSES.find((p) => p.id === this.pose) || PHOTOBOOTH_POSES[0];
    const exprDef = PHOTOBOOTH_EXPRESSIONS.find((e) => e.id === this.expression) || PHOTOBOOTH_EXPRESSIONS[0];

    const W = width;
    const H = height;
    const padX = Math.round(W * 0.058);
    const padTop = Math.round(W * 0.058);
    const photoW = W - padX * 2;
    const photoH = Math.round(H * 0.725);
    const photoX = padX;
    const photoY = padTop;

    ctx.clearRect(0, 0, W, H);

    // 1. Polaroid Outer Card Body
    const cardGrad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    cardGrad.addColorStop(0, frameDef.bg0);
    cardGrad.addColorStop(1, frameDef.bg1);
    ctx.fillStyle = cardGrad;
    this._roundRect(ctx, 0, 0, W, H, Math.round(W * 0.036));
    ctx.fill();

    // Outer Border
    ctx.lineWidth = Math.max(3, Math.round(W * 0.008));
    ctx.strokeStyle = frameDef.border;
    this._roundRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth, Math.round(W * 0.036));
    ctx.stroke();

    // Decorative corner glyphs on card
    ctx.save();
    ctx.fillStyle = frameDef.cornerColor;
    ctx.font = `900 ${Math.round(W * 0.028)}px "Nunito", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cOff = Math.round(W * 0.032);
    ctx.fillText(frameDef.cornerGlyph, cOff, cOff);
    ctx.fillText(frameDef.cornerGlyph, W - cOff, cOff);
    ctx.fillText(frameDef.cornerGlyph, cOff, H - cOff);
    ctx.fillText(frameDef.cornerGlyph, W - cOff, H - cOff);
    ctx.restore();

    // 2. Photo Viewport Clip
    ctx.save();
    this._roundRect(ctx, photoX, photoY, photoW, photoH, Math.round(W * 0.022));
    ctx.clip();

    // Apply CSS-style filter for contrast/saturate/sepia
    if ('filter' in ctx) {
      ctx.filter = `contrast(${filterDef.contrast}) saturate(${filterDef.saturate}) sepia(${filterDef.sepia})`;
    }

    // 2a. Sky gradient fallback
    const skyGrad = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    skyGrad.addColorStop(0, backdropDef.sky?.[0] || '#fde2e8');
    skyGrad.addColorStop(1, backdropDef.sky?.[1] || '#f7d6f0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // 2b. Backdrop image or live 3D world canvas
    if (backdropDef.id === 'live_world') {
      const worldCanvas = this.getWorld()?.renderer?.domElement;
      if (worldCanvas && worldCanvas.width > 0 && worldCanvas.height > 0) {
        this._drawCover(ctx, worldCanvas, photoX, photoY, photoW, photoH);
      }
    } else if (backdropDef.url) {
      const bgImg = this._loadImage(backdropDef.url);
      if (bgImg) {
        this._drawCover(ctx, bgImg, photoX, photoY, photoW, photoH);
      }
    }

    // Optional foreground stage island (e.g. Sakura Sky Nest)
    if (backdropDef.fgUrl) {
      const fgImg = this._loadImage(backdropDef.fgUrl);
      if (fgImg) {
        const fgW = photoW * 0.92;
        const fgH = (fgImg.naturalHeight / Math.max(1, fgImg.naturalWidth)) * fgW;
        ctx.drawImage(fgImg, photoX + (photoW - fgW) * 0.5, photoY + photoH - fgH * 0.86, fgW, fgH);
      }
    }

    // 2c. Pose background prop (e.g., Sovereign magic circle or Cloud Snuggle frame behind characters)
    if (poseDef.propUrl && (this.pose === 'sovereign_ult' || this.pose === 'sweet_hug')) {
      const propImg = this._loadImage(poseDef.propUrl);
      if (propImg) {
        const pW = photoW * (poseDef.propScale || 0.48);
        const pH = (propImg.naturalHeight / Math.max(1, propImg.naturalWidth)) * pW;
        const px = photoX + photoW * (0.5 + this.actorOffsetX * 0.5) - pW * 0.5;
        const py = photoY + photoH * (poseDef.propY || 0.55) - pH * 0.5;
        ctx.save();
        ctx.globalAlpha = this.pose === 'sovereign_ult' ? 0.82 : 0.92;
        ctx.drawImage(propImg, px, py, pW, pH);
        ctx.restore();
      }
    }

    // 2d. Step & Draw WebGL ChibiRigs (Self + Partner)
    const gl = this.gl;
    if (gl && gl.selfRig) {
      const closePose = this.pose === 'sweet_hug' || this.pose === 'kiss_blush';
      const spread = isCouple ? (this.pose === 'picnic_date' ? 0.62 : closePose ? 0.42 : 0.54) : 0;
      const panWorld = this.actorOffsetX * 0.95;

      if (isCouple && gl.partnerRig) {
        const selfSide = this.swapSides ? 1 : -1;
        const partSide = -selfSide;
        gl.selfRig.ROOT.position.set(selfSide * spread + panWorld, 0, 0.02);
        gl.partnerRig.ROOT.position.set(partSide * spread + panWorld, 0, 0);
        gl.partnerRig.ROOT.visible = true;
        this._poseRig(gl.selfRig, selfSide, t, dt);
        this._poseRig(gl.partnerRig, partSide, t + 0.35, dt);
      } else {
        if (gl.partnerRig) gl.partnerRig.ROOT.visible = false;
        gl.selfRig.ROOT.position.set(panWorld, 0, 0);
        this._poseRig(gl.selfRig, 0, t, dt);
      }

      gl.renderer.render(gl.scene, gl.cam);
      const glCanvas = gl.renderer.domElement;
      const stageW = photoW * 1.02;
      const stageH = (glCanvas.height / glCanvas.width) * stageW;
      const stageX = photoX + (photoW - stageW) * 0.5;
      const stageY = photoY + photoH - stageH * 0.95;
      ctx.drawImage(glCanvas, stageX, stageY, stageW, stageH);
    }

    // 2e. Companion Pets (left & right corners of stage)
    if (this.showPets) {
      const myPetUrl = this._resolvePetSpriteUrl(myProf);
      const myPetImg = myPetUrl ? this._loadImage(myPetUrl) : null;
      const pPetUrl = isCouple ? this._resolvePetSpriteUrl(partnerProf) : null;
      const pPetImg = pPetUrl ? this._loadImage(pPetUrl) : null;
      const petBob = Math.sin(t * 3.4) * (photoH * 0.01);
      const petSize = photoW * 0.23 * Math.min(1.12, this.actorZoom);

      const leftImg = this.swapSides && isCouple ? pPetImg : myPetImg;
      const rightImg = this.swapSides && isCouple ? myPetImg : pPetImg;

      if (leftImg) {
        const aspect = leftImg.naturalHeight / Math.max(1, leftImg.naturalWidth);
        const w = petSize;
        const h = petSize * aspect;
        const lx = photoX + photoW * (isCouple ? 0.04 : 0.64) + this.actorOffsetX * photoW * 0.3;
        const ly = photoY + photoH * 0.66 - h * 0.5 + petBob;
        ctx.drawImage(leftImg, lx, ly, w, h);
      }
      if (isCouple && rightImg) {
        const aspect = rightImg.naturalHeight / Math.max(1, rightImg.naturalWidth);
        const w = petSize;
        const h = petSize * aspect;
        const rx = photoX + photoW * 0.96 - w + this.actorOffsetX * photoW * 0.3;
        const ry = photoY + photoH * 0.66 - h * 0.5 - petBob;
        ctx.save();
        ctx.translate(rx + w, ry);
        ctx.scale(-1, 1);
        ctx.drawImage(rightImg, 0, 0, w, h);
        ctx.restore();
      }
    }

    // 2f. Foreground Pose Prop (Heart Hands, Sweet Kiss, or Picnic Set)
    if (poseDef.propUrl && this.pose !== 'sovereign_ult' && this.pose !== 'sweet_hug') {
      const propImg = this._loadImage(poseDef.propUrl);
      if (propImg) {
        const pulse = 1 + Math.sin(t * 3.6) * 0.04;
        const pW = photoW * (poseDef.propScale || 0.25) * pulse;
        const pH = (propImg.naturalHeight / Math.max(1, propImg.naturalWidth)) * pW;
        const px = photoX + photoW * (0.5 + this.actorOffsetX * 0.45) - pW * 0.5;
        const py = photoY + photoH * (poseDef.propY || 0.42) - pH * 0.5;
        ctx.drawImage(propImg, px, py, pW, pH);
      }
    }

    if ('filter' in ctx) ctx.filter = 'none';

    // 2g. Expression Blush & Floating Mood Particles
    this._drawExpressionOverlays(ctx, photoX, photoY, photoW, photoH, isCouple, exprDef, t);

    // 2h. Color-Grading Tint & Soft Vignette
    if (filterDef.tint && filterDef.tint !== 'rgba(255, 255, 255, 0.0)') {
      ctx.fillStyle = filterDef.tint;
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }
    const vig = ctx.createRadialGradient(
      photoX + photoW * 0.5,
      photoY + photoH * 0.48,
      photoW * 0.28,
      photoX + photoW * 0.5,
      photoY + photoH * 0.5,
      photoW * 0.76
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, this.filter === 'night' ? 'rgba(12, 10, 38, 0.36)' : 'rgba(48, 22, 10, 0.20)');
    ctx.fillStyle = vig;
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // 2i. Custom Placed Stickers
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const stk of this.stickers) {
      const sx = photoX + stk.x * photoW;
      const sy = photoY + stk.y * photoH;
      const fontSize = Math.round(photoW * 0.088 * (stk.scale || 1));
      ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 6;
      ctx.fillText(stk.emoji, sx, sy);
    }
    ctx.restore();

    // 2j. Top-Left Couple Streak / Solo Title Badge inside Photo
    if (this.showStreak) {
      const streakDays = Math.max(myProf.couple_streak || 1, partnerProf?.couple_streak || 1);
      const badgeTxt = isCouple
        ? `💖 ${streakDays}-Day Sanctuary Streak`
        : `👑 ${myProf.title || 'Sky Sovereign'} • Lv.${myProf.level || 1}`;
      ctx.save();
      ctx.font = `900 ${Math.round(photoW * 0.033)}px "Nunito", sans-serif`;
      const tw = ctx.measureText(badgeTxt).width;
      const bx = photoX + Math.round(photoW * 0.032);
      const by = photoY + Math.round(photoH * 0.032);
      const bw = tw + Math.round(photoW * 0.055);
      const bh = Math.round(photoH * 0.064);
      ctx.fillStyle = 'rgba(42, 20, 14, 0.74)';
      this._roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, photoW * 0.003);
      ctx.strokeStyle = 'rgba(255, 214, 122, 0.85)';
      ctx.stroke();
      ctx.fillStyle = '#fff5df';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeTxt, bx + Math.round(photoW * 0.026), by + bh * 0.52);
      ctx.restore();
    }

    // 2k. Bottom-Right Retro Film Date Stamp
    if (this.showDate) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateStr = `'${yy} ${mm} ${dd}`;
      ctx.save();
      ctx.font = `900 ${Math.round(photoW * 0.032)}px "Courier New", monospace`;
      ctx.fillStyle = '#ffb347';
      ctx.shadowColor = 'rgba(180, 50, 0, 0.85)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(dateStr, photoX + photoW - Math.round(photoW * 0.032), photoY + photoH - Math.round(photoH * 0.025));
      ctx.restore();
    }

    ctx.restore(); // End Photo Viewport Clip

    // 2l. Photo Inner Frame Stroke
    ctx.lineWidth = Math.max(2, Math.round(W * 0.004));
    ctx.strokeStyle = frameDef.innerBorder;
    this._roundRect(ctx, photoX, photoY, photoW, photoH, Math.round(W * 0.022));
    ctx.stroke();

    // 3. Polaroid Bottom Chin — Handwritten Caption & Names Signature
    const chinTop = photoY + photoH;
    const chinH = H - chinTop;
    const centerX = W * 0.5;

    // Handwritten-style Main Caption
    const captionText = (this.caption || '').trim() || (isCouple ? 'Our Sky Sanctuary 💖' : 'Neora World Memories ✨');
    ctx.save();
    ctx.fillStyle = frameDef.titleColor;
    ctx.font = `900 ${Math.round(W * 0.045)}px "Fredoka", "Nunito", cursive, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(captionText, centerX, chinTop + chinH * 0.39, W - padX * 2.2);

    // Subtitle: Player Names + Backdrop Location
    const myName = myProf.username || myProf.id || 'Adventurer';
    const partName = partnerProf?.username || partnerProf?.name || partnerProf?.id || 'Partner';
    const leftName = this.swapSides && isCouple ? partName : myName;
    const rightName = this.swapSides && isCouple ? myName : partName;
    const namesLine = isCouple
      ? `💞 ${leftName} & ${rightName}  •  ${backdropDef.icon} ${backdropDef.label}`
      : `✨ ${myName}  •  ${backdropDef.icon} ${backdropDef.label}`;

    ctx.fillStyle = frameDef.subColor;
    ctx.font = `800 ${Math.round(W * 0.027)}px "Nunito", sans-serif`;
    ctx.fillText(namesLine, centerX, chinTop + chinH * 0.72, W - padX * 2.2);
    ctx.restore();
  }

  _drawExpressionOverlays(ctx, x, y, w, h, isCouple, exprDef, t) {
    const panPx = this.actorOffsetX * w * 0.34;
    const closePose = this.pose === 'sweet_hug' || this.pose === 'kiss_blush';
    const headPositions = isCouple
      ? [
          { cx: x + w * (closePose ? 0.39 : 0.33) + panPx, cy: y + h * 0.43 },
          { cx: x + w * (closePose ? 0.61 : 0.67) + panPx, cy: y + h * 0.43 },
        ]
      : [{ cx: x + w * 0.5 + panPx, cy: y + h * 0.43 }];

    ctx.save();
    // Rosy cheek blush circles on characters
    if (exprDef.id === 'blush' || exprDef.id === 'love' || this.pose === 'kiss_blush') {
      for (const hp of headPositions) {
        for (const dx of [-w * 0.045, w * 0.045]) {
          const r = w * 0.028;
          const grad = ctx.createRadialGradient(hp.cx + dx, hp.cy + h * 0.02, 0, hp.cx + dx, hp.cy + h * 0.02, r);
          grad.addColorStop(0, 'rgba(255, 105, 155, 0.46)');
          grad.addColorStop(1, 'rgba(255, 105, 155, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(hp.cx + dx, hp.cy + h * 0.02, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Floating expression particles around characters
    const glyphs = exprDef.particles || ['✨'];
    ctx.font = `${Math.round(w * 0.048)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const phase = t * 1.1 + i * 1.05;
      const gx = x + w * (0.15 + ((i * 0.14 + Math.sin(phase) * 0.03) % 0.72));
      const gy = y + h * (0.20 + ((i * 0.11 + Math.cos(phase * 0.9) * 0.04) % 0.46));
      ctx.globalAlpha = 0.62 + 0.35 * Math.sin(phase * 2);
      ctx.fillText(glyphs[i % glyphs.length], gx, gy);
    }
    ctx.restore();
  }

  _drawCover(ctx, imgOrCanvas, x, y, w, h) {
    const iw = imgOrCanvas.naturalWidth || imgOrCanvas.width || w;
    const ih = imgOrCanvas.naturalHeight || imgOrCanvas.height || h;
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (iw - sw) * 0.5;
    const sy = (ih - sh) * 0.5;
    ctx.drawImage(imgOrCanvas, sx, sy, sw, sh, x, y, w, h);
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  _playShutterSfx() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ac = new Ctx();
      const now = ac.currentTime;
      // Mechanical shutter click + warm sparkle chord
      const freqs = [920, 1480, 659.25, 880, 1318.5];
      freqs.forEach((f, idx) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = idx < 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.045);
        g.gain.setValueAtTime(idx < 2 ? 0.14 : 0.09, now + idx * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + (idx < 2 ? 0.06 : 0.28));
        osc.connect(g);
        g.connect(ac.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.3);
      });
      setTimeout(() => ac.close().catch(() => {}), 900);
    } catch {
      /* ignore audio context restrictions */
    }
  }

  async open(opts = {}) {
    this._preloadCommonAssets();
    const myProf = this.getProfile() || {};
    const partnerProf = this._resolvePartnerData();
    const hasPartner = !!partnerProf;

    this.viewingAlbumPhoto = opts.viewPhoto || null;
    this.mode = opts.mode || (hasPartner ? 'couple' : 'solo');
    if (opts.pose && PHOTOBOOTH_POSES.some((p) => p.id === opts.pose)) {
      this.pose = opts.pose;
    }
    if (opts.backdrop && PHOTOBOOTH_BACKDROPS.some((b) => b.id === opts.backdrop)) {
      this.backdrop = opts.backdrop;
    } else if (!hasPartner && this.backdrop === 'balcony') {
      this.backdrop = 'sakura';
    }
    if (!this.caption || this.caption === 'Our Sky Sanctuary 💖') {
      this.caption = this.mode === 'couple' && partnerProf
        ? `${myProf.username || myProf.id} & ${partnerProf.username || partnerProf.name || partnerProf.id} 💖`
        : `${myProf.username || myProf.id}'s Sky Portrait ✨`;
    }

    this.lastSnap = null;
    this.isOpen = true;
    this.overlayEl.hidden = false;
    this.renderControls();

    await this._syncRigs();
    this._startLoop();
  }

  close() {
    this.isOpen = false;
    this.viewingAlbumPhoto = null;
    if (this.overlayEl) this.overlayEl.hidden = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  _startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lastTs = performance.now();
    const tick = (now) => {
      if (!this.isOpen || this.overlayEl?.hidden) {
        this.rafId = 0;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      if (!this.viewingAlbumPhoto && this.previewCanvas) {
        this._stepAndRenderPolaroid(dt, this.previewCanvas, 720, 880);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  async snapPolaroid() {
    if (this.snapping) return;
    this.snapping = true;
    this._playShutterSfx();

    // Trigger white camera flash animation
    const flashEl = this.overlayEl?.querySelector('.pb-shutter-flash');
    if (flashEl) {
      flashEl.classList.remove('is-flashing');
      void flashEl.offsetWidth;
      flashEl.classList.add('is-flashing');
    }

    try {
      await this._syncRigs();
      // 1. Render High-Resolution Export Polaroid (1080×1320)
      const hiCanvas = document.createElement('canvas');
      this._stepAndRenderPolaroid(0.016, hiCanvas, 1080, 1320);
      const pngDataUrl = hiCanvas.toDataURL('image/png');

      // 2. Render Compact Album Thumbnail (360×440 JPEG) for fast WebSocket & Love Chronicle storage
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 360;
      thumbCanvas.height = 440;
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.drawImage(hiCanvas, 0, 0, 360, 440);
      const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.82);

      const myProf = this.getProfile() || {};
      const partnerProf = this._resolvePartnerData();
      const slug = this.mode === 'couple' && partnerProf
        ? `${myProf.username || myProf.id}-${partnerProf.username || partnerProf.id}`
        : `${myProf.username || myProf.id}`;
      const filename = `neora-polaroid-${slug}-${Date.now().toString().slice(-5)}.png`;

      const photoPayload = {
        id: `pol_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        mode: this.mode,
        caption: this.caption,
        pose: this.pose,
        backdrop: this.backdrop,
        frame: this.frame,
        filter: this.filter,
        expression: this.expression,
        thumbDataUrl,
      };

      let savedEntry = photoPayload;
      if (this.request) {
        const res = await this.request('couple_moment', {
          kind: 'polaroid',
          pose: this.pose,
          mood: this.expression,
          photo: photoPayload,
        });
        if (res?.ok && res.photo) {
          savedEntry = res.photo;
        }
        this.onSaved?.(res);
      }

      this.lastSnap = {
        pngDataUrl,
        thumbDataUrl,
        filename,
        savedEntry,
      };

      // Trigger local pet happy emote in village
      const world = this.getWorld();
      world?.local?.pet?.act?.('happy');
      world?.local?.pet?.showEmote?.('love');

      this.toast(
        this.mode === 'couple' && partnerProf
          ? '📸 Snapped Couple Polaroid! Saved to your shared Love Chronicle Album & +25% Harmony Buff! 💖'
          : '📸 Polaroid Snapped! Ready to Download or Share! ✨'
      );
    } catch (err) {
      console.warn('[photobooth] snap error:', err);
      this.toast('⚠️ Could not capture Polaroid');
    } finally {
      this.snapping = false;
      this.renderControls();
    }
  }

  downloadPng(dataUrl, filename = 'neora-polaroid.png') {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.toast('💾 Polaroid saved to your device!');
  }

  async sharePng(dataUrl, filename = 'neora-polaroid.png') {
    if (!dataUrl) return;
    try {
      if (navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type || 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Neora World Polaroid 💖',
            text: this.caption || 'Our Sky Sanctuary Polaroid 💖',
            files: [file],
          });
          return;
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    this.downloadPng(dataUrl, filename);
  }

  _bindCanvasDrag(canvas) {
    if (!canvas || canvas._pbDragBound) return;
    canvas._pbDragBound = true;

    const getNormPos = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const nx = (clientX - rect.left) / Math.max(1, rect.width);
      const ny = (clientY - rect.top) / Math.max(1, rect.height);
      // Map to photo inner box (padX = 0.058, photoW = 0.884, photoY = 0.058*(720/880)=0.047, photoH = 0.725)
      const px = (nx - 0.058) / 0.884;
      const py = (ny - 0.047) / 0.725;
      return { px, py, nx, ny };
    };

    const onDown = (ev) => {
      if (this.viewingAlbumPhoto) return;
      const { px, py } = getNormPos(ev);
      if (px < 0 || px > 1 || py < 0 || py > 1) return;

      // Check if user tapped on a placed sticker first
      for (let i = this.stickers.length - 1; i >= 0; i--) {
        const stk = this.stickers[i];
        const dist = Math.hypot(px - stk.x, py - stk.y);
        if (dist < 0.09) {
          this.dragging = { kind: 'sticker', sticker: stk, startX: px, startY: py, origX: stk.x, origY: stk.y };
          if (ev.cancelable) ev.preventDefault();
          return;
        }
      }

      // Otherwise drag actors left/right
      this.dragging = { kind: 'actors', startX: px, origOffsetX: this.actorOffsetX };
    };

    const onMove = (ev) => {
      if (!this.dragging) return;
      const { px, py } = getNormPos(ev);
      if (this.dragging.kind === 'sticker' && this.dragging.sticker) {
        this.dragging.sticker.x = Math.max(0.06, Math.min(0.94, px));
        this.dragging.sticker.y = Math.max(0.06, Math.min(0.94, py));
        if (ev.cancelable) ev.preventDefault();
      } else if (this.dragging.kind === 'actors') {
        const dx = px - this.dragging.startX;
        this.actorOffsetX = Math.max(-0.35, Math.min(0.35, this.dragging.origOffsetX + dx));
      }
    };

    const onUp = () => {
      this.dragging = null;
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _createDom() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('photobooth-modal');
    if (!el) {
      el = document.createElement('section');
      el.id = 'photobooth-modal';
      el.className = 'pb-modal-backdrop';
      el.hidden = true;
      document.body.appendChild(el);
    } else if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    this.overlayEl = el;

    el.addEventListener('click', async (ev) => {
      if (ev.target === el) {
        this.close();
        return;
      }
      const btn = ev.target.closest('[data-pb-act]');
      if (!btn) return;
      const act = btn.dataset.pbAct;

      if (act === 'close') {
        this.close();
      } else if (act === 'tab') {
        this.activeTab = btn.dataset.tab || 'pose';
        this.renderControls();
      } else if (act === 'mode') {
        const nextMode = btn.dataset.mode;
        if (nextMode === 'couple' && !this._resolvePartnerData()) {
          this.toast('💞 Bind with a partner in the Couple Hub to unlock Couple Mode!');
          return;
        }
        this.mode = nextMode;
        await this._syncRigs();
        this.renderControls();
      } else if (act === 'swap-sides') {
        this.swapSides = !this.swapSides;
        this.renderControls();
      } else if (act === 'toggle-pets') {
        this.showPets = !this.showPets;
        this.renderControls();
      } else if (act === 'toggle-streak') {
        this.showStreak = !this.showStreak;
        this.renderControls();
      } else if (act === 'toggle-date') {
        this.showDate = !this.showDate;
        this.renderControls();
      } else if (act === 'zoom-in') {
        this.actorZoom = Math.min(1.22, +(this.actorZoom + 0.08).toFixed(2));
      } else if (act === 'zoom-out') {
        this.actorZoom = Math.max(0.84, +(this.actorZoom - 0.08).toFixed(2));
      } else if (act === 'reset-pos') {
        this.actorOffsetX = 0;
        this.actorZoom = 1.0;
      } else if (act === 'pose') {
        this.pose = btn.dataset.id;
        this.renderControls();
      } else if (act === 'expression') {
        this.expression = btn.dataset.id;
        this.renderControls();
      } else if (act === 'backdrop') {
        this.backdrop = btn.dataset.id;
        this.renderControls();
      } else if (act === 'filter') {
        this.filter = btn.dataset.id;
        this.renderControls();
      } else if (act === 'frame') {
        this.frame = btn.dataset.id;
        this.renderControls();
      } else if (act === 'add-sticker') {
        const emoji = btn.dataset.emoji;
        if (emoji) {
          if (this.stickers.length >= 10) this.stickers.shift();
          this.stickers.push({
            id: `stk_${this.nextStickerId++}`,
            emoji,
            x: 0.22 + Math.random() * 0.56,
            y: 0.16 + Math.random() * 0.48,
            scale: 1.0,
          });
          this.renderControls();
        }
      } else if (act === 'clear-stickers') {
        this.stickers = [];
        this.renderControls();
      } else if (act === 'caption-preset') {
        this.caption = btn.dataset.text || '';
        const inp = this.overlayEl.querySelector('#pb-caption-input');
        if (inp) inp.value = this.caption;
      } else if (act === 'snap') {
        await this.snapPolaroid();
      } else if (act === 'download') {
        const url = this.viewingAlbumPhoto?.thumbDataUrl || this.lastSnap?.pngDataUrl;
        const name = this.lastSnap?.filename || `neora-polaroid-${this.viewingAlbumPhoto?.id || Date.now()}.jpg`;
        this.downloadPng(url, name);
      } else if (act === 'share') {
        const url = this.viewingAlbumPhoto?.thumbDataUrl || this.lastSnap?.pngDataUrl;
        const name = this.lastSnap?.filename || `neora-polaroid-${this.viewingAlbumPhoto?.id || Date.now()}.jpg`;
        await this.sharePng(url, name);
      } else if (act === 'back-to-studio') {
        this.viewingAlbumPhoto = null;
        this.renderControls();
        await this._syncRigs();
        this._startLoop();
      } else if (act === 'back-to-chronicle') {
        this.close();
        window.__neora?.voiceClient?.openSwitchboard?.('couple');
      } else if (act === 'open-3d-cam') {
        this.close();
        window.__neora?.couplePhotobooth?.openPhotobooth?.({ initialPose: 'heart_hands' });
      }
    });

    el.addEventListener('input', (ev) => {
      if (ev.target.id === 'pb-caption-input') {
        this.caption = ev.target.value;
      }
    });
  }

  renderControls() {
    if (!this.overlayEl) return;
    const partnerProf = this._resolvePartnerData();
    const hasPartner = !!partnerProf;

    // Mode 1: Viewing a saved Polaroid from the Love Chronicle Album
    if (this.viewingAlbumPhoto) {
      const ph = this.viewingAlbumPhoto;
      const dateStr = ph.at ? new Date(ph.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      this.overlayEl.innerHTML = `
        <div class="pb-studio-card">
          <div class="pb-header">
            <div class="pb-title-wrap">
              <span class="pb-title-ico">🖼️</span>
              <div>
                <div class="pb-title">Love Chronicle Keepsake</div>
                <div class="pb-subtitle">Captured by ${escapeHtml(ph.byName || ph.by || 'Partner')} ${dateStr ? `• ${escapeHtml(dateStr)}` : ''}</div>
              </div>
            </div>
            <button type="button" class="pb-close-btn" data-pb-act="close" aria-label="Close">✕</button>
          </div>
          <div class="pb-stage-area">
            <div class="pb-polaroid-shell is-developed">
              ${ph.thumbDataUrl
                ? `<img class="pb-saved-img" src="${ph.thumbDataUrl}" alt="${escapeHtml(ph.caption || 'Polaroid')}" />`
                : `<div class="pb-saved-fallback">📸 ${escapeHtml(ph.caption || 'Sweet Memory')}</div>`}
            </div>
          </div>
          <div class="pb-export-bar">
            <button type="button" class="pb-btn pb-btn-gold" data-pb-act="download">💾 Save Image</button>
            <button type="button" class="pb-btn pb-btn-pink" data-pb-act="share">📲 Share</button>
            <button type="button" class="pb-btn pb-btn-wood" data-pb-act="back-to-studio">📸 Studio</button>
            <button type="button" class="pb-btn pb-btn-wood" data-pb-act="back-to-chronicle">📖 Chronicle</button>
          </div>
        </div>
      `;
      return;
    }

    // Mode 2: Live Interactive Photobooth Studio
    let tabBodyHtml = '';
    if (this.activeTab === 'pose') {
      tabBodyHtml = `
        <div class="pb-ctrl-label">🕺 Select Pose (Drives Live 3D Chibi Bones &amp; Props)</div>
        <div class="pb-chip-grid">
          ${PHOTOBOOTH_POSES.map((p) => `
            <button type="button" class="pb-chip ${this.pose === p.id ? 'active' : ''}" data-pb-act="pose" data-id="${p.id}">
              <span class="pb-chip-ico">${p.icon}</span>
              <span>${escapeHtml(p.label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="pb-ctrl-label">😊 Expression &amp; Aura</div>
        <div class="pb-chip-row">
          ${PHOTOBOOTH_EXPRESSIONS.map((e) => `
            <button type="button" class="pb-chip compact ${this.expression === e.id ? 'active' : ''}" data-pb-act="expression" data-id="${e.id}">
              <span>${e.icon} ${escapeHtml(e.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else if (this.activeTab === 'backdrop') {
      tabBodyHtml = `
        <div class="pb-ctrl-label">🏞️ Scenic Backdrop</div>
        <div class="pb-chip-grid">
          ${PHOTOBOOTH_BACKDROPS.map((b) => `
            <button type="button" class="pb-chip ${this.backdrop === b.id ? 'active' : ''}" data-pb-act="backdrop" data-id="${b.id}">
              <span class="pb-chip-ico">${b.icon}</span>
              <span>${escapeHtml(b.label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="pb-ctrl-label">🎞️ Lighting &amp; Film Filter</div>
        <div class="pb-chip-row">
          ${PHOTOBOOTH_FILTERS.map((f) => `
            <button type="button" class="pb-chip compact ${this.filter === f.id ? 'active' : ''}" data-pb-act="filter" data-id="${f.id}">
              <span>${f.icon} ${escapeHtml(f.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else if (this.activeTab === 'frame') {
      tabBodyHtml = `
        <div class="pb-ctrl-label">🖼️ Polaroid Card Theme</div>
        <div class="pb-chip-row">
          ${PHOTOBOOTH_FRAMES.map((f) => `
            <button type="button" class="pb-chip compact ${this.frame === f.id ? 'active' : ''}" data-pb-act="frame" data-id="${f.id}">
              <span>${f.icon} ${escapeHtml(f.label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="pb-ctrl-label">✍️ Polaroid Handwritten Caption</div>
        <div class="pb-caption-box">
          <input id="pb-caption-input" class="pb-caption-input" type="text" maxlength="54" value="${escapeHtml(this.caption)}" placeholder="Write a sweet memory note..." />
          <div class="pb-preset-pills">
            ${CAPTION_PRESETS.map((txt) => `
              <button type="button" class="pb-preset-pill" data-pb-act="caption-preset" data-text="${escapeHtml(txt)}">${escapeHtml(txt)}</button>
            `).join('')}
          </div>
        </div>
      `;
    } else if (this.activeTab === 'stickers') {
      tabBodyHtml = `
        <div class="pb-ctrl-label">✨ Tap to Add Stickers (Drag on Photo to Move!)</div>
        <div class="pb-sticker-bar">
          ${PHOTOBOOTH_STICKER_PALETTE.map((s) => `
            <button type="button" class="pb-sticker-btn" data-pb-act="add-sticker" data-emoji="${s.emoji}" title="${escapeHtml(s.label)}">${s.emoji}</button>
          `).join('')}
          <button type="button" class="pb-chip compact" data-pb-act="clear-stickers" title="Remove all stickers">🗑️ Clear (${this.stickers.length})</button>
        </div>
        <div class="pb-ctrl-label">🏷️ Polaroid Stamps &amp; Companions</div>
        <div class="pb-chip-row">
          <button type="button" class="pb-chip compact ${this.showPets ? 'active' : ''}" data-pb-act="toggle-pets">🐾 Pets: ${this.showPets ? 'ON' : 'OFF'}</button>
          <button type="button" class="pb-chip compact ${this.showStreak ? 'active' : ''}" data-pb-act="toggle-streak">💖 Streak Badge: ${this.showStreak ? 'ON' : 'OFF'}</button>
          <button type="button" class="pb-chip compact ${this.showDate ? 'active' : ''}" data-pb-act="toggle-date">📅 Date Stamp: ${this.showDate ? 'ON' : 'OFF'}</button>
        </div>
      `;
    }

    const existingCanvas = this.previewCanvas;

    this.overlayEl.innerHTML = `
      <div class="pb-studio-card">
        <div class="pb-header">
          <div class="pb-title-wrap">
            <span class="pb-title-ico">📸</span>
            <div>
              <div class="pb-title">Sanctuary Polaroid Studio</div>
              <div class="pb-subtitle">Drag characters or stickers on the viewfinder to frame your shot!</div>
            </div>
          </div>
          <button type="button" class="pb-close-btn" data-pb-act="close" aria-label="Close">✕</button>
        </div>

        <!-- Quick Stage Mode & Actor Controls Bar -->
        <div class="pb-top-toolbar">
          <div class="pb-mode-seg">
            <button type="button" class="pb-seg-btn ${this.mode === 'couple' ? 'active' : ''}" data-pb-act="mode" data-mode="couple">
              💞 Couple ${hasPartner ? '' : '🔒'}
            </button>
            <button type="button" class="pb-seg-btn ${this.mode === 'solo' ? 'active' : ''}" data-pb-act="mode" data-mode="solo">
              👤 Solo
            </button>
          </div>
          <div class="pb-Quick-acts">
            <button type="button" class="pb-mini-btn" data-pb-act="open-3d-cam" title="Switch to Live 3D World Camera">🎥 3D Cam</button>
            ${this.mode === 'couple' ? `<button type="button" class="pb-mini-btn" data-pb-act="swap-sides" title="Swap Left/Right Sides">⇄ Swap</button>` : ''}
            <button type="button" class="pb-mini-btn" data-pb-act="zoom-out" title="Zoom Out">➖</button>
            <button type="button" class="pb-mini-btn" data-pb-act="zoom-in" title="Zoom In">➕</button>
            <button type="button" class="pb-mini-btn" data-pb-act="reset-pos" title="Center Actors">🎯</button>
          </div>
        </div>

        <!-- Live Polaroid Viewfinder Canvas -->
        <div class="pb-stage-area">
          <div class="pb-polaroid-shell ${this.lastSnap ? 'is-snapped' : ''}" id="pb-canvas-host">
            <div class="pb-shutter-flash"></div>
          </div>
        </div>

        <!-- Category Tabs -->
        <div class="pb-tabs-bar">
          <button type="button" class="pb-tab-btn ${this.activeTab === 'pose' ? 'active' : ''}" data-pb-act="tab" data-tab="pose">🕺 Pose &amp; Mood</button>
          <button type="button" class="pb-tab-btn ${this.activeTab === 'backdrop' ? 'active' : ''}" data-pb-act="tab" data-tab="backdrop">🏞️ Scene &amp; Filter</button>
          <button type="button" class="pb-tab-btn ${this.activeTab === 'frame' ? 'active' : ''}" data-pb-act="tab" data-tab="frame">🖼️ Frame &amp; Note</button>
          <button type="button" class="pb-tab-btn ${this.activeTab === 'stickers' ? 'active' : ''}" data-pb-act="tab" data-tab="stickers">✨ Stickers</button>
        </div>

        <!-- Active Tab Controls -->
        <div class="pb-controls-drawer">
          ${tabBodyHtml}
        </div>

        <!-- Shutter & Export CTA Footer -->
        <div class="pb-footer-bar">
          <button type="button" class="pb-shutter-btn" data-pb-act="snap" ${this.snapping ? 'disabled' : ''}>
            <span class="pb-shutter-ring">📸</span>
            <span>${this.snapping ? 'Developing Polaroid...' : (this.lastSnap ? '📸 Snap Again (+1 Memory)' : '📸 SNAP POLAROID!')}</span>
          </button>
          ${this.lastSnap ? `
            <button type="button" class="pb-btn pb-btn-gold" data-pb-act="download" title="Download high-res PNG">💾 Save PNG</button>
            <button type="button" class="pb-btn pb-btn-pink" data-pb-act="share" title="Share Polaroid">📲 Share</button>
          ` : ''}
        </div>
      </div>
    `;

    const host = this.overlayEl.querySelector('#pb-canvas-host');
    if (host) {
      if (!existingCanvas) {
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'pb-viewfinder-canvas';
        this.previewCanvas.width = 720;
        this.previewCanvas.height = 880;
      }
      this._bindCanvasDrag(this.previewCanvas);
      host.prepend(this.previewCanvas);
      this._stepAndRenderPolaroid(0.001, this.previewCanvas, 720, 880);
    }
  }

  _injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('photobooth-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'photobooth-ui-styles';
    style.textContent = `
      .pb-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9500;
        background: rgba(20, 10, 8, 0.78);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
      }
      .pb-modal-backdrop[hidden] {
        display: none !important;
      }
      .pb-studio-card {
        width: min(100%, 440px);
        max-height: 94vh;
        background: linear-gradient(180deg, #fff8ec 0%, #f3e2c7 100%);
        border: 3px solid #8c5228;
        border-radius: 22px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.8);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 10px 12px 12px;
        gap: 7px;
        color: #42220e;
        font-family: "Nunito", system-ui, sans-serif;
      }
      .pb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: linear-gradient(90deg, #5a2e14 0%, #7d4320 100%);
        color: #fff6e5;
        padding: 7px 11px;
        border-radius: 14px;
        border: 2px solid #d89b3c;
      }
      .pb-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pb-title-ico {
        font-size: 20px;
      }
      .pb-title {
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      .pb-subtitle {
        font-size: 10px;
        color: #f6d8a8;
        font-weight: 700;
      }
      .pb-close-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1.5px solid #f4c26b;
        background: #8b3226;
        color: #fff;
        font-weight: 900;
        cursor: pointer;
      }
      .pb-top-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .pb-mode-seg {
        display: flex;
        background: #e3cca8;
        border-radius: 10px;
        padding: 2px;
        border: 1.5px solid #b58450;
      }
      .pb-seg-btn {
        border: none;
        background: transparent;
        color: #5c3416;
        font-weight: 900;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 8px;
        cursor: pointer;
      }
      .pb-seg-btn.active {
        background: linear-gradient(180deg, #ff85a6 0%, #e04f7b 100%);
        color: #fff;
        box-shadow: 0 2px 5px rgba(180, 40, 80, 0.35);
      }
      .pb-Quick-acts {
        display: flex;
        gap: 4px;
      }
      .pb-mini-btn {
        border: 1.5px solid #b58450;
        background: #fff9ef;
        color: #4a2810;
        font-weight: 900;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 8px;
        cursor: pointer;
      }
      .pb-stage-area {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2px 0;
      }
      .pb-polaroid-shell {
        position: relative;
        width: min(100%, 276px);
        aspect-ratio: 720 / 880;
        border-radius: 12px;
        box-shadow: 0 10px 26px rgba(45, 22, 8, 0.32);
        overflow: hidden;
        touch-action: none;
        user-select: none;
        cursor: grab;
      }
      .pb-polaroid-shell:active {
        cursor: grabbing;
      }
      .pb-viewfinder-canvas, .pb-saved-img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
      }
      .pb-shutter-flash {
        position: absolute;
        inset: 0;
        background: #fff;
        opacity: 0;
        pointer-events: none;
      }
      .pb-shutter-flash.is-flashing {
        animation: pbFlashAnim 0.55s ease-out forwards;
      }
      @keyframes pbFlashAnim {
        0% { opacity: 0.96; }
        100% { opacity: 0; }
      }
      .pb-tabs-bar {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      .pb-tab-btn {
        border: 1.5px solid #b58450;
        background: #f5e4c8;
        color: #5c3416;
        font-weight: 900;
        font-size: 10.5px;
        padding: 6px 4px;
        border-radius: 10px;
        cursor: pointer;
        white-space: nowrap;
      }
      .pb-tab-btn.active {
        background: linear-gradient(180deg, #ffcf67 0%, #e0961f 100%);
        color: #3a1d08;
        border-color: #9e5d10;
        box-shadow: 0 2px 6px rgba(160, 95, 16, 0.3);
      }
      .pb-controls-drawer {
        background: rgba(255, 250, 240, 0.85);
        border: 1.5px solid #cfa978;
        border-radius: 13px;
        padding: 8px 9px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .pb-ctrl-label {
        font-size: 10.5px;
        font-weight: 900;
        color: #6b3b18;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .pb-chip-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
      }
      .pb-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .pb-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 1.5px solid #c99d66;
        background: #fffdf8;
        color: #4a2810;
        font-weight: 800;
        font-size: 11px;
        padding: 6px 6px;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.1s;
      }
      .pb-chip.compact {
        padding: 5px 8px;
        font-size: 10.5px;
      }
      .pb-chip.active {
        background: linear-gradient(180deg, #ffe294 0%, #f5b638 100%);
        border-color: #b06c12;
        color: #381b05;
        font-weight: 900;
        box-shadow: 0 2px 5px rgba(176, 108, 18, 0.25);
      }
      .pb-sticker-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
      }
      .pb-sticker-btn {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1.5px solid #c99d66;
        background: #fff;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pb-sticker-btn:active {
        transform: scale(0.92);
      }
      .pb-caption-box {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .pb-caption-input {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        border-radius: 9px;
        border: 1.5px solid #b58450;
        background: #fff;
        font-family: inherit;
        font-size: 12px;
        font-weight: 800;
        color: #3a1d08;
      }
      .pb-preset-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .pb-preset-pill {
        border: 1px solid #d4a872;
        background: #faeedb;
        color: #633716;
        font-size: 10px;
        font-weight: 800;
        padding: 3px 7px;
        border-radius: 999px;
        cursor: pointer;
      }
      .pb-footer-bar, .pb-export-bar {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pb-shutter-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        background: linear-gradient(180deg, #ff6b98 0%, #d9386a 100%);
        color: #fff;
        border: 2px solid #8f1c42;
        border-radius: 13px;
        padding: 9px 12px;
        font-weight: 900;
        font-size: 13px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(217, 56, 106, 0.4);
      }
      .pb-shutter-btn:active {
        transform: translateY(1px);
      }
      .pb-btn {
        border-radius: 12px;
        padding: 9px 11px;
        font-weight: 900;
        font-size: 11.5px;
        cursor: pointer;
        border: 2px solid transparent;
        white-space: nowrap;
      }
      .pb-btn-gold {
        background: linear-gradient(180deg, #ffdf78 0%, #e59d23 100%);
        color: #3d1e05;
        border-color: #9e5f0d;
      }
      .pb-btn-pink {
        background: linear-gradient(180deg, #ff85ad 0%, #e04879 100%);
        color: #fff;
        border-color: #942148;
      }
      .pb-btn-wood {
        background: #ebd5b3;
        color: #4a2810;
        border-color: #9c6b3b;
      }
    `;
    document.head.appendChild(style);
  }
}
