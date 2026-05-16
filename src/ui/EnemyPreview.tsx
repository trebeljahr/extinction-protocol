import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
import { Diorama } from "./Diorama";

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

export const EnemyPreview = ({ kind, bossVariant, size = 360 }: Props) => {
  const isMatriarch = kind === "boss" && bossVariant !== undefined;
  // Matriarch variants are typically much larger than their base species
  // — span has to scale from the variant model, not the species default,
  // or the camera framing crops the queen's silhouette.
  const span =
    (isMatriarch ? BOSS_VARIANT_MODEL[bossVariant].targetSize : ENEMY_MODEL[kind].targetSize) + 0.4;
  const isSwarm = kind === "swarm";
  return (
    <Diorama span={span} size={size}>
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
    </Diorama>
  );
};
