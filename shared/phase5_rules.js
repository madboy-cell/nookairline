// shared/phase5_rules.js — Town Hall, landmarks, Hall of Fame, Owl gifts, VIP, Passport, Calls.
// Pure math & constants shared across server and client. No I/O, no Math.random.

export const TOWNHALL = Object.freeze({
  ID: 'townhall:main',
  SIZE: 36,
  HALF: 18,
  TRIGGER_R: 2.4,
  LANDMARKS: Object.freeze([
    Object.freeze({ id: 'fountain', label: 'Starlight Fountain', icon: '⛲', x: 0, z: 0, action: 'gacha_shard_shop' }),
    Object.freeze({ id: 'statue_1', label: 'Architect Statue', icon: '🏰', x: -8, z: -13, action: 'hall_of_fame', category: 'architect' }),
    Object.freeze({ id: 'statue_2', label: 'Gear Statue', icon: '⚔️', x: -4, z: -14, action: 'hall_of_fame', category: 'gear' }),
    Object.freeze({ id: 'statue_3', label: 'Arcade Statue', icon: '🕹️', x: 0, z: -14.5, action: 'hall_of_fame', category: 'arcade' }),
    Object.freeze({ id: 'statue_4', label: 'Tycoon Statue', icon: '🪙', x: 4, z: -14, action: 'hall_of_fame', category: 'tycoon' }),
    Object.freeze({ id: 'statue_5', label: 'Couple Statue', icon: '💞', x: 8, z: -13, action: 'hall_of_fame', category: 'couple' }),
    Object.freeze({ id: 'casino_palace', label: 'Casino Palace', icon: '🎰', x: -10.5, z: -5.5, action: 'table_hub_casino' }),
    Object.freeze({ id: 'monopoly_arch', label: 'Monopoly Arch', icon: '🎲', x: 10.5, z: -5.5, action: 'table_hub_monopoly' }),
    Object.freeze({ id: 'forge', label: 'Sovereign Forge', icon: '🔨', x: 9.5, z: 3.5, action: 'forge' }),
    Object.freeze({ id: 'owl_postbox', label: 'Owl Postbox', icon: '📮', x: -9.5, z: 3.5, action: 'owl_postbox' }),
    Object.freeze({ id: 'vip_table_1', label: 'VIP Table 1', icon: '🪑', x: -6, z: 8.5, action: 'table_hub_sit' }),
    Object.freeze({ id: 'vip_table_2', label: 'VIP Table 2', icon: '🪑', x: 6, z: 8.5, action: 'table_hub_sit' }),
  ]),
});

export const HALL_CATEGORIES = Object.freeze([
  Object.freeze({
    key: 'architect',
    label: 'Grand Architect',
    icon: '🏰',
    value: (p) => (p?.village?.castle_lv || 1) * 1000 + (p?.village?.comfort || 0),
  }),
  Object.freeze({
    key: 'gear',
    label: 'Grand Warrior',
    icon: '⚔️',
    value: (p) => p?.cp || 0,
  }),
  Object.freeze({
    key: 'arcade',
    label: 'Arcade Master',
    icon: '🕹️',
    value: (p) => p?.arcade_best || 0,
  }),
  Object.freeze({
    key: 'tycoon',
    label: 'Monopoly Tycoon',
    icon: '🪙',
    value: (p) => p?.mono_stats?.goldWon || 0,
  }),
  Object.freeze({
    key: 'couple',
    label: 'Star Couple',
    icon: '💞',
    value: (p) => p?.couple_streak || 0,
  }),
]);

export const QUESTS = Object.freeze({
  play: Object.freeze({ key: 'play', label: 'Play Match or Casino Hand', goal: 1, reward: 25, icon: '🎲' }),
  harvest: Object.freeze({ key: 'harvest', label: 'Harvest Island', goal: 1, reward: 40, icon: '🌾' }),
  pet: Object.freeze({ key: 'pet', label: 'Pet Companion 3 Times', goal: 3, reward: 25, icon: '🐾' }),
});

