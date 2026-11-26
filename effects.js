'use strict';

// Cosmetic only: nothing here may change fight state or consume Math.random,
// which the simulation relies on for its rolls.
const ArenaEffects = (() => {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const trailLife = .17;
  const trails = [];
  let trauma = 0;
  let clock = 0;

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
    // Adds the weapon's current position to the ribbon for this swing.
    trail(swing, inner, outer, color) {
      let strip = trails.find(trail => trail.swing === swing);
      if (!strip) trails.push(strip = { swing, color, points: [] });
      strip.points.push({ inner, outer, age: 0 });
    },
    // Simulation seconds, so trails freeze with hit pauses and follow playback speed.
    tick(dt) {
      for (let i = trails.length - 1; i >= 0; i--) {
        const { points } = trails[i];
        for (const point of points) point.age += dt;
        while (points.length && points[0].age >= trailLife) points.shift();
        if (!points.length) trails.splice(i, 1);
      }
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
      trails.length = 0;
    }
  };
})();
