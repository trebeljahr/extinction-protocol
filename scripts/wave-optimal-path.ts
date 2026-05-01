/**
 * Optimal-path simulator — traces a cheapest-viable build across all waves
 * of a level, showing where each decision locks you in.
 *
 *   npx tsx scripts/wave-optimal-path.ts 19
 *   npx tsx scripts/wave-optimal-path.ts 19 --safety=1.3
 *   npx tsx scripts/wave-optimal-path.ts 19 --beam=8     # beam search
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
 *   For each wave, compute required_dps = totalHp / combatWindow × safety,
 *   per lane. Combat window is extended by slow-tower coverage (cryo's slow
 *   factor, modulated by per-enemy slow resist). Greedily pick the action
 *   (build kind K at placement-class P, or upgrade tower Y branch Z) with
 *   the best deficit-reducing score per gold, until every lane meets its
 *   reqDps or we run out of affordable actions. Towers persist; leftover
 *   gold rolls forward. Bounty + wave-clear bonus credited only on full
 *   clear of every lane with enemies.
 *
 *   Greedy is myopic — it picks the locally-best action, which can lose
 *   to a portfolio that's worse this wave but better at wave N+3. Pass
 *   --beam=K to enable beam search: at every wave, expand each beam node
 *   into a greedy successor plus one (kind, placement) forced successor
 *   per kind × placement-class, dedupe by portfolio, prune to top K by
 *   (lowest totalSpent, highest gold). K=2 is enough to clear the levels
 *   that defeat greedy at safety=1.2×; K=4–8 finds cheaper portfolios at
 *   higher safety margins. Cost is roughly K × placement_classes × kinds
 *   × greedy_cost — slow on 4+ path levels but tractable.
 *
 *   The "lock-in" column shows sunk cost you can't get back via 65%-refund
 *   sell — useful for spotting greedy over-commits to falling-off kinds.
 */

import { LEVELS } from "../src/levels";
import { pathLength } from "../src/sim/path";
import type { DamageType, EnemyKind, Tower, TowerKind, Vec2, WaveSpec } from "../src/sim/types";
import { UPGRADES } from "../src/sim/upgrades";
import {
  ELITE_RESIST_FLATTEN,
  ENEMY_RESIST,
  ENEMY_SLOW_RESIST,
  ENEMY_STATS,
  MIN_SLOW_FACTOR,
  SHIELD_BY_KIND,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  TOWER_STATS,
  type TowerBaseStats,
} from "../src/sim/world";
import { enumeratePlacementClasses } from "./lib/coverage";

// ------- Tower config (same shape as wave-feasibility.ts) -------

type Tier = 0 | 1 | 2 | 3;
type TowerConfig = TowerBaseStats & {
  kind: TowerKind;
  tierA: Tier;
  tierB: Tier;
  cost: number;
  // T3 anti-modifier abilities — defaults inert; specific T3 upgrades
  // turn them on so the simulator picks T3 for adaptive-wave reasons.
  shieldDamageMul: number;
  armorPierce: boolean;
  resistStrip: number;
  regenSuppressOnHit: number;
  freezeBlocksRegen: boolean;
};

// Memoized — kind/tier combos are bounded (6 × 4 × 4 = 96 distinct keys),
// and buildConfig is called in tight inner loops by dpsPerLane and the
// slow-factor calc. Without this, beam search spends ~70% of its time
// rebuilding identical configs.
const buildConfigCache = new Map<string, TowerConfig>();
const buildConfig = (kind: TowerKind, tierA: Tier, tierB: Tier): TowerConfig => {
  const key = `${kind}-${tierA}-${tierB}`;
  const hit = buildConfigCache.get(key);
  if (hit) return hit;
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
  const out: TowerConfig = {
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
    shieldDamageMul: t.shieldDamageMul ?? 1,
    armorPierce: t.armorPierce ?? false,
    resistStrip: t.resistStrip ?? 0,
    regenSuppressOnHit: t.regenSuppressOnHit ?? 0,
    freezeBlocksRegen: t.freezeBlocksRegen ?? false,
  };
  buildConfigCache.set(key, out);
  return out;
};

const aoeMultiplier = (kind: TowerKind, s: TowerConfig, enemiesOnScreen: number): number => {
  if (s.chainCount > 0) {
    let mult = 1;
    for (let i = 0; i < s.chainCount; i++) mult += s.chainFalloff ** (i + 1);
    return Math.min(mult, enemiesOnScreen);
  }
  if (s.splashRadius > 0) return Math.min(1 + s.splashRadius * 0.8, enemiesOnScreen);
  if (kind === "flame") return Math.min(3, enemiesOnScreen);
  // Hive fires 3 drones independently at their own targets — effective
  // 3× the nominal single-shot DPS, all single-target.
  if (kind === "hive") return Math.min(3, enemiesOnScreen);
  return 1;
};

// ------- Wave modeling (per-lane) -------
//
// A wave is decomposed into one WaveBreakdown per path index. Towers are
// committed to a specific lane, so DPS is tracked per-lane. Clearance
// requires every lane with enemies to meet its own reqDPS — no averaging
// across lanes.

// A "group" is an enemy sub-population sharing kind + chip flags. Chips
// (shielded/regen/resists) override base behaviour per-spawn, so the
// resist calc must happen at the group level not just by kind.
type EnemyGroup = {
  kind: EnemyKind;
  count: number;
  hp: number; // total HP for this group (per-enemy hp × count, post hpMul)
  shielded: boolean; // applies SHIELD_BY_KIND[kind] to each enemy
  regen: boolean;
  elite: boolean;
  extraResists: Partial<Record<DamageType, number>>; // resists chip
};

