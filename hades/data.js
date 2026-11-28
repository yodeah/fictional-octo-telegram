// Gear, spells and fighter kits for the 2.5D arena. Weapon damage, energy costs, armor matchups and
// spells came from the old side-view battler; reach and timing are tuned for a two-dimensional floor.
// Loads in the browser and in Node (tools/hades-balance.js).
(function (root) {
  // shape: arc (sweep), thrust (narrow lunge), slam (circle where the weapon lands), bolt (projectile).
  const weapons = {
    sword: { name: 'Sword', style: 'melee', shape: 'arc', reach: 2.0, spread: 1.15, damage: 13, energy: 14, windup: .30, recover: .34, stance: 29, block: .25 },
    spear: { name: 'Spear', style: 'melee', shape: 'thrust', reach: 2.8, spread: .42, damage: 14, energy: 14, windup: .31, recover: .38, stance: 27, block: .30 },
    axe: { name: 'Axe', style: 'melee', shape: 'arc', reach: 1.85, spread: 1.05, damage: 19, energy: 18, windup: .40, recover: .44, stance: 36, block: .31, breaks: true },
    maul: { name: 'War maul', style: 'melee', shape: 'slam', reach: 1.8, radius: 1.55, damage: 31, energy: 26, windup: .66, recover: .62, stance: 52, block: .30, breaks: true, heavy: true, twoHanded: true },
    greatsword: { name: 'Greatsword', style: 'melee', shape: 'arc', reach: 2.45, spread: 1.55, damage: 26, energy: 23, windup: .54, recover: .54, stance: 46, block: .25, heavy: true, twoHanded: true },
    mace: { name: 'Mace', style: 'melee', shape: 'arc', reach: 1.8, spread: 1.1, damage: 15, energy: 17, windup: .35, recover: .40, stance: 40, block: .25, breaks: true },
    crossbow: { name: 'Crossbow', style: 'ranged', shape: 'bolt', reach: 9.5, speed: 17, damage: 23, energy: 11, windup: .54, recover: .48, stance: 22, push: .8, hinder: .8, block: .30 },
    bow: { name: 'Repeating bow', style: 'ranged', shape: 'bolt', reach: 8.5, speed: 15, damage: 12, energy: 8, windup: .32, recover: .32, stance: 12, hinder: .35, block: .30 },
    // The two champions' own gear.
    gladius: { name: 'Gladius', style: 'melee', shape: 'arc', reach: 1.9, spread: 1.1, damage: 13, energy: 14, windup: .29, recover: .32, stance: 30, block: .25 },
    pilum: { name: 'Pilum', style: 'ranged', shape: 'bolt', reach: 8, speed: 16, damage: 21, energy: 13, windup: .5, recover: .5, stance: 26, push: 1, hinder: .6, block: .30 },
    recurve: { name: 'Composite bow', style: 'ranged', shape: 'bolt', reach: 9, speed: 18, damage: 18, energy: 9, windup: .38, recover: .34, stance: 14, hinder: .4, block: .30 },
    sica: { name: 'Sica', style: 'melee', shape: 'arc', reach: 1.8, spread: 1.25, damage: 12, energy: 11, windup: .23, recover: .29, stance: 24, block: .22 },
    staff: { name: 'Staff', style: 'magic', shape: 'bolt', reach: 8, speed: 11, damage: 8, energy: 6, windup: .42, recover: .42, stance: 10, block: .10, spellPower: 1.3 }
  };

  const shields = {
    none: { name: 'No shield', defense: 0, mobility: 1, energy: 0, durability: 0, block: 0 },
    buckler: { name: 'Buckler', defense: 11, mobility: 1.05, energy: 9, durability: 2, block: .02, radius: .27 },
    round: { name: 'Round shield', defense: 20, mobility: .97, energy: 13, durability: 3, block: .10, radius: .38 },
    scutum: { name: 'Scutum', defense: 21, mobility: .93, energy: 15, durability: 3, block: .08, radius: .42 },
    tower: { name: 'Tower shield', defense: 34, mobility: .86, energy: 19, durability: 4, block: .20, radius: .46 }
  };

  // The triangle is damage taken, by the attacker's style. Gentler than in the 2D battler, because
  // distance already favors one side in most pairings.
  const armors = {
    plate: { name: 'Plate', style: 'melee', power: 1.06, defense: 12, mobility: .95, taken: { melee: .98, ranged: .88, magic: 1.1 } },
    leather: { name: 'Leather', style: 'ranged', power: 1.09, defense: 7, mobility: 1.04, taken: { melee: 1.07, ranged: .98, magic: .9 } },
    robes: { name: 'Robes', style: 'magic', power: 1.12, defense: 3, mobility: 1.02, taken: { melee: 1.05, ranged: 1.08, magic: .98 } }
  };

  const spells = {
    ember: { name: 'Ember Bolt', cost: 22, cooldown: 3.2, damage: 24, speed: 13, color: '#ffab64' },
    ward: { name: 'Iron Ward', cost: 27, cooldown: 17, absorb: 18, duration: 5, color: '#ffda84' },
    heal: { name: 'Second Wind', cost: 31, cooldown: 20, heal: 18, color: '#c2eca1' },
    drain: { name: 'Crimson Drain', cost: 20, cooldown: 3.5, damage: 14, speed: 12, lifesteal: .5, color: '#ff6f86' },
    surge: { name: 'Scarlet Surge', cost: 36, cooldown: 7.5, damage: 25, speed: 10, lifesteal: .27, color: '#ff9784' },
    pact: { name: 'Blood Pact', cost: 5, cooldown: 11, hpCost: 9, manaRestore: 28, color: '#e98baf' },
    frost: { name: 'Frost Lance', cost: 20, cooldown: 3.4, damage: 15, speed: 13, chill: 2.6, color: '#a9e6ff' },
    barrage: { name: 'Winter Barrage', cost: 36, cooldown: 10, damage: 21, speed: 11, freeze: 1.5, color: '#d9f4ff' },
    shell: { name: 'Glacial Shell', cost: 22, cooldown: 11, absorb: 15, duration: 4, color: '#b5ebf5' },
    arc: { name: 'Arc Flash', cost: 18, cooldown: 3, damage: 18, speed: 19, energyDrain: 14, color: '#d3c6ff' },
    thunder: { name: 'Thunderclap', cost: 38, cooldown: 8.5, damage: 36, speed: 15, color: '#edd8ff' },
    tailwind: { name: 'Tailwind', cost: 23, cooldown: 11, energyRestore: 30, haste: 4.5, color: '#cce8a0' },
    spark: { name: 'Staff Spark', cost: 0, cooldown: 0, damage: 8, speed: 11, color: '#d1b7ff' }
  };

  // The quick movement each style gets. Melee closes distance, archers roll away, mages blink.
  const moves = {
    dash: { name: 'Dash', charges: 2, recharge: 3.2, distance: 3.3, time: .17, energy: 12, safe: .17 },
    roll: { name: 'Roll', charges: 2, recharge: 4.2, distance: 3.4, time: .28, energy: 15, safe: .22 },
    blink: { name: 'Blink', charges: 2, recharge: 5.6, distance: 4.2, time: .16, energy: 10, safe: .16 }
  };

  // Every fighter carries a main weapon and a backup, and switches as the distance changes.
  const switchCost = 7;

  // The two champions are fixed characters with their own painted sprites (champion: true) and are
  // the default matchup: Varro the murmillo against Cassian the archer.
  const kits = {
    murmillo: { name: 'Murmillo', weapon: 'gladius', reserve: 'pilum', shield: 'scutum', armor: 'leather', move: 'dash', speed: 3.9, hp: 245, champion: true },
    sagittarius: { name: 'Sagittarius', weapon: 'recurve', reserve: 'sica', shield: 'none', armor: 'leather', move: 'roll', speed: 3.75, hp: 248, champion: true },
    duelist: { name: 'Duelist', weapon: 'sword', reserve: 'crossbow', shield: 'round', armor: 'leather', move: 'dash', speed: 4.0, hp: 245 },
    hoplite: { name: 'Hoplite', weapon: 'spear', reserve: 'sword', shield: 'tower', armor: 'plate', move: 'dash', speed: 3.85, hp: 245 },
    raider: { name: 'Raider', weapon: 'axe', reserve: 'bow', shield: 'buckler', armor: 'leather', move: 'dash', speed: 4.15, hp: 245 },
    breaker: { name: 'Breaker', weapon: 'maul', reserve: 'sword', shield: 'none', armor: 'plate', move: 'dash', speed: 3.9, hp: 285 },
    executioner: { name: 'Executioner', weapon: 'greatsword', reserve: 'crossbow', shield: 'none', armor: 'plate', move: 'dash', speed: 3.9, hp: 275 },
    marksman: { name: 'Marksman', weapon: 'crossbow', reserve: 'sword', shield: 'none', armor: 'leather', move: 'roll', speed: 3.5, hp: 235 },
    huntress: { name: 'Skirmisher', weapon: 'bow', reserve: 'spear', shield: 'buckler', armor: 'leather', move: 'roll', speed: 3.65, hp: 230 },
    frostmage: { name: 'Cryomancer', weapon: 'staff', reserve: 'sword', shield: 'none', armor: 'robes', move: 'blink', speed: 3.4, hp: 232, spells: ['frost', 'barrage', 'shell'] },
    stormmage: { name: 'Stormcaller', weapon: 'staff', reserve: 'spear', shield: 'none', armor: 'robes', move: 'blink', speed: 3.4, hp: 232, spells: ['arc', 'thunder', 'tailwind'] },
    bloodmage: { name: 'Sanguinist', weapon: 'staff', reserve: 'axe', shield: 'none', armor: 'robes', move: 'blink', speed: 3.4, hp: 232, spells: ['drain', 'surge', 'pact'] },
    emberpriest: { name: 'Ember Priest', weapon: 'staff', reserve: 'mace', shield: 'none', armor: 'robes', move: 'blink', speed: 3.4, hp: 232, spells: ['ember', 'ward', 'heal'] }
  };

  const arena = {
    a: 10.2, b: 6.9, // half width and half depth of the elliptical floor
    pillars: [
      { x: -4.4, y: -2.6, r: .78 }, { x: 4.4, y: -2.6, r: .78 },
      { x: -4.4, y: 2.8, r: .78 }, { x: 4.4, y: 2.8, r: .78 }
    ]
  };

  const data = { switchCost, weapons, shields, armors, spells, moves, kits, arena };
  if (typeof module !== 'undefined') module.exports = data;
  else root.HadesData = data;
})(this);
