import type { Vec2 } from "./types";
import { dist, lerp } from "./vec2";

// Centripetal-style Catmull–Rom subdivision. Endpoints are reflected to give
// the first/last spans a tangent. Returns a denser polyline that passes
// through every original waypoint but bends through them instead of
// cornering. Run this once at world build so sim + render + placement
// + lava bridges all walk the exact same polyline — otherwise enemies
// cut corners that the painted lane curves around.
export const smoothPath = (path: Vec2[], subdivisions = 10): Vec2[] => {
  if (path.length < 2) return path.slice();
  const ext: Vec2[] = [];
  ext.push({ x: 2 * path[0].x - path[1].x, y: 2 * path[0].y - path[1].y });
  for (const p of path) ext.push(p);
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  ext.push({ x: 2 * last.x - prev.x, y: 2 * last.y - prev.y });

  const out: Vec2[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1];
    const p1 = ext[i];
    const p2 = ext[i + 1];
    const p3 = ext[i + 2];
    const steps = i === ext.length - 3 ? subdivisions + 1 : subdivisions;
    for (let j = 0; j < steps; j++) {
      const t = j / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  return out;
};

export const segmentLength = (path: Vec2[], i: number): number => dist(path[i], path[i + 1]);

export const pathLength = (path: Vec2[]): number => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += segmentLength(path, i);
  return total;
};

export const samplePath = (path: Vec2[], segment: number, t: number): Vec2 =>
  lerp(path[segment], path[segment + 1], t);

export type PathAdvance = {
  segment: number;
  segmentT: number;
  pos: Vec2;
  finished: boolean;
};

export const advanceAlongPath = (
  path: Vec2[],
  segment: number,
  segmentT: number,
  distance: number,
): PathAdvance => {
  let seg = segment;
  let t = segmentT;
  let remaining = distance;

  while (remaining > 0 && seg < path.length - 1) {
    const segLen = segmentLength(path, seg);
    // Coincident waypoints would divide-by-zero below and corrupt
    // segmentT to NaN/Infinity. Step over them.
    if (segLen <= 0) {
      seg++;
      t = 0;
      continue;
    }
    const metersLeftInSeg = segLen * (1 - t);
    if (remaining < metersLeftInSeg) {
      t += remaining / segLen;
      remaining = 0;
    } else {
      remaining -= metersLeftInSeg;
      seg++;
      t = 0;
    }
  }

  const finished = seg >= path.length - 1;
  if (finished) {
    const last = path[path.length - 1];
    return { segment: path.length - 2, segmentT: 1, pos: last, finished: true };
  }
  return { segment: seg, segmentT: t, pos: samplePath(path, seg, t), finished: false };
};