type WaveBreakdown = {
  totalHp: number;
  totalShield: number; // sum of per-enemy SHIELD_BY_KIND × count, lane-wide
  hasRegen: boolean; // any group on this lane carries the regen chip
  counts: Partial<Record<EnemyKind, number>>;
  groups: EnemyGroup[];
  totalEnemies: number;
  slowestSpeed: number;
};

const analyzeWavePerLane = (spec: WaveSpec, hpScale: number, numPaths: number): WaveBreakdown[] => {
  const hpMul = (spec.hpMul ?? 1) * hpScale;
  const perLane: WaveBreakdown[] = Array.from({ length: numPaths }, () => ({
    totalHp: 0,
    totalShield: 0,
    hasRegen: false,
    counts: {},
    groups: [],
    totalEnemies: 0,
    slowestSpeed: Number.POSITIVE_INFINITY,
  }));
  for (const s of spec.spawns) {
    const stats = ENEMY_STATS[s.kind];
    const pi = Math.min(numPaths - 1, Math.max(0, s.pathIndex ?? 0));
    const w = perLane[pi];
    const groupHp = stats.hp * hpMul * s.count;
    const shieldPer = s.shielded ? (SHIELD_BY_KIND[s.kind] ?? 0) : 0;
    w.counts[s.kind] = (w.counts[s.kind] ?? 0) + s.count;
    w.totalHp += groupHp;
    w.totalShield += shieldPer * s.count;
    w.totalEnemies += s.count;
    if (s.regen) w.hasRegen = true;
    w.groups.push({
      kind: s.kind,
      count: s.count,
      hp: groupHp,
      shielded: !!s.shielded,
      regen: !!s.regen,
      elite: !!s.elite,
      extraResists: s.resists ?? {},
    });
    if (stats.speed < w.slowestSpeed) w.slowestSpeed = stats.speed;
  }
  for (const w of perLane) {
    if (!Number.isFinite(w.slowestSpeed)) w.slowestSpeed = 1;
  }
  return perLane;
};

const waveBounty = (spec: WaveSpec): number =>
  spec.spawns.reduce((n, s) => n + ENEMY_STATS[s.kind].bounty * s.count, 0);

// Mirrors src/sim/world.ts:applySlow — computes the effective slow factor
// applied to a single enemy kind by a tower with the given base slowFactor.
// MIN_SLOW_FACTOR caps the maximum slow effect.
const effectiveSlowOnEnemy = (towerSlowFactor: number, enemyKind: EnemyKind): number => {
  if (towerSlowFactor >= 1) return 1;
  const resist = ENEMY_SLOW_RESIST[enemyKind];
  const resisted = towerSlowFactor + (1 - towerSlowFactor) * resist;
  return Math.max(MIN_SLOW_FACTOR, resisted);
};

// The slow factor applied to the slowest enemy kind on this lane — that
// enemy bottlenecks combat-window length (longestPath / slowestSpeed).
// We assume slow uptime is full when at least one slow-applying tower is
// committed to the lane (cryo's slowDuration >= fireInterval, so a single
// cryo can keep one or two lanes saturated).
const slowFactorForLane = (
  towers: TowerInstance[],
  laneIdx: number,
  perLaneWave: WaveBreakdown,
): number => {
  if (perLaneWave.totalEnemies === 0) return 1;

  let slowestKind: EnemyKind | null = null;
  let slowestSpeed = Number.POSITIVE_INFINITY;
  for (const k of Object.keys(perLaneWave.counts) as EnemyKind[]) {
    if ((perLaneWave.counts[k] ?? 0) === 0) continue;
    const speed = ENEMY_STATS[k].speed;
    if (speed < slowestSpeed) {
      slowestSpeed = speed;
      slowestKind = k;
    }
  }
  if (!slowestKind) return 1;

  let bestSlow = 1;
  for (const t of towers) {
    if (!t.lanes.includes(laneIdx)) continue;
    const cfg = buildConfig(t.kind, t.tierA, t.tierB);
    if (cfg.slowFactor >= 1) continue;
    const eff = effectiveSlowOnEnemy(cfg.slowFactor, slowestKind);
    if (eff < bestSlow) bestSlow = eff;
  }
  return bestSlow;
};

// Mortar T3 (Singularity) doubles shield damage. Highest-tier mortar in
// the lane wins — no compounding across multiple shield-pierce towers.
const shieldMulForLane = (towers: TowerInstance[], laneIdx: number): number => {
  let best = 1;
  for (const t of towers) {
    if (!t.lanes.includes(laneIdx)) continue;
    const cfg = buildConfig(t.kind, t.tierA, t.tierB);
    if (cfg.shieldDamageMul > best) best = cfg.shieldDamageMul;
  }
  return best;
};

// Pyre T3 napalm and Cryo T3 freeze-lock fully suppress regen in this
// model — both extend the regen pause indefinitely while a tower with
// the upgrade keeps hitting the lane.
const regenEffectivenessForLane = (towers: TowerInstance[], laneIdx: number): number => {
  for (const t of towers) {
    if (!t.lanes.includes(laneIdx)) continue;
    const cfg = buildConfig(t.kind, t.tierA, t.tierB);
    if (cfg.regenSuppressOnHit > 0) return 0;
    if (cfg.freezeBlocksRegen) return 0;
  }
  return 1;
};

