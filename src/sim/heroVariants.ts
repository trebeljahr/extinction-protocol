// Per-mecha variant defaults. The Hero singleton is rebuilt from
// progress.activeHero each level start, so every change to the variant
// here (stats, ability params) lands on the next run automatically.
// Skill-tree ranks layer on top via applyHeroSkillsToHero — variant
// numbers are the "rank 0" baseline.

import type { DamageType, HeroVariant } from "./types";

export const HERO_VARIANTS: readonly HeroVariant[] = ["george", "leela", "mike", "stan"];

// Slot 0 — high-mobility burst that grants i-frames during the lunge.
export type DashSpec = {
  type: "dash";
  cooldown: number;
  duration: number;
  speed: number;
};

// Slot 1 — instant radial AoE around the hero. Damage type varies by
// variant so the burst hits its biggest-resist matchup.
export type BurstSpec = {
  type: "burst";
  cooldown: number;
  radius: number;
  damage: number;
  damageType: DamageType;
};

// Slot 2 — ultimate payload. Discriminated union so the trigger
// dispatcher can fan out to barrage / mark / incinerate without
// extra control flags on Hero.
export type PayloadSpec =
  | {
      type: "barrage";
      cooldown: number;
      count: number;
      range: number;
      damage: number;
      splashRadius: number;
      damageType: DamageType;
    }
  | {
      type: "mark";
      cooldown: number;
      duration: number;
      dmgMul: number;
    }
  | {
      type: "incinerate";
      cooldown: number;
      range: number;
      totalDamage: number;
      duration: number;
      damageType: DamageType;
    };

export type HeroAbilitySpec = DashSpec | BurstSpec | PayloadSpec;

export type HeroVariantSpec = {
  variant: HeroVariant;
  label: string;
  callsign: string;
  blurb: string;
  // Field-report assessment. One line each, terse. Rendered in the
  // compendium under the hero blurb so the player can read a tactical
  // matchup at a glance.
  strengths: string;
  weakness: string;
  maxHp: number;
  speed: number;
  range: number;
  damage: number;
  fireRate: number;
  damageType: DamageType;
  // Per-shot splash for the auto-attack — 0 = single-target projectile,
  // >0 turns each shot into a tight splash hit.
  attackSplashRadius: number;
  unlockStars: number;
  abilities: [DashSpec, BurstSpec, PayloadSpec];
  tint: string;
  // HUD labels per slot — short ASCII glyph picks up from the existing
  // hero panel without bringing in icon assets.
  abilityLabels: [string, string, string];
  abilityGlyphs: [string, string, string];
};

export const HERO_SPECS: Record<HeroVariant, HeroVariantSpec> = {
  george: {
    variant: "george",
    label: "George",
    callsign: "Vanguard",
    blurb: "Balanced sniper mech. Reliable kinetic suppression at midrange.",
    strengths: "Steady midrange kinetic fire. Balanced HP and speed. Barrage clears packs.",
    weakness: "Kinetic-resistant chassis (armored, titan, stego matriarch) shrug off body shots.",
    maxHp: 220,
    speed: 4.5,
    range: 7.0,
    damage: 16,
    fireRate: 2.2,
    damageType: "kinetic",
    attackSplashRadius: 0,
    unlockStars: 0,
    abilities: [
      { type: "dash", cooldown: 5.5, duration: 0.35, speed: 11.0 },
      { type: "burst", cooldown: 10.0, radius: 3.6, damage: 110, damageType: "kinetic" },
      {
        type: "barrage",
        cooldown: 14.0,
        count: 6,
        range: 9.0,
        damage: 26,
        splashRadius: 1.2,
        damageType: "kinetic",
      },
    ],
    tint: "#9fd8ff",
    abilityLabels: ["Combat Dash", "Shockwave", "Barrage"],
    abilityGlyphs: ["»", "✺", "❖"],
  },
  leela: {
    variant: "leela",
    label: "Leela",
    callsign: "Strider",
    blurb: "Fast electric skirmisher. Strips shields, marks targets for bonus damage.",
    strengths: "Highest mobility. Shreds shielded targets. Mark amps follow-up damage 1.7×.",
    weakness: "Thin armor — eats hits at midrange. Electric-resistant titans absorb the kit.",
    maxHp: 170,
    speed: 6.0,
    range: 5.5,
    damage: 11,
    fireRate: 3.5,
    damageType: "electric",
    attackSplashRadius: 0,
    unlockStars: 6,
    abilities: [
      { type: "dash", cooldown: 4.0, duration: 0.45, speed: 13.0 },
      { type: "burst", cooldown: 9.0, radius: 4.0, damage: 70, damageType: "electric" },
      { type: "mark", cooldown: 14.0, duration: 4.0, dmgMul: 1.7 },
    ],
    tint: "#5ad6ff",
    abilityLabels: ["Phase Step", "Static Burst", "Overclock"],
    abilityGlyphs: ["»", "⚡", "◎"],
  },
  mike: {
    variant: "mike",
    label: "Mike",
    callsign: "Pyre",
    blurb: "Close-range flame mech. Splash burn per shot, area-clear ultimate.",
    strengths: "Per-shot splash clears packs. Incinerate deletes whole waves at midrange.",
    weakness: "Short engagement range. Para and armored matriarchs vent flame at ≤0.5×.",
    maxHp: 195,
    speed: 4.2,
    range: 5.5,
    damage: 9,
    fireRate: 4.5,
    damageType: "flame",
    attackSplashRadius: 0.8,
    unlockStars: 12,
    abilities: [
      { type: "dash", cooldown: 5.0, duration: 0.4, speed: 11.0 },
      { type: "burst", cooldown: 11.0, radius: 4.5, damage: 95, damageType: "flame" },
      {
        type: "incinerate",
        cooldown: 16.0,
        range: 8.0,
        totalDamage: 320,
        duration: 4.5,
        damageType: "flame",
      },
    ],
    tint: "#ff8a3a",
    abilityLabels: ["Thruster Burst", "Flame Nova", "Incinerate"],
    abilityGlyphs: ["»", "🔥", "✷"],
  },
  stan: {
    variant: "stan",
    label: "Stan",
    callsign: "Mauler",
    blurb: "Heavy artillery mech. Slow, tanky, every shell detonates on impact.",
    strengths: "Longest range. Every shot splashes. Tankiest chassis (290 HP).",
    weakness: "Slowest mobility — positioning drift hurts. Explosive resist on armored variants.",
    maxHp: 290,
    speed: 3.5,
    range: 8.5,
    damage: 28,
    fireRate: 1.0,
    damageType: "explosive",
    attackSplashRadius: 1.4,
    unlockStars: 20,
    abilities: [
      { type: "dash", cooldown: 7.0, duration: 0.3, speed: 9.5 },
      { type: "burst", cooldown: 9.0, radius: 5.0, damage: 160, damageType: "explosive" },
      {
        type: "barrage",
        cooldown: 14.0,
        count: 10,
        range: 11.0,
        damage: 32,
        splashRadius: 1.6,
        damageType: "explosive",
      },
    ],
    tint: "#ffd24a",
    abilityLabels: ["Ground Pound", "Quake", "Saturation"],
    abilityGlyphs: ["»", "✺", "❖"],
  },
};

export const heroSpec = (variant: HeroVariant): HeroVariantSpec => HERO_SPECS[variant];
