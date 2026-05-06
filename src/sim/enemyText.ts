import type { EnemyKind } from "./types";

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Aerial swarm",
  para: "Crested runner",
  allosaur: "Apex predator",
  stego: "Armored grazer",
  armored: "Juggernaut",
  titan: "Colossus",
  boss: "Apex matriarch",
};

export const ENEMY_DESCRIPTION: Record<EnemyKind, string> = {
  raptor: "Fast pack hunter. Low HP, high count. Vulnerable to electric.",
  swarm: "Tiny and fragile. Never travels alone. Vulnerable to electric and explosive.",
  para: "Crested runner. Vulnerable to electric, resists flame.",
  allosaur: "Apex predator. Balanced resistance across all damage types.",
  stego: "Plated hide. Resists kinetic and explosive. Vulnerable to electric.",
  armored: "Juggernaut. Vulnerable to kinetic. Resists shock, blast, and flame. Heavy slow resistance.",
  titan: "Colossus. Resists nearly everything except cold. Heavy slow resistance.",
  boss: "Apex matriarch. Resists nearly everything except cold. Heavy slow resistance. High bounty.",
};
