// tests/moon_defense.test.js — Comprehensive unit tests for Moon Defense rules & authoritative server adapter
// (Warcraft 3 Island Defense / Titan Hunt Co-Op Survival on 28x28 Forest Grid).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  moonDefenseMods,
  defenderModsFromProfile,
  MD_GRID,
  MD_COVES,
  MD_COVE_ORDER,
  getCoveBySeat,
  gridToWorld,
  worldToGrid,
  getTileInfo,
  canPlaceBuilding,
  isTileWalkable,
  isWorldPosWalkable,
  clampWorldPosWalkable,
  MD_RESOURCE_SPOTS,
  MD_ELEMENTS,
  MD_BUILDINGS,
  MD_FUSIONS,
  resolveTowerFusion,
  MD_HERO_SKILLS,
  MD_MAX_WAVES,
  getWaveConfig,
  MD_WAVES,
  MD_CHARMS,
  rollCharmDrop,
  upsertCharmToProfile,
} from '../shared/moon_defense_rules.js';

import { createMoonDefenseAdapter } from '../server/moon_defense_service.js';

describe('1. External Compatibility Exports', () => {
  it('moonDefenseMods returns valid combat and economy modifiers', () => {
    const mods = moonDefenseMods(
      { fortune: 120, swiftness: 80, power: 150, luck: 60 },
      { petFamily: 'fortune', petPct: 0.15 }
    );

    assert.equal(typeof mods.startCoins, 'number');
    assert.ok(mods.startCoins > 100);
    assert.ok(mods.coinMult > 1);
    assert.ok(mods.podiumMult > 1);
    assert.ok(mods.atkSpeedMult > 1);
    assert.ok(mods.moveSpeedMult > 1);
    assert.ok(mods.dashCdMult > 0 && mods.dashCdMult < 1);
    assert.ok(mods.dmgMult > 1);
    assert.ok(mods.ultChargeMult > 1);
    assert.ok(mods.critChance > 0.05 && mods.critChance <= 0.55);
    assert.equal(mods.critMult, 1.75);
    assert.ok(mods.mercLuckPct > 0);
    assert.equal(mods.petFamily, 'fortune');
    assert.equal(mods.petPct, 0.15);
  });

  it('defenderModsFromProfile computes modifiers from a mock player profile', () => {
    const mockProfile = {
      id: 'u_test_1',
      level: 12,
      equipped: {
        outfit: { id: 's11_zeus_olympus', refine: 3 },
        pet: { id: 'pet_kitsune', stars: 3 },
      },
      pets: [{ id: 'pet_kitsune', stars: 3, level: 5 }],
    };

    const res = defenderModsFromProfile(mockProfile);
    assert.equal(res.outfitId, 's11_zeus_olympus');
    assert.equal(res.petId, 'pet_kitsune');
    assert.equal(res.petStars, 3);
    assert.ok(res.startCoins >= 100);
    assert.ok(res.dmgMult >= 1);
    assert.ok(res.stats && typeof res.stats.power === 'number');
  });
});

