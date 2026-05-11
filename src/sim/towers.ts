import type { Enemy, Tower, Vec2, World } from "./types";
import { distSq } from "./vec2";
import {
  applyDamage,
  applySlow,
  createBeam,
  createCryoWave,
  createProjectile,
  emit,
  HIVE_MAX_DRONES,
  HIVE_MAX_DRONES_PER_TOWER,
  spawnParticles,
} from "./world";

// Effective fire rate factors in any service buff currently applied to
// the tower by hive drones. We compute it on demand instead of caching
// because the bonus is recomputed at the top of every tick — caching
// would just add a state field that has to stay in sync.
export const effectiveFireRate = (t: Tower): number => t.fireRate * (1 + t.serviceFireRateBonus);

const scoreEnemy = (tower: Tower, e: Enemy): number => {
  if (tower.targetingMode === "tower") return -distSq(e.pos, tower.pos);
  if (tower.targetingMode === "start") return -(e.segment + e.segmentT);
  if (tower.targetingMode === "strongest") return e.maxHp;
  if (tower.targetingMode === "weakest") {
    // Shielded enemies rank as full HP so we don't waste shots draining
    // a shield while damaged unshielded enemies are nearby.
    const effHp = e.shield > 0 ? e.maxHp : e.hp;
    return -effHp;
  }
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

// Pull T3 anti-modifier hit options off a tower for the projectile/
// applyDamage calls, plus the tower id for kill-credit attribution.
// T3 fields default inert; attackerTowerId is always populated so kills
// from chain ricochets / cryo / flame ticks land on the firing tower.
const towerHitOpts = (t: Tower) => ({
  shieldDamageMul: t.shieldDamageMul,
  armorPierce: t.armorPierce,
  resistStrip: t.resistStrip,
  regenSuppressOnHit: t.regenSuppressOnHit,
  attackerTowerId: t.id,
});

const firePulse = (world: World, t: Tower, target: Enemy) => {
  createProjectile(
    world,
    "direct",
    "kinetic",
    t.pos,
    target,
    t.damage,
    0,
    22,
    false,
    towerHitOpts(t),
  );
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

  const opts = towerHitOpts(t);
  for (const e of hit) {
    applyDamage(world, e, damage, "electric", undefined, undefined, false, opts);
    damage = Math.max(1, damage * t.chainFalloff);
  }
};

// Cryo damage/slow application — gated by cooldown so DPS stays tunable.
// Per-enemy hit particles intentionally absent: the freeze rings (below)
// carry the visual, and a tiny per-enemy puff just added clutter.
const applyCryoFreeze = (world: World, t: Tower): boolean => {
  const rangeSq = t.range * t.range;
  let hit = false;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, t.pos) > rangeSq) continue;
    hit = true;
    applySlow(e, world, t.slowFactor, t.slowDuration);
    // Cryo T3 (Cryo Lock) — push regen pause out to end-of-slow so the
    // enemy can't tick HP back up while frozen.
    if (t.freezeBlocksRegen && e.regen) {
      e.regenPausedUntil = Math.max(e.regenPausedUntil, e.slowUntil);
    }
    e.flashUntil = world.time + 0.06;
    if (t.damage > 0) applyDamage(world, e, t.damage, "cold", "#bfe9ff", 6, false, towerHitOpts(t));
  }
  return hit;
};

// True if any live enemy is inside the tower's aura — used to gate the
// continuous mist emission so it only runs when there's something to chill.
const enemyInRange = (world: World, t: Tower): boolean => {
  const r2 = t.range * t.range;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (distSq(e.pos, t.pos) <= r2) return true;
  }
  return false;
};

// Steady freezing-wave cadence — a fresh ring leaves the tower roughly
// every CRYO_WAVE_PERIOD seconds while a target's in range. Tuned for a
// rhythmic beat: 0.8 s between waves with each wave living 1.2 s means
// roughly two are in flight at once with a clear gap as the older one
// fades. Decoupled from fireRate so the rhythm stays steady.
const CRYO_WAVE_LIFE = 1.2;
const CRYO_WAVE_PERIOD_TICKS = 48; // 0.8 s @ 60Hz
const spawnCryoWave = (world: World, t: Tower) => {
  createCryoWave(world, t.pos, t.range, CRYO_WAVE_LIFE);
};

const fireMortar = (world: World, t: Tower, target: Enemy) => {
  createProjectile(
    world,
    "splash",
    "explosive",
    t.pos,
    target.pos,
    t.damage,
    t.splashRadius,
    14,
    false,
    towerHitOpts(t),
  );
};

