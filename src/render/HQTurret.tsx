import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import { measureVisibleBox } from "./measureModel";

// The Plasma Turret is the hero model from the title-screen diorama. It
// doesn't appear as a buildable in gameplay; instead one instance per path
// endpoint stands in for the player's HQ — that's where enemy leaks land,
// and that's what the player is defending. When `world.lives` decreases the
// HQ flashes red; when lives hit zero it tilts forward, sinks, and a bright
// shell flash plays before the results screen takes over.
//
// The sim loop stops ticking on loss (see CameraRig.tsx and spawner.ts), so
// `world.time` and the existing explosion/particle systems freeze the instant
// the game ends. The death sequence is therefore driven entirely from
// performance.now() inside useFrame — same pattern as the loss-rumble in
// CameraRig.

const HQ_URL = "/models/turrets/Plasma Turret.glb";
const HQ_TARGET_SIZE = 1.9;

// Render-side timings. Death duration must stay just under the pre-results
// screen delay in store.ts so the explosion completes before the overlay
// covers the world.
const FLASH_DURATION = 0.45;
const DEATH_DURATION = 1.1;
const EXPLOSION_DURATION = 0.7;
const SHOCKWAVE_DURATION = 0.85;

type Pose = {
  position: [number, number];
  yaw: number;
  pathIndex: number;
};