describe('2. 28x28 Island Defense Grid, Secluded Forest Coves & Center Diamond Motherlode', () => {
  it('gridToWorld and worldToGrid round-trip accurately across all 28x28 tiles', () => {
    assert.equal(MD_GRID.SIZE, 28);
    assert.equal(MD_GRID.CELL, 2.0);
    assert.equal(MD_GRID.HALF, 28.0);
    assert.equal(MD_COVE_ORDER.length, 4);

    for (let gx = 0; gx < 28; gx++) {
      for (let gz = 0; gz < 28; gz++) {
        const w = gridToWorld(gx, gz);
        const g = worldToGrid(w.x, w.z);
        assert.equal(g.gx, gx, `gx mismatch at (${gx},${gz})`);
        assert.equal(g.gz, gz, `gz mismatch at (${gx},${gz})`);
        assert.equal(g.key, `${gx},${gz}`);
        assert.equal(g.cx, w.x);
        assert.equal(g.cz, w.z);
      }
    }
  });

  it('getTileInfo identifies shrine, rift, cliff, vein, choke, cove, forest_wall, road, and plaza', () => {
    const seenKinds = new Set();
    for (let gx = 0; gx < 28; gx++) {
      for (let gz = 0; gz < 28; gz++) {
        const info = getTileInfo(gx, gz);
        seenKinds.add(info.kind);
      }
    }

    for (const expected of [
      'shrine',
      'rift',
      'cliff',
      'vein',
      'choke',
      'cove',
      'forest_wall',
      'road',
      'plaza',
    ]) {
      assert.ok(seenKinds.has(expected), `Expected tile kind '${expected}' on 28x28 grid`);
    }

    // Specific spot checks on 28x28 grid
    assert.equal(getTileInfo(13, 13).kind, 'shrine');
    assert.equal(getTileInfo(13, 13).buildable, false);
    assert.equal(getTileInfo(13, 0).kind, 'rift');
    assert.equal(getTileInfo(0, 0).kind, 'cliff');
    assert.equal(getTileInfo(2, 2).kind, 'vein');
    assert.equal(getTileInfo(2, 2).coveId, 'nw');
    assert.equal(getTileInfo(8, 4).kind, 'choke');
    assert.equal(getTileInfo(8, 5).kind, 'choke');
    assert.equal(getTileInfo(8, 3).kind, 'forest_wall');
    assert.equal(getTileInfo(8, 8).kind, 'forest_wall');
    assert.equal(getTileInfo(4, 4).kind, 'cove');
    assert.equal(getTileInfo(13, 6).kind, 'road');
    assert.equal(getTileInfo(13, 6).buildable, false);
    assert.equal(getTileInfo(10, 8).kind, 'plaza');
    assert.equal(getTileInfo(10, 8).buildable, false);
    assert.equal(getTileInfo(-1, 5).kind, 'void');
    assert.equal(getCoveBySeat(0).id, 'nw');
    assert.equal(getCoveBySeat(3).id, 'se');
  });

  it('canPlaceBuilding enforces tile rules for mine, diamond_drill, wall, totem, ward, and towers', () => {
    // Mine allowed on vein and cove, rejected on road/plaza
    assert.equal(canPlaceBuilding(2, 2, 'mine', {}).ok, true);
    assert.equal(canPlaceBuilding(4, 4, 'mine', {}).ok, true);
    assert.equal(canPlaceBuilding(10, 8, 'mine', {}).ok, false);
    assert.equal(canPlaceBuilding(13, 6, 'mine', {}).ok, false);

    // Diamond Drill allowed on vein, cove, and center shrine (13..14, 13..14), rejected on road/plaza
    assert.equal(canPlaceBuilding(2, 2, 'diamond_drill', {}).ok, true);
    assert.equal(canPlaceBuilding(4, 4, 'diamond_drill', {}).ok, true);
    assert.equal(canPlaceBuilding(13, 13, 'diamond_drill', {}).ok, true);
    assert.equal(canPlaceBuilding(10, 8, 'diamond_drill', {}).ok, false);

    // Vision Ward allowed anywhere walkable (cove, choke, road, plaza), rejected on forest_wall/cliff
    assert.equal(canPlaceBuilding(4, 4, 'ward', {}).ok, true);
    assert.equal(canPlaceBuilding(8, 4, 'ward', {}).ok, true);
    assert.equal(canPlaceBuilding(13, 6, 'ward', {}).ok, true);
    assert.equal(canPlaceBuilding(10, 8, 'ward', {}).ok, true);
    assert.equal(canPlaceBuilding(8, 3, 'ward', {}).ok, false);
    assert.equal(canPlaceBuilding(0, 0, 'ward', {}).ok, false);

    // Wall allowed on choke and cove, rejected on forest trails/wilds outside coves
    assert.equal(canPlaceBuilding(8, 4, 'wall', {}).ok, true);
    assert.equal(canPlaceBuilding(7, 4, 'wall', {}).ok, true);
    assert.equal(canPlaceBuilding(13, 6, 'wall', {}).ok, false);

    // Towers allowed inside cove and choke, rejected on vein and outside wilds/trails
    assert.equal(canPlaceBuilding(4, 4, 'tower_storm', {}).ok, true);
    assert.equal(canPlaceBuilding(8, 4, 'tower_fire', {}).ok, true);
    assert.equal(canPlaceBuilding(10, 8, 'tower_fire', {}).ok, false);
    assert.equal(canPlaceBuilding(2, 2, 'tower_water', {}).ok, false);
    assert.equal(canPlaceBuilding(13, 6, 'tower_light', {}).ok, false);

    // Unbuildable tiles rejected for normal buildings
    assert.equal(canPlaceBuilding(13, 13, 'tower_storm', {}).ok, false);
    assert.equal(canPlaceBuilding(0, 0, 'wall', {}).ok, false);
    assert.equal(canPlaceBuilding(13, 0, 'wall', {}).ok, false);

    // Occupied tile rejected
    const occupied = { '4,4': { id: 'b_1', gx: 4, gz: 4 } };
    const occRes = canPlaceBuilding(4, 4, 'tower_storm', occupied);
    assert.equal(occRes.ok, false);
    assert.match(occRes.error, /occupied/i);
  });
});

