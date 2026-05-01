export type EntityId = number;

export type Vec2 = { x: number; y: number };

export type EnemyKind = "raptor" | "allosaur" | "stego" | "swarm" | "armored" | "para" | "titan";

// Composable per-enemy buffs — any combination can be layered on any
// kind. See `chipBountyMul` in world.ts for the per-chip bounty scaling.
//
// - shielded: kind-specific energy shield, regens 4s after break.
//             Visual: blue energy bubble.
// - healAura: pulses HP/sec to nearby allies. Healers can't heal each
//             other so a stack of healers isn't immortal.
//             Visual: green pulsing ring on the ground.
// - regen:    passive self-heal, paused briefly after taking damage so
//             sustained DPS still works.
//             Visual: floating mint-green "+" above the model.
// - elite:    flattens damage-resist spread toward 1× and adds slow
//             resistance. Visual: model material tint shifts to a
//             distinct elite color per kind.
// - fierce:   +40% damage. Visual: red glowing halo around the body.
export type EnemyChip = "shielded" | "healAura" | "regen" | "elite" | "fierce";

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
  // Defensive layer absorbed before HP. 0 when not shielded or
  // currently broken. Regen kicks in 4s after a full break.
  shield: number;
  maxShield: number;
  // world.time when shield last hit 0; 0 if intact or never had one.
  shieldBrokenAt: number;
  // Composable chip flags — any combination layers on any kind. See
  // EnemyChip docstring for visual/behavior summary.
  healAura: boolean;
  regen: boolean;
  elite: boolean;
  fierce: boolean;
  // Set whenever a regen-chipped enemy takes damage. Self-heal pauses
  // until world.time crosses this stamp — keeps sustained DPS effective
  // and prevents the "ticked-by-a-feather" stalemate.
  regenPausedUntil: number;
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
  // Hive-only — number of drones owned by this hive (3 base, scales
  // with Path A upgrades). Always equals droneAssignments.length while
  // valid, but kept as a separate field so resizing the array is a
  // single store action.
  droneCount: number;
  // Hive-only — index = drone index. Value = the tower id this drone
  // is currently servicing (provides fire-rate buff), or null when
  // idle. Idle drones orbit the hive itself.
  droneAssignments: (EntityId | null)[];
  // Hive-only — fractional fire-rate buff each assigned drone confers
  // to its target tower. 0.3 = +30%. Scales with Path B upgrades.
  serviceBuff: number;
  // Non-hive — sum of serviceBuff contributions from every drone
  // currently servicing this tower. Recomputed each tick at the start
  // of updateTowers; effective fire rate = fireRate * (1 + this).
  serviceFireRateBonus: number;
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
  healAura?: boolean;
  regen?: boolean;
  elite?: boolean;
  fierce?: boolean;
};

export type EnemySpec = {
  kind: EnemyKind;
  count: number;
  pathIndex?: number;
  // Composable chips — any combination of these can be set per group.
  // See EnemyChip type for behavior + visual summary.
  shielded?: boolean;
  healAura?: boolean;
  regen?: boolean;
  elite?: boolean;
  fierce?: boolean;
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
  // Set for moving eggs (tumbleweed, rover) and for static eggs once the
  // player triggers their clickRoll motion (the barrel). Static eggs leave
  // these null until that happens.
  vel: Vec2 | null;
  despawnAt: number | null; // world.time deadline for motion eggs
  spin: number; // radians/sec for visual rotation
  // End-over-end forward tumble (radians). Applied perpendicular to the
  // heading (rotY) so the egg rolls in its direction of travel rather than
  // pivoting on its base. Driven by spin when the egg is in clickRoll
  // tumble mode (currently only the barrel). 0 for everything else.
  rollPitch: number;
};

export type EasterEggScheduleEntry = {
  defId: string;
  triggerTime: number; // world.time when this egg spawns
};
