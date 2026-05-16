import { isEnemyTargetable } from "./enemyState";
import type { Enemy, Vec2, World } from "./types";
import { distSq } from "./vec2";
import { applyDamage, createBeam, ENEMY_RESIST, emit } from "./world";

// HQ base laser. One firing slot per path endpoint — multi-path levels
// get parallel lasers from the same shared stats. Targets the enemy
// furthest along its path (closest to the gate) so the gun does the
// thing the player expects from a last-ditch defense: punish whatever
// is about to leak first.
//
// Damage type is kinetic so it inherits the existing pulse resist
// matrix — no new damage type axis to balance. The beam visual is red
// (createBeam halo color) with the engine's standard white-hot core
// so it reads clearly as "laser" against blue chain beams.

const BASE_BEAM_LIFE = 0.09;
const BASE_BEAM_COLOR = "#ff4a3a";

const findBaseTarget = (world: World, pathIndex: number, origin: Vec2): Enemy | null => {
  const range = world.base.range;
  const rangeSq = range * range;
  let best: Enemy | null = null;
  // Prefer enemy with most progress along this gun's path (closest to
  // leaking). Falls back to a global scan if the path-local pick has
  // no in-range candidates — keeps the gun useful at intersections
  // where a foreign path's enemy is also a real threat.
  let bestProgress = Number.NEGATIVE_INFINITY;
  let bestGlobal: Enemy | null = null;
  let bestGlobalProgress = Number.NEGATIVE_INFINITY;
  for (const e of world.enemies) {
    if (!isEnemyTargetable(e)) continue;
    if (distSq(e.pos, origin) > rangeSq) continue;
    const progress = e.segment + e.segmentT;
    if (e.pathIndex === pathIndex) {
      if (progress > bestProgress) {
        bestProgress = progress;
        best = e;
      }
    } else if (progress > bestGlobalProgress) {
      bestGlobalProgress = progress;
      bestGlobal = e;
    }
  }
  return best ?? bestGlobal;
};

// Origins are the same world coordinates the HQ turrets render at —
// path endpoints. Cached in an array on World.base.cooldowns by index
// so multi-path levels get one beam per HQ.
const hqOrigin = (world: World, pathIndex: number): Vec2 | null => {
  const path = world.paths[pathIndex];
  if (!path || path.length === 0) return null;
  return path[path.length - 1];
};

export const updateBase = (world: World, dt: number) => {
  const base = world.base;
  // Lazy resize: levels with different path counts need cooldowns/
  // targetIds arrays to match. createWorld sizes them but a HMR /
  // ad-hoc world swap could land mid-run with the wrong shape.
  if (base.cooldowns.length !== world.paths.length) {
    base.cooldowns = world.paths.map((_, i) => base.cooldowns[i] ?? 0);
    base.targetIds = world.paths.map((_, i) => base.targetIds[i] ?? null);
  }
  for (let i = 0; i < world.paths.length; i++) {
    base.cooldowns[i] = Math.max(0, base.cooldowns[i] - dt);
    const origin = hqOrigin(world, i);
    if (!origin) {
      base.targetIds[i] = null;
      continue;
    }
    const target = findBaseTarget(world, i, origin);
    base.targetIds[i] = target?.id ?? null;
    if (!target || base.cooldowns[i] > 0) continue;
    // Track damage + kills on the base — applyDamage attributes
    // tower-id-scoped stats, but the base isn't a tower so we account
    // for kills/damage manually around the call by inspecting state
    // before/after.
    const prevHp = target.hp;
    const prevShield = target.shield;
    const wasAlive = target.alive;
    applyDamage(world, target, base.damage, "kinetic", "#ff8a5a", 6, false);
    const hpDelta = Math.max(0, prevHp - target.hp);
    const shieldDelta = Math.max(0, prevShield - target.shield);
    base.damageDealt += Math.min(prevHp + prevShield, hpDelta + shieldDelta);
    if (wasAlive && !target.alive) base.kills += 1;
    createBeam(world, [origin, target.pos], BASE_BEAM_COLOR, BASE_BEAM_LIFE);
    base.cooldowns[i] = 1 / base.fireRate;
    emit(world, { type: "impact", pos: target.pos });
  }
};

// Effective DPS at the current upgrade state — exported so the
// BasePanel header can render the same number the sim produces.
export const baseDps = (base: { damage: number; fireRate: number }, hqCount = 1): number =>
  base.damage * base.fireRate * hqCount;

// Resist-weighted average DPS the base contributes against a given
// enemy mix. Kinetic damage type so pulse's resist column applies.
// Used by the wave-feasibility script — kept here so a future damage-
// type tweak only needs one edit.
export const baseAverageResist = (kindWeights: Map<import("./types").EnemyKind, number>) => {
  let weighted = 0;
  let total = 0;
  for (const [kind, weight] of kindWeights) {
    weighted += (ENEMY_RESIST[kind]?.kinetic ?? 1) * weight;
    total += weight;
  }
  return total > 0 ? weighted / total : 1;
};
