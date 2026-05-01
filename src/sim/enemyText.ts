import type { EnemyKind } from "./types";

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Aerial swarm",
  para: "Runner",
  allosaur: "Apex predator",
  stego: "Armored grazer",
  armored: "Juggernaut",
  titan: "Colossus",
  medic: "Field healer",
};

export const ENEMY_DESCRIPTION: Record<EnemyKind, string> = {
  raptor: "Fast pack hunter. Low HP but keeps coming — electric chains chew through them.",
  swarm: "Tiny and fragile, but never alone. Electric arcs and AoE shred entire packs.",
  para: "Agile runner with no real weakness. Out-DPS it before it slips through.",
  allosaur: "Apex predator. Balanced resistances — nothing crushes it, but nothing fails either.",
  stego: "Plated hide shrugs off kinetic and explosive. Electric cracks the plates.",
  armored:
    "Juggernaut. Hardened against shock and blast. Kinetic is the only thing that gets through reliably. Heavy slow resistance.",
  titan:
    "Colossus. Resists nearly everything except cold. Heavy slow resistance — every step costs lives.",
  medic:
    "Field healer. Pulses 3 HP/sec to nearby allies in a 3.5u aura. Squishy on its own — kill it first or its escort never dies.",
};