export const PASSPORT = Object.freeze({
  BONUS: 30,
  STAMP_EVERY: 7,
  STAMP_PARCEL: Object.freeze({
    tickets: 2,
    diamonds: 100,
  }),
});

export const STREAK = Object.freeze({
  DAILY_DIAMONDS: 20,
  DAY7_DIAMONDS: 170,
  DAY7_TICKETS: 2,
  DAY7_FREEZE: 1,
  DAY30_DIAMONDS: 520,
});

export const OWL = Object.freeze({
  MIN_LEVEL: 10,
  DAILY: 3,
  POSTAGE: 50,
  POSTAGE_PARTNER: 25,
  MAX_BERRIES: 200,
  NOTE_MAX: 80,
  RIBBONS: Object.freeze(['pink', 'gold', 'sky', 'mint']),
  MAILBOX_MAX: 50,
});

export const VIP_CARDS = Object.freeze({
  call_day_pass: Object.freeze({
    key: 'call_day_pass',
    bagKey: 'vip_call_day_pass',
    label: 'Call Day Pass',
    diamonds: 300,
    durationMs: 24 * 60 * 60 * 1000,
  }),
  vip_communicator: Object.freeze({
    key: 'vip_communicator',
    bagKey: 'vip_communicator',
    label: 'VIP Communicator',
    diamonds: 2500,
    shards: 200,
  }),
  telelink_box: Object.freeze({
    key: 'telelink_box',
    bagKey: 'vip_telelink_box',
    label: 'Telelink Box',
    diamonds: 4500,
  }),
  black_vip: Object.freeze({
    key: 'black_vip',
    bagKey: 'vip_black',
    label: 'Black VIP Card',
    diamonds: 9900,
  }),
});

export const FOUNDER = Object.freeze({
  IDS: Object.freeze(['nook', 'neen', 'beam', 'mochi', 'leo']),
  CODE: 'SKYPARTY-V1',
  CODE_ENABLED: true,
  DIAMONDS: 1000,
  ESSENCE: 40,
  TITLE: 'Sky Party Founder',
  MYTHIC_BOX: 'mythic_selector_box',
});

export const CALL = Object.freeze({
  CHUNK_MS: 15 * 60 * 1000,
  DIAMONDS: 20,
  DIAMONDS_BLACK: 30,
  EXP: 50,
  RING_MS: 30000,
  GRACE_MS: 15000,
  SIGNAL_MAX: 16384,
});

export const CHEER = Object.freeze({
  WINDOW_MS: 10000,
  GOLD: 50,
});

export const WORSHIP = Object.freeze({
  GOLD: 200,
  DIAMONDS: 15,
});

export const NOOK_NEEN_COUPLE_SINCE = '2026-10-05';

export function utcDay(now = Date.now()) {
  const d = typeof now === 'number' ? new Date(now) : (now instanceof Date ? now : new Date(now));
  return d.toISOString().slice(0, 10);
}

export function coupleDaysSince(coupleSince, now = Date.now()) {
  if (!coupleSince) return 0;
  const sinceDay = typeof coupleSince === 'number'
    ? new Date(coupleSince).toISOString().slice(0, 10)
    : String(coupleSince).slice(0, 10);
  const sinceMs = Date.parse(`${sinceDay}T00:00:00.000Z`);
  if (!Number.isFinite(sinceMs)) return 0;
  const todayDay = utcDay(now);
  const todayMs = Date.parse(`${todayDay}T00:00:00.000Z`);
  if (!Number.isFinite(todayMs) || todayMs < sinceMs) return 0;
  return Math.floor((todayMs - sinceMs) / 86400000) + 1;
}

export function yesterday(day) {
  if (typeof day === 'number') {
    return new Date(day - 86400000).toISOString().slice(0, 10);
  }
  const str = String(day);
  const t = Date.parse(str.includes('T') ? str : `${str}T00:00:00.000Z`);
  return new Date(t - 86400000).toISOString().slice(0, 10);
}

