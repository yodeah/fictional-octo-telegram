'use strict';

// Proof of concept: detailed 2D cut-out fighters (docs/2d-art-poc.md). Every body part and item is
// painted once as vector art into its own offscreen sprite, and each frame only moves those sprites
// along the existing skeleton. Detail therefore costs bake time, not frame time. Drawing only:
// nothing here reads or writes fight state.
//
// Units are centimetres. Limb sprites hang down +y from their first joint, the torso and head grow
// up toward -y, weapons point along +x from the grip. +x is always the way the fighter faces.
const ArenaArt2D = (() => {
  const OUTLINE = '#1d100b';
  const SKIN = [196, 134, 92];
  const STEEL = [168, 172, 176];
  const IRON = [104, 106, 112];
  const BRASS = [206, 158, 78];
  const LEATHER = [112, 72, 44];
  const DARKLEATHER = [66, 42, 30];
  const WOOD = [126, 82, 48];

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  // amount > 0 mixes toward warm white, amount < 0 toward a cool dark, which reads richer than gray.
  function tone(rgb, amount) {
    const to = amount > 0 ? [255, 244, 222] : [24, 12, 26];
    const t = Math.abs(amount);
    return 'rgb(' + rgb.map((c, i) => Math.round(c + (to[i] - c) * t)).join(',') + ')';
  }

  // ---------------------------------------------------------------- painting helpers
  function gradient(g, x0, y0, x1, y1, rgb, stops) {
    const fill = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((amount, i) => fill.addColorStop(i / (stops.length - 1), tone(rgb, amount)));
    return fill;
  }
  function shape(g, d, fill, line = 1.3, stroke = OUTLINE) {
    const path = new Path2D(d);
    if (fill) {
      g.fillStyle = fill;
      g.fill(path);
    }
    if (line) {
      g.strokeStyle = stroke;
      g.lineWidth = line;
      g.stroke(path);
    }
    return path;
  }
  const stroke = (g, d, color, width = .8) => shape(g, d, null, width, color);
  function clipped(g, d, paint) {
    g.save();
    g.clip(new Path2D(d));
    paint();
    g.restore();
  }
  function disc(g, x, y, r, fill, line = .8) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (line) {
      g.strokeStyle = OUTLINE;
      g.lineWidth = line;
      g.stroke();
    }
  }
  function rivet(g, x, y, r = 1.25, color = BRASS) {
    disc(g, x, y, r, tone(color, -.1), .6);
    disc(g, x + r * .28, y - r * .3, r * .42, tone(color, .65), 0);
  }
  function stitches(g, d, color = 'rgba(240,214,170,.8)', width = .55) {
    g.save();
    g.setLineDash([1.7, 1.5]);
    stroke(g, d, color, width);
    g.restore();
  }
  function seeded(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  // Fine wear and grain inside a shape: scratches on metal, mottling on leather and cloth.
  function wear(g, d, [x0, y0, x1, y1], count, light, dark, seed = 7, length = 4) {
    const random = seeded(seed);
    clipped(g, d, () => {
      for (let i = 0; i < count; i++) {
        const x = x0 + random() * (x1 - x0);
        const y = y0 + random() * (y1 - y0);
        const run = .6 + random() * length;
        g.strokeStyle = i % 2 ? light : dark;
        g.lineWidth = .25 + random() * .45;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + run * .8, y - run * (random() - .35));
        g.stroke();
      }
    });
  }
  // Rows of interlocking rings.
  function mail(g, d, [x0, y0, x1, y1]) {
    shape(g, d, '#4d5058', 0);
    clipped(g, d, () => {
      g.lineWidth = .75;
      for (let row = 0, y = y0; y < y1; row++, y += 2.5) {
        for (let x = x0 + (row % 2) * 1.6; x < x1; x += 3.2) {
          g.strokeStyle = '#b9bdc4';
          g.beginPath();
          g.arc(x, y, 1.55, .15, Math.PI - .15);
          g.stroke();
          g.strokeStyle = '#23252c';
          g.beginPath();
          g.arc(x, y + .8, 1.55, .2, Math.PI - .2);
          g.stroke();
        }
      }
      // Round the tube: dark back edge, soft light toward the front.
      const shade = g.createLinearGradient(x0, 0, x1, 0);
      shade.addColorStop(0, 'rgba(10,6,14,.6)');
      shade.addColorStop(.55, 'rgba(10,6,14,0)');
      shade.addColorStop(.8, 'rgba(255,240,215,.18)');
      shade.addColorStop(1, 'rgba(10,6,14,.3)');
      g.fillStyle = shade;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    });
    stroke(g, d, OUTLINE, 1.2);
  }
  const plateFill = (g, x0, x1, rgb = STEEL) => gradient(g, x0, 0, x1, 0, rgb, [-.55, -.2, .1, .7, .05, -.3]);
  const clothFill = (g, x0, x1, rgb) => gradient(g, x0, 0, x1, 0, rgb, [-.45, -.12, .12, -.05, -.25]);
  // A plate with a bright upper bevel and a dark lower edge.
  function plate(g, d, fill, edge) {
    shape(g, d, fill, 0);
    clipped(g, d, () => {
      g.save();
      g.translate(0, 1.1);
      stroke(g, d, 'rgba(255,248,230,.75)', 1.4);
      g.restore();
    });
    stroke(g, d, edge || OUTLINE, 1.25);
  }

  // ---------------------------------------------------------------- shared body pieces
  // Round filler under a knee, elbow or hip, so a bent limb shows no notch between its two parts.
  const round = (x, y, rx, ry = rx) => `M${x - rx},${y} a${rx},${ry} 0 1 0 ${rx * 2},0 a${rx},${ry} 0 1 0 ${-rx * 2},0 Z`;
  const clothJoint = (g, rx, rgb, ry = rx) => shape(g, round(0, 0, rx, ry), clothFill(g, -rx, rx, rgb), 1.2);
  const mailJoint = (g, rx, ry = rx) => mail(g, round(0, 0, rx, ry), [-rx - 1, -ry - 1, rx + 1, ry + 1]);
  function face(g, beard) {
    const skin = 'M-9,-8 C-8,-16 6,-18 11,-9 L12,-3 L16,4 L12.5,5.5 L13,9 L11,10.5 L12,13 C10,19 2,20 -3,16 L-9,9 Z';
    shape(g, skin, gradient(g, -12, 8, 14, -6, SKIN, [-.4, -.12, .08, .2]));
    stroke(g, 'M2,-5 Q7,-7.5 12,-4.5', tone(SKIN, -.65), 1.6);
    shape(g, 'M4.5,-2.2 Q8,-4 10.5,-2 Q7.5,-.4 4.5,-2.2 Z', '#f1e6d6', .55);
    disc(g, 8.4, -2.1, 1.15, '#2c1c14', 0);
    stroke(g, 'M12,5.5 Q10.5,7 11.8,8', tone(SKIN, -.45), .7);
    stroke(g, 'M7,9.6 Q10,10.6 12.6,9.6', '#6e3428', 1);
    stroke(g, 'M3,2 Q6,5 4,9', 'rgba(110,55,35,.35)', 1.4);
    if (beard) {
      shape(g, 'M-6,6 C-1,11 5,9 7,7.5 Q10,9 13,8.5 C14,14 11,22 4,27 C-1,22 -7,17 -6,6 Z',
        gradient(g, -6, 6, 9, 26, beard, [.05, -.2, -.4]), 1);
      for (let i = 0; i < 7; i++) stroke(g, `M${-3 + i * 2.2},${10 + (i % 3)} q1,6 ${-1 + i * .4},${11 - Math.abs(i - 3)}`,
        'rgba(255,248,235,.35)', .55);
      stroke(g, 'M5,8.6 Q9,7.6 13,9', tone(beard, -.35), 1.8);
    } else {
      const random = seeded(31);
      g.fillStyle = 'rgba(55,30,22,.4)';
      for (let i = 0; i < 55; i++) g.fillRect(-1 + random() * 12, 9.5 + random() * 8, .55, .55);
    }
  }

  function strap(g, d, width, rgb = DARKLEATHER) {
    stroke(g, d, OUTLINE, width + 1.4);
    stroke(g, d, tone(rgb, 0), width);
    g.save();
    g.translate(0, -width * .27);
    stroke(g, d, tone(rgb, .22), width * .2);
    g.restore();
  }
  function buckle(g, x, y, w = 7, h = 6.5) {
    shape(g, `M${x - w / 2},${y - h / 2} h${w} v${h} h${-w} Z`, gradient(g, x - w / 2, y - h / 2, x + w / 2, y + h / 2, BRASS, [.55, 0, -.35]), .9);
    shape(g, `M${x - w * .24},${y - h * .24} h${w * .48} v${h * .48} h${-w * .48} Z`, tone(DARKLEATHER, -.2), .6);
    stroke(g, `M${x - w * .1},${y} H${x + w * .45}`, tone(BRASS, .5), 1);
  }
  // Hanging leather strips under a belt.
  function strips(g, rgb, trim, y = 4, length = 24) {
    for (let i = 0; i < 6; i++) {
      const x = -19 + i * 6.4;
      const d = `M${x},${y} L${x + 6},${y} L${x + 7},${y + length - 3} Q${x + 3.8},${y + length + 2} ${x + .4},${y + length - 3} Z`;
      shape(g, d, gradient(g, x, 0, x + 7, 0, rgb, [-.3, .12, -.12]), 1.1);
      stitches(g, `M${x + 1.6},${y + 3} L${x + 2},${y + length - 4}`);
      rivet(g, x + 3.6, y + length - 4.5, 1.15, trim);
    }
  }

  // ---------------------------------------------------------------- plate harness
  const plateSet = {
    box: {
      kneeFill: [-12, -12, 12, 12], knee: [-18, -16, 17, 14], elbowFill: [-11, -11, 11, 11], elbow: [-13, -13, 15, 13],
      pelvis: [-21, -15, 21, 15],
      torso: [-30, -80, 30, 32], head: [-40, -48, 28, 28], upperArm: [-20, -18, 20, 58], forearm: [-16, -14, 16, 58],
      hand: [-11, -11, 13, 12], thigh: [-18, -8, 18, 58], shin: [-17, -16, 20, 55], foot: [-17, -11, 30, 17],
      cape: [-48, -4, 16, 100]
    },
    cape(g, c) {
      const d = 'M-6,0 C-20,8 -26,40 -34,66 C-40,80 -44,88 -45,93 L-36,88 L-31,97 L-22,90 L-14,96 L-6,88 C-4,55 6,22 9,2 Z';
      shape(g, d, gradient(g, -42, 40, 6, 20, c.team, [-.5, -.15, -.35, .05, -.3]));
      for (const fold of ['M-6,6 C-16,30 -22,60 -30,90', 'M0,6 C-6,34 -10,62 -14,92', 'M-10,10 C-24,36 -30,64 -41,88']) {
        stroke(g, fold, 'rgba(20,6,10,.4)', 2.6);
        g.save();
        g.translate(2.4, 0);
        stroke(g, fold, 'rgba(255,214,180,.22)', 1.2);
        g.restore();
      }
      stroke(g, 'M-43,90 L-36,85 L-31,93 L-22,86 L-14,92 L-7,85', tone(c.trim, .1), 1.4);
      wear(g, d, [-44, 0, 8, 95], 90, 'rgba(255,220,190,.14)', 'rgba(20,5,8,.2)', 11, 3);
    },
    torso(g, c) {
      mail(g, 'M-19,-52 L16,-54 L20,-4 L22,20 L-21,20 L-18,-4 Z', [-23, -58, 24, 22]);
      strips(g, c.team, c.brass, 5, 23);
      // Backplate edge, then the breastplate.
      plate(g, 'M-17,-64 C-25,-56 -23,-30 -17,-14 L-8,-14 L-6,-64 Z', plateFill(g, -24, 4, c.iron));
      const chest = 'M-15,-67 C-4,-72 10,-70 16,-62 C25,-50 24,-32 16,-18 L12,-10 C2,-6 -8,-7 -15,-11 C-18,-30 -19,-50 -15,-67 Z';
      plate(g, chest, gradient(g, -18, -20, 24, -52, c.steel, [-.55, -.25, .05, .72, .15, -.2]));
      wear(g, chest, [-16, -68, 22, -12], 70, 'rgba(255,255,255,.4)', 'rgba(30,30,45,.3)', 3);
      stroke(g, 'M3,-69 C16,-52 17,-32 9,-10', 'rgba(255,252,240,.8)', 1.1);
      stroke(g, 'M1.4,-69 C14,-52 15,-32 7,-10', 'rgba(20,20,35,.4)', .9);
      // Raised pectoral lines and an engraved sunburst.
      stroke(g, 'M-14,-47 C-6,-36 8,-36 19,-48', 'rgba(30,25,40,.55)', 1);
      stroke(g, 'M-14,-45.6 C-6,-34.6 8,-34.6 19,-46.6', 'rgba(255,250,235,.55)', .7);
      g.save();
      g.translate(3, -51);
      for (let i = 0; i < 12; i++) {
        g.rotate(Math.PI / 6);
        shape(g, `M-1.1,-4 L0,${i % 2 ? -8 : -11} L1.1,-4 Z`, tone(c.brass, .15), .45);
      }
      disc(g, 0, 0, 4.6, gradient(g, -4, -4, 4, 4, c.brass, [.6, 0, -.35]), .9);
      disc(g, 0, 0, 2.1, tone(c.team, .1), .6);
      g.restore();
      // Trim along neckline and lower edge.
      stroke(g, 'M-14,-65 C-4,-70 9,-68 15,-60', tone(c.brass, .1), 2.8);
      stroke(g, 'M-14,-14 C-6,-10 4,-9 12,-13', tone(c.brass, .1), 2.8);
      for (let i = 0; i < 6; i++) rivet(g, -12 + i * 5, -66 - Math.sin(i / 5 * Math.PI) * 2.6, 1, c.brass);
      rivet(g, -12, -52, 1.25, c.brass);
      rivet(g, -12, -22, 1.25, c.brass);
      // Fauld lames.
      for (let i = 0; i < 3; i++) {
        const y = -13 + i * 5.2;
        plate(g, `M${-17 - i},${y} Q0,${y + 4.5} ${15 + i * 1.6},${y - 2} L${16 + i * 1.6},${y + 4} Q0,${y + 11} ${-18 - i},${y + 6} Z`,
          plateFill(g, -20, 20, c.steel));
        rivet(g, -13, y + 4.3, .9, c.brass);
        rivet(g, 11, y + 3.4, .9, c.brass);
      }
      strap(g, 'M-20,3 Q0,10 19,1', 6);
      buckle(g, 8, 6.4, 8, 8);
      for (const x of [-13, -6]) rivet(g, x, 5.6, 1.1, c.brass);
      // Gorget.
      plate(g, 'M-12,-68 Q0,-60 12,-68 L10,-76 Q0,-72 -10,-76 Z', plateFill(g, -12, 12, c.steel));
      stroke(g, 'M-10.5,-69.5 Q0,-63 10.5,-69.5', tone(c.brass, 0), 1.2);
    },
    head(g, c) {
      // Horsehair crest behind the dome, in team colors.
      const crest = 'M11,-23 C6,-44 -22,-47 -33,-28 C-40,-16 -37,-2 -34,12 C-31,1 -29,0 -27,5 C-29,-10 -24,-17 -16,-20 C-6,-24 4,-22 11,-23 Z';
      shape(g, crest, gradient(g, -30, -45, -8, -10, c.team, [.35, .05, -.3]));
      for (let i = 0; i < 24; i++) {
        const t = i / 23;
        stroke(g, `M${9 - t * 24},${-24 - Math.sin(t * Math.PI) * 6} C${-8 - t * 24},${-45 + t * 20} ${-32 - t * 6},${-28 + t * 26} ${-33 - t * 1},${-8 + t * 16}`,
          i % 3 ? 'rgba(255,200,160,.3)' : 'rgba(30,5,5,.38)', .6);
      }
      plate(g, 'M8,-22 C2,-27 -9,-27 -15,-20 L-12,-17 C-6,-22 2,-22 8,-19 Z', gradient(g, 0, -27, 0, -17, c.brass, [.45, -.25]));
      const dome = 'M-18,3 C-21,-14 -11,-23 2,-23 C13,-23 19,-13 19,-3 L19,3 L-6,6 Z';
      plate(g, dome, gradient(g, -18, 4, 14, -20, c.steel, [-.55, -.2, .15, .75, .1]));
      wear(g, dome, [-18, -22, 18, 4], 30, 'rgba(255,255,255,.45)', 'rgba(30,30,45,.3)', 5, 3);
      stroke(g, 'M-14,-12 C-8,-20 4,-21 12,-15', 'rgba(255,252,240,.65)', 1.2);
      // Neck guard and face plate.
      plate(g, 'M-18,0 C-20,8 -24,14 -26,18 L-9,17 L-6,4 Z', plateFill(g, -26, -4, c.iron));
      const visor = 'M-5,-5 L19,-6 L22,3 C22,12 17,19 8,22 L-4,18 C-8,10 -8,2 -5,-5 Z';
      plate(g, visor, gradient(g, -8, 16, 20, -2, c.steel, [-.5, -.15, .25, .55, -.1]));
      shape(g, 'M3,-2.6 L19.5,-3.4 L20,.6 L11,1.4 L3,.8 Z', '#0c0809', .8);
      disc(g, 13, -.9, .9, '#f4c07a', 0);
      for (let i = 0; i < 4; i++) shape(g, `M${7 + i * 3.4},${6.5 - i * .2} l1.5,.1 l-1.8,8 l-1.4,-.2 Z`, '#181012', .4);
      for (let i = 0; i < 5; i++) disc(g, -2 + i * .4, 5 + i * 2.7, .75, '#181012', 0);
      // Brow band and cheek hinge.
      plate(g, 'M-19,-8 Q2,-12 21,-7.5 L21,-3.6 Q2,-7.5 -19,-3.5 Z', gradient(g, 0, -11, 0, -3, c.brass, [.5, 0, -.3]));
      for (let i = 0; i < 6; i++) rivet(g, -15 + i * 6.6, -7.2 - Math.sin((i + .5) / 6 * Math.PI) * 1.8, .8, c.steel);
      disc(g, -6.5, 5, 3.6, gradient(g, -10, 2, -3, 9, c.brass, [.55, -.3]), 1);
      rivet(g, -6.5, 5, 1.3, c.iron);
      stroke(g, 'M-4,18.6 L8,22 C15,20 19,15 21,9', tone(c.brass, -.05), 1.6);
    },
    upperArm(g, c) {
      mail(g, 'M-9.5,2 Q0,-4 9.5,2 L8,46 Q0,51 -8,46 Z', [-11, -5, 11, 52]);
      shape(g, 'M-9,31 L9,31 L8,40 L-8,40 Z', clothFill(g, -9, 9, c.team), .9);
      // Three overlapping pauldron lames, drawn bottom up.
      for (let i = 2; i >= 0; i--) {
        const y = -10 + i * 9;
        const w = 17 - i * 2.4;
        const d = `M${-w},${y + 9} C${-w - 1},${y - 6} ${w + 1},${y - 6} ${w},${y + 9} Q0,${y + 17 - i} ${-w},${y + 9} Z`;
        plate(g, d, plateFill(g, -w, w, c.steel));
        stroke(g, `M${-w + 1},${y + 8.4} Q0,${y + 15.6 - i} ${w - 1},${y + 8.4}`, tone(c.brass, i ? -.05 : .12), 1.7);
        rivet(g, -w + 4, y + 6, .95, c.brass);
        rivet(g, w - 4, y + 6, .95, c.brass);
      }
      wear(g, 'M-16,0 C-16,-18 16,-18 16,0 Z', [-15, -14, 15, 2], 16, 'rgba(255,255,255,.5)', 'rgba(30,30,45,.35)', 17, 3);
      disc(g, 0, -1, 3.2, gradient(g, -3, -4, 3, 2, c.brass, [.6, -.3]), .9);
    },
    forearm(g, c) {
      mail(g, 'M-8,-3 L8,-3 L6.5,40 L-6.5,40 Z', [-9, -5, 9, 42]);
      const vambrace = 'M-9,9 Q0,5 9,9 L7,41 Q0,44 -7,41 Z';
      plate(g, vambrace, plateFill(g, -9, 9, c.steel));
      stroke(g, 'M2.5,8 L2,42', 'rgba(255,250,235,.75)', 1);
      stroke(g, 'M1.2,8 L.8,42', 'rgba(20,20,35,.4)', .8);
      for (const y of [17, 31]) {
        strap(g, `M-8.4,${y} Q0,${y + 3} 8.2,${y - .4}`, 2.8);
        rivet(g, -4, y + 1.2, .9, c.brass);
      }
      wear(g, vambrace, [-9, 9, 9, 42], 18, 'rgba(255,255,255,.4)', 'rgba(30,30,45,.3)', 23, 3);
      // Gauntlet cuff.
      plate(g, 'M-7,39 L7,39 L10,50 Q0,54 -10,50 Z', plateFill(g, -10, 10, c.steel));
      stroke(g, 'M-9,49 Q0,52.6 9,49', tone(c.brass, 0), 1.5);
    },
    hand(g, c) {
      plate(g, 'M-8,-6 C-3,-10 6,-9 9,-4 C11,1 9,8 3,9 L-5,8 C-9,4 -10,-2 -8,-6 Z', plateFill(g, -9, 10, c.steel));
      for (let i = 0; i < 4; i++) {
        stroke(g, `M${-5 + i * 3.7},-7.6 Q${-3 + i * 3.7},0 ${-5.4 + i * 3.4},8`, OUTLINE, .8);
        rivet(g, -3.4 + i * 3.6, -4.6, .75, c.brass);
      }
      stroke(g, 'M-8,1 Q1,3.5 9.5,.5', tone(c.brass, 0), 1.2);
    },
    thigh(g, c) {
      mail(g, 'M-12,-2 Q0,-8 13,-2 L9,52 Q0,56 -9,52 Z', [-14, -9, 15, 57]);
      const cuisse = 'M-7,8 Q3,3 13,8 L10.5,45 Q3,50 -6,45 C-9,32 -10,20 -7,8 Z';
      plate(g, cuisse, plateFill(g, -9, 13, c.steel));
      stroke(g, 'M5,6 L4.5,47', 'rgba(255,250,235,.7)', 1);
      stroke(g, 'M-6,15 Q3,19 11.5,14', tone(c.brass, 0), 1.6);
      stroke(g, 'M-5.5,39 Q3,43 10.5,38', tone(c.brass, 0), 1.6);
      for (const y of [12, 42]) rivet(g, -4, y, .95, c.brass);
      wear(g, cuisse, [-8, 8, 12, 46], 22, 'rgba(255,255,255,.4)', 'rgba(30,30,45,.3)', 29, 3.5);
      strap(g, 'M-11,24 L-6.5,25', 3);
    },
    shin(g, c) {
      mail(g, 'M-9,-3 L9,-3 L6,50 L-6,50 Z', [-10, -4, 10, 52]);
      const greave = 'M-9,7 Q2,2 11,7 C13,18 10,32 8,50 Q0,53 -6,50 C-8,36 -11,22 -9,7 Z';
      plate(g, greave, plateFill(g, -10, 12, c.steel));
      stroke(g, 'M4.5,6 C7,20 4,34 2,51', 'rgba(255,250,235,.8)', 1.1);
      stroke(g, 'M3,6 C5.5,20 2.5,34 .5,51', 'rgba(20,20,35,.4)', .9);
      stroke(g, 'M-7,11 Q2,15 10,10', tone(c.brass, 0), 1.6);
      for (const y of [22, 40]) {
        strap(g, `M-9.4,${y} L-4,${y + 1.2}`, 3);
        rivet(g, -2.4, y + 1.4, .95, c.brass);
      }
      wear(g, greave, [-9, 8, 11, 49], 24, 'rgba(255,255,255,.4)', 'rgba(30,30,45,.3)', 37, 3.5);
    },
    kneeFill: g => mailJoint(g, 9.6),
    elbowFill: g => mailJoint(g, 8.4),
    pelvis: g => mailJoint(g, 17, 12),
    // Knee and elbow guards turn halfway between the two limb parts.
    knee(g, c) {
      plate(g, 'M-7,-8 C3,-14 15,-8 14,1 C13,8 7,11 0,10 C-8,9 -11,-2 -7,-8 Z', plateFill(g, -10, 14, c.steel));
      plate(g, 'M-4,-4 C-12,-9 -16,-1 -13,4 C-10,8 -5,6 -3,3 Z', plateFill(g, -15, -2, c.iron));
      stroke(g, 'M-6,6 C1,10 9,8 13,2', tone(c.brass, 0), 1.5);
      disc(g, 3, -2, 3, gradient(g, 0, -5, 6, 1, c.brass, [.6, -.3]), .9);
    },
    elbow(g, c) {
      plate(g, 'M-3,-7 C8,-10 13,-2 11,5 L5,9 C-4,11 -10,6 -9,0 Z', plateFill(g, -10, 13, c.steel));
      disc(g, 0, .5, 4.4, gradient(g, -4, -4, 4, 4, c.brass, [.6, 0, -.35]), 1);
      disc(g, 0, .5, 1.6, tone(c.iron, 0), .6);
    },
    foot(g, c) {
      shape(g, 'M-12,10 L25,10.5 L24,14.5 L-11,14.5 Z', tone(DARKLEATHER, -.35), 1.1);
      const boot = 'M-11,-6 Q0,-10 8,-5 C13,1 22,2 27,7 Q28,11 23,11.4 L-12,11 C-14,4 -13,-1 -11,-6 Z';
      plate(g, boot, gradient(g, 0, -9, 4, 12, c.steel, [.55, .1, -.25, -.45]));
      for (const x of [3, 9, 15, 20.5]) {
        stroke(g, `M${x - 3},${-5.5 + x * .42} Q${x + 3},${2 + x * .2} ${x},11`, OUTLINE, .9);
        stroke(g, `M${x - 1.9},${-5.2 + x * .42} Q${x + 4.1},${2.2 + x * .2} ${x + 1.1},10.6`, 'rgba(255,248,230,.55)', .65);
      }
      stroke(g, 'M-11.5,2 Q0,0 8,-5', tone(c.brass, 0), 1.7);
      rivet(g, -4, 1.6, 1.1, c.brass);
    }
  };

  // ---------------------------------------------------------------- hunter's leathers
  const leatherSet = {
    box: {
      kneeFill: [-12, -12, 12, 12], knee: [-7, -13, 16, 12], elbowFill: [-10, -10, 10, 10], pelvis: [-21, -15, 21, 15],
      torso: [-30, -82, 30, 34], head: [-30, -34, 30, 32], upperArm: [-19, -16, 19, 56], forearm: [-13, -9, 13, 56],
      hand: [-11, -11, 13, 12], thigh: [-17, -9, 17, 58], shin: [-15, -9, 17, 55], foot: [-17, -12, 30, 17],
      cape: [-46, -34, 14, 50]
    },
    // Quiver and a short cloak, behind the body.
    cape(g, c) {
      shape(g, 'M-4,-2 C-16,6 -24,22 -31,44 L-23,39 L-19,47 L-12,40 L-6,44 C-2,26 4,10 8,0 Z',
        gradient(g, -30, 30, 6, 10, c.team, [-.55, -.3, -.45, -.2]));
      stroke(g, 'M-6,6 C-12,18 -18,30 -23,38', 'rgba(15,4,8,.4)', 2);
      for (let i = 0; i < 4; i++) {
        const x = -37 + i * 4.6;
        const y = -26 + i * 1.6 + (i % 2) * 3;
        stroke(g, `M${x},${y} L${x + 10},${y + 24}`, tone(WOOD, .25), 1.6);
        shape(g, `M${x - 1},${y - 5} L${x + 4},${y + 2} L${x + 4.6},${y + 11} L${x + .2},${y + 5} Z`,
          i % 2 ? tone(c.trim, .15) : '#e8dfc8', .8);
        shape(g, `M${x - 1},${y - 5} L${x - 3},${y + 3} L${x + .4},${y + 8} L${x + .2},${y + 5} Z`, '#cfc3a6', .7);
        stroke(g, `M${x - 1},${y - 5} L${x + 3.6},${y + 9}`, OUTLINE, .7);
      }
      const quiver = 'M-37,-6 L-22,-13 L-4,30 Q-8,38 -18,36 Z';
      shape(g, quiver, gradient(g, -34, 6, -14, -2, DARKLEATHER, [-.2, .22, -.1]));
      stitches(g, 'M-33,-3 L-15,32');
      stroke(g, 'M-37,-4 L-21,-11', tone(BRASS, -.05), 3);
      stroke(g, 'M-22,32 L-6,26', tone(BRASS, -.05), 3);
      wear(g, quiver, [-37, -12, -4, 37], 40, 'rgba(255,220,180,.18)', 'rgba(10,4,2,.28)', 41, 2.5);
    },
    torso(g, c) {
      strips(g, c.main, BRASS, 5, 22);
      const jerkin = 'M-13,-68 C-3,-71 8,-70 14,-63 C21,-52 21,-34 15,-20 L16,6 Q0,12 -16,6 L-15,-16 C-21,-34 -20,-54 -13,-68 Z';
      shape(g, jerkin, clothFill(g, -21, 21, c.main));
      wear(g, jerkin, [-20, -70, 20, 10], 200, 'rgba(255,214,170,.17)', 'rgba(20,8,2,.24)', 13, 2.2);
      // Shaped chest panel with stitched seams and rows of studs.
      shape(g, 'M-3,-66 C8,-66 17,-52 15,-36 L11,-22 Q3,-18 -6,-22 C-10,-38 -9,-54 -3,-66 Z', clothFill(g, -9, 17, c.light), 1);
      stitches(g, 'M-1,-62 C8,-60 14,-50 12,-37 L9,-25 Q3,-22 -4,-25 C-7,-38 -6,-52 -1,-62');
      for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) rivet(g, -2 + i * 5 + row * .4, -52 + row * 8 + i * .6, 1.15, STEEL);
      stitches(g, 'M-14,-60 C-17,-40 -14,-22 -11,-14 L-12,4');
      // Cross strap for the quiver, then belt, sash and pouches.
      strap(g, 'M-14,-64 C-4,-44 6,-26 16,-10', 5.4);
      buckle(g, -1.4, -42, 7.4, 7);
      for (const [x, y] of [[-10, -57], [8, -24], [12.6, -17]]) rivet(g, x, y, 1.15);
      shape(g, 'M-17,-12 Q0,-6 17,-13 L17,-4 Q0,4 -17,-3 Z', clothFill(g, -17, 17, c.team), 1.1);
      for (let i = 0; i < 4; i++) stroke(g, `M-16,${-10 + i * 2.2} Q0,${-4 + i * 2.2} 16,${-11 + i * 2.2}`, 'rgba(20,5,8,.3)', .6);
      shape(g, 'M-6,-3 L0,-2 L-3,18 L-7,14 L-10,17 Z', clothFill(g, -10, 0, c.team), 1);
      strap(g, 'M-18,2 Q0,9 18,1', 4.6, LEATHER);
      buckle(g, 9, 5.2, 7, 7);
      for (const [x, y, w] of [[-18, 6, 9], [-7.6, 8, 7]]) {
        shape(g, `M${x},${y} h${w} l-.6,9 q${-w / 2},4 ${-w + 1.2},0 Z`, gradient(g, x, y, x + w, y + 10, LEATHER, [.2, -.1, -.35]), 1);
        shape(g, `M${x - .5},${y} h${w + 1} v3 q${-w / 2},3 ${-w - 1},0 Z`, tone(LEATHER, .1), .9);
        rivet(g, x + w / 2, y + 3.8, .9);
      }
      // Fur mantle: layered tufts.
      const random = seeded(19);
      shape(g, 'M-19,-62 C-20,-76 -4,-78 4,-72 C12,-76 21,-68 17,-60 C6,-55 -8,-54 -19,-62 Z', tone([116, 96, 74], -.15), 1.1);
      for (let i = 0; i < 90; i++) {
        const t = random();
        const x = -17 + t * 33 + (random() - .5) * 3;
        const y = -74 + random() * 13 + Math.abs(t - .5) * 5;
        shape(g, `M${x - 1.5},${y} Q${x - 1},${y + 4} ${x - 2.6},${y + 6.5 + random() * 2} Q${x + 1},${y + 4} ${x + 1.6},${y} Z`,
          tone([150, 126, 96], (random() - .45) * .65), .3, 'rgba(40,24,12,.55)');
      }
      buckle(g, 9, -59, 5.5, 5.5);
    },
    head(g, c) {
      // Back of the hood.
      shape(g, 'M-4,-24 C-20,-24 -25,-8 -22,6 C-21,14 -24,20 -27,26 C-14,26 -6,20 -3,12 L6,-18 Z',
        gradient(g, -25, 0, 0, -10, c.dark, [-.35, .1, -.2]));
      face(g);
      stroke(g, 'M-7,-10 C-1,-14 7,-14 12,-9', tone([88, 52, 30], 0), 3.4);
      stroke(g, 'M-6,-8 C-7,0 -5,8 -2,12', tone([88, 52, 30], -.1), 3);
      // War paint under the eye.
      stroke(g, 'M2,1.6 L11,2.4', c.teamCss, 1.8);
      // Hood over the brow.
      const hood = 'M-8,16 C-14,6 -12,-8 -2,-14 C4,-17 11,-15 16,-8 C18,-18 8,-28 -4,-27 C-18,-26 -26,-12 -23,2 C-21,12 -16,18 -8,16 Z';
      shape(g, hood, gradient(g, -22, 8, 8, -24, c.main, [-.45, -.15, .22, -.05]));
      wear(g, hood, [-26, -28, 18, 18], 70, 'rgba(255,214,170,.18)', 'rgba(20,8,2,.25)', 43, 2);
      stroke(g, 'M-8,14.4 C-13,5 -11,-7 -1.6,-12.4 C4,-15.4 11,-13.8 15,-8', tone(c.trim, 0), 1.5);
      stitches(g, 'M-12,14 C-18,4 -16,-10 -4,-17 C3,-21 10,-19 14,-14');
      stroke(g, 'M-12,-20 C-18,-10 -18,2 -15,10', 'rgba(20,8,4,.35)', 1.8);
      // Scarf.
      shape(g, 'M-12,13 C-2,20 8,20 14,13 L13,21 C4,28 -8,27 -16,21 Z', clothFill(g, -16, 14, c.team), 1.1);
      stroke(g, 'M-13,18 C-3,24 7,23 13,17', 'rgba(20,5,8,.35)', 1);
    },
    upperArm(g, c) {
      const arm = 'M-8.5,-2 Q0,-9 9,-2 C12,12 10,24 6.5,46 Q0,50 -6.5,46 C-9,28 -11,12 -8.5,-2 Z';
      shape(g, arm, gradient(g, -11, 0, 11, 0, SKIN, [-.42, -.08, .18, .05, -.2]));
      stroke(g, 'M2,17 C8,24 7,33 3,40', 'rgba(110,52,30,.35)', 1.3);
      stroke(g, 'M-5,14 C0,20 5,19 9,14', 'rgba(110,52,30,.3)', 1);
      shape(g, 'M-8.4,28 Q0,31 8.4,28 L8,34 Q0,37 -8,34 Z', clothFill(g, -9, 9, c.team), .9);
      // Layered leather shoulder guard.
      for (let i = 2; i >= 0; i--) {
        const y = -8 + i * 7;
        const w = 15 - i * 2;
        const d = `M${-w},${y + 8} C${-w},${y - 7} ${w},${y - 7} ${w},${y + 8} Q0,${y + 15} ${-w},${y + 8} Z`;
        shape(g, d, clothFill(g, -w, w, i % 2 ? c.main : c.light), 1.2);
        stitches(g, `M${-w + 2},${y + 6.4} Q0,${y + 12.4} ${w - 2},${y + 6.4}`);
        rivet(g, -w + 4, y + 4, 1, STEEL);
        rivet(g, w - 4, y + 4, 1, STEEL);
        wear(g, d, [-w, y - 5, w, y + 13], 14, 'rgba(255,220,180,.2)', 'rgba(20,8,2,.3)', 47 + i, 2);
      }
    },
    forearm(g, c) {
      shape(g, 'M-7,-3 Q0,-8 7,-3 C10,8 8,22 5,48 L-5,48 C-7,28 -9,10 -7,-3 Z',
        gradient(g, -9, 0, 9, 0, SKIN, [-.42, -.08, .18, .05, -.2]));
      const bracer = 'M-8.6,10 Q0,14 8.6,10 L6.4,45 Q0,48 -6.4,45 Z';
      shape(g, bracer, clothFill(g, -9, 9, c.main), 1.2);
      wear(g, bracer, [-9, 10, 9, 47], 45, 'rgba(255,220,180,.2)', 'rgba(20,8,2,.3)', 53, 2);
      stroke(g, 'M-7.8,14 Q0,18 7.8,14', tone(c.main, -.4), 2.2);
      stroke(g, 'M-6.6,41 Q0,44.4 6.6,41', tone(c.main, -.4), 2.2);
      for (let i = 0; i < 4; i++) {
        const y = 18 + i * 5.6;
        stroke(g, `M-1,${y} L5,${y + 4.4} M5,${y} L-1,${y + 4.4}`, '#e3c590', .9);
        rivet(g, -1.2, y, .75, STEEL);
        rivet(g, 5.2, y, .75, STEEL);
      }
    },
    hand(g) {
      shape(g, 'M-7.6,-6 C-3,-9 6,-8 8.6,-3 C10,2 8,8 3,8.6 L-5,7.6 C-9,4 -9.4,-2 -7.6,-6 Z',
        gradient(g, -8, 6, 8, -6, LEATHER, [-.3, .05, .3]));
      for (let i = 0; i < 3; i++) stroke(g, `M${-2.4 + i * 3.8},-6.6 Q${-.8 + i * 3.8},0 ${-2.8 + i * 3.4},7.4`, OUTLINE, .75);
      shape(g, 'M-3,-8 L8,-6 L8.6,-2.6 L-2,-3.6 Z', tone(SKIN, .02), .8);
      stitches(g, 'M-6,3 Q0,5 6,4');
    },
    thigh(g, c) {
      const leg = 'M-12,-2 Q0,-9 12,-2 C12,18 10,32 8.4,52 Q0,56 -8.4,52 C-10,32 -13,16 -12,-2 Z';
      shape(g, leg, clothFill(g, -13, 13, c.dark), 1.25);
      wear(g, leg, [-13, -6, 13, 55], 80, 'rgba(255,220,180,.13)', 'rgba(10,4,2,.28)', 59, 2.5);
      stitches(g, 'M2,2 C4,18 3,36 2,52');
      stroke(g, 'M-9,34 Q-2,37 4,33 M-8,43 Q-3,45 2,42', 'rgba(15,6,3,.4)', .9);
      strap(g, 'M-12,14 Q0,19 11.4,13', 3.4);
      buckle(g, 4, 16.4, 4.6, 4.6);
      shape(g, 'M3,17 L11,16 L10,29 L5,30 Z', clothFill(g, 3, 11, LEATHER), 1);
      stroke(g, 'M7,17 L7,13', tone(STEEL, .3), 2);
    },
    shin(g, c) {
      shape(g, 'M-9,-3 Q0,-8 9,-3 L8,16 L-8,16 Z', clothFill(g, -9, 9, c.dark), 1.2);
      const boot = 'M-9.6,11 Q0,14 10,10 C12,20 9,30 7,52 Q0,54 -6.6,52 C-8,36 -11,24 -9.6,11 Z';
      shape(g, boot, clothFill(g, -11, 11, LEATHER), 1.25);
      wear(g, boot, [-11, 11, 11, 53], 70, 'rgba(255,220,180,.18)', 'rgba(10,4,2,.28)', 61, 2.2);
      shape(g, 'M-11,9 Q0,13 11.4,8 L12,16 Q0,21 -11,17 Z', clothFill(g, -11, 12, c.light), 1.15);
      stitches(g, 'M-9,15 Q0,18.4 10,13.8');
      for (const y of [27, 40]) {
        strap(g, `M-9,${y} Q0,${y + 3.4} 8.6,${y - 1}`, 3);
        buckle(g, 3.4, y + 1.3, 4.4, 4.4);
      }
      stitches(g, 'M-3,22 C-2,32 -2,40 -2,50');
    },
    kneeFill: (g, c) => clothJoint(g, 9.4, c.dark),
    elbowFill: g => clothJoint(g, 8, SKIN),
    pelvis: (g, c) => clothJoint(g, 17, c.dark, 12),
    knee(g, c) {
      shape(g, 'M-3,-8 C5,-10 12,-4 11,3 L6,8 C0,9 -4,2 -3,-8 Z', gradient(g, -3, 6, 11, -7, c.light, [-.3, 0, .3]), 1.15);
      rivet(g, 4.6, -1, 1.5, STEEL);
    },
    foot(g, c) {
      shape(g, 'M-12,9.6 L25,10 L23.6,14.6 L-11,14.6 Z', tone(DARKLEATHER, -.35), 1.1);
      const boot = 'M-9,-9 Q0,-11 6.6,-8 C9,0 20,1 26,6 Q28,10.4 23,11 L-12,10.6 C-13,2 -12,-4 -9,-9 Z';
      shape(g, boot, gradient(g, 0, -10, 4, 12, LEATHER, [.28, .05, -.2, -.4]), 1.25);
      wear(g, boot, [-12, -10, 26, 11], 36, 'rgba(255,220,180,.2)', 'rgba(10,4,2,.3)', 67, 2);
      stitches(g, 'M-10,7 L22,7.6');
      stroke(g, 'M12,1.6 Q17,5 17.6,10.6', OUTLINE, .8);
      strap(g, 'M-11,0 Q-1,3 8,-3', 2.8);
      buckle(g, -1, 1, 4, 4);
    }
  };

  // ---------------------------------------------------------------- battle robes
  const ROBE_GOLD = [226, 182, 96];
  // A band of embroidered runes between two gold lines.
  function runes(g, x0, x1, y, height, glow, gold) {
    const random = seeded(71);
    stroke(g, `M${x0},${y} H${x1} M${x0},${y + height} H${x1}`, tone(gold, 0), 1.1);
    for (let x = x0 + 2; x < x1 - 3; x += 5.4) {
      const mid = y + height / 2;
      const h = height * .3;
      const pick = Math.floor(random() * 4);
      const d = [
        `M${x},${mid - h} L${x + 3},${mid + h} M${x + 3},${mid - h} L${x},${mid + h}`,
        `M${x},${mid + h} L${x + 1.5},${mid - h} L${x + 3},${mid + h} M${x},${mid} H${x + 3}`,
        `M${x + 1.5},${mid - h} V${mid + h} M${x},${mid - h * .2} L${x + 1.5},${mid - h} L${x + 3},${mid - h * .2}`,
        `M${x + 1.5},${mid - h} L${x + 3},${mid} L${x + 1.5},${mid + h} L${x},${mid} Z`
      ][pick];
      stroke(g, d, glow, .75);
    }
  }
  const robeSet = {
    box: {
      kneeFill: [-11, -11, 11, 11], elbowFill: [-13, -13, 13, 13], pelvis: [-21, -15, 21, 15],
      torso: [-34, -84, 32, 20], head: [-32, -38, 28, 34], upperArm: [-18, -13, 18, 54], forearm: [-22, -8, 18, 58],
      hand: [-11, -11, 13, 12], thigh: [-14, -7, 14, 57], shin: [-12, -7, 13, 55], foot: [-17, -11, 33, 17],
      cape: [-42, -4, 14, 92], skirt: [-46, -8, 42, 92]
    },
    cape(g, c) {
      const d = 'M-6,0 C-18,10 -22,40 -30,64 C-34,76 -38,80 -40,84 C-30,82 -22,88 -12,84 C-6,60 4,24 8,2 Z';
      shape(g, d, gradient(g, -38, 40, 6, 20, c.dark, [-.4, -.1, -.3, -.05]));
      stroke(g, 'M-38,82 C-29,80 -21,85 -13,81.6', tone(c.gold, -.1), 2.2);
      for (const fold of ['M-6,8 C-14,32 -18,58 -28,80', 'M0,8 C-4,34 -9,60 -17,82']) stroke(g, fold, 'rgba(14,6,22,.4)', 2.4);
    },
    skirt(g, c) {
      const d = 'M-17,-5 Q0,2 17,-5 C22,24 30,60 37,82 Q28,89 18,82 Q8,90 -3,83 Q-14,90 -24,83 Q-34,89 -41,80 C-30,52 -23,22 -17,-5 Z';
      shape(g, d, gradient(g, -34, 40, 32, 40, c.main, [-.5, -.15, .15, -.2, .05, .24, -.3]));
      clipped(g, d, () => {
        // Deep folds with a lit ridge beside each.
        for (const [x0, x1] of [[-12, -28], [-5, -11], [3, 8], [10, 24]]) {
          shape(g, `M${x0},0 C${x0 + (x1 - x0) * .2},30 ${x1 - 3},56 ${x1 - 5},90 L${x1 + 3},90 C${x1},56 ${x0 + (x1 - x0) * .4},28 ${x0},0 Z`,
            'rgba(16,6,28,.36)', 0);
          stroke(g, `M${x0 + 1},2 C${x0 + (x1 - x0) * .4 + 2},30 ${x1 + 3},58 ${x1 + 4},90`, 'rgba(215,200,255,.24)', 1.6);
        }
        // Split front panel showing the under-robe.
        shape(g, 'M5,0 C10,28 14,56 15,90 L27,90 C22,56 15,26 12,-1 Z', clothFill(g, 5, 26, c.dark), 1);
        stroke(g, 'M5,0 C10,28 14,56 15,90 M12,-1 C15,26 22,56 27,90', tone(c.gold, 0), 1.4);
        runes(g, -44, 40, 68, 9, c.glow, c.gold);
        for (let x = -38; x < 36; x += 9) disc(g, x, 63, 1.1, tone(c.gold, .1), .4);
      });
      wear(g, d, [-40, 0, 36, 86], 190, 'rgba(220,205,255,.13)', 'rgba(14,4,22,.2)', 73, 2);
      stroke(g, d, OUTLINE, 1.3);
    },
    torso(g, c) {
      const body = 'M-13,-68 C-3,-71 8,-70 13,-62 C19,-50 18,-32 14,-18 L17,6 Q0,12 -17,6 L-14,-18 C-19,-36 -19,-54 -13,-68 Z';
      shape(g, body, clothFill(g, -19, 19, c.main));
      wear(g, body, [-19, -70, 19, 10], 150, 'rgba(220,205,255,.14)', 'rgba(14,4,22,.22)', 79, 2);
      // Crossed lapels over the under-robe.
      shape(g, 'M0,-68 L12,-64 L8,-28 Z', clothFill(g, 0, 12, c.dark), .9);
      for (const d of ['M-3,-68 C2,-54 8,-40 9,-24', 'M13,-62 C11,-50 8,-36 0,-18']) {
        stroke(g, d, OUTLINE, 6.4);
        stroke(g, d, tone(c.gold, -.22), 4.8);
        stroke(g, d, tone(c.gold, .3), 1.2);
        stitches(g, d, 'rgba(70,40,10,.8)', 1.6);
      }
      stroke(g, 'M-11,-52 C-14,-38 -12,-24 -10,-16', 'rgba(14,6,22,.42)', 2.2);
      stroke(g, 'M12,-46 C13,-36 11,-26 9,-20', 'rgba(14,6,22,.35)', 1.6);
      // Wide sash with hanging ends and a tome on the hip.
      shape(g, 'M-16,-17 Q0,-11 15,-18 L17,0 Q0,7 -17,0 Z', clothFill(g, -17, 17, c.team), 1.2);
      for (let i = 0; i < 4; i++) stroke(g, `M-16,${-13 + i * 3.8} Q0,${-7 + i * 3.8} 16,${-14 + i * 3.8}`, 'rgba(20,5,8,.3)', .7);
      stroke(g, 'M-16,-16.4 Q0,-10.4 15,-17.4 M-17,-1 Q0,6 17,-1', tone(c.gold, 0), 1.2);
      shape(g, 'M4,2 L11,1 L15,19 L9,16 L7,19 Z', clothFill(g, 4, 15, c.team), 1);
      shape(g, 'M-17,3 L-5,6 L-7,19 L-19,16 Z', clothFill(g, -19, -5, DARKLEATHER), 1.2);
      shape(g, 'M-5,6 L-3,7 L-5,19 L-7,19 Z', '#e9dfc4', .7);
      stroke(g, 'M-15.4,5.6 L-17,14.4 M-8,7.6 L-9.6,16.6', tone(c.gold, 0), 1.1);
      disc(g, -11.6, 11, 2.1, c.glow, .6);
      // Shoulder mantle with a scalloped embroidered edge.
      const mantle = 'M-12,-74 C0,-77 13,-72 19,-61 Q18,-54 12,-56 Q8,-50 2,-54 Q-3,-48 -9,-53 Q-14,-49 -20,-55 Q-24,-60 -21,-64 C-20,-70 -16,-73 -12,-74 Z';
      shape(g, mantle, clothFill(g, -22, 19, c.dark), 1.25);
      stroke(g, 'M18,-60 Q17,-55 12,-56.6 Q8,-51 2,-55 Q-3,-49.4 -9,-54.4 Q-14,-50.6 -19.6,-56.4', tone(c.gold, .05), 1.5);
      for (const [x, y] of [[-13, -59], [-3, -58], [6, -59.6]]) {
        shape(g, `M${x},${y - 3.4} L${x + 2},${y} L${x},${y + 2.6} L${x - 2},${y} Z`, tone(c.gold, .1), .5);
      }
      // Amulet.
      stroke(g, 'M-4,-68 Q4,-52 10,-48 M13,-64 Q12,-54 10,-48', tone(c.gold, .1), .9);
      disc(g, 10, -45.6, 4.2, gradient(g, 6, -50, 14, -42, c.gold, [.6, 0, -.35]), 1);
      disc(g, 10, -45.6, 2.3, c.glow, .6);
      disc(g, 10.8, -46.4, .8, '#fff', 0);
    },
    head(g, c) {
      shape(g, 'M-2,-32 C-16,-34 -30,-12 -23,6 C-22,16 -25,22 -29,29 C-16,30 -7,22 -3,12 L8,-20 Z',
        gradient(g, -27, 0, 0, -10, c.dark, [-.3, .08, -.15]));
      face(g, [168, 160, 150]);
      // Shadow cast by the hood.
      clipped(g, 'M-9,-8 C-8,-16 6,-18 11,-9 L13,-1 L-9,1 Z', () => {
        g.fillStyle = 'rgba(24,8,40,.42)';
        g.fillRect(-12, -18, 28, 20);
      });
      disc(g, 8.4, -2.1, 1.1, c.glow, 0);
      const hood = 'M-7,18 C-13,6 -11,-8 -1,-15 C5,-18 12,-16 17,-8 C22,-16 17,-26 6,-29 C2,-35 -9,-36 -17,-32 C-14,-31 -12,-29 -11,-27 C-23,-22 -27,-6 -22,8 C-20,15 -14,20 -7,18 Z';
      shape(g, hood, gradient(g, -22, 10, 10, -28, c.main, [-.45, -.15, .22, -.02]));
      wear(g, hood, [-26, -36, 20, 18], 70, 'rgba(220,205,255,.18)', 'rgba(14,4,22,.22)', 83, 2);
      stroke(g, 'M-6.6,16 C-11.6,5 -9.6,-6.6 -.6,-13 C5,-15.8 11,-14.2 15.6,-8', tone(c.gold, 0), 2.4);
      stitches(g, 'M-6.6,16 C-11.6,5 -9.6,-6.6 -.6,-13 C5,-15.8 11,-14.2 15.6,-8', 'rgba(70,40,10,.85)', 1.2);
      stroke(g, 'M-11,-26 C-18,-17 -19,-2 -16,10 M-1,-28 C-7,-26 -11,-22 -13,-18', 'rgba(14,6,22,.4)', 1.8);
      disc(g, 5, -20, 2.4, c.glow, 1);
    },
    upperArm(g, c) {
      const sleeve = 'M-10,-3 Q0,-11 11,-3 C13,14 11,30 11,48 Q0,52 -11,48 C-10,30 -13,14 -10,-3 Z';
      shape(g, sleeve, clothFill(g, -13, 13, c.main));
      wear(g, sleeve, [-12, -8, 12, 50], 55, 'rgba(220,205,255,.16)', 'rgba(14,4,22,.22)', 89, 2);
      stroke(g, 'M-6,10 Q1,22 8,24 M-8,26 Q0,34 7,36 M-7,40 Q1,44 9,42', 'rgba(14,6,22,.4)', 1.4);
      shape(g, 'M-12,5 Q0,9 12,5 L11.6,12 Q0,16 -11.6,12 Z', clothFill(g, -12, 12, c.team), 1);
      stroke(g, 'M-12,5.4 Q0,9.4 12,5.4 M-11.6,11.6 Q0,15.6 11.6,11.6', tone(c.gold, 0), 1);
    },
    forearm(g, c) {
      shape(g, 'M-6,28 L6,28 L4.6,50 L-4.6,50 Z', clothFill(g, -6, 6, c.dark), 1);
      for (const y of [41, 45]) stroke(g, `M-5,${y} Q0,${y + 2} 5,${y}`, tone(c.gold, -.1), 1.3);
      // Wide bell sleeve that drapes below the wrist.
      const bell = 'M-10.6,-3 Q0,-7 11,-3 C13,12 12,26 14,38 Q4,42 -2,41 C-8,46 -14,52 -20,56 C-18,38 -12,16 -10.6,-3 Z';
      shape(g, bell, clothFill(g, -18, 14, c.main), 1.25);
      wear(g, bell, [-18, -5, 14, 52], 55, 'rgba(220,205,255,.16)', 'rgba(14,4,22,.22)', 97, 2);
      stroke(g, 'M-5,4 C-6,20 -11,36 -17,50 M3,8 C4,20 1,30 -3,38', 'rgba(14,6,22,.4)', 1.6);
      stroke(g, 'M13.6,36.4 Q4,40.4 -2,39.4 C-8,44.4 -13,49.6 -18.6,53.4', tone(c.gold, .05), 3);
      stitches(g, 'M13.6,36.4 Q4,40.4 -2,39.4 C-8,44.4 -13,49.6 -18.6,53.4', 'rgba(70,40,10,.85)', 1.5);
    },
    hand(g, c) {
      shape(g, 'M-7,-5.6 C-3,-8.6 5.6,-7.6 8,-3 C9.4,2 8,7 3,8 L-4.6,7 C-8,4 -9,-2 -7,-5.6 Z',
        gradient(g, -8, 6, 8, -6, SKIN, [-.3, .02, .22]));
      for (let i = 0; i < 3; i++) stroke(g, `M${-2 + i * 3.5},-6.4 Q${-.4 + i * 3.5},0 ${-2.4 + i * 3.1},7`, tone(SKIN, -.55), .8);
      stroke(g, 'M1.8,-7 L2.6,-2', tone(c.gold, .1), 1.8);
    },
    kneeFill: (g, c) => clothJoint(g, 8.2, c.dark),
    elbowFill: (g, c) => clothJoint(g, 10.6, c.main),
    pelvis: (g, c) => clothJoint(g, 16, c.dark, 12),
    thigh(g, c) {
      shape(g, 'M-10,-2 Q0,-7 10,-2 L7.6,52 Q0,56 -7.6,52 Z', clothFill(g, -10, 10, c.dark), 1.2);
    },
    shin(g, c) {
      shape(g, 'M-8,-3 Q0,-7 8,-3 L6,50 Q0,53 -6,50 Z', clothFill(g, -8, 8, c.dark), 1.2);
      shape(g, 'M-7.4,24 Q0,27 7.8,23 L6.4,52 Q0,54 -6.4,52 Z', clothFill(g, -8, 8, DARKLEATHER), 1.15);
      for (let i = 0; i < 4; i++) stroke(g, `M-6.4,${29 + i * 6} L6.4,${34 + i * 6}`, tone(c.gold, -.2), 1.1);
    },
    foot(g, c) {
      shape(g, 'M-11,10 L24,10.4 L23,14.4 L-10,14.4 Z', tone(DARKLEATHER, -.4), 1.1);
      const boot = 'M-8,-8 Q0,-10 6,-7 C9,0 18,2 24,4 C28,3 29,0 28.4,-2.4 C33,2 31,10 23,11 L-11,10.6 C-12,2 -11,-3 -8,-8 Z';
      shape(g, boot, gradient(g, 0, -9, 4, 12, DARKLEATHER, [.3, .08, -.15, -.35]), 1.25);
      stroke(g, 'M-9,6 Q6,9 24,7', tone(c.gold, -.1), 1.2);
      stitches(g, 'M-6,-5 Q4,2 18,4.4');
    }
  };

  const sets = { plate: plateSet, leather: leatherSet, robes: robeSet };

  // ---------------------------------------------------------------- weapons and shield
  const weaponArt = {
    sword: {
      box: [-34, -25, 119, 25],
      draw(g, c) {
        const blade = 'M18,-7.4 L70,-6 L96,-5.6 L113,0 L96,5.6 L70,6 L18,7.4 Z';
        shape(g, blade, gradient(g, 0, -7, 0, 7, c.steel, [.15, .75, .3, -.1, .2, -.4]), 1.2);
        shape(g, 'M20,-1.7 L88,-1 L96,0 L88,1 L20,1.7 Z', gradient(g, 0, -1.7, 0, 1.7, c.iron, [-.35, .35]), .45);
        stroke(g, 'M19,-5.6 L95,-4.2 L110,0', 'rgba(255,255,255,.85)', .7);
        // Etched script near the guard and a few nicks along the edge.
        for (let x = 25; x < 48; x += 3.4) stroke(g, `M${x},-.9 l1.4,1.8 l1.2,-1.8`, tone(c.brass, .35), .45);
        stroke(g, 'M58,6.3 l2,-1.6 l1.6,1.5 M82,-5.8 l1.4,1.4 l1.6,-1.4', OUTLINE, .6);
        wear(g, blade, [20, -7, 105, 7], 26, 'rgba(255,255,255,.55)', 'rgba(40,45,60,.35)', 101, 5);
        // Wrapped grip.
        shape(g, 'M-21,-3.8 L15,-4.4 L15,4.4 L-21,3.8 Z', gradient(g, 0, -4, 0, 4, c.grip, [.1, .22, -.4]), 1.1);
        for (let x = -19; x < 12; x += 4.2) stroke(g, `M${x},-4.2 L${x + 4.4},4.2`, tone(DARKLEATHER, -.2), 1.3);
        // Curved crossguard with a set gem.
        const guard = 'M13,-6 C15,-14 13,-19 17,-22.4 C22,-24 24,-20 22,-18 C20,-14 20,-10 22,-5.6 L22,5.6 C20,10 20,14 22,18 C24,20 22,24 17,22.4 C13,19 15,14 13,6 Z';
        shape(g, guard, gradient(g, 13, -20, 23, 20, c.brass, [.65, .1, -.35, .15, -.4]), 1.2);
        disc(g, 18, 0, 3.6, tone(c.iron, -.2), .8);
        disc(g, 18, 0, 2.3, c.teamCss, .5);
        disc(g, 18.7, -.8, .75, '#fff', 0);
        // Pommel.
        disc(g, -26, 0, 6.4, gradient(g, -31, -5, -21, 5, c.brass, [.65, .05, -.45]), 1.2);
        disc(g, -26, 0, 2.5, c.teamCss, .7);
        rivet(g, -32, 0, 1.4);
      }
    },
    staff: {
      box: [-96, -27, 156, 27],
      glow: { x: 132, color: 'blue' },
      draw(g, c) {
        // Gnarled shaft with grain and knots.
        const shaft = 'M-90,-2.6 C-60,-4.6 -30,-2 0,-3.4 C34,-5 66,-1.6 108,-3.8 L110,3.4 C70,5.6 38,2 4,3.6 C-30,5 -62,2 -90,2.8 Z';
        shape(g, shaft, gradient(g, 0, -4.4, 0, 4.4, c.wood, [.1, .28, -.1, -.45]), 1.2);
        wear(g, shaft, [-90, -4, 108, 4], 110, 'rgba(255,216,168,.3)', 'rgba(25,10,2,.4)', 103, 7);
        for (const x of [-52, 36, 74]) {
          g.beginPath();
          g.ellipse(x, .4, 3.2, 1.7, 0, 0, Math.PI * 2);
          g.fillStyle = tone(c.wood, -.45);
          g.fill();
        }
        // Metal ferrule, grip wrap and bands.
        shape(g, 'M-96,0 L-88,-3.6 L-82,-3.8 L-82,3.8 L-88,3.6 Z', gradient(g, 0, -4, 0, 4, c.iron, [.4, 0, -.4]), 1);
        shape(g, 'M-18,-4.4 L14,-4.8 L14,4.8 L-18,4.4 Z', gradient(g, 0, -4.5, 0, 4.5, c.grip, [.1, .25, -.4]), 1);
        for (let x = -16; x < 11; x += 4) stroke(g, `M${x},-4.6 L${x + 4},4.6`, tone(DARKLEATHER, -.15), 1.1);
        for (const x of [-20, 16, 62, 98]) {
          shape(g, `M${x - 2.4},-5 h4.8 v10 h-4.8 Z`, gradient(g, 0, -5, 0, 5, c.brass, [.6, .15, -.4]), .9);
        }
        // Hanging charms.
        stroke(g, 'M98,5 q-3,8 -8,12 M98,5 q1,9 -1,15', tone(DARKLEATHER, .2), .9);
        shape(g, 'M90,15 l3,4 l-4,5 l-2,-5 Z', tone(c.team, .2), .8);
        disc(g, 97, 22, 2.4, tone(c.brass, .2), .8);
        // Claws cradling a faceted crystal.
        for (const side of [-1, 1]) {
          shape(g, `M104,${side * 3} C112,${side * 17} 128,${side * 19} 139,${side * 10} C130,${side * 13} 119,${side * 12} 112,${side * 4} Z`,
            gradient(g, 104, side * 18, 130, side * 3, c.brass, [.45, 0, -.35]), 1.1);
        }
        const crystal = 'M110,0 L119,-10 L138,-8 L154,0 L138,8 L119,10 Z';
        shape(g, crystal, gradient(g, 112, 10, 148, -8, c.crystal, [-.3, .05, .5, .1]), 1.1);
        shape(g, 'M110,0 L119,-10 L129,-2 Z', 'rgba(255,255,255,.45)', 0);
        shape(g, 'M129,-2 L138,-8 L154,0 Z', 'rgba(255,255,255,.65)', 0);
        shape(g, 'M129,-2 L154,0 L138,8 Z', 'rgba(40,20,110,.25)', 0);
        stroke(g, 'M110,0 L129,-2 L154,0 M119,-10 L129,-2 L119,10 M138,-8 L129,-2 L138,8', 'rgba(255,255,255,.75)', .6);
        disc(g, 106, 0, 4.4, gradient(g, 102, -4, 110, 4, c.brass, [.6, -.3]), 1);
      }
    },
    crossbow: {
      box: [-46, -40, 82, 40],
      string: { tip: 47.6, span: 34.4, nock: 9, pull: 27, bolt: 76 },
      draw(g, c) {
        // Carved walnut stock.
        const stock = 'M-42,-4 L-30,-6 C-18,-5 -10,-7 0,-6.4 L72,-4.6 L76,-1 L74,3.6 L8,5 C0,5.6 -4,12 -14,13 L-22,8 C-30,10 -38,13 -43,12 Z';
        shape(g, stock, gradient(g, 0, -7, 0, 13, c.wood, [.25, .05, -.15, -.45]), 1.3);
        wear(g, stock, [-43, -6, 75, 12], 90, 'rgba(255,214,160,.28)', 'rgba(25,10,2,.4)', 107, 9);
        shape(g, 'M-43,-4.4 L-38,-5.2 L-39,12.4 L-43.6,12.2 Z', gradient(g, -43, 0, -38, 0, c.iron, [.3, -.3]), 1);
        // Bolt groove, side plates and trigger.
        shape(g, 'M0,-6.4 L72,-4.8 L72,-2.8 L0,-3.8 Z', tone(c.wood, -.55), .5);
        for (const [x, w] of [[2, 20], [50, 13]]) {
          shape(g, `M${x},-3 h${w} l-2,6.4 h${-w + 4} Z`, gradient(g, 0, -3, 0, 4, c.iron, [.45, 0, -.3]), .9);
          rivet(g, x + 4, 0, 1.1);
          rivet(g, x + w - 4, 0, 1.1);
        }
        stroke(g, 'M5,5 Q4,15 14,14 Q22,12 21,4.6', OUTLINE, 3);
        stroke(g, 'M5,5 Q4,15 14,14 Q22,12 21,4.6', tone(c.brass, 0), 1.6);
        stroke(g, 'M13,4 Q10,9 13,11', tone(c.iron, .3), 1.8);
        stroke(g, 'M-12,-3 q7,3 14,0 M-30,1 q8,4 16,0', tone(c.brass, .2), .8);
        shape(g, 'M26,-2.4 L44,-2 L44,2.6 L26,3 Z', gradient(g, 0, -2, 0, 3, c.grip, [.15, -.3]), .8);
        for (let x = 28; x < 44; x += 3.4) stroke(g, `M${x},-2.4 l2,5.2`, tone(DARKLEATHER, -.2), 1);
        // Recurved steel limbs.
        for (const s of [-1, 1]) {
          shape(g, `M60,${s * 3} C70,${s * 14} 64,${s * 27} 49,${s * 34} L46,${s * 38} L45,${s * 33} C56,${s * 25} 59,${s * 14} 54,${s * 3} Z`,
            gradient(g, 46, s * 36, 68, s * 6, c.steel, [-.4, .05, .55, -.2]), 1.2);
          stroke(g, `M61,${s * 7} C66,${s * 16} 61,${s * 25} 52,${s * 31}`, 'rgba(255,255,255,.7)', .7);
          rivet(g, 47.6, s * 34.4, 1.5);
        }
        shape(g, 'M52,-7 L65,-6 L65,6 L52,7 Z', gradient(g, 0, -7, 0, 7, c.iron, [.4, 0, -.45]), 1.1);
        for (const y of [-3.4, 3.4]) rivet(g, 58.6, y, 1.3);
        stroke(g, 'M72,-7 C84,-8 84,8 72,7', OUTLINE, 3.6);
        stroke(g, 'M72,-7 C84,-8 84,8 72,7', tone(c.iron, .1), 2);
      }
    }
  };

  const shieldArt = { round: {
    box: [-38, -47, 38, 47],
    half: [31, 40],
    draw(g, c) {
      const oval = (rx, ry, fill, line = 1.3) => {
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        if (fill) {
          g.fillStyle = fill;
          g.fill();
        }
        if (line) {
          g.strokeStyle = OUTLINE;
          g.lineWidth = line;
          g.stroke();
        }
      };
      // Wooden edge, iron rim and painted plank face.
      g.save();
      g.translate(-2.6, 0);
      oval(34, 43, tone(DARKLEATHER, -.1));
      g.restore();
      oval(34, 43, gradient(g, -30, 36, 30, -36, IRON, [-.5, -.15, .15, .65, 0]), 1.6);
      oval(29.4, 37.8, gradient(g, -24, 30, 24, -30, c.team, [-.45, -.12, .06, .24, -.1]), 1.2);
      g.save();
      g.beginPath();
      g.ellipse(0, 0, 29, 37.4, 0, 0, Math.PI * 2);
      g.clip();
      for (let x = -22; x < 30; x += 9.4) {
        stroke(g, `M${x},-40 C${x + 1},-12 ${x - 1},14 ${x},40`, 'rgba(25,6,4,.5)', .9);
        stroke(g, `M${x + 1.1},-40 C${x + 2.1},-12 ${x + .1},14 ${x + 1.1},40`, 'rgba(255,224,190,.22)', .6);
      }
      // Painted eight-point star, quarter band and laurel.
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const reach = i % 2 ? 22 : 32;
        const px = Math.cos(a) * reach * .8;
        const py = Math.sin(a) * reach;
        shape(g, `M${Math.cos(a - .5) * 10},${Math.sin(a - .5) * 12} L${px},${py} L${Math.cos(a + .5) * 10},${Math.sin(a + .5) * 12} Z`,
          tone(c.trim, i % 2 ? -.12 : .22), .7, 'rgba(40,10,5,.7)');
      }
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        if (Math.abs(Math.sin(a)) > .96) continue;
        g.save();
        g.translate(Math.cos(a) * 21, Math.sin(a) * 27.5);
        g.rotate(Math.atan2(Math.cos(a) * 27.5, -Math.sin(a) * 21) + (Math.cos(a) > 0 ? .5 : -.5));
        shape(g, 'M-3.4,0 Q0,-2.4 3.4,0 Q0,2.4 -3.4,0 Z', tone(BRASS, i % 2 ? .25 : -.05), .45);
        g.restore();
      }
      // Battle damage: paint chips down to the wood, and a sword cut.
      shape(g, 'M14,-26 l5,3 l-1,5 l-3,-1 l-2,-4 Z', tone(WOOD, .1), .6);
      shape(g, 'M-20,12 l4,1 l1,4 l-4,3 l-2,-4 Z', tone(WOOD, -.05), .6);
      stroke(g, 'M-17,-22 L-3,-8', 'rgba(35,10,5,.8)', 1.5);
      stroke(g, 'M-16,-22.6 L-2.4,-9', 'rgba(255,225,190,.5)', .6);
      g.restore();
      wear(g, 'M-29,0 C-29,-50 29,-50 29,0 C29,50 -29,50 -29,0 Z', [-29, -37, 29, 37], 150, 'rgba(255,232,200,.28)', 'rgba(20,5,2,.32)', 109, 3.4);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2 + .2;
        rivet(g, Math.cos(a) * 31.7, Math.sin(a) * 40.4, 1.7);
      }
      stroke(g, 'M-24,-24 C-14,-36 4,-40 18,-34', 'rgba(255,250,235,.6)', 1.6);
      // Domed boss.
      oval(10.6, 12.4, gradient(g, -9, 10, 9, -10, BRASS, [-.45, 0, .35]), 1.3);
      g.save();
      g.translate(1.6, 0);
      oval(7, 8.6, gradient(g, -6, 7, 6, -7, STEEL, [-.5, -.05, .75]), 1);
      g.restore();
      disc(g, 4, -3.6, 1.8, 'rgba(255,255,255,.9)', 0);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        rivet(g, Math.cos(a) * 9, Math.sin(a) * 10.6, .85, STEEL);
      }
    }
  } };

  // ---------------------------------------------------------------- baking
  const cache = new Map();
  const stats = { sprites: 0, bytes: 0, bakeMs: 0 };
  let bakedScale = 0;

  function bake(box, draw, ppc, dim) {
    const [x0, y0, x1, y1] = box;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((x1 - x0) * ppc);
    canvas.height = Math.ceil((y1 - y0) * ppc);
    const g = canvas.getContext('2d');
    g.scale(ppc, ppc);
    g.translate(-x0, -y0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g);
    if (dim) {
      // Far-side limbs are shaded so the near side stands out.
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(30,12,24,.34)';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    stats.sprites++;
    stats.bytes += canvas.width * canvas.height * 4;
    return { image: canvas, x: x0, y: y0, w: canvas.width / ppc, h: canvas.height / ppc, frost: null };
  }

  const rgbCss = rgb => 'rgb(' + rgb.join(',') + ')';
  // Colors a painter can use. An armor kit or special overrides any of the materials.
  function palette(team, trim, base, overrides) {
    const c = {
      team, trim, main: base, grip: team, steel: STEEL, iron: IRON, brass: BRASS, wood: WOOD, gold: ROBE_GOLD,
      glow: '#9fe4ff', crystal: [128, 148, 244], ...overrides
    };
    c.light = c.main.map(v => Math.min(255, Math.round(v * 1.2 + 8)));
    c.dark = c.main.map(v => Math.round(v * .62));
    c.teamCss = rgbCss(team.map(v => Math.min(255, Math.round(v + (255 - v) * .12))));
    return c;
  }

  function lookup(key, build) {
    let entry = cache.get(key);
    if (!entry) {
      const started = performance.now();
      entry = build();
      cache.set(key, entry);
      stats.bakeMs += performance.now() - started;
    }
    return entry;
  }

  // Sprites are baked at the size they appear on screen; a resize rebakes them.
  function prepare(pixelsPerMetre) {
    const wanted = Math.ceil(pixelsPerMetre * 1.1 / 4) * 4;
    if (wanted === bakedScale) return;
    bakedScale = wanted;
    cache.clear();
    stats.sprites = stats.bytes = stats.bakeMs = 0;
  }

  function bodySprites(style, team, trim, base) {
    return lookup(['body', style, team, trim, base].join(), () => {
      const set = sets[style];
      const colors = palette(team, trim, base, set.colors);
      // A set has no sprite for a joint it leaves uncovered.
      const part = (name, dim) => set[name] ? bake(set.box[name], g => set[name](g, colors), bakedScale / 100, dim) : null;
      const limbs = ['upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'kneeFill', 'knee', 'elbowFill', 'elbow'];
      return {
        torso: part('torso'), head: part('head'), cape: part('cape'), skirt: part('skirt'), pelvis: part('pelvis'),
        near: Object.fromEntries(limbs.map(name => [name, part(name)])),
        far: Object.fromEntries(limbs.map(name => [name, part(name, true)]))
      };
    });
  }
  // part is the haft by default; a flail also has a ball.
  const weaponSprite = (key, team, trim, part = 'draw') => lookup(['weapon', key, part, team, trim].join(), () => {
    const art = weaponArt[key];
    const colors = palette(team, trim, LEATHER, art.colors);
    const piece = part === 'draw' ? art : art[part];
    return bake(piece.box, g => {
      piece.draw(g, colors);
      if (part === 'draw') art.extra?.(g, colors);
    }, bakedScale / 100);
  });
  const shieldSprite = (key, team, trim) => lookup(['shield', key, team, trim].join(), () =>
    bake(shieldArt[key].box, g => shieldArt[key].draw(g, palette(team, trim, LEATHER)), bakedScale / 100));
  const glows = {
    blue: ['200,235,255', '120,160,255'], teal: ['220,255,245', '80,210,200'], sun: ['255,244,200', '255,170,60']
  };
  const glowSprite = name => lookup('glow' + name, () => bake([-30, -30, 30, 30], g => {
    const [core, halo] = glows[name];
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    glow.addColorStop(0, `rgba(${core},.75)`);
    glow.addColorStop(.35, `rgba(${halo},.34)`);
    glow.addColorStop(1, `rgba(${halo},0)`);
    g.fillStyle = glow;
    g.fillRect(-30, -30, 60, 60);
  }, bakedScale / 200));

  // ---------------------------------------------------------------- cloth
  // Capes and skirts trail the body on a damped spring, so they swing out on a lunge and settle after.
  // Drawing only, and kept here so the simulation never sees it.
  const drapes = new WeakMap();
  function drapeSwing(owner, forward, rest, clock) {
    let drape = drapes.get(owner);
    const dt = drape ? clock - drape.clock : -1;
    // A new bout or a long gap starts the cloth at rest. A paused frame (dt 0) leaves it as it is.
    if (dt < 0 || dt > .25) {
      drape = { clock, forward, swing: rest, speed: 0 };
      drapes.set(owner, drape);
    } else if (dt > 0) {
      const velocity = clamp((forward - drape.forward) / dt, -4, 4);
      const target = clamp(rest - velocity * .2, -.7, .45);
      const steps = Math.ceil(dt * 120);
      for (let i = 0; i < steps; i++) {
        drape.speed += ((target - drape.swing) * 90 - drape.speed * 8) * dt / steps;
        drape.swing = clamp(drape.swing + drape.speed * dt / steps, -.8, .55);
      }
      drape.clock = clock;
      drape.forward = forward;
    }
    return drape.swing;
  }

  // ---------------------------------------------------------------- per frame
  function stamp(g, sprite, frost) {
    g.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h);
    if (!frost) return;
    if (!sprite.frost) {
      const ice = document.createElement('canvas');
      ice.width = sprite.image.width;
      ice.height = sprite.image.height;
      const c = ice.getContext('2d');
      c.drawImage(sprite.image, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(190,232,252,.78)';
      c.fillRect(0, 0, ice.width, ice.height);
      sprite.frost = ice;
    }
    g.save();
    g.globalAlpha *= frost;
    g.drawImage(sprite.frost, sprite.x, sprite.y, sprite.w, sprite.h);
    g.restore();
  }

  // view: { ctx, toScreen(localPoint) -> [x, y, pixelsPerMetre], direction (1 or -1), pixelsPerMetre,
  //   color, trim, style, base, pose, torsoPoint, frost, clock,
  //   owner (the fighter, to remember its cloth) and forward (its chest position along the way it faces),
  //   weapon: { key (null = use draw), draw() }, spare: { key, draw, mount, angle, scale } | null,
  //   shield: { sprite (false = use draw), draw, at, tilt, size, stowed, bolts, width, height } | null }
  function drawFighter(view) {
    const { ctx: g, toScreen, direction: dir, pose, frost } = view;
    const j = pose.joints;
    prepare(view.pixelsPerMetre);
    const parts = bodySprites(view.style, view.color, view.trim, view.base);

    const place = (at, paint, angle = 0, sx = 1, sy = 1) => {
      const [x, y, unit] = toScreen(at);
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.scale(dir * unit / 100 * sx, unit / 100 * sy);
      paint();
      g.restore();
    };
    // A limb sprite stretched between two joints.
    const bone = (sprite, from, to, rest) => {
      const [ax, ay, unit] = toScreen(from);
      const [bx, by] = toScreen(to);
      const dx = bx - ax;
      const dy = by - ay;
      g.save();
      g.translate(ax, ay);
      g.rotate(Math.atan2(-dx, dy));
      g.scale(dir * unit / 100, clamp(Math.hypot(dx, dy) / (rest * 100), unit / 100 * .6, unit / 100 * 1.25));
      stamp(g, sprite, frost);
      g.restore();
    };
    // A filler or guard at the middle joint, turned halfway between the two limb parts.
    const joint = (sprite, from, at, to) => {
      if (!sprite) return;
      const [ax, ay] = toScreen(from);
      const [x, y, unit] = toScreen(at);
      const [bx, by] = toScreen(to);
      const upper = Math.atan2(ax - x, y - ay);
      const lower = Math.atan2(x - bx, by - y);
      g.save();
      g.translate(x, y);
      g.rotate(upper + Math.atan2(Math.sin(lower - upper), Math.cos(lower - upper)) / 2);
      g.scale(dir * unit / 100, unit / 100);
      stamp(g, sprite, frost);
      g.restore();
    };
    // Items point along an axis given by an angle in the fighter's own space.
    const item = (hand, angle, size, paint) => {
      const [x, y, unit] = toScreen(hand);
      const [tx, ty] = toScreen([hand[0] + Math.cos(angle), hand[1] + Math.sin(angle), hand[2]]);
      g.save();
      g.translate(x, y);
      g.rotate(Math.atan2(ty - y, tx - x));
      g.scale(unit / 100 * size, dir * unit / 100 * size);
      paint();
      g.restore();
    };

    const torsoLean = Math.atan2(j.chest[1] - j.hips[1], j.chest[0] - j.hips[0]) - Math.PI / 2;
    const [hx, hy] = toScreen(j.hips);
    const [cx, cy, chestUnit] = toScreen(j.chest);
    const torsoTurn = Math.atan2(cx - hx, hy - cy);
    const torsoStretch = clamp(Math.hypot(cx - hx, cy - hy) / (chestUnit * .625), .8, 1.15);
    const torsoFrame = paint => place(j.hips, paint, torsoTurn, 1 - Math.min(.18, Math.abs(pose.twist) * .3), torsoStretch);

    // Chain links and balls hang from the haft along the same curves the 3D flail and its hit test use.
    function drawChains(key, chains, size) {
      const art = weaponArt[key];
      const ball = weaponSprite(key, view.color, view.trim, 'ball');
      const link = weaponSprite(key, view.color, view.trim, 'link');
      for (const chain of chains) {
        for (let i = 0; i < 6; i++) {
          const [ax, ay] = toScreen(chain(i / 6));
          const [bx, by] = toScreen(chain((i + 1) / 6));
          place(chain((i + .5) / 6), () => {
            if (i % 2) g.scale(1, .55);
            stamp(g, link, frost);
          }, Math.atan2(by - ay, bx - ax), size, size);
        }
        const [px, py] = toScreen(chain(5 / 6));
        const [ex, ey] = toScreen(chain(1));
        place(chain(1), () => stamp(g, ball, frost), Math.atan2(ey - py, ex - px) * (art.ball.turns ? 1 : 0), size, size);
      }
    }

    function drawString(string) {
      const loaded = pose.strike < .2;
      const nock = string.nock + pose.strike * string.pull;
      g.lineCap = 'round';
      g.strokeStyle = '#eadcb8';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(string.tip, -string.span);
      g.lineTo(nock, -5.4);
      g.lineTo(string.tip, string.span);
      g.stroke();
      if (!loaded) return;
      g.strokeStyle = '#8a5c34';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(nock, -5.6);
      g.lineTo(string.bolt, -5.6);
      g.stroke();
      g.fillStyle = '#dfe3e8';
      g.strokeStyle = OUTLINE;
      g.lineWidth = .8;
      g.beginPath();
      g.moveTo(string.bolt - 2, -9);
      g.lineTo(string.bolt + 11, -5.6);
      g.lineTo(string.bolt - 2, -2.2);
      g.closePath();
      g.fill();
      g.stroke();
    }

    function drawWeapon(key, hand, angle, size, fallback, chains) {
      if (!key) {
        fallback();
        return;
      }
      const art = weaponArt[key];
      item(hand, angle, size, () => {
        stamp(g, weaponSprite(key, view.color, view.trim), frost);
        if (art.string) drawString(art.string);
        if (art.glow) {
          const glow = glowSprite(art.glow.color);
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = (.6 + Math.sin(view.clock * 4) * .18) * (1 - frost);
          g.translate(art.glow.x, 0);
          g.drawImage(glow.image, glow.x, glow.y, glow.w, glow.h);
          g.restore();
        }
      });
      if (art.ball) drawChains(key, chains, size);
    }

    function drawShield() {
      const shield = view.shield;
      if (!shield.key) {
        shield.draw();
        return;
      }
      const sprite = shieldSprite(shield.key, view.color, view.trim);
      const [halfWidth, halfHeight] = shieldArt[shield.key].half;
      place(shield.at, () => {
        g.scale(.94, 1);
        stamp(g, sprite, frost);
        // Bolts stuck in the face, leaning back toward the shooter.
        g.lineCap = 'round';
        for (const bolt of shield.bolts) {
          const x = bolt.x * halfWidth;
          const y = -bolt.y * halfHeight;
          const tx = x + 30;
          const ty = y - bolt.tilt * 30 - 7;
          g.strokeStyle = OUTLINE;
          g.lineWidth = 3.4;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(tx, ty);
          g.stroke();
          g.strokeStyle = '#d8b884';
          g.lineWidth = 1.9;
          g.stroke();
          g.fillStyle = '#ece3c8';
          g.beginPath();
          g.moveTo(tx - 9, ty + 2.4);
          g.lineTo(tx + 1, ty - 4);
          g.lineTo(tx + 2, ty);
          g.lineTo(tx + 1, ty + 5);
          g.closePath();
          g.fill();
        }
      }, -shield.tilt * dir, shield.size, shield.size);
    }

    function arm(side, bank) {
      const shoulder = j[side + 'Shoulder'];
      const elbow = j[side + 'Elbow'];
      const hand = j[side + 'Hand'];
      joint(bank.elbowFill, shoulder, elbow, hand);
      bone(bank.upperArm, shoulder, elbow, side === 'weapon' ? .51 : .43);
      bone(bank.forearm, elbow, hand, side === 'weapon' ? .53 : .47);
      joint(bank.elbow, shoulder, elbow, hand);
    }
    function fist(side, bank) {
      const elbow = j[side + 'Elbow'];
      const hand = j[side + 'Hand'];
      const angle = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
      place(hand, () => stamp(g, bank.hand, frost), -angle * dir * .6);
    }
    function leg(side, bank) {
      const hip = j[side + 'Hip'];
      const knee = j[side + 'Knee'];
      const ankle = j[side + 'Ankle'];
      const toe = j[side + 'Toe'];
      joint(bank.kneeFill, hip, knee, ankle);
      bone(bank.thigh, hip, knee, .515);
      bone(bank.shin, knee, ankle, .505);
      joint(bank.knee, hip, knee, ankle);
      const pitch = Math.atan2(toe[1] - ankle[1], toe[0] - ankle[0]) - Math.atan2(-.07, .19);
      place(ankle, () => stamp(g, bank.foot, frost), -pitch * dir);
    }
    function heldWeapon() {
      const thrown = view.weapon.thrown;
      drawWeapon(view.weapon.key, thrown?.hand || j.weaponHand, thrown?.angle ?? pose.angle, 1, view.weapon.draw, view.weapon.chains);
      if (!thrown) fist('weapon', parts.far);
    }

    const swing = drapeSwing(view.owner, view.forward, clamp(pose.cloth * 1.5, -.5, .35), view.clock);

    // Back to front. Stowed gear and the cloak sit behind everything.
    if (view.shield?.stowed) drawShield();
    if (view.spare) drawWeapon(view.spare.key, view.spare.mount, view.spare.angle, view.spare.scale, view.spare.draw, view.spare.chains);
    place(view.torsoPoint([-.1, .62, -.2]), () => {
      // A cape that flares out also lifts a little.
      g.transform(1, 0, swing, 1 - Math.min(.16, Math.abs(swing) * .2), 0, 0);
      stamp(g, parts.cape, frost);
    }, torsoTurn * .5);
    // The far arm and its weapon pass behind the body unless the swing brings them across it.
    const across = j.weaponHand[2] > -.08;
    arm('weapon', parts.far);
    if (!across) heldWeapon();
    leg('rear', parts.far);
    place(j.hips, () => stamp(g, parts.pelvis, frost), torsoTurn * .5);
    leg('front', parts.near);
    if (parts.skirt) {
      const [ax] = j.frontAnkle;
      const [bx] = j.rearAnkle;
      const drop = Math.max(.12, j.hips[1] - .27);
      place(j.hips, () => {
        // The hem follows the feet and lags a little behind the body.
        g.transform(1, 0, clamp(((ax + bx) / 2 - j.hips[0]) / drop + swing * .15, -2.4, 2.4), 1, 0, 0);
        stamp(g, parts.skirt, frost);
      }, 0, clamp(1 + (Math.abs(ax - bx) - .71) * .4, .85, 1.35), clamp(drop / .825, .2, 1.1));
    }
    torsoFrame(() => stamp(g, parts.torso, frost));
    if (pose.severed) {
      place(j.chest, () => {
        g.fillStyle = '#7a1614';
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1.4;
        g.beginPath();
        g.ellipse(0, -13, 10, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }, -torsoLean * dir);
    }
    const headTurn = pose.severed ? pose.headSpin : Math.atan2(j.head[1] - j.chest[1], j.head[0] - j.chest[0]) - Math.PI / 2;
    place(j.head, () => stamp(g, parts.head, frost), -headTurn * dir);
    if (across) heldWeapon();
    arm('shield', parts.near);
    fist('shield', parts.near);
    if (view.shield && !view.shield.stowed) drawShield();
    // A two-handed grip keeps the near hand on top of the haft.
    if (view.weapon.twoHanded) fist('shield', parts.near);
  }

  return {
    draw: drawFighter,
    stats,
    has: key => Object.hasOwn(weaponArt, key),
    hasArmor: key => Object.hasOwn(sets, key),
    hasShield: key => Object.hasOwn(shieldArt, key),
    // armor2d.js and weapons2d.js add the other items with these.
    weapons: weaponArt,
    armors: sets,
    shields: shieldArt,
    tools: {
      OUTLINE, SKIN, STEEL, IRON, BRASS, LEATHER, DARKLEATHER, WOOD, tone, gradient, shape, stroke, clipped, disc,
      rivet, stitches, seeded, wear, mail, plate, plateFill, clothFill, face, strap, buckle, runes
    }
  };
})();
