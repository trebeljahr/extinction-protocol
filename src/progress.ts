import type { EnemyKind } from "./sim/types";

export type Stars = 0 | 1 | 2 | 3;

export type ProgressStats = {
  killsTotal: number;
  winsTotal: number;
};

export type Difficulty = "easy" | "medium" | "hard" | "extinction";

export type DifficultyMultipliers = {
  hp: number;
  startGold: number;
  goldKill: number;
  speed: number;
};

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extinction"];

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, DifficultyMultipliers> = {
  easy: { hp: 0.7, startGold: 1.3, goldKill: 1.2, speed: 1.0 },
  medium: { hp: 1.0, startGold: 1.0, goldKill: 1.0, speed: 1.0 },
  hard: { hp: 1.4, startGold: 0.9, goldKill: 0.95, speed: 1.0 },
  extinction: { hp: 1.8, startGold: 0.7, goldKill: 0.85, speed: 1.2 },
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  extinction: "Extinction",
};

export const DIFFICULTY_TAGLINE: Record<Difficulty, string> = {
  easy: "Roam in peace",
  medium: "The intended hunt",
  hard: "Pack pressure",
  extinction: "The asteroid is here",
};

export const DEFAULT_DIFFICULTY: Difficulty = "medium";

export type ProgressData = {
  version: 1;
  starsByLevel: Record<number, Stars>;
  encountered: Partial<Record<EnemyKind, boolean>>;
  stats: ProgressStats;
  unlocked: Record<string, number>;
  difficulty: Difficulty;
};

const STORAGE_KEY = "extinction-protocol:progress:v1";
const STARTING_LIVES = 20;

const emptyStats = (): ProgressStats => ({ killsTotal: 0, winsTotal: 0 });

const empty = (): ProgressData => ({
  version: 1,
  starsByLevel: {},
  encountered: {},
  stats: emptyStats(),
  unlocked: {},
  difficulty: DEFAULT_DIFFICULTY,
});

const isDifficulty = (v: unknown): v is Difficulty =>
  typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);

export const loadProgress = (): ProgressData => {
  if (typeof window === "undefined" || !window.localStorage) return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    if (parsed?.version !== 1 || typeof parsed.starsByLevel !== "object") return empty();
    const rawStats = parsed.stats as Partial<ProgressStats> | undefined;
    const stats: ProgressStats = {
      killsTotal: typeof rawStats?.killsTotal === "number" ? rawStats.killsTotal : 0,
      winsTotal: typeof rawStats?.winsTotal === "number" ? rawStats.winsTotal : 0,
    };
    const unlocked =
      parsed.unlocked && typeof parsed.unlocked === "object"
        ? (parsed.unlocked as Record<string, number>)
        : {};
    const difficulty: Difficulty = isDifficulty(parsed.difficulty)
      ? parsed.difficulty
      : DEFAULT_DIFFICULTY;
    return {
      version: 1,
      starsByLevel: parsed.starsByLevel as Record<number, Stars>,
      encountered: (parsed.encountered as Partial<Record<EnemyKind, boolean>>) ?? {},
      stats,
      unlocked,
      difficulty,
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

export const getStars = (p: ProgressData, levelId: number): Stars => p.starsByLevel[levelId] ?? 0;

export const isLevelUnlocked = (levelId: number, p: ProgressData): boolean => {
  if (levelId <= 1) return true;
  return getStars(p, levelId - 1) >= 1;
};

export const recordLevelResult = (p: ProgressData, levelId: number, stars: Stars): ProgressData => {
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
  const missing = kinds.filter((k) => !p.encountered[k]);
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

export const setDifficulty = (p: ProgressData, difficulty: Difficulty): ProgressData =>
  p.difficulty === difficulty ? p : { ...p, difficulty };

export const getMultipliers = (p: ProgressData): DifficultyMultipliers =>
  DIFFICULTY_MULTIPLIERS[p.difficulty];
