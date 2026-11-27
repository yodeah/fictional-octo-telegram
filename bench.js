'use strict';

// Frame pacing and the on-screen benchmark overlay. Nothing here reads or writes fight state:
// the arena asks gate() whether to render on each animation frame, reports each drawn frame to
// record(), and reads the test toggles that the overlay sets.
const ArenaBench = (() => {
  const CAP_FPS = 120;
  const CAP_INTERVAL = 1000 / CAP_FPS;
  const WARMUP = 1000; // ms ignored after load, Reset, or a toggle
  const WINDOW = 500; // ms per FPS sample for current and minimum FPS
  const UI_EVERY = 250; // ms between text updates
  const query = new URLSearchParams(location.search);
  const settings = {
    // Hidden on every load so the fight is unobstructed; ?bench opens it straight away.
    open: query.has('bench')
  };
  // Diagnostic toggles are deliberately not saved: a fighter-less arena must not survive a reload.
  const probe = { lowRes: query.get('res') === '1', fighters: true, scene: true, effects: true };
  let onResolution = () => {};

  // Refresh-rate estimate from every animation frame callback, rendered or skipped.
  const rafIntervals = [];
  let lastRaf = null;
  // A slow frame only ever lengthens an interval, so the screen's rate shows in the fastest
  // intervals: take the 10th percentile and snap it to a common refresh rate. ?hz=60 overrides it.
  const forcedHz = Number(query.get('hz')) || 0;
  const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  let refresh = 1000 / (forcedHz || 60);
  function estimateRefresh() {
    const sorted = rafIntervals.slice().sort((a, b) => a - b);
    const hz = 1000 / sorted[Math.floor(sorted.length * .1)];
    const near = RATES.reduce((best, rate) => Math.abs(rate - hz) < Math.abs(best - hz) ? rate : best);
    return 1000 / (Math.abs(near - hz) / near < .08 ? near : hz);
  }
  let nextDue = 0;

  let stats;
  function resetStats(now = performance.now()) {
    stats = {
      start: now, last: null, frames: 0, time: 0, worst: 0, drops: 0, recent: [],
      drawSum: 0, drawMax: 0, windowStart: null, windowFrames: 0, windowDraw: 0, windowDrawMax: 0,
      current: null, min: null, windowDrawAvg: null,
      parts: [0, 0, 0], partFrames: 0
    };
  }
  resetStats();

  const expected = () => refresh * Math.max(1, Math.ceil(CAP_INTERVAL / refresh - .05));

  function gate(now) {
    if (lastRaf !== null && !document.hidden) {
      const interval = now - lastRaf;
      if (interval > 2 && interval < 100) {
        rafIntervals.push(interval);
        if (rafIntervals.length > 240) rafIntervals.shift();
        if (!forcedHz && rafIntervals.length >= 20) refresh = estimateRefresh();
      }
    }
    lastRaf = now;
    // Screens at or below 120 Hz render every frame; faster ones skip frames to average 120 FPS.
    if (refresh >= CAP_INTERVAL - .5) return true;
    if (now + refresh / 2 < nextDue) return false;
    nextDue = Math.max(nextDue, now - CAP_INTERVAL) + CAP_INTERVAL;
    return true;
  }

  // Main-thread ms for [backdrop and scenery, fighters, effects] in the frame being drawn.
  let pendingParts = null;
  function parts(scene, fighters, effects) {
    pendingParts = [scene, fighters, effects];
  }

  // `now` is the animation frame timestamp; drawMs is how long draw() took on the main thread.
  function record(now, drawMs, paused) {
    const split = pendingParts;
    pendingParts = null;
    if (paused || document.hidden || now - stats.start < WARMUP) {
      stats.last = null;
      stats.windowStart = null;
      maybeRender(now);
      return;
    }
    if (stats.last === null) {
      stats.last = now;
      stats.windowStart = now;
      stats.windowFrames = 0;
      stats.windowDraw = stats.windowDrawMax = 0;
      maybeRender(now);
      return;
    }
    const interval = now - stats.last;
    stats.last = now;
    stats.frames++;
    stats.time += interval;
    stats.worst = Math.max(stats.worst, interval);
    stats.drawSum += drawMs;
    stats.drawMax = Math.max(stats.drawMax, drawMs);
    if (split) {
      for (let i = 0; i < 3; i++) stats.parts[i] += split[i];
      stats.partFrames++;
    }
    if (interval > expected() * 1.5) {
      stats.drops++;
      stats.recent.unshift({ at: (now - stats.start) / 1000, fps: 1000 / interval, ms: interval });
      if (stats.recent.length > 5) stats.recent.pop();
    }
    stats.windowFrames++;
    stats.windowDraw += drawMs;
    stats.windowDrawMax = Math.max(stats.windowDrawMax, drawMs);
    const span = now - stats.windowStart;
    if (span >= WINDOW) {
      stats.current = stats.windowFrames * 1000 / span;
      stats.min = stats.min === null ? stats.current : Math.min(stats.min, stats.current);
      stats.windowDrawAvg = stats.windowDraw / stats.windowFrames;
      stats.windowStart = now;
      stats.windowFrames = 0;
      stats.windowDraw = stats.windowDrawMax = 0;
    }
    maybeRender(now);
  }

  document.addEventListener('visibilitychange', () => {
    lastRaf = null;
    if (stats) {
      stats.last = null;
      stats.windowStart = null;
    }
  });

  // Overlay
  const panel = document.createElement('aside');
  panel.className = 'bench';
  panel.setAttribute('aria-label', 'Benchmark');
  panel.hidden = !settings.open;
  const text = document.createElement('pre');
  text.className = 'bench-text';
  const row = document.createElement('div');
  row.className = 'bench-buttons';
  const probes = document.createElement('div');
  probes.className = 'bench-buttons';
  const button = (label, onClick, into = row) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', onClick);
    into.append(element);
    return element;
  };
  const probeButton = (key, title) => {
    const element = button('', () => {
      probe[key] = !probe[key];
      labels();
      if (key === 'lowRes') onResolution();
      resetStats();
    }, probes);
    element.title = title;
    return element;
  };
  const resolutionButton = probeButton('lowRes', 'Draw the arena at full sharpness (up to 2 pixels per CSS pixel) or at 1, to test fill rate');
  const fighterButton = probeButton('fighters', 'Skip drawing the fighters, to test their cost');
  const sceneButton = probeButton('scene', 'Skip the animated crowd and wildlife, to test their cost');
  const effectsButton = probeButton('effects', 'Skip dust, trails, blood, sparks, magic, bolts and damage numbers, to test their cost');
  const reset = () => { resetStats(); render(performance.now()); };
  const resetButton = button('Reset', reset);
  button('Close', () => toggle(false));
  panel.append(text, row, probes);
  const opener = document.createElement('button');
  opener.type = 'button';
  opener.className = 'bench-open';
  opener.title = 'Show or hide the frame rate benchmark';
  opener.textContent = 'FPS';
  opener.setAttribute('aria-expanded', String(settings.open));
  opener.addEventListener('click', () => toggle(panel.hidden));
  resetButton.title = 'Clear the statistics. The first second after a reset is ignored.';

  let pixels = '';
  function labels() {
    resolutionButton.textContent = probe.lowRes ? 'Res 1×' : 'Res full';
    fighterButton.textContent = probe.fighters ? 'Fighters' : 'No fighters';
    sceneButton.textContent = probe.scene ? 'Scenery' : 'No scenery';
    effectsButton.textContent = probe.effects ? 'Effects' : 'No effects';
    for (const [element, on] of [[resolutionButton, !probe.lowRes], [fighterButton, probe.fighters], [sceneButton, probe.scene], [effectsButton, probe.effects]]) {
      element.setAttribute('aria-pressed', String(!on));
    }
  }
  labels();

  function toggle(open) {
    panel.hidden = !open;
    settings.open = open;
    opener.setAttribute('aria-expanded', String(open));
    if (open) resetStats();
  }

  let lastUi = 0;
  function maybeRender(now) {
    if (!panel.hidden && now - lastUi >= UI_EVERY) render(now);
  }

  const f = (value, digits = 0) => value === null || !isFinite(value) ? '—' : value.toFixed(digits);
  function render(now) {
    lastUi = now;
    const hz = 1000 / refresh;
    const avg = stats.frames ? stats.frames * 1000 / stats.time : null;
    const drawAvg = stats.frames ? stats.drawSum / stats.frames : null;
    const warming = now - stats.start < WARMUP;
    const part = i => f(stats.partFrames ? stats.parts[i] / stats.partFrames : null, 1);
    const status = warming ? ' · warming up' : stats.last === null ? ' · paused or hidden' : '';
    const lines = [
      'FPS ' + f(stats.current) + ' now · ' + f(avg, 1) + ' avg · ' + f(stats.min) + ' min',
      'Worst ' + f(stats.frames ? stats.worst : null, 1) + ' ms · Draw ' + f(stats.windowDrawAvg, 1) + ' now / '
        + f(drawAvg, 1) + ' avg / ' + f(stats.frames ? stats.drawMax : null, 1) + ' max ms',
      'Scene ' + part(0) + ' · Fighters ' + part(1) + ' · FX ' + part(2) + ' ms',
      'Drops ' + stats.drops + ' (>' + f(expected() * 1.5, 1) + ' ms)'
        + (stats.recent.length ? ': ' + stats.recent.map(drop => f(drop.at, 1) + 's ' + f(drop.fps) + 'fps').join(', ') : ''),
      pixels + ' · ' + f(hz) + ' Hz' + (forcedHz ? '' : ' est.') + ' · cap ' + CAP_FPS + status
        + (probe.lowRes || !probe.fighters || !probe.scene || !probe.effects ? ' · TEST TOGGLE ON' : '')
    ];
    text.textContent = lines.join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(panel);
    document.querySelector('.controls .options')?.prepend(opener);
    render(performance.now());
  });

  return {
    gate,
    record,
    reset,
    get lowResolution() { return probe.lowRes; },
    get drawFighters() { return probe.fighters; },
    get drawScenery() { return probe.scene; },
    get drawEffects() { return probe.effects; },
    parts,
    onResolutionChange(callback) { onResolution = callback; },
    // Read-only copy of the statistics for scripted comparisons.
    snapshot() {
      return { ...stats, recent: stats.recent.slice(), avg: stats.frames ? stats.frames * 1000 / stats.time : null,
        drawAvg: stats.frames ? stats.drawSum / stats.frames : null, hz: 1000 / refresh, expected: expected() };
    },
    report(description) {
      pixels = description;
    }
  };
})();
