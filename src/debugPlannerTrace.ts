import type { Difficulty } from "./progress";
import {
  type AllMetaSkills,
  BRANCH_IDS,
  type BranchId,
  branchSpent,
  MAX_TIER,
  type MetaBranchTiers,
  TIER_COST,
} from "./sim/metaSkills";
import {
  type AllRobotSkills,
  ROBOT_MAX_LEVEL,
  ROBOT_SKILL_MAX_RANK,
  type RobotSkillId,
  xpForLevel,
} from "./sim/robotSkills";
import type { RobotVariant, TowerKind, Vec2 } from "./sim/types";

export type PlannerTraceUpgrade = { wave: number; branch: "a" | "b"; tier: 1 | 2 | 3 };

export type PlannerPlannedTower = {
  id: number;
  kind: TowerKind;
  lanes: number[];
  anchor: Vec2;
  builtAtWave: number;
  upgrades: PlannerTraceUpgrade[];
  finalTierA: number;
  finalTierB: number;
};

export type PlannerWaveAction =
  | { type: "build"; towerId: number; kind: TowerKind; lanes: number[]; anchor: Vec2; cost: number }
  | {
      type: "upgrade";
      towerId: number;
      kind: TowerKind;
      branch: "a" | "b";
      tier: 1 | 2 | 3;
      cost: number;
    };

export type PlannerWaveTrace = {
  wave: number;
  archetype: string;
  reqDpsByLane: number[];
  dpsAfterByLane: number[];
  spentThisWave: number;
  goldIn: number;
  goldOut: number;
  cleared: boolean;
  actions: PlannerWaveAction[];
};

export type PlannerTrace = {
  schemaVersion: 1;
  levelId: number;
  levelName: string;
  difficulty: Difficulty;
  safety: number;
  beamWidth: number;
  suggestedRobot: RobotVariant;
  suggestedRobotReason: string;
  effectiveStartGold: number;
  finalPortfolio: string;
  totalSpent: number;
  success: boolean;
  failedAt?: number;
  plannedTowers: PlannerPlannedTower[];
  waves: PlannerWaveTrace[];
};

export type SuggestedDebugLoadout = {
  metaSkills: AllMetaSkills;
  activeRobot: RobotVariant;
  robotXp: Partial<Record<RobotVariant, number>>;
  robotSkills: AllRobotSkills;
  robotUnlocks: Partial<Record<RobotVariant, boolean>>;
  summary: string;
};

const ROBOT_SKILL_PRIORITY: RobotSkillId[] = ["firepower", "ultimate", "vitality", "mobility"];

export const fetchPlannerTrace = async (
  levelId: number,
  difficulty: Difficulty,
): Promise<PlannerTrace | null> => {
  const res = await fetch(`/balancing-traces/level-${levelId}-${difficulty}.json`);
  if (!res.ok) return null;
  const trace = (await res.json()) as Partial<PlannerTrace>;
  if (trace.schemaVersion !== 1 || trace.levelId !== levelId || trace.difficulty !== difficulty) {
    return null;
  }
  if (!Array.isArray(trace.plannedTowers) || !Array.isArray(trace.waves)) return null;
  return trace as PlannerTrace;
};

const defaultTowerStarBudget = (levelId: number): number =>
  Math.min(21, Math.max(0, 5 * (levelId - 1)));

const defaultRobotSkillBudget = (levelId: number): number =>
  Math.min(12, Math.max(0, 3 * (levelId - 1)));

const tierWithBudget = (currentTier: number, budget: number): { tier: number; spent: number } => {
  let tier = currentTier;
  let spent = 0;
  while (tier < MAX_TIER && TIER_COST[tier] <= budget - spent) {
    spent += TIER_COST[tier];
    tier += 1;
  }
  return { tier, spent };
};

