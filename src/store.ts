import { create } from "zustand";
import type { Vec2, RunStatus, World } from "./sim/types";
import { createWorld, createTower, TOWER_COST, TOWER_FOOTPRINT } from "./sim/world";
import { Engine } from "./sim/loop";
import { PATH } from "./level";
import { distSq } from "./sim/vec2";
import { segmentLength } from "./sim/path";

type UiSnapshot = {
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  status: RunStatus;
  waveActive: boolean;
  nextWaveIn: number;
};

const snapshot = (w: World): UiSnapshot => ({
  gold: w.gold,
  lives: w.lives,
  wave: w.wave,
  totalWaves: w.totalWaves,
  status: w.status,
  waveActive: w.waveActive,
  nextWaveIn: Math.ceil(w.nextWaveIn),
});

const uiEqual = (a: UiSnapshot, b: UiSnapshot) =>
  a.gold === b.gold &&
  a.lives === b.lives &&
  a.wave === b.wave &&
  a.totalWaves === b.totalWaves &&
  a.status === b.status &&
  a.waveActive === b.waveActive &&
  a.nextWaveIn === b.nextWaveIn;

const distToSegmentSq = (p: Vec2, a: Vec2, b: Vec2) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return dx * dx + dy * dy;
};

const isOnPath = (world: World, pos: Vec2, clearance: number): boolean => {
  const r2 = clearance * clearance;
  for (let i = 0; i < world.path.length - 1; i++) {
    if (segmentLength(world.path, i) === 0) continue;
    if (distToSegmentSq(pos, world.path[i], world.path[i + 1]) < r2) return true;
  }
  return false;
};

const canPlaceAt = (world: World, pos: Vec2): boolean => {
  if (isOnPath(world, pos, 1.2)) return false;
  const footprintSq = (TOWER_FOOTPRINT + 0.1) * (TOWER_FOOTPRINT + 0.1);
  for (const t of world.towers) {
    if (distSq(t.pos, pos) < footprintSq) return false;
  }
  return true;
};

type GameStore = {
  world: World;
  engine: Engine;
  ui: UiSnapshot;
  reset: () => void;
  togglePause: () => void;
  tick: (realTimeSec: number) => void;
  placeTower: (pos: Vec2) => boolean;
  canPlace: (pos: Vec2) => boolean;
};

const initial = () => {
  const world = createWorld(PATH);
  return { world, ui: snapshot(world) };
};

export const useGame = create<GameStore>((set, get) => ({
  ...initial(),
  engine: new Engine(),

  reset: () => {
    const { engine } = get();
    engine.reset();
    set(initial());
  },

  togglePause: () => {
    const { world } = get();
    if (world.status === "running") world.status = "paused";
    else if (world.status === "paused") world.status = "running";
    set({ ui: snapshot(world) });
  },

  tick: (realTimeSec: number) => {
    const { world, engine, ui } = get();
    engine.step(world, realTimeSec);
    const next = snapshot(world);
    if (!uiEqual(ui, next)) set({ ui: next });
  },

  placeTower: (pos: Vec2) => {
    const { world } = get();
    if (world.status !== "running") return false;
    if (world.gold < TOWER_COST.pulse) return false;
    if (!canPlaceAt(world, pos)) return false;
    world.gold -= TOWER_COST.pulse;
    createTower(world, pos);
    set({ ui: snapshot(world) });
    return true;
  },

  canPlace: (pos: Vec2) => canPlaceAt(get().world, pos),
}));
