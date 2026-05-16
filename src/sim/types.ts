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
  // Melee skirmish lock — when set, this dino is engaging the hero. It
  // halts forward path movement, plays its attack clip, and ticks
  // damage onto the hero. Cleared in enemies.ts when the hero leaves
  // range, dies, or the dino dies. One dino per hero — hero.ts picks
  // the closest in-range candidate each tick.
  engagedHeroId: EntityId | null;
  // Damage-type adaptation layered via the `resists` chip on EnemySpec.
  // Per-spawn multiplier on top of the base ENEMY_RESIST table — value 0
  // = full immunity to that damage type, 0.4 = 60% reduction, 1.5 = +50%
  // damage taken (vulnerability). Empty = no adaptation. Distinct from
  // the `elite` chip (which flattens base resists toward 1.0); resists
  // is per-damage-type and per-spawn.
  extraResists: Partial<Record<DamageType, number>>;
  // Flame meta-skill "ignite" — Pyre Combustion T3/T4 leaves enemies
  // burning after they walk out of range. While world.time < igniteUntil
  // they take igniteDps damage every IGNITE_TICK_INTERVAL seconds,
  // credited to the tower that lit them. Set to 0/null when not burning.
  igniteUntil: number;
  igniteDps: number;
  igniteTickAt: number;
  igniteAttackerTowerId: EntityId | null;
  // Cryo meta-skill "freeze" — Subzero T3/T4 rolls a freeze chance per
  // tick. While world.time < freezeUntil, slowFactor pins to ~0 so the
  // enemy is stopped cold. Freeze stacks on top of regular cryo slow.
  freezeUntil: number;
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
  // True while the hero is inside this enemy's engage radius. Doesn't
  // change path progression — the enemy keeps marching forward — but the
  // render layer reads it to swivel the model toward the hero so the
  // skirmish reads visually. Cleared each tick before the engage check.
  engagedWithHero?: boolean;
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
  // Meta-skill (skill tree) effects. All inert by default; populated by
  // applyMetaSkillsToTower at placement time. Layered on top of base
  // stats so the in-game upgrade tree continues to scale on top.
  critChance: number; // Pulse Ballistics — 0..1 chance per shot
  critMul: number; // Damage multiplier applied on a crit roll. Default 1.
  freezeChance: number; // Cryo Subzero — 0..1 chance per freeze tick to lock
  freezeDuration: number; // Seconds the lock holds. slowFactor pinned to 0.
  chainSlowFactor: number; // Chain Conductor — slow applied to bounced enemies. Default 1 = no slow.
  chainSlowDuration: number;
  clusterDamageBonus: number; // Mortar Targeting — extra dmg when ≥3 enemies in splash
  flameIgniteDuration: number; // Pyre Combustion — seconds enemies keep burning after leaving range
  flameIgniteDps: number;
  serviceDamageBonus: number; // Hive A — flat damage bonus given to each assigned tower
  serviceDamageBonusFrom: number; // Non-hive aggregate: sum of bonuses currently incoming
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
  // Flame heat builds while firing and drains while idle. When it caps
  // at 1.0 the tower flips into `flameOverheated` and stops firing until
  // heat fully drains. Forces the player to pair flame towers with
  // splash so a single nozzle can't sit on a swarm wave indefinitely.
  flameHeat: number;
  flameOverheated: boolean;
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

// Slot index used by the HUD + key bindings (Q/W/E/R). Semantic ability
// per slot is per-variant (see heroVariants.HERO_SPECS):
//   slot 0 (Q) = dash, slot 1 (W) = radial burst,
//   slot 2 (E) = self-buff (variant-flavoured), slot 3 (R) = ultimate.
export type HeroAbilitySlot = 0 | 1 | 2 | 3;

// Multi-shot payload (Stan's saturation, George's barrage) — one row
// per missile, each fires at world.time >= when. Carries its own damage
// to outlive a re-spec or hero variant switch mid-tick.
export type HeroPendingShot = {
  when: number;
  range: number;
  damage: number;
  splashRadius: number;
  damageType: DamageType;
};

// Ongoing slot-3 effect that ticks per frame. Mark (Leela) buffs the
// hero's own outgoing damage for the duration; incinerate (Mike) burns
// a single locked enemy until the timer ends or the target dies.
export type HeroPayloadState =
  | { kind: "mark"; endAt: number; dmgMul: number }
  | {
      kind: "incinerate";
      targetId: EntityId;
      endAt: number;
      nextTickAt: number;
      tickDamage: number;
      damageType: DamageType;
    };

