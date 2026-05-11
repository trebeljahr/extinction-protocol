// Worley/Voronoi density field. Scatters K feature points across a rect;
// `density(x, y)` returns max contribution from the nearest features,
// smooth-falloff to 0 past `featureRadius`. Used to modulate Poisson-disk
// spacing so prop placement reads as "denser here, sparser there" instead
// of uniform — natural-looking groves, thickets, rock piles.

import { mulberry32 } from "./random";

export type WorleyField = {
  density: (x: number, y: number) => number;
  features: Array<{ x: number; y: number }>;
};

export type WorleyBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

// Smooth (1-t²)² falloff from 1 at the feature to 0 at the radius edge.
// C¹ at both endpoints so density transitions don't pop visually.
const falloff = (d2: number, invR2: number): number => {
  const t = d2 * invR2;
  if (t >= 1) return 0;
  const k = 1 - t;
  return k * k;
};

export const worleyFieldFromFeatures = (
  features: ReadonlyArray<{ x: number; y: number }>,
  featureRadius: number,
): WorleyField => {
  const stored = features.map((f) => ({ x: f.x, y: f.y }));
  const invR2 = 1 / (featureRadius * featureRadius);
  return {
    features: stored,
    density: (x, y) => {
      let max = 0;
      for (const f of stored) {
        const dx = x - f.x;
        const dy = y - f.y;
        const c = falloff(dx * dx + dy * dy, invR2);
        if (c > max) max = c;
      }
      return max;
    },
  };
};

export const createWorleyField = (
  seed: number,
  bounds: WorleyBounds,
  featureCount: number,
  featureRadius: number,
): WorleyField => {
  const rng = mulberry32(seed);
  const features: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < featureCount; i++) {
    features.push({
      x: bounds.minX + rng() * (bounds.maxX - bounds.minX),
      y: bounds.minY + rng() * (bounds.maxY - bounds.minY),
    });
  }
  return worleyFieldFromFeatures(features, featureRadius);
};
