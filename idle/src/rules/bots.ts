// Bot shades (plan §10). The world opened 120 days before you arrived, and 240 shades farm it. A
// bot's level at any moment comes from how many hours of perfect farming it has put in, read off the
// same curve the player climbs, so bots need no ticking and keep climbing while you're away.

import { combatant, combatLevel, type Stats } from './combat.ts';
import { MAX_LEVEL, MAX_STAT, pointsAt, totalXpAt, xpToNext } from './curve.ts';
import { enemies, type Enemy } from './enemies.ts';
import { huntInfo } from './farm.ts';
import { tierForLevel, type StatKey } from './gear.ts';
import { Rng } from './rng.ts';

const HOUR = 3600000, DAY = 24 * HOUR;
export const BOT_COUNT = 240;
export const WORLD_AGE_DAYS = 120;

interface Archetype {
  id: string; name: string; share: number;
  split: Partial<Record<StatKey, number>>;
  kits: { weapon: string; shield: string | null; armor: string }[];
}

export const archetypes: Archetype[] = [
  { id: 'blade', name: 'Blade', share: .3, split: { a: .34, s: .33, d: .33 },
    kits: [{ weapon: 'sword', shield: 'round', armor: 'leather' }, { weapon: 'axe', shield: 'buckler', armor: 'cuirass' }, { weapon: 'flail', shield: 'round', armor: 'segmentata' }] },
  { id: 'tank', name: 'Tank', share: .15, split: { a: .3, s: .2, d: .5 },
    kits: [{ weapon: 'spear', shield: 'tower', armor: 'plate' }, { weapon: 'mace', shield: 'scutum', armor: 'segmentata' }, { weapon: 'trident', shield: 'tower', armor: 'plate' }] },
  { id: 'cannon', name: 'Glass cannon', share: .1, split: { a: .5, s: .5 },
    kits: [{ weapon: 'greatsword', shield: null, armor: 'plate' }, { weapon: 'maul', shield: null, armor: 'plate' }, { weapon: 'falx', shield: null, armor: 'pelt' }] },
  { id: 'archer', name: 'Archer', share: .2, split: { a: .35, r: .4, d: .25 },
    kits: [{ weapon: 'bow', shield: 'buckler', armor: 'leather' }, { weapon: 'crossbow', shield: null, armor: 'pelt' }, { weapon: 'sling', shield: 'buckler', armor: 'leather' }] },
  { id: 'mage', name: 'Mage', share: .2, split: { a: .35, m: .4, d: .25 },
    kits: [{ weapon: 'staff', shield: null, armor: 'robes' }] },
  { id: 'hybrid', name: 'Hybrid', share: .05, split: { a: .25, s: .25, r: .25, d: .25 },
    kits: [{ weapon: 'sword', shield: 'round', armor: 'cuirass' }] }
];

/** Points spread by a split, with anything over 99 handed to the stats still below it. */
export function statsFor(level: number, split: Partial<Record<StatKey, number>>): Stats {
  const stats: Stats = { a: 1, s: 1, d: 1, r: 1, m: 1 };
  let left = pointsAt(level);
  const keys = (Object.keys(split) as StatKey[]).sort((x, y) => split[y]! - split[x]!);
  for (const k of keys) {
    const add = Math.min(MAX_STAT - 1, Math.floor(pointsAt(level) * split[k]!));
    stats[k] += add;
    left -= add;
  }
  for (const k of [...keys, 'a', 'd', 's', 'r', 'm'] as StatKey[]) {
    const add = Math.min(left, MAX_STAT - stats[k]);
    stats[k] += add;
    left -= add;
  }
  return stats;
}

// Hours of perfect farming to reach each level, for a balanced blade on on-level gear hunting the
// best enemy at or below its level.
const reachHours: number[] = [0, 0];
const blade = archetypes[0];
for (let level = 1; level < MAX_LEVEL; level++) {
  const t = tierForLevel(level);
  const me = combatant(level, statsFor(level, blade.split), { weapon: `sword@${t}`, shield: `round@${t}`, armor: `leather@${t}`, charm: null });
  let best = 0;
  for (const e of enemies) {
    if (e.level > level + 2) continue;
    const info = huntInfo(me, e);
    if (!info.dangerous) best = Math.max(best, info.xpPerHour);
  }
  reachHours[level + 1] = reachHours[level] + xpToNext(level) / Math.max(best, 1);
}
export const hoursToReach = (level: number) => reachHours[Math.max(1, Math.min(MAX_LEVEL, level))];

