// Per-robot meta-progression. Each kill drips XP into the robot's own
// pool; level milestones gate skill points while dropped bolts pay rank
// costs in this tree. Mirrors the tower MetaSkill shape (same module
// conventions, same Ranks storage), just keyed on RobotVariant instead
// of TowerKind.
//
// Ranks apply at robot spawn (createWorld) so the in-game numbers stay
// stable for the whole run. Points are allocation-only; bolt costs are
// refunded by the store when ranks decrease, so the ranks stay the
// source of truth for respec value.

import { robotSkillBoltsForRank } from "./robotBolts";
import type { Robot, RobotVariant } from "./types";

export const ROBOT_SKILL_MAX_RANK = 3;
export const ROBOT_POINTS_PER_LEVEL = 1;
// Level 1 starts at 0 points. Each level past 1 awards
// ROBOT_POINTS_PER_LEVEL up to the tree's total capacity (4 nodes × 3
// ranks = 12), so level 13 fully maxes the spendable tree. Levels
// 14-20 still grant the inherent +15 HP/level bonus (see
// robotLevelHpBonus in sim/world.ts) so they remain meaningful even
// once the tree is full.
export const ROBOT_MAX_LEVEL = 20;

export type RobotSkillId = "vitality" | "firepower" | "mobility" | "ultimate";

export type RobotSkillNode = {
  id: RobotSkillId;
  name: string;
  blurb: string;
  rankDesc: [string, string, string];
  apply: (robot: Robot, rank: number) => void;
};

const VITALITY: RobotSkillNode = {
  id: "vitality",
  name: "Reinforced Plating",
  blurb: "Permanent maximum HP boost.",
  rankDesc: ["+25 HP", "+60 HP", "+120 HP"],
  apply: (h, r) => {
    if (r <= 0) return;
    const inc = [25, 60, 120][r - 1] ?? 0;
    h.maxHp += inc;
    h.hp += inc;
  },
};

const FIREPOWER: RobotSkillNode = {
  id: "firepower",
  name: "Targeting Software",
  blurb: "Sustained weapon damage uplift.",
  rankDesc: ["+10% damage", "+22% damage", "+38% damage"],
  apply: (h, r) => {
    if (r <= 0) return;
    h.damage *= [1.1, 1.22, 1.38][r - 1] ?? 1;
  },
};

const MOBILITY: RobotSkillNode = {
  id: "mobility",
  name: "Servo Tuning",
  blurb: "Walks faster between fights.",
  rankDesc: ["+0.5 speed", "+1.1 speed", "+1.8 speed"],
  apply: (h, r) => {
    if (r <= 0) return;
    h.speed += [0.5, 1.1, 1.8][r - 1] ?? 0;
  },
};

const ULTIMATE: RobotSkillNode = {
  id: "ultimate",
  name: "Power Core",
  blurb: "Cuts every ability cooldown.",
  rankDesc: ["-10% cooldowns", "-22% cooldowns", "-35% cooldowns"],
  apply: (h, r) => {
    if (r <= 0) return;
    h.abilityCooldownMul = [0.9, 0.78, 0.65][r - 1] ?? 1;
  },
};

export const ROBOT_SKILL_TREE: readonly RobotSkillNode[] = [
  VITALITY,
  FIREPOWER,
  MOBILITY,
  ULTIMATE,
];

export type RobotSkillRanks = Partial<Record<RobotSkillId, number>>;
export type AllRobotSkills = Partial<Record<RobotVariant, RobotSkillRanks>>;

const norm = (r: unknown): number => {
  if (typeof r !== "number") return 0;
  if (r < 0) return 0;
  if (r > ROBOT_SKILL_MAX_RANK) return ROBOT_SKILL_MAX_RANK;
  return Math.floor(r);
};

export const getRobotRank = (
  skills: AllRobotSkills,
  variant: RobotVariant,
  id: RobotSkillId,
): number => norm(skills[variant]?.[id]);

export const applyRobotSkillsToRobot = (robot: Robot, skills: AllRobotSkills): void => {
  const ranks = skills[robot.variant];
  if (!ranks) return;
  for (const node of ROBOT_SKILL_TREE) {
    const r = norm(ranks[node.id]);
    if (r === 0) continue;
    node.apply(robot, r);
  }
};

