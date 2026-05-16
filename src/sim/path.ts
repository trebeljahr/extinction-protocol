import type { Vec2 } from "./types";
import { dist, lerp } from "./vec2";

// Default smoothPath subdivision count. Exposed as a const so callers
// that need to map a raw-waypoint index to its smoothed-output index
// (e.g., the painted-ribbon start when a lead-in waypoint was prepended)
// don't have to know the default magic number.
export const SMOOTH_PATH_SUBDIVISIONS = 10;

// Prepend a single off-map waypoint extending the path backwards from
// its first authored point along the reverse of the first segment's
// direction. After smoothing this becomes a straight lead-in that lets
// enemies walk on-screen from outside the visible viewport instead of
// popping into existence at the map border.
export const prependLeadIn = (path: Vec2[], distance: number): Vec2[] => {
  if (path.length < 2 || distance <= 0) return path.slice();
  const p0 = path[0];
  const p1 = path[1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) return path.slice();
  const pre: Vec2 = {
    x: p0.x - (dx / len) * distance,
    y: p0.y - (dy / len) * distance,
  };
  return [pre, ...path];
};

// Centripetal Catmull–Rom subdivision (alpha = 0.5). Endpoints are
// reflected to give the first/last spans a tangent. Returns a denser
// polyline that passes through every original waypoint but bends
// through them instead of cornering. Run this once at world build so
// sim + render + placement + lava bridges all walk the exact same
// polyline — otherwise enemies cut corners that the painted lane curves
// around.
//
// Centripetal parameterisation (vs uniform) guarantees the curve never
// self-intersects or overshoots at sharp corners. With uniform t the
// spline can loop back on itself when two original waypoints sit close
// together at a tight bend, which renders as a folded ribbon ("dark
// wedge" artefact) at the outside of the corner.
export const smoothPath = (path: Vec2[], subdivisions = SMOOTH_PATH_SUBDIVISIONS): Vec2[] => {
  if (path.length < 2) return path.slice();
  const ext: Vec2[] = [];
  ext.push({ x: 2 * path[0].x - path[1].x, y: 2 * path[0].y - path[1].y });
  for (const p of path) ext.push(p);
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  ext.push({ x: 2 * last.x - prev.x, y: 2 * last.y - prev.y });

  // t spacing between knots = ||p_{i+1} - p_i||^alpha. alpha=0.5 is the
  // centripetal variant; an epsilon floor keeps coincident waypoints
  // from collapsing the knot interval to zero.
  const knotDelta = (a: Vec2, b: Vec2): number => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return Math.max(1e-4, Math.sqrt(d));
  };

  const out: Vec2[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1];
    const p1 = ext[i];
    const p2 = ext[i + 1];
    const p3 = ext[i + 2];

    const t0 = 0;
    const t1 = t0 + knotDelta(p0, p1);
    const t2 = t1 + knotDelta(p1, p2);
    const t3 = t2 + knotDelta(p2, p3);

    const steps = i === ext.length - 3 ? subdivisions + 1 : subdivisions;
    for (let j = 0; j < steps; j++) {
      const t = t1 + (j / subdivisions) * (t2 - t1);

      // Barry–Goldman pyramidal evaluation of a non-uniform Catmull–Rom
      // segment between (p1,t1) and (p2,t2) with neighbours p0,p3.
      const a1x = ((t1 - t) * p0.x + (t - t0) * p1.x) / (t1 - t0);
      const a1y = ((t1 - t) * p0.y + (t - t0) * p1.y) / (t1 - t0);
      const a2x = ((t2 - t) * p1.x + (t - t1) * p2.x) / (t2 - t1);
      const a2y = ((t2 - t) * p1.y + (t - t1) * p2.y) / (t2 - t1);
      const a3x = ((t3 - t) * p2.x + (t - t2) * p3.x) / (t3 - t2);
      const a3y = ((t3 - t) * p2.y + (t - t2) * p3.y) / (t3 - t2);

      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0);
      const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
      const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);

      const x = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1);
      const y = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);
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

