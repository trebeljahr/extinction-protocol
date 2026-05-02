import { create } from "zustand";
import type { AchievementId } from "./achievements";
import { checkAchievements } from "./achievements";
import { track } from "./analytics";
import { EASTER_EGG_BY_ID } from "./easterEggs";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "./level";
import type { LevelConfig } from "./levels";
import { getLevel, LEVELS } from "./levels";
import type { ProgressData, Stars } from "./progress";
import {
  getStars,
  isLevelUnlocked,
  loadProgress,
  markEncountered,
  recordLevelResult,
  saveProgress,
  starsForLives,
} from "./progress";
import { Engine } from "./sim/loop";
import { segmentLength } from "./sim/path";
import {
  canCallEarly,
  earlyCallGoldReward,
  earlyCallTimerSec,
  callWaveEarly as simCallWaveEarly,
} from "./sim/spawner";
import type {
  DamageType,
  EnemyKind,
  GameEvent,
  Rock,
  RunStatus,
  TargetingMode,
  Tower,
  TowerKind,
  Tree,
  Vec2,
  World,
} from "./sim/types";
import { applyUpgrade, sellTower } from "./sim/upgrades";
import { distSq } from "./sim/vec2";
import {
  createTower,
  createWorld,
  emit,
  ROCK_FOOTPRINT,
  ROCK_REMOVE_COST,
  spawnMovingEasterEgg,
  spawnParticles,
  TOWER_COST,
  TOWER_FOOTPRINT,
  TREE_FOOTPRINT,
  TREE_REMOVE_COST,
} from "./sim/world";

export type Screen = "worldMap" | "playing" | "results";

export type AchievementToast = { id: AchievementId; key: number };

export type LastResult = {
  levelId: number;
  levelName: string;
  won: boolean;
  livesRemaining: number;
  stars: Stars;
  bestStars: Stars;
  improved: boolean;
  unlockedAchievements: AchievementId[];
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
  inspectedEnemyShield: number | null;
  inspectedEnemyMaxShield: number;
  inspectedEnemyHealAura: boolean;
  inspectedEnemyRegen: boolean;
  inspectedEnemyElite: boolean;
  inspectedEnemyFierce: boolean;
  // Resists chip — per-damage-type adaptation multipliers. Empty when
  // the inspected enemy has no resist chip applied.
  inspectedEnemyExtraResists: Partial<Record<DamageType, number>>;
};

const snapshot = (
  w: World,
  towerVersion: number,
  treeVersion: number,
  inspect: { id: number | null; kind: EnemyKind | null; maxHp: number | null },
): UiSnapshot => {
  let hp: number | null = null;
  let alive = false;
  let shield: number | null = null;
  let maxShield = 0;
  let healAura = false;
  let regen = false;
  let elite = false;
  let fierce = false;
  let extraResists: Partial<Record<DamageType, number>> = {};
  if (inspect.id !== null) {
    const e = w.enemyById.get(inspect.id);
    if (e?.alive) {
      hp = e.hp;
      alive = true;
      shield = e.shield;
      maxShield = e.maxShield;
      healAura = e.healAura;
      regen = e.regen;
      elite = e.elite;
      fierce = e.fierce;
      extraResists = e.extraResists;
    }
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
    inspectedEnemyShield: shield,
    inspectedEnemyMaxShield: maxShield,
    inspectedEnemyHealAura: healAura,
    inspectedEnemyRegen: regen,
    inspectedEnemyElite: elite,
    inspectedEnemyFierce: fierce,
    inspectedEnemyExtraResists: extraResists,
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
  a.inspectedEnemyAlive === b.inspectedEnemyAlive &&
  a.inspectedEnemyShield === b.inspectedEnemyShield &&
  a.inspectedEnemyMaxShield === b.inspectedEnemyMaxShield &&
  a.inspectedEnemyHealAura === b.inspectedEnemyHealAura &&
  a.inspectedEnemyRegen === b.inspectedEnemyRegen &&
  a.inspectedEnemyElite === b.inspectedEnemyElite &&
  a.inspectedEnemyFierce === b.inspectedEnemyFierce;

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
  for (const path of world.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      if (segmentLength(path, i) === 0) continue;
      if (distToSegmentSq(pos, path[i], path[i + 1]) < r2) return true;
    }
  }
  return false;
};

