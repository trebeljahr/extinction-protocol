import type { DamageType, EnemyKind, WaveArchetype, WaveSpec, World } from "./types";
import { addShake, emit, spawnEnemy } from "./world";

export type { WaveArchetype };

export const WAVE_ARCHETYPE_LABEL: Record<WaveArchetype, string> = {
  intro: "Intro",
  mixed: "Mixed",
  swarm: "Swarm rush",
  heavy: "Armored push",
  chaos: "Chaos",
  vanguard: "Vanguard",
  echelon: "Echelon",
  trickle: "Trickle",
  convoy: "Convoy",
};

export const WAVE_ARCHETYPE_HINT: Record<WaveArchetype, string> = {
  intro: "",
  mixed: "balanced composition",
  swarm: "favors AoE towers",
  heavy: "favors single-target",
  chaos: "bring everything",
  vanguard: "elites lead, swarm trails",
  echelon: "tiered escalation in order",
  trickle: "long sparse spacing",
  convoy: "tank flanked by escorts",
};

const ORDERED_ARCHETYPES = new Set<WaveArchetype>(["swarm", "vanguard", "echelon", "convoy"]);

const inferArchetype = (spec: WaveSpec): WaveArchetype => {
  const counts: Partial<Record<EnemyKind, number>> = {};
  let total = 0;
  for (const s of spec.spawns) {
    counts[s.kind] = (counts[s.kind] ?? 0) + s.count;
    total += s.count;
  }
  const distinct = Object.keys(counts).length;
  const hasArmored = (counts.armored ?? 0) > 0;
  const hasStego = (counts.stego ?? 0) > 0;
  const swarmShare = (counts.swarm ?? 0) / Math.max(1, total);

  if (distinct >= 4 || (hasArmored && hasStego)) return "chaos";
  if (hasArmored) return "heavy";
  if (swarmShare >= 0.6 && total >= 15) return "swarm";
  if (distinct >= 2) return "mixed";
  return "intro";
};

export const getWavePlan = (world: World, wave: number): { archetype: WaveArchetype } | null => {
  if (wave < 1 || wave > world.plannedWaves.length) return null;
  const spec = world.plannedWaves[wave - 1];
  return { archetype: spec.archetype ?? inferArchetype(spec) };
};

type RosterEntry = {
  kind: EnemyKind;
  pathIndex: number;
  shielded: boolean;
  healAura: boolean;
  regen: boolean;
  elite: boolean;
  fierce: boolean;
  resists?: Partial<Record<DamageType, number>>;
};

