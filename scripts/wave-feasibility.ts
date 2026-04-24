/**
 * Wave feasibility analyzer — static balance check.
 *
 *   npx tsx scripts/wave-feasibility.ts             # all levels
 *   npx tsx scripts/wave-feasibility.ts 15          # single level
 *   npx tsx scripts/wave-feasibility.ts 15 --detail # show top-3 tower picks
 *
 * For each wave, the tool compares two numbers:
 *
 *   requiredDps  = totalWaveHp / combatWindow
 *   achievableDps = bestTowerKind × count-buildable-from-cumulative-gold
 *                   × weighted-average resist-vs-this-mix × aoe-multiplier
 *
 *   feasibility = achievableDps / requiredDps
 *
 * Assumes perfect play: every tower fully upgraded (both branches, all tiers),
 * perfect placement so every enemy stays in range, no wasted shots. A
 * feasibility >= 1.0 means the wave is clearable in theory; <1.0 means the
 * budget genuinely can't produce enough DPS with any single turret type.
 *
 * Budget per wave = startGold + sum(bounties, waves 1..N-1) + sum(5+wave, 1..N-1).
 * Does NOT include early-call bonuses (variable) or assume surviving towers
 * from earlier waves — treats each wave as a fresh optimal build.
 */

import { LEVELS } from "../src/levels";
import { pathLength } from "../src/sim/path";
import type { EnemyKind, Tower, TowerKind, Vec2, WaveSpec } from "../src/sim/types";
import { UPGRADES } from "../src/sim/upgrades";
import {
  ENEMY_RESIST,
  ENEMY_STATS,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  TOWER_STATS,
  type TowerBaseStats,
} from "../src/sim/world";
import { coverageFraction, pathCoverage } from "./lib/coverage";

// ------- Tower modeling -------

type TowerConfig = TowerBaseStats & {
  kind: TowerKind;
  tierA: 0 | 1 | 2 | 3;
  tierB: 0 | 1 | 2 | 3;
  cost: number;
};

/** Build a tower stat block at a given (tierA, tierB) upgrade state. */
const buildConfig = (kind: TowerKind, tierA: 0 | 1 | 2 | 3, tierB: 0 | 1 | 2 | 3): TowerConfig => {
  const base = TOWER_STATS[kind];
  const t = { ...base, upgrades: { a: 0, b: 0 } } as unknown as Tower;
  let cost = TOWER_COST[kind];
  const tree = UPGRADES[kind];
  for (let i = 0; i < tierA; i++) {
    tree.a.tiers[i].apply(t);
    cost += tree.a.tiers[i].cost;
  }
  for (let i = 0; i < tierB; i++) {
    tree.b.tiers[i].apply(t);
    cost += tree.b.tiers[i].cost;
  }
  return {
    kind,
    tierA,
    tierB,
    range: t.range,
    damage: t.damage,
    fireRate: t.fireRate,
    splashRadius: t.splashRadius,
    chainCount: t.chainCount,
    chainFalloff: t.chainFalloff,
    slowFactor: t.slowFactor,
    slowDuration: t.slowDuration,
    cost,
  };
};

/** All 16 upgrade-state configs for every tower kind. */
const ALL_CONFIGS: TowerConfig[] = (() => {
  const out: TowerConfig[] = [];
  for (const kind of Object.keys(TOWER_STATS) as TowerKind[]) {
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 3; b++) {
        out.push(buildConfig(kind, a as 0 | 1 | 2 | 3, b as 0 | 1 | 2 | 3));
      }
    }
  }
  return out;
})();

/**
 * Targets-hit-per-shot estimate for a given tower config.
 * Capped by enemies realistically on-screen to keep the bound honest.
 */
const aoeMultiplier = (kind: TowerKind, s: TowerConfig, enemiesOnScreen: number): number => {
  if (s.chainCount > 0) {
    // 1 primary + chain bounces with falloff ramp
    let mult = 1;
    for (let i = 0; i < s.chainCount; i++) {
      mult += s.chainFalloff ** (i + 1);
    }
    return Math.min(mult, enemiesOnScreen);
  }
  if (s.splashRadius > 0) {
    // rough density-based estimate — a 1.8-radius splash hits ~2.5 enemies
    return Math.min(1 + s.splashRadius * 0.8, enemiesOnScreen);
  }
  if (kind === "flame") {
    // forward cone — hits everything stacked up in the stream
    return Math.min(3, enemiesOnScreen);
  }
  if (kind === "hive") {
    // 3 orbiting drones, each firing at its own target independently.
    // Effective throughput is ~3× the nominal single-shot DPS.
    return Math.min(3, enemiesOnScreen);
  }
  return 1;
};

