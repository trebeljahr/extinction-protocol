import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { buildPlusTexture } from "../render/RegenBadges";
import type { MechanicId } from "../sim/mechanicsText";
import type { EnemyKind } from "../sim/types";
import { ELITE_TINT_BY_KIND, ENEMY_MODEL, HEAL_AURA_RANGE } from "../sim/world";

// Preview-only single-instance copies of the in-world effect renderers
// (ShieldBubbles / HealAuras / RegenBadges / FierceHalos / model frost +
// elite tint from ModelEnemyMesh). The instanced versions read from the
// live world store, which we don't want to fake out for a static
// preview — but the geometries, materials, colors and pulse math are
// intentionally identical so the player sees the same visual in the
// compendium that they get in-game.

// === Visual constants ===
// Mirrored from src/render/{ShieldBubbles,HealAuras,FierceHalos}.tsx
// and src/render/ModelEnemyMesh.tsx. Duplicated rather than re-
// exported because the in-world files keep them as module-locals; one
// number per effect is cheaper than a refactor that bloats the public
// surface of the render layer.
const SHIELD_COLOR = "#7fc8ff";
const HEAL_AURA_COLOR = "#7eff8a";
const FIERCE_COLOR = "#ff3a30";
const FROST_COLOR = new THREE.Color("#cfe6ff");
const FROST_EMISSIVE = new THREE.Color("#3a6aa0");
const ELITE_TINT_AMOUNT = 0.55;
const ELITE_EMISSIVE_AMOUNT = 0.35;

// Mirrors SHIELD_RADIUS_BY_KIND in ShieldBubbles.tsx.
const SHIELD_RADIUS_BY_KIND: Record<EnemyKind, number> = {
  raptor: 0.7,
  swarm: 0.45,
  para: 0.85,
  allosaur: 1.0,
  stego: 1.0,
  armored: 1.05,
  titan: 3.0,
  boss: 5.0,
};

// One representative dino per mechanic — silhouette chosen so the
// effect reads obviously (a Triceratops shield bubble is unambiguous;
// a T-Rex with a fierce halo screams "this one bites harder").
const PREVIEW_KIND: Record<MechanicId, EnemyKind> = {
  shielded: "armored",
  healAura: "para",
  regen: "stego",
  elite: "raptor",
  fierce: "allosaur",
  slow: "raptor",
  resists: "armored",
};

