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
    groundColor: "#475c38",
    pathColor: "#c9a876",
    sceneBg: "#1b2a22",
    fogColor: "#1b2a22",
    fogNear: 32,
    fogFar: 68,
    hemiTop: "#b8dc9c",
    hemiBottom: "#2a1f15",
    startRing: "#4aff88",
    endRing: "#ff4466",
  },
  desert: {
    groundColor: "#b69462",
    pathColor: "#8a6434",
    sceneBg: "#3a2a1c",
    fogColor: "#3a2a1c",
    fogNear: 38,
    fogFar: 80,
    hemiTop: "#f6d9a0",
    hemiBottom: "#5a3a1e",
    startRing: "#ffe08a",
    endRing: "#ff5a3a",
  },
  snow: {
    groundColor: "#c8d6df",
    pathColor: "#88909a",
    sceneBg: "#1c2630",
    fogColor: "#1c2630",
    fogNear: 28,
    fogFar: 62,
    hemiTop: "#e8f0fa",
    hemiBottom: "#324050",
    startRing: "#a8ffe8",
    endRing: "#ff7a9a",
  },
  wasteland: {
    groundColor: "#5a4a38",
    pathColor: "#6b4f36",
    sceneBg: "#261c14",
    fogColor: "#261c14",
    fogNear: 28,
    fogFar: 60,
    hemiTop: "#a88868",
    hemiBottom: "#1a1410",
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
  {
    seed: 7777,
    urls: [
      "/models/nature/Tree1.glb",
      "/models/nature/Tree2.glb",
      "/models/nature/Tree3.glb",
      "/models/nature/Tree4.glb",
    ],
    count: 55,
    clearance: PATH_WIDTH / 2 + 1.6,
    minScale: 0.9,
    maxScale: 1.5,
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
  {
    seed: 7777,
    urls: [
      "/models/biomes/desert/Tree1.glb",
      "/models/biomes/desert/Tree2.glb",
      "/models/biomes/desert/Tree3.glb",
      "/models/biomes/desert/Tree4.glb",
      "/models/biomes/desert/Tree5.glb",
    ],
    count: 35,
    clearance: PATH_WIDTH / 2 + 1.4,
    minScale: 0.9,
    maxScale: 1.6,
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
  {
    seed: 7777,
    urls: [
      "/models/biomes/snow/Tree1.glb",
      "/models/biomes/snow/Tree2.glb",
      "/models/biomes/snow/Tree3.glb",
      "/models/biomes/snow/Tree4.glb",
      "/models/biomes/snow/Tree5.glb",
    ],
    count: 50,
    clearance: PATH_WIDTH / 2 + 1.5,
    minScale: 0.9,
    maxScale: 1.5,
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
  {
    seed: 7777,
    urls: [
      "/models/biomes/wasteland/Tree1.glb",
      "/models/biomes/wasteland/Tree2.glb",
      "/models/biomes/wasteland/Tree3.glb",
      "/models/biomes/wasteland/Tree4.glb",
    ],
    count: 30,
    clearance: PATH_WIDTH / 2 + 1.3,
    minScale: 0.85,
    maxScale: 1.45,
    castShadow: true,
  },
];

export const BIOME_LAYERS: Record<Biome, BiomeLayer[]> = {
  forest: forestLayers(),
  desert: desertLayers(),
  snow: snowLayers(),
  wasteland: wastelandLayers(),
};

export const ALL_BIOME_URLS = Object.values(BIOME_LAYERS).flatMap(ls => ls.flatMap(l => l.urls));
