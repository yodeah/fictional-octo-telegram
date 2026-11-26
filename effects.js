'use strict';

// Cosmetic only: nothing here may change fight state or consume Math.random,
// which the simulation relies on for its rolls.
const ArenaEffects = (() => {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const trailLife = .17;
  const labelLife = 1.3;
  const labels = [];
  const trails = [];
  const drops = [];
  const stains = [];
  const bloodColors = ['#8e1f1c', '#b0281f', '#c93a2a'];
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
    // Floating text above a fighter. A power from 0 to 1 marks a number and sets its size.
    label(point, text, color, { tag, power } = {}) {
      // Take the first free row among recent labels nearby, so they never overlap.
      const taken = new Set(labels.filter(other => other.age < .8 && Math.abs(other.point[0] - point[0]) < 1.1)
        .map(other => other.row));
      let row = 0;
      while (taken.has(row)) row++;
      labels.push({ point: point.slice(), text, color, tag, power, row, age: 0 });
    },
    // Drawn without shake so the numbers stay readable.
    drawLabels(ctx, project, width, height) {
      const unit = Math.max(.72, Math.min(1.15, width / 900));
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#24150e';
      const write = (text, x, y, size, color) => {
        ctx.font = '900 ' + size + 'px system-ui';
        ctx.lineWidth = Math.max(3.5, size * .2);
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      };
      for (const { point, text, color, tag, power, row, age } of labels) {
        const number = power !== undefined;
        // Pops in large, settles, drifts up, then fades over the last third of a second.
        const pop = 1 + Math.max(0, 1 - age / .14) * (number ? .6 : .2);
        const size = Math.round((number ? 24 + Math.min(1, power * 4) * 18 : 17) * unit * pop);
        const tagSize = Math.round(12 * unit);
        const [baseX, baseY] = project(point);
        const measure = (words, points) => {
          ctx.font = '900 ' + points + 'px system-ui';
          return ctx.measureText(words).width;
        };
        // Keep the whole label, including a long tag, inside the canvas.
        const half = Math.max(measure(text, size), tag ? measure(tag, tagSize) : 0) / 2 + 8;
        const x = Math.max(half, Math.min(width - half, baseX));
        const rise = (1 - (1 - Math.min(1, age / labelLife)) ** 3) * 24;
        const y = Math.max(size / 2 + 6, Math.min(height - 24, baseY + row * 48 * unit - rise));
        ctx.globalAlpha = Math.max(0, Math.min(1, (labelLife - age) / .33));
        write(text, x, y, size, color);
        if (tag) write(tag, x, y + size * .5 + tagSize * .6, tagSize, '#fff0d4');
      }
      ctx.restore();
    },
    // Real seconds, so playback speed does not shorten effects meant to be read.
    frame(dt) {
      clock += dt;
      for (let i = labels.length - 1; i >= 0; i--) {
        labels[i].age += dt;
        if (labels[i].age >= labelLife) labels.splice(i, 1);
      }
      trauma = Math.max(0, trauma - dt * 2.6);
    },
    // Severity runs from 0 to 1 and sets how much sprays from the wound.
    bleed(point, direction, severity) {
      const count = Math.round(24 + severity * 46);
      for (let i = 0; i < count; i++) {
        // One drop in four spatters back toward the attacker.
        const way = i % 4 === 0 ? -direction * .5 : direction;
        drops.push({
          point: point.slice(), size: .012 + random() ** 2 * (.03 + severity * .022), color: bloodColors[i % 3],
          speed: [way * (.2 + random() * (2 + severity * 1.8)), .2 + random() * (2.5 + severity), (random() - .5) * 2.2]
        });
      }
    },
    // A pool that spreads under a fallen fighter.
    pool(x, z) {
      stains.push({ x, z, size: .1, limit: .92, color: '#6e1512' });
      for (let i = 0; i < 14; i++) {
        stains.push({ x: x + (random() - .5) * 1.3, z: z + (random() - .5) * .5, size: .02 + random() * .06, color: '#74201b' });
      }
    },
    drawStains(ctx, project, scale) {
      ctx.save();
      ctx.globalAlpha = .76;
      for (const { x, z, size, color } of stains) {
        const [px, py] = project([x, 0, z]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(px, py, scale * size, scale * size * .31, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    drawBlood(ctx, project, scale) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const { point, speed, size, color } of drops) {
        const [x, y] = project(point);
        const [tailX, tailY] = project(point.map((value, axis) => value - speed[axis] * .022));
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.4, size * scale);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
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
      // Each drop leaves a stain where it lands, and pools spread to their limit.
      for (let i = drops.length - 1; i >= 0; i--) {
        const { point, speed, size, color } = drops[i];
        speed[1] -= dt * 11;
        for (let axis = 0; axis < 3; axis++) point[axis] += speed[axis] * dt;
        if (point[1] > 0) continue;
        stains.push({ x: point[0], z: point[2], size: size * (1 + random()), color });
        drops.splice(i, 1);
      }
      if (stains.length > 700) stains.splice(0, stains.length - 700);
      for (const stain of stains) {
        if (stain.limit) stain.size = Math.min(stain.limit, stain.size + dt * .24);
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
      labels.length = trails.length = sparks.length = flashes.length = puffs.length = drops.length = stains.length = 0;
      contacts.clear();
    }
  };
})();
