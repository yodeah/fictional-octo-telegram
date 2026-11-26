'use strict';

const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const elements = Object.fromEntries(
  ['bout', 'status', 'cast', 'hitboxes', 'result', 'winner', 'play', 'reset', 'generate', 'speed', 'repeat', 'log', 'record']
    .map(id => [id, document.getElementById(id)])
);
const weapons = {
  sword: { name: 'Sword', range: 2.38, damage: 13, energy: 20, block: .25, tempo: 1, rest: 1.15, draw: 1.21, swing: 1.26, lift: .67, extension: .49 },
  spear: { name: 'Spear', range: 3.05, damage: 10, energy: 18, block: .30, tempo: 1.08, rest: .31, draw: .16, swing: .31, lift: .08, extension: .49 },
  axe: { name: 'Axe', range: 2.08, damage: 17, energy: 29, block: .31, tempo: .88, rest: 1.20, draw: 1.35, swing: 1.39, lift: .76, extension: .43 },
  mace: { name: 'Mace', range: 2.03, damage: 15, energy: 24, block: .25, tempo: .95, rest: .98, draw: 1.51, swing: 1.13, lift: .61, extension: .43 },
  flail: { name: 'Flail', range: 2.48, damage: 14, energy: 26, block: .16, tempo: .84, rest: .72, draw: 1.39, swing: .82, lift: .62, extension: .46 },
  crossbow: { name: 'Crossbow', style: 'ranged', range: 4.55, damage: 14, energy: 16, block: .19, tempo: .85, rest: .18, draw: .64, swing: .18, lift: .19, extension: .48 },
  staff: { name: 'Staff', range: 2.48, damage: 8, spellPower: 1.30, energy: 16, block: .24, tempo: 1, rest: 1.29, draw: 1.23, swing: 1.39, lift: .44, extension: .48 },
  greatsword: { name: 'Greatsword', twoHanded: true, accuracy: 18, range: 2.88, damage: 23, energy: 34, block: .25, tempo: .77, rest: 1.21, draw: 1.17, swing: 1.30, lift: .65, extension: .52 },
  maul: { name: 'War maul', twoHanded: true, accuracy: 15, range: 2.35, damage: 26, energy: 39, block: .30, tempo: .71, rest: 1.08, draw: 1.30, swing: 1.20, lift: .66, extension: .49 }
};
const variants = {
  rapier: ['sword', { name: 'Rapier', range: 2.61, damage: 11, energy: 17, accuracy: 12, tempo: 1.12, block: .29, draw: .89, swing: 1.24 }],
  falchion: ['sword', { name: 'Falchion', range: 2.42, damage: 16, energy: 24, tempo: .93, block: .23, lift: .73 }],
  claymore: ['greatsword', { name: 'Claymore', range: 2.98, damage: 24, energy: 36, accuracy: 20, tempo: .75 }],
  executioner: ['greatsword', { name: 'Executioner blade', range: 2.65, damage: 28, energy: 43, accuracy: 11, tempo: .68, block: .22 }],
  trident: ['spear', { name: 'Trident', range: 3.06, damage: 13, energy: 22, accuracy: 8, tempo: .95 }],
  halberd: ['spear', { name: 'Halberd', twoHanded: true, range: 3.11, damage: 22, energy: 33, accuracy: 13, tempo: .76, rest: .58, draw: .78, swing: .52, lift: .20 }],
  beardedAxe: ['axe', { name: 'Bearded axe', range: 2.23, damage: 19, energy: 30, accuracy: 4, tempo: .87 }],
  crescentAxe: ['axe', { name: 'Crescent axe', twoHanded: true, range: 2.47, damage: 24, energy: 36, accuracy: 12, tempo: .74, lift: .80 }],
  morningstar: ['mace', { name: 'Morningstar', range: 2.22, damage: 18, energy: 27, accuracy: 5, tempo: .89 }],
  club: ['mace', { name: 'Bronzewood club', range: 2.15, damage: 13, energy: 17, tempo: 1.04, block: .30 }],
  scourge: ['flail', { name: 'Chain scourge', range: 2.66, damage: 12, energy: 21, accuracy: 5, tempo: .93, block: .10, chain: .66 }],
  twinFlail: ['flail', { name: 'Twin flail', range: 2.47, damage: 19, energy: 31, tempo: .76, block: .14 }],
  pickhammer: ['maul', { name: 'War pick', range: 2.39, damage: 20, energy: 29, accuracy: 21, tempo: .82, block: .22 }],
  sledge: ['maul', { name: 'Stone sledge', range: 2.40, damage: 30, energy: 46, accuracy: 8, tempo: .65 }],
  arbalest: ['crossbow', { name: 'Windlass arbalest', twoHanded: true, range: 4.74, damage: 21, energy: 24, tempo: .67, block: .21 }],
  repeater: ['crossbow', { name: 'Repeating bow', range: 4.25, damage: 11, energy: 12, tempo: 1.04, block: .16 }],
  ashScepter: ['staff', { name: 'Ash scepter', range: 2.40, spellPower: 1.24, castTempo: 1.13, block: .21 }],
  sunStaff: ['staff', { name: 'Sun staff', twoHanded: true, range: 2.55, spellPower: 1.41, castTempo: .88 }]
};
for (const [key, [family, stats]] of Object.entries(variants)) weapons[key] = { ...weapons[family], ...stats, family };
const weaponFamily = key => weapons[key]?.family || key;
const weaponGroups = { sword: 'Blades', greatsword: 'Blades', spear: 'Polearms', axe: 'Axes', mace: 'Impact weapons',
  maul: 'Impact weapons', flail: 'Flails', crossbow: 'Ranged', staff: 'Staves' };
const shields = {
  buckler: { name: 'Buckler', defense: 11, mobility: 1.08, energy: 9, bashTempo: 1.35, bashPower: .8, width: .24, height: .29, shape: 1 },
  round: { name: 'Round shield', defense: 20, mobility: 1, energy: 15, bashTempo: 1, bashPower: 1, width: .34, height: .43, shape: 1 },
  tower: { name: 'Tower shield', defense: 34, mobility: .76, energy: 22, bashTempo: .82, bashPower: 1.4, width: .40, height: .61, shape: .66 }
};
// Testing only: ?force=perfect,wall,sand,oath,mender,pull makes those events trigger whenever they can
// (oath and mender: at any health below full; pull: at a shorter distance).
const forced = new Set((new URLSearchParams(location.search).get('force') || '').split(',').filter(Boolean));
const perfectColor = '#ffe9a8';
const sandColors = ['#e2c98f', '#c9a96b', '#f1deb0'];
const bonusTypes = ['Stab', 'Slash', 'Crush', 'Magic', 'Ranged'];
const meleeTypes = { sword: 1, spear: 0, axe: 1, mace: 2, flail: 2, staff: 2, greatsword: 1, maul: 2 };
const meleeType = key => ['rapier', 'pickhammer'].includes(key) ? 0 : key === 'halberd' ? 1 : meleeTypes[weaponFamily(key)];
const styles = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };
const armors = {
  plate: {
    name: 'Plate', style: 'melee', power: 1.06, defense: 12, mobility: .94, color: [142, 139, 127],
    melee: .96, ranged: .75, magic: 1.29, attackBonus: [3, 4, 1, -18, -9], defenseBonus: [26, 36, 19, -10, 34]
  },
  leather: {
    name: 'Leather', style: 'ranged', power: 1.09, defense: 7, mobility: 1.04, color: [113, 80, 52],
    melee: 1.23, ranged: .96, magic: .76, attackBonus: [0, 1, 0, -4, 15], defenseBonus: [8, 12, 7, 29, 20]
  },
  robes: {
    name: 'Robes', style: 'magic', power: 1.12, defense: 3, mobility: 1.06, color: [91, 75, 124],
    melee: 1.10, ranged: 1.28, magic: .96, attackBonus: [-2, -2, 0, 18, -6], defenseBonus: [3, 4, 5, 17, -5]
  }
};
const armorVariants = {
  bronze: ['plate', { name: 'Bronze lorica', cut: 'lamellar', color: [141, 105, 75], shell: [181, 133, 79], edging: [105, 65, 47], defense: 10, mobility: .99, attackBonus: [4, 5, 2, -12, -5], defenseBonus: [21, 27, 16, -8, 26] }],
  fortress: ['plate', { name: 'Blackiron harness', cut: 'fortress', color: [64, 75, 88], shell: [94, 114, 131], edging: [165, 161, 130], defense: 18, mobility: .84, power: 1.08, attackBonus: [2, 3, 6, -22, -14], defenseBonus: [33, 40, 30, -15, 42] }],
  gilded: ['plate', { name: 'Gilded parade plate', cut: 'ornate', color: [134, 115, 77], shell: [205, 170, 108], edging: [127, 77, 61], defense: 13, mobility: .95, power: 1.10, attackBonus: [4, 11, 1, -17, -9], defenseBonus: [23, 39, 20, -11, 31] }],
  scout: ['leather', { name: 'Dune scout leathers', cut: 'mantle', color: [155, 112, 70], shell: [183, 137, 84], edging: [221, 188, 116], defense: 5, mobility: 1.10, attackBonus: [1, 0, 0, -3, 17], defenseBonus: [6, 8, 6, 21, 17] }],
  brigandine: ['leather', { name: 'Crimson brigandine', cut: 'lamellar', color: [116, 49, 47], shell: [151, 72, 60], edging: [194, 144, 92], defense: 10, mobility: 1, power: 1.08, attackBonus: [0, 2, 3, -6, 12], defenseBonus: [13, 17, 11, 24, 23] }],
  nightHide: ['leather', { name: 'Nightstalker hide', cut: 'night', color: [53, 70, 60], shell: [76, 110, 87], edging: [145, 163, 91], defense: 7, mobility: 1.04, power: 1.12, attackBonus: [0, 0, 0, -2, 21], defenseBonus: [6, 10, 8, 36, 16] }],
  tide: ['robes', { name: 'Tideweave robes', cut: 'mantle', color: [47, 110, 130], edging: [145, 224, 220], defense: 4, mobility: 1.09, power: 1.10, attackBonus: [-3, -2, 0, 15, -5], defenseBonus: [3, 5, 4, 24, -3] }],
  cinder: ['robes', { name: 'Cinder robes', cut: 'ornate', color: [126, 55, 51], edging: [255, 163, 82], defense: 3, mobility: 1.04, power: 1.17, attackBonus: [-3, 1, 0, 21, -8], defenseBonus: [2, 4, 5, 12, -9] }],
  astral: ['robes', { name: 'Astral vestments', cut: 'astral', color: [66, 82, 119], edging: [180, 199, 246], defense: 5, mobility: 1.03, power: 1.14, attackBonus: [-5, -3, -1, 23, -7], defenseBonus: [7, 5, 6, 20, -7] }]
};
for (const [key, [base, stats]] of Object.entries(armorVariants)) armors[key] = { ...armors[base], ...stats };
const gearLabels = { weapon: 'Main', reserve: 'Backup', shield: 'Shield', armor: 'Armor', spellbook: 'Spellbook' };
const signed = value => value > 0 ? '+' + value : String(value);

function armorDetails(detail, kit, automatic) {
  const name = document.createElement('strong');
  name.textContent = kit.name + ' armor';
  const table = document.createElement('table');
  for (const labels of [['Type', 'Attack', 'Defense'], ...bonusTypes.map((type, index) => [
    type, signed(kit.attackBonus[index]), signed(kit.defenseBonus[index])
  ])]) {
    const row = document.createElement('tr');
    for (const [index, label] of labels.entries()) {
      const cell = document.createElement(index === 0 || labels[0] === 'Type' ? 'th' : 'td');
      cell.textContent = label;
      row.append(cell);
    }
    table.append(row);
  }
  const style = styles[kit.style];
  const power = document.createElement('div');
  power.textContent = 'Defense +' + kit.defense + ' · Speed ' + Math.round(kit.mobility * 100) + '%';
  const other = document.createElement('div');
  other.textContent = style + ' power +' + Math.round((kit.power - 1) * 100) + '%';
  detail.replaceChildren(name, table, power, other);
  if (automatic) detail.append(document.createTextNode('Kept until you generate a new matchup.'));
}
const spells = {
  ember: { name: 'Ember Bolt', icon: '✦', cost: 26, cooldown: 4.5, damage: 19, color: '#ffab64', effect: 'Reliable fire projectile', block: .12 },
  ward: { name: 'Iron Ward', icon: '◆', cost: 27, cooldown: 19, absorb: 15, duration: 5, color: '#ffda84' },
  heal: { name: 'Second Wind', icon: '✚', cost: 31, cooldown: 22, heal: 16, color: '#c2eca1' },
  drain: { name: 'Crimson Drain', icon: '✦', cost: 23, cooldown: 5, damage: 14, lifesteal: .52, color: '#f18b91', effect: 'Restores 52% of damage dealt as health', block: .11 },
  surge: { name: 'Scarlet Surge', icon: '✹', cost: 38, cooldown: 8.5, damage: 26, lifesteal: .27, color: '#ff9784', effect: 'Restores 27% of damage dealt as health', block: .10 },
  pact: { name: 'Blood Pact', icon: '◆', cost: 6, cooldown: 12, hpCost: 9, manaRestore: 25, color: '#e98baf', effect: 'Trade 9 HP for 25 mana' },
  frost: { name: 'Frost Lance', icon: '❄', cost: 21, cooldown: 4.5, damage: 15, chill: 3.5, ice: true, color: '#a9e6ff', effect: 'Slows the target for 3.5 seconds', block: .15 },
  barrage: { name: 'Winter Barrage', icon: '❅', cost: 37, cooldown: 10.5, damage: 22, freeze: 2.4, ice: true, color: '#c5eaff', effect: 'Immobilizes the target for 2.4 seconds', block: .10 },
  shell: { name: 'Glacial Shell', icon: '⬡', cost: 22, cooldown: 11, absorb: 13, duration: 4, color: '#b5ebf5' },
  arc: { name: 'Arc Flash', icon: 'ϟ', cost: 20, cooldown: 4, damage: 13, energyDrain: 14, lightning: true, color: '#d3c6ff', effect: 'Drains up to 14 energy from the target', block: .12 },
  thunder: { name: 'Thunderclap', icon: '✹', cost: 41, cooldown: 10, damage: 30, lightning: true, color: '#edd8ff', effect: 'Heavy burst damage', block: .14 },
  tailwind: { name: 'Tailwind', icon: '✧', cost: 23, cooldown: 11, energyRestore: 27, haste: 4.5, color: '#cce8a0', effect: 'Restores energy and speeds movement for 4.5 seconds' },
  spark: { name: 'Staff Spark', damage: 8, cost: 0, cooldown: 0, color: '#d1b7ff', block: .10 }
};
const spellbooks = {
  general: { name: 'General', focus: 'Reliable damage, protection, and recovery.', spells: ['ember', 'ward', 'heal'] },
  vampiric: { name: 'Vampiric', focus: 'Sustain through damage and trade health for mana.', spells: ['drain', 'surge', 'pact'] },
  glacial: { name: 'Glacial', focus: 'Slow, freeze, and hold opponents at range.', spells: ['frost', 'barrage', 'shell'] },
  storm: { name: 'Storm', focus: 'Burst damage and energy control for aggressive fighters.', spells: ['arc', 'thunder', 'tailwind'] }
};
const gearChoices = { weapon: weapons, reserve: { ...weapons, none: { name: 'None' } }, shield: shields, armor: armors, spellbook: spellbooks };
const specialMark = '★ ';
// The special a fighter owns, and the one that applies to a given weapon (the held one by default).
const ownedSpecial = fighter => specials[fighter.gear.special] || null;
const specialOf = (fighter, key = fighter.weapon) => ownedSpecial(fighter)?.weapon === key ? ownedSpecial(fighter) : null;
const weaponName = (fighter, key) => specialOf(fighter, key)?.name || weapons[key].name;
// Weapon pickers list specials by their own key; this resolves a picker value to the weapon it uses.
const pickedWeapon = value => specials[value]?.weapon || value;
const manaRegen = 3.6;
const energyRegen = 5;
const switchCost = 7;
const fighters = [
  { name: 'Varro', gear: { weapon: 'sword', reserve: 'staff', shield: 'round', armor: 'plate', spellbook: 'general', special: 'none' }, level: 54, attack: 69, magic: 68, defense: 25, strength: 73, ranged: 54, maxHP: 108, direction: 1, color: [157, 62, 42], trim: [242, 143, 96], wins: 0 },
  { name: 'Cassian', gear: { weapon: 'spear', reserve: 'crossbow', shield: 'round', armor: 'leather', spellbook: 'glacial', special: 'none' }, level: 57, attack: 64, magic: 80, defense: 28, strength: 63, ranged: 76, maxHP: 100, direction: -1, color: [49, 102, 110], trim: [143, 208, 202], wins: 0 }
];

function equipmentPicker(fighter, prefix, type, choices) {
  const wrapper = document.createElement('div');
  wrapper.className = 'gear';
  const select = document.createElement('select');
  const label = document.createElement('label');
  const detail = document.createElement('div');
  select.id = prefix + type;
  select.setAttribute('aria-label', fighter.name + ' ' + (type === 'reserve' ? 'backup weapon' : type));
  label.htmlFor = select.id;
  label.textContent = gearLabels[type];
  detail.id = select.id + '-details';
  detail.className = 'item-detail';
  if (type === 'armor') detail.classList.add('armor-detail');
  detail.setAttribute('role', 'tooltip');
  select.setAttribute('aria-describedby', detail.id);
  const automatic = new Option('Auto', 'auto');
  select.add(automatic);
  const groups = new Map();
  for (const [key, item] of Object.entries(choices)) {
    const group = type === 'armor' ? styles[item.style] : weaponGroups[weaponFamily(key)];
    const option = new Option(item.name, key);
    if (!group) {
      select.add(option);
      continue;
    }
    if (!groups.has(group)) {
      const container = document.createElement('optgroup');
      container.label = group;
      select.append(container);
      groups.set(group, container);
    }
    groups.get(group).append(option);
  }
  if (type === 'weapon' || type === 'reserve') {
    const container = document.createElement('optgroup');
    container.label = specialMark + 'Special weapons';
    for (const [key, special] of Object.entries(specials)) container.append(new Option(specialMark + special.name, key));
    select.append(container);
  }
  select.value = 'auto';
  select.describe = () => {
    const held = weapons[fighter.gear[type]] && specialOf(fighter, fighter.gear[type]) ? fighter.gear.special : fighter.gear[type];
    const special = specials[select.value === 'auto' ? held : select.value];
    const key = special ? special.weapon : select.value === 'auto' ? fighter.gear[type] : select.value;
    const item = choices[key];
    label.textContent = gearLabels[type] + (select.value === 'auto' ? ' · Auto' : '');
    automatic.text = (specials[held] ? specialMark + specials[held].name : choices[fighter.gear[type]].name) + ' · Auto';
    if (type === 'armor') {
      armorDetails(detail, item, select.value === 'auto');
      return;
    }
    const lines = [special ? specialMark + special.name : item.name];
    if (special) lines.push('Special ' + item.name + ' · ' + special.effect,
      'Generated fighters carry a special ' + Math.round(specialChance * 100) + '% of the time · One per fighter');
    if (type === 'spellbook') {
      lines.push(item.focus, ...item.spells.map(key => spells[key].name + ' · ' + spells[key].cost + ' MP'));
    } else if (type === 'reserve' && key === 'none') {
      lines.push('Travel lighter with one weapon');
    } else if (type === 'weapon' || type === 'reserve') {
      const handling = powerProfile(item, fighter.strength);
      lines.push('Base damage ' + Math.round(item.damage * handling.power) + ' · Reach ' + item.range.toFixed(1),
        'Speed ' + Math.round(item.tempo * 100) + '% · ' + handling.cost + ' energy per attack');
      if (handling.heavy) lines.push('High stance damage · Strength shortens recovery');
      if (item.spellPower) lines.push('+' + Math.round((item.spellPower - 1) * 100) + '% spell power · Free Staff Spark');
      if (item.style === 'ranged') lines.push('Ranged bolts · Strong against robes', 'Reduced damage and accuracy up close');
      if (item.accuracy) lines.push('+' + item.accuracy + ' ' + bonusTypes[meleeType(key)] + ' attack');
      if (item.twoHanded) lines.push('Uses both hands · Shield is stowed');
      if (type === 'reserve') lines.push('Carrying a spare lowers speed by 4% · Swaps cost ' + switchCost + ' energy');
    } else if (type === 'shield') {
      lines.push('Defense +' + item.defense, 'Speed ' + Math.round(item.mobility * 100) + '% · ' + item.energy + ' energy per block');
      lines.push('Bash speed ' + Math.round(item.bashTempo * 100) + '% · Bash power ' + Math.round(item.bashPower * 100) + '%',
        '14 energy per shield bash · Active with one-handed weapons');
    }
    if (select.value === 'auto') lines.push('Kept until you generate a new matchup.');
    detail.textContent = lines.join('\n');
  };
  select.addEventListener('change', () => {
    const other = type === 'weapon' ? fighter.loadout.reserve : type === 'reserve' ? fighter.loadout.weapon : null;
    // One weapon per slot and one special per fighter.
    if (other && select.value !== 'auto' && other.value !== 'auto' && (pickedWeapon(other.value) === pickedWeapon(select.value)
      || (specials[other.value] && specials[select.value]))) other.value = 'auto';
    if (state === 'ready') {
      applyGear(fighter);
      updateStats(fighter);
      updateSpecialHud(fighter);
    }
    Object.values(fighter.loadout).forEach(picker => picker.describe());
    updateGearNote(fighter);
  });
  wrapper.append(label, select, detail);
  fighter.hud[type === 'spellbook' ? 'book' : 'loadout'].append(wrapper);
  return select;
}

