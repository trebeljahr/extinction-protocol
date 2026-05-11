import { PATH_WIDTH } from "./level";

export type Biome = "forest" | "desert" | "snow" | "wasteland" | "lava" | "alien";

/**
 * Map-authoritative biome — purely y-banded so the level IDs align cleanly
 * with a single biome each (five levels per band). Reading bottom→top:
 *   band 1  y ≤ -9  : forest     (L1-L5)
 *   band 2  y ≤ -2  : snow       (L6-L10)
 *   band 3  y ≤  5  : desert     (L11-L15)
 *   band 4  y ≤ 12  : wasteland  (L16-L20)
 *   band 5  y ≤ 19  : lava       (L21-L25)
 *   band 6  y  > 19 : alien      (L26-L30)
 */
export const biomeForPos = ({ y }: { x: number; y: number }): Biome => {
  if (y <= -9) return "forest";
  if (y <= -2) return "snow";
  if (y <= 5) return "desert";
  if (y <= 12) return "wasteland";
  if (y <= 19) return "lava";
  return "alien";
};

export type BiomeLayer = {
  seed: number;
  urls: string[];
  count: number;
  clearance: number;
  minScale: number;
  maxScale: number;
  castShadow: boolean;
  blocks?: boolean;
  // Effective half-radius (world units) used by Ground.tsx for non-blocking
  // layer prop↔prop spacing. Multiplied by per-instance scale at placement
  // time. Defaults are set in Ground.tsx based on the URL pattern, so
  // existing layer defs don't need to be touched.
  footprint?: number;
  // When set, the layer uses gaussian-clustered placement instead of
  // uniform scatter. Reads as deliberate huddles ("grass tufts behind
  // a rock", "bush thicket in a corner") rather than wallpaper.
  cluster?: { seeds: number; sigma: number };
};

export type BiomeStyle = {
  groundColor: string;
  pathColor: string;
  sceneBg: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  hemiTop: string;
  hemiBottom: string;
  startRing: string;
  endRing: string;
};

export const BIOME_STYLE: Record<Biome, BiomeStyle> = {
  forest: {
    groundColor: "#5c7848",
    pathColor: "#c9a876",
    sceneBg: "#a7cbe3",
    fogColor: "#c4dcec",
    fogNear: 48,
    fogFar: 110,
    hemiTop: "#bcd8ff",
    hemiBottom: "#5a4a2a",
    startRing: "#4aff88",
    endRing: "#ff4466",
  },
  desert: {
    groundColor: "#cba878",
    pathColor: "#8a6434",
    sceneBg: "#d9c194",
    fogColor: "#e6d0a2",
    fogNear: 48,
    fogFar: 110,
    hemiTop: "#ffe4b0",
    hemiBottom: "#7a5028",
    startRing: "#ffe08a",
    endRing: "#ff5a3a",
  },
  snow: {
    groundColor: "#a0b2c2",
    pathColor: "#6a7a88",
    sceneBg: "#8eaac0",
    fogColor: "#98b0c2",
    fogNear: 38,
    fogFar: 88,
    hemiTop: "#c0d0e0",
    hemiBottom: "#506070",
    startRing: "#a8ffe8",
    endRing: "#ff7a9a",
  },
  wasteland: {
    groundColor: "#7a6148",
    pathColor: "#6b4f36",
    sceneBg: "#caa688",
    fogColor: "#d8bc9a",
    fogNear: 44,
    fogFar: 96,
    hemiTop: "#e8c8a8",
    hemiBottom: "#5a4030",
    startRing: "#ffcf6a",
    endRing: "#ff5252",
  },
  // Scorched volcanic basin — dark cracked ground, dark scorched-stone
  // paths, bright magma reserved for rivers/lakes (LavaFeatures.tsx).
  // Hazy ember-tinted sky, tight fog for oppressive feel.
  lava: {
    groundColor: "#3a1c12",
    pathColor: "#5a3a24",
    sceneBg: "#4a1a18",
    fogColor: "#9a3420",
    fogNear: 36,
    fogFar: 82,
    hemiTop: "#ffb060",
    hemiBottom: "#5a1a10",
    startRing: "#ff9050",
    endRing: "#ffe060",
  },
  // Alien reaches — violet dust plains, cyan crystal veins, greenish haze.
  // Cool-toned and eerie, pushing into out-of-this-world territory.
  alien: {
    groundColor: "#3a2060",
    // Path is the walkable strip — kept a muted violet–stone tone so it reads
    // as ground, not as a neon-cyan ribbon. The "alien-ness" comes from goo
    // rivers/lakes (see lavaGeometry generalised for alien biome) and the
    // Ultimate Space Kit vegetation, not from a glowing path.
    pathColor: "#5a4880",
    sceneBg: "#2a1545",
    fogColor: "#5a3a90",
    fogNear: 40,
    fogFar: 90,
    hemiTop: "#b0a0ff",
    hemiBottom: "#2a1550",
    // Subdued rings — same pale violet as the path, just slightly lifted to
    // mark spawn/objective without screaming.
    startRing: "#9a7fff",
    endRing: "#ffb0e8",
  },
};

