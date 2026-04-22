import type { World, Tower, Enemy } from "./types";
import { distSq } from "./vec2";
import { createProjectile, createBeam, emit, applySlow, applyDamage } from "./world";

const scoreEnemy = (tower: Tower, e: Enemy): number => {
  if (tower.targetingMode === "tower") return -distSq(e.pos, tower.pos);
  if (tower.targetingMode === "start") return -(e.segment + e.segmentT);
  if (tower.targetingMode === "strongest") return e.maxHp;
  return e.segment + e.segmentT;
};

const findTargetInRange = (world: World, tower: Tower): Enemy | null => {
  const rangeSq = tower.range * tower.range;
  let best: Enemy | null = null;
  let bestScore = -Infinity;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, tower.pos) > rangeSq) continue;
    const score = scoreEnemy(tower, e);
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
};

const firePulse = (world: World, t: Tower, target: Enemy) => {
  createProjectile(world, "direct", "kinetic", t.pos, target, t.damage);
};

const fireChain = (world: World, t: Tower, primary: Enemy) => {
  const hit: Enemy[] = [primary];
  let damage = t.damage;

  const chainRangeSq = 3.5 * 3.5;
  let current = primary;
  for (let i = 0; i < t.chainCount; i++) {
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
    hit.push(next);
    current = next;
  }

  const points = [t.pos, ...hit.map(e => e.pos)];
  createBeam(world, points, "#9fd8ff", 0.1);

  for (const e of hit) {
    applyDamage(world, e, damage, "electric");
    damage = Math.max(1, damage * t.chainFalloff);
  }
};

const fireCryo = (world: World, t: Tower): boolean => {
  const rangeSq = t.range * t.range;
  let hit = false;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, t.pos) > rangeSq) continue;
    hit = true;
    applySlow(e, world, t.slowFactor, t.slowDuration);
    e.flashUntil = world.time + 0.06;
    if (t.damage > 0) applyDamage(world, e, t.damage, "cold", "#bfe9ff", 6);
  }
  return hit;
};

const fireMortar = (world: World, t: Tower, target: Enemy) => {
  createProjectile(world, "splash", "explosive", t.pos, target.pos, t.damage, t.splashRadius, 14);
};

export const updateTowers = (world: World, dt: number) => {
  for (const t of world.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);

    if (t.kind === "cryo") {
      if (t.cooldown === 0) {
        const didHit = fireCryo(world, t);
        if (didHit) {
          t.cooldown = 1 / t.fireRate;
          emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
        }
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
    if (!target) target = findTargetInRange(world, t);
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
