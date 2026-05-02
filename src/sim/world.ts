import { BIOME_LAYERS, type Biome, biomeForPos } from "../biomes";
import { EASTER_EGG_BY_ID, EASTER_EGG_DEFS } from "../easterEggs";
import {
  buildLavaFeatures,
  hasFlowFeatures,
  isOnLavaSurface,
  type LavaFeatures,
} from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import type { LevelConfig } from "../levels";
import { DIFFICULTY_MULTIPLIERS, type DifficultyMultipliers } from "../progress";
import { samplePath } from "./path";
import type {
  Beam,
  CryoWave,
  DamageType,
  EasterEgg,
  EasterEggScheduleEntry,
  Enemy,
  EnemyKind,
  Explosion,
  GameEvent,
  Projectile,
  ProjectileKind,
  Rock,
  Tower,
  TowerKind,
  Tree,
  Vec2,
  World,
} from "./types";

export const STARTING_LIVES = 20;

export const TREE_COUNT = 20;
// Trees clump into a handful of groves rather than evenly speckling the map.
const TREE_CLUSTER_SEEDS = 5;
const TREE_CLUSTER_SIGMA = 2.4;
export const TREE_VARIANTS = 4;
export const TREE_CLEARANCE_MARGIN = 2.0;
// Wider range with a slight central bias gives a more natural mix —
// most trees mid-sized, with the occasional sapling and elder.
export const TREE_MIN_SCALE = 0.45;
export const TREE_MAX_SCALE = 1.15;
export const TREE_MIN_SPACING = 2.2;
export const TREE_FOOTPRINT = 0.85;
export const TREE_REMOVE_COST = 10;

// Rock footprint radius (before per-instance scale multiplier).
export const ROCK_FOOTPRINT = 0.65;
export const ROCK_MIN_SPACING = 1.5;
export const ROCK_REMOVE_COST = 15;

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const distPointToSegSq = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len = abx * abx + aby * aby;
  const t = len > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / len)) : 0;
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
};

// Box–Muller normal sample for cluster offsets.
const gaussian = (rng: () => number, sigma: number): number => {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
};

