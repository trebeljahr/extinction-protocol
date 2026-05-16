import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

// Renders Mike's dash-trail burning coals. One InstancedMesh of additive
// disks on the ground, with per-instance scale + tint fading over each
// ember's lifetime. Frustum-culling disabled because per-instance
// matrices live outside the mesh origin's bounding sphere.
const MAX_EMBERS = 96;

export const CoalTrail = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const big = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
    m.boundingSphere = big;
    m.geometry.boundingSphere = big;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();
    let i = 0;
    const now = world.time;
    for (const e of world.coalEmbers) {
      if (i >= MAX_EMBERS) break;
      const life = Math.max(0, (e.expiresAt - now) / e.maxLife);
      const age = 1 - life;
      // Quick fade-in (first ~10% of life) so a freshly-dropped ember
      // doesn't pop in at full brightness, then linear fade out.
      const fadeIn = Math.min(1, age / 0.1);
      const alpha = fadeIn * life;
      dummy.position.set(e.pos.x, 0.06 + Math.sin(now * 6 + e.id) * 0.015, -e.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      // Slight breathing scale so the trail visibly seethes instead of
      // sitting as a static disc.
      const breathe = 1 + Math.sin(now * 9 + e.id * 1.3) * 0.06;
      dummy.scale.set(e.radius * breathe, e.radius * breathe, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Hotter (more yellow) early, cooler (deeper red) as it dies.
      const r = 1.0;
      const g = 0.35 + life * 0.55;
      const b = 0.1 + life * 0.18;
      color.setRGB(r * alpha, g * alpha, b * alpha);
      mesh.setColorAt(i, color);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_EMBERS]}
      renderOrder={2}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 18]} />
      <meshBasicMaterial
        toneMapped={false}
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
