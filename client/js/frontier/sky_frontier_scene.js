// client/js/frontier/sky_frontier_scene.js — Self-contained Three.js Sky Frontier scene.
// Manages the 10-player co-op shard stage, nodes, gates, DOM HUD overlays, auto-swing mining,
// and client-side combat (monsters, attacks, ultimates, invasions, outposts, bosses).

import * as THREE from 'three';
import { loadSprite, spriteInfo } from '../assets.js';
import {
  REGIONS,
  NODE_TYPES,
  SWING_MS,
  ENERGY,
  regenEnergy,
} from '/shared/sky_frontier_rules.js';
import { CHARMS } from '/shared/charm_catalog.js';
import { MONSTERS, BOSSES, WEAPONS } from '/shared/combat_rules.js';

const EMOJI_MAP = Object.freeze({
  wood: '🪵',
  stone: '🪨',
  sky_wheat: '🌾',
  golden_wheat: '🌾',
  herb_seed: '🌱',
  berries_crop: '🍓',
  honey: '🍯',
  feather: '🪶',
  cloud_silk: '🕸️',
  fish: '🐟',
  crystal_ore: '💎',
  crystal_glass: '🔮',
  ingot: '🪙',
  plank: '🪵',
  flour: '🥡',
  herb: '🌿',
  thread: '🧵',
  ancient_gear: '⚙️',
  starlight_essence: '✨',
  monster_gel: '🫧',
  monster_fang: '🦷',
  boss_core_moss: '🟢',
  boss_core_weaver: '🟣',
  repair_kit: '🔧',
});

const HUD_STYLE = `
#sf-hud {
  position: fixed;
  inset: 0;
  z-index: 25;
  pointer-events: none;
  font-family: "Comfortaa", "Fredoka", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
}

#sf-hud * {
  box-sizing: border-box;
}

.sf-top-bar {
  position: absolute;
  top: max(12px, env(safe-area-inset-top, 12px));
  left: 12px;
  right: 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;
}

.sf-top-left {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: nowrap;
  pointer-events: none;
}

.sf-bars-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
}

/* Glass vial showing ⚡ cur/max */
.sf-vial {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(36, 24, 18, 0.72);
  border: 2px solid #C9A45C;
  border-radius: 18px;
  padding: 4px 10px;
  height: 34px;
  color: #FFF9E6;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(6px);
  overflow: hidden;
  pointer-events: auto;
}

.sf-vial-liquid {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #E8B85A 0%, #FFE27A 100%);
  opacity: 0.38;
  transition: width 0.3s ease;
  pointer-events: none;
}

.sf-vial-text {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  letter-spacing: 0.5px;
}

/* Small player heart bar under the energy vial */
.sf-hp-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(36, 18, 18, 0.82);
  border: 1.5px solid #A84242;
  border-radius: 10px;
  padding: 1px 8px;
  height: 18px;
  color: #FFF0F0;
  font-weight: 800;
  font-size: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  overflow: hidden;
  pointer-events: auto;
}

.sf-hp-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #D32F2F 0%, #EF5350 100%);
  opacity: 0.65;
  transition: width 0.25s ease;
  pointer-events: none;
}

.sf-hp-bar-text {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  letter-spacing: 0.3px;
}

/* Parchment chip for region & player count */
.sf-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #E9DCC0;
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 4px 10px;
  height: 34px;
  color: #3B2A20;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.sf-chip-region {
  color: #3B2A20;
}

.sf-chip-players {
  color: #6E5339;
  font-size: 11px;
}

/* Home button */
.sf-btn-home {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #E9DCC0;
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 4px 12px;
  height: 34px;
  color: #3B2A20;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}

.sf-btn-home:hover {
  background: #F4EAD6;
  border-color: #C9A45C;
}

.sf-btn-home:active {
  transform: scale(0.95);
}

/* Top center stack for invasion banner & boss HP bar */
.sf-top-center {
  position: absolute;
  top: max(74px, calc(env(safe-area-inset-top, 12px) + 62px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 28;
  width: min(92vw, 380px);
}

/* Invasion banner */
.sf-invasion-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #E9DCC0;
  border: 2px solid #5A2A18;
  border-radius: 12px;
  padding: 5px 16px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  text-align: center;
  width: 100%;
  animation: sfBannerDrop 0.28s ease-out;
}

@keyframes sfBannerDrop {
  0% { transform: translateY(-16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.sf-invasion-title {
  font-size: 13px;
  font-weight: 900;
  color: #8B1E0F;
  letter-spacing: 0.5px;
}

.sf-invasion-sub {
  font-size: 11px;
  font-weight: 800;
  color: #3B2A20;
  margin-top: 1px;
}

/* Big Boss HP bar */
.sf-boss-bar {
  width: 100%;
  background: rgba(30, 20, 16, 0.90);
  border: 2px solid #C9A45C;
  border-radius: 12px;
  padding: 6px 12px 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  pointer-events: none;
  animation: sfBannerDrop 0.28s ease-out;
}

.sf-boss-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sf-boss-name {
  font-size: 13px;
  font-weight: 900;
  color: #FFECA8;
  text-shadow: 0 1px 2px #000;
}

.sf-boss-stage {
  font-size: 11px;
  font-weight: 800;
  color: #E57373;
}

.sf-boss-bar-track {
  position: relative;
  height: 16px;
  background: rgba(0,0,0,0.55);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.18);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-boss-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, #8E24AA 0%, #D81B60 50%, #E53935 100%);
  transition: width 0.25s ease;
}

.sf-boss-bar-text {
  position: relative;
  z-index: 1;
  font-size: 10px;
  font-weight: 900;
  color: #FFF;
  text-shadow: 0 1px 2px #000;
}

/* Floating share text container */
.sf-floating-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.sf-floating-item {
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(59, 42, 32, 0.92);
  border: 1.5px solid #C9A45C;
  border-radius: 12px;
  padding: 4px 10px;
  color: #FFECA8;
  font-weight: 900;
  font-size: 14px;
  white-space: nowrap;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
}

.sf-floating-item.sf-float-hit {
  background: rgba(42, 30, 22, 0.85);
  border-color: #B89872;
  color: #FFF8EC;
  font-size: 12px;
  padding: 2px 8px;
}

.sf-floating-item.sf-float-perfect {
  background: linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(180, 83, 9, 0.95));
  border: 2px solid #FDE047;
  color: #FEF08A;
  font-size: 13px;
  padding: 3px 10px;
  box-shadow: 0 0 14px rgba(250, 204, 21, 0.65), 0 3px 8px rgba(0, 0, 0, 0.5);
}

.sf-floating-item.sf-float-uncommon {
  background: linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(16, 185, 129, 0.92));
  border: 2px solid #6EE7B7;
  color: #ECFDF5;
  font-size: 14px;
  box-shadow: 0 0 14px rgba(52, 211, 153, 0.55), 0 4px 10px rgba(0, 0, 0, 0.5);
}

.sf-floating-item.sf-float-rare {
  background: linear-gradient(135deg, rgba(12, 74, 110, 0.96), rgba(2, 132, 199, 0.94));
  border: 2px solid #67E8F9;
  color: #E0F2FE;
  font-size: 15px;
  padding: 5px 12px;
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.7), 0 4px 12px rgba(0, 0, 0, 0.55);
}

.sf-floating-item.sf-float-epic {
  background: linear-gradient(135deg, rgba(88, 28, 135, 0.97), rgba(180, 83, 9, 0.96));
  border: 2.5px solid #FDE047;
  color: #FEF9C3;
  font-size: 16px;
  padding: 6px 14px;
  box-shadow: 0 0 24px rgba(250, 204, 21, 0.85), 0 4px 14px rgba(0, 0, 0, 0.65);
}

.sf-rarity-boost-pill {
  margin-bottom: 6px;
  background: rgba(36, 24, 18, 0.88);
  border: 1.5px solid #C9A45C;
  border-radius: 10px;
  padding: 2px 8px;
  color: #FDE047;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

/* Bottom Center Context Action Buttons (Repair / Boss Summon) */
.sf-context-actions {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 26;
}

.sf-repair-btn {
  background: #E9DCC0;
  border: 2.5px solid #3B2A20;
  border-radius: 18px;
  padding: 8px 18px;
  color: #3B2A20;
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  pointer-events: auto;
  transition: transform 0.08s ease, background 0.15s ease;
}

.sf-repair-btn:hover { background: #F4EAD6; }
.sf-repair-btn:active { transform: scale(0.95); }

.sf-boss-btn {
  background: #5A2A18;
  border: 2.5px solid #FFE082;
  border-radius: 18px;
  padding: 8px 18px;
  color: #FFF9E6;
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
  pointer-events: auto;
  transition: transform 0.08s ease, box-shadow 0.15s ease;
}

.sf-boss-btn:hover { box-shadow: 0 0 16px #FFE082; }
.sf-boss-btn:active { transform: scale(0.95); }

/* Bottom Right Dock: Ultimate Medallion Button (above) + Rune Ring Button (below) */
.sf-bottom-right-dock {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 26;
}

/* Round rune-medallion ultimate button */
.sf-ult-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
}

.sf-ult-btn {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, #3D2B1F 20%, #2A1D15 85%, #1A120D 100%);
  border: 2.5px solid #C9A45C;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.2);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  touch-action: manipulation;
  transition: transform 0.08s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.2s ease;
}

.sf-ult-btn:active { transform: scale(0.92); }

.sf-ult-btn.sf-ult-ready {
  border-color: #FFE082;
  box-shadow: 0 0 14px rgba(232, 184, 90, 0.75), inset 0 0 6px rgba(255, 238, 88, 0.5);
  animation: sfUltPulse 1.3s infinite alternate ease-in-out;
}

@keyframes sfUltPulse {
  0% { transform: scale(1.0); box-shadow: 0 0 10px rgba(232, 184, 90, 0.5); }
  100% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 238, 88, 0.95); }
}

.sf-ult-svg {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.sf-ult-track {
  fill: none;
  stroke: rgba(201, 164, 92, 0.22);
  stroke-width: 4;
}

.sf-ult-ring {
  fill: none;
  stroke: #E8B85A;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 276;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 0.1s linear;
}

.sf-ult-icon { font-size: 22px; line-height: 1; }
.sf-ult-label {
  font-size: 8px;
  font-weight: 900;
  color: #FFECA8;
  margin-top: 1px;
  letter-spacing: 0.3px;
  max-width: 54px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.sf-ult-cd-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  display: none;
  align-items: center;
  justify-content: center;
  color: #FFF;
  font-size: 13px;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

/* Rune Ring Strike Button */
.sf-rune-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  pointer-events: auto;
}

.sf-target-pills {
  display: flex;
  gap: 4px;
  background: rgba(36, 24, 18, 0.84);
  border: 1.5px solid #C9A45C;
  border-radius: 14px;
  padding: 3px 5px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
}

.sf-target-pill {
  border: 1.5px solid transparent;
  background: rgba(244, 234, 214, 0.14);
  color: #F4EAD6;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  line-height: 1.2;
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease;
}

.sf-target-pill.on {
  background: linear-gradient(180deg, #F6DC9A, #C9A45C);
  color: #3B2A20;
  border-color: #FFF3A8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.sf-target-pill:active {
  transform: scale(0.92);
}

.sf-rune-btn {
  position: relative;
  width: 82px;
  height: 82px;
  border-radius: 50%;
  background: radial-gradient(circle, #F8F1E2 20%, #E9DCC0 85%, #DFCBA6 100%);
  border: 3.5px solid #3B2A20;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  touch-action: manipulation;
  transition: transform 0.08s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.sf-rune-btn:active,
.sf-rune-btn.sf-held {
  transform: scale(0.93);
  border-color: #E8B85A;
}

.sf-rune-svg {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  pointer-events: none;
  transform: rotate(-90deg);
}

.sf-rune-track {
  fill: none;
  stroke: rgba(59, 42, 32, 0.22);
  stroke-width: 4;
}

.sf-rune-sweetspot {
  fill: none;
  stroke: rgba(250, 204, 21, 0.42);
  stroke-width: 6;
  stroke-dasharray: 110 264;
  stroke-dashoffset: -153;
}

.sf-rune-ring {
  fill: none;
  stroke: #C9A45C;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 264;
  stroke-dashoffset: 264;
  transition: stroke-dashoffset 0.05s linear;
}

.sf-rune-btn.sf-beat-active {
  border-color: #C9A45C;
  box-shadow: 0 0 18px #E8B85A, 0 0 32px rgba(232, 184, 90, 0.6), inset 0 0 10px #E8B85A;
  animation: sfPulseBeat 0.22s infinite alternate ease-in-out;
}

.sf-rune-btn.sf-beat-active .sf-rune-ring {
  stroke: #FFF3A8;
  stroke-width: 6;
  filter: drop-shadow(0 0 6px #E8B85A);
}

@keyframes sfPulseBeat {
  0% { transform: scale(1.0); }
  100% { transform: scale(1.08); }
}

.sf-rune-icon {
  font-size: 24px;
  line-height: 1;
}

.sf-rune-label {
  font-size: 9px;
  font-weight: 900;
  color: #3B2A20;
  margin-top: 2px;
  letter-spacing: 0.5px;
}

.sf-rune-flash {
  position: absolute;
  top: -34px;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  font-size: 18px;
  font-weight: 900;
  color: #FFF275;
  text-shadow: 0 0 10px #E8B85A, 0 2px 4px #000;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.sf-rune-flash.sf-flash-anim {
  animation: sfFlash 0.65s ease-out forwards;
}

@keyframes sfFlash {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1.3);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) translateY(-14px) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-26px) scale(0.9);
  }
}
`;

