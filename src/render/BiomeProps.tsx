import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { LEVELS } from "../levels";
import { BIOME_LAYERS, BIOME_TREE_URLS, type Biome } from "../biomes";

// Deterministic PRNG so props stay put between renders
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

type PropInstance = {
  url: string;
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
};

type PropRoleBucket = {
  urls: string[];
  count: number;        // base count per level node
  minScale: number;
  maxScale: number;
  clearance: number;    // effective world-space radius for overlap check
};

// Curated hero props that make each biome feel lived-in. Scaled a bit larger
// than the small rock/bush layer and placed further from the node center.
const BIOME_LANDMARKS: Record<Biome, string[]> = {
  forest: [
    "/models/landmarks/forest/House.glb",
    "/models/landmarks/forest/Sawmill.glb",
    "/models/landmarks/forest/BushFlowers.glb",
    "/models/landmarks/forest/Mushroom.glb",
    "/models/landmarks/forest/Barrel.glb",
  ],
  desert: [
    "/models/landmarks/desert/DeadTree.glb",
    "/models/landmarks/desert/Chest.glb",
    "/models/landmarks/desert/Skull.glb",
    "/models/landmarks/desert/Tent.glb",
  ],
  snow: [
    "/models/landmarks/snow/Cabin.glb",
    "/models/landmarks/snow/Tent.glb",
    "/models/landmarks/snow/Torch.glb",
  ],
  wasteland: [
    "/models/landmarks/wasteland/Ruins.glb",
    "/models/landmarks/wasteland/Skull.glb",
    "/models/landmarks/wasteland/DeadTree.glb",
    "/models/landmarks/wasteland/Crystal1.glb",
    "/models/landmarks/wasteland/Crystal2.glb",
  ],
};

// Per-level-node cluster layout
const CLUSTER_R = 6.2;   // outer radius
const NODE_CLEAR = 2.0;  // inner hole so the clickable star stays visible
const MIN_GAP = 1.1;     // baseline minimum world-space gap between any two prop centers
const MAX_RETRIES = 12;  // rejection sampling attempts per slot

// Level node world positions — keep anything away from them so node stars
// aren't obscured even if nodes are closer than one cluster radius apart.
const NODE_POSITIONS: { x: number; z: number }[] = LEVELS.map(l => ({
  x: l.nodePos.x,
  z: -l.nodePos.y,
}));

const buildPropPlan = () => {
  const perUrl: Record<string, PropInstance[]> = {};
  // Running list of every placed prop for cross-cluster collision.
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

      // Guard: not too close to any level node.
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

      // Guard: not overlapping an existing prop.
      for (const p of placed) {
        const dx = x - p.x;
        const dz = z - p.z;
        const minDist = radius + p.r + MIN_GAP * 0.2;
        if (dx * dx + dz * dz < minDist * minDist) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      placed.push({ x, z, r: radius });
      const url = bucket.urls[Math.floor(rand() * bucket.urls.length)];
      return {
        url,
        pos: new THREE.Vector3(x, 0, z),
        rotY: rand() * Math.PI * 2,
        scale,
      };
    }
    return null;
  };

  for (const lvl of LEVELS) {
    const biome: Biome = (lvl.biome ?? "forest") as Biome;
    const rand = mulberry32(lvl.id * 9973 + 17);
    const center = { x: lvl.nodePos.x, z: -lvl.nodePos.y };

    // Build role buckets for this biome.
    // Layer props (small rocks/bushes): dense, compact.
    const smallBucket: PropRoleBucket = {
      urls: BIOME_LAYERS[biome].flatMap(l => l.urls),
      count: 10 + Math.floor(rand() * 4),
      minScale: 0.38,
      maxScale: 0.62,
      clearance: 0.55,
    };
    // Trees: taller, slightly wider radius.
    const treeBucket: PropRoleBucket = {
      urls: BIOME_TREE_URLS[biome],
      count: 4 + Math.floor(rand() * 3),
      minScale: 0.55,
      maxScale: 0.9,
      clearance: 0.85,
    };
    // Landmarks: hero props — fewer, bigger personal-space bubble.
    const landmarkBucket: PropRoleBucket = {
      urls: BIOME_LANDMARKS[biome],
      count: 1 + Math.floor(rand() * 2),
      minScale: 0.45,
      maxScale: 0.8,
      clearance: 1.4,
    };

    // Place in order: biggest first so small fill around them.
    for (const bucket of [landmarkBucket, treeBucket, smallBucket]) {
      for (let i = 0; i < bucket.count; i++) {
        const inst = tryPlace(center, bucket, rand);
        if (!inst) continue;
        (perUrl[inst.url] = perUrl[inst.url] ?? []).push(inst);
      }
    }
  }
  return perUrl;
};

const PropInstancer = ({ url, items }: { url: string; items: PropInstance[] }) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const { normalizedScale, centerOffset, minY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = 1.4 / maxDim;
    return {
      normalizedScale: s,
      centerOffset: new THREE.Vector3(center.x, center.y, center.z),
      minY: box.min.y,
    };
  }, [scene]);

  useEffect(() => {
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
  }, [scene]);

  return (
    <group ref={groupRef}>
      {items.map((it, i) => {
        const s = normalizedScale * it.scale;
        return (
          <primitive
            key={i}
            object={scene.clone(true)}
            position={[
              it.pos.x - centerOffset.x * s,
              -minY * s,
              it.pos.z - centerOffset.z * s,
            ]}
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

// Preload all URLs we might use — layers, trees, and biome-specific landmarks.
const allUrls = new Set<string>();
for (const lvl of LEVELS) {
  const biome: Biome = (lvl.biome ?? "forest") as Biome;
  for (const l of BIOME_LAYERS[biome]) for (const u of l.urls) allUrls.add(u);
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
  for (const u of BIOME_LANDMARKS[biome]) allUrls.add(u);
}
for (const u of allUrls) useGLTF.preload(u);
