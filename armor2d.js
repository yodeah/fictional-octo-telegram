'use strict';

// 2D art for the armor kits beyond each class's first set in fighter2d.js. A kit is its class's set
// with its own materials, helmet or hood, and signature pieces.
(() => {
  const { armors: sets, tools } = ArenaArt2D;
  const { OUTLINE, DARKLEATHER, tone, gradient, shape, stroke, clipped, disc, rivet, stitches, wear, mail, plate, plateFill, clothFill, face, strap, buckle } = tools;

  // A kit built on its class's set. colors override the materials; box widens a sprite that sticks
  // out further; a part painter is handed the class's painter to draw underneath, and null drops a part.
  function derive(kind, colors, { box = {}, ...parts }) {
    const base = sets[kind];
    const set = { ...base, colors, box: { ...base.box, ...box } };
    for (const [name, paint] of Object.entries(parts)) {
      set[name] = paint && ((g, c) => paint(g, c, () => base[name]?.(g, c)));
    }
    return set;
  }
  // Joined stars, for the astral cloth.
  function constellation(g, c, points) {
    stroke(g, 'M' + points.map(p => p.join(',')).join(' L'), 'rgba(205,220,255,.6)', .6);
    for (const [x, y] of points) {
      shape(g, `M${x},${y - 3.2} L${x + .9},${y - .9} L${x + 3.2},${y} L${x + .9},${y + .9} L${x},${y + 3.2} L${x - .9},${y + .9} L${x - 3.2},${y} L${x - .9},${y - .9} Z`, tone(c.gold, .55), .4);
    }
  }

  sets.bronze = derive('plate', { steel: [190, 134, 76], iron: [128, 86, 54], brass: [226, 182, 104] }, {
    torso(g, c, base) {
      base(g, c);
      // Rows of overlapping scales over the breastplate.
      const chest = 'M-15,-62 C-4,-66 9,-65 15,-58 C22,-46 21,-32 15,-18 L12,-12 C2,-8 -8,-9 -14,-13 C-17,-30 -18,-47 -15,-62 Z';
      clipped(g, chest, () => {
        // Drawn from the waist up, so each row hangs over the one below it.
        for (let row = 11; row >= 0; row--) {
          for (let i = -4; i < 5; i++) {
            const x = i * 6.6 + (row % 2) * 3.3;
            const y = -68 + row * 5;
            shape(g, `M${x - 3.8},${y} C${x - 3.8},${y + 5.4} ${x - 2},${y + 8.6} ${x},${y + 8.6} C${x + 2},${y + 8.6} ${x + 3.8},${y + 5.4} ${x + 3.8},${y} Z`,
              gradient(g, x - 3.8, y, x + 3.8, y + 9, c.steel, [.6, .1, -.3]), .8);
          }
        }
      });
      stroke(g, chest, OUTLINE, 1.3);
      shape(g, 'M-14,-44 Q2,-38 19,-45 L19,-38 Q2,-31 -15,-37 Z', clothFill(g, -15, 19, c.team), 1.1);
      for (const x of [-9, 1, 11]) rivet(g, x, -37.6, 1.5, c.brass);
    },
    head(g, c) {
      face(g);
      // Open legion helmet: cheek guards, brow ridge, neck flange and a standing crest.
      const crest = 'M-24,-12 C-30,-40 -6,-48 8,-40 C16,-36 18,-28 17,-22 L10,-20 C2,-30 -12,-28 -18,-10 Z';
      shape(g, crest, gradient(g, -24, -40, 4, -18, c.team, [.3, .05, -.3]), 1.3);
      for (let i = 0; i < 18; i++) {
        const a = Math.PI * (1.02 + i * .045);
        stroke(g, `M${-2 + Math.cos(a) * 13},${-12 + Math.sin(a) * 13} L${-4 + Math.cos(a) * 28},${-12 + Math.sin(a) * 28}`, i % 2 ? 'rgba(30,5,5,.4)' : 'rgba(255,205,170,.35)', .7);
      }
      const dome = 'M-17,2 C-20,-14 -10,-23 2,-23 C13,-23 18,-15 18,-7 L2,-8 L-4,2 L-8,12 L-17,12 Z';
      plate(g, dome, gradient(g, -18, 4, 14, -20, c.steel, [-.55, -.2, .15, .75, .1]));
      plate(g, 'M-17,8 C-22,12 -27,16 -27,19 L-9,17 L-8,10 Z', plateFill(g, -27, -8, c.iron));
      plate(g, 'M-3,-4 L3,-6 C2,3 6,9 10,12 L7,19 C0,17 -5,8 -3,-4 Z', plateFill(g, -5, 10, c.steel));
      plate(g, 'M-18,-9 Q2,-13 21,-8 L21,-5 Q2,-9 -18,-5 Z', gradient(g, 0, -12, 0, -5, c.brass, [.5, 0, -.3]));
      for (const [x, y] of [[-12, -6.6], [-2, -8], [9, -7.6], [3, 12]]) rivet(g, x, y, 1.1, c.brass);
      disc(g, -4, 0, 2.6, gradient(g, -7, -3, -1, 3, c.brass, [.6, -.3]), 1);
    },
    cape: null
  });

  sets.fortress = derive('plate', { steel: [100, 118, 136], iron: [60, 70, 84], brass: [176, 170, 138] }, {
    box: { head: [-40, -52, 30, 28], torso: [-34, -84, 34, 32], upperArm: [-24, -30, 24, 58] },
    torso(g, c, base) {
      base(g, c);
      // A second riveted placard and a high bevor.
      const placard = 'M-14,-56 L16,-58 L19,-34 L3,-12 L-13,-30 Z';
      plate(g, placard, gradient(g, -14, -20, 19, -56, c.iron, [-.4, 0, .5, .1]));
      stroke(g, 'M3,-57 L3,-15', 'rgba(255,255,255,.55)', 1.1);
      for (const [x, y] of [[-10, -52], [13, -54], [15, -35], [-9, -32], [3, -17], [3, -50]]) rivet(g, x, y, 1.8, c.brass);
      plate(g, 'M-17,-68 Q0,-56 17,-68 L15,-82 Q0,-76 -13,-81 Z', plateFill(g, -17, 17, c.steel));
      stroke(g, 'M-15,-72 Q0,-63 15,-72', tone(c.brass, 0), 1.6);
    },
    upperArm(g, c, base) {
      base(g, c);
      for (const [x, h] of [[-9, 11], [0, 15], [9, 11]]) plate(g, `M${x - 4},-9 L${x},${-9 - h} L${x + 4},-9 Z`, plateFill(g, x - 4, x + 4, c.steel));
      plate(g, 'M-18,-4 C-18,-18 18,-18 18,-4 L16,2 Q0,-6 -16,2 Z', plateFill(g, -18, 18, c.iron));
      for (const x of [-11, 0, 11]) rivet(g, x, -8, 1.6, c.brass);
    },
    head(g, c) {
      // Closed great helm with swept horns.
      for (const [d, dim] of [['M-8,-18 C-24,-22 -34,-34 -33,-48 C-28,-36 -18,-30 -4,-26 Z', -.25], ['M6,-18 C20,-24 26,-36 22,-50 C16,-38 8,-32 -2,-27 Z', 0]]) {
        shape(g, d, gradient(g, -30, -48, 10, -18, [214, 200, 172], [.3 + dim, dim, -.4]), 1.3);
      }
      const helm = 'M-19,16 L-21,-12 C-20,-22 -10,-27 2,-27 C14,-27 21,-20 22,-11 L24,6 L18,22 L2,24 L-8,17 Z';
      plate(g, helm, gradient(g, -21, 6, 24, -14, c.steel, [-.5, -.15, .15, .65, -.05]));
      wear(g, helm, [-21, -27, 24, 24], 50, 'rgba(255,255,255,.4)', 'rgba(20,20,30,.4)', 167, 3.5);
      shape(g, 'M2,-5.4 L23,-7 L23,-2.4 L2,-1 Z', '#0b0708', 1);
      disc(g, 15, -3.8, 1.1, '#ff9a5a', 0);
      plate(g, 'M12,-26 L17,-24 L21,22 L15,23 Z', plateFill(g, 12, 21, c.brass));
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) disc(g, -1 + i * 4.4, 6 + row * 4.6, .9, '#0b0708', 0);
      stroke(g, 'M-20,-11 Q2,-16 22,-11', tone(c.brass, 0), 2.4);
      for (let i = 0; i < 5; i++) rivet(g, -17 + i * 6, -11.6 - Math.sin(i / 4 * Math.PI) * 2, 1.2, c.steel);
      plate(g, 'M-21,10 L-27,20 L-7,20 L-6,14 Z', plateFill(g, -27, -6, c.iron));
    }
  });

  sets.gilded = derive('plate', { steel: [222, 186, 108], iron: [152, 112, 66], brass: [168, 60, 56] }, {
    box: { head: [-44, -52, 30, 28] },
    torso(g, c, base) {
      base(g, c);
      // Filigree scrolls and a jewelled medallion.
      for (const s of [-1, 1]) {
        stroke(g, `M3,-36 C${3 + s * 8},-30 ${3 + s * 14},-36 ${3 + s * 11},-42 C${3 + s * 9},-45 ${3 + s * 6},-41 ${3 + s * 9},-39`, tone(c.iron, -.35), 1.3);
        stroke(g, `M3,-26 C${3 + s * 6},-20 ${3 + s * 12},-24 ${3 + s * 10},-30`, tone(c.iron, -.35), 1.1);
      }
      disc(g, 3, -51, 7, gradient(g, -3, -57, 9, -45, [248, 220, 140], [.5, 0, -.4]), 1.2);
      disc(g, 3, -51, 4.2, gradient(g, 0, -54, 6, -48, [196, 40, 60], [.45, 0, -.45]), .9);
      disc(g, 4.4, -52.6, 1.2, '#fff', 0);
      for (const x of [-9, 15]) disc(g, x, -50, 2, '#3f8fb0', .7);
    },
    head(g, c) {
      // A tall plume and gilded wings on an open-faced parade helmet.
      face(g);
      const plume = 'M2,-24 C-4,-52 -30,-54 -42,-34 C-34,-40 -26,-38 -24,-34 C-38,-30 -40,-16 -38,-4 C-30,-22 -16,-24 -8,-18 Z';
      shape(g, plume, gradient(g, -38, -48, -6, -16, [240, 232, 214], [.25, 0, -.3]), 1.3);
      for (let i = 0; i < 12; i++) stroke(g, `M0,-24 C${-8 - i},${-48 + i * 2} ${-28 - i},${-40 + i * 3} ${-37},${-18 + i * 1.4}`, 'rgba(120,90,60,.3)', .6);
      const dome = 'M-17,6 C-22,-14 -10,-23 2,-23 C13,-23 19,-15 18,-7 L1,-9 L-5,-1 L-8,13 L-17,12 Z';
      plate(g, dome, gradient(g, -18, 4, 14, -20, c.steel, [-.5, -.15, .2, .8, .1]));
      plate(g, 'M-18,-9 Q2,-13 20,-8 L20,-4.6 Q2,-9 -18,-5 Z', gradient(g, 0, -12, 0, -5, c.brass, [.5, 0, -.3]));
      for (let i = 0; i < 4; i++) {
        shape(g, `M-6,${-2 - i * 1.6} Q${-18 - i * 3},${-6 - i * 6} ${-30 + i * 2},${-14 - i * 8} Q${-20},${-8 - i * 3} -8,${3 - i * 2} Z`,
          gradient(g, -30, -34, -6, 0, [248, 216, 132], [.4, 0, -.25]), .9);
      }
      // The socket that holds the plume.
      plate(g, 'M-4,-21 L-2,-30 L5,-30 L7,-21 Z', gradient(g, -4, -30, 7, -21, [248, 216, 132], [.5, 0, -.3]));
      disc(g, -5, 0, 3.4, gradient(g, -8, -3, -2, 3, c.steel, [.7, -.3]), 1);
      disc(g, 6, -15, 2.6, '#c4283c', .8);
      plate(g, 'M-4,2 C-2,8 2,13 8,15 L5,19 C-2,17 -7,10 -6,3 Z', plateFill(g, -7, 8, c.steel));
    }
  });

  sets.scout = derive('leather', {}, {
    box: { head: [-40, -32, 30, 44], torso: [-34, -82, 30, 34] },
    torso(g, c, base) {
      base(g, c);
      // A sand mantle thrown over the shoulders.
      const mantle = 'M-12,-73 C2,-76 15,-70 19,-60 L13,-44 L8,-50 L2,-40 L-4,-48 L-11,-38 L-18,-46 C-24,-60 -22,-70 -12,-73 Z';
      shape(g, mantle, clothFill(g, -22, 19, [221, 188, 116]), 1.25);
      for (const d of ['M-14,-68 C-16,-58 -14,-50 -11,-41', 'M-3,-70 C-2,-60 0,-52 2,-43', 'M10,-68 C13,-60 13,-52 12,-47']) stroke(g, d, 'rgba(90,60,25,.45)', 1.6);
      stroke(g, 'M19,-60 L13,-44 L8,-50 L2,-40 L-4,-48 L-11,-38 L-18,-46', tone(c.team, 0), 2.2);
      wear(g, mantle, [-22, -75, 19, -38], 60, 'rgba(255,240,200,.3)', 'rgba(90,60,20,.3)', 173, 2);
    },
    head(g, c) {
      // Wrapped desert turban with a trailing tail and a face veil.
      shape(g, 'M-14,-8 C-30,2 -30,20 -38,40 C-28,36 -22,30 -20,22 C-14,12 -8,6 -6,2 Z', clothFill(g, -38, -6, [214, 176, 108]), 1.3);
      face(g);
      const veil = 'M-9,5 C0,2 9,4 16,5 L14,16 C8,26 -4,26 -11,18 Z';
      shape(g, veil, clothFill(g, -11, 16, c.team), 1.2);
      stroke(g, 'M-8,11 Q3,15 14,11 M-7,17 Q2,21 11,17', 'rgba(20,5,8,.35)', 1);
      const turban = 'M-18,4 C-24,-12 -14,-27 1,-27 C14,-27 20,-17 17,-7 C8,-11 -2,-9 -6,-5 L-8,8 Z';
      shape(g, turban, clothFill(g, -22, 19, [228, 196, 128]), 1.3);
      for (const d of ['M-19,-6 C-8,-20 6,-22 17,-14', 'M-20,0 C-12,-12 2,-16 16,-9', 'M-14,-17 C-4,-24 6,-24 13,-20']) stroke(g, d, 'rgba(110,76,30,.55)', 1.2);
      stroke(g, 'M-19,-9 C-8,-22 6,-24 17,-16', tone(c.team, .1), 2.6);
      disc(g, 9, -13, 3, gradient(g, 6, -16, 12, -10, c.brass, [.6, -.3]), 1);
      disc(g, 9, -13, 1.3, c.teamCss, .5);
    },
    cape: null
  });

  sets.brigandine = derive('leather', {}, {
    box: { head: [-32, -34, 32, 30] },
    torso(g, c, base) {
      base(g, c);
      // Cloth over riveted plates, row upon row.
      const coat = 'M-14,-62 C-4,-66 9,-65 15,-58 C21,-46 20,-32 15,-18 L15,2 Q0,7 -15,2 L-15,-18 C-19,-34 -18,-50 -14,-62 Z';
      shape(g, coat, clothFill(g, -19, 21, c.main), 1.3);
      clipped(g, coat, () => {
        for (let row = 0; row < 7; row++) {
          const y = -62 + row * 9.4;
          stroke(g, `M-22,${y + 6} Q0,${y + 10} 22,${y + 4}`, 'rgba(25,4,4,.55)', 1.2);
          for (let i = -3; i < 4; i++) rivet(g, i * 6 + (row % 2) * 3, y + 2.6, 1.35, [226, 186, 112]);
        }
      });
      stroke(g, 'M3,-66 L2,5', tone([194, 144, 92], .05), 2.4);
      for (let i = 0; i < 5; i++) buckle(g, 2.6, -55 + i * 12, 5.6, 4.6);
      strap(g, 'M-18,0 Q0,7 18,-1', 5);
      buckle(g, 10, 3, 7, 7);
    },
    head(g, c) {
      face(g, null);
      // Kettle helmet with a wide brim over a mail coif.
      mail(g, 'M-6,-14 C-16,-6 -17,10 -14,22 L2,22 C-2,14 -6,6 -4,-6 Z', [-17, -14, 2, 22]);
      const bowl = 'M-17,-9 C-17,-24 -8,-30 2,-30 C12,-30 18,-23 18,-10 Z';
      plate(g, bowl, gradient(g, -17, -8, 14, -28, c.steel, [-.5, -.1, .2, .7, -.05]));
      stroke(g, 'M1,-30 L2,-10', tone(c.iron, -.1), 2);
      plate(g, 'M-28,-9 C-14,-15 14,-15 30,-8 C28,-4 22,-3 17,-5 C4,-8 -10,-8 -17,-5 C-23,-3 -28,-5 -28,-9 Z', gradient(g, -28, -4, 30, -14, c.steel, [-.45, 0, .6, -.15]));
      for (let i = 0; i < 6; i++) rivet(g, -13 + i * 5.4, -12.6, 1, c.brass);
      stroke(g, 'M-4,-6 C-3,4 2,10 8,13', tone(c.main, -.35), 2.2);
    }
  });

  sets.nightHide = derive('leather', { brass: [146, 164, 96], steel: [150, 160, 150] }, {
    box: { head: [-36, -38, 30, 32], torso: [-34, -84, 32, 34] },
    torso(g, c, base) {
      base(g, c);
      // Leaf-shaped hide scales over the shoulders and chest.
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 6 - row; i++) {
          const x = -17 + i * 6.8 + row * 3.4;
          const y = -72 + row * 8;
          shape(g, `M${x},${y} C${x + 7},${y + 2} ${x + 6},${y + 11} ${x + 1.5},${y + 15} C${x - 4},${y + 10} ${x - 4},${y + 2} ${x},${y} Z`,
            clothFill(g, x - 4, x + 6, row % 2 ? c.light : c.main), 1.1);
          stroke(g, `M${x},${y + 2} L${x + 1.4},${y + 13}`, tone(c.main, -.5), .8);
        }
      }
      stroke(g, 'M-13,-44 L14,-20', tone(DARKLEATHER, -.2), 4);
      for (let i = 0; i < 4; i++) shape(g, `M${-10 + i * 6},${-43 + i * 6} l3,-6 l2,1 l-1,7 Z`, tone([170, 178, 186], .1), .8);
    },
    head(g, c) {
      shape(g, 'M-4,-24 C-22,-26 -30,-8 -24,8 C-24,18 -29,22 -34,28 C-16,30 -6,22 -3,12 L6,-18 Z', gradient(g, -30, 0, 0, -10, c.dark, [-.35, .1, -.2]));
      face(g);
      // Deep peaked hood, shadowed eyes and a half mask.
      clipped(g, 'M-9,-8 C-8,-16 6,-18 11,-9 L13,1 L-9,2 Z', () => {
        g.fillStyle = 'rgba(8,16,10,.62)';
        g.fillRect(-12, -18, 28, 22);
      });
      disc(g, 8.4, -2.1, 1.3, '#d6f06a', 0);
      shape(g, 'M-8,3 C2,0 10,3 17,4 L13,6 L13,13 C10,21 -2,22 -9,15 Z', clothFill(g, -9, 17, c.dark), 1.2);
      stroke(g, 'M-7,9 Q3,12 13,9', tone(c.trim, 0), 1.2);
      const hood = 'M-8,16 C-14,6 -12,-8 -2,-14 C4,-18 12,-14 18,-6 L22,-4 C22,-18 12,-32 -2,-34 L-14,-36 C-12,-32 -12,-30 -10,-28 C-24,-22 -28,-8 -24,4 C-22,14 -16,18 -8,16 Z';
      shape(g, hood, gradient(g, -24, 10, 10, -30, c.main, [-.45, -.15, .2, -.1]), 1.3);
      wear(g, hood, [-28, -36, 22, 18], 70, 'rgba(200,255,190,.18)', 'rgba(5,14,8,.3)', 179, 2);
      stitches(g, 'M-12,13 C-18,3 -16,-10 -4,-18 C4,-22 12,-18 17,-11', 'rgba(170,196,110,.85)', .8);
      shape(g, 'M-14,-24 C-26,-30 -32,-40 -30,-46 C-24,-40 -16,-38 -8,-30 Z', clothFill(g, -30, -8, c.team), 1.1);
    }
  });

  sets.tide = derive('robes', { gold: [150, 224, 218], glow: '#d6fff8' }, {
    box: { head: [-36, -36, 28, 40] },
    torso(g, c, base) {
      base(g, c);
      // Wave embroidery and a shell clasp.
      for (let row = 0; row < 3; row++) {
        let d = `M-16,${-32 + row * 5}`;
        for (let i = 0; i < 5; i++) d += ' q3.4,-4.6 6.8,0';
        stroke(g, d, tone(c.gold, .2 - row * .2), 1.2);
      }
      shape(g, 'M-6,-62 C-12,-66 -10,-74 -4,-74 C2,-76 8,-72 6,-66 L1,-60 Z', gradient(g, -10, -74, 6, -62, [240, 226, 214], [.3, 0, -.25]), 1.1);
      for (let i = 0; i < 5; i++) stroke(g, `M1,-61 L${-8 + i * 3.4},-72`, 'rgba(150,110,100,.7)', .7);
    },
    head(g, c) {
      // Bare-headed with flowing hair, a veil and a pearl circlet.
      shape(g, 'M-2,-22 C-20,-26 -28,-6 -22,10 C-22,24 -28,30 -34,36 C-18,38 -6,26 -4,12 L6,-16 Z', clothFill(g, -30, 0, c.dark), 1.3);
      face(g);
      const hair = 'M-8,14 C-16,4 -17,-12 -6,-18 C4,-24 14,-18 15,-9 C6,-13 -2,-10 -4,-4 C-6,4 -2,10 2,16 C-1,18 -5,17 -8,14 Z';
      shape(g, hair, gradient(g, -16, 10, 12, -18, [208, 226, 232], [-.45, -.15, .25, .05]), 1.3);
      for (let i = 0; i < 6; i++) stroke(g, `M${10 - i * 3},${-15 + i} C${-10 - i},${-12 + i * 2} ${-13 + i},${4 + i} ${-6 + i},${15}`, 'rgba(70,120,140,.5)', .7);
      stroke(g, 'M-12,-9 Q2,-18 15,-10', tone(c.gold, .1), 2.4);
      for (let i = 0; i < 5; i++) disc(g, -9 + i * 5, -12.4 - Math.sin(i / 4 * Math.PI) * 2.6, 1.5, '#f4f7f2', .6);
      shape(g, 'M6,-15 C6,-20 10,-24 13,-26 C14,-21 13,-17 10,-14 Z', gradient(g, 6, -24, 12, -14, c.gold, [.5, -.2]), 1);
      disc(g, -5, 3, 2.2, c.glow, .7);
    }
  });

  sets.cinder = derive('robes', { gold: [255, 163, 82], glow: '#ffd36a' }, {
    box: { head: [-34, -48, 30, 34], upperArm: [-22, -24, 22, 54] },
    torso(g, c, base) {
      base(g, c);
      // Flames licking up from the sash.
      for (let i = 0; i < 6; i++) {
        const x = -15 + i * 5.8;
        const h = 12 + (i % 3) * 6;
        shape(g, `M${x - 3},-14 C${x - 5},${-14 - h * .5} ${x + 2},${-14 - h * .6} ${x},${-14 - h} C${x + 6},${-14 - h * .5} ${x + 5},-18 ${x + 3},-14 Z`,
          gradient(g, x, -14 - h, x, -14, [255, 150, 60], [.55, .05, -.2]), .8);
      }
    },
    upperArm(g, c, base) {
      base(g, c);
      for (const [x, h] of [[-9, 10], [0, 16], [9, 11]]) {
        shape(g, `M${x - 5},-3 C${x - 7},${-3 - h * .5} ${x + 1},${-3 - h * .6} ${x - 2},${-6 - h} C${x + 7},${-3 - h * .5} ${x + 7},-8 ${x + 4},-3 Z`,
          gradient(g, x, -6 - h, x, -3, [255, 140, 50], [.6, .05, -.3]), 1);
      }
    },
    head(g, c) {
      shape(g, 'M-2,-28 C-18,-30 -28,-10 -22,8 C-22,18 -26,24 -30,30 C-16,31 -7,22 -3,12 L8,-18 Z', gradient(g, -27, 0, 0, -10, c.dark, [-.3, .08, -.15]));
      face(g, [74, 38, 30]);
      disc(g, 8.4, -2.1, 1.3, c.glow, 0);
      // Horned hood.
      for (const [d, dim] of [['M-12,-22 C-20,-30 -22,-40 -18,-46 C-12,-38 -4,-34 0,-28 Z', -.25], ['M6,-24 C8,-34 14,-42 24,-44 C18,-38 18,-28 15,-18 Z', 0]]) {
        shape(g, d, gradient(g, -20, -46, 20, -20, [90, 52, 44], [.3 + dim, dim, -.4]), 1.3);
      }
      const hood = 'M-7,18 C-13,6 -11,-8 -1,-15 C5,-18 12,-16 17,-8 C21,-18 16,-28 4,-29 C-10,-31 -22,-24 -24,-8 C-25,6 -18,20 -7,18 Z';
      shape(g, hood, gradient(g, -22, 10, 10, -28, c.main, [-.45, -.15, .22, -.02]), 1.3);
      stroke(g, 'M-6.6,16 C-11.6,5 -9.6,-6.6 -.6,-13 C5,-15.8 11,-14.2 15.6,-8', tone(c.gold, 0), 2.6);
      for (let i = 0; i < 5; i++) shape(g, `M${-19 + i * 3},${10 - i * 7} q-3,-7 3,-10 q-1,5 3,8 Z`, tone(c.gold, .15), .6);
      disc(g, 4, -22, 3, gradient(g, 1, -25, 7, -19, [255, 190, 80], [.6, -.25]), 1);
    }
  });

  sets.astral = derive('robes', { gold: [190, 206, 252], glow: '#e8f0ff' }, {
    box: { head: [-34, -62, 30, 34] },
    torso(g, c, base) {
      base(g, c);
      constellation(g, c, [[-12, -48], [-6, -38], [-11, -26], [-2, -20], [9, -30], [14, -42]]);
    },
    skirt(g, c, base) {
      base(g, c);
      constellation(g, c, [[-24, 40], [-14, 28], [-18, 54], [-4, 46], [2, 24]]);
      constellation(g, c, [[10, 34], [22, 52], [28, 40]]);
    },
    head(g, c) {
      shape(g, 'M-2,-24 C-18,-26 -28,-8 -22,8 C-22,18 -26,24 -30,30 C-16,31 -7,22 -3,12 L8,-18 Z', gradient(g, -27, 0, 0, -10, c.dark, [-.3, .08, -.15]));
      face(g, [228, 230, 240]);
      disc(g, 8.4, -2.1, 1.3, '#bfe0ff', 0);
      // Tall bent star hat.
      const hat = 'M-15,-14 C-10,-30 -10,-44 -18,-52 C-26,-60 -32,-54 -32,-46 C-26,-54 -20,-48 -19,-42 C-4,-60 10,-38 15,-15 Z';
      shape(g, hat, gradient(g, -24, -20, 12, -44, c.main, [-.4, -.1, .25, -.1]), 1.3);
      shape(g, 'M-26,-8 C-12,-19 12,-19 27,-9 C24,-5 18,-6 14,-8 C2,-12 -8,-11 -16,-7 C-21,-5 -25,-5 -26,-8 Z', gradient(g, -26, -6, 26, -16, c.dark, [-.2, .2, -.1]), 1.3);
      stroke(g, 'M-15,-15 C-4,-20 6,-20 15,-15', tone(c.gold, 0), 2.6);
      constellation(g, c, [[-8, -24], [-2, -36], [6, -27], [-14, -43]]);
      disc(g, -32, -45, 2.8, c.glow, 1);
    }
  });
})();
