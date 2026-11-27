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
  let floor, decals, decalCtx, pillarSprite;
  const bounds = { x: -15, y: -10, w: 30, h: 20 }; // painted area, in screen units
  const camera = { x: 0, y: 0, zoom: 1 };
  let particles = [], floaters = [], trails = [], ghosts = [], rings = [], pools = [];
  let shake = 0, clock = 0;
  const fallen = new Map();
  const shown = [];
  let vignette, foreground;
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
    const rx = arena.a + .75, ry = (arena.b + .75) * K;
    // Platform side, then top.
    for (let i = 10; i >= 1; i--) {
      ellipsePath(g, 0, i * .11, rx, ry);
      g.fillStyle = i > 8 ? '#06151b' : i % 4 === 0 ? '#16363b' : '#1d4447';
      g.fill();
    }
    ellipsePath(g, 0, 0, rx, ry);
    g.fillStyle = '#2d6a63';
    g.fill();
    g.save();
    ellipsePath(g, 0, 0, rx - .12, ry - .08);
    g.clip();
    paving(g, r);
    // Tufts of dark grass and pale flowers creeping in from the edge.
    for (let i = 0; i < 90; i++) {
      const angle = r() * Math.PI * 2, d = .84 + r() * .17;
      tuft(g, Math.cos(angle) * d * rx, Math.sin(angle) * d * ry, .22 + r() * .26, r);
    }
    fissures(g, r);
    seal(g, r);
    const light = g.createRadialGradient(-2, -1.5, 1, 0, 0, rx);
    light.addColorStop(0, 'rgba(150,255,225,.14)');
    light.addColorStop(.65, 'rgba(10,50,60,0)');
    light.addColorStop(1, 'rgba(2,14,24,.55)');
    g.fillStyle = light;
    g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    g.restore();
    // Gold rim with studs.
    ellipsePath(g, 0, 0, rx - .06, ry - .04);
    g.strokeStyle = ink;
    g.lineWidth = .24;
    g.stroke();
    g.strokeStyle = '#a9803c';
    g.lineWidth = .12;
    g.stroke();
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2;
      blob(g, Math.cos(a) * (rx - .06), Math.sin(a) * (ry - .04), .13, ink);
      blob(g, Math.cos(a) * (rx - .06), Math.sin(a) * (ry - .04) - .02, .08, '#e9c36c');
    }
    // Broken columns, urns and undergrowth around the platform.
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + .12;
      const x = Math.cos(a) * (rx + 1.15), y = Math.sin(a) * (ry + 1.0);
      if (i % 3 === 0 && Math.sin(a) < .3) column(g, x, y, 1.5 + r() * 1.6);
      else if (i % 3 === 1) urn(g, x, y + .1, .5 + r() * .25);
      else for (let k = 0; k < 16; k++) {
        blob(g, x + r() * 1.6 - .8, y + r() * .6 - .3, .16 + r() * .24,
          `hsl(${160 + r() * 50}, 45%, ${14 + r() * 18}%)`);
      }
    }
  }

  function tuft(g, x, y, size, r) {
    const hue = 158 + r() * 40;
    for (let k = 0; k < 11; k++) {
      const lean = (r() - .5) * 2.4, tall = size * (.5 + r() * .8);
      const baseX = x + (r() - .5) * size * 1.5, baseY = y + (r() - .5) * size * .5;
      g.beginPath();
      g.moveTo(baseX - size * .09, baseY);
      g.quadraticCurveTo(baseX + lean * tall * .2, baseY - tall * .8, baseX + lean * tall * .6, baseY - tall);
      g.quadraticCurveTo(baseX + lean * tall * .25, baseY - tall * .5, baseX + size * .09, baseY);
      g.fillStyle = `hsl(${hue + r() * 14}, ${38 + r() * 20}%, ${14 + k * 1.8}%)`;
      g.fill();
    }
    if (r() < .35) for (let k = 0; k < 3; k++) {
      const fx = x + (r() - .5) * size * 1.4, fy = y - size * (.3 + r() * .6);
      for (let p = 0; p < 5; p++) blob(g, fx + Math.cos(p * 1.256) * .045, fy + Math.sin(p * 1.256) * .035, .033, '#cfeeff');
      blob(g, fx, fy, .025, '#ffd76a');
    }
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

  function column(g, x, y, tall) {
    g.lineWidth = .08;
    g.strokeStyle = ink;
    g.fillStyle = '#2b5a60';
    g.beginPath();
    g.rect(x - .42, y - tall, .84, tall);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(160,245,225,.18)';
    g.fillRect(x - .34, y - tall, .16, tall);
    g.fillStyle = 'rgba(0,10,20,.35)';
    g.fillRect(x + .12, y - tall, .28, tall);
    for (const [dy, w] of [[-tall - .18, 1.15], [-.2, 1.1]]) {
      g.fillStyle = '#917a47';
      g.beginPath();
      g.rect(x - w / 2, y + dy, w, .24);
      g.fill();
      g.stroke();
    }
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

  // The four cover blocks: overgrown stone planters on the diagonal.
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
    for (const side of [[west, south], [south, east]]) {
      const x = (side[0][0] + side[1][0]) / 2, y = (side[0][1] + side[1][1]) / 2 - tall / 2;
      blob(g, x, y, .17, ink);
      blob(g, x, y, .12, '#8fe4cf');
    }
    g.beginPath();
    corners.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y - tall));
    g.closePath();
    g.fillStyle = '#17333a';
    g.fill();
    g.stroke();
    for (let i = 0; i < 70; i++) {
      const x = (n() - .5) * r * 1.5, y = (n() - .5) * r * K * 1.1 - tall - .12 - n() * .22;
      blob(g, x, y, .13 + n() * .12, `hsl(${158 + n() * 36}, 42%, ${19 + n() * 20}%)`);
      if (i % 6 === 0) blob(g, x, y - .08, .05, '#dff6ff');
    }
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

  // Dark growth framing the near edge, and the screen-edge shadow. Both are painted once per size.
  function paintFrame() {
    vignette = makeCanvas(width * dpr / 2, height * dpr / 2);
    let g = vignette.getContext('2d');
    const w = vignette.width, h = vignette.height;
    const edge = g.createRadialGradient(w / 2, h / 2, h * .38, w / 2, h / 2, w * .64);
    edge.addColorStop(0, 'rgba(6,8,30,0)');
    edge.addColorStop(1, 'rgba(8,2,26,.74)');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
    foreground = makeCanvas(width * dpr, height * dpr);
    g = foreground.getContext('2d');
    const r = noise(113);
    const leaf = (x, y, angle, long, color) => {
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(long * .45, -long * .24, long, 0);
      g.quadraticCurveTo(long * .45, long * .24, 0, 0);
      g.fillStyle = color;
      g.fill();
      g.restore();
    };
    for (const [cx, dir] of [[0, -1], [foreground.width, -2.1]]) {
      for (let i = 0; i < 46; i++) {
        const long = foreground.width * (.035 + r() * .07);
        const x = cx + (cx ? -1 : 1) * r() * foreground.width * .09, y = foreground.height - r() * foreground.height * .12;
        leaf(x, y, dir + (r() - .5) * 1.9, long, `hsl(${205 + r() * 55}, 55%, ${4 + r() * 8}%)`);
      }
    }
  }

  function resize() {
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    unit = Math.min(width / 23.6, height / 12.2);
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
    const g = pillarSprite.getContext('2d');
    g.setTransform(res, 0, 0, res, 1.5 * res, 2.5 * res);
    paintPillar(g, arena.pillars[0].r);
    Sprites.setResolution(unit * dpr * 1.25);
    paintFrame();
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
      team: f.index, armor: kit.armor, weapon: f.weapon, spare: f.weapon === kit.weapon ? kit.reserve : kit.weapon,
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
        spell ? hexRgb(spell.color) : looks[f.index].glow, .3 + t * .55);
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
    const rgb = looks[f.index].glow;
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
    const rgb = looks[f.index].glow;
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

  function onEvent(e, duel) {
    const who = duel.fighters[e.who];
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
      impacts.push({ x: who.x, y: who.y, z: 1.2, size: e.heavy || e.critical ? 2.1 : 1.3, turn: rand(0, 6.3), age: 0, life: .17, rgb: looks[e.by].glow });
      jolt(e.heavy ? .22 : e.critical ? .16 : .07);
    } else if (e.type === 'block') {
      spray(e.x, e.y, 1.15, e.perfect ? 30 : 14, ['#ffe9a8', '#ffb63f', '#fff'], { dirX: -e.dirX, dirY: -e.dirY, speed: 4, glowing: true, size: .05, life: .3 });
      impacts.push({ x: e.x, y: e.y, z: 1.2, size: e.perfect ? 2.4 : 1.3, turn: rand(0, 6.3), age: 0, life: .2, rgb: '255,190,80' });
      floater(who, e.perfect ? 'PERFECT' : 'BLOCK', e.perfect ? '#fff0a0' : '#ffd79a', e.perfect ? 1.1 : .8);
      rings.push({ x: e.x, y: e.y, z: 1.15, r: .15, to: e.perfect ? 1.5 : .8, age: 0, life: .22, color: '#ffe2a0' });
      jolt(e.perfect ? .14 : .05);
    } else if (e.type === 'swing') {
      trails.push({ x: who.x, y: who.y, who: e.who, shape: e.shape, angle: e.angle, reach: e.reach, spread: e.spread, radius: e.radius, heavy: e.heavy, age: 0, life: e.heavy ? .34 : .24 });
      if (e.shape === 'slam') {
        const x = who.x + Math.cos(e.angle) * e.reach, y = who.y + Math.sin(e.angle) * e.reach;
        spray(x, y, .1, 34, ['#6fb3a3', '#9fd6c4', '#3d7a72'], { speed: 4.5, up: 3, size: .09 });
        rings.push({ x, y, z: 0, r: .3, to: e.radius * 1.15, age: 0, life: .4, color: '#d8fff0' });
        jolt(.25);
      }
      if (e.shape === 'nova') rings.push({ x: who.x, y: who.y, z: .5, r: .4, to: e.reach, age: 0, life: .35, color: '#d7c2ff' });
    } else if (e.type === 'swap') {
      floater(who, weapons[e.weapon].name.toUpperCase(), '#d9f4e8', .62);
    } else if (e.type === 'dashstrike') {
      floater(who, 'DASH-STRIKE', looks[e.who].trim, .75);
      rings.push({ x: who.x, y: who.y, z: .05, r: .3, to: 1.5, age: 0, life: .28, color: looks[e.who].trim });
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
      if (t.shape === 'slam' || t.shape === 'nova') continue;
      const rgb = looks[t.who].glow;
      if (t.shape === 'thrust') {
        const c = Math.cos(t.angle), s = Math.sin(t.angle);
        const side = .22 * fade;
        shape([[t.x + c * .6 - s * side, t.y + s * .6 + c * side, 1.05], [t.x + c * (t.reach + .4), t.y + s * (t.reach + .4), 1.05],
          [t.x + c * .6 + s * side, t.y + s * .6 - c * side, 1.05]], `rgba(${rgb},${fade * .75})`, false);
        continue;
      }
      // A sweeping crescent, stamped flat on the plane of the swing.
      const grow = ease(clamp(t.age / (t.life * .45), 0, 1));
      const art = crescent(t.who, t.spread, !!t.heavy);
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

  function drawProjectile(p, duel) {
    const spell = spells[p.spellKey];
    const speed = Math.hypot(p.vx, p.vy), dx = p.vx / speed, dy = p.vy / speed;
    if (!spell) {
      limb([[p.x - dx * .65, p.y - dy * .65, 1.1], [p.x, p.y, 1.1]], .065, '#e8d3a0', false);
      limb([[p.x - dx * .1, p.y - dy * .1, 1.1], [p.x + dx * .12, p.y + dy * .12, 1.1]], .1, steel, false);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(sx(p.x - dx * .4), sy(p.y - dy * .4, 1.1), unit * .45, looks[p.owner].glow, .45);
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

  function brazier(x, y, hue) {
    const [px, py] = [sx(x), sy(y)];
    limb([[x, y, 0], [x, y, .85]], .16, '#8a6a33');
    limb([[x - .3, y, .9], [x + .3, y, .9]], .2, gold);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(px, py - unit * 1.1, unit * 2.2, hue, .2 + Math.sin(clock * 7 + x) * .035);
    for (let i = 0; i < 4; i++) {
      const lick = Math.sin(clock * (6 + i) + i * 2 + x) * .12;
      glow(px + sx(lick * (i / 3)), py - unit * (.95 + i * .22), unit * (.34 - i * .055), hue, .85);
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
    ctx.fillStyle = f.index ? '#52b4ff' : '#ff5c50';
    ctx.fillRect(x - w / 2, y, w * f.hp / f.maxHP, h);
    // Escape charges, as pips.
    for (let i = 0; i < moves[f.move].charges; i++) {
      ctx.fillStyle = i < f.charges ? '#d9fff1' : '#1d3b3c';
      ctx.fillRect(x - w / 2 + i * unit * .3, y + h + 4, unit * .22, Math.max(3, unit * .07));
    }
  }

  // Zooms in as far as both fighters stay fully in view, head to feet, clear of the HUD.
  function aimCamera(duel, dt) {
    const [a, b] = duel.fighters;
    // A fallen body stretches well past its feet, so leave more room once someone is down.
    const sprawl = duel.winner === null ? 0 : 1.5;
    const left = Math.min(a.x, b.x) - 2.4 - sprawl, right = Math.max(a.x, b.x) + 2.4 + sprawl;
    const top = Math.min(a.y, b.y) * K - 4.2, bottom = Math.max(a.y, b.y) * K + 1.4 + sprawl;
    const zoom = clamp(Math.min(width / unit / (right - left), height / unit / (bottom - top)), 1, duel.winner === null ? 1.42 : 1.3);
    // Never pan far enough to show past the painted scenery.
    const roomX = Math.max(0, 12.4 - width / unit / zoom / 2), roomY = Math.max(0, 7.4 - height / unit / zoom / 2);
    const tx = clamp((left + right) / 2, -roomX, roomX);
    const ty = clamp((top + bottom) / 2, -roomY, roomY);
    const follow = 1 - Math.exp(-dt * 3);
    camera.x += (tx - camera.x) * follow;
    camera.y += (ty - camera.y) * follow;
    camera.zoom += (zoom - camera.zoom) * follow;
  }

  function draw(duel, dt, { debug = false } = {}) {
    updateEffects(dt, duel);
    aimCamera(duel, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050f17';
    ctx.fillRect(0, 0, width, height);
    const z = camera.zoom;
    const jx = rand(-shake, shake) * unit * .5, jy = rand(-shake, shake) * unit * .5;
    ctx.setTransform(dpr * z, 0, 0, dpr * z,
      dpr * (width / 2 - camera.x * unit * z + jx), dpr * (height / 2 + unit * .25 - camera.y * unit * z + jy));
    ctx.drawImage(floor, bounds.x * unit, bounds.y * unit, bounds.w * unit, bounds.h * unit);
    ctx.drawImage(decals, bounds.x * unit, bounds.y * unit, bounds.w * unit, bounds.h * unit);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1, K);
    glow(0, 0, unit * 3.3, '70,255,200', .11 + Math.sin(clock * 1.7) * .045);
    ctx.restore();
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
    ctx.drawImage(foreground, -camera.x * unit * .25, 8 - camera.y * unit * .2, width, height);
  }

  function reset() {
    particles = []; floaters = []; trails = []; ghosts = []; rings = []; pools = []; impacts = [];
    fallen.clear();
    shake = 0;
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
