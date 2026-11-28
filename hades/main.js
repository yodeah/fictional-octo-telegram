// The page: matchups, the fixed-step clock, the HUD and the controls. Bouts are fully idle.
(function () {
  const { kits, weapons, armors, shields, moves } = window.HadesData;
  const Sim = window.HadesSim, Render = window.HadesRender;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const step = 1 / 60;
  const speeds = [1, 2, .5];
  const wins = [0, 0];
  const teamNames = ['Red', 'Blue'];

  let duel, state = 'ready', speed = 0, bout = 1, accumulator = 0, pause = 0, slow = 0, rematch = 0;
  let matchup;
  // Only the two detailed champions can be picked. The older classes stay in data.js but their
  // sprites are not up to the same standard, so they are left out of the menus. Each fighter's
  // weapons can be changed from the champion's own.
  const keys = Object.keys(kits).filter(key => kits[key].champion);
  const gearOf = key => ({ kit: key, weapon: kits[key].weapon, reserve: kits[key].reserve, armor: kits[key].armor });
  // Leather stands for the champion's own outfit; the others are worn over it.
  const armorChoices = ['leather', 'segmentata', 'cuirass', 'pelt'].filter(key => armors[key]);
  // Every fighter who can take the floor. A 1v1 bout uses the first two; 2v2 adds a second pair,
  // so each team has a murmillo and an archer.
  const roster = [
    { name: 'Varro', team: 0, ...gearOf('murmillo') }, { name: 'Cassian', team: 1, ...gearOf('sagittarius') },
    { name: 'Felix', team: 0, ...gearOf('sagittarius') }, { name: 'Draco', team: 1, ...gearOf('murmillo') }
  ];
  let mode = params.get('mode') === '2v2' ? '2v2' : '1v1';
  const lineup = () => roster.slice(0, mode === '2v2' ? 4 : 2);
  const teamColors = ['#ff8a6a', '#7fd0ff'];
  const teamLabel = team => mode === '2v2' ? teamNames[team] : lineup().find(l => l.team === team).name;

  function newMatchup() {
    matchup = lineup().map(entry => ({ ...entry }));
    wins[0] = wins[1] = 0;
  }

  function choice(label, options, value, change) {
    const wrap = document.createElement('label');
    const select = document.createElement('select');
    for (const [key, text] of options) select.add(new Option(text, key));
    select.value = value;
    select.addEventListener('change', () => change(select.value));
    wrap.append(label + ' ', select);
    return wrap;
  }

  // One row per fighter: champion, main weapon, backup, armor.
  function buildLoadouts() {
    const weaponOptions = Object.entries(weapons).map(([key, w]) => [key, w.name]);
    const armorOptions = armorChoices.map(key => [key, key === 'leather' ? 'Own outfit' : armors[key].name]);
    const rows = lineup().slice().sort((a, b) => a.team - b.team);
    $('loadouts').replaceChildren(...rows.map(entry => {
      const row = document.createElement('div');
      row.className = 'slot';
      row.style.setProperty('--team', teamColors[entry.team]);
      const name = document.createElement('b');
      name.textContent = entry.name;
      const changed = () => {
        if (state === 'finished') bout++;
        newMatchup();
        setup();
      };
      row.append(name,
        choice('Champion', keys.map(key => [key, kits[key].name]), entry.kit, value => { Object.assign(entry, gearOf(value)); buildLoadouts(); changed(); }),
        choice('Main', weaponOptions, entry.weapon, value => { entry.weapon = value; changed(); }),
        choice('Backup', weaponOptions, entry.reserve, value => { entry.reserve = value; changed(); }),
        choice('Armor', armorOptions, entry.armor, value => { entry.armor = value; changed(); }));
      return row;
    }));
    updateControls();
  }

  // A HUD card per fighter, stacked on their team's side.
  function card(i) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<h2><span id="name${i}"></span> <small id="class${i}"></small> <em id="status${i}"></em></h2>
      <div class="bar" role="img" aria-label="Health"><i id="hp${i}"></i><span id="hpText${i}"></span></div>
      <div class="gauge mana" title="Mana"><i id="mana${i}"></i></div>
      <div class="gauge energy" title="Energy"><i id="energy${i}"></i></div>
      <div class="gauge stance" title="Stance"><i id="stance${i}"></i></div>
      <div class="pips" id="pips${i}" aria-label="Escape charges"></div>
      <p id="gear${i}"></p>`;
    return el;
  }

  function setup(seed = Math.floor(Math.random() * 1e9)) {
    duel = Sim.createBattle(matchup.map(({ name, team, ...entry }) => ({ entry, team, name })), seed);
    state = 'ready';
    accumulator = pause = slow = 0;
    Render.reset();
    $('result').hidden = true;
    $('banner').hidden = true;
    $('log').replaceChildren();
    for (const team of [0, 1]) {
      $('hud' + team).classList.toggle('team', mode === '2v2');
      $('hud' + team).replaceChildren(...duel.fighters.filter(f => f.team === team).map(f => card(f.index)));
    }
    for (const f of duel.fighters) {
      $('name' + f.index).textContent = f.name;
      $('class' + f.index).textContent = f.kit.name;
    }
    $('record').textContent = [0, 1].map(team => teamLabel(team) + ' ' + wins[team]).join(' · ');
    updateControls();
    updateHud();
  }

  function updateControls() {
    $('play').textContent = { ready: 'Begin duel', running: 'Pause', paused: 'Resume', finished: 'Rematch' }[state];
    const locked = state === 'running' || state === 'paused';
    $('generate').disabled = locked;
    $('mode').disabled = locked;
    for (const select of $('loadouts').querySelectorAll('select')) select.disabled = locked;
    $('bout').textContent = String(bout).padStart(2, '0');
  }

  const set = (element, percent) => {
    const width = Math.max(0, Math.round(percent)) + '%';
    if (element.style.width !== width) element.style.width = width;
  };
  const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };

  function updateHud() {
    for (const f of duel.fighters) {
      const i = f.index;
      set($('hp' + i), 100 * f.hp / f.maxHP);
      text($('hpText' + i), Math.ceil(f.hp) + ' / ' + f.maxHP);
      set($('mana' + i), f.mana);
      set($('energy' + i), f.energy);
      set($('stance' + i), 100 * (1 - f.stance / Sim.stanceLimit(f)));
      const { kit } = f;
      const stowed = f.weapon === kit.weapon ? kit.reserve : kit.weapon;
      text($('gear' + i), [`${weapons[f.weapon].name} (spare: ${weapons[stowed].name})`,
        kit.shield !== 'none' && (f.shieldHits ? shields[kit.shield].name : 'Shield broken'),
        armors[kit.armor].name, moves[kit.move].name].filter(Boolean).join(' · '));
      const status = f.dead ? 'Fallen' : f.frozenUntil > duel.time ? 'Frozen' : f.stunnedUntil > duel.time ? 'Staggered'
        : f.chilledUntil > duel.time ? 'Chilled' : f.hinderedUntil > duel.time ? 'Slowed' : f.hastedUntil > duel.time ? 'Hasted' : '';
      text($('status' + i), status);
      const pips = $('pips' + i);
      const total = moves[f.move].charges;
      if (pips.children.length !== total) pips.replaceChildren(...Array.from({ length: total }, () => document.createElement('i')));
      [...pips.children].forEach((pip, k) => pip.classList.toggle('ready', k < f.charges));
    }
  }

  function log(message) {
    const item = document.createElement('li');
    item.textContent = message;
    $('log').prepend(item);
    while ($('log').children.length > 30) $('log').lastChild.remove();
  }

  function narrate(e) {
    const who = duel.fighters[e.who]?.name;
    const by = duel.fighters[e.by]?.name;
    if (e.type === 'hit' && e.damage) log(`${by} hits ${who} for ${e.damage}${e.rear ? ' from behind' : e.critical ? ', a critical blow' : ''}.`);
    else if (e.type === 'block') log(`${who} ${e.perfect ? 'times a perfect block' : 'blocks'}.`);
    else if (e.type === 'swap') log(`${who} switches to the ${weapons[e.weapon].name.toLowerCase()}.`);
    else if (e.type === 'kick') log(`${who} kicks.`);
    else if (e.type === 'bash') log(`${who} bashes with the shield.`);
    else if (e.type === 'interrupt') log(`${who}’s ${e.name.toLowerCase()} is knocked aside.`);
    else if (e.type === 'dodge') log(`${who} dodges the shot.`);
    else if (e.type === 'dashstrike') log(`${who} dash-strikes.`);
    else if (e.type === 'blink' || e.type === 'roll') log(`${who} ${e.type}s away.`);
    else if (e.type === 'stagger') log(`${who} staggers.`);
    else if (e.type === 'freeze') log(`${who} is frozen.`);
    else if (e.type === 'support') log(`${who} casts ${e.name}.`);
    else if (e.type === 'wallslam') log(`${who} is slammed into the stone.`);
    else if (e.type === 'shieldbreak') log(`${who}’s shield breaks.`);
    else if (e.type === 'death') log(duel.winner === null ? `${who} falls to ${by}.` : `${teamLabel(duel.winner)} ${mode === '2v2' ? 'team wins' : 'wins'} the bout.`);
  }

  function handleEvents() {
    for (const e of duel.events) {
      Render.onEvent(e, duel);
      narrate(e);
      // A beat of stillness sells a heavy contact; the killing blow plays in slow motion.
      if (e.type === 'hit') pause = Math.max(pause, e.heavy ? .08 : e.critical ? .055 : .02);
      else if (e.type === 'block' && e.perfect) pause = Math.max(pause, .07);
      else if (e.type === 'death' && duel.winner === null) pause = Math.max(pause, .1);
      else if (e.type === 'death' && state !== 'finished') {
        pause = .14;
        slow = 1.1;
        rematch = 3.4;
        state = 'finished';
        wins[duel.winner]++;
        const victors = duel.fighters.filter(f => f.team === duel.winner);
        $('winner').textContent = mode === '2v2' ? teamNames[duel.winner] + ' team · ' + victors.map(f => f.name).join(' & ')
          : victors[0].name + ' · ' + victors[0].kit.name;
        $('record').textContent = [0, 1].map(team => teamLabel(team) + ' ' + wins[team]).join(' · ');
        setTimeout(() => { if (state === 'finished') $('result').hidden = false; }, 700);
        updateControls();
      }
    }
    duel.events.length = 0;
  }

  function advance(real) {
    if (state === 'paused') return 0;
    if (state === 'ready') return real;
    if (pause > 0) { pause -= real; return 0; }
    let factor = speeds[speed];
    if (slow > 0) { slow -= real; factor *= .3; }
    const dt = real * factor;
    accumulator += dt;
    while (accumulator >= step) {
      // After the winner is settled the sim keeps running so the fall and stray bolts play out.
      Sim.step(duel, step);
      accumulator -= step;
      if (duel.events.length) handleEvents();
      if (pause > 0) { accumulator = 0; break; }
    }
    if (state === 'finished' && $('repeat').checked && (rematch -= real) <= 0) {
      bout++;
      setup();
      begin();
    }
    return dt;
  }

  function begin() {
    state = 'running';
    $('banner').hidden = false;
    $('banner').textContent = [0, 1].map(team => duel.fighters.filter(f => f.team === team)
      .map(f => mode === '2v2' ? f.name : f.kit.name).join(' & ')).join('  vs  ');
    // Restart the entrance animation.
    $('banner').style.animation = 'none';
    void $('banner').offsetWidth;
    $('banner').style.animation = '';
    updateControls();
  }

  $('play').addEventListener('click', () => {
    if (state === 'ready') begin();
    else if (state === 'finished') { bout++; setup(); begin(); }
    else { state = state === 'running' ? 'paused' : 'running'; updateControls(); }
  });
  // Swaps which champion and gear stand on which side.
  $('generate').addEventListener('click', () => {
    if (state === 'finished') bout++;
    // Swap the gear of each opposing pair; the names stay on their side.
    for (let k = 0; k + 1 < lineup().length; k += 2) {
      const a = roster[k], b = roster[k + 1], gear = ({ kit, weapon, reserve, armor }) => ({ kit, weapon, reserve, armor });
      const ga = gear(a);
      Object.assign(a, gear(b));
      Object.assign(b, ga);
    }
    buildLoadouts();
    newMatchup();
    setup();
  });
  $('speed').addEventListener('click', () => {
    speed = (speed + 1) % speeds.length;
    $('speed').textContent = speeds[speed] + '×';
  });
  // ?a=murmillo&b=murmillo pins the champions (a mirror match), ?seed=7 repeats a bout, ?debug draws collision shapes.
  // Without them the two champions meet: Varro the murmillo against Cassian the archer.
  // ?mode=2v2 starts a team bout.
  roster.slice(0, 2).forEach((entry, i) => {
    const key = params.get(i ? 'b' : 'a');
    if (keys.includes(key)) Object.assign(entry, gearOf(key));
  });
  $('mode').value = mode;
  $('mode').addEventListener('change', () => {
    mode = $('mode').value;
    if (state === 'finished') bout++;
    buildLoadouts();
    newMatchup();
    setup();
  });

  Render.init($('arena'));
  buildLoadouts();
  newMatchup();
  setup(params.has('seed') ? Number(params.get('seed')) : undefined);

  // ?fps shows frame rate, draw time and the sprite cache.
  let counted = 0, spent = 0, since = performance.now();
  function report(now, ms) {
    counted++;
    spent += ms;
    if (now - since < 500) return;
    const { cached, baked, averageMs } = window.HadesSprites.stats();
    $('fps').hidden = false;
    $('fps').textContent = `${Math.round(1000 * counted / (now - since))} fps · draw ${(spent / counted).toFixed(2)} ms · `
      + `sprites ${cached} cached, ${baked} baked at ${averageMs.toFixed(1)} ms`;
    counted = spent = 0;
    since = now;
  }

  let last = performance.now();
  function frame(now) {
    // The first animation frame can be stamped before the page started its clock.
    const real = Math.max(0, Math.min(.05, (now - last) / 1000));
    last = now;
    const dt = advance(real);
    const before = performance.now();
    Render.draw(duel, dt, { debug: params.has('debug') });
    if (params.has('fps')) report(now, performance.now() - before);
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook: run the current bout to its end without waiting for animation frames.
  window.hadesTest = {
    get duel() { return duel; },
    get state() { return state; },
    // Plays real time forward through the page clock and picture (hidden tabs throttle animation frames).
    play(seconds) {
      for (let t = 0; t < seconds; t += step) Render.draw(duel, advance(step), {});
      updateHud();
      return { state, bout, time: duel.time };
    },
    run(seconds = 200) {
      if (state === 'ready') begin();
      for (let t = 0; t < seconds && state === 'running'; t += step) {
        Sim.step(duel, step);
        if (duel.events.length) handleEvents();
        if (Math.round(t / step) % 6 === 0) Render.draw(duel, step * 6, {});
      }
      return { state, time: duel.time, winner: duel.winner };
    }
  };
})();
