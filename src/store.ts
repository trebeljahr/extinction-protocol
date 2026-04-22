import { create } from "zustand";
import type { Vec2, RunStatus, World, TowerKind, GameEvent, Tower, TargetingMode } from "./sim/types";
import { createWorld, createTower, TOWER_COST, TOWER_FOOTPRINT } from "./sim/world";
import { applyUpgrade, sellTower } from "./sim/upgrades";
import { callWaveEarly as simCallWaveEarly, canCallEarly, earlyCallGoldReward } from "./sim/spawner";
import { Engine } from "./sim/loop";
import { getLevel, LEVELS } from "./levels";
import type { LevelConfig } from "./levels";
import { distSq } from "./sim/vec2";
import { segmentLength } from "./sim/path";
import {
  loadProgress,
  saveProgress,
  starsForLives,
  recordLevelResult,
  getStars,
  isLevelUnlocked,
} from "./progress";
import type { ProgressData, Stars } from "./progress";

export type Screen = "worldMap" | "playing" | "results";

export type LastResult = {
  levelId: number;
  levelName: string;
  won: boolean;
  livesRemaining: number;
  stars: Stars;
  bestStars: Stars;
  improved: boolean;
};

type UiSnapshot = {
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  status: RunStatus;
  waveActive: boolean;
  nextWaveIn: number;
  canCallEarly: boolean;
  callEarlyBonus: number;
  selectedTowerId: number | null;
  towerVersion: number;
};

const snapshot = (w: World, towerVersion: number): UiSnapshot => ({
  gold: w.gold,
  lives: w.lives,
  wave: w.wave,
  totalWaves: w.totalWaves,
  status: w.status,
  waveActive: w.waveActive,
  nextWaveIn: Math.ceil(w.nextWaveIn),
  canCallEarly: canCallEarly(w),
  callEarlyBonus: earlyCallGoldReward(w),
  selectedTowerId: w.selectedTowerId,
  towerVersion,
});

const uiEqual = (a: UiSnapshot, b: UiSnapshot) =>
  a.gold === b.gold &&
  a.lives === b.lives &&
  a.wave === b.wave &&
  a.totalWaves === b.totalWaves &&
  a.status === b.status &&
  a.waveActive === b.waveActive &&
  a.nextWaveIn === b.nextWaveIn &&
  a.canCallEarly === b.canCallEarly &&
  a.callEarlyBonus === b.callEarlyBonus &&
  a.selectedTowerId === b.selectedTowerId &&
  a.towerVersion === b.towerVersion;

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

const towerAt = (world: World, pos: Vec2, radius = 0.7): Tower | null => {
  const r2 = radius * radius;
  for (const t of world.towers) {
    if (distSq(t.pos, pos) <= r2) return t;
  }
  return null;
};

type GameStore = {
  world: World;
  engine: Engine;
  ui: UiSnapshot;
  selectedKind: TowerKind | null;
  towerVersion: number;
  eventListeners: ((e: GameEvent) => void)[];

  screen: Screen;
  selectedLevelId: number | null;
  progress: ProgressData;
  hoveredLevelId: number | null;
  lastResult: LastResult | null;

  startLevel: (id: number) => void;
  retryCurrentLevel: () => void;
  goToWorldMap: () => void;
  setHoveredLevel: (id: number | null) => void;

  reset: () => void;
  togglePause: () => void;
  tick: (realTimeSec: number) => void;

  setSelectedKind: (kind: TowerKind | null) => void;
  tryPlaceOrSelect: (pos: Vec2) => void;
  canPlace: (pos: Vec2) => boolean;
  towerAtPos: (pos: Vec2) => Tower | null;
  clearSelection: () => void;

  selectTower: (id: number | null) => void;
  upgradeSelected: (branch: "a" | "b") => void;
  sellSelected: () => void;
  setTargetingMode: (mode: TargetingMode) => void;
  callWaveEarly: () => void;

  onEvent: (fn: (e: GameEvent) => void) => () => void;
};

const buildWorldForLevel = (level: LevelConfig) => {
  const world = createWorld(level);
  return { world, ui: snapshot(world, 0), towerVersion: 0 };
};

export const isUnlocked = (levelId: number, progress: ProgressData) =>
  isLevelUnlocked(levelId, progress);

