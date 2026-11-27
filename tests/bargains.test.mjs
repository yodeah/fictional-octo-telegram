import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.mjs';
import { wouldAccept } from './bot.mjs';

const game = load();
const { Rules, ArenaDuel, fighters } = game;
const copy = value => JSON.parse(JSON.stringify(value));

// A second-act gladiator with some drills behind them.
function gladiator({ stats = {}, weapon = 'sword', shield = 'round', armor = 'leather', train = 2, spells = [] } = {}) {
  const run = Rules.newRun({ name: 'Test', race: 'human', stats: { str: 12, agi: 12, end: 12, mind: 12, cha: 12, ...stats }, seed: 42 });
  run.act = 1;
  run.train = { power: train, skill: train, guard: train, toughness: train };
  run.inventory.push(weapon, shield, armor);
  run.equipped = { weapon, reserve: 'none', shield, armor };
  run.learned = spells.slice();
  run.spells = spells.slice();
  return run;
}
const rate = (hero, foe) => {
  let wins = 0;
  for (let n = 0; n < 100; n++) {
    ArenaDuel.setup(n * 131 + 7, [hero, foe]);
    wins += ArenaDuel.resolve().won;
  }
  return wins / 100;
};

const staff = { weapon: 'staff', shield: 'none', armor: 'robes', stats: { mind: 17 }, spells: ['ember'] };
const maul = { weapon: 'maul', shield: 'none', armor: 'plate' };
const bow = { weapon: 'crossbow', shield: 'none' };
const tank = { weapon: 'mace', shield: 'tower', armor: 'plate', stats: { end: 16 } };
const club = { weapon: 'club', shield: 'none', armor: 'rags', train: 1 };
const axe = { weapon: 'axe' };
// Foes: a number is that champion, otherwise the blood bout on offer.
const cases = {
  peddler: { right: [tank, { key: 'peddler' }, 1], wrong: [bow, { key: 'peddler' }, 0] },
  envoy: { right: [staff, { key: 'envoy' }, 'blood'], wrong: [maul, { key: 'envoy' }, 1] },
  flagellant: { right: [axe, { key: 'flagellant', part: 'leg' }, 1], wrong: [staff, { key: 'flagellant', part: 'leg' }, 'blood'] },
  crone: { right: [maul, { key: 'crone', up: 'end', down: 'str' }, 0], wrong: [club, { key: 'crone', up: 'str', down: 'end' }, 'blood'] }
};

for (const [key, sides] of Object.entries(cases)) {
  for (const [side, [build, offer, against]] of Object.entries(sides)) {
    test(key + ' is ' + side + ' for some gladiator, and the test bot sees it', () => {
      const run = gladiator(build);
      const foe = against === 'blood' ? run.offers.blood : Rules.championConfig(against);
      run.visitor = { ...offer };
      assert.equal(wouldAccept(game, run), side === 'right');
      const after = copy(run);
      Rules.acceptBargain(after);
      const change = rate(Rules.heroConfig(after), foe) - rate(Rules.heroConfig(run), foe);
      if (side === 'right') assert.ok(change >= .05, 'changes the odds by ' + change.toFixed(2));
      else assert.ok(change <= -.07, 'changes the odds by ' + change.toFixed(2));
    });
  }
}

// Draws each card from the same state and returns what is left of the gladiator.
const draw = (run, card) => {
  const after = copy(run);
  after.visitor = { key: 'dealer', card };
  Rules.acceptBargain(after);
  return after;
};

test('the deck is a fair risk for a strong gladiator with mercy to spend', () => {
  const run = gladiator({ train: 7, armor: 'plate', stats: { str: 15, agi: 15, end: 14 } });
  run.gold = 100;
  run.visitor = { key: 'dealer', card: 'fortune' };
  assert.equal(wouldAccept(game, run), true);
  assert.ok(draw(run, 'fortune').gold - run.gold > run.gold - draw(run, 'curse').gold, 'fortune pays more than the curse takes');
  // The stranger differs from run to run, so look at several. Mercy covers the one that goes wrong.
  let wins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const duel = draw({ ...run, rng: seed }, 'duel');
    wins += rate(Rules.heroConfig(duel), duel.duel);
    Rules.startFight(duel, 'duel');
    Rules.finishFight(duel, { won: false, health: 0 });
    assert.equal(duel.over, null);
  }
  assert.ok(wins / 8 >= .7, 'wins ' + (wins / 8).toFixed(2) + ' of duels');
});

test('the deck is a bad risk for a hurt gladiator with no mercy', () => {
  const run = gladiator(club);
  run.health = .4;
  run.mercy = false;
  run.visitor = { key: 'dealer', card: 'fortune' };
  assert.equal(wouldAccept(game, run), false);
  const duel = draw(run, 'duel');
  const wins = rate(Rules.heroConfig(duel), duel.duel);
  assert.ok(wins <= .5, 'wins the duel ' + wins);
});

test('a drawn duel is to the death and nothing else can come first', () => {
  const run = draw(gladiator(), 'duel');
  run.gold = 500;
  assert.equal(Rules.rest(run), null);
  assert.equal(Rules.work(run), null);
  assert.equal(Rules.train(run, 'power'), null);
  assert.equal(Rules.startFight(run, 'blood'), null);
  assert.ok(Rules.startFight(run, 'duel'));
  run.mercy = false;
  Rules.finishFight(run, { won: false, health: 0 });
  assert.equal(run.over, 'dead');
  const winner = draw(gladiator(), 'duel');
  Rules.startFight(winner, 'duel');
  Rules.finishFight(winner, { won: true, health: .8 });
  assert.equal(winner.duel, null);
  assert.equal(winner.renown, 2);
});

