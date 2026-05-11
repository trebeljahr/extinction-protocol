import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

// Decorative-only background scene for the save-slot picker. Models are
// loaded directly via useGLTF/useMemo and posed statically so this file
// has zero coupling with the sim/store — the picker doesn't need any of
// the live world state and we don't want to spin up SimTicker just for
// a still-life.

const BG = "#0c1218";
const FOG = "#1a2230";
const HEMI_TOP = "#cfe0f4";
const HEMI_BOTTOM = "#5a4a30";

type ModelProps = {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  // Direct scale multiplier applied to the cloned scene root. Hand-tuned
  // per model since the kenney GLBs ship with internal armature scales
  // (100/200/300×) that confuse the obvious bbox-normalize math: the box
  // measures correctly but applying a normalizing scale on top doesn't
  // compose with the internal scales the way you'd expect under R3F's
  // primitive reconciliation. A direct multiplier is predictable and
  // costs nothing in maintenance — these are decorative, not gameplay.
  scale: number;
  // Sets the model so its baseline (lowest vertex) sits at position.y.
  // Default true — switch off when you want centred placement (cylindrical
  // props like a hovering drone).
  groundAlign?: boolean;
};

// Unanimated GLB. Caller passes a direct `scale` multiplier; we ground-align
// to position.y by computing the unscaled bounding box and offsetting by
// box.min.y * scale on the wrapping group.
const StaticModel = ({ url, position, rotationY = 0, scale, groundAlign = true }: ModelProps) => {
  const { scene } = useGLTF(url);

  // Compute baseline + center on the SHARED scene at scale=1, then we'll
  // multiply by our caller-supplied scale to convert to world units.
  const { baseY, centerXZ } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    return {
      baseY: groundAlign ? box.min.y : center.y,
      centerXZ: { x: center.x, z: center.z },
    };
  }, [scene, groundAlign]);

  const cloned = useMemo(() => {
    // Always use SkeletonUtils.clone — it handles both skinned and
    // non-skinned scenes correctly. For dinos in particular, the kenney
    // GLBs ship as SkinnedMesh + Skeleton; a plain `scene.clone(true)`
    // copies the SkinnedMesh node but leaves it pointing at the
    // original skeleton's bones, so applying scale to the clone root
    // has no visible effect (the bones still drive vertex positions
    // from the un-scaled originals).
    const c = cloneSkinned(scene);
    c.scale.setScalar(scale);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, scale]);

  return (
    <group
      position={[position[0], position[1] - baseY * scale, position[2]]}
      rotation={[0, rotationY, 0]}
    >
      <group position={[-centerXZ.x * scale, 0, -centerXZ.z * scale]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
};

// Skinned model with one looping animation clip. Same scaling pattern as
// StaticModel; the only addition is an AnimationMixer ticking the named
// clip every frame.
const AnimatedModel = ({
  url,
  position,
  rotationY = 0,
  scale,
  clipName = "Walk",
  timeScale = 1,
}: ModelProps & { clipName?: string; timeScale?: number }) => {
  const { scene, animations } = useGLTF(url);

  const { baseY, centerXZ } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    return { baseY: box.min.y, centerXZ: { x: center.x, z: center.z } };
  }, [scene]);

  const cloned = useMemo(() => {
    const c = cloneSkinned(scene);
    c.scale.setScalar(scale);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene, scale]);

  const mixer = useMemo(() => {
    const m = new THREE.AnimationMixer(cloned);
    const clip =
      animations.find((c) => c.name.toLowerCase().includes(clipName.toLowerCase())) ??
      animations[0] ??
      null;
    if (clip) {
      const action = m.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
      action.timeScale = timeScale;
      action.play();
    }
    return m;
  }, [cloned, animations, clipName, timeScale]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer],
  );
  useFrame((_, dt) => mixer.update(dt));

  return (
    <group
      position={[position[0], position[1] - baseY * scale, position[2]]}
      rotation={[0, rotationY, 0]}
    >
      <group position={[-centerXZ.x * scale, 0, -centerXZ.z * scale]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
};

export const SaveSlotsScene = () => (
  <>
    <color attach="background" args={[BG]} />
    <fog attach="fog" args={[FOG, 18, 44]} />

    <Environment preset="park" background={false} environmentIntensity={0.55} />

    <ambientLight intensity={0.6} color="#eaf2ff" />
    <directionalLight
      position={[8, 14, 6]}
      intensity={2.0}
      color="#fff4dc"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-18}
      shadow-camera-right={18}
      shadow-camera-top={18}
      shadow-camera-bottom={-18}
      shadow-bias={-0.0005}
    />
    <hemisphereLight args={[HEMI_TOP, HEMI_BOTTOM, 0.85]} />

    {/* Slow auto-orbit + drag-to-rotate. The user can grab the backdrop
        and spin the diorama; releasing resumes the gentle drift.
        autoRotateSpeed 0.4 ≈ the previous 0.04 rad/s manual spin
        (rad/s = 2π/60 × speed). */}
    <OrbitControls
      makeDefault
      enablePan={false}
      enableZoom
      minDistance={10}
      maxDistance={30}
      minPolarAngle={Math.PI * 0.15}
      maxPolarAngle={Math.PI * 0.5}
      autoRotate
      autoRotateSpeed={0.4}
      enableDamping
      dampingFactor={0.08}
    />

    {/* Soft dirt disc — bigger than the camera frustum so the fog
        absorbs the edge instead of revealing a hard horizon. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[60, 48]} />
      <meshStandardMaterial color="#3a3328" roughness={0.95} />
    </mesh>

    {/* Hero turret on a small raised pad, central. */}
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <cylinderGeometry args={[1.8, 2.0, 0.12, 24]} />
      <meshStandardMaterial color="#2a2f38" roughness={0.7} metalness={0.2} />
    </mesh>
    <StaticModel url="/models/turrets/Plasma Turret.glb" position={[0, 0.12, 0]} scale={0.8} />

    {/* Apatosaurus far-back-left, walking. Scale 0.18 → roughly 5m tall,
        big enough to read as a silhouette behind the slot card without
        stealing the eye from the tower. */}
    <AnimatedModel
      url="/models/Apatosaurus.glb"
      position={[-11, 0, -11]}
      rotationY={Math.PI * 0.45}
      scale={0.18}
      clipName="Walk"
      timeScale={0.55}
    />

    {/* Trex back-right, posed (no clip). */}
    <StaticModel
      url="/models/Trex.glb"
      position={[8, 0, -4]}
      rotationY={-Math.PI * 0.6}
      scale={0.12}
    />

    {/* Triceratops left, off-center so it doesn't block the tower. */}
    <StaticModel
      url="/models/Triceratops.glb"
      position={[-6.5, 0, 0.5]}
      rotationY={Math.PI * 0.7}
      scale={0.1}
    />

    {/* Stegosaurus right-foreground for variety. */}
    <StaticModel
      url="/models/Stegosaurus.glb"
      position={[5, 0, 4]}
      rotationY={-Math.PI * 0.25}
      scale={0.08}
    />

    {/* Tree ring softens the perimeter and gives parallax depth. */}
    <StaticModel url="/models/nature/Tree2.glb" position={[-13, 0, 1]} scale={0.7} />
    <StaticModel
      url="/models/nature/Tree1.glb"
      position={[12, 0, 2]}
      rotationY={0.4}
      scale={0.95}
    />
    <StaticModel
      url="/models/nature/Tree2.glb"
      position={[2, 0, -11]}
      rotationY={1.1}
      scale={0.75}
    />
    <StaticModel
      url="/models/nature/Tree4.glb"
      position={[-4, 0, -12]}
      rotationY={-0.6}
      scale={0.5}
    />
    <StaticModel url="/models/nature/Tree1.glb" position={[10, 0, 8]} rotationY={2.2} scale={0.8} />
    <StaticModel
      url="/models/nature/Tree4.glb"
      position={[-9.5, 0, 8]}
      rotationY={-1.4}
      scale={0.85}
    />
    <StaticModel
      url="/models/nature/Tree4.glb"
      position={[15, 0, -3]}
      rotationY={0.9}
      scale={0.45}
    />

    {/* A few rocks to break up the dirt. Scale 0.35 ≈ 0.9m tall. */}
    <StaticModel
      url="/models/nature/Rock1.glb"
      position={[2.5, 0, 5.5]}
      rotationY={0.8}
      scale={0.35}
    />
    <StaticModel
      url="/models/nature/Rock2.glb"
      position={[-3, 0, -4]}
      rotationY={-0.5}
      scale={0.4}
    />
    <StaticModel
      url="/models/nature/Rock3.glb"
      position={[-7, 0, 4]}
      rotationY={1.2}
      scale={0.35}
    />
  </>
);

useGLTF.preload("/models/turrets/Plasma Turret.glb");
useGLTF.preload("/models/Apatosaurus.glb");
useGLTF.preload("/models/Trex.glb");
useGLTF.preload("/models/Triceratops.glb");
useGLTF.preload("/models/Stegosaurus.glb");
useGLTF.preload("/models/nature/Tree1.glb");
useGLTF.preload("/models/nature/Tree2.glb");
useGLTF.preload("/models/nature/Tree4.glb");
useGLTF.preload("/models/nature/Rock1.glb");
useGLTF.preload("/models/nature/Rock2.glb");
useGLTF.preload("/models/nature/Rock3.glb");
