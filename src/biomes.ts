import { PATH_WIDTH } from "./level";

export type Biome = "forest" | "desert" | "snow" | "wasteland";

export type BiomeLayer = {
  seed: number;
  urls: string[];
  count: number;
  clearance: number;
  minScale: number;
  maxScale: number;
  castShadow: boolean;
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
  },
];

const snowLayers = (): BiomeLayer[] => [
  {
    seed: 9001,
    urls: [
      "/models/biomes/snow/Bush1.glb",
      "/models/biomes/snow/Bush2.glb",
    ],
    count: 60,
    clearance: PATH_WIDTH / 2 + 0.7,
    minScale: 0.7,
    maxScale: 1.25,
    castShadow: false,
  },
  {
    seed: 4242,
    urls: [
      "/models/biomes/snow/Rock1.glb",
      "/models/biomes/snow/Rock2.glb",
      "/models/biomes/snow/Rock3.glb",
    ],
    count: 55,
    clearance: PATH_WIDTH / 2 + 0.9,
    minScale: 0.55,
    maxScale: 1.2,
    castShadow: true,
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
  },
];

export const BIOME_LAYERS: Record<Biome, BiomeLayer[]> = {
  forest: forestLayers(),
  desert: desertLayers(),
  snow: snowLayers(),
  wasteland: wastelandLayers(),
};

// Clearable trees per biome (exactly 4 variants for compatibility with Tree.variant 0..3).
export const BIOME_TREE_URLS: Record<Biome, string[]> = {
  forest: [
    "/models/nature/Tree1.glb",
    "/models/nature/Tree2.glb",
    "/models/nature/Tree3.glb",
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
    "/models/biomes/snow/Tree3.glb",
    "/models/biomes/snow/Tree4.glb",
  ],
  wasteland: [
    "/models/biomes/wasteland/Tree1.glb",
    "/models/biomes/wasteland/Tree2.glb",
    "/models/biomes/wasteland/Tree3.glb",
    "/models/biomes/wasteland/Tree4.glb",
  ],
};

export const ALL_BIOME_URLS = [
  ...Object.values(BIOME_LAYERS).flatMap(ls => ls.flatMap(l => l.urls)),
  ...Object.values(BIOME_TREE_URLS).flat(),
];