// Slot-2 active self-buff — variant-flavoured stat multiplier window.
// Distinct from `payload` so a hero can stack the buff with their R
// ultimate without one clobbering the other.
export type HeroSelfBuff = {
  endAt: number;
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  // 0..1 fraction of incoming damage absorbed. 0.5 = take half damage.
  damageResist: number;
};

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
  // Movement speed (world units / sec). Baseline pulled from
  // HERO_SPECS[variant].speed and scaled by the mobility skill tree.
  speed: number;
  // Per-shot splash radius. 0 means single-target projectile, >0 turns
  // each auto-attack into a splash hit so Mike's flames + Stan's shells
  // chunk grouped enemies without an extra ability button.
  attackSplashRadius: number;
  damageType: DamageType;
  // Cooldown clock on the auto-attack (renamed from `cooldown`).
  attackCooldown: number;
  // Cooldown ready-times for each ability slot — Q/W/E/R = dash, burst,
  // buff, ultimate. All gated by hero.abilityCooldownMul from the skill tree.
  abilityReadyAt: [number, number, number, number];
  // Per-slot active-until window. Slot 0 doubles as dash i-frames; the
  // other slots don't currently consult this, but it's kept symmetric
  // so future variants can layer in slot-1 buffs without another field.
  abilityActiveUntil: [number, number, number, number];
  // Multiplier applied to every ability cooldown at trigger time. 1.0 =
  // raw spec, 0.65 = T3 Power Core fully ranked.
  abilityCooldownMul: number;
  // Per-tick outgoing damage multiplier — driven by the mark payload
  // and the slot-2 self-buff. Refreshed each frame in tickPayload/tickBuff.
  damageMul: number;
  // Per-tick fire-rate multiplier — driven by the slot-2 self-buff. 1
  // when no buff is active.
  fireRateMul: number;
  // Per-tick movement-speed multiplier — driven by the slot-2 self-buff.
  speedMul: number;
  // 0..1 fraction of incoming damage absorbed (1 = invuln). Driven by
  // the slot-2 self-buff; 0 when no buff is active.
  damageResist: number;
  // Slot-3 ongoing effect — mark buff or incinerate burn. Null when no
  // ultimate is currently in flight.
  payload: HeroPayloadState | null;
  // Slot-2 self-buff window. Active while world.time < selfBuff.endAt.
  selfBuff: HeroSelfBuff | null;
  pendingShots: HeroPendingShot[];
  targetId: EntityId | null;
  moveTarget: Vec2 | null;
  // Player-controlled lateral offset along the path — how far off the
  // centerline the hero stands. Clamped to ±PATH_LANE_HALF. Derived
  // from the move-order click position relative to the snapped path
  // point so clicking near the edge of the lane parks the hero there.
  lateralOffset: number;
  // Path index the hero is currently bound to. Multi-path levels pick
  // the nearest lane on each move order.
  pathIndex: number;
  alive: boolean;
  flashUntil: number;
  shootFlashUntil: number;
  respawnAt: number | null;
  // world.time when this hero last took damage. Drives the
  // out-of-combat HP regen (regen starts 4s after this stamp).
  lastDamagedAt: number;
  // Click-to-select state — when true, the next ground click issues a
  // move order. Right-click bypasses selection (move directly).
  selected: boolean;
  // Run-scoped XP + level. XP accrues from kills; the level is derived
  // by levelForXp(xp). Skill points spent in the tree consume earned
  // points so respec is just rewriting ranks.
  xp: number;
  level: number;
  // Seconds the hero has been failing to make progress toward moveTarget.
  // Resets to 0 whenever forward progress is observed; once it crosses a
  // small threshold the order is dropped so an unreachable target
  // (inside a tree, on the far side of a fully-blocked gap) doesn't pin
  // the hero into a useless oscillation against the obstacle.
  stuckTimer: number;
  // True while the hero is over a liquid surface (lava river/lake,
  // forest water, alien goo). Render lifts the mesh and spawns jet VFX;
  // sim skips lava DOT. Recomputed each tick from world.lavaFeatures.
  hovering: boolean;
  // Smoothed visual hover height in world units. 0 on dry ground,
  // ~0.5 over liquid. Damped on the sim side so render can read it
  // without its own smoothing state.
  hoverHeight: number;
  // High-level animation state — render picks the clip based on this.
  motionState: "idle" | "walk" | "dash" | "shoot" | "dead";
  // world.time when this hero last died (alive transitioned true→false).
  // Drives the death explosion shockwave/flash render window. -1000
  // means never died this run.
  lastDeathAt: number;
  // Next world.time Mike's dash will drop a coal ember. Throttles the
  // burning-trail spawn rate so a single dash leaves ~9 tiles instead
  // of one per tick (60). Mike-only; ignored by other variants.
  mikeCoalDropAt: number;
  // Mike-only pre-dash aim. When set, the dash key has been pressed
  // once; the UI renders an arrow that follows the cursor. A second
  // dash press OR a ground click commits the dash in `dir`. Escape
  // clears it. Auto-clears after world.time >= expiresAt.
  dashAim: { dir: Vec2; expiresAt: number } | null;
};

// Lingering damage tile dropped behind Mike during his dash. Each tile
// ticks AoE flame damage to nearby enemies until expiresAt. Composited
// per-tile so the render layer can fade individual embers as they age.
export type CoalEmber = {
  id: EntityId;
  pos: Vec2;
  expiresAt: number;
  maxLife: number;
  // Next world.time the tile applies damage. Damage is per-tick so a
  // single ember tagged by a parade of raptors doesn't drain instantly.
  nextTickAt: number;
  tickDamage: number;
  radius: number;
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
  // Mortar Targeting meta — extra damage applied at splash impact when
  // ≥CLUSTER_THRESHOLD enemies sit inside the splash radius. 0 = no bonus.
  clusterDamageBonus: number;
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
  | { type: "easter-egg-click"; defId: string }
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
  // Per-path index of the first smoothed point that sits at or inside
  // the playfield border. Enemies traverse the full `paths[i]` (which
  // includes an off-map lead-in so they walk on-screen instead of
  // popping in); the painted ribbon and "start ring" decoration render
  // from this index onward so the visible lane still begins at the
  // border.
  pathRibbonStart: number[];
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
  coalEmbers: CoalEmber[];
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
  // Path index of the HQ that took the killing blow. Used by HQTurret
  // so only that endpoint plays the death explosion + fracture; other
  // HQs on multi-path levels stay intact.
  killingPathIndex: number | null;
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
  // Per-run challenge-mode tags. Heroic + iron set these from their
  // ModeConfig; normal runs all default to permissive. The sim and HUD
  // read these directly without re-resolving the mode config each tick.
  mode: import("../progress").LevelMode;
  forbiddenTowers: ReadonlySet<TowerKind>;
  lockedLoadout: readonly TowerKind[] | null;
  sellingDisabled: boolean;
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