const findClip = (clips: THREE.AnimationClip[], needle: string) =>
  clips.find((c) => c.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

const cloneAndCaptureBase = (mat: THREE.Material): THREE.Material => {
  const c = mat.clone();
  const std = c as THREE.MeshStandardMaterial;
  if (std.color) std.userData.baseColor = std.color.clone();
  return c;
};

// === Creature ===
// Same scale-fit + animation playback as EnemyPreview, but applies the
// elite or frost tint from ModelEnemyMesh when the mechanic is "elite"
// or "slow". Materials are cloned per-mesh so this preview Canvas
// can't bleed material state into the main PlayScene renderer.
const MechanicCreature = ({ kind, effect }: { kind: EnemyKind; effect: MechanicId }) => {
  const cfg = ENEMY_MODEL[kind];
  const gltf = useGLTF(cfg.url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const eliteTint = useMemo(() => new THREE.Color(ELITE_TINT_BY_KIND[kind]), [kind]);

  const obj = useMemo(() => {
    // Measure on the original gltf scene (not the clone). The clone
    // returned by SkeletonUtils.clone() has bones whose world matrices
    // haven't propagated yet, which makes Box3.setFromObject return a
    // wildly inflated bbox (3000+ units instead of ~2 — the model
    // ends up rendered ~1000× too small and effectively invisible).
    // The play scene's ModelEnemyMesh deliberately measures `scene`
    // for the same reason — so we mirror it here.
    const measureBox = new THREE.Box3().setFromObject(gltf.scene);
    const size = measureBox.getSize(new THREE.Vector3());
    const center = measureBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = cfg.targetSize / maxDim;
    const cloned = cloneSkinned(gltf.scene);
    cloned.scale.setScalar(s);
    cloned.position.set(-center.x * s, -measureBox.min.y * s, -center.z * s);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mm) => cloneAndCaptureBase(mm));
      } else if (m.material) {
        m.material = cloneAndCaptureBase(m.material as THREE.Material);
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

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    // Frost = full chill (1.0) for the slow preview so the dino reads
    // unambiguously frozen-blue. Elite stamps the kind-tint onto the
    // base color. Reset when neither effect applies so re-entering this
    // creature for a different mechanic restores the original palette.
    const frost = effect === "slow" ? 1 : 0;
    const isElite = effect === "elite";
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const apply = (mm: THREE.MeshStandardMaterial) => {
        const base = mm.userData.baseColor as THREE.Color | undefined;
        if (base && mm.color) {
          if (frost > 0.01) mm.color.copy(base).lerp(FROST_COLOR, frost);
          else if (isElite) mm.color.copy(base).lerp(eliteTint, ELITE_TINT_AMOUNT);
          else mm.color.copy(base);
        }
        if (!mm.emissive) return;
        if (frost > 0.05) mm.emissive.copy(FROST_EMISSIVE).multiplyScalar(frost * 0.5);
        else if (isElite) mm.emissive.copy(eliteTint).multiplyScalar(ELITE_EMISSIVE_AMOUNT);
        else mm.emissive.setRGB(0, 0, 0);
      };
      if (Array.isArray(mat)) mat.forEach(apply);
      else apply(mat as THREE.MeshStandardMaterial);
    });
  });

  return <primitive object={obj} />;
};

// === Effects ===

const ShieldEffect = ({ kind }: { kind: EnemyKind }) => {
  const radius = SHIELD_RADIUS_BY_KIND[kind];
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 2.5) * 0.025;
    m.scale.setScalar(radius * pulse);
    m.rotation.y = t * 0.3;
  });
  return (
    <mesh ref={ref} position={[0, radius * 0.6, 0]} renderOrder={5}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={SHIELD_COLOR}
        transparent
        opacity={0.32}
        depthWrite={false}
        wireframe
        toneMapped={false}
      />
    </mesh>
  );
};

const HealAuraEffect = () => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.6) * 0.05;
    g.scale.set(pulse, pulse, 1);
  });
  return (
    <group ref={groupRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[HEAL_AURA_RANGE, 48]} />
        <meshBasicMaterial
          color={HEAL_AURA_COLOR}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[HEAL_AURA_RANGE * 0.94, HEAL_AURA_RANGE, 64]} />
        <meshBasicMaterial
          color={HEAL_AURA_COLOR}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

const RegenBadgeEffect = ({ kind }: { kind: EnemyKind }) => {
  const cfg = ENEMY_MODEL[kind];
  const ref = useRef<THREE.Mesh>(null);
  // Re-uses the same texture builder the in-game RegenBadges use, so a
  // fix to the cross drawing improves both at once.
  const tex = useMemo(buildPlusTexture, []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const camDir = new THREE.Vector3();
    state.camera.getWorldDirection(camDir);
    const yaw = Math.atan2(-camDir.x, -camDir.z);
    const bob = Math.sin(t * 2.6) * 0.06;
    const pulse = 0.95 + 0.12 * Math.sin(t * 4);
    m.position.set(0, cfg.targetSize * 1.15 + bob, 0);
    m.rotation.set(0, yaw, 0);
    m.scale.set(pulse, pulse, 1);
  });
  return (
    <mesh ref={ref} renderOrder={6}>
      <planeGeometry args={[1.4, 1.4]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// In-game the fierce halo is a backside additive sphere — at gameplay
// camera distance (~15 units) it reads as a soft red rim around the
// silhouette. The compendium camera is much closer (~5 units) and the
// dark preview background pushes additive blending toward "solid
// brown sphere," so the preview uses a tighter outer halo + a brighter
// edge ring + glowing eyes to convey "berserker" without the volumetric
// brown-out.
const FierceHaloEffect = ({ kind }: { kind: EnemyKind }) => {
  const cfg = ENEMY_MODEL[kind];
  const groupRef = useRef<THREE.Group>(null);
  // Tight silhouette halo, fully above ground.
  const halo = cfg.targetSize * 0.5;
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 2.0) * 0.06;
    g.scale.setScalar(pulse);
  });
  return (
    <group ref={groupRef} position={[0, halo * 1.1, 0]}>
      {/* Soft outer haze — backside additive so it tints the rim only
          where the sphere is at grazing angle, leaving the silhouette
          clean rather than washing it brown. */}
      <mesh renderOrder={4}>
        <sphereGeometry args={[halo * 1.05, 24, 16]} />
        <meshBasicMaterial
          color={FIERCE_COLOR}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* Bright thin shell. Pushes the rim harder so the halo reads as
          a "this one is dangerous" outline at preview distance. */}
      <mesh renderOrder={4}>
        <sphereGeometry args={[halo * 1.18, 24, 16]} />
        <meshBasicMaterial
          color={FIERCE_COLOR}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

