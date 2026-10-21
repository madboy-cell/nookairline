// server/daily_service.js — Phase 5 daily features: Hall of Fame, Cheer, Owl Gifts, VIP Cards, Passport, Couple Streak, Founder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HALL_CATEGORIES, QUESTS, PASSPORT, STREAK, OWL, VIP_CARDS, FOUNDER, CHEER, WORSHIP,
  NOOK_NEEN_COUPLE_SINCE, utcDay, coupleDaysSince, yesterday,
} from '../shared/phase5_rules.js';
import { SEASON_OUTFITS, MAX_REFINE, itemDef } from '../shared/rpg_rules.js';
import { grantItem } from './rpg_service.js';

const POLAROID_SEED_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data', 'nook_neen_polaroids_seed.json');
let _cachedPolaroidSeed = null;
function getNookNeenPolaroidSeed() {
  if (_cachedPolaroidSeed !== null) return _cachedPolaroidSeed;
  try {
    if (fs.existsSync(POLAROID_SEED_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(POLAROID_SEED_PATH, 'utf8'));
      _cachedPolaroidSeed = Array.isArray(parsed) ? parsed : [];
    } else {
      _cachedPolaroidSeed = [];
    }
  } catch {
    _cachedPolaroidSeed = [];
  }
  return _cachedPolaroidSeed;
}

/**
 * Ensures all Phase 5 profile fields exist lazily and idempotently per Section 0.
 */
