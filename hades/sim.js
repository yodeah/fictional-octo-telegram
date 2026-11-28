// The duel itself: movement, quick escapes, attacks, spells, blocking, stance and death.
// No DOM here. createDuel() returns a state that step() advances; everything the picture needs to
// react to is pushed to duel.events. A seed makes a bout repeatable.
(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.HadesData;
  const { weapons, shields, armors, spells, moves, kits, arena, switchCost } = D;

  const radius = .46;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const length = (x, y) => Math.hypot(x, y);
  const unit = (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const styleOf = f => weapons[f.weapon].style;

  // entry is a kit key, or { kit, weapon, reserve, armor } to change that kit's gear. A fighter who
  // picks up a staff without a spellbook of their own gets the Ember Priest's.
  function createFighter(index, entry, name, team = index, slot = 0, size = 1) {
    const { kit: kitKey, ...gear } = typeof entry === 'string' ? { kit: entry } : entry;
    const kit = { ...kits[kitKey] };
    for (const [slot, key] of Object.entries(gear)) if (key) kit[slot] = key;
    if (!kit.spells && [kit.weapon, kit.reserve].some(key => weapons[key].style === 'magic')) kit.spells = kits.emberpriest.spells;
    const move = moves[kit.move];
    // Teams start on opposite sides; teammates stand a little apart.
    const x = team ? 6 : -6, y = size > 1 ? (slot - (size - 1) / 2) * 3.2 : 0;
    return {
      index, team, name, kitKey, kit, weapon: kit.weapon, swapReady: 1.2, shots: 0, x, y, vx: 0, vy: 0, facing: team ? Math.PI : 0,
      target: null, retargetAt: 0,
      hp: kit.hp, maxHP: kit.hp, mana: 70, energy: 100, stance: 0, ward: 0, wardUntil: 0,
      shieldHits: shields[kit.shield].durability, move: kit.move, charges: move.charges, rechargeAt: 0,
      action: null, dash: null, readyAt: .5 + index * .12, stunnedUntil: 0, frozenUntil: 0, chilledUntil: 0,
      hastedUntil: 0, safeUntil: 0, detour: 0, fleetUntil: 0, hinderedUntil: 0, counterUntil: 0, riposte: false, lastStanceHit: -9, lastHurt: -9,
      cooldowns: {}, novaReady: 0, strafe: index ? 1 : -1, strafeUntil: 0, threatSeen: null, stride: 0, gait: 0,
      dead: false, dealt: 0, escapes: 0, nextClose: 0, kickReady: 2, bashReady: 2
    };
  }

  function createDuel(kitA, kitB, seed = Date.now(), names = ['Varro', 'Cassian']) {
    return createBattle([{ entry: kitA, team: 0, name: names[0] }, { entry: kitB, team: 1, name: names[1] }], seed);
  }

  // Any number of fighters on two teams: lineup is [{ entry, team, name }]. winner is a team.
  function createBattle(lineup, seed = Date.now()) {
    const size = team => lineup.filter(l => l.team === team).length;
    const slots = [0, 0];
    return {
      time: 0, seed, random: seeded(seed), winner: null, events: [], projectiles: [], nextId: 1,
      fighters: lineup.map((l, i) => createFighter(i, l.entry, l.name, l.team, slots[l.team]++, size(l.team)))
    };
  }

  const emit = (duel, type, data) => duel.events.push({ type, time: duel.time, ...data });
  const enemiesOf = (duel, f) => duel.fighters.filter(o => o.team !== f.team);
  const alliesOf = (duel, f) => duel.fighters.filter(o => o.team === f.team && o !== f && !o.dead);
  // The rival this fighter is dealing with: chosen by pickTarget, kept between choices.
  function other(duel, f) {
    const foes = enemiesOf(duel, f);
    if (foes.length === 1) return foes[0];
    if (!f.target || f.target.dead || duel.time >= f.retargetAt) {
      const alive = foes.filter(o => !o.dead);
      if (alive.length) f.target = pickTarget(duel, f, alive);
      else f.target ||= foes[0];
      f.retargetAt = duel.time + .5 + duel.random() * .3;
    }
    return f.target;
  }
  // For now, the nearest standing enemy.
  function pickTarget(duel, f, alive) {
    return alive.reduce((best, o) => dist(f, o) < dist(f, best) ? o : best);
  }
  const ownerTeam = (duel, p) => duel.fighters[p.owner].team;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const shieldUp = f => f.shieldHits > 0 && !weapons[f.weapon].twoHanded;
  const defense = f => 30 + armors[f.kit.armor].defense + (shieldUp(f) ? shields[f.kit.shield].defense : 0);
  const stanceLimit = f => 59 + defense(f) * .23;
  const mobility = (duel, f) => armors[f.kit.armor].mobility * (shieldUp(f) ? shields[f.kit.shield].mobility : 1)
    * (f.hastedUntil > duel.time ? 1.18 : 1) * (f.fleetUntil > duel.time ? 1.25 : 1)
    * (f.hinderedUntil > duel.time ? .62 : 1) * (f.chilledUntil > duel.time ? .66 : 1);
  const helpless = (duel, f) => f.dead || f.stunnedUntil > duel.time || f.frozenUntil > duel.time;
  // Long bouts turn into sudden death so two cautious fighters cannot circle forever.
  const frenzy = duel => 1 + Math.max(0, duel.time - 45) * .025;

  function lineOfSight(from, to, pad = .12) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len2 = dx * dx + dy * dy || 1;
    return arena.pillars.every(p => {
      const t = clamp(((p.x - from.x) * dx + (p.y - from.y) * dy) / len2, 0, 1);
      return Math.hypot(from.x + dx * t - p.x, from.y + dy * t - p.y) > p.r + pad;
    });
  }

  // Keeps a point on the floor and out of pillars. Returns true when it hit the outer wall.
  function constrain(body, r = radius) {
    let wall = false;
    const a = arena.a - r, b = arena.b - r;
    const d = Math.hypot(body.x / a, body.y / b);
    if (d > 1) { body.x /= d; body.y /= d; wall = true; }
    for (const p of arena.pillars) {
      const gap = Math.hypot(body.x - p.x, body.y - p.y), min = p.r + r;
      if (gap < min) {
        const [ux, uy] = unit(body.x - p.x, body.y - p.y);
        body.x = p.x + ux * min; body.y = p.y + uy * min;
        wall = true;
      }
    }
    return wall;
  }

  // How good a spot is to flee to: far from the rival, not pinned against the wall.
  function escapeScore(x, y, rival) {
    const spot = { x, y };
    constrain(spot);
    const edge = Math.hypot(spot.x / arena.a, spot.y / arena.b);
    return Math.hypot(spot.x - rival.x, spot.y - rival.y) - Math.max(0, edge - .62) * 7
      - Math.hypot(spot.x - x, spot.y - y) * .8;
  }

  function bestHeading(duel, f, rival, reach) {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const score = escapeScore(f.x + Math.cos(angle) * reach, f.y + Math.sin(angle) * reach, rival) + duel.random() * .8;
      if (score > bestScore) { bestScore = score; best = angle; }
    }
    return best;
  }

  function startDash(duel, f, angle, purpose) {
    const move = moves[f.move];
    if (f.charges < 1 || f.energy < move.energy || f.dash || helpless(duel, f)) return false;
    if (f.charges === move.charges) f.rechargeAt = duel.time + move.recharge;
    f.charges--;
    f.energy -= move.energy;
    if (purpose !== 'close') f.escapes++;
    // A dash cancels the fighter's own attack, windup or recovery.
    f.action = null;
    const from = { x: f.x, y: f.y };
    const dx = Math.cos(angle), dy = Math.sin(angle);
    f.safeUntil = duel.time + move.safe;
    // Getting away leaves a short burst of speed to open the gap.
    if (purpose === 'escape') f.fleetUntil = duel.time + 1.1;
    if (f.move === 'blink') {
      f.x += dx * move.distance; f.y += dy * move.distance;
      constrain(f);
      f.readyAt = Math.max(f.readyAt, duel.time + move.time);
      emit(duel, 'blink', { who: f.index, from, to: { x: f.x, y: f.y } });
      return true;
    }
    f.dash = { until: duel.time + move.time, vx: dx * move.distance / move.time, vy: dy * move.distance / move.time, kind: f.move };
    f.facing = angle;
    emit(duel, f.move, { who: f.index, from, angle });
    return true;
  }

  // ---- Attacks ----

  function supportScore(duel, f, spell) {
    const health = f.hp / f.maxHP;
    if (spell.heal) return health <= .62 ? 60 : 0;
    if (spell.absorb) return health <= .8 && !f.ward ? 34 : 0;
    if (spell.manaRestore) return f.mana <= 26 && health >= .45 ? 45 : 0;
    if (spell.energyRestore) return f.energy <= 45 && f.hastedUntil <= duel.time ? 30 : 0;
    return 0;
  }

  function pickSpell(duel, f, rival) {
    let best = 'spark', bestScore = spells.spark.damage;
    for (const key of f.kit.spells || []) {
      const spell = spells[key];
      if (f.mana < spell.cost || duel.time < (f.cooldowns[key] || 0)) continue;
      const support = supportScore(duel, f, spell);
      if (!support && !spell.damage) continue;
      const control = (spell.freeze && rival.frozenUntil <= duel.time ? 14 : 0) + (spell.chill && dist(f, rival) < 5 ? 5 : 0)
        + (spell.energyDrain && rival.energy > 30 ? 3 : 0) + (spell.lifesteal || 0) * (1 - f.hp / f.maxHP) * 20;
      const score = support || spell.damage + control + duel.random() * 5;
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }

  // Which of the two weapons suits this moment. Called between attacks.
  function pickWeapon(duel, f, rival) {
    const main = weapons[f.kit.weapon], spare = weapons[f.kit.reserve];
    const holdingSpare = f.weapon === f.kit.reserve;
    const d = dist(f, rival);
    if (main.style === 'melee' && spare.style !== 'melee') {
      // A couple of shots from range, then back to the blade.
      if (holdingSpare) return d < 3.2 || f.shots >= 2 ? f.kit.weapon : f.kit.reserve;
      const stuck = styleOf(rival) === 'melee' ? d > 5 && duel.random() < .4 : d > 4.5 && f.charges < 1;
      return stuck && lineOfSight(f, rival, .5) ? f.kit.reserve : f.kit.weapon;
    }
    if (main.style !== 'melee') {
      // Shooters and mages draw steel only when caught with no escape left.
      if (holdingSpare) return d > 3.3 || f.charges > 0 ? f.kit.weapon : f.kit.reserve;
      const novaFirst = main.style === 'magic' && duel.time >= f.novaReady;
      return d < 2.2 && f.charges < 1 && !novaFirst && styleOf(rival) === 'melee' ? f.kit.reserve : f.kit.weapon;
    }
    // Two melee weapons: a spear gives way to a sword up close, a maul when the arms are tired.
    if (main.shape === 'thrust') return d < (holdingSpare ? 2.1 : 1.45) ? f.kit.reserve : f.kit.weapon;
    if (rival.stunnedUntil > duel.time || rival.frozenUntil > duel.time) return f.kit.weapon;
    return f.energy < (holdingSpare ? 55 : 30) ? f.kit.reserve : f.kit.weapon;
  }

  function swapWeapon(duel, f, rival) {
    if (duel.time < f.swapReady || f.energy < switchCost) return false;
    const next = pickWeapon(duel, f, rival);
    if (next === f.weapon) return false;
    f.weapon = next;
    f.energy -= switchCost;
    f.shots = 0;
    f.swapReady = duel.time + 1.8;
    f.readyAt = duel.time + .22;
    emit(duel, 'swap', { who: f.index, weapon: next });
    return true;
  }

  function startAttack(duel, f, rival, kind = 'attack') {
    const weapon = weapons[f.weapon];
    const spellKey = kind === 'attack' && weapon.style === 'magic' ? pickSpell(duel, f, rival) : null;
    const spell = spells[spellKey];
    const bash = kind === 'bash', nova = kind === 'nova', kick = kind === 'kick';
    if (kick) return startKick(duel, f, rival);
    const cost = bash ? 14 : nova ? 8 : weapon.energy;
    const fatigue = clamp(f.energy / cost, 0, 1);
    const pace = (f.chilledUntil > duel.time ? 1.3 : 1) * (1.2 - .2 * fatigue);
    const windup = (bash ? .2 : nova ? .34 : spell ? .46 + (spell.cost > 30 ? .22 : 0) : weapon.windup) * pace;
    const recover = (bash ? .3 : nova ? .35 : weapon.recover) * pace;
    if (!spell) f.energy = Math.max(0, f.energy - cost);
    f.facing = Math.atan2(rival.y - f.y, rival.x - f.x);
    f.action = {
      id: duel.nextId++, kind, spellKey, weapon: f.weapon, shape: bash ? 'arc' : nova ? 'nova' : spell && !spell.damage ? 'self' : weapon.shape,
      reach: bash ? 1.6 : nova ? 2.4 : weapon.reach, spread: bash ? 1.2 : weapon.spread, radius: weapon.radius,
      t: 0, windup, active: .1, recover, hit: false, angle: f.facing, aimed: false, fatigue,
      riposte: bash && f.riposte && f.counterUntil > duel.time,
      name: bash ? 'Shield bash' : nova ? 'Arcane burst' : spell ? spell.name : weapon.name
    };
    if (bash) { f.riposte = false; f.counterUntil = 0; }
    if (spell) emit(duel, 'cast', { who: f.index, spell: spellKey });
  }

  // A front kick: quick, unblockable, light on damage but heavy on knockback, so it drives the rival
  // off a shield, out of reach of a blade or into the wall. It also knocks the wind out of them.
  const kickMove = { cost: 12, windup: .22, active: .1, recover: .34, reach: 1.45, spread: 1.1, damage: 6, stance: 30, push: 1.6, winded: 16 };
  function startKick(duel, f, rival) {
    const pace = (f.chilledUntil > duel.time ? 1.3 : 1);
    f.energy = Math.max(0, f.energy - kickMove.cost);
    f.kickReady = duel.time + 3.4;
    f.facing = Math.atan2(rival.y - f.y, rival.x - f.x);
    f.action = {
      id: duel.nextId++, kind: 'kick', weapon: f.weapon, shape: 'kick', reach: kickMove.reach, spread: kickMove.spread,
      t: 0, windup: kickMove.windup * pace, active: kickMove.active, recover: kickMove.recover * pace, hit: false, angle: f.facing,
      aimed: false, fatigue: 1, name: 'Kick'
    };
  }

  // A melee dash that ends beside the rival flows into a quicker, harder blow.
  function dashStrike(duel, f, rival) {
    const weapon = weapons[f.weapon];
    if (weapon.style !== 'melee') return;
    if (helpless(duel, f) || rival.dead || f.energy < weapon.energy * .45
      || dist(f, rival) > weapon.reach + (weapon.shape === 'slam' ? .6 : .9)) return;
    startAttack(duel, f, rival);
    f.action.windup *= .5;
    f.action.power = 1.2;
    f.action.name = 'Dash-strike';
    emit(duel, 'dashstrike', { who: f.index });
  }

  // Whether the attack's current shape covers a body at this spot.
  function covers(f, action, target, pad = radius) {
    const dx = target.x - f.x, dy = target.y - f.y, d = Math.hypot(dx, dy);
    if (action.shape === 'nova') return d <= action.reach + pad;
    if (action.shape === 'slam') {
      return Math.hypot(target.x - f.x - Math.cos(action.angle) * action.reach,
        target.y - f.y - Math.sin(action.angle) * action.reach) <= action.radius + pad * .5;
    }
    if (d > action.reach + pad) return false;
    return d < radius * 1.6 || Math.abs(angleDiff(Math.atan2(dy, dx), action.angle)) <= action.spread / 2 + pad / Math.max(d, 1) * .6;
  }

  function release(duel, f, action) {
    const rival = other(duel, f);
    const weapon = weapons[action.weapon];
    const spell = spells[action.spellKey];
    if (spell) {
      f.mana -= spell.cost;
      if (spell.cooldown) f.cooldowns[action.spellKey] = duel.time + spell.cooldown;
    }
    if (action.shape === 'self') return applySupport(duel, f, spell);
    if (action.shape === 'bolt') {
      const speed = spell?.speed || weapon.speed;
      const jitter = spell ? .025 : weapon.style === 'ranged' ? (dist(f, rival) < 2.6 ? .2 : .05) : .05;
      const angle = action.angle + (duel.random() - .5) * jitter * 2;
      duel.projectiles.push({
        id: duel.nextId++, owner: f.index, x: f.x + Math.cos(angle) * .7, y: f.y + Math.sin(angle) * .7,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: weapon.reach / speed + .25,
        spellKey: action.spellKey, weapon: action.weapon, fatigue: action.fatigue,
        homing: spell ? .9 : 0, crowded: !spell && dist(f, rival) < 2.6, target: rival.index
      });
      if (!spell) f.shots++;
      emit(duel, 'shoot', { who: f.index, spell: action.spellKey });
      return;
    }
    emit(duel, 'swing', { who: f.index, shape: action.shape, angle: action.angle, reach: action.reach, spread: action.spread, radius: action.radius, heavy: weapon.heavy });
  }

  function applySupport(duel, f, spell) {
    let text;
    if (spell.heal) {
      const amount = Math.min(Math.round(spell.heal * armors[f.kit.armor].power * 1.2), f.maxHP - f.hp);
      f.hp += amount;
      text = '+' + amount;
    } else if (spell.absorb) {
      f.ward = Math.round(spell.absorb * 1.3);
      f.wardUntil = duel.time + spell.duration;
      f.wardColor = spell.color;
      text = 'WARDED';
    } else if (spell.manaRestore) {
      f.mana = Math.min(100, f.mana + spell.manaRestore);
      f.hp = Math.max(1, f.hp - spell.hpCost);
      text = '+MANA';
    } else {
      f.energy = Math.min(100, f.energy + spell.energyRestore);
      f.hastedUntil = duel.time + spell.haste;
      text = 'TAILWIND';
    }
    emit(duel, 'support', { who: f.index, color: spell.color, text, name: spell.name });
  }

  // ---- Damage ----

  function breakStance(duel, f, duration) {
    f.stance = 0;
    f.action = null;
    f.stunnedUntil = duel.time + duration;
    f.readyAt = f.stunnedUntil + .08;
    emit(duel, 'stagger', { who: f.index });
  }

  function addStance(duel, f, amount) {
    if (f.stunnedUntil > duel.time || f.dead) return;
    f.stance += amount;
    f.lastStanceHit = duel.time;
    if (f.stance >= stanceLimit(f)) breakStance(duel, f, 1.05);
  }

  // Resolves one blow. dir is the direction it travels, used for blocking, knockback and blood.
  function strike(duel, attacker, defender, hit) {
    if (defender.dead || attacker.dead && !hit.projectile) return 'none';
    const facingBlow = Math.abs(angleDiff(defender.facing, Math.atan2(-hit.dirY, -hit.dirX))) < 1.25;
    const guard = shields[defender.kit.shield];
    const busy = defender.action && (defender.action.t < defender.action.windup + defender.action.active || defender.action.kind !== 'attack');
    if (shieldUp(defender) && facingBlow && !busy && !defender.dash && !helpless(duel, defender)
      && defender.energy >= guard.energy && !hit.unblockable && duel.random() < hit.block + guard.block) {
      return blocked(duel, attacker, defender, hit);
    }
    const armor = armors[defender.kit.armor];
    const absorption = hit.style === 'magic' ? 1 : 1 - Math.max(0, defense(defender) - 45) / 275;
    const rear = Math.abs(angleDiff(defender.facing, Math.atan2(hit.dirY, hit.dirX))) < .9;
    const critical = rear || duel.random() < .09;
    let damage = Math.max(1, Math.round((hit.damage + duel.random() * 4) * armor.taken[hit.style] * absorption
      * (armors[attacker.kit.armor].style === hit.style ? armors[attacker.kit.armor].power : 1)
      * (critical ? 1.28 : 1) * (defender.stunnedUntil > duel.time ? 1.15 : 1) * frenzy(duel)));
    const warded = Math.min(defender.ward, damage);
    defender.ward -= warded;
    damage = Math.min(damage - warded, defender.hp);
    defender.hp -= damage;
    defender.lastHurt = duel.time;
    attacker.dealt += damage;
    const spell = spells[hit.spellKey];
    emit(duel, 'hit', {
      who: defender.index, by: attacker.index, damage, warded, critical, rear, style: hit.style, color: spell?.color,
      dirX: hit.dirX, dirY: hit.dirY, heavy: hit.heavy, kick: hit.kick, x: defender.x, y: defender.y
    });
    if (spell && damage) {
      if (spell.chill) defender.chilledUntil = duel.time + spell.chill;
      if (spell.freeze) {
        defender.frozenUntil = duel.time + spell.freeze;
        defender.action = null;
        defender.dash = null;
        emit(duel, 'freeze', { who: defender.index });
      }
      if (spell.lifesteal) {
        const healed = Math.min(Math.round(damage * spell.lifesteal), attacker.maxHP - attacker.hp);
        if (healed > 0 && !attacker.dead) { attacker.hp += healed; emit(duel, 'heal', { who: attacker.index, amount: healed }); }
      }
      if (spell.energyDrain) defender.energy = Math.max(0, defender.energy - spell.energyDrain);
    }
    if (hit.winded) defender.energy = Math.max(0, defender.energy - hit.winded);
    // Bashes and kicks knock a windup out of the rival's hands.
    const busyWith = defender.action;
    if (hit.interrupt && busyWith && busyWith.t < busyWith.windup && !defender.dead) {
      defender.action = null;
      defender.readyAt = Math.max(defender.readyAt, duel.time + .3);
      emit(duel, 'interrupt', { who: defender.index, name: busyWith.name });
    }
    // A heavy weapon moves the body in the direction of the blow.
    const push = hit.push || (hit.heavy ? 1.5 : hit.style === 'melee' ? .45 : .18);
    if (hit.hinder && damage) defender.hinderedUntil = duel.time + hit.hinder;
    defender.vx += hit.dirX * push * 7;
    defender.vy += hit.dirY * push * 7;
    if (defender.hp <= 0) {
      defender.dead = true;
      defender.action = null;
      defender.dash = null;
      if (duel.winner === null && !duel.fighters.some(o => o.team === defender.team && !o.dead)) duel.winner = attacker.team;
      emit(duel, 'death', { who: defender.index, by: attacker.index, dirX: hit.dirX, dirY: hit.dirY, heavy: hit.heavy, style: hit.style });
      return 'kill';
    }
    addStance(duel, defender, hit.stance * (critical ? 1.2 : 1) * (damage ? 1 : .35));
    if (push > 1) defender.slamming = duel.time + .35;
    return 'hit';
  }

  function blocked(duel, attacker, defender, hit) {
    const guard = shields[defender.kit.shield];
    defender.energy -= guard.energy;
    const perfect = !hit.projectile && duel.random() < .34;
    defender.counterUntil = duel.time + (perfect ? .9 : .55);
    defender.riposte = perfect;
    if (!defender.action) defender.readyAt = Math.min(defender.readyAt, duel.time + .08);
    emit(duel, 'block', { who: defender.index, perfect, x: defender.x - hit.dirX * .6, y: defender.y - hit.dirY * .6, dirX: hit.dirX, dirY: hit.dirY });
    defender.vx += hit.dirX * (hit.heavy ? 4 : 2);
    defender.vy += hit.dirY * (hit.heavy ? 4 : 2);
    if (hit.breaks && --defender.shieldHits === 0) emit(duel, 'shieldbreak', { who: defender.index });
    addStance(duel, defender, hit.stance * (perfect ? .2 : .5));
    if (perfect && attacker.action) attacker.action.recover += .35;
    return 'block';
  }

  // A blow lands on every enemy it covers, once each.
  function meleeContact(duel, f, action) {
    for (const rival of enemiesOf(duel, f)) {
      action.struck ||= new Set();
      if (action.struck.has(rival.index) || rival.dead || rival.safeUntil > duel.time || !covers(f, action, rival)) continue;
      if (!lineOfSight(f, rival, 0)) continue;
      action.struck.add(rival.index);
      action.hit = true;
      landBlow(duel, f, action, rival);
      if (action.kind === 'kick' || action.kind === 'bash') return;
    }
  }

  function landBlow(duel, f, action, rival) {
    const weapon = weapons[action.weapon];
    const bash = action.kind === 'bash', nova = action.kind === 'nova';
    const [dirX, dirY] = unit(rival.x - f.x, rival.y - f.y);
    if (action.kind === 'kick') {
      return void strike(duel, f, rival, {
        damage: kickMove.damage, style: 'melee', stance: kickMove.stance, block: 0, unblockable: true, push: kickMove.push,
        winded: kickMove.winded, interrupt: true, kick: true, dirX, dirY
      });
    }
    strike(duel, f, rival, {
      interrupt: bash,
      damage: bash ? 7 * (action.riposte ? 1.5 : 1) : nova ? 6 : weapon.damage * (.7 + .3 * action.fatigue) * (action.power || 1),
      style: nova ? 'magic' : 'melee', stance: bash ? 44 : nova ? 18 : weapon.stance,
      block: bash ? .05 : weapon.block, heavy: !bash && !nova && weapon.heavy, breaks: !bash && !nova && weapon.breaks,
      push: nova ? 1.9 : action.riposte ? 1.7 : bash ? 1.1 : 0, unblockable: nova, dirX, dirY,
      hinder: bash || nova ? 0 : weapon.hinder, winded: bash || nova ? 0 : weapon.winded
    });
  }

  function stepProjectiles(duel, dt) {
    for (const p of duel.projectiles) {
      const owner = duel.fighters[p.owner], target = duel.fighters[p.target ?? 1 - p.owner];
      const spell = spells[p.spellKey];
      if (p.homing && !target.dead) {
        const speed = Math.hypot(p.vx, p.vy), heading = Math.atan2(p.vy, p.vx);
        const turn = clamp(angleDiff(Math.atan2(target.y - p.y, target.x - p.x), heading), -p.homing * dt, p.homing * dt);
        p.vx = Math.cos(heading + turn) * speed; p.vy = Math.sin(heading + turn) * speed;
      }
      p.life -= dt;
      // A shot that slips past the target close by counts as a dodge.
      if (!p.passed && !target.dead) {
        const speed = Math.hypot(p.vx, p.vy), dx = target.x - p.x, dy = target.y - p.y;
        if ((dx * p.vx + dy * p.vy) / speed < -radius && Math.abs(dx * p.vy - dy * p.vx) / speed < 1.4) {
          p.passed = true;
          emit(duel, 'dodge', { who: target.index });
        }
      }
      const steps = Math.ceil(Math.hypot(p.vx, p.vy) * dt / .3);
      for (let i = 0; i < steps && p.life > 0; i++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        const pillar = arena.pillars.some(q => Math.hypot(p.x - q.x, p.y - q.y) < q.r);
        if (pillar || Math.hypot(p.x / arena.a, p.y / arena.b) > 1.06) {
          p.life = 0;
          emit(duel, 'fizzle', { x: p.x, y: p.y, color: spell?.color });
        } else {
          const struck = duel.fighters.find(o => o.team !== owner.team && !o.dead && o.safeUntil <= duel.time
            && Math.hypot(p.x - o.x, p.y - o.y) < radius + .1);
          if (!struck) continue;
          p.life = 0;
          const weapon = weapons[p.weapon];
          const [dirX, dirY] = unit(p.vx, p.vy);
          strike(duel, owner, struck, {
            damage: spell ? spell.damage * weapon.spellPower * 1.04 : weapon.damage * (.7 + .3 * p.fatigue) * (p.crowded ? .6 : 1),
            style: spell ? 'magic' : weapon.style, spellKey: p.spellKey, stance: spell ? 13 : weapon.stance,
            block: spell ? .06 : weapon.block * .5, push: spell ? 0 : weapon.push, hinder: spell ? 0 : weapon.hinder,
            projectile: true, dirX, dirY
          });
        }
      }
    }
    duel.projectiles = duel.projectiles.filter(p => p.life > 0);
  }

  // ---- Decisions ----

  // Something about to hit this fighter, identified so each threat is judged only once.
  function threatTo(duel, f) {
    for (const foe of enemiesOf(duel, f)) {
      const a = foe.action;
      if (!foe.dead && a && !a.hit && a.t < a.windup && a.windup - a.t < .24 && a.shape !== 'bolt' && a.shape !== 'self' && covers(foe, a, f, radius + .15)) {
        return { id: a.id, angle: Math.atan2(f.y - foe.y, f.x - foe.x), weight: weapons[a.weapon].heavy ? 1.5 : 1 };
      }
    }
    for (const p of duel.projectiles) {
      if (ownerTeam(duel, p) === f.team) continue;
      const dx = f.x - p.x, dy = f.y - p.y, speed = Math.hypot(p.vx, p.vy);
      const along = (dx * p.vx + dy * p.vy) / speed;
      if (along > 0 && along / speed < .32 && Math.abs(dx * p.vy - dy * p.vx) / speed < .8) {
        return { id: p.id, angle: Math.atan2(p.vy, p.vx), weight: spells[p.spellKey]?.freeze ? 1.6 : 1 };
      }
    }
    return null;
  }

  function tryEvade(duel, f, rival) {
    const threat = threatTo(duel, f);
    if (!threat || f.threatSeen === threat.id) return false;
    f.threatSeen = threat.id;
    const move = moves[f.move];
    const nerve = (f.kit.champion ? .5 : f.move === 'dash' ? .3 : .34) * threat.weight;
    if (duel.random() > nerve || f.charges < 1) return false;
    const side = duel.random() < .5 ? 1 : -1;
    const angle = f.move === 'dash' ? threat.angle + side * Math.PI / 2 : bestHeading(duel, f, rival, move.distance);
    return startDash(duel, f, angle, 'evade');
  }

  // Heading toward the rival that goes around whichever pillar is in the way.
  function route(f, rival) {
    const dx = rival.x - f.x, dy = rival.y - f.y;
    const len2 = dx * dx + dy * dy || 1;
    let nearest = null, nearestT = 2;
    for (const p of arena.pillars) {
      const t = clamp(((p.x - f.x) * dx + (p.y - f.y) * dy) / len2, 0, 1);
      if (t < nearestT && Math.hypot(f.x + dx * t - p.x, f.y + dy * t - p.y) < p.r + radius + .1) {
        nearest = p; nearestT = t;
      }
    }
    if (!nearest) { f.detour = 0; return unit(dx, dy); }
    // Pick a side once and keep it until the way is clear, so the walker never dithers.
    f.detour ||= Math.sign(dx * (nearest.y - f.y) - dy * (nearest.x - f.x)) || f.strafe;
    const away = Math.atan2(f.y - nearest.y, f.x - nearest.x);
    const around = away + f.detour * .9;
    const reach = nearest.r + radius + .35;
    return unit(nearest.x + Math.cos(around) * reach - f.x, nearest.y + Math.sin(around) * reach - f.y);
  }

  // Champions read incoming shots. A bolt or spell already in the air is sidestepped off its line.
  // Against a shot still being aimed they walk one way while the aim tracks them, then cut back the
  // other way once it locks, so the lead it took sends the shot wide. Returns a heading or null.
  function juke(duel, f, rival) {
    for (const p of duel.projectiles) {
      if (ownerTeam(duel, p) === f.team) continue;
      const dx = f.x - p.x, dy = f.y - p.y, speed = Math.hypot(p.vx, p.vy);
      const ahead = (dx * p.vx + dy * p.vy) / speed;
      const off = (dx * p.vy - dy * p.vx) / speed;
      if (ahead > -.2 && ahead / speed < .75 && Math.abs(off) < radius + .5) {
        const side = Math.sign(off) || f.strafe;
        return [p.vy / speed * side, -p.vx / speed * side];
      }
    }
    const a = rival.action;
    if (!a || a.shape !== 'bolt' || a.t >= a.windup || a.windup - a.t > .5 || !lineOfSight(rival, f)) return null;
    if (f.jukeFor !== a.id) {
      f.jukeFor = a.id;
      f.jukeSide = duel.random() < .5 ? 1 : -1;
    }
    const [tx, ty] = unit(f.x - rival.x, f.y - rival.y);
    const locked = a.t >= a.windup * .85;
    const side = f.jukeSide * (locked ? -1 : 1);
    // Keep away from the wall when choosing a side.
    const edge = Math.hypot((f.x - ty * side * 1.5) / arena.a, (f.y + tx * side * 1.5) / arena.b);
    if (edge > .9) f.jukeSide *= -1;
    return [-ty * f.jukeSide * (locked ? -1 : 1), tx * f.jukeSide * (locked ? -1 : 1)];
  }

  // Desired walking direction, as a unit vector scaled by 0..1.
  function steer(duel, f, rival) {
    const d = dist(f, rival);
    let [tx, ty] = unit(rival.x - f.x, rival.y - f.y);
    const weapon = weapons[f.weapon];
    const smart = f.kit.champion;
    let x = 0, y = 0;
    if (duel.time > f.strafeUntil) {
      // A champion closing on a shooter weaves in shorter, sharper zigzags.
      const weave = smart && weapon.style === 'melee' && styleOf(rival) !== 'melee';
      f.strafeUntil = duel.time + (weave ? .45 + duel.random() * .45 : .8 + duel.random() * 1.4);
      if (weave || duel.random() < .5) f.strafe *= -1;
    }
    if (smart) {
      const dodge = juke(duel, f, rival);
      if (dodge) return dodge;
    }
    const sight = lineOfSight(f, rival, radius * .8);
    if (!sight) return route(f, rival);
    f.detour = 0;
    if (weapon.style === 'melee') {
      const want = weapon.shape === 'slam' ? weapon.reach : weapon.reach * .78;
      if (smart && d > want + .5) {
        // Run at where the rival is going, from the middle of the floor, to pin them against the wall.
        const lead = Math.min(.8, d / f.kit.speed * .5);
        const [cx, cy] = unit(-rival.x, -rival.y);
        const pin = Math.min(1.2, d * .2) * Math.min(1, Math.hypot(rival.x / arena.a, rival.y / arena.b) * 1.6);
        [tx, ty] = unit(rival.x + rival.vx * lead + cx * pin - f.x, rival.y + rival.vy * lead + cy * pin - f.y);
      }
      if (d > want) { x = tx; y = ty; }
      else if (d < want * .6) { x = -tx * .5; y = -ty * .5; }
      // Circle in close, and come at shooters on a slight curve.
      const side = d < weapon.reach + 1.2 ? .45 : styleOf(rival) !== 'melee' ? .3 : .1;
      x += -ty * f.strafe * side; y += tx * f.strafe * side;
    } else {
      const near = 4.4, far = 6.6;
      if (d < near) {
        const away = bestHeading(duel, f, rival, 2.2);
        x = Math.cos(away); y = Math.sin(away);
      } else if (d > far) { x = tx; y = ty; }
      else { x = -ty * f.strafe * .6; y = tx * f.strafe * .6; }
    }
    const edge = Math.hypot(f.x / arena.a, f.y / arena.b);
    if (edge > .82) { x -= f.x / arena.a * (edge - .82) * 5; y -= f.y / arena.b * (edge - .82) * 5; }
    const size = Math.hypot(x, y);
    return size > 1 ? [x / size, y / size] : [x, y];
  }

  function decide(duel, f, rival) {
    if (rival.dead) return;
    const d = dist(f, rival);
    if (tryEvade(duel, f, rival)) return;
    if (f.dash) return;
    if (!f.action && f.readyAt <= duel.time && swapWeapon(duel, f, rival)) return;
    const weapon = weapons[f.weapon];
    const free = !f.action && f.readyAt <= duel.time;
    // A block opens a quick bash, even while recovering.
    const canBash = shieldUp(f) && f.energy >= 14 && f.counterUntil > duel.time && d < 1.8
      && (!f.action || f.action.t > f.action.windup + f.action.active);
    if (canBash && (f.riposte || duel.random() < .08)) return startAttack(duel, f, rival, 'bash');
    if (free && d < 1.75 && !rival.dead && lineOfSight(f, rival, 0) && closeMove(duel, f, rival, d)) return;

    if (weapon.style !== 'melee') {
      const meleeRival = styleOf(rival) === 'melee';
      // Get out when crowded: roll or blink to the most open spot.
      if (meleeRival && d < 2.7 && f.charges > 0 && (!f.action || f.action.t > f.action.windup * .4 || d < 1.9)) {
        if (startDash(duel, f, bestHeading(duel, f, rival, moves[f.move].distance), 'escape')) return;
      }
      if (weapon.style === 'magic' && d < 2.2 && free && duel.time >= f.novaReady && f.charges < 1) {
        f.novaReady = duel.time + 8;
        return startAttack(duel, f, rival, 'nova');
      }
      if (!free) return;
      const support = f.kit.spells?.some(key => !spells[key].damage && f.mana >= spells[key].cost
        && duel.time >= (f.cooldowns[key] || 0) && supportScore(duel, f, spells[key]) > 0);
      if (support && d > 3 || d <= weapon.reach && lineOfSight(f, rival) && !(d < 2.4 && duel.random() < .6)) {
        startAttack(duel, f, rival);
      }
      return;
    }
    // A champion bursts in on an opening: a shooter still recovering from a shot, out of escapes or
    // staggered, or anyone staggered within reach of a dash.
    if (f.kit.champion && free && f.charges > 0 && duel.time >= f.nextClose && d > 2.6 && d < 6.8 && lineOfSight(f, rival, .5)) {
      const ra = rival.action;
      const staggered = rival.stunnedUntil > duel.time + .25 || rival.frozenUntil > duel.time + .25;
      const opening = staggered || styleOf(rival) !== 'melee'
        && (ra && ra.t > ra.windup + ra.active || rival.charges < 1 || rival.readyAt > duel.time + .25);
      if (opening) {
        f.nextClose = duel.time + 2;
        const lead = d / (moves[f.move].distance / moves[f.move].time) * 1.2;
        return void startDash(duel, f, Math.atan2(rival.y + rival.vy * lead - f.y, rival.x + rival.vx * lead - f.x), 'close');
      }
    }
    // Melee: burst across the gap at a shooter, otherwise walk in.
    if (free && f.charges > (styleOf(rival) === 'melee' ? 1 : 0) && duel.time >= f.nextClose && d > 3.4 && d < 8 && lineOfSight(f, rival, .5)
      && duel.random() < (styleOf(rival) === 'melee' ? .008 : .035)) {
      f.nextClose = duel.time + 3.2;
      return void startDash(duel, f, Math.atan2(rival.y - f.y, rival.x - f.x), 'close');
    }
    const inReach = weapon.shape === 'slam'
      ? Math.abs(d - weapon.reach) < weapon.radius * .8 : d <= weapon.reach + radius * .3;
    if (free && inReach && f.energy >= weapon.energy * .45) startAttack(duel, f, rival);
  }

  // Up close a fighter may bash with the shield or kick instead of swinging. Champions pick their
  // moments: a bash to break a windup, a kick to send a rival into the wall, off a raised shield or,
  // for the archer, away to make room to shoot.
  function closeMove(duel, f, rival, d) {
    const smart = f.kit.champion;
    const ra = rival.action;
    const winding = ra && ra.t < ra.windup && ra.windup - ra.t > .14;
    if (shieldUp(f) && duel.time >= f.bashReady && f.energy >= 14 && d < 1.6) {
      const want = winding ? (smart ? .85 : .3) : smart && rival.stance > stanceLimit(rival) * .55 ? .3 : smart ? .08 : .01;
      if (duel.random() < want) {
        f.bashReady = duel.time + 2.6;
        startAttack(duel, f, rival, 'bash');
        emit(duel, 'bash', { who: f.index });
        return true;
      }
    }
    if (duel.time < f.kickReady || f.energy < kickMove.cost || d > kickMove.reach + radius * .4) return false;
    const [ux, uy] = unit(rival.x - f.x, rival.y - f.y);
    const behind = { x: rival.x + ux * 1.6, y: rival.y + uy * 1.6 };
    const wallBehind = Math.hypot(behind.x / arena.a, behind.y / arena.b) > .97 || !lineOfSight(rival, behind, radius);
    const ranged = styleOf(f) !== 'melee';
    let want = .008;
    if (smart) {
      if (wallBehind) want = .6;
      else if (ranged) want = f.charges < 1 ? .7 : .3;
      else if (shieldUp(rival) && rival.counterUntil <= duel.time) want = .35;
      else if (winding) want = .5;
      else want = .12;
    } else if (wallBehind) want = .1;
    if (duel.random() >= want) return false;
    startKick(duel, f, rival);
    emit(duel, 'kick', { who: f.index });
    return true;
  }

  function stepFighter(duel, f, dt) {
    const rival = other(duel, f);
    const kit = f.kit, move = moves[f.move];
    if (!f.dead) {
      f.mana = Math.min(100, f.mana + dt * (weapons[kit.weapon].style === 'magic' ? 6 : 3));
      f.energy = clamp(f.energy + dt * 11, 0, 100);
      if (f.charges < move.charges && duel.time >= f.rechargeAt) {
        f.charges++;
        f.rechargeAt = duel.time + move.recharge;
      }
      if (f.wardUntil <= duel.time) f.ward = 0;
      if (duel.time - f.lastStanceHit > 1.3) f.stance = Math.max(0, f.stance - dt * 14);
    }
    const fromX = f.x, fromY = f.y;
    const frozen = f.frozenUntil > duel.time;
    if (!frozen && !f.dead && f.stunnedUntil <= duel.time) decide(duel, f, rival);

    const a = f.action;
    if (a && !helpless(duel, f)) {
      // The aim tracks the rival early in the windup, then locks so a dash can beat it.
      if (a.t < a.windup * (a.shape === 'bolt' ? .85 : .55)) {
        let aim = Math.atan2(rival.y - f.y, rival.x - f.x);
        if (a.shape === 'bolt') {
          const lead = dist(f, rival) / (spells[a.spellKey]?.speed || weapons[a.weapon].speed) * .6;
          aim = Math.atan2(rival.y + rival.vy * lead - f.y, rival.x + rival.vx * lead - f.x);
        }
        f.facing += clamp(angleDiff(aim, f.facing), -9 * dt, 9 * dt);
        a.angle = f.facing;
      }
      const before = a.t;
      a.t += dt;
      if (before < a.windup && a.t >= a.windup) release(duel, f, a);
      if (a.t >= a.windup && a.t < a.windup + a.active && !['bolt', 'self'].includes(a.shape)) meleeContact(duel, f, a);
      if (f.action === a && a.t >= a.windup + a.active + a.recover) {
        f.action = null;
        f.readyAt = duel.time + .05 + duel.random() * (f.energy < 20 ? .5 : .22);
      }
    } else if (!f.dead && !frozen && f.stunnedUntil <= duel.time) {
      f.facing += clamp(angleDiff(Math.atan2(rival.y - f.y, rival.x - f.x), f.facing), -10 * dt, 10 * dt);
    }

    // vx/vy is walking velocity plus any knockback; both ease out together.
    if (f.dash) {
      f.x += f.dash.vx * dt; f.y += f.dash.vy * dt;
      f.vx = f.dash.vx * .2; f.vy = f.dash.vy * .2;
      if (duel.time >= f.dash.until) {
        const kind = f.dash.kind;
        f.dash = null;
        if (kind === 'dash') dashStrike(duel, f, rival);
      }
    } else {
      let wantX = 0, wantY = 0;
      if (!helpless(duel, f) && !rival.dead) {
        const [sx, sy] = steer(duel, f, rival);
        let factor = kit.speed * mobility(duel, f);
        const now = f.action;
        if (now) factor *= now.shape === 'bolt' || now.shape === 'self' ? .34 : now.t < now.windup ? .55 : .15;
        wantX = sx * factor; wantY = sy * factor;
      }
      const grip = 1 - Math.exp(-dt * (f.dead ? 5 : 10));
      f.vx += (wantX - f.vx) * grip;
      f.vy += (wantY - f.vy) * grip;
      if (frozen) f.vx = f.vy = 0;
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    if (constrain(f) && f.slamming > duel.time && !f.dead) {
      f.slamming = 0;
      breakStance(duel, f, 1.1);
      emit(duel, 'wallslam', { who: f.index, x: f.x, y: f.y });
    }
    const walked = Math.hypot(f.x - fromX, f.y - fromY);
    f.stride += walked;
    f.gait += (clamp(walked / dt / 3.5, 0, 1) - f.gait) * Math.min(1, dt * 12);
  }

  function separate(duel) {
    const all = duel.fighters;
    for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) {
      const a = all[i], b = all[k];
      if (a.dead || b.dead || a.dash || b.dash) continue;
      const gap = dist(a, b), min = radius * 2;
      if (gap < min) {
        const [x, y] = unit(a.x - b.x || 1, a.y - b.y);
        const push = (min - gap) / 2;
        a.x += x * push; a.y += y * push; b.x -= x * push; b.y -= y * push;
        constrain(a); constrain(b);
      }
    }
  }

  function step(duel, dt) {
    duel.time += dt;
    // Rotate who acts first so no one wins ties.
    const n = duel.fighters.length, first = (Math.floor(duel.time * 60) + 1) % n;
    for (let k = 0; k < n; k++) stepFighter(duel, duel.fighters[(first + k) % n], dt);
    separate(duel);
    stepProjectiles(duel, dt);
  }

  const api = { createDuel, createBattle, step, radius, stanceLimit };
  if (typeof module !== 'undefined') module.exports = api;
  else root.HadesSim = api;
})(this);
