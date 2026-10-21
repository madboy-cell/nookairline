// shared/cloud_dash_rules.js — Sky Cloud Dash V2 core rules (Phase 6B-1 + 6B-2 party layer)
// Pure, deterministic, dependency-free. Shared by client (prediction) and server (bots + validation).
// Spec: CLOUD_DASH_V2.md §1–§8. Runner coordinates are (s, lane, y): s = meters along the track,
// lane ∈ [-1, 1] (float while swapping), y = meters above the road.
//
// 6B-2 adds: 💨 Slipstream, 🎁 Mystery Prism items (incl. cross-player effects delivered via
// `r.incoming`), 🍮 dynamic traps (`ctx.traps`), 5 costume ULT archetypes + Synergy Burst,
// and 🧬 Dash Build mods/perks (`createRunner({ mods })`, see shared/dash_builds.js).

export const DASH_TUNING = {
  TRACK_LEN: 1000,
  FINISH_COAST: 30,            // meters runners coast past the line
  LANE_W: 1.85,
  BASE: 11,                    // m/s
  ZONE_BOUNDS: [0, 250, 500, 750, 1000],
  ZONE_MUL: [1.0, 1.05, 1.15, 1.25],
  KMH_DISPLAY: 3.6 * 3,        // stylized speedometer factor
  ACCEL_UP: 3.0, ACCEL_DOWN: 6.0,
  DT: 1 / 60,

  LANE_SWAP_TIME: 0.11,
  GRAVITY: 30,
  JUMP_V: 9.0,                 // apex ≈ 1.35 m, airtime ≈ 0.6 s
  HOP_V: 8.0,                  // air-hop
  DASH_V: 6.5,                 // Dash-Jump (low hop)
  AIR_HOPS: 1,
  GLIDE_FALL: 1.2,             // max fall speed while gliding (m/s)
  GLIDE_SPEED_MUL: 0.92,
  INPUT_BUFFER: 0.15,
  COYOTE: 0.10,
  PERFECT_EARLY: 0.08,         // buffered press this close before landing counts as perfect
  PERFECT_LATE: 0.18,          // press within this after landing (Luck widens)
  PERFECT_MIN_AIR: 0.5,        // landing must follow a real jump (Dash-Jump hops can't chain into each other)
  ROCKET_WINDOW: 0.35,         // jump right after GO

  // boosts (strongest wins; timers refresh)
  PAD: { mul: 0.35, dur: 1.0 },
  DASH: { mul: 0.20, dur: 1.0 },
  ROCKET: { mul: 0.50, dur: 1.0 },
  SLIP: { range: 12, fill: 1.2, mul: 0.35, dur: 1.2, cd: 2.0 },   // 💨 slipstream slingshot
  PERK: { mul: 0.22, dur: 0.8 },                                   // build-perk mini boosts
  ZIP: { mul: 1.5, dur: 0.9 },                                     // 🪝 grapple zip (on top of base)
  VAULT: { mul: 0.20, dur: 0.9, minY: 0.6, rivalY: 0.4, ds: 0.9, dl: 0.5, cd: 2.0 }, // 👟 hop-over vault
  APEX: { mul: 0.10, dur: 0.8, hold: 0.55, lane: 0.35 },           // 🏎️ corner apex carve
  HEART: { range: 6, fill: 2.5, mul: 0.30, dur: 1.5, cd: 12 },      // 💞 couple heart slingshot
  DECK: { y: 4.0, rise: 0.6, ringHalf: 1.1, ringLane: 0.6, ringY: 0.8, s0: 330, s1: 400 }, // ☁️ upper cloud deck
  BOOST_CAP: 1.6,
  MACH: { streak: 3, dur: 6, mul: 1.05 },

  // hazards
  CLOUD_HALF: 0.45,            // ± meters along s where a cloud can hit
  CLOUD_H: 0.9,                // must be above this to clear
  HURT_LANE: 0.45,             // lane distance that counts as a hit (≈70% hurtbox)
  NEAR_LANE: 0.64, NEAR_Y: 1.4, NEAR_SWAP: 0.15,
  STUMBLE: { mul: 0.65, dur: 0.6, iframes: 1.0 },
  RESCUE: { dur: 0.8, fallY: -1.5, bondCost: 25, landPad: 1.0 },
  TRAP: { half: 0.7, mul: 0.7, dur: 1.0, bounce: 6.5, life: 25 },  // 🍮 mochi trap
  SHRINK: { mul: 0.75, dur: 2.0, warn: 1.0, dodgeY: 0.6 },         // ⚡ Zeus shrink bolt
  SLOW: { mul: 0.8, dur: 3.0 },                                    // Cinderella midnight slow
  SHIELD_DUR: 15,

  // pickups
  PICK_LANE: 0.6, PICK_Y: 1.0, PICK_AHEAD: 0.9,
  RIDE_PICK_Y: 2.6,

  // Pet Ride
  RIDE: { mul: 1.45, cap: 1.6, dur: [5.0, 5.5, 6.0], dismount: 0.3 },
  // 🐾 Per-family ride styles (CLOUD_DASH_V2 §2.3). Callers pass a canonical V2 pet id (normalizePetId).
  POUNCE: { hopV: 7.5, wave: 8, style: 30 },                 // 🐱 Ragdoll Royal Pounce
  FLIGHT: { y: 2.5, breathEvery: 1.2, breathLen: 30, mul: 1.05 },     // 🐉 Nyx Sky Flight
  BLINK: { perStack: 0.03, max: 5 },                          // 🦊 Kitsune Foxfire Blink
  SURF: { every: 0.8, range: 12, lane: 0.5, mul: 0.8, dur: 1.0 }, // 🐋 Sky Whale Whale Surf (bubble rivals behind)
  BOND: { coin: 0.8, berry: 1.5, star: 4, perfect: 2.5, near: 4, overtake: 5, vault: 3, apex: 2, heart: 6, deck: 4 },
  BOND_PLACE_MUL: [1, 1, 1.15, 1.3],
  BOND_STAR_MUL: [1, 1.08, 1.15],

  // Ultimate. Passive charge guarantees ~1 ult per race (around Zone 4).
  ULT: { mul: 1.7, synergy: 1.9, dur: 6, rideExtend: 2 },
  ULT_PASSIVE: 0.8,                // per second
  ULT_GAIN: { coin: 0.25, berry: 1, star: 4, orb: 25, perfect: 1, near: 2 },

  // Rhythm Chain
  CHAIN_TIERS: [0, 10, 25, 50],
  CHAIN_MUL: [1, 1.25, 1.5, 2],    // bond multiplier
  STYLE_MUL: [1, 2, 3, 4],
  STYLE: { coin: 10, berry: 30, star: 150, orb: 60, perfect: 100, near: 80, smash: 50, overtake: 120, slingshot: 90, item: 40, vault: 40, apex: 60, heart: 120, deck: 150 },

  CATCH_UP: [0, 0, 0.03, 0.06],    // by place (1st..4th)
  DNF_AFTER_FIRST: 15,             // seconds after 1st finisher
  RACE_HARD_CAP: 150,              // safety cap (s)
};

const T = DASH_TUNING;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Zone index 0..3 for a track distance. */
export function zoneOf(s) {
  const b = T.ZONE_BOUNDS;
  for (let i = 3; i >= 0; i--) if (s >= b[i]) return i;
  return 0;
}

