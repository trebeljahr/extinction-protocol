import { OrthographicCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { useGame } from "../store";

export const CameraRig = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const { world } = useGame.getState();
    const mag = world.status === "running" ? world.shake.magnitude : 0;
    if (mag > 0.001) {
      g.position.x = (Math.random() - 0.5) * mag;
      g.position.z = (Math.random() - 0.5) * mag;
    } else {
      g.position.set(0, 0, 0);
    }
  });

  return (
    <group ref={groupRef}>
      <OrthographicCamera
        makeDefault
        position={[0, 24, 14]}
        rotation={[-Math.PI / 3, 0, 0]}
        zoom={28}
        near={0.1}
        far={200}
      />
    </group>
  );
};
