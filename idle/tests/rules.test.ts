import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { combatant, combatLevel, hitChance } from '../src/rules/combat.ts';
import { pointsAt, totalXpAt, xpToNext } from '../src/rules/curve.ts';
import { enemies, enemyById } from '../src/rules/enemies.ts';
import { advance, catchUp, huntInfo, OFFLINE_CAP } from '../src/rules/farm.ts';
import { armors, item, sellPrice, shields, value, weapons } from '../src/rules/gear.ts';
import { combatOf, equip, newShade, PACK_SLOTS, slotsUsed, spendByPreset, type Shade } from '../src/rules/shade.ts';
import { buy, drinkLethe, restock, sell, utcDay } from '../src/rules/shop.ts';
import { botAt, hoursToReach, makeBots } from '../src/rules/bots.ts';

const sim = createRequire(import.meta.url)('../../hades/data.js');
const T0 = Date.UTC(2026, 10, 28, 12);
const fresh = (path: 'blade' | 'bow' | 'staff' = 'blade'): Shade => newShade('Test', path, T0, 42);
const copy = (s: Shade): Shade => JSON.parse(JSON.stringify(s));

test('XP curve and points follow the plan', () => {
  assert.equal(xpToNext(1), 50);
  assert.equal(xpToNext(20), 40100);
  assert.equal(totalXpAt(1), 0);
  assert.equal(totalXpAt(2), 50);
  assert.equal(pointsAt(1), 8);
  assert.equal(pointsAt(100), 305);
});

test('hit chance: equal ratings give 75%, and it stays within 5–97%', () => {
  assert.equal(hitChance(40, 40), .75);
  assert.equal(hitChance(1, 1000), .05);
  assert.equal(hitChance(1000, 1), .97);
  // Plan §3.5 worked example: A 31 with an Obsidian weapon against D 31 in leather.
  const p = hitChance((31 + 8) * 1.12, (31 + 8) * 1.15);
  assert.ok(Math.abs(p - .742) < .002, String(p));
});

test('max hit and combat level match the worked examples', () => {
  const me = combatant(30, { a: 31, s: 31, d: 31, r: 1, m: 1 }, { weapon: 'sword@4', shield: 'round@4', armor: 'plate@4', charm: null });
  // (13 + 4) × 1.75 × 1.15 = 34.2, then plate's 6% melee bonus.
  assert.equal(me.maxHit, Math.round(17 * 1.75 * 1.15 * 1.06));
  assert.equal(combatLevel({ a: 62, s: 62, d: 62, r: 1, m: 3 }), 62);
  assert.equal(combatLevel({ a: 40, s: 40, d: 40, r: 40, m: 30 }), 51);
  assert.equal(combatLevel({ a: 99, s: 99, d: 99, r: 7, m: 6 }), 101);
});

test('gear numbers match the Underworld Duel sim', () => {
  for (const [key, w] of Object.entries(weapons)) {
    const s = sim.weapons[key];
    assert.ok(s, key);
    assert.deepEqual([w.damage, w.windup, w.recover, w.style, !!w.twoHanded], [s.damage, s.windup, s.recover, s.style, !!s.twoHanded], key);
  }
  for (const [key, sh] of Object.entries(shields)) assert.equal(sh.defense, sim.shields[key].defense, key);
  for (const [key, a] of Object.entries(armors)) {
    assert.equal(a.defense, sim.armors[key].defense, key);
    assert.equal(a.power, sim.armors[key].power, key);
    assert.deepEqual(a.taken, sim.armors[key].taken, key);
  }
  for (const e of enemies) assert.ok(sim.kits[e.kit], e.kit);
});

test('item keys parse and price', () => {
  assert.equal(item('sword@5')?.kind, 'weapon');
  assert.equal(item('charm.d3')?.kind, 'charm');
  assert.equal(item('scrap.4')?.kind, 'scrap');
  assert.equal(item('sword@9'), null);
  assert.equal(item('nope@1'), null);
  assert.equal(value('sword@1'), 120);
  assert.equal(sellPrice('sword@1'), 48);
});

test('a new shade can farm the first enemy but not the second', () => {
  const s = fresh();
  assert.equal(huntInfo(combatOf(s), enemyById('shade')!).dangerous, false);
  assert.equal(huntInfo(combatOf(s), enemyById('reaver')!).dangerous, true);
  spendByPreset(s, 'blade');
  assert.equal(s.unspent, 0);
  assert.equal(s.stats.a + s.stats.s + s.stats.d - 3, 8);
  assert.equal(huntInfo(combatOf(s), enemyById('reaver')!).dangerous, false);
});

test('farming is deterministic, levels up and carries the remainder', () => {
  const s = fresh();
  spendByPreset(s, 'blade');
  s.hunt = 'shade';
  const twin = copy(s);
  const a = advance(s, 3600, T0 + 3600e3);
  const b = advance(twin, 3600, T0 + 3600e3);
  assert.deepEqual(s, twin);
  assert.deepEqual(a, b);
  assert.ok(a.kills > 80 && a.kills < 140, String(a.kills));
  assert.ok(s.level >= 4, String(s.level));
  assert.equal(s.unspent, 3 * (s.level - 1));
  assert.equal(s.totalXp, a.xp);
  const cycle = huntInfo(combatOf(s), enemyById('shade')!).cycle;
  assert.ok(s.carry >= 0 && s.carry < cycle);
  // Splitting the hour into quarter seconds gives the same outcome as one big step.
  const ticks = copy(twin);
  const start = fresh();
  spendByPreset(start, 'blade');
  start.hunt = 'shade';
  for (let i = 1; i <= 14400; i++) advance(start, .25, T0 + i * 250);
  assert.equal(start.kills, a.kills);
  assert.equal(start.level, ticks.level);
});

