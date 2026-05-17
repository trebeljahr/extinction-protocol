/**
 * Multi-path coverage modeling.
 *
 * A tower on a single-path map reaches every enemy. On a 2-or-3 path map,
 * whether it reaches them depends on placement + range: parallel lanes
 * that don't cross force each tower to commit to one lane, while a choke
 * where paths converge lets one tower cover several.
 *
 * `pathCoverage(paths, range)` returns the maximum number of paths a
 * single tower of that range can reach at its best valid placement.
 * Used to scale effective DPS down for levels where one tower can't
 * cover every lane.
 */

import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../../src/level";
import type { Vec2 } from "../../src/sim/types";

// Mirrors the placement check in src/store.ts canPlaceTower:
//   cannot sit within PATH_WIDTH/2 + 0.4 of any path segment.
const MIN_PATH_DIST = PATH_WIDTH / 2 + 0.4;

const distPointToSeg = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

const distPointToPath = (p: Vec2, path: Vec2[]): number => {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distPointToSeg(p, path[i], path[i + 1]);
    if (d < min) min = d;
  }
  return min;
};

/**
 * Max number of paths any single tower placement can cover.
 * Samples the full map on a 1-unit grid; rejects placements inside a
 * path corridor. Returns at least 1 — if no valid point exists (tiny
 * map), the caller will clamp.
 */
export const pathCoverage = (paths: Vec2[][], range: number): number => {
  if (paths.length <= 1) return 1;

  const halfW = MAP_WIDTH / 2;
  const halfH = MAP_HEIGHT / 2;
  let max = 1;

  for (let x = -halfW; x <= halfW; x += 1) {
    for (let y = -halfH; y <= halfH; y += 1) {
      const p = { x, y };

      // Reject placements too close to any path (tower footprint rule)
      let nearestPath = Number.POSITIVE_INFINITY;
      for (const path of paths) {
        const d = distPointToPath(p, path);
        if (d < nearestPath) nearestPath = d;
      }
      if (nearestPath < MIN_PATH_DIST) continue;

      // Count paths within tower range
      let covered = 0;
      for (const path of paths) {
        if (distPointToPath(p, path) <= range) covered++;
      }
      if (covered > max) max = covered;
    }
  }
  return max;
};

/**
 * Coverage-fraction of the wave reachable by N towers of the given
 * per-tower coverage. Optimistic — assumes perfect spread across paths
 * (no two towers commit to the same lane unnecessarily).
 */
export const coverageFraction = (
  numTowers: number,
  coveragePerTower: number,
  numPaths: number,
): number => {
  if (numTowers === 0) return 0;
  return Math.min(1, (numTowers * coveragePerTower) / numPaths);
};

/**
 * Enumerate the set of distinct path-coverage subsets a tower of the
 * given range can achieve from some valid placement. Each entry is a
 * sorted list of path indices covered by at least one valid placement.
 *
 * Used by the per-lane simulator: each tower commits to one placement
 * class (e.g. {0,1} = covers lanes 0 and 1) and splits its DPS across
 * the active lanes in that class.
 *
 * Samples on a 1-unit grid; rejects placements inside a path corridor.
 * Returns at minimum [[0]] for single-path levels.
 */
export const enumeratePlacementClasses = (paths: Vec2[][], range: number): number[][] => {
  if (paths.length <= 1) return [[0]];
  const halfW = MAP_WIDTH / 2;
  const halfH = MAP_HEIGHT / 2;
  const found = new Set<string>();

  for (let x = -halfW; x <= halfW; x += 1) {
    for (let y = -halfH; y <= halfH; y += 1) {
      const p = { x, y };
      let nearestPath = Number.POSITIVE_INFINITY;
      for (const path of paths) {
        const d = distPointToPath(p, path);
        if (d < nearestPath) nearestPath = d;
      }
      if (nearestPath < MIN_PATH_DIST) continue;

      const covered: number[] = [];
      for (let i = 0; i < paths.length; i++) {
        if (distPointToPath(p, paths[i]) <= range) covered.push(i);
      }
      if (covered.length === 0) continue;
      found.add(covered.join(","));
    }
  }

  if (found.size === 0) return [[0]];
  return [...found].map((s) => s.split(",").map(Number)).sort((a, b) => a.length - b.length);
};

/**
 * Like enumeratePlacementClasses, but additionally returns an anchor
 * (representative XY) for each class — the centroid of every valid
 * grid point that achieves that exact coverage class, snapped to the
 * nearest valid sample (a centroid can land inside a path corridor on
 * convergent layouts; snapping keeps the ghost out of the road).
 *
 * Used by the optimal-path trace emitter to attach a concrete world
 * position to each suggested tower so the in-game debug overlay can
 * render the plan as ghost meshes.
 */
export const enumeratePlacementClassesWithAnchors = (
  paths: Vec2[][],
  range: number,
): { lanes: number[]; anchor: Vec2 }[] => {
  if (paths.length <= 1) {
    const halfW = MAP_WIDTH / 2;
    const halfH = MAP_HEIGHT / 2;
    const samples: Vec2[] = [];
    for (let x = -halfW; x <= halfW; x += 1) {
      for (let y = -halfH; y <= halfH; y += 1) {
        const p = { x, y };
        if (distPointToPath(p, paths[0]) >= MIN_PATH_DIST && distPointToPath(p, paths[0]) <= range)
          samples.push(p);
      }
    }
    const anchor = samples[Math.floor(samples.length / 2)] ?? { x: 0, y: 0 };
    return [{ lanes: [0], anchor }];
  }
  const halfW = MAP_WIDTH / 2;
  const halfH = MAP_HEIGHT / 2;
  const byClass = new Map<string, Vec2[]>();

  for (let x = -halfW; x <= halfW; x += 1) {
    for (let y = -halfH; y <= halfH; y += 1) {
      const p = { x, y };
      let nearestPath = Number.POSITIVE_INFINITY;
      for (const path of paths) {
        const d = distPointToPath(p, path);
        if (d < nearestPath) nearestPath = d;
      }
      if (nearestPath < MIN_PATH_DIST) continue;

      const covered: number[] = [];
      for (let i = 0; i < paths.length; i++) {
        if (distPointToPath(p, paths[i]) <= range) covered.push(i);
      }
      if (covered.length === 0) continue;
      const key = covered.join(",");
      const list = byClass.get(key);
      if (list) list.push(p);
      else byClass.set(key, [p]);
    }
  }

  if (byClass.size === 0) return [{ lanes: [0], anchor: { x: 0, y: 0 } }];

  const out: { lanes: number[]; anchor: Vec2 }[] = [];
  for (const [key, samples] of byClass) {
    const lanes = key.split(",").map(Number);
    // Centroid of valid samples — closest valid-sample to centroid wins.
    let cx = 0;
    let cy = 0;
    for (const s of samples) {
      cx += s.x;
      cy += s.y;
    }
    cx /= samples.length;
    cy /= samples.length;
    let best = samples[0];
    let bestD = Number.POSITIVE_INFINITY;
    for (const s of samples) {
      const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    out.push({ lanes, anchor: best });
  }
  return out.sort((a, b) => a.lanes.length - b.lanes.length);
};
