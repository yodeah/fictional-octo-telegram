'use strict';

// Rare weapon specials. Each one reuses an existing weapon (`weapon`), has its own art under its key in
// weapons2d.js, and changes the fight through optional hooks that arena.js calls:
//   modifyAction(fighter, action, state)    when an attack with this weapon starts
//   onLanded(fighter, target, action, damage, state)  after an attack with this weapon lands (not blocked or missed)
//   onMissed / onBlocked(fighter, target, action, state)  after an attack with this weapon misses or is blocked
//   onResolved(fighter, target, action, state)  after an attack with this weapon resolves, whatever the outcome
//   onHurt(fighter, damage, state, source, kind)  when the owner loses health (kind: attack style, special, burn or thorns)
//   onLethal(fighter, attacker, state)      when a blow would kill the owner; true leaves them at 1 HP
//   onUpdate(fighter, state)                every simulation step while the fighter owns the special
//   noGuard(fighter, state)                 true stops the fighter from blocking
//   lockWeapon(fighter, state)              a weapon key the fighter must use
//   status(fighter, state)                  short text for the scoreboard
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
    status: (fighter, state) => state.spent ? 'spent' : 'snare ready'
  },

  lastOath: {
    name: 'Last Oath', weapon: 'greatsword', icon: '✠', color: '#ff6a5a', trail: '#ff9d8a',
    effect: 'Below 10% health, the oath takes hold for the rest of the bout: +60% damage and 40% lifesteal, but no blocking',
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
    aura: (fighter, state) => state.sworn ? '#ff5a4a' : null,
    status: (fighter, state) => state.sworn ? 'SWORN' : 'below 10% HP'
  },

  dawnMender: {
    name: 'Dawn Mender', weapon: 'mace', icon: '☀', color: '#ffe28a', trail: '#fff1c0',
    effect: 'Once below 35% health, channels for 1.5 seconds to heal 30% of maximum health; any damage interrupts it and wastes the heal',
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
    banner: (fighter, state) => state.channel ? 'Dawn Mender · healing' : null,
    aura: (fighter, state) => state.channel ? '#ffe28a' : null,
    status: (fighter, state) => state.channel ? 'healing…' : state.spent ? (state.healed ? 'healed' : 'interrupted') : 'below 35% HP'
  },

  dragonBow: {
    name: 'Dragon Bow', weapon: 'crossbow', icon: '♨', color: '#ff8a3d', trail: '#ffc08a',
    effect: 'Its first shot fires two burning bolts; each that lands sets the target burning for 3 seconds (2 damage every half second)',
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
    status: (fighter, state) => state.spent ? 'spent' : 'double shot ready'
  },

  wintersBite: {
    name: 'Winter’s Bite', weapon: 'axe', icon: '❄', color: '#bfe8ff', trail: '#e2f5ff',
    effect: 'Every third landed hit freezes the target for 1.2 seconds: no movement and no new attacks',
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
    status: (fighter, state) => ((state.hits || 0) % 3) + '/3 to freeze'
  },

  leechFang: {
    name: 'Leech Fang', weapon: 'rapier', icon: '⚕', color: '#e0566a', trail: '#f08a98',
    effect: 'Heals 30% of the damage it deals, but each miss costs its wielder 3 HP (never below 1)',
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
    status: () => 'heals on hit · bleeds on miss'
  },

  earthshaker: {
    name: 'Earthshaker', weapon: 'maul', icon: '⛰', color: '#e0a060', trail: '#f0c290',
    effect: 'Once per bout, a slam that breaks the target’s stance whether it hits or is blocked',
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
    status: (fighter, state) => state.spent ? 'spent' : 'slam ready'
  },

  jailersChain: {
    name: 'Jailer’s Chain', weapon: 'flail', icon: '⛓', color: '#c9ccd6', trail: '#e2e4ea',
    effect: 'Once per bout, when the target keeps more than 3.1 units away, the chain pulls them into reach and cancels their attack',
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
    status: (fighter, state) => state.spent ? 'spent' : 'pull ready'
  },

  phoenixSpear: {
    name: 'Phoenix Spear', weapon: 'spear', icon: '♆', color: '#ffa040', trail: '#ffd08a',
    effect: 'Once per bout, survives a killing blow at 1 HP and bursts into flame, setting the attacker burning for 4 seconds',
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
    aura: (fighter, state) => state.blazeUntil > elapsed ? '#ff9a3a' : null,
    status: (fighter, state) => state.spent ? 'reborn' : 'rebirth ready'
  },

  tidecaller: {
    name: 'Tidecaller', weapon: 'trident', icon: '≈', color: '#6fd3e8', trail: '#b8ecf6',
    effect: 'Every third landed hit crashes a wave into the target: pushed back 2.2 units (a wall slam if they reach the edge) and attacks slowed for 2 seconds',
    onLanded(fighter, target, action, damage, state) {
      state.hits = (state.hits || 0) + 1;
      if (state.hits % 3 || target.hp <= 0) return;
      target.shove = Math.max(target.shove, 2.2);
      target.chilledUntil = Math.max(target.chilledUntil, elapsed + 2);
      burst(target, { y: .3, direction: fighter.direction, colors: [this.color, '#e8fbff', '#3a9cc0'], count: 36, gravity: 4 });
      ArenaEffects.dust(target.x, target.z + .2, '#8fd8ea', 20, 1.7);
      ArenaEffects.shake(.45);
      floatLabel(target, 'TIDAL WAVE', this.color, { tag: 'PUSHED · SLOWED 2S' });
      logEvent(fighter.name + '’s Tidecaller crashes a wave into ' + target.name + '.');
    },
    status: (fighter, state) => ((state.hits || 0) % 3) + '/3 to wave'
  },

  gamblersClub: {
    name: 'Gambler’s Club', weapon: 'club', icon: '⚄', color: '#f2d36b', trail: '#f8e6a8',
    effect: 'Each swing rolls a die: a 6 triples the damage, a 1 deals half and fumbles away 12 energy',
    modifyAction(fighter, action, state) {
      action.die = 1 + Math.floor(Math.random() * 6);
      if (action.die === 6) action.damage *= 3;
      if (action.die === 1) action.damage *= .5;
      action.label = 'Gambler’s Club · rolled ' + action.die;
      state.last = action.die;
    },
    roll(fighter, action) {
      if (action.die === 6) {
        floatLabel(fighter, 'JACKPOT', this.color, { tag: 'ROLLED 6 · TRIPLE DAMAGE', power: .15 });
        ArenaEffects.shake(.5);
        logEvent(fighter.name + ' rolls a 6 with the Gambler’s Club.');
      } else if (action.die === 1) {
        spendEnergy(fighter, 12);
        floatLabel(fighter, 'FUMBLE', '#d8a070', { tag: 'ROLLED 1 · −12 ENERGY' });
        logEvent(fighter.name + ' rolls a 1 and fumbles.');
      }
    },
    onLanded(fighter, target, action) {
      this.roll(fighter, action);
    },
    onBlocked(fighter, target, action) {
      if (action.die === 1) this.roll(fighter, action);
    },
    onMissed(fighter, target, action) {
      if (action.die === 1) this.roll(fighter, action);
    },
    status: (fighter, state) => state.last ? 'last roll ' + state.last : 'roll the die'
  },

  briarBlade: {
    name: 'Briar Blade', weapon: 'falchion', icon: '❦', color: '#8fcf6a', trail: '#c4eaa8',
    effect: 'Thorns: whoever lands a weapon or bolt on its wielder takes 30% of that damage back (at least 1)',
    onHurt(fighter, damage, state, source, kind) {
      if (!source || source === fighter || (kind !== 'melee' && kind !== 'ranged')) return;
      // Applied a moment later, after the blow that caused it has finished resolving.
      schedule(.12, () => {
        const dealt = chipDamage(fighter, source, damage * .3, { color: this.color, tag: 'THORNS', kind: 'thorns' });
        if (!dealt) return;
        state.returned = (state.returned || 0) + dealt;
        burst(source, { colors: [this.color, '#4f7a34'], count: 10, gravity: 3 });
        logEvent(source.name + ' is cut by the Briar Blade’s thorns for ' + dealt + '.');
      });
    },
    status: (fighter, state) => (state.returned || 0) + ' returned'
  },

  pendulum: {
    name: 'Pendulum', weapon: 'twinFlail', icon: '∞', color: '#c79cff', trail: '#e2ccff',
    effect: 'Momentum: each landed hit in a row makes its swings 12% faster, up to +48%; a miss or block resets it',
    modifyAction(fighter, action, state) {
      action.tempo *= 1 + .12 * (state.stacks || 0);
    },
    onLanded(fighter, target, action, damage, state) {
      state.stacks = Math.min(4, (state.stacks || 0) + 1);
      if (state.stacks > 1) floatLabel(fighter, 'MOMENTUM ×' + state.stacks, this.color, { tag: '+' + state.stacks * 12 + '% SPEED' });
    },
    reset(fighter, state) {
      if ((state.stacks || 0) > 1) floatLabel(fighter, 'MOMENTUM LOST', '#a99cc0');
      state.stacks = 0;
    },
    onMissed(fighter, target, action, state) {
      this.reset(fighter, state);
    },
    onBlocked(fighter, target, action, state) {
      this.reset(fighter, state);
    },
    aura: (fighter, state) => state.stacks >= 4 ? '#c79cff' : null,
    status: (fighter, state) => '×' + (state.stacks || 0) + ' · +' + (state.stacks || 0) * 12 + '% speed'
  },

  headsmansVerdict: {
    name: 'Headsman’s Verdict', weapon: 'executioner', icon: '⚖', color: '#d9d2c0', trail: '#f0ead8',
    effect: 'Once per bout, when the target is below 25% health, the next swing is an unblockable execution that kills if it lands, with a beheading',
    modifyAction(fighter, action, state) {
      const target = action.defender;
      if (state.spent || target.hp >= target.maxHP * (forced.has('verdict') ? 1 : .25)) return;
      state.spent = true;
      action.execute = true;
      action.block = action.perfect = false;
      action.label = 'Execution';
      floatLabel(target, 'CONDEMNED', this.color, { tag: 'HEADSMAN’S VERDICT' });
      logEvent(fighter.name + ' raises the Headsman’s Verdict over ' + target.name + '.');
    },
    onLanded(fighter, target, action) {
      if (!action.execute || target.hp <= 0) return;
      ArenaEffects.shake(1);
      logEvent(fighter.name + ' carries out the verdict.');
      chipDamage(fighter, target, target.hp, { color: this.color, tag: 'EXECUTED', kind: 'special', action, zone: 'head' });
    },
    onMissed(fighter, target, action) {
      if (action.execute) floatLabel(target, 'SPARED', '#d8cbb8', { tag: 'THE VERDICT MISSED' });
    },
    status: (fighter, state) => state.spent ? 'spent' : 'target below 25% HP'
  }
};
