// Meta-progression "skill tree". Stars earned from clearing waves get
// invested between runs from the world map. Each tower kind has three
// independent skill lines, each with three ranks. Ranks apply at tower
// creation — they bake into the tower's base stats so the in-game
// upgrade panel (UPGRADES) continues to scale multiplicatively on top.
//
// Costs are uniform (1 star per rank). Refunds are free: stars aren't
// "spent" in the sense of being consumed, only allocated, so the player
// can re-spec freely from the panel.

import type { Tower, TowerKind } from "./types";
import { HIVE_MAX_DRONES, TOWER_COST } from "./world";

export type MetaSkillId = string;

export type MetaSkillNode = {
  id: MetaSkillId;
  name: string;
  // Short flavor line shown under the title in the panel.
  blurb: string;
  // Plain-text bullet shown for each rank. Reads as a stat line, not a
  // sentence — pairs with the rank-pip strip in the UI.
  rankDesc: [string, string, string];
  // Mutates the tower in place to reflect this node at the given rank.
  // Rank 0 = no-op (caller skips). Implementations write the cumulative
  // value (not additive) so re-spec / preview is idempotent.
  apply: (tower: Tower, rank: number) => void;
  // Returns the gold-cost reduction this node contributes at the given
  // rank. Most nodes return 0; the per-tower "Surplus" nodes return a
  // flat discount applied to TOWER_COST at placement time.
  costReduction?: (rank: number) => number;
};

export type MetaSkillTree = [MetaSkillNode, MetaSkillNode, MetaSkillNode];

const dmgMul = (rank: number, scale: [number, number, number]) => (rank > 0 ? scale[rank - 1] : 1);

// --- Pulse ---------------------------------------------------------------

