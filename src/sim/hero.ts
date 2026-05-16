import { isOnLavaSurface } from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { isEnemyTargetable } from "./enemyState";
import type { Enemy, Hero, Vec2, World } from "./types";
import { distSq } from "./vec2";
import {
  addShake,
  applyDamage,
  createExplosion,
  createProjectile,
  emit,
  HERO_BARRAGE_DAMAGE,
  HERO_BARRAGE_RANGE,
  HERO_BASE_SPEED,
  HERO_DASH_DURATION,
  HERO_DASH_SPEED,
  HERO_MAX_HP,
  HERO_RADIUS,
  HERO_RESPAWN_DELAY,
  HERO_SHOCKWAVE_DAMAGE,
  HERO_SHOCKWAVE_RADIUS,
  ROCK_FOOTPRINT,
  spawnParticles,
  TOWER_FOOTPRINT,
  TREE_FOOTPRINT,
} from "./world";

const HERO_TURN_RATE = 9.5; // rad/s
const HERO_ACCEL_HALFLIFE = 0.05;
const HERO_ARRIVE_RADIUS = 0.25;
const HERO_PUSH_ITERATIONS = 3;
const HERO_PROJECTILE_SPEED = 26;

const dampFactor = (dt: number, halflife: number) => 1 - 0.5 ** (dt / halflife);

const shortAngleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Push position out of any overlapping blocker by the smallest displacement
// along the connecting normal. Trees / rocks / towers all treated as
// disks; lava is sampled point-wise and gets a short fixed kick. Iterating
// 2-3× lets the hero squeeze between paired blockers instead of jittering
// against the first one we resolved.
const resolveOverlap = (world: World, pos: Vec2, radius: number): Vec2 => {
  let x = pos.x;
  let y = pos.y;
  for (let iter = 0; iter < HERO_PUSH_ITERATIONS; iter++) {
    let moved = false;
    for (const tr of world.trees) {
      const r = TREE_FOOTPRINT * tr.scale + radius;
      const dx = x - tr.pos.x;
      const dy = y - tr.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
        moved = true;
      }
    }
    for (const rk of world.rocks) {
      const r = ROCK_FOOTPRINT * rk.scale + radius;
      const dx = x - rk.pos.x;
      const dy = y - rk.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
        moved = true;
      }
    }
    for (const t of world.towers) {
      const r = TOWER_FOOTPRINT * 0.6 + radius;
      const dx = x - t.pos.x;
      const dy = y - t.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
        moved = true;
      }
    }
    // Lava is intentionally not a positional blocker — mecha treats it
    // as crossable terrain. The lava biome applies damage-over-time via
    // a separate per-tick check (see updateHero) so the player feels the
    // burn without the resolver pinning her at the shore.
    if (!moved) break;
  }
  const halfW = MAP_WIDTH / 2 - radius;
  const halfH = MAP_HEIGHT / 2 - radius;
  if (x < -halfW) x = -halfW;
  if (x > halfW) x = halfW;
  if (y < -halfH) y = -halfH;
  if (y > halfH) y = halfH;
  return { x, y };
};

const findHeroTarget = (world: World, hero: Hero): Enemy | null => {
  const r2 = hero.range * hero.range;
  let best: Enemy | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const e of world.enemies) {
    if (!isEnemyTargetable(e)) continue;
    const d2 = distSq(e.pos, hero.pos);
    if (d2 > r2) continue;
    if (d2 < bestDistSq) {
      best = e;
      bestDistSq = d2;
    }
  }
  return best;
};

const findBarrageTarget = (world: World, hero: Hero): Enemy | null => {
  const r2 = HERO_BARRAGE_RANGE * HERO_BARRAGE_RANGE;
  // Pick the enemy with the most progress so missiles funnel toward the
  // threats closest to HQ — feels like the hero is "covering" the lane.
  let best: Enemy | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const e of world.enemies) {
    if (!isEnemyTargetable(e)) continue;
    const d2 = distSq(e.pos, hero.pos);
    if (d2 > r2) continue;
    const score = e.segment + e.segmentT;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
};

const fireHeroShot = (world: World, hero: Hero, target: Enemy) => {
  createProjectile(
    world,
    "direct",
    "kinetic",
    hero.pos,
    target,
    hero.damage,
    0,
    HERO_PROJECTILE_SPEED,
    false,
  );
  hero.shootFlashUntil = world.time + 0.18;
  emit(world, { type: "shoot", towerId: hero.id, towerKind: "pulse", pos: hero.pos });
};

const fireBarrageShot = (world: World, hero: Hero) => {
  const target = findBarrageTarget(world, hero);
  if (!target) return;
  createProjectile(
    world,
    "splash",
    "explosive",
    hero.pos,
    target.pos,
    HERO_BARRAGE_DAMAGE,
    1.2,
    18,
    false,
  );
  emit(world, { type: "shoot", towerId: hero.id, towerKind: "mortar", pos: hero.pos });
};

