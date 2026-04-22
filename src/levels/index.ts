import type { Vec2, WaveSpec, EnemyKind, EnemySpec, WaveArchetype } from "../sim/types";
import type { Biome } from "../biomes";

export type LevelConfig = {
  id: number;
  name: string;
  paths: Vec2[][];
  waves: WaveSpec[];
  startGold: number;
  nodePos: { x: number; y: number };
  hpScale?: number;
  biome?: Biome;
  slotCount?: number;
};

const p = (...coords: number[]): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i < coords.length; i += 2) out.push({ x: coords[i], y: coords[i + 1] });
  return out;
};

type EnemyCounts = {
  raptor?: number;
  swarm?: number;
  para?: number;
  allosaur?: number;
  stego?: number;
  armored?: number;
  titan?: number;
};

const SPAWN_ORDER: EnemyKind[] = ["raptor", "swarm", "para", "allosaur", "stego", "armored", "titan"];

const toSpawns = (c: EnemyCounts, pathIndex = 0): EnemySpec[] =>
  SPAWN_ORDER
    .filter(k => (c[k] ?? 0) > 0)
    .map(k => ({ kind: k, count: c[k]!, pathIndex }));

const intro = (raptor: number, swarm = 0, pathIndex = 0): WaveSpec => ({
  archetype: "intro",
  spacing: 0.9,
  spawns: toSpawns({ raptor, swarm }, pathIndex),
});

const mixed = (c: EnemyCounts, spacing = 0.5, pathIndex = 0): WaveSpec => ({
  archetype: "mixed",
  spacing,
  spawns: toSpawns(c, pathIndex),
});

const rush = (swarm: number, raptor = 0, pathIndex = 0): WaveSpec => ({
  archetype: "swarm",
  spacing: 0.11,
  spawns: toSpawns({ swarm, raptor }, pathIndex),
});

const heavy = (c: EnemyCounts, spacing = 0.95, pathIndex = 0): WaveSpec => ({
  archetype: "heavy",
  spacing,
  spawns: toSpawns(c, pathIndex),
});

const chaos = (c: EnemyCounts, spacing = 0.32, pathIndex = 0): WaveSpec => ({
  archetype: "chaos",
  spacing,
  spawns: toSpawns(c, pathIndex),
});

