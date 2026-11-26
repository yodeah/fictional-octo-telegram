'use strict';

const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const elements = Object.fromEntries(
  ['bout', 'status', 'cast', 'hitboxes', 'result', 'winner', 'play', 'reset', 'speed', 'repeat', 'log', 'record']
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
const shields = {
  buckler: { name: 'Buckler', defense: 11, mobility: 1.08, energy: 9, width: .24, height: .29, shape: 1 },
  round: { name: 'Round shield', defense: 20, mobility: 1, energy: 15, width: .34, height: .43, shape: 1 },
  tower: { name: 'Tower shield', defense: 34, mobility: .76, energy: 22, width: .40, height: .61, shape: .66 }
};
const bonusTypes = ['Stab', 'Slash', 'Crush', 'Magic', 'Ranged'];
const meleeType = { sword: 1, spear: 0, axe: 1, mace: 2, flail: 2, staff: 2, greatsword: 1, maul: 2 };
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
const gearChoices = { weapon: weapons, reserve: weapons, shield: shields, armor: armors };
const gearLabels = { weapon: 'Main', reserve: 'Backup', shield: 'Shield', armor: 'Armor' };
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
  if (automatic) detail.append(document.createTextNode('Rerolls this slot each new bout.'));
}
const spells = {
  ember: { name: 'Ember Bolt', icon: '✦', cost: 28, cooldown: 5, damage: 19, color: '#ffab64', effect: 'Fire projectile', block: .12 },
  ward: { name: 'Iron Ward', icon: '◆', cost: 32, cooldown: 10, absorb: 18, color: '#ffda84', effect: 'Absorbs up to 18 damage for 6 seconds' },
  frost: { name: 'Frost Lance', icon: '❄', cost: 30, cooldown: 5, damage: 15, color: '#a9e6ff', effect: 'Ice projectile that slows the target', block: .15 },
  heal: { name: 'Second Wind', icon: '✚', cost: 34, cooldown: 12, heal: 21, color: '#c2eca1', effect: 'Restores up to 21 HP' }
};
const manaRegen = 3.6;
const energyRegen = 5;
const fighters = [
  { name: 'Varro', gear: { weapon: 'sword', reserve: 'staff', shield: 'round', armor: 'plate' }, level: 54, attack: 69, magic: 68, defense: 25, strength: 73, ranged: 54, maxHP: 108, spells: ['ember', 'ward'], direction: 1, color: [157, 62, 42], trim: [242, 143, 96], wins: 0 },
  { name: 'Cassian', gear: { weapon: 'spear', reserve: 'crossbow', shield: 'round', armor: 'leather' }, level: 57, attack: 64, magic: 80, defense: 28, strength: 63, ranged: 76, maxHP: 100, spells: ['frost', 'heal'], direction: -1, color: [49, 102, 110], trim: [143, 208, 202], wins: 0 }
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
  for (const [key, item] of Object.entries(choices)) select.add(new Option(item.name, key));
  select.value = 'auto';
  select.describe = () => {
    const item = choices[select.value === 'auto' ? fighter.gear[type] : select.value];
    label.textContent = gearLabels[type] + (select.value === 'auto' ? ' · Auto' : '');
    automatic.text = choices[fighter.gear[type]].name + ' · Auto';
    if (type === 'armor') {
      armorDetails(detail, item, select.value === 'auto');
      return;
    }
    const lines = [item.name];
    if (type === 'weapon' || type === 'reserve') {
      lines.push('Base damage ' + item.damage + ' · Reach ' + item.range.toFixed(1),
        'Speed ' + Math.round(item.tempo * 100) + '% · ' + item.energy + ' energy per attack');
      if (item.spellPower) lines.push('+30% spell power');
      if (item.style === 'ranged') lines.push('Ranged bolts · Strong against robes', 'Reduced damage and accuracy up close');
      if (item.twoHanded) lines.push('+' + item.accuracy + ' ' + bonusTypes[meleeType[select.value === 'auto' ? fighter.gear[type] : select.value]]
        + ' attack · Uses both hands', 'Shield is stowed while wielding');
    } else if (type === 'shield') {
      lines.push('Defense +' + item.defense, 'Speed ' + Math.round(item.mobility * 100) + '% · ' + item.energy + ' energy per block');
      lines.push('Active with one-handed weapons');
    }
    if (select.value === 'auto') lines.push('Rerolls this slot each new bout.');
    detail.textContent = lines.join('\n');
  };
  select.addEventListener('change', () => {
    const other = type === 'weapon' ? fighter.loadout.reserve : type === 'reserve' ? fighter.loadout.weapon : null;
    if (other && select.value !== 'auto' && other.value === select.value) other.value = 'auto';
    if (state === 'ready') {
      applyGear(fighter);
      updateStats(fighter);
    }
    Object.values(fighter.loadout).forEach(picker => picker.describe());
    updateGearNote(fighter);
  });
  wrapper.append(label, select, detail);
  fighter.hud.loadout.append(wrapper);
  return select;
}

