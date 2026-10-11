/**
 * Nook Runway: Sky Dash — Procedural Audio Synthesis Engine (SkyDashAudio)
 * 100% Web Audio API synthesized procedural sounds (0 external audio bytes).
 * Follows the Nook Mythic Enhancer multi-sensory standard.
 */
(function (root) {
  let ctx = null;

  function getAudioCtx() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        ctx = new AudioContext();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  const SkyDashAudio = {
    init() {
      getAudioCtx();
    },

    // 1. Light running footstep shuffle
    playStep() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 + Math.random() * 40, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.05);

        g.gain.setValueAtTime(0.04, c.currentTime);
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.05);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.06);
      } catch (e) {}
    },

    // 2. Jump whoosh (quick upward pitch glide)
    playJump() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.16);

        g.gain.setValueAtTime(0.18, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.17);
      } catch (e) {}
    },

    // 3. Double Jump: high sparkling chord arpeggio
    playDoubleJump() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const notes = [587.33, 783.99, 1046.50]; // D5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.04);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.25, c.currentTime + idx * 0.04 + 0.14);

          g.gain.setValueAtTime(0.12, c.currentTime + idx * 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.04 + 0.14);

          osc.connect(g);
          g.connect(c.destination);
          osc.start(c.currentTime + idx * 0.04);
          osc.stop(c.currentTime + idx * 0.04 + 0.15);
        });
      } catch (e) {}
    },

    // 4. TalesRunner Frame-Perfect Landing Dash ("ZWING!" Laser Spark)
    playLandingDash() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        // High sharp harmonic laser
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(280, c.currentTime + 0.22);

        g.gain.setValueAtTime(0.24, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);

        // Sub bass kick
        const sub = c.createOscillator();
        const subG = c.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(180, c.currentTime);
        sub.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.18);

        subG.gain.setValueAtTime(0.28, c.currentTime);
        subG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);

        osc.connect(g);
        g.connect(c.destination);
        sub.connect(subG);
        subG.connect(c.destination);

        osc.start();
        sub.start();
        osc.stop(c.currentTime + 0.23);
        sub.stop(c.currentTime + 0.23);
      } catch (e) {}
    },

    // 5. Diamond Collect (Ascending C-major pentatonic scale)
    playDiamond(combo = 0) {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66]; // C5 to D6
        const note = scale[combo % scale.length];

        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(note * 1.05, c.currentTime + 0.08);

        g.gain.setValueAtTime(0.14, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.11);
      } catch (e) {}
    },

    // 6. Slide Swoosh
    playSlide() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.25);

        g.gain.setValueAtTime(0.15, c.currentTime);
        g.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.25);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.26);
      } catch (e) {}
    },

    // 7. Near-Miss Adrenaline Surge Kick
    playNearMiss() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.14);

        g.gain.setValueAtTime(0.3, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.15);
      } catch (e) {}
    },

    // 8. Hyper Fever Flight Start (Deep sub bass drop + sweeping crescendo)
    playFeverStart() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const chord = [392.0, 493.88, 587.33, 783.99, 987.77]; // G major 7
        chord.forEach((freq, i) => {
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.5, c.currentTime);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, c.currentTime + 0.45);

          g.gain.setValueAtTime(0.08, c.currentTime);
          g.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.3);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.65);

          osc.connect(g);
          g.connect(c.destination);
          osc.start(c.currentTime + i * 0.03);
          osc.stop(c.currentTime + 0.7);
        });
      } catch (e) {}
    },

    // 9. Costume Active Ultimate Activation
    playUltimate(theme = 'generic') {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const sub = c.createOscillator();
        const subG = c.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(110, c.currentTime);
        sub.frequency.exponentialRampToValueAtTime(35, c.currentTime + 0.5);
        subG.gain.setValueAtTime(0.35, c.currentTime);
        subG.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.5);
        sub.connect(subG);
        subG.connect(c.destination);
        sub.start();
        sub.stop(c.currentTime + 0.52);

        // Harmonic chime sweep
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = theme.includes('inari') || theme.includes('fox') ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(350, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, c.currentTime + 0.4);
        g.gain.setValueAtTime(0.2, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.46);
      } catch (e) {}
    },

    // 10. Obstacle Stumble / Bump
    playHit() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.18);

        g.gain.setValueAtTime(0.25, c.currentTime);
        g.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.18);

        osc.connect(g);
        g.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.19);
      } catch (e) {}
    },

    // 11. Item Use & Sabotage
    playItem(type) {
      const c = getAudioCtx();
      if (!c) return;
      try {
        if (type === 'banana') {
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, c.currentTime);
          osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.2);
          g.gain.setValueAtTime(0.18, c.currentTime);
          g.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.2);
          osc.connect(g);
          g.connect(c.destination);
          osc.start();
          osc.stop(c.currentTime + 0.21);
        } else {
          // Rocket / Jet / Lightning
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(280, c.currentTime);
          osc.frequency.exponentialRampToValueAtTime(950, c.currentTime + 0.3);
          g.gain.setValueAtTime(0.2, c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
          osc.connect(g);
          g.connect(c.destination);
          osc.start();
          osc.stop(c.currentTime + 0.36);
        }
      } catch (e) {}
    },

    // 12. Victory Fanfare
    playVictory() {
      const c = getAudioCtx();
      if (!c) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = c.createOscillator();
          const g = c.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.12);
          g.gain.setValueAtTime(0.2, c.currentTime + idx * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.12 + 0.35);
          osc.connect(g);
          g.connect(c.destination);
          osc.start(c.currentTime + idx * 0.12);
          osc.stop(c.currentTime + idx * 0.12 + 0.4);
        });
      } catch (e) {}
    }
  };

  root.SkyDashAudio = SkyDashAudio;
})(typeof window !== 'undefined' ? window : global);
