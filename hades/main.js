// The page: matchups, the fixed-step clock, the HUD and the controls. Bouts are fully idle.
(function () {
  const { kits, weapons, armors, shields, moves } = window.HadesData;
  const Sim = window.HadesSim, Render = window.HadesRender;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const step = 1 / 60;
  const speeds = [1, 2, .5];
  const names = ['Varro', 'Cassian'];
  const wins = [0, 0];

  let duel, state = 'ready', speed = 0, bout = 1, accumulator = 0, pause = 0, slow = 0, rematch = 0;
  let matchup;
  const keys = Object.keys(kits);
  const pickers = [0, 1].map(i => $('kit' + i));

  function rollKit(index, otherKey) {
    const pinned = pickers[index].value;
    if (pinned !== 'random') return pinned;
    // Random matchups favor a clash of styles.
    const style = key => weapons[kits[key].weapon].style;
    let pool = keys.filter(key => key !== otherKey);
    if (otherKey && Math.random() < .75) pool = pool.filter(key => style(key) !== style(otherKey));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function newMatchup() {
    const first = rollKit(0, pickers[1].value === 'random' ? null : pickers[1].value);
    matchup = [first, rollKit(1, first)];
    wins[0] = wins[1] = 0;
  }

  function setup(seed = Math.floor(Math.random() * 1e9)) {
    duel = Sim.createDuel(matchup[0], matchup[1], seed, names);
    state = 'ready';
    accumulator = pause = slow = 0;
    Render.reset();
    $('result').hidden = true;
    $('banner').hidden = true;
    $('log').replaceChildren();
    for (const f of duel.fighters) {
      const kit = f.kit;
      $('name' + f.index).textContent = f.name;
      $('class' + f.index).textContent = kit.name;
      $('gear' + f.index).textContent = [weapons[kit.weapon].name, kit.shield !== 'none' && shields[kit.shield].name,
        armors[kit.armor].name, moves[kit.move].name].filter(Boolean).join(' · ');
    }
    updateControls();
    updateHud();
  }

  function updateControls() {
    $('play').textContent = { ready: 'Begin duel', running: 'Pause', paused: 'Resume', finished: 'Rematch' }[state];
    const locked = state === 'running' || state === 'paused';
    $('generate').disabled = locked;
    pickers.forEach(picker => { picker.disabled = locked; });
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
    else if (e.type === 'dashstrike') log(`${who} dash-strikes.`);
    else if (e.type === 'blink' || e.type === 'roll') log(`${who} ${e.type}s away.`);
    else if (e.type === 'stagger') log(`${who} staggers.`);
    else if (e.type === 'freeze') log(`${who} is frozen.`);
    else if (e.type === 'support') log(`${who} casts ${e.name}.`);
    else if (e.type === 'wallslam') log(`${who} is slammed into the stone.`);
    else if (e.type === 'shieldbreak') log(`${who}’s shield breaks.`);
    else if (e.type === 'death') log(`${by} wins the bout.`);
  }

  function handleEvents() {
    for (const e of duel.events) {
      Render.onEvent(e, duel);
      narrate(e);
      // A beat of stillness sells a heavy contact; the killing blow plays in slow motion.
      if (e.type === 'hit') pause = Math.max(pause, e.heavy ? .08 : e.critical ? .055 : .02);
      else if (e.type === 'block' && e.perfect) pause = Math.max(pause, .07);
      else if (e.type === 'death') {
        pause = .14;
        slow = 1.1;
        rematch = 3.4;
        state = 'finished';
        wins[duel.winner]++;
        $('winner').textContent = duel.fighters[duel.winner].name + ' · ' + duel.fighters[duel.winner].kit.name;
        $('record').textContent = names.map((name, i) => name + ' ' + wins[i]).join(' · ');
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
    $('banner').textContent = duel.fighters.map(f => f.kit.name).join('  vs  ');
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
  $('generate').addEventListener('click', () => {
    if (state === 'finished') bout++;
    newMatchup();
    setup();
  });
  $('speed').addEventListener('click', () => {
    speed = (speed + 1) % speeds.length;
    $('speed').textContent = speeds[speed] + '×';
  });
  pickers.forEach(picker => {
    picker.add(new Option('Random', 'random'));
    for (const key of keys) picker.add(new Option(`${kits[key].name} — ${weapons[kits[key].weapon].name}`, key));
    picker.addEventListener('change', () => {
      if (state === 'finished') bout++;
      newMatchup();
      setup();
    });
  });

  // ?a=marksman&b=raider pins the kits, ?seed=7 repeats a bout, ?debug draws collision shapes.
  pickers.forEach((picker, i) => {
    const key = params.get(i ? 'b' : 'a');
    if (kits[key]) picker.value = key;
  });

  Render.init($('arena'));
  newMatchup();
  setup(params.has('seed') ? Number(params.get('seed')) : undefined);

  let last = performance.now();
  function frame(now) {
    const real = Math.min(.05, (now - last) / 1000);
    last = now;
    const dt = advance(real);
    Render.draw(duel, dt, { debug: params.has('debug') });
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook: run the current bout to its end without waiting for animation frames.
  window.hadesTest = {
    get duel() { return duel; },
    get state() { return state; },
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
