import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_BASE_RINGS = 6;

export const SelectionRing = () => {
  const ringRef = useRef<THREE.Mesh>(null);
  const baseRingsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const ring = ringRef.current;
    const baseRings = baseRingsRef.current;
    if (!ring || !baseRings) return;
    const { world } = useGame.getState();

    const sel = world.selectedTowerId !== null ? world.towerById.get(world.selectedTowerId) : null;
    if (sel) {
      ring.position.set(sel.pos.x, 0.04, -sel.pos.y);
      ring.visible = true;
      ring.scale.setScalar(sel.range * 2);
    } else {
      ring.visible = false;
    }

    // Base selection draws one ring per HQ endpoint at the base's
    // current range. Instanced so multi-path levels stay cheap.
    if (world.selectedBase) {
      let i = 0;
      for (const path of world.paths) {
        if (i >= MAX_BASE_RINGS) break;
        if (path.length === 0) continue;
        const end = path[path.length - 1];
        dummy.position.set(end.x, 0.04, -end.y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(world.base.range * 2);
        dummy.updateMatrix();
        baseRings.setMatrixAt(i, dummy.matrix);
        i++;
      }
      baseRings.count = i;
      baseRings.instanceMatrix.needsUpdate = true;
      baseRings.visible = i > 0;
    } else {
      baseRings.visible = false;
      baseRings.count = 0;
    }
  });

  return (
    <group>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color="#ffd66a" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh
        ref={baseRingsRef}
        args={[undefined, undefined, MAX_BASE_RINGS]}
        visible={false}
        frustumCulled={false}
      >
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color="#ff8a5a" transparent opacity={0.75} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
};
