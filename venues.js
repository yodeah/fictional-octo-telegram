'use strict';

const ArenaVenues = (() => {
  const venues = [
    { title: 'The Sand Pit', targets: ['Cheer with the spectators'] },
    { title: 'Fernwood Clearing', targets: ['Startle the squirrel', 'Startle the boar'] },
    { title: 'Moonlit Ruins', targets: ['Scatter the birds', 'Stir the fireflies'] }
  ];
  const sceneWidth = 1000;
  const sceneHeight = 420;
  const rowColors = ['#a66547', '#80713e', '#567b74', '#744d42', '#b08656', '#665153', '#87948b'];
  const faceColors = ['#c89567', '#a47050', '#865738', '#dfb784'];
  const groundColors = ['#253b30', '#374536', '#172d2c'];

  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function polygon(ctx, color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function oval(ctx, color, x, y, rx, ry, angle = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function gradient(ctx, from, to, top = 0, bottom = sceneHeight) {
    const ink = ctx.createLinearGradient(0, top, 0, bottom);
    ink.addColorStop(0, from);
    ink.addColorStop(1, to);
    return ink;
  }

  function branches(ctx, random, row) {
    const color = ['#75846a', '#515f4e', '#374b3d'][row];
    const leaf = ['#859270', '#617653', '#526b4d'][row];
    for (let i = 0; i < 15 - row * 2; i++) {
      const x = (i + random() * .75) * (sceneWidth / (15 - row * 2));
      const floor = 170 + row * 12 + random() * 23;
      const tip = -80 + random() * (135 - row * 27);
      const w = 5 + row * 3 + random() * 12;
      const tilt = (random() - .5) * 38;
      polygon(ctx, color, [[x - w, floor], [x + tilt * .3 - w * .4, floor * .54], [x + tilt, tip],
        [x + tilt * .4 + w * .45, floor * .52], [x + w, floor]]);
      for (const side of [-1, 1]) {
        const y = 58 + random() * 57;
        const extent = 21 + random() * 37 + row * 9;
        polygon(ctx, color, [[x, y + 24], [x + extent * side, y - 31], [x + extent * side * .58, y - 6], [x, y + 36]]);
        polygon(ctx, leaf, [[x + extent * side * 1.43, y - 29], [x + extent * side * .82, y - 79],
          [x + extent * side * .27, y - 66], [x + extent * side * .12, y - 23], [x + extent * side * .95, y - 13]]);
      }
    }
  }

  function terrain(ctx, random, colors) {
    ctx.fillStyle = gradient(ctx, colors[0], colors[1], 180, 420);
    polygon(ctx, ctx.fillStyle, [[0, 225], [108, 190], [254, 197], [390, 212], [516, 192],
      [691, 206], [825, 192], [1000, 216], [1000, 420], [0, 420]]);
    for (let i = 0; i < 290; i++) {
      const x = random() * 1000;
      const y = 219 + random() * 201;
      ctx.fillStyle = i % 2 ? '#ffe1a328' : '#1c281e38';
      ctx.fillRect(x, y, .7 + random() * 6, .4 + random() * 1.5);
    }
    ctx.beginPath();
    ctx.ellipse(500, 342, 365, 51, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#efdb9c44';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  function forest(ctx) {
    const random = randomSource(649);
    ctx.fillStyle = gradient(ctx, '#e1d6a0', '#8fa380', 0, 240);
    ctx.fillRect(0, 0, 1000, 420);
    oval(ctx, '#f9e2a46c', 535, 83, 175, 96);
    for (let row = 0; row < 3; row++) branches(ctx, random, row);
    for (let i = 0; i < 18; i++) {
      const x = random() * 1000;
      oval(ctx, i % 2 ? '#66744d' : '#475d46', x, 186 + random() * 29, 23 + random() * 44, 18 + random() * 22);
    }
    terrain(ctx, random, ['#a28a5e', '#6f6042']);
    polygon(ctx, '#463c2c', [[166, 217], [222, 194], [354, 199], [382, 209], [359, 222], [197, 228]]);
    polygon(ctx, '#6c6949', [[169, 211], [225, 193], [356, 196], [382, 205], [333, 206], [217, 216]]);
    oval(ctx, '#9a8059', 359, 212, 25, 9, -.13);
    oval(ctx, '#554936', 358, 212, 14, 5, -.13);
    for (let i = 0; i < 83; i++) {
      const x = random() * 1000;
      const y = 209 + random() * 31 + ((x < 88 || x > 912) ? random() * 190 : 0);
      const s = 3 + random() * 15;
      const color = groundColors[i % groundColors.length];
      polygon(ctx, color, [[x, y], [x - s * .46, y - s * .79], [x + s * .1, y - s * .43],
        [x + s * .67, y - s], [x + s * .38, y]]);
    }
  }

  function ruins(ctx) {
    const random = randomSource(832);
    ctx.fillStyle = gradient(ctx, '#303850', '#b0836d', 0, 240);
    ctx.fillRect(0, 0, 1000, 420);
    oval(ctx, '#f6d7aeb2', 720, 65, 26, 26);
    for (let i = 0; i < 49; i++) {
      oval(ctx, '#fff0c974', random() * 1000, random() * 118, .45 + random() * 1.05, .72);
    }
    polygon(ctx, '#647080', [[0, 156], [160, 87], [261, 149], [390, 103], [547, 163], [672, 114],
      [814, 159], [1000, 99], [1000, 223], [0, 221]]);
    polygon(ctx, '#555760', [[0, 187], [176, 134], [337, 184], [454, 153], [568, 187],
      [753, 157], [870, 172], [1000, 151], [1000, 225], [0, 225]]);
    for (let index = 0; index < 7; index++) {
      const x = 88 + index * 137;
      const top = index === 2 || index === 3 ? 155 : 54 + random() * 59;
      ctx.fillStyle = '#6c6061';
      ctx.fillRect(x, top, 42, 211 - top);
      ctx.fillStyle = '#948379';
      ctx.fillRect(x, top, 12, 210 - top);
      ctx.fillRect(x - 7, top - 4, 55, 10);
      ctx.fillStyle = '#4d4b55';
      for (let y = top + 18; y < 206; y += 23) ctx.fillRect(x, y, 42, 1.5);
      ctx.fillStyle = '#9e8c7b';
      ctx.fillRect(x - 12, 199, 62, 14);
    }
    terrain(ctx, random, ['#8d7570', '#605563']);
    for (let i = 0; i < 36; i++) {
      const x = random() * 1000;
      const y = 213 + random() * (x < 95 || x > 910 ? 172 : 23);
      const s = 2 + random() * 11;
      polygon(ctx, i % 2 ? '#978b84' : '#5d5862', [[x - s, y], [x - s * .3, y - s * .65],
        [x + s * .68, y - s * .55], [x + s, y]]);
    }
  }

  function crowd(ctx, clock, cheer) {
    const width = 1000;
    const excitement = Math.min(1, cheer * 1.6);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 25; i++) {
        const x = i * 40 + (row ? 25 : 10);
        const y = 157 + row * 21 + Math.sin(clock * 2.1 - i * .56) * 1.4
          + Math.sin(clock * 8 - i * .34) * excitement * 3.4;
        const coat = rowColors[(i * 13 + row * 3) % rowColors.length];
        const face = faceColors[(i * 5 + row) % 4];
        const lift = (Math.sin(clock * 2.7 - i * .67) + 1) * 3
          + (Math.sin(clock * 9 - i * .67) + 1) * excitement * 5;
        polygon(ctx, coat, [[x - 13, y + 16], [x - 9, y + 2], [x + 8, y + 1], [x + 13, y + 16]]);
        if (cheer || i % 4 === 0) {
          polygon(ctx, coat, [[x - 7, y + 4], [x - 15, y - lift], [x - 18, y - lift + 3],
            [x - 13, y + 11], [x - 7, y + 12]]);
          oval(ctx, face, x - 15, y - lift, 2.9, 2.7);
        }
        oval(ctx, face, x, y - 3, 5.0, 5.7);
        oval(ctx, '#49332a', x - 1, y - 6, 5.1, 3.4);
      }
      ctx.fillStyle = row ? '#704a33' : '#a27650';
      ctx.fillRect(0, 172 + 18 * row, width, row ? 8 : 5);
    }
    return [[.50, .332]];
  }

  function wildlife(ctx, clock, reactions) {
    const squirrelHop = Math.sin(reactions[0] * Math.PI / 2) ** 2;
    const boarRun = Math.sin(reactions[1] * Math.PI / 2) ** 2;
    const bob = Math.sin(clock * 4.4 + boarRun * 4);
    const boarX = 744 + Math.sin(clock * .28) * 112 + boarRun * 58;
    const boarY = 208 - Math.abs(bob) * (1.9 + boarRun * 3.8);
    const direction = Math.cos(clock * .28) > 0 || boarRun > .18 ? 1 : -1;
    ctx.save();
    ctx.translate(boarX, boarY);
    ctx.scale(direction, 1);
    oval(ctx, '#26342244', 0, 16, 35, 5);
    oval(ctx, '#493b31', -4, -5, 30, 16);
    polygon(ctx, '#6e5640', [[-32, -8], [-20, -22], [-3, -22], [16, -13], [9, 1], [-13, 7], [-35, 2]]);
    for (const [i, x] of [-23, -12, 7, 16].entries()) {
      const step = bob * (i % 2 ? -4 : 4);
      polygon(ctx, i % 2 ? '#514236' : '#332d27', [[x - 2, 3], [x + 4, 3], [x + step + 3, 14], [x + step - 3, 14]]);
    }
    polygon(ctx, '#59483c', [[11, -17], [22, -11], [33, -7], [37, 2], [25, 7], [11, 2]]);
    polygon(ctx, '#cbb195', [[30, 3], [38, 0], [39, -5], [41, 0], [36, 6]]);
    polygon(ctx, '#6e5640', [[14, -14], [14, -24], [23, -17], [22, -8]]);
    oval(ctx, '#e2cb9c', 25, -9, 1.6, 1.3);
    ctx.restore();

    const squirrelX = 242 + Math.sin(clock * .75) * 61 + squirrelHop * 57;
    const hop = Math.abs(Math.sin(clock * 5 + squirrelHop * 5)) * (3 + squirrelHop * 13);
    const squirrelY = 195 - hop;
    const facing = Math.cos(clock * .75) > 0 || squirrelHop > .18 ? 1 : -1;
    ctx.save();
    ctx.translate(squirrelX, squirrelY);
    ctx.scale(facing, 1);
    oval(ctx, '#643c29', -12, -12, 9, 13, -.49);
    oval(ctx, '#ac6e3e', -14, -17, 7, 10, -.38);
    oval(ctx, '#ad6940', 0, 0, 11, 6.3);
    oval(ctx, '#c88d55', 7, -6, 6.6, 5.9);
    polygon(ctx, '#bd7e51', [[5, -9], [6, -17], [10, -10], [9, -6]]);
    oval(ctx, '#302a22', 10, -7, 1.4, 1.4);
    ctx.restore();
    return [[squirrelX / 1000, (squirrelY - 12) / 420], [boarX / 1000, (boarY - 8) / 420]];
  }

  function moonlife(ctx, clock, reactions) {
    const scatter = Math.sin(reactions[0] * Math.PI / 2) ** 2;
    const stirred = Math.sin(reactions[1] * Math.PI / 2) ** 2;
    const birdsX = 335 + Math.sin(clock * .35) * 120 + scatter * 98;
    const birdsY = 100 + Math.cos(clock * .53) * 14 - scatter * 42;
    for (let i = 0; i < 4; i++) {
      const x = birdsX - 21 * i;
      const y = birdsY + 5 * i;
      const flap = Math.sin(clock * 9 - i * .68) * 5;
      polygon(ctx, '#32364a', [[x - 10, y - flap], [x - 3, y - 2], [x, y + 2], [x + 6, y - flap - 2],
        [x + 12, y - flap], [x + 3, y + 2], [x, y + 4]]);
    }
    for (let i = 0; i < 19; i++) {
      const x = 692 + 125 * Math.sin(i * 17 + clock * .75 + stirred * i * .21);
      const y = 203 + Math.cos(i * 13 - clock * 1.13) * 33 - stirred * 41;
      const glint = 1.4 + (Math.sin(clock * 3 + i) + 1) * .55;
      oval(ctx, '#e4d8993a', x, y, glint * 3.1, glint * 3.1);
      oval(ctx, '#e9d79fbd', x, y, glint, glint);
    }
    return [[birdsX / 1000, birdsY / 420], [.70, .49]];
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
      backdrop(width, height, original) {
        if (index === 0) {
          original();
          return;
        }
        ctx.save();
        ctx.scale(width / sceneWidth, height / sceneHeight);
        if (index === 1) forest(ctx);
        else ruins(ctx);
        ctx.restore();
      },
      draw(width, height, time) {
        clock = time;
        const active = reactions.map(value => Math.max(0, value - clock));
        ctx.save();
        ctx.scale(width / sceneWidth, height / sceneHeight);
        const points = index === 0 ? crowd(ctx, clock, active[0]) : index === 1 ? wildlife(ctx, clock, active) : moonlife(ctx, clock, active);
        ctx.restore();
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
