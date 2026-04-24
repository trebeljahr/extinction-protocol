import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ALL_BIOME_URLS, BIOME_LAYERS, BIOME_STYLE, type BiomeLayer } from "../biomes";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const distPointToSegSq = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len = abx * abx + aby * aby;
  const t = len > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / len)) : 0;
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
};

const nearAnyPath = (paths: Vec2[][], x: number, y: number, clearance: number) => {
  const r2 = clearance * clearance;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < r2)
        return true;
    }
  }
  return false;
};

type Placement = { x: number; y: number; scale: number; rot: number };

const buildLayer = (paths: Vec2[][], spec: BiomeLayer): Placement[][] => {
  const rng = mulberry32(spec.seed);
  const buckets: Placement[][] = spec.urls.map(() => []);
  let tries = 0;
  let placed = 0;
  while (placed < spec.count && tries < spec.count * 30) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH;
    const y = (rng() - 0.5) * MAP_HEIGHT;
    if (nearAnyPath(paths, x, y, spec.clearance)) continue;
    const variant = Math.floor(rng() * spec.urls.length);
    buckets[variant].push({
      x,
      y,
      scale: spec.minScale + rng() * (spec.maxScale - spec.minScale),
      rot: rng() * Math.PI * 2,
    });
    placed++;
  }
  return buckets;
};

const NatureInstances = ({
  url,
  placements,
  castShadow,
}: {
  url: string;
  placements: Placement[];
  castShadow: boolean;
}) => {
  const { scene } = useGLTF(url);
  const instRef = useRef<THREE.InstancedMesh>(null);

  const source = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) return null;
    const m = mesh as THREE.Mesh;
    m.updateMatrixWorld(true);
    const geom = m.geometry.clone();
    geom.applyMatrix4(m.matrixWorld);
    geom.computeBoundingBox();
    const minY = geom.boundingBox?.min.y ?? 0;
    return { geom, material: m.material as THREE.Material, minY };
  }, [scene]);

  useEffect(() => {
    const im = instRef.current;
    if (!im || !source) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      dummy.position.set(p.x, -source.minY * p.scale, -p.y);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.count = placements.length;
    im.instanceMatrix.needsUpdate = true;
  }, [placements, source]);

  if (!source || placements.length === 0) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[source.geom, source.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
};

export const Ground = () => {
  const paths = useGame((s) => s.world.paths);
  const biome = useGame((s) => s.world.biome);
  const style = BIOME_STYLE[biome];
  const specs = useMemo(() => BIOME_LAYERS[biome].filter((s) => !s.blocks), [biome]);

  const layers = useMemo(
    () =>
      specs.map((spec) => ({
        spec,
        buckets: buildLayer(paths, spec).map((placements) => ({ id: nanoid(), placements })),
      })),
    [paths, specs],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
        <meshStandardMaterial color={style.groundColor} roughness={0.98} metalness={0} />
      </mesh>

      {layers.flatMap(({ spec, buckets }) =>
        buckets.map(({ id, placements }, vi) => (
          <NatureInstances
            key={id}
            url={spec.urls[vi]}
            placements={placements}
            castShadow={spec.castShadow}
          />
        )),
      )}
    </group>
  );
};

for (const url of ALL_BIOME_URLS) useGLTF.preload(url);