test('every visitor states a gain and a price before the choice', () => {
  const offers = [...Object.values(cases).map(side => side.right[1]), { key: 'dealer', card: 'duel' }];
  assert.deepEqual(offers.map(offer => offer.key).sort(), Object.keys(Rules.visitors).sort());
  assert.equal(offers.length, 5);
  for (const offer of offers) {
    const run = gladiator();
    run.visitor = { ...offer };
    const terms = Rules.visitorTerms(run);
    assert.ok(terms.gain && terms.price && !(terms.gain + terms.price).includes('undefined'), offer.key);
  }
});

test('strangers arrive between days, wait one day and are the same for the same seed', () => {
  const walk = () => {
    const run = gladiator();
    const seen = [];
    for (let day = 0; day < 40; day++) {
      run.gold = 500;
      Rules.rest(run);
      if (run.visitor) seen.push([run.day, run.visitor]);
    }
    return seen;
  };
  const seen = walk();
  assert.ok(seen.length > 3);
  assert.deepEqual(walk(), seen);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i][0] - seen[i - 1][0] > 1, 'two days in a row');
});

test('strangers do not shift the foes or fight seeds of a run', () => {
  const days = remove => {
    const run = gladiator();
    const foes = [];
    for (let day = 0; day < 20; day++) {
      run.gold = 500;
      Rules.rest(run);
      if (remove) { run.visitor = null; delete run.fate; }
      foes.push(run.offers.blood, run.rng);
    }
    return foes;
  };
  assert.deepEqual(days(false), days(true));
});

test('a struck bargain happens once, and refusing costs nothing', () => {
  const run = gladiator();
  run.visitor = { key: 'peddler' };
  const hero = Rules.heroConfig(run);
  Rules.declineBargain(run);
  assert.equal(run.visitor, null);
  assert.deepEqual(Rules.heroConfig(run), hero);
  assert.equal(Rules.acceptBargain(run), null);
  run.visitor = { key: 'peddler' };
  Rules.acceptBargain(run);
  assert.equal(Rules.heroConfig(run).attack, hero.attack + 16);
  for (let day = 0; day < 60; day++) {
    run.gold = 500;
    Rules.rest(run);
    assert.notEqual(run.visitor?.key, 'peddler');
  }
});

test('a save from before strangers still plays', () => {
  const run = gladiator();
  delete run.met;
  delete run.visitor;
  delete run.duel;
  assert.equal(Rules.heroConfig(run).zeal, false);
  run.gold = 500;
  assert.ok(Rules.rest(run));
  assert.ok(Rules.startFight(run, 'spar'));
});

test('the Flagellant never asks for a wound you have just taken', () => {
  let met = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const run = gladiator();
    run.day = 5;
    run.gold = 500;
    run.fate = { rng: seed };
    Rules.startFight(run, 'spar');
    Rules.finishFight(run, { won: false, health: 0, worst: 'body' });
    if (run.visitor?.key !== 'flagellant') continue;
    met++;
    assert.notEqual(run.visitor.part, 'body');
  }
  assert.ok(met > 5);
});

test('the Envoy’s spell does not raise the price of pages', () => {
  const run = gladiator();
  const cost = Rules.pageCost(run);
  run.visitor = { key: 'envoy' };
  Rules.acceptBargain(run);
  assert.equal(Rules.pageCost(run), cost);
});

const fighter = (name, extra = {}) => ({
  name, level: 10, strength: 60, attack: 60, ranged: 60, magic: 55, defense: 15, maxHP: 190, color: [120, 80, 60], trim: [200, 200, 200], ...extra,
  gear: { weapon: 'sword', reserve: 'none', shield: 'round', armor: 'leather', spellbook: 'none', special: 'none' }
});
const play = (seed, hero, foe) => { ArenaDuel.setup(seed, [hero, foe]); return ArenaDuel.resolve(); };

test('a fight saved without the Flagellant’s edge replays unchanged', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const old = play(seed, fighter('A'), fighter('B'));
    play(seed, fighter('A', { zeal: true }), fighter('B'));
    assert.deepEqual(play(seed, fighter('A'), fighter('B')), old);
    assert.deepEqual(play(seed, fighter('A', { zeal: false }), fighter('B')), old);
  }
});

test('the edge only works below half health', () => {
  let changed = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const plain = play(seed, fighter('A'), fighter('B'));
    const zealous = play(seed, fighter('A', { zeal: true }), fighter('B'));
    // A bout the hero never drops below half in cannot differ.
    if (plain.health >= .5) assert.deepEqual(zealous, plain);
    else if (JSON.stringify(zealous) !== JSON.stringify(plain)) changed++;
  }
  assert.ok(changed > 5);
});

test('Red Verdict takes health with each cast and never kills its caster', () => {
  const hero = fighter('A', { maxHP: 60, spellList: ['verdict'], triggers: { verdict: 'ready' } });
  let paid = 0;
  for (let seed = 1; seed <= 20; seed++) {
    ArenaDuel.setup(seed, [hero, fighter('B')]);
    let seen;
    while (!ArenaDuel.result()) {
      const before = fighters[0].hp;
      ArenaDuel.advance(1 / 60);
      if (fighters[0].cooldowns.verdict && fighters[0].cooldowns.verdict !== seen) {
        seen = fighters[0].cooldowns.verdict;
        if (fighters[0].hp < before) paid++;
      }
      assert.ok(ArenaDuel.result() || fighters[0].hp > 0);
    }
  }
  assert.ok(paid > 10);
});
