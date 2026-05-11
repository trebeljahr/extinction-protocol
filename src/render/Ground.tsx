import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ALL_BIOME_URLS, BIOME_LAYERS, BIOME_STYLE, type BiomeLayer } from "../biomes";
import {
  buildLavaFeatures,
  hasFlowFeatures,
  isOnLavaSurface,
  type LavaFeatures,
} from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { poissonDiskSample } from "../sim/poisson";
import { mulberry32 } from "../sim/random";
import type { Rock, Tree, Vec2 } from "../sim/types";
import { distPointToSegSq } from "../sim/vec2";
import { ROCK_FOOTPRINT, TOWER_FOOTPRINT, TREE_FOOTPRINT } from "../sim/world";
import { createWorleyField } from "../sim/worley";
import { useGame } from "../store";

const nearAnyPath = (paths: Vec2[][], x: number, y: number, clearance: number) => {
  const r2 = clearance * clearance;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < r2)
        return true;
    }
  }
  return false;
};

type Placement = { x: number; y: number; scale: number; rot: number; r: number };

// Default footprint guesses by URL family — used when a BiomeLayer omits
// `footprint`. Grass is small, bushes are mid, anything else falls back
// to a conservative 0.5 so unfamiliar packs still get reasonable spacing.
const defaultFootprint = (url: string): number => {
  const f = url.toLowerCase();
  if (/grass/.test(f)) return 0.28;
  if (/bush/.test(f)) return 0.6;
  if (/rock/.test(f)) return 0.55;
  return 0.5;
};

const layerFootprint = (spec: BiomeLayer): number =>
  spec.footprint ?? defaultFootprint(spec.urls[0] ?? "");

// Margin between placements on top of summed footprint-radii. Keeps
// neighbours visually distinct without forcing them to never touch.
const PROP_SPACING_SLACK = 0.15;

// Sparse-region spacing multiplier — Poisson radius in low-density
// Worley regions is r_min × this. >1 spreads outliers out.
const DECOR_MAX_SPACING_MUL = 2.0;

// Build placements for one non-blocking layer using a Worley density
// field + variable-radius Poisson disk sampling. Density features come
// from the layer's `cluster` config (seeds → feature count, sigma →
// feature radius); Poisson packs tight inside features and loose
// between them. External constraints (paths, lava, blockers, earlier
// decor) plug into `isValid`.
const buildLayer = (
  paths: Vec2[][],
  spec: BiomeLayer,
  decor: (Placement & { layerIndex: number })[],
  blockers: { x: number; y: number; r: number }[],
  lava: LavaFeatures | null,
  layerIndex: number,
): Placement[][] => {
  const buckets: Placement[][] = spec.urls.map(() => []);
  const footprint = layerFootprint(spec);
  const halfW = MAP_WIDTH * 0.475;
  const halfH = MAP_HEIGHT * 0.475;
  const bounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };

  // Per-layer Worley field. Different layers in the same biome get
  // different seeds, so a grass-cluster centre and a bush-cluster
  // centre rarely overlap exactly — the rim reads as varied terrain.
  const sigma = spec.cluster?.sigma ?? 2.5;
  const featureRadius = sigma * 2.0;
  const featureCount = spec.cluster?.seeds ?? 5;
  const worley = createWorleyField(spec.seed, bounds, featureCount, featureRadius);

  // Layer min-spacing — derived from footprint × avg scale × 2 (two
  // halves touching) plus slack. Matches the additive convention the
  // old rejection loop used between same-layer props.
  const avgScale = (spec.minScale + spec.maxScale) / 2;
  const rMin = 2 * footprint * avgScale + PROP_SPACING_SLACK;
  const rMax = rMin * DECOR_MAX_SPACING_MUL;
  const radiusAt = (x: number, y: number): number => {
    const d = worley.density(x, y);
    return rMin + (1 - d) * (rMax - rMin);
  };

  // Conservative footprints for external checks — use max scale so a
  // max-scale instance at the candidate position couldn't graze any
  // blocker either.
  const candidateR = footprint * spec.maxScale;
  const lavaFootprint = footprint * spec.maxScale + 0.2;

  const isValid = (x: number, y: number): boolean => {
    if (nearAnyPath(paths, x, y, spec.clearance)) return false;
    if (isOnLavaSurface(lava, x, y, lavaFootprint)) return false;
    for (const b of blockers) {
      const dx = b.x - x;
      const dy = b.y - y;
      const min = candidateR + b.r + PROP_SPACING_SLACK;
      if (dx * dx + dy * dy < min * min) return false;
    }
    for (const d of decor) {
      const dx = d.x - x;
      const dy = d.y - y;
      const min = candidateR + d.r + PROP_SPACING_SLACK;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  };

  const points = poissonDiskSample({
    bounds,
    radiusAt,
    isValid,
    maxCount: spec.count,
    seed: spec.seed * 31 + layerIndex * 7 + 23,
  });

  const detailRng = mulberry32(spec.seed * 53 + 91);
  for (const p of points) {
    const variant = Math.floor(detailRng() * spec.urls.length);
    const scale = spec.minScale + detailRng() * (spec.maxScale - spec.minScale);
    const r = footprint * scale;
    const placement: Placement = { x: p.x, y: p.y, scale, rot: detailRng() * Math.PI * 2, r };
    buckets[variant].push(placement);
    decor.push({ ...placement, layerIndex });
  }
  return buckets;
};

