// Per-mecha variant defaults. The Hero singleton is rebuilt from
// progress.activeHero each level start, so every change to the variant
// here (stats, ability params) lands on the next run automatically.
// Skill-tree ranks layer on top via applyHeroSkillsToHero — variant
// numbers are the "rank 0" baseline.

import type { DamageType, HeroVariant } from "./types";

export const HERO_VARIANTS: readonly HeroVariant[] = ["george", "leela", "mike", "stan"];

// Slot 0 — high-mobility burst that grants i-frames during the lunge.
// Optional riders give each pilot a distinct dash payoff: George flags
// the next auto-attack as a crit, Leela emits chain lightning at lunge
// end, Stan detonates an explosion at landing position.
export type DashSpec = {
  type: "dash";
  cooldown: number;
  duration: number;
  speed: number;
  nextShotCrit?: { mul: number; pierce: boolean };
  endChain?: { hops: number; damagePerHop: number; radius: number; damageType: DamageType };
  landingBlast?: { radius: number; damage: number; damageType: DamageType };
};

// Slot 1 — instant radial AoE around the hero. Damage type varies by
// variant so the burst hits its biggest-resist matchup.
// Optional riders: Leela's burst forks chain lightning beams to extra
// targets; Mike's burst applies a burn DoT to every enemy hit; Stan's
// burst nudges enemies backwards along the path.
export type BurstSpec = {
  type: "burst";
  cooldown: number;
  radius: number;
  damage: number;
  damageType: DamageType;
  chainHops?: { hops: number; damagePerHop: number; radius: number };
  burn?: { duration: number; totalDamage: number };
  knockback?: { pathPush: number };
};

// Slot 2 — variant-flavoured self-buff. Multiplies the hero's own stats
// for a window so each pilot has an identity-fitting "third gear" between
// dash + burst + ultimate. Damage type isn't carried — the buff just
// modulates outgoing damage / fire rate / move speed / damage resist.
// Optional riders: George's Spotter Drone multiplies range too; Mike's
// Ignition tags every auto-attack with a short burn DoT.
export type BuffSpec = {
  type: "buff";
  cooldown: number;
  duration: number;
  damageMul: number;
  fireRateMul: number;
  speedMul: number;
  // 0..1 fraction of incoming damage absorbed (1 = invuln).
  damageResist: number;
  rangeMul?: number;
  igniteOnHit?: { duration: number; totalDamage: number };
};

// Slot 3 — ultimate payload. Discriminated union so the trigger
// dispatcher can fan out to barrage / mark / incinerate / pierce /
// killshot without extra control flags on Hero.
export type PayloadSpec =
  | {
      type: "barrage";
      cooldown: number;
      count: number;
      range: number;
      damage: number;
      splashRadius: number;
      damageType: DamageType;
      // Stan: each shell leaves a lingering crater (tickDamage every
      // tickInterval seconds for `duration`).
      crater?: { duration: number; tickDamage: number; radius: number; tickInterval: number };
    }
  | {
      type: "mark";
      cooldown: number;
      duration: number;
      dmgMul: number;
      // Leela: every interval seconds, arc damage hits every marked
      // enemy via beam. Marked enemies live in hero.arcTargets[].
      arcTick?: { interval: number; damage: number; radius: number; damageType: DamageType };
    }
  | {
      type: "incinerate";
      cooldown: number;
      range: number;
      totalDamage: number;
      duration: number;
      damageType: DamageType;
    }
  | {
      // George R — locks the highest-progress enemy in range, charges
      // for chargeTime seconds, then deletes it with splash at impact.
      type: "killshot";
      cooldown: number;
      range: number;
      chargeTime: number;
      damage: number;
      splashDamage: number;
      splashRadius: number;
      damageType: DamageType;
    };

export type HeroAbilitySpec = DashSpec | BurstSpec | BuffSpec | PayloadSpec;

