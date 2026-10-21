// server/town_hall_bots.js — Autonomous Town Hall citizen bots that stroll along the plaza promenades,
// visit landmarks (Fountain, Hall of Fame statues, Casino, Monopoly Arch, Forge, Owl Postbox, VIP Tables),
// pause to admire/socialize, and wear randomized costumes + companion pets.
import { TOWNHALL } from '../shared/phase5_rules.js';
import { TOWNHALL_BOT_DEFS, seedTownHallBots, randomizeBotCostume, publicProfile } from './profile_factory.js';
import { ensurePhase5 } from './daily_service.js';
import * as rpg from './rpg_service.js';

// Connected promenade & landmark waypoint graph matching client/js/town_hall_scene.js stone courts/corridors.
// Coordinates are placed on the open cream-stone promenades in front of billboards so bots are never hidden behind props.
export const TOWNHALL_WAYPOINTS = Object.freeze({
  // Central Goddess Fountain Forecourt (in front of the fountain basin at z = 2.2..3.6)
  fountain_s:    { x: 0.0,   z: 2.55,  pause: [2.8, 5.8], lookBack: true,  poi: true,  hub: true },
  fountain_sw:   { x: -1.65, z: 2.45,  pause: [2.2, 4.8], lookBack: true,  lookRight: true,  poi: true,  hub: true },
  fountain_se:   { x: 1.65,  z: 2.45,  pause: [2.2, 4.8], lookBack: true,  lookRight: false, poi: true,  hub: true },

  // Side bypasses around the Fountain (transit nodes only — bots don't stop behind the fountain sprite)
  fountain_pass_w: { x: -2.45, z: -0.4, pause: [0.2, 0.4], lookBack: false, poi: false, transit: true },
  fountain_pass_e: { x: 2.45,  z: -0.4, pause: [0.2, 0.4], lookBack: false, poi: false, transit: true },
  fountain_n:      { x: 0.0,   z: -3.2, pause: [1.5, 3.2], lookBack: false, poi: true,  hub: false },

  // Central Spine & South Spawn Starlight Medallion Court (x in [-2, 2], z in [4.0, 9.5])
  plaza_mid_w:   { x: -1.35, z: 4.1,   pause: [2.0, 4.5], lookBack: false, lookRight: true,  poi: true,  hub: true },
  plaza_mid_e:   { x: 1.35,  z: 4.1,   pause: [2.0, 4.5], lookBack: false, lookRight: false, poi: true,  hub: true },
  spawn_c:       { x: 0.0,   z: 5.8,   pause: [2.2, 4.8], lookBack: false, poi: true,  hub: true },
  spawn_w:       { x: -1.85, z: 6.3,   pause: [2.2, 4.8], lookBack: false, lookRight: true,  poi: true,  hub: true },
  spawn_e:       { x: 1.85,  z: 6.3,   pause: [2.2, 4.8], lookBack: false, lookRight: false, poi: true,  hub: true },
  south_mid:     { x: 0.0,   z: 8.8,   pause: [1.8, 3.8], lookBack: false, poi: true,  hub: true },
  south_gate:    { x: 0.0,   z: 12.2,  pause: [2.2, 4.5], lookBack: true,  poi: true,  hub: false },

  // North Spine & 5 Hall of Fame Statue Plinth Courts
  north_mid:     { x: 0.0,   z: -7.2,  pause: [1.2, 2.5], lookBack: true,  poi: false, hub: false },
  statue_1:      { x: -7.5,  z: -11.6, pause: [2.8, 5.5], lookBack: true,  lookRight: true,  poi: true,  hub: false },
  statue_2:      { x: -3.8,  z: -12.4, pause: [2.8, 5.5], lookBack: true,  lookRight: true,  poi: true,  hub: false },
  statue_3:      { x: 0.0,   z: -12.8, pause: [3.0, 5.8], lookBack: true,  poi: true,  hub: false },
  statue_4:      { x: 3.8,   z: -12.4, pause: [2.8, 5.5], lookBack: true,  lookRight: false, poi: true,  hub: false },
  statue_5:      { x: 7.5,   z: -11.6, pause: [2.8, 5.5], lookBack: true,  lookRight: false, poi: true,  hub: false },

  // Upper West Grand Starlight Casino & Upper East Sky Monopoly Portal
  casino_mid:    { x: -5.4,  z: -3.8,  pause: [1.0, 2.0], lookBack: true,  lookRight: false, poi: false, hub: false },
  casino_palace: { x: -9.4,  z: -4.2,  pause: [3.0, 5.8], lookBack: true,  lookRight: false, poi: true,  hub: false },
  mono_mid:      { x: 5.4,   z: -3.8,  pause: [1.0, 2.0], lookBack: true,  lookRight: true,  poi: false, hub: false },
  monopoly_arch: { x: 9.4,   z: -4.2,  pause: [3.0, 5.8], lookBack: true,  lookRight: true,  poi: true,  hub: false },

  // Mid-West Royal Owl Postbox & Mid-East Star-Force Forge (symmetrical wings at z = 3.5)
  owl_mid:       { x: -4.8,  z: 3.5,   pause: [1.5, 3.2], lookBack: false, lookRight: false, poi: true,  hub: true },
  owl_postbox:   { x: -8.2,  z: 4.1,   pause: [2.8, 5.5], lookBack: true,  lookRight: false, poi: true,  hub: false },
  forge_mid:     { x: 4.8,   z: 3.5,   pause: [1.5, 3.2], lookBack: false, lookRight: true,  poi: true,  hub: true },
  forge:         { x: 8.2,   z: 4.1,   pause: [3.0, 5.8], lookBack: true,  lookRight: true,  poi: true,  hub: false },

  // Lower Garden Symmetrical VIP Tables #1 & #2
  vip_table_1:   { x: -5.4,  z: 8.8,   pause: [2.8, 5.8], lookBack: false, lookRight: true,  poi: true,  hub: true },
  vip_table_2:   { x: 5.4,   z: 8.8,   pause: [2.8, 5.8], lookBack: false, lookRight: false, poi: true,  hub: true },
});