const forestLayers = (): BiomeLayer[] => [
  {
    seed: 1337,
    urls: ["/models/nature/Grass1.glb", "/models/nature/Grass2.glb", "/models/nature/Grass3.glb"],
    // Reduced from 220 — Ground.tsx now spaces against trees/rocks/other
    // decor, so the old over-count just made the placement loop give up
    // early. Cluster mode reads as "tufts of grass" instead of wallpaper.
    count: 160,
    clearance: PATH_WIDTH / 2 + 0.3,
    minScale: 0.6,
    maxScale: 1.1,
    castShadow: false,
    footprint: 0.28,
    cluster: { seeds: 8, sigma: 2.2 },
  },
  {
    seed: 9001,
    urls: ["/models/nature/Bush1.glb", "/models/nature/Bush2.glb", "/models/nature/Bush3.glb"],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.45,
    maxScale: 0.75,
    castShadow: false,
    footprint: 0.35,
    cluster: { seeds: 6, sigma: 2.0 },
  },
  {
    seed: 4242,
    urls: ["/models/nature/Rock1.glb", "/models/nature/Rock2.glb", "/models/nature/Rock3.glb"],
    count: 40,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.2,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 5, sigma: 3.0 },
  },
  {
    seed: 6464,
    // Mushroom.glb authored 0.78 max-dim; 0.65–1.25 → ~0.5–1.0 world units.
    // Previously rendered as non-clickable cosmetic at the same visible
    // size, which read as a small obstacle but couldn't be removed.
    urls: ["/models/landmarks/forest/Mushroom.glb"],
    count: 10,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.65,
    maxScale: 1.25,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 3, sigma: 2.0 },
  },
];

// Dead-tree props read as "tree-sized" silhouettes; promoted from cosmetic
// to a blocking layer so the player can clear them and they don't sit in
// build slots permanently. Scale overrides exist because the desert
// DeadTree.glb is authored at ~16 units tall — 5–7x larger than other tree
// models. Defaults are tuned so the rendered size lands around 2–3.5 world
// units; callers can override for biomes that want them smaller.
const DEAD_TREE_LAYER = (
  url: string,
  count: number,
  seed: number,
  minScale = 0.12,
  maxScale = 0.21,
): BiomeLayer => ({
  seed,
  urls: [url],
  count,
  clearance: PATH_WIDTH / 2 + 1.3,
  minScale,
  maxScale,
  castShadow: true,
  blocks: true,
});

const desertLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: [
      "/models/biomes/desert/Bush1.glb",
      "/models/biomes/desert/Bush2.glb",
      "/models/biomes/desert/Bush3.glb",
    ],
    count: 50,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.45,
    maxScale: 0.75,
    castShadow: false,
    footprint: 0.35,
    cluster: { seeds: 5, sigma: 2.4 },
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/desert/Rock1.glb",
      "/models/biomes/desert/Rock2.glb",
      "/models/biomes/desert/Rock3.glb",
    ],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.3,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 5, sigma: 3.5 },
  },
  {
    seed: 6464,
    // Skull.glb authored 0.51 max-dim; 0.8–1.6 → ~0.4–0.8 world units.
    // Sun-bleached bones read as scattered rock-sized obstacles.
    urls: ["/models/landmarks/desert/Skull.glb"],
    count: 9,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.8,
    maxScale: 1.6,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 3, sigma: 2.6 },
  },
  DEAD_TREE_LAYER("/models/landmarks/desert/DeadTree.glb", 6, 5151, 0.09, 0.15),
];

