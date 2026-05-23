import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_BASE_RINGS = 6;

const RING_GOLD = new THREE.Color("#ffd66a");
const RING_SPOT_ARMED = new THREE.Color("#ff8a3c");

export const SelectionRing = () => {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const baseRingsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const ring = ringRef.current;
    const baseRings = baseRingsRef.current;
    if (!ring || !baseRings) return;
    const { world, spotSelecting } = useGame.getState();

    const sel = world.selectedTowerId !== null ? world.towerById.get(world.selectedTowerId) : null;
    if (sel) {
      ring.position.set(sel.pos.x, 0.04, -sel.pos.y);
      ring.visible = true;
      ring.scale.setScalar(sel.range * 2);
      // While the player is actively picking a mortar's aim point, the
      // range ring turns orange and pulses — it doubles as the valid
      // placement boundary and a clear "you're in spot-select mode" cue.
      const mat = ringMatRef.current;
      if (mat) {
        const armed = spotSelecting && sel.kind === "mortar" && sel.targetingMode === "spot";
        if (armed) {
          mat.color.copy(RING_SPOT_ARMED);
          mat.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5));
        } else {
          mat.color.copy(RING_GOLD);
          mat.opacity = 0.7;
        }
      }
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
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={10}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#ffd66a"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={baseRingsRef}
        args={[undefined, undefined, MAX_BASE_RINGS]}
        visible={false}
        frustumCulled={false}
        renderOrder={10}
      >
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial
          color="#ff8a5a"
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};