// Direction blended with adjacent segments so it rotates continuously through
// bends instead of snapping at micro-segment boundaries. The lateral offset
// normal and render-layer yaw both derive from this so enemies don't jitter
// sideways when crossing a waypoint on a curve.
export const smoothDirection = (path: Vec2[], segment: number, t: number): Vec2 => {
  const a = path[segment];
  const b = path[segment + 1];
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) return { x: 0, y: 0 };
  dx /= len;
  dy /= len;

  if (t < 0.5 && segment > 0) {
    const prev = path[segment - 1];
    const pdx = a.x - prev.x;
    const pdy = a.y - prev.y;
    const plen = Math.hypot(pdx, pdy);
    if (plen > 1e-6) {
      const w = t + 0.5;
      dx = pdx / plen + (dx - pdx / plen) * w;
      dy = pdy / plen + (dy - pdy / plen) * w;
    }
  } else if (t >= 0.5 && segment + 2 < path.length) {
    const next = path[segment + 2];
    const ndx = next.x - b.x;
    const ndy = next.y - b.y;
    const nlen = Math.hypot(ndx, ndy);
    if (nlen > 1e-6) {
      const w = t - 0.5;
      dx += (ndx / nlen - dx) * w;
      dy += (ndy / nlen - dy) * w;
    }
  }

  const rlen = Math.hypot(dx, dy);
  return rlen > 1e-6 ? { x: dx / rlen, y: dy / rlen } : { x: 0, y: 0 };
};

export type PathAdvance = {
  segment: number;
  segmentT: number;
  pos: Vec2;
  finished: boolean;
};

// Closest point on a polyline to `p` plus a signed lateral offset
// (right-hand normal convention — positive = right side of forward
// travel). Drives hero path-bound movement so the move-order click
// derives both target progress and which side of the lane to stand on.
export const projectOnPath = (
  path: Vec2[],
  p: Vec2,
): { segment: number; segmentT: number; pos: Vec2; lateralOffset: number } => {
  let bestSeg = 0;
  let bestT = 0;
  let bestD2 = Number.POSITIVE_INFINITY;
  let bestX = p.x;
  let bestY = p.y;
  let bestLat = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestSeg = i;
      bestT = t;
      bestX = cx;
      bestY = cy;
      const len = Math.sqrt(lenSq);
      // Right-hand normal of (abx, aby) is (-aby, abx)/len, matching the
      // sign convention used by `enemy.lateralOffset` so the swarm lanes
      // and hero positioning share the same axis.
      const nx = -aby / len;
      const ny = abx / len;
      bestLat = dx * nx + dy * ny;
    }
  }
  return { segment: bestSeg, segmentT: bestT, pos: { x: bestX, y: bestY }, lateralOffset: bestLat };
};

// Picks the closest path lane in a multi-path level and projects `p`
// onto it. Used so the hero binds to whichever path the player clicked
// nearest, not always path[0].
export const pickNearestPathProjection = (
  paths: Vec2[][],
  p: Vec2,
): { pathIndex: number; segment: number; segmentT: number; pos: Vec2; lateralOffset: number } => {
  let bestIdx = 0;
  let best = projectOnPath(paths[0], p);
  let bestD2 = (best.pos.x - p.x) ** 2 + (best.pos.y - p.y) ** 2;
  for (let i = 1; i < paths.length; i++) {
    const proj = projectOnPath(paths[i], p);
    const d2 = (proj.pos.x - p.x) ** 2 + (proj.pos.y - p.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
      best = proj;
    }
  }
  return { pathIndex: bestIdx, ...best };
};

// Cumulative arc length from the start of the polyline to (segment, t).
// Cheap O(n) recompute — paths are short (<200 segments) and only the
// hero calls this per tick.
export const pathProgress = (path: Vec2[], segment: number, segmentT: number): number => {
  let acc = 0;
  for (let i = 0; i < segment; i++) acc += segmentLength(path, i);
  acc += segmentLength(path, segment) * segmentT;
  return acc;
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
