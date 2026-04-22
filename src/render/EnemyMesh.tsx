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
  swarm: "#e08060",
  armored: "#4a5c6e",
};

const KIND_SCALE: Record<EnemyKind, number> = {
  raptor: 0.6,
  allosaur: 0.85,
  stego: 1.1,
  swarm: 0.35,
  armored: 1.0,
};

const PRIMITIVE_KINDS: EnemyKind[] = ["raptor", "stego", "armored"];

const geomFor = (kind: EnemyKind): THREE.BufferGeometry => {
  switch (kind) {
    case "raptor":   return new THREE.ConeGeometry(0.4, 1.1, 6);
    case "allosaur": return new THREE.BoxGeometry(0.8, 0.7, 1.1);
    case "stego":    return new THREE.DodecahedronGeometry(0.7);
    case "swarm":    return new THREE.OctahedronGeometry(0.35);
    case "armored":  return new THREE.BoxGeometry(0.9, 0.9, 1.2);
  }
};

export const EnemyMesh = () => {
  const meshRefs = useRef<Partial<Record<EnemyKind, THREE.InstancedMesh | null>>>({});
  const healthRef = useRef<THREE.InstancedMesh>(null);

  const geoms = useMemo(() => {
    const out: Partial<Record<EnemyKind, THREE.BufferGeometry>> = {};
    for (const k of PRIMITIVE_KINDS) out[k] = geomFor(k);
    return out;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const flashColor = useMemo(() => new THREE.Color("#ffffff"), []);

  useFrame(() => {
    const { world } = useGame.getState();

    const count: Partial<Record<EnemyKind, number>> = {};
    for (const k of PRIMITIVE_KINDS) count[k] = 0;

    for (const e of world.enemies) {
      if (!PRIMITIVE_KINDS.includes(e.kind)) continue;
      const mesh = meshRefs.current[e.kind];
      if (!mesh) continue;
      const i = (count[e.kind] ?? 0);
      count[e.kind] = i + 1;
      if (i >= MAX_ENEMIES) continue;

      dummy.position.set(e.pos.x, 0.4 * KIND_SCALE[e.kind], -e.pos.y);
      if (e.kind === "raptor") {
        dummy.rotation.set(Math.PI / 2, 0, 0);
      } else {
        dummy.rotation.set(0, world.time * 1.5 + e.id, 0);
      }
      dummy.scale.setScalar(KIND_SCALE[e.kind]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const flashing = world.time < e.flashUntil;
      const slowed = world.time < e.slowUntil;
      if (flashing) {
        mesh.setColorAt(i, flashColor);
      } else if (slowed) {
        color.set(KIND_COLOR[e.kind]);
        color.lerp(new THREE.Color("#7fc8ff"), 0.55);
        mesh.setColorAt(i, color);
      } else {
        color.set(KIND_COLOR[e.kind]);
        mesh.setColorAt(i, color);
      }
    }

    for (const kind of PRIMITIVE_KINDS) {
      const mesh = meshRefs.current[kind];
      if (!mesh) continue;
      mesh.count = count[kind] ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const healthMesh = healthRef.current;
    if (healthMesh) {
      let hi = 0;
      for (const e of world.enemies) {
        if (hi >= MAX_ENEMIES) break;
        const ratio = e.hp / e.maxHp;
        const w = Math.max(0.001, 0.9 * ratio);
        dummy.position.set(e.pos.x - 0.45 + w / 2, 1.25, -e.pos.y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(w, 1, 1);
        dummy.updateMatrix();
        healthMesh.setMatrixAt(hi, dummy.matrix);
        color.setHSL(0.33 * ratio, 0.85, 0.55);
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
      {PRIMITIVE_KINDS.map(kind => (
        <instancedMesh
          key={kind}
          ref={m => { meshRefs.current[kind] = m; }}
          args={[geoms[kind]!, undefined, MAX_ENEMIES]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={KIND_COLOR[kind]} roughness={0.65} metalness={0.05} />
        </instancedMesh>
      ))}
      <instancedMesh ref={healthRef} args={[undefined, undefined, MAX_ENEMIES]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="white" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};