// Flamethrower — burns everything inside a forward cone. Damage is small
// but applied frequently so it reads as DoT on anything lingering in the
// stream.
const FLAME_HALF_CONE = Math.PI / 6; // 30° → 60° total spread
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
    applyDamage(world, e, t.damage, "flame", "#ffb54a", 3, false, towerHitOpts(t));
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
  // One particle per tick is enough — the per-particle brightness boost
  // (Effects.tsx) ramps newly-spawned particles to ~2.2× and overlapping
  // tick spawns already pile a visible hot core on the centerline.
  spawnParticles(
    world,
    nozzle,
    1,
    "#ffae50",
    speedRange(yellowLife, 0.7),
    yellowLife,
    dir,
    Math.PI / 10,
  );
  // Mid orange flames — main flame body, fills most of the cone. Cone kept
  // just inside the damage cone so the body stays visibly contained.
  spawnParticles(
    world,
    nozzle,
    4,
    "#ffa040",
    speedRange(orangeLife, 0.9),
    orangeLife,
    dir,
    Math.PI / 7,
  );
  // Outer red wash + trailing embers — sized so axial embers land right at
  // the damage-cone edge (range), so the visible wall matches what burns.
  // Counts intentionally thin: the particle material is additive +
  // toneMapped:false, so each layer adds linearly to the framebuffer and
  // a dense stream paints the cone white over bright biome surfaces (lit
  // snow albedo already runs ~1.7-1.9 in linear and blooms on its own).
  spawnParticles(world, nozzle, 2, "#e8492a", speedRange(redLife, 1.0), redLife, dir, Math.PI / 6);
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
    false,
    towerHitOpts(t),
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
  // Recompute service buffs first. Each non-hive tower's
  // serviceFireRateBonus is the sum of every assigned drone's buff that
  // currently points at it. Reset on every tick so a re-assignment or
  // sold tower drops the buff on the very next frame, not after a
  // delayed fade.
  for (const t of world.towers) t.serviceFireRateBonus = 0;
  for (const h of world.towers) {
    if (h.kind !== "hive") continue;
    for (let d = 0; d < h.droneCount; d++) {
      const targetId = h.droneAssignments[d];
      if (targetId === null || targetId === undefined) continue;
      const target = world.towerById.get(targetId);
      // Drop stale assignments — the target may have been sold. Both
      // fields cleared here so the renderer + UI agree on idle state.
      if (!target || target.kind === "hive") {
        h.droneAssignments[d] = null;
        continue;
      }
      target.serviceFireRateBonus += h.serviceBuff;
    }
  }

  for (const t of world.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);

    // Hive is pure support — no targeting, no firing. Service bonuses
    // were already accumulated on each target tower above.
    if (t.kind === "hive") continue;

    if (t.kind === "cryo") {
      // Damage/slow is cooldown-gated; the visual is a steady cadence of
      // expanding rings ("freezing waves") that emanate from the tower
      // while any enemy is in range. The cadence is intentionally
      // decoupled from fireRate — extra rings on each freeze tick made
      // the rhythm feel frantic.
      const inRange = enemyInRange(world, t);
      if (inRange && world.tickCount % CRYO_WAVE_PERIOD_TICKS === 0) {
        spawnCryoWave(world, t);
      }
      if (inRange && t.cooldown === 0) {
        const didHit = applyCryoFreeze(world, t);
        if (didHit) {
          // Effective fire rate so the per-freeze cadence picks up any
          // hive service buff. Cryo's wave-spawn cadence stays decoupled
          // from fireRate (see CRYO_WAVE_PERIOD_TICKS) — only the damage
          // tick is gated.
          t.cooldown = 1 / effectiveFireRate(t);
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
          t.cooldown = 1 / effectiveFireRate(t);
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
          t.cooldown = 1 / effectiveFireRate(t);
          emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
        }
      }
      continue;
    }

    if (target && t.cooldown === 0) {
      if (t.kind === "pulse") firePulse(world, t, target);
      else if (t.kind === "chain") fireChain(world, t, target);
      else if (t.kind === "mortar") fireMortar(world, t, target);
      t.cooldown = 1 / effectiveFireRate(t);
      emit(world, { type: "shoot", towerKind: t.kind, pos: t.pos });
    }
  }
};

// --- Hive support drones ----------------------------------------------
//
// Drones orbit either the hive (when idle) or their assigned tower
// (when servicing). Their visible position is purely cosmetic — the
// service buff itself is recomputed at the top of updateTowers from
// each hive's droneAssignments array, so the renderer can lag the
// physical orbit without affecting damage timing.
//
// Orbit phase is a function of (hive.id, droneIdx) so the same drone
// keeps a consistent angle even as the orbit center swaps between hive
// and serviced tower — looks like the drone "flies over" rather than
// teleporting, even with snap-to-center positioning.

export const HIVE_ORBIT_RADIUS = 1.0;
export const HIVE_ORBIT_HEIGHT = 1.1;
const HIVE_ORBIT_SPEED = 0.55; // rad/s

// Proximity radius for auto-assigning a free drone when a tower is
// placed near a hive. Picked a touch above the longest tower range
// (mortar = 9.0) so a hive nestled near a chokepoint will adopt
// neighbours without poaching towers across the map.
export const HIVE_AUTO_ASSIGN_RANGE = 10;

