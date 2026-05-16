import type { BossVariant, EnemyKind } from "./types";

// Field-note subtitles — observational, terse, scientist's voice.
// Avoid flavor adjectives. Stick to mass, behavior, count, observed risk.
export const ENEMY_SUBTITLE: Record<EnemyKind, string> = {
  raptor: "~80 kg theropod. Travels in groups.",
  swarm: "Juveniles. Disperse on contact, regroup within seconds.",
  para: "Cursor. Sustained sprint observed at 8+ m/s.",
  allosaur: "Adult theropod. Aggressive on sight.",
  stego: "Plated dorsal armor. Slow gait.",
  armored: "Ceratopsian. Reinforced frill, charges through cover.",
  titan: "Sauropod-class. Mass ~12 t. Inertia is the threat.",
  boss: "Reproductive matriarch. Spawns en route.",
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

// Per-variant matriarch field-note. Lead with what's anomalous —
// regional adaptation, reproductive behavior, atypical resistance.
export const MATRIARCH_SUBTITLE: Record<BossVariant, string> = {
  raptor: "Forest-adapted. Sheds juvenile bursts on the move.",
  stego: "Cold-tolerant. Plates intact below freezing.",
  para: "Crest resonates audibly. Amplifies adjacent impact damage.",
  allosaur: "Largest theropod observed. No environmental specialization.",
  armored: "Heat-tolerant. Continues function above 800 °C.",
  apex: "Origin unclear. Earth-biology priors do not apply.",
};

export const MATRIARCH_DESCRIPTION: Record<BossVariant, string> = {
  raptor:
    "Lean and fast. Sprints down the lane and sheds small swarm bursts every 1.25 seconds, spilling around her as she runs. Bring AoE or the pack stacks up. Vulnerable to electric.",
  stego:
    "Heavy plates everywhere; kinetic and explosive slide off. Calves a stego every six seconds. Electric is the only real lever.",
  para: "Hollow crest acts as a resonator — chain damage rings through at 1.7×. Vents flame at 0.4×. Drops a para every 2.2 seconds, fast.",
  allosaur:
    "Balanced apex predator. No hard counter, no free win. Spawns a fresh allosaur every 3.8 seconds and hits harder than the other queens on a leak.",
  armored:
    "Chrome-plated triceratops with heavy slow resistance. Drops an armored every 7.5s — sparse but each child is 300 HP. Electric is the only lever.",
  apex: "Original matriarch. Cold is the only real lever; kinetic bullets scrape, explosives barely tickle. No child stream — the wave brings its own.",
};