// Applies hero damage path — leaks through invincibility while dashing
// and during respawn grace. Negative HP triggers respawn timer.
export const damageHero = (world: World, amount: number) => {
  const hero = world.hero;
  if (!hero.alive) return;
  if (world.time < hero.dashUntil) return; // dash i-frames
  hero.hp -= amount;
  hero.flashUntil = world.time + 0.12;
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
    hero.motionState = "dead";
    hero.respawnAt = world.time + HERO_RESPAWN_DELAY;
    hero.moveTarget = null;
    hero.vel = { x: 0, y: 0 };
    hero.barrageQueue.length = 0;
    spawnParticles(world, hero.pos, 32, "#ffb04a", [3, 7], 0.6);
    spawnParticles(world, hero.pos, 16, "#ff5a3a", [4, 9], 0.4);
    addShake(world, 0.45, 4);
    emit(world, { type: "death", pos: hero.pos });
  }
};

const respawnHero = (world: World, hero: Hero) => {
  hero.hp = HERO_MAX_HP;
  hero.alive = true;
  hero.respawnAt = null;
  hero.motionState = "idle";
  hero.dashUntil = 0;
  hero.cooldown = 0;
  // Brief invincibility window via dashUntil so the player doesn't die
  // again instantly if respawning into a packed lane.
  hero.dashUntil = world.time + 0.8;
  spawnParticles(world, hero.pos, 24, "#9fd8ff", [2, 5], 0.5);
};

// Each tick: order → desired velocity → obstacle resolve → facing →
// targeting + auto-shoot → ability state advancement.
export const updateHero = (world: World, dt: number) => {
  const hero = world.hero;

  if (!hero.alive) {
    if (hero.respawnAt !== null && world.time >= hero.respawnAt) {
      respawnHero(world, hero);
    } else {
      return;
    }
  }

  hero.cooldown = Math.max(0, hero.cooldown - dt);

  // Process scheduled barrage missiles (one fires per queue entry whose
  // time has come). Drains the queue in-place.
  if (hero.barrageQueue.length > 0) {
    let kept = 0;
    for (let i = 0; i < hero.barrageQueue.length; i++) {
      const entry = hero.barrageQueue[i];
      if (world.time >= entry.when) {
        fireBarrageShot(world, hero);
      } else {
        hero.barrageQueue[kept++] = entry;
      }
    }
    hero.barrageQueue.length = kept;
  }

  const dashing = world.time < hero.dashUntil;
  const speed = dashing ? HERO_DASH_SPEED : HERO_BASE_SPEED;

  // Desired velocity: head toward moveTarget if set; otherwise idle to
  // zero. Arrive smoothing avoids overshooting the click point.
  let desiredX = 0;
  let desiredY = 0;
  let walking = false;
  if (hero.moveTarget) {
    const dx = hero.moveTarget.x - hero.pos.x;
    const dy = hero.moveTarget.y - hero.pos.y;
    const d = Math.hypot(dx, dy);
    if (d <= HERO_ARRIVE_RADIUS) {
      hero.moveTarget = null;
    } else {
      const slow = d < 1.2 ? d / 1.2 : 1;
      const v = speed * slow;
      desiredX = (dx / d) * v;
      desiredY = (dy / d) * v;
      walking = true;
    }
  }

  if (dashing) {
    // Dash overrides arrive smoothing — fixed-speed lunge along stored
    // facing direction so the burst feels punchy. Facing was snapped to
    // move-target (or last facing) at dash trigger time.
    const fx = Math.sin(hero.facing);
    const fy = Math.cos(hero.facing);
    desiredX = fx * HERO_DASH_SPEED;
    desiredY = fy * HERO_DASH_SPEED;
    walking = true;
  }

  // Smooth velocity so direction changes look mechanical, not snappy.
  const k = dampFactor(dt, HERO_ACCEL_HALFLIFE);
  hero.vel.x += (desiredX - hero.vel.x) * k;
  hero.vel.y += (desiredY - hero.vel.y) * k;
  // Snap micro-motion to zero so the idle state actually triggers.
  if (Math.abs(hero.vel.x) < 0.05 && Math.abs(hero.vel.y) < 0.05) {
    hero.vel.x = 0;
    hero.vel.y = 0;
  }

  const candidate: Vec2 = {
    x: hero.pos.x + hero.vel.x * dt,
    y: hero.pos.y + hero.vel.y * dt,
  };
  const prevX = hero.pos.x;
  const prevY = hero.pos.y;
  const resolved = resolveOverlap(world, candidate, HERO_RADIUS);
  hero.pos = resolved;

  // Stuck detection — if we tried to move but the resolver clamped us
  // back to almost the same spot, accumulate stuck time and abort the
  // order after it crosses ~0.6s. Prevents wedging into a tree center.
  if (walking) {
    const moved2 = (hero.pos.x - prevX) ** 2 + (hero.pos.y - prevY) ** 2;
    const expected = Math.max(HERO_BASE_SPEED * dt * 0.25, 0.01);
    if (moved2 < expected * expected) {
      hero.stuckTimer += dt;
      if (hero.stuckTimer > 0.6) {
        hero.moveTarget = null;
        hero.stuckTimer = 0;
      }
    } else {
      hero.stuckTimer = 0;
    }
  } else {
    hero.stuckTimer = 0;
  }

  // Facing: lock to motion direction when moving, otherwise track target.
  const movingMagSq = hero.vel.x * hero.vel.x + hero.vel.y * hero.vel.y;
  let targetYaw = hero.facing;
  if (movingMagSq > 0.04) {
    targetYaw = Math.atan2(hero.vel.x, hero.vel.y);
  } else {
    const target = findHeroTarget(world, hero);
    if (target) {
      targetYaw = Math.atan2(target.pos.x - hero.pos.x, target.pos.y - hero.pos.y);
    }
  }
  const ky = 1 - Math.exp(-HERO_TURN_RATE * dt);
  hero.facing += shortAngleDelta(hero.facing, targetYaw) * ky;

  // Continuous melee chip from enemies in skirmish range — hero takes
  // pressure from being in a pack, but isn't insta-killed by a brush.
  // Scaled by enemy damage so a titan stomp hurts and a swarm tickles.
  const HERO_HURT_RANGE = 1.1;
  const hurtR2 = HERO_HURT_RANGE * HERO_HURT_RANGE;
  if (hero.alive && world.time >= hero.dashUntil) {
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (e.leak) continue;
      if (distSq(e.pos, hero.pos) > hurtR2) continue;
      damageHero(world, e.damage * dt * 2.4);
      if (!hero.alive) break;
    }
  }
  // Lava-biome scorch damage: standing on the lava surface chips the
  // hero so the player still treats it like terrain to respect, but
  // can wade across briefly when needed. Forest rivers + alien goo
  // share the lavaFeatures channel — only the lava biome actually
  // hurts. Dash i-frames extend to lava too.
  if (
    hero.alive &&
    world.biome === "lava" &&
    world.time >= hero.dashUntil &&
    isOnLavaSurface(world.lavaFeatures, hero.pos.x, hero.pos.y, HERO_RADIUS)
  ) {
    damageHero(world, 14 * dt);
  }
  if (!hero.alive) return;

  // Auto-targeting + shooting. Pick a new target every tick so the hero
  // pivots fire from one enemy to another without delay. Doesn't shoot
  // while dashing — the dash anim overrides the upper-body pose.
  const target = !dashing ? findHeroTarget(world, hero) : null;
  hero.targetId = target?.id ?? null;
  if (target && hero.cooldown === 0) {
    fireHeroShot(world, hero, target);
    hero.cooldown = 1 / hero.fireRate;
  }

  // Motion state for the renderer.
  if (!hero.alive) hero.motionState = "dead";
  else if (dashing) hero.motionState = "dash";
  else if (world.time < hero.shootFlashUntil && !walking) hero.motionState = "shoot";
  else if (walking) hero.motionState = "walk";
  else hero.motionState = "idle";
};

