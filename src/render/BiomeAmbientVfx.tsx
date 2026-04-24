import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import { MAP_WIDTH, MAP_HEIGHT } from "../level";

// Small pool of self-managing render-only particles. Not tied to sim state
// (doesn't consume world.particles budget); purely atmospheric decoration.
const POOL = 96;

type P = {
  x: number;
  y: number;
  z: number;
  vy: number;   // vertical velocity
  drift: number; // horizontal drift scalar
  life: number; // current life (0..1, 1=just born)
  maxLife: number;
};

const freshLavaEmber = (p: P) => {
  p.x = (Math.random() * 2 - 1) * (MAP_WIDTH / 2 - 1);
  p.z = (Math.random() * 2 - 1) * (MAP_HEIGHT / 2 - 1);
  p.y = 0.05 + Math.random() * 0.2;
  p.vy = 0.8 + Math.random() * 1.2;
  p.drift = (Math.random() * 2 - 1) * 0.25;
  p.maxLife = 1.6 + Math.random() * 1.6;
  p.life = p.maxLife;
};

const freshAlienSpore = (p: P) => {
  p.x = (Math.random() * 2 - 1) * (MAP_WIDTH / 2 - 1);
  p.z = (Math.random() * 2 - 1) * (MAP_HEIGHT / 2 - 1);
  p.y = 0.2 + Math.random() * 3;
  p.vy = 0.15 + Math.random() * 0.3;   // slow — spores float gently
  p.drift = (Math.random() * 2 - 1) * 0.6;
  p.maxLife = 3 + Math.random() * 3;
  p.life = p.maxLife;
};

/**
 * Ambient particle field keyed to the current biome:
 *   - lava  : bright orange embers rising quickly, additive blend, short-lived
 *   - alien : pale cyan spores drifting lazily, longer-lived, slight horizontal
 *             drift
 * Other biomes hide the mesh entirely (visible=false).
 */
export const BiomeAmbientVfx = () => {
  const biome = useGame(s => s.world.biome);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const pool = useMemo<P[]>(() => {
    const arr: P[] = [];
    for (let i = 0; i < POOL; i++) {
      const p: P = { x: 0, y: 0, z: 0, vy: 0, drift: 0, life: 0, maxLife: 1 };
      // Stagger initial lifetimes so embers don't all respawn simultaneously
      p.life = Math.random() * 2;
      arr.push(p);
    }
    return arr;
  }, []);

  useFrame((_state, dt) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const active = biome === "lava" || biome === "alien";
    mesh.visible = active;
    if (!active) return;

    const spawn = biome === "lava" ? freshLavaEmber : freshAlienSpore;
    const baseColor = biome === "lava" ? "#ff8a32" : "#7effe0";
    mat.color.set(baseColor);

    let i = 0;
    for (const p of pool) {
      if (p.life <= 0) spawn(p);
      // Integrate
      p.life -= dt;
      p.y += p.vy * dt;
      p.x += p.drift * dt * 0.6;
      // Slight sinusoidal sway in z so the drift doesn't read as pure x-shift
      p.z += Math.sin(p.life * 3.0 + p.drift * 10) * dt * 0.15;

      const t = Math.max(0, p.life / p.maxLife); // 1..0 remaining-life ratio
      // Fade in at birth, fade out at death — bell curve via sin
      const alpha = Math.sin(Math.min(1, (1 - t) * 3) * Math.PI * 0.5) *
                    Math.min(1, t * 2);
      const size = 0.14 + 0.14 * (1 - t);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(size);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(baseColor).multiplyScalar(0.6 + alpha));
      i++;
    }
    mesh.count = POOL;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        ref={matRef}
        color="#ff8a32"
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
};
