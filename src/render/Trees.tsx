import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BIOME_TREE_URLS } from "../biomes";
import type { Tree } from "../sim/types";
import { meshXZRadii, TREE_REMOVE_COST, TREE_VARIANTS } from "../sim/world";
import { useGame } from "../store";
import { collectMeshSource, type MeshPart } from "./meshSource";

type VariantSource = {
  id: string;
  parts: MeshPart[];
  minY: number;
  xzRadius: number;
  // Trunk/base radius: tighter than xzRadius so the click ring hugs the
  // stem instead of tracing the foliage canopy. Computed from the bottom
  // 10% of the model's height.
  baseXzRadius: number;
};

const computeBaseXzRadius = (parts: MeshPart[], minY: number, height: number): number => {
  const sliceTop = minY + height * 0.1;
  let baseXzMax = 0;
  for (const part of parts) {
    const pos = part.geom.getAttribute("position");
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > sliceTop) continue;
      baseXzMax = Math.max(baseXzMax, Math.abs(pos.getX(i)), Math.abs(pos.getZ(i)));
    }
  }
  return baseXzMax;
};

// Multi-primitive glTF meshes (e.g. a tree with separate Wood/Green/Snow
// primitives) come in from GLTFLoader as multiple Meshes under the scene.
// collectMeshSource collects every one so each instance renders all pieces,
// not just the first primitive.
const useVariantSources = (urls: string[]): (VariantSource | null)[] => {
  const a = useGLTF(urls[0]);
  const b = useGLTF(urls[1]);
  const c = useGLTF(urls[2]);
  const d = useGLTF(urls[3]);
  const scenes = [a.scene, b.scene, c.scene, d.scene];
  // scenes change only when the four URLs change — spreading them as deps
  // keeps the memo stable even though eslint/biome can't statically verify
  // the identity of each scene reference.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scenes array is derived from useGLTF hooks above, references change only with urls
  return useMemo(
    () =>
      scenes.map((scene, si) => {
        const source = collectMeshSource(scene);
        if (!source) return null;
        const xzRadius = source.xzRadius || 0.9;
        const baseRaw = computeBaseXzRadius(source.parts, source.minY, source.height);
        const baseXzRadius = baseRaw || xzRadius * 0.2;
        meshXZRadii.set(urls[si], xzRadius);
        return { id: nanoid(), parts: source.parts, minY: source.minY, xzRadius, baseXzRadius };
      }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: auto-suppressed during biome 2.x bump; revisit per-case
    scenes,
  );
};

export const Trees = () => {
  const treeVersion = useGame((s) => s.ui.treeVersion);
  void treeVersion;
  const trees = useGame.getState().world.trees;
  const biome = useGame((s) => s.world.biome);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);
  const selectedTreeId = useGame((s) => s.selectedTreeId);
  const sources = useVariantSources(BIOME_TREE_URLS[biome]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // treeVersion is the deliberate trigger — `trees` is read via getState
  // and wouldn't otherwise notify React; version-bump is what re-runs the memo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: treeVersion is the intended invalidation key
  const byVariant = useMemo(() => {
    const buckets: Tree[][] = Array.from({ length: TREE_VARIANTS }, () => []);
    for (const t of trees) buckets[t.variant]?.push(t);
    return buckets;
  }, [trees, treeVersion]);

  useEffect(() => {
    if (hoveredId !== null && !trees.some((t) => t.id === hoveredId)) setHoveredId(null);
  }, [trees, hoveredId]);

  const canAfford = gold >= TREE_REMOVE_COST;
  const running = status === "running";
  const hovered = hoveredId !== null ? (trees.find((t) => t.id === hoveredId) ?? null) : null;
  const selected =
    selectedTreeId !== null ? (trees.find((t) => t.id === selectedTreeId) ?? null) : null;

  useEffect(() => {
    if (hovered && running) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = prev;
      };
    }
  }, [hovered, running]);

  return (
    <group>
      {byVariant.map((bucket, vi) => {
        const src = sources[vi];
        if (!src || bucket.length === 0) return null;
        return <VariantGroup key={src.id} bucket={bucket} source={src} />;
      })}

      <TreeHitTargets
        trees={trees}
        sources={sources}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      />

      {hovered &&
        hovered.id !== selectedTreeId &&
        (() => {
          // Floor so very small trunks still get a visible ring instead of
          // an invisible sliver around a thin stem.
          const r = Math.max(0.22, (sources[hovered.variant]?.baseXzRadius ?? 0.2) * hovered.scale);
          return (
            <group position={[hovered.pos.x, 0.02, -hovered.pos.y]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
                <ringGeometry args={[r - 0.05, r + 0.08, 32]} />
                <meshBasicMaterial
                  color={canAfford ? "#ff8a5a" : "#6a6a6a"}
                  transparent
                  opacity={0.9}
                  side={THREE.DoubleSide}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })()}
      {selected &&
        (() => {
          const r = Math.max(
            0.22,
            (sources[selected.variant]?.baseXzRadius ?? 0.2) * selected.scale,
          );
          return (
            <group position={[selected.pos.x, 0.03, -selected.pos.y]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
                <ringGeometry args={[r - 0.05, r + 0.12, 40]} />
                <meshBasicMaterial
                  color="#ffd66a"
                  transparent
                  opacity={0.95}
                  side={THREE.DoubleSide}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })()}
    </group>
  );
};

const VariantGroup = ({ bucket, source }: { bucket: Tree[]; source: VariantSource }) => {
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

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          // biome-ignore lint/suspicious/noArrayIndexKey: parts array is stable per scene
          key={pi}
          ref={(el: THREE.InstancedMesh | null) => {
            partRefs.current[pi] = el;
          }}
          args={[part.geom, part.material, Math.max(1, bucket.length)]}
          castShadow
          receiveShadow
          raycast={neverRaycast}
        />
      ))}
    </group>
  );
};

// Pointer events go to the hit discs, not the model silhouette.
const neverRaycast: THREE.Mesh["raycast"] = () => {};

const TreeHitTargets = ({
  trees,
  sources,
  hoveredId,
  setHoveredId,
}: {
  trees: Tree[];
  sources: (VariantSource | null)[];
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
}) => {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  const geom = useMemo(() => new THREE.CircleGeometry(1, 24), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      geom.dispose();
      material.dispose();
    },
    [geom, material],
  );

  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const baseR = sources[t.variant]?.baseXzRadius ?? 0.2;
      const bboxR = sources[t.variant]?.xzRadius ?? 0.9;
      const r = Math.min(bboxR, baseR * 3) * t.scale;
      dummy.position.set(t.pos.x, 0.015, -t.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.count = trees.length;
    im.instanceMatrix.needsUpdate = true;
  }, [trees, sources]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    const tree = trees[e.instanceId];
    if (!tree) return;
    e.stopPropagation();
    useGame.getState().selectTree(tree.id);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId == null) return;
    const tree = trees[e.instanceId];
    if (!tree) return;
    // Consume so the rock hit-disc (same y-level) doesn't also fire
    // its onPointerMove and double-highlight at the overlap. R3F
    // dispatches closest-first, so the front tree wins.
    e.stopPropagation();
    if (hoveredId !== tree.id) setHoveredId(tree.id);
  };

  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (hoveredId !== null && trees.some((t) => t.id === hoveredId)) setHoveredId(null);
  };

  if (trees.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geom, material, trees.length]}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerOut={onOut}
    />
  );
};

for (const urls of Object.values(BIOME_TREE_URLS)) {
  for (const url of urls) useGLTF.preload(url);
}
