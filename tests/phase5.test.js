// tests/phase5.test.js — Phase 5 tests (node:test).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOWNHALL, HALL_CATEGORIES, QUESTS, PASSPORT, STREAK, OWL, VIP_CARDS, FOUNDER, CALL, CHEER, WORSHIP,
  utcDay, yesterday,
} from '../shared/phase5_rules.js';
import { ensurePhase5, createDailyService } from '../server/daily_service.js';
import { seedTownHallBots } from '../server/profile_factory.js';
import { createTownHallBotController } from '../server/town_hall_bots.js';

function createMockDb(initialProfiles = []) {
  const profiles = new Map();
  const marked = new Set();
  for (const p of initialProfiles) {
    profiles.set(p.id, p);
  }
  return {
    profiles,
    getProfile: (id) => profiles.get(String(id).toLowerCase()),
    putProfile: (p) => { profiles.set(p.id, p); marked.add(p.id); },
    markProfile: (id) => { marked.add(id); },
    allProfiles: () => [...profiles.values()],
    listProfiles: () => [...profiles.values()],
    marked,
  };
}

function makeProfile(id, overrides = {}) {
  const p = {
    id,
    username: id.toUpperCase(),
    gold: 5000,
    diamonds: 500,
    berries: 500,
    shards: 100,
    star_essence: 10,
    level: 15,
    exp: 100,
    partner_id: null,
    couple_streak: 0,
    friends: [],
    inventory: {},
    equipped: {},
    village: {
      castle_lv: 1,
      comfort: 1000,
      decor: {},
    },
    cp: 1000,
    arcade_best: 0,
    mono_stats: { goldWon: 0 },
    bag_items: {},
    title: null,
    badges: [],
    ...overrides,
  };
  return ensurePhase5(p);
}

test('worship once/day + champion counts', () => {
  let currentTime = 1760659200000; // 2026-10-17 00:00:00 UTC
  const now = () => currentTime;

  const nook = makeProfile('nook', {
    village: { castle_lv: 5, comfort: 5000, decor: {} }, // 10000
    cp: 20000,
    arcade_best: 1500,
    mono_stats: { goldWon: 100000 },
    couple_streak: 15,
  });
  const neen = makeProfile('neen', {
    village: { castle_lv: 3, comfort: 2000, decor: {} },
    cp: 12000,
    arcade_best: 800,
    mono_stats: { goldWon: 50000 },
    couple_streak: 15,
  });
  const visitor = makeProfile('visitor', { gold: 1000, diamonds: 50 });

  const db = createMockDb([nook, neen, visitor]);
  const service = createDailyService({ db, now });

  // 1. List Hall of Fame
  const list = service.hallList(visitor);
  assert.equal(list.ok, true);
  assert.equal(list.worshippedToday, false);
  assert.equal(list.categories.length, 5);

  const archCat = list.categories.find((c) => c.key === 'architect');
  assert.equal(archCat.rows[0].userId, 'nook');
  assert.equal(archCat.rows[0].value, 10000);

  // 2. Worship champions
  const res = service.hallWorship(visitor);
  assert.equal(res.ok, true);
  assert.equal(res.gold, 200);
  assert.equal(res.diamonds, 15);
  assert.ok(res.champions.includes('nook'));

  assert.equal(visitor.gold, 1200);
  assert.equal(visitor.diamonds, 65);
  assert.equal(nook.worship_count, 1);
  assert.ok(db.marked.has('visitor'));
  assert.ok(db.marked.has('nook'));

  // 3. Second worship on same day fails
  const res2 = service.hallWorship(visitor);
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'already_worshipped');

  // 4. Advance clock by 1 day
  currentTime += 86400000;
  const res3 = service.hallWorship(visitor);
  assert.equal(res3.ok, true);
  assert.equal(nook.worship_count, 2);
});

