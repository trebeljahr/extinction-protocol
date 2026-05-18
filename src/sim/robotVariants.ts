// Per-mecha variant defaults. The Robot singleton is rebuilt from
// progress.activeRobot each level start, so every change to the variant
// here (stats, ability params) lands on the next run automatically.
// Skill-tree ranks layer on top via applyRobotSkillsToRobot — variant
// numbers are the "rank 0" baseline.

import type { DamageType, RobotAbilitySlot, RobotVariant } from "./types";

export const ROBOT_VARIANTS: readonly RobotVariant[] = ["george", "leela", "mike", "stan"];

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

// Slot 1 — instant radial AoE around the robot. Damage type varies by
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

// Slot 2 — variant-flavoured self-buff. Multiplies the robot's own stats
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
// dispatcher can fan out to storm / flameRings / frenzy / killshot
// without extra control flags on Robot.
export type PayloadSpec =
  | {
      // Leela R — Storm Surge. AoE chain-lightning storm centered on the
      // robot for `duration` seconds. Every `tickInterval`, picks up to
      // `arcsPerTick` nearest enemies inside `radius` and zaps each.
      type: "storm";
      cooldown: number;
      duration: number;
      radius: number;
      tickInterval: number;
      arcsPerTick: number;
      damagePerArc: number;
      damageType: DamageType;
    }
  | {
      // Mike R — Inferno Ring. Spawns `ringCount` flame rings at the
      // robot's position, one every `ringInterval`. Each ring expands
      // from 0 to `maxRadius` at `expandSpeed` units/sec, damaging any
      // enemy newly inside the ring band (once per ring).
      type: "flameRings";
      cooldown: number;
      ringCount: number;
      ringInterval: number;
      maxRadius: number;
      expandSpeed: number;
      damagePerRing: number;
      damageType: DamageType;
      burn?: { duration: number; totalDamage: number };
    }
  | {
      // George R — Bullet Storm. Time-limited frenzy that multiplies
      // outgoing damage AND fire rate. Auto-attacks naturally pump
      // through the buffed cadence during the window.
      type: "frenzy";
      cooldown: number;
      duration: number;
      damageMul: number;
      fireRateMul: number;
    }
  | {
      // Stan R — Annihilator Missile. Locks the highest-progress enemy
      // in range, charges for `chargeTime`, then drops a single huge
      // explosive payload with massive splash at impact.
      type: "killshot";
      cooldown: number;
      range: number;
      chargeTime: number;
      damage: number;
      splashDamage: number;
      splashRadius: number;
      damageType: DamageType;
    };

export type RobotAbilitySpec = DashSpec | BurstSpec | BuffSpec | PayloadSpec;

// Per-robot auto-attack rider. Each shot can also chain to nearby
// enemies (Leela), draw a tracer beam (George), or apply burn DoT
// during a buff window (Mike — driven by buff.igniteOnHit instead).
export type AttackChainSpec = {
  hops: number;
  damagePerHop: number;
  radius: number;
};

export type RobotVariantSpec = {
  variant: RobotVariant;
  label: string;
  callsign: string;
  blurb: string;
  // Field-report assessment. One line each, terse. Rendered in the
  // compendium under the robot blurb so the player can read a tactical
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
  // beam from the robot to the target instead of (or alongside) the
  // projectile. George uses this for the sniper read.
  attackTracer?: boolean;
  // Metal bolt cost to unlock this robot from the roster. 0 = starter
  // (george). Dinosaur drops feed the persistent bolt wallet.
  unlockBolts: number;
  abilities: [DashSpec, BurstSpec, BuffSpec, PayloadSpec];
  tint: string;
  // HUD labels per slot (Q/W/E/R). Short ASCII glyph picks up from the
  // existing robot panel without bringing in icon assets.
  abilityLabels: [string, string, string, string];
  abilityGlyphs: [string, string, string, string];
  // Per-slot tooltip blurb shown in the shop and HUD. Length 5: the
  // first entry describes the auto-attack ("Basic Attack"), the next
  // four describe Q/W/E/R. Robot-specific so each card reads as a
  // distinct ability rather than a generic burst/dash/etc.
  abilityBlurbs: [string, string, string, string, string];
};

