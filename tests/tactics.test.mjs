import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';

const game = load();
const { Rules, ArenaDuel, tactics, aimZones, fighters } = game;
const stats = { str: 12, agi: 12, end: 12, mind: 12, cha: 12 };
const start = () => Rules.newRun({ name: 'Test', race: 'human', stats, seed: 42 });

const fighter = (name, extra, weapon, shield, armor) => ({
  name, level: 10, strength: 60, attack: 60, ranged: 60, magic: 40, defense: 15, maxHP: 190, color: [120, 80, 60], trim: [200, 200, 200], ...extra,
  gear: { weapon, reserve: 'none', shield, armor, spellbook: 'none', special: 'none' }
});
const play = (seed, hero, foe) => { ArenaDuel.setup(seed, [hero, foe]); return ArenaDuel.resolve(); };

test('the pickers offer exactly what the engine knows', () => {
  assert.deepEqual(Rules.tacticKeys, Object.keys(tactics));
  assert.deepEqual(Rules.aimKeys, Object.keys(aimZones));
});

test('a fight saved without a stance or target replays as a balanced one', () => {
  const hero = fighter('A', {}, 'sword', 'round', 'leather');
  const foe = fighter('B', {}, 'axe', 'buckler', 'bronze');
  for (let seed = 1; seed <= 10; seed++) {
    const old = play(seed, hero, foe);
    // A stance from the last bout must not linger on the reused engine fighters.
    play(seed, { ...hero, tactic: 'aggressive', aimAt: 'head', pace: .88 }, foe);
    assert.deepEqual(play(seed, hero, foe), old);
    assert.deepEqual(play(seed, { ...hero, tactic: 'balanced', aimAt: 'any', pace: 1 }, foe), old);
  }
});

test('the same seed with a stance and target gives the same fight', () => {
  const hero = fighter('A', { tactic: 'defensive', aimAt: 'leg' }, 'spear', 'round', 'leather');
  const foe = fighter('B', {}, 'mace', 'round', 'plate');
  assert.deepEqual(play(99, hero, foe), play(99, hero, foe));
});

// Each matchup was checked on 200 other seeds when the stances were tuned.
const matchups = {
  balanced: [fighter('A', { maxHP: 250 }, 'crossbow', 'buckler', 'fortress'),
    fighter('B', { maxHP: 130, strength: 80, attack: 80 }, 'mace', 'buckler', 'plate')],
  aggressive: [fighter('A', { defense: 35, attack: 45, strength: 45 }, 'maul', 'none', 'plate'),
    fighter('B', { maxHP: 290, strength: 45, defense: 20 }, 'crossbow', 'none', 'leather')],
  defensive: [fighter('A', { strength: 90, attack: 70 }, 'club', 'none', 'rags'), fighter('B', {}, 'sword', 'tower', 'plate')]
};
for (const [best, [hero, foe]] of Object.entries(matchups)) {
  test('only the ' + best + ' stance wins its matchup', () => {
    for (const tactic of Object.keys(tactics)) {
      let wins = 0;
      for (let n = 0; n < 300; n++) wins += play(n * 131 + 7, { ...hero, tactic }, foe).won;
      const rate = wins / 300;
      if (tactic === best) assert.ok(rate > .5, tactic + ' wins ' + rate.toFixed(2));
      else assert.ok(rate < .45, tactic + ' wins ' + rate.toFixed(2));
    }
  });
}

test('a target moves the damage to that part', () => {
  const share = (aimAt, zone) => {
    let on = 0;
    let all = 0;
    for (let n = 0; n < 30; n++) {
      play(n * 131 + 3, fighter('A', { aimAt }, 'spear', 'round', 'leather'), fighter('B', {}, 'spear', 'round', 'leather'));
      const zones = fighters[1].zoneDamage;
      on += zones[zone];
      all += Object.values(zones).reduce((sum, value) => sum + value, 0);
    }
    return on / all;
  };
  for (const zone of ['head', 'body', 'arm', 'leg']) {
    assert.ok(share(zone, zone) > share('any', zone) + .1, zone + ' ' + share(zone, zone).toFixed(2) + ' against ' + share('any', zone).toFixed(2));
  }
});

