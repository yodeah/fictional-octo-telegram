// Prints how often each bot finishes, for tuning. Usage: node tests/report.mjs [runs]
import { load } from './harness.mjs';
import { playRun } from './bot.mjs';

const game = load();
const runs = Number(process.argv[2] || 30);
for (const smart of [true, false]) {
  const results = [];
  const started = Date.now();
  for (let seed = 1; seed <= runs; seed++) results.push(playRun(game, { seed, smart, race: ['human', 'elf', 'demon'][seed % 3] }));
  const tally = results.reduce((all, r) => (all[r.over] = (all[r.over] || 0) + 1, all), {});
  const average = pick => (results.reduce((sum, r) => sum + pick(r), 0) / results.length).toFixed(1);
  const wins = results.filter(r => r.over === 'won');
  console.log(smart ? 'SENSIBLE' : 'RANDOM', tally, 'avg act', average(r => r.act), 'days', average(r => r.day), 'fights', average(r => r.fights),
    'bout seconds', (results.reduce((s, r) => s + r.seconds, 0) / Math.max(1, results.reduce((s, r) => s + r.fights, 0))).toFixed(1),
    'winner fights', wins.length ? (wins.reduce((s, r) => s + r.fights, 0) / wins.length).toFixed(1) : '-');
  for (const kind of ['spar', 'blood', 'champion']) {
    const total = results.reduce((s, r) => s + r.kinds[kind], 0);
    console.log('  ', kind, total, 'win rate', total ? (1 - results.reduce((s, r) => s + r.losses[kind], 0) / total).toFixed(2) : '-');
  }
  const struck = {};
  for (const result of results) for (const [key, [yes, no]] of Object.entries(result.bargains)) {
    struck[key] = struck[key] || [0, 0];
    struck[key][0] += yes;
    struck[key][1] += no;
  }
  console.log('   bargains [accepted, refused]', JSON.stringify(struck));
  console.log('   ms', Date.now() - started);
}
