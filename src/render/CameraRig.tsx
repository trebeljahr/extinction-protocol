import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useGame } from "../store";

export const CameraRig = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const mag = useGame.getState().world.shake.magnitude;
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
