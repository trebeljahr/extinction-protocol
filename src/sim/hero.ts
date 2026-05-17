import { isOnLavaSurface } from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { isEnemyTargetable } from "./enemyState";
import { HERO_SPECS, type HeroVariantSpec } from "./heroVariants";
import { pathProgress, projectOnPath, smoothDirection } from "./path";
import type {
  DamageType,
  Enemy,
  EntityId,
  Hero,
  HeroAbilitySlot,
  HeroVariant,
  Vec2,
  World,
} from "./types";
import { distSq } from "./vec2";
import {
  addShake,
  applyDamage,
  applyHeroBurn,
  applyPathKnockback,
  createBeam,
  createCoalEmber,
  createExplosion,
  createHeroCrater,
  createProjectile,
  ENEMY_HERO_DAMAGE,
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
// Look-ahead steering — distance the hero "sees" ahead of their motion
// for trees/rocks/towers. Anything inside the lateral clearance band
// applies a sideways nudge so the hero arcs around it instead of
// hitting + sliding off via resolveOverlap. Mostly redundant now that
// move orders are path-bound, but kept as a safety net for dash
// overshoot and forced re-pathing.
const HERO_AVOID_LOOKAHEAD = 2.6;
const HERO_AVOID_CLEARANCE = 0.25;
const HERO_AVOID_STRENGTH = 2.4;
// Visual hover offset (world units) while over a liquid surface.
const HERO_HOVER_HEIGHT = 0.55;
const HERO_HOVER_HALFLIFE = 0.12;
// How far off the path centerline the player can park the hero. Roughly
// half of the painted lane so the hero never visually drifts off-road.
export const HERO_LANE_HALF = 0.7;
// Lateral offset eases toward the target value at this rate (units/sec)
// so swapping sides feels smooth, not snappy.
const HERO_LATERAL_LERP_PER_SEC = 2.2;
// Skirmish: how far the hero will reach to "engage" the closest dino
// in melee. Engaged dinos halt forward path movement until the hero
// either dies, dashes free, or walks out of this range.
const HERO_ENGAGE_RANGE = 1.6;
// Window in which a Mike pre-dash aim stays valid before auto-clearing.
const DASH_AIM_LIFETIME = 4.0;
// Mike dash coal-trail tuning.
const COAL_DROP_INTERVAL = 0.045; // ~9 embers per default 0.4s dash
const COAL_TICK_DAMAGE = 16;
const COAL_RADIUS = 0.85;
const COAL_LIFETIME = 2.6;

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

const findHeroTarget = (world: World, hero: Hero, rangeMul = 1): Enemy | null => {
  const effRange = hero.range * rangeMul;
  const r2 = effRange * effRange;
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
  const variant = HERO_SPECS[hero.variant];
  // George Sidestep flags the next shot as a piercing crit (×mul, no
  // projectile travel — applied as a hitscan tracer so the lunge → shot
  // combo reads instantly). Consumed on fire.
  const crit = hero.pendingCrit;
  hero.pendingCrit = null;
  const critMul = crit ? crit.mul : 1;
  const dmg = hero.damage * hero.damageMul * critMul;

  // Hitscan tracer (George sniper) — direct hit, no projectile entity.
  // Draw a thin beam from hero → target for the visual read.
  if (variant.attackTracer || crit?.pierce) {
    applyDamage(world, target, dmg, hero.damageType, "#fff4d6", crit ? 12 : 5);
    createBeam(world, [hero.pos, target.pos], crit ? "#ffe9a0" : "#cfe8ff", 0.12);
    spawnParticles(world, hero.pos, 4, "#cfe8ff", [2, 5], 0.18);
    spawnParticles(world, target.pos, crit ? 14 : 6, crit ? "#ffe9a0" : "#cfe8ff", [3, 7], 0.3);
    if (crit) addShake(world, 0.3, 5);
  } else if (hero.attackSplashRadius > 0) {
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
      { fromHero: true },
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
      { fromHero: true },
    );
  }

  // Leela auto-attack chain — fork to N nearby additional enemies after
  // the primary hit. Damage applied directly so a chain beam reads in
  // the same frame as the primary projectile fire.
  if (variant.attackChain) {
    const { hops, damagePerHop, radius } = variant.attackChain;
    const r2 = radius * radius;
    const seen = new Set<number>([target.id]);
    let from = target;
    for (let i = 0; i < hops; i++) {
      let next: Enemy | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const e of world.enemies) {
        if (!isEnemyTargetable(e)) continue;
        if (seen.has(e.id)) continue;
        const d2 = distSq(e.pos, from.pos);
        if (d2 > r2) continue;
        if (d2 < best) {
          best = d2;
          next = e;
        }
      }
      if (!next) break;
      applyDamage(world, next, damagePerHop * hero.damageMul, hero.damageType, "#cfe8ff", 4);
      createBeam(world, [from.pos, next.pos], "#7ee0ff", 0.1);
      seen.add(next.id);
      from = next;
    }
  }

  // Mike Ignition (slot 2 buff) tags every shot with a short burn DoT.
  const buffSpec = variant.abilities[2];
  if (
    buffSpec.type === "buff" &&
    buffSpec.igniteOnHit &&
    hero.selfBuff &&
    world.time < hero.selfBuff.endAt
  ) {
    applyHeroBurn(world, target, buffSpec.igniteOnHit.duration, buffSpec.igniteOnHit.totalDamage);
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
    { fromHero: true },
  );
  emit(world, { type: "shoot", towerId: hero.id, towerKind: "mortar", pos: hero.pos });
};

