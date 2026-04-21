import type { World } from "./types";
import { advanceAlongPath } from "./path";

export const updateEnemies = (world: World, dt: number) => {
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const adv = advanceAlongPath(world.path, e.segment, e.segmentT, e.speed * dt);
    e.segment = adv.segment;
    e.segmentT = adv.segmentT;
    e.pos = adv.pos;
    if (adv.finished) {
      world.lives -= e.damage;
      e.alive = false;
    }
  }
  world.enemies = world.enemies.filter(e => e.alive);
};
