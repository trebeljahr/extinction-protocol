import { isOnLavaSurface } from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { isEnemyTargetable } from "./enemyState";
import { HERO_SPECS, type HeroVariantSpec } from "./heroVariants";
import type { DamageType, Enemy, Hero, HeroAbilitySlot, HeroVariant, Vec2, World } from "./types";
import { distSq } from "./vec2";
import {
  addShake,
  applyDamage,
  createExplosion,
  createProjectile,
  emit,
  HERO_RADIUS,
  HERO_RESPAWN_DELAY,
  ROCK_FOOTPRINT,
  spawnParticles,
  TOWER_FOOTPRINT,
  TREE_FOOTPRINT,
} from "./world";

const HERO_TURN_RATE = 9.5;
const HERO_ACCEL_HALFLIFE = 0.05;
const HERO_ARRIVE_RADIUS = 0.25;
const HERO_PUSH_ITERATIONS = 3;
const HERO_PROJECTILE_SPEED = 26;
// Seconds after the last damage tick before regen kicks back in.
const HERO_REGEN_DELAY = 4.0;
const HERO_REGEN_PER_SEC = 22;

const dampFactor = (dt: number, halflife: number) => 1 - 0.5 ** (dt / halflife);

const shortAngleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Push position out of any overlapping blocker by the smallest displacement
// along the connecting normal. Trees / rocks / towers all treated as
// disks; lava is sampled point-wise. Iterating 2-3× lets the hero squeeze
// between paired blockers instead of jittering against the first one we
// resolved.
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

const findEnemyByProgress = (world: World, pos: Vec2, range: number): Enemy | null => {
  const r2 = range * range;
  let best: Enemy | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const e of world.enemies) {
    if (!isEnemyTargetable(e)) continue;
    if (distSq(e.pos, pos) > r2) continue;
    const score = e.segment + e.segmentT;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
};

const fireHeroShot = (world: World, hero: Hero, target: Enemy) => {
  const dmg = hero.damage * hero.damageMul;
  if (hero.attackSplashRadius > 0) {
    createProjectile(
      world,
      "splash",
      hero.damageType,
      hero.pos,
      target.pos,
      dmg,
      hero.attackSplashRadius,
      HERO_PROJECTILE_SPEED,
      false,
    );
  } else {
    createProjectile(
      world,
      "direct",
      hero.damageType,
      hero.pos,
      target,
      dmg,
      0,
      HERO_PROJECTILE_SPEED,
      false,
    );
  }
  hero.shootFlashUntil = world.time + 0.18;
  emit(world, { type: "shoot", towerId: hero.id, towerKind: "pulse", pos: hero.pos });
};

const firePendingShot = (
  world: World,
  hero: Hero,
  shot: { damage: number; range: number; splashRadius: number; damageType: DamageType },
) => {
  const target = findEnemyByProgress(world, hero.pos, shot.range);
  if (!target) return;
  createProjectile(
    world,
    "splash",
    shot.damageType,
    hero.pos,
    target.pos,
    shot.damage * hero.damageMul,
    shot.splashRadius,
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
  if (world.time < hero.abilityActiveUntil[0]) return; // dash i-frames
  hero.hp -= amount;
  hero.flashUntil = world.time + 0.12;
  hero.lastDamagedAt = world.time;
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
    hero.selected = false;
    hero.motionState = "dead";
    hero.respawnAt = world.time + HERO_RESPAWN_DELAY;
    hero.moveTarget = null;
    hero.vel = { x: 0, y: 0 };
    hero.pendingShots.length = 0;
    hero.payload = null;
    spawnParticles(world, hero.pos, 32, "#ffb04a", [3, 7], 0.6);
    spawnParticles(world, hero.pos, 16, "#ff5a3a", [4, 9], 0.4);
    addShake(world, 0.45, 4);
    emit(world, { type: "death", pos: hero.pos });
  }
};

const respawnHero = (world: World, hero: Hero) => {
  hero.hp = hero.maxHp;
  hero.alive = true;
  hero.respawnAt = null;
  hero.motionState = "idle";
  hero.abilityActiveUntil[0] = world.time + 0.8; // brief respawn i-frames
  hero.attackCooldown = 0;
  spawnParticles(world, hero.pos, 24, "#9fd8ff", [2, 5], 0.5);
};

