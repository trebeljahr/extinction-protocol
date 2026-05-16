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
  | "boss";

// Biome-themed matriarch variants. Each variant inherits the `boss` kind
// (same death-bonus payout shape, same boss-wave hooks) but overrides
// stats, model, resists, and gets a child-spawn config that drips their
// namesake species behind them as they walk down the path. `apex` is the
// original apatosaurus matriarch — the final-wave threat.
export type BossVariant = "raptor" | "stego" | "para" | "allosaur" | "armored" | "apex";

// New-sighting popup queue item. The NewEnemyAlert pops one of these
// per first encounter — species and matriarch variants each fire their
// own popup so the player meets every queen as a distinct creature.
export type NewSightingId =
  | { tag: "species"; species: EnemyKind }
  | { tag: "matriarch"; variant: BossVariant };

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
  // Damage-type adaptation layered via the `resists` chip on EnemySpec.
  // Per-spawn multiplier on top of the base ENEMY_RESIST table — value 0
  // = full immunity to that damage type, 0.4 = 60% reduction, 1.5 = +50%
  // damage taken (vulnerability). Empty = no adaptation. Distinct from
  // the `elite` chip (which flattens base resists toward 1.0); resists
  // is per-damage-type and per-spawn.
  extraResists: Partial<Record<DamageType, number>>;
  // Only meaningful when kind === "boss". Picks the biome-themed matriarch
  // variant (raptor / stego / para / allosaur / armored / apex). Controls
  // stats, resists, model, and the species spawned by the child-spawn
  // tick below. Undefined falls back to the apex matriarch.
  bossVariant?: BossVariant;
  // Matriarch child-spawn timer — set on spawn from BOSS_VARIANT_CHILD.
  // While > 0 and the matriarch is alive, ticks down every frame; on
  // reaching 0 spawns one child enemy at her current path position and
  // resets to the variant's interval. Undefined = matriarch doesn't
  // spawn children.
  childSpawnAt?: number;
  // Short terminal state once an enemy has reached the HQ. The enemy is
  // still rendered but no longer targetable; `impactAt` is the single
  // life-loss/removal deadline so leaks cannot stall wave progression.
  leak?: {
    startedAt: number;
    impactAt: number;
    startPos: Vec2;
    attackPos: Vec2;
  };
};

export type TowerKind = "pulse" | "chain" | "cryo" | "mortar" | "flame" | "hive";

export type DamageType = "kinetic" | "electric" | "cold" | "explosive" | "flame";

export type TowerUpgrades = { a: number; b: number };

export type TargetingMode =
  | "tower"
  | "start"
  | "end"
  | "strongest"
  | "weakest"
  | "vulnerable"
  | "spot";

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
  // T3 anti-modifier abilities. Default to inert; specific tier-3
  // upgrades flip these on so the tower starts cracking the
  // damage-type adaptations layered onto enemies via the `resists` chip.
  shieldDamageMul: number; // Mortar T3: 2× damage to shields specifically
  armorPierce: boolean; // Pulse T3: clamp resist-chip multipliers to ≥1
  resistStrip: number; // Chain T3: strips own-type resist toward 1 per hit
  regenSuppressOnHit: number; // Pyre T3: extends regenPausedUntil after hit
  freezeBlocksRegen: boolean; // Cryo T3: regen paused while slowed
  // Number of enemies this tower has personally killed this run.
  // Credited in applyDamage to whichever tower delivered the killing
  // blow — chain ricochets and cryo/flame ticks attribute to the
  // firing tower, not the enemy chain link they died on.
  kills: number;
  // Total damage this tower has dealt this run, attributed in
  // applyDamage. Counts shield absorption and HP reduction (clamped to
  // the enemy's remaining HP so overkill doesn't inflate the stat).
  damageDealt: number;
  flameActive: boolean;
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

export type HeroVariant = "george" | "leela" | "mike" | "stan";

export type HeroAbility = "dash" | "shockwave" | "barrage";

export type Hero = {
  id: EntityId;
  variant: HeroVariant;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  fireRate: number;
  cooldown: number;
  targetId: EntityId | null;
  moveTarget: Vec2 | null;
  alive: boolean;
  dashReadyAt: number;
  shockwaveReadyAt: number;
  barrageReadyAt: number;
  dashUntil: number;
  // Pending barrage shots: each entry fires at world.time >= when, picking
  // the best in-range enemy at that moment. Cleared when emptied.
  barrageQueue: { when: number }[];
  flashUntil: number;
  shootFlashUntil: number;
  respawnAt: number | null;
  // Seconds the hero has been failing to make progress toward moveTarget.
  // Resets to 0 whenever forward progress is observed; once it crosses a
  // small threshold the order is dropped so an unreachable target
  // (inside a tree, on the far side of a fully-blocked gap) doesn't pin
  // the hero into a useless oscillation against the obstacle.
  stuckTimer: number;
  // High-level animation state — render picks the clip based on this.
  motionState: "idle" | "walk" | "dash" | "shoot" | "dead";
};

