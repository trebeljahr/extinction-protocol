import type { World, EnemyKind } from "./types";
import { spawnEnemy, emit } from "./world";

const rosterForWave = (wave: number): { kind: EnemyKind; hpMul: number }[] => {
  const out: { kind: EnemyKind; hpMul: number }[] = [];
  const hpMul = 1 + (wave - 1) * 0.08;

  const raptors = 4 + wave * 2;
  for (let i = 0; i < raptors; i++) out.push({ kind: "raptor", hpMul });

  if (wave >= 2) {
    const swarms = 2 + wave * 3;
    for (let i = 0; i < swarms; i++) out.push({ kind: "swarm", hpMul });
  }
  if (wave >= 3) {
    const allos = Math.floor(wave / 2);
    for (let i = 0; i < allos; i++) out.push({ kind: "allosaur", hpMul });
  }
  if (wave >= 6) {
    const stegos = Math.floor((wave - 4) / 2);
    for (let i = 0; i < stegos; i++) out.push({ kind: "stego", hpMul });
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
  const roster = rosterForWave(world.wave);
  const spacing = Math.max(0.35, 0.75 - world.wave * 0.035);
  for (let i = 0; i < roster.length; i++) {
    const t = world.time + i * spacing;
    world.spawnQueue.push({ kind: roster[i].kind, at: t });
  }
  emit(world, { type: "wave-start", wave: world.wave });
};

export const earlyCallBonus = (nextWaveIn: number) => Math.ceil(nextWaveIn * 2);

export const callWaveEarly = (world: World): boolean => {
  if (world.status !== "running") return false;
  if (world.waveActive) return false;
  if (world.wave >= world.totalWaves) return false;
  world.gold += earlyCallBonus(world.nextWaveIn);
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

  const hpMul = 1 + (world.wave - 1) * 0.08;
  while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.time) {
    const req = world.spawnQueue.shift()!;
    spawnEnemy(world, req.kind, hpMul);
  }

  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    world.nextWaveIn = 6;
    const bonus = 12 + world.wave * 2;
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
