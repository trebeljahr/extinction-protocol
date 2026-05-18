// Compendium "Mechanics" tab — explainers for the layered defensive
// effects that aren't obvious from looking at the enemy stat block.
//
// Copy is sourced from defensive.ts (shield/regen/heal-aura tick rules)
// and types.ts (chip flag descriptions). When tuning constants change in
// world.ts, update the numbers here too.

export type MechanicId = "shielded" | "healAura" | "regen" | "slow" | "adaptation";

export const MECHANIC_ORDER: MechanicId[] = ["shielded", "healAura", "regen", "slow", "adaptation"];

export const MECHANIC_LABEL: Record<MechanicId, string> = {
  shielded: "Shields",
  healAura: "Healers",
  regen: "Regen",
  slow: "Slow",
  adaptation: "Adaptation",
};

export const MECHANIC_TINT: Record<MechanicId, string> = {
  shielded: "#9fd8ff",
  healAura: "#7eff8a",
  regen: "#a8ffb6",
  slow: "#bfe9ff",
  adaptation: "#ffb266",
};

export const MECHANIC_SUBTITLE: Record<MechanicId, string> = {
  shielded: "Energy bubble",
  healAura: "Field medic",
  regen: "Self-heal",
  slow: "Speed debuff",
  adaptation: "Evolved resistance",
};

export const MECHANIC_DESCRIPTION: Record<MechanicId, string> = {
  shielded: "Blue energy bubble. Absorbs damage before HP. Pool size scales with the host kind.",
  healAura: "Pulsing green ring. Heals nearby allies for 3 HP/sec within 3.5 tiles.",
  regen: "Floating mint-green '+'. Passive 1.5 HP/sec while not taking damage.",
  slow: "Applied only by Cryo Emitter. Reduces movement speed for the slow duration.",
  adaptation:
    "Lean too hard on one damage type and the herd evolves. Starting at level 12, a share of each wave spawns with hardened resistance against the damage type you've dealt the most over the last 3 waves — the more concentrated your portfolio, the higher the share and the deeper the resistance (up to effective immunity). Adapted spawns carry an off-color body tint so you can read the threat at a glance. Counter: diversify your towers or lean on a T3 anti-modifier branch.",
};

// Compact key numbers per mechanic — rendered as a 3-cell stat grid in
// the compendium so the visual + a number row replaces the long "How
// it works" prose this used to carry. The 3D MechanicPreview shows
// what the effect looks like in-game; this row gives the tuning at a
// glance. Kept tight on purpose — push longer detail into per-tower
// text or upgrade tooltips, not back into here.
export const MECHANIC_STATS: Record<MechanicId, [string, string][]> = {
  shielded: [
    ["Pool", "10–800 HP"],
    ["Break", "4s"],
    ["Regen", "25%/s"],
  ],
  healAura: [
    ["Range", "3.5 tiles"],
    ["Rate", "3 HP/s"],
    ["Self-heal", "no"],
  ],
  regen: [
    ["Rate", "1.5 HP/s"],
    ["Pause", "1.5s on hit"],
    ["Counters", "Pyre T3 · Cryo T3"],
  ],
  slow: [
    ["Default", "40% speed"],
    ["Duration", "1.5s"],
    ["Source", "Cryo only"],
  ],
  adaptation: [
    ["Triggers", "L12+"],
    ["Max boost", "95%"],
    ["Window", "3 waves"],
  ],
};
