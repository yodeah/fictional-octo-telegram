'use strict';

const ArenaVenues = (() => {
  const venues = [
    { title: 'The Sand Pit', targets: ['Cheer with the spectators'] },
    { title: 'Fernwood Clearing', targets: ['Startle the squirrel', 'Startle the boar'] },
    { title: 'Moonlit Ruins', targets: ['Scatter the birds', 'Stir the fireflies'] }
  ];
  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function create(ctx, button, targets, heading, invalidate) {
    const rotationRandom = randomSource(Date.now());
    let index = 0;
    let remaining = 1;
    let clock = 0;
    let nextMarkerAt = 0;
    const reactions = [0, 0];

    function select(next) {
      index = next;
      remaining = 1 + Math.floor(rotationRandom() * 3);
      nextMarkerAt = 0;
      reactions.fill(0);
      const venue = venues[index];
      heading.textContent = button.textContent = venue.title;
      button.setAttribute('aria-label', 'Change venue. Current venue is ' + venue.title);
      targets.forEach((target, i) => {
        const label = venue.targets[i];
        target.hidden = !label;
        if (label) {
          target.setAttribute('aria-label', label);
          target.title = label;
        }
      });
      invalidate();
    }

    button.addEventListener('click', () => select((index + 1) % venues.length));
    targets.forEach((target, i) => target.addEventListener('click', () => { reactions[i] = clock + 2; }));
    button.setAttribute('aria-label', 'Change venue. Current venue is ' + venues[0].title);
    targets[0].hidden = false;
    targets[0].setAttribute('aria-label', venues[0].targets[0]);
    targets[0].title = venues[0].targets[0];

    return {
      // Ground colour for dust kicked up in the current venue.
      get dust() {
        return ['#f4d6a4', '#bfad7e', '#b3bac8'][index];
      },
      nextBout() {
        remaining--;
        if (remaining <= 0) select((index + 1) % venues.length);
      },
      victory() {
        if (index === 0) reactions[0] = clock + 2.4;
      },
      backdrop(width, height) {
        ctx.save();
        // The Sand Pit lays itself out in screen pixels; the others in a 1000 × 420 scene.
        if (index) ctx.scale(width / 1000, height / 420);
        ArenaVenues2D.backdrop(ctx, index, index ? 1000 : width, index ? 420 : height);
        ctx.restore();
      },
      draw(width, height, time) {
        clock = time;
        const active = reactions.map(value => Math.max(0, value - clock));
        const points = ArenaVenues2D.draw(ctx, index, width, height, clock, active);
        if (clock >= nextMarkerAt) {
          points.forEach(([x, y], i) => {
            targets[i].style.left = x * 100 + '%';
            targets[i].style.top = y * 100 + '%';
          });
          nextMarkerAt = clock + .14;
        }
      }
    };
  }

  return { create };
})();
