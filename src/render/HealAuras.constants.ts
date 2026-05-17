import type { EnemyKind } from "../sim/types";

// Tight body-hug radius per kind — sized to sit just outside the
// silhouette, distinct from the broad HEAL_AURA_RANGE which is the
// actual gameplay heal range and now reads as the wave's terminal arc.
export const HEAL_HUG_RADIUS_BY_KIND: Record<EnemyKind, number> = {
  raptor: 0.6,
  swarm: 0.35,
  para: 0.85,
  allosaur: 1.0,
  stego: 1.0,
  armored: 1.05,
  titan: 2.6,
  boss: 4.2,
};
