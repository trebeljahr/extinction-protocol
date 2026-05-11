import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { measureVisibleBox } from "../render/measureModel";
import type { BossVariant, EnemyKind } from "../sim/types";
import { BOSS_VARIANT_MODEL, BOSS_VARIANT_TINT, ENEMY_MODEL } from "../sim/world";

type Props = {
  kind: EnemyKind;
  // Optional — when set, the preview renders the matriarch variant
  // (different model + permanent tint). Ignored for non-boss kinds.
  bossVariant?: BossVariant;
  size?: number;
};

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find((c) => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

// Matches the in-game ModelEnemyMesh tint amount so the compendium
// preview reads as the same queen the player just fought.
const MATRIARCH_PREVIEW_TINT_AMOUNT = 0.78;
const MATRIARCH_PREVIEW_EMISSIVE_AMOUNT = 0.55;

const Creature = ({ kind, bossVariant }: { kind: EnemyKind; bossVariant?: BossVariant }) => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  const cfg = isMatriarch ? BOSS_VARIANT_MODEL[bossVariant] : ENEMY_MODEL[kind];
  const gltf = useGLTF(cfg.url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const obj = useMemo(() => {
    const cloned = cloneSkinned(gltf.scene);
    const box = measureVisibleBox(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = cfg.targetSize / maxDim;
    cloned.scale.setScalar(s);
    cloned.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const tint =
      isMatriarch && bossVariant !== undefined
        ? new THREE.Color(BOSS_VARIANT_TINT[bossVariant])
        : null;
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
      const tintMat = (mm: THREE.Material) => {
        const cloned = mm.clone();
        if (tint) {
          const std = cloned as THREE.MeshStandardMaterial;
          if (std.color) std.color.lerp(tint, MATRIARCH_PREVIEW_TINT_AMOUNT);
          if (std.emissive)
            std.emissive.copy(tint).multiplyScalar(MATRIARCH_PREVIEW_EMISSIVE_AMOUNT);
        }
        return cloned;
      };
      if (Array.isArray(m.material)) {
        m.material = m.material.map(tintMat);
      } else if (m.material) {
        m.material = tintMat(m.material as THREE.Material);
      }
    });
    return cloned;
  }, [gltf.scene, cfg.targetSize, isMatriarch, bossVariant]);

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

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return <primitive object={obj} />;
};

export const EnemyPreview = ({ kind, bossVariant, size = 360 }: Props) => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  // Matriarch variants are typically much larger than their base species
  // — span has to scale from the variant model, not the species default,
  // or the camera framing crops the queen's silhouette.
  const span =
    (isMatriarch ? BOSS_VARIANT_MODEL[bossVariant].targetSize : ENEMY_MODEL[kind].targetSize) + 0.4;
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
          <Creature kind={kind} bossVariant={bossVariant} />
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