fighters.forEach((fighter, index) => {
  const prefix = index === 0 ? 'red-' : 'blue-';
  fighter.hud = Object.fromEntries(['hp', 'meter', 'mp', 'mana', 'ep', 'energy', 'stance', 'balance', 'stats', 'loadout', 'book', 'queued', 'spells', 'level', 'active', 'special']
    .map(key => [key, document.getElementById(prefix + key)]));
  fighter.loadout = Object.fromEntries(Object.entries(gearChoices)
    .map(([type, choices]) => [type, equipmentPicker(fighter, prefix, type, choices)]));
  fighter.stats = Object.fromEntries(['Attack', 'Defense', 'Strength', 'Ranged', 'Magic', 'Health'].map(name => {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = name;
    group.append(term, value);
    fighter.hud.stats.append(group);
    return [name, value];
  }));
});

function applySpellbook(fighter) {
  const keys = spellbooks[fighter.gear.spellbook].spells;
  if (fighter.spells === keys) return;
  fighter.spells = keys;
  fighter.hud.spells.replaceChildren();
  fighter.spellBadges = Object.fromEntries(keys.map(key => {
    const spell = spells[key];
    const badge = document.createElement('div');
    badge.className = 'spell';
    badge.style.setProperty('--spell-color', spell.color);
    const icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = spell.icon;
    const cost = document.createElement('small');
    cost.textContent = spell.cost;
    badge.append(icon, spell.name, cost);
    fighter.hud.spells.append(badge);
    return [key, badge];
  }));
}
const particles = [];
const faces = [];
const armor = [135, 125, 108];
const metal = [192, 194, 182];
const leather = [89, 54, 37];
const skin = [183, 118, 77];
const speeds = [1, 2, 4];
let speedIndex = 0;
let state = 'ready';
let bout = 1;
let elapsed = 0;
let visualClock = 0;
let sceneryClock = 0;
let rematchDelay = 0;
let fall = 0;
let showHitboxes = false;
let hitPause = 0;
let width, height, scale;
let backdrop;
let scenery;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const ease = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const smooth = value => {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const choose = options => options[Math.floor(Math.random() * options.length)];
const weaponClass = key => weapons[key].spellPower ? 'magic' : weapons[key].style || 'melee';
const weaponKeys = fighter => [fighter.gear.weapon, fighter.gear.reserve].filter(key => key !== 'none');
const carriesSpare = fighter => fighter.gear.reserve !== 'none';
const shieldReady = fighter => !weapons[fighter.weapon].twoHanded;
const mobility = fighter => (shieldReady(fighter) ? shields[fighter.gear.shield].mobility : 1) * armors[fighter.gear.armor].mobility
  * (carriesSpare(fighter) ? .96 : 1) * (fighter.hastedUntil > elapsed ? 1.12 : 1);
const defense = fighter => fighter.defense + (shieldReady(fighter) ? shields[fighter.gear.shield].defense : 0) + armors[fighter.gear.armor].defense;
const attackType = (style, key) => style === 'magic' ? 3 : style === 'ranged' ? 4 : meleeType(key);

function accuracyBonus(attacker, defender, style, key) {
  const type = attackType(style, key);
  const weaponBonus = style === 'melee' ? weapons[key].accuracy || 0 : 0;
  return armors[attacker.gear.armor].attackBonus[type] + weaponBonus - armors[defender.gear.armor].defenseBonus[type];
}
const armorPower = (fighter, style) => {
  const armor = armors[fighter.gear.armor];
  return armor.style === style ? armor.power : 1;
};
const closeRange = distance => 1 - smooth((distance - 1.8) / 1.30);
const canPress = fighter => weaponKeys(fighter).some(key => weaponClass(key) === 'melee');

function applyGear(fighter) {
  const previous = fighter.gear;
  const gear = {};
  const { reserve } = fighter.loadout;
  const assign = (type, excluded, differentStyle) => {
    const picked = pickedWeapon(fighter.loadout[type].value);
    if (picked !== 'auto' && picked !== excluded) return picked;
    if (previous[type] !== excluded) return previous[type];
    const available = Object.keys(gearChoices[type]).filter(key => key !== excluded && key !== 'none');
    if (differentStyle && excluded && weapons[excluded]) {
      const alternatives = available.filter(key => weaponClass(key) !== weaponClass(excluded));
      if (alternatives.length) return choose(alternatives);
    }
    return choose(available);
  };
  gear.weapon = assign('weapon', weapons[pickedWeapon(reserve.value)] ? pickedWeapon(reserve.value) : null, true);
  gear.reserve = assign('reserve', gear.weapon, true);
  gear.shield = assign('shield');
  gear.armor = assign('armor');
  gear.spellbook = assign('spellbook');
  // A special picked in either weapon slot wins. Otherwise the fighter keeps their special while its
  // weapon stays equipped, unless a slot is pinned to the plain version of that weapon.
  const slots = [fighter.loadout.weapon.value, reserve.value];
  const kept = specials[previous.special];
  const keep = kept && [gear.weapon, gear.reserve].includes(kept.weapon) && !slots.includes(kept.weapon);
  gear.special = slots.find(value => specials[value]) || (keep ? previous.special : 'none');
  fighter.gear = gear;
  fighter.weapon = gear.weapon;
  applySpellbook(fighter);
  Object.values(fighter.loadout).forEach(picker => picker.describe());
}

function updateStats(fighter) {
  const meleeBonus = weapons[fighter.weapon].accuracy || 0;
  const stats = { Attack: fighter.attack + meleeBonus, Defense: defense(fighter), Strength: fighter.strength,
    Ranged: fighter.ranged, Magic: fighter.magic, Health: fighter.maxHP };
  for (const [name, value] of Object.entries(stats)) fighter.stats[name].textContent = value;
  fighter.hud.level.textContent = 'Lv ' + fighter.level;
  const stowed = fighter.weapon === fighter.gear.weapon ? fighter.gear.reserve : fighter.gear.weapon;
  const marked = key => (specialOf(fighter, key) ? specialMark : '') + weaponName(fighter, key);
  fighter.hud.active.textContent = marked(fighter.weapon) + ' held' + (weapons[stowed] ? ' · ' + marked(stowed) + ' stowed' : ' · No spare')
    + (shieldReady(fighter) ? '' : ' · Shield on back');
  const power = (weapons[fighter.weapon].spellPower || 1) * armorPower(fighter, 'magic');
  for (const key of fighter.spells) {
    const spell = spells[key];
    let effect = spell.effect;
    if (spell.heal) effect = 'Restores up to ' + Math.round(spell.heal * power) + ' HP';
    if (spell.absorb) effect = 'Absorbs up to ' + Math.round(spell.absorb * power) + ' damage for ' + spell.duration + ' seconds';
    if (spell.damage) effect += ' · ' + Math.round(spell.damage * power * (.76 + fighter.magic / 300)) + ' damage before armor';
    fighter.spellBadges[key].title = effect + ' · ' + spell.cost + ' MP';
  }
}

function updateGearNote(fighter) {
  fighter.hud.queued.hidden = Object.entries(fighter.loadout)
    .every(([type, picker]) => picker.value === 'auto' || (specials[picker.value]
      ? fighter.gear.special === picker.value && pickedWeapon(picker.value) === fighter.gear[type] : picker.value === fighter.gear[type]));
}

function project([x, y, z]) {
  const depth = z + y * .16;
  const size = scale * 12 / (12 - depth);
  return [width / 2 + x * size, height * .81 + (z * .25 - y) * size, depth];
}

function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}

// Every fighter, armor and weapon part ends up here. A face costs build, sort and paint time
// whether or not it ends up visible, so skip faces that can never be seen (as prism() does for
// back-facing sides). Measured costs per face are in docs/rendering-performance.md.
function surface(points, color, light, transform) {
  const projected = points.map(point => project(transform(point)));
  const depth = projected.reduce((sum, point) => sum + point[2], 0) / projected.length;
  const rgb = color.map(channel => clamp(Math.round(channel * light), 0, 255));
  faces.push({ projected, depth, rgb });
}

const ringAngles = new Map();
function circleProfile(sides, roll = 0) {
  const key = sides + ':' + roll;
  if (!ringAngles.has(key)) {
    ringAngles.set(key, Array.from({ length: sides }, (_, index) => {
      const angle = index * 2 * Math.PI / sides + roll;
      return { cosine: Math.cos(angle), sine: Math.sin(angle), angle };
    }));
  }
  return ringAngles.get(key);
}

function prism(from, to, base, tip, color, transform, sides = 4, roll = Math.PI / 4) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const angles = circleProfile(sides, roll);
  const bevel = Math.min(.23, Math.max(...base, ...tip) * .65 / length);
  const sections = [[0, .74], [bevel, 1.04], [1 - bevel, 1], [1, .76]];
  const profiles = sections.map(([t, bevelScale]) => {
    const [x, y, z] = pointBetween(from, to, t);
    const radialWidth = mix(base[0], tip[0], t) * bevelScale;
    const radialDepth = mix(base[1], tip[1], t) * bevelScale;
    return angles.map(({ cosine, sine }) => [
      x + dy / length * cosine * radialWidth,
      y - dx / length * cosine * radialWidth,
      z + sine * radialDepth
    ]);
  });
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    if (angles[i].sine + angles[j].sine < -.01) continue;
    const direction = angles[i].angle + Math.PI / sides;
    const light = .84 + .26 * Math.cos(direction - .26) + .15 * Math.sin(direction);
    for (let row = 1; row < profiles.length; row++) {
      const a = profiles[row - 1];
      const b = profiles[row];
      const face = row === 3 && tip[0] === 0 && tip[1] === 0 ? [a[i], a[j], b[i]] : [a[i], a[j], b[j], b[i]];
      surface(face, color, light * (row === 1 ? .85 : row === 3 ? 1.18 : 1), transform);
    }
  }
  if (tip[0] > 0 || tip[1] > 0) surface(profiles[3], color, 1.16, transform);
}

function shield(cx, cy, z, fighter, transform) {
  const gear = shields[fighter.gear.shield];
  const contour = value => Math.sign(value) * Math.pow(Math.abs(value), gear.shape);
  const sides = gear.shape < .9 ? 16 : 20;
  const ring = (radius, depth) => circleProfile(sides, Math.PI / sides).map(({ cosine, sine }) =>
    [cx + contour(cosine) * radius * gear.width, cy + contour(sine) * radius * gear.height, depth]);
  const rim = ring(1, z);
  const bead = ring(.91, z + .047);
  const panel = ring(.80, z + .034);
  const boss = ring(.29, z + .10);
  const crown = ring(.22, z + .158);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const light = 1 + Math.cos((i + .5) * Math.PI * 2 / sides - .60) * .26;
    surface([rim[i], rim[j], bead[j], bead[i]], darkSteel, light * .97, transform);
    surface([bead[i], bead[j], panel[j], panel[i]], bronze, light * 1.21, transform);
    surface([panel[i], panel[j], boss[j], boss[i]], fighter.color, light, transform);
    surface([boss[i], boss[j], crown[j], crown[i]], armor, light, transform);
    if (i % 2 === 0) {
      const [rx, ry] = bead[i];
      surface([[rx, ry + .017, z + .07], [rx + .014, ry, z + .07], [rx, ry - .018, z + .07], [rx - .014, ry, z + .07]], metal, 1.11, transform);
    }
  }
  surface(crown, metal, 1.09, transform);
  surface(ring(.131, z + .168), bronze, 1.23, transform);
  for (const side of [-1, 1]) {
    const y = cy + gear.height * side * .47;
    surface([[cx - gear.width * .36, y, z + .093], [cx, y + side * .034, z + .097],
      [cx + gear.width * .36, y, z + .093], [cx, y - side * .033, z + .104]], fighter.trim, 1.06, transform);
  }
}

function weaponAxis(hand, angle) {
  const [x, y, z] = hand;
  return (distance, offset = 0) => [
    x + Math.cos(angle) * distance - Math.sin(angle) * offset,
    y + Math.sin(angle) * distance + Math.cos(angle) * offset,
    z
  ];
}

function flailChain(anchor, windup, strike, clock, fraction, length = .48, offset = 0) {
  const angle = -1.48 + Math.sin(clock * 7) * .13 * (1 - strike) - windup * 2.8 + strike * 1.50 + offset;
  return shifted(anchor, Math.cos(angle) * length * fraction,
    Math.sin(angle) * length * fraction - .14 * (1 - strike) * Math.sin(Math.PI * fraction), offset * .19 * fraction);
}

function flailTrails(key, anchor, windup, strike, clock) {
  if (key === 'twinFlail') return [-.23, .23].map(offset => fraction => flailChain(anchor, windup, strike, clock, fraction, .46, offset));
  return [fraction => flailChain(anchor, windup, strike, clock, fraction, weapons[key].chain)];
}

function forgedBlade(along, sections, render, tint = metal) {
  for (let index = 1; index < sections.length; index++) {
    const [s0, bend0, half0, bevel0] = sections[index - 1];
    const [s1, bend1, half1, bevel1] = sections[index];
    const point = (s, bend, shift, depth) => shifted(along(s, bend + shift), 0, 0, depth);
    const leftA = point(s0, bend0, -half0, .015);
    const spineA = point(s0, bend0, 0, bevel0);
    const rightA = point(s0, bend0, half0, .015);
    const leftB = point(s1, bend1, -half1, .015);
    const spineB = point(s1, bend1, 0, bevel1);
    const rightB = point(s1, bend1, half1, .015);
    render([leftA, spineA, spineB, leftB], tint, .86);
    render([spineA, rightA, rightB, spineB], tint, 1.2);
    if (half0 > .045) {
      render([leftA, point(s0, bend0, -half0 * .78, .026), point(s1, bend1, -half1 * .78, .026), leftB], tint, 1.32);
    }
  }
}

function variantWeapon(key, along, limb, paint) {
  const family = weaponFamily(key);
  const band = (distance, width, height, color = bronze) =>
    limb(along(distance - width / 2), along(distance + width / 2), [height, height], [height, height], color, 8);
  if (family === 'sword' || family === 'greatsword') {
    const heavy = family === 'greatsword';
    const handle = heavy ? -.54 : -.29;
    limb(along(handle), along(.21), [.073, .067], [.056, .057], leather, 8);
    for (let wrap = handle + .075; wrap < .02; wrap += .088) band(wrap, .020, .075, darkSteel);
    band(handle, .082, .085);
    const guard = key === 'rapier' ? .17 : heavy ? .31 : .24;
    for (const direction of [-1, 1]) {
      limb(along(.17), along(heavy ? .33 : .05, direction * guard), [.064, .068], [.036, .056], bronze, 8);
    }
    if (key === 'rapier') {
      limb(along(.07, -.13), along(.17, .15), [.116, .070], [.090, .055], bronze, 10);
      forgedBlade(along, [[.19, 0, .053, .064], [.75, 0, .046, .05], [1.19, 0, .030, .037], [1.37, 0, 0, .016]], paint);
    } else if (key === 'falchion') {
      forgedBlade(along, [[.18, 0, .086, .062], [.46, .04, .119, .075], [.88, .10, .145, .067], [1.17, .15, .086, .045], [1.28, .22, 0, .017]], paint);
    } else if (key === 'claymore') {
      forgedBlade(along, [[.25, 0, .152, .085], [.42, 0, .164, .093], [1.21, 0, .13, .060], [1.51, 0, .095, .04], [1.74, 0, 0, .017]], paint);
      paint([shifted(along(.35), 0, 0, .102), shifted(along(.56, -.037), 0, 0, .093),
        shifted(along(1.48), 0, 0, .06), shifted(along(.56, .037), 0, 0, .093)], darkSteel, .95);
    } else {
      forgedBlade(along, [[.19, 0, .125, .083], [.44, 0, .222, .085], [1.17, 0, .226, .074], [1.46, 0, .199, .049], [1.55, .054, 0, .018]], paint, [153, 151, 139]);
      paint([shifted(along(1.19, -.055), 0, 0, .084), shifted(along(1.27), 0, 0, .083),
        shifted(along(1.19, .055), 0, 0, .084), shifted(along(1.11), 0, 0, .088)], bronze, 1.25);
    }
    return true;
  }
  if (family === 'spear') {
    limb(along(-1.15), along(1.48), [.066, .061], [.052, .050], leather, 8);
    for (const distance of [-1.12, -.19, .17, 1.36]) band(distance, .068, .070);
    if (key === 'trident') {
      for (const offset of [-.19, 0, .19]) {
        limb(along(1.40), along(1.52, offset), [.065, .057], [.040, .048], bronze, 8);
        limb(along(1.49, offset), along(1.87 - Math.abs(offset) * .32, offset), [.052, .036], [0, 0], metal, 8);
      }
    } else {
      limb(along(1.44), along(1.88), [.091, .056], [0, 0], metal, 8);
      paint([along(1.22, -.06), along(1.29, -.32), along(1.58, -.28), along(1.76, -.10),
        along(1.56, .018), along(1.20, .056)], metal, 1.10);
      paint([shifted(along(1.29, -.32), 0, 0, .027), shifted(along(1.57, -.27), 0, 0, .025),
        shifted(along(1.73, -.10), 0, 0, .026), shifted(along(1.46, -.14), 0, 0, .049)], bronze, .94);
    }
    return true;
  }
  if (family === 'axe') {
    const large = key === 'crescentAxe';
    limb(along(large ? -.72 : -.30), along(1.07), [.080, .075], [.058, .062], leather, 8);
    for (const t of [0, .16, .65, 1.02]) band(t, .060, .081);
    const outline = large ? [[.72, -.086], [1.05, .12], [1.28, .37], [1.06, .49], [.78, .52], [.54, .44], [.80, .23]]
      : [[.57, -.077], [.89, -.08], [1.07, .20], [.95, .37], [.66, .49], [.38, .41], [.60, .27]];
    paint(outline.map(([a, b]) => shifted(along(a, b), 0, 0, .073)), metal, 1.09);
    paint(outline.slice(2, 6).map(([a, b]) => shifted(along(a, b), 0, 0, .081))
      .concat([shifted(along(.80, .30), 0, 0, .087)]), armor, .84);
    paint([shifted(along(.76,.108),0,0,.086),shifted(along(.82,.18),0,0,.085),
      shifted(along(.77,.24),0,0,.087),shifted(along(.70,.174),0,0,.09)], bronze, 1.25);
    return true;
  }
  if (family === 'mace' || family === 'maul') {
    const heavy = family === 'maul';
    limb(along(heavy ? -.61 : -.30), along(.94), [.077, .077], [.068, .069], leather, 8);
    for (const t of [-.22, -.07, .18, .63]) band(t, .056, .08, key === 'club' ? bronze : darkSteel);
    if (key === 'club') {
      limb(along(.47), along(1.08), [.12, .102], [.167, .131], [152, 105, 59], 10);
      for (const t of [.62, .77, .93]) band(t, .032, .13);
    } else if (key === 'morningstar') {
      limb(along(.72), along(.91), [.094, .085], [.198, .159], armor, 10);
      limb(along(.91), along(1.09), [.198, .159], [.065, .057], metal, 10);
      for (const offset of [-1, 1]) {
        for (const t of [.77, .91, 1.03]) limb(along(t), along(t + .02, offset * .25), [.063, .064], [0, 0], metal, 6);
      }
    } else if (key === 'pickhammer') {
      limb(along(.86, -.13), along(.92, .16), [.13, .16], [.17, .16], armor, 10);
      limb(along(.89, .10), along(.94, .48), [.14, .10], [0, 0], metal, 8);
      limb(along(.86, -.05), along(.81, -.30), [.14, .16], [.132, .14], bronze, 8);
    } else {
      limb(along(.88, -.31), along(.88, .33), [.28, .265], [.28, .27], [130, 115, 100], 6);
      for (const offset of [-.22, .22]) limb(along(.61, offset), along(1.13, offset), [.044, .155], [.041, .15], darkSteel, 6);
    }
    return true;
  }
  if (family === 'crossbow') {
    const heavy = key === 'arbalest';
    const arm = heavy ? .46 : .29;
    limb(along(heavy ? -.58 : -.40), along(.81), [.132, .13], [.082, .068], leather, 10);
    limb(along(-.14, .04), along(.84, .035), [.047, .087], [.034, .058], metal, 8);
    if (!heavy) limb(along(.17, -.16), along(.55, -.17), [.088, .094], [.067, .076], bronze, 8);
    for (const side of [-1, 1]) {
      limb(along(.64), along(.62, side * arm * .67), [.072, .06], [.057, .052], armor, 8);
      limb(along(.62, side * arm * .67), along(.50, side * arm), [.052, .05], [.031, .034], bronze, 8);
      limb(along(.50, side * arm), along(heavy ? -.02 : .18), [.016, .016], [.017, .015], [215, 190, 162], 4);
    }
    band(.74, .048, .086);
    return true;
  }
  if (family === 'staff') {
    const sun = key === 'sunStaff';
    limb(along(sun ? -.94 : -.66), along(1.15), [.072, .067], [.059, .054], sun ? leather : [103, 115, 117], 8);
    for (const d of [-.39, -.16, .12, .85, 1.06]) band(d, .040, .073, sun ? bronze : armor);
    if (sun) {
      for (let spoke = 0; spoke < 8; spoke++) {
        const theta = spoke * Math.PI / 4;
        limb(along(1.29 + Math.cos(theta) * .08, Math.sin(theta) * .08),
          along(1.29 + Math.cos(theta) * .235, Math.sin(theta) * .235), [.044, .044], [0, 0], bronze, 8);
      }
      limb(along(1.16), along(1.29), [.086, .075], [.117, .105], [245, 179, 72], 10);
      limb(along(1.29), along(1.47), [.117, .105], [0, 0], [255, 210, 100], 10);
    } else {
      limb(along(1.06), along(1.27, -.11), [.081, .098], [.052, .052], darkSteel, 8);
      limb(along(1.06), along(1.27, .11), [.081, .098], [.052, .052], darkSteel, 8);
      limb(along(1.13), along(1.30), [.087, .081], [.13, .119], [89, 190, 183], 8);
      limb(along(1.30), along(1.48), [.13, .119], [.027, .032], [169, 231, 221], 8);
    }
    return true;
  }
  return false;
}

