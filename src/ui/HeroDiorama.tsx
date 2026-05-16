import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { measureVisibleBox } from "../render/measureModel";
import type { HeroVariant } from "../sim/types";

const HERO_URL: Record<HeroVariant, string> = {
  george: "/models/heroes/George.glb",
  leela: "/models/heroes/Leela.glb",
  mike: "/models/heroes/Mike.glb",
  stan: "/models/heroes/Stan.glb",
};

const TARGET_SIZE = 2;

const HeroPilotMesh = ({ variant }: { variant: HeroVariant }) => {
  const url = HERO_URL[variant];
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { norm, scaledMinY, centerXZ } = useMemo(() => {
    const box = measureVisibleBox(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = TARGET_SIZE / maxDim;
    return {
      norm: s,
      scaledMinY: box.min.y * s,
      centerXZ: { x: center.x * s, z: center.z * s },
    };
  }, [scene]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: norm is derived
  useEffect(() => {
    const parent = groupRef.current;
    if (!parent) return;
    const obj = cloneSkinned(scene);
    obj.scale.setScalar(norm);
    obj.position.set(-centerXZ.x, -scaledMinY, -centerXZ.z);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
    const mixer = new THREE.AnimationMixer(obj);
    const idle =
      animations.find((c) => c.name.toLowerCase().includes("idle")) ?? animations[0] ?? null;
    if (idle) mixer.clipAction(idle).reset().play();
    mixerRef.current = mixer;
    parent.add(obj);
    return () => {
      mixer.stopAllAction();
      parent.remove(obj);
      mixerRef.current = null;
    };
  }, [scene, animations, norm, centerXZ.x, centerXZ.z, scaledMinY]);

  useFrame((_, dt) => {
    mixerRef.current?.update(dt);
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.5;
    }
  });

  return <group ref={groupRef} />;
};

// Compact 3D viewer used inside hero shop cards + the compendium hero
// page. Auto-rotates with the idle clip. Pointer events fall through
// so the surrounding modal scroll still works.
export const HeroDiorama = ({ variant }: { variant: HeroVariant }) => {
  return (
    <Canvas
      className="hero-diorama-canvas"
      shadows={false}
      camera={{ position: [2.6, 1.6, 2.6], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.7} color="#eaf2ff" />
      <directionalLight position={[3, 4, 3]} intensity={1.2} color="#fff4dc" />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#9fd8ff" />
      <Suspense fallback={null}>
        <HeroPilotMesh variant={variant} />
      </Suspense>
    </Canvas>
  );
};
