import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_FIERCE = 128;
// Soft red sphere halo around any enemy carrying the fierce chip.
// Distinct from the shielded bubble (wireframe icosphere) and the
// healer ring (ground disc) — uses a back-side-rendered sphere with
// additive-blending soft material that reads as "this one hits hard"
// rather than "this one has a barrier."
const FIERCE_COLOR = new THREE.Color("#ff3a30");

export const FierceHalos = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();
    const time = world.time;

    let hi = 0;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (!e.fierce) continue;
      if (hi >= MAX_FIERCE) break;

      // Halo radius scales with silhouette like the shield bubble does
      // — sqrt(maxHp) is a decent proxy across kind sizes.
      const sizeProxy = Math.min(2.6, 1.0 + Math.sqrt(e.maxHp) * 0.06);
      // Slow pulse so the halo feels alive without being noisy.
      const pulse = 1 + Math.sin(time * 2.0 + e.id) * 0.06;
      const r = sizeProxy * pulse;
      dummy.position.set(e.pos.x, sizeProxy * 0.55, -e.pos.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      mesh.setMatrixAt(hi, dummy.matrix);

      const intensity = 0.7 + 0.3 * Math.sin(time * 3.0 + e.id);
      color.copy(FIERCE_COLOR).multiplyScalar(intensity);
      mesh.setColorAt(hi, color);
      hi++;
    }
    mesh.count = hi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_FIERCE]} renderOrder={4}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial
        color="white"
        transparent
        opacity={0.18}
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
};
