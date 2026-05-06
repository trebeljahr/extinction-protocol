import type { TowerKind } from "./types";

export const TOWER_SUBTITLE: Record<TowerKind, string> = {
  pulse: "Direct-fire kinetic",
  chain: "Arc lightning",
  cryo: "Freezing aura",
  mortar: "Splash artillery",
  flame: "Cone of fire",
  hive: "Drone support",
};

export const TOWER_DESCRIPTION: Record<TowerKind, string> = {
  pulse: "Single-shot kinetic rifle. Long range, steady rate.",
  chain: "Arcs lightning between targets. Damage falls off per jump.",
  cryo: "Continuous freezing aura. Negligible damage; the slow is the payload.",
  mortar: "Lobs explosive shells. Generous splash, slow reload.",
  flame: "Forward cone of fire. Short range, high tick rate.",
  hive: "Drones orbit assigned towers and boost their fire rate. Deals no damage.",
};

export const TOWER_BEHAVIOR: Record<TowerKind, string> = {
  pulse:
    "Fires a single round per shot. Path A: damage; T3 ignores resist-chip immunity. Path B: fire rate; +1 range at T3.",
  chain:
    "Hits the primary, then jumps to up to 7 nearby targets within 3.5 tiles. Damage falls 40% per jump (less with upgrades). Path A: more chains; T3 removes falloff. Path B: damage; T3 strips electric resist on hit.",
  cryo: "Aura ticks every ~0.67s. Slows enemies in range to 40% speed for 1.5s. No damage at base. Path A: deeper slow; T3 pauses regen on frozen targets. Path B: range; T3 unlocks a cold-damage AoE.",
  mortar:
    "Lobs an explosive shell at the target. 1.8-tile splash, 0.5 shots/sec. Spot mode pre-sights a chokepoint; shells drop when enemies enter the splash. Path B T3 (Singularity) deals 2× damage to shields.",
  flame:
    "60° forward cone at 5 ticks/sec. Low per-tick, constant. Path A: damage; T3 (Napalm) suppresses regen on hit. Path B: fire rate and range.",
  hive: "Spawns 3 drones; assign them to nearby towers for +30% fire rate each. Path A: up to 6 drones. Path B: buff up to +80%. Idle drones orbit the hive.",
};

export const TOWER_MATCHUPS: Record<TowerKind, string> = {
  pulse:
    "Strong against Triceratops. Workable against Parasaurs, Raptors, and T-Rex. Falls off against other heavies. T3 Annihilator's armor pierce strips resist-chip immunity.",
  chain:
    "Dedicated swarm-killer. Strong against Swarm, Stegosaur, and Raptor. Minimal effect on Triceratops, Apatosaur, and Matriarch.",
  cryo: "Cold is the only effective damage type against Apatosaur and Matriarch. Slow is reduced against Stegosaur, Triceratops, Apatosaur, and Matriarch.",
  mortar:
    "Built for Swarms. Falls off against heavy targets. T3 Singularity is the primary shield-cracker.",
  flame:
    "Strong against Swarms, minimal against heavies. Primary regen counter: T3 Napalm + tick rate keeps regen suppressed.",
  hive: "Amplifies whatever it's assigned to. Strong pairings with Mortar (shield-cracking) and Cryo (faster aura ticks).",
};
