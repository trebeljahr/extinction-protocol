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
// flavor — non-blocking, non-clickable, deterministic per level. The
// camera shows ~MAP+8 wide and can pan out further still, so without
// this band the fringe reads as flat empty ground stopping at a hard
// rectangle. Mixed clusters of trees+rocks+bushes give the screen edge
// a scattered "we are leaving the main scene" look that thins out
// toward the corners.

// Outer rectangle bounds — calibrated so the deepest fringe is roughly
// where the camera can reach at max pan + fit zoom. Past this the fog
// + screen edge swallow the props anyway.
const OUTER_HALF_W = MAP_WIDTH / 2 + 11; // 31 from center
const OUTER_HALF_H = MAP_HEIGHT / 2 + 9; // 21 from center
// Inner exclusion — slight overlap with the play boundary is fine, but
// stay clear of clickable trees/rocks so the join doesn't double up.
const INNER_HALF_W = MAP_WIDTH / 2 - 0.5;
const INNER_HALF_H = MAP_HEIGHT / 2 - 0.5;

const TOTAL_CLUSTERS = 28;
const PROPS_PER_CLUSTER_MIN = 4;
const PROPS_PER_CLUSTER_MAX = 8;
const CLUSTER_SIGMA = 1.7;
const PROP_MIN_SPACING = 0.6;
// Scattered loners past the cluster band — sells the "fringe" feel in
// the far corners where dense huddles would look unnatural.
const LONER_COUNT = 18;

// Pure cosmetic URLs (BIOME_COSMETICS, e.g. BushFlowers) have no per-layer
// scale band and are authored at wildly varying max-dims. The inner
// BiomeCosmetics renderer normalizes them to TARGET_SIZE_BY_ROLE; we do
// the same here so they read as small ground dressing rather than
// scaling up to obstacle size.
const COSMETIC_ONLY_URLS = (() => {
  const set = new Set<string>();
  for (const list of Object.values(BIOME_COSMETICS)) for (const u of list) set.add(u);
  return set;
})();

type Instance = { url: string; pos: Vec2; scale: number; rotY: number; castShadow: boolean };

type FamilyUrls = {
  trees: string[];
  rocks: string[];
  bushes: string[];
  grass: string[];
  // Small ground-decor: mushrooms, skulls, bushflowers — anything classified
  // as "cosmetic" by URL role. Sits between bushes and grass on the scale
  // ladder and reads as flat dressing, not obstacle.
  ground: string[];
};

const dedupe = (arr: string[]): string[] => Array.from(new Set(arr));

// Collect every decoration URL a biome uses and bucket it by role. The
// inner play area pulls from three sources — BIOME_TREE_URLS (clickable
// trees), BIOME_LAYERS (rocks/bushes/grass/landmarks/dead trees), and
// BIOME_COSMETICS (small flat dressing). The outer band reuses all three
// so the fringe palette matches whatever the player sees inside. Buildings
// (hangars, structures, tents) are skipped — they're hero focal points and
// would look wrong scattered in the corners.
const collectFamilyUrls = (biome: Biome): FamilyUrls => {
  const trees: string[] = [...BIOME_TREE_URLS[biome]];
  const rocks: string[] = [];
  const bushes: string[] = [];
  const grass: string[] = [];
  const ground: string[] = [];
  for (const layer of BIOME_LAYERS[biome]) {
    for (const u of layer.urls) {
      const role = classifyPropUrl(u);
      if (role === "tree") trees.push(u);
      else if (role === "rock") rocks.push(u);
      else if (role === "bush") bushes.push(u);
      else if (role === "grass") grass.push(u);
      else if (role === "cosmetic") ground.push(u);
      // role === "building" intentionally skipped
    }
  }
  for (const u of BIOME_COSMETICS[biome]) ground.push(u);
  return {
    trees: dedupe(trees),
    rocks: dedupe(rocks),
    bushes: dedupe(bushes),
    grass: dedupe(grass),
    ground: dedupe(ground),
  };
};

// "Theme" of a cluster — biases the prop URL toward one family while
// still mixing in some of the others (real ecosystems aren't monocultures).
type ClusterTheme = "tree" | "rock" | "bush" | "mixed";
const THEMES: ClusterTheme[] = ["tree", "tree", "rock", "bush", "mixed"];
type Family = keyof FamilyUrls;
const ALL_FAMILIES: Family[] = ["trees", "rocks", "bushes", "grass", "ground"];

