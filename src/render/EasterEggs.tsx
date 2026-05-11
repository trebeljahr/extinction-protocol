import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  type ChimneyOffset,
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
  return { clone, scale, minY, minX: box.min.x };
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

// Pre-allocated quaternions for barrel roll (tumble-mode eggs). The barrel
// tips 90° around Z so its long axis lies horizontal, then spins about
// that axis (-X after tipping) each frame.
const _barrelTipQ = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  Math.PI / 2,
);
const _rollQ = new THREE.Quaternion();
const _rollAxis = new THREE.Vector3(-1, 0, 0);

// Smoke column rising from a chimney. Mounted only after the cabin has
// been clicked at least once. Each particle is an instanced sphere that
// spawns at the chimney top, drifts up and slightly outward, billows in
// scale as it rises, and shrinks to nothing at end of life. Repeat clicks
// (tracked through `clickCount`) refresh a handful of stale slots so the
// column visibly thickens with a fresh puff for a moment.
//
// Coordinates are in the outer egg group's local space, so the offset
// rotates with egg.rotY (chimney stays attached to its corner of the
// roof) but smoke still rises along world Y because rotation is around
// the Y axis.
const SMOKE_PARTICLE_COUNT = 22;

type SmokeParticle = {
  age: number;
  life: number;
  offX: number;
  offY: number;
  offZ: number;
  velX: number;
  velY: number;
  velZ: number;
  baseScale: number;
};

const respawnSmoke = (p: SmokeParticle, fresh: boolean) => {
  p.age = 0;
  p.life = 2.0 + Math.random() * 0.8;
  p.offX = (Math.random() - 0.5) * 0.08;
  p.offZ = (Math.random() - 0.5) * 0.08;
  p.offY = 0;
  const ang = Math.random() * Math.PI * 2;
  const drift = 0.22 + Math.random() * 0.18;
  p.velX = Math.cos(ang) * drift;
  p.velZ = Math.sin(ang) * drift;
  // Click-driven respawns are slightly faster and bigger so each click
  // reads as a visible puff against the steady column.
  p.velY = (fresh ? 1.4 : 0.95) + Math.random() * 0.5;
  p.baseScale = fresh ? 0.45 : 0.32;
};

