// server/moon_defense_service.js — Authoritative Warcraft 3 Island Defense / Titan Hunt Co-Op Survival
// + 28x28 Forest Coves + Center Precious Diamond Motherlode + Mythic Costume Tower Fusions for Moon Defense (moon_bunny).

import {
  MD_GRID,
  MD_COVES,
  MD_COVE_ORDER,
  MD_WILD_VEINS,
  MD_RESOURCE_SPOTS,
  MD_ELEMENTS,
  MD_BUILDINGS,
  MD_HERO_SKILLS,
  MD_MAX_WAVES,
  gridToWorld,
  worldToGrid,
  getTileInfo,
  isWorldPosWalkable,
  clampWorldPosWalkable,
  canPlaceBuilding,
  resolveTowerFusion,
  getWaveConfig,
  defenderModsFromProfile,
  rollCharmDrop,
  upsertCharmToProfile,
} from '../shared/moon_defense_rules.js';
import { applyExp, expToNext } from '../shared/progression.js';
import { grantPetActivityExp } from './rpg_service.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distHypot = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

const BOT_OUTFITS = [
  's1_naga_sovereign',
  's11_zeus_olympus',
  's2_kitsune_inari',
  's8_glacial_elsa',
];
const BOT_PETS = ['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale'];
const BOT_NAMES = ['Luna Sentinel', 'Sol Guardian', 'Sakura Warden', 'Jade Keeper'];

const WILD_MONSTER_DEFS = [
  { kind: 'slime',    name: 'Forest Slime',        hp: 140, speed: 2.0,  dmg: 14, goldReward: 24, xpReward: 22 },
  { kind: 'imp',      name: 'Shadow Imp',          hp: 170, speed: 2.4,  dmg: 18, goldReward: 30, xpReward: 26 },
  { kind: 'golem',    name: 'Moss Crag Golem',     hp: 280, speed: 1.65, dmg: 24, goldReward: 38, xpReward: 35 },
  { kind: 'gold_pig', name: 'Golden Truffle Boar', hp: 220, speed: 2.2,  dmg: 12, goldReward: 45, xpReward: 40 },
];

const WILD_CLEARINGS = [
  { x: 0,   z: -12 },
  { x: 0,   z: 12  },
  { x: -12, z: 0   },
  { x: 12,  z: 0   },
  { x: -7,  z: -7  },
  { x: 7,   z: -7  },
  { x: -7,  z: 7   },
  { x: 7,   z: 7   },
  { x: -13, z: -5  },
  { x: 13,  z: -5  },
  { x: -13, z: 5   },
  { x: 13,  z: 5   },
  { x: -5,  z: -13 },
  { x: 5,   z: -13 },
  { x: -5,  z: 13  },
  { x: 5,   z: 13  },
];

const RETREAT_SPRINGS = [
  { x: 0,   z: -24 },
  { x: 0,   z: 24  },
  { x: -24, z: 0   },
  { x: 24,  z: 0   },
];

