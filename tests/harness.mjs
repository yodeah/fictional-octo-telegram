// Loads the browser scripts in Node with a do-nothing DOM, so fights can run without drawing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const files = ['venues.js', 'matchups.js', 'effects.js', 'bench.js', 'gl-renderer.js', 'specials.js', 'finishers.js', 'fighter2d.js', 'weapons2d.js', 'armor2d.js', 'arena.js', 'duel.js', 'rules.js'];

// Any property is another stub and any call returns one. Assigned values are kept.
function stub(values = {}) {
  const target = function () {};
  const store = new Map(Object.entries(values));
  return new Proxy(target, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === Symbol.iterator) return function* () {};
      if (key === 'then') return undefined;
      if (!store.has(key)) store.set(key, stub());
      return store.get(key);
    },
    set(_, key, value) { store.set(key, value); return true; },
    apply: () => stub(),
    construct: () => stub()
  });
}

export function load() {
  const element = () => stub({
    value: 'auto', checked: false, hidden: false, textContent: '', children: [], clientWidth: 0,
    getBoundingClientRect: () => ({ width: 0, height: 0 })
  });
  const byId = new Map();
  const find = id => byId.get(id) || byId.set(id, element()).get(id);
  const document = stub({
    getElementById: find, querySelector: find, querySelectorAll: () => [],
    createElement: element, createTextNode: element, addEventListener: () => {}, body: element(), hidden: false
  });
  const globals = {
    document,
    window: stub({ matchMedia: () => ({ matches: false }), devicePixelRatio: 1, addEventListener: () => {} }),
    location: { search: '' },
    localStorage: { getItem: () => null, setItem: () => {} },
    performance: { now: () => 0 },
    requestAnimationFrame: () => {},
    ResizeObserver: class { observe() {} },
    Option: function () { return element(); },
    Path2D: function () { return stub(); },
    navigator: {}
  };
  const source = files.map(file => readFileSync(fileURLToPath(new URL(file, root)), 'utf8').replace(/^'use strict';/, '')).join('\n;\n');
  const names = Object.keys(globals);
  return new Function(...names, source + '\nreturn { ArenaDuel, Rules, weapons, armors, shields, spells, specials, tactics, aimZones, spellTriggers, fighters, elements };')(...names.map(name => globals[name]));
}
