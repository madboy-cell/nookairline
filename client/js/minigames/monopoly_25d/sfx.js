// client/js/minigames/monopoly_25d/sfx.js — zero-asset Web Audio SFX for Sky Monopoly (marimba steps,
// dice clack, coin chime, ultimate whoosh). Lazily unlocked on the first user gesture (iOS rule).
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5]; // Do-Re-Mi-Fa-Sol-La-Ti-Do

let ctx = null;
let master = null;
let muted = false;

function ac() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { type = 'sine', dur = 0.25, vol = 0.5, at = 0, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.08, vol = 0.3, at = 0, hp = 1200 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  unlock() { ac(); },
  setMuted(v) { muted = !!v; if (muted && ctx) ctx.suspend().catch(() => {}); },
  get muted() { return muted; },
  /** Marimba note for the n-th hop of a move (Do-Re-Mi-Fa…). */
  step(n = 0) {
    const f = NOTES[n % NOTES.length];
    tone(f, { type: 'sine', dur: 0.22, vol: 0.45 });
    tone(f * 4, { type: 'sine', dur: 0.06, vol: 0.12 });
  },
  dice() { for (let k = 0; k < 4; k++) noise({ dur: 0.05, vol: 0.25, at: k * 0.07, hp: 1800 + k * 300 }); },
  coin(up = true) {
    tone(up ? 1318.5 : 659.25, { type: 'triangle', dur: 0.12, vol: 0.3 });
    tone(up ? 1975.5 : 493.88, { type: 'triangle', dur: 0.18, vol: 0.25, at: 0.07 });
  },
  buy() { [0, 2, 4].forEach((k, i) => tone(NOTES[k] * 2, { type: 'triangle', dur: 0.2, vol: 0.3, at: i * 0.06 })); },
  build() { [4, 5, 7].forEach((k, i) => tone(NOTES[k], { type: 'square', dur: 0.12, vol: 0.12, at: i * 0.07 })); },
  ult() {
    noise({ dur: 0.6, vol: 0.22, hp: 400 });
    tone(220, { type: 'sawtooth', dur: 0.7, vol: 0.18, slide: 4 });
    [0, 2, 4, 7].forEach((k, i) => tone(NOTES[k] * 2, { type: 'triangle', dur: 0.35, vol: 0.2, at: 0.25 + i * 0.07 }));
  },
  bad() { tone(392, { type: 'square', dur: 0.18, vol: 0.12, slide: 0.6 }); },
  fanfare() { [0, 2, 4, 7, 4, 7].forEach((k, i) => tone(NOTES[k] * 2, { type: 'triangle', dur: 0.3, vol: 0.28, at: i * 0.11 })); },
};
