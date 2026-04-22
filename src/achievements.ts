import type { GameEvent, TowerKind, World } from "./sim/types";
import type { ProgressData } from "./progress";
import { getStars } from "./progress";
import { LEVELS } from "./levels";

export type AchievementId =
  | "first_blood"
  | "extermination"
  | "apex_hunter"
  | "veteran"
  | "scholar"
  | "full_arsenal"
  | "fully_armed"
  | "architect"
  | "flawless"
  | "campaign"
  | "perfect_run";

export type AchievementDef = {
  id: AchievementId;
  name: string;
  desc: string;
  hint: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood",   name: "First Blood",       desc: "Eliminate your first invader.",                       hint: "Any kill counts." },
  { id: "extermination", name: "Extermination",     desc: "Eliminate 500 invaders across all runs.",             hint: "Lifetime kills." },
  { id: "apex_hunter",   name: "Apex Hunter",       desc: "Eliminate 2,500 invaders across all runs.",           hint: "Lifetime kills." },
  { id: "veteran",       name: "Veteran",           desc: "Win 10 missions across all runs.",                    hint: "Lifetime mission wins." },
  { id: "scholar",       name: "Scholar",           desc: "Catalog every enemy species.",                        hint: "Encounter all 7 species." },
  { id: "full_arsenal",  name: "Full Arsenal",      desc: "Build all four tower types in a single mission.",     hint: "Pulse + Chain + Cryo + Mortar." },
  { id: "fully_armed",   name: "Fully Armed",       desc: "Fully upgrade both branches of a single tower.",      hint: "Tier 3 on A and B." },
  { id: "architect",     name: "Architect",         desc: "Deploy ten towers in a single mission.",              hint: "Ten standing at once." },
  { id: "flawless",      name: "Flawless",          desc: "Win a mission without losing a single life.",         hint: "All 20 lives intact." },
  { id: "campaign",      name: "Campaign Complete", desc: "Win every mission.",                                  hint: "Clear the whole map." },
  { id: "perfect_run",   name: "Perfect Run",       desc: "Earn three stars on every mission.",                  hint: "Max rating everywhere." },
];

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a]),
) as Record<AchievementId, AchievementDef>;

export const TOTAL_ENEMY_KINDS = 7;

const ALL_TOWER_KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar"];

export const isAchievementUnlocked = (p: ProgressData, id: AchievementId): boolean =>
  p.unlocked[id] !== undefined;

export const totalUnlocked = (p: ProgressData): number =>
  ACHIEVEMENTS.reduce((n, a) => n + (isAchievementUnlocked(p, a.id) ? 1 : 0), 0);

const satisfies = (
  id: AchievementId,
  p: ProgressData,
  w: World,
  ev: GameEvent | null,
): boolean => {
  switch (id) {
    case "first_blood":   return p.stats.killsTotal >= 1;
    case "extermination": return p.stats.killsTotal >= 500;
    case "apex_hunter":   return p.stats.killsTotal >= 2500;
    case "veteran":       return p.stats.winsTotal >= 10;
    case "scholar": {
      let seen = 0;
      for (const k in p.encountered) if (p.encountered[k as keyof typeof p.encountered]) seen++;
      return seen >= TOTAL_ENEMY_KINDS;
    }
    case "full_arsenal": {
      if (w.towers.length < ALL_TOWER_KINDS.length) return false;
      const kinds = new Set(w.towers.map(t => t.kind));
      return ALL_TOWER_KINDS.every(k => kinds.has(k));
    }
    case "fully_armed":
      return w.towers.some(t => t.upgrades.a === 3 && t.upgrades.b === 3);
    case "architect":
      return w.towers.length >= 10;
    case "flawless":
      return ev !== null && ev.type === "game-over" && ev.won && w.lives >= w.startLives;
    case "campaign":
      return LEVELS.every(l => getStars(p, l.id) >= 1);
    case "perfect_run":
      return LEVELS.every(l => getStars(p, l.id) >= 3);
  }
};

export const checkAchievements = (
  progress: ProgressData,
  world: World,
  ev: GameEvent | null,
): { progress: ProgressData; unlocked: AchievementId[] } => {
  let p = progress;
  const unlocked: AchievementId[] = [];
  for (const def of ACHIEVEMENTS) {
    if (isAchievementUnlocked(p, def.id)) continue;
    if (satisfies(def.id, p, world, ev)) {
      p = { ...p, unlocked: { ...p.unlocked, [def.id]: Date.now() } };
      unlocked.push(def.id);
    }
  }
  return { progress: p, unlocked };
};
