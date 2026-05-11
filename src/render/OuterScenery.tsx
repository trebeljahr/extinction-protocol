import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type * as THREE from "three";
import {
  BIOME_COSMETICS,
  BIOME_LAYERS,
  BIOME_TREE_URLS,
  type Biome,
  type BiomeLayer,
  classifyPropUrl,
  TARGET_SIZE_BY_ROLE,
} from "../biomes";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { poissonDiskSample } from "../sim/poisson";
import { mulberry32 } from "../sim/random";
import type { Vec2 } from "../sim/types";
import { TREE_FOOTPRINT, TREE_MAX_SCALE, TREE_MIN_SCALE } from "../sim/world";
import { worleyFieldFromFeatures } from "../sim/worley";
import { useGame } from "../store";
import { InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Decorative scenery in the band *outside* the playable rectangle. Pure
// flavor — non-blocking, non-clickable, deterministic per level. Mirrors
// every BIOME_LAYER on the band at proportional density so the fringe
// reads as a continuation of the play area instead of thinning out: forest
// gets a grass-and-mushroom rim, snow gets a sparse rock rim, etc. The
// pass uses each layer's own cluster sigma/seeds, then adds proportional
// passes for trees (BIOME_TREE_URLS) and cosmetics (BIOME_COSMETICS) which
// aren't part of BIOME_LAYERS.

// Outer rectangle bounds — past this the fog + screen edge swallow props anyway.
const OUTER_HALF_W = MAP_WIDTH / 2 + 11; // 31 from center
const OUTER_HALF_H = MAP_HEIGHT / 2 + 9; // 21 from center
// Inner exclusion — slight overlap with the play boundary is fine, but
// stay clear of clickable trees/rocks so the join doesn't double up.
const INNER_HALF_W = MAP_WIDTH / 2 - 0.5;
const INNER_HALF_H = MAP_HEIGHT / 2 - 0.5;

// Slack on top of summed prop radii — matches Ground.tsx's PROP_SPACING_SLACK
// so the rim and the inner area share the same "neighbours can almost
// touch, but not visually overlap" convention.
const PROP_SPACING_SLACK = 0.15;
// Sparse-region Poisson radius is r_min × this. >1 spreads outliers out
// between Worley features instead of packing every prop into the densest
// pocket. Matches Ground.tsx's DECOR_MAX_SPACING_MUL.
const DECOR_MAX_SPACING_MUL = 2.0;

// Footprint guess for BiomeLayer specs that don't set `footprint`
// explicitly — same heuristic Ground.tsx uses so the rim and inner-area
// spacing for the same URL family agree.
const defaultFootprint = (url: string): number => {
  const f = url.toLowerCase();
  if (/grass/.test(f)) return 0.28;
  if (/bush/.test(f)) return 0.6;
  if (/rock/.test(f)) return 0.55;
  return 0.5;
};

const layerFootprint = (layer: BiomeLayer): number =>
  layer.footprint ?? defaultFootprint(layer.urls[0] ?? "");

// Compute per-layer Poisson rMin from footprint × avg scale × 2 (two
// halves touching) + slack. Previously the rim used a flat 0.6 unit
// spacing for everything, which let max-scale rocks (~0.9 unit visual
// radius) pack tight enough to render as a single overlapping pile.
const layerMinSpacing = (layer: BiomeLayer): number => {
  const footprint = layerFootprint(layer);
  const avgScale = (layer.minScale + layer.maxScale) / 2;
  return 2 * footprint * avgScale + PROP_SPACING_SLACK;
};

// Pure cosmetic URLs (BIOME_COSMETICS, e.g. BushFlowers) have no per-layer
// scale band; the inner BiomeCosmetics renderer normalizes them to
// TARGET_SIZE_BY_ROLE, and we mirror that here.
const COSMETIC_ONLY_URLS = (() => {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_COSMETICS)) for (const u of list) set.add(u);
  return set;
})();

// Inner-sim counts for things that aren't in BIOME_LAYERS — used to size the
// rim's separate tree/cosmetic passes. Mirrors sim/world.ts TREE_COUNT and
// BiomeCosmetics COUNT_PER_LEVEL. If those change, bump these too.
const INNER_TREE_COUNT = 20;
const INNER_COSMETIC_COUNT = 14;

