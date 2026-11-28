// AFK farming and offline progress (plan §4). The same advance() runs every quarter second while the
// app is open and once on return, so live and offline progress follow identical rules.

import { dps, type Combatant } from './combat.ts';
import { MAX_LEVEL, maxHP, xpToNext } from './curve.ts';
import { dropTable, enemyById, enemyCombatant, goldPerKill, xpPerKill, type Enemy } from './enemies.ts';
import { itemName, sellPrice } from './gear.ts';
import { Rng } from './rng.ts';
import { addItem, combatOf, fits, note, spendByPreset, type Shade } from './shade.ts';

export const LOOT_SECONDS = 3;
export const REST_RATE = .03;          // share of max HP healed per second between fights
export const DANGER = .75;             // can't farm an enemy that takes more than this per kill
export const OFFLINE_CAP = 24 * 3600;  // seconds

export interface HuntInfo {
  ttk: number; hurt: number; rest: number; cycle: number;
  hurtShare: number; dangerous: boolean;
  xpKill: number; goldKill: number;
  killsPerHour: number; xpPerHour: number; goldPerHour: number;
}

export function huntInfo(me: Combatant, enemy: Enemy, foe: Combatant = enemyCombatant(enemy)): HuntInfo {
  const ttk = foe.hp / dps(me, foe);
  const hurt = dps(foe, me) * ttk;
  const rest = hurt / (REST_RATE * me.hp);
  const cycle = ttk + LOOT_SECONDS + rest;
  const xpKill = xpPerKill(enemy.level), goldKill = goldPerKill(enemy.level);
  const killsPerHour = 3600 / cycle;
  return {
    ttk, hurt, rest, cycle, hurtShare: hurt / me.hp, dangerous: hurt > DANGER * me.hp,
    xpKill, goldKill, killsPerHour, xpPerHour: killsPerHour * xpKill, goldPerHour: killsPerHour * goldKill
  };
}

export interface Report {
  seconds: number;
  kills: number;
  xp: number;
  gold: number;
  fromLevel: number;
  toLevel: number;
  points: number;
  drops: Record<string, number>;
  sold: Record<string, number>;
  soldFor: number;
  stopped: string | null;
}

export const emptyReport = (level: number): Report => ({
  seconds: 0, kills: 0, xp: 0, gold: 0, fromLevel: level, toLevel: level, points: 0,
  drops: {}, sold: {}, soldFor: 0, stopped: null
});

/** Gives XP and handles level-ups: +3 points and +4 HP each. */
export function gainXp(shade: Shade, xp: number, report: Report, at: number) {
  shade.totalXp += xp;
  report.xp += xp;
  if (shade.level >= MAX_LEVEL) return;
  shade.xp += xp;
  while (shade.level < MAX_LEVEL && shade.xp >= xpToNext(shade.level)) {
    shade.xp -= xpToNext(shade.level);
    shade.level++;
    shade.unspent += 3;
    report.points += 3;
    report.toLevel = shade.level;
    note(shade, at, 'level', `Reached level ${shade.level}. +3 stat points, ${maxHP(shade.level)} HP.`);
    if (shade.auto) spendByPreset(shade, shade.auto);
  }
  if (shade.level >= MAX_LEVEL) shade.xp = 0;
}

/** Puts loot in the pack; what doesn't fit goes to the Sutler at 40%. */
export function stow(shade: Shade, key: string, report: Report, at: number) {
  if (fits(shade.pack, key)) {
    addItem(shade.pack, key);
    report.drops[key] = (report.drops[key] ?? 0) + 1;
    if (!key.startsWith('scrap.')) note(shade, at, key.startsWith('charm.') || key.endsWith('@8') ? 'rare' : 'drop', `Found ${itemName(key)}.`);
  } else {
    const price = sellPrice(key);
    shade.purse += price;
    shade.earned += price;
    report.sold[key] = (report.sold[key] ?? 0) + 1;
    report.soldFor += price;
  }
}

/**
 * Runs `seconds` of farming. Whole kills only: the remainder carries into the next call. `now` is
 * the wall-clock time at the end of the span, used to stamp log entries.
 */
export function advance(shade: Shade, seconds: number, now: number, report = emptyReport(shade.level)): Report {
  report.seconds += seconds;
  const enemy = shade.hunt ? enemyById(shade.hunt) : undefined;
  if (!enemy) { shade.hunt = null; shade.carry = 0; return report; }
  const foe = enemyCombatant(enemy);
  const rng = new Rng(shade.rng);
  const start = now - seconds * 1000;
  shade.carry += seconds;
  let elapsed = 0;
  let info = huntInfo(combatOf(shade), enemy, foe);
  if (info.dangerous) {
    shade.hunt = null;
    shade.carry = 0;
    report.stopped = `${enemy.name} is too dangerous for you now.`;
    return report;
  }
  const drops = dropTable(enemy);
  while (shade.carry >= info.cycle) {
    shade.carry -= info.cycle;
    elapsed += info.cycle;
    const at = Math.round(start + elapsed * 1000);
    shade.kills++;
    report.kills++;
    const gold = Math.max(1, Math.round(info.goldKill * rng.range(.5, 1.5)));
    shade.purse += gold;
    shade.earned += gold;
    report.gold += gold;
    for (const line of drops) if (rng.chance(line.chance)) stow(shade, line.key, report, at);
    const level = shade.level;
    gainXp(shade, info.xpKill, report, at);
    if (shade.level !== level) info = huntInfo(combatOf(shade), enemy, foe);
  }
  shade.rng = rng.state;
  return report;
}

/** Catches up on time away, capped at 24 hours. A clock moved back gives nothing. */
export function catchUp(shade: Shade, now: number): Report {
  const away = (now - shade.lastSeen) / 1000;
  const report = emptyReport(shade.level);
  if (away > 0) advance(shade, Math.min(away, OFFLINE_CAP), now, report);
  report.seconds = Math.max(0, away);
  shade.lastSeen = now;
  return report;
}

/** Where the current kill cycle is, for the live view. */
export function phase(info: HuntInfo, carry: number): { label: string; foeHp: number; myHp: number; progress: number } {
  const t = Math.min(carry, info.cycle);
  const progress = t / info.cycle;
  if (t < info.ttk) {
    const f = t / info.ttk;
    return { label: 'Fighting', foeHp: 1 - f, myHp: 1 - info.hurtShare * f, progress };
  }
  if (t < info.ttk + LOOT_SECONDS) return { label: 'Looting', foeHp: 0, myHp: 1 - info.hurtShare, progress };
  const healed = (t - info.ttk - LOOT_SECONDS) / Math.max(.001, info.rest);
  return { label: 'Resting', foeHp: 0, myHp: 1 - info.hurtShare * (1 - healed), progress };
}