// ------- Wave modeling -------

type WaveBreakdown = {
  totalHp: number;
  counts: Partial<Record<EnemyKind, number>>;
  totalEnemies: number;
  slowestSpeed: number;
};

const analyzeWave = (spec: WaveSpec, levelHpScale: number): WaveBreakdown => {
  const hpMul = (spec.hpMul ?? 1) * levelHpScale;
  const counts: Partial<Record<EnemyKind, number>> = {};
  let totalHp = 0;
  let totalEnemies = 0;
  let slowestSpeed = Number.POSITIVE_INFINITY;
  for (const s of spec.spawns) {
    const stats = ENEMY_STATS[s.kind];
    counts[s.kind] = (counts[s.kind] ?? 0) + s.count;
    totalHp += stats.hp * hpMul * s.count;
    totalEnemies += s.count;
    if (stats.speed < slowestSpeed) slowestSpeed = stats.speed;
  }
  return {
    totalHp,
    counts,
    totalEnemies,
    slowestSpeed: Number.isFinite(slowestSpeed) ? slowestSpeed : 1,
  };
};

const waveBounty = (spec: WaveSpec): number =>
  spec.spawns.reduce((n, s) => n + ENEMY_STATS[s.kind].bounty * s.count, 0);

// Spawn spacing matches spawner.ts:87
const spawnSpacing = (spec: WaveSpec, waveNumber: number): number =>
  spec.spacing ?? Math.max(0.35, 0.75 - waveNumber * 0.03);

// Combat window: first spawn to last enemy clearing the longest path
const combatWindow = (
  spec: WaveSpec,
  waveNumber: number,
  wave: WaveBreakdown,
  longestPath: number,
): number => {
  const spawnSpan = Math.max(0, (wave.totalEnemies - 1) * spawnSpacing(spec, waveNumber));
  const crossTime = longestPath / wave.slowestSpeed;
  return spawnSpan + crossTime;
};

/**
 * Effective single-tower DPS vs a wave's enemy mix.
 * Weight resist by HP share so tanky enemies (stego/titan) dominate correctly.
 */
const effectiveDpsVsWave = (cfg: TowerConfig, wave: WaveBreakdown): number => {
  const dmgType = TOWER_DAMAGE_TYPE[cfg.kind];
  let weightedResist = 0;
  let totalHp = 0;
  for (const k of Object.keys(wave.counts) as EnemyKind[]) {
    const count = wave.counts[k] ?? 0;
    if (!count) continue;
    // resistance weighting is scale-invariant — raw hp is fine here
    const hp = ENEMY_STATS[k].hp * count;
    weightedResist += ENEMY_RESIST[k][dmgType] * hp;
    totalHp += hp;
  }
  const avgResist = totalHp > 0 ? weightedResist / totalHp : 1;
  const aoe = aoeMultiplier(cfg.kind, cfg, Math.min(wave.totalEnemies, 10));
  return cfg.damage * cfg.fireRate * avgResist * aoe;
};

// ------- Per-level analysis -------

type TowerPick = {
  kind: TowerKind;
  tierA: number;
  tierB: number;
  unitCost: number;
  perTowerDps: number;
  count: number;
  totalDps: number;
  potentialDamage: number;
};

type WaveRow = {
  wave: number;
  archetype: string;
  totalEnemies: number;
  totalHp: number;
  durationSec: number;
  goldBudget: number;
  requiredDps: number;
  best: TowerPick | null;
  top3: TowerPick[];
};

/**
 * Find the best single-tower-type setup within budget.
 * Searches all 144 (9 kinds × 16 upgrade states) configs, picks the one
 * that maximizes total DPS × combat window. Mixed-type setups could beat
 * this at wave-boundaries with heterogeneous enemies, but single-type is a
 * solid lower bound on "optimal play".
 */
