import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BIOME_LAYERS,
  BIOME_TREE_URLS,
  type Biome,
  biomeForPos,
  classifyPropUrl,
  TARGET_SIZE_BY_ROLE,
} from "../biomes";
import { LEVELS } from "../levels";
import { mulberry32 } from "../sim/random";

// World-map decoration. Keep it SPARSE so each level cluster reads as a
// recognizable little vignette rather than a noisy pile. Detailed
// cosmetics (skulls, crystals, mushrooms, barrels…) live only inside
// playable levels — see BiomeCosmetics. Here we stick to buildings +
// trees + a few rocks.

type PropInstance = {
  id: string;
  url: string;
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
};

type PropRoleBucket = {
  urls: string[];
  count: number;
  minScale: number;
  maxScale: number;
  clearance: number;
};

// Hero building per biome. Each URL appears once per weight-slot: repeating
// a URL makes it more likely when the random picker chooses one of the
// `urls[]` entries, so the rare sci-fi landmark appears ~1-in-4 desert nodes
// (one crashed craft across the full map in expectation) while Tent remains
// the common read. Wasteland has no building — Ruins read as "half platforms"
// and didn't fit, so that biome is just trees + rocks at the cluster level.
// Non-nature biomes prefer sci-fi tech (hangars, structures, rockets) over
// wooden cabins/sawmills; tents stay — they read as modern camp gear, not wood.
const BIOME_LANDMARKS: Record<Biome, string[]> = {
  forest: ["/models/landmarks/forest/House.glb", "/models/scifi/structure_detailed.glb"],
  desert: [
    "/models/landmarks/desert/Tent.glb",
    "/models/landmarks/desert/Tent.glb",
    "/models/landmarks/desert/Tent.glb",
    "/models/scifi/rocket_baseA.glb", // sparingly — reads as a crashed rocket
  ],
  snow: ["/models/scifi/hangar_smallA.glb", "/models/landmarks/snow/Tent.glb"],
  wasteland: [],
  // Lava and alien biomes lean on sci-fi hero props — the skull plains of
  // a dying planet and the crystal spires of an alien world both read as
  // post-human frontiers, not rustic camps.
  lava: ["/models/scifi/structure_detailed.glb", "/models/scifi/rocket_baseA.glb"],
  alien: ["/models/scifi/hangar_smallB.glb", "/models/scifi/structure_closed.glb"],
};

// Pick rocks only out of each biome's layer list — no bushes/grass on
// the world map, they just add noise at this zoom level.
const rockUrls = (biome: Biome): string[] =>
  BIOME_LAYERS[biome]
    .flatMap((l) => l.urls)
    .filter((u) => /rock/i.test(u) || /crystal_(?:large|medium)/i.test(u));

// Per-level cluster geometry.
// Nodes need a generous ring of empty ground around them — a hangar's
// footprint is ~3 units wide and sitting 2.4u from the node center put
// its silhouette basically touching the bubble. Bumped the inner hole to
// 4.0 and pushed the outer ring out so props still have room to land.
const CLUSTER_R = 7.5; // outer radius — bumped slightly so retries have more landing area
const NODE_CLEAR = 4.0; // inner hole — keep hero props off the node
// Center-to-center spacing slack between props on top of summed radii.
// Was applied as `MIN_GAP * 0.25` (≈0.3u), which let trees and rocks
// silhouettes nearly touch on the world map. The full 1.2u slack reads
// as deliberately spaced.
const MIN_GAP = 1.2;
// Was 14 — too low when the disc is 90% full after the landmark drops.
// 28 retries gives the rock placements a real chance to land cleanly.
const MAX_RETRIES = 28;

const NODE_POSITIONS: { x: number; z: number }[] = LEVELS.map((l) => ({
  x: l.nodePos.x,
  z: -l.nodePos.y,
}));