function specialTint(fighter, special) {
  const names = { metal, leather, armor, bronze, darkSteel, trim: fighter.trim };
  const swaps = new Map(Object.entries(special.palette).map(([name, color]) => [names[name], color]));
  return color => swaps.get(color) || color;
}

function weaponModel(fighter, hand, angle, windup, strike, clock, limb, transform, key = fighter.weapon) {
  const along = weaponAxis(hand, angle);
  // A special reuses its base weapon's model with its own colors and a few extra parts.
  const special = specialOf(fighter, key);
  const tint = special ? specialTint(fighter, special) : color => color;
  if (special) {
    const plain = limb;
    limb = (from, to, start, end, color, sides) => plain(from, to, start, end, tint(color), sides);
  }
  const paint = (points, color, light) => surface(points, tint(color), light, transform);
  special?.details?.({ along, limb, paint, fighter, state: fighter.special });
  if (variants[key] && variantWeapon(key, along, limb, paint)) return;
  if (key === 'greatsword') {
    limb(along(-.53), along(.23), [.073, .077], [.066, .065], leather, 8);
    limb(along(-.62), along(-.49), [.086, .079], [.107, .092], bronze, 8);
    limb(along(.205, -.32), along(.205, .32), [.057, .079], [.057, .079], darkSteel, 8);
    limb(along(.21), along(1.29), [.185, .065], [.143, .052], metal, 6);
    limb(along(1.29), along(1.63), [.143, .052], [0, 0], metal, 6);
    const ridge = (distance, offset, depth) => shifted(along(distance, offset), 0, 0, depth);
    paint([ridge(.30, -.026, .058), ridge(.30, .026, .058), ridge(1.42, 0, .047)], darkSteel, 1.05);
    return;
  }
  if (key === 'maul') {
    limb(along(-.59), along(1.02), [.086, .092], [.076, .085], leather, 8);
    limb(along(-.58), along(-.45), [.117, .10], [.095, .10], armor, 8);
    for (const grip of [-.34, -.15, .08]) limb(along(grip - .021), along(grip + .021), [.094, .10], [.090, .098], bronze, 8);
    limb(along(.86, -.28), along(.87, .28), [.25, .20], [.25, .20], darkSteel, 8);
    for (const side of [-1, 1]) {
      limb(along(.86, side * .21), along(.87, side * .34), [.257, .218], [.21, .173], metal, 8);
      limb(along(.87, side * .32), along(.87, side * .379), [.185, .155], [.162, .147], bronze, 6);
    }
    return;
  }
  if (key === 'staff') {
    limb(along(-.90), along(1.11), [.066, .065], [.055, .052], leather, 6);
    limb(along(.94), along(1.12), [.083, .078], [.11, .10], metal, 6);
    limb(along(1.10), along(1.27), [.065, .065], [.155, .12], [106, 102, 188], 6);
    limb(along(1.27), along(1.47), [.155, .12], [0, 0], [174, 158, 251], 6);
    return;
  }
  if (key === 'crossbow') {
    limb(along(-.40), along(.77), [.12, .105], [.09, .07], leather);
    limb(along(-.21, .04), along(.78, .04), [.055, .09], [.04, .055], armor);
    for (const direction of [-1, 1]) {
      const bowTip = along(.48, direction * .35);
      limb(along(.63), along(.60, direction * .22), [.057, .06], [.048, .05], metal);
      limb(along(.60, direction * .22), bowTip, [.048, .05], [.032, .03], metal);
      limb(bowTip, along(.09 + strike * .27), [.018, .014], [.018, .014], [218, 193, 148]);
    }
    return;
  }
  if (key === 'spear') {
    limb(along(-1.18), along(1.32), [.063, .061], [.055, .05], leather, 6);
    limb(along(1.25), along(1.49), [.088, .07], [.13, .066], metal);
    limb(along(1.49), along(1.79), [.13, .066], [0, 0], metal);
    return;
  }
  if (key === 'sword') {
    limb(along(-.23), along(.17), [.07, .065], [.07, .065], leather);
    limb(along(.14, -.20), along(.14, .20), [.06, .07], [.06, .07], fighter.trim);
    limb(along(.16), along(.91), [.13, .05], [.10, .043], metal);
    limb(along(.91), along(1.13), [.10, .043], [0, 0], metal);
    return;
  }
  const flail = weaponFamily(key) === 'flail';
  const tip = flail ? .61 : .77;
  limb(along(-.23), along(tip), [.082, .077], [.065, .062], leather, 6);
  if (key === 'axe') {
    limb(along(.66, -.10), along(.66, .22), [.115, .095], [.190, .07], armor);
    limb(along(.66, .22), along(.66, .40), [.190, .07], [.23, .029], metal);
    return;
  }
  if (!flail) {
    limb(along(.61), along(.79), [.12, .11], [.21, .17], metal, 6);
    limb(along(.79), along(.98), [.21, .17], [.12, .11], armor, 6);
    return;
  }
  const chains = flailTrails(key, along(tip), windup, strike, clock);
  const radius = key === 'scourge' ? .10 : key === 'twinFlail' ? .125 : .17;
  for (const chainPoint of chains) {
    const ball = chainPoint(1);
    for (let i = 0; i < 5; i++) {
      const link = chainPoint(i / 5);
      limb(link, chainPoint((i + 1) / 5), [.043, .04], [.043, .04], i % 2 ? armor : metal, 6);
    }
    const [bx, by, bz] = ball;
    limb([bx, by - radius * .88, bz], ball, [.075, .075], [radius, radius], armor, 6);
    limb(ball, [bx, by + radius * .88, bz], [radius, radius], [.075, .075], metal, 6);
    for (let i = 0; i < 5; i++) {
      const theta = (i + .5) * Math.PI * 2 / 5;
      const dx = Math.cos(theta), dy = Math.sin(theta);
      paint([[bx + dx * radius * .76 - dy * .05, by + dy * radius * .76 + dx * .05, bz + .10],
        [bx + dx * radius * 1.42, by + dy * radius * 1.42, bz + .10],
        [bx + dx * radius * .76 + dy * .05, by + dy * radius * .76 - dx * .05, bz + .10]], metal, .98);
    }
  }
}

const pointBetween = (from, to, amount) => from.map((value, index) => mix(value, to[index], amount));
const shifted = ([x, y, z], dx, dy, dz = 0) => [x + dx, y + dy, z + dz];

function bendJoint(root, end, upper, lower, bend) {
  const dx = end[0] - root[0];
  const dy = end[1] - root[1];
  const length = Math.hypot(dx, dy) || 1e-5;
  const distance = clamp(length, Math.abs(upper - lower) + .001, upper + lower - .001);
  const projection = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const bendHeight = Math.sqrt(Math.max(0, upper * upper - projection * projection)) * bend;
  end[0] = root[0] + dx / length * distance;
  end[1] = root[1] + dy / length * distance;
  return [
    root[0] + (dx * projection - dy * bendHeight) / length,
    root[1] + (dy * projection + dx * bendHeight) / length,
    mix(root[2], end[2], .48)
  ];
}

function stepFoot(stride, offset) {
  const cycle = ((stride + offset) % 1 + 1) % 1;
  const planted = .61;
  if (cycle <= planted) return { x: mix(.30, -.30, cycle / planted), y: 0, pitch: 0 };
  const swing = (cycle - planted) / (1 - planted);
  const arc = Math.sin(Math.PI * swing) ** 1.5;
  return { x: mix(-.30, .30, ease(swing)), y: arc * .17, pitch: arc * mix(-.43, .34, swing) };
}

function fighterPose(fighter) {
  const active = state !== 'ready';
  const action = fighter.action;
  const incoming = otherFighter(fighter).action;
  const at = action?.phase ?? 0;
  const swinging = action?.style === 'melee' && !action.bash;
  const shooting = action?.style === 'ranged';
  const swingAt = action?.hitAt ?? .78;
  const release = smooth((at - .48) / (swingAt - .48));
  const windup = swinging ? smooth((at - .11) / .37) * (1 - release) : 0;
  const strike = swinging ? release * (1 - smooth((at - swingAt - .045) / .46)) : 0;
  const casting = action?.spell ? ease((at - .25) / .32) * (1 - ease((at - 1.01) / .43)) : 0;
  const aiming = shooting ? ease((at - .15) / .33) * (1 - ease((at - .99) / .40)) : 0;
  const shotRecoil = shooting ? ease((at - .55) / .09) * (1 - ease((at - .66) / .30)) : 0;
  const swapping = action?.switched ? Math.sin(Math.PI * clamp(at / .30, 0, 1)) : 0;
  const guard = incoming && isGuarding(incoming)
    ? ease((incoming.phase - incoming.hitAt + .34) / .25) * (1 - ease((incoming.phase - incoming.hitAt - .09) / .31))
    : 0;
  const reactionAge = elapsed - (fighter.reaction?.time ?? -10);
  const recoil = ease(reactionAge / .11) * (1 - ease((reactionAge - .14) / .35));
  const zone = fighter.reaction?.zone;
  const gait = active ? fighter.gait : 0;
  const stride = fighter.stride * 2 * Math.PI;
  const sway = Math.sin(stride) * gait;
  const weightShift = Math.cos(stride * 2) * gait;
  const breath = Math.sin(visualClock * 3 + fighter.direction) * .025;
  const stun = ease((elapsed - fighter.stunStarted) / .16) * ease((fighter.stunnedUntil - elapsed) / .24);
  const bash = action?.bash ? release * (1 - smooth((at - swingAt - .06) / .32)) : 0;
  const drop = guard * .085 + strike * .065 + weightShift * .021 - casting * .08 + stun * .36 + (zone === 'leg' ? recoil * .16 : 0);
  const evasion = incoming?.evade && !action ? ease((incoming.phase - .40) / .29) * (1 - ease((incoming.phase - .92) / .43)) : 0;
  const lean = strike * .23 - windup * .17 + casting * .13 - recoil * .25 + guard * .08 - evasion * .18 + aiming * .09 + stun * .20 + bash * .21;
  const twist = sway * .11 - windup * .12 + strike * .18 + guard * .05;
  const hips = [-.10 + sway * .045, 1.095 + breath - drop, weightShift * .024];
  const chest = [-.11 + lean + sway * .075, 1.72 + breath - drop, twist * .26];
  const head = shifted(chest, -.015 + strike * .055 - recoil * (zone === 'head' ? .27 : .09) - sway * .025,
    .33 - (zone === 'head' ? recoil * .055 : 0) - stun * .15, -twist * .16);
  const joints = { hips, chest, head };
  for (const side of ['rear', 'front']) {
    const sign = side === 'front' ? 1 : -1;
    const step = stepFoot(fighter.stride, sign < 0 ? .50 : 0);
    const plant = sign * (guard * .13 + strike * .20 + casting * .08 + stun * .12 + bash * .18);
    joints[side + 'Hip'] = shifted(hips, sign * .077, -.016, sign * .165);
    joints[side + 'Ankle'] = [sign * .355 + step.x * gait + plant, .157 + step.y * gait, sign * .22];
    joints[side + 'Knee'] = bendJoint(joints[side + 'Hip'], joints[side + 'Ankle'], .515, .505, 1);
    const pitch = step.pitch * gait;
    joints[side + 'Toe'] = shifted(joints[side + 'Ankle'], .19 * Math.cos(pitch), -.07 + .19 * Math.sin(pitch), .016);
  }

  const weapon = weapons[fighter.weapon];
  const aim = swinging ? action.aim * strike : 0;
  joints.weaponShoulder = shifted(chest, .02 - windup * .06 + twist * .35, .04, -.30);
  const channeling = weapon.spellPower ? casting * .54 : -casting * .47;
  joints.weaponHand = [.32 + channeling + strike * weapon.extension - windup * .47 - recoil * .12 + sway * .11
    + aiming * .43 - shotRecoil * .10 - swapping * .36,
    1.43 - drop + windup * weapon.lift + aim * .22 + sway * .07 + aiming * .17 - swapping * .14 - stun * .27, -.30 + strike * .31 + aiming * .20];
  joints.weaponElbow = bendJoint(joints.weaponShoulder, joints.weaponHand, .51, .53, -1);

  joints.shieldShoulder = shifted(chest, -.02 - twist * .35, -.025, .30);
  joints.shieldHand = [.36 + guard * .30 + casting * .12 - recoil * (zone === 'arm' ? .31 : .09) - sway * .11 + bash * .46,
    1.39 - drop + guard * .25 - recoil * .16 + casting * .16 + bash * .20 - stun * .24, .48 - bash * .26];
  const aimScale = weaponFamily(fighter.weapon) === 'spear' ? .44 : .65;
  const castAngle = weapon.spellPower ? -.79 : 1.19;
  const angle = weapon.rest + casting * castAngle + windup * weapon.draw - strike * weapon.swing
    + aim * aimScale + sway * .08 - aiming * .16 + shotRecoil * .09 + swapping * .35 - stun * .76;
  if (weapon.twoHanded) {
    const grip = weaponAxis(joints.weaponHand, angle)(-.32);
    joints.shieldHand = shifted(grip, 0, 0, .08);
  }
  joints.shieldElbow = bendJoint(joints.shieldShoulder, joints.shieldHand, .43, .47, -1);
  const pose = { joints, angle, windup, strike: strike + shotRecoil,
    shieldTilt: guard * .16 - recoil * .27 - sway * .10, twist, cloth: -sway * .08 - lean * .31 + recoil * .065 };
  const previous = action?.previousPose;
  if (previous && at < .22) {
    const blend = smooth(at / .22);
    for (const name of Object.keys(joints)) joints[name] = pointBetween(previous.joints[name], joints[name], blend);
    for (const key of ['angle', 'shieldTilt', 'twist', 'cloth']) pose[key] = mix(previous[key], pose[key], blend);
  }
  return pose;
}

// Drawing-only motion. fighterPose is the combat pose that checkContact, bodyZones and startAction use.
// displayPose layers anticipation and follow-through over a fresh copy of it. Nothing here writes fight
// state or calls Math.random, and its memory lives in a map that the simulation never reads.
const motionMemory = new WeakMap();

function liveContact(action) {
  // How close an unresolved melee attack is to the window where checkContact tests it.
  return action?.style === 'melee' && !action.connected ? smooth((action.phase - .46) / .12) : 0;
}

function actionMotion(fighter, action, memory) {
  const offsets = {};
  if (!action) return offsets;
  const add = (amount, values) => {
    if (amount > 0) for (const [key, value] of Object.entries(values)) offsets[key] = (offsets[key] || 0) + value * amount;
  };
  const at = action.phase;
  const weapon = weapons[action.key];
  if (action.style === 'melee') {
    if (action.connected && memory.connectedPhase === null) {
      memory.connectedPhase = at;
      // Read how the blow resolved: impact sets a reaction on a hit or block, and counterUntil only on a block.
      const { defender } = action;
      const struck = (defender.reaction?.time ?? -10) >= action.created;
      memory.outcome = !struck ? 'miss' : defender.counterUntil > elapsed ? 'blocked' : 'hit';
    }
    const heft = action.bash ? .9 : weapon.twoHanded || action.heavy ? 1.18 : action.key === 'rapier' ? .7 : 1;
    const thrust = weaponFamily(action.key) === 'spear' && !action.bash;
    // Coil before the swing, then let go before the contact window so the drawn weapon matches its hitbox.
    const coil = heft * smooth((at - .06) / .32) * (1 - smooth((at - .46) / .11));
    if (action.bash) {
      add(coil, { hipX: -.03, drop: .05, leanX: -.07, offX: -.16, offY: -.03, frontX: -.03, frontY: .02, twist: -.08, tilt: -.10 });
    } else if (thrust) {
      add(coil, { hipX: -.06, drop: .05, leanX: -.07, headX: -.01, handX: -.06, handY: .03, angle: .06, offX: .07,
        frontX: -.05, frontY: .03, twist: -.10 });
    } else {
      add(coil, { hipX: -.05, drop: .08, leanX: -.13, leanY: -.01, headX: -.03, handX: -.12, handY: .11, angle: .40,
        offX: .10, offY: .04, frontX: -.05, frontY: .045, twist: -.15, cloth: .05 });
    }
    if (memory.connectedPhase !== null && memory.outcome === 'blocked' && !action.bash) {
      // A blocked weapon rebounds off the shield instead of carrying through.
      const t = at - memory.connectedPhase;
      add(heft * ease(t / .05) * (1 - smooth((t - .07) / .40)), { hipX: -.04, leanX: -.07, headX: -.02, handX: -.07, handY: .11,
        angle: .30, offX: -.03, frontX: -.03, twist: -.07 });
    } else if (memory.connectedPhase !== null) {
      // Carry the weapon past the target, then settle back to guard by the end of recovery. A miss overreaches.
      const from = Math.max(action.hitAt, memory.connectedPhase);
      const t = at - from;
      const carry = heft * (memory.outcome === 'miss' ? 1.25 : 1) * ease(t / .09)
        * (1 - smooth((t - .09) / Math.max(.12, action.duration - from - .11)));
      if (action.bash) {
        add(carry, { hipX: .05, drop: .03, leanX: .07, offX: .10, offY: -.02, frontX: .06, rearX: .04, rearY: .03, twist: .06 });
      } else if (thrust) {
        add(carry, { hipX: .05, drop: .04, leanX: .09, headX: .02, handX: .14, handY: -.03, angle: -.05, offX: -.06,
          frontX: .07, rearX: .05, rearY: .04, twist: .10 });
      } else {
        add(carry, { hipX: .04, drop: .05, leanX: .10, leanY: -.02, headX: .03, handX: .06, handY: -.12, angle: -.34,
          offX: -.09, offY: -.04, frontX: .06, rearX: .05, rearY: .045, twist: .12, cloth: -.05 });
      }
    }
  } else if (action.style === 'ranged') {
    // Settle and steady the aim, then take the kick of the release.
    const steady = smooth((at - .26) / .26) * (1 - smooth((at - .54) / .04));
    add(steady, { drop: .045, leanX: .03, headX: .02, handY: -.02, offY: -.02, frontX: .03, twist: -.04 });
    const kick = (weapon.twoHanded ? 1.3 : 1) * ease((at - .55) / .05)
      * (1 - smooth((at - .60) / Math.max(.3, action.duration - .62)));
    add(kick, { hipX: -.04, drop: .02, leanX: -.08, headX: -.04, handX: -.11, handY: .07, angle: .20, offX: -.05, offY: .04,
      rearX: -.04, frontY: .03, twist: -.06, cloth: .04 });
  } else if (action.spell) {
    // Gather power toward the body, then push it out as the spell releases.
    const staff = Boolean(weapon.spellPower);
    const [handX, handY] = staff ? ['handX', 'handY'] : ['offX', 'offY'];
    const gather = smooth((at - .10) / .30) * (1 - smooth((at - .48) / .18));
    const push = ease((at - .88) / .08) * (1 - smooth((at - .98) / Math.max(.3, action.duration - 1)));
    add(gather, { drop: .04, leanX: -.07, headX: -.02, [handX]: -.13, [handY]: .09, angle: staff ? .22 : 0, frontY: .025, twist: -.06 });
    add(push, { hipX: .03, drop: .04, leanX: .08, headX: .02, [handX]: .12, [handY]: -.03, angle: staff ? -.16 : 0,
      frontX: .05, rearY: .03, twist: .07 });
  }
  return offsets;
}