// Band-to-inner area ratio: rim count = inner count × this. With the current
// outer/inner bounds it's ~1707 / 960 = 1.78.
const BAND_AREA = OUTER_HALF_W * 2 * OUTER_HALF_H * 2 - INNER_HALF_W * 2 * INNER_HALF_H * 2;
const INNER_AREA = MAP_WIDTH * MAP_HEIGHT;
const BAND_RATIO = BAND_AREA / INNER_AREA;

type Instance = { url: string; pos: Vec2; scale: number; rotY: number };

// Scale formulas mirror what the inner renderers use:
// - Trees: TREE_MIN_SCALE..TREE_MAX_SCALE (matches Trees.tsx)
// - Cosmetics: 0.7..1.4 jitter on top of the TARGET_SIZE_BY_ROLE normalization
// - Layer props: layer.minScale..maxScale (matches Ground.tsx)
// Triangular distribution (rng()+rng())/2 mid-biases size so the rim
// doesn't read as equal-thirds large/medium/small.
const treeScale = (rng: () => number): number =>
  TREE_MIN_SCALE + ((rng() + rng()) / 2) * (TREE_MAX_SCALE - TREE_MIN_SCALE);

const cosmeticScale = (rng: () => number): number => 0.7 + ((rng() + rng()) / 2) * 0.7;

const layerScale = (rng: () => number, layer: BiomeLayer): number =>
  layer.minScale + ((rng() + rng()) / 2) * (layer.maxScale - layer.minScale);

// Sample a position uniformly inside the band (outer rect minus inner rect).
// Pick which side of the band by area weight, then sample uniformly inside
// that side. Sides overlap at corners; that's fine.
const sampleBandPoint = (rng: () => number): Vec2 => {
  const horizontalArea = OUTER_HALF_W * 2 * (OUTER_HALF_H - INNER_HALF_H);
  const verticalArea = (OUTER_HALF_W - INNER_HALF_W) * INNER_HALF_H * 2;
  const totalArea = 2 * horizontalArea + 2 * verticalArea;
  const r = rng() * totalArea;
  let acc = horizontalArea;
  if (r < acc) {
    return {
      x: (rng() - 0.5) * 2 * OUTER_HALF_W,
      y: INNER_HALF_H + rng() * (OUTER_HALF_H - INNER_HALF_H),
    };
  }
  acc += horizontalArea;
  if (r < acc) {
    return {
      x: (rng() - 0.5) * 2 * OUTER_HALF_W,
      y: -INNER_HALF_H - rng() * (OUTER_HALF_H - INNER_HALF_H),
    };
  }
  acc += verticalArea;
  if (r < acc) {
    return {
      x: -INNER_HALF_W - rng() * (OUTER_HALF_W - INNER_HALF_W),
      y: (rng() - 0.5) * 2 * INNER_HALF_H,
    };
  }
  return {
    x: INNER_HALF_W + rng() * (OUTER_HALF_W - INNER_HALF_W),
    y: (rng() - 0.5) * 2 * INNER_HALF_H,
  };
};

const insideInner = (x: number, y: number): boolean =>
  Math.abs(x) < INNER_HALF_W && Math.abs(y) < INNER_HALF_H;

// Pick K Worley features in the band so the resulting density field
// only invests in band area (features in the inner exclusion would
// waste falloff on the playable rect).
const pickBandFeatures = (rng: () => number, count: number): Vec2[] => {
  const features: Vec2[] = [];
  for (let i = 0; i < count; i++) features.push(sampleBandPoint(rng));
  return features;
};

const OUTER_BOUNDS = {
  minX: -OUTER_HALF_W,
  maxX: OUTER_HALF_W,
  minY: -OUTER_HALF_H,
  maxY: OUTER_HALF_H,
};

