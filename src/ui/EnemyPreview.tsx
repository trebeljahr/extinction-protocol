import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { EnemyKind } from "../sim/types";
import { ENEMY_MODEL } from "../sim/world";

type Props = {
  kind: EnemyKind;
  size?: number;
};

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find((c) => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

const Creature = ({ kind }: { kind: EnemyKind }) => {
  const cfg = ENEMY_MODEL[kind];
  const gltf = useGLTF(cfg.url);
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
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Clone materials so the preview Canvas compiles its own shaders.
      // Without this, some models (notably Trex) come back rendered
      // flat-white because the material was first compiled against the
      // main PlayScene renderer and shared state gets stale when we
      // use the same material in this separate Canvas.
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mm) => mm.clone());
      } else if (m.material) {
        m.material = (m.material as THREE.Material).clone();
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
    return () => {
      mx.stopAllAction();
      mixerRef.current = null;
    };
  }, [obj, gltf.animations, cfg.clip]);

  // The bind-pose bbox we used for grounding includes bone tips that
  // can sit far below the actual visible mesh — most obvious on the
  // Triceratops, whose Idle clip leaves the body floating well above
  // the ground disc while its shadow still anchors at y=0. After the
  // first frame of the chosen clip we re-measure against the real
  // skinned vertices and re-ground.
  const groundedRef = useRef<EnemyKind | null>(null);
  useFrame((_, delta) => {
    const mx = mixerRef.current;
    if (!mx) return;
    mx.update(delta);
    if (groundedRef.current === kind) return;
    groundedRef.current = kind;
    obj.updateMatrixWorld(true);
    let minY = Infinity;
    const v = new THREE.Vector3();
    obj.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (!(sm as THREE.Mesh).isMesh) return;
      if (!sm.isSkinnedMesh || !sm.skeleton) return;
      const pos = sm.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        sm.getVertexPosition(i, v);
        v.applyMatrix4(sm.matrixWorld);
        if (v.y < minY) minY = v.y;
      }
    });
    if (Number.isFinite(minY)) obj.position.y -= minY;
  });

  return <primitive object={obj} />;
};

export const EnemyPreview = ({ kind, size = 360 }: Props) => {
  const span = ENEMY_MODEL[kind].targetSize + 0.4;
  const target: [number, number, number] = [0, span * 0.35, 0];
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
      >
        <color attach="background" args={["#1b2a22"]} />

        {/* Matches PlayScene lighting so creatures don't look flat or dark. */}
        <Environment preset="park" background={false} environmentIntensity={0.6} />
        <ambientLight intensity={0.55} color="#eaf2ff" />
        <directionalLight
          position={[span * 1.6, span * 2.6, span * 1.2]}
          intensity={2.2}
          color="#fff4dc"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-span * 2.5}
          shadow-camera-right={span * 2.5}
          shadow-camera-top={span * 2.5}
          shadow-camera-bottom={-span * 2.5}
          shadow-bias={-0.0005}
        />
        <hemisphereLight args={["#bcd8ff", "#5a4a2a", 0.85]} />

        {/*
          Ground disc is sized to comfortably catch shadows for any creature
          — span*2.5 so a sweeping tail/limb doesn't push its shadow off the
          edge. Sat at y=-0.02 so it's always just *below* the creature's
          bbox-computed foot level: some animations dip the visible mesh a
          hair below the bind pose and without this the creature looked
          like it was floating above the plane.
        */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[span * 2.5, 56]} />
          <meshStandardMaterial color="#2b3e28" roughness={0.98} metalness={0} />
        </mesh>

        <Suspense fallback={null}>
          <Creature kind={kind} />
        </Suspense>

        <OrbitControls
          makeDefault
          target={target}
          enablePan={false}
          enableZoom
          minDistance={span * 1.2}
          maxDistance={span * 4.5}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.55}
          autoRotate
          autoRotateSpeed={0.9}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
};
