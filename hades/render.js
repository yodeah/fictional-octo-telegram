// The picture: a high three-quarter camera over a painted Underworld arena, inked procedural
// fighters built from 3D joints, and all effects. Reads the duel, never changes it.
(function (root) {
  const { weapons, shields, spells, arena, moves } = root.HadesData;
  const Sprites = root.HadesSprites;

  const K = .64;      // how much floor depth is foreshortened
  const Z = .80;      // how tall one unit of height appears
  const ink = '#0b1116';
  const looks = Sprites.looks;
  const steel = '#c9d6dc', gold = '#d9a84e';
  const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let canvas, ctx, width = 0, height = 0, unit = 40, dpr = 1;
  let floor, decals, decalCtx, pillarSprite, brazierSprite;
  const bounds = { x: -15, y: -10, w: 30, h: 20 }; // painted area, in screen units
  const camera = { x: 0, y: 0, zoom: 1 };
  let particles = [], floaters = [], trails = [], ghosts = [], rings = [], pools = [];
  let shake = 0, clock = 0;
  const fallen = new Map();
  const shown = [];
  let vignette, fallArt, mistArt, shaftArt, shadeArt;
  let excitement = 0;
  const bursts = new Map();
  let impacts = [];

  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);

  function noise(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.ceil(w), height: Math.ceil(h) });

  // ---- Static scenery ----

  function ellipsePath(g, x, y, rx, ry) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  function blob(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function paintFloor(g) {
    const r = noise(71);
    const water = g.createRadialGradient(0, 0, 3, 0, 0, 17);
    water.addColorStop(0, '#127a6c');
    water.addColorStop(.55, '#14305c');
    water.addColorStop(1, '#14082a');
    g.fillStyle = water;
    g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${90 + r() * 80},230,210,${.04 + r() * .09})`;
      g.lineWidth = .04;
      const x = bounds.x + r() * bounds.w, y = bounds.y + r() * bounds.h;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + .5, y - .12, x + 1 + r(), y);
      g.stroke();
    }
    cavern(g);
    const rx = arena.a + .75, ry = (arena.b + .75) * K;
    platformWall(g, rx, ry);
    ellipsePath(g, 0, 0, rx, ry);
    g.fillStyle = '#2d6a63';
    g.fill();
    g.save();
    ellipsePath(g, 0, 0, rx - .12, ry - .08);
    g.clip();
    paving(g, r);
    fissures(g, r);
    seal(g, r);
    debris(g, noise(57), rx, ry);
    floorLight(g, ry);
    const light = g.createRadialGradient(-2, -1.5, 1, 0, 0, rx);
    light.addColorStop(0, 'rgba(150,255,225,.14)');
    light.addColorStop(.65, 'rgba(10,50,60,0)');
    light.addColorStop(1, 'rgba(2,14,24,.55)');
    g.fillStyle = light;
    g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    g.restore();
    platformRim(g, rx, ry);
    surroundings(g, r, rx, ry);
  }

  // Painted light: the sunset spills over the far side, the water throws teal up from the flanks,
  // and the rest falls toward violet shadow. Drawn inside the floor's clip.
  function floorLight(g, ry) {
    const pool = (x, y, radius, rgb, alpha, mode = 'screen') => {
      g.save();
      g.globalCompositeOperation = mode;
      g.translate(x, y);
      g.scale(1, K);
      const light = g.createRadialGradient(0, 0, 0, 0, 0, radius);
      light.addColorStop(0, `rgba(${rgb},${alpha})`);
      light.addColorStop(.55, `rgba(${rgb},${alpha * .45})`);
      light.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = light;
      g.fillRect(-radius, -radius, radius * 2, radius * 2);
      g.restore();
    };
    pool(0, -ry - .5, 7.5, '255,120,120', .34);
    pool(-10.5, .5, 6, '60,255,215', .2);
    pool(10.5, .5, 6, '60,255,215', .2);
    pool(0, .2, 4.2, '255,225,160', .12);
    pool(-8, ry, 7, '60,20,110', .42, 'multiply');
    pool(8, ry, 7, '60,20,110', .42, 'multiply');
  }

  // The drop below the floor: a lit stone wall with arched niches, falling into shadow.
  function platformWall(g, rx, ry) {
    const deep = 1.5;
    ellipsePath(g, 0, deep + .12, rx + .22, ry + .1);
    g.fillStyle = 'rgba(0,8,16,.6)';
    g.fill();
    const slices = 30;
    for (let i = slices; i >= 0; i--) {
      const t = i / slices;
      ellipsePath(g, 0, t * deep, rx, ry);
      g.fillStyle = `hsl(${184 + t * 55}, 38%, ${25 - t * 17}%)`;
      g.fill();
    }
    const at = (a, down) => [Math.cos(a) * rx, Math.sin(a) * ry + down];
    const count = 34;
    for (let i = 0; i <= count / 2; i++) {
      const a = i / (count / 2) * Math.PI;
      // Buttresses between the niches.
      const [x, y] = at(a, 0);
      shapeAt(g, [[x - .13, y + .18], [x + .13, y + .18], [x + .09, y + deep * .92], [x - .09, y + deep * .92]], '#2c5c62', .05);
      g.fillStyle = 'rgba(170,245,225,.22)';
      g.fillRect(x - .09, y + .22, .05, deep * .6);
      const mid = a + Math.PI / count;
      if (mid > Math.PI - .05) continue;
      const [mx, my] = at(mid, 0);
      const wide = .26 * Math.max(.3, Math.sin(mid));
      shapeAt(g, [[mx - wide, my + 1.05], [mx - wide, my + .55], [mx, my + .32], [mx + wide, my + .55], [mx + wide, my + 1.05]], '#061820', .06);
      const lit = i % 3 === 1;
      blob(g, mx, my + .72, .24, lit ? 'rgba(255,160,90,.28)' : 'rgba(110,255,220,.18)');
      blob(g, mx, my + .74, .07, lit ? '#ffc07a' : '#8ff7da');
    }
    for (const [down, wide, color] of [[.16, .13, '#8a6a30'], [deep * .94, .1, '#4c4a3a']]) {
      g.beginPath();
      g.ellipse(0, down, rx, ry, 0, 0, Math.PI);
      g.strokeStyle = ink;
      g.lineWidth = wide + .08;
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = wide;
      g.stroke();
    }
  }

  // The edge of the floor: a Greek key inlaid in gold, a heavy lip and jeweled bosses.
  function platformRim(g, rx, ry) {
    const keys = 58;
    // u runs around the ring (one key per unit), v from the edge inward.
    const at = (u, v) => {
      const a = u / keys * Math.PI * 2;
      return [Math.cos(a) * (rx - v), Math.sin(a) * (ry - v * K)];
    };
    const path = points => {
      g.beginPath();
      points.forEach(([u, v], i) => g[i ? 'lineTo' : 'moveTo'](...at(u, v)));
    };
    const ring = v => Array.from({ length: keys * 4 + 1 }, (_, i) => [i / 4, v]);
    g.lineJoin = 'round';
    path([...ring(.12), ...ring(.72).reverse()]);
    g.closePath();
    g.fillStyle = 'rgba(8,26,34,.82)';
    g.fill();
    for (const v of [.2, .66]) {
      path(ring(v));
      g.strokeStyle = 'rgba(201,164,84,.85)';
      g.lineWidth = .045;
      g.stroke();
    }
    for (let i = 0; i < keys; i++) {
      path([[i, .58], [i, .28], [i + .76, .28], [i + .76, .5], [i + .26, .5], [i + .26, .39], [i + .5, .39]]);
      g.strokeStyle = '#d2ab58';
      g.lineWidth = .055;
      g.stroke();
      path([[i, .58], [i + 1, .58]]);
      g.stroke();
    }
    ellipsePath(g, 0, 0, rx - .06, ry - .04);
    for (const [wide, color] of [[.32, ink], [.2, '#8f6c2e'], [.07, '#f0cf7e']]) {
      g.strokeStyle = color;
      g.lineWidth = wide;
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const [x, y] = at(i / 24 * keys, .06);
      const big = i % 3 === 0, size = big ? .27 : .15;
      blob(g, x, y, size, ink);
      blob(g, x, y - .02, size * .74, '#c79c48');
      blob(g, x - size * .18, y - size * .22, size * .22, '#ffeaa8');
      if (!big) continue;
      blob(g, x, y - .02, size * .42, ink);
      blob(g, x, y - .02, size * .32, i % 6 ? '#6ff0cd' : '#ff6a7c');
      blob(g, x - .03, y - .06, size * .1, '#ffffff');
    }
  }

  // The far side of the cavern, painted back to front: each layer nearer, darker and sharper.
  function cavern(g) {
    const r = noise(307);
    const left = bounds.x, right = bounds.x + bounds.w, top = bounds.y;
    const sky = g.createLinearGradient(0, top, 0, -3.8);
    sky.addColorStop(0, '#12061f');
    sky.addColorStop(.4, '#3a1648');
    sky.addColorStop(.62, '#8a2f5c');
    sky.addColorStop(.74, 'rgba(48,50,92,.95)');
    sky.addColorStop(1, 'rgba(20,60,90,0)');
    g.fillStyle = sky;
    g.fillRect(left, top, bounds.w, -3.8 - top);
    // A pale sun of the underworld behind the ruins.
    const sun = g.createRadialGradient(0, -6.6, .1, 0, -6.6, 4.5);
    sun.addColorStop(0, 'rgba(255,205,150,.75)');
    sun.addColorStop(.25, 'rgba(255,120,110,.3)');
    sun.addColorStop(1, 'rgba(255,90,120,0)');
    g.fillStyle = sun;
    g.fillRect(-5, -10, 10, 5);
    const ridge = (base, low, high, color, edge) => {
      const points = [[left, base + 1]];
      for (let x = left; x <= right; x += .5 + r() * .8) points.push([x, base - low - r() ** 2 * (high - low)]);
      points.push([right, base - low], [right, base + 1]);
      shapeAt(g, points, color, 0);
      g.strokeStyle = edge;
      g.lineWidth = .05;
      g.beginPath();
      points.slice(1, -1).forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
      g.stroke();
    };
    ridge(-6.1, .35, 1.9, '#4a2058', 'rgba(255,140,150,.45)');
    ruins(g, r);
    const shore = g.createLinearGradient(0, -6.4, 0, -4.5);
    shore.addColorStop(0, '#1d1638');
    shore.addColorStop(.45, 'rgba(28,30,66,.85)');
    shore.addColorStop(1, 'rgba(20,48,80,0)');
    ridge(-5.5, .2, .9, shore, 'rgba(120,200,220,.35)');
    // Stone teeth hanging from the roof.
    for (let x = left; x < right; x += .55 + r() * .9) {
      const long = .5 + r() ** 2 * 2.6 + (Math.abs(x) > 8 ? 1 : 0), wide = .18 + r() * .34;
      const y = -9.3;
      shapeAt(g, [[x - wide, top], [x + wide, top], [x + wide * .6, y + long * .35], [x + r() * .1, y + long], [x - wide * .55, y + long * .3]], '#10061b', .04);
      g.strokeStyle = 'rgba(200,110,170,.35)';
      g.lineWidth = .04;
      g.beginPath();
      g.moveTo(x - wide * .55, y + long * .3);
      g.lineTo(x + r() * .1, y + long);
      g.stroke();
    }
    // Haze where the cavern meets the water.
    const haze = g.createLinearGradient(0, -6.4, 0, -4.4);
    haze.addColorStop(0, 'rgba(60,220,200,0)');
    haze.addColorStop(.5, 'rgba(70,230,205,.22)');
    haze.addColorStop(1, 'rgba(40,160,170,0)');
    g.fillStyle = haze;
    g.fillRect(left, -6.4, bounds.w, 2);
    // Broken reflections of the sunset on the water.
    for (let i = 0; i < 130; i++) {
      const y = -5.4 + r() * 1.5, x = (r() - .5) * (2 + (y + 5.4) * 5);
      g.fillStyle = `rgba(255,${140 + r() * 90},150,${.08 + r() * .2})`;
      g.fillRect(x, y, .1 + r() * .55, .035);
    }
  }

  // A drowned temple on the horizon: colonnades, broken pediments and lit doorways.
  function ruins(g, r) {
    const stoneDark = '#2b1440', stoneLit = '#6b2e63';
    for (const [cx, columns, tall, broken] of [[-10.6, 4, 2.1, true], [-5.4, 5, 1.7, false], [5.6, 5, 1.7, false], [10.8, 4, 2.2, true], [0, 3, 1.15, true]]) {
      const base = -5.75, wide = columns * .52;
      shapeAt(g, [[cx - wide / 2 - .3, base + .5], [cx - wide / 2 - .15, base], [cx + wide / 2 + .15, base], [cx + wide / 2 + .3, base + .5]], stoneDark, .05);
      for (let i = 0; i < columns; i++) {
        const x = cx - wide / 2 + i * .52 + .26;
        const high = broken && r() < .45 ? tall * (.35 + r() * .4) : tall;
        shapeAt(g, [[x - .13, base], [x - .11, base - high], [x + .11, base - high], [x + .13, base]], stoneDark, .04);
        g.fillStyle = stoneLit;
        g.fillRect(x - .08, base - high + .04, .05, high - .08);
        if (high === tall) g.fillRect(x - .17, base - high - .07, .34, .07);
        // A doorway glows between some of the columns.
        if (i < columns - 1 && r() < .5) {
          blob(g, x + .26, base - .28, .34, 'rgba(255,190,110,.16)');
          shapeAt(g, [[x + .18, base], [x + .18, base - .34], [x + .26, base - .46], [x + .34, base - .34], [x + .34, base]], '#ffc176', .03);
        }
      }
      const y = base - tall - .07;
      if (!broken) {
        shapeAt(g, [[cx - wide / 2 - .1, y], [cx - wide / 2 - .1, y - .2], [cx + wide / 2 + .1, y - .2], [cx + wide / 2 + .1, y]], stoneLit, .05);
        shapeAt(g, [[cx - wide / 2 - .2, y - .2], [cx, y - .85], [cx + wide / 2 + .2, y - .2]], stoneDark, .05);
        blob(g, cx, y - .43, .12, '#ffc176');
      } else {
        shapeAt(g, [[cx - wide / 2 - .1, y], [cx - wide / 2 - .1, y - .2], [cx - .1, y - .2], [cx + .12, y]], stoneLit, .05);
      }
    }
  }

  // Islands of rock in the dark water, then the colonnade and guardians along the far side.
  function surroundings(g, r, rx, ry) {
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, far = 1.12 + r() * .5;
      const x = Math.cos(a) * rx * far, y = Math.sin(a) * ry * far;
      if (y < -5.2) continue;
      rock(g, x, y, .25 + r() * .6, r);
    }
    const around = (a, out = 1.05) => [Math.cos(a) * (rx + out), Math.sin(a) * (ry + out * .9)];
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * Math.PI * 2 + .1;
      const [x, y] = around(a);
      if (Math.sin(a) < -.35) continue;
      if (i % 2) urn(g, x, y + .1, .5 + r() * .25);
    }
    // Far side, drawn from the corners inward so nearer pieces overlap farther ones.
    for (const [a, kind, tall] of [[-1.571, 'statue'], [-2.0, 'column', 2.6], [-1.14, 'column', 2.6], [-2.36, 'statue'], [-.78, 'statue'],
      [-2.68, 'column', 1.7], [-.46, 'column', 2.1], [-2.94, 'column', 2.3], [-.2, 'column', 1.4]]) {
      const [x, y] = around(a, .35);
      // Kept low enough that heads and fire bowls stay inside the camera's view.
      g.save();
      g.translate(x, y);
      g.scale(.66, .66);
      if (kind === 'column') column(g, 0, 0, tall * .8, r);
      else statue(g, 0, 0, x > .1 ? -1 : 1);
      g.restore();
    }
  }

  // What earlier bouts left behind near the edge: old bloodstains, broken blades, a dropped shield,
  // a dented helmet and spent arrows. Painted into the floor once, so it costs nothing per frame.
  function debris(g, r, rx, ry) {
    const spot = (d0, d1) => {
      const a = r() * Math.PI * 2, d = d0 + r() * (d1 - d0);
      return [Math.cos(a) * d * rx, Math.sin(a) * d * ry];
    };
    for (let i = 0; i < 16; i++) {
      const [x, y] = spot(.45, .92), size = .25 + r() * .45;
      for (let k = 0; k < 4; k++) {
        g.fillStyle = `rgba(${60 + r() * 30},8,${18 + r() * 10},${.16 + r() * .14})`;
        g.beginPath();
        g.ellipse(x + (r() - .5) * size, y + (r() - .5) * size * K, size * (.3 + r() * .5), size * K * (.25 + r() * .4), r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < 5; k++) blob(g, x + (r() - .5) * size * 2.4, y + (r() - .5) * size * 1.4 * K, .02 + r() * .04, 'rgba(70,6,16,.35)');
    }
    const shadow = (x, y, w) => {
      g.fillStyle = 'rgba(0,12,18,.4)';
      g.beginPath();
      g.ellipse(x + .06, y + .06, w * 1.7, w * 1.7 * K * .45, 0, 0, Math.PI * 2);
      g.fill();
    };
    const kinds = ['blade', 'arrows', 'shield', 'spear', 'helm', 'arrows', 'blade', 'shield', 'arrows', 'helm'];
    for (const kind of kinds) {
      const [x, y] = spot(.74, .88), turn = r() * Math.PI * 2;
      const c = Math.cos(turn), sn = Math.sin(turn);
      const S = 1.7;
      const at = (u, v) => [x + (u * c - v * sn) * S, y + (u * sn + v * c) * K * S];
      if (kind === 'blade') {
        shadow(x, y, .4);
        shapeAt(g, [at(-.36, -.04), at(-.12, -.05), at(.18, -.04), at(.26, .02), at(.12, .05), at(-.36, .04)], '#a9bcc6', .03);
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .015;
        g.beginPath(); g.moveTo(...at(-.3, -.015)); g.lineTo(...at(.12, -.02)); g.stroke();
        shapeAt(g, [at(-.4, -.13), at(-.36, -.13), at(-.36, .13), at(-.4, .13)], '#8a6a2e', .025);
        shapeAt(g, [at(-.58, -.035), at(-.4, -.035), at(-.4, .035), at(-.58, .035)], '#4a2a1c', .025);
        blob(g, ...at(-.6, 0), .045, '#b58a3a');
      } else if (kind === 'spear') {
        shadow(x, y, .7);
        g.strokeStyle = ink; g.lineWidth = .075;
        g.beginPath(); g.moveTo(...at(-.75, 0)); g.lineTo(...at(.4, 0)); g.stroke();
        g.strokeStyle = '#7a4a2c'; g.lineWidth = .045;
        g.beginPath(); g.moveTo(...at(-.75, 0)); g.lineTo(...at(.4, 0)); g.stroke();
        shapeAt(g, [at(.38, -.07), at(.7, 0), at(.38, .07)], '#a9bcc6', .025);
        // Snapped: a splintered stub lies apart from the head.
        g.strokeStyle = '#5e3824'; g.lineWidth = .04;
        g.beginPath(); g.moveTo(...at(-.9, .2)); g.lineTo(...at(-1.15, .32)); g.stroke();
      } else if (kind === 'shield') {
        shadow(x, y, .38);
        g.save();
        g.translate(x, y);
        g.scale(S, K * S);
        g.rotate(turn);
        for (const [rad, color] of [[.36, '#8a6a2e'], [.3, r() < .5 ? '#7c2230' : '#25507e'], [.08, '#c39b4c']]) {
          g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2);
          g.fillStyle = color; g.fill();
          g.strokeStyle = ink; g.lineWidth = .03; g.stroke();
        }
        g.strokeStyle = 'rgba(10,4,8,.8)'; g.lineWidth = .025;
        g.beginPath(); g.moveTo(.06, -.06); g.lineTo(.18, -.16); g.lineTo(.16, -.26); g.stroke();
        g.restore();
      } else if (kind === 'helm') {
        shadow(x, y, .28);
        g.save();
        g.translate(x, y);
        g.scale(S, K * S);
        g.fillStyle = '#9a7432'; g.strokeStyle = ink; g.lineWidth = .03;
        g.beginPath(); g.ellipse(0, .03, .27, .2, turn, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#7d8e9a';
        g.beginPath(); g.arc(0, -.02, .17, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.beginPath(); g.arc(-.05, -.07, .05, 0, Math.PI * 2); g.fill();
        g.restore();
      } else {
        for (let k = 0; k < 3; k++) {
          const u = (r() - .5) * .8, v = (r() - .5) * .8, a2 = turn + (r() - .5) * .8;
          const tip = [x + u + Math.cos(a2) * .5, y + (v + Math.sin(a2) * .5) * K], tail = [x + u - Math.cos(a2) * .5, y + (v - Math.sin(a2) * .5) * K];
          g.strokeStyle = ink; g.lineWidth = .045;
          g.beginPath(); g.moveTo(...tail); g.lineTo(...tip); g.stroke();
          g.strokeStyle = '#d6b27a'; g.lineWidth = .022;
          g.beginPath(); g.moveTo(...tail); g.lineTo(...tip); g.stroke();
          blob(g, ...tail, .07, k % 2 ? '#c83b3b' : '#f2ead8');
        }
      }
    }
  }

  function shapeAt(g, points, color, line = .07) {
    g.beginPath();
    points.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = line;
    g.lineJoin = 'round';
    g.stroke();
  }

  function rock(g, x, y, s, r) {
    const top = Array.from({ length: 7 }, (_, i) => {
      const a = i / 7 * Math.PI * 2, reach = s * (.7 + r() * .55);
      return [x + Math.cos(a) * reach, y + Math.sin(a) * reach * .5];
    });
    g.strokeStyle = 'rgba(110,235,215,.2)';
    g.lineWidth = .06;
    ellipsePath(g, x, y + s * .42, s * 1.35, s * .55);
    g.stroke();
    shapeAt(g, [top[0], [x + s * .6, y + s * .55], [x, y + s * .8], [x - s * .65, y + s * .5], top[3], top[2], top[1]], '#0c2432');
    shapeAt(g, top, `hsl(${178 + r() * 40}, 32%, ${18 + r() * 9}%)`, .05);
    shapeAt(g, [top[4], top[5], top[6], [x, y - s * .05]], 'rgba(150,235,215,.16)', 0);
  }

  // A hooded guardian leaning on a greatsword, facing into the arena.
  function statue(g, x, y, turn) {
    const at = list => list.map(([dx, dy]) => [x + dx * turn, y - dy]);
    shapeAt(g, at([[-.95, 0], [-.8, .5], [.8, .5], [.95, 0]]), '#1b414a');
    shapeAt(g, at([[-.95, .5], [-.95, .66], [.95, .66], [.95, .5]]), '#8d7440');
    shapeAt(g, at([[-.75, .66], [-.58, 1.9], [-.3, 2.35], [.3, 2.35], [.58, 1.9], [.75, .66]]), '#3f7478');
    shapeAt(g, at([[.05, .68], [.12, 2.3], [.3, 2.35], [.58, 1.9], [.75, .66]]), '#24505a', 0);
    for (const fold of [-.46, -.2, .3, .54]) shapeAt(g, at([[fold, .68], [fold * .55, 1.7], [fold + .07, .68]]), '#1d444e', 0);
    shapeAt(g, at([[-.36, 2.2], [-.42, 2.75], [0, 3.15], [.42, 2.75], [.36, 2.2], [0, 2.05]]), '#4b8586');
    shapeAt(g, at([[-.22, 2.35], [-.24, 2.7], [0, 2.86], [.24, 2.7], [.22, 2.35], [0, 2.22]]), '#07151d', .04);
    for (const dx of [-.09, .09]) {
      blob(g, x + dx, y - 2.55, .09, 'rgba(120,255,220,.22)');
      blob(g, x + dx, y - 2.55, .035, '#c8fff0');
    }
    shapeAt(g, at([[-.09, 1.7], [-.14, .78], [0, .62], [.14, .78], [.09, 1.7]]), '#a9c9c9');
    shapeAt(g, at([[0, 1.7], [.09, 1.7], [.14, .78], [0, .62]]), '#5e868e', 0);
    shapeAt(g, at([[-.4, 1.68], [-.4, 1.86], [.4, 1.86], [.4, 1.68]]), '#c39b4c');
    shapeAt(g, at([[-.34, 1.86], [-.2, 2.12], [.2, 2.12], [.34, 1.86]]), '#4b8586');
    shapeAt(g, at([[-.62, 1.85], [-.9, 2.2], [-.42, 2.28], [-.3, 2.05]]), '#8d7440');
    shapeAt(g, at([[.62, 1.85], [.9, 2.2], [.42, 2.28], [.3, 2.05]]), '#6d5830');
  }

  // One cut stone: face, lit upper edge, shaded lower edge and a few chips.
  function stone(g, points, color, r) {
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const inset = points.map(([x, y]) => {
      const d = Math.hypot(cx - x, cy - y) || 1;
      return [x + (cx - x) / d * .07, y + (cy - y) / d * .07];
    });
    const path = () => {
      g.beginPath();
      inset.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
      g.closePath();
    };
    path();
    g.fillStyle = color;
    g.fill();
    g.save();
    path();
    g.clip();
    for (const [dx, dy, tone] of [[.07, .09, 'rgba(190,255,235,.22)'], [-.08, -.1, 'rgba(0,8,24,.5)']]) {
      g.save();
      g.translate(dx, dy);
      path();
      g.strokeStyle = tone;
      g.lineWidth = .1;
      g.stroke();
      g.restore();
    }
    for (let i = 0; i < 7; i++) {
      blob(g, cx + (r() - .5) * 1.1, cy + (r() - .5) * 1.1, .02 + r() * .06, r() < .5 ? 'rgba(0,20,30,.24)' : 'rgba(180,240,220,.12)');
    }
    if (r() < .3) {
      g.strokeStyle = 'rgba(4,20,28,.65)';
      g.lineWidth = .028;
      let x = cx + (r() - .5) * .6, y = cy - .6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo(x += r() * .46 - .23, y += .24);
      g.stroke();
    }
    g.restore();
  }

  const stoneColor = (r, lift = 0) => `hsl(${172 + r() * 34}, ${26 + r() * 18}%, ${16 + r() * 10 + lift * .7}%)`;

  // Uneven flagstones on the diagonal, ringed by a course of curved stones around the seal.
  function paving(g, r) {
    g.save();
    g.scale(1, K);
    g.fillStyle = '#0d2a30';
    g.fillRect(-14, -12, 28, 24);
    g.save();
    g.rotate(Math.PI / 4);
    const size = 1.5, n = 11;
    const corner = [];
    for (let i = 0; i <= n * 2; i++) {
      corner[i] = [];
      for (let j = 0; j <= n * 2; j++) corner[i][j] = [(i - n) * size + (r() - .5) * .48, (j - n) * size + (r() - .5) * .48];
    }
    for (let i = 0; i < n * 2; i++) for (let j = 0; j < n * 2; j++) {
      const a = corner[i][j], b = corner[i + 1][j], c = corner[i + 1][j + 1], d = corner[i][j + 1];
      const half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      // Some slabs are split in two so the courses never line up too neatly.
      if (r() < .28) {
        stone(g, [a, half(a, b), half(d, c), d], stoneColor(r), r);
        stone(g, [half(a, b), b, c, half(d, c)], stoneColor(r), r);
      } else stone(g, [a, b, c, d], stoneColor(r), r);
    }
    g.restore();
    for (const [inner, outer, count] of [[2.9, 3.75, 20]]) {
      blob(g, 0, 0, outer + .06, '#0b252c');
      for (let i = 0; i < count; i++) {
        const from = i / count * Math.PI * 2, to = (i + 1) / count * Math.PI * 2;
        const at = (a, radius) => [Math.cos(a) * radius, Math.sin(a) * radius];
        stone(g, [at(from, inner), at(from, outer), at((from + to) / 2, outer), at(to, outer), at(to, inner), at((from + to) / 2, inner)],
          stoneColor(r, i % 2 ? 4 : 10), r);
      }
    }
    g.restore();
  }

  // Cracks where the light of the underworld shows through.
  function fissures(g, r) {
    g.save();
    g.scale(1, K);
    g.lineCap = g.lineJoin = 'round';
    for (const [startX, startY, heading] of [[-9.5, 3.2, -.35], [8.8, -5.2, 2.2], [3.6, 7.6, -1.9], [-6.2, -7.4, 1.2], [9.9, 4.4, 3.5]]) {
      const points = [[startX, startY]];
      let x = startX, y = startY;
      for (let i = 0; i < 8; i++) {
        const a = heading + (r() - .5) * 1.5;
        points.push([x += Math.cos(a) * .52, y += Math.sin(a) * .52]);
      }
      for (const [w, color] of [[.46, 'rgba(60,255,200,.09)'], [.2, 'rgba(80,255,210,.22)'], [.1, '#04141a'], [.035, '#8dffe0']]) {
        for (let i = 1; i < points.length; i++) {
          g.strokeStyle = color;
          g.lineWidth = w * (1 - i / points.length * .75);
          g.beginPath();
          g.moveTo(...points[i - 1]);
          g.lineTo(...points[i]);
          g.stroke();
        }
      }
    }
    g.restore();
  }

  // The central seal: an inlaid sunburst in gold on dark stone.
  function seal(g, r) {
    g.save();
    g.scale(1, K);
    blob(g, 0, 0, 2.86, ink);
    blob(g, 0, 0, 2.78, '#8d6a2e');
    blob(g, 0, 0, 2.62, '#123a42');
    const point = (a, radius) => [Math.cos(a) * radius, Math.sin(a) * radius];
    const shard = (a, inner, outer, wide, light, dark) => {
      for (const [side, color] of [[-1, light], [1, dark]]) {
        g.beginPath();
        g.moveTo(...point(a, outer));
        g.lineTo(...point(a + side * wide, inner));
        g.lineTo(...point(a, inner * .82));
        g.closePath();
        g.fillStyle = color;
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = .028;
        g.stroke();
      }
    };
    for (let i = 0; i < 8; i++) shard(i / 8 * Math.PI * 2 + Math.PI / 8, .8, 1.9, .3, '#2f8f82', '#1c5f63');
    for (let i = 0; i < 8; i++) shard(i / 8 * Math.PI * 2, .85, 2.5, .2, '#f2cf73', '#9c7430');
    for (let i = 0; i < 32; i++) blob(g, ...point(i / 32 * Math.PI * 2, 2.7), .045, '#ffe7a0');
    for (const [radius, w, color] of [[2.52, .045, '#e8d08a'], [2.02, .025, 'rgba(232,208,138,.6)'], [.95, .1, gold]]) {
      g.strokeStyle = color;
      g.lineWidth = w;
      ellipsePath(g, 0, 0, radius, radius);
      g.stroke();
    }
    blob(g, 0, 0, .86, '#0e2f38');
    for (let i = 0; i < 3; i++) shard(i / 3 * Math.PI * 2 - Math.PI / 2, .28, .8, .55, '#b6ffe6', '#4fc7ac');
    blob(g, 0, 0, .2, ink);
    blob(g, 0, 0, .14, '#d8fff2');
    // Wear, so the inlay sits in the floor.
    for (let i = 0; i < 240; i++) {
      blob(g, ...point(r() * Math.PI * 2, Math.sqrt(r()) * 2.75), .015 + r() * .05, 'rgba(8,30,36,.35)');
    }
    g.restore();
  }

  // A fluted column; the taller ones carry a fire bowl, the rest are snapped off.
  function column(g, x, y, tall, r) {
    const box = (x0, y0, w, h, color, line) => shapeAt(g, [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], color, line);
    box(x - .62, y - .22, 1.24, .24, '#8d7440');
    box(x - .5, y - .38, 1, .17, '#1f4a52');
    const broken = tall < 1.75;
    const crown = broken ? [[x - .4, y - tall], [x - .14, y - tall + .22], [x + .04, y - tall - .14], [x + .2, y - tall + .16], [x + .4, y - tall + .02]]
      : [[x - .38, y - tall], [x + .38, y - tall]];
    shapeAt(g, [[x - .43, y - .36], ...crown, [x + .43, y - .36]], '#2f626a');
    for (const [dx, w, color] of [[-.33, .13, 'rgba(170,250,230,.28)'], [-.1, .09, 'rgba(170,250,230,.12)'], [.1, .12, 'rgba(2,14,26,.3)'], [.28, .13, 'rgba(2,14,26,.5)']]) {
      box(x + dx, y - tall + .26, w, tall - .62, color, 0);
    }
    box(x - .46, y - .62, .92, .13, '#b28d47', .05);
    if (broken) {
      for (let k = 0; k < 3; k++) rock(g, x + (r() - .5) * 1.8, y + .15, .14 + r() * .16, r);
      return;
    }
    box(x - .55, y - tall - .2, 1.1, .22, '#b28d47');
    shapeAt(g, [[x - .62, y - tall - .55], [x + .62, y - tall - .55], [x + .34, y - tall - .2], [x - .34, y - tall - .2]], '#6d5830');
    box(x - .68, y - tall - .66, 1.36, .13, '#d4ad5c', .05);
    for (const [dx, dy, rad, color] of [[0, 1.25, 1.3, 'rgba(80,255,210,.08)'], [0, .95, .7, 'rgba(100,255,220,.16)']]) blob(g, x, y - tall - dy, rad, color);
    shapeAt(g, [[x - .4, y - tall - .66], [x - .18, y - tall - 1.2], [x - .08, y - tall - .95], [x + .06, y - tall - 1.55],
      [x + .2, y - tall - 1.02], [x + .34, y - tall - 1.18], [x + .42, y - tall - .66]], '#4fe8c4', .04);
    shapeAt(g, [[x - .2, y - tall - .66], [x - .04, y - tall - 1.06], [x + .08, y - tall - .86], [x + .22, y - tall - .66]], '#e4fff6', 0);
  }

  function urn(g, x, y, s) {
    g.lineWidth = .07;
    g.strokeStyle = ink;
    g.fillStyle = '#8c3b3a';
    g.beginPath();
    g.moveTo(x - s * .3, y - s * 1.2);
    g.bezierCurveTo(x - s * .9, y - s * .6, x - s * .5, y, x - s * .2, y);
    g.lineTo(x + s * .2, y);
    g.bezierCurveTo(x + s * .5, y, x + s * .9, y - s * .6, x + s * .3, y - s * 1.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = gold;
    g.fillRect(x - s * .38, y - s * 1.3, s * .76, s * .14);
    g.fillRect(x - s * .55, y - s * .66, s * 1.1, s * .09);
  }

  // The four cover blocks: carved stone plinths on the diagonal.
  function paintPillar(g, r) {
    const n = noise(19);
    const corners = [0, 1, 2, 3].map(i => [Math.cos(i * Math.PI / 2) * r * 1.12, Math.sin(i * Math.PI / 2) * r * 1.12 * K]);
    const tall = 1.05 * Z;
    const face = (a, b, from, to, color) => {
      g.beginPath();
      g.moveTo(a[0], a[1] - from);
      g.lineTo(b[0], b[1] - from);
      g.lineTo(b[0], b[1] - to);
      g.lineTo(a[0], a[1] - to);
      g.closePath();
      g.fillStyle = color;
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = .055;
      g.stroke();
    };
    const [east, south, west] = corners;
    face(west, south, 0, tall, '#2f5f66');
    face(south, east, 0, tall, '#1d3f4b');
    for (const [from, to] of [[0, .16], [tall - .2, tall]]) {
      face(west, south, from, to, '#c0964a');
      face(south, east, from, to, '#83652f');
    }
    // A carved medallion with a gem on each face, and vines spilling over the rim.
    for (const [side, lit] of [[[west, south], true], [[south, east], false]]) {
      const x = (side[0][0] + side[1][0]) / 2, y = (side[0][1] + side[1][1]) / 2 - tall / 2;
      const slope = (side[1][1] - side[0][1]) / (side[1][0] - side[0][0]);
      g.save();
      g.translate(x, y);
      g.transform(1, slope, 0, 1, 0, 0);
      shapeAt(g, [[0, -.27], [.24, 0], [0, .27], [-.24, 0]], lit ? '#b8903f' : '#7d5f2a', .04);
      shapeAt(g, [[0, -.15], [.13, 0], [0, .15], [-.13, 0]], lit ? '#7ff5d2' : '#43b8a0', .03);
      shapeAt(g, [[0, -.15], [0, 0], [-.13, 0]], 'rgba(255,255,255,.55)', 0);
      for (const dx of [-.34, .34]) blob(g, dx, 0, .035, '#d9b866');
      g.restore();
    }
    g.beginPath();
    corners.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y - tall));
    g.closePath();
    g.fillStyle = '#10272e';
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = .055;
    g.stroke();
    // The top: a recessed stone slab ringed in gold with a glowing gem, no growth.
    const top = scale => corners.map(([x, y]) => [x * scale, y * scale - tall]);
    const slab = (points, fill, line) => {
      g.beginPath();
      points.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      if (!line) return;
      g.strokeStyle = line;
      g.lineWidth = .035;
      g.stroke();
    };
    slab(top(.96), '#3c6a70');
    slab(top(.78), '#264c55', '#c0964a');
    slab(top(.5), '#1a3a44', '#83652f');
    const gem = g.createRadialGradient(0, -tall, 0, 0, -tall, r * .4);
    gem.addColorStop(0, 'rgba(160,255,225,.9)');
    gem.addColorStop(.35, 'rgba(70,200,170,.45)');
    gem.addColorStop(1, 'rgba(70,200,170,0)');
    g.fillStyle = gem;
    g.fillRect(-r, -tall - r * .5, r * 2, r);
    shapeAt(g, [[0, -tall - .1], [.14, -tall], [0, -tall + .1], [-.14, -tall]], '#7ff5d2', .025);
    // Chipped edges and a crack so the stone reads as old.
    g.strokeStyle = 'rgba(8,20,26,.8)';
    g.lineWidth = .03;
    g.beginPath();
    g.moveTo(west[0] * .9, west[1] * .9 - tall + .02);
    g.lineTo(west[0] * .6, west[1] * .6 - tall + .1);
    g.lineTo(west[0] * .45, west[1] * .4 - tall + .05);
    g.stroke();
  }

  // Effect art is painted once, like Hades' effect frames, then rotated and stamped.
  function crescentArt(rgb, spread, heavy) {
    const size = 256, c = makeCanvas(size, size), g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    const R = size / 2 - 4, half = spread / 2 + .35;
    const band = (outer, inner, from, color) => {
      g.beginPath();
      g.arc(0, 0, outer, from, half);
      for (let i = 20; i >= 0; i--) {
        const a = mix(from, half, i / 20);
        const r = mix(outer, inner, Math.sin(i / 20 * Math.PI * .62));
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    const fade = (color) => {
      const gradient = g.createLinearGradient(Math.cos(half) * R, Math.sin(half) * R, Math.cos(-half) * R, Math.sin(-half) * R);
      gradient.addColorStop(0, `rgba(${color},.05)`);
      gradient.addColorStop(.75, `rgba(${color},.85)`);
      gradient.addColorStop(1, `rgba(${color},1)`);
      return gradient;
    };
    band(R, R * (heavy ? .34 : .5), -half, fade(rgb));
    band(R * .98, R * (heavy ? .68 : .76), -half + .1, fade('255,240,205'));
    band(R * .95, R * .87, -half + .2, fade('255,255,255'));
    // Torn speed streaks inside the sweep.
    const r = noise(7);
    for (let i = 0; i < 16; i++) {
      const radius = R * (.42 + r() * .5), from = -half + r() * spread * .6;
      g.strokeStyle = `rgba(${rgb},${.25 + r() * .55})`;
      g.lineWidth = 1 + r() * 4;
      g.beginPath();
      g.arc(0, 0, radius, from, from + .25 + r() * .8);
      g.stroke();
    }
    return c;
  }

  function burstArt(rgb) {
    if (bursts.has(rgb)) return bursts.get(rgb);
    const size = 192, c = makeCanvas(size, size), g = c.getContext('2d');
    const r = noise(31);
    g.translate(size / 2, size / 2);
    for (const [scale, color] of [[1, `rgba(${rgb},.95)`], [.62, '#fff2d0'], [.34, '#ffffff']]) {
      g.beginPath();
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * Math.PI * 2;
        const length = (i % 2 ? .14 : .45 + r() * .55) * size / 2 * scale;
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * length, Math.sin(a) * length);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
    }
    bursts.set(rgb, c);
    return c;
  }

  const crescents = new Map();
  function crescent(team, spread, heavy) {
    const key = team + ':' + spread + ':' + heavy;
    if (!crescents.has(key)) crescents.set(key, crescentArt(looks[team].glow, spread, heavy));
    return crescents.get(key);
  }

  // The screen-edge shadow, painted once per size.
  function paintFrame() {
    vignette = makeCanvas(width * dpr / 2, height * dpr / 2);
    let g = vignette.getContext('2d');
    const w = vignette.width, h = vignette.height;
    const edge = g.createRadialGradient(w / 2, h / 2, h * .38, w / 2, h / 2, w * .64);
    edge.addColorStop(0, 'rgba(6,8,30,0)');
    edge.addColorStop(1, 'rgba(8,2,26,.74)');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
  }

  // Falling water and mist are painted once and slid past each frame.
  function paintWeather() {
    fallArt = makeCanvas(96, 256);
    let g = fallArt.getContext('2d');
    const r = noise(41);
    for (let i = 0; i < 90; i++) {
      const x = 6 + r() * 84, y = r() * 256, long = 30 + r() * 100, wide = 1 + r() * 4;
      for (const shift of [0, -256]) {
        const streak = g.createLinearGradient(0, y + shift, 0, y + shift + long);
        streak.addColorStop(0, 'rgba(120,255,225,0)');
        streak.addColorStop(.7, `rgba(${150 + r() * 100},255,235,${.35 + r() * .5})`);
        streak.addColorStop(1, 'rgba(120,255,225,0)');
        g.fillStyle = streak;
        g.fillRect(x, y + shift, wide, long);
      }
    }
    // A beam that is brightest at its core and top, fading out below.
    shaftArt = makeCanvas(128, 512);
    g = shaftArt.getContext('2d');
    for (let i = 0; i < 64; i++) {
      const edge = Math.sin((i + .5) / 64 * Math.PI) ** 2;
      const fade = g.createLinearGradient(0, 0, 0, 512);
      fade.addColorStop(0, `rgba(255,235,205,${edge * .9})`);
      fade.addColorStop(.6, `rgba(190,245,230,${edge * .35})`);
      fade.addColorStop(1, 'rgba(190,245,230,0)');
      g.fillStyle = fade;
      g.fillRect(i * 2, 0, 2, 512);
    }
    mistArt = makeCanvas(512, 96);
    g = mistArt.getContext('2d');
    for (let i = 0; i < 70; i++) {
      // Puffs stop short of the ends: neighboring strips overlap there without a visible join.
      const x = 48 + r() * 416, y = 48 + (r() - .5) * 34, rad = 16 + r() * 28;
      const puff = g.createRadialGradient(x, y, 0, x, y, rad);
      puff.addColorStop(0, 'rgba(150,235,225,.2)');
      puff.addColorStop(1, 'rgba(150,235,225,0)');
      g.fillStyle = puff;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  function drawFalls() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, top, bottom, wide] of [[-6.3, -7.7, -5.45, .8], [-2.5, -7.1, -5.35, .55], [2.5, -7.1, -5.35, .55], [6.3, -7.7, -5.45, .8]]) {
      const left = sx(x - wide / 2), width = wide * unit, from = top * unit, height = (bottom - top) * unit;
      ctx.save();
      ctx.beginPath();
      // The sheet widens as it drops.
      ctx.moveTo(left + width * .22, from);
      ctx.lineTo(left + width * .78, from);
      ctx.lineTo(left + width, from + height);
      ctx.lineTo(left, from + height);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(45,190,175,.2)';
      ctx.fillRect(left, from, width, height);
      for (const [speed, alpha] of [[1.5, .55], [.9, .3]]) {
        const slide = (clock * speed + x) % 1 * height;
        ctx.globalAlpha = alpha;
        ctx.drawImage(fallArt, left, from + slide - height, width, height);
        ctx.drawImage(fallArt, left, from + slide, width, height);
      }
      ctx.restore();
      const pulse = Math.sin(clock * 5 + x) * .08;
      glow(sx(x), bottom * unit, unit * wide * (1.15 + pulse), '110,255,220', .42);
      glow(sx(x), top * unit, unit * wide * .7, '110,255,220', .22);
      for (let i = 0; i < 5; i++) {
        const t = (clock * .9 + i / 5 + x) % 1;
        glow(sx(x + (i - 2) * wide * .22), (bottom - Math.sin(t * Math.PI) * .45) * unit, unit * .09, '200,255,240', 1 - t);
      }
    }
    ctx.restore();
  }

  // The audience: shades of the dead, painted calm and cheering.
  function paintShades(res) {
    shadeArt = [false, true].map(cheer => {
      const c = makeCanvas(1.5 * res, 1.9 * res), g = c.getContext('2d');
      g.setTransform(res, 0, 0, res, .75 * res, 1.7 * res);
      const body = g.createLinearGradient(0, -1.35, 0, .1);
      body.addColorStop(0, '#9ef5e0');
      body.addColorStop(.6, '#3f9fb0');
      body.addColorStop(1, 'rgba(40,80,140,0)');
      if (cheer) for (const side of [-1, 1]) {
        shapeAt(g, [[side * .2, -.68], [side * .62, -1.24], [side * .7, -1.1], [side * .32, -.5]], '#6ccfcb', .05);
        blob(g, side * .68, -1.22, .09, '#aef8e6');
      }
      g.beginPath();
      g.moveTo(-.4, .05);
      g.bezierCurveTo(-.42, -.6, -.36, -1.35, 0, -1.4);
      g.bezierCurveTo(.36, -1.35, .42, -.6, .4, .05);
      // A ragged, trailing hem instead of feet.
      for (const [x, y] of [[.24, -.14], [.12, .12], [0, -.1], [-.14, .14], [-.26, -.12]]) g.lineTo(x, y);
      g.closePath();
      g.fillStyle = body;
      g.fill();
      g.strokeStyle = 'rgba(10,20,40,.8)';
      g.lineWidth = .055;
      g.stroke();
      shapeAt(g, [[-.2, -.92], [-.18, -1.16], [0, -1.24], [.18, -1.16], [.2, -.92], [0, -.82]], '#0a1c2c', .035);
      for (const dx of [-.08, .08]) {
        blob(g, dx, -1.02, .075, 'rgba(190,255,235,.35)');
        blob(g, dx, -1.02, cheer ? .04 : .03, '#f2fffa');
      }
      if (cheer) blob(g, 0, -.9, .045, '#bfffee');
      return c;
    });
  }

  const shadeSpots = [[-10.1, -4.7], [-9.2, -5.25], [-6.9, -5.7], [-3.75, -5.55], [-2.9, -5.75], [-1.45, -5.6],
    [1.45, -5.6], [2.95, -5.75], [3.7, -5.5], [6.85, -5.7], [9.25, -5.2], [10.15, -4.65],
    // Along the flanks, where they stay in sight when the camera closes in.
    [-10.9, -2.9], [-11.6, -1.1], [-11.35, .9], [10.9, -2.9], [11.6, -1.1], [11.35, .9]];

  function drawCrowd() {
    ctx.save();
    shadeSpots.forEach(([x, y], i) => {
      const bob = Math.sin(clock * 1.6 + i * 2.3) * .07;
      // Each one takes a different amount of excitement to get going, and hops on its own beat.
      const keen = clamp(excitement * 1.6 - (i * 7 % 12) / 14, 0, 1);
      const hop = keen * Math.abs(Math.sin(clock * 9 + i * 1.7)) * .32;
      const size = .72 + (i * 5 % 4) * .05;
      const art = shadeArt[keen > .35 ? 1 : 0];
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = .62 + keen * .3;
      ctx.drawImage(art, sx(x - .75 * size), (y + bob - hop - 1.7 * size) * unit, 1.5 * size * unit, 1.9 * size * unit);
      ctx.globalCompositeOperation = 'lighter';
      glow(sx(x), (y + bob - hop - .7 * size) * unit, unit * .65, '90,230,220', .12 + keen * .2);
    });
    ctx.restore();
  }

  function drawShafts() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, wide, long, lean, phase] of [[-7.4, 2.2, 10.5, -.42, 0], [-3.2, 1.1, 9, -.36, 2.1], [3.9, 2.7, 11, -.4, 4.2], [8.6, 1.3, 9.5, -.34, 1.3]]) {
      ctx.save();
      ctx.translate(sx(x), -7.6 * unit);
      ctx.rotate(lean + Math.sin(clock * .23 + phase) * .025);
      ctx.globalAlpha = .13 + Math.sin(clock * .6 + phase) * .035;
      ctx.drawImage(shaftArt, -wide / 2 * unit, 0, wide * unit, long * unit);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMist(y, speed, alpha, tall) {
    const step = 10, wide = 14 * unit, slide = ((clock * speed) % step + step) % step * unit;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    for (let x = -30 * unit + slide; x < 15 * unit; x += step * unit) ctx.drawImage(mistArt, x, (y - tall / 2) * unit, wide, tall * unit);
    ctx.restore();
  }

  let sized = false;
  function resize() {
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    // A hidden tab or pane can load with no layout; wait until the canvas has a size.
    sized = canvas.clientWidth > 0 && canvas.clientHeight > 0;
    if (!sized) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    unit = Math.min(width / 23.6, height / 13);
    // Painted once a little above screen resolution so zooming stays sharp.
    const res = unit * dpr * 1.25;
    const old = decals;
    floor = makeCanvas(bounds.w * res, bounds.h * res);
    decals = makeCanvas(bounds.w * res, bounds.h * res);
    for (const layer of [floor, decals]) {
      const g = layer.getContext('2d');
      g.setTransform(res, 0, 0, res, -bounds.x * res, -bounds.y * res);
      if (layer === floor) paintFloor(g);
      else decalCtx = g;
    }
    if (old) {
      decalCtx.drawImage(old, bounds.x, bounds.y, bounds.w, bounds.h);
    }
    pillarSprite = makeCanvas(3 * res, 3.4 * res);
    brazierSprite = makeCanvas(2 * res, 2 * res);
    const bg = brazierSprite.getContext('2d');
    bg.setTransform(res, 0, 0, res, res, 1.6 * res);
    paintBrazier(bg);
    const g = pillarSprite.getContext('2d');
    g.setTransform(res, 0, 0, res, 1.5 * res, 2.5 * res);
    paintPillar(g, arena.pillars[0].r);
    Sprites.setResolution(unit * dpr * 1.25);
    paintFrame();
    paintWeather();
    paintShades(unit * dpr * 1.25);
  }

  // ---- Projection and primitives ----

  const sx = x => x * unit;
  const sy = (y, z = 0) => (y * K - z * Z) * unit;
  const point = p => [sx(p[0]), sy(p[1], p[2])];

  // An inked limb: a round-capped line with an outline, optionally bent through several joints.
  function limb(points, thickness, color, shine = true) {
    const path = points.map(point);
    ctx.lineCap = ctx.lineJoin = 'round';
    const stroke = (w, c, dx = 0) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      path.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x + dx, y + dx));
      ctx.stroke();
    };
    stroke(thickness * unit + Math.max(2.4, unit * .075), ink);
    stroke(thickness * unit, color);
    if (shine && thickness > .09) stroke(thickness * unit * .28, 'rgba(255,245,220,.24)', -thickness * unit * .22);
  }

  function shape(points, color, outline = true) {
    ctx.beginPath();
    points.map(point).forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (!outline) return;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.2, unit * .04);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function orb(p, radius, color, outline = true) {
    const [x, y] = point(p);
    ctx.beginPath();
    ctx.arc(x, y, radius * unit, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (!outline) return;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.3, unit * .045);
    ctx.stroke();
  }

  // Gradients are costly to create every frame, so each color is painted once and stamped.
  const glows = new Map();
  function glow(x, y, radius, rgb, alpha) {
    let stamp = glows.get(rgb);
    if (!stamp) {
      stamp = makeCanvas(128, 128);
      const g = stamp.getContext('2d');
      const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, `rgba(${rgb},1)`);
      gradient.addColorStop(.35, `rgba(${rgb},.55)`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gradient;
      g.fillRect(0, 0, 128, 128);
      glows.set(rgb, stamp);
    }
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * Math.min(1, alpha);
    ctx.drawImage(stamp, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = before;
  }

  const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

  // ---- Fighters ----

  // Which baked animation and moment shows the fighter's current state.
  function animation(duel, f) {
    const fall = fallen.get(f.index);
    if (fall) return ['dead', null, fall.age / .6];
    if (f.frozenUntil > duel.time) return ['idle', null, 0];
    if (f.stunnedUntil > duel.time) return ['stun', null, duel.time * 1.1];
    if (f.dash) return ['dash', null, 1 - (f.dash.until - duel.time) / moves[f.dash.kind].time];
    const a = f.action;
    if (a) {
      const shapeName = a.kind === 'bash' ? 'bash' : a.shape;
      if (a.t < a.windup) return ['windup', shapeName, a.t / a.windup];
      const swing = a.active + .06;
      if (a.t < a.windup + swing) return ['active', shapeName, (a.t - a.windup) / swing];
      return ['recover', shapeName, (a.t - a.windup - swing) / Math.max(.1, a.recover - .06)];
    }
    if (duel.time - f.lastHurt < .16) return ['hurt', null, 0];
    if (f.gait > .18) return ['run', null, f.stride / 2.1];
    return ['idle', null, duel.time * .8 + f.index * .37];
  }

  const specOf = (duel, f) => {
    const { kit } = f;
    const info = shields[kit.shield];
    const held = kit.shield !== 'none' && f.shieldHits > 0 && !weapons[f.weapon].twoHanded;
    return {
      team: f.team, kit: f.kitKey, armor: kit.armor, weapon: f.weapon, spare: f.weapon === kit.weapon ? kit.reserve : kit.weapon,
      shield: held ? kit.shield : null, cracks: held ? info.durability - f.shieldHits : 0,
      frozen: f.frozenUntil > duel.time && !f.dead
    };
  };

  function blit(sprite, x, y) {
    ctx.drawImage(sprite.image, sx(x) + sprite.x * unit, sy(y) + sprite.y * unit, sprite.w * unit, sprite.h * unit);
  }

  function drawFighter(duel, f) {
    const [anim, shapeName, progress] = animation(duel, f);
    const fall = fallen.get(f.index);
    // A falling body keeps facing the blow that felled it, so it topples along it.
    const facing = fall ? Math.atan2(-fall.y, -fall.x) : f.facing;
    const sprite = Sprites.get(specOf(duel, f), facing, anim, shapeName, progress);
    shown[f.index] = sprite;
    blit(sprite, f.x, f.y);
    const hurt = 1 - (duel.time - f.lastHurt) / .13;
    if (hurt > 0 && !f.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = hurt * .6;
      blit(sprite, f.x, f.y);
      ctx.restore();
    }
    const a = f.action;
    if (a && a.t < a.windup && (a.shape === 'bolt' || a.shape === 'nova' || a.shape === 'self')) {
      const spell = spells[a.spellKey];
      const t = a.t / a.windup;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(sx(f.x + Math.cos(f.facing) * .6), sy(f.y + Math.sin(f.facing) * .6, 1.3), unit * (.3 + t * .8),
        spell ? hexRgb(spell.color) : looks[f.team].glow, .3 + t * .55);
      ctx.restore();
    }
    if (f.frozenUntil > duel.time && !f.dead) {
      ctx.save();
      ctx.globalAlpha = .6;
      for (let i = 0; i < 9; i++) {
        const angle = i * 2.4, r = .5 + (i % 3) * .12, tall = .45 + (i % 4) * .22;
        const bx = f.x + Math.cos(angle) * r, by = f.y + Math.sin(angle) * r;
        shape([[bx - .14, by, 0], [bx, by, tall], [bx + .14, by, 0]], '#c5ecff');
      }
      ctx.restore();
    }
    if (f.stunnedUntil > duel.time && !f.dead) {
      for (let i = 0; i < 3; i++) {
        const angle = clock * 4 + i * 2.1;
        orb([f.x + Math.cos(angle) * .45, f.y + Math.sin(angle) * .28, 3], .09, '#ffe36e');
      }
    }
    if (f.ward > 0 && !f.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = f.wardColor;
      ctx.globalAlpha = .55 + Math.sin(clock * 6) * .2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx(f.x), sy(f.y, 1.05), unit * .95, unit * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      glow(sx(f.x), sy(f.y, 1.05), unit * 1.3, hexRgb(f.wardColor), .22);
      ctx.restore();
    }
  }

  // ---- Ground markings ----

  function groundPath(points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](sx(x), sy(y)));
    ctx.closePath();
  }

  function sector(x, y, angle, reach, spread) {
    const points = [[x, y]];
    for (let i = 0; i <= 16; i++) {
      const a = angle - spread / 2 + spread * i / 16;
      points.push([x + Math.cos(a) * reach, y + Math.sin(a) * reach]);
    }
    return points;
  }

  const circle = (x, y, r) => Array.from({ length: 36 }, (_, i) =>
    [x + Math.cos(i / 36 * Math.PI * 2) * r, y + Math.sin(i / 36 * Math.PI * 2) * r]);

  // Wind-ups are written on the floor so a dodge reads as a choice.
  function telegraph(f) {
    const a = f.action;
    if (!a || a.t >= a.windup || a.shape === 'self') return;
    const t = a.t / a.windup;
    const rgb = looks[f.team].glow;
    const paint = (points, alpha, line = true) => {
      groundPath(points);
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.fill();
      if (!line) return;
      ctx.strokeStyle = `rgba(${rgb},.75)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    if (a.shape === 'slam') {
      const x = f.x + Math.cos(a.angle) * a.reach, y = f.y + Math.sin(a.angle) * a.reach;
      paint(circle(x, y, a.radius), .1);
      paint(circle(x, y, a.radius * t), .26, false);
    } else if (a.shape === 'nova') {
      paint(circle(f.x, f.y, a.reach), .08);
      paint(circle(f.x, f.y, a.reach * t), .2, false);
    } else if (a.shape === 'bolt') {
      const c = Math.cos(a.angle), s = Math.sin(a.angle);
      ctx.strokeStyle = `rgba(${rgb},${.25 + t * .5})`;
      ctx.lineWidth = 1 + t * 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(sx(f.x + c * .8), sy(f.y + s * .8));
      ctx.lineTo(sx(f.x + c * 5), sy(f.y + s * 5));
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      paint(sector(f.x, f.y, a.angle, a.reach + .3, a.spread), .09);
      paint(sector(f.x, f.y, a.angle, (a.reach + .3) * t, a.spread), .22, false);
    }
  }

  function footing(f) {
    const rgb = looks[f.team].glow;
    ctx.fillStyle = 'rgba(0,12,18,.46)';
    ctx.beginPath();
    ctx.ellipse(sx(f.x), sy(f.y), unit * .62, unit * .62 * K, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.dead) return;
    ctx.strokeStyle = `rgba(${rgb},.95)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(sx(f.x), sy(f.y), unit * .7, unit * .7 * K, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The wedge shows which way the fighter faces.
    paintWedge(f, rgb);
  }

  function paintWedge(f, rgb) {
    const at = (angle, r) => [f.x + Math.cos(angle) * r, f.y + Math.sin(angle) * r];
    groundPath([at(f.facing, 1.05), at(f.facing + .3, .72), at(f.facing - .3, .72)]);
    ctx.fillStyle = `rgba(${rgb},.95)`;
    ctx.fill();
  }

  // ---- Effects ----

  function spray(x, y, z, count, colors, { dirX = 0, dirY = 0, speed = 3, up = 2.5, gravity = 8, size = .06, life = .5, glowing = false, stain = false } = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), v = rand(.2, 1) * speed;
      particles.push({
        x, y, z, vx: Math.cos(a) * v * .6 + dirX * v, vy: Math.sin(a) * v * .6 + dirY * v, vz: rand(.2, 1) * up,
        gravity, size: size * rand(.6, 1.5), life: life * rand(.6, 1.3), age: 0,
        color: colors[Math.floor(Math.random() * colors.length)], glowing, stain
      });
    }
  }

  const bloods = ['#a3122a', '#c71f35', '#6d0c1e'];

  function stain(x, y, r, alpha = .75) {
    decalCtx.fillStyle = `rgba(${Math.round(rand(80, 125))},8,26,${alpha})`;
    decalCtx.beginPath();
    decalCtx.ellipse(x, y * K, r, r * K, 0, 0, Math.PI * 2);
    decalCtx.fill();
  }

  function floater(who, text, color, size = 1, tag = '') {
    floaters.push({ x: who.x + rand(-.3, .3), y: who.y, z: 2.8, text, tag, color, size, age: 0 });
  }

  const jolt = amount => { if (!reducedMotion) shake = Math.max(shake, amount); };

  const thrills = { hit: .12, block: .08, stagger: .3, wallslam: .4, shieldbreak: .35, freeze: .25, death: 1.6 };

  function onEvent(e, duel) {
    const who = duel.fighters[e.who];
    const thrill = (thrills[e.type] || 0) + (e.type === 'hit' && (e.heavy || e.critical) || e.perfect ? .3 : 0);
    // Small blows alone never stack into a full cheer; only a death holds it.
    excitement = e.type === 'death' ? thrill : Math.min(.9, excitement + thrill);
    if (e.type === 'hit') {
      const rgb = e.color || (e.critical ? '#ffd23f' : '#fff4e6');
      if (e.damage) {
        floater(who, String(e.damage), rgb, clamp(.85 + e.damage / 45, .9, 1.9) * (e.critical ? 1.18 : 1),
          e.rear ? 'BACKSTAB' : e.critical ? 'CRITICAL' : e.warded ? e.warded + ' WARDED' : '');
      } else floater(who, 'ABSORBED', who.wardColor || '#fff', .9);
      if (e.style !== 'magic' && e.damage) {
        spray(who.x, who.y, 1.2, Math.min(40, 8 + e.damage), bloods, { dirX: e.dirX, dirY: e.dirY, speed: e.heavy ? 5.5 : 3.5, stain: true, size: .075, life: .8 });
        for (let i = 0; i < (e.heavy ? 12 : 6); i++) {
          const d = rand(.3, e.heavy ? 2.4 : 1.5);
          stain(who.x + e.dirX * d + rand(-.25, .25), who.y + e.dirY * d + rand(-.25, .25), rand(.03, .16));
        }
      } else {
        spray(who.x, who.y, 1.2, 22, [e.color || '#fff', '#ffffff'], { speed: 4, gravity: 3, glowing: true, size: .07 });
      }
      rings.push({ x: who.x, y: who.y, z: 1.15, r: .2, to: e.heavy || e.critical ? 1.4 : .85, age: 0, life: .2, color: rgb });
      impacts.push({ x: who.x, y: who.y, z: 1.2, size: e.heavy || e.critical ? 2.1 : 1.3, turn: rand(0, 6.3), age: 0, life: .17, rgb: looks[duel.fighters[e.by].team].glow });
      jolt(e.heavy ? .22 : e.critical ? .16 : .07);
    } else if (e.type === 'block') {
      spray(e.x, e.y, 1.15, e.perfect ? 30 : 14, ['#ffe9a8', '#ffb63f', '#fff'], { dirX: -e.dirX, dirY: -e.dirY, speed: 4, glowing: true, size: .05, life: .3 });
      impacts.push({ x: e.x, y: e.y, z: 1.2, size: e.perfect ? 2.4 : 1.3, turn: rand(0, 6.3), age: 0, life: .2, rgb: '255,190,80' });
      floater(who, e.perfect ? 'PERFECT' : 'BLOCK', e.perfect ? '#fff0a0' : '#ffd79a', e.perfect ? 1.1 : .8);
      rings.push({ x: e.x, y: e.y, z: 1.15, r: .15, to: e.perfect ? 1.5 : .8, age: 0, life: .22, color: '#ffe2a0' });
      jolt(e.perfect ? .14 : .05);
    } else if (e.type === 'swing') {
      trails.push({ x: who.x, y: who.y, who: e.who, team: who.team, shape: e.shape, angle: e.angle, reach: e.reach, spread: e.spread, radius: e.radius, heavy: e.heavy, age: 0, life: e.heavy ? .34 : .24 });
      if (e.shape === 'slam') {
        const x = who.x + Math.cos(e.angle) * e.reach, y = who.y + Math.sin(e.angle) * e.reach;
        spray(x, y, .1, 34, ['#6fb3a3', '#9fd6c4', '#3d7a72'], { speed: 4.5, up: 3, size: .09 });
        rings.push({ x, y, z: 0, r: .3, to: e.radius * 1.15, age: 0, life: .4, color: '#d8fff0' });
        jolt(.25);
      }
      if (e.shape === 'nova') rings.push({ x: who.x, y: who.y, z: .5, r: .4, to: e.reach, age: 0, life: .35, color: '#d7c2ff' });
    } else if (e.type === 'bash') {
      floater(who, 'SHIELD BASH', '#ffe2a0', .6);
    } else if (e.type === 'kick') {
      floater(who, 'KICK', '#ffd9a8', .6);
    } else if (e.type === 'interrupt') {
      floater(who, 'INTERRUPTED', '#ff9d7a', .7);
      jolt(.1);
    } else if (e.type === 'dodge') {
      floater(who, 'DODGE', '#c8f5ff', .55);
    } else if (e.type === 'swap') {
      floater(who, weapons[e.weapon].name.toUpperCase(), '#d9f4e8', .62);
    } else if (e.type === 'dashstrike') {
      floater(who, 'DASH-STRIKE', looks[who.team].trim, .75);
      rings.push({ x: who.x, y: who.y, z: .05, r: .3, to: 1.5, age: 0, life: .28, color: looks[who.team].trim });
    } else if (e.type === 'dash' || e.type === 'roll') {
      ghosts.push({ who: e.who, left: moves[e.type].time + .05, next: 0, shots: [] });
      spray(e.from.x, e.from.y, .15, 12, ['#a8e8d8', '#e9fff8'], { dirX: -Math.cos(e.angle), dirY: -Math.sin(e.angle), speed: 2, up: .8, gravity: 1, size: .1, life: .35 });
    } else if (e.type === 'blink') {
      for (const p of [e.from, e.to]) {
        spray(p.x, p.y, .9, 26, ['#cdb4ff', '#8fe9ff', '#fff'], { speed: 2.6, up: 2, gravity: -1, glowing: true, size: .07, life: .45 });
        rings.push({ x: p.x, y: p.y, z: .05, r: 1.1, to: .15, age: 0, life: .32, color: '#c9b4ff' });
      }
      trails.push({ shape: 'streak', from: e.from, to: e.to, age: 0, life: .28 });
    } else if (e.type === 'support') {
      floater(who, e.text, e.color, 1, e.name.toUpperCase());
      spray(who.x, who.y, .4, 26, [e.color, '#fff'], { speed: 1.2, up: 3.4, gravity: -.5, glowing: true, size: .06, life: .8 });
      rings.push({ x: who.x, y: who.y, z: .05, r: .2, to: 1.3, age: 0, life: .45, color: e.color });
    } else if (e.type === 'heal') {
      floater(who, '+' + e.amount, '#c2f5a1', .85);
    } else if (e.type === 'fizzle') {
      spray(e.x, e.y, 1.1, 9, [e.color || '#d9c7a0', '#fff'], { speed: 2, gravity: 5, glowing: !!e.color, size: .05, life: .3 });
    } else if (e.type === 'stagger') {
      floater(who, 'STAGGERED', '#ffbe5c', 1);
      jolt(.14);
    } else if (e.type === 'wallslam') {
      floater(who, 'WALL SLAM', '#ff9d5c', 1.1);
      spray(e.x, e.y, .6, 26, ['#bfe0d4', '#6fa596'], { speed: 4, size: .1 });
      jolt(.3);
    } else if (e.type === 'shieldbreak') {
      floater(who, 'SHIELD BROKEN', '#ffd49c', 1);
      spray(who.x, who.y, 1.1, 22, ['#8a5a3c', '#d9a84e', '#c9a06b'], { speed: 4, size: .1, life: .8 });
    } else if (e.type === 'freeze') {
      floater(who, 'FROZEN', '#c5ecff', 1);
      spray(who.x, who.y, .8, 20, ['#c5ecff', '#fff'], { speed: 2.4, glowing: true });
    } else if (e.type === 'death') {
      fallen.set(e.who, { x: e.dirX, y: e.dirY, age: 0 });
      if (e.style !== 'magic') {
        spray(who.x, who.y, 1.2, e.heavy ? 90 : 55, bloods, { dirX: e.dirX, dirY: e.dirY, speed: e.heavy ? 7 : 4.5, up: 3.5, stain: true, size: .09, life: 1.1 });
        pools.push({ x: who.x + e.dirX * .8, y: who.y + e.dirY * .8, r: .1, to: rand(.9, 1.25) });
      }
      // A heavy blow throws the body along its line.
      who.vx += e.dirX * (e.heavy ? 14 : 5);
      who.vy += e.dirY * (e.heavy ? 14 : 5);
      jolt(.4);
    }
  }

  function updateEffects(dt, duel) {
    clock += dt;
    shake = Math.max(0, shake - dt * 1.4);
    // After a kill the crowd keeps cheering for a while.
    excitement = Math.max(0, excitement - dt * (fallen.size ? .22 : .8));
    for (const p of particles) {
      p.age += dt;
      p.vz -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 2);
      if (p.z < 0) {
        if (p.stain) { stain(p.x, p.y, p.size * rand(.8, 1.8)); p.age = p.life; }
        p.z = 0; p.vz *= -.3;
      }
    }
    particles = particles.filter(p => p.age < p.life);
    for (const group of [floaters, trails, rings, impacts]) for (const item of group) item.age += dt;
    floaters = floaters.filter(f => f.age < 1);
    trails = trails.filter(t => t.age < t.life);
    rings = rings.filter(r => r.age < r.life);
    impacts = impacts.filter(i => i.age < i.life);
    for (const g of ghosts) {
      const f = duel.fighters[g.who];
      g.left -= dt;
      g.next -= dt;
      if (g.next <= 0 && g.left > 0 && shown[g.who]) { g.next = .035; g.shots.push({ x: f.x, y: f.y, age: 0, sprite: shown[g.who] }); }
      for (const shot of g.shots) shot.age += dt;
      g.shots = g.shots.filter(s => s.age < .22);
    }
    ghosts = ghosts.filter(g => g.left > 0 || g.shots.length);
    for (const fall of fallen.values()) fall.age += dt;
    for (const pool of pools) {
      if (pool.r >= pool.to) continue;
      pool.r += dt * .5;
      stain(pool.x + rand(-.1, .1), pool.y + rand(-.1, .1), pool.r, .16);
    }
  }

  function drawTrails() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const t of trails) {
      const fade = 1 - t.age / t.life;
      if (t.shape === 'streak') {
        ctx.strokeStyle = `rgba(190,170,255,${fade * .6})`;
        ctx.lineWidth = unit * .55 * fade;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx(t.from.x), sy(t.from.y, .9));
        ctx.lineTo(sx(t.to.x), sy(t.to.y, .9));
        ctx.stroke();
        continue;
      }
      if (t.shape === 'slam' || t.shape === 'nova' || t.shape === 'kick') continue;
      const rgb = looks[t.team].glow;
      if (t.shape === 'thrust') {
        const c = Math.cos(t.angle), s = Math.sin(t.angle);
        const side = .22 * fade;
        shape([[t.x + c * .6 - s * side, t.y + s * .6 + c * side, 1.05], [t.x + c * (t.reach + .4), t.y + s * (t.reach + .4), 1.05],
          [t.x + c * .6 + s * side, t.y + s * .6 - c * side, 1.05]], `rgba(${rgb},${fade * .75})`, false);
        continue;
      }
      // A sweeping crescent, stamped flat on the plane of the swing.
      const grow = ease(clamp(t.age / (t.life * .45), 0, 1));
      const art = crescent(t.team, t.spread, !!t.heavy);
      const size = (t.reach + .55) * unit;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(sx(t.x), sy(t.y, 1.05));
      ctx.scale(1, K);
      ctx.rotate(t.angle + mix(.75, -.25, grow));
      ctx.scale(1, -1);
      ctx.drawImage(art, -size, -size, size * 2, size * 2);
      ctx.restore();
    }
    for (const hit of impacts) {
      const t = hit.age / hit.life;
      const size = unit * hit.size * (.55 + ease(Math.min(1, t * 2)) * .75);
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.translate(sx(hit.x), sy(hit.y, hit.z));
      ctx.rotate(hit.turn);
      ctx.drawImage(burstArt(hit.rgb), -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }

  // Where each arrow was first seen, so it can leave the bow at the archer's cheek and drop to
  // chest height over its flight.
  const launches = new WeakMap();

  function drawProjectile(p, duel) {
    const spell = spells[p.spellKey];
    const speed = Math.hypot(p.vx, p.vy), dx = p.vx / speed, dy = p.vy / speed;
    if (!spell && (p.weapon === 'recurve' || p.weapon === 'pilum')) {
      // A real arrow or javelin: shaft, head, fletching or weight, and a hot streak behind it.
      const javelin = p.weapon === 'pilum', long = javelin ? 1.5 : 1.1;
      let z = 1.25;
      if (!javelin) {
        if (!launches.has(p)) launches.set(p, [p.x, p.y]);
        const [x0, y0] = launches.get(p);
        z = 2.1 - .4 * Math.min(1, Math.hypot(p.x - x0, p.y - y0) / 7);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tail = ctx.createLinearGradient(sx(p.x), sy(p.y, z), sx(p.x - dx * 2.6), sy(p.y - dy * 2.6, z));
      tail.addColorStop(0, `rgba(${looks[duel.fighters[p.owner].team].glow},.55)`);
      tail.addColorStop(1, `rgba(${looks[duel.fighters[p.owner].team].glow},0)`);
      ctx.strokeStyle = tail;
      ctx.lineWidth = unit * (javelin ? .16 : .12);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y, z)); ctx.lineTo(sx(p.x - dx * 2.6), sy(p.y - dy * 2.6, z)); ctx.stroke();
      ctx.restore();
      limb([[p.x - dx * long, p.y - dy * long, z], [p.x - dx * .1, p.y - dy * .1, z]], javelin ? .08 : .055, javelin ? '#7a432c' : '#c8975c', false);
      if (javelin) {
        limb([[p.x - dx * .55, p.y - dy * .55, z], [p.x, p.y, z]], .045, '#8497a8', false);
        orb([p.x - dx * .6, p.y - dy * .6, z], .06, '#5c7080', false);
      } else {
        for (const s of [1, -1]) {
          shape([[p.x - dx * long, p.y - dy * long, z], [p.x - dx * (long - .22) + dy * .07 * s, p.y - dy * (long - .22) - dx * .07 * s, z + .04],
            [p.x - dx * (long - .3), p.y - dy * (long - .3), z]], s > 0 ? '#c83b3b' : '#f2ead8');
        }
      }
      shape([[p.x - dx * .14 + dy * .07, p.y - dy * .14 - dx * .07, z], [p.x + dx * .14, p.y + dy * .14, z], [p.x - dx * .14 - dy * .07, p.y - dy * .14 + dx * .07, z]], '#e8f3f8');
      return;
    }
    if (!spell && p.weapon === 'sling') {
      // A sling stone: a fast grey pebble with a faint streak, loosed from over the head.
      const z = 1.55;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tail = ctx.createLinearGradient(sx(p.x), sy(p.y, z), sx(p.x - dx * 1.8), sy(p.y - dy * 1.8, z));
      tail.addColorStop(0, 'rgba(235,228,210,.5)');
      tail.addColorStop(1, 'rgba(235,228,210,0)');
      ctx.strokeStyle = tail;
      ctx.lineWidth = unit * .1;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y, z)); ctx.lineTo(sx(p.x - dx * 1.8), sy(p.y - dy * 1.8, z)); ctx.stroke();
      ctx.restore();
      orb([p.x, p.y, z], .085, '#a8a196');
      orb([p.x - dx * .02, p.y - dy * .02, z + .03], .03, '#efe9dc', false);
      return;
    }
    if (!spell) {
      limb([[p.x - dx * .65, p.y - dy * .65, 1.1], [p.x, p.y, 1.1]], .065, '#e8d3a0', false);
      limb([[p.x - dx * .1, p.y - dy * .1, 1.1], [p.x + dx * .12, p.y + dy * .12, 1.1]], .1, steel, false);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(sx(p.x - dx * .4), sy(p.y - dy * .4, 1.1), unit * .45, looks[duel.fighters[p.owner].team].glow, .45);
      ctx.restore();
      return;
    }
    const rgb = hexRgb(spell.color);
    const big = spell.cost > 30 ? 1.7 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 6; i >= 0; i--) {
      const wobble = Math.sin(clock * 30 + i) * .04 * i / 3;
      glow(sx(p.x - dx * i * .22 + wobble), sy(p.y - dy * i * .22, 1.1 + wobble), unit * (.55 - i * .05) * big, rgb, .75 - i * .085);
    }
    ctx.restore();
    orb([p.x, p.y, 1.1], .14 * big, spell.color, false);
    orb([p.x, p.y, 1.1], .07 * big, '#ffffff', false);
    if (Math.random() < .5) spray(p.x, p.y, 1.1, 1, [spell.color], { speed: .6, up: .5, gravity: 2, glowing: true, size: .05, life: .35 });
  }

  function paintBrazier(g) {
    ellipsePath(g, 0, 0, .55, .2);
    g.fillStyle = 'rgba(0,10,18,.5)';
    g.fill();
    // Three clawed legs, a stem and a wide bowl.
    for (const [foot, color] of [[-.42, '#a47d36'], [.42, '#6f5224'], [0, '#c79c48']]) {
      shapeAt(g, [[-.07, -.5], [.07, -.5], [foot + .09, .04], [foot - .09, .04]], color, .05);
    }
    shapeAt(g, [[-.09, -.8], [.09, -.8], [.07, -.46], [-.07, -.46]], '#8d6a2e', .05);
    shapeAt(g, [[-.52, -1.04], [.52, -1.04], [.36, -.8], [.14, -.72], [-.14, -.72], [-.36, -.8]], '#b88f40', .06);
    shapeAt(g, [[.06, -1.02], [.5, -1.02], [.34, -.82], [.1, -.75]], '#7a5a27', 0);
    shapeAt(g, [[-.6, -1.12], [.6, -1.12], [.55, -1.0], [-.55, -1.0]], '#e8c46a', .05);
    for (const dx of [-.3, 0, .3]) blob(g, dx, -.9, .045, '#8ff7da');
  }

  // A pointed tongue of flame that sways and stretches.
  function tongue(x, y, wide, tall, lean, color) {
    ctx.beginPath();
    ctx.moveTo(x - wide, y);
    ctx.bezierCurveTo(x - wide * 1.1, y - tall * .5, x + lean - wide * .1, y - tall * .6, x + lean * 1.6, y - tall);
    ctx.bezierCurveTo(x + lean + wide * .5, y - tall * .55, x + wide * 1.2, y - tall * .4, x + wide, y);
    ctx.quadraticCurveTo(x, y + wide * .5, x - wide, y);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function brazier(x, y, hue) {
    const px = sx(x), py = sy(y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Light spilling on the floor around the stand.
    ctx.translate(px, py);
    ctx.scale(1, K);
    glow(0, 0, unit * 2.7, hue, .2 + Math.sin(clock * 7 + x) * .03);
    ctx.restore();
    ctx.drawImage(brazierSprite, px - unit, py - unit * 1.6, unit * 2, unit * 2);
    const top = py - unit * 1.08;
    const wave = k => Math.sin(clock * (7 + k * 2) + x * 3 + k * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(px, top - unit * .4, unit * 1.2, hue, .5);
    tongue(px, top, unit * .36, unit * (.95 + wave(0) * .12), unit * wave(1) * .1, `rgba(${hue},.8)`);
    tongue(px - unit * .18, top, unit * .16, unit * (.62 + wave(2) * .14), -unit * (.08 + wave(0) * .05), `rgba(${hue},.65)`);
    tongue(px + unit * .2, top, unit * .15, unit * (.55 + wave(3) * .14), unit * (.07 + wave(2) * .05), `rgba(${hue},.65)`);
    tongue(px, top, unit * .19, unit * (.55 + wave(3) * .08), unit * wave(2) * .06, 'rgba(235,255,250,.9)');
    for (let i = 0; i < 3; i++) {
      const rise = (clock * .7 + i / 3 + x) % 1;
      glow(px + unit * Math.sin(rise * 7 + i) * .25, top - unit * (.6 + rise * 1.1), unit * .1, hue, 1 - rise);
    }
    ctx.restore();
  }

  function labelFighter(f) {
    if (f.dead) return;
    const x = sx(f.x), y = sy(f.y, 3.15);
    const w = unit * 1.5, h = Math.max(4, unit * .12);
    ctx.fillStyle = ink;
    ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a1620';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = f.team ? '#52b4ff' : '#ff5c50';
    ctx.fillRect(x - w / 2, y, w * f.hp / f.maxHP, h);
    // Escape charges, as pips.
    for (let i = 0; i < moves[f.move].charges; i++) {
      ctx.fillStyle = i < f.charges ? '#d9fff1' : '#1d3b3c';
      ctx.fillRect(x - w / 2 + i * unit * .3, y + h + 4, unit * .22, Math.max(3, unit * .07));
    }
  }

  // Zooms in as far as both fighters stay fully in view, head to feet, clear of the HUD.
  function aimCamera(duel, dt) {
    const xs = duel.fighters.map(f => f.x), ys = duel.fighters.map(f => f.y);
    // A fallen body stretches well past its feet, so leave more room once someone is down.
    const sprawl = duel.winner === null ? 0 : 1.5;
    const left = Math.min(...xs) - 2.4 - sprawl, right = Math.max(...xs) + 2.4 + sprawl;
    const top = Math.min(...ys) * K - 4.2, bottom = Math.max(...ys) * K + 1.4 + sprawl;
    // Held 10% further out than a tight fit, so the fight has room around it.
    const fit = Math.min(width / unit / (right - left), height / unit / (bottom - top)) / 1.1;
    const zoom = clamp(fit, 1 / 1.1, duel.winner === null ? 1.29 : 1.18);
    // Never pan far enough to show past the painted scenery.
    const roomX = Math.max(0, 12.4 - width / unit / zoom / 2), roomY = Math.max(0, 7.6 - height / unit / zoom / 2);
    const tx = clamp((left + right) / 2, -roomX, roomX);
    const ty = clamp((top + bottom) / 2, -roomY, roomY);
    const follow = 1 - Math.exp(-dt * 3);
    camera.x += (tx - camera.x) * follow;
    camera.y += (ty - camera.y) * follow;
    camera.zoom += (zoom - camera.zoom) * follow;
  }

  function draw(duel, dt, { debug = false } = {}) {
    if (!sized || canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
    if (!sized) return;
    updateEffects(dt, duel);
    aimCamera(duel, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050f17';
    ctx.fillRect(0, 0, width, height);
    const z = camera.zoom;
    const jx = rand(-shake, shake) * unit * .5, jy = rand(-shake, shake) * unit * .5;
    ctx.setTransform(dpr * z, 0, 0, dpr * z,
      dpr * (width / 2 - camera.x * unit * z + jx), dpr * (height / 2 + unit * .55 * z - camera.y * unit * z + jy));
    ctx.drawImage(floor, bounds.x * unit, bounds.y * unit, bounds.w * unit, bounds.h * unit);
    ctx.drawImage(decals, bounds.x * unit, bounds.y * unit, bounds.w * unit, bounds.h * unit);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1, K);
    glow(0, 0, unit * 3.3, '70,255,200', .11 + Math.sin(clock * 1.7) * .045);
    ctx.restore();
    drawFalls();
    drawMist(-5.5, .35, .55, 1.7);
    drawMist(-6.6, -.2, .3, 2.2);
    drawCrowd();
    duel.fighters.forEach(telegraph);
    duel.fighters.forEach(footing);

    const items = duel.fighters.map(f => ({ y: f.y, draw: () => drawFighter(duel, f) }));
    for (const p of arena.pillars) {
      items.push({
        y: p.y + .2,
        draw: () => {
          // A block fades when someone stands behind it.
          const hiding = duel.fighters.some(f => f.y < p.y && f.y > p.y - 3 && Math.abs(f.x - p.x) < 1.2);
          ctx.globalAlpha = hiding ? .5 : 1;
          ctx.drawImage(pillarSprite, sx(p.x) - 1.5 * unit, sy(p.y) - 2.5 * unit, 3 * unit, 3.4 * unit);
          ctx.globalAlpha = 1;
        }
      });
    }
    for (const [x, y, hue] of [[-8.6, -4.9, '90,220,255'], [8.6, -4.9, '90,220,255'], [-8.9, 4.7, '120,255,190'], [8.9, 4.7, '120,255,190']]) {
      items.push({ y, draw: () => brazier(x, y, hue) });
    }
    for (const g of ghosts) for (const shot of g.shots) {
      items.push({
        y: shot.y - .01,
        draw: () => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = .5 * (1 - shot.age / .22);
          blit(shot.sprite, shot.x, shot.y);
          ctx.restore();
        }
      });
    }
    for (const p of duel.projectiles) items.push({ y: p.y, draw: () => drawProjectile(p, duel) });
    items.sort((a, b) => a.y - b.y).forEach(item => item.draw());

    drawMist(6.1, .5, .35, 1.9);
    drawShafts();
    drawTrails();
    ctx.save();
    for (const p of particles) {
      ctx.globalCompositeOperation = p.glowing ? 'lighter' : 'source-over';
      ctx.globalAlpha = clamp(2 * (1 - p.age / p.life), 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y, p.z), p.size * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      const t = r.age / r.life;
      const radius = mix(r.r, r.to, 1 - (1 - t) ** 2) * unit;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = unit * .14 * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse(sx(r.x), sy(r.y, r.z), radius, radius * (r.z > .6 ? 1 : K), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // Drifting motes.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 38; i++) {
      const x = ((i * 7.31 + Math.sin(clock * .2 + i) * 1.5 + 24) % 24) - 12;
      const rise = (clock * (.12 + i % 5 * .03) + i * .37) % 1;
      glow(sx(x), sy(((i * 3.77) % 13) - 6.5, rise * 3), unit * .13, i % 4 ? '130,255,215' : '255,230,170', Math.sin(rise * Math.PI) * .7);
    }
    ctx.restore();

    duel.fighters.forEach(labelFighter);
    if (debug) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (const body of [...duel.fighters.map(f => [f.x, f.y, root.HadesSim.radius]), ...arena.pillars.map(p => [p.x, p.y, p.r])]) {
        groundPath(circle(...body));
        ctx.stroke();
      }
      groundPath(Array.from({ length: 60 }, (_, i) => [Math.cos(i / 60 * 6.283) * arena.a, Math.sin(i / 60 * 6.283) * arena.b]));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const f of floaters) {
      const pop = 1 + Math.max(0, .14 - f.age) * 3;
      const size = Math.max(11, unit * .42 * f.size) * pop;
      const x = sx(f.x), y = sy(f.y, f.z + f.age * .9);
      ctx.globalAlpha = clamp((1 - f.age) * 3, 0, 1);
      ctx.font = `900 ${size}px "Trebuchet MS", "Avenir Next", sans-serif`;
      ctx.strokeStyle = ink;
      ctx.lineWidth = size * .24;
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
      if (f.tag) {
        ctx.font = `800 ${size * .48}px "Trebuchet MS", sans-serif`;
        ctx.strokeText(f.tag, x, y + size * .6);
        ctx.fillStyle = '#fff';
        ctx.fillText(f.tag, x, y + size * .6);
      }
      ctx.globalAlpha = 1;
    }
    // Screen-space framing.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(vignette, 0, 0, width, height);
  }

  function reset() {
    particles = []; floaters = []; trails = []; ghosts = []; rings = []; pools = []; impacts = [];
    fallen.clear();
    shake = 0;
    excitement = 0;
    Object.assign(camera, { x: 0, y: 0, zoom: 1 });
    if (decalCtx) decalCtx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }

  function init(element) {
    canvas = element;
    ctx = canvas.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
  }

  root.HadesRender = { init, draw, onEvent, reset, resize, colors: looks };
})(this);
