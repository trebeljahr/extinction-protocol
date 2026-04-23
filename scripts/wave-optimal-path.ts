/**
 * Optimal-path simulator — traces a cheapest-viable build across all waves
 * of a level, showing where each decision locks you in.
 *
 *   npx tsx scripts/wave-optimal-path.ts 19
 *   npx tsx scripts/wave-optimal-path.ts 19 --safety=1.3
 *   npx tsx scripts/wave-optimal-path.ts                 # all levels, compact
 *
 * Why this exists:
 *   wave-feasibility.ts checks each wave in isolation ("could you clear it
 *   with cumulative gold"). Reality is sequential: towers persist, the 35%
 *   sell loss means early commits are sticky, and bounty only arrives if
 *   you actually kill everything. A wave being "feasible" at 1.5× does not
 *   mean it's reachable — you also had to survive waves 1..N-1 without
 *   overspending on the wrong tower type.
 *
 * Model:
 *   For each wave, compute required_dps = totalHp / combatWindow × safety.
 *   Greedily pick the action (build X, or upgrade existing tower Y branch Z)
 *   with the best marginal DPS-per-gold against THIS wave's mix, until we
 *   hit the target or run out of gold. Towers persist; leftover gold rolls
 *   forward. Bounty + wave-clear bonus credited only on a full clear.
 *
 *   Greedy is myopic — it can over-commit to tower types that fall off
 *   later (chain/mortar vs armored). The "lock-in" column surfaces this:
 *   it's the sunk cost you can't get back via 65%-refund sell.
 */

import { LEVELS } from "../src/levels";
import {
  ENEMY_STATS,
  ENEMY_RESIST,
  TOWER_STATS,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  type TowerBaseStats,
} from "../src/sim/world";
import { UPGRADES } from "../src/sim/upgrades";
import { pathLength } from "../src/sim/path";
import type { EnemyKind, TowerKind, WaveSpec, Tower, Vec2 } from "../src/sim/types";
import { pathCoverage, coverageFraction } from "./lib/coverage";

// ------- Tower config (same shape as wave-feasibility.ts) -------

type Tier = 0 | 1 | 2 | 3;
type TowerConfig = TowerBaseStats & { kind: TowerKind; tierA: Tier; tierB: Tier; cost: number };

const buildConfig = (kind: TowerKind, tierA: Tier, tierB: Tier): TowerConfig => {
  const t = { ...TOWER_STATS[kind], upgrades: { a: 0, b: 0 } } as unknown as Tower;
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
    kind, tierA, tierB,
    range: t.range, damage: t.damage, fireRate: t.fireRate,
    splashRadius: t.splashRadius, chainCount: t.chainCount,
    chainFalloff: t.chainFalloff, slowFactor: t.slowFactor,
    slowDuration: t.slowDuration, cost,
  };
};

const aoeMultiplier = (kind: TowerKind, s: TowerConfig, enemiesOnScreen: number): number => {
  if (s.chainCount > 0) {
    let mult = 1;
    for (let i = 0; i < s.chainCount; i++) mult += Math.pow(s.chainFalloff, i + 1);
    return Math.min(mult, enemiesOnScreen);
  }
  if (s.splashRadius > 0) return Math.min(1 + s.splashRadius * 0.8, enemiesOnScreen);
  if (kind === "flame") return Math.min(3, enemiesOnScreen);
  // Hive fires 3 drones independently at their own targets — effective
  // 3× the nominal single-shot DPS, all single-target.
  if (kind === "hive") return Math.min(3, enemiesOnScreen);
  return 1;
};

// ------- Wave modeling -------

type WaveBreakdown = {
  totalHp: number;
  counts: Partial<Record<EnemyKind, number>>;
  totalEnemies: number;
  slowestSpeed: number;
};