fighters.forEach((fighter, index) => {
  const prefix = index === 0 ? 'red-' : 'blue-';
  fighter.hud = Object.fromEntries(['hp', 'meter', 'mp', 'mana', 'ep', 'energy', 'stats', 'loadout', 'queued', 'spells', 'level', 'active']
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
  fighter.spellBadges = Object.fromEntries(fighter.spells.map(key => {
    const spell = spells[key];
    const badge = document.createElement('div');
    badge.className = 'spell';
    badge.style.setProperty('--spell-color', spell.color);
    badge.title = spell.effect + ' · ' + spell.cost + ' MP';
    const icon = document.createElement('i');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = spell.icon;
    const cost = document.createElement('small');
    cost.textContent = spell.cost;
    badge.append(icon, spell.name, cost);
    fighter.hud.spells.append(badge);
    return [key, badge];
  }));
});
const particles = [];
const labels = [];
const stains = [];
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
let phase = 0;
let rematchDelay = 0;
let exchange;
let lastAttacker;
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
const shieldReady = fighter => !weapons[fighter.weapon].twoHanded;
const mobility = fighter => (shieldReady(fighter) ? shields[fighter.gear.shield].mobility : 1) * armors[fighter.gear.armor].mobility;
const defense = fighter => fighter.defense + (shieldReady(fighter) ? shields[fighter.gear.shield].defense : 0) + armors[fighter.gear.armor].defense;
const attackType = (style, key) => style === 'magic' ? 3 : style === 'ranged' ? 4 : meleeType[key];

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
const canPress = fighter => [fighter.gear.weapon, fighter.gear.reserve].some(key => weaponClass(key) === 'melee');

function applyGear(fighter, reroll = false) {
  const previous = fighter.gear;
  const gear = {};
  const { weapon, reserve } = fighter.loadout;
  const assign = (type, excluded, differentStyle) => {
    const picker = fighter.loadout[type];
    if (picker.value !== 'auto' && picker.value !== excluded) return picker.value;
    if (!reroll && previous[type] !== excluded) return previous[type];
    const available = Object.keys(gearChoices[type]).filter(key => key !== excluded && key !== previous[type]);
    if (differentStyle && excluded) {
      const alternatives = available.filter(key => weaponClass(key) !== weaponClass(excluded));
      if (alternatives.length) return choose(alternatives);
    }
    return choose(available);
  };
  gear.weapon = assign('weapon', reserve.value === 'auto' ? null : reserve.value, true);
  gear.reserve = assign('reserve', gear.weapon, true);
  gear.shield = assign('shield');
  gear.armor = assign('armor');
  fighter.gear = gear;
  fighter.weapon = gear.weapon;
  Object.values(fighter.loadout).forEach(picker => picker.describe());
}

function rollLevels(fighter) {
  const level = 33 + Math.floor(Math.random() * 40);
  fighter.level = level === fighter.level ? level + 1 : level;
  const roll = base => clamp(Math.round(base + fighter.level * .56 + (Math.random() - .5) * 31), 1, 99);
  fighter.attack = roll(32);
  fighter.strength = roll(35);
  fighter.magic = roll(38);
  fighter.ranged = roll(36);
  fighter.defense = roll(0);
  fighter.maxHP = 78 + Math.round(fighter.level * .44 + Math.random() * 12);
}

function updateStats(fighter) {
  const meleeBonus = weapons[fighter.weapon].accuracy || 0;
  const stats = { Attack: fighter.attack + meleeBonus, Defense: defense(fighter), Strength: fighter.strength,
    Ranged: fighter.ranged, Magic: fighter.magic, Health: fighter.maxHP };
  for (const [name, value] of Object.entries(stats)) fighter.stats[name].textContent = value;
  fighter.hud.level.textContent = 'Lv ' + fighter.level;
  const stowed = fighter.weapon === fighter.gear.weapon ? fighter.gear.reserve : fighter.gear.weapon;
  fighter.hud.active.textContent = weapons[fighter.weapon].name + ' held · ' + weapons[stowed].name + ' stowed'
    + (shieldReady(fighter) ? '' : ' · Shield on back');
  const power = (weapons[fighter.weapon].spellPower || 1) * armorPower(fighter, 'magic');
  for (const key of fighter.spells) {
    const spell = spells[key];
    let effect = spell.effect;
    if (spell.heal) effect = 'Restores up to ' + Math.round(spell.heal * power) + ' HP';
    if (spell.absorb) effect = 'Absorbs up to ' + Math.round(spell.absorb * power) + ' damage for 6 seconds';
    if (spell.damage) effect += ' · ' + Math.round(spell.damage * power * (.76 + fighter.magic / 300)) + ' damage before armor';
    fighter.spellBadges[key].title = effect + ' · ' + spell.cost + ' MP';
  }
}

function updateGearNote(fighter) {
  fighter.hud.queued.hidden = Object.entries(fighter.loadout)
    .every(([type, picker]) => picker.value === 'auto' || picker.value === fighter.gear[type]);
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

function surface(points, color, light, transform) {
  const projected = points.map(point => project(transform(point)));
  const depth = projected.reduce((sum, point) => sum + point[2], 0) / projected.length;
  const fill = 'rgb(' + color.map(channel => clamp(Math.round(channel * light), 0, 255)).join(',') + ')';
  faces.push({ projected, depth, fill });
}

function prism(from, to, base, tip, color, transform, sides = 4, roll = Math.PI / 4) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const perpendicular = [(to[1] - from[1]) / length, (from[0] - to[0]) / length];
  function ring(point, radii) {
    return Array.from({ length: sides }, (_, i) => {
      const angle = i * 2 * Math.PI / sides + roll;
      const radial = Math.cos(angle) * radii[0];
      return [point[0] + perpendicular[0] * radial, point[1] + perpendicular[1] * radial, point[2] + Math.sin(angle) * radii[1]];
    });
  }
  const a = ring(from, base);
  const b = ring(to, tip);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    if (a[i][2] + a[j][2] < from[2] * 2 - .001) continue;
    const light = .91 + .24 * Math.cos((i + .5) * 2 * Math.PI / sides + roll);
    surface([a[i], a[j], b[j], b[i]], color, light, transform);
  }
  surface(b, color, 1.19, transform);
}

function shield(cx, cy, z, fighter, transform) {
  const gear = shields[fighter.gear.shield];
  const contour = value => Math.sign(value) * Math.pow(Math.abs(value), gear.shape);
  const ring = (radius, depth) => Array.from({ length: 8 }, (_, i) => {
    const angle = (i + .5) * Math.PI / 4;
    return [cx + contour(Math.cos(angle)) * radius * gear.width, cy + contour(Math.sin(angle)) * radius * gear.height, depth];
  });
  const rim = ring(1, z);
  const panel = ring(.81, z + .035);
  const boss = ring(.27, z + .12);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    surface([rim[i], rim[j], panel[j], panel[i]], armor, i < 4 ? 1.36 : .75, transform);
    surface([panel[i], panel[j], boss[j], boss[i]], fighter.color, .85 + i * .07, transform);
    const [rx, ry] = panel[i];
    const rivet = [mix(cx, rx, 1.08), mix(cy, ry, 1.08), z + .05];
    surface([[rivet[0], rivet[1] + .034, rivet[2]], [rivet[0] + .024, rivet[1], rivet[2]],
      [rivet[0], rivet[1] - .034, rivet[2]], [rivet[0] - .024, rivet[1], rivet[2]]], metal, 1.06, transform);
  }
  surface(boss, bronze, 1, transform);
  surface(ring(.16, z + .143), metal, 1.12, transform);
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

function flailChain(anchor, windup, strike, clock, fraction) {
  const angle = -1.48 + Math.sin(clock * 7) * .13 * (1 - strike) - windup * 2.8 + strike * 1.50;
  return shifted(anchor, Math.cos(angle) * .48 * fraction,
    Math.sin(angle) * .48 * fraction - .14 * (1 - strike) * Math.sin(Math.PI * fraction));
}

