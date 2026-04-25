import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  EASTER_EGG_BY_ID,
  type EasterEggDef,
  type EasterEggVisual,
  PRELOAD_URLS,
} from "../easterEggs";
import type { EasterEgg } from "../sim/types";
import { useGame } from "../store";

const findClip = (clips: THREE.AnimationClip[], needle: string | undefined) => {
  if (!needle) return null;
  const lower = needle.toLowerCase();
  return clips.find((c) => c.name.toLowerCase().includes(lower)) ?? null;
};

// Apply tint + opacity to every material under the clone. Each material is
// itself cloned first so we don't mutate the cached GLB used by other
// renderers. Casts to MeshStandardMaterial for `.color` access — the non-
// standard branch just gets transparency applied.
const applyVisual = (root: THREE.Object3D, visual: EasterEggVisual | undefined) => {
  if (!visual) return;
  const tint = visual.tint ? new THREE.Color(visual.tint) : null;
  const opacity = visual.opacity;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const cloned = mats.map((mat) => {
      const c = mat.clone();
      if (opacity !== undefined && opacity < 1) {
        c.transparent = true;
        c.opacity = opacity;
        c.depthWrite = false;
      }
      const std = c as THREE.MeshStandardMaterial;
      if (tint && std.color) std.color.multiply(tint);
      return c;
    });
    m.material = Array.isArray(m.material) ? cloned : cloned[0];
  });
};

// Build a renderable clone sized to def.targetSize. Skinned clones go
// through SkeletonUtils so their skeleton stays intact for animation;
// everything else uses a plain deep clone.
const buildInstance = (scene: THREE.Object3D, def: EasterEggDef) => {
  const skinned = def.visual?.skinned ?? false;
  const clone = skinned ? (cloneSkinned(scene) as THREE.Object3D) : scene.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = def.targetSize / maxDim;
  const minY = box.min.y;
  applyVisual(clone, def.visual);
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
  return { clone, scale, minY };
};

const EasterEggMesh = ({ egg, def }: { egg: EasterEgg; def: EasterEggDef }) => {
  const { scene, animations } = useGLTF(def.model);
  const clickEasterEgg = useGame((s) => s.clickEasterEgg);
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { clone, scale, minY } = useMemo(() => buildInstance(scene, def), [scene, def]);

  useEffect(() => {
    const clipName = def.visual?.clip;
    if (!clipName && animations.length === 0) return;
    const clip = findClip(animations, clipName) ?? animations[0] ?? null;
    if (!clip) return;
    const mixer = new THREE.AnimationMixer(clone);
    mixer.clipAction(clip).play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clone);
      mixerRef.current = null;
    };
  }, [clone, animations, def.visual?.clip]);

  useEffect(() => {
    if (!hovered) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [hovered]);

  // Outer group sits at ground level; the model is lifted by yModel so its
  // bottom lands on y=yOffset (negative = buried). The hit sphere sits in
  // outer-group space so it's always at a predictable world height,
  // regardless of how deep a buried egg goes.
  const yOffset = def.visual?.yOffset ?? 0;
  const yModel = yOffset - minY * scale;
  const hitRadius = Math.max(def.targetSize * 0.7, 0.9);
  const hitY = Math.max(def.targetSize * 0.5, 0.9);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    if (!groupRef.current || !egg.vel) return; // static eggs stay put
    groupRef.current.position.set(egg.pos.x, 0, -egg.pos.y);
    groupRef.current.rotation.y = egg.rotY;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    clickEasterEgg(egg.id);
  };

  return (
    <group
      ref={groupRef}
      position={[egg.pos.x, 0, -egg.pos.y]}
      rotation={[0, egg.rotY, 0]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <group position={[0, yModel, 0]} scale={scale}>
        <primitive object={clone} />
      </group>
      <mesh position={[0, hitY, 0]}>
        <sphereGeometry args={[hitRadius, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const EasterEggs = () => {
  const eggs = useGame((s) => s.world.easterEggs);
  if (eggs.length === 0) return null;
  return (
    <>
      {eggs.map((egg) => {
        const def = EASTER_EGG_BY_ID[egg.defId];
        if (!def) return null;
        return <EasterEggMesh key={egg.id} egg={egg} def={def} />;
      })}
    </>
  );
};

for (const url of PRELOAD_URLS) useGLTF.preload(url);