// reqDps depends on the current portfolio (slow towers extend the combat
// window, lowering reqDps). This is recomputed each greedy iteration.
//
// Modifier accounting:
//  - shielded chip (totalShield): folded into effective HP. Mortar T3 /
//    Hive aura halve or further reduce its contribution via shieldMul.
//  - regen chip (hasRegen): adds a continuous HP-restoration term scaled
//    by regen effectiveness (Pyre T3 / Cryo T3 / Hive aura suppress it).
const reqDpsForState = (
  spec: WaveSpec,
  waveNumber: number,
  perLane: WaveBreakdown[],
  pathLengths: number[],
  safety: number,
  towers: TowerInstance[],
): number[] => {
  const spacing = spec.spacing ?? Math.max(0.35, 0.75 - waveNumber * 0.03);
  return perLane.map((w, i) => {
    if (w.totalEnemies === 0) return 0;
    const slow = slowFactorForLane(towers, i, w);
    const spawnSpan = Math.max(0, (w.totalEnemies - 1) * spacing);
    const dur = spawnSpan + pathLengths[i] / (w.slowestSpeed * slow);
    const shieldMul = shieldMulForLane(towers, i);
    const regenEff = regenEffectivenessForLane(towers, i);
    const effectiveHp = w.totalHp + w.totalShield / shieldMul;
    // Regen chip pulls REGEN_RATE = 1.5 HP/s/regen-enemy on average. Use a
    // conservative midpoint estimate (half of regen HP recovers) since
    // damage-pause partially neutralises continuous regen.
    let regenHpPerSec = 0;
    if (w.hasRegen) {
      let regenCount = 0;
      for (const g of w.groups) if (g.regen) regenCount += g.count;
      regenHpPerSec = regenCount * 1.5 * regenEff * 0.5;
    }
    return (effectiveHp / dur + regenHpPerSec) * safety;
  });
};

const effectiveDpsForConfig = (cfg: TowerConfig, wave: WaveBreakdown): number => {
  if (wave.totalEnemies === 0) return 0;
  const dmgType = TOWER_DAMAGE_TYPE[cfg.kind];
  let weightedResist = 0;
  let totalHp = 0;
  // Iterate groups so per-spawn `resists` chip + `elite` chip override
  // base resist on the right population. Weighting by group HP keeps a
  // 12-of-20 flame-immune swarm correctly dropping flame's effective DPS.
  for (const g of wave.groups) {
    const baseMul = ENEMY_RESIST[g.kind][dmgType];
    // Elite flatten — same formula as applyDamage.
    const eliteMul = g.elite ? baseMul + (1 - baseMul) * ELITE_RESIST_FLATTEN : baseMul;
    let extra = g.extraResists[dmgType] ?? 1;
    // Pulse T3 (Annihilator): clamp adaptation-induced resists ≥1 for the
    // tower's own damage type. Adapted enemies stop dodging armour pierce.
    if (cfg.armorPierce && extra < 1) extra = 1;
    // Chain T3 (Arc Furnace): per-hit strip pulls extraResist toward 1
    // over the combat window. Conservative midpoint approximation.
    else if (cfg.resistStrip > 0 && extra < 1) extra = (extra + 1) / 2;
    weightedResist += eliteMul * extra * g.hp;
    totalHp += g.hp;
  }
  const avgResist = totalHp > 0 ? weightedResist / totalHp : 1;
  const aoe = aoeMultiplier(cfg.kind, cfg, Math.min(wave.totalEnemies, 10));
  return cfg.damage * cfg.fireRate * avgResist * aoe;
};

// ------- Simulation state -------
//
// Each tower commits to a placement class — the sorted list of path
// indices it covers from its placement spot. A tower covering multiple
// active lanes splits its DPS evenly across them (time-share model:
// can only fire at one lane at a time when multiple lanes have enemies).

type TowerInstance = { kind: TowerKind; tierA: Tier; tierB: Tier; lanes: number[] };

type BuildAction = { type: "build"; kind: TowerKind; cost: number; lanes: number[] };
type UpgradeAction = {
  type: "upgrade";
  towerIdx: number;
  branch: "a" | "b";
  newTier: Tier;
  cost: number;
};
type Action = BuildAction | UpgradeAction;

type SimState = {
  gold: number;
  towers: TowerInstance[];
  spentByKind: Record<TowerKind, number>;
  totalSpent: number;
};

const emptySpentByKind = (): Record<TowerKind, number> =>
  Object.fromEntries((Object.keys(TOWER_STATS) as TowerKind[]).map((k) => [k, 0])) as Record<
    TowerKind,
    number
  >;

type PlacementOptions = Record<TowerKind, number[][]>;

const computePlacementOptions = (paths: Vec2[][]): PlacementOptions => {
  const out = {} as PlacementOptions;
  for (const kind of Object.keys(TOWER_STATS) as TowerKind[]) {
    out[kind] = enumeratePlacementClasses(paths, TOWER_STATS[kind].range);
  }
  return out;
};

