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
        { name: "Overbore",      desc: "+75% damage",                cost: 30,  apply: t => { t.damage *= 1.75; } },
        { name: "Piercing",      desc: "+70% damage",                cost: 55,  apply: t => { t.damage *= 1.7; } },
        { name: "Annihilator",   desc: "+140% damage",               cost: 95,  apply: t => { t.damage *= 2.4; } },
      ],
    },
    b: {
      label: "Autoloader",
      tiers: [
        { name: "Spool",         desc: "+40% fire rate",             cost: 30,  apply: t => { t.fireRate *= 1.4; } },
        { name: "Overclock",     desc: "+50% fire rate",             cost: 55,  apply: t => { t.fireRate *= 1.5; } },
        { name: "Hyperfire",     desc: "+80% fire rate, +1.5 range", cost: 95,  apply: t => { t.fireRate *= 1.8; t.range += 1.5; } },
      ],
    },
  },
  chain: {
    a: {
      label: "Arc Reach",
      tiers: [
        { name: "Fork",          desc: "+2 chain targets",           cost: 55,  apply: t => { t.chainCount += 2; } },
        { name: "Cascade",       desc: "+2 chain + less falloff",    cost: 100, apply: t => { t.chainCount += 2; t.chainFalloff = Math.min(1, t.chainFalloff + 0.2); } },
        { name: "Storm",         desc: "+3 chain, no falloff",       cost: 175, apply: t => { t.chainCount += 3; t.chainFalloff = 1; } },
      ],
    },
    b: {
      label: "Voltage",
      tiers: [
        { name: "Step Up",       desc: "+55% damage",                cost: 45,  apply: t => { t.damage *= 1.55; } },
        { name: "High Tension",  desc: "+70% damage",                cost: 95,  apply: t => { t.damage *= 1.7; } },
        { name: "Arc Furnace",   desc: "+130% damage",               cost: 165, apply: t => { t.damage *= 2.3; } },
      ],
    },
  },
  cryo: {
    a: {
      label: "Subzero",
      tiers: [
        { name: "Deep Chill",    desc: "Slower enemies",             cost: 40,  apply: t => { t.slowFactor = 0.3; } },
        { name: "Rime",          desc: "Near-halt + longer chill",   cost: 80,  apply: t => { t.slowFactor = 0.18; t.slowDuration = 1.9; } },
        { name: "Cryo Lock",     desc: "Crawl + long chill",         cost: 150, apply: t => { t.slowFactor = 0.08; t.slowDuration = 2.6; } },
      ],
    },
    b: {
      label: "Resonator",
      tiers: [
        { name: "Shard",         desc: "+1.2 range",                 cost: 40,  apply: t => { t.range += 1.2; } },
        { name: "Freeze Burn",   desc: "+1.2 range, +0.6s chill",    cost: 80,  apply: t => { t.range += 1.2; t.slowDuration += 0.6; } },
        { name: "Absolute Zero", desc: "24 cold damage AoE",         cost: 160, apply: t => { t.damage = 24; } },
      ],
    },
  },
  mortar: {
    a: {
      label: "Payload",
      tiers: [
        { name: "Wider Spread",  desc: "+40% splash radius",         cost: 65,  apply: t => { t.splashRadius *= 1.4; } },
        { name: "Heavy Shell",   desc: "+35% splash radius",         cost: 130, apply: t => { t.splashRadius *= 1.35; } },
        { name: "Thermobaric",   desc: "+40% splash, +40% damage",   cost: 230, apply: t => { t.splashRadius *= 1.4; t.damage *= 1.4; } },
      ],
    },
    b: {
      label: "Breach",
      tiers: [
        { name: "HE Rounds",     desc: "+55% damage",                cost: 65,  apply: t => { t.damage *= 1.55; } },
        { name: "Bunker Buster", desc: "+50% damage, +1.5 range",    cost: 130, apply: t => { t.damage *= 1.5; t.range += 1.5; } },
        { name: "Singularity",   desc: "+130% damage",               cost: 230, apply: t => { t.damage *= 2.3; } },
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
