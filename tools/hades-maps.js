// Headless bouts on every map with random champion loadouts, the way the page shuffles them.
// Reports bout length, stalls (no winner by 240 s) and how often each side wins, 1v1 and 2v2.
// Run: node tools/hades-maps.js [bouts per map and mode] [map]
const { kits, weapons, maps = { temple: {} } } = require('../hades/data.js');
const { createBattle, step } = require('../hades/sim.js');

const rounds = Number(process.argv[2]) || 200;
const only = process.argv[3];
const champions = Object.keys(kits).filter(key => kits[key].champion);
const armors = ['leather', 'segmentata', 'cuirass', 'pelt'];
const weaponKeys = Object.keys(weapons);

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadout(random) {
  const pick = list => list[Math.floor(random() * list.length)];
  const weapon = pick(weaponKeys);
  return { kit: pick(champions), weapon, reserve: pick(weaponKeys.filter(key => key !== weapon)), armor: pick(armors) };
}

for (const map of Object.keys(maps).filter(key => !only || key === only)) {
  for (const size of [1, 2]) {
    const lengths = [], wins = [0, 0], styleWins = {};
    let stalls = 0;
    for (let i = 0; i < rounds; i++) {
      const random = seeded(i * 7919 + size);
      const lineup = [];
      for (let k = 0; k < size; k++) for (const team of [0, 1]) lineup.push({ entry: loadout(random), team, name: `${team}${k}` });
      const duel = createBattle(lineup, i + 1, map);
      while (duel.winner === null && duel.time < 240) {
        step(duel, 1 / 60);
        duel.events.length = 0;
      }
      lengths.push(duel.time);
      if (duel.winner === null) { stalls++; continue; }
      wins[duel.winner]++;
      if (size === 1) {
        const style = f => weapons[f.kit.weapon].style;
        const [won, lost] = duel.winner ? [duel.fighters[1], duel.fighters[0]] : duel.fighters;
        if (style(won) !== style(lost)) styleWins[style(won) + '>' + style(lost)] = (styleWins[style(won) + '>' + style(lost)] || 0) + 1;
      }
    }
    lengths.sort((x, y) => x - y);
    const at = q => lengths[Math.floor(q * (lengths.length - 1))].toFixed(1);
    console.log(`${map.padEnd(8)} ${size}v${size}: ${rounds} bouts, median ${at(.5)}s p90 ${at(.9)}s max ${at(1)}s, stalls ${stalls}, `
      + `red ${(100 * wins[0] / rounds).toFixed(0)}% blue ${(100 * wins[1] / rounds).toFixed(0)}%`
      + (size === 1 ? ' ' + JSON.stringify(styleWins) : ''));
  }
}