describe('3. Element TD Tower Fusions', () => {
  it('Single element returns Tier 1 Spire', () => {
    for (const el of Object.keys(MD_ELEMENTS)) {
      const f = resolveTowerFusion([el]);
      assert.equal(f.tier, 1);
      assert.deepEqual(f.elements, [el]);
      assert.equal(f.dmgMult, 1.0);
      assert.ok(f.outfit);
      assert.ok(f.dmg > 0);
    }
  });

  it('All 15 Dual element pairs return Tier 2 Mythic Costume Guardian with dmgMult >= 2.0 and combined specials', () => {
    const elKeys = Object.keys(MD_ELEMENTS);
    assert.equal(elKeys.length, 6);
    assert.equal(Object.keys(MD_FUSIONS).length, 15);

    let pairCount = 0;
    for (let i = 0; i < elKeys.length; i++) {
      for (let j = i + 1; j < elKeys.length; j++) {
        pairCount++;
        const a = elKeys[i];
        const b = elKeys[j];
        const fused = resolveTowerFusion([a, b]);
        assert.equal(fused.tier, 2);
        assert.ok(fused.dmgMult >= 2.0, `Expected dmgMult >= 2.0 for ${a}+${b}`);
        assert.ok(fused.outfit, `Expected mythic costume outfit for ${a}+${b}`);
        assert.ok(fused.rangeBonus > 0);
      }
    }
    assert.equal(pairCount, 15);

    // Verify combined specials for fire + water (splash + slow)
    const fw = resolveTowerFusion(['fire', 'water']);
    assert.equal(fw.name, 'Naga Sovereign');
    assert.ok(fw.special.splash > 0);
    assert.ok(fw.special.slow > 0);
  });

  it('3 elements return Tier 3 Trinity Sovereign Guardian (sm_starlight_ribbon)', () => {
    const tri = resolveTowerFusion(['storm', 'fire', 'light']);
    assert.equal(tri.tier, 3);
    assert.equal(tri.name, 'Trinity Sovereign Guardian');
    assert.equal(tri.outfit, 'sm_starlight_ribbon');
    assert.ok(tri.dmgMult >= 3.0);
    assert.ok(tri.special.chain > 0);
    assert.ok(tri.special.splash > 0);
    assert.ok(tri.special.critBonus > 0);
  });
});

