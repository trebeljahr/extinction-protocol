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
  return worleyFieldFromFeatures(
    sampleStratifiedFeatures(seed, bounds, featureCount),
    featureRadius,
  );
};

// Stratified (jittered-grid) feature placement. Pure-random sampling of
// small N reliably produces eye-catching clumps and bare patches — the
// "clustery / artificial" feel the player flagged on the world map and
// in-level terrain. A jittered grid places ~one feature per cell with a
// small random offset inside the cell, so cluster centres spread evenly
// across the bounds while still varying enough to avoid grid-pattern
// readability. JITTER_FRAC (0.65) keeps feature offsets inside each
// cell's centred 65% so adjacent cells don't trade neighbours and
// re-introduce gaps. Used by createWorleyField (in-level) and exported
// for OuterScenery to apply the same fix to the outer band rim.
const JITTER_FRAC = 0.65;
export const sampleStratifiedFeatures = (
  seed: number,
  bounds: WorleyBounds,
  featureCount: number,
): Array<{ x: number; y: number }> => {
  if (featureCount <= 0) return [];
  const rng = mulberry32(seed);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const aspect = w / Math.max(0.001, h);
  // Choose grid dimensions so cells stay ~square regardless of how
  // rectangular the bounds are. Otherwise a wide rect picks too few
  // columns and re-introduces clumping along the long axis.
  const cols = Math.max(1, Math.round(Math.sqrt(featureCount * aspect)));
  const rows = Math.max(1, Math.ceil(featureCount / cols));
  const cellW = w / cols;
  const cellH = h / rows;
  const features: Array<{ x: number; y: number }> = [];
  // Shuffle which cells get a feature so a featureCount lower than
  // rows*cols doesn't always drop the same trailing cells (which would
  // bias the bare strip to one corner across re-renders).
  const cellOrder: number[] = [];
  const cellTotal = rows * cols;
  for (let i = 0; i < cellTotal; i++) cellOrder.push(i);
  for (let i = cellTotal - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cellOrder[i];
    cellOrder[i] = cellOrder[j];
    cellOrder[j] = tmp;
  }
  const limit = Math.min(featureCount, cellTotal);
  for (let i = 0; i < limit; i++) {
    const idx = cellOrder[i];
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const jx = (rng() - 0.5) * cellW * JITTER_FRAC;
    const jy = (rng() - 0.5) * cellH * JITTER_FRAC;
    features.push({
      x: bounds.minX + (c + 0.5) * cellW + jx,
      y: bounds.minY + (r + 0.5) * cellH + jy,
    });
  }
  return features;
};