export function ensurePhase5(p, nowMs = Date.now()) {
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
  if (p.couple_since === undefined) p.couple_since = null;
  if (!p.past_couple_streaks || typeof p.past_couple_streaks !== 'object') {
    p.past_couple_streaks = {};
  }

  if (!Array.isArray(p.friend_requests_in)) p.friend_requests_in = [];
  if (!Array.isArray(p.friend_requests_out)) p.friend_requests_out = [];
  if (!Array.isArray(p.couple_requests_in)) p.couple_requests_in = [];
  if (p.couple_requests_out === undefined) p.couple_requests_out = null;

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

  if (!p.past_couple_stats || typeof p.past_couple_stats !== 'object') {
    p.past_couple_stats = {};
  }

  if (!p.couple_stats || typeof p.couple_stats !== 'object') {
    p.couple_stats = {
      bestStreak: p.couple_streak || 0,
      callMinutes: 0,
      callSessions: 0,
      callDiamonds: 0,
      blessingsShared: 0,
      giftsExchanged: 0,
      momentsCaptured: 0,
      coopActivities: 0,
      _seeded: false,
    };
  } else {
    p.couple_stats.bestStreak = Math.max(p.couple_stats.bestStreak || 0, p.couple_streak || 0);
    p.couple_stats.callMinutes = p.couple_stats.callMinutes || 0;
    p.couple_stats.callSessions = p.couple_stats.callSessions || 0;
    p.couple_stats.callDiamonds = p.couple_stats.callDiamonds || 0;
    p.couple_stats.blessingsShared = p.couple_stats.blessingsShared || 0;
    p.couple_stats.giftsExchanged = p.couple_stats.giftsExchanged || 0;
    p.couple_stats.momentsCaptured = p.couple_stats.momentsCaptured || 0;
    p.couple_stats.coopActivities = p.couple_stats.coopActivities || 0;
  }

  const isNookNeenPair =
    (p.id === 'nook' || p.id === 'neen') &&
    (p.partner_id === 'neen' || p.partner_id === 'nook');

  if (isNookNeenPair) {
    if (!p.couple_since || typeof p.couple_since === 'number') {
      p.couple_since = NOOK_NEEN_COUPLE_SINCE;
    }
    const autoDays = coupleDaysSince(p.couple_since, nowMs);
    if (autoDays > 0) {
      p.couple_streak = Math.max(p.couple_streak || 0, autoDays);
      p.couple_stats.bestStreak = Math.max(p.couple_stats.bestStreak || 0, p.couple_streak, 17);
    }
    if (!p.couple_stats._v2ChronicleFloor) {
      // Verified V1 + V2 cumulative Love Chronicle baseline (81h 43m / 56 calls / +6,360💎 / 119 blessings / 30 gifts / 1703 moments / 118 co-op dates)
      p.couple_stats.bestStreak = Math.max(p.couple_stats.bestStreak || 0, 17);
      p.couple_stats.callMinutes = Math.max(p.couple_stats.callMinutes || 0, 4903);
      p.couple_stats.callSessions = Math.max(p.couple_stats.callSessions || 0, 56);
      p.couple_stats.callDiamonds = Math.max(p.couple_stats.callDiamonds || 0, 6360);
      p.couple_stats.blessingsShared = Math.max(p.couple_stats.blessingsShared || 0, 119);
      p.couple_stats.giftsExchanged = Math.max(p.couple_stats.giftsExchanged || 0, 30);
      p.couple_stats.momentsCaptured = Math.max(p.couple_stats.momentsCaptured || 0, 1703);
      p.couple_stats.coopActivities = Math.max(p.couple_stats.coopActivities || 0, 118);
      p.couple_stats._seeded = true;
      p.couple_stats._nookairlineImported = true;
      p.couple_stats._v2ChronicleFloor = true;
    }
  } else if (p.partner_id) {
    if (typeof p.couple_since === 'string') {
      const autoDays = coupleDaysSince(p.couple_since, nowMs);
      if (autoDays > 0) {
        p.couple_streak = autoDays;
        p.couple_stats.bestStreak = Math.max(p.couple_stats.bestStreak || 0, autoDays);
      }
    }
    if (!p.couple_stats._seeded) {
      const s = p.couple_streak || 1;
      const isZero =
        !p.couple_stats.callMinutes &&
        !p.couple_stats.blessingsShared &&
        !p.couple_stats.giftsExchanged &&
        !p.couple_stats.momentsCaptured &&
        !p.couple_stats.coopActivities;
      if (s > 1 && isZero) {
        p.couple_stats.bestStreak = Math.max(p.couple_stats.bestStreak || 0, s);
        p.couple_stats.callMinutes = s * 14;
        p.couple_stats.callSessions = Math.max(1, Math.round(s * 0.65));
        p.couple_stats.callDiamonds = Math.floor((s * 14) / 15) * 20;
        p.couple_stats.blessingsShared = Math.max(1, Math.round(s * 0.85));
        p.couple_stats.giftsExchanged = Math.max(1, Math.round(s * 0.55));
        p.couple_stats.momentsCaptured = Math.max(1, Math.round(s * 0.42));
        p.couple_stats.coopActivities = Math.max(1, Math.round(s * 0.36));
      }
      p.couple_stats._seeded = true;
    }
  }

  if (!Array.isArray(p.couple_album)) {
    p.couple_album = [];
  }
  if (isNookNeenPair) {
    const seedAlbum = getNookNeenPolaroidSeed();
    if (seedAlbum.length > 0) {
      const existingIds = new Set(p.couple_album.map((item) => item?.id).filter(Boolean));
      for (const item of seedAlbum) {
        if (item?.id && !existingIds.has(item.id) && p.couple_album.length < 12) {
          p.couple_album.push({ ...item });
          existingIds.add(item.id);
        }
      }
    }
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
  isOnline = () => false,
  getPresence = () => null,
  onCoupleChanged = () => {},
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
        const allowed = [
          'streak_freeze', 'vip_call_day_pass', 'vip_communicator', 'vip_telelink_box', 'vip_black',
          'ticket_standard', 'ticket_gold', 'ticket_royal_hair',
          'scroll_forge_boost', 'protection_scroll',
          'random_dupe_box', 'dupe_box', 'mythic_selector_box',
        ];
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
          for (const eqSlot of Object.values(p.equipped || {})) {
            if (eqSlot && typeof eqSlot === 'object' && eqSlot.glamour === slot1.itemId) {
              delete eqSlot.glamour;
            }
          }
          if (p.glamour && typeof p.glamour === 'object') {
            for (const [gSlot, gId] of Object.entries(p.glamour)) {
              if (gId === slot1.itemId) delete p.glamour[gSlot];
            }
          }
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
    if (isPartner) {
      const mergedGifts = Math.max(p.couple_stats?.giftsExchanged || 0, recipient.couple_stats?.giftsExchanged || 0) + 1;
      p.couple_stats.giftsExchanged = mergedGifts;
      recipient.couple_stats.giftsExchanged = mergedGifts;
    }

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
      const isPartner = !!(p.partner_id && p.partner_id.toLowerCase() === target.id.toLowerCase());
      const isFriend = Array.isArray(p.friends) && p.friends.some((f) => f.toLowerCase() === target.id.toLowerCase());
      if (!isPartner && !isFriend) return { ok: false, error: 'not_friend' };
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
      const isPartner = !!(p.partner_id && p.partner_id.toLowerCase() === target.id.toLowerCase());
      const isFriend = Array.isArray(p.friends) && p.friends.some((f) => f.toLowerCase() === target.id.toLowerCase());
      if (!isPartner && !isFriend) return { ok: false, error: 'not_friend' };
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

  function bagItemUse(p, m) {
    ensurePhase5(p);
    const key = String(m?.key || '');
    if (!key) return { ok: false, error: 'invalid_bag_key' };

    const cardKey = normalizeCardKey(key);
    if (cardKey) {
      return vipCardUse(p, { card: cardKey, target: m?.target });
    }

    if ((p.bag_items?.[key] || 0) < 1) {
      return { ok: false, error: 'not_owned' };
    }

    if (key === 'random_dupe_box' || key === 'dupe_box') {
      p.bag_items[key] -= 1;
      if (p.bag_items[key] <= 0) delete p.bag_items[key];
      const invEntries = Object.entries(p.inventory || {}).filter(
        ([id, it]) => id !== 'newbie_outfit' && itemDef(id) && (it?.refine | 0) < MAX_REFINE
      );
      let pickedId = 'hat_wolf_ears';
      if (invEntries.length > 0) {
        const idx = Math.min(invEntries.length - 1, Math.floor(rng() * invEntries.length));
        pickedId = invEntries[idx][0];
      }
      const grantRes = grantItem(p, pickedId);
      const def = itemDef(pickedId);
      db?.markProfile?.(p.id);
      pushProfile(p);
      return {
        ok: true,
        key,
        grantedItemId: pickedId,
        grantedName: def?.name || pickedId,
        grant: grantRes,
      };
    }

    if (key === 'mythic_selector_box') {
      p.bag_items[key] -= 1;
      if (p.bag_items[key] <= 0) delete p.bag_items[key];
      let pickedId = m?.pickId && SEASON_OUTFITS.includes(m.pickId) ? m.pickId : null;
      if (!pickedId) {
        const unowned = SEASON_OUTFITS.filter((id) => !p.inventory?.[id]);
        pickedId = unowned[0] || p.gacha?.featured_outfit || SEASON_OUTFITS[0];
      }
      const grantRes = grantItem(p, pickedId);
      const def = itemDef(pickedId);
      db?.markProfile?.(p.id);
      pushProfile(p);
      return {
        ok: true,
        key,
        grantedItemId: pickedId,
        grantedName: def?.name || pickedId,
        grant: grantRes,
      };
    }

    return { ok: false, error: 'invalid_bag_key' };
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

  function mergeCoupleStats(sA = {}, sB = {}, currentStreak = 0) {
    return {
      bestStreak: Math.max(sA.bestStreak || 0, sB.bestStreak || 0, currentStreak || 0),
      callMinutes: Math.max(sA.callMinutes || 0, sB.callMinutes || 0),
      callSessions: Math.max(sA.callSessions || 0, sB.callSessions || 0),
      callDiamonds: Math.max(sA.callDiamonds || 0, sB.callDiamonds || 0),
      blessingsShared: Math.max(sA.blessingsShared || 0, sB.blessingsShared || 0),
      giftsExchanged: Math.max(sA.giftsExchanged || 0, sB.giftsExchanged || 0),
      momentsCaptured: Math.max(sA.momentsCaptured || 0, sB.momentsCaptured || 0),
      coopActivities: Math.max(sA.coopActivities || 0, sB.coopActivities || 0),
      _seeded: true,
      _nookairlineImported: Boolean(sA._nookairlineImported || sB._nookairlineImported),
    };
  }

  function bumpCoupleStat(p, deltas = {}) {
    if (!p) return { ok: false };
    ensurePhase5(p);
    if (!p.partner_id) return { ok: false };
    const partner = db?.getProfile?.(p.partner_id);
    if (!partner || !partner.partner_id || partner.partner_id.toLowerCase() !== p.id.toLowerCase()) {
      return { ok: false };
    }
    ensurePhase5(partner);
    const merged = mergeCoupleStats(p.couple_stats, partner.couple_stats, Math.max(p.couple_streak || 0, partner.couple_streak || 0));
    for (const [k, v] of Object.entries(deltas)) {
      if (typeof v === 'number' && Number.isFinite(v) && k in merged && k !== '_seeded') {
        merged[k] = Math.max(0, (merged[k] || 0) + v);
      }
    }
    p.couple_stats = { ...merged };
    partner.couple_stats = { ...merged };
    db?.markProfile?.(p.id);
    db?.markProfile?.(partner.id);
    pushProfile(p);
    pushProfile(partner);
    return { ok: true, coupleStats: merged };
  }

  function mergeCoupleAlbums(listA = [], listB = [], maxItems = 12) {
    const map = new Map();
    for (const item of [...(Array.isArray(listA) ? listA : []), ...(Array.isArray(listB) ? listB : [])]) {
      if (item && typeof item === 'object' && item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return [...map.values()]
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, maxItems);
  }

  const lastCouplePoseByPair = new Map();

  function coupleMoment(p, m = {}) {
    ensurePhase5(p);
    const partner = p.partner_id ? db?.getProfile?.(p.partner_id) : null;
    const isBoundCouple = !!(partner && partner.partner_id && partner.partner_id.toLowerCase() === p.id.toLowerCase());
    if (partner) ensurePhase5(partner);

    if (m?.deletePhotoId) {
      const delId = String(m.deletePhotoId);
      p.couple_album = (p.couple_album || []).filter((x) => x && x.id !== delId);
      db?.markProfile?.(p.id);
      pushProfile(p);
      if (isBoundCouple && partner) {
        partner.couple_album = (partner.couple_album || []).filter((x) => x && x.id !== delId);
        db?.markProfile?.(partner.id);
        pushProfile(partner);
      }
      return {
        ok: true,
        deletedId: delId,
        coupleAlbum: p.couple_album,
        directory: socialDirectory(p),
      };
    }

    const kind = String(m?.kind || 'pose');
    const pose = String(m?.pose || (kind === 'polaroid' ? 'heart_hands' : 'hug'));
    const nowMs = now();

    // Prevent infinite ping-pong echo if partner's client auto-replies to couple_interaction within 2.5s
    if (kind === 'pose' && isBoundCouple && partner) {
      const pairKey = [p.id.toLowerCase(), partner.id.toLowerCase()].sort().join('|');
      const prevPose = lastCouplePoseByPair.get(pairKey);
      if (prevPose && nowMs - prevPose.at < 2500 && prevPose.from !== p.id) {
        return {
          ok: true,
          throttled: true,
          kind,
          pose: prevPose.pose,
          coupleAlbum: p.couple_album,
          coupleStats: p.couple_stats,
          directory: socialDirectory(p),
        };
      }
      if (prevPose && nowMs - prevPose.at < 500 && prevPose.from === p.id && prevPose.pose === pose) {
        return {
          ok: true,
          throttled: true,
          kind,
          pose,
          coupleAlbum: p.couple_album,
          coupleStats: p.couple_stats,
          directory: socialDirectory(p),
        };
      }
      lastCouplePoseByPair.set(pairKey, { at: nowMs, from: p.id, pose });
    }

    let savedPhoto = null;
    if (m?.photo && typeof m.photo === 'object') {
      const rawThumb = typeof m.photo.thumbDataUrl === 'string' && m.photo.thumbDataUrl.startsWith('data:image/') && m.photo.thumbDataUrl.length < 240000
        ? m.photo.thumbDataUrl
        : null;
      savedPhoto = {
        id: String(m.photo.id || `pol_${nowMs}_${Math.floor(Math.random() * 10000)}`).slice(0, 48),
        at: nowMs,
        by: p.id,
        byName: p.username || p.id,
        partnerId: isBoundCouple && partner ? partner.id : null,
        partnerName: isBoundCouple && partner ? (partner.username || partner.id) : null,
        mode: m.photo.mode === 'solo' || !isBoundCouple ? 'solo' : 'couple',
        caption: String(m.photo.caption || '').trim().slice(0, 64),
        pose: String(m.photo.pose || pose).slice(0, 32),
        backdrop: String(m.photo.backdrop || 'balcony').slice(0, 32),
        frame: String(m.photo.frame || 'classic').slice(0, 32),
        filter: String(m.photo.filter || 'warm').slice(0, 32),
        expression: String(m.photo.expression || 'blush').slice(0, 32),
        streak: isBoundCouple ? Math.max(p.couple_streak || 1, partner?.couple_streak || 1) : 0,
        thumbDataUrl: rawThumb,
      };
    }

    if (!p.partner_id || !isBoundCouple) {
      if (savedPhoto) {
        p.couple_album = mergeCoupleAlbums([savedPhoto], p.couple_album);
        bumpQuest(p, 'pet', 1);
        db?.markProfile?.(p.id);
        pushProfile(p);
        return {
          ok: true,
          kind,
          pose,
          photo: savedPhoto,
          coupleAlbum: p.couple_album,
          directory: socialDirectory(p),
        };
      }
      return { ok: false, error: 'not_coupled' };
    }

    const res = bumpCoupleStat(p, { momentsCaptured: 1 });
    if (!res.ok) return { ok: false, error: 'not_coupled' };

    if (savedPhoto) {
      const mergedAlbum = mergeCoupleAlbums([savedPhoto], mergeCoupleAlbums(p.couple_album, partner.couple_album));
      p.couple_album = mergedAlbum;
      partner.couple_album = [...mergedAlbum];
    }

    // Grant 1-hour Couple Harmony village buff (+15%/+25% yield aura) & daily harmony progress
    if (p.village) {
      p.village.blessed_until = Math.max(p.village.blessed_until || 0, nowMs + 3600 * 1000);
    }
    if (partner?.village) {
      partner.village.blessed_until = Math.max(partner.village.blessed_until || 0, nowMs + 3600 * 1000);
      db?.markProfile?.(partner.id);
      pushProfile(partner);
    }
    bumpQuest(p, 'pet', 1);
    db?.markProfile?.(p.id);
    pushProfile(p);
    if (partner) {
      sendTo(partner.id, {
        type: 'couple_interaction',
        from: p.id,
        fromName: p.username || p.id,
        kind,
        pose,
        initiatorRole: m?.initiatorRole === 'right' ? 'right' : (m?.initiatorRole === 'left' ? 'left' : null),
        photo: savedPhoto ? { id: savedPhoto.id, caption: savedPhoto.caption, pose: savedPhoto.pose, at: savedPhoto.at } : null,
        mood: m?.mood ? String(m.mood) : null,
        x: typeof m?.x === 'number' && Number.isFinite(m.x) ? m.x : null,
        z: typeof m?.z === 'number' && Number.isFinite(m.z) ? m.z : null,
        at: nowMs,
      });
    }
    return {
      ok: true,
      kind,
      pose,
      photo: savedPhoto,
      coupleAlbum: p.couple_album,
      coupleStats: res.coupleStats,
      directory: socialDirectory(p),
    };
  }

  function onDailyLogin(p) {
    const nowMs = now();
    ensurePhase5(p, nowMs);
    const today = utcDay(nowMs);
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

    ensurePhase5(partner, nowMs);

    // Couple streak applies when both have logged in today and streak hasn't been applied today
    if (partner.login_day === today && p.couple_streak_day !== today) {
      const prevStreakDay = p.couple_streak_day || partner.couple_streak_day;
      const sinceDays = typeof p.couple_since === 'string' ? coupleDaysSince(p.couple_since, nowMs) : 0;
      let newStreak;
      let consumedFreeze = false;

      if (sinceDays > 0) {
        newStreak = sinceDays;
      } else if (prevStreakDay === yest) {
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

      const mergedStats = mergeCoupleStats(p.couple_stats, partner.couple_stats, newStreak);
      p.couple_stats = { ...mergedStats };
      partner.couple_stats = { ...mergedStats };

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
    ensurePhase5(p, now());
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
    ensurePhase5(caller, nowMs);
    ensurePhase5(callee, nowMs);

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

  function describeUserSummary(viewer, target) {
    if (!target) return null;
    const nowMs = now();
    ensurePhase5(target, nowMs);
    const online = Boolean(target.is_bot || isOnline(target.id));
    const pres = getPresence(target.id);
    let locationLabel = 'Offline';
    if (online) {
      if (target.is_bot || pres?.instanceId === 'townhall') {
        locationLabel = 'In Town Hall Plaza';
      } else if (pres?.instanceId?.startsWith('couple:')) {
        locationLabel = 'In Couple Sanctuary';
      } else if (pres?.instanceId?.startsWith('village:')) {
        const islOwner = pres.instanceId.slice('village:'.length);
        locationLabel = islOwner === target.id ? 'In Sky Village' : `Visiting ${islOwner}'s Isle`;
      } else {
        locationLabel = 'In Sky Village';
      }
    }
    const isPartner = !!(viewer?.partner_id && viewer.partner_id.toLowerCase() === target.id.toLowerCase());
    const callCheck = viewer ? canCall(viewer, target, nowMs) : { ok: false };
    const hasTelelink = Array.isArray(viewer?.vip?.telelinks) &&
      viewer.vip.telelinks.some((t) => t.toLowerCase() === target.id.toLowerCase());
    const today = utcDay(nowMs);
    const blessedToday = viewer?.bless_day === today;

    return {
      id: target.id,
      username: target.username || target.id,
      level: target.level || 1,
      cp: target.cp || 0,
      lineage: target.lineage || 'bkk',
      appearance: target.appearance || null,
      equipped: target.equipped || {},
      title: target.title || null,
      isBot: !!target.is_bot,
      isPartner,
      partner_id: target.partner_id || null,
      couple_streak: target.couple_streak || 0,
      couple_since: target.couple_since || null,
      couple_stats: target.couple_stats || null,
      online,
      instanceId: pres?.instanceId || (target.is_bot ? 'townhall' : `village:${target.id}`),
      locationLabel,
      canCall: !!callCheck?.ok,
      hasTelelink,
      blessedToday,
      blessedUntil: target.village?.blessed_until || 0,
    };
  }

  function socialDirectory(p) {
    const nowMs = now();
    ensurePhase5(p, nowMs);
    const partnerProf = p.partner_id ? db?.getProfile?.(p.partner_id) : null;
    const isBoundCouple = !!(partnerProf && partnerProf.partner_id && partnerProf.partner_id.toLowerCase() === p.id.toLowerCase());
    let coupleStats = p.couple_stats;
    let coupleAlbum = Array.isArray(p.couple_album) ? p.couple_album : [];
    if (isBoundCouple && partnerProf) {
      ensurePhase5(partnerProf, nowMs);
      coupleStats = mergeCoupleStats(p.couple_stats, partnerProf.couple_stats, Math.max(p.couple_streak || 0, partnerProf.couple_streak || 0));
      p.couple_stats = { ...coupleStats };
      partnerProf.couple_stats = { ...coupleStats };
      coupleAlbum = mergeCoupleAlbums(p.couple_album, partnerProf.couple_album);
      p.couple_album = coupleAlbum;
      partnerProf.couple_album = [...coupleAlbum];
    }
    const partner = isBoundCouple ? describeUserSummary(p, partnerProf) : null;

    const friendIds = Array.from(new Set(
      (p.friends || [])
        .map((f) => String(f || '').toLowerCase())
        .filter((f) => f && f !== p.id.toLowerCase())
    ));
    const friends = friendIds
      .map((fid) => db?.getProfile?.(fid))
      .filter(Boolean)
      .map((fProf) => describeUserSummary(p, fProf));

    const friendRequestsIn = (p.friend_requests_in || [])
      .map((req) => {
        const sender = db?.getProfile?.(req.from);
        if (!sender) return null;
        return {
          from: sender.id,
          fromName: sender.username || sender.id,
          at: req.at || 0,
          user: describeUserSummary(p, sender),
        };
      })
      .filter(Boolean);

    const coupleRequestsIn = (p.couple_requests_in || [])
      .map((req) => {
        const sender = db?.getProfile?.(req.from);
        if (!sender) return null;
        return {
          from: sender.id,
          fromName: sender.username || sender.id,
          at: req.at || 0,
          savedStreak: p.past_couple_streaks?.[sender.id] || 0,
          user: describeUserSummary(p, sender),
        };
      })
      .filter(Boolean);

    const friendSet = new Set(friendIds);
    const reqOutSet = new Set((p.friend_requests_out || []).map((x) => String(x).toLowerCase()));
    const discoverPlayers = getAllProfiles()
      .filter((other) => other && other.id && other.id.toLowerCase() !== p.id.toLowerCase() && !friendSet.has(other.id.toLowerCase()))
      .slice(0, 8)
      .map((other) => ({
        ...describeUserSummary(p, other),
        requestPending: reqOutSet.has(other.id.toLowerCase()),
      }));

    return {
      ok: true,
      partner,
      coupleStats,
      coupleAlbum,
      friends,
      friendRequestsIn,
      friendRequestsOut: p.friend_requests_out || [],
      coupleRequestsIn,
      coupleRequestOut: p.couple_requests_out || null,
      discoverPlayers,
      pastStreaks: p.past_couple_streaks || {},
    };
  }

  function linkFriendsBothWays(a, b) {
    ensurePhase5(a);
    ensurePhase5(b);
    if (!a.friends.some((x) => x.toLowerCase() === b.id.toLowerCase())) {
      a.friends.push(b.id);
    }
    if (!b.friends.some((x) => x.toLowerCase() === a.id.toLowerCase())) {
      b.friends.push(a.id);
    }
    a.friend_requests_in = (a.friend_requests_in || []).filter((r) => r.from?.toLowerCase() !== b.id.toLowerCase());
    b.friend_requests_in = (b.friend_requests_in || []).filter((r) => r.from?.toLowerCase() !== a.id.toLowerCase());
    a.friend_requests_out = (a.friend_requests_out || []).filter((id) => id.toLowerCase() !== b.id.toLowerCase());
    b.friend_requests_out = (b.friend_requests_out || []).filter((id) => id.toLowerCase() !== a.id.toLowerCase());
  }

  function friendRequestSend(p, m) {
    ensurePhase5(p);
    const rawTo = String(m?.to || m?.username || '').trim().toLowerCase();
    if (!rawTo) return { ok: false, error: 'no_such_user' };

    let target = db?.getProfile?.(rawTo);
    if (!target) {
      target = getAllProfiles().find((x) => (x.username || x.id || '').toLowerCase() === rawTo) || null;
    }
    if (!target) return { ok: false, error: 'no_such_user' };
    ensurePhase5(target);

    if (target.id.toLowerCase() === p.id.toLowerCase()) {
      return { ok: false, error: 'cannot_friend_self' };
    }
    if ((p.friends || []).some((f) => f.toLowerCase() === target.id.toLowerCase())) {
      return { ok: false, error: 'already_friends' };
    }
    if ((p.friends || []).length >= 200) {
      return { ok: false, error: 'friend_limit_reached' };
    }

    const reversePending = (p.friend_requests_in || []).some((r) => r.from?.toLowerCase() === target.id.toLowerCase());
    if (target.is_bot || reversePending) {
      linkFriendsBothWays(p, target);
      db?.markProfile?.(p.id);
      db?.markProfile?.(target.id);
      pushProfile(p);
      pushProfile(target);
      sendTo(target.id, {
        type: 'social_notify',
        kind: 'friend_accepted',
        by: p.id,
        byName: p.username || p.id,
      });
      return {
        ok: true,
        status: 'accepted',
        targetId: target.id,
        targetName: target.username || target.id,
        directory: socialDirectory(p),
      };
    }

    if ((p.friend_requests_out || []).some((id) => id.toLowerCase() === target.id.toLowerCase())) {
      return { ok: false, error: 'request_already_sent' };
    }

    p.friend_requests_out.push(target.id);
    if (!target.friend_requests_in.some((r) => r.from?.toLowerCase() === p.id.toLowerCase())) {
      target.friend_requests_in.unshift({
        from: p.id,
        fromName: p.username || p.id,
        at: now(),
      });
    }

    db?.markProfile?.(p.id);
    db?.markProfile?.(target.id);
    pushProfile(p);
    pushProfile(target);
    sendTo(target.id, {
      type: 'social_notify',
      kind: 'friend_request',
      from: p.id,
      fromName: p.username || p.id,
    });

    return {
      ok: true,
      status: 'pending',
      targetId: target.id,
      targetName: target.username || target.id,
      directory: socialDirectory(p),
    };
  }

  function friendRequestAccept(p, m) {
    ensurePhase5(p);
    const fromId = String(m?.from || m?.userId || '').trim().toLowerCase();
    if (!fromId) return { ok: false, error: 'no_such_user' };
    const sender = db?.getProfile?.(fromId);
    if (!sender) return { ok: false, error: 'no_such_user' };
    ensurePhase5(sender);

    const hasIncoming = (p.friend_requests_in || []).some((r) => r.from?.toLowerCase() === sender.id.toLowerCase());
    const hasOutgoing = (sender.friend_requests_out || []).some((id) => id.toLowerCase() === p.id.toLowerCase());
    if (!hasIncoming && !hasOutgoing) {
      return { ok: false, error: 'no_such_request' };
    }

    linkFriendsBothWays(p, sender);
    db?.markProfile?.(p.id);
    db?.markProfile?.(sender.id);
    pushProfile(p);
    pushProfile(sender);
    sendTo(sender.id, {
      type: 'social_notify',
      kind: 'friend_accepted',
      by: p.id,
      byName: p.username || p.id,
    });

    return {
      ok: true,
      friendId: sender.id,
      friendName: sender.username || sender.id,
      directory: socialDirectory(p),
    };
  }

  function friendRequestDecline(p, m) {
    ensurePhase5(p);
    const otherId = String(m?.from || m?.to || m?.userId || '').trim().toLowerCase();
    if (!otherId) return { ok: false, error: 'no_such_user' };
    const other = db?.getProfile?.(otherId);

    p.friend_requests_in = (p.friend_requests_in || []).filter((r) => r.from?.toLowerCase() !== otherId);
    p.friend_requests_out = (p.friend_requests_out || []).filter((id) => id.toLowerCase() !== otherId);

    if (other) {
      ensurePhase5(other);
      other.friend_requests_in = (other.friend_requests_in || []).filter((r) => r.from?.toLowerCase() !== p.id.toLowerCase());
      other.friend_requests_out = (other.friend_requests_out || []).filter((id) => id.toLowerCase() !== p.id.toLowerCase());
      db?.markProfile?.(other.id);
      pushProfile(other);
    }

    db?.markProfile?.(p.id);
    pushProfile(p);
    return { ok: true, directory: socialDirectory(p) };
  }

  function friendRemove(p, m) {
    ensurePhase5(p);
    const targetId = String(m?.targetId || m?.friendId || m?.userId || m?.to || '').trim().toLowerCase();
    if (!targetId) return { ok: false, error: 'no_such_user' };

    if (p.partner_id && p.partner_id.toLowerCase() === targetId) {
      return { ok: false, error: 'take_break_first' };
    }

    const wasFriend = (p.friends || []).some((f) => f.toLowerCase() === targetId);
    if (!wasFriend) {
      return { ok: false, error: 'not_friend' };
    }

    p.friends = (p.friends || []).filter((f) => f.toLowerCase() !== targetId);
    p.couple_requests_in = (p.couple_requests_in || []).filter((r) => r.from?.toLowerCase() !== targetId);
    if (p.couple_requests_out && p.couple_requests_out.toLowerCase() === targetId) {
      p.couple_requests_out = null;
    }

    const target = db?.getProfile?.(targetId);
    if (target) {
      ensurePhase5(target);
      target.friends = (target.friends || []).filter((f) => f.toLowerCase() !== p.id.toLowerCase());
      target.couple_requests_in = (target.couple_requests_in || []).filter((r) => r.from?.toLowerCase() !== p.id.toLowerCase());
      if (target.couple_requests_out && target.couple_requests_out.toLowerCase() === p.id.toLowerCase()) {
        target.couple_requests_out = null;
      }
      db?.markProfile?.(target.id);
      pushProfile(target);
      sendTo(target.id, {
        type: 'social_notify',
        kind: 'friend_removed',
        by: p.id,
        byName: p.username || p.id,
      });
    }

    db?.markProfile?.(p.id);
    pushProfile(p);

    return {
      ok: true,
      removedId: targetId,
      directory: socialDirectory(p),
    };
  }

  function bindCouple(a, b) {
    ensurePhase5(a);
    ensurePhase5(b);
    linkFriendsBothWays(a, b);

    // If b is a bot that had a default bot partner, cleanly clear the old bot partner first
    if (b.is_bot && b.partner_id && b.partner_id !== a.id) {
      const oldBotPartner = db?.getProfile?.(b.partner_id);
      if (oldBotPartner && oldBotPartner.partner_id === b.id) {
        oldBotPartner.partner_id = null;
        oldBotPartner.couple_streak = 0;
        db?.markProfile?.(oldBotPartner.id);
      }
    }

    const restoredStreak = Math.max(
      1,
      a.past_couple_streaks?.[b.id] || 0,
      b.past_couple_streaks?.[a.id] || 0
    );
    const savedStatsA = a.past_couple_stats?.[b.id] || {};
    const savedStatsB = b.past_couple_stats?.[a.id] || {};
    const restoredStats = mergeCoupleStats(savedStatsA, savedStatsB, restoredStreak);
    const nowMs = now();
    const today = utcDay(nowMs);

    a.partner_id = b.id;
    b.partner_id = a.id;
    a.couple_streak = restoredStreak;
    b.couple_streak = restoredStreak;
    a.couple_streak_day = today;
    b.couple_streak_day = today;
    a.couple_since = nowMs;
    b.couple_since = nowMs;
    a.couple_stats = { ...restoredStats };
    b.couple_stats = { ...restoredStats };

    a.couple_requests_in = [];
    b.couple_requests_in = [];
    a.couple_requests_out = null;
    b.couple_requests_out = null;

    db?.markProfile?.(a.id);
    db?.markProfile?.(b.id);
    pushProfile(a);
    pushProfile(b);

    onCoupleChanged(a.id, b.id, true);

    sendTo(a.id, {
      type: 'social_notify',
      kind: 'couple_bound',
      partnerId: b.id,
      partnerName: b.username || b.id,
      streak: restoredStreak,
    });
    sendTo(b.id, {
      type: 'social_notify',
      kind: 'couple_bound',
      partnerId: a.id,
      partnerName: a.username || a.id,
      streak: restoredStreak,
    });
  }

  function couplePropose(p, m) {
    ensurePhase5(p);
    if (p.partner_id) {
      return { ok: false, error: 'already_coupled' };
    }
    const targetId = String(m?.to || m?.userId || '').trim().toLowerCase();
    if (!targetId) return { ok: false, error: 'no_such_user' };
    const target = db?.getProfile?.(targetId);
    if (!target) return { ok: false, error: 'no_such_user' };
    ensurePhase5(target);

    if (target.id.toLowerCase() === p.id.toLowerCase()) {
      return { ok: false, error: 'invalid_target' };
    }
    const isFriend = (p.friends || []).some((f) => f.toLowerCase() === target.id.toLowerCase());
    if (!isFriend) {
      return { ok: false, error: 'must_be_friends' };
    }
    if (target.partner_id && target.partner_id.toLowerCase() !== p.id.toLowerCase() && !target.is_bot) {
      return { ok: false, error: 'target_already_coupled' };
    }

    const reverseProposal = (p.couple_requests_in || []).some((r) => r.from?.toLowerCase() === target.id.toLowerCase());
    if (target.is_bot || reverseProposal) {
      bindCouple(p, target);
      return {
        ok: true,
        status: 'coupled',
        partnerId: target.id,
        partnerName: target.username || target.id,
        streak: p.couple_streak,
        directory: socialDirectory(p),
      };
    }

    p.couple_requests_out = target.id;
    if (!target.couple_requests_in.some((r) => r.from?.toLowerCase() === p.id.toLowerCase())) {
      target.couple_requests_in.unshift({
        from: p.id,
        fromName: p.username || p.id,
        at: now(),
      });
    }

    db?.markProfile?.(p.id);
    db?.markProfile?.(target.id);
    pushProfile(p);
    pushProfile(target);
    sendTo(target.id, {
      type: 'social_notify',
      kind: 'couple_propose',
      from: p.id,
      fromName: p.username || p.id,
    });

    return {
      ok: true,
      status: 'pending',
      targetId: target.id,
      targetName: target.username || target.id,
      directory: socialDirectory(p),
    };
  }

  function coupleAccept(p, m) {
    ensurePhase5(p);
    if (p.partner_id) {
      return { ok: false, error: 'already_coupled' };
    }
    const fromId = String(m?.from || m?.userId || '').trim().toLowerCase();
    if (!fromId) return { ok: false, error: 'no_such_user' };
    const sender = db?.getProfile?.(fromId);
    if (!sender) return { ok: false, error: 'no_such_user' };
    ensurePhase5(sender);

    if (sender.partner_id && sender.partner_id.toLowerCase() !== p.id.toLowerCase()) {
      return { ok: false, error: 'target_already_coupled' };
    }

    const hasIncoming = (p.couple_requests_in || []).some((r) => r.from?.toLowerCase() === sender.id.toLowerCase());
    const hasOutgoing = sender.couple_requests_out && sender.couple_requests_out.toLowerCase() === p.id.toLowerCase();
    if (!hasIncoming && !hasOutgoing) {
      return { ok: false, error: 'no_such_proposal' };
    }

    bindCouple(p, sender);
    return {
      ok: true,
      status: 'coupled',
      partnerId: sender.id,
      partnerName: sender.username || sender.id,
      streak: p.couple_streak,
      directory: socialDirectory(p),
    };
  }

  function coupleDecline(p, m) {
    ensurePhase5(p);
    const otherId = String(m?.from || m?.to || m?.userId || p.couple_requests_out || '').trim().toLowerCase();
    if (!otherId) return { ok: false, error: 'no_such_user' };
    const other = db?.getProfile?.(otherId);

    p.couple_requests_in = (p.couple_requests_in || []).filter((r) => r.from?.toLowerCase() !== otherId);
    if (p.couple_requests_out && p.couple_requests_out.toLowerCase() === otherId) {
      p.couple_requests_out = null;
    }

    if (other) {
      ensurePhase5(other);
      other.couple_requests_in = (other.couple_requests_in || []).filter((r) => r.from?.toLowerCase() !== p.id.toLowerCase());
      if (other.couple_requests_out && other.couple_requests_out.toLowerCase() === p.id.toLowerCase()) {
        other.couple_requests_out = null;
      }
      db?.markProfile?.(other.id);
      pushProfile(other);
    }

    db?.markProfile?.(p.id);
    pushProfile(p);
    return { ok: true, directory: socialDirectory(p) };
  }

  function coupleBreak(p) {
    ensurePhase5(p);
    if (!p.partner_id) {
      return { ok: false, error: 'not_coupled' };
    }
    const oldPartnerId = p.partner_id;
    const partner = db?.getProfile?.(oldPartnerId);
    const savedStreak = Math.max(1, p.couple_streak || partner?.couple_streak || 1);
    const savedStats = mergeCoupleStats(p.couple_stats, partner?.couple_stats, savedStreak);

    p.past_couple_streaks = p.past_couple_streaks || {};
    p.past_couple_streaks[oldPartnerId] = savedStreak;
    p.past_couple_stats = p.past_couple_stats || {};
    p.past_couple_stats[oldPartnerId] = { ...savedStats };
    p.partner_id = null;
    p.couple_streak = 0;
    p.couple_since = null;
    p.couple_streak_day = null;

    if (partner) {
      ensurePhase5(partner);
      partner.past_couple_streaks = partner.past_couple_streaks || {};
      partner.past_couple_streaks[p.id] = savedStreak;
      partner.past_couple_stats = partner.past_couple_stats || {};
      partner.past_couple_stats[p.id] = { ...savedStats };
      if (partner.partner_id && partner.partner_id.toLowerCase() === p.id.toLowerCase()) {
        partner.partner_id = null;
        partner.couple_streak = 0;
        partner.couple_since = null;
        partner.couple_streak_day = null;
      }
      db?.markProfile?.(partner.id);
      pushProfile(partner);
      sendTo(partner.id, {
        type: 'social_notify',
        kind: 'couple_break',
        by: p.id,
        byName: p.username || p.id,
        savedStreak,
      });
    }

    db?.markProfile?.(p.id);
    pushProfile(p);

    onCoupleChanged(p.id, oldPartnerId, false);

    return {
      ok: true,
      oldPartnerId,
      savedStreak,
      directory: socialDirectory(p),
    };
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
    bagItemUse,
    passportState,
    passportClaim,
    bumpQuest,
    bumpCoupleStat,
    coupleMoment,
    onDailyLogin,
    founderClaim,
    canCall,
    socialDirectory,
    friendRequestSend,
    friendRequestAccept,
    friendRequestDecline,
    friendRemove,
    couplePropose,
    coupleAccept,
    coupleDecline,
    coupleBreak,
  };
}
