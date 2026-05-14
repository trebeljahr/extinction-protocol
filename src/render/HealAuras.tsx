import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HEAL_AURA_RANGE } from "../sim/world";
import { useGame } from "../store";

const MAX_HEALERS = 64;
// Two layers per healer: a faint disc for area read, and a brighter
// ring at the edge so the heal radius is unambiguous. Ring + disc are
// managed as separate instanced meshes — one draw call each regardless
// of count. Renders for any enemy carrying the healAura chip, not a
// specific kind.
const AURA_COLOR = new THREE.Color("#7eff8a");

export const HealAuras = () => {
  const discRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const disc = discRef.current;
    const ring = ringRef.current;
    if (!disc || !ring) return;
    const { world } = useGame.getState();
    const time = world.time;

    let hi = 0;
    for (const e of world.enemies) {
      if (!e.alive || e.leak) continue;
      if (!e.healAura) continue;
      if (hi >= MAX_HEALERS) break;

      // Pulse the aura radius slightly so it reads as "active healing,"
      // not a static debuff field. Phase per-healer so stacked healers
      // don't pulse in lockstep.
      const pulse = 1 + Math.sin(time * 1.6 + e.id * 0.7) * 0.05;
      const r = HEAL_AURA_RANGE * pulse;
      dummy.position.set(e.pos.x, 0.03, -e.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(r, r, 1);
      dummy.updateMatrix();
      disc.setMatrixAt(hi, dummy.matrix);
      ring.setMatrixAt(hi, dummy.matrix);

      const intensity = 0.7 + 0.3 * Math.sin(time * 2.4 + e.id);
      color.copy(AURA_COLOR).multiplyScalar(intensity);
      disc.setColorAt(hi, color);
      ring.setColorAt(hi, color);
      hi++;
    }
    disc.count = hi;
    ring.count = hi;
    disc.instanceMatrix.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;
    if (disc.instanceColor) disc.instanceColor.needsUpdate = true;
    if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={discRef} args={[undefined, undefined, MAX_HEALERS]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, MAX_HEALERS]}>
        <ringGeometry args={[0.94, 1.0, 64]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};
