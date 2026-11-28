// Levels, XP and stat points (docs/idle-rpg-plan.md §3.1–3.3).

export const MAX_LEVEL = 100;
export const MAX_STAT = 99;
export const START_POINTS = 8;
export const POINTS_PER_LEVEL = 3;

const round10 = (x: number) => Math.round(x / 10) * 10;

/** XP needed to go from level L to L + 1. */
export function xpToNext(level: number): number {
  return round10(50 * level ** 2.1 * 1.02 ** level);
}

const totals: number[] = [0, 0];
for (let level = 1; level < MAX_LEVEL; level++) totals[level + 1] = totals[level] + xpToNext(level);

/** Total XP a shade has earned on reaching the start of a level. */
export function totalXpAt(level: number): number {
  return totals[Math.max(1, Math.min(MAX_LEVEL, level))];
}

/** Stat points a shade has at a level: 8, then 3 more every level. */
export function pointsAt(level: number): number {
  return START_POINTS + POINTS_PER_LEVEL * (level - 1);
}

export function maxHP(level: number): number {
  return 200 + 4 * level;
}
