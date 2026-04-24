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
    groundColor: "#dae6ee",
    pathColor: "#88909a",
    sceneBg: "#c6dcee",
    fogColor: "#dbe8f3",
    fogNear: 44,
    fogFar: 100,
    hemiTop: "#f2f6ff",
    hemiBottom: "#7e8c9c",
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
    pathColor: "#6cffd6",
    sceneBg: "#2a1545",
    fogColor: "#5a3a90",
    fogNear: 40,
    fogFar: 90,
    hemiTop: "#b0a0ff",
    hemiBottom: "#2a1550",
    startRing: "#6cffd6",
    endRing: "#ff66cc",
  },
};

const forestLayers = (): BiomeLayer[] => [
  {
    seed: 1337,
    urls: ["/models/nature/Grass1.glb", "/models/nature/Grass2.glb", "/models/nature/Grass3.glb"],
    count: 220,
    clearance: PATH_WIDTH / 2 + 0.3,
    minScale: 0.6,
    maxScale: 1.1,
    castShadow: false,
  },
  {
    seed: 9001,
    urls: ["/models/nature/Bush1.glb", "/models/nature/Bush2.glb", "/models/nature/Bush3.glb"],
    count: 70,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.75,
    maxScale: 1.35,
    castShadow: false,
  },
  {
    seed: 4242,
    urls: ["/models/nature/Rock1.glb", "/models/nature/Rock2.glb", "/models/nature/Rock3.glb"],
    count: 50,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.2,
    castShadow: true,
    blocks: true,
  },
];

const desertLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: [
      "/models/biomes/desert/Bush1.glb",
      "/models/biomes/desert/Bush2.glb",
      "/models/biomes/desert/Bush3.glb",
    ],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.7,
    maxScale: 1.25,
    castShadow: false,
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/desert/Rock1.glb",
      "/models/biomes/desert/Rock2.glb",
      "/models/biomes/desert/Rock3.glb",
    ],
    count: 60,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.3,
    castShadow: true,
    blocks: true,
  },
];

const snowLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: ["/models/biomes/snow/Bush1.glb", "/models/biomes/snow/Bush2.glb"],
    count: 60,
    clearance: PATH_WIDTH / 2 + 0.7,
    minScale: 0.7,
    maxScale: 1.25,
    castShadow: false,
  },
  {
    seed: 4242,
    // Rock2 + Rock3 pulled — both render as hollow/shelf half-domes you can
    // see into, which reads as a broken mesh (open interior). Rock1 is the
    // solid variant that stays.
    urls: ["/models/biomes/snow/Rock1.glb"],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.75,
    maxScale: 1.35,
    castShadow: true,
    blocks: true,
  },
];

const wastelandLayers = (): BiomeLayer[] => [
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
  },
];

// Lava reuses the wasteland rock set (dark scorched stone) but denser and
// slightly larger, reading as volcanic boulders and slag heaps.
const lavaLayers = (): BiomeLayer[] => [
  {
    seed: 4242,
    urls: [
      "/models/biomes/wasteland/Rock1.glb",
      "/models/biomes/wasteland/Rock2.glb",
      "/models/biomes/wasteland/Rock3.glb",
      "/models/biomes/wasteland/Rock4.glb",
      "/models/biomes/wasteland/Rock5.glb",
    ],
    count: 110,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.6,
    maxScale: 1.55,
    castShadow: true,
    blocks: true,
  },
];

// Alien leans on the Quaternius crystal shards + wasteland rock skeletons.
// Feels like a violet dust plain peppered with gem outcroppings.
const alienLayers = (): BiomeLayer[] => [
  {
    seed: 4242,
    urls: [
      "/models/biomes/wasteland/Rock1.glb",
      "/models/biomes/wasteland/Rock3.glb",
      "/models/biomes/wasteland/Rock5.glb",
    ],
    count: 65,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.35,
    castShadow: true,
    blocks: true,
  },
  {
    seed: 7878,
    urls: ["/models/landmarks/wasteland/Crystal1.glb", "/models/scifi/rock_crystalsLargeA.glb"],
    count: 45,
    clearance: PATH_WIDTH / 2 + 0.8,
    minScale: 0.5,
    maxScale: 1.25,
    castShadow: true,
    blocks: true,
  },
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
  alien: [
    "/models/biomes/wasteland/Tree1.glb",
    "/models/biomes/wasteland/Tree3.glb",
    "/models/biomes/wasteland/Tree4.glb",
    "/models/biomes/wasteland/Tree2.glb",
  ],
};

