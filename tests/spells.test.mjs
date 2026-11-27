import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const game = load();
const { Rules, ArenaDuel, spells, spellTriggers, fighters } = game;
const stats = { str: 12, agi: 12, end: 12, mind: 12, cha: 12 };
const start = () => Rules.newRun({ name: 'Test', race: 'human', stats, seed: 42 });

const fighter = (name, extra, weapon, shield, armor) => ({
  name, level: 10, strength: 60, attack: 60, ranged: 60, magic: 55, defense: 15, maxHP: 190, color: [120, 80, 60], trim: [200, 200, 200], ...extra,
  gear: { weapon, reserve: 'none', shield, armor, spellbook: 'none', special: 'none' }
});
const play = (seed, hero, foe) => { ArenaDuel.setup(seed, [hero, foe]); return ArenaDuel.resolve(); };
const swordsman = fighter('A', {}, 'sword', 'round', 'leather');
const axeman = fighter('A', {}, 'axe', 'round', 'bronze');
const mauler = fighter('B', {}, 'maul', 'none', 'plate');

test('the pickers offer exactly the triggers and spells the engine knows', () => {
  assert.deepEqual(Rules.triggerKeys, Object.keys(spellTriggers));
  for (const key of Rules.spellPool) assert.ok(spells[key], key);
});

test('a fight saved without triggers replays as one left to their judgement', () => {
  const hero = { ...swordsman, spellList: ['ember', 'ward', 'heal'] };
  for (let seed = 1; seed <= 10; seed++) {
    const old = play(seed, hero, mauler);
    // A trigger from the last bout must not linger on the reused engine fighters.
    play(seed, { ...hero, triggers: { ember: 'ready', heal: 'hurt' } }, mauler);
    assert.deepEqual(play(seed, hero, mauler), old);
    assert.deepEqual(play(seed, { ...hero, triggers: { ember: 'auto', ward: 'auto' } }, mauler), old);
  }
});

test('the same seed with triggers gives the same fight', () => {
  const hero = { ...swordsman, spellList: ['drain', 'heal'], triggers: { drain: 'finish', heal: 'hurt' } };
  assert.deepEqual(play(99, hero, mauler), play(99, hero, mauler));
});

// Each pair was found on 100 seeds: [spell, hero, foe, the better trigger, the worse one].
const matchups = [
  ['drain', axeman, fighter('B', { maxHP: 260 }, 'mace', 'tower', 'plate'), 'ready', 'auto'],
  ['ember', swordsman, mauler, 'ready', 'finish'],
  ['heal', axeman, mauler, 'ready', 'hurt'],
  ['tailwind', swordsman, fighter('B', {}, 'spear', 'round', 'leather'), 'finish', 'auto']
];
for (const [spell, hero, foe, better, worse] of matchups) {
  test(spell + ': "' + better + '" wins more often than "' + worse + '"', () => {
    const rate = trigger => {
      let wins = 0;
      for (let n = 0; n < 100; n++) wins += play(n * 131 + 7, { ...hero, spellList: [spell], triggers: { [spell]: trigger } }, foe).won;
      return wins / 100;
    };
    const high = rate(better);
    const low = rate(worse);
    assert.ok(high - low >= .12, better + ' ' + high + ' against ' + worse + ' ' + low);
  });
}

// Steps through a bout and reports each cast the hero pays for.
function casts(seed, hero, foe) {
  ArenaDuel.setup(seed, [hero, foe]);
  const [me, rival] = fighters;
  const seen = {};
  const list = [];
  while (!ArenaDuel.result()) {
    ArenaDuel.advance(1 / 60);
    for (const key of hero.spellList) {
      if (me.cooldowns[key] && me.cooldowns[key] !== seen[key]) {
        seen[key] = me.cooldowns[key];
        list.push({ key, me: me.hp / me.maxHP, rival: rival.hp / rival.maxHP });
      }
    }
  }
  ArenaDuel.stop();
  return list;
}

test('a triggered spell stays in its slot until its moment', () => {
  for (const [trigger, side] of [['hurt', 'me'], ['finish', 'rival']]) {
    let total = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const cast of casts(seed, { ...swordsman, spellList: ['ember'], triggers: { ember: trigger } }, mauler)) {
        total++;
        assert.ok(cast[side] < .4, trigger + ' cast at ' + cast[side]);
      }
    }
    assert.ok(total > 0, trigger + ' never fired');
  }
});

test('when two triggers fire together, the first slot goes first', () => {
  const triggers = { ember: 'ready', frost: 'ready' };
  for (const spellList of [['ember', 'frost'], ['frost', 'ember']]) {
    assert.equal(casts(5, { ...swordsman, spellList, triggers }, mauler)[0].key, spellList[0]);
  }
});

test('Blood Pact never kills its caster', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const hero = { ...swordsman, maxHP: 40, spellList: ['pact', 'thunder'], triggers: { pact: 'ready', thunder: 'ready' } };
    ArenaDuel.setup(seed, [hero, mauler]);
    while (!ArenaDuel.result()) {
      ArenaDuel.advance(1 / 60);
      assert.ok(ArenaDuel.result() || fighters[0].hp > 0);
    }
  }
});

test('triggers are kept with the run and fixed in the saved fight', () => {
  const run = start();
  run.learned = ['ember', 'heal', 'ward'];
  run.spells = ['heal', 'ember'];
  Rules.setTrigger(run, 'heal', 'hurt');
  Rules.setTrigger(run, 'ward', 'ready');
  Rules.setTrigger(run, 'ember', 'nonsense');
  Rules.setTrigger(run, 'drain', 'ready');
  assert.deepEqual(Rules.heroConfig(run).triggers, { heal: 'hurt' });
  const pending = Rules.startFight(run, 'spar');
  Rules.setTrigger(run, 'heal', 'ready');
  assert.deepEqual(pending.hero.triggers, { heal: 'hurt' });
});

test('a save from before triggers still plays', () => {
  const run = start();
  delete run.triggers;
  run.learned = run.spells = ['ember'];
  assert.deepEqual(Rules.heroConfig(run).triggers, {});
  Rules.setTrigger(run, 'ember', 'finish');
  assert.deepEqual(Rules.heroConfig(run).triggers, { ember: 'finish' });
});

test('the market sells one spell page in each act after the first', () => {
  const run = start();
  run.gold = 1000;
  assert.equal(Rules.buyPage(run), false, 'none in the first act');
  run.act = 1;
  const cost = Rules.pageCost(run);
  assert.ok(Rules.buyPage(run));
  assert.equal(run.gold, 1000 - cost);
  assert.equal(run.spellChoices.length, 3);
  assert.ok(Rules.learnSpell(run, run.spellChoices[0]));
  assert.equal(Rules.buyPage(run), false, 'only one per act');
  run.act = 2;
  assert.ok(Rules.pageCost(run) > cost);
  assert.ok(Rules.buyPage(run));
});
