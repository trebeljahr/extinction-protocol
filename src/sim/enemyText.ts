import type { EnemyKind } from "./types";

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Aerial swarm",
  para: "Runner",
  allosaur: "Apex predator",
  stego: "Armored grazer",
  armored: "Juggernaut",
  titan: "Colossus",
};

export const ENEMY_DESCRIPTION: Record<EnemyKind, string> = {
  raptor: "Fast pack hunter. Low HP but keeps coming — electric chains melt entire groups.",
  swarm: "Tiny and numerous. Only dangerous in crowds. Splash weapons clear them instantly.",
  para: "Agile herbivore with no strong weaknesses. Pressure it with raw damage.",
  allosaur:
    "Apex predator. Balanced resistances — nothing special works, but nothing fails either.",
  stego: "Plated back soaks kinetic hits. Crack them open with explosives.",
  armored: "Juggernaut. Resists most damage; only electric and explosive make a dent.",
  titan:
    "Colossal. Shrugs off anything that isn't cold or brute bombardment. Slow, but every step costs lives.",
};
