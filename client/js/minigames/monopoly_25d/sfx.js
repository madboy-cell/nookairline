// client/js/minigames/monopoly_25d/sfx.js — zero-asset Web Audio SFX for Sky Monopoly (marimba steps,
// dice clack, coin chime, ultimate whoosh). Lazily unlocked on the first user gesture (iOS rule).
//
// Dopamine patch: every cue is pitch-varied (±1 semitone) so repeats never sound robotic, voices are
// rate-limited per cue (no stacking spam when 12 coins land at once), one shared noise buffer is reused
// (no per-call buffer allocation) and a soft compressor glues the layers so big moments never clip.
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5]; // Do-Re-Mi-Fa-Sol-La-Ti-Do

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;
const lastAt = new Map();

function ac() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(comp).connect(ctx.destination);
    // 1 s of white noise shared by every noise() call (sliced with offsets + playbackRate)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** ±semitones random detune factor. */
const vary = (semi = 1) => 2 ** (((Math.random() * 2 - 1) * semi) / 12);

/** Per-cue rate limit: returns false if the same cue fired less than `ms` ago. */
function gate(name, ms) {
  const now = performance.now();
  if (now - (lastAt.get(name) || 0) < ms) return false;
  lastAt.set(name, now);
  return true;
}

function tone(freq, { type = 'sine', dur = 0.25, vol = 0.5, at = 0, slide = 0, attack = 0.008 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.08, vol = 0.3, at = 0, hp = 1200, lp = 0, rate = 1, fadeIn = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.playbackRate.value = rate;
  let node = src;
  if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
  const g = c.createGain();
  g.gain.setValueAtTime(fadeIn ? 0.0001 : vol, t0);
  if (fadeIn) g.gain.exponentialRampToValueAtTime(vol, t0 + fadeIn);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g).connect(master);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
}

const arp = (steps, { base = 2, type = 'triangle', gap = 0.07, dur = 0.22, vol = 0.24, at = 0, v = 0.5 } = {}) => {
  const k = vary(v);
  steps.forEach((s, i) => tone(NOTES[s % 8] * base * (s >= 8 ? 2 : 1) * k, { type, dur, vol, at: at + i * gap }));
};

