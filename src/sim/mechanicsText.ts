// Compendium "Mechanics" tab — explainers for the layered defensive
// effects that aren't obvious from looking at the enemy stat block.
//
// Copy is sourced from defensive.ts (shield/regen/heal-aura tick rules)
// and types.ts (chip flag descriptions). When tuning constants change in
// world.ts, update the numbers here too.

export type MechanicId =
  | "shielded"
  | "healAura"
  | "regen"
  | "elite"
  | "fierce"
  | "slow"
  | "resists";

export const MECHANIC_ORDER: MechanicId[] = [
  "shielded",
  "healAura",
  "regen",
  "elite",
  "fierce",
  "slow",
  "resists",
];

export const MECHANIC_LABEL: Record<MechanicId, string> = {
  shielded: "Shields",
  healAura: "Healers",
  regen: "Regen",
  elite: "Elite",
  fierce: "Fierce",
  slow: "Slow",
  resists: "Resist Adaptation",
};

export const MECHANIC_TINT: Record<MechanicId, string> = {
  shielded: "#9fd8ff",
  healAura: "#7eff8a",
  regen: "#a8ffb6",
  elite: "#d8b4ff",
  fierce: "#ff5a3a",
  slow: "#bfe9ff",
  resists: "#ffb266",
};

export const MECHANIC_SUBTITLE: Record<MechanicId, string> = {
  shielded: "Energy bubble",
  healAura: "Field medic",
  regen: "Self-heal",
  elite: "Hardened variant",
  fierce: "Berserker",
  slow: "Speed debuff",
  resists: "Per-spawn immunity",
};

export const MECHANIC_DESCRIPTION: Record<MechanicId, string> = {
  shielded: "Blue energy bubble. Absorbs damage before HP. Pool size scales with the host kind.",
  healAura: "Pulsing green ring. Heals nearby allies for 3 HP/sec within 3.5 tiles.",
  regen: "Floating mint-green '+'. Passive 1.5 HP/sec while not taking damage.",
  elite: "Hardened variant of the host kind. Flattened resist spread, increased slow resistance.",
  fierce: "Red glowing halo. +40% damage on exit.",
  slow: "Applied only by Cryo Emitter. Reduces movement speed for the slow duration.",
  resists:
    "Per-spawn damage-type adaptation. Layered on top of base resists, independent of the host kind.",
};

export const MECHANIC_DETAIL: Record<MechanicId, string> = {
  shielded:
    "Damage drains the shield first; overflow touches HP. Broken shields stay down for 4s, then regenerate at 25% max/sec. Mortar T3 (Singularity) deals 2× shield damage. Swarm units never carry shields.",
  healAura:
    "Healers don't heal each other or themselves. Aura is continuous and layers onto any host kind.",
  regen:
    "Pauses for 1.5s after each damage tick. Pyre T3 (Napalm) extends the pause on every hit. Cryo T3 (Cryo Lock) pauses regen for the slow duration.",
  elite:
    "Flattens vulnerabilities and immunities toward 1×. Slow resistance gets +25% (capped at 95%). Damage output unchanged.",
  fierce: "+40% damage on exit. HP and resists unchanged.",
  slow: "Default: 40% speed for 1.5s. Cryo Path A deepens the slow (12% speed, 2.3s at T3). Heavy targets carry built-in slow resistance.",
  resists:
    "Multiplies on top of base resists; flame-immune means 0× damage regardless of tier. Each tower has a T3 that cracks one form of adaptation: Pulse pierces kinetic immunity, Chain strips electric resist on hit, Mortar doubles shield damage, Pyre suppresses regen, Cryo Lock blocks regen during freeze.",
};
