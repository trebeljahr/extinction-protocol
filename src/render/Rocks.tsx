import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { Rock } from "../sim/types";
import { useGame } from "../store";
import { BIOME_LAYERS } from "../biomes";

type Part = { geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number };

// Collect every primitive under the scene — many Quaternius rocks/bushes
// are authored as a single mesh with 2+ primitives (body + Snow cap),
// which GLTFLoader flattens into multiple Three.Meshes under the scene.
const collectParts = (scene: THREE.Object3D): Source | null => {
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  let minY = Infinity;
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach(mat => {
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      geom.computeBoundingBox();
      if (geom.boundingBox) minY = Math.min(minY, geom.boundingBox.min.y);
      parts.push({ geom, material: mat as THREE.Material });
    });
  });
  if (parts.length === 0) return null;
  return { parts, minY: isFinite(minY) ? minY : 0 };
};

const RockGroup = ({ url, rocks }: { url: string; rocks: Rock[] }) => {
  const { scene } = useGLTF(url);
  const source = useMemo(() => collectParts(scene), [scene]);
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    if (!source) return;
    const dummy = new THREE.Object3D();
    for (const im of partRefs.current) {
      if (!im) continue;
      for (let i = 0; i < rocks.length; i++) {
        const r = rocks[i];
        dummy.position.set(r.pos.x, -source.minY * r.scale, -r.pos.y);
        dummy.rotation.set(0, r.rot, 0);
        dummy.scale.setScalar(r.scale);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = rocks.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [rocks, source]);

  if (!source || rocks.length === 0) return null;

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          key={pi}
          ref={(el: THREE.InstancedMesh | null) => { partRefs.current[pi] = el; }}
          args={[part.geom, part.material, rocks.length]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
};

export const Rocks = () => {
  const biome = useGame(s => s.world.biome);
  const rocks = useGame(s => s.world.rocks);

  const buckets = useMemo(() => {
    const layers = BIOME_LAYERS[biome];
    const out = new Map<string, Rock[]>();
    for (const r of rocks) {
      const spec = layers[r.layerIndex];
      if (!spec) continue;
      const url = spec.urls[r.variant];
      if (!url) continue;
      const list = out.get(url) ?? [];
      list.push(r);
      out.set(url, list);
    }
    return Array.from(out.entries());
  }, [biome, rocks]);

  return (
    <group>
      {buckets.map(([url, group]) => (
        <RockGroup key={url} url={url} rocks={group} />
      ))}
    </group>
  );
};