describe('4. Waves & Charms', () => {
  it('Waves 5, 10, 15, 20 are Boss waves and non-multiples of 5 are normal waves', () => {
    assert.equal(MD_MAX_WAVES, 20);
    assert.equal(MD_WAVES.length, 20);

    for (let w = 1; w <= 20; w++) {
      const cfg = getWaveConfig(w);
      assert.equal(cfg.wave, w);
      if (w % 5 === 0) {
        assert.equal(cfg.isBoss, true, `Wave ${w} should be a boss wave`);
        assert.ok(cfg.bossHp > cfg.hp);
        assert.ok(cfg.bossName);
      } else {
        assert.equal(cfg.isBoss, false, `Wave ${w} should not be a boss wave`);
        assert.equal(cfg.bossHp, 0);
      }
    }
  });

  it('rollCharmDrop returns valid charm and upsertCharmToProfile equips and upgrades it', () => {
    assert.equal(MD_CHARMS.length, 16);

    const charm = rollCharmDrop(20, () => 0.1);
    assert.ok(charm.id);
    assert.ok(charm.name);
    assert.equal(charm.grade, 'SS');
    assert.ok(charm.bonus > 0);
    assert.ok(charm.stats[charm.stat] === charm.bonus);

    const prof = { id: 'u_charm', charms: [], equipped: {} };
    const inserted = upsertCharmToProfile(prof, charm);
    assert.ok(inserted);
    assert.equal(prof.charms.length, 1);
    assert.equal(prof.equipped_charm.id, charm.id);
    assert.equal(prof.equipped.charm.id, charm.id);
    assert.equal(prof.equipped.charm.plus, 0);

    // Duplicate drop upgrades plus level
    const upgraded = upsertCharmToProfile(prof, charm);
    assert.equal(prof.charms.length, 1);
    assert.equal(upgraded.plus, 1);
    assert.equal(upgraded.level, 2);
  });
});

