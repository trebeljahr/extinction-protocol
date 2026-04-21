import type { World, EnemyKind } from "./types";
import { spawnEnemy } from "./world";

const rosterForWave = (wave: number): EnemyKind[] => {
  const roster: EnemyKind[] = [];
  const raptors = 4 + wave * 2;
  for (let i = 0; i < raptors; i++) roster.push("raptor");
  if (wave >= 3) {
    const allos = Math.floor(wave / 2);
    for (let i = 0; i < allos; i++) roster.push("allosaur");
  }
  if (wave >= 6) {
    const stegos = Math.floor((wave - 4) / 2);
    for (let i = 0; i < stegos; i++) roster.push("stego");
  }
  return roster;
};

const startWave = (world: World) => {
  world.wave += 1;
  world.waveActive = true;
  const roster = rosterForWave(world.wave);
  const spacing = Math.max(0.35, 0.8 - world.wave * 0.04);
  for (let i = 0; i < roster.length; i++) {
    world.spawnQueue.push({ kind: roster[i], at: world.time + i * spacing });
  }
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
    spawnEnemy(world, req.kind);
  }

  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    world.nextWaveIn = 5;
    world.gold += 25 + world.wave * 5;
  }
};

export const checkRunEnd = (world: World) => {
  if (world.status !== "running") return;
  if (world.lives <= 0) {
    world.status = "lost";
    return;
  }
  if (
    world.wave >= world.totalWaves &&
    !world.waveActive &&
    world.spawnQueue.length === 0 &&
    world.enemies.length === 0
  ) {
    world.status = "won";
  }
};
