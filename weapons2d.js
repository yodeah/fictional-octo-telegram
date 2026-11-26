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
})();
