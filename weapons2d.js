'use strict';

// 2D art for the weapons, shields and special weapons beyond the first set in fighter2d.js.
// Centimetres, +x from the grip toward the head; a positive 3D offset is -y here. Each head covers
// the same stretch weaponSegments() hit-tests.
(() => {
  const { weapons: art, shields, tools } = ArenaArt2D;
  const { OUTLINE, DARKLEATHER, tone, gradient, shape, stroke, disc, rivet, wear, clipped, seeded } = tools;

  // ---- shared parts
  // Light falls from above on anything lying along the weapon.
  const across = (g, r, rgb, stops = [.1, .26, -.12, -.45]) => gradient(g, 0, -r, 0, r, rgb, stops);
  const steelAcross = (g, r, rgb) => gradient(g, 0, -r, 0, r, rgb, [.15, .75, .3, -.1, .2, -.4]);
  const poly = points => 'M' + points.map(p => p.join(',')).join(' L') + ' Z';
  function haft(g, rgb, x0, x1, r = 3.2) {
    const d = `M${x0},${-r * .9} C${x0 + (x1 - x0) * .3},${-r * 1.2} ${x0 + (x1 - x0) * .6},${-r * .8} ${x1},${-r} L${x1},${r} C${x0 + (x1 - x0) * .6},${r * 1.2} ${x0 + (x1 - x0) * .3},${r * .8} ${x0},${r * .9} Z`;
    shape(g, d, across(g, r, rgb), 1.2);
    wear(g, d, [x0, -r, x1, r], Math.round((x1 - x0) * .6), 'rgba(255,216,168,.3)', 'rgba(25,10,2,.4)', 113, 7);
  }
  function wrap(g, rgb, x0, x1, r = 3.8) {
    shape(g, `M${x0},${-r} L${x1},${-r} L${x1},${r} L${x0},${r} Z`, across(g, r, rgb), 1);
    for (let x = x0 + 1.5; x < x1 - 3; x += 4) stroke(g, `M${x},${-r} L${x + 3.6},${r}`, tone(DARKLEATHER, -.15), 1.1);
  }
  function band(g, rgb, x, r = 4.6, w = 4.4) {
    shape(g, `M${x - w / 2},${-r} h${w} v${r * 2} h${-w} Z`, gradient(g, 0, -r, 0, r, rgb, [.6, .12, -.42]), .9);
  }
  // A blade or head: filled steel with a bright upper edge and wear.
  function metal(g, d, r, rgb, seed = 5) {
    shape(g, d, steelAcross(g, r, rgb), 0);
    clipped(g, d, () => {
      g.save();
      g.translate(0, 1.1);
      stroke(g, d, 'rgba(255,250,240,.8)', 1.3);
      g.restore();
    });
    stroke(g, d, OUTLINE, 1.3);
    wear(g, d, [-50, -r - 4, 180, r + 4], 90, 'rgba(255,255,255,.4)', 'rgba(30,30,45,.3)', seed, 4);
  }
  // Reference materials, so a special that overrides one also recolors parts with their own base color.
  const STEEL_REF = tools.STEEL;
  const IRON_REF = tools.IRON;
  const WOOD_REF = tools.WOOD;
  // One chain link, lying along the chain; every second one is drawn squashed to look turned.
  function linkArt() {
    return {
      box: [-9, -7, 9, 7],
      draw(g, c) {
        for (const [color, w] of [[OUTLINE, 4.6], [tone(c.iron, .15), 2.6]]) {
          g.beginPath();
          g.ellipse(0, 0, 5.4, 3.8, 0, 0, Math.PI * 2);
          g.strokeStyle = color;
          g.lineWidth = w;
          g.stroke();
        }
        stroke(g, 'M-4.4,-2.6 Q0,-4.6 4.4,-2.6', 'rgba(255,255,255,.7)', .8);
      }
    };
  }
  // A spiked iron ball of the given radius in centimetres.
  function ballArt(r) {
    const reach = r * 1.45;
    return {
      box: [-reach - 2, -reach - 2, reach + 2, reach + 2],
      draw(g, c) {
        for (let i = 0; i < 8; i++) {
          g.save();
          g.rotate(i * Math.PI / 4 + .3);
          metal(g, `M${r * .75},${-r * .27} L${reach},0 L${r * .75},${r * .27} Z`, r * .4, c.steel, 151);
          g.restore();
        }
        disc(g, 0, 0, r, gradient(g, -r, -r, r, r, c.iron, [.65, .1, -.15, -.5]), 1.4);
        stroke(g, `M${-r},0 C${-r * .4},${r * .45} ${r * .4},${r * .45} ${r},0`, tone(c.brass, 0), 2.4);
        for (const x of [-r * .5, 0, r * .5]) rivet(g, x, r * .32 - Math.abs(x) * .12, 1.2, c.brass);
        disc(g, -r * .38, -r * .4, r * .2, 'rgba(255,255,255,.75)', 0);
      }
    };
  }

  art.rapier = {
    box: [-34, -20, 142, 20],
    draw(g, c) {
      metal(g, 'M16,-3.2 L60,-2.6 L112,-1.8 L137,0 L112,1.8 L60,2.6 L16,3.2 Z', 3.2, c.steel, 11);
      stroke(g, 'M18,0 L118,0', tone(c.iron, -.2), .7);
      wrap(g, c.grip, -19, 12, 3.2);
      // Swept hilt: knuckle bow, side rings and long quillons.
      for (const [d, w] of [['M16,-4 C8,-16 -14,-16 -21,-4', 2.4], ['M15,4 C22,17 34,13 27,3', 2.2],
        ['M17,-4 C24,-14 32,-11 27,-3', 2.2], ['M14,4 C6,12 -4,13 -8,5', 1.8]]) {
        stroke(g, d, OUTLINE, w + 1.6);
        stroke(g, d, tone(c.brass, .05), w);
        stroke(g, d, tone(c.brass, .55), w * .3);
      }
      shape(g, 'M14,-17 C20,-18 19,-8 18,0 C19,8 14,12 17,17 C11,18 12,9 13,0 C12,-8 9,-16 14,-17 Z', steelAcross(g, 17, c.brass), 1.1);
      disc(g, 15.6, 0, 3.2, c.teamCss, .8);
      disc(g, -24, 0, 5, gradient(g, -28, -4, -20, 4, c.brass, [.65, 0, -.45]), 1.1);
      rivet(g, -30, 0, 1.6, c.brass);
    }
  };

  art.falchion = {
    box: [-34, -38, 134, 24],
    draw(g, c) {
      // A heavy blade that widens and curves up toward a clipped point.
      const blade = 'M17,-8.6 C34,-14 56,-18 88,-24 C102,-27 116,-27 128,-22 C124,-18 120,-11 117,-6 C108,2 94,5 88,4.6 C66,4 46,6 17,8.6 Z';
      metal(g, blade, 24, c.steel, 13);
      stroke(g, 'M20,-2 C46,-6 70,-9 100,-17', tone(c.iron, -.1), 2.4);
      stroke(g, 'M20,-3.2 C46,-7.2 70,-10.2 100,-18.2', 'rgba(255,255,255,.7)', .7);
      for (let i = 0; i < 4; i++) disc(g, 34 + i * 9, 2 - i * .6, 1.2, tone(c.iron, -.35), .5);
      wrap(g, c.grip, -20, 13, 4);
      shape(g, 'M13,-17 L20,-15 L19,-6 L22,0 L19,6 L20,15 L13,17 L14,0 Z', steelAcross(g, 17, c.brass), 1.2);
      disc(g, 17, 0, 2.2, c.teamCss, .6);
      shape(g, 'M-20,-5 C-27,-8 -33,-4 -31,2 C-31,7 -25,8 -20,5 Z', gradient(g, -32, -6, -20, 6, c.brass, [.6, 0, -.45]), 1.2);
    }
  };

  art.greatsword = {
    box: [-68, -38, 169, 38],
    draw(g, c) {
      const blade = 'M19,-6.4 L36,-6 L38,-10.6 L42,-7.6 L129,-7.2 L163,0 L129,7.2 L42,7.6 L38,10.6 L36,6 L19,6.4 Z';
      metal(g, blade, 9, c.steel, 17);
      shape(g, 'M44,-1.8 L126,-1.2 L134,0 L126,1.2 L44,1.8 Z', across(g, 1.8, c.iron, [-.3, .3]), .5);
      wrap(g, c.grip, -52, 14, 4.4);
      band(g, c.brass, -22, 5.4, 3.6);
      for (const s of [-1, 1]) {
        shape(g, `M14,${s * 5} C16,${s * 15} 20,${s * 24} 31,${s * 32} C33,${s * 36} 27,${s * 36} 25,${s * 33} C16,${s * 27} 11,${s * 16} 13,${s * 5} Z`,
          steelAcross(g, 34, c.brass), 1.2);
        disc(g, 29.5, s * 33.4, 3, gradient(g, 27, -3, 32, 3, c.brass, [.6, -.3]), 1);
      }
      shape(g, 'M10,-7 L22,-6 L24,0 L22,6 L10,7 Z', steelAcross(g, 7, c.iron), 1.1);
      disc(g, 17, 0, 3, c.teamCss, .8);
      shape(g, 'M-52,-5 L-58,-8.6 L-66,0 L-58,8.6 L-52,5 Z', gradient(g, -64, -7, -52, 7, c.brass, [.6, 0, -.45]), 1.2);
      disc(g, -58, 0, 2.6, c.teamCss, .7);
    }
  };

  art.claymore = {
    box: [-68, -38, 180, 38],
    draw(g, c) {
      metal(g, 'M19,-7.6 L46,-8.4 L121,-6.6 L151,-4.8 L175,0 L151,4.8 L121,6.6 L46,8.4 L19,7.6 Z', 8.4, c.steel, 19);
      shape(g, 'M34,0 L56,-1.9 L148,0 L56,1.9 Z', across(g, 1.9, c.iron, [-.35, .3]), .5);
      wrap(g, c.grip, -52, 14, 4.2);
      // Quillons sweep toward the blade and end in four-ring knots.
      for (const s of [-1, 1]) {
        shape(g, `M13,${s * 4} L29,${s * 27} L24,${s * 30} L11,${s * 9} Z`, steelAcross(g, 30, c.iron), 1.2);
        for (const [dx, dy] of [[3.4, 0], [-3.4, 0], [0, 3.4], [0, -3.4]]) {
          disc(g, 27 + dx, s * 30 + dy, 3, tone(c.iron, .12), .9);
          disc(g, 27 + dx, s * 30 + dy, 1.1, tone(c.iron, -.5), 0);
        }
      }
      shape(g, 'M12,-7 L24,-5 L30,0 L24,5 L12,7 Z', steelAcross(g, 7, c.iron), 1.1);
      disc(g, 18, 0, 2.2, c.teamCss, .6);
      disc(g, -57, 0, 6.4, gradient(g, -62, -5, -52, 5, c.iron, [.55, 0, -.4]), 1.2);
      disc(g, -57, 0, 2.4, c.teamCss, .7);
    }
  };

  art.executioner = {
    box: [-68, -36, 162, 36],
    draw(g, c) {
      // Broad, parallel and blunt-tipped, made for one heavy cut.
      const blade = 'M19,-9 L34,-13 L146,-14 L156,-5 L156,7 L148,13 L34,13 L19,9 Z';
      metal(g, blade, 14, [153, 151, 139].map((v, i) => Math.round(v * c.steel[i] / STEEL_REF[i])), 23);
      shape(g, 'M36,-3.4 L134,-3.4 L134,3.4 L36,3.4 Z', across(g, 3.4, c.iron, [-.4, .2]), .6);
      for (const x of [141, 148]) disc(g, x, -1, 2.4, tone(c.iron, -.55), .8);
      // Engraved scales of justice.
      stroke(g, 'M60,-9 L60,9 M60,-9 L70,-9 M70,-9 L66,-5 L74,-5 Z M60,9 L70,9 M70,9 L66,5 L74,5 Z', tone(c.brass, .25), .8);
      wrap(g, c.grip, -52, 14, 4.6);
      shape(g, 'M12,-27 L21,-29 L22,-8 L25,0 L22,8 L21,29 L12,27 L14,0 Z', steelAcross(g, 29, c.brass), 1.3);
      for (const y of [-21, 21]) disc(g, 17, y, 2.2, tone(c.iron, -.3), .7);
      disc(g, 18, 0, 3.4, c.teamCss, .8);
      shape(g, 'M-52,-7 L-64,-6 L-66,6 L-52,7 Z', steelAcross(g, 7, c.brass), 1.2);
    }
  };

  art.spear = {
    box: [-124, -26, 184, 26],
    draw(g, c) {
      haft(g, c.wood, -118, 128, 3);
      wrap(g, c.grip, -16, 16, 3.8);
      shape(g, 'M-122,0 L-116,-3.4 L-108,-3.6 L-108,3.6 L-116,3.4 Z', steelAcross(g, 4, c.iron), 1.1);
      // Tassel under the head.
      for (let i = 0; i < 7; i++) stroke(g, `M122,${i < 4 ? 3 : -3} q-${6 + i},${(i % 4) * 3 * (i < 4 ? 1 : -1)} -${12 + i * 1.4},${(8 + i % 3 * 4) * (i < 4 ? 1 : -1)}`, tone(c.team, (i % 3) * .14 - .1), 1.5);
      shape(g, 'M118,-4.4 L134,-3.4 L134,3.4 L118,4.4 Z', steelAcross(g, 4.4, c.brass), 1.1);
      metal(g, 'M132,-3.4 C140,-12 150,-11 158,-9 L179,0 L158,9 C150,11 140,12 132,3.4 Z', 11, c.steel, 29);
      stroke(g, 'M134,0 L176,0', tone(c.iron, -.15), 1.4);
      stroke(g, 'M134,-1 L170,-1', 'rgba(255,255,255,.7)', .6);
    }
  };

  art.trident = {
    box: [-120, -30, 192, 30],
    draw(g, c) {
      haft(g, c.wood, -115, 142, 3.1);
      wrap(g, c.grip, -16, 16, 3.9);
      for (const x of [-112, -24, 24, 128]) band(g, c.brass, x, 4.4);
      for (const s of [-1, 1]) {
        metal(g, `M134,${s * 2} C140,${s * 12} 140,${s * 22} 152,${s * 23} L170,${s * 22} L168,${s * 27} L182,${s * 19} L170,${s * 16} L153,${s * 15.6} C147,${s * 14} 147,${s * 7} 146,${s * 3} Z`, 27, c.steel, 31);
      }
      metal(g, 'M136,-3.4 L166,-3 L164,-7 L187,0 L164,7 L166,3 L136,3.4 Z', 7, c.steel, 37);
      shape(g, 'M126,-5 L142,-7 L146,0 L142,7 L126,5 Z', steelAcross(g, 7, c.brass), 1.2);
      disc(g, 137, 0, 2.4, c.teamCss, .6);
      shape(g, 'M-119,0 L-112,-4 L-108,0 L-112,4 Z', tone(c.brass, 0), 1);
    }
  };

  art.halberd = {
    box: [-120, -28, 192, 38],
    draw(g, c) {
      haft(g, c.wood, -115, 148, 3.3);
      wrap(g, c.grip, -16, 16, 4);
      for (const x of [-112, -19, 17]) band(g, c.brass, x, 4.6);
      // Axe blade on one side (+y), hook on the other, spike on top.
      metal(g, 'M124,2 L129,31 C141,34 154,32 160,27 C168,22 173,15 177,9 L157,-1 L120,0 Z', 33, c.steel, 41);
      stroke(g, 'M129,28 C142,31 156,29 171,13', 'rgba(255,255,255,.8)', 1.2);
      disc(g, 146, 15, 3.4, tone(c.iron, -.4), .9);
      metal(g, 'M134,-3 C138,-12 142,-20 132,-25 C146,-24 152,-14 152,-3 Z', 24, c.steel, 43);
      metal(g, 'M148,-5 L166,-3.4 L189,0 L166,3.4 L148,5 Z', 6, c.steel, 47);
      shape(g, 'M116,-4.6 L154,-4.6 L154,4.6 L116,4.6 Z', steelAcross(g, 4.6, c.iron), 1.1);
      for (const x of [122, 134, 146]) rivet(g, x, 0, 1.4, c.brass);
      shape(g, 'M-119,0 L-112,-4 L-108,0 L-112,4 Z', tone(c.iron, 0), 1);
    }
  };

  art.axe = {
    box: [-34, -52, 112, 20],
    draw(g, c) {
      haft(g, c.wood, -29, 79, 3.4);
      wrap(g, c.grip, -24, 8, 4.2);
      // The cutting edge sits on the positive side of the haft (-y).
      metal(g, 'M55,6 L77,6 L79,-14 C84,-30 92,-38 98,-43 C86,-50 70,-52 62,-49 C52,-47 45,-43 40,-39 C50,-34 56,-24 56,-14 Z', 50, c.steel, 53);
      stroke(g, 'M44,-40 C56,-46 78,-49 95,-43', 'rgba(255,255,255,.85)', 1.6);
      stroke(g, 'M58,-14 C60,-24 56,-32 52,-37 M76,-14 C78,-24 84,-32 88,-37', 'rgba(30,30,45,.5)', 1);
      shape(g, 'M54,-8 L78,-8 L78,7 L54,7 Z', steelAcross(g, 8, c.iron), 1.2);
      for (const x of [60, 72]) rivet(g, x, 0, 1.5, c.brass);
      shape(g, 'M66,-16 l6,-7 l-6,-7 l-6,7 Z', tone(c.brass, .1), .8);
      band(g, c.brass, -28, 4.8);
    }
  };

  art.beardedAxe = {
    box: [-34, -54, 114, 20],
    draw(g, c) {
      haft(g, c.wood, -29, 106, 3.2);
      wrap(g, c.grip, -24, 8, 4.1);
      // A long beard drops back toward the hand.
      metal(g, 'M86,6 L100,6 C104,-8 106,-14 107,-20 C100,-34 88,-45 68,-50 C55,-52 45,-47 38,-41 C52,-38 62,-30 64,-22 C70,-12 80,-8 86,-6 Z', 52, c.steel, 59);
      stroke(g, 'M42,-42 C56,-50 86,-48 104,-22', 'rgba(255,255,255,.85)', 1.6);
      stroke(g, 'M70,-28 C80,-34 90,-30 96,-20 C86,-22 80,-20 76,-14', tone(c.iron, -.2), 1.1);
      shape(g, 'M82,-8 L102,-8 L102,7 L82,7 Z', steelAcross(g, 8, c.iron), 1.2);
      for (const x of [87, 97]) rivet(g, x, 0, 1.4, c.brass);
      for (const x of [20, 62]) band(g, c.brass, x, 4.4);
      band(g, c.iron, -28, 4.8);
    }
  };
})();
