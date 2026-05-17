import type { DamageType, EnemySpec, TowerKind, WaveSpec } from "./types";
import { ENEMY_RESIST, TOWER_DAMAGE_TYPE } from "./world";

const ALL_TOWER_KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar", "flame", "hive"];

// Damage types the player can reach this level given the mode's roster
// restrictions. Forbidden tower kinds drop their damage type only if no
// other usable tower kind covers it (e.g. forbidding pulse alone still
// leaves kinetic on the table via hive drones).
export const availableDamageTypes = (
  forbidden: ReadonlySet<TowerKind>,
  locked: readonly TowerKind[] | null,
): DamageType[] => {
  const usable = (locked ?? ALL_TOWER_KINDS).filter((k) => !forbidden.has(k));
  const types = new Set<DamageType>();
  for (const k of usable) types.add(TOWER_DAMAGE_TYPE[k]);
  return Array.from(types);
};

// Ensures every damage type the player can deploy has at least one
// enemy spawn that is fully immune (resist multiplier 0) somewhere in
// the level. Per playtest note 11/1: single-tower spam should not be
// able to coast through a whole level untouched. EnemyPanel already
// renders `0×` resist chips with a red tint so an inspecting player
// understands why their tower is doing zero damage to the holdout.
export const ensureImmunityCoverage = (
  waves: WaveSpec[],
  damageTypes: DamageType[],
): WaveSpec[] => {
  if (waves.length === 0 || damageTypes.length === 0) return waves;

  const covered = new Set<DamageType>();
  for (const w of waves) {
    for (const s of w.spawns) {
      if (!s.resists) continue;
      for (const t of damageTypes) {
        if (s.resists[t] === 0) covered.add(t);
      }
    }
  }
  const missing = damageTypes.filter((t) => !covered.has(t));
  if (missing.length === 0) return waves;

  const out: WaveSpec[] = waves.map((w) => ({
    ...w,
    spawns: w.spawns.map((s) => ({
      ...s,
      ...(s.resists ? { resists: { ...s.resists } } : {}),
    })),
  }));

  const nonBossWaveIdx: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (!out[i].bossWave) nonBossWaveIdx.push(i);
  }
  if (nonBossWaveIdx.length === 0) return out;
  const midStart = Math.floor(nonBossWaveIdx.length / 3);
  const lateCandidates = nonBossWaveIdx.slice(midStart);
  const candidates = lateCandidates.length > 0 ? lateCandidates : nonBossWaveIdx;

  const pickCarrierSpawn = (
    waveIdx: number,
    type: DamageType,
  ): { wave: WaveSpec; spawnIdx: number } | null => {
    const wave = out[waveIdx];
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < wave.spawns.length; i++) {
      const s = wave.spawns[i];
      if (s.kind === "boss") continue;
      if (s.count < 1) continue;
      // Already immune to this type — no need to overwrite, but also
      // not a useful carrier for adding NEW immunity. Skip.
      if (s.resists?.[type] === 0) continue;
      const base = ENEMY_RESIST[s.kind][type] ?? 1;
      if (base > bestScore) {
        bestScore = base;
        best = i;
      }
    }
    return best < 0 ? null : { wave, spawnIdx: best };
  };

  missing.forEach((type, n) => {
    let picked: { wave: WaveSpec; spawnIdx: number } | null = null;
    for (let k = 0; k < candidates.length && !picked; k++) {
      const wIdx = candidates[(n + k) % candidates.length];
      picked = pickCarrierSpawn(wIdx, type);
    }
    if (!picked) {
      for (let i = 0; i < out.length && !picked; i++) {
        if (out[i].bossWave) continue;
        picked = pickCarrierSpawn(i, type);
      }
    }
    if (!picked) return;
    const spawn = picked.wave.spawns[picked.spawnIdx];
    if (spawn.count <= 1) {
      spawn.resists = { ...(spawn.resists ?? {}), [type]: 0 };
    } else {
      spawn.count -= 1;
      const immune: EnemySpec = {
        ...spawn,
        count: 1,
        resists: { ...(spawn.resists ?? {}), [type]: 0 },
      };
      picked.wave.spawns.push(immune);
    }
  });
  return out;
};