const NatureInstances = ({
  url,
  placements,
  castShadow,
}: {
  url: string;
  placements: Placement[];
  castShadow: boolean;
}) => {
  const { scene } = useGLTF(url);
  const instRef = useRef<THREE.InstancedMesh>(null);

  const source = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) return null;
    const m = mesh as THREE.Mesh;
    m.updateMatrixWorld(true);
    const geom = m.geometry.clone();
    geom.applyMatrix4(m.matrixWorld);
    geom.computeBoundingBox();
    const minY = geom.boundingBox?.min.y ?? 0;
    return { geom, material: m.material as THREE.Material, minY };
  }, [scene]);

  useEffect(() => {
    const im = instRef.current;
    if (!im || !source) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      dummy.position.set(p.x, -source.minY * p.scale, -p.y);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.count = placements.length;
    im.instanceMatrix.needsUpdate = true;
  }, [placements, source]);

  if (!source || placements.length === 0) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[source.geom, source.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
};

const buildBlockers = (trees: Tree[], rocks: Rock[]): { x: number; y: number; r: number }[] => {
  const out: { x: number; y: number; r: number }[] = [];
  for (const t of trees) out.push({ x: t.pos.x, y: t.pos.y, r: TREE_FOOTPRINT * t.scale });
  for (const r of rocks) out.push({ x: r.pos.x, y: r.pos.y, r: ROCK_FOOTPRINT * r.scale });
  return out;
};

export const Ground = () => {
  const paths = useGame((s) => s.world.paths);
  const biome = useGame((s) => s.world.biome);
  const levelId = useGame((s) => s.world.levelId);
  const trees = useGame((s) => s.world.trees);
  const rocks = useGame((s) => s.world.rocks);
  // world.towers is mutated in place on placement (push), so subscribing to
  // the array reference wouldn't notify React. towerVersion bumps on every
  // place/sell — that's the trigger; the array is read via getState.
  const towerVersion = useGame((s) => s.ui.towerVersion);
  const towers = useGame.getState().world.towers;
  const style = BIOME_STYLE[biome];
  const specs = useMemo(() => BIOME_LAYERS[biome].filter((s) => !s.blocks), [biome]);

  // Decor placements are layered: each layer sees blockers (trees+rocks)
  // *and* the running list of previously-placed decor so cross-layer
  // overlap is impossible. Lava/forest/alien surfaces are also avoided
  // so we don't sprinkle grass into the river.
  const layers = useMemo(() => {
    const blockers = buildBlockers(trees, rocks);
    const decor: (Placement & { layerIndex: number })[] = [];
    const lava = hasFlowFeatures(biome) ? buildLavaFeatures(paths, levelId, biome) : null;
    return specs.map((spec, layerIndex) => ({
      spec,
      buckets: buildLayer(paths, spec, decor, blockers, lava, layerIndex).map((placements) => ({
        id: nanoid(),
        placements,
      })),
    }));
  }, [paths, specs, biome, levelId, trees, rocks]);

  // Cull any decor instance the player has built a tower on top of, so the
  // tower base sits on clean ground instead of poking through a mushroom
  // or grass tuft. Done at render-time so placement stays deterministic.
  // biome-ignore lint/correctness/useExhaustiveDependencies: towerVersion is the intended invalidation key
  const culledLayers = useMemo(() => {
    if (towers.length === 0) return layers;
    const towerR = TOWER_FOOTPRINT * 0.5;
    return layers.map(({ spec, buckets }) => ({
      spec,
      buckets: buckets.map(({ id, placements }) => ({
        id,
        placements: placements.filter((p) => {
          for (const t of towers) {
            const dx = t.pos.x - p.x;
            const dy = t.pos.y - p.y;
            const lim = towerR + p.r;
            if (dx * dx + dy * dy < lim * lim) return false;
          }
          return true;
        }),
      })),
    }));
  }, [layers, towers, towerVersion]);

  return (
    <group>
      {/* Oversized so the plane edge is always off-screen at any
          aspect/zoom — otherwise the scene background bleeds through
          past the playable 40×24 footprint. Decor (trees/rocks/grass)
          still places inside MAP_WIDTH × MAP_HEIGHT, so the skirt reads
          as flat outer ground; fog blends its far edges into the sky. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH * 6, MAP_HEIGHT * 8]} />
        <meshStandardMaterial color={style.groundColor} roughness={0.98} metalness={0} />
      </mesh>

      {culledLayers.flatMap(({ spec, buckets }) =>
        buckets.map(({ id, placements }, vi) => (
          <NatureInstances
            key={id}
            url={spec.urls[vi]}
            placements={placements}
            castShadow={spec.castShadow}
          />
        )),
      )}
    </group>
  );
};

for (const url of ALL_BIOME_URLS) useGLTF.preload(url);