export function createMoonDefenseAdapter({
  db,
  send,
  humans,
  rng = Math.random,
  now = Date.now,
  pushProfile = () => {},
  onMatchFinished = () => {},
  onMvpCharmDrop = () => {},
  catalogs = {},
} = {}) {
  const getNow = () => (typeof now === 'function' ? now() : Date.now());
  const getHumans = (table) =>
    humans
      ? humans(table)
      : (table.seats || [])
          .filter((s) => s.kind === 'human' && s.userId)
          .map((s) => s.userId);

  const sendToTable = (table, msg) => {
    if (!send) return;
    const uids = getHumans(table);
    if (uids.length > 0) send(uids, msg);
  };

  let nextEntitySeq = 1;
  const uid = (prefix) => `${prefix}_${nextEntitySeq++}`;

  function createBuildingInstance({ gx, gz, kind, ownerSeat, tile }) {
    const def = MD_BUILDINGS[kind];
    if (!def) return null;
    const pos = gridToWorld(gx, gz);
    const base = {
      id: uid('b'),
      gx,
      gz,
      key: `${gx},${gz}`,
      x: pos.x,
      z: pos.z,
      kind: def.kind,
      buildingId: def.id,
      ownerSeat,
      coveId: tile?.coveId || null,
      name: def.name,
      icon: def.icon,
      level: 1,
      hp: def.hp,
      maxHp: def.hp,
      elements: [],
      outfit: def.outfit || null,
      dmg: def.dmg || 0,
      rate: def.rate || 0,
      range: def.range || def.visionRadius || 0,
      visionRadius: def.visionRadius || 0,
      color: def.color || '#60a5fa',
      special: null,
      thorns: def.thorns || 0,
      healPerSec: def.healPerSec || 0,
      goldPerSec: 0,
      diamondChancePerTick: def.diamondChancePerTick || 0,
      onVein: false,
      tier: 1,
      investedGold: def.cost,
      lastShotAt: 0,
      lastTargetId: null,
    };

    if (kind === 'mine' || kind === 'diamond_drill') {
      const onVein = tile?.kind === 'vein' || tile?.kind === 'shrine';
      base.onVein = onVein;
      base.goldPerSec = Math.round(def.goldPerSec * (onVein ? def.veinMult || 1.6 : 1));
    } else if (kind.startsWith('tower_')) {
      const fused = resolveTowerFusion([def.element]);
      base.elements = [...fused.elements];
      base.outfit = fused.outfit;
      base.name = fused.name;
      base.icon = fused.icon;
      base.dmg = fused.dmg;
      base.rate = fused.rate;
      base.range = fused.range;
      base.color = fused.color;
      base.special = fused.special;
      base.tier = fused.tier;
    }

    return base;
  }

  function createResourceNode(spot, wave = 1) {
    const w = Math.max(1, wave | 0);
    const maxHp = spot.hp || 100;
    return {
      id: uid('ch'),
      spotId: spot.id,
      x: spot.x,
      z: spot.z,
      hp: maxHp,
      maxHp,
      swingGold: (spot.swingGold || 18) + Math.floor(w * 1.5),
      swingDiamonds: spot.swingDiamonds || 0,
      gold: (spot.jackpotGold || 75) + w * 12,
      jackpotDiamonds: spot.jackpotDiamonds || 0,
      xp: (spot.xp || 45) + w * 8,
      kind: spot.kind || 'chest',
      name: spot.name || 'Starlight Gold Vein',
    };
  }

  function spawnSpreadOutNodes(s) {
    if (!Array.isArray(s.chests)) s.chests = [];
    for (const spot of MD_RESOURCE_SPOTS) {
      if (s.chests.length >= MD_RESOURCE_SPOTS.length) break;
      const exists = s.chests.some(
        (c) => c.hp > 0 && (c.spotId === spot.id || distHypot(c.x, c.z, spot.x, spot.z) < 1.8)
      );
      if (!exists) {
        s.chests.push(createResourceNode(spot, s.wave || 1));
      }
    }
    s.resourceNodes = s.chests;
  }

  function makeSeatPlayer(table, seatIdx, nowMs) {
    const seat = table.seats?.[seatIdx] || { kind: 'empty' };
    const coveKey = MD_COVE_ORDER[seatIdx] || 'nw';
    const cove = MD_COVES[coveKey];
    const isHuman = seat.kind === 'human' && Boolean(seat.userId);
    const active = isHuman;
    const prof = isHuman && db ? db.getProfile(seat.userId) : null;

    const fallbackProf = {
      level: seat.level || 5,
      equipped: {
        outfit: { id: seat.outfit || BOT_OUTFITS[seatIdx % BOT_OUTFITS.length], refine: 0 },
        pet: { id: BOT_PETS[seatIdx % BOT_PETS.length], stars: 1 },
      },
    };
    const mods = defenderModsFromProfile(prof || fallbackProf, catalogs);

    // Spawn near the Center Clearing (±2.5, ±2.5) facing assigned Cove
    const startX = Math.sign(cove.center.x) * 2.5;
    const startZ = Math.sign(cove.center.z) * 2.5;

    return {
      seat: seatIdx,
      id: isHuman ? seat.userId : `seat_${seatIdx}`,
      userId: isHuman ? seat.userId : null,
      name: prof?.username || prof?.name || seat.name || BOT_NAMES[seatIdx % BOT_NAMES.length],
      isBot: false,
      disconnected: false,
      active,
      coveId: cove.id,
      coveName: cove.name,
      coveColor: cove.color,
      lineage: prof?.lineage || seat.lineage || (seatIdx % 2 ? 'dxb' : 'bkk'),
      appearance: prof?.appearance || seat.appearance || null,
      equipped: prof?.equipped || fallbackProf.equipped,
      outfitId: mods.outfitId,
      petId: mods.petId,
      petStars: mods.petStars,
      mods,
      x: startX,
      z: startZ,
      vx: 0,
      vz: 0,
      right: cove.center.x > 0,
      back: cove.center.z < 0,
      hp: 250,
      maxHp: 250,
      gold: 220 + Math.max(0, (mods.startCoins || 100) - 100),
      diamondsMined: 0,
      level: 1,
      xp: 0,
      xpNext: 60,
      kills: 0,
      dmgDealt: 0,
      ultCharge: 40,
      dashCdUntil: 0,
      skills: { orbit_blades: 1 },
      pendingChoices: null,
      droppedCharms: [],
      lastHeroShotAt: nowMs,
      lastPetShotAt: nowMs,
      lastBladeAt: nowMs,
      lastChainAt: nowMs,
      lastNovaAt: nowMs,
      lastMeteorAt: nowMs,
      lastManualAttackAt: 0,
      lastMineSwingAt: 0,
    };
  }

  function serializeState(table) {
    const s = table.moonDefense;
    if (!s) return null;
    const serializedNodes = (s.chests || []).map((c) => ({
      id: c.id,
      spotId: c.spotId,
      x: +c.x.toFixed(2),
      z: +c.z.toFixed(2),
      hp: Math.round(c.hp),
      maxHp: c.maxHp,
      gold: c.gold,
      swingGold: c.swingGold || 18,
      swingDiamonds: c.swingDiamonds || 0,
      jackpotDiamonds: c.jackpotDiamonds || 0,
      xp: c.xp || 45,
      kind: c.kind,
      name: c.name || 'Starlight Gold Vein',
    }));
    return {
      status: s.status,
      phase: s.phase,
      wave: s.wave,
      maxWaves: s.maxWaves,
      waveTitle: s.waveTitle,
      isBossWave: s.isBossWave,
      prepEndsAt: s.prepEndsAt,
      speedMult: s.speedMult,
      shrineHp: Math.round(s.shrineHp),
      maxShrineHp: s.maxShrineHp,
      players: s.players.map((p) => ({
        seat: p.seat,
        id: p.id,
        userId: p.userId,
        name: p.name,
        isBot: p.isBot,
        active: p.active,
        coveId: p.coveId,
        coveName: p.coveName,
        coveColor: p.coveColor,
        lineage: p.lineage,
        appearance: p.appearance,
        equipped: p.equipped,
        outfitId: p.outfitId,
        petId: p.petId,
        petStars: p.petStars,
        x: +p.x.toFixed(2),
        z: +p.z.toFixed(2),
        vx: +p.vx.toFixed(2),
        vz: +p.vz.toFixed(2),
        right: p.right,
        back: p.back,
        hp: Math.round(p.hp ?? 250),
        maxHp: p.maxHp || 250,
        gold: Math.floor(p.gold),
        diamondsMined: p.diamondsMined || 0,
        incomePerSec: computePlayerIncome(s, p.seat),
        level: p.level,
        xp: Math.floor(p.xp),
        xpNext: p.xpNext,
        kills: p.kills,
        dmgDealt: Math.round(p.dmgDealt),
        ultCharge: Math.floor(p.ultCharge),
        dashCdUntil: p.dashCdUntil,
        skills: { ...p.skills },
        pendingChoices: p.pendingChoices,
        droppedCharms: p.droppedCharms,
      })),
      buildings: Object.fromEntries(
        Object.entries(s.buildings).map(([k, b]) => [
          k,
          {
            id: b.id,
            gx: b.gx,
            gz: b.gz,
            key: b.key,
            x: b.x,
            z: b.z,
            kind: b.kind,
            buildingId: b.buildingId,
            ownerSeat: b.ownerSeat,
            coveId: b.coveId,
            name: b.name,
            icon: b.icon,
            level: b.level,
            hp: Math.round(b.hp),
            maxHp: b.maxHp,
            elements: b.elements,
            outfit: b.outfit,
            dmg: b.dmg,
            rate: b.rate,
            range: b.range,
            visionRadius: b.visionRadius || 0,
            color: b.color,
            special: b.special,
            thorns: b.thorns,
            healPerSec: b.healPerSec || 0,
            goldPerSec: b.goldPerSec,
            diamondChancePerTick: b.diamondChancePerTick || 0,
            onVein: b.onVein,
            tier: b.tier,
            investedGold: b.investedGold,
            lastShotAt: b.lastShotAt,
            lastTargetId: b.lastTargetId,
          },
        ])
      ),
      enemies: s.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        name: e.name,
        isBoss: Boolean(e.isBoss),
        isTitan: Boolean(e.isTitan),
        isWild: Boolean(e.isWild),
        level: e.level || 1,
        aiState: e.aiState || 'wander',
        stealthed: Boolean(e.stealthed),
        x: +e.x.toFixed(2),
        z: +e.z.toFixed(2),
        vx: +e.vx.toFixed(2),
        vz: +e.vz.toFixed(2),
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        mana: Math.round(e.mana || 0),
        maxMana: e.maxMana || 100,
        speed: e.speed,
        slowed: s.lastTickAt < (e.slowUntil || 0),
        cursed: (e.curseMult || 1) > 1,
        poisoned: (e.poisonDmg || 0) > 0,
        attackingBuildingId: e.attackingBuildingId,
      })),
      titan: s.titan && s.titan.hp > 0
        ? {
            id: s.titan.id,
            name: s.titan.name,
            level: s.titan.level || 1,
            hp: Math.round(s.titan.hp),
            maxHp: s.titan.maxHp,
            mana: Math.round(s.titan.mana || 0),
            aiState: s.titan.aiState,
            stealthed: Boolean(s.titan.stealthed),
            x: +s.titan.x.toFixed(2),
            z: +s.titan.z.toFixed(2),
          }
        : null,
      chests: serializedNodes,
      resourceNodes: serializedNodes,
      gems: s.gems.map((g) => ({
        id: g.id,
        x: +g.x.toFixed(2),
        z: +g.z.toFixed(2),
        xp: g.xp,
        gold: g.gold,
      })),
      events: s.events.slice(-24),
      result: s.result || null,
    };
  }

  function broadcastState(table) {
    const pub = serializeState(table);
    if (!pub) return;
    sendToTable(table, {
      type: 'mb_state',
      tableId: table.id,
      state: pub,
      moonDefense: pub,
      ...pub,
    });
    if (table.moonDefense) {
      table.moonDefense.events = [];
    }
  }

  function computePlayerIncome(s, seatIdx) {
    let income = 3;
    for (const b of Object.values(s.buildings)) {
      if (b.ownerSeat === seatIdx && b.kind === 'mine' && b.hp > 0) {
        income += b.goldPerSec || 5;
      }
    }
    return income;
  }

  // ==========================================================================
  // WILD MONSTER CAMPS & NON-DETERMINISTIC REAL TITAN AI
  // ==========================================================================

  function spawnWildMonster(s, nowMs) {
    const tpl = WILD_MONSTER_DEFS[Math.floor(rng() * WILD_MONSTER_DEFS.length)] || WILD_MONSTER_DEFS[0];
    const clearing = WILD_CLEARINGS[Math.floor(rng() * WILD_CLEARINGS.length)] || WILD_CLEARINGS[0];
    const nextClearing = WILD_CLEARINGS[Math.floor(rng() * WILD_CLEARINGS.length)] || WILD_CLEARINGS[1];

    const jitterX = (rng() - 0.5) * 2.4;
    const jitterZ = (rng() - 0.5) * 2.4;
    const pos = clampWorldPosWalkable(clearing.x, clearing.z, clearing.x + jitterX, clearing.z + jitterZ);

    const monster = {
      id: uid('w'),
      kind: tpl.kind,
      name: tpl.name,
      isBoss: false,
      isTitan: false,
      isWild: true,
      level: 1,
      x: pos.x,
      z: pos.z,
      vx: 0,
      vz: 0,
      hp: tpl.hp,
      maxHp: tpl.hp,
      speed: tpl.speed,
      dmg: tpl.dmg,
      goldReward: tpl.goldReward,
      xpReward: tpl.xpReward,
      aiState: 'wander',
      waypointX: nextClearing.x,
      waypointZ: nextClearing.z,
      nextWanderAt: (nowMs || getNow()) + 5000 + Math.floor(rng() * 4000),
      slowUntil: 0,
      slowPct: 0,
      curseMult: 1.0,
      poisonDmg: 0,
      attackingBuildingId: null,
    };
    s.enemies.push(monster);
    return monster;
  }

  function pickTitanProwlWaypoint(s, titan, nowMs) {
    if (
      s.lastNoisePing &&
      nowMs - (s.lastNoisePing.at || 0) < 15000 &&
      distHypot(titan.x, titan.z, s.lastNoisePing.x, s.lastNoisePing.z) > 4.0 &&
      rng() < 0.65
    ) {
      titan.waypointX = s.lastNoisePing.x;
      titan.waypointZ = s.lastNoisePing.z;
      return;
    }

    const candidates = [
      { x: 0, z: 0 }, // Center Diamond Quarry
      ...WILD_CLEARINGS,
    ];
    for (const cove of Object.values(MD_COVES)) {
      if (cove.choke?.[0]) {
        const cp = gridToWorld(cove.choke[0][0], cove.choke[0][1]);
        candidates.push({ x: cp.x, z: cp.z, coveId: cove.id });
      }
    }

    const farCandidates = candidates.filter((c) => distHypot(titan.x, titan.z, c.x, c.z) > 6.0);
    const pool = farCandidates.length > 0 ? farCandidates : candidates;
    const pick = pool[Math.floor(rng() * pool.length)] || { x: 0, z: -12 };
    titan.waypointX = pick.x;
    titan.waypointZ = pick.z;
    titan.targetCoveId = pick.coveId || null;
  }

  function awakenTitan(s, nowMs) {
    s.phase = 'combat';
    s.isBossWave = true;
    s.waveTitle = 'TITAN HUNT: Abyssal Eclipse Titan';

    if (!s.titan || s.titan.hp <= 0) {
      const titan = {
        id: uid('titan'),
        kind: 'boss_mochi',
        name: 'Abyssal Eclipse Titan',
        isBoss: true,
        isTitan: true,
        isWild: false,
        level: 1,
        hp: 3200,
        maxHp: 3200,
        mana: 100,
        maxMana: 100,
        speed: 3.1,
        dmg: 52,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        aiState: 'prowl_fog',
        stealthed: false,
        stealthUntil: 0,
        nextWindwalkAt: nowMs + 20000 + Math.floor(rng() * 10000),
        nextSkillAt: nowMs + 9000 + Math.floor(rng() * 5000),
        lastLevelUpAt: nowMs,
        lastRetreatAt: -99999,
        retreatUntil: 0,
        waypointX: 0,
        waypointZ: -12,
        targetCoveId: null,
        targetHeroSeat: null,
        attackingBuildingId: null,
        slowUntil: 0,
        slowPct: 0,
        curseMult: 1.0,
        poisonDmg: 0,
      };
      pickTitanProwlWaypoint(s, titan, nowMs);
      s.titan = titan;
      s.enemies.push(titan);
    }

    s.events.push({
      id: uid('ev'),
      kind: 'boss_alert',
      wave: s.wave,
      title: s.waveTitle,
      bossName: s.titan.name,
      x: s.titan.x,
      z: s.titan.z,
    });
  }

  function stepWildMonsterAI(s, e, dt, nowMs, cfg) {
    const buildingsList = Object.values(s.buildings);
    let blockingB = null;
    let bestBDist = 1.65;
    for (const b of buildingsList) {
      if (b.hp <= 0) continue;
      const d = distHypot(e.x, e.z, b.x, b.z);
      if (d <= bestBDist) {
        bestBDist = d;
        blockingB = b;
      }
    }

    if (blockingB) {
      e.attackingBuildingId = blockingB.id;
      e.vx = 0;
      e.vz = 0;
      blockingB.hp -= e.dmg * dt;
      if (blockingB.thorns > 0) {
        const owner = s.players[blockingB.ownerSeat];
        damageEnemy(s, e, blockingB.thorns * dt, owner, cfg);
      }
      if (blockingB.hp <= 0) {
        delete s.buildings[blockingB.key];
        s.events.push({
          id: uid('ev'),
          kind: 'building_destroyed',
          gx: blockingB.gx,
          gz: blockingB.gz,
        });
      }
      return;
    }

    e.attackingBuildingId = null;

    // Aggro onto nearby Heroes within 6.5m
    let targetHero = null;
    let bestHeroD = 6.5;
    for (const p of s.players) {
      if (!p.active || p.hp <= 0) continue;
      const d = distHypot(e.x, e.z, p.x, p.z);
      if (d <= bestHeroD) {
        bestHeroD = d;
        targetHero = p;
      }
    }

    let goalX = e.waypointX ?? 0;
    let goalZ = e.waypointZ ?? 0;
    let moveMult = 0.8;

    if (targetHero) {
      e.aiState = 'chase_hero';
      goalX = targetHero.x;
      goalZ = targetHero.z;
      moveMult = 1.0;
      if (bestHeroD <= 1.6) {
        e.vx = 0;
        e.vz = 0;
        targetHero.hp = Math.max(0, (targetHero.hp ?? 250) - e.dmg * 0.65 * dt);
        return;
      }
    } else {
      e.aiState = 'wander';
      if (
        distHypot(e.x, e.z, goalX, goalZ) <= 1.5 ||
        nowMs >= (e.nextWanderAt || 0)
      ) {
        const nextClearing =
          WILD_CLEARINGS[Math.floor(rng() * WILD_CLEARINGS.length)] || WILD_CLEARINGS[0];
        e.waypointX = nextClearing.x + (rng() - 0.5) * 2.0;
        e.waypointZ = nextClearing.z + (rng() - 0.5) * 2.0;
        e.nextWanderAt = nowMs + 5000 + Math.floor(rng() * 4000);
        goalX = e.waypointX;
        goalZ = e.waypointZ;
      }
    }

    const dx = goalX - e.x;
    const dz = goalZ - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const isSlowed = nowMs < (e.slowUntil || 0);
    const effSpeed = e.speed * moveMult * (isSlowed ? 1 - (e.slowPct || 0.35) : 1);
    e.vx = (dx / d) * effSpeed;
    e.vz = (dz / d) * effSpeed;
    const nextPos = clampWorldPosWalkable(e.x, e.z, e.x + e.vx * dt, e.z + e.vz * dt);
    e.x = nextPos.x;
    e.z = nextPos.z;
  }

  function stepTitanAI(s, titan, dt, nowMs, cfg) {
    if (!titan || titan.hp <= 0) return;

    const buildingsList = Object.values(s.buildings);
    const livingHeroes = s.players.filter((p) => p.active && (p.hp ?? 250) > 0);

    // Vision Ward detection (reveals stealth within 16m)
    for (const b of buildingsList) {
      if (b.kind === 'ward' && b.hp > 0) {
        const wardRange = b.visionRadius || b.range || 16.0;
        if (distHypot(titan.x, titan.z, b.x, b.z) <= wardRange) {
          titan.stealthed = false;
        }
      }
    }

    // Titan Leveling every 20s of active hunting (+12% DMG & MaxHP)
    if (
      nowMs - (titan.lastLevelUpAt || 0) >= 20000 / (s.speedMult || 1) &&
      (titan.level || 1) < 10
    ) {
      titan.lastLevelUpAt = nowMs;
      titan.level = (titan.level || 1) + 1;
      titan.dmg = Math.round(titan.dmg * 1.12);
      const oldMax = titan.maxHp;
      titan.maxHp = Math.round(titan.maxHp * 1.12);
      titan.hp = Math.min(titan.maxHp, titan.hp + (titan.maxHp - oldMax));
      s.events.push({
        id: uid('ev'),
        kind: 'titan_level',
        level: titan.level,
        x: titan.x,
        z: titan.z,
      });
    }

    // State 4 Trigger: Tactical Retreat into the Fog if HP < 32%
    if (
      titan.hp / titan.maxHp < 0.32 &&
      titan.aiState !== 'retreat_heal' &&
      nowMs - (titan.lastRetreatAt || -99999) >= 35000
    ) {
      titan.aiState = 'retreat_heal';
      titan.lastRetreatAt = nowMs;
      titan.retreatUntil = nowMs + 7000;
      titan.stealthed = false;
      titan.attackingBuildingId = null;

      let farthestSpring = RETREAT_SPRINGS[0];
      let maxD = -1;
      for (const sp of RETREAT_SPRINGS) {
        const d = distHypot(titan.x, titan.z, sp.x, sp.z);
        if (d > maxD) {
          maxD = d;
          farthestSpring = sp;
        }
      }
      titan.waypointX = farthestSpring.x;
      titan.waypointZ = farthestSpring.z;
      s.events.push({
        id: uid('ev'),
        kind: 'titan_retreat',
        x: titan.x,
        z: titan.z,
      });
    }

    // State 4 Execution: 'retreat_heal'
    if (titan.aiState === 'retreat_heal') {
      titan.hp = Math.min(titan.maxHp, titan.hp + 65 * dt);
      if (nowMs >= titan.retreatUntil) {
        if ((titan.level || 1) < 10) {
          titan.level = (titan.level || 1) + 1;
          titan.dmg = Math.round(titan.dmg * 1.12);
          titan.maxHp = Math.round(titan.maxHp * 1.12);
        }
        titan.aiState = 'prowl_fog';
        pickTitanProwlWaypoint(s, titan, nowMs);
        return;
      }
      const dx = titan.waypointX - titan.x;
      const dz = titan.waypointZ - titan.z;
      const d = Math.hypot(dx, dz) || 1;
      const spd = titan.speed * 1.35;
      titan.vx = (dx / d) * spd;
      titan.vz = (dz / d) * spd;
      const nextPos = clampWorldPosWalkable(
        titan.x,
        titan.z,
        titan.x + titan.vx * dt,
        titan.z + titan.vz * dt
      );
      titan.x = nextPos.x;
      titan.z = nextPos.z;
      return;
    }

    // Sight Radius Discovery (9.5m) for 'prowl_fog' & 'windwalk_ambush'
    let spottedBuilding = null;
    let bestBuildD = 9.5;
    for (const b of buildingsList) {
      if (b.hp <= 0) continue;
      const d = distHypot(titan.x, titan.z, b.x, b.z);
      if (d <= bestBuildD) {
        bestBuildD = d;
        spottedBuilding = b;
      }
    }

    let spottedHero = null;
    let bestHeroD = 9.5;
    for (const p of livingHeroes) {
      const d = distHypot(titan.x, titan.z, p.x, p.z);
      if (d <= bestHeroD) {
        bestHeroD = d;
        spottedHero = p;
      }
    }

    if (
      (titan.aiState === 'prowl_fog' || titan.aiState === 'windwalk_ambush') &&
      (spottedBuilding || spottedHero)
    ) {
      titan.stealthed = false;
      titan.aiState = spottedBuilding ? 'siege_cove' : 'hunt_hero';
      s.events.push({
        id: uid('ev'),
        kind: 'titan_spotted',
        x: titan.x,
        z: titan.z,
        aiState: titan.aiState,
      });
    }

    // State 2 Trigger: 'windwalk_ambush' every 20-30s
    if (titan.aiState === 'prowl_fog' && nowMs >= (titan.nextWindwalkAt || 0)) {
      titan.aiState = 'windwalk_ambush';
      titan.stealthed = true;
      titan.stealthUntil = nowMs + 5500;
      titan.nextWindwalkAt = nowMs + 20000 + Math.floor(rng() * 10000);
      pickTitanProwlWaypoint(s, titan, nowMs);
      s.events.push({
        id: uid('ev'),
        kind: 'titan_windwalk',
        x: titan.x,
        z: titan.z,
      });
    }

    // State 1 & 2 Movement: 'prowl_fog' / 'windwalk_ambush'
    if (titan.aiState === 'prowl_fog' || titan.aiState === 'windwalk_ambush') {
      if (titan.aiState === 'windwalk_ambush' && nowMs >= titan.stealthUntil) {
        titan.stealthed = false;
        titan.aiState = 'prowl_fog';
      }
      if (distHypot(titan.x, titan.z, titan.waypointX, titan.waypointZ) <= 1.8) {
        pickTitanProwlWaypoint(s, titan, nowMs);
      }
      const dx = titan.waypointX - titan.x;
      const dz = titan.waypointZ - titan.z;
      const d = Math.hypot(dx, dz) || 1;
      const isSlowed = nowMs < (titan.slowUntil || 0);
      const stealthMult = titan.aiState === 'windwalk_ambush' ? 1.45 : 1.0;
      const effSpeed =
        titan.speed * stealthMult * (isSlowed ? 1 - (titan.slowPct || 0.35) : 1);
      titan.vx = (dx / d) * effSpeed;
      titan.vz = (dz / d) * effSpeed;
      const nextPos = clampWorldPosWalkable(
        titan.x,
        titan.z,
        titan.x + titan.vx * dt,
        titan.z + titan.vz * dt
      );
      titan.x = nextPos.x;
      titan.z = nextPos.z;
      return;
    }

    // State 3: 'siege_cove' / 'hunt_hero'
    if (nowMs >= (titan.nextSkillAt || 0)) {
      titan.nextSkillAt = nowMs + 9000 + Math.floor(rng() * 5000);
      if (rng() < 0.55) {
        // Telegraphed Abyssal Slam (radius 3.8m)
        const slamRadius = 3.8;
        for (const b of buildingsList) {
          if (b.hp > 0 && distHypot(titan.x, titan.z, b.x, b.z) <= slamRadius) {
            b.hp -= Math.round(titan.dmg * 1.4);
            if (b.hp <= 0) {
              delete s.buildings[b.key];
              s.events.push({ id: uid('ev'), kind: 'building_destroyed', gx: b.gx, gz: b.gz });
            }
          }
        }
        for (const p of livingHeroes) {
          if (distHypot(titan.x, titan.z, p.x, p.z) <= slamRadius) {
            p.hp = Math.max(0, (p.hp ?? 250) - Math.round(titan.dmg * 0.75));
          }
        }
        s.events.push({
          id: uid('ev'),
          kind: 'titan_slam',
          x: titan.x,
          z: titan.z,
          radius: slamRadius,
        });
      } else {
        // Summon 2 Fast Shadow Hounds (kind: 'specter')
        for (let i = 0; i < 2; i++) {
          const offsetAngle = rng() * Math.PI * 2;
          const pos = clampWorldPosWalkable(
            titan.x,
            titan.z,
            titan.x + Math.cos(offsetAngle) * 2.0,
            titan.z + Math.sin(offsetAngle) * 2.0
          );
          s.enemies.push({
            id: uid('hound'),
            kind: 'specter',
            name: 'Shadow Hound',
            isBoss: false,
            isTitan: false,
            isWild: true,
            level: titan.level || 1,
            x: pos.x,
            z: pos.z,
            vx: 0,
            vz: 0,
            hp: 150 + (titan.level || 1) * 25,
            maxHp: 150 + (titan.level || 1) * 25,
            speed: 3.4,
            dmg: 18 + (titan.level || 1) * 3,
            goldReward: 26,
            xpReward: 25,
            aiState: 'chase_hero',
            waypointX: titan.x,
            waypointZ: titan.z,
            nextWanderAt: nowMs + 6000,
            slowUntil: 0,
            slowPct: 0,
            curseMult: 1.0,
            poisonDmg: 0,
            attackingBuildingId: null,
          });
        }
        s.events.push({
          id: uid('ev'),
          kind: 'titan_hounds',
          x: titan.x,
          z: titan.z,
          count: 2,
        });
      }
    }

    // Check if blocked by a Gate Wall or building in melee range (<= 1.85m)
    let blockingB = null;
    let bestBlockD = 1.85;
    for (const b of Object.values(s.buildings)) {
      if (b.hp <= 0) continue;
      const d = distHypot(titan.x, titan.z, b.x, b.z);
      if (d <= bestBlockD) {
        bestBlockD = d;
        blockingB = b;
      }
    }

    if (blockingB) {
      titan.attackingBuildingId = blockingB.id;
      titan.vx = 0;
      titan.vz = 0;
      blockingB.hp -= titan.dmg * dt;
      if (blockingB.thorns > 0) {
        const owner = s.players[blockingB.ownerSeat];
        damageEnemy(s, titan, blockingB.thorns * dt, owner, cfg);
      }
      if (blockingB.hp <= 0) {
        delete s.buildings[blockingB.key];
        s.events.push({
          id: uid('ev'),
          kind: 'building_destroyed',
          gx: blockingB.gx,
          gz: blockingB.gz,
        });
      }
      return;
    }

    titan.attackingBuildingId = null;

    // Melee Hero catch check (<= 1.8m)
    for (const p of livingHeroes) {
      if (distHypot(titan.x, titan.z, p.x, p.z) <= 1.8) {
        p.hp = Math.max(0, (p.hp ?? 250) - titan.dmg * dt);
        if (p.hp <= 0) {
          s.events.push({ id: uid('ev'), kind: 'hero_down', seat: p.seat, x: p.x, z: p.z });
        }
      }
    }

    // If Titan breaches inside a Cove center (<= 2.2m), damage Base Shrine HP
    for (const cove of Object.values(MD_COVES)) {
      if (distHypot(titan.x, titan.z, cove.center.x, cove.center.z) <= 2.2) {
        s.shrineHp = Math.max(0, s.shrineHp - titan.dmg * dt);
      }
    }

    // Pursue nearest building or living Hero within 14m; otherwise return to 'prowl_fog'
    let pursueTarget = null;
    let bestPursueD = 14.0;
    for (const b of Object.values(s.buildings)) {
      if (b.hp <= 0) continue;
      const d = distHypot(titan.x, titan.z, b.x, b.z);
      if (d <= bestPursueD) {
        bestPursueD = d;
        pursueTarget = b;
      }
    }
    for (const p of livingHeroes) {
      const d = distHypot(titan.x, titan.z, p.x, p.z);
      if (d <= bestPursueD) {
        bestPursueD = d;
        pursueTarget = p;
      }
    }

    if (!pursueTarget) {
      titan.aiState = 'prowl_fog';
      pickTitanProwlWaypoint(s, titan, nowMs);
      return;
    }

    const dx = pursueTarget.x - titan.x;
    const dz = pursueTarget.z - titan.z;
    const d = Math.hypot(dx, dz) || 1;
    const isSlowed = nowMs < (titan.slowUntil || 0);
    const effSpeed = titan.speed * (isSlowed ? 1 - (titan.slowPct || 0.35) : 1);
    titan.vx = (dx / d) * effSpeed;
    titan.vz = (dz / d) * effSpeed;
    const nextPos = clampWorldPosWalkable(
      titan.x,
      titan.z,
      titan.x + titan.vx * dt,
      titan.z + titan.vz * dt
    );
    titan.x = nextPos.x;
    titan.z = nextPos.z;
  }

  // ==========================================================================
  // MATCH LIFECYCLE
  // ==========================================================================

  function start(table) {
    const nowMs = getNow();
    const players = [0, 1, 2, 3].map((idx) => makeSeatPlayer(table, idx, nowMs));
    // Fallback for headless tests with 0 human seats: activate seat 0 without bot AI
    if (!players.some((p) => p.active)) {
      players[0].active = true;
      players[0].isBot = false;
    }

    // ZERO starter buildings! Players explore the fog and build from scratch.
    const buildings = {};

    table.moonDefense = {
      status: 'playing',
      phase: 'prep',
      wave: 1,
      maxWaves: MD_MAX_WAVES,
      waveTitle: 'Prep Phase: Build Cove & Mine Diamonds (2:00)',
      isBossWave: false,
      prepEndsAt: nowMs + 120000,
      speedMult: 1,
      shrineHp: 1000,
      maxShrineHp: 1000,
      bunnyHp: 1000,
      bunnyMaxHp: 1000,
      players,
      buildings,
      enemies: [],
      titan: null,
      titanSlain: false,
      lastNoisePing: null,
      chests: [],
      resourceNodes: [],
      respawnQueue: [],
      gems: [],
      events: [
        {
          id: uid('ev'),
          kind: 'banner',
          text: '2:00 Head-Start! Explore the Fog, claim a Forest Cove, wall the Choke Gate & mine the Center Diamond Motherlode before the Titan awakens!',
        },
      ],
      lastWildSpawnAt: nowMs,
      lastIncomeAt: nowMs,
      lastTickAt: nowMs,
      result: null,
    };

    // Populate Center Precious Diamond Motherlode + 12 Spread-Out Forest Nodes
    spawnSpreadOutNodes(table.moonDefense);

    // Spawn 8 Roaming Wild Monsters across the forest clearings
    for (let i = 0; i < 8; i++) {
      spawnWildMonster(table.moonDefense, nowMs);
    }

    broadcastState(table);
    return { ok: true };
  }

  function onJoin(table, userId) {
    if (!table.moonDefense) return;
    const p = table.moonDefense.players.find((pl) => pl.userId === userId || pl.id === userId);
    if (p) p.disconnected = false;
    const pub = serializeState(table);
    if (send && userId && pub) {
      send([userId], {
        type: 'mb_state',
        tableId: table.id,
        state: pub,
        moonDefense: pub,
        ...pub,
      });
    }
  }

  function onDisconnect(table, userId) {
    const s = table.moonDefense;
    if (!s) return;
    const p = s.players.find((pl) => pl.userId === userId || pl.id === userId);
    if (p) p.disconnected = true;
  }

  function onLeave(table, userId) {
    const s = table.moonDefense;
    if (!s) return;
    const p = s.players.find((pl) => pl.userId === userId);
    if (p && s.status === 'playing') {
      p.disconnected = true;
      p.active = false;
    }
  }

  function rollSkillChoicesForPlayer(p) {
    const available = MD_HERO_SKILLS.filter((sk) => (p.skills[sk.id] || 0) < sk.maxLv);
    if (available.length === 0) return null;
    const pool = [...available];
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const idx = Math.floor(rng() * pool.length);
      const sk = pool.splice(idx, 1)[0];
      picks.push({
        id: sk.id,
        name: sk.name,
        icon: sk.icon,
        desc: sk.desc,
        nextLv: (p.skills[sk.id] || 0) + 1,
        maxLv: sk.maxLv,
      });
    }
    return picks;
  }

  function grantPlayerXpAndGold(s, p, xpGain, goldGain) {
    if (!p || !p.active) return;
    const magnetLv = p.skills.gold_magnet || 0;
    const goldMult = (p.mods?.coinMult || 1) * (1 + magnetLv * 0.08);
    p.gold += Math.round(goldGain * goldMult);
    p.xp += xpGain;

    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = Math.round(p.xpNext * 1.35);
      const choices = rollSkillChoicesForPlayer(p);
      if (choices && choices.length > 0) {
        p.pendingChoices = choices;
      }
    }
  }

  function strikeResourceNode(s, node, rawDmg, player, nowMs) {
    if (!node || node.hp <= 0) return false;
    const miner =
      player ||
      s.players.find((p) => p.active && !p.isBot) ||
      s.players.find((p) => p.active) ||
      s.players[0];

    const dmg = Math.max(10, Math.round(rawDmg));
    node.hp = Math.max(0, node.hp - dmg);

    const swingGold = node.swingGold || 18;
    if (miner) {
      grantPlayerXpAndGold(s, miner, 5, swingGold);
      miner.ultCharge = Math.min(100, (miner.ultCharge || 0) + 3);
    }
    s.events.push({
      id: uid('ev'),
      kind: 'mine_swing',
      seat: miner ? miner.seat : 0,
      nodeId: node.id,
      x: node.x,
      z: node.z,
      gold: swingGold,
    });

    // Center Precious Diamond Motherlode special Diamond extraction & noise ping
    if (node.kind === 'diamond_motherlode') {
      if (rng() < 0.4) {
        s.lastNoisePing = { x: node.x, z: node.z, at: nowMs || getNow() };
      }
      if (node.hp <= 0 || rng() < 0.35) {
        const diamonds = node.hp <= 0 ? Math.max(1, node.jackpotDiamonds || 1) : 1;
        if (miner) {
          miner.diamondsMined = (miner.diamondsMined || 0) + diamonds;
        }
        s.events.push({
          id: uid('ev'),
          kind: 'diamond_mined',
          seat: miner ? miner.seat : 0,
          x: node.x,
          z: node.z,
          diamonds,
        });
      }
    }

    if (node.hp <= 0) {
      if (miner) {
        grantPlayerXpAndGold(s, miner, Math.min(35, node.xp || 25), node.gold || 75);
        miner.ultCharge = Math.min(100, (miner.ultCharge || 0) + 15);
      }
      s.events.push({
        id: uid('ev'),
        kind: 'chest_open',
        nodeId: node.id,
        x: node.x,
        z: node.z,
        gold: node.gold,
        xp: node.xp,
        seat: miner ? miner.seat : 0,
        name: node.name,
      });
      const spot = MD_RESOURCE_SPOTS.find((sp) => sp.id === node.spotId);
      if (spot) {
        if (!Array.isArray(s.respawnQueue)) s.respawnQueue = [];
        s.respawnQueue.push({
          spot,
          respawnAt: (nowMs || getNow()) + 20000,
        });
      }
    }
    return true;
  }

  function stepPlayerProximityMining(s, p, nowMs) {
    if (!p || !p.active || !Array.isArray(s.chests) || s.chests.length === 0) return false;
    if (nowMs - (p.lastMineSwingAt || 0) < 800 / (s.speedMult || 1)) return false;

    let nearestNode = null;
    let minD = 2.4;
    for (const c of s.chests) {
      if (c.hp <= 0) continue;
      const d = distHypot(p.x, p.z, c.x, c.z);
      if (d <= minD) {
        minD = d;
        nearestNode = c;
      }
    }
    if (!nearestNode) return false;

    p.lastMineSwingAt = nowMs;
    const pickaxeDmg = 34 * (1 + (p.level - 1) * 0.12) * (p.mods?.dmgMult || 1);
    strikeResourceNode(s, nearestNode, pickaxeDmg, p, nowMs);
    s.chests = s.chests.filter((c) => c.hp > 0);
    s.resourceNodes = s.chests;
    return true;
  }

  function onEnemyKilled(s, enemy, killerPlayer, cfg) {
    const killer =
      killerPlayer ||
      s.players.find((p) => p.active && !p.isBot) ||
      s.players.find((p) => p.active) ||
      s.players[0];

    if (killer) {
      killer.kills += 1;
      const ultGain = (enemy.isBoss ? 25 : 8) * (killer.mods?.ultChargeMult || 1);
      killer.ultCharge = Math.min(100, killer.ultCharge + ultGain);
    }

    if (enemy.isWild && rng() < 0.4) {
      s.lastNoisePing = { x: enemy.x, z: enemy.z, at: s.lastTickAt || getNow() };
    }

    const gemGold = enemy.isBoss
      ? 120
      : enemy.goldReward || Math.max(22, Math.round((cfg?.goldReward || 45) * 0.6));
    const gemXp = enemy.isBoss
      ? 90
      : enemy.xpReward || Math.max(20, Math.round((cfg?.xpReward || 30) * 0.7));

    if (s.gems.length >= 40) {
      grantPlayerXpAndGold(s, killer, gemXp, gemGold);
    } else {
      s.gems.push({
        id: uid('g'),
        x: enemy.x,
        z: enemy.z,
        xp: gemXp,
        gold: gemGold,
      });
    }

    // Slaying the Titan drops a guaranteed Boss Charm and triggers Victory!
    if (enemy.isTitan || enemy.isBoss) {
      s.titanSlain = true;
      for (const p of s.players) {
        if (!p.active || !p.userId) continue;
        const prof = db ? db.getProfile(p.userId) : null;
        const charm = rollCharmDrop(20, rng);
        if (charm) {
          p.droppedCharms.push(charm);
          if (prof) {
            upsertCharmToProfile(prof, charm);
            db.markProfile?.(prof.id);
            pushProfile(prof);
          }
          s.events.push({
            id: uid('ev'),
            kind: 'charm_drop',
            seat: p.seat,
            playerName: p.name,
            charm,
          });
          if (charm.grade === 'SS') {
            try {
              onMvpCharmDrop({
                playerId: p.userId,
                playerName: p.name,
                wave: 20,
                charm,
              });
            } catch {}
          }
        }
      }
    }
  }

  function damageEnemy(s, enemy, rawDmg, attackerPlayer, cfg, opts = {}) {
    if (!enemy || enemy.hp <= 0) return;
    let dmg = rawDmg * (enemy.curseMult || 1.0);
    if (opts.canCrit && attackerPlayer) {
      const critChance = (attackerPlayer.mods?.critChance || 0.05) + (opts.critBonus || 0);
      if (rng() < critChance) {
        dmg *= attackerPlayer.mods?.critMult || 1.75;
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    enemy.hp -= dmg;
    if (attackerPlayer) {
      attackerPlayer.dmgDealt += dmg;
    }
    if (enemy.hp <= 0) {
      onEnemyKilled(s, enemy, attackerPlayer, cfg);
    }
  }

  function tick(table, nowArg) {
    const s = table.moonDefense;
    if (!s || s.status !== 'playing') return;

    if (s.bunnyHp != null && s.bunnyHp !== s.shrineHp) {
      s.shrineHp = s.bunnyHp;
    }
    if (s.shrineHp <= 0) {
      finishMatch(table, 'defeat');
      return;
    }

    const nowMs = nowArg || getNow();
    const rawDt = Math.max(0.05, Math.min(0.5, (nowMs - (s.lastTickAt || nowMs)) / 1000));
    s.lastTickAt = nowMs;
    const dt = rawDt * (s.speedMult || 1);
    const cfg = getWaveConfig(s.wave);

    // 1. Passive Gold income, Diamond Drill extraction, Heal Totem & Resource Node respawns every 1.0s
    if (nowMs - s.lastIncomeAt >= 1000 / (s.speedMult || 1)) {
      s.lastIncomeAt = nowMs;
      for (const p of s.players) {
        if (!p.active) continue;
        p.gold += computePlayerIncome(s, p.seat);
      }

      const allBuildings = Object.values(s.buildings);
      for (const b of allBuildings) {
        if (b.hp <= 0) continue;

        // Diamond Drill passive diamond extraction
        if (b.buildingId === 'diamond_drill' && (b.diamondChancePerTick || 0) > 0) {
          if (rng() < b.diamondChancePerTick) {
            const owner = s.players[b.ownerSeat] || s.players.find((pl) => pl.active);
            if (owner) {
              owner.diamondsMined = (owner.diamondsMined || 0) + 1;
              s.events.push({
                id: uid('ev'),
                kind: 'diamond_mined',
                seat: owner.seat,
                x: b.x,
                z: b.z,
                diamonds: 1,
              });
            }
          }
        }

        // Heal Totem heals nearby damaged buildings AND Heroes within 7.0m
        if (b.kind === 'totem') {
          const healAmt = (b.healPerSec || 32) * Math.max(1, b.level || 1);
          const range = b.range || 7.0;
          let healedAny = false;
          for (const other of allBuildings) {
            if (other.hp <= 0 || other.hp >= other.maxHp) continue;
            if (distHypot(b.x, b.z, other.x, other.z) <= range) {
              other.hp = Math.min(other.maxHp, other.hp + healAmt);
              healedAny = true;
            }
          }
          for (const p of s.players) {
            if (!p.active || (p.hp ?? 250) <= 0 || (p.hp ?? 250) >= (p.maxHp || 250)) continue;
            if (distHypot(b.x, b.z, p.x, p.z) <= range) {
              p.hp = Math.min(p.maxHp || 250, (p.hp ?? 250) + healAmt);
              healedAny = true;
            }
          }
          if (healedAny) {
            s.events.push({
              id: uid('ev'),
              kind: 'totem_heal',
              buildingId: b.id,
              x: b.x,
              z: b.z,
              range,
            });
          }
        }
      }

      // Respawn depleted resource nodes after 20s
      if (Array.isArray(s.respawnQueue) && s.respawnQueue.length > 0) {
        const remainingQueue = [];
        for (const item of s.respawnQueue) {
          if (nowMs >= item.respawnAt) {
            const alreadyThere = (s.chests || []).some(
              (c) => c.hp > 0 && c.spotId === item.spot.id
            );
            if (!alreadyThere && (s.chests || []).length < MD_RESOURCE_SPOTS.length) {
              s.chests.push(createResourceNode(item.spot, s.wave || 1));
            }
          } else {
            remainingQueue.push(item);
          }
        }
        s.respawnQueue = remainingQueue;
        s.resourceNodes = s.chests;
      }
    }

    // 2. Proximity Auto-Mining for active human players (NO Bot AI!)
    for (const p of s.players) {
      if (!p.active) continue;
      stepPlayerProximityMining(s, p, nowMs);
    }

    // 3. Maintain 6-10 Roaming Wild Monsters in the Fog every 6s (both Prep & Combat)
    if (nowMs - (s.lastWildSpawnAt || 0) >= 6000 / (s.speedMult || 1)) {
      s.lastWildSpawnAt = nowMs;
      const wildCount = s.enemies.filter((e) => !e.isTitan && e.hp > 0).length;
      if (wildCount < 9) {
        spawnWildMonster(s, nowMs);
      }
    }

    // 4. Phase: Prep -> Awaken Titan after 120s Head-Start
    if (s.phase === 'prep' && nowMs >= s.prepEndsAt) {
      awakenTitan(s, nowMs);
    }

    // 5. Step Enemies (Wild Monsters & The Non-Deterministic Titan)
    for (const e of [...s.enemies]) {
      if (e.hp <= 0) continue;

      if (e.poisonDmg > 0) {
        damageEnemy(s, e, e.poisonDmg * dt, null, cfg);
        if (e.hp <= 0) continue;
      }

      if (e.isTitan || e.isBoss) {
        stepTitanAI(s, e, dt, nowMs, cfg);
      } else {
        stepWildMonsterAI(s, e, dt, nowMs, cfg);
      }
    }

    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // 6. Step Towers (Towers inside Coves fire over Gate Walls at Titan & Wild Monsters)
    for (const b of Object.values(s.buildings)) {
      if (b.kind !== 'tower' || b.hp <= 0 || s.enemies.length === 0) continue;
      const owner = s.players[b.ownerSeat] || s.players[0];
      const hasteMult = 1 + (owner?.skills?.guardian_haste || 0) * 0.12;
      const effRate = (b.rate || 1) * hasteMult * (s.speedMult || 1);
      const cooldownMs = 1000 / Math.max(0.25, effRate);
      if (nowMs - (b.lastShotAt || 0) < cooldownMs) continue;

      let target = null;
      let bestDist = Math.max(6.8, b.range || 6.8);
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.stealthed) continue;
        const d = distHypot(b.x, b.z, e.x, e.z);
        if (d <= bestDist) {
          bestDist = d;
          target = e;
        }
      }
      if (!target) continue;

      b.lastShotAt = nowMs;
      b.lastTargetId = target.id;
      const sp = b.special || {};

      if (sp.amp > 0) {
        target.curseMult = Math.max(target.curseMult || 1, 1 + sp.amp);
      }
      if (sp.slow > 0) {
        target.slowPct = Math.max(target.slowPct || 0, sp.slow);
        target.slowUntil = nowMs + 2500;
      }
      if (sp.poison > 0) {
        target.poisonDmg = Math.max(
          target.poisonDmg || 0,
          sp.poison * (1 + (b.level - 1) * 0.3)
        );
      }

      damageEnemy(s, target, b.dmg, owner, cfg, {
        canCrit: true,
        critBonus: sp.critBonus || 0,
      });

      if (sp.splash > 0) {
        for (const other of s.enemies) {
          if (other.id === target.id || other.hp <= 0) continue;
          if (distHypot(target.x, target.z, other.x, other.z) <= sp.splash) {
            damageEnemy(s, other, b.dmg * 0.65, owner, cfg, { canCrit: false });
          }
        }
      }

      if (sp.chain > 0) {
        let bouncesLeft = sp.chain;
        let lastBounce = target;
        const hitIds = new Set([target.id]);
        while (bouncesLeft > 0) {
          let nextTarget = null;
          let minD = 4.5;
          for (const cand of s.enemies) {
            if (cand.hp <= 0 || hitIds.has(cand.id)) continue;
            const d = distHypot(lastBounce.x, lastBounce.z, cand.x, cand.z);
            if (d <= minD) {
              minD = d;
              nextTarget = cand;
            }
          }
          if (!nextTarget) break;
          hitIds.add(nextTarget.id);
          damageEnemy(s, nextTarget, b.dmg * 0.7, owner, cfg, { canCrit: false });
          lastBounce = nextTarget;
          bouncesLeft -= 1;
        }
      }

      s.events.push({
        id: uid('ev'),
        kind: 'tower_shot',
        buildingId: b.id,
        fromX: b.x,
        fromZ: b.z,
        toX: target.x,
        toZ: target.z,
        color: b.color,
      });
    }

    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // 7. Step Heroes, Pets, Vampire Survivors Auto-Skills & Gem Vacuum
    for (const p of s.players) {
      if (!p.active || (p.hp ?? 250) <= 0) continue;
      const hasteMult =
        (p.mods?.atkSpeedMult || 1) *
        (1 + (p.skills.guardian_haste || 0) * 0.12) *
        (s.speedMult || 1);
      const dmgMult = p.mods?.dmgMult || 1;

      // Hero & Pet Basic Auto-Attack (range 6.5m)
      const heroCd = 750 / hasteMult;
      if (nowMs - (p.lastHeroShotAt || 0) >= heroCd) {
        let nearest = null;
        let minD = 6.5;
        for (const e of s.enemies) {
          if (e.hp <= 0 || e.stealthed) continue;
          const d = distHypot(p.x, p.z, e.x, e.z);
          if (d <= minD) {
            minD = d;
            nearest = e;
          }
        }
        if (nearest) {
          p.lastHeroShotAt = nowMs;
          const baseHeroDmg = (28 + p.level * 5) * dmgMult;
          const petBonusDmg = (14 + (p.petStars || 1) * 8) * dmgMult;
          damageEnemy(s, nearest, baseHeroDmg + petBonusDmg, p, cfg, { canCrit: true });
          s.events.push({
            id: uid('ev'),
            kind: 'hero_shot',
            seat: p.seat,
            fromX: p.x,
            fromZ: p.z,
            toX: nearest.x,
            toZ: nearest.z,
          });
        } else if (Array.isArray(s.chests) && s.chests.length > 0) {
          let nearChest = null;
          let bestCD = 3.6;
          for (const c of s.chests) {
            if (c.hp <= 0) continue;
            const d = distHypot(p.x, p.z, c.x, c.z);
            if (d <= bestCD) {
              bestCD = d;
              nearChest = c;
            }
          }
          if (nearChest) {
            p.lastHeroShotAt = nowMs;
            const baseHeroDmg = (28 + p.level * 5) * dmgMult;
            strikeResourceNode(s, nearChest, baseHeroDmg, p, nowMs);
            s.chests = s.chests.filter((c) => c.hp > 0);
            s.resourceNodes = s.chests;
          }
        }
      }

      // Auto-Skill 1: Orbit Blades (orbit_blades)
      const bladeLv = p.skills.orbit_blades || 0;
      if (
        bladeLv > 0 &&
        s.enemies.length > 0 &&
        nowMs - (p.lastBladeAt || 0) >= 450 / (s.speedMult || 1)
      ) {
        p.lastBladeAt = nowMs;
        const bladeDmg = (16 + bladeLv * 9) * dmgMult;
        for (const e of s.enemies) {
          if (e.hp > 0 && distHypot(p.x, p.z, e.x, e.z) <= 3.3) {
            damageEnemy(s, e, bladeDmg, p, cfg, { canCrit: true });
          }
        }
      }

      // Auto-Skill 2: Thunder Chain Bolt (chain_bolt)
      const chainLv = p.skills.chain_bolt || 0;
      if (chainLv > 0 && s.enemies.length > 0 && nowMs - (p.lastChainAt || 0) >= 2200 / hasteMult) {
        p.lastChainAt = nowMs;
        const targets = s.enemies
          .filter((e) => e.hp > 0 && !e.stealthed && distHypot(p.x, p.z, e.x, e.z) <= 7.8)
          .slice(0, 2 + chainLv);
        const boltDmg = (26 + chainLv * 14) * dmgMult;
        for (const t of targets) {
          damageEnemy(s, t, boltDmg, p, cfg, { canCrit: true });
        }
      }

      // Auto-Skill 3: Glacial Frost Nova (frost_nova)
      const novaLv = p.skills.frost_nova || 0;
      if (
        novaLv > 0 &&
        s.enemies.length > 0 &&
        nowMs - (p.lastNovaAt || 0) >= 3400 / (s.speedMult || 1)
      ) {
        p.lastNovaAt = nowMs;
        const novaRadius = 4.4 + novaLv * 0.35;
        const novaDmg = (22 + novaLv * 12) * dmgMult;
        let hitAny = false;
        for (const e of s.enemies) {
          if (e.hp > 0 && distHypot(p.x, p.z, e.x, e.z) <= novaRadius) {
            hitAny = true;
            e.slowPct = 0.45;
            e.slowUntil = nowMs + 2600;
            damageEnemy(s, e, novaDmg, p, cfg, { canCrit: false });
          }
        }
        if (hitAny) {
          s.events.push({ id: uid('ev'), kind: 'frost_nova', x: p.x, z: p.z, radius: novaRadius });
        }
      }

      // Auto-Skill 6: Solar Meteor Rain (meteor_rain)
      const meteorLv = p.skills.meteor_rain || 0;
      if (
        meteorLv > 0 &&
        s.enemies.length > 0 &&
        nowMs - (p.lastMeteorAt || 0) >= 3800 / (s.speedMult || 1)
      ) {
        const inRange = s.enemies.filter(
          (e) => e.hp > 0 && !e.stealthed && distHypot(p.x, p.z, e.x, e.z) <= 9.5
        );
        if (inRange.length > 0) {
          p.lastMeteorAt = nowMs;
          inRange.sort((a, b) => b.hp - a.hp);
          const center = inRange[0];
          const meteorDmg = (48 + meteorLv * 24) * dmgMult;
          for (const e of s.enemies) {
            if (e.hp > 0 && distHypot(center.x, center.z, e.x, e.z) <= 3.0) {
              damageEnemy(s, e, meteorDmg, p, cfg, { canCrit: true });
            }
          }
          s.events.push({ id: uid('ev'), kind: 'meteor', x: center.x, z: center.z, radius: 3.0 });
        }
      }

      // Gem Vacuum
      const magnetLv = p.skills.gold_magnet || 0;
      const magnetRadius = magnetLv > 0 ? 6.2 + (magnetLv - 1) * 0.6 : 3.8;
      if (s.gems.length > 0) {
        const remainingGems = [];
        for (const g of s.gems) {
          if (distHypot(p.x, p.z, g.x, g.z) <= magnetRadius) {
            grantPlayerXpAndGold(s, p, g.xp, g.gold);
          } else {
            remainingGems.push(g);
          }
        }
        s.gems = remainingGems;
      }
    }

    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // 8. Check Victory (Titan Slain) & Defeat (Shrine <= 0 or All Active Heroes Downed)
    if (s.titanSlain || (s.titan && s.titan.hp <= 0)) {
      finishMatch(table, 'victory');
      return;
    }

    const activePlayers = s.players.filter((p) => p.active);
    const allHeroesDown =
      activePlayers.length > 0 && activePlayers.every((p) => (p.hp ?? 250) <= 0);
    if (s.shrineHp <= 0 || allHeroesDown) {
      finishMatch(table, 'defeat');
      return;
    }

    broadcastState(table);
  }

  // ==========================================================================
  // PLAYER BUILDING & ACTION HELPERS (TRUE CO-OP)
  // ==========================================================================

  function findPlayer(s, table, userId) {
    let p = s.players.find((pl) => pl.userId === userId || pl.id === userId);
    if (!p && table.seatOf && table.seatOf[userId] != null) {
      p = s.players[table.seatOf[userId]];
    }
    return p || null;
  }

  function resolveBuildingFromMsg(s, msg) {
    if (msg.buildingId) {
      const byId = Object.values(s.buildings).find(
        (b) => b.id === msg.buildingId || b.key === msg.buildingId
      );
      if (byId) return byId;
    }
    if (Number.isInteger(msg.gx) && Number.isInteger(msg.gz)) {
      return s.buildings[`${msg.gx},${msg.gz}`] || null;
    }
    return null;
  }

  function placeBuildingForPlayer(s, p, gx, gz, kind) {
    const def = MD_BUILDINGS[kind];
    if (!def) return { ok: false, error: 'invalid_building' };
    if (p.gold < def.cost) return { ok: false, error: 'not_enough_gold' };

    const check = canPlaceBuilding(gx, gz, kind, s.buildings);
    if (!check.ok) return check;

    const b = createBuildingInstance({
      gx,
      gz,
      kind,
      ownerSeat: p.seat,
      tile: check.tile,
    });
    if (!b) return { ok: false, error: 'build_failed' };

    p.gold -= def.cost;
    s.buildings[b.key] = b;
    s.events.push({
      id: uid('ev'),
      kind: 'build',
      seat: p.seat,
      gx,
      gz,
      buildingKind: kind,
    });
    return { ok: true, building: b };
  }

  function getUpgradeCost(b) {
    const baseDef = MD_BUILDINGS[b.buildingId] || MD_BUILDINGS.tower_storm;
    return Math.round((baseDef.cost || 40) * 0.85 * b.level);
  }

  function upgradeBuildingForPlayer(s, p, b) {
    if (!b) return { ok: false, error: 'building_not_found' };
    const maxLv = MD_BUILDINGS[b.buildingId]?.maxLevel || 5;
    if (b.level >= maxLv) return { ok: false, error: 'max_level_reached' };
    const cost = getUpgradeCost(b);
    if (p.gold < cost) return { ok: false, error: 'not_enough_gold' };

    p.gold -= cost;
    b.investedGold += cost;
    b.level += 1;
    b.maxHp = Math.round(b.maxHp * 1.45);
    b.hp = Math.min(b.maxHp, Math.round(b.hp * 1.45));
    if (b.dmg > 0) b.dmg = Math.round(b.dmg * 1.45);
    if (b.goldPerSec > 0) b.goldPerSec = Math.round(b.goldPerSec * 1.45);
    if (b.thorns > 0) b.thorns = Math.round(b.thorns * 1.45);
    if (b.healPerSec > 0) b.healPerSec = Math.round(b.healPerSec * 1.45);
    if (b.visionRadius > 0) {
      b.visionRadius = +(b.visionRadius * 1.25).toFixed(1);
      b.range = b.visionRadius;
    }
    if (b.diamondChancePerTick > 0) {
      b.diamondChancePerTick = +(b.diamondChancePerTick * 1.25).toFixed(3);
    }

    s.events.push({
      id: uid('ev'),
      kind: 'upgrade',
      buildingId: b.id,
      gx: b.gx,
      gz: b.gz,
      level: b.level,
    });
    return { ok: true, building: b };
  }

  function fuseBuildingForPlayer(s, p, b, element) {
    if (!b || b.kind !== 'tower') return { ok: false, error: 'not_a_tower' };
    if (!MD_ELEMENTS[element]) return { ok: false, error: 'invalid_element' };
    if (b.elements.length >= 3) return { ok: false, error: 'max_fusions_reached' };
    const fuseCost = 55;
    if (p.gold < fuseCost) return { ok: false, error: 'not_enough_gold' };

    p.gold -= fuseCost;
    b.investedGold += fuseCost;
    b.elements = [...b.elements, element];

    const fused = resolveTowerFusion(b.elements);
    const lvMult = Math.pow(1.45, b.level - 1);
    b.name = fused.name;
    b.icon = fused.icon;
    b.outfit = fused.outfit;
    b.color = fused.color;
    b.tier = fused.tier;
    b.dmg = Math.round(fused.dmg * lvMult);
    b.rate = fused.rate;
    b.range = fused.range;
    b.special = fused.special;
    b.maxHp = Math.round(b.maxHp * 1.25);
    b.hp = b.maxHp;

    s.events.push({
      id: uid('ev'),
      kind: 'fusion',
      buildingId: b.id,
      gx: b.gx,
      gz: b.gz,
      tier: b.tier,
      name: b.name,
      outfit: b.outfit,
    });
    return { ok: true, building: b };
  }

  function handle(table, userId, msg = {}) {
    const s = table.moonDefense;
    if (!s || s.status !== 'playing') return { ok: false, error: 'not_playing' };
    const p = findPlayer(s, table, userId);
    if (!p) return { ok: false, error: 'player_not_found' };

    const nowMs = getNow();
    const cfg = getWaveConfig(s.wave);

    switch (msg.type) {
      case 'mb_move': {
        const nextX = Number.isFinite(Number(msg.x)) ? Number(msg.x) : p.x;
        const nextZ = Number.isFinite(Number(msg.z)) ? Number(msg.z) : p.z;
        const clamped = clampWorldPosWalkable(p.x, p.z, nextX, nextZ);
        p.x = clamped.x;
        p.z = clamped.z;
        if (Number.isFinite(Number(msg.vx))) p.vx = Number(msg.vx);
        if (Number.isFinite(Number(msg.vz))) p.vz = Number(msg.vz);
        if (typeof msg.right === 'boolean') p.right = msg.right;
        if (typeof msg.back === 'boolean') p.back = msg.back;
        if (stepPlayerProximityMining(s, p, nowMs)) {
          broadcastState(table);
        }
        return { ok: true };
      }

      case 'mb_attack': {
        if (nowMs - (p.lastManualAttackAt || 0) < 350) {
          return { ok: false, error: 'attack_on_cooldown' };
        }
        p.lastManualAttackAt = nowMs;
        const slashDmg = Math.round(
          42 * (1 + (p.level - 1) * 0.18) * (p.mods?.dmgMult || 1)
        );
        let hitCount = 0;

        for (const e of s.enemies) {
          if (e.hp > 0 && distHypot(p.x, p.z, e.x, e.z) <= 3.6) {
            damageEnemy(s, e, slashDmg, p, cfg, { canCrit: true });
            hitCount += 1;
          }
        }
        s.enemies = s.enemies.filter((e) => e.hp > 0);

        if (Array.isArray(s.chests)) {
          for (const c of s.chests) {
            if (c.hp > 0 && distHypot(p.x, p.z, c.x, c.z) <= 3.6) {
              strikeResourceNode(s, c, slashDmg, p, nowMs);
              hitCount += 1;
            }
          }
          s.chests = s.chests.filter((c) => c.hp > 0);
          s.resourceNodes = s.chests;
        }

        p.ultCharge = Math.min(100, (p.ultCharge || 0) + 6);
        s.events.push({
          id: uid('ev'),
          kind: 'hero_slash',
          seat: p.seat,
          x: p.x,
          z: p.z,
          hitCount,
        });
        if (s.titanSlain || (s.titan && s.titan.hp <= 0)) {
          finishMatch(table, 'victory');
          return { ok: true, dmg: slashDmg, hitCount };
        }
        broadcastState(table);
        return { ok: true, dmg: slashDmg, hitCount };
      }

      case 'mb_mine': {
        if (!Array.isArray(s.chests) || s.chests.length === 0) {
          return { ok: false, error: 'no_nodes' };
        }
        let targetNode = null;
        if (msg.nodeId || msg.id) {
          targetNode = s.chests.find(
            (c) =>
              c.hp > 0 &&
              (c.id === (msg.nodeId || msg.id) || c.spotId === (msg.nodeId || msg.id))
          );
        }
        if (!targetNode) {
          let bestD = 3.8;
          for (const c of s.chests) {
            if (c.hp <= 0) continue;
            const d = distHypot(p.x, p.z, c.x, c.z);
            if (d <= bestD) {
              bestD = d;
              targetNode = c;
            }
          }
        }
        if (!targetNode) return { ok: false, error: 'node_out_of_range' };
        p.lastMineSwingAt = nowMs;
        const pickaxeDmg = Math.round(
          38 * (1 + (p.level - 1) * 0.15) * (p.mods?.dmgMult || 1)
        );
        strikeResourceNode(s, targetNode, pickaxeDmg, p, nowMs);
        s.chests = s.chests.filter((c) => c.hp > 0);
        s.resourceNodes = s.chests;
        broadcastState(table);
        return { ok: true, nodeId: targetNode.id };
      }

      case 'mb_claim_cove': {
        const cove = MD_COVES[msg.coveId || p.coveId];
        if (!cove) return { ok: false, error: 'invalid_cove' };
        p.coveId = cove.id;
        p.coveName = cove.name;
        p.coveColor = cove.color;
        p.x = cove.spawn.x;
        p.z = cove.spawn.z;
        broadcastState(table);
        return { ok: true, coveId: cove.id };
      }

      case 'mb_build': {
        let gx = msg.gx;
        let gz = msg.gz;
        if (
          (!Number.isInteger(gx) || !Number.isInteger(gz)) &&
          Number.isFinite(msg.x) &&
          Number.isFinite(msg.z)
        ) {
          const g = worldToGrid(msg.x, msg.z);
          gx = g.gx;
          gz = g.gz;
        }
        const kind = msg.kind || msg.buildingKind || msg.id;
        const res = placeBuildingForPlayer(s, p, gx | 0, gz | 0, kind);
        if (res.ok) broadcastState(table);
        return res;
      }

      case 'mb_upgrade_building': {
        const b = resolveBuildingFromMsg(s, msg);
        const res = upgradeBuildingForPlayer(s, p, b);
        if (res.ok) broadcastState(table);
        return res;
      }

      case 'mb_fuse_building': {
        const b = resolveBuildingFromMsg(s, msg);
        const res = fuseBuildingForPlayer(s, p, b, msg.element);
        if (res.ok) broadcastState(table);
        return res;
      }

      case 'mb_sell_building': {
        const b = resolveBuildingFromMsg(s, msg);
        if (!b) return { ok: false, error: 'building_not_found' };
        const refund = Math.round((b.investedGold || 25) * 0.75);
        p.gold += refund;
        delete s.buildings[b.key];
        s.events.push({ id: uid('ev'), kind: 'sell', gx: b.gx, gz: b.gz, refund });
        broadcastState(table);
        return { ok: true, refund };
      }

      case 'mb_repair_building': {
        const b = resolveBuildingFromMsg(s, msg);
        if (!b) return { ok: false, error: 'building_not_found' };
        if (b.hp >= b.maxHp) return { ok: false, error: 'already_full_hp' };
        const cost = 15;
        if (p.gold < cost) return { ok: false, error: 'not_enough_gold' };
        p.gold -= cost;
        b.hp = b.maxHp;
        broadcastState(table);
        return { ok: true, building: b };
      }

      case 'mb_start_wave':
      case 'mb_awaken_titan': {
        if (s.phase !== 'prep') return { ok: false, error: 'already_in_combat' };
        p.gold += 40;
        awakenTitan(s, nowMs);
        broadcastState(table);
        return { ok: true };
      }

      case 'mb_dash': {
        if (nowMs < (p.dashCdUntil || 0)) return { ok: false, error: 'dash_on_cooldown' };
        const tx = Number.isFinite(Number(msg.x)) ? Number(msg.x) : p.x + (p.right ? 4 : -4);
        const tz = Number.isFinite(Number(msg.z)) ? Number(msg.z) : p.z + (p.back ? -4 : 4);
        const dx = tx - p.x;
        const dz = tz - p.z;
        const dist = Math.hypot(dx, dz) || 1;
        const step = Math.min(5.5, dist);
        const clamped = clampWorldPosWalkable(
          p.x,
          p.z,
          p.x + (dx / dist) * step,
          p.z + (dz / dist) * step
        );
        p.x = clamped.x;
        p.z = clamped.z;
        const cdMs = Math.round(3500 * (p.mods?.dashCdMult || 1));
        p.dashCdUntil = nowMs + cdMs;

        const dashDmg = (45 + p.level * 10) * (p.mods?.dmgMult || 1);
        for (const e of s.enemies) {
          if (e.hp > 0 && distHypot(p.x, p.z, e.x, e.z) <= 2.6) {
            damageEnemy(s, e, dashDmg, p, cfg, { canCrit: true });
          }
        }
        s.enemies = s.enemies.filter((e) => e.hp > 0);
        if (Array.isArray(s.chests)) {
          for (const c of s.chests) {
            if (c.hp > 0 && distHypot(p.x, p.z, c.x, c.z) <= 2.4) {
              strikeResourceNode(s, c, dashDmg, p, nowMs);
            }
          }
          s.chests = s.chests.filter((c) => c.hp > 0);
          s.resourceNodes = s.chests;
        }
        s.events.push({ id: uid('ev'), kind: 'dash', seat: p.seat, x: p.x, z: p.z });
        if (s.titanSlain || (s.titan && s.titan.hp <= 0)) {
          finishMatch(table, 'victory');
          return { ok: true };
        }
        broadcastState(table);
        return { ok: true };
      }

      case 'mb_ult': {
        if (p.ultCharge < 100) return { ok: false, error: 'ult_not_ready' };
        p.ultCharge = 0;
        const ultDmg = (180 + p.level * 35) * (p.mods?.dmgMult || 1);
        for (const e of s.enemies) {
          if (e.hp > 0 && distHypot(p.x, p.z, e.x, e.z) <= 8.5) {
            damageEnemy(s, e, ultDmg, p, cfg, { canCrit: true });
          }
        }
        s.enemies = s.enemies.filter((e) => e.hp > 0);

        // Heal Hero +100 HP, Shrine +150 HP & all walls +35%
        p.hp = Math.min(p.maxHp || 250, (p.hp ?? 250) + 100);
        s.shrineHp = Math.min(s.maxShrineHp, s.shrineHp + 150);
        for (const b of Object.values(s.buildings)) {
          if (b.kind === 'wall' && b.hp > 0) {
            b.hp = Math.min(b.maxHp, Math.round(b.hp + b.maxHp * 0.35));
          }
        }
        s.events.push({ id: uid('ev'), kind: 'ult', seat: p.seat, x: p.x, z: p.z });
        if (s.titanSlain || (s.titan && s.titan.hp <= 0)) {
          finishMatch(table, 'victory');
          return { ok: true };
        }
        broadcastState(table);
        return { ok: true };
      }

      case 'mb_pick_skill':
      case 'mb_pick_blessing': {
        const skillId = msg.skillId || msg.id || msg.choice;
        const sk = MD_HERO_SKILLS[skillId];
        if (!sk) return { ok: false, error: 'invalid_skill' };
        p.skills[sk.id] = Math.min(sk.maxLv, (p.skills[sk.id] || 0) + 1);
        p.pendingChoices = null;
        broadcastState(table);
        return { ok: true, skillId: sk.id, level: p.skills[sk.id] };
      }

      case 'mb_toggle_speed': {
        s.speedMult = s.speedMult === 2 ? 1 : 2;
        broadcastState(table);
        return { ok: true, speedMult: s.speedMult };
      }

      case 'mb_cash_out': {
        finishMatch(table, 'cash_out');
        return { ok: true };
      }

      default:
        return { ok: false, error: 'unknown_command' };
    }
  }

  function finishMatch(table, reason = 'victory') {
    const s = table.moonDefense;
    if (!s || s.status === 'ended') return;
    s.status = 'ended';
    table.status = 'ended';

    const clearedWaves = reason === 'victory' ? MD_MAX_WAVES : Math.max(1, s.wave);
    const victoryBonus = reason === 'victory' ? 1.5 : reason === 'cash_out' ? 1.15 : 0.85;
    const rewards = {};

    for (const p of s.players) {
      if (!p.active || !p.userId) continue;
      const prof = db ? db.getProfile(p.userId) : null;
      const podiumMult = p.mods?.podiumMult || 1;

      const gold = Math.round((120 + clearedWaves * 45 + p.kills * 3) * podiumMult * victoryBonus);
      const berries = Math.round((15 + clearedWaves * 6) * victoryBonus);
      const baseDiamonds =
        reason === 'victory' ? 15 : clearedWaves >= 10 ? 8 : clearedWaves >= 5 ? 4 : 2;
      const diamonds = baseDiamonds + (p.diamondsMined || 0);
      const exp = Math.round((80 + clearedWaves * 18) * victoryBonus);

      let levelsGained = 0;
      let levelAfter = prof?.level || 1;
      let expAfter = prof?.exp || 0;
      let petExpGained = 0;

      if (prof) {
        prof.gold = (prof.gold || 0) + gold;
        prof.berries = (prof.berries || 0) + berries;
        prof.diamonds = (prof.diamonds || 0) + diamonds;

        const lvRes = applyExp(prof.level || 1, prof.exp || 0, exp);
        levelsGained = lvRes.levelsGained;
        levelAfter = lvRes.level;
        expAfter = lvRes.exp;
        prof.level = lvRes.level;
        prof.exp = lvRes.exp;
        if (lvRes.levelsGained > 0) {
          prof.diamonds += lvRes.levelsGained * 50;
        }

        if (Array.isArray(prof.pets) && prof.pets.length > 0) {
          const petRes = grantPetActivityExp(prof, 30, 'moon_defense');
          if (petRes?.ok) petExpGained = petRes.expGained || 0;
        }

        db.markProfile?.(prof.id);
        pushProfile(prof);
        try {
          onMatchFinished(prof);
        } catch {}
      }

      const nextExpVal = expToNext(levelAfter);
      rewards[p.userId] = {
        gold,
        berries,
        diamonds,
        diamondsMined: p.diamondsMined || 0,
        exp,
        levelsGained,
        level: levelAfter,
        levelExp: expAfter,
        levelExpNext: Number.isFinite(nextExpVal) ? nextExpVal : 0,
        petExpGained,
        droppedCharms: p.droppedCharms || [],
      };
    }

    s.result = {
      reason,
      wave: s.wave,
      clearedWaves,
      shrineHp: Math.round(s.shrineHp),
      rewards,
    };

    broadcastState(table);
  }

  return {
    start,
    onJoin,
    onDisconnect,
    onLeave,
    leave: onLeave,
    tick,
    handle,
    finishMatch,
  };
}