// "0×" plate above the dino — the same idea as the regen badge but
// with a different glyph + warmer tint so it reads as immunity rather
// than healing.
const buildResistsTexture = (): THREE.CanvasTexture => {
  const W = 192;
  const H = 96;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.clearRect(0, 0, W, H);
  // Soft amber halo behind the text so it pops against the ground.
  const grd = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 80);
  grd.addColorStop(0, "rgba(255, 178, 102, 0.55)");
  grd.addColorStop(1, "rgba(255, 178, 102, 0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  ctx.font = "bold 64px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#5a2d05";
  ctx.strokeText("0×", W / 2, H / 2 + 2);
  ctx.fillStyle = "#ffd9a8";
  ctx.fillText("0×", W / 2, H / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const ResistsBadgeEffect = ({ kind }: { kind: EnemyKind }) => {
  const cfg = ENEMY_MODEL[kind];
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(buildResistsTexture, []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const camDir = new THREE.Vector3();
    state.camera.getWorldDirection(camDir);
    const yaw = Math.atan2(-camDir.x, -camDir.z);
    const bob = Math.sin(t * 2.0) * 0.06;
    const pulse = 0.95 + 0.06 * Math.sin(t * 3);
    m.position.set(0, cfg.targetSize * 1.15 + bob, 0);
    m.rotation.set(0, yaw, 0);
    m.scale.set(pulse * 1.6, pulse * 0.9, 1);
  });
  return (
    <mesh ref={ref} renderOrder={6}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// === Public component ===

type Props = {
  id: MechanicId;
  size?: number;
};

export const MechanicPreview = ({ id, size = 360 }: Props) => {
  const kind = PREVIEW_KIND[id];
  const span = ENEMY_MODEL[kind].targetSize + 0.4;
  const target: [number, number, number] = [0, span * 0.4, 0];
  return (
    <div className="mechanic-preview" style={{ width: size, height: size }}>
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

        <Environment
          files="/hdri/rooitou_park_1k.hdr"
          background={false}
          environmentIntensity={0.6}
        />
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

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[span * 2.5, 56]} />
          <meshStandardMaterial color="#4a4438" roughness={0.98} metalness={0} />
        </mesh>

        <Suspense fallback={null}>
          <MechanicCreature kind={kind} effect={id} />
        </Suspense>

        {id === "shielded" && <ShieldEffect kind={kind} />}
        {id === "healAura" && <HealAuraEffect />}
        {id === "regen" && <RegenBadgeEffect kind={kind} />}
        {id === "fierce" && <FierceHaloEffect kind={kind} />}
        {id === "resists" && <ResistsBadgeEffect kind={kind} />}
        {/* "elite" + "slow" tint the creature itself; no overlay mesh. */}

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