test('cheer claim once, expiry, own_cheer', () => {
  let currentTime = 1000000;
  const now = () => currentTime;
  let broadcasted = null;

  const winner = makeProfile('nook');
  const peer = makeProfile('peer');
  const latecomer = makeProfile('latecomer');
  const db = createMockDb([winner, peer, latecomer]);

  const service = createDailyService({
    db,
    now,
    broadcastAll: (msg) => { broadcasted = msg; },
  });

  const { cheerId, expiresAt } = service.emitCheer({
    winnerId: 'nook',
    winnerName: 'Nook',
    achievement: 'Forge +10 Sovereign Blade',
  });

  assert.ok(cheerId.startsWith('c_'));
  assert.equal(expiresAt, currentTime + 10000);
  assert.equal(broadcasted.type, 'global_cheer_banner');
  assert.equal(broadcasted.achievement, 'Forge +10 Sovereign Blade');

  // Winner cannot cheer themselves
  const ownRes = service.cheerClaim(winner, { cheerId });
  assert.equal(ownRes.ok, false);
  assert.equal(ownRes.error, 'own_cheer');

  // Peer claims cheer
  const peerGoldBefore = peer.gold;
  const claimRes = service.cheerClaim(peer, { cheerId });
  assert.equal(claimRes.ok, true);
  assert.equal(claimRes.gold, 50);
  assert.equal(peer.gold, peerGoldBefore + 50);

  // Peer cannot claim again
  const dupClaim = service.cheerClaim(peer, { cheerId });
  assert.equal(dupClaim.ok, false);
  assert.equal(dupClaim.error, 'already_cheered');

  // Expired cheer
  currentTime += 10001;
  const lateRes = service.cheerClaim(latecomer, { cheerId });
  assert.equal(lateRes.ok, false);
  assert.equal(lateRes.error, 'cheer_expired');
});

test('owl gift: level gate, friend gate, 3/day, postage partner discount, dupe vs transfer, claim merges refine max', () => {
  let currentTime = 1760659200000;
  const now = () => currentTime;
  let sentMail = null;

  const lowLv = makeProfile('low_lv', { level: 9, friends: ['peer'] });
  const sender = makeProfile('sender', {
    level: 12,
    berries: 500,
    friends: ['friend_user'],
    partner_id: 'partner_user',
    inventory: {
      sword: { refine: 3, dupes: 0 },
      shield: { refine: 1, dupes: 2 },
    },
    equipped: {
      outfit: { id: 'sword', refine: 3 }, // sword is equipped!
    },
    village: { decor: { dec_bench: 2 } },
    bag_items: { streak_freeze: 2 },
  });
  const friendUser = makeProfile('friend_user');
  const partnerUser = makeProfile('partner_user');
  const stranger = makeProfile('stranger');

  const db = createMockDb([lowLv, sender, friendUser, partnerUser, stranger]);
  const service = createDailyService({
    db,
    now,
    sendTo: (to, msg) => { sentMail = { to, msg }; },
  });

  // Level gate
  const lvRes = service.owlSendGift(lowLv, { to: 'peer', slot1: { kind: 'decor', decId: 'dec_bench' } });
  assert.equal(lvRes.ok, false);
  assert.equal(lvRes.error, 'level_too_low');

  // Friend gate
  const friendRes = service.owlSendGift(sender, { to: 'stranger', slot1: { kind: 'decor', decId: 'dec_bench' } });
  assert.equal(friendRes.ok, false);
  assert.equal(friendRes.error, 'not_friend');

  // Empty parcel
  const emptyRes = service.owlSendGift(sender, { to: 'friend_user' });
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.error, 'empty_parcel');

  // Equipped item blocked for transfer
  const equipRes = service.owlSendGift(sender, {
    to: 'friend_user',
    slot1: { kind: 'gear', itemId: 'sword', mode: 'transfer' },
  });
  assert.equal(equipRes.ok, false);
  assert.equal(equipRes.error, 'item_equipped');

  // Postage partner discount (partner: 25 vs friend: 50)
  // 1st parcel: Send dupe shield to friend (postage 50)
  const berriesBefore = sender.berries;
  const gift1 = service.owlSendGift(sender, {
    to: 'friend_user',
    slot1: { kind: 'gear', itemId: 'shield', mode: 'dupe' },
    slot2: { kind: 'berries', amount: 50 },
    note: 'Hello <friend>!',
    ribbon: 'mint',
  });
  assert.equal(gift1.ok, true);
  assert.equal(gift1.postage, 50);
  assert.equal(gift1.sentToday, 1);
  assert.equal(sender.berries, berriesBefore - 100); // 50 postage + 50 gift
  assert.equal(sender.inventory.shield.dupes, 1);
  assert.equal(sentMail.to, 'friend_user');
  assert.equal(sentMail.msg.mail.note, 'Hello friend!');

  // Friend claims dupe shield + berries
  const mailId1 = gift1.mailId;
  const claimRes1 = service.owlClaimMail(friendUser, { mailId: mailId1 });
  assert.equal(claimRes1.ok, true);
  assert.equal(friendUser.inventory.shield.refine, 0);
  assert.equal(friendUser.inventory.shield.dupes, 0);

  // 2nd parcel: Send transfer gear to partner (postage 25)
  // Unequip sword first
  sender.equipped.outfit = null;
  const partnerBerriesBefore = sender.berries;
  const gift2 = service.owlSendGift(sender, {
    to: 'partner_user',
    slot1: { kind: 'gear', itemId: 'sword', mode: 'transfer' },
    slot2: { kind: 'bag', key: 'streak_freeze' },
    note: 'For you!',
  });
  assert.equal(gift2.ok, true);
  assert.equal(gift2.postage, 25);
  assert.equal(sender.berries, partnerBerriesBefore - 25);
  assert.equal(sender.inventory.sword, undefined); // deleted from sender!
  assert.equal(sender.bag_items.streak_freeze, 1);

  // Partner already owns sword at refine 1, dupes 0
  partnerUser.inventory.sword = { refine: 1, dupes: 0 };
  const claimRes2 = service.owlClaimMail(partnerUser, { mailId: gift2.mailId });
  assert.equal(claimRes2.ok, true);
  // Merged: max(1, 3) = 3 refine, dupes += 1 = 1 dupe
  assert.equal(partnerUser.inventory.sword.refine, 3);
  assert.equal(partnerUser.inventory.sword.dupes, 1);
  assert.equal(partnerUser.bag_items.streak_freeze, 1);

  // 3rd parcel of the day
  const gift3 = service.owlSendGift(sender, {
    to: 'partner_user',
    slot1: { kind: 'decor', decId: 'dec_bench' },
  });
  assert.equal(gift3.ok, true);
  assert.equal(gift3.sentToday, 3);

  // 4th parcel triggers daily limit
  const gift4 = service.owlSendGift(sender, {
    to: 'partner_user',
    slot2: { kind: 'berries', amount: 10 },
  });
  assert.equal(gift4.ok, false);
  assert.equal(gift4.error, 'daily_limit');
});