const analyzeWave = (spec: WaveSpec, hpScale: number): WaveBreakdown => {
  const hpMul = (spec.hpMul ?? 1) * hpScale;
  const counts: Partial<Record<EnemyKind, number>> = {};
  let totalHp = 0, totalEnemies = 0, slowestSpeed = Infinity;
  for (const s of spec.spawns) {
    const stats = ENEMY_STATS[s.kind];
    counts[s.kind] = (counts[s.kind] ?? 0) + s.count;
    totalHp += stats.hp * hpMul * s.count;
    totalEnemies += s.count;
    if (stats.speed < slowestSpeed) slowestSpeed = stats.speed;
  }
  return { totalHp, counts, totalEnemies, slowestSpeed: isFinite(slowestSpeed) ? slowestSpeed : 1 };
};

const waveBounty = (spec: WaveSpec): number =>
  spec.spawns.reduce((n, s) => n + ENEMY_STATS[s.kind].bounty * s.count, 0);

const combatWindow = (spec: WaveSpec, waveNumber: number, w: WaveBreakdown, longestPath: number): number => {
  const spacing = spec.spacing ?? Math.max(0.35, 0.75 - waveNumber * 0.03);
  const spawnSpan = Math.max(0, (w.totalEnemies - 1) * spacing);
  return spawnSpan + longestPath / w.slowestSpeed;
};

const effectiveDpsForConfig = (cfg: TowerConfig, wave: WaveBreakdown): number => {
  const dmgType = TOWER_DAMAGE_TYPE[cfg.kind];
  let weightedResist = 0, totalHp = 0;
  for (const k of Object.keys(wave.counts) as EnemyKind[]) {
    const count = wave.counts[k] ?? 0;
    if (!count) continue;
    const hp = ENEMY_STATS[k].hp * count;
    weightedResist += ENEMY_RESIST[k][dmgType] * hp;
    totalHp += hp;
  }
  const avgResist = totalHp > 0 ? weightedResist / totalHp : 1;
  const aoe = aoeMultiplier(cfg.kind, cfg, Math.min(wave.totalEnemies, 10));
  return cfg.damage * cfg.fireRate * avgResist * aoe;
};

// ------- Simulation state -------

type TowerInstance = { kind: TowerKind; tierA: Tier; tierB: Tier };

type BuildAction = { type: "build"; kind: TowerKind; cost: number };
type UpgradeAction = {
  type: "upgrade"; towerIdx: number; branch: "a" | "b"; newTier: Tier; cost: number;
};
type Action = BuildAction | UpgradeAction;

type SimState = {
  gold: number;
  towers: TowerInstance[];
  spentByKind: Record<TowerKind, number>;
  totalSpent: number;
};

const emptySpentByKind = (): Record<TowerKind, number> =>
  Object.fromEntries((Object.keys(TOWER_STATS) as TowerKind[]).map(k => [k, 0])) as Record<TowerKind, number>;

const enumerateActions = (state: SimState): Action[] => {
  const out: Action[] = [];
  for (const kind of Object.keys(TOWER_STATS) as TowerKind[]) {
    out.push({ type: "build", kind, cost: TOWER_COST[kind] });
  }
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    if (t.tierA < 3) {
      out.push({
        type: "upgrade", towerIdx: i, branch: "a",
        newTier: (t.tierA + 1) as Tier,
        cost: UPGRADES[t.kind].a.tiers[t.tierA as 0 | 1 | 2].cost,
      });
    }
    if (t.tierB < 3) {
      out.push({
        type: "upgrade", towerIdx: i, branch: "b",
        newTier: (t.tierB + 1) as Tier,
        cost: UPGRADES[t.kind].b.tiers[t.tierB as 0 | 1 | 2].cost,
      });
    }
  }
  return out;
};

