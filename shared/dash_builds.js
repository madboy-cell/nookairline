// shared/dash_builds.js — 🧬 Dash Builds + DASH_CAPS (CLOUD_DASH_V2.md §5.2, §5.5).
// Turns a player's bonus stats (gear + forge + pet, NOT level) into:
//   1) soft-capped stat effects (DASH_CAPS), and
//   2) a build identity (Speedster / Smasher / Collector / Trickster, a Hybrid, or Balanced) with tier perks.
// Output `mods` is consumed by createRunner() in shared/cloud_dash_rules.js.

export const STAT_ORDER = ['swiftness', 'power', 'fortune', 'luck'];

/** Tier thresholds per stat (Tier I..IV). Calibrated to max focused builds (≈ 15/50/80/95%). */
export const BUILD_THRESHOLDS = {
  swiftness: [100, 350, 560, 670],
  power: [100, 325, 520, 620],
  fortune: [120, 400, 640, 760],
  luck: [120, 395, 630, 745],
};
export const MAIN_SHARE = 0.45;
export const HYBRID_SHARE = 0.30;

export const BUILDS = {
  speedster: { stat: 'swiftness', name: 'Speedster', icon: '⚡', tip: 'Chase slipstreams & land perfectly to fly!' },
  smasher: { stat: 'power', name: 'Smasher', icon: '🔥', tip: 'Boost through storm clouds — smash them all!' },
  collector: { stat: 'fortune', name: 'Collector', icon: '🪙', tip: 'Follow jelly lines — Sugar Rush & more Pet Rides!' },
  trickster: { stat: 'luck', name: 'Trickster', icon: '🍀', tip: 'Grab Mystery Prisms and let luck carry you!' },
  balanced: { stat: null, name: 'Balanced', icon: '🌈', tip: 'A little bit of everything — dress for cute!' },
};

export const HYBRIDS = {
  'swiftness+power': { id: 'juggernaut', name: 'Juggernaut', icon: '⚡🔥', perk: 'Smashing a hurdle gives a speed boost' },
  'swiftness+fortune': { id: 'sugar_rocket', name: 'Sugar Rocket', icon: '⚡🪙', perk: 'Your chain tier raises top speed' },
  'swiftness+luck': { id: 'phantom', name: 'Phantom', icon: '⚡🍀', perk: 'CLOSE CALL! near-misses give a mini boost' },
  'power+fortune': { id: 'treasure_breaker', name: 'Treasure Breaker', icon: '🔥🪙', perk: 'Smashed hurdles burst into jelly' },
  'power+luck': { id: 'gambler', name: 'Gambler', icon: '🔥🍀', perk: '25% chance your ULT becomes a SUPER ULT' },
  'fortune+luck': { id: 'jackpot', name: 'Jackpot', icon: '🪙🍀', perk: 'Mystery Prisms also fill your pet\'s paw ring' },
};

/** Human-readable perk list per main build (index = tier-1). */
export const BUILD_PERKS = {
  speedster: ['Top speed +2%', 'Slipstream fills 40% faster', 'AFTERBURNER: perfect landings extend your boost', '✦ Launch boost at GO + Afterburner +0.5 s'],
  smasher: ['ULT charges 25% faster', 'While boosted, hurdles get SMASHED', 'DOUBLE ULT: half a gauge back after your ULT', '✦ Every 5 smashes → shockwave boost'],
  collector: ['Jelly magnet ×1.5', 'SUGAR RUSH: every 20 jellies → speed burst', 'Paw ring fills 20% faster', '✦ GOLDEN RIDE: Pet Rides +1.5 s'],
  trickster: ['Perfect window +40 ms', 'Hold 2 items', 'LUCKY PHASE: 20% chance to ghost through a hurdle', '✦ Prisms sometimes give double items'],
  balanced: ['HARMONY: small bonus to everything'],
};

/** Soft-capped stat effects. k chosen so dedicated (≈550) builds get ~90% of the cap. */
export const DASH_CAPS = {
  k: 250,
  swiftness: { speed: 0.06, glide: 0.15, slipFill: 0.20 },
  power: { ultCharge: 0.20, boostDur: 0.20 },
  fortune: { magnet: 0.40, style: 0.15 },
  luck: { perfect: 0.05, prismLuck: 0.5 },
};

const soft = (v, cap, k = DASH_CAPS.k) => (v > 0 ? cap * (1 - Math.exp(-v / k)) : 0);

function tierFor(stat, amount) {
  const t = BUILD_THRESHOLDS[stat];
  let tier = 0;
  for (let i = 0; i < t.length; i++) if (amount >= t[i]) tier = i + 1;
  return tier;
}