// Applies hero damage path — leaks through invincibility while dashing
// and during respawn grace. Negative HP triggers respawn timer. Death
// fires a multi-layer explosion (warm fireball, white-hot core, ground
// shockwave) mirroring the HQ destruction sequence so a wipe feels
// equally violent.
export const damageHero = (world: World, amount: number) => {
  const hero = world.hero;
  if (!hero.alive) return;
  if (world.time < hero.abilityActiveUntil[0]) return; // dash i-frames
  // Slot-2 self-buff damage resist absorbs a fraction of every hit.
  // Clamped to <1 so a max-resist buff still leaks a sliver of damage.
  const resist = Math.min(0.95, Math.max(0, hero.damageResist));
  hero.hp -= amount * (1 - resist);
  hero.flashUntil = world.time + 0.12;
  hero.lastDamagedAt = world.time;
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
    hero.selected = false;
    hero.dashAim = null;
    hero.motionState = "dead";
    hero.respawnAt = world.time + HERO_RESPAWN_DELAY;
    hero.lastDeathAt = world.time;
    hero.moveTarget = null;
    hero.vel = { x: 0, y: 0 };
    hero.pendingShots.length = 0;
    hero.payload = null;
    // Drop engagement on every dino that was locked onto this hero so
    // they resume marching instead of attacking thin air.
    for (const e of world.enemies) {
      if (e.engagedHeroId === hero.id) e.engagedHeroId = null;
    }
    // HQ-style explosion: warm fireball + hot core + ground shockwave.
    createExplosion(world, hero.pos, 2.4, 0.7);
    spawnParticles(world, hero.pos, 48, "#ffb04a", [4, 9], 0.7);
    spawnParticles(world, hero.pos, 28, "#ff5a3a", [5, 11], 0.55);
    spawnParticles(world, hero.pos, 22, "#fff4d6", [2, 5], 0.35);
    addShake(world, 0.7, 3.2);
    emit(world, { type: "death", pos: hero.pos });
  }
};

// Cursor-driven aim direction setter — UI calls this each pointermove
// while hero.dashAim is active so the rendered arrow tracks the mouse.
export const setHeroDashAimDir = (world: World, dir: Vec2) => {
  const hero = world.hero;
  if (!hero.alive || !hero.dashAim) return;
  const d = Math.hypot(dir.x, dir.y);
  if (d < 1e-3) return;
  hero.dashAim.dir = { x: dir.x / d, y: dir.y / d };
};

