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
  min-width: 0;
  flex: 1 1 auto;
  margin-right: 6px;
  pointer-events: none;
}

.sf-bars-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
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
  gap: 5px;
  background: #E9DCC0;
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 4px 9px;
  height: 34px;
  min-width: 0;
  overflow: hidden;
  color: #3B2A20;
  font-weight: 800;
  font-size: 11.5px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.sf-chip-region {
  color: #3B2A20;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-chip-players {
  color: #6E5339;
  font-size: 11px;
  flex-shrink: 0;
}

.sf-partner-pill {
  display: none;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  background: rgba(46, 24, 34, 0.88);
  border: 1.5px solid #F472B6;
  border-radius: 14px;
  padding: 4px 10px;
  color: #FCE7F3;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  white-space: nowrap;
  transition: transform 0.08s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.sf-partner-pill.sf-sync-active {
  background: linear-gradient(90deg, rgba(131, 24, 67, 0.92), rgba(113, 63, 18, 0.92));
  border-color: #FDE047;
  color: #FEF08A;
  box-shadow: 0 0 12px rgba(244, 114, 182, 0.55), 0 3px 10px rgba(0, 0, 0, 0.45);
}

.sf-partner-pill:active {
  transform: scale(0.94);
}

/* Home button */
.sf-btn-home {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  background: #E9DCC0;
  border: 2px solid #3B2A20;
  border-radius: 16px;
  padding: 4px 11px;
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

.sf-loot-magnet {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(254, 240, 138, 0.95) 0%, rgba(217, 119, 6, 0.9) 100%);
  border: 2px solid #FFFBEB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.8), 0 3px 8px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 4;
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
  flex-direction: row;
  align-items: flex-end;
  gap: 12px;
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
}

.sf-target-pill {
  border: 1.5px solid rgba(201, 164, 92, 0.75);
  background: rgba(36, 24, 18, 0.86);
  color: #F4EAD6;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  line-height: 1.2;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.sf-target-pill.on {
  background: linear-gradient(180deg, #F6DC9A, #C9A45C);
  color: #3B2A20;
  border-color: #FFF3A8;
  box-shadow: 0 0 12px rgba(232, 184, 90, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
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

/* --- Storybook Astrolabe Mini-Map & Interactive Expedition Map Modal --- */
.sf-minimap-btn {
  position: absolute;
  top: max(108px, calc(env(safe-area-inset-top, 12px) + 96px));
  right: 12px;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  pointer-events: auto;
  z-index: 26;
  transition: transform 0.14s ease, filter 0.14s ease;
  -webkit-tap-highlight-color: transparent;
}

.sf-minimap-btn:hover {
  transform: scale(1.05);
}

.sf-minimap-btn:active {
  transform: scale(0.95);
}

.sf-minimap-canvas {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2.5px solid #DFB15B;
  box-shadow:
    0 5px 16px rgba(0, 0, 0, 0.52),
    inset 0 0 0 1.5px rgba(255, 240, 195, 0.38);
  display: block;
}

.sf-minimap-pill {
  margin-top: -8px;
  background: linear-gradient(180deg, #F6E7C8 0%, #DFC699 100%);
  border: 1.5px solid #3B2A20;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 9.5px;
  font-weight: 900;
  color: #3B2A20;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  letter-spacing: 0.2px;
}

body:has(.bc-modal-backdrop:not([hidden])) .sf-minimap-btn,
body:has(#rpg-ui:not([hidden])) .sf-minimap-btn,
body:has(.hub-wrap:not([hidden])) .sf-minimap-btn,
body:has(#sf-map-modal:not([hidden])) .sf-minimap-btn {
  display: none !important;
}

.sf-chip {
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.15s ease;
}

.sf-chip:active {
  transform: scale(0.96);
}

.sf-map-modal {
  position: fixed;
  inset: 0;
  background: rgba(14, 10, 8, 0.68);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  z-index: 260;
  pointer-events: auto;
}

.sf-map-modal[hidden] {
  display: none !important;
}

.sf-map-card {
  width: min(94vw, 410px);
  max-height: min(86vh, 760px);
  overflow-y: auto;
  background: linear-gradient(180deg, #F7ECD5 0%, #EAD7B3 100%);
  border: 3px solid #4A321F;
  border-radius: 22px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.65);
  padding: 12px 14px 14px;
  color: #3B2A20;
  font-family: system-ui, -apple-system, sans-serif;
}

.sf-map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sf-map-title {
  font-size: 15px;
  font-weight: 900;
  color: #3B2A20;
  letter-spacing: 0.2px;
}

.sf-map-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #4A321F;
  background: #E5CFA6;
  color: #3B2A20;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sf-map-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 9px;
}

.sf-map-tab {
  padding: 6px 8px;
  border-radius: 11px;
  border: 1.5px solid #B5925B;
  background: rgba(255, 251, 240, 0.65);
  color: #5C3D24;
  font-size: 11.5px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.sf-map-tab.active {
  background: linear-gradient(180deg, #3B2A20 0%, #261A13 100%);
  border-color: #DFB15B;
  color: #FFE7A3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.sf-map-tab.locked {
  opacity: 0.68;
}

.sf-bigmap-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, #231914 0%, #17100C 100%);
  border: 2.5px solid #8A6236;
  border-radius: 16px;
  padding: 8px;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.55);
}

.sf-bigmap-canvas {
  width: 100%;
  max-width: 248px;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  cursor: crosshair;
  display: block;
  touch-action: manipulation;
}

.sf-bigmap-hint {
  margin-top: 5px;
  font-size: 10.5px;
  font-weight: 800;
  color: #E7D5B4;
  text-align: center;
}

.sf-map-sec-label {
  margin: 10px 0 5px;
  font-size: 11.5px;
  font-weight: 900;
  color: #6B4423;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sf-map-poi-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sf-map-poi-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 252, 244, 0.92);
  border: 1.5px solid #D4B075;
  border-radius: 12px;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.08s ease;
}

.sf-map-poi-row:hover {
  background: #FFFDF7;
}

.sf-map-poi-row:active {
  transform: scale(0.99);
}

.sf-map-poi-ico {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.sf-map-poi-meta {
  flex: 1 1 auto;
  min-width: 0;
}

.sf-map-poi-name {
  font-size: 12px;
  font-weight: 900;
  color: #342011;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-map-poi-sub {
  font-size: 10.5px;
  font-weight: 700;
  color: #7A5330;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-map-poi-btns {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.sf-map-btn {
  padding: 5px 9px;
  border-radius: 9px;
  border: 1.5px solid #9A6B28;
  background: linear-gradient(180deg, #FCD34D 0%, #D97706 100%);
  color: #2A1606;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.sf-map-btn.warp {
  border-color: #0E7490;
  background: linear-gradient(180deg, #38BDF8 0%, #0284C7 100%);
  color: #FFFFFF;
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
    this._navTarget = null;
    this._minimapAccum = 0;
    this.mapModalOpen = false;
    this.isSwinging = false;
    this.swingTimer = 0;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this.runeHeld = false;
    this.autoGatherEnabled = false;
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

    // Floating text & flying loot magnet list
    this.floatingTexts = [];
    this.lootMagnets = [];
    this.dyingMonsters = [];

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

        <button type="button" class="sf-minimap-btn" id="sf-minimap-btn" aria-label="Open Expedition Map">
          <canvas class="sf-minimap-canvas" id="sf-minimap-canvas" width="144" height="144"></canvas>
          <span class="sf-minimap-pill" id="sf-minimap-pill">🗺️ Map</span>
        </button>

        <div class="sf-map-modal" id="sf-map-modal" hidden></div>

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
            <button type="button" class="sf-partner-pill" id="sf-partner-pill"></button>
            <div class="sf-target-pills" id="sf-target-pills" role="group" aria-label="Auto Gather Toggle">
              <button type="button" class="sf-target-pill" id="sf-auto-toggle" data-sf-target="auto" aria-pressed="false">✨ Auto: OFF</button>
            </div>
            <div class="sf-rarity-boost-pill" id="sf-rarity-boost">✨ Tap Node or Auto to Gather</div>
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
    this.chipEl = hud.querySelector('#sf-chip');
    this.homeBtnEl = hud.querySelector('#sf-btn-home');
    this.minimapBtnEl = hud.querySelector('#sf-minimap-btn');
    this.minimapCanvasEl = hud.querySelector('#sf-minimap-canvas');
    this.minimapCtx = this.minimapCanvasEl?.getContext?.('2d') || null;
    this.minimapPillEl = hud.querySelector('#sf-minimap-pill');
    this.mapModalEl = hud.querySelector('#sf-map-modal');
    this.floatContainerEl = hud.querySelector('#sf-floating-container');

    this.partnerPillEl = hud.querySelector('#sf-partner-pill');
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

    this.ultWrapperEl = hud.querySelector('#sf-ult-wrapper');
    this.ultBtnEl = hud.querySelector('#sf-ult-btn');
    this.ultRingEl = hud.querySelector('#sf-ult-ring');
    this.ultIconEl = hud.querySelector('#sf-ult-icon');
    this.ultLabelEl = hud.querySelector('#sf-ult-label');
    this.ultCdOverlayEl = hud.querySelector('#sf-ult-cd-overlay');

    this.runeWrapperEl = hud.querySelector('#sf-rune-wrapper');
    this.targetPillsEl = hud.querySelector('#sf-target-pills');
    this.autoToggleEl = hud.querySelector('#sf-auto-toggle');
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

    if (this.minimapBtnEl) {
      this.minimapBtnEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openMapModal();
      };
    }

    if (this.chipEl) {
      this.chipEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openMapModal();
      };
    }

    if (this.mapModalEl) {
      this.mapModalEl.addEventListener('click', (e) => this._onMapModalClick(e));
    }

    if (this.partnerPillEl) {
      this.partnerPillEl.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.followPartner();
      };
    }

    if (this.targetPillsEl) {
      this.targetPillsEl.addEventListener('pointerdown', (e) => {
        const pill = e.target.closest('[data-sf-target], #sf-auto-toggle');
        if (!pill) return;
        e.preventDefault();
        e.stopPropagation();
        this.setAutoGather(!this.autoGatherEnabled, { playSfx: true });
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

  _renderTargetPills() {
    if (!this.targetPillsEl) return;
    const isOn = Boolean(this.autoGatherEnabled);
    this.targetPillsEl.innerHTML = `<button type="button" class="sf-target-pill ${
      isOn ? 'on' : ''
    }" id="sf-auto-toggle" data-sf-target="auto" aria-pressed="${isOn ? 'true' : 'false'}">${
      isOn ? '✨ Auto: ON' : '✨ Auto: OFF'
    }</button>`;
    this.autoToggleEl = this.targetPillsEl.querySelector('#sf-auto-toggle');
  }

  setAutoGather(enabled, { playSfx = false } = {}) {
    this.autoGatherEnabled = Boolean(enabled);
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this._renderTargetPills();
    if (this.autoGatherEnabled) {
      if (!this.targetNode && !this.targetMonster) {
        this.findAndWalkToNextNode(null, { playSfx });
      } else if (playSfx) {
        this.playGatherSfx('step_target');
      }
    } else {
      // Stop completely when Auto is toggled OFF, even if currently harvesting a tree or walking to one
      this.stopAutoSwing();
      this.stopAutoAttack();
      this.targetGate = null;
      const local = this.world?.local;
      if (local && this.world?.walkTo) {
        this.world.walkTo(local.x, local.z);
      }
      if (this.world?.input) {
        this.world.input.tapTarget = null;
      }
    }
    this._syncRuneButtonState();
    return this.autoGatherEnabled;
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
      monster: '⚔️',
    };
    const streakTxt = (this._feverStreak || 0) >= 2 ? `🔥 Fever ×${this._feverStreak} • ` : '';
    if (this.targetMonster) {
      if (this.runeIconEl) this.runeIconEl.textContent = '⚔️';
      if (this.runeLabelEl) this.runeLabelEl.textContent = this.isAttacking ? 'HOLD/TAP' : 'HUNTING';
      if (this.rarityBoostEl) {
        this.rarityBoostEl.textContent = `${streakTxt}⚔️ Fighting Monster`;
      }
    } else if (this.targetNode) {
      const icon = NODE_ICONS[this.targetNode.type] || '⚒️';
      if (this.runeIconEl) this.runeIconEl.textContent = icon;
      if (this.runeLabelEl) this.runeLabelEl.textContent = this.isSwinging ? 'HOLD/TAP' : 'WALKING';
    } else {
      if (this.runeIconEl) this.runeIconEl.textContent = '⚒️';
      if (this.runeLabelEl) {
        this.runeLabelEl.textContent = 'GATHER';
      }
      if (this.rarityBoostEl) {
        this.rarityBoostEl.textContent = this.autoGatherEnabled
          ? `${streakTxt}✨ Auto: Harvesting Closest`
          : `${streakTxt}✨ Tap Node or Auto to Gather`;
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
    if (preferredType && preferredType !== 'auto') {
      const matching = available.filter(
        (n) => n.type === preferredType || (preferredType === 'crystal' && n.type === 'quartz')
      );
      if (matching.length > 0) {
        candidates = matching;
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

  findAndAttackNextMonster({ playSfx = false } = {}) {
    if (!this.active) return false;
    const local = this.world?.local;
    const px = local?.x ?? 0;
    const pz = local?.z ?? 0;
    const monsters = Array.from(this.activeMonsters.values()).filter((m) => m && m.hp > 0);
    if (monsters.length === 0) {
      this.toast?.('⚔️ Area clear! More monsters will spawn soon.', 1800);
      return false;
    }
    let bestMon = null;
    let bestDist = Infinity;
    for (const m of monsters) {
      const d = Math.hypot(m.x - px, m.z - pz) - (m.isBoss ? 8 : 0);
      if (d < bestDist) {
        bestDist = d;
        bestMon = m;
      }
    }
    if (!bestMon) return false;
    if (playSfx) {
      this.playGatherSfx('step_target');
    }
    this.interact({ kind: 'sf_monster', monster: bestMon });
    return true;
  }

  followPartner() {
    if (!this.active || !this.world) return false;
    const partnerEnt =
      this.world.getPartnerEntity?.() ||
      Array.from(this.world.remotes?.values?.() || [])[0] ||
      null;
    if (!partnerEnt) return false;
    const ax = partnerEnt.smooth?.x ?? partnerEnt.x ?? 0;
    const az = partnerEnt.smooth?.z ?? partnerEnt.z ?? 0;
    this.playGatherSfx('step_target');

    // Check if ally is right next to a monster or resource node so we immediately co-op with them!
    let nearMonster = null;
    let nearMonsterDist = 5.0;
    for (const m of this.activeMonsters.values()) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - ax, m.z - az);
      if (d < nearMonsterDist) {
        nearMonsterDist = d;
        nearMonster = m;
      }
    }
    if (nearMonster) {
      this.toast?.(`💞 Teaming up with ${partnerEnt.id || 'ally'} vs monster!`, 2000);
      this.interact({ kind: 'sf_monster', monster: nearMonster });
      return true;
    }

    const now = Date.now() + (this.world?.serverOffset || 0);
    let nearNode = null;
    let nearNodeDist = 4.5;
    for (const n of this.layout?.nodes || []) {
      if (n.depletedUntil && n.depletedUntil > now) continue;
      const d = Math.hypot(n.x - ax, n.z - az);
      if (d < nearNodeDist) {
        nearNodeDist = d;
        nearNode = n;
      }
    }
    if (nearNode) {
      this.toast?.(`💞 Joining ${partnerEnt.id || 'ally'} for Co-Op Harvest (+25% Sync)!`, 2200);
      this.interact({ kind: 'sf_node', node: nearNode });
      return true;
    }

    this.toast?.(`🧭 Walking to ${partnerEnt.id || 'ally'}!`, 1800);
    this.world.walkTo?.(ax + 0.8, az + 0.8);
    return true;
  }

  onRuneTap() {
    if (!this.targetNode && !this.targetMonster) {
      this.findAndWalkToNextNode(null, { playSfx: true });
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
    this.autoGatherEnabled = false;
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetGate = null;
    this._gatePending = false;
    this._gateInitDisarmPending = true;
    this._gateCooldownUntil = performance.now() + 1200;
    this._disarmedGates = new Set();
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

    // 5. Gate markers (2.5D hand-painted Sky Mist Gate archway + glowing ground ring + portal signpost)
    for (const gate of this.layout.gates || []) {
      const radius = gate.radius || 2.8;
      const unlocked = this._isGateUnlocked(gate);
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.at.x, 0, gate.at.z);
      gateGroup.userData.gate = gate;
      gateGroup.userData.unlocked = unlocked;

      const gDiscGeo = new THREE.CircleGeometry(radius * 0.72, 32);
      gDiscGeo.rotateX(-Math.PI / 2);
      const gDiscMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0x38BDF8 : 0x64748B,
        transparent: true,
        opacity: unlocked ? 0.22 : 0.10,
        depthWrite: false,
      });
      const gDisc = new THREE.Mesh(gDiscGeo, gDiscMat);
      gDisc.position.y = 0.022;
      gateGroup.add(gDisc);

      const gRingGeo = new THREE.RingGeometry(radius * 0.72, radius * 0.96, 36);
      gRingGeo.rotateX(-Math.PI / 2);
      const gRingMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0x7CE8FF : 0x8899AA,
        transparent: true,
        opacity: unlocked ? 0.72 : 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gRing = new THREE.Mesh(gRingGeo, gRingMat);
      gRing.position.y = 0.032;
      gateGroup.add(gRing);

      const gateInfo = spriteInfo('sf_sky_mist_gate');
      const gateAspect = gateInfo ? gateInfo.h / gateInfo.w : 1.35;
      const gateW = 3.8;
      const gatePlaneGeo = new THREE.PlaneGeometry(gateW, gateW * gateAspect);
      gatePlaneGeo.translate(0, (gateW * gateAspect) * 0.5, 0);
      const gatePlaneMat = new THREE.MeshBasicMaterial({
        color: unlocked ? 0xFFFFFF : 0x9FB0C2,
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

      const labelSprite = this._makeGateLabelSprite(gate, unlocked);
      if (labelSprite) {
        labelSprite.position.set(0, gateW * gateAspect * 0.88 + 0.45, 0.2);
        gateGroup.add(labelSprite);
      }

      gateGroup.userData.gRingMat = gRingMat;
      gateGroup.userData.gDiscMat = gDiscMat;
      gateGroup.userData.gatePlaneMat = gatePlaneMat;
      gateGroup.userData.labelSprite = labelSprite;

      this.root.add(gateGroup);
      this.gateMeshes.set(gate.to || gate, gateGroup);
    }

    // 6. Nodes
    for (const node of this.layout.nodes || []) {
      const mesh = this._createNodeMesh(node);
      this.root.add(mesh);
      this.nodeMeshes.set(String(node.id), mesh);
    }

    // 6b. 3D Animated Target Reticle Ring & Ambient Floating World Particles
    this._buildTargetReticle();
    this._buildAmbientParticles(isHollow);

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
    this._navTarget = null;
    this.closeMapModal();
    this._drawMiniMap();
  }

  exit() {
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.autoGatherEnabled = false;
    this.runeHeld = false;
    this.active = false;
    this.root.visible = false;
    this.stopAutoSwing();
    this.stopAutoAttack();
    this._renderTargetPills();
    this.targetGate = null;
    this.targetNode = null;
    this.targetMonster = null;
    this._navTarget = null;
    this.closeMapModal();
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
    for (const dm of this.dyingMonsters) {
      this.root.remove(dm.group);
      this._releaseMonsterMesh(dm.type, dm.group);
    }
    this.dyingMonsters.length = 0;
    for (const lm of this.lootMagnets) {
      if (lm.el?.parentNode) lm.el.parentNode.removeChild(lm.el);
    }
    this.lootMagnets.length = 0;

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

    // 2. Check gates BEFORE resource nodes so nearby boulders/trees never block portal taps
    let bestGate = null;
    let bestGateDist = 56;
    for (const gate of this.layout.gates || []) {
      const sArch = this.world.worldToScreen(gate.at.x, 1.35, gate.at.z);
      const sRing = this.world.worldToScreen(gate.at.x, 0.12, gate.at.z);
      const dArch = sArch ? Math.hypot(clientX - sArch.x, clientY - sArch.y) : Infinity;
      const dRing = sRing ? Math.hypot(clientX - sRing.x, clientY - sRing.y) : Infinity;
      const d = Math.min(dArch, dRing);
      if (d < bestGateDist) {
        bestGateDist = d;
        bestGate = gate;
      }
    }
    if (bestGate) {
      return { kind: 'sf_gate', gate: bestGate };
    }

    // 3. Check nodes within ~40 px
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

    return null;
  }

  _isGateUnlocked(gate) {
    if (!gate?.requires) return true;
    const prof = window.__neora?.state?.profile || this.world?.local?.profile || null;
    if (!prof) return false;
    const req = gate.requires;
    if (prof.frontier?.unlocks?.regions?.includes(req)) return true;
    if (prof.frontier?.unlocks?.gates?.includes(req)) return true;
    if (req === 'hollow') {
      if ((prof.story?.chapter || 0) >= 2) return true;
      if (prof.story?.completed?.includes?.(1)) return true;
      if ((prof.story?.progress?.c2_visit_gate_hollow || 0) >= 1) return true;
    }
    return false;
  }

  _makeGateLabelSprite(gate, unlocked) {
    if (typeof document === 'undefined') return null;
    const destName = gate?.to === 'hollow' ? 'Crystal Hollow' : gate?.to === 'meadow' ? 'Whispering Meadow' : (gate?.to || 'Portal');
    const text = unlocked
      ? (gate?.to === 'hollow' ? '💎 Warp: Crystal Hollow ▸' : '🌾 Warp: Whispering Meadow ▸')
      : `🔒 ${destName} (Ch.2 Unlock)`;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Storybook pill plaque
    const padX = 24;
    const padY = 16;
    const w = canvas.width - padX * 2;
    const h = canvas.height - padY * 2;
    const r = 38;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, padY, w, h, r);
    const grad = ctx.createLinearGradient(0, padY, 0, padY + h);
    if (unlocked) {
      grad.addColorStop(0, 'rgba(18, 42, 66, 0.92)');
      grad.addColorStop(1, 'rgba(11, 25, 42, 0.95)');
    } else {
      grad.addColorStop(0, 'rgba(38, 34, 32, 0.88)');
      grad.addColorStop(1, 'rgba(24, 20, 18, 0.92)');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = unlocked ? '#67E8F9' : '#94A3B8';
    ctx.stroke();

    ctx.font = '900 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = unlocked ? '#ECFEFF' : '#CBD5E1';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(3.9, 0.85, 1);
    spr.renderOrder = 12;
    return spr;
  }

  // ------------------------------------------------------------------ Interaction
  interact(picked) {
    if (!picked || !this.active) return;
    this._navTarget = null;

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
        if (this.autoGatherEnabled) {
          this.toast?.('🌱 This resource is depleted. Finding another nearby!', 1800);
          this.findAndWalkToNextNode(null, { playSfx: true });
        } else {
          this.toast?.('🌱 This resource is regrowing — try another nearby!', 1800);
        }
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
      if (this._autoChainTimer) {
        clearTimeout(this._autoChainTimer);
        this._autoChainTimer = null;
      }
      this.stopAutoSwing();
      this.stopAutoAttack();
      this.targetNode = null;
      this.targetGate = gate;
      this._disarmedGates?.delete?.(gate.to);

      this.world?.walkTo?.(gate.at.x, gate.at.z);

      const local = this.world?.local;
      if (local) {
        const dist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
        const rad = (gate.radius || 2.8) + 0.9;
        if (dist <= rad) {
          this._triggerGate(gate);
        }
      }
    }
  }

  async _triggerGate(gate) {
    if (!gate || this._gatePending) return;
    this.targetGate = null;
    this._gatePending = true;
    this._gateCooldownUntil = performance.now() + 2200;

    // Immediately flush latest local coordinates so server presence is never stale (`too_far`)
    const local = this.world?.local;
    if (local && this.world?.onLocalMove) {
      const f = local.rig?.facing || { right: true, back: true };
      this.world.onLocalMove(
        {
          x: +local.x.toFixed(3),
          z: +local.z.toFixed(3),
          vx: 0,
          vz: 0,
          right: Boolean(f.right ?? true),
          back: Boolean(f.back ?? true),
          zoneSeq: this.world.zoneSeq,
        },
        true
      );
    }

    try {
      const destLabel = gate.to === 'hollow' ? '💎 Crystal Hollow' : gate.to === 'meadow' ? '🌾 Whispering Meadow' : gate.to;
      const res = await this.request('sf_region', { to: gate.to });
      if (res && res.ok) {
        this.playGatherSfx('auto_on');
        this.toast?.(`🌀 Warping to ${destLabel}…`, 2000);
      } else if (res && !res.ok) {
        this._disarmedGates?.add?.(gate.to);
        if (res.error === 'gate_locked') {
          this.toast?.("🌀 The Sky Mist won't part yet — complete Chapter 2 (or enter with your partner)!", 3500);
        } else if (res.error === 'too_far') {
          this.world?.walkTo?.(gate.at.x, gate.at.z);
        } else {
          this.toast?.(res.error || 'The gate is locked.', 3000);
        }
      }
    } catch {
      // ignore
    } finally {
      this._gatePending = false;
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
      const streakTxt = (this._feverStreak || 0) >= 2 ? `🔥 Fever ×${this._feverStreak} • ` : '';
      this.rarityBoostEl.textContent = `${streakTxt}🎲 Rare+ Chance: 38%`;
    }
    const local = this.world?.local;
    const rig = local?.rig;
    if (this.targetNode && local && rig) {
      const tool = NODE_TYPES[this.targetNode.type]?.tool || 'pickaxe';
      const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
      const tier = local.profile?.frontier?.toolbelt?.[tool] || 1;
      rig.facing?.set?.(this.targetNode.x >= local.x, this.targetNode.z < local.z - 0.35);
      if (rig.setHeldTool && this._heldTool !== `${tool}:${tier}`) {
        rig.setHeldTool(tool, tier);
        this._heldTool = `${tool}:${tier}`;
      }
      rig.triggerAttack?.(swing, { dur: 0.75 });
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
    const local = this.world?.local;
    const rig = local?.rig;
    const tier = local?.profile?.frontier?.toolbelt?.[tool] || 1;
    if (this.targetNode && local && rig) {
      rig.facing?.set?.(this.targetNode.x >= local.x, this.targetNode.z < local.z - 0.35);
    }
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
          this.setAutoGather(false);
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
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.targetMonster = monster;
    this.isAttacking = true;
    this.attackTimer = (this.attackCooldownMs || 650) * 0.85;
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    this._syncRuneButtonState();

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
    this.inBeatWindow = false;
    this.nextStrikePerfect = false;
    if (this._heldTool) {
      this.world?.local?.rig?.setHeldTool?.(null);
      this._heldTool = null;
    }
    if (this.runeBtnEl) {
      this.runeBtnEl.classList.remove('sf-beat-active');
    }
    this._syncRuneButtonState();
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
    rig?.facing?.set?.(dx >= 0, dz < -0.35);
    if (rig?.setHeldTool && this._heldTool !== `${mainTool}:${tier}`) {
      rig.setHeldTool(mainTool, tier);
      this._heldTool = `${mainTool}:${tier}`;
    }
    rig?.triggerAttack?.(swing, { dur: 0.45 });
    this.playGatherSfx(mainTool === 'axe' ? 'hit_axe' : mainTool === 'staff' ? 'hit_staff' : 'hit_pickaxe');

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
      if (this.ultWrapperEl) this.ultWrapperEl.style.display = 'none';
      if (this.ultBtnEl) this.ultBtnEl.style.opacity = '0.45';
      if (this.ultIconEl) this.ultIconEl.textContent = '✨';
      if (this.ultLabelEl) this.ultLabelEl.textContent = 'NO CHARM';
      return;
    }

    if (this.ultWrapperEl) this.ultWrapperEl.style.display = 'flex';
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
          walkPhase: Math.random() * Math.PI * 2,
          shakeTimer: 0,
          squashTimer: 0,
          hitFlashTimer: 0,
          hitDir: 1,
        };
        this.activeMonsters.set(id, mon);
      }
    }
  }

  onMonsterDead(m) {
    if (!m || !m.id) return;
    const mon = this.activeMonsters.get(m.id);
    const wasMyTarget = Boolean(this.targetMonster && this.targetMonster.id === m.id);
    if (mon) {
      if (wasMyTarget) {
        this.stopAutoAttack();
      }
      this._showDeathPuff(mon.x, mon.z, mon.isBoss);
      this.activeMonsters.delete(m.id);
      if (mon.hpBar) mon.hpBar.visible = false;
      this.dyingMonsters.push({
        group: mon.group,
        type: mon.type,
        isBoss: mon.isBoss,
        baseY: mon.baseY || 0,
        x: mon.x,
        z: mon.z,
        age: 0,
        life: 0.28,
      });
    }

    const localId = this.world?.local?.id;
    const hasMyDrops = Boolean(m.drops && localId && m.drops[localId]);
    if (hasMyDrops) {
      this._feverStreak = (this._feverStreak || 0) + 1;
      const coupleSync = Array.isArray(m.coupleResonanceUsers) && m.coupleResonanceUsers.includes(localId);
      this.playGatherSfx(coupleSync ? 'break_rare' : 'break_common');
      const parts = [];
      for (const [mat, count] of Object.entries(m.drops[localId])) {
        if (count > 0) parts.push(`+${count} ${EMOJI_MAP[mat] || '📦'}`);
      }
      if (parts.length && mon) {
        const prefix = coupleSync ? '💞 COUPLE SYNC (+25%)!  ' : '';
        if (coupleSync) {
          this._showUltRingVfx(mon.x, mon.z, 3.0, 0xF472B6);
        }
        this.punchCamera(0.08, 0.18);
        const local = this.world?.local;
        if (local && this.world?.fx?.emitTo) {
          this.world.fx.emitTo('fx_star', mon.x, 0.9, mon.z, local.x, 0.9, local.z, 8, {
            arc: 1.4,
            dur: 0.46,
            size: 0.24,
          });
        }
        this.showFloatingText(`${prefix}${parts.join('  ')}`, mon.x, mon.z, coupleSync ? 'sf-float-rare' : '');
        this.spawnLootMagnets(m.drops[localId], mon.x, mon.z);
      }
      this._syncRuneButtonState();
    }

    // If Auto is toggled ON and the monster we were fighting dies, resume harvesting closest resource node
    if (this.autoGatherEnabled && wasMyTarget && this.active && (this.energy?.cur || 0) >= 2) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || !this.autoGatherEnabled || this.targetMonster || this.targetNode || this.targetGate) return;
        this.findAndWalkToNextNode();
      }, 380);
    }
  }

  onHit(m) {
    if (!m) return;
    if (m.by && m.by !== this.world?.local?.id) {
      const rem = this.world?.remotes?.get?.(m.by);
      if (rem?.rig) {
        const tool = m.tool || 'pickaxe';
        const swing = tool === 'axe' ? 'chop_swing' : tool === 'staff' ? 'staff_cast' : 'mine_swing';
        rem.rig.setHeldTool?.(tool, 1);
        if (m.facing) {
          rem.rig.facing?.set?.(m.facing.x >= 0, m.facing.z < -0.35);
        }
        rem.rig.triggerAttack?.(swing, { dur: 0.45 });
      }
    }
    if (Array.isArray(m.hits)) {
      for (const [id, dealt, crit, monHp] of m.hits) {
        const mon = this.activeMonsters.get(id);
        if (mon) {
          mon.hp = monHp;
          mon.shakeTimer = crit ? 0.30 : 0.22;
          mon.squashTimer = crit ? 0.30 : 0.24;
          mon.hitFlashTimer = 0.16;
          mon.hitDir = (m.facing?.x ?? 1) >= 0 ? -1 : 1;
          if (crit) this.punchCamera(0.075, 0.16);
          const text = crit ? `💥 ${dealt}!` : `-${dealt}`;
          this.showFloatingText(text, mon.x, mon.z, crit ? 'sf-float-perfect' : 'sf-float-hit');
          this.world?.fx?.emit?.('fx_star', mon.x, 0.9, mon.z, crit ? 9 : 4, {
            speed: crit ? 1.1 : 0.65,
            up: 1.0,
            size: crit ? 0.24 : 0.15,
            life: 0.42,
          });
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
      const prevHp = Number(this.playerHp?.hp ?? m.hp);
      const nextHp = Number(m.hp ?? prevHp);
      const local = this.world?.local;
      if (local && nextHp < prevHp - 0.5) {
        const lost = Math.max(1, Math.round(prevHp - nextHp));
        this.showFloatingText(`💔 -${lost}`, local.x, local.z, 'sf-float-hit');
      }
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
      let strikerX = this.world?.local?.x ?? mesh.position.x;
      if (m.by && m.by !== this.world?.local?.id) {
        const rem = this.world?.remotes?.get?.(m.by);
        if (rem) {
          strikerX = rem.smooth?.x ?? rem.x ?? strikerX;
          if (rem.rig) {
            const rTool = typeDef.tool || 'pickaxe';
            const rSwing = rTool === 'axe' ? 'chop_swing' : rTool === 'staff' ? 'staff_cast' : 'mine_swing';
            rem.rig.facing?.set?.(mesh.position.x >= strikerX, mesh.position.z < (rem.smooth?.z ?? rem.z ?? 0) - 0.35);
            rem.rig.setHeldTool?.(rTool, 1);
            rem.rig.triggerAttack?.(rSwing, { dur: 0.72 });
          }
        }
      }
      mesh.userData.shakeTimer = m.perfect ? 0.38 : 0.25;
      mesh.userData.pulseTimer = m.perfect ? 0.38 : 0.26;
      mesh.userData.hitFlashTimer = m.perfect ? 0.18 : 0.12;
      mesh.userData.hitDir = strikerX <= mesh.position.x ? -1 : 1;

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
        this.punchCamera(0.055, 0.14);
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
      node.depletedUntil = m.depletedUntil || (Date.now() + (this.world?.serverOffset || 0) + 10000);
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
      this._feverStreak = (this._feverStreak || 0) + 1;
      const coupleSync = Array.isArray(m.coupleResonanceUsers) && m.coupleResonanceUsers.includes(localId);
      const rarity = m.rarity || { id: 'common', badge: '⚪', label: 'Harvest', mult: 1 };
      let prefix = coupleSync ? '💞 COUPLE SYNC (+25%)!  ' : '';
      let extraClass = coupleSync ? 'sf-float-rare' : '';

      if (coupleSync) {
        this._showUltRingVfx(node.x, node.z, 3.6, 0xF472B6);
      }

      if (rarity.id === 'epic') {
        this.playGatherSfx('break_epic');
        prefix += `${rarity.badge || '🌟'} EPIC JACKPOT (${rarity.mult}×)!  `;
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
        prefix += `${rarity.badge || '🔵'} RARE VEIN (${rarity.mult}×)!  `;
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
        prefix += `${rarity.badge || '🟢'} FINE HARVEST (${rarity.mult}×)!  `;
        extraClass = 'sf-float-uncommon';
        this.world?.fx?.emit?.('fx_star', node.x, 1.0, node.z, 8, {
          speed: 0.85,
          up: 1.1,
          size: 0.2,
          life: 0.5,
        });
      } else {
        this.playGatherSfx(coupleSync ? 'break_rare' : 'break_common');
      }

      this.showFloatingText(`${prefix}${parts.join('  ')}`, node.x, node.z, extraClass);
      this.punchCamera(rarity.id === 'epic' ? 0.11 : rarity.id === 'rare' ? 0.085 : 0.06, 0.20);
      const local = this.world?.local;
      if (local && this.world?.fx?.emitTo) {
        this.world.fx.emitTo('fx_star', node.x, 1.0, node.z, local.x, 0.9, local.z, 9, {
          arc: 1.5,
          dur: 0.48,
          size: rarity.id === 'epic' ? 0.28 : 0.23,
        });
      }
      const mergedLoot = { ...(userShare || {}), ...(m.rares?.[localId] || {}) };
      this.spawnLootMagnets(mergedLoot, node.x, node.z);
      this._syncRuneButtonState();
    }

    // 1-Thumb Auto-Chain: ONLY when Auto is toggled ON, walk to the next closest node after harvest!
    if (this.autoGatherEnabled && (wasMyTarget || parts.length > 0) && this.active && (this.energy?.cur || 0) >= 2) {
      if (this._autoChainTimer) clearTimeout(this._autoChainTimer);
      this._autoChainTimer = setTimeout(() => {
        this._autoChainTimer = null;
        if (!this.active || !this.autoGatherEnabled || this.targetNode || this.targetMonster || this.targetGate) return;
        this.findAndWalkToNextNode();
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

  spawnLootMagnets(itemsObj, wx, wz) {
    if (!this.floatContainerEl || typeof document === 'undefined' || !itemsObj) return;
    const icons = [];
    for (const [mat, count] of Object.entries(itemsObj)) {
      const n = Math.min(3, Math.max(1, Math.ceil(Number(count || 0) / 2)));
      const emo = EMOJI_MAP[mat] || '📦';
      for (let i = 0; i < n && icons.length < 6; i++) icons.push(emo);
    }
    const s = this.world?.worldToScreen?.(wx, 1.0, wz);
    const startX = s ? s.x : window.innerWidth / 2;
    const startY = s ? s.y : window.innerHeight / 2;

    icons.forEach((emo, idx) => {
      const el = document.createElement('div');
      el.className = 'sf-loot-magnet';
      el.textContent = emo;
      el.style.left = `${startX}px`;
      el.style.top = `${startY}px`;
      this.floatContainerEl.appendChild(el);
      const angle = ((idx - (icons.length - 1) / 2) * 0.55) + (Math.random() - 0.5) * 0.25;
      const spreadX = Math.sin(angle) * (42 + Math.random() * 22);
      const peakY = -(55 + Math.random() * 28);
      this.lootMagnets.push({
        el,
        startX,
        startY,
        spreadX,
        peakY,
        delay: idx * 0.045,
        age: 0,
        life: 0.62,
      });
    });
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

  punchCamera(intensity = 0.075, dur = 0.16) {
    this._camShakeIntensity = Math.max(this._camShakeIntensity || 0, intensity);
    this._camShakeTimer = Math.max(this._camShakeTimer || 0, dur);
  }

  _buildTargetReticle() {
    const group = new THREE.Group();
    const outerGeo = new THREE.RingGeometry(0.95, 1.14, 32);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xFFD54F,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    const innerGeo = new THREE.RingGeometry(0.62, 0.72, 6);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xFFF9C4,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    group.position.set(0, 0.04, 0);
    group.visible = false;
    group.userData = { outerMat, innerMat, innerMesh };
    this.targetRing = group;
    this.root.add(group);
  }

  _buildAmbientParticles(isHollow) {
    const count = 64;
    const positions = new Float32Array(count * 3);
    const hs = (this.halfSize || 36) - 2;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * hs;
      positions[i * 3 + 1] = 0.35 + Math.random() * 2.8;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * hs;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let tex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      if (typeof g.createRadialGradient === 'function') {
        const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
        if (isHollow) {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.35, '#6FE0F0');
          grd.addColorStop(0.7, 'rgba(156, 123, 224, 0.65)');
          grd.addColorStop(1, 'rgba(111, 224, 240, 0)');
        } else {
          grd.addColorStop(0, '#FFFFFF');
          grd.addColorStop(0.35, '#FFE885');
          grd.addColorStop(0.7, 'rgba(240, 184, 72, 0.65)');
          grd.addColorStop(1, 'rgba(240, 184, 72, 0)');
        }
        g.fillStyle = grd;
      } else {
        g.fillStyle = isHollow ? '#6FE0F0' : '#FFE885';
      }
      g.fillRect(0, 0, 32, 32);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
    }

    const mat = new THREE.PointsMaterial({
      map: tex,
      color: isHollow ? 0x9EEFFF : 0xFFF2A6,
      size: isHollow ? 0.34 : 0.28,
      transparent: true,
      opacity: isHollow ? 0.82 : 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ambientGeo = geo;
    this.ambientMat = mat;
    this.ambientPoints = new THREE.Points(geo, mat);
    this.root.add(this.ambientPoints);
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

    // 0. Camera micro-punch & ambient world particles
    if (this._camShakeTimer > 0) {
      this._camShakeTimer = Math.max(0, this._camShakeTimer - dt);
      const s = (this._camShakeTimer / 0.18) * (this._camShakeIntensity || 0.07);
      this.root.position.x = (Math.random() - 0.5) * s * 2;
      this.root.position.z = (Math.random() - 0.5) * s * 2;
    } else if (this.root.position.x !== 0 || this.root.position.z !== 0) {
      this.root.position.set(0, 0, 0);
      this._camShakeIntensity = 0;
    }

    if (this.ambientGeo) {
      const pos = this.ambientGeo.attributes.position.array;
      const hs = (this.halfSize || 36) - 2;
      const dtf = Math.min(dt || 0.016, 0.1) * 60;
      for (let i = 0; i < 64; i++) {
        const idx = i * 3;
        pos[idx] += Math.sin(this.elapsed * 1.1 + i * 1.7) * 0.014 * dtf;
        pos[idx + 1] += Math.cos(this.elapsed * 1.5 + i * 2.3) * 0.008 * dtf;
        pos[idx + 2] += Math.cos(this.elapsed * 0.9 + i * 1.3) * 0.014 * dtf;
        if (pos[idx + 1] < 0.25) pos[idx + 1] = 2.6;
        if (pos[idx + 1] > 3.2) pos[idx + 1] = 0.4;
        if (pos[idx] > hs) pos[idx] = -hs;
        if (pos[idx] < -hs) pos[idx] = hs;
        if (pos[idx + 2] > hs) pos[idx + 2] = -hs;
        if (pos[idx + 2] < -hs) pos[idx + 2] = hs;
      }
      this.ambientGeo.attributes.position.needsUpdate = true;
    }

    if (this.outpostRing) {
      const pulse = 1 + Math.sin(this.elapsed * 2.8) * 0.035;
      this.outpostRing.scale.set(pulse, pulse, 1);
    }

    // 1. Grounded node breeze sway, directional hit recoil, squash-stretch, and regrowth pop
    for (const [id, mesh] of this.nodeMeshes.entries()) {
      const node = mesh.userData.node;
      const isDepleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const wasDepleted = Boolean(mesh.userData.isDepleted);

      if (isDepleted !== wasDepleted) {
        this._setNodeDepletedMesh(mesh, isDepleted);
        if (wasDepleted && !isDepleted) {
          node.hp = node.maxHp || 1;
          node.depletedUntil = 0;
          mesh.userData.spawnPopTimer = 0.36;
        }
      }

      if (mesh.userData.shakeTimer > 0) {
        mesh.userData.shakeTimer -= dt;
        const sInt = (mesh.userData.shakeTimer / 0.32) * 0.08;
        mesh.position.x = node.x + (Math.random() - 0.5) * sInt;
        mesh.position.z = node.z + (Math.random() - 0.5) * sInt;
      } else {
        mesh.position.x = node.x;
        mesh.position.z = node.z;
      }

      let sx = isDepleted ? 0.32 : 1.0;
      let sy = isDepleted ? 0.32 : 1.0;
      let hitTiltZ = 0;
      if (mesh.userData.pulseTimer > 0) {
        mesh.userData.pulseTimer -= dt;
        const p = 1 - Math.max(0, mesh.userData.pulseTimer) / 0.32;
        const sq = Math.sin(p * Math.PI * 2) * (1 - p) * 0.24;
        sx *= 1 + sq;
        sy *= 1 - sq * 0.85;
        hitTiltZ = (mesh.userData.hitDir || 1) * Math.sin(p * Math.PI) * 0.16;
      } else if (mesh.userData.spawnPopTimer > 0) {
        mesh.userData.spawnPopTimer -= dt;
        const p = 1 - Math.max(0, mesh.userData.spawnPopTimer) / 0.36;
        const pop = Math.sin(p * Math.PI) * 0.22;
        sx *= 1 - pop * 0.4;
        sy *= 1 + pop;
      }

      if (mesh.userData.hitFlashTimer > 0) {
        mesh.userData.hitFlashTimer -= dt;
        for (const item of mesh.userData.materials || []) {
          item.mat.color.setHex(mesh.userData.hitFlashTimer > 0 ? 0xFFF3B0 : (isDepleted ? 0x666666 : 0xFFFFFF));
        }
      }

      const spriteMesh = mesh.userData.spriteMesh;
      if (spriteMesh && !isDepleted) {
        const isFoliage = node.type === 'tree' || node.type === 'wheat' || node.type === 'herb';
        const swayAmp = node.type === 'wheat' || node.type === 'herb' ? 0.055 : isFoliage ? 0.028 : 0.01;
        const breezeZ = Math.sin(this.elapsed * 2.1 + mesh.userData.bobPhase) * swayAmp;
        const breath = Math.sin(this.elapsed * 1.8 + mesh.userData.bobPhase) * (isFoliage ? 0.018 : 0.01);
        spriteMesh.rotation.z = breezeZ + hitTiltZ;
        sx *= 1 + breath;
        sy *= 1 - breath;
      } else if (spriteMesh) {
        spriteMesh.rotation.z = 0;
      }

      mesh.scale.set(sx, sy, sx);
      mesh.position.y = 0;
    }

    // 2. Monster position interpolation, hop-walk, breathing idle, hit recoil & HP billboarding
    for (const mon of this.activeMonsters.values()) {
      const prevX = mon.x;
      const prevZ = mon.z;
      const lerpT = Math.min(1, dt * 10);
      mon.x += (mon.targetX - mon.x) * lerpT;
      mon.z += (mon.targetZ - mon.z) * lerpT;
      const stepDist = Math.hypot(mon.x - prevX, mon.z - prevZ);
      const speed = stepDist / Math.max(0.001, dt);

      if (mon.shakeTimer > 0) {
        mon.shakeTimer -= dt;
        mon.group.position.x = mon.x + (Math.random() - 0.5) * 0.1;
        mon.group.position.z = mon.z + (Math.random() - 0.5) * 0.1;
      } else {
        mon.group.position.x = mon.x;
        mon.group.position.z = mon.z;
      }

      const baseScale = mon.isBoss ? 2.8 : 1.0;
      let sx = baseScale;
      let sy = baseScale;
      let tiltZ = 0;

      if (mon.baseY > 0) {
        // Flying monsters (Pollen Wisp, Lantern Bat): hover bob + wing banking tilt
        mon.group.position.y = mon.baseY + Math.sin(this.elapsed * 4.2 + mon.bobPhase) * 0.12;
        tiltZ = Math.cos(this.elapsed * 4.2 + mon.bobPhase) * 0.06;
        const flap = Math.sin(this.elapsed * 9.0 + mon.bobPhase) * 0.04;
        sx *= 1 + flap;
        sy *= 1 - flap;
      } else if (speed > 0.12) {
        // Ground monsters walking/chasing:bouncy slime/boar hop + waddle + landing squash
        mon.walkPhase = (mon.walkPhase || 0) + dt * (mon.isBoss ? 7.5 : 11.5);
        const hopSin = Math.sin(mon.walkPhase);
        const hopHeight = Math.abs(hopSin) * (mon.isBoss ? 0.14 : 0.22);
        mon.group.position.y = hopHeight;
        tiltZ = hopSin * (mon.isBoss ? 0.05 : 0.09);
        const bounceSq = Math.cos(mon.walkPhase * 2) * 0.075;
        sx *= 1 + bounceSq;
        sy *= 1 - bounceSq;
      } else {
        // Ground monsters idle: lively breathing squash & stretch
        mon.group.position.y = 0;
        const breath = Math.sin(this.elapsed * 3.2 + mon.bobPhase) * 0.042;
        sx *= 1 + breath;
        sy *= 1 - breath;
      }

      if (mon.squashTimer > 0) {
        mon.squashTimer -= dt;
        const p = 1 - Math.max(0, mon.squashTimer) / 0.26;
        const hitSq = Math.sin(p * Math.PI) * 0.24;
        sx *= 1 + hitSq;
        sy *= 1 - hitSq * 0.85;
        tiltZ += (mon.hitDir || 1) * Math.sin(p * Math.PI) * 0.18;
      }

      mon.group.scale.set(sx, sy, baseScale);

      const dx = mon.targetX - mon.x;
      const spriteMesh = mon.group.userData?.spriteMesh;
      if (spriteMesh) {
        if (Math.abs(dx) > 0.008) {
          const absX = Math.abs(spriteMesh.scale.x);
          spriteMesh.scale.x = dx > 0 ? -absX : absX;
        }
        spriteMesh.rotation.x = -(this.world?.pitch || 0.58);
        spriteMesh.rotation.z = tiltZ;
        if (mon.hitFlashTimer > 0) {
          mon.hitFlashTimer -= dt;
          spriteMesh.material.color.setHex(mon.hitFlashTimer > 0 ? 0xFFE082 : 0xFFFFFF);
        }
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

    // 2b. Dying monster spin-squash-pop animation
    for (let i = this.dyingMonsters.length - 1; i >= 0; i--) {
      const dm = this.dyingMonsters[i];
      dm.age += dt;
      if (dm.age >= dm.life) {
        this.root.remove(dm.group);
        this._releaseMonsterMesh(dm.type, dm.group);
        this.dyingMonsters.splice(i, 1);
      } else {
        const p = dm.age / dm.life;
        const baseScale = dm.isBoss ? 2.8 : 1.0;
        const popY = Math.sin(p * Math.PI) * 0.45;
        dm.group.position.set(dm.x, (dm.baseY || 0) + popY, dm.z);
        const s = baseScale * (1 - p * 0.75);
        dm.group.scale.set(s * (1 + p * 0.4), s * (1 - p * 0.5), baseScale);
        const sm = dm.group.userData?.spriteMesh;
        if (sm) {
          sm.rotation.z = p * 0.85;
          sm.material.color.setHex(0xFFE082);
        }
      }
    }

    // 3. Gate animation, unlock visual sync & automatic walk-into-portal proximity check
    if (local && Array.isArray(this.layout?.gates) && this.layout.gates.length > 0) {
      if (this._gateInitDisarmPending) {
        this._gateInitDisarmPending = false;
        for (const gate of this.layout.gates) {
          const spawnDist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
          if (spawnDist <= (gate.radius || 3) + 1.8) {
            this._disarmedGates?.add?.(gate.to);
          }
        }
      }

      const pNow = performance.now();
      for (const gate of this.layout.gates) {
        const gGroup = this.gateMeshes.get(gate.to || gate);
        const unlocked = this._isGateUnlocked(gate);
        if (gGroup) {
          if (gGroup.userData.unlocked !== unlocked) {
            gGroup.userData.unlocked = unlocked;
            if (gGroup.userData.gRingMat) gGroup.userData.gRingMat.color.setHex(unlocked ? 0x7CE8FF : 0x8899AA);
            if (gGroup.userData.gDiscMat) {
              gGroup.userData.gDiscMat.color.setHex(unlocked ? 0x38BDF8 : 0x64748B);
              gGroup.userData.gDiscMat.opacity = unlocked ? 0.22 : 0.10;
            }
            if (gGroup.userData.gatePlaneMat) gGroup.userData.gatePlaneMat.color.setHex(unlocked ? 0xFFFFFF : 0x9FB0C2);
            if (gGroup.userData.labelSprite) {
              gGroup.remove(gGroup.userData.labelSprite);
              gGroup.userData.labelSprite.material?.map?.dispose?.();
              gGroup.userData.labelSprite.material?.dispose?.();
            }
            const nextLbl = this._makeGateLabelSprite(gate, unlocked);
            if (nextLbl) {
              nextLbl.position.set(0, 4.95, 0.2);
              gGroup.add(nextLbl);
              gGroup.userData.labelSprite = nextLbl;
            }
          }
          if (gGroup.userData.gRingMat) {
            const pulse = 0.56 + Math.sin(this.elapsed * 3.4) * 0.22;
            gGroup.userData.gRingMat.opacity = unlocked ? pulse : 0.40;
          }
          if (gGroup.userData.labelSprite) {
            gGroup.userData.labelSprite.position.y = 4.95 + Math.sin(this.elapsed * 2.5) * 0.08;
          }
        }

        const dist = Math.hypot(local.x - gate.at.x, local.z - gate.at.z);
        if (this._disarmedGates?.has?.(gate.to) && dist > Math.max(3.8, (gate.radius || 3) + 0.8)) {
          this._disarmedGates.delete(gate.to);
        }

        if (this.targetGate && this.targetGate.to === gate.to) {
          const rad = (gate.radius || 2.8) + 0.9;
          if (dist <= rad && !this._gatePending) {
            this.targetGate = null;
            this._triggerGate(gate);
            break;
          }
        } else if (
          !this.targetGate
          && !this._gatePending
          && pNow >= (this._gateCooldownUntil || 0)
          && !this._disarmedGates?.has?.(gate.to)
          && dist <= (gate.radius || 2.8)
        ) {
          this._triggerGate(gate);
          break;
        }
      }
    }

    // 4. Auto-swing timing loop (Mining)
    if (this.targetNode && local) {
      const dist = Math.hypot(local.x - this.targetNode.x, local.z - this.targetNode.z);
      const isDepleted = Boolean(this.targetNode.depletedUntil && this.targetNode.depletedUntil > now);

      if (isDepleted) {
        this.stopAutoSwing();
        if (this.autoGatherEnabled && (this.energy?.cur || 0) >= 2 && !this._autoChainTimer) {
          this._autoChainTimer = setTimeout(() => {
            this._autoChainTimer = null;
            if (this.active && this.autoGatherEnabled && !this.targetNode && !this.targetMonster && !this.targetGate) {
              this.findAndWalkToNextNode();
            }
          }, 350);
        }
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
        const tap = this.world?.input?.tapTarget;

        if (tap && Math.hypot(tap.x - mon.x, tap.z - mon.z) > range + 2.5) {
          this.stopAutoAttack();
        } else if (dist > range + 0.35) {
          const dx = mon.x - local.x;
          const dz = mon.z - local.z;
          const d = Math.hypot(dx, dz) || 1;
          const targetWalkX = mon.x - (dx / d) * Math.min(range * 0.85, 1.2);
          const targetWalkZ = mon.z - (dz / d) * Math.min(range * 0.85, 1.2);
          if (!tap || Math.hypot(tap.x - targetWalkX, tap.z - targetWalkZ) > 0.6) {
            this.world?.walkTo?.(targetWalkX, targetWalkZ);
          }
          this._updateRuneRing(0, false);
        } else {
          const cd = this.attackCooldownMs || 650;
          this.attackTimer += dt * 1000;
          const progress = Math.min(1, this.attackTimer / cd);
          this.inBeatWindow = progress >= 0.58;
          if (this.inBeatWindow && this.runeHeld && !this.nextStrikePerfect) {
            this.triggerPerfectLock();
          }
          this._updateRuneRing(progress, this.inBeatWindow);
          if (this.attackTimer >= cd) {
            this.attackTimer = 0;
            this.nextStrikePerfect = false;
            this.executeAttack();
          }
        }
      }
    }

    // 5a. Smart Auto-Defense when Auto is ON and an aggroed monster is right on top of the player (while not actively swinging at a node)
    if (this.autoGatherEnabled && !this.targetMonster && !this.isSwinging && !this._navTarget && local) {
      let closestThreat = null;
      let closestThreatDist = 2.35;
      for (const mon of this.activeMonsters.values()) {
        if (!mon || mon.hp <= 0) continue;
        const d = Math.hypot(mon.x - local.x, mon.z - local.z);
        if (d < closestThreatDist) {
          closestThreatDist = d;
          closestThreat = mon;
        }
      }
      if (closestThreat) {
        this.targetNode = null;
        this.startAutoAttack(closestThreat);
      }
    }

    // 5a-1. Mini-Map Navigation Waypoint tracking & arrival
    if (this._navTarget && local) {
      const joy = this.world?.input?.joy;
      if (joy && Math.hypot(joy.x || 0, joy.y || 0) > 0.18) {
        this._navTarget = null;
      } else {
        const tap = this.world?.input?.tapTarget;
        if (tap && Math.hypot(tap.x - this._navTarget.x, tap.z - this._navTarget.z) > 2.2) {
          this._navTarget = null;
        } else {
          const navDist = Math.hypot(local.x - this._navTarget.x, local.z - this._navTarget.z);
          if (navDist <= 2.35) {
            const arrived = this._navTarget;
            this._navTarget = null;
            if (!arrived.isGate) {
              this.world?.fx?.emit?.('fx_stardust', local.x, 0.3, local.z, 8, {
                speed: 1.0,
                up: 0.9,
                size: 0.22,
                life: 0.5,
              });
              if (this.autoGatherEnabled && (this.energy?.cur || 0) >= 2 && !this.targetNode && !this.targetMonster) {
                this.findAndWalkToNextNode();
              }
            }
          }
        }
      }
    }

    // 5a-2. 3D Animated Target Reticle Ring under current targetNode, targetMonster, or _navTarget
    if (this.targetRing) {
      if (this.targetMonster) {
        const mon = this.activeMonsters.get(this.targetMonster.id) || this.targetMonster;
        this.targetRing.visible = true;
        this.targetRing.position.set(mon.x, 0.04, mon.z);
        const baseR = mon.isBoss ? 2.1 : 1.05;
        const pulse = baseR * (1 + Math.sin(this.elapsed * 7.5) * 0.08);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(0xFF5252);
        this.targetRing.userData.innerMat?.color.setHex(0xFFCDD2);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = this.elapsed * 1.8;
        }
      } else if (this.targetNode) {
        this.targetRing.visible = true;
        this.targetRing.position.set(this.targetNode.x, 0.04, this.targetNode.z);
        const pulse = 1.12 * (1 + Math.sin(this.elapsed * 5.5) * 0.07);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(this.inBeatWindow ? 0xFFF176 : 0xFFD54F);
        this.targetRing.userData.innerMat?.color.setHex(0xFFF9C4);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = -this.elapsed * 1.4;
        }
      } else if (this._navTarget) {
        this.targetRing.visible = true;
        this.targetRing.position.set(this._navTarget.x, 0.04, this._navTarget.z);
        const pulse = 1.25 * (1 + Math.sin(this.elapsed * 6.0) * 0.1);
        this.targetRing.scale.set(pulse, 1, pulse);
        this.targetRing.userData.outerMat?.color.setHex(0x38BDF8);
        this.targetRing.userData.innerMat?.color.setHex(0xE0F2FE);
        if (this.targetRing.userData.innerMesh) {
          this.targetRing.userData.innerMesh.rotation.z = this.elapsed * 1.6;
        }
      } else {
        this.targetRing.visible = false;
      }
    }

    // 5a-3. Live Mini-Map & Open Expedition Map Canvas (~15 Hz)
    this._minimapAccum = (this._minimapAccum || 0) + dt;
    if (this._minimapAccum >= 0.066) {
      this._minimapAccum = 0;
      this._drawMiniMap();
      if (this.mapModalOpen) {
        this._drawBigMap();
      }
    }

    // 5b. Live Partner & Co-Op Radar Pill
    if (this.partnerPillEl && local) {
      const partnerId = local.profile?.partner_id;
      const partnerEnt =
        this.world?.getPartnerEntity?.() ||
        Array.from(this.world?.remotes?.values?.() || [])[0] ||
        null;
      if (partnerEnt) {
        const isPartner =
          Boolean(partnerId) &&
          String(partnerEnt.id || '').toLowerCase() === String(partnerId).toLowerCase();
        const ax = partnerEnt.smooth?.x ?? partnerEnt.x ?? 0;
        const az = partnerEnt.smooth?.z ?? partnerEnt.z ?? 0;
        const dist = Math.round(Math.hypot(ax - local.x, az - local.z));
        const inSync = dist <= 10;
        this.partnerPillEl.style.display = 'inline-flex';
        this.partnerPillEl.classList.toggle('sf-sync-active', inSync);
        if (inSync) {
          this.partnerPillEl.textContent = isPartner
            ? `💞 Partner Sync Active (+25% Loot!)`
            : `🤝 Co-Op Sync (${partnerEnt.id}) · Full Loot!`;
        } else {
          this.partnerPillEl.textContent = isPartner
            ? `🧭 Partner (${dist}m) · Tap to Join`
            : `🤝 Ally ${partnerEnt.id} (${dist}m) · Tap to Join`;
        }
      } else {
        this.partnerPillEl.style.display = 'none';
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

    // 11. Update floating share text & flying loot magnet positions
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

    const playerScreen = local ? this.world?.worldToScreen?.(local.x, 0.95, local.z) : null;
    const targetScreenX = playerScreen ? playerScreen.x : window.innerWidth / 2;
    const targetScreenY = playerScreen ? playerScreen.y : window.innerHeight / 2;

    for (let i = this.lootMagnets.length - 1; i >= 0; i--) {
      const lm = this.lootMagnets[i];
      if (lm.delay > 0) {
        lm.delay -= dt;
        continue;
      }
      lm.age += dt;
      if (lm.age >= lm.life) {
        if (lm.el?.parentNode) lm.el.parentNode.removeChild(lm.el);
        this.lootMagnets.splice(i, 1);
        if (local?.rig?.HIP) {
          local.rig.HIP.position.y += 0.06;
        }
      } else {
        const p = lm.age / lm.life;
        // Phase 1 (0 -> 0.42): pop outward & upward; Phase 2 (0.42 -> 1.0): magnet home into Chibi!
        let curX;
        let curY;
        let scale = 1;
        if (p < 0.42) {
          const bp = p / 0.42;
          const easeOut = 1 - (1 - bp) * (1 - bp);
          curX = lm.startX + lm.spreadX * easeOut;
          curY = lm.startY + lm.peakY * Math.sin(bp * Math.PI * 0.5);
          scale = 0.7 + 0.45 * Math.sin(bp * Math.PI * 0.5);
        } else {
          const mp = (p - 0.42) / 0.58;
          const easeIn = mp * mp;
          const apexX = lm.startX + lm.spreadX;
          const apexY = lm.startY + lm.peakY;
          curX = apexX + (targetScreenX - apexX) * easeIn;
          curY = apexY + (targetScreenY - apexY) * easeIn - Math.sin(mp * Math.PI) * 18;
          scale = 1.15 - 0.45 * easeIn;
        }
        if (lm.el) {
          lm.el.style.left = `${curX}px`;
          lm.el.style.top = `${curY}px`;
          lm.el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
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
    const baseScale = group.userData?.isBoss ? 2.8 : 1.0;
    group.scale.set(baseScale, baseScale, baseScale);
    const sm = group.userData?.spriteMesh;
    if (sm) {
      sm.rotation.z = 0;
      sm.material.color.setHex(0xFFFFFF);
    }
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

  // ------------------------------------------------------------------ Mini-Map & Expedition Map Navigation
  _getRegionPois() {
    const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
    const pois = this.layout?.pois || {};
    const hollowUnlocked = this._isGateUnlocked({ requires: 'hollow' });
    if (isHollow) {
      return [
        { id: 'outpost', icon: '🗽', label: 'Hollow Outpost', sub: 'Safe Camp & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 6, color: '#FDE047', short: 'Outpost' },
        { id: 'quartz', icon: '🔮', label: 'Violet Quartz Cavern', sub: 'Crystal Ore & Tier-2 Quartz', x: pois.quartz?.x ?? -20, z: pois.quartz?.z ?? 0, color: '#C084FC', short: 'Quartz' },
        { id: 'mithril', icon: '⚒️', label: 'Mithril Deep Vein', sub: 'Crystal Ore & Tier-2 Mithril', x: pois.mithril?.x ?? 20, z: pois.mithril?.z ?? -10, color: '#818CF8', short: 'Mithril' },
        { id: 'boss', icon: '👑', label: 'Weaver Boss Sanctum', sub: 'Herbs & Crystal Weaver Boss', x: pois.boss?.x ?? 0, z: pois.boss?.z ?? -26, color: '#FB7185', short: 'Boss' },
        { id: 'gate_meadow', icon: '🌀', label: 'Gate: Whispering Meadow', sub: 'Portal Warp → Region 1', x: pois.gate_meadow?.x ?? 0, z: pois.gate_meadow?.z ?? 30, color: '#86EFAC', short: 'Meadow Gate', isGate: true, gateTo: 'meadow', unlocked: true },
      ];
    }
    return [
      { id: 'outpost', icon: '🗽', label: 'Goddess Outpost', sub: 'Safe Camp & Statue Repair', x: pois.outpost?.x ?? 0, z: pois.outpost?.z ?? 4, color: '#FDE047', short: 'Outpost' },
      { id: 'grove', icon: '🌲', label: 'Whispering Grove', sub: 'Wood & Dewdrop Herbs', x: pois.grove?.x ?? -22, z: pois.grove?.z ?? 8, color: '#4ADE80', short: 'Grove' },
      { id: 'wheat', icon: '🌾', label: 'Windmill & Wheat', sub: 'Sky Wheat & Herbs', x: pois.wheat?.x ?? 20, z: pois.wheat?.z ?? 12, color: '#FACC15', short: 'Wheat' },
      { id: 'grotto', icon: '💎', label: 'Crystal Grotto', sub: 'Starter Crystal Ore Veins', x: pois.grotto?.x ?? 24, z: pois.grotto?.z ?? -14, color: '#38BDF8', short: 'Grotto' },
      { id: 'golem', icon: '👑', label: 'Moss Golem Arena', sub: 'Stone & Elder Moss Golem Boss', x: pois.golem?.x ?? -20, z: pois.golem?.z ?? -18, color: '#FB7185', short: 'Boss' },
      {
        id: 'gate_hollow',
        icon: '🌀',
        label: 'Gate: Crystal Hollow',
        sub: hollowUnlocked ? 'Open Portal → Region 2' : '🔒 Unlocks after Story Ch.2',
        x: pois.gate_hollow?.x ?? 0,
        z: pois.gate_hollow?.z ?? -32,
        color: hollowUnlocked ? '#67E8F9' : '#94A3B8',
        short: 'Hollow Gate',
        isGate: true,
        gateTo: 'hollow',
        unlocked: hollowUnlocked,
      },
    ];
  }

  navigateTo(x, z, opts = {}) {
    if (!this.active || !this.world) return;
    this.closeMapModal();
    if (this._autoChainTimer) {
      clearTimeout(this._autoChainTimer);
      this._autoChainTimer = null;
    }
    this.stopAutoSwing();
    this.stopAutoAttack();
    this.targetNode = null;

    if (opts.gateTo) {
      const gate = (this.layout?.gates || []).find((g) => g.to === opts.gateTo) || {
        to: opts.gateTo,
        at: { x, z },
        radius: 2.8,
      };
      this.targetGate = gate;
      this._disarmedGates?.delete?.(gate.to);
      this._navTarget = { x: gate.at.x, z: gate.at.z, label: opts.label || 'Sky Mist Gate', isGate: true };
      this.world.walkTo?.(gate.at.x, gate.at.z);
      const local = this.world.local;
      if (local && Math.hypot(local.x - gate.at.x, local.z - gate.at.z) <= (gate.radius || 2.8) + 0.9) {
        this._triggerGate(gate);
      } else {
        this.toast?.(`🧭 Walking to ${opts.label || 'Sky Mist Gate'}…`, 1900);
      }
      return;
    }

    this.targetGate = null;
    const clamped = this.clampWalkable(Number(x) || 0, Number(z) || 0);
    this._navTarget = { x: clamped.x, z: clamped.z, label: opts.label || 'Waypoint', isGate: false };
    this.world.walkTo?.(clamped.x, clamped.z);
    this.world.fx?.emit?.('fx_stardust', clamped.x, 0.25, clamped.z, 6, {
      speed: 0.9,
      up: 0.85,
      size: 0.2,
      life: 0.45,
    });
    if (opts.label) {
      this.toast?.(`🧭 Navigating to ${opts.label}…`, 1900);
    }
  }

  openMapModal() {
    if (!this.active || !this.mapModalEl) return;
    this.mapModalOpen = true;
    this.playGatherSfx('auto_on');
    this._renderMapModalHtml();
    this.mapModalEl.hidden = false;
    this._drawBigMap();
  }

  closeMapModal() {
    this.mapModalOpen = false;
    if (this.mapModalEl) {
      this.mapModalEl.hidden = true;
    }
    this._bigMapCanvasEl = null;
    this._bigMapCtx = null;
  }

  _renderMapModalHtml() {
    if (!this.mapModalEl) return;
    const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
    const hollowUnlocked = this._isGateUnlocked({ requires: 'hollow' });
    const local = this.world?.local;
    const lx = local?.x ?? 0;
    const lz = local?.z ?? 0;
    const pois = this._getRegionPois();

    const poiRows = pois
      .map((poi) => {
        const dist = Math.round(Math.hypot(poi.x - lx, poi.z - lz));
        const warpBtn = poi.isGate && poi.unlocked
          ? `<button type="button" class="sf-map-btn warp" data-sf-warp="${poi.gateTo}">⚡ Warp</button>`
          : '';
        return `
          <div class="sf-map-poi-row" data-sf-walk-x="${poi.x}" data-sf-walk-z="${poi.z}" data-sf-label="${poi.label}" ${poi.isGate ? `data-sf-gate="${poi.gateTo}"` : ''}>
            <span class="sf-map-poi-ico">${poi.icon}</span>
            <div class="sf-map-poi-meta">
              <div class="sf-map-poi-name">${poi.label}</div>
              <div class="sf-map-poi-sub">${poi.sub} • ${dist}m</div>
            </div>
            <div class="sf-map-poi-btns">
              ${warpBtn}
              <button type="button" class="sf-map-btn" data-sf-walk-x="${poi.x}" data-sf-walk-z="${poi.z}" data-sf-label="${poi.label}" ${poi.isGate ? `data-sf-gate="${poi.gateTo}"` : ''}>🚶 Walk</button>
            </div>
          </div>
        `;
      })
      .join('');

    const prof = window.__neora?.state?.profile || local?.profile || {};
    const partnerId = prof.partner_id;
    const remotes = Array.from(this.world?.remotes?.values?.() || []);
    const playerSection = remotes.length
      ? `
        <div class="sf-map-sec-label">👥 Adventurers in Region (${remotes.length})</div>
        <div class="sf-map-poi-list">
          ${remotes
            .map((r) => {
              const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
              const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
              const d = Math.round(Math.hypot(rx - lx, rz - lz));
              const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
              const name = r.data?.username || r.id || 'Adventurer';
              return `
                <div class="sf-map-poi-row" data-sf-walk-x="${rx.toFixed(1)}" data-sf-walk-z="${rz.toFixed(1)}" data-sf-label="${name}">
                  <span class="sf-map-poi-ico">${isPartner ? '💞' : '🧑'}</span>
                  <div class="sf-map-poi-meta">
                    <div class="sf-map-poi-name">${name}${isPartner ? ' (Partner)' : ''}</div>
                    <div class="sf-map-poi-sub">${isPartner ? '+25% Couple Sync within 10m' : 'Co-op Shardmate'} • ${d}m</div>
                  </div>
                  <div class="sf-map-poi-btns">
                    <button type="button" class="sf-map-btn" data-sf-walk-x="${rx.toFixed(1)}" data-sf-walk-z="${rz.toFixed(1)}" data-sf-label="${name}">🚶 Join</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `
      : '';

    this.mapModalEl.innerHTML = `
      <div class="sf-map-card" role="dialog" aria-label="Sky Frontier Expedition Map">
        <div class="sf-map-head">
          <span class="sf-map-title">🗺️ ${isHollow ? 'Crystal Hollow' : 'Whispering Meadow'} Map</span>
          <button type="button" class="sf-map-close" data-sf-map-close="1" aria-label="Close">✕</button>
        </div>
        <div class="sf-map-tabs">
          <button type="button" class="sf-map-tab ${!isHollow ? 'active' : ''}" data-sf-region-tab="meadow">
            🌾 Whispering Meadow
          </button>
          <button type="button" class="sf-map-tab ${isHollow ? 'active' : ''} ${!hollowUnlocked ? 'locked' : ''}" data-sf-region-tab="hollow">
            💎 Crystal Hollow ${hollowUnlocked ? '' : '🔒'}
          </button>
        </div>
        <div class="sf-bigmap-wrap">
          <canvas class="sf-bigmap-canvas" id="sf-bigmap-canvas" width="560" height="560"></canvas>
          <div class="sf-bigmap-hint">👆 Tap anywhere on the map or pick a landmark below to navigate!</div>
        </div>
        <div class="sf-map-sec-label">🧭 Landmarks &amp; Portals</div>
        <div class="sf-map-poi-list">${poiRows}</div>
        ${playerSection}
      </div>
    `;

    this._bigMapCanvasEl = this.mapModalEl.querySelector('#sf-bigmap-canvas');
    this._bigMapCtx = this._bigMapCanvasEl?.getContext?.('2d') || null;
  }

  _onMapModalClick(e) {
    if (e.target === this.mapModalEl || e.target.closest('[data-sf-map-close]')) {
      e.preventDefault();
      this.closeMapModal();
      return;
    }

    const canvas = e.target.closest('#sf-bigmap-canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const pad = 16 * (rect.width / 280);
      const inner = Math.max(1, rect.width - pad * 2);
      const u = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / inner));
      const v = Math.max(0, Math.min(1, (e.clientY - rect.top - pad) / inner));
      const hs = this.halfSize || 36;
      const wx = (u * 2 - 1) * hs;
      const wz = (v * 2 - 1) * hs;

      const pois = this._getRegionPois();
      let hitPoi = null;
      let hitDist = 5.2;
      for (const poi of pois) {
        const d = Math.hypot(wx - poi.x, wz - poi.z);
        if (d < hitDist) {
          hitDist = d;
          hitPoi = poi;
        }
      }
      if (hitPoi) {
        this.navigateTo(hitPoi.x, hitPoi.z, {
          label: `${hitPoi.icon} ${hitPoi.label}`,
          gateTo: hitPoi.isGate ? hitPoi.gateTo : null,
        });
      } else {
        this.navigateTo(wx, wz, {
          label: `📍 Map Pin (${Math.round(wx)}, ${Math.round(wz)})`,
        });
      }
      return;
    }

    const warpBtn = e.target.closest('[data-sf-warp]');
    if (warpBtn) {
      e.preventDefault();
      e.stopPropagation();
      const region = warpBtn.dataset.sfWarp;
      this.closeMapModal();
      window.__neora?.enterFrontier?.(region);
      return;
    }

    const regionTab = e.target.closest('[data-sf-region-tab]');
    if (regionTab) {
      e.preventDefault();
      const targetReg = regionTab.dataset.sfRegionTab;
      const curHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
      const curReg = curHollow ? 'hollow' : 'meadow';
      if (targetReg === curReg) return;
      if (targetReg === 'hollow' && !this._isGateUnlocked({ requires: 'hollow' })) {
        this.toast?.('🔒 Complete Story Chapter 2 to unlock Crystal Hollow!', 2800);
        return;
      }
      this.closeMapModal();
      window.__neora?.enterFrontier?.(targetReg);
      return;
    }

    const walkRow = e.target.closest('[data-sf-walk-x][data-sf-walk-z]');
    if (walkRow) {
      e.preventDefault();
      const wx = parseFloat(walkRow.dataset.sfWalkX);
      const wz = parseFloat(walkRow.dataset.sfWalkZ);
      const label = walkRow.dataset.sfLabel || 'Landmark';
      const gateTo = walkRow.dataset.sfGate || null;
      this.navigateTo(wx, wz, { label, gateTo });
    }
  }

  _getNodeDotColor(type) {
    switch (type) {
      case 'tree': return '#4ADE80';
      case 'boulder': return '#CBD5E1';
      case 'wheat': return '#FACC15';
      case 'herb': return '#34D399';
      case 'crystal': return '#38BDF8';
      case 'quartz': return '#C084FC';
      case 'mithril': return '#818CF8';
      default: return '#FDE68A';
    }
  }

  _getActiveRoutePoint() {
    if (this._navTarget) return this._navTarget;
    if (this.targetGate?.at) return { x: this.targetGate.at.x, z: this.targetGate.at.z };
    if (this.targetNode) return { x: this.targetNode.x, z: this.targetNode.z };
    if (this.targetMonster) return { x: this.targetMonster.x, z: this.targetMonster.z };
    const tap = this.world?.input?.tapTarget;
    if (tap && Number.isFinite(tap.x) && Number.isFinite(tap.z)) return { x: tap.x, z: tap.z };
    return null;
  }

  _drawMiniMap() {
    const ctx = this.minimapCtx;
    if (!ctx || !this.active || !this.layout) return;
    const S = 144;
    const cx = S / 2;
    const cy = S / 2;
    const R = 66;
    const hs = this.halfSize || 36;
    const scale = (R - 10) / hs;
    const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
    const now = Date.now() + (this.world?.serverOffset || 0);

    ctx.clearRect(0, 0, S, S);
    ctx.save();

    // 1. Storybook Astrolabe Dial Background
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const grd = ctx.createRadialGradient(cx, cy, 8, cx, cy, R);
    if (isHollow) {
      grd.addColorStop(0, 'rgba(28, 58, 72, 0.94)');
      grd.addColorStop(0.75, 'rgba(16, 36, 48, 0.96)');
      grd.addColorStop(1, 'rgba(10, 22, 30, 0.98)');
    } else {
      grd.addColorStop(0, 'rgba(62, 86, 46, 0.94)');
      grd.addColorStop(0.75, 'rgba(40, 58, 32, 0.96)');
      grd.addColorStop(1, 'rgba(24, 36, 20, 0.98)');
    }
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.clip();

    // Subtle compass rings & crosshairs
    ctx.strokeStyle = 'rgba(235, 200, 120, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.stroke();

    // Dirt roads in Meadow
    if (!isHollow) {
      ctx.strokeStyle = 'rgba(210, 174, 122, 0.38)';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 0 * scale, cy + 28 * scale);
      ctx.lineTo(cx + 0 * scale, cy - 32 * scale);
      ctx.moveTo(cx + 0 * scale, cy + 4 * scale);
      ctx.lineTo(cx + 20 * scale, cy + 12 * scale);
      ctx.moveTo(cx + 0 * scale, cy + 4 * scale);
      ctx.lineTo(cx - 22 * scale, cy + 8 * scale);
      ctx.stroke();
    }

    // 2. Resource nodes
    for (const node of this.layout.nodes || []) {
      const depleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const px = cx + node.x * scale;
      const py = cy + node.z * scale;
      ctx.fillStyle = depleted ? 'rgba(148, 163, 184, 0.25)' : this._getNodeDotColor(node.type);
      ctx.globalAlpha = depleted ? 0.45 : 0.82;
      ctx.beginPath();
      ctx.arc(px, py, depleted ? 1.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Monsters
    for (const mon of this.activeMonsters.values()) {
      if (!mon || mon.hp <= 0) continue;
      const px = cx + mon.x * scale;
      const py = cy + mon.z * scale;
      ctx.fillStyle = mon.isBoss ? '#FB7185' : '#F87171';
      ctx.beginPath();
      ctx.arc(px, py, mon.isBoss ? 4.5 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Key Landmarks (Outpost Star & Portal Ring)
    const pois = this._getRegionPois();
    for (const poi of pois) {
      const px = cx + poi.x * scale;
      const py = cy + poi.z * scale;
      if (poi.isGate) {
        ctx.strokeStyle = poi.unlocked ? '#67E8F9' : '#94A3B8';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(px, py, 5.2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (poi.id === 'outpost') {
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(px, py, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Co-op Shardmates
    const local = this.world?.local;
    const partnerId = local?.profile?.partner_id;
    for (const r of this.world?.remotes?.values?.() || []) {
      const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
      const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
      const px = cx + rx * scale;
      const py = cy + rz * scale;
      const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
      ctx.fillStyle = isPartner ? '#F472B6' : '#60A5FA';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, isPartner ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Active Navigation Route Line + Local Player Arrow
    if (local) {
      const lx = cx + local.x * scale;
      const lz = cy + local.z * scale;
      const route = this._getActiveRoutePoint();
      if (route && Math.hypot(route.x - local.x, route.z - local.z) > 1.8) {
        const tx = cx + route.x * scale;
        const tz = cy + route.z * scale;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lx, lz);
        ctx.lineTo(tx, tz);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, tz, 4.2 + Math.sin(this.elapsed * 6) * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const vx = local.mover?.vx || 0;
      const vz = local.mover?.vz || 0;
      const heading = Math.hypot(vx, vz) > 0.12
        ? Math.atan2(vz, vx)
        : (local.rig?.facing?.back ? -Math.PI / 2 : Math.PI / 2);

      ctx.save();
      ctx.translate(lx, lz);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.8, 5.2);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.8, 5.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Cardinal N badge
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FDE047';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 3;
    ctx.fillText('N', cx, 5);
    ctx.restore();

    if (this.minimapPillEl) {
      if (this._navTarget) {
        const rem = local ? Math.max(0, Math.round(Math.hypot(this._navTarget.x - local.x, this._navTarget.z - local.z))) : 0;
        this.minimapPillEl.textContent = `🧭 ${rem}m`;
      } else {
        this.minimapPillEl.textContent = '🗺️ Map';
      }
    }
  }

  _drawBigMap() {
    const ctx = this._bigMapCtx;
    if (!ctx || !this.active || !this.layout) return;
    const S = 280;
    const pad = 16;
    const inner = S - pad * 2;
    const cx = S / 2;
    const cy = S / 2;
    const hs = this.halfSize || 36;
    const scale = (inner / 2) / hs;
    const isHollow = String(this.layout?.regionId || '').toLowerCase().includes('hollow');
    const now = Date.now() + (this.world?.serverOffset || 0);

    ctx.clearRect(0, 0, S * 2, S * 2);
    ctx.save();
    ctx.scale(2, 2);

    // 1. Illustrated Map Square
    ctx.beginPath();
    ctx.roundRect(pad - 6, pad - 6, inner + 12, inner + 12, 14);
    const grd = ctx.createRadialGradient(cx, cy, 16, cx, cy, inner * 0.72);
    if (isHollow) {
      grd.addColorStop(0, '#224759');
      grd.addColorStop(1, '#102430');
    } else {
      grd.addColorStop(0, '#4E6F3A');
      grd.addColorStop(1, '#2D4322');
    }
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(235, 198, 122, 0.55)';
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.10)';
    ctx.lineWidth = 1;
    for (let g = -2; g <= 2; g++) {
      const off = (g / 3) * (inner / 2);
      ctx.beginPath();
      ctx.moveTo(cx + off, pad);
      ctx.lineTo(cx + off, S - pad);
      ctx.moveTo(pad, cy + off);
      ctx.lineTo(S - pad, cy + off);
      ctx.stroke();
    }

    // Meadow Country Roads
    if (!isHollow) {
      ctx.strokeStyle = 'rgba(218, 181, 128, 0.48)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy + 28 * scale);
      ctx.lineTo(cx, cy - 32 * scale);
      ctx.moveTo(cx, cy + 4 * scale);
      ctx.lineTo(cx + 20 * scale, cy + 12 * scale);
      ctx.moveTo(cx, cy + 4 * scale);
      ctx.lineTo(cx - 22 * scale, cy + 8 * scale);
      ctx.stroke();
    }

    // 2. Resource Nodes
    for (const node of this.layout.nodes || []) {
      const depleted = Boolean(node.depletedUntil && node.depletedUntil > now);
      const px = cx + node.x * scale;
      const py = cy + node.z * scale;
      ctx.fillStyle = depleted ? 'rgba(148,163,184,0.28)' : this._getNodeDotColor(node.type);
      ctx.beginPath();
      ctx.arc(px, py, depleted ? 2.2 : 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Monsters
    for (const mon of this.activeMonsters.values()) {
      if (!mon || mon.hp <= 0) continue;
      const px = cx + mon.x * scale;
      const py = cy + mon.z * scale;
      ctx.fillStyle = mon.isBoss ? '#FB7185' : '#F87171';
      ctx.beginPath();
      ctx.arc(px, py, mon.isBoss ? 6.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Route line
    const local = this.world?.local;
    if (local) {
      const lx = cx + local.x * scale;
      const lz = cy + local.z * scale;
      const route = this._getActiveRoutePoint();
      if (route && Math.hypot(route.x - local.x, route.z - local.z) > 1.8) {
        const tx = cx + route.x * scale;
        const tz = cy + route.z * scale;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, lz);
        ctx.lineTo(tx, tz);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Landmark Pins & Labels
    const pois = this._getRegionPois();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const poi of pois) {
      const px = cx + poi.x * scale;
      const py = cy + poi.z * scale;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = poi.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(poi.icon, px, py + 0.5);

      ctx.font = '800 9.5px system-ui, sans-serif';
      ctx.fillStyle = '#FFFBEB';
      ctx.shadowColor = 'rgba(0,0,0,0.92)';
      ctx.shadowBlur = 4;
      const labelY = py < 36 ? py + 16 : py - 15;
      ctx.fillText(poi.short, px, labelY);
      ctx.shadowBlur = 0;
    }

    // 6. Co-op Shardmates
    const partnerId = local?.profile?.partner_id;
    for (const r of this.world?.remotes?.values?.() || []) {
      const rx = r.smooth?.x ?? r.data?.x ?? r.x ?? 0;
      const rz = r.smooth?.z ?? r.data?.z ?? r.z ?? 0;
      const px = cx + rx * scale;
      const py = cy + rz * scale;
      const isPartner = partnerId && String(r.id).toLowerCase() === String(partnerId).toLowerCase();
      ctx.fillStyle = isPartner ? '#F472B6' : '#60A5FA';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 7. Local Player ("YOU") Arrow
    if (local) {
      const lx = cx + local.x * scale;
      const lz = cy + local.z * scale;
      const vx = local.mover?.vx || 0;
      const vz = local.mover?.vz || 0;
      const heading = Math.hypot(vx, vz) > 0.12
        ? Math.atan2(vz, vx)
        : (local.rig?.facing?.back ? -Math.PI / 2 : Math.PI / 2);

      ctx.save();
      ctx.translate(lx, lz);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6.5, 7);
      ctx.lineTo(0, 3.5);
      ctx.lineTo(-6.5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
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