/**
 * Detect build identity from bonus stats.
 * @param {{swiftness,power,fortune,luck}} bonus
 * @returns {{ kind:'main'|'hybrid'|'balanced', id, name, icon, tier, stat?, stats?, share, next? }}
 */
export function detectBuild(bonus = {}) {
  const b = Object.fromEntries(STAT_ORDER.map((k) => [k, Math.max(0, bonus[k] || 0)]));
  const total = STAT_ORDER.reduce((a, k) => a + b[k], 0) || 1;
  const share = Object.fromEntries(STAT_ORDER.map((k) => [k, b[k] / total]));
  const ranked = [...STAT_ORDER].sort((x, y) => b[y] - b[x]);
  const [s1, s2] = ranked;

  // Hybrid: two stats ≥ 30% share AND both at Tier II amount
  if (share[s1] >= HYBRID_SHARE && share[s2] >= HYBRID_SHARE && tierFor(s1, b[s1]) >= 2 && tierFor(s2, b[s2]) >= 2) {
    const key = [s1, s2].sort((x, y) => STAT_ORDER.indexOf(x) - STAT_ORDER.indexOf(y)).join('+');
    const h = HYBRIDS[key];
    if (h) return { kind: 'hybrid', id: h.id, name: h.name, icon: h.icon, tier: 2, stats: [s1, s2], share, perk: h.perk };
  }
  if (share[s1] >= MAIN_SHARE) {
    const id = Object.keys(BUILDS).find((k) => BUILDS[k].stat === s1);
    const tier = tierFor(s1, b[s1]);
    if (tier >= 1) {
      const th = BUILD_THRESHOLDS[s1];
      const next = tier < 4 ? { tier: tier + 1, need: th[tier], have: b[s1], stat: s1 } : null;
      return { kind: 'main', id, name: BUILDS[id].name, icon: BUILDS[id].icon, tier, stat: s1, share, next };
    }
    // main stat but not yet Tier I → show progress toward Tier I
    const id2 = Object.keys(BUILDS).find((k) => BUILDS[k].stat === s1);
    return { kind: 'balanced', id: 'balanced', name: 'Balanced', icon: '🌈', tier: 1, share, next: { tier: 1, need: BUILD_THRESHOLDS[s1][0], have: b[s1], stat: s1, build: id2 } };
  }
  return { kind: 'balanced', id: 'balanced', name: 'Balanced', icon: '🌈', tier: 1, share, next: null };
}

/**
 * Full Cloud Dash modifiers for a runner.
 * @param {{swiftness,power,fortune,luck}} bonus   bonus stats (computeUniversalStats(...).bonus)
 * @param {object} [opt] { statScale: 1 (Cloud League uses 0.5), weather: null|'storm'|'jelly'|'tailwind'|'prism' }
 */
export function dashModsFromStats(bonus = {}, opt = {}) {
  const sc = opt.statScale ?? 1;
  const v = (k) => Math.max(0, (bonus[k] || 0) * sc);
  const C = DASH_CAPS;
  const build = detectBuild(bonus); // build identity uses full stats (perks stay active in League)
  const m = {
    statSpeed: soft(v('swiftness'), C.swiftness.speed),
    glideMul: 1 - soft(v('swiftness'), C.swiftness.glide),        // lower = slower fall
    slipFillMul: 1 - soft(v('swiftness'), C.swiftness.slipFill),
    ultChargeMul: 1 + soft(v('power'), C.power.ultCharge),
    boostDurMul: 1 + soft(v('power'), C.power.boostDur),
    magnetMul: 1 + soft(v('fortune'), C.fortune.magnet),
    styleMul: 1 + soft(v('fortune'), C.fortune.style),
    perfectLate: 0.18 + soft(v('luck'), C.luck.perfect),
    prismLuck: soft(v('luck'), C.luck.prismLuck),
    bondMul: 1,
    itemCap: 1,
    perks: {},
    build: { kind: build.kind, id: build.id, name: build.name, icon: build.icon, tier: build.tier },
  };
  const P = m.perks;
  if (build.kind === 'main') {
    const t = build.tier;
    switch (build.id) {
      case 'speedster':
        m.statSpeed += 0.02;
        if (t >= 2) m.slipFillMul *= 0.6;
        if (t >= 3) P.afterburner = t >= 4 ? 1.0 : 0.5;
        if (t >= 4) P.launch = 2.0;
        break;
      case 'smasher':
        m.ultChargeMul *= 1.25;
        if (t >= 2) P.boostSmash = true;
        if (t >= 3) P.doubleUlt = true;
        if (t >= 4) P.shockwave = 5;
        break;
      case 'collector':
        m.magnetMul *= 1.5;
        if (t >= 2) P.sugarRush = 20;
        if (t >= 3) m.bondMul *= 1.2;
        if (t >= 4) P.goldenRide = 1.5;
        break;
      case 'trickster':
        m.perfectLate += 0.04;
        if (t >= 2) m.itemCap = 2;
        if (t >= 3) P.luckyPhase = 0.2;
        if (t >= 4) P.doubleItem = 0.25;
        break;
      default: break;
    }
  } else if (build.kind === 'hybrid') {
    P[build.id] = true;
  } else {
    // 🌈 Harmony (+ extra resilience when Sky Weather is active)
    m.statSpeed += opt.weather ? 0.025 : 0.01;
    m.ultChargeMul *= 1.05;
    m.magnetMul *= opt.weather ? 1.15 : 1.1;
  }
  if (opt.weather === 'tailwind') {
    m.statSpeed += 0.02;
    m.slipFillMul *= 0.85;
  }
  m.perfectLate = Math.min(0.26, m.perfectLate);
  return m;
}

