import type { World } from "./types";
import { add, scale } from "./vec2";

export const updateBeams = (world: World) => {
  world.beams = world.beams.filter(b => b.expiresAt > world.time);
};

export const updateExplosions = (world: World) => {
  world.explosions = world.explosions.filter(e => e.expiresAt > world.time);
};

export const updateParticles = (world: World, dt: number) => {
  for (const p of world.particles) {
    p.pos = add(p.pos, scale(p.vel, dt));
    p.vel = scale(p.vel, 1 - 2 * dt);
  }
  world.particles = world.particles.filter(p => p.expiresAt > world.time);
};

export const updateShake = (world: World, dt: number) => {
  if (world.shake.magnitude > 0) {
    world.shake.magnitude = Math.max(0, world.shake.magnitude - world.shake.decay * dt);
  }
};
