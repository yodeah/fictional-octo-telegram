import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';
import { playRun } from './bot.mjs';

const game = load();
const { Rules } = game;
const copy = value => JSON.parse(JSON.stringify(value));
const stats = { str: 12, agi: 12, end: 12, mind: 12, cha: 12 };
const start = (cha = 10, extra = {}) => Object.assign(Rules.newRun({ name: 'Test', race: 'elf', stats: { ...stats, cha }, seed: 42 }), extra);
const bout = (run, kind, result, change = () => {}) => {
  Rules.startFight(run, kind);
  change(run.pending);
  return Rules.finishFight(run, { won: true, health: .6, time: 20, ...result });
};

test('a pleased crowd pays more than a jeering one', () => {
  const paid = favour => {
    const run = start(10, { favour });
    bout(run, 'spar', {});
    return run.gold - 40;
  };
  assert.ok(paid(90) > paid(50) && paid(50) > paid(10), [paid(10), paid(50), paid(90)].join());
});

test('the crowd likes boldness and a close call, and is bored by caution', () => {
  const run = start();
  const win = { won: true, health: .6, time: 20 };
  const cheer = (tactic, result = win) => Rules.cheer(run, 'blood', tactic, result);
  assert.ok(cheer('aggressive') > cheer('balanced') && cheer('balanced') > cheer('defensive'));
  assert.ok(cheer('balanced', { ...win, health: .1 }) > cheer('balanced'));
  assert.ok(cheer('balanced', { ...win, time: 90 }) < cheer('balanced'));
  assert.ok(cheer('balanced', { won: false, health: 0, time: 20 }) < 0);
});

test('favour decides mercy: a booed gladiator can die at the first fall, a loved one be spared twice', () => {
  const fall = (favour, mercy, spare) => {
    const run = start(10, { favour, mercy, gold: 100 });
    bout(run, 'blood', { won: false, health: 0 }, pending => { pending.spare = spare; });
    return run;
  };
  assert.equal(fall(50, true, .99).over, null);
  assert.equal(fall(7, true, .5).over, 'dead');
  assert.equal(fall(7, true, .1).over, null);
  assert.equal(fall(50, false, 0).over, 'dead');
  const loved = fall(95, false, .1);
  assert.equal(loved.over, null);
  // Their love is spent doing it.
  assert.ok(Rules.mercyChance(loved) === 0 && Rules.favourOf(loved) < 35);
});

test('the crowd’s answer is saved with the fight, from its own dice', () => {
  const run = start();
  const lazy = copy(run);
  const pending = Rules.startFight(run, 'blood');
  assert.ok(pending.spare >= 0 && pending.spare < 1);
  assert.deepEqual(copy(run).pending, pending);
  // The foes and fight seeds are what they would have been without the crowd.
  const seed = Rules.startFight(lazy, 'blood').seed;
  assert.equal(seed, pending.seed);
});

test('a save and a fight from before the crowd still play as they did', () => {
  const run = start();
  Rules.startFight(run, 'blood');
  delete run.favour;
  delete run.crowd;
  delete run.pending.spare;
  Rules.finishFight(run, { won: false, health: 0 });
  assert.equal(run.over, null);
  assert.equal(run.mercy, false);
});

test('quiet days let the crowd forget', () => {
  const run = start(10, { favour: 80 });
  Rules.rest(run);
  assert.equal(Rules.favourOf(run), 77);
  Object.assign(run, { favour: 49 });
  Rules.work(run);
  assert.equal(Rules.favourOf(run), 50);
});

test('Charm cuts prices and wins mercy; a feared face draws bigger purses to the death', () => {
  const fair = start(17, { favour: 40, act: 1 });
  const grim = start(5, { favour: 40, act: 1 });
  assert.ok(Rules.price(fair, 'plate') < Rules.price(grim, 'plate'));
  assert.ok(Rules.surgeonCost(fair) < Rules.surgeonCost(grim));
  assert.ok(Rules.pageCost(fair) < Rules.pageCost(grim));
  assert.ok(Rules.winnings(grim, 'blood') > Rules.winnings(fair, 'blood'));
  assert.equal(Rules.winnings(grim, 'spar'), Rules.winnings(fair, 'spar'));
  fair.favour = grim.favour = 20;
  assert.ok(Rules.mercyChance(fair) > Rules.mercyChance(grim));
});

test('neither Charm is richer whatever you do', () => {
  // A season of buying favours the charming; a season of fighting to the death favours the feared.
  const net = (cha, kind, fights, shopping) => {
    const run = start(cha, { act: 2, gold: 2000 });
    for (let i = 0; i < fights; i++) run.gold += Rules.winnings(run, kind);
    for (const key of shopping) Rules.buy(run, key);
    return run.gold;
  };
  const kit = ['greatsword', 'fortress', 'tower', 'maul', 'halberd', 'nightHide'];
  assert.ok(net(17, 'spar', 3, kit) > net(5, 'spar', 3, kit));
  assert.ok(net(5, 'blood', 10, ['sword']) > net(17, 'blood', 10, ['sword']));
});

test('neither a high nor a low Charm build always gets further with the test bot', () => {
  // Over 30 seeds each build got further on some. One seed of each stands for them here.
  const progress = (seed, charm) => {
    const run = playRun(game, { seed, smart: true, race: ['human', 'elf', 'demon'][seed % 3], charm });
    return run.over === 'won' ? 5 : run.act;
  };
  const low = 5;
  const high = 16;
  assert.ok(progress(4, high) > progress(4, low), 'seed 4 favours high Charm');
  assert.ok(progress(1, low) > progress(1, high), 'seed 1 favours low Charm');
});