// Player-issued actions — invoked from store actions. All run against the
// world.hero singleton and are no-ops while dead so spam doesn't queue
// stale orders.
export const orderHeroMove = (world: World, pos: Vec2) => {
  const hero = world.hero;
  if (!hero.alive) return;
  hero.moveTarget = { x: pos.x, y: pos.y };
};

export const triggerHeroAbility = (
  world: World,
  ability: "dash" | "shockwave" | "barrage",
): boolean => {
  const hero = world.hero;
  if (!hero.alive) return false;

  if (ability === "dash") {
    if (world.time < hero.dashReadyAt) return false;
    if (hero.moveTarget) {
      const dx = hero.moveTarget.x - hero.pos.x;
      const dy = hero.moveTarget.y - hero.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-3) hero.facing = Math.atan2(dx, dy);
    }
    hero.dashUntil = world.time + HERO_DASH_DURATION;
    hero.dashReadyAt = world.time + 5.5;
    spawnParticles(world, hero.pos, 14, "#9fd8ff", [2, 5], 0.35);
    return true;
  }

  if (ability === "shockwave") {
    if (world.time < hero.shockwaveReadyAt) return false;
    hero.shockwaveReadyAt = world.time + 10.0;
    const r2 = HERO_SHOCKWAVE_RADIUS * HERO_SHOCKWAVE_RADIUS;
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (distSq(e.pos, hero.pos) > r2) continue;
      applyDamage(world, e, HERO_SHOCKWAVE_DAMAGE, "explosive", "#ffb054", 10);
      e.flashUntil = world.time + 0.12;
    }
    createExplosion(world, hero.pos, HERO_SHOCKWAVE_RADIUS, 0.45);
    spawnParticles(world, hero.pos, 24, "#ffd6a0", [3, 7], 0.5);
    spawnParticles(world, hero.pos, 14, "#ff8a3a", [4, 9], 0.4);
    addShake(world, 0.4, 5);
    emit(world, { type: "impact", pos: hero.pos });
    return true;
  }

  if (ability === "barrage") {
    if (world.time < hero.barrageReadyAt) return false;
    hero.barrageReadyAt = world.time + 14.0;
    const count = 6;
    for (let i = 0; i < count; i++) {
      hero.barrageQueue.push({ when: world.time + 0.05 + i * 0.09 });
    }
    return true;
  }

  return false;
};
