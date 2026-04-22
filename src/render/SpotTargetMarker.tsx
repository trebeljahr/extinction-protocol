import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

// Crosshair + splash preview at a mortar's spot-target location. Only visible
// while the owning mortar is selected and in "spot" mode with a spot set.
export const SpotTargetMarker = () => {
  const groupRef = useRef<THREE.Group>(null);
  const splashRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const group = groupRef.current;
    const splash = splashRef.current;
    if (!group) return;
    const { world } = useGame.getState();
    const id = world.selectedTowerId;
    const tower = id !== null ? world.towers.find(t => t.id === id) : null;
    const visible =
      !!tower &&
      tower.kind === "mortar" &&
      tower.targetingMode === "spot" &&
      !!tower.targetSpot;
    group.visible = visible;
    if (!visible || !tower?.targetSpot) return;
    group.position.set(tower.targetSpot.x, 0.04, -tower.targetSpot.y);
    if (splash) splash.scale.setScalar(tower.splashRadius);
    const pulse = 1 + Math.sin(world.time * 7) * 0.08;
    group.rotation.z = world.time * 0.6;
    group.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Outer splash radius */}
      <mesh ref={splashRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[0.94, 1.0, 48]} />
        <meshBasicMaterial
          color="#ff8a5a"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* Crosshair hub */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.18, 0.26, 32]} />
        <meshBasicMaterial
          color="#ffb266"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* Crosshair arms */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <planeGeometry args={[0.9, 0.04]} />
        <meshBasicMaterial
          color="#ffb266"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} renderOrder={10}>
        <planeGeometry args={[0.9, 0.04]} />
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
