'use strict';

const ArenaMatchups = (() => {
  const builds = {
    vanguard: { main: 'melee', backup: 'ranged', armor: 'melee', attack: 9, strength: 10, defense: 7, ranged: 3, magic: -6, health: 7 },
    duelist: { main: 'melee', backup: 'melee', armor: 'ranged', attack: 12, strength: 6, defense: 1, ranged: -3, magic: -4, health: 2 },
    spellblade: { main: 'melee', backup: 'magic', armor: 'magic', attack: 6, strength: 4, defense: 0, ranged: -6, magic: 12, health: 0 },
    marksman: { main: 'ranged', backup: 'melee', armor: 'ranged', attack: 3, strength: 1, defense: 1, ranged: 14, magic: -4, health: 1 },
    outrider: { main: 'ranged', backup: 'magic', armor: 'ranged', attack: -4, strength: -5, defense: 0, ranged: 10, magic: 9, health: -1 },
    arcanist: { main: 'magic', backup: null, armor: 'magic', attack: -8, strength: -6, defense: -2, ranged: -5, magic: 16, health: -4 },
    battlemage: { main: 'magic', backup: 'melee', armor: 'magic', attack: 2, strength: 5, defense: 3, ranged: -5, magic: 12, health: 1 }
  };

  function pick(options, random) {
    return options[Math.floor(random() * options.length)];
  }

  function style(weapon) {
    return weapon.spellPower ? 'magic' : weapon.style || 'melee';
  }

  function levels(previous, random) {
    const choices = Array.from({ length: 45 }, (_, index) => 32 + index)
      .filter(level => previous.every(fighter => fighter.level !== level));
    const first = pick(choices, random);
    const second = pick(choices.filter(level => level !== first && Math.abs(level - first) <= 9), random);
    return [first, second];
  }

  function books(previous, spellbooks, random) {
    const keys = Object.keys(spellbooks);
    const [left, right] = previous.map(fighter => fighter.gear.spellbook);
    const pairs = keys.flatMap(first => keys
      .filter(second => first !== second && first !== left && second !== right && !(first === right && second === left))
      .map(second => [first, second]));
    return pick(pairs, random);
  }

  function attributes(level, build, random) {
    const skill = (base, modifier) => Math.max(1, Math.min(99, Math.round(base + level * .50 + modifier + (random() - .5) * 16)));
    return {
      level,
      attack: skill(32, build.attack),
      strength: skill(35, build.strength),
      defense: skill(7, build.defense),
      ranged: skill(36, build.ranged),
      magic: skill(37, build.magic),
      maxHP: Math.round(82 + level * .43 + build.health + (random() - .5) * 8)
    };
  }

  function generate(previous, catalog, random = Math.random) {
    const { weapons, armors, shields, spellbooks } = catalog;
    const nextLevels = levels(previous, random);
    const nextBooks = books(previous, spellbooks, random);
    const unavailable = new Set(previous.flatMap(fighter => [fighter.gear.weapon, fighter.gear.reserve]));
    const usedArmor = new Set();
    const usedBuilds = new Set();
    const available = () => Object.keys(weapons).filter(key => !unavailable.has(key));
    const matching = (keys, requested) => keys.filter(key => style(weapons[key]) === requested);
    return previous.map((fighter, index) => {
      const eligible = Object.keys(builds).filter(key => !usedBuilds.has(key)
        && matching(available(), builds[key].main).length > 0);
      const fresh = eligible.filter(key => key !== fighter.build);
      const buildKey = pick(fresh.length ? fresh : eligible, random);
      const build = builds[buildKey];
      usedBuilds.add(buildKey);
      const weapon = pick(matching(available(), build.main), random);
      unavailable.add(weapon);
      let reserve = 'none';
      if (build.backup) {
        const pool = available();
        const preferred = matching(pool, build.backup);
        reserve = pick(preferred.length ? preferred : pool, random);
        unavailable.add(reserve);
      }

      const armor = pick(Object.keys(armors).filter(key => armors[key].style === build.armor
        && key !== fighter.gear.armor && !usedArmor.has(key)), random);
      usedArmor.add(armor);
      const shieldChoices = Object.keys(shields).filter(key => key !== fighter.gear.shield);
      const shield = pick(shieldChoices, random);
      return {
        build: buildKey,
        ...attributes(nextLevels[index], build, random),
        gear: { weapon, reserve, shield, armor, spellbook: nextBooks[index] }
      };
    });
  }

  return { generate };
})();