// HQ base weapon — a last-ditch defensive laser that fires from every
// path-endpoint HQ. Upgrades persist for the run; there's only one set
// of upgrades regardless of how many HQ turrets the level has (multi-
// path levels just get more laser sources sharing the same stats).
export type Base = {
  damage: number;
  fireRate: number;
  range: number;
  // One cooldown + target slot per path-endpoint HQ so each gun fires
  // independently. Sized to world.paths.length at world creation.
  cooldowns: number[];
  targetIds: (EntityId | null)[];
  upgrades: { a: 0 | 1 | 2 | 3; b: 0 | 1 | 2 | 3 };
  totalSpent: number;
  kills: number;
  damageDealt: number;
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
  // Tower-derived T3 anti-modifier flags carried by the projectile so
  // impact knows which adaptation-busters to apply. Defaults are inert.
  shieldDamageMul: number;
  armorPierce: boolean;
  resistStrip: number;
  regenSuppressOnHit: number;
  // Id of the tower that fired this projectile. Forwarded into
  // applyDamage so kill credit lands on the firing tower even if it
  // was sold or upgraded between fire and impact.
  ownerTowerId: EntityId | null;
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
  // Per-damage-type adaptation. e.g. { flame: 0 } = full flame immunity
  // for that spawn, { electric: 0.4 } = 60% electric resist on top of
  // base. Layered on the chip system as a sixth orthogonal modifier.
  resists?: Partial<Record<DamageType, number>>;
  bossVariant?: BossVariant;
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
  // Per-damage-type resist multiplier (e.g. { flame: 0 } = immune,
  // { electric: 0.4 } = 60% reduction). Stacks on top of base resists
  // and the elite-flatten effect, before T3 anti-modifier upgrades fire.
  resists?: Partial<Record<DamageType, number>>;
  // Only honored when kind === "boss". Picks the biome-themed matriarch.
  bossVariant?: BossVariant;
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
  // Marks a boss wave: triggers the on-screen banner, audio sting, and a
  // big gold bonus when the boss enemy in this wave dies. Independent of
  // archetype so any composition can be flagged a boss event — typically
  // used for an escort + boss layout via `convoy` or `vanguard`.
  bossWave?: boolean;
  // Steady drip of small enemies during a boss wave so the player has
  // gold-generating targets while the boss lumbers across the field.
  // Streams keep firing until every boss in this wave is dead/escaped.
  bossTrickle?: BossTrickleStream[];
};

export type BossTrickleStream = {
  kinds: EnemyKind[]; // sampled uniformly each tick
  pathIndex: number;
  minInterval: number;
  maxInterval: number;
  startDelay?: number;
  shielded?: boolean;
  fierce?: boolean;
  elite?: boolean;
};

export type ActiveBossTrickle = {
  kinds: EnemyKind[];
  pathIndex: number;
  minInterval: number;
  maxInterval: number;
  nextAt: number;
  hpMul: number;
  shielded?: boolean;
  fierce?: boolean;
  elite?: boolean;
};

export type RunStatus = "running" | "paused" | "won" | "lost";

export type GameEvent =
  | { type: "shoot"; towerId: number; towerKind: TowerKind; pos: Vec2 }
  | { type: "impact"; pos: Vec2 }
  | { type: "death"; pos: Vec2 }
  | { type: "wave-start"; wave: number }
  | { type: "wave-clear"; wave: number }
  | { type: "boss-wave-start"; wave: number }
  | { type: "boss-defeated"; wave: number; bonus: number }
  | { type: "life-lost"; pathIndex: number }
  | { type: "game-over"; won: boolean }
  | { type: "upgrade" }
  | { type: "tower-placed"; towerKind: TowerKind }
  | { type: "tower-sold" }
  | { type: "place-failed"; reason: "gold" | "spot" }
  | { type: "new-enemy" }
  | { type: "wave-called-early" }
  | { type: "easter-egg-click" }
  | { type: "flame-start"; towerId: number; pos: Vec2 }
  | { type: "flame-stop"; towerId: number };

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
  bossTrickleStreams: ActiveBossTrickle[];
  // Scales interval between trickle spawns during a boss wave. <1 = more
  // frequent (harder), >1 = sparser (easier). Sourced from difficulty.
  bossTrickleIntervalMul: number;
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
  selectedBase: boolean;
  base: Base;
  runEnemyKinds: Partial<Record<EnemyKind, boolean>>;
  runTowerKinds: Partial<Record<TowerKind, boolean>>;
  easterEggs: EasterEgg[];
  easterEggSchedule: EasterEggScheduleEntry[];
  // Per-run multipliers driven by the global difficulty setting. HP and
  // startGold are baked in at world-creation time; speed and goldKill are
  // applied per spawn / per kill so they live on World.
  speedMul: number;
  goldKillMul: number;
  // Debug-only — when true, leaks at the exit don't deduct lives.
  // Toggled by the debug menu; always false in production builds (the
  // toggle UI is gated by isDebug + dead-codes out).
  invincible: boolean;
  lavaFeatures: import("../lavaGeometry").LavaFeatures | null;
  hero: Hero;
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
  // Axial roll angle (radians). The renderer tips tumble-mode eggs onto
  // their side and spins them about the cylinder's long axis. Driven by
  // spin when the egg is in clickRoll tumble mode (currently only the
  // barrel). 0 for everything else.
  rollPitch: number;
};

export type EasterEggScheduleEntry = {
  defId: string;
  triggerTime: number; // world.time when this egg spawns
};
