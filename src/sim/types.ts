export type EntityId = number;

export type Vec2 = { x: number; y: number };

export type EnemyKind = "raptor" | "allosaur" | "stego";

export type Enemy = {
  id: EntityId;
  kind: EnemyKind;
  pos: Vec2;
  segment: number;
  segmentT: number;
  hp: number;
  maxHp: number;
  speed: number;
  bounty: number;
  damage: number;
  alive: boolean;
};

export type TowerKind = "pulse";

export type Tower = {
  id: EntityId;
  kind: TowerKind;
  pos: Vec2;
  range: number;
  damage: number;
  fireRate: number;
  cooldown: number;
  targetId: EntityId | null;
};

export type Projectile = {
  id: EntityId;
  pos: Vec2;
  targetId: EntityId;
  damage: number;
  speed: number;
  alive: boolean;
};

export type SpawnRequest = {
  kind: EnemyKind;
  at: number;
};

export type RunStatus = "running" | "paused" | "won" | "lost";

export type World = {
  time: number;
  tickCount: number;
  path: Vec2[];
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  spawnQueue: SpawnRequest[];
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  nextWaveIn: number;
  gold: number;
  lives: number;
  status: RunStatus;
  nextEntityId: number;
};
