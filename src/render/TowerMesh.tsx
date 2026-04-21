import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

const MAX_TOWERS = 128;

export const TowerMesh = () => {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const turretRef = useRef<THREE.InstancedMesh>(null);
  const rangeRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const { world } = useGame.getState();
    const base = baseRef.current;
    const turret = turretRef.current;
    const range = rangeRef.current;
    if (!base || !turret || !range) return;

    let i = 0;
    for (const t of world.towers) {
      if (i >= MAX_TOWERS) break;

      dummy.position.set(t.pos.x, 0.25, -t.pos.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      base.setMatrixAt(i, dummy.matrix);

      let yaw = 0;
      if (t.targetId !== null) {
        const target = world.enemies.find(e => e.id === t.targetId);
        if (target) {
          const dx = target.pos.x - t.pos.x;
          const dy = target.pos.y - t.pos.y;
          yaw = Math.atan2(dy, dx);
        }
      }
      dummy.position.set(t.pos.x, 0.75, -t.pos.y);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      turret.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.pos.x, 0.03, -t.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(t.range * 2);
      dummy.updateMatrix();
      range.setMatrixAt(i, dummy.matrix);

      i++;
    }

    base.count = i;
    turret.count = i;
    range.count = i;
    base.instanceMatrix.needsUpdate = true;
    turret.instanceMatrix.needsUpdate = true;
    range.instanceMatrix.needsUpdate = true;
  });

  const barrelGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(1.0, 0.15, 0.15);
    g.translate(0.5, 0, 0);
    return g;
  }, []);

  return (
    <group>
      <instancedMesh ref={rangeRef} args={[undefined, undefined, MAX_TOWERS]}>
        <ringGeometry args={[0.49, 0.5, 48]} />
        <meshBasicMaterial color="#3dd1ff" transparent opacity={0.25} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, MAX_TOWERS]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.5, 16]} />
        <meshStandardMaterial color="#3a5068" roughness={0.4} metalness={0.4} />
      </instancedMesh>
      <instancedMesh
        ref={turretRef}
        args={[barrelGeom, undefined, MAX_TOWERS]}
        castShadow
      >
        <meshStandardMaterial color="#9fd8ff" roughness={0.3} metalness={0.6} />
      </instancedMesh>
    </group>
  );
};