const snowLayers = (): BiomeLayer[] => [
  {
    seed: 1337,
    // Forest grass tufts read as patchy tundra grass poking through the
    // snow — adds a second small-silhouette layer so the ground isn't
    // 100% white. Tight clusters in a few pockets, not blanket coverage.
    urls: ["/models/nature/Grass1.glb", "/models/nature/Grass2.glb", "/models/nature/Grass3.glb"],
    count: 70,
    clearance: PATH_WIDTH / 2 + 0.3,
    minScale: 0.5,
    maxScale: 0.95,
    castShadow: false,
    footprint: 0.28,
    cluster: { seeds: 5, sigma: 1.6 },
  },
  {
    seed: 9001,
    // The Quaternius "snow bush" assets render as solid-white layered discs
    // — indistinguishable from the snow rocks at top-down camera distance,
    // so the level reads as a sea of identical white blobs. Swapped for the
    // forest bush set: small green shrubs poking through snow give the
    // ground a second silhouette and read as boreal vegetation.
    urls: ["/models/nature/Bush1.glb", "/models/nature/Bush2.glb", "/models/nature/Bush3.glb"],
    count: 36,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.45,
    maxScale: 0.75,
    castShadow: false,
    footprint: 0.35,
    cluster: { seeds: 5, sigma: 1.8 },
  },
  {
    seed: 4242,
    // Rock2 + Rock3 pulled — both render as hollow/shelf half-domes you can
    // see into, which reads as a broken mesh (open interior). Rock1 is the
    // solid variant that stays.
    urls: ["/models/biomes/snow/Rock1.glb"],
    count: 42,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.7,
    maxScale: 1.4,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 4, sigma: 2.8 },
  },
];

const wastelandLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: [
      "/models/biomes/desert/Bush1.glb",
      "/models/biomes/desert/Bush2.glb",
      "/models/biomes/desert/Bush3.glb",
    ],
    count: 28,
    clearance: PATH_WIDTH / 2 + 0.6,
    minScale: 0.55,
    maxScale: 1.05,
    castShadow: false,
    footprint: 0.5,
    cluster: { seeds: 4, sigma: 2.5 },
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/wasteland/Rock1.glb",
      "/models/biomes/wasteland/Rock2.glb",
      "/models/biomes/wasteland/Rock3.glb",
      "/models/biomes/wasteland/Rock4.glb",
      "/models/biomes/wasteland/Rock5.glb",
    ],
    count: 90,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.55,
    maxScale: 1.4,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 7, sigma: 3.2 },
  },
  {
    seed: 6464,
    urls: ["/models/landmarks/wasteland/Skull.glb"],
    count: 8,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.8,
    maxScale: 1.6,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 3, sigma: 2.6 },
  },
  DEAD_TREE_LAYER("/models/landmarks/wasteland/DeadTree.glb", 8, 5151),
];

// Lava reuses the wasteland rock set (dark scorched stone) but denser and
// slightly larger, reading as volcanic boulders and slag heaps. Adds a
// crystal-rock blocker layer so every clearable obstacle has a readable
// silhouette. Small skulls/crystals run *before* the dense rock layer so
// they still get placement slots — lava paths + lakes eat most open
// terrain, and 110 wasteland rocks would otherwise saturate it first.
const lavaLayers = (): BiomeLayer[] => [
  {
    seed: 6464,
    urls: ["/models/landmarks/wasteland/Skull.glb", "/models/landmarks/wasteland/Crystal1.glb"],
    // Skull 0.51 max-dim and Crystal1 0.42 max-dim are similar enough to
    // share a layer; scale 0.9–1.7 lands ~0.45–0.85 world units for both.
    count: 12,
    clearance: PATH_WIDTH / 2 + 0.5,
    minScale: 0.9,
    maxScale: 1.7,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 4, sigma: 2.6 },
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/wasteland/Rock1.glb",
      "/models/biomes/wasteland/Rock2.glb",
      "/models/biomes/wasteland/Rock3.glb",
      "/models/biomes/wasteland/Rock4.glb",
      "/models/biomes/wasteland/Rock5.glb",
    ],
    count: 100,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.6,
    maxScale: 1.55,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 8, sigma: 3.0 },
  },
  {
    seed: 7878,
    urls: ["/models/scifi/rock_crystalsLargeA.glb"],
    count: 14,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.55,
    maxScale: 1.0,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 3, sigma: 2.5 },
  },
  DEAD_TREE_LAYER("/models/landmarks/wasteland/DeadTree.glb", 6, 5151),
];