function reactionMotion(fighter, memory, clock) {
  const reaction = fighter.reaction;
  if (reaction !== memory.reaction) {
    // A new reaction means impact just landed a hit or a block. Size it from the health it cost.
    memory.reaction = reaction;
    const blow = otherFighter(fighter).action;
    const share = Math.max(0, memory.hp - fighter.hp) / fighter.maxHP;
    const blocked = share === 0;
    const force = (blow?.heavy ? 1.3 : 1) * (blow?.bash ? 1.2 : 1) * (blow?.style === 'ranged' ? .75 : blow?.spell ? .85 : 1);
    memory.hit = reaction && {
      blocked, force,
      push: Math.min(.48, force * (blocked ? .06 : clamp(.10 + share * 1.4, .10, .36))),
      weight: Math.min(1.4, blocked ? .7 * force : clamp(.6 + share * 3.2, .6, 1.5) * force)
    };
  }
  memory.hp = fighter.hp;
  const offsets = {};
  const hit = memory.hit;
  const age = clock - (reaction?.time ?? -10);
  if (!hit || age > 1.2) return offsets;
  const add = (amount, values) => {
    for (const [key, value] of Object.entries(values)) offsets[key] = (offsets[key] || 0) + value * amount;
  };
  // The body is thrown back and slides to a stop, then walks back to where the fight has it.
  const shove = ease(age / .08) * (1 - smooth((age - .14) / .55));
  add(shove * hit.push, { rootX: -1 });
  if (hit.push > .2) {
    const stumble = Math.sin(Math.PI * clamp((age - .04) / .30, 0, 1));
    add(stumble * hit.push, { rearX: -.35, rearY: .22, frontY: .08 });
  }
  const snap = hit.weight * ease(age / .06) * (1 - smooth((age - .10) / .42));
  if (hit.blocked) {
    add(snap, { hipX: -.02, drop: .04, leanX: -.05, offX: -.13, offY: .04, tilt: -.20, frontX: -.03, handY: .03, twist: -.05 });
    return offsets;
  }
  switch (reaction.zone) {
    case 'head':
      add(snap, { leanX: -.08, headX: -.11, handY: .07, offY: .06, angle: .16, frontY: .03, twist: -.06, cloth: .05 });
      break;
    case 'leg':
      add(snap, { drop: .12, frontX: -.08, frontY: .05, leanX: .05, headX: .03, handY: -.04, offY: -.03 });
      break;
    case 'arm':
      add(snap, { leanX: -.04, handX: -.08, handY: .05, angle: .28, offX: -.10, offY: .06, tilt: -.16, twist: -.08 });
      break;
    default:
      // A body blow doubles the fighter over around it.
      add(snap, { hipX: -.07, drop: .06, leanX: -.01, headX: .06, handY: -.07, offY: -.06, twist: .08, cloth: .06 });
  }
  return offsets;
}

function applyMotion(fighter, pose, offsets, amount) {
  const j = pose.joints;
  const value = key => (offsets[key] || 0) * amount;
  const move = (names, dx, dy) => { for (const name of names) j[name] = shifted(j[name], dx, dy); };
  const hipX = value('hipX'), hipY = -value('drop');
  const chestX = hipX + value('leanX'), chestY = hipY + value('leanY');
  move(['hips', 'frontHip', 'rearHip'], hipX, hipY);
  move(['chest', 'weaponShoulder', 'shieldShoulder'], chestX, chestY);
  move(['head'], chestX + value('headX'), chestY);
  // Middle joints move by the average of their ends instead of being solved again. Solving them again
  // would snap away from the blended start of an action, and a zero offset leaves the combat pose unchanged.
  for (const side of ['front', 'rear']) {
    const footX = value(side + 'X'), footY = value(side + 'Y');
    move([side + 'Ankle', side + 'Toe'], footX, footY);
    move([side + 'Knee'], (hipX + footX) / 2, (hipY + footY) / 2);
  }
  const handX = chestX + value('handX'), handY = chestY + value('handY');
  const grip = weaponAxis(j.weaponHand, pose.angle)(-.32);
  move(['weaponHand'], handX, handY);
  move(['weaponElbow'], (chestX + handX) / 2, (chestY + handY) / 2);
  pose.angle += value('angle');
  // A two-handed grip stays on the shaft as the weapon hand and angle change.
  const newGrip = weaponAxis(j.weaponHand, pose.angle)(-.32);
  const [offX, offY] = weapons[fighter.weapon].twoHanded
    ? [newGrip[0] - grip[0], newGrip[1] - grip[1]] : [chestX + value('offX'), chestY + value('offY')];
  move(['shieldHand'], offX, offY);
  move(['shieldElbow'], (chestX + offX) / 2, (chestY + offY) / 2);
  pose.twist += value('twist');
  pose.cloth += value('cloth');
  pose.shieldTilt += value('tilt');
  const rootX = value('rootX');
  if (rootX) move(Object.keys(j), rootX, 0);
}

function displayPose(fighter) {
  const pose = fighterPose(fighter);
  // Keep counting after the bout ends so a cut-off motion can still settle.
  const clock = elapsed + fall;
  let memory = motionMemory.get(fighter);
  if (!memory || clock < memory.clock) {
    memory = { clock, action: null, connectedPhase: null, outcome: null, lock: 0, last: {}, fade: {}, fadeStart: clock,
      reaction: fighter.reaction, hp: fighter.hp, hit: null };
    motionMemory.set(fighter, memory);
  }
  const step = clock - memory.clock;
  memory.clock = clock;
  const action = fighter.action;
  if (action !== memory.action) {
    // An action can end or be cut off mid-motion, so ease out whatever was showing.
    memory.fade = memory.last;
    memory.fadeStart = clock;
    memory.action = action;
    memory.connectedPhase = null;
  }
  const offsets = actionMotion(fighter, action, memory);
  const fade = 1 - smooth((clock - memory.fadeStart) / .2);
  if (fade > 0) for (const [key, value] of Object.entries(memory.fade)) offsets[key] = (offsets[key] || 0) + value * fade;
  memory.last = { ...offsets };
  for (const [key, value] of Object.entries(reactionMotion(fighter, memory, clock))) offsets[key] = (offsets[key] || 0) + value;
  // While either blow can still land, show the body and weapon exactly where checkContact tests them.
  const target = Math.max(liveContact(action), liveContact(otherFighter(fighter).action));
  memory.lock = target >= memory.lock ? target : Math.max(target, memory.lock - step / .15);
  const amount = 1 - memory.lock;
  if (amount > 0 && Object.keys(offsets).length) applyMotion(fighter, pose, offsets, amount);
  return pose;
}

const bronze = [172, 128, 76];
const darkSteel = [72, 72, 65];
const clothLining = [64, 48, 75];
const soleColor = [49, 36, 29];

function loft(rings, color, transform, sides = 24) {
  const profile = circleProfile(sides).slice(0, sides / 2 + 1);
  const vertices = rings.map(([y, width, depth]) => profile.map(({ cosine, sine }) => [cosine * width, y, sine * depth]));
  for (let row = 1; row < vertices.length; row++) {
    for (let i = 0; i < sides / 2; i++) {
      const a = vertices[row - 1];
      const b = vertices[row];
      const angle = (i + .5) * Math.PI * 2 / sides;
      const light = .64 + Math.sin(angle) * .32 + Math.cos(angle - .42) * .22
        + Math.max(0, Math.cos(angle - 1.11)) ** 13 * .08;
      surface([a[i], a[i + 1], b[i + 1], b[i]], color, light, transform);
    }
  }
}

function armorTorso(fighter, pose, transform) {
  const kit = armors[fighter.gear.armor];
  const shell = kit.shell || metal;
  const edging = kit.edging || bronze;
  const piece = (a, b, r1, r2, color, sides) => prism(a, b, r1, r2, color, transform, sides);
  const panel = (points, color, light = 1) => surface(points, color, light, transform);
  const stud = (x, y, z, color = bronze) =>
    panel([[x - .020, y, z], [x, y + .025, z], [x + .022, y, z], [x, y - .024, z]], color, 1.14);
  const skirt = pose.cloth;
  const beltColor = kit.style === 'magic' ? fighter.color : leather;

  loft([[-.12, .262, .257], [-.055, .287, .305], [.13, .32, .34], [.32, .375, .379],
    [.43, .411, .385], [.55, .395, .359], [.60, .33, .323], [.645, .224, .253]], kit.color, transform);

  if (kit.style === 'melee') {
    loft([[.14, .327, .35], [.23, .348, .37], [.44, .40, .386], [.57, .38, .35]], shell, transform);
    panel([[-.35, .55, .232], [-.24, .59, .32], [0, .38, .404], [.25, .58, .32],
      [.35, .52, .23], [0, .29, .413]], darkSteel, 1.02);
    panel([[-.30, .54, .282], [0, .34, .420], [.30, .54, .282], [.29, .49, .30],
      [0, .28, .425], [-.28, .49, .305]], edging, 1.16);
    panel([[0, .50, .406], [.087, .422, .418], [0, .34, .423], [-.087, .422, .418]], fighter.trim, 1);
    for (const side of [-1, 1]) {
      const x = side * .20;
      panel([[x - .035, .51, .361], [x + .018, .554, .345], [x + .048, .521, .357],
        [x + .031, .483, .373], [x - .019, .456, .385]], shell, 1.20);
      for (const y of [.435, .528, .589]) stud(side * (.285 - (y - .45) * .28), y, .319, bronze);
      piece([side * .175, .019, .31], [side * .235 + skirt * .5, -.207, .33], [.108, .075], [.091, .052], darkSteel, 8);
      piece([side * .203 + skirt * .5, -.105, .38], [side * .232 + skirt * .5, -.244, .356],
        [.090, .036], [.072, .028], kit.shell || armor, 8);
      stud(side * .228 + skirt * .5, -.15, .409, bronze);
    }
    for (const y of [.03, .115, .20]) {
      loft([[y - .07, .33, .34], [y, .355, .368], [y + .035, .31, .339]], kit.shell || armor, transform);
      stud(-.20, y, .325);
      stud(.20, y, .325);
    }
    for (let strip = -1; strip <= 1; strip++) {
      const x = strip * .17;
      piece([x, .04, .28], [x + strip * .043 + skirt, -.31, .285], [.116, .06], [.075, .055], leather);
      piece([x + strip * .036 + skirt, -.25, .329], [x + strip * .045 + skirt, -.35, .322],
        [.074, .03], [.049, .024], bronze);
    }
  } else if (kit.style === 'ranged') {
    panel([[-.32, .50, .27], [-.15, .62, .35], [.04, .37, .415], [.22, .55, .34],
      [.31, .45, .28], [.14, .16, .38], [-.15, .12, .38]], kit.shell || [132, 88, 56], 1.03);
    for (const x of [-.19, .17]) {
      piece([x, .18, .351], [x * 1.10, .51, .349], [.027, .022], [.031, .020], leather, 6);
      for (const y of [.20, .29, .38, .47]) stud(x + .045, y, .37, [200, 156, 98]);
    }
    for (let row = 0; row < 4; row++) {
      for (let column = -1; column <= 1; column++) {
        const x = column * .11 + (row % 2) * .025;
        const y = .18 + row * .082;
        const z = .402 + row * .005;
        panel([[x - .066, y + .028, z], [x + .05, y + .028, z], [x + .056, y - .024, z + .002],
          [x + .011, y - .053, z + .008], [x - .047, y - .028, z + .004]], kit.shell || [130, 82, 52], .88 + (column + 1) * .10);
        panel([[x - .057, y + .025, z + .006], [x + .042, y + .025, z + .006],
          [x + .042, y + .011, z + .007], [x - .05, y + .011, z + .007]], kit.edging || [201, 149, 88], .94);
        stud(x - .027, y + .008, z + .012, darkSteel);
      }
    }
    piece([-.24, .15, .334], [.22, .57, .365], [.063, .043], [.073, .044], darkSteel, 6);
    piece([.19, -.11, .287], [.25, .09, .330], [.11, .09], [.12, .093], [102, 68, 42], 8);
    panel([[.16, .04, .426], [.25, .09, .407], [.31, .04, .414], [.24, -.015, .44]], bronze);
    loft([[-.26, .35, .31], [-.11, .29, .31], [.035, .31, .33]], fighter.color, transform);
  } else {
    const hem = y => [skirt + y, -.59, .304];
    panel([[-.30, .12, .29], [-.34 + skirt, -.49, .25], hem(-.17), [-.03, .08, .407]], kit.color, .82);
    panel([[-.03, .08, .408], hem(-.17), hem(.10), [.25 + skirt, -.49, .30], [.27, .10, .32]], kit.color, 1.12);
    panel([[-.09, .09, .412], hem(-.045), hem(.10), [.25, .10, .329]], clothLining, 1);
    for (const [x, z] of [[-.22, .332], [-.12, .385], [.17, .372]]) {
      panel([[x, .06, z + .023], [x - .043 + skirt, -.52, z], [x + .028 + skirt, -.54, z],
        [x + .028, .06, z + .025]], kit.color, x < -.15 ? .82 : 1.21);
    }
    const cape = [[-.30, .58, -.13], [-.36, .27, -.14], [-.38 + skirt * .52, -.07, -.13],
      [-.44 + skirt, -.34, -.14], [-.40 + skirt, -.63, -.10]];
    for (let index = 1; index < cape.length; index++) {
      const start = cape[index - 1];
      const end = cape[index];
      const innerStart = shifted(start, .19, .005, .078);
      const innerEnd = shifted(end, .19, .007, .078);
      const seamStart = shifted(start, .073, 0, .045);
      const seamEnd = shifted(end, .075, 0, .042);
      panel([start, seamStart, seamEnd, end], kit.color, .74);
      panel([seamStart, innerStart, innerEnd, seamEnd], kit.color, .94);
      panel([start, shifted(start, .025, 0, .012), shifted(end, .026, 0, .012), end], bronze, .92);
    }
    panel([[-.20 + skirt, -.505, .315], hem(-.17), hem(.10), [.24 + skirt, -.49, .31],
      [.21 + skirt, -.444, .316], [.08 + skirt, -.53, .316], [-.16 + skirt, -.54, .316]], edging, 1.1);
    panel([[-.30, .54, .30], [-.12, .63, .35], [.03, .40, .43], [.21, .61, .36],
      [.31, .51, .30], [.03, .27, .432]], fighter.color, 1.13);
    panel([[-.24, .55, .326], [.03, .335, .442], [.25, .54, .334], [.235, .49, .348],
      [.03, .30, .445], [-.21, .51, .36]], edging, 1.11);
    stud(.03, .29, .454, fighter.trim);
    stud(.03, .22, .444, fighter.trim);
    for (const y of [-.16, -.29, -.42]) {
      const x = .075 + skirt * (.13 - y);
      stud(x, y, .420, fighter.trim);
      panel([[x - .053, y + .009, .418], [x, y + .055, .421], [x + .048, y + .011, .42],
        [x, y + .039, .424]], bronze, 1.09);
    }
  }

  loft([[.023, .32, .36], [.093, .333, .372]], beltColor, transform);
  piece([-.062, .056, .393], [.074, .061, .403], [.054, .028], [.054, .028], bronze, 6);
  panel([[-.029, .035, .433], [.043, .035, .433], [.043, .078, .433], [-.029, .078, .433]], darkSteel, .95);
  for (const x of [-.255, -.169, .159, .244]) stud(x, .058, .365 - Math.abs(x) * .12, bronze);
  armorSignature(kit, pose, panel, piece);
}

function armorSignature(kit, pose, panel, piece) {
  const { cut, edging } = kit;
  if (!cut) return;
  const shell = kit.shell || kit.color;
  if (cut === 'lamellar' || cut === 'fortress') {
    const breadth = cut === 'fortress' ? .19 : .14;
    for (let row = 0; row < 3; row++) {
      const y = .24 + row * .113;
      for (const side of [-1, 1]) {
        const x = side * (.15 + row * .037);
        const z = .442 - row * .023;
        panel([[x - breadth * .61, y + .054, z], [x + breadth * .61, y + .054, z],
          [x + breadth * .51, y - .018, z + .01], [x, y - .045, z + .022],
          [x - breadth * .57, y - .018, z + .01]], shell, 1.12 + row * .035);
        piece([x - .056, y + .043, z + .012], [x + .057, y + .046, z + .012], [.013, .014], [.012, .012], edging, 6);
      }
    }
    return;
  }
  if (cut === 'mantle' || cut === 'night') {
    panel([[-.31, .62, .296], [-.54, .52, .284], [-.50 + pose.cloth * .4, .25, .321],
      [-.31, .18, .335], [-.18, .49, .406], [-.04, .64, .352]], shell, cut === 'night' ? .78 : 1.09);
    piece([-.50, .49, .308], [-.39, .23, .341], [.022, .027], [.017, .02], edging, 8);
    if (cut === 'night') {
      for (const x of [-.29, -.17, -.05, .07]) {
        piece([x - .034, .47, .432], [x, .39, .444], [.014, .013], [.014, .012], edging, 4);
      }
    }
    return;
  }
  const large = cut === 'astral' ? .115 : .102;
  const knot = [.055, .423, .455];
  for (const [i, { cosine, sine }] of circleProfile(8).entries()) {
    const a = shifted(knot, cosine * large, sine * large, .01);
    const b = shifted(knot, cosine * large * .43 - sine * .022, sine * large * .43 + cosine * .022, .018);
    const c = shifted(knot, cosine * large * .43 + sine * .022, sine * large * .43 - cosine * .022, .018);
    panel([a, b, c], edging, 1.14 - i * .026);
  }
  piece([.034, .40, .467], [.078, .44, .468], [.040, .025], [.039, .024], edging, 10);
  if (cut === 'astral') {
    panel([[-.27, -.02, .28], [-.36 + pose.cloth * .45, -.35, .29], [-.34 + pose.cloth, -.72, .30],
      [-.12 + pose.cloth, -.60, .344], [-.117, -.04, .37]], kit.color, 1.13);
  }
}

function armorHelmet(fighter, kit, transform) {
  const piece = (a, b, r1, r2, color, sides = 8) => prism(a, b, r1, r2, color, transform, sides);
  const panel = (points, color, light = 1) => surface(points, color, light, transform);
  const face = fighter.direction > 0 ? [190, 128, 88] : [155, 106, 81];
  const shadow = [45, 33, 28];
  const trim = kit.edging || bronze;
  const steel = kit.shell || [151, 160, 154];

  function faceProfile() {
    loft([[-.19, .115, .116], [-.134, .183, .176], [-.07, .213, .215], [.011, .235, .234],
      [.102, .224, .23], [.185, .206, .204], [.238, .165, .169]], face, transform);
    panel([[.055, .09, .250], [.177, .083, .239], [.174, .047, .251], [.059, .055, .263]], shadow, .86);
    panel([[.112, .051, .267], [.167, .05, .257], [.157, .031, .26], [.119, .032, .273]], [207, 190, 155], .92);
    panel([[.136, .052, .277], [.152, .051, .276], [.149, .028, .276], [.137, .027, .278]], shadow);
    panel([[.159, .066, .254], [.224, .018, .263], [.268, -.033, .202], [.216, -.046, .254],
      [.161, -.017, .272]], face, 1.15);
    panel([[.216, -.046, .254], [.267, -.033, .202], [.21, -.065, .223], [.161, -.052, .257]], face, .73);
    panel([[.049, -.004, .253], [.15, -.028, .273], [.198, -.061, .246], [.126, -.117, .222],
      [.023, -.092, .224]], face, 1.11);
    panel([[.103, -.082, .260], [.207, -.071, .226], [.203, -.088, .226],
      [.149, -.094, .250], [.105, -.095, .256]], shadow, .92);
    panel([[.112, -.121, .226], [.190, -.103, .220], [.162, -.145, .193], [.084, -.151, .197]], face, 1.10);
  }

  if (kit.style === 'magic') {
    const tall = kit.cut === 'astral';
    loft([[-.195, .211, .209], [-.10, .240, .265], [.02, .280, .282], [.15, .280, .265],
      [.22, .260, .238], [.33, .177, .180], [.38, .075, .085], [tall ? .44 : .395, .015, .027]], kit.color, transform);
    panel([[-.10, -.185, .265], [.123, -.165, .260], [.263, -.06, .226], [.255, .105, .226],
      [.171, .208, .220], [0, .24, .279], [-.124, .12, .295]], [47, 38, 59], .8);
    faceProfile();
    panel([[-.248, .047, .185], [-.190, .172, .226], [-.066, .259, .272], [.088, .249, .268],
      [.195, .188, .230], [.255, .10, .243], [.134, .159, .275], [-.015, .158, .297],
      [-.071, .068, .302], [-.118, -.155, .272], [-.195, -.089, .249]], kit.color, 1.13);
    piece([-.068, .18, .296], [.202, .14, .272], [.018, .026], [.014, .024], trim);
    piece([-.082, .115, .285], [-.123, -.159, .286], [.023, .024], [.017, .022], trim);
    if (tall) {
      piece([-.22, .185, .13], [-.33, .444, .15], [.095, .086], [.017, .035], kit.color);
      panel([[.047,.207,.310],[.088,.274,.292],[.132,.225,.286],[.108,.164,.299]], trim, 1.32);
    }
    return;
  }

  if (kit.style === 'ranged' || kit.cut === 'lamellar') {
    const helmet = kit.style === 'melee' ? steel : kit.shell || leather;
    faceProfile();
    loft([[.075, .247, .243], [.113, .259, .268], [.162, .257, .263], [.228, .235, .228],
      [.279, .179, .186], [.310, .096, .104], [.315, .042, .05]], helmet, transform);
    piece([-.234,.120,.206], [.257,.123,.204], [.026,.053], [.019,.046], kit.style === 'melee' ? trim : fighter.trim);
    panel([[-.226,.122,.213],[-.107,.105,.277],[-.071,-.093,.260],[-.106,-.160,.226],[-.224,-.118,.189]],
      helmet, 1.14);
    piece([.196,.119,.233], [.227,-.019,.226], [.022,.031], [.022,.026], trim);
    if (kit.cut === 'night') {
      panel([[-.182,-.037,.276],[-.106,.006,.286],[.13,-.014,.289],[.238,-.033,.258],
        [.155,-.155,.233], [-.09,-.157,.240]], kit.color, .79);
    } else if (kit.style === 'melee') {
      panel([[-.193,.105,.257],[-.087,.08,.303],[-.073,-.086,.285],[-.126,-.163,.245],[-.177,-.124,.250]], steel, 1.18);
    }
    for (const x of [-.165, -.112, -.054, .007]) {
      panel([[x-.012,.121,.291],[x+.005,.141,.295],[x+.020,.12,.295],[x+.005,.099,.294]], trim, 1.17);
    }
    return;
  }

  const fortress = kit.cut === 'fortress';
  loft([[-.184, .158, .168], [-.153, .216, .222], [-.06, .245, .25], [.07, .269, .27],
    [.153, .271, .264], [.231, .246, .234], [.29, .174, .188], [.323, .086, .098]], steel, transform);
  const visor = fortress
    ? [[-.192,.105,.251],[.115,.123,.306],[.27,.076,.229],[.264,-.136,.211],[.09,-.178,.294],[-.158,-.134,.259]]
    : [[-.171,.111,.243],[.097,.117,.293],[.273,.038,.222],[.214,-.110,.247],[.09,-.172,.28],[-.139,-.127,.261]];
  panel(visor, steel, .84);
  panel([[-.139,.095,.282],[.088,.116,.323],[.257,.064,.258],[.224,.023,.274],[.079,.056,.326],
    [-.131,.050,.284]], shadow);
  panel([[-.161,.112,.273],[.095,.135,.324],[.274,.077,.238],[.246,.063,.261],
    [.089,.109,.333],[-.150,.09,.290]], trim, 1.20);
  panel([[-.129,.03,.291],[.076,.040,.328],[.222,.004,.276],[.180,-.076,.285],[.057,-.11,.321],
    [-.131,-.055,.293]], steel, 1.19);
  panel([[.012,.143,.287],[.120,.152,.303],[.220,.097,.269],[.106,.123,.316]], steel, 1.31);
  for (const x of [.061,.112,.163]) {
    const z = .327 - (x - .061) * .31;
    panel([[x-.012,-.034,z],[x+.005,-.037,z],[x+.012,-.086,z-.012],[x-.004,-.084,z-.011]], shadow, .88);
  }
  piece([-.202,.019,.253], [-.161,-.123,.248], [.050,.038], [.037,.039], trim);
  if (fortress) {
    piece([-.231,.141,.131], [-.281,.322,.138], [.088,.083], [.015,.044], steel);
    piece([-.144,-.097,.254], [-.092,-.211,.226], [.092,.058], [.036,.046], steel);
  } else {
    piece([-.093,.258,.060], [-.115,.319,.061], [.197,.118], [.170,.099], trim);
    piece([-.114,.311,.060], [-.186,.432,.055], [.178,.107], [.057,.069], fighter.color, 10);
    piece([-.174,.398,.061], [-.286,.386,.049], [.101,.081], [.038,.054], fighter.trim, 8);
  }
}