const buildTrees = (
  paths: Vec2[][],
  seed: number,
  firstId: number,
  lava: LavaFeatures | null,
): { trees: Tree[]; nextId: number } => {
  const rng = mulberry32(seed);
  const trees: Tree[] = [];
  const clearance = PATH_WIDTH / 2 + TREE_CLEARANCE_MARGIN;
  const pathR2 = clearance * clearance;
  const spacingSq = TREE_MIN_SPACING * TREE_MIN_SPACING;

  // Pre-pick cluster seeds clear of the path. Trees grow in groves around
  // these anchors instead of sprinkling across the map evenly.
  const seeds: Vec2[] = [];
  let seedTries = 0;
  while (seeds.length < TREE_CLUSTER_SEEDS && seedTries < TREE_CLUSTER_SEEDS * 60) {
    seedTries++;
    const sx = (rng() - 0.5) * MAP_WIDTH * 0.85;
    const sy = (rng() - 0.5) * MAP_HEIGHT * 0.85;
    if (isOnLavaSurface(lava, sx, sy, 1.5)) continue;
    let blockedSeed = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(sx, sy, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blockedSeed = true;
          break;
        }
      }
      if (blockedSeed) break;
    }
    if (blockedSeed) continue;
    let tooClose = false;
    for (const s of seeds) {
      const dx = s.x - sx;
      const dy = s.y - sy;
      if (dx * dx + dy * dy < 6 * 6) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    seeds.push({ x: sx, y: sy });
  }
  // Fallback to uniform random if we couldn't seed any clusters (very dense paths).
  const seedFallback = seeds.length === 0;

  const halfW = MAP_WIDTH * 0.475;
  const halfH = MAP_HEIGHT * 0.475;

  let nextId = firstId;
  let tries = 0;
  while (trees.length < TREE_COUNT && tries < TREE_COUNT * 60) {
    tries++;
    let x: number;
    let y: number;
    if (seedFallback) {
      x = (rng() - 0.5) * MAP_WIDTH * 0.95;
      y = (rng() - 0.5) * MAP_HEIGHT * 0.95;
    } else {
      const seed = seeds[Math.floor(rng() * seeds.length)];
      x = Math.max(-halfW, Math.min(halfW, seed.x + gaussian(rng, TREE_CLUSTER_SIGMA)));
      y = Math.max(-halfH, Math.min(halfH, seed.y + gaussian(rng, TREE_CLUSTER_SIGMA)));
    }
    if (isOnLavaSurface(lava, x, y, TREE_FOOTPRINT)) continue;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;
    for (const t of trees) {
      const dx = t.pos.x - x;
      const dy = t.pos.y - y;
      if (dx * dx + dy * dy < spacingSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    trees.push({
      id: nextId++,
      pos: { x, y },
      variant: Math.floor(rng() * TREE_VARIANTS),
      // Triangular distribution (avg of two uniforms) biases toward mid-size,
      // so saplings and elders are uncommon but visible.
      scale: TREE_MIN_SCALE + ((rng() + rng()) / 2) * (TREE_MAX_SCALE - TREE_MIN_SCALE),
      rot: rng() * Math.PI * 2,
    });
  }
  return { trees, nextId };
};

const buildRocks = (
  biome: Biome,
  paths: Vec2[][],
  trees: Tree[],
  firstId: number,
  lava: LavaFeatures | null,
): { rocks: Rock[]; nextId: number } => {
  const rocks: Rock[] = [];
  const treeSpacingSq = (TREE_FOOTPRINT * 0.5 + ROCK_FOOTPRINT * 0.6) ** 2;
  const rockSpacingSq = ROCK_MIN_SPACING * ROCK_MIN_SPACING;
  let nextId = firstId;

  const layers = BIOME_LAYERS[biome];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const spec = layers[layerIndex];
    if (!spec.blocks) continue;
    const rng = mulberry32(spec.seed);
    const pathR2 = spec.clearance * spec.clearance;
    let tries = 0;
    let placed = 0;
    while (placed < spec.count && tries < spec.count * 40) {
      tries++;
      const x = (rng() - 0.5) * MAP_WIDTH;
      const y = (rng() - 0.5) * MAP_HEIGHT;
      const rawVariant = Math.floor(rng() * spec.urls.length);
      // Same triangular bias as trees — small/large rocks are accents, not norm.
      const scale = spec.minScale + ((rng() + rng()) / 2) * (spec.maxScale - spec.minScale);
      const rot = rng() * Math.PI * 2;

      if (isOnLavaSurface(lava, x, y, ROCK_FOOTPRINT * scale)) continue;
      let blocked = false;
      for (const path of paths) {
        for (let i = 0; i < path.length - 1; i++) {
          if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (blocked) continue;
      for (const tr of trees) {
        const dx = tr.pos.x - x;
        const dy = tr.pos.y - y;
        if (dx * dx + dy * dy < treeSpacingSq) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (const r of rocks) {
        const dx = r.pos.x - x;
        const dy = r.pos.y - y;
        if (dx * dx + dy * dy < rockSpacingSq) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      rocks.push({
        id: nextId++,
        pos: { x, y },
        layerIndex,
        variant: rawVariant,
        scale,
        rot,
      });
      placed++;
    }
  }
  return { rocks, nextId };
};

const buildEasterEggs = (
  biome: Biome,
  paths: Vec2[][],
  trees: Tree[],
  rocks: Rock[],
  seed: number,
  firstId: number,
  lava: LavaFeatures | null,
): { eggs: EasterEgg[]; nextId: number } => {
  // Only consider statically-placed eggs here — moving ones spawn on a
  // schedule via updateEasterEggs.
  const matching = EASTER_EGG_DEFS.filter((d) => d.biomes.includes(biome) && !d.motion);
  if (matching.length === 0) return { eggs: [], nextId: firstId };
  const rng = mulberry32(seed);
  const def = matching[Math.floor(rng() * matching.length)];
  const clearance = PATH_WIDTH / 2 + 1.5;
  const pathR2 = clearance * clearance;
  const minPropGap = 1.4;
  const minGapSq = minPropGap * minPropGap;
  let attempts = 0;
  while (attempts < 80) {
    attempts++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.88;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.88;
    if (isOnLavaSurface(lava, x, y, 0.6)) continue;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;
    for (const t of trees) {
      const dx = t.pos.x - x;
      const dy = t.pos.y - y;
      if (dx * dx + dy * dy < minGapSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const r of rocks) {
      const dx = r.pos.x - x;
      const dy = r.pos.y - y;
      if (dx * dx + dy * dy < minGapSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const egg: EasterEgg = {
      id: firstId,
      defId: def.id,
      pos: { x, y },
      rotY: rng() * Math.PI * 2,
      clickCount: 0,
      triggered: false,
      vel: null,
      despawnAt: null,
      spin: 0,
      rollPitch: 0,
    };
    return { eggs: [egg], nextId: firstId + 1 };
  }
  return { eggs: [], nextId: firstId };
};

const buildEasterEggSchedule = (biome: Biome, seed: number): EasterEggScheduleEntry[] => {
  const matching = EASTER_EGG_DEFS.filter(
    (d) => d.biomes.includes(biome) && d.scheduled !== undefined,
  );
  if (matching.length === 0) return [];
  const rng = mulberry32(seed);
  // One scheduled egg per matching def (e.g., one tumbleweed, one rover per
  // eligible level). Keeps the feel predictable per run.
  const out: EasterEggScheduleEntry[] = [];
  for (const def of matching) {
    const s = def.scheduled!;
    const t = s.earliestSec + rng() * Math.max(0, s.latestSec - s.earliestSec);
    out.push({ defId: def.id, triggerTime: t });
  }
  return out;
};

export const createWorld = (
  level: LevelConfig,
  difficulty: DifficultyMultipliers = DIFFICULTY_MULTIPLIERS.medium,
): World => {
  const biome = biomeForPos(level.nodePos);
  // Lava rivers and lakes block organic decoration placement so trees,
  // rocks, and easter eggs don't spawn in molten terrain. Pass null for
  // non-flow biomes so isOnLavaSurface short-circuits. The lava + alien biomes
  // share the same flow geometry — see hasFlowFeatures.
  const lava = hasFlowFeatures(biome) ? buildLavaFeatures(level.paths, level.id) : null;
  const { trees, nextId: afterTrees } = buildTrees(level.paths, level.id * 7919 + 101, 1, lava);
  const { rocks, nextId: afterRocks } = buildRocks(biome, level.paths, trees, afterTrees, lava);
  const { eggs, nextId } = buildEasterEggs(
    biome,
    level.paths,
    trees,
    rocks,
    level.id * 2311 + 47,
    afterRocks,
    lava,
  );
  const easterEggSchedule = buildEasterEggSchedule(biome, level.id * 5471 + 3);
  // Compose per-level hpScale × difficulty.hp into each wave's hpMul. The
  // spawner already respects spec.hpMul, so baking it once at creation
  // means the rest of the sim doesn't need to know about difficulty.
  const baseHpScale = (level.hpScale ?? 1) * difficulty.hp;
  const plannedWaves =
    baseHpScale === 1
      ? level.waves
      : level.waves.map((w) => ({ ...w, hpMul: (w.hpMul ?? 1) * baseHpScale }));
  return {
    time: 0,
    tickCount: 0,
    levelId: level.id,
    biome,
    paths: level.paths,
    plannedWaves,
    enemies: [],
    enemyById: new Map(),
    towers: [],
    towerById: new Map(),
    trees,
    rocks,
    projectiles: [],
    beams: [],
    explosions: [],
    cryoWaves: [],
    particles: [],
    spawnQueue: [],
    wave: 0,
    totalWaves: level.waves.length,
    waveActive: false,
    nextWaveIn: 2,
    waveTotalEnemies: 0,
    midwaveTimer: 0,
    midwaveTimerMax: 0,
    gold: Math.floor(level.startGold * difficulty.startGold),
    lives: STARTING_LIVES,
    startLives: STARTING_LIVES,
    status: "running",
    nextEntityId: nextId,
    events: [],
    shake: { magnitude: 0, decay: 0 },
    selectedTowerId: null,
    runEnemyKinds: {},
    runTowerKinds: {},
    easterEggs: eggs,
    easterEggSchedule,
    speedMul: difficulty.speed,
    goldKillMul: difficulty.goldKill,
  };
};

// Spawn a moving egg (tumbleweed/rover) at a random map edge heading toward
// the opposite edge. Straight-line traversal with a short life.
export const spawnMovingEasterEgg = (world: World, defId: string) => {
  const def = EASTER_EGG_DEFS.find((d) => d.id === defId);
  if (!def?.motion) return;
  if (world.easterEggs.some((e) => e.defId === defId)) return; // already present
  const rng = Math.random;
  // Pick a side (0: left, 1: right, 2: top, 3: bottom) and a perpendicular offset.
  const side = Math.floor(rng() * 4);
  const margin = 3;
  let start: Vec2;
  let dir: Vec2;
  if (side === 0) {
    start = { x: -MAP_WIDTH / 2 - margin, y: (rng() - 0.5) * MAP_HEIGHT * 0.6 };
    dir = { x: 1, y: 0 };
  } else if (side === 1) {
    start = { x: MAP_WIDTH / 2 + margin, y: (rng() - 0.5) * MAP_HEIGHT * 0.6 };
    dir = { x: -1, y: 0 };
  } else if (side === 2) {
    start = { x: (rng() - 0.5) * MAP_WIDTH * 0.6, y: MAP_HEIGHT / 2 + margin };
    dir = { x: 0, y: -1 };
  } else {
    start = { x: (rng() - 0.5) * MAP_WIDTH * 0.6, y: -MAP_HEIGHT / 2 - margin };
    dir = { x: 0, y: 1 };
  }
  const speed = def.motion.speed;
  const egg: EasterEgg = {
    id: world.nextEntityId++,
    defId: def.id,
    pos: { x: start.x, y: start.y },
    rotY: Math.atan2(dir.x, dir.y),
    clickCount: 0,
    triggered: false,
    vel: { x: dir.x * speed, y: dir.y * speed },
    despawnAt: world.time + def.motion.lifetime,
    spin: def.motion.spinRate ?? 0,
    rollPitch: 0,
  };
  // Use immutable append so React selectors see a new ref and rerender.
  world.easterEggs = [...world.easterEggs, egg];
};

export const updateEasterEggs = (world: World, dt: number) => {
  // Fire scheduled spawns whose time has come.
  if (world.easterEggSchedule.length > 0) {
    const remaining: EasterEggScheduleEntry[] = [];
    for (const entry of world.easterEggSchedule) {
      if (world.time >= entry.triggerTime) {
        spawnMovingEasterEgg(world, entry.defId);
      } else {
        remaining.push(entry);
      }
    }
    world.easterEggSchedule = remaining;
  }
  // Integrate motion + despawn expired eggs.
  if (world.easterEggs.length > 0) {
    world.easterEggs = world.easterEggs.filter((egg) => {
      if (!egg.vel) return true;
      egg.pos.x += egg.vel.x * dt;
      egg.pos.y += egg.vel.y * dt;
      const def = EASTER_EGG_BY_ID[egg.defId];
      // Tumble-mode eggs (barrel) keep their launch heading and accumulate
      // spin into rollPitch so they somersault forward instead of pivoting
      // around their vertical axis like a tumbleweed.
      if (def?.clickRoll?.tumble) {
        egg.rollPitch += egg.spin * dt;
      } else {
        egg.rotY += egg.spin * dt;
      }
      if (egg.despawnAt !== null && world.time >= egg.despawnAt) return false;
      return true;
    });
  }
};

type EnemyBaseStats = Pick<Enemy, "kind" | "hp" | "maxHp" | "speed" | "bounty" | "damage">;

export const ENEMY_STATS: Record<EnemyKind, EnemyBaseStats> = {
  raptor: { kind: "raptor", hp: 20, maxHp: 20, speed: 2.2, bounty: 3, damage: 1 },
  allosaur: { kind: "allosaur", hp: 60, maxHp: 60, speed: 1.4, bounty: 7, damage: 2 },
  stego: { kind: "stego", hp: 180, maxHp: 180, speed: 0.9, bounty: 16, damage: 3 },
  swarm: { kind: "swarm", hp: 10, maxHp: 10, speed: 3.0, bounty: 1, damage: 1 },
  armored: { kind: "armored", hp: 300, maxHp: 300, speed: 1.1, bounty: 22, damage: 1 },
  para: { kind: "para", hp: 45, maxHp: 45, speed: 1.8, bounty: 5, damage: 2 },
  titan: { kind: "titan", hp: 1200, maxHp: 1200, speed: 0.65, bounty: 48, damage: 8 },
};

// Per-kind shield pool used when a spec marks an enemy as shielded.
// Swarm units are too small to support a visible bubble — they always
// run unshielded regardless of spec flags.
export const SHIELD_BY_KIND: Record<EnemyKind, number> = {
  raptor: 10,
  allosaur: 35,
  stego: 80,
  swarm: 0,
  armored: 120,
  para: 25,
  titan: 400,
};

export const SHIELD_REGEN_DELAY = 4;
// Fraction of maxShield restored per second once regen kicks in.
export const SHIELD_REGEN_RATE = 0.25;

// Healer chip tuning — read by updateDefensive.
export const HEAL_AURA_RANGE = 3.5;
export const HEAL_AURA_RATE = 3;

// Regen chip tuning — slow passive self-heal. Pauses briefly on damage
// so the player's sustained DPS isn't "wasted" — it just isn't as
// efficient as a single burst. Tuned slower than the heal aura because
// regen comes for free; healers have to dedicate a slot.
export const REGEN_RATE = 1.5;
export const REGEN_DAMAGE_PAUSE = 1.5;

export const TOWER_DAMAGE_TYPE: Record<TowerKind, DamageType> = {
  pulse: "kinetic",
  chain: "electric",
  cryo: "cold",
  mortar: "explosive",
  flame: "flame",
  hive: "kinetic",
};

export const DAMAGE_TYPE_LABEL: Record<DamageType, string> = {
  kinetic: "Kinetic",
  electric: "Electric",
  cold: "Cold",
  explosive: "Explosive",
  flame: "Flame",
};

export const DAMAGE_TYPE_COLOR: Record<DamageType, string> = {
  kinetic: "#c9cbd1",
  electric: "#c48cff",
  cold: "#aaf0ff",
  explosive: "#ffb266",
  flame: "#ff5a3a",
};

// Flame is its own damage type so per-spawn `resists` chips can target
// it without also blocking mortar's explosive output. Default flame
// resist per kind mirrors the original explosive value so the split is
// balance-neutral until a wave's resist chip overrides it.
export const ENEMY_RESIST: Record<EnemyKind, Record<DamageType, number>> = {
  raptor: { kinetic: 1.0, electric: 1.5, cold: 0.6, explosive: 0.8, flame: 0.8 },
  allosaur: { kinetic: 1.0, electric: 1.0, cold: 1.0, explosive: 1.0, flame: 1.0 },
  stego: { kinetic: 0.4, electric: 1.7, cold: 1.0, explosive: 0.6, flame: 0.6 },
  swarm: { kinetic: 0.6, electric: 2.0, cold: 1.3, explosive: 1.7, flame: 1.7 },
  armored: { kinetic: 0.9, electric: 0.5, cold: 1.0, explosive: 0.4, flame: 0.4 },
  para: { kinetic: 1.1, electric: 1.0, cold: 1.0, explosive: 0.9, flame: 0.9 },
  titan: { kinetic: 0.5, electric: 0.9, cold: 1.3, explosive: 0.35, flame: 0.35 },
};

export const ENEMY_SLOW_RESIST: Record<EnemyKind, number> = {
  raptor: 0,
  allosaur: 0,
  stego: 0.35,
  swarm: 0,
  armored: 0.75,
  para: 0,
  titan: 0.5,
};

// Per-chip stat multipliers — applied at spawn (HP/damage/bounty) or
// derived per-tick (resist flatten, slow resist). Chips compose: a
// raptor with both `elite` and `fierce` gets the resist flatten and
// the damage bump and the bounty stacks multiplicatively.
//
// Elite chip — slows the kill but doesn't make the enemy hit harder.
export const ELITE_RESIST_FLATTEN = 0.15;
export const ELITE_SLOW_RESIST_BONUS = 0.25;
export const ELITE_SLOW_RESIST_CAP = 0.95;

// Fierce chip — purely offensive bump.
export const FIERCE_DAMAGE_MUL = 1.4;

// Bounty multipliers per active chip. Stack multiplicatively at spawn
// time, so an elite-shielded-fierce raptor pays out roughly 2× its
// vanilla bounty without any single chip dominating.
export const SHIELDED_BOUNTY_MUL = 1.3;
export const HEAL_AURA_BOUNTY_MUL = 1.4;
export const REGEN_BOUNTY_MUL = 1.3;
export const ELITE_BOUNTY_MUL = 1.4;
export const FIERCE_BOUNTY_MUL = 1.3;

export const MIN_SLOW_FACTOR = 0.25;

export const ENEMY_MODEL: Record<EnemyKind, { url: string; targetSize: number; clip?: string }> = {
  raptor: { url: "/models/Velociraptor.glb", targetSize: 1.6 },
  swarm: { url: "/models/Velociraptor.glb", targetSize: 0.8 },
  para: { url: "/models/Parasaurolophus.glb", targetSize: 1.7 },
  allosaur: { url: "/models/Trex.glb", targetSize: 2.2 },
  stego: { url: "/models/Stegosaurus.glb", targetSize: 1.9 },
  armored: { url: "/models/Triceratops.glb", targetSize: 2.0 },
  titan: { url: "/models/Apatosaurus.glb", targetSize: 11.0, clip: "Walk" },
};

export const ENEMY_LABEL: Record<EnemyKind, string> = {
  raptor: "Raptor",
  allosaur: "T-Rex",
  stego: "Stegosaur",
  swarm: "Swarm",
  armored: "Triceratops",
  para: "Parasaur",
  titan: "Apatosaur",
};

// Per-kind elite material tint — a distinct palette per species so the
// elite chip reads as "this kind, but the dangerous variant" rather
// than a uniform red wash. Read by ModelEnemyMesh.
export const ELITE_TINT_BY_KIND: Record<EnemyKind, string> = {
  raptor: "#ff3a30", // bright crimson — predator pack alpha
  swarm: "#ff8a3a", // burnt orange — angrier wasp tone
  para: "#a25aff", // royal purple — runner with shimmering crest
  allosaur: "#ffb030", // gold — apex-of-apex
  stego: "#3affb0", // jade — carved jade plates
  armored: "#5ad6ff", // glacial blue — chrome-plated tank
  titan: "#ffd24a", // burnished gold — legendary colossus
};

// Tier-3 anti-modifier hit options carried by tower fire paths into
// applyDamage. Defaults are inert — only towers that have purchased the
// matching T3 upgrade populate them.
export type HitOptions = {
  shieldDamageMul?: number; // Mortar T3: extra damage to shields specifically
  armorPierce?: boolean; // Pulse T3: clamp resist-chip multipliers to ≥1
  resistStrip?: number; // Chain T3: permanently strip own-type resist toward 1
  regenSuppressOnHit?: number; // Pyre T3: extends regen pause after each hit
};

export const applyDamage = (
  world: World,
  enemy: Enemy,
  amount: number,
  type: DamageType,
  deathColor = "#c44848",
  deathParticles = 8,
  pierceShield = false,
  hitOpts?: HitOptions,
) => {
  if (!enemy.alive) return;
  let dmg = amount;

  // Shields absorb damage flat (ignoring damage type) before HP, unless
  // the source flagged itself as shield-piercing. The resist multiplier
  // only applies to the leftover dealt to HP, so a shielded raptor still
  // takes proper electric scaling once cracked.
  if (!pierceShield && enemy.shield > 0) {
    // Mortar T3 (Singularity) amplifies shield damage 2×.
    const shieldMul = hitOpts?.shieldDamageMul ?? 1;
    const shieldDmg = dmg * shieldMul;
    const absorbed = Math.min(enemy.shield, shieldDmg);
    enemy.shield -= absorbed;
    // Convert shield-attributed damage back to "raw" units so HP bleed
    // isn't double-counted by the multiplier.
    dmg -= absorbed / shieldMul;
    enemy.flashUntil = world.time + 0.08;
    if (enemy.shield <= 0) {
      enemy.shield = 0;
      enemy.shieldBrokenAt = world.time;
      // Visible "break" pop — light blue energy burst around the enemy.
      spawnParticles(world, enemy.pos, 12, "#7fc8ff", [3, 6], 0.45);
    }
    if (dmg <= 0) return;
  }

  const baseMul = ENEMY_RESIST[enemy.kind][type];
  // Elite chip flattens the resist spread toward 1.0 — fewer hard
  // counters, fewer free wins. A stego with the elite chip still
  // resists kinetic, just less.
  let mul = enemy.elite ? baseMul + (1 - baseMul) * ELITE_RESIST_FLATTEN : baseMul;
  // Resists chip — per-spawn multiplier on the damage type. Pulse T3
  // (Annihilator) clamps modifier-induced resists below 1 to 1, undoing
  // adaptation entirely for kinetic hits.
  const rawExtra = enemy.extraResists[type] ?? 1;
  const extraMul = hitOpts?.armorPierce && rawExtra < 1 ? 1 : rawExtra;
  mul *= extraMul;
  enemy.hp -= dmg * mul;
  enemy.flashUntil = world.time + 0.08;
  // Regen chip self-heal pauses on every damage tick. Pyre T3 extends
  // the pause window further per hit; without T3 the default
  // REGEN_DAMAGE_PAUSE applies.
  if (enemy.regen) {
    const pause = Math.max(REGEN_DAMAGE_PAUSE, hitOpts?.regenSuppressOnHit ?? 0);
    enemy.regenPausedUntil = Math.max(enemy.regenPausedUntil, world.time + pause);
  }
  // Chain T3 (Arc Furnace) gradually undoes the resist-chip adaptation:
  // each hit pulls extraResists[type] toward 1. Stops being chill when
  // the modifier no longer pulls effective resist below 1.
  if (hitOpts?.resistStrip && hitOpts.resistStrip > 0 && rawExtra < 1) {
    enemy.extraResists[type] = Math.min(1, rawExtra + hitOpts.resistStrip);
  }
  if (enemy.hp <= 0) {
    enemy.alive = false;
    world.gold += enemy.bounty;
    spawnParticles(world, enemy.pos, deathParticles, deathColor);
    emit(world, { type: "death", pos: enemy.pos });
  }
};

// Titans are too wide to bounce around the lane — pinning them near the
// centerline keeps the stomp feeling authoritative. Everyone else gets
// the full lateral range.
const LATERAL_OFFSET_BY_KIND: Record<EnemyKind, number> = {
  raptor: PATH_WIDTH * 0.35,
  swarm: PATH_WIDTH * 0.4,
  para: PATH_WIDTH * 0.3,
  allosaur: PATH_WIDTH * 0.25,
  stego: PATH_WIDTH * 0.2,
  armored: PATH_WIDTH * 0.2,
  titan: PATH_WIDTH * 0.08,
};

export type SpawnOptions = {
  hpMul?: number;
  pathIndex?: number;
  shielded?: boolean;
  healAura?: boolean;
  regen?: boolean;
  elite?: boolean;
  fierce?: boolean;
  // Per-damage-type adaptation — values < 1 reduce damage taken,
  // values > 1 increase. Stacks on top of base resists and elite-flatten.
  resists?: Partial<Record<DamageType, number>>;
};

export const spawnEnemy = (world: World, kind: EnemyKind, opts: SpawnOptions = {}): Enemy => {
  const {
    hpMul = 1,
    pathIndex = 0,
    shielded = false,
    healAura = false,
    regen = false,
    elite = false,
    fierce = false,
    resists,
  } = opts;
  const base = ENEMY_STATS[kind];
  const path = world.paths[pathIndex] ?? world.paths[0];
  const start = path[0];
  const maxHp = Math.ceil(base.hp * hpMul);
  // Damage bump comes from `fierce` — elite is purely a defensive chip.
  const damage = fierce ? Math.ceil(base.damage * FIERCE_DAMAGE_MUL) : base.damage;
  // Bounty stacks multiplicatively per active chip so combos pay out
  // proportionally to the threat — never extra-flat from one big chip.
  let bountyMul = 1;
  if (shielded) bountyMul *= SHIELDED_BOUNTY_MUL;
  if (healAura) bountyMul *= HEAL_AURA_BOUNTY_MUL;
  if (regen) bountyMul *= REGEN_BOUNTY_MUL;
  if (elite) bountyMul *= ELITE_BOUNTY_MUL;
  if (fierce) bountyMul *= FIERCE_BOUNTY_MUL;
  // Difficulty's gold-per-kill multiplier folds in here so the existing
  // `world.gold += enemy.bounty` in applyDamage stays a single read.
  const bounty = Math.max(1, Math.ceil(base.bounty * bountyMul * world.goldKillMul));
  // Shield pool is fixed by kind (not scaled by hpMul) — that way the
  // tutorial-feel of cracking a raptor's 10-pt bubble doesn't erode at
  // late levels where hpMul is high.
  const baseShield = SHIELD_BY_KIND[kind] ?? 0;
  const maxShield = shielded && baseShield > 0 ? baseShield : 0;
  // Bias away from zero so enemies actually spread — pure uniform often
  // clusters near 0 visually when there are only a handful on screen.
  const range = LATERAL_OFFSET_BY_KIND[kind];
  const lateralOffset = (Math.random() * 2 - 1) * range;
  const enemy: Enemy = {
    id: world.nextEntityId++,
    kind: base.kind,
    pos: { x: start.x, y: start.y },
    pathIndex,
    segment: 0,
    segmentT: 0,
    lateralOffset,
    hp: maxHp,
    maxHp,
    speed: base.speed * world.speedMul,
    bounty,
    damage,
    alive: true,
    slowUntil: 0,
    slowFactor: 1,
    flashUntil: 0,
    frost: 0,
    shield: maxShield,
    maxShield,
    shieldBrokenAt: 0,
    healAura,
    regen,
    elite,
    fierce,
    regenPausedUntil: 0,
    extraResists: resists ? { ...resists } : {},
  };
  world.enemies.push(enemy);
  world.enemyById.set(enemy.id, enemy);
  world.runEnemyKinds[kind] = true;
  return enemy;
};

export type TowerBaseStats = {
  range: number;
  damage: number;
  fireRate: number;
  splashRadius: number;
  chainCount: number;
  chainFalloff: number;
  slowFactor: number;
  slowDuration: number;
};

export const TOWER_STATS: Record<TowerKind, TowerBaseStats> = {
  pulse: {
    range: 6.5,
    damage: 10,
    fireRate: 2.0,
    splashRadius: 0,
    chainCount: 0,
    chainFalloff: 1,
    slowFactor: 1,
    slowDuration: 0,
  },
  chain: {
    range: 5.5,
    damage: 9,
    fireRate: 1.2,
    splashRadius: 0,
    chainCount: 7,
    chainFalloff: 0.6,
    slowFactor: 1,
    slowDuration: 0,
  },
  cryo: {
    range: 4.5,
    damage: 0,
    fireRate: 1.5,
    splashRadius: 0,
    chainCount: 0,
    chainFalloff: 1,
    slowFactor: 0.4,
    slowDuration: 1.5,
  },
  mortar: {
    range: 9.0,
    damage: 26,
    fireRate: 0.5,
    splashRadius: 1.8,
    chainCount: 0,
    chainFalloff: 1,
    slowFactor: 1,
    slowDuration: 0,
  },
  // Flame — mid-range forward cone, base damage at high tick rate so it
  // reads as a continuous burn on anything stuck in the stream.
  flame: {
    range: 6.0,
    damage: 5,
    fireRate: 5.0,
    splashRadius: 0,
    chainCount: 0,
    chainFalloff: 1,
    slowFactor: 1,
    slowDuration: 0,
  },
  // Hive — pure support tower. `damage` and `fireRate` are unused (UI
  // hides them); the relevant numbers are HIVE_BASE_DRONES + the
  // serviceBuff fraction set in createTower / upgrades. Range is what
  // shows as the tower's selection ring but doesn't gate anything sim-
  // side: drones can fly to any tower on the map.
  hive: {
    range: 0,
    damage: 0,
    fireRate: 0,
    splashRadius: 0,
    chainCount: 0,
    chainFalloff: 1,
    slowFactor: 1,
    slowDuration: 0,
  },
};

// Hive support tuning. Drone count grows with Path A upgrades up to a
// hard cap so the assignment array can be statically sized.
export const HIVE_BASE_DRONES = 3;
export const HIVE_MAX_DRONES = 6;
// Default fire-rate buff each assigned drone confers to its target.
// Path B upgrades scale this — see upgrades.ts.
export const HIVE_BASE_SERVICE_BUFF = 0.3;

export const TOWER_COST: Record<TowerKind, number> = {
  pulse: 50,
  chain: 50,
  cryo: 75,
  mortar: 120,
  flame: 80,
  hive: 150,
};

export const TOWER_LABEL: Record<TowerKind, string> = {
  pulse: "Pulse Rifle",
  chain: "Chain Coil",
  cryo: "Cryo Emitter",
  mortar: "Mortar",
  flame: "Pyre",
  hive: "Hive Swarm",
};

export const TOWER_FOOTPRINT = 1.0;

export const createTower = (world: World, kind: TowerKind, pos: Vec2): Tower => {
  const stats = TOWER_STATS[kind];
  const tower: Tower = {
    id: world.nextEntityId++,
    kind,
    pos: { x: pos.x, y: pos.y },
    range: stats.range,
    damage: stats.damage,
    fireRate: stats.fireRate,
    cooldown: 0,
    targetId: null,
    targetingMode: "end",
    targetSpot: null,
    upgrades: { a: 0, b: 0 },
    totalSpent: TOWER_COST[kind],
    splashRadius: stats.splashRadius,
    chainCount: stats.chainCount,
    chainFalloff: stats.chainFalloff,
    slowFactor: stats.slowFactor,
    slowDuration: stats.slowDuration,
    // Hive support — drone count caps at HIVE_MAX_DRONES so assignment
    // arrays stay fixed-size; only the first `droneCount` entries are
    // active. Non-hive towers get zero/empty defaults.
    droneCount: kind === "hive" ? HIVE_BASE_DRONES : 0,
    droneAssignments: kind === "hive" ? new Array<number | null>(HIVE_MAX_DRONES).fill(null) : [],
    serviceBuff: kind === "hive" ? HIVE_BASE_SERVICE_BUFF : 0,
    serviceFireRateBonus: 0,
    // T3 anti-modifier flags — defaults are inert; specific tier-3
    // upgrades flip these in `upgrades.ts` so the projectile/hit path
    // can crack through `resists` chip adaptation.
    shieldDamageMul: 1,
    armorPierce: false,
    resistStrip: 0,
    regenSuppressOnHit: 0,
    freezeBlocksRegen: false,
  };
  world.towers.push(tower);
  world.towerById.set(tower.id, tower);
  world.runTowerKinds[kind] = true;
  return tower;
};

export const createProjectile = (
  world: World,
  kind: ProjectileKind,
  damageType: DamageType,
  pos: Vec2,
  target: { id: number; pos: Vec2 } | Vec2,
  damage: number,
  splashRadius = 0,
  speed = 22,
  pierceShield = false,
  hitOpts?: HitOptions,
): Projectile => {
  const targetId = "id" in target ? target.id : null;
  const targetPos = "pos" in target ? { ...target.pos } : { x: target.x, y: target.y };
  const p: Projectile = {
    id: world.nextEntityId++,
    kind,
    damageType,
    pos: { x: pos.x, y: pos.y },
    targetId,
    targetPos,
    damage,
    speed,
    splashRadius,
    alive: true,
    pierceShield,
    shieldDamageMul: hitOpts?.shieldDamageMul ?? 1,
    armorPierce: hitOpts?.armorPierce ?? false,
    resistStrip: hitOpts?.resistStrip ?? 0,
    regenSuppressOnHit: hitOpts?.regenSuppressOnHit ?? 0,
  };
  world.projectiles.push(p);
  return p;
};

export const createBeam = (world: World, points: Vec2[], color: string, lifeSec = 0.12): Beam => {
  const b: Beam = {
    id: world.nextEntityId++,
    points: points.map((p) => ({ x: p.x, y: p.y })),
    color,
    expiresAt: world.time + lifeSec,
  };
  world.beams.push(b);
  return b;
};

export const createCryoWave = (
  world: World,
  pos: Vec2,
  maxRadius: number,
  lifeSec = 0.55,
): CryoWave => {
  const w: CryoWave = {
    id: world.nextEntityId++,
    pos: { x: pos.x, y: pos.y },
    maxRadius,
    expiresAt: world.time + lifeSec,
    maxLife: lifeSec,
  };
  world.cryoWaves.push(w);
  return w;
};

export const createExplosion = (
  world: World,
  pos: Vec2,
  radius: number,
  lifeSec = 0.35,
): Explosion => {
  const e: Explosion = {
    id: world.nextEntityId++,
    pos: { x: pos.x, y: pos.y },
    radius,
    expiresAt: world.time + lifeSec,
    maxLife: lifeSec,
  };
  world.explosions.push(e);
  return e;
};

export const spawnParticles = (
  world: World,
  pos: Vec2,
  count: number,
  color: string,
  speedRange: [number, number] = [2, 5],
  lifeSec = 0.35,
  baseDir?: Vec2,
  halfConeRadians?: number,
) => {
  const hasDir = baseDir && (baseDir.x !== 0 || baseDir.y !== 0);
  const baseAngle = hasDir ? Math.atan2(baseDir!.y, baseDir!.x) : 0;
  const halfCone = hasDir ? (halfConeRadians ?? Math.PI / 6) : Math.PI;
  for (let i = 0; i < count; i++) {
    const angle = hasDir
      ? baseAngle + (Math.random() * 2 - 1) * halfCone
      : Math.random() * Math.PI * 2;
    const spd = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    world.particles.push({
      id: world.nextEntityId++,
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd },
      expiresAt: world.time + lifeSec,
      maxLife: lifeSec,
      color,
    });
  }
};

export const emit = (world: World, event: GameEvent) => {
  world.events.push(event);
};

export const addShake = (world: World, magnitude: number, decay = 6) => {
  world.shake.magnitude = Math.max(world.shake.magnitude, magnitude);
  world.shake.decay = decay;
};

export const enemyPosOnPath = (world: World, enemy: Enemy): Vec2 =>
  samplePath(world.paths[enemy.pathIndex], enemy.segment, enemy.segmentT);

export const applySlow = (enemy: Enemy, world: World, factor: number, duration: number) => {
  const baseResist = ENEMY_SLOW_RESIST[enemy.kind];
  const resist = enemy.elite
    ? Math.min(ELITE_SLOW_RESIST_CAP, baseResist + ELITE_SLOW_RESIST_BONUS)
    : baseResist;
  const resisted = factor + (1 - factor) * resist;
  const eff = Math.max(MIN_SLOW_FACTOR, resisted);
  if (eff >= 1) return;
  const until = world.time + duration;
  if (until > enemy.slowUntil) {
    enemy.slowUntil = until;
    enemy.slowFactor = Math.min(enemy.slowFactor, eff);
  } else if (eff < enemy.slowFactor) {
    enemy.slowFactor = eff;
  }
};
