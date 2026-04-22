import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import type { Tower } from "../sim/types";
import type { World } from "../sim/types";

// Overlay VFX for towers. Drives "charge up" visuals off `cooldown` progress:
//   charge = 1 - cooldown / (1/fireRate)   -> 0 just fired, 1 ready to fire.
// Chain gets an electrified orb with crossed arcs. Pulse gets a railgun rail
// running along the barrel with a muzzle glow.

const MAX_PER_KIND = 64;

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
  const pulseRailRef   = useRef<THREE.InstancedMesh>(null);
  const pulseMuzzleRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const orbGeom    = useMemo(() => new THREE.SphereGeometry(0.22, 16, 12), []);
  const arcGeom    = useMemo(() => new THREE.TorusGeometry(0.38, 0.028, 6, 24), []);
  const muzzleGeom = useMemo(() => new THREE.SphereGeometry(0.14, 12, 10), []);
  // Rail cylinder oriented along +Z (so scaling Z stretches along forward).
  const railGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8, 1, true);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  useFrame(() => {
    const { world } = useGame.getState();
    const time = world.time;

    let chainCount = 0;
    let pulseCount = 0;

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
        // Railgun "building up" look. Steeper curve so the last 20% really pops.
        const pulse = 0.92 + 0.08 * Math.sin(time * 14 + t.id);
        const glow = charge * charge * pulse;
        if (glow <= 0.001) continue;

        const yaw = barrelYaw(t, world);
        const fx = Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const barrelLen = 1.15;
        const barrelY = 0.85;

        // Rail: cylinder scaled to barrelLen along forward.
        dummy.position.set(
          t.pos.x + fx * barrelLen * 0.5,
          barrelY,
          -t.pos.y + fz * barrelLen * 0.5,
        );
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1, barrelLen);
        dummy.updateMatrix();
        pulseRailRef.current!.setMatrixAt(pulseCount, dummy.matrix);
        color.setRGB(0.55 * glow, 0.85 * glow, 1.0 * glow);
        pulseRailRef.current!.setColorAt(pulseCount, color);

        // Muzzle bulb at the tip.
        dummy.position.set(
          t.pos.x + fx * barrelLen,
          barrelY,
          -t.pos.y + fz * barrelLen,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.5 + charge * 1.4);
        dummy.updateMatrix();
        pulseMuzzleRef.current!.setMatrixAt(pulseCount, dummy.matrix);
        const m = glow * 1.15;
        color.setRGB(Math.min(1, m), Math.min(1, m), Math.min(1, m * 0.92));
        pulseMuzzleRef.current!.setColorAt(pulseCount, color);

        pulseCount++;
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
    const pulseRefs = [pulseRailRef, pulseMuzzleRef];
    for (const r of pulseRefs) {
      const m = r.current;
      if (!m) continue;
      m.count = pulseCount;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
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

      <instancedMesh ref={pulseRailRef} args={[railGeom, undefined, MAX_PER_KIND]}>
        <meshBasicMaterial
          color="#9fe8ff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh ref={pulseMuzzleRef} args={[muzzleGeom, undefined, MAX_PER_KIND]}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};
