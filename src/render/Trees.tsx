import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import { useGame } from "../store";
import { TREE_REMOVE_COST, TREE_VARIANTS } from "../sim/world";
import type { Tree } from "../sim/types";
import { BIOME_TREE_URLS } from "../biomes";

type Part = { geom: THREE.BufferGeometry; material: THREE.Material };
type VariantSource = { parts: Part[]; minY: number };

// Multi-primitive glTF meshes (e.g. a tree with separate Wood/Green/Snow
// primitives) come in from GLTFLoader as multiple Meshes under the scene.
// We collect every one of them so each instance renders all pieces, not
// just the first primitive.
const useVariantSources = (urls: string[]): (VariantSource | null)[] => {
  const a = useGLTF(urls[0]);
  const b = useGLTF(urls[1]);
  const c = useGLTF(urls[2]);
  const d = useGLTF(urls[3]);
  const scenes = [a.scene, b.scene, c.scene, d.scene];
  return useMemo(
    () =>
      scenes.map(scene => {
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
      }),
    scenes,
  );
};

export const Trees = () => {
  const treeVersion = useGame(s => s.ui.treeVersion);
  void treeVersion;
  const trees = useGame.getState().world.trees;
  const biome = useGame(s => s.world.biome);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);
  const selectedTreeId = useGame(s => s.selectedTreeId);
  const sources = useVariantSources(BIOME_TREE_URLS[biome]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const byVariant = useMemo(() => {
    const buckets: Tree[][] = Array.from({ length: TREE_VARIANTS }, () => []);
    for (const t of trees) buckets[t.variant]?.push(t);
    return buckets;
  }, [trees, treeVersion]);

  useEffect(() => {
    if (hoveredId !== null && !trees.some(t => t.id === hoveredId)) setHoveredId(null);
  }, [trees, hoveredId]);

  const canAfford = gold >= TREE_REMOVE_COST;
  const running = status === "running";
  const hovered = hoveredId !== null ? trees.find(t => t.id === hoveredId) ?? null : null;
  const selected = selectedTreeId !== null ? trees.find(t => t.id === selectedTreeId) ?? null : null;

  useEffect(() => {
    if (hovered && running) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "pointer";
      return () => { document.body.style.cursor = prev; };
    }
  }, [hovered, running]);

  return (
    <group>
      {byVariant.map((bucket, vi) => {
        const src = sources[vi];
        if (!src || bucket.length === 0) return null;
        return (
          <VariantGroup
            key={vi}
            bucket={bucket}
            source={src}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
          />
        );
      })}

      {hovered && hovered.id !== selectedTreeId && (
        <group position={[hovered.pos.x, 0.02, -hovered.pos.y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.78, 32]} />
            <meshBasicMaterial
              color={canAfford ? "#ff8a5a" : "#6a6a6a"}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
      {selected && (
        <group position={[selected.pos.x, 0.03, -selected.pos.y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.62, 0.9, 40]} />
            <meshBasicMaterial
              color="#ffd66a"
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

const VariantGroup = ({
  bucket,
  source,
  hoveredId,
  setHoveredId,
}: {
  bucket: Tree[];
  source: VariantSource;
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
}) => {
  // One InstancedMesh per primitive part, all driven by the same transforms.
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    for (const im of partRefs.current) {
      if (!im) continue;
      for (let i = 0; i < bucket.length; i++) {
        const t = bucket[i];
        dummy.position.set(t.pos.x, -source.minY * t.scale, -t.pos.y);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = bucket.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [bucket, source]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    const tree = bucket[e.instanceId];
    if (!tree) return;
    e.stopPropagation();
    useGame.getState().selectTree(tree.id);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId == null) return;
    const tree = bucket[e.instanceId];
    if (!tree) return;
    if (hoveredId !== tree.id) setHoveredId(tree.id);
  };

  const onOut = () => {
    if (hoveredId !== null && bucket.some(t => t.id === hoveredId)) setHoveredId(null);
  };

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          key={pi}
          ref={(el: THREE.InstancedMesh | null) => { partRefs.current[pi] = el; }}
          args={[part.geom, part.material, Math.max(1, bucket.length)]}
          castShadow
          receiveShadow
          // Only attach pointer events to the first part — otherwise we
          // fire double events and instanceId collides across parts.
          onClick={pi === 0 ? onClick : undefined}
          onPointerMove={pi === 0 ? onMove : undefined}
          onPointerOut={pi === 0 ? onOut : undefined}
        />
      ))}
    </group>
  );
};

for (const urls of Object.values(BIOME_TREE_URLS)) {
  for (const url of urls) useGLTF.preload(url);
}
