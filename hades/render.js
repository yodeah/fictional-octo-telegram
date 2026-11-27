// The picture: a high three-quarter camera over a painted Underworld arena, inked procedural
// fighters built from 3D joints, and all effects. Reads the duel, never changes it.
(function (root) {
  const { weapons, shields, armors, spells, arena, moves } = root.HadesData;

  const K = .64;      // how much floor depth is foreshortened
  const Z = .80;      // how tall one unit of height appears
  const ink = '#0b1116';
  const looks = [
    { cloth: '#b8323c', dark: '#6e1a2c', trim: '#ffc861', skin: '#e8ab80', glow: '255,120,80', hair: '#2b1620' },
    { cloth: '#2f73c4', dark: '#1d3a78', trim: '#e6f1ff', skin: '#c98f6b', glow: '110,190,255', hair: '#f2ead8' }
  ];
  const steel = '#c9d6dc', darkSteel = '#6d7f8a', wood = '#7a4a2e', gold = '#d9a84e';
  const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let canvas, ctx, width = 0, height = 0, unit = 40, dpr = 1;
  let floor, decals, decalCtx, pillarSprite;
  const bounds = { x: -15, y: -10, w: 30, h: 20 }; // painted area, in screen units
  const camera = { x: 0, y: 0, zoom: 1 };
  let particles = [], floaters = [], trails = [], ghosts = [], rings = [], pools = [];
  let shake = 0, clock = 0;
  const fallen = new Map();

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
    water.addColorStop(0, '#12514f');
    water.addColorStop(.6, '#0a2c35');
    water.addColorStop(1, '#050f17');
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
    // Flagstones laid on the diagonal, as seen from the high camera.
    g.save();
    g.scale(1, K);
    g.rotate(Math.PI / 4);
    const size = 1.45;
    for (let i = -11; i < 11; i++) for (let j = -11; j < 11; j++) {
      const shade = r();
      g.fillStyle = `hsl(${168 + r() * 22}, ${30 + r() * 14}%, ${23 + shade * 12}%)`;
      g.fillRect(i * size + .04, j * size + .04, size - .08, size - .08);
      g.fillStyle = 'rgba(200,255,230,.09)';
      g.fillRect(i * size + .05, j * size + .05, size - .1, .07);
      g.fillStyle = 'rgba(0,20,25,.35)';
      g.fillRect(i * size + .05, (j + 1) * size - .12, size - .1, .08);
      if (r() < .16) {
        g.strokeStyle = 'rgba(5,28,30,.6)';
        g.lineWidth = .035;
        let x = i * size + r() * size, y = j * size + .1;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) g.lineTo(x += r() * .5 - .25, y += .3);
        g.stroke();
      }
    }
    g.restore();
    // Moss, grass tufts and small pale flowers, thicker toward the edge.
    for (let i = 0; i < 1500; i++) {
      const angle = r() * Math.PI * 2, d = Math.sqrt(r()) * (r() < .65 ? 1 : .8);
      const edge = d > .78;
      if (!edge && r() < .65) continue;
      const x = Math.cos(angle) * d * rx, y = Math.sin(angle) * d * ry;
      blob(g, x, y, .04 + r() * (edge ? .2 : .1), `rgba(${40 + r() * 30},${130 + r() * 80},${100 + r() * 40},${.18 + r() * .3})`);
      if (r() < .08) blob(g, x, y - .06, .035, 'rgba(214,245,255,.85)');
    }
    // The central seal.
    g.save();
    g.scale(1, K);
    g.shadowColor = 'rgba(120,255,220,.5)';
    for (const [radius, w, color] of [[2.75, .24, '#7b8a58'], [2.75, .09, gold], [2.35, .05, '#e8d08a'], [1.15, .08, gold]]) {
      g.strokeStyle = color;
      g.lineWidth = w;
      ellipsePath(g, 0, 0, radius, radius);
      g.stroke();
    }
    g.strokeStyle = 'rgba(235,210,140,.75)';
    g.lineWidth = .07;
    for (let i = 0; i < 12; i++) {
      g.save();
      g.rotate(i / 12 * Math.PI * 2);
      g.beginPath();
      g.moveTo(1.15, 0);
      g.bezierCurveTo(1.5, -.55, 2.1, -.5, 2.35, 0);
      g.bezierCurveTo(2.1, .5, 1.5, .55, 1.15, 0);
      g.stroke();
      blob(g, 2.55, 0, .09, '#e8d08a');
      g.restore();
    }
    g.fillStyle = 'rgba(160,255,230,.14)';
    ellipsePath(g, 0, 0, 1.1, 1.1);
    g.fill();
    g.restore();
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

  function glow(x, y, radius, rgb, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

  // ---- Fighters ----

  // Where the weapon is, in the fighter's own frame: yaw is around the body (0 is forward,
  // positive to the fighter's right), pitch is above the horizon.
  function weaponPose(f, now) {
    const kind = f.kit.weapon;
    const a = f.action;
    let yaw = .55, pitch = .5, out = .28, high = 1.0, lunge = 0, charge = 0;
    if (kind === 'spear') { yaw = .22; pitch = .1; }
    if (kind === 'maul' || kind === 'greatsword') { yaw = .35; pitch = .75; out = .3; high = 1.05; }
    if (kind === 'staff') { yaw = .7; pitch = 1.38; high = 1.0; }
    if (kind === 'crossbow' || kind === 'bow') { yaw = .12; pitch = 0; out = .32; high = 1.12; }
    if (!a) return { yaw, pitch, out, high, lunge, charge };
    const wind = clamp(a.t / a.windup, 0, 1);
    const swing = clamp((a.t - a.windup) / a.active, 0, 1);
    const back = clamp((a.t - a.windup - a.active) / a.recover, 0, 1);
    const key = (rest, coil, follow) => a.t < a.windup ? mix(rest, coil, ease(wind))
      : a.t < a.windup + a.active ? mix(coil, follow, swing) : mix(follow, rest, ease(back));
    if (a.kind === 'bash') return { yaw, pitch, out, high, lunge: key(0, -.18, .5), charge };
    if (a.shape === 'arc') {
      yaw = key(yaw, 2.1, -1.8); pitch = key(pitch, .3, -.12); out = key(out, .3, .46); lunge = key(0, -.1, .22);
    } else if (a.shape === 'thrust') {
      yaw = key(yaw, .12, 0); pitch = key(pitch, .04, 0); out = key(out, -.2, .8); lunge = key(0, -.18, .38);
    } else if (a.shape === 'slam') {
      yaw = key(yaw, .12, 0); pitch = key(pitch, 2.15, -.75); high = key(high, 1.55, .85); out = key(out, .08, .55);
      lunge = key(0, -.14, .35);
    } else if (a.shape === 'nova') {
      pitch = key(pitch, 1.57, 1.57); high = key(high, 1.6, 1.1); charge = a.t < a.windup ? wind : 0;
    } else {
      charge = a.t < a.windup ? wind : 0;
      if (kind === 'staff') { yaw = key(yaw, .35, .05); pitch = key(pitch, 1.2, .25); out = key(out, .3, .6); high = key(high, 1.25, 1.15); }
      else { yaw = key(yaw, 0, 0); out = key(out, .4, .22); lunge = key(0, .05, -.18); }
    }
    return { yaw, pitch, out, high, lunge, charge };
  }

  function drawWeapon(kind, hand, tip, side, look, charge, color) {
    // along(d, w): d units from the hand toward the point, w units sideways.
    const dir = [tip[0] - hand[0], tip[1] - hand[1], tip[2] - hand[2]];
    const len = Math.hypot(...dir) || 1;
    const along = (d, w = 0, up = 0) => hand.map((v, i) => v + dir[i] / len * d + side[i] * w + (i === 2 ? up : 0));
    if (kind === 'sword' || kind === 'greatsword') {
      const big = kind === 'greatsword';
      const long = big ? 1.55 : 1.05, wide = big ? .12 : .085;
      limb([along(-.18), along(.08)], .08, wood);
      shape([along(.1, -wide), along(long - .16, -wide * .85), along(long), along(long - .16, wide * .85), along(.1, wide)], steel);
      limb([along(.14), along(long - .12)], .025, '#f4fbff', false);
      limb([along(.1, -.2), along(.1, .2)], .07, gold);
    } else if (kind === 'spear') {
      limb([along(-.7), along(1.25)], .07, wood);
      shape([along(1.2, -.12), along(1.7), along(1.2, .12), along(1.1)], steel);
      limb([along(1.1), along(1.2)], .11, gold);
    } else if (kind === 'axe') {
      limb([along(-.15), along(.92)], .08, wood);
      shape([along(.62, .02), along(.5, .36), along(.82, .46), along(1.06, .32), along(.9, .02)], steel);
      shape([along(.66, -.02), along(.76, -.2), along(.9, -.02)], darkSteel);
    } else if (kind === 'maul') {
      limb([along(-.25), along(1.05)], .1, wood);
      limb([along(1.08, -.27), along(1.08, .27)], .34, darkSteel);
      limb([along(1.08, -.08), along(1.08, .08)], .37, gold, false);
    } else if (kind === 'staff') {
      limb([along(-.75), along(.8)], .075, '#4d3a63');
      limb([along(.72, -.14), along(.92, -.1), along(1.02, 0)], .06, gold);
      limb([along(.72, .14), along(.92, .1)], .06, gold);
      const gem = along(.94);
      orb(gem, .11 + charge * .1, color);
      const [x, y] = point(gem);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(x, y, unit * (.5 + charge), hexRgb(color), .35 + charge * .45);
      ctx.restore();
    } else {
      limb([along(-.15), along(.55)], .11, wood);
      limb([along(.4, -.44), along(.55, -.2), along(.58, 0), along(.55, .2), along(.4, .44)], .07, kind === 'bow' ? '#9fd6a0' : darkSteel);
      limb([along(.4, -.44), along(.35 - charge * .3), along(.4, .44)], .018, '#f5efd8', false);
      if (charge > .1) limb([along(.35 - charge * .3), along(.8)], .035, '#ffe7ad', false);
    }
  }

  function fighterParts(duel, f, look, rot) {
    const kit = f.kit;
    const a = f.action;
    const now = duel.time;
    const stunned = f.stunnedUntil > now && !f.dead;
    const frozen = f.frozenUntil > now && !f.dead;
    const pose = weaponPose(f, now);
    const stride = Math.sin(f.stride * 3.4) * Math.min(1, f.gait * 1.4);
    const bob = Math.abs(Math.cos(f.stride * 3.4)) * .06 * f.gait + Math.sin(now * 2.4 + f.index * 2) * .016;
    const dashing = !!f.dash;
    const hurt = clamp(1 - (now - f.lastHurt) / .22, 0, 1);
    const lean = pose.lunge * .5 + (dashing ? .42 : f.gait * .1) - hurt * .24 + (stunned ? Math.sin(now * 5) * .14 : 0);
    const robes = kit.armor === 'robes', plate = kit.armor === 'plate';
    const crouch = a?.shape === 'slam' && a.t >= a.windup ? .16 : dashing ? .2 : 0;
    const hipZ = .76 - crouch + bob * .5, chestZ = 1.34 - crouch + bob;
    const P = rot;
    const hipL = P(0, -.17, hipZ), hipR = P(0, .17, hipZ);
    const footL = P(stride * .45 + .06, -.22, Math.max(0, stride) * .16);
    const footR = P(-stride * .45 - .08, .22, Math.max(0, -stride) * .16);
    const kneeL = P(stride * .24 + .14, -.21, hipZ * .5);
    const kneeR = P(-stride * .2 + .08, .21, hipZ * .5);
    const waist = P(lean * .3, 0, hipZ + .08);
    const chest = P(lean * .75 + .02, 0, chestZ);
    const head = P(lean + .09, 0, chestZ + .45);
    const shoulderL = P(lean * .75, -.32, chestZ + .08), shoulderR = P(lean * .75, .32, chestZ + .08);
    const handDistance = .22 + pose.out + pose.lunge * .4;
    const handR = P(Math.cos(pose.yaw) * handDistance, Math.sin(pose.yaw) * handDistance + .06, pose.high - crouch + bob);
    const tipR = P(
      Math.cos(pose.yaw) * (handDistance + Math.cos(pose.pitch)),
      Math.sin(pose.yaw) * (handDistance + Math.cos(pose.pitch)) + .06,
      Math.max(.05, pose.high - crouch + bob + Math.sin(pose.pitch)));
    const origin = P(0, 0, 0);
    const side = P(-Math.sin(pose.yaw), Math.cos(pose.yaw), 0).map((v, i) => v - origin[i]);
    const hasShield = kit.shield !== 'none' && f.shieldHits > 0;
    const twoHands = !hasShield;
    const bash = a?.kind === 'bash' ? pose.lunge : 0;
    const shieldHand = hasShield ? P(.36 + bash + lean * .5, -.3, 1.04 + bob - crouch + (a ? 0 : .02))
      : twoHands && ['maul', 'greatsword', 'spear', 'crossbow', 'bow'].includes(kit.weapon)
        ? handR.map((v, i) => mix(v, tipR[i], kit.weapon === 'crossbow' || kit.weapon === 'bow' ? .32 : .18))
        : P(.14 - stride * .2, -.44, .92 + bob);
    const elbow = (shoulder, hand, out) => {
      const mid = shoulder.map((v, i) => (v + hand[i]) / 2);
      const spread = P(-.12, out, -.1);
      return mid.map((v, i) => v + spread[i] - origin[i]);
    };

    const cloth = frozen ? '#8fc3dd' : look.cloth, dark = frozen ? '#5b8ba8' : look.dark;
    const skin = frozen ? '#bfe0ee' : look.skin;
    const body = plate ? '#8797a4' : robes ? cloth : '#8a5a3c';
    const parts = [];
    const add = (depthPoint, draw, bias = 0) => parts.push({ depth: depthPoint[1] * .8 + depthPoint[2] * .6 + bias, draw });
    const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);

    for (const [hip, knee, foot] of [[hipL, kneeL, footL], [hipR, kneeR, footR]]) {
      add(mid(hip, foot), () => {
        limb([hip, knee], .22, robes ? dark : '#3a2f38');
        limb([knee, foot], .18, plate ? darkSteel : '#4a3130');
        limb([foot, foot.map((v, i) => v + (P(.16, 0, 0)[i] - origin[i]))], .15, plate ? gold : '#2a1d1c');
      });
    }
    // Cape or robe skirt trails behind the body.
    const sway = Math.sin(now * 4 + f.index) * .06 + f.gait * .34 + (dashing ? .4 : 0);
    const cape = [
      P(lean * .7 - .16, -.3, chestZ + .12), P(lean * .7 - .16, .3, chestZ + .12),
      P(-.34 - sway, .4, .34 + sway * .55), P(-.28 - sway * 1.3, 0, .22 + sway * .7), P(-.34 - sway, -.4, .34 + sway * .55)
    ];
    add(P(-.35, 0, .9), () => {
      shape(cape, dark);
      limb([cape[2], cape[3], cape[4]], .045, look.trim, false);
    });
    if (robes) {
      add(waist, () => {
        shape([P(.2, -.22, hipZ + .16), P(.2, .22, hipZ + .16), P(.34 + stride * .1, .34, .14), P(-.02, .42, .12),
          P(-.28, 0, .12), P(-.02, -.42, .12), P(.34 - stride * .1, -.34, .14)], cloth);
        limb([P(.32, -.01, hipZ + .1), P(.42, 0, .16)], .09, look.trim, false);
      }, .02);
    }
    add(mid(waist, chest), () => {
      limb([waist, chest], .46, body);
      limb([P(lean * .6 + .02, -.17, chestZ + .04), P(lean * .6 + .02, .17, chestZ + .04)], .3, body);
      limb([P(lean * .3 + .06, -.2, hipZ + .1), P(lean * .3 + .06, .2, hipZ + .1)], .11, gold);
      limb([P(lean * .75 + .22, -.2, chestZ + .16), P(lean * .5 + .26, 0, chestZ - .2)], .1, cloth, false);
      orb(P(lean * .75 + .25, -.14, chestZ + .1), .075, look.trim);
      if (!plate && !robes) limb([P(0, 0, hipZ), P(.1, 0, hipZ - .26)], .24, cloth);
    }, .05);
    for (const [shoulder, hand, out] of [[shoulderL, shieldHand, -.18], [shoulderR, handR, .18]]) {
      add(mid(shoulder, hand), () => {
        const joint = elbow(shoulder, hand, out);
        limb([shoulder, joint], .17, robes ? cloth : skin);
        limb([joint, hand], .15, plate ? '#8797a4' : robes ? cloth : '#5b3a30');
        orb(hand, .085, skin);
      }, .06);
      add(shoulder, () => {
        orb(shoulder, plate ? .2 : .14, plate ? '#9fb0bc' : cloth);
        if (plate || out < 0) orb(shoulder.map((v, i) => v + (i === 2 ? .07 : 0)), .075, look.trim);
      }, .1);
    }
    add(head, () => {
      orb(head, .23, skin);
      // Face first, then whatever covers the crown and back of the head.
      const facing = Math.sin(f.facing);
      const back = P(lean + .02, 0, chestZ + .52);
      if (robes) {
        orb(back, .25, cloth);
        if (facing > -.25) orb(P(lean + .22, 0, chestZ + .41), .15, '#1a1420', false);
      } else if (plate) {
        orb(back, .24, '#93a5b2');
        limb([P(lean - .2, 0, chestZ + .6), P(lean, 0, chestZ + .82), P(lean + .24, 0, chestZ + .68)], .12, cloth);
      } else {
        orb(back, .235, look.hair);
        limb([back, P(lean - .22 - sway * .4, 0, chestZ + .3)], .13, look.hair, false);
        limb([P(lean + .24, -.14, chestZ + .56), P(lean + .24, .14, chestZ + .56)], .06, gold, false);
      }
      if (facing > -.35 && !f.dead) {
        for (const r of [-.085, .085]) orb(P(lean + .3, r, chestZ + .44), .033, f.index ? '#a8f4ff' : '#ffe27a', false);
      }
    }, .14);
    add(mid(handR, tipR), () => drawWeapon(kit.weapon, handR, tipR, side, look, pose.charge,
      spells[a?.spellKey]?.color || (f.index ? '#9fd8ff' : '#ffb27a')), .12);
    if (hasShield) {
      add(shieldHand, () => {
        const info = shields[kit.shield];
        const tall = kit.shield === 'tower' ? info.radius * 1.55 : info.radius;
        const ring = scale => Array.from({ length: 14 }, (_, i) => {
          const t = i / 14 * Math.PI * 2;
          const round = kit.shield === 'tower' ? .55 : 1;
          const across = Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** round;
          const up = Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** round;
          return shieldHand.map((v, axis) => v + (P(.08, across * info.radius * scale, 0)[axis] - origin[axis])
            + (axis === 2 ? up * tall * scale : 0));
        });
        shape(ring(1.08), gold);
        shape(ring(.84), Math.sin(f.facing) > -.2 ? cloth : '#5c4130');
        orb(shieldHand.map((v, i) => v + (P(.12, 0, 0)[i] - origin[i])), info.radius * .24, '#f2d38a');
        const cracks = info.durability - f.shieldHits;
        for (let i = 0; i < cracks; i++) {
          limb([shieldHand, shieldHand.map((v, k) => v + (P(.1, (i - 1) * .18, 0)[k] - origin[k]) + (k === 2 ? tall * (i % 2 ? -.8 : .8) : 0))], .025, ink, false);
        }
      }, .16);
    }
    return { parts, head, handR, tipR, stunned, frozen };
  }

  // Maps the fighter's own forward / right / up into the world, toppling the body if it has fallen.
  function frame(f, x, y, size = 1.12) {
    const c = Math.cos(f.facing), s = Math.sin(f.facing);
    const fall = fallen.get(f.index);
    return (forward, right, up) => {
      let wx = (forward * c - right * s) * size, wy = (forward * s + right * c) * size, wz = up * size;
      if (fall) {
        const t = ease(clamp(fall.age / .55, 0, 1)) * 1.45;
        const along = wx * fall.x + wy * fall.y;
        const turned = along * Math.cos(t) + wz * Math.sin(t);
        wz = Math.max(.04, wz * Math.cos(t) - along * Math.sin(t) * .4);
        wx += fall.x * (turned - along);
        wy += fall.y * (turned - along);
      }
      return [x + wx, y + wy, wz];
    };
  }

  function drawFighter(duel, f) {
    const look = looks[f.index];
    const { parts, head, stunned, frozen } = fighterParts(duel, f, look, frame(f, f.x, f.y));
    parts.sort((a, b) => a.depth - b.depth).forEach(part => part.draw());
    if (frozen) {
      ctx.save();
      ctx.globalAlpha = .55;
      for (let i = 0; i < 9; i++) {
        const angle = i * 2.4, r = .5 + (i % 3) * .12, tall = .45 + (i % 4) * .22;
        const bx = f.x + Math.cos(angle) * r, by = f.y + Math.sin(angle) * r;
        shape([[bx - .14, by, 0], [bx, by, tall], [bx + .14, by, 0]], '#c5ecff');
      }
      ctx.restore();
    }
    if (stunned) {
      for (let i = 0; i < 3; i++) {
        const a = clock * 4 + i * 2.1;
        orb([head[0] + Math.cos(a) * .4, head[1] + Math.sin(a) * .25, head[2] + .35], .08, '#ffe36e');
      }
    }
    if (f.ward > 0 && !f.dead) {
      const [x, y] = [sx(f.x), sy(f.y, .95)];
      ctx.strokeStyle = f.wardColor;
      ctx.globalAlpha = .55 + Math.sin(clock * 6) * .2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, unit * .85, unit * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
    floaters.push({ x: who.x + rand(-.3, .3), y: who.y, z: 2.35, text, tag, color, size, age: 0 });
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
      jolt(e.heavy ? .22 : e.critical ? .16 : .07);
    } else if (e.type === 'block') {
      spray(e.x, e.y, 1.15, e.perfect ? 30 : 14, ['#ffe9a8', '#ffb63f', '#fff'], { dirX: -e.dirX, dirY: -e.dirY, speed: 4, glowing: true, size: .05, life: .3 });
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
    } else if (e.type === 'dash' || e.type === 'roll') {
      ghosts.push({ who: e.who, left: moves[e.type].time, next: 0, shots: [] });
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
    for (const group of [floaters, trails, rings]) for (const item of group) item.age += dt;
    floaters = floaters.filter(f => f.age < 1);
    trails = trails.filter(t => t.age < t.life);
    rings = rings.filter(r => r.age < r.life);
    for (const g of ghosts) {
      const f = duel.fighters[g.who];
      g.left -= dt;
      g.next -= dt;
      if (g.next <= 0 && g.left > 0) { g.next = .035; g.shots.push({ x: f.x, y: f.y, age: 0 }); }
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
      // A sweeping crescent, from the coiled side to the follow-through.
      const grow = clamp(t.age / (t.life * .35), .2, 1);
      const from = t.angle + t.spread / 2 + .35;
      const to = from - (t.spread + .7) * grow;
      const arc = r => Array.from({ length: 17 }, (_, i) => {
        const a = mix(from, to, i / 16);
        const taper = r === 1 ? 1 : mix(.96, r, i / 16);
        return [t.x + Math.cos(a) * t.reach * taper, t.y + Math.sin(a) * t.reach * taper, 1.05];
      });
      shape([...arc(1), ...arc(.55).reverse()], `rgba(${rgb},${fade * .65})`, false);
      shape([...arc(1), ...arc(.88).reverse()], `rgba(255,250,235,${fade * .8})`, false);
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
    const x = sx(f.x), y = sy(f.y, 2.55);
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

  function aimCamera(duel, dt) {
    const [a, b] = duel.fighters;
    const apart = Math.hypot(a.x - b.x, (a.y - b.y) * 1.4);
    const winner = duel.winner === null ? null : duel.fighters[1 - duel.winner];
    const zoom = winner ? 1.35 : clamp(1.34 - Math.max(0, apart - 6) * .035, 1, 1.3);
    const free = 1 - 1 / zoom;
    const tx = clamp(winner ? winner.x : (a.x + b.x) / 2, -arena.a, arena.a) * Math.min(1, free * 2.6);
    const ty = clamp((winner ? winner.y : (a.y + b.y) / 2) * K, -4, 4) * Math.min(1, free * 2.6);
    const follow = 1 - Math.exp(-dt * 2.2);
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
          const f = duel.fighters[g.who];
          const alpha = .55 * (1 - shot.age / .22);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          limb([[shot.x, shot.y, .3], [shot.x, shot.y, 1.45]], .46, `rgba(${looks[f.index].glow},${alpha * .5})`, false);
          orb([shot.x, shot.y, 1.82], .22, `rgba(${looks[f.index].glow},${alpha * .6})`, false);
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
    // Vignette in screen space.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const edge = ctx.createRadialGradient(width / 2, height / 2, height * .35, width / 2, height / 2, width * .64);
    edge.addColorStop(0, 'rgba(0,10,20,0)');
    edge.addColorStop(1, 'rgba(0,6,16,.72)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }

  function reset() {
    particles = []; floaters = []; trails = []; ghosts = []; rings = []; pools = [];
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
