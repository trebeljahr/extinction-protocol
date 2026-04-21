import type { World, Tower, Enemy } from "./types";
import { distSq } from "./vec2";
import { createProjectile, createBeam, emit, applySlow, spawnParticles } from "./world";

const findFurthestInRange = (world: World, tower: Tower): Enemy | null => {
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

const firePulse = (world: World, t: Tower, target: Enemy) => {
  createProjectile(world, "direct", t.pos, target, t.damage);
};

const fireChain = (world: World, t: Tower, primary: Enemy) => {
  const hit: Enemy[] = [primary];
  let damage = t.damage;
  primary.hp -= damage;
  primary.flashUntil = world.time + 0.08;

  const chainRangeSq = 3.5 * 3.5;
  let current = primary;
  for (let i = 0; i < t.chainCount; i++) {
    damage = Math.max(1, damage * t.chainFalloff);
    let next: Enemy | null = null;
    let bestDistSq = chainRangeSq;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (hit.includes(e)) continue;
      const d2 = distSq(e.pos, current.pos);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        next = e;
      }
    }
    if (!next) break;
    next.hp -= damage;
    next.flashUntil = world.time + 0.08;
    hit.push(next);
    current = next;
  }

  for (const e of hit) {
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      world.gold += e.bounty;
      spawnParticles(world, e.pos, 8, "#c44848");
      emit(world, { type: "death", pos: e.pos });
    }
  }

  const points = [t.pos, ...hit.map(e => e.pos)];
  createBeam(world, points, "#9fd8ff", 0.1);
};

const fireCryo = (world: World, t: Tower) => {
  const rangeSq = t.range * t.range;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, t.pos) > rangeSq) continue;
    e.hp -= t.damage;
    e.flashUntil = world.time + 0.06;
    applySlow(e, world, t.slowFactor, t.slowDuration);
    if (e.hp <= 0) {
      e.alive = false;
      world.gold += e.bounty;
      spawnParticles(world, e.pos, 6, "#bfe9ff");
      emit(world, { type: "death", pos: e.pos });
    }
  }
};

const fireMortar = (world: World, t: Tower, target: Enemy) => {
  createProjectile(world, "splash", t.pos, target.pos, t.damage, t.splashRadius, 14);
};

export const updateTowers = (world: World, dt: number) => {
  for (const t of world.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);

    if (t.kind === "cryo") {
      if (t.cooldown === 0) {
        fireCryo(world, t);
        t.cooldown = 1 / t.fireRate;
        emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
      }
      continue;
    }

    let target: Enemy | null = null;
    if (t.targetId !== null) {
      const current = world.enemies.find(e => e.id === t.targetId && e.alive);
      if (current && distSq(current.pos, t.pos) <= t.range * t.range) {
        target = current;
      }
    }
    if (!target) target = findFurthestInRange(world, t);
    t.targetId = target?.id ?? null;

    if (target && t.cooldown === 0) {
      if (t.kind === "pulse") firePulse(world, t, target);
      else if (t.kind === "chain") fireChain(world, t, target);
      else if (t.kind === "mortar") fireMortar(world, t, target);
      t.cooldown = 1 / t.fireRate;
      emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
    }
  }
};