const canPlaceAt = (world: World, pos: Vec2): boolean => {
  if (isOnPath(world, pos, PATH_WIDTH / 2 + 0.4)) return false;
  const footprintSq = (TOWER_FOOTPRINT + 0.1) * (TOWER_FOOTPRINT + 0.1);
  for (const t of world.towers) {
    if (distSq(t.pos, pos) < footprintSq) return false;
  }
  const treeBlockSq =
    (TREE_FOOTPRINT * 0.5 + TOWER_FOOTPRINT * 0.5) * (TREE_FOOTPRINT * 0.5 + TOWER_FOOTPRINT * 0.5);
  for (const tr of world.trees) {
    if (distSq(tr.pos, pos) < treeBlockSq) return false;
  }
  for (const r of world.rocks) {
    const rockRadius = ROCK_FOOTPRINT * r.scale;
    const blockR = rockRadius + TOWER_FOOTPRINT * 0.5;
    if (distSq(r.pos, pos) < blockR * blockR) return false;
  }
  return true;
};

const towerAt = (world: World, pos: Vec2, radius = 0.9): Tower | null => {
  const r2 = radius * radius;
  for (const t of world.towers) {
    if (distSq(t.pos, pos) <= r2) return t;
  }
  return null;
};

const treeById = (world: World, id: number): Tree | null =>
  world.trees.find((t) => t.id === id) ?? null;

const rockById = (world: World, id: number): Rock | null =>
  world.rocks.find((r) => r.id === id) ?? null;

type InspectState = { id: number | null; kind: EnemyKind | null; maxHp: number | null };

type GameStore = {
  world: World;
  engine: Engine;
  ui: UiSnapshot;
  selectedKind: TowerKind | null;
  selectedTreeId: number | null;
  selectedRockId: number | null;
  // Hive drone-assignment cursor: when set, the next tower click goes
  // to the drone slot identified here instead of selecting that tower.
  // Cleared by completing the assignment, clicking the same hive,
  // canceling, or selling/deselecting the hive.
  assigningDroneSlot: { hiveId: number; droneIdx: number } | null;
  towerVersion: number;
  treeVersion: number;
  inspectedEnemy: InspectState;
  eventListeners: ((e: GameEvent) => void)[];

  screen: Screen;
  selectedLevelId: number | null;
  progress: ProgressData;
  hoveredLevelId: number | null;
  lastResult: LastResult | null;
  compendiumOpen: boolean;
  achievementsOpen: boolean;
  achievementToasts: AchievementToast[];
  newEnemyQueue: EnemyKind[];
  autoPausedForNewEnemy: boolean;
  treeClickCounts: Record<number, number>;
  rockClickCounts: Record<number, number>;

  startLevel: (id: number) => void;
  retryCurrentLevel: () => void;
  goToWorldMap: () => void;
  setHoveredLevel: (id: number | null) => void;
  setCompendiumOpen: (open: boolean) => void;
  setAchievementsOpen: (open: boolean) => void;
  dismissAchievementToast: (key: number) => void;

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

  // Hive drone assignment flow:
  //  - beginDroneAssignment: arms the cursor for the given drone slot
  //  - assignDroneToTower:   completes assignment to a specific tower
  //  - clearDroneAssignment: unassigns the slot back to idle
  //  - cancelDroneAssignment: drops the cursor without changes
  beginDroneAssignment: (hiveId: number, droneIdx: number) => void;
  assignDroneToTower: (towerId: number) => void;
  clearDroneAssignment: (hiveId: number, droneIdx: number) => void;
  cancelDroneAssignment: () => void;

  selectTree: (id: number) => void;
  clearSelectedTree: () => void;
  confirmRemoveTree: () => void;

  selectRock: (id: number) => void;
  clearSelectedRock: () => void;
  confirmRemoveRock: () => void;

  clickEasterEgg: (id: number) => void;

  inspectEnemy: (id: number, kind: EnemyKind, maxHp: number) => void;
  clearInspectedEnemy: () => void;

  dismissNewEnemy: () => void;

  onEvent: (fn: (e: GameEvent) => void) => () => void;

  // ── Debug actions (only invoked from the debug menu, gated by
  //    isDebug from src/debug.ts). Live on the store rather than as
  //    free functions so they share the same set/snapshot machinery
  //    as the regular UI actions and trigger the same UI updates. ──
  freeTowers: boolean;
  debugAddGold: (n: number) => void;
  debugSkipWave: () => void;
  debugWinLevel: () => void;
  debugSetFreeTowers: (on: boolean) => void;
  debugTriggerEasterEgg: (defId: string) => void;
  debugSetLevelStars: (levelId: number, stars: Stars) => void;
  debugResetProgress: () => void;
};

