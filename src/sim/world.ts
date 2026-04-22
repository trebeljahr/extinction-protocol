import type {
  Vec2,
  World,
  Enemy,
  EnemyKind,
  Tower,
  TowerKind,
  Tree,
  Rock,
  Projectile,
  ProjectileKind,
  Beam,
  Explosion,
  CryoWave,
  GameEvent,
  DamageType,
} from "./types";
import type { LevelConfig } from "../levels";
import { samplePath } from "./path";
import { MAP_WIDTH, MAP_HEIGHT, PATH_WIDTH } from "../level";
import { BIOME_LAYERS, type Biome } from "../biomes";

export const STARTING_LIVES = 20;

export const TREE_COUNT = 28;
export const TREE_VARIANTS = 4;
export const TREE_CLEARANCE_MARGIN = 2.0;
export const TREE_MIN_SCALE = 0.55;
export const TREE_MAX_SCALE = 0.95;
export const TREE_MIN_SPACING = 2.2;
export const TREE_FOOTPRINT = 0.85;
export const TREE_REMOVE_COST = 10;

// Rock footprint radius (before per-instance scale multiplier).
export const ROCK_FOOTPRINT = 0.65;
export const ROCK_MIN_SPACING = 1.5;

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const distPointToSegSq = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
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

const buildTrees = (paths: Vec2[][], seed: number, firstId: number): { trees: Tree[]; nextId: number } => {
  const rng = mulberry32(seed);
  const trees: Tree[] = [];
  const clearance = PATH_WIDTH / 2 + TREE_CLEARANCE_MARGIN;
  const pathR2 = clearance * clearance;
  const spacingSq = TREE_MIN_SPACING * TREE_MIN_SPACING;
  let nextId = firstId;
  let tries = 0;
  while (trees.length < TREE_COUNT && tries < TREE_COUNT * 40) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.95;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.95;
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
      if (dx * dx + dy * dy < spacingSq) { blocked = true; break; }
    }
    if (blocked) continue;
    trees.push({
      id: nextId++,
      pos: { x, y },
      variant: Math.floor(rng() * TREE_VARIANTS),
      scale: TREE_MIN_SCALE + rng() * (TREE_MAX_SCALE - TREE_MIN_SCALE),
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
      const scale = spec.minScale + rng() * (spec.maxScale - spec.minScale);
      const rot = rng() * Math.PI * 2;

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
        if (dx * dx + dy * dy < treeSpacingSq) { blocked = true; break; }
      }
      if (blocked) continue;
      for (const r of rocks) {
        const dx = r.pos.x - x;
        const dy = r.pos.y - y;
        if (dx * dx + dy * dy < rockSpacingSq) { blocked = true; break; }
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

export const createWorld = (level: LevelConfig): World => {
  const biome = level.biome ?? "forest";
  const { trees, nextId: afterTrees } = buildTrees(level.paths, level.id * 7919 + 101, 1);
  const { rocks, nextId } = buildRocks(biome, level.paths, trees, afterTrees);
  return {
    time: 0,
    tickCount: 0,
    levelId: level.id,
    biome,
    paths: level.paths,
    plannedWaves: level.hpScale
      ? level.waves.map(w => ({ ...w, hpMul: (w.hpMul ?? 1) * level.hpScale! }))
      : level.waves,
    enemies: [],
    towers: [],
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
    gold: level.startGold,
    lives: STARTING_LIVES,
    startLives: STARTING_LIVES,
    status: "running",
    nextEntityId: nextId,
    events: [],
    shake: { magnitude: 0, decay: 0 },
    selectedTowerId: null,
  };
};

type EnemyBaseStats = Pick<Enemy, "kind" | "hp" | "maxHp" | "speed" | "bounty" | "damage">;

export const ENEMY_STATS: Record<EnemyKind, EnemyBaseStats> = {
  raptor:   { kind: "raptor",   hp: 20,  maxHp: 20,  speed: 2.2,  bounty:  3, damage: 1 },
  allosaur: { kind: "allosaur", hp: 60,  maxHp: 60,  speed: 1.4,  bounty:  7, damage: 2 },
  stego:    { kind: "stego",    hp: 180, maxHp: 180, speed: 0.9,  bounty: 16, damage: 3 },
  swarm:    { kind: "swarm",    hp: 10,  maxHp: 10,  speed: 3.0,  bounty:  1, damage: 1 },
  armored:  { kind: "armored",  hp: 300, maxHp: 300, speed: 1.1,  bounty: 22, damage: 1 },
  para:     { kind: "para",     hp: 45,  maxHp: 45,  speed: 1.8,  bounty:  5, damage: 2 },
  titan:    { kind: "titan",    hp: 600, maxHp: 600, speed: 0.65, bounty: 48, damage: 8 },
};

export const TOWER_DAMAGE_TYPE: Record<TowerKind, DamageType> = {
  pulse:  "kinetic",
  chain:  "electric",
  cryo:   "cold",
  mortar: "explosive",
};

export const DAMAGE_TYPE_LABEL: Record<DamageType, string> = {
  kinetic:   "Kinetic",
  electric:  "Electric",
  cold:      "Cold",
  explosive: "Explosive",
};

export const DAMAGE_TYPE_COLOR: Record<DamageType, string> = {
  kinetic:   "#c9cbd1",
  electric:  "#c48cff",
  cold:      "#aaf0ff",
  explosive: "#ffb266",
};

export const ENEMY_RESIST: Record<EnemyKind, Record<DamageType, number>> = {
  raptor:   { kinetic: 1.0, electric: 1.5, cold: 0.6, explosive: 0.8 },
  allosaur: { kinetic: 1.0, electric: 1.0, cold: 1.0, explosive: 1.0 },
  stego:    { kinetic: 0.4, electric: 1.7, cold: 1.0, explosive: 0.6 },
  swarm:    { kinetic: 0.6, electric: 2.0, cold: 1.3, explosive: 1.7 },
  armored:  { kinetic: 0.9, electric: 0.5, cold: 1.0, explosive: 0.4 },
  para:     { kinetic: 1.1, electric: 1.0, cold: 1.0, explosive: 0.9 },
  titan:    { kinetic: 0.5, electric: 0.9, cold: 1.3, explosive: 0.35 },
};

export const ENEMY_SLOW_RESIST: Record<EnemyKind, number> = {
  raptor:   0,
  allosaur: 0,
  stego:    0.35,
  swarm:    0,
  armored:  0.75,
  para:     0,
  titan:    0.5,
};

export const MIN_SLOW_FACTOR = 0.25;

export const ENEMY_MODEL: Record<EnemyKind, { url: string; targetSize: number; clip?: string }> = {
  raptor:   { url: "/models/Velociraptor.glb",    targetSize: 1.6 },
  swarm:    { url: "/models/Velociraptor.glb",    targetSize: 0.8 },
  para:     { url: "/models/Parasaurolophus.glb", targetSize: 1.7 },
  allosaur: { url: "/models/Trex.glb",            targetSize: 2.2 },
  stego:    { url: "/models/Stegosaurus.glb",     targetSize: 1.9 },
  armored:  { url: "/models/Triceratops.glb",     targetSize: 2.0 },
  titan:    { url: "/models/Apatosaurus.glb",     targetSize: 5.5, clip: "Walk" },
};

export const ENEMY_LABEL: Record<EnemyKind, string> = {
  raptor:   "Raptor",
  allosaur: "T-Rex",
  stego:    "Stegosaur",
  swarm:    "Swarm",
  armored:  "Triceratops",
  para:     "Parasaur",
  titan:    "Apatosaur",
};

export const applyDamage = (
  world: World,
  enemy: Enemy,
  amount: number,
  type: DamageType,
  deathColor = "#c44848",
  deathParticles = 8,
) => {
  if (!enemy.alive) return;
  const mul = ENEMY_RESIST[enemy.kind][type];
  enemy.hp -= amount * mul;
  enemy.flashUntil = world.time + 0.08;
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
  raptor:   PATH_WIDTH * 0.35,
  swarm:    PATH_WIDTH * 0.4,
  para:     PATH_WIDTH * 0.3,
  allosaur: PATH_WIDTH * 0.25,
  stego:    PATH_WIDTH * 0.2,
  armored:  PATH_WIDTH * 0.2,
  titan:    PATH_WIDTH * 0.08,
};

export const spawnEnemy = (world: World, kind: EnemyKind, hpMul = 1, pathIndex = 0): Enemy => {
  const base = ENEMY_STATS[kind];
  const path = world.paths[pathIndex] ?? world.paths[0];
  const start = path[0];
  const hp = Math.ceil(base.hp * hpMul);
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
    hp,
    maxHp: hp,
    speed: base.speed,
    bounty: base.bounty,
    damage: base.damage,
    alive: true,
    slowUntil: 0,
    slowFactor: 1,
    flashUntil: 0,
  };
  world.enemies.push(enemy);
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
  pulse:  { range: 6.5, damage: 10, fireRate: 2.0, splashRadius: 0,    chainCount: 0, chainFalloff: 1,   slowFactor: 1,   slowDuration: 0 },
  chain:  { range: 5.5, damage: 9,  fireRate: 1.2, splashRadius: 0,    chainCount: 5, chainFalloff: 0.6, slowFactor: 1,   slowDuration: 0 },
  cryo:   { range: 4.5, damage: 0,  fireRate: 1.5, splashRadius: 0,    chainCount: 0, chainFalloff: 1,   slowFactor: 0.4,  slowDuration: 1.5 },
  mortar: { range: 9.0, damage: 26, fireRate: 0.5, splashRadius: 1.8,  chainCount: 0, chainFalloff: 1,   slowFactor: 1,   slowDuration: 0 },
};

export const TOWER_COST: Record<TowerKind, number> = {
  pulse: 50,
  chain: 90,
  cryo: 75,
  mortar: 120,
};

export const TOWER_LABEL: Record<TowerKind, string> = {
  pulse: "Pulse Rifle",
  chain: "Chain Coil",
  cryo: "Cryo Emitter",
  mortar: "Mortar",
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
    upgrades: { a: 0, b: 0 },
    totalSpent: TOWER_COST[kind],
    splashRadius: stats.splashRadius,
    chainCount: stats.chainCount,
    chainFalloff: stats.chainFalloff,
    slowFactor: stats.slowFactor,
    slowDuration: stats.slowDuration,
  };
  world.towers.push(tower);
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
  };
  world.projectiles.push(p);
  return p;
};

export const createBeam = (
  world: World,
  points: Vec2[],
  color: string,
  lifeSec = 0.12,
): Beam => {
  const b: Beam = {
    id: world.nextEntityId++,
    points: points.map(p => ({ x: p.x, y: p.y })),
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
) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
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
  const resist = ENEMY_SLOW_RESIST[enemy.kind];
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
