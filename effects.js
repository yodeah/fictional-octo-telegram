'use strict';

// Cosmetic only: nothing here may change fight state or consume Math.random,
// which the simulation relies on for its rolls.
const ArenaEffects = (() => {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const trailLife = .17;
  const trails = [];
  const sparks = [];
  const flashes = [];
  const puffs = [];
  const contacts = new Map();
  let seed = 90210;
  // A private generator, so effects never shift the simulation's random rolls.
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let trauma = 0;
  let clock = 0;

  const pointOnLine = (from, to, amount) => [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];

  return {
    // Strength runs from 0 to 1. Overlapping hits add a little to the strongest one.
    shake(strength) {
      trauma = Math.min(1, Math.max(trauma, strength) + Math.min(trauma, strength) * .25);
    },
    // Offset in world units, so the shake looks the same at any canvas size.
    offset() {
      if (calm?.matches || trauma <= 0) return [0, 0];
      const size = trauma * trauma * .17;
      return [
        size * (Math.sin(clock * 83) * .65 + Math.sin(clock * 137 + 2) * .35),
        size * (Math.sin(clock * 101 + 1) * .65 + Math.sin(clock * 61 + 4) * .35)
      ];
    },
    // Real seconds, so playback speed does not shorten or sharpen the shake.
    frame(dt) {
      clock += dt;
      trauma = Math.max(0, trauma - dt * 2.6);
    },
    // A flash at the contact point and sparks thrown mostly in the blow's direction.
    strike(point, direction, color, count, size = 1) {
      flashes.push({ point: point.slice(), color, size, angle: random() * Math.PI, age: 0, life: .13 });
      for (let i = 0; i < count; i++) {
        sparks.push({
          point: point.slice(), color, age: 0, life: .18 + random() * .24,
          speed: [direction * (random() * 4.6 - 1.1), random() * 3.8 - .7, (random() - .5) * 2.4]
        });
      }
    },
    dust(x, z, color, count, strength = 1) {
      for (let i = 0; i < count; i++) {
        const side = random() * 2 - 1;
        puffs.push({
          point: [x + side * .16 * strength, .04 + random() * .07, z + (random() - .5) * .24],
          speed: [side * (.25 + random() * .8) * strength, .08 + random() * .34 * strength, (random() - .5) * .3],
          size: (.07 + random() * .085) * strength, color, age: 0, life: .45 + random() * .4
        });
      }
    },
    // True only on the step where a foot or body part first touches the ground.
    lands(key, grounded) {
      const before = contacts.get(key);
      contacts.set(key, grounded);
      return before === false && grounded;
    },
    // Adds the weapon's current position to the ribbon for this swing.
    trail(swing, inner, outer, color) {
      let strip = trails.find(trail => trail.swing === swing);
      if (!strip) trails.push(strip = { swing, color, points: [] });
      strip.points.push({ inner, outer, age: 0 });
    },
    // Simulation seconds, so trails freeze with hit pauses and follow playback speed.
    tick(dt) {
      for (const list of [sparks, flashes, puffs]) {
        for (let i = list.length - 1; i >= 0; i--) {
          list[i].age += dt;
          if (list[i].age >= list[i].life) list.splice(i, 1);
        }
      }
      for (const { point, speed } of sparks) {
        speed[1] -= dt * 11;
        for (let axis = 0; axis < 3; axis++) point[axis] += speed[axis] * dt;
        point[1] = Math.max(0, point[1]);
      }
      for (const { point, speed } of puffs) {
        for (let axis = 0; axis < 3; axis++) {
          point[axis] += speed[axis] * dt;
          speed[axis] *= Math.exp(-dt * 3.2);
        }
      }
      for (let i = trails.length - 1; i >= 0; i--) {
        const { points } = trails[i];
        for (const point of points) point.age += dt;
        while (points.length && points[0].age >= trailLife) points.shift();
        if (!points.length) trails.splice(i, 1);
      }
    },
    drawDust(ctx, project, scale) {
      ctx.save();
      for (const puff of puffs) {
        const progress = puff.age / puff.life;
        const [x, y] = project(puff.point);
        const radius = puff.size * scale * (.7 + progress * 1.5);
        ctx.globalAlpha = (1 - progress) * .64;
        ctx.fillStyle = puff.color;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * .7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    drawSparks(ctx, project, scale) {
      ctx.save();
      ctx.lineCap = 'round';
      const line = (from, to, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(to[0], to[1]);
        ctx.stroke();
      };
      for (const { point, speed, color, age, life } of sparks) {
        const head = project(point);
        const tail = project(point.map((value, axis) => value - speed[axis] * .045));
        ctx.globalAlpha = 1 - (age / life) ** 2;
        line(tail, head, color, 3.2);
        line(pointOnLine(tail, head, .45), head, '#fffdf2', 1.4);
      }
      for (const { point, color, size, angle, age, life } of flashes) {
        const progress = age / life;
        const [x, y] = project(point);
        const radius = scale * .3 * size * (.65 + progress * .7);
        ctx.globalAlpha = 1 - progress;
        // Alternating long and short points make a four-point star with small spurs.
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const reach = radius * (i % 4 === 0 ? 1 : i % 2 === 0 ? .48 : .17);
          const turn = angle + i * Math.PI / 8;
          ctx.lineTo(x + Math.cos(turn) * reach, y + Math.sin(turn) * reach);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#fffdf2';
        ctx.beginPath();
        ctx.arc(x, y, radius * .2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    drawTrails(ctx, project) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const { color, points } of trails) {
        for (let i = 1; i < points.length; i++) {
          const fade = 1 - points[i].age / trailLife;
          const [a, b, c, d] = [points[i - 1].inner, points[i - 1].outer, points[i].outer, points[i].inner].map(project);
          ctx.fillStyle = ctx.strokeStyle = color;
          ctx.globalAlpha = Math.max(0, fade) * .38;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          for (const [x, y] of [b, c, d]) ctx.lineTo(x, y);
          ctx.closePath();
          ctx.fill();
          // A brighter leading edge keeps the arc readable against pale sand.
          ctx.globalAlpha = Math.max(0, fade) * .85;
          ctx.lineWidth = 1 + fade * 2;
          ctx.beginPath();
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    reset() {
      trauma = 0;
      trails.length = sparks.length = flashes.length = puffs.length = 0;
      contacts.clear();
    }
  };
})();