export interface Bot {
  id: number; name: string; joined: number; diligence: number;
  arch: Archetype; kit: Archetype['kits'][number];
  bestGear: boolean;
}

const firsts = ['Orsk', 'Mirelle', 'Tavo', 'Senna', 'Brug', 'Ilka', 'Varn', 'Ilsa', 'Corvane', 'Dessa', 'Hask', 'Lune',
  'Pell', 'Rhosk', 'Thessaly', 'Yarrow', 'Zenon', 'Kaelith', 'Brenna', 'Odo', 'Fenna', 'Marrick', 'Sabe', 'Tullo',
  'Ysolde', 'Grell', 'Anwe', 'Doran', 'Quill', 'Hester', 'Ivo', 'Nerys', 'Cato', 'Wren', 'Ottar', 'Liss'];
const epithets = ['Lanternless', 'of the Reeds', 'Ninefingers', 'Ashveil', 'the Unburied', 'Coldwake', 'Grimwater',
  'the Ferryless', 'Saltjaw', 'of the Black Oars', 'Twice-Drowned', 'Emberhand', 'the Pale', 'Mothwing', 'Gravecoin',
  'Hollowsong', 'Bonelamp', 'Duskmantle', 'Owes-the-Toll', 'Stillwater', 'the Quiet', 'Cinderbrow', 'Halfshade',
  'of the Last Ferry', 'Wickless', 'Rustknuckle', 'the Unpaid', 'Gloamwalker'];

/** The same world for a given seed and arrival time. */
export function makeBots(seed: number, arrived: number): Bot[] {
  const rng = new Rng(seed ^ 0x5eed);
  const opened = arrived - WORLD_AGE_DAYS * DAY;
  const used = new Set<string>();
  const bots: Bot[] = [];
  for (let id = 0; id < BOT_COUNT; id++) {
    let name = '';
    do name = `${rng.pick(firsts)} ${rng.pick(epithets)}`; while (used.has(name));
    used.add(name);
    const when = rng.float();
    // Most bots are old hands. A quarter arrived in your last ten days, most of them in the last
    // few, so there is always someone close to pass; a few more come after you.
    const joined = when < .65 ? opened + rng.range(0, 110) * DAY
      : when < .9 ? arrived - 10 * rng.float() ** 2 * DAY
      : arrived + rng.range(0, 30) * DAY;
    const kind = rng.float();
    const diligence = kind < .1 ? rng.range(.8, 1) : kind < .5 ? rng.range(.4, .8) : rng.range(.1, .4);
    let pick = rng.float(), arch = archetypes[0];
    for (const a of archetypes) { if (pick < a.share) { arch = a; break; } pick -= a.share; }
    bots.push({ id, name, joined, diligence, arch, kit: rng.pick(arch.kits), bestGear: rng.chance(.7) });
  }
  return bots;
}

export interface BotView {
  bot: Bot; level: number; totalXp: number; stats: Stats; cl: number; tier: number;
  leveledAt: number; hunting: Enemy;
}

/** A bot as it stands at `now`, or null before it joins. */
export function botAt(bot: Bot, now: number): BotView | null {
  if (now < bot.joined) return null;
  const hours = bot.diligence * (now - bot.joined) / HOUR;
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (hoursToReach(mid) <= hours) lo = mid; else hi = mid - 1;
  }
  const level = lo;
  const span = level < MAX_LEVEL ? hoursToReach(level + 1) - hoursToReach(level) : 1;
  const frac = level < MAX_LEVEL ? (hours - hoursToReach(level)) / span : 0;
  const totalXp = Math.round(totalXpAt(level) + (level < MAX_LEVEL ? frac * xpToNext(level) : (hours - hoursToReach(MAX_LEVEL)) * 60000));
  const stats = statsFor(level, bot.arch.split);
  const tier = Math.max(1, tierForLevel(level) - (bot.bestGear ? 0 : 1));
  const leveledAt = bot.joined + hoursToReach(level) / bot.diligence * HOUR;
  const hunting = [...enemies].reverse().find(e => e.level <= level + 1) ?? enemies[0];
  return { bot, level, totalXp, stats, cl: combatLevel(stats), tier, leveledAt, hunting };
}
