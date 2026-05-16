import { BIOME_LAYERS, type Biome, type BiomeLayer, biomeForPos } from "../biomes";
import { EASTER_EGG_BY_ID, EASTER_EGG_DEFS } from "../easterEggs";
import {
  buildLavaFeatures,
  hasFlowFeatures,
  isOnLavaSurface,
  type LavaFeatures,
} from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import { type LevelConfig, resolveLevelMode } from "../levels";
import { DIFFICULTY_MULTIPLIERS, type DifficultyMultipliers, type LevelMode } from "../progress";
import {
  type AllHeroSkills,
  applyHeroSkillsToHero,
  levelForXp,
  xpForEnemyKill,
} from "./heroSkills";
import { HERO_SPECS } from "./heroVariants";
import { samplePath, smoothPath } from "./path";
import { poissonDiskSample } from "./poisson";
import { mulberry32 } from "./random";
import type {
  Beam,
  BossVariant,
  CryoWave,
  DamageType,
  EasterEgg,
  EasterEggScheduleEntry,
  Enemy,
  EnemyKind,
  EntityId,
  Explosion,
  GameEvent,
  Hero,
  HeroVariant,
  Projectile,
  ProjectileKind,
  Rock,
  Tower,
  TowerKind,
  Tree,
  Vec2,
  World,
} from "./types";
import { distPointToSegSq } from "./vec2";
import { createWorleyField } from "./worley";

export const STARTING_LIVES = 20;

// HQ base weapon — a short-range kinetic laser bolted onto the HQ
// turret. Last-ditch defense: tight range so it only engages enemies
// already close to the gate, modest damage that scales through two
// upgrade branches. One set of stats applies to every HQ on the map
// (multi-path levels each fire their own beam from these shared stats).
export const BASE_RANGE = 4.8;
export const BASE_DAMAGE = 8;
export const BASE_FIRE_RATE = 1.0;

// Hero unit — single controllable mecha that walks the field, auto-shoots
// dinos in range, and fires three activated abilities. Stats now ship
// from heroVariants.HERO_SPECS so per-mech balance lives there; this
// module keeps only platform constants (collision radius, respawn delay).
export const HERO_RADIUS = 0.45;
export const HERO_RESPAWN_DELAY = 6.0;

const heroDefaults = (variant: HeroVariant, pos: Vec2, id: EntityId, xp: number): Hero => {
  const spec = HERO_SPECS[variant];
  return {
    id,
    variant,
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    facing: 0,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    damage: spec.damage,
    range: spec.range,
    fireRate: spec.fireRate,
    speed: spec.speed,
    attackSplashRadius: spec.attackSplashRadius,
    damageType: spec.damageType,
    attackCooldown: 0,
    abilityReadyAt: [0, 0, 0],
    abilityActiveUntil: [0, 0, 0],
    abilityCooldownMul: 1,
    damageMul: 1,
    payload: null,
    pendingShots: [],
    targetId: null,
    moveTarget: null,
    alive: true,
    flashUntil: 0,
    shootFlashUntil: 0,
    respawnAt: null,
    lastDamagedAt: -1000,
    selected: false,
    xp,
    level: levelForXp(xp),
    stuckTimer: 0,
    motionState: "idle",
  };
};

export const TREE_COUNT = 22;
// Trees clump into a handful of groves rather than evenly speckling the
// map. The Worley field plants this many "grove centres"; Poisson then
// fills around them at variable spacing.
const TREE_GROVE_COUNT = 5;
const TREE_GROVE_RADIUS = 3.8;
// Looser-than-min spacing in low-density (between-grove) regions.
const TREE_MAX_SPACING = 7.0;
export const TREE_VARIANTS = 4;
export const TREE_CLEARANCE_MARGIN = 2.3;
// Wider range with a slight central bias gives a more natural mix —
// most trees mid-sized, with the occasional sapling and elder.
export const TREE_MIN_SCALE = 0.5;
export const TREE_MAX_SCALE = 1.1;
export const TREE_MIN_SPACING = 2.9;
export const TREE_FOOTPRINT = 0.85;
export const TREE_REMOVE_COST = 10;

// Rock footprint radius (before per-instance scale multiplier).
export const ROCK_FOOTPRINT = 0.65;
export const ROCK_MIN_SPACING = 1.85;
export const ROCK_REMOVE_COST = 15;

const blockingFootprint = (spec: BiomeLayer): number => spec.footprint ?? ROCK_FOOTPRINT;

// Per-URL XZ radius cache — populated by render components (Trees.tsx,
// Rocks.tsx) when GLBs load, read by canPlaceAt for placement blocking.
export const meshXZRadii = new Map<string, number>();

