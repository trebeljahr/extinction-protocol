import type { World, Tower, Enemy, Vec2 } from "./types";
import { distSq } from "./vec2";
import { createProjectile, createBeam, createCryoWave, emit, applySlow, applyDamage, spawnParticles } from "./world";

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
    spawnParticles(world, e.pos, 3, "#cdf4ff", [1.2, 2.4], 0.55);
    if (t.damage > 0) applyDamage(world, e, t.damage, "cold", "#bfe9ff", 6);
  }
  if (hit) createCryoWave(world, t.pos, t.range);
  return hit;
};

const fireMortar = (world: World, t: Tower, target: Enemy) => {
  createProjectile(world, "splash", "explosive", t.pos, target.pos, t.damage, t.splashRadius, 14);
};

// Flamethrower — hit every enemy in short range each tick. Damage per hit is
// small but fire rate is high, so it reads as DoT on anything lingering in
// the cone. No slow, no projectiles — just direct AoE damage.
const fireFlame = (world: World, t: Tower): boolean => {
  const rangeSq = t.range * t.range;
  let hit = false;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, t.pos) > rangeSq) continue;
    hit = true;
    applyDamage(world, e, t.damage, "explosive", "#ffb54a", 4);
    spawnParticles(world, e.pos, 2, "#ffb54a", [1.4, 2.6], 0.4);
  }
  return hit;
};

const fireMortarAtSpot = (world: World, t: Tower, pos: Vec2) => {
  createProjectile(world, "splash", "explosive", t.pos, { x: pos.x, y: pos.y }, t.damage, t.splashRadius, 14);
};

// Only fire at the spot if at least one live enemy is within splash radius;
// otherwise we're just wasting the cooldown.
const enemyInSplash = (world: World, spot: Vec2, splashRadius: number): boolean => {
  const r2 = splashRadius * splashRadius;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, spot) <= r2) return true;
  }
  return false;
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

    // Spot-targeting: mortars only. Aim at the fixed spot and only fire when
    // something is actually in its splash — saves ammo while still letting
    // the player pre-sight a chokepoint.
    if (t.kind === "mortar" && t.targetingMode === "spot") {
      t.targetId = null;
      if (t.targetSpot && t.cooldown === 0) {
        const inRange = distSq(t.targetSpot, t.pos) <= t.range * t.range;
        if (inRange && enemyInSplash(world, t.targetSpot, t.splashRadius)) {
          fireMortarAtSpot(world, t, t.targetSpot);
          t.cooldown = 1 / t.fireRate;
          emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
        }
      }
      continue;
    }

    // Re-evaluate target every tick so the mode always reflects current
    // battlefield state — a slow enemy being passed by a faster one in "end"
    // mode should get dropped immediately, not at the old target's death.
    const target = findTargetInRange(world, t);
    t.targetId = target?.id ?? null;

    if (target && t.cooldown === 0) {
      // New towers reuse existing fire logic:
      //   gatling / cannon — single-target direct shot (same as pulse)
      //   plasma          — splash projectile (same as mortar, electric dmg)
      //   flame           — cryo-like AoE but with damage instead of slow
      //   hive            — chain drones (same chain logic, more bounces)
      if (t.kind === "pulse" || t.kind === "gatling" || t.kind === "cannon") firePulse(world, t, target);
      else if (t.kind === "chain" || t.kind === "hive") fireChain(world, t, target);
      else if (t.kind === "mortar") fireMortar(world, t, target);
      else if (t.kind === "plasma") fireMortar(world, t, target);
      else if (t.kind === "flame") fireFlame(world, t);
      t.cooldown = 1 / t.fireRate;
      emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
    }
  }
};
