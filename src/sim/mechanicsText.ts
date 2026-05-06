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

// Lead with one-line summary; the body explains tuning + how to counter.
export const MECHANIC_DESCRIPTION: Record<MechanicId, string> = {
  shielded:
    "A blue energy bubble absorbs damage before HP. The shield holds a fixed pool sized to the host kind — 10 on a Raptor, all the way up to 800 on the Matriarch.",
  healAura:
    "A pulsing green ring. Healer units tick HP back into nearby allies (3.5-tile range, 3 HP/sec) every frame they're alive.",
  regen:
    "A floating mint-green '+' above the model. The enemy passively heals 1.5 HP/sec while not under fire.",
  elite:
    "A distinct elite tint on the model. Elites are a hardened variant of any kind — their damage-resist spread is flattened toward 1× and their slow resistance gets a bump.",
  fierce:
    "A red glowing halo. Pure offensive bump — fierce enemies hit for +40% damage when they reach the exit.",
  slow: "Cryo Emitter is the only tower that applies slow. Slowed enemies move at a fraction of their base speed for the slow duration, with a faint blue frost tint that builds up while they're chilled.",
  resists:
    "A per-spawn damage-type adaptation, layered on top of the kind's base resists. Some elite waves spawn enemies that are flat immune to flame, or take 60% reduced electric — irrespective of the kind they're attached to.",
};

export const MECHANIC_DETAIL: Record<MechanicId, string> = {
  shielded:
    "Damage drains the shield first; only the overflow touches HP. Once the shield fully breaks, it stays down for 4 seconds, then regenerates at 25% of max per second — so a 4-second window is everything you have to commit damage. Mortar's T3 (Singularity) deals 2× damage to shields specifically; stack it with a Hive aura for 4× shield damage and the bubble pops in one volley. Swarm units never carry shields regardless of spec — they're too small for the bubble to render.",
  healAura:
    "Healers don't heal each other or themselves, so a stack of healers isn't immortal — focus one down at a time and the rest lose their cover. The aura is continuous and chip-driven, so it can layer onto any kind: a healer-chipped Raptor in a pack of Triceratops pulls the entire wave back to full unless it dies first.",
  regen:
    "Regen pauses for 1.5 seconds after every damage tick, so sustained DPS still works — the chip just makes inefficient damage outright wasted. Two T3 upgrades shut regen off entirely: Pyre T3 (Napalm) extends the pause on every hit, and Cryo T3 (Cryo Lock) pauses regen for the full slow duration. Without one of those, anything chipped with regen will heal through low-pressure lanes.",
  elite:
    "Elite flattens both vulnerabilities and immunities — a Stego that took 1.7× from electric only takes ~1.6× as elite, and one that resisted explosive at 0.6× now takes ~0.66×. Slow resistance gets a +25% bump (capped at 95%), so cryo struggles harder against elite heavies. Doesn't make the enemy hit harder — it just slows the kill.",
  fierce:
    "+40% damage on contact — what would be a 3-damage hit is now 4. Doesn't change HP or resists; the danger is purely on the exit. A fierce-chipped Apatosaur still costs 5 lives but each one bites harder, so a single leak in a fierce wave can end a run on its own.",
  slow: "Default slow is 40% speed for 1.5s. Cryo Path A deepens the chill (down to 12% speed at T3, with 2.3s duration). Stegos and the heavy lineup carry built-in slow resistance — Triceratops at 75% means a 'crawl' becomes a brisk walk. Pair Cryo with high-DPS towers behind it: the slow exists to give them more time on target, not as damage in itself.",
  resists:
    "Adaptation chips multiply on top of base resists, so a flame-immune Triceratops takes 0× from Pyre regardless of upgrade tier. Each tower has a T3 anti-modifier that cracks one form of adaptation: Pulse pierces resist-chip immunity to kinetic, Chain T3 strips electric resist 10% per hit, Mortar doubles shield damage, Pyre suppresses regen, Cryo Lock blocks regen during freeze. A wave's resist chip is a hint you need a different damage type or a T3 to bypass it.",
};
