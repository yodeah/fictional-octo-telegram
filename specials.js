'use strict';

// Rare weapon specials. Each one reuses an existing weapon model (`weapon`) with new colors and a
// few added details, and changes the fight through optional hooks that arena.js calls:
//   modifyAction(fighter, action, state)    when an attack with this weapon starts
//   onLanded(fighter, target, action, damage, state)  after an attack with this weapon lands (not blocked or missed)
//   onUpdate(fighter, state)                every simulation step while the fighter owns the special
//   noGuard(fighter, state)                 true stops the fighter from blocking
//   lockWeapon(fighter, state)              a weapon key the fighter must use
//   status(fighter, state)                  short text for the scoreboard
//   details({ along, limb, paint, fighter, state })  extra model parts on top of the base weapon
//   aura(fighter, state)                    a color to glow around the fighter, or nothing
// `state` is a fresh object per fighter per bout. Hooks run in arena.js's scope, so they can use its
// helpers (floatLabel, burst, schedule, specialHit, logEvent and so on) at call time.
// A generated fighter has a 5% chance to carry one (see matchups.js), and the Special picker sets one for testing.
const specialChance = .05;

const specials = {
  stormbrand: {
    name: 'Stormbrand', weapon: 'sword', icon: 'ϟ', color: '#9fd8ff', trail: '#cdeaff',
    effect: 'After 3 landed hits, lightning strikes the target once: 14 + Magic ÷ 12 magic damage and drains 20 energy',
    palette: { metal: [170, 198, 228], leather: [38, 50, 86], trim: [228, 200, 96] },
    onLanded(fighter, target, action, damage, state) {
      state.hits = (state.hits || 0) + 1;
      if (state.hits < 3 || state.spent) return;
      state.spent = true;
      schedule(.16, () => {
        const amount = (14 + fighter.magic / 12) * armors[target.gear.armor].magic;
        ArenaEffects.lightning([target.x, 1.3, target.z + .4], this.color);
        target.energy = Math.max(0, target.energy - 20);
        updateEnergy(target);
        specialHit(fighter, target, amount, { special: this, tag: 'STORMBRAND · −20 ENERGY', message: 'calls lightning down on' });
      });
    },
    status: (fighter, state) => state.spent ? 'spent' : (state.hits || 0) + '/3 hits'
  },

  snarecaster: {
    name: 'Snarecaster', weapon: 'crossbow', icon: '⌇', color: '#9be08a', trail: '#c8f0b4',
    effect: 'Its first bolt to land also roots the target in place for 3 seconds (once per bout)',
    palette: { metal: [118, 150, 104], leather: [58, 70, 38], armor: [92, 104, 64] },
    modifyAction(fighter, action, state) {
      if (!state.spent) action.snare = true;
    },
    onLanded(fighter, target, action, damage, state) {
      if (!action.snare || state.spent) return;
      state.spent = true;
      target.rootedUntil = elapsed + 3;
      target.frozenUntil = Math.max(target.frozenUntil, target.rootedUntil);
      target.freezeX = target.x;
      target.freezeZ = target.z;
      floatLabel(target, 'ROOTED', this.color, { tag: 'SNARECASTER · 3S' });
      burst(target, { y: .25, colors: [this.color, '#5f8a45'], count: 22, gravity: 3 });
      logEvent(fighter.name + '’s Snarecaster bolt roots ' + target.name + ' in place.');
    },
    details({ along, limb }) {
      // Weighted snare cords coiled around the stock, with a weight at each bow tip.
      for (const at of [.05, .14, .23]) limb(along(at - .02), along(at + .02), [.128, .112], [.128, .112], [146, 196, 112], 8);
      for (const side of [-1, 1]) limb(along(.47, side * .37), along(.45, side * .40), [.05, .05], [.05, .05], [60, 64, 52], 6);
    },
    status: (fighter, state) => state.spent ? 'spent' : 'snare ready'
  },

  lastOath: {
    name: 'Last Oath', weapon: 'greatsword', icon: '✠', color: '#ff6a5a', trail: '#ff9d8a',
    effect: 'Below 10% health, the oath takes hold for the rest of the bout: +60% damage and 40% lifesteal, but no blocking',
    palette: { metal: [152, 142, 150], leather: [112, 24, 30], bronze: [226, 210, 180], darkSteel: [92, 22, 28] },
    onUpdate(fighter, state) {
      const threshold = forced.has('oath') ? 1 : .10;
      if (state.sworn || fighter.hp <= 0 || fighter.hp >= fighter.maxHP * threshold) return;
      state.sworn = true;
      floatLabel(fighter, 'LAST OATH', this.color, { tag: '+60% DAMAGE · LIFESTEAL · NO BLOCKING', power: .15 });
      burst(fighter, { colors: [this.color, '#ffd0a8'], count: 30, gravity: 1.5 });
      ArenaEffects.shake(.4);
      logEvent(fighter.name + ' swears the Last Oath: more damage and lifesteal, no more blocking.');
    },
    noGuard: (fighter, state) => state.sworn,
    lockWeapon(fighter, state) {
      return state.sworn ? this.weapon : null;
    },
    modifyAction(fighter, action, state) {
      if (!state.sworn) return;
      action.damage *= 1.6;
      action.oath = true;
    },
    onLanded(fighter, target, action, damage, state) {
      if (!action.oath || !damage) return;
      const healing = Math.min(Math.round(damage * .4), fighter.maxHP - fighter.hp);
      if (healing <= 0) return;
      fighter.hp += healing;
      floatLabel(fighter, '+' + healing, healColor, { tag: 'LAST OATH', power: healing / fighter.maxHP });
      logEvent(fighter.name + ' drinks ' + healing + ' health through the Last Oath.');
      updateHealth();
    },
    details({ along, limb, state }) {
      // A crimson fuller down the blade that burns brighter once the oath is sworn.
      const glow = state.sworn ? [255, 92, 70] : [150, 34, 40];
      limb(shifted(along(.32), 0, 0, .05), shifted(along(1.32), 0, 0, .045), [.035, .02], [.022, .016], glow, 6);
    },
    aura: (fighter, state) => state.sworn ? '#ff5a4a' : null,
    status: (fighter, state) => state.sworn ? 'SWORN' : 'below 10% HP'
  }
};
