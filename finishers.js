'use strict';

// Cosmetic finishers on the killing blow, chosen by weapon and hit zone. finishBout has already
// decided the winner when one starts, and a finisher only moves the loser's ragdoll and changes
// drawing, so it can never change who wins. Like effects.js, nothing here calls Math.random.
// Testing: ?force=behead (or impale, crumple, lastCast, shatter, pin) uses that finisher on every kill,
// and ?force=lodged on every sword or rapier kill (sandbox.html?cast=3&force=lodged shows it).
let finisher = null;

const finisherTypes = {
  behead: { name: 'BEHEADED', verb: 'beheads', color: '#ffb0a0' },
  impale: { name: 'RUN THROUGH', verb: 'runs through', color: '#ffd0ba' },
  lastCast: { name: 'LAST CAST', verb: 'pins', color: '#f2bd91' },
  crumple: { name: 'CRUMPLED', verb: 'flattens', color: '#e0a060' },
  shatter: { name: 'SHATTERED', verb: 'shatters', color: '#cfefff' },
  pin: { name: 'PINNED', verb: 'pins', color: '#fae3ac' },
  lodged: { name: 'LODGED BLADE', verb: 'leaves the blade in', color: '#ffd0ba' }
};

function chooseFinisher(attacker, defender, zone, action) {
  const bladed = action?.style === 'melee' && !action.bash && !action.kick && ['sword', 'rapier'].includes(action.key);
  const pick = Object.keys(finisherTypes).find(type => forced.has(type) && (type !== 'lodged' || bladed));
  if (pick) return pick;
  if (forced.has('launch')) return 'crumple'; // Older preview links.
  if (action?.execute) return 'behead';
  const key = action?.key;
  const iced = action?.spell?.ice || (key && specialOf(attacker, key) === specials.wintersBite)
    || (defender.frozenUntil > elapsed && defender.rootedUntil <= elapsed);
  if (iced) return 'shatter';
  if (!action || action.bash || action.kick || action.spell || !key) return null;
  if (action.style === 'ranged') return 'pin';
  // Presentation rolls stay independent of the fight's random sequence.
  const rare = () => crypto.getRandomValues(new Uint8Array(1))[0] < 32;
  if (key === 'spear' && Math.abs(attacker.x - defender.x) >= 1.8 && rare()) return 'lastCast';
  if (zone === 'head' && meleeType(key) === 1 && rare()) return 'behead';
  if (bladed && zone === 'body' && rare()) return 'lodged';
  if (key === 'rapier' && zone === 'body') return 'impale';
  if (weaponFamily(key) === 'maul') return 'crumple';
  return null;
}

// The weapon tip in world space, from a pose of the fighter holding it.
function weaponTip(fighter, pose, along = 1) {
  const hand = pose.joints.weaponHand;
  const reach = point => Math.hypot(point[0] - hand[0], point[1] - hand[1]);
  const tip = weaponSegments(fighter, pose).flatMap(([from, to]) => [from, to])
    .reduce((far, point) => reach(point) > reach(far) ? point : far, hand);
  return worldPoint(fighter, pointBetween(hand, tip, along));
}

const toLocal = (fighter, [x, y, z]) => [(x - fighter.x) * fighter.direction, y, z - fighter.z];

// Called by finishBout right after the ragdoll is made. Returns extra seconds before an auto-rematch.
function startFinisher(attacker, defender, zone, action) {
  const type = chooseFinisher(attacker, defender, zone, action);
  finisher = null;
  if (!type) return 0;
  const ragdoll = defender.ragdoll;
  const { nodes } = ragdoll;
  const all = Object.values(nodes);
  finisher = { type, attacker, defender, clock: 0, tick: 0 };
  if (type === 'behead') {
    ragdoll.links = ragdoll.links.filter(([a, b]) => a !== nodes.head && b !== nodes.head);
    nodes.head.speed = [-2.1, 3.6, .25];
    ragdoll.pose.severed = true;
    ragdoll.pose.headSpin = 0;
    finisher.spin = -10;
  } else if (type === 'crumple') {
    const room = clamp(3.8 + defender.direction * defender.x, 0, 1);
    for (const node of all) {
      const height = node.point[1];
      node.speed = [-height * room * 1.45, -height * 1.8, node.speed[2] * .3];
    }
  } else if (type === 'lastCast') {
    finisher.held = displayPose(attacker);
    for (const node of all) node.speed = [-node.point[1] * .75, 0, 0];
  } else if (type === 'impale') {
    finisher.held = displayPose(attacker);
    finisher.tip = toLocal(defender, weaponTip(attacker, finisher.held, .78));
    for (const node of all) node.speed = [0, 0, 0];
  } else if (type === 'shatter') {
    for (const node of all) node.speed = [0, 0, 0];
  } else if (type === 'lodged') {
    lodgeBlade(action.key);
  } else if (type === 'pin') {
    // Knocked back, but only as far as stays in view, then pinned where the chest lands.
    const room = 3.5 + defender.direction * defender.x;
    const speed = clamp(room / .9, .4, 3.3);
    for (const node of all) node.speed = [-speed - node.point[1] * .3, 1.5, node.speed[2]];
  }
  const { name, verb, color } = finisherTypes[type];
  ArenaEffects.label([defender.x, 2.9, defender.z + .3], name, color, { power: .2 });
  logEvent(attacker.name + ' ' + verb + ' ' + defender.name + '.');
  return type === 'impale' || type === 'lodged' ? 1 : .6;
}

