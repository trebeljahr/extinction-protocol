// Deterministic PRNG + Box–Muller gaussian. Shared by every system that
// places props by seeded random — sim world build, render-side scenery
// layers, lava geometry. Same formulas the modules used inline; pulling
// them here lets every caller agree on the bit pattern without each one
// re-deriving it.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Box–Muller normal sample. Output is symmetric around 0 with standard
// deviation `sigma`. The `1e-9` floor avoids `log(0)` when the underlying
// uniform happens to return 0.
export const gaussian = (rng: () => number, sigma: number): number => {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
};
