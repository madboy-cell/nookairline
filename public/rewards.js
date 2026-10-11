/**
 * Nook Airline — Daily Flight Log 🔥
 * Shared config for the server (authoritative) and the browser (display only):
 *   📞 Call-time rewards · 🔥 Couple streak · 📋 Daily quests
 *
 * The "day" is the UTC calendar day (resets 07:00 Bangkok / 04:00 Dubai) — the same
 * boundary the Vault already uses for the first-game-of-the-day bonus.
 */
(function (root) {
  const DAILY = {
    // 📞 Together time: every CALL_CHUNK_MIN minutes on a live call pays both of you
    CALL_CHUNK_MIN: 15,
    CALL_CHUNK_REWARD: 20,
    CALL_DAILY_CHUNKS: 5,          // cap: 5 × 20 = 100💎 per day (75 minutes)
    CALL_TICK_WINDOW_MS: 150000,   // a side counts as "on call" if it pinged within this window

    // 🔥 Couple streak: a day only counts when BOTH of you check in
    STREAK_DAILY: 20,
    STREAK_WEEKLY_BONUS: 150,      // every 7th day
    STREAK_MONTHLY_BONUS: 500,     // every 30th day (stacks with weekly when both hit)
    STREAK_FREEZE_MAX: 2,          // 🧊 earned on every weekly milestone, saves one missed day

    // 📋 Daily quests
    QUESTS_PER_DAY: 3,
    ALL_QUESTS_BONUS: 30,
    HUG_COOLDOWN_MS: 5000          // one hug counted per 5s (a full hug lasts ~6s anyway)
  };

  /**
   * Quest pool. `event` is what the server tracks; `group` keeps two quests of the same
   * kind from being rolled on the same day. `needs` gates quests behind features.
   */
  const QUESTS = [
    { id: 'hug3',      group: 'hug',      event: 'hug',      goal: 3,  reward: 25, icon: '🤗', title: 'Send 3 Warm Hugs',              hint: 'Tap the Warm Hug button' },
    { id: 'hug6',      group: 'hug',      event: 'hug',      goal: 6,  reward: 40, icon: '💞', title: 'Cuddle marathon: 6 Warm Hugs',  hint: 'Hugs while you talk count too',       needs: 'couple' },
    { id: 'call20',    group: 'call',     event: 'call',     goal: 20, reward: 30, icon: '📞', title: 'Talk for 20 minutes',           hint: 'Stay on a live call together',        needs: 'couple' },
    { id: 'call45',    group: 'call',     event: 'call',     goal: 45, reward: 50, icon: '🛫', title: 'Long-haul: talk for 45 minutes', hint: 'Stay on a live call together',        needs: 'couple' },
    { id: 'mono1',     group: 'monopoly', event: 'monopoly', goal: 1,  reward: 40, icon: '🎲', title: 'Finish a Sky Monopoly game',    hint: 'Win or lose, it counts' },
    { id: 'pull1',     group: 'pull',     event: 'pull',     goal: 1,  reward: 15, icon: '🎰', title: 'Make a Vault pull',             hint: 'Any banner, ×1 or ×10' },
    { id: 'equip1',    group: 'style',    event: 'equip',    goal: 1,  reward: 15, icon: '👗', title: 'Change your outfit',            hint: 'Wear something from the Wardrobe' },
    { id: 'scene1',    group: 'style',    event: 'scene',    goal: 1,  reward: 15, icon: '🌅', title: 'Change the cabin scenery',      hint: 'Open Scenery and pick a view' },
    { id: 'envelope1', group: 'gift',     event: 'envelope', goal: 1,  reward: 20, icon: '🧧', title: 'Send a red envelope',           hint: 'Even 💎1 with a sweet note counts',   needs: 'couple' },
    // 🐾 Purrst Class Lounge quests (only rolled once the cat lounge exists)
    { id: 'feed3',     group: 'catcare',  event: 'cat_feed', goal: 3,  reward: 25, icon: '🍣', title: 'Feed the cats 3 times',          hint: 'Open the Cat Lounge',      needs: 'cats' },
    { id: 'pet8',      group: 'catlove',  event: 'cat_pet',  goal: 8,  reward: 25, icon: '🫶', title: 'Pet the cats 8 times',           hint: 'Rub a cat until it purrs', needs: 'cats' },
    { id: 'play2',     group: 'catlove',  event: 'cat_play', goal: 2,  reward: 25, icon: '🪶', title: 'Play with a cat twice',          hint: 'Feather wand time!',       needs: 'cats' }
  ];
  const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

  function dayKey(d) {
    return (d || new Date()).toISOString().slice(0, 10);
  }
  function addDays(key, n) {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return dayKey(d);
  }
  function daysBetween(a, b) {
    if (!a || !b) return Infinity;
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  }
  /** Milliseconds until the next daily reset. */
  function msToReset(now) {
    const n = now || new Date();
    const next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
    return next - n.getTime();
  }

  // Small deterministic PRNG so the same day + role always rolls the same quests.
  function seedOf(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  /** The quests for one person on one day. features = { cats: true } unlocks gated quests. */
  function questsFor(day, role, features) {
    const f = features || {};
    const pool = QUESTS.filter((q) => !q.needs || f[q.needs]);
    const r = rng(seedOf(`${day}:${role}:nook`));
    const shuffled = pool.slice().sort(() => r() - 0.5);
    // Cat lovers: once the lounge exists, always include one cat quest.
    const picked = [];
    const groups = new Set();
    if (f.cats) {
      const cat = shuffled.find((q) => q.needs === 'cats');
      if (cat) { picked.push(cat); groups.add(cat.group); }
    }
    for (const q of shuffled) {
      if (picked.length >= DAILY.QUESTS_PER_DAY) break;
      if (groups.has(q.group) || picked.includes(q)) continue;
      picked.push(q); groups.add(q.group);
    }
    return picked;
  }

  /** Rewards for completing streak day `n`. */
  function streakReward(n) {
    let total = DAILY.STREAK_DAILY;
    const weekly = n > 0 && n % 7 === 0;
    const monthly = n > 0 && n % 30 === 0;
    if (weekly) total += DAILY.STREAK_WEEKLY_BONUS;
    if (monthly) total += DAILY.STREAK_MONTHLY_BONUS;
    return { total, weekly, monthly };
  }

  const api = { DAILY, QUESTS, QUEST_BY_ID, dayKey, addDays, daysBetween, msToReset, questsFor, streakReward };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NookRewards = api;
})(typeof window !== 'undefined' ? window : globalThis);
