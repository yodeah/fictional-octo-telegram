import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const game = load();
const { Rules, ArenaDuel } = game;
const copy = value => JSON.parse(JSON.stringify(value));
const stats = { str: 12, agi: 12, end: 12, mind: 12, cha: 12 };
const start = (seed = 42) => Rules.newRun({ name: 'Test', race: 'human', stats, seed });
const duel = (seed, first, second) => { ArenaDuel.setup(seed, [first, second]); return ArenaDuel.resolve().won; };
const rich = (seed = 42) => Object.assign(start(seed), { gold: 500 });
// A bout and side the bookmaker takes bets on.
const open = run => {
  for (const bout of Rules.billFor(run)) {
    const side = Rules.bookOdds(bout, duel).findIndex(Boolean);
    if (side >= 0) return { bout, side };
  }
};

test('the bill is fixed for the day and has its own dice', () => {
  const run = start();
  const rng = run.rng;
  const bill = Rules.billFor(run);
  assert.equal(run.rng, rng);
  assert.deepEqual(bill.map(bout => bout.key), ['champion', 'undercard']);
  assert.equal(bill[0].fighters[0].name, Rules.champions[0].name);
  assert.deepEqual(Rules.billFor(copy(run)), bill);
  Rules.rest(run);
  assert.notDeepEqual(Rules.billFor(run)[1], bill[1]);
});

test('looking at the stands changes nothing a run would get', () => {
  const looked = start();
  const ignored = start();
  Rules.billFor(looked);
  for (const run of [looked, ignored]) {
    Rules.startFight(run, 'blood');
    Rules.finishFight(run, { won: true, health: .8 });
  }
  delete looked.sands;
  assert.deepEqual(looked, ignored);
});

test('a bet and its result are saved before the bout is shown, so reloading changes nothing', () => {
  const run = rich();
  const { bout, side } = open(run);
  const before = copy(run);
  const pending = Rules.startWatch(run, bout.key, duel, side, 10);
  assert.equal(run.gold, 490);
  assert.equal(pending.winner, duel(bout.seed, ...bout.fighters) ? 0 : 1);
  // A reload keeps the same bout and bet, and nothing else can happen first.
  const reloaded = copy(run);
  assert.deepEqual(reloaded.pending, run.pending);
  assert.equal(Rules.startWatch(reloaded, bout.key, duel, 1 - side, 10), null);
  assert.equal(Rules.startFight(reloaded, 'spar'), null);
  assert.equal(Rules.rest(reloaded), null);
  assert.equal(Rules.train(reloaded, 'skill'), null);
  // The stored result pays, whatever the replay is told.
  Rules.finishFight(reloaded, { won: false, health: 0 });
  assert.equal(reloaded.gold, pending.winner === side ? 490 + Math.floor(10 * pending.pays) : 490);
  assert.equal(reloaded.day, before.day + 1);
  assert.equal(reloaded.fights, 0);
  // Even a save from before the bet gives the same winner.
  assert.equal(Rules.startWatch(before, bout.key, duel, 1 - side, 0).winner, pending.winner);
});

test('stakes stay within a day’s wage and the purse', () => {
  const run = rich();
  const { bout, side } = open(run);
  assert.equal(Rules.maxStake(run), Rules.wage(run));
  assert.equal(Rules.startWatch(run, bout.key, duel, side, Rules.wage(run) + 1), null);
  assert.equal(Rules.startWatch(run, bout.key, duel, side, -5), null);
  assert.equal(Rules.startWatch(run, bout.key, duel, 2, 5), null);
  run.gold = 3;
  assert.equal(Rules.maxStake(run), 3);
  assert.equal(run.pending, null);
  assert.ok(Rules.startWatch(run, 'champion', duel));
});

test('watching the champion reveals them; the undercard and the Peddler do not teach habits', () => {
  const run = start();
  Rules.startWatch(run, 'undercard', duel);
  Rules.finishFight(run);
  assert.equal(Rules.scoutedOf(run), false);
  run.visitor = { key: 'peddler' };
  Rules.acceptBargain(run);
  assert.equal(Rules.scoutedOf(run), false);
  Rules.startWatch(run, 'champion', duel);
  const events = Rules.finishFight(run);
  assert.ok(Rules.scoutedOf(run));
  assert.ok(events.some(event => event.includes('studied')));
  assert.equal(Rules.scoutedOf(run, 1), false);
  for (const champion of Rules.champions) assert.ok(champion.habits);
  const advice = Rules.study(run, duel);
  assert.ok(Rules.tacticKeys.includes(advice.tactic) && Rules.aimKeys.includes(advice.aimAt));
});

test('a save from before the stands can watch', () => {
  const run = start();
  delete run.sands;
  delete run.scouted;
  const reloaded = copy(run);
  assert.deepEqual(Rules.billFor(run), Rules.billFor(reloaded));
  assert.ok(Rules.startWatch(run, 'champion', duel));
});

test('betting is no reliable way to farm gold', () => {
  const returns = {};
  let days = 0;
  let sharpProfit = 0;
  let sharpWages = 0;
  for (let act = 0; act < 4; act++) {
    const run = start(act * 977 + 11);
    run.act = act;
    run.gold = 1000;
    for (run.day = 1; run.day <= 14; run.day++) {
      days++;
      sharpWages += Rules.wage(run);
      let best = 0;
      for (const bout of Rules.billFor(run)) {
        const odds = Rules.bookOdds(bout, duel);
        const winner = duel(bout.seed, ...bout.fighters) ? 0 : 1;
        const bet = (name, side) => {
          if (!odds[side]) return;
          returns[name] = returns[name] || [0, 0];
          returns[name][0]++;
          returns[name][1] += side === winner ? odds[side] : 0;
        };
        const favourite = (odds[0] ?? 1) <= (odds[1] ?? 1) ? 0 : 1;
        const strength = config => config.maxHP * (config.strength + config.attack);
        bet('favourite', favourite);
        bet('underdog', 1 - favourite);
        bet('first', 0);
        bet('second', 1);
        bet('bigger numbers', strength(bout.fighters[0]) >= strength(bout.fighters[1]) ? 0 : 1);
        // A bettor who can somehow try the bout as often as the bookmaker, on other seeds.
        let wins = 0;
        for (let i = 0; i < 40; i++) wins += duel(900000 + i * 733, ...bout.fighters) ? 1 : 0;
        for (const side of [0, 1]) {
          const chance = (side ? 40 - wins : wins) / 40;
          if (odds[side]) best = Math.max(best, chance * odds[side] - 1);
        }
      }
      sharpProfit += best * Rules.wage(run);
    }
  }
  for (const [name, [bets, paid]] of Object.entries(returns)) {
    assert.ok(bets > 20, name + ' bets ' + bets);
    assert.ok(paid / bets < 1, name + ' returns ' + (paid / bets).toFixed(2));
  }
  // Even picking the best bet each day, at full stake, earns far less than the wage that day would have paid.
  assert.ok(sharpProfit < sharpWages / 2, 'expected ' + (sharpProfit / days).toFixed(1) + ' a day against a wage of ' + (sharpWages / days).toFixed(1));
});
