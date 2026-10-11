/**
 * Nook Airline — Daily Flight Log engine (server-authoritative)
 * 📞 call-time payouts · 🔥 couple streak · 📋 daily quests
 *
 * State lives inside the Vault profiles so it persists with everything else:
 *   vault.couple            → shared streak
 *   vault[role].daily       → today's quests + call minutes for one person
 */
const Rewards = require('./public/rewards.js');

const D = Rewards.DAILY;
const ROLES = ['bkk', 'dxb'];

module.exports = function createDaily({ vault, persistVault, sendToRole, broadcastVault, features }) {
  const lastCallTick = { bkk: 0, dxb: 0 };
  const lastHugAt = { bkk: 0, dxb: 0 };

  function couple() {
    if (!vault.couple || typeof vault.couple !== 'object') vault.couple = {};
    const c = vault.couple;
    c.streak = c.streak || 0;
    c.best = c.best || 0;
    c.lastDay = c.lastDay || '';
    c.freezes = c.freezes || 0;
    c.checkins = c.checkins || { bkk: '', dxb: '' };
    c.history = Array.isArray(c.history) ? c.history : [];
    return c;
  }

  /** Make sure `role` has a daily record for today (rolls fresh quests at reset). */
  function ensureDay(role) {
    const p = vault[role];
    const today = Rewards.dayKey();
    if (!p.daily || p.daily.day !== today) {
      p.daily = {
        day: today,
        quests: Rewards.questsFor(today, role, features()).map((q) => ({ id: q.id, progress: 0, claimed: false })),
        bonusClaimed: false,
        callMin: 0,
        callPaid: 0
      };
    }
    return p.daily;
  }

  function pay(role, amount) {
    const p = vault[role];
    p.diamonds += amount;
    p.stats = p.stats || {};
    p.stats.earned = (p.stats.earned || 0) + amount;
  }

  function reward(role, payload) {
    sendToRole(role, { type: 'vault_reward', role, ...payload });
  }

  // -------------------------------------------------------------------------
  // 🔥 Couple streak
  // -------------------------------------------------------------------------
  function checkIn(role) {
    if (!ROLES.includes(role)) return;
    ensureDay(role);
    const c = couple();
    const today = Rewards.dayKey();
    let changed = false;
    if (c.checkins[role] !== today) { c.checkins[role] = today; changed = true; }

    const bothIn = c.checkins.bkk === today && c.checkins.dxb === today;
    if (bothIn && c.lastDay !== today) {
      const gap = Rewards.daysBetween(c.lastDay, today);
      let usedFreeze = false;
      if (!c.lastDay) c.streak = 1;
      else if (gap === 1) c.streak += 1;
      else if (gap === 2 && c.freezes > 0) { c.freezes -= 1; usedFreeze = true; c.streak += 1; }
      else c.streak = 1;

      c.lastDay = today;
      c.best = Math.max(c.best, c.streak);
      c.history.push(today);
      if (c.history.length > 60) c.history.splice(0, c.history.length - 60);

      const r = Rewards.streakReward(c.streak);
      let freezeEarned = false;
      if (r.weekly && c.freezes < D.STREAK_FREEZE_MAX) { c.freezes += 1; freezeEarned = true; }
      ROLES.forEach((x) => pay(x, r.total));
      persistVault();
      broadcastVault();
      ROLES.forEach((x) => reward(x, {
        kind: 'streak', amount: r.total, streak: c.streak, best: c.best,
        weekly: r.weekly, monthly: r.monthly, usedFreeze, freezeEarned, freezes: c.freezes
      }));
      console.log(`[Daily] 🔥 Couple streak day ${c.streak}${usedFreeze ? ' (🧊 freeze used)' : ''} → +${r.total}💎 each`);
      return;
    }
    if (changed) persistVault();
  }

  // -------------------------------------------------------------------------
  // 📋 Quests
  // -------------------------------------------------------------------------
  /** Advance every quest of `role` that listens to `event`. */
  function track(role, event, amount = 1) {
    if (!ROLES.includes(role)) return;
    const d = ensureDay(role);
    let touched = false;
    const completed = [];
    d.quests.forEach((q) => {
      const def = Rewards.QUEST_BY_ID[q.id];
      if (!def || def.event !== event || q.claimed) return;
      const before = q.progress;
      q.progress = Math.min(def.goal, q.progress + amount);
      if (q.progress !== before) touched = true;
      if (before < def.goal && q.progress >= def.goal) completed.push(def);
    });
    if (!touched) return;
    persistVault();
    sendToRole(role, { type: 'vault_daily', role, daily: d });
    completed.forEach((def) => reward(role, { kind: 'quest_ready', questId: def.id, title: def.title, icon: def.icon, amount: def.reward }));
  }

  function claimQuest(role, questId) {
    const d = ensureDay(role);
    const q = d.quests.find((x) => x.id === questId);
    const def = Rewards.QUEST_BY_ID[questId];
    if (!q || !def) return { error: 'Unknown quest' };
    if (q.claimed) return { error: 'Already claimed' };
    if (q.progress < def.goal) return { error: 'Not finished yet' };
    q.claimed = true;
    pay(role, def.reward);
    persistVault();
    broadcastVault();
    reward(role, { kind: 'quest', questId, title: def.title, icon: def.icon, amount: def.reward });
    return { ok: true };
  }

  function claimBonus(role) {
    const d = ensureDay(role);
    if (d.bonusClaimed) return { error: 'Already opened' };
    if (!d.quests.every((q) => q.claimed)) return { error: 'Finish all quests first' };
    d.bonusClaimed = true;
    pay(role, D.ALL_QUESTS_BONUS);
    persistVault();
    broadcastVault();
    reward(role, { kind: 'bonus', amount: D.ALL_QUESTS_BONUS });
    return { ok: true };
  }

  /** Relayed (non-vault) messages that count toward quests. */
  function observe(role, message) {
    if (!message || !ROLES.includes(role)) return;
    if (message.type === 'avatar_hug' && message.action === 'start') {
      const now = Date.now();
      if (now - lastHugAt[role] < D.HUG_COOLDOWN_MS) return;
      lastHugAt[role] = now;
      track(role, 'hug');
    } else if (message.type === 'scene_change' || message.type === 'avatar_scenery') {
      track(role, 'scene');
    }
  }

  // -------------------------------------------------------------------------
  // 📞 Together time — both phones must report a live call
  // -------------------------------------------------------------------------
  function callTick(role) {
    if (ROLES.includes(role)) lastCallTick[role] = Date.now();
  }

  function minuteTick() {
    const now = Date.now();
    const live = ROLES.every((r) => now - lastCallTick[r] < D.CALL_TICK_WINDOW_MS);
    if (!live) return;
    ROLES.forEach((role) => {
      const d = ensureDay(role);
      d.callMin += 1;
      const chunks = Math.floor(d.callMin / D.CALL_CHUNK_MIN);
      if (chunks > d.callPaid && d.callPaid < D.CALL_DAILY_CHUNKS) {
        d.callPaid += 1;
        pay(role, D.CALL_CHUNK_REWARD);
        reward(role, { kind: 'call', amount: D.CALL_CHUNK_REWARD, minutes: d.callMin, chunk: d.callPaid, cap: D.CALL_DAILY_CHUNKS });
        console.log(`[Daily] 📞 ${role.toUpperCase()} ${d.callMin} min together → +${D.CALL_CHUNK_REWARD}💎 (${d.callPaid}/${D.CALL_DAILY_CHUNKS})`);
      }
    });
    persistVault();
    ROLES.forEach((role) => track(role, 'call', 1));
    // Light push so the Daily panel + call chip stay live without a full profile broadcast.
    ROLES.forEach((role) => sendToRole(role, { type: 'vault_daily', role, daily: vault[role].daily, profiles: { bkk: vault.bkk, dxb: vault.dxb, couple: vault.couple } }));
  }

  // NOOK_MINUTE_MS lets a local test run compress time; production uses real minutes.
  setInterval(minuteTick, Number(process.env.NOOK_MINUTE_MS) || 60000);

  return { ensureDay, checkIn, track, claimQuest, claimBonus, observe, callTick, couple };
};