function drawGladiator(fighter, pose) {
  const { joints: j } = pose;
  const kit = armors[fighter.gear.armor];
  const plated = kit.style === 'melee';
  const robed = kit.style === 'magic';
  const world = point => worldPoint(fighter, point);
  const limb = (a, b, r1, r2, color, sides) => prism(a, b, r1, r2, color, world, sides);

  for (const side of ['rear', 'front']) {
    const hip = j[side + 'Hip'];
    const knee = j[side + 'Knee'];
    const ankle = j[side + 'Ankle'];
    const toe = j[side + 'Toe'];
    limb(hip, knee, [.19, .17], [.13, .136], robed ? clothLining : leather, 8);
    limb(knee, ankle, [.139, .14], [.103, .106], robed ? clothLining : skin, 8);
    if (plated) {
      limb(shifted(pointBetween(hip, knee, .17), 0, 0, .086), shifted(pointBetween(hip, knee, .70), 0, 0, .092),
        [.136, .099], [.118, .08], kit.shell || armor, 8);
      limb(shifted(knee, -.066, .076, .087), shifted(knee, .028, -.083, .085), [.129, .095], [.085, .085], kit.shell || metal, 8);
    }
    limb(shifted(pointBetween(knee, ankle, .13), 0, 0, .062), shifted(pointBetween(ankle, knee, .08), 0, 0, .064),
      [.109, .102], [.090, .080], plated ? kit.shell || metal : robed ? leather : kit.color, 8);
    for (const t of (plated ? [.24, .73] : [.32, .53, .73])) {
      const strap = pointBetween(knee, ankle, t);
      limb(shifted(strap, -.10, -.022, .084), shifted(strap, .10, .022, .084), [.028, .03], [.028, .03], plated ? bronze : leather, 6);
    }
    const heel = shifted(pointBetween(toe, ankle, 1.67), 0, -.09);
    limb(heel, toe, [.10, .136], [.067, .118], leather, 8);
    limb(shifted(heel, -.008, -.045, .019), shifted(toe, .012, -.044, .019), [.035, .145], [.031, .124], soleColor, 8);
    if (plated) {
      limb(shifted(ankle, .024, -.020, .072), shifted(toe, .008, .036, .044), [.067, .10], [.048, .105], armor, 8);
    }
    for (const t of [.42, .62, .80]) {
      const instep = pointBetween(heel, toe, t);
      limb(shifted(instep, -.011, .044, .083), shifted(instep, .012, .052, .106),
        [.015, .018], [.014, .018], plated ? bronze : fighter.trim, 6);
    }
  }

  const torsoAngle = Math.atan2(j.chest[1] - j.hips[1], j.chest[0] - j.hips[0]) - Math.PI / 2;
  const cosine = Math.cos(torsoAngle);
  const sine = Math.sin(torsoAngle);
  const torso = ([x, y, z]) => {
    const swept = x + z * pose.twist;
    return [
      j.hips[0] + swept * cosine - y * sine,
      j.hips[1] + swept * sine + y * cosine,
      j.hips[2] + z - x * pose.twist + y * (j.chest[2] - j.hips[2]) / .625
    ];
  };
  armorTorso(fighter, pose, point => world(torso(point)));

  const spare = fighter.weapon === fighter.gear.weapon ? fighter.gear.reserve : fighter.gear.weapon;
  if (weapons[spare]) {
    const long = ['staff', 'spear', 'crossbow'].includes(weaponFamily(spare)) || weapons[spare].twoHanded;
    const mount = torso(long ? [-.43, .39, -.51] : [-.39, .03, -.43]);
    const scaleStowed = long ? .80 : .69;
    const stow = point => pointBetween(mount, point, scaleStowed);
    const holder = (a, b, r1, r2, color, sides) => limb(stow(a), stow(b), r1.map(r => r * scaleStowed), r2.map(r => r * scaleStowed), color, sides);
    weaponModel(fighter, mount, torsoAngle + (long ? 2.0 : -2.34), 0, 0, 0, holder, point => world(stow(point)), spare);
  }

  const neck = pointBetween(j.chest, j.head, .48);
  limb(j.chest, neck, [.12, .15], [.12, .15], robed ? clothLining : leather, 8);
  const headTurn = Math.atan2(j.head[1] - j.chest[1], j.head[0] - j.chest[0]) - Math.PI / 2;
  const headPoint = ([x, y, z]) => world([
    j.head[0] + x * Math.cos(headTurn) - y * Math.sin(headTurn),
    j.head[1] + x * Math.sin(headTurn) + y * Math.cos(headTurn), j.head[2] + z
  ]);
  armorHelmet(fighter, kit, headPoint);

  for (const side of ['weapon', 'shield']) {
    const shoulder = j[side + 'Shoulder'];
    const elbow = j[side + 'Elbow'];
    const hand = j[side + 'Hand'];
    limb(shoulder, elbow, [.16, .15], [.109, .11], robed ? kit.color : skin, 8);
    limb(elbow, hand, [.115, .118], [.08, .083], robed ? clothLining : skin, 8);
    const shoulderShell = plated ? kit.shell || metal : robed ? fighter.color : kit.color;
    limb(shifted(shoulder, 0, 0, .046), shifted(pointBetween(shoulder, elbow, .42), 0, 0, .062),
      [kit.cut === 'fortress' ? .24 : .18, .144], [plated ? .177 : .122, .11], shoulderShell, 8);
    if (plated) {
      limb(shifted(pointBetween(shoulder, elbow, .25), 0, 0, .078), shifted(pointBetween(shoulder, elbow, .58), 0, 0, .071),
        [.163, .12], [.132, .097], kit.shell || armor, 8);
      limb(shifted(elbow, 0, .059, .051), shifted(elbow, 0, -.046, .062), [.102, .078], [.07, .065], metal, 8);
    }
    limb(shifted(pointBetween(elbow, hand, .38), 0, 0, .04), shifted(pointBetween(elbow, hand, .85), 0, 0, .039),
      [.105, .105], [.086, .086], plated ? armor : robed ? fighter.color : leather, 8);
    limb(pointBetween(elbow, hand, .83), pointBetween(elbow, hand, .91), [.092, .097], [.092, .097], bronze, 8);
    limb(pointBetween(elbow, hand, .90), pointBetween(elbow, hand, 1.14), [.082, .091], [.067, .075], robed ? skin : leather, 8);
    const knuckles = pointBetween(elbow, hand, 1.05);
    for (let index = -1; index <= 1; index++) {
      const finger = shifted(knuckles, index * .035, -.012, .072);
      limb(shifted(finger, -.008, -.036), shifted(finger, .009, .023), [.014, .012], [.017, .014],
        plated ? armor : robed ? skin : leather, 6);
    }
  }

  weaponModel(fighter, j.weaponHand, pose.angle, pose.windup, pose.strike, weaponClock(), limb, world);
  const wieldingShield = shieldReady(fighter);
  const [sx, sy, sz] = wieldingShield ? j.shieldHand : torso([-.36, .34, -.42]);
  const tilt = wieldingShield ? pose.shieldTilt : torsoAngle - .29;
  const shieldSize = wieldingShield ? 1 : .88;
  const shieldTransform = ([x, y, z]) => world([
    sx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * shieldSize,
    sy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * shieldSize,
    sz + z
  ]);
  shield(0, 0, .11, fighter, shieldTransform);
  stuckBolts(fighter, shieldTransform);
}

function stuckBolts(fighter, transform) {
  const { width: halfWidth, height: halfHeight } = shields[fighter.gear.shield];
  const piece = (a, b, radius, tip, color) => prism(a, b, [radius, radius], [tip, tip], color, transform, 6);
  for (const bolt of ArenaEffects.stuckBolts(fighter.name)) {
    // The shaft leans out of the shield face toward the shooter and the viewer.
    const head = [bolt.x * halfWidth, bolt.y * halfHeight, .25];
    const tail = shifted(head, .36, bolt.tilt * .36, .22);
    piece(head, tail, .019, .019, [226, 196, 142]);
    for (const side of [-1, 1]) {
      const vane = pointBetween(head, tail, .72);
      surface([vane, shifted(tail, -.02, side * .065), shifted(tail, .035, side * .06), tail], [222, 214, 190], 1, transform);
    }
    piece(shifted(head, -.012, 0, -.01), pointBetween(head, tail, .1), .036, .024, darkSteel);
  }
}

function worldPoint(fighter, [x, y, z]) {
  return [fighter.x + fighter.direction * x, y, fighter.z + z];
}

function weaponClock() {
  return state === 'ready' ? visualClock : elapsed + fall;
}

function weaponSegments(fighter, pose) {
  const along = weaponAxis(pose.joints.weaponHand, pose.angle);
  const key = fighter.weapon;
  switch (weaponFamily(key)) {
    case 'sword': return [[along(.23), along(key === 'rapier' ? 1.37 : key === 'falchion' ? 1.28 : 1.13, key === 'falchion' ? .14 : 0), key === 'rapier' ? .073 : .105]];
    case 'spear': {
      if (key === 'trident') return [-.19, 0, .19].map(offset => [along(1.46, offset), along(1.84, offset), .085]);
      if (key === 'halberd') return [[along(1.20, -.19), along(1.72, -.12), .155], [along(1.43), along(1.88), .10]];
      return [[along(1.24), along(1.79), .11]];
    }
    case 'axe': {
      if (key === 'crescentAxe') return [[along(.63, .44), along(1.25, .36), .18]];
      if (key === 'beardedAxe') return [[along(.42, .39), along(1.06, .22), .17]];
      return [[along(.66, .25), along(.66, .44), .19]];
    }
    case 'mace': return [[along(.67), along(key === 'mace' ? .99 : 1.08), key === 'morningstar' ? .235 : .19]];
    case 'staff': return [[along(.78), along(1.47), .11]];
    case 'greatsword': return [[along(.24), along(key === 'claymore' ? 1.74 : key === 'executioner' ? 1.55 : 1.63), key === 'executioner' ? .22 : .15]];
    case 'maul': {
      if (key === 'pickhammer') return [[along(.87, -.20), along(.94, .44), .19]];
      return [[along(.87, -.32), along(.87, .32), key === 'sledge' ? .28 : .24]];
    }
    case 'flail': return flailTrails(key, along(.61), pose.windup, pose.strike, weaponClock()).map(chain => {
      const ball = chain(1);
      return [ball, ball, key === 'flail' ? .22 : .165];
    });
  }
}

function sampleTrails() {
  for (const fighter of fighters) {
    const action = fighter.action;
    if (action?.style !== 'melee' || action.bash || action.phase < .48 || action.phase > action.hitAt + .22) continue;
    const pose = displayPose(fighter);
    const hand = pose.joints.weaponHand;
    const reach = point => Math.hypot(point[0] - hand[0], point[1] - hand[1]);
    const tip = weaponSegments(fighter, pose).flatMap(([from, to]) => [from, to])
      .reduce((far, point) => reach(point) > reach(far) ? point : far);
    ArenaEffects.trail(action, worldPoint(fighter, pointBetween(hand, tip, .56)), worldPoint(fighter, tip),
      specialOf(fighter, action.key)?.trail || (action.heavy ? '#ffd493' : '#fff4da'));
  }
}

function kickDust(fighter, strength, count) {
  ArenaEffects.dust(fighter.x, fighter.z + .2, scenery.dust, count, strength);
}

function sampleDust() {
  for (const fighter of fighters) {
    if (fighter.ragdoll) {
      for (const name of ['hips', 'chest', 'head']) {
        const { point, floor } = fighter.ragdoll.nodes[name];
        if (!ArenaEffects.lands(fighter.name + name, point[1] <= floor + .05)) continue;
        const [x, , z] = worldPoint(fighter, point);
        ArenaEffects.dust(x, z + .15, scenery.dust, 9, 1.5);
        ArenaEffects.shake(.3);
        // A body can fall past the edge of view, so keep its pool where it can be seen.
        if (name === 'chest' && fighter.ragdoll.bleeding) ArenaEffects.pool(clamp(x, -3.4, 3.4), z + .5);
      }
      continue;
    }
    if (state !== 'running') continue;
    for (const [side, offset] of [['front', 0], ['rear', .5]]) {
      const step = stepFoot(fighter.stride, offset);
      if (!ArenaEffects.lands(fighter.name + side, step.y === 0) || fighter.gait < .45) continue;
      const [x, , z] = worldPoint(fighter, displayPose(fighter).joints[side + 'Ankle']);
      ArenaEffects.dust(x, z + .1, scenery.dust, 3, .5 + fighter.gait * .45);
    }
  }
}

function bodyZones(fighter, { joints: j }, shielding) {
  const zones = [
    ['head', j.head, shifted(j.head, -.02, .13), .25],
    ['body', j.hips, j.chest, .30],
    ['arm', j.shieldShoulder, j.shieldElbow, .145],
    ['arm', j.shieldElbow, j.shieldHand, .13],
    ['arm', j.weaponShoulder, j.weaponElbow, .14],
    ['arm', j.weaponElbow, j.weaponHand, .12],
    ['leg', j.frontHip, j.frontKnee, .145],
    ['leg', j.frontKnee, j.frontAnkle, .13],
    ['leg', j.rearHip, j.rearKnee, .145],
    ['leg', j.rearKnee, j.rearAnkle, .13]
  ];
  if (shielding && shieldReady(fighter)) {
    const shield = shields[fighter.gear.shield];
    const radius = shield.width * .64;
    const span = shield.height - radius - .03;
    zones.unshift(['shield', shifted(j.shieldHand, 0, -span), shifted(j.shieldHand, 0, span), radius]);
  }
  return zones;
}

function nearestPoint(point, from, to) {
  const delta = to.map((value, index) => value - from[index]);
  // Depth matters less than height in the narrow lane where the fighters meet.
  const weights = [1, 1, .23];
  const lengthSquared = delta.reduce((sum, value, i) => sum + value * value * weights[i], 0);
  const dot = delta.reduce((sum, value, i) => sum + value * (point[i] - from[i]) * weights[i], 0);
  return pointBetween(from, to, lengthSquared > 0 ? clamp(dot / lengthSquared, 0, 1) : 0);
}

function attackSegments(action, pose) {
  if (!action.bash) return weaponSegments(action.attacker, pose);
  const hand = shifted(pose.joints.shieldHand, .20, .02);
  return [[shifted(hand, 0, -.18), shifted(hand, 0, .20), .26]];
}

function checkContact(action, previous, current) {
  const { attacker, defender } = action;
  const source = attackSegments(action, fighterPose(attacker));
  const zones = bodyZones(defender, fighterPose(defender), isGuarding(action)).map(([zone, from, to, radius]) =>
    [zone, worldPoint(defender, from), worldPoint(defender, to), radius]);
  const prior = action.weaponSweep || source.map(([start, end]) => [worldPoint(attacker, start), worldPoint(attacker, end)]);
  action.weaponSweep = source.map(([start, end]) => [worldPoint(attacker, start), worldPoint(attacker, end)]);

  let contact;
  // Sample the swept blade between frames as well as along its length.
  for (let t = 1; t <= 4; t++) {
    const framePhase = mix(previous, current, t / 4);
    if (framePhase < .68 || framePhase > .99) continue;
    for (const [index, [, , thickness]] of source.entries()) {
      const [oldStart, oldEnd] = prior[index];
      const [newStart, newEnd] = action.weaponSweep[index];
      const from = pointBetween(oldStart, newStart, t / 4);
      const to = pointBetween(oldEnd, newEnd, t / 4);
      for (let i = 0; i <= 5; i++) {
        const point = pointBetween(from, to, i / 5);
        for (const [zone, a, b, radius] of zones) {
          const nearest = nearestPoint(point, a, b);
          const distance = Math.hypot(point[0] - nearest[0], point[1] - nearest[1], (point[2] - nearest[2]) * .48);
          if (distance > thickness + radius) continue;
          const candidate = { zone, point: pointBetween(point, nearest, .5), distance: distance / (radius + thickness) };
          if (zone === 'shield') return candidate;
          if (!contact || candidate.distance < contact.distance) contact = candidate;
        }
      }
    }
    if (contact) return contact;
  }
  return null;
}

const ragdollBones = [
  ['hips', 'chest'], ['chest', 'head'], ['hips', 'head'],
  ['chest', 'weaponShoulder'], ['chest', 'shieldShoulder'], ['weaponShoulder', 'shieldShoulder'],
  ['hips', 'rearHip'], ['hips', 'frontHip'], ['rearHip', 'frontHip'],
  ['rearHip', 'chest'], ['frontHip', 'chest'],
  ['weaponShoulder', 'hips'], ['shieldShoulder', 'hips']
];
for (const side of ['rear', 'front']) {
  ragdollBones.push([side + 'Hip', side + 'Knee'], [side + 'Knee', side + 'Ankle'],
    [side + 'Ankle', side + 'Toe']);
}
for (const side of ['weapon', 'shield']) {
  ragdollBones.push([side + 'Shoulder', side + 'Elbow'], [side + 'Elbow', side + 'Hand']);
}

function makeRagdoll(fighter, zone) {
  // The ragdoll only animates the fall, so it starts from what was on screen.
  const pose = displayPose(fighter);
  const nodes = Object.fromEntries(Object.entries(pose.joints).map(([name, point]) => {
    const upperBody = point[1] / 2.4;
    const floor = name === 'head' ? .25 : name === 'hips' || name === 'chest' ? .22 : .075;
    const push = name === 'head' && zone === 'head' ? .7 : 0;
    return [name, { point, speed: [-.48 - upperBody * 2.3 - push, upperBody * .6, (Math.random() - .5) * .65], floor }];
  }));
  const links = ragdollBones.map(([a, b]) => {
    const from = nodes[a].point;
    const to = nodes[b].point;
    return [nodes[a], nodes[b], Math.hypot(...to.map((value, i) => value - from[i]))];
  });
  return {
    nodes, links, pose,
    weaponOffset: pose.angle - forearmAngle(pose.joints, 'weapon'),
    shieldOffset: pose.shieldTilt - forearmAngle(pose.joints, 'shield')
  };
}

