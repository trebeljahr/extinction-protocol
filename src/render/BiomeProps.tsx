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

// Gather per-URL transform lists across all level nodes
const buildPropPlan = () => {
  // Radius around each level node within which props are scattered
  const CLUSTER_R = 5.5;
  // Min distance from the level node center so the clickable star stays clear
  const NODE_CLEAR = 1.8;
  const perUrl: Record<string, PropInstance[]> = {};

  for (const lvl of LEVELS) {
    const biome: Biome = (lvl.biome ?? "forest") as Biome;
    const layers = BIOME_LAYERS[biome];
    const treeUrls = BIOME_TREE_URLS[biome];
    const rand = mulberry32(lvl.id * 9973 + 17);

    // Mix layer props + trees
    const candidateUrls: string[] = [
      ...treeUrls,
      ...layers.flatMap(l => l.urls),
    ];

    // How many total props around this node
    const count = 12 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const url = candidateUrls[Math.floor(rand() * candidateUrls.length)];
      // Polar scatter with bias away from center
      const a = rand() * Math.PI * 2;
      const r = NODE_CLEAR + rand() * (CLUSTER_R - NODE_CLEAR);
      const x = lvl.nodePos.x + Math.cos(a) * r;
      const z = -(lvl.nodePos.y + Math.sin(a) * r); // sim.y -> world -z
      const rotY = rand() * Math.PI * 2;
      const scale = 0.35 + rand() * 0.35;
      (perUrl[url] = perUrl[url] ?? []).push({
        url,
        pos: new THREE.Vector3(x, 0, z),
        rotY,
        scale,
      });
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
    // Target size gives a mild world-scale baseline — per-item scale multiplies on top.
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

  // We append clones as children of a group for simplicity — the level count
  // is modest (a few hundred total) so this is fine without InstancedMesh.
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

// Best-effort preload so pop-in is minimal
const allUrls = new Set<string>();
for (const lvl of LEVELS) {
  const biome: Biome = (lvl.biome ?? "forest") as Biome;
  for (const l of BIOME_LAYERS[biome]) for (const u of l.urls) allUrls.add(u);
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
}
for (const u of allUrls) useGLTF.preload(u);