function weaponModel(fighter, hand, angle, windup, strike, clock, limb, transform, key = fighter.weapon) {
  const along = weaponAxis(hand, angle);
  if (key === 'greatsword') {
    limb(along(-.53), along(.23), [.073, .077], [.066, .065], leather, 8);
    limb(along(-.62), along(-.49), [.086, .079], [.107, .092], bronze, 8);
    limb(along(.205, -.32), along(.205, .32), [.057, .079], [.057, .079], darkSteel, 8);
    limb(along(.21), along(1.29), [.185, .065], [.143, .052], metal, 6);
    limb(along(1.29), along(1.63), [.143, .052], [0, 0], metal, 6);
    const ridge = (distance, offset, depth) => shifted(along(distance, offset), 0, 0, depth);
    surface([ridge(.30, -.026, .058), ridge(.30, .026, .058), ridge(1.42, 0, .047)], darkSteel, 1.05, transform);
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
  const flail = key === 'flail';
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
  const chainPoint = fraction => flailChain(along(tip), windup, strike, clock, fraction);
  const ball = chainPoint(1);
  for (let i = 0; i < 5; i++) {
    const link = chainPoint(i / 5);
    limb(link, chainPoint((i + 1) / 5), [.043, .04], [.043, .04], i % 2 ? armor : metal, 6);
  }
  const [bx, by, bz] = ball;
  limb([bx, by - .15, bz], ball, [.075, .075], [.17, .17], armor, 6);
  limb(ball, [bx, by + .15, bz], [.17, .17], [.075, .075], metal, 6);
  for (let i = 0; i < 5; i++) {
    const theta = (i + .5) * Math.PI * 2 / 5;
    const dx = Math.cos(theta), dy = Math.sin(theta);
    surface([[bx + dx * .13 - dy * .05, by + dy * .13 + dx * .05, bz + .10],
      [bx + dx * .24, by + dy * .24, bz + .10],
      [bx + dx * .13 + dy * .05, by + dy * .13 - dx * .05, bz + .10]], metal, .98, transform);
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

function fighterPose(fighter, at = phase) {
  const active = state !== 'ready';
  const attacking = active && exchange.attacker === fighter;
  const defending = active && exchange.defender === fighter;
  const swinging = attacking && exchange.style === 'melee';
  const shooting = attacking && exchange.style === 'ranged';
  const swingAt = active ? exchange.hitAt : .78;
  const release = smooth((at - .48) / (swingAt - .48));
  const windup = swinging ? smooth((at - .11) / .37) * (1 - release) : 0;
  const strike = swinging ? release * (1 - smooth((at - swingAt - .045) / .46)) : 0;
  const casting = attacking && exchange.spell ? ease((at - .25) / .32) * (1 - ease((at - 1.01) / .43)) : 0;
  const aiming = shooting ? ease((at - .15) / .33) * (1 - ease((at - .99) / .40)) : 0;
  const shotRecoil = shooting ? ease((at - .55) / .09) * (1 - ease((at - .66) / .30)) : 0;
  const swapping = attacking && exchange.switched ? Math.sin(Math.PI * clamp(at / .30, 0, 1)) : 0;
  const guard = defending && exchange.block
    ? ease((at - swingAt + .34) / .25) * (1 - ease((at - swingAt - .09) / .31))
    : 0;
  const reactionAge = elapsed - (fighter.reaction?.time ?? -10);
  const recoil = ease(reactionAge / .11) * (1 - ease((reactionAge - .14) / .35));
  const zone = fighter.reaction?.zone;
  const gait = active ? fighter.gait : 0;
  const stride = fighter.stride * 2 * Math.PI;
  const sway = Math.sin(stride) * gait;
  const weightShift = Math.cos(stride * 2) * gait;
  const breath = Math.sin(visualClock * 3 + fighter.direction) * .025;
  const drop = guard * .085 + strike * .065 + weightShift * .021 - casting * .08 + (zone === 'leg' ? recoil * .16 : 0);
  const evasion = defending && exchange.evade ? ease((at - .40) / .29) * (1 - ease((at - .92) / .43)) : 0;
  const lean = strike * .23 - windup * .17 + casting * .13 - recoil * .25 + guard * .08 - evasion * .18 + aiming * .09;
  const twist = sway * .11 - windup * .12 + strike * .18 + guard * .05;
  const hips = [-.10 + sway * .045, 1.095 + breath - drop, weightShift * .024];
  const chest = [-.11 + lean + sway * .075, 1.72 + breath - drop, twist * .26];
  const head = shifted(chest, -.015 + strike * .055 - recoil * (zone === 'head' ? .27 : .09) - sway * .025,
    .33 - (zone === 'head' ? recoil * .055 : 0), -twist * .16);
  const joints = { hips, chest, head };
  for (const side of ['rear', 'front']) {
    const sign = side === 'front' ? 1 : -1;
    const step = stepFoot(fighter.stride, sign < 0 ? .50 : 0);
    const plant = sign * (guard * .13 + strike * .20 + casting * .08);
    joints[side + 'Hip'] = shifted(hips, sign * .077, -.016, sign * .165);
    joints[side + 'Ankle'] = [sign * .355 + step.x * gait + plant, .157 + step.y * gait, sign * .22];
    joints[side + 'Knee'] = bendJoint(joints[side + 'Hip'], joints[side + 'Ankle'], .515, .505, 1);
    const pitch = step.pitch * gait;
    joints[side + 'Toe'] = shifted(joints[side + 'Ankle'], .19 * Math.cos(pitch), -.07 + .19 * Math.sin(pitch), .016);
  }

  const weapon = weapons[fighter.weapon];
  const aim = swinging ? exchange.aim * strike : 0;
  joints.weaponShoulder = shifted(chest, .02 - windup * .06 + twist * .35, .04, -.30);
  const channeling = fighter.weapon === 'staff' ? casting * .54 : -casting * .47;
  joints.weaponHand = [.32 + channeling + strike * weapon.extension - windup * .47 - recoil * .12 + sway * .11
    + aiming * .43 - shotRecoil * .10 - swapping * .36,
    1.43 - drop + windup * weapon.lift + aim * .22 + sway * .07 + aiming * .17 - swapping * .14, -.30 + strike * .31 + aiming * .20];
  joints.weaponElbow = bendJoint(joints.weaponShoulder, joints.weaponHand, .51, .53, -1);

  joints.shieldShoulder = shifted(chest, -.02 - twist * .35, -.025, .30);
  joints.shieldHand = [.36 + guard * .30 + casting * .12 - recoil * (zone === 'arm' ? .31 : .09) - sway * .11,
    1.39 - drop + guard * .25 - recoil * .16 + casting * .16, .48];
  const aimScale = fighter.weapon === 'spear' ? .44 : .65;
  const castAngle = fighter.weapon === 'staff' ? -.79 : 1.19;
  const angle = weapon.rest + casting * castAngle + windup * weapon.draw - strike * weapon.swing
    + aim * aimScale + sway * .08 - aiming * .16 + shotRecoil * .09 + swapping * .35;
  if (weapon.twoHanded) {
    const grip = weaponAxis(joints.weaponHand, angle)(-.32);
    joints.shieldHand = shifted(grip, 0, 0, .08);
  }
  joints.shieldElbow = bendJoint(joints.shieldShoulder, joints.shieldHand, .43, .47, -1);
  const pose = { joints, angle, windup, strike: strike + shotRecoil,
    shieldTilt: guard * .16 - recoil * .27 - sway * .10, twist, cloth: -sway * .08 - lean * .31 + recoil * .065 };
  const previous = active && exchange.entryPoses.get(fighter);
  if (previous && at < .22) {
    const blend = smooth(at / .22);
    for (const name of Object.keys(joints)) joints[name] = pointBetween(previous.joints[name], joints[name], blend);
    for (const key of ['angle', 'shieldTilt', 'twist', 'cloth']) pose[key] = mix(previous[key], pose[key], blend);
  }
  return pose;
}

const bronze = [172, 128, 76];
const darkSteel = [72, 72, 65];
const clothLining = [64, 48, 75];
const soleColor = [49, 36, 29];

function loft(rings, color, transform, sides = 10) {
  const vertices = rings.map(([y, width, depth]) => Array.from({ length: sides }, (_, index) => {
    const angle = Math.PI * index * 2 / sides;
    return [Math.cos(angle) * width, y, Math.sin(angle) * depth];
  }));
  for (let row = 1; row < vertices.length; row++) {
    for (let i = 0; i < sides / 2; i++) {
      const a = vertices[row - 1];
      const b = vertices[row];
      const angle = (i + .5) * Math.PI * 2 / sides;
      const light = .74 + Math.sin(angle) * .24 + Math.cos(angle - .30) * .16;
      surface([a[i], a[i + 1], b[i + 1], b[i]], color, light, transform);
    }
  }
}

function armorTorso(fighter, pose, transform) {
  const kit = armors[fighter.gear.armor];
  const piece = (a, b, r1, r2, color, sides) => prism(a, b, r1, r2, color, transform, sides);
  const panel = (points, color, light = 1) => surface(points, color, light, transform);
  const stud = (x, y, z, color = bronze) =>
    panel([[x - .020, y, z], [x, y + .025, z], [x + .022, y, z], [x, y - .024, z]], color, 1.14);
  const skirt = pose.cloth;
  const beltColor = kit.style === 'magic' ? fighter.color : leather;

  loft([[-.10, .285, .30], [.13, .32, .34], [.43, .41, .38], [.57, .38, .34], [.64, .23, .25]], kit.color, transform);

  if (kit.style === 'melee') {
    loft([[.14, .327, .35], [.23, .348, .37], [.44, .40, .386], [.57, .38, .35]], metal, transform);
    panel([[-.35, .55, .232], [-.24, .59, .32], [0, .38, .404], [.25, .58, .32],
      [.35, .52, .23], [0, .29, .413]], darkSteel, 1.02);
    panel([[-.30, .54, .282], [0, .34, .420], [.30, .54, .282], [.29, .49, .30],
      [0, .28, .425], [-.28, .49, .305]], bronze, 1.16);
    panel([[0, .50, .406], [.087, .422, .418], [0, .34, .423], [-.087, .422, .418]], fighter.trim, 1);
    for (const side of [-1, 1]) {
      const x = side * .20;
      panel([[x - .035, .51, .361], [x + .018, .554, .345], [x + .048, .521, .357],
        [x + .031, .483, .373], [x - .019, .456, .385]], metal, 1.20);
      for (const y of [.435, .528, .589]) stud(side * (.285 - (y - .45) * .28), y, .319, bronze);
      piece([side * .175, .019, .31], [side * .235 + skirt * .5, -.207, .33], [.108, .075], [.091, .052], darkSteel, 8);
      piece([side * .203 + skirt * .5, -.105, .38], [side * .232 + skirt * .5, -.244, .356],
        [.090, .036], [.072, .028], armor, 8);
      stud(side * .228 + skirt * .5, -.15, .409, bronze);
    }
    for (const y of [.03, .115, .20]) {
      loft([[y - .07, .33, .34], [y, .355, .368], [y + .035, .31, .339]], armor, transform);
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
      [.31, .45, .28], [.14, .16, .38], [-.15, .12, .38]], [132, 88, 56], 1.03);
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
          [x + .011, y - .053, z + .008], [x - .047, y - .028, z + .004]], [130, 82, 52], .88 + (column + 1) * .10);
        panel([[x - .057, y + .025, z + .006], [x + .042, y + .025, z + .006],
          [x + .042, y + .011, z + .007], [x - .05, y + .011, z + .007]], [201, 149, 88], .94);
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
    panel([[-.20 + skirt, -.505, .315], hem(-.17), hem(.10), [.24 + skirt, -.49, .31],
      [.21 + skirt, -.444, .316], [.08 + skirt, -.53, .316], [-.16 + skirt, -.54, .316]], bronze, 1.1);
    panel([[-.30, .54, .30], [-.12, .63, .35], [.03, .40, .43], [.21, .61, .36],
      [.31, .51, .30], [.03, .27, .432]], fighter.color, 1.13);
    panel([[-.24, .55, .326], [.03, .335, .442], [.25, .54, .334], [.235, .49, .348],
      [.03, .30, .445], [-.21, .51, .36]], bronze, 1.11);
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
}

function armorHelmet(fighter, kit, transform) {
  const piece = (a, b, r1, r2, color, sides) => prism(a, b, r1, r2, color, transform, sides);
  const panel = (points, color, light = 1) => surface(points, color, light, transform);
  const face = fighter.direction > 0 ? [191, 128, 86] : [165, 111, 77];
  if (kit.style === 'magic') {
    loft([[-.15, .225, .227], [.05, .278, .26], [.21, .265, .218], [.315, .128, .135], [.38, .02, .03]], kit.color, transform);
    panel([[-.02, -.12, .234], [.17, -.13, .23], [.25, .012, .205], [.17, .16, .235], [.015, .14, .268]], clothLining, .75);
    panel([[.035, -.11, .247], [.16, -.105, .25], [.226, -.027, .225], [.175, .095, .261], [.061, .106, .275]], face);
    piece([.052, .138, .271], [.22, .087, .246], [.024, .029], [.026, .025], bronze, 6);
    panel([[-.20, .07, .217], [-.077, .22, .223], [.146, .235, .179], [.182, .182, .21],
      [-.057, .193, .248], [-.169, .047, .247]], kit.color, 1.41);
  } else if (kit.style === 'ranged') {
    loft([[-.15, .185, .20], [-.09, .228, .235], [.12, .238, .24], [.233, .205, .21]], face, transform);
    loft([[.095, .234, .249], [.171, .266, .255], [.291, .18, .189], [.322, .08, .09]], leather, transform);
    piece([-.235, .14, .19], [.246, .157, .182], [.028, .087], [.024, .057], fighter.trim, 8);
    panel([[-.23, .176, .177], [-.135, .174, .254], [-.109, -.118, .249], [-.21, -.15, .203]], [118, 87, 57], 1.1);
    piece([.208, .139, .235], [.212, -.036, .233], [.025, .039], [.029, .028], bronze, 6);
    for (const x of [-.19, -.115, -.033, .052]) {
      panel([[x - .012, .169, .257], [x + .009, .194, .26], [x + .03, .166, .259],
        [x + .009, .146, .261]], bronze, 1.2);
    }
  } else {
    loft([[-.155, .216, .222], [-.035, .241, .254], [.13, .272, .264], [.255, .205, .234], [.31, .105, .135]], metal, transform);
    panel([[-.165, .053, .217], [.09, .077, .287], [.245, .039, .237],
      [.212, -.039, .249], [.042, -.063, .292], [-.132, -.036, .239]], [47, 40, 34], .9);
    panel([[-.155, .083, .23], [.095, .108, .292], [.25, .065, .245], [.238, .036, .253],
      [.090, .073, .30], [-.152, .05, .245]], bronze, 1.19);
    panel([[-.206, .04, .21], [-.106, .015, .274], [-.047, -.138, .27],
      [-.133, -.194, .221], [-.22, -.108, .194]], armor, 1.14);
    piece([-.10, .248, .075], [-.12, .314, .062], [.230, .13], [.18, .09], darkSteel, 8);
    piece([-.11, .298, .065], [-.19, .426, .055], [.22, .112], [.13, .059], fighter.color, 8);
    piece([-.19, .396, .06], [-.31, .397, .03], [.12, .092], [.055, .065], fighter.trim, 6);
    for (const x of [.055, .109, .161]) {
      panel([[x - .018, -.063, .288], [x - .003, -.064, .29], [x + .004, -.119, .274],
        [x - .014, -.119, .273]], darkSteel, .82);
    }
    piece([-.11, .234, .208], [.118, .209, .215], [.014, .035], [.015, .031], bronze, 6);
  }
  if (kit.style !== 'melee') {
    panel([[.092, .063, .282], [.176, .060, .27], [.169, .027, .273], [.100, .028, .288]], [54, 40, 33], .98);
    panel([[.108, .051, .294], [.141, .049, .294], [.136, .037, .296], [.111, .037, .296]], [222, 188, 151], 1);
    panel([[.176, .054, .287], [.227, .009, .257], [.173, -.012, .278]], face, 1.20);
    panel([[.128, -.063, .283], [.188, -.055, .268], [.174, -.077, .273], [.131, -.078, .281]], face, .65);
  } else {
    panel([[.094, .034, .304], [.154, .031, .29], [.151, .012, .292], [.097, .013, .306]], face, .81);
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
        [.136, .099], [.118, .08], armor, 8);
      limb(shifted(knee, -.066, .076, .087), shifted(knee, .028, -.083, .085), [.129, .095], [.085, .085], metal, 8);
    }
    limb(shifted(pointBetween(knee, ankle, .13), 0, 0, .062), shifted(pointBetween(ankle, knee, .08), 0, 0, .064),
      [.109, .102], [.090, .080], plated ? metal : robed ? leather : kit.color, 8);
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
  const long = spare === 'staff' || spare === 'spear' || spare === 'crossbow' || weapons[spare].twoHanded;
  const mount = torso(long ? [-.43, .39, -.51] : [-.39, .03, -.43]);
  const scaleStowed = long ? .80 : .69;
  const stow = point => pointBetween(mount, point, scaleStowed);
  const holder = (a, b, r1, r2, color, sides) => limb(stow(a), stow(b), r1.map(r => r * scaleStowed), r2.map(r => r * scaleStowed), color, sides);
  weaponModel(fighter, mount, torsoAngle + (long ? 2.0 : -2.34), 0, 0, 0, holder, point => world(stow(point)), spare);

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
    const shoulderShell = plated ? metal : robed ? fighter.color : kit.color;
    limb(shifted(shoulder, 0, 0, .046), shifted(pointBetween(shoulder, elbow, .42), 0, 0, .062),
      [.18, .144], [plated ? .177 : .122, .11], shoulderShell, 8);
    if (plated) {
      limb(shifted(pointBetween(shoulder, elbow, .25), 0, 0, .078), shifted(pointBetween(shoulder, elbow, .58), 0, 0, .071),
        [.163, .12], [.132, .097], armor, 8);
      limb(shifted(elbow, 0, .059, .051), shifted(elbow, 0, -.046, .062), [.102, .078], [.07, .065], metal, 8);
    }
    limb(shifted(pointBetween(elbow, hand, .38), 0, 0, .04), shifted(pointBetween(elbow, hand, .85), 0, 0, .039),
      [.105, .105], [.086, .086], plated ? armor : robed ? fighter.color : leather, 8);
    limb(pointBetween(elbow, hand, .83), pointBetween(elbow, hand, .91), [.092, .097], [.092, .097], bronze, 8);
    limb(pointBetween(elbow, hand, .90), pointBetween(elbow, hand, 1.14), [.082, .091], [.067, .075], robed ? skin : leather, 8);
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
}

