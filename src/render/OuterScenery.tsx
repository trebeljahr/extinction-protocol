import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type * as THREE from "three";
import {
  BIOME_COSMETICS,
  BIOME_LAYERS,
  type Biome,
  type BiomeLayer,
  classifyPropUrl,
  TARGET_SIZE_BY_ROLE,
} from "../biomes";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { poissonDiskSample } from "../sim/poisson";
import { mulberry32 } from "../sim/random";
import type { Vec2 } from "../sim/types";
import { sampleStratifiedFeatures, worleyFieldFromFeatures } from "../sim/worley";
import { useGame } from "../store";
import { InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Decorative scenery in the band *outside* the playable rectangle —
// non-blocking ground layers (grass etc.) and cosmetics (flowers etc.).
// Trees and blocking rocks are spawned by buildTrees/buildRocks in
// world.ts with expanded bounds so they're deconstructable.

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

const defaultFootprint = (url: string): number => {
  const f = url.toLowerCase();
  if (/grass/.test(f)) return 0.28;
  if (/bush/.test(f)) return 0.6;
  return 0.5;
};

const layerFootprint = (layer: BiomeLayer): number =>
  layer.footprint ?? defaultFootprint(layer.urls[0] ?? "");

const layerMinSpacing = (layer: BiomeLayer): number => {
  const footprint = layerFootprint(layer);
  return 2 * footprint * layer.maxScale + PROP_SPACING_SLACK;
};

// Pure cosmetic URLs (BIOME_COSMETICS, e.g. BushFlowers) have no per-layer
// scale band; the inner BiomeCosmetics renderer normalizes them to
// TARGET_SIZE_BY_ROLE, and we mirror that here.
const COSMETIC_ONLY_URLS = (() => {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_COSMETICS)) for (const u of list) set.add(u);
  return set;
})();

const INNER_COSMETIC_COUNT = 14;

// Band-to-inner area ratio: rim count = inner count × this. With the current
// outer/inner bounds it's ~1707 / 960 = 1.78.
const BAND_AREA = OUTER_HALF_W * 2 * OUTER_HALF_H * 2 - INNER_HALF_W * 2 * INNER_HALF_H * 2;
const INNER_AREA = MAP_WIDTH * MAP_HEIGHT;
const BAND_RATIO = BAND_AREA / INNER_AREA;

type Instance = { url: string; pos: Vec2; scale: number; rotY: number };

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
// waste falloff on the playable rect). Each side of the band gets a
// proportional share, stratified inside that side's rect — pure random
// rim sampling reliably stacked features on one side of the map and
// left the other bare.
const BAND_SIDES = (() => {
  const top = {
    minX: -OUTER_HALF_W,
    maxX: OUTER_HALF_W,
    minY: INNER_HALF_H,
    maxY: OUTER_HALF_H,
  };
  const bottom = {
    minX: -OUTER_HALF_W,
    maxX: OUTER_HALF_W,
    minY: -OUTER_HALF_H,
    maxY: -INNER_HALF_H,
  };
  const left = {
    minX: -OUTER_HALF_W,
    maxX: -INNER_HALF_W,
    minY: -INNER_HALF_H,
    maxY: INNER_HALF_H,
  };
  const right = {
    minX: INNER_HALF_W,
    maxX: OUTER_HALF_W,
    minY: -INNER_HALF_H,
    maxY: INNER_HALF_H,
  };
  const area = (b: typeof top) => (b.maxX - b.minX) * (b.maxY - b.minY);
  return [top, bottom, left, right].map((bounds) => ({ bounds, area: area(bounds) }));
})();

const pickBandFeatures = (seed: number, count: number): Vec2[] => {
  if (count <= 0) return [];
  const totalArea = BAND_SIDES.reduce((s, side) => s + side.area, 0);
  const features: Vec2[] = [];
  let placed = 0;
  for (let i = 0; i < BAND_SIDES.length; i++) {
    const side = BAND_SIDES[i];
    const isLast = i === BAND_SIDES.length - 1;
    const share = isLast
      ? Math.max(0, count - placed)
      : Math.round((count * side.area) / totalArea);
    if (share <= 0) continue;
    features.push(...sampleStratifiedFeatures(seed + i * 7919, side.bounds, share));
    placed += share;
  }
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
  const sigma = layer.cluster?.sigma ?? 2.0;
  const featureRadius = sigma * 2.0;
  const featureCount = Math.max(4, Math.round((layer.cluster?.seeds ?? 5) * Math.sqrt(BAND_RATIO)));
  const features = pickBandFeatures(seedBase, featureCount);
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

// Uniform Poisson scatter for cosmetics that don't have a BIOME_LAYERS
// entry. No Worley modulation, just a flat density at the given spacing.
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

  // Non-blocking ground layers (grass, etc.) in the outer band. Blocking
  // layers (rocks) and trees are now spawned by buildRocks/buildTrees in
  // world.ts with expanded bounds, so they live in world.rocks/world.trees
  // and are deconstructable like the inner ones.
  const layers = BIOME_LAYERS[biome];
  for (let li = 0; li < layers.length; li++) {
    if (layers[li].blocks) continue;
    placeLayerInBand(out, layers[li], levelId, li);
  }

  // Cosmetics (forest BushFlowers etc.) rendered separately on the
  // inner via BiomeCosmetics.tsx; mirror at proportional count.
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

// Preload non-blocking layer + cosmetic URLs across biomes.
const allUrls = new Set<string>();
for (const layers of Object.values(BIOME_LAYERS)) {
  for (const l of layers) if (!l.blocks) for (const u of l.urls) allUrls.add(u);
}
for (const list of Object.values(BIOME_COSMETICS)) for (const u of list) allUrls.add(u);
for (const u of allUrls) useGLTF.preload(u);
