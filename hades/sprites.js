// Sprite baking, the way Hades does it: each pose is built once from a rig, painted with flat color,
// heavy shadow shapes, rim light and an ink outline, and kept as a 2D image. In a bout a fighter is
// a single drawImage. Frames are baked the first time they are needed and the least recent are dropped.
(function (root) {
  const { weapons, shields } = root.HadesData;

  const K = .64;          // floor depth foreshortening, matching the camera
  const Z = .80;          // apparent height of one unit
  const SIZE = 1.38;      // fighters are painted a little larger than their collision circle
  const DIRECTIONS = 16;
  const LIMIT = 1400;     // cached frames
  // Champions get extra in-between frames for smoother motion.
  const extraFrames = { idle: 2, run: 2, windup: 2, active: 2, recover: 2, stun: 2, dead: 2, dash: 1 };
  const frames = { idle: 4, run: 8, dash: 2, windup: 4, active: 3, recover: 3, hurt: 1, stun: 6, dead: 6 };
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
  const m = mask.getContext('2d'), s = solid.getContext('2d');
  const paint = work.getContext('2d');
  let g = paint;
  // Thin gear (the bow) is drawn a second time, as a bare silhouette, into a mask that keeps the
  // shadow crescent off it and softens the rim there, so its own light and dark faces survive.
  const keep = makeCanvas(), kp = keep.getContext('2d');
  let keptAny = false, masking = false;
  function kept(draw) {
    draw();
    if (!keptAny) {
      // The mask only grows, so most bakes neither resize nor clear it.
      const w = work.width, h = work.height;
      if (keep.width < w || keep.height < h) { keep.width = Math.max(keep.width, w); keep.height = Math.max(keep.height, h); }
      else kp.clearRect(0, 0, w, h);
    }
    const queued = lights.length;
    g = kp;
    masking = true;
    draw();
    masking = false;
    g = paint;
    lights.length = queued;
    keptAny = true;
  }

  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

  // ---- Poses ----

  // Weapon and body parameters for one frame. yaw turns around the body (positive to the right),
  // pitch lifts the weapon, out is the hand's distance in front.
  function posture(weapon, anim, shape, t, fine = false) {
    const p = { yaw: .62, pitch: .42, out: .28, high: 1.0, lunge: 0, charge: 0, lean: .06, crouch: 0, stride: 0, bob: 0, sway: .06, fall: 0, kneel: 0, loll: 0, droop: 0, chamber: 0, kick: 0, breath: 0, swing: 0 };
    if (weapon === 'spear') { p.yaw = .3; p.pitch = .16; }
    if (weapon === 'pilum') { p.yaw = .38; p.pitch = .22; p.high = 1.08; }
    if (['maul', 'greatsword', 'mace', 'axe'].includes(weapon)) { p.yaw = .5; p.pitch = .7; p.high = 1.05; }
    if (weapon === 'staff') { p.yaw = .75; p.pitch = 1.38; }
    if (weapon === 'crossbow' || weapon === 'bow' || weapon === 'recurve') { p.yaw = .16; p.pitch = 0; p.out = .32; p.high = 1.14; }
    const wave = Math.sin(t * Math.PI * 2);
    if (anim === 'idle') {
      p.bob = wave * .025; p.sway = .06 + wave * .04; p.crouch = .04;
      // Breathing: the chest and shoulders rise, the guard drifts a little.
      if (fine) { p.breath = wave; p.pitch += wave * .05; p.yaw += Math.cos(t * Math.PI * 2) * .04; p.crouch = .06 - wave * .015; }
    }
    else if (anim === 'run') {
      p.stride = wave; p.bob = Math.abs(Math.cos(t * Math.PI * 2)) * .09; p.lean = .24; p.sway = .42 + Math.sin(t * Math.PI * 4) * .1;
      if (fine) p.swing = wave;
      p.pitch = Math.min(p.pitch, .5); p.yaw += wave * .12;
    } else if (anim === 'dash') { p.lean = .55; p.crouch = .22; p.stride = 1 - t * .5; p.sway = .9; p.yaw = 1.3; p.pitch = .1; }
    else if (anim === 'hurt') { p.lean = -.28; p.crouch = .08; p.yaw += .5; p.sway = .3; }
    else if (anim === 'stun') {
      // Stance broken: buckled onto the back knee, weapon arm hanging so the blade drags, guard
      // sagging, head lolling, the body reeling around in a slow circle as it fights for balance.
      const reel = Math.cos(t * Math.PI * 2);
      p.lean = .2 + wave * .16; p.crouch = .26 + reel * .04; p.kneel = .75 + wave * .15; p.loll = reel;
      p.pitch = -1.05; p.yaw = .9 + reel * .12; p.out = .06; p.high = .58; p.droop = 1; p.sway = .16 + wave * .08; p.bob = -.02;
    }
    else if (anim === 'dead') { p.fall = ease(t); p.pitch = mix(p.pitch, -.2, t); p.yaw += t; p.sway = .2; }
    else {
      // Champions coil deeper, snap through faster and settle back with a small overshoot.
      const settle = fine ? u => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2 : ease;
      const key = (rest, coil, follow) => anim === 'windup' ? mix(rest, coil, ease(t))
        : anim === 'active' ? mix(coil, follow, ease(Math.min(1, t * (fine ? 1.6 : 1.3)))) : mix(follow, rest, settle(t));
      p.crouch = key(.04, fine ? .17 : .12, .16);
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
      } else if (shape === 'kick') {
        // Knee chambers up, the heel drives out, the body leans back over the standing leg.
        p.chamber = anim === 'windup' ? ease(t) : anim === 'active' ? 1 - ease(t) * .6 : .4 * (1 - ease(t));
        p.kick = anim === 'active' ? ease(Math.min(1, t * 1.4)) : anim === 'recover' ? 1 - ease(t) : 0;
        p.lean = key(.06, -.1, -.26); p.lunge = key(0, -.06, .18); p.out = key(p.out, .16, .1); p.high = key(p.high, 1.12, 1.18);
        p.yaw = key(p.yaw, .9, 1.1); p.sway = key(.06, .12, .3); p.crouch = key(.04, .02, 0);
      } else if (shape === 'bash') {
        p.lunge = key(0, -.2, .55); p.lean = key(.06, -.14, .4);
      } else {
        // A negative charge tells the bow the arrow has just been loosed.
        p.charge = anim === 'windup' ? t : weapon === 'recurve' && anim === 'active' ? -.01 : 0;
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
  // Two-bone limb: places the middle joint so both bones keep their length, bending toward the
  // hint the pose gives for that joint.
  function bend(a, b, hint, l1, l2) {
    const span = sub(b, a);
    const full = Math.hypot(...span) || 1;
    const dir = span.map(v => v / full);
    const d = Math.min(full, (l1 + l2) * .999);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let pole = sub(hint, lerp(a, b, .5));
    const along = pole.reduce((sum, v, i) => sum + v * dir[i], 0);
    pole = pole.map((v, i) => v - dir[i] * along);
    const size = Math.hypot(...pole) || 1;
    return a.map((v, i) => v + dir[i] * x + pole[i] / size * h);
  }

  function rig(spec, facing, anim, shape, t) {
    const fine = isChampion(spec.kit);
    const p = posture(spec.weapon, anim, shape, t, fine);
    // Champions stand on longer legs with a longer torso: human proportions, not a squat doll.
    const tall = fine ? .18 : 0, chestUp = fine ? .08 : 0;
    if (fine) p.high += .1;
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
    const hipZ = .78 + tall - p.crouch + p.bob * .6, chestZ = 1.36 + chestUp - p.crouch * 1.2 + p.bob + p.breath * .018;
    const lean = p.lean + p.lunge * .4;
    const shift = p.lunge * .22;
    const st = p.stride;
    const j = {
      hipL: P(shift, -.15, hipZ), hipR: P(shift, .15, hipZ),
      footL: P(.12 + st * .52 + p.lunge * .5 + p.chamber * .12 + p.kick * .8, -.2, Math.max(0, st) * .2 + p.chamber * .4 + p.kick * .32),
      footR: P(-.16 - st * .52 - p.lunge * .2 - p.kneel * .34, .24, Math.max(0, -st) * .2),
      kneeL: P(.2 + st * .28 + p.crouch * .5 + p.chamber * .3 + p.kick * .4, -.22, hipZ * .52 + Math.max(0, st) * .1 + p.chamber * .42 + p.kick * .16),
      kneeR: P(.04 - st * .22 + p.crouch * .4 - p.kneel * .1, .24, hipZ * .52 + Math.max(0, -st) * .1 - p.kneel * .36),
      waist: P(shift + lean * .3, 0, hipZ + .1),
      chest: P(shift + lean * .72, 0, chestZ),
      neck: P(shift + lean * .9, 0, chestZ + .2),
      head: P(shift + lean * 1.02 + .06 + p.kneel * .05, p.loll * .09, chestZ + .42 - p.kneel * .05 - Math.abs(p.loll) * .03),
      // Shoulders counter-rotate against the stride.
      shoulderL: P(shift + lean * .76 - p.swing * .06, fine ? -.34 : -.36, chestZ + .1 + p.breath * .012), shoulderR: P(shift + lean * .76 + p.swing * .06, fine ? .34 : .36, chestZ + .1 + p.breath * .012)
    };
    const reach = .22 + p.out + p.lunge * .4;
    const handZ = p.high - p.crouch + p.bob;
    j.handR = P(shift + Math.cos(p.yaw) * reach - p.swing * .14, Math.sin(p.yaw) * reach + .08, handZ + Math.abs(p.swing) * .03);
    j.aim = vector(Math.cos(p.yaw) * Math.cos(p.pitch), Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch));
    j.side = vector(-Math.sin(p.yaw), Math.cos(p.yaw), 0);
    const twoHanded = ['maul', 'greatsword', 'spear', 'crossbow', 'bow', 'recurve'].includes(spec.weapon);
    j.handL = spec.shield ? P(shift + .4 - p.droop * .14 + (shape === 'bash' ? p.lunge : 0) + lean * .4, -.3 - p.droop * .08, 1.04 + chestUp - p.crouch + p.bob - p.droop * .3)
      : twoHanded && anim !== 'dead' ? add(j.handR, j.aim.map(v => v * (spec.weapon === 'recurve' ? BRACE : ['crossbow', 'bow'].includes(spec.weapon) ? .42 : .26)))
        : P(shift + .12 - st * .3 + p.swing * .1, fine ? -.42 : -.48, .9 + tall * .6 + p.bob + (anim === 'run' ? .1 : 0));
    // Champions keep their elbows in and down, close to the ribs, instead of flaring them out.
    j.elbowL = add(lerp(j.shoulderL, j.handL, .5), fine ? vector(-.12, -.09, -.22) : vector(-.14, -.2, -.1));
    j.elbowR = add(lerp(j.shoulderR, j.handR, .5), fine ? vector(-.12, .09, -.22) : vector(-.14, .2, -.1));
    let drawHint = null;
    if (fine && spec.weapon === 'recurve' && !['dead', 'stun', 'dash', 'hurt'].includes(anim)) {
      // At rest the archer holds the bow low in front, arrow nocked and string hand on it. A shot
      // raises the bow to the target in the first part of the windup, turns the shoulders side-on
      // and draws the string back to the cheek. On the release the string hand flies back past the
      // ear; in the first half of the recovery it comes back to the string, then a fresh arrow is
      // nocked as the bow settles low again.
      const running = anim === 'run', shooting = shape === 'bolt';
      const raise = !shooting ? 0 : anim === 'windup' ? ease(Math.min(1, t / .45)) : anim === 'active' ? 1 : 1 - ease(t);
      const twist = running ? .55 : mix(.7, 1.05, raise), sideways = Math.sin(twist) * .34, across = Math.cos(twist) * .34;
      const shoulderZ = chestZ + .1;
      j.shoulderL = P(shift + lean * .76 + sideways, -across, shoulderZ);
      j.shoulderR = P(shift + lean * .76 - sideways, across, shoulderZ);
      const low = running ? -.75 + p.swing * .05 : -.62 + p.breath * .03;
      const pitch = mix(low, p.pitch * .3, raise);
      j.aim = vector(Math.cos(pitch), 0, Math.sin(pitch));
      j.side = vector(0, 1, 0);
      let draw = BRACE;
      if (shooting && anim === 'windup') draw = mix(BRACE, .32 + p.charge * (FULL_DRAW - .32), raise);
      else if (shooting && anim === 'active') draw = FULL_DRAW + .14 * ease(Math.min(1, t * 2.5));
      else if (shooting && anim === 'recover' && t < .5) { draw = mix(FULL_DRAW + .14, BRACE, ease(t / .5)); p.charge = -.01; }
      p.draw = draw;
      // Aimed, the arrow runs from the cheek to the bow hand, so full draw brings the string to the jaw.
      const cheek = P(shift + lean * 1.02 + .13, .07, chestZ + .3);
      j.handL = lerp(add(j.shoulderL, j.aim.map(v => v * .5)), add(cheek, j.aim.map(v => v * FULL_DRAW)), raise);
      j.handR = add(j.handL, j.aim.map(v => -v * draw));
      j.elbowL = add(lerp(j.shoulderL, j.handL, .5), vector(-.05, -.14, -.06));
      drawHint = add(lerp(j.shoulderR, j.handR, .5), raise > .3 ? vector(-.25, .3, .06) : vector(-.05, .25, -.12));
    }
    if (fine && spec.weapon === 'pilum' && ['idle', 'run', 'windup', 'active', 'recover'].includes(anim)) {
      // An overhand javelin throw. Carried level at the shoulder, cocked high behind the head with
      // the shoulders turned back, then whipped forward over the shoulder. The javelin leaves the
      // hand on the throw and the next one is drawn during the recovery.
      const throwing = shape === 'bolt';
      const cock = throwing && anim === 'windup' ? ease(t) : throwing && anim === 'active' ? 1 - ease(Math.min(1, t * 1.4)) : 0;
      const whip = throwing && anim === 'active' ? ease(Math.min(1, t * 1.4)) : throwing && anim === 'recover' ? 1 - ease(t) : 0;
      const twist = -.55 * cock + .5 * whip;
      const shoulderZ = chestZ + .1;
      j.shoulderR = P(shift + lean * .76 + Math.sin(twist) * .34, Math.cos(twist) * .34, shoulderZ);
      j.shoulderL = P(shift + lean * .76 - Math.sin(twist) * .34, -Math.cos(twist) * .34, shoulderZ);
      const carry = [.1, .34, chestZ + .16], cocked = [-.36, .32, chestZ + .48], thrown = [.62, .16, chestZ + .02];
      const at = carry.map((v, i) => mix(mix(v, cocked[i], cock), thrown[i], whip));
      j.handR = P(shift + lean * .6 + at[0], at[1], at[2] + p.bob * .5 + (anim === 'run' ? Math.abs(p.swing) * .03 : 0));
      const pitch = .06 + cock * .24 - whip * .2;
      j.aim = vector(Math.cos(pitch), 0, Math.sin(pitch));
      j.side = vector(0, 1, 0);
      j.elbowR = add(lerp(j.shoulderR, j.handR, .5), vector(-.12, .28, cock * .12 - .06));
      p.thrown = throwing && (anim === 'active' || anim === 'recover' && t < .55);
    }
    if (fine) {
      if (drawHint) j.elbowR = drawHint;
      j.elbowL = bend(j.shoulderL, j.handL, j.elbowL, .37 * SIZE, .35 * SIZE);
      j.elbowR = bend(j.shoulderR, j.handR, j.elbowR, .37 * SIZE, .35 * SIZE);
      j.kneeL = bend(j.hipL, add(j.footL, [0, 0, .09]), add(j.kneeL, vector(.12, 0, 0)), .5 * SIZE, .47 * SIZE);
      j.kneeR = bend(j.hipR, add(j.footR, [0, 0, .09]), add(j.kneeR, vector(.12, 0, 0)), .5 * SIZE, .47 * SIZE);
    }
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

  // fresh = false adds the shape to the current path, for building a clip from several shapes.
  function taperPath(a, b, wa, wb, fresh = true) {
    const ax = px(a), ay = py(a), bx = px(b), by = py(b);
    const angle = Math.atan2(by - ay, bx - ax);
    if (fresh) g.beginPath();
    else g.moveTo(ax + Math.cos(angle + Math.PI / 2) * wa * res / 2, ay + Math.sin(angle + Math.PI / 2) * wa * res / 2);
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

  const weaponLength = { gladius: .95, pilum: 1.25, recurve: .9, sica: .95, sword: 1.2, greatsword: 1.75, spear: 1.85, axe: 1.15, mace: 1.05, maul: 1.4, staff: 1.15, crossbow: .85, bow: .85 };

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
  // Short blades ride sheathed at the hip; other spares go on the back.
  const stowedAtHip = ['gladius', 'sica'];

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

  // The bow's own frame: A along the shot, U along the limbs, L across them. The bow is rolled
  // around the arrow so its plane turns toward the high camera: canted when the shot runs toward
  // or away from the camera, leaning back a little when it crosses the screen, and never edge-on.
  // Lengths in bow units (the aim vector's length): brace height, full draw to the cheek, arrow.
  const CANT = .75, BRACE = .2, FULL_DRAW = .7, ARROW = .82;
  const CAM = [0, Z / Math.hypot(Z, K), K / Math.hypot(Z, K)];   // toward the camera
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function bowAxes(aim, side, cant = CANT) {
    const s = Math.hypot(...aim) || 1;
    const A = aim.map(v => v / s);
    const up = upOf(aim, side);
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // Limbs at right angles to both the arrow and the line of sight show the bow's full face.
    let face = cross(A, CAM);
    const size = Math.hypot(...face);
    let U = up;
    if (cant && size > 1e-3) {
      face = face.map(v => v / size);
      // Keep the top limb up; if that's a tie, cant it toward the drawing hand.
      if (d(face, up) + .3 * d(face, side) / (Math.hypot(...side) || 1) < 0) face = face.map(v => -v);
      const k = cant * Math.min(1, size / .35);
      U = up.map((v, i) => v + face[i] * k);
      const l = Math.hypot(...U);
      U = U.map(v => v / l);
    }
    return { A, s, U, L: cross(A, U) };
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
      // Wooden shaft, a lead weight, a long iron shank and a small pyramid point, a little taller
      // than the man who throws it.
      taper(al(-.5), al(.7), .058, .052, '#7a432c');
      fine([al(-.48, .012), al(.68, .012)], '#a8693f', .012);
      taper(al(.4), al(.53), .115, .095, metal.dark);
      fine([al(.42), al(.51)], metal.iron, .03);
      taper(al(.68), al(1.08), .034, .028, metal.iron);
      fine([al(.7, .008), al(1.04, .006)], metal.edge, .008);
      poly([al(1.06, -.05), al(1.24, 0), al(1.06, .05), al(1.03, 0)], metal.steel);
      taper(al(-.1), al(.06), .075, .075, look.main);
      fine([al(-.08), al(.04)], look.light, .02);
    },
    recurve(al, aim, side, look, charge) {
      // A horn-and-sinew composite recurve, designed as a side profile first: a thick wrapped grip,
      // working limbs that sweep back toward the archer to the string bridges, and stiff bone ears
      // that flick forward again. The profile is mapped onto the bow plane, canted, and each limb is
      // drawn as a solid strip with faces: dark sinew back, pale horn belly, laminated sides.
      // The string hand is at the nock (this weapon's hand) and the grip is `draw` ahead of it.
      const state = typeof charge === 'object' ? charge : { draw: BRACE, charge };
      const loosed = state.charge < 0 || state.stowed;
      const { A, U, L, s } = bowAxes(aim, side, state.stowed ? 0 : CANT);
      const draw = state.draw, brace = BRACE * s;
      const f = loosed ? 0 : clamp01((draw - BRACE) / (FULL_DRAW - BRACE));
      const grip = al(draw);
      const at = (x, y) => grip.map((v, i) => v + A[i] * x + U[i] * y);
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const scaled = (v, k) => v.map(x => x * k);
      const toward = (a, ...terms) => terms.reduce((p, [v, k]) => p.map((x, i) => x + v[i] * k), a);
      const minPx = (w, px) => Math.max(w, px / res);

      // Side profile of the upper limb in world units: x toward the target, y along the limb axis.
      const gh = .1, ear = .25;
      const bridge = [mix(.03 - brace, -.1 - brace, f), mix(.66, .55, f)];
      const back = mix(.72, 1.1, f), flick = mix(.5, .06, f);
      const T3 = [-Math.sin(back), Math.cos(back)], E = [Math.sin(flick), Math.cos(flick)];
      const P1 = [0, gh + (bridge[1] - gh) * .38], P2 = [bridge[0] - T3[0] * .16, bridge[1] - T3[1] * .16];
      const bez = (u, a, b, c, d) => [0, 1].map(k => (1 - u) ** 3 * a[k] + 3 * (1 - u) ** 2 * u * b[k] + 3 * (1 - u) * u * u * c[k] + u ** 3 * d[k]);
      const profile = [{ p: [0, 0], t: .11, w: .078, kind: 'grip' }, { p: [0, gh], t: .11, w: .078, kind: 'grip' }];
      for (let i = 1; i <= 8; i++) {
        const u = i / 8;
        profile.push({ p: bez(u, [0, gh], P1, P2, bridge), t: mix(.086, .05, u), w: mix(.076, .048, u), kind: 'limb' });
      }
      const knee = [bridge[0] + T3[0] * .045, bridge[1] + T3[1] * .045];
      const end = [knee[0] + E[0] * (ear - .045), knee[1] + E[1] * (ear - .045)];
      for (let i = 1; i <= 4; i++) {
        const u = i / 4;
        const q = [0, 1].map(k => (1 - u) ** 2 * bridge[k] + 2 * (1 - u) * u * knee[k] + u * u * end[k]);
        profile.push({ p: q, t: mix(.054, .044, u), w: mix(.044, .036, u), kind: 'ear' });
      }
      const n = profile.length - 1, bridgeAt = n - 4;

      const colors = {
        grip: { back: '#3f2417', belly: '#3f2417', side: '#2e1a10', sideBack: '#2e1a10' },
        limb: { back: '#4b2416', belly: '#e9c992', side: '#d6ac72', sideBack: '#3a1c11' },
        ear: { back: '#d9c59b', belly: '#f1e4c6', side: '#e4d3ad', sideBack: '#e4d3ad' }
      };
      const limbs = [1, -1].map(sign => {
        const C = [], N = [], T = [], wide = [], deep = [];
        profile.forEach((sample, i) => {
          const a = profile[Math.max(0, i - 1)].p, b = profile[Math.min(n, i + 1)].p;
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
          C.push(at(sample.p[0], sample.p[1] * sign));
          T.push(toward([0, 0, 0], [A, tx], [U, ty * sign]));
          N.push(toward([0, 0, 0], [A, ty], [U, -tx * sign]));
          deep.push(minPx(sample.t, 3.2) / 2);
          wide.push(minPx(sample.w, 2.6) / 2);
        });
        // Each face is a strip: [normal at sample i, edge point at sample i on side a = -1 or 1].
        const faces = [
          { key: 'back', normal: i => N[i], edge: (i, a) => toward(C[i], [N[i], deep[i]], [L, a * wide[i]]) },
          { key: 'belly', normal: i => scaled(N[i], -1), edge: (i, a) => toward(C[i], [N[i], -deep[i]], [L, a * wide[i]]) },
          { key: 'side', normal: () => L, edge: (i, a) => toward(C[i], [L, wide[i]], [N[i], a * deep[i]]), split: 1 },
          { key: 'side', normal: () => scaled(L, -1), edge: (i, a) => toward(C[i], [L, -wide[i]], [N[i], a * deep[i]]), split: -1 }
        ];
        const runs = [];
        for (const face of faces) {
          let from = null;
          for (let i = 0; i <= n; i++) {
            const open = i < n && dot(add(face.normal(i), face.normal(i + 1)), CAM) > 0;
            const kind = i < n ? profile[i + 1].kind : null;
            if (from !== null && (!open || kind !== profile[from + 1].kind)) {
              runs.push({ face, from, to: i, kind: profile[from + 1].kind });
              from = null;
            }
            if (open && from === null) from = i;
          }
        }
        return { sign, C, N, T, wide, deep, runs, faces };
      });
      const strip = (face, from, to, a0 = -1, a1 = 1) => {
        const points = [];
        for (let i = from; i <= to; i++) points.push(face.edge(i, a0));
        for (let i = to; i >= from; i--) points.push(face.edge(i, a1));
        return points;
      };
      const path = points => { g.beginPath(); points.forEach((v, i) => g[i ? 'lineTo' : 'moveTo'](px(v), py(v))); g.closePath(); };
      // Where the limb's silhouette reaches across the screen at sample i: a band from edge to edge.
      const across = (limb, i) => {
        const tx = px(limb.T[i]) - px([0, 0, 0]), ty = py(limb.T[i]) - py([0, 0, 0]);
        const l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
        let lo = null, hi = null;
        for (const a of [-1, 1]) for (const b of [-1, 1]) {
          const v = toward(limb.C[i], [limb.N[i], a * limb.deep[i]], [L, b * limb.wide[i]]);
          const d = (px(v) - px(limb.C[i])) * nx + (py(v) - py(limb.C[i])) * ny;
          if (!lo || d < lo.d) lo = { d, v };
          if (!hi || d > hi.d) hi = { d, v };
        }
        return [lo.v, hi.v];
      };

      const drawLimbs = () => {
        if (masking) {
          g.fillStyle = '#000';
          for (const limb of limbs) for (const run of limb.runs) { path(strip(run.face, run.from, run.to)); g.fill(); }
          return;
        }
        // Ink under every face first, then the faces, so the strip reads as one solid piece.
        g.strokeStyle = ink;
        g.lineWidth = res * (lw + .012);
        g.lineJoin = 'round';
        for (const limb of limbs) for (const run of limb.runs) { path(strip(run.face, run.from, run.to)); g.stroke(); }
        for (const limb of limbs) for (const run of limb.runs) {
          const palette = colors[run.kind];
          path(strip(run.face, run.from, run.to));
          g.fillStyle = palette[run.face.key];
          g.fill();
          if (run.face.split && run.kind === 'limb') {
            // The laminate seen from the side: horn toward the string, sinew toward the target.
            path(strip(run.face, run.from, run.to, .1, 1));
            g.fillStyle = palette.sideBack;
            g.fill();
          }
        }
        for (const limb of limbs) {
          // Gold inlay down the sinew back, a shine down the horn belly.
          for (const run of limb.runs) {
            if (run.kind !== 'limb') continue;
            const centre = [];
            for (let i = run.from; i <= run.to; i++) {
              if (run.face.key === 'back') centre.push(toward(limb.C[i], [limb.N[i], limb.deep[i]]));
              else if (run.face.key === 'belly') centre.push(toward(limb.C[i], [limb.N[i], -limb.deep[i]], [L, limb.wide[i] * .25]));
              else centre.push(toward(limb.C[i], [L, run.face.split * limb.wide[i]], [limb.N[i], -limb.deep[i] * .5]));
            }
            stroke(centre, minPx(.013, 1), run.face.key === 'back' ? '#d6a04a' : '#fff1d2');
          }
          // Bronze collars where the grip fades into the limbs, a bone string bridge at the knee,
          // a dark sinew binding where the ear is set into the limb, and a nock knob at the tip.
          const [c0, c1] = across(limb, 1);
          taper(c0, c1, minPx(.034, 1.6), minPx(.034, 1.6), '#cf963c', .01);
          const [b0, b1] = across(limb, bridgeAt + 1);
          taper(b0, b1, minPx(.026, 1.3), minPx(.026, 1.3), '#24120b', false);
          disc(toward(limb.C[bridgeAt], [limb.N[bridgeAt], -limb.deep[bridgeAt] * .8]), minPx(.018, 1.2), '#f4ead2', .01);
          disc(toward(limb.C[n], [limb.T[n], -.006]), minPx(.025, 1.5), '#f4ead2', .01);
        }
        // Leather wrap across the grip.
        const [w0, w1] = across(limbs[0], 0);
        for (const h of [-.07, -.025, .025, .07]) stroke([toward(w0, [U, h - .012]), toward(w1, [U, h + .012])], minPx(.012, 1), '#8a5634');
      };

      // The string: from each tip, over the bridge while it still rests on the ear, to the nock.
      // Loosed (or stowed), it snaps straight at brace height and the arrow is gone.
      const nock = loosed ? at(-brace, 0) : al(0);
      const drawString = () => {
        const points = [];
        for (const limb of limbs) {
          const tip = toward(limb.C[n], [limb.N[n], -limb.deep[n]]);
          const rest = toward(limb.C[bridgeAt], [limb.N[bridgeAt], -limb.deep[bridgeAt]]);
          const y = (v) => dot(sub(v, grip), U) * limb.sign, x = v => dot(sub(v, grip), A);
          const line = x(nock) + (x(tip) - x(nock)) * (y(rest) - y(nock)) / ((y(tip) - y(nock)) || 1);
          points.push(x(rest) < line - .004 ? [tip, rest] : [tip]);
        }
        const route = [...points[0], nock, ...points[1].reverse()];
        const width = minPx(.018, 1.25);
        stroke(route, width + minPx(.016, 1), ink);
        if (!masking) stroke(route, width, '#fff6e2');
      };

      // The arrow keeps its length, so it visibly slides back through the bow as the string comes
      // to the cheek: shaft, two-colored fletching at the nock and a steel broadhead past the grip.
      const arrow = loosed ? null : (() => {
        const tip = add(nock, scaled(A, ARROW * s));
        const screen = v => [px(v) - px([0, 0, 0]), py(v) - py([0, 0, 0])];
        const [ax, ay] = screen(A);
        const wing = [U, L].map(v => { const [vx, vy] = screen(v); return { v, d: Math.abs(ax * vy - ay * vx) }; })
          .sort((a, b) => b.d - a.d)[0].v;
        const shaft = minPx(.032, 1.8);
        return {
          rear() {
            taper(add(nock, scaled(A, .01)), grip, shaft, shaft, '#c8975c', .012);
            for (const k of [1, -1]) poly([toward(nock, [A, .04]), toward(nock, [A, .25]), toward(nock, [A, .21], [wing, k * .045]),
              toward(nock, [A, .06], [wing, k * .065])], k > 0 ? '#c83b3b' : '#f2ead8', .01);
            disc(nock, minPx(.02, 1.3), '#2a160e', false);
          },
          front() {
            taper(grip, toward(tip, [A, -.15]), shaft, shaft, '#c8975c', .012);
            taper(toward(tip, [A, -.2]), toward(tip, [A, -.13]), shaft * 1.3, shaft * 1.2, '#3c2a20', .01);
            poly([toward(tip, [A, -.16], [wing, .018]), toward(tip, [A, -.08], [wing, .062]), tip,
              toward(tip, [A, -.08], [wing, -.062]), toward(tip, [A, -.16], [wing, -.018])], '#e3eef2', .012);
            fine([toward(tip, [A, -.15]), toward(tip, [A, -.02])], '#5c7080', minPx(.012, .9));
            const pull = Math.max(0, state.charge);
            if (pull > .5) shine(toward(tip, [A, -.04]), .14 + pull * .16, `rgba(${look.glow},${.4 + pull * .4})`);
          }
        };
      })();

      // Paint back to front: the string side is nearer the camera when the archer faces away.
      if (dot(A, CAM) > 0) {
        drawString();
        if (arrow) arrow.rear();
        drawLimbs();
        if (arrow) arrow.front();
      } else {
        if (arrow) arrow.front();
        drawLimbs();
        drawString();
        if (arrow) arrow.rear();
      }
    }
  };

  function scutum(r, spec, look, facing, c) {
    const { j, vector } = r;
    const W = .42, T = .64;
    // Curved like a half cylinder: the middle bulges toward the enemy.
    // Held angled around the front of the body, inner edge forward, so it never shows edge-on.
    const pt = (u, v, scale = 1, depth = 0) => add(add(j.handL, vector(.05 + (1 - u * u) * .08 + u * W * scale * .38 + depth, u * W * scale * .92, 0)), [0, 0, v * T * scale]);
    const edge = (scale, depth = 0) => {
      const points = [];
      for (let i = 0; i <= 8; i++) points.push(pt(-1 + i / 4 * .5 * 1, .97, scale, depth));
      for (let i = 1; i <= 6; i++) points.push(pt(1, .97 - i / 6 * 1.94, scale, depth));
      for (let i = 1; i <= 8; i++) points.push(pt(1 - i / 4 * .5 * 1, -.97, scale, depth));
      for (let i = 1; i < 6; i++) points.push(pt(-1, -.97 + i / 6 * 1.94, scale, depth));
      return points;
    };
    // Which face the camera sees depends on the shield's own turn, not just the body's.
    const front = Math.sin(facing + .36) > -.2;
    // The board's thickness: a darker copy set back behind the face.
    poly(edge(1.04, front ? -.06 : .06), '#3a2414');
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
      fine([...edge(.84), edge(.84)[0]], c.bronzeDeep, .012);
      taper(pt(0, .7), pt(0, -.7), .07, .07, look.deep, false);
      fine([pt(.02, .7), pt(.02, -.7)], look.light, .01);
      for (let i = -4; i <= 4; i++) for (const v of [.835, -.835]) disc(pt(i * .2, v), .014, c.bronzeLight, false);
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

  // ---- Champion limbs ----

  // Width (world units) along an arm, from the shoulder to the wrist: deltoid, biceps peak, a narrow
  // elbow, the forearm swelling below it and narrowing to the wrist.
  function armProfile(shoulder, elbow, wrist, build = 1) {
    const l1 = Math.hypot(...sub(elbow, shoulder)), l2 = Math.hypot(...sub(wrist, elbow));
    const tE = l1 / (l1 + l2 || 1);
    const upper = [[0, .29], [.14, .27], [.36, .222], [.6, .228], [.86, .172], [1, .152]];
    const lower = [[0, .152], [.14, .196], [.4, .178], [.76, .134], [1, .114]];
    const f = t => build * (t < tE ? curve(upper, t / tE) : curve(lower, (t - tE) / (1 - tE)));
    f.elbow = tE;
    return f;
  }
  function curve(keys, u) {
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const [a, wa] = keys[i - 1], [b, wb] = keys[i];
        return mix(wa, wb, ease((u - a) / (b - a || 1)));
      }
    }
    return keys[keys.length - 1][1];
  }

  // A smooth limb: the bone chain sampled in screen space, each sample pushed out both ways by the
  // width profile, inked and filled as one shape with rounded ends. Returns the samples so armor,
  // sleeves and muscle lines can follow the same contour.
  function drawLimb(chain, profile, color, n = 22) {
    const S = [];
    let normal = [0, -1];
    for (let i = 0; i <= n; i++) {
      const v = along(chain, i / n);
      S.push({ x: px(v), y: py(v), w: profile(i / n) * res / 2 });
    }
    for (let i = 0; i <= n; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(n, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
      if (l > .6) normal = [-dy / l, dx / l];
      S[i].nx = normal[0]; S[i].ny = normal[1];
    }
    // Average neighboring normals so the contour turns smoothly round the elbow.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) {
        const x = S[i - 1].nx + S[i].nx * 2 + S[i + 1].nx, y = S[i - 1].ny + S[i].ny * 2 + S[i + 1].ny, l = Math.hypot(x, y) || 1;
        S[i].nx = x / l; S[i].ny = y / l;
      }
    }
    S.n = n;
    S.elbow = profile.elbow ?? .5;
    const outline = () => {
      g.beginPath();
      S.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](s.x + s.nx * s.w, s.y + s.ny * s.w));
      for (let i = n; i >= 0; i--) g.lineTo(S[i].x - S[i].nx * S[i].w, S[i].y - S[i].ny * S[i].w);
      g.closePath();
      for (const s of [S[0], S[n], S[Math.round(S.elbow * n)]]) { g.moveTo(s.x + s.w, s.y); g.arc(s.x, s.y, s.w, 0, Math.PI * 2); }
    };
    g.lineJoin = 'round';
    g.strokeStyle = ink;
    g.lineWidth = res * fw;
    outline();
    g.stroke();
    g.fillStyle = color;
    outline();
    g.fill('nonzero');
    return S;
  }

  const sampleAt = (S, t) => S[Math.max(0, Math.min(S.n, Math.round(t * S.n)))];

  // Form shading on a limb: a soft shadow down the side turned away from the light (upper left)
  // and a thin highlight along the lit side, so a round arm reads round.
  function limbShade(S, shadow, light) {
    let score = 0;
    for (const s of S) score += s.ny + s.nx * .6;
    const away = score > 0 ? 1 : -1;
    g.beginPath();
    for (let i = 0; i <= S.n; i++) g[i ? 'lineTo' : 'moveTo'](S[i].x + S[i].nx * S[i].w * away * .1, S[i].y + S[i].ny * S[i].w * away * .1);
    for (let i = S.n; i >= 0; i--) g.lineTo(S[i].x + S[i].nx * S[i].w * away * .96, S[i].y + S[i].ny * S[i].w * away * .96);
    g.closePath();
    g.fillStyle = shadow;
    g.fill();
    g.strokeStyle = light;
    g.lineWidth = res * .018;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 1; i < S.n; i++) g[i > 1 ? 'lineTo' : 'moveTo'](S[i].x - S[i].nx * S[i].w * away * .55, S[i].y - S[i].ny * S[i].w * away * .55);
    g.stroke();
    return away;
  }

  // A strip of the limb between t0 and t1, a little wider than the skin, for armor and cloth. With
  // bow, both ends curve toward the hand like rings seen on a round arm.
  function limbBand(S, t0, t1, scale, color, line, bow = 0) {
    const i0 = Math.max(0, Math.round(t0 * S.n)), i1 = Math.min(S.n, Math.max(i0 + 1, Math.round(t1 * S.n)));
    const edge = (s, side) => [s.x + s.nx * s.w * scale * side, s.y + s.ny * s.w * scale * side];
    const bulge = s => [s.x + s.ny * s.w * bow * 2, s.y - s.nx * s.w * bow * 2];
    g.beginPath();
    for (let i = i0; i <= i1; i++) g[i === i0 ? 'moveTo' : 'lineTo'](...edge(S[i], 1));
    if (bow) g.quadraticCurveTo(...bulge(S[i1]), ...edge(S[i1], -1));
    for (let i = i1; i >= i0; i--) g.lineTo(...edge(S[i], -1));
    if (bow) g.quadraticCurveTo(...bulge(S[i0]), ...edge(S[i0], 1));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * line;
    g.stroke();
  }

  // A line along the limb at a fraction of its half-width (side), or, when t0 = t1, straight across
  // it at that station (span is how far across, as a fraction of the half-width).
  function limbLine(S, t0, t1, side, color, width, span = 1, crossWidth = .014, bow = 0) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.beginPath();
    if (t0 === t1) {
      const s = sampleAt(S, t0);
      g.lineWidth = res * crossWidth;
      g.moveTo(s.x + s.nx * s.w * span, s.y + s.ny * s.w * span);
      g.quadraticCurveTo(s.x + s.ny * s.w * bow * 2, s.y - s.nx * s.w * bow * 2, s.x - s.nx * s.w * span, s.y - s.ny * s.w * span);
    } else {
      g.lineWidth = res * width;
      const i0 = Math.round(t0 * S.n), i1 = Math.round(t1 * S.n);
      for (let i = i0; i <= i1; i++) g[i === i0 ? 'moveTo' : 'lineTo'](S[i].x + S[i].nx * S[i].w * side, S[i].y + S[i].ny * S[i].w * side);
    }
    g.stroke();
  }

  // A shell over the top of the arm: rounded over the deltoid, following the arm down to t1 and
  // ending in an edge that bows toward the hand. For pauldrons and shoulder plates.
  function limbShell(S, t1, top, bottom, color, line = .014) {
    const i1 = Math.max(1, Math.min(S.n, Math.round(t1 * S.n)));
    const s0 = S[0], e = S[i1];
    const at = (i, side) => { const k = mix(top, bottom, i / i1); return [S[i].x + S[i].nx * S[i].w * k * side, S[i].y + S[i].ny * S[i].w * k * side]; };
    g.beginPath();
    g.moveTo(...at(i1, 1));
    for (let i = i1 - 1; i >= 0; i--) g.lineTo(...at(i, 1));
    const a0 = Math.atan2(s0.ny, s0.nx);
    g.arc(s0.x, s0.y, s0.w * top, a0, a0 + Math.PI);
    for (let i = 1; i <= i1; i++) g.lineTo(...at(i, -1));
    g.quadraticCurveTo(e.x + e.ny * e.w * bottom * .7, e.y - e.nx * e.w * bottom * .7, ...at(i1, 1));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (!line) return;
    g.strokeStyle = ink;
    g.lineWidth = res * line;
    g.lineJoin = 'round';
    g.stroke();
  }

  function limbDot(S, t, r, color) {
    const s = sampleAt(S, t);
    g.beginPath();
    g.arc(s.x, s.y, r * res, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
  }

  // A closed fist past the wrist: squared back of the hand, a row of four knuckles, finger
  // creases and the thumb folded across.
  function fist(wrist, hand, left, color, c) {
    const wx = px(wrist), wy = py(wrist), hx = px(hand), hy = py(hand);
    let dx = hx - wx, dy = hy - wy;
    const l = Math.hypot(dx, dy);
    if (l < .5) { dx = 0; dy = 1; } else { dx /= l; dy /= l; }
    const k = res, side = left ? -1 : 1;
    const at = (a, b) => [wx + (dx * a - dy * b * side) * k, wy + (dy * a + dx * b * side) * k];
    const shape = [[-.02, -.06], [.05, -.078], [.13, -.08], [.18, -.066], [.205, -.03], [.21, .01], [.2, .05], [.16, .074], [.08, .08], [.01, .07], [-.02, .05]];
    g.beginPath();
    shape.forEach((point, i) => g[i ? 'lineTo' : 'moveTo'](...at(...point)));
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = ink;
    g.lineWidth = res * .03;
    g.stroke();
    g.fillStyle = color;
    g.fill();
    // Knuckles and finger creases.
    g.strokeStyle = c.shade;
    g.lineWidth = res * .01;
    g.lineCap = 'round';
    for (const b of [-.045, -.012, .02, .05]) {
      g.beginPath();
      g.arc(...at(.165, b), res * .018, 0, Math.PI * 2);
      g.stroke();
    }
    for (const b of [-.028, .004, .036]) {
      g.beginPath(); g.moveTo(...at(.17, b)); g.lineTo(...at(.205, b)); g.stroke();
    }
    // The thumb, folded over the front of the fingers.
    g.beginPath();
    const thumb = [[.04, -.07], [.1, -.1], [.16, -.088], [.17, -.06], [.1, -.058]];
    thumb.forEach((point, i) => g[i ? 'lineTo' : 'moveTo'](...at(...point)));
    g.closePath();
    g.strokeStyle = ink;
    g.lineWidth = res * .02;
    g.stroke();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(255,230,200,.35)';
    g.lineWidth = res * .012;
    g.beginPath(); g.moveTo(...at(.03, -.04)); g.lineTo(...at(.15, -.05)); g.stroke();
  }

  // The fingers wrapped round a grip, drawn over the weapon so the hand visibly holds it.
  function gripWrap(hand, axis, color, c) {
    const hx = px(hand), hy = py(hand);
    let ax = px(add(hand, axis)) - hx, ay = py(add(hand, axis)) - hy;
    const l = Math.hypot(ax, ay);
    if (l < 1) return;
    ax /= l; ay /= l;
    const at = (a, b) => [hx + (ax * a - ay * b) * res, hy + (ay * a + ax * b) * res];
    g.beginPath();
    const corners = [[-.075, -.05], [.075, -.05], [.085, 0], [.075, .055], [-.075, .055], [-.085, 0]];
    corners.forEach((point, i) => g[i ? 'lineTo' : 'moveTo'](...at(...point)));
    g.closePath();
    g.strokeStyle = ink;
    g.lineWidth = res * .022;
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = c.shade;
    g.lineWidth = res * .01;
    for (const a of [-.037, 0, .037]) { g.beginPath(); g.moveTo(...at(a, -.045)); g.lineTo(...at(a, .05)); g.stroke(); }
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
        const ankle = add(foot, [0, 0, .09]);
        const toe = add(foot, add(vector(.26, 0, 0), [0, 0, .03]));
        const calf = lerp(knee, ankle, .32);
        // Muscle masses: the quadriceps swell at the front of the thigh, the calf at the back of the shin.
        const front = vector(.05, 0, 0), back = vector(-.05, 0, 0);
        const thigh = varro ? c.skin : c.cloth, shin = varro ? c.skin : c.leather;
        fused([[hip, knee, .31, .17, thigh], [add(lerp(hip, knee, .15), front), add(lerp(hip, knee, .72), front), .25, .17, thigh],
          [knee, calf, .17, .2, shin], [add(lerp(knee, ankle, .12), back), add(lerp(knee, ankle, .5), back), .17, .16, shin],
          [calf, ankle, .19, .105, shin], [add(ankle, vector(-.06, 0, -.04)), toe, .15, .1, varro ? c.leather : c.leatherDeep]]);
        fine([add(lerp(hip, knee, .2), front), add(lerp(hip, knee, .82), front)], varro ? c.shade : c.clothShade, .016);
        if (varro) fine([add(knee, vector(.06, -.05, .04)), add(knee, vector(.08, 0, -.02)), add(knee, vector(.06, .05, .04))], c.shade, .014);
        fine([lerp(hip, knee, .3), lerp(hip, knee, .86)], varro ? c.shade : c.clothShade, .02);
        if (varro && lead) {
          // Ocrea: a tall greave over the leading shin, with a bronze knee guard.
          taper(lerp(knee, ankle, .04), lerp(knee, ankle, .94), .24, .15, metal.steel);
          fine([add(lerp(knee, ankle, .12), vector(0, .04, 0)), add(lerp(knee, ankle, .86), vector(0, .03, 0))], metal.edge, .02);
          for (const t of [.3, .6]) fine(across(lerp(knee, ankle, t), .1), metal.dark, .012);
          disc(lerp(knee, ankle, .42), .055, c.bronze, .012);
          disc(add(lerp(knee, ankle, .42), [0, 0, .015]), .022, c.bronzeLight, false);
          for (const t of [.22, .78]) fine(across(lerp(knee, ankle, t), .12, -.02), c.leather, .02);
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
          taper(lerp(knee, ankle, .08), lerp(knee, ankle, .2), .26, .25, '#8c7b66');
          for (const side of [-.08, 0, .08]) fine([add(lerp(knee, ankle, .1), vector(0, side, 0)), add(lerp(knee, ankle, .2), vector(.02, side * 1.1, 0))], '#5e5040', .01);
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
      // Pinned at the real shoulders (so it turns with the archer's stance), falling to the backs of
      // the knees with a ragged hem, narrow enough that the legs and quiver still read from behind.
      const drop = .46 + sway * .45 + (hipZ - .78) * .5;
      const cl = (forward, right, up) => P(forward, right, Math.max(.04, up));
      const pin = (shoulder, s) => add(shoulder, add(vector(-.12, s * -.04, 0), [0, 0, .06]));
      const cloak = [
        pin(j.shoulderL, -1), pin(j.shoulderR, 1),
        cl(-.3 - sway * .45, .44, .9 + sway * .25), cl(-.44 - sway * .85, .4, drop - .04), cl(-.38 - sway * .65, .24, drop + .14),
        cl(-.5 - sway * 1.05, .1, drop - .08), cl(-.42 - sway * .75, -.03, drop + .12), cl(-.54 - sway * 1.1, -.15, drop - .1),
        cl(-.38 - sway * .65, -.26, drop + .14), cl(-.46 - sway * .88, -.4, drop - .03), cl(-.3 - sway * .45, -.44, .9 + sway * .25)
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
      if (spec.spare === 'recurve') {
        // Strapped flat across the back, strung but empty, upper limb over the left shoulder, so
        // from behind it shows its full profile; the quiver crosses over it.
        const aim = vector(0, .9, .42);
        kept(() => weapon('recurve', add(P(lean * .5 - .36, -.02, chestZ - .1), aim.map(v => -v * BRACE)), aim, vector(-1, 0, 0), look,
          { draw: BRACE, charge: -1, stowed: true }));
      }
      if (!varro) {
        const top = P(lean * .6 - .34, .2, chestZ + .16), bottom = P(-.32, -.14, hipZ);
        // Arrows fan out of the mouth, each with a two-colored fletching.
        for (let i = 0; i < 6; i++) {
          const base = add(top, vector(0, (i - 2.5) * .025, 0));
          const tip = add(base, vector(-.06 + i * .02, .12 - i * .045, .2 + (i % 2) * .04));
          taper(base, tip, .022, .02, '#d6b27a', false);
          poly([tip, add(tip, vector(-.02, -.06, -.13)), add(tip, vector(0, 0, -.16)), add(tip, vector(.02, .06, -.12))],
            i % 2 ? '#c83b3b' : c.fletch, .009);
        }
        taper(top, bottom, .16, .13, c.leatherDeep);
        fine([lerp(top, bottom, .14), lerp(top, bottom, .86)], c.leather, .05);
        for (const t of [.06, .86]) taper(lerp(top, bottom, t), lerp(top, bottom, t + .06), .17, .15, c.bronze);
        disc(lerp(top, bottom, .5), .03, c.bronze, false);
      }
      if (spec.spare === 'pilum') {
        // Two javelins crossed low on the back, points over the shoulders.
        for (const s of [-1, 1]) {
          const grip = P(lean * .5 - .3 - s * .04, -s * .17, hipZ + .12);
          weapon('pilum', grip, vector(-.22 - s * .12, s * .45, .86).map(v => v * .68), vector(0, .9, -.4), look, 0);
        }
      } else if (!stowedAtHip.includes(spec.spare) && spec.spare !== 'recurve') {
        // Anything else is slung across the back, grip over the right shoulder.
        const grip = P(lean * .6 - .36, .26, chestZ + .1);
        weapon(spec.spare, grip, vector(-.12, -.66, -.72).map(v => v * .72), vector(0, .7, -.7), look, 0);
      }
    });
    if (stowedAtHip.includes(spec.spare)) {
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
          // A pouch with a flap on the right hip.
          const pouch = (f, r, u) => P(lean * .32 + .14 + f, .22 + r, hipZ + u);
          poly([pouch(0, -.07, .08), pouch(0, .07, .08), pouch(.02, .07, -.06), pouch(.02, -.07, -.06)], c.leather, .012);
          poly([pouch(.01, -.075, .09), pouch(.01, .075, .09), pouch(.025, 0, .01)], c.leatherDeep, .012);
          disc(pouch(.03, 0, .02), .014, c.bronze, false);
        }
      }
    }, .05);

    // Torso.
    part(lerp(j.waist, j.chest, .6), () => {
      const body = varro ? c.skin : c.leather;
      // A point that follows the spine's lean between hips and chest.
      const spine = (forward, right, up) => P(lean * (.3 + .46 * clamp01((up - hipZ) / (chestZ - hipZ))) + forward, right, up);
      // Built from masses like a figure drawing: pelvis, a narrow waist, a broad ribcage flaring
      // into the lats, a shoulder girdle reaching out to the deltoids, trapezius and a thick neck.
      const torso = [
        [spine(0, -.1, hipZ + .03), spine(0, .1, hipZ + .03), .3, .3, varro ? c.skin : c.leatherDeep],
        [spine(0, -.07, hipZ + .16), spine(0, .07, hipZ + .16), .32, .32, body],
        [spine(.01, 0, hipZ + .14), spine(.02, 0, chestZ - .14), .34, .46, body],
        [add(lerp(j.shoulderL, j.shoulderR, .3), [0, 0, -.2]), add(lerp(j.shoulderL, j.shoulderR, .7), [0, 0, -.2]), .42, .42, body],
        [add(lerp(j.shoulderL, j.shoulderR, .12), [0, 0, -.06]), add(lerp(j.shoulderL, j.shoulderR, .88), [0, 0, -.06]), .24, .24, body],
        [spine(-.02, -.17, chestZ + .14), spine(-.03, 0, chestZ + .22), .17, .2, varro ? c.skin : body],
        [spine(-.02, .17, chestZ + .14), spine(-.03, 0, chestZ + .22), .17, .2, varro ? c.skin : body],
        [spine(0, 0, chestZ + .12), j.neck, .2, .17, c.skin],
        // Depth front to back, so the side view has a chest and a seat, not a pole.
        [spine(-.07, 0, chestZ - .08), spine(.07, 0, chestZ - .05), .34, .36, body],
        [spine(-.07, 0, hipZ + .06), spine(.02, 0, hipZ + .08), .26, .24, varro ? c.skin : c.leatherDeep]
      ];
      fused(torso);
      // Surface details sit a little proud of the masses; clipped to them, the ones near the edge
      // of a turned torso stop spilling over the arm behind it.
      const clipToTorso = () => {
        g.save();
        g.beginPath();
        for (const [a, b, wa, wb] of torso) taperPath(a, b, wa, wb, false);
        g.clip();
      };
      if (varro && front) {
        clipToTorso();
        // Bare chest: pectorals, a six-pack, obliques, collarbones and an old scar.
        for (const s of [-1, 1]) {
          // The outer muscles of a side turned away from the camera crowd into the edge of the
          // torso and smear over the shoulder behind it, so only the turned-toward side gets them.
          if (.6 * Math.sin(facing) + .8 * s * Math.cos(facing) > .15) {
            poly([on(s * .03, chestZ + .12), on(s * .24, chestZ + .13), on(s * .25, chestZ - .02), on(s * .04, chestZ - .06)], c.glint, false);
            fine([on(s * .26, chestZ - .01), on(s * .14, chestZ - .09), on(s * .02, chestZ - .06)], c.shade, .03);
            fine([on(s * .05, chestZ + .17), on(s * .24, chestZ + .19)], c.shade, .016);
            fine([on(s * .22, chestZ - .1), on(s * .19, hipZ + .26), on(s * .13, hipZ + .16)], c.shade, .02);
          }
          for (let row = 0; row < 3; row++) {
            const z = chestZ - .15 - row * .085;
            fine([on(s * .025, z), on(s * .1, z - .012)], c.shade, .016);
            poly([on(s * .03, z + .07), on(s * .09, z + .065), on(s * .09, z + .015), on(s * .03, z + .015)], c.glint, false);
          }
        }
        fine([on(0, chestZ + .02), on(0, hipZ + .2)], c.shade, .018);
        disc(on(0, hipZ + .2), .014, c.deep, false);
        fine([on(-.2, chestZ + .08), on(-.05, chestZ - .02), on(.08, chestZ - .14)], c.scar, .014);
        g.restore();
      } else if (varro) {
        // Spine and shoulder blades.
        fine([P(lean * .76 - .25, 0, chestZ + .12), P(lean * .45 - .22, 0, hipZ + .18)], c.shade, .022);
        for (const s of [-1, 1]) fine([P(lean * .7 - .2, s * .06, chestZ + .06), P(lean * .7 - .22, s * .2, chestZ - .02), P(lean * .6 - .2, s * .16, chestZ - .16)], c.shade, .018);
      } else if (front) {
        // Lorica squamata: rows of overlapping bronze-edged scales, then the quiver baldric.
        clipToTorso();
        for (let row = 0; row < 5; row++) {
          const z = chestZ + .12 - row * .085;
          for (let col = -3; col <= 3; col++) {
            const right = col * .07 + (row % 2) * .035;
            if (Math.abs(right) > .25 - row * .012) continue;
            poly([on(right - .036, z), on(right + .036, z), on(right + .032, z - .06), on(right, z - .088), on(right - .032, z - .06)],
              (row + col) % 3 ? c.scale : c.scaleDeep, .01);
            fine([on(right - .024, z - .014), on(right, z - .02), on(right + .024, z - .014)], 'rgba(255,255,255,.6)', .009);
          }
        }
        g.restore();
        fine([on(-.26, chestZ - .3), on(0, chestZ - .33), on(.26, chestZ - .3)], c.bronze, .03);
        inked([on(.27, chestZ + .17), on(0, chestZ - .06), on(-.2, hipZ + .16)], .06, c.leatherDeep);
        disc(on(.02, chestZ - .07), .04, c.bronze, .01);
        poly([on(-.1, chestZ + .21), on(.1, chestZ + .21), on(0, chestZ + .12)], c.skin, .01);
        // The cloak's brooch on the right shoulder.
        disc(on(.25, chestZ + .15), .055, c.bronze, .012);
        disc(on(.25, chestZ + .15), .025, look.light, false);
        shine(on(.25, chestZ + .15, .3), .07, `rgba(${look.glow},.6)`);
      } else {
        fine([P(lean * .76 - .24, 0, chestZ + .12), P(lean * .45 - .2, 0, hipZ + .2)], c.leatherDeep, .025);
        inked([P(lean * .7 - .24, .26, chestZ + .15), P(lean * .5 - .22, -.2, hipZ + .18)], .06, c.leatherDeep);
      }
    }, .06);

    // Arms and shoulders.
    for (const [shoulder, elbow, hand, left] of [[j.shoulderL, j.elbowL, j.handL, true], [j.shoulderR, j.elbowR, j.handR, false]]) {
      part(lerp(shoulder, hand, .55), () => {
        const wrist = add(hand, sub(elbow, hand).map(v => v * .12 / (Math.hypot(...sub(elbow, hand)) || 1)));
        const S = drawLimb([shoulder, elbow, wrist], armProfile(shoulder, elbow, wrist, varro ? 1.08 : .98), c.skin);
        const tE = S.elbow;
        const away = limbShade(S, 'rgba(90,30,24,.3)', c.glint);
        // Muscle forms, kept soft so they read as shape and not as dirt: the biceps-triceps split,
        // the elbow crease and the forearm's long muscle.
        const crease = 'rgba(110,45,30,.42)';
        limbLine(S, tE * .38, tE * .86, .36, crease, .014);
        limbLine(S, tE + (1 - tE) * .1, tE + (1 - tE) * .5, .28, crease, .012);
        limbLine(S, tE - .015, tE + .02, -.15, crease, .012);
        if (varro && !left) {
          // Manica: overlapping steel lames that follow the arm, upper ones over lower ones.
          for (let i = 7; i >= 0; i--) {
            const t0 = .04 + i * .112;
            limbBand(S, t0, t0 + .13, 1.1, i % 2 ? metal.iron : metal.steel, .012, .32);
            limbLine(S, t0 + .03, t0 + .1, -away * .5, i % 2 ? metal.steel : metal.edge, .012);
          }
          for (const t of [tE - .03, tE + .04]) limbLine(S, t, t, 0, c.leather, 0, 1.15, .02, .32);
          limbBand(S, .9, 1, 1.12, c.leather, .012, .3);
          // A bronze shoulder guard that rounds over the deltoid and follows the arm down.
          limbShell(S, tE * .38, 1.32, 1.18, c.bronzeDeep, .016);
          limbShell(S, tE * .3, 1.16, 1.06, c.bronze, false);
          limbLine(S, tE * .04, tE * .26, -away * .55, c.bronzeLight, .018);
          for (const f of [.08, .2]) limbDot(S, tE * f, .016, c.bronzeLight);
        } else if (varro) {
          limbBand(S, tE + (1 - tE) * .35, tE + (1 - tE) * .72, 1.06, c.linen, .012, .3);
          for (const f of [.43, .53, .63]) limbLine(S, tE + (1 - tE) * f, tE + (1 - tE) * f, 0, c.linenShade, 0, 1.06, .01, .3);
          limbBand(S, tE + (1 - tE) * .76, 1, 1.1, c.leather, .012, .3);
          limbLine(S, tE + (1 - tE) * .8, .97, 0, c.bronze, .02);
        } else {
          // A sleeve in the team color down to a gilded hem above the elbow, under two layered
          // leather shoulder plates that round over the deltoid and follow the arm. Then a laced
          // bracer on the bow arm.
          limbBand(S, 0, tE * .66, 1.1, look.main, .014, .3);
          limbLine(S, tE * .42, tE * .6, away * .5, look.deep, .014);
          limbLine(S, tE * .66, tE * .66, 0, metal.gold, 0, 1.12, .024, .3);
          limbShell(S, tE * .4, 1.3, 1.2, c.leatherDeep, .014);
          limbShell(S, tE * .27, 1.16, 1.1, c.leather, .014);
          limbLine(S, tE * .04, tE * .22, -away * .5, c.leatherLight, .014);
          for (const f of [.12, .32]) limbDot(S, tE * f, .016, c.bronze);
          if (left) {
            limbBand(S, tE + (1 - tE) * .3, 1, 1.1, c.leatherDeep, .012, .3);
            for (let k = 0; k < 4; k++) limbLine(S, tE + (1 - tE) * (.38 + k * .15), tE + (1 - tE) * (.45 + k * .15), k % 2 ? .4 : -.4, c.leatherLight, .01);
            for (const f of [.4, .62, .84]) limbDot(S, tE + (1 - tE) * f, .016, c.bronze);
          } else limbBand(S, tE + (1 - tE) * .78, 1, 1.08, c.leather, .012, .3);
        }
        fist(wrist, hand, left, varro ? c.skin : left ? c.skin : c.leather, c);
      }, .07);
    }

    part(j.head, () => (varro ? murmilloHead : archerHead)(r, look, c, facing), .16);
    if (!p.thrown) part(lerp(j.handR, add(j.handR, j.aim), .45), () => {
      const held = () => weapon(spec.weapon, j.handR, j.aim, j.side, look, spec.weapon === 'recurve' && p.draw !== undefined ? { draw: p.draw, charge: p.charge } : p.charge);
      if (spec.weapon === 'recurve') kept(held); else held();
      // Fingers close over the grip, drawn after the weapon so the hand holds it.
      if (spec.weapon === 'recurve') gripWrap(j.handL, bowAxes(j.aim, j.side).U, c.skin, c);
      else gripWrap(j.handR, j.aim, varro ? c.skin : c.leather, c);
    }, .13);
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
      return at(Math.cos(a) * .28 - .03, Math.sin(a) * .28, -.05 - Math.max(0, -Math.cos(a)) * .08);
    }), c.bronze);
    fine(Array.from({ length: 11 }, (_, i) => {
      const a = Math.PI / 2 + i / 10 * Math.PI;
      return at(Math.cos(a) * .25 - .03, Math.sin(a) * .25, -.06 - Math.max(0, -Math.cos(a)) * .07);
    }), c.bronzeDeep, .014);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + i / 8 * Math.PI;
      disc(at(Math.cos(a) * .25 - .03, Math.sin(a) * .25, -.04), .014, c.bronzeLight, false);
    }
    disc(at(-.03, 0, .07), .215, metal.iron);
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
    for (const [a, b] of [[[.06, .26], [-.04, .42]], [[-.06, .27], [-.16, .44]], [[-.18, .27], [-.27, .42]]]) {
      fine([at(a[0], 0, a[1]), at(b[0], 0, b[1])], c.bronzeDeep, .012);
    }
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
    // A rounded cowl, lightly peaked on top, falling to the shoulders.
    poly(Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2, up = Math.sin(a);
      return at(-.06 - Math.max(0, -Math.cos(a)) * .06, Math.cos(a) * .28, .04 + up * (up > 0 ? .29 : .26) + Math.max(0, up) ** 6 * .05);
    }), look.main);
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
    if (spec.weapon === 'recurve') {
      const grip = add(j.handR, j.aim.map(v => v * (r.p.draw ?? BRACE))), { U } = bowAxes(j.aim, j.side);
      points.push(add(grip, U.map(v => v * .95)), add(grip, U.map(v => v * -.95)));
    }
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

  // Takes the kept gear out of the current crescent, fully or in part.
  function unshade(amount) {
    if (!keptAny) return;
    m.globalCompositeOperation = 'destination-out';
    m.globalAlpha = amount;
    m.drawImage(keep, 0, 0);
    m.globalAlpha = 1;
    m.globalCompositeOperation = 'source-over';
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
    keptAny = false;
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
    unshade(1);
    g.drawImage(mask, 0, 0);
    const down = g.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, 'rgba(255,240,210,.10)');
    down.addColorStop(.5, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(10,30,60,.45)');
    g.fillStyle = down;
    g.fillRect(0, 0, w, h);
    const rim = Math.max(1.5, res * .034);
    crescent(w, h, rim, rim, look.rim);
    unshade(.55);
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
    const count = frames[anim] + (isChampion(spec.kit) ? extraFrames[anim] || 0 : 0);
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
