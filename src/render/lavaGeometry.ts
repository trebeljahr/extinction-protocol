import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";

export const LAVA_COLOR = "#ff6a1c";
export const LAVA_EMISSIVE = "#ff5010";
export const LAVA_EMISSIVE_INTENSITY = 1.6;
export const RIVER_WIDTH = 2.2;

export type River = { points: Vec2[] };
export type Lake = { x: number; y: number; rx: number; ry: number; rot: number };
export type Bridge = { pos: Vec2; rotY: number; length: number };
export type LavaFeatures = { rivers: River[]; lakes: Lake[]; bridges: Bridge[] };

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const distPointToSegSq = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len = abx * abx + aby * aby;
  const t = len > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / len)) : 0;
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
};

// Meandering polyline crossing the map on the chosen axis. Endpoints push
// past the map edge so rivers visibly run off-screen rather than terminating
// mid-arena.
const buildRiver = (rng: () => number, axis: "h" | "v"): Vec2[] => {
  const N = 10;
  const out: Vec2[] = [];
  const phase = rng() * Math.PI * 2;
  const amp = 2.4 + rng() * 2;
  const margin = 3;
  if (axis === "h") {
    const baseY = (rng() - 0.5) * MAP_HEIGHT * 0.55;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -MAP_WIDTH / 2 - margin + t * (MAP_WIDTH + 2 * margin);
      const y = baseY + Math.sin(phase + t * Math.PI * 2.2) * amp + (rng() - 0.5) * 0.6;
      out.push({ x, y });
    }
  } else {
    const baseX = (rng() - 0.5) * MAP_WIDTH * 0.55;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = -MAP_HEIGHT / 2 - margin + t * (MAP_HEIGHT + 2 * margin);
      const x = baseX + Math.sin(phase + t * Math.PI * 2.2) * amp + (rng() - 0.5) * 0.6;
      out.push({ x, y });
    }
  }
  return out;
};