test('vip buy each card + telelink both sides + asGift/use', () => {
  let currentTime = 100000;
  const now = () => currentTime;

  const player = makeProfile('player', {
    diamonds: 20000,
    shards: 500,
    friends: ['bestie'],
  });
  const bestie = makeProfile('bestie', { friends: ['player'] });
  const db = createMockDb([player, bestie]);
  const service = createDailyService({ db, now });

  // 1. Call Day Pass (300 💎, 24h, stacks)
  const pass1 = service.vipCardBuy(player, { card: 'call_day_pass' });
  assert.equal(pass1.ok, true);
  assert.equal(player.vip.call_until, currentTime + 24 * 3600_000);
  const pass2 = service.vipCardBuy(player, { card: 'call_day_pass' });
  assert.equal(pass2.ok, true);
  assert.equal(player.vip.call_until, currentTime + 48 * 3600_000);

  // 2. VIP Communicator (shards currency)
  const shardsBefore = player.shards;
  const comm = service.vipCardBuy(player, { card: 'vip_communicator', currency: 'shards' });
  assert.equal(comm.ok, true);
  assert.equal(player.vip.communicator, true);
  assert.equal(player.shards, shardsBefore - 200);

  // 3. Telelink Box (permanent 2-way with friend)
  const tele = service.vipCardBuy(player, { card: 'telelink_box', target: 'bestie' });
  assert.equal(tele.ok, true);
  assert.ok(player.vip.telelinks.includes('bestie'));
  assert.ok(bestie.vip.telelinks.includes('player'));

  // 4. Black VIP
  const black = service.vipCardBuy(player, { card: 'black_vip' });
  assert.equal(black.ok, true);
  assert.equal(player.vip.black, true);

  // 5. asGift & use from bag
  const giftBuy = service.vipCardBuy(player, { card: 'call_day_pass', asGift: true });
  assert.equal(giftBuy.ok, true);
  assert.equal(giftBuy.asGift, true);
  assert.equal(player.bag_items.vip_call_day_pass, 1);

  const prevUntil = player.vip.call_until;
  const useRes = service.vipCardUse(player, { card: 'call_day_pass' });
  assert.equal(useRes.ok, true);
  assert.equal(player.vip.call_until, prevUntil + 24 * 3600_000);
  assert.equal(player.bag_items.vip_call_day_pass, undefined);

  // 6. bagItemUse for random_dupe_box and mythic_selector_box
  player.bag_items.random_dupe_box = 1;
  player.bag_items.mythic_selector_box = 1;
  const dupeRes = service.bagItemUse(player, { key: 'random_dupe_box' });
  assert.equal(dupeRes.ok, true);
  assert.equal(player.bag_items.random_dupe_box, undefined);
  assert.ok(dupeRes.grantedItemId);

  const mythicRes = service.bagItemUse(player, { key: 'mythic_selector_box' });
  assert.equal(mythicRes.ok, true);
  assert.equal(player.bag_items.mythic_selector_box, undefined);
  assert.ok(player.inventory[mythicRes.grantedItemId]);
});

