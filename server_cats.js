/**
 * Nook Airline — 🐾 Purrst Class Lounge engine (server-authoritative)
 *
 * State (persisted inside the Vault file):
 *   vault.cats              → the shared lounge: owned cats + their needs + today's feeding log
 *   vault[role].fish        → 🐟 per person
 *   vault[role].catPity     → Kitty Capsule pity per person
 *   vault[role].catDay      → per-person daily counters (care fish, gifts, double pets)
 *
 * Messages (all start with `vault_cat_` so server.js routes them here):
 *   vault_cat_hello · vault_cat_pull · vault_cat_care · vault_cat_gift · vault_cat_convert
 */
const Cats = require('./public/cats.js');

const E = Cats.ECON;
const ROLES = ['bkk', 'dxb'];
const other = (r) => (r === 'bkk' ? 'dxb' : 'bkk');
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

module.exports = function createCats({ vault, persistVault, sendToRole, broadcastVault, publicProfiles, daily, features }) {
  const isCouple = () => !features || (typeof features === 'function' ? features().couple : features.couple);
  const lastPet = { bkk: { id: null, t: 0 }, dxb: { id: null, t: 0 } };
  const lastAction = { bkk: {}, dxb: {} };

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------
  function freshCat(by) {
    return { stars: 1, copies: 1, by, at: Date.now(), hunger: E.START_NEEDS, love: E.START_NEEDS, fun: E.START_NEEDS, t: Date.now(), care: { bkk: 0, dxb: 0 }, gifts: { bkk: '', dxb: '' } };
  }

  function lounge() {
    if (!vault.cats || typeof vault.cats !== 'object') {
      vault.cats = { created: Date.now(), owned: {}, fed: { day: '', bkk: false, dxb: false, paid: false }, log: [] };
      // Opening day: Mochi (the lounge mascot) moves in for both of you.
      vault.cats.owned.c_mochi = freshCat('both');
      console.log('[Cats] 🐾 Purrst Class Lounge opened — Mochi moved in');
    }
    const L = vault.cats;
    L.owned = L.owned || {};
    L.fed = L.fed || { day: '', bkk: false, dxb: false, paid: false };
    L.log = Array.isArray(L.log) ? L.log : [];
    return L;
  }

  function person(role) {
    const p = vault[role];
    if (typeof p.fish !== 'number') p.fish = 0;
    if (!p.fishWelcome) { p.fish += E.WELCOME_FISH; p.fishWelcome = true; }
    p.catPity = p.catPity || { epic: 0, mythic: 0 };
    const today = Cats.dayKey();
    if (!p.catDay || p.catDay.day !== today) p.catDay = { day: today, careFish: 0, gifts: 0, doublePets: 0 };
    p.catStats = p.catStats || { pulls: 0, feeds: 0, pets: 0, plays: 0, gifts: 0 };
    return p;
  }

  /** Bake decay into a cat's stored needs (so later math starts from "now"). */
  function settle(st, now) {
    const n = Cats.needsAt(st, now, Cats.decayMult(lounge().owned));
    Cats.NEEDS.forEach((k) => { st[k] = Math.round(n[k] * 10) / 10; });
    st.t = now;
    return n;
  }

  function fedToday() {
    const L = lounge();
    const today = Cats.dayKey();
    if (L.fed.day !== today) L.fed = { day: today, bkk: false, dxb: false, paid: false };
    return L.fed;
  }

  function log(role, kind, catId, extra) {
    const L = lounge();
    L.log.unshift({ t: Date.now(), role, kind, catId, ...(extra || {}) });
    if (L.log.length > 30) L.log.length = 30;
  }

  /** Small cat-only patch to both phones (cheaper than a full profile broadcast). */
  function pushEvent(role, payload) {
    const L = lounge();
    const cat = payload.catId ? L.owned[payload.catId] : null;
    const msg = {
      type: 'vault_cat_event',
      role,
      ...payload,
      cat,
      fish: { bkk: vault.bkk ? vault.bkk.fish : 0, dxb: vault.dxb ? vault.dxb.fish : 0 },
      catDay: {
        bkk: vault.bkk ? vault.bkk.catDay : null,
        dxb: vault.dxb ? vault.dxb.catDay : null
      },
      fed: L.fed
    };
    if (isCouple()) {
      ROLES.forEach((r) => sendToRole(r, msg));
    } else {
      sendToRole(role, msg);
    }
  }

  function giveFish(role, amount, capped) {
    const p = person(role);
    let n = amount;
    if (capped) {
      n = Math.max(0, Math.min(amount, E.CARE_FISH_CAP - p.catDay.careFish));
      p.catDay.careFish += n;
    }
    p.fish += n;
    return n;
  }

  // ---------------------------------------------------------------------------
  // 🎰 Kitty Capsule
  // ---------------------------------------------------------------------------
  function rollRarity(p) {
    p.catPity.epic += 1;
    p.catPity.mythic += 1;
    let mythic = E.RATES.mythic;
    if (p.catPity.mythic > E.MYTHIC_SOFT) mythic += (p.catPity.mythic - E.MYTHIC_SOFT) * E.MYTHIC_STEP;
    if (p.catPity.mythic >= E.MYTHIC_HARD || Math.random() < mythic) {
      p.catPity.mythic = 0; p.catPity.epic = 0; return 'mythic';
    }
    if (p.catPity.epic >= E.EPIC_PITY || Math.random() < E.RATES.epic / (1 - E.RATES.mythic)) {
      p.catPity.epic = 0; return 'epic';
    }
    return Math.random() < E.RATES.rare / (1 - E.RATES.mythic - E.RATES.epic) ? 'rare' : 'common';
  }

  function pull(role, count) {
    const p = person(role);
    const L = lounge();
    const cost = count === 10 ? E.PULL_10 : E.PULL_1;
    if (p.fish < cost) return { error: `Not enough fish 🐟 (need ${cost})` };
    p.fish -= cost;
    const now = Date.now();
    const results = [];
    for (let i = 0; i < count; i++) {
      const rarity = rollRarity(p);
      const pool = Cats.poolOf(rarity);
      const def = pool[Math.floor(Math.random() * pool.length)];
      const st = L.owned[def.id];
      const res = { id: def.id, rarity, isNew: false, stars: 1, refund: 0 };
      if (!st) {
        L.owned[def.id] = freshCat(role);
        res.isNew = true;
      } else {
        settle(st, now);
        st.copies = (st.copies || 1) + 1;
        if (st.stars < E.MAX_STARS) {
          st.stars += 1;
          res.starUp = true;
        } else {
          res.refund = E.MAXED_REFUND[rarity];
          p.fish += res.refund;
        }
        // A reunion perks them up
        st.love = Math.min(100, st.love + 15);
        res.stars = st.stars;
      }
      results.push(res);
    }
    p.catStats.pulls += count;
    const best = results.reduce((a, b) => (Cats.RARITY[b.rarity].rank > Cats.RARITY[a.rarity].rank ? b : a));
    log(role, 'pull', best.id, { rarity: best.rarity, count });
    persistVault();
    console.log(`[Cats] 🎰 ${role.toUpperCase()} Kitty Capsule ×${count}: ${results.map((r) => Cats.RARITY[r.rarity].short).join('')}`);
    return { results, best };
  }

  // ---------------------------------------------------------------------------
  // 🤲 Care
  // ---------------------------------------------------------------------------
  /** 🤝 Shift handoff — once both of you have done a feeding round today, both get fish. */
  function checkHandoff(role) {
    if (!isCouple()) return [];
    const fed = fedToday();
    fed[role] = true;
    if (fed.bkk && fed.dxb && !fed.paid) {
      fed.paid = true;
      ROLES.forEach((r) => giveFish(r, E.HANDOFF_BONUS, false));
      console.log(`[Cats] 🤝 Shift handoff complete → +${E.HANDOFF_BONUS}🐟 each`);
      return [{ kind: 'handoff', amount: E.HANDOFF_BONUS }];
    }
    return [];
  }
  function care(role, catId, action) {
    const L = lounge();
    const st = L.owned[catId];
    const def = Cats.BY_ID[catId];
    if (!st || !def) return { error: 'That cat isn’t in the lounge' };
    if (!['feed', 'pet', 'play', 'brush'].includes(action)) return { error: 'Unknown action' };
    const p = person(role);
    const now = Date.now();
    const cd = { feed: E.FEED_COOLDOWN_MS, pet: E.PET_COOLDOWN_MS, play: E.PLAY_COOLDOWN_MS, brush: E.BRUSH_COOLDOWN_MS || 1200 }[action];
    if (now - (lastAction[role][action] || 0) < cd * 0.8) return { silent: true };
    lastAction[role][action] = now;

    const before = settle(st, now);
    const out = { action, catId, gain: 0, bonuses: [] };

    if (action === 'feed') {
      if (before.hunger >= E.FULL_AT) {
        const bonuses = checkHandoff(role);
        persistVault();
        return { soft: 'full', catId, action, bonuses };
      }
      st.hunger = Math.min(100, st.hunger + E.FEED);
      out.gain = giveFish(role, E.CARE_FISH.feed, true);
      p.catStats.feeds += 1;
      out.bonuses.push(...checkHandoff(role));
      if (daily) daily.track(role, 'cat_feed', 1);
    } else if (action === 'pet') {
      const gainLove = E.PET * (def.perk === 'sakura' ? 2 : 1);
      const wasFull = before.love >= 99.5;
      st.love = Math.min(100, st.love + gainLove);
      out.gain = wasFull ? 0 : giveFish(role, E.CARE_FISH.pet, true);
      p.catStats.pets += 1;
      // 🫶 Double pet — only active if paired with couple partner
      if (isCouple()) {
        lastPet[role] = { id: catId, t: now };
        const o = lastPet[other(role)];
        if (o && o.id === catId && now - o.t < E.DOUBLE_PET_WINDOW_MS) {
          const can = ROLES.filter((r) => person(r).catDay.doublePets < E.DOUBLE_PET_MAX);
          if (can.length) {
            can.forEach((r) => { person(r).catDay.doublePets += 1; giveFish(r, E.DOUBLE_PET_BONUS, false); });
            st.love = Math.min(100, st.love + 10);
            out.bonuses.push({ kind: 'double', amount: E.DOUBLE_PET_BONUS });
            lastPet.bkk.t = 0; lastPet.dxb.t = 0;   // one bonus per overlap
          }
        }
      }
      if (daily) daily.track(role, 'cat_pet', 1);
    } else if (action === 'brush') {
      const gainLove = (E.BRUSH || 20) * (def.perk === 'sakura' ? 1.5 : 1);
      st.love = Math.min(100, st.love + gainLove);
      st.fun = Math.min(100, st.fun + 5);
      out.gain = giveFish(role, (E.CARE_FISH && E.CARE_FISH.brush) || 2, true);
      p.catStats.brushes = (p.catStats.brushes || 0) + 1;
      if (daily) daily.track(role, 'cat_pet', 1);
    } else if (action === 'play') {
      if (before.fun >= E.TIRED_AT) return { soft: 'tired', catId, action };
      st.fun = Math.min(100, st.fun + E.PLAY);
      st.hunger = Math.max(0, st.hunger - 4);   // zoomies make you hungry
      out.gain = giveFish(role, E.CARE_FISH.play, true);
      p.catStats.plays += 1;
      if (daily) daily.track(role, 'cat_play', 1);
    }
    st.care = st.care || { bkk: 0, dxb: 0 };
    st.care[role] = (st.care[role] || 0) + (action === 'pet' ? 1 : (action === 'brush' ? 2 : 3));
    if (action !== 'pet' && action !== 'brush') log(role, action, catId);
    persistVault();
    return out;
  }

  // ---------------------------------------------------------------------------
  // 🎁 Gifts
  // ---------------------------------------------------------------------------
  function gift(role, catId) {
    const L = lounge();
    const st = L.owned[catId];
    const def = Cats.BY_ID[catId];
    if (!st || !def) return { error: 'That cat isn’t in the lounge' };
    const p = person(role);
    const today = Cats.dayKey();
    st.gifts = st.gifts || { bkk: '', dxb: '' };
    if (st.gifts[role] === today) return { error: `${def.name} already gave you a gift today 💝` };
    const n = settle(st, Date.now());
    if (Cats.moodOf(n) < E.GIFT_MOOD) return { error: `${def.name} isn’t happy enough to bring gifts yet` };
    if (p.catDay.gifts >= Cats.giftCap(L.owned)) return { error: 'The cats have given you all their gifts today 🎁' };

    const R = Cats.RARITY[def.rarity];
    const stars = st.stars || 1;
    const items = { fish: R.giftFish + (stars - 1) * 2, diamonds: 0, stardust: 0 };
    const gemRoll = def.perk === 'fortune' || Math.random() < R.gemChance + (stars - 1) * 0.04;
    if (gemRoll) {
      items.diamonds = randInt(R.gem[0], R.gem[1]) + (stars - 1);
      if (def.perk === 'fortune') items.diamonds *= 2;
    }
    if (def.perk === 'nebula') items.stardust = randInt(10, 25) + stars * 2;

    st.gifts[role] = today;
    p.catDay.gifts += 1;
    p.catStats.gifts += 1;
    p.fish += items.fish;
    if (items.diamonds) {
      p.diamonds += items.diamonds;
      p.stats = p.stats || {};
      p.stats.earned = (p.stats.earned || 0) + items.diamonds;
    }
    if (items.stardust) p.stardust = (p.stardust || 0) + items.stardust;
    log(role, 'gift', catId);
    persistVault();
    console.log(`[Cats] 🎁 ${def.name} → ${role.toUpperCase()}: ${items.fish}🐟 ${items.diamonds}💎 ${items.stardust}✨`);
    return { catId, items };
  }

  // ---------------------------------------------------------------------------
  // 💎 → 🐟
  // ---------------------------------------------------------------------------
  function convert(role, packId) {
    const pack = E.CONVERT.find((x) => x.id === packId);
    if (!pack) return { error: 'Unknown pack' };
    const p = person(role);
    if (p.diamonds < pack.diamonds) return { error: `Need 💎${pack.diamonds}` };
    p.diamonds -= pack.diamonds;
    p.lastSpentAt = Date.now();
    p.fish += pack.fish;
    persistVault();
    return { pack };
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  function handle(ws, role, message, sendTo) {
    const reqId = message.reqId;
    const err = (error) => sendTo(ws, { type: 'vault_error', error, reqId, scope: 'cats' });
    switch (message.type) {
      case 'vault_cat_hello': {
        const fresh = !vault.cats;
        lounge();
        ROLES.forEach(person);
        persistVault();
        if (fresh) broadcastVault({ catsOpened: true });
        else sendTo(ws, { type: 'vault_profiles', profiles: publicProfiles() });
        return true;
      }
      case 'vault_cat_pull': {
        const count = message.count === 10 ? 10 : 1;
        const out = pull(role, count);
        if (out.error) { err(out.error); return true; }
        sendTo(ws, { type: 'vault_cat_pull_result', role, results: out.results, reqId, profiles: publicProfiles() });
        if (isCouple()) {
          sendToRole(other(role), { type: 'vault_cat_event', role, action: 'pull', catId: out.best.id, best: out.best, count, profiles: publicProfiles() });
        }
        return true;
      }
      case 'vault_cat_care': {
        const out = care(role, String(message.catId || ''), String(message.action || ''));
        if (out.error) { err(out.error); return true; }
        if (out.silent) return true;
        if (out.soft) {
          if (out.bonuses && out.bonuses.length) pushEvent(role, { action: out.action, catId: out.catId, gain: 0, bonuses: out.bonuses, soft: out.soft, reqId });
          else sendTo(ws, { type: 'vault_cat_event', role, action: out.action, catId: out.catId, soft: out.soft, reqId });
          return true;
        }
        pushEvent(role, { action: out.action, catId: out.catId, gain: out.gain, bonuses: out.bonuses, reqId });
        return true;
      }
      case 'vault_cat_gift': {
        const out = gift(role, String(message.catId || ''));
        if (out.error) { err(out.error); return true; }
        sendTo(ws, { type: 'vault_cat_gift_result', role, catId: out.catId, items: out.items, reqId });
        if (isCouple()) {
          sendToRole(other(role), { type: 'vault_cat_event', role, action: 'gift', catId: out.catId });
        }
        broadcastVault();
        return true;
      }
      case 'vault_cat_convert': {
        const out = convert(role, String(message.pack || ''));
        if (out.error) { err(out.error); return true; }
        sendTo(ws, { type: 'vault_cat_converted', role, pack: out.pack, reqId });
        broadcastVault();
        return true;
      }
    }
    return false;
  }

  // Make sure fish/pity fields exist for profiles loaded from older saves (only once the lounge is open).
  if (vault.cats) ROLES.forEach(person);

  return { handle, lounge, person };
};