const buildLakes = (rng: () => number, paths: Vec2[][], rivers: Vec2[][]): Lake[] => {
  const lakes: Lake[] = [];
  const target = 5;
  let tries = 0;
  while (lakes.length < target && tries < 240) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.85;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.85;
    const rx = 1.2 + rng() * 1.6;
    const ry = 1.2 + rng() * 1.6;
    const r = Math.max(rx, ry);

    const pathClear = r + PATH_WIDTH / 2 + 0.4;
    let blocked = false;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        if (
          distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) <
          pathClear * pathClear
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;

    // Lakes can sit close to rivers (reads as a pool fed by a stream) but
    // not overlap them so much that the river endpoints get swallowed.
    const riverClear = r + RIVER_WIDTH * 0.2;
    for (const river of rivers) {
      for (let i = 0; i < river.length - 1; i++) {
        if (
          distPointToSegSq(x, y, river[i].x, river[i].y, river[i + 1].x, river[i + 1].y) <
          riverClear * riverClear
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (blocked) continue;

    let overlap = false;
    for (const l of lakes) {
      const dx = l.x - x;
      const dy = l.y - y;
      const minD = Math.max(l.rx, l.ry) + r + 0.5;
      if (dx * dx + dy * dy < minD * minD) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    lakes.push({ x, y, rx, ry, rot: rng() * Math.PI * 2 });
  }
  return lakes;
};

const segIntersect = (a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null => {
  const rx = a2.x - a1.x;
  const ry = a2.y - a1.y;
  const sx = b2.x - b1.x;
  const sy = b2.y - b1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const dx = b1.x - a1.x;
  const dy = b1.y - a1.y;
  const t = (dx * sy - dy * sx) / denom;
  const u = (dx * ry - dy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * rx, y: a1.y + t * ry };
};

// At each path × river crossing emit a bridge whose long axis follows the
// path. Length is widened when the crossing is oblique so the deck still
// covers the river's footprint along the path direction.
const BRIDGE_OVERHANG = 2.2;
const computeBridges = (paths: Vec2[][], rivers: Vec2[][]): Bridge[] => {
  const out: Bridge[] = [];
  for (const path of paths) {
    for (let pi = 0; pi < path.length - 1; pi++) {
      const a = path[pi];
      const b = path[pi + 1];
      const pdx = b.x - a.x;
      const pdy = b.y - a.y;
      const pLen = Math.hypot(pdx, pdy);
      if (pLen < 1e-6) continue;
      const ptx = pdx / pLen;
      const pty = pdy / pLen;
      const rotY = Math.atan2(-pdy, pdx);

      for (const river of rivers) {
        for (let ri = 0; ri < river.length - 1; ri++) {
          const r1 = river[ri];
          const r2 = river[ri + 1];
          const hit = segIntersect(a, b, r1, r2);
          if (!hit) continue;

          const rdx = r2.x - r1.x;
          const rdy = r2.y - r1.y;
          const rLen = Math.hypot(rdx, rdy);
          if (rLen < 1e-6) continue;
          const sinTheta = Math.abs(ptx * (rdy / rLen) - pty * (rdx / rLen));
          const projected = RIVER_WIDTH / Math.max(0.25, sinTheta);
          out.push({ pos: hit, rotY, length: projected + BRIDGE_OVERHANG });
        }
      }
    }
  }
  return out;
};

export const buildLavaFeatures = (paths: Vec2[][], levelId: number): LavaFeatures => {
  const rng = mulberry32(levelId * 7919 + 31);
  const riverPoints = [buildRiver(rng, "h"), buildRiver(rng, "v")];
  return {
    rivers: riverPoints.map((points) => ({ points })),
    lakes: buildLakes(rng, paths, riverPoints),
    bridges: computeBridges(paths, riverPoints),
  };
};

// Weighted sampling table over the lava surface (rivers + lakes). Built
// once per level so per-frame ember spawns just pick a point in O(items).
type SurfaceItem =
  | { kind: "river"; ax: number; ay: number; bx: number; by: number; weight: number }
  | { kind: "lake"; x: number; y: number; rx: number; ry: number; rot: number; weight: number };

export type LavaSurface = { items: SurfaceItem[]; total: number };

export const buildLavaSurface = (features: LavaFeatures): LavaSurface => {
  const items: SurfaceItem[] = [];
  let total = 0;
  for (const river of features.rivers) {
    for (let i = 0; i < river.points.length - 1; i++) {
      const a = river.points[i];
      const b = river.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const weight = len * RIVER_WIDTH;
      total += weight;
      items.push({ kind: "river", ax: a.x, ay: a.y, bx: b.x, by: b.y, weight });
    }
  }
  for (const lake of features.lakes) {
    const weight = Math.PI * lake.rx * lake.ry;
    total += weight;
    items.push({
      kind: "lake",
      x: lake.x,
      y: lake.y,
      rx: lake.rx,
      ry: lake.ry,
      rot: lake.rot,
      weight,
    });
  }
  return { items, total };
};

// Pick a random world-space (x, y) point on the lava surface, weighted by
// area so larger features spawn proportionally more embers. Returns level
// (x, y) coords; caller maps y → -z for three.js.
export const sampleLavaSurface = (
  surface: LavaSurface,
  rand: () => number,
): { x: number; y: number } | null => {
  if (surface.total <= 0) return null;
  let r = rand() * surface.total;
  for (const item of surface.items) {
    r -= item.weight;
    if (r > 0) continue;
    if (item.kind === "river") {
      const t = rand();
      const cx = item.ax + (item.bx - item.ax) * t;
      const cy = item.ay + (item.by - item.ay) * t;
      const dx = item.bx - item.ax;
      const dy = item.by - item.ay;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return { x: cx, y: cy };
      // Perpendicular offset within ±RIVER_WIDTH/2, biased toward center
      // (square the random so embers cluster down the river spine).
      const u = rand() * 2 - 1;
      const off = Math.sign(u) * u * u * (RIVER_WIDTH / 2);
      const nx = -dy / len;
      const ny = dx / len;
      return { x: cx + nx * off, y: cy + ny * off };
    }
    // Uniform sample inside an ellipse via sqrt-radius polar.
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand());
    const lx = Math.cos(angle) * radius * item.rx;
    const ly = Math.sin(angle) * radius * item.ry;
    const c = Math.cos(item.rot);
    const s = Math.sin(item.rot);
    return { x: item.x + lx * c - ly * s, y: item.y + lx * s + ly * c };
  }
  return null;
};