const buildPropPlan = () => {
  const perUrl: Record<string, PropInstance[]> = {};
  const placed: { x: number; z: number; r: number }[] = [];

  const tryPlace = (
    center: { x: number; z: number },
    bucket: PropRoleBucket,
    rand: () => number,
  ): PropInstance | null => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const a = rand() * Math.PI * 2;
      const r = NODE_CLEAR + rand() * (CLUSTER_R - NODE_CLEAR);
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      const scale = bucket.minScale + rand() * (bucket.maxScale - bucket.minScale);
      const radius = bucket.clearance * scale;

      let bad = false;
      for (const n of NODE_POSITIONS) {
        const dx = x - n.x;
        const dz = z - n.z;
        if (dx * dx + dz * dz < NODE_CLEAR * NODE_CLEAR) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      for (const p of placed) {
        const dx = x - p.x;
        const dz = z - p.z;
        const minDist = radius + p.r + MIN_GAP;
        if (dx * dx + dz * dz < minDist * minDist) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      placed.push({ x, z, r: radius });
      const url = bucket.urls[Math.floor(rand() * bucket.urls.length)];
      return {
        id: nanoid(),
        url,
        pos: new THREE.Vector3(x, 0, z),
        rotY: rand() * Math.PI * 2,
        scale,
      };
    }
    return null;
  };

  for (const lvl of LEVELS) {
    const biome: Biome = biomeForPos(lvl.nodePos);
    const rand = mulberry32(lvl.id * 9973 + 17);
    const center = { x: lvl.nodePos.x, z: -lvl.nodePos.y };

    // Scale ranges are kept tight (0.95–1.1) so props within a role look
    // like siblings rather than random sizes — the *role* provides the
    // variation between classes.
    const landmarkBucket: PropRoleBucket = {
      urls: BIOME_LANDMARKS[biome] ?? [],
      count: 1,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 1.9,
    };
    const treeBucket: PropRoleBucket = {
      urls: BIOME_TREE_URLS[biome],
      count: 2,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 1.2,
    };
    const rockBucket: PropRoleBucket = {
      urls: rockUrls(biome),
      count: 2,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 0.6,
    };

    for (const bucket of [landmarkBucket, treeBucket, rockBucket]) {
      if (bucket.urls.length === 0) continue;
      for (let i = 0; i < bucket.count; i++) {
        const inst = tryPlace(center, bucket, rand);
        if (!inst) continue;
        const existing = perUrl[inst.url] ?? [];
        existing.push(inst);
        perUrl[inst.url] = existing;
      }
    }
  }
  return perUrl;
};

const noRaycast: THREE.Mesh["raycast"] = () => {};

const PropInstancer = ({ url, items }: { url: string; items: PropInstance[] }) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const { normalizedScale, centerOffset, minY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const target = TARGET_SIZE_BY_ROLE[classifyPropUrl(url)];
    const s = target / maxDim;
    return {
      normalizedScale: s,
      centerOffset: new THREE.Vector3(center.x, center.y, center.z),
      minY: box.min.y,
    };
  }, [scene, url]);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Decorative — never block clicks/hovers on the level node it
      // surrounds.
      m.raycast = noRaycast;
    });
  }, [scene]);

  return (
    <group ref={groupRef}>
      {items.map((it) => {
        const s = normalizedScale * it.scale;
        return (
          <primitive
            key={it.id}
            object={scene.clone(true)}
            position={[it.pos.x - centerOffset.x * s, -minY * s, it.pos.z - centerOffset.z * s]}
            rotation={[0, it.rotY, 0]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

export const BiomeProps = () => {
  const plan = useMemo(() => buildPropPlan(), []);
  const entries = useMemo(() => Object.entries(plan), [plan]);

  return (
    <>
      {entries.map(([url, items]) => (
        <PropInstancer key={url} url={url} items={items} />
      ))}
    </>
  );
};

// Preload URLs actually used by the world map.
const allUrls = new Set<string>();
for (const lvl of LEVELS) {
  const biome: Biome = biomeForPos(lvl.nodePos);
  for (const u of rockUrls(biome)) allUrls.add(u);
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
  for (const u of BIOME_LANDMARKS[biome] ?? []) allUrls.add(u);
}
for (const u of allUrls) useGLTF.preload(u);
