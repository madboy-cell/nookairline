// scratch sweep: start gauge & rate overrides at bond Lv1
import { createMatch, roll, decide, ultimate, drainEvents } from '../shared/monopoly_engine.js';
import { botAction } from '../shared/monopoly_bots.js';

export function sweep({ n = 1500, start = 0, rate = 0.55, startCash = [0, 0, 0, 0], ult = [0, 0, 0, 0] } = {}) {
  let combos = 0, solos = 0; const wins = [0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    const m = createMatch({ players: [0, 1, 2, 3].map((s) => ({ id: `h${s}`, isBot: false, petId: 'pet_ragdoll', petBond: 1 })), seed: 1 + k * 7919 });
    for (const p of m.players) { p.petUlt = start; p.petRate = rate; p.cash += startCash[p.seat]; p.ult += ult[p.seat]; }
    drainEvents(m);
    let st = 0;
    while (!m.ended && st++ < 20000) {
      const s = m.turn.seat; const a = botAction(m, s, 'hard');
      a.type === 'roll' ? roll(m, s, a) : a.type === 'ultimate' ? ultimate(m, s) : decide(m, s, { choice: a.choice });
      for (const e of drainEvents(m)) { if (e.t === 'pet_combo') combos++; else if (e.t === 'ult' && e.byPet) solos++; }
    }
    wins[m.result.winner]++;
  }
  return { start, rate, combos: +(combos / n / 4).toFixed(3), solos: +(solos / n / 4).toFixed(3), win: wins.map((w) => +(w / n).toFixed(3)) };
}

const mode = process.argv[2];
if (mode === 'gauge') for (const start of [0, 25, 40, 50]) for (const rate of [0.55, 0.7]) console.log(JSON.stringify(sweep({ start, rate })));
if (mode === 'seat') for (const d of [0, 100, 150, 200, 250]) console.log(d, JSON.stringify(sweep({ startCash: [0, d, 2 * d, 3 * d] }).win));
if (mode === 'seatult') for (const d of [0, 10, 20]) console.log(d, JSON.stringify(sweep({ ult: [0, d, 2 * d, 3 * d] }).win));
