// Gear, tiers, charms and materials (plan §1, §3.4, §7). Weapon, shield and armor numbers are the
// Underworld Duel's own (hades/data.js); tests/gear.test.ts checks that they still match.

export type Style = 'melee' | 'ranged' | 'magic';
export type StatKey = 'a' | 's' | 'd' | 'r' | 'm';
export type Slot = 'weapon' | 'shield' | 'armor' | 'charm';

export interface WeaponDef {
  name: string; style: Style; damage: number; windup: number; recover: number;
  twoHanded?: boolean; spellPower?: number; factor: number; champion?: boolean;
}
export interface ShieldDef { name: string; defense: number; factor: number }
export interface ArmorDef {
  name: string; style: Style; power: number; defense: number; evasion: number;
  taken: Record<Style, number>; factor: number;
}

export const weapons: Record<string, WeaponDef> = {
  sword: { name: 'Sword', style: 'melee', damage: 13, windup: .30, recover: .34, factor: 1 },
  spear: { name: 'Spear', style: 'melee', damage: 14, windup: .31, recover: .38, factor: 1 },
  axe: { name: 'Axe', style: 'melee', damage: 19, windup: .40, recover: .44, factor: 1.05 },
  mace: { name: 'Mace', style: 'melee', damage: 15, windup: .35, recover: .40, factor: 1 },
  hammer: { name: 'War hammer', style: 'melee', damage: 16, windup: .47, recover: .46, factor: .95 },
  flail: { name: 'Flail', style: 'melee', damage: 17, windup: .35, recover: .4, factor: 1.1 },
  trident: { name: 'Trident', style: 'melee', damage: 14, windup: .31, recover: .38, factor: 1 },
  maul: { name: 'War maul', style: 'melee', damage: 31, windup: .66, recover: .62, twoHanded: true, factor: 1.3 },
  greatsword: { name: 'Greatsword', style: 'melee', damage: 26, windup: .54, recover: .54, twoHanded: true, factor: 1.3 },
  falx: { name: 'Falx', style: 'melee', damage: 26, windup: .43, recover: .45, twoHanded: true, factor: 1.5 },
  bow: { name: 'Repeating bow', style: 'ranged', damage: 12, windup: .32, recover: .32, factor: 1 },
  sling: { name: 'Sling', style: 'ranged', damage: 12, windup: .42, recover: .3, factor: .9 },
  crossbow: { name: 'Crossbow', style: 'ranged', damage: 23, windup: .54, recover: .48, factor: 1.15 },
  staff: { name: 'Staff', style: 'magic', damage: 8, windup: .42, recover: .42, spellPower: 1.3, factor: 1.1 },
  // The two champions' gear: Pit Champion drops only.
  gladius: { name: 'Gladius', style: 'melee', damage: 13, windup: .29, recover: .32, factor: 1.4, champion: true },
  sica: { name: 'Sica', style: 'melee', damage: 12, windup: .23, recover: .29, factor: 1.4, champion: true },
  pilum: { name: 'Pilum', style: 'ranged', damage: 21, windup: .5, recover: .5, factor: 1.4, champion: true },
  recurve: { name: 'Composite bow', style: 'ranged', damage: 18, windup: .38, recover: .34, factor: 1.4, champion: true }
};

export const shields: Record<string, ShieldDef> = {
  buckler: { name: 'Buckler', defense: 11, factor: .7 },
  round: { name: 'Round shield', defense: 20, factor: .8 },
  scutum: { name: 'Scutum', defense: 21, factor: .85 },
  tower: { name: 'Tower shield', defense: 34, factor: 1 }
};

export const armors: Record<string, ArmorDef> = {
  plate: { name: 'Plate', style: 'melee', power: 1.06, defense: 12, evasion: 0, factor: 1.4, taken: { melee: .98, ranged: .88, magic: 1.1 } },
  segmentata: { name: 'Lorica segmentata', style: 'melee', power: 1, defense: 10, evasion: -.05, factor: 1.3, taken: { melee: 1, ranged: .9, magic: 1.12 } },
  cuirass: { name: 'Bronze cuirass', style: 'melee', power: 1.03, defense: 6, evasion: .05, factor: 1.1, taken: { melee: 1.02, ranged: .97, magic: 1.04 } },
  leather: { name: 'Leather', style: 'ranged', power: 1.09, defense: 7, evasion: .15, factor: 1.2, taken: { melee: 1.07, ranged: .98, magic: .9 } },
  pelt: { name: 'Wolf pelt', style: 'ranged', power: 1.08, defense: 2, evasion: .2, factor: 1, taken: { melee: 1.1, ranged: 1.0, magic: .92 } },
  robes: { name: 'Robes', style: 'magic', power: 1.12, defense: 3, evasion: .1, factor: 1.2, taken: { melee: 1.05, ranged: 1.08, magic: .98 } }
};

export const tiers = [
  null,
  { name: 'Bronze', level: 1 },
  { name: 'Iron', level: 10 },
  { name: 'Grave-steel', level: 20 },
  { name: 'Obsidian', level: 30 },
  { name: 'Ember-forged', level: 45 },
  { name: 'Styx-tempered', level: 60 },
  { name: 'Nightglass', level: 75 },
  { name: 'Lantern-gold', level: 90 }
] as const;
export const MAX_TIER = 8;

/** The best gear tier a shade of this level may wear. */
export function tierForLevel(level: number): number {
  let tier = 1;
  for (let t = 1; t <= MAX_TIER; t++) if (tiers[t]!.level <= level) tier = t;
  return tier;
}