const rosterFromSpec = (spec: WaveSpec): RosterEntry[] => {
  const out: RosterEntry[] = [];
  for (const s of spec.spawns) {
    const pathIndex = s.pathIndex ?? 0;
    const shielded = s.shielded ?? false;
    const healAura = s.healAura ?? false;
    const regen = s.regen ?? false;
    const elite = s.elite ?? false;
    const fierce = s.fierce ?? false;
    for (let i = 0; i < s.count; i++) {
      out.push({
        kind: s.kind,
        pathIndex,
        shielded,
        healAura,
        regen,
        elite,
        fierce,
        resists: s.resists,
      });
    }
  }
  const archetype = spec.archetype ?? inferArchetype(spec);
  if (ORDERED_ARCHETYPES.has(archetype)) return out;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const WAVE_GAP_SECONDS = 2;
const EARLY_CALL_THRESHOLD = 1 / 2;
const MIDWAVE_PER_ENEMY_SEC = 0.4;
const MIDWAVE_BUFFER_SEC = 1.0;

const remainingEnemies = (world: World) => world.spawnQueue.length + world.enemies.length;

const midwaveThresholdCrossed = (world: World): boolean => {
  if (!world.waveActive) return false;
  if (world.waveTotalEnemies <= 0) return false;
  return remainingEnemies(world) <= world.waveTotalEnemies * EARLY_CALL_THRESHOLD;
};

// Exported for the debug menu's "force wave" action — production gameplay
// only ever enters this through spawnerTick or callWaveEarly, both of
// which respect the regular gating.
export const startWave = (world: World) => {
  world.wave += 1;
  world.waveActive = true;
  world.midwaveTimer = 0;
  world.midwaveTimerMax = 0;
  world.bossTrickleStreams = [];
  const spec = world.plannedWaves[world.wave - 1];
  const roster = rosterFromSpec(spec);
  world.waveTotalEnemies = roster.length;
  const hpMul = spec.hpMul ?? 1;
  const spacing = spec.spacing ?? Math.max(0.35, 0.75 - world.wave * 0.03);
  for (let i = 0; i < roster.length; i++) {
    const t = world.time + i * spacing;
    const entry = roster[i];
    world.spawnQueue.push({
      kind: entry.kind,
      at: t,
      hpMul,
      pathIndex: entry.pathIndex,
      shielded: entry.shielded,
      healAura: entry.healAura,
      regen: entry.regen,
      elite: entry.elite,
      fierce: entry.fierce,
      resists: entry.resists,
    });
  }
  if (spec.bossTrickle) {
    const mul = world.bossTrickleIntervalMul;
    for (const s of spec.bossTrickle) {
      world.bossTrickleStreams.push({
        kinds: s.kinds.slice(),
        pathIndex: s.pathIndex,
        minInterval: s.minInterval * mul,
        maxInterval: s.maxInterval * mul,
        nextAt: world.time + (s.startDelay ?? 0),
        hpMul,
      });
    }
  }
  emit(world, { type: "wave-start", wave: world.wave });
  if (spec.bossWave) {
    emit(world, { type: "boss-wave-start", wave: world.wave });
    // Heavy ground tremor sells the matriarch's arrival before her
    // silhouette is even on screen — sustained decay so the camera
    // judders for ~a second rather than flicking once.
    addShake(world, 0.47, 1.6);
  }
};

const bossesStillActive = (world: World): boolean => {
  for (const e of world.enemies) if (e.kind === "boss") return true;
  for (const q of world.spawnQueue) if (q.kind === "boss") return true;
  return false;
};

const tickBossTrickle = (world: World) => {
  if (world.bossTrickleStreams.length === 0) return;
  const bossesLeft = bossesStillActive(world);
  if (!bossesLeft) {
    world.bossTrickleStreams = [];
    return;
  }
  for (const stream of world.bossTrickleStreams) {
    while (stream.nextAt <= world.time) {
      const kind = stream.kinds[Math.floor(Math.random() * stream.kinds.length)];
      spawnEnemy(world, kind, { hpMul: stream.hpMul, pathIndex: stream.pathIndex });
      const interval =
        stream.minInterval + Math.random() * (stream.maxInterval - stream.minInterval);
      stream.nextAt += Math.max(0.1, interval);
    }
  }
};

const earlyCallBase = (world: World): number => (world.wave === 0 ? 0 : 15 + world.wave);

export const earlyCallBonus = (world: World): number => {
  const base = earlyCallBase(world);
  if (base <= 0) return 0;
  if (!world.waveActive) {
    if (WAVE_GAP_SECONDS <= 0) return 0;
    const frac = Math.max(0, Math.min(1, world.nextWaveIn / WAVE_GAP_SECONDS));
    return Math.ceil(base * frac);
  }
  if (world.midwaveTimerMax <= 0) return 0;
  const frac = Math.max(0, Math.min(1, world.midwaveTimer / world.midwaveTimerMax));
  return Math.ceil(base * frac);
};

export const canCallEarly = (world: World): boolean => {
  if (world.status !== "running") return false;
  if (world.wave >= world.totalWaves) return false;
  if (!world.waveActive) return true;
  return midwaveThresholdCrossed(world) && world.midwaveTimerMax > 0;
};

export const earlyCallGoldReward = (world: World): number =>
  canCallEarly(world) ? earlyCallBonus(world) : 0;

export const earlyCallTimerSec = (world: World): number => {
  if (!world.waveActive) return world.nextWaveIn;
  return world.midwaveTimer;
};

export const callWaveEarly = (world: World): boolean => {
  if (!canCallEarly(world)) return false;
  world.gold += earlyCallBonus(world);
  world.nextWaveIn = 0;
  startWave(world);
  return true;
};

export const spawnerTick = (world: World, dt: number) => {
  if (!world.waveActive) {
    if (world.wave === 0) return;
    world.nextWaveIn = Math.max(0, world.nextWaveIn - dt);
    if (world.nextWaveIn === 0 && world.wave < world.totalWaves) {
      startWave(world);
    }
    return;
  }

  while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.time) {
    const req = world.spawnQueue.shift()!;
    spawnEnemy(world, req.kind, {
      hpMul: req.hpMul,
      pathIndex: req.pathIndex,
      shielded: req.shielded,
      healAura: req.healAura,
      regen: req.regen,
      elite: req.elite,
      fierce: req.fierce,
      resists: req.resists,
    });
  }

  tickBossTrickle(world);

  if (midwaveThresholdCrossed(world)) {
    if (world.midwaveTimerMax === 0) {
      const initial = remainingEnemies(world) * MIDWAVE_PER_ENEMY_SEC + MIDWAVE_BUFFER_SEC;
      world.midwaveTimerMax = initial;
      world.midwaveTimer = initial;
    } else {
      world.midwaveTimer = Math.max(0, world.midwaveTimer - dt);
    }
    if (world.midwaveTimer <= 0 && world.wave < world.totalWaves) {
      world.nextWaveIn = 0;
      startWave(world);
      return;
    }
  }

  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    world.nextWaveIn = WAVE_GAP_SECONDS;
    world.midwaveTimer = 0;
    world.midwaveTimerMax = 0;
    const bonus = 5 + world.wave;
    world.gold += bonus;
    emit(world, { type: "wave-clear", wave: world.wave });
  }
};

export const checkRunEnd = (world: World) => {
  if (world.status !== "running") return;
  if (world.lives <= 0) {
    world.status = "lost";
    world.shake.magnitude = 0;
    emit(world, { type: "game-over", won: false });
    return;
  }
  if (
    world.wave >= world.totalWaves &&
    !world.waveActive &&
    world.spawnQueue.length === 0 &&
    world.enemies.length === 0
  ) {
    world.status = "won";
    world.shake.magnitude = 0;
    emit(world, { type: "game-over", won: true });
  }
};