const emptyInspect: InspectState = { id: null, kind: null, maxHp: null };

let nextToastKey = 1;

const EASTER_EGG_CLICK_THRESHOLD = 10;

const tryUnlockEasterEgg = (
  progress: ProgressData,
  id: AchievementId,
): { id: AchievementId; progress: ProgressData } | null => {
  if (progress.unlocked[id] !== undefined) return null;
  return {
    id,
    progress: { ...progress, unlocked: { ...progress.unlocked, [id]: Date.now() } },
  };
};

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
  selectedTreeId: null,
  selectedRockId: null,
  assigningDroneSlot: null,
  eventListeners: [],

  screen: "worldMap",
  selectedLevelId: null,
  progress: loadProgress(),
  hoveredLevelId: null,
  lastResult: null,
  compendiumOpen: false,
  achievementsOpen: false,
  achievementToasts: [],
  newEnemyQueue: [],
  autoPausedForNewEnemy: false,
  treeClickCounts: {},
  rockClickCounts: {},

  startLevel: (id) => {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) return;
    if (!isLevelUnlocked(id, get().progress)) return;
    const { engine } = get();
    engine.reset();
    set({
      ...buildWorldForLevel(level),
      selectedKind: null,
      selectedTreeId: null,
      selectedRockId: null,
      selectedLevelId: id,
      hoveredLevelId: null,
      lastResult: null,
      newEnemyQueue: [],
      autoPausedForNewEnemy: false,
      screen: "playing",
      treeClickCounts: {},
      rockClickCounts: {},
    });
    track("level_start", { level_id: id });
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
      newEnemyQueue: [],
      autoPausedForNewEnemy: false,
    });
  },

  setHoveredLevel: (id) => set({ hoveredLevelId: id }),

  setCompendiumOpen: (open) => set({ compendiumOpen: open }),

  setAchievementsOpen: (open) => set({ achievementsOpen: open }),

  dismissAchievementToast: (key) =>
    set((state) => ({ achievementToasts: state.achievementToasts.filter((t) => t.key !== key) })),

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

    let progress = s.progress;
    let newEnemyQueue = s.newEnemyQueue;
    let autoPaused = s.autoPausedForNewEnemy;
    let lastResult = s.lastResult;
    let screen = s.screen;
    const newToasts: AchievementToast[] = [];
    const unlockedThisRun: AchievementId[] = [];

    const runChecks = (ev: GameEvent | null) => {
      const res = checkAchievements(progress, s.world, ev);
      if (res.unlocked.length === 0) return;
      progress = res.progress;
      for (const id of res.unlocked) {
        newToasts.push({ id, key: nextToastKey++ });
        unlockedThisRun.push(id);
        track("achievement_unlocked", { achievement_id: id });
      }
    };

    // Track encountered enemy kinds — and announce any first sighting.
    if (s.world.enemies.length > 0) {
      const kinds = new Set<EnemyKind>();
      for (const e of s.world.enemies) kinds.add(e.kind);
      const kindList = Array.from(kinds);
      const newlySeen = kindList.filter((k) => !progress.encountered[k]);
      const nextProgress = markEncountered(progress, kindList);
      if (nextProgress) {
        progress = nextProgress;
        const alreadyQueued = new Set(newEnemyQueue);
        const toQueue = newlySeen.filter((k) => !alreadyQueued.has(k));
        if (toQueue.length > 0) newEnemyQueue = [...newEnemyQueue, ...toQueue];
        // Auto-pause on first sighting so the popup isn't buried under action.
        // Track that WE caused the pause, so dismiss won't unpause a manual pause.
        if (toQueue.length > 0 && s.world.status === "running") {
          s.world.status = "paused";
          autoPaused = true;
        }
        runChecks(null);
      }
    }

    if (s.world.events.length > 0) {
      for (const ev of s.world.events) {
        if (ev.type === "death") {
          progress = {
            ...progress,
            stats: { ...progress.stats, killsTotal: progress.stats.killsTotal + 1 },
          };
        }
        if (ev.type === "game-over") {
          const w = s.world;
          const stars: Stars = ev.won ? starsForLives(w.lives) : 0;
          const prev = getStars(progress, w.levelId);
          if (ev.won && stars > prev) progress = recordLevelResult(progress, w.levelId, stars);
          if (ev.won) {
            progress = {
              ...progress,
              stats: { ...progress.stats, winsTotal: progress.stats.winsTotal + 1 },
            };
          }
          const level = LEVELS.find((l) => l.id === w.levelId);
          const bestStars: Stars = Math.max(prev, ev.won ? stars : 0) as Stars;
          lastResult = {
            levelId: w.levelId,
            levelName: level?.name ?? `Level ${w.levelId}`,
            won: ev.won,
            livesRemaining: w.lives,
            stars,
            bestStars,
            improved: ev.won && stars > prev,
            unlockedAchievements: [],
          };
          screen = "results";
          if (ev.won) {
            track("level_complete", {
              level_id: w.levelId,
              waves_survived: w.totalWaves,
              stars,
            });
          } else {
            track("level_failed", {
              level_id: w.levelId,
              wave_reached: w.wave,
            });
          }
        }
        runChecks(ev);
        for (const fn of s.eventListeners) fn(ev);
      }
      s.world.events.length = 0;
    }

    if (lastResult && unlockedThisRun.length > 0) {
      lastResult = { ...lastResult, unlockedAchievements: unlockedThisRun };
    }

    if (progress !== s.progress) saveProgress(progress);

    const updates: Partial<GameStore> = {};
    if (progress !== s.progress) updates.progress = progress;
    if (newEnemyQueue !== s.newEnemyQueue) updates.newEnemyQueue = newEnemyQueue;
    if (autoPaused !== s.autoPausedForNewEnemy) updates.autoPausedForNewEnemy = autoPaused;
    if (lastResult !== s.lastResult) updates.lastResult = lastResult;
    if (screen !== s.screen) updates.screen = screen;
    if (newToasts.length > 0) updates.achievementToasts = [...s.achievementToasts, ...newToasts];
    const next = snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy);
    if (!uiEqual(s.ui, next)) updates.ui = next;
    if (Object.keys(updates).length > 0) set(updates);
  },

  setSelectedKind: (kind) => {
    const s = get();
    const { world, towerVersion, treeVersion } = s;
    if (kind !== null) world.selectedTowerId = null;
    const nextInspect = kind !== null ? emptyInspect : s.inspectedEnemy;
    const nextTree = kind !== null ? null : s.selectedTreeId;
    const nextRock = kind !== null ? null : s.selectedRockId;
    set({
      selectedKind: kind,
      selectedTreeId: nextTree,
      selectedRockId: nextRock,
      inspectedEnemy: nextInspect,
      // Picking up a tower-to-place implicitly cancels any in-flight
      // drone assignment — the user is doing something else now.
      assigningDroneSlot: kind !== null ? null : s.assigningDroneSlot,
      ui: snapshot(world, towerVersion, treeVersion, nextInspect),
    });
  },

  canPlace: (pos) => canPlaceAt(get().world, pos),

  towerAtPos: (pos) => towerAt(get().world, pos),

  clearSelection: () => {
    const { world, towerVersion, treeVersion } = get();
    world.selectedTowerId = null;
    set({
      selectedKind: null,
      selectedTreeId: null,
      selectedRockId: null,
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
      selectedTreeId: null,
      selectedRockId: null,
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

  dismissNewEnemy: () => {
    const s = get();
    const remaining = s.newEnemyQueue.slice(1);
    // Resume only when the queue empties AND we were the ones who paused.
    const shouldResume =
      remaining.length === 0 && s.autoPausedForNewEnemy && s.world.status === "paused";
    if (shouldResume) s.world.status = "running";
    set({
      newEnemyQueue: remaining,
      autoPausedForNewEnemy: remaining.length === 0 ? false : s.autoPausedForNewEnemy,
      ui: snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy),
    });
  },

  selectTree: (id) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;
    const tree = treeById(w, id);
    if (!tree) return;
    w.selectedTowerId = null;
    const nextCount = (s.treeClickCounts[id] ?? 0) + 1;
    const nextCounts = { ...s.treeClickCounts, [id]: nextCount };
    const unlock =
      nextCount === EASTER_EGG_CLICK_THRESHOLD
        ? tryUnlockEasterEgg(s.progress, "tree_hugger")
        : null;
    if (unlock) {
      spawnParticles(w, tree.pos, 18, "#8ecf6b", [2.5, 5.5], 0.55);
      spawnParticles(w, tree.pos, 10, "#c8f2a4", [1.5, 3.5], 0.75);
      saveProgress(unlock.progress);
      track("achievement_unlocked", { achievement_id: unlock.id });
    }
    set({
      selectedKind: null,
      selectedTreeId: id,
      selectedRockId: null,
      inspectedEnemy: emptyInspect,
      treeClickCounts: nextCounts,
      ...(unlock
        ? {
            progress: unlock.progress,
            achievementToasts: [...s.achievementToasts, { id: unlock.id, key: nextToastKey++ }],
          }
        : {}),
      ui: snapshot(w, s.towerVersion, s.treeVersion, emptyInspect),
    });
  },

  clearSelectedTree: () => set({ selectedTreeId: null }),

  confirmRemoveTree: () => {
    const s = get();
    const w = s.world;
    const id = s.selectedTreeId;
    if (id === null || w.status !== "running") return;
    const tree = treeById(w, id);
    if (!tree) {
      set({ selectedTreeId: null });
      return;
    }
    if (w.gold < TREE_REMOVE_COST) return;
    w.gold -= TREE_REMOVE_COST;
    w.trees = w.trees.filter((t) => t.id !== id);
    const newTreeVersion = s.treeVersion + 1;
    set({
      treeVersion: newTreeVersion,
      selectedTreeId: null,
      ui: snapshot(w, s.towerVersion, newTreeVersion, s.inspectedEnemy),
    });
  },

  selectRock: (id) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;
    const rock = rockById(w, id);
    if (!rock) return;
    w.selectedTowerId = null;
    const nextCount = (s.rockClickCounts[id] ?? 0) + 1;
    const nextCounts = { ...s.rockClickCounts, [id]: nextCount };
    const unlock =
      nextCount === EASTER_EGG_CLICK_THRESHOLD
        ? tryUnlockEasterEgg(s.progress, "diamond_in_the_rough")
        : null;
    if (unlock) {
      spawnParticles(w, rock.pos, 22, "#e8faff", [3, 6], 0.7);
      spawnParticles(w, rock.pos, 12, "#aaf0ff", [1.5, 3.5], 0.9);
      saveProgress(unlock.progress);
      track("achievement_unlocked", { achievement_id: unlock.id });
    }
    set({
      selectedKind: null,
      selectedTreeId: null,
      selectedRockId: id,
      inspectedEnemy: emptyInspect,
      rockClickCounts: nextCounts,
      ...(unlock
        ? {
            progress: unlock.progress,
            achievementToasts: [...s.achievementToasts, { id: unlock.id, key: nextToastKey++ }],
          }
        : {}),
      ui: snapshot(w, s.towerVersion, s.treeVersion, emptyInspect),
    });
  },

  clearSelectedRock: () => set({ selectedRockId: null }),

  clickEasterEgg: (id) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running" && w.status !== "paused") return;
    const egg = w.easterEggs.find((e) => e.id === id);
    if (!egg) return;
    const def = EASTER_EGG_BY_ID[egg.defId];
    if (!def) return;
    egg.clickCount++;
    spawnParticles(
      w,
      egg.pos,
      def.effect.particleCount,
      def.effect.particleColor,
      def.effect.particleSpeed,
      def.effect.particleLife,
    );
    if (def.effect.secondary) {
      spawnParticles(
        w,
        egg.pos,
        def.effect.secondary.count,
        def.effect.secondary.color,
        def.effect.secondary.speed,
        def.effect.secondary.life,
      );
    }
    const updates: Partial<GameStore> = {};
    if (egg.clickCount >= def.clickThreshold && !egg.triggered) {
      egg.triggered = true;
      // Click-roll eggs (the barrel) topple toward the closest map edge
      // and despawn once they leave. Heading aims at the nearest edge so
      // the barrel always rolls *off* the playfield rather than veering
      // back toward a wall.
      if (def.clickRoll) {
        const distLeft = egg.pos.x + MAP_WIDTH / 2;
        const distRight = MAP_WIDTH / 2 - egg.pos.x;
        const distBottom = egg.pos.y + MAP_HEIGHT / 2;
        const distTop = MAP_HEIGHT / 2 - egg.pos.y;
        const minDist = Math.min(distLeft, distRight, distBottom, distTop);
        let dx = 0;
        let dy = 0;
        if (minDist === distLeft) dx = -1;
        else if (minDist === distRight) dx = 1;
        else if (minDist === distBottom) dy = -1;
        else dy = 1;
        const speed = def.clickRoll.speed;
        egg.vel = { x: dx * speed, y: dy * speed };
        egg.rotY = Math.atan2(dx, dy);
        egg.spin = def.clickRoll.spinRate;
        egg.despawnAt = w.time + def.clickRoll.lifetime;
      }
      const unlock = tryUnlockEasterEgg(s.progress, def.achievement);
      if (unlock) {
        saveProgress(unlock.progress);
        updates.progress = unlock.progress;
        updates.achievementToasts = [
          ...s.achievementToasts,
          { id: unlock.id, key: nextToastKey++ },
        ];
        track("achievement_unlocked", { achievement_id: unlock.id });
      }
    }
    set(updates);
  },

  confirmRemoveRock: () => {
    const s = get();
    const w = s.world;
    const id = s.selectedRockId;
    if (id === null || w.status !== "running") return;
    const rock = rockById(w, id);
    if (!rock) {
      set({ selectedRockId: null });
      return;
    }
    if (w.gold < ROCK_REMOVE_COST) return;
    w.gold -= ROCK_REMOVE_COST;
    w.rocks = w.rocks.filter((r) => r.id !== id);
    const newTreeVersion = s.treeVersion + 1;
    set({
      treeVersion: newTreeVersion,
      selectedRockId: null,
      ui: snapshot(w, s.towerVersion, newTreeVersion, s.inspectedEnemy),
    });
  },

  tryPlaceOrSelect: (pos) => {
    const s = get();
    const w = s.world;
    if (w.status !== "running") return;

    const hit = towerAt(w, pos);
    if (hit) {
      // Drone-assignment cursor wins over normal selection: if the
      // player clicked a tower while armed for assignment, route the
      // click into the assignment action instead of switching selection.
      if (s.assigningDroneSlot) {
        get().assignDroneToTower(hit.id);
        return;
      }
      w.selectedTowerId = hit.id;
      set({
        selectedKind: null,
        selectedTreeId: null,
        selectedRockId: null,
        inspectedEnemy: emptyInspect,
        ui: snapshot(w, s.towerVersion, s.treeVersion, emptyInspect),
      });
      return;
    }

    // Empty-ground click cancels an in-flight drone assignment so the
    // cursor doesn't get stuck if the player thinks better of it.
    if (s.assigningDroneSlot) {
      set({ assigningDroneSlot: null });
      return;
    }

    // Spot-targeting: while a mortar is selected in "spot" mode, every
    // empty-ground click sets/updates its aim point. The mode ends when
    // the user selects something else (another tower, tree, rock), not
    // when they click open ground.
    if (s.selectedKind === null && w.selectedTowerId !== null) {
      const sel = w.towerById.get(w.selectedTowerId);
      if (sel && sel.kind === "mortar" && sel.targetingMode === "spot") {
        const dx = pos.x - sel.pos.x;
        const dy = pos.y - sel.pos.y;
        if (dx * dx + dy * dy <= sel.range * sel.range) {
          sel.targetSpot = { x: pos.x, y: pos.y };
          sel.targetId = null;
          const newVersion = s.towerVersion + 1;
          set({
            towerVersion: newVersion,
            ui: snapshot(w, newVersion, s.treeVersion, s.inspectedEnemy),
          });
        }
        // Out-of-range click: do nothing, keep mortar selected + armed.
        return;
      }
    }

    if (s.selectedKind === null) {
      const hasAnySelection =
        w.selectedTowerId !== null ||
        s.selectedTreeId !== null ||
        s.selectedRockId !== null ||
        s.inspectedEnemy.id !== null;
      if (hasAnySelection) {
        w.selectedTowerId = null;
        set({
          selectedTreeId: null,
          selectedRockId: null,
          inspectedEnemy: emptyInspect,
          ui: snapshot(w, s.towerVersion, s.treeVersion, emptyInspect),
        });
      }
      return;
    }
    const cost = TOWER_COST[s.selectedKind];
    // Debug "free towers" mode skips both the affordability check and
    // the spend; lets a tester sanity-check matchups without grinding.
    const free = s.freeTowers;
    if (!free && w.gold < cost) {
      emit(w, { type: "place-failed", reason: "gold" });
      return;
    }
    if (!canPlaceAt(w, pos)) {
      emit(w, { type: "place-failed", reason: "spot" });
      return;
    }
    if (!free) w.gold -= cost;
    createTower(w, s.selectedKind, pos);
    emit(w, { type: "tower-placed", towerKind: s.selectedKind });
    // Keep the currently-picked tower kind selected (so the player can
    // keep placing more of the same) and *don't* auto-select the tower
    // we just dropped — being thrown into the upgrade panel after every
    // placement is noisy mid-wave.
    const newVersion = s.towerVersion + 1;
    set({ towerVersion: newVersion, ui: snapshot(w, newVersion, s.treeVersion, s.inspectedEnemy) });
  },

  selectTower: (id) => {
    const s = get();
    const { world, towerVersion, treeVersion } = s;
    // If switching to a non-hive tower (or closing the panel), drop any
    // in-flight drone-assignment cursor — it belonged to the previously
    // selected hive.
    const nextHive = id !== null ? world.towerById.get(id) : null;
    const keepAssigning =
      s.assigningDroneSlot !== null &&
      nextHive?.kind === "hive" &&
      nextHive.id === s.assigningDroneSlot.hiveId;
    world.selectedTowerId = id;
    const nextInspect = id !== null ? emptyInspect : s.inspectedEnemy;
    const nextTree = id !== null ? null : s.selectedTreeId;
    const nextRock = id !== null ? null : s.selectedRockId;
    set({
      selectedKind: id !== null ? null : s.selectedKind,
      selectedTreeId: nextTree,
      selectedRockId: nextRock,
      inspectedEnemy: nextInspect,
      assigningDroneSlot: keepAssigning ? s.assigningDroneSlot : null,
      ui: snapshot(world, towerVersion, treeVersion, nextInspect),
    });
  },

  upgradeSelected: (branch) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towerById.get(s.world.selectedTowerId);
    if (!t) return;
    if (applyUpgrade(s.world, t, branch)) {
      const newVersion = s.towerVersion + 1;
      set({
        towerVersion: newVersion,
        ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy),
      });
    }
  },

  sellSelected: () => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towerById.get(s.world.selectedTowerId);
    if (!t) return;
    sellTower(s.world, t);
    emit(s.world, { type: "tower-sold" });
    const newVersion = s.towerVersion + 1;
    set({
      towerVersion: newVersion,
      ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy),
    });
  },

  setTargetingMode: (mode) => {
    const s = get();
    if (s.world.selectedTowerId === null) return;
    const t = s.world.towerById.get(s.world.selectedTowerId);
    if (!t) return;
    if (t.targetingMode === mode) return;
    t.targetingMode = mode;
    t.targetId = null;
    const newVersion = s.towerVersion + 1;
    set({
      towerVersion: newVersion,
      ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy),
    });
  },

  callWaveEarly: () => {
    const s = get();
    if (!simCallWaveEarly(s.world)) return;
    emit(s.world, { type: "wave-called-early" });
    set({ ui: snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  beginDroneAssignment: (hiveId, droneIdx) => {
    const s = get();
    const hive = s.world.towerById.get(hiveId);
    if (!hive || hive.kind !== "hive") return;
    if (droneIdx < 0 || droneIdx >= hive.droneCount) return;
    set({ assigningDroneSlot: { hiveId, droneIdx } });
  },

  assignDroneToTower: (towerId) => {
    const s = get();
    const slot = s.assigningDroneSlot;
    if (!slot) return;
    const hive = s.world.towerById.get(slot.hiveId);
    if (!hive || hive.kind !== "hive") {
      set({ assigningDroneSlot: null });
      return;
    }
    const target = s.world.towerById.get(towerId);
    // Refuse self-assignment + hive-to-hive — both would be no-ops sim
    // side, but the visual "the drone went home to nothing" is worse
    // than just rejecting.
    if (!target || target.kind === "hive") {
      set({ assigningDroneSlot: null });
      return;
    }
    hive.droneAssignments[slot.droneIdx] = towerId;
    const newVersion = s.towerVersion + 1;
    // Drone assignments aren't tick-driven sim events, so the
    // achievement check loop in tick() never sees them. Run a check
    // here so full_service can unlock the moment the last slot is
    // wired up — without making the player kill an enemy first.
    const ach = checkAchievements(s.progress, s.world, null);
    const newToasts = ach.unlocked.map((id) => ({ id, key: nextToastKey++ }));
    if (ach.unlocked.length > 0) {
      saveProgress(ach.progress);
      for (const id of ach.unlocked) track("achievement_unlocked", { achievement_id: id });
    }
    set({
      assigningDroneSlot: null,
      towerVersion: newVersion,
      progress: ach.unlocked.length > 0 ? ach.progress : s.progress,
      achievementToasts:
        newToasts.length > 0 ? [...s.achievementToasts, ...newToasts] : s.achievementToasts,
      ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy),
    });
  },

  clearDroneAssignment: (hiveId, droneIdx) => {
    const s = get();
    const hive = s.world.towerById.get(hiveId);
    if (!hive || hive.kind !== "hive") return;
    if (droneIdx < 0 || droneIdx >= hive.droneCount) return;
    if (hive.droneAssignments[droneIdx] === null) return;
    hive.droneAssignments[droneIdx] = null;
    const newVersion = s.towerVersion + 1;
    set({
      towerVersion: newVersion,
      ui: snapshot(s.world, newVersion, s.treeVersion, s.inspectedEnemy),
    });
  },

  cancelDroneAssignment: () => {
    set({ assigningDroneSlot: null });
  },

  onEvent: (fn) => {
    set((state) => ({ eventListeners: [...state.eventListeners, fn] }));
    return () => {
      set((state) => ({ eventListeners: state.eventListeners.filter((f) => f !== fn) }));
    };
  },

  // ── Debug actions ──────────────────────────────────────────────
  // All only ever called from the debug menu (PauseMenu + WorldMapUI),
  // which themselves only render under isDebug. Vite tree-shakes the
  // call sites in production, leaving these as orphan dead code that
  // gets minified away.
  freeTowers: false,

  debugAddGold: (n) => {
    const s = get();
    s.world.gold += n;
    set({ ui: snapshot(s.world, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  debugSkipWave: () => {
    const s = get();
    const w = s.world;
    // Allow paused too — the buttons live in the pause menu, which only
    // mounts while paused; auto-resume below so the skip is visible.
    if (w.status !== "running" && w.status !== "paused") return;
    // Clear pending spawns + any alive enemies so the current wave
    // immediately resolves; the spawnerTick will then advance to the
    // next wave on its normal schedule.
    w.spawnQueue.length = 0;
    for (const e of w.enemies) e.alive = false;
    // If we're between waves, jump the timer.
    w.nextWaveIn = 0;
    w.midwaveTimer = 0;
    if (w.status === "paused") w.status = "running";
    set({ ui: snapshot(w, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  debugWinLevel: () => {
    const s = get();
    const w = s.world;
    if (w.status !== "running" && w.status !== "paused") return;
    // Mirror the natural win path: clear all enemies + spawn queue,
    // mark the run as won, and emit the game-over event so the
    // results screen + progress recording fire normally.
    w.spawnQueue.length = 0;
    for (const e of w.enemies) e.alive = false;
    w.wave = w.totalWaves;
    w.waveActive = false;
    w.status = "won";
    emit(w, { type: "game-over", won: true });
    set({ ui: snapshot(w, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  debugSetFreeTowers: (on) => {
    set({ freeTowers: on });
  },

  debugTriggerEasterEgg: (defId) => {
    const s = get();
    const w = s.world;
    const def = EASTER_EGG_BY_ID[defId];
    if (!def) return;
    if (def.motion) {
      // Moving eggs (tumbleweed/rover): spawn one from a map edge —
      // user can chase it down.
      spawnMovingEasterEgg(w, defId);
    } else {
      // Static eggs: drop one near the map center so it's findable
      // regardless of biome eligibility, and give it a fresh id.
      w.easterEggs = [
        ...w.easterEggs,
        {
          id: w.nextEntityId++,
          defId,
          pos: { x: 0, y: 0 },
          rotY: Math.random() * Math.PI * 2,
          clickCount: 0,
          triggered: false,
          vel: null,
          despawnAt: null,
          spin: 0,
          rollPitch: 0,
        },
      ];
    }
    set({ ui: snapshot(w, s.towerVersion, s.treeVersion, s.inspectedEnemy) });
  },

  debugSetLevelStars: (levelId, stars) => {
    const s = get();
    const next: ProgressData = {
      ...s.progress,
      starsByLevel: { ...s.progress.starsByLevel },
    };
    if (stars === 0) delete next.starsByLevel[levelId];
    else next.starsByLevel[levelId] = stars;
    // Re-run checks so progress-only achievements (campaign, perfect_run)
    // unlock when stars cross their thresholds via this debug path.
    const res = checkAchievements(next, s.world, null);
    saveProgress(res.progress);
    const newToasts = res.unlocked.map((id) => ({ id, key: nextToastKey++ }));
    set({
      progress: res.progress,
      achievementToasts: [...s.achievementToasts, ...newToasts],
    });
  },

  debugResetProgress: () => {
    const empty: ProgressData = {
      version: 1,
      starsByLevel: {},
      encountered: {},
      stats: { killsTotal: 0, winsTotal: 0 },
      unlocked: {},
    };
    saveProgress(empty);
    set({ progress: empty });
  },
}));
