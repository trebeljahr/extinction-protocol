import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  BIOME_LAYERS,
  BIOME_STORY_PROPS,
  BIOME_TREE_URLS,
  type Biome,
  biomeForPos,
  classifyPropUrl,
  TARGET_SIZE_BY_ROLE,
} from "../biomes";
import { LEVELS } from "../levels";
import { getStars, type ProgressData } from "../progress";
import { mulberry32 } from "../sim/random";
import { useGame } from "../store";
import {
  DEAD_DINO_FOOTPRINT,
  DEAD_DINO_URLS,
  DeadDinoInstancer,
  deadDinoCollisionRadius,
  isDeadDinoUrl,
} from "./DeadDinos";

// World-map decoration. Keep it SPARSE so each level cluster reads as a
// recognizable little vignette rather than a noisy pile: one robot landmark
// where the biome supports it, a small trace prop, then trees/rocks, plus a
// touch of biome foliage so the planet doesn't read as pure tech. Cleared
// levels get a small bones trail — the player's "march of death".

type PropInstance = {
  id: string;
  url: string;
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
  tiltZ?: number;
};

type PropRoleBucket = {
  urls: string[];
  count: number;
  minScale: number;
  maxScale: number;
  minRadius: number;
  maxRadius: number;
  // Extra spacing slack on top of the visible-silhouette radius. Larger
  // buckets read better with more breathing room.
  pad?: number;
  // Optional Z-axis tilt range so dead-dino bones can lie flat instead of
  // standing upright like the rest of the deco.
  tiltMin?: number;
  tiltMax?: number;
};

// Robot structure per biome — modular sci-fi research outposts. Every level
// node anchors on a substantial building (hangar / structure / rocket) so
// the world map reads as a network of high-tech bases on a hostile planet,
// not a string of pirate camps. Wooden landmarks (Tent / House / Cabin /
// Sawmill) are intentionally excluded across all biomes; they still appear
// inside levels as set-dressing, but at the world map's tilt + zoom they
// fought the sci-fi theme.
const BIOME_LANDMARKS: Record<Biome, string[]> = {
  forest: ["/models/scifi/structure_detailed.glb", "/models/scifi/hangar_smallA.glb"],
  desert: ["/models/scifi/hangar_smallA.glb", "/models/scifi/hangar_largeA.glb"],
  snow: ["/models/scifi/hangar_smallA.glb", "/models/scifi/hangar_largeA.glb"],
  wasteland: ["/models/scifi/structure_diagonal.glb", "/models/scifi/structure_closed.glb"],
  lava: ["/models/scifi/structure_detailed.glb", "/models/scifi/rocket_baseA.glb"],
  alien: ["/models/scifi/hangar_roundA.glb", "/models/scifi/hangar_smallB.glb"],
};

// Modular accent — a smaller secondary sci-fi piece dropped next to each
// landmark so each node reads as a small base (anchor + outbuilding) rather
// than a single isolated building. Picked so the silhouette differs from
// the anchor at a glance — closed structures, large dishes, chimneys, or
// crashed craft. Models picked from the building-role set so they
// normalize to the same robot scale as the anchor.
const BIOME_MODULES: Record<Biome, string[]> = {
  forest: ["/models/scifi/structure_closed.glb", "/models/scifi/satelliteDish_large.glb"],
  desert: ["/models/scifi/craft_speederA.glb", "/models/scifi/satelliteDish_detailed.glb"],
  snow: ["/models/scifi/satelliteDish_large.glb", "/models/scifi/chimney_detailed.glb"],
  wasteland: ["/models/scifi/craft_speederA.glb", "/models/scifi/structure_closed.glb"],
  lava: ["/models/scifi/chimney_detailed.glb", "/models/scifi/satelliteDish_large.glb"],
  alien: ["/models/scifi/satelliteDish_large.glb", "/models/scifi/structure_closed.glb"],
};

const rockUrls = (biome: Biome): string[] =>
  BIOME_LAYERS[biome]
    .flatMap((l) => l.urls)
    .filter((u) => /rock/i.test(u) || /crystal_(?:large|medium)/i.test(u));

