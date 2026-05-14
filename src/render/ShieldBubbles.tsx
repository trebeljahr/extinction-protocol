import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { EnemyKind } from "../sim/types";
import { useGame } from "../store";

const MAX_SHIELDED = 128;
// Faceted icosphere reads as a low-poly energy field — distinct from the
// smooth sphere look the cryo aura uses. Detail 1 keeps tris cheap while
// keeping the hex-ish facets visible.
const SHIELD_BASE_COLOR = new THREE.Color("#7fc8ff");
const SHIELD_REGEN_COLOR = new THREE.Color("#cdeaff");

// Per-kind bubble radius, tuned to hug the model from typical camera
// angles. The previous sqrt(maxHp) heuristic over-sized medium kinds
// (whose HP is high relative to a narrow silhouette — raptors, stegos)
// and under-sized titans/bosses (capped at 2.6 even at 4200 HP). Body
// shape, not HP pool, drives how big the bubble should look.
const SHIELD_RADIUS_BY_KIND: Record<EnemyKind, number> = {
  raptor: 0.7,
  swarm: 0.45,
  para: 0.85,
  allosaur: 1.0,
  stego: 1.0,
  armored: 1.05,
  titan: 3.0,
  boss: 5.0,
};

// Re-use this geometry/material across every shielded enemy via instancing.
// One InstancedMesh handles the whole field — minimal draw cost.
export const ShieldBubbles = () => {
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
      if (!e.alive || e.leak) continue;
      if (e.maxShield <= 0) continue;
      if (hi >= MAX_SHIELDED) break;

      // Hide bubble while broken; show again once regen tops it up.
      if (e.shield <= 0) continue;

      const ratio = e.shield / e.maxShield;
      const baseR = SHIELD_RADIUS_BY_KIND[e.kind];
      // Subtle pulse on the bubble — faster pulse during regen so the
      // recovery reads as "charging back up." Cracks/flicker shows up as
      // a tighter pulse + lower opacity at low ratio.
      const regening = e.shieldBrokenAt > 0 && ratio < 1;
      const pulse = regening
        ? 1 + Math.sin(time * 8 + e.id) * 0.06
        : 1 + Math.sin(time * 2.5 + e.id) * 0.025;
      const flicker = ratio < 0.4 ? 0.85 + Math.sin(time * 22 + e.id) * 0.15 * (1 - ratio) : 1;
      const r = baseR * pulse * flicker;
      dummy.position.set(e.pos.x, baseR * 0.6, -e.pos.y);
      dummy.rotation.set(0, time * 0.3 + e.id, 0);
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      mesh.setMatrixAt(hi, dummy.matrix);

      // Color: lerp toward white as it depletes, brighter during regen.
      color.copy(regening ? SHIELD_REGEN_COLOR : SHIELD_BASE_COLOR);
      const intensity = 0.4 + 0.6 * ratio;
      color.multiplyScalar(intensity);
      mesh.setColorAt(hi, color);
      hi++;
    }
    mesh.count = hi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SHIELDED]} renderOrder={5}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="white"
        transparent
        opacity={0.28}
        depthWrite={false}
        wireframe
        toneMapped={false}
      />
    </instancedMesh>
  );
};
