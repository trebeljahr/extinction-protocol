import { useGLTF } from "@react-three/drei";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef } from "react";
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
import { mulberry32 } from "../sim/random";

// World-map decoration. Keep it SPARSE so each level cluster reads as a
// recognizable little vignette rather than a noisy pile: one robot landmark
// where the biome supports it, a small trace prop, then trees/rocks.

type PropInstance = {
  id: string;
  url: string;
  pos: THREE.Vector3;
  rotY: number;
  scale: number;
};

type PropRoleBucket = {
  urls: string[];
  count: number;
  minScale: number;
  maxScale: number;
  clearance: number;
  minRadius: number;
  maxRadius: number;
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

// Pick rocks only out of each biome's layer list — no bushes/grass on
// the world map, they just add noise at this zoom level.
const rockUrls = (biome: Biome): string[] =>
  BIOME_LAYERS[biome]
    .flatMap((l) => l.urls)
    .filter((u) => /rock/i.test(u) || /crystal_(?:large|medium)/i.test(u));

// Wooden / camp props (tent, house, cabin, sawmill, barrel, chest, torch)
// are excluded from the world map. They still render inside levels as
// HQ-area dressing via BiomeCosmetics, but at the world map's tilt + zoom
// they undermined the sci-fi theme — every node should look like a base,
// not a pirate camp.
const WOODEN_RX = /tent|house|cabin|sawmill|barrel\.glb|chest|torch/i;
const storyUrls = (biome: Biome): string[] =>
  BIOME_STORY_PROPS[biome].filter((u) => !WOODEN_RX.test(u));

// Per-level cluster geometry. Props land on composition slots outside
// the clean node bubble so each node reads as a deliberate vignette
// rather than a noisy pile around the marker.
const CLUSTER_R = 7.2;
// Visible node footprint — hit cylinder (1.95) + stars/labels slack.
// Used edge-of-prop → edge-of-node so a wide hangar can't poke into the
// bubble even when its center clears NODE_CLEAR. Previously a center-only
// distance check let asymmetric landmarks graze the bubble.
const NODE_VISIBLE_R = 2.4;
// Center-to-center spacing slack between props on top of summed radii.
// Was applied as `MIN_GAP * 0.25` (≈0.3u), which let trees and rocks
// silhouettes nearly touch on the world map. The full slack reads as
// deliberately spaced.
const MIN_GAP = 1.45;
// Extra gap between a prop's edge and the node's visible footprint. Smaller
// than MIN_GAP because the bubble already reads as a hard target and props
// adjacent to it look like part of the base composition. Combined with
// NODE_VISIBLE_R this guarantees a prop edge sits at least this far past
// the bubble for every node, not just the one this prop belongs to.
const NODE_PROP_GAP = 0.55;
// Was 14 — too low when the disc is 90% full after the landmark drops.
// 28 retries gives the rock placements a real chance to land cleanly.
const MAX_RETRIES = 32;
// Five evenly-spaced angular slots around the node — anchor + module sit
// on opposite sides (slot 0 / slot Math.PI) so they read as one base, the
// remaining slots fan trees / rocks / story away from the bubble.
const COMPOSITION_SLOTS = [0, Math.PI, 1.95, -1.95, Math.PI * 0.5];

const NODE_POSITIONS: { x: number; z: number }[] = LEVELS.map((l) => ({
  x: l.nodePos.x,
  z: -l.nodePos.y,
}));

const buildPropPlan = () => {
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
      const radius = bucket.clearance * scale;

      let bad = false;
      // Edge-of-prop → edge-of-node check. `radius` is the prop's
      // half-footprint at its sampled scale; node visible radius is the
      // bubble + label slack. Sum + NODE_PROP_GAP ensures the rendered
      // silhouette never overlaps a level bubble for ANY node, not just
      // this one. (The MIN_GAP slack used for prop↔prop spacing would be
      // too aggressive here — base modules deliberately read as adjacent
      // to the bubble.)
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
      const url = bucket.urls[Math.floor(rand() * bucket.urls.length)];
      return {
        id: nanoid(),
        url,
        pos: new THREE.Vector3(x, 0, z),
        rotY: rand() * Math.PI * 2,
        scale,
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
    const baseAngle = rand() * Math.PI * 2;
    const hasLandmark = landmarkUrls.length > 0;

    // Scale ranges are kept tight (0.95–1.1) so props within a role look
    // like siblings rather than random sizes — the *role* provides the
    // variation between classes.
    const landmarkBucket: PropRoleBucket = {
      urls: landmarkUrls,
      count: 1,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 1.9,
      // Inner edge accounts for radius (1.9*1.1=2.09) + NODE_VISIBLE_R
      // (2.4) + NODE_PROP_GAP (0.55) = 5.04 minimum. 5.2 gives some
      // slack so most attempts land cleanly without exhausting retries.
      minRadius: 5.2,
      maxRadius: 6.0,
    };
    // Modular accent — small sci-fi outbuilding placed on the opposite side
    // of the node from the anchor. Smaller radius range so it nestles up
    // next to the bubble like a sibling structure of the main base.
    const moduleBucket: PropRoleBucket = {
      urls: moduleUrls,
      count: hasLandmark ? 1 : 0,
      minScale: 0.85,
      maxScale: 1.0,
      clearance: 1.4,
      minRadius: 4.9,
      maxRadius: 5.7,
    };
    const treeBucket: PropRoleBucket = {
      urls: BIOME_TREE_URLS[biome],
      count: hasLandmark ? 1 : 2,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 1.2,
      minRadius: 5.2,
      maxRadius: CLUSTER_R,
    };
    const storyBucket: PropRoleBucket = {
      urls: traceUrls,
      count: 1,
      minScale: 0.85,
      maxScale: 1.1,
      clearance: 0.85,
      minRadius: 5.0,
      maxRadius: 6.0,
    };
    const rockBucket: PropRoleBucket = {
      urls: rockUrls(biome),
      count: 1,
      minScale: 0.95,
      maxScale: 1.1,
      clearance: 0.6,
      minRadius: 5.0,
      maxRadius: CLUSTER_R,
    };

    let slotIndex = 0;
    for (const bucket of [landmarkBucket, moduleBucket, storyBucket, treeBucket, rockBucket]) {
      if (bucket.urls.length === 0) continue;
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
  const groupRef = useRef<THREE.Group>(null);

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
      // Decorative — never block clicks/hovers on the level node it
      // surrounds.
      m.raycast = noRaycast;
    });
  }, [scene]);

  return (
    <group ref={groupRef}>
      {items.map((it) => {
        const s = normalizedScale * it.scale;
        return (
          <primitive
            key={it.id}
            object={scene.clone(true)}
            position={[it.pos.x - centerOffset.x * s, -minY * s, it.pos.z - centerOffset.z * s]}
            rotation={[0, it.rotY, 0]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

export const BiomeProps = () => {
  const plan = useMemo(() => buildPropPlan(), []);
  const entries = useMemo(() => Object.entries(plan), [plan]);

  return (
    <>
      {entries.map(([url, items]) => (
        <PropInstancer key={url} url={url} items={items} />
      ))}
    </>
  );
};

// Preload URLs actually used by the world map.
const allUrls = new Set<string>();
for (const lvl of LEVELS) {
  const biome: Biome = biomeForPos(lvl.nodePos);
  for (const u of rockUrls(biome)) allUrls.add(u);
  for (const u of storyUrls(biome)) allUrls.add(u);
  for (const u of BIOME_TREE_URLS[biome]) allUrls.add(u);
  for (const u of BIOME_LANDMARKS[biome] ?? []) allUrls.add(u);
  for (const u of BIOME_MODULES[biome] ?? []) allUrls.add(u);
}
for (const u of allUrls) useGLTF.preload(u);
