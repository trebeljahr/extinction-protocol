import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HEAL_AURA_RANGE } from "../sim/world";
import { useGame } from "../store";
import { HEAL_HUG_RADIUS_BY_KIND } from "./HealAuras.constants";

const MAX_HEALERS = 64;
// Waves per healer — three phased rings keep at least one ring mid-flight
// at any time so the heal field reads as "continuously broadcasting" rather
// than a single ping every period.
const WAVES_PER_HEALER = 3;
const WAVE_PERIOD = 1.6;
const MAX_WAVES = MAX_HEALERS * WAVES_PER_HEALER;
const AURA_COLOR = new THREE.Color("#7eff8a");

export const HealAuras = () => {
  const hugRef = useRef<THREE.InstancedMesh>(null);
  const waveRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const hug = hugRef.current;
    const wave = waveRef.current;
    const halo = haloRef.current;
    if (!hug || !wave || !halo) return;
    const { world } = useGame.getState();
    const time = world.time;

    let hi = 0;
    let wi = 0;
    for (const e of world.enemies) {
      if (!e.alive || e.leak) continue;
      if (!e.healAura) continue;
      if (hi >= MAX_HEALERS) break;

      const hugR = HEAL_HUG_RADIUS_BY_KIND[e.kind];
      // Inner ring — narrow body hug, breathes gently so it doesn't read
      // as a static debuff plate.
      const hugPulse = 1 + Math.sin(time * 2.4 + e.id) * 0.04;
      const hugScale = hugR * hugPulse;
      dummy.position.set(e.pos.x, 0.04, -e.pos.y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(hugScale, hugScale, 1);
      dummy.updateMatrix();
      hug.setMatrixAt(hi, dummy.matrix);
      const hugIntensity = 0.85 + 0.15 * Math.sin(time * 3.0 + e.id);
      color.copy(AURA_COLOR).multiplyScalar(hugIntensity);
      hug.setColorAt(hi, color);

      // Outgoing waves — three offsets (0, 1/3, 2/3 of the period) so a
      // ring is always mid-flight. Phase keyed off enemy id keeps stacked
      // healers from pulsing in lockstep.
      const healerPhase = (e.id * 0.137) % 1;
      for (let k = 0; k < WAVES_PER_HEALER; k++) {
        if (wi >= MAX_WAVES) break;
        const phase = healerPhase + k / WAVES_PER_HEALER;
        const progress = (time / WAVE_PERIOD + phase) % 1;
        const radius = hugR + (HEAL_AURA_RANGE - hugR) * progress;
        // Fast fade-in (first ~8%) so the ring doesn't pop at hugR,
        // then linear bleed-out so the wave dims as it expands — same
        // shape as the cryo wave so they read as a kindred effect.
        const fadeIn = Math.min(1, progress / 0.08);
        const alpha = fadeIn * (1 - progress);

        dummy.position.set(e.pos.x, 0.05, -e.pos.y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(radius, radius, 1);
        dummy.updateMatrix();
        wave.setMatrixAt(wi, dummy.matrix);
        color.copy(AURA_COLOR).multiplyScalar(alpha);
        wave.setColorAt(wi, color);

        // Trailing halo — slightly inside the leading edge, dimmer +
        // wider profile so the band has depth.
        dummy.scale.set(radius * 0.96, radius * 0.96, 1);
        dummy.updateMatrix();
        halo.setMatrixAt(wi, dummy.matrix);
        color.copy(AURA_COLOR).multiplyScalar(alpha * 0.55);
        halo.setColorAt(wi, color);
        wi++;
      }
      hi++;
    }
    hug.count = hi;
    wave.count = wi;
    halo.count = wi;
    hug.instanceMatrix.needsUpdate = true;
    wave.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (hug.instanceColor) hug.instanceColor.needsUpdate = true;
    if (wave.instanceColor) wave.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={hugRef} args={[undefined, undefined, MAX_HEALERS]}>
        <ringGeometry args={[0.86, 1.0, 56]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={waveRef} args={[undefined, undefined, MAX_WAVES]}>
        <ringGeometry args={[0.96, 1.0, 64]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={haloRef} args={[undefined, undefined, MAX_WAVES]}>
        <ringGeometry args={[0.88, 1.0, 64]} />
        <meshBasicMaterial
          color="white"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};