// Cancels a pending Mike dash aim (Escape, deselect, variant swap).
// Cooldown was never consumed, so the dash remains ready.
export const cancelHeroDashAim = (world: World) => {
  const hero = world.hero;
  if (!hero.dashAim) return;
  hero.dashAim = null;
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

// Forward-corridor blocker bypass. When a tower/tree/rock sits in the
// hero's near-future path corridor, return a lateral target that steps
// around it on the side closest to the original `defaultLateral`. May
// exceed HERO_LANE_HALF — the lane clamp is intentionally overridden
// here so the hero can route around obstacles that intrude on the lane
// envelope (notably towers placed at the lane edge). Iterates blockers
// sequentially; each pass refines `lateral` against any blocker still
// within the corridor at the updated lateral.
const BLOCKER_BYPASS_LOOKAHEAD = 3.0;
const BLOCKER_BYPASS_BEHIND = 0.4;
const BLOCKER_BYPASS_CLEARANCE = 0.18;
const BLOCKER_BYPASS_MAX_LATERAL = 2.2;

const lateralBypassForBlockers = (
  world: World,
  path: Vec2[],
  heroProgress: number,
  defaultLateral: number,
  forwardSign: number,
): number => {
  let lateral = defaultLateral;
  const dir = forwardSign >= 0 ? 1 : -1;
  const consider = (cx: number, cy: number, br: number) => {
    const proj = projectOnPath(path, { x: cx, y: cy });
    const bProg = pathProgress(path, proj.segment, proj.segmentT);
    const along = (bProg - heroProgress) * dir;
    if (along < -BLOCKER_BYPASS_BEHIND || along > BLOCKER_BYPASS_LOOKAHEAD) return;
    const minGap = br + HERO_RADIUS + BLOCKER_BYPASS_CLEARANCE;
    if (Math.abs(proj.lateralOffset - lateral) >= minGap) return;
    const lowSide = proj.lateralOffset - minGap;
    const highSide = proj.lateralOffset + minGap;
    const distLow = Math.abs(defaultLateral - lowSide);
    const distHigh = Math.abs(defaultLateral - highSide);
    lateral = distLow <= distHigh ? lowSide : highSide;
  };
  for (const t of world.towers) consider(t.pos.x, t.pos.y, TOWER_FOOTPRINT * 0.6);
  for (const tr of world.trees) consider(tr.pos.x, tr.pos.y, TREE_FOOTPRINT * tr.scale);
  for (const rk of world.rocks) consider(rk.pos.x, rk.pos.y, ROCK_FOOTPRINT * rk.scale);
  if (lateral > BLOCKER_BYPASS_MAX_LATERAL) lateral = BLOCKER_BYPASS_MAX_LATERAL;
  if (lateral < -BLOCKER_BYPASS_MAX_LATERAL) lateral = -BLOCKER_BYPASS_MAX_LATERAL;
  return lateral;
};

// Local steering: nudge desired velocity sideways around any blocker
// the hero is heading at. Skips obstacles behind the hero or outside
// the look-ahead cone. Multiple obstacles sum so a cluster (grove)
// produces a clean arc rather than oscillation. Returns the steered
// velocity; falls through unchanged when desired is near-zero.
const avoidObstacles = (world: World, hero: Hero, dx: number, dy: number): Vec2 => {
  const mag = Math.hypot(dx, dy);
  if (mag < 0.1) return { x: dx, y: dy };
  const fx = dx / mag;
  const fy = dy / mag;
  // Left-perpendicular (rotate forward 90° CCW in world XY).
  const px = -fy;
  const py = fx;
  let pushX = 0;
  let pushY = 0;
  const consider = (bx: number, by: number, br: number) => {
    const ox = bx - hero.pos.x;
    const oy = by - hero.pos.y;
    const forward = ox * fx + oy * fy;
    if (forward <= 0 || forward > HERO_AVOID_LOOKAHEAD) return;
    const lateral = ox * px + oy * py;
    const band = br + HERO_RADIUS + HERO_AVOID_CLEARANCE;
    const absLat = Math.abs(lateral);
    if (absLat > band) return;
    // Push to the opposite side of where the blocker sits. Urgency
    // ramps as the obstacle approaches: full strength at touch range,
    // ~0 at the lookahead horizon.
    const urgency = 1 - forward / HERO_AVOID_LOOKAHEAD;
    const sign = lateral >= 0 ? -1 : 1;
    const strength = ((band - absLat) / band) * urgency * HERO_AVOID_STRENGTH * mag;
    pushX += px * sign * strength;
    pushY += py * sign * strength;
  };
  for (const t of world.trees) consider(t.pos.x, t.pos.y, TREE_FOOTPRINT * t.scale);
  for (const r of world.rocks) consider(r.pos.x, r.pos.y, ROCK_FOOTPRINT * r.scale);
  for (const t of world.towers) consider(t.pos.x, t.pos.y, TOWER_FOOTPRINT * 0.6);
  return { x: dx + pushX, y: dy + pushY };
};

const dashDir = (hero: Hero): Vec2 => {
  if (hero.moveTarget) {
    const dx = hero.moveTarget.x - hero.pos.x;
    const dy = hero.moveTarget.y - hero.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-3) return { x: dx / d, y: dy / d };
  }
  return { x: Math.sin(hero.facing), y: -Math.cos(hero.facing) };
};

