import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BIOME_LAYERS,
  BIOME_TREE_URLS,
  type Biome,
  classifyPropUrl,
  TARGET_SIZE_BY_ROLE,
} from "../biomes";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

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

const TOTAL_CLUSTERS = 26;
const PROPS_PER_CLUSTER_MIN = 3;
const PROPS_PER_CLUSTER_MAX = 7;
const CLUSTER_SIGMA = 1.7;
const PROP_MIN_SPACING = 1.0;
// Scattered loners past the cluster band — sells the "fringe" feel in
// the far corners where dense huddles would look unnatural.
const LONER_COUNT = 14;

type Instance = { url: string; pos: Vec2; scale: number; rotY: number; castShadow: boolean };

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Box–Muller normal sample for cluster offsets.
const gaussian = (rng: () => number, sigma: number): number => {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
};

// Pull URLs out of BIOME_LAYERS for the three prop families used in the
// fringe. Matches on URL pattern so the same logic works for every biome
// without re-listing per biome.
const collectFamilyUrls = (biome: Biome) => {
  const layers = BIOME_LAYERS[biome];
  const trees = BIOME_TREE_URLS[biome];
  const rocks: string[] = [];
  const bushes: string[] = [];
  for (const l of layers) {
    for (const u of l.urls) {
      const f = u.toLowerCase();
      if (/rock|crystal|meteor|skull/.test(f)) rocks.push(u);
      else if (/bush|plant/.test(f)) bushes.push(u);
    }
  }
  return { trees, rocks, bushes };
};

// "Theme" of a cluster — biases the prop URL toward one family while
// still mixing in some of the others (real ecosystems aren't monocultures).
type ClusterTheme = "tree" | "rock" | "bush" | "mixed";
const THEMES: ClusterTheme[] = ["tree", "tree", "rock", "bush", "mixed"];

const pickUrlForTheme = (
  theme: ClusterTheme,
  fams: { trees: string[]; rocks: string[]; bushes: string[] },
  rng: () => number,
): string | null => {
  // Weighted picker: theme's family gets 65%, the other two split 35%.
  const r = rng();
  let order: ("tree" | "rock" | "bush")[];
  if (theme === "tree") order = ["tree", "rock", "bush"];
  else if (theme === "rock") order = ["rock", "tree", "bush"];
  else if (theme === "bush") order = ["bush", "tree", "rock"];
  else
    order =
      r < 0.34
        ? ["tree", "rock", "bush"]
        : r < 0.67
          ? ["rock", "tree", "bush"]
          : ["bush", "tree", "rock"];
  const primaryRoll = rng();
  const pick = primaryRoll < 0.65 ? order[0] : primaryRoll < 0.85 ? order[1] : order[2];
  const pool = pick === "tree" ? fams.trees : pick === "rock" ? fams.rocks : fams.bushes;
  if (pool.length === 0) {
    // Fall back through families if the preferred one is empty.
    for (const k of order) {
      const p = k === "tree" ? fams.trees : k === "rock" ? fams.rocks : fams.bushes;
      if (p.length > 0) return p[Math.floor(rng() * p.length)];
    }
    return null;
  }
  return pool[Math.floor(rng() * pool.length)];
};

// Per-role scale jitter — trees in the fringe occasionally lean small
// (saplings, distant silhouettes), rocks vary more. Biome-author scale
// ranges aren't directly reused because they're tuned for the inner play
// area where size hierarchy matters more.
const scaleForUrl = (url: string, rng: () => number): number => {
  const role = classifyPropUrl(url);
  switch (role) {
    case "tree":
      // Triangular distribution biased mid-size, with occasional small
      // edge trees and the rare large hero.
      return 0.55 + ((rng() + rng()) / 2) * 0.65;
    case "rock":
      return 0.6 + rng() * 0.75;
    case "bush":
      return 0.5 + rng() * 0.55;
    default:
      return 0.7 + rng() * 0.4;
  }
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

const buildInstances = (biome: Biome, levelId: number): Instance[] => {
  const fams = collectFamilyUrls(biome);
  if (fams.trees.length + fams.rocks.length + fams.bushes.length === 0) return [];
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
        scale: scaleForUrl(url, rng),
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
    // 70% tree, 30% rock — bushes don't read at this distance.
    const useTree = rng() < 0.7 && fams.trees.length > 0;
    const pool = useTree ? fams.trees : fams.rocks.length > 0 ? fams.rocks : fams.trees;
    if (pool.length === 0) {
      loners++;
      continue;
    }
    const url = pool[Math.floor(rng() * pool.length)];
    // Loners trend smaller — they're meant to look like distant outliers.
    const baseScale = scaleForUrl(url, rng);
    out.push({
      url,
      pos,
      scale: baseScale * (0.7 + rng() * 0.35),
      rotY: rng() * Math.PI * 2,
      castShadow: false,
    });
    loners++;
  }

  return out;
};

// --- Rendering: collect every primitive so multi-part GLBs (Quaternius
// snow trees: trunk + cap, sci-fi rocks: body + crystal vein) render in
// full. Same pattern as BiomeCosmetics/Trees/Rocks.

type Part = { id: string; geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number; baseScale: number };

const collectSource = (scene: THREE.Object3D, url: string): Source | null => {
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const union = new THREE.Box3();
  let unionSet = false;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      geom.computeBoundingBox();
      if (geom.boundingBox) {
        if (!unionSet) {
          union.copy(geom.boundingBox);
          unionSet = true;
        } else union.union(geom.boundingBox);
      }
      parts.push({ id: nanoid(), geom, material: mat as THREE.Material });
    }
  });
  if (parts.length === 0 || !unionSet) return null;
  const size = union.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const role = classifyPropUrl(url);
  const target = TARGET_SIZE_BY_ROLE[role];
  return { parts, minY: union.min.y, baseScale: target / maxDim };
};

const neverRaycast: THREE.Mesh["raycast"] = () => {};

const InstanceGroup = ({ url, items }: { url: string; items: Instance[] }) => {
  const { scene } = useGLTF(url);
  const source = useMemo(() => collectSource(scene, url), [scene, url]);
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    if (!source) return;
    const dummy = new THREE.Object3D();
    for (const im of partRefs.current) {
      if (!im) continue;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = source.baseScale * it.scale;
        dummy.position.set(it.pos.x, -source.minY * s, -it.pos.y);
        dummy.rotation.set(0, it.rotY, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = items.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [items, source]);

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
for (const u of allUrls) useGLTF.preload(u);
