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
})();
