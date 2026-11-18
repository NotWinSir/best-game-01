// A small seeded random generator (mulberry32). The simulation never calls Math.random: the
// world takes one of these, so a screenshot scene or a replay with the same seed walks the exact
// same path, while a live game is seeded once from the clock and never repeats.

export function makeRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max], both ends included. */
export function intRange(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of a non-empty array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
