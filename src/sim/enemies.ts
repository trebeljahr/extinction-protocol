import type { World } from "./types";
import { advanceAlongPath } from "./path";
import { emit, addShake } from "./world";

export const updateEnemies = (world: World, dt: number) => {
  for (const e of world.enemies) {
    if (!e.alive) continue;

    if (world.time >= e.slowUntil && e.slowFactor !== 1) {
      e.slowFactor = 1;
    }

    const effectiveSpeed = e.speed * e.slowFactor;
    const adv = advanceAlongPath(world.paths[e.pathIndex], e.segment, e.segmentT, effectiveSpeed * dt);
    e.segment = adv.segment;
    e.segmentT = adv.segmentT;
    e.pos = adv.pos;

    if (adv.finished) {
      world.lives -= e.damage;
      e.alive = false;
      emit(world, { type: "life-lost" });
      addShake(world, 0.35);
    }
  }
  world.enemies = world.enemies.filter(e => e.alive);
};
