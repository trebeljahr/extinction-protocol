import type { Vec2, WaveSpec, EnemyKind } from "../sim/types";

export type LevelConfig = {
  id: number;
  name: string;
  path: Vec2[];
  waves: WaveSpec[];
  startGold: number;
  nodePos: { x: number; y: number };
  hpScale?: number;
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

const toSpawns = (c: EnemyCounts) =>
  SPAWN_ORDER
    .filter(k => (c[k] ?? 0) > 0)
    .map(k => ({ kind: k, count: c[k]! }));

const intro = (raptor: number, swarm = 0): WaveSpec => ({
  archetype: "intro",
  spacing: 0.9,
  spawns: toSpawns({ raptor, swarm }),
});

const mixed = (c: EnemyCounts, spacing = 0.5): WaveSpec => ({
  archetype: "mixed",
  spacing,
  spawns: toSpawns(c),
});

const rush = (swarm: number, raptor = 0): WaveSpec => ({
  archetype: "swarm",
  spacing: 0.11,
  spawns: toSpawns({ swarm, raptor }),
});

const heavy = (c: EnemyCounts, spacing = 0.95): WaveSpec => ({
  archetype: "heavy",
  spacing,
  spawns: toSpawns(c),
});

const chaos = (c: EnemyCounts, spacing = 0.32): WaveSpec => ({
  archetype: "chaos",
  spacing,
  spawns: toSpawns(c),
});

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Jungle Outpost",
    path: p(-20, 0, 20, 0),
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
    path: p(-20, -6, 4, -6, 4, 6, 20, 6),
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
    path: p(-20, 8, -6, 8, -6, -4, 6, -4, 6, 8, 20, 8),
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
    path: p(-20, -8, -12, -8, -12, 8, 12, 8, 12, -8, 20, -8),
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
    path: p(-20, -10, -14, -10, -9, -4, -1, -3, 3, 2, 10, 3, 15, 8, 20, 8),
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
    path: p(-20, 8, -12, 8, -12, -6, -4, -6, -4, 8, 4, 8, 4, -6, 12, -6, 12, 8, 20, 8),
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
    path: p(-20, -8, -14, -8, -8, -4, -2, 0, 4, 4, 10, 6, 16, 8, 20, 8),
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
    path: p(-20, 0, -14, 0, -14, 8, -8, 8, -8, -8, -2, -8, -2, 8, 4, 8, 4, -8, 10, -8, 10, 8, 20, 8),
    startGold: 170,
    nodePos: { x: 26, y: -4 },
    hpScale: 1.1,
    waves: [
      intro(14, 10),
      mixed({ raptor: 16, swarm: 14, para: 3, allosaur: 4, stego: 2 }),
      rush(70, 12),
      heavy({ armored: 5, stego: 3, allosaur: 2 }),
      mixed({ raptor: 20, swarm: 16, para: 5, allosaur: 6, stego: 3 }),
      rush(80, 14),
      heavy({ armored: 7, stego: 4, allosaur: 3 }),
      chaos({ raptor: 24, swarm: 28, para: 4, allosaur: 7, stego: 4, armored: 2 }),
    ],
  },
  {
    id: 9,
    name: "Tarpit Gorge",
    path: p(-20, 8, -10, 8, -2, 0, 0, -6, 8, -8, 14, -4, 20, 2),
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
    path: p(-20, 10, -16, 10, -16, -10, 14, -10, 14, 6, -10, 6, -10, -4, 8, -4, 8, 2, 20, 2),
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
    name: "Magma Gate",
    path: p(-20, -10, -12, -10, -12, 0, -4, 0, -4, 8, 6, 8, 6, -8, 14, -8, 14, 10, 20, 10),
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
    path: p(-20, 0, -14, 0, -8, -8, -2, 0, 4, -8, 10, 0, 16, -8, 20, 0),
    startGold: 150,
    nodePos: { x: -2, y: 8 },
    hpScale: 1.2,
    waves: [
      intro(18, 14),
      mixed({ raptor: 20, swarm: 16, allosaur: 6, stego: 2 }),
      rush(85, 16),
      heavy({ armored: 8, stego: 4, allosaur: 4 }),
      mixed({ raptor: 24, swarm: 20, allosaur: 7, stego: 4 }),
      chaos({ raptor: 18, swarm: 24, allosaur: 6, stego: 3, armored: 2 }),
      rush(100, 22),
      heavy({ armored: 12, stego: 7, allosaur: 5 }),
      chaos({ raptor: 22, swarm: 30, allosaur: 8, stego: 4, armored: 3 }),
      chaos({ raptor: 30, swarm: 40, allosaur: 12, stego: 7, armored: 5 }),
    ],
  },
  {
    id: 13,
    name: "Ironwood Thicket",
    path: p(-20, 10, -16, 10, -16, -10, -8, -10, -8, 10, 0, 10, 0, -10, 8, -10, 8, 10, 16, 10, 16, -10, 20, -10),
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
    path: p(-20, 0, -14, 6, -10, 2, -6, 8, -2, 2, 2, 8, 6, 2, 10, -4, 14, 2, 18, -4, 20, 0),
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
    path: p(-20, 10, -14, 10, -10, 4, -4, 4, -2, -4, 4, -4, 6, 2, 12, 2, 14, -8, 20, -8),
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
    path: p(-20, -8, -14, -8, -10, 2, -2, 6, 6, 4, 12, -2, 16, -6, 20, -8),
    startGold: 140,
    nodePos: { x: -30, y: 12 },
    hpScale: 1.3,
    waves: [
      intro(20, 16),
      mixed({ raptor: 22, swarm: 18, allosaur: 7, stego: 3 }),
      rush(95, 20),
      heavy({ armored: 10, stego: 5, allosaur: 4 }),
      mixed({ raptor: 26, swarm: 22, allosaur: 9, stego: 5 }),
      chaos({ raptor: 22, swarm: 28, allosaur: 8, stego: 5, armored: 3 }),
      rush(110, 24),
      heavy({ armored: 14, stego: 7, allosaur: 6 }),
      mixed({ raptor: 30, swarm: 26, allosaur: 11, stego: 7 }),
      heavy({ armored: 17, stego: 9, allosaur: 7 }),
      chaos({ raptor: 32, swarm: 42, allosaur: 12, stego: 7, armored: 5 }),
      chaos({ raptor: 36, swarm: 46, allosaur: 14, stego: 9, armored: 6 }),
    ],
  },
  {
    id: 17,
    name: "Drakespine Ridge",
    path: p(-20, 8, -16, 8, -16, 2, -12, 2, -12, 8, -6, 8, -6, 2, 0, 2, 0, 8, 6, 8, 6, 2, 12, 2, 12, 8, 18, 8, 18, 0, 20, 0),
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
    path: p(-20, -10, -12, -10, -12, 10, -4, 10, -4, -10, 4, -10, 4, 10, 12, 10, 12, -10, 20, -10),
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
    path: p(-20, 0, -16, 0, -16, -10, -8, -10, -8, 8, 0, 8, 0, -10, 8, -10, 8, 6, 16, 6, 16, -10, 20, -10),
    startGold: 130,
    nodePos: { x: 2, y: 16 },
    hpScale: 1.45,
    waves: [
      mixed({ raptor: 20, swarm: 16, allosaur: 6, stego: 3 }),
      rush(100, 22),
      mixed({ raptor: 26, swarm: 22, allosaur: 9, stego: 5 }),
      heavy({ armored: 12, stego: 7, allosaur: 5 }),
      chaos({ raptor: 24, swarm: 32, allosaur: 10, stego: 6, armored: 4 }),
      rush(120, 26),
      heavy({ armored: 16, stego: 8, allosaur: 7 }),
      mixed({ raptor: 32, swarm: 28, allosaur: 13, stego: 8 }),
      chaos({ raptor: 28, swarm: 38, allosaur: 12, stego: 8, armored: 5 }),
      heavy({ armored: 22, stego: 11, allosaur: 9 }),
      rush(140, 32),
      chaos({ raptor: 38, swarm: 52, allosaur: 16, stego: 10, armored: 7 }),
      chaos({ raptor: 42, swarm: 58, allosaur: 18, stego: 12, armored: 8 }),
      chaos({ raptor: 46, swarm: 62, allosaur: 20, stego: 14, armored: 10 }),
    ],
  },
  {
    id: 20,
    name: "Extinction Point",
    path: p(-20, 0, -16, 0, -16, -10, -10, -10, -10, 0, -4, 0, -4, -10, 2, -10, 2, 10, 8, 10, 8, -10, 14, -10, 14, 10, 18, 10, 18, -4, 20, -4),
    startGold: 130,
    nodePos: { x: 14, y: 18 },
    hpScale: 1.55,
    waves: [
      intro(24, 20),
      mixed({ raptor: 26, swarm: 22, para: 6, allosaur: 8, stego: 4 }),
      rush(110, 24),
      heavy({ armored: 14, stego: 7, allosaur: 6, titan: 1 }),
      mixed({ raptor: 30, swarm: 26, para: 10, allosaur: 11, stego: 6 }),
      chaos({ raptor: 26, swarm: 34, para: 8, allosaur: 11, stego: 6, armored: 4 }),
      rush(130, 30),
      heavy({ armored: 18, stego: 9, allosaur: 8, titan: 2 }),
      mixed({ raptor: 34, swarm: 30, para: 12, allosaur: 14, stego: 9 }),
      chaos({ raptor: 30, swarm: 40, allosaur: 13, stego: 8, armored: 5, titan: 2 }),
      heavy({ armored: 24, stego: 12, allosaur: 10, titan: 2 }),
      rush(150, 36),
      chaos({ raptor: 40, swarm: 56, para: 14, allosaur: 18, stego: 12, armored: 8, titan: 2 }),
      chaos({ raptor: 44, swarm: 60, para: 16, allosaur: 20, stego: 14, armored: 10, titan: 3 }),
      chaos({ raptor: 50, swarm: 66, para: 20, allosaur: 24, stego: 16, armored: 12, titan: 4 }),
    ],
  },
];

export const getLevel = (id: number): LevelConfig => {
  const level = LEVELS.find(l => l.id === id);
  if (!level) throw new Error(`Level ${id} not found`);
  return level;
};
