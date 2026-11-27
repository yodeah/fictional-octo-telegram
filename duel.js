'use strict';

// Runs the engine on a fixed time step with a seeded generator, so a seed and two fighters always
// give the same fight. That stops reload cheating and lets Node tests play bouts without drawing.
const ArenaDuel = (() => {
  const STEP = 1 / 60;
  const LIMIT = 180;
  let random = null;
  let carry = 0;
  let active = false;

  function generator(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seeded(run) {
    const real = Math.random;
    Math.random = random;
    try { return run(); } finally { Math.random = real; }
  }

  // Each config is a complete fighter: name, skills, gear, spellList, lifesteal and health (0–1).
  function setup(seed, configs) {
    random = generator(seed);
    carry = 0;
    state = 'ready';
    // Every optional field needs a default here: the engine reuses its fighters, and old saved fights lack the new ones.
    const copies = configs.map(config => ({ lifesteal: 0, spellList: [], tactic: 'balanced', aimAt: 'any', pace: 1, triggers: null, zeal: false, ...config, gear: { ...config.gear }, wins: 0 }));
    seeded(() => startBout(copies));
    fighters.forEach((fighter, index) => {
      fighter.hp = Math.max(1, Math.round(fighter.maxHP * (configs[index].health ?? 1)));
      const label = fighter.hud.level?.previousSibling;
      if (label) label.textContent = fighter.name + ' ';
    });
    updateHealth();
    runBout();
    active = true;
  }

  function step(visual) {
    const frozen = hitPause > 0;
    seeded(() => {
      update(STEP, STEP);
      if (state === 'running' && elapsed >= LIMIT) {
        const [first, second] = fighters;
        const winner = first.hp / first.maxHP >= second.hp / second.maxHP ? first : second;
        const loser = otherFighter(winner);
        loser.hp = 0;
        updateHealth();
        finishBout(winner, loser, 'body', false);
      }
    });
    if (visual && !frozen) {
      ArenaEffects.tick(STEP);
      sampleTrails();
      sampleDust();
    }
  }

  function advance(dt) {
    if (state === 'paused') return;
    carry = Math.min(carry + dt, 1);
    while (carry >= STEP) {
      carry -= STEP;
      step(true);
    }
  }

  // `worst` is the part of the first fighter that took the most damage; wounds follow it.
  const result = () => {
    if (state !== 'finished') return null;
    const zones = fighters[0].zoneDamage;
    return {
      won: fighters[0].hp > 0,
      health: Math.max(0, fighters[0].hp / fighters[0].maxHP),
      time: elapsed,
      worst: Object.keys(zones).reduce((worst, zone) => zones[zone] > zones[worst] ? zone : worst, 'body')
    };
  };

  // Plays the rest of the bout at once.
  function resolve() {
    if (state === 'paused') state = 'running';
    while (state === 'running') step(false);
    return result();
  }

  return {
    setup,
    advance,
    resolve,
    result,
    stop() { active = false; },
    get active() { return active; }
  };
})();
