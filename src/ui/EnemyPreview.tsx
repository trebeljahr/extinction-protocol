import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";

type Props = {
  kind: EnemyKind;
  size?: number;
};

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find(c => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

const Creature = ({ kind }: { kind: EnemyKind }) => {
  const cfg = ENEMY_MODEL[kind];
  const gltf = useGLTF(cfg.url);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const obj = useMemo(() => {
    const cloned = cloneSkinned(gltf.scene);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = cfg.targetSize / maxDim;
    cloned.scale.setScalar(s);
    cloned.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    cloned.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf.scene, cfg.targetSize]);

  useEffect(() => {
    const mx = new THREE.AnimationMixer(obj);
    const target = cfg.clip ?? "Idle";
    const clip =
      findClip(gltf.animations, target) ??
      findClip(gltf.animations, "Run") ??
      findClip(gltf.animations, "Walk") ??
      gltf.animations[0];
    if (clip) mx.clipAction(clip).play();
    mixerRef.current = mx;
    return () => { mx.stopAllAction(); mixerRef.current = null; };
  }, [obj, gltf.animations, cfg.clip]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
  );
};

export const EnemyPreview = ({ kind, size = 360 }: Props) => {
  const span = (ENEMY_MODEL[kind].targetSize + 0.4);
  return (
    <div className="enemy-preview" style={{ width: size, height: size }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop="always"
        camera={{
          position: [span * 1.4, span * 0.8, span * 2.0],
          fov: 32,
          near: 0.1,
          far: 50,
        }}
        onCreated={({ camera }) => camera.lookAt(0, span * 0.35, 0)}
      >
        <color attach="background" args={["#0c1420"]} />
        <ambientLight intensity={0.8} color="#eef4ff" />
        <directionalLight
          position={[3, 5, 4]}
          intensity={2.0}
          color="#fff4dc"
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />
        <hemisphereLight args={["#bed8ff", "#2a1f15", 0.6]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <circleGeometry args={[span * 0.9, 40]} />
          <meshStandardMaterial color="#182436" roughness={0.9} />
        </mesh>

        <Suspense fallback={null}>
          <Creature kind={kind} />
        </Suspense>
      </Canvas>
    </div>
  );
};