// Alien uses Quaternius Crystal Pack blue crystals as the signature
// blocking element. Large + medium variants give readable silhouettes;
// small shards are promoted to a blocking layer so they're removable
// instead of non-interactive scenery. Bush/Plant layer is also blocking:
// previously they sat as 1–4 world-unit "ground cover" the player tried
// to click and couldn't — now they read as the obstacles they look like.
const alienLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: [
      "/models/biomes/alien/Bush_1.gltf",
      "/models/biomes/alien/Bush_2.gltf",
      "/models/biomes/alien/Bush_3.gltf",
      "/models/biomes/alien/Plant_1.gltf",
      "/models/biomes/alien/Plant_2.gltf",
      "/models/biomes/alien/Plant_3.gltf",
    ],
    // Authored 1.82–3.26 max-dim; 0.22–0.45 lands ~0.4–1.5 world units
    // (rock-sized) across the variants, so every plant reads as a
    // removable obstacle rather than a tree-sized blob.
    count: 28,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.22,
    maxScale: 0.45,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 6, sigma: 2.4 },
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/wasteland/Rock1.glb",
      "/models/biomes/wasteland/Rock3.glb",
      "/models/biomes/wasteland/Rock5.glb",
    ],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.35,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 5, sigma: 3.0 },
  },
  {
    seed: 7878,
    urls: [
      "/models/biomes/alien/Crystal_Large_1.glb",
      "/models/biomes/alien/Crystal_Large_2.glb",
      "/models/biomes/alien/Crystal_Medium_1.glb",
      "/models/biomes/alien/Crystal_Medium_2.glb",
    ],
    count: 20,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.09,
    maxScale: 0.16,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 4, sigma: 2.5 },
  },
  {
    seed: 3434,
    urls: ["/models/biomes/alien/Crystal_Small_1.glb", "/models/biomes/alien/Crystal_Small_2.glb"],
    // Authored 5.26 and 6.87 max-dim; 0.07–0.13 lands ~0.4–0.9 world units.
    // Small but still clearly clickable, so the shards under the bigger
    // crystals get the same remove-flow as everything else.
    count: 14,
    clearance: PATH_WIDTH / 2 + 0.6,
    minScale: 0.07,
    maxScale: 0.13,
    castShadow: true,
    blocks: true,
    cluster: { seeds: 4, sigma: 2.4 },
  },
  {
    seed: 6161,
    urls: ["/models/scifi/hangar_smallB.glb", "/models/scifi/structure_closed.glb"],
    count: 2,
    clearance: PATH_WIDTH / 2 + 2.5,
    minScale: 0.6,
    maxScale: 0.85,
    castShadow: true,
    blocks: true,
  },
  DEAD_TREE_LAYER("/models/biomes/alien/Tree_Light_1.gltf", 8, 5151, 0.55, 0.85),
];

export const BIOME_LAYERS: Record<Biome, BiomeLayer[]> = {
  forest: forestLayers(),
  desert: desertLayers(),
  snow: snowLayers(),
  wasteland: wastelandLayers(),
  lava: lavaLayers(),
  alien: alienLayers(),
};

