'use strict';

// The venues' art. The still art is painted into the cached backdrop, so its
// detail costs nothing per frame; the crowd and wildlife are sprites baked once and then moved.
// venues.js picks the venue and places its click targets.
const ArenaVenues2D = (() => {
  const { tone, gradient, shape, stroke, disc, clipped, seeded } = ArenaArt2D.tools;
  // Softer than the fighters' outline, so scenery stays behind them.
  const LINE = 'rgba(38,20,12,.62)';
  const scenes = [];
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

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

  // ---------------------------------------------------------------- shared outdoor ground
  function ground(ctx, random, colors) {
    const d = 'M0,225 L108,190 L254,197 L390,212 L516,192 L691,206 L825,192 L1000,216 L1000,420 L0,420 Z';
    shape(ctx, d, gradient(ctx, 0, 185, 0, 420, colors, [.08, 0, -.3]), 1.2, LINE);
    speckle(ctx, random, 1100, [0, 215, 1000, 420], 'rgba(255,230,170,.2)', 'rgba(20,30,16,.24)', 3.2);
    for (const [grow, color, w] of [[1.02, 'rgba(30,24,14,.3)', 2.6], [1, 'rgba(240,222,160,.34)', 1.5]]) {
      ctx.beginPath();
      ctx.ellipse(500, 342, 365 * grow, 51 * grow, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }
  const leafShape = (x, y, angle, length, width) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const tx = x + c * length;
    const ty = y + s * length;
    const mx = x + c * length * .5;
    const my = y + s * length * .5;
    return `M${x},${y} Q${mx - s * width},${my + c * width} ${tx},${ty} Q${mx + s * width},${my - c * width} ${x},${y} Z`;
  };
  function leaves(ctx, random, count, [x, y, rx, ry], colors, length) {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random());
      const px = x + Math.cos(a) * rx * r;
      const py = y + Math.sin(a) * ry * r;
      shape(ctx, leafShape(px, py, random() * Math.PI * 2, length * (.6 + random() * .8), length * .36),
        tone(colors[i % colors.length], (y - py) / ry * .16), .5, 'rgba(20,34,18,.45)');
    }
  }

  // ---------------------------------------------------------------- Fernwood Clearing
  function trunk(ctx, random, x, floor, w, color, detail) {
    const lean = (random() - .5) * 30;
    // A tapering bough, rooted inside the trunk so the bark covers its base.
    const side = random() > .5 ? 1 : -1;
    const by = 78 + random() * 54;
    const bx = x + lean * clamp((floor - by) / floor, 0, 1);
    shape(ctx, `M${bx},${by - w * .35} Q${bx + side * w * 1.9},${by - w * .6} ${bx + side * w * 3.6},${by - 38} Q${bx + side * w * 1.8},${by + w * .1} ${bx},${by + w * .55} Z`,
      tone(color, -.12), 1, LINE);
    const d = `M${x - w * 1.7},${floor} C${x - w},${floor - 14} ${x - w},${floor - 40} ${x - w * .8 + lean * .3},${floor - 90} L${x - w * .55 + lean},-10 L${x + w * .55 + lean},-10 C${x + w * .7 + lean * .5},${floor - 110} ${x + w},${floor - 40} ${x + w * 1.1},${floor - 12} L${x + w * 1.8},${floor} Z`;
    shape(ctx, d, gradient(ctx, x - w, 0, x + w, 0, color, [-.35, .05, .22, -.2]), 1.1, LINE);
    if (!detail) return;
    clipped(ctx, d, () => {
      for (let i = 0; i < 26; i++) {
        const bx = x - w + random() * w * 2 + lean * .4;
        const by = random() * floor;
        stroke(ctx, `M${bx},${by} q${random() * 4 - 2},${8 + random() * 10} ${random() * 5 - 2.5},${18 + random() * 22}`, i % 3 ? 'rgba(24,18,10,.45)' : 'rgba(240,220,160,.3)', .8 + random());
      }
      ctx.fillStyle = 'rgba(110,140,70,.4)';
      ctx.fillRect(x - w * 2, floor - 24, w * 4, 24);
    });
  }
  function fern(ctx, x, y, s, color) {
    for (const [angle, reach] of [[-2.7, .8], [-2.2, 1], [-1.65, 1.1], [-1.1, 1], [-.5, .8]]) {
      const tx = x + Math.cos(angle) * s * reach;
      const ty = y + Math.sin(angle) * s * reach;
      const mx = x + Math.cos(angle) * s * .5;
      const my = y + Math.sin(angle) * s * .8;
      stroke(ctx, `M${x},${y} Q${mx},${my} ${tx},${ty}`, tone(color, -.2), 1.4);
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * tx;
        const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ty;
        for (const side of [-1.25, 1.25]) {
          shape(ctx, leafShape(px, py, angle + side, s * .22 * (1 - t * .5), s * .055), tone(color, side > 0 ? .12 : -.08), .4, 'rgba(16,30,14,.5)');
        }
      }
    }
  }

  const squirrel = unit => sprite('squirrel', [-28, -30, 18, 10], unit, g => {
    const fur = [174, 106, 62];
    shape(g, 'M-7,2 C-26,4 -30,-18 -18,-26 C-10,-31 -2,-24 -6,-17 C-9,-22 -17,-20 -16,-13 C-15,-6 -8,-5 -4,-1 Z', gradient(g, -26, -26, -4, 2, fur, [.35, .05, -.3]), 1.1, LINE);
    for (let i = 0; i < 7; i++) stroke(g, `M${-9 - i * 1.6},${-2 - i * 3.4} q-4,-1 -5,-4`, 'rgba(255,214,160,.55)', .7);
    shape(g, 'M-10,2 C-11,-7 -1,-9 7,-4 C10,0 8,5 2,6 L-6,6 C-9,5 -10,4 -10,2 Z', gradient(g, 0, -8, 0, 6, fur, [.15, 0, -.25]), 1.1, LINE);
    shape(g, 'M3,-3 C2,1 4,4 6,3 C9,1 8,-3 6,-4 Z', '#e8cba0', 0);
    shape(g, 'M3,-8 C4,-14 12,-14 15,-8 C16,-5 14,-2 10,-2 C6,-2 3,-5 3,-8 Z', gradient(g, 3, -14, 15, -2, fur, [.25, 0, -.2]), 1.1, LINE);
    shape(g, 'M5,-11 L5.4,-19 L9,-12.4 Z M9,-12.6 L12,-18 L12.6,-11.4 Z', tone(fur, -.1), 1, LINE);
    disc(g, 11, -7.6, 1.5, '#1c120c', 0);
    disc(g, 11.5, -8.1, .5, '#fff', 0);
    disc(g, 15, -6, 1, '#3a2218', 0);
    stroke(g, 'M-4,5 L0,8 M4,4 L8,7', tone(fur, -.4), 2.2);
  });
  const boarBody = unit => sprite('boar', [-46, -34, 48, 16], unit, g => {
    const hide = [112, 86, 64];
    stroke(g, 'M-35,-6 q-9,-2 -7,6', tone(hide, -.3), 2.2);
    shape(g, 'M-36,-6 C-34,-24 -14,-28 4,-23 C16,-22 22,-16 20,-4 C18,6 6,10 -12,9 C-28,9 -37,5 -36,-6 Z', gradient(g, 0, -26, 0, 10, hide, [.2, -.02, -.35]), 1.3, LINE);
    for (let i = 0; i < 17; i++) stroke(g, `M${-27 + i * 2.7},${-21 - Math.sin(i / 16 * Math.PI) * 4} l-2.4,-6`, i % 2 ? '#3c2c20' : '#6a503a', 1.2);
    for (let i = 0; i < 22; i++) stroke(g, `M${-29 + (i % 8) * 6},${-14 + Math.floor(i / 8) * 7} l-4,2`, 'rgba(40,26,16,.5)', .8);
    shape(g, 'M13,-19 C24,-19 34,-12 42,-4 C45,1 43,7 37,7 C28,10 17,6 12,0 Z', gradient(g, 12, -16, 40, 6, hide, [.1, -.05, -.25]), 1.3, LINE);
    shape(g, 'M39,-5 C44,-4 45,5 40,7 C36,6 36,-3 39,-5 Z', '#8a6450', 1, LINE);
    disc(g, 41, 0, .9, '#2a1810', 0);
    shape(g, 'M33,4 C36,5 39,2 39,-3 C42,3 38,9 32,7 Z', '#eadfc4', .8, LINE);
    shape(g, 'M15,-15 L13,-28 L23,-18 Z', tone(hide, -.1), 1.1, LINE);
    disc(g, 27, -9, 2, '#e8cf96', .8);
    disc(g, 27.6, -9, 1, '#20140c', 0);
  });
  const boarLeg = (unit, far) => sprite('leg' + far, [-6, -2, 6, 15], unit, g => {
    shape(g, 'M-4,0 L4,0 L2.6,10 L-2.6,10 Z', tone([100, 76, 56], far ? -.35 : -.05), 1, LINE);
    shape(g, 'M-3.4,9.6 L3.4,9.6 L3.8,13.6 L-3.8,13.6 Z', '#2c201a', .9, LINE);
  });

  scenes[1] = {
    backdrop(ctx) {
      const random = seeded(649);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.fillStyle = gradient(ctx, 0, 0, 0, 240, [190, 188, 134], [.45, .1, -.2]);
      ctx.fillRect(0, 0, 1000, 420);
      const sun = ctx.createRadialGradient(535, 70, 0, 535, 70, 300);
      sun.addColorStop(0, 'rgba(255,236,170,.75)');
      sun.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, 1000, 300);
      // Three ranks of trees, hazier the farther they stand.
      for (const [count, color, w, floor, detail] of [[17, [136, 142, 112], 7, 186, false], [11, [102, 98, 70], 11, 198, true], [7, [92, 68, 44], 16, 212, true]]) {
        for (let i = 0; i < count; i++) {
          const x = (i + .2 + random() * .6) * (1000 / count);
          if (detail && w > 12 && x > 420 && x < 600) continue;
          trunk(ctx, random, x, floor + random() * 10, w + random() * 5, color, detail);
        }
        const green = w < 9 ? [[140, 158, 108], [158, 170, 118]] : w < 12 ? [[98, 126, 74], [122, 144, 82]] : [[66, 98, 56], [94, 124, 62], [52, 80, 48]];
        for (let i = 0; i < 9; i++) leaves(ctx, random, w > 12 ? 90 : 55, [i * 125 + random() * 60, 6 + random() * (w > 12 ? 22 : 52), 88, 40], green, w > 12 ? 15 : 11);
      }
      // Shafts of light.
      for (const [x, w] of [[300, 46], [470, 80], [640, 38]]) shape(ctx, `M${x},0 L${x + w},0 L${x + w - 110},230 L${x - 160},230 Z`, 'rgba(255,240,180,.11)', 0);
      for (let i = 0; i < 22; i++) leaves(ctx, random, 34, [i * 48 + random() * 26, 192 + random() * 22, 36, 20], [[88, 118, 64], [66, 92, 54], [118, 134, 70]], 9);
      ground(ctx, random, [150, 126, 82]);
      // A fallen, mossy log.
      shape(ctx, 'M166,217 C170,198 200,192 230,193 L356,196 C376,197 386,205 380,214 C372,224 340,222 300,222 L197,228 C180,229 164,226 166,217 Z', gradient(ctx, 0, 193, 0, 228, [104, 80, 52], [.2, -.05, -.4]), 1.4, LINE);
      for (let i = 0; i < 26; i++) stroke(ctx, `M${176 + random() * 160},${198 + random() * 24} l${14 + random() * 26},${random() * 3 - 1.5}`, 'rgba(36,22,10,.55)', 1);
      shape(ctx, 'M182,200 C200,190 240,192 262,195 C280,194 300,198 310,196 C300,204 268,202 250,206 C222,202 204,208 182,200 Z', '#71823f', 1, LINE);
      shape(ctx, 'M358,197 C374,196 386,204 382,213 C378,222 362,224 356,217 C350,208 350,200 358,197 Z', '#b99564', 1.2, LINE);
      for (const r of [9, 6, 3]) {
        ctx.beginPath();
        ctx.ellipse(367, 210, r, r * 1.1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(80,52,26,.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (const [x, y, s] of [[214, 224, 6], [226, 227, 4], [790, 222, 7], [803, 226, 5], [96, 300, 9]]) {
        box(ctx, x - s * .22, y - s * .8, s * .44, s * .9, '#e6d6b4', .8);
        shape(ctx, `M${x - s},${y - s * .7} C${x - s},${y - s * 2} ${x + s},${y - s * 2} ${x + s},${y - s * .7} Z`, '#b4462e', 1, LINE);
        for (const dx of [-.45, .2]) disc(ctx, x + s * dx, y - s * 1.15, s * .14, '#f4e6cc', 0);
      }
      for (let i = 0; i < 74; i++) {
        const x = random() * 1000;
        const side = x < 88 || x > 912;
        const y = 214 + random() * 26 + (side ? random() * 190 : 0);
        if (i % 4 === 0 || side) fern(ctx, x, y, 12 + random() * 16 + (side ? 12 : 0), [[84, 118, 58], [62, 98, 54], [106, 128, 62]][i % 3]);
        else for (let k = -2; k <= 2; k++) stroke(ctx, `M${x + k},${y} q${k * 1.4},-6 ${k * 3.2},-${7 + random() * 6}`, i % 2 ? '#6d7c3e' : '#9a9650', 1.2);
        if (i % 9 === 0) disc(ctx, x + 5, y - 8, 2, i % 18 ? '#e8d878' : '#d8cdea', .6);
      }
      vignette(ctx, 1000, 420, 'rgba(255,230,150,.1)', 'rgba(14,26,14,.42)');
    },

    // Same paths as the original animals, so their click targets follow them.
    draw(ctx, width, height, clock, reactions) {
      const view = stage(ctx, width, height);
      const squirrelHop = Math.sin(reactions[0] * Math.PI / 2) ** 2;
      const boarRun = Math.sin(reactions[1] * Math.PI / 2) ** 2;
      const bob = Math.sin(clock * 4.4 + boarRun * 4);
      const boarX = 744 + Math.sin(clock * .28) * 112 + boarRun * 58;
      const boarY = 208 - Math.abs(bob) * (1.9 + boarRun * 3.8);
      const way = Math.cos(clock * .28) > 0 || boarRun > .18 ? 1 : -1;
      ctx.fillStyle = 'rgba(24,34,20,.3)';
      ctx.beginPath();
      ctx.ellipse(boarX * width / 1000, 225 * height / 420, 36 * view.size, 5 * view.size, 0, 0, Math.PI * 2);
      ctx.fill();
      const leg = (x, i, far) => view.put(boarLeg(view.unit, far), boarX + x * way, boarY + 4, { angle: bob * (i % 2 ? -.3 : .3) });
      leg(-23, 0, true);
      leg(7, 2, true);
      view.put(boarBody(view.unit), boarX, boarY, { flip: way });
      leg(-13, 1, false);
      leg(15, 3, false);

      const squirrelX = 242 + Math.sin(clock * .75) * 61 + squirrelHop * 57;
      const hop = Math.abs(Math.sin(clock * 5 + squirrelHop * 5)) * (3 + squirrelHop * 13);
      const squirrelY = 195 - hop;
      const facing = Math.cos(clock * .75) > 0 || squirrelHop > .18 ? 1 : -1;
      view.put(squirrel(view.unit), squirrelX, squirrelY, { flip: facing, scale: 1.05 });
      return [[squirrelX / 1000, (squirrelY - 12) / 420], [boarX / 1000, (boarY - 8) / 420]];
    }
  };

  // ---------------------------------------------------------------- Moonlit Ruins
  function column(ctx, random, x, top, broken) {
    const stone = [130, 116, 118];
    const shaft = broken
      ? `M${x},211 L${x},${top + 6} L${x + 8},${top - 6} L${x + 15},${top + 4} L${x + 24},${top - 10} L${x + 31},${top + 2} L${x + 42},${top - 3} L${x + 42},211 Z`
      : `M${x},211 L${x + 2},${top} L${x + 40},${top} L${x + 42},211 Z`;
    shape(ctx, shaft, gradient(ctx, x, 0, x + 42, 0, stone, [-.15, .3, .05, -.3, -.45]), 1.2, LINE);
    clipped(ctx, shaft, () => {
      for (const flute of [9, 17, 25, 33]) {
        box(ctx, x + flute, top - 12, 2.2, 225 - top, 'rgba(26,20,40,.34)', 0);
        box(ctx, x + flute + 2.2, top - 12, 1, 225 - top, 'rgba(230,220,255,.2)', 0);
      }
      for (let y = top + 22; y < 205; y += 26) stroke(ctx, `M${x},${y} q21,4 42,0`, 'rgba(34,26,40,.65)', 1.2);
      speckle(ctx, random, 80, [x, top - 8, x + 42, 211], 'rgba(235,220,240,.2)', 'rgba(24,18,34,.34)', 3);
    });
    for (let i = 0; i < 2; i++) {
      const y = top + random() * (190 - top);
      stroke(ctx, `M${x + random() * 30},${y} l${random() * 10 - 5},${9 + random() * 8} l${random() * 12 - 6},${7 + random() * 9}`, 'rgba(28,20,34,.7)', 1);
    }
    if (!broken) {
      // Capital with a scroll at each end.
      box(ctx, x - 8, top - 9, 58, 7, tone(stone, .22), 1);
      box(ctx, x - 3, top - 2, 48, 6, tone(stone, .05), 1);
      for (const cx of [x - 3, x + 45]) {
        disc(ctx, cx, top + 2, 5.4, tone(stone, .15), 1);
        disc(ctx, cx, top + 2, 2, tone(stone, -.3), .7);
      }
    }
    box(ctx, x - 6, 199, 54, 7, tone(stone, .12), 1);
    box(ctx, x - 12, 206, 66, 8, tone(stone, -.1), 1);
    // Ivy creeping up some of them.
    if (random() > .45) {
      const side = random() > .5 ? x + 4 : x + 36;
      stroke(ctx, `M${side},211 C${side - 14},180 ${side + 12},165 ${side - 3},${Math.max(top + 20, 130)}`, '#31442f', 1.8);
      leaves(ctx, random, 40, [side, 178, 11, 34], [[62, 92, 66], [84, 112, 76], [48, 74, 58]], 5.4);
    }
  }
  const bird = (unit, wing) => sprite('bird' + wing, [-15, -12, 16, 10], unit, g => {
    const tip = wing ? 7 : -9;
    shape(g, `M-2,-1 C-5,${tip * .6} -9,${tip} -14,${tip} C-8,${tip * .35} -6,3 -1,2 Z`, '#22263a', .8, 'rgba(170,170,210,.55)');
    shape(g, 'M-9,1 L-14,0 L-13,4 L-6,3 C-2,5 4,4 6,1 C9,1 11,0 14,-1 L9,-3 C8,-5 4,-5 3,-3 C0,-3 -4,-1 -9,1 Z', '#2e3248', .8, 'rgba(170,170,210,.55)');
    shape(g, `M0,0 C2,${tip * .8} 7,${tip * 1.1} 12,${tip} C8,${tip * .4} 7,2 3,2 Z`, '#3c415c', .8, 'rgba(180,180,220,.6)');
    disc(g, 7, -2.6, .8, '#f4d27a', 0);
  });
  const firefly = unit => sprite('firefly', [-9, -9, 9, 9], unit, g => {
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 9);
    glow.addColorStop(0, 'rgba(255,250,200,.95)');
    glow.addColorStop(.22, 'rgba(255,230,140,.6)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = glow;
    g.fillRect(-9, -9, 18, 18);
  });

  scenes[2] = {
    backdrop(ctx) {
      const random = seeded(832);
      ctx.lineJoin = ctx.lineCap = 'round';
      const sky = ctx.createLinearGradient(0, 0, 0, 235);
      sky.addColorStop(0, '#1e2440');
      sky.addColorStop(.6, '#54486a');
      sky.addColorStop(1, '#b0806e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 1000, 420);
      for (let i = 0; i < 130; i++) {
        const x = random() * 1000;
        const y = random() * 140;
        const r = .4 + random() * .9;
        disc(ctx, x, y, r, `rgba(255,244,214,${.35 + random() * .5})`, 0);
        if (i % 19 === 0) stroke(ctx, `M${x - 4},${y} H${x + 4} M${x},${y - 4} V${y + 4}`, 'rgba(255,244,214,.55)', .6);
      }
      // A full moon with maria and a halo, behind thin clouds.
      const halo = ctx.createRadialGradient(720, 65, 20, 720, 65, 110);
      halo.addColorStop(0, 'rgba(246,225,190,.4)');
      halo.addColorStop(1, 'rgba(246,225,190,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(600, -50, 240, 240);
      disc(ctx, 720, 65, 29, gradient(ctx, 695, 40, 745, 92, [238, 220, 190], [.5, .1, -.15]), 0);
      for (const [x, y, r] of [[710, 55, 7], [728, 72, 9], [714, 78, 4], [734, 52, 4], [702, 68, 3]]) disc(ctx, x, y, r, 'rgba(150,126,130,.32)', 0);
      for (const [x, y, w] of [[610, 84, 190], [700, 46, 130], [120, 58, 220], [380, 100, 170]]) {
        shape(ctx, `M${x},${y} C${x + w * .2},${y - 10} ${x + w * .35},${y - 3} ${x + w * .5},${y - 8} C${x + w * .7},${y - 12} ${x + w * .8},${y - 2} ${x + w},${y} C${x + w * .6},${y + 5} ${x + w * .3},${y + 3} ${x},${y} Z`, 'rgba(120,108,150,.42)', 0);
      }
      shape(ctx, 'M0,156 L70,120 L160,87 L205,118 L261,149 L322,128 L390,103 L470,134 L547,163 L610,135 L672,114 L740,138 L814,159 L912,126 L1000,99 L1000,223 L0,221 Z', gradient(ctx, 0, 90, 0, 220, [86, 92, 118], [.1, -.15]), 1, LINE);
      shape(ctx, 'M0,187 L90,160 L176,134 L260,163 L337,184 L454,153 L568,187 L660,170 L753,157 L870,172 L1000,151 L1000,225 L0,225 Z', gradient(ctx, 0, 134, 0, 225, [64, 62, 84], [.08, -.2]), 1, LINE);
      for (let i = 0; i < 70; i++) {
        const x = random() * 1000;
        const y = 178 + random() * 22;
        const h = 10 + random() * 16;
        shape(ctx, `M${x},${y} L${x - h * .26},${y} L${x},${y - h} L${x + h * .26},${y} Z`, 'rgba(36,40,58,.85)', 0);
      }
      // The colonnade.
      for (let index = 0; index < 7; index++) {
        const broken = index === 2 || index === 3;
        column(ctx, random, 88 + index * 137, broken ? 155 : 54 + random() * 59, broken);
      }
      // Half of an arch still springs from the first broken column.
      shape(ctx, 'M370,158 C378,110 446,90 492,96 L486,113 C452,110 408,122 402,158 Z', gradient(ctx, 370, 96, 492, 158, [118, 104, 112], [.2, -.25]), 1.2, LINE);
      for (const [x, y] of [[386, 130], [418, 108], [456, 101]]) stroke(ctx, `M${x - 8},${y - 8} L${x + 6},${y + 6}`, 'rgba(36,28,44,.7)', 1);
      ground(ctx, random, [128, 108, 112]);
      // Cracked flagstones, fallen blocks and a toppled drum.
      for (let i = 0; i < 48; i++) {
        const y = 232 + random() * 180;
        const x = random() * 1000;
        const w = 26 + (y - 220) * .3 + random() * 34;
        const h = w * (.16 + random() * .08);
        shape(ctx, `M${x},${y} L${x + w * .8},${y - h * .2} L${x + w},${y + h * .7} L${x + w * .18},${y + h} Z`, `rgba(160,146,160,${.1 + random() * .12})`, .9, 'rgba(34,26,42,.4)');
      }
      for (let i = 0; i < 36; i++) {
        const x = random() * 1000;
        const y = 214 + random() * (x < 95 || x > 910 ? 172 : 22);
        const s = 4 + random() * 11;
        shape(ctx, `M${x - s},${y} L${x - s * .7},${y - s * .7} L${x + s * .2},${y - s * .85} L${x + s * .8},${y - s * .5} L${x + s},${y} Z`, tone([130, 118, 128], random() * .2 - .1), .9, LINE);
        shape(ctx, `M${x - s * .7},${y - s * .7} L${x + s * .2},${y - s * .85} L${x - s * .1},${y - s * .4} Z`, 'rgba(230,220,250,.25)', 0);
      }
      shape(ctx, 'M884,224 C880,206 890,198 904,198 L952,200 C966,204 968,226 954,232 L900,232 C892,232 886,230 884,224 Z', gradient(ctx, 0, 198, 0, 232, [124, 110, 118], [.2, -.35]), 1.3, LINE);
      for (const x of [912, 926, 940]) stroke(ctx, `M${x},200 q-6,16 0,31`, 'rgba(32,24,42,.5)', 1.6);
      for (let i = 0; i < 40; i++) {
        const x = random() * 1000;
        const side = x < 110 || x > 890;
        const y = 216 + random() * (side ? 190 : 18);
        for (let k = -2; k <= 2; k++) stroke(ctx, `M${x + k},${y} q${k},-5 ${k * 3},-${5 + random() * 7}`, i % 2 ? '#4a5a52' : '#6a7260', 1.1);
      }
      vignette(ctx, 1000, 420, 'rgba(190,170,230,.09)', 'rgba(10,8,26,.52)');
    },

    // Same flight paths as the original, so the click targets follow them.
    draw(ctx, width, height, clock, reactions) {
      const view = stage(ctx, width, height);
      const scatter = Math.sin(reactions[0] * Math.PI / 2) ** 2;
      const stirred = Math.sin(reactions[1] * Math.PI / 2) ** 2;
      const birdsX = 335 + Math.sin(clock * .35) * 120 + scatter * 98;
      const birdsY = 100 + Math.cos(clock * .53) * 14 - scatter * 42;
      for (let i = 0; i < 4; i++) {
        const wing = Math.sin(clock * 9 - i * .68) > 0 ? 1 : 0;
        view.put(bird(view.unit, wing), birdsX - 36 * i - scatter * i * 8, birdsY + 9 * i + (i % 2) * 7 - scatter * (i % 2) * 14, { scale: 1.05 - i * .07 });
      }
      for (let i = 0; i < 19; i++) {
        const x = 692 + 125 * Math.sin(i * 17 + clock * .75 + stirred * i * .21);
        const y = 203 + Math.cos(i * 13 - clock * 1.13) * 33 - stirred * 41;
        const glint = 1.4 + (Math.sin(clock * 3 + i) + 1) * .55;
        view.put(firefly(view.unit), x, y, { scale: glint * .48 });
      }
      return [[birdsX / 1000, birdsY / 420], [.70, .49]];
    }
  };

  return {
    backdrop: (ctx, index, width, height) => scenes[index].backdrop(ctx, width, height),
    draw: (ctx, index, width, height, clock, active) => scenes[index].draw(ctx, width, height, clock, active)
  };
})();