const PULSE_TREE: MetaSkillTree = [
  {
    id: "pulse.barrel",
    name: "Reinforced Barrel",
    blurb: "Permanent kinetic damage uplift.",
    rankDesc: ["+5% damage", "+10% damage", "+18% damage"],
    apply: (t, r) => {
      t.damage *= dmgMul(r, [1.05, 1.1, 1.18]);
    },
  },
  {
    id: "pulse.spool",
    name: "Quick Action",
    blurb: "Cycles the bolt a touch faster.",
    rankDesc: ["+4% fire rate", "+8% fire rate", "+15% fire rate"],
    apply: (t, r) => {
      t.fireRate *= dmgMul(r, [1.04, 1.08, 1.15]);
    },
  },
  {
    id: "pulse.surplus",
    name: "Surplus Stockpile",
    blurb: "Pulse rifles roll off the line cheaper.",
    rankDesc: ["-3g build cost", "-6g build cost", "-10g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [3, 6, 10][r - 1]),
  },
];

// --- Chain ---------------------------------------------------------------

const CHAIN_TREE: MetaSkillTree = [
  {
    id: "chain.coils",
    name: "Stepped Coils",
    blurb: "Higher base voltage on every arc.",
    rankDesc: ["+5% damage", "+10% damage", "+18% damage"],
    apply: (t, r) => {
      t.damage *= dmgMul(r, [1.05, 1.1, 1.18]);
    },
  },
  {
    id: "chain.arc",
    name: "Wider Arc",
    blurb: "Lightning reaches further targets per shot.",
    rankDesc: ["+1 chain target", "+2 chain targets", "+3 chain targets"],
    apply: (t, r) => {
      if (r > 0) t.chainCount += [1, 2, 3][r - 1];
    },
  },
  {
    id: "chain.surplus",
    name: "Surplus Stockpile",
    blurb: "Coil cores get cheaper to manufacture.",
    rankDesc: ["-3g build cost", "-6g build cost", "-10g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [3, 6, 10][r - 1]),
  },
];

// --- Cryo ---------------------------------------------------------------

const CRYO_TREE: MetaSkillTree = [
  {
    id: "cryo.subzero",
    name: "Subzero Mix",
    blurb: "Pushes the chill closer to a full stop.",
    // slowFactor: lower = slower. Baseline 0.40.
    rankDesc: ["Slow factor 0.37", "Slow factor 0.34", "Slow factor 0.30"],
    apply: (t, r) => {
      if (r > 0) t.slowFactor = [0.37, 0.34, 0.3][r - 1];
    },
  },
  {
    id: "cryo.linger",
    name: "Lingering Frost",
    blurb: "Frost coats the enemy for longer after each pulse.",
    rankDesc: ["+0.2s chill", "+0.4s chill", "+0.7s chill"],
    apply: (t, r) => {
      if (r > 0) t.slowDuration += [0.2, 0.4, 0.7][r - 1];
    },
  },
  {
    id: "cryo.surplus",
    name: "Surplus Stockpile",
    blurb: "Cryo emitters take less coolant per build.",
    rankDesc: ["-5g build cost", "-10g build cost", "-15g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [5, 10, 15][r - 1]),
  },
];

// --- Mortar ---------------------------------------------------------------

const MORTAR_TREE: MetaSkillTree = [
  {
    id: "mortar.shells",
    name: "Heavy Shells",
    blurb: "Denser payload — bigger thump per round.",
    rankDesc: ["+5% damage", "+10% damage", "+18% damage"],
    apply: (t, r) => {
      t.damage *= dmgMul(r, [1.05, 1.1, 1.18]);
    },
  },
  {
    id: "mortar.spread",
    name: "Wide Arc",
    blurb: "Tunes the powder load for a fatter splash.",
    rankDesc: ["+5% splash radius", "+10% splash radius", "+18% splash radius"],
    apply: (t, r) => {
      t.splashRadius *= dmgMul(r, [1.05, 1.1, 1.18]);
    },
  },
  {
    id: "mortar.surplus",
    name: "Surplus Stockpile",
    blurb: "Mortar tubes come straight from the depot.",
    rankDesc: ["-8g build cost", "-15g build cost", "-25g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [8, 15, 25][r - 1]),
  },
];

// --- Pyre (flame) ---------------------------------------------------------

const FLAME_TREE: MetaSkillTree = [
  {
    id: "flame.fuel",
    name: "Volatile Fuel",
    blurb: "Hotter mix — every flame tick bites harder.",
    rankDesc: ["+5% damage", "+10% damage", "+18% damage"],
    apply: (t, r) => {
      t.damage *= dmgMul(r, [1.05, 1.1, 1.18]);
    },
  },
  {
    id: "flame.reach",
    name: "Long Burn",
    blurb: "Pressurises the stream for longer reach.",
    rankDesc: ["+0.3 range", "+0.6 range", "+1.0 range"],
    apply: (t, r) => {
      if (r > 0) t.range += [0.3, 0.6, 1.0][r - 1];
    },
  },
  {
    id: "flame.surplus",
    name: "Surplus Stockpile",
    blurb: "Pyres run on whatever's at hand.",
    rankDesc: ["-5g build cost", "-10g build cost", "-18g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [5, 10, 18][r - 1]),
  },
];

// --- Hive (support) -------------------------------------------------------

const HIVE_TREE: MetaSkillTree = [
  {
    id: "hive.tuned",
    name: "Sturdy Drones",
    blurb: "Drones run hotter without burning out.",
    rankDesc: ["+2% buff per drone", "+4% buff per drone", "+7% buff per drone"],
    apply: (t, r) => {
      if (r > 0) t.serviceBuff += [0.02, 0.04, 0.07][r - 1];
    },
  },
  {
    id: "hive.bay",
    name: "Extra Bay",
    blurb: "Larger hangar — more drones rolling off the rack.",
    rankDesc: ["+0 drone", "+1 drone (4 total)", "+2 drones (5 total)"],
    apply: (t, r) => {
      if (t.kind !== "hive") return;
      const add = [0, 1, 2][r - 1] ?? 0;
      if (add > 0) {
        t.droneCount = Math.min(HIVE_MAX_DRONES, t.droneCount + add);
      }
    },
  },
  {
    id: "hive.surplus",
    name: "Surplus Stockpile",
    blurb: "Cuts the hive's manufacturing overhead.",
    rankDesc: ["-10g build cost", "-20g build cost", "-35g build cost"],
    apply: () => {},
    costReduction: (r) => (r === 0 ? 0 : [10, 20, 35][r - 1]),
  },
];

export const META_SKILL_TREE: Record<TowerKind, MetaSkillTree> = {
  pulse: PULSE_TREE,
  chain: CHAIN_TREE,
  cryo: CRYO_TREE,
  mortar: MORTAR_TREE,
  flame: FLAME_TREE,
  hive: HIVE_TREE,
};

export const MAX_RANK = 3;
export const RANK_COST = 1;

export type MetaSkillRanks = Partial<Record<MetaSkillId, number>>;
export type AllMetaSkills = Partial<Record<TowerKind, MetaSkillRanks>>;

const normalizeRank = (r: unknown): number => {
  if (typeof r !== "number") return 0;
  if (r < 0) return 0;
  if (r > MAX_RANK) return MAX_RANK;
  return Math.floor(r);
};

// Read a rank with safe defaulting. Always returns 0..MAX_RANK.
export const getRank = (meta: AllMetaSkills, kind: TowerKind, nodeId: MetaSkillId): number =>
  normalizeRank(meta[kind]?.[nodeId]);

// Apply every active meta-skill to a freshly created tower. Called once
// at placement time so the bonuses bake into base stats; in-game
// upgrades then stack on top as usual.
export const applyMetaSkillsToTower = (tower: Tower, meta: AllMetaSkills): void => {
  const tree = META_SKILL_TREE[tower.kind];
  const ranks = meta[tower.kind];
  if (!ranks) return;
  for (const node of tree) {
    const r = normalizeRank(ranks[node.id]);
    if (r === 0) continue;
    node.apply(tower, r);
  }
};

// Effective placement cost for a tower kind after stockpile discounts.
// Clamped at 1g floor so an over-invested player still pays something.
export const effectiveTowerCost = (kind: TowerKind, meta: AllMetaSkills): number => {
  const tree = META_SKILL_TREE[kind];
  const ranks = meta[kind] ?? {};
  let discount = 0;
  for (const node of tree) {
    if (!node.costReduction) continue;
    discount += node.costReduction(normalizeRank(ranks[node.id]));
  }
  return Math.max(1, TOWER_COST[kind] - discount);
};

// Total stars currently allocated across the entire meta tree. Used for
// the "X / max" indicator and to compute available stars vs. earned.
export const spentMetaStars = (meta: AllMetaSkills): number => {
  let total = 0;
  for (const kind in meta) {
    const ranks = meta[kind as TowerKind];
    if (!ranks) continue;
    for (const id in ranks) {
      total += normalizeRank(ranks[id]) * RANK_COST;
    }
  }
  return total;
};

// Validates and merges an updated rank into the tree, clamped 0..MAX_RANK.
// Returns a new AllMetaSkills object (immutable update) so the store /
// React state machinery picks up the change.
export const setRank = (
  meta: AllMetaSkills,
  kind: TowerKind,
  nodeId: MetaSkillId,
  rank: number,
): AllMetaSkills => {
  const clamped = normalizeRank(rank);
  const prev = meta[kind] ?? {};
  if (normalizeRank(prev[nodeId]) === clamped) return meta;
  const nextRanks: MetaSkillRanks = { ...prev, [nodeId]: clamped };
  if (clamped === 0) delete nextRanks[nodeId];
  return { ...meta, [kind]: nextRanks };
};

// Refunds every node for the given tower kind back to rank 0. Used by
// the per-tower "reset" button in the panel.
export const resetKindRanks = (meta: AllMetaSkills, kind: TowerKind): AllMetaSkills => {
  if (!meta[kind] || Object.keys(meta[kind] ?? {}).length === 0) return meta;
  const next = { ...meta };
  delete next[kind];
  return next;
};

// Refunds every kind. Used by the panel's master reset.
export const resetAllRanks = (): AllMetaSkills => ({});

export const isMetaSkillsEmpty = (meta: AllMetaSkills): boolean => {
  for (const kind in meta) {
    const ranks = meta[kind as TowerKind];
    if (!ranks) continue;
    for (const id in ranks) {
      if (normalizeRank(ranks[id]) > 0) return false;
    }
  }
  return true;
};