const WOODEN_RX = /tent|house|cabin|sawmill|barrel\.glb|chest|torch/i;
const storyUrls = (biome: Biome): string[] =>
  BIOME_STORY_PROPS[biome].filter((u) => !WOODEN_RX.test(u));

// Biome-specific foliage / ground deco — bushes, plants, flowers,
// mushrooms drawn from each biome's BIOME_LAYERS. Pulled separately from
// rocks so the world-map clusters read as more than "tech + bare ground".
const FOLIAGE_RX = /bush|bushflowers|mushroom|plant|grass/i;
const foliageUrls = (biome: Biome): string[] => {
  const seen = new Set<string>();
  for (const l of BIOME_LAYERS[biome]) {
    for (const u of l.urls) {
      if (FOLIAGE_RX.test(u)) seen.add(u);
    }
  }
  return Array.from(seen);
};

// Per-level cluster geometry. Props land on composition slots outside
// the clean node bubble.
const CLUSTER_R = 7.6;
// Visible node footprint — hit cylinder (1.95) + outer hover ring (1.95) +
// south-side label/stars slack. Was 2.4; bumped to 3.1 because the HTML
// label and star row extend ~1.85 + label height south of the bubble, so
// any prop landing on that side could visually overlap the label even with
// the bbox-circle check clearing the hit cylinder.
const NODE_VISIBLE_R = 3.1;
// Center-to-center spacing slack between props on top of summed radii.
const MIN_GAP = 1.45;
// Extra gap between a prop's edge and the node's visible footprint.
const NODE_PROP_GAP = 0.55;
const MAX_RETRIES = 32;
// Six evenly-ish-spaced angular slots so each role gets a clean home and
// the cluster reads as a deliberate composition. Anchor at slot 0, module
// on the opposite side, foliage / bones tucked between trees and rocks.
const COMPOSITION_SLOTS = [0, Math.PI, 1.95, -1.95, Math.PI * 0.5, -Math.PI * 0.5];

const NODE_POSITIONS: { x: number; z: number }[] = LEVELS.map((l) => ({
  x: l.nodePos.x,
  z: -l.nodePos.y,
}));

// Visible half-radius of a prop URL at a given placement scale. Derived
// from `TARGET_SIZE_BY_ROLE` (the same target the renderer normalizes
// each GLB's max-dim to) so the overlap check matches the rendered
// silhouette instead of the per-bucket clearance heuristic — that was
// the source of node↔prop overlaps when a role's clearance underestimated
// the visible mesh (e.g. story buckets containing a tent-classified-as-
// building that rendered ~2x the claimed radius).
const visibleRadius = (url: string, scale: number): number => {
  // Dead-dino carcasses have their own per-URL footprint because the
  // DeadDinoInstancer normalizes them to that size rather than to a
  // TARGET_SIZE_BY_ROLE bucket (skinned mesh + custom death pose).
  const dino = DEAD_DINO_FOOTPRINT[url];
  if (dino !== undefined) return deadDinoCollisionRadius(url, scale);
  const role = classifyPropUrl(url);
  return (TARGET_SIZE_BY_ROLE[role] * scale) / 2;
};

