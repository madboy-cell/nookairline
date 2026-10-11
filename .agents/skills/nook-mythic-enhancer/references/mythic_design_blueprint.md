# Mythic Masterpiece Design Blueprint & Code Recipes

This reference provides copy-pasteable code patterns and recipes matching the **Astral Sovereign Standard** in Nook Airline.

---

## 1. Web Audio Procedural Synthesis Recipes (`AudioFX`)

All audio in Nook Airline is synthesized via Web Audio API oscillators for instant zero-latency playback across iOS Safari and Chrome.

### Pattern: Cosmic / Celestial (Astral Sovereign)
```javascript
playAstralShimmer() {
  this.tone(110, { type: 'sine', dur: 0.8, vol: 0.28, slideTo: 45 });
  this.seq([659.25, 880, 1174.66, 1318.5, 1760, 2093, 2637], { type: 'sine', dur: 0.32, vol: 0.16, step: 0.055 });
},
playAstralImpact() {
  this.tone(140, { type: 'sawtooth', dur: 0.45, vol: 0.36, slideTo: 28 });
  this.seq([1760, 2093, 2637], { type: 'triangle', dur: 0.3, vol: 0.2, step: 0.05 });
},
playAstralTick() {
  this.tone(2093 + Math.random() * 500, { type: 'sine', dur: 0.045, vol: 0.06 });
}
```

### Pattern: Abyssal / Ocean Wave (Atlantis Leviathan)
```javascript
playAbyssalWave() {
  this.tone(130, { type: 'sine', dur: 0.65, vol: 0.36, slideTo: 40 });
  this.seq([440, 554.37, 659.25, 880, 1108.73], { type: 'sine', dur: 0.35, vol: 0.22, step: 0.07 });
},
playAbyssalSplash() {
  this.tone(320, { type: 'triangle', dur: 0.28, vol: 0.25, slideTo: 75 });
  this.seq([880, 1175, 1568, 1760], { type: 'sine', dur: 0.22, vol: 0.18, step: 0.04 });
}
```

### Pattern: Luxury Casino / Monte Carlo (Monaco High-Roller)
```javascript
playCasinoChipRoll() {
  this.tone(180, { type: 'sine', dur: 0.5, vol: 0.3, slideTo: 60 });
  this.seq([523.25, 659.25, 783.99, 1046.5], { type: 'triangle', dur: 0.25, vol: 0.2, step: 0.05 });
},
playCasinoSlam() {
  this.tone(160, { type: 'sawtooth', dur: 0.35, vol: 0.38, slideTo: 35 });
  this.seq([1318.5, 1568, 2093], { type: 'sine', dur: 0.28, vol: 0.22, step: 0.06 });
}
```

---

## 2. 3D Orbit CSS Keyframes (`monopoly.css`)

Orbit nodes encircle the dice box in 3D perspective during the roll:

```css
.astral-dice-orbit {
  position: absolute;
  inset: -16px;
  pointer-events: none;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
  animation: astralOrbitSpin 2.4s linear infinite;
}

@keyframes astralOrbitSpin {
  0% { transform: rotateY(0deg) rotateZ(12deg); }
  100% { transform: rotateY(360deg) rotateZ(12deg); }
}

.astral-orbit-node {
  position: absolute;
  font-size: 15px;
  filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.95));
}

.astral-orbit-node.ao-1 { transform: rotateY(0deg) translateZ(48px); }
.astral-orbit-node.ao-2 { transform: rotateY(60deg) translateZ(48px); }
.astral-orbit-node.ao-3 { transform: rotateY(120deg) translateZ(48px); }
.astral-orbit-node.ao-4 { transform: rotateY(180deg) translateZ(48px); }
.astral-orbit-node.ao-5 { transform: rotateY(240deg) translateZ(48px); }
.astral-orbit-node.ao-6 { transform: rotateY(300deg) translateZ(48px); }
```

---

## 3. Micro-HUD Card Structure (Zero Board Obstruction)

```css
.abyss-drift-overlay {
  position: absolute;
  inset: 0;
  z-index: 105;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  pointer-events: none;
  padding: 8px;
  box-sizing: border-box;
}

.abyss-card-wrap {
  pointer-events: auto;
  width: 100%;
  max-width: 290px;
  background: linear-gradient(180deg, rgba(8, 47, 73, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%);
  border: 1.5px solid rgba(6, 182, 212, 0.85);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85), 0 0 22px rgba(6, 182, 212, 0.5);
  border-radius: 16px;
  padding: 8px 10px 7px;
  text-align: center;
  color: #fff;
  box-sizing: border-box;
  animation: abyssMiniPromptIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```