describe('5. Server Adapter (Island Defense / Titan Hunt Co-Op Survival)', () => {
  it('starts with 0 buildings, no bot builders, 120s prep head-start, and supports Co-Op building, ward, diamond_drill, and Titan Hunt', () => {
    let clock = 100000;
    const sentMessages = [];
    const profiles = {
      u1: {
        id: 'u1',
        username: 'PlayerOne',
        level: 5,
        exp: 0,
        gold: 500,
        berries: 20,
        diamonds: 10,
        village: { buildings: [], tiles: [] },
        pets: [{ id: 'pet_ragdoll', stars: 2, level: 1, exp: 0 }],
        equipped: {
          outfit: { id: 's1_naga_sovereign', refine: 1 },
          pet: { id: 'pet_ragdoll', stars: 2 },
        },
      },
      u2: {
        id: 'u2',
        username: 'PlayerTwo',
        level: 6,
        exp: 0,
        gold: 400,
        berries: 15,
        diamonds: 5,
        village: { buildings: [], tiles: [] },
        pets: [{ id: 'pet_kitsune', stars: 2, level: 1, exp: 0 }],
        equipped: {
          outfit: { id: 's2_kitsune_inari', refine: 1 },
          pet: { id: 'pet_kitsune', stars: 2 },
        },
      },
    };

    const adapter = createMoonDefenseAdapter({
      db: {
        getProfile: (id) => profiles[id] || null,
        markProfile: () => {},
      },
      send: (uids, msg) => sentMessages.push({ uids, msg }),
      now: () => clock,
      rng: () => 0.25,
    });

    const table = {
      id: 'tbl_md_1',
      status: 'playing',
      seats: [
        { kind: 'human', userId: 'u1', name: 'PlayerOne' },
        { kind: 'human', userId: 'u2', name: 'PlayerTwo' },
        { kind: 'bot', name: 'UnusedBotThree' },
        { kind: 'bot', name: 'UnusedBotFour' },
      ],
      seatOf: { u1: 0, u2: 1 },
    };

    // 1. Start match: 0 starter buildings, only human seats active, 120s prep timer
    const startRes = adapter.start(table);
    assert.equal(startRes.ok, true);
    assert.ok(table.moonDefense);
    assert.equal(table.moonDefense.players.length, 4);
    assert.equal(table.moonDefense.players[0].active, true);
    assert.equal(table.moonDefense.players[1].active, true);
    assert.equal(table.moonDefense.players[2].active, false, 'Bot seats must be inactive');
    assert.equal(table.moonDefense.players[3].active, false, 'Bot seats must be inactive');
    assert.equal(Object.keys(table.moonDefense.buildings).length, 0, 'Must start with 0 buildings');
    assert.equal(table.moonDefense.prepEndsAt, clock + 120000, '120s head-start before Titan awakens');
    assert.ok(table.moonDefense.enemies.length >= 6, 'Roaming wild monsters spawned in the fog');
    assert.ok(sentMessages.some((m) => m.msg.type === 'mb_state'));

    const p0 = table.moonDefense.players[0];
    const p1 = table.moonDefense.players[1];
    assert.equal(p0.hp, 250);
    assert.ok(p0.gold >= 220);
    p0.gold = 800;
    p1.gold = 800;

    // 2. Build a tower in NW cove (4,4), a mine on NW vein (2,2), a Vision Ward in wilds (10,8), and a Diamond Drill on center shrine (13,13)
    const buildRes = adapter.handle(table, 'u1', {
      type: 'mb_build',
      gx: 4,
      gz: 4,
      kind: 'tower_storm',
    });
    assert.equal(buildRes.ok, true);
    assert.equal(buildRes.building.buildingId, 'tower_storm');
    assert.equal(buildRes.building.tier, 1);

    const mineRes = adapter.handle(table, 'u1', {
      type: 'mb_build',
      gx: 2,
      gz: 2,
      kind: 'mine',
    });
    assert.equal(mineRes.ok, true);
    assert.equal(mineRes.building.onVein, true);

    const wardRes = adapter.handle(table, 'u1', {
      type: 'mb_build',
      gx: 10,
      gz: 8,
      kind: 'ward',
    });
    assert.equal(wardRes.ok, true);
    assert.equal(wardRes.building.visionRadius, 16.0);

    const drillRes = adapter.handle(table, 'u1', {
      type: 'mb_build',
      gx: 13,
      gz: 13,
      kind: 'diamond_drill',
    });
    assert.equal(drillRes.ok, true);
    assert.equal(drillRes.building.buildingId, 'diamond_drill');

    // 3. True Co-Op: PlayerTwo (u2) upgrades PlayerOne's tower at (4,4)
    const upgRes = adapter.handle(table, 'u2', {
      type: 'mb_upgrade_building',
      gx: 4,
      gz: 4,
    });
    assert.equal(upgRes.ok, true);
    assert.equal(upgRes.building.level, 2);

    // 4. Fuse the tower with 'fire' -> Tier 2 Cyber Archon, then 'light' -> Tier 3 Trinity Sovereign Guardian
    const fuse1 = adapter.handle(table, 'u1', {
      type: 'mb_fuse_building',
      gx: 4,
      gz: 4,
      element: 'fire',
    });
    assert.equal(fuse1.ok, true);
    assert.equal(fuse1.building.tier, 2);
    assert.equal(fuse1.building.name, 'Cyber Archon');

    const fuse2 = adapter.handle(table, 'u2', {
      type: 'mb_fuse_building',
      gx: 4,
      gz: 4,
      element: 'light',
    });
    assert.equal(fuse2.ok, true);
    assert.equal(fuse2.building.tier, 3);
    assert.equal(fuse2.building.name, 'Trinity Sovereign Guardian');

    // 5. Sell the tower
    const goldBeforeSell = p0.gold;
    const sellRes = adapter.handle(table, 'u1', {
      type: 'mb_sell_building',
      gx: 4,
      gz: 4,
    });
    assert.equal(sellRes.ok, true);
    assert.ok(sellRes.refund > 0);
    assert.equal(p0.gold, goldBeforeSell + sellRes.refund);
    assert.equal(table.moonDefense.buildings['4,4'], undefined);

    // 6. Awaken the Titan early (+40 Gold bonus)
    const goldBeforeAwaken = p0.gold;
    const startWaveRes = adapter.handle(table, 'u1', { type: 'mb_start_wave' });
    assert.equal(startWaveRes.ok, true);
    assert.equal(table.moonDefense.phase, 'combat');
    assert.equal(p0.gold, goldBeforeAwaken + 40);
    assert.ok(table.moonDefense.titan, 'Titan must awaken at (0,0)');
    assert.equal(table.moonDefense.titan.isTitan, true);
    assert.equal(table.moonDefense.titan.aiState, 'prowl_fog');

    // Tick to advance Titan prowling in the fog
    clock += 1000;
    adapter.tick(table, clock);
    assert.ok(table.moonDefense.enemies.some((e) => e.isTitan));

    // 7. Move hero
    const moveRes = adapter.handle(table, 'u1', {
      type: 'mb_move',
      x: -4.5,
      z: -4.5,
      vx: 1,
      vz: 1,
      right: true,
      back: false,
    });
    assert.equal(moveRes.ok, true);
    assert.equal(p0.x, -4.5);
    assert.equal(p0.z, -4.5);

    // 8. Dash hero
    const dashRes = adapter.handle(table, 'u1', {
      type: 'mb_dash',
      x: 0,
      z: 0,
    });
    assert.equal(dashRes.ok, true);
    assert.ok(p0.dashCdUntil > clock);

    // 9. Ult hero
    p0.ultCharge = 100;
    table.moonDefense.shrineHp = 800;
    const ultRes = adapter.handle(table, 'u1', { type: 'mb_ult' });
    assert.equal(ultRes.ok, true);
    assert.equal(p0.ultCharge, 0);
    assert.equal(table.moonDefense.shrineHp, 950);

    // 10. Pick hero auto-skill
    const skillRes = adapter.handle(table, 'u1', {
      type: 'mb_pick_skill',
      skillId: 'chain_bolt',
    });
    assert.equal(skillRes.ok, true);
    assert.equal(skillRes.skillId, 'chain_bolt');
    assert.equal(p0.skills.chain_bolt, 1);
    assert.ok(MD_HERO_SKILLS.chain_bolt);

    // 11. Cash out match
    const cashOutRes = adapter.handle(table, 'u1', { type: 'mb_cash_out' });
    assert.equal(cashOutRes.ok, true);
    assert.equal(table.moonDefense.status, 'ended');
    assert.equal(table.moonDefense.result.reason, 'cash_out');
    assert.ok(table.moonDefense.result.rewards.u1.gold > 0);
    assert.ok(profiles.u1.gold > 500);
  });

  it('supports 28x28 forest_wall choke, Center Precious Diamond Motherlode mining, Totem healing, and Non-Deterministic Titan AI states & slaying', () => {
    // 1. Forest wall enclosing NW cove is unbuildable & unwalkable, while 2-tile Choke Pass (8,4)-(8,5) is walkable & buildable
    assert.equal(getTileInfo(8, 3).kind, 'forest_wall');
    assert.equal(isTileWalkable(8, 3), false);
    assert.equal(getTileInfo(8, 4).kind, 'choke');
    assert.equal(isTileWalkable(8, 4), true);

    const blockedWorld = gridToWorld(8, 3);
    assert.equal(isWorldPosWalkable(blockedWorld.x, blockedWorld.z), false);
    const clamped = clampWorldPosWalkable(-15.0, -17.0, blockedWorld.x, blockedWorld.z);
    assert.equal(isWorldPosWalkable(clamped.x, clamped.z), true);

    // 2. Center Precious Diamond Motherlode + 12 spread-out resource spots exist
    assert.ok(Array.isArray(MD_RESOURCE_SPOTS));
    assert.equal(MD_RESOURCE_SPOTS.length, 13);
    assert.equal(MD_RESOURCE_SPOTS[0].id, 'node_center_diamond');
    assert.equal(MD_RESOURCE_SPOTS[0].kind, 'diamond_motherlode');

    // 3. Server adapter spawns Diamond Motherlode, grants Diamonds on mine, heals via Totem, and runs Titan AI states
    let clock = 200000;
    const profiles = {
      u1: { id: 'u1', username: 'MinerHero', level: 5, diamonds: 10, charms: [], equipped: {} },
    };
    const adapter = createMoonDefenseAdapter({
      db: { getProfile: (id) => profiles[id], markProfile: () => {} },
      send: () => {},
      now: () => clock,
      rng: () => 0.2, // < 0.35 so diamond roll succeeds on strike
    });
    const table = {
      id: 'tbl_md_titan',
      status: 'playing',
      seats: [{ kind: 'human', userId: 'u1', name: 'MinerHero' }],
      seatOf: { u1: 0 },
    };
    adapter.start(table);
    const s = table.moonDefense;
    assert.equal(s.resourceNodes.length, 13, 'Expected all 13 resourceNodes on map');

    const p0 = s.players[0];
    p0.gold = 400;

    // Place a Gate Wall at NW choke (8,4) and a Heal Totem behind it at (7,4)
    const wallRes = adapter.handle(table, 'u1', { type: 'mb_build', gx: 8, gz: 4, kind: 'wall' });
    assert.equal(wallRes.ok, true);
    const totemRes = adapter.handle(table, 'u1', { type: 'mb_build', gx: 7, gz: 4, kind: 'totem' });
    assert.equal(totemRes.ok, true);

    // Damage the wall & hero and verify Totem heals both on tick
    const wallBld = s.buildings['8,4'];
    wallBld.hp = wallBld.maxHp - 100;
    p0.x = wallBld.x;
    p0.z = wallBld.z;
    p0.hp = 180;
    const wallHpBefore = wallBld.hp;
    clock += 1100;
    adapter.tick(table, clock);
    assert.ok(wallBld.hp > wallHpBefore, 'Heal Totem should heal nearby damaged Gate Wall');
    assert.ok(p0.hp > 180, 'Heal Totem should heal nearby damaged Hero');

    // Walk Hero to Center Precious Diamond Motherlode at (0,0) and mine it
    const diamondNode = s.resourceNodes.find((n) => n.kind === 'diamond_motherlode');
    assert.ok(diamondNode, 'Center Precious Diamond Motherlode must exist');
    p0.x = diamondNode.x;
    p0.z = diamondNode.z;
    const goldBeforeMine = p0.gold;
    const nodeHpBefore = diamondNode.hp;
    clock += 900;
    const mineRes = adapter.handle(table, 'u1', { type: 'mb_mine', nodeId: diamondNode.id });
    assert.equal(mineRes.ok, true);
    assert.ok(diamondNode.hp < nodeHpBefore, 'Mining strike should reduce Diamond Motherlode HP');
    assert.ok(p0.gold > goldBeforeMine, 'Mining strike should grant instant Gold');
    assert.ok(p0.diamondsMined >= 1, 'Mining Diamond Motherlode should extract Diamonds');

    // Awaken the Titan and verify Sight Discovery -> 'siege_cove', Tactical Retreat -> 'retreat_heal', and Slaying -> 'victory'
    adapter.handle(table, 'u1', { type: 'mb_awaken_titan' });
    const titan = s.titan;
    assert.ok(titan);
    assert.equal(titan.aiState, 'prowl_fog');

    // Move Titan within 9.5m sight radius of the NW Gate Wall (8,4)
    titan.x = wallBld.x + 4.0;
    titan.z = wallBld.z;
    clock += 500;
    adapter.tick(table, clock);
    assert.equal(titan.aiState, 'siege_cove', 'Titan should spot nearby Gate Wall and enter siege_cove');

    // Drop Titan HP below 32% and verify Tactical Retreat into the Fog
    titan.hp = Math.floor(titan.maxHp * 0.25);
    clock += 500;
    adapter.tick(table, clock);
    assert.equal(titan.aiState, 'retreat_heal', 'Titan below 32% HP should retreat into the fog to heal');

    // Slay the Titan and verify Victory + Boss Charm drop + Diamonds credited to profile
    titan.hp = 10;
    p0.x = titan.x;
    p0.z = titan.z;
    clock += 500;
    const slayRes = adapter.handle(table, 'u1', { type: 'mb_attack' });
    assert.equal(slayRes.ok, true);
    assert.equal(s.status, 'ended');
    assert.equal(s.result.reason, 'victory');
    assert.ok(p0.droppedCharms.length >= 1, 'Slaying the Titan drops a guaranteed Boss Charm');
    assert.ok(
      profiles.u1.diamonds >= 10 + 15 + p0.diamondsMined,
      'Profile diamonds must include victory reward + mined diamonds'
    );
  });
});
