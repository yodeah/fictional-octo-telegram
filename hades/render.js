// The picture: a high three-quarter camera over a painted Underworld arena, inked procedural
// fighters built from 3D joints, and all effects. Reads the duel, never changes it.
(function (root) {
  const { weapons, shields, spells, maps, moves } = root.HadesData;
  // The map being shown; draw() switches it to the bout's and repaints the scenery.
  let arena = maps.temple, mapKey = 'temple';
  const Sprites = root.HadesSprites;

  const K = .64;      // how much floor depth is foreshortened
  const Z = .80;      // how tall one unit of height appears
  const ink = '#0b1116';
  const looks = Sprites.looks;
  const steel = '#c9d6dc', gold = '#d9a84e';
  const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let canvas, ctx, width = 0, height = 0, unit = 40, dpr = 1;
  let floor, decals, decalCtx, brazierSprite, obstacleArt = [];
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
    const t = theme();
    cracks = [];
    const r = noise(71);
    const water = g.createRadialGradient(0, 0, 3, 0, 0, 17);
    t.moat.forEach((color, i) => water.addColorStop([0, .55, 1][i], color));
    g.fillStyle = water;
    g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = t.ripple(r);
      g.lineWidth = .04;
      const x = bounds.x + r() * bounds.w, y = bounds.y + r() * bounds.h;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + .5, y - .12, x + 1 + r(), y);
      g.stroke();
    }
    t.backdrop(g);
    const rx = arena.a + .75, ry = (arena.b + .75) * K;
    platformWall(g, rx, ry, t.wall);
    ellipsePath(g, 0, 0, rx, ry);
    g.fillStyle = t.platform;
    g.fill();
    g.save();
    ellipsePath(g, 0, 0, rx - .12, ry - .08);
    g.clip();
    tones = t.tones;
    paving(g, r, t);
    t.inlay(g, r);
    debris(g, noise(57), rx, ry);
    floorLight(g, ry, t.pools);
    const light = g.createRadialGradient(-2, -1.5, 1, 0, 0, rx);
    t.shade.forEach((color, i) => light.addColorStop([0, .65, 1][i], color));
    g.fillStyle = light;
    g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (const o of arena.obstacles) if (o.kind === 'pit') paintPit(g, o);
    g.restore();
    platformRim(g, rx, ry, t.rim);
    t.surroundings(g, r, rx, ry);
  }

  // Painted light: the sunset spills over the far side, the water throws teal up from the flanks,
  // and the rest falls toward violet shadow. Drawn inside the floor's clip.
  function floorLight(g, ry, pools) {
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
    for (const [x, y, radius, rgb, alpha, mode] of pools(ry)) pool(x, y, radius, rgb, alpha, mode);
  }

  // The drop below the floor: a lit stone wall with arched niches, falling into shadow.
  function platformWall(g, rx, ry, P) {
    const deep = 1.5;
    ellipsePath(g, 0, deep + .12, rx + .22, ry + .1);
    g.fillStyle = 'rgba(0,8,16,.6)';
    g.fill();
    const slices = 30;
    for (let i = slices; i >= 0; i--) {
      const t = i / slices;
      ellipsePath(g, 0, t * deep, rx, ry);
      g.fillStyle = `hsl(${P.hue + t * P.turn}, ${P.sat}%, ${P.light - t * P.drop}%)`;
      g.fill();
    }
    const at = (a, down) => [Math.cos(a) * rx, Math.sin(a) * ry + down];
    const count = 34;
    for (let i = 0; i <= count / 2; i++) {
      const a = i / (count / 2) * Math.PI;
      // Buttresses between the niches.
      const [x, y] = at(a, 0);
      shapeAt(g, [[x - .13, y + .18], [x + .13, y + .18], [x + .09, y + deep * .92], [x - .09, y + deep * .92]], P.buttress, .05);
      g.fillStyle = P.buttressLight;
      g.fillRect(x - .09, y + .22, .05, deep * .6);
      const mid = a + Math.PI / count;
      if (mid > Math.PI - .05) continue;
      const [mx, my] = at(mid, 0);
      const wide = .26 * Math.max(.3, Math.sin(mid));
      shapeAt(g, [[mx - wide, my + 1.05], [mx - wide, my + .55], [mx, my + .32], [mx + wide, my + .55], [mx + wide, my + 1.05]], P.niche, .06);
      const lit = i % 3 === 1;
      blob(g, mx, my + .72, .24, P.glow[lit ? 0 : 2]);
      blob(g, mx, my + .74, .07, P.glow[lit ? 1 : 3]);
    }
    for (const [down, wide, color] of [[.16, .13, P.bands[0]], [deep * .94, .1, P.bands[1]]]) {
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
  function platformRim(g, rx, ry, P) {
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
    g.fillStyle = P.band;
    g.fill();
    for (const v of [.2, .66]) {
      path(ring(v));
      g.strokeStyle = P.line;
      g.lineWidth = .045;
      g.stroke();
    }
    for (let i = 0; i < keys; i++) {
      path([[i, .58], [i, .28], [i + .76, .28], [i + .76, .5], [i + .26, .5], [i + .26, .39], [i + .5, .39]]);
      g.strokeStyle = P.key;
      g.lineWidth = .055;
      g.stroke();
      path([[i, .58], [i + 1, .58]]);
      g.stroke();
    }
    ellipsePath(g, 0, 0, rx - .06, ry - .04);
    for (const [wide, color] of [[.32, ink], [.2, P.lip[0]], [.07, P.lip[1]]]) {
      g.strokeStyle = color;
      g.lineWidth = wide;
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const [x, y] = at(i / 24 * keys, .06);
      const big = i % 3 === 0, size = big ? .27 : .15;
      blob(g, x, y, size, ink);
      blob(g, x, y - .02, size * .74, P.boss[0]);
      blob(g, x - size * .18, y - size * .22, size * .22, P.boss[1]);
      if (!big) continue;
      blob(g, x, y - .02, size * .42, ink);
      blob(g, x, y - .02, size * .32, P.gems[i % 6 ? 0 : 1]);
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
  function ruins(g, r, P = { dark: '#2b1440', lit: '#6b2e63', door: '#ffc176', doorGlow: 'rgba(255,190,110,.16)' }) {
    const stoneDark = P.dark, stoneLit = P.lit;
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
          blob(g, x + .26, base - .28, .34, P.doorGlow);
          shapeAt(g, [[x + .18, base], [x + .18, base - .34], [x + .26, base - .46], [x + .34, base - .34], [x + .34, base]], P.door, .03);
        }
      }
      const y = base - tall - .07;
      if (!broken) {
        shapeAt(g, [[cx - wide / 2 - .1, y], [cx - wide / 2 - .1, y - .2], [cx + wide / 2 + .1, y - .2], [cx + wide / 2 + .1, y]], stoneLit, .05);
        shapeAt(g, [[cx - wide / 2 - .2, y - .2], [cx, y - .85], [cx + wide / 2 + .2, y - .2]], stoneDark, .05);
        blob(g, cx, y - .43, .12, P.door);
      } else {
        shapeAt(g, [[cx - wide / 2 - .1, y], [cx - wide / 2 - .1, y - .2], [cx - .1, y - .2], [cx + .12, y]], stoneLit, .05);
      }
    }
  }

  // Islands of rock in the dark water, then the colonnade and guardians along the far side.
  function surroundings(g, r, rx, ry, L = {}) {
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, far = 1.12 + r() * .5;
      const x = Math.cos(a) * rx * far, y = Math.sin(a) * ry * far;
      if (y < -5.2) continue;
      rock(g, x, y, .25 + r() * .6, r, L.rock);
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
      if (kind === 'column') column(g, 0, 0, tall * .8, r, L.column);
      else statue(g, 0, 0, x > .1 ? -1 : 1, L.statue);
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

  const rockLooks = {
    temple: { ring: 'rgba(110,235,215,.2)', under: '#0c2432', top: r => `hsl(${178 + r() * 40}, 32%, ${18 + r() * 9}%)`, lit: 'rgba(150,235,215,.16)' },
    forge: { ring: 'rgba(255,150,60,.28)', under: '#140605', top: r => `hsl(${8 + r() * 18}, 14%, ${12 + r() * 8}%)`, lit: 'rgba(255,140,70,.22)' },
    garden: { ring: 'rgba(255,250,220,.3)', under: '#2c4a3c', top: r => `hsl(${70 + r() * 50}, 24%, ${34 + r() * 12}%)`, lit: 'rgba(255,250,210,.25)' }
  };
  function rock(g, x, y, s, r, P = rockLooks.temple) {
    const top = Array.from({ length: 7 }, (_, i) => {
      const a = i / 7 * Math.PI * 2, reach = s * (.7 + r() * .55);
      return [x + Math.cos(a) * reach, y + Math.sin(a) * reach * .5];
    });
    g.strokeStyle = P.ring;
    g.lineWidth = .06;
    ellipsePath(g, x, y + s * .42, s * 1.35, s * .55);
    g.stroke();
    shapeAt(g, [top[0], [x + s * .6, y + s * .55], [x, y + s * .8], [x - s * .65, y + s * .5], top[3], top[2], top[1]], P.under);
    shapeAt(g, top, P.top(r), .05);
    shapeAt(g, [top[4], top[5], top[6], [x, y - s * .05]], P.lit, 0);
  }

  const statueLooks = {
    temple: { base: '#1b414a', band: '#8d7440', bandShade: '#6d5830', robe: '#3f7478', robeShade: '#24505a', fold: '#1d444e', hood: '#4b8586',
      face: '#07151d', eyeGlow: 'rgba(120,255,220,.22)', eye: '#c8fff0', blade: '#a9c9c9', bladeShade: '#5e868e', guard: '#c39b4c' },
    forge: { base: '#2a1410', band: '#9a6a32', bandShade: '#6a4422', robe: '#5a3a2c', robeShade: '#3a2218', fold: '#2e1a12', hood: '#6e4a36',
      face: '#120604', eyeGlow: 'rgba(255,140,60,.3)', eye: '#ffd08a', blade: '#8a8f96', bladeShade: '#4c5058', guard: '#c08a3a' },
    garden: { base: '#9a9a86', band: '#d8b45c', bandShade: '#a8883e', robe: '#ece6d2', robeShade: '#bdb59c', fold: '#cfc7ae', hood: '#f4efe0',
      face: '#3a4a52', eyeGlow: 'rgba(255,240,170,.3)', eye: '#fff6c8', blade: '#f0f2f0', bladeShade: '#b4bab8', guard: '#e2bc62' }
  };
  // A hooded guardian leaning on a greatsword, facing into the arena.
  function statue(g, x, y, turn, P = statueLooks.temple) {
    const at = list => list.map(([dx, dy]) => [x + dx * turn, y - dy]);
    shapeAt(g, at([[-.95, 0], [-.8, .5], [.8, .5], [.95, 0]]), P.base);
    shapeAt(g, at([[-.95, .5], [-.95, .66], [.95, .66], [.95, .5]]), P.band);
    shapeAt(g, at([[-.75, .66], [-.58, 1.9], [-.3, 2.35], [.3, 2.35], [.58, 1.9], [.75, .66]]), P.robe);
    shapeAt(g, at([[.05, .68], [.12, 2.3], [.3, 2.35], [.58, 1.9], [.75, .66]]), P.robeShade, 0);
    for (const fold of [-.46, -.2, .3, .54]) shapeAt(g, at([[fold, .68], [fold * .55, 1.7], [fold + .07, .68]]), P.fold, 0);
    shapeAt(g, at([[-.36, 2.2], [-.42, 2.75], [0, 3.15], [.42, 2.75], [.36, 2.2], [0, 2.05]]), P.hood);
    shapeAt(g, at([[-.22, 2.35], [-.24, 2.7], [0, 2.86], [.24, 2.7], [.22, 2.35], [0, 2.22]]), P.face, .04);
    for (const dx of [-.09, .09]) {
      blob(g, x + dx, y - 2.55, .09, P.eyeGlow);
      blob(g, x + dx, y - 2.55, .035, P.eye);
    }
    shapeAt(g, at([[-.09, 1.7], [-.14, .78], [0, .62], [.14, .78], [.09, 1.7]]), P.blade);
    shapeAt(g, at([[0, 1.7], [.09, 1.7], [.14, .78], [0, .62]]), P.bladeShade, 0);
    shapeAt(g, at([[-.4, 1.68], [-.4, 1.86], [.4, 1.86], [.4, 1.68]]), P.guard);
    shapeAt(g, at([[-.34, 1.86], [-.2, 2.12], [.2, 2.12], [.34, 1.86]]), P.hood);
    shapeAt(g, at([[-.62, 1.85], [-.9, 2.2], [-.42, 2.28], [-.3, 2.05]]), P.band);
    shapeAt(g, at([[.62, 1.85], [.9, 2.2], [.42, 2.28], [.3, 2.05]]), P.bandShade);
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
    for (const [dx, dy, tone] of [[.07, .09, tones.lit], [-.08, -.1, tones.dark]]) {
      g.save();
      g.translate(dx, dy);
      path();
      g.strokeStyle = tone;
      g.lineWidth = .1;
      g.stroke();
      g.restore();
    }
    for (let i = 0; i < 7; i++) {
      blob(g, cx + (r() - .5) * 1.1, cy + (r() - .5) * 1.1, .02 + r() * .06, r() < .5 ? tones.chipDark : tones.chipLit);
    }
    if (r() < .3) {
      g.strokeStyle = tones.crack;
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
  // The light and dark edges, chips and cracks of cut stone; set per map by paintFloor.
  let tones;

  // Uneven flagstones on the diagonal, ringed by a course of curved stones around the seal.
  function paving(g, r, t) {
    const stoneColor = t.stone;
    g.save();
    g.scale(1, K);
    g.fillStyle = t.grout;
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
  function fissures(g, r, colors = ['rgba(60,255,200,.09)', 'rgba(80,255,210,.22)', '#04141a', '#8dffe0']) {
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
      cracks.push(points[1], points[4], points[7]);
      for (const [w, color] of [.46, .2, .1, .035].map((w, i) => [w, colors[i]])) {
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

  const columnLooks = {
    temple: { plinth: '#8d7440', step: '#1f4a52', shaft: '#2f626a', lit: 'rgba(170,250,230,.28)', lit2: 'rgba(170,250,230,.12)', dark: 'rgba(2,14,26,.3)',
      dark2: 'rgba(2,14,26,.5)', band: '#b28d47', bowl: '#6d5830', rim: '#d4ad5c', glow: ['rgba(80,255,210,.08)', 'rgba(100,255,220,.16)'], flame: '#4fe8c4', core: '#e4fff6' },
    forge: { plinth: '#6a4426', step: '#2a1612', shaft: '#3a2a26', lit: 'rgba(255,170,110,.22)', lit2: 'rgba(255,170,110,.1)', dark: 'rgba(0,0,0,.3)',
      dark2: 'rgba(0,0,0,.5)', band: '#9a6430', bowl: '#5a3820', rim: '#c48a44', glow: ['rgba(255,120,40,.1)', 'rgba(255,150,60,.2)'], flame: '#ff8a2a', core: '#fff0b0', rock: rockLooks.forge },
    garden: { plinth: '#d6b25a', step: '#b8b29a', shaft: '#e6dfc8', lit: 'rgba(255,255,245,.4)', lit2: 'rgba(255,255,245,.18)', dark: 'rgba(80,80,60,.18)',
      dark2: 'rgba(80,80,60,.32)', band: '#d8b45c', bowl: '#a8883e', rim: '#f0d27e', glow: ['rgba(255,220,130,.1)', 'rgba(255,230,150,.2)'], flame: '#ffc85a', core: '#fffbe0', rock: rockLooks.garden }
  };
  // A fluted column; the taller ones carry a fire bowl, the rest are snapped off.
  function column(g, x, y, tall, r, P = columnLooks.temple) {
    const box = (x0, y0, w, h, color, line) => shapeAt(g, [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], color, line);
    box(x - .62, y - .22, 1.24, .24, P.plinth);
    box(x - .5, y - .38, 1, .17, P.step);
    const broken = tall < 1.75;
    const crown = broken ? [[x - .4, y - tall], [x - .14, y - tall + .22], [x + .04, y - tall - .14], [x + .2, y - tall + .16], [x + .4, y - tall + .02]]
      : [[x - .38, y - tall], [x + .38, y - tall]];
    shapeAt(g, [[x - .43, y - .36], ...crown, [x + .43, y - .36]], P.shaft);
    for (const [dx, w, color] of [[-.33, .13, P.lit], [-.1, .09, P.lit2], [.1, .12, P.dark], [.28, .13, P.dark2]]) {
      box(x + dx, y - tall + .26, w, tall - .62, color, 0);
    }
    box(x - .46, y - .62, .92, .13, P.band, .05);
    if (broken) {
      for (let k = 0; k < 3; k++) rock(g, x + (r() - .5) * 1.8, y + .15, .14 + r() * .16, r, P.rock);
      return;
    }
    box(x - .55, y - tall - .2, 1.1, .22, P.band);
    shapeAt(g, [[x - .62, y - tall - .55], [x + .62, y - tall - .55], [x + .34, y - tall - .2], [x - .34, y - tall - .2]], P.bowl);
    box(x - .68, y - tall - .66, 1.36, .13, P.rim, .05);
    for (const [dx, dy, rad, color] of [[0, 1.25, 1.3, P.glow[0]], [0, .95, .7, P.glow[1]]]) blob(g, x, y - tall - dy, rad, color);
    shapeAt(g, [[x - .4, y - tall - .66], [x - .18, y - tall - 1.2], [x - .08, y - tall - .95], [x + .06, y - tall - 1.55],
      [x + .2, y - tall - 1.02], [x + .34, y - tall - 1.18], [x + .42, y - tall - .66]], P.flame, .04);
    shapeAt(g, [[x - .2, y - tall - .66], [x - .04, y - tall - 1.06], [x + .08, y - tall - .86], [x + .22, y - tall - .66]], P.core, 0);
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
    const t = theme();
    fallArt = makeCanvas(96, 256);
    let g = fallArt.getContext('2d');
    const r = noise(41);
    for (let i = 0; i < 90; i++) {
      const x = 6 + r() * 84, y = r() * 256, long = 30 + r() * 100, wide = 1 + r() * 4;
      for (const shift of [0, -256]) {
        const streak = g.createLinearGradient(0, y + shift, 0, y + shift + long);
        streak.addColorStop(0, `rgba(${t.fall.edge},0)`);
        streak.addColorStop(.7, `rgba(${t.fall.core(r)},${.35 + r() * .5})`);
        streak.addColorStop(1, `rgba(${t.fall.edge},0)`);
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
      fade.addColorStop(0, `rgba(${t.shaft[0]},${edge * .9})`);
      fade.addColorStop(.6, `rgba(${t.shaft[1]},${edge * .35})`);
      fade.addColorStop(1, `rgba(${t.shaft[1]},0)`);
      g.fillStyle = fade;
      g.fillRect(i * 2, 0, 2, 512);
    }
    mistArt = makeCanvas(512, 96);
    g = mistArt.getContext('2d');
    for (let i = 0; i < 70; i++) {
      // Puffs stop short of the ends: neighboring strips overlap there without a visible join.
      const x = 48 + r() * 416, y = 48 + (r() - .5) * 34, rad = 16 + r() * 28;
      const puff = g.createRadialGradient(x, y, 0, x, y, rad);
      puff.addColorStop(0, `rgba(${t.mist},.2)`);
      puff.addColorStop(1, `rgba(${t.mist},0)`);
      g.fillStyle = puff;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  function drawFalls() {
    const fall = theme().fall;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, top, bottom, wide] of fall.at) {
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
      ctx.fillStyle = fall.sheet;
      ctx.fillRect(left, from, width, height);
      for (const [speed, alpha] of [[1.5, .55], [.9, .3]]) {
        const slide = (clock * speed + x) % 1 * height;
        ctx.globalAlpha = alpha;
        ctx.drawImage(fallArt, left, from + slide - height, width, height);
        ctx.drawImage(fallArt, left, from + slide, width, height);
      }
      ctx.restore();
      const pulse = Math.sin(clock * 5 + x) * .08;
      glow(sx(x), bottom * unit, unit * wide * (1.15 + pulse), fall.glow, .42);
      glow(sx(x), top * unit, unit * wide * .7, fall.glow, .22);
      for (let i = 0; i < 5; i++) {
        const t = (clock * .9 + i / 5 + x) % 1;
        glow(sx(x + (i - 2) * wide * .22), (bottom - Math.sin(t * Math.PI) * .45) * unit, unit * .09, fall.spray, 1 - t);
      }
    }
    ctx.restore();
  }

  // The audience: shades of the dead, painted calm and cheering.
  function paintShades(res) {
    const P = theme().shades;
    shadeArt = [false, true].map(cheer => {
      const c = makeCanvas(1.5 * res, 1.9 * res), g = c.getContext('2d');
      g.setTransform(res, 0, 0, res, .75 * res, 1.7 * res);
      const body = g.createLinearGradient(0, -1.35, 0, .1);
      body.addColorStop(0, P.top);
      body.addColorStop(.6, P.mid);
      body.addColorStop(1, P.end);
      if (cheer) for (const side of [-1, 1]) {
        shapeAt(g, [[side * .2, -.68], [side * .62, -1.24], [side * .7, -1.1], [side * .32, -.5]], P.arm, .05);
        blob(g, side * .68, -1.22, .09, P.hand);
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
      shapeAt(g, [[-.2, -.92], [-.18, -1.16], [0, -1.24], [.18, -1.16], [.2, -.92], [0, -.82]], P.face, .035);
      for (const dx of [-.08, .08]) {
        blob(g, dx, -1.02, .075, P.eye);
        blob(g, dx, -1.02, cheer ? .04 : .03, P.pupil);
      }
      if (cheer) blob(g, 0, -.9, .045, P.mouth);
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
      glow(sx(x), (y + bob - hop - .7 * size) * unit, unit * .65, theme().shades.glow, .12 + keen * .2);
    });
    ctx.restore();
  }

  function drawShafts() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, wide, long, lean, phase] of theme().shafts) {
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
    brazierSprite = makeCanvas(2 * res, 2 * res);
    const bg = brazierSprite.getContext('2d');
    bg.setTransform(res, 0, 0, res, res, 1.6 * res);
    paintBrazier(bg);
    obstacleArt = paintObstacles(res);
    if (!lavaArt) paintLava();
    Sprites.setResolution(unit * dpr * 1.25);
    paintFrame();
    paintWeather();
    paintShades(unit * dpr * 1.25);
  }

  // ---- Maps ----
  // Each map's look: colors for the shared painters above, its own backdrop and obstacle art, and
  // what moves on it each frame. All of it is decoration: none of it reads or changes the bout.

  // A ridge of silhouettes across the backdrop.
  function ridge(g, r, base, low, high, color, edge) {
    const left = bounds.x, right = bounds.x + bounds.w;
    const points = [[left, base + 1]];
    for (let x = left; x <= right; x += .5 + r() * .8) points.push([x, base - low - r() ** 2 * (high - low)]);
    points.push([right, base - low], [right, base + 1]);
    shapeAt(g, points, color, 0);
    g.strokeStyle = edge;
    g.lineWidth = .05;
    g.beginPath();
    points.slice(1, -1).forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
    g.stroke();
  }

  function band(g, top, bottom, stops) {
    const fill = g.createLinearGradient(0, top, 0, bottom);
    stops.forEach(([at, color]) => fill.addColorStop(at, color));
    g.fillStyle = fill;
    g.fillRect(bounds.x, top, bounds.w, bottom - top);
  }

  function radial(g, x, y, radius, stops) {
    const fill = g.createRadialGradient(x, y, .1, x, y, radius);
    stops.forEach(([at, color]) => fill.addColorStop(at, color));
    g.fillStyle = fill;
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // A hanging chain: open links alternate with links seen edge-on.
  function chain(g, x, from, to, sway = 0) {
    for (let y = from, k = 0; y < to; y += .3, k++) {
      const cx = x + sway * ((y - from) / (to - from)) ** 2;
      if (k % 2) {
        ellipsePath(g, cx, y, .1, .19);
        g.strokeStyle = ink;
        g.lineWidth = .08;
        g.stroke();
        g.strokeStyle = '#4a3a34';
        g.lineWidth = .04;
        g.stroke();
      } else shapeAt(g, [[cx - .035, y - .2], [cx + .035, y - .2], [cx + .035, y + .2], [cx - .035, y + .2]], '#5a463c', .03);
    }
  }

  // The far side of the forge: smoke and ember light, chimneys of the great forges and a colossal
  // anvil on the shore of the molten lake, chains hanging from the dark.
  function forgeBackdrop(g) {
    const r = noise(911);
    const left = bounds.x, right = bounds.x + bounds.w, top = bounds.y;
    band(g, top, -3.8, [[0, '#0a0405'], [.4, '#2a0b0a'], [.64, '#7a2410'], [.76, 'rgba(110,40,22,.95)'], [1, 'rgba(90,30,16,0)']]);
    radial(g, 0, -6.2, 6, [[0, 'rgba(255,200,110,.75)'], [.3, 'rgba(255,110,40,.35)'], [1, 'rgba(255,80,30,0)']]);
    ridge(g, r, -6.1, .35, 2.2, '#2a0d0b', 'rgba(255,140,70,.5)');
    for (const [x, tall, wide] of [[-10.4, 2.6, .9], [-6.8, 3.1, 1.1], [6.9, 3.2, 1.1], [10.5, 2.5, .9]]) {
      const base = -5.7;
      for (let k = 0; k < 6; k++) blob(g, x + (r() - .5) * .8 + k * .14, base - tall - .4 - k * .5, .45 + k * .18, `rgba(28,12,12,${.55 - k * .07})`);
      shapeAt(g, [[x - wide / 2, base], [x - wide * .36, base - tall], [x + wide * .36, base - tall], [x + wide / 2, base]], '#1c0a09', .05);
      g.fillStyle = 'rgba(255,120,50,.3)';
      g.fillRect(x - wide * .36 + .05, base - tall + .1, .07, tall - .2);
      shapeAt(g, [[x - wide * .44, base - tall], [x - wide * .44, base - tall - .16], [x + wide * .44, base - tall - .16], [x + wide * .44, base - tall]], '#3a1a12', .04);
      blob(g, x, base - tall - .1, wide * .5, 'rgba(255,150,60,.35)');
      blob(g, x, base - .4, .34, 'rgba(255,170,80,.35)');
      shapeAt(g, [[x - .16, base], [x - .16, base - .36], [x, base - .5], [x + .16, base - .36], [x + .16, base]], '#ffb060', .03);
    }
    // The anvil: a stepped foot, a narrow waist and a long face ending in a horn.
    const ay = -5.68;
    shapeAt(g, [[-1.7, ay], [-1.2, ay - .38], [-.6, ay - .46], [-.6, ay - .92], [-2.9, ay - 1.02], [-2.3, ay - 1.3], [2.2, ay - 1.3], [2.3, ay - .98],
      [.6, ay - .92], [.6, ay - .46], [1.2, ay - .38], [1.7, ay]], '#170909', .06);
    g.strokeStyle = 'rgba(255,160,80,.6)';
    g.lineWidth = .05;
    g.beginPath();
    g.moveTo(-2.3, ay - 1.3);
    g.lineTo(2.2, ay - 1.3);
    g.stroke();
    ridge(g, r, -5.5, .2, .9, '#1a0807', 'rgba(255,130,60,.4)');
    for (let x = left; x < right; x += .55 + r() * .9) {
      const long = .5 + r() ** 2 * 2.6 + (Math.abs(x) > 8 ? 1 : 0), wide = .18 + r() * .34;
      shapeAt(g, [[x - wide, top], [x + wide, top], [x + wide * .6, -9.3 + long * .35], [x + r() * .1, -9.3 + long], [x - wide * .55, -9.3 + long * .3]], '#0d0505', .04);
    }
    for (const [x, sway] of [[-8.7, .3], [-4.9, -.2], [5.1, .25], [8.6, -.3]]) chain(g, x, top, -7.3 + Math.abs(x) * .1, sway);
    band(g, -6.4, -4.4, [[0, 'rgba(255,120,50,0)'], [.5, 'rgba(255,130,60,.24)'], [1, 'rgba(255,100,40,0)']]);
    for (let i = 0; i < 130; i++) {
      const y = -5.4 + r() * 1.5, x = (r() - .5) * (2 + (y + 5.4) * 5);
      g.fillStyle = `rgba(255,${150 + r() * 90},70,${.08 + r() * .22})`;
      g.fillRect(x, y, .1 + r() * .55, .035);
    }
  }

  // Elysium: a sunset over green hills, a marble temple and cypresses, a river of light below.
  function gardenBackdrop(g) {
    const r = noise(523);
    const left = bounds.x, right = bounds.x + bounds.w, top = bounds.y;
    band(g, top, -3.8, [[0, '#1c2656'], [.38, '#5052a0'], [.62, '#f0b07a'], [.75, 'rgba(240,222,176,.95)'], [1, 'rgba(200,230,200,0)']]);
    radial(g, 0, -6.6, 5, [[0, 'rgba(255,246,206,.9)'], [.25, 'rgba(255,210,150,.35)'], [1, 'rgba(255,190,140,0)']]);
    for (let i = 0; i < 9; i++) {
      const y = -9.4 + r() * 2.6, x = left + r() * bounds.w;
      g.fillStyle = `rgba(255,${210 + r() * 30},${190 + r() * 30},${.1 + r() * .12})`;
      ellipsePath(g, x, y, 1.6 + r() * 2.4, .1 + r() * .14);
      g.fill();
    }
    ridge(g, r, -6.2, .5, 2.1, '#6c6a9c', 'rgba(255,232,200,.55)');
    ruins(g, r, { dark: '#c9c2ae', lit: '#f6f1e2', door: '#ffe6a8', doorGlow: 'rgba(255,230,160,.25)' });
    // Cypresses: dark green flames along the far shore, kept clear of the middle.
    for (let x = left + .4; x < right; x += .7 + r() * 1.1) {
      if (Math.abs(x) < 2.2) continue;
      const tall = 1.1 + r() * 1.5, wide = .22 + r() * .14, base = -5.55 - r() * .3;
      shapeAt(g, [[x - wide, base], [x - wide * 1.1, base - tall * .45], [x - wide * .5, base - tall * .85], [x, base - tall], [x + wide * .5, base - tall * .85],
        [x + wide * 1.1, base - tall * .45], [x + wide, base]], `hsl(${140 + r() * 20}, 30%, ${18 + r() * 8}%)`, .04);
      g.strokeStyle = 'rgba(255,230,170,.35)';
      g.lineWidth = .04;
      g.beginPath();
      g.moveTo(x - wide * 1.05, base - tall * .45);
      g.lineTo(x - wide * .5, base - tall * .85);
      g.lineTo(x, base - tall);
      g.stroke();
    }
    ridge(g, r, -5.5, .2, .8, '#3c6250', 'rgba(255,240,200,.45)');
    // Leaves framing the top corners.
    for (let i = 0; i < 60; i++) {
      const side = i % 2 ? 1 : -1, x = side * (11 + r() * 4.5), y = top + r() * 3.2 * (1 - Math.abs(x) / 30);
      blob(g, x, y, .3 + r() * .5, `hsl(${120 + r() * 40}, ${28 + r() * 14}%, ${14 + r() * 12}%)`);
    }
    band(g, -6.4, -4.4, [[0, 'rgba(255,240,210,0)'], [.5, 'rgba(255,244,214,.3)'], [1, 'rgba(220,250,230,0)']]);
    for (let i = 0; i < 130; i++) {
      const y = -5.4 + r() * 1.5, x = (r() - .5) * (2 + (y + 5.4) * 5);
      g.fillStyle = `rgba(255,${230 + r() * 25},${170 + r() * 60},${.1 + r() * .22})`;
      g.fillRect(x, y, .1 + r() * .55, .035);
    }
  }

  // Grass and small flowers in the joints of the garden's paving, and a gold laurel ring under the
  // middle column.
  function gardenInlay(g, r) {
    g.save();
    g.scale(1, K);
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 10.6, x = Math.cos(a) * d, y = Math.sin(a) * d * .7;
      g.strokeStyle = `hsl(${85 + r() * 40}, ${35 + r() * 25}%, ${26 + r() * 16}%)`;
      g.lineWidth = .03 + r() * .03;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        g.moveTo(x + k * .05, y);
        g.lineTo(x + k * .05 + (r() - .5) * .14, y - .1 - r() * .16);
      }
      g.stroke();
      if (r() < .22) blob(g, x + .05, y - .14, .035 + r() * .03, ['#fff6e8', '#ffd2e2', '#ffe27a', '#c8b8ff'][Math.floor(r() * 4)]);
    }
    // A mosaic disc inside the course of curved stones: pale marble, green and gold petals.
    blob(g, 0, 0, 2.92, ink);
    blob(g, 0, 0, 2.85, '#d8cfb2');
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      g.save();
      g.rotate(a);
      shapeAt(g, [[2.0, 0], [2.4, -.26], [2.75, 0], [2.4, .26]], i % 2 ? '#8fb86a' : '#c9a24e', .03);
      shapeAt(g, [[2.12, 0], [2.4, -.13], [2.62, 0], [2.4, .13]], i % 2 ? '#c4e0a0' : '#f2d27a', 0);
      g.restore();
    }
    blob(g, 0, 0, 1.92, '#bfb596');
    blob(g, 0, 0, 1.4, '#e2dac2');
    for (const [radius, w, color] of [[1.55, .2, ink], [1.55, .13, '#a8883e'], [1.55, .05, '#f2d27a'], [1.98, .04, 'rgba(242,210,122,.7)']]) {
      g.strokeStyle = color;
      g.lineWidth = w;
      ellipsePath(g, 0, 0, radius, radius);
      g.stroke();
    }
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, x = Math.cos(a) * 1.76, y = Math.sin(a) * 1.76;
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      shapeAt(g, [[0, -.13], [.07, 0], [0, .13], [-.07, 0]], i % 2 ? '#7fae5a' : '#5e8e46', .025);
      g.restore();
    }
    g.restore();
  }

  // The molten pit, painted into the floor: an iron-bound rim, the far inner wall lit from below
  // and the surface of the metal with dark crust. drawPit animates it.
  function paintPit(g, o) {
    const r = noise(47), x = o.x, y = o.y * K, R = o.r;
    ellipsePath(g, x, y + .08, R + .5, (R + .5) * K);
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fill();
    for (let i = 0; i < 16; i++) {
      const a0 = i / 16 * Math.PI * 2, a1 = (i + 1) / 16 * Math.PI * 2, at = (a, d) => [x + Math.cos(a) * d, y + Math.sin(a) * d * K];
      shapeAt(g, [at(a0 + .02, R), at(a0 + .02, R + .4), at(a1 - .02, R + .4), at(a1 - .02, R)], `hsl(${10 + r() * 14}, 12%, ${14 + r() * 7}%)`, .04);
      blob(g, ...at(a0 + .2, R + .2), .04, '#8a8f98');
    }
    ellipsePath(g, x, y, R + .04, (R + .04) * K);
    g.strokeStyle = '#b06a30';
    g.lineWidth = .05;
    g.stroke();
    g.save();
    ellipsePath(g, x, y, R, R * K);
    g.clip();
    const wall = g.createLinearGradient(0, y - R * K, 0, y + R * K * .3);
    wall.addColorStop(0, '#140605');
    wall.addColorStop(.5, '#5a1608');
    wall.addColorStop(1, '#e0601a');
    g.fillStyle = wall;
    g.fillRect(x - R, y - R * K, R * 2, R * K * 2);
    for (let i = 0; i < 9; i++) {
      const px = x - R * .9 + i * R * .22;
      shapeAt(g, [[px, y - R * K - .1], [px + .1, y - R * K * .2 + r() * .3], [px + .2, y - R * K - .1]], 'rgba(10,2,2,.45)', 0);
    }
    const lava = g.createRadialGradient(x, y + .3, .1, x, y + .3, R);
    lava.addColorStop(0, '#fff2a8');
    lava.addColorStop(.35, '#ffb43c');
    lava.addColorStop(.75, '#e2480e');
    lava.addColorStop(1, '#7a1606');
    g.fillStyle = lava;
    ellipsePath(g, x, y + .3, R * .97, R * K * .92);
    g.fill();
    // Ragged plates of cooling crust, thicker toward the cooler rim.
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = R * (.3 + r() * .62), cx = x + Math.cos(a) * d, cy = y + .3 + Math.sin(a) * d * K * .9, s = .1 + r() * .18 * d / R;
      const plate = Array.from({ length: 8 }, (_, k) => [cx + Math.cos(k * .785 + r() * .3) * s * (.55 + r() * .6), cy + Math.sin(k * .785 + r() * .3) * s * K * (.55 + r() * .6)]);
      shapeAt(g, plate, `rgba(${50 + r() * 30},${12 + r() * 10},6,${.45 + d / R * .35})`, 0);
    }
    g.restore();
  }

  // Lava texture slid across the pit each frame.
  let lavaArt;
  function paintLava() {
    lavaArt = makeCanvas(256, 128);
    const g = lavaArt.getContext('2d'), r = noise(83);
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = r() * 256, y = r() * 128;
      g.strokeStyle = `rgba(255,${200 + r() * 55},${110 + r() * 80},${.35 + r() * .45})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo(x += (r() - .3) * 30, y += (r() - .5) * 16);
      g.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * 256, y = r() * 128, rad = 8 + r() * 18;
      const spot = g.createRadialGradient(x, y, 0, x, y, rad);
      spot.addColorStop(0, 'rgba(255,240,170,.55)');
      spot.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = spot;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  function drawPit(o) {
    const x = sx(o.x), y = sy(o.y), R = o.r * unit;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, K);
    glow(0, 0, R * 2.3, '255,120,40', .22 + Math.sin(clock * 1.3) * .05);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, R, R * K, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(x, y + .3 * unit, R * .97, R * K * .92, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const wide = R * 2.4, tall = R * K * 2.2;
    for (const [speed, alpha, flip] of [[.08, .5, 1], [-.05, .35, -1]]) {
      const slide = ((clock * speed) % 1 + 1) % 1 * wide;
      ctx.globalAlpha = alpha * (.8 + Math.sin(clock * 2.1 + flip) * .2);
      for (const dx of [-wide, 0]) ctx.drawImage(lavaArt, x - R * 1.2 + slide + dx, y - tall / 2 + .3 * unit, wide, tall * flip);
    }
    ctx.globalAlpha = 1;
    // Bubbles swell and burst in a new place each time.
    for (let i = 0; i < 4; i++) {
      const cycle = clock * .5 + i * .27, t = cycle % 1, seed = Math.floor(cycle) * 7 + i * 13;
      const a = seed * 2.39, d = .2 + (seed * .618 % 1) * .6;
      const bx = x + Math.cos(a) * R * d, by = y + .3 * unit + Math.sin(a) * R * K * .85 * d;
      glow(bx, by, unit * (.08 + t * .22), t < .85 ? '255,240,170' : '255,255,230', t < .85 ? .6 : (1 - t) * 6);
    }
    ctx.restore();
  }

  // ---- Obstacle art ----
  // Each obstacle is painted once into a sprite of its own and drawn in depth order with the
  // fighters. A low wall is cut into short pieces so the sort stays right along it.
  function piecesOf(o, i) {
    if (o.kind === 'pit') return [];
    if (o.kind === 'column') {
      const r = noise(31 + i * 17), whole = !!o.whole, tall = whole ? 2.5 : 1.05 + r() * .7, base = o.r * 1.14;
      return [{ x: o.x, y: o.y, left: -base - .4, top: -tall * Z - (whole ? 1.2 : .6), w: base * 2.9 + .9, h: tall * Z + base * K + (whole ? 1.6 : 1),
        depth: o.y + .1, tall: true, x0: o.x, x1: o.x, paint: g => paintColumn(g, o, tall, whole, r), live: whole ? () => sacredFlame(o, tall) : null }];
    }
    if (o.kind === 'hearth') {
      const L = o.x2 - o.x, R = o.r;
      return [{ x: o.x, y: o.y, left: -R - .4, top: -R * K - .8 - 1.1, w: L + R * 2 + .8, h: R * K * 2 + 2.3, depth: o.y + .2, tall: true,
        x0: o.x, x1: o.x2, paint: g => paintHearth(g, o, noise(61 + i)), live: () => hearthFire(o) }];
    }
    if (o.kind === 'balustrade') return balustradePieces(o);
    return [{ x: o.x, y: o.y, left: -1.5, top: -2.5, w: 3, h: 3.4, depth: o.y + .2, tall: true, x0: o.x, x1: o.x, paint: g => paintPillar(g, o.r) }];
  }

  function paintObstacles(res) {
    const art = [];
    arena.obstacles.forEach((o, i) => {
      for (const piece of piecesOf(o, i)) {
        piece.canvas = makeCanvas(piece.w * res, piece.h * res);
        const g = piece.canvas.getContext('2d');
        g.setTransform(res, 0, 0, res, -piece.left * res, -piece.top * res);
        piece.paint(g);
        art.push(piece);
      }
    });
    return art;
  }

  // A marble column on a round base, lit from the left: whole with a capital and a fire bowl, or
  // snapped off with a rough break, ivy and moss.
  function paintColumn(g, o, tall, whole, r) {
    const base = o.r * 1.14, R = o.r * .84, h = tall * Z;
    g.fillStyle = 'rgba(30,40,20,.32)';
    ellipsePath(g, base * .5, .06, base * 1.7, base * K * 1.15);
    g.fill();
    const drum = (radius, from, to, light, mid, dark) => {
      const fill = g.createLinearGradient(-radius, 0, radius, 0);
      fill.addColorStop(0, light);
      fill.addColorStop(.45, mid);
      fill.addColorStop(1, dark);
      g.beginPath();
      g.ellipse(0, -from, radius, radius * K, 0, 0, Math.PI);
      g.ellipse(0, -to, radius, radius * K, 0, Math.PI, 0, true);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = .05;
      g.stroke();
    };
    const lid = (radius, z, color) => {
      ellipsePath(g, 0, -z, radius, radius * K);
      g.fillStyle = color;
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = .04;
      g.stroke();
    };
    drum(base, 0, .2, '#f4eedc', '#d6cdb4', '#8e8774');
    lid(base, .2, '#ebe4cf');
    drum(base * .92, .2, .3, '#e9c56a', '#c49a46', '#7c5a26');
    lid(base * .92, .3, '#dcb560');
    drum(R, .3, h, '#f7f1df', '#d8cfb6', '#8f8874');
    // Fluting follows the curve of the shaft.
    for (let k = 1; k < 8; k++) {
      const a = k / 8 * Math.PI, x = -Math.cos(a) * R, bow = Math.sin(a) * R * K;
      g.strokeStyle = k < 4 ? 'rgba(255,255,245,.5)' : 'rgba(80,72,56,.3)';
      g.lineWidth = .03;
      g.beginPath();
      g.moveTo(x, -.32 + bow);
      g.lineTo(x, -h + bow + (whole ? 0 : .2));
      g.stroke();
    }
    for (let k = 0; k < 7; k++) blob(g, (r() - .5) * base * 2, (r() - .2) * base * K * .8, .06 + r() * .08, `rgba(${80 + r() * 30},${120 + r() * 30},60,.6)`);
    if (whole) {
      drum(R * 1.12, h, h + .12, '#f0d888', '#caa24c', '#7a5826');
      shapeAt(g, [[-R * 1.5, -h - .12], [R * 1.5, -h - .12], [R * 1.5, -h - .3], [-R * 1.5, -h - .3]], '#efe8d4', .04);
      for (const side of [-1, 1]) {
        blob(g, side * R * 1.45, -h - .2, .13, ink);
        blob(g, side * R * 1.45, -h - .2, .1, '#e8e0c8');
        blob(g, side * R * 1.45, -h - .2, .045, '#b4a888');
      }
      shapeAt(g, [[-R * 1.25, -h - .3], [R * 1.25, -h - .3], [R * 1.25, -h - .42], [-R * 1.25, -h - .42]], '#f7f2e4', .04);
      // A bronze bowl on top for the sacred flame.
      shapeAt(g, [[-.32, -h - .42], [.32, -h - .42], [.24, -h - .6], [-.24, -h - .6]], '#a8883e', .04);
      shapeAt(g, [[-.4, -h - .6], [.4, -h - .6], [.34, -h - .68], [-.34, -h - .68]], '#e8c46a', .04);
      return;
    }
    // A rough break: a jagged rim around a pale cross-section, then a crack and some ivy.
    const rim = Array.from({ length: 18 }, (_, k) => {
      const a = k / 18 * Math.PI * 2, far = Math.sin(a) < 0;
      return [Math.cos(a) * R, -h + Math.sin(a) * R * K - (far ? .05 + r() * .3 : r() * .1)];
    });
    shapeAt(g, rim, '#f1ead6', .045);
    shapeAt(g, rim.map(([x, y]) => [x * .55 - .03, (y + h) * .55 - h - .04]), 'rgba(170,160,130,.35)', 0);
    g.strokeStyle = 'rgba(70,62,46,.7)';
    g.lineWidth = .03;
    g.beginPath();
    g.moveTo(-R * .3, -h + .05);
    g.lineTo(-R * .1, -h * .7);
    g.lineTo(-R * .35, -h * .45);
    g.stroke();
    if (r() < .7) {
      g.strokeStyle = '#4f7a3a';
      g.lineWidth = .035;
      g.beginPath();
      for (let k = 0; k <= 10; k++) {
        const z = .3 + k / 10 * (h - .4), x = Math.sin(k * .9 + r()) * R * .8;
        g[k ? 'lineTo' : 'moveTo'](x, -z + Math.cos(k * .9) * R * K * .5);
        if (k % 2) blob(g, x + .05, -z, .06, k % 4 ? '#6fa04a' : '#4f8a3a');
      }
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const cx = base * (1.1 + r() * .5) * (k ? 1 : -1), cy = base * K * (.4 + r() * .4);
      shapeAt(g, [[cx - .12, cy], [cx - .06, cy - .1], [cx + .1, cy - .08], [cx + .13, cy]], '#e4dcc6', .03);
    }
  }

  function sacredFlame(o, tall) {
    const x = sx(o.x), top = sy(o.y, tall) - .68 * unit;
    const wave = k => Math.sin(clock * (6 + k * 2) + k * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(x, top - unit * .3, unit * 1.1, '255,210,120', .45 + wave(0) * .05);
    tongue(x, top, unit * .22, unit * (.6 + wave(1) * .08), unit * wave(2) * .06, 'rgba(255,200,90,.85)');
    tongue(x, top, unit * .11, unit * (.36 + wave(3) * .06), unit * wave(0) * .04, 'rgba(255,250,220,.95)');
    ctx.restore();
  }

  // A long brick forge hearth with three fire mouths, iron straps, a bed of coals on top and an
  // anvil at one end. Drawn for walls that run east to west.
  function paintHearth(g, o, r) {
    const R = o.r, L = o.x2 - o.x, x0 = -R, x1 = L + R, near = R * K, far = -R * K, hz = .8;
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect(x0 + .14, near - .04, x1 - x0, .24);
    shapeAt(g, [[x0, near], [x1, near], [x1, near - hz], [x0, near - hz]], '#3e1e18', .06);
    g.save();
    g.beginPath();
    g.rect(x0, near - hz, x1 - x0, hz);
    g.clip();
    for (let y = near, row = 0; y > near - hz; y -= .14, row++) {
      for (let x = x0 - (row % 2) * .17; x < x1; x += .34) {
        g.fillStyle = `hsl(${6 + r() * 12}, ${34 + r() * 16}%, ${16 + r() * 10}%)`;
        g.fillRect(x + .015, y - .125, .31, .11);
      }
    }
    const heat = g.createLinearGradient(0, near, 0, near - hz);
    heat.addColorStop(0, 'rgba(255,110,40,.25)');
    heat.addColorStop(1, 'rgba(255,110,40,0)');
    g.fillStyle = heat;
    g.fillRect(x0, near - hz, x1 - x0, hz);
    g.restore();
    for (const mx of [L / 2 - L * .32, L / 2, L / 2 + L * .32]) {
      const mouth = [[mx - .25, near - .05], [mx - .25, near - .34], [mx, near - .5], [mx + .25, near - .34], [mx + .25, near - .05]];
      shapeAt(g, mouth, '#160504', .05);
      g.save();
      g.beginPath();
      mouth.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](x, y));
      g.clip();
      radial(g, mx, near - .14, .42, [[0, 'rgba(255,236,150,.95)'], [.4, 'rgba(255,130,40,.7)'], [1, 'rgba(255,80,20,0)']]);
      for (let k = 0; k < 5; k++) blob(g, mx + (r() - .5) * .4, near - .08 - r() * .06, .05 + r() * .04, r() < .5 ? '#ffd36a' : '#7a200c');
      g.restore();
    }
    for (const x of [x0 + .1, L / 2 - L * .16, L / 2 + L * .16, x1 - .1]) {
      shapeAt(g, [[x - .05, near], [x + .05, near], [x + .05, near - hz], [x - .05, near - hz]], '#2c2f36', .03);
      for (const y of [near - .12, near - hz + .12]) blob(g, x, y, .025, '#9aa0a8');
    }
    shapeAt(g, [[x0 - .05, near - hz], [x1 + .05, near - hz], [x1 + .05, far - hz], [x0 - .05, far - hz]], '#5a4840', .06);
    g.fillStyle = 'rgba(255,190,140,.4)';
    g.fillRect(x0, near - hz - .05, x1 - x0, .04);
    shapeAt(g, [[x0 + .2, near - hz - .07], [x1 - .2, near - hz - .07], [x1 - .2, far - hz + .07], [x0 + .2, far - hz + .07]], '#1e0805', .03);
    for (let k = 0; k < 90; k++) {
      const x = x0 + .26 + r() * (x1 - x0 - .52), y = far - hz + .1 + r() * (near - far - .2), heatLevel = r();
      blob(g, x, y, .03 + r() * .04, heatLevel < .45 ? '#3a120a' : heatLevel < .8 ? '#9a2a0c' : heatLevel < .95 ? '#ff7a2a' : '#ffd36a');
    }
    // The anvil: foot, waist and a face with a horn pointing to the middle of the hearth.
    const side = o.y < 0 ? 1 : -1, ax = side > 0 ? x1 - .6 : x0 + .6, ay = (near + far) / 2 - hz - .04;
    const at = list => list.map(([dx, dy]) => [ax + dx * side, ay - dy]);
    shapeAt(g, at([[-.3, 0], [.3, 0], [.2, .12], [.1, .14], [.1, .34], [.36, .38], [.36, .5], [-.3, .5], [-.62, .44], [-.3, .38], [-.1, .34], [-.1, .14], [-.2, .12]]), '#3c424c', .045);
    shapeAt(g, at([[-.3, .46], [.36, .46], [.36, .5], [-.3, .5]]), '#a8b0ba', 0);
  }

  function hearthFire(o) {
    const L = o.x2 - o.x, y = sy(o.y) + (o.r * K - .2) * unit;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [L / 2 - L * .32, L / 2, L / 2 + L * .32].forEach((mx, k) => {
      const flicker = .3 + Math.sin(clock * (9 + k) + k * 2) * .08 + Math.sin(clock * 23 + k) * .05;
      glow(sx(o.x + mx), y, unit * .55, '255,140,50', flicker);
    });
    const top = sy(o.y) - .8 * unit;
    glow(sx(o.x + L / 2), top, unit * L * .5, '255,90,30', .12 + Math.sin(clock * 3.1 + o.y) * .04);
    for (let i = 0; i < 4; i++) {
      const rise = (clock * .8 + i * .25 + o.y) % 1, x = o.x - o.r + .3 + ((i * .37 + Math.floor(clock * .8 + i * .25) * .61) % 1) * (L + o.r * 2 - .6);
      glow(sx(x) + Math.sin(rise * 9 + i) * unit * .1, top - rise * unit * 1.2, unit * .07, '255,200,110', 1 - rise);
    }
    ctx.restore();
  }

  // A low marble balustrade cut into pieces about 0.6 long: a base plinth, vase balusters, a hand
  // rail and square posts with gold finials at the ends.
  function balustradePieces(o) {
    const dx = o.x2 - o.x, dy = o.y2 - o.y, len = Math.hypot(dx, dy);
    const count = Math.max(1, Math.round(len / .6));
    let nx = -dy / len, ny = dx / len;
    if (ny < 0) { nx = -nx; ny = -ny; }
    const pieces = [];
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + 1) / count, ax = o.x + dx * t0, ay = o.y + dy * t0;
      const at = (t, off, z) => [o.x + dx * t + nx * off - ax, (o.y + dy * t + ny * off - ay) * K - z * Z];
      const ends = .3 / len;
      const corners = [at(t0 - ends, -o.r - .3, 1.1), at(t1 + ends, -o.r - .3, 1.1), at(t0 - ends, o.r + .3, 0), at(t1 + ends, o.r + .3, 0)];
      const left = Math.min(...corners.map(p => p[0])) - .2, right = Math.max(...corners.map(p => p[0])) + .2;
      const top = Math.min(...corners.map(p => p[1])) - .2, bottom = Math.max(...corners.map(p => p[1])) + .2;
      pieces.push({ x: ax, y: ay, left, top, w: right - left, h: bottom - top, depth: o.y + dy * (t0 + t1) / 2, tall: false,
        paint: g => paintBalustrade(g, o, t0, t1, at, len, k === 0, k === count - 1) });
    }
    return pieces;
  }

  function paintBalustrade(g, o, t0, t1, at, len, first, last) {
    const R = o.r, plinth = .14, rail = .56, cap = .68;
    shapeAt(g, [at(t0, R + .2, 0), at(t1, R + .2, 0), at(t1, -R + .15, 0), at(t0, -R + .15, 0)], 'rgba(30,40,20,.3)', 0);
    shapeAt(g, [at(t0, R, 0), at(t1, R, 0), at(t1, R, plinth), at(t0, R, plinth)], '#b6af96', .04);
    shapeAt(g, [at(t0, R, plinth), at(t1, R, plinth), at(t1, -R, plinth), at(t0, -R, plinth)], '#e2dbc4', .04);
    const count = Math.max(1, Math.round((t1 - t0) * len / .2));
    for (let k = 0; k < count; k++) {
      const t = t0 + (k + .5) / count * (t1 - t0);
      const [bx, by] = at(t, 0, plinth), ty = at(t, 0, rail)[1], span = ty - by;
      g.beginPath();
      g.moveTo(bx - .05, by);
      g.quadraticCurveTo(bx - .12, by + span * .35, bx - .04, by + span * .66);
      g.lineTo(bx - .06, ty);
      g.lineTo(bx + .06, ty);
      g.lineTo(bx + .04, by + span * .66);
      g.quadraticCurveTo(bx + .12, by + span * .35, bx + .05, by);
      g.closePath();
      g.fillStyle = '#ede7d3';
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = .025;
      g.stroke();
      shapeAt(g, [[bx + .01, by], [bx + .05, by], [bx + .1, by + span * .35], [bx + .03, by + span * .66], [bx + .01, by + span * .66]], 'rgba(120,108,80,.3)', 0);
    }
    shapeAt(g, [at(t0, R * .8, rail), at(t1, R * .8, rail), at(t1, R * .8, cap), at(t0, R * .8, cap)], '#c6bea4', .04);
    shapeAt(g, [at(t0, R * .8, cap), at(t1, R * .8, cap), at(t1, -R * .8, cap), at(t0, -R * .8, cap)], '#f5f0e2', .04);
    const post = .24 / len;
    for (const [end, t] of [[first, t0], [last, t1]]) {
      if (!end) continue;
      const box = z => [at(t - post, R + .02, z), at(t + post, R + .02, z), at(t + post, -R - .02, z), at(t - post, -R - .02, z)];
      shapeAt(g, [at(t - post, R + .02, 0), at(t + post, R + .02, 0), at(t + post, R + .02, cap + .1), at(t - post, R + .02, cap + .1)], '#cfc8b0', .045);
      shapeAt(g, box(cap + .1), '#f5f0e2', .04);
      blob(g, ...at(t, 0, cap + .24), .11, ink);
      blob(g, ...at(t, 0, cap + .24), .085, '#dcb75e');
      blob(g, ...at(t, -.03, cap + .28), .03, '#fff2c0');
    }
  }

  // ---- Ambient life ----

  // Bats circling under the temple roof.
  function drawBats() {
    ctx.save();
    ctx.fillStyle = '#1a0a24';
    ctx.strokeStyle = 'rgba(255,170,210,.55)';
    ctx.lineWidth = Math.max(1, unit * .02);
    for (let i = 0; i < 7; i++) {
      const home = [-9 + i * 3, -5.3 + (i % 3) * .4];
      const x = home[0] + Math.sin(clock * (.31 + i * .03) + i * 1.7) * 2.2, y = home[1] + Math.sin(clock * (.6 + i * .05) + i) * .45;
      const flap = Math.sin(clock * (13 + i) + i * 2), s = unit * (.26 + (i % 2) * .06), px = sx(x), py = y * unit;
      ctx.beginPath();
      ctx.moveTo(px - s * 1.4, py - flap * s * .9);
      ctx.quadraticCurveTo(px - s * .6, py - s * .2, px - s * .15, py);
      ctx.lineTo(px, py - s * .3);
      ctx.lineTo(px + s * .15, py);
      ctx.quadraticCurveTo(px + s * .6, py - s * .2, px + s * 1.4, py - flap * s * .9);
      ctx.quadraticCurveTo(px + s * .6, py + s * .35, px, py + s * .3);
      ctx.quadraticCurveTo(px - s * .6, py + s * .35, px - s * 1.4, py - flap * s * .9);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Birds crossing the evening sky over Elysium.
  function drawBirds() {
    ctx.save();
    ctx.strokeStyle = 'rgba(40,40,80,.75)';
    ctx.lineWidth = Math.max(1.2, unit * .035);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = ((clock * (.35 + i * .04) + i * 4.7) % 30) - 15, y = -5.7 + (i % 3) * .4 + Math.sin(clock * .5 + i) * .2;
      const flap = Math.sin(clock * (7 + i) + i), s = unit * (.18 + (i % 2) * .05), px = sx(x), py = y * unit;
      ctx.beginPath();
      ctx.moveTo(px - s, py - flap * s * .6);
      ctx.quadraticCurveTo(px - s * .4, py - s * .3, px, py);
      ctx.quadraticCurveTo(px + s * .4, py - s * .3, px + s, py - flap * s * .6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Petals and butterflies are stamped from small sheets painted once: a petal at eight turns of
  // its tumble, a butterfly of each color at four openings of its wings.
  const butterflyColors = ['#ffd25a', '#9fe0ff', '#ff9ac0', '#fff4d0'];
  let petalArt, butterflyArt;
  function paintFlutter() {
    petalArt = makeCanvas(16 * 8, 32);
    let g = petalArt.getContext('2d');
    for (let k = 0; k < 8; k++) for (const [row, color] of [[0, '#ffd6e4'], [1, '#fff8ec']]) {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(k * 16 + 8, row * 16 + 8, 7, 3.5 * (.35 + .65 * Math.abs(Math.cos(k * Math.PI / 4))), k * Math.PI / 8, 0, Math.PI * 2);
      g.fill();
    }
    butterflyArt = makeCanvas(24 * 4, 16 * 4);
    g = butterflyArt.getContext('2d');
    butterflyColors.forEach((color, row) => {
      for (let k = 0; k < 4; k++) {
        const open = .15 + k * .28, x = k * 24 + 12, y = row * 16 + 8;
        g.fillStyle = color;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.ellipse(x + side * 4.4 * open, y - 1, 5.5 * open + .6, 5, side * .4, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#2a2030';
        g.fillRect(x - .7, y - 3.5, 1.4, 6.5);
      }
    });
  }

  // Butterflies fluttering round the edge of the garden floor.
  function drawButterflies() {
    if (!butterflyArt) paintFlutter();
    const w = unit * .5, h = unit * .33;
    for (let i = 0; i < 9; i++) {
      const a = clock * (.05 + i * .006) * (i % 2 ? 1 : -1) + i * .7, wobble = Math.sin(clock * 1.3 + i * 2) * .6;
      const x = Math.cos(a) * (arena.a + .2 + wobble), y = Math.sin(a) * (arena.b + .2 + wobble * .6);
      const z = 1.1 + Math.sin(clock * 2.2 + i) * .35, open = Math.min(3, Math.floor(Math.abs(Math.cos(clock * 16 + i * 3)) * 4));
      ctx.drawImage(butterflyArt, open * 24, (i % 4) * 16, 24, 16, sx(x) - w / 2, sy(y, z) - h / 2, w, h);
    }
  }

  // Petals drifting down across the garden, tumbling as they fall.
  function drawPetals() {
    if (!petalArt) paintFlutter();
    const size = unit * .16;
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const fall = (clock * (.08 + i % 4 * .015) + i * .137) % 1;
      const x = ((i * 5.3 + clock * (.5 + i % 3 * .15)) % 26) - 13 + Math.sin(clock + i) * .4, y = (i * 3.77) % 13 - 6.5;
      ctx.globalAlpha = Math.min(1, (1 - fall) * 4, fall * 8) * .85;
      const turn = Math.floor((clock * 2 + i) * 8 / Math.PI) & 7;
      ctx.drawImage(petalArt, turn * 16, (i % 3 ? 0 : 1) * 16, 16, 16, sx(x) - size / 2, sy(y, 5 - fall * 5) - size / 2, size, size);
    }
    ctx.restore();
  }

  // Motes of light (or embers, or fireflies) rising from the floor.
  function drawMotes(count, colors, speed = 1, height = 3, size = .13) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const x = ((i * 7.31 + Math.sin(clock * .2 + i) * 1.5 + 24) % 24) - 12;
      const rise = (clock * (.12 + i % 5 * .03) * speed + i * .37) % 1;
      glow(sx(x), sy(((i * 3.77) % 13) - 6.5, rise * height), unit * size, colors[i % colors.length], Math.sin(rise * Math.PI) * .7);
    }
    ctx.restore();
  }

  // A cloth banner on a pole with a crossbar, swaying from the bottom; drawn in screen units.
  function banner(x, foot, tall, wide, long, [cloth, trim, mark], phase) {
    const px = sx(x), base = foot * unit, top = (foot - tall) * unit, w = wide * unit, l = long * unit;
    const sway = t => (Math.sin(clock * 1.6 + phase + t * 2.2) * .5 + Math.sin(clock * 2.7 + phase * 2) * .25) * t * unit * .22;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = unit * .1;
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.lineTo(px, top - unit * .1);
    ctx.moveTo(px - w * .62, top);
    ctx.lineTo(px + w * .62, top);
    ctx.stroke();
    ctx.strokeStyle = '#b08a44';
    ctx.lineWidth = unit * .05;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - w / 2, top);
    ctx.lineTo(px + w / 2, top);
    for (let k = 1; k <= 4; k++) ctx.lineTo(px + w / 2 + sway(k / 4), top + l * k / 4);
    ctx.lineTo(px + sway(.85), top + l * .8);
    ctx.lineTo(px - w / 2 + sway(1), top + l);
    for (let k = 3; k >= 1; k--) ctx.lineTo(px - w / 2 + sway(k / 4), top + l * k / 4);
    ctx.closePath();
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.lineWidth = Math.max(1, unit * .04);
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.fillRect(px - w / 2 + sway(.1), top + l * .08, w, unit * .06);
    ctx.beginPath();
    ctx.arc(px + sway(.45), top + l * .42, w * .2, 0, Math.PI * 2);
    ctx.fillStyle = mark;
    ctx.fill();
    ctx.restore();
  }

  // Glints drifting on the water (or the molten lake) round the foot of the platform.
  function drawShimmer(rgb) {
    const rx = arena.a + .75, ry = (arena.b + .75) * K;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4 + clock * .03 * (i % 2 ? 1 : -1), far = 1.14 + (i * .37 % 1) * .34;
      if (Math.sin(a) < -.25) continue;
      const life = (clock * .35 + i * .61) % 1, x = Math.cos(a) * rx * far, y = Math.sin(a) * ry * far + 1.5;
      ctx.globalAlpha = Math.sin(life * Math.PI) * .55;
      ctx.drawImage(glowStamp(rgb), (x - .35) * unit, (y - .04) * unit, .7 * unit, .08 * unit);
    }
    ctx.restore();
  }

  // Cracks in the temple floor where the light below breathes in and out.
  let cracks = [];
  function drawCrackPulse(rgb) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    cracks.forEach(([x, y], i) => {
      const pulse = Math.max(0, Math.sin(clock * .9 - i * .55)) ** 2;
      if (pulse > .02) glow(sx(x), sy(y), unit * .5, rgb, pulse * .35);
    });
    ctx.restore();
  }

  const themes = {
    temple: {
      moat: ['#127a6c', '#14305c', '#14082a'],
      ripple: r => `rgba(${90 + r() * 80},230,210,${.04 + r() * .09})`,
      backdrop: cavern,
      wall: { hue: 184, turn: 55, sat: 38, light: 25, drop: 17, buttress: '#2c5c62', buttressLight: 'rgba(170,245,225,.22)', niche: '#061820',
        glow: ['rgba(255,160,90,.28)', '#ffc07a', 'rgba(110,255,220,.18)', '#8ff7da'], bands: ['#8a6a30', '#4c4a3a'] },
      platform: '#2d6a63', grout: '#0d2a30', stone: stoneColor,
      tones: { lit: 'rgba(190,255,235,.22)', dark: 'rgba(0,8,24,.5)', chipDark: 'rgba(0,20,30,.24)', chipLit: 'rgba(180,240,220,.12)', crack: 'rgba(4,20,28,.65)' },
      inlay(g, r) { fissures(g, r); seal(g, r); },
      pools: ry => [[0, -ry - .5, 7.5, '255,120,120', .34], [-10.5, .5, 6, '60,255,215', .2], [10.5, .5, 6, '60,255,215', .2], [0, .2, 4.2, '255,225,160', .12],
        [-8, ry, 7, '60,20,110', .42, 'multiply'], [8, ry, 7, '60,20,110', .42, 'multiply']],
      shade: ['rgba(150,255,225,.14)', 'rgba(10,50,60,0)', 'rgba(2,14,24,.55)'],
      rim: { band: 'rgba(8,26,34,.82)', line: 'rgba(201,164,84,.85)', key: '#d2ab58', lip: ['#8f6c2e', '#f0cf7e'], boss: ['#c79c48', '#ffeaa8'], gems: ['#6ff0cd', '#ff6a7c'] },
      surroundings: (g, r, rx, ry) => surroundings(g, r, rx, ry),
      fall: { core: r => `${150 + r() * 100},255,235`, edge: '120,255,225', sheet: 'rgba(45,190,175,.2)', glow: '110,255,220', spray: '200,255,240',
        at: [[-6.3, -7.7, -5.45, .8], [-2.5, -7.1, -5.35, .55], [2.5, -7.1, -5.35, .55], [6.3, -7.7, -5.45, .8]] },
      mist: '150,235,225', shaft: ['255,235,205', '190,245,230'],
      shafts: [[-7.4, 2.2, 10.5, -.42, 0], [-3.2, 1.1, 9, -.36, 2.1], [3.9, 2.7, 11, -.4, 4.2], [8.6, 1.3, 9.5, -.34, 1.3]],
      shades: { top: '#9ef5e0', mid: '#3f9fb0', end: 'rgba(40,80,140,0)', arm: '#6ccfcb', hand: '#aef8e6', face: '#0a1c2c', eye: 'rgba(190,255,235,.35)', pupil: '#f2fffa', mouth: '#bfffee', glow: '90,230,220' },
      braziers: [[-8.6, -4.9, '90,220,255'], [8.6, -4.9, '90,220,255'], [-8.9, 4.7, '120,255,190'], [8.9, 4.7, '120,255,190']],
      back() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.scale(1, K);
        glow(0, 0, unit * 3.3, '70,255,200', .11 + Math.sin(clock * 1.7) * .045);
        ctx.restore();
        drawShimmer('150,255,230');
        drawCrackPulse('90,255,210');
        drawBats();
        drawFalls();
        drawMist(-5.5, .35, .55, 1.7);
        drawMist(-6.6, -.2, .3, 2.2);
        drawCrowd();
      },
      front() {
        drawMist(6.1, .5, .35, 1.9);
        drawShafts();
      },
      motes: () => drawMotes(38, ['255,230,170', '130,255,215', '130,255,215', '130,255,215'])
    },
    forge: {
      moat: ['#ffb347', '#a8300e', '#1e0606'],
      ripple: r => `rgba(255,${120 + r() * 100},${40 + r() * 50},${.06 + r() * .14})`,
      backdrop: forgeBackdrop,
      wall: { hue: 14, turn: -10, sat: 26, light: 18, drop: 12, buttress: '#3a2420', buttressLight: 'rgba(255,160,90,.2)', niche: '#120504',
        glow: ['rgba(255,140,60,.35)', '#ffb060', 'rgba(255,90,40,.25)', '#ff7a3a'], bands: ['#7a4a2a', '#3a2a22'] },
      platform: '#3a2622', grout: '#120807', stone: (r, lift = 0) => `hsl(${8 + r() * 22}, ${10 + r() * 12}%, ${13 + r() * 8 + lift * .7}%)`,
      tones: { lit: 'rgba(255,170,110,.16)', dark: 'rgba(0,0,0,.5)', chipDark: 'rgba(0,0,0,.3)', chipLit: 'rgba(255,160,100,.1)', crack: 'rgba(0,0,0,.6)' },
      inlay(g, r) {
        fissures(g, r, ['rgba(255,110,30,.12)', 'rgba(255,130,40,.32)', '#1a0603', '#ffcf6a']);
        g.save();
        g.scale(1, K);
        for (const [radius, w, color] of [[2.35, .16, ink], [2.35, .09, '#9a6a2e'], [2.35, .03, '#ffd08a']]) {
          g.strokeStyle = color;
          g.lineWidth = w;
          ellipsePath(g, 0, 0, radius, radius);
          g.stroke();
        }
        g.restore();
      },
      pools: ry => [[0, -ry - .5, 7.5, '255,120,60', .34], [-10.5, .5, 6, '255,90,40', .2], [10.5, .5, 6, '255,90,40', .2], [0, .2, 4.8, '255,160,70', .28],
        [-8, ry, 7, '40,8,8', .45, 'multiply'], [8, ry, 7, '40,8,8', .45, 'multiply']],
      shade: ['rgba(255,170,110,.12)', 'rgba(40,10,6,0)', 'rgba(10,2,2,.55)'],
      rim: { band: 'rgba(20,8,6,.85)', line: 'rgba(190,120,60,.85)', key: '#c07a3a', lip: ['#6e4022', '#e8a860'], boss: ['#9a6a3a', '#ffd9a0'], gems: ['#ff8a3a', '#ffd24a'] },
      surroundings: (g, r, rx, ry) => surroundings(g, r, rx, ry, { rock: rockLooks.forge, column: columnLooks.forge, statue: statueLooks.forge }),
      fall: { core: r => `255,${150 + r() * 80},${60 + r() * 40}`, edge: '255,140,50', sheet: 'rgba(220,80,20,.25)', glow: '255,140,50', spray: '255,220,140',
        at: [[-8.6, -7.9, -5.45, .7], [-6.8, -8.4, -5.5, .5], [6.9, -8.4, -5.5, .5], [8.7, -7.9, -5.45, .7]] },
      mist: '255,120,60', shaft: ['255,170,110', '255,110,60'], shafts: [],
      shades: { top: '#ffd0a0', mid: '#b4503c', end: 'rgba(120,30,20,0)', arm: '#e88a64', hand: '#ffd2b0', face: '#2a0a08', eye: 'rgba(255,200,150,.35)', pupil: '#fff2dc', mouth: '#ffd8b8', glow: '255,140,80' },
      braziers: [[-8.6, -4.9, '255,140,60'], [8.6, -4.9, '255,140,60'], [-8.9, 4.7, '255,180,90'], [8.9, 4.7, '255,180,90']],
      back() {
        for (const o of arena.obstacles) if (o.kind === 'pit') drawPit(o);
        drawShimmer('255,200,110');
        drawCrackPulse('255,120,40');
        for (const [x, foot, tall, phase] of [[-10.1, -3.0, 2.1, 0], [-2.5, -4.8, 1.6, 1.7], [2.5, -4.8, 1.6, 3.1], [10.1, -3.0, 2.1, 4.4]]) {
          banner(x, foot, tall, .58, tall * .6, ['#6a1410', '#d89a3a', '#1a0a08'], phase);
        }
        drawFalls();
        drawMist(-5.5, .3, .3, 1.7);
        drawMist(-6.8, -.25, .22, 2.4);
        drawCrowd();
      },
      front() { drawMist(6.1, .45, .22, 1.9); },
      motes: () => drawMotes(54, ['255,170,70', '255,220,140', '255,120,40'], 2.4, 4.2, .1)
    },
    garden: {
      moat: ['#c6f8e8', '#3aa8a0', '#183c4e'],
      ripple: r => `rgba(255,${235 + r() * 20},${190 + r() * 50},${.06 + r() * .12})`,
      backdrop: gardenBackdrop,
      wall: { hue: 48, turn: 30, sat: 14, light: 66, drop: 34, buttress: '#d4ccb0', buttressLight: 'rgba(255,255,240,.45)', niche: '#33483a',
        glow: ['rgba(255,230,150,.3)', '#ffe9a0', 'rgba(150,255,200,.22)', '#c8ffd8'], bands: ['#c9a24e', '#7a8a6a'] },
      platform: '#9aa284', grout: '#56643f', stone: (r, lift = 0) => `hsl(${38 + r() * 26}, ${12 + r() * 14}%, ${50 + r() * 12 + lift * .5}%)`,
      tones: { lit: 'rgba(255,255,240,.35)', dark: 'rgba(40,50,30,.32)', chipDark: 'rgba(60,70,40,.22)', chipLit: 'rgba(255,255,230,.2)', crack: 'rgba(60,60,40,.5)' },
      inlay: gardenInlay,
      pools: ry => [[0, -ry - .5, 7.5, '255,220,150', .3], [-10.5, .5, 6, '150,255,210', .16], [10.5, .5, 6, '150,255,210', .16], [0, .2, 4.2, '255,245,200', .14],
        [-8, ry, 7, '80,70,130', .32, 'multiply'], [8, ry, 7, '80,70,130', .32, 'multiply']],
      shade: ['rgba(255,250,220,.16)', 'rgba(60,80,60,0)', 'rgba(20,30,40,.42)'],
      rim: { band: 'rgba(70,82,58,.8)', line: 'rgba(240,210,130,.9)', key: '#ecca70', lip: ['#a88a4a', '#fff0b0'], boss: ['#e0c070', '#fff8d0'], gems: ['#7fe0ff', '#ff8aa8'] },
      surroundings: (g, r, rx, ry) => surroundings(g, r, rx, ry, { rock: rockLooks.garden, column: columnLooks.garden, statue: statueLooks.garden }),
      fall: { core: r => `${220 + r() * 35},250,255`, edge: '220,250,255', sheet: 'rgba(200,245,255,.22)', glow: '200,250,255', spray: '255,255,255',
        at: [[-6.3, -7.6, -5.45, .7], [6.3, -7.6, -5.45, .7]] },
      mist: '255,246,220', shaft: ['255,240,190', '255,220,160'],
      shafts: [[-7.4, 2.2, 10.5, -.42, 0], [-3.2, 1.1, 9, -.36, 2.1], [3.9, 2.7, 11, -.4, 4.2], [8.6, 1.3, 9.5, -.34, 1.3]],
      shades: { top: '#fff6d2', mid: '#c4b07a', end: 'rgba(160,140,90,0)', arm: '#f0dca0', hand: '#fffae0', face: '#3a3a52', eye: 'rgba(255,250,210,.4)', pupil: '#ffffff', mouth: '#fff4d8', glow: '255,236,170' },
      braziers: [[-8.6, -4.9, '255,215,130'], [8.6, -4.9, '255,215,130'], [-8.9, 4.7, '255,235,170'], [8.9, 4.7, '255,235,170']],
      back() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.scale(1, K);
        glow(0, 0, unit * 3, '255,235,170', .08 + Math.sin(clock * 1.1) * .03);
        ctx.restore();
        drawShimmer('255,250,215');
        drawBirds();
        for (const [x, foot, tall, phase] of [[-10.1, -3.0, 2.1, 0], [-2.5, -4.8, 1.6, 2.2], [2.5, -4.8, 1.6, 3.6], [10.1, -3.0, 2.1, 5.1]]) {
          banner(x, foot, tall, .5, tall * .58, ['#f4efe0', '#d8b45c', '#7fae5a'], phase);
        }
        drawFalls();
        drawMist(-5.5, .25, .4, 1.7);
        drawCrowd();
      },
      front() {
        drawShafts();
        drawPetals();
        drawButterflies();
      },
      motes: () => drawMotes(24, ['230,255,150', '255,240,170'], .6, 2.2, .1)
    }
  };
  const theme = () => themes[mapKey] || themes.temple;

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
  const glowStamp = rgb => { if (!glows.has(rgb)) glow(0, 0, 0, rgb, 0); return glows.get(rgb); };
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
    // A whirlwind turns the whole body once round during the blow.
    const facing = fall ? Math.atan2(-fall.y, -fall.x) : f.facing + (shapeName === 'spin' && anim === 'active' ? progress * Math.PI * 2 : 0);
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
    } else if (a.shape === 'nova' || a.shape === 'spin') {
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

  // Floating text. size is relative to a normal callout; big ones live a little longer. Text on the
  // same fighter a moment apart stacks upward instead of printing over the last one.
  function floater(who, text, color, size = 1, tag = '') {
    let z = 2.8;
    for (const f of floaters) {
      if (f.who === who && f.age < .4) z = Math.max(z, f.z + f.age * .9 + .42 * (f.size * .8 + size * (tag ? .95 : .2)));
    }
    floaters.push({ who, x: who.x + rand(-.3, .3), y: who.y, z, text, tag, color, size, age: 0, life: .85 + Math.min(.45, size * .15) });
  }

  // A hit number grows with the damage: a 3 is a small tick, a 60 critical fills the air.
  const damageSize = (damage, critical) => clamp(.42 + damage / 26, .5, 2.5) * (critical ? 1.2 : 1);

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
        floater(who, String(e.damage), rgb, damageSize(e.damage, e.critical),
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
      floater(who, e.perfect ? 'PERFECT' : 'BLOCK', e.perfect ? '#fff0a0' : '#ffd79a', e.perfect ? 1.15 : .7);
      rings.push({ x: e.x, y: e.y, z: 1.15, r: .15, to: e.perfect ? 1.5 : .8, age: 0, life: .22, color: '#ffe2a0' });
      jolt(e.perfect ? .14 : .05);
    } else if (e.type === 'swing') {
      trails.push({ x: who.x, y: who.y, who: e.who, team: who.team, shape: e.shape, angle: e.angle, reach: e.reach, spread: e.spread, radius: e.radius, heavy: e.heavy, age: 0, life: e.shape === 'spin' ? .4 : e.heavy ? .34 : .24 });
      if (e.shape === 'spin') rings.push({ x: who.x, y: who.y, z: .9, r: .5, to: e.reach + .3, age: 0, life: .32, color: looks[who.team].trim });
      if (e.shape === 'slam') {
        const x = who.x + Math.cos(e.angle) * e.reach, y = who.y + Math.sin(e.angle) * e.reach;
        spray(x, y, .1, 34, ['#6fb3a3', '#9fd6c4', '#3d7a72'], { speed: 4.5, up: 3, size: .09 });
        rings.push({ x, y, z: 0, r: .3, to: e.radius * 1.15, age: 0, life: .4, color: '#d8fff0' });
        jolt(.25);
      }
      if (e.shape === 'nova') rings.push({ x: who.x, y: who.y, z: .5, r: .4, to: e.reach, age: 0, life: .35, color: '#d7c2ff' });
    } else if (e.type === 'bash') {
      floater(who, 'SHIELD BASH', '#ffe2a0', .62);
    } else if (e.type === 'kick') {
      floater(who, 'KICK', '#ffd9a8', .6);
    } else if (e.type === 'interrupt') {
      floater(who, 'INTERRUPTED', '#ff9d7a', .9);
      jolt(.1);
    } else if (e.type === 'dodge') {
      floater(who, 'DODGE', '#c8f5ff', .5);
    } else if (e.type === 'swap') {
      floater(who, weapons[e.weapon].name.toUpperCase(), '#d9f4e8', .55);
    } else if (e.type === 'technique') {
      // A weapon's second attack is named as it starts, so the viewer learns the moves.
      floater(who, e.name.toUpperCase(), looks[who.team].trim, .66);
    } else if (e.type === 'guardbreak') {
      floater(who, 'GUARD OPEN', '#ffc07a', 1.05);
      jolt(.08);
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
      floater(who, '+' + e.amount, '#c2f5a1', damageSize(e.amount) * .9);
    } else if (e.type === 'fizzle') {
      spray(e.x, e.y, 1.1, 9, [e.color || '#d9c7a0', '#fff'], { speed: 2, gravity: 5, glowing: !!e.color, size: .05, life: .3 });
    } else if (e.type === 'stagger') {
      floater(who, 'STAGGERED', '#ffbe5c', 1.45);
      jolt(.14);
    } else if (e.type === 'wallslam') {
      floater(who, 'WALL SLAM', '#ff9d5c', 1.6);
      spray(e.x, e.y, .6, 26, ['#bfe0d4', '#6fa596'], { speed: 4, size: .1 });
      jolt(.3);
    } else if (e.type === 'shieldbreak') {
      floater(who, 'SHIELD BROKEN', '#ffd49c', 1.4);
      spray(who.x, who.y, 1.1, 22, ['#8a5a3c', '#d9a84e', '#c9a06b'], { speed: 4, size: .1, life: .8 });
    } else if (e.type === 'freeze') {
      floater(who, 'FROZEN', '#c5ecff', 1.3);
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
    floaters = floaters.filter(f => f.age < f.life);
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
      // A sweeping crescent, stamped flat on the plane of the swing. A backhand sweeps the other
      // way; a whirlwind carries it once round.
      const grow = ease(clamp(t.age / (t.life * .45), 0, 1));
      const spin = t.shape === 'spin', back = t.shape === 'hook';
      const art = crescent(t.team, spin ? 2.6 : t.spread, !!t.heavy);
      const size = (t.reach + .55) * unit;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(sx(t.x), sy(t.y, 1.05));
      ctx.scale(1, K);
      ctx.rotate(t.angle + (spin ? grow * Math.PI * 2 - .75 : back ? mix(-.75, .25, grow) : mix(.75, -.25, grow)));
      ctx.scale(1, back ? 1 : -1);
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
      // A sling stone: a fast grey pebble with a faint streak, loosed from over the head. A lob
      // climbs high and drops onto the rival.
      const u = p.lob ? clamp(1 - p.life / p.flight, 0, 1) : 0;
      const z = 1.55 - u * .5 + Math.sin(u * Math.PI) * 2.6;
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
    // A bout on another map repaints the scenery for it.
    if (duel.map && duel.map !== mapKey && maps[duel.map]) {
      mapKey = duel.map;
      arena = maps[mapKey];
      sized = false;
    }
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
    const look = theme();
    look.back();
    duel.fighters.forEach(telegraph);
    duel.fighters.forEach(footing);

    const items = duel.fighters.map(f => ({ y: f.y, draw: () => drawFighter(duel, f) }));
    for (const piece of obstacleArt) {
      items.push({
        y: piece.depth,
        draw: () => {
          // Tall stone fades when someone stands behind it.
          const base = piece.depth - .2;
          const hiding = piece.tall && duel.fighters.some(f => f.y < base && f.y > base - 3 && f.x > piece.x0 - 1.2 && f.x < piece.x1 + 1.2);
          ctx.globalAlpha = hiding ? .5 : 1;
          ctx.drawImage(piece.canvas, sx(piece.x) + piece.left * unit, sy(piece.y) + piece.top * unit, piece.w * unit, piece.h * unit);
          ctx.globalAlpha = 1;
          piece.live?.();
        }
      });
    }
    for (const [x, y, hue] of look.braziers) {
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

    look.front();
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
    look.motes();

    duel.fighters.forEach(labelFighter);
    if (debug) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (const body of [...duel.fighters.map(f => [f.x, f.y, root.HadesSim.radius]), ...arena.obstacles.filter(o => o.x2 === undefined).map(p => [p.x, p.y, p.r])]) {
        groundPath(circle(...body));
        ctx.stroke();
      }
      // Walls: a line with rounded ends; low ones dashed.
      for (const o of arena.obstacles) {
        if (o.x2 === undefined && !o.low) continue;
        ctx.setLineDash(o.low ? [4, 4] : []);
        if (o.x2 === undefined) groundPath(circle(o.x, o.y, o.r));
        else {
          const a = Math.atan2(o.y2 - o.y, o.x2 - o.x);
          groundPath([...Array.from({ length: 13 }, (_, i) => [o.x2 + Math.cos(a - Math.PI / 2 + i / 12 * Math.PI) * o.r, o.y2 + Math.sin(a - Math.PI / 2 + i / 12 * Math.PI) * o.r]),
            ...Array.from({ length: 13 }, (_, i) => [o.x + Math.cos(a + Math.PI / 2 + i / 12 * Math.PI) * o.r, o.y + Math.sin(a + Math.PI / 2 + i / 12 * Math.PI) * o.r])]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      groundPath(Array.from({ length: 60 }, (_, i) => [Math.cos(i / 60 * 6.283) * arena.a, Math.sin(i / 60 * 6.283) * arena.b]));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const f of floaters) {
      const pop = 1 + Math.max(0, .14 - f.age) * 3;
      const size = Math.max(9, unit * .42 * f.size) * pop;
      const x = sx(f.x), y = sy(f.y, f.z + f.age * .9);
      ctx.globalAlpha = clamp((f.life - f.age) * 3, 0, 1);
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