const split = (
  archetype: WaveArchetype,
  spacing: number,
  ...groups: [pathIndex: number, counts: EnemyCounts][]
): WaveSpec => ({
  archetype,
  spacing,
  spawns: groups.flatMap(([pi, c]) => toSpawns(c, pi)),
});

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Jungle Outpost",
    paths: [p(-20, 0, 20, 0)],
    startGold: 220,
    nodePos: { x: -30, y: -14 },
    waves: [
      intro(6),
      intro(10, 4),
      mixed({ raptor: 12, swarm: 6, allosaur: 1 }),
      rush(28),
      mixed({ raptor: 12, swarm: 10, allosaur: 2 }),
    ],
  },
  {
    id: 2,
    name: "Riverside Pass",
    paths: [p(-20, -6, 4, -6, 4, 6, 20, 6)],
    startGold: 200,
    nodePos: { x: -22, y: -11 },
    waves: [
      intro(10, 5),
      mixed({ raptor: 14, swarm: 8, allosaur: 2 }),
      rush(36),
      mixed({ raptor: 16, swarm: 10, allosaur: 3, stego: 1 }),
      mixed({ raptor: 18, swarm: 12, allosaur: 4, stego: 1 }),
    ],
  },
  {
    id: 3,
    name: "Canyon Run",
    paths: [p(-20, 8, -6, 8, -6, -4, 6, -4, 6, 8, 20, 8)],
    startGold: 200,
    nodePos: { x: -14, y: -14 },
    waves: [
      mixed({ raptor: 12, swarm: 8, allosaur: 2 }),
      rush(44, 6),
      mixed({ raptor: 16, swarm: 10, allosaur: 3 }),
      heavy({ armored: 2, stego: 1, allosaur: 2 }),
      mixed({ raptor: 18, swarm: 14, allosaur: 4, stego: 2 }),
      chaos({ raptor: 16, swarm: 18, allosaur: 4, stego: 2 }),
    ],
  },
  {
    id: 4,
    name: "Marsh Breach",
    paths: [p(-20, -8, -12, -8, -12, 8, 12, 8, 12, -8, 20, -8)],
    startGold: 190,
    nodePos: { x: -6, y: -11 },
    waves: [
      intro(12, 6),
      mixed({ raptor: 14, swarm: 10, allosaur: 3 }),
      rush(50, 8),
      heavy({ armored: 3, stego: 1, allosaur: 2 }),
      mixed({ raptor: 18, swarm: 14, allosaur: 4, stego: 2 }),
      chaos({ raptor: 18, swarm: 22, allosaur: 5, stego: 2 }),
    ],
  },
  {
    id: 5,
    name: "Ashen Valley",
    biome: "wasteland",
    paths: [p(-20, -10, -14, -10, -9, -4, -1, -3, 3, 2, 10, 3, 15, 8, 20, 8)],
    startGold: 180,
    nodePos: { x: 2, y: -14 },
    waves: [
      intro(14, 8),
      mixed({ raptor: 14, swarm: 12, para: 2, allosaur: 3, stego: 1 }),
      rush(55, 10),
      heavy({ armored: 3, stego: 2, allosaur: 2 }),
      mixed({ raptor: 20, swarm: 14, para: 4, allosaur: 5, stego: 2 }),
      heavy({ armored: 5, stego: 3, allosaur: 2 }),
      chaos({ raptor: 18, swarm: 22, para: 4, allosaur: 5, stego: 3, armored: 1 }),
    ],
  },
  {
    id: 6,
    name: "Fossil Ridge",
    paths: [p(-20, 8, -12, 8, -12, -6, -4, -6, -4, 8, 4, 8, 4, -6, 12, -6, 12, 8, 20, 8)],
    startGold: 180,
    nodePos: { x: 10, y: -11 },
    hpScale: 1.05,
    waves: [
      intro(16, 10),
      mixed({ raptor: 16, swarm: 14, allosaur: 4, stego: 1 }),
      rush(60, 10),
      heavy({ armored: 4, stego: 2, allosaur: 2 }),
      mixed({ raptor: 22, swarm: 16, allosaur: 5, stego: 3 }),
      heavy({ armored: 6, stego: 3, allosaur: 3 }),
      chaos({ raptor: 20, swarm: 24, allosaur: 6, stego: 3, armored: 2 }),
    ],
  },
  {
    id: 7,
    name: "Sulfur Flats",
    biome: "desert",
    paths: [p(-20, -8, -14, -8, -8, -4, -2, 0, 4, 4, 10, 6, 16, 8, 20, 8)],
    startGold: 170,
    nodePos: { x: 18, y: -8 },
    hpScale: 1.08,
    waves: [
      mixed({ raptor: 12, swarm: 10, allosaur: 2 }),
      rush(65, 10),
      mixed({ raptor: 18, swarm: 12, allosaur: 4, stego: 1 }),
      heavy({ armored: 4, stego: 2, allosaur: 2 }),
      chaos({ raptor: 16, swarm: 24, allosaur: 5, stego: 2 }),
      rush(75, 14),
      heavy({ armored: 6, stego: 4, allosaur: 3 }),
      chaos({ raptor: 22, swarm: 26, allosaur: 6, stego: 3, armored: 2 }),
    ],
  },
  {
    id: 8,
    name: "Obsidian Pass",
    biome: "wasteland",
    // Two parallel corridors — upper and lower
    paths: [
      p(-20, 7, -10, 7, -10, 4, 10, 4, 10, 7, 20, 7),
      p(-20, -7, -10, -7, -10, -4, 10, -4, 10, -7, 20, -7),
    ],
    startGold: 200,
    nodePos: { x: 26, y: -4 },
    hpScale: 1.1,
    waves: [
      intro(12, 8, 0),
      split("mixed", 0.55, [0, { raptor: 10, swarm: 4, para: 1 }], [1, { raptor: 10, swarm: 4, para: 1 }]),
      split("swarm", 0.11, [0, { swarm: 40 }], [1, { swarm: 40 }]),
      split("heavy", 0.95, [0, { armored: 3, stego: 2 }], [1, { allosaur: 4, stego: 1 }]),
      split("mixed", 0.5, [0, { raptor: 14, swarm: 8, para: 2, allosaur: 3 }], [1, { raptor: 14, swarm: 8, para: 2, allosaur: 3 }]),
      split("swarm", 0.1, [0, { swarm: 45 }], [1, { swarm: 45, raptor: 6 }]),
      split("heavy", 0.9, [0, { armored: 5, stego: 2 }], [1, { armored: 5, allosaur: 3 }]),
      split("chaos", 0.3, [0, { raptor: 14, swarm: 14, para: 3, allosaur: 3, stego: 2 }], [1, { raptor: 14, swarm: 14, para: 3, allosaur: 3, armored: 2 }]),
    ],
  },
  {
    id: 9,
    name: "Tarpit Gorge",
    biome: "wasteland",
    paths: [p(-20, 8, -10, 8, -2, 0, 0, -6, 8, -8, 14, -4, 20, 2)],
    startGold: 160,
    nodePos: { x: 22, y: 2 },
    hpScale: 1.12,
    waves: [
      mixed({ raptor: 14, swarm: 10, allosaur: 3 }),
      rush(70, 12),
      mixed({ raptor: 18, swarm: 14, allosaur: 4, stego: 2 }),
      heavy({ armored: 5, stego: 3, allosaur: 2 }),
      chaos({ raptor: 16, swarm: 24, allosaur: 5, stego: 3 }),
      rush(85, 16),
      heavy({ armored: 8, stego: 4, allosaur: 4 }),
      mixed({ raptor: 24, swarm: 18, allosaur: 7, stego: 4 }),
      chaos({ raptor: 26, swarm: 30, allosaur: 8, stego: 5, armored: 3 }),
    ],
  },
  {
    id: 10,
    name: "Bonefield Plateau",
    biome: "wasteland",
    paths: [p(-20, 10, -16, 10, -16, -10, 14, -10, 14, 6, -10, 6, -10, -4, 8, -4, 8, 2, 20, 2)],
    startGold: 160,
    nodePos: { x: 14, y: 6 },
    hpScale: 1.15,
    waves: [
      intro(16, 10),
      mixed({ raptor: 16, swarm: 12, allosaur: 4, stego: 2 }),
      rush(80, 14),
      heavy({ armored: 6, stego: 3, allosaur: 3 }),
      chaos({ raptor: 18, swarm: 26, allosaur: 6, stego: 4 }),
      rush(90, 18),
      heavy({ armored: 9, stego: 5, allosaur: 4 }),
      mixed({ raptor: 26, swarm: 20, allosaur: 8, stego: 5 }),
      chaos({ raptor: 28, swarm: 32, allosaur: 8, stego: 5, armored: 4 }),
    ],
  },
  {
    id: 11,
    name: "Scorched Gulch",
    biome: "desert",
    paths: [p(-20, -10, -12, -10, -12, 0, -4, 0, -4, 8, 6, 8, 6, -8, 14, -8, 14, 10, 20, 10)],
    startGold: 150,
    nodePos: { x: 6, y: 4 },
    hpScale: 1.18,
    waves: [
      intro(16, 12),
      mixed({ raptor: 18, swarm: 14, allosaur: 5, stego: 2 }),
      rush(80, 14),
      heavy({ armored: 7, stego: 4, allosaur: 3 }),
      mixed({ raptor: 22, swarm: 18, allosaur: 6, stego: 3 }),
      rush(95, 20),
      heavy({ armored: 10, stego: 6, allosaur: 4 }),
      chaos({ raptor: 20, swarm: 28, allosaur: 7, stego: 5, armored: 3 }),
      heavy({ armored: 12, stego: 6, allosaur: 5 }),
      chaos({ raptor: 28, swarm: 36, allosaur: 10, stego: 6, armored: 4 }),
    ],
  },
  {
    id: 12,
    name: "Sunken Hollow",
    biome: "snow",
    // Two separate entries (left & right) merging toward each other's exits
    paths: [
      p(-20, -9, -10, -9, -4, -3, 4, 3, 10, 9, 20, 9),
      p(20, -9, 10, -9, 4, -3, -4, 3, -10, 9, -20, 9),
    ],
    startGold: 180,
    nodePos: { x: -2, y: 8 },
    hpScale: 1.2,
    waves: [
      split("intro", 0.85, [0, { raptor: 10 }], [1, { raptor: 10 }]),
      split("mixed", 0.55, [0, { raptor: 12, swarm: 8, allosaur: 3 }], [1, { raptor: 12, swarm: 8, allosaur: 3 }]),
      split("swarm", 0.1, [0, { swarm: 50 }], [1, { swarm: 50 }]),
      split("heavy", 0.9, [0, { armored: 5, stego: 2 }], [1, { armored: 5, stego: 2 }]),
      split("mixed", 0.5, [0, { raptor: 14, swarm: 10, allosaur: 4, stego: 2 }], [1, { raptor: 14, swarm: 10, allosaur: 4, stego: 2 }]),
      split("chaos", 0.3, [0, { raptor: 12, swarm: 14, allosaur: 4, stego: 2, armored: 1 }], [1, { raptor: 12, swarm: 14, allosaur: 4, stego: 2, armored: 1 }]),
      split("swarm", 0.09, [0, { swarm: 55 }], [1, { swarm: 55, raptor: 10 }]),
      split("heavy", 0.85, [0, { armored: 7, stego: 3, allosaur: 3 }], [1, { armored: 7, stego: 3, allosaur: 3 }]),
      split("chaos", 0.28, [0, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }], [1, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }]),
      split("chaos", 0.25, [0, { raptor: 18, swarm: 22, allosaur: 7, stego: 4, armored: 3 }], [1, { raptor: 18, swarm: 22, allosaur: 7, stego: 4, armored: 3 }]),
    ],
  },
  {
    id: 13,
    name: "Ironwood Thicket",
    paths: [p(-20, 10, -16, 10, -16, -10, -8, -10, -8, 10, 0, 10, 0, -10, 8, -10, 8, 10, 16, 10, 16, -10, 20, -10)],
    startGold: 150,
    nodePos: { x: -10, y: 6 },
    hpScale: 1.22,
    waves: [
      mixed({ raptor: 18, swarm: 14, allosaur: 5 }),
      rush(75, 14),
      mixed({ raptor: 22, swarm: 16, allosaur: 6, stego: 3 }),
      heavy({ armored: 7, stego: 4, allosaur: 3 }),
      chaos({ raptor: 18, swarm: 24, allosaur: 6, stego: 3 }),
      rush(95, 20),
      heavy({ armored: 11, stego: 6, allosaur: 5 }),
      mixed({ raptor: 26, swarm: 22, allosaur: 9, stego: 5 }),
      chaos({ raptor: 22, swarm: 28, allosaur: 8, stego: 5, armored: 3 }),
      heavy({ armored: 14, stego: 7, allosaur: 6 }),
      chaos({ raptor: 28, swarm: 36, allosaur: 10, stego: 6, armored: 4 }),
    ],
  },
  {
    id: 14,
    name: "Shardspike Peak",
    biome: "snow",
    paths: [p(-20, 0, -14, 6, -10, 2, -6, 8, -2, 2, 2, 8, 6, 2, 10, -4, 14, 2, 18, -4, 20, 0)],
    startGold: 140,
    nodePos: { x: -18, y: 10 },
    hpScale: 1.25,
    waves: [
      intro(18, 14),
      mixed({ raptor: 20, swarm: 14, allosaur: 6, stego: 2 }),
      rush(80, 16),
      heavy({ armored: 8, stego: 4, allosaur: 4 }),
      mixed({ raptor: 24, swarm: 18, allosaur: 7, stego: 4 }),
      chaos({ raptor: 20, swarm: 26, allosaur: 7, stego: 4, armored: 2 }),
      rush(100, 22),
      heavy({ armored: 12, stego: 6, allosaur: 5 }),
      mixed({ raptor: 28, swarm: 22, allosaur: 10, stego: 6 }),
      heavy({ armored: 15, stego: 8, allosaur: 6 }),
      chaos({ raptor: 30, swarm: 40, allosaur: 10, stego: 6, armored: 4 }),
    ],
  },
  {
    id: 15,
    name: "Broken Spire",
    biome: "wasteland",
    paths: [p(-20, 10, -14, 10, -10, 4, -4, 4, -2, -4, 4, -4, 6, 2, 12, 2, 14, -8, 20, -8)],
    startGold: 140,
    nodePos: { x: -24, y: 6 },
    hpScale: 1.28,
    waves: [
      mixed({ raptor: 16, swarm: 12, para: 4, allosaur: 4, stego: 1 }),
      rush(90, 18),
      heavy({ armored: 8, stego: 5, allosaur: 4 }),
      mixed({ raptor: 24, swarm: 20, para: 6, allosaur: 7, stego: 4 }),
      chaos({ raptor: 20, swarm: 26, para: 5, allosaur: 7, stego: 4, armored: 2 }),
      rush(105, 24),
      heavy({ armored: 13, stego: 7, allosaur: 5, titan: 1 }),
      mixed({ raptor: 28, swarm: 24, para: 8, allosaur: 10, stego: 6 }),
      chaos({ raptor: 24, swarm: 30, allosaur: 9, stego: 5, armored: 3, titan: 1 }),
      heavy({ armored: 16, stego: 8, allosaur: 7, titan: 1 }),
      chaos({ raptor: 30, swarm: 40, allosaur: 12, stego: 7, armored: 5, titan: 1 }),
      chaos({ raptor: 34, swarm: 44, para: 10, allosaur: 14, stego: 8, armored: 6, titan: 2 }),
    ],
  },
  {
    id: 16,
    name: "Crimson Basin",
    biome: "desert",
    // X-crossing: two paths that visually cross
    paths: [
      p(-20, -9, -10, -6, -2, -2, 0, 2, 6, 6, 14, 9, 20, 9),
      p(-20, 9, -10, 6, -2, 2, 0, -2, 6, -6, 14, -9, 20, -9),
    ],
    startGold: 170,
    nodePos: { x: -30, y: 12 },
    hpScale: 1.3,
    waves: [
      split("intro", 0.9, [0, { raptor: 12 }], [1, { raptor: 12 }]),
      split("mixed", 0.55, [0, { raptor: 14, swarm: 10 }], [1, { raptor: 14, swarm: 10 }]),
      split("swarm", 0.1, [0, { swarm: 55 }], [1, { swarm: 55 }]),
      split("heavy", 0.9, [0, { armored: 6, stego: 2 }], [1, { armored: 6, stego: 2 }]),
      split("mixed", 0.5, [0, { raptor: 16, swarm: 12, allosaur: 5, stego: 2 }], [1, { raptor: 16, swarm: 12, allosaur: 5, stego: 2 }]),
      split("chaos", 0.3, [0, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }], [1, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }]),
      split("swarm", 0.09, [0, { swarm: 65 }], [1, { swarm: 65, raptor: 10 }]),
      split("heavy", 0.85, [0, { armored: 9, stego: 4, allosaur: 4 }], [1, { armored: 9, stego: 4, allosaur: 4 }]),
      split("mixed", 0.45, [0, { raptor: 18, swarm: 14, allosaur: 6, stego: 4 }], [1, { raptor: 18, swarm: 14, allosaur: 6, stego: 4 }]),
      split("heavy", 0.8, [0, { armored: 12, stego: 6, allosaur: 5 }], [1, { armored: 12, stego: 6, allosaur: 5 }]),
      split("chaos", 0.28, [0, { raptor: 18, swarm: 22, allosaur: 8, stego: 4, armored: 3 }], [1, { raptor: 18, swarm: 22, allosaur: 8, stego: 4, armored: 3 }]),
      split("chaos", 0.25, [0, { raptor: 22, swarm: 26, allosaur: 10, stego: 6, armored: 4 }], [1, { raptor: 22, swarm: 26, allosaur: 10, stego: 6, armored: 4 }]),
    ],
  },
  {
    id: 17,
    name: "Drakespine Ridge",
    biome: "snow",
    paths: [p(-20, 8, -16, 8, -16, 2, -12, 2, -12, 8, -6, 8, -6, 2, 0, 2, 0, 8, 6, 8, 6, 2, 12, 2, 12, 8, 18, 8, 18, 0, 20, 0)],
    startGold: 140,
    nodePos: { x: -22, y: 16 },
    hpScale: 1.35,
    waves: [
      mixed({ raptor: 20, swarm: 14, allosaur: 6, stego: 2 }),
      rush(90, 18),
      mixed({ raptor: 24, swarm: 20, allosaur: 8, stego: 4 }),
      heavy({ armored: 10, stego: 6, allosaur: 4 }),
      chaos({ raptor: 22, swarm: 28, allosaur: 8, stego: 4, armored: 2 }),
      rush(105, 22),
      heavy({ armored: 14, stego: 7, allosaur: 6 }),
      mixed({ raptor: 28, swarm: 24, allosaur: 10, stego: 6 }),
      chaos({ raptor: 24, swarm: 32, allosaur: 10, stego: 6, armored: 4 }),
      heavy({ armored: 18, stego: 9, allosaur: 7 }),
      rush(120, 28),
      chaos({ raptor: 34, swarm: 44, allosaur: 14, stego: 8, armored: 5 }),
      chaos({ raptor: 38, swarm: 48, allosaur: 16, stego: 10, armored: 6 }),
    ],
  },
  {
    id: 18,
    name: "Shatterreef",
    biome: "snow",
    paths: [p(-20, -10, -12, -10, -12, 10, -4, 10, -4, -10, 4, -10, 4, 10, 12, 10, 12, -10, 20, -10)],
    startGold: 130,
    nodePos: { x: -10, y: 14 },
    hpScale: 1.4,
    waves: [
      intro(22, 18),
      mixed({ raptor: 24, swarm: 18, allosaur: 7, stego: 3 }),
      rush(100, 22),
      heavy({ armored: 12, stego: 6, allosaur: 5 }),
      mixed({ raptor: 28, swarm: 24, allosaur: 10, stego: 6 }),
      chaos({ raptor: 24, swarm: 32, allosaur: 10, stego: 6, armored: 4 }),
      rush(120, 28),
      heavy({ armored: 16, stego: 8, allosaur: 7 }),
      mixed({ raptor: 32, swarm: 28, allosaur: 12, stego: 8 }),
      heavy({ armored: 20, stego: 10, allosaur: 8 }),
      chaos({ raptor: 34, swarm: 46, allosaur: 14, stego: 8, armored: 6 }),
      chaos({ raptor: 38, swarm: 50, allosaur: 16, stego: 10, armored: 7 }),
      chaos({ raptor: 42, swarm: 54, allosaur: 18, stego: 12, armored: 8 }),
    ],
  },
  {
    id: 19,
    name: "Threshold of Eschaton",
    biome: "wasteland",
    // THREE paths: top-left entry, bottom-left entry, right-side entry, all converging toward center-exits
    paths: [
      p(-20, 9, -12, 9, -6, 4, 0, 0, 8, -4, 14, -4, 20, -4),
      p(-20, -9, -12, -9, -6, -4, 0, 0, 8, 4, 14, 4, 20, 4),
      p(20, 10, 14, 10, 6, 8, -2, 6, -8, 2, -14, 0, -20, 0),
    ],
    startGold: 180,
    nodePos: { x: 2, y: 16 },
    hpScale: 1.45,
    waves: [
      split("mixed", 0.6, [0, { raptor: 10, swarm: 5 }], [1, { raptor: 10, swarm: 5 }], [2, { raptor: 10, swarm: 5 }]),
      split("swarm", 0.12, [0, { swarm: 40 }], [1, { swarm: 40 }], [2, { swarm: 40 }]),
      split("heavy", 0.95, [0, { armored: 4, stego: 2 }], [1, { armored: 4, stego: 2 }], [2, { armored: 4, stego: 2 }]),
      split("mixed", 0.5, [0, { raptor: 14, swarm: 10, allosaur: 3 }], [1, { raptor: 14, swarm: 10, allosaur: 3 }], [2, { raptor: 14, swarm: 10, allosaur: 3 }]),
      split("chaos", 0.3, [0, { raptor: 12, swarm: 14, allosaur: 4, stego: 2 }], [1, { raptor: 12, swarm: 14, allosaur: 4, stego: 2 }], [2, { raptor: 12, swarm: 14, allosaur: 4, stego: 2 }]),
      split("swarm", 0.1, [0, { swarm: 50 }], [1, { swarm: 50 }], [2, { swarm: 50 }]),
      split("heavy", 0.9, [0, { armored: 7, stego: 3, allosaur: 3 }], [1, { armored: 7, stego: 3, allosaur: 3 }], [2, { armored: 7, stego: 3, allosaur: 3 }]),
      split("mixed", 0.48, [0, { raptor: 16, swarm: 12, allosaur: 5, stego: 3 }], [1, { raptor: 16, swarm: 12, allosaur: 5, stego: 3 }], [2, { raptor: 16, swarm: 12, allosaur: 5, stego: 3 }]),
      split("chaos", 0.28, [0, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }], [1, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }], [2, { raptor: 14, swarm: 18, allosaur: 5, stego: 3, armored: 2 }]),
      split("heavy", 0.85, [0, { armored: 10, stego: 5, allosaur: 4 }], [1, { armored: 10, stego: 5, allosaur: 4 }], [2, { armored: 10, stego: 5, allosaur: 4 }]),
      split("swarm", 0.08, [0, { swarm: 60 }], [1, { swarm: 60 }], [2, { swarm: 60 }]),
      split("chaos", 0.26, [0, { raptor: 18, swarm: 22, allosaur: 7, stego: 4, armored: 3 }], [1, { raptor: 18, swarm: 22, allosaur: 7, stego: 4, armored: 3 }], [2, { raptor: 18, swarm: 22, allosaur: 7, stego: 4, armored: 3 }]),
      split("chaos", 0.24, [0, { raptor: 20, swarm: 24, allosaur: 8, stego: 5, armored: 4 }], [1, { raptor: 20, swarm: 24, allosaur: 8, stego: 5, armored: 4 }], [2, { raptor: 20, swarm: 24, allosaur: 8, stego: 5, armored: 4 }]),
      split("chaos", 0.22, [0, { raptor: 24, swarm: 28, allosaur: 10, stego: 6, armored: 5 }], [1, { raptor: 24, swarm: 28, allosaur: 10, stego: 6, armored: 5 }], [2, { raptor: 24, swarm: 28, allosaur: 10, stego: 6, armored: 5 }]),
    ],
  },
  {
    id: 20,
    name: "Extinction Point",
    biome: "wasteland",
    // Two serpentines: upper weaving and lower weaving
    paths: [
      p(-20, 10, -14, 10, -14, 2, -8, 2, -8, 10, 0, 10, 0, 2, 8, 2, 8, 10, 14, 10, 14, 4, 20, 4),
      p(-20, -4, -14, -4, -14, -10, -6, -10, -6, -2, 2, -2, 2, -10, 10, -10, 10, -4, 16, -4, 16, -10, 20, -10),
    ],
    startGold: 170,
    nodePos: { x: 14, y: 18 },
    hpScale: 1.5,
    waves: [
      split("intro", 0.85, [0, { raptor: 12, swarm: 6, para: 2 }], [1, { raptor: 12, swarm: 6, para: 2 }]),
      split("mixed", 0.5, [0, { raptor: 14, swarm: 12, para: 3, allosaur: 4 }], [1, { raptor: 14, swarm: 12, para: 3, allosaur: 4 }]),
      split("swarm", 0.1, [0, { swarm: 60 }], [1, { swarm: 60 }]),
      split("heavy", 0.9, [0, { armored: 7, stego: 3, titan: 1 }], [1, { armored: 7, stego: 3 }]),
      split("mixed", 0.48, [0, { raptor: 16, swarm: 14, para: 5, allosaur: 5, stego: 3 }], [1, { raptor: 16, swarm: 14, para: 5, allosaur: 5, stego: 3 }]),
      split("chaos", 0.3, [0, { raptor: 14, swarm: 18, para: 4, allosaur: 5, stego: 3, armored: 2 }], [1, { raptor: 14, swarm: 18, para: 4, allosaur: 5, stego: 3, armored: 2 }]),
      split("swarm", 0.08, [0, { swarm: 75 }], [1, { swarm: 75, raptor: 14 }]),
      split("heavy", 0.85, [0, { armored: 10, stego: 5, allosaur: 4, titan: 1 }], [1, { armored: 10, stego: 5, allosaur: 4 }]),
      split("mixed", 0.45, [0, { raptor: 18, swarm: 16, para: 6, allosaur: 7, stego: 4 }], [1, { raptor: 18, swarm: 16, para: 6, allosaur: 7, stego: 4 }]),
      split("chaos", 0.28, [0, { raptor: 16, swarm: 22, para: 5, allosaur: 7, stego: 4, armored: 3 }], [1, { raptor: 16, swarm: 22, para: 5, allosaur: 7, stego: 4, armored: 3, titan: 1 }]),
      split("heavy", 0.8, [0, { armored: 14, stego: 7, allosaur: 5, titan: 1 }], [1, { armored: 14, stego: 7, allosaur: 5, titan: 1 }]),
      split("swarm", 0.07, [0, { swarm: 85 }], [1, { swarm: 85, raptor: 18 }]),
      split("chaos", 0.26, [0, { raptor: 20, swarm: 28, para: 8, allosaur: 10, stego: 6, armored: 4, titan: 1 }], [1, { raptor: 20, swarm: 28, para: 8, allosaur: 10, stego: 6, armored: 4, titan: 1 }]),
      split("chaos", 0.24, [0, { raptor: 24, swarm: 32, para: 10, allosaur: 12, stego: 8, armored: 5, titan: 2 }], [1, { raptor: 24, swarm: 32, para: 10, allosaur: 12, stego: 8, armored: 5, titan: 2 }]),
      split("chaos", 0.22, [0, { raptor: 28, swarm: 36, para: 12, allosaur: 14, stego: 10, armored: 7, titan: 2 }], [1, { raptor: 28, swarm: 36, para: 12, allosaur: 14, stego: 10, armored: 7, titan: 2 }]),
    ],
  },
];

export const getLevel = (id: number): LevelConfig => {
  const level = LEVELS.find(l => l.id === id);
  if (!level) throw new Error(`Level ${id} not found`);
  return level;
};
