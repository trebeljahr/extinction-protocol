import type {
  Vec2,
  World,
  Enemy,
  EnemyKind,
  Tower,
  TowerKind,
  Projectile,
  ProjectileKind,
  Beam,
  Explosion,
  GameEvent,
  DamageType,
} from "./types";
import type { LevelConfig } from "../levels";
import { samplePath } from "./path";

export const STARTING_LIVES = 20;

export const createWorld = (level: LevelConfig): World => ({
  time: 0,
  tickCount: 0,
  levelId: level.id,
  path: level.path,
  plannedWaves: level.hpScale
    ? level.waves.map(w => ({ ...w, hpMul: (w.hpMul ?? 1) * level.hpScale! }))
    : level.waves,
  enemies: [],
  towers: [],
  projectiles: [],
  beams: [],
  explosions: [],
  particles: [],
  spawnQueue: [],
  wave: 0,
  totalWaves: level.waves.length,
  waveActive: false,
  nextWaveIn: 2,
  waveTotalEnemies: 0,
  gold: level.startGold,
  lives: STARTING_LIVES,
  startLives: STARTING_LIVES,
  status: "running",
  nextEntityId: 1,
  events: [],
  shake: { magnitude: 0, decay: 0 },
  selectedTowerId: null,
});

type EnemyBaseStats = Pick<Enemy, "kind" | "hp" | "maxHp" | "speed" | "bounty" | "damage">;

const ENEMY_STATS: Record<EnemyKind, EnemyBaseStats> = {
  raptor:   { kind: "raptor",   hp: 20,  maxHp: 20,  speed: 2.2,  bounty:  3, damage: 1 },
  allosaur: { kind: "allosaur", hp: 60,  maxHp: 60,  speed: 1.4,  bounty:  7, damage: 2 },
  stego:    { kind: "stego",    hp: 140, maxHp: 140, speed: 0.9,  bounty: 14, damage: 3 },
  swarm:    { kind: "swarm",    hp: 10,  maxHp: 10,  speed: 3.0,  bounty:  1, damage: 1 },
  armored:  { kind: "armored",  hp: 220, maxHp: 220, speed: 1.1,  bounty: 18, damage: 4 },
  para:     { kind: "para",     hp: 45,  maxHp: 45,  speed: 1.8,  bounty:  5, damage: 2 },
  titan:    { kind: "titan",    hp: 420, maxHp: 420, speed: 0.65, bounty: 36, damage: 8 },
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
  stego:    { kinetic: 0.4, electric: 0.7, cold: 1.0, explosive: 1.6 },
  swarm:    { kinetic: 0.6, electric: 1.4, cold: 0.8, explosive: 1.7 },
  armored:  { kinetic: 0.9, electric: 0.5, cold: 1.0, explosive: 0.4 },
  para:     { kinetic: 1.1, electric: 1.0, cold: 1.0, explosive: 0.9 },
  titan:    { kinetic: 0.5, electric: 0.9, cold: 1.3, explosive: 0.35 },
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

export const spawnEnemy = (world: World, kind: EnemyKind, hpMul = 1): Enemy => {
  const base = ENEMY_STATS[kind];
  const start = world.path[0];
  const hp = Math.ceil(base.hp * hpMul);
  const enemy: Enemy = {
    id: world.nextEntityId++,
    kind: base.kind,
    pos: { x: start.x, y: start.y },
    segment: 0,
    segmentT: 0,
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
  chain:  { range: 5.5, damage: 7,  fireRate: 1.2, splashRadius: 0,    chainCount: 3, chainFalloff: 0.6, slowFactor: 1,   slowDuration: 0 },
  cryo:   { range: 4.5, damage: 2,  fireRate: 1.5, splashRadius: 0,    chainCount: 0, chainFalloff: 1,   slowFactor: 0.45, slowDuration: 1.2 },
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
  samplePath(world.path, enemy.segment, enemy.segmentT);

export const applySlow = (enemy: Enemy, world: World, factor: number, duration: number) => {
  const until = world.time + duration;
  if (until > enemy.slowUntil) {
    enemy.slowUntil = until;
    enemy.slowFactor = Math.min(enemy.slowFactor, factor);
  } else if (factor < enemy.slowFactor) {
    enemy.slowFactor = factor;
  }
};