const applyAction = (state: SimState, action: Action): SimState => {
  const towers = state.towers.slice();
  const spentByKind = { ...state.spentByKind };
  let kind: TowerKind;
  if (action.type === "build") {
    towers.push({ kind: action.kind, tierA: 0, tierB: 0 });
    kind = action.kind;
  } else {
    const t = towers[action.towerIdx];
    towers[action.towerIdx] = {
      ...t,
      [action.branch === "a" ? "tierA" : "tierB"]: action.newTier,
    };
    kind = t.kind;
  }
  spentByKind[kind] += action.cost;
  return {
    gold: state.gold - action.cost,
    towers,
    spentByKind,
    totalSpent: state.totalSpent + action.cost,
  };
};

const totalEffectiveDps = (
  towers: TowerInstance[],
  wave: WaveBreakdown,
  paths: Vec2[][],
): number => {
  if (towers.length === 0) return 0;
  // Per-path-coverage depends on range — group towers by kind for the
  // coverage calc, then sum each group's effective DPS.
  let sum = 0;
  const grouped = new Map<TowerKind, TowerInstance[]>();
  for (const t of towers) {
    const arr = grouped.get(t.kind) ?? [];
    arr.push(t);
    grouped.set(t.kind, arr);
  }
  for (const [kind, group] of grouped) {
    let perKindDps = 0;
    for (const t of group) {
      perKindDps += effectiveDpsForConfig(buildConfig(t.kind, t.tierA, t.tierB), wave);
    }
    // Use the kind's base range for coverage — simpler than tracking
    // per-instance ranges when upgrades vary.
    const covPer = pathCoverage(paths, TOWER_STATS[kind].range);
    const covFrac = coverageFraction(group.length, covPer, paths.length);
    sum += perKindDps * covFrac;
  }
  return sum;
};

// ------- Simulation -------

type WaveStep = {
  wave: number;
  archetype: string;
  totalHp: number;
  durationSec: number;
  reqDps: number;
  goldIn: number;
  dpsBefore: number;
  dpsAfter: number;
  spentThisWave: number;
  actionsDesc: string;
  towersAfter: TowerInstance[];
  cleared: boolean;
  bountyEarned: number;
  goldOut: number;
};

type SimResult = {
  level: typeof LEVELS[number];
  history: WaveStep[];
  success: boolean;
  failedAt?: number;
  finalState: SimState;
};

const formatTower = (t: TowerInstance) => `${t.kind}[${t.tierA}/${t.tierB}]`;

const summarizeActions = (before: TowerInstance[], after: TowerInstance[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < after.length; i++) {
    if (i >= before.length) {
      parts.push(`+${formatTower(after[i])}`);
    } else if (before[i].tierA !== after[i].tierA || before[i].tierB !== after[i].tierB) {
      parts.push(`↑${after[i].kind}→${after[i].tierA}/${after[i].tierB}`);
    }
  }
  return parts.join(", ") || "—";
};

