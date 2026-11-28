// The player's shade: the save's shape and the actions that change it outside of farming.

import { combatant, type Combatant, type Loadout, type Stats } from './combat.ts';
import { MAX_STAT, pointsAt } from './curve.ts';
import { item, levelNeeded, shieldAllowed, slotOf, stacks, type Slot, type StatKey } from './gear.ts';

export type Path = 'blade' | 'bow' | 'staff';
export type Preset = 'blade' | 'tank' | 'bow' | 'staff';
export type LogKind = 'level' | 'drop' | 'rare' | 'info' | 'sold';

export interface Shade {
  v: 1;
  name: string;
  path: Path;
  created: number;
  seed: number;
  rng: number;
  level: number;
  xp: number;        // XP into the current level
  totalXp: number;
  stats: Stats;
  unspent: number;
  auto: Preset | null;
  purse: number;
  equip: Loadout;
  pack: Record<string, number>;
  hunt: string | null;   // enemy id
  carry: number;         // seconds into the current kill cycle
  lastSeen: number;
  shop: { day: number; stock: Record<string, number> };
  log: { at: number; kind: LogKind; text: string }[];
  kills: number;
  earned: number;
}

export const PACK_SLOTS = 32;
export const STACK = 999;

export const paths: Record<Path, { name: string; blurb: string; gear: Loadout; preset: Preset }> = {
  blade: { name: 'Blade', blurb: 'Sword and round shield. Steady and hard to kill.', preset: 'blade',
    gear: { weapon: 'sword@1', shield: 'round@1', armor: 'leather@1', charm: null } },
  bow: { name: 'Bow', blurb: 'Repeating bow and buckler. Shoots blades before they close.', preset: 'bow',
    gear: { weapon: 'bow@1', shield: 'buckler@1', armor: 'leather@1', charm: null } },
  staff: { name: 'Staff', blurb: 'Ember spells that burn through half of any armor.', preset: 'staff',
    gear: { weapon: 'staff@1', shield: null, armor: 'robes@1', charm: null } }
};

export const presets: Record<Preset, { name: string; split: Partial<Record<StatKey, number>> }> = {
  blade: { name: 'Blade', split: { a: .35, s: .35, d: .3 } },
  tank: { name: 'Tank', split: { a: .3, s: .25, d: .45 } },
  bow: { name: 'Archer', split: { a: .35, r: .35, d: .3 } },
  staff: { name: 'Mage', split: { a: .35, m: .35, d: .3 } }
};

const ones = (): Stats => ({ a: 1, s: 1, d: 1, r: 1, m: 1 });

export function newShade(name: string, path: Path, now: number, seed: number): Shade {
  return {
    v: 1, name, path, created: now, seed, rng: seed, level: 1, xp: 0, totalXp: 0,
    stats: ones(), unspent: pointsAt(1), auto: null, purse: 25,
    equip: { ...paths[path].gear }, pack: {}, hunt: null, carry: 0, lastSeen: now,
    shop: { day: -1, stock: {} }, log: [{ at: now, kind: 'info', text: `${name} wakes on the black sand of Lanternfall.` }],
    kills: 0, earned: 0
  };
}

export const combatOf = (shade: Shade): Combatant => combatant(shade.level, shade.stats, shade.equip);

export function note(shade: Shade, at: number, kind: LogKind, text: string) {
  shade.log.unshift({ at, kind, text });
  if (shade.log.length > 40) shade.log.length = 40;
}

export function slotsUsed(pack: Record<string, number>): number {
  let used = 0;
  for (const [key, qty] of Object.entries(pack)) used += stacks(key) ? Math.ceil(qty / STACK) : qty;
  return used;
}

/** Whether qty more of an item fit in the pack. */
export function fits(pack: Record<string, number>, key: string, qty = 1): boolean {
  if (stacks(key)) {
    const have = pack[key] ?? 0;
    return slotsUsed(pack) - Math.ceil(have / STACK) + Math.ceil((have + qty) / STACK) <= PACK_SLOTS;
  }
  return slotsUsed(pack) + qty <= PACK_SLOTS;
}

export function addItem(pack: Record<string, number>, key: string, qty = 1) {
  pack[key] = (pack[key] ?? 0) + qty;
}

export function removeItem(pack: Record<string, number>, key: string, qty = 1): boolean {
  if ((pack[key] ?? 0) < qty) return false;
  pack[key] -= qty;
  if (pack[key] === 0) delete pack[key];
  return true;
}

/** Puts on an item from the pack. Returns an error to show, or null. */
export function equip(shade: Shade, key: string): string | null {
  const slot = slotOf(key);
  if (!slot || !shade.pack[key]) return 'You do not have that.';
  if (shade.level < levelNeeded(key)) return `Needs level ${levelNeeded(key)}.`;
  if (slot === 'shield' && !shieldAllowed(shade.equip.weapon, key)) {
    return twoHanded(shade.equip.weapon) ? 'Your weapon needs both hands.' : 'Only a buckler fits beside a bow, sling, crossbow or staff.';
  }
  const out: string[] = [];
  const old = shade.equip[slot];
  if (old) out.push(old);
  const shield = shade.equip.shield;
  const dropShield = slot === 'weapon' && !!shield && !shieldAllowed(key, shield);
  if (dropShield) out.push(shield!);
  // Gear takes one slot each, and taking the new item out frees one.
  if (slotsUsed(shade.pack) - 1 + out.length > PACK_SLOTS) return 'Your pack is full.';
  removeItem(shade.pack, key);
  for (const k of out) addItem(shade.pack, k);
  shade.equip[slot] = key;
  if (dropShield) shade.equip.shield = null;
  return null;
}

function twoHanded(key: string | null): boolean {
  const it = key ? item(key) : null;
  return !!it && it.kind === 'weapon' && !!it.def.twoHanded;
}

export function unequip(shade: Shade, slot: Slot): string | null {
  const key = shade.equip[slot];
  if (!key) return null;
  if (!fits(shade.pack, key)) return 'Your pack is full.';
  addItem(shade.pack, key);
  shade.equip[slot] = null;
  return null;
}

export function allocate(shade: Shade, stat: StatKey, n: number): number {
  const amount = Math.max(0, Math.min(n, shade.unspent, MAX_STAT - shade.stats[stat]));
  shade.stats[stat] += amount;
  shade.unspent -= amount;
  return amount;
}

/** Spends points one at a time on whichever stat is furthest below the preset's split. */
export function spendByPreset(shade: Shade, preset: Preset) {
  const split = presets[preset].split;
  const keys = Object.keys(split) as StatKey[];
  while (shade.unspent > 0) {
    const spent = keys.reduce((sum, k) => sum + shade.stats[k] - 1, 0) + 1;
    let best: StatKey | null = null, gap = -Infinity;
    for (const k of keys) {
      if (shade.stats[k] >= MAX_STAT) continue;
      const g = split[k]! * spent - (shade.stats[k] - 1);
      if (g > gap) { gap = g; best = k; }
    }
    if (!best) {
      const rest = (['a', 's', 'd', 'r', 'm'] as StatKey[]).find(k => shade.stats[k] < MAX_STAT);
      if (!rest) return;
      best = rest;
    }
    shade.stats[best]++;
    shade.unspent--;
  }
}
