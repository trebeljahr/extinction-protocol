export type EntityId = number;

export type Vec2 = { x: number; y: number };

export type EnemyKind = "raptor" | "allosaur" | "stego" | "swarm" | "armored" | "para" | "titan";

export type Enemy = {
  id: EntityId;
  kind: EnemyKind;
  pos: Vec2;
  pathIndex: number;
  segment: number;
  segmentT: number;
  hp: number;
  maxHp: number;
  speed: number;
  bounty: number;
  damage: number;
  alive: boolean;
  slowUntil: number;
  slowFactor: number;
  flashUntil: number;
};

export type TowerKind = "pulse" | "chain" | "cryo" | "mortar";

export type DamageType = "kinetic" | "electric" | "cold" | "explosive";

export type TowerUpgrades = { a: number; b: number };

export type TargetingMode = "tower" | "start" | "end";

export type Tower = {
  id: EntityId;
  kind: TowerKind;
  pos: Vec2;
  range: number;
  damage: number;
  fireRate: number;
  cooldown: number;
  targetId: EntityId | null;
  targetingMode: TargetingMode;
  upgrades: TowerUpgrades;
  totalSpent: number;
  splashRadius: number;
  chainCount: number;
  chainFalloff: number;
  slowFactor: number;
  slowDuration: number;
};

export type ProjectileKind = "direct" | "splash";

export type Projectile = {
  id: EntityId;
  kind: ProjectileKind;
  damageType: DamageType;
  pos: Vec2;
  targetId: EntityId | null;
  targetPos: Vec2;
  damage: number;
  speed: number;
  splashRadius: number;
  alive: boolean;
};

export type Beam = {
  id: EntityId;
  points: Vec2[];
  color: string;
  expiresAt: number;
};

export type Explosion = {
  id: EntityId;
  pos: Vec2;
  radius: number;
  expiresAt: number;
  maxLife: number;
};

export type Particle = {
  id: EntityId;
  pos: Vec2;
  vel: Vec2;
  expiresAt: number;
  maxLife: number;
  color: string;
};

export type SpawnRequest = {
  kind: EnemyKind;
  at: number;
  hpMul: number;
  pathIndex: number;
};

export type EnemySpec = {
  kind: EnemyKind;
  count: number;
  pathIndex?: number;
};

export type WaveArchetype = "intro" | "mixed" | "swarm" | "heavy" | "chaos";

export type WaveSpec = {
  spawns: EnemySpec[];
  spacing?: number;
  hpMul?: number;
  archetype?: WaveArchetype;
};

export type RunStatus = "running" | "paused" | "won" | "lost";

export type GameEvent =
  | { type: "shoot"; towerKind: TowerKind; pos: Vec2 }
  | { type: "impact"; pos: Vec2 }
  | { type: "death"; pos: Vec2 }
  | { type: "wave-start"; wave: number }
  | { type: "wave-clear"; wave: number }
  | { type: "life-lost" }
  | { type: "game-over"; won: boolean }
  | { type: "upgrade" };

export type Shake = {
  magnitude: number;
  decay: number;
};

export type World = {
  time: number;
  tickCount: number;
  levelId: number;
  biome: "forest" | "desert" | "snow" | "wasteland";
  paths: Vec2[][];
  plannedWaves: WaveSpec[];
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  beams: Beam[];
  explosions: Explosion[];
  particles: Particle[];
  spawnQueue: SpawnRequest[];
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  nextWaveIn: number;
  waveTotalEnemies: number;
  gold: number;
  lives: number;
  startLives: number;
  status: RunStatus;
  nextEntityId: number;
  events: GameEvent[];
  shake: Shake;
  selectedTowerId: EntityId | null;
};
