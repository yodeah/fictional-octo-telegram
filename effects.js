'use strict';

// Cosmetic only: nothing here may change fight state or consume Math.random,
// which the simulation relies on for its rolls.
const ArenaEffects = (() => {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let trauma = 0;
  let clock = 0;

  return {
    // Strength runs from 0 to 1. Overlapping hits add a little to the strongest one.
    shake(strength) {
      trauma = Math.min(1, Math.max(trauma, strength) + Math.min(trauma, strength) * .25);
    },
    // Offset in world units, so the shake looks the same at any canvas size.
    offset() {
      if (calm?.matches || trauma <= 0) return [0, 0];
      const size = trauma * trauma * .17;
      return [
        size * (Math.sin(clock * 83) * .65 + Math.sin(clock * 137 + 2) * .35),
        size * (Math.sin(clock * 101 + 1) * .65 + Math.sin(clock * 61 + 4) * .35)
      ];
    },
    // Real seconds, so playback speed does not shorten or sharpen the shake.
    frame(dt) {
      clock += dt;
      trauma = Math.max(0, trauma - dt * 2.6);
    },
    reset() {
      trauma = 0;
    }
  };
})();
