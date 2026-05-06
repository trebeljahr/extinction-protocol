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
  pulse:
    "Single-shot kinetic rifle. Long range, steady fire rate, no frills — every wave starts here.",
  chain:
    "Coil that arcs lightning between targets. One shot becomes eight hits, with each jump dealing less damage. Made for swarms.",
  cryo: "Continuous freezing aura. Damage is minimal — the value is the slow. Anything caught in the ring crawls.",
  mortar:
    "Lobs explosive shells with generous splash. High burst damage, slow reload. Aim it at the lane chokepoint.",
  flame:
    "Forward cone of fire. Short range and a tight spread, but it sprays five times a second across everything in front of it.",
  hive: "Pure support. Launches drones that orbit assigned towers and crank up their fire rate. Can't damage anything itself.",
};

export const TOWER_BEHAVIOR: Record<TowerKind, string> = {
  pulse:
    "Fires a single kinetic round at the target every shot. Path A piles on damage and ends with armor pierce — its T3 ignores the flame-immunity / resist-chip adaptations layered on elite spawns. Path B trades damage for fire rate and an extra range tile at T3.",
  chain:
    "Each shot hits the primary, then jumps to up to 7 nearby targets within 3.5 tiles, losing 40% of its damage on each jump (less with upgrades). Path A adds chain count and removes falloff entirely at T3 — late game it's effectively an AoE. Path B pumps damage; T3 strips electric resist on hit, peeling a fully-immune target back to neutral over ~10 jumps.",
  cryo: "Aura ticks every ~0.67s, slowing every enemy in range to 40% speed for 1.5s. No damage at base — Path B T3 unlocks a 16-cold-damage AoE. Path A deepens the slow toward a near-halt and at T3 pauses regen on anything frozen — one of two ways the game lets you shut off regen entirely.",
  mortar:
    "Lobs an explosive shell at the target's current position. 1.8-tile splash radius, 0.5 shots/sec — slow but heavy. Has a unique 'spot' targeting mode: pre-sight a chokepoint and the shell drops there whenever something walks into the splash. Path B T3 (Singularity) deals 2× damage to shields, making it the game's primary shield-cracker.",
  flame:
    "Sprays a 60° cone forward at 5 ticks/sec. Damage is small per tick but constant — anything that lingers in the stream burns down fast. Path A T3 (Napalm) suppresses regen for 1.5s on every hit, which at flame's tick rate keeps regen permanently off. Path B stacks fire rate and range.",
  hive: "Doesn't shoot. Spawns 3 drones that you assign to nearby towers; each assigned drone gives that tower +30% fire rate. Path A adds drones (up to 6 total) — more towers can be buffed at once. Path B cranks the per-drone buff up to +80%. Idle drones orbit the hive itself.",
};

export const TOWER_MATCHUPS: Record<TowerKind, string> = {
  pulse:
    "Solid against Parasaurs (slight kinetic vulnerability) and neutral against Raptors and T-Rex. Bounces hard off Stegos, Triceratops, Apatosaurs, and the Matriarch — late-game heavies need something else. T3 Annihilator's armor pierce undoes flame/electric immunity chips, so a single Pulse can clean up adapted spawns even if its base damage is mediocre.",
  chain:
    "The dedicated swarm-killer: Swarm units take 2×, Stegos take 1.7×, Raptors take 1.5×. Falls off against Triceratops (0.5×), and only chips Apatosaurs / the Matriarch. Save it for clusters; ignore it for the lone Apatosaur.",
  cryo: "Cold is the only damage type the Apatosaur (1.3×) and Matriarch (1.5×) actually fear, so a Cryo with Absolute Zero is one of the few real boss answers. The slow itself is half-effective against Stegos (35% slow resist), badly against Triceratops (75%), Apatosaurs (50%), and the Matriarch (60%) — they crawl, but not as much as a Raptor would.",
  mortar:
    "Built for Swarms (1.7× explosive). Neutral on T-Rex, mediocre on Raptors and Parasaurs, and increasingly bad as enemies get heavier — Apatosaurs take 0.35×, the Matriarch 0.3×. Where it really earns its slot is shields: T3 Singularity at 2× shield damage, stacked with a Hive aura, cracks shielded heavies in seconds.",
  flame:
    "Same explosive-vs-flame resist spread as Mortar — devastating to Swarms, minimal against heavies. Its real role is regen counter: T3 Napalm + flame's tick rate locks regen off entirely, which is what you want against a regen-chipped Allosaur or Stego that would otherwise heal through your DPS.",
  hive: "No matchups of its own — it amplifies whatever you point it at. Pairs especially well with Mortar (turning slow shells into shield-crackers) and Cryo (steady aura ticks pile up faster) since both benefit disproportionately from a fire-rate buff.",
};