export class SkyFrontierScene {
  constructor({ world, request, toast }) {
    this.world = world;
    this.request = request;
    this.toast = toast;
    this.onExit = null;

    this.active = false;
    this.layout = null;
    this.halfSize = 36;
    this.elapsed = 0;

    // Root Three.js group
    this.root = new THREE.Group();
    this.root.name = 'sky_frontier_root';
    this.root.visible = false;
    if (this.world?.scene) {
      this.world.scene.add(this.root);
    }

    // Node & gate tracking
    this.nodeMeshes = new Map(); // nodeId -> mesh
    this.nodes = this.nodeMeshes;
    this.gateMeshes = new Map(); // gateKey -> mesh

    // Auto-swing state (gathering)
    this.targetNode = null;
    this.targetGate = null;
    this.isSwinging = false;
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this.runeHeld = false;
    this.preferredTargetType = 'auto';
    this._lastGatheredNodeType = null;
    this._localPerfectStreak = 0;
    this._autoChainTimer = null;
    this.audioCtx = null;

    // Combat state
    this.activeMonsters = new Map(); // id -> monsterData
    this.monsterPool = new Map();    // type -> array of pooled THREE.Group
    this.targetMonster = null;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldownMs = 650;
    this._heldTool = null;

    // Ultimate state
    this.ultReadyAt = 0;
    this.ultTotalCd = 60000;
    this.vfxRings = []; // active expanding VFX ring objects

    // Player HP state
    this.playerHp = { hp: 100, maxHp: 100, shield: 0 };

    // Outpost & Invasion & Boss state
    this.outpostState = null;
    this.outpostPlatform = null;
    this.outpostStatue = null;
    this.outpostRing = null;
    this.invasionState = null;
    this.activeBoss = null;
    this.bossCooldownUntil = 0;

    // Energy state
    this.energy = { cur: ENERGY?.MAX || 200, max: ENERGY?.MAX || 200 };

    // Floating text list
    this.floatingTexts = [];

    // Pre-allocated combat geometries & materials cache
    this._mobGeos = null;
    this._mobMats = null;
    this._initSharedCombatAssets();

    // DOM HUD elements
    this.hudEl = null;
    this.vialLiquidEl = null;
    this.vialTextEl = null;
    this.hpBarFillEl = null;
    this.hpBarTextEl = null;
    this.regionNameEl = null;
    this.playersEl = null;
    this.homeBtnEl = null;
    this.floatContainerEl = null;
    this.invasionBannerEl = null;
    this.invasionTitleEl = null;
    this.invasionSubEl = null;
    this.bossBarEl = null;
    this.bossNameEl = null;
    this.bossStageEl = null;
    this.bossFillEl = null;
    this.bossTextEl = null;
    this.repairBtnEl = null;
    this.bossBtnEl = null;
    this.ultBtnEl = null;
    this.ultRingEl = null;
    this.ultIconEl = null;
    this.ultLabelEl = null;
    this.ultCdOverlayEl = null;
    this.runeWrapperEl = null;
    this.runeBtnEl = null;
    this.runeRingEl = null;
    this.runeFlashEl = null;

    this._ensureHud();
  }