/** Plain-language "next step" for the Build Card. */
export function buildNextStep(build) {
  if (!build?.next) return null;
  const n = build.next;
  const label = { swiftness: '⚡ Swiftness', power: '🔥 Power', fortune: '🪙 Fortune', luck: '🍀 Luck' }[n.stat];
  return { text: `+${Math.max(0, Math.ceil(n.need - n.have))} ${label} to reach Tier ${['', 'I', 'II', 'III', 'IV'][n.tier]}`, have: n.have, need: n.need };
}

// ============================================================================
// 📖 Build Collection Catalog (11 Builds: 4 Main + 6 Secret Hybrids + Balanced)
// ============================================================================
export const ALL_BUILDS = [
  { id: 'speedster', kind: 'main', name: 'Speedster', icon: '⚡', stat: 'swiftness', tip: BUILDS.speedster.tip, perks: BUILD_PERKS.speedster },
  { id: 'smasher', kind: 'main', name: 'Smasher', icon: '🔥', stat: 'power', tip: BUILDS.smasher.tip, perks: BUILD_PERKS.smasher },
  { id: 'collector', kind: 'main', name: 'Collector', icon: '🪙', stat: 'fortune', tip: BUILDS.collector.tip, perks: BUILD_PERKS.collector },
  { id: 'trickster', kind: 'main', name: 'Trickster', icon: '🍀', stat: 'luck', tip: BUILDS.trickster.tip, perks: BUILD_PERKS.trickster },
  { id: 'juggernaut', kind: 'hybrid', name: 'Juggernaut', icon: '⚡🔥', stats: ['swiftness', 'power'], tip: 'Secret Hybrid: Swiftness + Power (Tier II+)', perks: [HYBRIDS['swiftness+power'].perk] },
  { id: 'sugar_rocket', kind: 'hybrid', name: 'Sugar Rocket', icon: '⚡🪙', stats: ['swiftness', 'fortune'], tip: 'Secret Hybrid: Swiftness + Fortune (Tier II+)', perks: [HYBRIDS['swiftness+fortune'].perk] },
  { id: 'phantom', kind: 'hybrid', name: 'Phantom', icon: '⚡🍀', stats: ['swiftness', 'luck'], tip: 'Secret Hybrid: Swiftness + Luck (Tier II+)', perks: [HYBRIDS['swiftness+luck'].perk] },
  { id: 'treasure_breaker', kind: 'hybrid', name: 'Treasure Breaker', icon: '🔥🪙', stats: ['power', 'fortune'], tip: 'Secret Hybrid: Power + Fortune (Tier II+)', perks: [HYBRIDS['power+fortune'].perk] },
  { id: 'gambler', kind: 'hybrid', name: 'Gambler', icon: '🔥🍀', stats: ['power', 'luck'], tip: 'Secret Hybrid: Power + Luck (Tier II+)', perks: [HYBRIDS['power+luck'].perk] },
  { id: 'jackpot', kind: 'hybrid', name: 'Jackpot', icon: '🪙🍀', stats: ['fortune', 'luck'], tip: 'Secret Hybrid: Fortune + Luck (Tier II+)', perks: [HYBRIDS['fortune+luck'].perk] },
  { id: 'balanced', kind: 'balanced', name: 'Balanced', icon: '🌈', stat: null, tip: BUILDS.balanced.tip, perks: BUILD_PERKS.balanced },
];

/**
 * Compares before/after bonus stats for Live Build Preview toasts & Tier-Up / Hybrid celebrations.
 */
