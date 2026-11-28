// Combat numbers from stats and gear (plan §3.5–3.8). Idle fights use these formulas directly; the
// arena sim takes the same numbers once fights can be watched.

import { maxHP } from './curve.ts';
import { accBonus, armorMul, item, powerBonus, styleStat, type StatKey, type Style } from './gear.ts';

export type Stats = Record<StatKey, number>;
export interface Loadout { weapon: string | null; shield: string | null; armor: string | null; charm: string | null }

export interface Combatant {
  hp: number;
  style: Style;
  ar: number;      // accuracy rating
  dr: number;      // evasion rating
  armor: number;
  base: number;    // average roll before the hit roll and armor
  maxHit: number;
  cycle: number;   // seconds per swing, cast or shot
  taken: Record<Style, number>;
}

const CRIT = 1 + .09 * .28;
// A staff's damage blends Ember Bolt (24) with the Staff Spark (8 × 1.3) between casts.
const SPELL_DAMAGE = 16;
const FISTS = { style: 'melee' as Style, damage: 6, windup: .25, recover: .35 };
const ACTIVE = .1;
const neutral: Record<Style, number> = { melee: 1, ranged: 1, magic: 1 };

export const powerMul = (stat: number, tier: number) => (1 + (stat - 1) / 40) * (1 + powerBonus(tier));

/** Stats with the charm's bonus, each capped at 99 + charm. */
export function effectiveStats(stats: Stats, charm: string | null): Stats {
  const out = { ...stats };
  const c = charm ? item(charm) : null;
  if (c && c.kind === 'charm') out[c.stat] += c.amount;
  return out;
}

export function combatant(level: number, baseStats: Stats, loadout: Loadout, hp = maxHP(level)): Combatant {
  const stats = effectiveStats(baseStats, loadout.charm);
  const w = loadout.weapon ? item(loadout.weapon) : null;
  const weapon = w && w.kind === 'weapon' ? w : null;
  const def = weapon ? weapon.def : FISTS;
  const wTier = weapon ? weapon.tier : 1;
  const a = loadout.armor ? item(loadout.armor) : null;
  const armor = a && a.kind === 'armor' ? a : null;
  const s = loadout.shield ? item(loadout.shield) : null;
  const shield = s && s.kind === 'shield' ? s : null;

  const style = def.style;
  const damage = style === 'magic' ? SPELL_DAMAGE : def.damage;
  const stylePower = armor && armor.def.style === style ? armor.def.power : 1;
  const mul = powerMul(stats[styleStat[style]], wTier) * stylePower;
  const armorValue = (armor ? armor.def.defense * armorMul(armor.tier) : 0)
    + (shield ? shield.def.defense * armorMul(shield.tier) : 0) + .4 * stats.d;
  return {
    hp,
    style,
    ar: (stats.a + 8) * (1 + accBonus(wTier)),
    dr: (stats.d + 8) * (1 + (armor ? armor.def.evasion : 0)),
    armor: armorValue,
    base: (damage + 2) * mul,
    maxHit: Math.round((damage + 4) * mul),
    cycle: def.windup + ACTIVE + def.recover,
    taken: armor ? armor.def.taken : neutral
  };
}

/** Chance that a blow lands cleanly; equal ratings give 75%. */
export function hitChance(ar: number, dr: number): number {
  return Math.min(.97, Math.max(.05, 1 / (1 + (dr / ar) ** 1.5 / 3)));
}

/** Share of each blow that gets through armor; magic halves the armor it meets. */
export function throughArmor(armor: number, style: Style): number {
  return 100 / (100 + (style === 'magic' ? armor / 2 : armor));
}

/** Average damage of one swing, counting glances (25%) and criticals. */
export function swing(att: Combatant, def: Combatant): number {
  const p = hitChance(att.ar, def.dr);
  return att.base * (p + .25 * (1 - p)) * throughArmor(def.armor, att.style) * def.taken[att.style] * CRIT;
}

/** Share of a fight spent swinging. A blade chasing a shooter or caster swings less. */
export function engage(att: Combatant, def: Combatant): number {
  return att.style === 'melee' && def.style !== 'melee' ? .42 : .5;
}

export function dps(att: Combatant, def: Combatant): number {
  return swing(att, def) / att.cycle * engage(att, def);
}

/** Combat level: a second or third damage stat counts half. */
export function combatLevel(stats: Stats): number {
  const top = Math.max(stats.s, stats.r, stats.m);
  const off = stats.s + stats.r + stats.m - top;
  return Math.max(1, Math.floor((stats.a + stats.d + top + off / 2) / 3));
}

export function weaponStyle(key: string | null): Style {
  const w = key ? item(key) : null;
  return w && w.kind === 'weapon' ? w.def.style : 'melee';
}
