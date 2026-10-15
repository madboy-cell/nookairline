/**
 * Nook Airline — Sky Monopoly V2: Arcade Flight Route Board Game
 * Tall 7x5 board (20 tiles) built for portrait phones.
 *
 * Features:
 * - Juicy 3D dice, parabolic avatar hops & Web Audio SFX
 * - Houses (🏠, 🏠🏠) & Grand Hotels (🏨), Zone Monopoly (rent ×2)
 * - Landing on an opponent: 💸 Pay Rent / ⚔️ Hostile Takeover duel / 🎯 Vibe Check card
 * - Vibe Check deck: Who's More Likely To · Read My Mind (100 spicy & intimate cards)
 * - Sabotage items: 🎲 Golden Dice, 💣 C4, 🛡️ Rent Shield, 🧲 Magnet, 🌀 Swap Portal
 * - 🎰 Sky Casino, 🎒 Black Market, 🪂 Airdrop, ⚔️ Takeover Arena, ✈️ Sky Bridge
 * - The game always ends: bankruptcy, 5,500 net worth, or the round cap
 *
 * Sync model: whoever rolled the dice is the "turn resolver". Only the resolver
 * decides random outcomes (casino, crates, offers) and ends the turn, then
 * broadcasts the authoritative state. The other phone animates and renders.
 */

// =========================================================
// 1. WEB AUDIO API SYNTHESIZER (JUICY TACTILE GAME FEEL)
// =========================================================
const AudioFX = {
  ctx: null,
  _suspendTimer: null,
  _scheduleAutoSuspend() {
    if (this._suspendTimer) clearTimeout(this._suspendTimer);
    this._suspendTimer = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }, 3000);
  },
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this._scheduleAutoSuspend();
  },
  tone(freq, { type = 'sine', dur = 0.2, vol = 0.18, delay = 0, slideTo = null } = {}) {
    try {
      this.init();
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      this._scheduleAutoSuspend();
    } catch (e) {}
  },
  suspend() {
    if (this._suspendTimer) {
      clearTimeout(this._suspendTimer);
      this._suspendTimer = null;
    }
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  },
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this._scheduleAutoSuspend();
  },
  seq(notes, { step = 0.08, ...opts } = {}) {
    notes.forEach((f, i) => this.tone(f, { ...opts, delay: step * i }));
  },
  playDiceTick() { this.tone(450 + Math.random() * 450, { type: 'triangle', dur: 0.04, vol: 0.12 }); },
  playDiceImpact() { this.tone(220, { dur: 0.24, vol: 0.35, slideTo: 50 }); },
  playHop(step = 0) {
    const baseFreq = 380;
    const semitone = baseFreq * Math.pow(1.05946, Math.min(12, step || 0));
    this.tone(semitone, { dur: 0.1, vol: 0.22, slideTo: semitone * 1.35 });
  },
  playUltCharge() {
    this.seq([587.33, 739.99, 880, 1174.66], { type: 'sine', dur: 0.12, vol: 0.15, step: 0.035 });
  },
  playUltReady() {
    this.tone(90, { type: 'sine', dur: 0.7, vol: 0.35, slideTo: 35 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], { type: 'triangle', dur: 0.35, vol: 0.25, step: 0.05 });
  },
  playSupernovaTithe() {
    this.tone(110, { type: 'sine', dur: 1.1, vol: 0.45, slideTo: 30 });
    this.tone(70, { type: 'sawtooth', dur: 0.8, vol: 0.35, slideTo: 20 });
    this.seq([659.25, 880, 1046.5, 1318.5, 1760, 2093, 2637], { type: 'sine', dur: 0.35, vol: 0.22, step: 0.045 });
  },
  playVoidLightning() {
    this.tone(130, { type: 'sawtooth', dur: 0.55, vol: 0.42, slideTo: 35 });
    this.tone(920, { type: 'square', dur: 0.16, vol: 0.28, slideTo: 180 });
    this.tone(1840, { type: 'sawtooth', dur: 0.14, vol: 0.25, slideTo: 400 });
    setTimeout(() => {
      this.tone(55, { type: 'sawtooth', dur: 0.75, vol: 0.5, slideTo: 25 });
      this.tone(1320, { type: 'square', dur: 0.2, vol: 0.22, slideTo: 280 });
      this.seq([1318.5, 1760, 2093, 2793.8], { type: 'sine', dur: 0.35, vol: 0.25, step: 0.04 });
    }, 120);
  },
  playNagaSurge() {
    this.tone(130, { type: 'sine', dur: 0.85, vol: 0.38, slideTo: 45 });
    this.seq([440, 554.37, 659.25, 880, 1108.73, 1318.5], { type: 'triangle', dur: 0.35, vol: 0.22, step: 0.06 });
  },
  playEclipseConvergence() {
    this.tone(160, { type: 'sawtooth', dur: 0.7, vol: 0.32, slideTo: 50 });
    this.seq([440, 659.25, 880, 1318.5], { type: 'sine', dur: 0.35, vol: 0.2, step: 0.07 });
  },
  playDjinnWish() {
    this.seq([784, 987.77, 1174.66, 1567.98, 1975.53], { type: 'triangle', dur: 0.28, vol: 0.22, step: 0.05 });
  },
  playPhoenixRebirth() {
    this.tone(120, { type: 'sawtooth', dur: 0.9, vol: 0.4, slideTo: 35 });
    this.seq([587.33, 739.99, 880, 1174.66, 1479.98, 1760], { type: 'triangle', dur: 0.35, vol: 0.25, step: 0.05 });
  },
  playAfterburner() {
    this.tone(180, { type: 'sawtooth', dur: 0.75, vol: 0.38, slideTo: 40 });
    this.tone(360, { type: 'square', dur: 0.4, vol: 0.18, slideTo: 90 });
  },
  playPassStart() { this.seq([523.25, 659.25, 783.99, 1046.5], { dur: 0.22, step: 0.07 }); },
  playBuildHouse() { this.seq([659.25, 880], { type: 'triangle', dur: 0.28, vol: 0.22 }); },
  playBuildHotel() { this.seq([587.33, 739.99, 880, 1174.66], { type: 'triangle', dur: 0.35, vol: 0.25, step: 0.09 }); },
  playMatch() { [523.25, 659.25, 783.99, 1046.5].forEach((f) => this.tone(f, { dur: 0.7, vol: 0.15 })); },
  playMiss() { this.tone(330, { type: 'sawtooth', dur: 0.35, vol: 0.12, slideTo: 140 }); },
  playCoin() { this.seq([988, 1319], { type: 'square', dur: 0.12, vol: 0.08, step: 0.06 }); },
  playBoom() {
    this.tone(160, { type: 'sawtooth', dur: 0.6, vol: 0.3, slideTo: 30 });
    this.tone(90, { dur: 0.8, vol: 0.35, slideTo: 20 });
  },
  playSlotTick() { this.tone(700 + Math.random() * 300, { type: 'square', dur: 0.03, vol: 0.05 }); },
  playJackpot() { this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568], { type: 'triangle', dur: 0.3, vol: 0.2, step: 0.08 }); },
  playItem() { this.seq([784, 1175, 1568], { dur: 0.18, vol: 0.16, step: 0.05 }); },
  playWhoosh() { this.tone(900, { dur: 0.35, vol: 0.12, slideTo: 120 }); },
  playAlarm() { this.seq([880, 660, 880, 660], { type: 'square', dur: 0.12, vol: 0.08, step: 0.14 }); },
  playVictory() { this.seq([523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5], { type: 'triangle', dur: 0.3, vol: 0.2, step: 0.12 }); },
  playThud() {
    this.tone(120, { dur: 0.25, vol: 0.4, slideTo: 45 });
    this.tone(60, { dur: 0.3, vol: 0.3 });
  },
  playStamp() {
    this.tone(180, { type: 'square', dur: 0.08, vol: 0.25, slideTo: 90 });
    this.tone(900, { dur: 0.05, vol: 0.08, delay: 0.02 });
  },
  playCasinoChipRoll() {
    this.seq([1046.5, 1318.5, 1568, 2093], { type: 'triangle', dur: 0.12, vol: 0.18, step: 0.05 });
    this.tone(340, { dur: 0.22, vol: 0.25, slideTo: 80 });
  },
  playCasinoSlam() {
    this.tone(160, { type: 'sawtooth', dur: 0.35, vol: 0.38, slideTo: 35 });
    this.seq([1318.5, 1568, 2093], { type: 'sine', dur: 0.28, vol: 0.22, step: 0.06 });
  },
  playCasinoRake() {
    this.tone(480, { type: 'sine', dur: 0.22, vol: 0.28, slideTo: 160 });
    this.seq([1046.5, 1318.5, 1568, 2093], { type: 'triangle', dur: 0.18, vol: 0.2, step: 0.045 });
  },
  playCasinoWelcome() {
    this.tone(180, { type: 'sine', dur: 0.45, vol: 0.32, slideTo: 55 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5], { type: 'sine', dur: 0.25, vol: 0.22, step: 0.05 });
  },
  playAbyssalWave() {
    this.tone(130, { type: 'sine', dur: 0.65, vol: 0.36, slideTo: 40 });
    this.seq([440, 554.37, 659.25, 880, 1108.73], { type: 'sine', dur: 0.35, vol: 0.22, step: 0.07 });
  },
  playAbyssalSplash() {
    this.tone(320, { type: 'triangle', dur: 0.28, vol: 0.25, slideTo: 75 });
    this.seq([880, 1175, 1568, 1760], { type: 'sine', dur: 0.22, vol: 0.18, step: 0.04 });
  },
  playFlip() { this.tone(1200, { type: 'triangle', dur: 0.06, vol: 0.1, slideTo: 600 }); },
  playHeartbeat() {
    this.tone(70, { dur: 0.12, vol: 0.4 });
    this.tone(60, { dur: 0.12, vol: 0.3, delay: 0.18 });
  },
  playReelStop() { this.tone(300, { type: 'square', dur: 0.06, vol: 0.15, slideTo: 150 }); },
  playCoinTick() { this.tone(1400 + Math.random() * 400, { type: 'square', dur: 0.04, vol: 0.05 }); },
  playFuseBeep(i = 0) { this.tone(800 + i * 250, { type: 'square', dur: 0.07, vol: 0.12 }); },
  playSwordClash() {
    this.tone(2400, { type: 'sawtooth', dur: 0.15, vol: 0.08, slideTo: 1200 });
    this.tone(3100, { type: 'triangle', dur: 0.2, vol: 0.06 });
  },
  playAstralShimmer() {
    this.tone(110, { type: 'sine', dur: 0.8, vol: 0.28, slideTo: 45 });
    this.seq([659.25, 880, 1174.66, 1318.5, 1760, 2093, 2637], { type: 'sine', dur: 0.32, vol: 0.16, step: 0.055 });
  },
  playAstralImpact() {
    this.tone(140, { type: 'sawtooth', dur: 0.45, vol: 0.36, slideTo: 28 });
    this.seq([1760, 2093, 2637], { type: 'triangle', dur: 0.3, vol: 0.2, step: 0.05 });
  },
  playAstralTick() {
    this.tone(1600 + Math.random() * 800, { type: 'sine', dur: 0.035, vol: 0.08 });
  },
  playAstralSiphon() {
    this.tone(520, { type: 'sine', dur: 0.55, vol: 0.32, slideTo: 95 });
    this.seq([1318.5, 1046.5, 880, 659.25, 523.25], { type: 'triangle', dur: 0.25, vol: 0.18, step: 0.06 });
  },
  playFairytaleHarp() {
    this.tone(196, { type: 'sine', dur: 1.2, vol: 0.35, slideTo: 60 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], { type: 'sine', dur: 0.45, vol: 0.22, step: 0.055 });
  },
  playFryingPanClang() {
    this.tone(1480, { type: 'sawtooth', dur: 0.25, vol: 0.42, slideTo: 320 });
    this.tone(2200, { type: 'square', dur: 0.12, vol: 0.28, slideTo: 440 });
    this.tone(180, { type: 'triangle', dur: 0.5, vol: 0.35, slideTo: 60 });
  },
  playMidnightChimes() {
    this.tone(130, { type: 'triangle', dur: 1.4, vol: 0.45, slideTo: 40 });
    this.seq([440, 554.37, 659.25, 440, 659.25, 880], { type: 'sine', dur: 0.5, vol: 0.26, step: 0.12 });
  },
  playEnchantedRoseWaltz() {
    this.tone(174.61, { type: 'sine', dur: 1.1, vol: 0.22, slideTo: 55 });
    this.seq([698.46, 880, 1046.5, 1396.9, 1760], { type: 'triangle', dur: 0.4, vol: 0.16, step: 0.08 });
  },
  playBeastRoar() {
    // Smooth, warm cinematic feline pounce & claw whoosh (zero harsh buzzing, clipping, or digital crackle)
    this.tone(85, { type: 'triangle', dur: 0.45, vol: 0.18, slideTo: 50 });
    this.tone(130, { type: 'sine', dur: 0.35, vol: 0.14, slideTo: 75 });
    this.seq([988, 784, 523.25], { type: 'triangle', dur: 0.16, vol: 0.12, step: 0.035 });
    this.tone(1046.5, { type: 'sine', dur: 0.28, vol: 0.08, delay: 0.08 });
  },
  playCurseBreakChime() {
    // Radiant royal French cathedral bells & crystal rose bloom (no harsh bomb explosion)
    this.tone(130.81, { type: 'triangle', dur: 1.0, vol: 0.20, slideTo: 65.41 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], { type: 'sine', dur: 0.40, vol: 0.15, step: 0.045 });
    this.tone(2093, { type: 'sine', dur: 0.65, vol: 0.10, delay: 0.22 });
  },
  playLivingStaffParry() {
    // Warm candelabra bell flare & golden shield resonance
    this.tone(320, { type: 'triangle', dur: 0.5, vol: 0.22, slideTo: 140 });
    this.seq([440, 659.25, 880, 1318.5], { type: 'sine', dur: 0.3, vol: 0.18, step: 0.05 });
    this.tone(1318.5, { type: 'triangle', dur: 0.2, vol: 0.10, delay: 0.08 });
  },
  playCryoNova() {
    this.tone(95, { type: 'sawtooth', dur: 1.1, vol: 0.45, slideTo: 32 });
    this.tone(280, { type: 'sine', dur: 0.8, vol: 0.35, slideTo: 60 });
    this.seq([1046.5, 1318.5, 1568, 2093, 2637, 3136], { type: 'sine', dur: 0.45, vol: 0.26, step: 0.045 });
    setTimeout(() => {
      this.tone(1760, { type: 'sawtooth', dur: 0.22, vol: 0.25, slideTo: 440 });
      this.tone(2793.8, { type: 'square', dur: 0.12, vol: 0.18, slideTo: 880 });
    }, 180);
  },
  playFrostShield() {
    this.tone(120, { type: 'sine', dur: 0.9, vol: 0.4, slideTo: 45 });
    this.seq([1318.5, 1568, 2093, 2637], { type: 'triangle', dur: 0.35, vol: 0.25, step: 0.06 });
  },
  playGlacialImpact() {
    this.tone(80, { type: 'sawtooth', dur: 0.85, vol: 0.5, slideTo: 25 });
    this.tone(160, { type: 'triangle', dur: 0.5, vol: 0.38, slideTo: 40 });
    this.seq([1760, 2093, 2793.8], { type: 'sine', dur: 0.25, vol: 0.2, step: 0.05 });
  },
  playCryoTick() {
    this.tone(2093 + Math.random() * 600, { type: 'triangle', dur: 0.035, vol: 0.09, slideTo: 1400 });
  },
  playFrostShimmer() {
    this.tone(130, { type: 'sine', dur: 0.8, vol: 0.28, slideTo: 40 });
    this.seq([880, 1174.66, 1318.5, 1760, 2093, 2637], { type: 'sine', dur: 0.35, vol: 0.18, step: 0.055 });
  },
  playSolarShimmer() {
    this.tone(146.83, { type: 'sine', dur: 1.0, vol: 0.35, slideTo: 65 });
    this.seq([587.33, 739.99, 880, 1174.66, 1479.98, 1760], { type: 'triangle', dur: 0.45, vol: 0.22, step: 0.06 });
  },
  playSolarImpact() {
    this.tone(70, { type: 'sawtooth', dur: 0.9, vol: 0.55, slideTo: 22 });
    this.tone(140, { type: 'triangle', dur: 0.6, vol: 0.42, slideTo: 35 });
    this.seq([1174.66, 1479.98, 2200], { type: 'sine', dur: 0.3, vol: 0.25, step: 0.05 });
  },
  playSistrumTick() {
    this.tone(2489 + Math.random() * 500, { type: 'triangle', dur: 0.04, vol: 0.12, slideTo: 1600 });
  },
  playSolarHarp() {
    this.tone(146.83, { type: 'sine', dur: 1.0, vol: 0.35, slideTo: 65 });
    this.seq([587.33, 739.99, 880, 1174.66, 1479.98, 1760], { type: 'triangle', dur: 0.45, vol: 0.22, step: 0.06 });
  },
  playSolarWrathRay() {
    this.tone(60, { type: 'sawtooth', dur: 1.0, vol: 0.55, slideTo: 20 });
    this.tone(120, { type: 'square', dur: 0.6, vol: 0.35, slideTo: 40 });
    this.seq([880, 1174.66, 1760, 2349.32], { type: 'sawtooth', dur: 0.28, vol: 0.25, step: 0.04 });
  },
  playPhantomOrgan() {
    // Deep cathedral pedal note
    this.tone(65.41, { type: 'sawtooth', dur: 1.6, vol: 0.48, slideTo: 32.7 });
    this.tone(130.81, { type: 'triangle', dur: 1.4, vol: 0.42, slideTo: 65.41 });
    // Baroque minor chord arpeggiation (D minor / G minor waltz)
    this.seq([293.66, 349.23, 440, 587.33, 698.46, 880, 1174.66], { type: 'sawtooth', dur: 0.65, vol: 0.32, step: 0.065 });
  },
  playPhantomTick() {
    this.tone(1480 + Math.random() * 400, { type: 'triangle', dur: 0.045, vol: 0.12, slideTo: 880 });
    this.tone(2200, { type: 'sine', dur: 0.03, vol: 0.08, delay: 0.01 });
  },
  playPhantomImpact() {
    // Grand opera gong & minor dramatic crash
    this.tone(55, { type: 'sawtooth', dur: 1.2, vol: 0.6, slideTo: 22 });
    this.tone(110, { type: 'square', dur: 0.65, vol: 0.38, slideTo: 35 });
    this.seq([1046.5, 880, 698.46, 587.33, 440, 293.66], { type: 'triangle', dur: 0.45, vol: 0.28, step: 0.045 });
  },
  playOlympusThunder() {
    // Deep rolling thunderclap with sub-bass seismic rumble
    this.tone(45, { type: 'sawtooth', dur: 1.8, vol: 0.65, slideTo: 16 });
    this.tone(90, { type: 'square', dur: 1.1, vol: 0.5, slideTo: 25 });
    this.tone(180, { type: 'sawtooth', dur: 0.5, vol: 0.4, slideTo: 40 });
    this.seq([2093, 1760, 1318.5, 1046.5, 783.99, 523.25, 392], { type: 'sawtooth', dur: 0.55, vol: 0.35, step: 0.04 });
  },
  playOlympusTick() {
    // High-voltage crackling electric spark tick
    this.tone(2800 + Math.random() * 900, { type: 'square', dur: 0.035, vol: 0.12, slideTo: 1400 });
    this.tone(4200, { type: 'sawtooth', dur: 0.02, vol: 0.08, delay: 0.01 });
  },
  playZeusBolt() {
    // Blinding lightning snap + instant seismic thunder detonation
    this.tone(42, { type: 'sawtooth', dur: 1.0, vol: 0.65, slideTo: 15 });
    this.tone(120, { type: 'square', dur: 0.45, vol: 0.45, slideTo: 28 });
    this.seq([3136, 2637, 2093, 1760, 1318.5], { type: 'square', dur: 0.28, vol: 0.38, step: 0.03 });
  },
  playAbyssalBubble() {
    this.tone(1200 + Math.random() * 600, { type: 'sine', dur: 0.04, vol: 0.08, slideTo: 400 });
  },
  playNagaGong() {
    this.tone(110, { type: 'sine', dur: 0.9, vol: 0.4, slideTo: 45 });
    this.seq([440, 523.25, 659.25, 880], { type: 'triangle', dur: 0.35, vol: 0.22, step: 0.08 });
  },
  playNagaTick() {
    this.tone(1480 + Math.random() * 320, { type: 'sine', dur: 0.035, vol: 0.09, slideTo: 800 });
  },
  playNagaImpact() {
    this.tone(75, { type: 'sine', dur: 0.55, vol: 0.42, slideTo: 30 });
    this.seq([330, 440, 523.25, 659.25, 880], { type: 'triangle', dur: 0.3, vol: 0.22, step: 0.045 });
    this.tone(1320, { type: 'sine', dur: 0.2, vol: 0.15, delay: 0.08 });
  },
  playNagaHoardCollect() {
    this.tone(220, { type: 'sine', dur: 0.6, vol: 0.35, slideTo: 80 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], { type: 'triangle', dur: 0.22, vol: 0.24, step: 0.045 });
  },
  playNagaWave() {
    this.tone(130, { type: 'sine', dur: 0.8, vol: 0.35, slideTo: 65 });
    this.seq([261.63, 329.63, 392, 523.25], { type: 'triangle', dur: 0.4, vol: 0.25, step: 0.08 });
  },
  playInariFoxfire() {
    this.tone(880, { type: 'sine', dur: 0.45, vol: 0.22, slideTo: 440 });
    this.seq([587.33, 659.25, 783.99, 880, 1174.66], { type: 'triangle', dur: 0.25, vol: 0.18, step: 0.06 });
  },
  playInariTick() {
    this.tone(1850 + Math.random() * 500, { type: 'triangle', dur: 0.03, vol: 0.08 });
  },
  playInariImpact() {
    this.tone(1600, { type: 'sawtooth', dur: 0.18, vol: 0.18, slideTo: 350 });
    this.tone(90, { type: 'triangle', dur: 0.4, vol: 0.32, slideTo: 40 });
    this.seq([880, 1174.66, 1567.98], { type: 'sine', dur: 0.25, vol: 0.18, step: 0.05 });
  },
  playInariLeap() {
    this.tone(1200, { type: 'triangle', dur: 0.18, vol: 0.2, slideTo: 300 });
    this.seq([880, 1318.5, 1760], { type: 'sine', dur: 0.15, vol: 0.16, step: 0.04 });
  },
  playEclipseStance(isSun) {
    if (isSun) {
      this.tone(260, { type: 'sine', dur: 0.5, vol: 0.28, slideTo: 520 });
      this.seq([659.25, 880, 1318.5], { type: 'triangle', dur: 0.22, vol: 0.2, step: 0.06 });
    } else {
      this.tone(520, { type: 'sine', dur: 0.5, vol: 0.28, slideTo: 260 });
      this.seq([1174.66, 880, 587.33], { type: 'sine', dur: 0.25, vol: 0.18, step: 0.07 });
    }
  },
  playEclipseTick() {
    this.tone(1046.5, { type: 'sine', dur: 0.03, vol: 0.06 });
    this.tone(1567.98, { type: 'sine', dur: 0.03, vol: 0.05, delay: 0.01 });
  },
  playEclipseImpact(isSun) {
    this.tone(90, { type: 'triangle', dur: 0.45, vol: 0.35, slideTo: 35 });
    if (isSun) {
      this.seq([659.25, 880, 1046.5, 1318.5, 1760], { type: 'triangle', dur: 0.3, vol: 0.22, step: 0.045 });
    } else {
      this.seq([1760, 1318.5, 1046.5, 880, 587.33], { type: 'sine', dur: 0.3, vol: 0.22, step: 0.045 });
    }
  },
  playDjinnCarpet() {
    this.tone(300, { type: 'sawtooth', dur: 0.4, vol: 0.2, slideTo: 600 });
    this.seq([466.16, 554.37, 698.46, 932.33], { type: 'triangle', dur: 0.25, vol: 0.18, step: 0.065 });
  },
  playDjinnTick() {
    this.tone(2093 + Math.random() * 400, { type: 'square', dur: 0.025, vol: 0.05 });
  },
  playDjinnImpact() {
    this.tone(110, { type: 'sawtooth', dur: 0.45, vol: 0.35, slideTo: 40 });
    this.seq([698.46, 880, 1046.5, 1396.9], { type: 'triangle', dur: 0.28, vol: 0.22, step: 0.05 });
    this.tone(1864.66, { type: 'sine', dur: 0.25, vol: 0.16, delay: 0.1 });
  },
  playMirageSiphon() {
    this.tone(600, { type: 'sine', dur: 0.35, vol: 0.25, slideTo: 180 });
    this.seq([1046.5, 1318.5, 1568, 2093], { type: 'square', dur: 0.08, vol: 0.08, step: 0.04 });
  },
  playPhoenixFlames() {
    this.tone(180, { type: 'sawtooth', dur: 0.55, vol: 0.3, slideTo: 520 });
    this.seq([440, 659.25, 880, 1046.5], { type: 'triangle', dur: 0.28, vol: 0.2, step: 0.05 });
  },
  playPhoenixTick() {
    this.tone(1350 + Math.random() * 650, { type: 'sawtooth', dur: 0.025, vol: 0.06 });
  },
  playPhoenixImpact() {
    this.tone(85, { type: 'sawtooth', dur: 0.5, vol: 0.4, slideTo: 22 });
    this.seq([523.25, 783.99, 1046.5, 1567.98], { type: 'triangle', dur: 0.32, vol: 0.25, step: 0.05 });
  },
  playPhoenixRebirth() {
    this.tone(55, { type: 'sawtooth', dur: 0.8, vol: 0.42, slideTo: 220 });
    this.seq([523.25, 659.25, 783.99, 1046.5, 1318.5], { type: 'triangle', dur: 0.35, vol: 0.28, step: 0.08 });
  },
  playCocktailShaker() {
    this.seq([587.33, 659.25, 523.25, 698.46, 783.99], { type: 'triangle', dur: 0.1, vol: 0.18, step: 0.045 });
    this.tone(180, { type: 'sine', dur: 0.25, vol: 0.2, slideTo: 90 });
  },
  playCheersClink() {
    this.tone(2093, { type: 'sine', dur: 0.6, vol: 0.35, slideTo: 2200 });
    this.tone(2637, { type: 'sine', dur: 0.45, vol: 0.25, delay: 0.05 });
    this.seq([1046.5, 1318.5, 1568, 2093], { type: 'triangle', dur: 0.3, vol: 0.2, step: 0.04 });
  },
  playGlassShatter() {
    this.tone(120, { type: 'sawtooth', dur: 0.35, vol: 0.38, slideTo: 40 });
    this.seq([1800, 1400, 900, 400], { type: 'square', dur: 0.08, vol: 0.15, step: 0.03 });
  },
  playBananaSlip() {
    this.tone(880, { type: 'sine', dur: 0.35, vol: 0.3, slideTo: 220 });
    this.tone(150, { type: 'triangle', dur: 0.2, vol: 0.35, delay: 0.28 });
  }
};

const SOUND_MAP = {
  buildHouse: 'playBuildHouse',
  buildHotel: 'playBuildHotel',
  match: 'playMatch',
  miss: 'playMiss',
  coin: 'playCoin',
  jackpot: 'playJackpot',
  item: 'playItem',
  whoosh: 'playWhoosh',
  alarm: 'playAlarm',
  dice: 'playDiceImpact',
  passStart: 'playPassStart',
  thud: 'playThud',
  stamp: 'playStamp',
  flip: 'playFlip',
  heartbeat: 'playHeartbeat',
  reelStop: 'playReelStop',
  swordClash: 'playSwordClash',
  astralSiphon: 'playAstralSiphon',
  astralImpact: 'playAstralImpact',
  nagaImpact: 'playNagaImpact',
  inariImpact: 'playInariImpact',
  eclipseImpact: 'playEclipseImpact',
  djinnImpact: 'playDjinnImpact',
  phoenixImpact: 'playPhoenixImpact'
};

// =========================================================
// 2. GAME CONFIG (economy tuned with a Monte Carlo sim:
//    ~40% of games end early by bankruptcy/target, the rest at the cap)
// =========================================================
const MONO_CFG = {
  VERSION: 2,
  START_MILES: 1200,
  LAP_BONUS: 200,
  RENT_MULT: { 1: 1, 2: 4, 3: 12 }, // 🏠 / 🏠🏠 / 🏨
  ZONE_MULT: 2,                     // own a full zone → rent ×2
  // 🔥 Final Boarding ramps up in two steps late in the game (escalating rent to 1.5x at R14 and 2.0x at R18).
  FINAL_BOARDING_STAGES: [
    { round: 14, mult: 1.5 },
    { round: 18, mult: 2 }
  ],
  WIN_NET_WORTH: 5500,
  MAX_ROUNDS: 24,
  VIBE_PASSES: 3,
  VIBE_MISS_MULT: 2,
  TAKEOVER_LOSE_MULT: 1.5,
  UPGRADE_RATE: 0.65,
  LIQUIDATION_RATE: 0.5,            // auto-sell to bank at 50% when you can't pay
  CASINO_BET: 100,
  MAX_ITEMS: 2,
  AIRDROP_FULL_CASH: 150,
  MAGNET_RATE: 0.25
};

const ZONES = {
  bkk: { label: 'Bangkok' },
  dxb: { label: 'Dubai' },
  tyo: { label: 'Tokyo' },
  eu: { label: 'Europe' },
  got: { label: 'Westeros' }
};

// =========================================================
// 3. BOARD TILES (20 TILES, CLOCKWISE FROM TOP-LEFT START)
// =========================================================
const MONOPOLY_TILES = [
  { id: 0, name: 'Departure Gate', shortName: 'START', icon: '🛫', zone: 'corner', type: 'start', price: 0, rent: 0, desc: 'Pass or land to collect +200 miles.' },
  { id: 1, name: 'Yaowarat Street', shortName: 'Yaowarat', icon: '👜', zone: 'bkk', type: 'property', price: 100, rent: 30, desc: 'Sizzling night market, Michelin seafood & gold shops.' },
  { id: 2, name: 'Siam Paragon', shortName: 'Paragon', icon: '🛍️', zone: 'bkk', type: 'property', price: 140, rent: 45, desc: 'Luxury flagship boutiques & sweet dessert cafes.' },
  { id: 3, name: 'Chatuchak Market', shortName: 'Chatuchak', icon: '🎪', zone: 'bkk', type: 'property', price: 160, rent: 55, desc: 'Vintage treasures, coconut ice cream & artisan art.' },
  { id: 4, name: 'Sky Casino', shortName: 'CASINO', icon: '🎰', zone: 'corner', type: 'casino', price: 0, rent: 0, desc: 'Spin the slots for 100 miles. Jackpot pays 1,000!' },
  { id: 5, name: 'Dubai Gold Souk', shortName: 'Gold Souk', icon: '🧈', zone: 'dxb', type: 'property', price: 180, rent: 60, desc: 'Pistachio knafeh chocolates & gleaming gold filigree.' },
  { id: 6, name: 'Palm Jumeirah', shortName: 'Palm', icon: '🌴', zone: 'dxb', type: 'property', price: 220, rent: 75, desc: 'Arabian sunset villas & private yachts.' },
  { id: 7, name: 'Airdrop Crate', shortName: 'AIRDROP', icon: '🪂', zone: 'special', type: 'airdrop', price: 0, rent: 0, desc: 'A cargo plane drops you a free sabotage item!' },
  { id: 8, name: 'Burj Khalifa', shortName: 'Burj', icon: '🏙️', zone: 'dxb', type: 'property', price: 260, rent: 90, desc: 'The world’s highest lounge with fountain views.' },
  { id: 9, name: 'Sky Bridge', shortName: 'BRIDGE', icon: '✈️', zone: 'special', type: 'bridge', price: 0, rent: 0, desc: 'First-class teleport straight to your opponent.' },
  { id: 10, name: 'Mystery Cargo', shortName: 'MYSTERY', icon: '🎁', zone: 'corner', type: 'market', price: 0, rent: 0, desc: 'Instant party drop: win prank items, sabotage gear, or tax-free cash!' },
  { id: 11, name: 'Shibuya Crossing', shortName: 'Shibuya', icon: '🏬', zone: 'tyo', type: 'property', price: 280, rent: 95, desc: 'Neon lights, ramen bars & purikura photobooths.' },
  { id: 12, name: 'Akihabara', shortName: 'Akiba', icon: '🎮', zone: 'tyo', type: 'property', price: 300, rent: 100, desc: 'Arcades, anime towers & maid cafés.' },
  { id: 13, name: 'Shinjuku Golden Gai', shortName: 'Shinjuku', icon: '🏮', zone: 'tyo', type: 'property', price: 320, rent: 110, desc: 'Tiny lantern-lit bars hidden in neon alleys.' },
  { id: 14, name: 'Takeover Arena', shortName: 'ARENA', icon: '⚔️', zone: 'corner', type: 'arena', price: 0, rent: 0, desc: 'Free duel: win to seize a property or raid a 5-star hotel for +150 cash!' },
  { id: 15, name: 'Paris Eiffel Tower', shortName: 'Paris', icon: '🗼', zone: 'eu', type: 'property', price: 340, rent: 115, desc: 'Croissants, champagne & starry Seine walks.' },
  { id: 16, name: 'Santorini Caldera', shortName: 'Santorini', icon: '🏛️', zone: 'eu', type: 'property', price: 360, rent: 125, desc: 'White cliff villas over the azure Aegean.' },
  { id: 17, name: 'Winterfell Heart Tree', shortName: 'Winterfell', icon: '🐺', zone: 'got', type: 'property', price: 380, rent: 135, desc: 'Ancient weirwood in the snow where wolves rule.' },
  { id: 18, name: 'The Red Keep', shortName: 'Red Keep', icon: '👑', zone: 'got', type: 'property', price: 420, rent: 150, desc: 'The Iron Throne overlooking Blackwater Bay.' },
  { id: 19, name: 'Dragonstone Citadel', shortName: 'Dragonstone', icon: '🐉', zone: 'got', type: 'property', price: 450, rent: 165, desc: 'Volcanic cliffs where dragons dance.' }
];

// 7 rows x 5 cols perimeter
const TILE_GRID_POSITIONS = {
  0: { row: 1, col: 1 }, 1: { row: 1, col: 2 }, 2: { row: 1, col: 3 }, 3: { row: 1, col: 4 }, 4: { row: 1, col: 5 },
  5: { row: 2, col: 5 }, 6: { row: 3, col: 5 }, 7: { row: 4, col: 5 }, 8: { row: 5, col: 5 }, 9: { row: 6, col: 5 },
  10: { row: 7, col: 5 }, 11: { row: 7, col: 4 }, 12: { row: 7, col: 3 }, 13: { row: 7, col: 2 }, 14: { row: 7, col: 1 },
  15: { row: 6, col: 1 }, 16: { row: 5, col: 1 }, 17: { row: 4, col: 1 }, 18: { row: 3, col: 1 }, 19: { row: 2, col: 1 }
};

// =========================================================
// 4. SABOTAGE ITEMS & CASINO
// =========================================================
const ITEMS = {
  golden_dice: { icon: '🎲', name: 'Golden Dice', price: 250, desc: 'Choose your exact roll (1–6) this turn.' },
  c4: { icon: '💣', name: 'C4', price: 500, desc: 'Blast an opponent building (🏠🏠 or 🏨) back to a single house. The only thing that can hit hotels.' },
  shield: { icon: '🛡️', name: 'Rent Shield', price: 300, desc: 'When rent is due, use it to pay nothing. Works on hotels too.' },
  magnet: { icon: '🧲', name: 'Magnet', price: 200, desc: 'Instantly siphon 25% of your opponent\'s current miles into your wallet.' },
  swap: { icon: '🌀', name: 'Swap Portal', price: 150, desc: 'Instantly swap board positions with your opponent.' },
  banana: { icon: '🍌', name: 'Banana Peel', price: 150, desc: 'Drop on a tile. Next player to step on it slips +2 tiles forward!' }
};
const ITEM_IDS = Object.keys(ITEMS);

const CASINO_TABLE = [
  { id: 'jackpot', p: 0.05, reels: ['💎', '💎', '💎'], label: 'JACKPOT! +1,000 🪙', miles: 1000 },
  { id: 'cherries', p: 0.15, reels: ['🍒', '🍒', '🍒'], label: 'Triple cherries! +300 🪙', miles: 300 },
  { id: 'item', p: 0.15, reels: ['🎒', '🎒', '🎒'], label: 'Free sabotage item! 🎒', item: true },
  { id: 'pair', p: 0.25, label: 'Two of a kind — bet back (+100 🪙)', miles: 100 },
  { id: 'skull', p: 0.10, reels: ['💀', '💀', '💀'], label: 'CURSED! Lose 200 🪙 more', miles: -200 },
  { id: 'nothing', p: 0.30, label: 'No luck this time…', miles: 0 }
];
const SLOT_SYMBOLS = ['🍒', '🍋', '⭐', '🔔', '💎', '🎒', '💀'];

// =========================================================
// 5. VIBE CHECK DECK (PLAYFUL GETTING-TO-KNOW-YOU CARDS)
// =========================================================
const CARD_DECK = [
  // =========================================================
  // 🎯 WHO'S MORE LIKELY TO (30 CARDS: Teasing, Chemistry & Boldness)
  // =========================================================
  { id: 1, type: 'wmlt', q: 'initiate a kiss in a quiet elevator when the doors close?' },
  { id: 2, type: 'wmlt', q: 'pull the other into the shower the second we enter the hotel room?' },
  { id: 3, type: 'wmlt', q: 'whisper something dangerously dirty in public with a straight face?' },
  { id: 4, type: 'wmlt', q: 'secretly be the more dominant one once the bedroom door is locked?' },
  { id: 5, type: 'wmlt', q: 'wake the other person up at 2 AM craving physical closeness?' },
  { id: 6, type: 'wmlt', q: 'send a risky, breathless voice note right before the other has a meeting?' },
  { id: 7, type: 'wmlt', q: 'get turned on purely from prolonged, silent eye contact across dinner?' },
  { id: 8, type: 'wmlt', q: 'steal the other\'s oversized shirt and wear nothing else around the room?' },
  { id: 9, type: 'wmlt', q: 'bite the other\'s lip when kissing gets too intense?' },
  { id: 10, type: 'wmlt', q: 'crave a full hour of slow, sensory neck and back massage with warm oil?' },
  { id: 11, type: 'wmlt', q: 'suggest a weekend getaway to a private pool villa with zero clothes allowed?' },
  { id: 12, type: 'wmlt', q: 'leave visible marks on the other\'s neck and secretly smile about it?' },
  { id: 13, type: 'wmlt', q: 'be the one to pin the other against the door before unpacking any luggage?' },
  { id: 14, type: 'wmlt', q: 'get completely weak in the knees from low, husky whispers in their ear?' },
  { id: 15, type: 'wmlt', q: 'get caught daydreaming about our last night together while sitting at work?' },
  { id: 16, type: 'wmlt', q: 'suggest staying in bed ordering room service for 24 hours straight?' },
  { id: 17, type: 'wmlt', q: 'get playfully possessive when someone else looks for a second too long?' },
  { id: 18, type: 'wmlt', q: 'initiate intimacy on a high-floor balcony overlooking Bangkok at midnight?' },
  { id: 19, type: 'wmlt', q: 'be a confident boss in public, but a soft, clingy baby in private?' },
  { id: 20, type: 'wmlt', q: 'tease the other person all day over text, then act completely innocent on the call?' },
  { id: 21, type: 'wmlt', q: 'look across a crowded room and mouth "wait until tonight"?' },
  { id: 22, type: 'wmlt', q: 'fall asleep with their face buried in the other person\'s chest?' },
  { id: 23, type: 'wmlt', q: 'pull the other back into bed by their waist when they try to get up?' },
  { id: 24, type: 'wmlt', q: 'be more vocal and expressive about what feels good in the moment?' },
  { id: 25, type: 'wmlt', q: 'give the first lingering kiss the second she clears Suvarnabhumi customs?' },
  { id: 26, type: 'wmlt', q: 'suggest testing out a sensual blindfold or silk ribbon game?' },
  { id: 27, type: 'wmlt', q: 'lose all composure and get goosebumps when their neck is kissed?' },
  { id: 28, type: 'wmlt', q: 'slip a secret love note into the other\'s luggage for the flight back?' },
  { id: 29, type: 'wmlt', q: 'secretly count down the exact days and hours until the next Bangkok landing?' },
  { id: 30, type: 'wmlt', q: 'look at the other person right now on this call and want to kiss them immediately?' },

  // =========================================================
  // 🔮 READ MY MIND (70 CARDS: Intimacy, Fantasies, Desires & Quirks)
  // =========================================================
  { id: 101, type: 'mind', q: 'My preferred physical touch when we are alone in the room:', a: 'Slow, light fingernails tracing my back and ribs 🪶', b: 'A firm, possessive hand gripping my waist/hip tight 🔥' },
  { id: 102, type: 'mind', q: 'What breaks my composure faster during intimacy?', a: 'Hearing low, breathless dirty-talk whispers in my ear 🎙️', b: 'Intense, unbroken eye contact with a slow smirk 👀' },
  { id: 103, type: 'mind', q: 'When we meet at Bangkok airport, our first physical touch should be:', a: 'A tight embrace where you lift me off the ground 🫂', b: 'A deep, lingering kiss right there in public 💋' },
  { id: 104, type: 'mind', q: 'My secret bedroom dynamic preference:', a: 'Being taken complete control of and pinned down helplessly ⛓️', b: 'Straddling on top, teasing, and setting the pace myself 👑' },
  { id: 105, type: 'mind', q: 'Our first morning waking up together in Bangkok:', a: 'Slow hands sliding under sheets at 7 AM, half-asleep skin-to-skin 🌅', b: 'Sleeping late in bathrobes, feeding each other breakfast in bed 🥐' },
  { id: 106, type: 'mind', q: 'What kind of kissing makes my heart beat faster?', a: 'Soft, agonizingly slow lips that barely graze mine without touching 🪶', b: 'Deep, breathless passion with hands tangled in my hair 🔥' },
  { id: 107, type: 'mind', q: 'Sensory surrender game I am secretly more curious about:', a: 'Blindfold with ice and warm kisses traced across my skin 🧊', b: 'Soft silk ribbons holding my wrists while you tease me 🎀' },
  { id: 108, type: 'mind', q: 'Across the miles (BKK ↔ DXB), what teases my mind more?', a: 'A steamy 60-second voice note describing what you would do to me 🎙️', b: 'A discreet, alluring photo sent in the middle of the day 📸' },
  { id: 109, type: 'mind', q: 'Our ideal private hotel sanctuary weekend:', a: 'High-floor Bangkok penthouse suite, curtains open at midnight 🏙️', b: 'Secluded Samui pool villa with zero neighbors and no clothes 🏝️' },
  { id: 110, type: 'mind', q: 'In the bedroom, my preferred pacing is:', a: 'Hours of teasing, building tension, and slow warm-up ⏳', b: 'Spontaneous, feverish intensity right against the door 🚪' },
  { id: 111, type: 'mind', q: 'What kind of praise turns me on more?', a: 'Hearing how soft, beautiful, and addictive my body feels to you ✨', b: 'Hearing you say I am completely yours and nobody else compares 🖤' },
  { id: 112, type: 'mind', q: 'My biggest physical sensitivity zone:', a: 'My neck, collarbone, and the soft spot behind my ear 💋', b: 'My lower back, hips, and inner thighs 🤲' },
  { id: 113, type: 'mind', q: 'When your hand touches me under the table at dinner:', a: 'A slow hand sliding up my inner thigh stopping just short 🤫', b: 'Interlocking our fingers tightly with thumbs rubbing firmly 🤝' },
  { id: 114, type: 'mind', q: 'The naughtiest spontaneous thrill I would say yes to:', a: 'Sneaking a breathless make-out session in a dark luxury cinema 🎬', b: 'Whispering the dirtiest bedroom thought into your ear at dinner 🍷' },
  { id: 115, type: 'mind', q: 'After we finish making love, my natural craving is:', a: 'Tangled together chest-to-chest, breathing slowing down in silence 🤍', b: 'Laughing together in bed, sharing cold drinks and late-night snacks 🍇' },
  { id: 116, type: 'mind', q: 'When I am comfortable behind closed doors, my real personality is:', a: 'A sassy brat who loves to tease, provoke, and play hard to get 😈', b: 'A soft, cuddly baby who melts the second you hold me 🥺' },
  { id: 117, type: 'mind', q: 'The visual that turns me on most:', a: 'Seeing you dressed up in sharp, sophisticated luxury clothes 👔', b: 'Seeing you in raw comfort, messy hair, wearing just a robe or boxers 🛏️' },
  { id: 118, type: 'mind', q: 'Temperature and touch contrast I crave more:', a: 'Warm scented jasmine massage oil smoothed over my shoulders and hips 🪔', b: 'Cool silk sheets, goosebumps, and heated skin-on-skin friction ❄️' },
  { id: 119, type: 'mind', q: 'My secret turn-on regarding bedroom audio:', a: 'Quiet, breathless whimpers and heavy breathing in the dark 🤫', b: 'Bold, uninhibited dirty talk telling me exactly what feels good 🗣️' },
  { id: 120, type: 'mind', q: 'If we have 30 minutes in a luxury hotel suite before dinner:', a: 'A steamy shower together pressing against the glass 🚿', b: 'A quick, passionate round against the headboard, messing up our hair 💥' },
  { id: 121, type: 'mind', q: 'When I miss you late at night in bed:', a: 'I replay our conversations and voice notes until I drift off 🎧', b: 'I imagine your hands on my body and get restless under the sheets 💭' },
  { id: 122, type: 'mind', q: 'In bed, do I prefer being provoked or comforted?', a: 'Provoked: teasing me until I lose my patience and beg 😈', b: 'Comforted: worshipped with slow, gentle kisses from head to toe 🕊️' },
  { id: 123, type: 'mind', q: 'What turns my brain on faster before physical touch?', a: 'Sharp banter, witty flirting, and electric eye contact 🧠', b: 'Confidence, dominant energy, and taking charge of decisions 👑' },
  { id: 124, type: 'mind', q: 'A surprise sensual gift for our next Bangkok trip:', a: 'Delicate black lace lingerie picked out by you for me to wear 🖤', b: 'A luxury bottle of body oil and a silk blindfold for us to explore 🕯️' },
  { id: 125, type: 'mind', q: 'My favorite spot to receive unexpected kisses in public:', a: 'The side of my neck while you stand behind me in line 💋', b: 'The back of my hand while you look directly into my eyes 🌹' },
  { id: 126, type: 'mind', q: 'When intimacy gets intense, my hands naturally want to:', a: 'Grip your hair tightly and pull your face closer 💆', b: 'Dig my fingernails into your shoulders and back ⚡' },
  { id: 127, type: 'mind', q: 'What kind of power dynamic turns me on more?', a: 'You taking the lead completely, making every move without asking ⛓️', b: 'A playful battle of power where we both fight for control ⚔️' },
  { id: 128, type: 'mind', q: 'The best way to wake me up when sharing a bed:', a: 'Gentle morning kisses along my jawline until my eyes open 🌤️', b: 'Warm hands sliding under my clothes before either of us speaks 🔥' },
  { id: 129, type: 'mind', q: 'Walking together through a Bangkok night market:', a: 'Holding hands with our fingers locked tightly the entire time 🤝', b: 'Your arm wrapped around my waist, pulling me close through the crowd 🫂' },
  { id: 130, type: 'mind', q: 'The most intoxicating scent to me:', a: 'Fresh skin, clean hotel linen, and faint warm vanilla perfume 🧴', b: 'Scented jasmine massage oil mixed with the heat of our bodies 🌸' },
  { id: 131, type: 'mind', q: 'In bed, what makes me feel most desired?', a: 'The way you look at my body like you cannot get enough of it 👀', b: 'The way your breath catches and your hands tremble when touching me 💓' },
  { id: 132, type: 'mind', q: 'A secret fantasy for our Bangkok arrival night:', a: 'Checking in under fake names and roleplaying as strangers meeting 🎭', b: 'Renting a private rooftop pool and swimming naked under the stars 🏊' },
  { id: 133, type: 'mind', q: 'What kind of teasing drives me crazier?', a: 'Physical: Kissing everywhere on my body EXCEPT where I want it most 😫', b: 'Mental: Texting me building up tension all day before we meet 📱' },
  { id: 134, type: 'mind', q: 'My reaction to a little protective jealousy:', a: 'I secretly find a little possessiveness hot and flattering 😏', b: 'I prefer pure, calm trust with zero jealousy 🕊️' },
  { id: 135, type: 'mind', q: 'When we kiss, my favorite rhythm is:', a: 'Slow, lingering, tasting every second with deep pauses 🍯', b: 'Urgent, breathless, passionate, and slightly hungry 🌊' },
  { id: 136, type: 'mind', q: 'What would I rather wear to bed when we are together?', a: 'Silky lingerie that looks gorgeous and begs to be taken off 👙', b: 'Just an oversized t-shirt belonging to you, with bare legs 👕' },
  { id: 137, type: 'mind', q: 'When resolving tension or a small argument during the day:', a: 'Talking it through calmly over wine, then reconnecting intimately 🍷', b: 'Passionate make-up intimacy that clears all the air instantly ⚡' },
  { id: 138, type: 'mind', q: 'What kind of touch makes me completely melt and relax?', a: 'Firm, kneading shoulder and scalp massage with your fingers 💆', b: 'Gentle fingertips tracing lazy circles on my stomach and hips 🌀' },
  { id: 139, type: 'mind', q: 'When looking at each other across the dinner table:', a: 'A slow, devouring gaze that undresses me with your eyes 😈', b: 'A warm, loving smile that makes me feel like the only person in the room ✨' },
  { id: 140, type: 'mind', q: 'The bedroom rule I would be most excited to try:', a: 'The No-Speaking Rule: only communicating through breath and touch 🤫', b: 'The Pleasure-First Rule: one person must wait until the other is satisfied ⏳' },
  { id: 141, type: 'mind', q: 'What kind of voice note from Dubai turns me on more?', a: 'A raspy, quiet whisper recorded in bed right before falling asleep 🌙', b: 'A confident, teasing voice note telling me what you will do to me in Bangkok ✈️' },
  { id: 142, type: 'mind', q: 'My favorite place to be touched while standing up:', a: 'Hands gripping both sides of my waist, pulling me flush against your hips 💥', b: 'A hand gently on the back of my neck, tilting my head back for a kiss 💋' },
  { id: 143, type: 'mind', q: 'Our ideal tropical rainstorm afternoon in Bangkok:', a: 'Heavy rain outside while staying under thick blankets kissing 🌧️', b: 'Watching the storm from a high-rise balcony in bathrobes with wine 🥂' },
  { id: 144, type: 'mind', q: 'How do I like foreplay to begin?', a: 'Hours before, through suggestive glances, whispers, and text banter 💭', b: 'Spontaneous, catching me completely off guard when I least expect it ⚡' },
  { id: 145, type: 'mind', q: 'What turns me on more during foreplay?', a: 'Being kissed slowly down my stomach until my hips arch 🌊', b: 'Gentle, teasing biting on the curve where my neck meets my shoulder 🐾' },
  { id: 146, type: 'mind', q: 'The ultimate private luxury evening fantasy:', a: 'A hot tub on a private terrace surrounded by candles and champagne 🍾', b: 'A full sensory evening with body oil, ambient music, and no rush 🕯️' },
  { id: 147, type: 'mind', q: 'What kind of eye contact during intimacy hits harder?', a: 'Holding eye contact during the most intense climax moment 👁️', b: 'Closing our eyes, losing ourselves purely in the physical sensation 🌌' },
  { id: 148, type: 'mind', q: 'When we are apart across the miles (BKK ↔ DXB), what makes me feel closest?', a: 'Falling asleep on voice call listening to each other breathe 😴', b: 'Sharing spontaneous unedited photos of our day showing our real life 📸' },
  { id: 149, type: 'mind', q: 'In bed, do I like variety or finding that one rhythm?', a: 'Spontaneous variety: trying new angles and rhythms out of nowhere 🔄', b: 'Deep rhythm: finding the exact spot and staying there until we break 🌊' },
  { id: 150, type: 'mind', q: 'My biggest vulnerability when falling for someone:', a: 'Falling deeply and being terrified of the magic fading 🥺', b: 'Opening up my deepest, craziest thoughts and hoping I am accepted 🤍' },
  { id: 151, type: 'mind', q: 'A spontaneous thrill I would secretly love:', a: 'Driving to a scenic viewpoint late at night and making out in the car 🚗', b: 'Kissing passionately in the back of a luxury cab driving through city lights 🚕' },
  { id: 152, type: 'mind', q: 'When my partner undresses me:', a: 'Slowly, piece by piece, kissing each new inch of exposed skin ⏳', b: 'Eagerly, urgently, like you have waited all week to touch me 🔥' },
  { id: 153, type: 'mind', q: 'What turns me on more: words or physical reactions?', a: 'Hearing you whisper how good it feels and how much you crave me 💬', b: 'Feeling your body tremble, your heartbeat race, and your hands grip me 💓' },
  { id: 154, type: 'mind', q: 'The morning after an unforgettable night together:', a: 'Staying in bed laughing about how wild last night was, refusing to get up ☕', b: 'Immediately starting round two while still half-asleep 🛌' },
  { id: 155, type: 'mind', q: 'What makes a partner irresistibly attractive to me?', a: 'Someone who carries themselves with quiet strength and commands respect 👑', b: 'Someone who is playful, witty, and can make me laugh until my stomach hurts 😂' },
  { id: 156, type: 'mind', q: 'My favorite random kiss to receive:', a: 'A gentle forehead kiss that feels protective, warm, and tender 🕊️', b: 'A sudden, deep kiss on the lips that cuts off whatever sentence I was saying 💥' },
  { id: 157, type: 'mind', q: 'In intimacy, do I prefer being the hunter or the prize?', a: 'The prize: make me feel relentlessly pursued and craved 💎', b: 'The hunter: let me tease you and bring you to your knees 🏹' },
  { id: 158, type: 'mind', q: 'What bedroom lighting sets the ultimate mood?', a: 'Almost total darkness with just faint city lights glowing through sheer blinds 🌃', b: 'Warm golden candlelight casting shadows across our skin 🕯️' },
  { id: 159, type: 'mind', q: 'When I touch your chest and stomach, I want you to:', a: 'Let out a low sigh, close your eyes, and lean into my touch 😌', b: 'Grab my wrist, pull me on top of you, and take control 🔥' },
  { id: 160, type: 'mind', q: 'The fantasy outfit I would love in our private room:', a: 'Pure elegance: a silk robe that slips effortlessly to the floor 👘', b: 'Delicate and bold: strappy matching black lace lingerie 🖤' },
  { id: 161, type: 'mind', q: 'What gives me more butterfly chills?', a: 'A slow breath blown across my collarbone before a kiss 🪶', b: 'A firm, possessive hand in my hair tilting my head to the side ⚡' },
  { id: 162, type: 'mind', q: 'Our ideal travel ritual when she arrives in Bangkok:', a: 'Unpacking together, playing music, opening wine, and catching up on everything 🍷', b: 'Dumping the bags on the floor, locking the door, and handling our cravings first 💥' },
  { id: 163, type: 'mind', q: 'What teasing text from Dubai would keep me distracted all day?', a: '"I bought something new for our Bangkok nights... you will have to take it off me." 👙', b: '"I couldn\'t sleep last night because all I could think about was your hands on me." 💭' },
  { id: 164, type: 'mind', q: 'When kissing against a wall, what position is hotter?', a: 'My back against the wall, with your hands on either side trapping me 🧱', b: 'Your back against the wall, with me pulling you in by your collar 👔' },
  { id: 165, type: 'mind', q: 'My secret preference for touch pacing:', a: 'Starting agonizingly slow for 30 minutes, building until we can\'t take it ⏳', b: 'Immediate high heat that explodes into passionate intensity 🔥' },
  { id: 166, type: 'mind', q: 'What kind of reassurance turns me on emotionally?', a: 'Knowing that you only have eyes for me, no matter who is around 👁️', b: 'Knowing that you admire my drive, ambition, and mind as much as my body 🧠' },
  { id: 167, type: 'mind', q: 'If we take a private sunset boat ride on the Chao Phraya river:', a: 'Sitting at the back wrapped in a blanket, whispering and drinking champagne 🥂', b: 'Standing at the bow feeling the wind, taking photos, and stealing kisses ⛵' },
  { id: 168, type: 'mind', q: 'What is my biggest physical turn-on during foreplay?', a: 'Warm lips tracing slowly down my neck, pausing at my pulse point 💋', b: 'Fingertips lightly tracing the inside of my wrists, arms, and ribs 🪶' },
  { id: 169, type: 'mind', q: 'Our last morning in Bangkok before your flight:', a: 'One last slow, emotional, lingering round of lovemaking to remember until next month 🌅', b: 'Holding each other silently in bed, soaking up every minute before the airport 🫂' },
  { id: 170, type: 'mind', q: 'Honestly, what am I thinking about when I look at you right now on this call?', a: 'How lucky I feel to have found such rare, electric chemistry with you ✨', b: 'How much I wish we were in the exact same room right this second 🛏️' }
];
const CARD_BY_ID = Object.fromEntries(CARD_DECK.map((c) => [c.id, c]));

// =========================================================
// 6. SMALL HELPERS
// =========================================================
const $m = (id) => document.getElementById(id);
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;
const otherRole = (r) => (r === 'bkk' ? 'dxb' : 'bkk');
const d6 = () => Math.floor(Math.random() * 6) + 1;
const fmt = (n) => Math.round(n || 0).toLocaleString();

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =========================================================
// 7. GAME STATE
// =========================================================
function makePlayer(id) {
  const base = {
    id,
    pos: 0,
    miles: MONO_CFG.START_MILES,
    clashTokens: 2,
    vibePasses: 2,
    inventory: [],
    foxfireTails: 3,
    ashPot: 0,
    carpetCharges: 0,
    ult: 0
  };
  if (id === 'bkk') return { ...base, name: 'Lord of BKK 🐺', sprite: 'assets/bkk_warrior_idle.png', badge: 'BKK', color: '#3b82f6' };
  if (id === 'dxb') return { ...base, name: 'Khaleesi 🐉', sprite: 'assets/got_queen_idle.png', badge: 'DXB', color: '#ec4899' };
  if (id === 'bot1') return { ...base, name: 'Trainee Mochi 🐣', sprite: 'assets/bot_mochi.jpg', badge: 'BOT1', color: '#10b981', isBot: true, botLevel: 'easy' };
  if (id === 'bot2') return { ...base, name: 'Capt. Whiskers 😈', sprite: 'assets/bot_captain.jpg', badge: 'BOT2', color: '#f59e0b', isBot: true, botLevel: 'hard' };
  return { ...base, name: id, sprite: 'assets/bot_captain.jpg', badge: id.toUpperCase(), color: '#8b5cf6' };
}

/** Costume perk effects locked in for the current game (see costumes.js / vault.js). */
function perkOf(role) {
  const ps = monopolyState && monopolyState.perks;
  if (ps && ps[role] && Object.keys(ps[role]).length > 0) return ps[role];
  const pl = monopolyState?.players && monopolyState.players[role];
  if (pl && pl.isBot && pl.botLevel !== 'insane') return {};
  return (ps && ps[role]) || {};
}

function perkInfo(role) {
  let pk = perkOf(role);
  const C = window.NookCostumes;
  if (!pk || !pk.costume) {
    const pl = monopolyState?.players && monopolyState.players[role];
    if (!pl?.isBot && window.NookVault && typeof window.NookVault.monopolyPerks === 'function') {
      const allPerks = window.NookVault.monopolyPerks();
      if (allPerks && allPerks[role]) pk = allPerks[role];
    }
  }
  if (!pk || !pk.costume || !C || !C.BY_ID[pk.costume]) return null;
  const c = C.BY_ID[pk.costume];
  return { costume: c, perk: C.PERKS[c.perk], resonance: !!pk.resonance };
}

/** Resolves currently equipped costume ID for a player role, checking live avatar, vault, and monopoly state. */
function activeCostumeId(role) {
  if (!role) return '';
  const myRole = getMonopolyMyRole();
  const pl = monopolyState?.players && monopolyState.players[role];

  // 1. If player is a bot, only use explicit pl.costume / pl.activeCostume (never inherit human Vault or partner avatar)
  if (pl?.isBot) {
    return pl.costume || pl.activeCostume || '';
  }

  // 2. Check explicit player costume or activeCostume override
  if (pl && (pl.costume || pl.activeCostume)) {
    return pl.costume || pl.activeCostume;
  }

  // 3. Check Vault equipped costume
  if (window.NookVault && typeof window.NookVault.equippedOf === 'function') {
    const eq = window.NookVault.equippedOf(role);
    if (eq) return eq;
  }

  // 4. If this is the local user's role, prioritize their live selected avatar outfit
  if (role === myRole && window.getMyAvatar) {
    const a = window.getMyAvatar();
    if (a && a.characterId) return a.characterId;
  }

  // 5. If partner role and live partner avatar is present with a specific costume
  if (role !== myRole && window.getPartnerAvatar) {
    const pa = window.getPartnerAvatar();
    if (pa && pa.characterId) return pa.characterId;
  }

  const p = perkInfo(role);
  if (p && p.costume && p.costume.id) return p.costume.id;
  if (pl && pl.sprite) return pl.sprite;
  return '';
}
window.activeCostumeId = activeCostumeId;

/** Helper to match season ID boundaries precisely (e.g. 's1' must match 's1_naga_m' or 's1', but NEVER 's10_...' or 's11_...') */
function matchesSeasonId(id, season) {
  if (!id || !season) return false;
  const s = String(id).toLowerCase();
  const tgt = String(season).toLowerCase();
  return s === tgt || s.startsWith(tgt + '_') || s.includes('_' + tgt + '_') || s.endsWith('_' + tgt);
}
window.matchesSeasonId = matchesSeasonId;

/** Returns true if player is wearing any Season 4 Monaco High-Roller Mythic costume or has its mythic perk. */
function isMonacoHighRoller(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s4_royale_m', 's4_royale_f', 's4_roulette_m', 's4_roulette_f'].includes(costumeId)) return true;
  if (costumeId.includes('monaco') || costumeId.includes('royale') || costumeId.includes('roulette') || matchesSeasonId(costumeId, 's4')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's4' && c.rarity === 'mythic') return true;
    if (['casino_royale', 'roulette_grand'].includes(c.pair)) return true;
    if (['vip_express', 'loaded_battle_dice'].includes(c.perk)) return true;
  }
  const pk = perkOf(role);
  if (pk && (pk.firstRollCasino || pk.duelMinRoll || pk.casinoRake)) return true;
  return false;
}

/** Sequentially lights up the flight route runway beacons toward destination tile. */
function highlightRunwayTiles(startPos, steps) {
  for (let s = 1; s <= steps; s++) {
    const tilePos = (startPos + s) % MONOPOLY_TILES.length;
    const tileEl = $m('boardTile_' + tilePos);
    if (tileEl) {
      setTimeout(() => {
        tileEl.classList.add('monaco-runway-beacon');
        setTimeout(() => tileEl.classList.remove('monaco-runway-beacon'), 650);
      }, s * 65);
    }
  }
}

/** Returns true if player is wearing Season 5 Atlantis Drift Mythic costume or has oceanDrift perk. */
function isAbyssalDrifter(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s5_emperor_m', 's5_siren_f', 's5_leviathan_m', 's5_jellyfish_f'].includes(costumeId)) return true;
  if (costumeId.includes('abyss') || costumeId.includes('atlantis') || costumeId.includes('emperor') || costumeId.includes('siren') || costumeId.includes('leviathan') || costumeId.includes('jellyfish') || matchesSeasonId(costumeId, 's5')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's5' && c.rarity === 'mythic' && (c.perk === 'bioluminescent_drift' || c.perk === 'tidal_surge_ward')) return true;
    if (['celestial_jellyfish', 'atlantis_royalty'].includes(c.pair)) return true;
  }
  const pk = perkOf(role);
  return (Number(pk && pk.oceanDrift) || 0) > 0 || !!(pk && pk.pearlWard);
}

/** Returns true if player is wearing Season 6 Astral Aegis / Celestial Goddess costume or has starTithe perk. */
function isAstralSovereign(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s6_aegis_m', 's6_aegis_f', 's6_supernova_m', 's6_supernova_f', 's6_astral_m', 's6_astral_f'].includes(costumeId)) return true;
  if (costumeId.includes('astral') || costumeId.includes('supernova') || costumeId.includes('aegis') || matchesSeasonId(costumeId, 's6')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's6' && c.rarity === 'mythic') return true;
    if (['aegis', 'supernova'].includes(c.pair)) return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.starTithe || pk.constellationRebirth || pk.supernova6));
}

/** Returns true if player is wearing Season 1 Naga King / Kinnaree costume or has mekongHoard perk. */
function isNagaWarden(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s1_naga_m', 's1_kinnaree_f'].includes(costumeId)) return true;
  if (costumeId.includes('naga') || costumeId.includes('kinnaree')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's1' && c.rarity === 'mythic') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.mekongHoard || pk.demolitionImmune));
}

/** Returns true if player is wearing Season 2 Inari Fox Blade / Shrine Empress costume or has foxfireWard perk. */
function isInariFoxfire(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s2_inari_m', 's2_inari_f'].includes(costumeId)) return true;
  if (costumeId.includes('inari') || costumeId.includes('kitsune') || costumeId.includes('foxfire')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's2' && c.rarity === 'mythic' && c.pair === 'inari') return true;
  }
  const pk = perkOf(role);
  return !!(pk && pk.foxfireWard);
}

/** Returns true if player is wearing Season 2 Tsukuyomi / Amaterasu costume or has eclipseBalance perk. */
function isCelestialEclipse(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s2_celestial_m', 's2_celestial_f'].includes(costumeId)) return true;
  if (costumeId.includes('celestial') || costumeId.includes('eclipse') || costumeId.includes('tsukuyomi') || costumeId.includes('amaterasu')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's2' && c.rarity === 'mythic' && c.pair === 'celestial_jp') return true;
  }
  const pk = perkOf(role);
  return !!(pk && pk.eclipseBalance);
}

/** Returns true if player is wearing Season 3 Solar Sultan / Djinn Queen costume or has carpet/mirage perk. */
function isDjinnMirage(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s3_djinn_m', 's3_djinn_f'].includes(costumeId)) return true;
  if (costumeId.includes('djinn') || costumeId.includes('sultan') || costumeId.includes('genie')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's3' && c.rarity === 'mythic' && c.pair === 'djinn') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.carpetDoublesImmunity || pk.mirageTribute));
}

/** Returns true if player is wearing Season 3 Dune Phoenix / Oasis Seraph costume or has phoenixRebirth perk. */
function isPhoenixAscendant(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s3_phoenix_m', 's3_phoenix_f'].includes(costumeId)) return true;
  if (costumeId.includes('phoenix')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's3' && c.rarity === 'mythic' && c.pair === 'phoenix') return true;
  }
  const pk = perkOf(role);
  return !!(pk && pk.phoenixRebirth);
}

/** Returns true if player is wearing Season 7 Rapunzel / Flynn Rider costume or has sundrop perk. */
function isSundropTower(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s7_sundrop_m', 's7_sundrop_f'].includes(costumeId)) return true;
  if (costumeId.includes('sundrop') || costumeId.includes('rapunzel') || costumeId.includes('flynn') || costumeId.includes('s7_sundrop')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's7' && c.rarity === 'mythic' && c.pair === 'sundrop_tower') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.sundropZipline || pk.fryingPanParry));
}

/** Returns true if player is wearing Season 7 Cinderella / Prince Charming costume or has clockwork sovereign perk. */
function isClockworkSovereign(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s7_cinderella_m', 's7_cinderella_f'].includes(costumeId)) return true;
  if (costumeId.includes('cinderella') || costumeId.includes('clockwork') || costumeId.includes('glass_slipper') || costumeId.includes('s7_cinderella')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's7' && c.rarity === 'mythic' && (c.pair === 'midnight_ball' || c.pair === 'clockwork_royalty')) return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.pumpkinWarp || pk.glassSlipperTrial));
}

/** Returns true if player is wearing Season 7 Belle / Prince Adam costume or has beast fury / intellect perk. */
function isBeastAdam(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = activeCostumeId(role);
  if (['s7_belle_m', 's7_belle_f'].includes(costumeId)) return true;
  if (costumeId.includes('belle') || costumeId.includes('beast') || costumeId.includes('rose') || costumeId.includes('s7_belle')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's7' && c.rarity === 'mythic' && c.pair === 'enchanted_curse') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.formShiftStance || pk.livingStaffShield || pk.beastPounce));
}

/** Returns true if player is wearing Season 8 Elsa / Glacial Empress / Blizzard Warden costume or has glacial perk. */
function isFrostSovereign(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s8_empress_f', 's8_warden_m'].includes(costumeId)) return true;
  if (costumeId.includes('empress') || costumeId.includes('warden') || (costumeId.includes('glacial') && !costumeId.includes('crystal')) || matchesSeasonId(costumeId, 's8')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's8' && c.rarity === 'mythic') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.frostShield || pk.snowdriftTraps || pk.cryoDash));
}

/** Returns true if player is wearing Season 9 Cleopatra / Pharaoh costume or has gilded nile perk. */
function isGildedSovereign(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s9_cleopatra_f', 's9_pharaoh_m'].includes(costumeId)) return true;
  if (costumeId.includes('cleopatra') || costumeId.includes('pharaoh') || costumeId.includes('gilded') || (matchesSeasonId(costumeId, 's9') && !costumeId.includes('ra') && !costumeId.includes('sekhmet'))) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's9' && c.pair === 'gilded_monarchs') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.goldenPyramid || pk.royalExtortion || pk.goldAura));
}

/** Returns true if player is wearing Season 9 Ra / Sekhmet costume or has solar divinity perk. */
function isSolarDivinity(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s9_ra_m', 's9_sekhmet_f'].includes(costumeId)) return true;
  if (costumeId.includes('s9_ra') || costumeId.includes('s9_sekhmet') || (costumeId.includes('ra') && !costumeId.includes('rapunzel') && !costumeId.includes('pharaoh')) || costumeId.includes('sekhmet') || costumeId.includes('solar')) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's9' && c.pair === 'solar_divinity') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.desertMirage || pk.solarWings));
}

/** Returns true if player is wearing Season 10 Phantom / Black Swan costume or has phantom perk. */
function isPhantomRoyalty(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s10_phantom_m', 's10_phantom_f'].includes(costumeId)) return true;
  if (costumeId.includes('s10_phantom') || (costumeId.includes('phantom') && !costumeId.includes('phoenix')) || costumeId.includes('black_swan') || (matchesSeasonId(costumeId, 's10') && costumeId.includes('mythic'))) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's10' && c.pair === 'phantom_royalty') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.reverseRentHex || pk.marionetteStasis || pk.phantomAura));
}

/** Returns true if player is wearing Season 11 Zeus / Athena costume or has olympus divinity perk. */
function isOlympusDivinity(role) {
  if (!role) return false;
  const p = perkInfo(role);
  const costumeId = String(activeCostumeId(role) || '').toLowerCase();
  if (['s11_zeus_m', 's11_athena_f'].includes(costumeId)) return true;
  if (costumeId.includes('s11_zeus') || costumeId.includes('s11_athena') || costumeId.includes('olympus') || (costumeId.includes('zeus') && !costumeId.includes('poseidon')) || (matchesSeasonId(costumeId, 's11') && costumeId.includes('mythic'))) return true;
  if (p && p.costume) {
    const c = p.costume;
    if (c.season === 's11' && c.pair === 'olympus_divinity') return true;
  }
  const pk = perkOf(role);
  return !!(pk && (pk.zeusSmite || pk.pegasusBypass || pk.lightningAura));
}

function calcRent(prop, tile, owner) {
  const tid = tile ? tile.id : (prop ? prop.tileId : 0);
  return getTileRent(tid);
}

function botChooseDrift(playerKey, targetA, targetB) {
  const st = monopolyState;
  const p = st.players[playerKey];
  const tileA = MONOPOLY_TILES[targetA];
  const tileB = MONOPOLY_TILES[targetB];
  const propA = st.properties[targetA];
  const propB = st.properties[targetB];

  let hazardA = 0;
  let hazardB = 0;
  if (propA && propA.owner && propA.owner !== playerKey && !st.players[propA.owner]?.bankrupt) {
    hazardA = getTileRent(targetA);
  }
  if (propB && propB.owner && propB.owner !== playerKey && !st.players[propB.owner]?.bankrupt) {
    hazardB = getTileRent(targetB);
  }

  // Avoid dangerous rival rent
  if (hazardA > 0 && hazardB === 0) return true;
  if (hazardB > 0 && hazardA === 0) return false;
  if (hazardA > hazardB) return true;
  if (hazardB > hazardA) return false;

  // Opportunity: Buy unowned property
  const canBuyA = tileA && tileA.type === 'property' && (!propA || !propA.owner) && p && p.miles >= tileA.price;
  const canBuyB = tileB && tileB.type === 'property' && (!propB || !propB.owner) && p && p.miles >= tileB.price;
  if (canBuyA && !canBuyB) return false;
  if (canBuyB && !canBuyA) return true;

  // Bias toward forward progress / mobility
  return true;
}

let driftChoiceTimer = null;
let pendingRemoteDriftResolver = null;
let remoteDriftPendingMessage = null;

function showAbyssalDriftNavigator(playerKey, rollVal, targetA, targetB, onChoice) {
  const ov = $m('abyssDriftOverlay');
  if (!ov) {
    onChoice(false);
    return;
  }

  if (typeof hideModal === 'function') hideModal();

  const p = monopolyState.players[playerKey];
  const tileA = MONOPOLY_TILES[targetA];
  const tileB = MONOPOLY_TILES[targetB];

  const getTileDetail = (t, targetId) => {
    if (!t) return 'Special';
    if (t.type === 'property') {
      const prop = monopolyState.properties[targetId];
      if (prop && prop.owner) {
        if (prop.owner === playerKey) return 'Safe 🏠';
        const r = getTileRent(targetId);
        return `Rent ${fmt(r)}🪙 ⚠️`;
      }
      return `Buy ${fmt(t.price)}🪙`;
    }
    if (t.type === 'casino') return 'Sky Casino 🎰';
    if (t.type === 'corner') return t.id === 0 ? 'START 🛫' : 'Safe 🛡️';
    if (t.type === 'airdrop') return 'Airdrop 🪂';
    return t.shortName || 'Zone';
  };

  const detailA = getTileDetail(tileA, targetA);
  const detailB = getTileDetail(tileB, targetB);

  // Highlight candidate tiles on the board
  const elA = $m('boardTile_' + targetA);
  const elB = $m('boardTile_' + targetB);
  if (elA) elA.classList.add('abyss-target-a');
  if (elB) elB.classList.add('abyss-target-b');

  ov.innerHTML = `
    <div class="abyss-card-wrap">
      <div class="abyss-mini-header">
        <span>🌊 S5 Mythic Drift</span>
        <span class="abyss-mini-sub">Pick tile (+1 or Stay)</span>
      </div>

      <div class="abyss-options-grid">
        <button class="abyss-mini-btn btn-stay" id="btnAbyssStay" title="Stay on ${tileA ? tileA.name : 'Target'}">
          <div class="abyss-btn-top">
            <span class="btn-step-tag">⚓ Stay (${rollVal})</span>
            <span class="btn-tile-icon">${tileA ? tileA.icon || '⚓' : '⚓'}</span>
          </div>
          <div class="btn-tile-name">${tileA ? tileA.shortName || tileA.name : 'Tile ' + targetA}</div>
          <div class="btn-tile-sub">${detailA}</div>
        </button>

        <button class="abyss-mini-btn btn-drift" id="btnAbyssDrift" title="Surge +1 to ${tileB ? tileB.name : 'Target'}">
          <div class="abyss-btn-top">
            <span class="btn-step-tag">🌊 Drift (${rollVal + 1})</span>
            <span class="btn-tile-icon">${tileB ? tileB.icon || '🌊' : '🌊'}</span>
          </div>
          <div class="btn-tile-name">${tileB ? tileB.shortName || tileB.name : 'Tile ' + targetB}</div>
          <div class="btn-tile-sub">${detailB}</div>
        </button>
      </div>

      <div class="abyss-timer-bar-wrap">
        <div class="abyss-timer-bar" id="abyssTimerBar"></div>
      </div>
    </div>
  `;

  ov.classList.remove('hidden');
  AudioFX.playAbyssalWave();

  let resolved = false;
  const cleanup = () => {
    if (resolved) return false;
    resolved = true;
    if (driftChoiceTimer) {
      clearInterval(driftChoiceTimer);
      driftChoiceTimer = null;
    }
    if (elA) elA.classList.remove('abyss-target-a');
    if (elB) elB.classList.remove('abyss-target-b');
    ov.classList.add('hidden');
    ov.innerHTML = '';
    return true;
  };

  const choose = (drift) => {
    if (cleanup()) {
      onChoice(drift);
    }
  };

  const btnStay = ov.querySelector('#btnAbyssStay');
  const btnDrift = ov.querySelector('#btnAbyssDrift');
  const handleStay = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } choose(false); };
  const handleDrift = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } choose(true); };
  if (btnStay) {
    btnStay.addEventListener('click', handleStay);
    btnStay.addEventListener('touchend', handleStay);
  }
  if (btnDrift) {
    btnDrift.addEventListener('click', handleDrift);
    btnDrift.addEventListener('touchend', handleDrift);
  }

  // 6-second countdown bar
  const duration = 6000;
  const startAt = Date.now();
  const bar = ov.querySelector('#abyssTimerBar');
  driftChoiceTimer = setInterval(() => {
    const elapsed = Date.now() - startAt;
    const pct = Math.max(0, 100 - (elapsed / duration) * 100);
    if (bar) bar.style.width = pct + '%';
    if (elapsed >= duration) {
      const safeDrift = botChooseDrift(playerKey, targetA, targetB);
      choose(safeDrift);
    }
  }, 50);
}

/** Black Market price after a one-time Lucky Red discount. */
function marketPrice(role, itemId) {
  const base = ITEMS[itemId].price;
  const pk = perkOf(role);
  const used = monopolyState.perkUsed && monopolyState.perkUsed[role] && monopolyState.perkUsed[role].market;
  return pk.marketDiscount && !used ? Math.round(base * (1 - pk.marketDiscount)) : base;
}

function myVaultSprite() {
  const a = window.getMyAvatar ? window.getMyAvatar() : null;
  return a && a.sprite ? a.sprite : null;
}
function partnerVaultSprite() {
  const a = window.getPartnerAvatar ? window.getPartnerAvatar() : null;
  return a && a.sprite ? a.sprite : null;
}

const PLAYED_CARDS_LOCAL_KEY = 'nook_monopoly_played_cards_v1';

function isValidCardId(id) {
  if (window.MonopolyCards && typeof window.MonopolyCards.isValidCardId === 'function') {
    return window.MonopolyCards.isValidCardId(id);
  }
  const n = Number(id);
  return !isNaN(n) && ((n >= 1 && n <= 30) || (n >= 101 && n <= 170));
}

function getSafeCard(cardId, playedIds = []) {
  if (window.MonopolyCards && typeof window.MonopolyCards.getSafeCard === 'function') {
    return window.MonopolyCards.getSafeCard(cardId, playedIds);
  }
  const numId = Number(cardId);
  if (isValidCardId(numId) && CARD_BY_ID[numId]) return CARD_BY_ID[numId];
  const playedSet = new Set((playedIds || []).map(Number).filter(isValidCardId));
  const unplayed = CARD_DECK.filter((c) => !playedSet.has(c.id));
  const fallback = unplayed.length > 0
    ? unplayed[Math.floor(Math.random() * unplayed.length)]
    : CARD_DECK[Math.floor(Math.random() * CARD_DECK.length)];
  return fallback || CARD_DECK[0];
}

function loadPersistentPlayedCardIds() {
  try {
    const raw = localStorage.getItem(PLAYED_CARDS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(isValidCardId);
    }
  } catch (e) {}
  return [];
}

function savePersistentPlayedCardIds(ids) {
  try {
    const valid = Array.from(new Set((ids || []).map(Number).filter(isValidCardId)));
    localStorage.setItem(PLAYED_CARDS_LOCAL_KEY, JSON.stringify(valid));
  } catch (e) {}
}

function createDefaultMonopolyState() {
  return {
    version: MONO_CFG.VERSION,
    active: false,
    currentTurn: 'bkk',
    round: 1,
    isRolling: false,
    turnResolver: null,   // role of the client resolving the current turn
    players: { bkk: makePlayer('bkk'), dxb: makePlayer('dxb') },
    properties: {},       // tileId -> { owner, level }
    pendingDecision: null,
    activeChallenge: null,
    activeDuel: null,
    magnet: null,         // { owner, target }
    cardDeck: [],
    playedCardIds: loadPersistentPlayedCardIds(),
    gameOver: null,
    stats: { matches: 0, misses: 0, takeovers: { bkk: 0, dxb: 0, bot1: 0, bot2: 0 }, rentPaid: { bkk: 0, dxb: 0, bot1: 0, bot2: 0 }, jackpots: 0, itemsUsed: 0 }
  };
}

function isV2State(s) {
  return !!(
    s &&
    (s.version === MONO_CFG.VERSION || s.mode === 'bot' || s.mode === '4p' || s.mode === 'room') &&
    s.players &&
    typeof s.players === 'object' &&
    Object.keys(s.players).length >= 2 &&
    s.properties
  );
}

function getTurnOrder() {
  const st = monopolyState;
  if (!st || !st.players) return ['bkk', 'dxb'];
  if (Array.isArray(st.turnOrder) && st.turnOrder.length > 0) {
    const valid = st.turnOrder.filter((r) => st.players[r] && !st.players[r].bankrupt);
    if (valid.length > 0) return valid;
  }
  const activeRoles = Object.keys(st.players).filter((r) => !st.players[r].bankrupt);
  return activeRoles.length > 0 ? activeRoles : ['bkk', 'dxb'];
}

function getNextTurn(currentRole) {
  const order = getTurnOrder();
  const idx = order.indexOf(currentRole);
  if (idx === -1) {
    const fullOrder = Array.isArray(monopolyState?.turnOrder) && monopolyState.turnOrder.length > 0
      ? monopolyState.turnOrder
      : Object.keys(monopolyState?.players || { bkk: 1, dxb: 1 });
    const fullIdx = fullOrder.indexOf(currentRole);
    if (fullIdx !== -1) {
      for (let i = 1; i <= fullOrder.length; i++) {
        const candidate = fullOrder[(fullIdx + i) % fullOrder.length];
        if (order.includes(candidate)) return candidate;
      }
    }
    return order[0] || 'bkk';
  }
  return order[(idx + 1) % order.length];
}

const MONOPOLY_LOCAL_KEY = 'nook_sky_monopoly_v5';
const MONOPOLY_BOT_LOCAL_KEY = 'nook_sky_monopoly_bot_v1';
const MONOPOLY_ROOM_LOCAL_KEY = 'nook_sky_monopoly_room_v1';

function saveLocalMonopolyState() {
  try {
    if (!monopolyState) return;
    const mode = monopolyState.mode || 'couple';
    let key = MONOPOLY_LOCAL_KEY;
    if (mode === 'bot') key = MONOPOLY_BOT_LOCAL_KEY;
    else if (mode === '4p' || mode === 'room' || currentFlightRoom) key = MONOPOLY_ROOM_LOCAL_KEY;

    localStorage.setItem(key, JSON.stringify({ ...monopolyState, isRolling: false }));
    localStorage.setItem('nook_mono_active_mode', mode);
  } catch (e) {}
}

function loadLocalMonopolyState(preferredMode) {
  try {
    const activeMode = preferredMode || localStorage.getItem('nook_mono_active_mode') || 'couple';
    let key = MONOPOLY_LOCAL_KEY;
    if (activeMode === 'bot') key = MONOPOLY_BOT_LOCAL_KEY;
    else if (activeMode === '4p' || activeMode === 'room') key = MONOPOLY_ROOM_LOCAL_KEY;

    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isV2State(parsed)) {
        parsed.isRolling = false;
        // If the saved state is from an already finished game, reset it so refresh starts clean at the lobby
        if (parsed.gameOver) {
          parsed.gameOver = null;
          parsed.active = false;
        }
        // Always take the superset union of played cards so history NEVER shrinks across reloads
        const persistent = loadPersistentPlayedCardIds();
        const combined = new Set([...(Array.isArray(parsed.playedCardIds) ? parsed.playedCardIds : []), ...persistent].map(Number).filter(isValidCardId));
        parsed.playedCardIds = Array.from(combined);
        savePersistentPlayedCardIds(parsed.playedCardIds);
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

let monopolyState = loadLocalMonopolyState() || createDefaultMonopolyState();

let manualRoleOverride = null;
let isSpectatorMode = false;

/**
 * Robust terminal & role resolution: 'bkk', 'dxb', 'bot1', or 'bot2'.
 * Guarantees a human player is NEVER assigned to an AI bot role,
 * and spectators are never assigned a player role.
 */
function getMonopolyMyRole() {
  if (isSpectatorMode) return 'spectator';
  if (manualRoleOverride) return manualRoleOverride;

  // 1. If an active match is in progress:
  //    A human player NEVER controls an AI bot!
  if (monopolyState && monopolyState.active && monopolyState.players) {
    const players = monopolyState.players;
    const humanRoles = Object.keys(players).filter((r) => players[r] && !players[r].isBot);
    // If there is ONLY ONE human player in the game, the local user MUST be that human!
    if (humanRoles.length === 1) {
      return humanRoles[0];
    }
  }

  // 2. If inside an active Flight Room:
  if (currentFlightRoom) {
    if (currentFlightRoomSlot && currentFlightRoomSlot.role) {
      return currentFlightRoomSlot.role;
    }
    if (typeof isCurrentUserHost === 'function' && isCurrentUserHost()) {
      const slot1 = currentFlightRoom.slots?.[0];
      if (slot1 && slot1.role) return slot1.role;
      return 'bkk';
    }
    const myUid = getPersistentPlayerUid();
    const mySlot = (currentFlightRoom.slots || []).find((s) => s.occupiedBy && (s.occupiedBy === myUid || s.occupiedBy === `user_${myUid}`));
    if (mySlot && mySlot.role) return mySlot.role;
  }

  // 3. Explicit URL parameters
  const search = window.location.search.toLowerCase();
  if (search.includes('role=bkk') || search.includes('terminal=bkk')) return 'bkk';
  if (search.includes('role=dxb') || search.includes('terminal=dxb')) return 'dxb';

  // 4. Candidate terminal from WebSocket or pathname
  let candidate = null;
  if (window.myTerminal) {
    const t = String(window.myTerminal).toLowerCase();
    if (t === 'bkk' || t === 'dxb') candidate = t;
  }
  if (!candidate && typeof getTerminal === 'function') {
    const t = getTerminal();
    if (t === 'bkk' || t === 'dxb') candidate = t;
  }
  const path = window.location.pathname.toLowerCase();
  if (!candidate && path.includes('/dxb')) candidate = 'dxb';

  const defaultRole = candidate || 'bkk';

  // 5. Final guard against assigning a human to a bot player
  if (monopolyState && monopolyState.active && monopolyState.players) {
    if (monopolyState.players[defaultRole] && monopolyState.players[defaultRole].isBot) {
      const humanRole = Object.keys(monopolyState.players).find((r) => !monopolyState.players[r].isBot);
      if (humanRole) return humanRole;
    }
  }

  return defaultRole;
}

function getPersistentPlayerUid() {
  if (typeof window !== 'undefined' && window.SkySupabase && typeof window.SkySupabase.getUser === 'function') {
    const u = window.SkySupabase.getUser();
    if (u && u.id) return u.id;
  }
  if (typeof localStorage !== 'undefined') {
    let uid = localStorage.getItem('sky_player_uid');
    if (!uid) {
      const role = getMonopolyMyRole();
      uid = `user_${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem('sky_player_uid', uid);
    }
    return uid;
  }
  return `user_${getMonopolyMyRole()}`;
}

// --- Turn authority & partner presence ---
let lastActivityAt = Date.now();
function markActivity() { lastActivityAt = Date.now(); }
function partnerAway() {
  if (monopolyState && monopolyState.mode === 'bot') return false;
  return window.nookPartnerOnline === false;
}

function isResolver() {
  const st = monopolyState;
  if (!st || isSpectatorMode) return false;
  if (st.mode === 'bot') return true;
  const me = getMonopolyMyRole();
  const currentP = st.players && st.players[st.currentTurn];
  const isBotOrTakeover = currentP && (currentP.isBot || currentP.controller === 'BOT_TEMPORARY' || currentP.controller === 'BOT_PERMANENT');
  if (isBotOrTakeover) {
    // 1. If a human turnResolver is already locked in for this bot's turn and still connected, honor it strictly
    if (
      st.turnResolver &&
      st.players[st.turnResolver] &&
      !st.players[st.turnResolver].isBot &&
      st.players[st.turnResolver].controller !== 'BOT_TEMPORARY' &&
      st.players[st.turnResolver].controller !== 'BOT_PERMANENT'
    ) {
      return st.turnResolver === me;
    }
    // 2. In Flight Room / 4P mode, strictly pick ONE canonical connected human (Host first, then first connected human)
    if (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) {
      const connectedHumanSlots = currentFlightRoom.slots.filter(
        (s) => s.type === 'human' && s.occupiedBy && s.connected !== false && s.controller !== 'BOT_TEMPORARY' && s.controller !== 'BOT_PERMANENT'
      );
      if (connectedHumanSlots.length > 0) {
        const hostSlot = connectedHumanSlots.find((s) => s.id === 1 || s.occupiedBy === currentFlightRoom.hostUid) || connectedHumanSlots[0];
        if (hostSlot && hostSlot.role) {
          return me === hostSlot.role;
        }
      }
      if (typeof isCurrentUserHost === 'function' && isCurrentUserHost()) return true;
    }
    // 3. Fallback: first active non-bot human in st.players (usually 'bkk')
    const firstHuman = Object.keys(st.players || {}).find(
      (r) => !st.players[r].isBot && st.players[r].controller !== 'BOT_TEMPORARY' && st.players[r].controller !== 'BOT_PERMANENT'
    );
    if (firstHuman) return me === firstHuman;
    if (!currentFlightRoom && st.mode !== '4p' && st.mode !== 'room' && partnerAway()) return true;
    return me === 'bkk';
  }
  return (st.turnResolver || st.currentTurn) === me;
}
const isTurnResolver = isResolver;
function isBlockingState() {
  const st = monopolyState;
  return !!(st.pendingDecision || st.activeChallenge || st.activeDuel || st.gameOver);
}

// =========================================================
// 8. ECONOMY
// =========================================================
function upgradeCost(tile, role) {
  const base = Math.round(tile.price * MONO_CFG.UPGRADE_RATE);
  if (role && perkOf(role).upgradeDiscount) {
    return Math.round(base * (1 - perkOf(role).upgradeDiscount));
  }
  return base;
}

function propValue(tileId) {
  const tile = MONOPOLY_TILES[tileId];
  const prop = monopolyState.properties[tileId];
  if (!tile || !prop) return 0;
  return tile.price + (prop.level - 1) * upgradeCost(tile);
}

function ownedTileIds(role) {
  return Object.keys(monopolyState.properties)
    .filter((id) => monopolyState.properties[id] && monopolyState.properties[id].owner === role)
    .map(Number);
}

function zoneTiles(zone) {
  return MONOPOLY_TILES.filter((t) => t.type === 'property' && t.zone === zone);
}

function ownsZone(role, zone) {
  const tiles = zoneTiles(zone);
  return tiles.length > 0 && tiles.every((t) => monopolyState.properties[t.id] && monopolyState.properties[t.id].owner === role);
}

/** Current Final Boarding stage ({ round, mult }) or null before it starts. */
function finalBoardingStage(round = monopolyState.round || 1) {
  let stage = null;
  for (const s of MONO_CFG.FINAL_BOARDING_STAGES) if (round >= s.round) stage = s;
  return stage;
}
function finalBoardingMult() {
  const s = finalBoardingStage();
  return s ? s.mult : 1;
}
function isFinalBoarding() {
  return !!finalBoardingStage();
}
const multLabel = (m) => `×${m}`;

function getTileRent(tileId, levelOverride) {
  const tile = MONOPOLY_TILES[tileId];
  if (!tile || tile.type !== 'property') return 0;
  const prop = monopolyState.properties[tileId];
  const level = levelOverride || (prop ? prop.level : 1);
  let rent = tile.rent * (MONO_CFG.RENT_MULT[level] || 1);
  if (prop && ownsZone(prop.owner, tile.zone)) rent *= MONO_CFG.ZONE_MULT;
  rent *= finalBoardingMult();

  // ☀️ S2-B Solar-Lunar Eclipse Convergence: 0 rent for rivals
  if (monopolyState.eclipseInvertRounds > 0 && prop && prop.owner !== monopolyState.eclipseCaster) {
    return 0;
  }

  // 🪔 S3 Midas Touch: Hotel transmuted to solid gold = 0 rent!
  if (prop && prop.isTransmutedGold) {
    return 0;
  }

  // 🔱 S5 Atlantis Sunken Ruin vs Coral Palace:
  if (monopolyState.floodedTiles && monopolyState.floodedTiles[tileId] && prop && prop.owner) {
    if (isAbyssalDrifter(prop.owner)) {
      rent *= 1.3; // Bioluminescent Coral Palace: +30% rent!
    } else {
      return 0; // Sunken Ruin: Rent disabled underwater!
    }
  }

  // 🐉 S1 Sacred Waterways: +30% rent multiplier
  if (monopolyState.sacredWaterways && monopolyState.sacredWaterways[tileId]) {
    rent *= 1.3;
  }

  // 🌓 S2 Eclipse Shadow Tiles: 1.5× Nightmare Toll
  if (monopolyState.eclipseShadowTiles && monopolyState.eclipseShadowTiles[tileId]) {
    rent *= 1.5;
  }

  // 🐉 S1 Mekong Lotus Water Shield: +50% rent bonus
  if (prop && prop.waterShield) {
    rent *= 1.5;
  }

  // 🪐 S6 Supernova Celestial Shield: +25% Star Tithe rent bonus
  if (prop && prop.shield > 0) {
    rent *= 1.25;
  }

  // 🌹 S7 Enchanted Rose Turret: +30% rent multiplier
  if (prop && prop.enchantedTurret) {
    rent *= 1.3;
  }

  // 🕯️ S7 Living Staff Torch Shield: +20% rent multiplier while shield is burning
  if (prop && prop.torchShield) {
    rent *= 1.2;
  }

  // ❄️ S8 Glacial Frost Shield: +35% rent bonus on owned domain
  if (prop && prop.frostShield) {
    rent *= 1.35;
  }

  // 🎰 S4 Monaco Gold Rush: 1.5× VIP High-Roller Rent for 2 rounds after Ultimate
  if (prop && prop.owner && monopolyState?.players?.[prop.owner]?.monacoGoldRushRounds > 0) {
    rent *= 1.5;
  }

  const isMonumentSuppressed = !!(prop && prop.monumentSuppressedRounds && prop.monumentSuppressedRounds > 0);

  // ❄️ S8 Glacial Ice Citadel: 2× Double Frostbite Rent on the Citadel Wonder (unless Arcane Eclipsed)
  if (!isMonumentSuppressed && prop && (prop.isGlacialCitadel || (monopolyState && monopolyState.glacialCitadelTile === tileId && (!monopolyState.glacialCitadelOwner || prop.owner === monopolyState.glacialCitadelOwner)))) {
    rent *= 2.0;
  }

  // 🏛️ S9 Great Golden Pyramid: 2× Monumental Rent on Tier 4 Wonder (unless Arcane Eclipsed)
  if (!isMonumentSuppressed && prop && (prop.isGoldenPyramid || (monopolyState && monopolyState.goldenPyramidTile === tileId && (!monopolyState.goldenPyramidOwner || prop.owner === monopolyState.goldenPyramidOwner)))) {
    rent *= 2.0;
  }

  // ⚡ S11 Mount Olympus Temple: +50% Divine Rent multiplier (unless Arcane Eclipsed)
  if (!isMonumentSuppressed && prop && (prop.isOlympusTemple || (monopolyState && monopolyState.olympusTempleTile === tileId && (!monopolyState.olympusTempleOwner || prop.owner === monopolyState.olympusTempleOwner)))) {
    rent *= 1.5;
  }

  // ☀️ S9 Solar Deity Obelisk (Ra & Sekhmet): +25% Heliopolis Sun Rent on Solar Obelisk / Level 3 Hotel
  if (!isMonumentSuppressed && prop && (prop.isSolarObelisk || (prop.owner && typeof isSolarDivinity === 'function' && isSolarDivinity(prop.owner) && ((monopolyState && monopolyState.solarObeliskTile === tileId) || (prop.level || 1) >= 3)))) {
    rent *= 1.25;
  }

  // ❄️ S8 Frosted Landmark: -30% rent debuff on rival property
  if (prop && prop.frosted && prop.frosted > 0) {
    rent *= 0.7;
  }

  return Math.round(rent);
}

function clearMonumentPointersForTile(st, tileId) {
  if (!st) return;
  const tid = Number(tileId);
  if (st.glacialCitadelTile === tid) { st.glacialCitadelTile = null; st.glacialCitadelOwner = null; }
  if (st.goldenPyramidTile === tid) { st.goldenPyramidTile = null; st.goldenPyramidOwner = null; }
  if (st.olympusTempleTile === tid) { st.olympusTempleTile = null; st.olympusTempleOwner = null; }
  if (st.solarObeliskTile === tid) { st.solarObeliskTile = null; }
}

function netWorth(role) {
  return monopolyState.players[role].miles + ownedTileIds(role).reduce((sum, id) => sum + propValue(id), 0);
}

/** Adds miles; a Magnet on this player during their own turn diverts 25%. */
function grantMiles(role, amount) {
  const st = monopolyState;
  let gain = Math.round(amount);
  const mg = st.magnet;
  if (mg && mg.target === role && st.currentTurn === role && gain > 0) {
    const steal = Math.round(gain * MONO_CFG.MAGNET_RATE);
    gain -= steal;
    st.players[mg.owner].miles += steal;
    setTimeout(() => {
      floatText(null, `🧲 ${st.players[mg.owner].badge} +${fmt(steal)}`, 'pos');
      if (window.MonoFX) MonoFX.coins({ from: { role }, to: { role: mg.owner }, amount: steal });
    }, 300);
  }
  st.players[role].miles += gain;
  return gain;
}

/**
 * Charges a player. If they can't afford it, their cheapest properties are
 * auto-sold to the bank at 50%. If still short → bankrupt (opponent wins).
 */
function chargePlayer(payerKey, amount, receiverKey) {
  const st = monopolyState;
  const payer = st.players[payerKey];
  let due = Math.round(amount);

  // 🍳 S7 Mythic: Cast-Iron Frying Pan Parry (50% damage reduction)
  if (perkOf(payerKey).fryingPanParry && due > 0) {
    const parryRate = Number(perkOf(payerKey).fryingPanParry) || 0.5;
    const parried = Math.round(due * parryRate);
    due = Math.max(0, due - parried);
    if (AudioFX.playFryingPanClang) AudioFX.playFryingPanClang();
    announce(`🍳💥 <strong>CAST-IRON FRYING PAN CLANG!</strong> ${payer.name} parried <strong>${parried}🪙</strong> (50% rent parried)!`);
    floatText(null, `🍳 -${parried}🪙 PARRIED!`, 'pos');
  }

  // 👠 S7 Mythic: Glass Slipper Trial (25% chance rent waived +80 bonus)
  if (perkOf(payerKey).glassSlipperTrial && due > 0 && Math.random() < 0.25) {
    due = 0;
    payer.miles += 80;
    if (AudioFX.playMidnightChimes) AudioFX.playMidnightChimes();
    announce(`👠✨ <strong>GLASS SLIPPER FITS!</strong> The royal slipper fit ${payer.name} perfectly: rent waived and +80 miles awarded!`);
    floatText(null, '👠 SLIPPER FITS: 0 RENT! ✨', 'pos');
  }

  // ❄️ S8 Mythic: Glacial Rent Shield & Permafrost Infliction (50% rent absorbed + property frosted)
  if (perkOf(payerKey).frostShield && due > 0) {
    const shieldRate = Number(perkOf(payerKey).frostShield) || 0.5;
    const absorbed = Math.round(due * shieldRate);
    due = Math.max(0, due - absorbed);
    if (AudioFX.playFrostShield) AudioFX.playFrostShield();
    announce(`❄️🛡️ <strong>GLACIAL PERMAFROST SHIELD!</strong> ${payer.name} absorbed <strong>${absorbed}🪙</strong> (50% rent negated)!`);
    floatText(null, `❄️ -${absorbed}🪙 FROST SHIELD!`, 'pos');
    const curPos = payer.pos;
    if (st.properties[curPos] && st.properties[curPos].owner && st.properties[curPos].owner !== payerKey) {
      st.properties[curPos].frosted = 2; // Frosted for 2 rounds (-30% rent)
      floatText(curPos, '❄️ FROSTED (-30% Rent)', 'pos');
    }
    emitFx({
      kind: 'moment',
      id: 'frost_shield_deflection',
      payerRole: payerKey,
      ownerRole: receiverKey,
      absorbed,
      tileId: curPos
    });
  }

  // 🏺 S9 Mythic: Royal Extortion (10% discount on rent paid to rivals)
  if (perkOf(payerKey).royalExtortion && due > 0) {
    const extAmt = Math.round(due * (Number(perkOf(payerKey).royalExtortion) || 0.1));
    due = Math.max(0, due - extAmt);
    announce(`🏺👑 <strong>ROYAL EXTORTION!</strong> Empress ${payer.name} extorted a <strong>${extAmt}🪙</strong> royal discount (10% off)!`);
    floatText(null, `🏺 -${extAmt}🪙 EXTORTION`, 'pos');
  }

  const sold = [];
  const soldIds = [];
  while (payer.miles < due) {
    const mine = ownedTileIds(payerKey).sort((a, b) => propValue(a) - propValue(b));
    if (!mine.length) break;
    const id = mine[0];
    payer.miles += Math.round(propValue(id) * MONO_CFG.LIQUIDATION_RATE);
    delete st.properties[id];
    clearMonumentPointersForTile(st, id);
    sold.push(MONOPOLY_TILES[id].shortName);
    soldIds.push(id);
  }
  const paid = Math.max(0, Math.min(payer.miles, due));
  payer.miles -= paid;
  if (receiverKey) st.players[receiverKey].miles += paid;
  let bankrupt = paid < due;
  if (paid > 0) chargeUlt(payerKey, 20, 'Rent Paid');

  // 🏮 S7 Mythic: Lantern Festival Bankruptcy Immunity
  if (bankrupt && (payer.bankruptcyImmunity || 0) > 0) {
    bankrupt = false;
    payer.miles += 200;
    payer.bankruptcyImmunity = 0;
    if (AudioFX.playFairytaleHarp) AudioFX.playFairytaleHarp();
    emitFx({ kind: 'moment', id: 'lantern_immunity', role: payerKey, text: `${payer.name} Lantern Immunity!` });
    emitFx({ kind: 'sound', name: 'fanfare' });
    emitFx({ kind: 'float', role: payerKey, text: '+200 Lantern Immunity 🏮', cls: 'pos' });
    announce(`🏮✨ <strong>WISH UPON A LANTERN IMMUNITY!</strong> Golden sky lanterns shielded ${payer.name} from bankruptcy and granted <strong>+200 miles</strong> royal emergency fund!`);
  }

  // 🔱 S5 Mythic: Abyssal Pearl Ward negates fatal bankruptcy once per match
  if (bankrupt && perkOf(payerKey).pearlWard && (!st.perkUsed || !st.perkUsed[payerKey] || !st.perkUsed[payerKey].pearlWard)) {
    st.perkUsed = st.perkUsed || {};
    st.perkUsed[payerKey] = Object.assign({}, st.perkUsed[payerKey], { pearlWard: true });
    bankrupt = false;
    payer.miles += 150; // Emergency pearl life-energy!
    emitFx({ kind: 'moment', id: 'pearl_ward', role: payerKey, text: `${payer.name} Abyssal Pearl Ward!` });
    emitFx({ kind: 'sound', name: 'fanfare' });
    emitFx({ kind: 'float', role: payerKey, text: '+150 Pearl Ward 🦪', cls: 'pos' });
    announce(`🦪🔱 <strong>ABYSSAL PEARL WARD ACTIVATED!</strong> The sacred pearl absorbed the fatal debt and infused ${payer.name} with <strong>+150 miles</strong> emergency life-energy!`);
  }

  // ✨ S6 Mythic: Constellation Rebirth negates fatal bankruptcy once per match
  if (bankrupt && perkOf(payerKey).constellationRebirth && (!st.perkUsed || !st.perkUsed[payerKey] || !st.perkUsed[payerKey].constellationRebirth)) {
    st.perkUsed = st.perkUsed || {};
    st.perkUsed[payerKey] = Object.assign({}, st.perkUsed[payerKey], { constellationRebirth: true });
    bankrupt = false;
    payer.miles += 180; // Emergency stardust energy!
    emitFx({ kind: 'moment', id: 'constellation_rebirth', role: payerKey, text: `${payer.name} Constellation Rebirth!` });
    emitFx({ kind: 'sound', name: 'fanfare' });
    emitFx({ kind: 'float', role: payerKey, text: '+180 Astral Stardust ✨', cls: 'pos' });
    announce(`✨🌌 <strong>CONSTELLATION REBIRTH ACTIVATED!</strong> The celestial cosmos wiped away the fatal debt and empowered ${payer.name} with <strong>+180 miles</strong>!`);
  }

  // 🔥 S3-B Mythic: Phoenix Ash Rebirth negates fatal bankruptcy once per match
  if (bankrupt && (perkOf(payerKey).phoenixRebirth || isPhoenixAscendant(payerKey)) && (!st.perkUsed || !st.perkUsed[payerKey] || !st.perkUsed[payerKey].phoenixRebirth)) {
    st.perkUsed = st.perkUsed || {};
    st.perkUsed[payerKey] = Object.assign({}, st.perkUsed[payerKey], { phoenixRebirth: true });
    bankrupt = false;
    payer.miles += 250; // Enhanced comeback reserve!
    payer.phoenixGraceActive = true; // 1-turn immunity ward against the immediate next rent!
    emitFx({ kind: 'moment', id: 'phoenix_rebirth_flare', role: payerKey, text: `${payer.name} Ash Rebirth!` });
    AudioFX.playPhoenixRebirth();
    emitFx({ kind: 'float', role: payerKey, text: '+250 Phoenix Grace 🔥', cls: 'pos' });
    announce(`🔥☀️ <strong>IMMORTAL PHOENIX REBIRTH!</strong> ${payer.name}'s debt was incinerated in blazing sacred flames and revived with <strong>+250 miles & Phoenix Grace Ward</strong>! 🪶`);
  }

  // Liquidated tiles pay out to the payer before the rent leaves
  soldIds.forEach((id) => emitFx({ kind: 'coins', from: { tileId: id }, to: { role: payerKey }, amount: 160 }));
  if (bankrupt) {
    payer.bankrupt = true;
    payer.miles = 0;
    // Release all remaining properties owned by the bankrupt player
    Object.keys(st.properties || {}).forEach((tid) => {
      if (st.properties[tid].owner === payerKey) {
        delete st.properties[tid];
        clearMonumentPointersForTile(st, tid);
      }
    });

    emitFx({ kind: 'moment', id: 'bankrupt', role: payerKey, text: `${payer.name} is out of miles` });

    // In 3P or 4P, elimination continues until 1 survivor remains
    const survivors = Object.keys(st.players || {}).filter((r) => !st.players[r].bankrupt);
    if (survivors.length <= 1) {
      const winner = survivors[0] || payerKey;
      declareWinner(winner, 'bankrupt', payerKey);
    } else {
      announce(`💀 <strong>BANKRUPTCY!</strong> ${payer.name} ran out of miles and was eliminated from the flight!`);
    }
  }
  return { paid, sold, soldIds, bankrupt };
}

function soldNote(sold) {
  return sold && sold.length ? ` Sold <strong>${sold.join(', ')}</strong> to the bank to cover it.` : '';
}

function giveRandomItem(role) {
  const p = monopolyState.players[role];
  if (!p.inventory) p.inventory = [];
  if (p.inventory.length >= MONO_CFG.MAX_ITEMS) {
    grantMiles(role, MONO_CFG.AIRDROP_FULL_CASH);
    return null;
  }
  const id = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
  p.inventory.push(id);
  return id;
}

function giveItemDirect(role, itemId) {
  const p = monopolyState.players[role];
  if (!p) return null;
  if (!p.inventory) p.inventory = [];
  if (p.inventory.length >= MONO_CFG.MAX_ITEMS) {
    grantMiles(role, MONO_CFG.AIRDROP_FULL_CASH);
    return null;
  }
  p.inventory.push(itemId);
  return itemId;
}

function consumeItem(role, itemId) {
  const inv = monopolyState.players[role].inventory || [];
  const idx = inv.indexOf(itemId);
  if (idx === -1) return false;
  inv.splice(idx, 1);
  monopolyState.stats.itemsUsed++;
  return true;
}

function drawCard() {
  const st = monopolyState;
  const persistent = loadPersistentPlayedCardIds();
  const current = Array.isArray(st.playedCardIds) ? st.playedCardIds : [];
  const combined = new Set([...current, ...persistent].map(Number).filter(isValidCardId));
  st.playedCardIds = Array.from(combined);
  savePersistentPlayedCardIds(st.playedCardIds);
  const playedSet = new Set(st.playedCardIds);

  // Filter existing deck to only valid, unplayed cards
  const validDeck = (st.cardDeck || []).filter((id) => isValidCardId(id) && !playedSet.has(Number(id)));
  if (validDeck.length === 0) {
    const unplayed = CARD_DECK.filter((c) => !playedSet.has(c.id)).map((c) => c.id);
    if (unplayed.length > 0) {
      st.cardDeck = shuffleArray(unplayed);
    } else {
      // All 100 cards have been played! Reset played history and reshuffle full deck
      console.log('[Monopoly] All 100 cards have been played! Reshuffling entire deck.');
      st.playedCardIds = [];
      playedSet.clear();
      savePersistentPlayedCardIds([]);
      st.cardDeck = shuffleArray(CARD_DECK.map((c) => c.id));
    }
  } else {
    st.cardDeck = validDeck;
  }

  const cardId = st.cardDeck.pop();
  if (cardId != null && isValidCardId(cardId)) {
    if (!playedSet.has(Number(cardId))) {
      st.playedCardIds.push(Number(cardId));
      savePersistentPlayedCardIds(st.playedCardIds);
    }
  }
  saveLocalMonopolyState();
  return getSafeCard(cardId, st.playedCardIds);
}

// =========================================================
// 9. GAME OVER
// =========================================================
function declareWinner(winner, reason, bankruptRole) {
  const st = monopolyState;
  if (st.gameOver) return;
  const nwObj = {};
  Object.keys(st.players || {}).forEach((r) => { nwObj[r] = netWorth(r); });
  st.gameOver = {
    winner,
    reason,
    bankruptRole: bankruptRole || (reason === 'bankrupt' ? Object.keys(st.players || {}).find((r) => st.players[r]?.bankrupt) : null),
    at: Date.now(),
    round: Math.min(st.round || 1, MONO_CFG.MAX_ROUNDS),
    netWorth: nwObj
  };
  st.pendingDecision = null;
}

function checkGameOver() {
  const st = monopolyState;
  if (st.gameOver) return true;
  const roles = Object.keys(st.players || {}).filter((r) => !st.players[r].bankrupt);
  if (roles.length <= 1) {
    const winner = roles[0] || 'bkk';
    declareWinner(winner, 'bankrupt');
    return true;
  }
  const leader = roles.reduce((best, r) => (!best || netWorth(r) > netWorth(best)) ? r : best, roles[0]);

  // 🚨 High-Dopamine Match Point Warning (within 500 NW of victory)
  if (leader && netWorth(leader) >= (MONO_CFG.WIN_NET_WORTH - 500) && !st.matchPointAlerted && !st.gameOver) {
    st.matchPointAlerted = true;
    const leaderP = st.players[leader];
    const leaderName = leaderP?.name || leader;
    const alertMsg = `⚠️🚨 <strong>MATCH POINT!</strong> ${leaderName} reached <strong>${fmt(netWorth(leader))} NW</strong>! Target is <strong>${fmt(MONO_CFG.WIN_NET_WORTH)} NW</strong> — Opponent must force a bankruptcy or land an ultimate! ⚡`;
    announce(alertMsg);
    floatText(leaderP?.pos ?? 0, '⚠️ MATCH POINT!', 'pos fx-big');
    if (AudioFX.playBoom) AudioFX.playBoom();
    shakeBoard('heavy');
    if (window.MonoFX && MonoFX.banner) {
      MonoFX.banner('⚠️ MATCH POINT ALERT! ⚠️', `${leaderName.toUpperCase()} REACHED ${fmt(netWorth(leader))} NW! GOAL IS ${fmt(MONO_CFG.WIN_NET_WORTH)}!`, 'gold', 2400);
    }
  }

  if (leader && netWorth(leader) >= MONO_CFG.WIN_NET_WORTH) {
    declareWinner(leader, 'target');
  }
  return !!st.gameOver;
}

function declareByNetWorth() {
  const st = monopolyState;
  monopolyState.round = MONO_CFG.MAX_ROUNDS;
  const roles = Object.keys(st.players || {}).filter((r) => !st.players[r]?.bankrupt);
  if (!roles.length) {
    declareWinner(null, 'draw');
    return;
  }
  const sorted = [...roles].sort((a, b) => netWorth(b) - netWorth(a));
  const topNw = netWorth(sorted[0]);
  const tiedTop = sorted.filter((r) => netWorth(r) === topNw);
  if (tiedTop.length > 1) {
    declareWinner(null, 'draw');
  } else {
    declareWinner(sorted[0] || 'bkk', 'cap');
  }
}

// =========================================================
// 10. SYNC (AUTHORITATIVE STATE BROADCAST)
// =========================================================
let outboundFx = [];
let outboundTicker = null;
let isAnimating = false;
let queuedMessages = [];
const activeRollLocks = { bkk: false, dxb: false, bot1: false, bot2: false };
const activeMoveLocks = { bkk: false, dxb: false, bot1: false, bot2: false };
if (typeof window !== 'undefined') {
  window.activeRollLocks = activeRollLocks;
  window.activeMoveLocks = activeMoveLocks;
}

function isRoleLocked(role) {
  return !!(activeRollLocks[role] || activeMoveLocks[role]);
}

function releaseRoleLocks(role) {
  if (role) {
    activeRollLocks[role] = false;
    activeMoveLocks[role] = false;
  } else {
    Object.keys(activeRollLocks).forEach((k) => { activeRollLocks[k] = false; });
    Object.keys(activeMoveLocks).forEach((k) => { activeMoveLocks[k] = false; });
  }
}

function setMonopolyTicker(msg) {
  const el = $m('monopolyTicker');
  if (el) el.innerHTML = msg;
}

/** Shows a ticker message locally and sends it with the next state push. */
function announce(msg) {
  setMonopolyTicker(msg);
  outboundTicker = msg;
}

/** Plays an effect locally and queues it for the partner's screen. */
function emitFx(fx) {
  playFx(fx);
  outboundFx.push(fx);
}

function pushState() {
  saveLocalMonopolyState();
  markActivity();
  if (monopolyState && monopolyState.mode === 'bot') {
    outboundFx = [];
    outboundTicker = null;
    return;
  }
  const msg = { type: 'monopoly_action', action: 'state', state: monopolyState };
  if (outboundFx.length) msg.fx = outboundFx;
  if (outboundTicker) msg.ticker = outboundTicker;
  outboundFx = [];
  outboundTicker = null;
  if (typeof sendSignaling === 'function') sendSignaling(msg);
}

function sendPick(target, id, role, value) {
  saveLocalMonopolyState();
  markActivity();
  if (monopolyState && monopolyState.mode === 'bot') return;
  if (typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_action', action: 'pick', target, id, role, value, state: monopolyState });
  }
}

/** Merges a partner state; picks/rolls in an in-progress card or duel are union-merged. */
function mergeIncomingState(incoming) {
  if (!isV2State(incoming)) return false;
  const local = monopolyState;
  const merged = { ...local, ...incoming, isRolling: false, active: local.active || !!incoming.active };
  if (incoming.currentTurn && local && local.currentTurn !== incoming.currentTurn) {
    isAnimating = false;
    releaseRoleLocks();
  }
  const lc = local.activeChallenge;
  const mc = merged.activeChallenge;
  if (lc && mc && lc.id === mc.id && !mc.settled) {
    Object.keys(merged.players || {}).forEach((r) => {
      if (mc.picks && mc.picks[r] == null && lc.picks && lc.picks[r] != null) mc.picks[r] = lc.picks[r];
    });
  }
  const ld = local.activeDuel;
  const md = merged.activeDuel;
  if (ld && md && ld.id === md.id && !md.settled) {
    Object.keys(merged.players || {}).forEach((r) => {
      if (md.rolls && md.rolls[r] == null && ld.rolls && ld.rolls[r] != null) md.rolls[r] = ld.rolls[r];
    });
  }
  if (Array.isArray(incoming.playedCardIds) || Array.isArray(local.playedCardIds)) {
    const persistent = loadPersistentPlayedCardIds();
    const union = new Set([...(local.playedCardIds || []), ...(incoming.playedCardIds || []), ...persistent]);
    merged.playedCardIds = Array.from(union).map(Number).filter(isValidCardId);
    savePersistentPlayedCardIds(merged.playedCardIds);
  }
  if (Array.isArray(incoming.cardDeck) && incoming.cardDeck.length > 0) {
    const playedSet = new Set(merged.playedCardIds);
    merged.cardDeck = incoming.cardDeck.map(Number).filter((id) => isValidCardId(id) && !playedSet.has(id));
  }
  monopolyState = merged;
  saveLocalMonopolyState();
  return true;
}

/** Converts 1024px sprite/prop paths to 300px Retina thumbnails for board/HUD elements (~90% GPU texture savings). */
function toThumbSprite(url) {
  if (!url) return '';
  return String(url)
    .replace(/^assets\/(s\d+\/[^?#]+\.png)$/, 'assets/thumbs/$1')
    .replace(/^assets\/props\/(midas_gold_hotel|somnambulism_trance)\.png$/, 'assets/thumbs/props/$1.png')
    .replace(/^assets\/(bkk_warrior_idle\.png)$/, 'assets/thumbs/$1');
}

/** When true, the next HUD update skips number tweens (used after sync/reset). */
let hudInstantOnce = false;
let lastRenderedGameId = null;

/**
 * Scrubs all leftover DOM/WebGL/CSS visual effects from a previous match
 * so a new or restarted game starts on a 100% pristine board.
 */
function cleanBoardVisualsForNewGame() {
  if (typeof clearBotTimer === 'function') clearBotTimer();
  isAnimating = false;
  releaseRoleLocks();
  queuedMessages.length = 0;
  outboundFx.length = 0;
  outboundTicker = null;

  if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') {
    window.SkyPixi.clearAll();
  }
  if (window.MonoFX) {
    if (typeof MonoFX.clearDesat === 'function') MonoFX.clearDesat();
    if (MonoFX.tokens && typeof MonoFX.tokens.reset === 'function') MonoFX.tokens.reset();
  }

  const momentLayer = $m('monopolyMomentLayer');
  if (momentLayer) momentLayer.innerHTML = '';
  const fxLayer = $m('monopolyFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
  const driftOv = $m('abyssDriftOverlay');
  if (driftOv) {
    driftOv.classList.add('hidden');
    driftOv.innerHTML = '';
  }
  const tileInsp = $m('monopolyTileInspector');
  if (tileInsp) {
    tileInsp.classList.add('hidden');
    tileInsp.innerHTML = '';
  }

  const centerHub = $m('monopolyCenterHub');
  if (centerHub) {
    centerHub.className = 'monopoly-center-hub';
  }
  const diceBox = $m('monopolyDiceBox');
  if (diceBox) {
    diceBox.className = 'monopoly-dice-box';
  }
  const shockwave = $m('diceShockwave');
  if (shockwave) {
    shockwave.className = 'dice-shockwave';
  }
  [
    'monacoDiceOrbit', 'astralDiceOrbit', 'nagaDiceOrbit', 'inariDiceOrbit',
    'eclipseDiceOrbit', 'djinnDiceOrbit', 'phoenixDiceOrbit', 'abyssDiceOrbit',
    'fairytaleDiceOrbit', 'beastDiceOrbit', 'frostDiceOrbit', 'phantomDiceOrbit',
    'olympusDiceOrbit'
  ].forEach((id) => {
    const orb = $m(id);
    if (orb) {
      orb.classList.remove('active');
      orb.classList.add('hidden');
    }
  });

  boardHydrated = false;
  MONOPOLY_TILES.forEach((tile) => {
    const el = $m(`boardTile_${tile.id}`);
    if (!el) return;
    el.className = `board-tile tile-type-${tile.type} tile-zone-${tile.zone}${tile.zone === 'corner' ? ' corner-tile' : ''}`;
    delete el.dataset.sig;
    const bld = el.querySelector('.tile-monopoly-buildings');
    if (bld) {
      bld.innerHTML = '';
      delete bld.dataset.lm;
    }
    const ribbon = el.querySelector('.tile-owner-ribbon');
    if (ribbon && tile.type === 'property') {
      ribbon.className = 'tile-owner-ribbon unowned';
      ribbon.textContent = ZONES[tile.zone] ? ZONES[tile.zone].label : '';
    }
    const pill = el.querySelector('.tile-pill');
    if (pill) {
      if (tile.type === 'property') {
        pill.className = 'tile-pill tile-price-pill';
        pill.textContent = `${tile.price}🪙`;
      } else {
        pill.className = 'tile-pill tile-special-pill';
        pill.textContent = tile.shortName;
      }
    }
  });
}

function renderAll(opts = {}) {
  if (monopolyState && monopolyState.gameId && monopolyState.gameId !== lastRenderedGameId) {
    lastRenderedGameId = monopolyState.gameId;
    cleanBoardVisualsForNewGame();
  }
  if (opts.instant) hudInstantOnce = true;
  renderMonopolyBoard(opts);
  updateMonopolyHUD();
  reconcileOverlays();
}

// =========================================================
// 11. FX (FLOATING TEXT, EXPLOSIONS, BANNERS)
// =========================================================
function floatText(tileId, text, cls = '') {
  const layer = $m('monopolyFxLayer');
  const wrap = $m('monopolyBoardWrap');
  if (!layer || !wrap) return;
  const span = document.createElement('span');
  span.className = `fx-float ${cls}`;
  span.textContent = text;
  let x = wrap.clientWidth / 2;
  let y = wrap.clientHeight / 2;
  const tileEl = tileId != null ? $m(`boardTile_${tileId}`) : null;
  if (tileEl) {
    const wr = wrap.getBoundingClientRect();
    const tr = tileEl.getBoundingClientRect();
    x = tr.left - wr.left + tr.width / 2;
    y = tr.top - wr.top + tr.height / 3;
  }
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  layer.appendChild(span);
  setTimeout(() => span.remove(), 1700);
}

function shakeBoard() {
  const grid = $m('monopolyBoardGrid');
  if (!grid) return;
  grid.classList.remove('dice-impact');
  void grid.offsetWidth;
  grid.classList.add('dice-impact');
  setTimeout(() => grid.classList.remove('dice-impact'), 380);
}

function playFx(fx) {
  if (!fx) return;
  if (fx.delay) {
    const { delay, ...rest } = fx;
    if (window.MonoFX) MonoFX.hold(delay + 300);
    setTimeout(() => playFx(rest), delay);
    return;
  }
  const FX = window.MonoFX;
  switch (fx.kind) {
    case 'float':
      floatText(fx.tileId, fx.text, fx.cls || '');
      break;
    case 'sound': {
      const fn = SOUND_MAP[fx.name];
      if (fn && AudioFX[fn]) AudioFX[fn]();
      break;
    }
    case 'coins':
      if (FX) FX.coins({ from: fx.from, to: fx.to, amount: fx.amount });
      break;
    case 'icon':
      if (FX) FX.flyIcon({ from: fx.from, to: fx.to, emoji: (ITEMS[fx.item] && ITEMS[fx.item].icon) || '🎒' });
      break;
    case 'moment':
      if (FX) FX.moment(fx.id, fx);
      break;
    case 'boom':
      AudioFX.playBoom();
      shakeBoard();
      floatText(fx.tileId, '💥', 'fx-boom');
      break;
    case 'swap':
      AudioFX.playWhoosh();
      floatText(null, '🌀 SWAP!', 'fx-big');
      break;
    case 'finalBoarding': {
      AudioFX.playAlarm();
      if (FX) FX.moment('finalBoarding', { mult: fx.mult || finalBoardingMult() });
      else floatText(null, '🔥 FINAL BOARDING', 'fx-big');
      const banner = $m('monopolyFinalBoarding');
      if (banner) {
        banner.classList.remove('flash');
        void banner.offsetWidth;
        banner.classList.add('flash');
      }
      break;
    }
    case 'casino':
      if (!isResolver()) showCasinoSpectator(fx.reels, fx.label, fx.outcome);
      break;
    default:
      break;
  }
}

// =========================================================
// 12. INITIALIZATION & LIFECYCLE
// =========================================================
let rollStartedAt = 0;

function initMonopoly() {
  if (window.MonoFX) MonoFX.init();
  const openBtn = $m('openMonopolyBtn');
  const closeBtn = $m('closeMonopolyBtn');
  const exitGameBtn = $m('monopolyExitGameBtn');
  const resetBtn = $m('resetMonopolyBtn');
  const rulesBtn = $m('monopolyRulesBtn');
  const lobbyBtn = $m('monopolyLobbyBtn');
  const lobbyClose = $m('lobbyCloseBtn');
  const rollBtn = $m('btnRollDice');
  const diceBox = $m('monopolyDiceBox');
  const btnRejoinActiveFlight = $m('btnRejoinActiveFlight');

  if (openBtn) {
    const handleMonoTap = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.cancelable && e.type === 'touchend') e.preventDefault();
      }
      handleMonopolyHomeClick(e);
    };
    openBtn.addEventListener('click', handleMonoTap);
    openBtn.addEventListener('touchend', handleMonoTap, { passive: false });
  }
  if (closeBtn) closeBtn.addEventListener('click', handleMonopolyExitGame);
  if (exitGameBtn) exitGameBtn.addEventListener('click', handleMonopolyExitGame);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      promptResetOrMode();
    });
  }
  if (rulesBtn) rulesBtn.addEventListener('click', showRulesModal);
  const settingsBtn = $m('monopolySettingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (window.socialUI && typeof window.socialUI.openProfileModal === 'function') {
        window.socialUI.openProfileModal();
      } else {
        showRulesModal();
      }
    });
  }
  if (lobbyBtn) lobbyBtn.addEventListener('click', handleMonopolyExitGame);
  if (btnRejoinActiveFlight) {
    btnRejoinActiveFlight.addEventListener('click', () => {
      const active = getActiveInFlightMatch();
      handleRejoinActiveFlight(active);
    });
  }
  if (lobbyClose) {
    lobbyClose.addEventListener('click', () => {
      hideMonopolyLobby();
      if (!monopolyState || !monopolyState.active || monopolyState.gameOver) {
        closeMonopolyGame(false);
      }
    });
  }

  // NEORA Active Flight Rejoin Modal Event Listeners
  const rejoinGameBtn = $m('neoraRejoinGameBtn');
  const rejoinBackLobbyBtn = $m('neoraRejoinBackLobbyBtn');
  const rejoinCloseBtn = $m('neoraRejoinCloseBtn');
  const rejoinBackdrop = $m('neoraRejoinBackdrop');

  if (rejoinGameBtn) {
    rejoinGameBtn.addEventListener('click', () => {
      const active = pendingActiveSession?.room || currentFlightRoom;
      if (!active) {
        hideNeoraRejoinModal();
        showDepartureBoard();
        return;
      }
      if (typeof sendSignaling === 'function') {
        const myUid = getPersistentPlayerUid();
        const mySlot = (active.slots || []).find((s) => s.occupiedBy === myUid);
        const myRole = mySlot?.role || getMonopolyMyRole();
        const myAvatar = getEquippedCostumeAvatar(myRole);
        const myName = (window.getMyAvatar && window.getMyAvatar())?.name || (myRole === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺');
        sendSignaling({
          type: 'room_rejoin',
          roomId: active.id,
          uid: myUid,
          name: myName,
          avatar: myAvatar
        });
      }
    });
  }

  if (rejoinBackLobbyBtn) {
    rejoinBackLobbyBtn.addEventListener('click', () => {
      const active = pendingActiveSession?.room || currentFlightRoom;
      if (active && typeof sendSignaling === 'function') {
        sendSignaling({
          type: 'room_leave',
          roomId: active.id,
          uid: getPersistentPlayerUid()
        });
      }
      currentFlightRoom = null;
      pendingActiveSession = null;
      if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
      hideNeoraRejoinModal();
      showDepartureBoard();
    });
  }

  if (rejoinCloseBtn) {
    rejoinCloseBtn.addEventListener('click', () => {
      hideNeoraRejoinModal();
      showDepartureBoard();
    });
  }

  if (rejoinBackdrop) {
    rejoinBackdrop.addEventListener('click', () => {
      hideNeoraRejoinModal();
    });
  }

  // Check for active reconnectable session on startup
  if (typeof localStorage !== 'undefined') {
    const cachedRoomId = localStorage.getItem('sky_active_room_id');
    const uid = getPersistentPlayerUid();
    if (cachedRoomId && typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'room_check_session',
        uid,
        roomId: cachedRoomId
      });
    }
  }

  // NEORA Flight Departure Board & Lobby Event Listeners
  const departureBoardBtn = $m('monopolyDepartureBoardBtn');
  if (departureBoardBtn) departureBoardBtn.addEventListener('click', showDepartureBoard);

  const openDepartureBoardBtn = $m('btnOpenDepartureBoard');
  if (openDepartureBoardBtn) openDepartureBoardBtn.addEventListener('click', showDepartureBoard);

  const boardCloseBtn = $m('boardCloseBtn');
  if (boardCloseBtn) boardCloseBtn.addEventListener('click', hideDepartureBoard);
  const neoraBackdrop = (typeof document !== 'undefined' && typeof document.querySelector === 'function') ? document.querySelector('.neora-lobby-backdrop') : null;
  if (neoraBackdrop && typeof neoraBackdrop.addEventListener === 'function') neoraBackdrop.addEventListener('click', hideDepartureBoard);

  const neoraHelpBtn = $m('neoraHelpBtn');
  if (neoraHelpBtn) neoraHelpBtn.addEventListener('click', showRulesModal);

  const neoraNotifBtn = $m('neoraNotifBtn');
  if (neoraNotifBtn) {
    neoraNotifBtn.addEventListener('click', () => {
      if (typeof showToast === 'function') showToast('🔔 No new flight notifications.');
    });
  }

  // Guard non-monopoly game tabs with Coming Soon toast
  const allNeoraGameTabs = document.querySelectorAll('.neora-game-tab, .create-game-card');
  if (allNeoraGameTabs && allNeoraGameTabs.forEach) {
    allNeoraGameTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const game = tab.dataset.game;
        if (game && game !== 'monopoly') {
          e.preventDefault();
          e.stopPropagation();
          const title = (tab.querySelector('.game-tab-label, .create-game-name')?.textContent || 'Game').trim();
          if (typeof showToast === 'function') {
            showToast(`🚀 ${title} is coming soon! Stay tuned.`);
          }
          if (window.AudioFX && typeof window.AudioFX.playClick === 'function') {
            window.AudioFX.playClick();
          }
        }
      });
    });
  }

  const boardRefreshBtn = $m('boardRefreshBtn');
  if (boardRefreshBtn) {
    boardRefreshBtn.addEventListener('click', () => {
      if (typeof sendSignaling === 'function') sendSignaling({ type: 'room_browse_start' });
    });
  }

  // Create Room button in Screen 1 -> Switch to View 3 (Create Room)
  const boardHostFlightBtn = $m('boardHostFlightBtn');
  if (boardHostFlightBtn) {
    boardHostFlightBtn.addEventListener('click', () => {
      const activeFlight = getActiveInFlightMatch();
      if (activeFlight) {
        if (confirm('You have a match in progress. Leave current match and host a new room?')) {
          if (typeof abandonActiveFlight === 'function') abandonActiveFlight(activeFlight);
          switchNeoraView('create');
        } else {
          highlightActiveMatchBanner();
        }
        return;
      }
      switchNeoraView('create');
    });
  }

  // Quick Join button in Screen 1
  const neoraQuickJoinBtn = $m('neoraQuickJoinBtn');
  if (neoraQuickJoinBtn) {
    neoraQuickJoinBtn.addEventListener('click', () => {
      const activeFlight = getActiveInFlightMatch();
      if (activeFlight) {
        if (typeof showToast === 'function') {
          showToast('⚠️ You have a match in progress! Rejoining your original room...');
        }
        handleRejoinActiveFlight(activeFlight);
        return;
      }
      if (typeof showToast === 'function') showToast('⚡ Searching for available flights...');
      quickJoinFlightRoom();
    });
  }

  // Back from Room (Screen 2) -> minimizes room to floating widget
  const neoraRoomBackBtn = $m('neoraRoomBackBtn');
  if (neoraRoomBackBtn) neoraRoomBackBtn.addEventListener('click', minimizeFlightRoom);

  const neoraRoomMinimizeBtn = $m('neoraRoomMinimizeBtn');
  if (neoraRoomMinimizeBtn) neoraRoomMinimizeBtn.addEventListener('click', minimizeFlightRoom);

  const neoraLeaveRoomBtn = $m('neoraLeaveRoomBtn');
  if (neoraLeaveRoomBtn) neoraLeaveRoomBtn.addEventListener('click', leaveFlightRoom);

  const neoraTerminateRoomBtn = $m('neoraTerminateRoomBtn');
  if (neoraTerminateRoomBtn) neoraTerminateRoomBtn.addEventListener('click', terminateFlightRoom);

  const monopolyTerminateFlightBtn = $m('monopolyTerminateFlightBtn');
  if (monopolyTerminateFlightBtn) monopolyTerminateFlightBtn.addEventListener('click', terminateFlightRoom);

  // Back from Create Room (Screen 3) -> return to Screen 1
  const neoraCreateBackBtn = $m('neoraCreateBackBtn');
  if (neoraCreateBackBtn) neoraCreateBackBtn.addEventListener('click', () => switchNeoraView('browser'));

  const btnCancelCreateRoom = $m('btnCancelCreateRoom');
  if (btnCancelCreateRoom) btnCancelCreateRoom.addEventListener('click', () => switchNeoraView('browser'));

  // Submit Create Room (Screen 3)
  function submitNeoraCreateRoom() {
    try {
      if (window.AudioFX && typeof window.AudioFX.playClick === 'function') {
        window.AudioFX.playClick();
      }
      const activeFlight = getActiveInFlightMatch();
      if (activeFlight) {
        if (confirm('Leave your previous match and host this new room?')) {
          if (typeof abandonActiveFlight === 'function') abandonActiveFlight(activeFlight);
        } else {
          return;
        }
      }
      const nameInp = $m('createRoomNameInput');
      const descInp = $m('createRoomDescInput');
      const roomName = (nameInp?.value || 'Monopoly · Chill Game').trim();
      const roomDesc = (descInp?.value || 'Relaxed game, make friends! All are welcome ♡').trim();
      const isPublic = !$m('createPrivacyPrivate')?.classList.contains('active');

      const myAvatar = getEquippedCostumeAvatar();
      const myRole = getMonopolyMyRole();
      const hostUid = getPersistentPlayerUid();

      // Read custom slot configurations from Screen 3 (slots 2, 3, 4)
      const customSlots = [
        { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true, occupiedBy: hostUid, name: myAvatar.name, avatar: myAvatar.sprite }
      ];

      const roles = ['dxb', 'bot1', 'bot2'];
      const colors = ['cyan', 'emerald', 'amber'];

      [2, 3, 4].forEach((slotId, idx) => {
        const sel = $m(`createSlot${slotId}Select`);
        const val = sel?.value || (slotId === 2 ? 'open' : (slotId === 3 ? 'hard' : 'easy'));
        const role = roles[idx];
        const color = colors[idx];

        const defaultEasyName = idx === 0 ? 'Cadet Mochi 🐣' : (idx === 1 ? 'Pilot Pip 🐱' : 'Trainee Mochi 🐾');
        const defaultHardName = idx === 0 ? 'Major Whiskers 🐯' : (idx === 1 ? 'Admiral Claw 🦁' : 'Capt. Whiskers 😼');
        const defaultInsaneName = idx === 0 ? 'Astral Sovereign 🌌' : (idx === 1 ? 'Chrono Sovereign ⏳' : 'Apex Sovereign ⚡');

        if (val === 'easy') {
          customSlots.push({
            id: slotId,
            role,
            color,
            type: 'bot',
            difficulty: 'easy',
            ready: true,
            occupiedBy: null,
            name: defaultEasyName,
            avatar: 'assets/ui/neora_ref/avatar_bot_blue.png'
          });
        } else if (val === 'hard') {
          customSlots.push({
            id: slotId,
            role,
            color,
            type: 'bot',
            difficulty: 'hard',
            ready: true,
            occupiedBy: null,
            name: defaultHardName,
            avatar: 'assets/ui/neora_ref/avatar_bot_blue.png'
          });
        } else if (val === 'insane') {
          customSlots.push({
            id: slotId,
            role,
            color,
            type: 'bot',
            difficulty: 'insane',
            ready: true,
            occupiedBy: null,
            name: defaultInsaneName,
            avatar: 'assets/ui/neora_ref/avatar_bot_blue.png'
          });
        } else if (val === 'closed') {
          customSlots.push({
            id: slotId,
            role,
            color,
            type: 'closed',
            difficulty: null,
            ready: false,
            occupiedBy: null,
            name: 'Closed Seat',
            avatar: ''
          });
        } else {
          // Open slot
          customSlots.push({
            id: slotId,
            role,
            color,
            type: 'human',
            difficulty: null,
            ready: false,
            occupiedBy: null,
            name: 'Open Slot',
            avatar: ''
          });
        }
      });

      createFlightRoom(isPublic, roomName, roomDesc, ['Casual', 'Make Friends', 'Voice Chat'], customSlots);
    } catch (err) {
      console.error('[NEORA] submitNeoraCreateRoom error:', err);
    }
  }
  window.submitNeoraCreateRoom = submitNeoraCreateRoom;

  const btnSubmitCreateRoom = $m('btnSubmitCreateRoom');
  if (btnSubmitCreateRoom) {
    btnSubmitCreateRoom.onclick = submitNeoraCreateRoom;
  }

  // Slots 2, 3, 4 unified customization listeners in Create Room
  [2, 3, 4].forEach((slotId) => {
    const sel = $m(`createSlot${slotId}Select`);
    const removeBtn = $m(`createSlot${slotId}RemoveBtn`);
    const circle = $m(`createSlot${slotId}AvatarCircle`);
    const icon = $m(`createSlot${slotId}Icon`);
    const img = $m(`createSlot${slotId}Img`);

    function syncCreateSlotUI() {
      const val = sel?.value || (slotId === 2 ? 'open' : (slotId === 3 ? 'hard' : 'easy'));
      if (val === 'open') {
        if (circle) circle.className = 'slot-avatar-circle';
        if (icon) { icon.textContent = '➕'; icon.classList.remove('hidden'); }
        if (img) img.classList.add('hidden');
      } else if (val === 'closed') {
        if (circle) circle.className = 'slot-avatar-circle closed';
        if (icon) { icon.textContent = '🔒'; icon.classList.remove('hidden'); }
        if (img) img.classList.add('hidden');
      } else {
        // easy, hard, or insane bot
        if (circle) circle.className = (val === 'insane') ? 'slot-avatar-circle bot insane' : 'slot-avatar-circle bot';
        if (icon) icon.classList.add('hidden');
        if (img) img.classList.remove('hidden');
      }
    }

    if (sel) sel.addEventListener('change', syncCreateSlotUI);
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sel) {
          sel.value = 'open';
          syncCreateSlotUI();
          if (typeof showToast === 'function') showToast(`Slot ${slotId} set to Open Slot`);
        }
      });
    }
    syncCreateSlotUI();
  });

  // Privacy options cards in Create Room
  const privOpen = $m('createPrivacyOpen');
  const privPrivate = $m('createPrivacyPrivate');
  if (privOpen && privPrivate) {
    privOpen.addEventListener('click', () => {
      privOpen.classList.add('active');
      privPrivate.classList.remove('active');
    });
    privPrivate.addEventListener('click', () => {
      privPrivate.classList.add('active');
      privOpen.classList.remove('active');
    });
  }

  // Slot Configuration Popover in Screen 2 (Waiting Room)
  initNeoraSlotConfigPopover();

  // In-Room Chat Send & Enter
  const chatSendBtn = $m('chatSendBtn');
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendNeoraChatMessage);

  const chatTextInput = $m('chatTextInput');
  if (chatTextInput) {
    chatTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendNeoraChatMessage();
      }
    });
  }

  // Quick Emoji Picker
  initNeoraEmojiPicker();

  // In-Room Auto Fill switch
  const autoFillToggle = $m('autoFillToggle');
  if (autoFillToggle) autoFillToggle.addEventListener('change', toggleNeoraAutoFill);

  // In-Room Start Game / Ready CTA
  const neoraStartGameBtn = $m('neoraStartGameBtn');
  if (neoraStartGameBtn) neoraStartGameBtn.addEventListener('click', startNeoraRoomGame);

  // Room ID Copy buttons
  const roomBannerIdBtn = $m('roomBannerIdBtn');
  if (roomBannerIdBtn) roomBannerIdBtn.addEventListener('click', copyFlightCode);

  const neoraShareRoomBtn = $m('neoraShareRoomBtn');
  if (neoraShareRoomBtn) neoraShareRoomBtn.addEventListener('click', copyFlightCode);

  const neoraRoomSettingsBtn = $m('neoraRoomSettingsBtn');
  if (neoraRoomSettingsBtn) {
    neoraRoomSettingsBtn.addEventListener('click', () => {
      if (typeof showToast === 'function') showToast('Room Voice Chat & Settings active.');
    });
  }

  const boardCodeToggleBtn = $m('boardCodeToggleBtn');
  const flightCodeDrawer = $m('flightCodeDrawer');
  if (boardCodeToggleBtn && flightCodeDrawer) {
    boardCodeToggleBtn.addEventListener('click', () => {
      flightCodeDrawer.classList.toggle('hidden');
      if (!flightCodeDrawer.classList.contains('hidden')) {
        const inp = $m('flightCodeInput');
        if (inp) inp.focus();
      }
    });
  }

  const btnBoardWithCode = $m('btnBoardWithCode');
  if (btnBoardWithCode) {
    btnBoardWithCode.addEventListener('click', () => {
      const inp = $m('flightCodeInput');
      if (inp) joinFlightByCode(inp.value);
    });
  }

  const flightCodeInput = $m('flightCodeInput');
  if (flightCodeInput) {
    flightCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinFlightByCode(flightCodeInput.value);
      }
    });
  }

  const lobbyFlightCodeBtn = $m('lobbyFlightCodeBtn');
  if (lobbyFlightCodeBtn) lobbyFlightCodeBtn.addEventListener('click', copyFlightCode);

  const departureSearchInput = $m('departureSearchInput');
  if (departureSearchInput) {
    departureSearchInput.addEventListener('input', (e) => {
      departureBoardSearch = e.target.value;
      renderDepartureBoard();
    });
  }

  const neoraSortSelect = $m('neoraSortSelect');
  if (neoraSortSelect) {
    neoraSortSelect.addEventListener('change', (e) => {
      departureBoardSort = e.target.value;
      renderDepartureBoard();
    });
  }

  // Filter Chips in Screen 1
  const filterMap = [
    { id: 'filterPillAll', key: 'all' },
    { id: 'filterPillBoarding', key: 'open' },
    { id: 'filterPillInFlight', key: 'playing' },
    { id: 'filterPillClose', key: 'close' }
  ];
  filterMap.forEach(({ id, key }) => {
    const chip = $m(id);
    if (chip) {
      chip.addEventListener('click', () => {
        departureBoardFilter = key;
        filterMap.forEach((m2) => {
          const c2 = $m(m2.id);
          if (c2) c2.classList.toggle('active', m2.key === key);
        });
        renderDepartureBoard();
      });
    }
  });

  // Lobby mode selector tabs
  ['4p', 'couple', 'bot'].forEach((mode) => {
    const tabId = mode === '4p' ? 'tabMode4p' : mode === 'couple' ? 'tabModeCouple' : 'tabModeBot';
    const tab = $m(tabId);
    if (tab) {
      const onModeTap = (e) => {
        if (e && e.type === 'touchend') e.preventDefault();
        lobbyState.mode = mode;
        lobbyState.slots = getDefaultLobbySlots(mode);
        updateLobbyUI();
        broadcastLobbyState();
      };
      tab.addEventListener('click', onModeTap);
      tab.addEventListener('touchend', onModeTap, { passive: false });
    }
  });

  // Ready button for host/user
  const readyBtn = $m('lobbySeatBkkReadyBtn');
  if (readyBtn) {
    const onReadyTap = (e) => {
      if (e && e.type === 'touchend') e.preventDefault();
      const role = getMonopolyMyRole();
      lobbyState.ready[role] = !lobbyState.ready[role];
      updateLobbyUI();
      broadcastLobbyState();
    };
    readyBtn.addEventListener('click', onReadyTap);
    readyBtn.addEventListener('touchend', onReadyTap, { passive: false });
  }

  // Host Slot Cyclers for Seat 2 (DXB), Seat 3 (Bot1), Seat 4 (Bot2)
  [2, 3, 4].forEach((slotId) => {
    const cycleBtn = $m(`lobbySlotCycleBtn${slotId}`);
    const card = $m(slotId === 2 ? 'lobbySeatDxb' : slotId === 3 ? 'lobbySeatBot1' : 'lobbySeatBot2');
    const onCycle = (e) => {
      if (e && e.target && e.target.tagName === 'SELECT') return;
      if (e && e.type === 'touchend') e.preventDefault();
      cycleLobbySlot(slotId);
    };
    if (cycleBtn) {
      cycleBtn.addEventListener('click', onCycle);
      cycleBtn.addEventListener('touchend', onCycle, { passive: false });
    }
    if (card) {
      card.addEventListener('click', (e) => {
        if (e.target && (e.target.id === `lobbySlotCycleBtn${slotId}` || e.target.closest(`#lobbySlotCycleBtn${slotId}`))) return;
        if (e.target && e.target.tagName === 'SELECT') return;
        onCycle(e);
      });
    }
  });

  // Backward-compatibility bot select dropdowns
  const b1Select = $m('lobbyBot1DiffSelect');
  if (b1Select) {
    b1Select.addEventListener('change', (e) => {
      const slot3 = lobbyState.slots?.find(s => s.id === 3);
      if (slot3) {
        if (e.target.value === 'closed') { slot3.type = 'closed'; slot3.difficulty = null; }
        else { slot3.type = 'bot'; slot3.difficulty = e.target.value; }
      }
      lobbyState.bot1 = e.target.value;
      updateLobbyUI();
      broadcastLobbyState();
    });
  }
  const b2Select = $m('lobbyBot2DiffSelect');
  if (b2Select) {
    b2Select.addEventListener('change', (e) => {
      const slot4 = lobbyState.slots?.find(s => s.id === 4);
      if (slot4) {
        if (e.target.value === 'closed') { slot4.type = 'closed'; slot4.difficulty = null; }
        else { slot4.type = 'bot'; slot4.difficulty = e.target.value; }
      }
      lobbyState.bot2 = e.target.value;
      updateLobbyUI();
      broadcastLobbyState();
    });
  }

  // Launch CTA
  const launchBtn = $m('btnLaunchMonopolyGame');
  if (launchBtn) {
    const onLaunchTap = (e) => {
      if (e && e.type === 'touchend') e.preventDefault();
      startPartyGame(lobbyState);
    };
    launchBtn.addEventListener('click', onLaunchTap);
    launchBtn.addEventListener('touchend', onLaunchTap, { passive: false });
  }

  if (rollBtn) {
    rollBtn.addEventListener('click', handleUserRollRequest);
    rollBtn.addEventListener('touchend', handleUserRollRequest, { passive: false });
  }
  if (diceBox) {
    diceBox.addEventListener('click', handleUserRollRequest);
    diceBox.addEventListener('touchend', handleUserRollRequest, { passive: false });
  }

  const ultBtn = $m('monopolyUltBtn');
  if (ultBtn) {
    const onUltTap = (e) => {
      if (e && e.type === 'touchend') e.preventDefault();
      const me = getMonopolyMyRole();
      const st = monopolyState;
      if (!st || !st.active || st.gameOver) return;
      if (st.isRolling || isAnimating) {
        setMonopolyTicker('⏳ Flight route animation in progress… please wait a moment!');
        return;
      }
      const p = st.players && st.players[me];
      const ultData = getRoleUltimate(me);
      if (st.currentTurn !== me) {
        const myUlt = Math.round(p?.ult || 0);
        floatText(p?.pos != null ? p.pos : 0, myUlt >= 100 ? `⚡ ${ultData.title.split(' ')[0]} Ready!` : `⚡ ${myUlt}%`, 'pos');
        setMonopolyTicker(myUlt >= 100
          ? `⏳ <strong>${ultData.title} (100% Ready)!</strong> It unlocks to unleash when it's your turn!`
          : `⏳ <strong>${ultData.title}</strong> (${myUlt}% / 100%): ${ultData.desc}`);
        if (navigator.vibrate) navigator.vibrate(25);
        if (window.gsap) gsap.fromTo(ultBtn, { scale: 0.94 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1.2, 0.4)' });
        return;
      }
      if (!p || (p.ult || 0) < 100) {
        const cur = Math.round(p?.ult || 0);
        floatText(p?.pos != null ? p.pos : 0, `⚡ ${cur}%: ${ultData.title.split(' ')[0]}`, 'pos');
        setMonopolyTicker(`⚡ <strong>${ultData.title}</strong> (${cur}% / 100%): ${ultData.desc}`);
        if (navigator.vibrate) navigator.vibrate(20);
        if (window.gsap) gsap.fromTo(ultBtn, { scale: 0.94 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1.2, 0.4)' });
        return;
      }
      executeUltimate(me);
    };
    ultBtn.addEventListener('click', onUltTap);
    ultBtn.addEventListener('touchend', onUltTap, { passive: false });
  }

  [0, 1].forEach((i) => {
    const slot = $m(`monopolyItemSlot${i}`);
    if (slot) slot.addEventListener('click', () => openItemInfo(i));
  });

  // Tap a player card to switch which character this phone controls (recovery tool)
  ['bkk', 'dxb'].forEach((role) => {
    const card = $m(role === 'bkk' ? 'monopolyPlayerCardBkk' : 'monopolyPlayerCardDxb');
    if (!card) return;
    card.addEventListener('click', () => {
      if (getMonopolyMyRole() === role) return;
      if (!window.confirm(`Control ${monopolyState.players[role].name} on this phone? Only do this if the game picked the wrong player.`)) return;
      manualRoleOverride = role;
      setMonopolyTicker(`🎮 You are now controlling <strong>${monopolyState.players[role].name}</strong>.`);
      renderAll();
    });
  });

  // Presence watcher: updates HUD and pause banner only when state transitions
  let lastAwayFlag = false;
  let lastWatchedTurn = null;
  let lastWatchedRound = null;
  setInterval(() => {
    const modal = $m('monopolyModal');
    if (!modal || modal.classList.contains('hidden') || document.hidden) return;
    const away = partnerAway();
    const st = monopolyState;
    const curTurn = st ? st.currentTurn : null;
    const curRound = st ? st.round : null;
    if (away !== lastAwayFlag || curTurn !== lastWatchedTurn || curRound !== lastWatchedRound) {
      lastAwayFlag = away;
      lastWatchedTurn = curTurn;
      lastWatchedRound = curRound;
      updateMonopolyHUD();
      reconcileOverlays();
    }
    // Bot watchdog: if it's currently an AI bot's turn and no roll or animation is active, schedule roll
    if (st && st.active && !st.gameOver && st.players && st.players[st.currentTurn]?.isBot) {
      if (!st.isRolling && !isAnimating && !botActionTimer && isResolver()) {
        checkBotTurn();
      }
    }
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      AudioFX.suspend();
    } else {
      AudioFX.resume();
    }
  });

  renderDiceFace(1);

  if (monopolyState && monopolyState.mode === 'bot' && monopolyState.active && !monopolyState.gameOver && monopolyState.currentTurn === monopolyState.bot?.role) {
    checkBotTurn();
  }
}

function openMonopolyGame(broadcast = true) {
  AudioFX.init();
  const modal = $m('monopolyModal');
  if (!modal) return;

  document.body?.classList.add('has-active-modal');
  modal.classList.remove('hidden');
  void modal.offsetWidth;
  modal.classList.add('active');
  monopolyState.active = true;
  window.isMonopolyPlayerAway = false;

  if (currentFlightRoom && typeof sendSignaling === 'function') {
    const myUid = getPersistentPlayerUid();
    const mySlot = currentFlightRoomSlot || (currentFlightRoom.slots || []).find((s) => s.occupiedBy && (s.occupiedBy === myUid || s.occupiedBy === `user_${myUid}`));
    if (mySlot && (mySlot.controller === 'BOT_TEMPORARY' || !mySlot.connected)) {
      sendSignaling({
        type: 'room_rejoin',
        roomId: currentFlightRoom.id,
        uid: myUid
      });
    }
  }

  if (window.SkyPixi && typeof window.SkyPixi.init === 'function') {
    window.SkyPixi.init().then(() => {
      if (window.SkyPixi.resize) window.SkyPixi.resize();
    }).catch(() => {});
  }

  // Sync avatar costumes & sprites with current selections
  syncMonopolyCostumes();
  if (monopolyState.mode !== 'bot' && typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_request_sync' });
  }

  const hasGame = monopolyState && monopolyState.active && !monopolyState.gameOver && monopolyState.currentTurn && monopolyState.turnOrder && monopolyState.turnOrder.length > 0;
  if (!hasGame) {
    if (monopolyState) monopolyState.gameOver = null;
    hideVictory();
    showMonopolyLobby();
  } else {
    hideMonopolyLobby();
  }

  renderAll({ instant: true });
  saveLocalMonopolyState();

  if (monopolyState.mode !== 'bot' && broadcast && typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_open', state: monopolyState });
  }

  if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
    checkBotTurn();
  }
}

function closeMonopolyGame(broadcast = true) {
  if (!monopolyState?.gameOver) {
    const activeMatch = getActiveInFlightMatch();
    if (activeMatch) {
      handleMonopolyExitGame();
      return;
    }
  }
  const modal = $m('monopolyModal');
  if (!modal) return;
  document.body?.classList.remove('has-active-modal');
  modal.classList.remove('active');
  setTimeout(() => modal.classList.add('hidden'), 300);
  monopolyState.active = false;
  if (monopolyState && monopolyState.gameOver) {
    monopolyState.gameOver = null;
    hideVictory();
    if (currentFlightRoom) {
      if (typeof sendSignaling === 'function') {
        sendSignaling({ type: 'room_match_finished', roomId: currentFlightRoom.id || currentFlightRoom.roomId });
      }
      currentFlightRoom = null;
      currentFlightRoomIsHost = false;
      currentFlightRoomSlot = null;
    }
    sessionStorage.removeItem('neora_active_room_id');
    localStorage.removeItem('nook_sky_monopoly_room_v1');
  }
  if (AudioFX && AudioFX.suspend) AudioFX.suspend();
  saveLocalMonopolyState();
  if (monopolyState.mode !== 'bot' && broadcast && typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_close', state: monopolyState });
  }
}

function startBotGame(level = 'hard') {
  manualRoleOverride = null;
  window.isMonopolyPlayerAway = false;
  if (typeof clearBotTimer === 'function') clearBotTimer();
  const myRole = getMonopolyMyRole();
  const botRole = otherRole(myRole);
  const isEasy = (level === 'easy');
  const isInsane = (level === 'insane');
  const botName = isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼';
  const botSprite = isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg';
  const botColor = isEasy ? '#10b981' : isInsane ? '#a855f7' : '#f59e0b';
  const botBadge = isEasy ? 'MOCHI' : isInsane ? 'SOVEREIGN' : 'WHISKERS';

  if (level === 'hard' || level === 'insane') {
    const myProfile = window.NookVault && window.NookVault.getMyProfile ? window.NookVault.getMyProfile() : null;
    const diamonds = myProfile?.diamonds || 0;
    const stats = myProfile?.botStats;
    const stake = level === 'insane' ? 150 : ((stats?.hardLossStreak >= 2) ? 50 : 100);
    if (diamonds < stake) {
      if (window.NookVault && window.NookVault.toast) {
        window.NookVault.toast(`⚠️ Need ${stake}💎 to enter ${level.toUpperCase()} mode (you have ${diamonds}💎)`);
      } else {
        alert(`Need ${stake}💎 to enter ${level.toUpperCase()} mode (you have ${diamonds}💎)`);
      }
      return;
    }
  }

  if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') window.SkyPixi.clearAll();
  const fresh = createDefaultMonopolyState();
  fresh.mode = 'bot';
  fresh.turnOrder = [myRole, botRole];
  fresh.bot = {
    level,
    role: botRole,
    name: botName,
    sessionId: `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    startedAt: Date.now()
  };
  fresh.active = true;
  fresh.round = 1;
  fresh.currentTurn = fresh.turnOrder[0] || 'bkk';

  // Human player
  fresh.players[myRole].name = window.myAvatar?.name || fresh.players[myRole].name;
  fresh.players[myRole].sprite = myVaultSprite() || window.myAvatar?.sprite || fresh.players[myRole].sprite;
  fresh.players[myRole].isBot = false;

  // Bot player
  fresh.players[botRole].name = botName;
  fresh.players[botRole].sprite = botSprite;
  fresh.players[botRole].badge = botBadge;
  fresh.players[botRole].color = botColor;
  fresh.players[botRole].isBot = true;
  fresh.players[botRole].botLevel = level;

  // Perks: easy and hard get NONE. Insane bot gets a random Mythic identity + perks!
  fresh.gameId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const perks = (window.NookVault && window.NookVault.monopolyPerks) ? window.NookVault.monopolyPerks() : null;
  fresh.perks = perks ? { [myRole]: perks[myRole] || {} } : {};
  fresh.perkUsed = {};

  if (isInsane) {
    const mythicId = (window.NookMonoBot && typeof window.NookMonoBot.getRandomMythicId === 'function')
      ? window.NookMonoBot.getRandomMythicId()
      : 's6_supernova_m';
    fresh.players[botRole].costume = mythicId;
    fresh.players[botRole].activeCostume = mythicId;

    const C = window.NookCostumes;
    if (C && C.BY_ID && C.BY_ID[mythicId]) {
      const c = C.BY_ID[mythicId];
      const perkKey = c.perk;
      const perkData = (C.PERKS && C.PERKS[perkKey]) || {};
      fresh.perks[botRole] = { costume: mythicId, [perkKey]: true, ...perkData };
      if (c.sprite) fresh.players[botRole].sprite = c.sprite;
    }
  }

  if (fresh.perks && fresh.perks[myRole]) {
    const pk = fresh.perks[myRole];
    const pl = fresh.players[myRole];
    if (pk.startMiles) pl.miles += pk.startMiles;
    if (pk.startItem && ITEMS[pk.startItem] && pl.inventory.length < MONO_CFG.MAX_ITEMS) pl.inventory.push(pk.startItem);
    if (pk.reverseRentHex || isPhantomRoyalty(myRole)) pl.phantomRentReversals = 2;
  }
  if (isInsane && fresh.perks && fresh.perks[botRole]) {
    const bpk = fresh.perks[botRole];
    const bpl = fresh.players[botRole];
    if (bpk.startMiles) bpl.miles += bpk.startMiles;
    if (bpk.startItem && ITEMS[bpk.startItem] && bpl.inventory.length < MONO_CFG.MAX_ITEMS) bpl.inventory.push(bpk.startItem);
    if (bpk.reverseRentHex || isPhantomRoyalty(botRole)) bpl.phantomRentReversals = 2;
  }
  if (level === 'hard') {
    // Capt. Whiskers veteran captain starter kit (Strictly Zero skills & Zero ultimates)
    fresh.players[botRole].miles += 200;
    if (fresh.players[botRole].inventory.length < MONO_CFG.MAX_ITEMS) {
      fresh.players[botRole].inventory.push('shield');
    }
  }

  monopolyState = fresh;
  if (currentFlightRoom) {
    currentFlightRoom.gameState = fresh;
    if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'room_start',
        roomId: currentFlightRoom.id,
        initialState: fresh
      });
    }
  }
  saveLocalMonopolyState();
  hideMonopolyLobby();
  const modal = $m('monopolyModal');
  if (modal) {
    document.body?.classList.add('has-active-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
  hideModal();
  hideCardOverlay();
  hideVictory();
  cleanBoardVisualsForNewGame();
  renderAll({ instant: true });

  const greeting = isEasy ? 'Purrrr! Ready for flight training!' : (window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'buy') : 'Ready for take-off!');
  setMonopolyTicker(`🤖 Match started vs <strong>${botName}</strong> (${level.toUpperCase()})! "${greeting}"`);

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'vault_bot_start',
      level,
      sessionId: fresh.bot.sessionId,
      reqId: Date.now().toString(36)
    });
  }

  if (fresh.players[fresh.currentTurn]?.isBot) {
    checkBotTurn();
  }
}

function getDefaultLobbySlots(mode = '4p', currentLobby) {
  const cur = currentLobby || null;
  if (mode === 'bot') {
    const soloDiff = cur?.soloBot || 'hard';
    return [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true },
      { id: 2, role: 'dxb', color: 'cyan', type: 'bot', difficulty: soloDiff, ready: true },
      { id: 3, role: 'bot1', color: 'emerald', type: 'closed', difficulty: null, ready: false },
      { id: 4, role: 'bot2', color: 'amber', type: 'closed', difficulty: null, ready: false }
    ];
  }
  if (mode === 'couple') {
    return [
      { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true },
      { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false },
      { id: 3, role: 'bot1', color: 'emerald', type: 'closed', difficulty: null, ready: false },
      { id: 4, role: 'bot2', color: 'amber', type: 'closed', difficulty: null, ready: false }
    ];
  }
  return [
    { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true },
    { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false },
    { id: 3, role: 'bot1', color: 'emerald', type: 'bot', difficulty: cur?.bot1 || 'easy', ready: true },
    { id: 4, role: 'bot2', color: 'amber', type: 'bot', difficulty: cur?.bot2 || 'hard', ready: true }
  ];
}

let lobbyState = {
  mode: '4p',
  bot1: 'easy',
  bot2: 'hard',
  soloBot: 'hard',
  ready: { bkk: true, dxb: false },
  slots: null
};
lobbyState.slots = getDefaultLobbySlots('4p', lobbyState);

function cycleLobbySlot(slotId) {
  if (slotId === 1) return; // Slot 1 is permanently Host
  if (!Array.isArray(lobbyState.slots) || lobbyState.slots.length !== 4) {
    lobbyState.slots = getDefaultLobbySlots(lobbyState.mode);
  }
  const slot = lobbyState.slots.find((s) => s.id === slotId);
  if (!slot) return;

  // Universal cycle sequence: human (open) -> bot (easy) -> bot (hard) -> bot (insane) -> closed -> human (open)
  if (slot.type === 'human') {
    slot.type = 'bot';
    slot.difficulty = 'easy';
  } else if (slot.type === 'bot' && slot.difficulty === 'easy') {
    slot.type = 'bot';
    slot.difficulty = 'hard';
  } else if (slot.type === 'bot' && slot.difficulty === 'hard') {
    slot.type = 'bot';
    slot.difficulty = 'insane';
  } else if (slot.type === 'bot' && slot.difficulty === 'insane') {
    slot.type = 'closed';
    slot.difficulty = null;
  } else {
    slot.type = 'human';
    slot.difficulty = null;
  }

  // Update legacy synchronization fields
  if (slotId === 2) {
    if (slot.type === 'bot') lobbyState.soloBot = slot.difficulty;
  } else if (slotId === 3) {
    lobbyState.bot1 = slot.type === 'closed' ? 'closed' : (slot.difficulty || 'easy');
  } else if (slotId === 4) {
    lobbyState.bot2 = slot.type === 'closed' ? 'closed' : (slot.difficulty || 'hard');
  }

  // Check matching mode preset
  const activeCount = lobbyState.slots.filter((s) => s.type !== 'closed').length;
  if (activeCount === 2 && lobbyState.slots[1].type === 'human' && lobbyState.slots[2].type === 'closed' && lobbyState.slots[3].type === 'closed') {
    lobbyState.mode = 'couple';
  } else if (activeCount === 2 && lobbyState.slots[1].type === 'bot' && lobbyState.slots[2].type === 'closed' && lobbyState.slots[3].type === 'closed') {
    lobbyState.mode = 'bot';
  } else if (activeCount === 4 && lobbyState.slots[1].type === 'human' && lobbyState.slots[2].type === 'bot' && lobbyState.slots[3].type === 'bot') {
    lobbyState.mode = '4p';
  } else {
    lobbyState.mode = 'custom';
  }

  if (typeof AudioFX !== 'undefined' && AudioFX.playClick) {
    AudioFX.playClick();
  }
  updateLobbyUI();
  broadcastLobbyState();
}

function showMonopolyLobby() {
  hideVictory();
  hideModal();
  const modal = $m('monopolyModal');
  if (modal) {
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('active');
  }
  const screen = $m('monopolyLobbyScreen');
  if (!screen) return;
  screen.classList.remove('hidden');
  updateLobbyUI();
}

function hideMonopolyLobby() {
  const screen = $m('monopolyLobbyScreen');
  if (screen) screen.classList.add('hidden');
}

function updateLobbyUI() {
  const myRole = getMonopolyMyRole();
  const partnerRole = otherRole(myRole);

  if (!Array.isArray(lobbyState.slots) || lobbyState.slots.length !== 4) {
    lobbyState.slots = getDefaultLobbySlots(lobbyState.mode);
  }

  ['4p', 'couple', 'bot'].forEach((m) => {
    const tab = $m(`tabMode${m === '4p' ? '4p' : m === 'couple' ? 'Couple' : 'Bot'}`);
    if (tab) tab.classList.toggle('active', lobbyState.mode === m);
  });

  const bkkImg = $m('lobbySeatBkkImg');
  const dxbImg = $m('lobbySeatDxbImg');
  const bkkName = $m('lobbySeatBkkName');
  const dxbName = $m('lobbySeatDxbName');
  const bkkCostume = $m('lobbySeatBkkCostume');
  const dxbCostume = $m('lobbySeatDxbCostume');
  const seatDxb = $m('lobbySeatDxb');
  const seatBot1 = $m('lobbySeatBot1');
  const seatBot2 = $m('lobbySeatBot2');
  const cycleBtn2 = $m('lobbySlotCycleBtn2');
  const cycleBtn3 = $m('lobbySlotCycleBtn3');
  const cycleBtn4 = $m('lobbySlotCycleBtn4');

  const C = window.NookCostumes;
  const profiles = window.NookVault && window.NookVault.getProfiles ? window.NookVault.getProfiles() : null;

  // Resolve active avatar, decoupled from fixed role / gender
  const myAvatarData = window.getMyAvatar ? window.getMyAvatar() : null;
  const partnerAvatarData = window.getPartnerAvatar ? window.getPartnerAvatar() : null;

  const myName = myAvatarData?.name || 'Lord of BKK 🐺';
  const partnerName = partnerAvatarData?.name || 'Khaleesi 🐉';

  const mySprite = myAvatarData?.sprite || myVaultSprite() || 'assets/bkk_warrior_idle.png';
  const partnerSprite = partnerAvatarData?.sprite || partnerVaultSprite() || 'assets/got_queen_idle.png';

  const myCostumeId = myAvatarData?.characterId
    || (profiles && profiles[myRole]?.equipped)
    || (profiles && profiles[myRole]?.equippedCostume)
    || (window.NookVault?.equippedOf ? window.NookVault.equippedOf(myRole) : null);

  const partnerCostumeId = partnerAvatarData?.characterId
    || (profiles && profiles[partnerRole]?.equipped)
    || (profiles && profiles[partnerRole]?.equippedCostume)
    || (window.NookVault?.equippedOf ? window.NookVault.equippedOf(partnerRole) : null);

  // --- SEAT 1: HOST / YOU ---
  if (bkkImg && mySprite) bkkImg.src = mySprite;
  if (bkkName) bkkName.textContent = myName;
  if (bkkCostume) {
    bkkCostume.textContent = (myCostumeId && (C?.BY_ID[myCostumeId]?.name || window.MAPLE_CHARACTERS?.[myCostumeId]?.name)) || 'First Class Pilot';
  }
  const bkkReadyBtn = $m('lobbySeatBkkReadyBtn');
  if (bkkReadyBtn) {
    const isReady = !!lobbyState.ready[myRole];
    bkkReadyBtn.className = `seat-ready-btn ${isReady ? 'is-ready' : ''}`;
    bkkReadyBtn.innerHTML = isReady ? '<span>✅ READY</span>' : '<span>⏳ TAP READY</span>';
  }

  // --- SEAT 2: GUEST / BOT / CLOSED ---
  const s2 = lobbyState.slots.find((s) => s.id === 2);
  const dxbStatus = $m('lobbySeatDxbStatus');
  const dxbPill = $m('lobbySeatDxbRolePill') || seatDxb?.querySelector('.seat-role-pill');

  if (s2) {
    if (s2.type === 'closed') {
      if (seatDxb) seatDxb.classList.add('seat-closed-mode');
      if (dxbName) dxbName.textContent = 'Seat 1B (Closed)';
      if (dxbCostume) dxbCostume.textContent = 'Seat Locked';
      if (dxbPill) { dxbPill.className = 'seat-role-pill'; dxbPill.textContent = '❌ Closed'; }
      if (dxbStatus) { dxbStatus.className = 'seat-status-pill closed'; dxbStatus.innerHTML = '<span>❌ Closed</span>'; }
      if (cycleBtn2) { cycleBtn2.className = 'seat-cycle-btn cycle-closed'; cycleBtn2.innerHTML = '<span>🔁 Open Seat</span>'; }
    } else if (s2.type === 'bot') {
      if (seatDxb) seatDxb.classList.remove('seat-closed-mode');
      const isEasy = s2.difficulty === 'easy';
      const isInsane = s2.difficulty === 'insane';
      if (dxbImg) dxbImg.src = isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg';
      if (dxbName) dxbName.textContent = isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼';
      if (dxbCostume) dxbCostume.textContent = isEasy ? 'Playful AI · Zero Skills' : isInsane ? 'Mythic Power · Ultimate Ability' : 'Zone Strategist · Uses Items';
      if (dxbPill) {
        dxbPill.className = isEasy ? 'seat-role-pill bot-pill-easy' : isInsane ? 'seat-role-pill bot-pill-insane' : 'seat-role-pill bot-pill-hard';
        dxbPill.textContent = isEasy ? '🐣 Bot: Easy' : isInsane ? '⚡ Bot: Insane' : '😈 Bot: Hard';
      }
      if (dxbStatus) {
        dxbStatus.className = 'seat-status-pill ready';
        dxbStatus.innerHTML = isEasy ? '<span>🟢 Bot Ready</span>' : isInsane ? '<span>⚡ Bot Ready</span>' : '<span>🔴 Bot Ready</span>';
      }
      if (cycleBtn2) {
        cycleBtn2.className = isEasy ? 'seat-cycle-btn cycle-bot-easy' : isInsane ? 'seat-cycle-btn cycle-bot-insane' : 'seat-cycle-btn cycle-bot-hard';
        cycleBtn2.innerHTML = isEasy ? '<span>🔁 Cycle: Hard Bot</span>' : isInsane ? '<span>🔁 Cycle: Closed</span>' : '<span>🔁 Cycle: Insane Bot</span>';
      }
    } else {
      // Human slot
      if (seatDxb) seatDxb.classList.remove('seat-closed-mode');
      if (dxbImg && partnerSprite) dxbImg.src = partnerSprite;
      const away = partnerAway();
      const partnerReady = !!lobbyState.ready[partnerRole];
      if (dxbName) dxbName.textContent = partnerName;
      if (dxbCostume) {
        dxbCostume.textContent = (partnerCostumeId && (C?.BY_ID[partnerCostumeId]?.name || window.MAPLE_CHARACTERS?.[partnerCostumeId]?.name)) || 'First Officer Uniform';
      }
      if (dxbPill) { dxbPill.className = 'seat-role-pill'; dxbPill.textContent = '🌸 First Officer'; }
      if (dxbStatus) {
        dxbStatus.className = `seat-status-pill ${partnerReady && !away ? 'ready' : ''}`;
        dxbStatus.innerHTML = away
          ? '<span>💤 In Cabin</span>'
          : (partnerReady ? '<span>🟢 Ready to Board</span>' : '<span>✈️ In Lobby</span>');
      }
      if (cycleBtn2) { cycleBtn2.className = 'seat-cycle-btn cycle-open'; cycleBtn2.innerHTML = '<span>🔁 Cycle: Bot</span>'; }
    }
  }

  // --- SEAT 3: BOT 1 / GUEST 3 / CLOSED ---
  const s3 = lobbyState.slots.find((s) => s.id === 3);
  const bot1Img = $m('lobbySeatBot1Img');
  const bot1Name = $m('lobbySeatBot1Name');
  const bot1Desc = $m('lobbySeatBot1Desc');
  const bot1Pill = $m('lobbySeatBot1RolePill') || seatBot1?.querySelector('.seat-role-pill');

  if (s3) {
    if (s3.type === 'closed') {
      if (seatBot1) seatBot1.classList.add('seat-closed-mode');
      if (bot1Name) bot1Name.textContent = 'Seat 2A (Closed)';
      if (bot1Desc) bot1Desc.textContent = 'Seat Locked';
      if (bot1Pill) { bot1Pill.className = 'seat-role-pill'; bot1Pill.textContent = '❌ Closed'; }
      if (cycleBtn3) { cycleBtn3.className = 'seat-cycle-btn cycle-closed'; cycleBtn3.innerHTML = '<span>🔁 Open Seat</span>'; }
    } else if (s3.type === 'bot') {
      if (seatBot1) seatBot1.classList.remove('seat-closed-mode');
      const isEasy = s3.difficulty === 'easy';
      const isInsane = s3.difficulty === 'insane';
      if (bot1Img) bot1Img.src = isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg';
      if (bot1Name) bot1Name.textContent = isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼';
      if (bot1Desc) bot1Desc.textContent = isEasy ? 'Playful AI · Zero Skills' : isInsane ? 'Mythic Power · Ultimate Ability' : 'Zone Strategist · Uses Items';
      if (bot1Pill) {
        bot1Pill.className = isEasy ? 'seat-role-pill bot-pill-easy' : isInsane ? 'seat-role-pill bot-pill-insane' : 'seat-role-pill bot-pill-hard';
        bot1Pill.textContent = isEasy ? '🐣 Co-Pilot (Easy)' : isInsane ? '⚡ Sovereign (Insane)' : '😈 Rival (Hard)';
      }
      if (cycleBtn3) {
        cycleBtn3.className = isEasy ? 'seat-cycle-btn cycle-bot-easy' : isInsane ? 'seat-cycle-btn cycle-bot-insane' : 'seat-cycle-btn cycle-bot-hard';
        cycleBtn3.innerHTML = isEasy ? '<span>🔁 Cycle: Hard Bot</span>' : isInsane ? '<span>🔁 Cycle: Closed</span>' : '<span>🔁 Cycle: Insane Bot</span>';
      }
    } else {
      // Human open
      if (seatBot1) seatBot1.classList.remove('seat-closed-mode');
      if (bot1Img) bot1Img.src = 'assets/bkk_warrior_idle.png';
      if (bot1Name) bot1Name.textContent = 'Open for Guest 3 🌐';
      if (bot1Desc) bot1Desc.textContent = 'Waiting for passenger...';
      if (bot1Pill) { bot1Pill.className = 'seat-role-pill'; bot1Pill.textContent = '🌐 Open Seat'; }
      if (cycleBtn3) { cycleBtn3.className = 'seat-cycle-btn cycle-open'; cycleBtn3.innerHTML = '<span>🔁 Cycle: Bot</span>'; }
    }
  }

  // --- SEAT 4: BOT 2 / GUEST 4 / CLOSED ---
  const s4 = lobbyState.slots.find((s) => s.id === 4);
  const bot2Img = $m('lobbySeatBot2Img');
  const bot2Name = $m('lobbySeatBot2Name');
  const bot2Desc = $m('lobbySeatBot2Desc');
  const bot2Pill = $m('lobbySeatBot2RolePill') || seatBot2?.querySelector('.seat-role-pill');

  if (s4) {
    if (s4.type === 'closed') {
      if (seatBot2) seatBot2.classList.add('seat-closed-mode');
      if (bot2Name) bot2Name.textContent = 'Seat 2B (Closed)';
      if (bot2Desc) bot2Desc.textContent = 'Seat Locked';
      if (bot2Pill) { bot2Pill.className = 'seat-role-pill'; bot2Pill.textContent = '❌ Closed'; }
      if (cycleBtn4) { cycleBtn4.className = 'seat-cycle-btn cycle-closed'; cycleBtn4.innerHTML = '<span>🔁 Open Seat</span>'; }
    } else if (s4.type === 'bot') {
      if (seatBot2) seatBot2.classList.remove('seat-closed-mode');
      const isEasy = s4.difficulty === 'easy';
      const isInsane = s4.difficulty === 'insane';
      if (bot2Img) bot2Img.src = isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg';
      if (bot2Name) bot2Name.textContent = isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼';
      if (bot2Desc) bot2Desc.textContent = isEasy ? 'Playful AI · Zero Skills' : isInsane ? 'Mythic Power · Ultimate Ability' : 'Zone Strategist · Uses Items';
      if (bot2Pill) {
        bot2Pill.className = isEasy ? 'seat-role-pill bot-pill-easy' : isInsane ? 'seat-role-pill bot-pill-insane' : 'seat-role-pill bot-pill-hard';
        bot2Pill.textContent = isEasy ? '🐣 Co-Pilot (Easy)' : isInsane ? '⚡ Sovereign (Insane)' : '😈 Rival (Hard)';
      }
      if (cycleBtn4) {
        cycleBtn4.className = isEasy ? 'seat-cycle-btn cycle-bot-easy' : isInsane ? 'seat-cycle-btn cycle-bot-insane' : 'seat-cycle-btn cycle-bot-hard';
        cycleBtn4.innerHTML = isEasy ? '<span>🔁 Cycle: Hard Bot</span>' : isInsane ? '<span>🔁 Cycle: Closed</span>' : '<span>🔁 Cycle: Insane Bot</span>';
      }
    } else {
      // Human open
      if (seatBot2) seatBot2.classList.remove('seat-closed-mode');
      if (bot2Img) bot2Img.src = 'assets/got_queen_idle.png';
      if (bot2Name) bot2Name.textContent = 'Open for Guest 4 🌐';
      if (bot2Desc) bot2Desc.textContent = 'Waiting for passenger...';
      if (bot2Pill) { bot2Pill.className = 'seat-role-pill'; bot2Pill.textContent = '🌐 Open Seat'; }
      if (cycleBtn4) { cycleBtn4.className = 'seat-cycle-btn cycle-open'; cycleBtn4.innerHTML = '<span>🔁 Cycle: Bot</span>'; }
    }
  }

  // Perks banner text & icon
  const perksIcon = $m('lobbyPerksIcon') || document.querySelector('.lobby-perks-banner .perks-icon');
  const perksText = $m('lobbyPerksText') || document.querySelector('.lobby-perks-banner .perks-text');
  const activeCount = lobbyState.slots.filter((s) => s.type !== 'closed').length;

  if (perksIcon && perksText) {
    if (lobbyState.mode === 'bot') {
      perksIcon.textContent = '😼';
      perksText.innerHTML = '<strong>Practice Duel vs AI:</strong> Hone your flight path, explore tile powers, and test costume perks in a 1-on-1 match.';
    } else if (lobbyState.mode === 'couple') {
      perksIcon.textContent = '💖';
      perksText.innerHTML = '<strong>Couple Vibe Check:</strong> Romantic card questions active when you land on each other! Intimate 1-on-1 duel without bot interference.';
    } else {
      perksIcon.textContent = '✈️';
      perksText.innerHTML = `<strong>Sky Party (${activeCount} Passengers):</strong> Battle all rivals in a frantic 20-round flight for airline dominance! First to ${fmt(MONO_CFG.WIN_NET_WORTH)} NW wins.`;
    }
  }

  // Launch CTA
  const launchBtn = $m('btnLaunchMonopolyGame');
  if (launchBtn) {
    const label = launchBtn.querySelector('.launch-label');
    if (activeCount < 2) {
      launchBtn.disabled = true;
      launchBtn.classList.add('disabled');
      if (label) label.textContent = '⚠️ NEED AT LEAST 2 PLAYERS TO LAUNCH';
    } else {
      launchBtn.disabled = false;
      launchBtn.classList.remove('disabled');
      if (label) {
        label.textContent = `BOARD FLIGHT (${activeCount} PLAYERS) 🛫`;
      }
    }
  }
}

function broadcastLobbyState() {
  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'monopoly_lobby_update',
      lobbyState: lobbyState
    });
  }
}

// -------------------------------------------------------------
// NEORA Flight Departure Board & Room Registry Client Controller
// -------------------------------------------------------------
let currentFlightRoom = null;
let currentFlightRoomIsHost = false;
let currentFlightRoomSlot = null;
let currentNeoraView = 'browser'; // 'browser' | 'room' | 'create'
let departureBoardFlights = [];
let departureBoardFilter = 'all';
let departureBoardSearch = '';
let departureBoardSort = 'latest';

function getEquippedCostumeAvatar() {
  const myAvatar = window.getMyAvatar ? window.getMyAvatar() : null;
  const myRole = getMonopolyMyRole();
  const profiles = window.NookVault?.getProfiles ? window.NookVault.getProfiles() : null;
  const username = window.SkySupabase?.getCurrentUser()?.username;

  let sprite = myAvatar?.sprite;
  if (!sprite && profiles && profiles[myRole]) {
    sprite = profiles[myRole].sprite || profiles[myRole].equippedSprite;
  }
  if (!sprite) {
    sprite = myRole === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png';
  }

  let name = username || myAvatar?.name || (myRole === 'dxb' ? 'Luna 🌸' : 'Nook ✈️');
  if (name === 'Luna' || name === 'Nook') {
    name = `${name} ✈️`;
  }

  return {
    sprite,
    name,
    characterId: myAvatar?.characterId || null,
    role: myRole
  };
}

function switchNeoraView(viewName) {
  currentNeoraView = viewName;
  const modal = $m('departureBoardModal');
  if (modal) modal.classList.remove('hidden');

  const browserView = $m('neoraViewBrowser');
  const roomView = $m('neoraViewRoom');
  const createView = $m('neoraViewCreate');

  if (browserView) browserView.classList.toggle('active', viewName === 'browser');
  if (roomView) roomView.classList.toggle('active', viewName === 'room');
  if (createView) createView.classList.toggle('active', viewName === 'create');

  if (viewName === 'browser') {
    if (typeof sendSignaling === 'function') sendSignaling({ type: 'room_browse_start' });
    renderDepartureBoard();
  } else if (viewName === 'room') {
    renderNeoraWaitingRoom();
  } else if (viewName === 'create') {
    renderNeoraCreateRoom();
  }
}

let pendingActiveSession = null;
let monopolyEntryRequested = false;

function showNeoraRejoinModal(room, slot = null) {
  const modal = $m('neoraRejoinModal');
  if (!modal || !room) return;

  const nameEl = $m('rejoinFlightName');
  const numEl = $m('rejoinFlightNum');
  const seatEl = $m('rejoinSeatLabel');
  const badgeEl = $m('rejoinStatusBadge');

  if (nameEl) nameEl.textContent = room.name || 'Monopoly Flight';
  if (numEl) numEl.textContent = `${room.flightNumber || 'SKY-001'} • CODE ${room.code || '------'}`;

  const myUid = getPersistentPlayerUid();
  const mySlot = slot || (room.slots || []).find((s) => s.occupiedBy === myUid) || room.slots?.[0];
  if (seatEl) {
    const seatName = mySlot ? `Seat ${mySlot.id} (${(mySlot.role || 'Player').toUpperCase()})` : 'Assigned Seat';
    seatEl.textContent = seatName;
  }

  if (badgeEl) {
    const isInFlight = room.status === 'in_flight';
    badgeEl.textContent = isInFlight ? 'In Flight' : 'Boarding Lounge';
    badgeEl.className = `rejoin-flight-badge ${isInFlight ? 'in-flight' : 'lobby'}`;
  }

  modal.classList.remove('hidden');
}

function hideNeoraRejoinModal() {
  const modal = $m('neoraRejoinModal');
  if (modal) modal.classList.add('hidden');
}

function handleMonopolyHomeClick() {
  const uid = getPersistentPlayerUid();
  const cachedRoomId = typeof localStorage !== 'undefined' ? localStorage.getItem('sky_active_room_id') : null;

  // If there's an active in-flight or lobby room we are a member of
  if (currentFlightRoom && currentFlightRoom.status !== 'finished') {
    const isMember = (currentFlightRoom.slots || []).some((s) => s.occupiedBy === uid);
    if (isMember) {
      showNeoraRejoinModal(currentFlightRoom);
      return;
    }
  }

  // If we already received active session status from server
  if (pendingActiveSession && pendingActiveSession.hasActiveRoom && pendingActiveSession.room && pendingActiveSession.room.status !== 'finished') {
    showNeoraRejoinModal(pendingActiveSession.room, pendingActiveSession.slot);
    return;
  }

  // If no previous room exists, show departure board immediately for zero mobile lag
  if (!cachedRoomId) {
    showDepartureBoard();
    if (typeof sendSignaling === 'function') {
      sendSignaling({ type: 'room_browse_start' });
    }
    return;
  }

  // Check with backend if returning to an active room
  if (typeof sendSignaling === 'function' && uid) {
    monopolyEntryRequested = true;
    sendSignaling({
      type: 'room_check_session',
      uid,
      roomId: cachedRoomId
    });
    // Fallback: If server does not reply within 400ms, open departure board directly
    setTimeout(() => {
      if (monopolyEntryRequested) {
        monopolyEntryRequested = false;
        showDepartureBoard();
      }
    }, 450);
    return;
  }

  showDepartureBoard();
}

function getActiveInFlightMatch() {
  const myUid = getPersistentPlayerUid();
  if (currentFlightRoom && currentFlightRoom.status === 'in_flight') {
    const isMember = (currentFlightRoom.slots || []).some((s) => s.occupiedBy === myUid || s.occupiedBy === `user_${myUid}`);
    if (isMember) return currentFlightRoom;
  }
  if (pendingActiveSession && pendingActiveSession.hasActiveRoom && pendingActiveSession.inFlight && pendingActiveSession.room) {
    return pendingActiveSession.room;
  }
  if (Array.isArray(departureBoardFlights)) {
    const found = departureBoardFlights.find((f) => f.status === 'in_flight' && Array.isArray(f.slots) && f.slots.some((s) => s.occupiedBy === myUid || s.occupiedBy === `user_${myUid}`));
    if (found) return found;
  }
  return null;
}

function highlightActiveMatchBanner() {
  const banner = $m('neoraActiveMatchBanner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.classList.add('banner-pulse-highlight');
    setTimeout(() => banner.classList.remove('banner-pulse-highlight'), 1200);
    try {
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {}
  }
}

function handleRejoinActiveFlight(targetFlight = null) {
  const flight = targetFlight || getActiveInFlightMatch();
  if (!flight) {
    if (typeof showToast === 'function') showToast('⚠️ No active flight found to rejoin.');
    return;
  }

  window.isMonopolyPlayerAway = false;
  const myUid = getPersistentPlayerUid();
  const mySlot = (flight.slots || []).find((s) => s.occupiedBy === myUid || s.occupiedBy === `user_${myUid}`);
  const myRole = mySlot?.role || getMonopolyMyRole();
  const myAvatar = getEquippedCostumeAvatar(myRole);
  const myName = (window.getMyAvatar && window.getMyAvatar())?.name || (myRole === 'dxb' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺');

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_rejoin',
      roomId: flight.id,
      uid: myUid,
      name: myName,
      avatar: myAvatar?.sprite || (myRole === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png')
    });
  }

  hideDepartureBoard();
  const modal = $m('monopolyModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body?.classList.add('has-active-modal');
  }
  if (typeof showToast === 'function') {
    showToast('🚀 Welcome back! Manual control restored.');
  }
}

function abandonActiveFlight(targetFlight = null) {
  const flight = targetFlight || getActiveInFlightMatch();
  const myUid = getPersistentPlayerUid();
  pendingActiveSession = null;
  currentFlightRoom = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sky_active_room_id');
  }
  const banner = $m('neoraActiveMatchBanner');
  if (banner) banner.classList.add('hidden');

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_abandon_match',
      roomId: flight?.id,
      uid: myUid
    });
  }
  if (typeof showToast === 'function') {
    showToast('Flight forfeited. You can now host or join a new room.');
  }
  renderDepartureBoard();
}
window.abandonActiveFlight = abandonActiveFlight;

function handleMonopolyExitGame() {
  const modal = $m('monopolyModal');
  if (modal) {
    document.body?.classList.remove('has-active-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }
  if (AudioFX && AudioFX.suspend) AudioFX.suspend();

  const activeFlight = getActiveInFlightMatch();
  const isMatchInFlight = !!activeFlight || (monopolyState && monopolyState.active && !monopolyState.gameOver);

  if (isMatchInFlight) {
    window.isMonopolyPlayerAway = true;
    const roomId = activeFlight?.id || currentFlightRoom?.id;
    if (roomId && typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'room_player_away',
        roomId,
        uid: getPersistentPlayerUid()
      });
    }
    if (typeof showToast === 'function') {
      showToast('🤖 Seat set to auto-pilot. You can rejoin anytime from Departures!');
    }
    if (monopolyState && monopolyState.active && !monopolyState.gameOver) {
      checkBotTurn();
    }
  } else {
    if (monopolyState) monopolyState.active = false;
    saveLocalMonopolyState();
  }

  showDepartureBoard();
}

function showDepartureBoard() {
  showMonopolyLobby();
}

function showMonopolyLobby() {
  hideVictory();
  hideModal();
  const modal = $m('departureBoardModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  if (currentFlightRoom && currentFlightRoom.status === 'lobby') {
    switchNeoraView('room');
  } else {
    switchNeoraView('browser');
  }
}

function hideDepartureBoard() {
  hideMonopolyLobby();
}

function hideMonopolyLobby() {
  const modal = $m('departureBoardModal');
  if (modal) modal.classList.add('hidden');
  const screen = $m('monopolyLobbyScreen');
  if (screen) screen.classList.add('hidden');
  const boardModal = $m('monopolyModal');
  if (boardModal && !boardModal.classList.contains('hidden')) {
    window.isMonopolyPlayerAway = false;
    if (monopolyState && monopolyState.currentTurn === getMonopolyMyRole() && typeof clearBotTimer === 'function') {
      clearBotTimer();
    }
  }
  if (typeof sendSignaling === 'function') {
    sendSignaling({ type: 'room_browse_stop' });
  }
}

function renderDepartureBoard() {
  const listEl = $m('departureFlightsList');
  if (!listEl) return;

  // Active Flight In-Progress Banner
  const myUid = getPersistentPlayerUid();
  const activeFlight = getActiveInFlightMatch();
  const activeBanner = $m('neoraActiveMatchBanner');
  if (activeBanner) {
    if (activeFlight) {
      activeBanner.classList.remove('hidden');
      const titleEl = $m('activeMatchBannerTitle');
      const subEl = $m('activeMatchBannerSub');
      if (titleEl) {
        titleEl.textContent = `🎮 Flight in Progress: ${activeFlight.flightNumber || activeFlight.name || 'Active Match'}`;
      }
      if (subEl) {
        subEl.textContent = `Your seat is running on auto-pilot. Tap Rejoin to return!`;
      }
      const rejoinBtn = $m('btnRejoinActiveFlight');
      if (rejoinBtn) {
        rejoinBtn.onclick = (e) => {
          e.stopPropagation();
          handleRejoinActiveFlight(activeFlight);
        };
      }
      const abandonBtn = $m('btnAbandonActiveFlight');
      if (abandonBtn) {
        abandonBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm('Leave and forfeit this match? Your seat will be freed.')) {
            abandonActiveFlight(activeFlight);
          }
        };
      }
    } else {
      activeBanner.classList.add('hidden');
    }
  }

  const countAll = $m('countAllFlights');
  const countBoarding = $m('countBoardingFlights');
  const countInFlight = $m('countInFlight');
  const countClose = $m('countCloseFlights');

  const total = departureBoardFlights.length;
  const boardingCount = departureBoardFlights.filter((f) => f.status === 'lobby').length;
  const inFlightCount = departureBoardFlights.filter((f) => f.status === 'in_flight').length;
  const closeCount = departureBoardFlights.filter((f) => f.status === 'finished' || (f.status === 'lobby' && f.openSeats <= 0)).length;

  if (countAll) countAll.textContent = total;
  if (countBoarding) countBoarding.textContent = boardingCount;
  if (countInFlight) countInFlight.textContent = inFlightCount;
  if (countClose) countClose.textContent = closeCount;

  const search = (departureBoardSearch || '').trim().toLowerCase();
  let filtered = departureBoardFlights.filter((flight) => {
    if (departureBoardFilter === 'open' && (flight.status !== 'lobby' || flight.openSeats <= 0)) return false;
    if (departureBoardFilter === 'playing' && flight.status !== 'in_flight') return false;
    if (departureBoardFilter === 'close' && !(flight.status === 'finished' || (flight.status === 'lobby' && flight.openSeats <= 0))) return false;
    if (search) {
      const matchNo = (flight.flightNumber || '').toLowerCase().includes(search);
      const matchName = (flight.name || '').toLowerCase().includes(search);
      const matchCaptain = (flight.hostName || '').toLowerCase().includes(search);
      const matchCode = (flight.code || '').includes(search);
      if (!matchNo && !matchName && !matchCaptain && !matchCode) return false;
    }
    return true;
  });

  // Apply sorting
  if (departureBoardSort === 'players') {
    filtered.sort((a, b) => (b.activeHumans || 0) - (a.activeHumans || 0));
  } else if (departureBoardSort === 'fast') {
    filtered.sort((a, b) => (a.openSeats || 0) - (b.openSeats || 0));
  } else {
    // Latest
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="departure-empty-state">
        <div class="empty-radar-icon">📡</div>
        <div class="empty-radar-title">NO ROOMS FOUND</div>
        <div class="empty-radar-desc">There are currently no rooms matching this filter. Create your own and invite friends!</div>
        <button class="neora-btn-primary btn-create-room" id="emptyHostFlightBtn" type="button" style="margin-top: 8px;">➕ Create Room</button>
      </div>`;
    const btn = $m('emptyHostFlightBtn');
    if (btn) {
      btn.onclick = () => {
        if (activeFlight) {
          if (typeof showToast === 'function') {
            showToast('⚠️ You have a match in progress! You must rejoin your original room.');
          }
          highlightActiveMatchBanner();
          return;
        }
        switchNeoraView('create');
      };
    }
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach((flight) => {
    const isLobby = flight.status === 'lobby';
    const isPlaying = flight.status === 'in_flight';
    const isFull = (flight.openSeats || 0) <= 0;
    const card = document.createElement('div');
    card.className = 'neora-room-card';
    card.id = `roomCard_${flight.id}`;

    // Format slots strip
    const slots = Array.isArray(flight.slots) ? flight.slots : [];
    let slotsHtml = '';
    for (let i = 0; i < 4; i++) {
      const s = slots[i];
      if (s && ((s.type === 'human' && s.occupiedBy) || s.type === 'bot')) {
        const isHost = s.id === 1 || s.occupiedBy === flight.hostUid;
        const avatarSrc = s.avatar || (isHost ? (flight.hostAvatar || 'assets/bkk_warrior_idle.png') : 'assets/got_queen_idle.png');
        const sName = s.name ? s.name.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim() : (isHost ? 'Host' : 'Player');
        slotsHtml += `
          <div class="room-strip-slot">
            ${isHost ? '<span class="room-strip-crown">👑</span>' : ''}
            <div class="room-strip-avatar-wrap">
              <img src="${avatarSrc}" class="room-strip-avatar-img" alt="" />
            </div>
            <span class="room-strip-name">${sName}</span>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="room-strip-slot">
            <div class="room-strip-empty-circle">+</div>
            <span class="room-strip-name">Open</span>
          </div>
        `;
      }
    }

    // Tags
    const tags = Array.isArray(flight.tags) && flight.tags.length > 0 ? flight.tags : ['Casual', 'Make Friends'];
    const tagsHtml = tags.map((t) => `<span class="neora-tag-pill">${t}</span>`).join('');

    // Status pill
    let statusPillHtml = '';
    if (isPlaying) {
      statusPillHtml = '<span class="room-status-badge badge-playing">🎮 Playing</span>';
    } else if (isFull) {
      statusPillHtml = '<span class="room-status-badge badge-close">Close</span>';
    } else {
      statusPillHtml = '<span class="room-status-badge badge-open">● Open 📶</span>';
    }

    // Action button
    const isMyActiveFlight = activeFlight && (activeFlight.id === flight.id || activeFlight.code === flight.id);
    let actionBtnHtml = '';
    if (isMyActiveFlight) {
      actionBtnHtml = `<button class="btn-neora-join btn-rejoin-flight" data-room-id="${flight.id}" type="button">Rejoin 🚀</button>`;
    } else if (isPlaying) {
      actionBtnHtml = `<button class="btn-neora-watching" data-room-id="${flight.id}" type="button">👁 Watching</button>`;
    } else if (isFull) {
      actionBtnHtml = `<button class="btn-neora-full" disabled type="button">Full</button>`;
    } else {
      actionBtnHtml = `<button class="btn-neora-join" data-room-id="${flight.id}" type="button">Join</button>`;
    }

    card.innerHTML = `
      <div class="room-card-thumb-wrap">
        <img src="assets/ui/neora_monopoly_dice.jpg" class="room-card-thumb" alt="Dice Thumbnail" />
      </div>
      <div class="room-card-main">
        <div class="room-card-top-row">
          <h4 class="room-card-title">${flight.name || 'Monopoly · Chill Game'}</h4>
          <div class="room-card-meta-right">
            ${statusPillHtml}
            <span class="room-card-capacity">${flight.activeHumans || 1}/${flight.totalSeats || 4}</span>
          </div>
        </div>
        <div class="room-card-tags-row">
          ${tagsHtml}
        </div>
        <div class="room-card-avatars-strip">
          ${slotsHtml}
        </div>
      </div>
      <div class="room-card-action">
        ${actionBtnHtml}
      </div>
    `;

    const joinBtn = card.querySelector('.btn-neora-join');
    if (joinBtn) {
      joinBtn.onclick = () => {
        if (isMyActiveFlight) {
          handleRejoinActiveFlight(flight);
          return;
        }
        if (activeFlight) {
          if (typeof showToast === 'function') {
            showToast('⚠️ You have a match in progress! You must rejoin your original room.');
          }
          highlightActiveMatchBanner();
          return;
        }
        joinFlightRoom(flight.id, false);
      };
    }
    const watchBtn = card.querySelector('.btn-neora-watching');
    if (watchBtn) {
      watchBtn.onclick = () => {
        if (isMyActiveFlight) {
          handleRejoinActiveFlight(flight);
          return;
        }
        if (activeFlight) {
          if (typeof showToast === 'function') {
            showToast('⚠️ You have a match in progress! You must rejoin your original room.');
          }
          highlightActiveMatchBanner();
          return;
        }
        if (typeof showToast === 'function') showToast('Spectator mode connecting...');
        joinFlightRoom(flight.id, true);
      };
    }

    listEl.appendChild(card);
  });
}

function isCurrentUserHost() {
  if (!currentFlightRoom) return true;
  if (currentFlightRoomIsHost) return true;
  if (currentFlightRoomSlot && currentFlightRoomSlot.id === 1) return true;
  const myUid = getPersistentPlayerUid();
  if (currentFlightRoom.hostUid && (currentFlightRoom.hostUid === myUid || currentFlightRoom.hostUid === `user_${myUid}`)) return true;
  const slot1 = currentFlightRoom.slots?.[0];
  if (slot1 && slot1.occupiedBy && (slot1.occupiedBy === myUid || slot1.occupiedBy === `user_${myUid}`)) return true;
  const myRole = (window.myTerminal || '').toLowerCase();
  if (myRole && slot1 && slot1.occupiedBy && String(slot1.occupiedBy).includes(myRole)) return true;
  return false;
}

function renderNeoraWaitingRoom() {
  if (!currentFlightRoom) return;
  const room = currentFlightRoom;

  // Banner details
  const titleEl = $m('roomBannerTitle');
  const statusEl = $m('roomBannerStatus');
  const idTextEl = $m('roomBannerIdText');
  const tagsEl = $m('roomBannerTags');
  const descEl = $m('roomBannerDesc');

  if (titleEl) titleEl.textContent = room.name || 'Monopoly · Chill Game';
  if (statusEl) {
    statusEl.textContent = room.status === 'in_flight' ? '🎮 Playing' : '● Open 📶';
    statusEl.className = `room-status-badge ${room.status === 'in_flight' ? 'badge-playing' : 'badge-open'}`;
  }
  if (idTextEl) {
    idTextEl.textContent = `#BKK-${String(room.code || '4729').slice(0, 4)}`;
  }
  if (tagsEl) {
    const tags = Array.isArray(room.tags) && room.tags.length > 0 ? room.tags : ['Casual', 'Make Friends', 'Voice Chat'];
    tagsEl.innerHTML = tags.map((t) => `<span class="neora-tag-pill">${t}</span>`).join('');
  }
  if (descEl) {
    descEl.textContent = room.description || 'Relaxed game, make friends! All are welcome ♡';
  }

  // Auto Fill Toggle
  const autoFillToggle = $m('autoFillToggle');
  if (autoFillToggle) {
    autoFillToggle.checked = !!room.autoFill;
  }

  // Active Occupied Count
  const occupiedCount = (room.slots || []).filter((s) => (s.type === 'human' && s.occupiedBy) || s.type === 'bot').length;
  const countEl = $m('roomPlayersCount');
  if (countEl) countEl.textContent = `${occupiedCount}/4`;

  // Render 4 Player Slots Grid (Identical to 4 horizontal cards in reference)
  const gridEl = $m('neoraSlotsGrid');
  if (gridEl) {
    gridEl.innerHTML = '';
    const myRole = getMonopolyMyRole();
    const myUid = `user_${myRole}`;
    const myAvatar = getEquippedCostumeAvatar();
    const amIHost = isCurrentUserHost();

    for (let i = 1; i <= 4; i++) {
      const slot = (room.slots || []).find((s) => s.id === i) || { id: i, type: 'human', occupiedBy: null };
      const card = document.createElement('div');
      card.className = 'neora-slot-card';
      if (amIHost && i > 1) {
        card.classList.add('host-interactive');
      }
      card.dataset.slot = i;

      const isSlotHost = slot.id === 1 || slot.occupiedBy === room.hostUid;
      const isMe = slot.occupiedBy === myUid || (isSlotHost && amIHost);

      if (slot.type === 'human' && slot.occupiedBy) {
        // Human occupant: strictly map avatar to exact equipped costume sprite!
        const avatarSrc = isMe ? myAvatar.sprite : (slot.avatar || (isSlotHost ? 'assets/ui/neora_ref/avatar_nook.png' : 'assets/ui/neora_ref/avatar_luna.png'));
        const pName = isMe ? myAvatar.name : (slot.name || `Player ${i}`);
        const prefixIcon = isSlotHost ? '<span class="badge-prefix">🪪</span> ' : (slot.id === 2 ? '⭐ ' : '');
        const suffixIcon = slot.id === 2 ? ' ⭐' : '';
        card.innerHTML = `
          ${isSlotHost ? '<span class="slot-crown-badge">👑</span>' : ''}
          <span class="slot-more-dots" title="Seat Options">···</span>
          <div class="slot-avatar-container">
            <img src="${avatarSrc}" class="slot-avatar-img" alt="" />
          </div>
          <div class="slot-info-col">
            <span class="slot-name-badge" title="${pName}">${prefixIcon}${pName}${suffixIcon}</span>
            <span class="slot-ready-pill ${slot.ready ? 'is-ready' : 'not-ready'}">+ Ready 🎙️</span>
          </div>
        `;
      } else if (slot.type === 'bot') {
        const isEasy = slot.difficulty === 'easy';
        const isInsane = slot.difficulty === 'insane';
        const botAvatar = slot.avatar || 'assets/ui/neora_ref/avatar_bot_blue.png';
        const defaultBotName = slot.id === 2
          ? (isEasy ? 'Cadet Mochi 🐣' : isInsane ? 'Astral Sovereign 🌌' : 'Major Whiskers 🐯')
          : (slot.id === 3
            ? (isEasy ? 'Pilot Pip 🐱' : isInsane ? 'Chrono Sovereign ⏳' : 'Admiral Claw 🦁')
            : (isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼'));
        const botName = slot.name || defaultBotName;
        const pillText = isInsane ? '+ Ready ⚡' : '+ Ready 🤖';
        const pillClass = isInsane ? 'slot-ready-pill is-ready is-insane' : 'slot-ready-pill is-ready';
        card.innerHTML = `
          <span class="slot-more-dots" title="Configure Bot">···</span>
          <div class="slot-avatar-container ${isInsane ? 'is-insane-avatar' : ''}">
            <img src="${botAvatar}" class="slot-avatar-img" alt="" />
          </div>
          <div class="slot-info-col">
            <span class="slot-name-badge ${isInsane ? 'slot-name-insane' : ''}">${botName}</span>
            <span class="${pillClass}">${pillText}</span>
          </div>
        `;
      } else if (slot.type === 'closed') {
        card.innerHTML = `
          <span class="slot-more-dots" title="Configure Slot">···</span>
          <div class="slot-open-circle" style="opacity: 0.45;">🔒</div>
          <div class="slot-info-col">
            <span class="slot-name-label">Closed</span>
            <span class="slot-sub-label">Locked seat</span>
          </div>
        `;
      } else {
        // Open Slot
        card.innerHTML = `
          <span class="slot-more-dots" title="Seat Options">···</span>
          <div class="slot-open-circle" title="Tap to configure seat or invite">+</div>
          <div class="slot-info-col">
            <span class="slot-name-label">Open Slot</span>
            <span class="slot-sub-label">Anyone can join</span>
          </div>
        `;
      }

      // Slot interaction:
      // If host clicks slot > 1 -> opens config popover
      // If joiner clicks their own occupied seat -> toggles ready status
      // If joiner clicks open slot -> copies room invite code
      if (amIHost && i > 1) {
        card.onclick = () => openSlotConfigPopover(i);
        const dots = card.querySelector('.slot-more-dots');
        if (dots) {
          dots.onclick = (e) => {
            e.stopPropagation();
            openSlotConfigPopover(i);
          };
        }
      } else if (isMe && !amIHost) {
        card.onclick = () => {
          if (typeof sendSignaling === 'function' && currentFlightRoom) {
            sendSignaling({
              type: 'room_toggle_ready',
              roomId: currentFlightRoom.id
            });
          }
        };
      } else if (slot.type === 'human' && !slot.occupiedBy) {
        card.onclick = copyFlightCode;
      }

      gridEl.appendChild(card);
    }
  }

  // Render Chat Messages
  renderNeoraChatList();

  // Bottom Main Start Button:
  // If host: "▶ Start Game"
  // If joiner: "● Ready" / "Cancel Ready"
  const startBtn = $m('neoraStartGameBtn');
  const startLabel = $m('neoraStartBtnLabel');
  const isHost = isCurrentUserHost();

  if (startLabel) {
    if (isHost) {
      startLabel.textContent = 'Start Game';
    } else {
      const myRole = getMonopolyMyRole();
      const mySlot = (room.slots || []).find((s) => s.occupiedBy && String(s.occupiedBy).startsWith(`user_${myRole}`));
      startLabel.textContent = mySlot?.ready ? 'Cancel Ready' : '● Ready';
    }
  }

  const terminateBtn = $m('neoraTerminateRoomBtn');
  if (terminateBtn) {
    terminateBtn.classList.toggle('hidden', !isHost);
  }
  const inGameTerminateBtn = $m('monopolyTerminateFlightBtn');
  if (inGameTerminateBtn) {
    inGameTerminateBtn.classList.toggle('hidden', !isHost);
  }
}

function renderNeoraChatList() {
  const chatFeed = $m('neoraChatMessages');
  if (!chatFeed || !currentFlightRoom) return;
  chatFeed.innerHTML = '';

  const msgs = Array.isArray(currentFlightRoom.messages) ? currentFlightRoom.messages : [];
  msgs.forEach((msg) => {
    appendNeoraChatMessage(msg, false);
  });
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function appendNeoraChatMessage(msg, autoScroll = true) {
  const chatFeed = $m('neoraChatMessages');
  if (!chatFeed || !msg) return;

  const row = document.createElement('div');
  row.className = 'chat-msg-row';
  row.innerHTML = `
    <div class="chat-msg-avatar">
      <img src="${msg.avatar || 'assets/bkk_warrior_idle.png'}" alt="" />
    </div>
    <div class="chat-msg-body">
      <div class="chat-msg-header">
        <span class="chat-msg-author">${escapeHtml(msg.name || 'Passenger')}</span>
        <span class="chat-msg-time">${msg.time || '8:12 PM'}</span>
      </div>
      <div class="chat-msg-bubble">${escapeHtml(msg.text || '')}</div>
    </div>
  `;
  chatFeed.appendChild(row);
  if (autoScroll) chatFeed.scrollTop = chatFeed.scrollHeight;
}

function sendNeoraChatMessage() {
  const inp = $m('chatTextInput');
  if (!inp || !currentFlightRoom) return;
  const text = (inp.value || '').trim();
  if (!text) return;
  inp.value = '';

  const myAvatar = getEquippedCostumeAvatar();
  const myRole = getMonopolyMyRole();

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_chat',
      roomId: currentFlightRoom.id,
      sender: {
        uid: `user_${myRole}`,
        name: myAvatar.name,
        avatar: myAvatar.sprite
      },
      text
    });
  }
}

let activeConfigSlotId = null;

function openSlotConfigPopover(slotId) {
  if (!isCurrentUserHost() || !currentFlightRoom) return;
  activeConfigSlotId = slotId;
  const slot = (currentFlightRoom.slots || []).find((s) => s.id === slotId);
  const pop = $m('neoraSlotConfigPopover');
  const title = $m('slotPopoverTitle');
  const kickBtn = $m('slotPopoverKickBtn');

  if (title) {
    if (slot && slot.type === 'human' && slot.occupiedBy) {
      title.textContent = `Configure Seat ${slotId} · ${slot.name || 'Passenger'}`;
    } else if (slot && slot.type === 'bot') {
      title.textContent = `Configure Seat ${slotId} · ${slot.name || 'Bot'}`;
    } else if (slot && slot.type === 'closed') {
      title.textContent = `Configure Seat ${slotId} · Closed`;
    } else {
      title.textContent = `Configure Seat ${slotId} · Open Slot`;
    }
  }

  if (kickBtn) {
    if (slot && slot.type === 'human' && slot.occupiedBy) {
      kickBtn.classList.remove('hidden');
    } else {
      kickBtn.classList.add('hidden');
    }
  }

  if (pop) {
    const opts = pop.querySelectorAll('.slot-popover-opt');
    opts.forEach((btn) => {
      const opt = btn.dataset.opt;
      if (opt === 'kick') return;
      let isActive = false;
      if (slot) {
        if (opt === 'open' && slot.type === 'human' && !slot.occupiedBy) isActive = true;
        else if (opt === 'easy' && slot.type === 'bot' && slot.difficulty === 'easy') isActive = true;
        else if (opt === 'hard' && slot.type === 'bot' && slot.difficulty === 'hard') isActive = true;
        else if (opt === 'insane' && slot.type === 'bot' && slot.difficulty === 'insane') isActive = true;
        else if (opt === 'closed' && slot.type === 'closed') isActive = true;
      }
      btn.classList.toggle('active-opt', isActive);
    });
    pop.classList.remove('hidden');
  }
}

function closeSlotConfigPopover() {
  activeConfigSlotId = null;
  const pop = $m('neoraSlotConfigPopover');
  if (pop) pop.classList.add('hidden');
}

function initNeoraSlotConfigPopover() {
  const closeBtn = $m('slotPopoverCloseBtn');
  if (closeBtn) closeBtn.onclick = closeSlotConfigPopover;

  const pop = $m('neoraSlotConfigPopover');
  if (!pop) return;

  const opts = pop.querySelectorAll('.slot-popover-opt');
  opts.forEach((btn) => {
    btn.onclick = () => {
      if (!currentFlightRoom || !activeConfigSlotId) return;
      const opt = btn.dataset.opt;
      const slotId = activeConfigSlotId;

      if (opt === 'kick') {
        if (typeof sendSignaling === 'function') {
          sendSignaling({
            type: 'room_kick_player',
            roomId: currentFlightRoom.id,
            slotId
          });
        }
        if (typeof showToast === 'function') {
          showToast(`Passenger removed from Seat ${slotId}`);
        }
        closeSlotConfigPopover();
        return;
      }

      let update = {};
      if (opt === 'open') {
        update = { type: 'human', difficulty: null, name: 'Open Slot', avatar: '', ready: false, occupiedBy: null, kick: true };
      } else if (opt === 'easy') {
        const defaultName = slotId === 2 ? 'Cadet Mochi 🐣' : (slotId === 3 ? 'Pilot Pip 🐱' : 'Trainee Mochi 🐾');
        update = { type: 'bot', difficulty: 'easy', name: defaultName, avatar: 'assets/ui/neora_ref/avatar_bot_blue.png', ready: true, occupiedBy: null };
      } else if (opt === 'hard') {
        const defaultName = slotId === 2 ? 'Major Whiskers 🐯' : (slotId === 3 ? 'Admiral Claw 🦁' : 'Capt. Whiskers 😼');
        update = { type: 'bot', difficulty: 'hard', name: defaultName, avatar: 'assets/ui/neora_ref/avatar_bot_blue.png', ready: true, occupiedBy: null };
      } else if (opt === 'insane') {
        const defaultName = slotId === 2 ? 'Astral Sovereign 🌌' : (slotId === 3 ? 'Chrono Sovereign ⏳' : 'Apex Sovereign ⚡');
        update = { type: 'bot', difficulty: 'insane', name: defaultName, avatar: 'assets/ui/neora_ref/avatar_bot_blue.png', ready: true, occupiedBy: null };
      } else if (opt === 'closed') {
        update = { type: 'closed', difficulty: null, name: 'Closed Seat', avatar: '', ready: false, occupiedBy: null };
      }

      if (typeof sendSignaling === 'function') {
        sendSignaling({
          type: 'room_update_slots',
          roomId: currentFlightRoom.id,
          slotId,
          update
        });
      }
      if (typeof showToast === 'function') {
        const label = opt === 'open' ? 'Open' : (opt === 'easy' ? 'Bot (Easy)' : (opt === 'hard' ? 'Bot (Hard)' : (opt === 'insane' ? 'Bot (Insane ⚡)' : 'Closed')));
        showToast(`Seat ${slotId} configured: ${label}`);
      }
      closeSlotConfigPopover();
    };
  });

  document.addEventListener('click', (e) => {
    if (pop.classList.contains('hidden')) return;
    if (pop.contains(e.target) || e.target.closest('.neora-slot-card') || e.target.closest('.slot-more-dots')) return;
    closeSlotConfigPopover();
  });
}

function initNeoraEmojiPicker() {
  const emojiBtn = $m('chatEmojiBtn');
  const picker = $m('neoraEmojiPicker');
  const textInp = $m('chatTextInput');

  if (emojiBtn && picker) {
    emojiBtn.onclick = (e) => {
      e.stopPropagation();
      picker.classList.toggle('hidden');
    };
  }

  if (picker && textInp) {
    const btns = picker.querySelectorAll('.emoji-pick-btn');
    btns.forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        textInp.value += b.dataset.emoji || '';
        textInp.focus();
        picker.classList.add('hidden');
      };
    });
  }
}

function toggleNeoraAutoFill() {
  const toggle = $m('autoFillToggle');
  if (!toggle || !currentFlightRoom) return;
  const newState = !!toggle.checked;

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_autofill',
      roomId: currentFlightRoom.id,
      autoFill: newState
    });
  }
}

function renderNeoraCreateRoom() {
  const myAvatar = getEquippedCostumeAvatar();

  // Pre-fill Host Slot with current equipped costume
  const slot1Img = $m('createSlot1Img');
  const slot1Name = $m('createSlot1Name');
  if (slot1Img) slot1Img.src = myAvatar.sprite;
  if (slot1Name) slot1Name.textContent = myAvatar.name;

  // Sync slots 2, 3, 4 UI
  [2, 3, 4].forEach((slotId) => {
    const sel = $m(`createSlot${slotId}Select`);
    const circle = $m(`createSlot${slotId}AvatarCircle`);
    const icon = $m(`createSlot${slotId}Icon`);
    const img = $m(`createSlot${slotId}Img`);
    const val = sel?.value || (slotId === 2 ? 'open' : (slotId === 3 ? 'hard' : 'easy'));
    if (val === 'open') {
      if (circle) circle.className = 'slot-avatar-circle';
      if (icon) { icon.textContent = '➕'; icon.classList.remove('hidden'); }
      if (img) img.classList.add('hidden');
    } else if (val === 'closed') {
      if (circle) circle.className = 'slot-avatar-circle closed';
      if (icon) { icon.textContent = '🔒'; icon.classList.remove('hidden'); }
      if (img) img.classList.add('hidden');
    } else {
      if (circle) circle.className = (val === 'insane') ? 'slot-avatar-circle bot insane' : 'slot-avatar-circle bot';
      if (icon) icon.classList.add('hidden');
      if (img) img.classList.remove('hidden');
    }
  });

  // Live counter inputs
  const nameInp = $m('createRoomNameInput');
  const nameCount = $m('createNameCount');
  if (nameInp && nameCount) {
    nameCount.textContent = `${nameInp.value.length}/30`;
    nameInp.oninput = () => { nameCount.textContent = `${nameInp.value.length}/30`; };
  }

  const descInp = $m('createRoomDescInput');
  const descCount = $m('createDescCount');
  if (descInp && descCount) {
    descCount.textContent = `${descInp.value.length}/100`;
    descInp.oninput = () => { descCount.textContent = `${descInp.value.length}/100`; };
  }
}

function createFlightRoom(isPublic = true, flightName = null, desc = null, tags = null, customSlots = null) {
  const activeMatch = getActiveInFlightMatch();
  if (activeMatch) {
    if (confirm('You have an active match in progress. Leave current match and host this new room?')) {
      if (typeof abandonActiveFlight === 'function') abandonActiveFlight(activeMatch);
    } else {
      highlightActiveMatchBanner();
      return;
    }
  }
  const myAvatar = getEquippedCostumeAvatar();
  const myRole = getMonopolyMyRole();
  const hostUid = getPersistentPlayerUid();
  const hostName = myAvatar.name;
  const hostAvatar = myAvatar.sprite;

  const defaultSlots = [
    { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true, occupiedBy: hostUid, name: hostName, avatar: hostAvatar },
    { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
    { id: 3, role: 'bot1', color: 'emerald', type: 'bot', difficulty: 'easy', ready: true, occupiedBy: null, name: 'Trainee Mochi 🐾', avatar: 'assets/ui/neora_ref/avatar_bot_blue.png' },
    { id: 4, role: 'bot2', color: 'amber', type: 'bot', difficulty: 'hard', ready: true, occupiedBy: null, name: 'Capt. Whiskers 😼', avatar: 'assets/ui/neora_ref/avatar_bot_blue.png' }
  ];

  const slotsToUse = customSlots || defaultSlots;
  const resolvedName = flightName || 'Monopoly · Chill Game';
  const resolvedDesc = desc || 'Relaxed game, make friends! All are welcome ♡';
  const resolvedTags = Array.isArray(tags) ? tags : ['Casual', 'Make Friends', 'Voice Chat'];

  // Construct room object immediately so the waiting room displays without any delay
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const newRoom = {
    id: `flight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    flightNumber: `SKY-${code.slice(0, 3)}`,
    name: resolvedName,
    description: resolvedDesc,
    tags: resolvedTags,
    game: 'monopoly',
    isPublic: !!isPublic,
    hostUid,
    hostName,
    hostAvatar,
    status: 'lobby',
    slots: slotsToUse,
    messages: [
      {
        id: `msg_init_1`,
        uid: hostUid,
        name: hostName.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim() || 'Nook',
        avatar: hostAvatar || 'assets/ui/neora_ref/avatar_nook.png',
        text: "Welcome! Let's play together! 🎲",
        time: '8:12 PM',
        timestamp: Date.now()
      }
    ]
  };

  currentFlightRoom = newRoom;
  currentFlightRoomIsHost = true;
  currentFlightRoomSlot = { id: 1, role: 'bkk' };
  manualRoleOverride = null;
  lobbyState.slots = newRoom.slots;
  switchNeoraView('room');

  // Dispatch to server so room is persisted and broadcast to other players in the lobby!
  const sendFn = window.sendSignaling || (typeof sendSignaling === 'function' ? sendSignaling : null);
  if (sendFn) {
    sendFn({
      type: 'room_create',
      hostUid,
      hostName,
      hostAvatar,
      isPublic: !!isPublic,
      flightName: resolvedName,
      description: resolvedDesc,
      tags: resolvedTags,
      game: 'monopoly',
      forceAbandon: true,
      slots: slotsToUse
    });
  }
}

function quickJoinFlightRoom() {
  const activeMatch = getActiveInFlightMatch();
  if (activeMatch) {
    if (typeof showToast === 'function') {
      showToast('⚠️ You have a match in progress! Rejoining your original room...');
    }
    handleRejoinActiveFlight(activeMatch);
    return;
  }
  const myAvatar = getEquippedCostumeAvatar();
  const myRole = getMonopolyMyRole();
  const uid = getPersistentPlayerUid();

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_quick_join',
      uid,
      name: myAvatar.name,
      avatar: myAvatar.sprite
    });
  }
}

function joinFlightRoom(roomId, isSpectator = false) {
  const activeMatch = getActiveInFlightMatch();
  if (activeMatch && activeMatch.id !== roomId && activeMatch.code !== roomId) {
    if (typeof showToast === 'function') {
      showToast('⚠️ You have a match in progress! You must rejoin your original room.');
    }
    highlightActiveMatchBanner();
    return;
  }
  const myAvatar = getEquippedCostumeAvatar();
  const myRole = getMonopolyMyRole();
  const uid = getPersistentPlayerUid();

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_join',
      roomId,
      uid,
      name: myAvatar.name,
      avatar: myAvatar.sprite,
      spectator: !!isSpectator
    });
  }
}

function joinFlightByCode(rawCode) {
  const code = String(rawCode || '').trim();
  const activeMatch = getActiveInFlightMatch();
  if (activeMatch && activeMatch.code !== code && activeMatch.id !== code) {
    if (typeof showToast === 'function') {
      showToast('⚠️ You have a match in progress! You must rejoin your original room.');
    }
    highlightActiveMatchBanner();
    return;
  }
  const errEl = $m('flightCodeError');
  if (!/^\d{6}$/.test(code)) {
    if (errEl) {
      errEl.textContent = '⚠️ Please enter a valid 6-digit flight code.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  const myAvatar = getEquippedCostumeAvatar();
  const myRole = getMonopolyMyRole();
  const uid = getPersistentPlayerUid();

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_join_code',
      code,
      uid,
      name: myAvatar.name,
      avatar: myAvatar.sprite
    });
  }
}

function leaveFlightRoom() {
  const uid = getPersistentPlayerUid();
  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_leave',
      roomId: currentFlightRoom?.id,
      uid
    });
  }
  hideFloatingRoomWidget();
  currentFlightRoom = null;
  pendingActiveSession = null;
  if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
  switchNeoraView('browser');
}

function terminateFlightRoom() {
  const roomId = currentFlightRoom?.id || pendingActiveSession?.room?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('sky_active_room_id') : null);
  if (!roomId) {
    if (typeof showToast === 'function') showToast('⚠️ No active room to terminate.');
    return;
  }
  const isHost = isCurrentUserHost() || currentFlightRoomIsHost || (currentFlightRoom?.hostUid === getPersistentPlayerUid());
  if (!isHost) {
    if (typeof showToast === 'function') showToast('⚠️ Only the flight Captain can terminate the room.');
    return;
  }
  if (typeof confirm === 'function' && !confirm('Are you sure you want to terminate and disband this flight room for all passengers?')) {
    return;
  }
  const uid = getPersistentPlayerUid();
  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_terminate',
      roomId,
      uid
    });
  }
}

function minimizeFlightRoom() {
  if (!currentFlightRoom) return;
  const modal = $m('departureBoardModal');
  if (modal) modal.classList.add('hidden');
  sessionStorage.setItem('sky_room_minimized', 'true');
  updateFloatingRoomWidget();
  const widget = $m('neoraFloatingRoomWidget');
  if (widget) {
    widget.classList.remove('hidden');
  }
  if (typeof showToast === 'function') {
    showToast('🗕 Flight room minimized. You remain reserved in line!');
  }
}

function reopenFlightRoom() {
  const widget = $m('neoraFloatingRoomWidget');
  if (widget) widget.classList.add('hidden');
  sessionStorage.removeItem('sky_room_minimized');

  const modal = $m('departureBoardModal');
  if (modal) modal.classList.remove('hidden');
  switchNeoraView('room');
  updateLobbyFlightRoomUI();
  if (currentFlightRoom) {
    renderNeoraWaitingRoom();
  }
}

function hideFloatingRoomWidget() {
  const widget = $m('neoraFloatingRoomWidget');
  if (widget) widget.classList.add('hidden');
  sessionStorage.removeItem('sky_room_minimized');
}

function updateFloatingRoomWidget() {
  const widget = $m('neoraFloatingRoomWidget');
  if (!widget || !currentFlightRoom) return;

  const titleEl = $m('floatWidgetTitle');
  if (titleEl) titleEl.textContent = currentFlightRoom.name || 'Monopoly Flight';

  const codeBtn = $m('floatWidgetCodeBtn');
  if (codeBtn) {
    codeBtn.textContent = `#${currentFlightRoom.code || '------'} ⧉`;
    codeBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentFlightRoom.code && navigator.clipboard) {
        navigator.clipboard.writeText(currentFlightRoom.code);
        if (typeof showToast === 'function') showToast(`📋 Flight code #${currentFlightRoom.code} copied!`);
      }
    };
  }

  const slots = Array.isArray(currentFlightRoom.slots) ? currentFlightRoom.slots : [];
  const occupiedSlots = slots.filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy));
  const totalSlots = slots.filter((s) => s.type !== 'closed');
  const occEl = $m('floatWidgetOccupancy');
  if (occEl) {
    occEl.textContent = `${occupiedSlots.length}/${totalSlots.length || 4}`;
    if (occupiedSlots.length >= (totalSlots.length || 4)) {
      occEl.classList.add('full');
    } else {
      occEl.classList.remove('full');
    }
  }

  const slotsContainer = $m('floatWidgetSlots');
  if (slotsContainer) {
    slotsContainer.innerHTML = '';
    slots.forEach((s) => {
      if (s.type === 'closed') return;
      const dot = document.createElement('div');
      dot.className = 'float-widget-slot-dot';
      if (s.id === 1) {
        dot.classList.add('host');
        dot.textContent = '👑';
      } else if (s.type === 'bot') {
        dot.classList.add('bot');
        dot.textContent = '🤖';
      } else if (s.occupiedBy) {
        dot.classList.add('occupied');
        dot.textContent = '👤';
      } else {
        dot.textContent = '+';
      }
      slotsContainer.appendChild(dot);
    });
  }

  const bodyEl = $m('floatWidgetBody');
  if (bodyEl) {
    bodyEl.onclick = reopenFlightRoom;
  }
  const reopenBtn = $m('floatWidgetReopenBtn');
  if (reopenBtn) {
    reopenBtn.onclick = reopenFlightRoom;
  }
  const leaveBtn = $m('floatWidgetLeaveBtn');
  if (leaveBtn) {
    leaveBtn.onclick = (e) => {
      e.stopPropagation();
      leaveFlightRoom();
    };
  }
}

function startNeoraRoomGame() {
  manualRoleOverride = null;
  if (!currentFlightRoom) return;
  const isHost = isCurrentUserHost();

  if (isHost) {
    const slotsSource = (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) ? currentFlightRoom.slots : lobbyState.slots;
    const activeSlots = (Array.isArray(slotsSource) ? slotsSource : []).filter(
      (s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy)
    );
    if (activeSlots.length < 2) {
      if (typeof showToast === 'function') {
        showToast('⚠️ Need at least 2 active players or bots to start! Enable Auto Fill 🤖 or invite friends.');
      }
      return;
    }

    startPartyGame(currentFlightRoom || lobbyState);
    if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'room_start',
        roomId: currentFlightRoom.id,
        initialState: monopolyState
      });
    }
    hideDepartureBoard();
  } else {
    // Joiner toggles ready
    if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'room_toggle_ready',
        roomId: currentFlightRoom.id
      });
    }
  }
}

function copyFlightCode() {
  const code = currentFlightRoom?.code || '472910';
  const displayId = `#BKK-${String(code).slice(0, 4)}`;
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(displayId).then(() => {
      if (typeof showToast === 'function') showToast(`📋 Room ID copied: ${displayId}!`);
    }).catch(() => {});
  } else if (typeof showToast === 'function') {
    showToast(`Room ID: ${displayId}`);
  }
}

function toggleFlightPrivacy(isPublic) {
  if (!currentFlightRoom) return;
  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'room_set_privacy',
      roomId: currentFlightRoom.id,
      isPublic: !!isPublic
    });
  }
  currentFlightRoom.isPublic = !!isPublic;
}

function updateLobbyFlightRoomUI() {
  const codeEl = $m('lobbyFlightCodeText');
  if (codeEl && currentFlightRoom) {
    codeEl.textContent = currentFlightRoom.code || '';
  }
  if (currentFlightRoom && currentNeoraView === 'room') {
    renderNeoraWaitingRoom();
  }
}

function startPartyGame(config = {}) {
  manualRoleOverride = null;
  window.isMonopolyPlayerAway = false;
  if (typeof clearBotTimer === 'function') clearBotTimer();
  const slotsSource = (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) ? currentFlightRoom.slots : lobbyState.slots;
  if (!Array.isArray(slotsSource) || slotsSource.length !== 4) {
    lobbyState.slots = getDefaultLobbySlots(lobbyState.mode);
  }
  const rawSlots = (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) ? currentFlightRoom.slots : lobbyState.slots;
  const normalizedSlots = (Array.isArray(rawSlots) ? rawSlots : []).map((s, idx) => {
    if (s.type === 'human' && !s.occupiedBy) {
      if (!currentFlightRoom || s.id === 1 || idx === 0) {
        return {
          ...s,
          occupiedBy: s.occupiedBy || `user_${s.role || (idx === 0 ? 'bkk' : 'dxb')}`,
          controller: 'HUMAN',
          ready: true,
          connected: true
        };
      }
      const isSeat2 = (s.id === 2 || idx === 1);
      const isSeat3 = (s.id === 3 || idx === 2);
      return {
        ...s,
        type: 'bot',
        controller: 'BOT_PERMANENT',
        difficulty: s.difficulty || 'easy',
        ready: true,
        connected: true,
        name: (s.name && s.name !== 'Open Slot') ? s.name : (isSeat2 ? 'Cadet Mochi 🐣' : (isSeat3 ? 'Pilot Pip 🐱' : 'Trainee Mochi 🐾')),
        avatar: s.avatar || 'assets/bot_mochi.jpg'
      };
    }
    if (s.type === 'human' && s.controller === 'BOT_TEMPORARY') {
      return { ...s, controller: 'HUMAN', connected: true };
    }
    return s;
  });
  if (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) {
    currentFlightRoom.slots = normalizedSlots;
  }
  const activeSlots = normalizedSlots.filter(
    (s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy)
  );
  if (activeSlots.length < 2) {
    if (typeof showToast === 'function') showToast('⚠️ Need at least 2 active players to start! Enable Auto Fill 🤖 or add bots.');
    return;
  }

  // Preserve dedicated 1v1 Bot mode if configured (either via lobby mode or any 2-seat human+bot pairing)
  if (activeSlots.length === 2 && (activeSlots[0].type === 'bot' || activeSlots[1].type === 'bot')) {
    hideMonopolyLobby();
    const botSlot = activeSlots[0].type === 'bot' ? activeSlots[0] : activeSlots[1];
    const soloLevel = botSlot.difficulty || config.soloBot || 'easy';
    startBotGame(soloLevel);
    return;
  }

  const myRole = getMonopolyMyRole();
  const partnerRole = otherRole(myRole);

  const hasBots = activeSlots.some((s) => s.type === 'bot');
  if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') window.SkyPixi.clearAll();
  const fresh = createDefaultMonopolyState();
  fresh.mode = activeSlots.length > 2 ? '4p' : (hasBots ? 'bot' : 'couple');
  fresh.active = true;
  fresh.players = {};
  const turnOrder = [];

  const myAvatarData = window.getMyAvatar ? window.getMyAvatar() : null;
  const partnerAvatarData = window.getPartnerAvatar ? window.getPartnerAvatar() : null;

  const myName = myAvatarData?.name || 'Lord of BKK 🐺';
  const partnerName = partnerAvatarData?.name || 'Khaleesi 🐉';

  const mySprite = myAvatarData?.sprite || myVaultSprite() || 'assets/bkk_warrior_idle.png';
  const partnerSprite = partnerAvatarData?.sprite || partnerVaultSprite() || 'assets/got_queen_idle.png';

  activeSlots.forEach((slot, idx) => {
    const role = slot.role || (slot.id === 1 ? 'bkk' : slot.id === 2 ? 'dxb' : slot.id === 3 ? 'bot1' : slot.id === 4 ? 'bot2' : (idx === 0 ? 'bkk' : idx === 1 ? 'dxb' : idx === 2 ? 'bot1' : 'bot2'));
    turnOrder.push(role);
    const p = makePlayer(role);

    p.isBot = slot.type === 'bot' || slot.controller === 'BOT_PERMANENT';
    if (p.isBot) {
      p.botLevel = slot.difficulty || 'easy';
      const isEasy = p.botLevel === 'easy';
      const isInsane = p.botLevel === 'insane';
      let defaultBotName = (slot.id === 2 || idx === 1) ? (isEasy ? 'Cadet Mochi 🐣' : isInsane ? 'Astral Sovereign 🌌' : 'Major Whiskers 🐯')
        : (slot.id === 3 || idx === 2) ? (isEasy ? 'Pilot Pip 🐱' : isInsane ? 'Chrono Sovereign ⏳' : 'Admiral Claw 🦁')
        : (isEasy ? 'Trainee Mochi 🐾' : isInsane ? 'Apex Sovereign ⚡' : 'Capt. Whiskers 😼');
      p.name = (slot.name && slot.name !== 'Open Slot') ? slot.name : defaultBotName;
      p.sprite = (slot.avatar && slot.avatar !== '') ? slot.avatar : (isEasy ? 'assets/bot_mochi.jpg' : 'assets/bot_captain.jpg');
      p.badge = isInsane ? 'SOV' : `BOT${slot.id > 1 ? slot.id - 1 : (idx > 0 ? idx : '')}`;
      p.color = isInsane ? '#a855f7' : (slot.id === 3 ? '#10b981' : (slot.id === 4 ? '#f59e0b' : '#06b6d4'));

      if (isInsane) {
        const mythicId = (window.NookMonoBot && typeof window.NookMonoBot.getRandomMythicId === 'function')
          ? window.NookMonoBot.getRandomMythicId()
          : 's6_supernova_m';
        p.costume = mythicId;
        p.activeCostume = mythicId;
        const C = window.NookCostumes;
        if (C && C.BY_ID && C.BY_ID[mythicId]) {
          const c = C.BY_ID[mythicId];
          const perkKey = c.perk;
          const perkData = (C.PERKS && C.PERKS[perkKey]) || {};
          if (!fresh.perks) fresh.perks = {};
          fresh.perks[role] = { costume: mythicId, [perkKey]: true, ...perkData };
          if (c.sprite) p.sprite = c.sprite;
        }
      }
    } else {
      const isMe = (slot.occupiedBy === `user_${myRole}`) || (slot.id === 1 && !slot.occupiedBy) || (slot.id === 1 && isCurrentUserHost());
      p.name = (slot.name && slot.name !== 'Open Slot') ? slot.name : (isMe ? myName : (slot.id === 2 ? partnerName : `Guest ${slot.id} ✈️`));
      p.sprite = (slot.avatar && slot.avatar !== '') ? slot.avatar : (isMe ? mySprite : (slot.id === 2 ? partnerSprite : 'assets/bkk_warrior_idle.png'));
      p.color = slot.id === 1 ? '#ef4444' : (slot.id === 2 ? '#06b6d4' : (slot.id === 3 ? '#10b981' : '#f59e0b'));
      p.badge = `P${slot.id || (idx + 1)}`;
    }
    fresh.players[role] = p;
  });

  fresh.turnOrder = turnOrder;
  fresh.currentTurn = turnOrder[0];

  const currentPlayed = Array.isArray(monopolyState.playedCardIds) ? monopolyState.playedCardIds : [];
  const persistent = loadPersistentPlayedCardIds();
  fresh.playedCardIds = Array.from(new Set([...currentPlayed, ...persistent].map(Number).filter(isValidCardId)));
  savePersistentPlayedCardIds(fresh.playedCardIds);

  const playedSet = new Set(fresh.playedCardIds);
  const remaining = (monopolyState.cardDeck || []).map(Number).filter((id) => isValidCardId(id) && !playedSet.has(id));
  if (remaining.length > 0) {
    fresh.cardDeck = remaining;
  } else {
    const unplayed = CARD_DECK.filter((c) => !playedSet.has(c.id)).map((c) => c.id);
    fresh.cardDeck = shuffleArray(unplayed.length > 0 ? unplayed : CARD_DECK.map((c) => c.id));
  }

  fresh.gameId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  fresh.perks = (window.NookVault && window.NookVault.monopolyPerks) ? window.NookVault.monopolyPerks() : {};
  fresh.perkUsed = {};
  if (fresh.perks) {
    Object.keys(fresh.players).forEach((r) => {
      const pl = fresh.players[r];
      if (pl.isBot && pl.botLevel !== 'insane') return; // Easy and Hard bots get zero perks
      const pk = fresh.perks[r] || {};
      if (pk.startMiles) pl.miles += pk.startMiles;
      if (pk.extraVibePass) pl.vibePasses += pk.extraVibePass;
      if (pk.startItem && ITEMS[pk.startItem] && pl.inventory.length < MONO_CFG.MAX_ITEMS) pl.inventory.push(pk.startItem);
      if (pk.reverseRentHex || isPhantomRoyalty(r)) pl.phantomRentReversals = 2;
    });
  }

  // Veteran Captain starter kit for Hard Bots (Strictly Zero skills & Zero ultimates)
  Object.keys(fresh.players).forEach((r) => {
    const pl = fresh.players[r];
    if (pl && pl.isBot && pl.botLevel === 'hard') {
      pl.miles += 200;
      if (pl.inventory.length < MONO_CFG.MAX_ITEMS) {
        pl.inventory.push('shield');
      }
    }
  });

  monopolyState = fresh;
  saveLocalMonopolyState();
  hideMonopolyLobby();
  hideModal();
  hideCardOverlay();
  hideVictory();

  const modal = $m('monopolyModal');
  if (modal) {
    document.body?.classList.add('has-active-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  cleanBoardVisualsForNewGame();

  renderAll({ instant: true });
  setMonopolyTicker(`🛫 <strong>All passengers boarded!</strong> Flight SKY-777 underway with ${turnOrder.length} players. First to <strong>${fmt(MONO_CFG.WIN_NET_WORTH)} net worth</strong> wins! Tap <strong>ROLL</strong>.`);

  if (typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'monopoly_start_party',
      state: monopolyState,
      config: config
    });
  }
}

function promptResetOrMode() {
  hideVictory();
  if (monopolyState) monopolyState.gameOver = null;
  saveLocalMonopolyState();
  if (typeof showDepartureBoard === 'function') {
    showDepartureBoard();
  } else {
    showMonopolyLobby();
  }
}

function resetMonopolyGame() {
  window.isMonopolyPlayerAway = false;
  if (typeof clearBotTimer === 'function') clearBotTimer();
  if (currentFlightRoom && Array.isArray(currentFlightRoom.slots) && currentFlightRoom.slots.length > 0) {
    startPartyGame(currentFlightRoom);
    return;
  }
  const myRole = getMonopolyMyRole();
  const partnerRole = otherRole(myRole);
  if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') window.SkyPixi.clearAll();
  const fresh = createDefaultMonopolyState();
  fresh.mode = 'couple';
  fresh.active = true;
  // Keep card memory across game sessions so cards never repeat!
  const currentPlayed = Array.isArray(monopolyState.playedCardIds) ? monopolyState.playedCardIds : [];
  const persistent = loadPersistentPlayedCardIds();
  const union = new Set([...currentPlayed, ...persistent].map(Number).filter(isValidCardId));
  fresh.playedCardIds = Array.from(union);
  savePersistentPlayedCardIds(fresh.playedCardIds);

  // Preserve unplayed cards or replenish from remaining unplayed pool
  const playedSet = new Set(fresh.playedCardIds);
  const remaining = (monopolyState.cardDeck || []).map(Number).filter((id) => isValidCardId(id) && !playedSet.has(id));
  if (remaining.length > 0) {
    fresh.cardDeck = remaining;
  } else {
    const unplayed = CARD_DECK.filter((c) => !playedSet.has(c.id)).map((c) => c.id);
    fresh.cardDeck = shuffleArray(unplayed.length > 0 ? unplayed : CARD_DECK.map((c) => c.id));
  }
  ['bkk', 'dxb'].forEach((r) => {
    fresh.players[r].name = (monopolyState.mode !== 'bot' && monopolyState.players[r].name) || fresh.players[r].name;
    fresh.players[r].sprite = (monopolyState.mode !== 'bot' && monopolyState.players[r].sprite) || fresh.players[r].sprite;
  });
  if (window.myAvatar && window.myAvatar.sprite) {
    fresh.players[myRole].sprite = window.myAvatar.sprite;
    fresh.players[myRole].name = window.myAvatar.name || fresh.players[myRole].name;
  }
  if (window.partnerAvatar && window.partnerAvatar.sprite) {
    fresh.players[partnerRole].sprite = window.partnerAvatar.sprite;
    fresh.players[partnerRole].name = window.partnerAvatar.name || fresh.players[partnerRole].name;
  }
  if (myVaultSprite()) fresh.players[myRole].sprite = myVaultSprite();
  if (partnerVaultSprite()) fresh.players[partnerRole].sprite = partnerVaultSprite();

  // 💎 Lock in each player's costume perk for this game
  fresh.gameId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  fresh.perks = (window.NookVault && window.NookVault.monopolyPerks) ? window.NookVault.monopolyPerks() : null;
  fresh.perkUsed = {};
  const perkNotes = [];
  if (fresh.perks) {
    ['bkk', 'dxb'].forEach((r) => {
      const pk = fresh.perks[r] || {};
      const pl = fresh.players[r];
      if (pk.startMiles) pl.miles += pk.startMiles;
      if (pk.extraVibePass) pl.vibePasses += pk.extraVibePass;
      if (pk.startItem && ITEMS[pk.startItem] && pl.inventory.length < MONO_CFG.MAX_ITEMS) pl.inventory.push(pk.startItem);
      if (pk.reverseRentHex || isPhantomRoyalty(r)) pl.phantomRentReversals = 2;
      const C = window.NookCostumes;
      if (pk.costume && C && C.BY_ID[pk.costume]) {
        const perk = C.PERKS[C.BY_ID[pk.costume].perk];
        perkNotes.push(`${pl.badge} ${perk.icon} ${perk.name}${pk.resonance ? ' 💞' : ''}`);
      }
    });
  }
  monopolyState = fresh;
  saveLocalMonopolyState();
  hideModal();
  hideCardOverlay();
  hideVictory();
  cleanBoardVisualsForNewGame();
  renderAll({ instant: true });
  setMonopolyTicker(`🔄 New game! First to <strong>${fmt(MONO_CFG.WIN_NET_WORTH)} net worth</strong> wins.${perkNotes.length ? ` Perks: <strong>${perkNotes.join(' · ')}</strong>.` : ''} Tap <strong>ROLL</strong>!`);
  if (typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_action', action: 'reset_game', state: monopolyState });
  }
}

// =========================================================
// 13. BOARD & HUD RENDERING
// =========================================================
let boardHydrated = false;

function ensureBoardBuilt() {
  const grid = $m('monopolyBoardGrid');
  if (!grid) return null;
  if (grid.dataset.built === '1') return grid;
  const hub = $m('monopolyCenterHub');
  grid.innerHTML = '';
  if (hub) grid.appendChild(hub);
  MONOPOLY_TILES.forEach((tile) => {
    const pos = TILE_GRID_POSITIONS[tile.id];
    const el = document.createElement('div');
    el.className = `board-tile tile-type-${tile.type} tile-zone-${tile.zone}`;
    if (tile.zone === 'corner') el.classList.add('corner-tile');
    el.id = `boardTile_${tile.id}`;
    el.style.gridRow = pos.row;
    el.style.gridColumn = pos.col;
    const isProp = tile.type === 'property';
    const zoneLabel = ZONES[tile.zone] ? ZONES[tile.zone].label.toUpperCase() : '';
    el.innerHTML = `
      ${isProp ? `<div class="tile-category-strip zone-${tile.zone}"><span class="category-name">${zoneLabel}</span></div>` : ''}
      ${isProp ? '<div class="tile-owner-ribbon unowned"></div>' : ''}
      <div class="tile-zone-bar zone-${tile.zone}"></div>
      <div class="tile-monopoly-buildings"></div>
      <div class="tile-content-body">
        <span class="tile-icon">${tile.icon}</span>
        <span class="tile-name">${tile.shortName}</span>
        <span class="tile-pill"></span>
      </div>`;
    el.addEventListener('click', () => inspectTile(tile));
    grid.appendChild(el);
  });
  grid.dataset.built = '1';
  return grid;
}

function updateBoardTiles({ animate = true } = {}) {
  const st = monopolyState;
  const changed = [];
  MONOPOLY_TILES.forEach((tile) => {
    const el = $m(`boardTile_${tile.id}`);
    if (!el) return;
    const hasBanana = !!(st.bananaTraps && st.bananaTraps[tile.id] > 0);
    const hasWish = !!(st.wishSanctuaries && st.wishSanctuaries[tile.id]);
    const hasSnowdrift = !!(st.snowdriftTraps && st.snowdriftTraps[tile.id] > 0);
    const hasWaterway = !!(st.sacredWaterways && st.sacredWaterways[tile.id]);
    const hasTorii = !!(st.inariToriiGates && st.inariToriiGates[tile.id]);
    const hasEclipseShadow = !!(st.eclipseShadowTiles && st.eclipseShadowTiles[tile.id]);
    const hasDjinnOasis = !!(st.djinnOasisTiles && st.djinnOasisTiles[tile.id]);
    const hasPhoenixEmbers = !!(st.phoenixEmbers && st.phoenixEmbers[tile.id]);
    const hasFlooded = !!(st.floodedTiles && st.floodedTiles[tile.id]);
    const hasRevHex = !!(st.reverseRentHexTile === tile.id);
    const isCitadelAuraNonProp = (st && st.glacialCitadelTile != null) && (tile.id === (st.glacialCitadelTile - 1 + 20) % 20 || tile.id === (st.glacialCitadelTile + 1) % 20);

    el.classList.toggle('tile-banana-trap', hasBanana);
    el.classList.toggle('tile-wish-sanctuary', hasWish);
    el.classList.toggle('tile-snowdrift-trap', hasSnowdrift);
    el.classList.toggle('tile-naga-waterway', hasWaterway);
    el.classList.toggle('tile-inari-torii', hasTorii);
    el.classList.toggle('tile-eclipse-shadow', hasEclipseShadow);
    el.classList.toggle('tile-djinn-oasis', hasDjinnOasis);
    el.classList.toggle('tile-phoenix-embers', hasPhoenixEmbers);
    el.classList.toggle('tile-flooded', hasFlooded);
    el.classList.toggle('tile-atlantis-flooded', hasFlooded);
    el.classList.toggle('tile-reverse-hex', hasRevHex);

    const pill = el.querySelector('.tile-pill');
    if (tile.type !== 'property') {
      el.classList.toggle('tile-citadel-aura', isCitadelAuraNonProp);
      el.classList.remove('is-coral-palace', 'is-sunken-ruin', 'fx-midas-glow');
      const bld = el.querySelector('.tile-monopoly-buildings');
      if (bld && typeof getTile25dLandmarkHtml === 'function') {
        const landmarkHtml = getTile25dLandmarkHtml(tile.id, null, st);
        if (bld.dataset.lm !== landmarkHtml) {
          bld.innerHTML = landmarkHtml;
          bld.dataset.lm = landmarkHtml;
        }
        const hasMonument = landmarkHtml.includes('monument-25d-wrap');
        el.classList.toggle('has-monument', hasMonument);
      }
      if (!el.dataset.sig) { pill.className = 'tile-pill tile-special-pill'; pill.textContent = tile.shortName; el.dataset.sig = 'x'; }
      return;
    }
    const prop = st.properties[tile.id];
    const zoneMono = !!(prop && ownsZone(prop.owner, tile.zone));
    const trapFlags = `${hasWish ? 1 : 0}${hasSnowdrift ? 1 : 0}${hasWaterway ? 1 : 0}${hasTorii ? 1 : 0}${hasEclipseShadow ? 1 : 0}${hasDjinnOasis ? 1 : 0}${hasPhoenixEmbers ? 1 : 0}${hasFlooded ? 1 : 0}${hasRevHex ? 1 : 0}${hasBanana ? 1 : 0}`;
    const ownerGoldRush = prop && prop.owner && st.players?.[prop.owner]?.monacoGoldRushRounds > 0 ? 1 : 0;
    const propFlags = prop
      ? `${prop.frosted || 0}:${prop.isTransmutedGold ? 1 : 0}:${prop.isGoldenPyramid || (st.goldenPyramidTile === tile.id && (!st.goldenPyramidOwner || prop.owner === st.goldenPyramidOwner)) ? 1 : 0}:${prop.isGlacialCitadel || (st.glacialCitadelTile === tile.id && (!st.glacialCitadelOwner || prop.owner === st.glacialCitadelOwner)) ? 1 : 0}:${prop.isOlympusTemple || (st.olympusTempleTile === tile.id && (!st.olympusTempleOwner || prop.owner === st.olympusTempleOwner)) ? 1 : 0}:${prop.isSolarObelisk || (st.solarObeliskTile === tile.id && prop.owner && typeof isSolarDivinity === 'function' && isSolarDivinity(prop.owner)) ? 1 : 0}:${prop.monumentSuppressedRounds || 0}:${ownerGoldRush}:${prop.frostShield ? 1 : 0}:${prop.torchShield ? 1 : 0}`
      : '0:0:0:0:0:0:0:0:0:0';
    const sig = prop
      ? `${prop.owner}|${prop.level}|${zoneMono ? 1 : 0}|${getTileRent(tile.id)}|${prop.shield || 0}|${prop.waterShield ? 1 : 0}|${prop.enchantedTurret ? 1 : 0}|${trapFlags}|${propFlags}`
      : `-|0|0|${tile.price}|0|0|0|${trapFlags}|${propFlags}`;
    if (el.dataset.sig === sig) return;
    const prev = el.dataset.sig ? el.dataset.sig.split('|') : null;
    el.dataset.sig = sig;
    changed.push({ tile, el, prev, prop, zoneMono });
  });
  // Big batches (hydration, Final Boarding rent change) apply instantly
  const anim = animate && boardHydrated && changed.length <= 3 && !!window.MonoFX;
  changed.forEach((c) => applyTileChange(c, anim));
  boardHydrated = true;
}

function getTile25dLandmarkHtml(tileId, prop, st) {
  if (!st) return '';
  const isSuppressed = !!(prop && prop.monumentSuppressedRounds && prop.monumentSuppressedRounds > 0);
  const isPyramid = !!(prop && (prop.isGoldenPyramid || (st.goldenPyramidTile === tileId && (!st.goldenPyramidOwner || prop.owner === st.goldenPyramidOwner))));
  const isCitadel = !!(prop && (prop.isGlacialCitadel || (st.glacialCitadelTile === tileId && (!st.glacialCitadelOwner || prop.owner === st.glacialCitadelOwner))));
  const isOlympus = !!(prop && (prop.isOlympusTemple || (st.olympusTempleTile === tileId && (!st.olympusTempleOwner || prop.owner === st.olympusTempleOwner))));
  const isSolarObelisk = !!(prop && (prop.isSolarObelisk || (prop.owner && typeof isSolarDivinity === 'function' && isSolarDivinity(prop.owner) && (st.solarObeliskTile === tileId || (prop.level || 1) >= 3))));
  const isWonder = isPyramid || isCitadel || isOlympus || isSolarObelisk;
  const isTransmuted = !!(prop && prop.isTransmutedGold);
  const isTorii = !!(st.inariToriiGates && st.inariToriiGates[tileId]);
  const isHexMirror = !!(st.reverseRentHexTile === tileId);
  const isCoralPalace = !!(st.floodedTiles && st.floodedTiles[tileId] && prop && prop.owner && typeof isAbyssalDrifter === 'function' && isAbyssalDrifter(prop.owner));
  const isSunkenRuins = !!(st.floodedTiles && st.floodedTiles[tileId] && prop && prop.owner && typeof isAbyssalDrifter === 'function' && !isAbyssalDrifter(prop.owner));
  const isNagaShrine = !!(!isWonder && ((st.sacredWaterways && st.sacredWaterways[tileId]) || (prop && prop.waterShield)));
  const isEclipseDisk = !!(!isWonder && ((st.eclipseShadowTiles && st.eclipseShadowTiles[tileId]) || (prop && prop.owner && typeof isCelestialEclipse === 'function' && isCelestialEclipse(prop.owner) && (prop.level || 1) >= 3)));
  const isRoseTurret = !!(prop && prop.enchantedTurret && !isWonder);
  const isDjinnOasis = !!(st.djinnOasisTiles && st.djinnOasisTiles[tileId] && !isWonder);
  const isPhoenixCrater = !!(st.phoenixEmbers && st.phoenixEmbers[tileId] && !isWonder);
  const isWishSanctuary = !!(st.wishSanctuaries && st.wishSanctuaries[tileId] && !isWonder);
  const isMonacoPenthouse = !!(!isWonder && prop && prop.owner && typeof isMonacoHighRoller === 'function' && isMonacoHighRoller(prop.owner) && ((prop.level || 1) >= 3 || st.players?.[prop.owner]?.monacoGoldRushRounds > 0));
  const isAstralCore = !!(!isWonder && prop && prop.owner && typeof isAstralSovereign === 'function' && isAstralSovereign(prop.owner) && ((prop.shield || 0) > 0 || (prop.level || 1) >= 3));
  const isClockworkPalace = !!(!isWonder && prop && prop.owner && typeof isClockworkSovereign === 'function' && isClockworkSovereign(prop.owner) && (prop.level || 1) >= 3);
  const isPhantomOpera = !!(!isWonder && !isHexMirror && prop && prop.owner && typeof isPhantomRoyalty === 'function' && isPhantomRoyalty(prop.owner) && (prop.level || 1) >= 3);
  const isPhoenixPyre = !!(!isWonder && !isPhoenixCrater && prop && prop.owner && typeof isPhoenixAscendant === 'function' && isPhoenixAscendant(prop.owner) && (prop.level || 1) >= 3);
  const isRapunzelTower = !!(!isWonder && !isWishSanctuary && prop && prop.owner && typeof isSundropTower === 'function' && isSundropTower(prop.owner) && (prop.level || 1) >= 3);

  if (isPyramid) {
    const badge = isSuppressed ? '<span class="monument-badge-mirror">🎭 ECLIPSED</span>' : '<span class="monument-badge-gold">👑 2× RENT</span>';
    return `<div class="monument-25d-wrap landmark-pyramid ${isSuppressed ? 'monument-suppressed' : ''}" title="The Great Golden Pyramid"><div class="monument-25d-shadow"></div><div class="monument-25d-aura ${isSuppressed ? 'aura-mirror' : 'aura-gold'}"></div><img src="assets/thumbs/s9/golden_pyramid.png" decoding="async" class="monument-25d-img pyramid-img" alt="The Great Golden Pyramid" />${badge}</div>`;
  }
  if (isCitadel) {
    const badge = isSuppressed ? '<span class="monument-badge-mirror">🎭 ECLIPSED</span>' : '<span class="monument-badge-ice">❄️ CITADEL</span>';
    return `<div class="monument-25d-wrap landmark-citadel ${isSuppressed ? 'monument-suppressed' : ''}" title="Glacial Ice Citadel"><div class="monument-25d-shadow"></div><div class="monument-25d-aura ${isSuppressed ? 'aura-mirror' : 'aura-cyan'}"></div><img src="assets/thumbs/s8/glacial_citadel.png" decoding="async" class="monument-25d-img citadel-img" alt="Glacial Ice Citadel" />${badge}</div>`;
  }
  if (isOlympus) {
    const badge = isSuppressed ? '<span class="monument-badge-mirror">🎭 ECLIPSED</span>' : '<span class="monument-badge-thunder">⚡ TEMPLE</span>';
    return `<div class="monument-25d-wrap landmark-olympus ${isSuppressed ? 'monument-suppressed' : ''}" title="Mount Olympus Temple"><div class="monument-25d-shadow"></div><div class="monument-25d-aura ${isSuppressed ? 'aura-mirror' : 'aura-thunder'}"></div><img src="assets/thumbs/s11/olympus_temple.png" decoding="async" class="monument-25d-img olympus-img" alt="Mount Olympus Temple" /><span class="olympus-lightning-rod">⚡</span>${badge}</div>`;
  }
  if (isSolarObelisk) {
    const badge = isSuppressed ? '<span class="monument-badge-mirror">🎭 ECLIPSED</span>' : '<span class="monument-badge-gold">☀️ +25% RA</span>';
    return `<div class="monument-25d-wrap landmark-solar-obelisk ${isSuppressed ? 'monument-suppressed' : ''}" title="Heliopolis Sun Disk Obelisk (+25% Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura ${isSuppressed ? 'aura-mirror' : 'aura-fire'}"></div><img src="assets/thumbs/s3/phoenix_sunfire_crest.png" decoding="async" class="monument-25d-img pyramid-img" alt="Sun Disk Obelisk" />${badge}</div>`;
  }
  if (isTransmuted) {
    return '<div class="monument-25d-wrap landmark-midas-gold" title="Midas Solid Gold Hotel (0 Rent · +80🪙)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-midas"></div><img src="assets/thumbs/props/midas_gold_hotel.png" decoding="async" class="monument-25d-img midas-img" alt="Solid Gold Hotel" /><span class="monument-badge-gold">⚱️ SOLID GOLD</span></div>';
  }
  if (isHexMirror) {
    return '<div class="monument-25d-wrap landmark-hex-mirror" title="Venetian Reverse Rent Hex Mirror"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-mirror"></div><img src="assets/thumbs/s10/venetian_mirror.png" decoding="async" class="monument-25d-img mirror-img" alt="Reverse Hex Mirror" /><span class="monument-badge-mirror">🪞 REVERSE HEX</span></div>';
  }
  if (isTorii) {
    return '<div class="monument-25d-wrap landmark-inari-torii" title="Inari Sacred Torii Gate"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-torii"></div><img src="assets/thumbs/s2/inari_torii_gate.png" decoding="async" class="monument-25d-img torii-img" alt="Inari Torii Gate" /><span class="monument-badge-torii">⛩️ TORII</span></div>';
  }
  if (isCoralPalace) {
    return '<div class="monument-25d-wrap landmark-coral-palace" title="Abyssal Coral Palace (+30% Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-coral"></div><img src="assets/thumbs/s5/abyssal_coral_reef.png" decoding="async" class="monument-25d-img coral-img" alt="Coral Palace" /><span class="monument-badge-coral">🪸 +30% RENT</span></div>';
  }
  if (isSunkenRuins) {
    return '<div class="monument-25d-wrap landmark-sunken-ruin" title="Sunken Atlantis Ruins (0 Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-sunken"></div><img src="assets/thumbs/s5/abyssal_coral_reef.png" decoding="async" class="monument-25d-img sunken-img" alt="Sunken Ruins" /><span class="monument-badge-sunken">🔱 0 RENT</span></div>';
  }
  if (isNagaShrine) {
    return '<div class="monument-25d-wrap landmark-naga-shrine" title="Sacred Mekong Naga Shrine (+30% Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-coral"></div><img src="assets/thumbs/s1/naga_emerald_crest.png" decoding="async" class="monument-25d-img coral-img" alt="Sacred Naga Shrine" /><span class="monument-badge-coral">🐉 NAGA</span></div>';
  }
  if (isEclipseDisk) {
    return '<div class="monument-25d-wrap landmark-eclipse-disk" title="Celestial Eclipse Astrolabe (1.5× Nightmare Toll)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-oasis"></div><img src="assets/thumbs/s2/eclipse_moon_disk.png" decoding="async" class="monument-25d-img oasis-img" alt="Eclipse Astrolabe" /><span class="monument-badge-oasis">🌓 ECLIPSE</span></div>';
  }
  if (isRoseTurret) {
    return '<div class="monument-25d-wrap landmark-rose-turret" title="Enchanted Rose Cloche Turret (+30% Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-rose"></div><img src="assets/thumbs/s7/enchanted_rose_cloche.png" decoding="async" class="monument-25d-img rose-img" alt="Enchanted Rose" /><span class="monument-badge-rose">🌹 TURRET</span></div>';
  }
  if (isDjinnOasis) {
    return '<div class="monument-25d-wrap landmark-djinn-oasis" title="Mirage Oasis Portal"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-oasis"></div><img src="assets/thumbs/s3/mirage_oasis_portal.png" decoding="async" class="monument-25d-img oasis-img" alt="Oasis Portal" /><span class="monument-badge-oasis">🪔 OASIS</span></div>';
  }
  if (isPhoenixCrater) {
    return '<div class="monument-25d-wrap landmark-phoenix-crater" title="Phoenix Molten Crater (-40🪙)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-fire"></div><img src="assets/thumbs/s3/phoenix_molten_crater.png" decoding="async" class="monument-25d-img crater-img" alt="Molten Crater" /><span class="monument-badge-fire">🔥 -40🪙</span></div>';
  }
  if (isWishSanctuary) {
    return '<div class="monument-25d-wrap landmark-wish-sanctuary" title="Lantern Wish Sanctuary (+150🪙)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-gold"></div><img src="assets/ui/lantern_mythic.png" decoding="async" class="monument-25d-img pyramid-img" alt="Wish Lantern" /><span class="monument-badge-gold">🏮 WISH</span></div>';
  }
  if (isMonacoPenthouse) {
    const isRush = !!(st.players?.[prop.owner]?.monacoGoldRushRounds > 0);
    return `<div class="monument-25d-wrap landmark-monaco-royale" title="Casino Royale Roulette Penthouse"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-gold"></div><svg viewBox="0 0 100 100" class="monument-25d-img pyramid-img"><circle cx="50" cy="50" r="46" fill="#b45309" stroke="#fde047" stroke-width="4"/><circle cx="50" cy="50" r="36" fill="#0f172a" stroke="#ffd700" stroke-width="2"/><circle cx="50" cy="50" r="32" fill="none" stroke="#dc2626" stroke-width="6" stroke-dasharray="6.28 6.28"/><polygon points="50,24 54,46 50,50 46,46" fill="#ffd700"/><polygon points="50,76 54,54 50,50 46,54" fill="#ffd700"/><polygon points="24,50 46,46 50,50 46,54" fill="#ffd700"/><polygon points="76,50 54,46 50,50 54,54" fill="#ffd700"/><circle cx="50" cy="50" r="8" fill="#ffffff"/></svg><span class="monument-badge-gold">${isRush ? '🎰 1.5× RUSH' : '🎰 VIP +15%'}</span></div>`;
  }
  if (isAstralCore) {
    return '<div class="monument-25d-wrap landmark-astral-core" title="Supernova Celestial Core (+25% Rent)"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-oasis"></div><svg viewBox="0 0 100 100" class="monument-25d-img oasis-img"><circle cx="50" cy="50" r="42" fill="rgba(168,85,247,0.45)" stroke="#e879f9" stroke-width="3" stroke-dasharray="8 4"/><path d="M50 4 L57 43 L96 50 L57 57 L50 96 L43 57 L4 50 L43 43 Z" fill="#ffffff"/><path d="M50 16 L55 45 L84 50 L55 55 L50 84 L45 55 L16 50 L45 45 Z" fill="#fde047" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="12" fill="#38bdf8"/></svg><span class="monument-badge-oasis">🪐 +25% AEGIS</span></div>';
  }
  if (isClockworkPalace) {
    return '<div class="monument-25d-wrap landmark-clockwork-palace" title="Clockwork Diamond Palace"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-cyan"></div><svg viewBox="0 0 100 100" class="monument-25d-img citadel-img"><circle cx="50" cy="50" r="44" fill="#0f172a" stroke="#7dd3fc" stroke-width="4"/><circle cx="50" cy="50" r="36" fill="none" stroke="#fde047" stroke-width="3" stroke-dasharray="5 5"/><line x1="50" y1="50" x2="50" y2="20" stroke="#fde047" stroke-width="5" stroke-linecap="round"/><line x1="50" y1="50" x2="72" y2="50" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="7" fill="#ffffff"/></svg><span class="monument-badge-ice">⏳ PALACE</span></div>';
  }
  if (isPhantomOpera) {
    return '<div class="monument-25d-wrap landmark-phantom-opera" title="Venetian Grand Opera House"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-mirror"></div><img src="assets/thumbs/s10/venetian_mask.png" decoding="async" class="monument-25d-img mirror-img" alt="Venetian Opera Mask" /><span class="monument-badge-mirror">🎭 OPERA</span></div>';
  }
  if (isPhoenixPyre) {
    return '<div class="monument-25d-wrap landmark-phoenix-pyre" title="Sacred Sunfire Pyre"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-fire"></div><img src="assets/thumbs/s3/phoenix_sunfire_crest.png" decoding="async" class="monument-25d-img crater-img" alt="Phoenix Sunfire Crest" /><span class="monument-badge-fire">🔥 PYRE</span></div>';
  }
  if (isRapunzelTower) {
    return '<div class="monument-25d-wrap landmark-rapunzel-tower" title="Sundrop Lantern Spire"><div class="monument-25d-shadow"></div><div class="monument-25d-aura aura-gold"></div><img src="assets/ui/lantern_mythic.png" decoding="async" class="monument-25d-img pyramid-img" alt="Sundrop Lantern" /><span class="monument-badge-gold">🏮 SPIRE</span></div>';
  }

  // Standard houses / hotel
  if (prop) {
    if (prop.level >= 3) {
      return '<span class="building-hotel" title="Grand Hotel">🏨</span>';
    }
    return '<span class="building-house">🏠</span>'.repeat(prop.level || 1);
  }
  return '';
}

function applyTileChange({ tile, el, prev, prop, zoneMono }, anim) {
  const st = monopolyState;
  const ribbon = el.querySelector('.tile-owner-ribbon');
  const bld = el.querySelector('.tile-monopoly-buildings');
  const pill = el.querySelector('.tile-pill');
  const prevOwner = prev && prev[0] !== '-' ? prev[0] : null;
  const prevLevel = prev ? Number(prev[1]) : 0;

  el.classList.toggle('owned-bkk', !!prop && prop.owner === 'bkk');
  el.classList.toggle('owned-dxb', !!prop && prop.owner === 'dxb');
  el.classList.toggle('owned-bot1', !!prop && prop.owner === 'bot1');
  el.classList.toggle('owned-bot2', !!prop && prop.owner === 'bot2');
  el.classList.toggle('tile-fairytale-domain', !!prop && isSundropTower(prop.owner));
  el.classList.toggle('tile-clockwork-domain', !!prop && isClockworkSovereign(prop.owner));
  el.classList.toggle('tile-enchanted-domain', !!prop && isBeastAdam(prop.owner));
  el.classList.toggle('tile-frost-domain', !!prop && isFrostSovereign(prop.owner));
  el.classList.toggle('tile-gilded-domain', !!prop && isGildedSovereign(prop.owner));
  el.classList.toggle('tile-solar-domain', !!prop && isSolarDivinity(prop.owner));
  el.classList.toggle('tile-astral-domain', !!prop && isAstralSovereign(prop.owner));
  el.classList.toggle('tile-phantom-domain', !!prop && isPhantomRoyalty(prop.owner));
  el.classList.toggle('tile-olympus-domain', !!prop && isOlympusDivinity(prop.owner));
  el.classList.toggle('tile-reverse-hex', !!(st.reverseRentHexTile === tile.id));
  el.classList.toggle('tile-monaco-domain', !!prop && isMonacoHighRoller(prop.owner));
  el.classList.toggle('tile-naga-domain', !!prop && isNagaWarden(prop.owner));
  el.classList.toggle('tile-inari-domain', !!prop && isInariFoxfire(prop.owner));
  el.classList.toggle('tile-eclipse-domain', !!prop && isCelestialEclipse(prop.owner));
  el.classList.toggle('tile-djinn-domain', !!prop && isDjinnMirage(prop.owner));
  el.classList.toggle('tile-phoenix-domain', !!prop && isPhoenixAscendant(prop.owner));
  el.classList.toggle('tile-foxfire-cursed', !!(prop && prop.foxfireCursedBy));
  el.classList.toggle('tile-water-shielded', !!(prop && prop.waterShield));
  el.classList.toggle('tile-celestial-shielded', !!(prop && prop.shield > 0));
  el.classList.toggle('tile-enchanted-turret', !!(prop && prop.enchantedTurret));
  el.classList.toggle('tile-torch-shield', !!(prop && prop.torchShield));
  el.classList.toggle('tile-frost-shielded', !!(prop && prop.frostShield));
  el.classList.toggle('tile-frosted', !!(prop && prop.frosted && prop.frosted > 0));
  el.classList.toggle('tile-snowdrift-trap', !!(st.snowdriftTraps && st.snowdriftTraps[tile.id] > 0));
  el.classList.toggle('tile-wish-sanctuary', !!(st.wishSanctuaries && st.wishSanctuaries[tile.id]));
  el.classList.toggle('tile-banana-trap', !!(st.bananaTraps && st.bananaTraps[tile.id] > 0));

  // 🐉 S1 Sacred Waterways, 🦊 S2 Inari Torii, ☀️ S2 Eclipse Shadow, 🪔 S3 Djinn Oasis, 🔥 S3 Phoenix Embers, 🔱 S5 Atlantis Flooded
  el.classList.toggle('tile-naga-waterway', !!(st.sacredWaterways && st.sacredWaterways[tile.id]));
  el.classList.toggle('tile-inari-torii', !!(st.inariToriiGates && st.inariToriiGates[tile.id]));
  el.classList.toggle('tile-eclipse-shadow', !!(st.eclipseShadowTiles && st.eclipseShadowTiles[tile.id]));
  el.classList.toggle('tile-djinn-oasis', !!(st.djinnOasisTiles && st.djinnOasisTiles[tile.id]));
  el.classList.toggle('tile-phoenix-embers', !!(st.phoenixEmbers && st.phoenixEmbers[tile.id]));
  el.classList.toggle('tile-atlantis-flooded', !!(st.floodedTiles && st.floodedTiles[tile.id]));
  el.classList.toggle('is-coral-palace', !!(st.floodedTiles && st.floodedTiles[tile.id] && prop && prop.owner && isAbyssalDrifter(prop.owner)));
  el.classList.toggle('is-sunken-ruin', !!(st.floodedTiles && st.floodedTiles[tile.id] && prop && prop.owner && !isAbyssalDrifter(prop.owner)));
  el.classList.toggle('tile-transmuted-gold', !!(prop && prop.isTransmutedGold));

  const isCitadel = !!(prop && (prop.isGlacialCitadel || (st && st.glacialCitadelTile === tile.id && (!st.glacialCitadelOwner || prop.owner === st.glacialCitadelOwner))));
  const isCitadelAura = !isCitadel && (st && st.glacialCitadelTile != null) && (tile.id === (st.glacialCitadelTile - 1 + 20) % 20 || tile.id === (st.glacialCitadelTile + 1) % 20);
  const isPyramid = !!(prop && (prop.isGoldenPyramid || (st && st.goldenPyramidTile === tile.id && (!st.goldenPyramidOwner || prop.owner === st.goldenPyramidOwner))));
  const isOlympus = !!(prop && (prop.isOlympusTemple || (st && st.olympusTempleTile === tile.id && (!st.olympusTempleOwner || prop.owner === st.olympusTempleOwner))));
  const isTransmuted = !!(prop && prop.isTransmutedGold);
  el.classList.toggle('tile-glacial-citadel', isCitadel);
  el.classList.toggle('tile-citadel-aura', isCitadelAura);
  el.classList.toggle('tile-golden-pyramid', isPyramid);
  el.classList.toggle('tile-olympus-temple', isOlympus);

  const landmarkHtml = getTile25dLandmarkHtml(tile.id, prop, st);
  const hasMonument = landmarkHtml.includes('monument-25d-wrap');
  el.classList.toggle('has-monument', hasMonument);

  if (bld && bld.dataset.lm !== landmarkHtml) {
    bld.innerHTML = landmarkHtml;
    bld.dataset.lm = landmarkHtml;
  }

  if (prop) {
    ribbon.className = 'tile-owner-ribbon';
    const ownerP = st.players[prop.owner];
    const emoji = prop.owner === 'bkk' ? '🐺' : prop.owner === 'dxb' ? '🐉' : prop.owner === 'bot1' ? '🐣' : '😈';
    ribbon.textContent = `${emoji} ${ownerP ? ownerP.badge : prop.owner}`;
    pill.className = 'tile-pill tile-price-pill rent-pill';
    pill.textContent = isTransmuted ? '0🪙 (⚱️+80)' : `${fmt(getTileRent(tile.id))}🪙`;
  } else {
    ribbon.className = 'tile-owner-ribbon unowned';
    ribbon.textContent = ZONES[tile.zone].label;
    pill.className = 'tile-pill tile-price-pill';
    pill.textContent = `${tile.price}🪙`;
  }
  if (!anim) return;

  const FX = MonoFX;
  if (prop && !prevOwner) {
    FX.runTileFx(() => { FX.restartClass(el, 'tile-claim', 750); FX.plantFlag(tile.id, prop.owner); });
  } else if (prop && prevOwner && prevOwner !== prop.owner) {
    FX.runTileFx(() => { FX.restartClass(el, 'tile-flip', 650); FX.plantFlag(tile.id, prop.owner); });
  } else if (!prop && prevOwner) {
    FX.runTileFx(() => FX.restartClass(el, 'tile-sold', 750));
  }
  if (prop && (!prevOwner || prevOwner === prop.owner) && prop.level > prevLevel && bld.lastElementChild) {
    FX.restartClass(bld.lastElementChild, 'just-built', 600);
  }
}

function renderMonopolyBoard(opts = {}) {
  if (!ensureBoardBuilt()) return;
  const wasHydrated = boardHydrated;
  updateBoardTiles({ animate: !opts.instant });
  if (window.MonoFX) {
    if (typeof MonoFX.clearDesat === 'function') MonoFX.clearDesat();
    MonoFX.tokens.sync(monopolyState, { animate: wasHydrated && !opts.instant && !isAnimating });
  }
}

function rollButtonState() {
  const st = monopolyState;
  if (isSpectatorMode) return { label: 'SPECTATING 👁', enabled: false, cls: '' };
  const me = getMonopolyMyRole();
  const turn = st.currentTurn || 'bkk';
  const currentP = st.players && st.players[turn];
  if (st.gameOver) return { label: 'GAME OVER 🏆', enabled: false, cls: '' };
  if (st.isRolling || isAnimating) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 7500) {
      console.warn('[Monopoly] rollButtonState: auto-clearing stuck rolling/animating lock.');
      st.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
    } else {
      return { label: 'ROLLING… 🎲', enabled: false, cls: '' };
    }
  }
  if (isBlockingState()) return { label: '⏳ WAIT…', enabled: false, cls: '' };
  if (turn === me) return { label: 'ROLL DICE 🎲', enabled: true, cls: 'my-turn-pulse' };
  if (currentP && currentP.isBot) return { label: `🐾 ${currentP.name.toUpperCase()}…`, enabled: false, cls: '' };
  if (st.mode !== 'bot' && partnerAway() && turn !== me) return { label: `✈️ WAITING FOR ${currentP?.badge || 'PARTNER'}…`, enabled: false, cls: '' };
  return { label: `⏳ ${currentP?.badge || 'RIVAL'}'S TURN`, enabled: false, cls: '' };
}

function setTweened(el, value, fmtFn, flashCard) {
  if (!el) return;
  if (el.dataset.target === String(value)) return;            // idle watcher calls this every 1s
  const had = el.dataset.target != null;
  const from = had ? Number(el.dataset.shown ?? el.dataset.target) : value;
  el.dataset.target = String(value);
  if (!had || hudInstantOnce || !window.MonoFX || from === value) {
    el.innerHTML = fmtFn(value);
    el.dataset.shown = String(value);
    return;
  }
  MonoFX.tween(el, from, value, 900, fmtFn, (v) => { el.dataset.shown = String(v); });
  if (flashCard) {
    MonoFX.restartClass(el, value > from ? 'miles-up' : 'miles-down', 950);
    if (value < from) MonoFX.restartClass(flashCard, 'card-hit', 650);
  }
}

function updateMonopolyHUD() {
  const st = monopolyState;
  const me = getMonopolyMyRole();
  const turn = st.currentTurn || 'bkk';

  if (window.MonoFX) MonoFX.tokens.setActive(st.gameOver ? null : turn);

  const allRoles = ['bkk', 'dxb', 'bot1', 'bot2'];
  const is4P = st.mode === '4p' || !!(st.players && (st.players.bot1 || st.players.bot2));
  const bar = $m('monopolyPlayersBar');
  if (bar) bar.classList.toggle('party-4p', !!is4P);

  // Determine current Net Worth leader for dynamic crown badge
  let leaderRole = null;
  let maxNw = -1;
  allRoles.forEach((r) => {
    const pl = st.players && st.players[r];
    if (!pl || pl.bankrupt) return;
    const nw = netWorth(r);
    if (nw > maxNw) {
      maxNw = nw;
      leaderRole = r;
    }
  });

  allRoles.forEach((r) => {
    const cap = r === 'bkk' ? 'Bkk' : r === 'dxb' ? 'Dxb' : r === 'bot1' ? 'Bot1' : 'Bot2';
    const card = $m(`monopolyPlayerCard${cap}`);
    if (!card) return;
    const p = st.players[r];
    const crownEl = $m(`monopoly${cap}Crown`);
    const sigEl = $m(`monopoly${cap}Signal`);
    if (!p) {
      card.classList.remove('hidden');
      card.classList.add('is-empty-seat');
      card.classList.remove('active-turn', 'is-me', 'magnetized', 'is-bankrupt', 'ult-ready');
      const set = (id, html) => { const el = $m(id); if (el) el.innerHTML = html; };
      const defaultName = r === 'bot1' ? 'Zero' : r === 'bot2' ? 'Luna' : 'Open';
      set(`monopoly${cap}Name`, defaultName);
      set(`monopoly${cap}Miles`, '—');
      set(`monopoly${cap}Props`, '🏰 0');
      set(`monopoly${cap}Nw`, '<span class="empty-seat-tag">OPEN</span>');
      set(`monopoly${cap}Items`, '');
      if (crownEl) crownEl.classList.add('hidden');
      if (sigEl) sigEl.style.display = 'none';
      const ultWrap = $m(`monopoly${cap}UltWrap`);
      if (ultWrap) ultWrap.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');
    card.classList.remove('is-empty-seat');

    if (crownEl) {
      crownEl.classList.toggle('hidden', r !== leaderRole || !!p.bankrupt);
    }

    if (sigEl) {
      sigEl.style.display = 'inline-block';
      if (p.isBot) {
        sigEl.textContent = '🤖';
        sigEl.title = `AI Bot (${(p.botLevel || 'hard').toUpperCase()})`;
      } else {
        const isAway = (r === me && window.isMonopolyPlayerAway) || (r !== me && partnerAway());
        sigEl.textContent = isAway ? '⚠️' : '📶';
        sigEl.title = isAway ? 'Stepped Away' : 'Connected';
      }
    }

    const seatTag = card.querySelector('.player-seat-tag');
    if (seatTag) {
      if (p.isBot) {
        seatTag.textContent = p.badge || 'BOT';
        seatTag.className = 'player-seat-tag bot-tag';
      } else {
        const defaultTag = r === 'bkk' ? 'P1' : r === 'dxb' ? 'P2' : r === 'bot1' ? 'P3' : 'P4';
        seatTag.textContent = p.badge || defaultTag;
        seatTag.className = `player-seat-tag p${r === 'bkk' ? '1' : r === 'dxb' ? '2' : r === 'bot1' ? '3' : '4'}-tag`;
      }
    }

    const set = (id, html) => { const el = $m(id); if (el) el.innerHTML = html; };
    const pinfo = perkInfo(r);
    const perkChip = pinfo
      ? `<span class="mono-perk-chip pc-${pinfo.costume.rarity}" title="${pinfo.perk.name}: ${pinfo.perk.desc}">${pinfo.perk.icon}${pinfo.resonance ? '💞' : ''}</span>`
      : '';
    let buffPill = '';
    if (p.phoenixGraceActive) {
      buffPill = `<span class="mono-hud-status-pill phoenix" title="Sunfire Armor: Next Rent is 0">🔥 GRACE</span>`;
    } else if ((p.bankruptcyImmunity || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill gold" title="Lantern Bankruptcy Immunity">🏮 IMMUNE</span>`;
    } else if ((p.monacoGoldRushRounds || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill gold" title="Monaco Gold Rush: 1.5× Rent (${p.monacoGoldRushRounds}R)">🎰 1.5×</span>`;
    } else if ((p.zeroRentIceBridge || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill cyan" title="Empress Ice Bridge: Next Rent is 0">❄️ BRIDGE</span>`;
    } else if (p.carpetGlideActive) {
      buffPill = `<span class="mono-hud-status-pill djinn" title="Magic Carpet Flight: Next Rent is 0">🪔 GLIDE</span>`;
    } else if ((p.phantomRentReversals || 0) > 0 && isPhantomRoyalty(r)) {
      buffPill = `<span class="mono-hud-status-pill rose" title="Phantom Masquerade: Reverse Rent Charges">🎭 ×${p.phantomRentReversals}</span>`;
    } else if (p.hasOlympusPegasusWings) {
      buffPill = `<span class="mono-hud-status-pill cyan" title="Pegasus Wings: Hazard Immunity">🪽 WINGS</span>`;
    } else if (isInariFoxfire(r)) {
      buffPill = `<span class="mono-hud-status-pill inari" title="Foxfire Spirit Tails">🦊 ${(p.foxfireTails != null ? p.foxfireTails : 3)}/3</span>`;
    } else if (isPhoenixAscendant(r) && (p.ashPot || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill phoenix" title="Ash Pot (Refunded at START)">🔥 ${fmt(p.ashPot)}🪙</span>`;
    } else if (isDjinnMirage(r) && (p.carpetCharges || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill djinn" title="Magic Carpet">🪔 ${(p.carpetCharges || 0)}/3</span>`;
    } else if (isCelestialEclipse(r)) {
      const isOdd = ((st.roundCount || st.round || 1) % 2 === 1);
      buffPill = isOdd
        ? `<span class="mono-hud-status-pill gold" title="Sun Stance: +20% Rent Collected">☀️ +20%</span>`
        : `<span class="mono-hud-status-pill purple" title="Moon Stance: -25% Rent Paid">🌙 -25%</span>`;
    } else if (isNagaWarden(r) && (st.mekongHoard || 0) > 0) {
      buffPill = `<span class="mono-hud-status-pill emerald" title="Mekong River Hoard at START">🐉 ${fmt(st.mekongHoard)}🪙</span>`;
    }

    let debuffPill = '';
    if ((p.cryoStasis || 0) > 0 || p.frozenTurn) {
      debuffPill = `<span class="mono-hud-status-pill debuff-ice" title="Subzero Chill: Crippled Roll / Frozen">🧊 CRYO</span>`;
    } else if ((p.marionetteStasisRounds || 0) > 0) {
      debuffPill = `<span class="mono-hud-status-pill debuff-rose" title="Marionette Stasis: Roll Capped at 1-3">🎭 1-3</span>`;
    } else if ((p.somnambulismSteps || 0) > 0) {
      debuffPill = `<span class="mono-hud-status-pill debuff-purple" title="Somnambulism Trance: Pulled +3 Tiles">🌑 SLEEP</span>`;
    } else if (p.invertDirectionNext) {
      debuffPill = `<span class="mono-hud-status-pill inari" title="Foxfire Confusion: Next Roll Reversed">🦊 REV</span>`;
    } else if (p.waterlogged) {
      debuffPill = `<span class="mono-hud-status-pill debuff-ice" title="Waterlogged: -1 Roll Speed">🌊 SLOW</span>`;
    }

    const itemsHtml = (p.inventory || []).map((id) => ITEMS[id] ? `<span class="player-item-chip" title="${ITEMS[id].name}">${ITEMS[id].icon}</span>` : '').join('');
    set(`monopoly${cap}Name`, `${p.name}${r === me ? ' <span class="you-tag">YOU</span>' : ''}`);
    set(`monopoly${cap}Items`, `${perkChip}${buffPill}${debuffPill}${itemsHtml}`);
    setTweened($m(`monopoly${cap}Miles`), p.miles, (v) => fmt(v), card);
    set(`monopoly${cap}Props`, `🏰 ${ownedTileIds(r).length}`);
    setTweened($m(`monopoly${cap}Nw`), netWorth(r), (v) => `NW ${fmt(v)}`, null);
    if ($m(`monopoly${cap}Passes`)) {
      const tokens = p.clashTokens != null ? p.clashTokens : (p.vibePasses || 0);
      set(`monopoly${cap}Passes`, tokens > 0 ? '🍸'.repeat(tokens) : '<span class="no-passes">0🍸</span>');
    }

    const ult = Math.max(0, Math.min(100, Math.round(p.ult || 0)));
    const canCastUlt = !p.isBot || p.botLevel === 'insane';
    const ultWrap = $m(`monopoly${cap}UltWrap`);
    const ultTrack = $m(`monopoly${cap}UltTrack`);
    const ultFill = $m(`monopoly${cap}UltFill`);
    const ultLabel = $m(`monopoly${cap}UltLabel`);
    if (ultWrap) {
      ultWrap.classList.toggle('hidden', !canCastUlt);
      ultWrap.style.opacity = '1';
      ultWrap.classList.toggle('is-ready', canCastUlt && ult >= 100);
      ultWrap.title = canCastUlt
        ? `Ultimate Charge: ${ult}%${ult >= 100 ? ' (READY TO CAST!)' : ''}`
        : 'Standard AI Bots do not cast Ultimate skills';
    }
    if (ultFill) ultFill.style.width = `${canCastUlt ? ult : 0}%`;
    if (ultLabel) ultLabel.textContent = ult >= 100 ? 'MAX' : `${ult}%`;
    if (ultTrack) ultTrack.classList.toggle('is-ready', canCastUlt && ult >= 100);
    card.classList.toggle('ult-ready', canCastUlt && ult >= 100);

    const thumb = $m(`monopoly${cap}Thumb`);
    const thumbSrc = toThumbSprite(p.sprite);
    if (thumb && thumbSrc && thumb.getAttribute('src') !== thumbSrc) {
      thumb.decoding = 'async';
      thumb.src = thumbSrc;
    }
    const isBankrupt = !!p.bankrupt;
    card.classList.toggle('active-turn', turn === r && !st.gameOver && !isBankrupt);
    card.classList.toggle('is-me', r === me);
    card.classList.toggle('magnetized', !!(st.magnet && st.magnet.target === r) && !isBankrupt);
    card.classList.toggle('is-bankrupt', isBankrupt);
    if (isBankrupt) {
      set(`monopoly${cap}Miles`, '<span style="color:#71717a;text-decoration:line-through;">0</span>');
      set(`monopoly${cap}Props`, '<span style="color:#71717a;">🏰 0</span>');
      set(`monopoly${cap}Nw`, '<span class="bankrupt-label">💀 OUT</span>');
      if (ultWrap) {
        ultWrap.classList.remove('is-ready');
        ultWrap.style.opacity = '0.3';
      }
      if (ultTrack) ultTrack.classList.remove('is-ready');
      if (ultFill) ultFill.style.width = '0%';
      if (ultLabel) ultLabel.textContent = '0%';
      card.classList.remove('ult-ready');
    }
  });

  const roundPill = $m('monopolyRoundPill');
  if (roundPill) {
    let weatherSuffix = '';
    if ((st.midnightReverseRounds || 0) > 0) weatherSuffix = ` · ⏳ REV ${st.midnightReverseRounds}R`;
    else if ((st.eclipseInvertRounds || 0) > 0) weatherSuffix = ` · 🌑 ECLIPSE`;
    roundPill.textContent = `ROUND ${Math.min(st.round || 1, MONO_CFG.MAX_ROUNDS)} / ${MONO_CFG.MAX_ROUNDS}${weatherSuffix}`;
  }
  const centerHub = $m('monopolyCenterHub');
  if (centerHub) {
    centerHub.classList.toggle('hub-time-reversed', (st.midnightReverseRounds || 0) > 0);
    centerHub.classList.toggle('hub-eclipse-blackout', (st.eclipseInvertRounds || 0) > 0);
  }
  const goalPill = $m('monopolyGoalPill');
  if (goalPill) goalPill.textContent = `🏆 ${fmt(MONO_CFG.WIN_NET_WORTH)} NW`;
  const fb = $m('monopolyFinalBoarding');
  if (fb) {
    fb.classList.toggle('hidden', !isFinalBoarding() || !!st.gameOver);
    const fbText = `🔥 FINAL BOARDING · RENT ${multLabel(finalBoardingMult())}`;
    if (fb.textContent !== fbText) fb.textContent = fbText;
  }

  const turnBadge = $m('monopolyTurnBadge');
  if (turnBadge) {
    const isMyTurn = turn === me;
    turnBadge.className = `turn-badge neora-turn-badge ${isMyTurn && !st.gameOver ? 'my-turn' : ''}`;
    const p = st.players && st.players[turn];
    const avatarEl = $m('monopolyTurnAvatarMini');
    const textEl = $m('monopolyTurnText');
    const turnThumb = toThumbSprite(p?.sprite || 'assets/bkk_warrior_idle.png');
    if (avatarEl && turnThumb) {
      if (avatarEl.getAttribute('src') !== turnThumb) {
        avatarEl.decoding = 'async';
        avatarEl.src = turnThumb;
      }
    }
    const label = st.gameOver
      ? 'Game over'
      : isMyTurn ? 'Your turn' : `${p ? p.name : 'Rival'}'s turn`;
    if (textEl) {
      textEl.textContent = label;
    } else {
      turnBadge.innerHTML = `<span class="turn-avatar-mini-wrap"><img id="monopolyTurnAvatarMini" src="${turnThumb}" decoding="async" class="turn-avatar-mini" alt="Turn" /></span><span id="monopolyTurnText">${label}</span>`;
    }
  }

  const rollBtn = $m('btnRollDice');
  if (rollBtn) {
    const s = rollButtonState();
    rollBtn.classList.toggle('take-turn-btn', s.cls === 'take-turn-btn');
    rollBtn.classList.toggle('my-turn-pulse', s.cls === 'my-turn-pulse');
    rollBtn.classList.toggle('roll-disabled', !s.enabled);
    rollBtn.innerHTML = `<span>${s.label}</span>`;
  }

  const ultBtn = $m('monopolyUltBtn');
  if (ultBtn) {
    const activePlayer = st.players[me] || st.players[turn];
    const myUlt = Math.round(activePlayer?.ult || 0);
    const ultLabel = $m('monopolyDockUltLabel');
    const ultBar = $m('monopolyDockUltBar');
    if (ultBar) ultBar.style.width = `${myUlt}%`;
    const isReady = myUlt >= 100 && turn === me && !st.isRolling && !st.gameOver;
    ultBtn.classList.toggle('is-ready', isReady);
    const ultData = getRoleUltimate(me);
    ultBtn.setAttribute('title', `${ultData.title} (${ultData.badge}): ${ultData.desc}`);
    if (ultLabel) {
      ultLabel.textContent = isReady ? '⚡ CAST ULT!' : (myUlt >= 100 ? '⚡ READY!' : `ULT ${myUlt}%`);
    }
  }

  const pauseBanner = $m('monopolyPauseBanner');
  if (pauseBanner) {
    const isBot = st.mode === 'bot';
    const opp = otherRole(me);
    const partnerNeeded = !isBot && partnerAway() && !st.gameOver && (
      st.currentTurn !== me ||
      (st.activeDuel && st.activeDuel.rolls[opp] == null) ||
      (st.activeChallenge && st.activeChallenge.picks[opp] == null) ||
      (st.pendingDecision && !isResolver())
    );
    if (partnerNeeded) {
      pauseBanner.innerHTML = `✈️ <strong>${st.players[opp].name}</strong> stepped away — game saved, it continues when they're back`;
      pauseBanner.classList.remove('hidden');
    } else {
      pauseBanner.classList.add('hidden');
    }
  }

  renderItemDock();
  hudInstantOnce = false;
}

function renderItemDock() {
  const st = monopolyState;
  if (!st || !st.players) return;
  const me = getMonopolyMyRole();
  const player = st.players[me];
  const inv = (player && Array.isArray(player.inventory)) ? player.inventory : [];
  const usableNow = canUseItemsNow();
  [0, 1].forEach((i) => {
    const slot = $m(`monopolyItemSlot${i}`);
    if (!slot) return;
    const id = inv[i];
    if (id && ITEMS[id]) {
      slot.className = `item-slot${usableNow && id !== 'shield' ? ' usable' : ''}`;
      slot.innerHTML = `<span class="item-slot-icon">${ITEMS[id].icon}</span><span class="item-slot-label">${ITEMS[id].name}</span>`;
    } else {
      slot.className = 'item-slot empty';
      slot.innerHTML = '<span class="item-slot-icon">＋</span><span class="item-slot-label">Empty</span>';
    }
  });
}

function canUseItemsNow() {
  const st = monopolyState;
  return st.currentTurn === getMonopolyMyRole() && !st.isRolling && !isAnimating && !isBlockingState();
}

function getTileActiveEffectsInfo(tile, prop, st) {
  const effects = [];
  if (prop) {
    if (prop.isGlacialCitadel) {
      effects.push({ badge: '❄️ Glacial Citadel (2.5× Rent + Freeze)', counter: '☀️ Solar Flare / 🔥 Phoenix / 👑 Midas' });
    }
    if (prop.isGoldenPyramid) {
      effects.push({ badge: '🔺 Golden Pyramid (2× Rent + Siphon)', counter: '⚡ Olympus / 🌊 Abyss / 🐉 Leviathan' });
    }
    if (prop.isOlympusTemple) {
      effects.push({ badge: '⚡ Olympus Temple (2× Rent + Toll)', counter: '⏳ Chronos / 🌑 Eclipse' });
    }
    if (prop.isSolarObelisk) {
      effects.push({ badge: '☀️ Solar Obelisk (2.5× Rent + Burn)', counter: '❄️ Frost / 🌊 Abyss / 🐉 Leviathan' });
    }
    if (prop.isTransmutedGold) {
      effects.push({ badge: `👑 Midas Gold (1.5× Tribute · ${prop.transmutedRounds || 1}R)`, counter: '🌑 Eclipse / ⏳ Chronos' });
    }
    if ((prop.monumentSuppressedRounds || 0) > 0) {
      effects.push({ badge: `🌑 Monument Eclipsed (${prop.monumentSuppressedRounds}R)`, counter: '☀️ Solar / 👑 Midas' });
    }
    if ((prop.frosted || 0) > 0) {
      effects.push({ badge: `🥶 Permafrost (${prop.frosted}R · 50% Rent)`, counter: '🔥 Phoenix / ☀️ Solar' });
    }
    if (prop.frostShield) {
      effects.push({ badge: '🧊 Frost Shield (Takeover Ward)', counter: '☀️ Solar / 🔥 Phoenix' });
    }
    if (prop.torchShield) {
      effects.push({ badge: '🔥 Torch Shield (Takeover Ward)', counter: '🌊 Abyss / ❄️ Frost' });
    }
    if (prop.waterShield) {
      effects.push({ badge: '🌊 Water Shield (Takeover Ward)', counter: '⚡ Olympus / ☀️ Solar' });
    }
    if ((prop.shield || 0) > 0) {
      effects.push({ badge: `🪐 Celestial Shield (×${prop.shield})`, counter: '' });
    }
    if ((prop.boostTurns || 0) > 0) {
      effects.push({ badge: `📈 Surge ×${prop.boostMult || 2} (${prop.boostTurns}T)`, counter: '' });
    }
  }
  if (st) {
    const tid = tile.id;
    if (st.snowdriftTraps && st.snowdriftTraps[tid]) {
      effects.push({ badge: '🌨️ Snowdrift Trap (-250🪙 + Freeze)', counter: '🔥 Phoenix / ☀️ Solar' });
    }
    if (st.bananaTraps && st.bananaTraps[tid] > 0) {
      effects.push({ badge: `🍌 Banana Trap (×${st.bananaTraps[tid]})`, counter: '🛡️ Shield / 🪽 Wings' });
    }
    if (st.floodedTiles && st.floodedTiles[tid]) {
      const fl = st.floodedTiles[tid];
      const isCoral = !!(prop && prop.owner && isAbyssalDrifter(prop.owner));
      effects.push({
        badge: isCoral ? '🐚 Coral Palace (+35% Rent)' : `🌊 Sunken Ruin (${fl.rounds || 1}R · -50% Rent)`,
        counter: '☀️ Solar / 🔥 Phoenix'
      });
    }
    if (st.inariToriiGates && st.inariToriiGates[tid]) {
      effects.push({ badge: `⛩️ Inari Torii Gate (${st.inariToriiGates[tid].rounds || 1}R · 25% Toll)`, counter: '🌑 Eclipse' });
    }
    if (st.djinnOasisTiles && st.djinnOasisTiles[tid]) {
      effects.push({ badge: `🌴 Mirage Oasis (${st.djinnOasisTiles[tid].rounds || 1}R · 350🪙 Tribute)`, counter: '❄️ Frost / 🌊 Abyss' });
    }
    if (st.wishSanctuaries && st.wishSanctuaries[tid]) {
      effects.push({ badge: `🪔 Wish Sanctuary (${st.wishSanctuaries[tid].rounds || 1}R · +350🪙)`, counter: '' });
    }
    if (st.solarScorchedTiles && st.solarScorchedTiles[tid]) {
      effects.push({ badge: '☀️ Solar Scorch (350🪙 Burn)', counter: '🌊 Abyss / ❄️ Frost' });
    }
    if (st.phoenixEmbers && st.phoenixEmbers[tid]) {
      effects.push({ badge: `🔥 Phoenix Ember (${st.phoenixEmbers[tid].rounds || 1}R · 220🪙 Burn)`, counter: '🌊 Abyss / ❄️ Frost' });
    }
    if (st.sacredWaterways && st.sacredWaterways[tid]) {
      effects.push({ badge: `🐉 Sacred Waterway (${st.sacredWaterways[tid].rounds || 1}R)`, counter: '⚡ Olympus' });
    }
    if (st.reverseRentHexTile === tid) {
      effects.push({ badge: '🪞 Reverse Rent Hex', counter: '⛩️ Inari / 🛡️ Shield' });
    }
    if (st.enchantedRoseTile === tid) {
      effects.push({ badge: '🌹 Enchanted Rose (+40% Rent)', counter: '❄️ Frost / 🔥 Phoenix' });
    }
    if (st.c4 && st.c4.tileId === tid) {
      effects.push({ badge: '💣 Planted C4 Charge', counter: '🛡️ Shield / 🌊 Water Shield' });
    }
  }
  return effects;
}

function showTileInspectorPopup(tile, prop, st) {
  const hub = $m('monopolyCenterHub');
  if (!hub) return;
  let popup = $m('monopolyTileInspector');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'monopolyTileInspector';
    popup.className = 'monopoly-tile-inspector hidden';
    popup.addEventListener('click', () => {
      if (tileInspectorTimer) { clearTimeout(tileInspectorTimer); tileInspectorTimer = null; }
      popup.classList.add('hidden');
      document.querySelectorAll('.board-tile.tile-inspected-pulse').forEach((el) => el.classList.remove('tile-inspected-pulse'));
    });
    hub.appendChild(popup);
  }

  document.querySelectorAll('.board-tile.tile-inspected-pulse').forEach((el) => el.classList.remove('tile-inspected-pulse'));
  const tileEl = $m(`boardTile_${tile.id}`);
  if (tileEl) tileEl.classList.add('tile-inspected-pulse');

  const zone = tile.zone && ZONES[tile.zone] ? ZONES[tile.zone] : null;
  const zoneBadge = zone
    ? `<span class="ti-zone-pill" style="background:${zone.color}22;border-color:${zone.color};color:${zone.color}">${zone.label}</span>`
    : `<span class="ti-zone-pill">${tile.type.toUpperCase()}</span>`;

  let bodyHtml = '';
  if (tile.type !== 'property') {
    bodyHtml = `<div class="ti-desc">${tile.desc || 'Special destination tile'}</div>`;
  } else if (!prop) {
    bodyHtml = `
      <div class="ti-stat-row">
        <span class="ti-stat-chip">🏷️ Buy <strong>${fmt(tile.price)}🪙</strong></span>
        <span class="ti-stat-chip">🏠 <strong>${fmt(getTileRent(tile.id, 1))}</strong></span>
        <span class="ti-stat-chip">🏠🏠 <strong>${fmt(getTileRent(tile.id, 2))}</strong></span>
        <span class="ti-stat-chip">🏨 <strong>${fmt(getTileRent(tile.id, 3))}</strong></span>
      </div>`;
  } else {
    const ownerName = st.players?.[prop.owner]?.name || prop.owner.toUpperCase();
    const building = prop.level >= 3 ? '🏨 Hotel' : `🏠 Lv.${prop.level}`;
    const zoneBonus = ownsZone(prop.owner, tile.zone) ? ' <span class="ti-crown">👑×2</span>' : '';
    bodyHtml = `
      <div class="ti-stat-row">
        <span class="ti-stat-chip ti-owner-${prop.owner}">👤 <strong>${ownerName}</strong> · ${building}${zoneBonus}</span>
        <span class="ti-stat-chip ti-rent-highlight">💸 Rent <strong>${fmt(getTileRent(tile.id))}🪙</strong></span>
        <span class="ti-stat-chip">💎 Val <strong>${fmt(propValue(tile.id))}🪙</strong></span>
      </div>`;
  }

  const effects = getTileActiveEffectsInfo(tile, prop, st);
  const effectsHtml = effects.length > 0
    ? `<div class="ti-effects-list">${effects.map((e) => `
        <div class="ti-effect-item">
          <span class="ti-effect-badge">${e.badge}</span>
          ${e.counter ? `<span class="ti-effect-counter">⚔️ Counter: ${e.counter}</span>` : ''}
        </div>`).join('')}</div>`
    : '';

  popup.innerHTML = `
    <div class="ti-header">
      <span class="ti-title">${tile.icon || '📍'} <strong>${tile.name}</strong></span>
      ${zoneBadge}
    </div>
    ${bodyHtml}
    ${effectsHtml}
  `;
  popup.classList.remove('hidden');

  if (tileInspectorTimer) clearTimeout(tileInspectorTimer);
  tileInspectorTimer = setTimeout(() => {
    popup.classList.add('hidden');
    if (tileEl) tileEl.classList.remove('tile-inspected-pulse');
    tileInspectorTimer = null;
  }, 3200);
}

function inspectTile(tile) {
  const st = monopolyState;
  const prop = tile.type === 'property' ? st.properties[tile.id] : null;
  showTileInspectorPopup(tile, prop, st);
  if (tile.type !== 'property') {
    setMonopolyTicker(`${tile.icon} <strong>${tile.name}</strong> — ${tile.desc}`);
    return;
  }
  if (!prop) {
    setMonopolyTicker(`📍 <strong>${tile.name}</strong> (${ZONES[tile.zone].label}) — ${tile.price}🪙 · rent 🏠 ${fmt(getTileRent(tile.id, 1))} / 🏠🏠 ${fmt(getTileRent(tile.id, 2))} / 🏨 ${fmt(getTileRent(tile.id, 3))}`);
    return;
  }
  const building = prop.level >= 3 ? 'Grand Hotel 🏨' : `${prop.level} house${prop.level > 1 ? 's' : ''} 🏠`;
  const zoneNote = ownsZone(prop.owner, tile.zone) ? ' · 👑 zone ×2' : '';
  setMonopolyTicker(`📍 <strong>${tile.name}</strong> — ${st.players[prop.owner].name} · ${building} · rent <strong>${fmt(getTileRent(tile.id))}🪙</strong>${zoneNote} · value ${fmt(propValue(tile.id))}🪙`);
}

// =========================================================
// 13B. SIGNATURE MYTHIC ULTIMATE ABILITIES
// =========================================================
function chargeUlt(role, amount, reason) {
  if (!role || !monopolyState || !monopolyState.players || !monopolyState.players[role]) return;
  const p = monopolyState.players[role];
  if (p.isBot && p.botLevel !== 'insane') return; // Easy and hard bots NEVER charge ultimate
  const oldUlt = p.ult || 0;
  p.ult = Math.min(100, Math.max(0, oldUlt + amount));
  const me = getMonopolyMyRole();

  if (p.ult > oldUlt) {
    if (p.ult >= 100 && oldUlt < 100) {
      if (role === me) {
        AudioFX.playUltReady();
        if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      }
      floatText(p.pos != null ? p.pos : 0, '⚡ ULTIMATE READY!', 'pos');
    } else if (role === me) {
      AudioFX.playUltCharge();
    }
  }
  updateMonopolyHUD();
}

function getRoleUltimate(role) {
  const cid = activeCostumeId(role).toLowerCase();

  if (isSundropTower(role) || cid.includes('sundrop') || cid.includes('rapunzel') || cid.includes('flynn') || cid.includes('s7_sundrop')) {
    return {
      id: 'lantern_festival',
      badge: '🏮 S7 MYTHIC ULTIMATE',
      title: 'WISH UPON A LANTERN FESTIVAL',
      desc: 'Releases illuminated sky lanterns across the board! Grants 1-Round Bankruptcy Immunity, spawns 3 golden Wish Sanctuaries, and awards a loaded bonus roll!',
      haloColor: '#fde047'
    };
  }
  if (isClockworkSovereign(role) || cid.includes('cinderella') || cid.includes('clockwork') || cid.includes('glass_slipper') || cid.includes('s7_cinderella')) {
    return {
      id: 'midnight_paradox',
      badge: '⏳ S7 MYTHIC ULTIMATE',
      title: 'THE CHRONO-MIDNIGHT PARADOX',
      desc: 'Cathedral bells toll 12:00! Inverts board runway direction counter-clockwise for 2 rounds, transmuting rival hotels back into basic cottages!',
      haloColor: '#38bdf8'
    };
  }
  if (isBeastAdam(role) || cid.includes('belle') || cid.includes('beast') || cid.includes('rose') || cid.includes('s7_belle')) {
    return {
      id: 'breaking_the_curse',
      badge: '🌹 S7 MYTHIC ULTIMATE',
      title: 'BEAST RAMPAGE & ENCHANTED ROSE RESTORATION',
      desc: 'Beast Roar deals -180🪙 shock & smashes rival hotel! Prince Adam restores his kingdom: +2 free castle upgrades & +30% Rose Turrets!',
      haloColor: '#ec4899'
    };
  }
  if (isFrostSovereign(role) || cid.includes('empress') || cid.includes('warden') || cid.includes('frost') || cid.includes('glacial') || matchesSeasonId(cid, 's8')) {
    return {
      id: 'absolute_zero',
      badge: '❄️ S8 MYTHIC ULTIMATE',
      title: 'ABSOLUTE ZERO: RISE OF THE GLACIAL CITADEL',
      desc: 'Freezes ALL rivals solid with 15% tribute siphon and subzero crippled rolls! Raises the 3D Glacial Ice Citadel (±1 AoE Blizzard Tithe, 2× Rent) and grants an Empress Glacial Glide with 0-Rent Ice Bridge!',
      haloColor: '#38bdf8'
    };
  }

  if (isOlympusDivinity(role) || matchesSeasonId(cid, 's11') || cid.includes('zeus') || cid.includes('athena') || cid.includes('olympus') || cid.includes('pantheon')) {
    return {
      id: 'olympus_wrath',
      badge: '⚡ S11 MYTHIC ULTIMATE',
      title: 'WRATH OF OLYMPUS: THUNDER OF THE GODS',
      desc: 'Celestial thunder cracks the heavens! Consecrates the 3D Mount Olympus Temple (+50% rent, Lightning Rod zaps rivals for 40🪙), orbital lightning smites 1 hotel level (+120🪙) or inflicts -80🪙 Storm Shock, and siphons up to 150🪙 from all rivals with Divine Pegasus Flight!',
      haloColor: '#38bdf8'
    };
  }
  if (isPhantomRoyalty(role) || matchesSeasonId(cid, 's10') || cid.includes('phantom') || cid.includes('masquerade') || cid.includes('black_swan') || cid.includes('curtain_call')) {
    return {
      id: 'phantom_curtain_call',
      badge: '🎭 S10 MYTHIC ULTIMATE',
      title: 'PHANTOM MASQUERADE: THE GRAND CURTAIN CALL',
      desc: 'Orchestral overture shakes the board! Summons the 3D Venetian Harlequin Mask, hexes rivals into Marionette Stasis (movement rolls restricted to 1-3), reverses 100% of rent on marked tiles, and siphons gala tribute!',
      haloColor: '#f43f5e'
    };
  }

  if (isSolarDivinity(role) || cid.includes('s9_ra') || cid.includes('s9_sekhmet') || cid.includes('solar') || (cid.includes('ra') && !cid.includes('rapunzel') && !cid.includes('pharaoh')) || cid.includes('sekhmet')) {
    return {
      id: 'solar_wrath',
      badge: '☀️ S9 MYTHIC ULTIMATE',
      title: 'DAYBREAK OF HELIOPOLIS: WRATH OF THE SUN DISK',
      desc: 'Blinding high-noon solar flare incinerates the sky! Desert Sandstorm sweeps ALL rivals 3-6 tiles forward across hazards, Eye of Ra death ray downgrades 1 rival hotel into gold tribute, and charges ahead with Blazing Solar Falcon Wings!',
      haloColor: '#f59e0b'
    };
  }
  if (isGildedSovereign(role) || matchesSeasonId(cid, 's9') || cid.includes('cleopatra') || cid.includes('pharaoh') || cid.includes('gilded') || cid.includes('pyramid') || cid.includes('nile')) {
    return {
      id: 'nile_seduction',
      badge: '🏺 S9 MYTHIC ULTIMATE',
      title: 'DECREE OF THE NILE: ASCENT OF THE GOLDEN PYRAMID',
      desc: 'Royal solar decree extorts 20% gold dowry from rivals! Ascends the highest property into the 3D Great Golden Pyramid (+150🪙 passive treasury each lap, 2× rent), pulls the nearest rival forward with a magnetic golden tether, and glides with Golden Scarab Wings!',
      haloColor: '#ffd700'
    };
  }

  if (isAstralSovereign(role) || cid.includes('astral') || cid.includes('supernova') || cid.includes('aegis') || matchesSeasonId(cid, 's6')) {
    return {
      id: 'astral_tithe',
      badge: '🪐 S6 MYTHIC ULTIMATE',
      title: 'SUPERNOVA CELESTIAL TITHE',
      desc: 'Summons cosmic stardust shockwave, siphons 25% rent from all rivals, and grants 2× Celestial Shield on all territories!',
      haloColor: '#c084fc'
    };
  }
  if (isMonacoHighRoller(role) || cid.includes('monaco') || cid.includes('royale') || cid.includes('roulette') || cid.includes('high_roller') || matchesSeasonId(cid, 's4')) {
    return {
      id: 'monaco_gold_rush',
      badge: '🎰 S4 MYTHIC ULTIMATE',
      title: 'ROYAL FLUSH GOLD RUSH',
      desc: 'Golden roulette cascade: +800🪙 instant High-Roller payout, 3× rent on all your properties, and next roll locked for speed!',
      haloColor: '#ffd700'
    };
  }
  if (isAbyssalDrifter(role) || cid.includes('abyss') || cid.includes('atlantis') || cid.includes('emperor') || cid.includes('siren') || cid.includes('leviathan') || cid.includes('jellyfish') || matchesSeasonId(cid, 's5')) {
    return {
      id: 'abyss_cataclysm',
      badge: '🔱 S5 MYTHIC ULTIMATE',
      title: 'MAELSTROM CATACLYSM & THE KRAKEN TRENCH',
      desc: 'Summons the Abyssal Trident! Sucks the leading rival 4 tiles backward into the whirlpool, drains -180🪙 oxygen tax, and permanently floods 3 tiles into Coral Palaces (+30% Rent) / Sunken Ruins (0 Rent)!',
      haloColor: '#06b6d4'
    };
  }
  if (isNagaWarden(role) || ['s1_naga_m', 's1_kinnaree_f'].includes(cid) || cid.includes('naga') || cid.includes('kinnaree')) {
    return {
      id: 'naga_surge',
      badge: '🐉 S1 MYTHIC ULTIMATE',
      title: 'THE SACRED MEKONG FLASH FLOOD',
      desc: 'Emerald serpent coils from the deep! Floods 3 properties into Sacred Waterways (+30% Rent, pushes rivals 2 tiles downstream into kill-zones), shields all Bangkok properties, and siphons +180🪙 flood tribute!',
      haloColor: '#10b981'
    };
  }
  if (isInariFoxfire(role) || cid.includes('inari') || cid.includes('kitsune') || cid.includes('foxfire')) {
    return {
      id: 'inari_mirage',
      badge: '🦊 S2 MYTHIC ULTIMATE',
      title: 'NINE-TAIL DOPPELGÄNGER & WEALTH MIRROR',
      desc: 'Sprouts 9 blazing Foxfire Tails! Summons the 3D Foxfire Torii Gate, curses rivals with Direction Inversion, siphons 25% liquid coins, and swaps physical runway positions with the leader!',
      haloColor: '#ec4899'
    };
  }
  if (isCelestialEclipse(role) || cid.includes('eclipse') || cid.includes('celestial') || cid.includes('tsukuyomi') || cid.includes('amaterasu')) {
    return {
      id: 'eclipse_convergence',
      badge: '☀️ S2 MYTHIC ULTIMATE',
      title: 'TOTAL LUNAR BLACKOUT & SOMNAMBULISM TRANCE',
      desc: 'Solar and lunar disks merge into total cosmic blackout! Traps rivals in Somnambulism Sleepwalk (pulled 3 tiles into Eclipse properties with 1.5× Nightmare Toll) and nullifies rival rent for 1 round!',
      haloColor: '#fbbf24'
    };
  }
  if (isDjinnMirage(role) || cid.includes('djinn') || cid.includes('sultan') || cid.includes('genie')) {
    return {
      id: 'djinn_wish',
      badge: '🪔 S3 MYTHIC ULTIMATE',
      title: 'COSMIC DJINN: REALITY OF THE THREE WISHES',
      desc: 'Unseals the Golden Cosmic Lamp! Choose from 3 Legendary Wishes: Mirage Oasis (Swap ANY 2 properties), Midas Touch (transmute rival hotel to gold), or Flying Carpet +350🪙 gold wish grant!',
      haloColor: '#a855f7'
    };
  }
  if (isPhoenixAscendant(role) || cid.includes('phoenix')) {
    return {
      id: 'phoenix_rebirth',
      badge: '🔥 S3 MYTHIC ULTIMATE',
      title: 'SUPERNOVA CREMATION & ASH ASCENSION',
      desc: 'Incinerates all rival shields across the board! Rises from the ashes with +300🪙 surge, carpets 4 tiles in Sacred Golden Embers (+40🪙 heat damage), and teleports to START with Lap Bonus (+500🪙 total)!',
      haloColor: '#f97316'
    };
  }
  return {
    id: 'pilot_boost',
    badge: '✈️ ACE PILOT ULTIMATE',
    title: 'AFTERBURNER JET OVERDRIVE',
    desc: 'Engages supersonic twin-turbines: blasts forward to the nearest unclaimed city and acquires it with 50% airline subsidy!',
    haloColor: '#38bdf8'
  };
}

/** Synchronizes live avatar & vault loadouts directly into Monopoly state, perks, HUD, and board tokens. */
function syncMonopolyCostumes() {
  if (!monopolyState || !monopolyState.players) return;
  const myRole = getMonopolyMyRole();

  ['bkk', 'dxb'].forEach((role) => {
    const pl = monopolyState.players[role];
    if (!pl || pl.isBot) return;

    let av = null;
    if (role === myRole) {
      av = window.getMyAvatar ? window.getMyAvatar() : null;
    } else {
      av = window.getPartnerAvatar ? window.getPartnerAvatar() : null;
    }

    const cid = activeCostumeId(role);
    if (cid) {
      pl.costume = cid;
    }
    if (av?.sprite) {
      pl.sprite = av.sprite;
    }
    if (av?.name) {
      pl.name = av.name;
    }
  });

  // Re-evaluate perks for the current costumes
  if (window.NookVault && typeof window.NookVault.monopolyPerks === 'function') {
    const freshPerks = window.NookVault.monopolyPerks();
    if (freshPerks) {
      monopolyState.perks = monopolyState.perks || {};
      Object.keys(monopolyState.players || {}).forEach((r) => {
        if (!monopolyState.players[r]?.isBot && freshPerks[r]) {
          monopolyState.perks[r] = { ...freshPerks[r] };
        }
      });
    }
  }

  updateMonopolyHUD();
  renderMonopolyBoard();
  saveLocalMonopolyState();
}
window.syncMonopolyCostumes = syncMonopolyCostumes;
window.NookMonoV2 = { syncLoadout: syncMonopolyCostumes };

function executeUltimate(role) {
  const st = monopolyState;
  const p = st.players && st.players[role];
  if (!p) return;
  if (p.isBot && p.botLevel !== 'insane') return; // Easy and hard bots NEVER use ultimates
  p.ult = 0;
  const ultData = getRoleUltimate(role);
  AudioFX.init();

  isAnimating = true;
  activeRollLocks[role] = true;
  setTimeout(() => {
    isAnimating = false;
    releaseRoleLocks(role);
    flushQueuedMessages();
    renderAll();
    if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
      checkBotTurn();
    }
  }, 2650);

  triggerUltimateEffects(role, ultData, true);

  if (st.mode !== 'bot' && typeof sendSignaling === 'function') {
    sendSignaling({
      type: 'monopoly_action',
      action: 'cast_ultimate',
      role,
      ultimateType: ultData.id,
      state: st
    });
  }

  renderAll();
  pushState();
}

function triggerUltimateEffects(role, ultData, isInitiator = false) {
  const st = monopolyState;
  const p = st.players[role];
  if (!p) return;
  p.ult = 0;

  if (!ultData || typeof ultData === 'string' || !ultData.id) {
    ultData = getRoleUltimate(role);
  }

  // 1. Gameplay State Mutations (apply once by initiator)
  let tacticalSummary = {};
  switch (ultData.id) {
    case 'absolute_zero': {
      let totalSiphoned = 0;
      const victimSiphons = [];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      
      rivals.forEach(r => {
        const targetP = st.players[r];
        if (!targetP) return;
        const siphonAmt = Math.min(targetP.miles, Math.max(75, Math.floor(targetP.miles * 0.15)));
        if (isInitiator) {
          targetP.cryoStasis = 1; // subzero dice crippling next roll
          targetP.miles = Math.max(0, targetP.miles - siphonAmt);
        }
        totalSiphoned += siphonAmt;
        victimSiphons.push({ role: r, name: targetP.name || r, amount: siphonAmt });
      });

      const findNearestPropertyTile = (fromPos, preferRival = false) => {
        const propTiles = MONOPOLY_TILES.filter(t => t.type === 'property');
        propTiles.sort((a, b) => ((a.id - fromPos + 20) % 20) - ((b.id - fromPos + 20) % 20));
        if (preferRival) {
          const rivalTile = propTiles.find(t => st.properties[t.id]?.owner && st.properties[t.id].owner !== role);
          if (rivalTile) return rivalTile.id;
        }
        const unshielded = propTiles.find(t => !st.properties[t.id]?.shield && !st.properties[t.id]?.frostShield && !st.properties[t.id]?.waterShield && !st.properties[t.id]?.torchShield);
        return (unshielded || propTiles[0]).id;
      };

      if (isInitiator) {
        p.miles += totalSiphoned;
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.zeroRentIceBridge = 1;
        p.hasFrostDragonWings = true;

        // Fortify all Elsa's owned properties with Frost Shields
        ownedTileIds(role).forEach(tid => {
          if (st.properties[tid]) st.properties[tid].frostShield = true;
        });

        // Erect the 3D Glacial Ice Citadel
        const myProps = ownedTileIds(role);
        let citadelTile = null;
        if (myProps.length > 0) {
          // Sort by level desc, then base price desc
          myProps.sort((a, b) => {
            const pa = st.properties[a], pb = st.properties[b];
            const la = (pa && pa.level) || 1, lb = (pb && pb.level) || 1;
            if (lb !== la) return lb - la;
            return (MONOPOLY_TILES[b]?.price || 0) - (MONOPOLY_TILES[a]?.price || 0);
          });
          citadelTile = myProps[0];
          st.properties[citadelTile].level = 3;
          st.properties[citadelTile].isGlacialCitadel = true;
          st.properties[citadelTile].frostShield = true;
        } else {
          // Option A Fallback: Automatically claim nearest prime vacant tile for free + +200🪙 Royal Compensation!
          const vacantTiles = MONOPOLY_TILES.filter(t => t.type === 'property' && (!st.properties[t.id] || !st.properties[t.id].owner));
          if (vacantTiles.length > 0) {
            vacantTiles.sort((a, b) => {
              const distA = (a.id - p.pos + 20) % 20;
              const distB = (b.id - p.pos + 20) % 20;
              return distA - distB;
            });
            citadelTile = vacantTiles[0].id;
          } else {
            citadelTile = findNearestPropertyTile((p.pos + 3) % 20);
          }
          st.properties[citadelTile] = {
            owner: role,
            level: 3,
            isGlacialCitadel: true,
            frostShield: true
          };
          p.miles += 200; // Royal Compensation
        }
        st.glacialCitadelTile = citadelTile;
        st.glacialCitadelOwner = role;
      }

      tacticalSummary = {
        victimSiphons,
        totalSiphoned,
        citadelTile: st.glacialCitadelTile != null ? st.glacialCitadelTile : 1
      };
      break;
    }

    case 'nile_seduction': {
      let extortedMiles = 0;
      const victimExtortions = [];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      rivals.forEach(r => {
        const rp = st.players[r];
        if (!rp) return;
        const extortAmt = Math.min(rp.miles, Math.max(80, Math.floor(rp.miles * 0.15)));
        if (isInitiator) {
          rp.miles = Math.max(0, rp.miles - extortAmt);
          if (rp.inventory && rp.inventory.length > 0) {
            rp.inventory = rp.inventory.filter(item => item === 'shield');
          }
        }
        extortedMiles += extortAmt;
        victimExtortions.push({ role: r, name: rp.name || r, amount: extortAmt });
      });

      let pyramidTile = null;
      if (isInitiator) {
        p.miles += extortedMiles;
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.hasGildedScarabWings = true;

        const myProps = ownedTileIds(role);
        if (myProps.length > 0) {
          myProps.sort((a, b) => {
            const pa = st.properties[a], pb = st.properties[b];
            const la = (pa && pa.level) || 1, lb = (pb && pb.level) || 1;
            if (lb !== la) return lb - la;
            return (MONOPOLY_TILES[b]?.price || 0) - (MONOPOLY_TILES[a]?.price || 0);
          });
          pyramidTile = myProps[0];
          st.properties[pyramidTile].level = 3;
          st.properties[pyramidTile].isGoldenPyramid = true;
        } else {
          const vacant = MONOPOLY_TILES.filter(t => t.type === 'property' && (!st.properties[t.id] || !st.properties[t.id].owner));
          if (vacant.length > 0) {
            vacant.sort((a, b) => ((a.id - p.pos + 20) % 20) - ((b.id - p.pos + 20) % 20));
            pyramidTile = vacant[0].id;
          } else {
            const propTiles = MONOPOLY_TILES.filter(t => t.type === 'property');
            propTiles.sort((a, b) => ((a.id - p.pos + 20) % 20) - ((b.id - p.pos + 20) % 20));
            pyramidTile = propTiles[0].id;
          }
          st.properties[pyramidTile] = {
            owner: role,
            level: 3,
            isGoldenPyramid: true
          };
          p.miles += 250;
        }
        st.goldenPyramidTile = pyramidTile;
        st.goldenPyramidOwner = role;
      }

      tacticalSummary = {
        victimExtortions,
        extortedMiles,
        pyramidTile: st.goldenPyramidTile != null ? st.goldenPyramidTile : 1
      };
      break;
    }

    case 'solar_wrath': {
      let scorchedMiles = 0;
      const victimScorches = [];
      const downgradedTiles = [];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);

      if (isInitiator) {
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.hasSolarFalconWings = true;

        // ☀️ Consecrate Heliopolis Sun Disk Obelisk on Ra's highest property (+25% Rent)
        const myProps = ownedTileIds(role);
        if (myProps.length > 0) {
          myProps.sort((a, b) => ((st.properties[b]?.level || 1) - (st.properties[a]?.level || 1)) || ((MONOPOLY_TILES[b]?.price || 0) - (MONOPOLY_TILES[a]?.price || 0)));
          const obeliskTile = myProps[0];
          st.properties[obeliskTile].level = Math.max(3, st.properties[obeliskTile].level || 1);
          st.properties[obeliskTile].isSolarObelisk = true;
          st.solarObeliskTile = obeliskTile;
        }

        Object.keys(st.properties).forEach(tid => {
          const pr = st.properties[tid];
          if (pr.owner && pr.owner !== role && (pr.level || 1) > 1) {
            pr.level = Math.max(1, (pr.level || 1) - 1);
            downgradedTiles.push(Number(tid));
          }
        });
      }

      rivals.forEach(r => {
        const rp = st.players[r];
        if (!rp) return;
        const scorchAmt = isInitiator ? Math.min(rp.miles, 120) : 120;
        if (isInitiator) {
          rp.miles = Math.max(0, rp.miles - scorchAmt);
        }
        scorchedMiles += scorchAmt;
        victimScorches.push({ role: r, name: rp.name || r, amount: scorchAmt });
      });

      if (isInitiator) {
        p.miles += scorchedMiles;
      }

      tacticalSummary = {
        victimScorches,
        scorchedMiles,
        downgradedTiles
      };
      break;
    }

    case 'phantom_curtain_call': {
      let siphonedMiles = 0;
      const victimStasis = [];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);

      if (isInitiator) {
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.hasPhantomWaltzWings = true;
        p.phantomRentReversals = (p.phantomRentReversals || 0) + 2;

        // Place Reverse Rent Hex Mirror on nearest rival property (or nearest property tile)
        const propTiles = MONOPOLY_TILES.filter(t => t.type === 'property');
        propTiles.sort((a, b) => ((a.id - p.pos + 20) % 20) - ((b.id - p.pos + 20) % 20));
        const rivalProp = propTiles.find(t => st.properties[t.id]?.owner && st.properties[t.id].owner !== role);
        st.reverseRentHexTile = rivalProp ? rivalProp.id : propTiles[0].id;
        st.reverseRentHexOwner = role;
      }

      rivals.forEach(r => {
        const rp = st.players[r];
        if (!rp) return;
        const siphAmt = isInitiator ? Math.min(rp.miles, 150) : 150;
        if (isInitiator) {
          rp.marionetteStasisRounds = 2; // Next 2 rolls capped at 3
          rp.miles = Math.max(0, rp.miles - siphAmt);
        }
        siphonedMiles += siphAmt;
        victimStasis.push({ role: r, name: rp.name || r, amount: siphAmt });
      });

      if (isInitiator) {
        p.miles += siphonedMiles;
      }

      tacticalSummary = {
        victimStasis,
        siphonedMiles,
        hexTile: st.reverseRentHexTile != null ? st.reverseRentHexTile : 1
      };
      break;
    }

    case 'olympus_wrath': {
      let totalStrikes = 0;
      const victimStrikes = [];
      let rubbleCash = 120;
      let smiteTile = st.olympusTempleTile || 1;
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);

      if (isInitiator) {
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.hasOlympusPegasusWings = true;

        // 🏛️ Consecrate Mount Olympus Temple Wonder
        let templeTile = null;
        const myProps = ownedTileIds(role);
        if (myProps.length > 0) {
          // Elevate highest owned property to Level 3 + Mount Olympus Temple
          myProps.sort((a, b) => {
            const pa = st.properties[a], pb = st.properties[b];
            const la = (pa && pa.level) || 1, lb = (pb && pb.level) || 1;
            if (lb !== la) return lb - la;
            return (MONOPOLY_TILES[b]?.price || 0) - (MONOPOLY_TILES[a]?.price || 0);
          });
          templeTile = myProps[0];
          st.properties[templeTile].level = Math.max(3, (st.properties[templeTile].level || 1));
          st.properties[templeTile].isOlympusTemple = true;
          st.properties[templeTile].lightningRod = true;
        } else {
          // Early-Game Fallback: Claim nearest prime vacant tile for free + build Mount Olympus Temple (Level 2) + +150 Divine Tribute!
          const vacantTiles = MONOPOLY_TILES.filter(t => t.type === 'property' && (!st.properties[t.id] || !st.properties[t.id].owner));
          if (vacantTiles.length > 0) {
            vacantTiles.sort((a, b) => {
              const distA = (a.id - p.pos + 20) % 20;
              const distB = (b.id - p.pos + 20) % 20;
              return distA - distB;
            });
            templeTile = vacantTiles[0].id;
          } else {
            const propTiles = MONOPOLY_TILES.filter(t => t.type === 'property');
            propTiles.sort((a, b) => ((a.id - p.pos + 20) % 20) - ((b.id - p.pos + 20) % 20));
            templeTile = propTiles[0].id;
          }
          st.properties[templeTile] = {
            owner: role,
            level: 2,
            isOlympusTemple: true,
            lightningRod: true
          };
          p.miles += 150; // Divine Tribute
        }
        st.olympusTempleTile = templeTile;
        st.olympusTempleOwner = role;

        // Find highest rival hotel to demolish
        const rivalProps = Object.keys(st.properties).filter(tid => {
          const pr = st.properties[tid];
          return pr && pr.owner && pr.owner !== role && (pr.level || 1) >= 2;
        }).sort((a, b) => (st.properties[b].level || 1) - (st.properties[a].level || 1));

        if (rivalProps.length > 0) {
          smiteTile = Number(rivalProps[0]);
          st.properties[smiteTile].level = Math.max(1, (st.properties[smiteTile].level || 1) - 1);
        } else {
          smiteTile = templeTile;
        }
      }

      rivals.forEach(r => {
        const rp = st.players[r];
        if (!rp) return;
        const strikeAmt = isInitiator ? Math.min(rp.miles, 150) : 150;
        if (isInitiator) {
          rp.miles = Math.max(0, rp.miles - strikeAmt);
        }
        totalStrikes += strikeAmt;
        victimStrikes.push({ role: r, name: rp.name || r, amount: strikeAmt });
      });

      if (isInitiator) {
        p.miles += totalStrikes + rubbleCash;
      }

      tacticalSummary = {
        victimStrikes,
        rubbleCash,
        smiteTile,
        totalSiphoned: totalStrikes + rubbleCash
      };
      break;
    }

    case 'lantern_festival': {
      const wishCandidates = [(p.pos + 3) % 20, (p.pos + 7) % 20, (p.pos + 12) % 20];
      if (isInitiator) {
        p.bankruptcyImmunity = 2; // Lasts for 2 rounds
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.miles += 300;
        st.wishSanctuaries = st.wishSanctuaries || {};
        wishCandidates.forEach(tid => {
          st.wishSanctuaries[tid] = { reward: 150, creator: role, rounds: 3 };
        });
      }
      tacticalSummary = { wishTiles: wishCandidates };
      break;
    }

    case 'midnight_paradox': {
      let regressedCount = 0;
      if (isInitiator) {
        st.midnightReverseRounds = 2;
        st.midnightCaster = role;
        Object.keys(st.properties).forEach(tid => {
          const pr = st.properties[tid];
          if (pr.owner && pr.owner !== role && (pr.level || 1) > 1) {
            pr.level = Math.max(1, (pr.level || 1) - 1);
            regressedCount++;
          }
        });
        if (regressedCount > 0) p.miles += regressedCount * 100;
      }
      tacticalSummary = { regressedCount };
      break;
    }

    case 'breaking_the_curse': {
      let smashedHotelTile = null;
      let shockDamage = 180;
      const upgradedTiles = [];
      let claimedTile = null;
      let cashGranted = 0;
      const rivalKey = Object.keys(st.players).find(r => r !== role && !st.players[r].bankrupt);

      if (isInitiator) {
        // --- PART 1: THE BEAST'S RAMPAGE (OFFENSE) ---
        if (rivalKey && st.players[rivalKey]) {
          const rivalP = st.players[rivalKey];
          // 1. Shock Damage: Deal 180 shock damage (capped to not go negative)
          const actualDmg = Math.min(shockDamage, rivalP.miles);
          rivalP.miles = Math.max(0, rivalP.miles - shockDamage);
          p.miles += actualDmg;

          // 2. Smash rival's highest-level hotel (level > 1)
          const rivalProps = ownedTileIds(rivalKey).filter(tid => st.properties[tid] && (st.properties[tid].level || 1) > 1);
          if (rivalProps.length > 0) {
            rivalProps.sort((a, b) => (st.properties[b].level || 1) - (st.properties[a].level || 1) || propValue(b) - propValue(a));
            smashedHotelTile = rivalProps[0];
            st.properties[smashedHotelTile].level = Math.max(1, (st.properties[smashedHotelTile].level || 1) - 1);
          } else {
            // If rival has no upgraded hotels, deal an extra -100 coins direct damage
            const extraDmg = Math.min(100, rivalP.miles);
            rivalP.miles = Math.max(0, rivalP.miles - extraDmg);
            p.miles += extraDmg;
            shockDamage += extraDmg;
          }
        }

        // --- PART 2: PRINCE ADAM'S RESTORATION (CASTLE ASCENDANCE) ---
        const myProps = ownedTileIds(role);
        if (myProps.length > 0) {
          // Upgrade up to 2 of Adam's properties by +1 Level for FREE (prioritizing lowest level up to 3)
          const upgradable = myProps.filter(tid => (st.properties[tid].level || 1) < 3);
          upgradable.sort((a, b) => (st.properties[a].level || 1) - (st.properties[b].level || 1));
          const toUpgrade = upgradable.slice(0, 2);
          toUpgrade.forEach(tid => {
            st.properties[tid].level = Math.min(3, (st.properties[tid].level || 1) + 1);
            upgradedTiles.push(tid);
          });

          // If Adam only had 1 upgradable property or all were already maxed (Level 3):
          if (upgradedTiles.length < 2) {
            const vacantTiles = MONOPOLY_TILES.filter(t => t.type === 'property' && (!st.properties[t.id] || !st.properties[t.id].owner));
            if (vacantTiles.length > 0) {
              vacantTiles.sort((a, b) => {
                const distA = (a.id - p.pos + MONOPOLY_TILES.length) % MONOPOLY_TILES.length;
                const distB = (b.id - p.pos + MONOPOLY_TILES.length) % MONOPOLY_TILES.length;
                return distA - distB;
              });
              claimedTile = vacantTiles[0].id;
              st.properties[claimedTile] = { owner: role, level: 1, enchantedTurret: true };
            } else {
              p.miles += 200;
              cashGranted += 200;
            }
          }
        } else {
          // Early game fallback: Adam owns 0 properties yet!
          // Claim up to 2 vacant properties for free + +250 miles
          const vacantTiles = MONOPOLY_TILES.filter(t => t.type === 'property' && (!st.properties[t.id] || !st.properties[t.id].owner));
          vacantTiles.sort((a, b) => {
            const distA = (a.id - p.pos + MONOPOLY_TILES.length) % MONOPOLY_TILES.length;
            const distB = (b.id - p.pos + MONOPOLY_TILES.length) % MONOPOLY_TILES.length;
            return distA - distB;
          });
          const toClaim = vacantTiles.slice(0, 2);
          toClaim.forEach(t => {
            st.properties[t.id] = { owner: role, level: 1, enchantedTurret: true };
            upgradedTiles.push(t.id);
          });
          p.miles += 250;
          cashGranted += 250;
        }

        // --- PART 3: ENCHANTED ROSE TURRETS (+30% RENT) ---
        ownedTileIds(role).forEach(tid => {
          if (st.properties[tid]) st.properties[tid].enchantedTurret = true;
        });
      }

      tacticalSummary = {
        smashedHotelTile,
        shockDamage,
        upgradedTiles: upgradedTiles.length ? upgradedTiles : ownedTileIds(role).slice(0, 2),
        claimedTile,
        cashGranted,
        rivalKey
      };
      break;
    }

    case 'astral_tithe': {
      let totalSiphoned = 0;
      const victims = [];
      Object.keys(st.players).forEach(otherR => {
        if (otherR !== role && !st.players[otherR].bankrupt) {
          const siph = Math.min(150, Math.max(30, Math.round(st.players[otherR].miles * 0.25)));
          if (isInitiator) {
            st.players[otherR].miles = Math.max(0, st.players[otherR].miles - siph);
          }
          totalSiphoned += siph;
          victims.push({ role: otherR, amount: siph, name: st.players[otherR].name || otherR });
        }
      });
      if (isInitiator) {
        p.miles += totalSiphoned;
        ownedTileIds(role).forEach(tid => {
          if (st.properties[tid]) st.properties[tid].shield = 2;
        });
      }
      tacticalSummary = { totalSiphoned, victims };
      break;
    }

    case 'monaco_gold_rush': {
      if (isInitiator) {
        p.miles += 800;
        p.loadedRoll = 6;
        p.goldenRollNext = true;
        p.monacoGoldRushRounds = 2; // 1.5× VIP Gold Rush rent on Monaco's properties for 2 rounds
      }
      break;
    }

    case 'abyss_cataclysm': {
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      let targetR = rivals.length > 0 ? rivals.sort((a, b) => netWorth(b) - netWorth(a))[0] : null;
      let targetP = targetR ? st.players[targetR] : null;
      const tidalDmg = targetP ? Math.min(180, Math.max(60, Math.round(targetP.miles * 0.25))) : 120;
      const floodedTiles = [];

      if (isInitiator) {
        if (targetP) {
          targetP.pos = (targetP.pos - 4 + MONOPOLY_TILES.length) % MONOPOLY_TILES.length;
          targetP.miles = Math.max(0, targetP.miles - tidalDmg);
          targetP.waterlogged = true;
          p.miles += tidalDmg;
        }
        // Flood 3 strategic tiles into Coral Palaces (+30% rent) / Sunken Ruins (0 rent for 3 rounds or until drained/evaporated)
        st.floodedTiles = st.floodedTiles || {};
        const floodCandidates = [
          targetP ? targetP.pos : (p.pos + 4) % 20,
          (p.pos + 2) % 20,
          (p.pos + 3) % 20
        ];
        floodCandidates.forEach(tid => {
          st.floodedTiles[tid] = { floodedBy: role, rounds: 3 };
          floodedTiles.push(tid);
        });
      } else if (st.floodedTiles) {
        Object.keys(st.floodedTiles).slice(0, 3).forEach(tid => floodedTiles.push(Number(tid)));
      }
      tacticalSummary = { targetR, targetP, tidalDmg, floodedTiles };
      break;
    }

    case 'naga_surge': {
      let floodTribute = 0;
      const victims = [];
      const nagaTiles = [];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      if (isInitiator) {
        p.miles += 500;
        p.clashTokens = Math.min(4, (p.clashTokens || 0) + 1);

        // Fortify all Naga's properties with Water Shields
        ownedTileIds(role).forEach(tid => {
          if (st.properties[tid]) st.properties[tid].waterShield = true;
        });

        // Flood Bangkok (1, 2, 3) or top 3 highest value properties into Sacred Waterways
        st.sacredWaterways = st.sacredWaterways || {};
        const topProps = Object.keys(st.properties)
          .filter(tid => st.properties[tid]?.owner)
          .sort((a, b) => (st.properties[b].level || 1) - (st.properties[a].level || 1))
          .slice(0, 3)
          .map(Number);
        const candidates = topProps.length >= 3 ? topProps : [1, 2, 3];
        candidates.forEach(tid => {
          st.sacredWaterways[tid] = { creator: role, bonusRent: 0.30, rounds: 2 };
          nagaTiles.push(tid);
        });
      } else if (st.sacredWaterways) {
        Object.keys(st.sacredWaterways).forEach(tid => nagaTiles.push(Number(tid)));
      }

      // Siphon 60🪙 flood relief tribute from all rivals
      rivals.forEach(r => {
        const rp = st.players[r];
        if (!rp) return;
        const siph = isInitiator ? Math.min(rp.miles, 60) : 60;
        if (isInitiator) {
          rp.miles = Math.max(0, rp.miles - siph);
        }
        floodTribute += siph;
        victims.push({ role: r, amount: siph });
      });
      if (isInitiator) {
        p.miles += floodTribute;
      }
      tacticalSummary = { siphonedTotal: floodTribute, nagaTiles, victims };
      break;
    }

    case 'inari_mirage': {
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      const targetR = rivals.length > 0 ? rivals.sort((a, b) => netWorth(b) - netWorth(a))[0] : null;
      const targetP = targetR ? st.players[targetR] : null;
      let siphonedRent = 150;
      let toriiTile = (p.pos + 5) % 20;

      if (isInitiator) {
        p.foxfireTails = 3;

        // Erect Inari Torii Gate (expires after 3 rounds if unconsumed)
        st.inariToriiGates = st.inariToriiGates || {};
        st.inariToriiGates[toriiTile] = { creator: role, rounds: 3 };

        if (targetP) {
          siphonedRent = Math.min(350, Math.max(80, Math.round(targetP.miles * 0.25)));
          targetP.miles = Math.max(0, targetP.miles - siphonedRent);
          p.miles += siphonedRent;

          // Swap runway physical positions with the leader!
          const tempPos = p.pos;
          p.pos = targetP.pos;
          targetP.pos = tempPos;
          targetP.invertDirectionNext = true; // Invert movement direction on their next turn!
        }
      }
      tacticalSummary = { targetR, targetP, toriiTile, siphonedRent };
      break;
    }

    case 'eclipse_convergence': {
      const rivalTiles = Object.keys(st.properties).filter(tid => st.properties[tid]?.owner && st.properties[tid].owner !== role).map(Number);
      if (isInitiator) {
        st.eclipseInvertRounds = 1;
        st.eclipseCaster = role;
        p.miles += 300;

        // Mark rival properties as Eclipse Shadow Tiles (1.5× Nightmare Toll)
        st.eclipseShadowTiles = st.eclipseShadowTiles || {};
        rivalTiles.forEach(tid => {
          st.eclipseShadowTiles[tid] = { caster: role, rounds: 1 };
        });

        // Inflict Somnambulism on rivals: pulled 3 tiles forward on next turn
        const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
        rivals.forEach(r => {
          const rp = st.players[r];
          if (rp) rp.somnambulismSteps = 3;
        });
      }
      tacticalSummary = { rivalTiles };
      break;
    }

    case 'djinn_wish': {
      const myTiles = ownedTileIds(role);
      let upgradedTileId = myTiles[0] != null ? myTiles[0] : null;
      let transmutedTileId = null;

      if (isInitiator) {
        p.miles += 350;

        // Upgrade lowest owned property for free
        if (myTiles.length > 0) {
          const lowestId = myTiles.sort((a, b) => (st.properties[a].level || 1) - (st.properties[b].level || 1))[0];
          if (st.properties[lowestId]) {
            st.properties[lowestId].level = Math.min(3, (st.properties[lowestId].level || 1) + 1);
          }
          upgradedTileId = lowestId;
        } else {
          p.miles += 200;
          if (p.inventory && p.inventory.length < MONO_CFG.MAX_ITEMS && !p.inventory.includes('golden_dice')) {
            p.inventory.push('golden_dice');
          }
        }

        // Midas Touch: Transmute rival's highest hotel into solid gold (0 rent, grants 80🪙 payout)
        const rivalHotels = Object.keys(st.properties)
          .filter(tid => st.properties[tid]?.owner && st.properties[tid].owner !== role && (st.properties[tid].level || 1) >= 2)
          .sort((a, b) => (st.properties[b].level || 1) - (st.properties[a].level || 1));
        if (rivalHotels.length > 0) {
          transmutedTileId = Number(rivalHotels[0]);
          st.properties[transmutedTileId].isTransmutedGold = true;
          st.properties[transmutedTileId].transmutedRounds = 2;
        }

        // Manifest Oasis Portal on 2 tiles (expires after 3 rounds if unconsumed)
        st.djinnOasisTiles = st.djinnOasisTiles || {};
        [(p.pos + 3) % 20, (p.pos + 7) % 20].forEach(tid => {
          st.djinnOasisTiles[tid] = { creator: role, bonusReward: 75, rounds: 3 };
        });
      }
      tacticalSummary = { upgradedTileId, transmutedTileId, wishType: 'empire' };
      break;
    }

    case 'phoenix_rebirth': {
      let heatBurn = 80;
      const emberTiles = [(p.pos + 2) % 20, (p.pos + 5) % 20, (p.pos + 9) % 20, (p.pos + 14) % 20];
      const rivals = Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt);
      const targetR = rivals.length > 0 ? rivals.sort((a, b) => netWorth(b) - netWorth(a))[0] : null;
      const targetP = targetR ? st.players[targetR] : null;

      if (isInitiator) {
        p.miles += 300;
        p.pos = 0;
        grantMiles(role, MONO_CFG.LAP_BONUS); // +200🪙 Lap Bonus (+500🪙 total)
        p.phoenixGraceActive = true; // Invincible Sunfire Armor

        // Incinerate all rival shields across the board
        Object.keys(st.properties).forEach(tid => {
          const pr = st.properties[tid];
          if (pr && pr.owner && pr.owner !== role) {
            delete pr.shield;
            delete pr.frostShield;
            delete pr.waterShield;
            delete pr.torchShield;
          }
        });

        // Carpet 4 tiles in Sacred Golden Embers
        st.phoenixEmbers = st.phoenixEmbers || {};
        emberTiles.forEach(tid => {
          st.phoenixEmbers[tid] = { creator: role, damage: 40, rounds: 2 };
        });

        // Scorch leading rival for 80🪙 heat damage
        if (targetP) {
          heatBurn = Math.min(targetP.miles, 80);
          targetP.miles = Math.max(0, targetP.miles - heatBurn);
          p.miles += heatBurn;
        }
      }
      tacticalSummary = { emberTiles, heatBurn, targetR, targetP };
      break;
    }

    default: {
      let targetTileId = null;
      for (let s = 1; s <= MONOPOLY_TILES.length; s++) {
        const candidate = (p.pos + s) % MONOPOLY_TILES.length;
        const t = MONOPOLY_TILES[candidate];
        if (t.type === 'property' && (!st.properties[candidate] || !st.properties[candidate].owner)) {
          targetTileId = candidate;
          break;
        }
      }
      if (isInitiator) {
        if (targetTileId != null) {
          p.pos = targetTileId;
          const discCost = Math.round(MONOPOLY_TILES[targetTileId].price * 0.5);
          if (p.miles >= discCost) {
            p.miles -= discCost;
            st.properties[targetTileId] = { owner: role, level: 1 };
          }
        } else {
          p.miles += 400;
        }
      }
      tacticalSummary = { targetTileId };
      break;
    }
  }

  // ⚔️ MYTHIC ELEMENTAL COUNTER-MATRIX (Ultimate Clashes)
  let elementalClashMsg = '';
  const ultId = ultData.id;
  if (['phoenix_rebirth', 'solar_wrath', 'nile_seduction', 'djinn_wish'].includes(ultId)) {
    // 🔥☀️ Fire / Solar / Desert Ultimates melt Ice/Snowdrifts and evaporate Sunken Ruin floods
    let melted = 0;
    let evaporated = 0;
    if (st.snowdriftTraps) {
      Object.keys(st.snowdriftTraps).forEach(tid => {
        if (st.snowdriftTraps[tid] > 0) {
          if (isInitiator) delete st.snowdriftTraps[tid];
          melted++;
        }
      });
    }
    Object.keys(st.properties || {}).forEach(tid => {
      const pr = st.properties[tid];
      if (pr && pr.frosted > 0) {
        if (isInitiator) delete pr.frosted;
        melted++;
      }
      if (st.floodedTiles && st.floodedTiles[tid] && pr && pr.owner && !isAbyssalDrifter(pr.owner)) {
        if (isInitiator) delete st.floodedTiles[tid];
        evaporated++;
      }
    });
    if (isInitiator) {
      delete p.cryoStasis;
      delete p.frozenTurn;
      delete p.waterlogged;
      if (melted + evaporated > 0) {
        p.miles += (melted + evaporated) * 45;
      }
    }
    if (melted + evaporated > 0) {
      const bonus = (melted + evaporated) * 45;
      elementalClashMsg = `🔥❄️ <strong>ELEMENTAL CLASH — THERMAL VAPORIZATION!</strong> ${p.name}'s blazing solar surge melted ${melted} frost hazard(s) & evaporated ${evaporated} flood zone(s) for <strong>+${bonus}🪙 Steam Gold</strong>!`;
    }
  } else if (['absolute_zero', 'abyss_cataclysm', 'naga_surge'].includes(ultId)) {
    // ❄️🌊 Ice / Water Ultimates quench rival Phoenix Embers and Torch Shields
    let quenched = 0;
    if (st.phoenixEmbers) {
      Object.keys(st.phoenixEmbers).forEach(tid => {
        if (st.phoenixEmbers[tid] && st.phoenixEmbers[tid].creator !== role) {
          if (isInitiator) delete st.phoenixEmbers[tid];
          quenched++;
        }
      });
    }
    Object.keys(st.properties || {}).forEach(tid => {
      const pr = st.properties[tid];
      if (pr && pr.owner && pr.owner !== role && pr.torchShield) {
        if (isInitiator) delete pr.torchShield;
        quenched++;
      }
    });
    if (quenched > 0) {
      const bonus = quenched * 45;
      if (isInitiator) p.miles += bonus;
      elementalClashMsg = `🌊🔥 <strong>ELEMENTAL CLASH — CRYO-TIDAL QUENCH!</strong> ${p.name} extinguished ${quenched} rival fire hazard(s) and harvested <strong>+${bonus}🪙 Obsidian Frost</strong>!`;
    }
  } else if (['olympus_wrath', 'astral_tithe'].includes(ultId)) {
    // ⚡🪐 Thunder / Cosmic Ultimates trigger Superconductor Overload on flooded/waterway rivals & shatter shadow curses
    let conductiveBonus = 0;
    let purgedCurses = 0;
    if (st.eclipseShadowTiles) {
      Object.keys(st.eclipseShadowTiles).forEach(tid => {
        if (st.eclipseShadowTiles[tid]?.caster !== role) {
          if (isInitiator) delete st.eclipseShadowTiles[tid];
          purgedCurses++;
        }
      });
    }
    Object.keys(st.properties || {}).forEach(tid => {
      const pr = st.properties[tid];
      if (pr && pr.owner === role && pr.foxfireCursedBy) {
        if (isInitiator) delete pr.foxfireCursedBy;
        purgedCurses++;
      }
    });
    Object.keys(st.players || {}).forEach(r => {
      if (r === role || st.players[r]?.bankrupt) return;
      const rp = st.players[r];
      const onWater = !!(st.floodedTiles?.[rp.pos] || st.sacredWaterways?.[rp.pos] || isAbyssalDrifter(r) || isNagaWarden(r));
      if (onWater) {
        const extraZap = Math.min(rp.miles || 0, 50);
        if (extraZap > 0) {
          if (isInitiator) {
            rp.miles -= extraZap;
            p.miles += extraZap;
          }
          conductiveBonus += extraZap;
        }
      }
    });
    if (conductiveBonus > 0 || purgedCurses > 0) {
      elementalClashMsg = `⚡🌊 <strong>ELEMENTAL CLASH — SUPERCONDUCTOR OVERLOAD!</strong> Celestial plasma arced through water/shadow domains (${purgedCurses} curse(s) shattered, <strong>+${conductiveBonus}🪙 Conductive Shock</strong>)!`;
    }
  } else if (['phantom_curtain_call', 'midnight_paradox', 'inari_mirage', 'eclipse_convergence'].includes(ultId)) {
    // 🎭⏳🦊🌑 Arcane / Trickster Ultimates eclipse rival Tier-4 Monuments for 2 rounds
    let eclipsedMonuments = 0;
    Object.keys(st.properties || {}).forEach(tid => {
      const pr = st.properties[tid];
      if (!pr || !pr.owner || pr.owner === role) return;
      const numTid = Number(tid);
      const isWonder = pr.isGlacialCitadel || pr.isGoldenPyramid || pr.isOlympusTemple || pr.isSolarObelisk ||
        st.glacialCitadelTile === numTid || st.goldenPyramidTile === numTid || st.olympusTempleTile === numTid || st.solarObeliskTile === numTid;
      if (isWonder) {
        if (isInitiator) pr.monumentSuppressedRounds = 2;
        eclipsedMonuments++;
      }
    });
    if (eclipsedMonuments > 0) {
      elementalClashMsg = `🎭🌑 <strong>ELEMENTAL CLASH — MONUMENT ECLIPSE!</strong> ${p.name}'s arcane illusion shrouded ${eclipsedMonuments} rival Tier-4 Wonder(s), suppressing their monumental rent aura for <strong>2 rounds</strong>!`;
    }
  } else if (['monaco_gold_rush', 'breaking_the_curse', 'lantern_festival'].includes(ultId)) {
    // 🎰🌹🏮 Royal / Fairytale Ultimates cleanse movement/stasis curses on caster
    const hadCurse = !!(p.marionetteStasisRounds || p.somnambulismSteps || p.invertDirectionNext || p.waterlogged || p.frozenTurn || p.cryoStasis);
    if (isInitiator && hadCurse) {
      delete p.marionetteStasisRounds;
      delete p.somnambulismSteps;
      delete p.invertDirectionNext;
      delete p.waterlogged;
      delete p.frozenTurn;
      delete p.cryoStasis;
    }
    if (hadCurse) {
      elementalClashMsg = `👑✨ <strong>ELEMENTAL CLASH — ROYAL DECREE CLEANSE!</strong> ${p.name} shattered all active movement & stasis curses!`;
    }
  }
  if (elementalClashMsg) {
    announce(elementalClashMsg);
  }

  if (isInitiator) {
    saveLocalMonopolyState();
  }

  // Direct In-Board Cinematic Eruption (Zero Delay, 100% Board Visibility)
  // A. Visual Shockwave and Screen Flash across the Monopoly Board
  if (window.MonoFX) {
    MonoFX.shake('heavy');
    MonoFX.flash(ultData.haloColor || 'rgba(255, 215, 0, 0.55)', 500);
  }

  // Coordinates in moment layer
  const c = (window.MonoFX && typeof MonoFX.center === 'function') ? MonoFX.center() : { x: 200, y: 200 };
  const rawP = (window.MonoFX && typeof MonoFX.point === 'function') ? MonoFX.point({ token: role }) : null;
  const pCoord = (rawP && !isNaN(rawP.x)) ? rawP : c;

  // B. Signature Ultimate Payoff per Costume
  switch (ultData.id) {
    case 'absolute_zero': {
      const { victimSiphons = [], totalSiphoned = 0, citadelTile = 0 } = tacticalSummary;
      if (AudioFX.playCryoNova) AudioFX.playCryoNova();
      if (window.MonoFX && typeof MonoFX.absoluteZero === 'function') {
        MonoFX.absoluteZero({
          casterRole: role,
          citadelTile,
          victimSiphons,
          totalSiphoned
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('❄️ ABSOLUTE ZERO: GLACIAL CITADEL! 👑', `GLOBAL FLASH FREEZE · +${totalSiphoned}🪙 TRIBUTE · 3D CITADEL RAISED!`, 'cyan', 2200);
        MonoFX.ring(c.x, c.y, 220, '#38bdf8', 700);
        MonoFX.ring(c.x, c.y, 350, '#e0f2fe', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 36, spread: 320, up: 200, life: 1300, size: 24 });
      }
      floatText(p.pos, '❄️ ABSOLUTE ZERO: RISE OF CITADEL! 👑', 'pos fx-big');
      victimSiphons.forEach(vs => {
        const vp = st.players[vs.role];
        if (vp) floatText(vp.pos, `🧊 CRYO-STASIS (-${vs.amount}🪙)`, 'neg fx-big');
      });
      if (citadelTile != null) {
        floatText(citadelTile, '🏰 GLACIAL ICE CITADEL RAISED! 👑', 'pos fx-big');
      }
      announce(`❄️👑 <strong>ABSOLUTE ZERO: RISE OF THE GLACIAL CITADEL!</strong> ${p.name} unleashed a cataclysmic arctic flash freeze: encased <strong>ALL rivals</strong> in solid ice (-${totalSiphoned}🪙 tribute siphoned, Subzero dice crippled)! Erected the majestic <strong>3D Glacial Ice Citadel</strong> at ${MONOPOLY_TILES[citadelTile]?.name || 'Tile'} (±1 AoE Blizzard Tithe, 2× Rent), activated <strong>Ice Dragon Wings & Glacial Glide</strong> with 0-Rent Ice Bridge, and loaded next roll with a Golden 6!`);
      break;
    }

    case 'nile_seduction': {
      const { victimExtortions = [], extortedMiles = 0, pyramidTile = 0 } = tacticalSummary;
      if (AudioFX.playSolarHarp) AudioFX.playSolarHarp();
      else if (AudioFX.playFairytaleHarp) AudioFX.playFairytaleHarp();

      if (window.MonoFX && typeof MonoFX.nileSeduction === 'function') {
        MonoFX.nileSeduction({
          casterRole: role,
          pyramidTile,
          victimExtortions,
          extortedMiles
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🏺 NILE SEDUCTION & GOLDEN PYRAMID! 👑', `MIRAGE INCINERATION · +${extortedMiles}🪙 EXTORTION · GREAT PYRAMID ERECTED!`, 'gold', 2200);
        MonoFX.ring(c.x, c.y, 220, '#ffd700', 700);
        MonoFX.ring(c.x, c.y, 350, '#f59e0b', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 36, spread: 320, up: 200, life: 1300, size: 24 });
      }
      floatText(p.pos, '🏺 NILE SEDUCTION: GREAT PYRAMID! 👑', 'pos fx-big');
      victimExtortions.forEach(ve => {
        const vp = st.players[ve.role];
        if (vp) floatText(vp.pos, `🏺 ROYAL EXTORTION (-${ve.amount}🪙)`, 'neg fx-big');
      });
      if (pyramidTile != null) {
        floatText(pyramidTile, '🏛️ GREAT GOLDEN PYRAMID ERECTED! 👑', 'pos fx-big');
      }
      announce(`🏺👑 <strong>NILE SEDUCTION & SOLAR DYNASTY!</strong> Empress Cleopatra enchanted the board: incinerated rivals' offensive items, extorted <strong>+${extortedMiles}🪙</strong> tribute, erected the <strong>Great Golden Pyramid</strong> at ${MONOPOLY_TILES[pyramidTile]?.name || 'Tile'} (2× Rent, +150🪙 passive treasury interest on laps), unlocked <strong>Golden Scarab Wings</strong>, and locked next roll with a Golden 6!`);
      break;
    }

    case 'solar_wrath': {
      const { victimScorches = [], scorchedMiles = 0, downgradedTiles = [] } = tacticalSummary;
      if (AudioFX.playSolarWrathRay) AudioFX.playSolarWrathRay();
      else if (AudioFX.playBoom) AudioFX.playBoom();

      if (window.MonoFX && typeof MonoFX.solarWrath === 'function') {
        MonoFX.solarWrath({
          casterRole: role,
          victimScorches,
          scorchedMiles,
          downgradedTiles
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('☀️ EYE OF RA: SOLAR WRATH! 🔥', `BLAZING SOLAR STRIKE · +${scorchedMiles}🪙 SCORCHED · RIVAL TOWERS STRIPPED!`, 'gold', 2200);
        MonoFX.ring(c.x, c.y, 220, '#ff4500', 700);
        MonoFX.ring(c.x, c.y, 350, '#ffd700', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'fire', count: 36, spread: 320, up: 200, life: 1300, size: 24 });
      }
      floatText(p.pos, '☀️ EYE OF RA: SOLAR WRATH! 🔥', 'pos fx-big');
      victimScorches.forEach(vs => {
        const vp = st.players[vs.role];
        if (vp) floatText(vp.pos, `🔥 SOLAR SCORCH (-${vs.amount}🪙)`, 'neg fx-big');
      });
      downgradedTiles.forEach(tid => {
        floatText(tid, '⚡ EYE OF RA STRIPPED -1 LVL!', 'neg fx-big');
      });
      announce(`🦅☀️ <strong>SOLAR HIGH NOON: EYE OF RA!</strong> Sun God Ra unleashed celestial solar flares: scorched rivals for <strong>-${scorchedMiles}🪙</strong>, stripped levels from rival properties with the Eye of Ra, manifested <strong>Solar Falcon Wings</strong>, and loaded next roll with a Golden 6!`);
      break;
    }

    case 'phantom_curtain_call': {
      const { victimStasis = [], siphonedMiles = 0, hexTile = 0 } = tacticalSummary;
      if (AudioFX.playPhantomOrgan) AudioFX.playPhantomOrgan();

      if (window.MonoFX && typeof MonoFX.phantomCurtainCall === 'function') {
        MonoFX.phantomCurtainCall({
          casterRole: role,
          hexTile,
          victimStasis,
          siphonedMiles
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🎭 PHANTOM MASQUERADE: CURTAIN CALL! 🥀', `REVERSE RENT HEX DEPLOYED · +${siphonedMiles}🪙 GALA TRIBUTE!`, 'gold', 2200);
        MonoFX.ring(c.x, c.y, 220, '#f43f5e', 700);
        MonoFX.ring(c.x, c.y, 350, '#fbbf24', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 36, spread: 320, up: 200, life: 1300, size: 24 });
      }
      floatText(p.pos, '🎭 PHANTOM CURTAIN CALL! 🥀', 'pos fx-big');
      victimStasis.forEach(vs => {
        const vp = st.players[vs.role];
        if (vp) floatText(vp.pos, `🎭 MARIONETTE STASIS (-${vs.amount}🪙)`, 'neg fx-big');
      });
      if (hexTile != null) {
        floatText(hexTile, '🎭 REVERSE RENT HEX DEPLOYED! 🥀', 'pos fx-big');
      }
      announce(`🎭🥀 <strong>PHANTOM MASQUERADE: THE GRAND CURTAIN CALL!</strong> ${p.name} inverted theatrical fate: summoned the <strong>Venetian Harlequin Mask</strong>, trapped rivals in <strong>Marionette Stasis</strong> (-${siphonedMiles}🪙 gala tribute siphoned, rolls capped at 3), deployed <strong>Reverse Rent Hex</strong> at ${MONOPOLY_TILES[hexTile]?.name || 'Tile'}, and loaded next roll with a Golden 6!`);
      break;
    }

    case 'olympus_wrath': {
      const { victimStrikes = [], rubbleCash = 120, smiteTile = 0, totalSiphoned = 0 } = tacticalSummary;
      if (AudioFX.playOlympusThunder) AudioFX.playOlympusThunder();

      if (window.MonoFX && typeof MonoFX.wrathOfOlympus === 'function') {
        MonoFX.wrathOfOlympus({
          casterRole: role,
          smiteTile,
          victimStrikes,
          rubbleCash
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('⚡ WRATH OF OLYMPUS: ZEUS THUNDER! 🏛️', `ORBITAL SMITE · +${rubbleCash}🪙 RUBBLE CASH · PEGASUS ASCENT!`, 'gold', 2200);
        MonoFX.ring(c.x, c.y, 220, '#38bdf8', 700);
        MonoFX.ring(c.x, c.y, 350, '#fde047', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 36, spread: 320, up: 200, life: 1300, size: 24 });
      }
      floatText(p.pos, '⚡ WRATH OF OLYMPUS! 🏛️', 'pos fx-big');
      victimStrikes.forEach(vs => {
        const vp = st.players[vs.role];
        if (vp) floatText(vp.pos, `⚡ ZEUS BOLT (-${vs.amount}🪙)`, 'neg fx-big');
      });
      if (smiteTile != null) {
        floatText(smiteTile, '⚡ HOTEL STRIPPED -1 LVL! 🏛️', 'neg fx-big');
      }
      announce(`⚡🏛️ <strong>WRATH OF OLYMPUS: THUNDER OF THE GODS!</strong> ${p.name} summoned Mount Olympus Temple: orbital lightning smote ${MONOPOLY_TILES[smiteTile]?.name || 'Tile'} hotel (+${rubbleCash}🪙 rubble cash), struck rivals for divine tribute, unlocked <strong>Pegasus Wings</strong>, and loaded next roll with a Golden 6!`);
      break;
    }

    case 'lantern_festival': {
      if (window.MonoFX && typeof MonoFX.lanternFestival === 'function') {
        MonoFX.lanternFestival({ casterRole: role });
      } else {
        if (AudioFX.playFairytaleHarp) AudioFX.playFairytaleHarp();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('🏮 WISH UPON A LANTERN!', '3 WISH SANCTUARIES · 1-ROUND IMMUNITY · ROLL 6!', 'gold', 1700);
          MonoFX.ring(pCoord.x, pCoord.y, 180, '#fde047', 750);
          MonoFX.ring(pCoord.x, pCoord.y, 280, '#fbbf24', 950);
          MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 28, spread: 260, up: 180, life: 1200, size: 22 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'gem', count: 16, spread: 220, up: 140, life: 1000, size: 18 });
        }
      }
      floatText(p.pos, '🏮 WISH UPON A LANTERN! ✨', 'pos fx-big');
      announce(`🏮✨ <strong>WISH UPON A LANTERN FESTIVAL!</strong> ${p.name} released illuminated sky lanterns across the board: <strong>1-Round Bankruptcy Immunity</strong> granted, <strong>3 Wish Sanctuaries</strong> manifested, and next roll locked at 6!`);
      break;
    }

    case 'midnight_paradox': {
      if (window.MonoFX && typeof MonoFX.midnightParadox === 'function') {
        MonoFX.midnightParadox({ casterRole: role });
      } else {
        if (AudioFX.playMidnightChimes) AudioFX.playMidnightChimes();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('⏳ THE CHRONO-MIDNIGHT PARADOX!', 'RUNWAY REVERSED 2 ROUNDS · HOTELS REGRESSED!', 'cyan', 1700);
          MonoFX.ring(c.x, c.y, 180, '#38bdf8', 700);
          MonoFX.ring(c.x, c.y, 280, '#818cf8', 950);
          MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 30, spread: 280, up: 180, life: 1200, size: 22 });
        }
      }
      floatText(p.pos, '⏳ TIME REVERSED! 👠', 'pos fx-big');
      announce(`⏳👠 <strong>THE CHRONO-MIDNIGHT PARADOX!</strong> Cathedral bells tolled 12:00! Time inverts counter-clockwise for 2 rounds, and rival luxury developments crumble into basic cottages!`);
      break;
    }

    case 'breaking_the_curse': {
      const { smashedHotelTile, shockDamage = 180, upgradedTiles = [], claimedTile, rivalKey } = tacticalSummary;
      const rivalP = rivalKey && st.players[rivalKey];

      if (!window.MonoFX && AudioFX.playCurseBreakChime) {
        AudioFX.playCurseBreakChime();
      }

      if (window.MonoFX && typeof MonoFX.breakingTheCurse === 'function') {
        MonoFX.breakingTheCurse({
          casterRole: role,
          smashedHotelTile,
          upgradedTiles,
          claimedTile,
          shockDamage,
          rivalRole: rivalKey
        });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🦁 BEAST RAMPAGE & ROSE RESTORATION! 🌹', `${smashedHotelTile != null ? 'RIVAL HOTEL SMASHED · ' : ''}+${upgradedTiles.length} CASTLES · -${shockDamage}🪙 SHOCK!`, 'pink', 1800);
        MonoFX.ring(c.x, c.y, 180, '#f472b6', 700);
        MonoFX.ring(c.x, c.y, 300, '#ec4899', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'gem', count: 32, spread: 280, up: 180, life: 1200, size: 22 });
      }

      floatText(p.pos, `🌹 CASTLE ASCENDANCE! (+${upgradedTiles.length} Upgrades)`, 'pos fx-big');
      if (rivalP) {
        floatText(rivalP.pos, `🦁 -${shockDamage}🪙 ROAR SHOCK!`, 'pos');
      }
      if (smashedHotelTile != null) {
        floatText(smashedHotelTile, '💥 HOTEL SMASHED -1 LVL', 'pos');
      }

      const smashText = smashedHotelTile != null
        ? `smashed 1 Level off ${rivalP ? rivalP.name : 'Rival'}'s <strong>${MONOPOLY_TILES[smashedHotelTile]?.name || 'Hotel'}</strong> and siphoned <strong>${shockDamage}🪙</strong>`
        : `blasted ${rivalP ? rivalP.name : 'Rival'} with <strong>-${shockDamage}🪙 Beast Shock damage</strong>`;
      const upText = upgradedTiles.length > 0
        ? `instantly upgraded <strong>${upgradedTiles.length} Castles for free</strong>`
        : (claimedTile != null ? `claimed <strong>${MONOPOLY_TILES[claimedTile]?.name || 'a city'}</strong> for free` : 'restored the royal vault');

      announce(`🦁🌹 <strong>BEAST RAMPAGE & ENCHANTED ROSE RESTORATION!</strong> The Beast's savage roar ${smashText}! Prince Adam ${upText}, fortifying all territories with <strong>Enchanted Rose Turrets (+30% Rent)</strong>!`);
      break;
    }

    case 'astral_tithe': {
      if (AudioFX.playVoidLightning) AudioFX.playVoidLightning();
      else AudioFX.playSupernovaTithe();
      const totalSiphoned = tacticalSummary.totalSiphoned || 0;
      const victims = tacticalSummary.victims || Object.keys(st.players).filter(r => r !== role && !st.players[r].bankrupt).map(r => ({ role: r, amount: 150 }));
      if (window.MonoFX) {
        if (typeof MonoFX.voidLightningTithe === 'function') {
          MonoFX.voidLightningTithe({ casterRole: role, victims, totalSiphoned });
        } else {
          if (MonoFX.banner) MonoFX.banner('🪐 SUPERNOVA TITHE!', `+${totalSiphoned}🪙 AIRSPACE TOLL · 2× SHIELDS!`, 'purple', 1600);
          MonoFX.ring(c.x, c.y, 160, '#c084fc', 600);
          MonoFX.ring(c.x, c.y, 260, '#ffd700', 850);
          MonoFX.ring(c.x, c.y, 360, '#38bdf8', 1100);
          MonoFX.burst({ x: c.x, y: c.y, name: 'supernova_core', count: 18, spread: 250, up: 140, life: 1100 });
          MonoFX.burst({ x: c.x, y: c.y, name: 'vortex_nebula', count: 12, spread: 210, up: 120, life: 1150 });
          MonoFX.burst({ x: c.x, y: c.y, name: 'constellation_sigil', count: 10, spread: 190, up: 110, life: 1050 });
          MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 22, spread: 260, up: 160, gravity: 0, life: 1200, size: 22 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'gem', count: 14, spread: 160, up: 100, gravity: 120, life: 900, size: 18 });
          Object.keys(st.players).forEach(otherR => {
            if (otherR !== role && !st.players[otherR].bankrupt) {
              MonoFX.coins({ from: { role: otherR }, to: { role }, amount: 150 });
            }
          });
        }
      }
      floatText(p.pos, `+${totalSiphoned}🪙 TITHE! 🪐`, 'pos fx-big');
      announce(`🪐✨ <strong>SUPERNOVA CELESTIAL TITHE!</strong> ${p.name} unleashed cosmic void lightning, siphoning <strong>+${totalSiphoned}🪙</strong> from rivals and fortifying territories with 2× Shields!`);
      break;
    }

    case 'monaco_gold_rush': {
      if (window.MonoFX && typeof MonoFX.monacoGoldRush === 'function') {
        MonoFX.monacoGoldRush({ role, amount: 800 });
      } else {
        AudioFX.playCasinoWelcome();
        AudioFX.playCasinoChipRoll();
        if (AudioFX.playCasinoSlam) AudioFX.playCasinoSlam();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('🎰 ROYAL GOLD RUSH!', '+800🪙 VIP JACKPOT · NEXT ROLL 6!', 'gold', 1600);
          MonoFX.ring(pCoord.x, pCoord.y, 180, '#ffd700', 700);
          MonoFX.ring(pCoord.x, pCoord.y, 280, '#f59e0b', 950);
          MonoFX.burst({ x: c.x, y: c.y, name: 'monaco_chip_stack', count: 16, spread: 220, up: 140, life: 1100 });
          MonoFX.burst({ x: c.x, y: c.y, name: 'monaco_roulette_wheel', count: 10, spread: 180, up: 120, life: 1050 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'coin', count: 26, spread: 260, up: 200, gravity: 400, life: 1200, size: 24 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'sparkle', count: 20, spread: 200, up: 140, life: 950 });
          MonoFX.coins({ from: { tileId: 4 }, to: { role }, amount: 800 });
        }
      }
      floatText(p.pos, '+800🪙 GOLD RUSH! 🎰', 'pos fx-big');
      announce(`🎰👑 <strong>ROYAL FLUSH GOLD RUSH!</strong> ${p.name} hit the VIP Monaco Jackpot for <strong>+800🪙</strong> with next roll locked for max speed!`);
      break;
    }

    case 'abyss_cataclysm': {
      const { targetR, targetP, tidalDmg = 120, floodedTiles = [] } = tacticalSummary;
      if (window.MonoFX && typeof MonoFX.abyssalCataclysm === 'function') {
        MonoFX.abyssalCataclysm({ casterRole: role, targetRole: targetR, targetP, tidalDmg, floodedTiles });
      } else {
        AudioFX.playAbyssalWave();
        AudioFX.playAbyssalSplash();
        AudioFX.playBoom();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('🔱 ABYSSAL CATACLYSM!', targetP ? `KRAKEN TRENCH DRAGGED ${targetP.name} -4 TILES!` : 'TITANIC TIDAL SURGE AWAKENED!', 'cyan', 1800);
          if (targetR && targetP && MonoFX.tokens && MonoFX.tokens.teleport) MonoFX.tokens.teleport(targetR, targetP.pos);
          MonoFX.ring(c.x, c.y, 240, '#06b6d4', 850);
          MonoFX.ring(c.x, c.y, 340, '#0284c7', 1100);
          MonoFX.burst({ x: c.x, y: c.y, name: 'abyssal_tidal_crest', count: 18, spread: 240, up: 160, life: 1100 });
          MonoFX.burst({ x: c.x, y: c.y, name: 'water', count: 30, spread: 280, up: 200, gravity: 260, life: 1200, size: 24 });
          if (targetR) MonoFX.coins({ from: { role: targetR }, to: { role }, amount: tidalDmg });
        }
      }
      if (targetR && targetP) {
        floatText(targetP.pos, `🌊 -4 TILES & -${tidalDmg}🪙!`, 'neg fx-big');
        announce(`🔱🌊 <strong>MAELSTROM CATACLYSM & THE KRAKEN TRENCH!</strong> ${p.name} summoned the Abyssal Trident and a titanic whirlpool! Dragged ${targetP.name} 4 tiles backward into the trench (-${tidalDmg}🪙 oxygen tax), waterlogged their next roll, and permanently flooded 3 runway tiles into Coral Palaces (+30% Rent) and Sunken Ruins (0 Rent)!`);
      } else {
        floatText(p.pos, '🌊 ABYSSAL TIDAL CATACLYSM! 🔱', 'pos fx-big');
        announce(`🔱🌊 <strong>MAELSTROM CATACLYSM!</strong> A titanic ocean whirlpool crested over the runway, flooding properties!`);
      }
      break;
    }

    case 'naga_surge': {
      const myOwned = ownedTileIds(role);
      const { siphonedTotal = 0, nagaTiles = [] } = tacticalSummary;
      if (window.MonoFX && typeof MonoFX.emeraldNagaSurge === 'function') {
        MonoFX.emeraldNagaSurge({ role, amount: 500, ownedTiles: myOwned, siphonedTotal, nagaTiles });
      } else {
        AudioFX.playNagaSurge();
        if (AudioFX.playNagaGong) AudioFX.playNagaGong();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('🐉 THE SACRED MEKONG FLOOD!', '+500🪙 RIVER HOARD · WATERWAYS & SHIELDS!', 'green', 1800);
          MonoFX.ring(pCoord.x, pCoord.y, 180, '#10b981', 750);
          MonoFX.ring(pCoord.x, pCoord.y, 280, '#ffd700', 950);
          MonoFX.burst({ x: c.x, y: c.y, name: 'naga_emerald_urn', count: 18, spread: 200, up: 140, life: 1100 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'coin', count: 24, spread: 240, up: 180, gravity: 350, life: 1100, size: 22 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'water', count: 18, spread: 200, up: 130, life: 950 });
          MonoFX.coins({ from: { tileId: 0 }, to: { role }, amount: 500 });
        }
      }
      floatText(p.pos, `+${500 + siphonedTotal}🪙 NAGA TREASURE! 🐉`, 'pos fx-big');
      announce(`🐉🪷 <strong>THE SACRED MEKONG FLASH FLOOD!</strong> ${p.name} invoked the ancient emerald Naga! Flooded 3 properties into Sacred Waterways (+30% Rent, washes rivals 2 tiles downstream into kill-zones), blessed Bangkok with Lotus Shields, and collected <strong>+${500 + siphonedTotal}🪙</strong> in river hoard and flood tribute!`);
      break;
    }

    case 'inari_mirage': {
      const { targetR, targetP, toriiTile = 5, siphonedRent = 150 } = tacticalSummary;
      AudioFX.playInariFoxfire();
      if (window.MonoFX && typeof MonoFX.inariFoxfireMirage === 'function') {
        MonoFX.inariFoxfireMirage({ casterRole: role, targetRole: targetR, toriiTile, siphonedRent });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🦊 NINE-TAIL MIRAGE TRANSCENDENCE!', '9 SPIRIT TAILS · TORII GATE · POSITIONS SWAPPED!', 'pink', 1800);
        MonoFX.ring(pCoord.x, pCoord.y, 190, '#f97316', 750);
        MonoFX.ring(pCoord.x, pCoord.y, 280, '#ec4899', 950);
        MonoFX.burst({ x: c.x, y: c.y, name: 'inari_foxfire_sigil', count: 20, spread: 220, up: 140, life: 1000 });
        MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'fire', count: 18, spread: 200, up: 140, life: 950 });
      }
      floatText(p.pos, `🦊 +${siphonedRent}🪙 SWAPPED! 🌸`, 'pos fx-big');
      if (targetP) {
        floatText(targetP.pos, `🦊 POSSESSED (-${siphonedRent}🪙)!`, 'neg fx-big');
        announce(`🦊🌸 <strong>NINE-TAIL DOPPELGÄNGER & WEALTH MIRROR!</strong> ${p.name} sprouted 9 blazing Foxfire Tails and manifested the 3D Foxfire Torii Gate! Siphoned <strong>+${siphonedRent}🪙</strong> from ${targetP.name}, inverted their next roll direction, and swapped physical runway positions!`);
      } else {
        announce(`🦊🔥 <strong>NINE-TAIL FOXFIRE MIRAGE!</strong> ${p.name} restored all 3 Spirit Tails and laid the sacred Foxfire Torii Gate!`);
      }
      break;
    }

    case 'eclipse_convergence': {
      const { rivalTiles = [] } = tacticalSummary;
      AudioFX.playEclipseConvergence();
      if (window.MonoFX && typeof MonoFX.eclipseConvergence === 'function') {
        MonoFX.eclipseConvergence({ casterRole: role, rivalTiles });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🌓 TOTAL LUNAR BLACKOUT!', 'SOMNAMBULISM SLEEPWALK · 0 RIVAL RENT!', 'gold', 1800);
        MonoFX.ring(c.x, c.y, 220, '#ffd700', 800);
        MonoFX.ring(c.x, c.y, 320, '#6366f1', 1100);
        MonoFX.burst({ x: c.x, y: c.y, name: 'eclipse_yin_yang', count: 20, spread: 240, up: 150, life: 1100 });
        MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'sparkle', count: 24, spread: 220, up: 140, gravity: 0, life: 950, size: 20 });
      }
      floatText(p.pos, '🌓 TOTAL ECLIPSE & SOMNAMBULISM! 🌑', 'pos fx-big');
      announce(`🌓🌑 <strong>TOTAL LUNAR BLACKOUT & SOMNAMBULISM TRANCE!</strong> Sun and Moon merged into cosmic darkness! Rivals are trapped in Somnambulism Sleepwalk (pulled 3 tiles into Eclipse properties with 1.5× Nightmare Toll), and all rival rent collections are nullified (0 rent) for 1 round!`);
      break;
    }

    case 'djinn_wish': {
      const { upgradedTileId, transmutedTileId } = tacticalSummary;
      if (upgradedTileId != null && st.properties[upgradedTileId]) {
        floatText(upgradedTileId, `🪔 UPGRADED TO ${st.properties[upgradedTileId].level >= 3 ? 'HOTEL 🏨' : 'HOUSE 🏠🏠'}!`, 'pos fx-big');
      } else {
        floatText(p.pos, '🪔 +200🪙 & GOLDEN DICE! 🎲', 'pos fx-big');
      }
      if (transmutedTileId != null) {
        floatText(transmutedTileId, '🏆 TRANSMUTED TO SOLID GOLD (0 RENT)!', 'pos fx-big');
      }
      if (window.MonoFX && typeof MonoFX.cosmicGenieWish === 'function') {
        MonoFX.cosmicGenieWish({ role, upgradedTileId, amount: 350, transmutedTileId });
      } else {
        AudioFX.playDjinnWish();
        if (window.MonoFX) {
          if (MonoFX.banner) MonoFX.banner('🪔 COSMIC GENIE: THREE WISHES!', '+350🪙 · FREE HOTEL UPGRADE · MIDAS TOUCH!', 'purple', 1800);
          MonoFX.ring(pCoord.x, pCoord.y, 190, '#a855f7', 800);
          MonoFX.burst({ x: c.x, y: c.y, name: 'djinn_magic_lamp', count: 18, spread: 220, up: 150, life: 1000 });
          MonoFX.burst({ x: pCoord.x, y: pCoord.y, name: 'sparkle', count: 24, spread: 220, up: 150, gravity: -20, life: 950, size: 18 });
          MonoFX.coins({ from: { bank: true }, to: { role }, amount: 350 });
        }
      }
      announce(`🪔✨ <strong>COSMIC DJINN: REALITY OF THE THREE WISHES!</strong> ${p.name} unsealed the Golden Cosmic Lamp! Granted <strong>+350🪙</strong> wish gold, upgraded property to Hotel, and transmuted rival luxury hotel into solid gold for 2 rounds!`);
      break;
    }

    case 'phoenix_rebirth': {
      const { emberTiles = [], heatBurn = 0, targetR, targetP } = tacticalSummary;
      AudioFX.playPhoenixRebirth();
      AudioFX.playBoom();
      if (window.MonoFX && typeof MonoFX.phoenixRebirthFlame === 'function') {
        MonoFX.phoenixRebirthFlame({ casterRole: role, role, amount: 500, targetRole: targetR, heatBurn, emberTiles });
      } else if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('🔥 SUPERNOVA CREMATION & ASH ASCENSION!', 'SOAR TO START · +500🪙 REBIRTH SURGE!', 'red', 1800);
        if (MonoFX.tokens && MonoFX.tokens.teleport) MonoFX.tokens.teleport(role, 0);
        MonoFX.ring(c.x, c.y, 250, '#ef4444', 900);
        MonoFX.ring(c.x, c.y, 360, '#f97316', 1100);
        MonoFX.burst({ x: c.x, y: c.y, name: 'phoenix_pyre_crest', count: 26, spread: 280, up: 180, life: 1200 });
        MonoFX.burst({ x: c.x, y: c.y, name: 'fire', count: 22, spread: 240, up: 160, life: 1000 });
      }
      floatText(0, '🔥 PHOENIX REBIRTH (+500🪙)! 🪶', 'pos fx-big');
      if (targetP && heatBurn > 0) {
        floatText(targetP.pos, `🔥 -${heatBurn}🪙 HEAT BURN!`, 'neg fx-big');
      }
      announce(`🔥🪶 <strong>SUPERNOVA CREMATION & ASH ASCENSION!</strong> Sacred solar fire vaporized ALL rival shields across the board! ${p.name} rose from the ashes with <strong>+300🪙</strong> cash surge, carpeted 4 runway tiles in Sacred Golden Embers (+40🪙 heat damage), and teleports to START with a <strong>+200🪙 Lap Bonus (+500🪙 total)</strong>!`);
      break;
    }

    default: {
      AudioFX.playAfterburner();
      const { targetTileId } = tacticalSummary;
      if (window.MonoFX) {
        if (MonoFX.banner) MonoFX.banner('✈️ AFTERBURNER BOOST!', '+400🪙 AIRLINE SUBSIDY!', 'blue', 1500);
        if (targetTileId != null && MonoFX.tokens && MonoFX.tokens.teleport) MonoFX.tokens.teleport(role, targetTileId);
        MonoFX.ring(c.x, c.y, 200, '#3b82f6', 750);
        MonoFX.burst({ x: c.x, y: c.y, name: 'smoke', count: 16, spread: 180, up: 120, life: 900 });
        MonoFX.burst({ x: c.x, y: c.y, name: 'sparkle', count: 22, spread: 220, up: 140, life: 900 });
      }
      floatText(p.pos, targetTileId != null ? `✈️ AFTERBURNER: ${MONOPOLY_TILES[targetTileId].shortName}!` : '+400🪙 AIRLINE SUBSIDY!', 'pos fx-big');
      announce(`✈️🔥 <strong>AFTERBURNER JET BOOST!</strong> ${p.name} blasted supersonic with full afterburner speed!`);
      break;
    }
  }

  updateMonopolyHUD();
  renderMonopolyBoard();
  if (isInitiator) pushState();
}

// =========================================================
// 14. DICE ROLLING & AVATAR MOVEMENT
// =========================================================
let lastUserRollTapTime = 0;
function handleUserRollRequest(e) {
  if (isSpectatorMode) return;
  if (e && e.preventDefault && e.type === 'touchend') e.preventDefault();
  const now = Date.now();
  if (now - lastUserRollTapTime < 400) {
    if (e && e.preventDefault) e.preventDefault();
    return;
  }
  lastUserRollTapTime = now;

  if ((monopolyState.isRolling || isAnimating) && now - rollStartedAt > 4000) {
    console.warn('[Monopoly] Cleared stuck roll lock.');
    monopolyState.isRolling = false;
    isAnimating = false;
    releaseRoleLocks();
    flushQueuedMessages();
  }
  if (now - rollStartedAt < 800) return;
  AudioFX.init();
  window.isMonopolyPlayerAway = false;

  const currentRole = monopolyState.currentTurn || 'bkk';
  if (isRoleLocked(currentRole)) return;

  const s = rollButtonState();
  if (!s.enabled) {
    if (monopolyState.gameOver) {
      renderVictory();
      return;
    }
    if (isBlockingState() && !monopolyState.gameOver) setMonopolyTicker('⏳ Finish the current action first!');
    return;
  }
  startRoll(d6(), false);
}

function startRoll(rollVal, viaGolden) {
  const st = monopolyState;
  const me = getMonopolyMyRole();
  const playerKey = st.currentTurn;
  const pl = st.players[playerKey];
  if (!pl) return;
  if (typeof clearBotTimer === 'function') clearBotTimer();

  if (activeRollLocks[playerKey] || activeMoveLocks[playerKey] || st.isRolling || isAnimating) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 4000) {
      console.warn('[Monopoly] Blocked startRoll had expired lock (>4s). Clearing and proceeding for', playerKey);
      st.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
    } else {
      console.warn('[Monopoly] Blocked startRoll: roll or move already in progress for', playerKey);
      return;
    }
  }
  activeRollLocks[playerKey] = true;
  st.isRolling = true;
  isAnimating = true;

  if (pl && pl.loadedRoll) {
    rollVal = pl.loadedRoll;
    delete pl.loadedRoll;
  }
  if (pl && pl.goldenRollNext) {
    viaGolden = true;
    delete pl.goldenRollNext;
  }
  if (pl && pl.waterlogged) {
    if (rollVal > 3) rollVal = 3;
    delete pl.waterlogged;
    floatText(pl.pos != null ? pl.pos : 0, '🌊 WATERLOGGED: MAX 3! 🐌', 'neg');
  }

  // ❄️ S8 Cryo Stasis Stasis Lock / Subzero Dice Crippling
  if (pl && pl.cryoStasis) {
    delete pl.cryoStasis;
    if (rollVal > 3) rollVal = Math.min(3, rollVal);
    floatText(pl.pos != null ? pl.pos : 0, '❄️ SUBZERO CRIPPLE: MAX 3! 🧊', 'neg');
    announce(`❄️🧊 <strong>SUBZERO CRIPPLE!</strong> ${pl.name}'s frozen dice shattered under absolute zero blizzard! Roll capped at <strong>${rollVal}</strong>!`);
  }

  // 🎭 S10 Marionette Stasis (movement restricted to max 3)
  if (pl && pl.marionetteStasisRounds > 0) {
    pl.marionetteStasisRounds--;
    if (rollVal > 3) rollVal = 3;
    floatText(pl.pos != null ? pl.pos : 0, '🎭 MARIONETTE STASIS: MAX 3! 🥀', 'neg');
    announce(`🎭🥀 <strong>MARIONETTE STASIS!</strong> ${pl.name}'s strings are pulled by the Phantom Maestro! Roll capped at <strong>${rollVal}</strong>!`);
  }

  // ❄️ S8 Snowdrift Trap Speed Penalty
  if (pl && pl.frozenTurn) {
    delete pl.frozenTurn;
    rollVal = Math.max(1, rollVal - 1);
    floatText(pl.pos != null ? pl.pos : 0, '❄️ SNOWDRIFT: -1 ROLL! 🧊', 'neg');
  }

  let isVipCasino = false;
  if (!viaGolden && perkOf(playerKey).firstRollCasino && (!st.perkUsed || !st.perkUsed[playerKey] || !st.perkUsed[playerKey].firstRollCasino)) {
    if (pl && pl.pos === 0) {
      rollVal = 4; // lands straight on Tile 4: Sky Casino
      isVipCasino = true;
      st.perkUsed = st.perkUsed || {};
      st.perkUsed[playerKey] = Object.assign({}, st.perkUsed[playerKey], { firstRollCasino: true });
    }
  }

  st.turnResolver = me;
  rollStartedAt = Date.now();
  saveLocalMonopolyState();
  markActivity();
  if (st.mode !== 'bot' && typeof sendSignaling === 'function') {
    sendSignaling({ type: 'monopoly_action', action: 'roll', playerKey, rollVal, golden: !!viaGolden, vipCasino: isVipCasino, state: st });
  }
  executeRoll(playerKey, rollVal, viaGolden, isVipCasino);
}

function executeRoll(playerKey, rollVal, viaGolden = false, isVipCasino = false) {
  if (activeMoveLocks[playerKey]) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 7500) {
      console.warn('[Monopoly] Blocked executeRoll had expired activeMoveLock (>7.5s). Clearing for', playerKey);
      activeMoveLocks[playerKey] = false;
      activeRollLocks[playerKey] = false;
    } else {
      console.warn('[Monopoly] Blocked executeRoll: move already in progress for', playerKey);
      return;
    }
  }
  activeRollLocks[playerKey] = true;
  monopolyState.isRolling = true;
  isAnimating = true;

  const rollCycleWatchdog = setTimeout(() => {
    if (activeRollLocks[playerKey] || activeMoveLocks[playerKey] || monopolyState.isRolling || isAnimating) {
      console.warn(`[Monopoly] Roll cycle watchdog timeout for ${playerKey}. Force releasing locks.`);
      activeRollLocks[playerKey] = false;
      activeMoveLocks[playerKey] = false;
      monopolyState.isRolling = false;
      isAnimating = false;
      onTileLanded(playerKey);
      flushQueuedMessages();
    }
  }, 11000);

  AudioFX.init();
  chargeUlt(playerKey, viaGolden || rollVal >= 6 ? 25 : 10, 'Roll');
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }
  updateMonopolyHUD();

  const isMonaco = isMonacoHighRoller(playerKey);
  const isAbyss = isAbyssalDrifter(playerKey);
  const isAstral = isAstralSovereign(playerKey);
  const isNaga = isNagaWarden(playerKey);
  const isInari = isInariFoxfire(playerKey);
  const isEclipse = isCelestialEclipse(playerKey);
  const isDjinn = isDjinnMirage(playerKey);
  const isPhoenix = isPhoenixAscendant(playerKey);
  const isSundrop = isSundropTower(playerKey);
  const isClockwork = isClockworkSovereign(playerKey);
  const isBeast = isBeastAdam(playerKey);
  const isFrost = isFrostSovereign(playerKey);
  const isGilded = typeof isGildedSovereign === 'function' && isGildedSovereign(playerKey);
  const isSolar = typeof isSolarDivinity === 'function' && isSolarDivinity(playerKey);
  const isPhantom = typeof isPhantomRoyalty === 'function' && isPhantomRoyalty(playerKey);
  const isOlympus = typeof isOlympusDivinity === 'function' && isOlympusDivinity(playerKey);

  const diceBox = $m('monopolyDiceBox');
  const shockwave = $m('diceShockwave');
  const orbitEl = $m('monacoDiceOrbit');
  const astralOrbitEl = $m('astralDiceOrbit');
  const abyssOrbitEl = $m('abyssDiceOrbit');
  const nagaOrbitEl = $m('nagaDiceOrbit');
  const inariOrbitEl = $m('inariDiceOrbit');
  const eclipseOrbitEl = $m('eclipseDiceOrbit');
  const djinnOrbitEl = $m('djinnDiceOrbit');
  const phoenixOrbitEl = $m('phoenixDiceOrbit');
  const fairytaleOrbitEl = $m('fairytaleDiceOrbit');
  const beastOrbitEl = $m('beastDiceOrbit');
  const frostOrbitEl = $m('frostDiceOrbit');
  const phantomOrbitEl = $m('phantomDiceOrbit');
  const olympusOrbitEl = $m('olympusDiceOrbit');
  const centerHub = $m('monopolyCenterHub');
  const player = monopolyState.players[playerKey];

  if (isMonaco) {
    if (diceBox) diceBox.classList.add('monaco-rolling');
    if (centerHub) centerHub.classList.add('monaco-spotlight');
    if (orbitEl) {
      orbitEl.classList.remove('hidden');
      orbitEl.classList.add('active');
    }
    AudioFX.playCasinoChipRoll();
    setMonopolyTicker(isVipCasino
      ? `🎰 <strong>VIP High-Roller Express!</strong> ${player.name} launching straight to Sky Casino! 💎`
      : `🎰 <strong>Monte Carlo High-Roller!</strong> ${player.name} throwing luxury dice... 🎲✨`);
  } else if (isAbyss) {
    if (diceBox) diceBox.classList.add('abyss-rolling');
    if (centerHub) centerHub.classList.add('abyss-submersion');
    if (abyssOrbitEl) {
      abyssOrbitEl.classList.remove('hidden');
      abyssOrbitEl.classList.add('active');
    }
    AudioFX.playAbyssalWave();
    setMonopolyTicker(`🌊 <strong>Bioluminescent Drift!</strong> ${player.name} is summoning ocean currents... 🪼✨`);
  } else if (isAstral) {
    if (diceBox) diceBox.classList.add('astral-rolling');
    if (centerHub) centerHub.classList.add('astral-submersion');
    if (astralOrbitEl) {
      astralOrbitEl.classList.remove('hidden');
      astralOrbitEl.classList.add('active');
    }
    AudioFX.playAstralShimmer();
    setMonopolyTicker(`🌌 <strong>Astral Sovereign!</strong> ${player.name} weaving celestial gravity and starlight... 🪐✨`);
  } else if (isNaga) {
    if (diceBox) diceBox.classList.add('naga-rolling');
    if (centerHub) centerHub.classList.add('naga-submersion');
    if (nagaOrbitEl) {
      nagaOrbitEl.classList.remove('hidden');
      nagaOrbitEl.classList.add('active');
    }
    AudioFX.playNagaGong();
    setMonopolyTicker(`🌊 <strong>Mekong River Warden!</strong> ${player.name} summoning ancient emerald river tides... 🐉✨`);
  } else if (isInari) {
    if (diceBox) diceBox.classList.add('inari-rolling');
    if (centerHub) centerHub.classList.add('inari-submersion');
    if (inariOrbitEl) {
      inariOrbitEl.classList.remove('hidden');
      inariOrbitEl.classList.add('active');
    }
    AudioFX.playInariFoxfire();
    setMonopolyTicker(`🦊 <strong>Kitsune Spirit Fire!</strong> ${player.name} channels mystical foxfire... 🔥🌸`);
  } else if (isEclipse) {
    if (diceBox) diceBox.classList.add('eclipse-rolling');
    if (centerHub) centerHub.classList.add('eclipse-submersion');
    if (eclipseOrbitEl) {
      eclipseOrbitEl.classList.remove('hidden');
      eclipseOrbitEl.classList.add('active');
    }
    const isSun = (monopolyState.round || monopolyState.roundCount || 1) % 2 === 1;
    AudioFX.playEclipseStance(isSun);
    setMonopolyTicker(isSun
      ? `☀️ <strong>Solar Stance!</strong> ${player.name} channels radiant solar power (+20% Rent)! 👑`
      : `🌙 <strong>Lunar Stance!</strong> ${player.name} weaves nocturnal moon aegis (-25% Toll)! 🛡️`);
  } else if (isDjinn) {
    if (diceBox) diceBox.classList.add('djinn-rolling');
    if (centerHub) centerHub.classList.add('djinn-submersion');
    if (djinnOrbitEl) {
      djinnOrbitEl.classList.remove('hidden');
      djinnOrbitEl.classList.add('active');
    }
    AudioFX.playDjinnCarpet();
    setMonopolyTicker(`🧞 <strong>Starlight Djinn!</strong> ${player.name} rubs the Golden Magic Lamp... 🪔✨`);
  } else if (isPhoenix) {
    if (diceBox) diceBox.classList.add('phoenix-rolling');
    if (centerHub) centerHub.classList.add('phoenix-submersion');
    if (phoenixOrbitEl) {
      phoenixOrbitEl.classList.remove('hidden');
      phoenixOrbitEl.classList.add('active');
    }
    AudioFX.playPhoenixFlames();
    setMonopolyTicker(`🔥 <strong>Immortal Phoenix!</strong> ${player.name} stirs the sacred solar flame... 🪶☀️`);
  } else if (isSundrop) {
    if (diceBox) diceBox.classList.add('fairytale-rolling');
    if (centerHub) centerHub.classList.add('fairytale-submersion');
    if (fairytaleOrbitEl) {
      fairytaleOrbitEl.classList.remove('hidden');
      fairytaleOrbitEl.classList.add('active');
    }
    AudioFX.playFairytaleHarp();
    setMonopolyTicker(`🏮 <strong>Sundrop Maiden!</strong> ${player.name} floats glowing golden sky lanterns... ✨`);
  } else if (isClockwork) {
    if (diceBox) diceBox.classList.add('clockwork-rolling');
    if (centerHub) centerHub.classList.add('midnight-submersion');
    if (fairytaleOrbitEl) {
      fairytaleOrbitEl.classList.remove('hidden');
      fairytaleOrbitEl.classList.add('active');
    }
    AudioFX.playMidnightChimes();
    setMonopolyTicker(`⏳ <strong>Clockwork Sovereign!</strong> ${player.name} winds the midnight pendulum... 👠✨`);
  } else if (isBeast) {
    if (diceBox) diceBox.classList.add('enchanted-rolling');
    if (centerHub) centerHub.classList.add('enchanted-submersion');
    if (beastOrbitEl) {
      beastOrbitEl.classList.remove('hidden');
      beastOrbitEl.classList.add('active');
    }
    AudioFX.playEnchantedRoseWaltz();
    setMonopolyTicker(`🌹 <strong>Enchanted Ballroom!</strong> ${player.name} channels royal rose magic... 🦁✨`);
  } else if (isFrost) {
    if (diceBox) diceBox.classList.add('frost-rolling');
    if (centerHub) centerHub.classList.add('cryo-submersion');
    if (frostOrbitEl) {
      frostOrbitEl.classList.remove('hidden');
      frostOrbitEl.classList.add('active');
    }
    AudioFX.playFrostShimmer();
    setMonopolyTicker(`❄️ <strong>Glacial Royalty!</strong> ${player.name} summoning arctic frost and starlight... 👑🧊`);
  } else if (isGilded) {
    if (diceBox) diceBox.classList.add('solar-rolling');
    AudioFX.playSolarImpact();
    setMonopolyTicker(`🏺 <strong>Gilded Sovereign!</strong> ${player.name} channeling golden Nile wealth... 👑🏛️`);
  } else if (isSolar) {
    if (diceBox) diceBox.classList.add('solar-rolling');
    AudioFX.playSolarImpact();
    setMonopolyTicker(`☀️ <strong>Solar Divinity!</strong> ${player.name} invoking radiant sun rays... 🪶☀️`);
  } else if (isPhantom) {
    if (diceBox) diceBox.classList.add('phantom-rolling');
    if (centerHub) centerHub.classList.add('phantom-submersion');
    if (phantomOrbitEl) {
      phantomOrbitEl.classList.remove('hidden');
      phantomOrbitEl.classList.add('active');
    }
    if (AudioFX.playPhantomTick) AudioFX.playPhantomTick();
    setMonopolyTicker(`🎭 <strong>Phantom Royalty!</strong> ${player.name} weaving the Venetian masquerade waltz... 🥀✨`);
  } else if (isOlympus) {
    if (diceBox) diceBox.classList.add('olympus-rolling');
    if (centerHub) centerHub.classList.add('olympus-storm');
    if (olympusOrbitEl) {
      olympusOrbitEl.classList.remove('hidden');
      olympusOrbitEl.classList.add('active');
    }
    if (AudioFX.playOlympusTick) AudioFX.playOlympusTick();
    setMonopolyTicker(`⚡ <strong>Olympus Divinity!</strong> ${player.name} summoning crackling Zeus lightning... 🏛️⚡`);
  } else {
    if (diceBox) {
      diceBox.classList.add('rolling');
      if (viaGolden) diceBox.classList.add('is-golden-roll');
    }
    setMonopolyTicker(isVipCasino ? '🎰 VIP High-Roller Express straight to Sky Casino!' : viaGolden ? '🎲✨ Golden Dice!' : '🎲 Tumbling flight dice...');
  }

  let tickCount = 0;
  const rollInterval = setInterval(() => {
    tickCount++;
    renderDiceFace(Math.floor(Math.random() * 6) + 1);
    if (tickCount % 2 === 0) {
      if (isMonaco) AudioFX.playSlotTick();
      else if (isAbyss) AudioFX.playAbyssalBubble();
      else if (isAstral) AudioFX.playAstralTick();
      else if (isNaga) AudioFX.playNagaTick();
      else if (isInari) AudioFX.playInariTick();
      else if (isEclipse) AudioFX.playEclipseTick();
      else if (isDjinn) AudioFX.playDjinnTick();
      else if (isPhoenix) AudioFX.playPhoenixTick();
      else if (isSundrop || isClockwork || isBeast) AudioFX.playSlotTick();
      else if (isPhantom && AudioFX.playPhantomTick) AudioFX.playPhantomTick();
      else if (isOlympus && AudioFX.playOlympusTick) AudioFX.playOlympusTick();
      else AudioFX.playDiceTick();
    }
  }, 42);

  setTimeout(() => {
    clearInterval(rollInterval);
    if (diceBox) {
      diceBox.classList.remove('rolling', 'monaco-rolling', 'abyss-rolling', 'astral-rolling', 'naga-rolling', 'inari-rolling', 'eclipse-rolling', 'djinn-rolling', 'phoenix-rolling', 'fairytale-rolling', 'clockwork-rolling', 'enchanted-rolling', 'frost-rolling', 'solar-rolling', 'phantom-rolling', 'olympus-rolling');
      if (viaGolden) setTimeout(() => diceBox.classList.remove('is-golden-roll'), 1200);
    }
    if (centerHub) {
      centerHub.classList.remove('monaco-spotlight', 'abyss-submersion', 'astral-submersion', 'naga-submersion', 'inari-submersion', 'eclipse-submersion', 'djinn-submersion', 'phoenix-submersion', 'fairytale-submersion', 'midnight-submersion', 'enchanted-submersion', 'cryo-submersion', 'solar-submersion', 'phantom-submersion', 'olympus-submersion', 'olympus-storm');
    }
    [orbitEl, astralOrbitEl, abyssOrbitEl, nagaOrbitEl, inariOrbitEl, eclipseOrbitEl, djinnOrbitEl, phoenixOrbitEl, fairytaleOrbitEl, beastOrbitEl, frostOrbitEl, phantomOrbitEl, olympusOrbitEl].forEach((el) => {
      if (el) {
        el.classList.remove('active');
        el.classList.add('hidden');
      }
    });
    renderDiceFace(rollVal);

    const drift = Number(perkOf(playerKey).oceanDrift) || 0;

    if (isMonaco) {
      AudioFX.playCasinoSlam();
      shakeBoard();
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'monaco-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'monaco-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'monaco_highroller_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
      highlightRunwayTiles(player.pos, rollVal);
    } else if (isAbyss) {
      AudioFX.playAbyssalSplash();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'abyss-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'abyss-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'abyssal_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (isAstral) {
      AudioFX.playAstralImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'astral-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'astral-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'astral_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (isNaga) {
      AudioFX.playNagaImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'naga-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'naga-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'naga_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (isInari) {
      AudioFX.playInariImpact();
      shakeBoard('light');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'inari-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'inari-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'inari_foxfire_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
      if (rollVal === 6) {
        player.foxfireTails = Math.min(3, (player.foxfireTails == null ? 3 : player.foxfireTails) + 1);
        AudioFX.playInariFoxfire();
        emitFx({ kind: 'moment', id: 'inari_tail_recharge', role: playerKey, text: `${player.name} +1 Foxfire Tail!` });
        floatText(player.pos, `🦊 +1 TAIL (${player.foxfireTails}/3)`, 'pos');
        announce(`🦊✨ <strong>INARI SPIRIT RECHARGE!</strong> Rolling a 6 restored a Spirit Tail for ${player.name} (${player.foxfireTails}/3)! 🌸`);
      }
    } else if (isEclipse) {
      const isSun = (monopolyState.round || monopolyState.roundCount || 1) % 2 === 1;
      AudioFX.playEclipseImpact(isSun);
      shakeBoard('light');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'eclipse-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'eclipse-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'eclipse_stance_shift',
        role: playerKey,
        stance: isSun ? 'sun' : 'moon',
        rollVal,
        text: player.name
      });
    } else if (isDjinn) {
      AudioFX.playDjinnImpact();
      shakeBoard('light');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'djinn-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'djinn-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'djinn_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
      if (rollVal >= 5) {
        // Cosmic Djinn 3 Wishes on Roll 5–6 (Carpet Flight, Oasis Portal, or Midas Gold)
        const wishType = (player.pos % 3 === 0) ? 'carpet' : (player.pos % 3 === 1) ? 'oasis' : 'midas';
        if (wishType === 'carpet') {
          player.carpetCharges = Math.min(3, (player.carpetCharges || 0) + 1);
          player.carpetGlideActive = true;
          AudioFX.playDjinnCarpet();
          grantMiles(playerKey, 60);
          emitFx({ kind: 'moment', id: 'djinn_carpet_glide', role: playerKey, text: `${player.name} Carpet Flight!` });
          floatText(player.pos, '🧞 WISH 1: CARPET FLIGHT (+60🪙 🪔)', 'pos');
          announce(`🪔✨ <strong>GENIE'S WISH: MAGIC CARPET!</strong> ${player.name} soared on a Magic Carpet (0 rent on next landing + 60🪙)!`);
        } else if (wishType === 'oasis') {
          const oasisTile = (player.pos + 3) % MONOPOLY_TILES.length;
          monopolyState.djinnOasisTiles = monopolyState.djinnOasisTiles || {};
          monopolyState.djinnOasisTiles[oasisTile] = { creator: playerKey, bonusReward: 75, rounds: 3 };
          AudioFX.playDjinnWish();
          grantMiles(playerKey, 75);
          floatText(player.pos, '🪔 WISH 2: OASIS PORTAL (+75🪙)', 'pos');
          announce(`🪔✨ <strong>GENIE'S WISH: OASIS PORTAL!</strong> ${player.name} manifested a Mirage Oasis at ${MONOPOLY_TILES[oasisTile].name} and harvested +75🪙 celestial water!`);
        } else {
          const rivalProps = Object.keys(monopolyState.properties || {})
            .filter(tid => monopolyState.properties[tid]?.owner && monopolyState.properties[tid].owner !== playerKey);
          if (rivalProps.length > 0) {
            const transId = Number(rivalProps[0]);
            monopolyState.properties[transId].isTransmutedGold = true;
            monopolyState.properties[transId].transmutedRounds = 2;
            floatText(transId, '🏆 TRANSMUTED TO SOLID GOLD!', 'pos fx-big');
            announce(`🪔⚱️ <strong>GENIE'S WISH: MIDAS TOUCH!</strong> ${player.name} transmuted ${MONOPOLY_TILES[transId].name} into Solid Gold (0 Rent for 2 rounds)!`);
          } else {
            grantMiles(playerKey, 80);
            floatText(player.pos, '⚱️ MIDAS GOLD +80🪙', 'pos');
            announce(`🪔⚱️ <strong>GENIE'S WISH: MIDAS TREASURY!</strong> ${player.name} extracted +80🪙 pure gold from the Cosmic Lamp!`);
          }
        }
      }
    } else if (isPhoenix) {
      AudioFX.playPhoenixImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'phoenix-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'phoenix-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'phoenix_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (isSundrop || isClockwork || isBeast) {
      AudioFX.playBoom();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'fairytale-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'fairytale-shockwave'), 650);
      }
      emitFx({
        kind: 'moment',
        id: 'fairytale_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (isFrost) {
      AudioFX.playGlacialImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave', 'frost-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'frost-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'frost-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'glacial_royalty_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (typeof isGildedSovereign === 'function' && isGildedSovereign(playerKey)) {
      AudioFX.playSolarImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave', 'frost-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'solar-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'solar-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'gilded_sovereign_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (typeof isSolarDivinity === 'function' && isSolarDivinity(playerKey)) {
      AudioFX.playSolarImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave', 'frost-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'solar-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'solar-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'solar_divinity_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (typeof isPhantomRoyalty === 'function' && isPhantomRoyalty(playerKey)) {
      AudioFX.playPhantomImpact();
      shakeBoard('medium');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave', 'frost-shockwave', 'solar-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'phantom-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'phantom-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'phantom_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else if (typeof isOlympusDivinity === 'function' && isOlympusDivinity(playerKey)) {
      AudioFX.playZeusBolt();
      shakeBoard('heavy');
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave', 'fairytale-shockwave', 'frost-shockwave', 'solar-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active', 'olympus-shockwave');
        setTimeout(() => shockwave.classList.remove('active', 'olympus-shockwave'), 700);
      }
      emitFx({
        kind: 'moment',
        id: 'olympus_throw',
        role: playerKey,
        rollVal,
        text: player.name
      });
    } else {
      AudioFX.playDiceImpact();
      shakeBoard();
      if (window.SkyPixi && window.SkyPixi.isReady && typeof window.SkyPixi.spawnDiceImpact === 'function') {
        window.SkyPixi.spawnDiceImpact();
      }
      if (shockwave) {
        shockwave.classList.remove('active', 'monaco-shockwave', 'astral-shockwave', 'abyss-shockwave', 'naga-shockwave', 'inari-shockwave', 'eclipse-shockwave', 'djinn-shockwave', 'phoenix-shockwave');
        void shockwave.offsetWidth;
        shockwave.classList.add('active');
        setTimeout(() => shockwave.classList.remove('active'), 550);
      }
    }

    if (isVipCasino) {
      emitFx({ kind: 'moment', id: 'vip_casino', role: playerKey, text: `${player.name} High-Roller Express!` });
    }
    if (rollVal === 6 && perkOf(playerKey).supernova6 && !monopolyState.hadBonusRoll) {
      monopolyState.bonusRoll = playerKey;
      monopolyState.hadBonusRoll = playerKey;
      if (diceBox) {
        diceBox.classList.add('dice-supernova-flare');
        setTimeout(() => diceBox.classList.remove('dice-supernova-flare'), 1600);
      }
      emitFx({ kind: 'moment', id: 'supernova_leap', role: playerKey, text: `${player.name} Supernova Overdrive!` });
    }

    // ⚡ S11 Zeus Lightning Smite on Rolling 6:
    if (rollVal === 6 && (perkOf(playerKey).zeusSmite || isOlympusDivinity(playerKey))) {
      const rivalProps = Object.keys(monopolyState.properties || {}).filter(tid => {
        const pr = monopolyState.properties[tid];
        return pr && pr.owner && pr.owner !== playerKey && (pr.level || 1) >= 2;
      }).sort((a, b) => (monopolyState.properties[b].level || 1) - (monopolyState.properties[a].level || 1));

      if (rivalProps.length > 0) {
        const targetTileId = Number(rivalProps[0]);
        const targetProp = monopolyState.properties[targetTileId];
        targetProp.level = Math.max(1, (targetProp.level || 1) - 1);
        grantMiles(playerKey, 120);
        if (AudioFX.playZeusBolt) AudioFX.playZeusBolt();
        emitFx({ kind: 'moment', id: 'zeus_lightning_smite', role: playerKey, tileId: targetTileId, amount: 120 });
        floatText(targetTileId, '⚡ ZEUS SMITE! -1 LVL', 'neg fx-big');
        floatText(player.pos, '+120🪙 Rubble Cash ⚡', 'pos');
        announce(`⚡🏛️ <strong>ZEUS ORBITAL SMITE!</strong> Rolling a 6 summoned Zeus's lightning bolt! Demolished 1 level off ${monopolyState.players[targetProp.owner]?.name || 'rival'}'s hotel at <strong>${MONOPOLY_TILES[targetTileId]?.name}</strong> and scavenged <strong>+120🪙</strong> rubble cash!`);
      } else {
        // ⚡ Early-to-Mid Game Fallback: Siphon Storm Shock from leading rival!
        const rivals = Object.keys(monopolyState.players || {}).filter(r => r !== playerKey && !monopolyState.players[r]?.bankrupt);
        if (rivals.length > 0) {
          rivals.sort((a, b) => (monopolyState.players[b]?.miles || 0) - (monopolyState.players[a]?.miles || 0));
          const targetRole = rivals[0];
          const targetPlayer = monopolyState.players[targetRole];
          const shockDmg = Math.min(targetPlayer?.miles || 0, 80);
          if (targetPlayer && shockDmg > 0) {
            targetPlayer.miles = Math.max(0, targetPlayer.miles - shockDmg);
            grantMiles(playerKey, shockDmg);
            chargeUlt(playerKey, 10, 'Zeus Storm Shock');
            if (AudioFX.playZeusBolt) AudioFX.playZeusBolt();
            emitFx({ kind: 'moment', id: 'zeus_storm_shock', fromRole: playerKey, toRole: targetRole, amount: shockDmg });
            floatText(targetPlayer.pos != null ? targetPlayer.pos : 0, `⚡ -${shockDmg}🪙 SHOCK`, 'neg fx-big');
            floatText(player.pos, `+${shockDmg}🪙 +10% ULT ⚡`, 'pos');
            announce(`⚡🏛️ <strong>ZEUS STORM SHOCK!</strong> Rolling a 6 summoned a divine lightning bolt! Struck ${targetPlayer.name} for <strong>-${shockDmg}🪙</strong> electric shock (+${shockDmg}🪙 thunder bounty & +10% Ult energy)!`);
          } else {
            // Broke rival fallback: grant heavenly divine surge
            grantMiles(playerKey, 80);
            chargeUlt(playerKey, 15, 'Zeus Divine Surge');
            if (AudioFX.playZeusBolt) AudioFX.playZeusBolt();
            floatText(player.pos, '+80🪙 Divine Surge ⚡', 'pos');
            announce(`⚡🏛️ <strong>ZEUS DIVINE SURGE!</strong> Rolling a 6 summoned heavenly lightning: +80🪙 divine bounty & +15% Ult energy!`);
          }
        }
      }
    }

    // 🎭 S10 Phantom Masquerade: Opera Gala Tribute on Rolling 6
    if (rollVal === 6 && (perkOf(playerKey).reverseRentHex || isPhantomRoyalty(playerKey))) {
      const rivals = Object.keys(monopolyState.players || {}).filter(r => r !== playerKey && !monopolyState.players[r]?.bankrupt);
      if (rivals.length > 0) {
        rivals.sort((a, b) => (monopolyState.players[b]?.miles || 0) - (monopolyState.players[a]?.miles || 0));
        const targetRole = rivals[0];
        const targetPlayer = monopolyState.players[targetRole];
        const tributeDmg = Math.min(targetPlayer?.miles || 0, 60);
        if (targetPlayer && tributeDmg > 0) {
          targetPlayer.miles = Math.max(0, targetPlayer.miles - tributeDmg);
          grantMiles(playerKey, tributeDmg);
          chargeUlt(playerKey, 10, 'Phantom Gala Tribute');
          if (AudioFX.playPhantomImpact) AudioFX.playPhantomImpact();
          emitFx({ kind: 'moment', id: 'phantom_throw', role: playerKey, targetRole, amount: tributeDmg });
          floatText(targetPlayer.pos != null ? targetPlayer.pos : 0, `🎭 -${tributeDmg}🪙 GALA TRIBUTE`, 'neg fx-big');
          floatText(player.pos, `+${tributeDmg}🪙 +10% ULT 🎭`, 'pos');
          announce(`🎭🥀 <strong>WALTZ OF FATE: OPERA GALA!</strong> Rolling a 6 conducted the crescendo! Siphoned <strong>${tributeDmg}🪙</strong> gala tribute from ${targetPlayer.name} (+10% Ult energy)!`);
        } else {
          grantMiles(playerKey, 60);
          chargeUlt(playerKey, 15, 'Phantom Gala Applause');
          if (AudioFX.playPhantomImpact) AudioFX.playPhantomImpact();
          emitFx({ kind: 'moment', id: 'phantom_throw', role: playerKey });
          floatText(player.pos, '+60🪙 Gala Applause 🎭', 'pos');
          announce(`🎭🥀 <strong>WALTZ OF FATE!</strong> Rolling a 6 commanded the grand opera hall: +60🪙 gala applause & +15% Ult energy!`);
        }
      }
    }

    // 🦁 S7 Beast Unleashed: Beast Pounce on Rolling 6
    if (rollVal === 6 && (perkOf(playerKey).beastPounce || isBeastAdam(playerKey))) {
      const rivals = Object.keys(monopolyState.players || {}).filter(r => r !== playerKey && !monopolyState.players[r]?.bankrupt);
      if (rivals.length > 0) {
        rivals.sort((a, b) => (monopolyState.players[b]?.miles || 0) - (monopolyState.players[a]?.miles || 0));
        const targetRole = rivals[0];
        const targetPlayer = monopolyState.players[targetRole];
        const pounceDmg = Math.min(targetPlayer?.miles || 0, 70);
        if (targetPlayer && pounceDmg > 0) {
          targetPlayer.miles = Math.max(0, targetPlayer.miles - pounceDmg);
          grantMiles(playerKey, pounceDmg);
          chargeUlt(playerKey, 10, 'Beast Claw Strike');
          emitFx({ kind: 'moment', id: 'beast_pounce', role: playerKey, targetRole, amount: pounceDmg });
          floatText(targetPlayer.pos != null ? targetPlayer.pos : 0, `🦁 -${pounceDmg}🪙 BEAST CLAW`, 'neg fx-big');
          floatText(player.pos, `+${pounceDmg}🪙 +10% ULT 🦁`, 'pos');
          announce(`🦁🌹 <strong>BEAST UNLEASHED: CLAW POUNCE!</strong> Rolling a 6 unleashed raw beast fury! Pounced upon ${targetPlayer.name} for <strong>-${pounceDmg}🪙</strong> claw damage (+${pounceDmg}🪙 gold scavenged & +10% Ult energy)!`);
        } else {
          grantMiles(playerKey, 70);
          chargeUlt(playerKey, 15, 'Beast Roar');
          emitFx({ kind: 'moment', id: 'beast_pounce', role: playerKey, amount: 70 });
          floatText(player.pos, '+70🪙 Beast Roar 🦁', 'pos');
          announce(`🦁🌹 <strong>BEAST ROAR!</strong> Rolling a 6 echoed through the grand ballroom: +70🪙 sovereign bounty & +15% Ult energy!`);
        }
      }
    }

    // 🐉 S1 Naga Fireballs on Rolling 6:
    if (rollVal === 6 && (isNaga || (perkOf(playerKey) && perkOf(playerKey).nagaFireballs))) {
      monopolyState.sacredWaterways = monopolyState.sacredWaterways || {};
      const targetProps = Object.keys(monopolyState.properties || {})
        .filter(tid => monopolyState.properties[tid]?.owner)
        .sort((a, b) => (monopolyState.properties[b].level || 1) - (monopolyState.properties[a].level || 1))
        .slice(0, 3)
        .map(Number);
      const smiteList = targetProps.length >= 3 ? targetProps : [1, 2, 3];
      smiteList.forEach(tid => {
        monopolyState.sacredWaterways[tid] = { creator: playerKey, bonusRent: 0.30, rounds: 2 };
      });
      grantMiles(playerKey, 90);
      chargeUlt(playerKey, 15, 'Naga Fireballs');
      if (AudioFX.playNagaWave) AudioFX.playNagaWave();
      emitFx({ kind: 'moment', id: 'naga_river_surge', role: playerKey, tiles: smiteList });
      floatText(player.pos, '🐉 NAGA FIREBALLS SMITE! +90🪙', 'pos fx-big');
      announce(`🐉🌊 <strong>NAGA FIREBALLS SMITE!</strong> Rolling a 6 launched 3 sacred fireballs into the sky! Smote 3 luxury properties into <strong>Sacred Waterways (+30% Rent, Mekong Rapids downstream)</strong> and gathered <strong>+90🪙</strong> river treasure!`);
    }

    // 🦊 S2 Inari Torii Gate on Rolling 6:
    if (rollVal === 6 && (isInari || (perkOf(playerKey) && perkOf(playerKey).mirageTorii))) {
      monopolyState.inariToriiGates = monopolyState.inariToriiGates || {};
      monopolyState.inariToriiGates[player.pos] = { creator: playerKey, rounds: 3 };
      floatText(player.pos, '🦊 TORII GATE SET! 🌸', 'pos');
      announce(`🦊🌸 <strong>INARI ILLUSION GATE!</strong> Rolling a 6 planted a mystical Torii Gate at ${MONOPOLY_TILES[player.pos]?.name || 'tile'}! Next rival stepping through suffers Foxfire Confusion (Inverted Roll Direction)!`);
    }

    // 🌓 S2 Eclipse Alignment on Rolling 6:
    if (rollVal === 6 && (isEclipse || (perkOf(playerKey) && perkOf(playerKey).totalEclipseBlackout))) {
      chargeUlt(playerKey, 15, 'Eclipse Alignment');
      grantMiles(playerKey, 80);
      const rivals = Object.keys(monopolyState.players || {}).filter(r => r !== playerKey && !monopolyState.players[r]?.bankrupt);
      rivals.forEach(r => {
        if (monopolyState.players[r]) {
          monopolyState.players[r].somnambulismSteps = 3;
          floatText(monopolyState.players[r].pos != null ? monopolyState.players[r].pos : 0, '🌑 SOMNAMBULISM TRANCE! 😴', 'neg');
        }
      });
      if (rivals.length > 0) {
        announce(`🌓🌑 <strong>TOTAL LUNAR BLACKOUT & SOMNAMBULISM!</strong> Rolling a 6 channeled cosmic twilight: all rivals are hexed with <strong>Somnambulism Sleepwalk (pulled 3 tiles forward on next turn)</strong>!`);
      }
      floatText(player.pos, '🌓 ECLIPSE HARMONY +80🪙', 'pos');
    }

    // 🔥 S3 Phoenix Sunfire Flare on Rolling 6:
    if (rollVal === 6 && (isPhoenix || (perkOf(playerKey) && perkOf(playerKey).sunfireImmolation))) {
      grantMiles(playerKey, 90);
      chargeUlt(playerKey, 15, 'Solar Pyre Flare');
      monopolyState.phoenixEmbers = monopolyState.phoenixEmbers || {};
      monopolyState.phoenixEmbers[player.pos] = { creator: playerKey, damage: 40, rounds: 2 };
      floatText(player.pos, '🔥 SACRED EMBERS SET! +90🪙', 'pos');
      announce(`🔥☀️ <strong>PHOENIX SUNFIRE FLARE!</strong> Rolling a 6 erupted with sacred solar fire: carpeted ${MONOPOLY_TILES[player.pos]?.name || 'runway'} with <strong>Golden Embers (40🪙 heat damage)</strong> and earned +90🪙 catch-up energy!`);
    }

    // 🔱 S5 Atlantis Tidal Surge on Rolling 6:
    if (rollVal === 6 && (isAbyss || (perkOf(playerKey) && perkOf(playerKey).claimedTileFlooding))) {
      monopolyState.floodedTiles = monopolyState.floodedTiles || {};
      monopolyState.floodedTiles[player.pos] = { floodedBy: playerKey, rounds: 3 };
      grantMiles(playerKey, 80);
      chargeUlt(playerKey, 15, 'Tidal Surge');
      floatText(player.pos, '🔱 TILE FLOODED: OCEAN TRENCH! 🌊', 'pos');
      announce(`🔱🌊 <strong>BIOLUMINESCENT FLOOD SURGE!</strong> Rolling a 6 flooded ${MONOPOLY_TILES[player.pos]?.name || 'the tile'} into an <strong>Ocean Trench (Coral Palace / Sunken Ruin)</strong> with trench warp current!`);
    }

    // If sleepwalking in somnambulism trance, somnambulism overrides drift
    if (player.somnambulismSteps) {
      let totalSteps = player.somnambulismSteps;
      delete player.somnambulismSteps;
      announce(`🌓😴 <strong>SOMNAMBULISM SLEEPWALK!</strong> ${player.name} is sleepwalking in a cosmic trance! Pulled forward exactly <strong>${totalSteps} steps</strong>!`);
      floatText(player.pos, '🌑 SLEEPWALKING (3 STEPS) 😴', 'neg fx-big');
      setTimeout(() => {
        animateAvatarMove(playerKey, totalSteps, () => {
          clearTimeout(rollCycleWatchdog);
          activeMoveLocks[playerKey] = false;
          activeRollLocks[playerKey] = false;
          monopolyState.isRolling = false;
          isAnimating = false;
          onTileLanded(playerKey);
          flushQueuedMessages();
        });
      }, 160);
      return;
    }

    // --- BIOLUMINESCENT DRIFT TACTICAL DECISION ---
    if (drift > 0) {
      const targetA = (player.pos + rollVal) % MONOPOLY_TILES.length;
      const targetB = (player.pos + rollVal + 1) % MONOPOLY_TILES.length;

      const proceedMove = (choseDrift) => {
        const finalSteps = choseDrift ? rollVal + 1 : rollVal;
        const targetTile = MONOPOLY_TILES[choseDrift ? targetB : targetA];

        if (choseDrift) {
          AudioFX.playAbyssalWave();
          AudioFX.playAbyssalSplash();
          emitFx({ kind: 'moment', id: 'abyssal_wave_surge', role: playerKey, player: player.name });
          setMonopolyTicker(`🌊 <strong>Abyssal Tidal Drift!</strong> ${player.name} surged +1 extra tile to <strong>${targetTile ? targetTile.name : 'Destination'}</strong>! 🪼✨`);
        } else {
          setMonopolyTicker(`⚓ ${player.name} anchored at <strong>${targetTile ? targetTile.name : 'Destination'}</strong> (${rollVal} steps).`);
        }

        setTimeout(() => {
          animateAvatarMove(playerKey, finalSteps, () => {
            clearTimeout(rollCycleWatchdog);
            activeMoveLocks[playerKey] = false;
            activeRollLocks[playerKey] = false;
            monopolyState.isRolling = false;
            isAnimating = false;
            onTileLanded(playerKey);
            flushQueuedMessages();
          }, choseDrift);
        }, choseDrift ? 550 : 250);
      };

      if (remoteDriftPendingMessage && remoteDriftPendingMessage.playerKey === playerKey) {
        const msg = remoteDriftPendingMessage;
        remoteDriftPendingMessage = null;
        proceedMove(!!msg.choseDrift);
        return;
      }

      if (isTurnResolver()) {
        if (player.isBot) {
          setTimeout(() => {
            const choseDrift = botChooseDrift(playerKey, targetA, targetB);
            if (monopolyState.mode !== 'bot' && typeof sendSignaling === 'function') {
              sendSignaling({ type: 'monopoly_action', action: 'drift_choice', playerKey, choseDrift, rollVal, totalSteps: choseDrift ? rollVal + 1 : rollVal });
            }
            proceedMove(choseDrift);
          }, 450);
        } else {
          try {
            showAbyssalDriftNavigator(playerKey, rollVal, targetA, targetB, (choseDrift) => {
              if (monopolyState.mode !== 'bot' && typeof sendSignaling === 'function') {
                sendSignaling({ type: 'monopoly_action', action: 'drift_choice', playerKey, choseDrift, rollVal, totalSteps: choseDrift ? rollVal + 1 : rollVal });
              }
              proceedMove(choseDrift);
            });
          } catch (err) {
            console.error('[Monopoly] Abyssal drift launch error:', err);
            proceedMove(false);
          }
        }
      } else {
        setMonopolyTicker(`🌊 ${player.name} is steering the Abyssal Currents (+1 Drift)... 🪼`);
        pendingRemoteDriftResolver = proceedMove;
        setTimeout(() => {
          if (pendingRemoteDriftResolver === proceedMove) {
            console.warn('[Monopoly] Remote drift choice timeout fallback triggered.');
            pendingRemoteDriftResolver = null;
            const fallbackDrift = botChooseDrift(playerKey, targetA, targetB);
            proceedMove(fallbackDrift);
          }
        }, 9000);
      }
      return;
    }

    // Normal Non-Drift Move
    let totalSteps = rollVal;
    if (player.somnambulismSteps) {
      totalSteps = player.somnambulismSteps;
      delete player.somnambulismSteps;
      announce(`🌓😴 <strong>SOMNAMBULISM SLEEPWALK!</strong> ${player.name} is sleepwalking in a cosmic trance! Pulled forward exactly <strong>${totalSteps} steps</strong>!`);
      floatText(player.pos, '🌑 SLEEPWALKING (3 STEPS) 😴', 'neg fx-big');
    }
    setMonopolyTicker(isVipCasino
      ? `🎰 <strong>VIP High-Roller Express!</strong> ${player.name} rolled a <strong>4</strong> straight to Sky Casino! 💎`
      : isMonaco
      ? `🎰 <strong>Monte Carlo High-Roller!</strong> ${player.name} rolled a <strong>${rollVal}</strong>! 💎✈️`
      : `🎲 ${player.name} rolled a <strong>${rollVal}</strong>${viaGolden ? ' (Golden Dice ✨)' : ''}! ✈️`);

    const moveDelay = isMonaco ? 380 : 160;
    setTimeout(() => {
      animateAvatarMove(playerKey, totalSteps, () => {
        clearTimeout(rollCycleWatchdog);
        activeMoveLocks[playerKey] = false;
        activeRollLocks[playerKey] = false;
        monopolyState.isRolling = false;
        isAnimating = false;
        onTileLanded(playerKey);
        flushQueuedMessages();
      });
    }, moveDelay);
  }, 480);
}

function renderDiceFace(val) {
  const faceEl = $m('monopolyDiceFace');
  if (!faceEl) return;
  const pip = (c, r, red = false) => `<div style="grid-column: ${c}; grid-row: ${r};" class="dice-pip${red ? ' pip-center-red' : ''}"></div>`;
  const layouts = {
    1: [[2, 2, true]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2, true], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2, true], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
  };
  faceEl.innerHTML = (layouts[val] || layouts[1]).map(([c, r, red]) => pip(c, r, red)).join('');
}

async function animateAvatarMove(playerKey, steps, onComplete, wasDrifted = false) {
  if (activeMoveLocks[playerKey]) {
    console.warn('[Monopoly] Blocked animateAvatarMove: movement already running for', playerKey);
    if (onComplete) onComplete();
    return;
  }
  activeMoveLocks[playerKey] = true;
  const p = monopolyState.players[playerKey];
  if (!p) {
    activeMoveLocks[playerKey] = false;
    activeRollLocks[playerKey] = false;
    if (onComplete) onComplete();
    return;
  }
  const FX = window.MonoFX;
  if (FX && FX.tokens && typeof FX.tokens.lock === 'function') FX.tokens.lock(playerKey, true);
  const driftPerk = Number(perkOf(playerKey).oceanDrift) || 0;
  const isReverse = (monopolyState.midnightReverseRounds || 0) > 0 || !!p.invertDirectionNext;
  if (p.invertDirectionNext) {
    delete p.invertDirectionNext;
  }
  const isSupernova = (typeof isAstralSovereign === 'function' && isAstralSovereign(playerKey)) && ((p.ult || 0) >= 100 || !!p.goldenRollNext || steps >= 6);

  const startPos = Number(p.pos) || 0;
  const numTiles = MONOPOLY_TILES.length;
  const targetPos = isReverse
    ? ((startPos - steps) % numTiles + numTiles) % numTiles
    : (startPos + steps) % numTiles;

  try {
    for (let i = 0; i < steps; i++) {
      const from = isReverse
        ? ((startPos - i) % numTiles + numTiles) % numTiles
        : (startPos + i) % numTiles;
      const nextPos = isReverse
        ? ((startPos - (i + 1)) % numTiles + numTiles) % numTiles
        : (startPos + (i + 1)) % numTiles;
      p.pos = nextPos;

      // 🔥 S3 Phoenix Underdog Inferno Stance (leaves 1 scorched footprint per roll if behind on Net Worth, max 2 active trail embers):
      if (isPhoenixAscendant(playerKey) && i === 0) {
        const myNw = netWorth(playerKey);
        const rivals = Object.keys(monopolyState.players || {}).filter(r => r !== playerKey && !monopolyState.players[r]?.bankrupt);
        const maxRivalNw = rivals.length > 0 ? Math.max(...rivals.map(r => netWorth(r))) : 0;
        if (myNw < maxRivalNw) {
          monopolyState.phoenixEmbers = monopolyState.phoenixEmbers || {};
          const existingCreatorEmbers = Object.keys(monopolyState.phoenixEmbers).filter(
            tid => monopolyState.phoenixEmbers[tid] && monopolyState.phoenixEmbers[tid].creator === playerKey
          );
          while (existingCreatorEmbers.length >= 2) {
            delete monopolyState.phoenixEmbers[existingCreatorEmbers.shift()];
          }
          monopolyState.phoenixEmbers[from] = { creator: playerKey, damage: 40, rounds: 2 };
        }
      }

      const passedStart = isReverse ? (from === 0 || p.pos === 0) : (p.pos === 0);
      if (passedStart) {
        const got = grantMiles(playerKey, MONO_CFG.LAP_BONUS + (perkOf(playerKey).lapBonus || 0));
        chargeUlt(playerKey, 20, 'Lap Bonus');
        AudioFX.playPassStart();
        setMonopolyTicker(`🛫 ${p.name} passed START: <strong>+${fmt(got)} miles!</strong>`);
        floatText(0, `+${fmt(got)}`, 'pos');
        if (FX && typeof FX.coins === 'function') FX.coins({ from: { tileId: 0 }, to: { role: playerKey }, amount: got }); // local on both phones

        p.rechargedTokyoThisLap = false;

        // ❄️ S8 Glacial Empress / Blizzard Warden: Drop Snowdrift Traps
        if (perkOf(playerKey).snowdriftTraps) {
          monopolyState.snowdriftTraps = monopolyState.snowdriftTraps || {};
          const trapTile = (p.pos + 3 + Math.floor(Math.random() * 3)) % MONOPOLY_TILES.length;
          monopolyState.snowdriftTraps[trapTile] = (monopolyState.snowdriftTraps[trapTile] || 0) + 1;
          if (AudioFX.playFrostShield) AudioFX.playFrostShield();
          announce(`❄️🧊 <strong>ARCTIC SNOWDRIFT LAID!</strong> ${p.name} cast a subzero blizzard across the runway! Snowdrift trap set at <strong>${MONOPOLY_TILES[trapTile].name}</strong>!`);
          floatText(trapTile, '❄️ Snowdrift Trap 🧊', 'pos');
        }

        // 🏛️ S9 Great Golden Pyramid: Nile Inundation (+150🪙 passive treasury per owned pyramid)
        const ownedPyramids = ownedTileIds(playerKey).filter(tid => monopolyState.properties[tid]?.isGoldenPyramid);
        if (ownedPyramids.length > 0) {
          const goldBonus = 150 * ownedPyramids.length;
          grantMiles(playerKey, goldBonus);
          if (AudioFX.playSolarImpact) AudioFX.playSolarImpact();
          announce(`🏛️☀️ <strong>NILE INUNDATION!</strong> The Great Golden Pyramid flooded ${p.name}'s royal treasury with <strong>+${goldBonus}🪙</strong> gold tribute!`);
          floatText(0, `🏛️ +${goldBonus}🪙 NILE GOLD!`, 'pos');
          if (FX && typeof FX.coins === 'function') FX.coins({ from: { tileId: ownedPyramids[0] }, to: { role: playerKey }, amount: goldBonus });
        }

        // 🐉 S1 Naga King: Bangkok River Surge & Mekong River Hoard!
        if (isNagaWarden(playerKey)) {
          [1, 2, 3].forEach(tid => {
            if (monopolyState.properties[tid] && monopolyState.properties[tid].owner === playerKey) {
              monopolyState.properties[tid].waterShield = true;
            }
          });
          AudioFX.playNagaWave();
          emitFx({ kind: 'moment', id: 'naga_river_surge', role: playerKey, text: `${p.name} River Surge!` });
          announce(`🐉🌊 <strong>BANGKOK RIVER SURGE!</strong> Emerald tides swept Bangkok — ${p.name}'s properties received Water Shields! 🪷`);
          floatText(1, '🌊 Water Shield', 'pos');

          if ((monopolyState.mekongHoard || 0) > 0) {
            const hoardAmt = monopolyState.mekongHoard;
            monopolyState.mekongHoard = 0;
            grantMiles(playerKey, hoardAmt);
            AudioFX.playNagaHoardCollect();
            emitFx({ kind: 'moment', id: 'naga_hoard_claim', role: playerKey, amount: hoardAmt });
            announce(`🐉🌊 <strong>MEKONG RIVER HOARD HARVESTED!</strong> ${p.name} claimed the entire river pot: <strong>+${fmt(hoardAmt)} miles</strong>! 🪷`);
            floatText(0, `+${fmt(hoardAmt)} Mekong Hoard 🐉`, 'pos');
          }
        }

        // 🔥 S3-B Phoenix Ascendant: Ash Pot Rebound Refund!
        if (isPhoenixAscendant(playerKey) && (p.ashPot || 0) > 0) {
          const refund = p.ashPot;
          p.ashPot = 0;
          grantMiles(playerKey, refund);
          AudioFX.playPhoenixRebirth();
          emitFx({ kind: 'moment', id: 'phoenix_ash_refund', role: playerKey, amount: refund });
          announce(`🔥☀️ <strong>PHOENIX ASH REBOUND!</strong> Sacred flames ignited the Ash Pot and refunded <strong>+${fmt(refund)} miles</strong> to ${p.name}! 🪶`);
          floatText(0, `+${fmt(refund)} Ash Refund 🔥`, 'pos');
        }
      }

      // 🦊 S2 Inari Kitsune: Tokyo Shrine Tail Recharge
      if ([11, 12, 13].includes(p.pos) && isInariFoxfire(playerKey) && !p.rechargedTokyoThisLap) {
        if ((p.foxfireTails == null ? 3 : p.foxfireTails) < 3) {
          p.foxfireTails = Math.min(3, (p.foxfireTails || 0) + 1);
          p.rechargedTokyoThisLap = true;
          AudioFX.playInariFoxfire();
          emitFx({ kind: 'moment', id: 'inari_tail_recharge', role: playerKey, text: `${p.name} +1 Foxfire Tail!` });
          floatText(p.pos, `🦊 +1 TAIL (${p.foxfireTails}/3)`, 'pos');
          announce(`🦊✨ <strong>TOKYO SHRINE BLESSING:</strong> ${p.name} entered Tokyo and restored a Spirit Tail (${p.foxfireTails}/3)! 🌸`);
        }
      }

      // ⚡ S11 Mount Olympus Lightning Rod: Passing static arc
      if (monopolyState.olympusTempleTile != null && p.pos === monopolyState.olympusTempleTile && monopolyState.olympusTempleOwner && monopolyState.olympusTempleOwner !== playerKey && !p.bankrupt) {
        const ownerRole = monopolyState.olympusTempleOwner;
        const arcTax = Math.min(p.miles, 25);
        if (arcTax > 0) {
          p.miles -= arcTax;
          if (monopolyState.players[ownerRole]) monopolyState.players[ownerRole].miles += arcTax;
          if (AudioFX.playZeusBolt) AudioFX.playZeusBolt();
          emitFx({ kind: 'moment', id: 'lightning_rod_zap', fromTile: p.pos, toRole: playerKey, ownerRole, amount: arcTax });
          floatText(p.pos, `⚡ ARC STATIC! -${arcTax}🪙`, 'neg');
          announce(`⚡💨 <strong>LIGHTNING ROD STATIC!</strong> ${p.name} sped past Mount Olympus and was shocked by the spire for <strong>-${arcTax}🪙</strong> tribute to ${monopolyState.players[ownerRole]?.name || 'Zeus'}!`);
          updateMonopolyHUD();
        }
      } else if (passedStart) {
        updateMonopolyHUD();
      }
      const isDriftStep = wasDrifted && (driftPerk > 0) && (i === steps - 1);
      if (isDriftStep) {
        floatText(p.pos, '🌊 ABYSSAL DRIFT +1', 'pos');
      }
      const isFrost = typeof isFrostSovereign === 'function' ? isFrostSovereign(playerKey) : false;
      const hasFrostWake = isFrost && ((p.ult >= 100) || p.goldenRollNext || p.hasFrostDragonWings || p.zeroRentIceBridge || steps === 6);
      const isGilded = typeof isGildedSovereign === 'function' ? isGildedSovereign(playerKey) : false;
      const hasGildedWake = isGilded && ((p.ult >= 100) || p.goldenRollNext || p.hasGildedScarabWings || steps === 6);
      const isSolar = typeof isSolarDivinity === 'function' ? isSolarDivinity(playerKey) : false;
      const hasSolarWake = isSolar && ((p.ult >= 100) || p.goldenRollNext || p.hasSolarFalconWings || steps === 6);
      const isPhantom = typeof isPhantomRoyalty === 'function' ? isPhantomRoyalty(playerKey) : false;
      const hasPhantomWake = isPhantom && ((p.ult >= 100) || p.goldenRollNext || p.hasPhantomWaltzWings || steps === 6);
      const isOlympus = typeof isOlympusDivinity === 'function' ? isOlympusDivinity(playerKey) : false;
      const hasOlympusWake = isOlympus && ((p.ult >= 100) || p.goldenRollNext || p.hasOlympusPegasusWings || steps === 6);
      try {
        if (FX && FX.tokens && typeof FX.tokens.hop === 'function') {
          await Promise.race([
            FX.tokens.hop(playerKey, from, p.pos, {
              first: i === 0,
              final: i === steps - 1,
              drift: isDriftStep,
              supernova: isSupernova,
              frostWake: hasFrostWake,
              gildedWake: hasGildedWake,
              solarWake: hasSolarWake,
              phantomWake: hasPhantomWake,
              olympusWake: hasOlympusWake,
              stepIndex: i
            }),
            new Promise((r) => setTimeout(r, 650))
          ]);
        } else {
          await new Promise((r) => setTimeout(r, 260));
        }
      } catch (hopErr) {
        console.warn('[Monopoly] step hop fx error, fallback delay', hopErr);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } catch (e) {
    console.warn('[Monopoly] move anim', e);
  } finally {
    p.pos = targetPos;
    if (FX && FX.tokens && typeof FX.tokens.lock === 'function') FX.tokens.lock(playerKey, false);
    activeMoveLocks[playerKey] = false;
    activeRollLocks[playerKey] = false;
  }
  updateBoardTiles({ animate: false });
  if (FX && FX.tokens && typeof FX.tokens.sync === 'function') FX.tokens.sync(monopolyState, { animate: false });
  if (onComplete) onComplete();
}

function flushQueuedMessages() {
  if (queuedMessages.length === 0) return;
  const msgs = queuedMessages;
  queuedMessages = [];
  for (let i = 0; i < msgs.length; i++) {
    if (isAnimating) {
      queuedMessages.push(...msgs.slice(i));
      break;
    }
    handleMonopolyMessage(msgs[i]);
  }
}

// =========================================================
// 15. LANDING RESOLUTION (RESOLVER ONLY)
// =========================================================
function onTileLanded(playerKey) {
  try {
    const st = monopolyState;
    if (!st || !st.players) return;
    const player = st.players[playerKey];
    if (!player) { finishTurn(); return; }
    const tile = MONOPOLY_TILES[player.pos];
    renderMonopolyBoard();
    updateMonopolyHUD();
    if (!isResolver()) {
      if (tile) setMonopolyTicker(`📍 ${player.name} landed on <strong>${tile.icon} ${tile.name}</strong>…`);
      return;
    }
    if (!tile) { finishTurn(); return; }
    resolveLanding(playerKey, tile);
  } catch (err) {
    console.error('[Monopoly] Error in onTileLanded, falling back to finishTurn:', err);
    finishTurn();
  }
}

function setDecision(decision) {
  monopolyState.pendingDecision = decision;
  pushState();
  reconcileOverlays();
}

function resolveMythicElementalClash(playerKey, tile) {
  const st = monopolyState;
  if (!st || !tile || tile.id == null) return;
  const p = st.players && st.players[playerKey];
  if (!p || p.bankrupt) return;
  const prop = st.properties && st.properties[tile.id];

  const isFireSolar = isPhoenixAscendant(playerKey) || (typeof isSolarDivinity === 'function' && isSolarDivinity(playerKey));
  const isDesertSolar = isFireSolar || (typeof isGildedSovereign === 'function' && isGildedSovereign(playerKey)) || isDjinnMirage(playerKey);
  const isIce = typeof isFrostSovereign === 'function' && isFrostSovereign(playerKey);
  const isWater = isAbyssalDrifter(playerKey) || isNagaWarden(playerKey);
  const isThunderCosmic = (typeof isOlympusDivinity === 'function' && isOlympusDivinity(playerKey)) || isAstralSovereign(playerKey);

  // 1. 🔥 Fire / Solar melts ❄️ Snowdrift Traps & Frosted Landmarks
  const hasSnowdrift = !!(st.snowdriftTraps && st.snowdriftTraps[tile.id] > 0);
  const hasFrost = !!(prop && prop.frosted && prop.frosted > 0);
  if (isFireSolar && (hasSnowdrift || hasFrost)) {
    if (hasSnowdrift) delete st.snowdriftTraps[tile.id];
    if (hasFrost) delete prop.frosted;
    grantMiles(playerKey, 60);
    if (AudioFX.playPhoenixFlames) AudioFX.playPhoenixFlames();
    floatText(tile.id, '🔥❄️ STEAM MELT! +60🪙', 'pos fx-big');
    announce(`🔥❄️ <strong>ELEMENTAL CLASH — THERMAL STEAM MELT!</strong> ${p.name}'s blazing solar heat vaporized the Arctic ice at ${tile.name} and condensed <strong>+60🪙 Steam Surge</strong>!`);
    renderMonopolyBoard();
  }

  // 2. ❄️ Ice or 🌊 Water quenches 🔥 Phoenix Embers (0 burn damage taken + +50🪙)
  if ((isIce || isWater) && st.phoenixEmbers && st.phoenixEmbers[tile.id] && st.phoenixEmbers[tile.id].creator !== playerKey) {
    delete st.phoenixEmbers[tile.id];
    grantMiles(playerKey, 50);
    if (isIce && AudioFX.playCryoNova) AudioFX.playCryoNova();
    else if (AudioFX.playAbyssalSplash) AudioFX.playAbyssalSplash();
    floatText(tile.id, isIce ? '❄️🔥 CRYO QUENCH! +50🪙' : '🌊🔥 TIDAL DOUSE! +50🪙', 'pos fx-big');
    announce(isIce
      ? `❄️🔥 <strong>ELEMENTAL CLASH — CRYO EXTINGUISH!</strong> ${p.name}'s sub-zero aura froze the molten embers at ${tile.name} solid (0 damage taken) and forged <strong>+50🪙 Permafrost Gold</strong>!`
      : `🌊🔥 <strong>ELEMENTAL CLASH — TIDAL DOUSE!</strong> ${p.name}'s surging waters quenched the phoenix embers at ${tile.name} (0 damage taken) into <strong>+50🪙 Obsidian Pearl</strong>!`);
    renderMonopolyBoard();
  }

  // 3. ☀️ Desert / Solar / Fire evaporates S5 Sunken Ruins OR Owner pays 60🪙 Drainage
  if (st.floodedTiles && st.floodedTiles[tile.id] && prop && prop.owner && !isAbyssalDrifter(prop.owner)) {
    if (isDesertSolar) {
      delete st.floodedTiles[tile.id];
      delete p.waterlogged;
      grantMiles(playerKey, 80);
      if (AudioFX.playSolarImpact) AudioFX.playSolarImpact();
      floatText(tile.id, '☀️🌊 EVAPORATED! +80🪙', 'pos fx-big');
      announce(`☀️🌊 <strong>ELEMENTAL CLASH — SOLAR EVAPORATION!</strong> ${p.name}'s desert sun boiled away the floodwaters at ${tile.name}, restoring the landmark and crystallizing <strong>+80🪙 Brine Gold</strong>!`);
      renderMonopolyBoard();
    } else if (prop.owner === playerKey && p.miles >= 60) {
      p.miles -= 60;
      delete st.floodedTiles[tile.id];
      delete p.waterlogged;
      floatText(tile.id, '🛠️ FLOOD DRAINED (-60🪙)!', 'pos fx-big');
      announce(`🛠️🌊 <strong>SUNKEN RUIN DRAINED!</strong> ${p.name} paid <strong>60🪙</strong> emergency drainage to pump out the floodwaters and restore <strong>${tile.name}</strong> to full rent!`);
      renderMonopolyBoard();
    }
  }

  // 4. ⚡ Thunder / Cosmic shatters 🌑 Eclipse Shadows & 🦊 Foxfire Curses
  const hasShadow = !!(st.eclipseShadowTiles && st.eclipseShadowTiles[tile.id] && st.eclipseShadowTiles[tile.id].caster !== playerKey);
  const hasFoxCurse = !!(prop && prop.owner === playerKey && prop.foxfireCursedBy);
  if (isThunderCosmic && (hasShadow || hasFoxCurse)) {
    if (hasShadow) delete st.eclipseShadowTiles[tile.id];
    if (hasFoxCurse) delete prop.foxfireCursedBy;
    grantMiles(playerKey, 55);
    if (AudioFX.playOlympusThunder) AudioFX.playOlympusThunder();
    floatText(tile.id, '⚡🌑 CURSE SHATTERED! +55🪙', 'pos fx-big');
    announce(`⚡✨ <strong>ELEMENTAL CLASH — CELESTIAL PURGE!</strong> ${p.name}'s divine lightning shattered the shadow hex on ${tile.name} and harvested <strong>+55🪙 Astral Ether</strong>!`);
    renderMonopolyBoard();
  }
}

function resolveLanding(playerKey, tile, chainDepth = 0) {
  const st = monopolyState;
  const p = st.players[playerKey];
  const opp = otherRole(playerKey);
  const prop = (st && st.properties && tile && tile.id != null) ? st.properties[tile.id] : null;

  // ⚔️ Trigger Mythic Elemental Counter-Matrix on Landing
  resolveMythicElementalClash(playerKey, tile);

  // 🏮 S7 Mythic: Wish Upon a Lantern Festival Sanctuary trigger
  if (st.wishSanctuaries && st.wishSanctuaries[tile.id]) {
    const sanctuary = st.wishSanctuaries[tile.id];
    delete st.wishSanctuaries[tile.id];
    const reward = sanctuary.reward || 150;
    grantMiles(playerKey, reward);
    if (sanctuary.creator && sanctuary.creator !== playerKey && st.players[sanctuary.creator]) {
      const creatorShare = Math.round(reward * 0.5);
      grantMiles(sanctuary.creator, creatorShare);
      announce(`🏮✨ <strong>WISH SANCTUARY VISITED!</strong> ${p.name} made a wish and collected <strong>+${reward}🪙</strong>! Creator ${st.players[sanctuary.creator].name} earned <strong>+${creatorShare}🪙</strong>!`);
    } else {
      announce(`🏮✨ <strong>WISH SANCTUARY VISITED!</strong> ${p.name} made a royal wish and collected <strong>+${reward}🪙</strong>!`);
    }
    if (AudioFX.playFairytaleHarp) AudioFX.playFairytaleHarp();
    floatText(tile.id, `+${reward}🪙 Wish Sanctuary 🏮`, 'pos');
    renderMonopolyBoard();
  }

  // ❄️ S8 Snowdrift Trap trigger!
  if (st.snowdriftTraps && st.snowdriftTraps[tile.id] > 0) {
    if (p.hasOlympusPegasusWings) {
      floatText(tile.id, '🪽 PEGASUS SOAR! ❄️', 'pos');
      announce(`⚡🪽 <strong>PEGASUS DIVINE SOAR!</strong> ${p.name} flew high on celestial wings, soaring over the Arctic Snowdrift at ${tile.name}!`);
    } else if (!isFrostSovereign(playerKey)) {
      st.snowdriftTraps[tile.id] -= 1;
      if (st.snowdriftTraps[tile.id] <= 0) delete st.snowdriftTraps[tile.id];
      p.frozenTurn = true; // inflicts -1 speed on next roll and blocks property purchase this turn
      if (AudioFX.playCryoNova) AudioFX.playCryoNova();
      emitFx({ kind: 'moment', id: 'snowdrift_trap', role: playerKey, tileId: tile.id, text: 'Trapped in Arctic Snowdrift!' });
      floatText(tile.id, '❄️ SNOWDRIFT TRAP! 🧊', 'neg');
      announce(`❄️🧊 <strong>ARCTIC SNOWDRIFT TRAP!</strong> ${p.name} stumbled into a blinding blizzard snowdrift at ${tile.name}! Property transactions frozen!`);
      renderMonopolyBoard();
    }
  }

  // 🍌 Banana Peel Trap trigger!
  if (st.bananaTraps && st.bananaTraps[tile.id] > 0 && chainDepth < 2) {
    if (p.hasOlympusPegasusWings) {
      floatText(tile.id, '🪽 PEGASUS SOAR! 🍌', 'pos');
      announce(`⚡🪽 <strong>PEGASUS DIVINE SOAR!</strong> ${p.name} glided over the banana peel at ${tile.name} without slipping!`);
    } else {
      st.bananaTraps[tile.id] -= 1;
      if (st.bananaTraps[tile.id] <= 0) delete st.bananaTraps[tile.id];
      AudioFX.playBananaSlip();
      const slipSteps = 2;
      p.pos = (p.pos + slipSteps) % MONOPOLY_TILES.length;
      emitFx({ kind: 'moment', id: 'banana_slip', role: playerKey, tileId: tile.id, text: `Whoosh! Slipped +${slipSteps} tiles!` });
      floatText(tile.id, '🍌 WHOA! SLIPPED! 🍌', 'neg');
      announce(`🍌😵 <strong>WHOA! BANANA SLIP!</strong> ${p.name} slipped on a banana peel at ${tile.name} and slid forward to <strong>${MONOPOLY_TILES[p.pos].name}</strong>!`);
      renderMonopolyBoard();
      resolveLanding(playerKey, MONOPOLY_TILES[p.pos], chainDepth + 1);
      return;
    }
  }

  // 🐉 S1 Sacred Waterways & Mekong Rapids:
  if (st.sacredWaterways && st.sacredWaterways[tile.id] && !isNagaWarden(playerKey) && !p.bankrupt && !p._inWaterwayPush && chainDepth < 2) {
    p._inWaterwayPush = true;
    const nagaCreator = st.sacredWaterways[tile.id].creator;
    const waterwayRentBonus = 40;
    p.miles = Math.max(0, p.miles - waterwayRentBonus);
    if (st.players[nagaCreator]) st.players[nagaCreator].miles += waterwayRentBonus;
    if (AudioFX.playNagaWave) AudioFX.playNagaWave();
    floatText(tile.id, `🌊 MEKONG RAPIDS! -${waterwayRentBonus}🪙`, 'neg fx-big');
    const pushDownstream = 2;
    p.pos = (p.pos + pushDownstream) % MONOPOLY_TILES.length;
    announce(`🐉🌊 <strong>MEKONG RAPIDS PUSH!</strong> ${p.name} was caught in the roaring emerald currents of ${st.players[nagaCreator]?.name || 'Naga'}'s Sacred Waterway! Paid <strong>${waterwayRentBonus}🪙</strong> waterway toll and was washed <strong>+${pushDownstream} tiles downstream</strong> to ${MONOPOLY_TILES[p.pos].name}!`);
    renderMonopolyBoard();
    resolveLanding(playerKey, MONOPOLY_TILES[p.pos], chainDepth + 1);
    return;
  }

  // 🦊 S2 Inari Torii Gate: Foxfire Confusion & Direction Inversion:
  if (st.inariToriiGates && st.inariToriiGates[tile.id] && !isInariFoxfire(playerKey)) {
    const toriiCreator = st.inariToriiGates[tile.id].creator;
    delete st.inariToriiGates[tile.id];
    p.invertDirectionNext = true;
    if (AudioFX.playInariFoxfire) AudioFX.playInariFoxfire();
    floatText(tile.id, '🦊 TORII ILLUSION: NEXT ROLL REVERSED!', 'neg fx-big');
    announce(`🦊🌸 <strong>FOXFIRE ILLUSION GATE!</strong> ${p.name} stepped through the sacred Torii Gate of ${st.players[toriiCreator]?.name || 'Inari'}! Mesmerized by spirit flames: <strong>next roll direction is INVERTED (walks backwards)</strong>!`);
    renderMonopolyBoard();
  }

  // 🔥 S3 Phoenix Golden Embers: Heat Burn (consumes the ember on trigger)
  if (st.phoenixEmbers && st.phoenixEmbers[tile.id] && !isPhoenixAscendant(playerKey) && !p.bankrupt) {
    const emberCreator = st.phoenixEmbers[tile.id].creator;
    const emberDmg = Math.min(p.miles, st.phoenixEmbers[tile.id].damage || 40);
    delete st.phoenixEmbers[tile.id];
    if (emberDmg > 0) {
      p.miles -= emberDmg;
      if (st.players[emberCreator]) st.players[emberCreator].miles += emberDmg;
      if (AudioFX.playPhoenixFlames) AudioFX.playPhoenixFlames();
      floatText(tile.id, `🔥 -${emberDmg}🪙 HEAT BURN!`, 'neg fx-big');
      announce(`🔥☀️ <strong>SACRED GOLDEN EMBERS!</strong> ${p.name} stepped into scorching phoenix fire at ${tile.name}! Took <strong>-${emberDmg}🪙</strong> heat damage siphoned to ${st.players[emberCreator]?.name || 'Phoenix'}!`);
    }
    renderMonopolyBoard();
  }

  // 🪔 S3 Djinn Oasis Portal: Starlight Wish Gold
  if (st.djinnOasisTiles && st.djinnOasisTiles[tile.id]) {
    const oasis = st.djinnOasisTiles[tile.id];
    delete st.djinnOasisTiles[tile.id];
    const reward = oasis.bonusReward || 75;
    grantMiles(playerKey, reward);
    if (oasis.creator && oasis.creator !== playerKey && st.players[oasis.creator]) {
      grantMiles(oasis.creator, 50);
    }
    if (AudioFX.playDjinnWish) AudioFX.playDjinnWish();
    floatText(tile.id, `🪔 +${reward}🪙 MIRAGE OASIS!`, 'pos fx-big');
    announce(`🪔✨ <strong>MIRAGE OASIS PORTAL!</strong> ${p.name} drank from the celestial spring at ${tile.name} and collected <strong>+${reward}🪙</strong> starlight gold!`);
    renderMonopolyBoard();
  }

  // 🔱 S5 Atlantis Ocean Trench Surf / Nitrogen Decompression:
  if (st.floodedTiles && st.floodedTiles[tile.id]) {
    if (isAbyssalDrifter(playerKey)) {
      if (!p._inTrenchWarp && chainDepth < 2) {
        p._inTrenchWarp = true;
        const allFlooded = Object.keys(st.floodedTiles).map(Number).filter(tid => tid !== tile.id);
        if (allFlooded.length > 0) {
          const destTile = allFlooded[0];
          p.pos = destTile;
          if (AudioFX.playAbyssalSplash) AudioFX.playAbyssalSplash();
          floatText(tile.id, '🔱 OCEAN TRENCH WARP! 🌊', 'pos fx-big');
          announce(`🔱🌊 <strong>OCEAN TRENCH WARP!</strong> ${p.name} dove into the abyssal current and surfed through the trench to <strong>${MONOPOLY_TILES[destTile].name}</strong>!`);
          renderMonopolyBoard();
          resolveLanding(playerKey, MONOPOLY_TILES[p.pos], chainDepth + 1);
          return;
        }
      }
    } else {
      floatText(tile.id, '🌊 FLOODED TRENCH: WATERLOGGED!', 'neg');
      p.waterlogged = true;
    }
  }

  // ❄️ S8 Glacial Ice Citadel: ±1 Tile AoE Blizzard Tithe (3-tile wide aura, unless Monument Eclipsed)
  if (st.glacialCitadelTile != null && st.glacialCitadelOwner && st.glacialCitadelOwner !== playerKey && !p.bankrupt) {
    const isAdjacentToCitadel = tile.id === (st.glacialCitadelTile - 1 + 20) % 20 || tile.id === (st.glacialCitadelTile + 1) % 20;
    const citadelProp = st.properties[st.glacialCitadelTile];
    const isCitadelSuppressed = !!(citadelProp && citadelProp.monumentSuppressedRounds && citadelProp.monumentSuppressedRounds > 0);
    if (isAdjacentToCitadel && tile.id !== st.glacialCitadelTile && !isCitadelSuppressed) {
      const cOwner = st.glacialCitadelOwner;
      const baseCitRent = citadelProp ? getTileRent(st.glacialCitadelTile) : 120;
      const titheAmt = Math.min(p.miles, Math.max(40, Math.round(baseCitRent * 0.75)));
      if (titheAmt > 0) {
        p.miles -= titheAmt;
        st.players[cOwner].miles += titheAmt;
        if (AudioFX.playCryoNova) AudioFX.playCryoNova();
        emitFx({ kind: 'moment', id: 'citadel_tithe', payer: playerKey, owner: cOwner, amount: titheAmt, tileId: tile.id });
        floatText(tile.id, `❄️ -${titheAmt}🪙 BLIZZARD TITHE! 🏰`, 'neg fx-big');
        announce(`❄️🏰 <strong>BLIZZARD TITHE!</strong> ${p.name} wandered into the ±1 AoE frost aura of ${st.players[cOwner].name}'s Glacial Citadel! Paid <strong>${titheAmt}🪙 Blizzard Tithe (75%)</strong>! 🧊`);
      }
    }
  }

  // ☀️ S9 Desert Mirage (Perk of Ra / Sekhmet): deterministic 50% chance to incinerate an item
  if (prop && prop.owner && prop.owner !== playerKey && !p.bankrupt && typeof isSolarDivinity === 'function' && isSolarDivinity(prop.owner)) {
    if (p.inventory && p.inventory.length > 0 && (((st.round || 1) + tile.id + p.inventory.length) % 2 === 0)) {
      const burnedItem = p.inventory.pop();
      if (AudioFX.playSolarImpact) AudioFX.playSolarImpact();
      announce(`☀️🔥 <strong>DESERT MIRAGE HEATWAVE!</strong> The scorching heat of ${st.players[prop.owner].name}'s solar domain incinerated ${p.name}'s <strong>${burnedItem}</strong>!`);
      floatText(tile.id, `🔥 ITEM INCINERATED! ☀️`, 'neg fx-big');
    }
  }

  // 🏛️ S9 Great Golden Pyramid: Direct landing notice
  if (prop && prop.isGoldenPyramid && prop.owner !== playerKey && !p.bankrupt) {
    announce(`🏛️☀️ <strong>THE GREAT GOLDEN PYRAMID!</strong> ${p.name} entered the sacred golden grounds of ${st.players[prop.owner].name}'s Tier 4 Wonder (Double 2× Monumental Rent)!`);
  }

  // 🪔 S3-A Djinn Desert Mirage Tribute on special tiles:
  if (['casino', 'market', 'airdrop', 'bridge', 'arena'].includes(tile.type)) {
    const djinnRoles = Object.keys(st.players || {}).filter((r) => r !== playerKey && isDjinnMirage(r) && !st.players[r]?.bankrupt);
    if (djinnRoles.length > 0) {
      const djinnRole = djinnRoles[0];
      const tributeAmt = Math.min(35, p.miles);
      if (tributeAmt > 0) {
        p.miles -= tributeAmt;
        st.players[djinnRole].miles += tributeAmt;
        AudioFX.playMirageSiphon();
        emitFx({ kind: 'moment', id: 'djinn_mirage_tribute', fromRole: playerKey, toRole: djinnRole, amount: tributeAmt });
        announce(`🪔✨ <strong>DESERT MIRAGE TRIBUTE!</strong> ${p.name} paid <strong>+${tributeAmt}🪙</strong> tribute to ${st.players[djinnRole].name}!`);
      }
    }
  }

  switch (tile.type) {
    case 'start':
      if (isNagaWarden(playerKey)) {
        [1, 2, 3].forEach(tid => {
          if (st.properties[tid] && st.properties[tid].owner === playerKey) {
            st.properties[tid].waterShield = true;
          }
        });
        if ((st.mekongHoard || 0) > 0) {
          const hoardAmt = st.mekongHoard;
          st.mekongHoard = 0;
          grantMiles(playerKey, hoardAmt);
          AudioFX.playNagaHoardCollect();
          emitFx({ kind: 'moment', id: 'naga_hoard_claim', role: playerKey, amount: hoardAmt });
          announce(`🐉🌊 <strong>MEKONG RIVER HOARD HARVESTED!</strong> ${p.name} touched down at START and claimed <strong>+${fmt(hoardAmt)} miles</strong>! 🪷`);
          floatText(0, `+${fmt(hoardAmt)} Mekong Hoard 🐉`, 'pos');
        }
      } else if (!isNagaWarden(playerKey) && (st.mekongHoard || 0) >= 40) {
        const siphonAmt = Math.min(st.mekongHoard, Math.max(30, Math.round(st.mekongHoard * 0.25)));
        st.mekongHoard -= siphonAmt;
        grantMiles(playerKey, siphonAmt);
        AudioFX.playMirageSiphon();
        emitFx({ kind: 'moment', id: 'naga_hoard_siphon', role: playerKey, amount: siphonAmt });
        announce(`🏴‍☠️🌊 <strong>MEKONG HOARD RAIDED!</strong> ${p.name} ambushed the river stash at START and looted <strong>+${fmt(siphonAmt)} miles</strong>! 🐉⚔️`);
        floatText(0, `+${fmt(siphonAmt)} Hoard Raided! 🏴‍☠️`, 'pos');
      } else {
        announce(`🛫 ${p.name} touched down at the Departure Gate.`);
      }

      if (isPhoenixAscendant(playerKey) && (p.ashPot || 0) > 0) {
        const refund = p.ashPot;
        p.ashPot = 0;
        grantMiles(playerKey, refund);
        AudioFX.playPhoenixRebirth();
        emitFx({ kind: 'moment', id: 'phoenix_ash_refund', role: playerKey, amount: refund });
        announce(`🔥☀️ <strong>PHOENIX ASH REBOUND!</strong> Sacred flames ignited the Ash Pot and refunded <strong>+${fmt(refund)} miles</strong> to ${p.name}! 🪶`);
        floatText(0, `+${fmt(refund)} Ash Refund 🔥`, 'pos');
      }

      finishTurn();
      return;

    case 'bridge': {
      if (isNagaWarden(playerKey) && chainDepth < 2) {
        p.pos = 0;
        AudioFX.playNagaWave();
        emitFx({ kind: 'moment', id: 'naga_bridge_surf', role: playerKey, text: `${p.name} River Surf!` });
        announce(`🐉🌊 <strong>MEKONG RIVER SURF!</strong> ${p.name} rode the river current on the Sky Bridge directly to <strong>START (Departure Gate)</strong>! 🪷`);
        renderMonopolyBoard();
        resolveLanding(playerKey, MONOPOLY_TILES[0], chainDepth + 1);
        return;
      }
      const bridgeRivals = Object.keys(st.players || {}).filter((r) => r !== playerKey && !st.players[r]?.bankrupt);
      const targetRole = bridgeRivals.reduce((best, r) => (!best || netWorth(r) > netWorth(best)) ? r : best, bridgeRivals[0]) || opp;
      const targetPlayer = st.players[targetRole] || st.players[opp];
      p.pos = targetPlayer.pos;
      const bumpTiles = 2;
      targetPlayer.pos = (targetPlayer.pos + bumpTiles) % MONOPOLY_TILES.length;
      AudioFX.playBananaSlip();
      emitFx({ kind: 'sound', name: 'whoosh' });
      emitFx({ kind: 'moment', id: 'bridge_turbulence_bump', fromRole: playerKey, toRole: targetRole, text: `Turbulence Bump! +${bumpTiles} tiles` });
      floatText(targetPlayer.pos, `BUMPED +${bumpTiles} 💨`, 'neg');
      announce(`✈️💨 <strong>SKY BRIDGE TURBULENCE!</strong> ${p.name} teleported to ${targetPlayer.name} and bumped them forward <strong>+${bumpTiles} tiles</strong>!`);
      renderMonopolyBoard();
      finishTurn();
      return;
    }

    case 'airdrop': {
      const got = giveRandomItem(playerKey);
      const dropBonus = perkOf(playerKey).airdropBonus || 0;
      if (dropBonus) grantMiles(playerKey, dropBonus);
      const dropNote = dropBonus ? ` 💦 Splash Zone +${dropBonus}🪙` : '';
      if (isDjinnMirage(playerKey)) {
        p.carpetCharges = Math.min(3, (p.carpetCharges || 0) + 1);
        AudioFX.playDjinnCarpet();
        floatText(tile.id, `+1 Carpet Charge 🪔 (${p.carpetCharges}/3)`, 'pos');
        announce(`🪔✨ <strong>GENIE'S RECHARGE:</strong> ${p.name} refueled the Magic Carpet at the Airdrop (+1 Charge, ${p.carpetCharges}/3)!`);
      }
      emitFx({ kind: 'sound', name: 'item' });
      emitFx({ kind: 'moment', id: 'airdrop', tileId: tile.id, role: playerKey, icon: got ? ITEMS[got].icon : null });
      if (got) {
        announce(`🪂 <strong>Airdrop!</strong> ${p.name} caught a ${ITEMS[got].icon} <strong>${ITEMS[got].name}</strong>!${dropNote}`);
      } else {
        announce(`🪂 Airdrop! Bag is full, so ${p.name} sold the crate for +${MONO_CFG.AIRDROP_FULL_CASH}🪙.${dropNote}`);
      }
      finishTurn();
      return;
    }

    case 'casino': {
      const isMonaco = isMonacoHighRoller(playerKey);
      if (isMonaco) {
        AudioFX.playCasinoWelcome();
        const welcomeMiles = 50;
        grantMiles(playerKey, welcomeMiles);
        emitFx({ kind: 'moment', id: 'vip_casino_entrance', role: playerKey, text: `${p.name} VIP High-Roller Suite (+${welcomeMiles}🪙 Complimentary Drink)!` });
        announce(`🎰 <strong>VIP HIGH-ROLLER SUITE!</strong> ${p.name} entered Sky Casino and received a <strong>+${welcomeMiles}🪙</strong> VIP welcome bonus! 🍸✨`);
      } else {
        announce(`🎰 ${p.name} walked into the <strong>Sky Casino</strong>…`);
      }
      setDecision({ type: 'casino', tileId: tile.id, phase: 'offer' });
      return;
    }

    case 'market': {
      const cargoPool = ['banana', 'banana', 'magnet', 'swap', 'golden_dice', 'c4', 'cash'];
      const chosen = cargoPool[Math.floor(Math.random() * cargoPool.length)];
      AudioFX.playCocktailShaker();
      if (chosen === 'cash') {
        const cashAmt = 150;
        grantMiles(playerKey, cashAmt);
        emitFx({ kind: 'moment', id: 'mystery_cargo_cash', role: playerKey, text: `+${cashAmt}🪙 Mystery Drop!` });
        announce(`🎁💰 <strong>MYSTERY CARGO CRACKED!</strong> ${p.name} cracked open a luxury cargo crate and retrieved <strong>+${cashAmt}🪙</strong> in tax-free cash!`);
        floatText(tile.id, `+${cashAmt}🪙 Cargo 🎁`, 'pos');
      } else {
        const got = giveItemDirect(playerKey, chosen);
        if (got) {
          emitFx({ kind: 'moment', id: 'mystery_cargo_item', role: playerKey, text: `${ITEMS[chosen].icon} ${ITEMS[chosen].name}` });
          announce(`🎁✨ <strong>MYSTERY CARGO CRACKED!</strong> ${p.name} opened a supply drop and found a <strong>${ITEMS[chosen].icon} ${ITEMS[chosen].name}</strong>!`);
          floatText(tile.id, `${ITEMS[chosen].icon} ${ITEMS[chosen].name}`, 'pos');
        } else {
          const cashAmt = 150;
          grantMiles(playerKey, cashAmt);
          announce(`🎁🎒 <strong>MYSTERY CARGO!</strong> Bag full! ${p.name} liquidated the contraband for <strong>+${cashAmt}🪙</strong>!`);
          floatText(tile.id, `+${cashAmt}🪙 Liquidated`, 'pos');
        }
      }
      finishTurn();
      return;
    }

    case 'arena': {
      const targets = Object.keys(st.properties || {})
        .map(Number)
        .filter((id) => {
          const prop = st.properties[id];
          return prop && prop.owner !== playerKey && !st.players[prop.owner]?.bankrupt;
        });
      if (!targets.length) {
        announce(`⚔️ ${p.name} entered the Arena, but there's nothing to challenge.`);
        finishTurn();
        return;
      }
      announce(`⚔️ ${p.name} entered the <strong>Takeover Arena</strong>!`);
      setDecision({ type: 'arena', tileId: tile.id });
      return;
    }

    case 'property': {
      const prop = st.properties[tile.id];
      if (!prop) {
        announce(`🏰 ${p.name} is looking at <strong>${tile.name}</strong>…`);
        setDecision({ type: 'buy', tileId: tile.id });
      } else if (prop.owner === playerKey) {
        // 🦊 Foxfire Spirit Tribute: Owner landed on their own cursed property!
        if (prop.foxfireCursedBy && prop.foxfireCursedBy !== playerKey && st.players[prop.foxfireCursedBy] && !st.players[prop.foxfireCursedBy].bankrupt) {
          const curseTribute = Math.min(40, Math.max(0, p.miles));
          if (curseTribute > 0) {
            p.miles -= curseTribute;
            st.players[prop.foxfireCursedBy].miles += curseTribute;
            AudioFX.playInariFoxfire();
            emitFx({ kind: 'moment', id: 'inari_spirit_tribute', fromRole: playerKey, toRole: prop.foxfireCursedBy, amount: curseTribute, tileId: tile.id });
            announce(`🦊🔥 <strong>FOXFIRE SPIRIT TRIBUTE!</strong> ${p.name} paid <strong>${curseTribute}🪙</strong> tribute to ${st.players[prop.foxfireCursedBy].name} at the haunted ${tile.name}!`);
            floatText(tile.id, `-${curseTribute} Spirit Tribute 🦊`, 'neg');
          }
        }
        // 💎 Monaco VIP Dividend: High-roller relaxing at their own Grand Hotel!
        if (isMonacoHighRoller(playerKey) && (prop.level >= 3 || prop.hotel)) {
          const divAmt = 60;
          grantMiles(playerKey, divAmt);
          AudioFX.playCasinoWelcome();
          emitFx({ kind: 'moment', id: 'monaco_vip_dividend', role: playerKey, amount: divAmt, tileId: tile.id });
          announce(`🎰💎 <strong>MONACO VIP DIVIDEND!</strong> ${p.name} checked in at their luxury hotel and cashed in a <strong>+${divAmt}🪙</strong> VIP dividend!`);
          floatText(tile.id, `+${divAmt} VIP Dividend 💎`, 'pos');
        }

        if (prop.level < 3) {
          setDecision({ type: 'upgrade', tileId: tile.id });
        } else {
          announce(`🏨 ${p.name} is relaxing at their own Grand Hotel in ${tile.name}.`);
          finishTurn();
        }
      } else {
        const ownerRole = prop.owner;
        // ⚡ S11 Thunder Divinity / Pegasus Bypass:
        const hasPegasus = (perkOf(playerKey) && perkOf(playerKey).pegasusBypass) || isOlympusDivinity(playerKey);
        if (hasPegasus && (prop.level >= 3 || prop.hotel || prop.isGoldenPyramid || prop.isGlacialCitadel)) {
          if (!p.pegasusBypassesUsed || p.pegasusBypassesUsed < 1) {
            p.pegasusBypassesUsed = (p.pegasusBypassesUsed || 0) + 1;
            if (AudioFX.playOlympusThunder) AudioFX.playOlympusThunder();
            emitFx({ kind: 'moment', id: 'pegasus_bypass', role: playerKey, tileId: tile.id });
            announce(`⚡🪽 <strong>PEGASUS WING BYPASS!</strong> ${p.name} unfurled celestial divine wings, soaring directly over ${st.players[ownerRole].name}'s luxury estate at ${tile.name} without paying any rent!`);
            floatText(tile.id, '⚡🪽 PEGASUS BYPASS! 0🪙 RENT!', 'pos fx-big');
            finishTurn();
            return;
          }
        }

        // 🎭 S10 Phantom Masquerade: Auto Reverse Rent Hex if active
        if ((st.reverseRentHexTile === tile.id) || ((isPhantomRoyalty(playerKey) || (perkOf(playerKey) && perkOf(playerKey).reverseRentHex)) && p.phantomRentReversals > 0)) {
          actPayRent(tile.id);
          return;
        }

        // ❄️ S8 Empress Glacial Glide: Zero-Rent Ice Bridge
        if (p.zeroRentIceBridge && p.zeroRentIceBridge > 0) {
          actPayRent(tile.id);
          return;
        }

        // ❄️ Direct Landing on Glacial Ice Citadel Wonder
        if (prop.isGlacialCitadel || (st.glacialCitadelTile === tile.id)) {
          if (AudioFX.playCryoNova) AudioFX.playCryoNova();
          emitFx({ kind: 'moment', id: 'frost_shatter', role: playerKey, tileId: tile.id });
          announce(`❄️🏰 <strong>GLACIAL CITADEL FROSTBITE!</strong> ${p.name} stepped directly into ${st.players[ownerRole].name}'s <strong>Glacial Ice Citadel</strong>! 2× Double Frostbite Rent charged! 🧊`);
        }

        // ⚡ Direct Landing on Mount Olympus Temple & Lightning Rod:
        if ((prop.isOlympusTemple || (st.olympusTempleTile === tile.id)) && ownerRole !== playerKey && !p.bankrupt) {
          const thunderTax = Math.min(40, p.miles);
          if (thunderTax > 0) {
            p.miles -= thunderTax;
            if (st.players[ownerRole]) st.players[ownerRole].miles += thunderTax;
            if (AudioFX.playZeusBolt) AudioFX.playZeusBolt();
            emitFx({ kind: 'moment', id: 'lightning_rod_zap', fromTile: tile.id, toRole: playerKey, ownerRole, amount: thunderTax });
            floatText(tile.id, `⚡ -${thunderTax}🪙 THUNDER TAX!`, 'neg fx-big');
            announce(`⚡🏛️ <strong>MOUNT OLYMPUS LIGHTNING ROD!</strong> ${p.name} trespassed into the sanctuary of ${st.players[ownerRole]?.name || 'Zeus'}! Shocked by the lightning rod for <strong>-${thunderTax}🪙 Thunder Tax</strong> (+50% base rent applies)!`);
          }
        }

        if (perkOf(ownerRole).starTithe && !st.players[playerKey].bankrupt) {
          const is4P = st.mode === '4p' || Object.keys(st.players || {}).length > 2;
          const titheRate = (Number(perkOf(ownerRole).starTithe) || 0.15) * (is4P ? 0.7 : 1.0);
          const titheAmt = Math.min(75, Math.max(10, Math.floor(st.players[playerKey].miles * titheRate)));
          if (titheAmt > 0 && st.players[playerKey].miles >= titheAmt) {
            st.players[playerKey].miles -= titheAmt;
            st.players[ownerRole].miles += titheAmt;
            AudioFX.playAstralSiphon();
            emitFx({ kind: 'moment', id: 'star_tithe', fromRole: playerKey, toRole: ownerRole, amount: titheAmt, tileId: tile.id });
            announce(`🌌 <strong>ASTRAL TITHE!</strong> ${st.players[ownerRole].name}'s celestial domain siphoned <strong>${titheAmt}🪙</strong> from ${p.name}!`);
          }
        }
        if (perkOf(ownerRole).casinoRake && !st.players[playerKey].bankrupt) {
          const rakeRate = Number(perkOf(ownerRole).casinoRake) || 0.15;
          const baseRent = getTileRent(tile.id);
          const rakeAmt = Math.max(15, Math.round(baseRent * rakeRate));
          if (rakeAmt > 0 && st.players[playerKey].miles >= rakeAmt) {
            st.players[playerKey].miles -= rakeAmt;
            st.players[ownerRole].miles += rakeAmt;
            AudioFX.playCasinoRake();
            emitFx({ kind: 'moment', id: 'casino_rake', fromRole: playerKey, toRole: ownerRole, amount: rakeAmt, tileId: tile.id });
            announce(`🎰 <strong>HIGH-ROLLER HOUSE RAKE!</strong> ${st.players[ownerRole].name}'s Monte Carlo table collected <strong>+${rakeAmt}🪙</strong> luxury house rake from ${p.name}! 💎`);
          }
        }
        announce(`👀 ${p.name} landed on ${st.players[prop.owner].name}'s <strong>${tile.name}</strong>! Rent due: ${fmt(getTileRent(tile.id))}🪙`);
        emitFx({ kind: 'sound', name: 'alarm' });
        setDecision({ type: 'rent', tileId: tile.id });
      }
      return;
    }

    default:
      finishTurn();
  }
}

function finishTurn() {
  monopolyState.pendingDecision = null;
  monopolyState.isRolling = false;
  isAnimating = false;
  releaseRoleLocks();
  const curP = monopolyState.players && monopolyState.players[monopolyState.currentTurn];
  if (curP) {
    delete curP._inTrenchWarp;
    delete curP._inWaterwayPush;
  }
  hideModal('decision:');
  if (checkGameOver()) {
    pushState();
    renderAll();
    return;
  }
  if (monopolyState.bonusRoll) {
    const bonusPlayer = (typeof monopolyState.bonusRoll === 'string') ? monopolyState.bonusRoll : monopolyState.currentTurn;
    monopolyState.bonusRoll = null;
    if (monopolyState.players && monopolyState.players[bonusPlayer]) {
      setMonopolyTicker(`★ <strong>SUPERNOVA VELOCITY!</strong> ${monopolyState.players[bonusPlayer].name} takes a BONUS ROLL! ☄️★`);
      floatText(monopolyState.players[bonusPlayer].pos, '☄️ BONUS ROLL!', 'pos');
      emitFx({ kind: 'sound', name: 'fanfare' });
      pushState();
      renderAll();
      if (monopolyState.players[bonusPlayer]?.isBot || isLocalPlayerAutoPilot(bonusPlayer)) {
        checkBotTurn();
      }
      return;
    }
  }
  endTurn();
}

function endTurn() {
  const st = monopolyState;
  clearBotTimer();
  st.isRolling = false;
  isAnimating = false;
  releaseRoleLocks();
  st.hadBonusRoll = false;
  const prev = st.currentTurn;
  if (st.magnet && st.magnet.target === prev) st.magnet = null;
  // Expire 1-turn post-ultimate wing flight buffs at the end of the caster's turn
  const prevP = prev && st.players ? st.players[prev] : null;
  if (prevP) {
    delete prevP.hasFrostDragonWings;
    delete prevP.hasGildedScarabWings;
    delete prevP.hasSolarFalconWings;
    delete prevP.hasPhantomWaltzWings;
    delete prevP.hasOlympusPegasusWings;
  }
  st.pendingDecision = null;
  st.turnResolver = null;
  const order = getTurnOrder();
  const prevIdx = order.indexOf(prev);
  const nextRole = getNextTurn(prev);
  st.currentTurn = nextRole;
  const nextIdx = order.indexOf(nextRole);
  if (nextIdx <= prevIdx || nextIdx === 0) {
    st.round = (st.round || 1) + 1;
    if (st.eclipseInvertRounds > 0) {
      st.eclipseInvertRounds -= 1;
      if (st.eclipseInvertRounds <= 0) {
        announce(`☀️🌕 <strong>SOLAR ECLIPSE ENDED!</strong> Sunlight restored: standard property rents resume!`);
        st.eclipseCaster = null;
      }
    }
    if (st.midnightReverseRounds > 0) {
      st.midnightReverseRounds -= 1;
      if (st.midnightReverseRounds <= 0) {
        announce(`⏳🕛 <strong>MIDNIGHT PARADOX DISSOLVED!</strong> Time restores to normal clockwise flow.`);
        st.midnightCaster = null;
      }
    }
    // Decrement property permafrost, Midas transmutation, and Monument Eclipse debuffs
    Object.keys(st.properties).forEach(tid => {
      const pr = st.properties[tid];
      if (!pr) return;
      if (pr.frosted && pr.frosted > 0) {
        pr.frosted--;
        if (pr.frosted <= 0) delete pr.frosted;
      }
      if (pr.transmutedRounds && pr.transmutedRounds > 0) {
        pr.transmutedRounds--;
        if (pr.transmutedRounds <= 0) {
          delete pr.transmutedRounds;
          delete pr.isTransmutedGold;
        }
      }
      if (pr.monumentSuppressedRounds && pr.monumentSuppressedRounds > 0) {
        pr.monumentSuppressedRounds--;
        if (pr.monumentSuppressedRounds <= 0) delete pr.monumentSuppressedRounds;
      }
    });
    // Decrement player-scoped round buffs (Monaco Gold Rush, Lantern Bankruptcy Immunity)
    Object.keys(st.players || {}).forEach(r => {
      const pl = st.players[r];
      if (!pl) return;
      if (pl.monacoGoldRushRounds && pl.monacoGoldRushRounds > 0) {
        pl.monacoGoldRushRounds--;
        if (pl.monacoGoldRushRounds <= 0) delete pl.monacoGoldRushRounds;
      }
      if (pl.bankruptcyImmunity && pl.bankruptcyImmunity > 0) {
        pl.bankruptcyImmunity--;
        if (pl.bankruptcyImmunity <= 0) delete pl.bankruptcyImmunity;
      }
    });
    // Decrement round-limited board traps (Phoenix Embers, Sacred Waterways, Eclipse Shadow Tiles, Torii Gates, Djinn Oases, Wish Sanctuaries, Sunken Ruin Floods)
    if (st.phoenixEmbers) {
      Object.keys(st.phoenixEmbers).forEach(tid => {
        const em = st.phoenixEmbers[tid];
        if (!em) return;
        em.rounds = (em.rounds != null ? em.rounds : 2) - 1;
        if (em.rounds <= 0) delete st.phoenixEmbers[tid];
      });
    }
    if (st.sacredWaterways) {
      Object.keys(st.sacredWaterways).forEach(tid => {
        const ww = st.sacredWaterways[tid];
        if (!ww) return;
        ww.rounds = (ww.rounds != null ? ww.rounds : 2) - 1;
        if (ww.rounds <= 0) delete st.sacredWaterways[tid];
      });
    }
    if (st.eclipseShadowTiles) {
      Object.keys(st.eclipseShadowTiles).forEach(tid => {
        const es = st.eclipseShadowTiles[tid];
        if (!es) return;
        es.rounds = (es.rounds != null ? es.rounds : 1) - 1;
        if (es.rounds <= 0) delete st.eclipseShadowTiles[tid];
      });
    }
    if (st.inariToriiGates) {
      Object.keys(st.inariToriiGates).forEach(tid => {
        const tg = st.inariToriiGates[tid];
        if (!tg) return;
        tg.rounds = (tg.rounds != null ? tg.rounds : 3) - 1;
        if (tg.rounds <= 0) delete st.inariToriiGates[tid];
      });
    }
    if (st.djinnOasisTiles) {
      Object.keys(st.djinnOasisTiles).forEach(tid => {
        const oa = st.djinnOasisTiles[tid];
        if (!oa) return;
        oa.rounds = (oa.rounds != null ? oa.rounds : 3) - 1;
        if (oa.rounds <= 0) delete st.djinnOasisTiles[tid];
      });
    }
    if (st.wishSanctuaries) {
      Object.keys(st.wishSanctuaries).forEach(tid => {
        const ws = st.wishSanctuaries[tid];
        if (!ws) return;
        ws.rounds = (ws.rounds != null ? ws.rounds : 3) - 1;
        if (ws.rounds <= 0) delete st.wishSanctuaries[tid];
      });
    }
    if (st.floodedTiles) {
      Object.keys(st.floodedTiles).forEach(tid => {
        const fl = st.floodedTiles[tid];
        if (!fl) return;
        const pr = st.properties && st.properties[tid];
        const isPermanentCoral = !!(pr && pr.owner && isAbyssalDrifter(pr.owner));
        // Coral Palaces on Atlantis's own properties stay permanently; Sunken Ruins on rival/unowned tiles recede after 3 rounds
        if (!isPermanentCoral) {
          fl.rounds = (fl.rounds != null ? fl.rounds : 3) - 1;
          if (fl.rounds <= 0) delete st.floodedTiles[tid];
        }
      });
    }
    if (st.round > MONO_CFG.MAX_ROUNDS) {
      declareByNetWorth();
    } else {
      const stage = MONO_CFG.FINAL_BOARDING_STAGES.find((s) => s.round === st.round);
      if (stage) {
        const isLast = stage === MONO_CFG.FINAL_BOARDING_STAGES[MONO_CFG.FINAL_BOARDING_STAGES.length - 1];
        emitFx({ kind: 'finalBoarding', mult: stage.mult });
        announce(isLast
          ? `🔥 <strong>LAST CALL!</strong> All rent is now ${multLabel(stage.mult)} until the end of the game.`
          : `🔥 <strong>FINAL BOARDING!</strong> All rent is now ${multLabel(stage.mult)}. It rises to ${multLabel(MONO_CFG.FINAL_BOARDING_STAGES[MONO_CFG.FINAL_BOARDING_STAGES.indexOf(stage) + 1].mult)} in round ${MONO_CFG.FINAL_BOARDING_STAGES[MONO_CFG.FINAL_BOARDING_STAGES.indexOf(stage) + 1].round}.`);
      }
    }
  }
  pushState();
  renderAll();
  flushQueuedMessages();
  if (!st.gameOver && (st.players[st.currentTurn]?.isBot || isLocalPlayerAutoPilot(st.currentTurn))) {
    checkBotTurn();
  }
}

// =========================================================
// 16. MODAL PLUMBING
// =========================================================
let currentModalKey = null;

function showModal(key, html, bind) {
  const ov = $m('propertyModalOverlay');
  if (!ov) return;
  currentModalKey = key;
  ov.innerHTML = html;
  ov.classList.add('active');
  if (bind) bind(ov);
}

function hideModal(prefix) {
  if (prefix && (!currentModalKey || !currentModalKey.startsWith(prefix))) return;
  const ov = $m('propertyModalOverlay');
  if (ov) {
    ov.classList.remove('active');
    ov.innerHTML = '';
  }
  currentModalKey = null;
}

/** Binds a button; the first tap disables every button in the overlay (no double actions). */
function onTap(root, selector, fn) {
  root.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (btn.disabled) return;
      root.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      AudioFX.init();
      fn(btn, e);
    });
  });
}

function reconcileOverlays() {
  if (currentModalKey === 'local:mode-picker') return;
  const lobbyScreen = $m('monopolyLobbyScreen');
  if (lobbyScreen && !lobbyScreen.classList.contains('hidden')) {
    hideVictory();
    return;
  }
  const st = monopolyState;
  if (st.gameOver) {
    hideModal('decision:');
    hideCardOverlay();
    renderVictory();
    return;
  }
  hideVictory();

  if (st.activeDuel) {
    renderDuelOverlay();
    if (!st.activeDuel.settled) {
      const activeBotRole = [st.activeDuel.attacker, st.activeDuel.defender].find((r) => st.players[r]?.isBot && st.activeDuel.rolls[r] == null);
      if (activeBotRole && isResolver()) {
        scheduleBotDuelRoll();
      }
    }
  } else if (st.activeChallenge) {
    renderChallengeOverlay();
  } else {
    hideCardOverlay();
  }

  const d = st.pendingDecision;
  if (d && isResolver()) {
    if (st.players[st.currentTurn]?.isBot) {
      hideModal();
      scheduleBotDecision(d);
    } else {
      openDecisionModal(d);
    }
  } else if (currentModalKey && currentModalKey.startsWith('decision:')) {
    hideModal();
  }
}

function openDecisionModal(d) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players && st.players[pk];
  if (p && p.isBot) {
    hideModal();
    scheduleBotDecision(d);
    return;
  }
  const key = `decision:${d.type}:${d.tileId}:${d.phase || ''}`;
  if (currentModalKey === key) return;
  switch (d.type) {
    case 'buy': renderBuyModal(d, key); break;
    case 'upgrade': renderUpgradeModal(d, key); break;
    case 'rent': renderRentModal(d, key); break;
    case 'casino': renderCasinoModal(d, key); break;
    case 'market': renderMarketModal(d, key); break;
    case 'arena': renderArenaModal(d, key); break;
    default: break;
  }
}

// =========================================================
// 16b. SHARED ACTION HANDLERS (Used by both UI and Bot)
// =========================================================
function getEffectiveTilePrice(tile, pk) {
  if (!tile) return 0;
  let effectivePrice = tile.price;
  const p = monopolyState.players && monopolyState.players[pk];
  if (!p) return effectivePrice;
  if (perkOf(pk).pumpkinWarp) effectivePrice = Math.round(effectivePrice * 0.7); // 30% Pumpkin discount!
  if (isBeastAdam(pk) || perkOf(pk).formShiftStance || perkOf(pk).castleDiscount) effectivePrice = Math.round(effectivePrice * 0.7); // 30% Castle Architecture discount!
  if (isOlympusDivinity(pk) && (p.hasOlympusPegasusWings || p.goldenRollNext)) {
    effectivePrice = Math.round(effectivePrice * 0.75); // 25% Olympus Divine Tithe discount during Pegasus Flight!
  }
  // 🔥 S3 Dune Phoenix: 50% Underdog discount when trailing in 3rd or 4th place
  if (isPhoenixAscendant(pk)) {
    const allRoles = Object.keys(monopolyState.players || {}).filter(r => !monopolyState.players[r]?.bankrupt);
    const rankedByNw = [...allRoles].sort((a, b) => netWorth(b) - netWorth(a));
    const myRank = rankedByNw.indexOf(pk);
    if (myRank >= 2 || (allRoles.length === 2 && myRank === 1)) {
      effectivePrice = Math.round(effectivePrice * 0.5); // 50% Underdog discount!
    }
  }
  return effectivePrice;
}

function actBuy(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const pk = st.currentTurn;
  const p = st.players[pk];
  if (!tile) { finishTurn(); return; }
  const effectivePrice = getEffectiveTilePrice(tile, pk);
  if (p.miles < effectivePrice) { finishTurn(); return; }
  p.miles -= effectivePrice;
  st.properties[tile.id] = { owner: pk, level: 1 };
  if (isBeastAdam(pk) || perkOf(pk).livingStaffShield) {
    st.properties[tile.id].torchShield = true;
  }
  emitFx({ kind: 'coins', from: { role: pk }, to: { tileId: tile.id }, amount: effectivePrice });
  emitFx({ kind: 'sound', name: 'buildHouse' });
  emitFx({ kind: 'float', tileId: tile.id, text: `-${fmt(effectivePrice)}`, cls: 'neg' });
  let msg = `🎉 ${p.name} bought <strong>${tile.name}</strong>!`;
  if (ownsZone(pk, tile.zone)) {
    msg += ` 👑 <strong>ZONE MONOPOLY</strong> — ${ZONES[tile.zone].label} rent ×2!`;
    emitFx({ kind: 'moment', id: 'zone', tiles: zoneTiles(tile.zone).map((t) => t.id), text: ZONES[tile.zone].label });
  }
  announce(msg);
  renderMonopolyBoard();
  finishTurn();
}

function actPassBuy(tileId) {
  const tile = MONOPOLY_TILES[tileId];
  const p = monopolyState.players[monopolyState.currentTurn];
  announce(`➡️ ${p.name} passed on ${tile ? tile.name : 'property'}.`);
  finishTurn();
}

function actUpgrade(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const prop = st.properties[tileId];
  if (!prop) { finishTurn(); return; }
  const pk = st.currentTurn;
  const p = st.players[pk];
  let cost = upgradeCost(tile);
  if (isBeastAdam(pk) || perkOf(pk).formShiftStance || perkOf(pk).castleDiscount) cost = Math.round(cost * 0.7); // 30% Castle Architecture discount!
  if (isOlympusDivinity(pk) && (p.hasOlympusPegasusWings || p.goldenRollNext)) {
    cost = Math.round(cost * 0.75); // 25% Olympus Divine Architecture upgrade discount during Pegasus Flight!
  }
  if (p.miles < cost) { finishTurn(); return; }
  const next = prop.level + 1;
  const isHotel = next === 3;
  p.miles -= cost;
  prop.level = next;
  if (isBeastAdam(pk) || perkOf(pk).livingStaffShield) {
    prop.torchShield = true;
  }
  emitFx({ kind: 'coins', from: { role: pk }, to: { tileId: tile.id }, amount: cost });
  emitFx({ kind: 'sound', name: isHotel ? 'buildHotel' : 'buildHouse' });
  emitFx({ kind: 'moment', id: isHotel ? 'hotel' : 'house', tileId: tile.id, text: `rent ${fmt(getTileRent(tile.id))}🪙` });
  announce(isHotel
    ? `🏨 ${p.name} built a <strong>Grand Hotel</strong> at ${tile.name}! Rent: ${fmt(getTileRent(tile.id))}🪙`
    : `✨ ${p.name} upgraded <strong>${tile.name}</strong> to 2 houses!`);
  renderMonopolyBoard();
  finishTurn();
}

function actSkipUpgrade(tileId) {
  finishTurn();
}

function actPayRent(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const prop = st.properties[tileId];
  if (!prop) { finishTurn(); return; }
  const pk = st.currentTurn;
  const p = st.players[pk];
  const ownerKey = prop.owner;
  const o = st.players[ownerKey];
  let rent = getTileRent(tile.id);

  // 🎭 S10 Phantom Masquerade: Reverse Rent Hex
  const hasReverseHex = (st.reverseRentHexTile === tileId) ||
                        ((isPhantomRoyalty(pk) || (perkOf(pk) && perkOf(pk).reverseRentHex)) && (p.phantomRentReversals > 0));
  if (hasReverseHex && ownerKey !== pk) {
    if (p.phantomRentReversals > 0) {
      p.phantomRentReversals -= 1;
    }
    if (st.reverseRentHexTile === tileId) {
      st.reverseRentHexTile = null;
      st.reverseRentHexOwner = null;
    }
    if (AudioFX.playPhantomImpact) AudioFX.playPhantomImpact();
    else if (AudioFX.playPhantomOrgan) AudioFX.playPhantomOrgan();

    const r = chargePlayer(ownerKey, rent, pk);
    st.stats.rentPaid[ownerKey] = (st.stats.rentPaid[ownerKey] || 0) + r.paid;
    emitFx({ kind: 'moment', id: 'phantom_reverse_hex', role: pk, owner: ownerKey, amount: r.paid, tileId: tile.id });
    if (r.paid > 0) {
      emitFx({ kind: 'coins', from: { role: ownerKey }, to: { role: pk }, amount: r.paid });
      emitFx({ kind: 'sound', name: 'coin' });
      emitFx({ kind: 'float', tileId: tile.id, text: `🎭 REVERSED +${fmt(r.paid)}!`, cls: 'pos fx-big' });
    }
    announce(r.bankrupt
      ? `🎭🪞 <strong>REVERSE RENT HEX DISASTER!</strong> ${o.name} was forced to pay <strong>${fmt(rent)}🪙</strong> to ${p.name} and went <strong>BANKRUPT</strong>!`
      : `🎭🪞 <strong>REVERSE RENT HEX!</strong> The Phantom's mirror illusion inverted the deed! ${o.name} was forced to pay <strong>+${fmt(r.paid)}🪙</strong> rent to ${p.name}!`);
    renderMonopolyBoard();
    finishTurn();
    return;
  }

  // ❄️ S8 Empress Glacial Glide: Zero-Rent Ice Bridge
  if (p.zeroRentIceBridge && p.zeroRentIceBridge > 0) {
    p.zeroRentIceBridge -= 1;
    if (AudioFX.playCryoNova) AudioFX.playCryoNova();
    emitFx({ kind: 'moment', id: 'frost_shield', role: pk, text: 'Glacial Ice Bridge: 0🪙 Rent!' });
    announce(`❄️👑 <strong>EMPRESS GLACIAL GLIDE!</strong> ${p.name} skated effortlessly across ${o.name}'s ${tile.name} on a crystalline ice bridge paying <strong>0 rent</strong>! ⛸️🧊`);
    floatText(tile.id, '❄️ ICE BRIDGE: 0🪙 RENT! ⛸️', 'pos fx-big');
    finishTurn();
    return;
  }

  // 🔥 S3-B Phoenix Grace Shield:
  if (p.phoenixGraceActive) {
    p.phoenixGraceActive = false;
    AudioFX.playPhoenixFlames();
    emitFx({ kind: 'moment', id: 'shield', role: pk, text: 'Phoenix Grace' });
    announce(`🔥🛡️ <strong>PHOENIX GRACE WARD!</strong> Sacred residual flames incinerated ${o.name}'s rent entirely! (0 miles paid)`);
    finishTurn();
    return;
  }

  // 🧞 S3-A Magic Carpet Glide check:
  if (p.carpetGlideActive) {
    p.carpetGlideActive = false;
    emitFx({ kind: 'moment', id: 'djinn_carpet_glide', role: pk, text: `${p.name} Magic Carpet Flight!` });
    announce(`🧞✨ <strong>MAGIC CARPET FLIGHT!</strong> ${p.name} hovered completely over ${o.name}'s ${tile.name} without paying any rent! 🪔`);
    finishTurn();
    return;
  }

  // 🦊 S2-A Kitsune Foxfire Ward (3 Tails consume on developed/built properties):
  const isBuiltProperty = !!(prop && (prop.level >= 1 || prop.hotel || getTileRent(tile.id) >= 60));
  if (isInariFoxfire(pk) && isBuiltProperty) {
    if (p.foxfireTails == null) p.foxfireTails = 3;
    if (p.foxfireTails > 0) {
      p.foxfireTails -= 1;
      prop.foxfireCursedBy = pk;
      emitFx({ kind: 'moment', id: 'inari_foxfire_curse', role: pk, text: `${p.name} Foxfire Curse!` });
      AudioFX.playInariImpact();
      announce(`🦊🔥 <strong>KITSUNE FOXFIRE WARD!</strong> ${p.name} invoked a Spirit Tail (${p.foxfireTails}/3 left), paid <strong>0 rent</strong>, and cursed ${tile.name} with sacred Foxfire! 🌸`);
      floatText(tile.id, '🦊 Foxfire Cursed!', 'pos');
      renderMonopolyBoard();
      updateMonopolyHUD();
      finishTurn();
      return;
    }
  }

  // 🌓 S2-B Eclipse Balance:
  // Sun Stance (Odd round): +20% rent collected by owner
  const curRound = st.round || st.roundCount || 1;
  if (isCelestialEclipse(ownerKey) && (curRound % 2 === 1)) {
    rent = Math.round(rent * 1.2);
  }
  // Moon Stance (Even round): -25% rent paid by tenant
  if (isCelestialEclipse(pk) && (curRound % 2 === 0)) {
    rent = Math.round(rent * 0.75);
  }

  const r = chargePlayer(pk, rent, ownerKey);
  st.stats.rentPaid[pk] = (st.stats.rentPaid[pk] || 0) + r.paid;

  // 🔥 S3-B Phoenix Ascendant: Collect 40% of rent paid into Ash Pot!
  if (isPhoenixAscendant(pk) && r.paid > 0) {
    const ashGathered = Math.round(r.paid * 0.4);
    p.ashPot = (p.ashPot || 0) + ashGathered;
    emitFx({ kind: 'moment', id: 'phoenix_ash_pot', role: pk, text: `+${ashGathered} Ash Pot` });
    floatText(p.pos, `+${ashGathered} Ash Pot 🔥`, 'pos');
    announce(`🔥 <strong>PHOENIX ASH GATHERED:</strong> ${p.name} stored <strong>+${ashGathered}🪙</strong> in the Ash Pot (Total: ${p.ashPot}🪙)!`);
  }

  // 🐉 S1 Mekong Hoard: 15% of all rent paid is diverted to the Mekong Hoard pool!
  const hoardCut = Math.round(r.paid * 0.15);
  if (hoardCut > 0) {
    st.mekongHoard = (st.mekongHoard || 0) + hoardCut;
  }

  if (r.paid > 0) {
    emitFx({ kind: 'coins', from: { role: pk }, to: { role: ownerKey }, amount: r.paid });
    emitFx({ kind: 'sound', name: 'coin' });
    emitFx({ kind: 'float', tileId: tile.id, text: `-${fmt(r.paid)}`, cls: 'neg' });
  }
  if (r.bankrupt) {
    announce(`💀 ${p.name} couldn't cover ${fmt(rent)}🪙 and went <strong>BANKRUPT</strong>!`);
  } else if (r.paid > 0) {
    announce(`💸 ${p.name} paid <strong>${fmt(r.paid)}🪙</strong> rent to ${o.name}.${soldNote(r.sold)}`);
  }
  renderMonopolyBoard();
  finishTurn();
}

function actUseShield(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const prop = st.properties[tileId];
  const pk = st.currentTurn;
  const p = st.players[pk];
  const ownerKey = prop ? prop.owner : otherRole(pk);
  consumeItem(pk, 'shield');
  emitFx({ kind: 'sound', name: 'item' });
  emitFx({ kind: 'moment', id: 'shield', role: pk, owner: ownerKey, text: tile ? tile.name : 'Shield' });
  announce(`🛡️ ${p.name} used a <strong>Rent Shield</strong> — paid nothing at ${tile ? tile.name : 'property'}!`);
  finishTurn();
}

function actTakeover(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const prop = st.properties[tileId];
  if (!prop) { finishTurn(); return; }
  const pk = st.currentTurn;
  const p = st.players[pk];
  const ownerKey = prop.owner;
  const rent = getTileRent(tile.id);
  const value = propValue(tile.id);
  st.pendingDecision = null;
  st.activeDuel = {
    id: Date.now(), kind: 'takeover', tileId: tile.id, attacker: pk, defender: ownerKey,
    rolls: { [pk]: null, [ownerKey]: null }, price: value, rent, settled: false, result: null, paid: 0
  };
  hideModal();
  emitFx({ kind: 'sound', name: 'alarm' });
  announce(`⚔️ ${p.name} declared a <strong>HOSTILE TAKEOVER</strong> on ${tile.name}!`);
  pushState();
  reconcileOverlays();
}

function actCocktailClash(tileId) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[tileId];
  const prop = st.properties[tileId];
  if (!prop) { finishTurn(); return; }
  const pk = st.currentTurn;
  const p = st.players[pk];
  const ownerKey = prop.owner;
  const rent = getTileRent(tile.id);
  const tokens = p.clashTokens != null ? p.clashTokens : (p.vibePasses || 0);
  if (tokens <= 0) { finishTurn(); return; }
  if (p.clashTokens != null) p.clashTokens -= 1;
  else p.vibePasses -= 1;
  st.pendingDecision = null;
  st.activeDuel = {
    id: Date.now(),
    kind: 'cocktail',
    tileId: tile.id,
    attacker: pk,
    defender: ownerKey,
    rolls: { [pk]: null, [ownerKey]: null },
    price: 0,
    rent,
    settled: false,
    result: null,
    paid: 0
  };
  hideModal();
  AudioFX.playCocktailShaker();
  announce(`🍸 <strong>COCKTAIL CLASH!</strong> ${p.name} challenges ${st.players[ownerKey].name} to Double-or-Nothing on ${fmt(rent)}🪙 rent!`);
  pushState();
  reconcileOverlays();
}

function actSpinCasino(tileId) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const bet = MONO_CFG.CASINO_BET;
  if (p.miles < bet) { finishTurn(); return; }
  const out = rollCasinoOutcome();
  p.miles -= bet;
  emitFx({ kind: 'coins', from: { role: pk }, to: { bank: true }, amount: bet });
  let label = out.label;
  if (out.item) {
    const got = giveRandomItem(pk);
    label = got ? `Free item: ${ITEMS[got].icon} ${ITEMS[got].name}!` : `Bag full — +${MONO_CFG.AIRDROP_FULL_CASH}🪙 instead`;
  } else if (out.miles > 0) {
    grantMiles(pk, out.miles);
  } else if (out.miles < 0) {
    if (out.id === 'skull' && isPhoenixAscendant(pk)) {
      label = '🔥 Sacred Phoenix Flame incinerated the curse! +100🪙 instead';
      grantMiles(pk, 100);
      AudioFX.playPhoenixRebirth();
      emitFx({ kind: 'moment', id: 'phoenix_casino_cleanse', role: pk, text: `${p.name} Flame Cleanse!` });
      announce(`🔥☀️ <strong>PHOENIX FLAME CLEANSE!</strong> Sacred flames incinerated the Sky Casino skull curse, granting <strong>+100🪙</strong> instead! 🪶`);
    } else {
      const shield = out.id === 'skull' ? (perkOf(pk).skullShield || 0) : 0;
      const loss = Math.max(0, -out.miles - shield);
      if (shield >= 200) label += ' — 🎰 VIP Sovereign neutralized the curse!';
      else if (shield) label += ` — 🛺 Pit Crew saved ${shield}`;
      const r = loss > 0 ? chargePlayer(pk, loss, null) : { sold: [] };
      if (r.sold.length) label += ` (sold ${r.sold.join(', ')})`;
    }
  }
  if (out.id === 'jackpot') st.stats.jackpots++;
  st.pendingDecision = { type: 'casino', tileId, phase: 'result', reels: out.reels, label, outcome: out.id, animate: true };
  outboundFx.push({ kind: 'casino', reels: out.reels, label, outcome: out.id });
  outboundTicker = `🎰 ${p.name} spun the slots: ${out.reels.join('')} — ${label}`;
  pushState();
  if (p.isBot) {
    setMonopolyTicker(`🎰 ${p.name} spun: ${out.reels.join('')} — ${label}`);
    scheduleBotDecision(st.pendingDecision);
  } else {
    openDecisionModal(st.pendingDecision);
  }
}

function actLeaveCasino() {
  const p = monopolyState.players[monopolyState.currentTurn];
  announce(`🚶 ${p.name} walked away from the casino.`);
  finishTurn();
}

function actContinueCasino() {
  const st = monopolyState;
  const pk = st.currentTurn;
  const outcome = st.pendingDecision && st.pendingDecision.outcome;
  if (outcome === 'jackpot') {
    emitFx({ kind: 'moment', id: 'jackpot_celebration', role: pk });
  }
  finishTurn();
}

function actBuyMarketItem(id, tileId) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const it = ITEMS[id];
  if (!it) { finishTurn(); return; }
  const price = marketPrice(pk, id);
  if (p.miles < price || (p.inventory || []).length >= MONO_CFG.MAX_ITEMS) { finishTurn(); return; }
  if (price < it.price) {
    st.perkUsed = st.perkUsed || {};
    st.perkUsed[pk] = { ...(st.perkUsed[pk] || {}), market: true };
  }
  p.miles -= price;
  p.inventory.push(id);
  emitFx({ kind: 'coins', from: { role: pk }, to: { bank: true }, amount: price });
  emitFx({ kind: 'icon', from: { tileId }, to: { role: pk }, item: id });
  emitFx({ kind: 'sound', name: 'item' });
  emitFx({ kind: 'float', tileId, text: it.icon, cls: 'fx-big' });
  announce(`🎒 ${p.name} bought a ${it.icon} <strong>${it.name}</strong> on the Black Market…`);
  finishTurn();
}

function actLeaveMarket() {
  const p = monopolyState.players[monopolyState.currentTurn];
  announce(`🎒 ${p.name} left the Black Market.`);
  finishTurn();
}

function actChallengeArena(targetTileId) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const id = Number(targetTileId);
  const prop = st.properties[id];
  const defenderKey = prop ? prop.owner : (pk === 'bkk' ? 'dxb' : 'bkk');
  const isHotel = prop && (prop.level >= 3 || prop.hotel);

  // 🕯️ S7 Living Staff Torch Shield Parry: Blocks hostile Takeover Arena challenges!
  if (prop && prop.owner !== pk && prop.torchShield) {
    prop.torchShield = false;
    st.pendingDecision = null;
    hideModal();
    if (AudioFX.playLivingStaffParry) AudioFX.playLivingStaffParry();
    else if (AudioFX.playShieldBlock) AudioFX.playShieldBlock();
    emitFx({ kind: 'moment', id: 'living_staff_parry', tileId: id, defender: defenderKey, attacker: pk });
    floatText(id, '🕯️ TORCH SHIELD PARRY!', 'pos fx-big');
    announce(`🕯️🛡️ <strong>LIVING STAFF TORCH SHIELD PARRY!</strong> The enchanted candelabra torch flared up at <strong>${MONOPOLY_TILES[id].name}</strong>, parrying ${p.name}'s Takeover Arena challenge! The shield absorbed the duel and shattered!`);
    renderMonopolyBoard();
    finishTurn();
    return;
  }

  st.pendingDecision = null;
  st.activeDuel = {
    id: Date.now(), kind: 'arena', isHotelRaid: !!isHotel, tileId: id, attacker: pk, defender: defenderKey,
    rolls: { [pk]: null, [defenderKey]: null }, price: isHotel ? 0 : propValue(id), rent: 0, settled: false, result: null, paid: 0
  };
  hideModal();
  emitFx({ kind: 'sound', name: 'alarm' });
  if (isHotel) {
    announce(`💣⚔️ <strong>HOTEL RAID CHALLENGE!</strong> ${p.name} challenged ${st.players[defenderKey].name} to raid the Grand Hotel at ${MONOPOLY_TILES[id].name}!`);
  } else {
    announce(`⚔️ ${p.name} challenged ${st.players[defenderKey].name} for <strong>${MONOPOLY_TILES[id].name}</strong>!`);
  }
  pushState();
  reconcileOverlays();
}

function actSkipArena() {
  const p = monopolyState.players[monopolyState.currentTurn];
  announce(`⚔️ ${p.name} skipped the Takeover Arena.`);
  finishTurn();
}

// =========================================================
// 16c. BOT AUTONOMOUS TURN SCHEDULER
// =========================================================
let botActionTimer = null;
let botWatchdogTimer = null;

function clearBotTimer() {
  if (botActionTimer) {
    clearTimeout(botActionTimer);
    botActionTimer = null;
  }
  if (botWatchdogTimer) {
    clearTimeout(botWatchdogTimer);
    botWatchdogTimer = null;
  }
}

function isLocalPlayerAutoPilot(role) {
  if (!window.isMonopolyPlayerAway) return false;
  if (role !== getMonopolyMyRole()) return false;
  const modal = $m('monopolyModal');
  if (modal && !modal.classList.contains('hidden')) {
    // Player is actively viewing the Monopoly board — never auto-play their turn!
    window.isMonopolyPlayerAway = false;
    return false;
  }
  return true;
}

function armBotWatchdog(phase = 'turn') {
  if (botWatchdogTimer) clearTimeout(botWatchdogTimer);
  const st = monopolyState;
  if (!st || !st.active || st.gameOver) return;
  const botRole = st.currentTurn;
  const curP = st.players && st.players[botRole];
  const duelBot = st.activeDuel && !st.activeDuel.settled && [st.activeDuel.attacker, st.activeDuel.defender].find((r) => st.players[r]?.isBot && st.activeDuel.rolls[r] == null);
  if (!curP?.isBot && !isLocalPlayerAutoPilot(botRole) && !duelBot) return;

  const timeoutMs = phase === 'decision' ? 4500 : 6500;

  botWatchdogTimer = setTimeout(() => {
    botActionTimer = null;
    botWatchdogTimer = null;
    const s = monopolyState;
    if (!s || !s.active || s.gameOver) return;

    // Force clear any stuck roll/animation locks when watchdog fires!
    if (s.isRolling || isAnimating || isRoleLocked(botRole)) {
      console.warn(`[Monopoly] Bot ${botRole} watchdog detected stuck roll/anim lock. Force clearing locks!`);
      s.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
      flushQueuedMessages();
      updateMonopolyHUD();
    }

    if (s.activeDuel && !s.activeDuel.settled) {
      const unrolledBot = [s.activeDuel.attacker, s.activeDuel.defender].find((r) => s.players[r]?.isBot && s.activeDuel.rolls[r] == null);
      if (unrolledBot) {
        console.warn(`[Monopoly] Duel bot watchdog triggered for ${unrolledBot}! Rolling battle die...`);
        duelRoll(unrolledBot);
        return;
      }
    }

    if (s.currentTurn !== botRole) return;
    const p = s.players && s.players[botRole];
    if (!p || (!p.isBot && !isLocalPlayerAutoPilot(botRole))) return;
    if (!isResolver()) return;

    console.warn(`[Monopoly] Bot ${botRole} watchdog triggered (${phase})! Auto-progressing move...`);
    if (s.pendingDecision) {
      const dec = (window.NookMonoBot && typeof window.NookMonoBot.decide === 'function')
        ? window.NookMonoBot.decide(s, botRole, s.pendingDecision, p.botLevel || 'hard')
        : { act: 'pass' };
      applyBotDecision(s.pendingDecision, dec, p.botLevel || 'hard');
    } else {
      startRoll(d6(), false);
    }
  }, timeoutMs);
}

function checkBotTurn() {
  const st = monopolyState;
  if (!st || !st.active || st.gameOver) return;
  const botRole = st.currentTurn;
  const botP = st.players && st.players[botRole];
  if (!botP) {
    console.warn(`[Monopoly] Current turn '${botRole}' has no active player. Auto-advancing turn...`);
    if (isResolver()) endTurn();
    return;
  }
  const isAutoPilot = isLocalPlayerAutoPilot(botRole);
  if (!botP.isBot && !isAutoPilot) return;

  // Auto-recovery for stuck animation / roll locks:
  if (st.isRolling || isAnimating || isRoleLocked(botRole)) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 7500) {
      console.warn(`[Monopoly] checkBotTurn: detected stuck roll/anim lock (${elapsed}ms) for ${botRole}. Force resetting.`);
      st.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
      flushQueuedMessages();
      updateMonopolyHUD();
    } else {
      setTimeout(() => { checkBotTurn(); }, 400);
      return;
    }
  }

  armBotWatchdog();

  if (!isResolver()) return;

  if (st.activeDuel && !st.activeDuel.settled) {
    scheduleBotDuelRoll();
    return;
  }

  if (st.pendingDecision) {
    scheduleBotDecision(st.pendingDecision);
    return;
  }

  scheduleBotRoll();
}

function scheduleBotRoll() {
  clearBotTimer();
  const st = monopolyState;
  const botRole = st.currentTurn;
  const botP = st.players && st.players[botRole];
  const isAutoPilot = isLocalPlayerAutoPilot(botRole);
  if (!botP || (!botP.isBot && !isAutoPilot)) return;
  const level = botP.botLevel || 'hard';

  setMonopolyTicker(`✈️ <strong>${botP.name}</strong> is planning their move… 🐱💭`);
  updateMonopolyHUD();

  botActionTimer = setTimeout(() => {
    botActionTimer = null;
    if (!st.active || st.currentTurn !== botRole) return;
    if (!botP.isBot && !isLocalPlayerAutoPilot(botRole)) return;
    if (st.isRolling || isAnimating || isRoleLocked(botRole)) {
      const elapsed = Date.now() - (rollStartedAt || 0);
      if (elapsed > 7500) {
        console.warn(`[Monopoly] scheduleBotRoll: force clearing stuck roll lock for ${botRole}.`);
        st.isRolling = false;
        isAnimating = false;
        releaseRoleLocks();
        flushQueuedMessages();
      } else {
        setTimeout(() => { scheduleBotRoll(); }, 400);
        return;
      }
    }

    if (st.pendingDecision) {
      scheduleBotDecision(st.pendingDecision);
      return;
    }
    if (st.activeDuel && !st.activeDuel.settled) {
      scheduleBotDuelRoll();
      return;
    }

    if (botP.botLevel === 'insane' && (botP.ult || 0) >= 100) {
      const shouldUse = (window.NookMonoBot && typeof window.NookMonoBot.shouldUseUltimate === 'function')
        ? window.NookMonoBot.shouldUseUltimate(st, botRole)
        : true;
      if (shouldUse) {
        executeUltimate(botRole);
        setTimeout(() => {
          scheduleBotRoll();
        }, 2400);
        return;
      }
    }

    if (window.NookMonoBot && typeof window.NookMonoBot.preRoll === 'function') {
      try {
        const itemAction = window.NookMonoBot.preRoll(st, botRole, level);
        if (itemAction && itemAction.useItem) {
          applyBotItem(itemAction);
          if (itemAction.useItem === 'golden_dice') return;
        }
      } catch (e) {
        console.warn('[Monopoly] preRoll error:', e);
      }
    }

    startRoll(d6(), false);
  }, 650 + Math.floor(Math.random() * 250));
}

function applyBotItem(action) {
  const st = monopolyState;
  const botRole = st.currentTurn;
  const botPlayer = st.players && st.players[botRole];
  if (!botPlayer) return;
  const oppRoles = Object.keys(st.players || {}).filter((r) => r !== botRole && !st.players[r]?.bankrupt);
  const richestOppRole = oppRoles.reduce((best, r) => (!best || (st.players[r]?.miles || 0) > (st.players[best]?.miles || 0)) ? r : best, oppRoles[0]);
  const opp = richestOppRole || 'bkk';
  const oppPlayer = st.players[opp];
  const level = botPlayer.botLevel || 'hard';

  switch (action.useItem) {
    case 'golden_dice': {
      consumeItem(botRole, 'golden_dice');
      const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'golden_dice') : 'Precision flight!';
      emitFx({ kind: 'moment', id: 'golden', text: `Roll ${action.value}` });
      setMonopolyTicker(`🎲✨ ${botPlayer.name}: "${quote}" (Rolled a <strong>${action.value}</strong>)`);
      startRoll(action.value, true);
      break;
    }
    case 'c4': {
      const tid = action.tileId;
      if (tid != null && st.properties[tid] && st.properties[tid].level >= 2) {
        const victimRole = st.properties[tid].owner;
        const victimPlayer = st.players[victimRole];
        const prop = st.properties[tid];
        if (isNagaWarden(victimRole)) {
          consumeItem(botRole, 'c4');
          AudioFX.playNagaGong();
          emitFx({ kind: 'float', tileId: tid, text: '🐉 WARDED!', cls: 'neg' });
          announce(`🐉🛡️ <strong>MEKONG RIVER WARD!</strong> ${victimPlayer ? victimPlayer.name : 'Naga'}'s property absorbed the explosion with sacred serpent coils!`);
          break;
        }
        if (prop && prop.shield > 0) {
          consumeItem(botRole, 'c4');
          prop.shield -= 1;
          const left = prop.shield;
          if (left <= 0) delete prop.shield;
          AudioFX.playAstralImpact();
          emitFx({ kind: 'float', tileId: tid, text: `🪐 SHIELD DEFLECTED! (${left} left)`, cls: 'pos' });
          announce(`🪐🛡️ <strong>CELESTIAL SHIELD DEFLECTED!</strong> ${botPlayer.name}'s C4 was absorbed by ${victimPlayer ? victimPlayer.name : 'Rival'}'s Celestial Shield! (${left} charges left)`);
          renderAll();
          pushState();
          break;
        }
        if (prop && prop.waterShield) {
          consumeItem(botRole, 'c4');
          delete prop.waterShield;
          AudioFX.playAbyssalSplash();
          emitFx({ kind: 'float', tileId: tid, text: '🌊 WATER SHIELD DEFLECTED!', cls: 'pos' });
          announce(`🌊🛡️ <strong>LOTUS WATER SHIELD DEFLECTED!</strong> ${botPlayer.name}'s C4 was extinguished by Lotus Water Shield!`);
          renderAll();
          pushState();
          break;
        }
        consumeItem(botRole, 'c4');
        st.properties[tid].level = 1;
        renderMonopolyBoard();
        emitFx({ kind: 'moment', id: 'c4', tileId: tid, text: MONOPOLY_TILES[tid].name });
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'c4') : 'Boom!';
        announce(`💣 ${botPlayer.name}: "${quote}" (Blasted ${victimPlayer ? victimPlayer.name + "'s " : ''}${MONOPOLY_TILES[tid].name} to 1 house)`);
        pushState();
        renderAll();
      }
      break;
    }
    case 'magnet': {
      consumeItem(botRole, 'magnet');
      const targetMiles = Math.max(0, oppPlayer ? oppPlayer.miles : 0);
      const steal = Math.round(targetMiles * (MONO_CFG.MAGNET_RATE || 0.25));
      if (steal > 0 && oppPlayer) {
        oppPlayer.miles -= steal;
        botPlayer.miles += steal;
      }
      emitFx({ kind: 'sound', name: 'item' });
      if (oppPlayer) emitFx({ kind: 'float', tileId: oppPlayer.pos, text: steal > 0 ? `🧲 -${fmt(steal)}` : '🧲 0', cls: 'fx-big fx-loss' });
      emitFx({ kind: 'float', tileId: botPlayer.pos, text: steal > 0 ? `🧲 +${fmt(steal)}` : '🧲 0', cls: 'fx-big fx-gain' });
      if (steal > 0 && opp) {
        emitFx({ kind: 'coins', from: { role: opp }, to: { role: botRole }, amount: steal });
      }
      const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'magnet') : 'Magnetic siphon!';
      announce(`🧲 ${botPlayer.name}: "${quote}" (Siphoned ${fmt(steal)}🪙 from ${oppPlayer ? oppPlayer.name : 'rival'})`);
      pushState();
      renderAll();
      break;
    }
    case 'swap': {
      consumeItem(botRole, 'swap');
      if (oppPlayer) {
        const tmp = botPlayer.pos;
        botPlayer.pos = oppPlayer.pos;
        oppPlayer.pos = tmp;
        emitFx({ kind: 'swap' });
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'swap') : 'Seat swap!';
        announce(`🌀 ${botPlayer.name}: "${quote}" (Swapped seats with ${oppPlayer.name}!)`);
        pushState();
        renderAll();
      }
      break;
    }
    case 'banana': {
      consumeItem(botRole, 'banana');
      st.bananaTraps = st.bananaTraps || {};
      st.bananaTraps[botPlayer.pos] = (st.bananaTraps[botPlayer.pos] || 0) + 1;
      AudioFX.playBananaSlip();
      emitFx({ kind: 'moment', id: 'banana_peel_trap', role: botRole, tileId: botPlayer.pos, text: '🍌 Banana Trap Set!' });
      floatText(botPlayer.pos, '🍌 TRAP SET!', 'pos');
      announce(`🍌😼 <strong>BANANA PEEL PLANTED!</strong> ${botPlayer.name} planted a slippery banana peel at ${MONOPOLY_TILES[botPlayer.pos].name}!`);
      pushState();
      renderAll();
      break;
    }
  }
}

function scheduleBotDecision(d) {
  clearBotTimer();
  const st = monopolyState;
  const botRole = st.currentTurn;
  const botP = st.players && st.players[botRole];
  const isAutoPilot = isLocalPlayerAutoPilot(botRole);
  if (!botP || (!botP.isBot && !isAutoPilot)) return;
  const level = botP.botLevel || 'hard';

  setMonopolyTicker(`🤔 <strong>${botP.name}</strong> is deciding what to do…`);
  updateMonopolyHUD();
  armBotWatchdog('decision');

  botActionTimer = setTimeout(() => {
    botActionTimer = null;
    if (!st.active || st.currentTurn !== botRole) return;
    if (!botP.isBot && !isLocalPlayerAutoPilot(botRole)) return;
    let decision = { act: 'pass' };
    if (window.NookMonoBot && typeof window.NookMonoBot.decide === 'function') {
      try {
        decision = window.NookMonoBot.decide(st, botRole, d, level);
      } catch (e) {
        console.warn('[Monopoly] bot decide error:', e);
      }
    }
    applyBotDecision(d, decision, level);
  }, 650 + Math.floor(Math.random() * 250));
}

function applyBotDecision(d, dec, level) {
  const st = monopolyState;
  const botRole = st.currentTurn;
  const botP = st.players && st.players[botRole];
  const botName = botP ? botP.name : 'Bot';

  switch (d.type) {
    case 'buy': {
      if (dec.act === 'buy') {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'buy') : 'Prime real estate!';
        setMonopolyTicker(`😼 ${botName}: "${quote}"`);
        actBuy(d.tileId);
      } else {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'pass') : 'Passing on this one.';
        setMonopolyTicker(`😼 ${botName}: "${quote}"`);
        actPassBuy(d.tileId);
      }
      break;
    }
    case 'upgrade': {
      if (dec.act === 'build') {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'upgrade') : 'Upgraded!';
        setMonopolyTicker(`😼 ${botName}: "${quote}"`);
        actUpgrade(d.tileId);
      } else {
        actSkipUpgrade(d.tileId);
      }
      break;
    }
    case 'rent': {
      if (dec.act === 'shield') {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'rent_shield') : 'Shield activated!';
        setMonopolyTicker(`🛡️ ${botName}: "${quote}"`);
        actUseShield(d.tileId);
      } else if (dec.act === 'takeover') {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'takeover') : 'Hostile takeover!';
        setMonopolyTicker(`⚔️ ${botName}: "${quote}"`);
        actTakeover(d.tileId);
      } else if (dec.act === 'clash') {
        setMonopolyTicker(`🍸 ${botName}: "Double or Nothing! Let's have a Cocktail Clash!"`);
        actCocktailClash(d.tileId);
      } else {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'rent_pay') : 'Rent paid.';
        setMonopolyTicker(`💸 ${botName}: "${quote}"`);
        actPayRent(d.tileId);
      }
      break;
    }
    case 'casino': {
      if (d.phase === 'offer') {
        if (dec.act === 'spin') {
          actSpinCasino(d.tileId);
        } else {
          actLeaveCasino();
        }
      } else {
        actContinueCasino();
      }
      break;
    }
    case 'market': {
      if (dec.act === 'buyItem' && dec.itemId) {
        actBuyMarketItem(dec.itemId, d.tileId);
      } else {
        actLeaveMarket();
      }
      break;
    }
    case 'arena': {
      if (dec.act === 'challenge' && dec.targetTileId != null) {
        const quote = window.NookMonoBot ? window.NookMonoBot.randomQuote(level, 'takeover') : 'Arena challenge!';
        setMonopolyTicker(`⚔️ ${botName}: "${quote}"`);
        actChallengeArena(dec.targetTileId);
      } else {
        actSkipArena();
      }
      break;
    }
    default:
      finishTurn();
      break;
  }
}

function scheduleBotDuelRoll() {
  clearBotTimer();
  const st = monopolyState;
  if (!st.activeDuel || st.activeDuel.settled) return;
  const d = st.activeDuel;
  const botRole = [d.attacker, d.defender].find((r) => st.players[r]?.isBot && d.rolls[r] == null);
  if (!botRole) return;

  botActionTimer = setTimeout(() => {
    botActionTimer = null;
    if (!st.activeDuel || st.activeDuel.settled || st.activeDuel.rolls[botRole] != null) return;
    duelRoll(botRole);
  }, 700 + Math.floor(Math.random() * 300));
}

// =========================================================
// 17. BUY & UPGRADE
// =========================================================
function rentLadder(tileId) {
  return `🏠 ${fmt(getTileRent(tileId, 1))} · 🏠🏠 ${fmt(getTileRent(tileId, 2))} · 🏨 ${fmt(getTileRent(tileId, 3))}`;
}

function renderBuyModal(d, key) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[d.tileId];
  const pk = st.currentTurn;
  const p = st.players[pk];
  const effectivePrice = getEffectiveTilePrice(tile, pk);
  const can = p.miles >= effectivePrice;
  const zt = zoneTiles(tile.zone);
  const ownedInZone = zt.filter((t) => st.properties[t.id] && st.properties[t.id].owner === pk).length;

  showModal(key, `
    <div class="property-card">
      <span class="card-badge">${ZONES[tile.zone].label.toUpperCase()} · ${ownedInZone}/${zt.length} OWNED</span>
      <h3 class="card-title">${tile.icon} ${tile.name}</h3>
      <p class="card-desc">${tile.desc}</p>
      <div class="card-stats">
        <span>Price <strong>${fmt(effectivePrice)}🪙</strong>${effectivePrice < tile.price ? ` <del style="opacity:0.6">${fmt(tile.price)}🪙</del>` : ''}</span>
        <span>You have <strong>${fmt(p.miles)}🪙</strong></span>
      </div>
      <div class="card-ladder">Rent: ${rentLadder(tile.id)}</div>
      <div class="card-hint">👑 Own all ${zt.length} in ${ZONES[tile.zone].label} → rent ×2</div>
      <div class="card-actions">
        <button class="btn-buy-prop" data-act="buy" ${can ? '' : 'disabled'}>${can ? `Buy for ${fmt(effectivePrice)}🪙 🏠` : 'Not enough miles'}</button>
        <button class="btn-pass-prop" data-act="pass">Pass ➡️</button>
      </div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-act="buy"]', () => actBuy(d.tileId));
    onTap(ov, '[data-act="pass"]', () => actPassBuy(d.tileId));
  });
}

function renderUpgradeModal(d, key) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[d.tileId];
  const prop = st.properties[d.tileId];
  const pk = st.currentTurn;
  const p = st.players[pk];
  const cost = upgradeCost(tile);
  const next = prop.level + 1;
  const isHotel = next === 3;
  const can = p.miles >= cost;
  const title = isHotel ? 'Grand Hotel 🏨' : '2 Houses 🏠🏠';

  showModal(key, `
    <div class="property-card upgrade-card">
      <span class="card-badge gold">UPGRADE ${isHotel ? '👑' : '✨'}</span>
      <h3 class="card-title">${tile.icon} ${tile.name}</h3>
      <p class="card-desc">Build a <strong>${title}</strong>.${isHotel ? ' Hotels are cash-only: no duels or Vibe Checks against them.' : ''}</p>
      <div class="card-stats">
        <span>Cost <strong>${fmt(cost)}🪙</strong></span>
        <span>Rent <strong>${fmt(getTileRent(tile.id))} → ${fmt(getTileRent(tile.id, next))}🪙</strong></span>
      </div>
      <div class="card-actions">
        <button class="btn-buy-prop" data-act="build" ${can ? '' : 'disabled'}>${can ? `Build ${title} (${fmt(cost)}🪙)` : 'Not enough miles'}</button>
        <button class="btn-pass-prop" data-act="skip">Skip ➡️</button>
      </div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-act="build"]', () => actUpgrade(d.tileId));
    onTap(ov, '[data-act="skip"]', () => actSkipUpgrade(d.tileId));
  });
}

// =========================================================
// 18. RENT: PAY / SHIELD / HOSTILE TAKEOVER / VIBE CHECK
// =========================================================
function renderRentModal(d, key) {
  const st = monopolyState;
  const tile = MONOPOLY_TILES[d.tileId];
  const prop = st.properties[d.tileId];
  if (!prop) { finishTurn(); return; }
  const pk = st.currentTurn;
  const p = st.players[pk];
  const ownerKey = prop.owner;
  const o = st.players[ownerKey];
  const rent = getTileRent(tile.id);
  const value = propValue(tile.id);
  const isHotel = prop.level >= 3;
  const hasShield = (p.inventory || []).includes('shield');
  const canTakeover = !isHotel && p.miles >= value;
  const tokens = p.clashTokens != null ? p.clashTokens : (p.vibePasses || 0);
  const canClash = !isHotel && tokens > 0;
  const loseCost = Math.round(rent * MONO_CFG.TAKEOVER_LOSE_MULT);
  const clashLoss = Math.round(rent * 1.5);

  const tags = [];
  if (prop.level >= 3) tags.push('🏨 Hotel ×12');
  else if (prop.level === 2) tags.push('🏠🏠 ×4');
  if (ownsZone(ownerKey, tile.zone)) tags.push('👑 Zone ×2');
  if (isFinalBoarding()) tags.push(`🔥 Final ${multLabel(finalBoardingMult())}`);

  const takeoverNote = isHotel ? 'Hotels are cash only' : !canTakeover ? `Need ${fmt(value)}🪙 to buy it` : `Win: buy it for ${fmt(value)}🪙 · Lose: pay ${fmt(loseCost)}🪙`;
  const clashNote = isHotel ? 'Hotels are cash only' : tokens <= 0 ? 'No glasses left' : `Win: 0 rent +50🪙 · Lose: pay 1.5× (${fmt(clashLoss)}🪙)`;
  const danger = rent > p.miles ? `<div class="card-warning">⚠️ You only have ${fmt(p.miles)}🪙 — paying will auto-sell your properties at 50%.</div>` : '';

  showModal(key, `
    <div class="rent-choice-card">
      <span class="card-badge pink">RENT DUE · ${o.name.toUpperCase()}</span>
      <h3 class="card-title">${tile.icon} ${tile.name}</h3>
      <div class="rent-big">${fmt(rent)}🪙</div>
      <div class="rent-tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
      ${danger}
      <div class="card-actions">
        <button class="rent-option opt-pay" data-act="pay"><span class="ro-title">💸 Pay rent</span><span class="ro-sub">${fmt(rent)}🪙 to ${o.name}</span></button>
        ${hasShield ? `<button class="rent-option opt-shield" data-act="shield"><span class="ro-title">🛡️ Use Rent Shield</span><span class="ro-sub">Pay nothing</span></button>` : ''}
        <button class="rent-option opt-takeover" data-act="takeover" ${canTakeover ? '' : 'disabled'}><span class="ro-title">⚔️ Hostile Takeover</span><span class="ro-sub">${takeoverNote}</span></button>
        <button class="rent-option opt-clash" data-act="clash" ${canClash ? '' : 'disabled'}><span class="ro-title">🍸 Cocktail Clash <em>${tokens}🍸 left</em></span><span class="ro-sub">${clashNote}</span></button>
      </div>
      ${isHotel ? '<div class="card-hint">🏨 Hotels are cash only. Only 💣 C4 or Arena Raid can hit them.</div>' : '<div class="card-hint">🍸 Cocktail Clash: 2-sec dice showdown · Double or Nothing!</div>'}
    </div>
  `, (ov) => {
    onTap(ov, '[data-act="pay"]', () => actPayRent(d.tileId));
    onTap(ov, '[data-act="shield"]', () => actUseShield(d.tileId));
    onTap(ov, '[data-act="takeover"]', () => actTakeover(d.tileId));
    onTap(ov, '[data-act="clash"]', () => actCocktailClash(d.tileId));
  });
}

// =========================================================
// 19. VIBE CHECK CARDS (WMLT & READ MY MIND)
// =========================================================
const revealPlayed = new Set();
const lockSeen = new Set();
let revealPlayingId = null;

function hideCardOverlay() {
  const ov = $m('balanceGameOverlay');
  if (ov && ov.classList.contains('active')) {
    ov.classList.remove('active');
    ov.innerHTML = '';
  }
  if (ov) delete ov.dataset.key;
  if (window.MonoFX) MonoFX.flushTileFx();
}

/** Returns 'no-pop' when the same card/duel is re-rendered (skip the pop-in animation). */
function cardPopClass(ov, key) {
  const same = ov.dataset.key === key;
  ov.dataset.key = key;
  return same ? 'no-pop' : '';
}

function challengeNeeds(c) {
  if (c && (c.visitor || c.owner)) {
    return [c.visitor, c.owner].filter(Boolean);
  }
  return ['bkk', 'dxb'];
}

function revealStageHtml(c, card, animated) {
  const st = monopolyState;
  const back = window.MonoFX && MonoFX.assetUrl('card_back') ? `<img src="${MonoFX.assetUrl('card_back')}" alt="">` : '✈️💗';
  const thumb = (r) => `<img src="${st.players[r].sprite}" alt="">`;
  const mk = (labelRole, labelText, frontHtml) => `<div class="reveal-card">
    <div class="rc-label">${thumb(labelRole)}${labelText}</div>
    <div class="rc-flip"><div class="rc-face rc-back">${back}</div><div class="rc-face rc-front">${frontHtml}</div></div></div>`;
  let cards = '';
  if (c.type === 'wmlt') {
    cards = ['bkk', 'dxb'].map((r) => { const pick = c.picks[r]; return mk(r, `${st.players[r].badge} voted`, `${thumb(pick)}<strong>${st.players[pick].name}</strong>`); }).join('');
  } else {
    const txt = (L) => (L === 'A' ? card.a : card.b);
    cards = mk(c.owner, 'Real answer', `<em>REAL</em><strong>${txt(c.picks[c.owner])}</strong>`)
          + mk(c.visitor, 'Guess', `<em>GUESS</em><strong>${txt(c.picks[c.visitor])}</strong>`);
  }
  const match = c.result === 'match';
  const stamp = match ? '💞 MATCH!' : '💔 MISS!';
  const cls = animated ? '' : 'flipped stamped no-anim';
  return `<div class="reveal-stage ${cls} ${match ? 'is-match' : 'is-miss'}">${cards}<div class="reveal-stamp ${match ? 'match' : 'miss'}">${stamp}</div></div>`;
}

function runVibeReveal(ov, c) {
  revealPlayingId = c.id;
  const FX = window.MonoFX;
  const k = FX && FX.reducedMotion ? 0.5 : 1;
  const stage = ov.querySelector('.reveal-stage');
  const cardEl = ov.querySelector('.vibe-card');
  const match = c.result === 'match';
  if (!stage) { revealPlayingId = null; return; }
  stage.classList.add('drum');
  for (let i = 0; i < 8; i++) setTimeout(() => AudioFX.playDiceTick(), (200 + i * (90 - i * 6)) * k);
  setTimeout(() => { stage.classList.remove('drum'); stage.classList.add('flipped'); AudioFX.playFlip(); }, 900 * k);
  setTimeout(() => {
    stage.classList.add('stamped');
    AudioFX.playStamp();
    const p = FX.point({ el: stage });
    if (match) { AudioFX.playMatch(); FX.heartBurst(p.x, p.y); }
    else { AudioFX.playMiss(); FX.brokenHeart(p.x, p.y); FX.shake('light'); }
  }, 1400 * k);
  setTimeout(() => {
    revealPlayingId = null;
    if (cardEl) { cardEl.classList.remove('reveal-pending'); cardEl.classList.add('reveal-done'); }
    if (stage) stage.classList.add('no-anim');     // later re-renders render it static anyway
  }, 2300 * k);
}

function renderChallengeOverlay() {
  const st = monopolyState;
  const c = st.activeChallenge;
  const ov = $m('balanceGameOverlay');
  if (!c || !ov) return;
  const card = getSafeCard(c.cardId, st.playedCardIds);
  if (!card) return;
  if (revealPlayingId === c.id) return;

  const sawUnsettled = ov.dataset.key === `c${c.id}` && ov.dataset.settled !== '1';
  const animateReveal = c.settled && !revealPlayed.has(c.id) && sawUnsettled && !!window.MonoFX;
  if (c.settled) revealPlayed.add(c.id);

  const me = getMonopolyMyRole();
  const vis = st.players[c.visitor];
  const own = st.players[c.owner];
  const myPick = c.picks[me];
  const iNeedToPick = challengeNeeds(c).includes(me) && myPick == null && !c.settled;
  const waitingOn = challengeNeeds(c).filter((r) => c.picks[r] == null);
  const pillText = c.type === 'wmlt' ? "🎯 WHO'S MORE LIKELY TO…" : '🔮 READ MY MIND';
  const missCost = Math.round(c.rent * MONO_CFG.VIBE_MISS_MULT);

  let title = '';
  let sub = '';
  let body = '';

  if (c.type === 'wmlt') {
    title = `Who's more likely to ${card.q}`;
    sub = iNeedToPick ? 'Vote honestly — same answer = match 😏' : '';
    body = ['bkk', 'dxb'].map((r) => {
      const pl = st.players[r];
      const chips = c.settled
        ? ['bkk', 'dxb'].filter((x) => c.picks[x] === r).map((x) => `<span class="pick-chip chip-${x}">${st.players[x].badge}</span>`).join('')
        : '';
      return `<button class="vibe-option who-option ${myPick === r ? 'selected' : ''}" data-val="${r}" ${iNeedToPick ? '' : 'disabled'}>
        <img src="${pl.sprite}" class="who-thumb" alt="" /><span class="opt-text">${pl.name}</span>${chips}</button>`;
    }).join('');
  } else {
    // c.type === 'mind'
    title = card.q;
    const iAmOwner = me === c.owner;
    sub = c.settled ? '' : iAmOwner ? 'Pick YOUR real answer 🤫' : `Guess ${own.name}'s answer 🔮`;
    body = `<div class="mind-roles">${own.name} answers for real · ${vis.name} guesses</div>` + [['A', card.a], ['B', card.b]].map(([L, text]) => {
      let chips = '';
      if (c.settled) {
        if (c.picks[c.owner] === L) chips += '<span class="pick-chip chip-real">REAL</span>';
        if (c.picks[c.visitor] === L) chips += '<span class="pick-chip chip-guess">GUESS</span>';
      }
      return `<button class="vibe-option ${myPick === L ? 'selected' : ''}" data-val="${L}" ${iNeedToPick ? '' : 'disabled'}>
        <span class="opt-letter">${L}</span><span class="opt-text">${text}</span>${chips}</button>`;
    }).join('');
  }

  const lockRow = c.settled ? '' : `<div class="lock-row">${challengeNeeds(c).map((r) => {
    const picked = c.picks[r] != null;
    const key = `${c.id}:${r}`;
    const fresh = picked && !lockSeen.has(key);
    if (picked) lockSeen.add(key);
    if (fresh && r !== me) AudioFX.playFlip();
    return `<span class="lock-chip ${picked ? 'locked' : ''} ${fresh ? 'just-locked' : ''}"><img src="${st.players[r].sprite}" alt="">${picked ? '✅ Locked' : 'Thinking…'}</span>`;
  }).join('')}</div>`;

  let footer = '';
  if (c.settled) {
    const match = c.result === 'match';
    const detail = c.type === 'mind'
      ? `${own.name}'s real answer: <strong>${c.picks[c.owner]}</strong> · ${vis.name} guessed: <strong>${c.picks[c.visitor]}</strong>`
      : `${st.players.bkk.badge} picked ${st.players[c.picks.bkk].name} · ${st.players.dxb.badge} picked ${st.players[c.picks.dxb].name}`;
    footer = `<div class="balance-result-banner ${match ? 'match' : 'contrast'}">
      <strong class="result-title">${match ? '💖 MATCH! Rent is FREE.' : `💸 MISS! ${vis.name} pays ${fmt(c.paid)}🪙`}</strong>
      <span>${detail}${soldNote(c.sold)}</span>
    </div>`;
    footer += isResolver()
      ? '<button class="btn-balance-done" data-act="continue">Continue ✈️</button>'
      : `<div class="waiting-note">Waiting for ${st.players[st.turnResolver || st.currentTurn].name} to continue…</div>`;
  } else {
    if (myPick != null || !challengeNeeds(c).includes(me)) {
      footer = `<div class="waiting-note">${waitingOn.length ? `Waiting for ${waitingOn.map((r) => st.players[r].name).join(' & ')}… ⏳` : 'Revealing…'}</div>`;
    }
  }

  const popCls = cardPopClass(ov, `c${c.id}`);
  ov.dataset.settled = c.settled ? '1' : '0';

  ov.innerHTML = `
    <div class="balance-card vibe-card type-${c.type} ${popCls} ${c.settled ? 'settled' : ''} ${animateReveal ? 'reveal-pending' : ''}">
      <div class="vibe-card-head">
        <span class="balance-category-pill">${pillText}</span>
        <span class="vibe-stakes">Match FREE · Miss ${fmt(missCost)}🪙</span>
      </div>
      <h3 class="balance-question-title">${title}</h3>
      ${sub ? `<div class="vibe-sub">${sub}</div>` : ''}
      ${c.settled ? revealStageHtml(c, card, animateReveal) : ''}
      <div class="balance-options-grid">${body}</div>
      ${lockRow}
      ${footer}
    </div>
  `;
  ov.classList.add('active');

  ov.querySelectorAll('.vibe-option[data-val]').forEach((btn) => {
    btn.addEventListener('click', () => challengePick(btn.dataset.val));
  });
  const cont = ov.querySelector('[data-act="continue"]');
  if (cont) cont.addEventListener('click', () => { cont.disabled = true; finishChallenge(); });
  const bail = ov.querySelector('[data-act="bail"]');
  if (bail) bail.addEventListener('click', () => { bail.disabled = true; bailChallenge(); });

  if (animateReveal) runVibeReveal(ov, c);
}

function challengePick(value) {
  const st = monopolyState;
  const c = st.activeChallenge;
  const me = getMonopolyMyRole();
  if (!c || c.settled || c.picks[me] != null || !challengeNeeds(c).includes(me)) return;
  c.picks[me] = value;
  AudioFX.playHop();
  if (isResolver()) {
    trySettleChallenge();
    pushState();
  } else {
    sendPick('challenge', c.id, me, value);
  }
  renderChallengeOverlay();
}

function trySettleChallenge() {
  const st = monopolyState;
  const c = st.activeChallenge;
  if (!c || c.settled) return;
  if (challengeNeeds(c).some((r) => c.picks[r] == null)) return;
  const match = c.picks.bkk === c.picks.dxb;
  c.settled = true;
  c.result = match ? 'match' : 'miss';
  const vis = st.players[c.visitor];
  if (match) {
    st.stats.matches++;
    ['bkk', 'dxb'].forEach((r) => {
      const pl = st.players[r];
      if (pl && !pl.inventory.includes('shield') && pl.inventory.length < MONO_CFG.MAX_ITEMS) {
        pl.inventory.push('shield');
      }
    });
    emitFx({ kind: 'float', tileId: c.tileId, text: '+35💎 + 🛡️ SHIELD!', cls: 'gold fx-big' });
    announce(`💖 <strong>PERFECT VIBE MATCH!</strong> Both players earn <strong>+35💎 each</strong> + 🛡️ <strong>Golden Rent Shield</strong>! ${vis.name} stays for free.`);
  } else {
    const r = chargePlayer(c.visitor, c.rent * MONO_CFG.VIBE_MISS_MULT, c.owner);
    c.paid = r.paid;
    c.sold = r.sold;
    st.stats.misses++;
    st.stats.rentPaid[c.visitor] += r.paid;
    emitFx({ kind: 'coins', from: { role: c.visitor }, to: { role: c.owner }, amount: r.paid, delay: 1700 });
    emitFx({ kind: 'float', tileId: c.tileId, text: `-${fmt(r.paid)}`, cls: 'neg' });
    announce(r.bankrupt
      ? `💀 Vibe miss! ${vis.name} couldn't pay and went <strong>BANKRUPT</strong>!`
      : `💸 Vibe miss! ${vis.name} pays <strong>${fmt(r.paid)}🪙</strong> (2× rent).`);
  }
}

function finishChallenge() {
  monopolyState.activeChallenge = null;
  hideCardOverlay();
  finishTurn();
}

function bailChallenge() {
  const st = monopolyState;
  const c = st.activeChallenge;
  if (!c) return;
  st.players[c.visitor].vibePasses += 1; // refund the pass
  const r = chargePlayer(c.visitor, c.rent, c.owner);
  st.stats.rentPaid[c.visitor] += r.paid;
  st.activeChallenge = null;
  hideCardOverlay();
  announce(`⏭ Partner idle — ${st.players[c.visitor].name} paid normal rent: ${fmt(r.paid)}🪙.${soldNote(r.sold)}`);
  finishTurn();
}

// =========================================================
// 20. DUELS (HOSTILE TAKEOVER & ARENA)
// =========================================================
// module level
const shownDuelRolls = new Set();
let duelRollingUntil = 0;
let duelRerenderTimer = null;

function renderDuelOverlay() {
  const st = monopolyState;
  const d = st.activeDuel;
  const ov = $m('balanceGameOverlay');
  if (!d || !ov) return;
  if (Date.now() < duelRollingUntil) {
    clearTimeout(duelRerenderTimer);
    duelRerenderTimer = setTimeout(renderDuelOverlay, duelRollingUntil - Date.now() + 20);
    return;
  }
  const me = getMonopolyMyRole();
  const att = st.players[d.attacker];
  const def = st.players[d.defender];
  const tile = MONOPOLY_TILES[d.tileId];
  const aRoll = d.rolls[d.attacker];
  const dRoll = d.rolls[d.defender];
  const isParticipant = (d.attacker === me || d.defender === me);
  const oppInDuel = d.attacker === me ? d.defender : d.attacker;
  const myRoll = isParticipant ? d.rolls[me] : null;

  const fresh = [d.attacker, d.defender].filter((r) => d.rolls[r] != null && !shownDuelRolls.has(`${d.id}:${r}`));
  fresh.forEach((r) => shownDuelRolls.add(`${d.id}:${r}`));

  const die = (role, v, isWinner) => {
    const isLoaded = perkOf(role).duelMinRoll && perkOf(role).duelMinRoll > 1;
    const loadedClass = isLoaded ? 'loaded-battle-die' : '';
    if (fresh.includes(role)) {
      return `<div class="duel-die ${loadedClass} rolling" data-role="${role}" data-final="${v}">?</div>`;
    }
    const winnerClass = (isWinner && fresh.length === 0) ? 'winner' : '';
    return `<div class="duel-die ${loadedClass} ${v == null ? 'pending' : ''} ${winnerClass}">${v == null ? '?' : v}</div>`;
  };

  const isCocktail = d.kind === 'cocktail';
  const stakes = isCocktail
    ? `Win → 0 Rent + 50🪙 Drink Bounty · Lose → pay 1.5× Rent (${fmt(Math.round(d.rent * 1.5))}🪙)`
    : d.kind === 'takeover'
      ? `Win → buy it for ${fmt(d.price)}🪙 · Lose → pay ${fmt(Math.round(d.rent * MONO_CFG.TAKEOVER_LOSE_MULT))}🪙`
      : (d.isHotelRaid ? `Win → Downgrade hotel to Lvl 2 + plunder 150🪙 · Lose → nothing` : `Win → buy it for ${fmt(d.price)}🪙 · Lose → nothing happens`);

  let footer = '';
  if (d.settled) {
    const win = d.result === 'win';
    if (isCocktail) {
      footer = `<div class="balance-result-banner ${win ? 'match' : 'contrast'}">
        <strong class="result-title">${win ? `🥂 ${att.name} won the Cocktail Clash!` : `🥴 ${att.name} lost the Cocktail Clash!`}</strong>
        <span>${win ? `Rent waived to 0! ${def.name} bought the round (+50🪙 drink bounty).` : `Paid 1.5× hangover rent (${fmt(d.paid)}🪙) to ${def.name}.${soldNote(d.sold)}`}</span>
      </div>`;
    } else if (d.isHotelRaid) {
      footer = `<div class="balance-result-banner ${win ? 'match' : 'contrast'}">
        <strong class="result-title">${win ? `💣 ${att.name} successfully raided the Grand Hotel!` : `🛡️ ${def.name} defended the Grand Hotel!`}</strong>
        <span>${win ? `Hotel downgraded to Level 2! ${att.name} plundered +150🪙.` : 'Grand Hotel stands unbreached.'}</span>
      </div>`;
    } else {
      footer = `<div class="balance-result-banner ${win ? 'match' : 'contrast'}">
        <strong class="result-title">${win ? `🏴 ${att.name} seized ${tile.name}!` : `🛡️ ${def.name} defended ${tile.name}!`}</strong>
        <span>${win ? `Paid ${fmt(d.paid)}🪙 to ${def.name}.` : d.kind === 'takeover' ? `${att.name} pays ${fmt(d.paid)}🪙.` : 'No harm done.'}${soldNote(d.sold)}</span>
      </div>`;
    }
    footer += (isResolver() || isParticipant)
      ? '<button class="btn-balance-done" data-act="continue">Continue ✈️</button>'
      : `<div class="waiting-note">Waiting for ${st.players[st.turnResolver || st.currentTurn]?.name || 'player'} to continue…</div>`;
  } else {
    if (isParticipant) {
      if (myRoll == null) {
        footer = `<button class="btn-duel-roll ${isCocktail ? 'cocktail-roll' : ''}" data-act="roll">${isCocktail ? '🍸 Roll to Drink!' : '🎲 Roll your battle die'}</button>`;
      } else {
        footer = `<div class="waiting-note">Waiting for ${st.players[oppInDuel]?.name || 'opponent'} to roll… ⏳</div>`;
      }
    } else {
      const unrolledBot = [d.attacker, d.defender].find((r) => st.players[r]?.isBot && d.rolls[r] == null);
      footer = `<div class="waiting-note">Spectating ${isCocktail ? 'Cocktail Clash' : 'battle'} between ${att.name} and ${def.name}… ${isCocktail ? '🍸' : '⚔️'}</div>`;
      if (unrolledBot) {
        footer += `<div style="text-align:center;margin-top:10px;"><button class="btn-balance-done" style="font-size:12px;padding:6px 16px;opacity:0.95;" data-act="rollBot" data-bot="${unrolledBot}">🎲 Roll for ${st.players[unrolledBot]?.name || 'Bot'}</button></div>`;
      }
    }
  }

  const categoryPill = isCocktail
    ? '<span class="balance-category-pill duel-pill cocktail-pill">🍸 COCKTAIL CLASH</span>'
    : d.isHotelRaid
      ? '<span class="balance-category-pill duel-pill">💣 HOTEL RAID ARENA</span>'
      : `<span class="balance-category-pill duel-pill">${d.kind === 'takeover' ? '⚔️ HOSTILE TAKEOVER' : '⚔️ ARENA DUEL'}</span>`;

  ov.innerHTML = `
    <div class="balance-card duel-card ${cardPopClass(ov, `d${d.id}`)} ${d.settled && fresh.length ? 'reveal-pending' : ''}">
      <div class="vibe-card-head">
        ${categoryPill}
        <span class="vibe-stakes">Owner wins ties</span>
      </div>
      <h3 class="balance-question-title">${tile.icon} ${tile.name}</h3>
      <div class="duel-arena">
        <div class="duel-side"><img src="${att.sprite}" class="duel-thumb" alt="" /><span>${att.name}</span><em>${isCocktail ? 'Visitor' : 'Attacker'}</em>${die(d.attacker, aRoll, d.settled && d.result === 'win')}</div>
        <div class="duel-vs">VS</div>
        <div class="duel-side"><img src="${def.sprite}" class="duel-thumb" alt="" /><span>${def.name}</span><em>Owner</em>${die(d.defender, dRoll, d.settled && d.result !== 'win')}</div>
      </div>
      <div class="vibe-sub">${stakes}</div>
      ${footer}
    </div>
  `;
  ov.classList.add('active');

  if (fresh.length) {
    duelRollingUntil = Date.now() + 700;
    ov.querySelectorAll('.duel-die.rolling').forEach((el) => {
      const iv = setInterval(() => { el.textContent = String(1 + Math.floor(Math.random() * 6)); }, 70);
      setTimeout(() => {
        clearInterval(iv);
        el.textContent = el.dataset.final;
        el.classList.remove('rolling');
        el.classList.add('just-rolled');
        AudioFX.playDiceImpact();
      }, 650);
    });
    if (d.settled) setTimeout(() => {
      const card = ov.querySelector('.duel-card');
      const win = d.result === 'win';
      const dice = ov.querySelectorAll('.duel-die');            // [attacker, defender] in DOM order
      if (dice[0]) dice[0].classList.add(win ? 'winner' : 'loser');
      if (dice[1]) dice[1].classList.add(win ? 'loser' : 'winner');
      if (card) { card.classList.remove('reveal-pending'); card.classList.add('reveal-done'); }
    }, 700);
  }

  const rollBtn = ov.querySelector('[data-act="roll"]');
  if (rollBtn) rollBtn.addEventListener('click', () => { rollBtn.disabled = true; duelRoll(me); });
  const rollOther = ov.querySelector('[data-act="rollOther"]');
  if (rollOther) rollOther.addEventListener('click', () => { rollOther.disabled = true; duelRoll(oppInDuel); });
  const rollBotBtn = ov.querySelector('[data-act="rollBot"]');
  if (rollBotBtn) rollBotBtn.addEventListener('click', () => {
    rollBotBtn.disabled = true;
    const targetBot = rollBotBtn.dataset.bot;
    if (targetBot) duelRoll(targetBot);
  });
  const cont = ov.querySelector('[data-act="continue"]');
  if (cont) cont.addEventListener('click', () => {
    cont.disabled = true;
    if (isResolver()) {
      finishDuel();
    } else {
      sendPick('duel_done', d.id, me, true);
      hideCardOverlay();
    }
  });

  if (!d.settled && isResolver()) {
    const unrolledBot = [d.attacker, d.defender].find((r) => st.players[r]?.isBot && d.rolls[r] == null);
    if (unrolledBot && !botActionTimer) {
      scheduleBotDuelRoll();
    }
  } else if (d.settled && isResolver() && (st.players[st.currentTurn]?.isBot || (st.players[d.attacker]?.isBot && st.players[d.defender]?.isBot))) {
    if (!botActionTimer) {
      botActionTimer = setTimeout(() => {
        botActionTimer = null;
        if (monopolyState && monopolyState.activeDuel && monopolyState.activeDuel.settled) {
          finishDuel();
        }
      }, 2200);
    }
  }
}

function duelRoll(forRole) {
  const d = monopolyState.activeDuel;
  if (!d || d.settled || d.rolls[forRole] != null) return;
  const minRoll = perkOf(forRole).duelMinRoll || 1;
  let val = d6();
  if (val < minRoll) {
    val = Math.floor(Math.random() * (6 - minRoll + 1)) + minRoll;
    emitFx({ kind: 'moment', id: 'loaded_die', role: forRole, minRoll });
  }
  d.rolls[forRole] = val;
  AudioFX.playDiceTick();
  if (isResolver()) {
    trySettleDuel();
    pushState();
  } else {
    sendPick('duel', d.id, forRole, d.rolls[forRole]);
  }
  renderDuelOverlay();
  if (isResolver() && d && !d.settled) {
    const nextBot = [d.attacker, d.defender].find((r) => monopolyState.players[r]?.isBot && d.rolls[r] == null);
    if (nextBot) {
      scheduleBotDuelRoll();
    }
  }
}

function trySettleDuel() {
  const st = monopolyState;
  const d = st.activeDuel;
  if (!d || d.settled) return;
  const a = d.rolls[d.attacker];
  const b = d.rolls[d.defender];
  if (a == null || b == null) return;
  d.settled = true;
  const att = st.players[d.attacker];
  const def = st.players[d.defender];
  const tile = MONOPOLY_TILES[d.tileId];
  const tieWin = a === b && !!perkOf(d.attacker).duelTieWin;

  if (d.kind === 'cocktail') {
    if (a > b || tieWin) {
      d.result = 'win';
      d.paid = 0;
      const bounty = 50;
      chargePlayer(d.defender, bounty, d.attacker);
      AudioFX.playCheersClink();
      emitFx({ kind: 'coins', from: { role: d.defender }, to: { role: d.attacker }, amount: bounty });
      emitFx({ kind: 'moment', id: 'cocktail_win', text: 'Cheers! Free Rent +50🪙', delay: 800 });
      emitFx({ kind: 'float', tileId: d.tileId, text: '🍸 CHEERS! +50🪙', cls: 'pos fx-big' });
      announce(`🥂🎉 <strong>COCKTAIL CLASH VICTORY!</strong> ${att.name} rolled ${a} vs ${b}, wiped the ${fmt(d.rent)}🪙 rent, and won a 50🪙 drink bounty from ${def.name}!`);
    } else {
      d.result = 'lose';
      const lossRent = Math.round(d.rent * 1.5);
      const r = chargePlayer(d.attacker, lossRent, d.defender);
      d.paid = r.paid;
      d.sold = r.sold;
      st.stats.rentPaid[d.attacker] = (st.stats.rentPaid[d.attacker] || 0) + r.paid;
      AudioFX.playGlassShatter();
      emitFx({ kind: 'coins', from: { role: d.attacker }, to: { role: d.defender }, amount: r.paid, delay: 1100 });
      emitFx({ kind: 'float', tileId: d.tileId, text: `-${fmt(r.paid)} 🥴`, cls: 'neg fx-big' });
      emitFx({ kind: 'moment', id: 'cocktail_lose', text: '1.5× Hangover Rent!', delay: 800 });
      announce(`🥴💥 <strong>COCKTAIL CLASH HANGOVER!</strong> ${att.name} rolled ${a} vs ${b} and paid 1.5× rent (${fmt(r.paid)}🪙) to ${def.name}!${soldNote(d.sold)}`);
    }
    renderMonopolyBoard();
    updateMonopolyHUD();
    return;
  }

  if (d.kind === 'arena' && d.isHotelRaid) {
    if (a > b || tieWin) {
      d.result = 'win';
      d.paid = 0;
      if (st.properties[d.tileId]) {
        st.properties[d.tileId].level = 2;
        delete st.properties[d.tileId].hotel;
      }
      grantMiles(d.attacker, 150);
      AudioFX.playDiceImpact();
      emitFx({ kind: 'moment', id: 'hotel_raid_win', tileId: d.tileId, text: `${tile.name} Downgraded! +150🪙 Loot` });
      emitFx({ kind: 'float', tileId: d.tileId, text: '💣 DOWNGRADED +150🪙', cls: 'fx-big' });
      announce(`💣💥 <strong>HOTEL RAID SUCCESS!</strong> ${att.name} raided ${def.name}'s Grand Hotel at ${tile.name}, downgrading it to Level 2 and plundering <strong>+150🪙</strong>!`);
    } else {
      d.result = 'lose';
      d.paid = 0;
      emitFx({ kind: 'moment', id: 'hotel_raid_fail', text: tile.name, delay: 800 });
      announce(`🛡️ ${def.name} successfully protected their Grand Hotel at ${tile.name}! (${a} vs ${b})`);
    }
    renderMonopolyBoard();
    updateMonopolyHUD();
    return;
  }

  if ((a > b || tieWin) && st.properties[d.tileId] && st.properties[d.tileId].owner === d.defender) {
    d.result = 'win';
    const r = chargePlayer(d.attacker, d.price, d.defender);
    d.paid = r.paid;
    d.sold = r.sold;
    if (!r.bankrupt && st.properties[d.tileId]) st.properties[d.tileId].owner = d.attacker;
    st.stats.takeovers[d.attacker] = (st.stats.takeovers[d.attacker] || 0) + 1;
    if (def && def.isBot && att && !att.isBot) {
      st.stats.bounties = st.stats.bounties || { bkk: 0, dxb: 0 };
      st.stats.bounties[d.attacker] = (st.stats.bounties[d.attacker] || 0) + 100;
      emitFx({ kind: 'float', tileId: d.tileId, text: '💎 +100 BOUNTY!', cls: 'gold fx-big', delay: 400 });
      announce(`💥 <strong>BOUNTY CLAIMED!</strong> ${att.name} seized ${def.name}'s landmark! (+100💎 to Vault payout)`);
    }
    const hasMonacoDice = !!perkOf(d.attacker).duelMinRoll;
    if (hasMonacoDice) {
      emitFx({ kind: 'moment', id: 'monaco_takeover', tileId: d.tileId, text: tile.name, delay: 900 });
    } else {
      emitFx({ kind: 'moment', id: 'takeover_win', text: tile.name, delay: 900 });
    }
    emitFx({ kind: 'coins', from: { role: d.attacker }, to: { role: d.defender }, amount: r.paid, delay: 1100 });
    emitFx({ kind: 'float', tileId: d.tileId, text: '🏴 SEIZED', cls: 'fx-big' });
    announce(`🏴 <strong>${att.name} seized ${tile.name}</strong> from ${def.name}! (${a} vs ${b})${tieWin ? ' 🥊 Clinch — tie goes to the attacker!' : ''}`);
  } else {
    d.result = 'lose';
    if (d.kind === 'takeover') {
      const r = chargePlayer(d.attacker, d.rent * MONO_CFG.TAKEOVER_LOSE_MULT, d.defender);
      d.paid = r.paid;
      d.sold = r.sold;
      st.stats.rentPaid[d.attacker] = (st.stats.rentPaid[d.attacker] || 0) + r.paid;
      emitFx({ kind: 'coins', from: { role: d.attacker }, to: { role: d.defender }, amount: r.paid, delay: 1100 });
      emitFx({ kind: 'float', tileId: d.tileId, text: `-${fmt(r.paid)}`, cls: 'neg' });
    }
    emitFx({ kind: 'moment', id: 'takeover_fail', text: tile.name, delay: 900 });
    announce(`🛡️ ${def.name} defended ${tile.name}! (${a} vs ${b})`);
  }
  renderMonopolyBoard();
  updateMonopolyHUD();
}

function finishDuel() {
  if (!monopolyState.activeDuel) return;
  clearBotTimer();
  monopolyState.activeDuel = null;
  hideCardOverlay();
  finishTurn();
}

function applyRemotePick(msg) {
  const st = monopolyState;
  if (msg.target === 'duel_done') {
    if (st.activeDuel && st.activeDuel.id === msg.id && isResolver()) {
      finishDuel();
    }
    return;
  }
  const obj = msg.target === 'duel' ? st.activeDuel : st.activeChallenge;
  if (!obj || obj.id !== msg.id) {
    if (msg.state && mergeIncomingState(msg.state)) renderAll();
    return;
  }
  const bucket = msg.target === 'duel' ? obj.rolls : obj.picks;
  if (bucket[msg.role] == null) bucket[msg.role] = msg.value;
  if (isResolver()) {
    if (msg.target === 'duel') {
      trySettleDuel();
      if (!obj.settled) {
        const nextBot = [obj.attacker, obj.defender].find((r) => st.players[r]?.isBot && obj.rolls[r] == null);
        if (nextBot && !botActionTimer) scheduleBotDuelRoll();
      }
    } else {
      trySettleChallenge();
    }
    pushState();
  } else {
    saveLocalMonopolyState();
  }
  renderAll();
}

// =========================================================
// 21. SKY CASINO
// =========================================================
let casinoAnimateId = null;

function rollCasinoOutcome() {
  const pk = monopolyState && monopolyState.currentTurn;
  const isLoaded = pk && !!perkOf(pk).loadedSlots;

  let table = CASINO_TABLE;
  if (isLoaded) {
    // Loaded Reels: Skull curse eliminated (0%), Jackpot boosted to 20%, Cherries 35%, Item 25%, Pair 20%
    table = [
      { id: 'jackpot', p: 0.20, reels: ['💎', '💎', '💎'], label: 'JACKPOT! +1,000 🪙 (Loaded Reels 💎)', miles: 1000 },
      { id: 'cherries', p: 0.35, reels: ['🍒', '🍒', '🍒'], label: 'Triple cherries! +300 🪙 (Loaded Reels 🍒)', miles: 300 },
      { id: 'item', p: 0.25, reels: ['🎒', '🎒', '🎒'], label: 'Free sabotage item! 🎒', item: true },
      { id: 'pair', p: 0.20, label: 'Two of a kind — bet back (+100 🪙)', miles: 100 },
      { id: 'nothing', p: 0.00, label: 'No luck this time…', miles: 0 }
    ];
  }

  let x = Math.random();
  let out = table[table.length - 1];
  for (const row of table) {
    if (x < row.p) { out = row; break; }
    x -= row.p;
  }
  let reels = out.reels;
  if (out.id === 'pair') {
    const pool = ['🍒', '🍋', '⭐', '🔔'];
    const s = pool[Math.floor(Math.random() * pool.length)];
    const t = pool.filter((v) => v !== s)[Math.floor(Math.random() * (pool.length - 1))];
    reels = shuffleArray([s, s, t]);
  } else if (out.id === 'nothing') {
    reels = shuffleArray(['🍒', '🍋', '⭐', '🔔']).slice(0, 3);
  }
  return { ...out, reels };
}

function reelsHtml(reels, spinning) {
  return window.MonoFX
    ? MonoFX.slot.html(reels)
    : `<div class="slot-machine ${spinning ? 'spinning' : ''}">${reels.map((s, i) => `<div class="slot-reel" id="slotReel${i}">${s}</div>`).join('')}</div>`;
}

function animateReels(finalReels, onDone) {
  if (window.MonoFX) { MonoFX.slot.spin(finalReels, onDone); return; }
  const started = Date.now();
  const stopAt = [700, 1050, 1400];
  clearInterval(casinoAnimateId);
  casinoAnimateId = setInterval(() => {
    const t = Date.now() - started;
    for (let i = 0; i < 3; i++) {
      const el = $m(`slotReel${i}`);
      if (!el) continue;
      if (t < stopAt[i]) {
        el.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
      } else if (!el.dataset.stopped) {
        el.dataset.stopped = '1';
        el.textContent = finalReels[i];
        el.classList.add('stopped');
        AudioFX.playDiceTick();
      }
    }
    if (t >= stopAt[2] + 100) {
      clearInterval(casinoAnimateId);
      if (onDone) onDone();
    }
  }, 70);
}

function casinoOutcomeSound(outcome) {
  if (outcome === 'jackpot') AudioFX.playJackpot();
  else if (outcome === 'cherries' || outcome === 'item') AudioFX.playItem();
  else if (outcome === 'skull' || outcome === 'nothing') AudioFX.playMiss();
  else AudioFX.playCoin();
}

function casinoOutcomeFx(outcome, role) {
  const FX = window.MonoFX;
  if (!FX) return;
  const m = document.getElementById('slotMachine');
  if (outcome === 'jackpot') FX.moment('jackpot', { role });
  else if (outcome === 'cherries') { FX.coins({ from: { machine: true }, to: { role }, amount: 300 }); const p = FX.point({ machine: true }); FX.burst({ x: p.x, y: p.y, count: 8, spread: 90, gravity: 80, life: 700 }); }
  else if (outcome === 'item') FX.flyIcon({ from: { machine: true }, to: { role }, name: 'slot_bag' });
  else if (outcome === 'pair') FX.coins({ from: { machine: true }, to: { role }, amount: 100 });
  else if (outcome === 'skull') { FX.flash('rgba(220,38,38,0.35)', 350); FX.shake('light'); FX.coins({ from: { role }, to: { machine: true }, amount: 200 }); }
  else if (outcome === 'nothing' && m) m.classList.add('dim');
}

function renderCasinoModal(d, key) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const bet = MONO_CFG.CASINO_BET;

  if (d.phase === 'offer') {
    const can = p.miles >= bet;
    showModal(key, `
      <div class="property-card casino-card">
        <span class="card-badge gold">🎰 SKY CASINO</span>
        ${reelsHtml(window.MonoFX ? MonoFX.slot.randomReels() : ['🎰', '🎰', '🎰'], false)}
        <div class="casino-paytable">
          <span>💎💎💎 +1,000</span><span>🍒🍒🍒 +300</span><span>🎒🎒🎒 free item</span>
          <span>Pair: bet back</span><span>💀💀💀 −200 more</span>
        </div>
        <div class="card-actions">
          <button class="btn-buy-prop casino-spin" data-act="spin" ${can ? '' : 'disabled'}>${can ? `Pull the lever (${bet}🪙)` : 'Not enough miles'}</button>
          <button class="btn-pass-prop" data-act="leave">Walk away ➡️</button>
        </div>
      </div>
    `, (ov) => {
      onTap(ov, '[data-act="spin"]', () => actSpinCasino(d.tileId));
      onTap(ov, '[data-act="leave"]', () => actLeaveCasino());
    });
    return;
  }

  // Result phase (spin locally the first time, then reveal)
  const animate = !!d.animate;
  d.animate = false;
  showModal(key, `
    <div class="property-card casino-card">
      <span class="card-badge gold">🎰 SKY CASINO</span>
      ${reelsHtml(animate ? ['❔', '❔', '❔'] : d.reels, animate)}
      <div class="casino-result ${animate ? 'hidden' : ''}" id="casinoResult">${d.label}</div>
      <div class="card-actions">
        <button class="btn-balance-done ${animate ? 'hidden' : ''}" data-act="continue" id="casinoContinue">Continue ✈️</button>
      </div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-act="continue"]', () => actContinueCasino());
    if (animate) {
      animateReels(d.reels, () => {
        const res = $m('casinoResult');
        const btn = $m('casinoContinue');
        if (res) res.classList.remove('hidden');
        if (btn) btn.classList.remove('hidden');
        casinoOutcomeSound(d.outcome);
        casinoOutcomeFx(d.outcome, monopolyState.currentTurn);
        setMonopolyTicker(`🎰 ${d.reels.join('')} — ${d.label}`);
        updateMonopolyHUD();
      });
    }
  });
}

function showCasinoSpectator(reels, label, outcome) {
  if (currentModalKey && !currentModalKey.startsWith('spectator')) return;
  const name = monopolyState.players[monopolyState.currentTurn].name;
  showModal('spectator:casino', `
    <div class="property-card casino-card spectator">
      <span class="card-badge gold">🎰 ${name.toUpperCase()} IS SPINNING</span>
      ${reelsHtml(['❔', '❔', '❔'], true)}
      <div class="casino-result hidden" id="casinoResult">${label}</div>
    </div>
  `);
  animateReels(reels, () => {
    const res = $m('casinoResult');
    if (res) res.classList.remove('hidden');
    casinoOutcomeSound(outcome);
    casinoOutcomeFx(outcome, monopolyState.currentTurn);
    setTimeout(() => { if (currentModalKey === 'spectator:casino') hideModal(); }, 2000);
  });
}

// =========================================================
// 22. BLACK MARKET & ARENA
// =========================================================
function renderMarketModal(d, key) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const full = (p.inventory || []).length >= MONO_CFG.MAX_ITEMS;

  showModal(key, `
    <div class="property-card market-card">
      <span class="card-badge">🎒 BLACK MARKET · ${(p.inventory || []).length}/${MONO_CFG.MAX_ITEMS} SLOTS</span>
      <p class="card-desc">Buy one item. You have <strong>${fmt(p.miles)}🪙</strong>.</p>
      <div class="market-list">
        ${d.offers.map((id) => {
          const it = ITEMS[id];
          const price = marketPrice(pk, id);
          const can = !full && p.miles >= price;
          return `<button class="market-item" data-item="${id}" ${can ? '' : 'disabled'}>
            <span class="mi-icon">${it.icon}</span>
            <span class="mi-body"><strong>${it.name}</strong><em>${it.desc}</em></span>
            <span class="mi-price">${price < it.price ? `<s style="opacity:.55">${it.price}</s> 🏮` : ''}${price}🪙</span>
          </button>`;
        }).join('')}
      </div>
      ${full ? '<div class="card-warning">Your bag is full (2/2). Use an item first.</div>' : ''}
      <div class="card-actions"><button class="btn-pass-prop" data-act="leave">Leave ➡️</button></div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-item]', (btn) => actBuyMarketItem(btn.dataset.item, d.tileId));
    onTap(ov, '[data-act="leave"]', () => actLeaveMarket());
  });
}

function renderArenaModal(d, key) {
  const st = monopolyState;
  const pk = st.currentTurn;
  const p = st.players[pk];
  const targets = Object.keys(st.properties || {})
    .map(Number)
    .filter((id) => {
      const prop = st.properties[id];
      return prop && prop.owner !== pk && !st.players[prop.owner]?.bankrupt;
    })
    .sort((a, b) => {
      const aHotel = (st.properties[a].level >= 3 || st.properties[a].hotel) ? 1 : 0;
      const bHotel = (st.properties[b].level >= 3 || st.properties[b].hotel) ? 1 : 0;
      if (bHotel !== aHotel) return bHotel - aHotel;
      return propValue(b) - propValue(a);
    });

  showModal(key, `
    <div class="property-card arena-card">
      <span class="card-badge pink">⚔️ TAKEOVER ARENA</span>
      <p class="card-desc">Free duel! Pick any rival's property or Grand Hotel. Win the roll-off to buy properties or <strong>Raid Hotels</strong> (downgrade to Lvl 2 + plunder +150🪙)!</p>
      <div class="market-list">
        ${targets.map((id) => {
          const t = MONOPOLY_TILES[id];
          const prop = st.properties[id];
          const owner = st.players[prop.owner];
          const isHotel = prop.level >= 3 || prop.hotel;
          const v = isHotel ? 0 : propValue(id);
          const can = isHotel || p.miles >= v;
          const ownerTag = owner ? `<span class="arena-owner-chip"><img src="${owner.sprite}" class="mini-thumb" alt="" /> ${owner.name}</span>` : '';
          const subtitle = isHotel ? '💣 Hotel Raid · Downgrade + plunder 150🪙' : `${'🏠'.repeat(prop.level)} · rent ${fmt(getTileRent(id))}🪙`;
          const priceBadge = isHotel ? '<span class="mi-price raid-free">FREE RAID</span>' : `<span class="mi-price">${fmt(v)}🪙</span>`;
          return `<button class="market-item ${isHotel ? 'market-item-raid' : ''}" data-tile="${id}" ${can ? '' : 'disabled'}>
            <span class="mi-icon">${isHotel ? '🏨' : t.icon}</span>
            <span class="mi-body">
              <strong>${t.name} ${ownerTag}</strong>
              <em>${subtitle}</em>
            </span>
            ${priceBadge}
          </button>`;
        }).join('')}
      </div>
      <div class="card-actions"><button class="btn-pass-prop" data-act="skip">Skip ➡️</button></div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-tile]', (btn) => actChallengeArena(Number(btn.dataset.tile)));
    onTap(ov, '[data-act="skip"]', () => actSkipArena());
  });
}

// =========================================================
// 23. SABOTAGE ITEM USE (BEFORE ROLLING)
// =========================================================
function openItemInfo(slotIndex) {
  const st = monopolyState;
  const me = getMonopolyMyRole();
  const id = (st.players[me].inventory || [])[slotIndex];
  if (!id || !ITEMS[id]) {
    setMonopolyTicker('🎒 Empty slot. Get items at the 🎒 Black Market, 🪂 Airdrop, or 🎰 Casino.');
    return;
  }
  if (currentModalKey && currentModalKey.startsWith('decision:')) return;
  const it = ITEMS[id];
  const usable = canUseItemsNow() && id !== 'shield';
  const why = id === 'shield' ? 'Use it from the rent screen when rent is due.' : !usable ? 'Use items on your turn, before you roll.' : '';
  showModal('local:item', `
    <div class="property-card item-card">
      <div class="item-big">${it.icon}</div>
      <h3 class="card-title">${it.name}</h3>
      <p class="card-desc">${it.desc}</p>
      ${why ? `<div class="card-hint">${why}</div>` : ''}
      <div class="card-actions">
        ${usable ? '<button class="btn-buy-prop" data-act="use">Use now</button>' : ''}
        <button class="btn-pass-prop" data-act="close">Close</button>
      </div>
    </div>
  `, (ov) => {
    onTap(ov, '[data-act="use"]', () => useItem(id));
    onTap(ov, '[data-act="close"]', () => hideModal());
  });
}

function useItem(id) {
  const st = monopolyState;
  const me = getMonopolyMyRole();
  const opp = otherRole(me);
  const p = st.players[me];
  if (!canUseItemsNow()) { hideModal(); return; }

  if (id === 'banana') {
    consumeItem(me, 'banana');
    hideModal();
    st.bananaTraps = st.bananaTraps || {};
    st.bananaTraps[p.pos] = (st.bananaTraps[p.pos] || 0) + 1;
    AudioFX.playBananaSlip();
    emitFx({ kind: 'moment', id: 'banana_peel_trap', role: me, tileId: p.pos, text: '🍌 Banana Trap Set!' });
    floatText(p.pos, '🍌 TRAP SET!', 'pos');
    announce(`🍌🤡 <strong>BANANA PEEL PLANTED!</strong> ${p.name} dropped a slippery banana peel on <strong>${MONOPOLY_TILES[p.pos].name}</strong>! Watch your step!`);
    pushState();
    renderAll();
    return;
  }

  if (id === 'golden_dice') {
    showModal('local:dice', `
      <div class="property-card item-card">
        <div class="item-big">🎲</div>
        <h3 class="card-title">Pick your roll</h3>
        <div class="golden-dice-grid">${[1, 2, 3, 4, 5, 6].map((n) => {
          const dest = MONOPOLY_TILES[(p.pos + n) % MONOPOLY_TILES.length];
          return `<button class="golden-die" data-n="${n}"><strong>${n}</strong><em>${dest.icon} ${dest.shortName}</em></button>`;
        }).join('')}</div>
        <div class="card-actions"><button class="btn-pass-prop" data-act="close">Cancel</button></div>
      </div>
    `, (ov) => {
      onTap(ov, '[data-n]', (btn) => {
        consumeItem(me, 'golden_dice');
        hideModal();
        startRoll(Number(btn.dataset.n), true);
      });
      onTap(ov, '[data-act="close"]', () => hideModal());
    });
    return;
  }

  if (id === 'c4') {
    const targets = Object.keys(st.properties || {})
      .map(Number)
      .filter((tid) => {
        const prop = st.properties[tid];
        return prop && prop.owner !== me && !st.players[prop.owner]?.bankrupt && prop.level >= 2;
      })
      .sort((a, b) => (st.properties[b].level - st.properties[a].level) || (propValue(b) - propValue(a)));

    showModal('local:c4', `
      <div class="property-card item-card">
        <div class="item-big">💣</div>
        <h3 class="card-title">Choose a target</h3>
        ${targets.length ? '' : '<div class="card-warning">No targets yet — C4 needs an opponent tile with 🏠🏠 or 🏨.</div>'}
        <div class="market-list">
          ${targets.map((tid) => {
            const t = MONOPOLY_TILES[tid];
            const prop = st.properties[tid];
            const lvl = prop.level;
            const ownerP = st.players[prop.owner];
            const ownerTag = ownerP ? `<span class="arena-owner-chip"><img src="${ownerP.sprite}" class="mini-thumb" alt="" /> ${ownerP.name}</span>` : '';
            return `<button class="market-item" data-tile="${tid}">
              <span class="mi-icon">${t.icon}</span>
              <span class="mi-body">
                <strong>${t.name} ${ownerTag}</strong>
                <em>${lvl >= 3 ? '🏨 Hotel' : '🏠🏠'} · rent ${fmt(getTileRent(tid))}🪙 → ${fmt(getTileRent(tid, 1))}🪙</em>
              </span>
              <span class="mi-price">💥</span>
            </button>`;
          }).join('')}
        </div>
        <div class="card-actions"><button class="btn-pass-prop" data-act="close">Cancel</button></div>
      </div>
    `, (ov) => {
      onTap(ov, '[data-tile]', (btn) => {
        const tid = Number(btn.dataset.tile);
        const prop = st.properties[tid];
        const propOwner = prop?.owner;
        const targetPlayer = st.players[propOwner] || st.players[opp];
        if (isNagaWarden(propOwner)) {
          consumeItem(me, 'c4');
          AudioFX.playNagaGong();
          emitFx({ kind: 'float', tileId: tid, text: '🐉 WARDED!', cls: 'neg' });
          announce(`🐉🛡️ <strong>MEKONG RIVER WARD!</strong> ${targetPlayer.name}'s property is warded by sacred serpent coils! The C4 was absorbed!`);
          hideModal();
          pushState();
          renderAll();
          return;
        }
        if (prop && prop.shield > 0) {
          consumeItem(me, 'c4');
          prop.shield -= 1;
          const left = prop.shield;
          if (left <= 0) delete prop.shield;
          AudioFX.playAstralImpact();
          emitFx({ kind: 'float', tileId: tid, text: `🪐 SHIELD DEFLECTED! (${left} left)`, cls: 'pos' });
          announce(`🪐🛡️ <strong>CELESTIAL SHIELD DEFLECTED!</strong> ${targetPlayer.name}'s cosmic shield deflected the C4 blast! (${left} shield charges remaining)`);
          hideModal();
          renderAll();
          pushState();
          return;
        }
        if (prop && prop.waterShield) {
          consumeItem(me, 'c4');
          delete prop.waterShield;
          AudioFX.playAbyssalSplash();
          emitFx({ kind: 'float', tileId: tid, text: '🌊 WATER SHIELD DEFLECTED!', cls: 'pos' });
          announce(`🌊🛡️ <strong>LOTUS WATER SHIELD DEFLECTED!</strong> ${targetPlayer.name}'s water shield neutralized the C4 explosion!`);
          hideModal();
          renderAll();
          pushState();
          return;
        }
        consumeItem(me, 'c4');
        st.properties[tid].level = 1;
        if (targetPlayer?.isBot && !st.players[me]?.isBot) {
          st.stats.bounties = st.stats.bounties || { bkk: 0, dxb: 0 };
          st.stats.bounties[me] = (st.stats.bounties[me] || 0) + 100;
          emitFx({ kind: 'float', tileId: tid, text: '💣 +100💎 BOUNTY!', cls: 'gold fx-big', delay: 400 });
          announce(`💥 <strong>DEMOLITION BOUNTY!</strong> ${p.name} obliterated ${targetPlayer.name}'s landmark! (+100💎 to Vault)`);
        }
        hideModal();
        renderMonopolyBoard();
        emitFx({ kind: 'moment', id: 'c4', tileId: tid, text: MONOPOLY_TILES[tid].name });
        announce(`💣 <strong>BOOM!</strong> ${p.name} blew up ${targetPlayer.name}'s ${MONOPOLY_TILES[tid].name} back to a single house!`);
        pushState();
        renderAll();
      });
      onTap(ov, '[data-act="close"]', () => hideModal());
    });
    return;
  }

  if (id === 'magnet') {
    consumeItem(me, 'magnet');
    const activeOpps = Object.keys(st.players || {}).filter((r) => r !== me && !st.players[r]?.bankrupt);
    const targetRole = activeOpps.reduce((best, r) => {
      if (!best) return r;
      return (st.players[r].miles || 0) > (st.players[best].miles || 0) ? r : best;
    }, activeOpps[0]);
    const targetPlayer = st.players[targetRole] || st.players[opp];
    const targetMiles = Math.max(0, targetPlayer ? targetPlayer.miles : 0);
    const steal = Math.round(targetMiles * (MONO_CFG.MAGNET_RATE || 0.25));
    if (steal > 0 && targetPlayer) {
      targetPlayer.miles -= steal;
      st.players[me].miles += steal;
    }
    hideModal();
    emitFx({ kind: 'sound', name: 'item' });
    if (targetPlayer) emitFx({ kind: 'float', tileId: targetPlayer.pos, text: steal > 0 ? `🧲 -${fmt(steal)}` : '🧲 0', cls: 'fx-big fx-loss' });
    emitFx({ kind: 'float', tileId: st.players[me].pos, text: steal > 0 ? `🧲 +${fmt(steal)}` : '🧲 0', cls: 'fx-big fx-gain' });
    if (steal > 0 && targetRole) {
      emitFx({ kind: 'coins', from: { role: targetRole }, to: { role: me }, amount: steal });
      announce(`🧲 <strong>MAGNET ACTIVATED!</strong> ${p.name} targeted the richest rival (<strong>${targetPlayer.name}</strong>) and siphoned 25% (<strong>${fmt(steal)} 🪙</strong>)!`);
    } else {
      announce(`🧲 ${p.name} activated a <strong>Magnet</strong>, but rivals have 0 🪙 to siphon!`);
    }
    pushState();
    renderAll();
    return;
  }

  if (id === 'swap') {
    const activeOpps = Object.keys(st.players || {}).filter((r) => r !== me && !st.players[r]?.bankrupt);
    if (!activeOpps.length) { hideModal(); return; }

    const doSwap = (targetRole) => {
      consumeItem(me, 'swap');
      const targetPlayer = st.players[targetRole];
      const tmp = p.pos;
      p.pos = targetPlayer.pos;
      targetPlayer.pos = tmp;
      hideModal();
      emitFx({ kind: 'swap' });
      announce(`🌀 ${p.name} opened a <strong>Swap Portal</strong> and traded places with ${targetPlayer.name}!`);
      pushState();
      renderAll();
    };

    if (activeOpps.length === 1) {
      doSwap(activeOpps[0]);
      return;
    }

    // In 3P or 4P, allow player to choose which rival's seat to swap with
    showModal('local:swap', `
      <div class="property-card item-card">
        <div class="item-big">🌀</div>
        <h3 class="card-title">Choose seat to swap</h3>
        <p class="card-desc">Trade board positions with any rival.</p>
        <div class="market-list">
          ${activeOpps.map((r) => {
            const oppP = st.players[r];
            const destTile = MONOPOLY_TILES[oppP.pos];
            return `<button class="market-item" data-swap-target="${r}">
              <img src="${oppP.sprite}" class="mini-thumb" alt="" />
              <span class="mi-body">
                <strong>${oppP.name}</strong>
                <em>Tile ${oppP.pos}: ${destTile.icon} ${destTile.name}</em>
              </span>
              <span class="mi-price">🔄</span>
            </button>`;
          }).join('')}
        </div>
        <div class="card-actions"><button class="btn-pass-prop" data-act="close">Cancel</button></div>
      </div>
    `, (ov) => {
      onTap(ov, '[data-swap-target]', (btn) => doSwap(btn.dataset.swapTarget));
      onTap(ov, '[data-act="close"]', () => hideModal());
    });
    return;
  }
}

// =========================================================
// 24. VICTORY CEREMONY & RULES
// =========================================================
function hideVictory() {
  clearTimeout(renderVictory._timer);
  renderVictory._timer = null;
  const ov = $m('monopolyVictoryOverlay');
  if (ov) {
    ov.classList.remove('active');
    ov.style.display = 'none';
    ov.innerHTML = '';
    delete ov.dataset.key;
  }
}

function renderVictory() {
  if (currentModalKey === 'local:mode-picker') {
    return;
  }
  if (window.MonoFX && MonoFX.busy() && (renderVictory._waited || 0) < 2500) {
    renderVictory._waited = (renderVictory._waited || 0) + 200;
    renderVictory._timer = setTimeout(() => { if (monopolyState.gameOver && currentModalKey !== 'local:mode-picker') renderVictory(); }, 200);
    return;
  }
  renderVictory._waited = 0;
  const st = monopolyState;
  const g = st.gameOver;
  const ov = $m('monopolyVictoryOverlay');
  if (!g || !ov) return;
  if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') window.SkyPixi.clearAll();
  ov.style.display = '';
  if (ov.dataset.key === String(g.at) && ov.classList.contains('active')) return;
  ov.dataset.key = String(g.at);

  // 🧹 Auto-terminate & clear active room session so client and server have a clean slate:
  if (currentFlightRoom) {
    const finishedRoomId = currentFlightRoom.id || currentFlightRoom.roomId;
    if (typeof sendSignaling === 'function') {
      sendSignaling({ type: 'room_match_finished', roomId: finishedRoomId });
    }
    currentFlightRoom = null;
    currentFlightRoomIsHost = false;
    currentFlightRoomSlot = null;
  }
  sessionStorage.removeItem('neora_active_room_id');
  localStorage.removeItem('nook_sky_monopoly_room_v1');

  const isSpectator = !!isSpectatorMode || getMonopolyMyRole() === 'spectator';
  const meRole = isSpectator ? 'spectator' : getMonopolyMyRole();
  const isBot = st.mode === 'bot';
  const winner = (g.winner && g.winner !== 'draw') ? st.players[g.winner] : null;
  const isDraw = g.winner === 'draw' || g.reason === 'draw' || !winner;
  const iWon = !isSpectator && g.winner === meRole;

  // Reason text
  const bankruptP = g.bankruptRole ? st.players[g.bankruptRole] : (g.reason === 'bankrupt' ? Object.values(st.players || {}).find((p) => p.bankrupt) : null);
  const reasonText = {
    bankrupt: bankruptP ? `${bankruptP.name} was bankrupted!` : 'Rival Bankrupted!',
    target: `Reached ${fmt(MONO_CFG.WIN_NET_WORTH)} net worth!`,
    cap: `Richest after ${MONO_CFG.MAX_ROUNDS} flight rounds`,
    draw: `Perfect draw after ${MONO_CFG.MAX_ROUNDS} flight rounds`
  }[g.reason] || '';

  const s = st.stats || { matches: 0, misses: 0, takeovers: {}, rentPaid: {}, jackpots: 0, itemsUsed: 0 };

  // Rank all active players by net worth (non-bankrupt first)
  const allRoles = Object.keys(st.players || {});
  const ranked = [...allRoles].sort((a, b) => {
    const pA = st.players[a];
    const pB = st.players[b];
    if (pA?.bankrupt && !pB?.bankrupt) return 1;
    if (!pA?.bankrupt && pB?.bankrupt) return -1;
    const nwA = (g.netWorth && g.netWorth[a]) != null ? g.netWorth[a] : netWorth(a);
    const nwB = (g.netWorth && g.netWorth[b]) != null ? g.netWorth[b] : netWorth(b);
    return nwB - nwA;
  });
  const placements = winner ? [g.winner, ...ranked.filter((r) => r !== g.winner)] : ranked;

  // 💎 Vault reward calculation
  const C = window.NookCostumes;
  const is4p = st.mode === '4p' || allRoles.length > 2;
  const tierKey = C && C.getPartyThreatTier ? C.getPartyThreatTier(st.players) : (is4p ? 'extreme' : 'couple');
  const payouts = (!isSpectator && C && C.computePartyPayouts) ? C.computePartyPayouts(tierKey, placements, s.matches, st.stats?.bounties) : null;
  const myPayout = payouts && payouts[meRole];

  let estDiamonds = myPayout ? myPayout.total : 0;
  let diamondsSubtitle = '';

  if (isSpectator) {
    estDiamonds = 0;
    diamondsSubtitle = '👁️ Spectator Deck · Live Flight Observation';
  } else if (isBot) {
    const bLevel = st.bot?.level || 'hard';
    if (bLevel === 'insane') {
      estDiamonds = iWon ? 950 : 50;
      diamondsSubtitle = iWon ? '⚡ Apex Victory! +950💎 banked' : '💀 Defeated by Apex Sovereign (+50💎 rebate)';
    } else if (bLevel === 'hard') {
      estDiamonds = iWon ? 450 : 0;
      diamondsSubtitle = iWon ? '🔥 Hard Victory! +450💎 banked' : '💀 Defeated by Captain Whiskers (100💎 stake lost)';
    } else {
      estDiamonds = iWon ? 80 : 30;
      diamondsSubtitle = iWon ? '🐣 Easy Victory! +80💎 banked' : '🐣 Good game! +30💎 consolation banked';
    }
  } else if (myPayout) {
    diamondsSubtitle = myPayout.won ? '🏆 Squadron Ace Victory · Banked to Vault' : `Rank #${myPayout.rank || 2} · Banked to Vault`;
  }

  // Diamond Banner Component (Properly inserted into DOM with #victoryDiamonds)
  const diamondsHtml = isSpectator ? `
    <div class="victory-diamonds spectator-deck" id="victoryDiamonds">
      <span class="vd-gem">👁️</span>
      <div class="vd-info">
        <b>SPECTATING COMPLETE</b>
        <small>Flight observation completed · 0💎</small>
      </div>
    </div>
  ` : `
    <div class="victory-diamonds ${estDiamonds === 0 && isBot ? 'lost-stake' : ''}" id="victoryDiamonds">
      <span class="vd-gem">${isBot && !iWon && (st.bot?.level !== 'easy') ? '💔' : '💎'}</span>
      <div class="vd-info">
        <b>${estDiamonds > 0 ? `+${fmt(estDiamonds)}` : '0💎'}</b>
        <small>${diamondsSubtitle}</small>
      </div>
    </div>
  `;

  // Server Reporting
  if (!g._reported && !isSpectator) {
    g._reported = true;
    saveLocalMonopolyState();
    if (isBot) {
      if (typeof sendSignaling === 'function') {
        sendSignaling({
          type: 'vault_bot_finish',
          sessionId: st.bot?.sessionId,
          winner: iWon ? 'me' : (g.winner ? 'bot' : 'draw'),
          rounds: g.round || 1,
          reason: g.reason || 'nw',
          elapsedMs: Date.now() - (st.bot?.startedAt || Date.now()),
          reqId: Date.now().toString(36)
        });
      }
    } else if (typeof sendSignaling === 'function') {
      sendSignaling({
        type: 'vault_award',
        gameKey: `${st.gameId || 'g'}-${g.at}`,
        winner: g.winner || 'draw',
        matches: s.matches || 0,
        partyData: {
          mode: st.mode,
          players: Object.keys(st.players || {}).map((k) => ({
            role: k,
            name: st.players[k]?.name || k,
            isBot: !!st.players[k]?.isBot,
            botLevel: st.players[k]?.botLevel || 'hard',
            netWorth: (g.netWorth && g.netWorth[k]) || 0
          })),
          placements,
          bounties: st.stats?.bounties || { bkk: 0, dxb: 0 },
          botConfig: {
            bot1: st.players.bot1 ? st.players.bot1.botLevel : 'closed',
            bot2: st.players.bot2 ? st.players.bot2.botLevel : 'closed'
          }
        }
      });
    }
  }

  const confetti = Array.from({ length: 36 }, (_, i) => {
    const e = ['✈️', '✨', '🪙', '💖', '👑', '🎊'][i % 6];
    return `<span class="confetti" style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 1.5).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 1.6).toFixed(2)}s">${e}</span>`;
  }).join('');

  // Safe Stats Aggregator (Supports 2P, 3P, 4P + Bots)
  const totalRent = Object.values(s.rentPaid || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalTakeovers = Object.values(s.takeovers || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const statsHtml = `
    <span>🎲 Flight Rounds <strong>${g.round} / ${MONO_CFG.MAX_ROUNDS}</strong></span>
    <span>🪙 Total Rent Flow <strong>${fmt(totalRent)}</strong></span>
    <span>⚔️ Zone Takeovers <strong>${totalTakeovers}</strong></span>
    <span>💎 Jackpots Hit <strong>${s.jackpots || 0}</strong></span>
    <span>🎒 Gadgets Used <strong>${s.itemsUsed || 0}</strong></span>
    <span>💞 Vibe Chemistry <strong>${s.matches || 0}</strong></span>
  `;

  const threatBadgeHtml = `
    <div class="victory-threat-badge ${tierKey === 'extreme' ? 'extreme' : tierKey === 'high' ? 'high' : 'standard'}">
      ${tierKey === 'extreme' ? '🔥 EXTREME THREAT · 2 HARD BOTS CLEARED' : tierKey === 'high' ? '⚔️ HIGH THREAT DEFEATED' : tierKey === 'standard' ? '🛫 4-PLAYER FLIGHT COMPLETE' : tierKey.includes('3p') ? '✈️ 3-PLAYER SQUADRON VICTORY' : '✈️ FIRST-CLASS COUPLE DUEL'}
    </div>`;

  // NEORA Premium Placement Podium Cards
  const placementsHtml = `
    <div class="victory-placements neora-victory-podium" id="victoryPlacements">
      ${placements.map((r, idx) => {
        const pl = st.players[r];
        const isHuman = !pl?.isBot;
        const isSelf = (r === meRole);
        const nw = (g.netWorth && g.netWorth[r]) != null ? g.netWorth[r] : netWorth(r);
        const medal = isDraw ? '🤝' : (idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎗️');
        const rankClass = isDraw ? 'rank-draw' : (idx === 0 ? 'rank-gold place-first' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : 'rank-crew');
        const rankTitle = isDraw ? 'TIED CREW' : (idx === 0 ? 'SQUADRON ACE' : idx === 1 ? 'CO-PILOT' : idx === 2 ? 'FLIGHT CREW' : 'PASSENGER');

        return `
          <div class="place-row neora-podium-card ${rankClass} ${isHuman ? 'human-row' : 'bot-row'} ${isSelf ? 'is-self me-row' : ''}">
            <span class="place-medal podium-rank-badge">${medal}</span>
            <div class="place-avatar-wrap podium-avatar-wrap">
              <img src="${pl?.sprite || ''}" class="place-sprite podium-avatar-img" alt="" />
              ${idx === 0 && !isDraw ? '<span class="podium-crown-halo">👑</span>' : ''}
            </div>
            <div class="place-info podium-player-details">
              <div class="place-name-line podium-name-row">
                <b class="place-name podium-player-name">${pl?.name || r}</b>
                ${isSelf ? '<span class="place-you-pill podium-you-pill">YOU</span>' : ''}
                <span class="place-rank-badge podium-rank-title ${idx === 0 && !isDraw ? 'gold' : ''}">${rankTitle}</span>
              </div>
              <div class="place-meta podium-score-row">
                ${pl?.bankrupt
                  ? '<span class="place-bankrupt-tag podium-bankrupt-tag">💀 Bankrupt</span>'
                  : `<span class="place-nw-tag podium-nw-badge">💰 ${fmt(nw)} NW</span><span class="podium-miles-badge">🪙 ${fmt(pl?.miles || 0)}</span>`
                }
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

  // Dopamine Payout Terminal & Loot Box
  const lootBoxHtml = `
    <div class="victory-loot-box neora-payout-terminal" id="victoryLootBox">
      <div class="victory-loot-header payout-terminal-header">
        <span class="victory-loot-title payout-terminal-title">✨ ${isSpectator ? 'Flight Crew Payout Breakdown' : 'First-Class Flight Settlement'}</span>
        ${myPayout?.syndicate > 0 ? `<span class="syndicate-dividend-badge">🤝 +${myPayout.syndicate}💎 Syndicate</span>` : ''}
        <button class="btn-vault-mini" id="btnOpenVaultMini">🎰 Vault Gacha ➜</button>
      </div>
      ${diamondsHtml}
      <div class="victory-loot-chips payout-chips-grid">
        <div class="loot-chip diamonds">💎 <b>+${fmt(myPayout ? myPayout.total : estDiamonds)}</b> Diamonds</div>
        ${myPayout?.tickets > 0 ? `<div class="loot-chip tickets">🎟️ <b>+${myPayout.tickets}</b> Lucky Ticket${myPayout.tickets > 1 ? 's' : ''}</div>` : ''}
        ${myPayout?.fish > 0 ? `<div class="loot-chip salmon">🐟 <b>+${myPayout.fish}</b> King Salmon</div>` : ''}
        ${myPayout?.stardust > 0 ? `<div class="loot-chip stardust">✨ <b>+${myPayout.stardust}</b> Stardust</div>` : ''}
        ${myPayout?.bounty > 0 ? `<div class="loot-chip bounty">💥 <b>+${myPayout.bounty}</b> Demolition Bounty</div>` : ''}
        ${myPayout?.syndicate > 0 ? `<div class="loot-chip syndicate">🤝 <b>+${myPayout.syndicate}💎</b> Syndicate</div>` : ''}
        ${s.matches > 0 ? `<div class="loot-chip vibes" style="background:rgba(236,72,153,0.25);border-color:rgba(244,114,182,0.5);color:#fbcfe8;">💞 <b>${s.matches}</b> Vibe Chemistry</div>` : ''}
        <div class="loot-chip xp">📈 <b>+${isSpectator ? '50' : '150'}</b> Flight EXP</div>
      </div>
      <div class="payout-daily-quest-note">📋 Daily Flight Log: +1 Monopoly Game Completed</div>
    </div>`;

  // Modern Ergonomic 2-Tier Navigation Dock
  let actionsHtml = '';
  if (isSpectator) {
    actionsHtml = `
      <div class="neora-victory-dock neora-action-dock">
        <div class="dock-primary-row single-btn">
          <button class="neora-btn-primary" data-act="mode">
            <span class="btn-icon">🏛️</span>
            <span class="btn-text">RETURN TO DEPARTURES</span>
          </button>
        </div>
        <div class="dock-secondary-row single-btn">
          <button class="neora-btn-exit neora-btn-tertiary" data-act="close">
            <span class="btn-icon">✕</span>
            <span class="btn-text">LEAVE MATCH</span>
          </button>
        </div>
      </div>
    `;
  } else {
    const isRoomClient = currentFlightRoom && typeof isCurrentUserHost === 'function' && !isCurrentUserHost();
    let primaryBtnText = '🛫 NEXT FLIGHT';
    let primaryAct = 'again';
    if (isBot) {
      primaryBtnText = `✈️ REMATCH (${(st.bot?.level || 'hard').toUpperCase()})`;
      primaryAct = 'rematch';
    } else if (isRoomClient) {
      primaryBtnText = '🏛️ BACK TO WAITING ROOM';
      primaryAct = 'mode';
    }

    actionsHtml = `
      <div class="neora-victory-dock neora-action-dock">
        <div class="dock-primary-row">
          <button class="neora-btn-primary gold-glow" data-act="${primaryAct}">
            <span class="btn-icon">${isBot ? '😼' : '🛫'}</span>
            <span class="btn-text">${primaryBtnText}</span>
          </button>
          <button class="neora-btn-vault" id="btnOpenVaultTogether">
            <span class="btn-icon">🎰</span>
            <span class="btn-text">VAULT GACHA</span>
          </button>
        </div>
        <div class="dock-secondary-row">
          <button class="neora-btn-lobby neora-btn-secondary" data-act="mode">
            <span class="btn-icon">🏛️</span>
            <span class="btn-text">DEPARTURES</span>
          </button>
          <button class="neora-btn-exit neora-btn-tertiary" data-act="close">
            <span class="btn-icon">✕</span>
            <span class="btn-text">EXIT TO CABIN</span>
          </button>
        </div>
      </div>
    `;
  }

  ov.innerHTML = `
    <div class="confetti-layer">${confetti}</div>
    <div class="victory-card neora-victory-modal neora-victory-card">
      <button class="neora-card-close-x" data-act="close" title="Dismiss">✕</button>
      <div class="neora-victory-header victory-header-fixed">
        <div class="victory-crown">${winner ? '👑' : '🤝'}</div>
        ${threatBadgeHtml}
        ${winner ? `<div class="neora-victory-avatar-ring podium-avatar-wrap"><img src="${winner.sprite}" class="victory-sprite podium-avatar-img" alt="" /></div>` : ''}
        <h2 class="victory-title victory-hero-title">${winner ? `${winner.name.toUpperCase()} WINS!` : "IT'S A PERFECT DRAW!"}</h2>
        <div class="victory-reason victory-hero-subtitle">${reasonText} · Round ${g.round}</div>
      </div>

      <div class="neora-victory-scroll victory-scroll-body">
        <div class="neora-reward-banner">
          ${lootBoxHtml}
        </div>

        <div class="neora-podium-section">
          <div class="neora-section-label">✈️ FLIGHT CREW STANDINGS</div>
          ${placementsHtml}
        </div>

        <div class="neora-stats-section neora-stats-accordion">
          <div class="neora-section-label stats-accordion-title">📊 FLIGHT TELEMETRY</div>
          <div class="victory-stats stats-telemetry-grid">
            ${statsHtml}
          </div>
        </div>
      </div>

      ${actionsHtml}
    </div>
  `;
  ov.classList.add('active');
  if (AudioFX && AudioFX.playVictory) AudioFX.playVictory();

  // Vault Buttons (Mini and Main)
  const openVaultHandler = () => {
    hideVictory();
    if (monopolyState) monopolyState.gameOver = null;
    saveLocalMonopolyState();
    closeMonopolyGame(true);
    if (window.NookVault && window.NookVault.open) {
      window.NookVault.open('gacha');
    }
  };
  const vaultBtn = ov.querySelector('#btnOpenVaultTogether');
  if (vaultBtn) vaultBtn.addEventListener('click', openVaultHandler);
  const miniVaultBtn = ov.querySelector('#btnOpenVaultMini');
  if (miniVaultBtn) miniVaultBtn.addEventListener('click', openVaultHandler);

  // Rematch / Next Flight
  if (isBot) {
    const rematch = ov.querySelector('[data-act="rematch"]');
    if (rematch) rematch.addEventListener('click', () => {
      hideVictory();
      if (monopolyState) monopolyState.gameOver = null;
      startBotGame(st.bot?.level || 'hard');
    });
  } else {
    const again = ov.querySelector('[data-act="again"]');
    if (again) again.addEventListener('click', () => {
      hideVictory();
      if (monopolyState) monopolyState.gameOver = null;
      resetMonopolyGame();
    });
  }

  // Departures Lounge
  ov.querySelectorAll('[data-act="mode"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hideVictory();
      if (monopolyState) monopolyState.gameOver = null;
      promptResetOrMode();
    });
  });

  // Exit / Close
  ov.querySelectorAll('[data-act="close"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hideVictory();
      if (monopolyState) monopolyState.gameOver = null;
      closeMonopolyGame(true);
    });
  });
}

// Replace the estimate with the server's actual payout (adds daily bonus etc.)
window.addEventListener('vault:award', (e) => {
  const a = e.detail;
  const mine = a && a.payouts && a.payouts[getMonopolyMyRole()];
  if (!mine) return;
  const el = $m('victoryDiamonds');
  if (el) {
    const b = el.querySelector('b');
    if (b) b.textContent = `+${fmt(mine.total)}`;
    const sm = el.querySelector('small');
    if (sm) {
      const parts = [`${mine.won ? '🏆 Squadron Ace' : `Rank #${mine.rank || 2}`}`];
      if (mine.syndicate) parts.push(`+${mine.syndicate}💎 Syndicate`);
      if (mine.bounty) parts.push(`+${mine.bounty}💎 Bounty`);
      if (mine.daily) parts.push('☀️ Daily Bonus');
      sm.textContent = parts.join(' · ');
    }
    el.classList.add('confirmed');
  }
  const lb = $m('victoryLootBox');
  if (lb) {
    const dChip = lb.querySelector('.loot-chip.diamonds b');
    if (dChip) dChip.textContent = `+${fmt(mine.total)}`;
  }
});

window.addEventListener('vault:bot_result', (e) => {
  const a = e.detail;
  const el = $m('victoryDiamonds');
  if (el && a) {
    const b = el.querySelector('b');
    if (b) b.textContent = a.payout > 0 ? `+${fmt(a.payout)}💎` : '0💎';
    const sm = el.querySelector('small');
    if (sm && a.breakdown) sm.textContent = a.breakdown;
    el.classList.add('confirmed');
  }
  const lb = $m('victoryLootBox');
  if (lb && a && a.payout != null) {
    const dChip = lb.querySelector('.loot-chip.diamonds b');
    if (dChip) dChip.textContent = `+${fmt(a.payout)}`;
  }
});

function showRulesModal() {
  if (currentModalKey && currentModalKey.startsWith('decision:')) return;
  showModal('local:rules', `
    <div class="property-card rules-card">
      <span class="card-badge gold">HOW TO WIN</span>
      <ul class="rules-list">
        <li>🏆 First to <strong>${fmt(MONO_CFG.WIN_NET_WORTH)} net worth</strong> (cash + property value), <strong>bankrupt</strong> your opponent, or be richest after <strong>${MONO_CFG.MAX_ROUNDS} rounds</strong>.</li>
        <li>🏠 Rent: 1 house ×1 · 2 houses ×4 · 🏨 hotel ×12. Own a whole zone → ×2.</li>
        <li>🔥 Final Boarding: all rent ${MONO_CFG.FINAL_BOARDING_STAGES.map((s) => `${multLabel(s.mult)} from round ${s.round}`).join(', then ')}.</li>
        <li>👀 On an opponent's tile: 💸 pay, ⚔️ <strong>Takeover</strong> (dice duel, owner wins ties), or 🍸 <strong>Cocktail Clash</strong> (Double-or-Nothing: roll higher for 0 rent +50🪙 bounty! Lose or tie pays 1.5×).</li>
        <li>👗 <strong>Mythic Archetypes</strong>: Custom gameplay powers from the Vault!
          <ul>
            <li>🦊 <strong>Inari Kitsune</strong>: 3 Spirit Tails absorb rent to 0 and curse lands with Foxfire (40🪙 tribute)!</li>
            <li>🐉 <strong>Mekong Naga</strong>: Bangkok River Surge (C4 Water Shields) + Sky Bridge Surf to Start!</li>
            <li>🌓 <strong>Celestial Eclipse</strong>: Day/Night cycle — Solar Dawn (+30 lap) & Lunar Night (-25% rent)!</li>
            <li>🪔 <strong>Desert Djinn</strong>: Recharging Magic Carpet + Genie's Wish (+50 miles on 5-6)!</li>
            <li>🔥 <strong>Phoenix Ascendant</strong>: 40% rent saved to Ash Pot (100% refund at Start) + Casino cleanse!</li>
            <li>🍸 <strong>Monaco High-Roller</strong>: VIP Express + Grand Hotel Dividends (+60🪙)!</li>
            <li>🔱 <strong>Atlantis Drift</strong>: +1 Ocean Drift wave surfing + Abyssal Pearl Ward survival!</li>
            <li>🌌 <strong>Astral Sovereign</strong>: Supernova rolls on 6 + 15% Star Tithe domain siphon!</li>
          </ul>
        </li>
        <li>🎰 Casino · 🎒 Black Market · ⚔️ Takeover Arena (Hotel Raids) · 🪂 Airdrop · ✈️ Sky Bridge (+2 Turbulence Bump) · 🎁 Mystery Cargo.</li>
        <li>🎒 Items (max 2): 🎲 Golden Dice · 💣 C4 · 🛡️ Shield · 🧲 Magnet · 🌀 Swap · 🍌 Banana Peel Trap.</li>
        <li>💀 Can't pay? Your cheapest properties are sold to the bank at 50%.</li>
      </ul>
      <div class="card-actions"><button class="btn-balance-done" data-act="close">Got it ✈️</button></div>
    </div>
  `, (ov) => onTap(ov, '[data-act="close"]', () => hideModal()));
}

// =========================================================
// 25. WEBSOCKET SIGNALING HANDLER (CROSS-DEVICE SYNC)
// =========================================================
function handleMonopolyMessage(message) {
  markActivity();

  // If user is playing in solo bot mode, silently store partner/couple state in couple localStorage key
  // so the couple game stays up-to-date, but NEVER hijack or disrupt the active bot game!
  if (monopolyState && monopolyState.mode === 'bot') {
    if (message.state) {
      try { localStorage.setItem(MONOPOLY_LOCAL_KEY, JSON.stringify({ ...message.state, isRolling: false })); } catch (e) {}
    }
    if (Array.isArray(message.playedCardIds) && message.playedCardIds.length) {
      savePersistentPlayedCardIds(message.playedCardIds);
    }
    return;
  }

  // Discard self-echoes or duplicate roll messages immediately without executing or queuing
  if (message.type === 'monopoly_action' && message.action === 'roll') {
    const me = getMonopolyMyRole();
    if (message.playerKey === me) return;
    if (activeRollLocks[message.playerKey] || activeMoveLocks[message.playerKey]) return;
  }

  // Never apply a partner state or action mid-animation (it would fight the hop positions)
  if (isAnimating && (message.type === 'monopoly_action' || message.type === 'monopoly_sync') && message.action !== 'drift_choice') {
    queuedMessages.push(message);
    return;
  }

  if (message.type === 'monopoly_open') {
    if (message.state) mergeIncomingState(message.state);
    openMonopolyGame(false);
    return;
  }

  if (message.type === 'monopoly_close') {
    closeMonopolyGame(false);
    return;
  }

  if (message.type === 'monopoly_sync') {
    // If user is currently in a flight room, in a bot match, or in a 4P match, do NOT let legacy 1-to-1 couple sync overwrite our match!
    if (currentFlightRoom || (monopolyState && (monopolyState.mode === 'bot' || monopolyState.mode === '4p' || monopolyState.mode === 'room'))) {
      if (Array.isArray(message.playedCardIds) && message.playedCardIds.length) {
        const validServerCards = message.playedCardIds.map(Number).filter(isValidCardId);
        savePersistentPlayedCardIds(validServerCards);
        if (monopolyState) {
          monopolyState.playedCardIds = [...new Set([...(monopolyState.playedCardIds || []), ...validServerCards])];
        }
      }
      return;
    }

    if (Array.isArray(message.playedCardIds) && message.playedCardIds.length) {
      const validServerCards = message.playedCardIds.map(Number).filter(isValidCardId);
      savePersistentPlayedCardIds(validServerCards);
      if (monopolyState) {
        monopolyState.playedCardIds = [...new Set([...(monopolyState.playedCardIds || []), ...validServerCards])];
      }
    }
    if (Array.isArray(message.cardDeck) && message.cardDeck.length) {
      if (monopolyState) {
        const playedSet = new Set(monopolyState.playedCardIds || []);
        monopolyState.cardDeck = message.cardDeck.map(Number).filter((id) => isValidCardId(id) && !playedSet.has(id));
      }
    }
    if (!message.state) return;
    if (!isV2State(message.state)) {
      // Server still holds a legacy V1 board → replace it with our V2 state
      pushState();
      return;
    }
    mergeIncomingState(message.state);
    const modal = $m('monopolyModal');
    if (modal && !modal.classList.contains('hidden')) {
      renderAll({ instant: true });
    }
    return;
  }

  if (message.type === 'room_list_update') {
    departureBoardFlights = Array.isArray(message.rooms) ? message.rooms : [];
    renderDepartureBoard();
    return;
  }

  if (message.type === 'room_match_abandoned') {
    pendingActiveSession = null;
    currentFlightRoom = null;
    if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
    const banner = $m('neoraActiveMatchBanner');
    if (banner) banner.classList.add('hidden');
    renderDepartureBoard();
    return;
  }

  if (message.type === 'room_session_status') {
    if (message.hasActiveRoom && message.room) {
      pendingActiveSession = message;
      if (monopolyEntryRequested) {
        monopolyEntryRequested = false;
        showNeoraRejoinModal(message.room, message.slot);
      }
    } else {
      pendingActiveSession = null;
      if (message.expired) {
        if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
        if (monopolyEntryRequested) {
          monopolyEntryRequested = false;
          if (typeof showToast === 'function') showToast('Your previous flight has concluded.');
          showDepartureBoard();
        }
      } else if (monopolyEntryRequested) {
        monopolyEntryRequested = false;
        showDepartureBoard();
      }
    }
    return;
  }

  if (message.type === 'room_rejoined') {
    window.isMonopolyPlayerAway = false;
    if (typeof clearBotTimer === 'function') clearBotTimer();
    currentFlightRoom = message.room;
    currentFlightRoomSlot = message.slot;
    currentFlightRoomIsHost = message.slot && message.slot.id === 1;
    manualRoleOverride = null;
    if (message.room && Array.isArray(message.room.slots)) {
      lobbyState.slots = message.room.slots;
    }
    if (typeof localStorage !== 'undefined' && message.room?.id) {
      localStorage.setItem('sky_active_room_id', message.room.id);
    }
    hideNeoraRejoinModal();

    if (message.inFlight) {
      hideMonopolyLobby();
      if (message.gameState) {
        monopolyState = { ...message.gameState, active: true };
      } else if (!monopolyState || !monopolyState.active) {
        startPartyGame(lobbyState);
      }
      const modal = $m('monopolyModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
      }
      if (typeof renderAll === 'function') {
        renderAll({ instant: true });
      }
      if (typeof showToast === 'function') {
        showToast('✈️ Reconnected to active flight! Seat restored.');
      }
      if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
        checkBotTurn();
      }
    } else {
      const modal = $m('departureBoardModal');
      if (modal) modal.classList.remove('hidden');
      switchNeoraView('room');
      updateLobbyFlightRoomUI();
      if (typeof showToast === 'function') {
        showToast('✈️ Reconnected to boarding lounge!');
      }
    }
    return;
  }

  if (message.type === 'room_created' || message.type === 'room_joined') {
    isSpectatorMode = !!message.spectator;
    currentFlightRoom = message.room;
    currentFlightRoomIsHost = (message.type === 'room_created') || (message.slot && message.slot.id === 1);
    currentFlightRoomSlot = message.slot || (message.room && message.room.slots && message.room.slots[0]);
    manualRoleOverride = null;
    if (message.room && message.room.id && typeof localStorage !== 'undefined') {
      localStorage.setItem('sky_active_room_id', message.room.id);
    }
    if (message.room && Array.isArray(message.room.slots)) {
      lobbyState.slots = message.room.slots;
    }
    if (message.spectator) {
      hideMonopolyLobby();
      hideFloatingRoomWidget();
      if (message.state) {
        monopolyState = message.state;
      }
      const modal = $m('monopolyModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
      }
      if (typeof renderAll === 'function') {
        renderAll({ instant: true });
      }
      if (typeof showToast === 'function') {
        showToast('👁 Spectating live flight match! Enjoy the show.');
      }
      return;
    }
    const modal = $m('departureBoardModal');
    if (modal) modal.classList.remove('hidden');
    switchNeoraView('room');
    updateLobbyFlightRoomUI();
    return;
  }

  if (message.type === 'player_bot_takeover') {
    if (typeof showToast === 'function') {
      showToast(`🤖 ${message.name || 'Player'} disconnected. Bot auto-pilot active!`);
    }
    if (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) {
      const slot = currentFlightRoom.slots.find((s) => s.id === message.slotId);
      if (slot) {
        slot.controller = 'BOT_TEMPORARY';
        slot.connected = false;
      }
      if (typeof renderAll === 'function') renderAll({ instant: true });
    }
    return;
  }

  if (message.type === 'player_human_restored') {
    if (typeof showToast === 'function') {
      showToast(`👤 ${message.name || 'Player'} reconnected! Human control restored.`);
    }
    if (currentFlightRoom && Array.isArray(currentFlightRoom.slots)) {
      const slot = currentFlightRoom.slots.find((s) => s.id === message.slotId);
      if (slot) {
        slot.controller = 'HUMAN';
        slot.connected = true;
      }
      if (typeof renderAll === 'function') renderAll({ instant: true });
    }
    return;
  }

  if (message.type === 'room_update') {
    currentFlightRoom = message.room;
    if (message.room && Array.isArray(message.room.slots)) {
      lobbyState.slots = message.room.slots;
      updateLobbyUI();
    }
    if (currentNeoraView === 'room') {
      renderNeoraWaitingRoom();
    }
    updateLobbyFlightRoomUI();
    updateFloatingRoomWidget();
    return;
  }

  if (message.type === 'room_chat') {
    if (currentFlightRoom && currentFlightRoom.id === message.roomId) {
      if (!Array.isArray(currentFlightRoom.messages)) {
        currentFlightRoom.messages = [];
      }
      currentFlightRoom.messages.push(message.message);
      if (currentNeoraView === 'room') {
        appendNeoraChatMessage(message.message, true);
      }
    }
    return;
  }

  if (message.type === 'room_start') {
    window.isMonopolyPlayerAway = false;
    if (typeof clearBotTimer === 'function') clearBotTimer();
    hideFloatingRoomWidget();
    if (message.room) {
      currentFlightRoom = message.room;
      if (typeof localStorage !== 'undefined' && message.room.id) {
        localStorage.setItem('sky_active_room_id', message.room.id);
      }
    }
    hideMonopolyLobby();
    hideNeoraRejoinModal();
    if (message.state) {
      monopolyState = { ...message.state, active: true };
      if (currentFlightRoom) currentFlightRoom.gameState = monopolyState;
      saveLocalMonopolyState();
    } else if (!monopolyState || !monopolyState.active) {
      startPartyGame(currentFlightRoom || lobbyState);
    }
    const modal = $m('monopolyModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }
    if (typeof renderAll === 'function') {
      renderAll({ instant: true });
    }
    if (typeof showToast === 'function') {
      showToast('🚀 Flight departing! Monopoly game starting...');
    }
    if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
      checkBotTurn();
    }
    return;
  }

  if (message.type === 'room_left' || message.type === 'room_kicked') {
    hideFloatingRoomWidget();
    currentFlightRoom = null;
    currentFlightRoomIsHost = false;
    currentFlightRoomSlot = null;
    manualRoleOverride = null;
    pendingActiveSession = null;
    if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
    hideNeoraRejoinModal();
    switchNeoraView('browser');
    if (message.type === 'room_kicked' && typeof showToast === 'function') {
      showToast(message.reason || '👢 You were removed from the flight room by the captain.');
    }
    return;
  }

  if (message.type === 'room_terminated') {
    hideFloatingRoomWidget();
    currentFlightRoom = null;
    currentFlightRoomIsHost = false;
    currentFlightRoomSlot = null;
    manualRoleOverride = null;
    pendingActiveSession = null;
    if (typeof localStorage !== 'undefined') localStorage.removeItem('sky_active_room_id');
    hideNeoraRejoinModal();
    const modal = $m('monopolyModal');
    if (modal) {
      document.body?.classList.remove('has-active-modal');
      modal.classList.remove('active');
      modal.classList.add('hidden');
    }
    if (monopolyState) {
      monopolyState.active = false;
      monopolyState.gameOver = null;
    }
    saveLocalMonopolyState();
    switchNeoraView('browser');
    if (typeof showToast === 'function') {
      showToast(message.reason || '🛑 Flight was terminated by Captain.');
    }
    return;
  }

  if (message.type === 'room_error') {
    if (message.error === 'ACTIVE_MATCH_IN_PROGRESS') {
      if (typeof showToast === 'function') {
        showToast('⚠️ You have a match in progress! You must rejoin your original room.');
      }
      highlightActiveMatchBanner();
      switchNeoraView('browser');
      return;
    }
    const errEl = $m('flightCodeError');
    if (errEl) {
      errEl.textContent = `⚠️ ${message.message || message.error || 'Failed to join flight.'}`;
      errEl.classList.remove('hidden');
    }
    if (typeof showToast === 'function') {
      showToast(`⚠️ ${message.message || message.error || 'Failed to join flight.'}`);
    }
    return;
  }

  if (message.type === 'monopoly_lobby_update') {
    if (message.lobbyState) {
      lobbyState = { ...lobbyState, ...message.lobbyState, ready: { ...lobbyState.ready, ...(message.lobbyState.ready || {}) } };
      updateLobbyUI();
    }
    return;
  }

  if (message.type === 'monopoly_start_party') {
    window.isMonopolyPlayerAway = false;
    if (typeof clearBotTimer === 'function') clearBotTimer();
    if (message.state) {
      monopolyState = message.state;
      saveLocalMonopolyState();
      hideMonopolyLobby();
      hideModal();
      hideCardOverlay();
      hideVictory();
      if (window.MonoFX) {
        MonoFX.clearDesat();
        MonoFX.tokens.reset();
      }
      const modal = $m('monopolyModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
      }
      renderAll({ instant: true });
      setMonopolyTicker('🛫 <strong>All passengers boarded!</strong> Flight SKY-777 underway. Tap <strong>ROLL</strong> when it is your turn.');
      if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
        checkBotTurn();
      }
    }
    return;
  }

  if (message.type === 'room_finished') {
    if (currentFlightRoom) currentFlightRoom.status = 'finished';
    try { localStorage.removeItem('sky_active_room_id'); } catch (_) {}
    const banner = $m('neoraActiveMatchBanner');
    if (banner) banner.classList.add('hidden');
    if (message.state) mergeIncomingState(message.state);
    return;
  }

  if (message.type === 'monopoly_action_rejected') {
    console.warn('[Monopoly] Action rejected by server:', message.error, message.message);
    if (monopolyState) {
      monopolyState.isRolling = false;
    }
    isAnimating = false;
    releaseRoleLocks();
    flushQueuedMessages();
    if (currentFlightRoom && currentFlightRoom.id && typeof sendSignaling === 'function') {
      sendSignaling({ type: 'room_rejoin', roomId: currentFlightRoom.id, uid: getPersistentPlayerUid() });
    }
    renderAll();
    return;
  }

  if (message.type !== 'monopoly_action') return;

  switch (message.action) {
    case 'buy':
      if (message.state) mergeIncomingState(message.state);
      if (message.tileId != null) actBuy(message.tileId);
      break;

    case 'pass':
      if (message.state) mergeIncomingState(message.state);
      if (message.tileId != null) actPassBuy(message.tileId);
      break;

    case 'upgrade':
      if (message.state) mergeIncomingState(message.state);
      if (message.tileId != null) actUpgrade(message.tileId);
      break;

    case 'rent':
      if (message.state) mergeIncomingState(message.state);
      if (message.tileId != null) actPayRent(message.tileId);
      break;
    case 'reset_game': {
      const prevPlayed = Array.isArray(monopolyState.playedCardIds) ? monopolyState.playedCardIds : [];
      const persistent = loadPersistentPlayedCardIds();
      const allPlayed = Array.from(new Set([...prevPlayed, ...persistent].map(Number).filter(isValidCardId)));
      savePersistentPlayedCardIds(allPlayed);

      if (window.SkyPixi && typeof window.SkyPixi.clearAll === 'function') window.SkyPixi.clearAll();
      monopolyState = createDefaultMonopolyState();
      if (message.state) mergeIncomingState(message.state);
      monopolyState.playedCardIds = Array.from(new Set([...(monopolyState.playedCardIds || []), ...allPlayed]));
      savePersistentPlayedCardIds(monopolyState.playedCardIds);

      // Preserve unplayed cards or replenish
      const playedSet = new Set(monopolyState.playedCardIds);
      const incomingDeck = Array.isArray(message.state?.cardDeck) ? message.state.cardDeck : [];
      const validDeck = incomingDeck.map(Number).filter((id) => isValidCardId(id) && !playedSet.has(id));
      if (validDeck.length > 0) {
        monopolyState.cardDeck = validDeck;
      } else {
        const unplayed = CARD_DECK.filter((c) => !playedSet.has(c.id)).map((c) => c.id);
        monopolyState.cardDeck = shuffleArray(unplayed.length > 0 ? unplayed : CARD_DECK.map((c) => c.id));
      }
      monopolyState.active = true;
      saveLocalMonopolyState();
      releaseRoleLocks();
      hideModal();
      hideCardOverlay();
      hideVictory();
      cleanBoardVisualsForNewGame();
      if (window.MonoFX) { MonoFX.clearDesat(); MonoFX.tokens.reset(); }
      renderAll({ instant: true });
      setMonopolyTicker(`🔄 Partner started a new game! First to <strong>${fmt(MONO_CFG.WIN_NET_WORTH)} net worth</strong> wins.`);
      break;
    }

    case 'roll': {
      const me = getMonopolyMyRole();
      if (message.playerKey === me) return; // Drop self-echo
      if (activeRollLocks[message.playerKey] || activeMoveLocks[message.playerKey]) return; // Drop duplicate
      if (message.state) mergeIncomingState(message.state);
      hideModal('local:');
      executeRoll(message.playerKey, message.rollVal, !!message.golden, !!message.vipCasino);
      break;
    }

    case 'cast_ultimate':
      if (message.state) mergeIncomingState(message.state);
      triggerUltimateEffects(message.role, message.ultimateType, false);
      renderAll();
      break;

    case 'drift_choice':
      if (pendingRemoteDriftResolver) {
        const fn = pendingRemoteDriftResolver;
        pendingRemoteDriftResolver = null;
        fn(!!message.choseDrift);
      } else {
        remoteDriftPendingMessage = message;
      }
      break;

    case 'state':
      if (message.state) mergeIncomingState(message.state);
      renderMonopolyBoard();
      updateMonopolyHUD();
      if (message.ticker) setMonopolyTicker(message.ticker);
      (message.fx || []).forEach(playFx);
      reconcileOverlays();
      if (!monopolyState.gameOver && monopolyState.players[monopolyState.currentTurn]?.isBot) {
        checkBotTurn();
      }
      break;

    case 'pick':
      applyRemotePick(message);
      break;

    default:
      break;
  }
}

/**
 * Called whenever the WebSocket connects or reconnects.
 * Guarantees zero state loss across lock-screen sleep and WiFi drops.
 */
function onWebSocketReconnect() {
  console.log('[Monopoly] Signaling connected. Syncing active board state...');
  window.isMonopolyPlayerAway = false;
  if (typeof sendSignaling === 'function') {
    const myUid = getPersistentPlayerUid();
    const activeRoomId = currentFlightRoom?.id || (typeof localStorage !== 'undefined' && localStorage.getItem('sky_active_room_id'));
    if (activeRoomId) {
      sendSignaling({
        type: 'room_rejoin',
        roomId: activeRoomId,
        uid: myUid
      });
    }
    sendSignaling({ type: 'monopoly_request_sync', clientState: monopolyState });
  }
}

// Export to window
window.initMonopoly = initMonopoly;
window.openMonopolyGame = openMonopolyGame;
window.closeMonopolyGame = closeMonopolyGame;
window.handleMonopolyMessage = handleMonopolyMessage;
window.onWebSocketReconnect = onWebSocketReconnect;
window.hideVictory = hideVictory;
window.promptResetOrMode = promptResetOrMode;
window.startBotGame = startBotGame;
window.startPartyGame = startPartyGame;
window.renderVictory = renderVictory;
window.getMonopolyState = () => monopolyState;
window.setMonopolyState = (s) => { monopolyState = s; };
window.executeRoll = executeRoll;
window.isMonacoHighRoller = isMonacoHighRoller;
window.isAbyssalDrifter = isAbyssalDrifter;
window.isAstralSovereign = isAstralSovereign;
window.isNagaWarden = isNagaWarden;
window.isInariFoxfire = isInariFoxfire;
window.isCelestialEclipse = isCelestialEclipse;
window.isDjinnMirage = isDjinnMirage;
window.isPhoenixAscendant = isPhoenixAscendant;
window.isSundropTower = isSundropTower;
window.isClockworkSovereign = isClockworkSovereign;
window.isBeastAdam = isBeastAdam;
window.isFrostSovereign = isFrostSovereign;
window.isGildedSovereign = isGildedSovereign;
window.isSolarDivinity = isSolarDivinity;
window.isPhantomRoyalty = isPhantomRoyalty;
window.isOlympusDivinity = isOlympusDivinity;
window.showAbyssalDriftNavigator = showAbyssalDriftNavigator;
window.resetMonopolyGame = resetMonopolyGame;
window.chargePlayer = chargePlayer;
window.perkOf = perkOf;
window.MONOPOLY_TILES = MONOPOLY_TILES;
window.resolveLanding = resolveLanding;
window.applyBotItem = applyBotItem;
window.checkGameOver = checkGameOver;
window.actBuy = actBuy;
window.actUpgrade = actUpgrade;
window.actPayRent = actPayRent;
window.endTurn = endTurn;
window.finishTurn = finishTurn;
window.chargeUlt = chargeUlt;
window.getRoleUltimate = getRoleUltimate;
window.AudioFX = AudioFX;
window.SOUND_MAP = SOUND_MAP;
window.updateLobbySeats = updateLobbyUI;
window.updateLobbyUI = updateLobbyUI;
window.cycleLobbySlot = cycleLobbySlot;
window.startPartyGame = startPartyGame;
window.broadcastLobbyState = broadcastLobbyState;
window.getDefaultLobbySlots = getDefaultLobbySlots;
window.initMonopoly = initMonopoly;
window.showDepartureBoard = showDepartureBoard;
window.hideDepartureBoard = hideDepartureBoard;
window.renderDepartureBoard = renderDepartureBoard;
window.createFlightRoom = createFlightRoom;
window.joinFlightRoom = joinFlightRoom;
window.joinFlightByCode = joinFlightByCode;
window.toggleFlightPrivacy = toggleFlightPrivacy;
window.copyFlightCode = copyFlightCode;
window.switchNeoraView = switchNeoraView;
window.getEquippedCostumeAvatar = getEquippedCostumeAvatar;
window.minimizeFlightRoom = minimizeFlightRoom;
window.reopenFlightRoom = reopenFlightRoom;
window.hideFloatingRoomWidget = hideFloatingRoomWidget;
window.updateFloatingRoomWidget = updateFloatingRoomWidget;

Object.defineProperty(window, 'currentNeoraView', {
  get() { return currentNeoraView; },
  set(v) { currentNeoraView = v; },
  configurable: true
});

Object.defineProperty(window, 'currentFlightRoom', {
  get() { return currentFlightRoom; },
  set(r) { currentFlightRoom = r; },
  configurable: true
});

Object.defineProperty(window, 'departureBoardFlights', {
  get() { return departureBoardFlights; },
  set(f) { departureBoardFlights = f; },
  configurable: true
});

window.showMonopolyLobby = showMonopolyLobby;
window.handleMonopolyMessage = handleMonopolyMessage;

Object.defineProperty(window, 'monopolyState', {
  get() { return monopolyState; },
  set(s) { monopolyState = s; },
  configurable: true
});

Object.defineProperty(window, 'lobbyState', {
  get() { return lobbyState; },
  set(s) { lobbyState = s; },
  configurable: true
});

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMonopoly);
} else {
  initMonopoly();
}
