/**
 * ✈️ Nook Airline — Sky Monopoly Rules & Pure Economics
 * Shared between the browser game, the solo bot AI, and the headless Monte Carlo simulator.
 * UMD pattern: window.NookMonoRules or module.exports
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NookMonoRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================
  // 1. GAME CONFIG
  // =========================================================
  const MONO_CFG = {
    VERSION: 2,
    START_MILES: 1200,
    LAP_BONUS: 200,
    RENT_MULT: { 1: 1, 2: 4, 3: 12 }, // 🏠 / 🏠🏠 / 🏨
    ZONE_MULT: 2,                     // own a full zone → rent ×2
    FINAL_BOARDING_STAGES: [
      { round: 14, mult: 1.5 },
      { round: 18, mult: 2 }
    ],
    WIN_NET_WORTH: 5500,
    MAX_ROUNDS: 24,
    VIBE_PASSES: 3,
    VIBE_MISS_MULT: 2,
    TAKEOVER_LOSE_MULT: 1.5,
    UPGRADE_RATE: 0.65,
    LIQUIDATION_RATE: 0.5,            // auto-sell to bank at 50% when you can't pay
    CASINO_BET: 100,
    MAX_ITEMS: 2,
    AIRDROP_FULL_CASH: 150,
    MAGNET_RATE: 0.25
  };

  const ZONES = {
    bkk: { label: 'Bangkok' },
    dxb: { label: 'Dubai' },
    tyo: { label: 'Tokyo' },
    eu: { label: 'Europe' },
    got: { label: 'Westeros' }
  };

  // =========================================================
  // 2. BOARD TILES (20 TILES, CLOCKWISE FROM TOP-LEFT START)
  // =========================================================
  const MONOPOLY_TILES = [
    { id: 0, name: 'Departure Gate', shortName: 'START', icon: '🛫', zone: 'corner', type: 'start', price: 0, rent: 0, desc: 'Pass or land to collect +200 miles.' },
    { id: 1, name: 'Yaowarat Street', shortName: 'Yaowarat', icon: '🥢', zone: 'bkk', type: 'property', price: 100, rent: 30, desc: 'Sizzling night market, Michelin seafood & gold shops.' },
    { id: 2, name: 'Siam Paragon', shortName: 'Paragon', icon: '🛍️', zone: 'bkk', type: 'property', price: 140, rent: 45, desc: 'Luxury flagship boutiques & sweet dessert cafes.' },
    { id: 3, name: 'Chatuchak Market', shortName: 'Chatuchak', icon: '🛺', zone: 'bkk', type: 'property', price: 160, rent: 55, desc: 'Vintage treasures, coconut ice cream & artisan art.' },
    { id: 4, name: 'Sky Casino', shortName: 'CASINO', icon: '🎰', zone: 'corner', type: 'casino', price: 0, rent: 0, desc: 'Spin the slots for 100 miles. Jackpot pays 1,000!' },
    { id: 5, name: 'Dubai Gold Souk', shortName: 'Gold Souk', icon: '🍫', zone: 'dxb', type: 'property', price: 180, rent: 60, desc: 'Pistachio knafeh chocolates & gleaming gold filigree.' },
    { id: 6, name: 'Palm Jumeirah', shortName: 'Palm', icon: '🏖️', zone: 'dxb', type: 'property', price: 220, rent: 75, desc: 'Arabian sunset villas & private yachts.' },
    { id: 7, name: 'Airdrop Crate', shortName: 'AIRDROP', icon: '🪂', zone: 'special', type: 'airdrop', price: 0, rent: 0, desc: 'A cargo plane drops you a free sabotage item!' },
    { id: 8, name: 'Burj Khalifa', shortName: 'Burj', icon: '🏙️', zone: 'dxb', type: 'property', price: 260, rent: 90, desc: 'The world’s highest lounge with fountain views.' },
    { id: 9, name: 'Sky Bridge', shortName: 'BRIDGE', icon: '✈️', zone: 'special', type: 'bridge', price: 0, rent: 0, desc: 'First-class teleport straight to your opponent.' },
    { id: 10, name: 'Black Market', shortName: 'MARKET', icon: '🎒', zone: 'corner', type: 'market', price: 0, rent: 0, desc: 'Buy one sabotage item from 3 random offers.' },
    { id: 11, name: 'Shibuya Crossing', shortName: 'Shibuya', icon: '🍣', zone: 'tyo', type: 'property', price: 280, rent: 95, desc: 'Neon lights, ramen bars & purikura photobooths.' },
    { id: 12, name: 'Akihabara', shortName: 'Akiba', icon: '🎮', zone: 'tyo', type: 'property', price: 300, rent: 100, desc: 'Arcades, anime towers & maid cafés.' },
    { id: 13, name: 'Shinjuku Golden Gai', shortName: 'Shinjuku', icon: '🏮', zone: 'tyo', type: 'property', price: 320, rent: 110, desc: 'Tiny lantern-lit bars hidden in neon alleys.' },
    { id: 14, name: 'Takeover Arena', shortName: 'ARENA', icon: '⚔️', zone: 'corner', type: 'arena', price: 0, rent: 0, desc: 'Free duel: win and buy any opponent tile (not hotels).' },
    { id: 15, name: 'Paris Eiffel Tower', shortName: 'Paris', icon: '🥐', zone: 'eu', type: 'property', price: 340, rent: 115, desc: 'Croissants, champagne & starry Seine walks.' },
    { id: 16, name: 'Santorini Caldera', shortName: 'Santorini', icon: '🏛️', zone: 'eu', type: 'property', price: 360, rent: 125, desc: 'White cliff villas over the azure Aegean.' },
    { id: 17, name: 'Winterfell Heart Tree', shortName: 'Winterfell', icon: '🐺', zone: 'got', type: 'property', price: 380, rent: 135, desc: 'Ancient weirwood in the snow where wolves rule.' },
    { id: 18, name: 'The Red Keep', shortName: 'Red Keep', icon: '👑', zone: 'got', type: 'property', price: 420, rent: 150, desc: 'The Iron Throne overlooking Blackwater Bay.' },
    { id: 19, name: 'Dragonstone Citadel', shortName: 'Dragonstone', icon: '🐉', zone: 'got', type: 'property', price: 450, rent: 165, desc: 'Volcanic cliffs where dragons dance.' }
  ];

  const TILE_GRID_POSITIONS = {
    0: { row: 1, col: 1 }, 1: { row: 1, col: 2 }, 2: { row: 1, col: 3 }, 3: { row: 1, col: 4 }, 4: { row: 1, col: 5 },
    5: { row: 2, col: 5 }, 6: { row: 3, col: 5 }, 7: { row: 4, col: 5 }, 8: { row: 5, col: 5 }, 9: { row: 6, col: 5 },
    10: { row: 7, col: 5 }, 11: { row: 7, col: 4 }, 12: { row: 7, col: 3 }, 13: { row: 7, col: 2 }, 14: { row: 7, col: 1 },
    15: { row: 6, col: 1 }, 16: { row: 5, col: 1 }, 17: { row: 4, col: 1 }, 18: { row: 3, col: 1 }, 19: { row: 2, col: 1 }
  };

  // =========================================================
  // 3. SABOTAGE ITEMS & CASINO TABLE
  // =========================================================
  const ITEMS = {
    golden_dice: { icon: '🎲', name: 'Golden Dice', price: 250, desc: 'Choose your exact roll (1–6) this turn.' },
    c4: { icon: '💣', name: 'C4', price: 500, desc: 'Blast an opponent building (🏠🏠 or 🏨) back to a single house. The only thing that can hit hotels.' },
    shield: { icon: '🛡️', name: 'Rent Shield', price: 300, desc: 'When rent is due, use it to pay nothing. Works on hotels too.' },
    magnet: { icon: '🧲', name: 'Magnet', price: 200, desc: 'Instantly siphon 25% of your opponent\'s current miles into your wallet.' },
    swap: { icon: '🌀', name: 'Swap Portal', price: 150, desc: 'Instantly swap board positions with your opponent.' }
  };
  const ITEM_IDS = Object.keys(ITEMS);

  const CASINO_TABLE = [
    { id: 'jackpot', p: 0.05, reels: ['💎', '💎', '💎'], label: 'JACKPOT! +1,000 🪙', miles: 1000 },
    { id: 'cherries', p: 0.15, reels: ['🍒', '🍒', '🍒'], label: 'Triple cherries! +300 🪙', miles: 300 },
    { id: 'item', p: 0.15, reels: ['🎒', '🎒', '🎒'], label: 'Free sabotage item! 🎒', item: true },
    { id: 'pair', p: 0.25, label: 'Two of a kind — bet back (+100 🪙)', miles: 100 },
    { id: 'skull', p: 0.10, reels: ['💀', '💀', '💀'], label: 'CURSED! Lose 200 🪙 more', miles: -200 },
    { id: 'nothing', p: 0.30, label: 'No luck this time…', miles: 0 }
  ];
  const SLOT_SYMBOLS = ['🍒', '🍋', '⭐', '🔔', '💎', '🎒', '💀'];

  // =========================================================
  // 4. PURE RULE FUNCTIONS (Accepts state explicitly)
  // =========================================================
  const otherRole = (r) => (r === 'bkk' ? 'dxb' : 'bkk');

  function d6(rng = Math.random) {
    return Math.floor(rng() * 6) + 1;
  }

  function upgradeCost(tile) {
    return Math.round(tile.price * MONO_CFG.UPGRADE_RATE);
  }

  function propValue(st, tileId) {
    const tile = MONOPOLY_TILES[tileId];
    const prop = st && st.properties ? st.properties[tileId] : null;
    if (!tile || !prop) return 0;
    return tile.price + (prop.level - 1) * upgradeCost(tile);
  }

  function ownedTileIds(st, role) {
    if (!st || !st.properties) return [];
    return Object.keys(st.properties)
      .filter((id) => st.properties[id] && st.properties[id].owner === role)
      .map(Number);
  }

  function zoneTiles(zone) {
    return MONOPOLY_TILES.filter((t) => t.type === 'property' && t.zone === zone);
  }

  function ownsZone(st, role, zone) {
    const tiles = zoneTiles(zone);
    return tiles.length > 0 && tiles.every((t) => st && st.properties && st.properties[t.id] && st.properties[t.id].owner === role);
  }

  function finalBoardingStage(round = 1) {
    let stage = null;
    for (const s of MONO_CFG.FINAL_BOARDING_STAGES) if (round >= s.round) stage = s;
    return stage;
  }

  function finalBoardingMult(st) {
    const round = st && st.round ? st.round : 1;
    const s = finalBoardingStage(round);
    return s ? s.mult : 1;
  }

  function isFinalBoarding(st) {
    const round = st && st.round ? st.round : 1;
    return !!finalBoardingStage(round);
  }

  function getTileRent(st, tileId, levelOverride) {
    const tile = MONOPOLY_TILES[tileId];
    if (!tile || tile.type !== 'property') return 0;
    const prop = st && st.properties ? st.properties[tileId] : null;
    const level = levelOverride || (prop ? prop.level : 1);
    let rent = tile.rent * (MONO_CFG.RENT_MULT[level] || 1);
    if (prop && ownsZone(st, prop.owner, tile.zone)) rent *= MONO_CFG.ZONE_MULT;
    rent *= finalBoardingMult(st);
    return Math.round(rent);
  }

  function netWorth(st, role) {
    if (!st || !st.players || !st.players[role]) return 0;
    return st.players[role].miles + ownedTileIds(st, role).reduce((sum, id) => sum + propValue(st, id), 0);
  }

  /**
   * Pure calculation of liquidation & bankruptcy without mutating state.
   */
  function calculateCharge(st, payerKey, amount) {
    const payer = st.players[payerKey];
    const due = Math.round(amount);
    let miles = payer.miles;
    const props = { ...st.properties };
    const sold = [];
    const soldIds = [];
    while (miles < due) {
      const mine = Object.keys(props)
        .filter((id) => props[id] && props[id].owner === payerKey)
        .map(Number)
        .sort((a, b) => propValue({ properties: props }, a) - propValue({ properties: props }, b));
      if (!mine.length) break;
      const id = mine[0];
      miles += Math.round(propValue({ properties: props }, id) * MONO_CFG.LIQUIDATION_RATE);
      delete props[id];
      sold.push(MONOPOLY_TILES[id].shortName);
      soldIds.push(id);
    }
    const paid = Math.max(0, Math.min(miles, due));
    const bankrupt = paid < due;
    return { due, paid, sold, soldIds, bankrupt, remainingMiles: miles - paid };
  }

  /**
   * Mutates state in place (pure JS, no DOM or FX). Used in simulator and bot tests.
   */
  function applyCharge(st, payerKey, amount, receiverKey) {
    const payer = st.players[payerKey];
    const due = Math.round(amount);
    const sold = [];
    const soldIds = [];
    while (payer.miles < due) {
      const mine = ownedTileIds(st, payerKey).sort((a, b) => propValue(st, a) - propValue(st, b));
      if (!mine.length) break;
      const id = mine[0];
      payer.miles += Math.round(propValue(st, id) * MONO_CFG.LIQUIDATION_RATE);
      delete st.properties[id];
      sold.push(MONOPOLY_TILES[id].shortName);
      soldIds.push(id);
    }
    const paid = Math.max(0, Math.min(payer.miles, due));
    payer.miles -= paid;
    if (receiverKey && st.players[receiverKey]) st.players[receiverKey].miles += paid;
    const bankrupt = paid < due;
    return { due, paid, sold, soldIds, bankrupt };
  }

  function marketPrice(st, role, itemId) {
    const base = ITEMS[itemId].price;
    const pk = (st && st.perks && st.perks[role]) || {};
    const used = st && st.perkUsed && st.perkUsed[role] && st.perkUsed[role].market;
    return pk.marketDiscount && !used ? Math.round(base * (1 - pk.marketDiscount)) : base;
  }

  return {
    MONO_CFG,
    ZONES,
    MONOPOLY_TILES,
    TILE_GRID_POSITIONS,
    ITEMS,
    ITEM_IDS,
    CASINO_TABLE,
    SLOT_SYMBOLS,
    otherRole,
    d6,
    upgradeCost,
    propValue,
    ownedTileIds,
    zoneTiles,
    ownsZone,
    finalBoardingStage,
    finalBoardingMult,
    isFinalBoarding,
    getTileRent,
    netWorth,
    calculateCharge,
    applyCharge,
    marketPrice
  };
});