export function diffBuilds(beforeBonus = {}, afterBonus = {}) {
  const before = detectBuild(beforeBonus);
  const after = detectBuild(afterBonus);
  const deltas = {};
  let topStat = null, topAbs = 0;
  for (const k of STAT_ORDER) {
    const d = Math.round((afterBonus[k] || 0) - (beforeBonus[k] || 0));
    deltas[k] = d;
    if (Math.abs(d) > topAbs) { topAbs = Math.abs(d); topStat = k; }
  }
  const tierRoman = ['', 'I', 'II', 'III', '✦ IV'];
  const hybridDiscovered = after.kind === 'hybrid' && (before.kind !== 'hybrid' || before.id !== after.id);
  const tierUp = after.kind === 'main' && (before.id === after.id ? after.tier > before.tier : after.tier >= 1 && before.kind === 'balanced');
  const buildChanged = after.id !== before.id || after.tier !== before.tier;
  const statIco = { swiftness: '⚡', power: '🔥', fortune: '🪙', luck: '🍀' };
  let toast = '';
  if (hybridDiscovered) {
    toast = `🔍 SECRET HYBRID! You unlocked ${after.icon} ${after.name.toUpperCase()}!`;
  } else if (tierUp) {
    toast = `🎉 TIER UP! ${after.icon.repeat(Math.min(3, after.tier))} ${after.name.toUpperCase()} ${tierRoman[after.tier]}!`;
  } else if (after.id !== before.id) {
    toast = `🧬 Build shifts → ${after.icon} ${after.name}${after.kind === 'main' ? ` ${tierRoman[after.tier]}` : ''}`;
  } else if (topStat && deltas[topStat] !== 0) {
    const sign = deltas[topStat] > 0 ? `+${deltas[topStat]}` : `${deltas[topStat]}`;
    if (after.next && after.next.stat === topStat) {
      const rem = Math.max(0, Math.ceil(after.next.need - after.next.have));
      toast = `${statIco[topStat]} ${sign} → ${rem} more to ${after.name === 'Balanced' ? BUILDS[after.next.build || 'speedster']?.name || 'Tier I' : `${after.name} ${tierRoman[after.next.tier]}`}!`;
    } else {
      toast = `${statIco[topStat]} ${sign} (${after.icon} ${after.name}${after.kind === 'main' ? ` ${tierRoman[after.tier]}` : ''})`;
    }
  }
  return { before, after, deltas, topStat, buildChanged, tierUp, hybridDiscovered, toast };
}

// ============================================================================
// 🌦️ Weekly Sky Weather (deterministic by UTC ISO week, spotlights each build)
// ============================================================================
export const SKY_WEATHERS = [
  { id: 'storm', name: 'Storm Week', icon: '⛈️', focus: 'smasher', focusName: 'Smashers', focusIcon: '🔥', banner: '⛈️ Storm Week — Smashers shine! 🔥', desc: 'Extra storm clouds on the road — boost through to smash them!' },
  { id: 'jelly', name: 'Jelly Festival', icon: '🍬', focus: 'collector', focusName: 'Collectors', focusIcon: '🪙', banner: '🍬 Jelly Festival — Collectors shine! 🪙', desc: 'Extra Berry Jellies across all zones — Sugar Rush & Paw Rings fill fast!' },
  { id: 'tailwind', name: 'Tailwind Week', icon: '🌬️', focus: 'speedster', focusName: 'Speedsters', focusIcon: '⚡', banner: '🌬️ Tailwind Week — Speedsters shine! ⚡', desc: 'Extra speed pads & faster slipstream drafting across the sky!' },
  { id: 'prism', name: 'Prism Party', icon: '🎁', focus: 'trickster', focusName: 'Tricksters', focusIcon: '🍀', banner: '🎁 Prism Party — Tricksters shine! 🍀', desc: 'Extra Mystery Prism rows — double item chaos!' },
];

export function getWeeklyWeather(nowMs = Date.now()) {
  const weekIdx = Math.floor(Math.max(0, Number(nowMs) || 0) / (7 * 86400_000)) % SKY_WEATHERS.length;
  return SKY_WEATHERS[weekIdx];
}

// ============================================================================
// 🏆 Cloud League Ranked Ladder (Bronze → Silver → Gold → Rainbow → Sovereign)
// ============================================================================
export const CLOUD_LEAGUE_TIERS = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', minLp: 0, maxLp: 299, floor: true },
  { id: 'silver', name: 'Silver', icon: '🥈', minLp: 300, maxLp: 599, floor: true },
  { id: 'gold', name: 'Gold', icon: '🥇', minLp: 600, maxLp: 999, floor: false },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈', minLp: 1000, maxLp: 1499, floor: false },
  { id: 'sovereign', name: 'Sovereign', icon: '👑', minLp: 1500, maxLp: 99999, floor: false },
];