// The loser's torso as the victor sees it: a point on it and the way it leans.
function torsoFrame(attacker, defender) {
  const { hips, chest } = defender.ragdoll.nodes;
  const [low, high] = [hips, chest].map(node => toLocal(attacker, worldPoint(defender, node.point)));
  return { point: pointBetween(low, high, .55), lean: Math.atan2(high[1] - low[1], high[0] - low[0]) };
}

// Remembers how the blade sits in the torso at the moment of the kill, so it can follow the fall.
function lodgeBlade(key) {
  const { attacker, defender } = finisher;
  const held = displayPose(attacker);
  const hand = held.joints.weaponHand;
  const torso = torsoFrame(attacker, defender);
  const [dx, dy] = [torso.point[0] - hand[0], torso.point[1] - hand[1]];
  // Keep the tip just inside the far side of the body, wherever the fighters stood.
  const length = key === 'rapier' ? 1.37 : 1.13;
  const angle = clamp(Math.atan2(dy, dx), -.4, .4);
  Object.assign(finisher, { held, key, depth: clamp(Math.hypot(dx, dy), .6, length - .2), angle: angle - torso.lean });
  // The body topples onto its back, so the hilt ends up standing out of it.
  for (const node of Object.values(defender.ragdoll.nodes)) node.speed = [-node.point[1] * .9, 0, 0];
  const wound = worldPoint(defender, pointBetween(defender.ragdoll.nodes.hips.point, defender.ragdoll.nodes.chest.point, .55));
  ArenaEffects.bleed(wound, attacker.direction, .6);
}

// Runs each finished-bout step in place of the plain ragdoll step. Returns true if it stepped the ragdoll.
function stepFinisher(dt) {
  if (!finisher) return false;
  const { type, defender, attacker } = finisher;
  const ragdoll = defender.ragdoll;
  const { nodes } = ragdoll;
  finisher.clock += dt;
  const t = finisher.clock;
  if (type === 'shatter') {
    if (t >= .55 && !defender.shattered) {
      defender.shattered = true;
      ArenaEffects.shake(.55);
      for (const name of ['head', 'chest', 'hips', 'weaponHand', 'shieldHand', 'frontKnee', 'rearKnee']) {
        ArenaEffects.strike(worldPoint(defender, nodes[name].point), -attacker.direction, '#cfefff', 9, 1.3);
      }
      ArenaEffects.dust(defender.x, defender.z + .2, '#dceff8', 22, 1.8);
    }
    return true;
  }
  stepRagdoll(ragdoll, dt / 2);
  stepRagdoll(ragdoll, dt / 2);
  if (type === 'crumple' && !finisher.landed && nodes.chest.point[1] <= nodes.chest.floor + .06) {
    finisher.landed = true;
    const point = worldPoint(defender, nodes.chest.point);
    ArenaEffects.dust(point[0], point[2], '#b49b78', 12, 1.1);
    ArenaEffects.bleed(point, attacker.direction, .38);
    ArenaEffects.shake(.4);
  } else if (type === 'lastCast' && t >= .7 && !finisher.landed) {
    finisher.landed = true;
    const point = worldPoint(defender, nodes.chest.point);
    ArenaEffects.bleed(point, attacker.direction, .55);
    ArenaEffects.dust(point[0], point[2], '#b49b78', 7, .8);
    ArenaEffects.shake(.3);
  } else if (type === 'behead') {
    const grounded = nodes.head.point[1] <= nodes.head.floor + .02;
    finisher.spin *= Math.exp(-dt * (grounded ? 6 : .4));
    ragdoll.pose.headSpin += finisher.spin * dt;
    if (t < .8 && (finisher.tick -= dt) <= 0) {
      finisher.tick = .12;
      ArenaEffects.bleed(worldPoint(defender, shifted(nodes.chest.point, 0, .2)), attacker.direction, .1);
    }
  } else if (type === 'impale') {
    if (t < .8) {
      // Slid onto the blade, then held there until the kick.
      const onBlade = pointBetween(finisher.start ??= nodes.chest.point.slice(), finisher.tip, smooth(t / .18));
      nodes.chest.point.splice(0, 3, ...onBlade);
      nodes.chest.speed = [0, 0, 0];
    } else if (!finisher.kicked) {
      finisher.kicked = true;
      for (const node of Object.values(nodes)) node.speed = [node.speed[0] - 3.4, node.speed[1] + 1.2, node.speed[2]];
      ArenaEffects.shake(.4);
      kickDust(attacker, 1, 8);
      ArenaEffects.bleed(worldPoint(defender, nodes.chest.point), attacker.direction, .5);
    }
  } else if (type === 'pin') {
    if (!finisher.pinned && nodes.chest.point[1] <= nodes.chest.floor + .03) {
      finisher.pinned = nodes.chest.point.slice();
      ArenaEffects.shake(.35);
    }
    if (finisher.pinned) {
      nodes.chest.point.splice(0, 3, ...finisher.pinned);
      nodes.chest.speed = [0, 0, 0];
    }
  }
  return true;
}