// Per-hero auto-attack rider. Each shot can also chain to nearby
// enemies (Leela), draw a tracer beam (George), or apply burn DoT
// during a buff window (Mike — driven by buff.igniteOnHit instead).
export type AttackChainSpec = {
  hops: number;
  damagePerHop: number;
  radius: number;
};

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
  // Optional auto-attack chain (Leela). Each shot, after its primary hit,
  // forks lightning beams to up to `hops` nearby enemies for damagePerHop.
  attackChain?: AttackChainSpec;
  // Render hint — when true, every auto-attack draws a hitscan tracer
  // beam from the hero to the target instead of (or alongside) the
  // projectile. George uses this for the sniper read.
  attackTracer?: boolean;
  unlockStars: number;
  abilities: [DashSpec, BurstSpec, BuffSpec, PayloadSpec];
  tint: string;
  // HUD labels per slot (Q/W/E/R). Short ASCII glyph picks up from the
  // existing hero panel without bringing in icon assets.
  abilityLabels: [string, string, string, string];
  abilityGlyphs: [string, string, string, string];
  // Per-slot tooltip blurb shown in the shop and HUD. Length 5: the
  // first entry describes the auto-attack ("Basic Attack"), the next
  // four describe Q/W/E/R. Hero-specific so each card reads as a
  // distinct ability rather than a generic burst/dash/etc.
  abilityBlurbs: [string, string, string, string, string];
};