test('passport quests + bonus + 7th stamp parcel', () => {
  let currentTime = 1760659200000;
  const now = () => currentTime;
  let parcelSent = null;

  const player = makeProfile('player', { diamonds: 0 });
  const db = createMockDb([player]);
  const service = createDailyService({
    db,
    now,
    sendTo: (to, msg) => { parcelSent = msg; },
  });

  // Initial state
  const state1 = service.passportState(player);
  assert.equal(state1.ok, true);
  assert.equal(state1.quests.length, 3);
  assert.equal(state1.bonus.claimed, false);

  // Bump quests
  service.bumpQuest(player, 'play', 1);
  service.bumpQuest(player, 'harvest', 1);
  service.bumpQuest(player, 'pet', 2);

  // Pet not finished yet (goal is 3)
  const petEarly = service.passportClaim(player, { quest: 'pet' });
  assert.equal(petEarly.ok, false);
  assert.equal(petEarly.error, 'goal_not_reached');

  service.bumpQuest(player, 'pet', 1);

  // Try bonus before individual claims -> fails
  const bonusEarly = service.passportClaim(player, { quest: 'bonus' });
  assert.equal(bonusEarly.ok, false);
  assert.equal(bonusEarly.error, 'quests_incomplete');

  // Claim play (25), harvest (40), pet (25)
  assert.equal(service.passportClaim(player, { quest: 'play' }).reward, 25);
  assert.equal(service.passportClaim(player, { quest: 'harvest' }).reward, 40);
  assert.equal(service.passportClaim(player, { quest: 'pet' }).reward, 25);
  assert.equal(player.diamonds, 90);

  // Claim bonus (30) -> stamps becomes 1
  const bonusRes = service.passportClaim(player, { quest: 'bonus' });
  assert.equal(bonusRes.ok, true);
  assert.equal(bonusRes.stamps, 1);
  assert.equal(player.diamonds, 120);

  // Advance to 6 stamps, next day
  player.passport.stamps = 6;
  currentTime += 86400000;
  service.bumpQuest(player, 'play', 1);
  service.bumpQuest(player, 'harvest', 1);
  service.bumpQuest(player, 'pet', 3);
  service.passportClaim(player, { quest: 'play' });
  service.passportClaim(player, { quest: 'harvest' });
  service.passportClaim(player, { quest: 'pet' });

  // Claim 7th stamp bonus -> mails system parcel
  const bonus7 = service.passportClaim(player, { quest: 'bonus' });
  assert.equal(bonus7.ok, true);
  assert.equal(bonus7.stamps, 7);
  assert.equal(bonus7.parcelMailed, true);
  assert.ok(parcelSent);
  assert.equal(player.mailbox.length, 1);
  assert.equal(player.mailbox[0].kind, 'system');

  // Claim system parcel: 2x ticket_standard + 100 diamonds
  const claimParcel = service.owlClaimMail(player, { mailId: player.mailbox[0].id });
  assert.equal(claimParcel.ok, true);
  assert.equal(player.bag_items.ticket_standard, 2);
});