function worldPoint(fighter, [x, y, z]) {
  return [fighter.x + fighter.direction * x, y, fighter.z + z];
}

function weaponClock() {
  return state === 'ready' ? visualClock : elapsed + fall;
}

function weaponSegments(fighter, pose) {
  const along = weaponAxis(pose.joints.weaponHand, pose.angle);
  switch (fighter.weapon) {
    case 'sword': return [[along(.23), along(1.13), .105]];
    case 'spear': return [[along(1.24), along(1.79), .11]];
    case 'axe': return [[along(.66, .25), along(.66, .44), .19]];
    case 'mace': return [[along(.67), along(.99), .19]];
    case 'staff': return [[along(.78), along(1.47), .11]];
    case 'greatsword': return [[along(.24), along(1.63), .15]];
    case 'maul': return [[along(.87, -.32), along(.87, .32), .24]];
    case 'flail': {
      const ball = flailChain(along(.61), pose.windup, pose.strike, weaponClock(), 1);
      return [[ball, ball, .22]];
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

function checkContact(attacker, defender, previous, current) {
  const source = weaponSegments(attacker, fighterPose(attacker));
  const zones = bodyZones(defender, fighterPose(defender), exchange.block).map(([zone, from, to, radius]) =>
    [zone, worldPoint(defender, from), worldPoint(defender, to), radius]);
  const prior = exchange.weaponSweep || source.map(([start, end]) => [worldPoint(attacker, start), worldPoint(attacker, end)]);
  exchange.weaponSweep = source.map(([start, end]) => [worldPoint(attacker, start), worldPoint(attacker, end)]);

  let contact;
  // Sample the swept blade between frames as well as along its length.
  for (let t = 1; t <= 4; t++) {
    const framePhase = mix(previous, current, t / 4);
    if (framePhase < .68 || framePhase > .99) continue;
    for (const [index, [, , thickness]] of source.entries()) {
      const [oldStart, oldEnd] = prior[index];
      const [newStart, newEnd] = exchange.weaponSweep[index];
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
  const pose = fighterPose(fighter);
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
  if (state !== 'ready' && exchange.attacker === fighter && exchange.style === 'melee' && !fighter.ragdoll) {
    zones.push(...weaponSegments(fighter, pose).map(([a, b, radius]) => ['#ff857ab8', a, b, radius]));
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
      magicGlow(x, y, radius, spells.ward.color);
      ctx.beginPath();
      ctx.ellipse(x, y, radius * .65, radius * 1.24, .08 * fighter.direction, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffdb818c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (fighter.chilledUntil > elapsed) {
      const [x, y] = project([fighter.x, .23, fighter.z]);
      ellipse(x, y, scale * .52, scale * .13, '#b4e2f27a');
    }
  }
  if (state === 'ready' || !exchange.spell || phase < .30 || phase > 1.10) return;
  const { attacker, defender, spell, spellKey, hitAt } = exchange;
  const pose = fighterPose(attacker);
  const staffTip = weaponAxis(pose.joints.weaponHand, pose.angle)(1.40);
  const start = attacker.weapon === 'staff' ? project(worldPoint(attacker, staffTip))
    : project([attacker.x + attacker.direction * .67, 1.64, attacker.z + .59]);
  const end = spell.damage ? project([defender.x - attacker.direction * .31, 1.40, defender.z + .52]) : start;
  const progress = clamp((phase - .55) / (hitAt - .55), 0, 1);
  const x = mix(start[0], end[0], progress);
  const y = mix(start[1], end[1], progress) - Math.sin(progress * Math.PI) * 13;
  const charge = ease((phase - .30) / .25);
  ctx.globalAlpha = phase > hitAt ? 1 - ease((phase - hitAt) / .16) : charge;
  const radius = Math.max(12, scale * .30);
  magicGlow(x, y, radius * 2.15, spell.color);
  if (spellKey === 'ember' || spellKey === 'frost') {
    const d = attacker.direction;
    const tail = radius * (progress > 0 ? 2.1 : .7);
    if (spellKey === 'frost') {
      polygon([[x + radius * .75 * d, y], [x - radius * .22 * d, y - radius * .31], [x - tail * d, y + 3], [x - radius * .18 * d, y + radius * .29]], spell.color);
    } else {
      ellipse(x - tail * d * .42, y + 2, tail * .70, radius * .32, '#f4763acc');
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

function drawBolt() {
  if (state === 'ready' || exchange.style !== 'ranged' || phase > 1.02) return;
  const { attacker, defender, missedShot, block, hitAt } = exchange;
  const pose = fighterPose(attacker);
  const tip = weaponAxis(pose.joints.weaponHand, pose.angle)(.79, .05);
  const from = worldPoint(attacker, tip);
  const target = shifted(boltTarget(defender, block), missedShot ? attacker.direction * .8 : 0, missedShot ? .48 : 0);
  const travel = clamp((phase - .55) / (hitAt - .55), 0, 1.16);
  const point = pointBetween(from, target, travel);
  const [x, y] = project(point);
  const tail = project(shifted(point, -attacker.direction * .33, -.015));
  ctx.strokeStyle = travel > 0 ? '#fae3ac' : '#cdb592';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...tail.slice(0, 2));
  ctx.lineTo(x, y);
  ctx.stroke();
  ellipse(x, y, 2.6, 1.5, '#ebe3c7');
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  scale = Math.min(width / 8.3, height / 4.35);
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

function draw() {
  ctx.drawImage(backdrop, 0, 0, width, height);
  scenery.draw(width, height, sceneryClock);
  for (const stain of stains) {
    const [x, y] = project([stain.x, 0, stain.z]);
    ellipse(x, y, scale * stain.size, scale * stain.size * .31, '#69302bb5');
  }
  const poses = fighters.map(fighter => fighter.ragdoll?.pose || fighterPose(fighter));
  fighters.forEach((fighter, index) => {
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
    drawGladiator(fighter, pose);
  });
  faces.sort((a, b) => a.depth - b.depth);
  faces.forEach(face => polygon(face.projected, face.fill));
  faces.length = 0;
  if (showHitboxes) fighters.forEach((fighter, index) => drawHitboxes(fighter, poses[index]));
  drawMagic();
  drawBolt();
  for (const particle of particles) {
    const [x, y] = project([particle.x, particle.y, particle.z]);
    ellipse(x, y, particle.size, particle.size * .82, particle.color);
  }
  for (const label of labels) {
    const [x, y] = project([label.x, label.y + label.age * .53, label.z + .3]);
    ctx.globalAlpha = clamp((label.life - label.age) * 3, 0, 1);
    ctx.font = '800 ' + (label.small ? 16 : 25) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#302017';
    ctx.strokeText(label.text, x, y);
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, x, y);
  }
  ctx.globalAlpha = 1;
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

function chooseSpell(fighter) {
  const [offensive, support] = fighter.spells;
  const needsSupport = support === 'ward' ? fighter.hp <= fighter.maxHP * .84 && !fighter.ward : fighter.hp <= fighter.maxHP * .75;
  if (needsSupport && canCast(fighter, support)) return support;
  if (elapsed > 1.8 && canCast(fighter, offensive)) return offensive;
  return null;
}

function pickAction(attacker, defender) {
  const keys = [attacker.gear.weapon, attacker.gear.reserve];
  const targetArmor = armors[defender.gear.armor];
  const distance = Math.abs(attacker.x - defender.x);
  const crowding = closeRange(distance);
  const opposingCrossbow = defender.weapon === 'crossbow';
  const availableSpell = chooseSpell(attacker);
  const spell = spells[availableSpell];
  if (opposingCrossbow && keys.includes('sword') && attacker.energy >= 12 && distance > 1.95 && !spell?.heal && !spell?.absorb) {
    return { key: 'sword', style: 'melee' };
  }
  const candidates = [];
  for (const key of keys) {
    const weapon = weapons[key];
    const style = weapon.style || 'melee';
    const stamina = clamp(attacker.energy / weapon.energy, 0, 1);
    const level = style === 'ranged' ? attacker.ranged : (attacker.attack + attacker.strength) / 2;
    const reach = style === 'ranged'
      ? (.95 + Math.min(distance, 4.7) * .075) * mix(1, .27, crowding)
      : 1 - Math.max(0, distance - weapon.range) * (opposingCrossbow ? .038 : .095);
    const repeat = key === attacker.lastWeapon ? Math.pow(.88, Math.min(attacker.weaponStreak, 4)) : 1;
    const pressure = opposingCrossbow && style === 'melee' ? (key === 'sword' ? 1.50 : 1.24) : 1;
    const score = (weapon.damage + 3) * targetArmor[style] * (.69 + level / 205)
      * weapon.tempo * mix(.68, 1, stamina) * reach * repeat * armorPower(attacker, style) * pressure
      * (1 + accuracyBonus(attacker, defender, style, key) / 250);
    candidates.push({ key, style, score });
    if (spell && (weapon.spellPower || (key === attacker.weapon && (spell.heal || spell.absorb || Math.random() < .48)))) {
      const boost = weapon.spellPower || 1;
      const spellScore = spell.damage ? spell.damage * targetArmor.magic * boost * (.69 + attacker.magic / 210)
        * .88 * repeat * armorPower(attacker, 'magic') * (1 + accuracyBonus(attacker, defender, 'magic', key) / 250) : 100 * boost;
      candidates.push({ key, style: 'magic', spellKey: availableSpell, score: spellScore });
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
  elements.reset.disabled = state === 'ready';
  fighters.forEach(updateGearNote);
}

function nextExchange() {
  const entryPoses = new Map(elapsed > 0 ? fighters.map(fighter => [fighter, fighterPose(fighter)]) : []);
  const preferred = elapsed === 0 ? fighters[1] : fighters.find(fighter => fighter !== lastAttacker);
  const attacker = Math.random() < .78 ? preferred : fighters.find(fighter => fighter !== preferred);
  const defender = fighters.find(fighter => fighter !== attacker);
  const { key, style, spellKey } = pickAction(attacker, defender);
  const previousWeapon = attacker.weapon;
  const switched = previousWeapon !== key;
  attacker.weapon = key;
  attacker.weaponStreak = key === attacker.lastWeapon ? attacker.weaponStreak + 1 : 1;
  attacker.lastWeapon = key;
  const weapon = weapons[key];
  const spell = spells[spellKey];
  const ranged = style === 'ranged';
  const initialGap = Math.abs(attacker.x - defender.x);
  const press = ranged && canPress(defender);
  const castingRetreat = !!spell && (initialGap < 3.45 || previousWeapon === 'crossbow');
  const guard = shields[defender.gear.shield];
  const fatigue = spell ? 1 : clamp(attacker.energy / weapon.energy, 0, 1);
  const blockChance = (spell ? spell.block || 0 : weapon.block) + clamp((defense(defender) - 56) / (spell ? 350 : 150), -.10, .20);
  const block = shieldReady(defender) && (!spell || spell.damage) && defender.energy >= guard.energy && Math.random() < Math.max(.025, blockChance);
  const equipmentAccuracy = accuracyBonus(attacker, defender, style, key);
  const baseEvasion = style === 'ranged' ? .18 - attacker.ranged / 1000 : .22 - attacker.attack / 850;
  const evasionChance = clamp(baseEvasion - equipmentAccuracy / 520, .03, .35) * mobility(defender);
  const evade = !spell && !block && defender.energy >= 11 && Math.random() < evasionChance;
  const aimRoll = Math.random();
  const aim = aimRoll < .22 ? -.96 : aimRoll > .70 ? .93 : .08;
  let distance = weapon.range - .23 - Math.abs(aim) * .26;
  if (spell) {
    distance = castingRetreat ? clamp(initialGap + .93 * mobility(attacker), 2.44, 3.88) : spell.damage ? 3.75 : 3.35;
  } else if (ranged) {
    distance = clamp(initialGap + .84 * mobility(attacker) - (press ? 1.42 * mobility(defender) : .23), 1.62, weapon.range);
  }
  const crowded = ranged ? closeRange(distance) : 0;
  const shift = castingRetreat ? -.49 : ranged ? -.44 : .20 + Math.random() * .23;
  const center = clamp((attacker.x + defender.x) / 2 + attacker.direction * shift, -.83, .83);
  const depth = (Math.random() - .5) * .58;
  lastAttacker = attacker;
  phase = 0;
  elements.cast.hidden = !spell && !ranged;
  if (spell) {
    elements.cast.textContent = attacker.name + ' · ' + spell.name;
    elements.cast.style.setProperty('--spell-color', spell.color);
  } else if (ranged) {
    elements.cast.textContent = attacker.name + (crowded > .35 ? ' · Crowded shot' : ' · Crossbow');
    elements.cast.style.setProperty('--spell-color', '#e5cf8e');
  }
  if (switched) {
    updateStats(attacker);
    logEvent(attacker.name + ' switches to ' + weapon.name + '.');
  }
  const attackSkill = ranged ? attacker.ranged : attacker.strength;
  const damage = spell ? (spell.damage || 0) * (weapon.spellPower || 1) * (.76 + attacker.magic / 300)
    : (weapon.damage + Math.floor(Math.random() * 7)) * (.73 + attackSkill / 245) * mix(.67, 1, fatigue);
  exchange = {
    attacker, defender, entryPoses,
    block, evade, spell, spellKey, aim, style, switched, crowded, damage: damage * armorPower(attacker, style) * (1 - crowded * .53),
    missedShot: ranged && (evade || Math.random() > clamp(.75 + attacker.ranged / 390 + equipmentAccuracy / 430 - crowded * .45, .24, .98)),
    resistedSpell: spell?.damage && Math.random() > clamp(.95 + equipmentAccuracy / 410, .72, .99),
    attackType: attackType(style, key),
    tempo: (spell ? .88 : weapon.tempo) * mobility(attacker) * mix(.68, 1, fatigue) * (attacker.chilledUntil > elapsed ? .76 : 1),
    hitAt: spell || ranged ? .94 : .78,
    duration: (spell || ranged ? 1.60 : 1.45) + (switched ? .12 : 0),
    positions: fighters.map(fighter => {
      const isAttacker = fighter === attacker;
      const position = center - fighter.direction * distance / 2;
      const speed = mobility(fighter);
      const hit = !isAttacker && evade ? position - fighter.direction * .62 * speed : position;
      return {
        start: fighter.x,
        startZ: fighter.z,
        brace: position - fighter.direction * (isAttacker ? (spell || ranged ? .16 : .37) : -.09),
        hit,
        retreat: hit - fighter.direction * (isAttacker && (ranged || castingRetreat) ? .50 : isAttacker ? .27 : press ? -.16 : .47) * speed,
        depth: depth + (isAttacker ? -.07 : .07)
      };
    })
  };
}

function startBout(reroll = false) {
  elapsed = 0;
  fall = 0;
  hitPause = 0;
  particles.length = labels.length = stains.length = 0;
  fighters.forEach(fighter => {
    fighter.x = -fighter.direction * 2.6;
    fighter.z = fighter.gait = 0;
    fighter.stride = .13 + (fighter.direction < 0 ? .50 : 0);
    if (reroll) rollLevels(fighter);
    applyGear(fighter, reroll);
    fighter.hp = fighter.maxHP;
    fighter.mp = 60;
    fighter.energy = 100;
    fighter.lastWeapon = null;
    fighter.weaponStreak = 0;
    fighter.ward = fighter.wardUntil = fighter.chilledUntil = 0;
    fighter.cooldowns = {};
    fighter.reaction = fighter.ragdoll = null;
    updateStats(fighter);
    updateEnergy(fighter);
    updateGearNote(fighter);
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
  nextExchange();
  logEvent('Varro and Cassian enter the arena.');
  updateControls();
}

function floatLabel(fighter, text, color, small = false) {
  labels.push({ x: fighter.x, z: fighter.z, y: 2.64, age: 0, life: 1.08, text, color, small });
}

function burst(fighter, { offset = 0, y = 1.35, point, direction, colors, count, blood = false, gravity = 5 }) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: point?.[0] ?? fighter.x + offset, y: point?.[1] ?? y, z: point?.[2] ?? fighter.z + .55,
      vx: (direction || Math.random() * 2 - 1) * (.20 + Math.random() * 2.7),
      vy: .7 + Math.random() * 2.55,
      vz: (Math.random() - .5) * 2.8,
      size: 1 + Math.random() * 3.2,
      color: colors[i % colors.length],
      life: blood ? .83 : .45 + Math.random() * .27,
      blood, gravity
    });
  }
}

function payForSpell() {
  const { attacker, spell, spellKey } = exchange;
  attacker.mp -= spell.cost;
  attacker.cooldowns[spellKey] = elapsed + spell.cooldown;
  updateMana();
}

function impact(contact) {
  const { attacker, defender, block, damage, spell, spellKey, style } = exchange;
  const spellBoost = (weapons[attacker.weapon].spellPower || 1) * armorPower(attacker, 'magic');
  if (spell?.heal || spell?.absorb) {
    if (spell.heal) {
      const amount = Math.min(Math.round(spell.heal * spellBoost), attacker.maxHP - attacker.hp);
      attacker.hp += amount;
      updateHealth();
      floatLabel(attacker, '+' + amount + ' HP', spell.color);
      logEvent(attacker.name + ' casts ' + spell.name + ' and restores ' + amount + ' HP.');
    } else {
      attacker.ward = Math.round(spell.absorb * spellBoost);
      attacker.wardUntil = elapsed + 6;
      floatLabel(attacker, 'WARDED', spell.color, true);
      logEvent(attacker.name + ' casts ' + spell.name + ', absorbing up to ' + attacker.ward + ' damage.');
    }
    burst(attacker, { colors: [spell.color, '#fff3d3'], count: 24, gravity: 2 });
    return;
  }

  const action = spell ? spell.name : attacker.weapon;
  if ((style === 'melee' && !contact) || exchange.missedShot) {
    floatLabel(defender, 'MISS', '#e1cfb3', true);
    logEvent(attacker.name + (exchange.crowded > .35 ? ' misses a crowded crossbow shot.' : ' misses with the ' + action + '.'));
    return;
  }
  const stopped = style === 'melee' ? contact.zone === 'shield' : block;
  const point = style === 'ranged' ? boltTarget(defender, stopped) : contact?.point;
  if (stopped) {
    spendEnergy(defender, shields[defender.gear.shield].energy);
    defender.reaction = { zone: 'arm', time: elapsed };
    hitPause = .035;
    floatLabel(defender, 'BLOCKED', '#ffe2a0', true);
    burst(defender, { point, offset: -attacker.direction * .56, y: 1.55, direction: -attacker.direction, colors: ['#ffe3a1', spell?.color || '#fff6dd'], count: 13, gravity: 9 });
    logEvent(defender.name + ' blocks ' + attacker.name + '’s ' + action + '.');
    return;
  }
  if (exchange.resistedSpell) {
    floatLabel(defender, 'RESISTED', spell.color, true);
    burst(defender, { colors: [spell.color, '#fff3d3'], count: 8 });
    logEvent(defender.name + ' resists ' + attacker.name + '’s ' + action + '.');
    return;
  }

  const zone = contact?.zone || 'body';
  const multiplier = { head: 1.24, body: 1, arm: .88, leg: .85 }[zone];
  const matchup = armors[defender.gear.armor][style];
  const absorption = style === 'magic' ? 1 : 1 - Math.max(0, defense(defender) - 45) / 275;
  const typeDefense = armors[defender.gear.armor].defenseBonus[exchange.attackType];
  const rolledDamage = Math.max(1, Math.round(damage * multiplier * matchup * absorption * (1 - typeDefense / 600)));
  const absorbed = Math.min(defender.ward, rolledDamage);
  defender.ward -= absorbed;
  const actualDamage = Math.min(rolledDamage - absorbed, defender.hp);
  if (absorbed) logEvent(defender.name + '’s Iron Ward absorbs ' + absorbed + ' damage.');
  if (spellKey === 'frost' && actualDamage) defender.chilledUntil = elapsed + 3.5;
  const blood = actualDamage > 0 && !spell;
  const color = absorbed && !actualDamage ? spells.ward.color : spell?.color || '#ffd0ba';
  burst(defender, {
    point,
    offset: -attacker.direction * .29,
    direction: attacker.direction,
    colors: blood ? ['#9f302a', '#ca4835'] : [color, '#fff3d3'],
    count: 22,
    blood,
    gravity: blood ? 12 : 5
  });
  const hitText = zone !== 'body' && contact ? ' · ' + zone.toUpperCase() : matchup >= 1.2 ? ' · EDGE' : '';
  floatLabel(defender, actualDamage ? '−' + actualDamage + hitText : 'ABSORBED', color, !actualDamage || !!hitText);
  defender.reaction = { zone, time: elapsed };
  hitPause = zone === 'head' ? .066 : .045;
  defender.hp -= actualDamage;
  updateHealth();
  if (actualDamage) {
    const weaponName = spell ? spell.name : 'the ' + weapons[action].name.toLowerCase();
    logEvent(attacker.name + ' hits ' + defender.name + (contact ? '’s ' + zone : '') + ' with ' + weaponName + ' for '
      + actualDamage + ' damage.' + (matchup >= 1.2 ? ' Armor weakness.' : ''));
    if (spellKey === 'frost') logEvent(defender.name + ' is chilled.');
  }
  if (defender.hp > 0) return;
  defender.ragdoll = makeRagdoll(defender, zone);
  attacker.wins++;
  state = 'finished';
  rematchDelay = 2.5;
  elements.winner.textContent = attacker.name;
  elements.result.hidden = false;
  elements.record.textContent = fighters.map(fighter => fighter.name + ' ' + fighter.wins).join(' · ');
  logEvent(attacker.name + ' wins the bout.');
  scenery.victory();
  updateControls();
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    particle.vy -= dt * particle.gravity;
    if (particle.y <= 0 && particle.blood) {
      stains.push({ x: particle.x, z: particle.z, size: .025 + Math.random() * .055 });
    }
    if (particle.life <= 0 || particle.y <= 0) particles.splice(i, 1);
  }
  for (let i = labels.length - 1; i >= 0; i--) {
    labels[i].age += dt;
    if (labels[i].age >= labels[i].life) labels.splice(i, 1);
  }
}

function beginRematch() {
  bout++;
  scenery.nextBout();
  startBout(true);
  runBout();
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
    phase += dt * exchange.tempo;
    if (phase > 1.14) elements.cast.hidden = true;
    if (elements.repeat.checked) rematchDelay -= realTime;
    if (rematchDelay <= 0) beginRematch();
    return;
  }
  if (state !== 'running') return;
  elapsed += dt;
  for (const fighter of fighters) {
    fighter.mp = Math.min(100, fighter.mp + dt * manaRegen);
    fighter.energy = Math.min(100, fighter.energy + dt * energyRegen);
    updateEnergy(fighter);
    if (fighter.wardUntil <= elapsed) fighter.ward = 0;
  }
  updateMana();
  const previousPhase = phase;
  phase += dt * exchange.tempo;
  fighters.forEach((fighter, index) => {
    const { start, startZ, brace, hit, retreat, depth } = exchange.positions[index];
    const approach = smooth(phase * mobility(fighter) / .47);
    const lunge = ease((phase - .52) / (exchange.hitAt - .52));
    const recover = smooth((phase - exchange.hitAt - .14) / .47);
    const x = mix(mix(mix(start, brace, approach), hit, lunge), retreat, recover);
    const z = mix(startZ, depth, approach);
    const movement = Math.hypot(x - fighter.x, z - fighter.z);
    fighter.stride += (x - fighter.x) * fighter.direction / .96;
    const speed = movement / dt;
    fighter.gait = mix(fighter.gait, clamp(speed * .31, 0, 1), 1 - Math.exp(-dt * 12));
    fighter.x = x;
    fighter.z = z;
  });
  if (exchange.spell && previousPhase < .55 && phase >= .55) payForSpell();
  if (previousPhase < .50 && phase >= .50) {
    if (!exchange.spell) spendEnergy(exchange.attacker, weapons[exchange.attacker.weapon].energy);
    if (exchange.evade) spendEnergy(exchange.defender, 11);
  }
  if (exchange.style !== 'melee') {
    if (previousPhase < exchange.hitAt && phase >= exchange.hitAt) impact();
  } else if (!exchange.connected && phase >= .60 && previousPhase < .99) {
    const contact = checkContact(exchange.attacker, exchange.defender, previousPhase, phase);
    if (contact || phase >= .99) {
      exchange.connected = true;
      impact(contact);
    }
  }
  if (state === 'running' && phase >= exchange.duration) nextExchange();
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
  const reroll = state === 'finished';
  if (reroll) {
    bout++;
    scenery.nextBout();
  }
  state = 'ready';
  startBout(reroll);
  updateControls();
});

elements.speed.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speeds.length;
  elements.speed.textContent = speeds[speedIndex] + '×';
  elements.speed.setAttribute('aria-label', 'Simulation speed, ' + speeds[speedIndex] + ' times');
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
let lastFrame = performance.now();
function frame(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, .05);
  lastFrame = now;
  const speed = speeds[speedIndex];
  sceneryClock += dt;
  if (state !== 'paused') visualClock += dt;
  if (dt > 0) {
    const steps = Math.max(speed, Math.ceil(dt * speed * 60));
    for (let step = 0; step < steps; step++) update(dt * speed / steps, dt / steps);
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
