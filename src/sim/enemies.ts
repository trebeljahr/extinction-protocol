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
    const path = world.paths[e.pathIndex];
    const adv = advanceAlongPath(path, e.segment, e.segmentT, effectiveSpeed * dt);
    e.segment = adv.segment;
    e.segmentT = adv.segmentT;

    // Nudge off the centerline so enemies spread across the lane. The
    // normal is the segment direction rotated 90° — computed per-tick
    // so the offset tracks the path through corners.
    if (e.lateralOffset !== 0 && !adv.finished) {
      const a = path[adv.segment];
      const b = path[adv.segment + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        const nx = -dy / len;
        const ny = dx / len;
        e.pos = {
          x: adv.pos.x + nx * e.lateralOffset,
          y: adv.pos.y + ny * e.lateralOffset,
        };
      } else {
        e.pos = adv.pos;
      }
    } else {
      e.pos = adv.pos;
    }

    if (adv.finished) {
      world.lives -= e.damage;
      e.alive = false;
      emit(world, { type: "life-lost" });
      if (world.lives > 0) addShake(world, 0.18);
    }
  }
  world.enemies = world.enemies.filter(e => e.alive);
};
