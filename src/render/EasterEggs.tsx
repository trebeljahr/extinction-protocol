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

// Damped scale oscillation for click-pop. Real-time-driven (not gated by
// game time) so the squash plays even while paused, and using
// performance.now elsewhere keeps the decay linked to wall-clock seconds.
const POP_DURATION = 0.4;
const computePop = (elapsed: number, intensity: number): number => {
  if (intensity <= 0 || elapsed < 0 || elapsed > POP_DURATION) return 1;
  return 1 + intensity * Math.exp(-elapsed * 8) * Math.cos(elapsed * 28);
};

// Bell curve over the face-camera window: 0 → 1 (peak look-at) → 0 (home).
const FACE_CAMERA_DURATION = 1.2;

const EasterEggMesh = ({ egg, def }: { egg: EasterEgg; def: EasterEggDef }) => {
  const { scene, animations } = useGLTF(def.model);
  const clickEasterEgg = useGame((s) => s.clickEasterEgg);
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Click-feedback bookkeeping. The store mutates egg.clickCount in place
  // (the world reference doesn't change), so we detect new clicks by
  // diffing against the last value we saw and stamp performance.now()
  // for a real-time decay independent of paused world.time.
  const lastPopRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const prevClickCountRef = useRef<number>(0);
  const prevTriggeredRef = useRef<boolean>(false);
  const isUnlockPopRef = useRef<boolean>(false);

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

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);

    // Detect a new click via clickCount transition. If this same click
    // crossed the unlock threshold (`triggered` flipped true), amplify
    // the pop so the achievement moment lands harder than a regular tap.
    if (egg.clickCount !== prevClickCountRef.current) {
      const wasTriggered = prevTriggeredRef.current;
      prevClickCountRef.current = egg.clickCount;
      prevTriggeredRef.current = egg.triggered;
      lastPopRef.current = performance.now();
      isUnlockPopRef.current = egg.triggered && !wasTriggered;
    }

    const popElapsed = (performance.now() - lastPopRef.current) / 1000;
    const baseIntensity = def.reaction?.popIntensity ?? 0.25;
    const intensity = isUnlockPopRef.current ? baseIntensity * 1.6 : baseIntensity;
    const pop = computePop(popElapsed, intensity);

    // Apply pop to the visible (inner) group only — the outer hit sphere
    // keeps its constant radius so multi-click eggs don't have a moving
    // hitbox between taps. Forward tumble (barrel roll) lives here too.
    if (innerRef.current) {
      innerRef.current.scale.setScalar(scale * pop);
      innerRef.current.rotation.x = egg.rollPitch;
    }

    if (!groupRef.current) return;

    if (egg.vel) {
      // Moving eggs follow the sim every frame.
      groupRef.current.position.set(egg.pos.x, 0, -egg.pos.y);
      groupRef.current.rotation.y = egg.rotY;
    } else if (def.reaction?.faceCamera) {
      // Skinned static dinos arc to face the camera, then ease back.
      // The convention matches moving eggs: model "forward" at rotY=0
      // is -z_world, so the heading is atan2(dx_world, dy_game-delta).
      if (popElapsed >= 0 && popElapsed <= FACE_CAMERA_DURATION) {
        const cam = state.camera.position;
        const dxW = cam.x - egg.pos.x;
        const dyG = -cam.z - egg.pos.y;
        const targetRotY = Math.atan2(dxW, dyG);
        const home = egg.rotY;
        let rotDelta = targetRotY - home;
        while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
        while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
        const t = Math.sin((popElapsed / FACE_CAMERA_DURATION) * Math.PI);
        groupRef.current.rotation.y = home + rotDelta * t;
      } else {
        groupRef.current.rotation.y = egg.rotY;
      }
    }
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
      <group ref={innerRef} position={[0, yModel, 0]} scale={scale}>
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