// Per-theme weights across the five families. Theme's primary gets the
// lion's share; the other big-silhouette families fill the middle; grass
// and ground decor fill the gaps. Real nature clusters aren't monocultures
// — a stand of trees comes with bushes near the roots and tufts of grass
// underfoot.
const THEME_WEIGHTS: Record<ClusterTheme, Record<Family, number>> = {
  tree: { trees: 0.5, rocks: 0.12, bushes: 0.15, grass: 0.13, ground: 0.1 },
  rock: { trees: 0.15, rocks: 0.5, bushes: 0.1, grass: 0.12, ground: 0.13 },
  bush: { trees: 0.12, rocks: 0.1, bushes: 0.5, grass: 0.18, ground: 0.1 },
  mixed: { trees: 0.25, rocks: 0.2, bushes: 0.2, grass: 0.2, ground: 0.15 },
};

const pickUrlForTheme = (
  theme: ClusterTheme,
  fams: FamilyUrls,
  rng: () => number,
): string | null => {
  // Weighted family pick, only sampling families that actually have URLs
  // (otherwise an empty family steals probability mass from one that
  // could have rendered).
  const weights = THEME_WEIGHTS[theme];
  let total = 0;
  for (const fam of ALL_FAMILIES) if (fams[fam].length > 0) total += weights[fam];
  if (total <= 0) return null;
  let r = rng() * total;
  for (const fam of ALL_FAMILIES) {
    if (fams[fam].length === 0) continue;
    r -= weights[fam];
    if (r <= 0) {
      const pool = fams[fam];
      return pool[Math.floor(rng() * pool.length)];
    }
  }
  // Numerical fallback — pick the last non-empty family.
  for (let i = ALL_FAMILIES.length - 1; i >= 0; i--) {
    const pool = fams[ALL_FAMILIES[i]];
    if (pool.length > 0) return pool[Math.floor(rng() * pool.length)];
  }
  return null;
};

// Find the BIOME_LAYERS spec that owns a given URL so the outer band
// reuses the exact same min/max scale the inner play area uses. Without
// this the band normalizes to TARGET_SIZE_BY_ROLE while the inner area
// uses raw GLTF scale × layer multiplier, and the outer props read
// noticeably smaller than the inner ones using the same mesh.
const layerForUrl = (biome: Biome, url: string): BiomeLayer | undefined => {
  for (const layer of BIOME_LAYERS[biome]) {
    if (layer.urls.includes(url)) return layer;
  }
  return undefined;
};

const scaleForUrl = (biome: Biome, url: string, rng: () => number): number => {
  // If the URL appears in a BIOME_LAYERS spec, reuse that layer's scale
  // band — matches the inner play area exactly. This branch covers
  // rocks, bushes, grass, mushrooms, skulls, dead trees, crystals, etc.
  const layer = layerForUrl(biome, url);
  if (layer) {
    // Triangular distribution mid-biases the size so the fringe doesn't
    // look like equal-thirds large/medium/small — most props mid-range
    // with the occasional small/large outlier.
    return layer.minScale + ((rng() + rng()) / 2) * (layer.maxScale - layer.minScale);
  }
  const role = classifyPropUrl(url);
  // Trees from BIOME_TREE_URLS (clickable in the inner sim) use the
  // global tree scale window the inner Trees.tsx renders with.
  if (role === "tree") {
    return TREE_MIN_SCALE + ((rng() + rng()) / 2) * (TREE_MAX_SCALE - TREE_MIN_SCALE);
  }
  // BIOME_COSMETICS URLs (BushFlowers etc.) — the renderer normalizes
  // these to TARGET_SIZE_BY_ROLE so the multiplier here is per-instance
  // size jitter on top of the normalized target. Mirrors the spread
  // BiomeCosmetics.tsx uses on the inner area.
  if (role === "cosmetic") {
    return 0.7 + ((rng() + rng()) / 2) * 0.7;
  }
  return 0.7 + rng() * 0.4;
};

