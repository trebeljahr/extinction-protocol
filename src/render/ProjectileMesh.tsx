import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

const MAX_PROJECTILES = 512;

export const ProjectileMesh = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();

    let i = 0;
    for (const p of world.projectiles) {
      if (i >= MAX_PROJECTILES) break;
      dummy.position.set(p.pos.x, 0.8, -p.pos.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PROJECTILES]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial color="#ffe866" toneMapped={false} />
    </instancedMesh>
  );
};
