import { create } from "zustand";
import type { Vec2, RunStatus, World, TowerKind, GameEvent, Tower, Tree, Slot, TargetingMode, EnemyKind } from "./sim/types";
import { createWorld, createTower, TOWER_COST, TREE_REMOVE_COST, SLOT_SNAP_RADIUS } from "./sim/world";
import { applyUpgrade, sellTower } from "./sim/upgrades";
import { callWaveEarly as simCallWaveEarly, canCallEarly, earlyCallGoldReward, earlyCallTimerSec } from "./sim/spawner";
import { Engine } from "./sim/loop";
import { getLevel, LEVELS } from "./levels";
import type { LevelConfig } from "./levels";
import { distSq } from "./sim/vec2";
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
  callEarlyTimer: number;
  selectedTowerId: number | null;
  towerVersion: number;
  treeVersion: number;
  inspectedEnemyId: number | null;
  inspectedEnemyKind: EnemyKind | null;
  inspectedEnemyHp: number | null;
  inspectedEnemyMaxHp: number | null;
  inspectedEnemyAlive: boolean;
};

const snapshot = (
  w: World,
  towerVersion: number,
  treeVersion: number,
  inspect: { id: number | null; kind: EnemyKind | null; maxHp: number | null },
): UiSnapshot => {
  let hp: number | null = null;
  let alive = false;
  if (inspect.id !== null) {
    const e = w.enemies.find(x => x.id === inspect.id && x.alive);
    if (e) { hp = e.hp; alive = true; }
  }
  return {
    gold: w.gold,
    lives: w.lives,
    wave: w.wave,
    totalWaves: w.totalWaves,
    status: w.status,
    waveActive: w.waveActive,
    nextWaveIn: Math.ceil(w.nextWaveIn),
    canCallEarly: canCallEarly(w),
    callEarlyBonus: earlyCallGoldReward(w),
    callEarlyTimer: Math.ceil(earlyCallTimerSec(w)),
    selectedTowerId: w.selectedTowerId,
    towerVersion,
    treeVersion,
    inspectedEnemyId: inspect.id,
    inspectedEnemyKind: inspect.kind,
    inspectedEnemyHp: hp,
    inspectedEnemyMaxHp: inspect.maxHp,
    inspectedEnemyAlive: alive,
  };
};

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
  a.callEarlyTimer === b.callEarlyTimer &&
  a.selectedTowerId === b.selectedTowerId &&
  a.towerVersion === b.towerVersion &&
  a.treeVersion === b.treeVersion &&
  a.inspectedEnemyId === b.inspectedEnemyId &&
  a.inspectedEnemyKind === b.inspectedEnemyKind &&
  a.inspectedEnemyHp === b.inspectedEnemyHp &&
  a.inspectedEnemyMaxHp === b.inspectedEnemyMaxHp &&
  a.inspectedEnemyAlive === b.inspectedEnemyAlive;

