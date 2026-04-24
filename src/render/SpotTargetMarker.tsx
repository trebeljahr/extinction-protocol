import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

// Static circular splash-radius ring at a mortar's spot-target location.
// Visible while the owning mortar is selected and in "spot" mode with a
// spot set. No animation — the user asked for a quiet indicator.
export const SpotTargetMarker = () => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const group = groupRef.current;
    const ring = ringRef.current;
    if (!group) return;
    const { world } = useGame.getState();
    const id = world.selectedTowerId;
    const tower = id !== null ? world.towers.find((t) => t.id === id) : null;
    const visible =
      !!tower && tower.kind === "mortar" && tower.targetingMode === "spot" && !!tower.targetSpot;
    group.visible = visible;
    if (!visible || !tower?.targetSpot) return;
    group.position.set(tower.targetSpot.x, 0.04, -tower.targetSpot.y);
    if (ring) ring.scale.setScalar(tower.splashRadius);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.94, 1.0, 64]} />
        <meshBasicMaterial
          color="#ffb266"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
