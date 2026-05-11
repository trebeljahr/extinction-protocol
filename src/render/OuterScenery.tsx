import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
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
import { gaussian, mulberry32 } from "../sim/random";
import type { Vec2 } from "../sim/types";
import { TREE_MAX_SCALE, TREE_MIN_SCALE } from "../sim/world";
import { useGame } from "../store";
import { collectMeshSource, type MeshSource } from "./meshSource";

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

const PROP_MIN_SPACING = 0.6;

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

type Instance = { url: string; pos: Vec2; scale: number; rotY: number; castShadow: boolean };

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

const insideOuter = (pos: Vec2): boolean =>
  Math.abs(pos.x) <= OUTER_HALF_W && Math.abs(pos.y) <= OUTER_HALF_H;

const insideInner = (pos: Vec2): boolean =>
  Math.abs(pos.x) < INNER_HALF_W && Math.abs(pos.y) < INNER_HALF_H;

// Pick K cluster seed points in the band with a minimum separation so the
// gaussian halos around each seed don't pile on top of each other.
const pickBandSeeds = (rng: () => number, count: number): Vec2[] => {
  const seeds: Vec2[] = [];
  const minSepSq = 4 * 4;
  let tries = 0;
  while (seeds.length < count && tries < count * 70) {
    tries++;
    const candidate = sampleBandPoint(rng);
    let tooClose = false;
    for (const s of seeds) {
      const dx = s.x - candidate.x;
      const dy = s.y - candidate.y;
      if (dx * dx + dy * dy < minSepSq) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) seeds.push(candidate);
  }
  return seeds;
};

// Mirror one BIOME_LAYER on the band at proportional count using the layer's
// own cluster config. Spacing-checks against the running `out` list so
// previously-placed layers don't collide.
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

  const rng = mulberry32(layer.seed * 17 + levelId * 4451 + layerIndex * 991);
  const sigma = layer.cluster?.sigma ?? 2.0;
  const seedCount = Math.max(4, Math.round((layer.cluster?.seeds ?? 5) * Math.sqrt(BAND_RATIO)));
  const seeds = pickBandSeeds(rng, seedCount);
  if (seeds.length === 0) seeds.push(sampleBandPoint(rng));

  const spacingSq = PROP_MIN_SPACING * PROP_MIN_SPACING;
  let placed = 0;
  let attempts = 0;
  while (placed < targetCount && attempts < targetCount * 25) {
    attempts++;
    const seed = seeds[Math.floor(rng() * seeds.length)];
    const px = seed.x + gaussian(rng, sigma);
    const py = seed.y + gaussian(rng, sigma);
    const pos: Vec2 = { x: px, y: py };
    if (!insideOuter(pos) || insideInner(pos)) continue;

    let blocked = false;
    for (const o of out) {
      const dx = o.pos.x - px;
      const dy = o.pos.y - py;
      if (dx * dx + dy * dy < spacingSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const url = layer.urls[Math.floor(rng() * layer.urls.length)];
    out.push({
      url,
      pos,
      scale: layerScale(rng, layer),
      rotY: rng() * Math.PI * 2,
      // The directional light's shadow camera spans the playable rect;
      // outer-band shadows would clip the shadow map edge anyway.
      castShadow: false,
    });
    placed++;
  }
};

// Place uniform scatter for things that don't have a BIOME_LAYERS entry —
// trees (BIOME_TREE_URLS) and cosmetics (BIOME_COSMETICS).
const placeUniformInBand = (
  out: Instance[],
  rng: () => number,
  pool: string[],
  count: number,
  scaleFn: (rng: () => number) => number,
  spacingMult: number,
): void => {
  if (count === 0 || pool.length === 0) return;
  const minSep = PROP_MIN_SPACING * spacingMult;
  const minSepSq = minSep * minSep;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 25) {
    attempts++;
    const pos = sampleBandPoint(rng);
    if (!insideOuter(pos) || insideInner(pos)) continue;

    let blocked = false;
    for (const o of out) {
      const dx = o.pos.x - pos.x;
      const dy = o.pos.y - pos.y;
      if (dx * dx + dy * dy < minSepSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const url = pool[Math.floor(rng() * pool.length)];
    out.push({
      url,
      pos,
      scale: scaleFn(rng),
      rotY: rng() * Math.PI * 2,
      castShadow: false,
    });
    placed++;
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
  const trees = BIOME_TREE_URLS[biome];
  if (trees.length > 0) {
    const rng = mulberry32(levelId * 9281 + 137);
    placeUniformInBand(out, rng, trees, Math.round(INNER_TREE_COUNT * BAND_RATIO), treeScale, 3);
  }

  // 3) Cosmetics (forest BushFlowers etc.) rendered separately on the
  //    inner via BiomeCosmetics.tsx; mirror at proportional count.
  const cosmetics = BIOME_COSMETICS[biome];
  if (cosmetics.length > 0) {
    const rng = mulberry32(levelId * 5113 + 313);
    placeUniformInBand(
      out,
      rng,
      cosmetics,
      Math.round(INNER_COSMETIC_COUNT * BAND_RATIO),
      cosmeticScale,
      1.8,
    );
  }

  return out;
};

// Two sizing conventions live in the outer band. URLs that double as
// inner-area props (Trees/Rocks/Ground) render at raw GLTF scale so
// they match. BIOME_COSMETICS-only URLs (BushFlowers etc.) normalize to
// TARGET_SIZE_BY_ROLE so the outer-band size matches the inner cosmetic
// size for those URLs too.
const computeRenderBase = (url: string, source: MeshSource): number => {
  if (!COSMETIC_ONLY_URLS.has(url)) return 1;
  return TARGET_SIZE_BY_ROLE[classifyPropUrl(url)] / source.maxDim;
};

const neverRaycast: THREE.Mesh["raycast"] = () => {};

const InstanceGroup = ({ url, items }: { url: string; items: Instance[] }) => {
  const { scene } = useGLTF(url);
  const source = useMemo(() => collectMeshSource(scene), [scene]);
  const renderBase = useMemo(() => (source ? computeRenderBase(url, source) : 1), [source, url]);
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    if (!source) return;
    const dummy = new THREE.Object3D();
    for (const im of partRefs.current) {
      if (!im) continue;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = renderBase * it.scale;
        dummy.position.set(it.pos.x, -source.minY * s, -it.pos.y);
        dummy.rotation.set(0, it.rotY, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = items.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [items, source, renderBase]);

  if (!source || items.length === 0) return null;

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          key={part.id}
          ref={(el: THREE.InstancedMesh | null) => {
            partRefs.current[pi] = el;
          }}
          args={[part.geom, part.material, items.length]}
          castShadow={false}
          receiveShadow
          raycast={neverRaycast}
        />
      ))}
    </group>
  );
};

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
        <InstanceGroup key={url} url={url} items={items} />
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
