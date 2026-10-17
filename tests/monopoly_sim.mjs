// tests/monopoly_sim.mjs — seeded Sky Monopoly bot simulator for the Dopamine Patch (Soul-Link Combo / Chaos).
// Not part of `npm test` (no .test.js suffix): run `node tests/monopoly_sim.mjs [matches] [bond] [mode]`.
// Also imported by tests/monopoly_dopamine.test.js with a smaller N.
import { createMatch, roll, decide, ultimate, drainEvents } from '../shared/monopoly_engine.js';
import { botAction } from '../shared/monopoly_bots.js';

/**
 * Plays `n` seeded 4-seat matches. Every seat is a "human" (isBot:false, Auto pet) piloted by the Hard policy,
 * so seat order is the only asymmetry. Returns aggregate stats.
 */
export function simulate({ n = 1000, bond = 1, mode = 'normal', seed0 = 1, seats = 4, diff = 'hard', publicTable = false } = {}) {
  const wins = Array(seats).fill(0);
  let combos = 0, solos = 0, humans = 0, ended = 0, rounds = 0, chaosEvents = 0, turns = 0, ownerUlts = 0;
  const comboHist = {};
  for (let k = 0; k < n; k++) {
    const players = Array.from({ length: seats }, (_, s) => ({
      id: `h${s}`, name: `H${s}`, isBot: false, petId: 'pet_ragdoll', petBond: bond, petAuto: true,
    }));
    const m = createMatch({ players, seed: seed0 + k * 7919, mode, publicTable });
    let steps = 0;
    const tally = (evs) => {
      for (const e of evs) {
        if (e.t === 'pet_combo') combos++;
        else if (e.t === 'ult' && e.byPet) solos++;
        else if (e.t === 'ult') ownerUlts++;
        else if (e.t === 'chaos_event') chaosEvents++;
        else if (e.t === 'turn') turns++;
      }
    };
    tally(drainEvents(m));
    while (!m.ended && steps++ < 20000) {
      const s = m.turn.seat;
      const a = botAction(m, s, diff);
      if (!a) throw new Error(`no action (phase ${m.phase})`);
      const r = a.type === 'roll' ? roll(m, s, a) : a.type === 'ultimate' ? ultimate(m, s) : decide(m, s, { choice: a.choice });
      if (!r.ok) throw new Error(`action failed ${r.error}`);
      tally(drainEvents(m));
    }
    if (m.ended) ended++;
    rounds += m.round;
    wins[m.result?.winner ?? 0]++;
    humans += seats;
    for (const p of m.players) comboHist[p.petCombos] = (comboHist[p.petCombos] || 0) + 1;
  }
  const winRate = wins.map((w) => w / n);
  return {
    n, bond, mode, ended, avgRounds: +(rounds / n).toFixed(2), avgTurns: +(turns / n).toFixed(1),
    combosPerHuman: +(combos / humans).toFixed(3), solosPerHuman: +(solos / humans).toFixed(3),
    ownerUltsPerHuman: +(ownerUlts / humans).toFixed(3),
    pctWithCombo: +(1 - (comboHist[0] || 0) / humans).toFixed(3), comboHist,
    winRate: winRate.map((x) => +x.toFixed(3)),
    maxSeatSkew: +Math.max(...winRate.map((x) => Math.abs(x - 1 / seats))).toFixed(3),
    chaosEventsPerMatch: +(chaosEvents / n).toFixed(2),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [nArg, bondArg, modeArg] = process.argv.slice(2);
  console.log(JSON.stringify(simulate({ n: Number(nArg) || 1000, bond: Number(bondArg) || 1, mode: modeArg || 'normal' })));
}