const buildPropPlan = (progress: ProgressData) => {
  const perUrl: Record<string, PropInstance[]> = {};
  const placed: { x: number; z: number; r: number }[] = [];

  const tryPlace = (
    center: { x: number; z: number },
    bucket: PropRoleBucket,
    rand: () => number,
    baseAngle: number,
    slotIndex: number,
  ): PropInstance | null => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const slot = COMPOSITION_SLOTS[slotIndex % COMPOSITION_SLOTS.length];
      const a = baseAngle + slot + (rand() - 0.5) * 0.55 + attempt * 0.17;
      const r = bucket.minRadius + rand() * (bucket.maxRadius - bucket.minRadius);
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      const scale = bucket.minScale + rand() * (bucket.maxScale - bucket.minScale);
      // Pick the URL up front so the visible-silhouette radius matches
      // the prop that will actually render at this position.
      const url = bucket.urls[Math.floor(rand() * bucket.urls.length)];
      const pad = bucket.pad ?? 0;
      const radius = visibleRadius(url, scale) + pad;

      let bad = false;
      // Edge-of-prop → edge-of-node check. Uses the rendered silhouette
      // radius so the bubble + label/stars footprint can never overlap
      // ANY node, not just this one.
      const minNodeDist = radius + NODE_VISIBLE_R + NODE_PROP_GAP;
      const minNodeDistSq = minNodeDist * minNodeDist;
      for (const n of NODE_POSITIONS) {
        const dx = x - n.x;
        const dz = z - n.z;
        if (dx * dx + dz * dz < minNodeDistSq) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      for (const p of placed) {
        const dx = x - p.x;
        const dz = z - p.z;
        const minDist = radius + p.r + MIN_GAP;
        if (dx * dx + dz * dz < minDist * minDist) {
          bad = true;
          break;
        }
      }
      if (bad) continue;

      placed.push({ x, z, r: radius });
      const tilt =
        bucket.tiltMin !== undefined && bucket.tiltMax !== undefined
          ? bucket.tiltMin + rand() * (bucket.tiltMax - bucket.tiltMin)
          : undefined;
      return {
        id: nanoid(),
        url,
        pos: new THREE.Vector3(x, 0, z),
        rotY: rand() * Math.PI * 2,
        scale,
        tiltZ: tilt,
      };
    }
    return null;
  };

  for (const lvl of LEVELS) {
    const biome: Biome = biomeForPos(lvl.nodePos);
    const rand = mulberry32(lvl.id * 9973 + 17);
    const center = { x: lvl.nodePos.x, z: -lvl.nodePos.y };
    const landmarkUrls = BIOME_LANDMARKS[biome] ?? [];
    const moduleUrls = BIOME_MODULES[biome] ?? [];
    const traceUrls = storyUrls(biome);
    const foliage = foliageUrls(biome);
    const baseAngle = rand() * Math.PI * 2;
    const hasLandmark = landmarkUrls.length > 0;
    const cleared = getStars(progress, lvl.id) > 0;

    const landmarkBucket: PropRoleBucket = {
      urls: landmarkUrls,
      count: 1,
      minScale: 0.95,
      maxScale: 1.1,
      // Inner edge accounts for landmark half-radius (~1.55) + node
      // visible (3.1) + gap (0.55) = ~5.2 minimum. 5.4 gives slack so
      // retries usually land cleanly.
      minRadius: 5.4,
      maxRadius: 6.1,
      pad: 0.15,
    };
    const moduleBucket: PropRoleBucket = {
      urls: moduleUrls,
      count: hasLandmark ? 1 : 0,
      minScale: 0.85,
      maxScale: 1.0,
      minRadius: 5.2,
      maxRadius: 5.9,
      pad: 0.1,
    };
    const treeBucket: PropRoleBucket = {
      urls: BIOME_TREE_URLS[biome],
      count: hasLandmark ? 1 : 2,
      minScale: 0.95,
      maxScale: 1.1,
      minRadius: 5.3,
      maxRadius: CLUSTER_R,
      pad: 0.2,
    };
    const storyBucket: PropRoleBucket = {
      urls: traceUrls,
      count: 1,
      minScale: 0.85,
      maxScale: 1.1,
      minRadius: 5.1,
      maxRadius: 6.0,
      pad: 0.1,
    };
    const rockBucket: PropRoleBucket = {
      urls: rockUrls(biome),
      count: 1,
      minScale: 0.95,
      maxScale: 1.1,
      minRadius: 5.0,
      maxRadius: CLUSTER_R,
      pad: 0.1,
    };
    // Foliage tucks in close to the cluster ring — small bushes/flowers/
    // mushrooms/plants drawn from the biome's own scatter layers so each
    // node reads as planted in a biome, not just on a tech pad. Slightly
    // larger than the in-level scatter (which authors at 0.18–0.55) so
    // the silhouettes register at the world map's tilted ortho.
    const foliageBucket: PropRoleBucket = {
      urls: foliage,
      count: foliage.length > 0 ? 2 : 0,
      minScale: 0.6,
      maxScale: 1.0,
      minRadius: 5.0,
      maxRadius: CLUSTER_R,
      pad: 0.05,
    };
    // Dead dinos — only near cleared levels. The player's march of
    // death leaves 1–2 frozen carcasses per conquered node so the trail
    // reads as a few fallen along the way, not a graveyard.
    // Count is drawn from a SEPARATE stream so toggling cleared state
    // (e.g. debug lock/unlock) never advances the shared `rand` and so
    // never reshuffles the surrounding trees/rocks/foliage placement.
    const deadRand = mulberry32(lvl.id * 6151 + 53);
    const deadCount = cleared ? (deadRand() < 0.5 ? 2 : 1) : 0;
    const deadDinoBucket: PropRoleBucket = {
      urls: DEAD_DINO_URLS,
      count: deadCount,
      minScale: 0.9,
      maxScale: 1.1,
      minRadius: 5.3,
      maxRadius: CLUSTER_R,
      pad: 0.15,
    };

    let slotIndex = 0;
    for (const bucket of [
      landmarkBucket,
      moduleBucket,
      storyBucket,
      treeBucket,
      foliageBucket,
      rockBucket,
      deadDinoBucket,
    ]) {
      if (bucket.urls.length === 0 || bucket.count === 0) continue;
      for (let i = 0; i < bucket.count; i++) {
        const inst = tryPlace(center, bucket, rand, baseAngle, slotIndex++);
        if (!inst) continue;
        const existing = perUrl[inst.url] ?? [];
        existing.push(inst);
        perUrl[inst.url] = existing;
      }
    }
  }
  return perUrl;
};

