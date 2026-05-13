import type { BossVariant, EnemyKind } from "./types";

export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "Pack hunter",
  swarm: "Hatchling swarm",
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
  armored:
    "Juggernaut. Vulnerable to kinetic. Resists shock, blast, and flame. Heavy slow resistance.",
  titan: "Colossus. Resists nearly everything except cold. Heavy slow resistance.",
  boss: "Apex matriarch. Resists nearly everything except cold. Heavy slow resistance. High bounty.",
};

// Per-variant matriarch tagline. Each queen has her own role-defining
// quirk — the description below leans into it so the compendium reads
// like a dossier, not a stats sheet.
export const MATRIARCH_SUBTITLE: Record<BossVariant, string> = {
  raptor: "Forest queen",
  stego: "Snowbound matriarch",
  para: "Desert resonator",
  allosaur: "Wasteland tyrant",
  armored: "Lava juggernaut",
  apex: "Alien colossus",
};

export const MATRIARCH_DESCRIPTION: Record<BossVariant, string> = {
  raptor:
    "Lean and fast. Sprints down the lane and sheds paired swarm hatchlings every 1.2 seconds, spilling around her as she runs. Bring AoE or the pack stacks up. Vulnerable to electric.",
  stego:
    "Heavy plates everywhere; kinetic and explosive slide off. Calves a stego every six seconds. Electric is the only real lever.",
  para: "Hollow crest acts as a resonator — chain damage rings through at 1.7×. Vents flame at 0.4×. Drops a para every 2.2 seconds, fast.",
  allosaur:
    "Balanced apex predator. No hard counter, no free win. Spawns a fresh allosaur every 3.8 seconds and hits harder than the other queens on a leak.",
  armored:
    "Chrome-plated triceratops with heavy slow resistance. Drops an armored every 7.5s — sparse but each child is 300 HP. Electric is the only lever.",
  apex: "Original matriarch. Cold is the only real lever; kinetic bullets scrape, explosives barely tickle. No child stream — the wave brings its own.",
};
