import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOME_BASES, type Biome, TARGET_SIZE_BY_ROLE, classifyPropUrl } from "../biomes";
import { type LavaFeatures, buildLavaFeatures, isOnLavaSurface } from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

// A "base" is a deliberate cluster of sci-fi props tucked off to the side
// of the map — hero structure (hangar/rocket/structure) ringed by a few
// supports (generators, dishes, barrels). Not every level gets one: the
// seed decides per-levelId so bases feel like a discovery, not wallpaper.

const BASE_CLEAR_FROM_PATH = PATH_WIDTH / 2 + 2.5;
const BASE_INSET_X = 5.5;
const BASE_INSET_Y = 4;
const CLUSTER_RADIUS = 3.4;
const SUPPORT_COUNT = 4;
const BASE_CHANCE = 0.55;
// Multipliers on top of TARGET_SIZE_BY_ROLE so in-level bases read at an
// appropriate scale to the level — hangars at the world-map target size
// looked undersized next to trees/rocks in the play scene.
const HERO_SCALE = 1.8;
const SUPPORT_SCALE_MIN = 1.2;
const SUPPORT_SCALE_MAX = 1.55;

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

// Try the four map corners in a shuffled order; pick the first whose
// whole cluster footprint stays clear of every path segment AND every
// lava lake/river (so the hero structure isn't sitting in molten rock).
const pickBaseCenter = (
  rng: () => number,
  paths: Vec2[][],
  lava: LavaFeatures | null,
): Vec2 | null => {
  const corners: Vec2[] = [
    { x: -MAP_WIDTH / 2 + BASE_INSET_X, y: -MAP_HEIGHT / 2 + BASE_INSET_Y },
    { x: MAP_WIDTH / 2 - BASE_INSET_X, y: -MAP_HEIGHT / 2 + BASE_INSET_Y },
    { x: -MAP_WIDTH / 2 + BASE_INSET_X, y: MAP_HEIGHT / 2 - BASE_INSET_Y },
    { x: MAP_WIDTH / 2 - BASE_INSET_X, y: MAP_HEIGHT / 2 - BASE_INSET_Y },
  ];
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corners[i], corners[j]] = [corners[j], corners[i]];
  }
  const minDist = CLUSTER_RADIUS + BASE_CLEAR_FROM_PATH;
  const minDist2 = minDist * minDist;
  for (const c of corners) {
    if (isOnLavaSurface(lava, c.x, c.y, CLUSTER_RADIUS)) continue;
    let ok = true;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (
          distPointToSegSq(c.x, c.y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < minDist2
        ) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (ok) return c;
  }
  return null;
};

type Instance = { url: string; pos: Vec2; scale: number; rotY: number };

const buildBase = (biome: Biome, paths: Vec2[][], levelId: number): Instance[] => {
  const recipe = BIOME_BASES[biome];
  if (!recipe) return [];
  const rng = mulberry32(levelId * 7919 + 131);
  if (rng() > BASE_CHANCE) return [];

  const lava = biome === "lava" ? buildLavaFeatures(paths, levelId) : null;
  const center = pickBaseCenter(rng, paths, lava);
  if (!center) return [];

  const hero = recipe.hero[Math.floor(rng() * recipe.hero.length)];
  const baseRot = rng() * Math.PI * 2;
  const items: Instance[] = [{ url: hero, pos: center, scale: HERO_SCALE, rotY: baseRot }];

  for (let i = 0; i < SUPPORT_COUNT; i++) {
    const u = recipe.support[Math.floor(rng() * recipe.support.length)];
    const a = (i / SUPPORT_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const r = 2.0 + rng() * 1.1;
    items.push({
      url: u,
      pos: { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r },
      scale: SUPPORT_SCALE_MIN + rng() * (SUPPORT_SCALE_MAX - SUPPORT_SCALE_MIN),
      rotY: baseRot + (rng() - 0.5) * 0.8,
    });
  }
  return items;
};

type Part = { id: string; geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number; baseScale: number };

// Same multi-primitive collection used in BiomeCosmetics/Rocks/Trees.
const collectSource = (scene: THREE.Object3D, url: string): Source | null => {
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const union = new THREE.Box3();
  let unionSet = false;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      geom.computeBoundingBox();
      if (geom.boundingBox) {
        if (!unionSet) {
          union.copy(geom.boundingBox);
          unionSet = true;
        } else union.union(geom.boundingBox);
      }
      parts.push({ id: nanoid(), geom, material: mat as THREE.Material });
    }
  });
  if (parts.length === 0 || !unionSet) return null;
  const size = union.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const role = classifyPropUrl(url);
  const target = TARGET_SIZE_BY_ROLE[role];
  return { parts, minY: union.min.y, baseScale: target / maxDim };
};

const InstanceGroup = ({ url, items }: { url: string; items: Instance[] }) => {
  const { scene } = useGLTF(url);
  const source = useMemo(() => collectSource(scene, url), [scene, url]);
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    if (!source) return;
    const dummy = new THREE.Object3D();
    for (const im of partRefs.current) {
      if (!im) continue;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = source.baseScale * it.scale;
        dummy.position.set(it.pos.x, -source.minY * s, -it.pos.y);
        dummy.rotation.set(0, it.rotY, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.count = items.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }, [items, source]);

  if (!source || items.length === 0) return null;

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          key={part.id}
          ref={(el: THREE.InstancedMesh | null) => {
            partRefs.current[pi] = el;
          }}
          args={[part.geom, part.material, items.length]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
};

export const BiomeBases = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);

  const groups = useMemo(() => {
    const items = buildBase(biome, paths, levelId);
    const byUrl = new Map<string, Instance[]>();
    for (const it of items) {
      const list = byUrl.get(it.url) ?? [];
      list.push(it);
      byUrl.set(it.url, list);
    }
    return Array.from(byUrl.entries());
  }, [biome, paths, levelId]);

  return (
    <group>
      {groups.map(([url, items]) => (
        <InstanceGroup key={url} url={url} items={items} />
      ))}
    </group>
  );
};

// Preload every base URL so switching biomes mid-session doesn't stall.
for (const recipe of Object.values(BIOME_BASES)) {
  if (!recipe) continue;
  for (const u of [...recipe.hero, ...recipe.support]) useGLTF.preload(u);
}
