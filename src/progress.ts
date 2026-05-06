import type { EnemyKind } from "./sim/types";

export type Stars = 0 | 1 | 2 | 3;
export type SlotId = 1 | 2 | 3;

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
  extinction: { hp: 1.8, startGold: 0.85, goldKill: 0.85, speed: 1.2 },
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

// Single source of truth for the per-difficulty accent palette so every
// surface that surfaces difficulty (world map, HUD, picker) reads from
// the same hue. Class fragments map to Tailwind utility classes whose
// underlying CSS variables live in src/index.css.
export type DifficultyAccent = {
  text: string;
  border: string;
  tint: string;
};

export const DIFFICULTY_ACCENT: Record<Difficulty, DifficultyAccent> = {
  easy: { text: "text-mint", border: "border-mint", tint: "bg-tint-green" },
  medium: { text: "text-blue", border: "border-blue", tint: "bg-tint-blue" },
  hard: { text: "text-orange", border: "border-orange", tint: "bg-[rgba(255,178,102,0.12)]" },
  extinction: { text: "text-red", border: "border-red", tint: "bg-tint-red" },
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

export type SlotMeta = {
  name: string;
  lastPlayed: number;
};

export type SlotInfo = {
  id: SlotId;
  exists: boolean;
  meta: SlotMeta;
  progress: ProgressData;
  levelsCleared: number;
  totalStars: number;
};

export const SLOT_IDS: readonly SlotId[] = [1, 2, 3] as const;

const slotKey = (id: SlotId) => `extinction-protocol:slot:${id}:v1`;
const LEGACY_KEY = "extinction-protocol:progress:v1";
const STARTING_LIVES = 20;
const NAME_MAX_LEN = 24;

const emptyStats = (): ProgressStats => ({ killsTotal: 0, winsTotal: 0 });

export const emptyProgress = (): ProgressData => ({
  version: 1,
  starsByLevel: {},
  encountered: {},
  stats: emptyStats(),
  unlocked: {},
  difficulty: DEFAULT_DIFFICULTY,
});

const defaultName = (id: SlotId) => `Save ${id}`;

const isDifficulty = (v: unknown): v is Difficulty =>
  typeof v === "string" && (DIFFICULTIES as readonly string[]).includes(v);

const isProgressLike = (parsed: unknown): parsed is Partial<ProgressData> =>
  typeof parsed === "object" &&
  parsed !== null &&
  (parsed as { version?: unknown }).version === 1 &&
  typeof (parsed as { starsByLevel?: unknown }).starsByLevel === "object";

const normalizeProgress = (raw: Partial<ProgressData>): ProgressData => {
  const stats = raw.stats as Partial<ProgressStats> | undefined;
  return {
    version: 1,
    starsByLevel:
      raw.starsByLevel && typeof raw.starsByLevel === "object"
        ? (raw.starsByLevel as Record<number, Stars>)
        : {},
    encountered: (raw.encountered as Partial<Record<EnemyKind, boolean>>) ?? {},
    stats: {
      killsTotal: typeof stats?.killsTotal === "number" ? stats.killsTotal : 0,
      winsTotal: typeof stats?.winsTotal === "number" ? stats.winsTotal : 0,
    },
    unlocked:
      raw.unlocked && typeof raw.unlocked === "object"
        ? (raw.unlocked as Record<string, number>)
        : {},
    difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : DEFAULT_DIFFICULTY,
  };
};

type SlotPayload = { meta: SlotMeta; progress: ProgressData };

const readSlotRaw = (id: SlotId): SlotPayload | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(slotKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { meta?: SlotMeta; progress?: Partial<ProgressData> };
    if (!parsed.progress || !isProgressLike(parsed.progress)) return null;
    const rawName = parsed.meta?.name;
    const meta: SlotMeta = {
      name:
        typeof rawName === "string" && rawName.trim() !== ""
          ? rawName.slice(0, NAME_MAX_LEN)
          : defaultName(id),
      lastPlayed: typeof parsed.meta?.lastPlayed === "number" ? parsed.meta.lastPlayed : 0,
    };
    return { meta, progress: normalizeProgress(parsed.progress) };
  } catch {
    return null;
  }
};

const writeSlotRaw = (id: SlotId, payload: SlotPayload): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(slotKey(id), JSON.stringify(payload));
  } catch {
    // storage full or disabled — silently ignore
  }
};

// Promote a pre-slot save (single-key v1 schema) into slot 1 the first
// time the new build runs. Skipped if slot 1 already has data — the user
// has already started fresh on the new system, so the legacy blob is
// dropped without overwriting their slot 1.
const migrateLegacyToSlot1 = (): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (window.localStorage.getItem(slotKey(1))) {
      window.localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const parsed = JSON.parse(legacy) as Partial<ProgressData>;
    if (!isProgressLike(parsed)) {
      window.localStorage.removeItem(LEGACY_KEY);
      return;
    }
    writeSlotRaw(1, {
      meta: { name: defaultName(1), lastPlayed: Date.now() },
      progress: normalizeProgress(parsed),
    });
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
};

let migrationRun = false;
const ensureMigrated = () => {
  if (migrationRun) return;
  migrationRun = true;
  migrateLegacyToSlot1();
};

export const totalStars = (p: ProgressData): number => {
  let sum = 0;
  for (const s of Object.values(p.starsByLevel)) sum += s;
  return sum;
};

const levelsClearedCount = (p: ProgressData): number => {
  let n = 0;
  for (const s of Object.values(p.starsByLevel)) if (s > 0) n++;
  return n;
};

export const listSlots = (): SlotInfo[] => {
  ensureMigrated();
  return SLOT_IDS.map((id) => {
    const payload = readSlotRaw(id);
    if (!payload) {
      return {
        id,
        exists: false,
        meta: { name: defaultName(id), lastPlayed: 0 },
        progress: emptyProgress(),
        levelsCleared: 0,
        totalStars: 0,
      };
    }
    return {
      id,
      exists: true,
      meta: payload.meta,
      progress: payload.progress,
      levelsCleared: levelsClearedCount(payload.progress),
      totalStars: totalStars(payload.progress),
    };
  });
};

export const loadSlot = (id: SlotId): { progress: ProgressData; meta: SlotMeta } => {
  ensureMigrated();
  const payload = readSlotRaw(id);
  if (payload) return payload;
  return { progress: emptyProgress(), meta: { name: defaultName(id), lastPlayed: 0 } };
};

export const saveSlot = (id: SlotId, progress: ProgressData, name?: string): void => {
  const existing = readSlotRaw(id);
  const nextName = name ?? existing?.meta.name ?? defaultName(id);
  writeSlotRaw(id, {
    meta: { name: nextName, lastPlayed: Date.now() },
    progress,
  });
};

export const deleteSlot = (id: SlotId): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(slotKey(id));
  } catch {
    // ignore
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

// Lower-is-easier comparator. DIFFICULTIES is ordered easy → extinction, so
// the smaller index wins. Used for per-run minimum tracking when the player
// changes difficulty mid-level.
export const minDifficulty = (a: Difficulty, b: Difficulty): Difficulty =>
  DIFFICULTIES.indexOf(a) <= DIFFICULTIES.indexOf(b) ? a : b;