// Sample a position uniformly inside the band (outer rect minus inner rect).
// Weighting toward the inner edge happens in the acceptance step.
const sampleBandPoint = (rng: () => number): Vec2 => {
  // Pick which side of the band to land in by area weight, then sample
  // uniformly inside that side. Sides overlap at corners; that's fine.
  const horizontalArea = OUTER_HALF_W * 2 * (OUTER_HALF_H - INNER_HALF_H);
  const verticalArea = (OUTER_HALF_W - INNER_HALF_W) * INNER_HALF_H * 2;
  const totalArea = 2 * horizontalArea + 2 * verticalArea;
  const r = rng() * totalArea;
  let acc = horizontalArea;
  if (r < acc) {
    // Top strip (y > INNER_HALF_H, full outer width)
    return {
      x: (rng() - 0.5) * 2 * OUTER_HALF_W,
      y: INNER_HALF_H + rng() * (OUTER_HALF_H - INNER_HALF_H),
    };
  }
  acc += horizontalArea;
  if (r < acc) {
    // Bottom strip
    return {
      x: (rng() - 0.5) * 2 * OUTER_HALF_W,
      y: -INNER_HALF_H - rng() * (OUTER_HALF_H - INNER_HALF_H),
    };
  }
  acc += verticalArea;
  if (r < acc) {
    // Left strip (x < -INNER_HALF_W, mid-height only)
    return {
      x: -INNER_HALF_W - rng() * (OUTER_HALF_W - INNER_HALF_W),
      y: (rng() - 0.5) * 2 * INNER_HALF_H,
    };
  }
  // Right strip
  return {
    x: INNER_HALF_W + rng() * (OUTER_HALF_W - INNER_HALF_W),
    y: (rng() - 0.5) * 2 * INNER_HALF_H,
  };
};

// Quadratic falloff toward the outer edge. 1 at the inner boundary,
// ~0.3 at the outer boundary. Used to thin out far-corner density.
const innerEdgeAffinity = (pos: Vec2): number => {
  const overshootX = Math.max(0, Math.abs(pos.x) - INNER_HALF_W);
  const overshootY = Math.max(0, Math.abs(pos.y) - INNER_HALF_H);
  const bandX = OUTER_HALF_W - INNER_HALF_W;
  const bandY = OUTER_HALF_H - INNER_HALF_H;
  const tx = bandX > 0 ? overshootX / bandX : 0;
  const ty = bandY > 0 ? overshootY / bandY : 0;
  const t = Math.max(tx, ty); // 0 at inner edge, 1 at outer edge
  return 1 - 0.7 * t * t; // quadratic; never falls below 0.3
};

const insideOuter = (pos: Vec2): boolean =>
  Math.abs(pos.x) <= OUTER_HALF_W && Math.abs(pos.y) <= OUTER_HALF_H;

const insideInner = (pos: Vec2): boolean =>
  Math.abs(pos.x) < INNER_HALF_W && Math.abs(pos.y) < INNER_HALF_H;

const totalUrls = (fams: FamilyUrls): number =>
  fams.trees.length +
  fams.rocks.length +
  fams.bushes.length +
  fams.grass.length +
  fams.ground.length;

