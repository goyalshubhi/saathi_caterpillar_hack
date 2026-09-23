// Picks which phrasing (variant index) to use for a line so Saathi doesn't repeat itself word for word.
//
//   createPhraser({ seed: 42 })  demo mode: the same seed gives the same choices every run
//   createPhraser()              normal use: random
//
// Safety keys always get variant 0 (they have exactly one phrasing). A key never gets the same
// phrasing twice in a row.
import { variantCount } from './templates.js';

export const DEMO_SEED = 42;

// Small deterministic PRNG (mulberry32): returns floats in [0, 1).
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPhraser({ seed, random } = {}) {
  const rand = random ?? (seed === undefined ? Math.random : seededRandom(seed));
  const last = new Map();

  function pick(key) {
    const n = variantCount(key);
    if (n <= 1) return 0;
    const prev = last.get(key);
    // Choose among the other n-1 phrasings when there was a previous one.
    let v = Math.floor(rand() * (prev === undefined ? n : n - 1));
    if (prev !== undefined && v >= prev) v += 1;
    last.set(key, v);
    return v;
  }

  return { pick };
}