const nearestEmptySlot = (world: World, pos: Vec2): Slot | null => {
  const r2 = SLOT_SNAP_RADIUS * SLOT_SNAP_RADIUS;
  let best: Slot | null = null;
  let bestDist = Infinity;
  for (const s of world.slots) {
    if (s.towerId !== null) continue;
    const d = distSq(s.pos, pos);
    if (d <= r2 && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
};

const towerAt = (world: World, pos: Vec2, radius = 0.9): Tower | null => {
  const r2 = radius * radius;
  for (const t of world.towers) {
    if (distSq(t.pos, pos) <= r2) return t;
  }
  return null;
};

const treeById = (world: World, id: number): Tree | null =>
  world.trees.find(t => t.id === id) ?? null;

type InspectState = { id: number | null; kind: EnemyKind | null; maxHp: number | null };

type GameStore = {
  world: World;
  engine: Engine;
  ui: UiSnapshot;
  selectedKind: TowerKind | null;
  towerVersion: number;
  treeVersion: number;
  inspectedEnemy: InspectState;
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
  slotForPlacement: (pos: Vec2) => Slot | null;
  towerAtPos: (pos: Vec2) => Tower | null;
  clearSelection: () => void;

  selectTower: (id: number | null) => void;
  upgradeSelected: (branch: "a" | "b") => void;
  sellSelected: () => void;
  setTargetingMode: (mode: TargetingMode) => void;
  callWaveEarly: () => void;
  removeTree: (id: number) => void;

  inspectEnemy: (id: number, kind: EnemyKind, maxHp: number) => void;
  clearInspectedEnemy: () => void;

  onEvent: (fn: (e: GameEvent) => void) => () => void;
};

const emptyInspect: InspectState = { id: null, kind: null, maxHp: null };

const buildWorldForLevel = (level: LevelConfig) => {
  const world = createWorld(level);
  return {
    world,
    ui: snapshot(world, 0, 0, emptyInspect),
    towerVersion: 0,
    treeVersion: 0,
    inspectedEnemy: emptyInspect,
  };
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
    const s = get();
    const { world } = s;
    if (world.status === "running") world.status = "paused";
    else if (world.status === "paused") world.status = "running";
    set({ ui: snapshot(world, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
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
    const next = snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy);
    if (!uiEqual(s.ui, next)) set({ ui: next });
  },

  setSelectedKind: (kind) => {
    const s = get();
    const { world, towerVersion, treeVersion } = s;
    if (kind !== null) world.selectedTowerId = null;
    const nextInspect = kind !== null ? emptyInspect : s.inspectedEnemy;
    set({ selectedKind: kind, inspectedEnemy: nextInspect, ui: snapshot(world, towerVersion, treeVersion, nextInspect) });
  },

  slotForPlacement: (pos) => nearestEmptySlot(get().world, pos),

  towerAtPos: (pos) => towerAt(get().world, pos),

  clearSelection: () => {
    const { world, towerVersion, treeVersion } = get();
    world.selectedTowerId = null;
    set({
      selectedKind: null,
      inspectedEnemy: emptyInspect,
      ui: snapshot(world, towerVersion, treeVersion, emptyInspect),
    });
  },

  inspectEnemy: (id, kind, maxHp) => {
    const { world, towerVersion, treeVersion } = get();
    world.selectedTowerId = null;
    const inspect: InspectState = { id, kind, maxHp };
    set({
      selectedKind: null,
      inspectedEnemy: inspect,
      ui: snapshot(world, towerVersion, treeVersion, inspect),
    });
  },

  clearInspectedEnemy: () => {
    const { world, towerVersion, treeVersion } = get();
    set({
      inspectedEnemy: emptyInspect,
      ui: snapshot(world, towerVersion, treeVersion, emptyInspect),
    });
  },

  tryPlaceOrSelect: (pos) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;

    const hit = towerAt(w, pos);
    if (hit) {
      w.selectedTowerId = hit.id;
      set({ selectedKind: null, inspectedEnemy: emptyInspect, ui: snapshot(w, s.towerVersion, s.treeVersion, emptyInspect) });
      return;
    }

    if (s.selectedKind === null) {
      if (w.selectedTowerId !== null) {
        w.selectedTowerId = null;
        set({ ui: snapshot(w, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
      }
      return;
    }
    const slot = nearestEmptySlot(w, pos);
    if (!slot) return;
    const cost = TOWER_COST[s.selectedKind];
    if (w.gold < cost) return;
    w.gold -= cost;
    const t = createTower(w, s.selectedKind, slot.pos);
    slot.towerId = t.id;
    w.selectedTowerId = t.id;
    const newVersion = s.towerVersion + 1;
    set({ selectedKind: null, towerVersion: newVersion, ui: snapshot(w, newVersion, s.treeVersion, s.inspectedEnemy) });
  },

  selectTower: (id) => {
    const s = get();
    const { world, towerVersion, treeVersion } = s;
    world.selectedTowerId = id;
    const nextInspect = id !== null ? emptyInspect : s.inspectedEnemy;
    set({
      selectedKind: id !== null ? null : s.selectedKind,
      inspectedEnemy: nextInspect,
      ui: snapshot(world, towerVersion, treeVersion, nextInspect),
    });
  },

  upgradeSelected: (branch) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t) return;
    if (applyUpgrade(s.world, t, branch)) {
      const newVersion = s.towerVersion + 1;
      set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy) });
    }
  },

  sellSelected: () => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t) return;
    sellTower(s.world, t);
    const newVersion = s.towerVersion + 1;
    set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy) });
  },

  setTargetingMode: (mode) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towers.find(x => x.id === s.world.selectedTowerId);
    if (!t || t.targetingMode === mode) return;
    t.targetingMode = mode;
    t.targetId = null;
    const newVersion = s.towerVersion + 1;
    set({ towerVersion: newVersion, ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy) });
  },

  callWaveEarly: () => {
    const s = get();
    if (!simCallWaveEarly(s.world)) return;
    set({ ui: snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  removeTree: (id) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;
    const tree = treeById(w, id);
    if (!tree) return;
    if (w.gold < TREE_REMOVE_COST) return;
    w.gold -= TREE_REMOVE_COST;
    w.trees = w.trees.filter(t => t.id !== id);
    const newTreeVersion = s.treeVersion + 1;
    set({ treeVersion: newTreeVersion, ui: snapshot(w, s.towerVersion, newTreeVersion, s.inspectedEnemy) });
  },

  onEvent: (fn) => {
    set(state => ({ eventListeners: [...state.eventListeners, fn] }));
    return () => {
      set(state => ({ eventListeners: state.eventListeners.filter(f => f !== fn) }));
    };
  },
}));