export function chainTier(chain) {
  const t = T.CHAIN_TIERS;
  return chain >= t[3] ? 3 : chain >= t[2] ? 2 : chain >= t[1] ? 1 : 0;
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 🌈 Costume ULT archetypes (§8)
/** Archetype base defs, all tuned to ≈ +40 m "distance budget". */
export const ULT_ARCHETYPES = {
  surge:   { type: 'surge',   name: 'Surge',      mul: 1.7,  dur: 6, smash: true },
  flight:  { type: 'flight',  name: 'Flight',     mul: 1.55, dur: 6, flyY: 2.2 },
  warp:    { type: 'warp',    name: 'Warp',       mul: 1.4,  dur: 3, warp: 35 },
  clear:   { type: 'clear',   name: 'Clear-Lane', mul: 1.5,  dur: 6, clear: 60, magnet: true, smash: true },
  control: { type: 'control', name: 'Control',    mul: 1.5,  dur: 6, magnet: true },
};

/** Costume → archetype + flavor (Super Mythics get +15% budget). */
export const COSTUME_DASH_ULTS = {
  s1_naga_sovereign:    { arch: 'surge', name: 'Emerald Wave Surf' },
  s3_dune_phoenix:      { arch: 'surge', name: 'Solar Comet Dive' },
  s9_pharaoh_ra:        { arch: 'surge', name: 'Sun-God Solar Highway' },
  s11_zeus_olympus:     { arch: 'surge', name: 'Olympus Thunder Chariot' },
  s3_sultan_djinn:      { arch: 'flight', name: 'Magic Carpet Royal Flight' },
  s8_glacial_elsa:      { arch: 'flight', name: 'Absolute Zero Ice Bridge' },
  s2_kitsune_inari:     { arch: 'warp', name: 'Torii Gate Warp Dash' },
  s6_astral_sovereign:  { arch: 'warp', name: 'Hyperspace Starlight Warp' },
  s4_casino_royale:     { arch: 'clear', name: '777 High-Roller Fever' },
  s5_atlantis_siren:    { arch: 'clear', name: 'Siren Dolphin Leap' },
  s10_phantom_masque:   { arch: 'clear', name: 'Masquerade Illusion' },
  s2_tsukuyomi_eclipse: { arch: 'control', name: 'Lunar Gravity Well', magnetAll: true },
  s7_cinderella_clock:  { arch: 'control', name: 'Midnight Clockwork Slow-Mo', rivalSlow: true },
  sm_eclipse_dragon:    { arch: 'surge', name: 'Eclipse Dragon Sovereign Flight', sovereign: true },
  sm_aurora_empress:    { arch: 'flight', name: 'Aurora Empress Sovereign Flight', sovereign: true },
  sm_seraphim_rose:     { arch: 'flight', name: 'Seraphim Rose Sovereign Flight', sovereign: true },
  sm_cyber_archon:      { arch: 'warp', name: 'Cyber Archon Overclock Warp', sovereign: true },
  sm_starlight_ribbon:  { arch: 'clear', name: 'Starlight Ribbon Sovereign Sweep', sovereign: true },
};

/** Resolve a costume's ULT def (non-mythics → generic Surge). */
export function ultDefFor(outfitId) {
  const c = COSTUME_DASH_ULTS[outfitId] || { arch: 'surge', name: 'Rainbow Surge' };
  const base = ULT_ARCHETYPES[c.arch];
  const k = c.sovereign ? 1.15 : 1;
  return {
    ...base, ...c,
    mul: 1 + (base.mul - 1) * k,
    dur: base.dur * (c.sovereign ? 1.15 : 1),
    warp: base.warp ? base.warp * k : 0,
    outfit: outfitId || null,
  };
}

// ---------------------------------------------------------------- 🎁 Mystery Prism items (§7.3)
export const ITEM_DEFS = {
  mega_mount: { id: 'mega_mount', name: 'Mega Mount', icon: '🐾', target: 'self' },
  shrink:     { id: 'shrink', name: 'Zeus Shrink Bolt', icon: '⚡', target: 'leader' },
  grapple:    { id: 'grapple', name: 'Rapunzel Grapple', icon: '🪝', target: 'self' },
  mochi:      { id: 'mochi', name: 'Mochi Trap', icon: '🍮', target: 'trap' },
  shield:     { id: 'shield', name: 'Barrier Shield', icon: '🫧', target: 'self', auto: true },
  jelly_rain: { id: 'jelly_rain', name: 'Jelly Rain', icon: '🍬', target: 'self' },
};
/** Weights by place (1st..4th). Leaders get defense, the pack gets comeback tools. */
const ITEM_WEIGHTS = [
  { shield: 4, mochi: 4, jelly_rain: 2 },
  { shield: 3, mochi: 3, jelly_rain: 2, grapple: 2 },
  { grapple: 3, mega_mount: 3, shrink: 2, jelly_rain: 2 },
  { mega_mount: 4, shrink: 3, grapple: 3 },
];
export function rollItem(rng, place = 1, luck = 0) {
  // Luck nudges toward the next-worse place table (better comeback items)
  const p = clamp((place | 0) - 1 + (rng() < luck ? 1 : 0), 0, 3);
  const w = ITEM_WEIGHTS[p];
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (const [k, v] of Object.entries(w)) { if ((x -= v) < 0) return k; }
  return Object.keys(w)[0];
}

// ---------------------------------------------------------------- runner
const DEFAULT_MODS = {
  statSpeed: 0, glideMul: 1, slipFillMul: 1, ultChargeMul: 1, boostDurMul: 1, magnetMul: 1, styleMul: 1,
  perfectLate: T.PERFECT_LATE, prismLuck: 0, bondMul: 1, itemCap: 1, perks: {}, build: null,
};

/**
 * 🐾 Pet Ride styles + Cloud Dash pet passives (rebalanced per CLOUD_DASH_V2 §5.3; mirrored in
 * shared/pet_skills.js `cloud_dash`). Arrays are by pet star ★1/★2/★3. Keyed by canonical V2 pet id.
 */
export const PET_RIDES = {
  pet_ragdoll:  { style: 'pounce', name: 'Royal Pounce',  icon: '🐱', glideHangPct: [10, 15, 20], magnetM: [0.8, 1.0, 1.3] },
  pet_nyx:      { style: 'flight', name: 'Sky Flight',    icon: '🐉', rideBonusSec: [0.5, 0.75, 1.0] },
  pet_kitsune:  { style: 'blink',  name: 'Foxfire Blink', icon: '🦊', extraAirHops: [1, 1, 1], hopHeightPct: [0, 0, 15] },
  pet_skywhale: { style: 'surf',   name: 'Whale Surf',    icon: '🐋', shieldEverySec: [30, 25, 20], shieldMax: 3 },
};
export function petRideFor(petId) { return PET_RIDES[petId] || PET_RIDES.pet_ragdoll; }

/**
 * Create a runner.
 * @param {object} o  { seat, petStars (1..3), petId (canonical V2 id), statSpeed, itemCount, mods (dash_builds), ult (ultDefFor), seed }
 */
export function createRunner(o = {}) {
  const m = { ...DEFAULT_MODS, ...(o.mods || {}) };
  m.perks = { ...(o.mods?.perks || {}) };
  const petStars = clamp(o.petStars | 0 || 1, 1, 3);
  const pr = petRideFor(o.petId);
  const si = petStars - 1;
  return {
    seat: o.seat ?? 0,
    petStars,
    petId: PET_RIDES[o.petId] ? o.petId : 'pet_ragdoll',
    rideStyle: pr.style,
    petMagnet: pr.magnetM ? pr.magnetM[si] / T.LANE_W : 0,           // extra pickup reach (lanes)
    petGlide: pr.glideHangPct ? 1 / (1 + pr.glideHangPct[si] / 100) : 1, // slower glide fall = longer hang
    petRideBonus: pr.rideBonusSec ? pr.rideBonusSec[si] : 0,
    petAirHops: T.AIR_HOPS + (pr.extraAirHops ? pr.extraAirHops[si] : 0),
    petHopMul: 1 + (pr.hopHeightPct ? pr.hopHeightPct[si] / 100 : 0),
    petShieldEvery: pr.shieldEverySec ? pr.shieldEverySec[si] : 0, petShieldLeft: pr.shieldMax || 0, petShieldT: 0,
    blink: 0, breathT: 0, surfT: 0, bubbled: 0,
    statSpeed: clamp((+o.statSpeed || 0) + (m.statSpeed || 0), -0.1, 0.12),
    perfectLate: clamp(m.perfectLate || T.PERFECT_LATE, T.PERFECT_LATE, 0.26),
    m,
    ultDef: o.ult || ultDefFor(null),
    rng: makeRng(o.seed || 1),
    t: 0, s: 0, v: 0,
    laneF: 0, laneT: 0, prevLane: 0, laneChangeT: 9,
    y: 0, vy: 0, grounded: true, airT: 0, lastAirT: 0, landT: 9,
    airHops: T.AIR_HOPS + (pr.extraAirHops ? pr.extraAirHops[si] : 0), coyote: 0, buffer: 0, glide: false,
    pad: 0, dash: 0, rocket: 0, slip: 0, perk: 0, zip: 0, mach: 0, perfectStreak: 0,
    draft: 0, slipCd: 0, drafting: false,
    vault: 0, vaultCd: {}, vaultGap: {}, apex: 0, apexT: 0, apexBend: -1, heartBoost: 0, heart: 0, heartCd: 0, hearting: false,
    deck: false, deckH: 0, decks: 0, vaults: 0, apexes: 0,
    stumble: 0, iframes: 0, shrink: 0, slow: 0, trapped: 0,
    shield: 0, magnetAll: 0, items: [], incoming: [], trapsHit: [],
    ride: 0, rideDismount: 0, ult: 0, doubleUltUsed: false, superUlt: false,
    bond: 0, ultCharge: 0,
    chain: 0, style: 0, coins: 0, berries: 0, stars: 0, smashes: 0, perfects: 0, nears: 0, hits: 0, jellies: 0,
    rescue: 0, rescueFrom: 0, rescueTo: 0,
    cursor: 0, pitCursor: 0,
    taken: new Uint8Array(o.itemCount || 0),
    finished: false, finishT: 0,
  };
}

function overPit(track, s) {
  for (const p of track.pits) { if (s < p.s0) return null; if (s <= p.s1) return p; }
  return null;
}

/** Index of the bend (track.bends, sorted) containing s, or -1. */
export function bendAt(track, s) {
  const bs = track.bends;
  if (!bs) return -1;
  for (let i = 0; i < bs.length; i++) { if (s < bs[i].s0) return -1; if (s <= bs[i].s1) return i; }
  return -1;
}

function addChain(r, n, ev) {
  const before = chainTier(r.chain);
  r.chain += n;
  const after = chainTier(r.chain);
  if (after > before) ev.push({ e: 'tier', tier: after });
}

function perkBoost(r, ev, why) {
  r.perk = T.PERK.dur * r.m.boostDurMul;
  ev.push({ e: 'perk', why });
}

function gain(r, ctx, kind, ev) {
  const tier = chainTier(r.chain);
  const bondMul = T.CHAIN_MUL[tier] * (T.BOND_PLACE_MUL[(ctx.place || 1) - 1] || 1) * T.BOND_STAR_MUL[r.petStars - 1] * r.m.bondMul;
  if (T.BOND[kind] && r.ride <= 0) r.bond = Math.min(100, r.bond + T.BOND[kind] * bondMul);
  if (T.ULT_GAIN[kind] && r.ult <= 0) r.ultCharge = Math.min(100, r.ultCharge + T.ULT_GAIN[kind] * r.m.ultChargeMul);
  if (T.STYLE[kind]) {
    const golden = r.ride > 0 && r.m.perks.goldenRide ? 2 : 1;
    r.style += Math.round(T.STYLE[kind] * T.STYLE_MUL[tier] * (r.ride > 0 && r.ult > 0 ? 2 : 1) * r.m.styleMul * golden);
  }
  if (kind === 'coin' || kind === 'berry' || kind === 'star' || kind === 'perfect' || kind === 'near') addChain(r, 1, ev);
  // 🪙 Collector II — Sugar Rush
  if ((kind === 'coin' || kind === 'berry' || kind === 'star') && r.m.perks.sugarRush) {
    r.jellies++;
    if (r.jellies % r.m.perks.sugarRush === 0) perkBoost(r, ev, 'sugar');
  }
}

function doJump(r, ctx, kind, ev) {
  r.grounded = false; r.coyote = 0; r.airT = 0; r.buffer = 0;
  if (kind === 'dash') {
    r.vy = T.DASH_V; r.dash = T.DASH.dur; r.perfects++; r.perfectStreak++;
    // ⚡ Speedster III — Afterburner: extend whatever boost is running
    const ab = r.m.perks.afterburner;
    if (ab) { for (const k of ['pad', 'rocket', 'slip', 'perk']) if (r[k] > 0) r[k] += ab; r.dash += ab; }
    gain(r, ctx, 'perfect', ev);
    ev.push({ e: 'perfect', streak: r.perfectStreak });
    if (r.perfectStreak >= T.MACH.streak && r.mach <= 0) { r.mach = T.MACH.dur; ev.push({ e: 'mach' }); }
    else if (r.mach > 0) r.mach = T.MACH.dur;
  } else {
    r.vy = T.JUMP_V;
    ev.push({ e: 'jump' });
  }
}

function anyBoost(r) { return r.pad > 0 || r.dash > 0 || r.rocket > 0 || r.slip > 0 || r.perk > 0 || r.zip > 0 || r.vault > 0 || r.apex > 0 || r.heartBoost > 0; }

/** Current target speed multiplier (exported for HUD/FOV). */
export function speedMul(r) {
  let boost = 0;
  if (r.pad > 0) boost = Math.max(boost, T.PAD.mul);
  if (r.dash > 0) boost = Math.max(boost, T.DASH.mul);
  if (r.rocket > 0) boost = Math.max(boost, T.ROCKET.mul);
  if (r.slip > 0) boost = Math.max(boost, T.SLIP.mul);
  if (r.perk > 0) boost = Math.max(boost, T.PERK.mul);
  if (r.vault > 0) boost = Math.max(boost, T.VAULT.mul);
  if (r.apex > 0) boost = Math.max(boost, T.APEX.mul);
  if (r.heartBoost > 0) boost = Math.max(boost, T.HEART.mul);
  let m = Math.min(T.BOOST_CAP, 1 + boost);
  if (r.ride > 0) m = Math.min(T.RIDE.cap, T.RIDE.mul + boost * 0.4) * (1 + r.blink * T.BLINK.perStack) * (r.rideStyle === "flight" ? T.FLIGHT.mul : 1);
  if (r.ult > 0) {
    const um = r.ultDef.mul * (r.superUlt ? 1.15 : 1);
    m = r.ride > 0 ? Math.max(T.ULT.synergy, um) : um;
  }
  if (r.zip > 0) m = Math.max(m, T.ZIP.mul + 1);
  if (r.mach > 0) m *= T.MACH.mul;
  const protectedRun = r.ride > 0 || r.ult > 0;
  if (r.stumble > 0 && !protectedRun) m *= T.STUMBLE.mul;
  if (r.trapped > 0 && !protectedRun) m *= T.TRAP.mul;
  if (r.shrink > 0) m *= T.SHRINK.mul;
  if (r.slow > 0) m *= T.SLOW.mul;
  if (r.bubbled > 0 && !protectedRun) m *= T.SURF.mul;
  if (!r.grounded && r.glide && r.vy <= 0 && r.ride <= 0) m *= T.GLIDE_SPEED_MUL;
  // ⚡🪙 Sugar Rocket hybrid: chain tier → top speed
  if (r.m.perks.sugar_rocket) m *= 1 + chainTier(r.chain) * 0.015;
  return m;
}

export function targetSpeed(r, ctx) {
  const catchUp = T.CATCH_UP[(ctx.place || 1) - 1] || 0;
  return T.BASE * T.ZONE_MUL[zoneOf(r.s)] * (1 + r.statSpeed) * (1 + catchUp) * speedMul(r);
}

/** Can this runner block a negative effect? Consumes the shield. */
function blocked(r, ev, what) {
  if (r.shield > 0) { r.shield = 0; ev.push({ e: 'shield_pop', what }); return true; }
  return false;
}

/** Apply a cross-player effect delivered by the server (shrink / slow). */
export function deliverEffect(r, kind, from = null) {
  if (kind === 'shrink') r.incoming.push({ kind, t: T.SHRINK.warn, from });
  else if (kind === 'slow' || kind === 'bubble') r.incoming.push({ kind, t: 0, from });
}

function fireUlt(r, ctx, ev) {
  const d = r.ultDef;
  r.superUlt = !!(r.m.perks.gambler && r.rng() < 0.25);
  r.ult = d.dur * (r.superUlt ? 1 + 2 / d.dur : 1);
  r.ultCharge = 0;
  if (r.m.perks.doubleUlt && !r.doubleUltUsed) { r.ultCharge = 50; r.doubleUltUsed = true; }
  ev.push({ e: 'ult', arch: d.type, name: d.name, super: r.superUlt, rivalSlow: !!d.rivalSlow });
  if (r.ride > 0) { r.ride += T.ULT.rideExtend; ev.push({ e: 'synergy' }); }
  if (d.type === 'warp') {
    let ns = r.s + d.warp;
    const pit = overPit(ctx.track, ns);
    if (pit) ns = pit.s1 + 1;
    ns = Math.min(ns, T.TRACK_LEN - 1);
    ev.push({ e: 'warp', from: r.s, to: ns });
    r.s = ns;
  }
  if (d.type === 'clear') {
    const items = ctx.track.items;
    let n = 0;
    for (let i = r.cursor; i < items.length && items[i].s < r.s + d.clear; i++) {
      if (items[i].t === 'cloud' && !r.taken[i]) { r.taken[i] = 1; r.coins += 3; n++; gain(r, ctx, 'smash', ev); }
    }
    ev.push({ e: 'clear', n });
  }
  if (d.magnetAll) r.magnetAll = Math.max(r.magnetAll, d.dur);
}

function useItem(r, ctx, ev) {
  const id = r.items.shift();
  if (!id) return;
  const def = ITEM_DEFS[id];
  r.style += T.STYLE.item;
  switch (id) {
    case 'mega_mount': r.bond = 100; r.rideBonus = 1; break;
    case 'grapple': r.zip = T.ZIP.dur; break;
    case 'jelly_rain': r.magnetAll = Math.max(r.magnetAll, 4); r.bond = Math.min(100, r.bond + 10); break;
    case 'shield': r.shield = T.SHIELD_DUR; break;
    default: break; // shrink / mochi are delivered by the server (event below)
  }
  ev.push({ e: 'item_use', item: id, target: def.target, s: r.s, lane: Math.round(r.laneF) });
}

/**
 * Advance one runner by dt (use fixed T.DT steps).
 * @param {object} r     runner (mutated)
 * @param {object} ctx   { track, place, rivals?: [{s, lane}], traps?: [{id, s, lane, owner}], items?: true }
 * @param {object} inp   { left, right, jump, glide, ult, item }  — pressed-this-step booleans, glide is "held"
 * @param {number} dt
 * @returns {Array} events  e.g. {e:'coin', id}, {e:'perfect'}, {e:'hit'}, {e:'ride_start'} …
 */
export function stepRunner(r, ctx, inp, dt) {
  const ev = [];
  const track = ctx.track;
  r.t += dt;

  // ---- timers
  for (const k of ['pad', 'dash', 'rocket', 'slip', 'perk', 'zip', 'mach', 'stumble', 'iframes', 'ult', 'rideDismount', 'shrink', 'slow', 'trapped', 'shield', 'magnetAll', 'slipCd', 'vault', 'apex', 'heartBoost', 'heartCd', 'bubbled']) if (r[k] > 0) r[k] = Math.max(0, r[k] - dt);
  for (const k in r.vaultCd) { r.vaultCd[k] -= dt; if (r.vaultCd[k] <= 0) delete r.vaultCd[k]; }
  if (r.buffer > 0) r.buffer = Math.max(0, r.buffer - dt);
  if (r.coyote > 0) r.coyote = Math.max(0, r.coyote - dt);
  r.laneChangeT += dt;
  if (r.ult <= 0 && !r.finished) r.ultCharge = Math.min(100, r.ultCharge + T.ULT_PASSIVE * r.m.ultChargeMul * dt);
  if (r.ride > 0) {
    r.ride = Math.max(0, r.ride - dt);
    if (r.ride === 0) { r.rideDismount = T.RIDE.dismount; r.blink = 0; ev.push({ e: 'ride_end', style: r.rideStyle }); }
  }

  // ---- incoming cross-player effects (telegraphed)
  for (let i = r.incoming.length - 1; i >= 0; i--) {
    const fx = r.incoming[i];
    fx.t -= dt;
    if (fx.t > 0) continue;
    r.incoming.splice(i, 1);
    if (r.finished) continue;
    if (fx.kind === 'shrink') {
      if (r.y > T.SHRINK.dodgeY && r.rescue <= 0) ev.push({ e: 'dodge', what: 'shrink' });
      else if (!blocked(r, ev, 'shrink')) { r.shrink = T.SHRINK.dur; ev.push({ e: 'shrunk' }); }
    } else if (fx.kind === 'slow') {
      if (!blocked(r, ev, 'slow')) { r.slow = T.SLOW.dur; ev.push({ e: 'slowed' }); }
    } else if (fx.kind === 'bubble') {
      // 🐋 Whale Surf bubble: minor, so a shield / ride / ult just shrugs it off (shield not consumed)
      if (r.shield > 0 || r.ride > 0 || r.ult > 0) ev.push({ e: 'dodge', what: 'bubble' });
      else { r.bubbled = T.SURF.dur; ev.push({ e: 'bubbled', from: fx.from }); }
    }
  }

  // ---- 🐋 Sky Whale passive: a free bubble shield every N s (max 3 per race)
  if (r.petShieldEvery && r.petShieldLeft > 0 && !r.finished) {
    if (r.shield > 0) r.petShieldT = 0;
    else if ((r.petShieldT += dt) >= r.petShieldEvery) {
      r.petShieldT = 0; r.petShieldLeft--; r.shield = T.SHIELD_DUR;
      ev.push({ e: 'pet_shield' });
    }
  }

  // ---- finished: coast
  if (r.finished) {
    r.v = Math.max(0, r.v - 8 * dt);
    r.s = Math.min(T.TRACK_LEN + T.FINISH_COAST, r.s + r.v * dt);
    return ev;
  }

  // ---- Pet Rescue cinematic (pet carries you over the gap)
  if (r.rescue > 0) {
    r.rescue = Math.max(0, r.rescue - dt);
    const k = 1 - r.rescue / T.RESCUE.dur;
    r.s = r.rescueFrom + (r.rescueTo - r.rescueFrom) * k;
    r.y = Math.sin(k * Math.PI) * 2.2;
    if (r.rescue === 0) {
      r.y = 0; r.vy = 0; r.grounded = true; r.airHops = r.petAirHops; r.landT = 9;
      r.iframes = T.STUMBLE.iframes; r.v = T.BASE * 0.5;
      ev.push({ e: 'rescue_end' });
    }
    return ev;
  }

  // ---- ✦ Speedster IV launch boost
  if (r.m.perks.launch && r.t <= dt * 1.5) { r.rocket = Math.max(r.rocket, r.m.perks.launch); ev.push({ e: 'perk', why: 'launch' }); }

  // ---- lanes
  const blinking = r.ride > 0 && r.rideStyle === 'blink';
  for (const dir of [-1, 1]) {
    if (!(dir < 0 ? inp.left : inp.right) || (dir < 0 ? r.laneT <= -1 : r.laneT >= 1)) continue;
    r.prevLane = Math.round(r.laneF); r.laneT += dir; r.laneChangeT = 0;
    ev.push({ e: 'lane', dir });
    if (blinking) {
      // 🦊 Foxfire Blink: instant lane teleport, +3% speed per blink (×5)
      const from = r.laneF;
      r.laneF = r.laneT;
      r.blink = Math.min(T.BLINK.max, r.blink + 1);
      ev.push({ e: 'blink', from, to: r.laneT, stacks: r.blink });
    }
  }
  const laneStep = dt / (r.ult > 0 && r.ultDef.type === 'flight' ? T.LANE_SWAP_TIME * 1.3 : T.LANE_SWAP_TIME);
  if (r.laneF < r.laneT) r.laneF = Math.min(r.laneT, r.laneF + laneStep);
  else if (r.laneF > r.laneT) r.laneF = Math.max(r.laneT, r.laneF - laneStep);

  // ---- ultimate, items & pet ride triggers
  if (inp.ult && r.ultCharge >= 100 && r.ult <= 0) fireUlt(r, ctx, ev);
  if (inp.item && r.items.length) useItem(r, ctx, ev);
  if (r.bond >= 100 && r.ride <= 0) {
    r.ride = T.RIDE.dur[r.petStars - 1] + (r.m.perks.goldenRide || 0) + (r.rideBonus || 0) + r.petRideBonus;
    r.rideBonus = 0; r.bond = 0;
    r.blink = 0; r.breathT = 0; r.surfT = 0;
    if (r.ult > 0) { r.ride += T.ULT.rideExtend; ev.push({ e: 'synergy' }); }
    ev.push({ e: 'ride_start', style: r.rideStyle });
    if (r.rideStyle === 'pounce' && r.grounded) { r.grounded = false; r.vy = T.POUNCE.hopV; r.airT = 0; }
  }

  // ---- 🐾 per-family ride signatures (continuous)
  if (r.ride > 0) {
    if (r.rideStyle === 'flight' && (r.breathT -= dt) <= 0) {
      // 🐉 plasma breath: clouds in my lane ahead → jellies
      r.breathT = T.FLIGHT.breathEvery;
      const items = track.items, lane = Math.round(r.laneT);
      let n = 0;
      for (let i = r.cursor; i < items.length && items[i].s < r.s + T.FLIGHT.breathLen; i++) {
        const it = items[i];
        if (it.t === 'cloud' && !r.taken[i] && it.s > r.s && it.lane === lane && !it.deck === !r.deck) { r.taken[i] = 1; r.coins += 2; n++; gain(r, ctx, 'smash', ev); }
      }
      ev.push({ e: 'breath', n, lane });
    }
    if (r.rideStyle === 'surf' && (r.surfT -= dt) <= 0) {
      // 🐋 bubble wave behind me (server routes the 'bubble' effect to rivals behind in my lane)
      r.surfT = T.SURF.every;
      ev.push({ e: 'surf_wave', s: r.s, lane: Math.round(r.laneF) });
    }
  }

  // ---- 💨 slipstream (same lane, a rival just ahead)
  r.drafting = false;
  if (ctx.rivals && r.slipCd <= 0 && r.ride <= 0 && r.ult <= 0 && r.slip <= 0) {
    const myLane = Math.round(r.laneF);
    for (const o of ctx.rivals) {
      const gap = o.s - r.s;
      if (gap > 0.8 && gap < T.SLIP.range && Math.round(o.lane) === myLane) { r.drafting = true; break; }
    }
    if (r.drafting) {
      r.draft += dt;
      if (r.draft >= T.SLIP.fill * r.m.slipFillMul) {
        r.slip = T.SLIP.dur * r.m.boostDurMul; r.draft = 0; r.slipCd = T.SLIP.cd;
        gain(r, ctx, 'slingshot', ev);
        ev.push({ e: 'slingshot' });
      }
    } else r.draft = Math.max(0, r.draft - dt * 2);
  }

  // ---- 👟 Hop-Over Vault (sail OVER a grounded rival in your lane: you were behind, now you're ahead)
  if (ctx.rivals) {
    const gaps = r.vaultGap || (r.vaultGap = {});
    for (const o of ctx.rivals) {
      const key = o.seat ?? -1;
      const gap = o.s - r.s, last = gaps[key];
      gaps[key] = gap;
      if (r.vault > 0 || r.vaultCd.all > 0 || r.vaultCd[key] > 0 || o.dk || r.deck || r.ride > 0) continue;
      if (last > 0 && gap <= 0 && gap > -T.VAULT.ds && r.y > T.VAULT.minY
        && Math.abs((o.lane || 0) - r.laneF) < T.VAULT.dl && (o.y || 0) < T.VAULT.rivalY) {
        r.vaultCd[key] = T.VAULT.cd * 2; r.vaultCd.all = T.VAULT.cd;
        r.vault = T.VAULT.dur * r.m.boostDurMul; r.vaults++;
        gain(r, ctx, 'vault', ev);
        ev.push({ e: 'vault', seat: o.seat ?? null });
      }
    }
  }

  // ---- 💞 Couple Heart Slingshot (run near your partner/friend → shared tandem boost)
  r.hearting = false;
  if (ctx.rivals && r.heartCd <= 0 && r.heartBoost <= 0) {
    for (const o of ctx.rivals) if (o.heart && Math.abs(o.s - r.s) < T.HEART.range) { r.hearting = true; break; }
    if (r.hearting) {
      r.heart = Math.min(100, r.heart + (100 / T.HEART.fill) * dt);
      if (r.heart >= 100) {
        r.heart = 0; r.heartBoost = T.HEART.dur * r.m.boostDurMul; r.heartCd = T.HEART.cd;
        gain(r, ctx, 'heart', ev);
        ev.push({ e: 'heart' });
      }
    } else r.heart = Math.max(0, r.heart - 20 * dt);
  }

  // ---- 🏎️ Corner Apex Carve (hug the inside lane through a bend)
  const bend = bendAt(track, r.s);
  if (bend >= 0 && r.apexBend !== bend) {
    const b = track.bends[bend];
    if (r.grounded && !r.deck && Math.abs(r.laneF - b.dir) < T.APEX.lane) {
      r.apexT += dt;
      if (r.apexT >= T.APEX.hold) {
        r.apexBend = bend; r.apexT = 0;
        r.apex = T.APEX.dur * r.m.boostDurMul; r.apexes++;
        gain(r, ctx, 'apex', ev);
        ev.push({ e: 'apex', dir: b.dir });
      }
    }
  } else if (bend < 0) r.apexT = 0;

  // ---- jump input
  const flying = (r.ult > 0 && r.ultDef.type === 'flight') || (r.ride > 0 && r.rideStyle === 'flight');
  if (inp.jump && !flying) {
    if (r.t <= T.ROCKET_WINDOW && r.s < 6 && r.rocket <= 0 && r.grounded) {
      r.rocket = T.ROCKET.dur; ev.push({ e: 'rocket' });
      doJump(r, ctx, 'normal', ev);
    } else if (r.grounded) {
      const perfect = (r.landT <= r.perfectLate && r.lastAirT >= T.PERFECT_MIN_AIR) || r.rideDismount > 0;
      doJump(r, ctx, perfect ? 'dash' : 'normal', ev);
      r.rideDismount = 0;
    } else if (r.coyote > 0) {
      doJump(r, ctx, 'normal', ev);
    } else if (r.airHops > 0) {
      r.airHops--; r.vy = T.HOP_V * r.petHopMul; ev.push({ e: 'hop' });
    } else {
      r.buffer = T.INPUT_BUFFER;
    }
  }
  r.glide = !!inp.glide;

  // ---- ☁️ Upper Cloud Deck (Zone 2 shortcut)
  const dk = track.deck;
  if (dk) {
    const ringEnter = r.s >= dk.ring - T.DECK.ringHalf && r.s <= dk.ring + T.DECK.ringHalf && Math.abs(r.laneF) < T.DECK.ringLane && r.y > T.DECK.ringY;
    const flyOverDeck = flying && r.s >= dk.ring - T.DECK.ringHalf && r.s < dk.s1 - 4;
    if (!r.deck && r.s < dk.s1 && r.rescue <= 0 && (ringEnter || flyOverDeck)) {
      r.deck = true; r.decks++;
      if (!flying) r.vy = Math.max(r.vy, T.HOP_V * 0.6);
      gain(r, ctx, 'deck', ev);
      ev.push({ e: 'deck_enter' });
    }
    if (r.deck && r.s >= dk.s1) {
      r.deck = false;
      r.y += r.deckH; r.deckH = 0;
      if (r.grounded) { r.grounded = false; r.airT = 0; r.vy = 2; }
      ev.push({ e: 'deck_exit' });
    }
  }
  if (r.deck && r.deckH < T.DECK.y) r.deckH = Math.min(T.DECK.y, r.deckH + (T.DECK.y / T.DECK.rise) * dt);

  // ---- vertical
  const pitHere = r.deck ? null : overPit(track, r.s);
  if (flying) {
    // 🕊️ Flight ULT / 🐉 Nyx Sky Flight ride: cruise above everything (stays up until past any gap)
    const ultFly = r.ult > 0 && r.ultDef.type === 'flight';
    const flyY = ultFly ? Math.max(r.ultDef.flyY, r.ride > 0 && r.rideStyle === 'flight' ? T.FLIGHT.y : 0) : T.FLIGHT.y;
    r.y += (flyY - r.y) * Math.min(1, dt * 8); r.vy = 0; r.grounded = false; r.airT = 0;
    if (ultFly && r.ult < dt * 2 && pitHere) r.ult = dt * 2;
    if (!ultFly && r.ride < dt * 2 && pitHere) r.ride = dt * 2;
  } else {
    if (r.grounded) {
      r.landT += dt;
      if (r.landT > r.perfectLate && r.perfectStreak > 0 && r.mach <= 0) r.perfectStreak = 0;
      if (pitHere && r.ride <= 0) { r.grounded = false; r.coyote = T.COYOTE; r.vy = 0; r.airT = 0; }
    }
    if (!r.grounded) {
      r.airT += dt;
      r.vy -= T.GRAVITY * dt;
      const glideFall = T.GLIDE_FALL * r.m.glideMul * r.petGlide;
      if (r.glide && r.vy < -glideFall) r.vy = -glideFall;
      if (r.ride > 0 && pitHere && r.vy < 0) r.vy = Math.max(r.vy, -0.5); // riders never fall into gaps
      r.y += r.vy * dt;
      if (r.y <= 0) {
        const pit = r.deck ? null : overPit(track, r.s);
        if (!pit || r.ride > 0) {
          r.y = 0; r.vy = 0; r.grounded = true; r.airHops = r.petAirHops;
          r.lastAirT = r.airT; r.landT = 0;
          ev.push({ e: 'land', air: r.airT });
          if (r.ride > 0 && r.rideStyle === 'pounce') {
            // 🐱 Royal Pounce: bound again immediately; each landing pops a heart wave that scoops jellies ahead
            r.grounded = false; r.vy = T.POUNCE.hopV; r.airT = 0; r.buffer = 0;
            const n = scoopAhead(r, ctx, T.POUNCE.wave, ev);
            r.style += T.POUNCE.style;
            ev.push({ e: 'pounce', n });
          } else if (r.buffer > 0) {
            const sincePress = T.INPUT_BUFFER - r.buffer;           // how early the press was
            const early = sincePress <= T.PERFECT_EARLY;
            doJump(r, ctx, early && r.lastAirT >= T.PERFECT_MIN_AIR ? 'dash' : 'normal', ev);
          }
        } else if (r.y < T.RESCUE.fallY) {
          // 🐾 Pet Rescue — never a black screen
          r.rescue = T.RESCUE.dur; r.rescueFrom = r.s; r.rescueTo = pit.s1 + T.RESCUE.landPad;
          r.bond = Math.max(0, r.bond - T.RESCUE.bondCost);
          r.chain = T.CHAIN_TIERS[Math.max(0, chainTier(r.chain) - 1)];
          r.perfectStreak = 0; r.hits++;
          ev.push({ e: 'rescue' });
          return ev;
        }
      }
    }
  }

  // ---- forward motion
  const tv = targetSpeed(r, ctx);
  const a = tv > r.v ? T.ACCEL_UP : T.ACCEL_DOWN;
  r.v += (tv - r.v) * Math.min(1, a * dt);
  const sOld = r.s;
  r.s += r.v * dt;

  // ---- items + traps
  scanItems(r, ctx, sOld, ev);
  if (ctx.traps?.length) scanTraps(r, ctx, ev);

  // ---- finish
  if (r.s >= T.TRACK_LEN) { r.finished = true; r.finishT = r.t; ev.push({ e: 'finish', t: r.t }); }
  return ev;
}

/** 🐱 heart wave: collect every jelly (all lanes, own layer) in [s, s+len]. Returns count. */
function scoopAhead(r, ctx, len, ev) {
  const items = ctx.track.items;
  let n = 0;
  for (let i = r.cursor; i < items.length && items[i].s <= r.s + len; i++) {
    const it = items[i];
    if (r.taken[i] || it.s < r.s - 1 || !it.deck !== !r.deck) continue;
    if (it.t !== 'coin' && it.t !== 'berry' && it.t !== 'star' && it.t !== 'orb') continue;
    r.taken[i] = 1; n++;
    if (it.t === 'coin') r.coins++; else if (it.t === 'berry') r.berries++; else if (it.t === 'star') r.stars++;
    gain(r, ctx, it.t, ev);
    ev.push({ e: it.t, id: i });
  }
  return n;
}

function hitObstacle(r, ctx, ev, id, kind) {
  const riding = r.ride > 0, ulting = r.ult > 0;
  const smashes = riding || (ulting && (r.ultDef.smash || r.ultDef.type === 'control')) || (r.m.perks.boostSmash && anyBoost(r));
  if (smashes) {
    r.smashes++; gain(r, ctx, 'smash', ev); ev.push({ e: 'smash', id, kind });
    if (r.m.perks.juggernaut) perkBoost(r, ev, 'juggernaut');
    if (r.m.perks.treasure_breaker) { r.coins += 3; r.style += 60; }
    if (r.m.perks.shockwave && r.smashes % r.m.perks.shockwave === 0) { r.pad = Math.max(r.pad, 1.0); ev.push({ e: 'perk', why: 'shockwave' }); }
    return;
  }
  if (r.iframes > 0) { ev.push({ e: 'phase', id }); return; }
  if (ulting && r.ultDef.type === 'clear') { perkBoost(r, ev, 'counter'); ev.push({ e: 'phase', id }); return; } // 🎭 counter-dash
  if (r.m.perks.luckyPhase && r.rng() < r.m.perks.luckyPhase) { ev.push({ e: 'lucky', id }); return; }
  if (blocked(r, ev, kind)) { r.iframes = 0.5; return; }
  r.hits++;
  r.chain = T.CHAIN_TIERS[Math.max(0, chainTier(r.chain) - 1)];
  r.perfectStreak = 0; r.dash = 0; r.pad = 0; r.slip = 0; r.perk = 0; r.vault = 0; r.apex = 0;
  r.iframes = T.STUMBLE.iframes;
  if (kind === 'trap') { r.trapped = T.TRAP.dur; if (r.grounded) { r.grounded = false; r.vy = T.TRAP.bounce; r.airT = 0; } ev.push({ e: 'trapped', id }); }
  else { r.stumble = T.STUMBLE.dur; ev.push({ e: 'hit', id }); }
}

function scanTraps(r, ctx, ev) {
  if (r.deck) return;
  for (const tr of ctx.traps) {
    if (tr.owner === r.seat || r.trapsHit.includes(tr.id)) continue;
    if (Math.abs(tr.s - r.s) <= T.TRAP.half && Math.abs(r.laneF - tr.lane) < T.HURT_LANE && r.y < T.CLOUD_H) {
      r.trapsHit.push(tr.id);
      hitObstacle(r, ctx, ev, tr.id, 'trap');
    }
  }
}

function scanItems(r, ctx, sOld, ev) {
  const items = ctx.track.items;
  const magnetAll = r.ride > 0 || r.magnetAll > 0 || (r.ult > 0 && r.ultDef.magnet);
  const pickLane = Math.min(1.4, T.PICK_LANE * r.m.magnetMul + r.petMagnet);
  const flying = (r.ult > 0 && r.ultDef.type === 'flight') || (r.ride > 0 && r.rideStyle === 'flight');
  // advance cursor past resolved items
  while (r.cursor < items.length && items[r.cursor].s < sOld - 2) r.cursor++;
  for (let i = r.cursor; i < items.length; i++) {
    const it = items[i];
    if (it.s > r.s + T.PICK_AHEAD) break;
    if (r.taken[i]) continue;
    // ☁️ deck-only items vs road items: each layer only sees its own
    if (!!it.deck !== !!r.deck) { if (it.s < r.s - T.PICK_AHEAD) r.taken[i] = 1; continue; }
    const dl = Math.abs(r.laneF - it.lane);
    if (it.t === 'cloud') {
      if (it.s < r.s - T.CLOUD_HALF) {
        // passed — near-miss check
        r.taken[i] = 1;
        const swappedAway = r.laneChangeT <= T.NEAR_SWAP && r.prevLane === it.lane;
        const closeLane = dl < T.NEAR_LANE && dl >= T.HURT_LANE;
        const closeY = dl < T.HURT_LANE && r.y >= T.CLOUD_H && r.y < T.NEAR_Y;
        if (!flying && (swappedAway || closeLane || closeY)) {
          r.nears++; gain(r, ctx, 'near', ev); ev.push({ e: 'near', id: i });
          if (r.m.perks.phantom) perkBoost(r, ev, 'phantom');
        }
        continue;
      }
      if (Math.abs(it.s - r.s) <= T.CLOUD_HALF && dl < T.HURT_LANE && r.y < T.CLOUD_H) {
        r.taken[i] = 1;
        hitObstacle(r, ctx, ev, i, 'cloud');
      }
      continue;
    }
    if (it.t === 'pad') {
      if (Math.abs(it.s - r.s) <= 0.8 && dl < 0.55 && r.y < 0.3) {
        r.taken[i] = 1; r.pad = T.PAD.dur * r.m.boostDurMul; ev.push({ e: 'pad', id: i });
      } else if (it.s < r.s - 1) r.taken[i] = 1;
      continue;
    }
    if (it.t === 'prism') {
      if (ctx.items === false) { if (it.s < r.s - 1) r.taken[i] = 1; continue; }
      if (Math.abs(it.s - r.s) <= T.PICK_AHEAD && dl < 0.6 && Math.abs(r.y - (it.y || 0)) < 1.3) {
        r.taken[i] = 1;
        // one prism per row: mark the row's siblings as taken too
        for (let j = Math.max(0, i - 6); j < Math.min(items.length, i + 7); j++) if (items[j].t === 'prism' && Math.abs(items[j].s - it.s) < 0.5) r.taken[j] = 1;
        if (r.items.length < r.m.itemCap) {
          const got = [rollItem(r.rng, ctx.place || 1, r.m.prismLuck)];
          if (r.m.perks.doubleItem && r.rng() < r.m.perks.doubleItem) got.push(rollItem(r.rng, ctx.place || 1, r.m.prismLuck));
          for (const g of got) {
            if (ITEM_DEFS[g].auto) { r.shield = T.SHIELD_DUR; ev.push({ e: 'item_get', item: g, auto: true }); }
            else if (r.items.length < r.m.itemCap) { r.items.push(g); ev.push({ e: 'item_get', item: g }); }
          }
        }
        if (r.m.perks.jackpot) { r.bond = Math.min(100, r.bond + 15); r.coins += 5; }
      } else if (it.s < r.s - 1) r.taken[i] = 1;
      continue;
    }
    // pickups: coin / berry / star / orb
    const iy = it.y || 0;
    const laneOk = magnetAll || dl < pickLane;
    const yOk = Math.abs(r.y - iy) < (magnetAll ? T.RIDE_PICK_Y : T.PICK_Y);
    if (laneOk && yOk && it.s <= r.s + T.PICK_AHEAD && it.s >= r.s - T.PICK_AHEAD) {
      r.taken[i] = 1;
      if (it.t === 'coin') r.coins++; else if (it.t === 'berry') r.berries++; else if (it.t === 'star') r.stars++;
      gain(r, ctx, it.t, ev);
      ev.push({ e: it.t, id: i });
    } else if (it.s < r.s - T.PICK_AHEAD) {
      r.taken[i] = 1; // missed
    }
  }
}

/** Placement: finished first (by time), then by distance. Returns runner indices in order. */
export function computeRanking(runners) {
  return runners
    .map((r, i) => ({ i, r }))
    .sort((a, b) => {
      if (a.r.finished && b.r.finished) return a.r.finishT - b.r.finishT;
      if (a.r.finished) return -1;
      if (b.r.finished) return 1;
      return b.r.s - a.r.s;
    })
    .map((x) => x.i);
}

export function displayKmh(v) { return Math.round(v * T.KMH_DISPLAY); }

// ---------------------------------------------------------------- Bots
export const BOT_LEVELS = {
  easy:   { look: 9,  miss: 0.22, perfect: 0.25, rhythm: 0.25, think: 0.22, speed: -0.03 },
  hard:   { look: 14, miss: 0.08, perfect: 0.55, rhythm: 0.6,  think: 0.14, speed: 0.0 },
  insane: { look: 18, miss: 0.02, perfect: 0.85, rhythm: 1.1,  think: 0.09, speed: 0.03 },
};

export function createBotBrain(seed, level = 'hard') {
  return { rng: makeRng(seed), L: BOT_LEVELS[level] || BOT_LEVELS.hard, cd: 0, wantPerfect: false, itemHold: 0 };
}

/** Produce an input for a bot runner this step. */
export function botInput(r, ctx, brain, dt) {
  const inp = { left: false, right: false, jump: false, glide: false, ult: false, item: false };
  if (r.finished || r.rescue > 0) return inp;
  const { rng, L } = brain;
  const track = ctx.track;
  if (r.t < 0.2 && r.s < 1 && rng() < L.perfect * 0.5) { inp.jump = true; return inp; } // rocket start
  if (r.ultCharge >= 100) inp.ult = true;
  if (r.items.length) { brain.itemHold += dt; if (brain.itemHold > 1.5 + rng() * 2) { inp.item = true; brain.itemHold = 0; } }

  // perfect landing attempt
  if (r.grounded && r.landT > 0.04 && r.landT < r.perfectLate * 0.8 && r.lastAirT >= T.PERFECT_MIN_AIR && brain.wantPerfect) {
    inp.jump = true; brain.wantPerfect = false;
  }

  // voluntary rhythm hops (set up Dash-Jump perfects like a human would)
  if (r.grounded && r.landT > r.perfectLate && r.ride <= 0 && rng() < L.rhythm * dt) inp.jump = true;

  brain.cd -= dt;
  if (brain.cd <= 0) {
    brain.cd = L.think;
    const look = L.look * (r.v / T.BASE);
    // lane scoring
    const score = [0, 0, 0];
    const items = track.items;
    for (let i = r.cursor; i < items.length; i++) {
      const it = items[i];
      if (it.s > r.s + look) break;
      if (it.s < r.s || r.taken[i]) continue;
      if (!!it.deck !== !!r.deck) continue;
      const li = it.lane + 1;
      if (it.t === 'cloud') score[li] -= r.ride > 0 || r.ult > 0 ? -2 : 100;
      else if (it.t === 'pad') score[li] += 6;
      else if (it.t === 'prism') score[li] += r.items.length ? 0 : 4;
      else if (!it.y || it.y < 0.5) score[li] += it.t === 'coin' ? 1 : 3;
    }
    for (const tr of ctx.traps || []) if (tr.owner !== r.seat && tr.s > r.s && tr.s < r.s + look) score[tr.lane + 1] -= 80;
    // ☁️ skilled bots go for the deck ring; everyone likes the inside lane of a bend
    if (brain.deckGo === undefined) brain.deckGo = rng() < L.perfect;
    const dk = track.deck;
    if (dk && brain.deckGo && !r.deck && dk.ring > r.s && dk.ring < r.s + look * 1.5) score[1] += 20;
    const bi = bendAt(track, r.s + look * 0.5);
    if (bi >= 0) score[track.bends[bi].dir + 1] += 2.5;
    const cur = Math.round(r.laneT);
    score[cur + 1] += 1.5; // stickiness
    let best = cur;
    for (let l = -1; l <= 1; l++) if (Math.abs(l - cur) <= 1 && score[l + 1] > score[best + 1]) best = l;
    if (rng() < L.miss) best = cur; // mistake: doesn't react
    if (best < cur) inp.left = true; else if (best > cur) inp.right = true;
    if (rng() < L.perfect) brain.wantPerfect = true;

    // cloud straight ahead in lane we keep → jump at the right distance
    for (let i = r.cursor; i < items.length; i++) {
      const it = items[i];
      if (it.s > r.s + r.v * 0.35) break;
      if (it.t === 'cloud' && !it.deck === !r.deck && !r.taken[i] && it.lane === best && it.s > r.s && r.grounded && r.ride <= 0 && r.ult <= 0 && rng() > L.miss) {
        inp.jump = true; break;
      }
    }
  }
  // jump through the updraft ring
  const dk = track.deck;
  if (dk && brain.deckGo && !r.deck && r.grounded && Math.abs(r.laneF) < 0.3) {
    const dist = dk.ring - r.s;
    if (dist > r.v * 0.18 && dist < r.v * 0.3) inp.jump = true;
  }
  // dodge a telegraphed shrink bolt (skilled bots jump right as it lands)
  if (r.incoming.some((f) => f.kind === 'shrink' && f.t < 0.15) && r.grounded && rng() < L.perfect * 0.5) inp.jump = true;
  // pits: jump at the lip, glide across
  for (const p of track.pits) {
    if (r.deck) break;
    if (p.s1 < r.s) continue;
    const dist = p.s0 - r.s;
    if (dist >= 0 && dist < r.v * 0.12 && r.grounded && r.ride <= 0) inp.jump = true;
    if (r.s >= p.s0 - 1 && r.s <= p.s1 && !r.grounded) inp.glide = true;
    break;
  }
  return inp;
}

// ---------------------------------------------------------------- Server validation & rewards
/** Upper bound on legitimate speed (m/s), used to validate client-reported progress. */
export function maxPlausibleSpeed() {
  return T.BASE * T.ZONE_MUL[3] * 1.12 * (1 + T.CATCH_UP[3]) * Math.max(T.ULT.synergy, T.ZIP.mul + 1) * T.MACH.mul * 1.04;
}
/** Extra distance a single report may legitimately include (warp ULT). */
export const MAX_WARP = 45;

export const DASH_REWARDS = {
  gold: [300, 200, 140, 100],
  berries: [12, 8, 6, 4],
  styleGoldPer: 100, styleGoldCap: 150,
  maxStyle: 120000,
};

export function rewardFor(place, style) {
  const i = clamp(place - 1, 0, 3);
  const sg = Math.min(DASH_REWARDS.styleGoldCap, Math.floor(clamp(style, 0, DASH_REWARDS.maxStyle) / DASH_REWARDS.styleGoldPer));
  return { gold: DASH_REWARDS.gold[i] + sg, berries: DASH_REWARDS.berries[i] };
}
