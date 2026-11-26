// Two players for whole-run tests: one makes sensible choices, one picks at random.
export function playRun(game, { seed, smart, race = 'human', startAct = 0 }) {
  const { Rules, ArenaDuel, weapons, armors } = game;
  let state = seed * 7919 + 13;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = list => list[Math.floor(random() * list.length)];
  // A player rerolls for a decent set of stats.
  let stats = Rules.rollStats(random);
  const total = s => s.str + s.agi + s.end;
  for (let i = 0; smart && i < 3; i++) {
    const next = Rules.rollStats(random);
    if (total(next) > total(stats)) stats = next;
  }
  const run = Rules.newRun({ name: 'Bot', race, stats, seed, startAct });
  const kinds = { spar: 0, blood: 0, champion: 0 };
  const losses = { spar: 0, blood: 0, champion: 0 };
  let seconds = 0;

  const duel = (hero, foe, fightSeed) => {
    ArenaDuel.setup(fightSeed, [hero, foe]);
    return ArenaDuel.resolve();
  };
  // A player's read of the odds, learned from experience: a few trial bouts with other seeds.
  const odds = (foe, trials = 7) => {
    const hero = Rules.heroConfig(run);
    let wins = 0;
    for (let i = 0; i < trials; i++) wins += duel(hero, foe, 1000 + i * 977 + run.day).won;
    return wins / trials;
  };
  const fight = kind => {
    const pending = Rules.startFight(run, kind);
    const result = duel(pending.hero, pending.foe, pending.seed);
    kinds[kind]++;
    if (!result.won) losses[kind]++;
    seconds += result.time;
    Rules.finishFight(run, result);
  };

  function shop() {
    if (!smart) {
      const key = pick(Rules.shopStock(run));
      if (random() < .3 && Rules.buy(run, key)) Rules.equip(run, Rules.slotOf(key), key);
      return;
    }
    const keep = Rules.daysToDebt(run) <= 4 ? Rules.debtDue(run) : 0;
    const weaponWorth = key => {
      const item = weapons[Rules.trophies[key] || key];
      return item.damage * item.tempo * (item.twoHanded ? 1.15 : 1) * (item.style === 'ranged' ? .75 : 1) + (Rules.trophies[key] ? 4 : 0);
    };
    const armorWorth = key => armors[key].defense + armors[key].defenseBonus.slice(0, 3).reduce((a, b) => a + b, 0) / 4;
    const shieldWorth = key => ({ none: 0, buckler: 1, round: 2, tower: 2.5 })[key];
    const worth = { weapon: weaponWorth, armor: armorWorth, shield: shieldWorth };
    for (const slot of ['weapon', 'armor', 'shield']) {
      const options = Rules.shopStock(run).filter(key => Rules.slotOf(key) === slot && !run.inventory.includes(key)
        && Rules.price(run, key) <= run.gold - keep && worth[slot](key) > worth[slot](run.equipped[slot]) * 1.12);
      options.sort((a, b) => worth[slot](b) - worth[slot](a));
      if (options.length) Rules.buy(run, options[0]);
      const owned = [...run.inventory.filter(key => Rules.slotOf(key) === slot), run.equipped[slot]];
      owned.sort((a, b) => worth[slot](b) - worth[slot](a));
      Rules.equip(run, slot, owned[0]);
    }
  }

  while (!run.over && run.day < 200) {
    if (run.spellChoices) {
      Rules.learnSpell(run, pick(run.spellChoices));
      continue;
    }
    shop();
    // The surgeon is only worth the money right before a champion.
    if (smart && Rules.championReady(run)) for (const { part } of Rules.woundsOf(run).slice()) {
      if (run.gold >= Rules.surgeonCost(run) + Rules.debtDue(run) + Rules.trainingCost(run)) Rules.treat(run, part);
    }
    if (!smart) {
      const options = ['spar', 'blood', 'train', 'rest', 'work'];
      if (Rules.championReady(run)) options.push('champion', 'champion');
      const choice = pick(options);
      if (choice === 'train') { if (!Rules.train(run, pick(Object.keys(Rules.drills)))) Rules.work(run); }
      else if (choice === 'rest') Rules.rest(run);
      else if (choice === 'work') Rules.work(run);
      else fight(choice);
      continue;
    }
    const reserve = Rules.daysToDebt(run) <= 4 ? Rules.debtDue(run) : 0;
    if (run.health < .75) { Rules.rest(run); continue; }
    if (Rules.championReady(run) && run.health > .9 && odds(Rules.championConfig(run.act), 25) >= (run.mercy ? .6 : .84)) { fight('champion'); continue; }
    const canTrain = run.gold >= Rules.trainingCost(run) + reserve;
    if (canTrain && (run.day % 2 === 0 || Rules.championReady(run))) {
      const drill = ['skill', 'power', 'toughness', 'guard'].sort((a, b) => run.train[a] - run.train[b])[0];
      Rules.train(run, drill);
      continue;
    }
    if (run.mercy && odds(run.offers.blood) >= .7) fight('blood');
    else if (odds(run.offers.spar) >= .5) fight('spar');
    else Rules.work(run);
  }
  return { over: run.over || 'stalled', act: run.act, day: run.day, fights: run.fights, kinds, losses, seconds };
}
