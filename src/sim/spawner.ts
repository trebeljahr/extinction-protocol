import type { World, EnemyKind, WaveSpec } from "./types";
import { spawnEnemy, emit } from "./world";

const rosterFromSpec = (spec: WaveSpec): EnemyKind[] => {
  const out: EnemyKind[] = [];
  for (const s of spec.spawns) {
    for (let i = 0; i < s.count; i++) out.push(s.kind);
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const startWave = (world: World) => {
  world.wave += 1;
  world.waveActive = true;
  const spec = world.plannedWaves[world.wave - 1];
  const roster = rosterFromSpec(spec);
  const hpMul = spec.hpMul ?? 1;
  const spacing = spec.spacing ?? Math.max(0.35, 0.75 - world.wave * 0.03);
  for (let i = 0; i < roster.length; i++) {
    const t = world.time + i * spacing;
    world.spawnQueue.push({ kind: roster[i], at: t, hpMul });
  }
  emit(world, { type: "wave-start", wave: world.wave });
};

export const spawnerTick = (world: World, dt: number) => {
  if (!world.waveActive) {
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
    world.nextWaveIn = 6;
    const bonus = 25 + world.wave * 5;
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