const bestSetup = (
  wave: WaveBreakdown,
  budget: number,
  dur: number,
  paths: Vec2[][],
): TowerPick[] => {
  const picks: TowerPick[] = [];
  for (const cfg of ALL_CONFIGS) {
    if (cfg.damage <= 0) continue;
    const count = Math.floor(budget / cfg.cost);
    if (count === 0) continue;
    const perTowerDps = effectiveDpsVsWave(cfg, wave);
    // Multi-path coverage: one tower may only reach a fraction of the
    // enemy stream if paths don't converge near any valid placement.
    // Optimistic: assumes the player picks the best spot for this kind's range.
    const covPer = pathCoverage(paths, cfg.range);
    const covFrac = coverageFraction(count, covPer, paths.length);
    const totalDps = perTowerDps * count * covFrac;
    picks.push({
      kind: cfg.kind,
      tierA: cfg.tierA,
      tierB: cfg.tierB,
      unitCost: cfg.cost,
      perTowerDps,
      count,
      totalDps,
      potentialDamage: totalDps * dur,
    });
  }
  picks.sort((a, b) => b.potentialDamage - a.potentialDamage);
  // For the top-3, deduplicate by tower kind so you see variety, not
  // 3 near-identical pulse configs.
  const topByKind: TowerPick[] = [];
  const seen = new Set<TowerKind>();
  for (const p of picks) {
    if (seen.has(p.kind)) continue;
    seen.add(p.kind);
    topByKind.push(p);
    if (topByKind.length === 3) break;
  }
  return [picks[0], ...topByKind.filter((p) => p !== picks[0])].slice(0, 3);
};

const analyzeLevel = (levelIdx: number) => {
  const level = LEVELS[levelIdx];
  const hpScale = level.hpScale ?? 1;
  const longestPath = Math.max(...level.paths.map(pathLength));

  const rows: WaveRow[] = [];
  let cumulativeBounty = 0;
  let cumulativeBonus = 0;

  for (let i = 0; i < level.waves.length; i++) {
    const spec = level.waves[i];
    const waveNumber = i + 1;
    const wave = analyzeWave(spec, hpScale);
    const dur = combatWindow(spec, waveNumber, wave, longestPath);
    const budget = level.startGold + cumulativeBounty + cumulativeBonus;
    const requiredDps = wave.totalHp / dur;
    const top = bestSetup(wave, budget, dur, level.paths);

    rows.push({
      wave: waveNumber,
      archetype: spec.archetype ?? "—",
      totalEnemies: wave.totalEnemies,
      totalHp: wave.totalHp,
      durationSec: dur,
      goldBudget: budget,
      requiredDps,
      best: top[0] ?? null,
      top3: top,
    });

    cumulativeBounty += waveBounty(spec);
    cumulativeBonus += 5 + waveNumber;
  }

  return { level, rows, longestPath };
};

// ------- Output -------

const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const feasColor = (f: number): string =>
  f >= 2 ? C.green : f >= 1.2 ? C.cyan : f >= 0.8 ? C.yellow : C.red;

const fmt = (n: number, d = 0) => n.toFixed(d);
const pad = (s: string | number, n: number) => String(s).padStart(n);
const padR = (s: string | number, n: number) => String(s).padEnd(n);

