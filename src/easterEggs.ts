import type { AchievementId } from "./achievements";
import type { Biome } from "./biomes";

export type EasterEggEffect = {
  particleColor: string;
  particleCount: number;
  particleSpeed?: [number, number];
  particleLife?: number;
  // Secondary burst rendered after the primary (for sparkle/flame layering).
  secondary?: { color: string; count: number; speed?: [number, number]; life?: number };
};

// Moving eggs roll or drive in a straight line across the map. Spawned by
// the engine at a scheduled time rather than pre-placed in createWorld.
export type EasterEggMotion = {
  kind: "traverse";
  speed: number;       // world units per second
  lifetime: number;    // seconds until auto-despawn
  spinRate?: number;   // radians/sec around Y (tumbleweeds spin visually)
};

// When set, this egg spawns at a random moment during gameplay rather
// than at level start. Paired with motion to produce a moving cameo.
export type EasterEggSchedule = {
  earliestSec: number;
  latestSec: number;
};

export type EasterEggDef = {
  id: string;
  achievement: AchievementId;
  biomes: Biome[];
  model: string;
  targetSize: number;
  clickThreshold: number;
  effect: EasterEggEffect;
  motion?: EasterEggMotion;
  scheduled?: EasterEggSchedule;
};

export const EASTER_EGG_DEFS: EasterEggDef[] = [
  {
    id: "skull",
    achievement: "whispering_skull",
    biomes: ["desert", "wasteland"],
    model: "/models/landmarks/wasteland/Skull.glb",
    targetSize: 1.0,
    clickThreshold: 1,
    effect: { particleColor: "#cfd8e0", particleCount: 16, particleSpeed: [1.5, 3.5], particleLife: 0.5 },
  },
  {
    id: "mushroom",
    achievement: "mushroom_puff",
    biomes: ["forest"],
    model: "/models/landmarks/forest/Mushroom.glb",
    targetSize: 1.0,
    clickThreshold: 1,
    effect: { particleColor: "#c8f2a4", particleCount: 14, particleSpeed: [1.5, 3.5], particleLife: 0.45 },
  },
  {
    id: "torch",
    achievement: "torch_lit",
    biomes: ["snow"],
    model: "/models/landmarks/snow/Torch.glb",
    targetSize: 1.2,
    clickThreshold: 1,
    effect: {
      particleColor: "#ffb266",
      particleCount: 18,
      particleSpeed: [2, 4.5],
      particleLife: 0.55,
      secondary: { color: "#fff2c8", count: 10, speed: [1.5, 3], life: 0.35 },
    },
  },
  {
    id: "barrel",
    achievement: "barrel_roll",
    biomes: ["forest"],
    model: "/models/landmarks/forest/Barrel.glb",
    targetSize: 1.0,
    clickThreshold: 1,
    effect: { particleColor: "#a07046", particleCount: 14, particleSpeed: [2, 4], particleLife: 0.5 },
  },
  {
    id: "cabin",
    achievement: "cabin_smoke",
    biomes: ["snow"],
    model: "/models/landmarks/snow/Cabin.glb",
    targetSize: 2.2,
    clickThreshold: 1,
    effect: { particleColor: "#e2e8ee", particleCount: 20, particleSpeed: [1, 2.5], particleLife: 0.9 },
  },
  {
    id: "crystal",
    achievement: "crystal_shatter",
    biomes: ["snow", "wasteland"],
    model: "/models/landmarks/snow/Crystal1.glb",
    targetSize: 1.1,
    clickThreshold: 5,
    effect: {
      particleColor: "#aaf0ff",
      particleCount: 24,
      particleSpeed: [3, 6],
      particleLife: 0.7,
      secondary: { color: "#e8faff", count: 14, speed: [1.5, 3.5], life: 0.5 },
    },
  },
  {
    id: "cactus",
    achievement: "cactus_bloom",
    biomes: ["desert"],
    model: "/models/biomes/desert/Tree5.glb",
    targetSize: 1.5,
    clickThreshold: 1,
    effect: {
      particleColor: "#ff88ba",
      particleCount: 18,
      particleSpeed: [1.5, 3.5],
      particleLife: 0.7,
      secondary: { color: "#ffd0e4", count: 10, speed: [1, 2.5], life: 0.5 },
    },
  },
  {
    id: "glyph",
    achievement: "ancient_glyph",
    biomes: ["desert"],
    model: "/models/scifi/rock_crystalsLargeA.glb",
    targetSize: 1.3,
    clickThreshold: 3,
    effect: {
      particleColor: "#7ff0d0",
      particleCount: 20,
      particleSpeed: [2, 4.5],
      particleLife: 0.7,
      secondary: { color: "#aaf0ff", count: 12, speed: [1, 2.5], life: 0.5 },
    },
  },
  {
    id: "radio",
    achievement: "rusted_radio",
    biomes: ["wasteland"],
    model: "/models/scifi/machine_wirelessCable.glb",
    targetSize: 1.5,
    clickThreshold: 1,
    effect: {
      particleColor: "#9ff08c",
      particleCount: 16,
      particleSpeed: [2, 4],
      particleLife: 0.6,
      secondary: { color: "#ff9966", count: 10, speed: [1.5, 3], life: 0.4 },
    },
  },
  {
    id: "satellite",
    achievement: "satellite_ping",
    biomes: ["desert", "wasteland"],
    model: "/models/scifi/satelliteDish_large.glb",
    targetSize: 1.8,
    clickThreshold: 1,
    effect: {
      particleColor: "#9fd8ff",
      particleCount: 20,
      particleSpeed: [2.5, 5],
      particleLife: 0.8,
      secondary: { color: "#e8faff", count: 12, speed: [1.5, 3], life: 0.5 },
    },
  },
  {
    id: "fairy",
    achievement: "fairy_ring",
    biomes: ["forest"],
    model: "/models/landmarks/forest/BushFlowers.glb",
    targetSize: 1.2,
    clickThreshold: 3,
    effect: {
      particleColor: "#ffd66a",
      particleCount: 18,
      particleSpeed: [2, 4.5],
      particleLife: 0.7,
      secondary: { color: "#ff88ba", count: 12, speed: [1.5, 3.5], life: 0.5 },
    },
  },
  {
    id: "rocket",
    achievement: "rocket_launch",
    biomes: ["desert", "wasteland"],
    model: "/models/scifi/rocket_baseA.glb",
    targetSize: 2.2,
    clickThreshold: 3,
    effect: {
      particleColor: "#ff9966",
      particleCount: 28,
      particleSpeed: [3, 7],
      particleLife: 0.9,
      secondary: { color: "#fff2c8", count: 18, speed: [2, 5], life: 0.6 },
    },
  },
  {
    id: "tumbleweed",
    achievement: "tumbleweed",
    biomes: ["desert"],
    model: "/models/biomes/desert/Bush3.glb",
    targetSize: 1.1,
    clickThreshold: 1,
    effect: {
      particleColor: "#c8a264",
      particleCount: 20,
      particleSpeed: [2, 4.5],
      particleLife: 0.6,
      secondary: { color: "#e8d2a0", count: 12, speed: [1.5, 3], life: 0.4 },
    },
    motion: { kind: "traverse", speed: 6, lifetime: 9, spinRate: 6 },
    scheduled: { earliestSec: 25, latestSec: 90 },
  },
  {
    id: "rover",
    achievement: "rover_roam",
    biomes: ["wasteland"],
    model: "/models/scifi/rover.glb",
    targetSize: 1.8,
    clickThreshold: 1,
    effect: {
      particleColor: "#9fd8ff",
      particleCount: 20,
      particleSpeed: [2, 4.5],
      particleLife: 0.6,
      secondary: { color: "#a08060", count: 14, speed: [1.5, 3.5], life: 0.55 },
    },
    motion: { kind: "traverse", speed: 4, lifetime: 14 },
    scheduled: { earliestSec: 30, latestSec: 120 },
  },
];

export const EASTER_EGG_BY_ID: Record<string, EasterEggDef> = Object.fromEntries(
  EASTER_EGG_DEFS.map(d => [d.id, d]),
);

export const PRELOAD_URLS: string[] = Array.from(new Set(EASTER_EGG_DEFS.map(d => d.model)));