export const powerBonus = (tier: number) => .05 * (tier - 1);
export const accBonus = (tier: number) => .04 * (tier - 1);
export const armorMul = (tier: number) => .6 + .1 * tier;

export const statNames: Record<StatKey, string> = { a: 'Attack', s: 'Strength', d: 'Defence', r: 'Ranged', m: 'Magic' };
export const styleStat: Record<Style, StatKey> = { melee: 's', ranged: 'r', magic: 'm' };

// Charms add to one stat: charm.<stat><amount>, such as charm.d3.
const charmNames: Record<StatKey, string> = {
  a: "Hunter's tooth", s: 'Ox-bone ring', d: 'Legion signet', r: "Fletcher's knot", m: 'Ember bead'
};
export const scrapNames = ['', 'Bronze scrap', 'Iron scrap', 'Grave-steel scrap', 'Obsidian shard', 'Ember slag', 'Styx silt', 'Nightglass sliver', 'Lantern-gold flake'];

export type Item =
  | { kind: 'weapon'; key: string; type: string; tier: number; def: WeaponDef }
  | { kind: 'shield'; key: string; type: string; tier: number; def: ShieldDef }
  | { kind: 'armor'; key: string; type: string; tier: number; def: ArmorDef }
  | { kind: 'charm'; key: string; stat: StatKey; amount: number }
  | { kind: 'scrap'; key: string; tier: number };

/** Parses an item key: type@tier for gear, charm.<stat><n>, scrap.<tier>. */
export function item(key: string): Item | null {
  const at = key.indexOf('@');
  if (at > 0) {
    const type = key.slice(0, at), tier = Number(key.slice(at + 1));
    if (!(tier >= 1 && tier <= MAX_TIER && Number.isInteger(tier))) return null;
    if (weapons[type]) return { kind: 'weapon', key, type, tier, def: weapons[type] };
    if (shields[type]) return { kind: 'shield', key, type, tier, def: shields[type] };
    if (armors[type]) return { kind: 'armor', key, type, tier, def: armors[type] };
    return null;
  }
  const charm = /^charm\.([asdrm])(\d)$/.exec(key);
  if (charm) return { kind: 'charm', key, stat: charm[1] as StatKey, amount: Number(charm[2]) };
  const scrap = /^scrap\.(\d)$/.exec(key);
  if (scrap && Number(scrap[1]) >= 1 && Number(scrap[1]) <= MAX_TIER) return { kind: 'scrap', key, tier: Number(scrap[1]) };
  return null;
}

export function itemName(key: string): string {
  const it = item(key);
  if (!it) return key;
  if (it.kind === 'charm') return `${charmNames[it.stat]} (+${it.amount} ${statNames[it.stat]})`;
  if (it.kind === 'scrap') return scrapNames[it.tier];
  return `${tiers[it.tier]!.name} ${it.def.name.toLowerCase()}`;
}

const round10 = (x: number) => Math.round(x / 10) * 10;

/** What the Sutler charges; he buys back at 40%. */
export function value(key: string): number {
  const it = item(key);
  if (!it) return 0;
  if (it.kind === 'charm') return 300 * it.amount * it.amount;
  if (it.kind === 'scrap') return Math.round(6 * 1.9 ** (it.tier - 1));
  return Math.max(10, round10(120 * 2.2 ** (it.tier - 1) * it.def.factor));
}

export const sellPrice = (key: string) => Math.floor(.4 * value(key));

/** Gear and charms take a pack slot each; scrap stacks to 999. */
export const stacks = (key: string) => key.startsWith('scrap.');

export function slotOf(key: string): Slot | null {
  const it = item(key);
  if (!it || it.kind === 'scrap') return null;
  return it.kind;
}

/** The level a shade needs to equip an item. */
export function levelNeeded(key: string): number {
  const it = item(key);
  if (!it || it.kind === 'scrap') return 1;
  if (it.kind === 'charm') return Math.max(1, (it.amount - 2) * 20);
  return tiers[it.tier]!.level;
}

/** Bows, crossbows, slings and staves need both hands except for a buckler on the arm. */
export function shieldAllowed(weaponKey: string | null, shieldKey: string): boolean {
  if (!weaponKey) return true;
  const w = item(weaponKey);
  if (!w || w.kind !== 'weapon') return true;
  if (w.def.twoHanded) return false;
  if (w.def.style !== 'melee') return shieldKey.startsWith('buckler@');
  return true;
}

export function describe(key: string): string {
  const it = item(key);
  if (!it) return '';
  if (it.kind === 'weapon') {
    const cycle = it.def.windup + .1 + it.def.recover;
    const hands = it.def.twoHanded ? ' · two-handed' : it.def.style !== 'melee' ? ' · buckler only' : '';
    const dmg = it.def.style === 'magic' ? 'spells' : `${it.def.damage} dmg`;
    return `${it.def.style} · ${dmg} · ${cycle.toFixed(2)} s · +${Math.round(powerBonus(it.tier) * 100)}% power${hands}`;
  }
  if (it.kind === 'shield') return `${Math.round(it.def.defense * armorMul(it.tier))} armor`;
  if (it.kind === 'armor') {
    const ev = Math.round(it.def.evasion * 100);
    return `${Math.round(it.def.defense * armorMul(it.tier))} armor · ${ev >= 0 ? '+' : ''}${ev}% evasion · ${it.def.style} +${Math.round((it.def.power - 1) * 100)}%`;
  }
  if (it.kind === 'charm') return `+${it.amount} ${statNames[it.stat]}`;
  return 'material, for later crafting';
}