const simulate = (
  level: typeof LEVELS[number],
  safety: number,
  lookahead: number,
  forceFirstKind?: TowerKind,
): SimResult => {
  const hpScale = level.hpScale ?? 1;
  const longestPath = Math.max(...level.paths.map(pathLength));

  // Precompute wave breakdowns so lookahead is cheap
  const waveBreakdowns = level.waves.map(w => analyzeWave(w, hpScale));

  let state: SimState = {
    gold: level.startGold,
    towers: [],
    spentByKind: emptySpentByKind(),
    totalSpent: 0,
  };
  const history: WaveStep[] = [];

  for (let i = 0; i < level.waves.length; i++) {
    const spec = level.waves[i];
    const wave = waveBreakdowns[i];
    const dur = combatWindow(spec, i + 1, wave, longestPath);
    const reqDps = (wave.totalHp / dur) * safety;

    const towersBefore = state.towers.slice();
    const dpsBefore = totalEffectiveDps(state.towers, wave, level.paths);
    const goldIn = state.gold;

    // Lookahead slice — this wave + next (lookahead-1), weighted by
    // how tight each wave is (hp/duration). A lookahead of 1 is pure
    // myopic; higher values discourage over-fitting to the current wave.
    const horizonEnd = Math.min(level.waves.length, i + lookahead);

    // On the very first wave, optionally force the first BUILD action to
    // a specific tower kind (for comparing starter strategies).
    if (i === 0 && forceFirstKind && state.towers.length === 0) {
      const cost = TOWER_COST[forceFirstKind];
      if (cost <= state.gold) {
        state = applyAction(state, { type: "build", kind: forceFirstKind, cost });
      }
    }

    // Greedy loop: pick best marginal DPS/gold against the weighted horizon
    while (totalEffectiveDps(state.towers, wave, level.paths) < reqDps) {
      const actions = enumerateActions(state).filter(a => a.cost <= state.gold);
      if (actions.length === 0) break;

      let best: { action: Action; currentGain: number; scorePerGold: number } | null = null;
      for (const action of actions) {
        const trial = applyAction(state, action);
        const currentGain = totalEffectiveDps(trial.towers, wave, level.paths) - totalEffectiveDps(state.towers, wave, level.paths);
        if (currentGain <= 0) continue;

        // Score = weighted average of DPS-gain across current + horizon waves
        let weightedGain = 0;
        let weightSum = 0;
        for (let j = i; j < horizonEnd; j++) {
          const w = waveBreakdowns[j];
          const weight = w.totalHp; // tighter waves (more HP) count more
          const gain = totalEffectiveDps(trial.towers, w, level.paths) - totalEffectiveDps(state.towers, w, level.paths);
          weightedGain += weight * Math.max(0, gain);
          weightSum += weight;
        }
        const avgGain = weightSum > 0 ? weightedGain / weightSum : currentGain;
        const scorePerGold = avgGain / action.cost;
        if (!best || scorePerGold > best.scorePerGold) {
          best = { action, currentGain, scorePerGold };
        }
      }
      if (!best) break;
      state = applyAction(state, best.action);
    }

    const dpsAfter = totalEffectiveDps(state.towers, wave, level.paths);
    const cleared = dpsAfter >= reqDps;
    const bounty = cleared ? waveBounty(spec) + (5 + i + 1) : 0;
    const goldOut = state.gold + bounty;

    history.push({
      wave: i + 1,
      archetype: spec.archetype ?? "—",
      totalHp: wave.totalHp,
      durationSec: dur,
      reqDps,
      goldIn,
      dpsBefore,
      dpsAfter,
      spentThisWave: goldIn - state.gold,
      actionsDesc: summarizeActions(towersBefore, state.towers),
      towersAfter: state.towers.slice(),
      cleared,
      bountyEarned: bounty,
      goldOut,
    });

    if (!cleared) {
      return { level, history, success: false, failedAt: i + 1, finalState: state };
    }
    state = { ...state, gold: state.gold + bounty };
  }

  return { level, history, success: true, finalState: state };
};

// ------- Output -------