const buildTrees = (
  paths: Vec2[][],
  seed: number,
  firstId: number,
  lava: LavaFeatures | null,
): { trees: Tree[]; nextId: number } => {
  const clearance = PATH_WIDTH / 2 + TREE_CLEARANCE_MARGIN;
  const pathR2 = clearance * clearance;
  const halfW = MAP_WIDTH / 2 + 11;
  const halfH = MAP_HEIGHT / 2 + 9;
  const bounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };

  // Worley field: scatter TREE_GROVE_COUNT "grove centres" — density is
  // 1 at a centre, smoothly decaying to 0 at TREE_GROVE_RADIUS. Poisson
  // packs tight inside groves (TREE_MIN_SPACING), loose between them
  // (TREE_MAX_SPACING) — natural-looking woodland rather than even mat.
  const worley = createWorleyField(seed, bounds, TREE_GROVE_COUNT, TREE_GROVE_RADIUS);
  const radiusAt = (x: number, y: number): number => {
    const d = worley.density(x, y);
    return TREE_MIN_SPACING + (1 - d) * (TREE_MAX_SPACING - TREE_MIN_SPACING);
  };

  const isValid = (x: number, y: number): boolean => {
    if (isOnLavaSurface(lava, x, y, TREE_FOOTPRINT)) return false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          return false;
        }
      }
    }
    return true;
  };

  const points = poissonDiskSample({
    bounds,
    radiusAt,
    isValid,
    maxCount: TREE_COUNT,
    seed: seed * 31 + 17,
    // Seed Bridson with each grove centre so the placement spreads
    // across all groves rather than packing TREE_COUNT trees around
    // the first one the algorithm walks into.
    initialPoints: worley.features,
  });

  // Variant/scale/rot stream is independent so changes to count/spacing
  // don't shift these per-tree details when only one factor moves.
  const rng = mulberry32(seed * 53 + 91);
  const trees: Tree[] = [];
  let nextId = firstId;
  for (const p of points) {
    trees.push({
      id: nextId++,
      pos: { x: p.x, y: p.y },
      variant: Math.floor(rng() * TREE_VARIANTS),
      // Triangular distribution (avg of two uniforms) biases toward mid-size,
      // so saplings and elders are uncommon but visible.
      scale: TREE_MIN_SCALE + ((rng() + rng()) / 2) * (TREE_MAX_SCALE - TREE_MIN_SCALE),
      rot: rng() * Math.PI * 2,
    });
  }
  return { trees, nextId };
};

// Per-layer rock-to-rock spacing multiplier — sparse-region Poisson
// radius is ROCK_MIN_SPACING × this. Tuned so the variation between
// "rock pile centre" and "loose stones" reads naturally.
const ROCK_MAX_SPACING_MUL = 3.0;

