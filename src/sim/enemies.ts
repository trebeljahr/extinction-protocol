import { advanceAlongPath } from "./path";
import type { World } from "./types";
import { addShake, emit } from "./world";

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
      // Slight jolt so the hit registers — previous 0.18 mag with decay 6
      // faded in two frames and was easy to miss. Scales with the enemy's
      // damage so a titan at the gate hits harder than a lone raptor.
      const mag = 0.32 + Math.min(0.28, e.damage * 0.06);
      addShake(world, mag, 3.5);
    }
  }
  world.enemies = world.enemies.filter((e) => e.alive);
};