const printLevel = (levelIdx: number, detail: boolean) => {
  const { level, rows, longestPath } = analyzeLevel(levelIdx);
  const clearedCount = rows.filter((r) => r.best && r.best.potentialDamage >= r.totalHp).length;
  const tightestWave = rows.reduce(
    (t, r) => {
      const f = r.best ? r.best.potentialDamage / r.totalHp : 0;
      return f < t.f ? { f, wave: r.wave } : t;
    },
    { f: Number.POSITIVE_INFINITY, wave: 0 },
  );

  console.log(
    `\n${C.bold}═══ L${level.id}: ${level.name}${C.reset}` +
      `${level.hpScale ? ` ${C.dim}(hpScale ${level.hpScale}×)${C.reset}` : ""}` +
      ` ${C.dim}startGold=${level.startGold}, paths=${level.paths.length}, longestPath=${fmt(longestPath, 1)}u${C.reset}`,
  );
  console.log(
    `${C.dim}${pad("W", 3)} ${pad("arch", 7)} ${pad("enemies", 7)} ${pad("totalHp", 8)} ${pad("sec", 6)} ${pad("gold", 6)} ${pad("reqDPS", 7)} ${pad("bestT", 8)} ${pad("×N", 4)} ${pad("gotDPS", 7)} ${pad("feas", 6)}${C.reset}`,
  );
  for (const r of rows) {
    const feas = r.best ? r.best.potentialDamage / r.totalHp : 0;
    const best = r.best;
    console.log(
      `${pad(r.wave, 3)} ${pad(r.archetype, 7)} ${pad(r.totalEnemies, 7)} ` +
        `${pad(fmt(r.totalHp, 0), 8)} ${pad(fmt(r.durationSec, 1), 6)} ` +
        `${pad(r.goldBudget, 6)} ${pad(fmt(r.requiredDps, 0), 7)} ` +
        `${pad(best?.kind ?? "—", 8)} ${pad(best?.count ?? 0, 4)} ` +
        `${pad(fmt(best?.totalDps ?? 0, 0), 7)} ` +
        `${feasColor(feas)}${pad(fmt(feas, 2), 6)}${C.reset}`,
    );
    if (detail && r.top3.length > 0) {
      for (const p of r.top3) {
        const f = p.potentialDamage / r.totalHp;
        console.log(
          `    ${C.dim}↳ ${pad(p.kind, 8)} a${p.tierA}/b${p.tierB} @${p.unitCost}g ×${p.count} = ${fmt(p.totalDps, 0)} DPS → feas ${fmt(f, 2)}${C.reset}`,
        );
      }
    }
  }
  const tailColor =
    clearedCount === rows.length
      ? C.green
      : clearedCount >= rows.length - 1
        ? C.cyan
        : clearedCount >= rows.length * 0.7
          ? C.yellow
          : C.red;
  console.log(
    `${tailColor}  → ${clearedCount}/${rows.length} waves clearable; tightest = wave ${tightestWave.wave} @ ${fmt(tightestWave.f, 2)}×${C.reset}`,
  );
};

// ------- Soft-spot analysis -------

/**
 * "Too easy" heuristic. Flags waves where:
 *   - absolute feasibility > absThreshold (trivially overbudgeted DPS), OR
 *   - feasibility > ratio × the level's tightest wave (pacing outlier — the
 *     wave is so much easier than the level's actual challenge that the
 *     player notices no resistance).
 *
 * Runs only for levels with id >= fromLevel (default 6), since early
 * levels are introductions and a bit of slack is on purpose.
 */
