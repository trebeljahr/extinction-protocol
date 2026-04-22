import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import type { Tower } from "../sim/types";
import type { World } from "../sim/types";

// Overlay VFX for towers. Drives "charge up" visuals off `cooldown` progress:
//   charge = 1 - cooldown / (1/fireRate)   -> 0 just fired, 1 ready to fire.
// Chain gets an electrified orb with crossed arcs. Pulse gets a row of coil
// rings along the barrel — a travelling bright band sweeps from base → tip
// as the shot charges, reading as magnetic coils accelerating the pellet.

const MAX_PER_KIND = 64;
const PULSE_RING_COUNT = 5;
const MAX_PULSE_RINGS = MAX_PER_KIND * PULSE_RING_COUNT;

const chargeProgress = (tower: Tower): number => {
  if (tower.fireRate <= 0) return 0;
  const interval = 1 / tower.fireRate;
  if (interval <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - tower.cooldown / interval));
};

// Match ModelTowerMesh's yaw convention. Returns 0 when no target.
const barrelYaw = (t: Tower, world: World): number => {
  if (t.targetId === null) return 0;
  const target = world.enemies.find(e => e.id === t.targetId && e.alive);
  if (!target) return 0;
  const dx = target.pos.x - t.pos.x;
  const dy = target.pos.y - t.pos.y;
  return Math.atan2(dx, -dy);
};

export const TowerVfx = () => {
  const chainOrbRef  = useRef<THREE.InstancedMesh>(null);
  const chainArcARef = useRef<THREE.InstancedMesh>(null);
  const chainArcBRef = useRef<THREE.InstancedMesh>(null);
  const pulseRingRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const orbGeom    = useMemo(() => new THREE.SphereGeometry(0.22, 16, 12), []);
  const arcGeom    = useMemo(() => new THREE.TorusGeometry(0.38, 0.028, 6, 24), []);
  // Coil ring — lies flat (axis vertical) so the angled TD camera sees
  // full circles marching along the barrel rather than looking at the
  // thin edge of a vertical disc. The geometry bakes in the X-rotation
  // so per-instance rotation stays a cheap pure-yaw.
  const pulseRingGeom = useMemo(() => {
    const g = new THREE.TorusGeometry(0.14, 0.025, 8, 20);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  useFrame(() => {
    const { world } = useGame.getState();
    const time = world.time;

    let chainCount = 0;
    let pulseRingIdx = 0;

    for (const t of world.towers) {
      if (t.kind === "chain") {
        const charge = chargeProgress(t);
        // Flicker: small jitter so it reads as "electrified", ramps with charge.
        const flicker = 0.55 + 0.45 * Math.sin(time * 22 + t.id * 3.1);
        const baseGlow = 0.25;                  // ambient, visible when idle
        const intensity = baseGlow + (1 - baseGlow) * charge * flicker;
        const orbY = 1.35;

        // Core orb
        dummy.position.set(t.pos.x, orbY, -t.pos.y);
        dummy.rotation.set(0, time * 1.2 + t.id, 0);
        dummy.scale.setScalar(0.75 + charge * 0.35);
        dummy.updateMatrix();
        chainOrbRef.current!.setMatrixAt(chainCount, dummy.matrix);
        color.setRGB(0.55 * intensity, 0.82 * intensity, 1.0 * intensity);
        chainOrbRef.current!.setColorAt(chainCount, color);

        // Crossed electrified arcs
        const arcScale = 0.85 + charge * 0.55;
        dummy.position.set(t.pos.x, orbY, -t.pos.y);
        dummy.rotation.set(Math.PI / 2, time * 3.1 + t.id * 0.7, 0);
        dummy.scale.setScalar(arcScale);
        dummy.updateMatrix();
        chainArcARef.current!.setMatrixAt(chainCount, dummy.matrix);
        color.setRGB(0.75 * intensity, 0.45 * intensity, 1.0 * intensity);
        chainArcARef.current!.setColorAt(chainCount, color);

        dummy.rotation.set(time * 2.4 + t.id * 1.3, 0, time * -1.8 + t.id * 0.4);
        dummy.scale.setScalar(arcScale);
        dummy.updateMatrix();
        chainArcBRef.current!.setMatrixAt(chainCount, dummy.matrix);
        color.setRGB(0.60 * intensity, 0.95 * intensity, 1.0 * intensity);
        chainArcBRef.current!.setColorAt(chainCount, color);

        chainCount++;
      } else if (t.kind === "pulse") {
        const hasTarget = t.targetId !== null &&
          world.enemies.some(e => e.id === t.targetId && e.alive);
        if (!hasTarget) continue;

        const charge = chargeProgress(t);
        if (charge <= 0.02) continue;

        const yaw = barrelYaw(t, world);
        // The pulse tower glTF has a Z-up→Y-up X-rotation baked into
        // every mesh node, which flips the gun's authored "forward"
        // axis inside the root's local frame. Empirically the visible
        // barrel ends up along *negative* (sin yaw, 0, cos yaw) after
        // Y-rot by yaw, so the ring offsets need to follow suit.
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);

        // Geometry of the rings along the gun. Tuned against the tower_pulse
        // model's barrel — low enough to sit on it, not float above.
        const barrelY = 0.55;
        const barrelBase = 0.18;
        const barrelLen = 1.05;

        // Base glow + a sweeping brighter band that rides charge from 0→1.
        const pulseFlicker = 0.92 + 0.08 * Math.sin(time * 14 + t.id);
        const waveCenter = charge;

        for (let r = 0; r < PULSE_RING_COUNT; r++) {
          const segT = r / (PULSE_RING_COUNT - 1); // 0 at base, 1 at tip
          const dist = barrelBase + barrelLen * segT;
          const distFromWave = Math.abs(segT - waveCenter);
          const waveGlow = Math.max(0, 1 - distFromWave * 5) ** 2;
          const glow = (0.18 + 0.82 * waveGlow) * pulseFlicker * charge;

          dummy.position.set(
            t.pos.x + fx * dist,
            barrelY,
            -t.pos.y + fz * dist,
          );
          // Geometry is pre-rotated flat, so no per-instance rotation.
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(0.9 + waveGlow * 0.35);
          dummy.updateMatrix();
          pulseRingRef.current!.setMatrixAt(pulseRingIdx, dummy.matrix);
          color.setRGB(0.55 * glow, 0.85 * glow, 1.0 * glow);
          pulseRingRef.current!.setColorAt(pulseRingIdx, color);
          pulseRingIdx++;
        }
      }
    }

    const chainRefs = [chainOrbRef, chainArcARef, chainArcBRef];
    for (const r of chainRefs) {
      const m = r.current;
      if (!m) continue;
      m.count = chainCount;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const ringMesh = pulseRingRef.current;
    if (ringMesh) {
      ringMesh.count = pulseRingIdx;
      ringMesh.instanceMatrix.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={chainOrbRef} args={[orbGeom, undefined, MAX_PER_KIND]}>
        <meshBasicMaterial
          color="#9fd8ff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={chainArcARef} args={[arcGeom, undefined, MAX_PER_KIND]}>
        <meshBasicMaterial
          color="#c48cff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={chainArcBRef} args={[arcGeom, undefined, MAX_PER_KIND]}>
        <meshBasicMaterial
          color="#bdf0ff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={pulseRingRef} args={[pulseRingGeom, undefined, MAX_PULSE_RINGS]}>
        <meshBasicMaterial
          color="#9fe8ff"
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};
