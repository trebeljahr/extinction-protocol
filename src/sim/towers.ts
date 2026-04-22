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

// Flamethrower — burns everything inside a forward cone. Damage is small
// but applied frequently so it reads as DoT on anything lingering in the
// stream.
const FLAME_HALF_CONE = Math.PI / 4; // 45° → 90° total spread
const FLAME_COS_HALF = Math.cos(FLAME_HALF_CONE);

const fireFlameDamage = (world: World, t: Tower, target: Enemy): boolean => {
  const dx = target.pos.x - t.pos.x;
  const dy = target.pos.y - t.pos.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;

  const rangeSq = t.range * t.range;
  let hit = false;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const ex = e.pos.x - t.pos.x;
    const ey = e.pos.y - t.pos.y;
    const d2 = ex * ex + ey * ey;
    if (d2 > rangeSq) continue;
    const eLen = Math.sqrt(d2) || 1;
    const dot = (ex * dirX + ey * dirY) / eLen;
    // Always include the locked target (avoid edge-case where target sits
    // right at the cone boundary and gets dropped due to FP noise).
    if (e !== target && dot < FLAME_COS_HALF) continue;
    hit = true;
    applyDamage(world, e, t.damage, "explosive", "#ffb54a", 3);
  }
  return hit;
};

// Continuous flame stream — emits a directed cone of particles every tick
// while the tower is targeting. Layered colours give a hot core + outer
// flame + trailing embers look.
const spawnFlameStream = (world: World, t: Tower, target: Enemy) => {
  const dx = target.pos.x - t.pos.x;
  const dy = target.pos.y - t.pos.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;
  const dir = { x: dirX, y: dirY };
  // Nozzle slightly in front of the tower so particles don't pop out of
  // its body.
  const nozzle = { x: t.pos.x + dirX * 0.55, y: t.pos.y + dirY * 0.55 };

  // Hot inner jet — bright yellow, narrowish, fast, short-lived.
  spawnParticles(world, nozzle, 6, "#fff0a0", [7.5, 10.5], 0.28, dir, Math.PI / 10);
  // Mid orange flames — main flame body, fills most of the cone.
  spawnParticles(world, nozzle, 8, "#ffb54a", [5.5, 8.5], 0.45, dir, Math.PI / 6);
  // Outer red wash + trailing embers, full damage cone, longest life so
  // they linger and drift after the stream sweeps past.
  spawnParticles(world, nozzle, 6, "#ff5a30", [4.0, 6.5], 0.7, dir, Math.PI / 4);
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

    // Flame is special — the *visible* stream runs every tick while a target
    // is in range, but damage ticks are gated by the cooldown so DPS stays
    // tunable. The shoot event (which drives audio) follows the damage tick.
    if (t.kind === "flame") {
      if (target) {
        spawnFlameStream(world, t, target);
        if (t.cooldown === 0) {
          fireFlameDamage(world, t, target);
          t.cooldown = 1 / t.fireRate;
          emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
        }
      }
      continue;
    }

    if (target && t.cooldown === 0) {
      // New towers reuse existing fire logic:
      //   gatling / cannon — single-target direct shot (same as pulse)
      //   plasma          — splash projectile (same as mortar, electric dmg)
      //   hive            — chain drones (same chain logic, more bounces)
      if (t.kind === "pulse" || t.kind === "gatling" || t.kind === "cannon") firePulse(world, t, target);
      else if (t.kind === "chain" || t.kind === "hive") fireChain(world, t, target);
      else if (t.kind === "mortar") fireMortar(world, t, target);
      else if (t.kind === "plasma") fireMortar(world, t, target);
      t.cooldown = 1 / t.fireRate;
      emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
    }
  }
};
