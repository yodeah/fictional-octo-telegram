'use strict';

// 2D venues to match the 2D fighters. The still art is painted into the cached backdrop, so its
// detail costs nothing per frame; the crowd and wildlife are sprites baked once and then moved.
// venues.js uses a scene from here when the 2D art is on, and falls back to its own otherwise.
const ArenaVenues2D = (() => {
  const { tone, gradient, shape, stroke, disc, clipped, seeded } = ArenaArt2D.tools;
  // Softer than the fighters' outline, so scenery stays behind them.
  const LINE = 'rgba(38,20,12,.62)';
  const scenes = [];

  // ---------------------------------------------------------------- sprites
  const cache = new Map();
  let bakedAt = 0;
  // box and paint use scene units; one unit covers `unit` device pixels.
  // haze fades a sprite toward the air behind it, so it reads as farther away than the fighters.
  function sprite(key, box, unit, paint, haze) {
    const wanted = Math.ceil(unit * 8) / 8;
    if (wanted !== bakedAt) {
      cache.clear();
      bakedAt = wanted;
    }
    let entry = cache.get(key);
    if (!entry) {
      const [x0, y0, x1, y1] = box;
      const image = document.createElement('canvas');
      image.width = Math.ceil((x1 - x0) * wanted);
      image.height = Math.ceil((y1 - y0) * wanted);
      const g = image.getContext('2d');
      g.scale(wanted, wanted);
      g.translate(-x0, -y0);
      g.lineJoin = g.lineCap = 'round';
      paint(g);
      if (haze) {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = haze;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      entry = { image, x: x0, y: y0, w: image.width / wanted, h: image.height / wanted };
      cache.set(key, entry);
    }
    return entry;
  }
  // Positions follow the 1000 × 420 scene, but a sprite keeps its proportions on a narrow screen.
  function stage(ctx, width, height) {
    const sx = width / 1000;
    const sy = height / 420;
    const size = Math.sqrt(sx * sy);
    const pixels = ctx.canvas.width / width;
    return {
      size,
      unit: size * pixels,
      put(art, x, y, { angle = 0, flip = 1, scale = 1, alpha = 1 } = {}) {
        ctx.save();
        ctx.translate(x * sx, y * sy);
        ctx.rotate(angle);
        ctx.scale(size * scale * flip, size * scale);
        ctx.globalAlpha *= alpha;
        ctx.drawImage(art.image, art.x, art.y, art.w, art.h);
        ctx.restore();
      }
    };
  }

  function box(ctx, x, y, w, h, fill, line = 1) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (line) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = line;
      ctx.strokeRect(x, y, w, h);
    }
  }
  function speckle(ctx, random, count, [x0, y0, x1, y1], light, dark, size = 2.4) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 ? light : dark;
      ctx.fillRect(x0 + random() * (x1 - x0), y0 + random() * (y1 - y0), .6 + random() * size, .5 + random() * size * .45);
    }
  }
  function vignette(ctx, width, height, warm, edge) {
    const glow = ctx.createRadialGradient(width / 2, height * .7, 0, width / 2, height * .7, width * .62);
    glow.addColorStop(0, warm);
    glow.addColorStop(1, edge);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // ---------------------------------------------------------------- The Sand Pit
  const coats = [[166, 101, 71], [128, 113, 62], [86, 123, 116], [116, 77, 66], [176, 134, 86], [102, 81, 83], [135, 148, 123]];
  const skins = [[200, 149, 103], [164, 112, 80], [134, 87, 56], [223, 183, 132]];
  const hairs = [[73, 51, 42], [40, 28, 24], [150, 108, 60], [190, 180, 168]];
  const dust = 'rgba(128,82,58,.3)';

  // A spectator from the waist up; eight looks cover the fifty seats.
  const spectator = (look, unit) => sprite('fan' + look, [-16, -18, 16, 20], unit, g => {
    const coat = coats[look % coats.length];
    const skin = skins[look % skins.length];
    const hair = hairs[(look * 3) % hairs.length];
    shape(g, 'M-13,19 C-13,6 -9,2 -3,1 L3,1 C9,2 13,6 13,19 Z', gradient(g, -13, 0, 13, 0, coat, [-.35, .05, .2, -.15]), 1, LINE);
    stroke(g, 'M-5,2 L0,9 L5,2', tone(coat, .38), 1.4);
    stroke(g, 'M-7,10 C-6,13 -7,16 -6,19 M7,9 C6,13 8,16 7,19', 'rgba(30,12,8,.35)', .9);
    shape(g, 'M-4.6,-8 C-6,0 -2,3.4 1,3.2 C5,3 6,-1 5.4,-6 C4,-11 -3,-12 -4.6,-8 Z', gradient(g, -5, 0, 6, -6, skin, [-.25, .05, .2]), .9, LINE);
    disc(g, -1.6, -4.6, .65, '#2a160e', 0);
    disc(g, 2.4, -4.6, .65, '#2a160e', 0);
    stroke(g, 'M-1,-.6 Q.8,.6 2.6,-.6', 'rgba(80,30,20,.8)', .7);
    if (look % 4 === 1) {
      shape(g, 'M-7,-6 C-6,-15 6,-15 7,-6 C3,-9 -3,-9 -7,-6 Z', tone(coats[(look + 3) % coats.length], .1), .9, LINE);
    } else if (look % 4 === 3) {
      shape(g, 'M-6,-2 C-9,-13 7,-15 6.4,-5 C3,-9 -2,-9 -4,-6 L-4,1 Z', tone(hair, 0), .9, LINE);
    } else {
      shape(g, 'M-5.4,-5 C-7,-14 6,-14 6,-5.4 C3,-9.4 -1,-8 -5.4,-5 Z', tone(hair, 0), .9, LINE);
    }
  }, dust);
  const arm = (look, unit) => sprite('arm' + look, [-5, -25, 5, 3], unit, g => {
    const coat = coats[look % coats.length];
    shape(g, 'M-3.4,2 L-2.4,-15 L2.4,-15 L3.4,2 Z', tone(coat, .04), .9, LINE);
    shape(g, 'M-2,-15 C-3.4,-19 -2,-23 0,-23 C2.6,-23 3,-19 2,-15 Z', tone(skins[look % skins.length], 0), .9, LINE);
  }, dust);

  scenes[0] = {
    backdrop(ctx, width, height) {
      const random = seeded(351);
      const sky = ctx.createLinearGradient(0, 0, 0, height * .5);
      sky.addColorStop(0, '#7a4630');
      sky.addColorStop(1, '#ad7450');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.lineJoin = ctx.lineCap = 'round';

      // Dressed stone wall: bevelled blocks with chips and cracks.
      const stone = Math.max(30, width / 19);
      const course = height * .069;
      for (let row = 0; row < 6; row++) {
        for (let column = -1; column < width / stone + 1; column++) {
          const x = (column + (row % 2) * .5) * stone + 1;
          const y = row * course + 1;
          const w = stone - 2;
          const h = course - 2;
          const shade = random() * .22 - .11;
          box(ctx, x, y, w, h, tone([166, 108, 76], shade), .8);
          box(ctx, x + 1, y + 1, w - 2, 2, 'rgba(255,220,170,.28)', 0);
          box(ctx, x + 1, y + h - 3, w - 2, 2, 'rgba(60,22,10,.3)', 0);
          if (random() > .78) {
            const cx = x + random() * w;
            stroke(ctx, `M${cx},${y} l${random() * 6 - 3},${h * .4} l${random() * 8 - 4},${h * .35}`, 'rgba(60,24,12,.5)', .8);
          }
        }
      }
      speckle(ctx, random, 900, [0, 0, width, height * .41], 'rgba(255,220,170,.18)', 'rgba(60,24,10,.22)');

      // Arched galleries with carved voussoirs, columns and dim interiors.
      const bay = Math.min(145, Math.max(92, width / 8));
      for (let i = -1; i < Math.ceil(width / bay); i++) {
        const x = i * bay + bay * .11;
        const y = height * .09;
        const w = bay * .78;
        const spring = y + w * .45;
        const foot = height * .42;
        const arch = (inset) => {
          ctx.beginPath();
          ctx.moveTo(x + w * .12 + inset, foot);
          ctx.lineTo(x + w * .12 + inset, spring);
          ctx.ellipse(x + w * .5, spring, w * .38 - inset, w * .35 - inset, 0, Math.PI, Math.PI * 2);
          ctx.lineTo(x + w * .88 - inset, foot);
        };
        arch(0);
        const dark = ctx.createLinearGradient(0, y, 0, foot);
        dark.addColorStop(0, '#2c1712');
        dark.addColorStop(1, '#74492f');
        ctx.fillStyle = dark;
        ctx.fill();
        // A torch burns in every other arch.
        if (((i % 2) + 2) % 2 === 0) {
          const tx = x + w * .5;
          const ty = spring + height * .02;
          const halo = ctx.createRadialGradient(tx, ty, 0, tx, ty, w * .34);
          halo.addColorStop(0, 'rgba(255,180,80,.5)');
          halo.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = halo;
          ctx.fillRect(tx - w * .34, ty - w * .34, w * .68, w * .68);
          box(ctx, tx - 2, ty + 4, 4, 11, '#4a2c1a');
          shape(ctx, `M${tx - 4},${ty + 4} C${tx - 6},${ty - 3} ${tx},${ty - 4} ${tx - 1},${ty - 11} C${tx + 6},${ty - 4} ${tx + 6},${ty} ${tx + 4},${ty + 4} Z`, '#ffb347', .8, LINE);
          shape(ctx, `M${tx - 2},${ty + 3} Q${tx},${ty - 5} ${tx + 2},${ty + 3} Z`, '#fff0b8', 0);
        }
        const voussoirs = 11;
        for (let k = 0; k < voussoirs; k++) {
          const at = (a, out) => [x + w * .5 + Math.cos(a) * (w * .38 + out), spring + Math.sin(a) * (w * .35 + out)];
          const a0 = Math.PI * (1 + k / voussoirs);
          const a1 = Math.PI * (1 + (k + 1) / voussoirs);
          const rim = Math.max(5, w * .085);
          const points = [at(a0, 0), at(a1, 0), at(a1, rim), at(a0, rim)];
          shape(ctx, 'M' + points.map(p => p.join(',')).join(' L') + ' Z', tone([196, 150, 106], k === 5 ? .3 : (k % 2) * .12 - .06), .8, LINE);
        }
        for (const side of [x + w * .02, x + w * .88]) {
          box(ctx, side, spring, w * .1, foot - spring, gradient(ctx, side, 0, side + w * .1, 0, [192, 144, 102], [-.3, .15, .3, -.2]), .9);
          for (const flute of [.33, .66]) box(ctx, side + w * .1 * flute, spring + 6, 1, foot - spring - 12, 'rgba(80,40,22,.45)', 0);
          box(ctx, side - 3, spring - 4, w * .1 + 6, 6, tone([214, 170, 122], 0), .9);
          box(ctx, side - 3, foot - 6, w * .1 + 6, 6, tone([190, 146, 104], 0), .9);
        }
      }

      // Parapet under the crowd, with a carved key pattern.
      box(ctx, 0, height * .411, width, height * .078, gradient(ctx, 0, height * .41, 0, height * .49, [134, 84, 54], [.05, -.1, -.35]), 0);
      box(ctx, 0, height * .415, width, 5, '#d2a272', .8);
      box(ctx, 0, height * .45, width, height * .037, '#9a6646', .8);
      const step = 26;
      for (let x = 4; x < width; x += step) {
        const y = height * .456;
        const s = height * .025;
        stroke(ctx, `M${x},${y + s} V${y} H${x + step * .7} V${y + s * .72} H${x + step * .25} V${y + s * .35} H${x + step * .45}`, 'rgba(60,28,14,.7)', 1.4);
      }
      box(ctx, 0, height * .487, width, 3, '#4e2c1c', 0);

      // Team banners with folds, fringe and an emblem.
      for (const [side, cloth] of [[-1, [136, 62, 50]], [1, [52, 90, 94]]]) {
        const x = width * (.5 + side * .34);
        const y = height * .1;
        const w = Math.min(62, Math.max(30, width * .062));
        const h = height * .27;
        const d = `M${x - w / 2},${y} H${x + w / 2} V${y + h * .86} L${x},${y + h} L${x - w / 2},${y + h * .86} Z`;
        shape(ctx, d, gradient(ctx, x - w / 2, 0, x + w / 2, 0, cloth, [-.3, .12, -.15, .18, -.35]), 1.4, LINE);
        clipped(ctx, d, () => {
          for (const fold of [-.22, .14]) box(ctx, x + w * fold, y, w * .09, h, 'rgba(20,6,8,.22)', 0);
          speckle(ctx, random, 90, [x - w / 2, y, x + w / 2, y + h], 'rgba(255,220,180,.2)', 'rgba(30,8,4,.25)');
        });
        stroke(ctx, `M${x - w * .38},${y + 6} V${y + h * .82} L${x},${y + h * .94} L${x + w * .38},${y + h * .82} V${y + 6}`, '#d8b070', 1.6);
        const cy = y + h * .46;
        const r = w * .27;
        disc(ctx, x, cy, r, '#caa066', 1);
        disc(ctx, x, cy, r * .68, tone(cloth, -.1), .8);
        shape(ctx, `M${x},${cy - r * .6} L${x + r * .16},${cy - r * .16} L${x + r * .6},${cy} L${x + r * .16},${cy + r * .16} L${x},${cy + r * .6} L${x - r * .16},${cy + r * .16} L${x - r * .6},${cy} L${x - r * .16},${cy - r * .16} Z`, '#e8c88a', .6, LINE);
        box(ctx, x - w * .64, y - 4, w * 1.28, 5, '#d8ae74', 1);
        for (const end of [-.66, .66]) disc(ctx, x + w * end, y - 1.5, 3.4, '#e8c88a', .9);
      }

      // Raked sand: soft drifts, scuffs, pebbles and the fighting ring.
      const floor = ctx.createLinearGradient(0, height * .49, 0, height);
      floor.addColorStop(0, '#b98a58');
      floor.addColorStop(.45, '#c6975f');
      floor.addColorStop(1, '#8f5a38');
      ctx.fillStyle = floor;
      ctx.fillRect(0, height * .49, width, height * .51);
      box(ctx, 0, height * .49, width, height * .022, 'rgba(70,34,16,.3)', 0);
      for (let i = 0; i < 26; i++) {
        const x = random() * width;
        const y = height * (.53 + random() * .45);
        const w = 20 + random() * 90;
        stroke(ctx, `M${x},${y} Q${x + w / 2},${y - 3 - random() * 4} ${x + w},${y}`, i % 2 ? 'rgba(255,224,170,.28)' : 'rgba(110,64,30,.2)', 1 + random() * 1.6);
      }
      speckle(ctx, random, 1500, [0, height * .5, width, height], 'rgba(255,226,172,.3)', 'rgba(90,50,24,.26)', 2.8);
      for (let i = 0; i < 46; i++) {
        const x = random() * width;
        const y = height * (.54 + random() * .44);
        const r = 1 + random() * 2.6 * ((y / height) - .3);
        ctx.fillStyle = 'rgba(60,30,14,.35)';
        ctx.beginPath();
        ctx.ellipse(x + 1, y + r * .5, r * 1.3, r * .6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i % 3 ? '#b6895f' : '#cfab7e';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r * .75, random(), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [grow, color, w] of [[1.015, 'rgba(100,56,28,.45)', 2.4], [1, 'rgba(250,216,160,.5)', 1.6]]) {
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = i / 72 * Math.PI * 2;
          const [x, y] = project([Math.cos(a) * 3.75 * grow, 0, Math.sin(a) * 2.6 * grow]);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      vignette(ctx, width, height, '#ffdc8b30', '#1e0e096b');
    },

    // Same seats and motion as the original crowd, so the cheer target stays put.
    draw(ctx, width, height, clock, [cheer]) {
      const view = stage(ctx, width, height);
      const excitement = Math.min(1, cheer * 1.6);
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 25; i++) {
          const x = i * 40 + (row ? 25 : 10);
          const y = 157 + row * 21 + Math.sin(clock * 2.1 - i * .56) * 1.4
            + Math.sin(clock * 8 - i * .34) * excitement * 3.4;
          const look = (i * 13 + row * 3) % 8;
          const size = 1.12 + row * .06;
          if (cheer || i % 4 === 0) {
            const wave = (Math.sin(clock * 2.7 - i * .67) + 1) * .16 + (Math.sin(clock * 9 - i * .67) + 1) * excitement * .3;
            view.put(arm(look, view.unit), x - 9, y + 6, { angle: -.75 + wave, scale: size });
            if (cheer) view.put(arm(look, view.unit), x + 9, y + 6, { angle: .75 - wave, scale: size });
          }
          view.put(spectator(look, view.unit), x, y, { scale: size });
        }
        ctx.fillStyle = row ? '#6c442e' : '#9c704a';
        ctx.fillRect(0, (172 + 18 * row) * height / 420, width, (row ? 8 : 5) * height / 420);
        ctx.fillStyle = 'rgba(255,222,170,.4)';
        ctx.fillRect(0, (172 + 18 * row) * height / 420, width, 1.2);
      }
      return [[.50, .332]];
    }
  };

  return {
    has: index => Boolean(scenes[index]),
    backdrop: (ctx, index, width, height) => scenes[index].backdrop(ctx, width, height),
    draw: (ctx, index, width, height, clock, active) => scenes[index].draw(ctx, width, height, clock, active)
  };
})();
