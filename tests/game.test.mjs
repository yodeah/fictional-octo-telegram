import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';
import { playRun } from './bot.mjs';
import { weaponRates } from './weapons.mjs';

const game = load();
const { Rules, ArenaDuel, specials, weapons } = game;
const stats = { str: 12, agi: 12, end: 12, mind: 12, cha: 12 };
const start = (extra = {}) => Rules.newRun({ name: 'Test', race: 'human', stats, seed: 42, ...extra });

test('dice stay between 3 and 18', () => {
  for (let i = 0; i < 200; i++) {
    for (const value of Object.values(Rules.rollStats())) assert.ok(value >= 3 && value <= 18);
  }
});

test('a new gladiator has no mana and little gear', () => {
  const run = start();
  assert.deepEqual(Rules.heroConfig(run).spellList, []);
  assert.deepEqual(run.inventory, ['club']);
});

test('races differ, each with a cost', () => {
  const elf = start({ race: 'elf' });
  const demon = start({ race: 'demon' });
  assert.ok(Rules.heroConfig(elf).maxHP < Rules.heroConfig(start()).maxHP);
  assert.ok(Rules.heroConfig(demon).lifesteal > 0);
  assert.ok(Rules.price(demon, 'sword') > Rules.price(start(), 'sword'));
});

test('every shop item, trophy and champion refers to real engine gear', () => {
  for (const key of Object.keys(Rules.catalog)) {
    const slot = Rules.slotOf(key);
    assert.ok(game[slot === 'weapon' ? 'weapons' : slot === 'shield' ? 'shields' : 'armors'][key], key);
  }
  for (const [key, weapon] of Object.entries(Rules.trophies)) assert.equal(specials[key].weapon, weapon);
  Rules.champions.forEach((champion, i) => assert.ok(weapons[Rules.championConfig(i).gear.weapon], champion.name));
});

test('the same seed and fighters give the same fight', () => {
  const run = start();
  const pending = Rules.startFight(run, 'blood');
  const play = () => { ArenaDuel.setup(pending.seed, [pending.hero, pending.foe]); return ArenaDuel.resolve(); };
  assert.deepEqual(play(), play());
});

test('a saved fight survives a reload unchanged and blocks day actions', () => {
  const run = start();
  Rules.startFight(run, 'spar');
  const reloaded = JSON.parse(JSON.stringify(run));
  assert.deepEqual(reloaded.pending, run.pending);
  assert.equal(Rules.rest(reloaded), null);
  assert.equal(Rules.startFight(reloaded, 'blood'), null);
});

test('sparring never kills; blood bouts spare you once', () => {
  const run = start();
  const lose = kind => { Rules.startFight(run, kind); Rules.finishFight(run, { won: false, health: 0 }); };
  lose('spar');
  lose('spar');
  assert.equal(run.over, null);
  lose('blood');
  assert.equal(run.over, null);
  lose('blood');
  assert.equal(run.over, 'dead');
});

test('missing the debt twice ends the run', () => {
  const run = start();
  run.gold = 0;
  for (let day = 0; day < 10; day++) {
    run.gold = 0;
    Rules.rest(run);
  }
  assert.equal(run.over, 'sold');
});

test('champions fall in order, teach spells and end the game', () => {
  const run = start();
  assert.equal(Rules.startFight(run, 'champion'), null, 'needs renown first');
  for (let act = 0; act < 4; act++) {
    run.renown = Rules.renownNeeded[act];
    Rules.startFight(run, 'champion');
    Rules.finishFight(run, { won: true, health: .5 });
    if (act < 3) assert.ok(Rules.learnSpell(run, run.spellChoices[0]));
  }
  assert.equal(run.over, 'won');
  assert.equal(run.spells.length, 3);
});

test('a Legacy start keeps its owed spells', () => {
  const run = start({ startAct: 2 });
  Rules.learnSpell(run, run.spellChoices[0]);
  Rules.learnSpell(run, run.spellChoices[0]);
  assert.equal(run.spells.length, 2);
  assert.equal(run.spellChoices, null);
});

test('no shop weapon is far ahead or behind', () => {
  for (const [key, rate] of weaponRates(game, 12)) assert.ok(rate > .3 && rate < .7, key + ' wins ' + rate.toFixed(2));
});

// Slow: whole runs through the real combat engine.
test('good choices can beat the game and random ones cannot', () => {
  const play = smart => Array.from({ length: 10 }, (_, i) => playRun(game, { seed: i + 1, smart, race: ['human', 'elf', 'demon'][i % 3] }));
  const sensible = play(true).filter(run => run.over === 'won').length;
  const random = play(false).filter(run => run.over === 'won').length;
  assert.ok(sensible >= 4, 'sensible player won ' + sensible + ' of 10');
  assert.ok(random <= 1, 'random player won ' + random + ' of 10');
});