const dashDir = (hero: Hero): Vec2 => {
  if (hero.moveTarget) {
    const dx = hero.moveTarget.x - hero.pos.x;
    const dy = hero.moveTarget.y - hero.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-3) return { x: dx / d, y: dy / d };
  }
  return { x: Math.sin(hero.facing), y: Math.cos(hero.facing) };
};

// Mid-tick payload servicing for slot 2 ongoing effects. Mark drives a
// damage multiplier on the hero's outgoing damage; incinerate ticks
// flame damage on a locked target until either ends.
const tickPayload = (world: World, hero: Hero) => {
  const p = hero.payload;
  if (!p) {
    hero.damageMul = 1;
    return;
  }
  if (world.time >= p.endAt) {
    hero.payload = null;
    hero.damageMul = 1;
    return;
  }
  if (p.kind === "mark") {
    hero.damageMul = p.dmgMul;
    return;
  }
  if (p.kind === "incinerate") {
    hero.damageMul = 1;
    const target = world.enemyById.get(p.targetId);
    if (!target || !isEnemyTargetable(target)) {
      hero.payload = null;
      return;
    }
    if (world.time >= p.nextTickAt) {
      applyDamage(world, target, p.tickDamage, p.damageType, "#ffb054", 4);
      target.flashUntil = world.time + 0.1;
      spawnParticles(world, target.pos, 4, "#ff8a3a", [2, 5], 0.3);
      p.nextTickAt = world.time + 0.5;
    }
  }
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

  hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
  tickPayload(world, hero);

  // Drain queued multi-shot payload entries (barrage / saturation). Each
  // entry self-describes its damage so a re-spec mid-flight still lands
  // the planned hit. Iterates in-place via swap-and-pop.
  if (hero.pendingShots.length > 0) {
    let kept = 0;
    for (let i = 0; i < hero.pendingShots.length; i++) {
      const s = hero.pendingShots[i];
      if (world.time >= s.when) firePendingShot(world, hero, s);
      else hero.pendingShots[kept++] = s;
    }
    hero.pendingShots.length = kept;
  }

  const dashing = world.time < hero.abilityActiveUntil[0];
  // Pull dash speed from the spec so per-variant dash potency carries
  // through. Fallback to walk speed if the slot somehow lost the spec
  // (shouldn't happen — heroDefaults builds it).
  const variant = HERO_SPECS[hero.variant];
  const dashSpec = variant.abilities[0];
  const speed = dashing ? dashSpec.speed : hero.speed;

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
    const fx = Math.sin(hero.facing);
    const fy = Math.cos(hero.facing);
    desiredX = fx * dashSpec.speed;
    desiredY = fy * dashSpec.speed;
    walking = true;
  }

  const k = dampFactor(dt, HERO_ACCEL_HALFLIFE);
  hero.vel.x += (desiredX - hero.vel.x) * k;
  hero.vel.y += (desiredY - hero.vel.y) * k;
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

  if (walking) {
    const moved2 = (hero.pos.x - prevX) ** 2 + (hero.pos.y - prevY) ** 2;
    const expected = Math.max(hero.speed * dt * 0.25, 0.01);
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

  // Continuous melee chip from enemies in skirmish range. Scales by
  // enemy damage so a titan stomp hurts and a swarm tickles. Marks
  // hero.lastDamagedAt → regen suppression.
  const HERO_HURT_RANGE = 1.1;
  const hurtR2 = HERO_HURT_RANGE * HERO_HURT_RANGE;
  if (hero.alive && world.time >= hero.abilityActiveUntil[0]) {
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (e.leak) continue;
      if (distSq(e.pos, hero.pos) > hurtR2) continue;
      damageHero(world, e.damage * dt * 2.4);
      if (!hero.alive) break;
    }
  }
  if (
    hero.alive &&
    world.biome === "lava" &&
    world.time >= hero.abilityActiveUntil[0] &&
    isOnLavaSurface(world.lavaFeatures, hero.pos.x, hero.pos.y, HERO_RADIUS)
  ) {
    damageHero(world, 14 * dt);
  }
  if (!hero.alive) return;

  // Out-of-combat HP regen. Suppressed for HERO_REGEN_DELAY seconds
  // after any damage tick, so a grazing brush doesn't gate full regen.
  if (hero.hp < hero.maxHp && world.time - hero.lastDamagedAt > HERO_REGEN_DELAY) {
    hero.hp = Math.min(hero.maxHp, hero.hp + HERO_REGEN_PER_SEC * dt);
  }

  // Auto-attack — pick the closest in-range enemy. Doesn't fire while
  // dashing because the upper-body pose flips into the dash anim.
  const target = !dashing ? findHeroTarget(world, hero) : null;
  hero.targetId = target?.id ?? null;
  if (target && hero.attackCooldown === 0) {
    fireHeroShot(world, hero, target);
    hero.attackCooldown = 1 / hero.fireRate;
  }

  if (!hero.alive) hero.motionState = "dead";
  else if (dashing) hero.motionState = "dash";
  else if (world.time < hero.shootFlashUntil && !walking) hero.motionState = "shoot";
  else if (walking) hero.motionState = "walk";
  else hero.motionState = "idle";
};