const EDGES = Object.freeze({
  fountain_s:      ['fountain_sw', 'fountain_se', 'plaza_mid_w', 'plaza_mid_e', 'spawn_c'],
  fountain_sw:     ['fountain_s', 'plaza_mid_w', 'owl_mid', 'fountain_pass_w'],
  fountain_se:     ['fountain_s', 'plaza_mid_e', 'forge_mid', 'fountain_pass_e'],
  fountain_pass_w: ['fountain_sw', 'fountain_n', 'casino_mid', 'owl_mid'],
  fountain_pass_e: ['fountain_se', 'fountain_n', 'mono_mid', 'forge_mid'],
  fountain_n:      ['fountain_pass_w', 'fountain_pass_e', 'north_mid', 'casino_mid', 'mono_mid'],

  plaza_mid_w:     ['fountain_s', 'fountain_sw', 'spawn_c', 'spawn_w', 'owl_mid'],
  plaza_mid_e:     ['fountain_s', 'fountain_se', 'spawn_c', 'spawn_e', 'forge_mid'],
  spawn_c:         ['fountain_s', 'plaza_mid_w', 'plaza_mid_e', 'spawn_w', 'spawn_e', 'south_mid'],
  spawn_w:         ['spawn_c', 'plaza_mid_w', 'owl_mid', 'vip_table_1', 'south_mid'],
  spawn_e:         ['spawn_c', 'plaza_mid_e', 'forge_mid', 'vip_table_2', 'south_mid'],
  south_mid:       ['spawn_c', 'spawn_w', 'spawn_e', 'south_gate', 'vip_table_1', 'vip_table_2'],
  south_gate:      ['south_mid'],

  north_mid:       ['fountain_n', 'statue_2', 'statue_3', 'statue_4', 'casino_mid', 'mono_mid'],
  statue_1:        ['statue_2', 'casino_mid'],
  statue_2:        ['statue_1', 'statue_3', 'north_mid'],
  statue_3:        ['statue_2', 'statue_4', 'north_mid'],
  statue_4:        ['statue_3', 'statue_5', 'north_mid'],
  statue_5:        ['statue_4', 'mono_mid'],

  casino_mid:      ['fountain_pass_w', 'fountain_n', 'north_mid', 'casino_palace', 'statue_1'],
  casino_palace:   ['casino_mid'],
  mono_mid:        ['fountain_pass_e', 'fountain_n', 'north_mid', 'monopoly_arch', 'statue_5'],
  monopoly_arch:   ['mono_mid'],

  owl_mid:         ['fountain_sw', 'plaza_mid_w', 'spawn_w', 'owl_postbox', 'vip_table_1'],
  owl_postbox:     ['owl_mid'],

  forge_mid:       ['fountain_se', 'plaza_mid_e', 'spawn_e', 'forge', 'vip_table_2'],
  forge:           ['forge_mid'],

  vip_table_1:     ['spawn_w', 'south_mid', 'owl_mid'],
  vip_table_2:     ['spawn_e', 'south_mid', 'forge_mid'],
});

