import type { Tower, TowerKind, World } from "./types";
import { emit } from "./world";

export type BranchId = "a" | "b";

export type Upgrade = {
  name: string;
  desc: string;
  cost: number;
  apply: (t: Tower) => void;
};

export type Branch = {
  label: string;
  tiers: [Upgrade, Upgrade, Upgrade];
};

export type UpgradeTree = { a: Branch; b: Branch };

export const UPGRADES: Record<TowerKind, UpgradeTree> = {
  pulse: {
    a: {
      label: "Ballistics",
      tiers: [
        {
          name: "Overbore",
          desc: "+75% damage",
          cost: 30,
          apply: (t) => {
            t.damage *= 1.75;
          },
        },
        {
          name: "Piercing",
          desc: "+70% damage",
          cost: 55,
          apply: (t) => {
            t.damage *= 1.7;
          },
        },
        {
          name: "Annihilator",
          desc: "+90% damage, armor pierce",
          cost: 95,
          apply: (t) => {
            t.damage *= 1.9;
            // Armor pierce — modifier-induced resists below 1.0 get
            // clamped to 1.0 for kinetic hits, undoing flame-immune-style
            // adaptation on raptors / armored hit by Pulse.
            t.armorPierce = true;
          },
        },
      ],
    },
    b: {
      label: "Autoloader",
      tiers: [
        {
          name: "Spool",
          desc: "+40% fire rate",
          cost: 30,
          apply: (t) => {
            t.fireRate *= 1.4;
          },
        },
        {
          name: "Overclock",
          desc: "+50% fire rate",
          cost: 55,
          apply: (t) => {
            t.fireRate *= 1.5;
          },
        },
        {
          name: "Hyperfire",
          desc: "+55% fire rate, +1 range",
          cost: 95,
          apply: (t) => {
            t.fireRate *= 1.55;
            t.range += 1;
          },
        },
      ],
    },
  },
  chain: {
    a: {
      label: "Arc Reach",
      tiers: [
        {
          name: "Fork",
          desc: "+2 chain targets",
          cost: 55,
          apply: (t) => {
            t.chainCount += 2;
          },
        },
        {
          name: "Cascade",
          desc: "+2 chain + less falloff",
          cost: 100,
          apply: (t) => {
            t.chainCount += 2;
            t.chainFalloff = Math.min(1, t.chainFalloff + 0.2);
          },
        },
        {
          name: "Storm",
          desc: "+2 chain, no falloff",
          cost: 175,
          apply: (t) => {
            t.chainCount += 2;
            t.chainFalloff = 1;
          },
        },
      ],
    },
    b: {
      label: "Voltage",
      tiers: [
        {
          name: "Step Up",
          desc: "+55% damage",
          cost: 45,
          apply: (t) => {
            t.damage *= 1.55;
          },
        },
        {
          name: "High Tension",
          desc: "+70% damage",
          cost: 95,
          apply: (t) => {
            t.damage *= 1.7;
          },
        },
        {
          name: "Arc Furnace",
          desc: "+85% damage; strips electric resist per hit",
          cost: 165,
          apply: (t) => {
            t.damage *= 1.85;
            // Each chain hit pulls modifier-induced electric resist
            // 10% closer to 1.0 — over ~10 hits, full electric immunity
            // is undone on a single target.
            t.resistStrip = 0.1;
          },
        },
      ],
    },
  },
  cryo: {
    a: {
      label: "Subzero",
      tiers: [
        {
          name: "Deep Chill",
          desc: "Slower enemies",
          cost: 40,
          apply: (t) => {
            t.slowFactor = 0.3;
          },
        },
        {
          name: "Rime",
          desc: "Near-halt + longer chill",
          cost: 80,
          apply: (t) => {
            t.slowFactor = 0.18;
            t.slowDuration = 1.9;
          },
        },
        {
          name: "Cryo Lock",
          desc: "Crawl + long chill; frozen enemies can't regen",
          cost: 150,
          apply: (t) => {
            t.slowFactor = 0.12;
            t.slowDuration = 2.3;
            // Regen-chip self-heal pauses for the full slow duration on
            // any enemy in range — combos with Pyre T3 / Hive aura as
            // a third regen-suppression option.
            t.freezeBlocksRegen = true;
          },
        },
      ],
    },
    b: {
      label: "Resonator",
      tiers: [
        {
          name: "Shard",
          desc: "+1.2 range",
          cost: 40,
          apply: (t) => {
            t.range += 1.2;
          },
        },
        {
          name: "Freeze Burn",
          desc: "+1.2 range, +0.6s chill",
          cost: 80,
          apply: (t) => {
            t.range += 1.2;
            t.slowDuration += 0.6;
          },
        },
        {
          name: "Absolute Zero",
          desc: "16 cold damage AoE",
          cost: 160,
          apply: (t) => {
            t.damage = 16;
          },
        },
      ],
    },
  },
  mortar: {
    a: {
      label: "Payload",
      tiers: [
        {
          name: "Wider Spread",
          desc: "+40% splash radius",
          cost: 60,
          apply: (t) => {
            t.splashRadius *= 1.4;
          },
        },
        {
          name: "Heavy Shell",
          desc: "+35% splash radius",
          cost: 115,
          apply: (t) => {
            t.splashRadius *= 1.35;
          },
        },
        {
          name: "Thermobaric",
          desc: "+30% splash, +25% damage",
          cost: 210,
          apply: (t) => {
            t.splashRadius *= 1.3;
            t.damage *= 1.25;
          },
        },
      ],
    },
    b: {
      label: "Breach",
      tiers: [
        {
          name: "HE Rounds",
          desc: "+75% damage",
          cost: 55,
          apply: (t) => {
            t.damage *= 1.75;
          },
        },
        {
          name: "Bunker Buster",
          desc: "+90% damage",
          cost: 115,
          apply: (t) => {
            t.damage *= 1.9;
          },
        },
        {
          name: "Singularity",
          desc: "+95% damage, +10% fire rate, 2× damage to shields",
          cost: 210,
          apply: (t) => {
            t.damage *= 1.95;
            t.fireRate *= 1.1;
            // Mortar's T3 cracks shielded enemies fast — compounds with
            // Hive aura (×2 shield mul) for 4× shield damage when both
            // are committed to the lane.
            t.shieldDamageMul = 2;
          },
        },
      ],
    },
  },
  flame: {
    a: {
      label: "Combustion",
      tiers: [
        {
          name: "Accelerant",
          desc: "+60% damage",
          cost: 45,
          apply: (t) => {
            t.damage *= 1.6;
          },
        },
        {
          name: "Thermite",
          desc: "+70% damage",
          cost: 90,
          apply: (t) => {
            t.damage *= 1.7;
          },
        },
        {
          name: "Napalm",
          desc: "+80% damage, +0.6 range; suppresses regen for 1.5s/hit",
          cost: 160,
          apply: (t) => {
            t.damage *= 1.8;
            t.range += 0.6;
            // Pyre's T3 turns a regen tank into a regen-locked target —
            // each hit extends the damage-pause window beyond the
            // default 1.5s, so flame's high tick rate keeps regen off
            // continuously.
            t.regenSuppressOnHit = 1.5;
          },
        },
      ],
    },
    b: {
      label: "Nozzle",
      tiers: [
        {
          name: "Pressurized",
          desc: "+30% fire rate",
          cost: 45,
          apply: (t) => {
            t.fireRate *= 1.3;
          },
        },
        {
          name: "Twin Burner",
          desc: "+35% fire rate, +0.5 range",
          cost: 90,
          apply: (t) => {
            t.fireRate *= 1.35;
            t.range += 0.5;
          },
        },
        {
          name: "Sunflare",
          desc: "+40% fire rate, +0.5 range",
          cost: 160,
          apply: (t) => {
            t.fireRate *= 1.4;
            t.range += 0.5;
          },
        },
      ],
    },
  },
  // Hive Swarm — pure support tower. Drones fly to assigned towers and
  // grant them a fire-rate buff. Path A = more drones (3 → 4 → 5 → 6),
  // Path B = stronger per-drone buff. Neither path adds damage; there's
  // nothing to damage with.
  hive: {
    a: {
      label: "Drone Bay",
      tiers: [
        {
          name: "Spare Drone",
          desc: "+1 drone (4 total)",
          cost: 90,
          apply: (t) => {
            t.droneCount = Math.min(6, t.droneCount + 1);
          },
        },
        {
          name: "Twin Bay",
          desc: "+1 drone (5 total)",
          cost: 160,
          apply: (t) => {
            t.droneCount = Math.min(6, t.droneCount + 1);
          },
        },
        {
          name: "Full Squadron",
          desc: "+1 drone (6 total)",
          cost: 260,
          apply: (t) => {
            t.droneCount = Math.min(6, t.droneCount + 1);
          },
        },
      ],
    },
    b: {
      label: "Service Link",
      tiers: [
        {
          name: "Tuned Coils",
          desc: "+15% service buff (45% total)",
          cost: 80,
          apply: (t) => {
            t.serviceBuff += 0.15;
          },
        },
        {
          name: "Boosted Link",
          desc: "+15% service buff (60% total)",
          cost: 150,
          apply: (t) => {
            t.serviceBuff += 0.15;
          },
        },
        {
          name: "Overdrive",
          desc: "+20% service buff (80% total)",
          cost: 240,
          apply: (t) => {
            t.serviceBuff += 0.2;
          },
        },
      ],
    },
  },
};