// --- Player-issued actions ---------------------------------------------

export const orderHeroMove = (world: World, pos: Vec2) => {
  const hero = world.hero;
  if (!hero.alive) return;
  hero.moveTarget = { x: pos.x, y: pos.y };
};

export const selectHero = (world: World, on: boolean) => {
  const hero = world.hero;
  if (!hero.alive) return;
  hero.selected = on;
};

// Variant-aware ability dispatch. Slot 0 always = dash, slot 1 = burst,
// slot 2 = the variant's payload (barrage/mark/incinerate). The cooldown
// stored on the spec is scaled by hero.abilityCooldownMul (from the
// Power Core skill node) at trigger time so re-spec is one tick away.
export const triggerHeroAbility = (world: World, slot: HeroAbilitySlot): boolean => {
  const hero = world.hero;
  if (!hero.alive) return false;
  if (world.time < hero.abilityReadyAt[slot]) return false;

  const variant = HERO_SPECS[hero.variant];
  const spec = variant.abilities[slot];
  hero.abilityReadyAt[slot] = world.time + spec.cooldown * hero.abilityCooldownMul;

  if (spec.type === "dash") {
    const dir = dashDir(hero);
    hero.facing = Math.atan2(dir.x, dir.y);
    hero.abilityActiveUntil[0] = world.time + spec.duration;
    spawnParticles(world, hero.pos, 14, variant.tint, [2, 5], 0.35);
    return true;
  }

  if (spec.type === "burst") {
    const r2 = spec.radius * spec.radius;
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (distSq(e.pos, hero.pos) > r2) continue;
      applyDamage(world, e, spec.damage, spec.damageType, "#ffb054", 10);
      e.flashUntil = world.time + 0.12;
    }
    createExplosion(world, hero.pos, spec.radius, 0.45);
    spawnParticles(world, hero.pos, 24, variant.tint, [3, 7], 0.5);
    spawnParticles(world, hero.pos, 14, "#ff8a3a", [4, 9], 0.4);
    addShake(world, 0.4, 5);
    emit(world, { type: "impact", pos: hero.pos });
    return true;
  }

  if (spec.type === "barrage") {
    for (let i = 0; i < spec.count; i++) {
      hero.pendingShots.push({
        when: world.time + 0.05 + i * 0.09,
        range: spec.range,
        damage: spec.damage,
        splashRadius: spec.splashRadius,
        damageType: spec.damageType,
      });
    }
    return true;
  }

  if (spec.type === "mark") {
    hero.payload = { kind: "mark", endAt: world.time + spec.duration, dmgMul: spec.dmgMul };
    spawnParticles(world, hero.pos, 18, variant.tint, [2, 5], 0.5);
    return true;
  }

  if (spec.type === "incinerate") {
    const target = findEnemyByProgress(world, hero.pos, spec.range);
    if (!target) return false;
    const tickInterval = 0.5;
    const ticks = Math.max(1, Math.floor(spec.duration / tickInterval));
    hero.payload = {
      kind: "incinerate",
      targetId: target.id,
      endAt: world.time + spec.duration,
      nextTickAt: world.time + 0.05,
      tickDamage: spec.totalDamage / ticks,
      damageType: spec.damageType,
    };
    spawnParticles(world, target.pos, 24, "#ff8a3a", [3, 7], 0.5);
    emit(world, { type: "impact", pos: target.pos });
    return true;
  }

  return false;
};

// Helpers exported for store glue. Variant lookup avoids importing the
// spec table into hero consumers that just need stats for the HUD.
export const heroVariantStats = (variant: HeroVariant): HeroVariantSpec => HERO_SPECS[variant];
