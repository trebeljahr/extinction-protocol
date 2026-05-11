// Variable-radius Poisson disk sampling (Bridson, 2007 — extended for a
// per-point radius modulated by a density field). Generates points in a
// rectangle such that no two are closer than each point's own radius;
// good for natural-looking scatter of trees/rocks/grass without
// rejection-loop artefacts. External constraints (path clearance, lava,
// blockers, custom shape mask) plug in via `isValid`.

import { mulberry32 } from "./random";
import type { Vec2 } from "./types";

export type PoissonConfig = {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  // Minimum distance from this point to any other Poisson point. Larger
  // = sparser. Pair-wise check uses max(r(c), r(q)) so a tight point
  // can't slip under a loose neighbour's halo.
  radiusAt: (x: number, y: number) => number;
  maxCount: number;
  seed: number;
  // Bridson's k — candidates spawned per active point before it's
  // retired from the frontier. 30 is the classic default.
  candidatesPerActive?: number;
  // External rejection (path, lava, blockers, custom shape mask). Called
  // for the initial seed and every candidate before spacing checks.
  isValid?: (x: number, y: number) => boolean;
  // Optional pre-seed positions. Bridson's classic algorithm starts
  // from a single random point and walks outward — fine for uniform
  // density, but when `radiusAt` is driven by a Worley field with
  // multiple feature centres the walk tends to fill ONE feature before
  // reaching others. Pre-seeding with a point near each feature gives
  // every cluster a starting frontier so the placement spreads.
  initialPoints?: ReadonlyArray<Vec2>;
};

const sampleInAnnulus = (
  rng: () => number,
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
): Vec2 => {
  // Uniform in annulus via sqrt-of-uniform-area; picking r linearly
  // would bias toward the outer rim.
  const r2 = rInner * rInner + rng() * (rOuter * rOuter - rInner * rInner);
  const r = Math.sqrt(r2);
  const a = rng() * Math.PI * 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
};

export const poissonDiskSample = (cfg: PoissonConfig): Vec2[] => {
  const rng = mulberry32(cfg.seed);
  const { bounds, radiusAt, maxCount } = cfg;
  const k = cfg.candidatesPerActive ?? 30;
  const isValid = cfg.isValid ?? (() => true);

  const points: Vec2[] = [];
  // Per-point radius cache — radiusAt is pure of position, so memoize.
  const radii: number[] = [];
  const active: number[] = [];

  // Try to accept a pre-seed; same conflict check the main loop uses so
  // callers can pass clustered features without worrying about whether
  // two are too close.
  const tryAcceptPoint = (x: number, y: number): boolean => {
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return false;
    if (!isValid(x, y)) return false;
    const cr = radiusAt(x, y);
    for (let qi = 0; qi < points.length; qi++) {
      const q = points[qi];
      const dx = x - q.x;
      const dy = y - q.y;
      const qr = radii[qi];
      const minR = cr > qr ? cr : qr;
      if (dx * dx + dy * dy < minR * minR) return false;
    }
    points.push({ x, y });
    radii.push(cr);
    active.push(points.length - 1);
    return true;
  };

  // Caller-provided pre-seeds first — each becomes a separate Bridson
  // frontier so clustered density fields get explored evenly.
  if (cfg.initialPoints) {
    for (const p of cfg.initialPoints) {
      if (points.length >= cfg.maxCount) break;
      tryAcceptPoint(p.x, p.y);
    }
  }

  // Fallback random seed if nothing accepted yet. A handful of tries is
  // plenty for an unconstrained rect; tighter shapes may need more.
  if (points.length === 0) {
    for (let tries = 0; tries < 200; tries++) {
      const x = bounds.minX + rng() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + rng() * (bounds.maxY - bounds.minY);
      if (tryAcceptPoint(x, y)) break;
    }
  }

  while (active.length > 0 && points.length < maxCount) {
    const aIdx = Math.floor(rng() * active.length);
    const pIdx = active[aIdx];
    const p = points[pIdx];
    const pr = radii[pIdx];

    let placed = false;
    for (let i = 0; i < k; i++) {
      const c = sampleInAnnulus(rng, p.x, p.y, pr, 2 * pr);
      if (c.x < bounds.minX || c.x > bounds.maxX || c.y < bounds.minY || c.y > bounds.maxY)
        continue;
      if (!isValid(c.x, c.y)) continue;
      const cr = radiusAt(c.x, c.y);

      let conflict = false;
      for (let qi = 0; qi < points.length; qi++) {
        const q = points[qi];
        const dx = c.x - q.x;
        const dy = c.y - q.y;
        const qr = radii[qi];
        // Forbid distance under max(r(c), r(q)) so each point reserves
        // its own territory regardless of neighbour radius.
        const minR = cr > qr ? cr : qr;
        if (dx * dx + dy * dy < minR * minR) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      points.push(c);
      radii.push(cr);
      active.push(points.length - 1);
      placed = true;
      break;
    }

    if (!placed) {
      active[aIdx] = active[active.length - 1];
      active.pop();
    }
  }

  return points;
};
