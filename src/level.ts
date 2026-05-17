import type { Vec2 } from "./sim/types";

export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 24;

export const PATH_WIDTH = 2.8;

// Radius (centered on the HQ tower at each path endpoint) inside which
// world-scatter systems must NOT spawn: trees, rocks, biome cosmetics,
// and story props. Covers the fence box (max corner ≈ 4.1) plus a small
// outer pad so anything within "the home base compound" reads as
// deliberately authored set-dressing instead of procedural noise.
export const HQ_PAD_BLOCKER_RADIUS = 4.5;

export const hqBlockersFromPaths = (paths: Vec2[][]): { pos: Vec2; radius: number }[] => {
  const out: { pos: Vec2; radius: number }[] = [];
  for (const path of paths) {
    if (path.length < 2) continue;
    const last = path[path.length - 1];
    out.push({ pos: { x: last.x, y: last.y }, radius: HQ_PAD_BLOCKER_RADIUS });
  }
  return out;
};
