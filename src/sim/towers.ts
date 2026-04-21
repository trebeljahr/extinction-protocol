import type { World, Tower, Enemy } from "./types";
import { distSq } from "./vec2";
import { createProjectile } from "./world";

const findTarget = (world: World, tower: Tower): Enemy | null => {
  const rangeSq = tower.range * tower.range;
  let best: Enemy | null = null;
  let bestProgress = -Infinity;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, tower.pos) > rangeSq) continue;
    const progress = e.segment + e.segmentT;
    if (progress > bestProgress) {
      best = e;
      bestProgress = progress;
    }
  }
  return best;
};

export const updateTowers = (world: World, dt: number) => {
  for (const t of world.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);

    let target: Enemy | null = null;
    if (t.targetId !== null) {
      const current = world.enemies.find(e => e.id === t.targetId && e.alive);
      if (current && distSq(current.pos, t.pos) <= t.range * t.range) {
        target = current;
      }
    }
    if (!target) target = findTarget(world, t);
    t.targetId = target?.id ?? null;

    if (target && t.cooldown === 0) {
      createProjectile(world, t.pos, target.id, t.damage);
      t.cooldown = 1 / t.fireRate;
    }
  }
};
