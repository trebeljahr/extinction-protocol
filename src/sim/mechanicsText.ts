// Compendium "Mechanics" tab — explainers for the layered defensive
// effects that aren't obvious from looking at the enemy stat block.
//
// The prose (label/subtitle/description) is sourced from the i18n catalog at
// src/locales/en/mechanics.json; the Records below are the English view used
// by non-localized consumers. Tints + stat numbers stay here since they are
// not translatable copy. When tuning constants change in world.ts, update
// the numbers here too.

import enMechanics from "../locales/en/mechanics.json";

export type MechanicId = "shielded" | "healAura" | "regen" | "slow" | "adaptation";

export const MECHANIC_ORDER: MechanicId[] = ["shielded", "healAura", "regen", "slow", "adaptation"];

type Entry = { label: string; subtitle: string; description: string };
const cat = enMechanics as Record<MechanicId, Entry>;

const pick = (get: (e: Entry) => string): Record<MechanicId, string> =>
  Object.fromEntries(MECHANIC_ORDER.map((k) => [k, get(cat[k])])) as Record<MechanicId, string>;

export const MECHANIC_LABEL: Record<MechanicId, string> = pick((e) => e.label);
export const MECHANIC_SUBTITLE: Record<MechanicId, string> = pick((e) => e.subtitle);
export const MECHANIC_DESCRIPTION: Record<MechanicId, string> = pick((e) => e.description);

export const MECHANIC_TINT: Record<MechanicId, string> = {
  shielded: "#9fd8ff",
  healAura: "#7eff8a",
  regen: "#a8ffb6",
  slow: "#bfe9ff",
  adaptation: "#ffb266",
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