  // ------------------------------------------------------------------ Shared Asset Cache
  _initSharedCombatAssets() {
    this._mobGeos = {
      // Moss Slime
      slimeBody: new THREE.SphereGeometry(0.5, 12, 10),
      sproutStem: new THREE.CylinderGeometry(0.04, 0.04, 0.25, 5),
      sproutLeaves: new THREE.ConeGeometry(0.12, 0.2, 5),
      // Thornback Boar
      boarBody: new THREE.BoxGeometry(0.7, 0.55, 0.95),
      boarSnout: new THREE.BoxGeometry(0.4, 0.35, 0.4),
      tusk: new THREE.ConeGeometry(0.06, 0.22, 5),
      // Pollen Wisp
      wispCore: new THREE.SphereGeometry(0.32, 12, 10),
      wispGlow: new THREE.SphereGeometry(0.42, 10, 8),
      // Crystal Beetle
      beetleShell: new THREE.DodecahedronGeometry(0.52, 0),
      // Lantern Bat
      batBody: new THREE.SphereGeometry(0.28, 10, 8),
      batWing: new THREE.BoxGeometry(0.45, 0.04, 0.25),
      amberDot: new THREE.SphereGeometry(0.12, 8, 6),
      // Quartz Golemling
      golemBase: new THREE.BoxGeometry(0.65, 0.35, 0.55),
      golemTorso: new THREE.BoxGeometry(0.5, 0.45, 0.45),
      golemHead: new THREE.BoxGeometry(0.35, 0.3, 0.35),
      crystalAccent: new THREE.OctahedronGeometry(0.18, 0),
      // Boss Crown
      crownRing: new THREE.TorusGeometry(0.7, 0.08, 8, 24),
      // HP Bar
      hpBg: new THREE.PlaneGeometry(0.8, 0.09),
      hpFill: new THREE.PlaneGeometry(0.76, 0.07),
    };

    this._mobMats = {
      slime: new THREE.MeshStandardMaterial({ color: 0x52B74B, roughness: 0.6 }),
      sproutStem: new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 }),
      sproutLeaf: new THREE.MeshStandardMaterial({ color: 0x81C784, roughness: 0.6 }),
      boarBody: new THREE.MeshStandardMaterial({ color: 0x6E472A, roughness: 0.85 }),
      boarSnout: new THREE.MeshStandardMaterial({ color: 0x58371F, roughness: 0.85 }),
      tusk: new THREE.MeshStandardMaterial({ color: 0xE8DFC8, roughness: 0.4 }),
      wispCore: new THREE.MeshStandardMaterial({ color: 0xFFE042, emissive: 0xFFB300, emissiveIntensity: 0.65, roughness: 0.3 }),
      wispGlow: new THREE.MeshBasicMaterial({ color: 0xFFF176, transparent: true, opacity: 0.35, depthWrite: false }),
      beetle: new THREE.MeshStandardMaterial({ color: 0x26C6DA, roughness: 0.25, metalness: 0.3, emissive: 0x006064, emissiveIntensity: 0.3 }),
      batBody: new THREE.MeshStandardMaterial({ color: 0x2B2735, roughness: 0.8 }),
      batWing: new THREE.MeshStandardMaterial({ color: 0x1E1A26, roughness: 0.9 }),
      amberDot: new THREE.MeshStandardMaterial({ color: 0xFF9800, emissive: 0xFF9800, emissiveIntensity: 0.9 }),
      golemBase: new THREE.MeshStandardMaterial({ color: 0x787A7D, roughness: 0.9 }),
      golemTorso: new THREE.MeshStandardMaterial({ color: 0x93969A, roughness: 0.85 }),
      golemHead: new THREE.MeshStandardMaterial({ color: 0xA4A7AB, roughness: 0.8 }),
      crystalAccent: new THREE.MeshStandardMaterial({ color: 0x6FE0F0, roughness: 0.3 }),
      crown: new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFA000, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 }),
      hpBg: new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }),
      hpFill: new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide }),
    };
  }

  // ------------------------------------------------------------------ DOM HUD
  _ensureHud() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('sf-hud-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'sf-hud-style';
      styleEl.textContent = HUD_STYLE;
      document.head.appendChild(styleEl);
    }

    let hud = document.getElementById('sf-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'sf-hud';
      hud.innerHTML = `
        <div class="sf-top-bar">
          <div class="sf-top-left">
            <div class="sf-bars-col">
              <div class="sf-vial" id="sf-vial">
                <div class="sf-vial-liquid" id="sf-vial-liquid"></div>
                <span class="sf-vial-text" id="sf-vial-text">⚡ 200/200</span>
              </div>
              <div class="sf-hp-bar" id="sf-hp-bar">
                <div class="sf-hp-bar-fill" id="sf-hp-bar-fill"></div>
                <span class="sf-hp-bar-text" id="sf-hp-bar-text">❤️ 100/100</span>
              </div>
            </div>
            <div class="sf-chip" id="sf-chip">
              <span class="sf-chip-region" id="sf-chip-region">Sky Frontier</span>
              <span class="sf-chip-players" id="sf-chip-players">👥 1/10</span>
            </div>
          </div>
          <button type="button" class="sf-btn-home" id="sf-btn-home">🏠 Home</button>
        </div>

        <div class="sf-top-center">
          <div class="sf-invasion-banner" id="sf-invasion-banner" style="display: none;">
            <span class="sf-invasion-title" id="sf-invasion-title">⚠️ INVASION IMMINENT</span>
            <span class="sf-invasion-sub" id="sf-invasion-sub">Wave 1 starting soon...</span>
          </div>
          <div class="sf-boss-bar" id="sf-boss-bar" style="display: none;">
            <div class="sf-boss-bar-header">
              <span class="sf-boss-name" id="sf-boss-name">👑 Elder Moss Golem</span>
              <span class="sf-boss-stage" id="sf-boss-stage">Phase 1</span>
            </div>
            <div class="sf-boss-bar-track">
              <div class="sf-boss-bar-fill" id="sf-boss-bar-fill"></div>
              <span class="sf-boss-bar-text" id="sf-boss-bar-text">2400 / 2400</span>
            </div>
          </div>
        </div>

        <div class="sf-floating-container" id="sf-floating-container"></div>

        <div class="sf-context-actions" id="sf-context-actions">
          <button type="button" class="sf-repair-btn" id="sf-repair-btn" style="display: none;">
            🔧 Repair Outpost
          </button>
          <button type="button" class="sf-boss-btn" id="sf-boss-btn" style="display: none;">
            ⚔️ Summon Boss
          </button>
        </div>

        <div class="sf-bottom-right-dock" id="sf-bottom-right-dock">
          <div class="sf-ult-wrapper" id="sf-ult-wrapper">
            <button type="button" class="sf-ult-btn" id="sf-ult-btn" aria-label="Ultimate">
              <svg class="sf-ult-svg" viewBox="0 0 100 100">
                <circle class="sf-ult-track" cx="50" cy="50" r="44" />
                <circle class="sf-ult-ring" id="sf-ult-ring" cx="50" cy="50" r="44" />
              </svg>
              <span class="sf-ult-icon" id="sf-ult-icon">✨</span>
              <span class="sf-ult-label" id="sf-ult-label">ULT</span>
              <div class="sf-ult-cd-overlay" id="sf-ult-cd-overlay"></div>
            </button>
          </div>

          <div class="sf-rune-wrapper" id="sf-rune-wrapper">
            <div class="sf-target-pills" id="sf-target-pills" role="group" aria-label="Gather Target">
              <button type="button" class="sf-target-pill on" data-sf-target="auto">✨ Auto</button>
              <button type="button" class="sf-target-pill" data-sf-target="tree">🪵</button>
              <button type="button" class="sf-target-pill" data-sf-target="boulder">🪨</button>
              <button type="button" class="sf-target-pill" data-sf-target="wheat">🌾</button>
              <button type="button" class="sf-target-pill" data-sf-target="herb">🌿</button>
            </div>
            <div class="sf-rarity-boost-pill" id="sf-rarity-boost">✨ Tap or Hold to Gather</div>
            <div class="sf-rune-flash" id="sf-rune-flash">PERFECT!</div>
            <button type="button" class="sf-rune-btn" id="sf-rune-btn" aria-label="Gather & Strike">
              <svg class="sf-rune-svg" viewBox="0 0 100 100">
                <circle class="sf-rune-track" cx="50" cy="50" r="42" />
                <circle class="sf-rune-sweetspot" cx="50" cy="50" r="42" />
                <circle class="sf-rune-ring" id="sf-rune-ring" cx="50" cy="50" r="42" />
              </svg>
              <span class="sf-rune-icon" id="sf-rune-icon">⚒️</span>
              <span class="sf-rune-label" id="sf-rune-label">GATHER</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(hud);
    }

    this.hudEl = hud;
    this.vialLiquidEl = hud.querySelector('#sf-vial-liquid');
    this.vialTextEl = hud.querySelector('#sf-vial-text');
    this.hpBarFillEl = hud.querySelector('#sf-hp-bar-fill');
    this.hpBarTextEl = hud.querySelector('#sf-hp-bar-text');
    this.regionNameEl = hud.querySelector('#sf-chip-region');
    this.playersEl = hud.querySelector('#sf-chip-players');
    this.homeBtnEl = hud.querySelector('#sf-btn-home');
    this.floatContainerEl = hud.querySelector('#sf-floating-container');

    this.invasionBannerEl = hud.querySelector('#sf-invasion-banner');
    this.invasionTitleEl = hud.querySelector('#sf-invasion-title');
    this.invasionSubEl = hud.querySelector('#sf-invasion-sub');

    this.bossBarEl = hud.querySelector('#sf-boss-bar');
    this.bossNameEl = hud.querySelector('#sf-boss-name');
    this.bossStageEl = hud.querySelector('#sf-boss-stage');
    this.bossFillEl = hud.querySelector('#sf-boss-bar-fill');
    this.bossTextEl = hud.querySelector('#sf-boss-bar-text');

    this.repairBtnEl = hud.querySelector('#sf-repair-btn');
    this.bossBtnEl = hud.querySelector('#sf-boss-btn');

    this.ultBtnEl = hud.querySelector('#sf-ult-btn');
    this.ultRingEl = hud.querySelector('#sf-ult-ring');
    this.ultIconEl = hud.querySelector('#sf-ult-icon');
    this.ultLabelEl = hud.querySelector('#sf-ult-label');
    this.ultCdOverlayEl = hud.querySelector('#sf-ult-cd-overlay');

    this.runeWrapperEl = hud.querySelector('#sf-rune-wrapper');
    this.targetPillsEl = hud.querySelector('#sf-target-pills');
    this.rarityBoostEl = hud.querySelector('#sf-rarity-boost');
    this.runeBtnEl = hud.querySelector('#sf-rune-btn');
    this.runeRingEl = hud.querySelector('#sf-rune-ring');
    this.runeIconEl = hud.querySelector('#sf-rune-icon');
    this.runeLabelEl = hud.querySelector('#sf-rune-label');
    this.runeFlashEl = hud.querySelector('#sf-rune-flash');

    if (this.homeBtnEl) {
      this.homeBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof this.onExit === 'function') {
          this.onExit();
        }
      };
    }

    if (this.targetPillsEl) {
      this.targetPillsEl.addEventListener('pointerdown', (e) => {
        const pill = e.target.closest('[data-sf-target]');
        if (!pill) return;
        e.preventDefault();
        e.stopPropagation();
        const type = pill.dataset.sfTarget || 'auto';
        this.preferredTargetType = type;
        this.targetPillsEl.querySelectorAll('[data-sf-target]').forEach((el) => {
          el.classList.toggle('on', el.dataset.sfTarget === type);
        });
        this._syncRuneButtonState();
        this.findAndWalkToNextNode(type, { playSfx: true });
      });
    }

    if (this.runeBtnEl) {
      const handleDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.runeHeld = true;
        this.runeBtnEl.classList.add('sf-held');
        this.onRuneTap();
      };
      const handleUp = () => {
        this.runeHeld = false;
        this.runeBtnEl?.classList.remove('sf-held');
      };
      this.runeBtnEl.addEventListener('pointerdown', handleDown);
      this.runeBtnEl.addEventListener('pointerup', handleUp);
      this.runeBtnEl.addEventListener('pointercancel', handleUp);
      this.runeBtnEl.addEventListener('pointerleave', handleUp);
    }

    if (this.ultBtnEl) {
      const handleUlt = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerUltimate();
      };
      this.ultBtnEl.addEventListener('pointerdown', handleUlt);
    }

    if (this.repairBtnEl) {
      this.repairBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onRepairTap();
      };
    }

    if (this.bossBtnEl) {
      this.bossBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onBossSummonTap();
      };
    }

    this.hudEl.style.display = this.active ? 'block' : 'none';
  }

  _renderTargetPills(isHollow) {
    if (!this.targetPillsEl) return;
    const pills = isHollow
      ? [
          { id: 'auto', label: '✨ Auto' },
          { id: 'crystal', label: '💎' },
          { id: 'mithril', label: '🔮' },
          { id: 'boulder', label: '🪨' },
        ]
      : [
          { id: 'auto', label: '✨ Auto' },
          { id: 'tree', label: '🪵' },
          { id: 'boulder', label: '🪨' },
          { id: 'wheat', label: '🌾' },
          { id: 'herb', label: '🌿' },
        ];
    if (!pills.some((p) => p.id === this.preferredTargetType)) {
      this.preferredTargetType = 'auto';
    }
    this.targetPillsEl.innerHTML = pills
      .map(
        (p) =>
          `<button type="button" class="sf-target-pill ${
            p.id === this.preferredTargetType ? 'on' : ''
          }" data-sf-target="${p.id}">${p.label}</button>`
      )
      .join('');
  }

  _syncRuneButtonState() {
    const NODE_ICONS = {
      tree: '🪵',
      boulder: '🪨',
      wheat: '🌾',
      herb: '🌿',
      crystal: '💎',
      quartz: '💎',
      mithril: '🔮',
    };
    if (this.targetNode) {
      const icon = NODE_ICONS[this.targetNode.type] || '⚒️';
      if (this.runeIconEl) this.runeIconEl.textContent = icon;
      if (this.runeLabelEl) this.runeLabelEl.textContent = this.isSwinging ? 'HOLD/TAP' : 'WALKING';
    } else {
      const icon =
        this.preferredTargetType !== 'auto'
          ? NODE_ICONS[this.preferredTargetType] || '⚒️'
          : '⚒️';
      if (this.runeIconEl) this.runeIconEl.textContent = icon;
      if (this.runeLabelEl) this.runeLabelEl.textContent = 'GATHER';
      if (this.rarityBoostEl) {
        this.rarityBoostEl.textContent = '✨ Tap or Hold to Gather';
      }
      this._updateRuneRing(0, false);
    }
  }

  findAndWalkToNextNode(preferredType = null, { playSfx = false } = {}) {
    if (!this.active || !this.layout?.nodes?.length) return false;
    const local = this.world?.local;
    const px = local?.x ?? 0;
    const pz = local?.z ?? 0;
    const now = Date.now() + (this.world?.serverOffset || 0);
    const toolbelt = local?.profile?.frontier?.toolbelt || {};

    const targetType = preferredType || this.preferredTargetType || 'auto';
    const available = (this.layout.nodes || []).filter((n) => {
      if (n.depletedUntil && n.depletedUntil > now) return false;
      const def = NODE_TYPES[n.type];
      if (def) {
        const myTier = Number(toolbelt[def.tool]) || 1;
        if (myTier < (Number(def.minTier) || 1)) return false;
      }
      return true;
    });

    if (available.length === 0) {
      this.toast?.('🌱 All nearby nodes are regrowing — just a moment!', 1800);
      return false;
    }

    let candidates = available;
    if (targetType && targetType !== 'auto') {
      const matching = available.filter(
        (n) => n.type === targetType || (targetType === 'crystal' && n.type === 'quartz')
      );
      if (matching.length > 0) {
        candidates = matching;
      }
    } else if (this._lastGatheredNodeType) {
      const sameType = available.filter((n) => n.type === this._lastGatheredNodeType);
      if (sameType.length > 0) {
        candidates = sameType;
      }
    }

    let bestNode = null;
    let bestDist = Infinity;
    for (const n of candidates) {
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < bestDist) {
        bestDist = d;
        bestNode = n;
      }
    }

    if (!bestNode) return false;
    if (playSfx) {
      this.playGatherSfx('step_target');
    }
    this.interact({ kind: 'sf_node', node: bestNode });
    return true;
  }

  onRuneTap() {
    if (!this.targetNode) {
      this.findAndWalkToNextNode(this.preferredTargetType, { playSfx: true });
      return;
    }
    if (this.inBeatWindow && !this.nextStrikePerfect) {
      this.triggerPerfectLock();
    }
  }

  triggerPerfectLock() {
    if (this.nextStrikePerfect) return;
    this.nextStrikePerfect = true;
    this._localPerfectStreak = (this._localPerfectStreak || 0) + 1;
    this.flashPerfect();
    this.playGatherSfx('perfect', this._localPerfectStreak);
  }

  flashPerfect() {
    if (!this.runeFlashEl) return;
    this.runeFlashEl.classList.remove('sf-flash-anim');
    void this.runeFlashEl.offsetWidth;
    this.runeFlashEl.classList.add('sf-flash-anim');
  }

  playGatherSfx(type, streak = 1) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'step_target') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.09);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit_axe') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(195, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit_pickaxe') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'hit_staff') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === 'perfect') {
        const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
        const baseFreq = scale[Math.min(scale.length - 1, Math.max(0, (streak || 1) - 1))];
        [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.055);
          gain.gain.setValueAtTime(0.13, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.22);
        });
      } else if (type === 'break_common' || type === 'break_rare' || type === 'break_epic') {
        const notes =
          type === 'break_epic'
            ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
            : type === 'break_rare'
            ? [523.25, 659.25, 783.99, 1046.5]
            : [440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.065);
          gain.gain.setValueAtTime(0.14, now + idx * 0.065);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.26);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.065);
          osc.stop(now + idx * 0.065 + 0.26);
        });
      }
    } catch {
      // Ignore WebAudio restrictions
    }
  }

  // ------------------------------------------------------------------ Scene Lifecycle
  enter(layout) {
    this.layout = layout || { kind: 'sky_frontier', halfSize: 36 };
    this.halfSize = Number(this.layout.halfSize) || 36;
    this.active = true;

    // Reset interaction & state
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetGate = null;
    this.floatingTexts = [];
    if (this.floatContainerEl) {
      this.floatContainerEl.innerHTML = '';
    }

    // Clear active monsters
    for (const mon of this.activeMonsters.values()) {
      this.root.remove(mon.group);
      this._releaseMonsterMesh(mon.type, mon.group);
    }
    this.activeMonsters.clear();

    // Clear VFX rings
    for (const v of this.vfxRings) {
      this.root.remove(v.mesh);
      v.mesh.geometry.dispose();
      v.mesh.material.dispose();
    }
    this.vfxRings = [];

    // Clear previous dynamic meshes
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      this.root.remove(child);
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
        else child.material.dispose?.();
      }
    }
    this.nodeMeshes.clear();
    this.gateMeshes.clear();

    const isHollow = String(this.layout.regionId || '').toLowerCase().includes('hollow');

    // 1. Lights
    if (isHollow) {
      const hemiLight = new THREE.HemisphereLight(0x56788F, 0x1E2B33, 0.55);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xA2C2DB, 0.50);
      dirLight.position.set(12, 26, 12);
      this.root.add(dirLight);
    } else {
      const hemiLight = new THREE.HemisphereLight(0xDCF0FF, 0x6E8552, 0.95);
      hemiLight.position.set(0, 30, 0);
      this.root.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xFFF1D0, 1.0);
      dirLight.position.set(15, 32, 20);
      this.root.add(dirLight);
    }

    // 2. Ground plane (hand-painted Tree of Savior tileable terrain)
    const groundSize = 2 * this.halfSize;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color: isHollow ? 0x1F3A44 : 0x7FA35A,
    });
    const groundSpriteKey = isHollow ? 'terrain_hollow_floor' : 'ground_classic';
    loadSprite(groundSpriteKey).then((s) => {
      if (!s?.texture) return;
      const tex = s.texture.clone();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(groundSize / 4, groundSize / 4);
      tex.needsUpdate = true;
      groundMat.map = tex;
      groundMat.color.setHex(isHollow ? 0xFFFFFF : 0xE6EFE0);
      groundMat.needsUpdate = true;
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.name = 'sf_ground';
    groundMesh.receiveShadow = true;
    this.root.add(groundMesh);

    // Decorative paths, patches & scenic Tree of Savior landmarks
    const camLean = -(this.world?.pitch || 0.58);
    if (!isHollow) {
      // Winding country dirt road strips connecting Outpost -> Gate, Wheat Mill, and Forest
      const roadMat = new THREE.MeshBasicMaterial({ color: 0xB89872 });
      loadSprite('road_dirt').then((s) => {
        if (!s?.texture) return;
        const tex = s.texture.clone();
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 6);
        tex.needsUpdate = true;
        roadMat.map = tex;
        roadMat.color.setHex(0xFFFFFF);
        roadMat.needsUpdate = true;
      });
      const roadSegments = [
        { x: 0, z: -12, w: 2.6, l: 38, rotY: 0 },
        { x: 10, z: 8, w: 2.4, l: 22, rotY: -Math.PI / 2.6 },
        { x: -9, z: 2, w: 2.2, l: 18, rotY: Math.PI / 2.3 },
      ];
      for (const seg of roadSegments) {
        const rGeo = new THREE.PlaneGeometry(seg.w, seg.l);
        rGeo.rotateX(-Math.PI / 2);
        const rMesh = new THREE.Mesh(rGeo, roadMat);
        rMesh.rotation.y = seg.rotY;
        rMesh.position.set(seg.x, 0.012, seg.z);
        this.root.add(rMesh);
      }

      const wheatPoi = this.layout.pois?.wheat || { x: 20, z: 12 };
      const wheatPatchMat = new THREE.MeshBasicMaterial({ color: 0xD9B866 });
      loadSprite('road_farmland').then((s) => {
        if (!s?.texture) return;
        wheatPatchMat.map = s.texture;
        wheatPatchMat.color.setHex(0xE8D096);
        wheatPatchMat.needsUpdate = true;
      });
      const patchOffsets = [
        { dx: 0, dz: 0, r: 3.2 },
        { dx: -2.8, dz: 1.4, r: 2.4 },
        { dx: 2.4, dz: -1.8, r: 2.6 },
        { dx: 1.6, dz: 2.6, r: 2.1 },
      ];
      for (const p of patchOffsets) {
        const patchGeo = new THREE.CircleGeometry(p.r, 20);
        patchGeo.rotateX(-Math.PI / 2);
        const patch = new THREE.Mesh(patchGeo, wheatPatchMat);
        patch.position.set(wheatPoi.x + p.dx, 0.016, wheatPoi.z + p.dz);
        this.root.add(patch);
      }

      // Scenic Whispering Meadow 2.5D landmarks & wildflower props
      this._addScenicSprite('sf_mill_ruins', wheatPoi.x + 2.8, wheatPoi.z - 2.4, 4.6, camLean);
      this._addScenicSprite('sf_prop_scarecrow', wheatPoi.x - 2.6, wheatPoi.z + 1.8, 2.2, camLean);
      this._addScenicSprite('crop_berries_ready', -5.5, 5.2, 1.6, camLean);
      this._addScenicSprite('crop_berries_ready', 5.8, 2.8, 1.5, camLean);
      this._addScenicSprite('env_bush_daisies_white', -3.4, 1.8, 1.3, camLean);
      this._addScenicSprite('env_bush_roses_pink', 3.6, 5.4, 1.3, camLean);
    } else {
      const umberMat = new THREE.MeshBasicMaterial({ color: 0x4A3B33 });
      loadSprite('road_flagstone').then((s) => {
        if (!s?.texture) return;
        umberMat.map = s.texture;
        umberMat.color.setHex(0x6E808C);
        umberMat.needsUpdate = true;
      });
      const umberCenters = [
        { x: -16, z: 6, r: 2.8 },
        { x: -10, z: -12, r: 2.5 },
        { x: 12, z: 4, r: 3.0 },
        { x: 15, z: -18, r: 2.4 },
        { x: 0, z: -18, r: 3.6 },
      ];
      for (const c of umberCenters) {
        const patchGeo = new THREE.CircleGeometry(c.r, 20);
        patchGeo.rotateX(-Math.PI / 2);
        const patch = new THREE.Mesh(patchGeo, umberMat);
        patch.position.set(c.x, 0.015, c.z);
        this.root.add(patch);
      }

      // Scenic Crystal Hollow 2.5D cavern arches, minecarts & rope bridge
      this._addScenicSprite('sf_prop_timber_arch', 0, -3.5, 4.4, camLean);
      this._addScenicSprite('sf_prop_timber_arch', 0, -13.5, 4.6, camLean);
      this._addScenicSprite('sf_prop_minecart', -5.2, 2.2, 2.5, camLean);
      this._addScenicSprite('sf_prop_minecart', 6.4, -6.5, 2.5, camLean);
      this._addScenicSprite('sf_prop_rope_bridge', 5.8, 4.2, 3.2, camLean);
    }

    // 3. Framing border
    this._buildFramingBorder(isHollow);

    // 4. Outpost stone platform + 2.5D ToS Goddess statue + HP ring
    const outpostPoi = this.layout.pois?.outpost || { x: 0, z: 4 };
    const platGeo = new THREE.CircleGeometry(2.35, 28);
    platGeo.rotateX(-Math.PI / 2);
    const platMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.outpostPlatform = new THREE.Mesh(platGeo, platMat);
    this.outpostPlatform.position.set(outpostPoi.x, 0.02, outpostPoi.z);
    this.root.add(this.outpostPlatform);

    const outpostSpriteKey = isHollow ? 'sf_hollow_outpost' : 'sf_outpost_goddess';
    const statueInfo = spriteInfo(outpostSpriteKey);
    const statueAspect = statueInfo ? statueInfo.h / statueInfo.w : 0.92;
    const statueW = 4.2;
    const statueGeo = new THREE.PlaneGeometry(statueW, statueW * statueAspect);
    statueGeo.translate(0, (statueW * statueAspect) * 0.5, 0);
    const statueMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    loadSprite(outpostSpriteKey).then((s) => {
      if (!s?.texture) return;
      statueMat.map = s.texture;
      statueMat.needsUpdate = true;
    });
    this.outpostStatue = new THREE.Mesh(statueGeo, statueMat);
    this.outpostStatue.rotation.x = camLean;
    this.outpostStatue.position.set(outpostPoi.x, 0.05, outpostPoi.z);
    this.root.add(this.outpostStatue);

    const ringGeo = new THREE.RingGeometry(2.15, 2.45, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide });
    this.outpostRing = new THREE.Mesh(ringGeo, ringMat);
    this.outpostRing.position.set(outpostPoi.x, 0.035, outpostPoi.z);
    this.root.add(this.outpostRing);

    // 5. Gate markers (2.5D hand-painted Sky Mist Gate archway + glowing ground ring)
    for (const gate of this.layout.gates || []) {
      const radius = gate.radius || 2.5;
      const isLocked = Boolean(gate.requires);
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.at.x, 0, gate.at.z);
      gateGroup.userData.gate = gate;

      const gRingGeo = new THREE.RingGeometry(radius * 0.72, radius * 0.95, 32);
      gRingGeo.rotateX(-Math.PI / 2);
      const gRingMat = new THREE.MeshBasicMaterial({
        color: isLocked ? 0x8899AA : 0x7CE8FF,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gRing = new THREE.Mesh(gRingGeo, gRingMat);
      gRing.position.y = 0.03;
      gateGroup.add(gRing);

      const gateInfo = spriteInfo('sf_sky_mist_gate');
      const gateAspect = gateInfo ? gateInfo.h / gateInfo.w : 1.35;
      const gateW = 3.6;
      const gatePlaneGeo = new THREE.PlaneGeometry(gateW, gateW * gateAspect);
      gatePlaneGeo.translate(0, (gateW * gateAspect) * 0.5, 0);
      const gatePlaneMat = new THREE.MeshBasicMaterial({
        color: isLocked ? 0xAABBCC : 0xFFFFFF,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
      });
      loadSprite('sf_sky_mist_gate').then((s) => {
        if (!s?.texture) return;
        gatePlaneMat.map = s.texture;
        gatePlaneMat.needsUpdate = true;
      });
      const gatePlane = new THREE.Mesh(gatePlaneGeo, gatePlaneMat);
      gatePlane.rotation.x = camLean;
      gateGroup.add(gatePlane);

      this.root.add(gateGroup);
      this.gateMeshes.set(gate.to || gate, gateGroup);
    }

    // 6. Nodes
    for (const node of this.layout.nodes || []) {
      const mesh = this._createNodeMesh(node);
      this.root.add(mesh);
      this.nodeMeshes.set(String(node.id), mesh);
    }

    // 7. Initialize combat snapshots from layout
    if (Array.isArray(this.layout.monsters)) {
      this.onMonsters({ m: this.layout.monsters });
    }
    if (this.layout.outpost) {
      this.onOutpost(this.layout.outpost);
    }
    if (this.layout.invasion) {
      this.onInvasion(this.layout.invasion);
    }
    if (this.layout.boss) {
      this.onBoss(this.layout.boss);
    }
    if (this.layout.bossCooldownUntil) {
      this.bossCooldownUntil = this.layout.bossCooldownUntil;
    }

    // Initialize player HP from profile if available
    const lv = Number(this.world?.local?.profile?.level) || 1;
    const maxHp = 100 + 2 * (lv > 0 ? Math.floor(lv) : 0);
    this.playerHp = { hp: maxHp, maxHp, shield: 0 };
    this.updatePlayerHpBar();

    // 8. Make root visible and show HUD
    this.root.visible = true;
    if (this.hudEl) {
      this.hudEl.style.display = 'block';
    }
    this._renderTargetPills(isHollow);
    if (this.runeWrapperEl) {
      this.runeWrapperEl.style.display = 'flex';
    }
    this._syncRuneButtonState();
    this.updateHud();
    this.updateUltimateCharm();
  }

  exit() {
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.runeHeld = false;
    this.active = false;
    this.root.visible = false;
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetGate = null;
    this.targetNode = null;
    this.targetMonster = null;
    this.activeBoss = null;
    this.invasionState = null;

    if (this.invasionBannerEl) this.invasionBannerEl.style.display = 'none';
    if (this.bossBarEl) this.bossBarEl.style.display = 'none';
    if (this.repairBtnEl) this.repairBtnEl.style.display = 'none';
    if (this.bossBtnEl) this.bossBtnEl.style.display = 'none';

    // Remove active monsters from root
    for (const mon of this.activeMonsters.values()) {
      this.root.remove(mon.group);
      this._releaseMonsterMesh(mon.type, mon.group);
    }
    this.activeMonsters.clear();

    if (this.hudEl) {
      this.hudEl.style.display = 'none';
    }
  }

  // ------------------------------------------------------------------ Pure Bounds
  walkable(x, z) {
    const limit = (this.halfSize || 36) - 0.6;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
  }

  clampWalkable(x, z) {
    const limit = (this.halfSize || 36) - 0.6;
    return {
      x: Math.max(-limit, Math.min(limit, x)),
      z: Math.max(-limit, Math.min(limit, z)),
    };
  }

  // ------------------------------------------------------------------ Picking
  pick(clientX, clientY) {
    if (!this.active || !this.world || !this.layout) return null;

    // 1. Monster picking has priority over nodes
    let bestMonster = null;
    let bestMonsterDist = 45;
    for (const mon of this.activeMonsters.values()) {
      const s = this.world.worldToScreen(mon.x, mon.isBoss ? 1.5 : 0.6, mon.z);
      if (!s) continue;
      const d = Math.hypot(clientX - s.x, clientY - s.y);
      if (d < bestMonsterDist) {
        bestMonsterDist = d;
        bestMonster = mon;
      }
    }
    if (bestMonster) {
      return { kind: 'sf_monster', monster: bestMonster };
    }

    // 2. Check nodes within ~40 px
    let bestNode = null;
    let bestDist = 40;
    for (const node of this.layout.nodes || []) {
      const s = this.world.worldToScreen(node.x, 0.7, node.z);
      if (!s) continue;
      const d = Math.hypot(clientX - s.x, clientY - s.y);
      if (d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }
    if (bestNode) {
      return { kind: 'sf_node', node: bestNode };
    }

    // 3. Check gates within ~40 px
    let bestGate = null;
    let bestGateDist = 45;
    for (const gate of this.layout.gates || []) {
      const s = this.world.worldToScreen(gate.at.x, 1.0, gate.at.z);
      if (!s) continue;
      const d = Math.hypot(clientX - s.x, clientY - s.y);
      if (d < bestGateDist) {
        bestGateDist = d;
        bestGate = gate;
      }
    }
    if (bestGate) {
      return { kind: 'sf_gate', gate: bestGate };
    }

    return null;
  }

  // ------------------------------------------------------------------ Interaction
  interact(picked) {
    if (!picked || !this.active) return;

    if (picked.kind === 'sf_monster' && picked.monster) {
      this.stopAutoSwing();
      this.targetGate = null;
      this.targetNode = null;
      this.startAutoAttack(picked.monster);
      return;
    }

    if (picked.kind === 'sf_node' && picked.node) {
      const node = picked.node;
      if (this._autoChainTimer) {
        clearTimeout(this._autoChainTimer);
        this._autoChainTimer = null;
      }
      this.stopAutoAttack();
      this.targetGate = null;

      const now = Date.now() + (this.world?.serverOffset || 0);
      if (node.depletedUntil && node.depletedUntil > now) {
        this.toast?.('🌱 This resource is depleted. Finding another nearby!', 1800);
        this.findAndWalkToNextNode(node.type, { playSfx: true });
        return;
      }

      this.targetNode = node;
      this._lastGatheredNodeType = node.type;
      this.world?.walkTo?.(node.x, node.z + 1.2);

      if (this.runeWrapperEl) {
        this.runeWrapperEl.style.display = 'flex';
      }
      this._syncRuneButtonState();

      const local = this.world?.local;
      if (local) {
        const dist = Math.hypot(local.x - node.x, local.z - node.z);
        if (dist <= 3.0 && !this.isSwinging) {
          this.startAutoSwing();
        }
      }
      return;
    }

    if (picked.kind === 'sf_gate' && picked.gate) {
      const gate = picked.gate;
      this.stopAutoSwing();
      this.stopAutoAttack();
      this.targetNode = null;
      this.targetGate = gate;

      this.world?.walkTo?.(gate.at.x, gate.at.z);

      const local = this.world?.local;
      if (local) {
        const dist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
        const rad = (gate.radius || 2) + 1;
        if (dist <= rad) {
          this._triggerGate(gate);
        }
      }
    }
  }

  async _triggerGate(gate) {
    this.targetGate = null;
    try {
      const res = await this.request('sf_region', { to: gate.to });
      if (res && !res.ok) {
        if (res.error === 'gate_locked') {
          this.toast?.("The Sky Mist won't part yet — finish the story chapter (or come with your partner)", 3500);
        } else {
          this.toast?.(res.error || 'The gate is locked.', 3000);
        }
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Auto-Swing Loop (Mining)
  startAutoSwing() {
    this.isSwinging = true;
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this._localPerfectStreak = 0;
    if (this.runeWrapperEl) {
      this.runeWrapperEl.style.display = 'flex';
    }
    if (this.rarityBoostEl) {
      this.rarityBoostEl.textContent = '🎲 Rare+ Chance: 38%';
    }
    this._syncRuneButtonState();
  }

  stopAutoSwing() {
    this.isSwinging = false;
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this._localPerfectStreak = 0;
    this.targetNode = null;
    if (this.runeBtnEl) {
      this.runeBtnEl.classList.remove('sf-beat-active');
    }
    this._syncRuneButtonState();
  }

  async executeStrike() {
    if (!this.targetNode || !this.isSwinging) return;
    const nodeId = this.targetNode.id;
    const perfect = this.nextStrikePerfect;
    this.nextStrikePerfect = false;

    const tool = NODE_TYPES[this.targetNode.type]?.tool || 'pickaxe';
    const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
    const rig = this.world?.local?.rig;
    const tier = this.world?.local?.profile?.frontier?.toolbelt?.[tool] || 1;
    if (rig?.setHeldTool && this._heldTool !== `${tool}:${tier}`) {
      rig.setHeldTool(tool, tier);
      this._heldTool = `${tool}:${tier}`;
    }
    rig?.triggerAttack?.(swing, { dur: 0.75 });

    try {
      const res = await this.request('sf_strike', { nodeId, perfect });
      if (!res) return;

      if (!res.ok) {
        if (res.error === 'no_energy') {
          this.toast?.('⚡ Out of Energy! Rest or eat to recover.', 2800);
          this.stopAutoSwing();
        } else if (res.error === 'tool_tier') {
          this.toast?.('🔨 Your tool tier is too low for this resource.', 2800);
          this.stopAutoSwing();
        } else if (res.error === 'out_of_range' || res.error === 'depleted') {
          this.stopAutoSwing();
        }
        return;
      }

      if (res.energy) {
        this.setEnergy(res.energy);
      }

      if (res.broke) {
        this.stopAutoSwing();
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Combat Auto-Attack Loop
  startAutoAttack(monster) {
    this.targetMonster = monster;
    this.isAttacking = true;
    this.attackTimer = 0;

    const local = this.world?.local;
    const mainTool = local?.profile?.frontier?.toolbelt?.main || 'pickaxe';
    const range = mainTool === 'staff' ? 6.0 : 1.5;

    // Walk into attack range
    if (local) {
      const dx = monster.x - local.x;
      const dz = monster.z - local.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetWalkX = monster.x - (dx / d) * Math.min(range * 0.85, 1.2);
      const targetWalkZ = monster.z - (dz / d) * Math.min(range * 0.85, 1.2);
      this.world?.walkTo?.(targetWalkX, targetWalkZ);
    }
  }

  stopAutoAttack() {
    this.isAttacking = false;
    this.targetMonster = null;
    this.attackTimer = 0;
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
  }

  async executeAttack() {
    if (!this.targetMonster || !this.isAttacking) return;
    const local = this.world?.local;
    if (!local) return;
    const targetId = this.targetMonster.id;

    const dx = this.targetMonster.x - local.x;
    const dz = this.targetMonster.z - local.z;
    const len = Math.hypot(dx, dz) || 1;
    const facing = { x: +(dx / len).toFixed(3), z: +(dz / len).toFixed(3) };

    const mainTool = local?.profile?.frontier?.toolbelt?.main || 'pickaxe';
    const swing = mainTool === 'axe' ? 'chop_swing' : mainTool === 'staff' ? 'staff_cast' : 'mine_swing';
    const tier = local?.profile?.frontier?.toolbelt?.[mainTool] || 1;
    const rig = local?.rig;
    if (rig?.setHeldTool && this._heldTool !== `${mainTool}:${tier}`) {
      rig.setHeldTool(mainTool, tier);
      this._heldTool = `${mainTool}:${tier}`;
    }
    rig?.triggerAttack?.(swing, { dur: 0.45 });

    try {
      const res = await this.request('sf_attack', { targetId, facing });
      if (!res) return;

      if (res.cooldownMs) {
        this.attackCooldownMs = res.cooldownMs;
      }

      if (!res.ok) {
        if (res.error === 'cooldown' && res.readyAt) {
          const now = Date.now() + (this.world?.serverOffset || 0);
          this.attackTimer = Math.max(0, (this.attackCooldownMs || 650) - (res.readyAt - now));
        } else if (res.error === 'down') {
          this.stopAutoAttack();
        } else if (res.error === 'out_of_range') {
          this.world?.walkTo?.(this.targetMonster.x, this.targetMonster.z);
        }
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Ultimate Medallion
  updateUltimateCharm() {
    const charm = this.world?.local?.profile?.equipped?.charm;
    if (!charm) {
      if (this.ultBtnEl) this.ultBtnEl.style.opacity = '0.45';
      if (this.ultIconEl) this.ultIconEl.textContent = '✨';
      if (this.ultLabelEl) this.ultLabelEl.textContent = 'NO CHARM';
      return;
    }

    if (this.ultBtnEl) this.ultBtnEl.style.opacity = '1.0';
    const def = CHARMS[charm.id] || (charm.uid && CHARMS[charm.uid]);
    if (this.ultIconEl) this.ultIconEl.textContent = def?.icon || '✨';
    if (this.ultLabelEl) this.ultLabelEl.textContent = def?.name ? def.name.split(' ')[0] : 'ULT';
  }

  async triggerUltimate() {
    const local = this.world?.local;
    if (!local) return;
    const now = Date.now() + (this.world?.serverOffset || 0);
    if (this.ultReadyAt && now < this.ultReadyAt) {
      this.toast?.('Ultimate on cooldown!', 1500);
      return;
    }

    let facing = { x: 0, z: -1 };
    if (this.targetMonster) {
      facing = { x: this.targetMonster.x - local.x, z: this.targetMonster.z - local.z };
    } else if (local.rig?.facing) {
      facing = { x: local.rig.facing.right ? 1 : -1, z: local.rig.facing.back ? -1 : 1 };
    }
    const len = Math.hypot(facing.x, facing.z) || 1;
    facing = { x: +(facing.x / len).toFixed(3), z: +(facing.z / len).toFixed(3) };

    try {
      const res = await this.request('sf_ultimate', { facing });
      if (!res) return;
      if (res.ok) {
        if (res.readyAt) {
          this.ultReadyAt = res.readyAt;
          this.ultTotalCd = Math.max(1000, res.readyAt - now);
        }
      } else {
        if (res.error === 'no_ultimate') {
          this.toast?.('No Charm equipped! Equip one in Bag to use Ultimates.', 3000);
        } else if (res.error === 'cooldown') {
          if (res.readyAt) {
            this.ultReadyAt = res.readyAt;
            this.ultTotalCd = Math.max(1000, res.readyAt - now);
          }
        } else if (res.error === 'down') {
          this.toast?.('Cannot cast ultimate while knocked out!', 2000);
        }
      }
    } catch {
      // ignore
    }
  }

  _showUltRingVfx(x, z, maxRadius, color) {
    const ringGeo = new THREE.RingGeometry(0.2, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.set(x, 0.06, z);
    this.root.add(mesh);
    this.vfxRings.push({ mesh, maxRadius: maxRadius || 6, age: 0, life: 0.75 });
  }

  // ------------------------------------------------------------------ Context Action Buttons
  async onRepairTap() {
    const local = this.world?.local;
    const pantry = local?.profile?.frontier?.pantry?.items || {};
    const kits = Math.floor(Number(pantry.repair_kit) || 0);
    if (kits <= 0) {
      this.toast?.('No Repair Kits in pantry! Craft them at the Glasshouse.', 3000);
      return;
    }
    try {
      const res = await this.request('sf_repair', { outpostId: this.layout.regionId, kits });
      if (!res) return;
      if (res.ok) {
        this.toast?.(`Repaired Outpost with ${res.used} kit(s)! ✨`, 2500);
        if (res.pantry && local?.profile?.frontier) {
          local.profile.frontier.pantry = res.pantry;
        }
      } else {
        if (res.error === 'full') this.toast?.('Outpost is already at full HP!', 2000);
        else if (res.error === 'too_far') this.toast?.('Move closer to the goddess statue to repair.', 2000);
        else this.toast?.(res.error || 'Could not repair', 2000);
      }
    } catch {
      // ignore
    }
  }

  async onBossSummonTap() {
    const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
    const bossId = isHollow ? 'hollow_crystal_weaver' : 'elder_moss_golem';
    try {
      const res = await this.request('sf_boss_start', { bossId });
      if (!res) return;
      if (!res.ok) {
        if (res.error === 'cooldown') {
          this.toast?.('Boss is resting — please wait for cooldown!', 2500);
        } else if (res.error === 'boss_active') {
          this.toast?.('A boss is already active!', 2000);
        } else {
          this.toast?.(res.error || 'Could not summon boss', 2000);
        }
      }
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------------------------ Server Event Handlers
  onMonsters(m) {
    if (!m || !Array.isArray(m.m)) return;
    for (const entry of m.m) {
      const [id, type, x, z, hp, maxHp] = entry;
      let mon = this.activeMonsters.get(id);
      if (mon) {
        mon.targetX = x;
        mon.targetZ = z;
        mon.hp = hp;
        mon.maxHp = maxHp;
      } else {
        if (this.activeMonsters.size >= 40) continue;
        const isBoss = type === 'elder_moss_golem' || type === 'hollow_crystal_weaver';
        const group = this._acquireMonsterMesh(type);
        group.position.set(x, isBoss ? 0 : group.userData.baseY || 0, z);
        this.root.add(group);
        mon = {
          id,
          type,
          group,
          hp,
          maxHp,
          x,
          z,
          targetX: x,
          targetZ: z,
          isBoss,
          hpBar: group.userData.hpBar,
          hpFill: group.userData.hpFill,
          baseY: group.userData.baseY || 0,
          bobPhase: Math.random() * Math.PI * 2,
          shakeTimer: 0,
        };
        this.activeMonsters.set(id, mon);
      }
    }
  }

  onMonsterDead(m) {
    if (!m || !m.id) return;
    const mon = this.activeMonsters.get(m.id);
    if (mon) {
      if (this.targetMonster && this.targetMonster.id === m.id) {
        this.stopAutoAttack();
      }
      this._showDeathPuff(mon.x, mon.z, mon.isBoss);
      this.activeMonsters.delete(m.id);
      this.root.remove(mon.group);
      this._releaseMonsterMesh(mon.type, mon.group);
    }

    const localId = this.world?.local?.id;
    if (m.drops && localId && m.drops[localId]) {
      const parts = [];
      for (const [mat, count] of Object.entries(m.drops[localId])) {
        if (count > 0) parts.push(`+${count} ${EMOJI_MAP[mat] || '📦'}`);
      }
      if (parts.length && mon) {
        this.showFloatingText(parts.join('  '), mon.x, mon.z);
      }
    }
  }

  onHit(m) {
    if (!m) return;
    if (Array.isArray(m.hits)) {
      for (const [id, dealt, crit, monHp] of m.hits) {
        const mon = this.activeMonsters.get(id);
        if (mon) {
          mon.hp = monHp;
          mon.shakeTimer = 0.22;
          const text = crit ? `💥 ${dealt}!` : `-${dealt}`;
          this.showFloatingText(text, mon.x, mon.z);
        }
      }
    }
    if (Array.isArray(m.heals)) {
      for (const [uid, amt] of m.heals) {
        if (amt > 0) {
          if (uid === this.world?.local?.id) {
            this.showFloatingText(`💚 +${amt}`, this.world.local.x, this.world.local.z);
          } else {
            const r = this.world?.remotes?.get(uid);
            if (r) this.showFloatingText(`💚 +${amt}`, r.x, r.z);
          }
        }
      }
    }
  }

  onPlayerHp(m) {
    if (m && m.id === this.world?.local?.id) {
      this.playerHp = { hp: m.hp, maxHp: m.maxHp, shield: m.shield || 0 };
      this.updatePlayerHpBar();
    }
  }

  onPlayerDown(m) {
    if (m && m.id === this.world?.local?.id) {
      this.toast?.('💫 Knocked out — respawning at the outpost…', 4500);
      this.stopAutoAttack();
      this.stopAutoSwing();
      this.playerHp = { hp: 0, maxHp: this.playerHp?.maxHp || 100, shield: 0 };
      this.updatePlayerHpBar();
    }
  }

  onPlayerRespawn(m) {
    if (m && m.id === this.world?.local?.id) {
      this.playerHp = { hp: m.hp, maxHp: m.maxHp, shield: 0 };
      this.updatePlayerHpBar();
    }
  }

  onOutpost(m) {
    if (!m) return;
    this.outpostState = m;
    const max = m.maxHp || 1000;
    const cur = Math.max(0, m.hp !== undefined ? m.hp : max);
    const pct = Math.max(0, Math.min(1, cur / max));

    if (this.outpostStatue) {
      if (m.offline || cur <= 0) {
        this.outpostStatue.material.color.setHex(0x555555);
        this.outpostStatue.material.roughness = 0.95;
      } else {
        this.outpostStatue.material.color.setHex(0xF0EDE6);
        this.outpostStatue.material.roughness = 0.32;
      }
    }

    if (this.outpostRing) {
      if (m.offline || cur <= 0) {
        this.outpostRing.material.color.setHex(0x333333);
      } else {
        const col = pct > 0.5 ? 0x4CAF50 : pct > 0.25 ? 0xFFB300 : 0xE53935;
        this.outpostRing.material.color.setHex(col);
      }
    }
  }

  onInvasion(m) {
    if (!m) return;
    this.invasionState = m;
  }

  onBoss(m) {
    if (!m) return;
    if (m.event === 'expired') {
      this.activeBoss = null;
      if (this.bossBarEl) this.bossBarEl.style.display = 'none';
      return;
    }
    if (m.hp !== undefined) {
      this.activeBoss = m;
      if (this.bossBarEl) this.bossBarEl.style.display = 'block';
      if (this.bossNameEl) this.bossNameEl.textContent = `👑 ${m.name || 'Boss'}`;
      if (this.bossStageEl) this.bossStageEl.textContent = m.stage ? `Phase ${m.stage + 1} 🔥` : 'Phase 1';
      const cur = Math.max(0, Math.round(m.hp));
      const max = Math.max(1, Math.round(m.maxHp));
      const pct = Math.min(100, Math.max(0, (cur / max) * 100));
      if (this.bossFillEl) this.bossFillEl.style.width = `${pct}%`;
      if (this.bossTextEl) this.bossTextEl.textContent = `${cur} / ${max}`;
      if (cur <= 0) {
        this.activeBoss = null;
        if (this.bossBarEl) this.bossBarEl.style.display = 'none';
      }
    }
  }

  onBossDefeated(m) {
    if (!m) return;
    this.activeBoss = null;
    if (this.bossBarEl) this.bossBarEl.style.display = 'none';

    const localId = this.world?.local?.id;
    const myLoot = m.loot && localId ? m.loot[localId] : null;
    if (myLoot) {
      const items = Object.entries(myLoot.items || {}).map(([k, v]) => `+${v} ${EMOJI_MAP[k] || '📦'}`).join('  ');
      let msg = `🏆 Boss Defeated! Loot: ${items}`;
      if (myLoot.charm) {
        msg += ` | 🌟 Found Charm: ${myLoot.charm.name} (${myLoot.charm.grade || ''})!`;
      }
      this.toast?.(msg, 5000);
      const local = this.world?.local;
      if (local) this.showFloatingText(msg, local.x, local.z);
    }
  }

  onUlt(m) {
    if (!m) return;
    const effectColors = {
      freeze: 0x00E5FF,
      heal_field: 0x4CAF50,
      shield: 0xFF80AB,
      nuke: 0xFF5722,
      cone: 0xFF5722,
      stun: 0x9C27B0,
      haste: 0xFFEB3B,
      slow: 0x5C6BC0,
      pull: 0x26C6DA,
      summon: 0xFFD54F,
    };
    const color = effectColors[m.effect] || 0xE8B85A;
    this._showUltRingVfx(m.x, m.z, m.radius || 6, color);
    this.showFloatingText(`✨ ${m.name || 'Ultimate'}!`, m.x, m.z);
  }

  onNodeHit(m) {
    if (!m || !m.nodeId) return;
    const nodeId = String(m.nodeId);
    const node = (this.layout?.nodes || []).find((n) => String(n.id) === nodeId);
    if (node) {
      node.hp = m.hp;
    }

    const typeDef = NODE_TYPES[node?.type] || {};
    const maxHp = Number(m.maxHp) || Number(typeDef.hp) || 8;
    const curHp = Math.max(0, Number(m.hp) || 0);
    const perfectCount = Number(m.perfectCount) || 0;
    const rareBoostPct = Number(m.rareBoostPct) || 0;

    if (this.rarityBoostEl && this.targetNode && String(this.targetNode.id) === nodeId) {
      const totalChance = Math.min(95, 38 + rareBoostPct);
      this.rarityBoostEl.textContent = perfectCount > 0
        ? `🔥 Perfect ×${perfectCount} • 🎲 Rare+ ${totalChance}%`
        : `🎲 Rare+ Chance: ${totalChance}%`;
    }

    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      mesh.userData.shakeTimer = m.perfect ? 0.38 : 0.25;
      mesh.userData.pulseTimer = m.perfect ? 0.38 : 0.25;

      // Update 3D Node HP & Rarity Charge Bar
      if (mesh.userData.hpBar && mesh.userData.hpFill) {
        mesh.userData.hpBar.visible = true;
        const pct = Math.max(0.05, Math.min(1, curHp / Math.max(1, maxHp)));
        mesh.userData.hpFill.scale.x = pct;
        mesh.userData.hpFill.position.x = -(1 - pct) * 0.52;
        const chargeColor = perfectCount >= 4
          ? 0xFACC15
          : perfectCount >= 2
          ? 0x38BDF8
          : perfectCount >= 1
          ? 0x34D399
          : 0xE8B85A;
        mesh.userData.hpFill.material.color.setHex(chargeColor);
        if (mesh.userData.auraRing) {
          mesh.userData.auraRing.material.color.setHex(chargeColor);
          mesh.userData.auraRing.material.opacity = Math.min(0.85, 0.40 + perfectCount * 0.12);
        }
      }

      const toolIcon = typeDef.tool === 'axe' ? '🪓' : typeDef.tool === 'staff' ? '✨' : '⛏️';
      const sfxKind = typeDef.tool === 'axe' ? 'hit_axe' : typeDef.tool === 'staff' ? 'hit_staff' : 'hit_pickaxe';
      this.playGatherSfx(sfxKind);
      if (m.perfect) {
        this.showFloatingText(
          `⚡ PERFECT! ×1.5 (+${Math.max(12, rareBoostPct)}% Rare ⬆️)`,
          mesh.position.x,
          mesh.position.z,
          'sf-float-perfect'
        );
        this.world?.fx?.emit?.('fx_star', mesh.position.x, 1.2, mesh.position.z, 10, {
          speed: 0.95,
          up: 1.25,
          size: 0.24,
          life: 0.55,
        });
      } else {
        this.showFloatingText(
          `${toolIcon} -1 (${curHp}/${maxHp})`,
          mesh.position.x,
          mesh.position.z,
          'sf-float-hit'
        );
        this.world?.fx?.emit?.('fx_star', mesh.position.x, 1.0, mesh.position.z, 4, {
          speed: 0.5,
          up: 0.8,
          size: 0.15,
          life: 0.4,
        });
      }
    }
  }

  onNodeBreak(m) {
    if (!m || !m.nodeId) return;
    const nodeId = String(m.nodeId);
    const node = (this.layout?.nodes || []).find((n) => String(n.id) === nodeId);
    if (node) {
      node.hp = 0;
      node.depletedUntil = m.depletedUntil;
    }

    const wasMyTarget = Boolean(this.targetNode && String(this.targetNode.id) === nodeId);
    if (wasMyTarget) {
      this.stopAutoSwing();
    }

    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      this._setNodeDepletedMesh(mesh, true);
    }

    const localId = this.world?.local?.id;
    const userShare = m.shares && localId ? m.shares[localId] : null;
    const parts = [];

    if (userShare && typeof userShare === 'object') {
      for (const [mat, count] of Object.entries(userShare)) {
        if (count > 0) {
          const emoji = EMOJI_MAP[mat] || '📦';
          parts.push(`+${count} ${emoji}`);
        }
      }
    }

    if (m.rares && localId && m.rares[localId]) {
      for (const [mat, count] of Object.entries(m.rares[localId])) {
        if (count > 0) {
          const emoji = EMOJI_MAP[mat] || '✨';
          parts.push(`+${count} ${emoji}`);
        }
      }
    }

    if (parts.length > 0 && node) {
      const rarity = m.rarity || { id: 'common', badge: '⚪', label: 'Harvest', mult: 1 };
      let prefix = '';
      let extraClass = '';

      if (rarity.id === 'epic') {
        this.playGatherSfx('break_epic');
        prefix = `${rarity.badge || '🌟'} EPIC JACKPOT (${rarity.mult}×)!  `;
        extraClass = 'sf-float-epic';
        this._showUltRingVfx(node.x, node.z, 4.8, 0xFACC15);
        this.world?.fx?.emit?.('fx_star', node.x, 1.2, node.z, 18, {
          speed: 1.4,
          up: 1.6,
          size: 0.32,
          life: 0.75,
        });
        this.toast?.(`🌟 EPIC JACKPOT HARVEST! ${parts.join('  ')}`, 3500);
      } else if (rarity.id === 'rare') {
        this.playGatherSfx('break_rare');
        prefix = `${rarity.badge || '🔵'} RARE VEIN (${rarity.mult}×)!  `;
        extraClass = 'sf-float-rare';
        this._showUltRingVfx(node.x, node.z, 3.2, 0x38BDF8);
        this.world?.fx?.emit?.('fx_star', node.x, 1.1, node.z, 12, {
          speed: 1.1,
          up: 1.3,
          size: 0.25,
          life: 0.6,
        });
      } else if (rarity.id === 'uncommon') {
        this.playGatherSfx('break_common');
        prefix = `${rarity.badge || '🟢'} FINE HARVEST (${rarity.mult}×)!  `;
        extraClass = 'sf-float-uncommon';
        this.world?.fx?.emit?.('fx_star', node.x, 1.0, node.z, 8, {
          speed: 0.85,
          up: 1.1,
          size: 0.2,
          life: 0.5,
        });
      } else {
        this.playGatherSfx('break_common');
      }

      this.showFloatingText(`${prefix}${parts.join('  ')}`, node.x, node.z, extraClass);
    }

    // 1-Thumb Auto-Chain: if the player was harvesting this node and still has energy,
    // automatically walk to the next nearest node after a brief celebratory beat!
    if ((wasMyTarget || parts.length > 0) && this.active && (this.energy?.cur || 0) >= 2) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      const nextPref =
        this.preferredTargetType && this.preferredTargetType !== 'auto'
          ? this.preferredTargetType
          : node?.type || 'auto';
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || this.targetNode || this.targetMonster || this.targetGate) return;
        this.findAndWalkToNextNode(nextPref);
      }, 420);
    }
  }

  showFloatingText(text, wx, wz, extraClass = '') {
    if (!this.floatContainerEl || typeof document === 'undefined') return;

    const el = document.createElement('div');
    el.className = extraClass ? `sf-floating-item ${extraClass}` : 'sf-floating-item';
    el.textContent = text;

    const s = this.world?.worldToScreen?.(wx, 1.8, wz);
    const sx = s ? s.x : window.innerWidth / 2;
    const sy = s ? s.y : window.innerHeight / 2;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;

    this.floatContainerEl.appendChild(el);
    const life = extraClass === 'sf-float-epic' ? 2.6 : extraClass === 'sf-float-hit' ? 1.1 : 1.9;
    this.floatingTexts.push({ el, wx, wz, age: 0, life });
  }

  _showDeathPuff(x, z, isBoss) {
    if (this.world?.fx?.emit) {
      this.world.fx.emit('fx_star', x, 0.6, z, isBoss ? 16 : 8, {
        speed: 1.1,
        up: 1.2,
        size: isBoss ? 0.35 : 0.18,
        life: 0.5,
      });
    }
  }

  // ------------------------------------------------------------------ Energy & HP HUD
  setEnergy(energy) {
    if (energy && typeof energy === 'object') {
      this.energy = {
        cur: Number.isFinite(energy.cur) ? energy.cur : this.energy.cur,
        max: Number.isFinite(energy.max) ? energy.max : this.energy.max,
      };
    } else if (Number.isFinite(energy)) {
      this.energy.cur = energy;
    }
    this.updateHud();
  }

  updatePlayerHpBar() {
    if (!this.hpBarFillEl || !this.hpBarTextEl) return;
    const cur = Math.max(0, Math.round(this.playerHp.hp));
    const max = Math.max(1, Math.round(this.playerHp.maxHp));
    const shield = Math.round(this.playerHp.shield || 0);
    const pct = Math.min(100, Math.max(0, (cur / max) * 100));
    this.hpBarFillEl.style.width = `${pct}%`;
    this.hpBarTextEl.textContent = shield > 0 ? `❤️ ${cur}/${max} 🛡️+${shield}` : `❤️ ${cur}/${max}`;
  }

  updateHud() {
    if (this.vialTextEl) {
      const cur = Math.max(0, Math.floor(this.energy.cur));
      const max = Math.max(1, Math.floor(this.energy.max));
      this.vialTextEl.textContent = `⚡ ${cur}/${max}`;
      if (this.vialLiquidEl) {
        const pct = Math.min(100, Math.max(0, (cur / max) * 100));
        this.vialLiquidEl.style.width = `${pct}%`;
      }
    }

    if (this.regionNameEl && this.layout) {
      this.regionNameEl.textContent = this.layout.regionName || this.layout.regionId || 'Sky Frontier';
    }

    if (this.playersEl && this.layout) {
      const curP = this.layout.players || 1;
      const maxP = this.layout.maxPlayers || 10;
      this.playersEl.textContent = `👥 ${curP}/${maxP}`;
    }
  }

  // ------------------------------------------------------------------ Frame Update
  update(dt = 0.016, camera = null) {
    if (!this.active) return;
    this.elapsed += dt;

    const now = Date.now() + (this.world?.serverOffset || 0);
    const local = this.world?.local;

    // 1. Node bobbing, shake, scale pulse, and depleted/respawned check
    for (const [id, mesh] of this.nodeMeshes.entries()) {
      const node = mesh.userData.node;
      const isDepleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const wasDepleted = Boolean(mesh.userData.isDepleted);

      if (isDepleted !== wasDepleted) {
        this._setNodeDepletedMesh(mesh, isDepleted);
        if (wasDepleted && !isDepleted) {
          node.hp = node.maxHp || 1;
          node.depletedUntil = 0;
        }
      }

      if (mesh.userData.shakeTimer > 0) {
        mesh.userData.shakeTimer -= dt;
        const sInt = (mesh.userData.shakeTimer / 0.3) * 0.12;
        mesh.position.x = node.x + (Math.random() - 0.5) * sInt;
        mesh.position.z = node.z + (Math.random() - 0.5) * sInt;
      } else {
        mesh.position.x = node.x;
        mesh.position.z = node.z;
      }

      let pulse = 1.0;
      if (mesh.userData.pulseTimer > 0) {
        mesh.userData.pulseTimer -= dt;
        pulse += Math.sin((1 - mesh.userData.pulseTimer / 0.3) * Math.PI) * 0.25;
      }

      const baseScale = isDepleted ? 0.3 : 1.0;
      mesh.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);

      if (!isDepleted) {
        mesh.position.y = mesh.userData.baseY + Math.sin(this.elapsed * 2.2 + mesh.userData.bobPhase) * 0.08;
      } else {
        mesh.position.y = 0;
      }
    }

    // 2. Monster position interpolation, idle motion, rotation & HP billboarding
    for (const mon of this.activeMonsters.values()) {
      const lerpT = Math.min(1, dt * 10);
      mon.x += (mon.targetX - mon.x) * lerpT;
      mon.z += (mon.targetZ - mon.z) * lerpT;

      if (mon.shakeTimer > 0) {
        mon.shakeTimer -= dt;
        mon.group.position.x = mon.x + (Math.random() - 0.5) * 0.1;
        mon.group.position.z = mon.z + (Math.random() - 0.5) * 0.1;
      } else {
        mon.group.position.x = mon.x;
        mon.group.position.z = mon.z;
      }

      if (mon.baseY > 0) {
        mon.group.position.y = mon.baseY + Math.sin(this.elapsed * 3 + mon.bobPhase) * 0.1;
      }

      const dx = mon.targetX - mon.x;
      const spriteMesh = mon.group.userData?.spriteMesh;
      if (spriteMesh) {
        if (Math.abs(dx) > 0.008) {
          const absX = Math.abs(spriteMesh.scale.x);
          spriteMesh.scale.x = dx > 0 ? -absX : absX;
        }
        spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
      }

      if (mon.hpBar) {
        if (mon.hp < mon.maxHp && mon.hp > 0) {
          mon.hpBar.visible = true;
          const pct = Math.max(0, Math.min(1, mon.hp / mon.maxHp));
          mon.hpFill.scale.x = pct;
          mon.hpFill.position.x = -0.38 * (1 - pct);
          if (camera) mon.hpBar.quaternion.copy(camera.quaternion);
        } else {
          mon.hpBar.visible = false;
        }
      }
    }

    // 3. Gate proximity check
    if (this.targetGate && local) {
      const dist = Math.hypot(local.x - this.targetGate.at.x, local.z - this.targetGate.at.z);
      const rad = (this.targetGate.radius || 2) + 1;
      if (dist <= rad) {
        const g = this.targetGate;
        this.targetGate = null;
        this._triggerGate(g);
      }
    }

    // 4. Auto-swing timing loop (Mining)
    if (this.targetNode && local) {
      const dist = Math.hypot(local.x - this.targetNode.x, local.z - this.targetNode.z);
      const isDepleted = Boolean(this.targetNode.depletedUntil && this.targetNode.depletedUntil > now);

      if (isDepleted) {
        this.stopAutoSwing();
      } else if (!this.isSwinging) {
        const tap = this.world?.input?.tapTarget;
        if (tap && Math.hypot(tap.x - this.targetNode.x, tap.z - (this.targetNode.z + 1.2)) > 1.5) {
          this.stopAutoSwing();
        } else if (dist <= 3.0) {
          this.startAutoSwing();
        }
      } else {
        if (dist > 3.5) {
          this.stopAutoSwing();
        } else {
          const swingDuration = SWING_MS || 750;
          this.swingTimer += dt * 1000;
          const progress = Math.min(1, this.swingTimer / swingDuration);

          this.inBeatWindow = progress >= 0.58;
          if (this.inBeatWindow && this.runeHeld && !this.nextStrikePerfect) {
            this.triggerPerfectLock();
          }
          this._updateRuneRing(progress, this.inBeatWindow);

          if (this.swingTimer >= swingDuration) {
            this.swingTimer -= swingDuration;
            this.executeStrike();
          }
        }
      }
    }

    // 5. Combat auto-attack loop
    if (this.targetMonster && local) {
      const mon = this.activeMonsters.get(this.targetMonster.id);
      if (!mon || mon.hp <= 0) {
        this.stopAutoAttack();
      } else {
        const dist = Math.hypot(local.x - mon.x, local.z - mon.z);
        const mainTool = local?.profile?.frontier?.toolbelt?.main || 'pickaxe';
        const range = mainTool === 'staff' ? 6.0 : 1.5;

        if (dist > range + 3.0) {
          this.stopAutoAttack();
        } else if (dist <= range + 0.3) {
          const cd = this.attackCooldownMs || 650;
          this.attackTimer += dt * 1000;
          if (this.attackTimer >= cd) {
            this.attackTimer = 0;
            this.executeAttack();
          }
        }
      }
    }

    // 6. Ultimate cooldown sweep & ready state
    if (this.ultBtnEl && this.ultRingEl) {
      const remaining = Math.max(0, this.ultReadyAt - now);
      if (remaining > 0) {
        this.ultBtnEl.classList.remove('sf-ult-ready');
        if (this.ultCdOverlayEl) {
          this.ultCdOverlayEl.style.display = 'flex';
          this.ultCdOverlayEl.textContent = `${Math.ceil(remaining / 1000)}s`;
        }
        const cdTotal = this.ultTotalCd || 60000;
        const frac = Math.min(1, remaining / cdTotal);
        this.ultRingEl.style.strokeDashoffset = `${276 * (1 - frac)}`;
      } else {
        if (this.world?.local?.profile?.equipped?.charm) {
          this.ultBtnEl.classList.add('sf-ult-ready');
        } else {
          this.ultBtnEl.classList.remove('sf-ult-ready');
        }
        if (this.ultCdOverlayEl) this.ultCdOverlayEl.style.display = 'none';
        this.ultRingEl.style.strokeDashoffset = '0';
      }
    }

    // 7. Update expanding VFX rings
    for (let i = this.vfxRings.length - 1; i >= 0; i--) {
      const v = this.vfxRings[i];
      v.age += dt;
      if (v.age >= v.life) {
        this.root.remove(v.mesh);
        v.mesh.geometry.dispose();
        v.mesh.material.dispose();
        this.vfxRings.splice(i, 1);
      } else {
        const p = v.age / v.life;
        const s = 1 + p * (v.maxRadius / 0.45 - 1);
        v.mesh.scale.set(s, 1, s);
        v.mesh.material.opacity = 0.85 * (1 - p);
      }
    }

    // 8. Invasion banner status update
    if (this.invasionBannerEl && this.invasionState) {
      const inv = this.invasionState;
      if (inv.phase === 'warning') {
        this.invasionBannerEl.style.display = 'flex';
        const sec = Math.max(0, Math.ceil((inv.at - now) / 1000));
        if (this.invasionTitleEl) this.invasionTitleEl.textContent = '⚠️ INVASION IMMINENT';
        if (this.invasionSubEl) this.invasionSubEl.textContent = `Wave 1 in ${sec}s — Defend the Outpost!`;
      } else if (inv.phase === 'active') {
        this.invasionBannerEl.style.display = 'flex';
        if (this.invasionTitleEl) this.invasionTitleEl.textContent = `⚔️ INVASION — Wave ${inv.wave || 1}/${inv.waves || 3}`;
        if (this.invasionSubEl) this.invasionSubEl.textContent = `${inv.remaining || 0} enemies remaining`;
      } else if (inv.phase === 'ended' || inv.result) {
        this.invasionBannerEl.style.display = 'flex';
        if (inv.result === 'success') {
          if (this.invasionTitleEl) this.invasionTitleEl.textContent = '🏆 INVASION REPELLED!';
          if (this.invasionSubEl) this.invasionSubEl.textContent = 'The Outpost is secured!';
        } else {
          if (this.invasionTitleEl) this.invasionTitleEl.textContent = '💀 OUTPOST OVERRUN!';
          if (this.invasionSubEl) this.invasionSubEl.textContent = 'The Goddess Statue platform has fallen.';
        }
      } else {
        this.invasionBannerEl.style.display = 'none';
      }
    }

    // 9. Outpost Repair button proximity
    if (this.repairBtnEl && local) {
      const outpostPoi = this.layout?.pois?.outpost;
      if (outpostPoi) {
        const dist = Math.hypot(local.x - outpostPoi.x, local.z - outpostPoi.z);
        const damaged = this.outpostState && (this.outpostState.offline || (this.outpostState.hp !== undefined && this.outpostState.hp < this.outpostState.maxHp));
        if (dist <= 4.0 && damaged) {
          const pantry = local.profile?.frontier?.pantry?.items || {};
          const kits = Math.floor(Number(pantry.repair_kit) || 0);
          this.repairBtnEl.style.display = 'block';
          this.repairBtnEl.textContent = `🔧 Repair Outpost (${kits} kits)`;
        } else {
          this.repairBtnEl.style.display = 'none';
        }
      }
    }

    // 10. Boss Summon button proximity
    if (this.bossBtnEl && local) {
      const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
      const bossPoiKey = isHollow ? 'boss' : 'golem';
      const bossPoi = this.layout?.pois?.[bossPoiKey];
      const bossName = isHollow ? 'Hollow Crystal Weaver' : 'Elder Moss Golem';

      if (bossPoi && !this.activeBoss) {
        const dist = Math.hypot(local.x - bossPoi.x, local.z - bossPoi.z);
        if (dist <= 6.0) {
          this.bossBtnEl.style.display = 'block';
          this.bossBtnEl.textContent = `⚔️ Summon ${bossName}`;
        } else {
          this.bossBtnEl.style.display = 'none';
        }
      } else {
        this.bossBtnEl.style.display = 'none';
      }
    }

    // 11. Update floating share text positions
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.age += dt;
      if (item.age >= item.life) {
        if (item.el?.parentNode) item.el.parentNode.removeChild(item.el);
        this.floatingTexts.splice(i, 1);
      } else {
        const s = this.world?.worldToScreen?.(item.wx, 1.8 + item.age * 0.9, item.wz);
        if (s && item.el) {
          item.el.style.left = `${s.x}px`;
          item.el.style.top = `${s.y}px`;
          item.el.style.opacity = String(Math.max(0, 1 - (item.age / item.life) ** 2));
        }
      }
    }
  }

  _updateRuneRing(progress, inBeat) {
    if (this.runeRingEl) {
      const circumference = 264;
      const offset = circumference * (1 - progress);
      this.runeRingEl.style.strokeDashoffset = `${offset}`;
    }
    if (this.runeBtnEl) {
      if (inBeat) {
        this.runeBtnEl.classList.add('sf-beat-active');
      } else {
        this.runeBtnEl.classList.remove('sf-beat-active');
      }
    }
  }

  // ------------------------------------------------------------------ Monster Mesh Pooling
  _acquireMonsterMesh(type) {
    let pool = this.monsterPool.get(type);
    if (!pool) {
      pool = [];
      this.monsterPool.set(type, pool);
    }
    if (pool.length > 0) {
      const group = pool.pop();
      group.visible = true;
      return group;
    }
    return this._createMonsterMesh(type);
  }

  _releaseMonsterMesh(type, group) {
    group.visible = false;
    let pool = this.monsterPool.get(type);
    if (!pool) {
      pool = [];
      this.monsterPool.set(type, pool);
    }
    pool.push(group);
  }

  _createMonsterMesh(type) {
    const group = new THREE.Group();
    group.name = `sf_mob_${type}`;
    const geos = this._mobGeos;
    const mats = this._mobMats;

    const isBoss = type === 'elder_moss_golem' || type === 'hollow_crystal_weaver';
    let baseY = 0;

    const MOB_SPRITE_CONFIG = {
      moss_slime:            { key: 'sf_mob_moss_slime',       w: 1.35, baseY: 0,    shadowR: 0.52 },
      thornback_boar:        { key: 'sf_mob_thornback_boar',   w: 1.75, baseY: 0,    shadowR: 0.68 },
      pollen_wisp:           { key: 'sf_mob_pollen_wisp',      w: 1.45, baseY: 0.25, shadowR: 0.45 },
      crystal_beetle:        { key: 'sf_mob_crystal_beetle',   w: 1.65, baseY: 0,    shadowR: 0.62 },
      lantern_bat:           { key: 'sf_mob_lantern_bat',      w: 1.75, baseY: 0.35, shadowR: 0.50 },
      quartz_golemling:      { key: 'sf_mob_quartz_golemling', w: 1.90, baseY: 0,    shadowR: 0.72 },
      elder_moss_golem:      { key: 'sf_boss_moss_golem',      w: 1.55, baseY: 0,    shadowR: 0.65 },
      hollow_crystal_weaver: { key: 'sf_boss_crystal_weaver',  w: 1.60, baseY: 0,    shadowR: 0.68 },
    };
    const cfg = MOB_SPRITE_CONFIG[type] || MOB_SPRITE_CONFIG.quartz_golemling;
    baseY = cfg.baseY;

    // Grounding shadow oval
    const shadowGeo = new THREE.CircleGeometry(cfg.shadowR, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x140E0A,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    group.add(shadow);

    // 2.5D Tree of Savior Monster Sprite
    const info = spriteInfo(cfg.key);
    const aspect = info ? info.h / info.w : 1.05;
    const w = cfg.w;
    const h = w * aspect;
    const spriteGeo = new THREE.PlaneGeometry(w, h);
    spriteGeo.translate(0, h * 0.5, 0);
    const spriteMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    loadSprite(cfg.key).then((s) => {
      if (!s?.texture) return;
      spriteMat.map = s.texture;
      spriteMat.needsUpdate = true;
    });
    const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
    group.add(spriteMesh);

    // Boss scaling & golden ground aura ring
    if (isBoss) {
      group.scale.set(2.8, 2.8, 2.8);
      const crown = new THREE.Mesh(geos.crownRing, mats.crown);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 0.04, 0);
      group.add(crown);
    }

    // Mini HP bar above monster
    const hpBar = new THREE.Group();
    const hpY = isBoss ? h * 0.95 : h + 0.18;
    hpBar.position.set(0, hpY, 0);

    const hpBg = new THREE.Mesh(geos.hpBg, mats.hpBg);
    hpBar.add(hpBg);

    const hpFill = new THREE.Mesh(geos.hpFill, mats.hpFill);
    hpFill.position.set(0, 0, 0.005);
    hpBar.add(hpFill);

    hpBar.visible = false;
    group.add(hpBar);

    group.userData = {
      type,
      isBoss,
      baseY,
      hpBar,
      hpFill,
      spriteMesh,
    };

    return group;
  }

  // ------------------------------------------------------------------ Mesh Creation Helpers
  _addScenicSprite(spriteKey, x, z, width, camLean = -0.58) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const shadowGeo = new THREE.CircleGeometry(width * 0.36, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.018;
    group.add(shadow);

    const info = spriteInfo(spriteKey);
    const aspect = info ? info.h / info.w : 1.1;
    const h = width * aspect;
    const planeGeo = new THREE.PlaneGeometry(width, h);
    planeGeo.translate(0, h * 0.5, 0);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    loadSprite(spriteKey).then((s) => {
      if (!s?.texture) return;
      planeMat.map = s.texture;
      planeMat.needsUpdate = true;
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = camLean;
    group.add(plane);

    this.root.add(group);
    return group;
  }

  _buildFramingBorder(isHollow) {
    const step = 2.4;
    const outerMargin = 1.0;
    const innerMargin = 2.8;
    const positions = [];

    for (let x = -this.halfSize + 1.5; x <= this.halfSize - 1.5; x += step) {
      const zTop = -this.halfSize + outerMargin + (Math.sin(x * 1.7) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: x + Math.cos(x) * 0.3, z: zTop });
      const zBottom = this.halfSize - outerMargin - (Math.cos(x * 1.3) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: x - Math.sin(x) * 0.3, z: zBottom });
    }
    for (let z = -this.halfSize + 2.5; z <= this.halfSize - 2.5; z += step) {
      const xLeft = -this.halfSize + outerMargin + (Math.sin(z * 1.5) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: xLeft, z: z + Math.sin(z) * 0.3 });
      const xRight = this.halfSize - outerMargin - (Math.cos(z * 1.9) * 0.5 + 0.5) * (innerMargin - outerMargin);
      positions.push({ x: xRight, z: z - Math.cos(z) * 0.3 });
    }

    const dummy = new THREE.Object3D();
    const count = positions.length;
    const borderKey = isHollow ? 'sf_prop_hollow_wall' : 'sf_prop_meadow_tree';
    const info = spriteInfo(borderKey);
    const aspect = info ? info.h / info.w : 1.22;
    const baseW = isHollow ? 3.0 : 3.4;
    const baseH = baseW * aspect;

    const planeGeo = new THREE.PlaneGeometry(baseW, baseH);
    planeGeo.translate(0, baseH * 0.48, 0);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
    });
    loadSprite(borderKey).then((s) => {
      if (!s?.texture) return;
      planeMat.map = s.texture;
      planeMat.needsUpdate = true;
    });

    const borderInst = new THREE.InstancedMesh(planeGeo, planeMat, count);
    const camLean = -(this.world?.pitch || 0.58);

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const s = 0.85 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.35;
      const flip = (i % 2 === 0) ? 1 : -1;
      dummy.position.set(p.x, 0, p.z);
      dummy.scale.set(s * flip, s, s);
      dummy.rotation.set(camLean, 0, 0);
      dummy.updateMatrix();
      borderInst.setMatrixAt(i, dummy.matrix);
    }
    borderInst.instanceMatrix.needsUpdate = true;
    this.root.add(borderInst);
  }

  _createNodeMesh(node) {
    const group = new THREE.Group();
    group.name = `sf_node_${node.id}`;
    const type = String(node.type || 'tree');

    const NODE_SPRITE_CONFIG = {
      tree:    { key: 'sf_node_wood',    w: 3.1, shadowR: 0.95 },
      boulder: { key: 'sf_node_stone',   w: 2.2, shadowR: 0.85 },
      wheat:   { key: 'sf_node_wheat',   w: 2.1, shadowR: 0.78 },
      herb:    { key: 'sf_node_herb',    w: 1.9, shadowR: 0.72 },
      crystal: { key: 'sf_node_crystal', w: 2.3, shadowR: 0.85 },
      quartz:  { key: 'sf_node_crystal', w: 2.5, shadowR: 0.92 },
      mithril: { key: 'sf_node_mithril', w: 2.5, shadowR: 0.92 },
    };
    const cfg = NODE_SPRITE_CONFIG[type] || NODE_SPRITE_CONFIG.boulder;

    // Grounding shadow
    const shadowGeo = new THREE.CircleGeometry(cfg.shadowR, 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x1A1410,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.018;
    group.add(shadow);

    // Warm golden gatherable rim ring on ground
    const auraGeo = new THREE.RingGeometry(cfg.shadowR * 0.78, cfg.shadowR * 0.98, 24);
    auraGeo.rotateX(-Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xE8B85A,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraRing = new THREE.Mesh(auraGeo, auraMat);
    auraRing.position.y = 0.025;
    group.add(auraRing);

    // 2.5D Tree of Savior Node Sprite
    const info = spriteInfo(cfg.key);
    const aspect = info ? info.h / info.w : 1.1;
    const w = cfg.w;
    const h = w * aspect;
    const spriteGeo = new THREE.PlaneGeometry(w, h);
    spriteGeo.translate(0, h * 0.5, 0);
    const spriteMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
    });
    loadSprite(cfg.key).then((s) => {
      if (!s?.texture) return;
      spriteMat.map = s.texture;
      spriteMat.needsUpdate = true;
    });
    const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
    group.add(spriteMesh);

    // 3D Node HP & Rarity Charge Bar above node
    const hpBar = new THREE.Group();
    hpBar.position.set(0, h * 0.92, 0.25);
    hpBar.rotation.x = -(this.world?.pitch || 0.58);
    const hpBgGeo = new THREE.PlaneGeometry(1.12, 0.14);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x241812, side: THREE.DoubleSide });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBar.add(hpBg);

    const hpFillGeo = new THREE.PlaneGeometry(1.04, 0.09);
    const hpFillMat = new THREE.MeshBasicMaterial({ color: 0xE8B85A, side: THREE.DoubleSide });
    const hpFill = new THREE.Mesh(hpFillGeo, hpFillMat);
    hpFill.position.set(0, 0, 0.005);
    hpBar.add(hpFill);
    hpBar.visible = false;
    group.add(hpBar);

    group.userData.node = node;
    group.userData.baseY = 0;
    group.userData.bobPhase = Math.random() * Math.PI * 2;
    group.userData.shakeTimer = 0;
    group.userData.pulseTimer = 0;
    group.userData.auraRing = auraRing;
    group.userData.spriteMesh = spriteMesh;
    group.userData.hpBar = hpBar;
    group.userData.hpFill = hpFill;
    group.userData.materials = [
      {
        mat: spriteMat,
        baseColor: new THREE.Color(0xFFFFFF),
      },
    ];

    group.position.set(node.x, 0, node.z);

    const now = Date.now() + (this.world?.serverOffset || 0);
    const isDepleted = Boolean(node.depletedUntil && node.depletedUntil > now);
    this._setNodeDepletedMesh(group, isDepleted);

    return group;
  }

  _setNodeDepletedMesh(mesh, isDepleted) {
    mesh.userData.isDepleted = isDepleted;
    if (mesh.userData.auraRing) {
      mesh.userData.auraRing.visible = !isDepleted;
      if (!isDepleted) {
        mesh.userData.auraRing.material.color.setHex(0xE8B85A);
        mesh.userData.auraRing.material.opacity = 0.36;
      }
    }
    if (mesh.userData.hpBar) {
      mesh.userData.hpBar.visible = false;
    }
    if (mesh.userData.hpFill) {
      mesh.userData.hpFill.scale.x = 1;
      mesh.userData.hpFill.position.x = 0;
      mesh.userData.hpFill.material.color.setHex(0xE8B85A);
    }
    if (isDepleted) {
      mesh.scale.set(0.35, 0.35, 0.35);
      for (const item of mesh.userData.materials || []) {
        item.mat.color.setHex(0x666666);
      }
    } else {
      mesh.scale.set(1.0, 1.0, 1.0);
      for (const item of mesh.userData.materials || []) {
        item.mat.color.copy(item.baseColor);
      }
    }
  }

  dispose() {
    this.exit();
    if (this.hudEl?.parentNode) {
      this.hudEl.parentNode.removeChild(this.hudEl);
      this.hudEl = null;
    }
    if (this.world?.scene) {
      this.world.scene.remove(this.root);
    }
  }
}
