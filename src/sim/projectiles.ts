import type { Projectile, World } from "./types";
import { distSq } from "./vec2";
import { addShake, applyDamage, createExplosion, emit, spawnParticles } from "./world";

const HIT_RADIUS = 0.5;

const applyHit = (world: World, p: Projectile) => {
  emit(world, { type: "impact", pos: p.pos });

  if (p.kind === "splash") {
    createExplosion(world, p.pos, p.splashRadius, 0.35);
    addShake(world, 0.25);
    spawnParticles(world, p.pos, 14, "#ffb266", [3, 7], 0.45);
    spawnParticles(world, p.pos, 8, "#fff2c8", [4, 9], 0.22);
    const rSq = p.splashRadius * p.splashRadius;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (distSq(e.pos, p.pos) <= rSq) {
        applyDamage(world, e, p.damage, p.damageType, "#c44848", 10);
        e.flashUntil = world.time + 0.1;
      }
    }
  } else {
    const target = p.targetId !== null ? world.enemyById.get(p.targetId) : null;
    if (target?.alive) {
      spawnParticles(world, p.pos, 3, "#ffe866", [1, 3], 0.2);
      applyDamage(world, target, p.damage, p.damageType);
    }
  }
};

export const updateProjectiles = (world: World, dt: number) => {
  const arr = world.projectiles;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (!p.alive) continue;

    if (p.targetId !== null && p.kind === "direct") {
      const target = world.enemyById.get(p.targetId);
      if (!target?.alive) {
        p.alive = false;
        continue;
      }
      p.targetPos.x = target.pos.x;
      p.targetPos.y = target.pos.y;
    }

    const step = p.speed * dt;
    const dx = p.targetPos.x - p.pos.x;
    const dy = p.targetPos.y - p.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= Math.max(step, HIT_RADIUS)) {
      p.pos.x = p.targetPos.x;
      p.pos.y = p.targetPos.y;
      applyHit(world, p);
      p.alive = false;
    } else {
      const inv = 1 / d;
      p.pos.x += dx * inv * step;
      p.pos.y += dy * inv * step;
    }
  }
  // Swap-and-pop dead in place.
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const p = arr[r];
    if (p.alive) arr[w++] = p;
  }
  arr.length = w;
};
