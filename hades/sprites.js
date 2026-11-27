// Sprite baking, the way Hades does it: each pose is built once from a rig, painted with flat color,
// heavy shadow shapes, rim light and an ink outline, and kept as a 2D image. In a bout a fighter is
// a single drawImage. Frames are baked the first time they are needed and the least recent are dropped.
(function (root) {
  const { weapons, shields } = root.HadesData;

  const K = .64;          // floor depth foreshortening, matching the camera
  const Z = .80;          // apparent height of one unit
  const SIZE = 1.38;      // fighters are painted a little larger than their collision circle
  const DIRECTIONS = 16;
  const LIMIT = 900;      // cached frames
  const frames = { idle: 4, run: 8, dash: 2, windup: 4, active: 3, recover: 3, hurt: 1, stun: 4, dead: 6 };
  const ink = '#0a0710';
  const looks = [
    { main: '#c3283a', deep: '#6d1230', light: '#ff6a52', trim: '#ffc54d', skin: '#f0b186', shade: '#a8604f',
      hair: '#231022', rim: '#ff9a5a', eye: '#ffe45c', glow: '255,120,80' },
    { main: '#2275d6', deep: '#15306e', light: '#55c2ff', trim: '#e9f6ff', skin: '#d39a78', shade: '#85505a',
      hair: '#f4ecd6', rim: '#7ff0ff', eye: '#a9fbff', glow: '110,190,255' }
  ];
  const metal = { steel: '#d3e2ea', edge: '#ffffff', dark: '#5c7080', iron: '#8497a8', gold: '#e0a93f', goldDeep: '#8a5a22', wood: '#7a432c' };

  const cache = new Map();
  let res = 80;           // pixels per world unit
  let baked = 0, bakeTime = 0;

  const makeCanvas = () => document.createElement('canvas');
  const work = makeCanvas(), mask = makeCanvas(), solid = makeCanvas();
  const g = work.getContext('2d'), m = mask.getContext('2d'), s = solid.getContext('2d');

  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

  // ---- Poses ----

  // Weapon and body parameters for one frame. yaw turns around the body (positive to the right),
  // pitch lifts the weapon, out is the hand's distance in front.
  function posture(weapon, anim, shape, t) {
    const p = { yaw: .62, pitch: .42, out: .28, high: 1.0, lunge: 0, charge: 0, lean: .06, crouch: 0, stride: 0, bob: 0, sway: .06, fall: 0 };
    if (weapon === 'spear') { p.yaw = .3; p.pitch = .16; }
    if (weapon === 'pilum') { p.yaw = .38; p.pitch = .22; p.high = 1.08; }
    if (['maul', 'greatsword', 'mace', 'axe'].includes(weapon)) { p.yaw = .5; p.pitch = .7; p.high = 1.05; }
    if (weapon === 'staff') { p.yaw = .75; p.pitch = 1.38; }
    if (weapon === 'crossbow' || weapon === 'bow' || weapon === 'recurve') { p.yaw = .16; p.pitch = 0; p.out = .32; p.high = 1.14; }
    const wave = Math.sin(t * Math.PI * 2);
    if (anim === 'idle') { p.bob = wave * .025; p.sway = .06 + wave * .04; p.crouch = .04; }
    else if (anim === 'run') {
      p.stride = wave; p.bob = Math.abs(Math.cos(t * Math.PI * 2)) * .09; p.lean = .24; p.sway = .42 + Math.sin(t * Math.PI * 4) * .1;
      p.pitch = Math.min(p.pitch, .5); p.yaw += wave * .12;
    } else if (anim === 'dash') { p.lean = .55; p.crouch = .22; p.stride = 1 - t * .5; p.sway = .9; p.yaw = 1.3; p.pitch = .1; }
    else if (anim === 'hurt') { p.lean = -.28; p.crouch = .08; p.yaw += .5; p.sway = .3; }
    else if (anim === 'stun') { p.lean = .12 + wave * .14; p.crouch = .16; p.pitch = -.5; p.sway = .1; }
    else if (anim === 'dead') { p.fall = ease(t); p.pitch = mix(p.pitch, -.2, t); p.yaw += t; p.sway = .2; }
    else {
      const key = (rest, coil, follow) => anim === 'windup' ? mix(rest, coil, ease(t))
        : anim === 'active' ? mix(coil, follow, ease(Math.min(1, t * 1.3))) : mix(follow, rest, ease(t));
      p.crouch = key(.04, .12, .16);
      if (shape === 'arc') {
        p.yaw = key(p.yaw, 2.3, -1.95); p.pitch = key(p.pitch, .45, -.18); p.out = key(p.out, .3, .5);
        p.lunge = key(0, -.14, .3); p.lean = key(.06, -.12, .36); p.sway = key(.06, .1, .55);
      } else if (shape === 'thrust') {
        p.yaw = key(p.yaw, .16, 0); p.pitch = key(p.pitch, .05, 0); p.out = key(p.out, -.26, .92);
        p.lunge = key(0, -.22, .48); p.lean = key(.06, -.16, .44); p.sway = key(.06, .1, .6);
      } else if (shape === 'slam') {
        p.yaw = key(p.yaw, .12, 0); p.pitch = key(p.pitch, 2.3, -.8); p.high = key(p.high, 1.65, .8); p.out = key(p.out, .05, .6);
        p.lunge = key(0, -.18, .42); p.lean = key(.06, -.3, .55); p.crouch = key(.04, 0, .3);
      } else if (shape === 'nova' || shape === 'self') {
        p.pitch = key(p.pitch, 1.57, 1.45); p.high = key(p.high, 1.75, 1.2); p.lean = key(.06, -.16, .12);
        p.charge = anim === 'windup' ? t : anim === 'active' ? 1 : 1 - t;
      } else if (shape === 'bash') {
        p.lunge = key(0, -.2, .55); p.lean = key(.06, -.14, .4);
      } else {
        p.charge = anim === 'windup' ? t : 0;
        if (weapon === 'pilum') {
          // An overhand throw: the javelin goes back past the ear, then whips forward.
          p.yaw = key(.4, .55, -.05); p.pitch = key(.12, .3, -.05); p.out = key(.28, -.38, .72); p.high = key(1.15, 1.8, 1.25);
          p.lean = key(.06, -.22, .42); p.lunge = key(0, -.12, .3); p.sway = key(.06, .1, .5);
        } else if (weapon === 'staff') {
          p.yaw = key(p.yaw, .4, .06); p.pitch = key(p.pitch, 1.25, .22); p.out = key(p.out, .26, .66); p.high = key(p.high, 1.3, 1.15);
          p.lean = key(.06, -.14, .3);
        } else { p.yaw = key(p.yaw, 0, 0); p.out = key(p.out, .42, .2); p.lean = key(.06, .1, -.18); }
      }
    }
    return p;
  }

  // Builds the joints for one frame in world space around the fighter's feet.
  function rig(spec, facing, anim, shape, t) {
    const p = posture(spec.weapon, anim, shape, t);
    const c = Math.cos(facing), sn = Math.sin(facing);
    const P = (forward, right, up) => {
      let x = (forward * c - right * sn) * SIZE, y = (forward * sn + right * c) * SIZE, z = up * SIZE;
      if (p.fall) {
        // Topple backward, away from the blow.
        const angle = p.fall * 1.46;
        const along = x * -c + y * -sn;
        const turned = along * Math.cos(angle) + z * Math.sin(angle);
        z = Math.max(.05, z * Math.cos(angle) - along * Math.sin(angle) * .35);
        x += -c * (turned - along); y += -sn * (turned - along);
      }
      return [x, y, z];
    };
    const vector = (forward, right, up) => sub(P(forward, right, up), P(0, 0, 0));
    const hipZ = .78 - p.crouch + p.bob * .6, chestZ = 1.36 - p.crouch * 1.2 + p.bob;
    const lean = p.lean + p.lunge * .4;
    const shift = p.lunge * .22;
    const st = p.stride;
    const j = {
      hipL: P(shift, -.15, hipZ), hipR: P(shift, .15, hipZ),
      footL: P(.12 + st * .52 + p.lunge * .5, -.24, Math.max(0, st) * .2),
      footR: P(-.16 - st * .52 - p.lunge * .2, .24, Math.max(0, -st) * .2),
      kneeL: P(.2 + st * .28 + p.crouch * .5, -.24, hipZ * .52 + Math.max(0, st) * .1),
      kneeR: P(.04 - st * .22 + p.crouch * .4, .24, hipZ * .52 + Math.max(0, -st) * .1),
      waist: P(shift + lean * .3, 0, hipZ + .1),
      chest: P(shift + lean * .72, 0, chestZ),
      neck: P(shift + lean * .9, 0, chestZ + .2),
      head: P(shift + lean * 1.02 + .06, 0, chestZ + .42),
      shoulderL: P(shift + lean * .76, -.36, chestZ + .1), shoulderR: P(shift + lean * .76, .36, chestZ + .1)
    };
    const reach = .22 + p.out + p.lunge * .4;
    const handZ = p.high - p.crouch + p.bob;
    j.handR = P(shift + Math.cos(p.yaw) * reach, Math.sin(p.yaw) * reach + .08, handZ);
    j.aim = vector(Math.cos(p.yaw) * Math.cos(p.pitch), Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch));
    j.side = vector(-Math.sin(p.yaw), Math.cos(p.yaw), 0);
    const twoHanded = ['maul', 'greatsword', 'spear', 'crossbow', 'bow', 'recurve'].includes(spec.weapon);
    j.handL = spec.shield ? P(shift + .4 + (shape === 'bash' ? p.lunge : 0) + lean * .4, -.3, 1.04 - p.crouch + p.bob)
      : twoHanded && anim !== 'dead' ? add(j.handR, j.aim.map(v => v * (['crossbow', 'bow', 'recurve'].includes(spec.weapon) ? .42 : .26)))
        : P(shift + .12 - st * .3, -.52, .9 + p.bob + (anim === 'run' ? .1 : 0));
    j.elbowL = add(lerp(j.shoulderL, j.handL, .5), vector(-.14, -.2, -.1));
    j.elbowR = add(lerp(j.shoulderR, j.handR, .5), vector(-.14, .2, -.1));
    return { j, p, P, vector, lean: shift + lean, chestZ, hipZ };
  }

  // ---- Painting ----

  let ox = 0, oy = 0;
  const px = v => (v[0]) * res + ox;
  const py = v => (v[1] * K - v[2] * Z) * res + oy;

  // Ink widths in world units. Champions are inked finer so their smaller shapes stay readable.
  let lw = .028, fw = .06;

  function poly(points, color, line = true) {
    g.beginPath();
    points.forEach((v, i) => g[i ? 'lineTo' : 'moveTo'](px(v), py(v)));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * (line === true ? lw : line);
    g.lineJoin = 'round';
    g.stroke();
  }

  function disc(v, r, color, line = true) {
    g.beginPath();
    g.arc(px(v), py(v), r * res, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * lw;
    g.stroke();
  }

  function taperPath(a, b, wa, wb) {
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    const angle = Math.atan2(by - ay, bx - ax);
    g.beginPath();
    g.arc(ax, ay, wa * res / 2, angle + Math.PI / 2, angle - Math.PI / 2);
    g.arc(bx, by, wb * res / 2, angle - Math.PI / 2, angle + Math.PI / 2);
    g.closePath();
  }

  // Several segments inked as one body part: every outline first, then every fill, so the joints
  // melt together instead of showing a ring. Each segment is [from, to, fromWidth, toWidth, color].
  function fused(segments) {
    g.strokeStyle = ink;
    g.lineWidth = res * fw;
    for (const [a, b, wa, wb] of segments) { taperPath(a, b, wa, wb); g.stroke(); }
    for (const [a, b, wa, wb, color] of segments) { taperPath(a, b, wa, wb); g.fillStyle = color; g.fill(); }
  }

  // A tapered, round-ended shape from a to b: the basic brush stroke of a limb.
  function taper(a, b, wa, wb, color, line = true) {
    taperPath(a, b, wa, wb);
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * lw;
    g.stroke();
  }

  function stroke(points, width, color) {
    g.beginPath();
    points.forEach((v, i) => g[i ? 'lineTo' : 'moveTo'](px(v), py(v)));
    g.strokeStyle = color;
    g.lineWidth = width * res;
    g.lineCap = g.lineJoin = 'round';
    g.stroke();
  }

  // A pool of light, for eyes and magic. Queued and added after the outline so it stays pure light.
  let lights = [];
  const shine = (v, r, color) => lights.push([px(v), py(v), r * res, color]);

  function addLights(context) {
    context.globalCompositeOperation = 'lighter';
    for (const [x, y, r, color] of lights) {
      const gradient = context.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  const weaponLength = { gladius: .95, pilum: 1.5, recurve: .9, sica: .95, sword: 1.2, greatsword: 1.75, spear: 1.85, axe: 1.15, mace: 1.05, maul: 1.4, staff: 1.15, crossbow: .85, bow: .85 };

  // along(d, w): d from the hand toward the point, w across.
  function weapon(kind, hand, aim, side, look, charge) {
    const al = (d, w = 0) => hand.map((v, i) => v + aim[i] * d + side[i] * w);
    if (championGear[kind]) return championGear[kind](al, aim, side, look, charge);
    if (kind === 'sword' || kind === 'greatsword') {
      const big = kind === 'greatsword';
      const long = big ? 1.72 : 1.18, w = big ? .17 : .115;
      taper(al(-.22), al(.08), .08, .08, metal.wood);
      disc(al(-.25), .065, metal.gold);
      poly([al(.12, -w * .8), al(long * .62, -w), al(long, 0), al(long * .62, w), al(.12, w * .8)], metal.steel);
      poly([al(.14, 0), al(long, 0), al(long * .62, w), al(.14, w * .8)], metal.iron, false);
      stroke([al(.18, -w * .5), al(long * .68, -w * .62), al(long * .93, 0)], .028, metal.edge);
      poly([al(.06, -.27), al(.17, -.07), al(.17, .07), al(.06, .27), al(.02, .07), al(.02, -.07)], metal.gold);
      disc(al(.1), .05, look.light);
    } else if (kind === 'spear') {
      taper(al(-.82), al(1.3), .075, .065, metal.wood);
      poly([al(1.18, -.04), al(1.3, -.19), al(1.85, 0), al(1.3, .19), al(1.18, .04)], metal.steel);
      stroke([al(1.3, -.12), al(1.76, 0)], .025, metal.edge);
      taper(al(1.08), al(1.22), .13, .1, metal.gold);
      poly([al(1.08, .02), al(.7, .3), al(.82, .08), al(.62, .12), al(1.0, -.02)], look.main);
    } else if (kind === 'axe') {
      taper(al(-.2), al(1.0), .085, .075, metal.wood);
      poly([al(.66, .02), al(.46, .34), al(.6, .55), al(.92, .6), al(1.14, .4), al(.94, .22), al(.98, .02)], metal.steel);
      stroke([al(.55, .46), al(.9, .54), al(1.08, .4)], .04, metal.edge);
      poly([al(.68, -.02), al(.8, -.26), al(.94, -.02)], metal.dark);
      taper(al(.6), al(1.03), .12, .12, metal.gold, false);
    } else if (kind === 'mace') {
      taper(al(-.18), al(.76), .085, .08, metal.wood);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        poly([al(.88 + Math.cos(a - .35) * .16, Math.sin(a - .35) * .16), al(.88 + Math.cos(a) * .34, Math.sin(a) * .34),
          al(.88 + Math.cos(a + .35) * .16, Math.sin(a + .35) * .16)], metal.steel);
      }
      disc(al(.88), .2, metal.iron);
      disc(al(.9, -.04), .08, metal.steel, false);
    } else if (kind === 'maul') {
      taper(al(-.3), al(1.1), .1, .1, metal.wood);
      stroke([al(.2), al(.5)], .13, look.deep);
      poly([al(.96, -.38), al(1.34, -.34), al(1.42, 0), al(1.34, .34), al(.96, .38), al(.9, 0)], metal.iron);
      poly([al(1.18, -.35), al(1.34, -.34), al(1.42, 0), al(1.34, .34), al(1.18, .35)], metal.dark, false);
      taper(al(1.12, -.4), al(1.12, .4), .09, .09, metal.gold);
      disc(al(1.12), .09, look.light);
    } else if (kind === 'staff') {
      taper(al(-.85), al(.85), .08, .07, '#3b2350');
      poly([al(.74, -.05), al(.86, -.28), al(1.14, -.2), al(.98, -.13), al(.9, -.02)], metal.gold);
      poly([al(.74, .05), al(.86, .28), al(1.14, .2), al(.98, .13), al(.9, .02)], metal.gold);
      const gem = al(1.02);
      shine(gem, .42 + charge * .55, `rgba(${look.glow},${.55 + charge * .45})`);
      disc(gem, .11 + charge * .08, look.light);
      disc(al(1.05, -.03), .05 + charge * .04, '#ffffff', false);
    } else {
      taper(al(-.2), al(.6), .12, .09, metal.wood);
      const wing = kind === 'bow' ? '#79d49a' : metal.iron;
      poly([al(.3, -.58), al(.55, -.34), al(.66, 0), al(.55, .34), al(.3, .58), al(.46, .3), al(.52, 0), al(.46, -.3)], wing);
      stroke([al(.3, -.58), al(.3 - charge * .32), al(.3, .58)], .022, '#fff4d6');
      stroke([al(.3 - charge * .32), al(.84)], .04, metal.wood);
      poly([al(.8, -.07), al(1.0, 0), al(.8, .07)], metal.steel);
      if (charge > .5) shine(al(.9), .3, `rgba(${look.glow},.8)`);
      disc(al(.5), .06, metal.gold);
    }
  }

  function shield(r, spec, look, facing) {
    const { j, vector } = r;
    const info = shields[spec.shield];
    const tower = spec.shield === 'tower';
    const wide = info.radius * 1.08, tall = tower ? info.radius * 1.65 : info.radius * 1.08;
    const ring = (scale, forward) => Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2, round = tower ? .5 : 1;
      const across = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** round;
      const up = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** round;
      return add(add(j.handL, vector(forward, across * wide * scale, 0)), [0, 0, up * tall * scale]);
    });
    const front = Math.sin(facing) > -.25;
    poly(ring(1.05, .06), metal.gold);
    poly(ring(.84, .09), front ? look.main : '#4c2f2a');
    if (front) {
      const centre = add(j.handL, vector(.13, 0, 0));
      poly([add(centre, [0, 0, tall * .6]), add(centre, vector(0, wide * .22, 0)), add(centre, [0, 0, -tall * .6]),
        add(centre, vector(0, -wide * .22, 0))], metal.gold);
      disc(centre, info.radius * .22, look.trim);
    }
    for (let i = 0; i < spec.cracks; i++) {
      stroke([add(j.handL, vector(.14, 0, 0)), add(j.handL, vector(.14, (i % 2 ? 1 : -1) * wide * .35, tall * .3)),
        add(j.handL, vector(.14, (i % 2 ? 1 : -1) * wide * .8, i > 1 ? -tall * .6 : tall * .55))], .03, ink);
    }
  }

  function head(r, spec, look, facing, add3) {
    const { j, vector, p } = r;
    const h = j.head;
    const front = Math.sin(facing);
    const at = (forward, right, up) => add(h, vector(forward, right, up));
    const eyes = () => {
      if (front < -.3 || p.fall > .5) return;
      for (const side of [-.095, .095]) {
        const eye = at(.2, side, .0);
        shine(eye, .1, `rgba(${look.glow},.9)`);
        taper(at(.2, side - .03, .012), at(.2, side + .03, -.006), .05, .032, look.eye, false);
      }
    };
    if (spec.armor === 'plate') {
      disc(h, .25, metal.iron);
      if (front > -.3) poly([at(.2, -.17, .06), at(.23, 0, .02), at(.2, .17, .06), at(.18, .12, -.14), at(.22, 0, -.08), at(.18, -.12, -.14)], '#1a1220');
      poly([at(-.3, 0, .08), at(-.22, 0, .42), at(-.02, 0, .52), at(.1, 0, .34), at(.02, 0, .26), at(-.1, 0, .29), at(-.16, 0, .15)], look.main);
      stroke([at(-.2, 0, .32), at(-.04, 0, .43), at(.05, 0, .33)], .045, look.light);
      stroke([at(.18, -.2, .1), at(.25, 0, .1), at(.18, .2, .1)], .06, metal.gold);
      eyes();
    } else if (spec.armor === 'robes') {
      poly([at(.04, -.3, -.16), at(-.06, -.28, .2), at(-.1, 0, .46), at(-.06, .28, .2), at(.04, .3, -.16), at(-.2, 0, -.24)], look.main);
      disc(at(-.02, 0, .03), .25, look.main);
      if (front > -.3) {
        disc(at(.13, 0, -.02), .165, '#150c1e', false);
        stroke([at(.14, -.21, -.1), at(.12, -.17, .13), at(.1, 0, .22), at(.12, .17, .13), at(.14, .21, -.1)], .055, look.trim);
      } else stroke([at(-.1, 0, .44), at(-.28, 0, .06), at(-.24, 0, -.2)], .05, look.trim);
      eyes();
    } else {
      // Hair sits behind the face from the front, and over the whole head from behind.
      const wind = .1 + p.sway * .45;
      const hair = () => {
        for (const [side, up, length] of [[-.2, .12, .34], [.2, .12, .34], [0, .26, .46], [-.1, -.04, .32], [.1, -.04, .32]]) {
          poly([at(-.08, side - .09, up + .08), at(-.24 - wind * length, side * 1.5, up + .12 - wind * .08), at(-.12, side + .09, up - .08)], look.hair);
        }
        disc(at(-.08, 0, .07), .22, look.hair);
      };
      if (front > -.3) hair();
      disc(h, .215, look.skin);
      if (front > -.3) {
        stroke([at(.19, 0, -.02), at(.23, 0, -.08)], .028, look.shade);
        stroke([at(.18, -.06, -.13), at(.18, .06, -.125)], .024, ink);
        for (const side of [-.1, .1]) stroke([at(.2, side * 1.7, .06), at(.22, side * .5, .035)], .036, ink);
        eyes();
        poly([at(.1, -.2, .12), at(.08, -.04, .24), at(.19, .02, .12), at(.12, .08, .2), at(.12, .2, .11), at(-.04, 0, .26)], look.hair);
      } else hair();
      if (spec.kit !== 'duelist') return;
      // A gilded laurel.
      stroke([at(.13, -.2, .1), at(.21, 0, .12), at(.13, .2, .1)], .035, metal.gold);
      for (const side of [-.2, .2]) for (let i = 0; i < 3; i++) {
        poly([at(.08 - i * .09, side, .12 + i * .02), at(.02 - i * .09, side * 1.25, .22 + i * .02), at(-.02 - i * .09, side, .12 + i * .02)], metal.gold, false);
      }
    }
  }

  // What sets each class apart at a glance, drawn over the head. The team color stays the base.
  function headgear(r, spec, look, facing) {
    const { j, vector } = r;
    const at = (forward, right, up) => add(j.head, vector(forward, right, up));
    const front = Math.sin(facing) > -.3;
    const horn = (side, color, long) => {
      poly([at(-.02, side * .18, .12), at(-.04, side * .42 * long, .24), at(.02, side * .46 * long, .52 * long),
        at(-.1, side * .3 * long, .28), at(-.12, side * .14, .18)], color);
    };
    switch (spec.kit) {
      case 'hoplite': // a sideways horsehair crest
        poly([at(-.06, -.4, .18), at(-.1, -.32, .46), at(-.1, 0, .58), at(-.1, .32, .46), at(-.06, .4, .18), at(-.04, 0, .3)], look.main);
        stroke([at(-.05, -.34, .26), at(-.08, 0, .46), at(-.05, .34, .26)], .035, look.light);
        break;
      case 'raider': // a wolf's head pulled over the brow
        for (const side of [-1, 1]) poly([at(-.06, side * .1, .34), at(-.12, side * .34, .7), at(-.06, side * .34, .3)], '#6a657a');
        disc(at(-.08, 0, .17), .27, '#a6a1b2');
        poly([at(-.02, -.22, .3), at(.1, -.14, .16), at(.34, 0, .12), at(.1, .14, .16), at(-.02, .22, .3), at(-.04, 0, .42)], '#c4c0ce');
        if (front) {
          disc(at(.34, 0, .13), .045, ink, false);
          for (const side of [-.11, .11]) disc(at(.14, side, .27), .036, '#ffd34a');
          for (const side of [-.09, .09]) poly([at(.23, side - .035, .13), at(.25, side, .02), at(.23, side + .035, .13)], '#fff6e0');
        }
        break;
      case 'breaker':
        horn(-1, '#e9dcc0', 1.15);
        horn(1, '#e9dcc0', 1.15);
        break;
      case 'executioner': // a black hood drawn over the helm, eyes burning in the slot
        poly([at(.02, -.31, -.14), at(-.04, -.28, .22), at(-.1, 0, .44), at(-.04, .28, .22), at(.02, .31, -.14), at(.1, .17, .1), at(.18, 0, .12), at(.1, -.17, .1)], '#251a2c');
        stroke([at(.06, -.2, .06), at(.19, 0, .13), at(.06, .2, .06)], .04, look.main);
        break;
      case 'marksman': // a brimmed cap with a long feather
        poly(Array.from({ length: 12 }, (_, i) => at(Math.cos(i / 12 * 6.283) * .3 - .02, Math.sin(i / 12 * 6.283) * .34, .15)), look.deep);
        disc(at(-.04, 0, .22), .17, look.main);
        poly([at(-.1, .18, .22), at(-.42, .3, .54), at(-.6, .26, .5), at(-.3, .22, .36)], look.trim);
        break;
      case 'huntress': // a green hood with two tall feathers
        for (const side of [-1, 1]) {
          poly([at(-.08, side * .16, .26), at(-.22, side * .52, .72), at(-.26, side * .36, .34)], side < 0 ? look.trim : look.light);
        }
        disc(at(-.1, 0, .13), .255, '#2f7a58');
        poly([at(.1, -.23, .08), at(.08, 0, .33), at(.1, .23, .08), at(.14, 0, .17)], '#46a377');
        poly([at(-.26, -.1, .06), at(-.52 - r.p.sway * .2, 0, -.2), at(-.26, .1, .06)], '#2f7a58');
        break;
      case 'frostmage': // a crown of ice
        for (const [side, tall] of [[-.22, .46], [-.11, .56], [0, .7], [.11, .56], [.22, .46]]) {
          poly([at(0, side - .06, .22), at(-.04, side * 1.35, tall), at(0, side + .06, .22)], '#c9f2ff');
        }
        break;
      case 'stormmage': // forked antennae with a spark between them
        for (const side of [-1, 1]) {
          stroke([at(-.04, side * .2, .2), at(-.06, side * .4, .34), at(-.04, side * .3, .44), at(-.06, side * .44, .64)], .075, ink);
          stroke([at(-.04, side * .2, .2), at(-.06, side * .4, .34), at(-.04, side * .3, .44), at(-.06, side * .44, .64)], .04, '#e2d2ff');
        }
        shine(at(-.04, 0, .52), .3, 'rgba(190,160,255,.8)');
        break;
      case 'bloodmage':
        horn(-1, '#c22a45', 1);
        horn(1, '#c22a45', 1);
        if (front) disc(at(.18, 0, .2), .045, '#ff5a6e');
        break;
      case 'emberpriest': // a halo of flame
        stroke(Array.from({ length: 17 }, (_, i) => at(-.2, Math.cos(i / 16 * 6.283) * .36, .14 + Math.sin(i / 16 * 6.283) * .36)), .05, '#ffb445');
        for (let i = 0; i < 7; i++) {
          const a = i / 6 * Math.PI;
          const rim = (da, reach) => at(-.2, Math.cos(a + da) * reach, .14 + Math.sin(a + da) * reach);
          poly([rim(-.14, .38), rim(0, .54), rim(.14, .38)], '#ffd268', false);
        }
        shine(at(-.2, 0, .2), .55, 'rgba(255,170,60,.45)');
        break;
    }
  }

  function figure(spec, facing, r) {
    const look = looks[spec.team];
    const { j, p, P, vector, lean, chestZ, hipZ } = r;
    const plate = spec.armor === 'plate', robes = spec.armor === 'robes';
    const parts = [];
    const part = (at, draw, bias = 0) => parts.push({ depth: at[1] * K + at[2] * .55 + bias, draw });

    // Legs.
    for (const [hip, knee, foot] of [[j.hipL, j.kneeL, j.footL], [j.hipR, j.kneeR, j.footR]]) {
      part(lerp(hip, foot, .5), () => {
        const ankle = add(foot, [0, 0, .07]);
        const toe = add(foot, add(vector(.2, 0, 0), [0, 0, .02]));
        const thigh = robes ? look.deep : plate ? '#2c2236' : look.skin;
        const shin = plate ? metal.iron : '#4a2a36';
        const calf = lerp(knee, ankle, .35);
        fused([[hip, knee, .27, .16, thigh], [knee, calf, .16, .2, shin], [calf, ankle, .2, .11, shin],
          [ankle, toe, .17, .09, plate ? metal.dark : '#2a1820']]);
        // Boot cuff, shin guard and thigh muscle.
        taper(lerp(knee, ankle, .08), lerp(knee, ankle, .18), .19, .2, plate ? metal.gold : look.deep);
        stroke([lerp(knee, ankle, .28), lerp(knee, ankle, .8)], .045, plate ? metal.steel : look.trim);
        if (!plate && !robes) stroke([lerp(hip, knee, .45), lerp(hip, knee, .86)], .022, look.shade);
        if (plate) poly([add(knee, [0, 0, .12]), add(knee, vector(.1, .09, 0)), add(knee, [0, 0, -.1]), add(knee, vector(.1, -.09, 0))], metal.gold);
      });
    }

    // Cape: broad at the shoulders, ending in torn tails that stream with movement.
    const sway = p.sway;
    const drop = .32 + sway * .62;
    const c = (forward, right, up) => P(forward, right, Math.max(.04, up));
    const capeShape = [
      c(lean * .8 - .12, -.34, chestZ + .16), c(lean * .8 - .12, .34, chestZ + .16),
      c(-.3 - sway * .45, .48, .75 + sway * .25), c(-.46 - sway * .9, .46, drop - .1), c(-.38 - sway * .62, .22, drop + .22),
      c(-.55 - sway * 1.15, .04, drop - .14), c(-.38 - sway * .6, -.18, drop + .2), c(-.46 - sway * .92, -.46, drop - .06),
      c(-.3 - sway * .45, -.48, .75 + sway * .25)
    ];
    part(P(-.34, 0, .95), () => {
      poly(capeShape, robes ? look.deep : look.main);
      poly([capeShape[0], c(-.3 - sway * .5, -.12, .8 + sway * .2), capeShape[5], capeShape[6], capeShape[7], capeShape[8]], look.deep, false);
      stroke([capeShape[3], capeShape[4], capeShape[5], capeShape[6], capeShape[7]], .035, look.trim);
    });

    // The spare weapon rides across the back.
    part(P(-.4, 0, 1.1), () => {
      const grip = P(lean * .6 - .32, .24, chestZ + .04);
      const down = vector(-.12, -.68, -.7);
      weapon(spec.spare, grip, down.map(v => v * .72), vector(0, .7, -.7), look, 0);
    });

    if (robes) {
      part(j.waist, () => {
        const flare = p.stride * .14;
        const hem = [c(.36 + flare, .38, .08), c(.02, .52, .05), c(-.34 - sway * .3, .3, .08), c(-.36 - sway * .3, -.3, .08), c(.02, -.52, .05), c(.36 - flare, -.38, .08)];
        poly([P(lean * .3 + .18, -.24, hipZ + .18), P(lean * .3 + .18, .24, hipZ + .18), hem[0], hem[1], hem[2], hem[3], hem[4], hem[5]], look.main);
        poly([P(lean * .3 + .2, .02, hipZ + .1), hem[0], hem[1], hem[2]], look.deep, false);
        stroke([...hem, hem[0]], .055, look.trim);
        if (Math.sin(facing) > -.3) poly([P(lean * .3 + .24, -.1, hipZ + .14), P(lean * .3 + .24, .1, hipZ + .14), c(.47, .09, .12), c(.47, -.09, .12)], look.trim);
      }, .03);
    }

    // Torso: wide shoulders, narrow waist.
    part(lerp(j.waist, j.chest, .6), () => {
      const body = plate ? metal.iron : robes ? look.main : look.skin;
      const yokeL = P(lean * .76, -.24, chestZ + .07), yokeR = P(lean * .76, .24, chestZ + .07);
      fused([[P(lean * .3, 0, hipZ), j.waist, .36, .3, robes ? look.main : '#2c1c28'], [j.waist, j.chest, .3, .58, body],
        [yokeL, yokeR, .34, .34, body], [j.chest, j.neck, .22, .15, plate ? metal.dark : robes ? look.deep : look.skin]]);
      const front = Math.sin(facing) > -.35;
      // Points on the front of the chest.
      const on = (right, up, out = .24) => P(lean * (.3 + .46 * Math.min(1, (up - hipZ) / (chestZ - hipZ))) + out, right, up);
      if (front) {
        if (plate) {
          poly([on(-.27, chestZ + .12, .17), on(0, chestZ + .16), on(.27, chestZ + .12, .17), on(.2, chestZ - .16, .2),
            on(0, chestZ - .27, .27), on(-.2, chestZ - .16, .2)], metal.steel);
          poly([on(0, chestZ + .16), on(.27, chestZ + .12, .17), on(.2, chestZ - .16, .2), on(0, chestZ - .27, .27)], metal.iron, false);
          stroke([on(-.26, chestZ + .13, .18), on(0, chestZ + .04, .27), on(.26, chestZ + .13, .18)], .04, metal.gold);
          stroke([on(0, chestZ + .04, .28), on(0, chestZ - .27, .28)], .022, ink);
          for (const drop of [.34, .43]) stroke([on(-.15, chestZ - drop, .19), on(0, chestZ - drop - .03, .23), on(.15, chestZ - drop, .19)], .045, metal.dark);
          poly([on(0, chestZ + .1, .29), on(.07, chestZ + .02, .3), on(0, chestZ - .07, .3), on(-.07, chestZ + .02, .3)], look.light);
        } else if (!robes) {
          // Chest and stomach muscle, then a studded leather strap.
          for (const side of [-1, 1]) stroke([on(side * .25, chestZ + .03, .17), on(side * .13, chestZ - .08), on(side * .02, chestZ - .05)], .028, look.shade);
          stroke([on(0, chestZ + .02), on(0, hipZ + .2, .2)], .02, look.shade);
          for (const drop of [.17, .26]) stroke([on(-.09, chestZ - drop, .22), on(.09, chestZ - drop, .22)], .016, look.shade);
          stroke([on(-.27, chestZ + .17, .14), on(0, chestZ - .13, .27), on(.18, hipZ + .15, .19)], .12, ink);
          stroke([on(-.27, chestZ + .17, .14), on(0, chestZ - .13, .27), on(.18, hipZ + .15, .19)], .085, look.deep);
          disc(on(-.01, chestZ - .13, .29), .065, metal.gold);
          disc(on(-.01, chestZ - .13, .31), .028, look.light, false);
        } else {
          poly([on(-.22, chestZ + .16, .18), on(0, chestZ - .3, .28), on(.22, chestZ + .16, .18), on(0, chestZ + .06, .27)], look.deep);
          stroke([on(-.22, chestZ + .16, .19), on(0, chestZ - .3, .29), on(.22, chestZ + .16, .19)], .055, look.trim);
          disc(on(0, chestZ - .08, .3), .062, look.light);
          shine(on(0, chestZ - .08, .32), .18, `rgba(${look.glow},.6)`);
        }
      } else {
        stroke([P(lean * .76 - .24, 0, chestZ + .12), P(lean * .45 - .2, 0, hipZ + .2)], .025, plate ? metal.dark : robes ? look.deep : look.shade);
      }
      taper(P(lean * .32, -.17, hipZ + .1), P(lean * .32, .17, hipZ + .1), .13, .13, metal.goldDeep);
      if (front) disc(P(lean * .32 + .18, 0, hipZ + .1), .085, metal.gold);
      if (!robes) {
        // Pleated war skirt.
        for (const [forward, right] of [[.14, -.2], [.18, 0], [.14, .2]]) {
          poly([P(lean * .3 + forward, right - .09, hipZ + .05), P(lean * .3 + forward, right + .09, hipZ + .05),
            P(forward + .06 - p.stride * right * .5, right * 1.2 + .06, hipZ - .32), P(forward + .06 - p.stride * right * .5, right * 1.2 - .06, hipZ - .32)],
          right ? look.deep : look.main);
        }
      }
    }, .06);

    // Arms and shoulders.
    for (const [shoulder, elbow, hand, left] of [[j.shoulderL, j.elbowL, j.handL, true], [j.shoulderR, j.elbowR, j.handR, false]]) {
      part(lerp(shoulder, hand, .55), () => {
        const upper = robes ? look.main : look.skin;
        const lower = plate ? metal.iron : upper;
        const bicep = lerp(shoulder, elbow, .45), forearm = lerp(elbow, hand, .3);
        fused([[shoulder, bicep, .22, .2, upper], [bicep, elbow, .2, .13, upper], [elbow, forearm, .13, robes ? .19 : .17, lower],
          [forearm, hand, robes ? .19 : .17, robes ? .26 : .1, lower]]);
        if (!robes) {
          // Bracer with gilded bands.
          taper(lerp(elbow, hand, .34), lerp(elbow, hand, .82), .17, .12, plate ? metal.steel : '#4a2630');
          for (const at of [.4, .76]) stroke([lerp(elbow, hand, at), lerp(elbow, hand, at + .05)], .15 - at * .03, metal.gold);
          stroke([lerp(shoulder, elbow, .3), lerp(shoulder, elbow, .74)], .02, look.shade);
        } else stroke([lerp(elbow, hand, .86), lerp(elbow, hand, .95)], .22, look.trim);
        // A closed fist.
        const knuckle = lerp(hand, add(hand, sub(hand, elbow)), .13);
        fused([[lerp(hand, elbow, .06), knuckle, .15, .13, plate ? metal.dark : look.skin]]);
        stroke([hand, knuckle], .018, plate ? metal.steel : look.shade);
      }, .07);
      part(shoulder, () => {
        const big = plate ? 1.25 : left && !robes ? 1.1 : robes ? .8 : .62;
        const at = (forward, right, up) => add(shoulder, vector(forward, right * (left ? -1 : 1), up));
        if (big > .75) {
          poly([at(.2, -.1, .06), at(0, 0, .2 * big), at(-.1, .2 * big, .22 * big), at(0, .3 * big, -.04), at(.04, .18, -.14), at(.18, .02, -.08)],
            plate ? metal.iron : robes ? look.deep : '#5b2d38');
          stroke([at(.2, -.1, .06), at(0, 0, .2 * big), at(-.1, .2 * big, .22 * big), at(0, .3 * big, -.04)], .045, metal.gold);
          if (plate) poly([at(-.02, .12, .22), at(-.14, .34, .46), at(.04, .24, .16)], metal.gold);
          disc(at(.08, .08, .03), .052, look.light);
        } else disc(shoulder, .105, robes ? look.main : look.skin, false);
      }, .12);
    }

    part(j.head, () => {
      head(r, spec, look, facing);
      headgear(r, spec, look, facing);
    }, .16);
    part(lerp(j.handR, add(j.handR, j.aim), .45), () => weapon(spec.weapon, j.handR, j.aim, j.side, look, p.charge), .13);
    if (spec.shield) part(j.handL, () => shield(r, spec, look, facing), .18);

    parts.sort((a, b) => a.depth - b.depth);
    for (const item of parts) item.draw();
    return capeShape;
  }

  // ---- Champions ----
  // Varro the murmillo and Cassian the archer are fixed characters with their own, finer drawing:
  // thinner ink, smaller armor pieces, faces and gear that read at the arena camera distance.

  const champ = {
    murmillo: {
      skin: '#dca077', shade: '#a2603f', deep: '#6e3a26', glint: 'rgba(255,226,190,.55)', scar: '#f3cdb0',
      bronze: '#d39a3e', bronzeDeep: '#7d5020', bronzeLight: '#ffdc8c', linen: '#efe2c4', linenShade: '#b9a684', leather: '#5b3322'
    },
    sagittarius: {
      skin: '#c8906a', shade: '#8f5840', deep: '#5e3524', glint: 'rgba(255,220,190,.45)', beard: '#2a1a14',
      leather: '#7a4a2c', leatherDeep: '#43271a', leatherLight: '#b47c4c', cloth: '#352f42', clothShade: '#211c2b',
      scale: '#c2cfd5', scaleDeep: '#6b7c86', bronze: '#cf963c', bronzeLight: '#ffd88a', fletch: '#f2ead8'
    }
  };
  const isChampion = kit => !!champ[kit];

  const fine = (points, color, width = .014) => stroke(points, width, color);
  const inked = (points, width, color) => { stroke(points, width + .03, ink); stroke(points, width, color); };

  // A point a fraction t of the way along a polyline.
  function along(points, t) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(...sub(points[i], points[i - 1]));
      lengths.push(l);
      total += l;
    }
    let d = clamp01(t) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (d <= lengths[i] || i === lengths.length - 1) return lerp(points[i], points[i + 1], Math.min(1, d / (lengths[i] || 1)));
      d -= lengths[i];
    }
    return points[points.length - 1];
  }
  const clamp01 = t => Math.min(1, Math.max(0, t));

  // Up along the weapon's own plane, for bows held upright.
  function upOf(aim, side) {
    const u = [aim[1] * side[2] - aim[2] * side[1], aim[2] * side[0] - aim[0] * side[2], aim[0] * side[1] - aim[1] * side[0]];
    const size = Math.hypot(...u) || 1;
    return u.map(v => v / size * (u[2] < 0 ? -1 : 1));
  }

  const championGear = {
    gladius(al, aim, side, look) {
      // A short, broad stabbing blade with a ball pommel and an oval guard.
      taper(al(-.2), al(.05), .075, .07, '#5b3322');
      for (const d of [-.15, -.08, -.01]) fine([al(d, -.035), al(d + .02, .035)], '#2a160e', .012);
      disc(al(-.24), .07, '#d39a3e');
      disc(al(-.25, -.02), .03, '#ffdc8c', false);
      poly([al(.04, -.13), al(.09, -.13), al(.11, 0), al(.09, .13), al(.04, .13), al(.02, 0)], '#d39a3e');
      poly([al(.1, -.085), al(.55, -.08), al(.72, -.06), al(.86, 0), al(.72, .06), al(.55, .08), al(.1, .085)], metal.steel);
      poly([al(.11, 0), al(.86, 0), al(.72, .06), al(.55, .08), al(.11, .085)], metal.iron, false);
      fine([al(.14, 0), al(.66, 0)], metal.dark, .022);
      fine([al(.14, -.06), al(.62, -.058), al(.82, -.01)], metal.edge, .014);
    },
    sica(al, aim, side) {
      // A curved Thracian blade, edge on the inside of the bend.
      taper(al(-.2), al(.06), .07, .065, '#43271a');
      for (const d of [-.14, -.06]) fine([al(d, -.03), al(d + .02, .03)], '#1d100a', .012);
      disc(al(-.23), .05, '#cf963c');
      taper(al(.05, -.1), al(.05, .1), .06, .06, '#cf963c');
      const bend = d => .2 * (d - .1) * (d - .1);
      const back = [], edge = [];
      for (let i = 0; i <= 8; i++) {
        const d = .1 + i * .1, w = .06 * (1 - i / 9);
        back.push(al(d, bend(d) + w));
        edge.unshift(al(d, bend(d) - w));
      }
      poly([...back, al(.98, bend(.98) + .02), ...edge], metal.steel);
      fine(edge.slice().reverse().slice(1), metal.edge, .014);
      fine(back.slice(0, 7).map(v => add(v, side.map(x => x * -.025))), metal.dark, .012);
    },
    pilum(al, aim, side, look) {
      // Wooden shaft, a lead weight, a long iron shank and a small pyramid point.
      taper(al(-.62), al(.86), .06, .055, '#7a432c');
      fine([al(-.6, .012), al(.84, .012)], '#a8693f', .012);
      taper(al(.5), al(.66), .12, .1, metal.dark);
      fine([al(.52), al(.64)], metal.iron, .03);
      taper(al(.84), al(1.32), .035, .03, metal.iron);
      poly([al(1.3, -.05), al(1.5, 0), al(1.3, .05), al(1.27, 0)], metal.steel);
      taper(al(-.36), al(-.24), .085, .085, look.main);
    },
    recurve(al, aim, side, look, charge) {
      // A horn-and-sinew bow held upright in the front hand, drawn back to the cheek.
      const up = upOf(aim, side);
      const grip = al(.42);
      const at = (forward, high) => grip.map((v, i) => v + aim[i] * forward + up[i] * high);
      const nock = al(.34 - charge * .4);
      for (const s of [1, -1]) {
        const limb = [at(0, s * .08), at(-.06, s * .34), at(-.04, s * .6), at(.04, s * .74), at(.11, s * .76)];
        inked(limb, .042, '#4a2a1c');
        fine(limb.slice(0, 4).map(v => add(v, aim.map(x => x * -.012))), '#c98e55', .016);
        disc(limb[4], .025, '#e9dcc0', false);
      }
      fine([at(.03, .73), nock, at(.03, -.73)], '#f6ecd2', .012);
      taper(at(0, -.1), at(0, .1), .085, .085, '#2a160e');
      fine([at(0, -.06), at(0, .06)], look.light, .02);
      if (charge > .02) {
        taper(nock, at(.36, 0), .025, .025, '#d6b27a', false);
        poly([at(.34, -.035), at(.46, 0), at(.34, .035)], metal.steel);
        poly([nock, add(nock, aim.map(x => x * .14)), add(add(nock, aim.map(x => x * .1)), up.map(x => x * .05))], '#c83b3b', false);
        if (charge > .6) shine(at(.4, 0), .25, `rgba(${look.glow},.7)`);
      }
    }
  };

  function scutum(r, spec, look, facing, c) {
    const { j, vector } = r;
    const W = .42, T = .64;
    // Curved like a half cylinder: the middle bulges toward the enemy.
    const pt = (u, v, scale = 1) => add(add(j.handL, vector(.05 + (1 - u * u) * .08, u * W * scale, 0)), [0, 0, v * T * scale]);
    const edge = scale => {
      const points = [];
      for (let i = 0; i <= 8; i++) points.push(pt(-1 + i / 4 * .5 * 1, .97, scale));
      for (let i = 1; i <= 6; i++) points.push(pt(1, .97 - i / 6 * 1.94, scale));
      for (let i = 1; i <= 8; i++) points.push(pt(1 - i / 4 * .5 * 1, -.97, scale));
      for (let i = 1; i < 6; i++) points.push(pt(-1, -.97 + i / 6 * 1.94, scale));
      return points;
    };
    const front = Math.sin(facing) > -.25;
    poly(edge(1.04), c.bronze);
    poly(edge(.93), front ? look.main : '#4c2f2a');
    if (!front) {
      // The inside: planks and the grip bar.
      for (const u of [-.5, 0, .5]) fine([pt(u, .85, .93), pt(u, -.85, .93)], '#2e1b18', .014);
      taper(pt(-.3, 0, .6), pt(.3, 0, .6), .07, .07, c.leather);
    } else {
      // A darker band at top and bottom, the boss, and gilded wings and thunderbolts.
      poly([pt(-.93, .93), pt(.93, .93), pt(.93, .74), pt(-.93, .74)], look.deep, false);
      poly([pt(-.93, -.74), pt(.93, -.74), pt(.93, -.93), pt(-.93, -.93)], look.deep, false);
      fine([pt(-.9, .74), pt(.9, .74)], c.bronzeLight, .016);
      fine([pt(-.9, -.74), pt(.9, -.74)], c.bronzeLight, .016);
      for (const s of [-1, 1]) {
        poly([pt(s * .14, .08), pt(s * .48, .5), pt(s * .78, .58), pt(s * .58, .36), pt(s * .8, .34), pt(s * .52, .16), pt(s * .7, .06), pt(s * .2, -.04)], metal.gold, .012);
        stroke([pt(s * .1, -.14), pt(s * .32, -.34), pt(s * .2, -.4), pt(s * .42, -.66)], .035, metal.gold);
      }
      poly([pt(-.17, .2), pt(.17, .2), pt(.17, -.2), pt(-.17, -.2)], c.bronzeDeep);
      disc(pt(0, 0), .095, c.bronze);
      disc(pt(-.06, .05), .04, c.bronzeLight, false);
      for (const [u, v] of [[-.86, .86], [.86, .86], [-.86, -.86], [.86, -.86]]) disc(pt(u, v), .02, c.bronzeLight, false);
    }
    for (let i = 0; i < spec.cracks; i++) {
      const s = i % 2 ? 1 : -1;
      stroke([pt(s * .1, .1), pt(s * .35, .35 - i * .2), pt(s * .7, i > 1 ? -.6 : .55)], .03, ink);
    }
  }

  function championFigure(spec, facing, r) {
    const look = looks[spec.team];
    const c = champ[spec.kit];
    const varro = spec.kit === 'murmillo';
    const { j, p, P, vector, lean, chestZ, hipZ } = r;
    const front = Math.sin(facing) > -.3;
    const parts = [];
    const part = (at, draw, bias = 0) => parts.push({ depth: at[1] * K + at[2] * .55 + bias, draw });
    // Points on the front of the chest, curving away toward the sides.
    const on = (right, up, out = .27 - Math.abs(right) * .36) =>
      P(lean * (.3 + .46 * Math.min(1, (up - hipZ) / (chestZ - hipZ))) + out, right, up);
    const across = (point, half, tilt = 0) => [add(point, vector(0, -half, tilt)), add(point, vector(0, half, -tilt))];

    // Legs.
    for (const [hip, knee, foot, lead] of [[j.hipL, j.kneeL, j.footL, true], [j.hipR, j.kneeR, j.footR, false]]) {
      part(lerp(hip, foot, .5), () => {
        const ankle = add(foot, [0, 0, .07]);
        const toe = add(foot, add(vector(.21, 0, 0), [0, 0, .02]));
        const calf = lerp(knee, ankle, .35);
        fused([[hip, knee, .26, .155, varro ? c.skin : c.cloth], [knee, calf, .155, .19, varro ? c.skin : c.leather],
          [calf, ankle, .19, .1, varro ? c.skin : c.leather], [ankle, toe, .16, .085, varro ? c.leather : c.leatherDeep]]);
        fine([lerp(hip, knee, .3), lerp(hip, knee, .86)], varro ? c.shade : c.clothShade, .02);
        if (varro && lead) {
          // Ocrea: a tall greave over the leading shin, with a bronze knee guard.
          taper(lerp(knee, ankle, .04), lerp(knee, ankle, .94), .24, .15, metal.steel);
          fine([add(lerp(knee, ankle, .12), vector(0, .04, 0)), add(lerp(knee, ankle, .86), vector(0, .03, 0))], metal.edge, .02);
          for (const t of [.3, .6]) fine(across(lerp(knee, ankle, t), .1), metal.dark, .012);
          disc(add(knee, [0, 0, .03]), .11, c.bronze);
          disc(add(knee, [0, 0, .05]), .045, c.bronzeLight, false);
        } else if (varro) {
          // Fasciae: linen wrapped around the trailing shin.
          taper(lerp(knee, ankle, .1), lerp(knee, ankle, .9), .21, .13, c.linen);
          for (let i = 0; i < 5; i++) fine(across(lerp(knee, ankle, .18 + i * .15), .1, .03), c.linenShade, .014);
        } else {
          // Tall laced boots and a knee pad.
          taper(lerp(knee, ankle, .12), lerp(knee, ankle, .98), .22, .14, c.leatherDeep);
          const lace = [];
          for (let i = 0; i < 6; i++) lace.push(add(lerp(knee, ankle, .18 + i * .14), vector(0, i % 2 ? .07 : -.07, 0)));
          fine(lace, c.leatherLight, .014);
          disc(add(knee, [0, 0, .02]), .09, c.leather);
          fine([add(knee, vector(0, -.06, .03)), add(knee, vector(0, .06, .03))], c.leatherLight, .014);
        }
        // Sandal or boot straps over the foot.
        fine(across(lerp(ankle, toe, .45), .07), varro ? '#2a160e' : c.leatherLight, .014);
        if (varro) fine(across(ankle, .08), '#2a160e', .016);
      });
    }

    // Cassian's long hooded cloak, streaming behind.
    const sway = p.sway;
    if (!varro) {
      const drop = .2 + sway * .55;
      const cl = (forward, right, up) => P(forward, right, Math.max(.04, up));
      const cloak = [
        cl(lean * .8 - .1, -.36, chestZ + .14), cl(lean * .8 - .1, .36, chestZ + .14),
        cl(-.3 - sway * .45, .54, .72 + sway * .25), cl(-.48 - sway * .9, .5, drop - .06), cl(-.42 - sway * .7, .3, drop + .14),
        cl(-.56 - sway * 1.1, .14, drop - .1), cl(-.46 - sway * .8, -.02, drop + .12), cl(-.6 - sway * 1.15, -.18, drop - .12),
        cl(-.42 - sway * .7, -.32, drop + .14), cl(-.5 - sway * .92, -.5, drop - .04), cl(-.3 - sway * .45, -.54, .72 + sway * .25)
      ];
      part(P(-.36, 0, .95), () => {
        poly(cloak, look.main);
        poly([cloak[0], cl(-.3 - sway * .5, -.1, .82 + sway * .2), cloak[5], cloak[6], cloak[7], cloak[8], cloak[9], cloak[10]], look.deep, false);
        for (const k of [2, 4, 6, 8]) fine([lerp(cloak[0], cloak[1], k / 10), cloak[k + 1]], look.deep, .016);
        fine(cloak.slice(2, 11), look.trim, .03);
        fine(cloak.slice(3, 10).map(v => add(v, [0, 0, .06])), metal.gold, .012);
      });
    }

    // The spare weapon and Cassian's quiver ride on the back or hip.
    part(P(-.42, 0, 1.1), () => {
      if (!varro) {
        const top = P(lean * .6 - .3, .2, chestZ + .22), bottom = P(-.3, -.14, hipZ - .02);
        for (let i = 0; i < 5; i++) {
          const base = lerp(top, bottom, .02);
          const tip = add(base, vector(-.12 + i * .04, .1 - i * .06, .26 + (i % 2) * .05));
          taper(base, tip, .025, .02, '#d6b27a', false);
          poly([tip, add(tip, vector(-.03, -.05, -.12)), add(tip, vector(.03, .05, -.1))], i % 2 ? '#c83b3b' : c.fletch, .01);
        }
        taper(top, bottom, .2, .16, c.leather);
        for (const t of [.12, .82]) taper(lerp(top, bottom, t), lerp(top, bottom, t + .06), .21, .2, c.bronze);
        fine([lerp(top, bottom, .2), lerp(top, bottom, .78)], c.leatherLight, .016);
      }
      if (spec.spare === 'pilum') {
        // Two javelins crossed low on the back, points over the shoulders.
        for (const s of [-1, 1]) {
          const grip = P(lean * .5 - .3, -s * .16, hipZ + .1);
          weapon('pilum', grip, vector(-.06, s * .42, .9).map(v => v * .6), vector(0, .9, -.4), look, 0);
        }
      } else if (spec.spare === 'recurve') {
        weapon('recurve', P(lean * .6 - .68, .02, chestZ - .1), vector(.15, -.2, -.3).map(v => v * 1.3), vector(0, .1, 1), look, 0);
      }
    });
    if (spec.spare === 'gladius' || spec.spare === 'sica') {
      // Sheathed at the left hip, hilt forward.
      part(P(.02, -.3, hipZ), () => {
        const mouth = P(lean * .3 + .08, -.3, hipZ + .06);
        const aim = vector(-.75, -.1, -.65);
        const tip = add(mouth, aim.map(v => v * .8));
        taper(mouth, tip, .12, .07, varro ? '#3a2218' : c.leatherDeep);
        taper(lerp(mouth, tip, .9), tip, .09, .07, metal.gold);
        taper(mouth, lerp(mouth, tip, .07), .14, .13, metal.gold);
        weapon(spec.spare, mouth, aim.map(v => -v * .3), vector(0, 1, 0), look, 0);
      }, .02);
    }

    // Hips: the murmillo's bronze belt and loincloth, the archer's leather strips.
    part(j.waist, () => {
      const belt = [P(lean * .32, -.2, hipZ + .12), P(lean * .32, .2, hipZ + .12)];
      if (varro) {
        fused([[P(lean * .3 - .02, -.17, hipZ), P(lean * .3 - .02, .17, hipZ), .3, .3, c.linen]]);
        if (front) {
          poly([P(lean * .3 + .16, -.15, hipZ + .04), P(lean * .3 + .16, .15, hipZ + .04), P(.24 + lean * .15, .07, hipZ - .32 - p.crouch * .2),
            P(.24 + lean * .15, -.07, hipZ - .32 - p.crouch * .2)], look.main);
          fine([P(lean * .3 + .17, -.15, hipZ + .02), P(.25 + lean * .15, -.07, hipZ - .3), P(.25 + lean * .15, .07, hipZ - .3),
            P(lean * .3 + .17, .15, hipZ + .02)], look.trim, .02);
        }
        taper(...belt, .2, .2, c.bronze);
        fine(belt.map(v => add(v, [0, 0, .06])), c.bronzeLight, .014);
        fine(belt.map(v => add(v, [0, 0, -.06])), c.bronzeDeep, .014);
        if (front) for (let i = -2; i <= 2; i++) {
          disc(P(lean * .32 + .2 - Math.abs(i) * .03, i * .075, hipZ + .12), .03, c.bronzeDeep, .01);
          disc(P(lean * .32 + .21 - Math.abs(i) * .03, i * .075 - .008, hipZ + .13), .012, c.bronzeLight, false);
        }
      } else {
        for (let i = -3; i <= 3; i++) {
          const right = i * .08, forward = .18 - Math.abs(i) * .03;
          const swing = -p.stride * right * .5;
          const topAt = P(lean * .3 + forward, right, hipZ + .06);
          const end = P(forward + .04 + swing, right * 1.15, hipZ - .3);
          poly([add(topAt, vector(0, -.035, 0)), add(topAt, vector(0, .035, 0)), add(end, vector(0, .035, 0)), add(end, vector(0, -.035, 0))],
            i % 2 ? c.leather : c.leatherDeep, .012);
          disc(end, .022, c.bronze, false);
        }
        taper(...belt, .14, .14, c.leatherDeep);
        if (front) {
          disc(P(lean * .32 + .2, 0, hipZ + .12), .05, c.bronze);
          disc(P(lean * .32 + .21, -.01, hipZ + .13), .02, c.bronzeLight, false);
        }
      }
    }, .05);

    // Torso.
    part(lerp(j.waist, j.chest, .6), () => {
      const yokeL = P(lean * .76, -.24, chestZ + .07), yokeR = P(lean * .76, .24, chestZ + .07);
      const body = varro ? c.skin : c.leather;
      fused([[P(lean * .3, 0, hipZ), j.waist, .34, .3, varro ? c.skin : c.leatherDeep], [j.waist, j.chest, .3, .58, body],
        [yokeL, yokeR, .34, .34, body], [j.chest, j.neck, .21, .15, c.skin]]);
      if (varro && front) {
        // Bare chest: pectorals, a six-pack, obliques, collarbones and an old scar.
        for (const s of [-1, 1]) {
          poly([on(s * .03, chestZ + .12), on(s * .24, chestZ + .13), on(s * .25, chestZ - .02), on(s * .04, chestZ - .06)], c.glint, false);
          fine([on(s * .26, chestZ - .01), on(s * .14, chestZ - .09), on(s * .02, chestZ - .06)], c.shade, .03);
          fine([on(s * .05, chestZ + .17), on(s * .24, chestZ + .19)], c.shade, .016);
          fine([on(s * .22, chestZ - .1), on(s * .19, hipZ + .26), on(s * .13, hipZ + .16)], c.shade, .02);
          for (let row = 0; row < 3; row++) {
            const z = chestZ - .15 - row * .085;
            fine([on(s * .025, z), on(s * .1, z - .012)], c.shade, .016);
            poly([on(s * .03, z + .07), on(s * .09, z + .065), on(s * .09, z + .015), on(s * .03, z + .015)], c.glint, false);
          }
        }
        fine([on(0, chestZ + .02), on(0, hipZ + .2)], c.shade, .018);
        disc(on(0, hipZ + .2), .014, c.deep, false);
        fine([on(-.2, chestZ + .08), on(-.05, chestZ - .02), on(.08, chestZ - .14)], c.scar, .014);
      } else if (varro) {
        // Spine and shoulder blades.
        fine([P(lean * .76 - .25, 0, chestZ + .12), P(lean * .45 - .22, 0, hipZ + .18)], c.shade, .022);
        for (const s of [-1, 1]) fine([P(lean * .7 - .2, s * .06, chestZ + .06), P(lean * .7 - .22, s * .2, chestZ - .02), P(lean * .6 - .2, s * .16, chestZ - .16)], c.shade, .018);
      } else if (front) {
        // Lorica squamata: rows of overlapping bronze-edged scales, then the quiver baldric.
        for (let row = 0; row < 5; row++) {
          const z = chestZ + .12 - row * .085;
          for (let col = -3; col <= 3; col++) {
            const right = col * .07 + (row % 2) * .035;
            if (Math.abs(right) > .25 - row * .012) continue;
            poly([on(right - .036, z), on(right + .036, z), on(right + .032, z - .06), on(right, z - .088), on(right - .032, z - .06)],
              (row + col) % 3 ? c.scale : c.scaleDeep, .01);
          }
        }
        fine([on(-.26, chestZ - .3), on(0, chestZ - .33), on(.26, chestZ - .3)], c.bronze, .03);
        inked([on(.27, chestZ + .17), on(0, chestZ - .06), on(-.2, hipZ + .16)], .06, c.leatherDeep);
        disc(on(.02, chestZ - .07), .04, c.bronze, .01);
        poly([on(-.1, chestZ + .21), on(.1, chestZ + .21), on(0, chestZ + .12)], c.skin, .01);
      } else {
        fine([P(lean * .76 - .24, 0, chestZ + .12), P(lean * .45 - .2, 0, hipZ + .2)], c.leatherDeep, .025);
        inked([P(lean * .7 - .24, .26, chestZ + .15), P(lean * .5 - .22, -.2, hipZ + .18)], .06, c.leatherDeep);
      }
    }, .06);

    // Arms and shoulders.
    for (const [shoulder, elbow, hand, left] of [[j.shoulderL, j.elbowL, j.handL, true], [j.shoulderR, j.elbowR, j.handR, false]]) {
      part(lerp(shoulder, hand, .55), () => {
        const bicep = lerp(shoulder, elbow, .45), forearm = lerp(elbow, hand, .3);
        const sleeve = varro ? c.skin : look.main;
        fused([[shoulder, bicep, .21, .19, sleeve], [bicep, elbow, .19, .125, c.skin], [elbow, forearm, .125, .16, c.skin], [forearm, hand, .16, .1, c.skin]]);
        fine([lerp(shoulder, elbow, .35), lerp(shoulder, elbow, .8)], c.shade, .018);
        fine([lerp(elbow, hand, .2), lerp(elbow, hand, .55)], c.shade, .014);
        if (varro && !left) {
          // Manica: overlapping steel bands from shoulder to wrist on the sword arm.
          const path = [add(shoulder, [0, 0, .03]), elbow, hand];
          for (let i = 0; i < 8; i++) {
            const t = .03 + i * .115;
            taper(along(path, t), along(path, t + .13), .23 - i * .013, .21 - i * .013, i % 2 ? metal.iron : metal.steel);
            disc(along(path, t + .06), .016, i % 2 ? metal.steel : metal.dark, false);
          }
        } else if (varro) {
          taper(lerp(elbow, hand, .62), lerp(elbow, hand, .86), .17, .14, c.leather);
          fine([lerp(elbow, hand, .68), lerp(elbow, hand, .8)], c.bronze, .02);
        } else {
          // Sleeve hem, a laced bracer on the bow arm, a glove on the draw hand.
          fine(across(bicep, .1), look.trim, .03);
          taper(lerp(elbow, hand, .3), lerp(elbow, hand, .85), .18, .13, c.leatherDeep);
          const lace = [];
          for (let i = 0; i < 5; i++) lace.push(add(lerp(elbow, hand, .35 + i * .11), vector(0, i % 2 ? .05 : -.05, .02)));
          fine(lace, c.leatherLight, .012);
        }
        const knuckle = lerp(hand, add(hand, sub(hand, elbow)), .13);
        fused([[lerp(hand, elbow, .06), knuckle, .14, .12, varro && !left ? '#3a2218' : !varro && !left ? c.leather : c.skin]]);
        fine([hand, knuckle], c.shade, .014);
      }, .07);
      part(shoulder, () => {
        const at = (forward, right, up) => add(shoulder, vector(forward, right * (left ? -1 : 1), up));
        if (varro && !left) {
          // A bronze shoulder plate caps the manica.
          poly(Array.from({ length: 10 }, (_, i) => {
            const a = i / 9 * Math.PI;
            return at(Math.cos(a) * .17 - .01, .08 + Math.sin(a) * .16, .02 + Math.sin(a) * .12 - (1 - Math.sin(a)) * .06);
          }), c.bronze);
          fine([at(.12, .06, .06), at(0, .2, .13), at(-.12, .1, .07)], c.bronzeLight, .016);
          fine([at(.14, .02, -.02), at(0, .14, .02), at(-.14, .04, -.02)], c.bronzeDeep, .014);
        } else if (varro) disc(shoulder, .1, c.skin, false);
        else {
          poly([at(.16, -.06, .05), at(.02, 0, .17), at(-.12, .18, .16), at(-.04, .26, -.04), at(.14, .08, -.08)], c.leather);
          fine([at(.1, 0, .06), at(-.06, .16, .1)], c.leatherLight, .014);
        }
      }, .12);
    }

    part(j.head, () => (varro ? murmilloHead : archerHead)(r, look, c, facing), .16);
    part(lerp(j.handR, add(j.handR, j.aim), .45), () => weapon(spec.weapon, j.handR, j.aim, j.side, look, p.charge), .13);
    if (spec.shield) part(j.handL, () => scutum(r, spec, look, facing, c), .18);

    parts.sort((a, b) => a.depth - b.depth);
    for (const item of parts) item.draw();
  }

  function murmilloHead(r, look, c, facing) {
    const { j, vector, p } = r;
    const at = (forward, right, up) => add(j.head, vector(forward, right, up));
    const front = Math.sin(facing) > -.3 && p.fall < .5;
    // A broad brim that dips at the back into a neck guard.
    poly(Array.from({ length: 20 }, (_, i) => {
      const a = i / 20 * Math.PI * 2;
      return at(Math.cos(a) * .36 - .03, Math.sin(a) * .37, -.05 - Math.max(0, -Math.cos(a)) * .09);
    }), c.bronze);
    fine(Array.from({ length: 11 }, (_, i) => {
      const a = Math.PI / 2 + i / 10 * Math.PI;
      return at(Math.cos(a) * .33 - .03, Math.sin(a) * .34, -.06 - Math.max(0, -Math.cos(a)) * .08);
    }), c.bronzeDeep, .014);
    disc(at(-.03, 0, .07), .24, metal.iron);
    disc(at(-.07, -.06, .14), .13, '#a9bccb', false);
    fine([at(-.02, -.16, .2), at(-.08, -.04, .28), at(-.16, .08, .25)], metal.edge, .02);
    fine([at(.1, -.2, .02), at(.16, 0, .04), at(.1, .2, .02)], metal.dark, .02);
    if (front) {
      // A bronze face plate pierced by a grille, eyes glinting behind it.
      poly([at(.16, -.18, .11), at(.22, 0, .13), at(.16, .18, .11), at(.17, .16, -.12), at(.22, 0, -.18), at(.17, -.16, -.12)], c.bronze);
      poly([at(.2, -.12, .07), at(.23, 0, .08), at(.2, .12, .07), at(.2, .11, -.1), at(.23, 0, -.13), at(.2, -.11, -.1)], '#1a0f12', .01);
      for (const u of [.05, .0, -.05, -.1]) fine([at(.235, -.11, u), at(.24, .11, u)], c.bronze, .014);
      for (const right of [-.06, 0, .06]) fine([at(.24, right, .07), at(.24, right, -.12)], c.bronze, .014);
      for (const side of [-.065, .065]) shine(at(.23, side, .03), .08, `rgba(${look.glow},.85)`);
      fine([at(.17, -.17, .12), at(.22, 0, .14), at(.17, .17, .12)], c.bronzeLight, .016);
    } else {
      fine([at(-.25, -.2, -.02), at(-.3, 0, -.04), at(-.25, .2, -.02)], c.bronzeLight, .016);
    }
    // A tall fin crest running front to back, topped with a horsehair plume.
    const crest = [at(.14, 0, .2), at(.08, 0, .44), at(-.08, 0, .58), at(-.3, 0, .52), at(-.38, 0, .26), at(-.2, 0, .26)];
    poly(crest, c.bronze);
    fine([at(.1, 0, .34), at(-.06, 0, .5), at(-.26, 0, .46)], c.bronzeLight, .018);
    const ridge = [at(.06, 0, .46), at(-.08, 0, .6), at(-.3, 0, .54)];
    const strands = [];
    for (let k = 0; k < 9; k++) {
      const base = along(ridge, k / 8);
      strands.push([base, add(base, vector(-.1 - p.sway * .22 - k * .01, k % 2 ? .035 : -.035, .1 - k * .016))]);
    }
    for (const strand of strands) stroke(strand, .085, ink);
    strands.forEach((strand, k) => stroke(strand, .052, k % 3 ? look.main : look.light));
  }

  function archerHead(r, look, c, facing) {
    const { j, vector, p } = r;
    const at = (forward, right, up) => add(j.head, vector(forward, right, up));
    const front = Math.sin(facing) > -.3 && p.fall < .5;
    // The hood, its point trailing behind.
    poly([at(-.14, -.08, .22), at(-.4 - p.sway * .25, 0, .08), at(-.14, .08, .22)], look.deep);
    poly([at(.02, -.28, -.18), at(-.04, -.28, .14), at(-.1, 0, .33), at(-.04, .28, .14), at(.02, .28, -.18), at(-.18, 0, -.26)], look.main);
    disc(at(-.03, 0, .04), .24, look.main);
    fine([at(-.08, -.16, .2), at(-.1, 0, .27), at(-.08, .16, .2)], look.light, .02);
    if (front) {
      // A bearded face in the shadow of the hood.
      disc(at(.1, 0, -.01), .17, c.skin);
      poly([at(.14, -.17, .07), at(.13, 0, .17), at(.14, .17, .07), at(.21, 0, .08)], 'rgba(18,8,26,.55)', false);
      poly([at(.15, -.14, -.03), at(.22, 0, -.06), at(.15, .14, -.03), at(.14, .11, -.15), at(.21, 0, -.23), at(.14, -.11, -.15)], c.beard, .01);
      fine([at(.22, -.06, -.06), at(.235, 0, -.075), at(.22, .06, -.06)], c.beard, .03);
      fine([at(.215, -.03, -.11), at(.215, .03, -.11)], c.deep, .012);
      fine([at(.21, 0, .03), at(.23, 0, -.04)], c.shade, .02);
      for (const side of [-1, 1]) {
        fine([at(.2, side * .13, .07), at(.22, side * .04, .055)], c.beard, .022);
        shine(at(.205, side * .075, .02), .08, `rgba(${look.glow},.8)`);
        taper(at(.21, side * .1, .025), at(.215, side * .05, .02), .036, .028, look.eye, false);
      }
      fine([at(.15, -.2, -.13), at(.14, -.18, .12), at(.12, 0, .2), at(.14, .18, .12), at(.15, .2, -.13)], metal.gold, .028);
      disc(at(.12, 0, -.24), .04, c.bronze, .01);
    } else {
      fine([at(-.12, 0, .42), at(-.27, 0, .08), at(-.24, 0, -.2)], look.deep, .03);
      fine([at(-.18, -.26, -.15), at(-.24, 0, -.24), at(-.18, .26, -.15)], metal.gold, .028);
    }
  }

  // ---- Baking ----

  function bounds(spec, r) {
    const { j } = r;
    const points = [j.footL, j.footR, j.head, j.handL, j.handR, j.shoulderL, j.shoulderR, j.waist,
      add(j.handR, j.aim.map(v => v * weaponLength[spec.weapon])), add(j.handR, j.aim.map(v => v * -.9)),
      r.P(-.55 - r.p.sway * 1.15, 0, .1), r.P(-.5 - r.p.sway, .5, .1), r.P(-.5 - r.p.sway, -.5, .1),
      r.P(.45, .55, .05), r.P(.45, -.55, .05), r.P(-.4, .55, 1.5), r.P(-.4, -.55, 1.5), add(r.j.head, [0, 0, .75])];
    let left = 0, right = 0, top = 0, bottom = 0;
    for (const v of points) {
      const x = v[0], y = v[1] * K - v[2] * Z;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const pad = .72;
    return { left: left - pad, right: right + pad, top: top - pad, bottom: bottom + pad };
  }

  function fit(canvas, context, w, h) {
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    else context.clearRect(0, 0, w, h);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
  }

  // The part of the silhouette that sticks out when it is shifted: a crescent along one side.
  function crescent(w, h, dx, dy, color) {
    fit(mask, m, w, h);
    m.drawImage(work, 0, 0);
    m.globalCompositeOperation = 'destination-out';
    m.drawImage(work, dx, dy);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = color;
    m.fillRect(0, 0, w, h);
  }

  function bake(spec, direction, anim, shape, t) {
    const start = performance.now();
    const facing = direction / DIRECTIONS * Math.PI * 2;
    const r = rig(spec, facing, anim, shape, t);
    const box = bounds(spec, r);
    const w = Math.ceil((box.right - box.left) * res), h = Math.ceil((box.bottom - box.top) * res);
    ox = -box.left * res;
    oy = -box.top * res;
    fit(work, g, w, h);
    lights = [];
    const fineInk = isChampion(spec.kit);
    lw = fineInk ? .02 : .028;
    fw = fineInk ? .046 : .06;
    (fineInk ? championFigure : figure)(spec, facing, r);

    // Heavy shadow on the side away from the key light, then a hot rim on the lit side.
    const look = looks[spec.team];
    const d = Math.max(2, Math.round(res * .085));
    g.globalCompositeOperation = 'source-atop';
    crescent(w, h, -d, -d, 'rgba(18,4,38,.55)');
    g.drawImage(mask, 0, 0);
    const down = g.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, 'rgba(255,240,210,.10)');
    down.addColorStop(.5, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(10,30,60,.45)');
    g.fillStyle = down;
    g.fillRect(0, 0, w, h);
    const rim = Math.max(1.5, res * .034);
    crescent(w, h, rim, rim, look.rim);
    g.drawImage(mask, 0, 0);
    if (spec.frozen) {
      g.fillStyle = 'rgba(165,225,255,.62)';
      g.fillRect(0, 0, w, h);
      crescent(w, h, rim * 2, rim * 2, '#ffffff');
      g.drawImage(mask, 0, 0);
    }
    g.globalCompositeOperation = 'source-over';

    // Ink outline: the silhouette stamped around itself, under the painting.
    fit(solid, s, w, h);
    s.drawImage(work, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = ink;
    s.fillRect(0, 0, w, h);
    const image = makeCanvas();
    image.width = w;
    image.height = h;
    const out = image.getContext('2d');
    const thick = Math.max(1.6, res * (fineInk ? .03 : .036));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      out.drawImage(solid, Math.cos(a) * thick, Math.sin(a) * thick);
    }
    out.drawImage(work, 0, 0);
    addLights(out);
    baked++;
    bakeTime += performance.now() - start;
    return { image, x: box.left, y: box.top, w: w / res, h: h / res };
  }

  // spec: { team, kit, armor, weapon, spare, shield, cracks, frozen }
  function get(spec, facing, anim, shape, progress) {
    const direction = ((Math.round(facing / (Math.PI * 2) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
    const count = frames[anim];
    const looping = anim === 'idle' || anim === 'run' || anim === 'stun';
    const frame = looping ? Math.floor(((progress % 1) + 1) % 1 * count) % count
      : Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
    const t = looping ? frame / count : count > 1 ? frame / (count - 1) : 0;
    const key = [spec.team, spec.kit, spec.armor, spec.weapon, spec.spare, spec.shield || '-', spec.cracks, spec.frozen ? 1 : 0,
      direction, anim, shape || '-', frame].join('|');
    let sprite = cache.get(key);
    if (sprite) {
      // Re-insert so the least recently used frame is always first.
      cache.delete(key);
    } else {
      sprite = bake(spec, direction, anim, shape, t);
      if (cache.size >= LIMIT) cache.delete(cache.keys().next().value);
    }
    cache.set(key, sprite);
    return sprite;
  }

  function setResolution(pixelsPerUnit) {
    const next = Math.max(40, Math.min(100, Math.round(pixelsPerUnit)));
    if (next === res) return;
    res = next;
    cache.clear();
  }

  const stats = () => ({ cached: cache.size, baked, averageMs: baked ? bakeTime / baked : 0 });

  root.HadesSprites = { get, setResolution, stats, looks, frames, DIRECTIONS };
})(this);
