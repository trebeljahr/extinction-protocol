import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_PUFFS = 256;

// Camera-facing smoke billboards backed by Kenney's white-puff sprite,
// tinted per-instance for variety. Uses NormalBlending so the puffs
// actually occlude scenery (unlike the additive spark Particles in
// Effects.tsx, which only ever brighten). Per-instance alpha is injected
// via a small onBeforeCompile hook on MeshBasicMaterial.
export const SmokePuffs = () => {
  const texture = useTexture("/textures/fx/whitepuff15.png");
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const billboardQuat = useMemo(() => new THREE.Quaternion(), []);
  const rotQuat = useMemo(() => new THREE.Quaternion(), []);
  const rotAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const color = useMemo(() => new THREE.Color(), []);

  const opacityAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUFFS), 1),
    [],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float aOpacity;
varying float vOpacity;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vOpacity = aOpacity;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying float vOpacity;`,
        )
        .replace(
          "#include <dithering_fragment>",
          `gl_FragColor.a *= vOpacity;
#include <dithering_fragment>`,
        );
    };
    return m;
  }, [texture]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.setAttribute("aOpacity", opacityAttr);
    // Same culling escape hatch as Effects.tsx — instance positions are
    // baked into per-instance matrices, so the default origin-radius-1
    // bounding sphere fails as soon as the player pans away from origin.
    const big = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
    mesh.boundingSphere = big.clone();
    mesh.geometry.boundingSphere = big.clone();
  }, [opacityAttr]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();
    const now = world.time;
    billboardQuat.copy(state.camera.quaternion);
    let i = 0;
    for (const p of world.puffs) {
      if (i >= MAX_PUFFS) break;
      const life = Math.max(0, (p.expiresAt - now) / p.maxLife);
      const age = 1 - life;
      // Fast pop-in over first ~12% of life so the puff doesn't ghost
      // through the explosion flash; slower fade-out over last 40% so
      // the lingering smoke dissolves rather than blinking off.
      const fadeIn = Math.min(1, age / 0.12);
      const fadeOut = life < 0.4 ? life / 0.4 : 1;
      const alpha = p.alpha0 * fadeIn * fadeOut;
      const size = p.size0 + (p.size1 - p.size0) * age;

      dummy.position.set(p.pos.x, p.h, -p.pos.y);
      // Billboard rotation = camera quaternion · per-instance roll about
      // camera-local Z. Composing in this order keeps the sprite facing
      // the camera while spinning in screen-space.
      rotQuat.setFromAxisAngle(rotAxis, p.rot);
      dummy.quaternion.copy(billboardQuat).multiply(rotQuat);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(p.tint);
      mesh.setColorAt(i, color);
      opacityAttr.array[i] = alpha;
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_PUFFS]}
      material={material}
      renderOrder={3}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
};
