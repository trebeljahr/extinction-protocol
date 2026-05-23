import type { Vec2 } from "../sim/types";
import type { LevelConfig } from "./index";

// Dedicated Endless-mode arenas. These are NOT part of the campaign
// LEVELS array — they never appear on the world map and carry no star
// progression. Each is a purpose-built map with a long, looping lane
// suited to infinite play. `waves` is intentionally empty: the spawner
// generates waves on demand (see src/sim/endless.ts) when World.endless
// is set. Biome is selected via nodePos.y bands (see src/biomes.ts).
//
// IDs sit in a high 9000 range so they never collide with campaign level
// ids (1-30) used as RNG seeds for scenery / easter-egg layout.

export type EndlessArena = LevelConfig & {
  // Stable string key used by the picker, persistence (best-wave records),
  // and World.endless.mapId. Decoupled from the numeric id so save keys
  // stay readable.
  mapId: string;
  // One-line flavor for the endless picker card.
  blurb: string;
};

const p = (...coords: number[]): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i < coords.length; i += 2) out.push({ x: coords[i], y: coords[i + 1] });
  return out;
};

export const ENDLESS_ARENAS: EndlessArena[] = [
  {
    mapId: "verdant",
    id: 9001,
    name: "Verdant Spiral",
    blurb: "Forest gauntlet — one long serpentine lane snakes the whole field.",
    // Five horizontal passes top→bottom: a very long single lane.
    paths: [
      p(-19, -11, 17, -11, 17, -5.5, -17, -5.5, -17, 0, 17, 0, 17, 5.5, -17, 5.5, -17, 11, 19, 11),
    ],
    startGold: 300,
    nodePos: { x: 0, y: -12 },
    waves: [],
  },
  {
    mapId: "magma",
    id: 9002,
    name: "Magma Coil",
    blurb: "Volcanic basin — a mirrored coil winds past molten rivers.",
    paths: [
      p(19, -11, -17, -11, -17, -5.5, 17, -5.5, 17, 0, -17, 0, -17, 5.5, 17, 5.5, 17, 11, -19, 11),
    ],
    startGold: 300,
    nodePos: { x: 0, y: 15 },
    waves: [],
  },
  {
    mapId: "hive",
    id: 9003,
    name: "Hive Labyrinth",
    blurb: "Alien reaches — twin lanes pour in from both flanks.",
    // Two interleaved serpentines so endless can spread pressure across
    // both lanes of the arena.
    paths: [
      p(-19, -11, 17, -11, 17, -2, -17, -2, -17, 8, 2, 8),
      p(19, 11, -17, 11, -17, 2, 17, 2, 17, -8, -2, -8),
    ],
    startGold: 320,
    nodePos: { x: 0, y: 25 },
    waves: [],
  },
];

export const ENDLESS_ARENA_IDS = ENDLESS_ARENAS.map((a) => a.mapId);

export const getEndlessArena = (mapId: string): EndlessArena | undefined =>
  ENDLESS_ARENAS.find((a) => a.mapId === mapId);