const allocateTowerLabs = (
  budget: number,
  priority: readonly BranchId[],
): MetaBranchTiers | null => {
  if (budget <= 0) return null;
  const tiers: MetaBranchTiers = {};
  let remaining = budget;

  for (const branch of priority) {
    const before = tiers[branch] ?? 0;
    const next = tierWithBudget(before, remaining);
    if (next.tier > 0) tiers[branch] = next.tier;
    remaining -= next.spent;
    if (remaining <= 0) break;
  }

  while (remaining > 0) {
    let changed = false;
    for (const branch of priority) {
      const before = tiers[branch] ?? 0;
      if (before >= MAX_TIER) continue;
      const cost = TIER_COST[before];
      if (cost > remaining) continue;
      tiers[branch] = before + 1;
      remaining -= cost;
      changed = true;
      if (remaining <= 0) break;
    }
    if (!changed) break;
  }

  return Object.keys(tiers).length > 0 ? tiers : null;
};

const branchPriorityFor = (towers: PlannerPlannedTower[]): BranchId[] => {
  let aScore = 0;
  let bScore = 0;
  for (const tower of towers) {
    aScore += tower.finalTierA + tower.upgrades.filter((u) => u.branch === "a").length;
    bScore += tower.finalTierB + tower.upgrades.filter((u) => u.branch === "b").length;
  }
  const first: BranchId = bScore > aScore ? "b" : "a";
  const second: BranchId = first === "a" ? "b" : "a";
  return [first, second, "c"];
};

const buildSuggestedMetaSkills = (trace: PlannerTrace): AllMetaSkills => {
  const budget = defaultTowerStarBudget(trace.levelId);
  if (budget <= 0) return {};
  const byKind = new Map<TowerKind, PlannerPlannedTower[]>();
  for (const tower of trace.plannedTowers) {
    const list = byKind.get(tower.kind);
    if (list) list.push(tower);
    else byKind.set(tower.kind, [tower]);
  }

  const out: AllMetaSkills = {};
  for (const [kind, towers] of byKind) {
    const tiers = allocateTowerLabs(budget, branchPriorityFor(towers));
    if (tiers) out[kind] = tiers;
  }
  return out;
};

const buildSuggestedRobotSkills = (
  trace: PlannerTrace,
): { xp: number; skills: AllRobotSkills; level: number } => {
  let remaining = defaultRobotSkillBudget(trace.levelId);
  const ranks: Partial<Record<RobotSkillId, number>> = {};
  for (const id of ROBOT_SKILL_PRIORITY) {
    if (remaining <= 0) break;
    const rank = Math.min(ROBOT_SKILL_MAX_RANK, remaining);
    ranks[id] = rank;
    remaining -= rank;
  }
  const spent = Object.values(ranks).reduce((sum, rank) => sum + (rank ?? 0), 0);
  const level = Math.min(ROBOT_MAX_LEVEL, spent + 1);
  return {
    xp: xpForLevel(level),
    skills: spent > 0 ? { [trace.suggestedRobot]: ranks } : {},
    level,
  };
};

export const deriveSuggestedDebugLoadout = (trace: PlannerTrace): SuggestedDebugLoadout => {
  const metaSkills = buildSuggestedMetaSkills(trace);
  const robot = buildSuggestedRobotSkills(trace);
  const labSummary =
    Object.entries(metaSkills)
      .map(([kind, tiers]) => {
        const parts = BRANCH_IDS.map((branch) => {
          const tier = tiers?.[branch] ?? 0;
          return tier > 0 ? `${branch}${tier}` : "";
        }).filter(Boolean);
        const spent = BRANCH_IDS.reduce(
          (sum, branch) => sum + branchSpent(tiers?.[branch] ?? 0),
          0,
        );
        return `${kind}:${parts.join("/") || "0"}(${spent})`;
      })
      .join(", ") || "no lab tiers";
  const robotRanks = robot.skills[trace.suggestedRobot];
  const robotSummary = robotRanks
    ? ROBOT_SKILL_PRIORITY.map((id) => `${id}:${robotRanks[id] ?? 0}`).join("/")
    : "no robot skills";

  return {
    metaSkills,
    activeRobot: trace.suggestedRobot,
    robotXp: { [trace.suggestedRobot]: robot.xp },
    robotSkills: robot.skills,
    robotUnlocks: { [trace.suggestedRobot]: true },
    summary: `${trace.suggestedRobot} L${robot.level}; ${robotSummary}; labs ${labSummary}`,
  };
};
