import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import { useGame } from "../store";
import { TREE_REMOVE_COST, TREE_VARIANTS } from "../sim/world";
import type { Tree } from "../sim/types";

const TREE_URLS = [
  "/models/nature/Tree1.glb",
  "/models/nature/Tree2.glb",
  "/models/nature/Tree3.glb",
  "/models/nature/Tree4.glb",
];

type VariantSource = { geom: THREE.BufferGeometry; material: THREE.Material; minY: number };

const useVariantSources = (): (VariantSource | null)[] => {
  const trees = TREE_URLS.map(url => useGLTF(url));
  return useMemo(
    () =>
      trees.map(({ scene }) => {
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
      }),
    [trees.map(t => t.scene).join("|")],
  );
};

export const Trees = () => {
  const treeVersion = useGame(s => s.ui.treeVersion);
  void treeVersion;
  const trees = useGame.getState().world.trees;
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);
  const sources = useVariantSources();
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

      {hovered && (
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
  const instRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const im = instRef.current;
    if (!im) return;
    const dummy = new THREE.Object3D();
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
  }, [bucket, source]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    const tree = bucket[e.instanceId];
    if (!tree) return;
    e.stopPropagation();
    useGame.getState().removeTree(tree.id);
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
    <instancedMesh
      ref={instRef}
      args={[source.geom, source.material, Math.max(1, bucket.length)]}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerMove={onMove}
      onPointerOut={onOut}
    />
  );
};

for (const url of TREE_URLS) useGLTF.preload(url);
