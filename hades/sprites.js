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
    if (['maul', 'greatsword', 'mace', 'axe'].includes(weapon)) { p.yaw = .5; p.pitch = .7; p.high = 1.05; }
    if (weapon === 'staff') { p.yaw = .75; p.pitch = 1.38; }
    if (weapon === 'crossbow' || weapon === 'bow') { p.yaw = .16; p.pitch = 0; p.out = .32; p.high = 1.14; }
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
        if (weapon === 'staff') {
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
    const twoHanded = ['maul', 'greatsword', 'spear', 'crossbow', 'bow'].includes(spec.weapon);
    j.handL = spec.shield ? P(shift + .4 + (shape === 'bash' ? p.lunge : 0) + lean * .4, -.3, 1.04 - p.crouch + p.bob)
      : twoHanded && anim !== 'dead' ? add(j.handR, j.aim.map(v => v * (spec.weapon === 'crossbow' || spec.weapon === 'bow' ? .42 : .26)))
        : P(shift + .12 - st * .3, -.52, .9 + p.bob + (anim === 'run' ? .1 : 0));
    j.elbowL = add(lerp(j.shoulderL, j.handL, .5), vector(-.14, -.2, -.1));
    j.elbowR = add(lerp(j.shoulderR, j.handR, .5), vector(-.14, .2, -.1));
    return { j, p, P, vector, lean: shift + lean, chestZ, hipZ };
  }

  // ---- Painting ----

  let ox = 0, oy = 0;
  const px = v => (v[0]) * res + ox;
  const py = v => (v[1] * K - v[2] * Z) * res + oy;

  function poly(points, color, line = true) {
    g.beginPath();
    points.forEach((v, i) => g[i ? 'lineTo' : 'moveTo'](px(v), py(v)));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * .028;
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
    g.lineWidth = res * .028;
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
    g.lineWidth = res * .06;
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
    g.lineWidth = res * .028;
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

  const weaponLength = { sword: 1.2, greatsword: 1.75, spear: 1.85, axe: 1.15, mace: 1.05, maul: 1.4, staff: 1.15, crossbow: .85, bow: .85 };

  // along(d, w): d from the hand toward the point, w across.
  function weapon(kind, hand, aim, side, look, charge) {
    const al = (d, w = 0) => hand.map((v, i) => v + aim[i] * d + side[i] * w);
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
      // A gilded laurel.
      stroke([at(.13, -.2, .1), at(.21, 0, .12), at(.13, .2, .1)], .035, metal.gold);
      for (const side of [-.2, .2]) for (let i = 0; i < 3; i++) {
        poly([at(.08 - i * .09, side, .12 + i * .02), at(.02 - i * .09, side * 1.25, .22 + i * .02), at(-.02 - i * .09, side, .12 + i * .02)], metal.gold, false);
      }
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

    part(j.head, () => head(r, spec, look, facing), .16);
    part(lerp(j.handR, add(j.handR, j.aim), .45), () => weapon(spec.weapon, j.handR, j.aim, j.side, look, p.charge), .13);
    if (spec.shield) part(j.handL, () => shield(r, spec, look, facing), .18);

    parts.sort((a, b) => a.depth - b.depth);
    for (const item of parts) item.draw();
    return capeShape;
  }

  // ---- Baking ----

  function bounds(spec, r) {
    const { j } = r;
    const points = [j.footL, j.footR, j.head, j.handL, j.handR, j.shoulderL, j.shoulderR, j.waist,
      add(j.handR, j.aim.map(v => v * weaponLength[spec.weapon])), add(j.handR, j.aim.map(v => v * -.9)),
      r.P(-.55 - r.p.sway * 1.15, 0, .1), r.P(-.5 - r.p.sway, .5, .1), r.P(-.5 - r.p.sway, -.5, .1),
      r.P(.45, .55, .05), r.P(.45, -.55, .05), r.P(-.4, .55, 1.5), r.P(-.4, -.55, 1.5)];
    let left = 0, right = 0, top = 0, bottom = 0;
    for (const v of points) {
      const x = v[0], y = v[1] * K - v[2] * Z;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const pad = .52;
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
    figure(spec, facing, r);

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
    const thick = Math.max(1.6, res * .036);
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

  // spec: { team, armor, weapon, spare, shield, cracks, frozen }
  function get(spec, facing, anim, shape, progress) {
    const direction = ((Math.round(facing / (Math.PI * 2) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
    const count = frames[anim];
    const looping = anim === 'idle' || anim === 'run' || anim === 'stun';
    const frame = looping ? Math.floor(((progress % 1) + 1) % 1 * count) % count
      : Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
    const t = looping ? frame / count : count > 1 ? frame / (count - 1) : 0;
    const key = [spec.team, spec.armor, spec.weapon, spec.spare, spec.shield || '-', spec.cracks, spec.frozen ? 1 : 0,
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
