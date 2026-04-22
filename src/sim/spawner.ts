import type { World, EnemyKind, WaveSpec, WaveArchetype } from "./types";
import { spawnEnemy, emit } from "./world";

export type { WaveArchetype };

export const WAVE_ARCHETYPE_LABEL: Record<WaveArchetype, string> = {
  intro:  "Intro",
  mixed:  "Mixed",
  swarm:  "Swarm rush",
  heavy:  "Armored push",
  chaos:  "Chaos",
};

export const WAVE_ARCHETYPE_HINT: Record<WaveArchetype, string> = {
  intro:  "",
  mixed:  "balanced composition",
  swarm:  "favors AoE towers",
  heavy:  "favors single-target",
  chaos:  "bring everything",
};

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

const rosterFromSpec = (spec: WaveSpec): EnemyKind[] => {
  const out: EnemyKind[] = [];
  for (const s of spec.spawns) {
    for (let i = 0; i < s.count; i++) out.push(s.kind);
  }
  const archetype = spec.archetype ?? inferArchetype(spec);
  if (archetype === "swarm") return out;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const WAVE_GAP_SECONDS = 2;
const EARLY_CALL_THRESHOLD = 1 / 2;

const startWave = (world: World) => {
  world.wave += 1;
  world.waveActive = true;
  const spec = world.plannedWaves[world.wave - 1];
  const roster = rosterFromSpec(spec);
  world.waveTotalEnemies = roster.length;
  const hpMul = spec.hpMul ?? 1;
  const spacing = spec.spacing ?? Math.max(0.35, 0.75 - world.wave * 0.03);
  for (let i = 0; i < roster.length; i++) {
    const t = world.time + i * spacing;
    world.spawnQueue.push({ kind: roster[i], at: t, hpMul });
  }
  emit(world, { type: "wave-start", wave: world.wave });
};

export const earlyCallBonus = (world: World): number =>
  world.wave === 0 ? 0 : 15 + world.wave;

export const canCallEarly = (world: World): boolean => {
  if (world.status !== "running") return false;
  if (world.wave >= world.totalWaves) return false;
  if (!world.waveActive) return true;
  if (world.waveTotalEnemies <= 0) return false;
  const remaining = world.spawnQueue.length + world.enemies.length;
  return remaining <= world.waveTotalEnemies * EARLY_CALL_THRESHOLD;
};

export const earlyCallGoldReward = (world: World): number =>
  canCallEarly(world) ? earlyCallBonus(world) : 0;

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
    spawnEnemy(world, req.kind, req.hpMul);
  }

  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    world.nextWaveIn = WAVE_GAP_SECONDS;
    const bonus = 5 + world.wave;
    world.gold += bonus;
    emit(world, { type: "wave-clear", wave: world.wave });
  }
};

export const checkRunEnd = (world: World) => {
  if (world.status !== "running") return;
  if (world.lives <= 0) {
    world.status = "lost";
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
    emit(world, { type: "game-over", won: true });
  }
};
