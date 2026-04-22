import type { EnemyKind } from "./sim/types";

export type Stars = 0 | 1 | 2 | 3;

export type ProgressData = {
  version: 1;
  starsByLevel: Record<number, Stars>;
  encountered: Partial<Record<EnemyKind, boolean>>;
};

const STORAGE_KEY = "extinction-protocol:progress:v1";
const STARTING_LIVES = 20;

const empty = (): ProgressData => ({ version: 1, starsByLevel: {}, encountered: {} });

export const loadProgress = (): ProgressData => {
  if (typeof window === "undefined" || !window.localStorage) return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    if (parsed?.version !== 1 || typeof parsed.starsByLevel !== "object") return empty();
    return {
      version: 1,
      starsByLevel: parsed.starsByLevel as Record<number, Stars>,
      encountered: (parsed.encountered as Partial<Record<EnemyKind, boolean>>) ?? {},
    };
  } catch {
    return empty();
  }
};

export const saveProgress = (p: ProgressData): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // storage full or disabled — silently ignore
  }
};

export const starsForLives = (lives: number): Stars => {
  if (lives >= STARTING_LIVES) return 3;
  if (lives >= 10) return 2;
  if (lives >= 1) return 1;
  return 0;
};

export const getStars = (p: ProgressData, levelId: number): Stars =>
  p.starsByLevel[levelId] ?? 0;

export const isLevelUnlocked = (levelId: number, p: ProgressData): boolean => {
  if (levelId <= 1) return true;
  return getStars(p, levelId - 1) >= 1;
};

export const recordLevelResult = (
  p: ProgressData,
  levelId: number,
  stars: Stars,
): ProgressData => {
  const prev = getStars(p, levelId);
  if (stars <= prev) return p;
  return {
    ...p,
    starsByLevel: { ...p.starsByLevel, [levelId]: stars },
  };
};

export const totalStars = (p: ProgressData): number => {
  let sum = 0;
  for (const s of Object.values(p.starsByLevel)) sum += s;
  return sum;
};

export const markEncountered = (p: ProgressData, kinds: EnemyKind[]): ProgressData | null => {
  const missing = kinds.filter(k => !p.encountered[k]);
  if (missing.length === 0) return null;
  const next: ProgressData = {
    ...p,
    encountered: { ...p.encountered },
  };
  for (const k of missing) next.encountered[k] = true;
  return next;
};

export const hasEncountered = (p: ProgressData, kind: EnemyKind): boolean =>
  p.encountered[kind] === true;
