import type { EnemyKind } from "./types";

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Aerial swarm",
  para: "Runner",
  allosaur: "Apex predator",
  stego: "Armored grazer",
  armored: "Juggernaut",
  titan: "Colossus",
  boss: "Apex matriarch",
};

export const ENEMY_DESCRIPTION: Record<EnemyKind, string> = {
  raptor: "Fast pack hunter. Low HP but keeps coming — electric chains chew through them.",
  swarm: "Tiny and fragile, but never alone. Electric arcs and AoE shred entire packs.",
  para: "Agile runner with no real weakness. Out-DPS it before it slips through.",
  allosaur: "Apex predator. Balanced resistances — nothing crushes it, but nothing fails either.",
  stego: "Plated hide shrugs off kinetic and explosive. Electric cracks the plates.",
  armored:
    "Juggernaut. Hardened against shock and blast — no clear weakness, kinetic and cold both creep through. Heavy slow resistance leaves cryo without its slow.",
  titan:
    "Colossus. Resists nearly everything except cold. Heavy slow resistance — every step costs lives.",
  boss: "Apex matriarch. Shrugs off kinetic, explosive, and flame — only cryo cuts deep. Heavy slow resistance keeps her marching. Pays out a fortune when she falls.",
};