const printSoftSpots = (fromLevel: number, absThreshold: number, ratio: number) => {
  type Flagged = {
    level: (typeof LEVELS)[number];
    wave: number;
    archetype: string;
    feas: number;
    tightest: number;
    totalEnemies: number;
    totalHp: number;
    reasons: string[];
  };
  const flagged: Flagged[] = [];
  const archCounts: Record<string, { total: number; soft: number }> = {};
  let totalConsidered = 0;
  let totalSoft = 0;

  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    if (level.id < fromLevel) continue;
    const { rows } = analyzeLevel(i);
    const feasList = rows.map((r) => (r.best ? r.best.potentialDamage / r.totalHp : 0));
    const tightest = Math.min(...feasList.filter((f) => f > 0));
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      const f = feasList[j];
      totalConsidered++;
      const arch = r.archetype;
      archCounts[arch] = archCounts[arch] ?? { total: 0, soft: 0 };
      archCounts[arch].total++;
      const reasons: string[] = [];
      if (f > absThreshold) reasons.push(`abs>${absThreshold}`);
      if (tightest > 0 && f > ratio * tightest) reasons.push(`${fmt(f / tightest, 1)}× tightest`);
      if (reasons.length > 0) {
        totalSoft++;
        archCounts[arch].soft++;
        flagged.push({
          level,
          wave: r.wave,
          archetype: arch,
          feas: f,
          tightest,
          totalEnemies: r.totalEnemies,
          totalHp: r.totalHp,
          reasons,
        });
      }
    }
  }

  console.log(
    `\n${C.bold}═══ Soft-spot scan — levels ${fromLevel}+, abs>${absThreshold}×, pacing>${ratio}× tightest${C.reset}`,
  );

  // Group by level
  let currentLevelId = -1;
  for (const f of flagged) {
    if (f.level.id !== currentLevelId) {
      currentLevelId = f.level.id;
      console.log(
        `\n${C.bold}L${f.level.id} ${f.level.name}${C.reset} ${C.dim}(tightest ${fmt(f.tightest, 2)}×)${C.reset}`,
      );
    }
    const severity =
      f.feas >= absThreshold * 2 ? C.red : f.feas >= absThreshold ? C.yellow : C.cyan;
    console.log(
      `  W${pad(f.wave, 2)} ${padR(f.archetype, 7)} ${severity}feas ${pad(fmt(f.feas, 2), 6)}×${C.reset}` +
        ` ${C.dim}${pad(f.totalEnemies, 4)} enemies, ${pad(fmt(f.totalHp, 0), 6)} HP${C.reset}` +
        ` ${C.dim}— ${f.reasons.join(", ")}${C.reset}`,
    );
  }

  // Global breakdown
  console.log(`\n${C.bold}═══ Patterns${C.reset}`);
  console.log(
    `${totalSoft}/${totalConsidered} waves flagged ${C.dim}(${((totalSoft / totalConsidered) * 100).toFixed(1)}%)${C.reset}`,
  );
  const archEntries = Object.entries(archCounts)
    .filter(([, c]) => c.total > 0)
    .sort((a, b) => b[1].soft / b[1].total - a[1].soft / a[1].total);
  console.log(`${C.dim}By archetype (flagged / total):${C.reset}`);
  for (const [arch, c] of archEntries) {
    const pct = ((c.soft / c.total) * 100).toFixed(0);
    const bar = "█".repeat(Math.round((c.soft / c.total) * 20));
    console.log(
      `  ${padR(arch, 7)} ${pad(c.soft, 3)}/${pad(c.total, 3)}  ${pad(pct + "%", 4)}  ${bar}`,
    );
  }
};

// ------- Entry -------

declare const process: { argv: string[]; exit(code: number): never };

const args = process.argv.slice(2);
const detail = args.includes("--detail");
const softMode = args.includes("--soft");
const fromArg = args.find((a: string) => a.startsWith("--from="));
const absArg = args.find((a: string) => a.startsWith("--abs="));
const ratioArg = args.find((a: string) => a.startsWith("--ratio="));
const levelArg = args.find((a: string) => /^\d+$/.test(a));

if (softMode) {
  const fromLevel = fromArg ? Number(fromArg.split("=")[1]) : 6;
  const abs = absArg ? Number(absArg.split("=")[1]) : 20;
  const ratio = ratioArg ? Number(ratioArg.split("=")[1]) : 5;
  printSoftSpots(fromLevel, abs, ratio);
} else if (levelArg) {
  const idx = Number(levelArg) - 1;
  if (idx < 0 || idx >= LEVELS.length) {
    console.error(`Level must be 1..${LEVELS.length}`);
    process.exit(1);
  }
  printLevel(idx, detail);
} else {
  for (let i = 0; i < LEVELS.length; i++) printLevel(i, detail);
  // Global summary
  console.log(`\n${C.bold}═══ Summary${C.reset}`);
  let totalWaves = 0;
  let clearable = 0;
  const problemWaves: string[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const { level, rows } = analyzeLevel(i);
    totalWaves += rows.length;
    for (const r of rows) {
      const feas = r.best ? r.best.potentialDamage / r.totalHp : 0;
      if (feas >= 1) clearable++;
      else problemWaves.push(`L${level.id}W${r.wave} (${fmt(feas, 2)}×)`);
    }
  }
  console.log(
    `${clearable}/${totalWaves} waves theoretically clearable ` +
      `${C.dim}(${((clearable / totalWaves) * 100).toFixed(1)}%)${C.reset}`,
  );
  if (problemWaves.length > 0) {
    console.log(`${C.red}Below 1.0×: ${problemWaves.join(", ")}${C.reset}`);
  }
}
