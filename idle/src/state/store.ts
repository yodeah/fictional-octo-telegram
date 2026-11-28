// Saves stay on this device, in localStorage. The game ticks four times a second while open and
// catches up on return; both run the same catchUp() from rules/farm.ts.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { catchUp, type Report } from '../rules/farm.ts';
import { restock } from '../rules/shop.ts';
import { note, type Shade } from '../rules/shade.ts';

const KEY = 'ash-and-obol.shade.v1';
// A gap longer than this between ticks counts as time away and gets a summary.
const AWAY_SECONDS = 90;

export function load(): Shade | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const shade = JSON.parse(raw) as Shade;
    return shade && shade.v === 1 && typeof shade.level === 'number' ? shade : null;
  } catch {
    return null;
  }
}

export function save(shade: Shade) {
  try { localStorage.setItem(KEY, JSON.stringify(shade)); } catch { /* storage full or blocked */ }
}

export function wipe() {
  localStorage.removeItem(KEY);
}

export interface Game {
  shade: Shade;
  now: number;
  away: Report | null;
  dismissAway: () => void;
  /** Runs a change on the shade, saves it and redraws. Returns the action's error, if any. */
  act: (change: (shade: Shade, now: number) => string | null | void) => string | null;
}

export function useGame(shade: Shade): Game {
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [away, setAway] = useState<Report | null>(null);
  const ref = useRef(shade);
  ref.current = shade;

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const report = catchUp(shade, now);
      restock(shade, now);
      if (report.stopped) note(shade, now, 'info', report.stopped);
      if (report.seconds > AWAY_SECONDS) { setAway(report); save(shade); }
      redraw();
    };
    tick();
    const ticker = setInterval(tick, 250);
    const saver = setInterval(() => save(shade), 5000);
    const onVisibility = () => { if (document.visibilityState === 'hidden') save(shade); else tick(); };
    const onHide = () => save(shade);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(ticker);
      clearInterval(saver);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      save(shade);
    };
  }, [shade]);

  const act = useCallback((change: (s: Shade, now: number) => string | null | void) => {
    const now = Date.now();
    catchUp(ref.current, now);
    const error = change(ref.current, now) ?? null;
    save(ref.current);
    redraw();
    return error;
  }, []);

  return { shade, now: Date.now(), away, dismissAway: () => setAway(null), act };
}
