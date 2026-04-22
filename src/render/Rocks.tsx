import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { Rock } from "../sim/types";
import { useGame } from "../store";
import { BIOME_LAYERS } from "../biomes";

const RockGroup = ({ url, rocks }: { url: string; rocks: Rock[] }) => {
  const { scene } = useGLTF(url);
  const instRef = useRef<THREE.InstancedMesh>(null);

  const source = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    scene.traverse(o => {
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
  }, [rocks, source]);

  if (!source || rocks.length === 0) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[source.geom, source.material, rocks.length]}
      castShadow
      receiveShadow
    />
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