// Clearable trees per biome (exactly 4 variants for compatibility with Tree.variant 0..3).
export const BIOME_TREE_URLS: Record<Biome, string[]> = {
  forest: [
    "/models/nature/Tree1.glb",
    "/models/nature/Tree2.glb",
    // Tree3 was the 'shiny cluster of polyhedra' variant that reads as
    // broken — swapped for another Tree1 so the slot still has 4 entries.
    "/models/nature/Tree1.glb",
    "/models/nature/Tree4.glb",
  ],
  desert: [
    "/models/biomes/desert/Tree1.glb",
    "/models/biomes/desert/Tree2.glb",
    "/models/biomes/desert/Tree3.glb",
    "/models/biomes/desert/Tree4.glb",
  ],
  snow: [
    "/models/biomes/snow/Tree1.glb",
    "/models/biomes/snow/Tree2.glb",
    // Tree3 pulled — it renders with a shiny material and holes punched
    // through the trunk; swapped the slot for Tree5 which is a clean
    // snow-capped pine.
    "/models/biomes/snow/Tree5.glb",
    "/models/biomes/snow/Tree4.glb",
  ],
  wasteland: [
    "/models/biomes/wasteland/Tree1.glb",
    "/models/biomes/wasteland/Tree2.glb",
    "/models/biomes/wasteland/Tree3.glb",
    "/models/biomes/wasteland/Tree4.glb",
  ],
  // Lava and alien both reuse the wasteland dead-tree set — no real
  // vegetation survives either environment, and the skeletal silhouettes
  // read correctly for volcanic ash fields and alien mesa.
  lava: [
    "/models/biomes/wasteland/Tree1.glb",
    "/models/biomes/wasteland/Tree2.glb",
    "/models/biomes/wasteland/Tree3.glb",
    "/models/biomes/wasteland/Tree4.glb",
  ],
  // Quaternius Ultimate Space Kit — actual alien vegetation, not the
  // wasteland skeletons we used as a stand-in. Picked four shapes that read
  // as silhouettes from above (Spikes, Swirl, Blob, Spiral).
  alien: [
    "/models/biomes/alien/Tree_Spikes_1.gltf",
    "/models/biomes/alien/Tree_Swirl_1.gltf",
    "/models/biomes/alien/Tree_Blob_1.gltf",
    "/models/biomes/alien/Tree_Spiral_1.gltf",
  ],
};

// Small cosmetic props scattered across levels — strictly ground-decor
// that reads as flat texture, not as an obstacle. Anything that looked
// like a placement-blocker silhouette (meteors, machines, mushrooms,
// skulls, crystals) was promoted to a blocking layer in BIOME_LAYERS so
// it goes through the click+clear flow with every other rock-sized prop.
// Only BushFlowers remains: authored at 1.97 max-dim but normalized down
// to 0.18–0.36 world units, it reads as a flat flower patch, not an
// obstacle.
export const BIOME_COSMETICS: Record<Biome, string[]> = {
  forest: ["/models/landmarks/forest/BushFlowers.glb"],
  desert: [],
  snow: [],
  wasteland: [],
  lava: [],
  alien: [],
};

// Visual-role classification + target sizes so props on the world map (and
// in levels) read with a sensible hierarchy:
//   buildings > trees > bushes ≈ rocks > cosmetics ≈ grass
// Each GLB gets normalized to `maxDim == TARGET_SIZE_BY_ROLE[role]` regardless
// of the authored mesh scale, so packs with inconsistent exports still line up.
export type PropRole = "building" | "tree" | "bush" | "rock" | "grass" | "cosmetic";

// Target visual max-dim (in world units) per role. Gaps are wide so the
// hierarchy reads from any camera distance: buildings and trees are
// roughly siblings (buildings slightly taller), rocks are ~1/3 of a tree,
// cosmetics are quiet dressing half the size of a rock.
export const TARGET_SIZE_BY_ROLE: Record<PropRole, number> = {
  building: 2.8,
  tree: 2.4,
  bush: 0.85,
  rock: 0.7,
  grass: 0.4,
  cosmetic: 0.5,
};

export const classifyPropUrl = (url: string): PropRole => {
  const f = url.toLowerCase();
  // Large sci-fi structures sit in the building slot so they anchor
  // bases the way houses/cabins anchor nature biomes.
  if (/hangar_|rocket_|structure_|gate_|satellitedish_(?:large|detailed)/.test(f))
    return "building";
  if (/house|cabin|sawmill|tent|ruins|tower_/.test(f)) return "building";
  if (/tree|deadtree/.test(f)) return "tree";
  if (/bushflowers/.test(f)) return "cosmetic";
  if (/bush/.test(f)) return "bush";
  if (/grass/.test(f)) return "grass";
  // Meteors read as rocks — similar role in a scene.
  if (/rock|meteor/.test(f)) return "rock";
  if (/crystal_(?:large|medium)/.test(f)) return "rock";
  return "cosmetic";
};

export const ALL_BIOME_URLS = [
  ...Object.values(BIOME_LAYERS).flatMap((ls) => ls.flatMap((l) => l.urls)),
  ...Object.values(BIOME_TREE_URLS).flat(),
  ...Object.values(BIOME_COSMETICS).flat(),
];