// Small cosmetic props rendered as decor in levels AND on the world map.
// Only Quaternius-style organic assets and Kenney space-kit sci-fi props
// belong here — man-made wooden props (Barrel, Chest) were swapped for
// sci-fi machine/satellite variants so non-nature biomes read as post-
// human tech, not woodwork. The low-poly blue crystal shards are back
// as small cosmetic sparkle for snow + wasteland; they sit next to the
// Quaternius rocks at cosmetic scale so they don't dominate.
export const BIOME_COSMETICS: Record<Biome, string[]> = {
  forest: [
    "/models/landmarks/forest/Mushroom.glb",
    "/models/scifi/machine_barrel.glb",
    "/models/landmarks/forest/BushFlowers.glb",
  ],
  desert: [
    "/models/landmarks/desert/Skull.glb",
    "/models/scifi/machine_wireless.glb",
    "/models/landmarks/desert/DeadTree.glb",
    "/models/scifi/satelliteDish.glb",
  ],
  // Crystal1 reads as a rock to players but doesn't block placement — pulled
  // so the biome doesn't advertise invalid tiles. Leaving snow cosmetics
  // empty rather than back-filling with an unrelated prop.
  snow: [],
  wasteland: [
    "/models/landmarks/wasteland/Skull.glb",
    "/models/landmarks/wasteland/DeadTree.glb",
    "/models/landmarks/wasteland/Crystal1.glb",
    "/models/scifi/machine_generator.glb",
    "/models/scifi/meteor_detailed.glb",
  ],
  lava: [
    "/models/landmarks/wasteland/Skull.glb",
    "/models/scifi/meteor_detailed.glb",
    "/models/landmarks/wasteland/DeadTree.glb",
    "/models/scifi/machine_barrelLarge.glb",
  ],
  alien: [
    "/models/landmarks/wasteland/Crystal1.glb",
    "/models/scifi/rock_crystalsLargeA.glb",
    "/models/scifi/meteor_detailed.glb",
    "/models/scifi/satelliteDish.glb",
  ],
};

// "Bases" — deliberate clusters of sci-fi props tucked in a corner on
// some levels. A hero structure (hangar/rocket) surrounded by a handful
// of supports (generators, dishes, barrels). Not every level gets one.
// See BiomeBases.tsx for placement logic.
export type BaseRecipe = { hero: string[]; support: string[] };
export const BIOME_BASES: Record<Biome, BaseRecipe | null> = {
  forest: null,
  desert: {
    hero: ["/models/scifi/hangar_smallA.glb", "/models/scifi/rocket_baseA.glb"],
    support: [
      "/models/scifi/machine_generator.glb",
      "/models/scifi/satelliteDish_detailed.glb",
      "/models/scifi/rover.glb",
      "/models/scifi/machine_barrelLarge.glb",
      "/models/scifi/barrels.glb",
    ],
  },
  snow: {
    hero: ["/models/scifi/hangar_smallB.glb", "/models/scifi/structure_closed.glb"],
    support: [
      "/models/scifi/machine_generatorLarge.glb",
      "/models/scifi/satelliteDish.glb",
      "/models/scifi/machine_wirelessCable.glb",
      "/models/scifi/barrels.glb",
    ],
  },
  wasteland: {
    hero: ["/models/scifi/structure_detailed.glb", "/models/scifi/rocket_baseA.glb"],
    support: [
      "/models/scifi/machine_generator.glb",
      "/models/scifi/satelliteDish_large.glb",
      "/models/scifi/meteor_detailed.glb",
      "/models/scifi/turret_single.glb",
      "/models/scifi/rover.glb",
    ],
  },
  lava: {
    hero: ["/models/scifi/structure_detailed.glb", "/models/scifi/rocket_baseA.glb"],
    support: [
      "/models/scifi/machine_generatorLarge.glb",
      "/models/scifi/machine_barrelLarge.glb",
      "/models/scifi/barrels.glb",
      "/models/scifi/meteor_detailed.glb",
      "/models/scifi/turret_single.glb",
    ],
  },
  alien: {
    hero: ["/models/scifi/hangar_smallB.glb", "/models/scifi/structure_closed.glb"],
    support: [
      "/models/scifi/satelliteDish_detailed.glb",
      "/models/scifi/satelliteDish.glb",
      "/models/scifi/machine_wirelessCable.glb",
      "/models/scifi/rock_crystalsLargeA.glb",
      "/models/landmarks/wasteland/Crystal1.glb",
    ],
  },
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
  // skull, torch, barrel, mushroom, crystal, chest, machine_*, rover,
  // turret_single, barrels, satellitedish (small) — small cosmetic items.
  return "cosmetic";
};

export const ALL_BIOME_URLS = [
  ...Object.values(BIOME_LAYERS).flatMap((ls) => ls.flatMap((l) => l.urls)),
  ...Object.values(BIOME_TREE_URLS).flat(),
  ...Object.values(BIOME_COSMETICS).flat(),
  ...Object.values(BIOME_BASES).flatMap((r) => (r ? [...r.hero, ...r.support] : [])),
];
