import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import type { Rock } from "../sim/types";
import { useGame } from "../store";
import { ROCK_REMOVE_COST } from "../sim/world";
import { BIOME_LAYERS } from "../biomes";

type Part = { geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number };

// Scales with rock size but stays inside ROCK_MIN_SPACING (1.5) even at
// max scale, so adjacent rocks stay individually clickable.
const rockHitRadius = (scale: number) => 0.55 + 0.25 * scale;

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

// Pointer events go to the hit discs, not the model silhouette.
const neverRaycast: THREE.Mesh["raycast"] = () => {};

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
          raycast={neverRaycast}
        />
      ))}
    </group>
  );
};

export const Rocks = () => {
  const biome = useGame(s => s.world.biome);
  const rocks = useGame(s => s.world.rocks);
  const status = useGame(s => s.ui.status);
  const gold = useGame(s => s.ui.gold);
  const selectedRockId = useGame(s => s.selectedRockId);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  useEffect(() => {
    if (hoveredId !== null && !rocks.some(r => r.id === hoveredId)) setHoveredId(null);
  }, [rocks, hoveredId]);

  const running = status === "running";
  const hovered = hoveredId !== null ? rocks.find(r => r.id === hoveredId) ?? null : null;
  const selected = selectedRockId !== null ? rocks.find(r => r.id === selectedRockId) ?? null : null;
  const canAfford = gold >= ROCK_REMOVE_COST;

  useEffect(() => {
    if (hovered && running) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "pointer";
      return () => { document.body.style.cursor = prev; };
    }
  }, [hovered, running]);

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

      <RockHitTargets
        rocks={rocks}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      />

      {hovered && hovered.id !== selectedRockId && (
        <RockRing
          pos={hovered.pos}
          radius={rockHitRadius(hovered.scale)}
          color={canAfford ? "#ff8a5a" : "#6a6a6a"}
          thickness={0.22}
          y={0.02}
          opacity={0.9}
        />
      )}
      {selected && (
        <RockRing
          pos={selected.pos}
          radius={rockHitRadius(selected.scale) + 0.08}
          color="#ffd66a"
          thickness={0.28}
          y={0.03}
          opacity={0.95}
        />
      )}
    </group>
  );
};

type Vec2 = { x: number; y: number };

// depthTest:false so the ring stays visible even when the rock body
// occludes the ground disc from above.
const RockRing = ({
  pos, radius, thickness, color, y, opacity,
}: {
  pos: Vec2; radius: number; thickness: number; color: string; y: number; opacity: number;
}) => (
  <group position={[pos.x, y, -pos.y]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <ringGeometry args={[radius - thickness, radius, 40]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  </group>
);

const RockHitTargets = ({
  rocks,
  hoveredId,
  setHoveredId,
}: {
  rocks: Rock[];
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
}) => {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  const geom = useMemo(() => new THREE.CircleGeometry(1, 24), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  useEffect(() => () => { geom.dispose(); material.dispose(); }, [geom, material]);

  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      dummy.position.set(r.pos.x, 0.015, -r.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(rockHitRadius(r.scale));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.count = rocks.length;
    im.instanceMatrix.needsUpdate = true;
  }, [rocks]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    const rock = rocks[e.instanceId];
    if (!rock) return;
    e.stopPropagation();
    useGame.getState().selectRock(rock.id);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId == null) return;
    const rock = rocks[e.instanceId];
    if (!rock) return;
    if (hoveredId !== rock.id) setHoveredId(rock.id);
  };

  const onOut = () => {
    if (hoveredId !== null && rocks.some(r => r.id === hoveredId)) setHoveredId(null);
  };

  if (rocks.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geom, material, rocks.length]}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerOut={onOut}
    />
  );
};
