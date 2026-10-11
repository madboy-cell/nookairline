/**
 * Nook Airline — 🐾 Purrst Class Lounge
 * Shared config for the server (authoritative) and the browser (display only).
 *
 *   • One shared lounge for the couple: every cat anyone adopts lives with both of you.
 *   • 🐟 Fish = cat currency (per person). Earned by caring + cat gifts, or converted from 💎.
 *   • Cats never die or leave. Neglected cats just sulk and nap until someone visits.
 */
(function (root) {
  const ECON = {
    PULL_1: 30,
    PULL_10: 270,
    WELCOME_FISH: 150,                 // 5 free capsules for each of you on opening day

    RATES: { mythic: 0.02, epic: 0.10, rare: 0.30 },   // the rest is common (58%)
    EPIC_PITY: 10,                     // an Epic or better at least every 10 capsules
    MYTHIC_SOFT: 45,                   // after 45 dry capsules the Mythic chance climbs…
    MYTHIC_STEP: 0.05,
    MYTHIC_HARD: 60,                   // …and the 60th is guaranteed

    MAX_STARS: 5,                      // duplicates add a ⭐ (better gifts); past ★5 they refund fish
    MAXED_REFUND: { common: 6, rare: 12, epic: 25, mythic: 60 },

    // 💎 → 🐟 (one-way). Bigger packs get a little extra.
    CONVERT: [
      { id: 's', diamonds: 10, fish: 30 },
      { id: 'm', diamonds: 30, fish: 95 },
      { id: 'l', diamonds: 90, fish: 300 }
    ],

    // Needs fall from 100 → 0 over this many hours
    DECAY_H: { hunger: 10, love: 14, fun: 8 },
    START_NEEDS: 80,
    FEED: 45, PET: 6, PLAY: 35,
    FULL_AT: 92,                       // "I'm full!" — feeding does nothing above this
    TIRED_AT: 95,                      // too sleepy to play above this fun level

    CARE_FISH: { feed: 3, pet: 1, play: 4 },
    CARE_FISH_CAP: 60,                 // per person per day
    PET_COOLDOWN_MS: 650,
    FEED_COOLDOWN_MS: 2500,
    PLAY_COOLDOWN_MS: 4000,

    GIFT_MOOD: 60,                     // happy cats (mood ≥ 60) bring each of you one gift a day
    GIFTS_PER_DAY: 8,

    HANDOFF_BONUS: 25,                 // 🤝 both of you fed the cats today → +25🐟 each, once a day
    DOUBLE_PET_WINDOW_MS: 2500,        // 🫶 petting the same cat at the same time
    DOUBLE_PET_BONUS: 5,
    DOUBLE_PET_MAX: 4,

    LOUNGE_VISIBLE: 6                  // cats walking around the room at once
  };

  const RARITY = {
    common: { rank: 0, label: 'Common', short: 'C', color: '#f9a8d4', glow: 'rgba(249,168,212,0.55)', giftFish: 4, gemChance: 0.3, gem: [3, 6] },
    rare:   { rank: 1, label: 'Rare',   short: 'R', color: '#7dd3fc', glow: 'rgba(125,211,252,0.6)',  giftFish: 6, gemChance: 0.4, gem: [5, 9] },
    epic:   { rank: 2, label: 'Epic',   short: 'E', color: '#c084fc', glow: 'rgba(192,132,252,0.65)', giftFish: 9, gemChance: 0.55, gem: [8, 14] },
    mythic: { rank: 3, label: 'Mythic', short: 'M', color: '#fcd34d', glow: 'rgba(252,211,77,0.75)',  giftFish: 14, gemChance: 0.75, gem: [12, 20] }
  };

  /**
   * The roster. `food` is what appears in the bowl, `line` shows on the cat card,
   * `meow` shifts the synthesized meow pitch, `perk` (mythics) changes the rules a little.
   */
  const CATS = [
    // ---- Common ----
    { id: 'c_mochi',  name: 'Mochi',      breed: 'Orange Tabby',     rarity: 'common', food: '🍗', meow: 1.0,  line: 'Chubby, cheerful, will absolutely sit on your keyboard.' },
    { id: 'c_kumo',   name: 'Kumo',       breed: 'Grey Tabby',       rarity: 'common', food: '🐟', meow: 0.9,  line: 'A sleepy little cloud. Naps are a lifestyle.' },
    { id: 'c_patch',  name: 'Patches',    breed: 'Calico',           rarity: 'common', food: '🦐', meow: 1.15, line: 'Chatty and nosy — must inspect every bag you open.' },
    { id: 'c_tux',    name: 'Sir Tux',    breed: 'Tuxedo',           rarity: 'common', food: '🐟', meow: 0.95, line: 'Dressed for First Class at all times. Bow tie non-negotiable.' },
    { id: 'c_noir',   name: 'Noir',       breed: 'Black Cat',        rarity: 'common', food: '🍣', meow: 1.1,  line: 'Shy for five minutes, then your velcro shadow forever.' },
    { id: 'c_yuki',   name: 'Yuki',       breed: 'Snow White',       rarity: 'common', food: '🥛', meow: 1.25, line: 'Soft as fresh snow, and just as gentle.' },
    { id: 'c_moo',    name: 'Moo',        breed: 'Cow Cat',          rarity: 'common', food: '🍗', meow: 0.85, line: 'Goofy. Tongue out roughly 80% of the day.' },
    { id: 'c_toffee', name: 'Toffee',     breed: 'Tortoiseshell',    rarity: 'common', food: '🦐', meow: 1.05, line: 'Sassy queen. Tortitude included at no extra cost.' },
    // ---- Rare ----
    { id: 'r_siam',    name: 'Wichien',       breed: 'Siamese · Wichien Maat 🇹🇭', rarity: 'rare', food: '🍣', meow: 1.3,  line: 'Thai royalty. Extremely vocal about breakfast.' },
    { id: 'r_korat',   name: 'Si Sawat',      breed: 'Korat 🇹🇭',               rarity: 'rare', food: '🐟', meow: 1.05, line: 'Thailand’s silver luck cat. Brides used to receive one for good fortune.' },
    { id: 'r_blue',    name: 'Boris',         breed: 'Russian Blue',            rarity: 'rare', food: '🐟', meow: 0.9,  line: 'Quiet, dignified, secretly loves his scarf.' },
    { id: 'r_persian', name: 'Princess Puff', breed: 'Persian',                 rarity: 'rare', food: '🥛', meow: 1.2,  line: 'Expects to be brushed. Daily. By royal decree.' },
    { id: 'r_brit',    name: 'Earl Grey',     breed: 'British Shorthair',       rarity: 'rare', food: '🍰', meow: 0.8,  line: 'Round, refined, and always ready for tea time.' },
    { id: 'r_sphynx',  name: 'Pharaoh',       breed: 'Sphynx',                  rarity: 'rare', food: '🍗', meow: 1.1,  line: 'Always cold, always cuddly. The sweater stays on.' },
    { id: 'r_munch',   name: 'Biscuit',       breed: 'Munchkin',                rarity: 'rare', food: '🍪', meow: 1.35, line: 'Tiny legs, enormous enthusiasm. Zooms at 3 a.m.' },
    { id: 'r_birman',  name: 'Lotus',         breed: 'Birman',                  rarity: 'rare', food: '🐟', meow: 1.0,  line: 'Serene temple cat with perfect little white gloves.' },
    // ---- Epic ----
    { id: 'e_khao',    name: 'Khao Manee',  breed: 'Khao Manee 🇹🇭 “Diamond Eye”', rarity: 'epic', food: '🍣', meow: 1.15, line: 'One sapphire eye, one golden. Once kept only by Thai kings.' },
    { id: 'e_mau',     name: 'Dune',        breed: 'Arabian Mau 🇦🇪',             rarity: 'epic', food: '🍖', meow: 1.0,  line: 'Born on the Emirati sands. Fearless explorer of every box.' },
    { id: 'e_fold',    name: 'Ollie',       breed: 'Scottish Fold',              rarity: 'epic', food: '🦐', meow: 1.25, line: 'Owl face, folded ears, permanently surprised.' },
    { id: 'e_ragdoll', name: 'Cloud',       breed: 'Ragdoll',                    rarity: 'epic', food: '🥛', meow: 1.05, line: 'Goes completely floppy when you pick her up. Pure trust.' },
    { id: 'e_coon',    name: 'Bear',        breed: 'Maine Coon',                 rarity: 'epic', food: '🍖', meow: 0.7,  line: 'A gentle giant with a lion’s mane and a kitten’s heart.' },
    { id: 'e_bengal',  name: 'Tiger Lily',  breed: 'Bengal',                     rarity: 'epic', food: '🍗', meow: 1.1,  line: 'Tiny jungle cat. Pounces first, asks questions never.' },
    // ---- Mythic ----
    { id: 'm_maneki',  name: 'Fortune',          breed: 'Golden Maneki-neko', rarity: 'mythic', food: '🍣', meow: 1.15, perk: 'fortune', perkText: 'Every gift includes 💎 — and twice as many.', line: 'The beckoning lucky cat. Wave back and good things arrive.' },
    { id: 'm_moon',    name: 'Qamar',            breed: 'Desert Moon Cat',    rarity: 'mythic', food: '🍖', meow: 0.95, perk: 'moon',    perkText: 'Her calm aura: every cat’s needs fade 20% slower.', line: 'Walks between the Dubai dunes and the night sky.' },
    { id: 'm_sakura',  name: 'Hanami',           breed: 'Sakura Spirit',      rarity: 'mythic', food: '🍡', meow: 1.3,  perk: 'sakura',  perkText: 'Petting her fills love twice as fast.', line: 'Appears only where petals fall. Two tails, one big heart.' },
    { id: 'm_nebula',  name: 'Nova',             breed: 'Cosmic Cat',         rarity: 'mythic', food: '🌟', meow: 1.2,  perk: 'nebula',  perkText: 'Her gifts include ✨ Stardust for the Vault.', line: 'Fell out of a galaxy and landed in your lounge.' },
    { id: 'm_captain', name: 'Captain Whiskers', breed: 'Nook Airline Pilot', rarity: 'mythic', food: '🐟', meow: 1.0,  perk: 'captain', perkText: '+2 extra cat gifts for each of you every day.', line: 'The airline’s founding pilot. Salutes every passenger.' }
  ];
  const BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const NEEDS = ['hunger', 'love', 'fun'];

  const clamp = (v) => Math.max(0, Math.min(100, v));

  /** Lounge-wide decay multiplier (Qamar slows everything down). */
  function decayMult(owned) {
    return owned && owned.m_moon ? 0.8 : 1;
  }

  /** Needs of a stored cat state, projected to `now` (does not mutate). */
  function needsAt(st, now, mult) {
    const t = st && st.t ? st.t : now;
    const h = Math.max(0, (now - t) / 3600000) * (mult || 1);
    const out = {};
    NEEDS.forEach((k) => { out[k] = clamp((st ? st[k] : 0) - (h * 100) / ECON.DECAY_H[k]); });
    return out;
  }

  /** Mood 0..100 — hunger matters a little more than the others. */
  function moodOf(n) {
    return Math.round(n.hunger * 0.4 + n.love * 0.3 + n.fun * 0.3);
  }

  function moodInfo(m) {
    if (m >= 80) return { key: 'joy',   label: 'Over the moon', emoji: '😻' };
    if (m >= 60) return { key: 'happy', label: 'Happy',         emoji: '😺' };
    if (m >= 35) return { key: 'okay',  label: 'Okay',          emoji: '🐱' };
    return { key: 'sulky', label: 'Sulking', emoji: '😿' };
  }

  /** The need a cat would ask for right now (or null when all good). */
  function wantOf(n) {
    const low = NEEDS.map((k) => [k, n[k]]).sort((a, b) => a[1] - b[1])[0];
    return low[1] < 45 ? low[0] : null;
  }

  function giftCap(owned) {
    return ECON.GIFTS_PER_DAY + (owned && owned.m_captain ? 2 : 0);
  }

  function dayKey(d) {
    return (d || new Date()).toISOString().slice(0, 10);
  }

  /** Pool by rarity for the Kitty Capsule. */
  function poolOf(rarity) {
    return CATS.filter((c) => c.rarity === rarity);
  }

  /** Fixed lounge spots in the 4:3 room art: x% from left, y% from bottom, s = depth scale. */
  const SPOTS = [
    { id: 'rug-c',  x: 49, y: 7,  s: 1.0 },
    { id: 'rug-l',  x: 37, y: 13, s: 0.96 },
    { id: 'rug-r',  x: 61, y: 12, s: 0.96 },
    { id: 'sofa-l', x: 37, y: 41, s: 0.74 },
    { id: 'sofa-c', x: 51, y: 42, s: 0.74 },
    { id: 'sofa-r', x: 64, y: 41, s: 0.74 },
    { id: 'bed',    x: 81, y: 22, s: 0.86, nap: true },
    { id: 'box',    x: 70, y: 34, s: 0.78 },
    { id: 'tree',   x: 21, y: 51, s: 0.66, nap: true },
    { id: 'floor-l', x: 25, y: 16, s: 0.92 },
    { id: 'bowl',   x: 85, y: 6,  s: 1.0 }
  ];

  const api = { ECON, RARITY, CATS, BY_ID, NEEDS, SPOTS, decayMult, needsAt, moodOf, moodInfo, wantOf, giftCap, dayKey, poolOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NookCatsData = api;
})(typeof window !== 'undefined' ? window : globalThis);
