import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ROBOT_SPECS } from "../sim/robotVariants";
import { useGame } from "../store";

// In-world robot markers: pulsing range ring, move-target ping,
// translucent ground footprint, death explosion shockwave, and the
// pre-dash directional arrow (every robot variant has a dash). Cheap
// (a handful of meshes), updated by useFrame.
const ROBOT_DEATH_DURATION = 0.85;
const ROBOT_DEATH_EXPLOSION_DURATION = 0.7;
const ROBOT_DEATH_CORE_DURATION = 0.22;

export const RobotHud = () => {
  const variant = useGame((s) => s.world.robot.variant);
  const tint = ROBOT_SPECS[variant].tint;
  const ringRef = useRef<THREE.Mesh>(null);
  const footRef = useRef<THREE.Mesh>(null);
  const moveRef = useRef<THREE.Mesh>(null);

  const ringGeom = useMemo(() => new THREE.RingGeometry(0.95, 1.08, 48), []);
  const footGeom = useMemo(() => new THREE.CircleGeometry(0.85, 36), []);
  const moveGeom = useMemo(() => new THREE.RingGeometry(0.4, 0.55, 32), []);
  const selGeom = useMemo(() => new THREE.RingGeometry(1.1, 1.32, 48), []);
  const selRef = useRef<THREE.Mesh>(null);
  // Dash-aim arrow assembled from a thin shaft + triangular head; both
  // ride a parent group so we can rotate/position once per frame.
  const aimGroupRef = useRef<THREE.Group>(null);
  const aimShaftGeom = useMemo(() => new THREE.PlaneGeometry(2.6, 0.16), []);
  const aimHeadGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([0, 0, 0.32, -0.32, 0, -0.18, -0.32, 0, 0.18]);
    g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  // Death shockwave + flash — mirrors the HQ explosion sequence so a
  // robot wipe feels equally violent.
  const deathFlashRef = useRef<THREE.Mesh>(null);
  const deathCoreRef = useRef<THREE.Mesh>(null);
  const deathShockRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { world } = useGame.getState();
    const robot = world.robot;
    if (!ringRef.current || !footRef.current || !moveRef.current || !selRef.current) return;
    const visible = robot.alive;
    ringRef.current.visible = visible;
    footRef.current.visible = visible;
    if (visible) {
      const pulse = 1 + Math.sin(world.time * 3.6) * 0.04;
      ringRef.current.position.set(robot.pos.x, 0.05, -robot.pos.y);
      ringRef.current.scale.setScalar(pulse);
      footRef.current.position.set(robot.pos.x, 0.045, -robot.pos.y);
    }
    if (robot.moveTarget) {
      moveRef.current.visible = true;
      moveRef.current.position.set(robot.moveTarget.x, 0.06, -robot.moveTarget.y);
      const spin = world.time * 2.6;
      moveRef.current.rotation.set(-Math.PI / 2, 0, spin);
    } else {
      moveRef.current.visible = false;
    }
    if (robot.selected && robot.alive) {
      selRef.current.visible = true;
      selRef.current.position.set(robot.pos.x, 0.06, -robot.pos.y);
      const pulse = 1 + Math.sin(world.time * 5.2) * 0.07;
      selRef.current.scale.setScalar(pulse);
    } else {
      selRef.current.visible = false;
    }
    // Dash aim arrow (armed dash, any variant). Sin-pulsed scale +
    // opacity sells the "armed and waiting" read while the cursor
    // steers the dir.
    const aim = aimGroupRef.current;
    if (aim) {
      if (robot.alive && robot.dashAim) {
        aim.visible = true;
        const dir = robot.dashAim.dir;
        const yaw = Math.atan2(dir.x, -dir.y);
        aim.position.set(robot.pos.x, 0.08, -robot.pos.y);
        aim.rotation.set(0, yaw, 0);
        const pulse = 0.92 + Math.sin(world.time * 8) * 0.08;
        aim.scale.setScalar(pulse);
      } else {
        aim.visible = false;
      }
    }
    // Death shockwave/core/flash — visible for ROBOT_DEATH_DURATION
    // after lastDeathAt, identical pattern to the HQ death cinematic.
    const flash = deathFlashRef.current;
    const core = deathCoreRef.current;
    const shock = deathShockRef.current;
    if (flash && core && shock) {
      const elapsed = world.time - robot.lastDeathAt;
      const explosionAlive = elapsed >= 0 && elapsed < ROBOT_DEATH_EXPLOSION_DURATION;
      const coreAlive = elapsed >= 0 && elapsed < ROBOT_DEATH_CORE_DURATION;
      const shockAlive = elapsed >= 0 && elapsed < ROBOT_DEATH_DURATION;
      flash.visible = explosionAlive;
      core.visible = coreAlive;
      shock.visible = shockAlive;
      if (explosionAlive) {
        const t = elapsed / ROBOT_DEATH_EXPLOSION_DURATION;
        flash.position.set(robot.pos.x, 0.6, -robot.pos.y);
        flash.scale.setScalar(0.5 + t * 3.5);
        (flash.material as THREE.MeshBasicMaterial).opacity = (1 - t) ** 1.4 * 0.85;
      }
      if (coreAlive) {
        const t = elapsed / ROBOT_DEATH_CORE_DURATION;
        core.position.set(robot.pos.x, 0.6, -robot.pos.y);
        core.scale.setScalar(0.35 + t * 2.0);
        (core.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      }
      if (shockAlive) {
        const t = elapsed / ROBOT_DEATH_DURATION;
        shock.position.set(robot.pos.x, 0.05, -robot.pos.y);
        shock.scale.setScalar(0.4 + t * 5.0);
        (shock.material as THREE.MeshBasicMaterial).opacity = (1 - t) ** 1.2 * 0.65;
      }
    }
  });

  return (
    <group>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeom}>
        <meshBasicMaterial color={tint} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={footRef} rotation={[-Math.PI / 2, 0, 0]} geometry={footGeom}>
        <meshBasicMaterial color={tint} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={moveRef} geometry={moveGeom}>
        <meshBasicMaterial color={tint} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={selRef} rotation={[-Math.PI / 2, 0, 0]} geometry={selGeom}>
        <meshBasicMaterial color="#ffd66a" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Dash aim arrow — shaft + tip, anchored at robot pos. Hidden
          unless robot.dashAim is set (any dash robot in aim window). */}
      <group ref={aimGroupRef} visible={false} renderOrder={4}>
        <mesh geometry={aimShaftGeom} position={[0, 0, -1.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color={tint}
            transparent
            opacity={0.92}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={aimHeadGeom} position={[0, 0, -3.1]} rotation={[0, 0, 0]}>
          <meshBasicMaterial
            color={tint}
            transparent
            opacity={0.98}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* Robot death explosion: outer fireball + white-hot core + ground
          shockwave. Refs hidden by default; useFrame flips them on
          while world.time falls inside the death-cinematic window. */}
      <mesh ref={deathFlashRef} visible={false} renderOrder={3}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial
          color="#ff9b3a"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={deathCoreRef} visible={false} renderOrder={3}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#fff4d6"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={deathShockRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.45, 0.6, 48]} />
        <meshBasicMaterial
          color="#ffd07a"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