// Mid-tick payload servicing for slot 3 ongoing effects (ultimate).
// Mark drives a damage multiplier (and optionally arcs to a list of
// marked targets); incinerate ticks flame on a locked target;
// killshot waits for the charge timer then deletes a target with splash.
// The slot-2 self-buff is its own tick pass (tickBuff) — they stack.
const tickPayload = (world: World, hero: Hero) => {
  const p = hero.payload;
  if (!p) return 1;
  if (p.kind === "killshot") {
    if (world.time >= p.fireAt) {
      const target = world.enemyById.get(p.targetId);
      if (target && isEnemyTargetable(target)) {
        createBeam(world, [hero.pos, target.pos], "#ffe9a0", 0.25);
        applyDamage(world, target, p.damage, p.damageType, "#fff4d6", 24);
        // Splash at impact point so escorts die with the priority target.
        const r2 = p.splashRadius * p.splashRadius;
        for (const e of world.enemies) {
          if (!isEnemyTargetable(e)) continue;
          if (e === target) continue;
          if (distSq(e.pos, target.pos) > r2) continue;
          applyDamage(world, e, p.splashDamage, p.damageType, "#ffe9a0", 8);
        }
        createExplosion(world, target.pos, p.splashRadius, 0.45);
        spawnParticles(world, target.pos, 36, "#ffe9a0", [4, 9], 0.6);
        addShake(world, 0.5, 4);
        emit(world, { type: "impact", pos: target.pos });
      }
      hero.payload = null;
    }
    return 1;
  }
  if (world.time >= p.endAt) {
    hero.payload = null;
    return 1;
  }
  if (p.kind === "mark") {
    // Arc-tick (Leela Overcharge) — chain damage across the marked
    // targets at a steady interval. Filters out dead targets between ticks.
    if (p.arc && world.time >= p.arc.nextTickAt) {
      const live: EntityId[] = [];
      for (const id of p.arc.targetIds) {
        const t = world.enemyById.get(id);
        if (t && isEnemyTargetable(t)) live.push(id);
      }
      p.arc.targetIds = live;
      let from: { pos: Vec2 } = hero;
      for (const id of live) {
        const t = world.enemyById.get(id);
        if (!t) continue;
        applyDamage(world, t, p.arc.damage, p.arc.damageType, "#cfe8ff", 4);
        createBeam(world, [from.pos, t.pos], "#7ee0ff", 0.12);
        from = t;
      }
      p.arc.nextTickAt = world.time + p.arc.interval;
    }
    return p.dmgMul;
  }
  if (p.kind === "incinerate") {
    const target = world.enemyById.get(p.targetId);
    if (!target || !isEnemyTargetable(target)) {
      hero.payload = null;
      return 1;
    }
    if (world.time >= p.nextTickAt) {
      applyDamage(world, target, p.tickDamage, p.damageType, "#ffb054", 4, false, {
        fromHero: true,
      });
      target.flashUntil = world.time + 0.1;
      spawnParticles(world, target.pos, 4, "#ff8a3a", [2, 5], 0.3);
      // Beam from hero to target reads as a sustained flame cone.
      createBeam(world, [hero.pos, target.pos], "#ff8a3a", 0.45);
      p.nextTickAt = world.time + 0.5;
    }
  }
  return 1;
};