export const LEAGUE_LP_DELTA = [35, 18, 5, -10];

export function leagueTierFor(lp = 0) {
  const v = Math.max(0, lp | 0);
  let cur = CLOUD_LEAGUE_TIERS[0];
  for (const t of CLOUD_LEAGUE_TIERS) if (v >= t.minLp) cur = t;
  const idx = CLOUD_LEAGUE_TIERS.indexOf(cur);
  const next = CLOUD_LEAGUE_TIERS[idx + 1] || null;
  return { ...cur, lp: v, nextMinLp: next ? next.minLp : null, nextName: next ? next.name : null, nextIcon: next ? next.icon : null };
}

export function computeLeagueDelta(place = 4, currentLp = 0) {
  const cur = leagueTierFor(currentLp);
  const rawDelta = LEAGUE_LP_DELTA[Math.max(0, Math.min(3, (place | 0) - 1))] ?? -10;
  const floorLp = cur.floor ? cur.minLp : 0;
  const nextLp = Math.max(floorLp, (currentLp | 0) + rawDelta);
  const after = leagueTierFor(nextLp);
  const promoted = CLOUD_LEAGUE_TIERS.findIndex((t) => t.id === after.id) > CLOUD_LEAGUE_TIERS.findIndex((t) => t.id === cur.id);
  return { beforeLp: currentLp | 0, afterLp: nextLp, delta: nextLp - (currentLp | 0), beforeTier: cur, afterTier: after, promoted };
}

// ============================================================================
// 🔁 Daily Sky Chests, Chest Progress Bar & 3 Rotating Dash Missions (§9)
// ============================================================================
export const DASH_DAILY_CHEST_MAX = 3;
export const DASH_CHEST_BAR_MAX = 100;

export const DASH_MISSION_POOL = [
  { id: 'ride_2', icon: '🐾', title: 'Ride your Pet 2 times', stat: 'rides', target: 2, reward: { gold: 300, berries: 15, diamonds: 5 } },
  { id: 'perfect_6', icon: '⚡', title: 'Land 6 NICE DASH! jumps', stat: 'perfects', target: 6, reward: { gold: 300, berries: 25, diamonds: 4 } },
  { id: 'close_4', icon: '😎', title: 'Pull off 4 Close Calls', stat: 'nearMisses', target: 4, reward: { gold: 300, berries: 20, diamonds: 5 } },
  { id: 'top2_2', icon: '🏆', title: 'Finish Top 2 twice', stat: 'top2', target: 2, reward: { gold: 400, berries: 20, diamonds: 8 } },
  { id: 'style_2500', icon: '✨', title: 'Score 2,500 Style across races', stat: 'style', target: 2500, reward: { gold: 350, berries: 25, diamonds: 5 } },
  { id: 'coins_80', icon: '🍬', title: 'Collect 80 Jellies', stat: 'coins', target: 80, reward: { gold: 300, berries: 25, diamonds: 4 } },
  { id: 'ult_2', icon: '🌈', title: 'Unleash 2 Costume Ultimates', stat: 'ults', target: 2, reward: { gold: 350, berries: 20, diamonds: 6 } },
  { id: 'showcase_3', icon: '🏎️', title: 'Hit 3 Apexes or Vaults', stat: 'showcases', target: 3, reward: { gold: 350, berries: 20, diamonds: 6 } },
];

export function dailyMissionsForDay(dayKey = '2026-10-19') {
  let h = 2166136261 >>> 0;
  const s = String(dayKey || '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  const picked = [];
  const pool = DASH_MISSION_POOL.slice();
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const idx = h % pool.length;
    const m = pool.splice(idx, 1)[0];
    picked.push({ id: m.id, icon: m.icon, title: m.title, stat: m.stat, target: m.target, progress: 0, done: false, reward: { ...m.reward } });
  }
  return picked;
}

export function ensureDashDaily(profile, dayKey) {
  if (!profile) return null;
  const dk = String(dayKey || new Date().toISOString().slice(0, 10));
  if (!profile.dash_daily || profile.dash_daily.day !== dk || !Array.isArray(profile.dash_daily.missions)) {
    profile.dash_daily = {
      day: dk,
      chests: 0,
      chestPts: profile.dash_daily?.chestPts | 0, // Chest bar carries over across days!
      missions: dailyMissionsForDay(dk),
    };
  }
  return profile.dash_daily;
}

