import type { Enemy, Tower, Vec2, World } from "./types";
import { distSq } from "./vec2";
import {
  applyDamage,
  applySlow,
  createBeam,
  createCryoWave,
  createProjectile,
  emit,
  spawnParticles,
} from "./world";

const scoreEnemy = (tower: Tower, e: Enemy): number => {
  if (tower.targetingMode === "tower") return -distSq(e.pos, tower.pos);
  if (tower.targetingMode === "start") return -(e.segment + e.segmentT);
  if (tower.targetingMode === "strongest") return e.maxHp;
  return e.segment + e.segmentT;
};

const findTargetInRange = (world: World, tower: Tower): Enemy | null => {
  const rangeSq = tower.range * tower.range;
  let best: Enemy | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
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
  const hitSet = new Set<Enemy>([primary]);
  let damage = t.damage;

  const chainRangeSq = 3.5 * 3.5;
  let current = primary;
  for (let i = 0; i < t.chainCount; i++) {
    let next: Enemy | null = null;
    let bestDistSq = chainRangeSq;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (hitSet.has(e)) continue;
      const d2 = distSq(e.pos, current.pos);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        next = e;
      }
    }
    if (!next) break;
    hit.push(next);
    hitSet.add(next);
    current = next;
  }

  const points = [t.pos, ...hit.map((e) => e.pos)];
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
//
// Particle reach has to track t.range so the visible flame wall lines up
// with the damage cone (also gated by t.range). Particles decay via
// `vel *= 1 - 2*dt` per tick in updateParticles; the continuous analogue
// is reach = v0/2 * (1 - exp(-2*lifetime)). Solving for v0 lets us pick
// initial speeds that land axial particles right at the range edge,
// regardless of any range upgrades.
const NOZZLE_OFFSET = 0.55;
const flameReachFactor = (life: number) => 0.5 * (1 - Math.exp(-2 * life));

const spawnFlameStream = (world: World, t: Tower, target: Enemy) => {
  const dx = target.pos.x - t.pos.x;
  const dy = target.pos.y - t.pos.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;
  const dir = { x: dirX, y: dirY };
  // Nozzle slightly in front of the tower so particles don't pop out of
  // its body.
  const nozzle = { x: t.pos.x + dirX * NOZZLE_OFFSET, y: t.pos.y + dirY * NOZZLE_OFFSET };

  const reach = Math.max(0.4, t.range - NOZZLE_OFFSET);
  const speedRange = (life: number, frac: number, jitter = 0.18): [number, number] => {
    const mid = (reach * frac) / flameReachFactor(life);
    return [mid * (1 - jitter), mid * (1 + jitter)];
  };

  const yellowLife = 0.28;
  const orangeLife = 0.45;
  const redLife = 0.7;

  // Hot inner jet — narrowish, fast, short-lived; reaches ~70% down the cone.
  // Color is warmer than pure white-yellow because additive blending stacks
  // these particles on top of the orange/red layers and the centerline used
  // to read as a blown-out white-hot core.
  spawnParticles(
    world,
    nozzle,
    4,
    "#ffc868",
    speedRange(yellowLife, 0.7),
    yellowLife,
    dir,
    Math.PI / 10,
  );
  // Mid orange flames — main flame body, fills most of the cone.
  spawnParticles(
    world,
    nozzle,
    8,
    "#ffb54a",
    speedRange(orangeLife, 0.9),
    orangeLife,
    dir,
    Math.PI / 6,
  );
  // Outer red wash + trailing embers — sized so axial embers land right at
  // the damage-cone edge (range), so the visible wall matches what burns.
  spawnParticles(world, nozzle, 6, "#ff5a30", speedRange(redLife, 1.0), redLife, dir, Math.PI / 4);
};

const fireMortarAtSpot = (world: World, t: Tower, pos: Vec2) => {
  createProjectile(
    world,
    "splash",
    "explosive",
    t.pos,
    { x: pos.x, y: pos.y },
    t.damage,
    t.splashRadius,
    14,
  );
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

    // Hive — each drone independently finds its own target from its own
    // orbit position and fires a small direct shot. Volleys are shared by
    // the tower cooldown so the per-drone `fireRate` stat is honest; the
    // interleaved visual comes from the orbit rotation, not the firing.
    //
    // Target selection runs every tick (not just at fire time) so the
    // renderer can read tower.droneTargetIds + world.enemyById and skip
    // its own per-frame O(drones × enemies) scan.
    if (t.kind === "hive") {
      const ids = t.droneTargetIds;
      for (let d = 0; d < HIVE_DRONE_COUNT; d++) {
        const dp = hiveDronePosition(t, world.time, d);
        ids[d] = findTargetNearPos(world, dp, t)?.id ?? null;
      }
      if (t.cooldown === 0) {
        let anyHit = false;
        for (let d = 0; d < HIVE_DRONE_COUNT; d++) {
          const tid = ids[d];
          if (tid === null) continue;
          const droneTarget = world.enemyById.get(tid);
          if (!droneTarget?.alive) continue;
          const dp = hiveDronePosition(t, world.time, d);
          anyHit = true;
          createProjectile(world, "direct", "kinetic", dp, droneTarget, t.damage);
        }
        if (anyHit) {
          t.cooldown = 1 / t.fireRate;
          emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
        }
      }
      continue;
    }

    if (target && t.cooldown === 0) {
      if (t.kind === "pulse") firePulse(world, t, target);
      else if (t.kind === "chain") fireChain(world, t, target);
      else if (t.kind === "mortar") fireMortar(world, t, target);
      t.cooldown = 1 / t.fireRate;
      emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
    }
  }
};

// --- Hive drones ------------------------------------------------------
//
// Three drones orbit each hive tower at a fixed radius and height. Each
// drone finds its OWN target (nearest live enemy within `tower.range`
// measured from the drone's world position) and fires from there, so the
// hive behaves like three tiny independent turrets whose spots happen to
// drift around the anchor.

export const HIVE_DRONE_COUNT = 3;
export const HIVE_ORBIT_RADIUS = 1.55;
export const HIVE_ORBIT_HEIGHT = 1.1;
const HIVE_ORBIT_SPEED = 0.55; // rad/s

export const hiveDroneAngle = (tower: Tower, time: number, droneIdx: number): number =>
  tower.id * 0.37 + (droneIdx * (2 * Math.PI)) / HIVE_DRONE_COUNT + time * HIVE_ORBIT_SPEED;

export const hiveDronePosition = (tower: Tower, time: number, droneIdx: number): Vec2 => {
  const a = hiveDroneAngle(tower, time, droneIdx);
  return {
    x: tower.pos.x + Math.cos(a) * HIVE_ORBIT_RADIUS,
    y: tower.pos.y + Math.sin(a) * HIVE_ORBIT_RADIUS,
  };
};

const findTargetNearPos = (world: World, pos: Vec2, tower: Tower): Enemy | null => {
  const r2 = tower.range * tower.range;
  let best: Enemy | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const d2 = distSq(e.pos, pos);
    if (d2 > r2) continue;
    // Nearest-to-drone targeting. Drones are small and reactive — they
    // should pepper whatever's next to them, not share the tower-level
    // targeting mode (which is keyed off the hive anchor).
    if (d2 < bestScore) {
      best = e;
      bestScore = d2;
    }
  }
  return best;
};
