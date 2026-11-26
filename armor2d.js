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
        for (let row = 0; row < 9; row++) {
          for (let i = -4; i < 5; i++) {
            const x = i * 6.4 + (row % 2) * 3.2;
            const y = -66 + row * 6.4;
            shape(g, `M${x - 3.2},${y} h6.4 v5 q-3.2,4.4 -6.4,0 Z`, gradient(g, x - 3.2, y, x + 3.2, y + 8, c.steel, [.55, .05, -.35]), .8);
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
})();
