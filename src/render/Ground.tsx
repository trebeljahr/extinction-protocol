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
import { gaussian, mulberry32 } from "../sim/random";
import type { Rock, Tree, Vec2 } from "../sim/types";
import { distPointToSegSq } from "../sim/vec2";
import { ROCK_FOOTPRINT, TOWER_FOOTPRINT, TREE_FOOTPRINT } from "../sim/world";
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

// Pick K cluster seed points well-clear of paths/blockers/lava so the
// gaussian halos around each anchor don't dump props into a path or
// river. Returns whatever seeds it could land — caller falls back to
// uniform random when none could be placed.
const pickClusterSeeds = (
  rng: () => number,
  paths: Vec2[][],
  blockers: { x: number; y: number; r: number }[],
  lava: LavaFeatures | null,
  clearance: number,
  count: number,
): Vec2[] => {
  const seeds: Vec2[] = [];
  const pathR2 = (clearance + 0.6) * (clearance + 0.6);
  const seedMinDistSq = 5.5 * 5.5;
  let tries = 0;
  while (seeds.length < count && tries < count * 70) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.85;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.85;
    if (isOnLavaSurface(lava, x, y, 1.0)) continue;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;
    for (const b of blockers) {
      const dx = b.x - x;
      const dy = b.y - y;
      const r = b.r + 1.0;
      if (dx * dx + dy * dy < r * r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    let tooClose = false;
    for (const s of seeds) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy < seedMinDistSq) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    seeds.push({ x, y });
  }
  return seeds;
};

// Build placements for one non-blocking layer. Also takes the running
// "all-decor" placement list and a blockers list (trees + rocks) so each
// new placement can spacing-check against everything already placed.
// Margin between placements is `(footprint*scale)+(other.footprint*other.scale)+SLACK`.
const PROP_SPACING_SLACK = 0.15;

const buildLayer = (
  paths: Vec2[][],
  spec: BiomeLayer,
  decor: (Placement & { layerIndex: number })[],
  blockers: { x: number; y: number; r: number }[],
  lava: LavaFeatures | null,
  layerIndex: number,
): Placement[][] => {
  const rng = mulberry32(spec.seed);
  const buckets: Placement[][] = spec.urls.map(() => []);
  const footprint = layerFootprint(spec);
  const halfW = MAP_WIDTH * 0.475;
  const halfH = MAP_HEIGHT * 0.475;

  // Prepare cluster anchors when the layer asks for them. Falls back to
  // uniform sampling if the seed-finder couldn't place any (e.g. very
  // dense paths).
  const clusterCfg = spec.cluster;
  const seeds = clusterCfg
    ? pickClusterSeeds(rng, paths, blockers, lava, spec.clearance, clusterCfg.seeds)
    : [];
  const useClusters = clusterCfg !== undefined && seeds.length > 0;

  let tries = 0;
  let placed = 0;
  const maxTries = spec.count * 60;
  while (placed < spec.count && tries < maxTries) {
    tries++;
    let x: number;
    let y: number;
    if (useClusters && clusterCfg) {
      const seed = seeds[Math.floor(rng() * seeds.length)];
      x = Math.max(-halfW, Math.min(halfW, seed.x + gaussian(rng, clusterCfg.sigma)));
      y = Math.max(-halfH, Math.min(halfH, seed.y + gaussian(rng, clusterCfg.sigma)));
    } else {
      x = (rng() - 0.5) * MAP_WIDTH;
      y = (rng() - 0.5) * MAP_HEIGHT;
    }

    if (nearAnyPath(paths, x, y, spec.clearance)) continue;
    if (isOnLavaSurface(lava, x, y, footprint * spec.maxScale + 0.2)) continue;

    const scale = spec.minScale + rng() * (spec.maxScale - spec.minScale);
    const r = footprint * scale;

    let blocked = false;
    for (const b of blockers) {
      const dx = b.x - x;
      const dy = b.y - y;
      const min = r + b.r + PROP_SPACING_SLACK;
      if (dx * dx + dy * dy < min * min) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const d of decor) {
      const dx = d.x - x;
      const dy = d.y - y;
      const min = r + d.r + PROP_SPACING_SLACK;
      if (dx * dx + dy * dy < min * min) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const variant = Math.floor(rng() * spec.urls.length);
    const placement: Placement = { x, y, scale, rot: rng() * Math.PI * 2, r };
    buckets[variant].push(placement);
    decor.push({ ...placement, layerIndex });
    placed++;
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
  const towers = useGame((s) => s.world.towers);
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
  }, [layers, towers]);

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
