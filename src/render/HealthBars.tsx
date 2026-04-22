import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

const MAX_ENEMIES = 256;

export const HealthBars = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();

    let hi = 0;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (hi >= MAX_ENEMIES) break;
      const ratio = e.hp / e.maxHp;
      const w = Math.max(0.001, 0.9 * ratio);
      dummy.position.set(e.pos.x - 0.45 + w / 2, 1.6, -e.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(w, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(hi, dummy.matrix);
      color.setHSL(0.33 * ratio, 0.85, 0.55);
      mesh.setColorAt(hi, color);
      hi++;
    }
    mesh.count = hi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_ENEMIES]}>
      <planeGeometry args={[1, 0.1]} />
      <meshBasicMaterial color="white" toneMapped={false} />
    </instancedMesh>
  );
};
