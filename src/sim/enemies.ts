import { advanceAlongPath, smoothDirection } from "./path";
import type { World } from "./types";
import { addShake, emit } from "./world";

export const updateEnemies = (world: World, dt: number) => {
  for (const e of world.enemies) {
    if (!e.alive) continue;

    if (world.time >= e.slowUntil && e.slowFactor !== 1) {
      e.slowFactor = 1;
    }

    // Frost accumulates while slowed (only cryo applies slow today) and
    // decays back to 0 once free. The visual layer reads this to tint the
    // model from base color toward white-blue as it builds up.
    if (world.time < e.slowUntil) {
      if (e.frost < 1) e.frost = Math.min(1, e.frost + dt * 0.7);
    } else if (e.frost > 0) {
      e.frost = Math.max(0, e.frost - dt * 0.35);
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
      const dir = smoothDirection(path, adv.segment, adv.segmentT);
      if (dir.x * dir.x + dir.y * dir.y > 1e-12) {
        e.pos = {
          x: adv.pos.x + -dir.y * e.lateralOffset,
          y: adv.pos.y + dir.x * e.lateralOffset,
        };
      } else {
        e.pos = adv.pos;
      }
    } else {
      e.pos = adv.pos;
    }

    if (adv.finished) {
      // Debug invincibility absorbs the leak — enemy still despawns at the
      // exit but lives stay at startLives, the shake/event still fire so
      // the leak is visually unmistakable.
      if (!world.invincible) world.lives -= e.damage;
      e.alive = false;
      emit(world, { type: "life-lost" });
      // Slight jolt so the hit registers — previous 0.18 mag with decay 6
      // faded in two frames and was easy to miss. Scales with the enemy's
      // damage so a titan at the gate hits harder than a lone raptor.
      const mag = 0.32 + Math.min(0.28, e.damage * 0.06);
      addShake(world, mag, 3.5);
    }
  }
  // Swap-and-pop dead enemies in place; keep enemyById in sync.
  const arr = world.enemies;
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const e = arr[r];
    if (e.alive) {
      arr[w++] = e;
    } else {
      world.enemyById.delete(e.id);
    }
  }
  arr.length = w;
};