test('couple streak consecutive, freeze consumption, reset, day 7 rewards', () => {
  let currentTime = Date.parse('2026-10-17T00:00:00.000Z');
  const now = () => currentTime;
  let streakUpdates = [];

  const p1 = makeProfile('p1', {
    partner_id: 'p2',
    diamonds: 0,
    couple_streak: 6,
    couple_streak_day: '2026-10-16',
    bag_items: { streak_freeze: 1 },
  });
  const p2 = makeProfile('p2', {
    partner_id: 'p1',
    diamonds: 0,
    couple_streak: 6,
    couple_streak_day: '2026-10-16',
  });

  const db = createMockDb([p1, p2]);
  const service = createDailyService({
    db,
    now,
    sendTo: (to, msg) => { streakUpdates.push({ to, msg }); },
  });

  // 1. p1 logs in first on 2026-10-17
  const r1 = service.onDailyLogin(p1);
  assert.equal(r1.ok, true);
  assert.equal(r1.rewards, null); // Partner hasn't logged in yet

  // 2. p2 logs in on 2026-10-17 -> Day 7 streak triggers!
  const r2 = service.onDailyLogin(p2);
  assert.equal(r2.ok, true);
  assert.equal(r2.streak, 7);
  // Day 7 rewards: 20 daily + 170 bonus = 190 diamonds, 2 tickets, 1 freeze
  assert.equal(r2.rewards.diamonds, 190);
  assert.equal(r2.rewards.tickets, 2);
  assert.equal(r2.rewards.freezes, 1);
  assert.equal(p1.diamonds, 190);
  assert.equal(p2.diamonds, 190);
  assert.equal(p1.bag_items.ticket_standard, 2);
  assert.equal(p1.bag_items.streak_freeze, 2); // 1 previous + 1 earned

  // 3. Skip a day: jump to 2026-10-19 (missed 2026-10-18) -> freeze consumed!
  currentTime += 2 * 86400000;
  service.onDailyLogin(p1);
  const r3 = service.onDailyLogin(p2);
  assert.equal(r3.ok, true);
  assert.equal(r3.streak, 8);
  assert.equal(r3.rewards.consumedFreeze, true);
  assert.equal(p2.bag_items.streak_freeze, undefined); // p2's freeze consumed
  assert.equal(p1.bag_items.streak_freeze, 2);

  // 4. Skip 2 days with no freeze left for that gap: jump to 2026-10-22
  p1.bag_items.streak_freeze = 0;
  p2.bag_items.streak_freeze = 0;
  currentTime += 3 * 86400000;
  service.onDailyLogin(p1);
  const r4 = service.onDailyLogin(p2);
  assert.equal(r4.ok, true);
  assert.equal(r4.streak, 1); // Reset to 1!
  assert.equal(r4.rewards.diamonds, 20);
});

test('founder eligibility/code/once', () => {
  const nook = makeProfile('nook', { diamonds: 0, star_essence: 0 });
  const stranger = makeProfile('stranger', { diamonds: 0, star_essence: 0 });
  const db = createMockDb([nook, stranger]);
  const service = createDailyService({ db });

  // 1. Eligible by founder ID
  const claim1 = service.founderClaim(nook);
  assert.equal(claim1.ok, true);
  assert.equal(nook.founder_claimed, true);
  assert.equal(nook.title, 'Sky Party Founder');
  assert.ok(nook.titles.includes('Sky Party Founder'));
  assert.equal(nook.diamonds, 1000);
  assert.equal(nook.star_essence, 40);
  assert.equal(nook.bag_items.mythic_selector_box, 1);

  // Claim once only
  const claim2 = service.founderClaim(nook);
  assert.equal(claim2.ok, false);
  assert.equal(claim2.error, 'already_claimed');

  // 2. Stranger not eligible without code
  const claim3 = service.founderClaim(stranger);
  assert.equal(claim3.ok, false);
  assert.equal(claim3.error, 'not_eligible');

  // 3. Stranger with invalid code
  const claim4 = service.founderClaim(stranger, { code: 'WRONG' });
  assert.equal(claim4.ok, false);
  assert.equal(claim4.error, 'not_eligible');

  // 4. Stranger with valid code
  const claim5 = service.founderClaim(stranger, { code: 'SKYPARTY-V1' });
  assert.equal(claim5.ok, true);
  assert.equal(stranger.founder_claimed, true);
  assert.equal(stranger.diamonds, 1000);
  assert.equal(stranger.title, 'Sky Party Founder');
});

