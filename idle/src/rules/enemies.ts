// PvE zones and the enemies in them (plan §1, §4). Each enemy reuses a sim kit, so a later milestone
// can show the hunt in the arena renderer.

import { combatant, type Combatant } from './combat.ts';
import { maxHP } from './curve.ts';
import { tierForLevel, type StatKey } from './gear.ts';

export interface Enemy {
  id: string; name: string; level: number; zone: string; kit: string;
  weapon: string; shield: string | null; armor: string;
  charm: StatKey; champion?: string[];
}

export const zones = [
  { id: 'temple', name: 'Drowned Temple', blurb: 'Flooded halls where the newly dead wash up.' },
  { id: 'forge', name: 'Molten Forge', blurb: 'Slag pits and the thralls who stoke them.' },
  { id: 'garden', name: 'Elysian Garden', blurb: 'Pale terraces kept by the oldest of the dead.' }
] as const;

export const enemies: Enemy[] = [
  { id: 'shade', name: 'Restless Shade', level: 1, zone: 'temple', kit: 'raider', weapon: 'axe', shield: 'buckler', armor: 'leather', charm: 'a' },
  { id: 'reaver', name: 'Shade Reaver', level: 5, zone: 'temple', kit: 'raider', weapon: 'axe', shield: 'buckler', armor: 'pelt', charm: 's' },
  { id: 'archer', name: 'Bone Archer', level: 10, zone: 'temple', kit: 'huntress', weapon: 'bow', shield: 'buckler', armor: 'leather', charm: 'r' },
  { id: 'legionary', name: 'Drowned Legionary', level: 16, zone: 'temple', kit: 'hoplite', weapon: 'spear', shield: 'tower', armor: 'plate', charm: 'd' },
  { id: 'centurion', name: 'Drowned Centurion', level: 23, zone: 'temple', kit: 'hoplite', weapon: 'sword', shield: 'scutum', armor: 'segmentata', charm: 'd' },
  { id: 'cultist', name: 'Ember Cultist', level: 30, zone: 'forge', kit: 'emberpriest', weapon: 'staff', shield: null, armor: 'robes', charm: 'm' },
  { id: 'thrall', name: 'Forge Thrall', level: 37, zone: 'forge', kit: 'breaker', weapon: 'maul', shield: null, armor: 'plate', charm: 's' },
  { id: 'duelist', name: 'Hollow Duelist', level: 44, zone: 'forge', kit: 'duelist', weapon: 'sword', shield: 'round', armor: 'leather', charm: 'a' },
  { id: 'marksman', name: 'Slag Marksman', level: 51, zone: 'forge', kit: 'marksman', weapon: 'crossbow', shield: null, armor: 'cuirass', charm: 'r' },
  { id: 'revenant', name: 'Frost Revenant', level: 58, zone: 'garden', kit: 'frostmage', weapon: 'staff', shield: null, armor: 'robes', charm: 'm' },
  { id: 'warden', name: 'Grave Warden', level: 66, zone: 'garden', kit: 'executioner', weapon: 'greatsword', shield: null, armor: 'plate', charm: 'd' },
  { id: 'wraith', name: 'Storm Wraith', level: 74, zone: 'garden', kit: 'stormmage', weapon: 'staff', shield: null, armor: 'robes', charm: 'm' },
  { id: 'reaper', name: 'Garden Reaper', level: 82, zone: 'garden', kit: 'raider', weapon: 'falx', shield: null, armor: 'pelt', charm: 's' },
  { id: 'murmillo', name: 'Pit Champion', level: 90, zone: 'garden', kit: 'murmillo', weapon: 'gladius', shield: 'scutum', armor: 'leather', charm: 'a', champion: ['gladius', 'pilum'] },
  { id: 'sagittarius', name: 'Pit Champion Archer', level: 98, zone: 'garden', kit: 'sagittarius', weapon: 'recurve', shield: null, armor: 'leather', charm: 'r', champion: ['recurve', 'sica'] }
];

export const enemyById = (id: string) => enemies.find(e => e.id === id);

/** Enemies wear gear one tier below what their level allows. */
export const enemyTier = (e: Enemy) => Math.max(1, tierForLevel(e.level) - 1);

/** An enemy has 60% of a shade's life and every stat at its level. */
export function enemyCombatant(e: Enemy): Combatant {
  const t = enemyTier(e);
  const stat = Math.min(99, e.level);
  const stats = { a: stat, s: stat, d: stat, r: stat, m: stat };
  return combatant(e.level, stats, {
    weapon: `${e.weapon}@${t}`, shield: e.shield ? `${e.shield}@${t}` : null, armor: `${e.armor}@${t}`, charm: null
  }, Math.round(.6 * maxHP(e.level)));
}

export const xpPerKill = (level: number) => Math.round(10 + 4 * level + .04 * level * level);
export const goldPerKill = (level: number) => 1 + Math.floor(level / 2);
/** Charm drops grow with the enemy: +2 at the bottom, +6 from the Pit Champions. */
export const charmAmount = (e: Enemy) => e.champion ? 6 : Math.min(5, 2 + Math.floor(e.level / 25));

export interface DropLine { key: string; chance: number }

/** Each kill rolls every line once. */
export function dropTable(e: Enemy): DropLine[] {
  const t = enemyTier(e), top = tierForLevel(e.level);
  const types = [e.weapon, e.shield, e.armor].filter((x): x is string => !!x && !['gladius', 'recurve'].includes(x));
  const lines: DropLine[] = [{ key: `scrap.${t}`, chance: 1 / 8 }];
  for (const type of types) lines.push({ key: `${type}@${t}`, chance: 1 / 60 / types.length });
  if (top > t) for (const type of types) lines.push({ key: `${type}@${top}`, chance: 1 / 250 / types.length });
  lines.push({ key: `charm.${e.charm}${charmAmount(e)}`, chance: 1 / 2000 });
  for (const type of e.champion ?? []) lines.push({ key: `${type}@8`, chance: 1 / 400 });
  return lines;
}