export const useGame = create<GameStore>((set, get) => ({
  ...buildWorldForLevel(getLevel(1)),
  engine: new Engine(),
  selectedKind: null,
  eventListeners: [],

  screen: "worldMap",
  selectedLevelId: null,
  progress: loadProgress(),
  hoveredLevelId: null,
  lastResult: null,

  startLevel: (id) => {
    const level = LEVELS.find(l => l.id === id);
    if (!level) return;
    if (!isLevelUnlocked(id, get().progress)) return;
    const { engine } = get();
    engine.reset();
    set({
      ...buildWorldForLevel(level),
      selectedKind: null,
      selectedLevelId: id,
      hoveredLevelId: null,
      lastResult: null,
      screen: "playing",
    });
  },

  retryCurrentLevel: () => {
    const id = get().selectedLevelId ?? 1;
    get().startLevel(id);
  },

  goToWorldMap: () => {
    const { engine } = get();
    engine.reset();
    set({
      screen: "worldMap",
      hoveredLevelId: null,
      lastResult: null,
    });
  },

  setHoveredLevel: (id) => set({ hoveredLevelId: id }),

  reset: () => {
    get().retryCurrentLevel();
  },

  togglePause: () => {
    const { world } = get();
    if (world.status === "running") world.status = "paused";
    else if (world.status === "paused") world.status = "running";
    set({ ui: snapshot(world, get().towerVersion) });
  },

  tick: (realTimeSec: number) => {
    const s = get();
    s.engine.step(s.world, realTimeSec);
    if (s.world.events.length > 0) {
      for (const ev of s.world.events) {
        if (ev.type === "game-over") {
          const w = s.world;
          const stars: Stars = ev.won ? starsForLives(w.lives) : 0;
          const prev = getStars(s.progress, w.levelId);
          const nextProgress = ev.won
            ? recordLevelResult(s.progress, w.levelId, stars)
            : s.progress;
          if (ev.won && stars > prev) saveProgress(nextProgress);
          const level = LEVELS.find(l => l.id === w.levelId);
          const bestStars: Stars = Math.max(prev, ev.won ? stars : 0) as Stars;
          set({
            progress: nextProgress,
            lastResult: {
              levelId: w.levelId,
              levelName: level?.name ?? `Level ${w.levelId}`,
              won: ev.won,
              livesRemaining: w.lives,
              stars,
              bestStars,
              improved: ev.won && stars > prev,
            },
            screen: "results",
          });
        }
        for (const fn of s.eventListeners) fn(ev);
      }
      s.world.events.length = 0;
    }
    const next = snapshot(s.world, s.towerVersion);
    if (!uiEqual(s.ui, next)) set({ ui: next });
  },

  setSelectedKind: (kind) => {
    const { world, towerVersion } = get();
    if (kind !== null) world.selectedTowerId = null;
    set({ selectedKind: kind, ui: snapshot(world, towerVersion) });
  },

  canPlace: (pos) => canPlaceAt(get().world, pos),

  towerAtPos: (pos) => towerAt(get().world, pos),

  clearSelection: () => {
    const { world, towerVersion } = get();
    world.selectedTowerId = null;
    set({ selectedKind: null, ui: snapshot(world, towerVersion) });
  },

  tryPlaceOrSelect: (pos) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;

    const hit = towerAt(w, pos);
    if (hit) {
      w.selectedTowerId = hit.id;
      set({ selectedKind: null, ui: snapshot(w, s.towerVersion) });
      return;
    }

    if (s.selectedKind === null) return;
    const cost = TOWER_COST[s.selectedKind];
    if (w.gold < cost) return;
    if (!canPlaceAt(w, pos)) return;
    w.gold -= cost;
    const t = createTower(w, s.selectedKind, pos);
    w.selectedTowerId = t.id;
    const newVersion = s.towerVersion + 1;
    set({ selectedKind: null, towerVersion: newVersion, ui: snapshot(w, newVersion) });
  },

  selectTower: (id) => {
    const { world, towerVersion } = get();
    world.selectedTowerId = id;
    set({ selectedKind: id !== null ? null : get().selectedKind, ui: snapshot(world, towerVersion) });
  },

  upgradeSelected: (branch) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t) return;
    if (applyUpgrade(s.world, t, branch)) {
      const newVersion = s.towerVersion + 1;
      set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion) });
    }
  },

  sellSelected: () => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t) return;
    sellTower(s.world, t);
    const newVersion = s.towerVersion + 1;
    set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion) });
  },

  setTargetingMode: (mode) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t || t.targetingMode === mode) return;
    t.targetingMode = mode;
    t.targetId = null;
    const newVersion = s.towerVersion + 1;
    set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion) });
  },

  callWaveEarly: () => {
    const s = get();
    if (!simCallWaveEarly(s.world)) return;
    set({ ui: snapshot(s.world, s.towerVersion) });
  },

  onEvent: (fn) => {
    set(state => ({ eventListeners: [...state.eventListeners, fn] }));
    return () => {
      set(state => ({ eventListeners: state.eventListeners.filter(f => f !== fn) }));
    };
  },
}));
