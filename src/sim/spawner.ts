import type { World, EnemyKind } from "./types";
import { spawnEnemy, emit } from "./world";

type WaveEntry = { kind: EnemyKind; count: number };
export type WaveArchetype = "intro" | "mixed" | "swarm" | "heavy" | "chaos";

type WavePlan = {
  archetype: WaveArchetype;
  entries: WaveEntry[];
  spacingBase: number;
};

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

export const getWavePlan = (wave: number): { archetype: WaveArchetype } =>
  ({ archetype: wavePlan(wave).archetype });

const wavePlan = (wave: number): WavePlan => {
  switch (wave) {
    case 1:  return { archetype: "intro",  spacingBase: 0.9,  entries: [{ kind: "raptor", count: 10 }] };
    case 2:  return { archetype: "mixed",  spacingBase: 0.55, entries: [{ kind: "raptor", count: 14 }, { kind: "swarm", count: 10 }] };
    case 3:  return { archetype: "swarm",  spacingBase: 0.12, entries: [{ kind: "swarm", count: 70 }] };
    case 4:  return { archetype: "mixed",  spacingBase: 0.45, entries: [{ kind: "raptor", count: 16 }, { kind: "allosaur", count: 5 }, { kind: "swarm", count: 14 }] };
    case 5:  return { archetype: "heavy",  spacingBase: 0.9,  entries: [{ kind: "armored", count: 7 }, { kind: "allosaur", count: 5 }, { kind: "stego", count: 2 }] };
    case 6:  return { archetype: "swarm",  spacingBase: 0.09, entries: [{ kind: "swarm", count: 95 }, { kind: "raptor", count: 10 }] };
    case 7:  return { archetype: "mixed",  spacingBase: 0.4,  entries: [{ kind: "raptor", count: 20 }, { kind: "allosaur", count: 8 }, { kind: "stego", count: 4 }] };
    case 8:  return { archetype: "heavy",  spacingBase: 0.8,  entries: [{ kind: "armored", count: 12 }, { kind: "stego", count: 6 }, { kind: "allosaur", count: 6 }] };
    case 9:  return { archetype: "chaos",  spacingBase: 0.28, entries: [{ kind: "swarm", count: 45 }, { kind: "raptor", count: 20 }, { kind: "allosaur", count: 7 }, { kind: "stego", count: 3 }, { kind: "armored", count: 2 }] };
    default: return { archetype: "chaos",  spacingBase: 0.38, entries: [{ kind: "armored", count: 10 }, { kind: "stego", count: 6 }, { kind: "allosaur", count: 10 }, { kind: "raptor", count: 24 }, { kind: "swarm", count: 30 }] };
  }
};

const buildRoster = (plan: WavePlan): EnemyKind[] => {
  const out: EnemyKind[] = [];
  for (const entry of plan.entries) {
    for (let i = 0; i < entry.count; i++) out.push(entry.kind);
  }
  if (plan.archetype === "swarm") return out;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const WAVE_GAP_SECONDS = 2;
const EARLY_CALL_THRESHOLD = 1 / 3;

const startWave = (world: World) => {
  world.wave += 1;
  world.waveActive = true;
  const plan = wavePlan(world.wave);
  const roster = buildRoster(plan);
  world.waveTotalEnemies = roster.length;
  const spacing = plan.spacingBase;
  for (let i = 0; i < roster.length; i++) {
    const t = world.time + i * spacing;
    world.spawnQueue.push({ kind: roster[i], at: t });
  }
  emit(world, { type: "wave-start", wave: world.wave });
};

export const earlyCallBonus = (secondsSaved: number) => Math.ceil(secondsSaved * 2);

const earlyCallSecondsSaved = (world: World): number =>
  world.waveActive ? WAVE_GAP_SECONDS : world.nextWaveIn;

export const canCallEarly = (world: World): boolean => {
  if (world.status !== "running") return false;
  if (world.wave >= world.totalWaves) return false;
  if (!world.waveActive) return true;
  if (world.waveTotalEnemies <= 0) return false;
  const remaining = world.spawnQueue.length + world.enemies.length;
  return remaining <= world.waveTotalEnemies * EARLY_CALL_THRESHOLD;
};

export const earlyCallGoldReward = (world: World): number =>
  canCallEarly(world) ? earlyCallBonus(earlyCallSecondsSaved(world)) : 0;

export const callWaveEarly = (world: World): boolean => {
  if (!canCallEarly(world)) return false;
  world.gold += earlyCallBonus(earlyCallSecondsSaved(world));
  world.nextWaveIn = 0;
  startWave(world);
  return true;
};

export const spawnerTick = (world: World, dt: number) => {
  if (!world.waveActive) {
    world.nextWaveIn = Math.max(0, world.nextWaveIn - dt);
    if (world.nextWaveIn === 0 && world.wave < world.totalWaves) {
      startWave(world);
    }
    return;
  }

  const hpMul = 1 + (world.wave - 1) * 0.22;
  while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.time) {
    const req = world.spawnQueue.shift()!;
    spawnEnemy(world, req.kind, hpMul);
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
