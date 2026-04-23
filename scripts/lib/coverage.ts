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

import type { Vec2 } from "../../src/sim/types";
import { MAP_WIDTH, MAP_HEIGHT, PATH_WIDTH } from "../../src/level";

// Mirrors the placement check in src/store.ts canPlaceTower:
//   cannot sit within PATH_WIDTH/2 + 0.4 of any path segment.
const MIN_PATH_DIST = PATH_WIDTH / 2 + 0.4;

const distPointToSeg = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

const distPointToPath = (p: Vec2, path: Vec2[]): number => {
  let min = Infinity;
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
      let nearestPath = Infinity;
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