// Slot-2 self-buff servicing. Stacks multiplicatively with payload muls
// (mark) so a buff + mark combo lands the planned burst damage. Cleared
// when the window expires. rangeMul is sourced from the variant's slot-2
// spec while the buff is active (George Spotter Drone scope-in).
const tickBuff = (
  world: World,
  hero: Hero,
): {
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  damageResist: number;
  rangeMul: number;
} => {
  const b = hero.selfBuff;
  if (!b) return { damageMul: 1, fireRateMul: 1, speedMul: 1, damageResist: 0, rangeMul: 1 };
  if (world.time >= b.endAt) {
    hero.selfBuff = null;
    return { damageMul: 1, fireRateMul: 1, speedMul: 1, damageResist: 0, rangeMul: 1 };
  }
  const buffSpec = HERO_SPECS[hero.variant].abilities[2];
  const rangeMul = buffSpec.type === "buff" && buffSpec.rangeMul ? buffSpec.rangeMul : 1;
  return {
    damageMul: b.damageMul,
    fireRateMul: b.fireRateMul,
    speedMul: b.speedMul,
    damageResist: b.damageResist,
    rangeMul,
  };
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
  // Ultimate (slot 3) and self-buff (slot 2) refresh the hero's per-tick
  // multipliers. Damage stacks multiplicatively; the other muls come from
  // the buff alone. damageResist clamped <1 inside damageHero.
  const payloadDmgMul = tickPayload(world, hero);
  const buff = tickBuff(world, hero);
  hero.damageMul = payloadDmgMul * buff.damageMul;
  hero.fireRateMul = buff.fireRateMul;
  hero.speedMul = buff.speedMul;
  hero.damageResist = buff.damageResist;

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
  const baseSpeed = hero.speed * hero.speedMul;
  const speed = dashing ? dashSpec.speed : baseSpeed;

  // Auto-clear an expired pre-dash aim — a Mike aim ignored for a few
  // seconds shouldn't trap the cursor in commit-on-click mode.
  if (hero.dashAim && world.time >= hero.dashAim.expiresAt) hero.dashAim = null;

  let desiredX = 0;
  let desiredY = 0;
  let walking = false;
  // Path-bound move follow. The straight-line direct-aim used to slide
  // the hero into trees/rocks/towers because they sit alongside the
  // painted lane; instead, decompose desired velocity into a tangent
  // component (walk along the path toward the target's progress) plus a
  // lateral correction (slide across the lane width toward the target
  // side). Hero never leaves the lane that way so the existing
  // resolveOverlap is mostly a safety net for dash overshoot.
  if (hero.moveTarget) {
    const dxStraight = hero.moveTarget.x - hero.pos.x;
    const dyStraight = hero.moveTarget.y - hero.pos.y;
    const dStraight = Math.hypot(dxStraight, dyStraight);
    if (dStraight <= HERO_ARRIVE_RADIUS) {
      hero.moveTarget = null;
    } else {
      const paths = world.paths;
      const pi = Math.max(0, Math.min(paths.length - 1, hero.pathIndex));
      const path = paths[pi];
      const heroProj = projectOnPath(path, hero.pos);
      const targetProj = projectOnPath(path, hero.moveTarget);
      const heroProgress = pathProgress(path, heroProj.segment, heroProj.segmentT);
      const targetProgress = pathProgress(path, targetProj.segment, targetProj.segmentT);
      const progressDelta = targetProgress - heroProgress;
      // Clamp the desired-lateral to the lane half-width so the hero
      // can't stand on top of a tree even if the click landed off-road.
      const baseTargetLateral = Math.max(
        -HERO_LANE_HALF,
        Math.min(HERO_LANE_HALF, targetProj.lateralOffset),
      );
      // Bypass-override: if a tower/tree/rock sits in the forward
      // corridor, step around it. May exceed HERO_LANE_HALF; the
      // override drives the hero past the obstacle then the next-tick
      // re-evaluation lets them rejoin the lane.
      const targetLateral = lateralBypassForBlockers(
        world,
        path,
        heroProgress,
        baseTargetLateral,
        Math.sign(targetProgress - heroProgress),
      );
      const dir = smoothDirection(path, heroProj.segment, heroProj.segmentT);
      const tangentLen = Math.hypot(dir.x, dir.y);
      if (tangentLen > 1e-6) {
        const tx = dir.x / tangentLen;
        const ty = dir.y / tangentLen;
        // Right-hand normal — matches projectOnPath's lateral sign.
        const nx = -ty;
        const ny = tx;
        const forwardSign = Math.sign(progressDelta);
        const distAlong = Math.abs(progressDelta);
        // Slow into the target so the hero doesn't oscillate around the
        // arrive point. Same shape as the old straight-line slow-down.
        const slowAlong = distAlong < 1.2 ? distAlong / 1.2 : 1;
        // Lateral correction: drag hero across the lane toward the
        // clicked side over HERO_LATERAL_LERP_PER_SEC seconds.
        const lateralDelta = targetLateral - heroProj.lateralOffset;
        const lateralVel =
          Math.sign(lateralDelta) *
          Math.min(Math.abs(lateralDelta) * HERO_LATERAL_LERP_PER_SEC, speed * 0.8);
        const forwardVel = forwardSign * speed * slowAlong;
        desiredX = tx * forwardVel + nx * lateralVel;
        desiredY = ty * forwardVel + ny * lateralVel;
        walking = distAlong > 0.04 || Math.abs(lateralDelta) > 0.05;
        hero.pathIndex = pi;
        hero.lateralOffset = heroProj.lateralOffset;
      } else {
        // Degenerate path segment — fall back to straight-line aim so
        // we don't freeze the hero.
        desiredX = (dxStraight / dStraight) * speed;
        desiredY = (dyStraight / dStraight) * speed;
        walking = true;
      }
      // Safety net: nudge desired velocity sideways if a tree/rock/tower
      // sits in the immediate look-ahead cone. Path-bound walking should
      // already avoid them, but dash overshoot or a click off-lane can
      // still drop the hero into one.
      if (walking) {
        const steered = avoidObstacles(world, hero, desiredX, desiredY);
        desiredX = steered.x;
        desiredY = steered.y;
      }
    }
  }

  if (dashing) {
    const fx = Math.sin(hero.facing);
    const fy = -Math.cos(hero.facing);
    desiredX = fx * dashSpec.speed;
    desiredY = fy * dashSpec.speed;
    walking = true;
    // Mike leaves a burning-coal trail behind him during the dash.
    // Drops one ember per COAL_DROP_INTERVAL so the path is dense
    // enough to read as a continuous burn lane without flooding the
    // sim with embers on a single dash.
    if (hero.variant === "mike") {
      if (world.time >= hero.mikeCoalDropAt) {
        createCoalEmber(world, hero.pos, COAL_TICK_DAMAGE, COAL_RADIUS, COAL_LIFETIME);
        hero.mikeCoalDropAt = world.time + COAL_DROP_INTERVAL;
      }
    }
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
    targetYaw = Math.atan2(hero.vel.x, -hero.vel.y);
  } else {
    const target = findHeroTarget(world, hero, buff.rangeMul);
    if (target) {
      targetYaw = Math.atan2(target.pos.x - hero.pos.x, -(target.pos.y - hero.pos.y));
    }
  }
  const ky = 1 - Math.exp(-HERO_TURN_RATE * dt);
  hero.facing += shortAngleDelta(hero.facing, targetYaw) * ky;

  // Skirmish lock + continuous melee. One hero engages roughly one
  // dino at a time: pick the closest in-range candidate, mark it as
  // engaged, and tick its hero-damage onto the hero. Other dinos in
  // range get their lock cleared so the lane keeps marching.
  // ENEMY_HERO_DAMAGE is its own axis from `e.damage` (which is the
  // leak/HQ damage), so a t-rex feels devastating in melee while
  // swarm chip is a tickle.
  const HERO_HURT_RANGE = HERO_ENGAGE_RANGE;
  const hurtR2 = HERO_HURT_RANGE * HERO_HURT_RANGE;
  let closest: Enemy | null = null;
  let closestD2 = Number.POSITIVE_INFINITY;
  if (hero.alive && world.time >= hero.abilityActiveUntil[0]) {
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (e.leak) continue;
      const d2 = distSq(e.pos, hero.pos);
      if (d2 > hurtR2) {
        if (e.engagedHeroId === hero.id) e.engagedHeroId = null;
        continue;
      }
      if (d2 < closestD2) {
        closestD2 = d2;
        closest = e;
      }
    }
    if (closest) {
      // Lock the closest dino onto this hero; release everyone else
      // currently locked so the engagement is genuinely 1:1.
      for (const e of world.enemies) {
        if (e === closest) continue;
        if (e.engagedHeroId === hero.id) e.engagedHeroId = null;
      }
      closest.engagedHeroId = hero.id;
      const perTick = ENEMY_HERO_DAMAGE[closest.kind] ?? closest.damage;
      damageHero(world, perTick * dt);
    }
  } else {
    // Hero is mid-dash (i-frames) or dead — drop every engagement so
    // dinos resume their lane march instead of attacking thin air.
    for (const e of world.enemies) {
      if (e.engagedHeroId === hero.id) e.engagedHeroId = null;
    }
  }
  // Liquid surface check feeds both the jetpack hover state and the
  // lava DOT exemption. Auto-engage hover whenever the hero is over
  // lava/water/goo so the visual lift + jet VFX read instantly; the
  // lava DOT is suppressed for that exact span so the jetpack does
  // what it looks like it does.
  const onLiquid = isOnLavaSurface(world.lavaFeatures, hero.pos.x, hero.pos.y, HERO_RADIUS);
  hero.hovering = onLiquid;
  const hoverTarget = onLiquid ? HERO_HOVER_HEIGHT : 0;
  hero.hoverHeight += (hoverTarget - hero.hoverHeight) * dampFactor(dt, HERO_HOVER_HALFLIFE);
  if (
    hero.alive &&
    world.biome === "lava" &&
    !hero.hovering &&
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
  const target = !dashing ? findHeroTarget(world, hero, buff.rangeMul) : null;
  hero.targetId = target?.id ?? null;
  if (target && hero.attackCooldown === 0) {
    fireHeroShot(world, hero, target);
    // Slot-2 buffs can boost cadence (Mike's Ignition doubles it); the
    // floor of 1ms keeps the divide safe if a buff somehow zeros the mul.
    const effectiveRate = Math.max(0.001, hero.fireRate * hero.fireRateMul);
    hero.attackCooldown = 1 / effectiveRate;
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
  // Re-bind to whichever path lane the click landed nearest. Single-path
  // levels are a no-op; multi-path levels swap lanes on the move order.
  let bestIdx = hero.pathIndex;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (let i = 0; i < world.paths.length; i++) {
    const proj = projectOnPath(world.paths[i], pos);
    const d2 = (proj.pos.x - pos.x) ** 2 + (proj.pos.y - pos.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }
  hero.pathIndex = bestIdx;
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

  const variant = HERO_SPECS[hero.variant];
  const spec = variant.abilities[slot];

  // Mike's dash is the only 2-stage ability today: first press enters
  // aim mode (cursor-driven arrow), second press / ground click commits
  // in that direction. No cooldown is consumed by the aim stage itself,
  // so the player can preview safely.
  if (slot === 0 && spec.type === "dash" && hero.variant === "mike") {
    if (hero.dashAim === null) {
      if (world.time < hero.abilityReadyAt[slot]) return false;
      const initial = dashDir(hero);
      hero.dashAim = { dir: initial, expiresAt: world.time + DASH_AIM_LIFETIME };
      return true;
    }
    if (world.time < hero.abilityReadyAt[slot]) {
      hero.dashAim = null;
      return false;
    }
    const dir = hero.dashAim.dir;
    hero.dashAim = null;
    hero.facing = Math.atan2(dir.x, -dir.y);
    hero.abilityReadyAt[slot] = world.time + spec.cooldown * hero.abilityCooldownMul;
    hero.abilityActiveUntil[0] = world.time + spec.duration;
    hero.mikeCoalDropAt = world.time;
    spawnParticles(world, hero.pos, 14, variant.tint, [2, 5], 0.35);
    return true;
  }

  if (world.time < hero.abilityReadyAt[slot]) return false;
  hero.abilityReadyAt[slot] = world.time + spec.cooldown * hero.abilityCooldownMul;

  if (spec.type === "dash") {
    const dir = dashDir(hero);
    hero.facing = Math.atan2(dir.x, -dir.y);
    hero.abilityActiveUntil[0] = world.time + spec.duration;
    spawnParticles(world, hero.pos, 14, variant.tint, [2, 5], 0.35);
    // George Sidestep — arm the next auto-attack as a piercing crit.
    if (spec.nextShotCrit) {
      hero.pendingCrit = { mul: spec.nextShotCrit.mul, pierce: spec.nextShotCrit.pierce };
    }
    // Leela Phase Step — arc lightning to closest enemies on lunge end.
    // Apply immediately (i-frames cover the brief windup).
    if (spec.endChain) {
      const endX = hero.pos.x + Math.sin(hero.facing) * spec.speed * spec.duration;
      const endY = hero.pos.y + -Math.cos(hero.facing) * spec.speed * spec.duration;
      const endPos: Vec2 = { x: endX, y: endY };
      const r2 = spec.endChain.radius * spec.endChain.radius;
      const seen = new Set<EntityId>();
      let from: { pos: Vec2 } = { pos: endPos };
      for (let i = 0; i < spec.endChain.hops; i++) {
        let best: Enemy | null = null;
        let bd = Number.POSITIVE_INFINITY;
        for (const e of world.enemies) {
          if (!isEnemyTargetable(e)) continue;
          if (seen.has(e.id)) continue;
          const d2 = distSq(e.pos, from.pos);
          if (d2 > r2) continue;
          if (d2 < bd) {
            bd = d2;
            best = e;
          }
        }
        if (!best) break;
        applyDamage(
          world,
          best,
          spec.endChain.damagePerHop,
          spec.endChain.damageType,
          "#cfe8ff",
          4,
        );
        createBeam(world, [from.pos, best.pos], "#7ee0ff", 0.18);
        seen.add(best.id);
        from = best;
      }
    }
    // Stan Ground Pound — detonate at landing position. Cheat the
    // landing point as forward-step from current pos using dash dir.
    if (spec.landingBlast) {
      const lbX = hero.pos.x + Math.sin(hero.facing) * spec.speed * spec.duration;
      const lbY = hero.pos.y + -Math.cos(hero.facing) * spec.speed * spec.duration;
      const lbPos: Vec2 = { x: lbX, y: lbY };
      const r2 = spec.landingBlast.radius * spec.landingBlast.radius;
      for (const e of world.enemies) {
        if (!isEnemyTargetable(e)) continue;
        if (distSq(e.pos, lbPos) > r2) continue;
        applyDamage(world, e, spec.landingBlast.damage, spec.landingBlast.damageType, "#ffb054", 8);
        e.flashUntil = world.time + 0.12;
      }
      createExplosion(world, lbPos, spec.landingBlast.radius, 0.45);
      spawnParticles(world, lbPos, 24, "#ffb04a", [3, 7], 0.5);
      spawnParticles(world, lbPos, 14, "#ff8a3a", [4, 9], 0.4);
      addShake(world, 0.5, 5);
      emit(world, { type: "impact", pos: lbPos });
    }
    return true;
  }

  if (spec.type === "burst") {
    const r2 = spec.radius * spec.radius;
    const hit: Enemy[] = [];
    for (const e of world.enemies) {
      if (!isEnemyTargetable(e)) continue;
      if (distSq(e.pos, hero.pos) > r2) continue;
      applyDamage(world, e, spec.damage, spec.damageType, "#ffb054", 10, false, {
        fromHero: true,
      });
      e.flashUntil = world.time + 0.12;
      hit.push(e);
      if (spec.burn) {
        applyHeroBurn(world, e, spec.burn.duration, spec.burn.totalDamage);
      }
      if (spec.knockback) {
        applyPathKnockback(world, e, spec.knockback.pathPush);
      }
    }
    // Leela chain-fork: pick `hops` extra enemies near the burst circle,
    // arc beams between them. Distinct from auto-attack chain.
    if (spec.chainHops) {
      const seen = new Set<EntityId>(hit.map((e) => e.id));
      let from: { pos: Vec2 } = hero;
      const hr2 = spec.chainHops.radius * spec.chainHops.radius;
      for (let i = 0; i < spec.chainHops.hops; i++) {
        let best: Enemy | null = null;
        let bd = Number.POSITIVE_INFINITY;
        for (const e of world.enemies) {
          if (!isEnemyTargetable(e)) continue;
          if (seen.has(e.id)) continue;
          const d2 = distSq(e.pos, from.pos);
          if (d2 > hr2) continue;
          if (d2 < bd) {
            bd = d2;
            best = e;
          }
        }
        if (!best) break;
        applyDamage(world, best, spec.chainHops.damagePerHop, spec.damageType, "#cfe8ff", 4);
        createBeam(world, [from.pos, best.pos], "#7ee0ff", 0.18);
        seen.add(best.id);
        from = best;
      }
    }
    createExplosion(world, hero.pos, spec.radius, 0.45);
    // Burst particles now key off variant tint instead of a hard-coded
    // orange — an electric burst no longer reads as flame.
    spawnParticles(world, hero.pos, 24, variant.tint, [3, 7], 0.5);
    spawnParticles(world, hero.pos, 14, variant.tint, [4, 9], 0.4);
    addShake(world, 0.4, 5);
    emit(world, { type: "impact", pos: hero.pos });
    return true;
  }

  if (spec.type === "buff") {
    hero.selfBuff = {
      endAt: world.time + spec.duration,
      damageMul: spec.damageMul,
      fireRateMul: spec.fireRateMul,
      speedMul: spec.speedMul,
      damageResist: spec.damageResist,
    };
    spawnParticles(world, hero.pos, 18, variant.tint, [2, 5], 0.5);
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
    // Stan Saturation crater — drop one crater per shell on a slight
    // delay so the field litters with explosion zones in lockstep with
    // the barrage cadence. Picks a random offset around the hero.
    if (spec.crater) {
      const c = spec.crater;
      for (let i = 0; i < spec.count; i++) {
        const ang = (i / spec.count) * Math.PI * 2 + Math.random() * 0.6;
        const dist = spec.range * (0.35 + 0.55 * Math.random());
        const cx = hero.pos.x + Math.cos(ang) * dist;
        const cy = hero.pos.y + Math.sin(ang) * dist;
        createHeroCrater(
          world,
          { x: cx, y: cy },
          c.radius,
          c.tickDamage,
          c.tickInterval,
          c.duration,
        );
      }
    }
    return true;
  }

  if (spec.type === "mark") {
    const base = {
      kind: "mark" as const,
      endAt: world.time + spec.duration,
      dmgMul: spec.dmgMul,
    };
    if (spec.arcTick) {
      // Leela Overcharge — collect up to 5 nearest targetable enemies
      // inside arc radius and seed them as the persistent mark list.
      const candidates: { e: Enemy; d2: number }[] = [];
      const ar2 = spec.arcTick.radius * spec.arcTick.radius;
      for (const e of world.enemies) {
        if (!isEnemyTargetable(e)) continue;
        const d2 = distSq(e.pos, hero.pos);
        if (d2 > ar2) continue;
        candidates.push({ e, d2 });
      }
      candidates.sort((a, b) => a.d2 - b.d2);
      const targetIds = candidates.slice(0, 5).map((c) => c.e.id);
      hero.payload = {
        ...base,
        arc: {
          targetIds,
          nextTickAt: world.time + spec.arcTick.interval,
          interval: spec.arcTick.interval,
          damage: spec.arcTick.damage,
          radius: spec.arcTick.radius,
          damageType: spec.arcTick.damageType,
        },
      };
    } else {
      hero.payload = base;
    }
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

  if (spec.type === "killshot") {
    const target = findEnemyByProgress(world, hero.pos, spec.range);
    if (!target) {
      // Refund cooldown — no valid target = no payload, no charge.
      hero.abilityReadyAt[slot] = world.time;
      return false;
    }
    hero.payload = {
      kind: "killshot",
      targetId: target.id,
      fireAt: world.time + spec.chargeTime,
      endAt: world.time + spec.chargeTime + 0.05,
      damage: spec.damage,
      splashDamage: spec.splashDamage,
      splashRadius: spec.splashRadius,
      damageType: spec.damageType,
    };
    spawnParticles(world, hero.pos, 12, variant.tint, [2, 5], 0.45);
    return true;
  }

  return false;
};

// Helpers exported for store glue. Variant lookup avoids importing the
// spec table into hero consumers that just need stats for the HUD.
export const heroVariantStats = (variant: HeroVariant): HeroVariantSpec => HERO_SPECS[variant];
