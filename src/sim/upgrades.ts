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
        { name: "Overbore",      desc: "+50% damage",  cost: 40,  apply: t => { t.damage *= 1.5; } },
        { name: "Piercing",      desc: "+100% damage", cost: 85,  apply: t => { t.damage *= 1.33; } },
        { name: "Annihilator",   desc: "+200% damage", cost: 180, apply: t => { t.damage *= 1.5; } },
      ],
    },
    b: {
      label: "Autoloader",
      tiers: [
        { name: "Spool",         desc: "+30% fire rate", cost: 40,  apply: t => { t.fireRate *= 1.3; } },
        { name: "Overclock",     desc: "+35% fire rate", cost: 80,  apply: t => { t.fireRate *= 1.35; } },
        { name: "Hyperfire",     desc: "+50% fire rate + range",  cost: 170, apply: t => { t.fireRate *= 1.5; t.range += 1; } },
      ],
    },
  },
  chain: {
    a: {
      label: "Arc Reach",
      tiers: [
        { name: "Fork",          desc: "+1 chain target",  cost: 70,  apply: t => { t.chainCount += 1; } },
        { name: "Cascade",       desc: "+2 chain targets", cost: 140, apply: t => { t.chainCount += 2; } },
        { name: "Storm",         desc: "+3 chain + no falloff", cost: 260, apply: t => { t.chainCount += 3; t.chainFalloff = 1; } },
      ],
    },
    b: {
      label: "Voltage",
      tiers: [
        { name: "Step Up",       desc: "+40% damage",  cost: 65,  apply: t => { t.damage *= 1.4; } },
        { name: "High Tension",  desc: "+70% damage",  cost: 130, apply: t => { t.damage *= 1.5; } },
        { name: "Arc Furnace",   desc: "+100% damage", cost: 240, apply: t => { t.damage *= 1.8; } },
      ],
    },
  },
  cryo: {
    a: {
      label: "Subzero",
      tiers: [
        { name: "Deep Chill",    desc: "Slower enemies",  cost: 55, apply: t => { t.slowFactor = 0.35; } },
        { name: "Rime",          desc: "Very slow",       cost: 110, apply: t => { t.slowFactor = 0.25; t.slowDuration = 1.6; } },
        { name: "Cryo Lock",     desc: "Near-freeze",     cost: 210, apply: t => { t.slowFactor = 0.12; t.slowDuration = 2.2; } },
      ],
    },
    b: {
      label: "Resonator",
      tiers: [
        { name: "Shard",         desc: "+60% damage",  cost: 55,  apply: t => { t.damage *= 1.6; } },
        { name: "Freeze Burn",   desc: "+120% damage + range", cost: 115, apply: t => { t.damage *= 1.37; t.range += 1; } },
        { name: "Absolute Zero", desc: "+200% damage + range", cost: 220, apply: t => { t.damage *= 1.64; t.range += 1; } },
      ],
    },
  },
  mortar: {
    a: {
      label: "Payload",
      tiers: [
        { name: "Wider Spread",  desc: "+30% splash radius", cost: 95,  apply: t => { t.splashRadius *= 1.3; } },
        { name: "Heavy Shell",   desc: "+60% splash radius", cost: 190, apply: t => { t.splashRadius *= 1.23; } },
        { name: "Thermobaric",   desc: "+100% splash",       cost: 340, apply: t => { t.splashRadius *= 1.25; } },
      ],
    },
    b: {
      label: "Breach",
      tiers: [
        { name: "HE Rounds",     desc: "+40% damage",  cost: 95,  apply: t => { t.damage *= 1.4; } },
        { name: "Bunker Buster", desc: "+80% damage + range",  cost: 180, apply: t => { t.damage *= 1.28; t.range += 1.5; } },
        { name: "Singularity",   desc: "+150% damage", cost: 320, apply: t => { t.damage *= 1.95; } },
      ],
    },
  },
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
  world.towers = world.towers.filter(t => t.id !== tower.id);
  if (world.selectedTowerId === tower.id) world.selectedTowerId = null;
};
