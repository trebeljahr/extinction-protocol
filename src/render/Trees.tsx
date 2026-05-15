import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BIOME_TREE_URLS } from "../biomes";
import type { Tree } from "../sim/types";
import { meshXZRadii, TREE_REMOVE_COST, TREE_VARIANTS } from "../sim/world";
import { useGame } from "../store";
import { collectMeshSource, type MeshPart } from "./meshSource";

type VariantSource = {
  parts: MeshPart[];
  minY: number;
  xzRadius: number;
  // Trunk radius from the very bottom slice: keeps single-trunk trees from
  // feeling grabby when their canopy spreads far beyond the stem.
  trunkXzRadius: number;
  // Root-footprint radius from a wider lower slice: catches multi-trunk
  // alien trees whose actual blocked footprint is much wider than one stem.
  footprintXzRadius: number;
};

const computeSliceXzRadius = (
  parts: MeshPart[],
  minY: number,
  height: number,
  sliceHeightFrac: number,
): number => {
  const sliceTop = minY + height * sliceHeightFrac;
  let xzMax = 0;
  for (const part of parts) {
    const pos = part.geom.getAttribute("position");
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > sliceTop) continue;
      xzMax = Math.max(xzMax, Math.abs(pos.getX(i)), Math.abs(pos.getZ(i)));
    }
  }
  return xzMax;
};

const buildVariantSource = (scene: THREE.Object3D): VariantSource | null => {
  const source = collectMeshSource(scene);
  if (!source) return null;
  const xzRadius = source.xzRadius || 0.9;
  const trunkRaw = computeSliceXzRadius(source.parts, source.minY, source.height, 0.06);
  const footprintRaw = computeSliceXzRadius(source.parts, source.minY, source.height, 0.22);
  const trunkXzRadius = trunkRaw || xzRadius * 0.16;
  const footprintXzRadius = footprintRaw || trunkXzRadius;
  return { parts: source.parts, minY: source.minY, xzRadius, trunkXzRadius, footprintXzRadius };
};

const treeSelectionRadius = (source: VariantSource | null, scale: number): number => {
  if (!source) return 0.22;
  const trunk = source.trunkXzRadius || source.xzRadius * 0.18;
  const footprint = Math.max(trunk, source.footprintXzRadius || 0);
  const radius = Math.min(source.xzRadius, Math.max(footprint, trunk * 3));
  return Math.max(0.22, radius * scale);
};

const useVariantSources = (urls: string[]): (VariantSource | null)[] => {
  const a = useGLTF(urls[0]);
  const b = useGLTF(urls[1]);
  const c = useGLTF(urls[2]);
  const d = useGLTF(urls[3]);
  const scenes = [a.scene, b.scene, c.scene, d.scene];
  // biome-ignore lint/correctness/useExhaustiveDependencies: scenes array is derived from useGLTF hooks above, references change only with urls
  const sources = useMemo(() => scenes.map(buildVariantSource), scenes);

  // Publish each variant's hit radius into the global cache so canPlaceAt
  // (sim side) can read it when towers/path placement queries fire.
  useEffect(() => {
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (src) meshXZRadii.set(urls[i], src.xzRadius);
    }
  }, [sources, urls]);

  return sources;
};

export const Trees = () => {
  const treeVersion = useGame((s) => s.ui.treeVersion);
  void treeVersion;
  const trees = useGame.getState().world.trees;
  const biome = useGame((s) => s.world.biome);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);
  const selectedTreeId = useGame((s) => s.selectedTreeId);
  const selectedRockId = useGame((s) => s.selectedRockId);
  const selectedKind = useGame((s) => s.selectedKind);
  const selectedTowerId = useGame((s) => s.world.selectedTowerId);
  const inspectedEnemyId = useGame((s) => s.inspectedEnemy.id);
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

  useEffect(() => {
    if (hoveredId === null) return;
    const externalSelectionActive =
      selectedKind !== null ||
      selectedTowerId !== null ||
      selectedRockId !== null ||
      inspectedEnemyId !== null ||
      (selectedTreeId !== null && selectedTreeId !== hoveredId);
    if (externalSelectionActive) setHoveredId(null);
  }, [hoveredId, inspectedEnemyId, selectedKind, selectedRockId, selectedTowerId, selectedTreeId]);

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
        return <VariantGroup key={vi} bucket={bucket} source={src} />;
      })}

      <TreeHitTargets
        trees={trees}
        sources={sources}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      />

      {running &&
        hovered &&
        hovered.id !== selectedTreeId &&
        (() => {
          const r = treeSelectionRadius(sources[hovered.variant], hovered.scale);
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
      {running &&
        selected &&
        (() => {
          const r = treeSelectionRadius(sources[selected.variant], selected.scale);
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
      dummy.position.set(t.pos.x, 0.015, -t.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(treeSelectionRadius(sources[t.variant], t.scale));
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
