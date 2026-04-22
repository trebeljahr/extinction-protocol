import type { Vec2, WaveSpec, EnemySpec, EnemyKind } from "../sim/types";

export type LevelConfig = {
  id: number;
  name: string;
  path: Vec2[];
  waves: WaveSpec[];
  startGold: number;
  nodePos: { x: number; y: number };
};

const p = (...coords: number[]): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i < coords.length; i += 2) out.push({ x: coords[i], y: coords[i + 1] });
  return out;
};

type RosterRamp = [start: number, perWave: number, fromWave: number];
type RosterSpec = {
  raptor: RosterRamp;
  swarm?: RosterRamp;
  allosaur?: RosterRamp;
  stego?: RosterRamp;
  hpMul?: [start: number, perWave: number];
};

const countAt = (ramp: RosterRamp | undefined, wave: number): number => {
  if (!ramp) return 0;
  const [start, perWave, fromWave] = ramp;
  if (wave < fromWave) return 0;
  return Math.max(0, Math.floor(start + (wave - fromWave) * perWave));
};

const makeWaves = (count: number, roster: RosterSpec): WaveSpec[] => {
  const waves: WaveSpec[] = [];
  for (let w = 1; w <= count; w++) {
    const spawns: EnemySpec[] = [];
    const kinds: [EnemyKind, RosterRamp | undefined][] = [
      ["raptor", roster.raptor],
      ["swarm", roster.swarm],
      ["allosaur", roster.allosaur],
      ["stego", roster.stego],
    ];
    for (const [kind, ramp] of kinds) {
      const n = countAt(ramp, w);
      if (n > 0) spawns.push({ kind, count: n });
    }
    const hpMul = roster.hpMul ? roster.hpMul[0] + (w - 1) * roster.hpMul[1] : 1;
    waves.push({ spawns, hpMul });
  }
  return waves;
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Jungle Outpost",
    path: p(-20, 0, 0, 0, 0, 8, 20, 8),
    waves: makeWaves(5, {
      raptor: [6, 2, 1],
    }),
    startGold: 240,
    nodePos: { x: -30, y: -14 },
  },
  {
    id: 2,
    name: "Riverside Pass",
    path: p(-20, -6, -6, -6, -6, 6, 8, 6, 8, -6, 20, -6),
    waves: makeWaves(5, {
      raptor: [8, 2, 1],
      swarm: [4, 2, 2],
    }),
    startGold: 220,
    nodePos: { x: -22, y: -11 },
  },
  {
    id: 3,
    name: "Canyon Run",
    path: p(-20, 8, -6, 8, -6, -6, 8, -6, 8, 6, 20, 6),
    waves: makeWaves(6, {
      raptor: [8, 2, 1],
      swarm: [5, 2, 2],
    }),
    startGold: 220,
    nodePos: { x: -14, y: -14 },
  },
  {
    id: 4,
    name: "Marsh Breach",
    path: p(-20, 6, -10, 6, -10, -6, 0, -6, 0, 6, 10, 6, 10, -6, 20, -6),
    waves: makeWaves(6, {
      raptor: [10, 2, 1],
      swarm: [6, 2, 2],
    }),
    startGold: 220,
    nodePos: { x: -6, y: -11 },
  },
  {
    id: 5,
    name: "Ashen Valley",
    path: p(-20, 8, -14, 8, -14, -2, -4, -2, -4, 8, 6, 8, 6, -2, 16, -2, 16, 6, 20, 6),
    waves: makeWaves(7, {
      raptor: [10, 2, 1],
      swarm: [6, 2, 2],
      allosaur: [1, 1, 3],
    }),
    startGold: 210,
    nodePos: { x: 2, y: -14 },
  },
  {
    id: 6,
    name: "Fossil Ridge",
    path: p(-20, 0, -12, 0, -12, 8, 0, 8, 0, -8, 12, -8, 12, 8, 20, 8),
    waves: makeWaves(7, {
      raptor: [12, 2, 1],
      swarm: [7, 2, 2],
      allosaur: [1, 1, 3],
    }),
    startGold: 210,
    nodePos: { x: 10, y: -11 },
  },
  {
    id: 7,
    name: "Sulfur Flats",
    path: p(-20, -8, -8, -8, -8, 8, 4, 8, 4, -4, 16, -4, 16, 4, 20, 4),
    waves: makeWaves(8, {
      raptor: [12, 2, 1],
      swarm: [8, 2, 2],
      allosaur: [2, 1, 3],
    }),
    startGold: 210,
    nodePos: { x: 18, y: -8 },
  },
  {
    id: 8,
    name: "Obsidian Pass",
    path: p(-20, 4, -14, 4, -14, -8, -2, -8, -2, 2, 8, 2, 8, -8, 20, -8),
    waves: makeWaves(8, {
      raptor: [14, 2, 1],
      swarm: [8, 3, 2],
      allosaur: [2, 1, 3],
      hpMul: [1, 0.02],
    }),
    startGold: 210,
    nodePos: { x: 26, y: -4 },
  },
  {
    id: 9,
    name: "Tarpit Gorge",
    path: p(-20, 8, -14, 8, -14, -4, -6, -4, -6, 8, 2, 8, 2, -4, 10, -4, 10, 8, 20, 8),
    waves: makeWaves(9, {
      raptor: [12, 2, 1],
      swarm: [8, 2, 2],
      allosaur: [2, 1, 3],
      stego: [1, 1, 4],
      hpMul: [1, 0.03],
    }),
    startGold: 210,
    nodePos: { x: 22, y: 2 },
  },
  {
    id: 10,
    name: "Bonefield Plateau",
    path: p(-20, -6, -14, -6, -14, 6, -6, 6, -6, -6, 2, -6, 2, 6, 10, 6, 10, -6, 20, -6),
    waves: makeWaves(9, {
      raptor: [14, 2, 1],
      swarm: [10, 2, 2],
      allosaur: [2, 1, 3],
      stego: [1, 1, 4],
      hpMul: [1, 0.03],
    }),
    startGold: 210,
    nodePos: { x: 14, y: 6 },
  },
  {
    id: 11,
    name: "Magma Gate",
    path: p(-20, 8, -8, 8, -8, -6, 0, -6, 0, 6, 8, 6, 8, -6, 16, -6, 16, 4, 20, 4),
    waves: makeWaves(10, {
      raptor: [14, 2, 1],
      swarm: [10, 2, 2],
      allosaur: [3, 1, 3],
      stego: [1, 1, 4],
      hpMul: [1, 0.04],
    }),
    startGold: 200,
    nodePos: { x: 6, y: 4 },
  },
  {
    id: 12,
    name: "Sunken Hollow",
    path: p(-20, 6, -16, 6, -16, -8, -4, -8, -4, 4, 4, 4, 4, -8, 14, -8, 14, 6, 20, 6),
    waves: makeWaves(10, {
      raptor: [16, 2, 1],
      swarm: [12, 2, 2],
      allosaur: [3, 1, 3],
      stego: [1, 1, 4],
      hpMul: [1, 0.04],
    }),
    startGold: 200,
    nodePos: { x: -2, y: 8 },
  },
  {
    id: 13,
    name: "Ironwood Thicket",
    path: p(-20, -8, -12, -8, -12, 2, -4, 2, -4, -8, 4, -8, 4, 8, 14, 8, 14, -2, 20, -2),
    waves: makeWaves(11, {
      raptor: [14, 2, 1],
      swarm: [12, 2, 2],
      allosaur: [3, 1, 3],
      stego: [2, 1, 4],
      hpMul: [1, 0.05],
    }),
    startGold: 200,
    nodePos: { x: -10, y: 6 },
  },
  {
    id: 14,
    name: "Shardspike Peak",
    path: p(-20, 8, -14, 8, -14, -8, -6, -8, -6, 2, 2, 2, 2, -8, 10, -8, 10, 8, 20, 8),
    waves: makeWaves(11, {
      raptor: [16, 2, 1],
      swarm: [12, 3, 2],
      allosaur: [3, 1, 3],
      stego: [2, 1, 4],
      hpMul: [1.05, 0.05],
    }),
    startGold: 200,
    nodePos: { x: -18, y: 10 },
  },
  {
    id: 15,
    name: "Broken Spire",
    path: p(-20, 0, -16, 0, -16, 8, -8, 8, -8, -8, 0, -8, 0, 4, 8, 4, 8, -8, 16, -8, 16, 4, 20, 4),
    waves: makeWaves(12, {
      raptor: [16, 2, 1],
      swarm: [14, 2, 2],
      allosaur: [4, 1, 3],
      stego: [2, 1, 4],
      hpMul: [1.05, 0.05],
    }),
    startGold: 200,
    nodePos: { x: -24, y: 6 },
  },
  {
    id: 16,
    name: "Crimson Basin",
    path: p(-20, -6, -10, -6, -10, 8, -2, 8, -2, -4, 6, -4, 6, 8, 14, 8, 14, -6, 20, -6),
    waves: makeWaves(12, {
      raptor: [18, 2, 1],
      swarm: [14, 3, 2],
      allosaur: [4, 1, 3],
      stego: [2, 1, 4],
      hpMul: [1.1, 0.05],
    }),
    startGold: 190,
    nodePos: { x: -30, y: 12 },
  },
  {
    id: 17,
    name: "Drakespine Ridge",
    path: p(-20, 4, -14, 4, -14, -8, -4, -8, -4, 4, 4, 4, 4, -8, 12, -8, 12, 8, 20, 8),
    waves: makeWaves(13, {
      raptor: [18, 2, 1],
      swarm: [14, 3, 2],
      allosaur: [4, 1, 3],
      stego: [3, 1, 4],
      hpMul: [1.1, 0.05],
    }),
    startGold: 190,
    nodePos: { x: -22, y: 16 },
  },
  {
    id: 18,
    name: "Shatterreef",
    path: p(-20, 8, -12, 8, -12, -8, 0, -8, 0, 6, 10, 6, 10, -6, 20, -6),
    waves: makeWaves(13, {
      raptor: [20, 2, 1],
      swarm: [16, 3, 2],
      allosaur: [5, 1, 3],
      stego: [3, 1, 4],
      hpMul: [1.1, 0.06],
    }),
    startGold: 190,
    nodePos: { x: -10, y: 14 },
  },
  {
    id: 19,
    name: "Threshold of Eschaton",
    path: p(-20, 0, -14, 0, -14, -8, -6, -8, -6, 8, 2, 8, 2, -8, 10, -8, 10, 4, 16, 4, 16, -8, 20, -8),
    waves: makeWaves(14, {
      raptor: [20, 2, 1],
      swarm: [16, 3, 2],
      allosaur: [5, 1, 3],
      stego: [3, 1, 4],
      hpMul: [1.15, 0.06],
    }),
    startGold: 180,
    nodePos: { x: 2, y: 16 },
  },
  {
    id: 20,
    name: "Extinction Point",
    path: p(-20, -8, -14, -8, -14, 8, -6, 8, -6, -8, 2, -8, 2, 8, 10, 8, 10, -8, 16, -8, 16, 4, 20, 4),
    waves: makeWaves(15, {
      raptor: [22, 2, 1],
      swarm: [18, 3, 2],
      allosaur: [6, 1, 3],
      stego: [4, 1, 4],
      hpMul: [1.2, 0.07],
    }),
    startGold: 180,
    nodePos: { x: 14, y: 18 },
  },
];

export const getLevel = (id: number): LevelConfig => {
  const level = LEVELS.find(l => l.id === id);
  if (!level) throw new Error(`Level ${id} not found`);
  return level;
};
