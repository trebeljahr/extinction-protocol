import type { World } from "./types";
import { dist, sub, scale, normalize, add } from "./vec2";

const HIT_RADIUS = 0.5;

export const updateProjectiles = (world: World, dt: number) => {
  for (const p of world.projectiles) {
    if (!p.alive) continue;
    const target = world.enemies.find(e => e.id === p.targetId && e.alive);
    if (!target) {
      p.alive = false;
      continue;
    }
    const step = p.speed * dt;
    const d = dist(p.pos, target.pos);
    if (d <= Math.max(step, HIT_RADIUS)) {
      target.hp -= p.damage;
      if (target.hp <= 0) {
        target.alive = false;
        world.gold += target.bounty;
      }
      p.alive = false;
    } else {
      const dir = normalize(sub(target.pos, p.pos));
      p.pos = add(p.pos, scale(dir, step));
    }
  }
  world.projectiles = world.projectiles.filter(p => p.alive);
};