// Diffs each stat from current tower to what the tower would look like
// after applying the upgrade. Used by the UI for from→to readouts.
const STAT_KEYS = [
  "damage",
  "fireRate",
  "range",
  "splashRadius",
  "chainCount",
  "chainFalloff",
  "slowFactor",
  "slowDuration",
] as const;
type StatKey = (typeof STAT_KEYS)[number];

export type StatDelta = {
  key: StatKey;
  from: number;
  to: number;
};

export const previewUpgrade = (tower: Tower, upgrade: Upgrade): StatDelta[] => {
  const clone: Tower = { ...tower, upgrades: { ...tower.upgrades } };
  upgrade.apply(clone);
  const out: StatDelta[] = [];
  for (const key of STAT_KEYS) {
    const from = tower[key];
    const to = clone[key];
    if (Math.abs(from - to) > 1e-6) {
      out.push({ key, from, to });
    }
  }
  return out;
};

export const STAT_LABEL: Record<StatKey, string> = {
  damage: "DMG",
  fireRate: "RATE",
  range: "RNG",
  splashRadius: "SPL",
  chainCount: "CHN",
  chainFalloff: "FALL",
  slowFactor: "SLOW",
  slowDuration: "CHILL",
};

// How many decimals to show for a given stat
const STAT_PRECISION: Record<StatKey, number> = {
  damage: 1,
  fireRate: 2,
  range: 1,
  splashRadius: 2,
  chainCount: 0,
  chainFalloff: 2,
  slowFactor: 2,
  slowDuration: 1,
};

export const formatStat = (key: StatKey, value: number): string => {
  return value.toFixed(STAT_PRECISION[key]);
};

export const nextUpgrade = (tower: Tower, branch: BranchId): Upgrade | null => {
  const tier = tower.upgrades[branch];
  if (tier >= 3) return null;
  return UPGRADES[tower.kind][branch].tiers[tier];
};

export const applyUpgrade = (world: World, tower: Tower, branch: BranchId): boolean => {
  const next = nextUpgrade(tower, branch);
  if (!next) return false;
  if (world.gold < next.cost) return false;
  world.gold -= next.cost;
  next.apply(tower);
  tower.upgrades[branch] = (tower.upgrades[branch] + 1) as 0 | 1 | 2 | 3;
  tower.totalSpent += next.cost;
  emit(world, { type: "upgrade" });
  return true;
};

export const sellRefund = (tower: Tower) => Math.floor(tower.totalSpent * 0.65);

export const sellTower = (world: World, tower: Tower) => {
  const refund = sellRefund(tower);
  world.gold += refund;
  world.towers = world.towers.filter((t) => t.id !== tower.id);
  world.towerById.delete(tower.id);
  if (world.selectedTowerId === tower.id) world.selectedTowerId = null;
};