export const sfx = {
  unlock() { ac(); },
  setMuted(v) { muted = !!v; if (muted && ctx) ctx.suspend().catch(() => {}); },
  get muted() { return muted; },
  /** Marimba note for the n-th hop of a move (Do-Re-Mi-Fa…). */
  step(n = 0) {
    const f = NOTES[n % NOTES.length] * vary(0.15);
    tone(f, { type: 'sine', dur: 0.22, vol: 0.45 });
    tone(f * 4, { type: 'sine', dur: 0.06, vol: 0.12 });
  },
  dice() { for (let k = 0; k < 4; k++) noise({ dur: 0.05, vol: 0.25, at: k * 0.07, hp: (1800 + k * 300) * vary(2) }); },
  /** Single rattle tick during the slow-down (k = 0…n, rises in pitch toward the reveal). */
  diceTick(k = 0) { if (gate('dtick', 40)) noise({ dur: 0.035, vol: 0.18, hp: 2200 + k * 260, rate: vary(2) }); },
  /** Dice impact: wood thud + bright clack. */
  diceLand() {
    tone(150 * vary(1), { type: 'sine', dur: 0.16, vol: 0.5, slide: 0.55 });
    noise({ dur: 0.06, vol: 0.32, hp: 2600 * vary(2) });
  },
  coin(up = true) {
    if (!gate(up ? 'coinU' : 'coinD', 45)) return;
    const k = vary(1);
    tone((up ? 1318.5 : 659.25) * k, { type: 'triangle', dur: 0.12, vol: 0.3 });
    tone((up ? 1975.5 : 493.88) * k, { type: 'triangle', dur: 0.18, vol: 0.25, at: 0.07 });
  },
  /** Stream of tinkles (coin stream / gold rain), n coins over `span` seconds. */
  coinStream(n = 6, span = 0.6, { at = 0, high = true } = {}) {
    const c = Math.min(10, n);
    for (let i = 0; i < c; i++) {
      const f = (high ? 1568 : 1046.5) * vary(2) * (1 + i * 0.015);
      tone(f, { type: 'triangle', dur: 0.09, vol: 0.14, at: at + (i / c) * span });
      tone(f * 1.5, { type: 'sine', dur: 0.06, vol: 0.06, at: at + (i / c) * span + 0.02 });
    }
  },
  /** Cash counter roll-up: brightness scales with the amount. */
  cashGain(amount = 100) {
    if (!gate('cashG', 80)) return;
    const n = Math.min(5, 2 + Math.floor(Math.log10(Math.max(10, amount))));
    arp([0, 2, 4, 7, 9].slice(0, n), { base: 2, gap: 0.05, dur: 0.16, vol: 0.18 });
  },
  cashLoss() {
    if (!gate('cashL', 80)) return;
    const k = vary(0.5);
    tone(587 * k, { type: 'triangle', dur: 0.14, vol: 0.2, slide: 0.8 });
    tone(440 * k, { type: 'triangle', dur: 0.2, vol: 0.16, at: 0.08, slide: 0.75 });
  },
  buy() { arp([0, 2, 4], { gap: 0.06, dur: 0.2, vol: 0.3 }); tone(2093 * vary(1), { type: 'sine', dur: 0.3, vol: 0.08, at: 0.2 }); },
  build() { const k = vary(0.6); [4, 5, 7].forEach((s, i) => tone(NOTES[s] * k, { type: 'square', dur: 0.12, vol: 0.12, at: i * 0.07 })); },
  /** Build pop: squash "boing" + sparkle tail; higher level = higher, longer. */
  pop(level = 1) {
    const k = vary(0.7) * (1 + level * 0.08);
    tone(260 * k, { type: 'sine', dur: 0.18, vol: 0.32, slide: 2.6 });
    for (let i = 0; i < 3 + level; i++) tone(2400 * k * (1 + i * 0.12), { type: 'sine', dur: 0.08, vol: 0.06, at: 0.12 + i * 0.045 });
  },
  sparkle() { if (!gate('spark', 90)) return; for (let i = 0; i < 4; i++) tone(2637 * vary(2), { type: 'sine', dur: 0.07, vol: 0.06, at: i * 0.05 }); },
  whoosh(dur = 0.4) { noise({ dur, vol: 0.2, hp: 500, lp: 4000, fadeIn: dur * 0.5, rate: vary(2) }); },
  /** Soft landing ripple: low "bloop". */
  land() { if (gate('land', 120)) tone(330 * vary(1), { type: 'sine', dur: 0.2, vol: 0.22, slide: 0.7 }); },
  ult() {
    noise({ dur: 0.6, vol: 0.22, hp: 400 });
    const k = vary(0.5);
    tone(220 * k, { type: 'sawtooth', dur: 0.7, vol: 0.18, slide: 4 });
    [0, 2, 4, 7].forEach((s, i) => tone(NOTES[s] * 2 * k, { type: 'triangle', dur: 0.35, vol: 0.2, at: 0.25 + i * 0.07 }));
  },
  /** Short 1-beat ult (bots / repeats). */
  ultShort() {
    noise({ dur: 0.3, vol: 0.18, hp: 600 });
    arp([0, 4, 7], { gap: 0.05, dur: 0.22, vol: 0.18 });
  },
  impact() { tone(90 * vary(1), { type: 'sine', dur: 0.32, vol: 0.5, slide: 0.5 }); noise({ dur: 0.25, vol: 0.2, hp: 200, lp: 1800 }); },
  bad() { tone(392 * vary(0.5), { type: 'square', dur: 0.18, vol: 0.12, slide: 0.6 }); },
  fanfare() { arp([0, 2, 4, 7, 4, 7], { gap: 0.11, dur: 0.3, vol: 0.28, v: 0.3 }); },
  /** Passing START: rising sweep + triumphant arpeggio + coin tinkles. */
  startPass() {
    this.whoosh(0.35);
    arp([0, 4, 7, 8, 11], { gap: 0.07, dur: 0.26, vol: 0.24, at: 0.15, v: 0.3 });
    this.coinStream(5, 0.4, { at: 0.45 });
  },
  /** Color set completion: big 2-voice fanfare + shimmer. */
  fanfareBig() {
    arp([0, 4, 7, 12 - 4, 7, 11], { gap: 0.1, dur: 0.34, vol: 0.26, v: 0.2 });
    arp([4, 7, 11, 12 - 1, 11, 14 - 2], { base: 1, type: 'sine', gap: 0.1, dur: 0.4, vol: 0.14, v: 0 });
    for (let i = 0; i < 6; i++) tone(3136 * vary(2), { type: 'sine', dur: 0.1, vol: 0.05, at: 0.65 + i * 0.05 });
  },
  /** Crystalline diamond ping (glassy fifth). */
  diamond() {
    if (!gate('dia', 70)) return;
    const f = 2349 * vary(1);
    tone(f, { type: 'sine', dur: 0.4, vol: 0.14 });
    tone(f * 1.5, { type: 'sine', dur: 0.3, vol: 0.08, at: 0.04 });
    tone(f * 2, { type: 'triangle', dur: 0.15, vol: 0.05, at: 0.08 });
  },
  /** Bankrupt crumble: rumble + descending sad notes. */
  crumble() {
    noise({ dur: 0.9, vol: 0.28, hp: 60, lp: 700, rate: 0.6 });
    tone(110, { type: 'sine', dur: 0.8, vol: 0.35, slide: 0.5 });
    [7, 4, 2, 0].forEach((s, i) => tone(NOTES[s] * vary(0.2), { type: 'triangle', dur: 0.3, vol: 0.14, at: 0.25 + i * 0.16, slide: 0.94 }));
  },
  /** Near-win tension: lub-dub. */
  heartbeat() {
    if (!gate('hb', 500)) return;
    tone(62, { type: 'sine', dur: 0.14, vol: 0.55, slide: 0.7 });
    tone(55, { type: 'sine', dur: 0.16, vol: 0.42, slide: 0.7, at: 0.2 });
  },
  /** Soul-Link combo: two voices (owner + pet) rising into one chord. */
  combo() {
    this.whoosh(0.5);
    const k = vary(0.3);
    [0, 2, 4, 7].forEach((s, i) => tone(NOTES[s] * k, { type: 'triangle', dur: 0.3, vol: 0.2, at: 0.1 + i * 0.08 }));
    [7, 4, 2, 0].forEach((s, i) => tone(NOTES[s] * 2 * k, { type: 'sine', dur: 0.3, vol: 0.16, at: 0.1 + i * 0.08 }));
    [0, 4, 7, 11].forEach((s) => tone(NOTES[s % 8] * (s > 7 ? 4 : 2) * k, { type: 'triangle', dur: 0.8, vol: 0.13, at: 0.55 }));
  },
  shockwave() { tone(70 * vary(1), { type: 'sine', dur: 0.45, vol: 0.5, slide: 0.45 }); noise({ dur: 0.4, vol: 0.22, hp: 150, lp: 2500 }); },
  confetti() { for (let i = 0; i < 6; i++) noise({ dur: 0.05, vol: 0.12, at: i * 0.06 + Math.random() * 0.03, hp: 3000 * vary(3) }); },
  /** Chaos event stingers. */
  chaos(kind) {
    if (kind === 'meteor_rain') { this.whoosh(0.6); tone(80, { type: 'sawtooth', dur: 0.6, vol: 0.12, slide: 0.5, at: 0.4 }); }
    else if (kind === 'gold_rain') this.coinStream(10, 1.2);
    else if (kind === 'swap') { tone(440, { type: 'sine', dur: 0.4, vol: 0.18, slide: 2 }); tone(880, { type: 'sine', dur: 0.4, vol: 0.14, slide: 0.5 }); }
    else if (kind === 'rent_x2_zone') { arp([0, 7, 0, 7], { base: 1, type: 'square', gap: 0.12, dur: 0.1, vol: 0.09 }); }
    else this.whoosh(0.4);
  },
};