const buildRocks = (
  biome: Biome,
  paths: Vec2[][],
  trees: Tree[],
  firstId: number,
  lava: LavaFeatures | null,
  levelId: number,
): { rocks: Rock[]; nextId: number } => {
  const rocks: Rock[] = [];
  const halfW = MAP_WIDTH / 2 + 11;
  const halfH = MAP_HEIGHT / 2 + 9;
  const bounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };
  let nextId = firstId;

  const layers = BIOME_LAYERS[biome];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const spec = layers[layerIndex];
    if (!spec.blocks) continue;
    const seedBase = spec.seed + levelId * 1013 + layerIndex * 97;

    // Each blocking layer gets its own Worley field — different layers
    // in the same biome have independent feature positions so a rock-
    // pile centre and a crystal-cluster centre don't always line up.
    const sigma = spec.cluster?.sigma ?? 2.5;
    const featureRadius = sigma * 2.0;
    const featureCount = spec.cluster?.seeds ?? 5;
    const worley = createWorleyField(seedBase, bounds, featureCount, featureRadius);
    const baseFootprint = blockingFootprint(spec);
    const avgScale = (spec.minScale + spec.maxScale) / 2;
    const candidateR = baseFootprint * spec.maxScale;
    const treeSpacing = candidateR + TREE_FOOTPRINT * 0.8;
    const treeSpacingSq = treeSpacing * treeSpacing;
    const rMin = Math.max(ROCK_MIN_SPACING, 2 * baseFootprint * avgScale + 0.4);
    const rMax = rMin * ROCK_MAX_SPACING_MUL;
    const radiusAt = (x: number, y: number): number => {
      const d = worley.density(x, y);
      return rMin + (1 - d) * (rMax - rMin);
    };

    const pathR2 = spec.clearance * spec.clearance;
    // Snapshot rocks from earlier layers so this layer's Poisson treats
    // them as fixed blockers (no overlap regardless of within-layer
    // density variation).
    const earlierRocks = rocks.slice();
    // Conservative lava check — use max scale footprint so a max-scale
    // rock at this position couldn't touch lava either.
    const lavaFootprint = candidateR + 0.1;

    const isValid = (x: number, y: number): boolean => {
      if (isOnLavaSurface(lava, x, y, lavaFootprint)) return false;
      for (const path of paths) {
        for (let i = 0; i < path.length - 1; i++) {
          if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
            return false;
          }
        }
      }
      for (const tr of trees) {
        const dx = tr.pos.x - x;
        const dy = tr.pos.y - y;
        if (dx * dx + dy * dy < treeSpacingSq) return false;
      }
      for (const r of earlierRocks) {
        const dx = r.pos.x - x;
        const dy = r.pos.y - y;
        const priorSpec = layers[r.layerIndex];
        const priorR = (priorSpec ? blockingFootprint(priorSpec) : ROCK_FOOTPRINT) * r.scale;
        const minDist = candidateR + priorR + 0.45;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
      return true;
    };

    const points = poissonDiskSample({
      bounds,
      radiusAt,
      isValid,
      maxCount: spec.count,
      seed: seedBase * 31 + 17,
      // Seed Bridson with each Worley feature so every rock pile gets
      // its own frontier instead of all `spec.count` rocks stacking
      // around the first feature the algorithm reaches.
      initialPoints: worley.features,
    });

    const detailRng = mulberry32(seedBase * 53 + 91);
    for (const p of points) {
      const variant = Math.floor(detailRng() * spec.urls.length);
      const scale =
        spec.minScale + ((detailRng() + detailRng()) / 2) * (spec.maxScale - spec.minScale);
      const rot = detailRng() * Math.PI * 2;
      rocks.push({
        id: nextId++,
        pos: { x: p.x, y: p.y },
        layerIndex,
        variant,
        scale,
        rot,
      });
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
  unlockedAchievements: ReadonlySet<string>,
): { eggs: EasterEgg[]; nextId: number } => {
  // Only consider statically-placed eggs here — moving ones spawn on a
  // schedule via updateEasterEggs. Eggs whose achievement has already
  // been unlocked never spawn again so each surprise lands once per save.
  const matching = EASTER_EGG_DEFS.filter(
    (d) => d.biomes.includes(biome) && !d.motion && !unlockedAchievements.has(d.achievement),
  );
  if (matching.length === 0) return { eggs: [], nextId: firstId };
  const rng = mulberry32(seed);
  if (rng() > 0.42) return { eggs: [], nextId: firstId };
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

const buildEasterEggSchedule = (
  biome: Biome,
  seed: number,
  unlockedAchievements: ReadonlySet<string>,
): EasterEggScheduleEntry[] => {
  const matching = EASTER_EGG_DEFS.filter(
    (d) =>
      d.biomes.includes(biome) &&
      d.scheduled !== undefined &&
      !unlockedAchievements.has(d.achievement),
  );
  if (matching.length === 0) return [];
  const rng = mulberry32(seed);
  if (rng() > 0.5) return [];
  const def = matching[Math.floor(rng() * matching.length)];
  const s = def.scheduled!;
  const t = s.earliestSec + rng() * Math.max(0, s.latestSec - s.earliestSec);
  return [{ defId: def.id, triggerTime: t }];
};

export type HeroContext = {
  variant: HeroVariant;
  xp: number;
  skills: AllHeroSkills;
};

const DEFAULT_HERO_CONTEXT: HeroContext = {
  variant: "george",
  xp: 0,
  skills: {},
};

export const createWorld = (
  level: LevelConfig,
  mode: LevelMode = "normal",
  difficulty: DifficultyMultipliers = DIFFICULTY_MULTIPLIERS.medium,
  unlockedAchievements: ReadonlySet<string> = new Set(),
  heroCtx: HeroContext = DEFAULT_HERO_CONTEXT,
): World => {
  const biome = biomeForPos(level.nodePos);
  const modeConfig = resolveLevelMode(level, mode);
  // Smooth the authored corner waypoints into the dense polyline that
  // everything downstream walks: enemy advancement, render strip, tower
  // placement clearance, lava bridge cuts, decoration spacing. Doing this
  // once here is what keeps the painted lane and the enemy lane aligned —
  // if any consumer fell back to the raw waypoints they'd cut corners
  // that the others curved around.
  const paths = level.paths.map((p) => smoothPath(p));
  // Lava rivers and lakes block organic decoration placement so trees,
  // rocks, and easter eggs don't spawn in molten terrain. Pass null for
  // non-flow biomes so isOnLavaSurface short-circuits. The lava + alien biomes
  // share the same flow geometry — see hasFlowFeatures.
  const lava = hasFlowFeatures(biome) ? buildLavaFeatures(paths, level.id, biome) : null;
  const { trees, nextId: afterTrees } = buildTrees(paths, level.id * 7919 + 101, 1, lava);
  const { rocks, nextId: afterRocks } = buildRocks(biome, paths, trees, afterTrees, lava, level.id);
  const { eggs, nextId } = buildEasterEggs(
    biome,
    paths,
    trees,
    rocks,
    level.id * 2311 + 47,
    afterRocks,
    lava,
    unlockedAchievements,
  );
  const easterEggSchedule = buildEasterEggSchedule(
    biome,
    level.id * 5471 + 3,
    unlockedAchievements,
  );
  // Compose per-level hpScale × difficulty.hp into each wave's hpMul. The
  // spawner already respects spec.hpMul, so baking it once at creation
  // means the rest of the sim doesn't need to know about difficulty.
  const baseHpScale = (level.hpScale ?? 1) * difficulty.hp;
  const modeWaves = modeConfig.waves;
  const plannedWaves =
    baseHpScale === 1
      ? modeWaves
      : modeWaves.map((w) => ({ ...w, hpMul: (w.hpMul ?? 1) * baseHpScale }));
  // Iron mode caps lives at 1; every other mode starts at the full HQ
  // life pool. The runtime never tops these up, so this is the only
  // place the value is set per run.
  const startingLives = modeConfig.singleLife ? 1 : STARTING_LIVES;
  // Hero spawns a few units back from HQ along the first path's tangent,
  // shifted off-center so she doesn't sit on the lane. Reuses the path
  // end direction so the spawn lines up with whichever side faces HQ.
  const firstPath = paths[0] ?? [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const endPt = firstPath[firstPath.length - 1] ?? { x: 0, y: 0 };
  const prevPt = firstPath[firstPath.length - 2] ?? endPt;
  const tx = endPt.x - prevPt.x;
  const ty = endPt.y - prevPt.y;
  const tl = Math.hypot(tx, ty) || 1;
  const tdx = tx / tl;
  const tdy = ty / tl;
  // Perpendicular off-lane offset (left of travel direction).
  const heroSpawn: Vec2 = {
    x: endPt.x - tdx * 2.6 + -tdy * 2.4,
    y: endPt.y - tdy * 2.6 + tdx * 2.4,
  };
  const hero = heroDefaults(heroCtx.variant, heroSpawn, nextId, heroCtx.xp);
  hero.facing = Math.atan2(-tdx, tdy);
  applyHeroSkillsToHero(hero, heroCtx.skills);
  // Snap HP to maxHp post-skills so vitality ranks don't leave the hero
  // partly damaged. Done after applyHeroSkillsToHero (which bumps both).
  hero.hp = hero.maxHp;
  return {
    time: 0,
    tickCount: 0,
    levelId: level.id,
    biome,
    paths,
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
    bossTrickleStreams: [],
    bossTrickleIntervalMul: difficulty.bossTrickleIntervalMul,
    wave: 0,
    totalWaves: modeWaves.length,
    waveActive: false,
    nextWaveIn: 2,
    waveTotalEnemies: 0,
    midwaveTimer: 0,
    midwaveTimerMax: 0,
    gold: Math.floor(modeConfig.startGold * difficulty.startGold),
    lives: startingLives,
    startLives: startingLives,
    status: "running",
    killingPathIndex: null,
    nextEntityId: nextId + 1,
    hero,
    events: [],
    shake: { magnitude: 0, decay: 0 },
    selectedTowerId: null,
    selectedBase: false,
    base: {
      damage: BASE_DAMAGE,
      fireRate: BASE_FIRE_RATE,
      range: BASE_RANGE,
      cooldowns: paths.map(() => 0),
      targetIds: paths.map(() => null),
      upgrades: { a: 0, b: 0 },
      totalSpent: 0,
      kills: 0,
      damageDealt: 0,
    },
    runEnemyKinds: {},
    runTowerKinds: {},
    easterEggs: eggs,
    easterEggSchedule,
    speedMul: difficulty.speed,
    goldKillMul: difficulty.goldKill,
    invincible: false,
    lavaFeatures: lava,
    mode,
    forbiddenTowers: new Set(modeConfig.forbiddenTowers ?? []),
    lockedLoadout: modeConfig.lockedLoadout ?? null,
    sellingDisabled: modeConfig.noSelling ?? false,
  };
};

// Centralized check matching mode rules. The HUD greys out forbidden /
// non-loadout kinds, and tryPlaceOrSelect double-checks at runtime so a
// stale UI can't sneak a placement past the rules.
export const isTowerKindAllowed = (world: World, kind: TowerKind): boolean => {
  if (world.forbiddenTowers.has(kind)) return false;
  if (world.lockedLoadout && !world.lockedLoadout.includes(kind)) return false;
  return true;
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
  // Integrate motion + despawn expired eggs. Static gold-reward eggs (skull)
  // get a short post-click grace via despawnAt so the renderer can fade them
  // out rather than vanishing on the same frame the click registers.
  if (world.easterEggs.length > 0) {
    world.easterEggs = world.easterEggs.filter((egg) => {
      if (egg.vel) {
        egg.pos.x += egg.vel.x * dt;
        egg.pos.y += egg.vel.y * dt;
        const def = EASTER_EGG_BY_ID[egg.defId];
        // Tumble-mode eggs (barrel) keep their launch heading and accumulate
        // spin into rollPitch so they roll about their long axis instead of
        // pivoting around their vertical axis like a tumbleweed.
        if (def?.clickRoll?.tumble) {
          egg.rollPitch += egg.spin * dt;
        } else {
          egg.rotY += egg.spin * dt;
        }
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
  // Boss — appears on flagged boss waves only. ~3.5× titan HP, lumbers
  // along, hits hard. Per-kill bonus on top of bounty is paid out by
  // spawnerTick when a boss-flagged enemy dies.
  boss: { kind: "boss", hp: 4200, maxHp: 4200, speed: 0.5, bounty: 200, damage: 10 },
};

// Per-kind shield pool used when a spec marks an enemy as shielded.
// Swarm units are too small to support a visible bubble — they always
// run unshielded regardless of spec flags.
export const SHIELD_BY_KIND: Record<EnemyKind, number> = {
  // Bumped from 10 — the early-wave bubble was popping too fast for the
  // "shield first, body second" lesson to register before the body was
  // also gone in the same volley. 20 takes a second pulse-shot to crack.
  raptor: 20,
  allosaur: 35,
  stego: 80,
  swarm: 0,
  armored: 120,
  para: 25,
  titan: 400,
  boss: 800,
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
  armored: { kinetic: 1.3, electric: 0.5, cold: 1.0, explosive: 0.4, flame: 0.4 },
  // Hollow head crest acts as a resonator: chain damage rings through it
  // (1.7×), while the same crest vents heat — flame slides off (0.5×).
  para: { kinetic: 1.1, electric: 1.7, cold: 1.0, explosive: 0.8, flame: 0.5 },
  titan: { kinetic: 0.5, electric: 0.9, cold: 1.3, explosive: 0.35, flame: 0.35 },
  // Boss — even tougher than titan. Cold is the only real lever
  // (1.5×); kinetic bullets scrape, explosives barely tickle. Forces
  // the player to lean on cryo and chip-cracking T3 upgrades.
  boss: { kinetic: 0.45, electric: 0.85, cold: 1.5, explosive: 0.3, flame: 0.3 },
};

export const ENEMY_SLOW_RESIST: Record<EnemyKind, number> = {
  raptor: 0,
  allosaur: 0,
  stego: 0.35,
  swarm: 0,
  armored: 0.75,
  para: 0,
  titan: 0.5,
  boss: 0.6,
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
  // Boss — the largest available model scaled up further so the
  // silhouette dwarfs everything else on screen. Same Apatosaurus mesh
  // as titan; the elite-tint pass + dedicated label sells it as a
  // distinct adversary.
  boss: { url: "/models/Apatosaurus.glb", targetSize: 18.0, clip: "Walk" },
};

export const ENEMY_LABEL: Record<EnemyKind, string> = {
  raptor: "Raptor",
  allosaur: "T-Rex",
  stego: "Stegosaur",
  swarm: "Swarm",
  armored: "Triceratops",
  para: "Parasaur",
  titan: "Apatosaur",
  boss: "Matriarch",
};

// Biome-themed matriarch variants. Each entry below overrides the base
// `boss` stats / model / resists so the species you're fighting on a
// boss wave reads as "the queen of this biome's pack" instead of a
// generic apatosaurus every time. Picked by the level's wave spec.

// Matriarchs all deal MATRIARCH_DAMAGE on leak (= STARTING_LIVES, so a
// single matriarch leak is an instant game-over). Tied to the lives
// constant so a future startLives bump propagates without per-variant
// edits.
const MATRIARCH_DAMAGE = STARTING_LIVES;

export const BOSS_VARIANT_STATS: Record<BossVariant, EnemyBaseStats> = {
  // Forest debut (L5). Fast and lighter than the apex — but the constant
  // raptor stream behind her shreds gold-strapped early defenses if the
  // player doesn't bring AoE.
  raptor: {
    kind: "boss",
    hp: 2400,
    maxHp: 2400,
    speed: 1.2,
    bounty: 160,
    damage: MATRIARCH_DAMAGE,
  },
  // Snow (L10). Slow tank queen. Spawned stego dribble behind her takes
  // forever to clear so the player has to actually break her armor.
  stego: {
    kind: "boss",
    hp: 3800,
    maxHp: 3800,
    speed: 0.55,
    bounty: 220,
    damage: MATRIARCH_DAMAGE,
  },
  // Desert (L15). Crested runner — fast and tall, vents heat. Para
  // children pile up if the player wasn't ready for chain shielding.
  para: { kind: "boss", hp: 3400, maxHp: 3400, speed: 1.0, bounty: 200, damage: MATRIARCH_DAMAGE },
  // Wasteland (L20). Apex predator. Damage spike makes leaks hurt.
  allosaur: {
    kind: "boss",
    hp: 4400,
    maxHp: 4400,
    speed: 0.7,
    bounty: 240,
    damage: MATRIARCH_DAMAGE,
  },
  // Lava (L25). Heaviest plates. Armored children stack up if cold/elec
  // coverage is thin — and her chain-resist makes a single coil insufficient.
  armored: {
    kind: "boss",
    hp: 5200,
    maxHp: 5200,
    speed: 0.55,
    bounty: 280,
    damage: MATRIARCH_DAMAGE,
  },
  // Alien (L30). The original matriarch — no child stream because the
  // L30 wave already runs heavy entourage+trickle. Mass and resists are
  // the threat, not pack pressure.
  apex: { kind: "boss", hp: 4200, maxHp: 4200, speed: 0.5, bounty: 200, damage: MATRIARCH_DAMAGE },
};

export const BOSS_VARIANT_RESIST: Record<BossVariant, Record<DamageType, number>> = {
  // Pack-leader hide — vulnerable to electric like her swarm, modest
  // kinetic/cold resistance from sheer mass.
  raptor: { kinetic: 0.85, electric: 1.4, cold: 0.75, explosive: 0.55, flame: 0.55 },
  // Same plate logic as base stego, dialed up: kinetic and blast slide off,
  // electric rings through the dorsal fin.
  stego: { kinetic: 0.3, electric: 1.6, cold: 1.0, explosive: 0.45, flame: 0.45 },
  // Hollow resonator crest: chain damage rings through (1.7×), flame vents
  // off (0.4). Otherwise reasonably soft for a matriarch.
  para: { kinetic: 0.9, electric: 1.7, cold: 0.95, explosive: 0.8, flame: 0.4 },
  // Allosaur's flat resists, scaled down — there's no free win, but no
  // hard counter either.
  allosaur: { kinetic: 0.75, electric: 0.8, cold: 0.85, explosive: 0.7, flame: 0.7 },
  // Triceratops queen — chrome-plated. Electric is the only real lever.
  armored: { kinetic: 1.1, electric: 0.4, cold: 0.9, explosive: 0.3, flame: 0.3 },
  // Original matriarch resists — cold is the only real lever.
  apex: { kinetic: 0.45, electric: 0.85, cold: 1.5, explosive: 0.3, flame: 0.3 },
};

export const BOSS_VARIANT_SLOW_RESIST: Record<BossVariant, number> = {
  raptor: 0.4,
  stego: 0.55,
  para: 0.3,
  allosaur: 0.4,
  armored: 0.8,
  apex: 0.6,
};

export const BOSS_VARIANT_MODEL: Record<
  BossVariant,
  { url: string; targetSize: number; clip?: string; timeScale?: number }
> = {
  raptor: { url: "/models/Velociraptor.glb", targetSize: 6.4, timeScale: 0.62 },
  stego: { url: "/models/Stegosaurus.glb", targetSize: 5.0 },
  para: { url: "/models/Parasaurolophus.glb", targetSize: 4.6 },
  allosaur: { url: "/models/Trex.glb", targetSize: 5.5 },
  armored: { url: "/models/Triceratops.glb", targetSize: 5.4 },
  apex: { url: "/models/Apatosaurus.glb", targetSize: 18.0, clip: "Walk" },
};

// Per-variant body tint. Applied permanently to matriarch meshes (not
// gated by the elite chip the way species tints are) so each queen
// reads as her own creature at first glance. Hues are chosen to fit
// the biome AND stay visually distinct from each other — pairs within
// ~30° on the wheel read as muddy under the biome's ambient lighting.
export const BOSS_VARIANT_TINT: Record<BossVariant, string> = {
  raptor: "#a85a38", // forest — warm hide shift without the neon-red wash
  stego: "#8fd8c3", // snow — soft glacial jade, gentler than elite plates
  para: "#a25aff", // desert — twilight violet on the crest
  allosaur: "#ffb030", // wasteland — apex-predator gold
  armored: "#5ad6ff", // lava — chrome-cyan chitin (cool contrast)
  apex: "#d440ff", // alien — bioluminescent magenta
};

// Per-variant material strength for matriarchs. Raptor and stego stay
// restrained so their species silhouettes read first; later queens keep
// a stronger supernatural charge.
export const BOSS_VARIANT_MATERIAL: Record<
  BossVariant,
  { tintAmount: number; emissiveAmount: number }
> = {
  raptor: { tintAmount: 0.42, emissiveAmount: 0.08 },
  stego: { tintAmount: 0.38, emissiveAmount: 0.1 },
  para: { tintAmount: 0.66, emissiveAmount: 0.24 },
  allosaur: { tintAmount: 0.62, emissiveAmount: 0.18 },
  armored: { tintAmount: 0.66, emissiveAmount: 0.24 },
  apex: { tintAmount: 0.68, emissiveAmount: 0.28 },
};

// Child-spawn config — every variant except apex drops a steady drip of
// brood while she walks. Most queens spawn their namesake species; the
// raptor matriarch now sheds paired swarm hatchlings so the pack reads
// like a whole entourage boiling out around her instead of one big
// raptor blinking in behind her. Apex has no child stream because the
// L30 wave already runs its own heavy entourage.
export type BossChildSpawn = { kind: EnemyKind; interval: number; count?: number };
export const BOSS_VARIANT_CHILD: Partial<Record<BossVariant, BossChildSpawn>> = {
  raptor: { kind: "swarm", interval: 1.25, count: 3 },
  stego: { kind: "stego", interval: 6.0 },
  para: { kind: "para", interval: 2.2 },
  allosaur: { kind: "allosaur", interval: 3.8 },
  armored: { kind: "armored", interval: 7.5 },
};

export const BOSS_VARIANT_LABEL: Record<BossVariant, string> = {
  raptor: "Raptor Matriarch",
  stego: "Stegosaur Matriarch",
  para: "Parasaur Matriarch",
  allosaur: "T-Rex Matriarch",
  armored: "Triceratops Matriarch",
  apex: "Apex Matriarch",
};

// Per-kind elite material tint — a distinct palette per species so the
// elite chip reads as "this kind, but the dangerous variant" rather
// than a uniform red wash. Read by ModelEnemyMesh.
export const ELITE_TINT_BY_KIND: Record<EnemyKind, string> = {
  raptor: "#ff3a30", // bright crimson — predator pack alpha
  swarm: "#ff8a3a", // burnt orange — feral hatchling tint
  para: "#a25aff", // royal purple — runner with shimmering crest
  allosaur: "#ffb030", // gold — apex-of-apex
  stego: "#3affb0", // jade — carved jade plates
  armored: "#5ad6ff", // glacial blue — chrome-plated tank
  titan: "#ffd24a", // burnished gold — legendary colossus
  boss: "#ff2a55", // arterial red — matriarch's blood-glow
};

// Tower-source info carried by tower fire paths into applyDamage. The
// T3 anti-modifier flags below are inert by default — only towers that
// have purchased the matching upgrade populate them. attackerTowerId is
// always populated by the tower fire paths and is what kill-credit
// attribution reads when an enemy dies.
export type HitOptions = {
  shieldDamageMul?: number; // Mortar T3: extra damage to shields specifically
  armorPierce?: boolean; // Pulse T3: clamp resist-chip multipliers to ≥1
  resistStrip?: number; // Chain T3: permanently strip own-type resist toward 1
  regenSuppressOnHit?: number; // Pyre T3: extends regen pause after each hit
  attackerTowerId?: EntityId | null;
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
  if (!enemy.alive || enemy.leak) return;
  let dmg = amount;
  // Running tally of damage actually applied to this enemy on this
  // call. Shield absorption + HP reduction (clamped to remaining HP so
  // overkill doesn't inflate the per-tower stat).
  let dealt = 0;

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
    dealt += absorbed;
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
    if (dmg <= 0) {
      if (hitOpts?.attackerTowerId !== undefined && hitOpts.attackerTowerId !== null) {
        const attacker = world.towerById.get(hitOpts.attackerTowerId);
        if (attacker) attacker.damageDealt += dealt;
      }
      return;
    }
  }

  // Bosses route through the variant resist table so each biome-themed
  // matriarch has her own hard counter / hard resist. Falls back to the
  // base ENEMY_RESIST for everyone else.
  const baseMul =
    enemy.kind === "boss" && enemy.bossVariant !== undefined
      ? BOSS_VARIANT_RESIST[enemy.bossVariant][type]
      : ENEMY_RESIST[enemy.kind][type];
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
  const hpDmg = dmg * mul;
  // Clamp the attributed portion to remaining HP so a 1k-damage shot
  // into a 50-HP enemy reads as 50 dealt, not 1k — overkill shouldn't
  // pad the stat.
  dealt += Math.max(0, Math.min(enemy.hp, hpDmg));
  enemy.hp -= hpDmg;
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
  // Damage attribution mirrors kill attribution — chain ricochets,
  // cryo/flame ticks, and projectile splash all funnel through here
  // with attackerTowerId set by the firing tower. The tower may have
  // been sold between fire and impact, so a missing lookup is silently
  // ignored.
  if (hitOpts?.attackerTowerId !== undefined && hitOpts.attackerTowerId !== null) {
    const attacker = world.towerById.get(hitOpts.attackerTowerId);
    if (attacker) attacker.damageDealt += dealt;
  }
  if (enemy.hp <= 0) {
    enemy.alive = false;
    world.gold += enemy.bounty;
    if (hitOpts?.attackerTowerId !== undefined && hitOpts.attackerTowerId !== null) {
      const attacker = world.towerById.get(hitOpts.attackerTowerId);
      if (attacker) attacker.kills += 1;
    }
    // Hero XP — every kill drips into the active hero. Persistent across
    // runs via the store's tick → progress.heroXp merge. Tower kills
    // count too: the player picks the hero loadout and the run, so the
    // whole result rolls back into that hero's growth.
    world.hero.xp += xpForEnemyKill(enemy.maxHp);
    spawnParticles(world, enemy.pos, deathParticles, deathColor);
    emit(world, { type: "death", pos: enemy.pos });
    // Boss kill — extra payout on top of the normal bounty so the
    // moment reads as a windfall, plus an event for the UI flash.
    // Scales with wave so late-game boss kills stay meaningful when
    // upgrades cost five-figure gold.
    if (enemy.kind === "boss") {
      const bonus = 100 + world.wave * 15;
      world.gold += bonus;
      // Bigger crimson burst on top of the standard death particles —
      // sells the takedown without needing a new VFX subsystem.
      spawnParticles(world, enemy.pos, 32, "#ff2a55", [4, 9], 0.7);
      emit(world, { type: "boss-defeated", wave: world.wave, bonus });
    }
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
  // Boss is wider than the lane allows — pin to centerline so the
  // silhouette doesn't clip past the path edges.
  boss: 0,
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
  // Boss-only — picks the biome-themed matriarch variant. Ignored for
  // non-boss kinds. When kind === "boss" and bossVariant is unset, the
  // apex matriarch is used.
  bossVariant?: BossVariant;
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
    bossVariant,
  } = opts;
  // Bosses route through the variant table for HP/speed/damage/bounty so
  // each biome's matriarch reads as a distinct adversary. Non-boss kinds
  // ignore the variant. Unset variant defaults to apex (the original).
  const effectiveVariant: BossVariant | undefined =
    kind === "boss" ? (bossVariant ?? "apex") : undefined;
  const base =
    effectiveVariant !== undefined ? BOSS_VARIANT_STATS[effectiveVariant] : ENEMY_STATS[kind];
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
  // Matriarch variants drip a steady stream of their namesake species
  // behind them — seed the timer so the first child appears one interval
  // after she enters the field rather than immediately at spawn.
  const childCfg =
    effectiveVariant !== undefined ? BOSS_VARIANT_CHILD[effectiveVariant] : undefined;
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
    bossVariant: effectiveVariant,
    childSpawnAt: childCfg ? world.time + childCfg.interval : undefined,
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
// Max drones (summed across every hive) that can be assigned to a
// single target tower. Distinct from HIVE_MAX_DRONES — that caps one
// hive's roster; this caps stacking on one buffed tower so full drone
// bays push the player toward multiple supported tower roles instead
// of one overclocked pulse/flame anchor.
export const HIVE_MAX_DRONES_PER_TOWER = 3;
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
    kills: 0,
    damageDealt: 0,
    flameActive: false,
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
    ownerTowerId: hitOpts?.attackerTowerId ?? null,
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
  const baseResist =
    enemy.kind === "boss" && enemy.bossVariant !== undefined
      ? BOSS_VARIANT_SLOW_RESIST[enemy.bossVariant]
      : ENEMY_SLOW_RESIST[enemy.kind];
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