export const ROBOT_SPECS: Record<RobotVariant, RobotVariantSpec> = {
  george: {
    variant: "george",
    label: "George",
    callsign: "Vanguard",
    blurb: "Long-range kinetic sniper. Slow, deliberate, every shot a tracer that pierces armor.",
    strengths:
      "Longest engagement range. Massive single-shot damage. Bullet Storm unleashes an absurd-cadence frenzy on demand.",
    weakness:
      "Slow base fire cadence — packs of swarmers slip past between shots. Kinetic-resistant armored chassis shrug body hits.",
    maxHp: 220,
    speed: 4.0,
    range: 11.0,
    damage: 44,
    fireRate: 0.85,
    damageType: "kinetic",
    attackSplashRadius: 0,
    attackTracer: true,
    unlockBolts: 0,
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
      // W — Shockwave: radial kinetic pulse + small path push. Synergy
      // with Sidestep's i-frame ringout when packs close in.
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
      // R — Bullet Storm: time-limited frenzy. ×7 fire rate + ×1.5
      // damage for 3.5s. Tracer beams pour out as continuous bullet
      // hell on whatever the auto-aim picks.
      {
        type: "frenzy",
        cooldown: 18.0,
        duration: 3.5,
        damageMul: 1.5,
        fireRateMul: 7.0,
      },
    ],
    tint: "#9fd8ff",
    abilityLabels: ["Sidestep", "Shockwave", "Spotter", "Bullet Storm"],
    abilityGlyphs: ["»", "✺", "◎", "✦"],
    abilityBlurbs: [
      "Sniper beam. Long reach, slow cadence, huge kinetic hit.",
      "Short i-frame hop; next shot is a piercing x2.5 crit.",
      "Close kinetic pulse for 95 damage and a small path push.",
      "Scope stance: more range and damage, slower feet, 40% resist.",
      "3.5s frenzy: x7 fire rate and +50% damage.",
    ],
  },
  leela: {
    variant: "leela",
    label: "Leela",
    callsign: "Strider",
    blurb: "Electric skirmisher. Every shot chains. Storms tear apart anything that gets close.",
    strengths:
      "Highest mobility. Auto-attacks chain to two nearby targets. Storm Surge zaps every enemy in a wide ring for several seconds.",
    weakness: "Thin armor — eats hits at midrange. Electric-resistant titans absorb the kit.",
    maxHp: 200,
    speed: 6.0,
    range: 6.5,
    damage: 7,
    fireRate: 5.5,
    damageType: "electric",
    attackSplashRadius: 0,
    attackChain: { hops: 2, damagePerHop: 5, radius: 2.6 },
    unlockBolts: 250,
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
      // R — Storm Surge: ring of lightning around the robot for 5s.
      // Every 0.2s, lashes the 4 nearest enemies in 7 range.
      {
        type: "storm",
        cooldown: 16.0,
        duration: 5.0,
        radius: 7.0,
        tickInterval: 0.2,
        arcsPerTick: 4,
        damagePerArc: 26,
        damageType: "electric",
      },
    ],
    tint: "#5ad6ff",
    abilityLabels: ["Phase Step", "Tesla Pulse", "Phase Veil", "Storm Surge"],
    abilityGlyphs: ["»", "⚡", "◈", "✺"],
    abilityBlurbs: [
      "Fast electric zap. Each shot chains to two nearby targets.",
      "I-frame dash; end arcs hit 3 enemies for 24 electric.",
      "4-radius electric pulse, then 4 chain hops for 35 each.",
      "3s veil: speed, fire rate, damage, and 80% resist.",
      "5s storm: 4 electric arcs every 0.2s inside 7 radius.",
    ],
  },
  mike: {
    variant: "mike",
    label: "Mike",
    callsign: "Pyre",
    blurb:
      "Close-range flame mech. Heavy per-shot splash plus burn DoT — turns packs into bonfires.",
    strengths:
      "Biggest auto-attack splash of any robot. Ignition doubles fire rate. Inferno Ring washes flame waves out in every direction.",
    weakness: "Shortest engagement range. Para and armored matriarchs vent flame at ≤0.5×.",
    maxHp: 220,
    speed: 4.2,
    range: 4.5,
    damage: 14,
    fireRate: 3.6,
    damageType: "flame",
    attackSplashRadius: 1.1,
    unlockBolts: 600,
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
      // R — Inferno Ring: 3 expanding flame rings wash out from the
      // robot in sequence, each damaging anything caught in its band.
      {
        type: "flameRings",
        cooldown: 17.0,
        ringCount: 3,
        ringInterval: 0.7,
        maxRadius: 6.5,
        expandSpeed: 9.0,
        damagePerRing: 95,
        damageType: "flame",
        burn: { duration: 3.0, totalDamage: 36 },
      },
    ],
    tint: "#ff8a3a",
    abilityLabels: ["Thruster", "Flame Nova", "Ignition", "Inferno"],
    abilityGlyphs: ["»", "🔥", "✱", "✷"],
    abilityBlurbs: [
      "Short-range flame splash. Every shot hits a small pack.",
      "I-frame dash that leaves a 2.6s burning coal trail.",
      "4.5-radius nova for 95 flame, plus 40 burn.",
      "4s ignition: x2 fire rate, +30% damage, 35% resist.",
      "3 expanding flame rings, 95 each, plus burn.",
    ],
  },
  stan: {
    variant: "stan",
    label: "Stan",
    callsign: "Mauler",
    blurb:
      "Explosive artillery. Every shell detonates; ground pounds and giant warheads chunk packs.",
    strengths:
      "Every auto-attack is a splash. Ground Pound lands a 110-dmg blast. Annihilator drops a single warhead that flattens the lane.",
    weakness:
      "Slowest mobility — positioning drift hurts. Explosive resist on armored matriarchs softens the kit.",
    maxHp: 300,
    speed: 3.3,
    range: 9.0,
    damage: 34,
    fireRate: 1.0,
    damageType: "explosive",
    attackSplashRadius: 1.5,
    unlockBolts: 1200,
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
      // R — Annihilator Missile: locks the highest-progress enemy in
      // range, charges, then drops a single huge warhead with massive
      // splash at impact.
      {
        type: "killshot",
        cooldown: 18.0,
        range: 12.0,
        chargeTime: 0.9,
        damage: 700,
        splashDamage: 320,
        splashRadius: 4.0,
        damageType: "explosive",
      },
    ],
    tint: "#ffd24a",
    abilityLabels: ["Ground Pound", "Quake", "Bulwark", "Annihilator"],
    abilityGlyphs: ["»", "✺", "▣", "❖"],
    abilityBlurbs: [
      "Long-range explosive shells. Slow, wide splash, high impact.",
      "Short i-frame leap; landing blast deals 110 explosive.",
      "5-radius quake for 160 explosive and heavy path push.",
      "5s brace: +40% damage, 75% resist, half speed.",
      "Charged warhead: 700 direct, 320 splash.",
    ],
  },
};

export const robotAbilityDamageType = (
  spec: RobotVariantSpec,
  slot: RobotAbilitySlot,
): DamageType => {
  const ability = spec.abilities[slot];
  if (ability.type === "dash") {
    if (ability.endChain) return ability.endChain.damageType;
    if (ability.landingBlast) return ability.landingBlast.damageType;
    if (spec.variant === "mike") return "flame";
    return spec.damageType;
  }
  if (ability.type === "buff") {
    if (ability.igniteOnHit) return "flame";
    return spec.damageType;
  }
  if (ability.type === "frenzy") return spec.damageType;
  return ability.damageType;
};

export const robotSpec = (variant: RobotVariant): RobotVariantSpec => ROBOT_SPECS[variant];