test('town hall bots: 4 bot accounts with distinct random costumes + autonomous walking around plaza', () => {
  const bots = seedTownHallBots();
  assert.equal(bots.length, 4);
  const outfitSet = new Set(bots.map((b) => b.equipped?.outfit?.id));
  assert.equal(outfitSet.size, 4, 'each bot wears a distinct random outfit');
  for (const b of bots) {
    assert.ok(b.is_bot);
    assert.ok(b.equipped?.outfit?.id && b.equipped.outfit.id !== 'newbie_outfit');
    assert.ok(b.appearance?.hair && b.appearance?.hairColor);
    assert.ok(b.equipped?.pet?.id);
    assert.ok(b.cp > 1000);
  }

  const db = createMockDb();
  const instances = new Map();
  const presence = new Map();
  const sockets = new Map();
  const broadcasts = [];
  const ctrl = createTownHallBotController({
    db,
    instances,
    presence,
    sockets,
    broadcast: (instId, msg) => broadcasts.push({ instId, msg }),
    tickMs: 60000,
  });

  try {
    const members = instances.get(TOWNHALL.ID);
    assert.equal(members.size, 4);
    for (const id of ctrl.botIds) {
      assert.ok(members.has(id));
      assert.ok(presence.has(id));
    }

    // Advance time past initial pause so bots pick paths and walk
    let t = Date.now() + 5000;
    for (let step = 0; step < 25; step++) {
      t += 200;
      ctrl.tick(t);
    }
    const moveMsgs = broadcasts.filter((b) => b.instId === TOWNHALL.ID && b.msg.type === 'player_moved');
    assert.ok(moveMsgs.length > 0, 'bots broadcast player_moved packets in Town Hall');
    for (const id of ctrl.botIds) {
      const s = presence.get(id);
      assert.ok(Math.abs(s.x) <= 17 && Math.abs(s.z) <= 17);
      assert.ok(Math.hypot(s.x, s.z) >= 1.9, 'bots stay clear of central fountain basin');
    }
  } finally {
    ctrl.close();
  }
});