// The victor's pose during an impale: the finishing thrust held, then a front kick.
function finisherPose(fighter) {
  if (!finisher?.held || fighter !== finisher.attacker) return null;
  const held = finisher.held;
  const pose = { ...held, joints: { ...held.joints } };
  const t = finisher.clock;
  if (finisher.type === 'lastCast') {
    const draw = smooth(t / .28);
    const release = smooth((t - .28) / .14);
    applyMotion(fighter, pose, { handX: -.58, handY: .52, leanX: -.12 }, draw);
    applyMotion(fighter, pose, { handX: .80, handY: -.12, leanX: .22 }, release);
    pose.angle = mix(held.angle, .18, draw) - .48 * release;
    return pose;
  }
  if (finisher.type === 'lodged') {
    // Let go of the hilt and draw the empty hand back.
    applyMotion(fighter, pose, { handX: -.34, handY: -.3, leanX: -.12, hipX: -.05 }, smooth((t - .14) / .4));
    return pose;
  }
  const kick = smooth((t - .55) / .25) * (1 - smooth((t - 1.05) / .35));
  if (kick > 0) applyMotion(fighter, pose, { frontX: .62, frontY: .42, leanX: -.14, hipX: -.05 }, kick);
  return pose;
}

// Where the victor's weapon is when it is not in the hand: thrown (Last Cast) or left in the body
// (Lodged Blade). Both are in the victor's local coordinates, with the same mesh grip throughout.
function looseWeapon(fighter, pose) {
  if (fighter !== finisher?.attacker) return null;
  if (finisher.type === 'lodged') {
    const torso = torsoFrame(fighter, finisher.defender);
    const angle = torso.lean + finisher.angle;
    return { key: finisher.key, angle, hand: weaponAxis(torso.point, angle)(-finisher.depth), emptyHand: true };
  }
  if (finisher.type !== 'lastCast') return null;
  const flight = clamp((finisher.clock - .42) / .28, 0, 1);
  const target = toLocal(fighter, worldPoint(finisher.defender, finisher.defender.ragdoll.nodes.chest.point));
  const angle = mix(pose.angle, -.56, flight);
  const endGrip = weaponAxis(target, angle)(-1.68);
  const hand = pointBetween(pose.joints.weaponHand, endGrip, flight);
  hand[1] += .12 * Math.sin(Math.PI * flight);
  return { key: 'spear', hand, angle };
}

// How far to tint the loser toward ice while they freeze, 0 to 1.
function finisherFrost(fighter) {
  return finisher?.type === 'shatter' && fighter === finisher.defender ? clamp(finisher.clock / .45, 0, 1) : 0;
}

// Ice shards left where a shattered body stood, and the bolt standing out of a pinned body.
function drawFinisher() {
  if (finisher?.type === 'shatter' && finisher.defender.shattered) {
    const { defender } = finisher;
    for (const [dx, dz, size] of [[-.5, .1, .16], [-.22, -.12, .22], [.05, .2, .28], [.3, -.05, .19], [.55, .15, .13], [.15, -.25, .12]]) {
      const [x, y] = project([defender.x + dx, 0, defender.z + .2 + dz]);
      const h = size * scale;
      const left = [x - h * .45, y];
      const tip = [x - h * .15, y - h];
      const right = [x + h * .3, y - h * .55];
      const base = [x + h * .5, y];
      const foot = [x + h * .05, y];
      polygon([left, tip, right, base], '#c9ecf8d0');
      polygon([tip, right, foot], '#eef8fcd0');
      if (modelDetail) {
        const ridge = [x - h * .12, y - h * .44];
        polygon([tip, ridge, left], '#9dc4dfd0');
        if (modelDetail === 2) polygon([ridge, right, base, foot], '#b5dcefd0');
      }
    }
    return;
  }
  if (finisher?.type !== 'pin') return;
  const { defender, attacker } = finisher;
  const chest = defender.ragdoll.nodes.chest.point;
  const from = worldPoint(defender, chest);
  const toward = Math.sign(attacker.x - defender.x) || 1;
  const [x0, y0] = project(shifted(from, -toward * .1, -.12));
  const [x1, y1] = project(shifted(from, toward * .42, .58));
  if (modelDetail) {
    drawFacetedBolt([x1, y1], [x0, y0], '#6b4a2c', '#e8dcc0');
    return;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6b4a2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