const INITIAL_NODES = ['fountain_sw', 'plaza_mid_e', 'spawn_w', 'fountain_se'];

function findShortestPath(startNode, targetNode) {
  if (startNode === targetNode) return [targetNode];
  const queue = [[startNode]];
  const visited = new Set([startNode]);
  while (queue.length > 0) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    const neighbors = EDGES[cur] || [];
    for (const next of neighbors) {
      if (next === targetNode) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [targetNode];
}

function clampPlaza(v) {
  return Math.max(-16.8, Math.min(16.8, v));
}

export function createTownHallBotController({
  db,
  instances,
  presence,
  sockets,
  broadcast,
  rng = Math.random,
  tickMs = 150,
}) {
  const usedOutfits = new Set();
  const usedPets = new Set();
  const seededBots = seedTownHallBots(rng);
  const botProfiles = [];

  for (const freshBot of seededBots) {
    let existing = db.getProfile(freshBot.id);
    if (!existing) {
      db.putProfile(freshBot);
      existing = freshBot;
    } else {
      existing.is_bot = true;
      existing.title = existing.title || freshBot.title;
      existing.friends = existing.friends?.length ? existing.friends : freshBot.friends;
      existing.partner_id = existing.partner_id || freshBot.partner_id;
      existing.couple_streak = existing.couple_streak || freshBot.couple_streak;
      existing.arcade_best = existing.arcade_best || freshBot.arcade_best;
      existing.mono_stats = existing.mono_stats?.goldWon ? existing.mono_stats : freshBot.mono_stats;
      randomizeBotCostume(existing, rng, usedOutfits, usedPets);
    }
    rpg.migrateRpg(existing);
    ensurePhase5(existing);
    db.markProfile(existing.id);
    botProfiles.push(existing);
  }

  // Ensure Town Hall instance exists and contains the bots
  if (!instances.has(TOWNHALL.ID)) {
    instances.set(TOWNHALL.ID, new Set());
  }
  const thMembers = instances.get(TOWNHALL.ID);

  const now0 = Date.now();
  const poiKeys = Object.keys(TOWNHALL_WAYPOINTS).filter((k) => TOWNHALL_WAYPOINTS[k].poi);
  const hubKeys = Object.keys(TOWNHALL_WAYPOINTS).filter((k) => TOWNHALL_WAYPOINTS[k].hub);
  const allNodeKeys = Object.keys(TOWNHALL_WAYPOINTS);

  const botStates = botProfiles.map((p, idx) => {
    const startNode = INITIAL_NODES[idx % INITIAL_NODES.length] || 'fountain_s';
    const wp = TOWNHALL_WAYPOINTS[startNode];
    const jx = (rng() - 0.5) * 0.45;
    const jz = (rng() - 0.5) * 0.45;
    const x = +(wp.x + jx).toFixed(3);
    const z = +(wp.z + jz).toFixed(3);
    const right = wp.lookRight ?? (idx % 2 === 0);
    const back = wp.lookBack ?? false;

    thMembers.add(p.id);
    presence.set(p.id, {
      x,
      z,
      vx: 0,
      vz: 0,
      right,
      back,
      t: now0,
      instanceId: TOWNHALL.ID,
    });

    return {
      id: p.id,
      node: startNode,
      waypoints: [],
      pauseUntil: now0 + 900 + idx * 850,
      nextMicroTurnAt: now0 + 1800 + idx * 500,
      nextCostumeSwapAt: now0 + (75 + Math.floor(rng() * 55)) * 1000,
      baseSpeed: 3.1 + (idx % 3) * 0.25 + rng() * 0.25,
      lastTickAt: now0,
      wasMoving: false,
    };
  });

  function chooseNextPath(bot) {
    // 70% chance to stroll around the central plaza hub (Fountain Forecourt, Spawn Court, Owl Postbox, Forge Walk, VIP Tables 1/2),
    // 30% chance to visit outer landmarks (Hall of Fame Statues, Casino Palace, Monopoly Arch, South Gate, VIP 3/4)
    let targetNode = bot.node;
    const roll = rng();
    if (roll < 0.70) {
      const candidates = hubKeys.filter((k) => k !== bot.node);
      targetNode = candidates[Math.floor(rng() * candidates.length)] || 'fountain_s';
    } else {
      const candidates = poiKeys.filter((k) => k !== bot.node);
      targetNode = candidates[Math.floor(rng() * candidates.length)] || allNodeKeys[0];
    }

    const nodeSeq = findShortestPath(bot.node, targetNode);
    const steps = nodeSeq.slice(1).map((nodeKey, i, arr) => {
      const wp = TOWNHALL_WAYPOINTS[nodeKey];
      const isFinal = i === arr.length - 1;
      const spread = wp.transit ? 0.12 : (isFinal ? 0.42 : 0.25);
      let tx = clampPlaza(wp.x + (rng() - 0.5) * spread * 2);
      let tz = clampPlaza(wp.z + (rng() - 0.5) * spread * 2);
      // Keep clear of the central fountain marble basin at (0, 0)
      const distCenter = Math.hypot(tx, tz);
      if (distCenter < 2.2) {
        const scale = 2.3 / Math.max(0.1, distCenter);
        tx *= scale;
        tz *= scale;
      }
      return {
        node: nodeKey,
        x: +tx.toFixed(3),
        z: +tz.toFixed(3),
        pauseRange: wp.pause || [2.0, 4.5],
        lookBack: wp.lookBack,
        lookRight: wp.lookRight,
      };
    });

    bot.waypoints = steps;
  }

  function tick(now = Date.now()) {
    if (!instances.has(TOWNHALL.ID)) {
      instances.set(TOWNHALL.ID, new Set());
    }
    const members = instances.get(TOWNHALL.ID);

    for (const bot of botStates) {
      // If a real human logs in with this bot username, let the human control it
      if (sockets.has(bot.id)) {
        bot.lastTickAt = now;
        continue;
      }

      const p = db.getProfile(bot.id);
      if (!p) continue;

      if (!members.has(bot.id)) {
        members.add(bot.id);
      }

      let s = presence.get(bot.id);
      if (!s || s.instanceId !== TOWNHALL.ID) {
        const wp = TOWNHALL_WAYPOINTS[bot.node] || TOWNHALL_WAYPOINTS.fountain_s;
        s = {
          x: wp.x,
          z: wp.z,
          vx: 0,
          vz: 0,
          right: true,
          back: false,
          t: now,
          instanceId: TOWNHALL.ID,
        };
        presence.set(bot.id, s);
        broadcast(TOWNHALL.ID, { type: 'player_joined', player: { ...publicProfile(p), ...s } }, bot.id);
      }

      const dt = Math.min(0.4, Math.max(0.01, (now - bot.lastTickAt) / 1000));
      bot.lastTickAt = now;

      // If currently walking along waypoints
      if (bot.waypoints.length > 0) {
        const target = bot.waypoints[0];
        const dx = target.x - s.x;
        const dz = target.z - s.z;
        const dist = Math.hypot(dx, dz);
        const speed = bot.baseSpeed;
        const stepDist = speed * dt;

        if (dist <= stepDist + 0.08) {
          // Reached waypoint
          s.x = target.x;
          s.z = target.z;
          bot.node = target.node;
          bot.waypoints.shift();

          if (bot.waypoints.length === 0) {
            // Reached final destination of this stroll: pause and admire
            s.vx = 0;
            s.vz = 0;
            if (typeof target.lookRight === 'boolean') s.right = target.lookRight;
            if (typeof target.lookBack === 'boolean') s.back = target.lookBack;
            else s.back = false;
            s.t = now;
            const [minP, maxP] = target.pauseRange || [2.2, 5.2];
            const pauseSec = minP + rng() * (maxP - minP);
            bot.pauseUntil = now + pauseSec * 1000;
            bot.nextMicroTurnAt = now + (1.2 + rng() * 1.8) * 1000;
            bot.wasMoving = false;

            broadcast(TOWNHALL.ID, {
              type: 'player_moved',
              id: bot.id,
              x: s.x,
              z: s.z,
              vx: 0,
              vz: 0,
              right: s.right,
              back: s.back,
            }, bot.id);
          } else {
            // Immediately aim toward next waypoint so movement stays continuous
            const nextWp = bot.waypoints[0];
            const ndx = nextWp.x - s.x;
            const ndz = nextWp.z - s.z;
            const nd = Math.hypot(ndx, ndz) || 1;
            s.vx = +((ndx / nd) * speed).toFixed(3);
            s.vz = +((ndz / nd) * speed).toFixed(3);
            if (Math.abs(ndx / nd) > 0.15) s.right = ndx > 0;
            s.back = (ndz / nd) < -0.15;
            s.t = now;
            bot.wasMoving = true;

            broadcast(TOWNHALL.ID, {
              type: 'player_moved',
              id: bot.id,
              x: s.x,
              z: s.z,
              vx: s.vx,
              vz: s.vz,
              right: s.right,
              back: s.back,
            }, bot.id);
          }
        } else {
          // Advance along segment
          const nx = dx / dist;
          const nz = dz / dist;
          let nextX = s.x + nx * stepDist;
          let nextZ = s.z + nz * stepDist;

          // Push gently outside the central fountain basin if a diagonal grazed it
          const centerD = Math.hypot(nextX, nextZ);
          if (centerD < 2.15) {
            const push = 2.2 / Math.max(0.1, centerD);
            nextX *= push;
            nextZ *= push;
          }

          s.x = +clampPlaza(nextX).toFixed(3);
          s.z = +clampPlaza(nextZ).toFixed(3);
          s.vx = +(nx * speed).toFixed(3);
          s.vz = +(nz * speed).toFixed(3);
          if (Math.abs(nx) > 0.15) s.right = nx > 0;
          s.back = nz < -0.15;
          s.t = now;
          bot.wasMoving = true;

          broadcast(TOWNHALL.ID, {
            type: 'player_moved',
            id: bot.id,
            x: s.x,
            z: s.z,
            vx: s.vx,
            vz: s.vz,
            right: s.right,
            back: s.back,
          }, bot.id);
        }
        continue;
      }

      // Bot is currently paused at a landmark / court
      if (now >= bot.nextCostumeSwapAt) {
        // Periodically try on a fresh random costume while hanging out in Town Hall
        const activeOutfits = new Set(
          botStates
            .filter((b) => b.id !== bot.id)
            .map((b) => db.getProfile(b.id)?.equipped?.outfit?.id)
            .filter(Boolean)
        );
        randomizeBotCostume(p, rng, activeOutfits);
        db.markProfile(p.id);
        bot.nextCostumeSwapAt = now + (80 + Math.floor(rng() * 60)) * 1000;
        broadcast(TOWNHALL.ID, {
          type: 'player_equipped',
          id: p.id,
          equipped: p.equipped,
          appearance: p.appearance,
          lineage: p.lineage,
          cp: p.cp,
        }, p.id);
      }

      if (now < bot.pauseUntil) {
        // Subtle idle look-around or small shift while hanging out
        if (now >= bot.nextMicroTurnAt) {
          bot.nextMicroTurnAt = now + (1.8 + rng() * 2.4) * 1000;
          if (rng() < 0.35) {
            const wp = TOWNHALL_WAYPOINTS[bot.node] || { x: s.x, z: s.z };
            const ang = rng() * Math.PI * 2;
            const r = 0.4 + rng() * 0.45;
            let tx = clampPlaza(wp.x + Math.cos(ang) * r);
            let tz = clampPlaza(wp.z + Math.sin(ang) * r);
            if (Math.hypot(tx, tz) < 2.2) {
              tx = wp.x;
              tz = wp.z;
            }
            bot.waypoints = [{
              node: bot.node,
              x: +tx.toFixed(3),
              z: +tz.toFixed(3),
              pauseRange: [1.5, 3.2],
              lookBack: false,
            }];
          } else {
            s.right = !s.right;
            s.back = false;
            s.vx = 0;
            s.vz = 0;
            s.t = now;
            broadcast(TOWNHALL.ID, {
              type: 'player_moved',
              id: bot.id,
              x: s.x,
              z: s.z,
              vx: 0,
              vz: 0,
              right: s.right,
              back: s.back,
            }, bot.id);
          }
        }
        continue;
      }

      // Pause finished -> pick next destination path along the plaza promenades
      chooseNextPath(bot);
    }
  }

  const timer = setInterval(() => {
    try {
      tick(Date.now());
    } catch {
      // keep ticker resilient
    }
  }, tickMs);

  return {
    botIds: TOWNHALL_BOT_DEFS.map((d) => d.id),
    botStates,
    tick,
    close() {
      clearInterval(timer);
    },
  };
}