const noRaycast: THREE.Mesh["raycast"] = () => {};

const PropInstancer = ({ url, items }: { url: string; items: PropInstance[] }) => {
  const { scene } = useGLTF(url);

  const { normalizedScale, centerOffset, minY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const target = TARGET_SIZE_BY_ROLE[classifyPropUrl(url)];
    const s = target / maxDim;
    return {
      normalizedScale: s,
      centerOffset: new THREE.Vector3(center.x, center.y, center.z),
      minY: box.min.y,
    };
  }, [scene, url]);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = noRaycast;
    });
  }, [scene]);

  return (
    <group>
      {items.map((it) => {
        const s = normalizedScale * it.scale;
        // Two-level transform so rotY orbits the mesh's VISIBLE center,
        // not the GLB's authored origin. Previously the centerOffset
        // recentering happened on the same node as the rotation, which
        // meant any GLB with a non-zero authored origin (most of them)
        // had its silhouette swing away from `it.pos` as rotY changed —
        // up to centerOffset*s units of drift. The wrapper group fixes
        // both pivots (yaw + side-tilt) on the intended placement point.
        return (
          <group
            key={it.id}
            position={[it.pos.x, -minY * s, it.pos.z]}
            rotation={[0, it.rotY, it.tiltZ ?? 0]}
          >
            <primitive
              object={scene.clone(true)}
              position={[-centerOffset.x * s, 0, -centerOffset.z * s]}
              scale={s}
            />
          </group>
        );
      })}
    </group>
  );
};

export const BiomeProps = () => {
  const progress = useGame((s) => s.progress);
  const plan = useMemo(() => buildPropPlan(progress), [progress]);
  const entries = useMemo(() => Object.entries(plan), [plan]);

  return (
    <>
      {entries.map(([url, items]) =>
        isDeadDinoUrl(url) ? (
          <DeadDinoInstancer key={url} url={url} items={items} />
        ) : (
          <PropInstancer key={url} url={url} items={items} />
        ),
      )}
    </>
  );
};

// Preload URLs actually used by the world map.
const allUrls = new Set<string>();
for (const lvl of LEVELS) {
  const biome: Biome = biomeForPos(lvl.nodePos);
  for (const u of rockUrls(biome)) allUrls.add(u);
  for (const u of storyUrls(biome)) allUrls.add(u);
  for (const u of foliageUrls(biome)) allUrls.add(u);
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
  for (const u of BIOME_LANDMARKS[biome] ?? []) allUrls.add(u);
  for (const u of BIOME_MODULES[biome] ?? []) allUrls.add(u);
}
for (const u of DEAD_DINO_URLS) allUrls.add(u);
for (const u of allUrls) useGLTF.preload(u);