test('social & couple hub: friend requests, remove friend, couple propose/accept, and Take a Break with streak memory', () => {
  let currentTime = 1760659200000;
  const now = () => currentTime;
  const notifications = [];
  const coupleChanges = [];

  const nook = makeProfile('nook', {
    username: 'nook',
    partner_id: 'neen',
    couple_streak: 14,
    friends: ['neen', 'mochi'],
  });
  const neen = makeProfile('neen', {
    username: 'neen',
    partner_id: 'nook',
    couple_streak: 14,
    friends: ['nook'],
  });
  const mochi = makeProfile('mochi', {
    username: 'mochi',
    friends: ['nook'],
  });
  const leo = makeProfile('leo', {
    username: 'leo',
    friends: [],
  });
  const ariaBot = makeProfile('aria', {
    username: 'Aria',
    is_bot: true,
    friends: [],
  });

  const db = createMockDb([nook, neen, mochi, leo, ariaBot]);
  const service = createDailyService({
    db,
    now,
    sendTo: (to, msg) => notifications.push({ to, msg }),
    isOnline: (id) => id === 'nook' || id === 'neen' || id === 'aria',
    getPresence: (id) => (id === 'nook' || id === 'neen' ? { instanceId: 'couple:neen|nook' } : null),
    onCoupleChanged: (a, b) => coupleChanges.push([a, b]),
  });

  // 1. Social directory reflects live partner, friends, and discoverable citizens
  const dir1 = service.socialDirectory(nook);
  assert.equal(dir1.ok, true);
  assert.equal(dir1.partner.id, 'neen');
  assert.equal(dir1.partner.online, true);
  assert.equal(dir1.friends.length, 2);
  assert.ok(dir1.discoverPlayers.some((d) => d.id === 'leo'));
  assert.ok(dir1.discoverPlayers.some((d) => d.id === 'aria'));

  // 2. Player-to-player Friend Request (nook -> leo) and Accept (leo accepts nook)
  const req1 = service.friendRequestSend(nook, { to: 'leo' });
  assert.equal(req1.ok, true);
  assert.equal(req1.status, 'pending');
  assert.equal(nook.friend_requests_out.length, 1);
  assert.equal(leo.friend_requests_in.length, 1);

  const acc1 = service.friendRequestAccept(leo, { from: 'nook' });
  assert.equal(acc1.ok, true);
  assert.ok(nook.friends.includes('leo'));
  assert.ok(leo.friends.includes('nook'));
  assert.equal(nook.friend_requests_out.length, 0);
  assert.equal(leo.friend_requests_in.length, 0);

  // 3. Citizen Bot Friend Request auto-accepts immediately
  const botReq = service.friendRequestSend(nook, { to: 'aria' });
  assert.equal(botReq.ok, true);
  assert.equal(botReq.status, 'accepted');
  assert.ok(nook.friends.includes('aria'));
  assert.ok(ariaBot.friends.includes('nook'));

  // 4. Remove Friend unlinks both sides (cannot remove bound partner while coupled)
  const badRem = service.friendRemove(nook, { friendId: 'neen' });
  assert.equal(badRem.ok, false);
  assert.equal(badRem.error, 'take_break_first');

  const remLeo = service.friendRemove(nook, { friendId: 'leo' });
  assert.equal(remLeo.ok, true);
  assert.ok(!nook.friends.includes('leo'));
  assert.ok(!leo.friends.includes('nook'));

  // 5. Couple "Take a Break" unbinds both players, keeps them as friends, and saves streak memory
  const initialStreak = nook.couple_streak;
  assert.ok(initialStreak >= 14);
  const brk = service.coupleBreak(nook);
  assert.equal(brk.ok, true);
  assert.equal(brk.oldPartnerId, 'neen');
  assert.equal(brk.savedStreak, initialStreak);
  assert.equal(nook.partner_id, null);
  assert.equal(neen.partner_id, null);
  assert.equal(nook.couple_streak, 0);
  assert.equal(neen.couple_streak, 0);
  assert.equal(nook.past_couple_streaks.neen, initialStreak);
  assert.equal(neen.past_couple_streaks.nook, initialStreak);
  assert.ok(nook.friends.includes('neen'));
  assert.ok(neen.friends.includes('nook'));
  assert.equal(coupleChanges.length, 1);

  // 6. Proposing to a new friend (mochi) starts a Pending Proposal; accepting starts at Day 1
  const propMochi = service.couplePropose(nook, { to: 'mochi' });
  assert.equal(propMochi.ok, true);
  assert.equal(propMochi.status, 'pending');
  assert.equal(mochi.couple_requests_in.length, 1);

  // Decline proposal from nook
  const decMochi = service.coupleDecline(mochi, { from: 'nook' });
  assert.equal(decMochi.ok, true);
  assert.equal(mochi.couple_requests_in.length, 0);
  assert.equal(nook.couple_requests_out, null);

  // 7. Re-coupling with previous partner (neen) restores saved streak (14 days) AND Love Chronicle stats!
  const propNeen = service.couplePropose(nook, { to: 'neen' });
  assert.equal(propNeen.ok, true);
  const accNeen = service.coupleAccept(neen, { from: 'nook' });
  assert.equal(accNeen.ok, true);
  assert.equal(nook.partner_id, 'neen');
  assert.equal(neen.partner_id, 'nook');
  assert.equal(nook.couple_streak, initialStreak);
  assert.equal(neen.couple_streak, initialStreak);
  assert.equal(coupleChanges.length, 2);

  // 8. Love Chronicle stats accumulate on both partners and survive Taking a Break
  const prevMoments = nook.couple_stats.momentsCaptured;
  const momRes = service.coupleMoment(nook, { kind: 'polaroid' });
  assert.equal(momRes.ok, true);
  assert.equal(nook.couple_stats.momentsCaptured, prevMoments + 1);
  assert.equal(neen.couple_stats.momentsCaptured, prevMoments + 1);

  const prevBless = nook.couple_stats.blessingsShared;
  service.bumpCoupleStat(nook, { blessingsShared: 1, callMinutes: 25, callSessions: 1, coopActivities: 2 });
  assert.equal(nook.couple_stats.blessingsShared, prevBless + 1);
  assert.equal(neen.couple_stats.blessingsShared, prevBless + 1);
  assert.ok(nook.couple_stats.callMinutes >= 25);
  assert.equal(nook.couple_stats.callMinutes, neen.couple_stats.callMinutes);
});


