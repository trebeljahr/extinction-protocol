import type { World } from "./types";

// Swap-and-pop in place — avoids allocating a new array each tick when
// few items expire. Predicate returns true to keep the entry.
const retainInPlace = <T>(arr: T[], keep: (x: T) => boolean) => {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const x = arr[r];
    if (keep(x)) arr[w++] = x;
  }
  arr.length = w;
};

export const updateBeams = (world: World) => {
  const t = world.time;
  retainInPlace(world.beams, (b) => b.expiresAt > t);
};

export const updateExplosions = (world: World) => {
  const t = world.time;
  retainInPlace(world.explosions, (e) => e.expiresAt > t);
};

export const updateCryoWaves = (world: World) => {
  const t = world.time;
  retainInPlace(world.cryoWaves, (w) => w.expiresAt > t);
};

export const updateParticles = (world: World, dt: number) => {
  const decay = 1 - 2 * dt;
  for (const p of world.particles) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= decay;
    p.vel.y *= decay;
  }
  const t = world.time;
  retainInPlace(world.particles, (p) => p.expiresAt > t);
};

export const updatePuffs = (world: World, dt: number) => {
  // Heavier drag than spark particles — smoke billows then loses momentum.
  const decay = 1 - 1.4 * dt;
  // Buoyancy minus light gravity ≈ small upward residual after rise.
  const vhDecay = 1 - 0.9 * dt;
  for (const p of world.puffs) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.h += p.vh * dt;
    p.vel.x *= decay;
    p.vel.y *= decay;
    p.vh *= vhDecay;
    p.rot += p.rotVel * dt;
  }
  const t = world.time;
  retainInPlace(world.puffs, (p) => p.expiresAt > t);
};

export const updateShake = (world: World, dt: number) => {
  if (world.shake.magnitude > 0) {
    world.shake.magnitude = Math.max(0, world.shake.magnitude - world.shake.decay * dt);
  }
};
