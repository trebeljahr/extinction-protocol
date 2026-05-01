import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_SHIELDED = 128;
// Faceted icosphere reads as a low-poly energy field — distinct from the
// smooth sphere look the cryo aura uses. Detail 1 keeps tris cheap while
// keeping the hex-ish facets visible.
const SHIELD_BASE_COLOR = new THREE.Color("#7fc8ff");
const SHIELD_REGEN_COLOR = new THREE.Color("#cdeaff");

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
      if (!e.alive) continue;
      if (e.maxShield <= 0) continue;
      if (hi >= MAX_SHIELDED) break;

      // Hide bubble while broken; show again once regen tops it up.
      if (e.shield <= 0) continue;

      const ratio = e.shield / e.maxShield;
      // Bubble radius scales loosely with the silhouette of the kind —
      // hardcoded per-kind would be cleaner, but this gives a reasonable
      // catch-all using max HP as a proxy for size. Capped so titans
      // don't get a half-screen field.
      const sizeProxy = Math.min(2.6, 0.9 + Math.sqrt(e.maxHp) * 0.06);
      // Subtle pulse on the bubble — faster pulse during regen so the
      // recovery reads as "charging back up." Cracks/flicker shows up as
      // a tighter pulse + lower opacity at low ratio.
      const regening = e.shieldBrokenAt > 0 && ratio < 1;
      const pulse = regening
        ? 1 + Math.sin(time * 8 + e.id) * 0.06
        : 1 + Math.sin(time * 2.5 + e.id) * 0.025;
      const flicker = ratio < 0.4 ? 0.85 + Math.sin(time * 22 + e.id) * 0.15 * (1 - ratio) : 1;
      const r = sizeProxy * pulse * flicker;
      dummy.position.set(e.pos.x, sizeProxy * 0.55, -e.pos.y);
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