const buildInstances = (biome: Biome, levelId: number): Instance[] => {
  const fams = collectFamilyUrls(biome);
  if (totalUrls(fams) === 0) return [];
  const rng = mulberry32(levelId * 17389 + 991);
  const out: Instance[] = [];
  const spacingSq = PROP_MIN_SPACING * PROP_MIN_SPACING;

  // 1) Pick cluster anchors with inner-edge bias.
  const anchors: { pos: Vec2; theme: ClusterTheme }[] = [];
  let tries = 0;
  while (anchors.length < TOTAL_CLUSTERS && tries < TOTAL_CLUSTERS * 30) {
    tries++;
    const candidate = sampleBandPoint(rng);
    // Reject with probability proportional to distance-from-inner-edge.
    if (rng() > innerEdgeAffinity(candidate)) continue;
    // Minimum anchor separation so clusters don't bleed into each other.
    let tooClose = false;
    for (const a of anchors) {
      const dx = a.pos.x - candidate.x;
      const dy = a.pos.y - candidate.y;
      if (dx * dx + dy * dy < 4 * 4) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    anchors.push({ pos: candidate, theme: THEMES[Math.floor(rng() * THEMES.length)] });
  }

  // 2) Place props per cluster.
  for (const anchor of anchors) {
    const propCount =
      PROPS_PER_CLUSTER_MIN +
      Math.floor(rng() * (PROPS_PER_CLUSTER_MAX - PROPS_PER_CLUSTER_MIN + 1));
    let placed = 0;
    let attempts = 0;
    while (placed < propCount && attempts < propCount * 12) {
      attempts++;
      const px = anchor.pos.x + gaussian(rng, CLUSTER_SIGMA);
      const py = anchor.pos.y + gaussian(rng, CLUSTER_SIGMA);
      const pos: Vec2 = { x: px, y: py };
      if (!insideOuter(pos)) continue;
      if (insideInner(pos)) continue; // keep clear of playable rectangle
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
      const url = pickUrlForTheme(anchor.theme, fams, rng);
      if (!url) continue;
      out.push({
        url,
        pos,
        scale: scaleForUrl(biome, url, rng),
        rotY: rng() * Math.PI * 2,
        // Disable shadows for the fringe — the directional light's shadow
        // camera spans the playable rectangle; outer trees would clip the
        // shadow map edge. The visual cost is small at this distance and
        // fog softens the loss.
        castShadow: false,
      });
      placed++;
    }
  }

  // 3) Scattered loners near the outer edge — biased to corners where
  // anchor density runs out. Mostly trees + the occasional rock, which
  // read as distant silhouettes "drifting off" the screen.
  let loners = 0;
  let loneTries = 0;
  while (loners < LONER_COUNT && loneTries < LONER_COUNT * 25) {
    loneTries++;
    // Sample biased toward the outer edge by squaring the band coord.
    const side = Math.floor(rng() * 4);
    const u = rng();
    const tFar = u * u; // 0 → inner, 1 → outer; biased toward outer
    const px =
      side === 0 || side === 1
        ? (rng() - 0.5) * 2 * OUTER_HALF_W
        : side === 2
          ? -(INNER_HALF_W + tFar * (OUTER_HALF_W - INNER_HALF_W))
          : INNER_HALF_W + tFar * (OUTER_HALF_W - INNER_HALF_W);
    const py =
      side === 0
        ? INNER_HALF_H + tFar * (OUTER_HALF_H - INNER_HALF_H)
        : side === 1
          ? -(INNER_HALF_H + tFar * (OUTER_HALF_H - INNER_HALF_H))
          : (rng() - 0.5) * 2 * OUTER_HALF_H;
    const pos: Vec2 = { x: px, y: py };
    if (!insideOuter(pos) || insideInner(pos)) continue;
    let blocked = false;
    for (const o of out) {
      const dx = o.pos.x - px;
      const dy = o.pos.y - py;
      if (dx * dx + dy * dy < PROP_MIN_SPACING * 1.4 * (PROP_MIN_SPACING * 1.4)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    // Loners lean to large silhouettes (trees, rocks) — small bushes and
    // grass barely read this far from the camera anyway. Falls back through
    // smaller families when the biome doesn't have one of the big ones.
    const lonerPicks: Family[] = ["trees", "trees", "rocks", "bushes", "ground"];
    let pool: string[] = [];
    for (let i = 0; i < lonerPicks.length; i++) {
      const fam = lonerPicks[Math.floor(rng() * lonerPicks.length)];
      if (fams[fam].length > 0) {
        pool = fams[fam];
        break;
      }
    }
    if (pool.length === 0) {
      for (const fam of ALL_FAMILIES) {
        if (fams[fam].length > 0) {
          pool = fams[fam];
          break;
        }
      }
    }
    if (pool.length === 0) {
      loners++;
      continue;
    }
    const url = pool[Math.floor(rng() * pool.length)];
    out.push({
      url,
      pos,
      scale: scaleForUrl(biome, url, rng),
      rotY: rng() * Math.PI * 2,
      castShadow: false,
    });
    loners++;
  }

  return out;
};

// renderBase is 1 for everything that matches an inner-area renderer
// (Trees.tsx, Rocks.tsx, Ground.tsx — all use raw GLTF transform × instance
// scale). For BIOME_COSMETICS-only URLs (BushFlowers etc.) it's the same
// TARGET_SIZE_BY_ROLE / maxDim factor BiomeCosmetics.tsx applies, so the
// outer-band size matches the inner cosmetic size for those URLs too.
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
