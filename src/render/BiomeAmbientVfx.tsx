import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  buildLavaFeatures,
  buildLavaSurface,
  hasFlowFeatures,
  type LavaFeatures,
  sampleLavaSurface,
} from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { useGame } from "../store";

// Self-managing render-only particles. Not tied to sim state (doesn't
// consume world.particles budget); purely atmospheric decoration.
const POOL = 128;

type Kind = "ember" | "spark" | "alien";

type P = {
  x: number;
  y: number;
  z: number;
  vy: number;
  drift: number;
  life: number;
  maxLife: number;
  kind: Kind;
  // Cached per-particle visuals chosen at spawn so the per-frame loop only
  // does interpolation, not branching on kind.
  baseSize: number;
  growSize: number;
  brightness: number;
};

type FlowSpawn = { surface: ReturnType<typeof buildLavaSurface>; features: LavaFeatures };

const freshLavaEmber = (p: P, flow: FlowSpawn | null) => {
  // 35% sparks (bright, snappy, tiny), 65% embers (slower, larger, dimmer)
  const isSpark = Math.random() < 0.35;
  p.kind = isSpark ? "spark" : "ember";

  const sample = flow ? sampleLavaSurface(flow.surface, flow.features.bridges, Math.random) : null;
  if (sample) {
    p.x = sample.x;
    p.z = -sample.y;
  } else {
    // Fallback if no rivers/lakes built yet — shouldn't happen in practice.
    p.x = (Math.random() * 2 - 1) * (MAP_WIDTH / 2 - 1);
    p.z = (Math.random() * 2 - 1) * (MAP_HEIGHT / 2 - 1);
  }
  p.y = 0.04 + Math.random() * 0.15;

  if (isSpark) {
    p.vy = 1.8 + Math.random() * 1.6;
    p.drift = (Math.random() * 2 - 1) * 0.45;
    p.maxLife = 0.45 + Math.random() * 0.55;
    p.baseSize = 0.05 + Math.random() * 0.04;
    p.growSize = 0.03;
    p.brightness = 1.6 + Math.random() * 0.6;
  } else {
    p.vy = 0.7 + Math.random() * 1.0;
    p.drift = (Math.random() * 2 - 1) * 0.25;
    p.maxLife = 1.4 + Math.random() * 1.4;
    p.baseSize = 0.13 + Math.random() * 0.06;
    p.growSize = 0.12;
    p.brightness = 0.7 + Math.random() * 0.4;
  }
  p.life = p.maxLife;
};

const freshAlienSpore = (p: P, flow: FlowSpawn | null) => {
  p.kind = "alien";
  // Spores rise off the goo rivers/lakes — sampling the flow surface keeps
  // them tethered to the visible feature instead of fogging the whole map.
  const sample = flow ? sampleLavaSurface(flow.surface, flow.features.bridges, Math.random) : null;
  if (sample) {
    p.x = sample.x;
    p.z = -sample.y;
  } else {
    p.x = (Math.random() * 2 - 1) * (MAP_WIDTH / 2 - 1);
    p.z = (Math.random() * 2 - 1) * (MAP_HEIGHT / 2 - 1);
  }
  p.y = 0.2 + Math.random() * 3;
  p.vy = 0.15 + Math.random() * 0.3;
  p.drift = (Math.random() * 2 - 1) * 0.6;
  p.maxLife = 3 + Math.random() * 3;
  p.baseSize = 0.14;
  p.growSize = 0.14;
  p.brightness = 1;
  p.life = p.maxLife;
};

/**
 * Ambient particle field keyed to the current biome:
 *   - lava  : embers + sparks rising over rivers/lakes; sparks are smaller,
 *             faster, brighter; embers are larger, slower, dimmer
 *   - alien : pale cyan spores drifting lazily across the whole map
 * Other biomes hide the mesh entirely (visible=false).
 */
export const BiomeAmbientVfx = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const baseColorTmp = useMemo(() => new THREE.Color(), []);

  // Built for both lava and alien — both biomes use the same flow geometry,
  // and now both spawn ambient particles along the rivers/lakes only.
  const flowSpawn = useMemo<FlowSpawn | null>(() => {
    if (!hasFlowFeatures(biome)) return null;
    const features = buildLavaFeatures(paths, levelId, biome);
    return { features, surface: buildLavaSurface(features) };
  }, [biome, paths, levelId]);

  const pool = useMemo<P[]>(() => {
    const arr: P[] = [];
    for (let i = 0; i < POOL; i++) {
      arr.push({
        x: 0,
        y: 0,
        z: 0,
        vy: 0,
        drift: 0,
        life: Math.random() * 2,
        maxLife: 1,
        kind: "ember",
        baseSize: 0.14,
        growSize: 0.14,
        brightness: 1,
      });
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

    const isLava = biome === "lava";
    const baseColor = isLava ? "#ff8a32" : "#7effe0";
    const sparkColor = "#ffe27a";
    mat.color.set(baseColor);

    let i = 0;
    for (const p of pool) {
      if (p.life <= 0) {
        if (isLava) freshLavaEmber(p, flowSpawn);
        else freshAlienSpore(p, flowSpawn);
      }
      p.life -= dt;
      p.y += p.vy * dt;
      p.x += p.drift * dt * 0.6;
      p.z += Math.sin(p.life * 3.0 + p.drift * 10) * dt * 0.15;

      const t = Math.max(0, p.life / p.maxLife); // 1..0 remaining-life ratio
      const alpha = Math.sin(Math.min(1, (1 - t) * 3) * Math.PI * 0.5) * Math.min(1, t * 2);
      const size = p.baseSize + p.growSize * (1 - t);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(size);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Sparks lean toward yellow-white at peak brightness; embers stay
      // amber. Brightness multiplier modulates per-particle so the variant
      // mix reads as a real ember field, not a uniform glow.
      if (p.kind === "spark") {
        color.set(sparkColor).lerp(baseColorTmp.set(baseColor), 1 - alpha * 0.6);
      } else {
        color.set(baseColor);
      }
      color.multiplyScalar(p.brightness * (0.5 + alpha));
      mesh.setColorAt(i, color);
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