function forearmAngle(joints, side) {
  const [a, b] = [joints[side + 'Elbow'], joints[side + 'Hand']];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

function stepRagdoll(ragdoll, dt) {
  const nodes = Object.values(ragdoll.nodes);
  const positions = nodes.map(node => node.point.slice());
  for (const { point, speed } of nodes) {
    speed[1] -= dt * 13;
    for (let axis = 0; axis < 3; axis++) point[axis] += speed[axis] * dt;
  }
  for (let iteration = 0; iteration < 7; iteration++) {
    for (const [a, b, rest] of ragdoll.links) {
      const delta = b.point.map((value, axis) => value - a.point[axis]);
      const distance = Math.hypot(...delta);
      const correction = (distance - rest) * .5 / (distance || 1);
      for (let axis = 0; axis < 3; axis++) {
        a.point[axis] += delta[axis] * correction;
        b.point[axis] -= delta[axis] * correction;
      }
    }
    for (const node of nodes) {
      node.point[1] = Math.max(node.floor, node.point[1]);
      node.point[2] = clamp(node.point[2], -.85, .85);
    }
  }
  nodes.forEach((node, index) => {
    const grounded = node.point[1] <= node.floor + .015;
    for (let axis = 0; axis < 3; axis++) {
      const damping = Math.exp(-dt * (grounded ? 14 : 2.1));
      node.speed[axis] = (node.point[axis] - positions[index][axis]) / dt * damping;
    }
  });
  const { pose } = ragdoll;
  pose.angle = forearmAngle(pose.joints, 'weapon') + ragdoll.weaponOffset;
  pose.shieldTilt = forearmAngle(pose.joints, 'shield') + ragdoll.shieldOffset;
  pose.strike = pose.windup = 0;
  pose.twist *= Math.exp(-dt * 3);
  pose.cloth *= Math.exp(-dt * 3.5);
}

function drawHitboxes(fighter, pose) {
  const colors = { head: '#f6bb7a7d', body: '#bade9c63', arm: '#91d8fd79', leg: '#91d8fd79', shield: '#f5e5a89a' };
  const zones = bodyZones(fighter, pose, true).map(([zone, a, b, radius]) => [colors[zone], a, b, radius]);
  if (fighter.action?.style === 'melee' && !fighter.ragdoll) {
    zones.push(...attackSegments(fighter.action, pose).map(([a, b, radius]) => ['#ff857ab8', a, b, radius]));
  }
  ctx.lineCap = 'round';
  for (const [color, a, b, radius] of zones) {
    const [x, y] = project(worldPoint(fighter, a));
    const [tx, ty] = project(worldPoint(fighter, b));
    ctx.lineWidth = radius * scale * 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx + .01, ty);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawBackdrop() {
  const rand = randomSource(351);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#8a563b');
  gradient.addColorStop(.48, '#ad7651');
  gradient.addColorStop(.49, '#c69660');
  gradient.addColorStop(1, '#935c38');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const stone = Math.max(24, width / 20);
  for (let row = 0; row < 7; row++) {
    for (let column = -1; column < width / stone; column++) {
      const x = (column + (row % 2) * .5) * stone;
      ctx.fillStyle = rand() > .52 ? '#ffd29b16' : '#5227121c';
      ctx.fillRect(x + 1, row * height * .069, stone - 2, height * .069 - 2);
    }
  }
  const bay = clamp(width / 8, 90, 145);
  for (let i = -1; i < Math.ceil(width / bay); i++) {
    const x = i * bay + bay * .11;
    const y = height * .09;
    const w = bay * .78;
    const h = height * .33;
    ctx.fillStyle = '#b1835d';
    ctx.fillRect(x - 4, y + w * .4, w + 8, h - w * .4);
    const recess = ctx.createLinearGradient(0, y, 0, y + h);
    recess.addColorStop(0, '#482a22');
    recess.addColorStop(1, '#8c5c40');
    ctx.fillStyle = recess;
    ctx.beginPath();
    ctx.moveTo(x + w * .12, y + h);
    ctx.lineTo(x + w * .12, y + w * .45);
    ctx.ellipse(x + w * .50, y + w * .45, w * .38, w * .35, 0, Math.PI, 2 * Math.PI);
    ctx.lineTo(x + w * .88, y + h);
    ctx.fill();
    ctx.strokeStyle = '#c79970';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#d8ae7f';
    ctx.fillRect(x + w * .45, y + w * .08, w * .10, 5);
    ctx.fillStyle = '#bf976f';
    ctx.fillRect(x - 3, y + w * .54, 8, h - w * .54);
    ctx.fillStyle = '#513322';
    ctx.fillRect(x + w * .24, y + h - 7, w * .52, 7);
  }

  ctx.fillStyle = '#815134';
  ctx.fillRect(0, height * .411, width, height * .078);
  ctx.fillStyle = '#ce9d6d';
  ctx.fillRect(0, height * .418, width, 4);
  ctx.fillStyle = '#9d6847';
  ctx.fillRect(0, height * .449, width, height * .037);
  ctx.fillStyle = '#75482d';
  for (let x = 0; x < width; x += 43) ctx.fillRect(x, height * .45, 1.5, height * .036);

  for (const [side, cloth, fold] of [[-1, '#853f34', '#a85542'], [1, '#37585b', '#47767a']]) {
    const x = width * (.5 + side * .34);
    const y = height * .105;
    const w = clamp(width * .058, 27, 58);
    const h = height * .26;
    ctx.fillStyle = '#d9ad75';
    ctx.fillRect(x - w * .61, y - 3, w * 1.22, 4);
    polygon([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h * .86], [x, y + h], [x - w / 2, y + h * .86]], cloth);
    polygon([[x - w / 2, y], [x - w * .13, y], [x - w * .10, y + h * .96], [x - w / 2, y + h * .86]], fold);
    polygon([[x, y + h * .28], [x + w * .22, y + h * .48], [x, y + h * .66], [x - w * .22, y + h * .48]], '#d7a46b');
    polygon([[x, y + h * .37], [x + w * .12, y + h * .48], [x, y + h * .57], [x - w * .12, y + h * .48]], cloth);
  }

  for (let i = 0; i < 380; i++) {
    const x = rand() * width;
    const y = mix(height * .49, height, rand());
    ctx.fillStyle = i % 2 ? '#f5c58736' : '#57351923';
    ctx.fillRect(x, y, rand() * 5 + 1, rand() * 1.5 + .4);
  }
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const angle = i / 72 * 2 * Math.PI;
    const [x, y] = project([Math.cos(angle) * 3.75, 0, Math.sin(angle) * 2.6]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#f5d09b53';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const glow = ctx.createRadialGradient(width * .50, height * .70, 0, width * .50, height * .70, width * .56);
  glow.addColorStop(0, '#ffdc8b35');
  glow.addColorStop(1, '#1e0e0963');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function magicGlow(x, y, radius, color) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color + 'ba');
  glow.addColorStop(.38, color + '53');
  glow.addColorStop(1, color + '00');
  ellipse(x, y, radius, radius, glow);
}

function drawMagic() {
  for (const fighter of fighters) {
    if (fighter.ward > 0) {
      const [x, y] = project([fighter.x, 1.19, fighter.z + .35]);
      const radius = scale * (1.04 + Math.sin(visualClock * 5) * .025);
      const color = fighter.wardColor;
      magicGlow(x, y, radius, color);
      ctx.beginPath();
      ctx.ellipse(x, y, radius * .65, radius * 1.24, .08 * fighter.direction, 0, Math.PI * 2);
      ctx.strokeStyle = color + '8c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ownedSpecial(fighter)?.draw?.(fighter, fighter.special);
    if (fighter.burnUntil > elapsed) {
      const [x, y] = project([fighter.x, .9, fighter.z + .3]);
      magicGlow(x, y, scale * (.8 + Math.sin(visualClock * 17) * .06), '#ff7a30');
    }
    const aura = ownedSpecial(fighter)?.aura?.(fighter, fighter.special);
    if (aura) {
      const [x, y] = project([fighter.x, 1.2, fighter.z + .35]);
      magicGlow(x, y, scale * (1.1 + Math.sin(visualClock * 7) * .06), aura);
    }
    if (fighter.rootedUntil > elapsed) {
      // Snare cords wound around the legs, tightening and loosening a little.
      const [x, y] = project([fighter.x, .05, fighter.z]);
      ellipse(x, y, scale * .5, scale * .12, '#6d9a4f80');
      ctx.strokeStyle = specials.snarecaster.color;
      ctx.lineWidth = 2;
      for (let loop = 0; loop < 3; loop++) {
        const [, ly] = project([fighter.x, .14 + loop * .17, fighter.z]);
        ctx.beginPath();
        ctx.ellipse(x, ly, scale * (.27 + Math.sin(visualClock * 6 + loop) * .015), scale * .06, .12 * fighter.direction, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (fighter.chilledUntil > elapsed || fighter.frozenUntil > elapsed) {
      const [x, y] = project([fighter.x, .23, fighter.z]);
      ellipse(x, y, scale * .52, scale * .13, '#b4e2f27a');
      if (fighter.frozenUntil > elapsed) {
        for (const [offset, height] of [[-.34, .45], [-.13, .64], [.13, .45], [.32, .36]]) {
          const size = height * scale;
          const cx = x + offset * scale;
          polygon([[cx - 5, y + 4], [cx - 4, y - size * .32], [cx + 2, y - size], [cx + 7, y - size * .24],
            [cx + 6, y + 4]], '#a5d8eea7');
          polygon([[cx, y + 4], [cx + 2, y - size], [cx + 7, y - size * .24], [cx + 6, y + 4]], '#dfecf5a0');
        }
      }
    }
    if (fighter.hastedUntil > elapsed) {
      const [x, y] = project([fighter.x, .15, fighter.z + .1]);
      ellipse(x, y, scale * .57, scale * .11, '#d9ee9966');
    }
  }
  for (const fighter of fighters) {
    if (fighter.action?.spell) drawCast(fighter.action);
  }
}

function drawCast({ attacker, defender, spell, hitAt, phase }) {
  if (phase < .30 || phase > 1.10) return;
  const pose = displayPose(attacker);
  const staffTip = weaponAxis(pose.joints.weaponHand, pose.angle)(1.40);
  const start = weapons[attacker.weapon].spellPower ? project(worldPoint(attacker, staffTip))
    : project([attacker.x + attacker.direction * .67, 1.64, attacker.z + .59]);
  const end = spell.damage ? project([defender.x - attacker.direction * .31, 1.40, defender.z + .52]) : start;
  const progress = clamp((phase - .55) / (hitAt - .55), 0, 1);
  const x = mix(start[0], end[0], progress);
  const y = mix(start[1], end[1], progress) - Math.sin(progress * Math.PI) * 13;
  const charge = ease((phase - .30) / .25);
  ctx.globalAlpha = phase > hitAt ? 1 - ease((phase - hitAt) / .16) : charge;
  const radius = Math.max(12, scale * .30);
  magicGlow(x, y, radius * 2.15, spell.color);
  if (spell.damage) {
    const d = attacker.direction;
    const tail = radius * (progress > 0 ? 2.1 : .7);
    if (spell.ice) {
      const shards = spell.freeze ? [-.48, 0, .48] : [0];
      for (const offset of shards) {
        const ty = y + offset * radius;
        const tx = x - Math.abs(offset) * tail * d;
        polygon([[tx + radius * .75 * d, ty], [tx - radius * .22 * d, ty - radius * .26], [tx - tail * d, ty + 3],
          [tx - radius * .18 * d, ty + radius * .23]], spell.color);
      }
    } else if (spell.lightning) {
      polygon([[x + radius * .76 * d, y - 3], [x, y + 6], [x - tail * .40 * d, y + 1],
        [x - tail * .57 * d, y + 6], [x - tail * d, y - 7], [x - tail * .38 * d, y - 4],
        [x - tail * .34 * d, y - 9]], spell.color);
    } else {
      ellipse(x - tail * d * .42, y + 2, tail * .70, radius * .32, spell.color + 'a0');
      ellipse(x, y, radius * .48, radius * .42, spell.color);
    }
    ellipse(x, y, radius * .23, radius * .20, '#fffbec');
  } else {
    for (let i = 0; i < 7; i++) {
      const orbit = visualClock * 6 + i * Math.PI * 2 / 7;
      ellipse(x + Math.cos(orbit) * radius, y + Math.sin(orbit * 2) * radius * .55, 2.4, 2.4, spell.color);
    }
  }
  ctx.globalAlpha = 1;
}

function boltTarget(defender, block) {
  const { joints } = fighterPose(defender);
  return worldPoint(defender, block ? joints.shieldHand : shifted(joints.chest, 0, -.17, .22));
}

function drawBolts() {
  for (const fighter of fighters) {
    if (fighter.action?.style === 'ranged') drawBolt(fighter.action);
  }
}

function drawBolt(action) {
  const { attacker, defender, missedShot, hitAt, phase } = action;
  if (phase > 1.02 || action.lodged) return;
  const pose = displayPose(attacker);
  const tip = weaponAxis(pose.joints.weaponHand, pose.angle)(.79, .05);
  const from = worldPoint(attacker, tip);
  const target = shifted(boltTarget(defender, isGuarding(action)), missedShot ? attacker.direction * .8 : 0, missedShot ? .48 : 0);
  const travel = clamp((phase - .55) / (hitAt - .55), 0, 1.16);
  const point = pointBetween(from, target, travel);
  const [x, y] = project(point);
  const tail = project(shifted(point, -attacker.direction * .33, -.015));
  ctx.strokeStyle = action.snare ? specials.snarecaster.color : action.doubleShot || action.echo ? fireColors[0] : travel > 0 ? '#fae3ac' : '#cdb592';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...tail.slice(0, 2));
  ctx.lineTo(x, y);
  ctx.stroke();
  ellipse(x, y, 2.6, 1.5, '#ebe3c7');
  if (action.doubleShot && travel > .12) {
    // The second, burning bolt trails the first.
    const echo = project(shifted(pointBetween(from, target, travel - .12), 0, .09));
    const echoTail = project(shifted(pointBetween(from, target, travel - .12), -attacker.direction * .33, .075));
    ctx.strokeStyle = fireColors[0];
    ctx.beginPath();
    ctx.moveTo(echoTail[0], echoTail[1]);
    ctx.lineTo(echo[0], echo[1]);
    ctx.stroke();
    ellipse(echo[0], echo[1], 3, 1.8, fireColors[1]);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const density = ArenaBench.lowResolution ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  scale = Math.min(width / 8.3, height / 4.02);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  ctx.setTransform(density, 0, 0, density, 0, 0);
  scenery.backdrop(width, height, drawBackdrop);
  backdrop = document.createElement('canvas');
  backdrop.width = canvas.width;
  backdrop.height = canvas.height;
  backdrop.getContext('2d').drawImage(canvas, 0, 0);
  draw();
}

// Paints the depth-sorted faces. Canvas 2D fills one path per face; WebGL (gl-renderer.js)
// batches them and is about 4× cheaper on the main thread at phone size (1.8 ms vs 0.4 ms
// for 2,347 faces). Build and sort cost the same for both. See docs/rendering-performance.md.
let glRenderer;
function paintFaces() {
  if (ArenaBench.renderer === 'webgl' && glRenderer === undefined) glRenderer = ArenaGL.create();
  const useGL = ArenaBench.renderer === 'webgl' && glRenderer && !glRenderer.lost
    && glRenderer.paint(faces, width, height, canvas.width, canvas.height);
  if (useGL) ctx.drawImage(glRenderer.canvas, 0, 0, width, height);
  else for (const face of faces) polygon(face.projected, 'rgb(' + face.rgb.join(',') + ')');
  ArenaBench.report(useGL ? 'webgl' : 'canvas', faces.length, useGL ? glRenderer.paint.complex : 0,
    canvas.width + '×' + canvas.height + ' px');
}

// Frame order: cached still backdrop, animated scenery, stains and shadows, fighter faces
// (build → sort → paintFaces), then effects and labels on top. Keep fighter faces in one
// contiguous paintFaces() call so either renderer can paint them without breaking layering.
function draw() {
  // The benchmark times three sections and can skip each one; skipping only changes the picture.
  const startedAt = performance.now();
  // The still backdrop underneath fills the edges that a shake uncovers.
  ctx.drawImage(backdrop, 0, 0, width, height);
  const [shakeX, shakeY] = ArenaEffects.offset();
  ctx.save();
  if (shakeX || shakeY) {
    ctx.translate(shakeX * scale, shakeY * scale);
    ctx.drawImage(backdrop, 0, 0, width, height);
  }
  if (ArenaBench.drawScenery) scenery.draw(width, height, sceneryClock);
  const sceneDone = performance.now();
  if (ArenaBench.drawEffects) ArenaEffects.drawStains(ctx, project, scale);
  const stainsDone = performance.now();
  const poses = fighters.map(fighter => fighter.ragdoll?.pose || displayPose(fighter));
  if (ArenaBench.drawFighters) fighters.forEach((fighter, index) => {
    const pose = poses[index];
    const hips = pose.joints.hips;
    const down = fighter.ragdoll ? clamp(1 - hips[1] / 1.1, 0, 1) : 0;
    const [x, y] = project(worldPoint(fighter, [hips[0], 0, hips[2] + .18]));
    ellipse(x, y + 2, scale * (.55 + down * .57), scale * .15, '#341a1270');
    if (!fighter.ragdoll) {
      for (const foot of [pose.joints.frontAnkle, pose.joints.rearAnkle]) {
        const [fx, fy] = project(worldPoint(fighter, [foot[0] + .05, 0, foot[2]]));
        ctx.globalAlpha = clamp(1.2 - foot[1] * 3, .26, .7);
        ellipse(fx, fy + 1, scale * .255, scale * .057, '#33291b');
        ctx.globalAlpha = 1;
      }
    }
    // The benchmark's polygon multiplier rebuilds each fighter in place: same picture, more polygons.
    for (let copy = 0; copy < ArenaBench.polygons; copy++) drawGladiator(fighter, pose);
  });
  faces.sort((a, b) => a.depth - b.depth);
  paintFaces();
  faces.length = 0;
  const fightersDone = performance.now();
  const effects = ArenaBench.drawEffects;
  if (effects) {
    ArenaEffects.drawDust(ctx, project, scale);
    ArenaEffects.drawTrails(ctx, project);
  }
  // Hitboxes show the combat pose that checkContact actually tests.
  if (showHitboxes) fighters.forEach(fighter => drawHitboxes(fighter, fighter.ragdoll?.pose || fighterPose(fighter)));
  if (effects) drawEffects();
  ctx.restore();
  if (effects) ArenaEffects.drawLabels(ctx, project, width, height);
  ArenaBench.parts(sceneDone - startedAt, fightersDone - stainsDone, stainsDone - sceneDone + performance.now() - fightersDone);
}

// Magic, bolts, particles, blood and sparks, drawn over the fighters and hitboxes.
function drawEffects() {
  drawMagic();
  drawBolts();
  for (const particle of particles) {
    const [x, y] = project([particle.x, particle.y, particle.z]);
    // Magic particles streak along their flight.
    const [tailX, tailY] = project([particle.x - particle.vx * .035, particle.y - particle.vy * .035, particle.z - particle.vz * .035]);
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ArenaEffects.drawBlood(ctx, project, scale);
  ArenaEffects.drawSparks(ctx, project, scale);
}

function logEvent(message) {
  elements.log.querySelector('.empty')?.remove();
  const entry = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = Math.floor(elapsed / 60) + ':' + String(Math.floor(elapsed % 60)).padStart(2, '0');
  entry.append(time, document.createTextNode(message));
  elements.log.prepend(entry);
  while (elements.log.children.length > 6) elements.log.lastElementChild.remove();
}

function updateHealth() {
  fighters.forEach(({ hp, maxHP, hud }) => {
    hud.hp.textContent = hp + ' / ' + maxHP + ' HP';
    hud.meter.max = maxHP;
    hud.meter.value = hp;
  });
}

function updateEnergy(fighter) {
  const energy = Math.floor(fighter.energy);
  const { hud } = fighter;
  if (hud.energy.value !== energy) {
    hud.energy.value = energy;
    hud.ep.textContent = energy + ' Energy';
  }
  const low = String(energy < 25);
  if (hud.energy.parentElement.dataset.low !== low) hud.energy.parentElement.dataset.low = low;
}

function spendEnergy(fighter, cost) {
  fighter.energy = Math.max(0, fighter.energy - cost);
  updateEnergy(fighter);
}

function canCast(fighter, key) {
  return fighter.mp >= spells[key].cost && elapsed >= (fighter.cooldowns[key] || 0);
}

function updateMana() {
  for (const fighter of fighters) {
    const mana = Math.floor(fighter.mp);
    if (fighter.hud.mana.value !== mana) {
      fighter.hud.mana.value = mana;
      fighter.hud.mp.textContent = mana + ' MP';
    }
    for (const key of fighter.spells) {
      const ready = String(canCast(fighter, key));
      if (fighter.spellBadges[key].dataset.ready !== ready) fighter.spellBadges[key].dataset.ready = ready;
    }
  }
}

function supportPriority(fighter, spell) {
  const health = fighter.hp / fighter.maxHP;
  if (spell.heal) return health <= .61 ? 45 : 0;
  if (spell.absorb) return health <= .77 && !fighter.ward ? 28 : 0;
  if (spell.manaRestore) return fighter.mp <= 24 && health >= .41 ? 32 : 0;
  if (spell.energyRestore) return fighter.energy <= 40 && fighter.hastedUntil <= elapsed ? 31 : 0;
  return 0;
}

function pickAction(attacker, defender) {
  const locked = ownedSpecial(attacker)?.lockWeapon?.(attacker, attacker.special);
  if (locked) return { key: locked, style: weaponClass(locked) };
  const keys = weaponKeys(attacker).filter(key => key === attacker.weapon || attacker.energy >= switchCost);
  const targetArmor = armors[defender.gear.armor];
  const distance = Math.abs(attacker.x - defender.x);
  const crowding = closeRange(distance);
  const opposingCrossbow = weapons[defender.weapon].style === 'ranged';
  const available = attacker.spells.filter(key => canCast(attacker, key));
  const needsSupport = available.some(key => supportPriority(attacker, spells[key]) > 0);
  if (opposingCrossbow && keys.includes('sword') && attacker.energy >= 12 && distance > 1.95 && !needsSupport) {
    return { key: 'sword', style: 'melee' };
  }
  const useOffhandMagic = elapsed > 1.2 && (Math.random() < .51 || (crowding > .38 && weapons[attacker.weapon].style === 'ranged'));
  const candidates = [];
  for (const key of keys) {
    const weapon = weapons[key];
    const style = weapon.style || 'melee';
    const handling = powerProfile(weapon, attacker.strength);
    const stamina = clamp(attacker.energy / handling.cost, 0, 1);
    const level = style === 'ranged' ? attacker.ranged : (attacker.attack + attacker.strength) / 2;
    const reach = style === 'ranged'
      ? (.95 + Math.min(distance, 4.7) * .075) * mix(1, .27, crowding)
      : 1 - Math.max(0, distance - weapon.range) * (opposingCrossbow ? .038 : .095);
    const repeat = key === attacker.lastWeapon ? Math.pow(.88, Math.min(attacker.weaponStreak, 4)) : 1;
    const switchFactor = key === attacker.weapon ? 1 : .92;
    const pressure = opposingCrossbow && style === 'melee' ? (key === 'sword' ? 1.50 : 1.24) : 1;
    const score = (weapon.damage * handling.power + 3) * targetArmor[style] * (.69 + level / 205)
      * weapon.tempo * mix(.68, 1, stamina) * reach * repeat * armorPower(attacker, style) * pressure
      * (1.28 / (.78 + handling.recovery))
      * (1 + accuracyBonus(attacker, defender, style, key) / 250) * switchFactor;
    if (!weapon.spellPower) candidates.push({ key, style, score });
    const choices = weapon.spellPower ? [...available, 'spark'] : key === attacker.weapon ? available : [];
    for (const spellKey of choices) {
      const spell = spells[spellKey];
      const support = supportPriority(attacker, spell);
      if (!support && (!spell.damage || !(weapon.spellPower || useOffhandMagic))) continue;
      const boost = weapon.spellPower || 1;
      const control = (spell.freeze && defender.frozenUntil <= elapsed ? 6 : 0)
        + (spell.chill && defender.chilledUntil <= elapsed ? 2 : 0)
        + (spell.energyDrain && defender.energy > 25 ? 3.5 : 0)
        + (spell.lifesteal || 0) * (1 - attacker.hp / attacker.maxHP) * 12;
      const efficiency = mix(.10, .63, 1 - attacker.mp / 100);
      const spellScore = support || ((spell.damage + control) * targetArmor.magic * (.69 + attacker.magic / 210)
        * .91 * repeat * armorPower(attacker, 'magic') * (1 + accuracyBonus(attacker, defender, 'magic', key) / 250)
        * (weapon.castTempo || 1)
        - spell.cost * .21 * efficiency);
      candidates.push({ key, style: 'magic', spellKey, score: spellScore * boost * switchFactor });
    }
  }
  return candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
}

function updateControls() {
  const ui = {
    ready: ['Ready', 'Begin duel'],
    running: ['In progress', 'Pause'],
    paused: ['Paused', 'Resume'],
    finished: ['Bout complete', 'Rematch']
  };
  [elements.status.textContent, elements.play.textContent] = ui[state];
  // Fights are fully idle: once one starts, nothing may change it until it ends.
  const locked = state === 'running' || state === 'paused';
  elements.reset.disabled = state !== 'finished';
  elements.generate.disabled = locked;
  document.querySelectorAll('.venue-control, .scenery-target').forEach(button => { button.disabled = locked; });
  for (const fighter of fighters) {
    for (const picker of Object.values(fighter.loadout)) {
      picker.disabled = locked;
      // Keeps item details reachable by keyboard while the picker is locked.
      if (locked) picker.parentElement.tabIndex = 0;
      else picker.parentElement.removeAttribute('tabindex');
    }
  }
  fighters.forEach(updateGearNote);
}

function powerProfile(item, strength) {
  const heavy = item.twoHanded && !item.style && !item.spellPower;
  const handling = smooth((strength - 66) / 29);
  return {
    heavy,
    cost: Math.ceil(item.energy * (heavy ? 1.20 : 1)),
    power: heavy ? 1.21 : 1,
    recovery: heavy ? mix(1.03, .38, handling) : .50
  };
}

function otherFighter(fighter) {
  return fighters.find(other => other !== fighter);
}

function canGuard(fighter) {
  const own = fighter.action;
  if (ownedSpecial(fighter)?.noGuard?.(fighter, fighter.special)) return false;
  return shieldReady(fighter) && fighter.stunnedUntil <= elapsed
    && (!own || (own.connected && own.phase > own.hitAt + .12 && !own.bash));
}

function isGuarding(action) {
  const { defender } = action;
  return action.block && canGuard(defender) && defender.energy >= (action.guardCost || shields[defender.gear.shield].energy);
}

function shouldBash(attacker, defender, gap) {
  const incoming = defender.action;
  if (!shieldReady(attacker) || attacker.energy < 14) return false;
  // A perfect block earns a riposte bash that ignores the cooldown.
  if (attacker.riposte && attacker.counterUntil > elapsed && gap < 2.7) return true;
  return attacker.bashReady <= elapsed
    && gap < 2.05 && (attacker.counterUntil > elapsed
    || (incoming?.heavy && !incoming.connected && incoming.phase < .53));
}

function startAction(attacker, defender, bash = false) {
  const gap = (defender.x - attacker.x) * attacker.direction;
  const { key, style, spellKey } = bash ? { key: attacker.weapon, style: 'melee' } : pickAction(attacker, defender);
  const previousPose = fighterPose(attacker);
  const previousWeapon = attacker.weapon;
  const switched = previousWeapon !== key;
  if (switched) {
    spendEnergy(attacker, switchCost);
    attacker.weapon = key;
    updateStats(attacker);
    logEvent(attacker.name + ' switches to ' + weaponName(attacker, key) + ' for ' + switchCost + ' energy.');
  }
  const item = weapons[key];
  const spell = spells[spellKey];
  const ranged = style === 'ranged';
  const handling = style === 'melee' && !bash ? powerProfile(item, attacker.strength)
    : { heavy: false, cost: bash ? 14 : item.energy, power: 1, recovery: .51 };
  const fatigue = spell ? 1 : clamp(attacker.energy / handling.cost, 0, 1);
  const equipAccuracy = accuracyBonus(attacker, defender, style, key);
  const guard = shields[defender.gear.shield];
  const ownShield = shields[attacker.gear.shield];
  const blockChance = (bash ? .12 : spell ? spell.block || 0 : item.block)
    + clamp((defense(defender) - 56) / (spell ? 350 : 150), -.10, .20);
  const guardCost = guard.energy + (handling.heavy ? 7 : 0);
  const block = shieldReady(defender) && !ownedSpecial(defender)?.noGuard?.(defender, defender.special) && (!spell || spell.damage) && defender.energy >= guardCost
    && (Math.random() < Math.max(.03, blockChance) || (forced.has('perfect') && style === 'melee' && !bash));
  // A well-timed block: easier against telegraphed heavy swings and for high Defense.
  const perfect = block && style === 'melee' && !bash
    && (forced.has('perfect') || Math.random() < clamp(.45 + (handling.heavy ? .15 : 0) + (defense(defender) - 56) / 250, .25, .70));
  const evade = !spell && !bash && !block && defender.frozenUntil <= elapsed && defender.energy >= 11
    && Math.random() < clamp(.18 - equipAccuracy / 520, .04, .30) * mobility(defender);
  const aimRoll = Math.random();
  const aim = defender.stunnedUntil > elapsed ? -.64 : aimRoll < .19 ? -.96 : aimRoll > .69 ? .93 : .08;
  const reach = bash ? 1.18 : item.range - .23 - Math.abs(aim) * .26;
  const tempo = (bash ? 2.34 * ownShield.bashTempo : spell ? .99 * (item.castTempo || 1) : item.tempo * 1.16)
    * mobility(attacker) * mix(.76, 1, fatigue) * (attacker.chilledUntil > elapsed ? .76 : 1);
  const attackSkill = ranged ? attacker.ranged : attacker.strength;
  const damage = bash ? (5.5 + attacker.strength / 28) * fatigue * ownShield.bashPower
    : spell ? (spell.damage || 0) * (item.spellPower || 1) * (.76 + attacker.magic / 300)
      : (item.damage + Math.floor(Math.random() * 7)) * (.73 + attackSkill / 245) * mix(.67, 1, fatigue) * handling.power;
  const hitAt = spell || ranged ? .94 : .78;
  const now = elapsed;
  attacker.action = {
    attacker, defender, phase: 0, created: now, previousPose, bash, key,
    block, guardCost, evade, spell, spellKey, aim, style, switched, perfect,
    riposte: bash && attacker.riposte && attacker.counterUntil > now, bashPower: bash ? ownShield.bashPower : 1,
    damage: damage * (bash ? 1 : armorPower(attacker, style)),
    crowded: ranged ? closeRange(gap) : 0,
    shotRoll: Math.random(),
    shotAccuracy: .75 + attacker.ranged / 390 + equipAccuracy / 430,
    resistedSpell: spell?.damage && Math.random() > clamp(.95 + equipAccuracy / 410, .72, .99),
    attackType: bash ? 2 : attackType(style, key),
    heavy: handling.heavy, cost: handling.cost, tempo, hitAt, reach,
    stanceDamage: bash ? 47 * ownShield.bashPower : spell ? 12 : ranged ? 16 : handling.heavy ? 49 : 24 + item.damage * .36,
    duration: hitAt + (bash ? .43 : handling.recovery) + (switched ? .13 : 0)
  };
  if (!bash && !spell) specialOf(attacker, key)?.modifyAction?.(attacker, attacker.action, attacker.special);
  if (bash) {
    attacker.counterUntil = 0;
    attacker.riposte = false;
    attacker.bashReady = now + 2.8;
  } else {
    attacker.weaponStreak = key === attacker.lastWeapon ? attacker.weaponStreak + 1 : 1;
    attacker.lastWeapon = key;
  }
}

function showCurrentAction() {
  // A special's own banner (such as a heal being channeled) wins over attacks.
  for (const fighter of fighters) {
    const special = ownedSpecial(fighter);
    const text = special?.banner?.(fighter, fighter.special);
    if (!text) continue;
    elements.cast.hidden = false;
    const label = fighter.name + ' · ' + text;
    if (elements.cast.textContent !== label) elements.cast.textContent = label;
    elements.cast.style.setProperty('--spell-color', special.color);
    return;
  }
  const current = fighters.map(fighter => fighter.action)
    .filter(action => action && !action.connected && (action.spell || action.style === 'ranged' || action.bash || action.label))
    .sort((a, b) => b.created - a.created)[0];
  elements.cast.hidden = !current;
  if (!current) return;
  const name = current.riposte ? 'Riposte bash' : current.bash ? 'Shield bash' : current.spell?.name
    ?? (current.label || (current.snare ? 'Snare bolt' : null)) ?? (current.crowded > .35 ? 'Crowded shot' : weaponName(current.attacker, current.key));
  const label = current.attacker.name + ' · ' + name;
  if (elements.cast.textContent !== label) {
    elements.cast.textContent = label;
    elements.cast.style.setProperty('--spell-color', current.spell?.color ?? specialOf(current.attacker, current.key)?.color ?? '#e5cf8e');
  }
}

function startBout(generated = null) {
  elapsed = 0;
  fall = 0;
  hitPause = 0;
  particles.length = 0;
  scheduled.length = 0;
  ArenaEffects.reset();
  fighters.forEach((fighter, index) => {
    fighter.x = -fighter.direction * 2.6;
    fighter.z = fighter.gait = fighter.velocity = 0;
    fighter.action = null;
    fighter.stance = fighter.stunnedUntil = fighter.stunStarted = fighter.counterUntil = fighter.bashReady = 0;
    fighter.lastStanceHit = -10;
    fighter.readyAt = .14 + Math.random() * .24;
    fighter.stride = .13 + (fighter.direction < 0 ? .50 : 0);
    if (generated) {
      Object.assign(fighter, generated[index]);
      Object.values(fighter.loadout).forEach(picker => { picker.value = 'auto'; });
    }
    applyGear(fighter);
    fighter.hp = fighter.maxHP;
    fighter.mp = 60;
    fighter.energy = 100;
    fighter.lastWeapon = null;
    fighter.weaponStreak = 0;
    fighter.ward = fighter.wardUntil = fighter.chilledUntil = 0;
    fighter.frozenUntil = fighter.hastedUntil = 0;
    fighter.shove = fighter.blindUntil = fighter.sandPuff = 0;
    fighter.riposte = fighter.sandUsed = fighter.sandReady = false;
    fighter.rootedUntil = fighter.burnUntil = fighter.pull = fighter.channelUntil = 0;
    fighter.special = {};
    fighter.cooldowns = {};
    fighter.reaction = fighter.ragdoll = null;
    updateStats(fighter);
    updateEnergy(fighter);
    updateStance(fighter);
    updateGearNote(fighter);
    updateSpecialHud(fighter);
  });
  elements.bout.textContent = String(bout).padStart(2, '0');
  const placeholder = document.createElement('li');
  placeholder.className = 'empty';
  placeholder.textContent = 'Waiting for the bout to begin.';
  elements.log.replaceChildren(placeholder);
  elements.result.hidden = true;
  elements.cast.hidden = true;
  updateHealth();
  updateMana();
}

function runBout() {
  state = 'running';
  logEvent('Varro and Cassian enter the arena.');
  for (const fighter of fighters) {
    const special = ownedSpecial(fighter);
    if (special) logEvent(fighter.name + ' carries ' + special.name + ': ' + special.effect.charAt(0).toLowerCase() + special.effect.slice(1) + '.');
  }
  updateControls();
}

const healColor = '#b9f08f';

function floatLabel(fighter, text, color, options) {
  ArenaEffects.label([fighter.x, 2.52, fighter.z + .3], text, color, options);
}

function burst(fighter, { offset = 0, y = 1.35, point, direction, colors, count, gravity = 5 }) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: point?.[0] ?? fighter.x + offset, y: point?.[1] ?? y, z: point?.[2] ?? fighter.z + .55,
      vx: (direction || Math.random() * 2 - 1) * (.20 + Math.random() * 2.7),
      vy: .7 + Math.random() * 2.55,
      vz: (Math.random() - .5) * 2.8,
      size: 1 + Math.random() * 3.2,
      color: colors[i % colors.length],
      life: .45 + Math.random() * .27,
      gravity
    });
  }
}

function payForSpell(action) {
  const { attacker, spell, spellKey } = action;
  attacker.mp -= spell.cost;
  attacker.cooldowns[spellKey] = elapsed + spell.cooldown;
  updateMana();
}

function applySupportSpell(fighter, spell, power) {
  let message;
  let label;
  let tag;
  let color = spell.color;
  let share;
  if (spell.heal) {
    const amount = Math.min(Math.round(spell.heal * power), fighter.maxHP - fighter.hp);
    fighter.hp += amount;
    updateHealth();
    label = '+' + amount;
    tag = 'HEALTH';
    color = healColor;
    share = amount / fighter.maxHP;
    message = 'restores ' + amount + ' HP';
  } else if (spell.absorb) {
    fighter.ward = Math.round(spell.absorb * power);
    fighter.wardUntil = elapsed + spell.duration;
    fighter.wardName = spell.name;
    fighter.wardColor = spell.color;
    label = 'WARDED';
    message = 'wards against ' + fighter.ward + ' damage';
  } else if (spell.manaRestore) {
    const amount = Math.min(spell.manaRestore, 100 - fighter.mp);
    fighter.mp += amount;
    fighter.hp -= spell.hpCost;
    updateMana();
    updateHealth();
    label = '+' + Math.round(amount) + ' MP';
    tag = '−' + spell.hpCost + ' HP';
    message = 'trades ' + spell.hpCost + ' HP for ' + Math.round(amount) + ' MP';
  } else {
    const amount = Math.min(spell.energyRestore, 100 - fighter.energy);
    fighter.energy += amount;
    fighter.hastedUntil = elapsed + spell.haste;
    updateEnergy(fighter);
    label = '+' + Math.round(amount) + ' ENERGY';
    message = 'recovers ' + Math.round(amount) + ' energy and gains haste';
  }
  floatLabel(fighter, label, color, { tag, power: share });
  logEvent(fighter.name + ' casts ' + spell.name + ' and ' + message + '.');
  burst(fighter, { colors: [spell.color, '#fff3d3'], count: 24, gravity: 2 });
}

function applySpellHit(attacker, defender, spell, damage) {
  if (spell.chill) defender.chilledUntil = elapsed + spell.chill;
  if (spell.freeze) {
    defender.frozenUntil = elapsed + spell.freeze;
    defender.freezeX = defender.x;
    defender.freezeZ = defender.z;
    logEvent(defender.name + ' is frozen in place.');
  }
  if (spell.lifesteal) {
    const healing = Math.min(Math.round(damage * spell.lifesteal), attacker.maxHP - attacker.hp);
    if (healing > 0) {
      attacker.hp += healing;
      floatLabel(attacker, '+' + healing, healColor, { tag: 'DRAINED', power: healing / attacker.maxHP });
      logEvent(attacker.name + ' drains ' + healing + ' HP.');
    }
  }
  if (spell.energyDrain) {
    const drained = Math.min(defender.energy, spell.energyDrain);
    spendEnergy(defender, drained);
    logEvent(defender.name + ' loses ' + Math.round(drained) + ' energy.');
  }
}

const stanceLimit = fighter => 59 + defense(fighter) * .23;

function updateStance(fighter) {
  const staggered = fighter.stunnedUntil > elapsed;
  const { stance, balance } = fighter.hud;
  const value = staggered ? 0 : Math.max(0, Math.round(100 * (1 - fighter.stance / stanceLimit(fighter))));
  if (stance.value !== value) stance.value = value;
  const label = staggered ? 'Staggered' : fighter.blindUntil > elapsed ? 'Blinded' : 'Stance';
  if (balance.textContent !== label) {
    balance.textContent = label;
    stance.parentElement.dataset.stunned = String(label !== 'Stance');
  }
}

function breakStance(fighter, duration) {
  fighter.stance = 0;
  fighter.stunStarted = elapsed;
  fighter.stunnedUntil = elapsed + duration;
  fighter.readyAt = fighter.stunnedUntil + .08;
  fighter.action = null;
  fighter.velocity = -fighter.direction * .55;
  // Once per bout, a staggered fighter may throw sand at an attacker who closes in.
  fighter.sandReady = !fighter.sandUsed && (forced.has('sand') || Math.random() < .5);
  updateStance(fighter);
  ArenaEffects.shake(.55);
  kickDust(fighter, 1.35, 12);
  floatLabel(fighter, 'STAGGERED', '#ffbe5c');
  logEvent(fighter.name + ' staggers and drops their guard.');
}

function applyStanceDamage(action, scale, interrupt = false) {
  const { defender } = action;
  if (defender.stunnedUntil > elapsed) return;
  const heavyWindup = defender.action?.heavy && !defender.action.connected && defender.action.phase < .73;
  defender.stance += action.stanceDamage * scale;
  defender.lastStanceHit = elapsed;
  if (defender.stance >= stanceLimit(defender) || (interrupt && heavyWindup)) {
    breakStance(defender, interrupt ? .94 : 1.21);
  }
  updateStance(defender);
}

function impact(action, contact) {
  const { attacker, defender, damage, spell, style, bash } = action;
  if (spell && !spell.damage) {
    applySupportSpell(attacker, spell, (weapons[attacker.weapon].spellPower || 1) * armorPower(attacker, 'magic'));
    return;
  }

  const special = !bash && !spell ? specialOf(attacker, action.key) : null;
  const name = bash ? 'shield bash' : spell?.name || (special ? special.name : weapons[action.key].name.toLowerCase());
  const usedName = spell || special ? name : 'the ' + name;
  if (attacker.blindUntil > elapsed && Math.random() < .45) {
    if (style === 'ranged') action.missedShot = true;
    floatLabel(defender, 'MISS', '#d8cbb8', { tag: 'BLINDED' });
    logEvent(attacker.name + ', blinded by sand, misses with ' + usedName + '.');
    special?.onMissed?.(attacker, defender, action, attacker.special);
    return;
  }
  if ((style === 'melee' && !contact) || action.missedShot) {
    floatLabel(defender, 'MISS', '#d8cbb8');
    logEvent(attacker.name + (action.crowded > .35 ? ' misses a crowded crossbow shot.' : ' misses with ' + usedName + '.'));
    special?.onMissed?.(attacker, defender, action, attacker.special);
    return;
  }
  const stopped = style === 'melee' ? contact.zone === 'shield' : isGuarding(action);
  const point = style === 'ranged' ? boltTarget(defender, stopped) : contact?.point;
  if (stopped) {
    if (style === 'ranged') {
      // The bolt now lives in the shield, so stop drawing it in flight.
      action.lodged = true;
      ArenaEffects.stick(defender.name);
    }
    spendEnergy(defender, action.guardCost);
    const perfect = action.perfect && style === 'melee';
    defender.counterUntil = elapsed + (action.heavy ? .95 : .56) + (perfect ? .35 : 0);
    defender.riposte = perfect;
    defender.reaction = { zone: 'arm', time: elapsed };
    hitPause = perfect ? .07 : .035;
    ArenaEffects.shake(action.heavy || perfect ? .45 : .22);
    floatLabel(defender, perfect ? 'PERFECT BLOCK' : 'BLOCKED', perfect ? perfectColor : '#ffe2a0', perfect ? { power: .12 } : undefined);
    ArenaEffects.strike(point || [defender.x - attacker.direction * .56, 1.55, defender.z + .55], -attacker.direction,
      spell?.color || '#ffb63f', action.heavy ? 26 : 16, action.heavy ? 1.4 : 1);
    if (action.heavy) kickDust(defender, 1.1, 8);
    logEvent(defender.name + (perfect ? ' times a perfect block against ' : ' blocks ') + attacker.name + '’s ' + name + '.');
    applyStanceDamage(action, perfect ? .3 : .54);
    if (defender.energy < 2.5 && defender.stunnedUntil <= elapsed) breakStance(defender, 1.08);
    special?.onBlocked?.(attacker, defender, action, attacker.special);
    return;
  }
  if (action.resistedSpell) {
    floatLabel(defender, 'RESISTED', spell.color);
    burst(defender, { colors: [spell.color, '#fff3d3'], count: 8 });
    logEvent(defender.name + ' resists ' + attacker.name + '’s ' + name + '.');
    return;
  }

  const zone = contact?.zone || 'body';
  const multiplier = { head: 1.24, body: 1, arm: .88, leg: .85 }[zone];
  const matchup = armors[defender.gear.armor][style];
  const absorption = style === 'magic' ? 1 : 1 - Math.max(0, defense(defender) - 45) / 275;
  const typeDefense = armors[defender.gear.armor].defenseBonus[action.attackType];
  const rolledDamage = Math.max(1, Math.round(damage * multiplier * matchup * absorption * (1 - typeDefense / 600)
    * (defender.stunnedUntil > elapsed ? 1.14 : 1)));
  const absorbed = Math.min(defender.ward, rolledDamage);
  defender.ward -= absorbed;
  const actualDamage = survivable(defender, attacker, Math.min(rolledDamage - absorbed, defender.hp));
  if (absorbed) logEvent(defender.name + '’s ' + defender.wardName + ' absorbs ' + absorbed + ' damage.');
  const blood = actualDamage > 0 && !spell && !bash;
  const color = absorbed && !actualDamage ? defender.wardColor : spell?.color || '#ffd0ba';
  if (!blood) {
    burst(defender, { point, offset: -attacker.direction * .29, direction: attacker.direction, colors: [color, '#fff3d3'], count: 22 });
  }
  const flashPoint = point || [defender.x - attacker.direction * .29, 1.35, defender.z + .55];
  // Plate throws sparks off bare steel; softer armor only flashes.
  if (blood) {
    ArenaEffects.bleed(flashPoint, attacker.direction,
      Math.min(1, actualDamage / defender.maxHP * 3.5 + (zone === 'head' ? .25 : 0) + (actualDamage >= defender.hp ? .5 : 0)));
  }
  const clang = !spell && actualDamage && armors[defender.gear.armor].style === 'melee';
  ArenaEffects.strike(flashPoint, attacker.direction, spell?.color || (clang ? '#ffb63f' : '#ffe0c2'),
    clang ? 12 : 4, action.heavy || zone === 'head' ? 1.35 : .9);
  if (action.heavy || actualDamage > defender.maxHP * .14) kickDust(defender, 1, 7);
  const tag = [zone !== 'body' && contact ? zone.toUpperCase() : '', matchup >= 1.2 ? 'ARMOR WEAKNESS' : '',
    absorbed ? absorbed + ' WARDED' : ''].filter(Boolean).join(' · ');
  if (actualDamage) {
    floatLabel(defender, '−' + actualDamage, spell?.color || (zone === 'head' ? '#ffd23f' : '#fff6ea'),
      { tag, power: actualDamage / defender.maxHP });
  } else floatLabel(defender, 'ABSORBED', color);
  defender.reaction = { zone, time: elapsed };
  hitPause = zone === 'head' ? .066 : .045;
  defender.hp -= actualDamage;
  hurt(defender, actualDamage);
  const weight = actualDamage / defender.maxHP * 2.4 + (zone === 'head' ? .15 : 0) + (action.heavy ? .1 : 0);
  ArenaEffects.shake(defender.hp <= 0 ? 1 : actualDamage ? Math.min(.85, .22 + weight) : .15);
  if (actualDamage) {
    logEvent(attacker.name + ' hits ' + defender.name + (contact ? '’s ' + zone : '') + ' with ' + usedName + ' for '
      + actualDamage + ' damage.' + (matchup >= 1.2 ? ' Armor weakness.' : ''));
    if (spell) applySpellHit(attacker, defender, spell, actualDamage);
  }
  updateHealth();
  special?.onLanded?.(attacker, defender, action, actualDamage, attacker.special);
  if (defender.hp > 0) {
    applyStanceDamage(action, (zone === 'head' ? 1.25 : 1) * (actualDamage ? 1 : .36), bash);
    if (action.riposte) {
      // The riposte drives the defender back; moveFighter checks for the arena edge.
      defender.shove = 1.6 * action.bashPower * (forced.has('wall') ? 8 : 1);
      ArenaEffects.shake(.5);
      logEvent(attacker.name + '’s riposte bash knocks ' + defender.name + ' back.');
    }
    return;
  }
  finishBout(attacker, defender, zone, blood);
}

function finishBout(attacker, defender, zone, blood) {
  defender.ragdoll = makeRagdoll(defender, zone);
  defender.ragdoll.bleeding = blood;
  attacker.wins++;
  state = 'finished';
  for (const fighter of fighters) fighter.action = null;
  elements.cast.hidden = true;
  rematchDelay = 2.5;
  elements.winner.textContent = attacker.name;
  elements.result.hidden = false;
  elements.record.textContent = fighters.map(fighter => fighter.name + ' ' + fighter.wins).join(' · ');
  logEvent(attacker.name + ' wins the bout.');
  scenery.victory();
  updateControls();
}

// Delayed special effects, run on the simulation clock and dropped when the bout ends.
const scheduled = [];
function schedule(delay, run) {
  scheduled.push({ at: elapsed + delay, run });
}

function runScheduled() {
  for (let i = 0; i < scheduled.length && state === 'running'; i++) {
    if (scheduled[i].at > elapsed) continue;
    const [{ run }] = scheduled.splice(i--, 1);
    run();
  }
}

// Damage from a special, outside the normal hit roll. It ignores blocks and wards but can end the bout.
function specialHit(attacker, defender, amount, { special, tag, message }) {
  if (state !== 'running' || defender.hp <= 0) return;
  const damage = survivable(defender, attacker, Math.min(defender.hp, Math.max(1, Math.round(amount))));
  defender.hp -= damage;
  hurt(defender, damage);
  defender.reaction = { zone: 'body', time: elapsed };
  hitPause = .06;
  floatLabel(defender, '−' + damage, special.color, { tag, power: damage / defender.maxHP });
  ArenaEffects.shake(defender.hp <= 0 ? 1 : .6);
  burst(defender, { colors: [special.color, '#ffffff'], count: 26 });
  logEvent(attacker.name + ' ' + message + ' ' + defender.name + ' with ' + special.name + ' for ' + damage + ' damage.');
  updateHealth();
  if (defender.hp <= 0) finishBout(attacker, defender, 'body', false);
  else applyStanceDamage({ defender, stanceDamage: 30 }, 1);
}

// A special may cheat death (onLethal returns true): the blow then leaves the fighter at 1 HP.
function survivable(defender, attacker, damage) {
  if (damage < defender.hp || !ownedSpecial(defender)?.onLethal?.(defender, attacker, defender.special)) return damage;
  return defender.hp - 1;
}

function hurt(fighter, damage) {
  if (damage > 0) ownedSpecial(fighter)?.onHurt?.(fighter, damage, fighter.special);
}

const fireColors = ['#ff8a3d', '#ffc15a', '#ff5a2a'];

// Burning deals 2 damage every half second until it runs out. A new ignite only extends it.
function ignite(target, source, seconds) {
  if (target.burnUntil <= elapsed) {
    target.burnTick = .5;
    floatLabel(target, 'BURNING', fireColors[0], { tag: seconds + 'S' });
    logEvent(target.name + ' catches fire.');
  }
  target.burnUntil = Math.max(target.burnUntil, elapsed + seconds);
  target.burnSource = source;
}

function burnStep(fighter, dt) {
  if (fighter.burnUntil <= elapsed || fighter.hp <= 0) return;
  if (Math.random() < dt * 14) burst(fighter, { y: .5 + Math.random() * 1.2, colors: fireColors, count: 2, gravity: -1.5 });
  if ((fighter.burnTick -= dt) > 0) return;
  fighter.burnTick = .5;
  const source = fighter.burnSource;
  const damage = survivable(fighter, source, Math.min(2, fighter.hp));
  fighter.hp -= damage;
  hurt(fighter, damage);
  floatLabel(fighter, '−' + damage, fireColors[0], { tag: 'BURN' });
  updateHealth();
  if (fighter.hp <= 0) {
    logEvent(fighter.name + ' burns down.');
    finishBout(source, fighter, 'body', false);
  }
}

function updateSpecialHud(fighter) {
  const special = ownedSpecial(fighter);
  const element = fighter.hud.special;
  element.hidden = !special;
  if (!special) return;
  const text = special.icon + ' ' + special.name + ' · ' + special.status(fighter, fighter.special);
  if (element.textContent !== text) element.textContent = text;
  element.style.setProperty('--special-color', special.color);
  element.title = special.effect;
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    particle.vy -= dt * particle.gravity;
    if (particle.life <= 0 || particle.y <= 0) particles.splice(i, 1);
  }
}

function freshMatchup() {
  return ArenaMatchups.generate(fighters, { weapons, armors, shields, spellbooks, specials, specialChance });
}

function nextBoutNumber() {
  bout++;
  scenery.nextBout();
}

function beginRematch() {
  nextBoutNumber();
  startBout();
  runBout();
}

function moveFighter(fighter, dt) {
  const rival = otherFighter(fighter);
  const gap = (rival.x - fighter.x) * fighter.direction;
  const action = fighter.action;
  const incoming = rival.action;
  const speed = mobility(fighter);
  let intent = 0;
  if (fighter.stunnedUntil > elapsed || fighter.frozenUntil > elapsed || fighter.channelUntil > elapsed) {
    intent = 0;
  } else if (action?.style === 'melee' && !action.connected) {
    intent = clamp((gap - action.reach + .07) * (action.bash ? 9 : 5.5), -.34, action.bash ? 4.5 : 4.0) * speed;
  } else if (action && !action.connected) {
    intent = gap < 3.35 ? -1.28 * speed : 0;
  } else if (incoming && !incoming.connected && incoming.evade && !action && incoming.phase > .35) {
    intent = -.93 * speed;
  } else if (action?.heavy && action.connected) {
    intent = -.24 * speed;
  } else if (canPress(fighter) && weapons[rival.weapon].style === 'ranged') {
    intent = clamp((gap - 1.83) * 1.6, -.25, 2.15) * speed;
  } else {
    intent = clamp((gap - 2.23) * .95, -.54, 1.65) * speed;
  }
  if (incoming && !incoming.connected && isGuarding(incoming)) intent *= .38;

  fighter.velocity = mix(fighter.velocity, fighter.direction * intent, 1 - Math.exp(-dt * 11));
  const previous = fighter.x;
  const minimum = fighter.direction > 0 ? -3.36 : rival.x + .86;
  const maximum = fighter.direction > 0 ? rival.x - .86 : 3.36;
  fighter.x = fighter.frozenUntil > elapsed ? fighter.freezeX : clamp(fighter.x + fighter.velocity * dt, minimum, maximum);
  if (fighter.shove > 0) shoveFighter(fighter, dt);
  if (fighter.pull > 0) {
    // A chain pull drags the fighter toward the rival.
    const step = Math.min(fighter.pull, dt * 8);
    fighter.pull -= step;
    fighter.velocity = 0;
    fighter.x = clamp(fighter.x + fighter.direction * step, minimum, maximum);
  }
  const targetZ = fighter.frozenUntil > elapsed ? fighter.freezeZ : Math.sin(elapsed * .85 + fighter.direction) * .16;
  fighter.z = mix(fighter.z, targetZ, 1 - Math.exp(-dt * 6));
  const motion = (fighter.x - previous) * fighter.direction;
  fighter.stride += motion / .96;
  fighter.gait = mix(fighter.gait, clamp(Math.abs(motion) / dt * .36, 0, 1), 1 - Math.exp(-dt * 12));
}

const arenaEdge = 3.36;

function shoveFighter(fighter, dt) {
  // Knockback slides the fighter away from the rival. Reaching the arena edge with force left is a wall stagger.
  const step = Math.min(fighter.shove, dt * 6);
  fighter.shove -= step;
  fighter.velocity = 0;
  if (fighter.frozenUntil > elapsed) {
    fighter.shove = 0;
    return;
  }
  const edge = -fighter.direction * arenaEdge;
  const next = fighter.x - fighter.direction * step;
  if ((next - edge) * fighter.direction > 0) {
    fighter.x = next;
    return;
  }
  fighter.x = edge;
  fighter.shove = 0;
  ArenaEffects.shake(.7);
  kickDust(fighter, 1.6, 16);
  if (fighter.stunnedUntil > elapsed) {
    fighter.stunnedUntil += .5;
    fighter.readyAt = fighter.stunnedUntil + .08;
    floatLabel(fighter, 'WALL SLAM', '#ffa25c');
    logEvent(fighter.name + ' slams into the arena wall.');
  } else {
    breakStance(fighter, 1.05);
    floatLabel(fighter, 'WALL SLAM', '#ffa25c');
    logEvent(fighter.name + ' slams into the arena wall and staggers.');
  }
}

function throwSand(fighter, rival) {
  fighter.sandUsed = true;
  fighter.sandReady = false;
  rival.blindUntil = elapsed + 2;
  rival.sandPuff = 0;
  const hand = worldPoint(fighter, fighterPose(fighter).joints.shieldHand);
  burst(fighter, { point: hand, direction: fighter.direction, colors: sandColors, count: 34, gravity: 2.4 });
  floatLabel(rival, 'BLINDED', sandColors[0], { tag: 'SAND IN THE EYES' });
  updateStance(rival);
  logEvent(fighter.name + ' throws sand in ' + rival.name + '’s eyes.');
}

function resolved(action) {
  if (state !== 'running' || action.bash || action.spell) return;
  specialOf(action.attacker, action.key)?.onResolved?.(action.attacker, action.defender, action, action.attacker.special);
}

function advanceAction(action, dt) {
  const { attacker, defender, style } = action;
  const previous = action.phase;
  const gap = (defender.x - attacker.x) * attacker.direction;
  action.phase += dt * action.tempo;
  if (style === 'melee' && previous <= .42 && gap > action.reach + .42 && elapsed - action.created < 1.13) {
    action.phase = Math.min(action.phase, .42);
  }
  if (action.spell && previous < .55 && action.phase >= .55) payForSpell(action);
  if (previous < .50 && action.phase >= .50) {
    if (!action.spell) spendEnergy(attacker, action.cost);
    if (action.evade && !defender.action && defender.stunnedUntil <= elapsed) spendEnergy(defender, 11);
  }
  if (!action.connected && style === 'melee' && action.phase >= .60 && previous < .99) {
    const contact = checkContact(action, previous, action.phase);
    if (contact || action.phase >= .99) {
      action.connected = true;
      impact(action, contact);
      resolved(action);
    }
  } else if (!action.connected && style !== 'melee' && previous < action.hitAt && action.phase >= action.hitAt) {
    action.connected = true;
    if (style === 'ranged') {
      action.crowded = closeRange(gap);
      action.missedShot = action.shotRoll > clamp(action.shotAccuracy - action.crowded * .45, .24, .98);
      action.damage *= 1 - action.crowded * .53;
    }
    impact(action);
    resolved(action);
  }
  if (attacker.action === action && action.phase >= action.duration) {
    attacker.action = null;
    const pause = (.08 + Math.random() * .29) * (attacker.energy < 18 ? 1.7 : 1);
    attacker.readyAt = elapsed + pause;
  }
}

function update(dt, realTime) {
  if (state === 'paused') return;
  if (hitPause > 0) {
    hitPause = Math.max(0, hitPause - dt);
    return;
  }
  updateEffects(dt);
  if (state === 'finished') {
    fall += dt;
    if (fall < 2.1) for (const fighter of fighters) {
      if (fighter.ragdoll) {
        stepRagdoll(fighter.ragdoll, dt / 2);
        stepRagdoll(fighter.ragdoll, dt / 2);
      }
    }
    if (elements.repeat.checked) rematchDelay -= realTime;
    if (rematchDelay <= 0) beginRematch();
    return;
  }
  if (state !== 'running') return;
  elapsed += dt;
  for (const fighter of fighters) {
    fighter.mp = Math.min(100, fighter.mp + dt * manaRegen);
    const recovery = energyRegen - (carriesSpare(fighter) ? .35 : 0);
    fighter.energy = Math.min(100, fighter.energy + dt * recovery);
    updateEnergy(fighter);
    if (fighter.wardUntil <= elapsed) fighter.ward = 0;
  }
  updateMana();
  runScheduled();
  if (state !== 'running') return;
  for (const fighter of fighters) {
    if (elapsed - fighter.lastStanceHit > 1.35) fighter.stance = Math.max(0, fighter.stance - dt * 13);
    updateStance(fighter);
    ownedSpecial(fighter)?.onUpdate?.(fighter, fighter.special);
    burnStep(fighter, dt);
    if (state !== 'running') return;
    updateSpecialHud(fighter);
    const rival = otherFighter(fighter);
    if (fighter.sandReady) {
      const threat = rival.action && !rival.action.connected && rival.action.style === 'melee';
      if (fighter.stunnedUntil <= elapsed) fighter.sandReady = false;
      else if (threat && elapsed - fighter.stunStarted > .2 && (rival.x - fighter.x) * fighter.direction < 2.7) throwSand(fighter, rival);
    }
    if (fighter.blindUntil > elapsed && (fighter.sandPuff -= dt) <= 0) {
      fighter.sandPuff = .22;
      burst(fighter, { point: worldPoint(fighter, fighterPose(fighter).joints.head), colors: sandColors, count: 3, gravity: 1.2 });
    }
    const own = fighter.action;
    const recoveryCounter = own?.connected && !own.heavy && !own.bash && own.phase > own.hitAt + .19;
    const idle = !own && fighter.readyAt <= elapsed;
    const gap = (rival.x - fighter.x) * fighter.direction;
    if ((idle || recoveryCounter) && fighter.stunnedUntil <= elapsed) {
      const bash = shouldBash(fighter, rival, gap);
      const underGuard = rival.action && !rival.action.connected
        && isGuarding(rival.action) && rival.action.phase > .17;
      if (bash || (idle && !underGuard)) startAction(fighter, rival, bash);
    }
  }
  fighters.forEach(fighter => moveFighter(fighter, dt));
  const active = fighters.map(fighter => fighter.action).filter(Boolean)
    .sort((a, b) => (a.hitAt - a.phase) / a.tempo - (b.hitAt - b.phase) / b.tempo);
  for (const action of active) {
    if (state === 'running' && action.attacker.action === action) advanceAction(action, dt);
  }
  if (state === 'running') showCurrentAction();
}

elements.play.addEventListener('click', () => {
  if (state === 'ready') runBout();
  else if (state === 'finished') beginRematch();
  else {
    state = state === 'running' ? 'paused' : 'running';
    updateControls();
  }
});

elements.reset.addEventListener('click', () => {
  if (state !== 'finished') return;
  nextBoutNumber();
  state = 'ready';
  startBout();
  updateControls();
});

elements.generate.addEventListener('click', () => {
  if (state === 'running' || state === 'paused') return;
  const generated = freshMatchup();
  if (state === 'finished') nextBoutNumber();
  state = 'ready';
  startBout(generated);
  updateControls();
});

elements.speed.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speeds.length;
  elements.speed.textContent = speeds[speedIndex] + '×';
  elements.speed.setAttribute('aria-label', 'Simulation speed, ' + speeds[speedIndex] + ' times');
});