const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", magenta: "\x1b[35m", bold: "\x1b[1m", dim: "\x1b[2m",
};

const fmt = (n: number, d = 0) => n.toFixed(d);
const pad = (s: string | number, n: number) => String(s).padStart(n);
const padR = (s: string | number, n: number) => String(s).padEnd(n);

const portfolioString = (towers: TowerInstance[]): string => {
  const byKind: Partial<Record<TowerKind, number>> = {};
  for (const t of towers) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
  return Object.entries(byKind).map(([k, n]) => `${n}×${k}`).join(", ");
};

/**
 * "Chill analysis" — after the forward-sim has built a functional portfolio,
 * which waves required zero intervention (spent=0) AND had comfortable
 * margin (dpsBefore >> reqDps)? Flags stretches of 3+ consecutive chill
 * waves as potentially boring — the player is watching, not playing.
 */
const chillAnalysis = (safety: number, lookahead: number, marginMul: number, minStreak: number) => {
  type Streak = {
    level: typeof LEVELS[number];
    startWave: number;
    endWave: number;
    waves: { wave: number; arch: string; dpsBefore: number; reqDps: number; margin: number }[];
  };
  const allStreaks: Streak[] = [];
  const perLevelStats: {
    level: typeof LEVELS[number];
    totalWaves: number;
    chillWaves: number;
    longestStreak: number;
    streakRange: string;
  }[] = [];

  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const r = simulate(level, safety, lookahead);
    if (!r.success) continue;

    // Identify "true chill" waves: spent=0 AND dpsBefore > reqDps × marginMul
    const chill = r.history.map(h =>
      h.spentThisWave === 0 && h.dpsBefore >= h.reqDps * marginMul,
    );

    // Find consecutive runs of chill=true
    let longest = 0;
    let longestStart = 0;
    let i0 = 0;
    while (i0 < chill.length) {
      if (!chill[i0]) { i0++; continue; }
      let j = i0;
      while (j < chill.length && chill[j]) j++;
      const len = j - i0;
      if (len >= minStreak) {
        const segWaves = r.history.slice(i0, j).map(h => ({
          wave: h.wave,
          arch: h.archetype,
          dpsBefore: h.dpsBefore,
          reqDps: h.reqDps,
          margin: h.reqDps > 0 ? h.dpsBefore / h.reqDps : Infinity,
        }));
        allStreaks.push({
          level, startWave: r.history[i0].wave, endWave: r.history[j - 1].wave, waves: segWaves,
        });
      }
      if (len > longest) { longest = len; longestStart = i0; }
      i0 = j;
    }

    const chillCount = chill.filter(c => c).length;
    perLevelStats.push({
      level, totalWaves: r.history.length, chillWaves: chillCount,
      longestStreak: longest,
      streakRange: longest > 0
        ? `W${r.history[longestStart].wave}-W${r.history[longestStart + longest - 1].wave}`
        : "—",
    });
  }

  console.log(
    `\n${C.bold}═══ Chill analysis — where existing towers already clear the wave${C.reset}` +
    ` ${C.dim}(safety=${safety}×, chill margin ≥${marginMul}× req, min streak ${minStreak})${C.reset}`,
  );

  // Per-level overview
  console.log(
    `\n${C.dim}${padR("level", 30)} ${pad("waves", 5)} ${pad("chill", 5)} ${pad("%", 4)} ${pad("longest", 7)}  streak range${C.reset}`,
  );
  for (const s of perLevelStats) {
    const pct = Math.round((s.chillWaves / s.totalWaves) * 100);
    const streakColor = s.longestStreak >= 5 ? C.red : s.longestStreak >= 3 ? C.yellow : s.longestStreak >= 2 ? C.cyan : C.dim;
    console.log(
      `${padR(`L${s.level.id} ${s.level.name}`, 30)} ${pad(s.totalWaves, 5)} ${pad(s.chillWaves, 5)} ${pad(pct + "%", 4)} ${streakColor}${pad(s.longestStreak, 7)}${C.reset}  ${C.dim}${s.streakRange}${C.reset}`,
    );
  }

  // Detailed streaks (only long ones)
  if (allStreaks.length > 0) {
    console.log(`\n${C.bold}Long chill stretches (≥${minStreak} waves):${C.reset}`);
    for (const s of allStreaks) {
      const avgMargin = s.waves.reduce((a, b) => a + b.margin, 0) / s.waves.length;
      const marginStr = isFinite(avgMargin) ? `${fmt(avgMargin, 1)}×` : "∞";
      console.log(
        `  ${C.bold}L${s.level.id}${C.reset} ${padR(s.level.name, 22)} ${C.dim}W${s.startWave}-W${s.endWave}${C.reset}` +
        ` ${C.cyan}${s.waves.length} chill waves${C.reset} ${C.dim}avg margin ${marginStr}, archetypes: ${[...new Set(s.waves.map(w => w.arch))].join("/")}${C.reset}`,
      );
    }
  }

  // Global stats
  const totalWaves = perLevelStats.reduce((a, b) => a + b.totalWaves, 0);
  const totalChill = perLevelStats.reduce((a, b) => a + b.chillWaves, 0);
  console.log(
    `\n${C.bold}═══ Totals${C.reset}  ${totalChill}/${totalWaves} chill waves ${C.dim}(${((totalChill / totalWaves) * 100).toFixed(1)}%)${C.reset}` +
    `, ${allStreaks.length} stretches ≥${minStreak} long`,
  );
};

const compareStarters = (levelIdx: number, safety: number, lookahead: number) => {
  const level = LEVELS[levelIdx];
  console.log(
    `\n${C.bold}═══ L${level.id}: ${level.name} — starter comparison${C.reset} ` +
    `${C.dim}(safety=${safety}×, lookahead=${lookahead})${C.reset}`,
  );
  console.log(
    `${C.dim}${padR("starter", 9)} ${padR("result", 10)} ${pad("waves", 6)} ${pad("spent", 6)} ${pad("endGold", 7)}  final portfolio${C.reset}`,
  );
  const kinds = ["(greedy)", ...(Object.keys(TOWER_STATS) as TowerKind[])] as const;
  for (const starter of kinds) {
    const r = simulate(level, safety, lookahead, starter === "(greedy)" ? undefined : starter);
    const cleared = r.success ? r.history.length : (r.failedAt ?? 0) - 1;
    const status = r.success
      ? `${C.green}CLEARED${C.reset}  `
      : `${C.red}fail@W${r.failedAt}${C.reset}`;
    const portfolio = portfolioString(r.finalState.towers) || "—";
    console.log(
      `${padR(starter, 9)} ${status}   ${pad(cleared, 6)} ${pad(r.finalState.totalSpent, 6)} ${pad(r.finalState.gold, 7)}  ${portfolio}`,
    );
  }
};

const printLevel = (
  levelIdx: number,
  safety: number,
  lookahead: number,
  verbose: boolean,
  result?: SimResult,
) => {
  result = result ?? simulate(LEVELS[levelIdx], safety, lookahead);
  const { level, history, success } = result;

  console.log(
    `\n${C.bold}═══ L${level.id}: ${level.name}${C.reset}` +
    `${level.hpScale ? ` ${C.dim}(hpScale ${level.hpScale}×)${C.reset}` : ""}` +
    ` ${C.dim}startGold=${level.startGold}, safety=${safety}×${C.reset}`,
  );
  console.log(
    `${C.dim}${pad("W", 3)} ${padR("arch", 7)} ${pad("reqDPS", 7)} ${pad("before", 7)} ${pad("after", 7)} ${pad("spent", 6)} ${pad("goldOut", 7)}  actions${C.reset}`,
  );

  for (const s of history) {
    const tight = s.goldOut < 50 ? C.red : s.goldOut < 200 ? C.yellow : "";
    const hitMark = s.cleared ? "" : `${C.red} ✗${C.reset}`;
    console.log(
      `${pad(s.wave, 3)} ${padR(s.archetype, 7)} ${pad(fmt(s.reqDps, 0), 7)} ${pad(fmt(s.dpsBefore, 0), 7)} ${pad(fmt(s.dpsAfter, 0), 7)} ` +
      `${pad(s.spentThisWave, 6)} ${tight}${pad(s.goldOut, 7)}${tight ? C.reset : ""}  ${s.actionsDesc}${hitMark}`,
    );
    if (verbose) {
      console.log(`    ${C.dim}portfolio: ${portfolioString(s.towersAfter)}${C.reset}`);
    }
  }

  // Summary
  if (!success) {
    console.log(`${C.red}  ✗ INFEASIBLE at wave ${result.failedAt} — greedy min-cost couldn't meet ${safety}× required DPS${C.reset}`);
  }

  const finalPortfolio = portfolioString(result.finalState.towers);
  const spentByKind = result.finalState.spentByKind;
  const spentEntries = (Object.entries(spentByKind) as [TowerKind, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const lockIn = spentEntries.map(([k, v]) => `${k} ${v}g (sunk ${Math.floor(v * 0.35)}g)`).join(", ");
  console.log(`${C.dim}  portfolio: ${finalPortfolio || "—"}${C.reset}`);
  console.log(`${C.dim}  total spent ${result.finalState.totalSpent}g; lock-in (35% non-refundable): ${lockIn || "—"}${C.reset}`);

  // Tightest waves
  const byTightness = [...history]
    .map(s => ({ wave: s.wave, slack: s.goldOut, arch: s.archetype, spent: s.spentThisWave }))
    .sort((a, b) => a.slack - b.slack)
    .slice(0, 3);
  console.log(
    `${C.dim}  tightest: ${byTightness.map(t => `W${t.wave}(${t.arch}, goldOut=${t.slack})`).join(", ")}${C.reset}`,
  );
};

// ------- CLI -------

declare const process: { argv: string[]; exit(code: number): never };

const args = process.argv.slice(2);
const safetyArg = args.find((a: string) => a.startsWith("--safety="));
const safety = safetyArg ? Number(safetyArg.split("=")[1]) : 1.2;
const lookaheadArg = args.find((a: string) => a.startsWith("--lookahead="));
const lookahead = lookaheadArg ? Number(lookaheadArg.split("=")[1]) : 3;
const verbose = args.includes("--verbose") || args.includes("-v");
const compareMode = args.includes("--compare-starters");
const chillMode = args.includes("--chill");
const marginArg = args.find((a: string) => a.startsWith("--margin="));
const marginMul = marginArg ? Number(marginArg.split("=")[1]) : 1.5;
const minStreakArg = args.find((a: string) => a.startsWith("--min-streak="));
const minStreak = minStreakArg ? Number(minStreakArg.split("=")[1]) : 3;
const forceFirstArg = args.find((a: string) => a.startsWith("--force-first="));
const forceFirst = forceFirstArg
  ? (forceFirstArg.split("=")[1] as TowerKind)
  : undefined;
const levelArg = args.find((a: string) => /^\d+$/.test(a));

if (!Number.isFinite(safety) || safety <= 0) {
  console.error("Invalid --safety value");
  process.exit(1);
}
if (!Number.isFinite(lookahead) || lookahead < 1) {
  console.error("Invalid --lookahead value (must be >= 1)");
  process.exit(1);
}

if (forceFirst && !(forceFirst in TOWER_STATS)) {
  console.error(`Unknown tower kind: ${forceFirst}. Valid: ${Object.keys(TOWER_STATS).join(", ")}`);
  process.exit(1);
}

if (chillMode) {
  chillAnalysis(safety, lookahead, marginMul, minStreak);
  process.exit(0);
}

if (levelArg) {
  const idx = Number(levelArg) - 1;
  if (idx < 0 || idx >= LEVELS.length) {
    console.error(`Level must be 1..${LEVELS.length}`);
    process.exit(1);
  }
  if (compareMode) {
    compareStarters(idx, safety, lookahead);
  } else {
    const result = simulate(LEVELS[idx], safety, lookahead, forceFirst);
    printLevel(idx, safety, lookahead, verbose, result);
  }
} else {
  for (let i = 0; i < LEVELS.length; i++) {
    const result = simulate(LEVELS[i], safety, lookahead, forceFirst);
    printLevel(i, safety, lookahead, verbose, result);
  }
  // Cross-level summary: where does min-cost play break?
  console.log(`\n${C.bold}═══ Summary${C.reset}`);
  const failed: string[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const r = simulate(LEVELS[i], safety, lookahead, forceFirst);
    if (!r.success) failed.push(`L${r.level.id}W${r.failedAt}`);
  }
  if (failed.length === 0) {
    console.log(`${C.green}All ${LEVELS.length} levels clearable with greedy min-cost @ safety=${safety}×${C.reset}`);
  } else {
    console.log(`${C.red}Min-cost breaks at: ${failed.join(", ")}${C.reset}`);
  }
}
