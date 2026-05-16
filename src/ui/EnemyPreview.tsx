import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { measureVisibleBox } from "../render/measureModel";
import type { BossVariant, EnemyKind } from "../sim/types";
import {
  BOSS_VARIANT_MATERIAL,
  BOSS_VARIANT_MODEL,
  BOSS_VARIANT_TINT,
  ENEMY_MODEL,
} from "../sim/world";

type Props = {
  kind: EnemyKind;
  // Optional — when set, the preview renders the matriarch variant
  // (different model + permanent tint). Ignored for non-boss kinds.
  bossVariant?: BossVariant;
  size?: number;
};

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find((c) => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

const Creature = ({
  kind,
  bossVariant,
  position = [0, 0, 0],
  rotationY = 0,
  scaleMul = 1,
}: {
  kind: EnemyKind;
  bossVariant?: BossVariant;
  position?: [number, number, number];
  rotationY?: number;
  scaleMul?: number;
}) => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  const cfg = isMatriarch ? BOSS_VARIANT_MODEL[bossVariant] : ENEMY_MODEL[kind];
  const clipTimeScale = isMatriarch ? (BOSS_VARIANT_MODEL[bossVariant].timeScale ?? 1) : 1;
  const gltf = useGLTF(cfg.url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const obj = useMemo(() => {
    const cloned = cloneSkinned(gltf.scene);
    const box = measureVisibleBox(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = (cfg.targetSize / maxDim) * scaleMul;
    cloned.scale.setScalar(s);
    cloned.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const tint =
      isMatriarch && bossVariant !== undefined
        ? new THREE.Color(BOSS_VARIANT_TINT[bossVariant])
        : null;
    const material =
      isMatriarch && bossVariant !== undefined ? BOSS_VARIANT_MATERIAL[bossVariant] : null;
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
        if (tint && material) {
          const std = cloned as THREE.MeshStandardMaterial;
          if (std.color) std.color.lerp(tint, material.tintAmount);
          if (std.emissive) std.emissive.copy(tint).multiplyScalar(material.emissiveAmount);
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
  }, [gltf.scene, cfg.targetSize, isMatriarch, bossVariant, scaleMul]);

  useEffect(() => {
    const mx = new THREE.AnimationMixer(obj);
    const target = cfg.clip ?? "Idle";
    const clip =
      findClip(gltf.animations, target) ??
      findClip(gltf.animations, "Run") ??
      findClip(gltf.animations, "Walk") ??
      gltf.animations[0];
    if (clip) {
      const action = mx.clipAction(clip);
      action.timeScale = clipTimeScale;
      action.play();
    }
    mixerRef.current = mx;
    return () => {
      mx.stopAllAction();
      mixerRef.current = null;
    };
  }, [obj, gltf.animations, cfg.clip, clipTimeScale]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={obj} />
    </group>
  );
};

// Hand-arranged swarm pack — 5 raptors at slightly varied scales/yaws so
// the silhouette reads as "many small raptors" rather than one creature.
// Positions are in world units (additive to the auto-grounded creature
// pivot), so the values stay sensible even when the camera span scales
// to a tiny pack.
const SWARM_PACK: Array<{
  pos: [number, number, number];
  rotY: number;
  scaleMul: number;
}> = [
  { pos: [0.0, 0, 0.0], rotY: -0.05, scaleMul: 0.7 },
  { pos: [0.55, 0, -0.4], rotY: -0.25, scaleMul: 0.62 },
  { pos: [-0.5, 0, -0.3], rotY: 0.18, scaleMul: 0.65 },
  { pos: [0.3, 0, 0.55], rotY: 0.4, scaleMul: 0.6 },
  { pos: [-0.45, 0, 0.45], rotY: -0.35, scaleMul: 0.58 },
];

// Static decor — small trees, rocks and grass tufts placed around the
// creature so the preview reads as a tiny diorama instead of a model on
// an empty disc. Positions are normalized to the camera span (see
// EnemyPreview) so the layout scales the same for a small raptor as for
// a titan. Items sit just outside the creature footprint and inside the
// ground disc radius (span * 2.5).
type DecorSpec = {
  url: string;
  // Position offset relative to span: actual world pos = [rx*span, 0, rz*span]
  rx: number;
  rz: number;
  rotY: number;
  // Target on-screen size in world units. Scale gets computed against
  // the model's bounding box so e.g. Grass and Tree end up comparable
  // even though their authored sizes differ wildly.
  targetSize: number;
};

const DECOR: DecorSpec[] = [
  // Back row — taller trees behind the creature.
  { url: "/models/nature/Tree2.glb", rx: -1.5, rz: -1.6, rotY: 0.3, targetSize: 2.4 },
  { url: "/models/nature/Tree1.glb", rx: 1.6, rz: -1.7, rotY: -0.4, targetSize: 2.1 },
  { url: "/models/nature/Tree4.glb", rx: 0.0, rz: -2.0, rotY: 1.2, targetSize: 1.9 },
  // Side rocks framing the creature.
  { url: "/models/nature/Rock1.glb", rx: -1.8, rz: 0.4, rotY: 0.6, targetSize: 0.85 },
  { url: "/models/nature/Rock2.glb", rx: 1.7, rz: 0.6, rotY: -0.9, targetSize: 0.7 },
  { url: "/models/nature/Rock3.glb", rx: 1.0, rz: 1.5, rotY: 1.4, targetSize: 0.6 },
  // Front grass tufts — low decor so they don't compete with silhouette.
  { url: "/models/nature/Grass1.glb", rx: -0.6, rz: 1.4, rotY: 0.0, targetSize: 0.45 },
  { url: "/models/nature/Grass2.glb", rx: 0.5, rz: 1.6, rotY: 0.8, targetSize: 0.4 },
  { url: "/models/nature/Grass3.glb", rx: -1.2, rz: 1.0, rotY: -0.5, targetSize: 0.42 },
  { url: "/models/nature/Grass1.glb", rx: 1.3, rz: -0.4, rotY: 1.7, targetSize: 0.4 },
];

// Static GLB prop. Measures bbox + applies uniform scale to hit
// `targetSize`, then ground-aligns so box.min.y lands at 0. No
// animation, no skinning — keeps every preview tick cheap.
const Prop = ({ spec, span }: { spec: DecorSpec; span: number }) => {
  const gltf = useGLTF(spec.url);
  const obj = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = measureVisibleBox(cloned);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = spec.targetSize / maxDim;
    cloned.scale.setScalar(s);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return cloned;
  }, [gltf.scene, spec.targetSize]);
  return (
    <group position={[spec.rx * span, 0, spec.rz * span]} rotation={[0, spec.rotY, 0]}>
      <primitive object={obj} />
    </group>
  );
};

// Preload so opening the compendium doesn't pop in trees frame-by-frame.
useGLTF.preload("/models/nature/Tree1.glb");
useGLTF.preload("/models/nature/Tree2.glb");
useGLTF.preload("/models/nature/Tree4.glb");
useGLTF.preload("/models/nature/Rock1.glb");
useGLTF.preload("/models/nature/Rock2.glb");
useGLTF.preload("/models/nature/Rock3.glb");
useGLTF.preload("/models/nature/Grass1.glb");
useGLTF.preload("/models/nature/Grass2.glb");
useGLTF.preload("/models/nature/Grass3.glb");

export const EnemyPreview = ({ kind, bossVariant, size = 360 }: Props) => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  // Matriarch variants are typically much larger than their base species
  // — span has to scale from the variant model, not the species default,
  // or the camera framing crops the queen's silhouette.
  const span =
    (isMatriarch ? BOSS_VARIANT_MODEL[bossVariant].targetSize : ENEMY_MODEL[kind].targetSize) + 0.4;
  const target: [number, number, number] = [0, span * 0.35, 0];
  const isSwarm = kind === "swarm";
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
        <color attach="background" args={["#3a4858"]} />

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
          like it was floating above the plane. Neutral dirt tone (was the
          old greenish #2b3e28) so the decor doesn't fight the new grey sky.
        */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[span * 2.5, 56]} />
          <meshStandardMaterial color="#4a4438" roughness={0.98} metalness={0} />
        </mesh>

        <Suspense fallback={null}>
          {isSwarm ? (
            SWARM_PACK.map((p, i) => (
              <Creature
                key={i}
                kind={kind}
                bossVariant={bossVariant}
                position={p.pos}
                rotationY={p.rotY}
                scaleMul={p.scaleMul}
              />
            ))
          ) : (
            <Creature kind={kind} bossVariant={bossVariant} />
          )}
          {DECOR.map((spec, i) => (
            <Prop key={i} spec={spec} span={span} />
          ))}
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