// Showing gear and stats only changes the page layout, so it stays available during a fight.
const detailsToggle = document.getElementById('details');
detailsToggle.addEventListener('click', () => {
  const open = detailsToggle.getAttribute('aria-expanded') !== 'true';
  document.getElementById('scoreboard').dataset.details = open ? 'shown' : 'hidden';
  detailsToggle.setAttribute('aria-expanded', String(open));
  detailsToggle.textContent = open ? 'Hide gear, stats & spells' : 'Show gear, stats & spells';
});

elements.hitboxes.addEventListener('click', () => {
  showHitboxes = !showHitboxes;
  elements.hitboxes.setAttribute('aria-pressed', String(showHitboxes));
});

scenery = ArenaVenues.create(ctx, document.getElementById('venue'),
  ['scenery-primary', 'scenery-secondary'].map(id => document.getElementById(id)),
  document.getElementById('arena-title'), resize);
startBout();
resize();
new ResizeObserver(resize).observe(canvas);
ArenaBench.onResolutionChange(resize);
let lastFrame = performance.now();
function frame(now) {
  // Rendering is capped at 120 FPS. A skipped frame leaves lastFrame alone, so the next frame's
  // dt covers the gap and the simulation advances by the same total time.
  if (!ArenaBench.gate(now)) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = clamp((now - lastFrame) / 1000, 0, .05);
  lastFrame = now;
  const speed = speeds[speedIndex];
  sceneryClock += dt;
  if (state !== 'paused') {
    visualClock += dt;
    ArenaEffects.frame(dt);
  }
  if (dt > 0) {
    const steps = Math.max(speed, Math.ceil(dt * speed * 60));
    for (let step = 0; step < steps; step++) {
      const frozen = state === 'paused' || hitPause > 0;
      update(dt * speed / steps, dt / steps);
      if (frozen) continue;
      ArenaEffects.tick(dt * speed / steps);
      sampleTrails();
      sampleDust();
    }
  }
  const drawStart = performance.now();
  draw();
  ArenaBench.record(now, performance.now() - drawStart, state === 'paused');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