test('the chosen stance and target are fixed in the saved fight', () => {
  const run = start();
  Rules.setTactic(run, 'defensive');
  Rules.setAim(run, 'leg');
  Rules.setTactic(run, 'nonsense');
  const pending = Rules.startFight(run, 'spar');
  assert.equal(pending.hero.tactic, 'defensive');
  assert.equal(pending.hero.aimAt, 'leg');
  Rules.setTactic(run, 'aggressive');
  assert.equal(run.pending.hero.tactic, 'defensive');
});

test('a save from before stances and wounds still plays', () => {
  const run = start();
  delete run.tactic;
  delete run.aimAt;
  delete run.wounds;
  const hero = Rules.heroConfig(run);
  assert.equal(hero.tactic, 'balanced');
  assert.equal(hero.aimAt, 'any');
  assert.ok(Rules.rest(run));
  Rules.startFight(run, 'spar');
  Rules.finishFight(run, { won: true, health: .1, worst: 'arm' });
  assert.deepEqual(Rules.woundsOf(run).map(wound => wound.part), ['arm']);
});

test('a bout that ends badly leaves a wound with a cost', () => {
  const healthy = Rules.heroConfig(start());
  const cuts = { head: 'attack', arm: 'strength', body: 'maxHP', leg: 'pace' };
  for (const [part, stat] of Object.entries(cuts)) {
    const run = start();
    Rules.startFight(run, 'blood');
    Rules.finishFight(run, { won: true, health: .1, worst: part });
    const hurt = Rules.heroConfig({ ...run, wins: 0 });
    assert.ok(hurt[stat] < (healthy[stat] ?? 1), part + ' lowers ' + stat);
  }
  const unhurt = start();
  Rules.startFight(unhurt, 'blood');
  Rules.finishFight(unhurt, { won: true, health: .6, worst: 'head' });
  assert.deepEqual(unhurt.wounds, []);
});

test('wounds last for days, rest heals them faster and a surgeon costs gold', () => {
  const run = start();
  Rules.startFight(run, 'spar');
  Rules.finishFight(run, { won: false, health: 0, worst: 'leg' });
  assert.equal(run.wounds[0].days, Rules.woundDays);
  Rules.work(run);
  assert.equal(run.wounds[0].days, Rules.woundDays - 1);
  Rules.rest(run);
  assert.equal(run.wounds[0].days, Rules.woundDays - 3);
  run.gold = 0;
  assert.equal(Rules.treat(run, 'leg'), false);
  run.gold = 500;
  assert.ok(Rules.treat(run, 'leg'));
  assert.equal(run.gold, 500 - Rules.surgeonCost(run));
  assert.deepEqual(run.wounds, []);
  Rules.startFight(run, 'spar');
  Rules.finishFight(run, { won: false, health: 0, worst: 'body' });
  for (let day = 0; day < Rules.woundDays / 2; day++) Rules.rest(run);
  assert.deepEqual(run.wounds, []);
});

test('an aggressive axe never starts a cleave it cannot pay for', () => {
  let cleaves = 0;
  for (let n = 0; n < 40; n++) {
    ArenaDuel.setup(n * 131 + 5, [fighter('A', { tactic: 'aggressive', strength: 80 }, 'axe', 'round', 'leather'), fighter('B', {}, 'sword', 'round', 'plate')]);
    let seen = null;
    let energy = fighters[0].energy;
    for (let step = 0; step < 11000 && !ArenaDuel.result(); step++) {
      ArenaDuel.advance(1 / 60);
      const action = fighters[0].action;
      if (action && action !== seen && action.mode?.heavy) {
        cleaves++;
        // Energy can only have grown since the last step, and only by one step of recovery.
        assert.ok(energy + .2 >= action.cost, 'cleave costs ' + action.cost + ' with ' + energy.toFixed(1));
      }
      seen = action;
      energy = fighters[0].energy;
    }
  }
  assert.ok(cleaves > 0);
});
