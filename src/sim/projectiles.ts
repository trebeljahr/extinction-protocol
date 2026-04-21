import type { World, Projectile } from "./types";
import { dist, sub, scale, normalize, add, distSq } from "./vec2";
import { createExplosion, emit, addShake, spawnParticles } from "./world";

const HIT_RADIUS = 0.5;

const applyHit = (world: World, p: Projectile) => {
  emit(world, { type: "impact", pos: p.pos });

  if (p.kind === "splash") {
    createExplosion(world, p.pos, p.splashRadius, 0.35);
    addShake(world, 0.25);
    spawnParticles(world, p.pos, 14, "#ffb266", [3, 7], 0.45);
    const rSq = p.splashRadius * p.splashRadius;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (distSq(e.pos, p.pos) <= rSq) {
        e.hp -= p.damage;
        e.flashUntil = world.time + 0.1;
        if (e.hp <= 0) {
          e.alive = false;
          world.gold += e.bounty;
          spawnParticles(world, e.pos, 10, "#c44848");
          emit(world, { type: "death", pos: e.pos });
        }
      }
    }
  } else {
    const target = p.targetId !== null ? world.enemies.find(e => e.id === p.targetId) : null;
    if (target && target.alive) {
      target.hp -= p.damage;
      target.flashUntil = world.time + 0.08;
      spawnParticles(world, p.pos, 3, "#ffe866", [1, 3], 0.2);
      if (target.hp <= 0) {
        target.alive = false;
        world.gold += target.bounty;
        spawnParticles(world, target.pos, 8, "#c44848");
        emit(world, { type: "death", pos: target.pos });
      }
    }
  }
};

export const updateProjectiles = (world: World, dt: number) => {
  for (const p of world.projectiles) {
    if (!p.alive) continue;

    if (p.targetId !== null && p.kind === "direct") {
      const target = world.enemies.find(e => e.id === p.targetId && e.alive);
      if (!target) {
        p.alive = false;
        continue;
      }
      p.targetPos = { x: target.pos.x, y: target.pos.y };
    }

    const step = p.speed * dt;
    const d = dist(p.pos, p.targetPos);
    if (d <= Math.max(step, HIT_RADIUS)) {
      p.pos = { ...p.targetPos };
      applyHit(world, p);
      p.alive = false;
    } else {
      const dir = normalize(sub(p.targetPos, p.pos));
      p.pos = add(p.pos, scale(dir, step));
    }
  }
  world.projectiles = world.projectiles.filter(p => p.alive);
};
