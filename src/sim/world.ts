import type { Vec2, World, Enemy, EnemyKind, Tower, Projectile } from "./types";
import { samplePath } from "./path";

export const createWorld = (path: Vec2[], totalWaves = 10): World => ({
  time: 0,
  tickCount: 0,
  path,
  enemies: [],
  towers: [],
  projectiles: [],
  spawnQueue: [],
  wave: 0,
  totalWaves,
  waveActive: false,
  nextWaveIn: 3,
  gold: 200,
  lives: 20,
  status: "running",
  nextEntityId: 1,
});

const ENEMY_STATS: Record<EnemyKind, Omit<Enemy, "id" | "pos" | "segment" | "segmentT" | "alive">> = {
  raptor:   { kind: "raptor",   hp: 20, maxHp: 20, speed: 2.2, bounty:  8, damage: 1 },
  allosaur: { kind: "allosaur", hp: 60, maxHp: 60, speed: 1.4, bounty: 18, damage: 2 },
  stego:    { kind: "stego",    hp: 140, maxHp: 140, speed: 0.9, bounty: 35, damage: 3 },
};

export const spawnEnemy = (world: World, kind: EnemyKind): Enemy => {
  const stats = ENEMY_STATS[kind];
  const start = world.path[0];
  const enemy: Enemy = {
    id: world.nextEntityId++,
    pos: { x: start.x, y: start.y },
    segment: 0,
    segmentT: 0,
    alive: true,
    ...stats,
  };
  world.enemies.push(enemy);
  return enemy;
};

export const createTower = (world: World, pos: Vec2): Tower => {
  const tower: Tower = {
    id: world.nextEntityId++,
    kind: "pulse",
    pos: { x: pos.x, y: pos.y },
    range: 6,
    damage: 8,
    fireRate: 2,
    cooldown: 0,
    targetId: null,
  };
  world.towers.push(tower);
  return tower;
};

export const TOWER_COST: Record<"pulse", number> = { pulse: 50 };
export const TOWER_FOOTPRINT = 1.0;

export const createProjectile = (
  world: World,
  pos: Vec2,
  targetId: number,
  damage: number,
): Projectile => {
  const p: Projectile = {
    id: world.nextEntityId++,
    pos: { x: pos.x, y: pos.y },
    targetId,
    damage,
    speed: 20,
    alive: true,
  };
  world.projectiles.push(p);
  return p;
};

export const enemyPosOnPath = (world: World, enemy: Enemy): Vec2 =>
  samplePath(world.path, enemy.segment, enemy.segmentT);