const ChimneySmokeColumn = ({
  egg,
  chimney,
}: {
  egg: EasterEgg;
  chimney: { x: number; y: number; z: number };
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  // Initialise to the current click count rather than 0 — without this,
  // a cabin that was already clicked (e.g. via load-of-progress someday)
  // would burst on first frame.
  const lastClickRef = useRef(egg.clickCount);
  const particlesRef = useRef<SmokeParticle[] | null>(null);
  if (particlesRef.current === null) {
    const arr: SmokeParticle[] = [];
    // Each slot is initialised through respawnSmoke so it gets non-zero
    // velocities from the start; a plain `velY: 0` init would leave the
    // first generation of particles stuck at the chimney until they hit
    // `age > life` and respawned naturally (~2.6s in).
    //
    // Negative starting ages then stagger the column build-up so it
    // emerges gradually over the first ~2s rather than popping in.
    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      const p: SmokeParticle = {
        age: 0,
        life: 0,
        offX: 0,
        offY: 0,
        offZ: 0,
        velX: 0,
        velY: 0,
        velZ: 0,
        baseScale: 0.12,
      };
      respawnSmoke(p, false);
      p.age = -i * 0.11;
      arr.push(p);
    }
    particlesRef.current = arr;
  }

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    const ps = particlesRef.current;
    if (!mesh || !ps) return;

    // No clicks yet → nothing to render. Mounted unconditionally so we
    // notice the very first click even when it doesn't change React
    // state (e.g. on a re-run where the achievement was already unlocked,
    // the click handler ends with `set({})` and never re-renders).
    if (egg.clickCount === 0) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    // The store mutates egg.clickCount in place and then sometimes calls
    // `set({})`, which doesn't trigger a React re-render — so we can't
    // rely on a useEffect on a prop to detect repeat clicks. Read the
    // live value here each frame and compare against a ref instead.
    if (egg.clickCount > lastClickRef.current) {
      lastClickRef.current = egg.clickCount;
      // Refresh the 4 oldest slots as a fresh, slightly faster puff so
      // the column visibly thickens on each click.
      const sorted = ps.map((p, i) => ({ p, i, age: p.age })).sort((a, b) => b.age - a.age);
      for (let i = 0; i < 4 && i < sorted.length; i++) {
        respawnSmoke(sorted[i].p, true);
      }
    }

    const step = Math.min(dt, 0.05);
    let n = 0;
    for (const p of ps) {
      p.age += step;
      if (p.age < 0) continue;
      if (p.age > p.life) {
        respawnSmoke(p, false);
      }
      // Kinematics: gentle horizontal drift, slow vertical damping.
      p.offX += p.velX * step;
      p.offY += p.velY * step;
      p.offZ += p.velZ * step;
      p.velX *= 1 - 0.45 * step;
      p.velZ *= 1 - 0.45 * step;
      p.velY *= 1 - 0.04 * step;

      const t = Math.min(1, p.age / p.life);
      const grow = p.baseScale + t * 0.55;
      // Hold full size most of life, then taper to zero in the last 30%
      // so dying particles vanish instead of popping out.
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const scale = grow * fade;
      if (scale <= 0.001) continue;

      dummy.position.set(chimney.x + p.offX, chimney.y + p.offY, chimney.z + p.offZ);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(0, t * Math.PI, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);

      // Wood-fire smoke: dark grey at the chimney, lifting toward the
      // bright snow background as it disperses. Without enough contrast
      // up front the column blends invisibly into the white ground.
      const r = 0.18 + t * 0.42;
      const g = 0.2 + t * 0.42;
      const b = 0.24 + t * 0.42;
      tmpColor.setRGB(r, g, b);
      mesh.setColorAt(n, tmpColor);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SMOKE_PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
};

const chimneyLocal = (
  offset: ChimneyOffset,
  scale: number,
  yModel: number,
): { x: number; y: number; z: number } => ({
  x: offset.x * scale,
  y: yModel + offset.y * scale,
  z: offset.z * scale,
});

// Eggs must out-priority every other clickable (dinos, rocks, trees, the
// placement plane) even when they sit *behind* one in screen space. R3F
// dispatches pointer events in ascending intersection.distance order and
// honors stopPropagation, so the front-most hit normally wins. We run the
// real sphere intersection, then subtract a large constant from the
// reported distance — eggs sort to the front of the merged hit list while
// preserving relative order between two overlapping eggs.
const EGG_PRIORITY_OFFSET = 1000;
const eggPriorityRaycast: THREE.Mesh["raycast"] = function (
  this: THREE.Mesh,
  raycaster,
  intersects,
) {
  const before = intersects.length;
  THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
  for (let i = before; i < intersects.length; i++) {
    intersects[i].distance -= EGG_PRIORITY_OFFSET;
  }
};

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

  const { clone, scale, minY, minX } = useMemo(() => buildInstance(scene, def), [scene, def]);
  const rollLift = Math.max(-minX, 0) * scale;

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
    if (useGame.getState().world.status === "running") mixerRef.current?.update(delta);

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
    // hitbox between taps. Axial barrel-roll rotation lives here too.
    if (innerRef.current) {
      innerRef.current.scale.setScalar(scale * pop);
      if (egg.vel != null && def.clickRoll?.tumble) {
        innerRef.current.position.y = rollLift;
        _rollQ.setFromAxisAngle(_rollAxis, egg.rollPitch);
        innerRef.current.quaternion.multiplyQuaternions(_rollQ, _barrelTipQ);
      } else {
        innerRef.current.rotation.set(egg.rollPitch, 0, 0);
      }
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
      {def.chimneyOffset ? (
        <ChimneySmokeColumn egg={egg} chimney={chimneyLocal(def.chimneyOffset, scale, yModel)} />
      ) : null}
      <mesh position={[0, hitY, 0]} raycast={eggPriorityRaycast}>
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