export const HERO_SPECS: Record<HeroVariant, HeroVariantSpec> = {
  george: {
    variant: "george",
    label: "George",
    callsign: "Vanguard",
    blurb: "Long-range kinetic sniper. Slow, deliberate, every shot a tracer that pierces armor.",
    strengths:
      "Longest engagement range. Massive single-shot damage. Killshot deletes priority threats.",
    weakness:
      "Slow fire cadence — packs of swarmers slip past between shots. Kinetic-resistant armored chassis shrug body hits.",
    maxHp: 200,
    speed: 4.0,
    range: 10.5,
    damage: 42,
    fireRate: 0.8,
    damageType: "kinetic",
    attackSplashRadius: 0,
    attackTracer: true,
    unlockStars: 0,
    abilities: [
      // Q — Sidestep: short lateral hop; flags the next auto-attack as a
      // piercing crit that ignores splash falloff and lands ×2.5 damage.
      {
        type: "dash",
        cooldown: 5.5,
        duration: 0.3,
        speed: 12.0,
        nextShotCrit: { mul: 2.5, pierce: true },
      },
      // W — Pierce Shot: kinetic lance through a long thin rectangle.
      // Stored under "burst" slot but is a directional pierce, not radial.
      // We use the pierce payload type but in slot 1.
      // (Schema-wise still a Burst slot — but we re-purpose with the
      // pierce payload type by storing it as a new burst-shaped entry
      // is awkward; instead leave slot 1 as the kinetic shockwave that
      // briefly knocks back, and route the pierce shot into slot 3 R.)
      //
      // Decision: keep W as a radial kinetic shockwave for synergy with
      // Sidestep's i-frame ringout. Pierce becomes the R slot.
      {
        type: "burst",
        cooldown: 9.0,
        radius: 3.0,
        damage: 95,
        damageType: "kinetic",
        knockback: { pathPush: 0.9 },
      },
      // E — Spotter Drone: scope-in stance. Big damage + range + slow.
      {
        type: "buff",
        cooldown: 12.0,
        duration: 5.0,
        damageMul: 1.8,
        fireRateMul: 0.85,
        speedMul: 0.5,
        damageResist: 0.4,
        rangeMul: 1.6,
      },
      // R — Killshot: locks the strongest enemy in range, charges, then
      // deletes them with massive damage + splash at impact.
      {
        type: "killshot",
        cooldown: 18.0,
        range: 14.0,
        chargeTime: 1.2,
        damage: 600,
        splashDamage: 200,
        splashRadius: 2.5,
        damageType: "kinetic",
      },
    ],
    tint: "#9fd8ff",
    abilityLabels: ["Sidestep", "Shockwave", "Spotter Drone", "Killshot"],
    abilityGlyphs: ["»", "✺", "◎", "✦"],
    abilityBlurbs: [
      "Hitscan kinetic sniper rifle. Tracer beam draws to target — long range, slow cadence, very high per-shot damage. No splash.",
      "Lateral hop with i-frames. The next auto-attack lands as a piercing crit (×2.5 damage). Use to slip a grapple and answer with a body shot.",
      "Kinetic shockwave centered on the hero. Heavy single-pulse damage and a short push that knocks enemies back along the path.",
      "Scope-in stance: +60% range, +80% damage, –15% fire rate, –50% speed, 40% resist for 5s. Hold the line and snipe.",
      "Lock the highest-progress enemy in 14 range, charge 1.2s, then delete it. Splash damage detonates at the impact point — clears the escort too.",
    ],
  },
  leela: {
    variant: "leela",
    label: "Leela",
    callsign: "Strider",
    blurb: "Electric skirmisher. Every shot chains. Marks light up the field with persistent arcs.",
    strengths:
      "Highest mobility. Auto-attacks chain to a nearby second target. Overcharge mark hits up to 5 enemies on a steady tick.",
    weakness: "Thin armor — eats hits at midrange. Electric-resistant titans absorb the kit.",
    maxHp: 170,
    speed: 6.0,
    range: 5.5,
    damage: 9,
    fireRate: 4.5,
    damageType: "electric",
    attackSplashRadius: 0,
    attackChain: { hops: 1, damagePerHop: 6, radius: 2.4 },
    unlockStars: 6,
    abilities: [
      // Q — Phase Step: forward dash, on lunge end arcs to 3 closest dinos.
      {
        type: "dash",
        cooldown: 4.0,
        duration: 0.4,
        speed: 13.0,
        endChain: { hops: 3, damagePerHop: 24, radius: 3.5, damageType: "electric" },
      },
      // W — Tesla Pulse: radial blast that forks beams to 4 more targets.
      {
        type: "burst",
        cooldown: 9.0,
        radius: 4.0,
        damage: 70,
        damageType: "electric",
        chainHops: { hops: 4, damagePerHop: 35, radius: 6.0 },
      },
      // E — Phase Veil: hit-and-run buff. Pure mobility + offence.
      {
        type: "buff",
        cooldown: 13.0,
        duration: 3.0,
        damageMul: 1.15,
        fireRateMul: 1.6,
        speedMul: 1.7,
        damageResist: 0.8,
      },
      // R — Overcharge: marks up to 5 nearby dinos for 5s; tick arcs each.
      {
        type: "mark",
        cooldown: 14.0,
        duration: 5.0,
        dmgMul: 1.5,
        arcTick: { interval: 0.5, damage: 22, radius: 8.0, damageType: "electric" },
      },
    ],
    tint: "#5ad6ff",
    abilityLabels: ["Phase Step", "Tesla Pulse", "Phase Veil", "Overcharge"],
    abilityGlyphs: ["»", "⚡", "◈", "✺"],
    abilityBlurbs: [
      "Hitscan electric zap. Every shot arcs to one nearby second target for 6 bonus damage. Fast cadence — best inside a pack.",
      "Forward dash with i-frames. On lunge end, lightning arcs to the 3 closest enemies for 24 electric damage each.",
      "Radial electric blast at the hero (70 dmg). Then forks chain lightning to 4 more enemies in 6 range for 35 dmg per hop.",
      "Phase Veil: +70% speed, +60% fire rate, +15% damage, 80% resist for 3s. Use to reposition through a clog.",
      "Marks up to 5 nearby enemies for 5s. Marked targets take +50% damage from all sources and absorb a 22-dmg arc every 0.5s.",
    ],
  },
  mike: {
    variant: "mike",
    label: "Mike",
    callsign: "Pyre",
    blurb:
      "Close-range flame mech. Splash plus burn DoT per shot — lights packs on fire and walks away.",
    strengths:
      "Per-shot splash and a 3s burn DoT clears packs. Ignition doubles fire rate. Incinerate deletes whole waves at midrange.",
    weakness: "Short engagement range. Para and armored matriarchs vent flame at ≤0.5×.",
    maxHp: 210,
    speed: 4.2,
    range: 5.5,
    damage: 9,
    fireRate: 4.5,
    damageType: "flame",
    attackSplashRadius: 0.8,
    unlockStars: 12,
    abilities: [
      // Q — Thruster Burst (kept). Forward dash with coal trail.
      { type: "dash", cooldown: 5.0, duration: 0.4, speed: 11.0 },
      // W — Flame Nova: radial blast + burn DoT on hit.
      {
        type: "burst",
        cooldown: 11.0,
        radius: 4.5,
        damage: 95,
        damageType: "flame",
        burn: { duration: 4.0, totalDamage: 40 },
      },
      // E — Ignition: every auto-attack also ignites for 2s while active.
      {
        type: "buff",
        cooldown: 14.0,
        duration: 4.0,
        damageMul: 1.3,
        fireRateMul: 2.0,
        speedMul: 1.0,
        damageResist: 0.35,
        igniteOnHit: { duration: 2.0, totalDamage: 12 },
      },
      // R — Incinerate (kept). Sustained flame on locked target.
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
    abilityLabels: ["Thruster Burst", "Flame Nova", "Ignition", "Incinerate"],
    abilityGlyphs: ["»", "🔥", "✱", "✷"],
    abilityBlurbs: [
      "Short-range flame splash (0.8 radius) — every shot hits a group. Fast cadence stacks DPS on clumped enemies.",
      "Forward dash with i-frames. Drops a 2.6s burning coal trail (22 dps tick) behind you — ideal for running through a marching column.",
      "Radial flame burst (4.5 radius, 95 dmg) plus a 4-second burn (40 total) on every enemy hit.",
      "Ignition: ×2 fire rate, +30% damage, 35% resist for 4s. While active, every auto-attack adds a 2s burn DoT (12 total).",
      "Lock the most-advanced enemy within 8 range; sustained flame ticks 320 total over 4.5s, no matter where they walk.",
    ],
  },
  stan: {
    variant: "stan",
    label: "Stan",
    callsign: "Mauler",
    blurb:
      "Explosive artillery. Every shell detonates; ground pounds and saturation craters chunk packs.",
    strengths:
      "Every auto-attack is a splash. Ground Pound lands a 110-dmg blast. Saturation leaves burning craters that linger.",
    weakness:
      "Slowest mobility — positioning drift hurts. Explosive resist on armored matriarchs softens the kit.",
    maxHp: 290,
    speed: 3.3,
    range: 9.0,
    damage: 34,
    fireRate: 1.0,
    damageType: "explosive",
    attackSplashRadius: 1.5,
    unlockStars: 20,
    abilities: [
      // Q — Ground Pound: short dash; detonates an explosion at landing.
      {
        type: "dash",
        cooldown: 7.0,
        duration: 0.3,
        speed: 9.5,
        landingBlast: { radius: 3.5, damage: 110, damageType: "explosive" },
      },
      // W — Quake: radial blast + knockback.
      {
        type: "burst",
        cooldown: 9.0,
        radius: 5.0,
        damage: 160,
        damageType: "explosive",
        knockback: { pathPush: 1.6 },
      },
      // E — Bulwark (kept).
      {
        type: "buff",
        cooldown: 13.0,
        duration: 5.0,
        damageMul: 1.4,
        fireRateMul: 1.0,
        speedMul: 0.5,
        damageResist: 0.75,
      },
      // R — Saturation Strike: barrage + every shell leaves a crater.
      {
        type: "barrage",
        cooldown: 14.0,
        count: 10,
        range: 11.0,
        damage: 32,
        splashRadius: 1.6,
        damageType: "explosive",
        crater: { duration: 3.0, tickDamage: 18, radius: 2.0, tickInterval: 0.4 },
      },
    ],
    tint: "#ffd24a",
    abilityLabels: ["Ground Pound", "Quake", "Bulwark", "Saturation"],
    abilityGlyphs: ["»", "✺", "▣", "❖"],
    abilityBlurbs: [
      "Every shell explodes on impact (1.5 splash). Slow cadence, long range — pre-aim a clump and watch the whole row go up.",
      "Short dash with i-frames. On landing, detonates a 3.5-radius explosion for 110 explosive damage.",
      "Radial explosive blast (5 radius, 160 dmg). Knocks every enemy hit backwards 1.6 units along the path.",
      "Bulwark: roots Stan (×0.5 speed), +40% damage, 75% damage resist for 5s. Brace and bombard.",
      "Saturation Strike: 10 shells over 9s area. Every shell leaves a 2-radius crater that ticks 18 explosive dmg every 0.4s for 3s.",
    ],
  },
};

export const heroSpec = (variant: HeroVariant): HeroVariantSpec => HERO_SPECS[variant];
