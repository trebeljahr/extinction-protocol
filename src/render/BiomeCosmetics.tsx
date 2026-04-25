import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOME_COSMETICS, type Biome, TARGET_SIZE_BY_ROLE, classifyPropUrl } from "../biomes";
import { type LavaFeatures, buildLavaFeatures, isOnLavaSurface } from "../lavaGeometry";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

// Render-only decorative cosmetics scattered across the playable level.
// Deterministic per-level via PRNG seeded on levelId. These don't live in
// world state — they're pure flavor and never block placement or get
// clicked.

// Pre-tuned for the cluster algorithm below: ~14 props in 4–6 cluster pockets
// reads as "natural arrangements" instead of evenly-spread scatter. Lower than
// the old uniform-scatter count (was 26) because clusters concentrate visual
// weight where they land.
const COUNT_PER_LEVEL = 14;
const CLUSTER_SEEDS = 5;
// Standard deviation in world units for prop offset from a cluster seed.
// Larger = looser cluster; smaller = tight pile.
const CLUSTER_SIGMA = 1.6;
// PATH_WIDTH widened to 2.8, so anything at half-width + 0.5 was clipping
// the visible edge. 1.2 beyond the edge gives cosmetics room to breathe.
const PATH_CLEARANCE = PATH_WIDTH / 2 + 1.2;
const PROP_MIN_SPACING = 1.3;

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

type Instance = { url: string; pos: Vec2; scale: number; rotY: number };

// Box–Muller normal sample: clustered offsets read as "huddled together"
// instead of the gridlock you get from uniform random.
const gaussian = (rng: () => number, sigma: number): number => {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
};

// Pick K cluster seed points well-distributed across the playable area and
// well-clear of paths/blockers/lava. Each seed becomes the anchor for a
// small huddle of props.
const pickClusterSeeds = (
  rng: () => number,
  paths: Vec2[][],
  blockers: { pos: Vec2; radius: number }[],
  lava: LavaFeatures | null,
  count: number,
): Vec2[] => {
  const seeds: Vec2[] = [];
  const pathR2 = (PATH_CLEARANCE + 1.2) * (PATH_CLEARANCE + 1.2);
  const seedMinDist = 6.5;
  let tries = 0;
  while (seeds.length < count && tries < count * 80) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.85;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.85;
    if (isOnLavaSurface(lava, x, y, 1.5)) continue;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;
    for (const b of blockers) {
      const dx = b.pos.x - x;
      const dy = b.pos.y - y;
      const r = b.radius + 1.0;
      if (dx * dx + dy * dy < r * r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const s of seeds) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy < seedMinDist * seedMinDist) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    seeds.push({ x, y });
  }
  return seeds;
};

const buildInstances = (
  biome: Biome,
  paths: Vec2[][],
  levelId: number,
  blockers: { pos: Vec2; radius: number }[],
  lava: LavaFeatures | null,
): Instance[] => {
  const urls = BIOME_COSMETICS[biome];
  if (urls.length === 0) return [];
  const rng = mulberry32(levelId * 6271 + 13);
  const out: Instance[] = [];
  const pathR2 = PATH_CLEARANCE * PATH_CLEARANCE;
  const spacingSq = PROP_MIN_SPACING * PROP_MIN_SPACING;
  // Soft bounds so cluster halos don't poke past the visible playfield.
  const halfW = MAP_WIDTH * 0.47;
  const halfH = MAP_HEIGHT * 0.47;

  // Cluster seeds + a per-cluster URL bias (each cluster prefers one or two
  // prop variants — reads as "this is a grove of X" rather than a salad).
  const seeds = pickClusterSeeds(rng, paths, blockers, lava, CLUSTER_SEEDS);
  if (seeds.length === 0) return [];
  const seedUrl = seeds.map(() => urls[Math.floor(rng() * urls.length)]);

  let tries = 0;
  while (out.length < COUNT_PER_LEVEL && tries < COUNT_PER_LEVEL * 50) {
    tries++;
    const si = Math.floor(rng() * seeds.length);
    const seed = seeds[si];
    const x = Math.max(-halfW, Math.min(halfW, seed.x + gaussian(rng, CLUSTER_SIGMA)));
    const y = Math.max(-halfH, Math.min(halfH, seed.y + gaussian(rng, CLUSTER_SIGMA)));

    if (isOnLavaSurface(lava, x, y, 0.5)) continue;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < pathR2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;

    for (const b of blockers) {
      const dx = b.pos.x - x;
      const dy = b.pos.y - y;
      if (dx * dx + dy * dy < b.radius * b.radius) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (const p of out) {
      const dx = p.pos.x - x;
      const dy = p.pos.y - y;
      if (dx * dx + dy * dy < spacingSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // 70% chance to use this cluster's preferred URL — gives each grove
    // a clear identity without making it monotone.
    const url = rng() < 0.7 ? seedUrl[si] : urls[Math.floor(rng() * urls.length)];
    out.push({
      url,
      pos: { x, y },
      // Wider scale jitter (was 0.85–1.30) for more visual variety inside
      // a single cluster — couple of small siblings and a hero.
      scale: 0.7 + ((rng() + rng()) / 2) * 0.7,
      rotY: rng() * Math.PI * 2,
    });
  }
  return out;
};

type Part = { id: string; geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number; baseScale: number };

// Walk every Mesh in the scene so multi-primitive GLBs (Kenney space-kit
// machines have 2+ primitives — chassis, cables, lights) render in full.
// Same pattern as Rocks/Trees.
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

export const BiomeCosmetics = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);
  const trees = useGame((s) => s.world.trees);
  const rocks = useGame((s) => s.world.rocks);

  const groups = useMemo(() => {
    // Block cosmetics from spawning on top of trees/rocks that already exist.
    const blockers: { pos: Vec2; radius: number }[] = [
      ...trees.map((t) => ({ pos: t.pos, radius: 0.9 * t.scale })),
      ...rocks.map((r) => ({ pos: r.pos, radius: 0.7 * r.scale })),
    ];
    const lava = biome === "lava" ? buildLavaFeatures(paths, levelId) : null;
    const instances = buildInstances(biome, paths, levelId, blockers, lava);
    const byUrl = new Map<string, Instance[]>();
    for (const inst of instances) {
      const list = byUrl.get(inst.url) ?? [];
      list.push(inst);
      byUrl.set(inst.url, list);
    }
    return Array.from(byUrl.entries());
  }, [biome, paths, levelId, trees, rocks]);

  return (
    <group>
      {groups.map(([url, items]) => (
        <InstanceGroup key={url} url={url} items={items} />
      ))}
    </group>
  );
};

// Preload every cosmetic URL so switching biomes mid-session doesn't stall.
for (const urls of Object.values(BIOME_COSMETICS)) {
  for (const url of urls) useGLTF.preload(url);
}
