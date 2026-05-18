import type { EnemyKind } from "./types";

type BoltDropSpec = {
  chance: number;
  min: number;
  max: number;
};

// Expected normal-campaign intake through level 15 is roughly 5.5k bolts
// before boss child/trickle spawns: enough for all robot unlocks (2050)
// plus a half tree, or one focused robot's full tree plus its unlock.
const DINO_BOLT_DROPS: Record<EnemyKind, BoltDropSpec> = {
  swarm: { chance: 0.3, min: 1, max: 1 },
  raptor: { chance: 0.45, min: 1, max: 1 },
  para: { chance: 0.7, min: 1, max: 2 },
  allosaur: { chance: 0.9, min: 1, max: 2 },
  stego: { chance: 1, min: 2, max: 3 },
  armored: { chance: 1, min: 3, max: 4 },
  titan: { chance: 1, min: 18, max: 24 },
  boss: { chance: 1, min: 120, max: 180 },
};

export const rollDinoBoltDrop = (kind: EnemyKind): number => {
  const spec = DINO_BOLT_DROPS[kind];
  if (!spec || Math.random() > spec.chance) return 0;
  if (spec.max <= spec.min) return spec.min;
  return spec.min + Math.floor(Math.random() * (spec.max - spec.min + 1));
};

export const expectedDinoBoltDrop = (kind: EnemyKind): number => {
  const spec = DINO_BOLT_DROPS[kind];
  return spec ? spec.chance * ((spec.min + spec.max) / 2) : 0;
};

export const ROBOT_SKILL_BOLT_COST_BY_RANK = [120, 260, 520] as const;

export const robotSkillBoltsForRank = (rank: number): number => {
  const clamped = Math.max(0, Math.min(ROBOT_SKILL_BOLT_COST_BY_RANK.length, Math.floor(rank)));
  let total = 0;
  for (let i = 0; i < clamped; i++) total += ROBOT_SKILL_BOLT_COST_BY_RANK[i];
  return total;
};

export const robotSkillBoltDelta = (fromRank: number, toRank: number): number =>
  robotSkillBoltsForRank(toRank) - robotSkillBoltsForRank(fromRank);
