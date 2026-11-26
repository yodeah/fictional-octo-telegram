'use strict';

// Rare weapon specials. Each one reuses an existing weapon model (`weapon`) with new colors and a
// few added details, and changes the fight through optional hooks that arena.js calls:
//   modifyAction(fighter, action, state)    when an attack with this weapon starts
//   onLanded(fighter, target, action, damage, state)  after an attack with this weapon lands (not blocked or missed)
//   onMissed / onBlocked(fighter, target, action, state)  after an attack with this weapon misses or is blocked
//   onResolved(fighter, target, action, state)  after an attack with this weapon resolves, whatever the outcome
//   onHurt(fighter, damage, state)          when the owner loses health
//   onLethal(fighter, attacker, state)      when a blow would kill the owner; true leaves them at 1 HP
//   onUpdate(fighter, state)                every simulation step while the fighter owns the special
//   noGuard(fighter, state)                 true stops the fighter from blocking
//   lockWeapon(fighter, state)              a weapon key the fighter must use
//   status(fighter, state)                  short text for the scoreboard
//   details({ along, limb, paint, fighter, state })  extra model parts on top of the base weapon
//   aura(fighter, state)                    a color to glow around the fighter, or nothing
//   draw(fighter, state)                    extra canvas drawing over the fighters
//   banner(fighter, state)                  action-banner text while something is happening, or nothing
// `state` is a fresh object per fighter per bout. Hooks run in arena.js's scope, so they can use its
// helpers (floatLabel, burst, schedule, specialHit, logEvent and so on) at call time.
// A generated fighter has a 5% chance to carry one (see matchups.js), and the Main and Backup pickers list them under ★ Special weapons.
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
  },

  dawnMender: {
    name: 'Dawn Mender', weapon: 'mace', icon: '☀', color: '#ffe28a', trail: '#fff1c0',
    effect: 'Once below 35% health, channels for 1.5 seconds to heal 30% of maximum health; any damage interrupts it and wastes the heal',
    palette: { metal: [238, 214, 150], armor: [250, 240, 212], leather: [124, 88, 52] },
    onUpdate(fighter, state) {
      if (state.channel && elapsed >= state.channel) {
        state.channel = fighter.channelUntil = 0;
        state.spent = state.healed = true;
        const healing = Math.min(Math.round(fighter.maxHP * .3), fighter.maxHP - fighter.hp);
        fighter.hp += healing;
        floatLabel(fighter, '+' + healing, healColor, { tag: 'DAWN MENDER', power: healing / fighter.maxHP });
        burst(fighter, { colors: [this.color, '#fffbe8'], count: 30, gravity: -1 });
        logEvent(fighter.name + '’s Dawn Mender restores ' + healing + ' HP.');
        updateHealth();
        return;
      }
      const threshold = forced.has('mender') ? 1 : .35;
      if (state.spent || state.channel || fighter.hp <= 0 || fighter.hp >= fighter.maxHP * threshold
        || fighter.action || fighter.stunnedUntil > elapsed) return;
      state.channel = fighter.channelUntil = elapsed + 1.5;
      fighter.readyAt = Math.max(fighter.readyAt, state.channel + .1);
      floatLabel(fighter, 'DAWN MENDER', this.color, { tag: 'HEALING · A HIT INTERRUPTS' });
      logEvent(fighter.name + ' raises Dawn Mender and begins to heal.');
    },
    onHurt(fighter, damage, state) {
      if (!state.channel) return;
      state.channel = fighter.channelUntil = 0;
      state.spent = true;
      fighter.readyAt = elapsed + .2;
      floatLabel(fighter, 'INTERRUPTED', '#ffb28a', { tag: 'DAWN MENDER' });
      logEvent(fighter.name + '’s healing is interrupted.');
    },
    details({ along, limb }) {
      // A pale sun crystal crowning the head.
      limb(along(.97), along(1.13), [.07, .07], [0, 0], [255, 250, 222], 6);
    },
    banner: (fighter, state) => state.channel ? 'Dawn Mender · healing' : null,
    aura: (fighter, state) => state.channel ? '#ffe28a' : null,
    status: (fighter, state) => state.channel ? 'healing…' : state.spent ? (state.healed ? 'healed' : 'interrupted') : 'below 35% HP'
  },

  dragonBow: {
    name: 'Dragon Bow', weapon: 'crossbow', icon: '♨', color: '#ff8a3d', trail: '#ffc08a',
    effect: 'Its first shot fires two burning bolts; each that lands sets the target burning for 3 seconds (2 damage every half second)',
    palette: { metal: [198, 76, 42], armor: [74, 30, 24], leather: [54, 32, 26] },
    modifyAction(fighter, action, state) {
      if (state.spent) return;
      state.spent = true;
      action.doubleShot = true;
      action.label = 'Dragon double shot';
    },
    onResolved(fighter, target, action) {
      if (!action.doubleShot) return;
      schedule(.14, () => {
        if (target.hp <= 0) return;
        const echo = { ...action, doubleShot: false, echo: true, lodged: false };
        echo.missedShot = Math.random() > clamp(echo.shotAccuracy - echo.crowded * .45, .24, .98);
        impact(echo);
      });
    },
    onLanded(fighter, target, action) {
      if ((action.doubleShot || action.echo) && target.hp > 0) ignite(target, fighter, 3);
    },
    details({ along, limb }) {
      // Horned tips on the bow arms.
      for (const side of [-1, 1]) limb(along(.48, side * .35), along(.58, side * .45), [.045, .045], [0, 0], [240, 204, 128], 5);
    },
    status: (fighter, state) => state.spent ? 'spent' : 'double shot ready'
  },

  wintersBite: {
    name: 'Winter’s Bite', weapon: 'axe', icon: '❄', color: '#bfe8ff', trail: '#e2f5ff',
    effect: 'Every third landed hit freezes the target for 1.2 seconds: no movement and no new attacks',
    palette: { metal: [202, 234, 250], armor: [122, 152, 178], leather: [200, 210, 222] },
    onLanded(fighter, target, action, damage, state) {
      state.hits = (state.hits || 0) + 1;
      if (state.hits % 3 || target.hp <= 0) return;
      target.frozenUntil = Math.max(target.frozenUntil, elapsed + 1.2);
      target.freezeX = target.x;
      target.freezeZ = target.z;
      target.readyAt = Math.max(target.readyAt, elapsed + 1.2);
      floatLabel(target, 'FROZEN', this.color, { tag: 'WINTER’S BITE · 1.2S' });
      burst(target, { colors: [this.color, '#ffffff'], count: 24, gravity: 2 });
      logEvent(fighter.name + '’s Winter’s Bite freezes ' + target.name + '.');
    },
    details({ along, limb }) {
      // An icicle hanging from the blade.
      limb(along(.62, .26), along(.48, .30), [.05, .04], [0, 0], [222, 246, 255], 5);
    },
    status: (fighter, state) => ((state.hits || 0) % 3) + '/3 to freeze'
  },

  leechFang: {
    name: 'Leech Fang', weapon: 'rapier', icon: '⚕', color: '#e0566a', trail: '#f08a98',
    effect: 'Heals 30% of the damage it deals, but each miss costs its wielder 3 HP (never below 1)',
    palette: { metal: [124, 32, 46], bronze: [224, 214, 192], leather: [42, 18, 22], darkSteel: [82, 22, 32] },
    onLanded(fighter, target, action, damage) {
      const healing = Math.min(Math.round(damage * .3), fighter.maxHP - fighter.hp);
      if (healing <= 0) return;
      fighter.hp += healing;
      floatLabel(fighter, '+' + healing, healColor, { tag: 'LEECH FANG', power: healing / fighter.maxHP });
      updateHealth();
    },
    onMissed(fighter) {
      const loss = Math.min(3, fighter.hp - 1);
      if (loss <= 0) return;
      fighter.hp -= loss;
      floatLabel(fighter, '−' + loss, this.color, { tag: 'LEECH FANG HUNGERS' });
      logEvent(fighter.name + '’s Leech Fang drinks ' + loss + ' of their own health.');
      updateHealth();
    },
    details({ along, limb }) {
      // A curved fang beside the guard.
      limb(along(.17, .10), along(.04, .17), [.045, .03], [0, 0], [236, 226, 204], 5);
    },
    status: () => 'heals on hit · bleeds on miss'
  },

  earthshaker: {
    name: 'Earthshaker', weapon: 'maul', icon: '⛰', color: '#e0a060', trail: '#f0c290',
    effect: 'Once per bout, a slam that breaks the target’s stance whether it hits or is blocked',
    palette: { metal: [132, 114, 94], darkSteel: [82, 68, 56], bronze: [200, 122, 62], armor: [98, 86, 72] },
    modifyAction(fighter, action, state) {
      if (state.spent || elapsed < 2) return;
      action.slam = true;
      action.label = 'Earthshaker slam';
    },
    slam(fighter, target, state) {
      state.spent = true;
      ArenaEffects.shake(1);
      kickDust(target, 2.3, 26);
      kickDust(fighter, 1.6, 14);
      floatLabel(target, 'EARTHSHAKER', this.color, { tag: 'STANCE BROKEN', power: .12 });
      logEvent(fighter.name + '’s Earthshaker slam breaks ' + target.name + '’s stance.');
      if (target.hp > 0 && target.stunnedUntil <= elapsed) breakStance(target, 1.4);
    },
    onLanded(fighter, target, action, damage, state) {
      if (action.slam) this.slam(fighter, target, state);
    },
    onBlocked(fighter, target, action, state) {
      if (action.slam) this.slam(fighter, target, state);
    },
    details({ along, limb }) {
      // A glowing rune on the head.
      limb(shifted(along(.86, -.06), 0, 0, .14), shifted(along(.86, .06), 0, 0, .14), [.035, .035], [.035, .035], [255, 152, 62], 6);
    },
    status: (fighter, state) => state.spent ? 'spent' : 'slam ready'
  },

  jailersChain: {
    name: 'Jailer’s Chain', weapon: 'flail', icon: '⛓', color: '#c9ccd6', trail: '#e2e4ea',
    effect: 'Once per bout, when the target keeps more than 3.1 units away, the chain pulls them into reach and cancels their attack',
    palette: { metal: [98, 100, 110], armor: [130, 86, 60], leather: [46, 42, 42] },
    onUpdate(fighter, state) {
      const rival = otherFighter(fighter);
      if (state.spent || specialOf(fighter) !== this || fighter.action || fighter.stunnedUntil > elapsed
        || fighter.frozenUntil > elapsed || elapsed < 1.5 || rival.hp <= 0 || rival.frozenUntil > elapsed) return;
      const gap = (rival.x - fighter.x) * fighter.direction;
      if (gap < (forced.has('pull') ? 2.4 : 3.1)) return;
      state.spent = true;
      state.chainUntil = elapsed + .5;
      rival.pull = gap - 1.85;
      if (rival.action && !rival.action.connected) rival.action = null;
      rival.readyAt = Math.max(rival.readyAt, elapsed + .5);
      spendEnergy(fighter, 10);
      ArenaEffects.shake(.35);
      floatLabel(rival, 'PULLED', this.color, { tag: 'JAILER’S CHAIN' });
      logEvent(fighter.name + '’s Jailer’s Chain drags ' + rival.name + ' in.');
    },
    draw(fighter, state) {
      if (!(state.chainUntil > elapsed)) return;
      const rival = otherFighter(fighter);
      const [fx, fy] = project(worldPoint(fighter, displayPose(fighter).joints.weaponHand));
      const [tx, ty] = project([rival.x, 1.3, rival.z + .3]);
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    },
    details({ along, limb }) {
      // A shackle on the haft.
      limb(along(-.20), along(-.13), [.115, .115], [.115, .115], [142, 146, 152], 8);
    },
    status: (fighter, state) => state.spent ? 'spent' : 'pull ready'
  },

  phoenixSpear: {
    name: 'Phoenix Spear', weapon: 'spear', icon: '♆', color: '#ffa040', trail: '#ffd08a',
    effect: 'Once per bout, survives a killing blow at 1 HP and bursts into flame, setting the attacker burning for 4 seconds',
    palette: { metal: [242, 172, 72], leather: [152, 42, 30] },
    onLethal(fighter, attacker, state) {
      if (state.spent) return false;
      state.spent = true;
      state.blazeUntil = elapsed + 3;
      floatLabel(fighter, 'PHOENIX', this.color, { tag: 'REBORN AT 1 HP', power: .2 });
      burst(fighter, { colors: fireColors, count: 40, gravity: -1 });
      ArenaEffects.shake(.8);
      logEvent(fighter.name + ' refuses to fall: the Phoenix Spear bursts into flame.');
      if (attacker && attacker !== fighter) ignite(attacker, fighter, 4);
      return true;
    },
    details({ along, limb }) {
      // Two flame feathers below the head.
      for (const side of [-1, 1]) limb(along(1.20, side * .04), along(1.02, side * .18), [.05, .02], [0, 0], [255, 112, 44], 5);
    },
    aura: (fighter, state) => state.blazeUntil > elapsed ? '#ff9a3a' : null,
    status: (fighter, state) => state.spent ? 'reborn' : 'rebirth ready'
  }
};
