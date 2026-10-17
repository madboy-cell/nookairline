// server/daily_service.js — Phase 5 daily features: Hall of Fame, Cheer, Owl Gifts, VIP Cards, Passport, Couple Streak, Founder.
import {
  HALL_CATEGORIES, QUESTS, PASSPORT, STREAK, OWL, VIP_CARDS, FOUNDER, CHEER, WORSHIP,
  utcDay, yesterday,
} from '../shared/phase5_rules.js';

/**
 * Ensures all Phase 5 profile fields exist lazily and idempotently per Section 0.
 */
export function ensurePhase5(p) {
  if (!p) return p;

  if (p.gold === undefined) p.gold = 0;
  if (p.diamonds === undefined) p.diamonds = 0;
  if (p.berries === undefined) p.berries = 0;
  if (p.shards === undefined) p.shards = 0;
  if (p.star_essence === undefined) p.star_essence = 0;
  if (!Array.isArray(p.friends)) p.friends = [];
  if (!p.bag_items || typeof p.bag_items !== 'object') p.bag_items = {};
  if (!p.inventory || typeof p.inventory !== 'object') p.inventory = {};
  if (!p.equipped || typeof p.equipped !== 'object') p.equipped = {};
  if (!p.village || typeof p.village !== 'object') p.village = {};
  if (!p.village.decor || typeof p.village.decor !== 'object') p.village.decor = {};

  if (p.worship_day === undefined) p.worship_day = null;
  if (p.worship_count === undefined) p.worship_count = 0;

  if (!p.mono_stats || typeof p.mono_stats !== 'object') p.mono_stats = {};
  if (p.mono_stats.goldWon === undefined) p.mono_stats.goldWon = 0;

  if (p.arcade_best === undefined) p.arcade_best = 0;

  if (!Array.isArray(p.mailbox)) p.mailbox = [];

  if (!p.owl_sent || typeof p.owl_sent !== 'object') {
    p.owl_sent = { day: null, count: 0 };
  } else {
    if (p.owl_sent.count === undefined) p.owl_sent.count = 0;
  }

  if (!p.vip || typeof p.vip !== 'object') {
    p.vip = { call_until: 0, communicator: false, black: false, telelinks: [] };
  } else {
    p.vip.call_until = p.vip.call_until || 0;
    p.vip.communicator = !!p.vip.communicator;
    p.vip.black = !!p.vip.black;
    p.vip.telelinks = Array.isArray(p.vip.telelinks) ? p.vip.telelinks : [];
  }

  if (!p.passport || typeof p.passport !== 'object') {
    p.passport = {
      day: null,
      progress: { play: 0, harvest: 0, pet: 0 },
      claimed: { play: false, harvest: false, pet: false, bonus: false },
      stamps: 0,
    };
  } else {
    p.passport.progress = p.passport.progress || { play: 0, harvest: 0, pet: 0 };
    p.passport.claimed = p.passport.claimed || { play: false, harvest: false, pet: false, bonus: false };
    if (p.passport.stamps === undefined) p.passport.stamps = 0;
  }

  if (p.login_day === undefined) p.login_day = null;
  if (p.couple_streak === undefined) p.couple_streak = 0;
  if (p.couple_streak_day === undefined) p.couple_streak_day = null;

  if (p.founder_claimed === undefined) p.founder_claimed = false;

  if (!Array.isArray(p.titles)) {
    p.titles = p.title ? [p.title] : [];
  } else if (p.title && !p.titles.includes(p.title)) {
    p.titles.push(p.title);
  }

  if (!p.casino_daily || typeof p.casino_daily !== 'object') {
    p.casino_daily = { day: null, chests: 0, net: 0, hands: 0 };
  }

  if (!p.call_stats || typeof p.call_stats !== 'object') {
    p.call_stats = { day: null, chunks: 0 };
  }

  return p;
}

/**
 * Creates the daily service for Phase 5 RPG features.
 */
