export type EntityId = number;

export type Vec2 = { x: number; y: number };

export type EnemyKind =
  | "raptor"
  | "allosaur"
  | "stego"
  | "swarm"
  | "armored"
  | "para"
  | "titan"
  | "medic";

export type Enemy = {
  id: EntityId;
  kind: EnemyKind;
  pos: Vec2;
  pathIndex: number;
  segment: number;
  segmentT: number;
  // Perpendicular offset from the path centerline, in world units. Picked
  // once at spawn so the lane reads as a flock rather than a single file.
  lateralOffset: number;
  hp: number;
  maxHp: number;
  speed: number;
  bounty: number;
  damage: number;
  alive: boolean;
  slowUntil: number;
  slowFactor: number;
  flashUntil: number;
  // 0..1 visual frost level, accumulates while the enemy is slowed (only
  // cryo applies slow today) and decays back to 0 once it's free. Drives
  // the white-blue tint on the rendered enemy.
  frost: number;
  // Defensive layer absorbed before HP. 0 when not a shielded variant or
  // currently broken. Regen kicks in 4s after a full break.
  shield: number;
  maxShield: number;
  // world.time when shield last hit 0; 0 if intact or never had one.
  shieldBrokenAt: number;
  // Spawn-time variant flag — bumps HP/damage/bounty, narrows resist
  // spread, and adds slow resistance. Shows as a red-tinted, slightly
  // larger model with an ELITE badge.
  elite: boolean;
};

export type TowerKind = "pulse" | "chain" | "cryo" | "mortar" | "flame" | "hive";

export type DamageType = "kinetic" | "electric" | "cold" | "explosive";

export type TowerUpgrades = { a: number; b: number };

export type TargetingMode = "tower" | "start" | "end" | "strongest" | "spot";

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
  // Fixed aim point for "spot" targeting — only consulted in that mode.
  targetSpot: Vec2 | null;
  upgrades: TowerUpgrades;
  totalSpent: number;
  splashRadius: number;
  chainCount: number;
  chainFalloff: number;
  slowFactor: number;
  slowDuration: number;
  // Hive-only — sim writes one target id per drone each tick so the
  // renderer doesn't have to scan enemies again.
  droneTargetIds: (EntityId | null)[];
  // Hive A2 upgrade — drones bypass shields entirely.
  pierceShield: boolean;
  // Hive B2 upgrade — drones prefer medic targets in range.
  prioritizeMedic: boolean;
  // Hive B3 upgrade — multiplier applied to damage when target is elite.
  // 1 = no bonus, 1.3 = +30%.
  eliteDamageBonus: number;
};

export type Tree = {
  id: EntityId;
  pos: Vec2;
  variant: number;
  scale: number;
  rot: number;
};

export type Rock = {
  id: EntityId;
  pos: Vec2;
  layerIndex: number;
  variant: number;
  scale: number;
  rot: number;
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
  // Set by hive shield-piercer rounds — applyDamage skips shield drain.
  pierceShield: boolean;
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

export type CryoWave = {
  id: EntityId;
  pos: Vec2;
  maxRadius: number;
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
  shielded?: boolean;
  elite?: boolean;
};

export type EnemySpec = {
  kind: EnemyKind;
  count: number;
  pathIndex?: number;
  // Apply the shielded variant — adds a kind-specific shield pool that
  // absorbs damage before HP and regenerates 4s after breaking.
  shielded?: boolean;
  // Apply the elite variant — bumps HP/damage/bounty, narrows resist
  // spread toward 1×, and adds slow resistance. Visual badge + tint.
  elite?: boolean;
};

export type WaveArchetype =
  | "intro"
  | "mixed"
  | "swarm"
  | "heavy"
  | "chaos"
  | "vanguard"
  | "echelon"
  | "trickle"
  | "convoy";

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
  | { type: "upgrade" }
  | { type: "tower-placed"; towerKind: TowerKind }
  | { type: "tower-sold" }
  | { type: "place-failed"; reason: "gold" | "spot" }
  | { type: "new-enemy" }
  | { type: "wave-called-early" };

export type Shake = {
  magnitude: number;
  decay: number;
};

export type World = {
  time: number;
  tickCount: number;
  levelId: number;
  biome: "forest" | "desert" | "snow" | "wasteland" | "lava" | "alien";
  paths: Vec2[][];
  plannedWaves: WaveSpec[];
  enemies: Enemy[];
  // Rebuilt once per tick from `enemies`. Used by sim + render to skip
  // O(n) `find(id)` scans in hot loops. Treat as read-only outside the
  // tick boundary; mutating it invalidates the invariant.
  enemyById: Map<EntityId, Enemy>;
  towers: Tower[];
  towerById: Map<EntityId, Tower>;
  trees: Tree[];
  rocks: Rock[];
  projectiles: Projectile[];
  beams: Beam[];
  explosions: Explosion[];
  cryoWaves: CryoWave[];
  particles: Particle[];
  spawnQueue: SpawnRequest[];
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  nextWaveIn: number;
  waveTotalEnemies: number;
  midwaveTimer: number;
  midwaveTimerMax: number;
  gold: number;
  lives: number;
  startLives: number;
  status: RunStatus;
  nextEntityId: number;
  events: GameEvent[];
  shake: Shake;
  selectedTowerId: EntityId | null;
  runEnemyKinds: Partial<Record<EnemyKind, boolean>>;
  runTowerKinds: Partial<Record<TowerKind, boolean>>;
  easterEggs: EasterEgg[];
  easterEggSchedule: EasterEggScheduleEntry[];
};

export type EasterEgg = {
  id: EntityId;
  defId: string;
  pos: Vec2;
  rotY: number;
  clickCount: number;
  triggered: boolean;
  // Set for moving eggs (tumbleweed, rover). Static eggs leave these null.
  vel: Vec2 | null;
  despawnAt: number | null; // world.time deadline for motion eggs
  spin: number; // radians/sec for visual rotation
};

export type EasterEggScheduleEntry = {
  defId: string;
  triggerTime: number; // world.time when this egg spawns
};
