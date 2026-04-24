import type { Vec2 } from "./types";
import { dist, lerp } from "./vec2";

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
