// Seeded randomness. A save keeps its generator state, so reloading repeats the same results.

/** mulberry32: returns the next value in [0, 1) and the new state. */
export function next(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** A stateful generator for code that draws many values; read .state back to store it. */
export class Rng {
  state: number;
  constructor(seed: number) { this.state = seed | 0; }
  float(): number {
    const [value, state] = next(this.state);
    this.state = state;
    return value;
  }
  range(low: number, high: number): number { return low + (high - low) * this.float(); }
  int(n: number): number { return Math.floor(this.float() * n); }
  pick<T>(list: readonly T[]): T { return list[this.int(list.length)]; }
  chance(p: number): boolean { return this.float() < p; }
}

/** A stable 32-bit hash of a string, for seeding from names and ids. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h | 0;
}
