'use strict';

// Run state, economy and opponents. No DOM and no engine calls, so tests can load it in Node.
// Fight configs use the engine's weapon, armor, shield, spell and special keys.
const Rules = (() => {
  const races = {
    human: { name: 'Human', stats: { cha: 1 }, training: 1.35, price: 1, lifesteal: 0, text: 'Learns 35% more from every drill.', flaw: 'No gift in a fight.' },
    elf: { name: 'Elf', stats: { agi: 3, mind: 2, end: -2 }, training: 1, price: 1, lifesteal: 0, text: 'Quick hands (+3 Agility) and stronger spells (+2 Mind).', flaw: 'Frail: −2 Endurance.' },
    demon: { name: 'Demon', stats: { str: 2, cha: -3 }, training: 1, price: 1.2, lifesteal: .1, text: 'Heals 10% of melee damage dealt, +2 Strength.', flaw: 'Feared: merchants charge 20% more.' }
  };
  const statNames = { str: 'Strength', agi: 'Agility', end: 'Endurance', mind: 'Mind', cha: 'Charm' };
  const drills = {
    power: { name: 'Lift stones', text: 'Strength: harder hits, faster heavy swings.', gain: 6 },
    skill: { name: 'Weapon forms', text: 'Weapon skill: better aim, more melee and ranged damage.', gain: 6 },
    guard: { name: 'Shield work', text: 'Defense: less damage, better blocks.', gain: 3 },
    toughness: { name: 'Run the beach', text: 'More health.', gain: 16 }
  };
  // Wounds are named for the part that took the most punishment. Each cuts one thing until it heals or is treated.
  const wounds = {
    head: { name: 'Cracked skull', text: '−10% weapon skill, melee and ranged' },
    body: { name: 'Broken ribs', text: '−10% health' },
    arm: { name: 'Torn arm', text: '−10% strength' },
    leg: { name: 'Gashed leg', text: '−10% speed' }
  };
  const woundDays = 4;
  const woundBelow = .2;
  const tacticKeys = ['balanced', 'aggressive', 'defensive'];
  const aimKeys = ['any', 'head', 'body', 'arm', 'leg'];
  const triggerKeys = ['auto', 'ready', 'hurt', 'finish', 'tired'];
  const catalog = {
    club: { slot: 'weapon', price: 20, act: 0 },
    sword: { slot: 'weapon', price: 60, act: 0 },
    spear: { slot: 'weapon', price: 55, act: 0 },
    axe: { slot: 'weapon', price: 70, act: 0 },
    mace: { slot: 'weapon', price: 70, act: 0 },
    flail: { slot: 'weapon', price: 85, act: 1 },
    rapier: { slot: 'weapon', price: 100, act: 1 },
    falchion: { slot: 'weapon', price: 120, act: 1 },
    crossbow: { slot: 'weapon', price: 110, act: 1 },
    trident: { slot: 'weapon', price: 140, act: 1 },
    beardedAxe: { slot: 'weapon', price: 170, act: 2 },
    morningstar: { slot: 'weapon', price: 170, act: 2 },
    greatsword: { slot: 'weapon', price: 210, act: 2 },
    maul: { slot: 'weapon', price: 210, act: 2 },
    halberd: { slot: 'weapon', price: 230, act: 2 },
    claymore: { slot: 'weapon', price: 260, act: 3 },
    arbalest: { slot: 'weapon', price: 260, act: 3 },
    buckler: { slot: 'shield', price: 30, act: 0 },
    round: { slot: 'shield', price: 60, act: 0 },
    tower: { slot: 'shield', price: 140, act: 1 },
    leather: { slot: 'armor', price: 45, act: 0 },
    bronze: { slot: 'armor', price: 85, act: 0 },
    scout: { slot: 'armor', price: 110, act: 1 },
    plate: { slot: 'armor', price: 150, act: 1 },
    robes: { slot: 'armor', price: 90, act: 1 },
    brigandine: { slot: 'armor', price: 200, act: 2 },
    fortress: { slot: 'armor', price: 280, act: 2 },
    nightHide: { slot: 'armor', price: 220, act: 2 }
  };
  // Champion trophies: special weapons that cannot be bought.
  const trophies = { earthshaker: 'maul', leechFang: 'rapier', jailersChain: 'flail', headsmansVerdict: 'executioner' };
  const champions = [
    { name: 'Gorrak the Mauler', title: 'Champion of the Docks', trophy: 'earthshaker', color: [92, 112, 66], trim: [168, 190, 110], hint: 'Slow and heavy. He wears only leather.',
      habits: 'Swings for the arm and head.',
      config: { level: 10, strength: 55, attack: 50, ranged: 30, magic: 30, defense: 11, maxHP: 222, gear: { weapon: 'maul', reserve: 'none', shield: 'none', armor: 'leather', special: 'earthshaker' } } },
    { name: 'Vell the Leech', title: 'Champion of the Salt Market', trophy: 'leechFang', color: [140, 40, 62], trim: [232, 130, 150], hint: 'Fast, and heals with every cut. Missing costs her blood.',
      habits: 'Quick cuts at the head and body. A long bout favours her.',
      config: { level: 20, strength: 46, attack: 52, ranged: 40, magic: 30, defense: 13, maxHP: 190, gear: { weapon: 'rapier', reserve: 'none', shield: 'buckler', armor: 'scout', special: 'leechFang' } } },
    { name: 'The Iron Widow', title: 'Champion of the Old Ruins', trophy: 'jailersChain', color: [66, 60, 84], trim: [178, 170, 206], hint: 'Walks behind plate and a tower shield. Axes and maces break shields.',
      habits: 'Hammers the arm, then the ribs and legs.',
      config: { level: 30, strength: 66, attack: 66, ranged: 40, magic: 40, defense: 25, maxHP: 285, gear: { weapon: 'flail', reserve: 'none', shield: 'tower', armor: 'plate', special: 'jailersChain' } } },
    { name: 'Aurek the Undefeated', title: 'Champion of Champions', trophy: 'headsmansVerdict', color: [160, 120, 40], trim: [250, 214, 110], hint: 'Black iron and lightning. His blade executes the badly wounded.',
      habits: 'Nearly every blow goes for the head. Casts Arc Flash.',
      config: { level: 40, strength: 66, attack: 64, ranged: 50, magic: 60, defense: 22, maxHP: 270, gear: { weapon: 'executioner', reserve: 'none', shield: 'none', armor: 'fortress', special: 'headsmansVerdict' }, spellList: ['arc'] } }
  ];
  const renownNeeded = [4, 6, 6, 8];
  const spellPool = ['ember', 'ward', 'heal', 'drain', 'frost', 'arc', 'shell', 'tailwind', 'surge', 'thunder', 'barrage', 'pact'];
  const opponentGear = [
    { weapon: ['club', 'spear', 'sword', 'axe'], armor: ['rags', 'rags', 'leather'], shield: ['none', 'none', 'buckler'] },
    { weapon: ['sword', 'spear', 'axe', 'mace', 'flail', 'rapier', 'falchion', 'crossbow'], armor: ['leather', 'bronze', 'scout'], shield: ['buckler', 'round', 'none'] },
    { weapon: ['trident', 'morningstar', 'greatsword', 'maul', 'beardedAxe', 'falchion', 'crossbow', 'halberd'], armor: ['bronze', 'plate', 'brigandine', 'robes'], shield: ['round', 'tower', 'buckler'] },
    { weapon: ['claymore', 'halberd', 'maul', 'greatsword', 'morningstar', 'arbalest', 'beardedAxe', 'trident'], armor: ['plate', 'brigandine', 'fortress', 'nightHide'], shield: ['round', 'tower', 'buckler'] }
  ];
  const opponentNames = ['Brann', 'Sekka', 'Otho', 'Mirel', 'Dagan', 'Ysolde', 'Korvo', 'Nim', 'Tavish', 'Ruga', 'Petra', 'Hask', 'Ilo', 'Marrok', 'Sava', 'Corm'];
  const opponentColors = [[49, 102, 110], [70, 92, 140], [92, 112, 66], [120, 80, 130], [140, 108, 52], [60, 110, 96]];
  const debtEvery = 5;
  // Strangers who turn up between days. Each can be refused; the price is always on the table first.
  const visitorChance = .25;
  const visitors = {
    crone: { name: 'The Marsh Crone', act: 0, color: [96, 120, 70], story: 'An old woman with reeds in her hair takes your hand. “I can move what is in you. Not make more. Move.”' },
    peddler: { name: 'The One-Eyed Peddler', act: 0, color: [150, 118, 62], story: 'He unwraps a glass eye. “Wear it on a cord. You will see every gap in a guard, and nothing far away.”' },
    envoy: { name: 'The Red Envoy', act: 1, color: [150, 36, 40], story: 'A sealed letter, still warm. “My master has a word that ends fights. It is paid for in the usual coin.”' },
    dealer: { name: 'The Deck Dealer', act: 1, color: [92, 62, 130], story: 'Three cards lie face down on a barrel. “One draw. I do not know which is which, and neither do you.”' },
    flagellant: { name: 'The Flagellant', act: 1, color: [124, 112, 100], story: 'Scars cover his back. “Take the lash with me today, and pain will never slow you again.”' }
  };
  const zealHealth = .94;
  // The stands. The bookmaker prices a bout from trial runs and keeps a fifth of every fair return.
  const bookTrials = 40;
  const houseCut = .2;
  const maxPays = 4;
  const minPays = 1.1;
  const studyTrials = 20;

  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  // Every random choice comes from a state kept in the save, so reloading cannot reroll it.
  function roll(holder) {
    holder.rng = (holder.rng + 0x6D2B79F5) >>> 0;
    let t = holder.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const int = (holder, low, high) => low + Math.floor(roll(holder) * (high - low + 1));
  const pick = (holder, list) => list[Math.floor(roll(holder) * list.length)];

  // 4d6, drop the lowest.
  function rollStats(random = Math.random) {
    return Object.fromEntries(Object.keys(statNames).map(key => {
      const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6)).sort((a, b) => b - a);
      return [key, dice[0] + dice[1] + dice[2]];
    }));
  }

  const stat = (run, key) => run.stats[key] + (races[run.race].stats[key] || 0);
  // Saves from before strangers existed have met none.
  const metOf = run => run.met || {};

  function trained(run, key) {
    let total = 0;
    for (let i = 0; i < run.train[key]; i++) total += drills[key].gain / (1 + .12 * i);
    return total * races[run.race].training;
  }

  // Saves from before triggers existed have none.
  const triggerFor = (run, spell) => run.triggers?.[spell] || 'auto';

  function setTrigger(run, spell, key) {
    if (run.learned.includes(spell) && triggerKeys.includes(key)) run.triggers = { ...run.triggers, [spell]: key };
  }

  // From the second act the market sells one torn page per act.
  // Only spells that come from pages raise the price; the Red Envoy's does not.
  const pageCost = run => 50 + 30 * run.learned.filter(key => spellPool.includes(key)).length;
  const pageOnSale = run => run.act >= 1 && run.pageAct !== run.act && spellPool.some(key => !run.learned.includes(key));

  function buyPage(run) {
    if (run.over || run.pending || run.spellChoices || !pageOnSale(run) || run.gold < pageCost(run)) return false;
    run.gold -= pageCost(run);
    run.pageAct = run.act;
    offerSpells(run);
    return true;
  }

  function heroConfig(run) {
    const weaponKey = key => trophies[key] || key;
    const { weapon, reserve, shield, armor } = run.equipped;
    const special = [weapon, reserve].find(key => trophies[key]) || 'none';
    const hurt = part => woundsOf(run).some(wound => wound.part === part) ? .9 : 1;
    const eye = metOf(run).peddler;
    const zeal = Boolean(metOf(run).flagellant);
    return {
      name: run.name,
      level: 1 + run.wins,
      strength: Math.round((24 + stat(run, 'str') * 1.7 + trained(run, 'power')) * hurt('arm')),
      attack: Math.round((24 + stat(run, 'agi') * 1.7 + trained(run, 'skill')) * hurt('head')) + (eye ? 16 : 0),
      ranged: Math.round((24 + stat(run, 'agi') * 1.9 + trained(run, 'skill')) * hurt('head')) - (eye ? 20 : 0),
      magic: Math.round(30 + stat(run, 'mind') * 2.2),
      defense: Math.round(8 + stat(run, 'agi') * .35 + stat(run, 'end') * .2 + trained(run, 'guard')),
      maxHP: Math.round(((72 + stat(run, 'end') * 2.7) * 1.5 + trained(run, 'toughness') + run.wins) * hurt('body') * (zeal ? zealHealth : 1)),
      zeal,
      tactic: run.tactic || 'balanced',
      aimAt: run.aimAt || 'any',
      pace: hurt('leg') < 1 ? .9 : 1,
      color: [157, 62, 42],
      trim: [242, 143, 96],
      lifesteal: races[run.race].lifesteal,
      spellList: run.spells.slice(),
      triggers: Object.fromEntries(run.spells.filter(key => triggerFor(run, key) !== 'auto').map(key => [key, triggerFor(run, key)])),
      health: run.health,
      gear: { weapon: weaponKey(weapon), reserve: reserve === 'none' ? 'none' : weaponKey(reserve), shield, armor, spellbook: 'none', special }
    };
  }

  function makeOpponent(run, kind) {
    const act = run.act;
    const gear = opponentGear[act];
    const blood = kind === 'blood';
    const skill = () => 33 + act * 11 + (blood ? 7 : 0) + int(run, -4, 4);
    return {
      name: pick(run, opponentNames),
      level: 2 + act * 10 + int(run, 0, 6),
      strength: skill(), attack: skill(), ranged: skill(), magic: 34 + act * 8,
      defense: 7 + act * 5 + (blood ? 2 : 0),
      maxHP: 138 + act * 40 + (blood ? 20 : 0) + int(run, -8, 8),
      color: pick(run, opponentColors),
      trim: [200, 210, 190],
      spellList: act >= 2 && blood && roll(run) < .35 ? [pick(run, ['ember', 'frost', 'arc'])] : [],
      lifesteal: 0,
      health: 1,
      gear: { weapon: pick(run, gear.weapon), reserve: 'none', shield: pick(run, gear.shield), armor: pick(run, gear.armor), spellbook: 'none', special: 'none' }
    };
  }

  function championConfig(index) {
    const champion = champions[index];
    return {
      name: champion.name, color: champion.color, trim: champion.trim, spellList: [], lifesteal: 0, health: 1,
      ...clone(champion.config), gear: { ...champion.config.gear, spellbook: 'none' }
    };
  }

  function refreshOffers(run) {
    run.offers = { spar: makeOpponent(run, 'spar'), blood: makeOpponent(run, 'blood') };
  }

  function offerSpells(run) {
    const pool = spellPool.filter(key => !run.learned.includes(key));
    const choices = [];
    while (choices.length < 3 && pool.length) choices.push(pool.splice(Math.floor(roll(run) * pool.length), 1)[0]);
    run.spellChoices = choices;
  }

  // A later start (a Legacy) skips the beaten acts with some training, gold and one trophy.
  function newRun({ name, race, stats, seed = Math.floor(Math.random() * 4294967296), startAct = 0 }) {
    const run = {
      v: 1, name: (name || 'Castaway').slice(0, 16), race, stats: { ...stats }, rng: seed >>> 0,
      train: { power: startAct * 2, skill: startAct * 2, guard: startAct * 2, toughness: startAct * 2 },
      gold: 40 + startAct * 120, day: 1, act: startAct, renown: 0, health: 1, mercy: true, debtMisses: 0,
      inventory: ['club'], equipped: { weapon: 'club', reserve: 'none', shield: 'none', armor: 'rags' },
      tactic: 'balanced', aimAt: 'any', wounds: [], met: {}, visitor: null, duel: null,
      spells: [], triggers: {}, learned: [], spellChoices: null, spellsOwed: startAct, wins: 0, fights: 0, pending: null, over: null
    };
    if (startAct > 0) {
      run.inventory.push(champions[startAct - 1].trophy);
      offerSpells(run);
    }
    refreshOffers(run);
    return run;
  }

  const price = (run, key) => Math.round(catalog[key].price * races[run.race].price * (1 - clamp((stat(run, 'cha') - 10) * .02, -.1, .16)));
  const sellPrice = key => Math.round((catalog[key]?.price || 0) * .4);
  const shopStock = run => Object.keys(catalog).filter(key => catalog[key].act <= run.act);
  const slotOf = key => trophies[key] ? 'weapon' : catalog[key].slot;
  const trainingCost = run => 8 + 2 * Object.values(run.train).reduce((sum, count) => sum + count, 0);
  const purse = (run, kind) => kind === 'champion' ? 110 + 70 * run.act : kind === 'spar' ? 32 + 18 * run.act : 70 + 36 * run.act;
  const wage = run => 14 + 7 * run.act;
  const debtDue = run => 25 + 20 * run.act;
  const daysToDebt = run => debtEvery - ((run.day - 1) % debtEvery);
  const championReady = run => run.renown >= renownNeeded[run.act];

  function buy(run, key) {
    if (!shopStock(run).includes(key) || run.inventory.includes(key) || run.gold < price(run, key)) return false;
    run.gold -= price(run, key);
    run.inventory.push(key);
    return true;
  }

  function equipped(run, key) {
    return Object.values(run.equipped).includes(key);
  }

  function sell(run, key) {
    if (!run.inventory.includes(key) || equipped(run, key) || !catalog[key]) return false;
    run.inventory.splice(run.inventory.indexOf(key), 1);
    run.gold += sellPrice(key);
    return true;
  }

  // Slot is weapon, reserve, shield or armor. 'none' empties the backup or shield; 'rags' is no armor.
  function equip(run, slot, key) {
    const empty = (key === 'none' && (slot === 'reserve' || slot === 'shield')) || (key === 'rags' && slot === 'armor');
    if (!empty && (!run.inventory.includes(key) || slotOf(key) !== (slot === 'reserve' ? 'weapon' : slot))) return false;
    run.equipped[slot] = key;
    // The two hands need different weapon types, and a fighter can wield only one trophy.
    const { weapon, reserve } = run.equipped;
    const base = item => trophies[item] || item;
    if (reserve !== 'none' && (base(weapon) === base(reserve) || (trophies[weapon] && trophies[reserve]))) run.equipped.reserve = 'none';
    return true;
  }

  // Saves from before wounds existed have none.
  const woundsOf = run => run.wounds || [];
  const surgeonCost = run => 15 + 15 * run.act;

  function wound(run, part, events) {
    run.wounds = woundsOf(run).filter(item => item.part !== part).concat({ part, days: woundDays });
    events.push('You leave the sand with a wound: ' + wounds[part].name.toLowerCase() + ' (' + wounds[part].text + ') for ' + woundDays + ' days.');
  }

  function treat(run, part) {
    if (run.over || run.pending || run.gold < surgeonCost(run) || !woundsOf(run).some(item => item.part === part)) return false;
    run.gold -= surgeonCost(run);
    run.wounds = run.wounds.filter(item => item.part !== part);
    return true;
  }

  function setTactic(run, key) {
    if (tacticKeys.includes(key)) run.tactic = key;
  }

  function setAim(run, key) {
    if (aimKeys.includes(key)) run.aimAt = key;
  }

  // A day of rest counts double toward healing a wound.
  function healWounds(run, events, rested) {
    run.wounds = woundsOf(run).map(item => ({ ...item, days: item.days - (rested ? 2 : 1) })).filter(item => {
      if (item.days > 0) return true;
      events.push('Your ' + wounds[item.part].name.toLowerCase() + ' has healed.');
      return false;
    });
  }

  // Strangers roll their own dice, so meeting them never changes the foes or fight seeds a run would get.
  const fateOf = run => run.fate || (run.fate = { rng: (run.rng ^ 0x5EED5EED) >>> 0 });

  const canVisit = (run, key) => run.act >= visitors[key].act && (key === 'dealer' ? metOf(run).dealer !== run.act + 1 : !metOf(run)[key]);

  // The whole offer is fixed on arrival and saved, so reloading cannot change it.
  function visitorOffer(run, key) {
    const fate = fateOf(run);
    const offer = { key };
    if (key === 'crone') {
      const keys = Object.keys(statNames);
      offer.up = pick(fate, keys);
      const others = keys.filter(item => item !== offer.up);
      const spare = others.filter(item => run.stats[item] > 5);
      offer.down = pick(fate, spare.length ? spare : others);
    }
    if (key === 'flagellant') {
      const whole = Object.keys(wounds).filter(part => !woundsOf(run).some(item => item.part === part));
      offer.part = pick(fate, whole.length ? whole : Object.keys(wounds));
    }
    if (key === 'dealer') offer.card = pick(fate, ['fortune', 'curse', 'duel']);
    return offer;
  }

  function arrive(run) {
    const waiting = run.visitor;
    run.visitor = null;
    if (run.over || waiting || run.day < 3) return;
    const keys = Object.keys(visitors).filter(key => canVisit(run, key));
    if (keys.length && roll(fateOf(run)) < visitorChance) run.visitor = visitorOffer(run, pick(fateOf(run), keys));
  }

  const fortune = run => 2 * purse(run, 'blood');

  // What a visitor gives and what it costs, in words, shown before the choice.
  function visitorTerms(run) {
    const offer = run.visitor;
    if (offer.key === 'crone') return { gain: '+3 ' + statNames[offer.up] + ', for good.', price: '−3 ' + statNames[offer.down] + ', for good.' };
    if (offer.key === 'peddler') return { gain: '+16 melee skill, and every champion’s weak points on the wall, though not their habits.', price: '−20 ranged skill, for good.' };
    if (offer.key === 'envoy') return { gain: 'Red Verdict, a heavy spell (34 damage, 18 mana). It takes ' + (run.spells.length < 3 ? 'a free slot.' : 'your third slot.'),
      price: 'Every cast costs you 11 health.' };
    if (offer.key === 'dealer') return { gain: 'One card in three is a fortune: ' + fortune(run) + ' gold.',
      price: 'One in three is a curse (half your gold and a wound). One in three is a duel to the death with a stranger, before you do anything else.' };
    return { gain: 'For good: below half health your blows deal 25% more.',
      price: wounds[offer.part].name + ' today (' + wounds[offer.part].text + ' for ' + woundDays + ' days), and scars that cost 6% of your health for good.' };
  }

  function acceptBargain(run) {
    const offer = run.visitor;
    if (!offer || run.over || run.pending) return null;
    run.visitor = null;
    run.met = { ...metOf(run), [offer.key]: offer.key === 'dealer' ? run.act + 1 : true };
    const events = [];
    if (offer.key === 'crone') {
      run.stats[offer.up] += 3;
      run.stats[offer.down] -= 3;
      events.push('The Crone lets go of your hand. ' + statNames[offer.up] + ' rises, ' + statNames[offer.down] + ' drains away.');
    } else if (offer.key === 'peddler') {
      events.push('The glass eye hangs cold at your throat.');
    } else if (offer.key === 'envoy') {
      run.learned = run.learned.concat('verdict');
      run.spells = run.spells.slice(0, 2).concat('verdict');
      events.push('The word burns itself into you. Red Verdict is yours.');
    } else if (offer.key === 'flagellant') {
      events.push('You kneel beside him until dusk.');
      wound(run, offer.part, events);
    } else if (offer.card === 'fortune') {
      run.gold += fortune(run);
      events.push('Fortune. The Dealer pays out ' + fortune(run) + ' gold without a word.');
    } else if (offer.card === 'curse') {
      run.gold = Math.floor(run.gold / 2);
      events.push('Curse. Your purse is half as heavy when you look down.');
      wound(run, pick(fateOf(run), Object.keys(wounds)), events);
    } else {
      run.duel = makeOpponent(run, 'blood');
      events.push('The Duel. ' + run.duel.name + ' steps out of the crowd and draws.');
    }
    return events;
  }

  function declineBargain(run) {
    run.visitor = null;
  }

  function endDay(run, events, rested = false) {
    healWounds(run, events, rested);
    run.health = rested ? 1 : clamp(run.health + .22, 0, 1);
    if (run.day % debtEvery === 0 && !run.over) {
      const due = debtDue(run);
      if (run.gold >= due) {
        run.gold -= due;
        events.push('The lanista collects ' + due + ' gold.');
      } else if (run.debtMisses === 0) {
        run.debtMisses = 1;
        run.gold = 0;
        run.health = Math.min(run.health, .5);
        events.push('You cannot pay. The lanista takes every coin and has you flogged. Miss once more and you are sold to the mines.');
      } else {
        run.over = 'sold';
        events.push('Unable to pay again, you are sold to the salt mines. Nobody returns from them.');
      }
    }
    run.day++;
    refreshOffers(run);
    arrive(run);
    return events;
  }

  // A drawn duel waits before anything else can take the day.
  const busy = run => run.over || run.pending || run.duel;

  function train(run, key) {
    const cost = trainingCost(run);
    if (busy(run) || run.gold < cost) return null;
    run.gold -= cost;
    run.train[key]++;
    return endDay(run, ['You spend the day on drills: ' + drills[key].name.toLowerCase() + '.']);
  }

  function rest(run) {
    if (busy(run)) return null;
    return endDay(run, ['You sleep, eat and let your wounds close.'], true);
  }

  function work(run) {
    if (busy(run)) return null;
    const pay = wage(run);
    run.gold += pay;
    return endDay(run, ['You haul cargo on the docks for ' + pay + ' gold.']);
  }

  // The fight is fixed here (both fighters and the seed) and saved before it is shown.
  function startFight(run, kind) {
    if (run.over || run.pending || (kind === 'champion' && !championReady(run))) return null;
    if (kind === 'duel' ? !run.duel : run.duel) return null;
    // Walking onto the sand sends away a stranger still waiting.
    run.visitor = null;
    const foe = kind === 'champion' ? championConfig(run.act) : kind === 'duel' ? run.duel : run.offers[kind];
    run.pending = { kind, seed: Math.floor(roll(run) * 4294967296), hero: heroConfig(run), foe: clone(foe) };
    return run.pending;
  }

  // Saves from before the stands have watched nobody.
  const scoutedOf = (run, act = run.act) => Boolean(run.scouted?.[act]);

  // The day's bill comes from its own dice and the day alone, so it never shifts a run and reloading shows the same bouts.
  function billFor(run) {
    run.sands = run.sands || { rng: (run.rng ^ 0x0DD50DD5) >>> 0 };
    const holder = { act: run.act, rng: (run.sands.rng + Math.imul(run.day, 0x9E3779B1)) >>> 0 };
    const champion = championConfig(run.act);
    // Only a gladiator near a champion's own measure is worth an exhibition.
    const challenger = { ...makeOpponent(holder, 'blood'), level: champion.level, strength: champion.strength, attack: champion.attack,
      ranged: champion.attack, defense: champion.defense, maxHP: champion.maxHP };
    const first = makeOpponent(holder, 'blood');
    const second = makeOpponent(holder, 'blood');
    // Two fighters on the sand need telling apart.
    if (second.name === first.name) second.name = pick(holder, opponentNames.filter(name => name !== first.name));
    if (String(second.color) === String(first.color)) second.color = pick(holder, opponentColors.filter(color => String(color) !== String(first.color)));
    const seed = () => Math.floor(roll(holder) * 4294967296);
    return [
      { key: 'champion', fighters: [champion, challenger], seed: seed() },
      { key: 'undercard', fighters: [first, second], seed: seed() }
    ];
  }

  // `duel(seed, first, second)` says whether the first fighter wins. Returns what each side pays, or null for no bets.
  const books = new Map();
  function bookOdds(bout, duel) {
    const [first, second] = bout.fighters;
    const key = JSON.stringify(bout.fighters);
    if (!books.has(key)) {
      let wins = 0;
      for (let i = 0; i < bookTrials; i++) wins += duel(3000 + i * 389, first, second) ? 1 : 0;
      const share = (wins + 1) / (bookTrials + 2);
      books.set(key, [share, 1 - share].map(chance => {
        const pays = Math.floor(Math.min(maxPays, (1 - houseCut) / chance) * 20) / 20;
        return pays >= minPays ? pays : null;
      }));
    }
    return books.get(key);
  }

  const maxStake = run => Math.max(0, Math.min(run.gold, wage(run)));

  // The bout, the bet and its result are all fixed here and saved before anything is shown.
  function startWatch(run, key, duel, side = 0, stake = 0) {
    if (busy(run)) return null;
    if (!Number.isInteger(stake) || stake < 0 || stake > maxStake(run) || (side !== 0 && side !== 1)) return null;
    const bout = billFor(run).find(item => item.key === key);
    if (!bout) return null;
    const pays = stake ? bookOdds(bout, duel)[side] : null;
    if (stake && !pays) return null;
    const [first, second] = bout.fighters;
    run.visitor = null;
    run.gold -= stake;
    run.pending = { kind: 'watch', bout: key, seed: bout.seed, hero: first, foe: second, side, stake, pays,
      winner: duel(bout.seed, first, second) ? 0 : 1 };
    return run.pending;
  }

  function finishWatch(run) {
    const { bout, hero, foe, side, stake, pays, winner } = run.pending;
    run.pending = null;
    const [won, lost] = winner ? [foe, hero] : [hero, foe];
    const events = [won.name + ' beats ' + lost.name + (bout === 'champion' ? '. Champions fight exhibitions to first blood.' : '.')];
    if (stake && side === winner) {
      const paid = Math.floor(stake * pays);
      run.gold += paid;
      events.push('Your bet pays ' + paid + ' gold for ' + stake + ' staked.');
    } else if (stake) {
      events.push('Your ' + stake + ' gold stays with the bookmaker.');
    }
    if (bout === 'champion' && !scoutedOf(run)) {
      run.scouted = { ...run.scouted, [run.act]: true };
      events.push('You have studied ' + champions[run.act].name + '. The champion wall shows their habits.');
    }
    return endDay(run, events);
  }

  // After watching a champion: try each stance, then each target, and name what does clearly better.
  function study(run, duel) {
    const hero = heroConfig(run);
    const foe = championConfig(run.act);
    const wins = changes => {
      let total = 0;
      for (let i = 0; i < studyTrials; i++) total += duel(5000 + i * 271, { ...hero, ...changes }, foe) ? 1 : 0;
      return total;
    };
    const best = (keys, field, fixed, plain) => {
      const base = wins({ ...fixed, [field]: plain });
      return keys.filter(key => key !== plain).reduce((top, key) => {
        const total = wins({ ...fixed, [field]: key });
        return total > top.wins && total >= base + 3 ? { key, wins: total } : top;
      }, { key: plain, wins: base }).key;
    };
    const tactic = best(tacticKeys, 'tactic', { aimAt: 'any' }, 'balanced');
    return { tactic, aimAt: best(aimKeys, 'aimAt', { tactic }, 'any') };
  }

  function finishFight(run, result) {
    if (run.pending.kind === 'watch') return finishWatch(run);
    const { kind, foe } = run.pending;
    run.pending = null;
    if (kind === 'duel') run.duel = null;
    run.fights++;
    const events = [];
    if (result.won) {
      run.wins++;
      const gold = Math.round(purse(run, kind) * (1 + clamp((stat(run, 'cha') - 10) * .025, -.1, .2)));
      run.gold += gold;
      run.health = clamp(result.health, .15, 1);
      events.push('You defeat ' + foe.name + ' and earn ' + gold + ' gold.');
      if (kind === 'champion') {
        const champion = champions[run.act];
        run.inventory.push(champion.trophy);
        events.push(champion.name + ' is dead. Their weapon is yours.');
        if (run.act === champions.length - 1) {
          run.over = 'won';
          return events;
        }
        run.act++;
        run.renown = 0;
        run.mercy = true;
        run.health = 1;
        offerSpells(run);
        events.push('A page of their spellbook falls open. Choose a spell.');
      } else {
        run.renown += kind === 'spar' ? 1 : 2;
      }
    } else if (kind === 'spar') {
      run.health = .3;
      events.push(foe.name + ' beats you to the sand. Sparring ends at first blood: you keep your life, not the purse.');
    } else if (run.mercy) {
      run.mercy = false;
      run.gold = Math.floor(run.gold / 2);
      run.health = .25;
      events.push('You yield. The crowd grants mercy, once. Half your gold is gone, and they will not spare you again before the next champion.');
    } else {
      run.over = 'dead';
      events.push(foe.name + ' kills you. The sand drinks and the crowd moves on.');
      return events;
    }
    endDay(run, events);
    // Added after the day passes, so a new wound keeps its full length.
    if (result.health < woundBelow && !run.over) {
      wound(run, wounds[result.worst] ? result.worst : 'body', events);
      // His price must not be a wound you have just picked up.
      if (run.visitor?.key === 'flagellant' && woundsOf(run).some(item => item.part === run.visitor.part)) run.visitor = visitorOffer(run, 'flagellant');
    }
    return events;
  }

  function learnSpell(run, key) {
    if (!run.spellChoices?.includes(key)) return false;
    run.learned.push(key);
    if (run.spells.length < 3) run.spells.push(key);
    run.spellsOwed = Math.max(0, run.spellsOwed - 1);
    run.spellChoices = null;
    if (run.spellsOwed > 0) offerSpells(run);
    return true;
  }

  function toggleSpell(run, key) {
    const at = run.spells.indexOf(key);
    if (at >= 0) run.spells.splice(at, 1);
    else if (run.learned.includes(key) && run.spells.length < 3) run.spells.push(key);
  }

  return {
    races, statNames, visitors, metOf, visitorOffer, visitorTerms, acceptBargain, declineBargain, triggerKeys, spellPool, triggerFor, setTrigger, pageCost, pageOnSale, buyPage, wounds, woundDays, woundBelow, tacticKeys, aimKeys, woundsOf, surgeonCost, treat, setTactic, setAim, drills, catalog, trophies, champions, renownNeeded,
    rollStats, stat, newRun, heroConfig, championConfig, price, sellPrice, shopStock, slotOf, trainingCost, purse, wage,
    debtDue, daysToDebt, championReady, scoutedOf, billFor, bookOdds, maxStake, startWatch, study, buy, sell, equip, equipped, train, rest, work, startFight, finishFight, learnSpell, toggleSpell
  };
})();