export const spentRobotPoints = (skills: AllRobotSkills, variant: RobotVariant): number => {
  let n = 0;
  const ranks = skills[variant];
  if (!ranks) return 0;
  for (const id in ranks) n += norm(ranks[id as RobotSkillId]);
  return n;
};

export const spentRobotSkillBolts = (skills: AllRobotSkills, variant?: RobotVariant): number => {
  let n = 0;
  const variants = variant ? [variant] : (Object.keys(skills) as RobotVariant[]);
  for (const v of variants) {
    const ranks = skills[v];
    if (!ranks) continue;
    for (const id in ranks) n += robotSkillBoltsForRank(norm(ranks[id as RobotSkillId]));
  }
  return n;
};

export const setRobotRank = (
  skills: AllRobotSkills,
  variant: RobotVariant,
  id: RobotSkillId,
  rank: number,
): AllRobotSkills => {
  const clamped = norm(rank);
  const prev = skills[variant] ?? {};
  if (norm(prev[id]) === clamped) return skills;
  const next: RobotSkillRanks = { ...prev, [id]: clamped };
  if (clamped === 0) delete next[id];
  return { ...skills, [variant]: next };
};

export const resetRobotVariantRanks = (
  skills: AllRobotSkills,
  variant: RobotVariant,
): AllRobotSkills => {
  if (!skills[variant]) return skills;
  const next = { ...skills };
  delete next[variant];
  return next;
};

export const resetAllRobotRanks = (): AllRobotSkills => ({});

// Cumulative XP needed to *be at* level n. Level 1 = 0. Each level gap
// is 100 × current level: 1→2 = 100, 2→3 = 200, n→n+1 = 100*n. Yields
// xpForLevel(n) = 50 * n * (n - 1).
export const xpForLevel = (n: number): number => 50 * n * (n - 1);

export const levelForXp = (xp: number): number => {
  if (xp <= 0) return 1;
  // Closed-form for the largest n satisfying 50*n*(n-1) <= xp.
  //   n² - n - xp/50 <= 0
  //   n <= (1 + sqrt(1 + 4*xp/50)) / 2
  const n = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  return Math.max(1, Math.min(ROBOT_MAX_LEVEL, n));
};

export const xpProgressInLevel = (
  xp: number,
): { level: number; into: number; need: number; maxed: boolean } => {
  const level = levelForXp(xp);
  if (level >= ROBOT_MAX_LEVEL) {
    const base = xpForLevel(ROBOT_MAX_LEVEL);
    const into = Math.max(0, xp - base);
    return { level: ROBOT_MAX_LEVEL, into, need: into || 1, maxed: true };
  }
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, need: next - base, maxed: false };
};

// Earned skill points across the run for one variant. Spent points are
// the sum of rank values in the robot's tree.
export const ROBOT_TREE_TOTAL_POINTS = ROBOT_SKILL_TREE.length * ROBOT_SKILL_MAX_RANK;

export const robotSkillPointsAvailable = (
  xp: number,
  ranks: RobotSkillRanks | undefined,
): { earned: number; spent: number; available: number } => {
  const lvl = levelForXp(xp);
  const raw = Math.max(0, (lvl - 1) * ROBOT_POINTS_PER_LEVEL);
  // Cap earned at the tree's total spendable capacity so levels past
  // the fill point don't surface fake unspent points in the UI.
  const earned = Math.min(ROBOT_TREE_TOTAL_POINTS, raw);
  let spent = 0;
  if (ranks) for (const id in ranks) spent += norm(ranks[id as RobotSkillId]);
  return { earned, spent, available: Math.max(0, earned - spent) };
};

// XP awarded for killing one enemy. Scales gently with maxHp so chip
// kills feel meaningful and titan kills are a windfall, but the curve
// flattens past the boss so a single boss kill isn't worth a full
// level.
export const xpForEnemyKill = (maxHp: number): number => {
  const raw = Math.ceil(maxHp / 6);
  return Math.max(1, Math.min(140, raw));
};