// Mirror one BIOME_LAYER on the band at proportional count using the
// layer's own cluster config (now Worley-driven). Spacing is derived
// from the layer's footprint × scale so rocks don't pile on top of each
// other and grass doesn't waste space between blades. Spacing-checks
// against the running `out` list so previously-placed layers don't
// collide.
const placeLayerInBand = (
  out: Instance[],
  layer: BiomeLayer,
  levelId: number,
  layerIndex: number,
): void => {
  // Buildings are hero focal points; don't sprinkle them in the corners.
  if (layer.urls.every((u) => classifyPropUrl(u) === "building")) return;

  const targetCount = Math.round(layer.count * BAND_RATIO);
  if (targetCount === 0) return;

  const seedBase = layer.seed * 17 + levelId * 4451 + layerIndex * 991;
  const featureRng = mulberry32(seedBase);
  const sigma = layer.cluster?.sigma ?? 2.0;
  const featureRadius = sigma * 2.0;
  const featureCount = Math.max(4, Math.round((layer.cluster?.seeds ?? 5) * Math.sqrt(BAND_RATIO)));
  const features = pickBandFeatures(featureRng, featureCount);
  const worley = worleyFieldFromFeatures(features, featureRadius);

  const rMin = layerMinSpacing(layer);
  const rMax = rMin * DECOR_MAX_SPACING_MUL;
  const radiusAt = (x: number, y: number): number => {
    const d = worley.density(x, y);
    return rMin + (1 - d) * (rMax - rMin);
  };

  // Conservative footprint for the cross-layer check — use this layer's
  // max-scale instance so a worst-case sibling at the candidate position
  // can't graze a previously-placed (possibly different-family) prop.
  const candidateR = layerFootprint(layer) * layer.maxScale;

  const isValid = (x: number, y: number): boolean => {
    if (insideInner(x, y)) return false;
    for (const o of out) {
      const dx = o.pos.x - x;
      const dy = o.pos.y - y;
      // Both candidate and existing instances carry their own size, but
      // we don't track per-instance footprint here. Approximate with the
      // larger of the two candidate radii — keeps it conservative.
      const min = candidateR + PROP_SPACING_SLACK;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  };

  const points = poissonDiskSample({
    bounds: OUTER_BOUNDS,
    radiusAt,
    isValid,
    maxCount: targetCount,
    seed: seedBase + 7,
    // Seed one Bridson frontier per Worley feature so clusters
    // populate together rather than stacking around the first feature
    // the algorithm happens to hit.
    initialPoints: features,
  });

  const detailRng = mulberry32(seedBase + 13);
  for (const p of points) {
    const url = layer.urls[Math.floor(detailRng() * layer.urls.length)];
    out.push({
      url,
      pos: { x: p.x, y: p.y },
      scale: layerScale(detailRng, layer),
      rotY: detailRng() * Math.PI * 2,
    });
  }
};

// Place uniform Poisson scatter for things that don't have a
// BIOME_LAYERS entry — trees (BIOME_TREE_URLS) and cosmetics
// (BIOME_COSMETICS). No Worley modulation, just a flat density at the
// given min-spacing. `minSep` is the centre-to-centre distance both
// for Poisson sampling and the cross-layer check against `out`.
const placeUniformInBand = (
  out: Instance[],
  seed: number,
  pool: string[],
  count: number,
  scaleFn: (rng: () => number) => number,
  minSep: number,
): void => {
  if (count === 0 || pool.length === 0) return;

  const isValid = (x: number, y: number): boolean => {
    if (insideInner(x, y)) return false;
    for (const o of out) {
      const dx = o.pos.x - x;
      const dy = o.pos.y - y;
      if (dx * dx + dy * dy < minSep * minSep) return false;
    }
    return true;
  };

  const points = poissonDiskSample({
    bounds: OUTER_BOUNDS,
    radiusAt: () => minSep,
    isValid,
    maxCount: count,
    seed,
  });

  const detailRng = mulberry32(seed + 31);
  for (const p of points) {
    const url = pool[Math.floor(detailRng() * pool.length)];
    out.push({
      url,
      pos: { x: p.x, y: p.y },
      scale: scaleFn(detailRng),
      rotY: detailRng() * Math.PI * 2,
    });
  }
};

const buildInstances = (biome: Biome, levelId: number): Instance[] => {
  const out: Instance[] = [];

  // 1) Mirror every BIOME_LAYER on the band. The composition naturally
  //    matches the inner area: forest gets grass-dominant clusters (160 ×
  //    1.78 ≈ 285 grass props), snow stays rock-only at proportional count.
  const layers = BIOME_LAYERS[biome];
  for (let li = 0; li < layers.length; li++) {
    placeLayerInBand(out, layers[li], levelId, li);
  }

  // 2) Trees aren't in BIOME_LAYERS. Inner sim spawns INNER_TREE_COUNT
  //    clickable trees; the rim adds proportional non-blocking silhouettes.
  //    Spacing matches sim/world.ts buildTrees: 2 × TREE_FOOTPRINT × avg-scale + slack.
  const trees = BIOME_TREE_URLS[biome];
  if (trees.length > 0) {
    const avgTreeScale = (TREE_MIN_SCALE + TREE_MAX_SCALE) / 2;
    const treeMinSep = 2 * TREE_FOOTPRINT * avgTreeScale + PROP_SPACING_SLACK;
    placeUniformInBand(
      out,
      levelId * 9281 + 137,
      trees,
      Math.round(INNER_TREE_COUNT * BAND_RATIO),
      treeScale,
      treeMinSep,
    );
  }

  // 3) Cosmetics (forest BushFlowers etc.) rendered separately on the
  //    inner via BiomeCosmetics.tsx; mirror at proportional count. The
  //    inner BiomeCosmetics renderer normalizes max-dim to ~0.5 world
  //    units, so even at the upper jitter (~1.4×) one prop spans ~0.7;
  //    1.1 spacing keeps them visually distinct without big gaps.
  const cosmetics = BIOME_COSMETICS[biome];
  if (cosmetics.length > 0) {
    placeUniformInBand(
      out,
      levelId * 5113 + 313,
      cosmetics,
      Math.round(INNER_COSMETIC_COUNT * BAND_RATIO),
      cosmeticScale,
      1.1,
    );
  }

  return out;
};

// Two sizing conventions live in the outer band. URLs that double as
// inner-area props (Trees/Rocks/Ground) render at raw GLTF scale so
// they match. BIOME_COSMETICS-only URLs (BushFlowers etc.) normalize to
// TARGET_SIZE_BY_ROLE so the outer-band size matches the inner cosmetic
// size for those URLs too.
const computeBaseScale = (source: MeshSource, url: string): number => {
  if (!COSMETIC_ONLY_URLS.has(url)) return 1;
  return TARGET_SIZE_BY_ROLE[classifyPropUrl(url)] / source.maxDim;
};

const neverRaycast: THREE.Mesh["raycast"] = () => {};

export const OuterScenery = () => {
  const biome = useGame((s) => s.world.biome);
  const levelId = useGame((s) => s.world.levelId);

  const groups = useMemo(() => {
    const instances = buildInstances(biome, levelId);
    const byUrl = new Map<string, Instance[]>();
    for (const inst of instances) {
      const list = byUrl.get(inst.url) ?? [];
      list.push(inst);
      byUrl.set(inst.url, list);
    }
    return Array.from(byUrl.entries());
  }, [biome, levelId]);

  return (
    <group>
      {groups.map(([url, items]) => (
        <InstancedGroup
          key={url}
          url={url}
          items={items}
          baseScaleFor={computeBaseScale}
          // The directional light's shadow camera spans the playable rect;
          // outer-band shadows would clip the shadow map edge anyway.
          castShadow={false}
          raycast={neverRaycast}
        />
      ))}
    </group>
  );
};

// All URLs we might use across biomes — preload so a biome switch mid-run
// doesn't stutter. BIOME_TREE_URLS and BIOME_LAYERS are already preloaded
// by Trees.tsx/Rocks.tsx/Ground.tsx, but calling preload a second time is
// a no-op so this stays safe.
const allUrls = new Set<string>();
for (const biome of Object.keys(BIOME_TREE_URLS) as Biome[]) {
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
}
for (const layers of Object.values(BIOME_LAYERS)) {
  for (const l of layers) for (const u of l.urls) allUrls.add(u);
}
for (const list of Object.values(BIOME_COSMETICS)) for (const u of list) allUrls.add(u);
for (const u of allUrls) useGLTF.preload(u);