// How many drones (from every hive on the map) are currently servicing
// the given target tower. Used to enforce HIVE_MAX_DRONES_PER_TOWER so
// stacking is bounded regardless of how many hives the player owns.
export const countDronesOnTower = (world: World, towerId: number): number => {
  let n = 0;
  for (const h of world.towers) {
    if (h.kind !== "hive") continue;
    for (let i = 0; i < h.droneCount; i++) {
      if (h.droneAssignments[i] === towerId) n++;
    }
  }
  return n;
};

// On placement, auto-wire idle drones so the player doesn't have to
// drill into the hive panel for every neighbour.
//
// Two directions:
//  1. Non-hive tower placed near an existing hive → grab closest
//     hive's first idle drone.
//  2. Hive placed near existing non-hive towers → fill idle slots
//     with the closest unserviced neighbours.
//
// Manual assignments are left untouched — only idle (null) slots are
// filled. Stacking is capped at HIVE_MAX_DRONES_PER_TOWER per target.
export const autoAssignDroneToNewTower = (world: World, tower: Tower): boolean => {
  const rangeSq = HIVE_AUTO_ASSIGN_RANGE * HIVE_AUTO_ASSIGN_RANGE;

  if (tower.kind === "hive") {
    // Gather nearby non-hive towers sorted by distance, skipping any
    // already at the stacking cap, then fill idle drone slots
    // closest-first.
    const nearby: { id: number; d2: number; stacked: number }[] = [];
    for (const t of world.towers) {
      if (t === tower || t.kind === "hive") continue;
      const d2 = distSq(t.pos, tower.pos);
      if (d2 > rangeSq) continue;
      const stacked = countDronesOnTower(world, t.id);
      if (stacked >= HIVE_MAX_DRONES_PER_TOWER) continue;
      nearby.push({ id: t.id, d2, stacked });
    }
    if (nearby.length === 0) return false;
    nearby.sort((a, b) => a.d2 - b.d2);

    let assigned = false;
    let ni = 0;
    for (let i = 0; i < tower.droneCount && ni < nearby.length; i++) {
      if (tower.droneAssignments[i] !== null) continue;
      // Re-check stacking per drone — earlier drones in this same
      // call may have filled the candidate up to the cap.
      while (ni < nearby.length && nearby[ni].stacked >= HIVE_MAX_DRONES_PER_TOWER) ni++;
      if (ni >= nearby.length) break;
      tower.droneAssignments[i] = nearby[ni].id;
      nearby[ni].stacked++;
      assigned = true;
    }
    return assigned;
  }

  // Non-hive tower: find the closest hive with a free slot, but only
  // if this tower isn't already at the stacking cap.
  if (countDronesOnTower(world, tower.id) >= HIVE_MAX_DRONES_PER_TOWER) return false;
  let bestHive: Tower | null = null;
  let bestDroneIdx = -1;
  let bestDistSq = rangeSq;
  for (const h of world.towers) {
    if (h.kind !== "hive") continue;
    const d2 = distSq(h.pos, tower.pos);
    if (d2 > rangeSq) continue;
    let freeIdx = -1;
    for (let i = 0; i < h.droneCount; i++) {
      if (h.droneAssignments[i] === null) {
        freeIdx = i;
        break;
      }
    }
    if (freeIdx < 0) continue;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestHive = h;
      bestDroneIdx = freeIdx;
    }
  }
  if (!bestHive) return false;
  bestHive.droneAssignments[bestDroneIdx] = tower.id;
  return true;
};

// Phase angle uses a fixed denominator (HIVE_MAX_DRONES) so adding
// drones via Path A doesn't reshuffle the existing drones' orbits —
// the new drone slots in at its own index without disrupting the
// already-flying ones.
export const hiveDroneAngle = (tower: Tower, time: number, droneIdx: number): number =>
  tower.id * 0.37 + (droneIdx * (2 * Math.PI)) / HIVE_MAX_DRONES + time * HIVE_ORBIT_SPEED;

// Returns the orbit center for a drone — the assigned tower's position
// when serviced, otherwise the hive's own position. Renderer + tooling
// both call this so the visual + sim agree on where the drone "is."
export const hiveDroneOrbitCenter = (hive: Tower, world: World, droneIdx: number): Vec2 => {
  const targetId = hive.droneAssignments[droneIdx];
  if (targetId === null || targetId === undefined) return hive.pos;
  const target = world.towerById.get(targetId);
  if (!target || target.kind === "hive") return hive.pos;
  return target.pos;
};

export const hiveDronePosition = (
  hive: Tower,
  world: World,
  time: number,
  droneIdx: number,
): Vec2 => {
  const center = hiveDroneOrbitCenter(hive, world, droneIdx);
  const a = hiveDroneAngle(hive, time, droneIdx);
  return {
    x: center.x + Math.cos(a) * HIVE_ORBIT_RADIUS,
    y: center.y + Math.sin(a) * HIVE_ORBIT_RADIUS,
  };
};
