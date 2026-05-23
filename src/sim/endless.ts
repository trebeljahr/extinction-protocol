// Procedural wave generation for Endless mode. Pure + deterministic: a
// given (seed, wave) always produces the same composition, so the run is
// reproducible from the seed stored on World.endless. The campaign never
// touches this file — the spawner only calls generateEndlessWave when
// World.endless is set.

import { mulberry32 } from "./random";
import type {
  BossTrickleStream,
  BossVariant,
  EnemyKind,
  EnemySpec,
  WaveArchetype,
  WaveSpec,
} from "./types";

// Boss every N waves. Cycles through the six biome matriarchs; each full
// pass adds one more boss to the wave so the cadence keeps escalating.
export const ENDLESS_BOSS_INTERVAL = 5;

const BOSS_CYCLE: BossVariant[] = ["raptor", "stego", "para", "allosaur", "armored", "apex"];

// Stable kind ordering so the generated spawn list is deterministic.
const SPAWN_ORDER: EnemyKind[] = [
  "swarm",
  "raptor",
  "para",
  "allosaur",
  "stego",
  "armored",
  "titan",
];

// Mild, capped per-wave speed multiplier layered on top of the difficulty
// speed multiplier. Applied to world.speedMul at each endless wave start
// so later waves field slightly faster enemies without becoming
// uncatchable. Caps at 1.35× so movement stays readable forever.
export const endlessSpeedFactor = (wave: number): number => Math.min(1.35, 1 + wave * 0.006);

// Per-wave HP escalation before the difficulty multiplier folds in. The
// linear term keeps the early game readable; the quadratic term makes
// survival past ~wave 25 demand real scaling, but it grows smoothly so
// there's no spike at wave 10. Uncapped — endless should stay hard.
const endlessWaveHp = (wave: number): number => 1 + wave * 0.1 + wave * wave * 0.006;

const endlessArchetype = (counts: Partial<Record<EnemyKind, number>>): WaveArchetype => {
  let total = 0;
  let distinct = 0;
  for (const k of Object.keys(counts) as EnemyKind[]) {
    const c = counts[k] ?? 0;
    if (c > 0) {
      total += c;
      distinct += 1;
    }
  }
  const heavy = (counts.armored ?? 0) > 0 || (counts.titan ?? 0) > 0;
  const swarmShare = (counts.swarm ?? 0) / Math.max(1, total);
  if (distinct >= 4 || (heavy && (counts.stego ?? 0) > 0)) return "chaos";
  if (heavy) return "heavy";
  if (swarmShare >= 0.6 && total >= 15) return "swarm";
  return "mixed";
};

// Build the WaveSpec for wave `n` (1-based) of an endless run. `hpMul` is
// the difficulty HP multiplier (folded into the returned wave's hpMul on
// top of the wave-number escalation); `pathCount` spreads groups across
// the arena's lanes.
export const generateEndlessWave = (
  wave: number,
  seed: number,
  hpMul: number,
  pathCount: number,
): WaveSpec => {
  const rng = mulberry32((seed ^ Math.imul(wave, 0x9e3779b1)) >>> 0);
  const lanes = Math.max(1, pathCount);
  const lane = () => Math.floor(rng() * lanes);

  const waveHp = endlessWaveHp(wave);
  const isBoss = wave % ENDLESS_BOSS_INTERVAL === 0;

  const counts: Partial<Record<EnemyKind, number>> = {};
  const add = (k: EnemyKind, n: number) => {
    if (n > 0) counts[k] = (counts[k] ?? 0) + n;
  };

  // Light fodder — always present, grows steadily but caps so swarms stay
  // clearable with AoE rather than turning into an unbreakable wall.
  const fodder = Math.min(70, Math.round(6 + wave * 1.7));
  const swarmShare = wave < 4 ? 0.4 : 0.55;
  add("swarm", Math.round(fodder * swarmShare));
  add("raptor", Math.round(fodder * (1 - swarmShare) * (wave >= 3 ? 0.65 : 1)));
  if (wave >= 3) add("para", Math.round(fodder * (1 - swarmShare) * 0.35));

  // Mid/heavy kinds phase in on a schedule, each capped so no single late
  // wave fields an unkillable column of armor.
  if (wave >= 5) add("allosaur", Math.min(14, 1 + Math.floor((wave - 3) / 3)));
  if (wave >= 8) add("stego", Math.min(10, 1 + Math.floor((wave - 6) / 5)));
  if (wave >= 12) add("armored", Math.min(8, 1 + Math.floor((wave - 10) / 6)));
  if (wave >= 18) add("titan", Math.min(4, (rng() < 0.5 ? 1 : 0) + Math.floor((wave - 16) / 14)));

  // Chip pressure ramps in deterministically. Each gate flips one chip on
  // a single group so the player has to answer shields/regen/heal without
  // every enemy carrying them.
  const wantShield = wave >= 10 && rng() < 0.6;
  const wantRegen = wave >= 16 && rng() < 0.5;
  const wantHeal = wave >= 22 && rng() < 0.45;
  let shieldUsed = false;
  let regenUsed = false;
  let healUsed = false;

  const spawns: EnemySpec[] = [];
  for (const k of SPAWN_ORDER) {
    const c = counts[k] ?? 0;
    if (c <= 0) continue;
    const spec: EnemySpec = { kind: k, count: c, pathIndex: lane() };
    if (wantShield && !shieldUsed && (k === "allosaur" || k === "stego" || k === "armored")) {
      spec.shielded = true;
      shieldUsed = true;
    } else if (wantRegen && !regenUsed && (k === "raptor" || k === "para" || k === "allosaur")) {
      spec.regen = true;
      regenUsed = true;
    } else if (wantHeal && !healUsed && (k === "para" || k === "stego")) {
      spec.healAura = true;
      healUsed = true;
    }
    spawns.push(spec);
  }

  if (isBoss) {
    const cycle = Math.floor(wave / ENDLESS_BOSS_INTERVAL); // 1,2,3...
    const variant = BOSS_CYCLE[(cycle - 1) % BOSS_CYCLE.length];
    const bossCount = 1 + Math.floor((cycle - 1) / BOSS_CYCLE.length);
    spawns.push({ kind: "boss", count: bossCount, pathIndex: 0, bossVariant: variant });
    const trickle: BossTrickleStream[] = [
      {
        kinds: wave >= 12 ? ["swarm", "raptor", "para"] : ["swarm", "raptor"],
        pathIndex: 0,
        minInterval: 1.6,
        maxInterval: 2.6,
        startDelay: 2,
      },
    ];
    return {
      spawns,
      spacing: 0.7,
      hpMul: hpMul * waveHp,
      archetype: "convoy",
      bossWave: true,
      bossTrickle: trickle,
    };
  }

  return {
    spawns,
    spacing: Math.max(0.22, 0.6 - wave * 0.012),
    hpMul: hpMul * waveHp,
    archetype: endlessArchetype(counts),
  };
};