test('auto-spend keeps points working while away', () => {
  const s = fresh();
  spendByPreset(s, 'blade');
  s.auto = 'blade';
  s.hunt = 'shade';
  advance(s, 4 * 3600, T0 + 4 * 3600e3);
  assert.equal(s.unspent, 0);
  assert.ok(s.stats.a > 5 && s.stats.s > 5 && s.stats.d > 5);
});

test('catch-up is capped at 24 hours and ignores a clock moved back', () => {
  const s = fresh();
  spendByPreset(s, 'blade');
  s.hunt = 'shade';
  const twoDays = copy(s);
  const oneDay = copy(s);
  catchUp(twoDays, T0 + 2 * OFFLINE_CAP * 1000);
  catchUp(oneDay, T0 + OFFLINE_CAP * 1000);
  assert.equal(twoDays.kills, oneDay.kills);
  assert.equal(twoDays.lastSeen, T0 + 2 * OFFLINE_CAP * 1000);
  const back = copy(s);
  const report = catchUp(back, T0 - 3600e3);
  assert.equal(report.kills, 0);
  assert.equal(back.lastSeen, T0 - 3600e3);
});

test('a full pack sells new loot to the Sutler', () => {
  const s = fresh();
  spendByPreset(s, 'blade');
  for (let i = 0; i < PACK_SLOTS; i++) s.pack[`charm.a${2 + (i % 4)}`] = (s.pack[`charm.a${2 + (i % 4)}`] ?? 0) + 1;
  assert.equal(slotsUsed(s.pack), PACK_SLOTS);
  s.hunt = 'shade';
  const r = advance(s, 24 * 3600, T0 + 24 * 3600e3);
  assert.equal(slotsUsed(s.pack), PACK_SLOTS);
  assert.ok(r.soldFor > 0);
});

test('an enemy too dangerous for the build stops the hunt', () => {
  const s = fresh();
  s.hunt = 'warden';
  const r = advance(s, 600, T0 + 600e3);
  assert.equal(s.hunt, null);
  assert.ok(r.stopped);
  assert.equal(r.kills, 0);
});

test('equip rules: level gates, two hands and bucklers', () => {
  const s = fresh();
  s.pack['maul@1'] = 1;
  s.pack['sword@2'] = 1;
  assert.match(equip(s, 'sword@2')!, /level 10/);
  assert.equal(equip(s, 'maul@1'), null);
  assert.equal(s.equip.shield, null);
  assert.equal(s.pack['round@1'], 1);
  assert.equal(s.pack['sword@1'], 1);
  assert.match(equip(s, 'round@1')!, /both hands/);
  const archer = fresh('bow');
  archer.pack['round@1'] = 1;
  assert.match(equip(archer, 'round@1')!, /buckler/);
});

test('the Sutler restocks at midnight UTC, sells at value and buys at 40%', () => {
  const s = fresh();
  s.purse = 1000;
  restock(s, T0);
  assert.equal(s.shop.day, utcDay(T0));
  for (let i = 0; i < 5; i++) assert.equal(buy(s, 'sword@1', T0), null);
  assert.match(buy(s, 'sword@1', T0)!, /Sold out/);
  assert.equal(s.purse, 1000 - 5 * 120);
  assert.equal(buy(s, 'sword@1', Date.UTC(2026, 10, 29, 0, 0, 1)), null);
  assert.equal(sell(s, 'sword@1', 2), 96);
  s.stats.a = 9;
  s.unspent = 0;
  s.purse = 10;
  assert.equal(drinkLethe(s), null);
  assert.equal(s.unspent, 8);
  assert.equal(s.stats.a, 1);
});

test('bots: the same world for a seed, climbing over time, level 100 takes months', () => {
  assert.deepEqual(makeBots(7, T0).map(b => b.name), makeBots(7, T0).map(b => b.name));
  const days = hoursToReach(100) / 24;
  assert.ok(days > 60 && days < 120, String(days));
  for (let l = 2; l <= 100; l++) assert.ok(hoursToReach(l) > hoursToReach(l - 1));
  const bots = makeBots(7, T0);
  const now = bots.map(b => botAt(b, T0)).filter(v => v);
  const later = bots.map(b => botAt(b, T0 + 86400e3)).filter(v => v);
  assert.ok(now.length > 200 && now.length < 240);
  for (const v of now) {
    const next = later.find(w => w!.bot.id === v!.bot.id)!;
    assert.ok(next.totalXp >= v!.totalXp && next.level >= v!.level);
  }
  // Someone sits near the bottom for a new shade to pass early on.
  assert.ok(now.some(v => v!.level <= 5));
});