const enumerateActions = (state: SimState, placements: PlacementOptions): Action[] => {
  const out: Action[] = [];
  for (const kind of Object.keys(TOWER_STATS) as TowerKind[]) {
    for (const lanes of placements[kind]) {
      out.push({ type: "build", kind, cost: TOWER_COST[kind], lanes });
    }
  }
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    if (t.tierA < 3) {
      out.push({
        type: "upgrade",
        towerIdx: i,
        branch: "a",
        newTier: (t.tierA + 1) as Tier,
        cost: UPGRADES[t.kind].a.tiers[t.tierA as 0 | 1 | 2].cost,
      });
    }
    if (t.tierB < 3) {
      out.push({
        type: "upgrade",
        towerIdx: i,
        branch: "b",
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
    towers.push({ kind: action.kind, tierA: 0, tierB: 0, lanes: action.lanes });
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

/**
 * Per-lane DPS contribution. A tower covering multiple active lanes
 * splits its effective DPS evenly across them — the time-share approx.
 * A tower's covered lanes that have no enemies this wave are ignored
 * (the tower fires at lanes that have targets).
 *
 * Damage type and resists are evaluated per lane (the tower's damage
 * type is fixed, but the lane it's hitting determines which enemies
 * resist what).
 */
const dpsPerLane = (towers: TowerInstance[], perLane: WaveBreakdown[]): number[] => {
  const out: number[] = perLane.map(() => 0);
  if (towers.length === 0) return out;

  for (const t of towers) {
    const cfg = buildConfig(t.kind, t.tierA, t.tierB);
    const active = t.lanes.filter((l) => l < perLane.length && perLane[l].totalEnemies > 0);
    if (active.length === 0) continue;
    const split = 1 / active.length;
    for (const laneIdx of active) {
      out[laneIdx] += effectiveDpsForConfig(cfg, perLane[laneIdx]) * split;
    }
  }
  return out;
};

const allLanesCleared = (dps: number[], reqDps: number[]): boolean => {
  for (let i = 0; i < dps.length; i++) {
    if (reqDps[i] > 0 && dps[i] < reqDps[i]) return false;
  }
  return true;
};

// ------- Simulation -------

type WaveStep = {
  wave: number;
  archetype: string;
  totalHp: number;
  reqDpsByLane: number[];
  goldIn: number;
  dpsBeforeByLane: number[];
  dpsAfterByLane: number[];
  spentThisWave: number;
  actionsDesc: string;
  towersAfter: TowerInstance[];
  cleared: boolean;
  bottleneckLane: number; // worst lane (largest deficit / req ratio) for display
  bountyEarned: number;
  goldOut: number;
};

type SimResult = {
  level: (typeof LEVELS)[number];
  history: WaveStep[];
  success: boolean;
  failedAt?: number;
  finalState: SimState;
};

const formatLanes = (lanes: number[]): string =>
  lanes.length === 1 ? `L${lanes[0]}` : `L${lanes.join("+")}`;

const formatTower = (t: TowerInstance) =>
  `${t.kind}[${t.tierA}/${t.tierB}]@${formatLanes(t.lanes)}`;

const summarizeActions = (before: TowerInstance[], after: TowerInstance[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < after.length; i++) {
    if (i >= before.length) {
      parts.push(`+${formatTower(after[i])}`);
    } else if (before[i].tierA !== after[i].tierA || before[i].tierB !== after[i].tierB) {
      parts.push(
        `↑${after[i].kind}→${after[i].tierA}/${after[i].tierB}@${formatLanes(after[i].lanes)}`,
      );
    }
  }
  return parts.join(", ") || "—";
};

const findBottleneckLane = (dps: number[], reqDps: number[]): number => {
  let worst = 0;
  let worstRatio = Number.POSITIVE_INFINITY;
  for (let i = 0; i < dps.length; i++) {
    if (reqDps[i] === 0) continue;
    const r = dps[i] / reqDps[i];
    if (r < worstRatio) {
      worstRatio = r;
      worst = i;
    }
  }
  return worst;
};

// Run the prep-window greedy for ONE wave starting from `inState`. Returns
// the post-prep state plus a WaveStep. Does NOT add bounty to gold — the
// caller does that only on a clear, since beam search stages successors.
//
// `forceFirst` (optional) places a build of the given (kind, lanes) BEFORE
// the greedy loop starts. Used by both compare-starters and beam search to
// seed wave prep with a non-greedy first action.
const prepAndClearWave = (
  inState: SimState,
  level: (typeof LEVELS)[number],
  waveIdx: number,
  perLaneByWave: WaveBreakdown[][],
  pathLengths: number[],
  safety: number,
  lookahead: number,
  placements: PlacementOptions,
  forceFirst?: { kind: TowerKind; lanes: number[] },
): { state: SimState; step: WaveStep } => {
  const spec = level.waves[waveIdx];
  const perLane = perLaneByWave[waveIdx];
  const horizonEnd = Math.min(level.waves.length, waveIdx + lookahead);

  let state = inState;
  const towersBefore = state.towers.slice();
  const dpsBefore = dpsPerLane(state.towers, perLane);
  const goldIn = state.gold;

  if (forceFirst) {
    const cost = TOWER_COST[forceFirst.kind];
    if (cost <= state.gold) {
      state = applyAction(state, {
        type: "build",
        kind: forceFirst.kind,
        cost,
        lanes: forceFirst.lanes,
      });
    }
  }

  // Greedy loop: pick best marginal deficit-reducing DPS/gold across
  // the lookahead horizon. reqDps recomputed each iteration since slow
  // towers in the portfolio extend the combat window for slow-vulnerable
  // enemies (raptor, swarm, allosaur, para — slow resist 0).
  //
  // Performance: the per-state values (dpsPerLane, reqDpsForState,
  // wave-totalHp) are constant across all candidate actions in a single
  // iteration of this loop. Compute them ONCE here, then iterate actions.
  while (true) {
    const reqDps = reqDpsForState(spec, waveIdx + 1, perLane, pathLengths, safety, state.towers);
    const beforeDps = dpsPerLane(state.towers, perLane);
    if (allLanesCleared(beforeDps, reqDps)) break;
    const actions = enumerateActions(state, placements).filter((a) => a.cost <= state.gold);
    if (actions.length === 0) break;

    // Per-state precomputation across the horizon.
    const horizonReqBefore: number[][] = [];
    const horizonDpsBefore: number[][] = [];
    const horizonWeights: number[] = [];
    for (let j = waveIdx; j < horizonEnd; j++) {
      const lw = perLaneByWave[j];
      horizonReqBefore.push(
        reqDpsForState(level.waves[j], j + 1, lw, pathLengths, safety, state.towers),
      );
      horizonDpsBefore.push(dpsPerLane(state.towers, lw));
      horizonWeights.push(lw.reduce((s, p) => s + p.totalHp, 0));
    }

    let best: { action: Action; scorePerGold: number } | null = null;

    for (const action of actions) {
      const trial = applyAction(state, action);
      const afterDps = dpsPerLane(trial.towers, perLane);
      const reqDpsTrial = reqDpsForState(
        spec,
        waveIdx + 1,
        perLane,
        pathLengths,
        safety,
        trial.towers,
      );

      // Reject actions that don't strictly help close the deficit on the
      // current wave (either by adding DPS or shrinking reqDps via slow).
      let currentDeficitReduction = 0;
      for (let k = 0; k < reqDps.length; k++) {
        currentDeficitReduction +=
          Math.max(0, reqDps[k] - beforeDps[k]) - Math.max(0, reqDpsTrial[k] - afterDps[k]);
      }
      if (currentDeficitReduction <= 0) continue;

      // Score = HP-weighted average across horizon of (deficit reduction
      // for current wave) + (raw per-lane DPS gain for future waves).
      let weightedScore = 0;
      let weightSum = 0;
      for (let j = waveIdx; j < horizonEnd; j++) {
        const idx = j - waveIdx;
        const lw = perLaneByWave[j];
        const lreqBefore = horizonReqBefore[idx];
        const lreqAfter =
          j === waveIdx
            ? reqDpsTrial
            : reqDpsForState(level.waves[j], j + 1, lw, pathLengths, safety, trial.towers);
        const beforeJ = horizonDpsBefore[idx];
        const afterJ = j === waveIdx ? afterDps : dpsPerLane(trial.towers, lw);

        let val = 0;
        if (j === waveIdx) {
          for (let k = 0; k < lreqAfter.length; k++) {
            val += Math.max(0, lreqBefore[k] - beforeJ[k]) - Math.max(0, lreqAfter[k] - afterJ[k]);
          }
        } else {
          for (let k = 0; k < lreqAfter.length; k++) {
            // Reward DPS gain AND reqDps reduction (slow effect).
            val += Math.max(0, afterJ[k] - beforeJ[k]) + Math.max(0, lreqBefore[k] - lreqAfter[k]);
          }
        }
        weightedScore += horizonWeights[idx] * Math.max(0, val);
        weightSum += horizonWeights[idx];
      }
      const avgScore = weightSum > 0 ? weightedScore / weightSum : currentDeficitReduction;
      const scorePerGold = avgScore / action.cost;
      if (!best || scorePerGold > best.scorePerGold) {
        best = { action, scorePerGold };
      }
    }
    if (!best) break;
    state = applyAction(state, best.action);
  }

  const dpsAfter = dpsPerLane(state.towers, perLane);
  const reqDpsFinal = reqDpsForState(spec, waveIdx + 1, perLane, pathLengths, safety, state.towers);
  const cleared = allLanesCleared(dpsAfter, reqDpsFinal);
  const bounty = cleared ? waveBounty(spec) + (5 + waveIdx + 1) : 0;
  const goldOut = state.gold + bounty;
  const totalHp = perLane.reduce((s, w) => s + w.totalHp, 0);

  const step: WaveStep = {
    wave: waveIdx + 1,
    archetype: spec.archetype ?? "—",
    totalHp,
    reqDpsByLane: reqDpsFinal,
    goldIn,
    dpsBeforeByLane: dpsBefore,
    dpsAfterByLane: dpsAfter,
    spentThisWave: goldIn - state.gold,
    actionsDesc: summarizeActions(towersBefore, state.towers),
    towersAfter: state.towers.slice(),
    cleared,
    bottleneckLane: findBottleneckLane(dpsAfter, reqDpsFinal),
    bountyEarned: bounty,
    goldOut,
  };

  return { state, step };
};

const initialState = (level: (typeof LEVELS)[number]): SimState => ({
  gold: level.startGold,
  towers: [],
  spentByKind: emptySpentByKind(),
  totalSpent: 0,
});

const simulate = (
  level: (typeof LEVELS)[number],
  safety: number,
  lookahead: number,
  forceFirstKind?: TowerKind,
): SimResult => {
  const hpScale = level.hpScale ?? 1;
  const numPaths = level.paths.length;
  const pathLengths = level.paths.map(pathLength);
  const placements = computePlacementOptions(level.paths);
  const perLaneByWave = level.waves.map((w) => analyzeWavePerLane(w, hpScale, numPaths));

  let state = initialState(level);
  const history: WaveStep[] = [];

  for (let i = 0; i < level.waves.length; i++) {
    const force =
      i === 0 && forceFirstKind
        ? { kind: forceFirstKind, lanes: placements[forceFirstKind][0] ?? [0] }
        : undefined;
    const r = prepAndClearWave(
      state,
      level,
      i,
      perLaneByWave,
      pathLengths,
      safety,
      lookahead,
      placements,
      force,
    );
    history.push(r.step);
    if (!r.step.cleared) {
      return { level, history, success: false, failedAt: i + 1, finalState: r.state };
    }
    state = { ...r.state, gold: r.state.gold + r.step.bountyEarned };
  }

  return { level, history, success: true, finalState: state };
};

// Beam search: at each wave, expand each beam node into a greedy successor
// plus one forced (kind, placement) successor for every (tower kind, valid
// placement class). Successors are deduped by portfolio signature and
// pruned to top K by (lowest totalSpent ↑, highest gold ↓).
//
// This breaks greedy myopia: a (kind, placement) that's locally suboptimal
// at wave 1 but pays off at wave 4 has a chance to survive in the beam
// long enough to dominate when its payoff hits.
const portfolioSignature = (towers: TowerInstance[]): string => {
  const parts = towers.map((t) => `${t.kind}-${t.tierA}-${t.tierB}-${t.lanes.join("+")}`);
  return parts.sort().join(",");
};

type BeamNode = { state: SimState; history: WaveStep[] };

const simulateBeam = (
  level: (typeof LEVELS)[number],
  safety: number,
  lookahead: number,
  beamWidth: number,
): SimResult => {
  const hpScale = level.hpScale ?? 1;
  const numPaths = level.paths.length;
  const pathLengths = level.paths.map(pathLength);
  const placements = computePlacementOptions(level.paths);
  const perLaneByWave = level.waves.map((w) => analyzeWavePerLane(w, hpScale, numPaths));

  let beam: BeamNode[] = [{ state: initialState(level), history: [] }];

  for (let i = 0; i < level.waves.length; i++) {
    const successors: BeamNode[] = [];

    for (const node of beam) {
      // Greedy variant — no forced first action.
      const r = prepAndClearWave(
        node.state,
        level,
        i,
        perLaneByWave,
        pathLengths,
        safety,
        lookahead,
        placements,
      );
      if (r.step.cleared) {
        successors.push({
          state: { ...r.state, gold: r.state.gold + r.step.bountyEarned },
          history: [...node.history, r.step],
        });
      }

      // Forced (kind, placement) variants — one per (kind × valid placement).
      for (const kind of Object.keys(TOWER_STATS) as TowerKind[]) {
        if (TOWER_COST[kind] > node.state.gold) continue;
        for (const lanes of placements[kind]) {
          const r2 = prepAndClearWave(
            node.state,
            level,
            i,
            perLaneByWave,
            pathLengths,
            safety,
            lookahead,
            placements,
            { kind, lanes },
          );
          if (r2.step.cleared) {
            successors.push({
              state: { ...r2.state, gold: r2.state.gold + r2.step.bountyEarned },
              history: [...node.history, r2.step],
            });
          }
        }
      }
    }

    if (successors.length === 0) {
      // Every beam path failed this wave. Expand the most-promising failed
      // path (greedy from the best beam node) so the report still shows what
      // got close.
      const best = beam[0];
      const r = prepAndClearWave(
        best.state,
        level,
        i,
        perLaneByWave,
        pathLengths,
        safety,
        lookahead,
        placements,
      );
      return {
        level,
        history: [...best.history, r.step],
        success: false,
        failedAt: i + 1,
        finalState: r.state,
      };
    }

    // Dedupe by portfolio + spent (different portfolios that happened to
    // share the same total spent might still differ in towers — sig keeps
    // them separate).
    const seen = new Set<string>();
    const unique = successors.filter((n) => {
      const sig = `${portfolioSignature(n.state.towers)}|${n.state.totalSpent}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });

    unique.sort((a, b) => {
      if (a.state.totalSpent !== b.state.totalSpent) return a.state.totalSpent - b.state.totalSpent;
      return b.state.gold - a.state.gold;
    });

    beam = unique.slice(0, beamWidth);
  }

  const winner = beam[0];
  return { level, history: winner.history, success: true, finalState: winner.state };
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

const fmt = (n: number, d = 0) => n.toFixed(d);
const pad = (s: string | number, n: number) => String(s).padStart(n);
const padR = (s: string | number, n: number) => String(s).padEnd(n);

const portfolioString = (towers: TowerInstance[]): string => {
  const byKey = new Map<string, number>();
  for (const t of towers) {
    const key = `${t.kind}@${formatLanes(t.lanes)}`;
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }
  return [...byKey.entries()].map(([k, n]) => `${n}×${k}`).join(", ");
};

const formatLaneVec = (v: number[]): string => v.map((n) => fmt(n, 0)).join("/");

/**
 * "Chill analysis" — after the forward-sim has built a functional portfolio,
 * which waves required zero intervention (spent=0) AND had comfortable
 * margin (dpsBefore >> reqDps)? Flags stretches of 3+ consecutive chill
 * waves as potentially boring — the player is watching, not playing.
 */
const chillAnalysis = (safety: number, lookahead: number, marginMul: number, minStreak: number) => {
  type Streak = {
    level: (typeof LEVELS)[number];
    startWave: number;
    endWave: number;
    waves: { wave: number; arch: string; dpsBefore: number; reqDps: number; margin: number }[];
  };
  const allStreaks: Streak[] = [];
  const perLevelStats: {
    level: (typeof LEVELS)[number];
    totalWaves: number;
    chillWaves: number;
    longestStreak: number;
    streakRange: string;
  }[] = [];

  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const r = simulate(level, safety, lookahead);
    if (!r.success) continue;

    // Identify "true chill" waves: spent=0 AND every lane's dpsBefore is
    // above its reqDps × marginMul (so even the bottleneck lane is comfy).
    const chill = r.history.map((h) => {
      if (h.spentThisWave !== 0) return false;
      for (let k = 0; k < h.reqDpsByLane.length; k++) {
        const req = h.reqDpsByLane[k];
        if (req === 0) continue;
        if (h.dpsBeforeByLane[k] < req * marginMul) return false;
      }
      return true;
    });

    // Find consecutive runs of chill=true
    let longest = 0;
    let longestStart = 0;
    let i0 = 0;
    while (i0 < chill.length) {
      if (!chill[i0]) {
        i0++;
        continue;
      }
      let j = i0;
      while (j < chill.length && chill[j]) j++;
      const len = j - i0;
      if (len >= minStreak) {
        const segWaves = r.history.slice(i0, j).map((h) => {
          // Bottleneck-lane margin = worst (lowest dpsBefore/reqDps ratio)
          let worstMargin = Number.POSITIVE_INFINITY;
          for (let k = 0; k < h.reqDpsByLane.length; k++) {
            if (h.reqDpsByLane[k] === 0) continue;
            const m = h.dpsBeforeByLane[k] / h.reqDpsByLane[k];
            if (m < worstMargin) worstMargin = m;
          }
          return {
            wave: h.wave,
            arch: h.archetype,
            dpsBefore: h.dpsBeforeByLane[h.bottleneckLane] ?? 0,
            reqDps: h.reqDpsByLane[h.bottleneckLane] ?? 0,
            margin: Number.isFinite(worstMargin) ? worstMargin : Number.POSITIVE_INFINITY,
          };
        });
        allStreaks.push({
          level,
          startWave: r.history[i0].wave,
          endWave: r.history[j - 1].wave,
          waves: segWaves,
        });
      }
      if (len > longest) {
        longest = len;
        longestStart = i0;
      }
      i0 = j;
    }

    const chillCount = chill.filter((c) => c).length;
    perLevelStats.push({
      level,
      totalWaves: r.history.length,
      chillWaves: chillCount,
      longestStreak: longest,
      streakRange:
        longest > 0
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
    const streakColor =
      s.longestStreak >= 5
        ? C.red
        : s.longestStreak >= 3
          ? C.yellow
          : s.longestStreak >= 2
            ? C.cyan
            : C.dim;
    console.log(
      `${padR(`L${s.level.id} ${s.level.name}`, 30)} ${pad(s.totalWaves, 5)} ${pad(s.chillWaves, 5)} ${pad(pct + "%", 4)} ${streakColor}${pad(s.longestStreak, 7)}${C.reset}  ${C.dim}${s.streakRange}${C.reset}`,
    );
  }

  // Detailed streaks (only long ones)
  if (allStreaks.length > 0) {
    console.log(`\n${C.bold}Long chill stretches (≥${minStreak} waves):${C.reset}`);
    for (const s of allStreaks) {
      const avgMargin = s.waves.reduce((a, b) => a + b.margin, 0) / s.waves.length;
      const marginStr = Number.isFinite(avgMargin) ? `${fmt(avgMargin, 1)}×` : "∞";
      console.log(
        `  ${C.bold}L${s.level.id}${C.reset} ${padR(s.level.name, 22)} ${C.dim}W${s.startWave}-W${s.endWave}${C.reset}` +
          ` ${C.cyan}${s.waves.length} chill waves${C.reset} ${C.dim}avg margin ${marginStr}, archetypes: ${[...new Set(s.waves.map((w) => w.arch))].join("/")}${C.reset}`,
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
  precomputed?: SimResult,
) => {
  const result = precomputed ?? simulate(LEVELS[levelIdx], safety, lookahead);
  const { level, history, success } = result;

  console.log(
    `\n${C.bold}═══ L${level.id}: ${level.name}${C.reset}` +
      `${level.hpScale ? ` ${C.dim}(hpScale ${level.hpScale}×)${C.reset}` : ""}` +
      ` ${C.dim}startGold=${level.startGold}, safety=${safety}×, paths=${level.paths.length}${C.reset}`,
  );
  console.log(
    `${C.dim}DPS columns are per-lane (L0/L1/...). A lane with no enemies shows 0.${C.reset}`,
  );
  const laneColW = Math.max(11, level.paths.length * 4 + (level.paths.length - 1) + 2);
  console.log(
    `${C.dim}${pad("W", 3)} ${padR("arch", 7)} ${padR("reqDPS", laneColW)} ${padR("before", laneColW)} ${padR("after", laneColW)} ${pad("spent", 6)} ${pad("goldOut", 7)}  actions${C.reset}`,
  );

  for (const s of history) {
    const tight = s.goldOut < 50 ? C.red : s.goldOut < 200 ? C.yellow : "";
    const hitMark = s.cleared ? "" : `${C.red} ✗${C.reset}`;
    // Color each lane DPS red if below its req
    const colorLanes = (vals: number[]): string =>
      vals
        .map((v, k) => {
          const req = s.reqDpsByLane[k];
          if (req === 0) return C.dim + fmt(v, 0) + C.reset;
          return v < req ? C.red + fmt(v, 0) + C.reset : fmt(v, 0);
        })
        .join("/");
    console.log(
      `${pad(s.wave, 3)} ${padR(s.archetype, 7)} ${padR(formatLaneVec(s.reqDpsByLane), laneColW)} ${padR(colorLanes(s.dpsBeforeByLane), laneColW + 8)} ${padR(colorLanes(s.dpsAfterByLane), laneColW + 8)} ` +
        `${pad(s.spentThisWave, 6)} ${tight}${pad(s.goldOut, 7)}${tight ? C.reset : ""}  ${s.actionsDesc}${hitMark}`,
    );
    if (verbose) {
      console.log(`    ${C.dim}portfolio: ${portfolioString(s.towersAfter)}${C.reset}`);
    }
  }

  // Summary
  if (!success) {
    console.log(
      `${C.red}  ✗ INFEASIBLE at wave ${result.failedAt} — greedy min-cost couldn't meet ${safety}× required DPS${C.reset}`,
    );
  }

  const finalPortfolio = portfolioString(result.finalState.towers);
  const spentByKind = result.finalState.spentByKind;
  const spentEntries = (Object.entries(spentByKind) as [TowerKind, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const lockIn = spentEntries
    .map(([k, v]) => `${k} ${v}g (sunk ${Math.floor(v * 0.35)}g)`)
    .join(", ");
  console.log(`${C.dim}  portfolio: ${finalPortfolio || "—"}${C.reset}`);
  console.log(
    `${C.dim}  total spent ${result.finalState.totalSpent}g; lock-in (35% non-refundable): ${lockIn || "—"}${C.reset}`,
  );

  // Tightest waves
  const byTightness = [...history]
    .map((s) => ({ wave: s.wave, slack: s.goldOut, arch: s.archetype, spent: s.spentThisWave }))
    .sort((a, b) => a.slack - b.slack)
    .slice(0, 3);
  console.log(
    `${C.dim}  tightest: ${byTightness.map((t) => `W${t.wave}(${t.arch}, goldOut=${t.slack})`).join(", ")}${C.reset}`,
  );
};

// ------- CLI -------

declare const process: { argv: string[]; exit(code: number): never };

const args = process.argv.slice(2);
const safetyArg = args.find((a: string) => a.startsWith("--safety="));
const safety = safetyArg ? Number(safetyArg.split("=")[1]) : 1.2;
const lookaheadArg = args.find((a: string) => a.startsWith("--lookahead="));
const lookahead = lookaheadArg ? Number(lookaheadArg.split("=")[1]) : 3;
const beamArg = args.find((a: string) => a.startsWith("--beam="));
const beamWidth = beamArg ? Number(beamArg.split("=")[1]) : 1;
const verbose = args.includes("--verbose") || args.includes("-v");
const compareMode = args.includes("--compare-starters");
const chillMode = args.includes("--chill");
const marginArg = args.find((a: string) => a.startsWith("--margin="));
const marginMul = marginArg ? Number(marginArg.split("=")[1]) : 1.5;
const minStreakArg = args.find((a: string) => a.startsWith("--min-streak="));
const minStreak = minStreakArg ? Number(minStreakArg.split("=")[1]) : 3;
const forceFirstArg = args.find((a: string) => a.startsWith("--force-first="));
const forceFirst = forceFirstArg ? (forceFirstArg.split("=")[1] as TowerKind) : undefined;
const levelArg = args.find((a: string) => /^\d+$/.test(a));

if (!Number.isFinite(safety) || safety <= 0) {
  console.error("Invalid --safety value");
  process.exit(1);
}
if (!Number.isFinite(lookahead) || lookahead < 1) {
  console.error("Invalid --lookahead value (must be >= 1)");
  process.exit(1);
}
if (!Number.isFinite(beamWidth) || beamWidth < 1) {
  console.error("Invalid --beam value (must be >= 1, use 1 for greedy)");
  process.exit(1);
}

if (forceFirst && !(forceFirst in TOWER_STATS)) {
  console.error(`Unknown tower kind: ${forceFirst}. Valid: ${Object.keys(TOWER_STATS).join(", ")}`);
  process.exit(1);
}

// Beam search ignores forceFirst (it diversifies through its own forced
// starters at every wave, not just wave 1).
const runSim = (level: (typeof LEVELS)[number]): SimResult =>
  beamWidth > 1
    ? simulateBeam(level, safety, lookahead, beamWidth)
    : simulate(level, safety, lookahead, forceFirst);

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
    const result = runSim(LEVELS[idx]);
    printLevel(idx, safety, lookahead, verbose, result);
  }
} else {
  const results = LEVELS.map((l) => runSim(l));
  for (let i = 0; i < LEVELS.length; i++) {
    printLevel(i, safety, lookahead, verbose, results[i]);
  }
  // Cross-level summary: where does the chosen strategy break?
  console.log(`\n${C.bold}═══ Summary${C.reset}`);
  const failed: string[] = [];
  for (const r of results) {
    if (!r.success) failed.push(`L${r.level.id}W${r.failedAt}`);
  }
  const modeLabel = beamWidth > 1 ? `beam=${beamWidth}` : "greedy";
  if (failed.length === 0) {
    console.log(
      `${C.green}All ${LEVELS.length} levels clearable with ${modeLabel} @ safety=${safety}×${C.reset}`,
    );
  } else {
    console.log(`${C.red}${modeLabel} breaks at: ${failed.join(", ")}${C.reset}`);
  }
}