// Inner ref-driven HQ. Wraps the cloned model in an outer group so we can
// mutate transform every frame without round-tripping through React state.
const HQOne = ({ pose }: { pose: Pose }) => {
  const { scene } = useGLTF(HQ_URL);
  const outerRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const coreFlashRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);

  // Bind-pose-accurate baseline: same `measureVisibleBox` we use for every
  // other model so the HQ's feet sit on y=0 instead of floating where the
  // raw geometry bbox extends.
  const { scaledClone, baseY } = useMemo(() => {
    const s =
      HQ_TARGET_SIZE /
      Math.max(...measureVisibleBox(scene).getSize(new THREE.Vector3()).toArray(), 0.001);
    const c = scene.clone(true);
    c.scale.setScalar(s);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Per-instance materials so the damage-flash emissive on one HQ
      // doesn't leak across the others. Side-effect on the cached scene
      // would otherwise tint every HQ that shares the model.
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mm) => mm.clone());
      } else if (m.material) {
        m.material = (m.material as THREE.Material).clone();
      }
    });
    const groundedBox = measureVisibleBox(c);
    return { scaledClone: c, baseY: -groundedBox.min.y };
  }, [scene]);

  // Live event tracking — we read these inside useFrame rather than via
  // selectors so the component never re-mounts between waves.
  const flashUntilRef = useRef(0);
  const lostStartRef = useRef<number | null>(null);

  // Per-HQ flash: subscribe to life-lost events and trigger only when the
  // leak came down THIS HQ's path. Watching `world.lives` directly would
  // flash every HQ on the map since lives is a single global counter.
  useEffect(() => {
    const unsub = useGame.getState().onEvent((ev) => {
      if (ev.type !== "life-lost") return;
      if (ev.pathIndex !== pose.pathIndex) return;
      if (useGame.getState().world.status === "lost") return;
      flashUntilRef.current = performance.now() / 1000 + FLASH_DURATION;
    });
    return unsub;
  }, [pose.pathIndex]);

  useFrame(() => {
    const outer = outerRef.current;
    const tilt = tiltRef.current;
    const flash = flashRef.current;
    if (!outer || !tilt) return;

    const { world } = useGame.getState();
    const now = performance.now() / 1000;

    // Stateless detection — covers normal play (running → lost) and HMR
    // remounts that drop us straight into a "lost" world. As long as the
    // ref is reset when we leave the loss state we'll start the timer
    // fresh on the next entry.
    if (world.status === "lost") {
      if (lostStartRef.current === null) lostStartRef.current = now;
    } else {
      lostStartRef.current = null;
    }

    const lostAt = lostStartRef.current;
    const deathT = lostAt === null ? 0 : Math.min(1, (now - lostAt) / DEATH_DURATION);
    const deathEase = 1 - (1 - deathT) ** 3;

    // Base placement — set every frame so the death shake can perturb it.
    outer.position.set(pose.position[0], baseY, -pose.position[1]);
    outer.rotation.set(0, pose.yaw, 0);

    if (lostAt !== null) {
      // Tilt forward toward the path, sink into the ground. The "forward"
      // direction in the model's local space after yaw rotation is +z;
      // rotating around X tips the cannons down. We push past 90° for the
      // final fifth of the anim so the model visibly faceplants.
      tilt.rotation.set(deathEase * 1.1, 0, deathEase * 0.25);
      tilt.position.y = -deathEase * 0.6;
      // Rumble that decays as the model settles. Stronger early so the
      // initial hit reads as a real impact, not a gentle slump.
      const rumble = (1 - deathEase) ** 2 * 0.18;
      outer.position.x += (Math.random() - 0.5) * rumble;
      outer.position.z += (Math.random() - 0.5) * rumble;
    } else {
      tilt.rotation.set(0, 0, 0);
      tilt.position.y = 0;
    }

    // Layered death explosion: an inner white-hot core, an outer fireball,
    // and a flat ground shockwave ring radiating from the HQ base. Each
    // peaks at a slightly different time so the eye registers a real bang
    // rather than a single dim glow.
    const explosionAlive = lostAt !== null && now - lostAt < EXPLOSION_DURATION;
    const shockwaveAlive = lostAt !== null && now - lostAt < SHOCKWAVE_DURATION;

    if (flash) {
      flash.visible = explosionAlive;
      if (explosionAlive) {
        const t = (now - (lostAt as number)) / EXPLOSION_DURATION;
        flash.scale.setScalar(0.6 + t * 4.6);
        const mat = flash.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - t) ** 1.4 * 0.9;
      }
    }
    if (coreFlashRef.current) {
      const core = coreFlashRef.current;
      const coreLife = 0.22;
      const coreAlive = lostAt !== null && now - lostAt < coreLife;
      core.visible = coreAlive;
      if (coreAlive) {
        const t = (now - (lostAt as number)) / coreLife;
        core.scale.setScalar(0.4 + t * 2.6);
        const mat = core.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - t) * 1.0;
      }
    }
    if (shockwaveRef.current) {
      const sw = shockwaveRef.current;
      sw.visible = shockwaveAlive;
      if (shockwaveAlive) {
        const t = (now - (lostAt as number)) / SHOCKWAVE_DURATION;
        sw.scale.setScalar(0.4 + t * 6.5);
        const mat = sw.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - t) ** 1.2 * 0.7;
      }
    }

    // Damage emissive flash on all materials.
    const flashAge = flashUntilRef.current - now;
    const flashLevel = Math.max(0, Math.min(1, flashAge / FLASH_DURATION));
    const emissiveR = flashLevel * 1.1;
    const emissiveG = flashLevel * 0.25;
    const emissiveB = flashLevel * 0.15;
    scaledClone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const apply = (mm: THREE.MeshStandardMaterial) => {
        if (!mm.emissive) return;
        mm.emissive.setRGB(emissiveR, emissiveG, emissiveB);
      };
      if (Array.isArray(mat)) mat.forEach(apply);
      else if (mat) apply(mat);
    });
  });

  return (
    <group ref={outerRef}>
      <group ref={tiltRef}>
        <primitive object={scaledClone} />
      </group>
      {/* Death explosion: warm outer fireball + white-hot inner core.
          Hidden during regular play; ref-driven scaling/opacity during the
          loss cinematic. Both depth-write off so they layer cleanly over
          the tilting HQ behind them. */}
      <mesh ref={flashRef} visible={false} position={[0, HQ_TARGET_SIZE * 0.45, 0]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial
          color="#ff9b3a"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreFlashRef} visible={false} position={[0, HQ_TARGET_SIZE * 0.45, 0]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#fff4d6"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Flat ground shockwave — a wide ring on the floor that races
          outward. Anchored to y=0.05 in world space (independent of the
          tilt group) so it stays on the ground even as the HQ topples. */}
      <mesh
        ref={shockwaveRef}
        visible={false}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.45, 0.6, 48]} />
        <meshBasicMaterial
          color="#ffd07a"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// One HQ per path endpoint — multi-path levels get multiple HQs (mirrors
// the existing end-ring marker semantics). Faces back along the path so
// the cannons point at incoming enemies.
export const HQTurrets = () => {
  const paths = useGame((s) => s.world.paths);
  const poses = useMemo<Pose[]>(() => {
    const out: Pose[] = [];
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (path.length < 2) continue;
      const last = path[path.length - 1];
      const prev = path[path.length - 2];
      // Enemies travel toward `last`; the HQ should face the opposite way
      // so its cannons aim at the approaching column. Three.js convention:
      // yaw=0 faces -z, and sim y maps to -z (see ModelEnemyMesh.tsx:253).
      const incomingX = prev.x - last.x;
      const incomingY = prev.y - last.y;
      const yaw = Math.atan2(incomingX, -incomingY);
      out.push({ position: [last.x, last.y], yaw, pathIndex: i });
    }
    return out;
  }, [paths]);

  if (poses.length === 0) return null;
  return (
    <>
      {poses.map((pose) => (
        <HQOne key={pose.pathIndex} pose={pose} />
      ))}
    </>
  );
};

useGLTF.preload(HQ_URL);
