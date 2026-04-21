import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import type { EnemyKind } from "../sim/types";

const MAX_ENEMIES = 256;

const KIND_COLOR: Record<EnemyKind, string> = {
  raptor: "#c44848",
  allosaur: "#b86b2a",
  stego: "#5a8c3a",
};

const KIND_SCALE: Record<EnemyKind, number> = {
  raptor: 0.6,
  allosaur: 0.85,
  stego: 1.1,
};

const KINDS: EnemyKind[] = ["raptor", "allosaur", "stego"];

export const EnemyMesh = () => {
  const meshRefs = useRef<Record<EnemyKind, THREE.InstancedMesh | null>>({
    raptor: null,
    allosaur: null,
    stego: null,
  });
  const healthRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const { world } = useGame.getState();

    const count: Record<EnemyKind, number> = { raptor: 0, allosaur: 0, stego: 0 };

    for (const e of world.enemies) {
      const mesh = meshRefs.current[e.kind];
      if (!mesh) continue;
      const i = count[e.kind]++;
      if (i >= MAX_ENEMIES) continue;
      dummy.position.set(e.pos.x, 0.3 * KIND_SCALE[e.kind], -e.pos.y);
      dummy.scale.setScalar(KIND_SCALE[e.kind]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    for (const kind of KINDS) {
      const mesh = meshRefs.current[kind];
      if (!mesh) continue;
      mesh.count = count[kind];
      mesh.instanceMatrix.needsUpdate = true;
    }

    const healthMesh = healthRef.current;
    if (healthMesh) {
      let hi = 0;
      for (const e of world.enemies) {
        if (hi >= MAX_ENEMIES) break;
        const ratio = e.hp / e.maxHp;
        const w = Math.max(0.001, 0.9 * ratio);
        dummy.position.set(e.pos.x - 0.45 + w / 2, 0.9, -e.pos.y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(w, 1, 1);
        dummy.updateMatrix();
        healthMesh.setMatrixAt(hi, dummy.matrix);
        color.setHSL(0.33 * ratio, 0.8, 0.5);
        healthMesh.setColorAt(hi, color);
        hi++;
      }
      healthMesh.count = hi;
      healthMesh.instanceMatrix.needsUpdate = true;
      if (healthMesh.instanceColor) healthMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {KINDS.map(kind => (
        <instancedMesh
          key={kind}
          ref={m => { meshRefs.current[kind] = m; }}
          args={[undefined, undefined, MAX_ENEMIES]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.7, 0.6, 0.9]} />
          <meshStandardMaterial color={KIND_COLOR[kind]} roughness={0.7} />
        </instancedMesh>
      ))}
      <instancedMesh ref={healthRef} args={[undefined, undefined, MAX_ENEMIES]}>
        <planeGeometry args={[1, 0.12]} />
        <meshBasicMaterial color="white" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
