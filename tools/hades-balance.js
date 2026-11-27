// Headless bouts for the 2.5D arena: win rates, bout length and stalls per kit.
// Run: node tools/hades-balance.js [bouts per pairing]
const { kits } = require('../hades/data.js');
const { createDuel, step } = require('../hades/sim.js');
const { weapons } = require('../hades/data.js');

const rounds = Number(process.argv[2]) || 40;
const keys = Object.keys(kits);
const wins = Object.fromEntries(keys.map(k => [k, 0]));
const played = { ...wins };
const styleWins = {};
const lengths = [];
let stalls = 0, escapes = 0, seed = 1;

for (const a of keys) for (const b of keys) {
  if (a >= b) continue;
  for (let i = 0; i < rounds; i++) {
    const duel = createDuel(...(i % 2 ? [b, a] : [a, b]), seed++);
    while (duel.winner === null && duel.time < 150) {
      step(duel, 1 / 60);
      duel.events.length = 0;
    }
    lengths.push(duel.time);
    escapes += duel.fighters[0].escapes + duel.fighters[1].escapes;
    played[a]++; played[b]++;
    if (duel.winner === null) { stalls++; continue; }
    const won = duel.fighters[duel.winner].kitKey, lost = duel.fighters[1 - duel.winner].kitKey;
    wins[won]++;
    const pair = [weapons[kits[won].weapon].style, weapons[kits[lost].weapon].style];
    if (pair[0] !== pair[1]) styleWins[pair.join('>')] = (styleWins[pair.join('>')] || 0) + 1;
  }
}

lengths.sort((x, y) => x - y);
const at = q => lengths[Math.floor(q * (lengths.length - 1))].toFixed(1);
console.log(`${lengths.length} bouts, length p10 ${at(.1)}s median ${at(.5)}s p90 ${at(.9)}s, stalls ${stalls}`);
console.log(`escapes per bout ${(escapes / lengths.length).toFixed(1)}`);
for (const k of keys.sort((x, y) => wins[y] / played[y] - wins[x] / played[x])) {
  console.log(`${kits[k].name.padEnd(14)} ${(100 * wins[k] / played[k]).toFixed(0)}%`);
}
console.log('cross-style wins', styleWins);