export function createDailyService({
  db,
  now = Date.now,
  sendTo = () => {},
  broadcastAll = () => {},
  pushProfile = () => {},
  rng = Math.random,
  listProfiles,
} = {}) {
  // In-memory cheer banners: cheerId -> { cheerId, winnerId, winnerName, achievement, expiresAt, claimed: Set }
  const activeCheers = new Map();

  function getAllProfiles() {
    if (typeof listProfiles === 'function') {
      return listProfiles();
    }
    if (db?.profiles instanceof Map) {
      return [...db.profiles.values()];
    }
    if (typeof db?.allProfiles === 'function') {
      return db.allProfiles();
    }
    if (Array.isArray(db?.profiles)) {
      return db.profiles;
    }
    return [];
  }

  function hallList(p) {
    ensurePhase5(p);
    const today = utcDay(now());
    const worshippedToday = (p.worship_day === today);

    const all = getAllProfiles();
    for (const prof of all) ensurePhase5(prof);

    const categories = HALL_CATEGORIES.map((cat) => {
      const sorted = [...all].sort((a, b) => {
        const diff = (cat.value(b) || 0) - (cat.value(a) || 0);
        if (diff !== 0) return diff;
        const cpDiff = (b.cp || 0) - (a.cp || 0);
        if (cpDiff !== 0) return cpDiff;
        return (a.id || '').localeCompare(b.id || '');
      });
      const rows = sorted.slice(0, 10).map((prof, idx) => ({
        rank: idx + 1,
        userId: prof.id,
        username: prof.username || prof.id,
        value: cat.value(prof),
        title: prof.title || null,
        cp: prof.cp || 0,
        worship_count: prof.worship_count || 0,
      }));
      return {
        key: cat.key,
        label: cat.label,
        icon: cat.icon,
        rows,
      };
    });

    return {
      ok: true,
      day: today,
      worshippedToday,
      categories,
    };
  }

  function hallWorship(p) {
    ensurePhase5(p);
    const today = utcDay(now());
    if (p.worship_day === today) {
      return { ok: false, error: 'already_worshipped' };
    }

    const all = getAllProfiles();
    for (const prof of all) ensurePhase5(prof);

    const championIds = new Set();
    for (const cat of HALL_CATEGORIES) {
      const sorted = [...all].sort((a, b) => {
        const diff = (cat.value(b) || 0) - (cat.value(a) || 0);
        if (diff !== 0) return diff;
        const cpDiff = (b.cp || 0) - (a.cp || 0);
        if (cpDiff !== 0) return cpDiff;
        return (a.id || '').localeCompare(b.id || '');
      });
      if (sorted[0]) {
        championIds.add(sorted[0].id);
      }
    }

    const champions = [...championIds];
    for (const champId of champions) {
      const champ = db?.getProfile?.(champId);
      if (champ) {
        ensurePhase5(champ);
        champ.worship_count = (champ.worship_count || 0) + 1;
        db?.markProfile?.(champ.id);
        pushProfile(champ);
      }
    }

    p.worship_day = today;
    p.gold = (p.gold || 0) + WORSHIP.GOLD;
    p.diamonds = (p.diamonds || 0) + WORSHIP.DIAMONDS;
    db?.markProfile?.(p.id);
    pushProfile(p);

    return {
      ok: true,
      gold: WORSHIP.GOLD,
      diamonds: WORSHIP.DIAMONDS,
      champions,
    };
  }

  function emitCheer({ winnerId, winnerName, achievement }) {
    const nowMs = now();
    const cheerId = `c_${nowMs}_${Math.floor(rng() * 1e6)}`;
    const expiresAt = nowMs + CHEER.WINDOW_MS;
    const record = {
      cheerId,
      winnerId: String(winnerId || ''),
      winnerName: winnerName || winnerId,
      achievement,
      expiresAt,
      claimed: new Set(),
    };
    activeCheers.set(cheerId, record);
    broadcastAll({
      type: 'global_cheer_banner',
      cheerId,
      winnerName: record.winnerName,
      achievement,
      expiresAt,
    });
    return { cheerId, expiresAt };
  }

  function cheerClaim(p, { cheerId }) {
    ensurePhase5(p);
    const nowMs = now();
    const cheer = activeCheers.get(cheerId);
    if (!cheer || cheer.expiresAt < nowMs) {
      return { ok: false, error: 'cheer_expired' };
    }
    if (cheer.winnerId && cheer.winnerId.toLowerCase() === (p.id || '').toLowerCase()) {
      return { ok: false, error: 'own_cheer' };
    }
    const pid = (p.id || '').toLowerCase();
    if (cheer.claimed.has(pid)) {
      return { ok: false, error: 'already_cheered' };
    }

    cheer.claimed.add(pid);
    p.gold = (p.gold || 0) + CHEER.GOLD;
    db?.markProfile?.(p.id);
    pushProfile(p);

    return { ok: true, gold: CHEER.GOLD };
  }

  function owlSendGift(p, m) {
    ensurePhase5(p);
    if ((p.level || 1) < OWL.MIN_LEVEL) {
      return { ok: false, error: 'level_too_low' };
    }

    if (!m?.to) return { ok: false, error: 'no_such_user' };
    const recipient = db?.getProfile?.(m.to);
    if (!recipient) return { ok: false, error: 'no_such_user' };
    if (recipient.id.toLowerCase() === (p.id || '').toLowerCase()) {
      return { ok: false, error: 'not_friend' };
    }

    const isPartner = !!(p.partner_id && p.partner_id.toLowerCase() === recipient.id.toLowerCase());
    const isFriend = Array.isArray(p.friends) && p.friends.some((f) => f.toLowerCase() === recipient.id.toLowerCase());
    if (!isPartner && !isFriend) {
      return { ok: false, error: 'not_friend' };
    }

    const today = utcDay(now());
    if (p.owl_sent.day !== today) {
      p.owl_sent = { day: today, count: 0 };
    }
    if (p.owl_sent.count >= OWL.DAILY) {
      return { ok: false, error: 'daily_limit' };
    }

    const { slot1, slot2 } = m || {};
    if (!slot1 && !slot2) {
      return { ok: false, error: 'empty_parcel' };
    }

    const postage = isPartner ? OWL.POSTAGE_PARTNER : OWL.POSTAGE;
    let extraBerries = 0;

    if (slot2) {
      if (slot2.kind === 'berries') {
        const amt = slot2.amount;
        if (typeof amt !== 'number' || amt <= 0 || amt > OWL.MAX_BERRIES) {
          return { ok: false, error: 'invalid_berries' };
        }
        extraBerries = Math.floor(amt);
      } else if (slot2.kind === 'bag') {
        const allowed = ['streak_freeze', 'vip_call_day_pass', 'vip_communicator', 'vip_telelink_box', 'vip_black'];
        if (!allowed.includes(slot2.key)) return { ok: false, error: 'invalid_bag_key' };
        if ((p.bag_items?.[slot2.key] || 0) < 1) return { ok: false, error: 'insufficient_item' };
      } else {
        return { ok: false, error: 'invalid_slot2' };
      }
    }

    const totalBerries = postage + extraBerries;
    if ((p.berries || 0) < totalBerries) {
      return { ok: false, error: 'insufficient_berries' };
    }

    if (slot1) {
      if (slot1.kind === 'gear') {
        const itemId = slot1.itemId;
        const inv = p.inventory?.[itemId];
        if (!inv) return { ok: false, error: 'not_owned' };
        if (slot1.mode === 'dupe') {
          if ((inv.dupes || 0) < 1) return { ok: false, error: 'no_dupes' };
        } else if (slot1.mode === 'transfer') {
          if ((inv.dupes || 0) !== 0) return { ok: false, error: 'has_dupes' };
          const isEquipped = Object.values(p.equipped || {}).some((slot) => slot && slot.id === itemId);
          if (isEquipped) return { ok: false, error: 'item_equipped' };
        } else {
          return { ok: false, error: 'invalid_gear_mode' };
        }
      } else if (slot1.kind === 'decor') {
        if ((p.village?.decor?.[slot1.decId] || 0) < 1) return { ok: false, error: 'not_owned' };
      } else {
        return { ok: false, error: 'invalid_slot1' };
      }
    }

    const note = String(m.note || '').replace(/[<>]/g, '').trim().slice(0, OWL.NOTE_MAX);
    const ribbon = OWL.RIBBONS.includes(m.ribbon) ? m.ribbon : 'pink';

    // Deduct berries from sender
    p.berries -= totalBerries;

    const mailItems = [];
    if (slot1) {
      if (slot1.kind === 'gear') {
        const inv = p.inventory[slot1.itemId];
        if (slot1.mode === 'dupe') {
          inv.dupes -= 1;
          mailItems.push({ kind: 'gear', itemId: slot1.itemId, refine: 0, dupe: true });
        } else {
          const refine = inv.refine || 0;
          delete p.inventory[slot1.itemId];
          mailItems.push({ kind: 'gear', itemId: slot1.itemId, refine, dupe: false });
        }
      } else if (slot1.kind === 'decor') {
        p.village.decor[slot1.decId] -= 1;
        if (p.village.decor[slot1.decId] <= 0) delete p.village.decor[slot1.decId];
        mailItems.push({ kind: 'decor', decId: slot1.decId, count: 1 });
      }
    }

    if (slot2) {
      if (slot2.kind === 'bag') {
        p.bag_items[slot2.key] -= 1;
        if (p.bag_items[slot2.key] <= 0) delete p.bag_items[slot2.key];
        mailItems.push({ kind: 'bag', key: slot2.key, count: 1 });
      } else if (slot2.kind === 'berries') {
        mailItems.push({ kind: 'berries', amount: extraBerries });
      }
    }

    p.owl_sent.count += 1;

    ensurePhase5(recipient);
    const nowMs = now();
    const mailId = `m_${nowMs}_${Math.floor(rng() * 1e6)}`;
    const mail = {
      id: mailId,
      from: p.id,
      fromName: p.username || p.id,
      sentAt: nowMs,
      kind: 'gift',
      note,
      ribbon,
      items: mailItems,
      claimed: false,
    };

    recipient.mailbox.unshift(mail);
    if (recipient.mailbox.length > OWL.MAILBOX_MAX) {
      recipient.mailbox.length = OWL.MAILBOX_MAX;
    }

    db?.markProfile?.(p.id);
    db?.markProfile?.(recipient.id);
    pushProfile(p);
    pushProfile(recipient);

    sendTo(recipient.id, { type: 'owl_mail_arrived', mail });

    return {
      ok: true,
      mailId,
      postage,
      sentToday: p.owl_sent.count,
    };
  }

  function owlClaimMail(p, m) {
    ensurePhase5(p);
    const mail = p.mailbox.find((x) => x.id === m?.mailId);
    if (!mail) return { ok: false, error: 'no_such_mail' };
    if (mail.claimed) return { ok: false, error: 'already_claimed' };

    for (const item of mail.items || []) {
      if (item.kind === 'gear') {
        const inv = p.inventory[item.itemId];
        if (inv) {
          if (item.dupe) {
            inv.dupes = (inv.dupes || 0) + 1;
          } else {
            inv.refine = Math.max(inv.refine || 0, item.refine || 0);
            inv.dupes = (inv.dupes || 0) + 1;
          }
        } else {
          p.inventory[item.itemId] = { refine: item.refine || 0, dupes: 0 };
        }
      } else if (item.kind === 'decor') {
        p.village.decor[item.decId] = (p.village.decor[item.decId] || 0) + (item.count || 1);
      } else if (item.kind === 'bag') {
        p.bag_items[item.key] = (p.bag_items[item.key] || 0) + (item.count || 1);
      } else if (item.kind === 'berries') {
        p.berries = (p.berries || 0) + (item.amount || 0);
      } else if (item.kind === 'diamonds') {
        p.diamonds = (p.diamonds || 0) + (item.amount || 0);
      }
    }

    mail.claimed = true;
    db?.markProfile?.(p.id);
    pushProfile(p);

    return { ok: true, granted: mail.items };
  }

  function normalizeCardKey(card) {
    if (!card) return null;
    if (VIP_CARDS[card]) return card;
    if (card === 'vip_black') return 'black_vip';
    if (card === 'vip_telelink_box') return 'telelink_box';
    if (card === 'vip_call_day_pass') return 'call_day_pass';
    return null;
  }

  function bagKeyForCard(cardKey) {
    return VIP_CARDS[cardKey]?.bagKey;
  }

  function vipCardBuy(p, m) {
    ensurePhase5(p);
    const cardKey = normalizeCardKey(m?.card);
    if (!cardKey) return { ok: false, error: 'invalid_card' };

    const conf = VIP_CARDS[cardKey];
    let target = null;

    if (!m?.asGift && cardKey === 'telelink_box') {
      if (!m?.target) return { ok: false, error: 'target_required' };
      target = db?.getProfile?.(m.target);
      if (!target) return { ok: false, error: 'no_such_user' };
      if (target.id.toLowerCase() === (p.id || '').toLowerCase()) return { ok: false, error: 'invalid_target' };
      const isFriend = Array.isArray(p.friends) && p.friends.some((f) => f.toLowerCase() === target.id.toLowerCase());
      if (!isFriend) return { ok: false, error: 'not_friend' };
    }

    if (cardKey === 'vip_communicator' && m?.currency === 'shards') {
      if ((p.shards || 0) < conf.shards) return { ok: false, error: 'insufficient_shards' };
      p.shards -= conf.shards;
    } else {
      if ((p.diamonds || 0) < conf.diamonds) return { ok: false, error: 'insufficient_diamonds' };
      p.diamonds -= conf.diamonds;
    }

    if (m?.asGift) {
      const bKey = conf.bagKey;
      p.bag_items[bKey] = (p.bag_items[bKey] || 0) + 1;
      db?.markProfile?.(p.id);
      pushProfile(p);
      return { ok: true, card: cardKey, asGift: true, bagKey: bKey };
    }

    if (cardKey === 'call_day_pass') {
      const nowMs = now();
      const current = Math.max(p.vip.call_until || 0, nowMs);
      p.vip.call_until = current + conf.durationMs;
    } else if (cardKey === 'vip_communicator') {
      p.vip.communicator = true;
    } else if (cardKey === 'telelink_box') {
      ensurePhase5(target);
      if (!p.vip.telelinks.some((x) => x.toLowerCase() === target.id.toLowerCase())) {
        p.vip.telelinks.push(target.id);
      }
      if (!target.vip.telelinks.some((x) => x.toLowerCase() === p.id.toLowerCase())) {
        target.vip.telelinks.push(p.id);
      }
      db?.markProfile?.(target.id);
      pushProfile(target);
    } else if (cardKey === 'black_vip') {
      p.vip.black = true;
    }

    db?.markProfile?.(p.id);
    pushProfile(p);

    return { ok: true, card: cardKey, activated: true };
  }

  function vipCardUse(p, m) {
    ensurePhase5(p);
    const cardKey = normalizeCardKey(m?.card);
    if (!cardKey) return { ok: false, error: 'invalid_card' };

    const conf = VIP_CARDS[cardKey];
    const bKey = conf.bagKey;
    if ((p.bag_items?.[bKey] || 0) < 1) {
      return { ok: false, error: 'not_owned' };
    }

    let target = null;
    if (cardKey === 'telelink_box') {
      if (!m?.target) return { ok: false, error: 'target_required' };
      target = db?.getProfile?.(m.target);
      if (!target) return { ok: false, error: 'no_such_user' };
      if (target.id.toLowerCase() === (p.id || '').toLowerCase()) return { ok: false, error: 'invalid_target' };
      const isFriend = Array.isArray(p.friends) && p.friends.some((f) => f.toLowerCase() === target.id.toLowerCase());
      if (!isFriend) return { ok: false, error: 'not_friend' };
    }

    p.bag_items[bKey] -= 1;
    if (p.bag_items[bKey] <= 0) delete p.bag_items[bKey];

    if (cardKey === 'call_day_pass') {
      const nowMs = now();
      const current = Math.max(p.vip.call_until || 0, nowMs);
      p.vip.call_until = current + conf.durationMs;
    } else if (cardKey === 'vip_communicator') {
      p.vip.communicator = true;
    } else if (cardKey === 'telelink_box') {
      ensurePhase5(target);
      if (!p.vip.telelinks.some((x) => x.toLowerCase() === target.id.toLowerCase())) {
        p.vip.telelinks.push(target.id);
      }
      if (!target.vip.telelinks.some((x) => x.toLowerCase() === p.id.toLowerCase())) {
        target.vip.telelinks.push(p.id);
      }
      db?.markProfile?.(target.id);
      pushProfile(target);
    } else if (cardKey === 'black_vip') {
      p.vip.black = true;
    }

    db?.markProfile?.(p.id);
    pushProfile(p);

    return { ok: true, card: cardKey, activated: true };
  }

  function syncPassportDay(p) {
    const today = utcDay(now());
    if (p.passport.day !== today) {
      p.passport = {
        day: today,
        progress: { play: 0, harvest: 0, pet: 0 },
        claimed: { play: false, harvest: false, pet: false, bonus: false },
        stamps: p.passport.stamps || 0,
      };
    }
  }

  function passportState(p) {
    ensurePhase5(p);
    syncPassportDay(p);

    const quests = Object.values(QUESTS).map((q) => ({
      key: q.key,
      label: q.label,
      goal: q.goal,
      progress: Math.min(p.passport.progress[q.key] || 0, q.goal),
      reward: q.reward,
      claimed: !!p.passport.claimed[q.key],
    }));

    return {
      ok: true,
      passport: p.passport,
      quests,
      bonus: {
        reward: PASSPORT.BONUS,
        claimed: !!p.passport.claimed.bonus,
      },
      stamps: p.passport.stamps || 0,
    };
  }

  function passportClaim(p, m) {
    ensurePhase5(p);
    syncPassportDay(p);

    const quest = m?.quest;
    if (!['play', 'harvest', 'pet', 'bonus'].includes(quest)) {
      return { ok: false, error: 'invalid_quest' };
    }

    if (p.passport.claimed[quest]) {
      return { ok: false, error: 'already_claimed' };
    }

    if (quest !== 'bonus') {
      const qConfig = QUESTS[quest];
      if ((p.passport.progress[quest] || 0) < qConfig.goal) {
        return { ok: false, error: 'goal_not_reached' };
      }
      p.passport.claimed[quest] = true;
      p.diamonds = (p.diamonds || 0) + qConfig.reward;
      db?.markProfile?.(p.id);
      pushProfile(p);
      return { ok: true, quest, reward: qConfig.reward, diamonds: p.diamonds };
    }

    // Bonus claim
    if (!p.passport.claimed.play || !p.passport.claimed.harvest || !p.passport.claimed.pet) {
      return { ok: false, error: 'quests_incomplete' };
    }

    p.passport.claimed.bonus = true;
    p.diamonds = (p.diamonds || 0) + PASSPORT.BONUS;
    p.passport.stamps = (p.passport.stamps || 0) + 1;

    let parcelMailed = false;
    if (p.passport.stamps % PASSPORT.STAMP_EVERY === 0) {
      const nowMs = now();
      const mailId = `m_${nowMs}_${Math.floor(rng() * 1e6)}`;
      const parcel = {
        id: mailId,
        from: 'system',
        fromName: 'Starlight Passport Office',
        sentAt: nowMs,
        kind: 'system',
        note: `Passport Milestone Stamp #${p.passport.stamps} Reward!`,
        ribbon: 'gold',
        items: [
          { kind: 'bag', key: 'ticket_standard', count: PASSPORT.STAMP_PARCEL.tickets },
          { kind: 'diamonds', amount: PASSPORT.STAMP_PARCEL.diamonds },
        ],
        claimed: false,
      };
      p.mailbox.unshift(parcel);
      if (p.mailbox.length > OWL.MAILBOX_MAX) {
        p.mailbox.length = OWL.MAILBOX_MAX;
      }
      parcelMailed = true;
      sendTo(p.id, { type: 'owl_mail_arrived', mail: parcel });
    }

    db?.markProfile?.(p.id);
    pushProfile(p);

    return {
      ok: true,
      quest: 'bonus',
      reward: PASSPORT.BONUS,
      stamps: p.passport.stamps,
      parcelMailed,
    };
  }

  function bumpQuest(p, key, n = 1) {
    ensurePhase5(p);
    syncPassportDay(p);

    if (key in p.passport.progress) {
      p.passport.progress[key] = (p.passport.progress[key] || 0) + n;
      db?.markProfile?.(p.id);
      return { ok: true, key, progress: p.passport.progress[key] };
    }
    return { ok: false, error: 'invalid_quest_key' };
  }

  function onDailyLogin(p) {
    ensurePhase5(p);
    const today = utcDay(now());
    const yest = yesterday(today);

    p.login_day = today;

    if (!p.partner_id) {
      db?.markProfile?.(p.id);
      return { ok: true, streak: 0, rewards: null };
    }

    const partner = db?.getProfile?.(p.partner_id);
    if (!partner) {
      db?.markProfile?.(p.id);
      return { ok: true, streak: 0, rewards: null };
    }

    ensurePhase5(partner);

    // Couple streak applies when both have logged in today and streak hasn't been applied today
    if (partner.login_day === today && p.couple_streak_day !== today) {
      const prevStreakDay = p.couple_streak_day || partner.couple_streak_day;
      let newStreak;
      let consumedFreeze = false;

      if (prevStreakDay === yest) {
        newStreak = (p.couple_streak || 0) + 1;
      } else if ((p.couple_streak || 0) > 0 && ((p.bag_items?.streak_freeze || 0) >= 1 || (partner.bag_items?.streak_freeze || 0) >= 1)) {
        if ((p.bag_items?.streak_freeze || 0) >= 1) {
          p.bag_items.streak_freeze -= 1;
          if (p.bag_items.streak_freeze <= 0) delete p.bag_items.streak_freeze;
        } else {
          partner.bag_items.streak_freeze -= 1;
          if (partner.bag_items.streak_freeze <= 0) delete partner.bag_items.streak_freeze;
        }
        consumedFreeze = true;
        newStreak = (p.couple_streak || 0) + 1;
      } else {
        newStreak = 1;
      }

      p.couple_streak = newStreak;
      partner.couple_streak = newStreak;
      p.couple_streak_day = today;
      partner.couple_streak_day = today;

      let diamonds = STREAK.DAILY_DIAMONDS;
      let tickets = 0;
      let freezes = 0;

      if (newStreak % 7 === 0) {
        diamonds += STREAK.DAY7_DIAMONDS;
        tickets += STREAK.DAY7_TICKETS;
        freezes += STREAK.DAY7_FREEZE;
      }
      if (newStreak % 30 === 0) {
        diamonds += STREAK.DAY30_DIAMONDS;
      }

      p.diamonds = (p.diamonds || 0) + diamonds;
      partner.diamonds = (partner.diamonds || 0) + diamonds;

      if (tickets > 0) {
        p.bag_items.ticket_standard = (p.bag_items.ticket_standard || 0) + tickets;
        partner.bag_items.ticket_standard = (partner.bag_items.ticket_standard || 0) + tickets;
      }
      if (freezes > 0) {
        p.bag_items.streak_freeze = (p.bag_items.streak_freeze || 0) + freezes;
        partner.bag_items.streak_freeze = (partner.bag_items.streak_freeze || 0) + freezes;
      }

      db?.markProfile?.(p.id);
      db?.markProfile?.(partner.id);
      pushProfile(p);
      pushProfile(partner);

      const rewards = { diamonds, tickets, freezes, consumedFreeze };
      const payload = { type: 'couple_streak_update', streak: newStreak, rewards };
      sendTo(p.id, payload);
      sendTo(partner.id, payload);

      return { ok: true, streak: newStreak, rewards };
    }

    db?.markProfile?.(p.id);
    return { ok: true, streak: p.couple_streak || 0, rewards: null };
  }

  function founderClaim(p, m) {
    ensurePhase5(p);
    if (p.founder_claimed) {
      return { ok: false, error: 'already_claimed' };
    }

    const isFounderId = FOUNDER.IDS.includes((p.id || '').toLowerCase());
    const isCodeValid = !!(FOUNDER.CODE_ENABLED && m?.code === FOUNDER.CODE);

    if (!isFounderId && !isCodeValid) {
      return { ok: false, error: 'not_eligible' };
    }

    p.founder_claimed = true;
    if (!p.titles.includes(FOUNDER.TITLE)) {
      p.titles.push(FOUNDER.TITLE);
    }
    p.title = FOUNDER.TITLE;
    p.diamonds = (p.diamonds || 0) + FOUNDER.DIAMONDS;
    p.star_essence = (p.star_essence || 0) + FOUNDER.ESSENCE;
    p.bag_items[FOUNDER.MYTHIC_BOX] = (p.bag_items[FOUNDER.MYTHIC_BOX] || 0) + 1;

    db?.markProfile?.(p.id);
    pushProfile(p);

    return {
      ok: true,
      title: p.title,
      diamonds: FOUNDER.DIAMONDS,
      essence: FOUNDER.ESSENCE,
      mythicBox: 1,
    };
  }

  function canCall(caller, callee, nowMs = now()) {
    if (!caller || !callee) return { ok: false, error: 'invalid_user' };
    ensurePhase5(caller);
    ensurePhase5(callee);

    if (caller.id === callee.id) {
      return { ok: false, error: 'cannot_call_self' };
    }

    if (caller.partner_id && callee.id && caller.partner_id.toLowerCase() === callee.id.toLowerCase()) {
      return { ok: true };
    }

    const isFriend = Array.isArray(caller.friends) && caller.friends.some((f) => f.toLowerCase() === callee.id.toLowerCase());
    if (!isFriend) {
      return { ok: false, error: 'call_locked' };
    }

    const hasBlack = !!caller.vip?.black;
    const hasCommunicator = !!caller.vip?.communicator;
    const hasDayPass = (caller.vip?.call_until || 0) > nowMs;
    const hasTelelink = Array.isArray(caller.vip?.telelinks) && caller.vip.telelinks.some((t) => t.toLowerCase() === callee.id.toLowerCase());

    if (hasBlack || hasCommunicator || hasDayPass || hasTelelink) {
      return { ok: true };
    }

    return { ok: false, error: 'call_locked' };
  }

  return {
    hallList,
    hallWorship,
    emitCheer,
    cheerClaim,
    owlSendGift,
    owlClaimMail,
    vipCardBuy,
    vipCardUse,
    passportState,
    passportClaim,
    bumpQuest,
    onDailyLogin,
    founderClaim,
    canCall,
  };
}
