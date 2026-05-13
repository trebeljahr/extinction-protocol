import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { BIOME_COSMETICS, type Biome, classifyPropUrl, TARGET_SIZE_BY_ROLE } from "../biomes";
import {
  buildLavaFeatures,
  hasFlowFeatures,
  isOnLavaSurface,
  type LavaFeatures,
} from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import { poissonDiskSample } from "../sim/poisson";
import { mulberry32 } from "../sim/random";
import type { Vec2 } from "../sim/types";
import { distPointToSegSq } from "../sim/vec2";
import { TOWER_FOOTPRINT } from "../sim/world";
import { createWorleyField } from "../sim/worley";
import { useGame } from "../store";
import { InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Render-only decorative cosmetics scattered across the playable level.
// Deterministic per-level via PRNG seeded on levelId. These don't live in
// world state — they're pure flavor and never block placement or get
// clicked.

// Pre-tuned for the cluster algorithm below: a few small pockets read as
// authored detail without competing with the clearable trees/rocks.
const COUNT_PER_LEVEL = 8;
const CLUSTER_SEEDS = 3;
// Worley feature radius — how far each cluster centre's influence reaches.
// Larger = looser groves; smaller = tighter pockets.
const CLUSTER_RADIUS = 2.4;
// PATH_WIDTH widened to 2.8, so anything at half-width + 0.5 was clipping
// the visible edge. 1.2 beyond the edge gives cosmetics room to breathe.
const PATH_CLEARANCE = PATH_WIDTH / 2 + 1.2;
const PROP_MIN_SPACING = 1.6;
const PROP_MAX_SPACING = 3.0;

type Instance = { url: string; pos: Vec2; scale: number; rotY: number };

const buildInstances = (
  biome: Biome,
  paths: Vec2[][],
  levelId: number,
  blockers: { pos: Vec2; radius: number }[],
  lava: LavaFeatures | null,
): Instance[] => {
  const urls = BIOME_COSMETICS[biome];
  if (urls.length === 0) return [];
  // Soft bounds so cluster halos don't poke past the visible playfield.
  const halfW = MAP_WIDTH * 0.47;
  const halfH = MAP_HEIGHT * 0.47;
  const bounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };
  const pathR2 = PATH_CLEARANCE * PATH_CLEARANCE;

  // Worley field — each feature is a "grove centre" with a preferred
  // URL, picked at construction so each grove reads as "a patch of X".
  const worley = createWorleyField(levelId * 6271 + 13, bounds, CLUSTER_SEEDS, CLUSTER_RADIUS);
  const urlRng = mulberry32(levelId * 4093 + 71);
  const featureUrls = worley.features.map(() => urls[Math.floor(urlRng() * urls.length)]);

  const radiusAt = (x: number, y: number): number => {
    const d = worley.density(x, y);
    return PROP_MIN_SPACING + (1 - d) * (PROP_MAX_SPACING - PROP_MIN_SPACING);
  };

  const isValid = (x: number, y: number): boolean => {
    if (isOnLavaSurface(lava, x, y, 0.5)) return false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          return false;
        }
      }
    }
    for (const b of blockers) {
      const dx = b.pos.x - x;
      const dy = b.pos.y - y;
      const minDist = b.radius + 0.75;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }
    return true;
  };

  const points = poissonDiskSample({
    bounds,
    radiusAt,
    isValid,
    maxCount: COUNT_PER_LEVEL,
    seed: levelId * 8147 + 211,
    // Seed Bridson with each grove centre so the algorithm visits
    // every feature instead of packing all COUNT_PER_LEVEL cosmetics
    // around the first feature it walks into.
    initialPoints: worley.features,
  });

  // Per-instance URL bias: pick the nearest feature, then 70% chance to
  // use its preferred URL. Reads as "this is a grove of X" without
  // monotony.
  const detailRng = mulberry32(levelId * 3119 + 29);
  const out: Instance[] = [];
  for (const p of points) {
    let nearestI = 0;
    let nearestD2 = Infinity;
    for (let i = 0; i < worley.features.length; i++) {
      const f = worley.features[i];
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestD2) {
        nearestD2 = d2;
        nearestI = i;
      }
    }
    const url =
      detailRng() < 0.7 ? featureUrls[nearestI] : urls[Math.floor(detailRng() * urls.length)];
    out.push({
      url,
      pos: { x: p.x, y: p.y },
      scale: 0.7 + ((detailRng() + detailRng()) / 2) * 0.7,
      rotY: detailRng() * Math.PI * 2,
    });
  }
  return out;
};

// Cosmetic URLs come from packs with wildly varying authored max-dims;
// normalize to TARGET_SIZE_BY_ROLE so a BushFlowers patch reads the
// same size whether the source GLB is 1.97 or 0.5 units tall.
const computeBaseScale = (source: MeshSource, url: string): number =>
  TARGET_SIZE_BY_ROLE[classifyPropUrl(url)] / source.maxDim;

export const BiomeCosmetics = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);
  const trees = useGame((s) => s.world.trees);
  const rocks = useGame((s) => s.world.rocks);
  // world.towers is mutated in place on placement (push), so subscribing to
  // the array reference wouldn't notify React. towerVersion bumps on every
  // place/sell — that's the trigger; the array is read via getState.
  const towerVersion = useGame((s) => s.ui.towerVersion);
  const towers = useGame.getState().world.towers;

  const groups = useMemo(() => {
    // Block cosmetics from spawning on top of trees/rocks that already exist.
    const blockers: { pos: Vec2; radius: number }[] = [
      ...trees.map((t) => ({ pos: t.pos, radius: 0.9 * t.scale })),
      ...rocks.map((r) => ({ pos: r.pos, radius: 0.7 * r.scale })),
    ];
    const lava = hasFlowFeatures(biome) ? buildLavaFeatures(paths, levelId, biome) : null;
    const instances = buildInstances(biome, paths, levelId, blockers, lava);
    const byUrl = new Map<string, Instance[]>();
    for (const inst of instances) {
      const list = byUrl.get(inst.url) ?? [];
      list.push(inst);
      byUrl.set(inst.url, list);
    }
    return Array.from(byUrl.entries());
  }, [biome, paths, levelId, trees, rocks]);

  // Cull cosmetics that overlap a tower so the base sits on clean ground.
  // Filtered at render-time to keep placement stable as towers come/go.
  // biome-ignore lint/correctness/useExhaustiveDependencies: towerVersion is the intended invalidation key
  const culledGroups = useMemo(() => {
    if (towers.length === 0) return groups;
    const towerR = TOWER_FOOTPRINT * 0.5;
    const cosmeticR = 0.3;
    const lim = towerR + cosmeticR;
    const limSq = lim * lim;
    return groups.map(([url, items]): [string, Instance[]] => {
      const filtered = items.filter((it) => {
        for (const t of towers) {
          const dx = t.pos.x - it.pos.x;
          const dy = t.pos.y - it.pos.y;
          if (dx * dx + dy * dy < limSq) return false;
        }
        return true;
      });
      return [url, filtered];
    });
  }, [groups, towers, towerVersion]);

  return (
    <group>
      {culledGroups.map(([url, items]) => (
        <InstancedGroup key={url} url={url} items={items} baseScaleFor={computeBaseScale} />
      ))}
    </group>
  );
};

// Preload every cosmetic URL so switching biomes mid-session doesn't stall.
for (const urls of Object.values(BIOME_COSMETICS)) {
  for (const url of urls) useGLTF.preload(url);
}
