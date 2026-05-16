import type { Biome } from "./biomes";
import { MAP_HEIGHT, MAP_WIDTH, PATH_WIDTH } from "./level";
import { mulberry32 } from "./sim/random";
import type { Vec2 } from "./sim/types";
import { distPointToSegSq } from "./sim/vec2";

// Per-biome palettes for the rendered river/lake meshes. Kept here next
// to the geometry so the renderer can read both from one place.
export type FlowPalette = {
  fluidColor: string;
  fluidEmissive: string;
  fluidEmissiveIntensity: number;
  bridgeDeck: string;
  bridgeTrim: string;
};

// Per-biome flow shape: how many rivers, how many lakes, whether to bridge
// path crossings, and the visual palette. Biomes without flow features
// (desert, snow, wasteland) are represented as `null`.
//   - lava   : two molten rivers (h + v) + tributaries + 5 lakes, bridges
//   - forest : one meandering water channel + 2 small ponds, bridges
//   - alien  : no rivers — only static goo puddles (8 of them), no bridges
export type FlowConfig = {
  riverCount: number;
  tributaries: boolean;
  riverWidth: number;
  tributaryWidth: number;
  lakeCount: number;
  // Lake half-axes are sampled in [lakeMin, lakeMin+lakeRange] world units.
  lakeMin: number;
  lakeRange: number;
  bridges: boolean;
  palette: FlowPalette;
};

const LAVA_PALETTE: FlowPalette = {
  fluidColor: "#ff6a1c",
  fluidEmissive: "#ff5010",
  fluidEmissiveIntensity: 1.6,
  bridgeDeck: "#2e1a10",
  bridgeTrim: "#7a3a1e",
};

// Forest river palette — water-blue, very mild emissive so the water
// reads as wet under direct sun without glowing in fog. Bridges are a
// warmer pine/oak deck on darker stained trim.
const FOREST_PALETTE: FlowPalette = {
  fluidColor: "#3a82c6",
  fluidEmissive: "#1a4870",
  fluidEmissiveIntensity: 0.18,
  bridgeDeck: "#5a3c20",
  bridgeTrim: "#3a2614",
};

// Alien goo — cyan-on-violet. Static puddles read better with a deeper
// teal base and lower emissive than the old "river" mix; the previous
// near-white emissive at 1.2 intensity bloomed the puddles into white
// discs once the rivers stopped competing for visual weight.
// Bridges aren't used since alien only has lakes, but the trim colors
// are kept for completeness.
const ALIEN_PALETTE: FlowPalette = {
  fluidColor: "#3ad6b0",
  fluidEmissive: "#5affc8",
  fluidEmissiveIntensity: 0.55,
  bridgeDeck: "#1f1230",
  bridgeTrim: "#4a2a70",
};

const FLOW_CONFIG: Partial<Record<Biome, FlowConfig>> = {
  lava: {
    riverCount: 2,
    tributaries: true,
    riverWidth: 2.2,
    tributaryWidth: 1.25,
    lakeCount: 5,
    lakeMin: 1.2,
    lakeRange: 1.6,
    bridges: true,
    palette: LAVA_PALETTE,
  },
  forest: {
    // One meandering channel + small ponds — keeps the level breezy
    // instead of carving the playfield in half.
    riverCount: 1,
    tributaries: false,
    riverWidth: 1.8,
    tributaryWidth: 1.0,
    lakeCount: 2,
    lakeMin: 0.9,
    lakeRange: 1.0,
    bridges: true,
    palette: FOREST_PALETTE,
  },
  alien: {
    // Static puddles only — goo doesn't flow on the alien plane. Puddles
    // are larger and more numerous to compensate for the absent rivers.
    riverCount: 0,
    tributaries: false,
    riverWidth: 0,
    tributaryWidth: 0,
    lakeCount: 8,
    lakeMin: 1.4,
    lakeRange: 1.8,
    bridges: false,
    palette: ALIEN_PALETTE,
  },
};

export const getFlowConfig = (biome: Biome): FlowConfig | null => FLOW_CONFIG[biome] ?? null;

// Biomes that have any flow features at all (rivers, lakes, or both).
// Trees/rocks/cosmetics consult this to know whether to query
// `isOnLavaSurface` for placement filtering. Renamed from the legacy
// "hasFlowFeatures" but the export is preserved for callers.
export const hasFlowFeatures = (biome: string): boolean => Boolean(FLOW_CONFIG[biome as Biome]);

export type River = { points: Vec2[]; width: number };
export type Lake = { x: number; y: number; rx: number; ry: number; rot: number };
// Two bridge shapes:
//   - rect: a deck spanning a single path×river crossing (the default).
//   - plaza: a disc that absorbs multiple overlapping crossings, e.g. when
//     two paths meet on a river (L24 Cascade) or four paths converge on
//     a center crossing (L22 Maelstrom). Without this, the rect bridges
//     visually pierce each other in an X with mismatched railings.
export type RectBridge = { kind: "rect"; pos: Vec2; rotY: number; length: number };
export type PlazaBridge = { kind: "plaza"; pos: Vec2; radius: number };
export type Bridge = RectBridge | PlazaBridge;

// Internal structure carrying provenance — only different-path bridges
// merge, so a single path's meander-crossings (same path, same river)
// never pull each other into a plaza. The pathIdx is dropped before the
// renderer sees the result.
type SourcedRect = RectBridge & { pathIdx: number };
export type LavaFeatures = { rivers: River[]; lakes: Lake[]; bridges: Bridge[] };

// Pick a perpendicular direction at a point along a polyline (sign-randomized).
const perpAt = (
  pts: Vec2[],
  i: number,
  rng: () => number,
): { ox: number; oy: number; tx: number; ty: number } => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  const sign = rng() < 0.5 ? -1 : 1;
  return { ox: -ty * sign, oy: tx * sign, tx, ty };
};

// Short meandering offshoot that leaves the parent river roughly perpendicular
// at index `parentIdx`, drifts a few units, then peters out. Uses the same
// sinusoidal+noise wobble as main rivers but at smaller amplitude.
const buildTributary = (rng: () => number, parent: Vec2[], parentIdx: number): Vec2[] => {
  const { ox, oy, tx, ty } = perpAt(parent, parentIdx, rng);
  const start = parent[parentIdx];
  const N = 5 + Math.floor(rng() * 3); // 5–7 segments
  const length = 4 + rng() * 3.5; // 4–7.5 world units
  const amp = 0.6 + rng() * 0.5;
  const phase = rng() * Math.PI * 2;
  // 35° drift along the parent so tributaries don't always come in at right
  // angles — looks more like real branching channels.
  const drift = (rng() - 0.5) * 0.6;
  const dirX = ox + tx * drift;
  const dirY = oy + ty * drift;
  const dlen = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / dlen;
  const uy = dirY / dlen;
  const nx = -uy;
  const ny = ux;
  const out: Vec2[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const along = t * length;
    const wobble = Math.sin(phase + t * Math.PI * 1.6) * amp * (1 - 0.6 * t);
    const x = start.x + ux * along + nx * wobble;
    const y = start.y + uy * along + ny * wobble;
    out.push({ x, y });
  }
  return out;
};

const tributaryEndpointInBounds = (points: Vec2[]): boolean => {
  const last = points[points.length - 1];
  return !(
    last.x < -MAP_WIDTH / 2 - 2 ||
    last.x > MAP_WIDTH / 2 + 2 ||
    last.y < -MAP_HEIGHT / 2 - 2 ||
    last.y > MAP_HEIGHT / 2 + 2
  );
};

// Same candidate-picker pattern as rivers. First candidate consumes baseRng
// to preserve old downstream determinism; the rest use private sub-rngs.
// Returns null if every candidate's endpoint falls off-map (caller skips).
const TRIBUTARY_CANDIDATES = 8;
const buildBestTributary = (
  baseRng: () => number,
  candidateSeed: number,
  parent: Vec2[],
  paths: Vec2[][],
  width: number,
): Vec2[] | null => {
  const baseParentIdx = 2 + Math.floor(baseRng() * Math.max(1, parent.length - 4));
  const baseTrib = buildTributary(baseRng, parent, baseParentIdx);
  let best: Vec2[] | null = tributaryEndpointInBounds(baseTrib) ? baseTrib : null;
  let bestCost = best ? scoreRiverPathInteraction(best, paths, width) : Infinity;

  for (let i = 1; i < TRIBUTARY_CANDIDATES; i++) {
    const candRng = mulberry32(candidateSeed + i * 12345);
    const parentIdx = 2 + Math.floor(candRng() * Math.max(1, parent.length - 4));
    const candidate = buildTributary(candRng, parent, parentIdx);
    if (!tributaryEndpointInBounds(candidate)) continue;
    const cost = scoreRiverPathInteraction(candidate, paths, width);
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
};

// Meandering polyline crossing the map on the chosen axis. Endpoints push
// well past the max-panned viewport (visible half ≈ 24 + pan ≈ 16 = 40 on
// X) so the river clearly runs off the screen at any zoom/pan. Shape is
// two smooth sinusoidal octaves — the higher one used to be per-vertex
// random jitter, but that left a visibly faceted bank silhouette on a
// 10-segment polyline; a second sine gives the same organic variation
// without the spikes, and we resample finely enough that adjacent
// segments are shorter than the river is wide.
const buildRiver = (rng: () => number, axis: "h" | "v"): Vec2[] => {
  const N = 48;
  const out: Vec2[] = [];
  const phase = rng() * Math.PI * 2;
  // Big-meander amplitude: was 2.4–4.4. Bumped to 3.5–6.5 for visibly
  // windier rivers. The candidate-picker rejects layouts that overflow
  // into paths, so even the upper end stays usable on busy maps.
  const amp = 3.5 + rng() * 3;
  const phase2 = rng() * Math.PI * 2;
  // Higher-frequency wobble: was 0.3–0.7. Bumped to 0.5–1.1 so the bank
  // has more secondary curl on top of the big meander.
  const amp2 = 0.5 + rng() * 0.6;
  const margin = 16;
  // Big-meander wavenumber bumped from 2.2π (~1.1 cycles across the map)
  // to 3.4π (~1.7 cycles). Secondary wobble bumped from 5.1π to 7.0π.
  const k1 = Math.PI * 3.4;
  const k2 = Math.PI * 7;
  if (axis === "h") {
    const baseY = (rng() - 0.5) * MAP_HEIGHT * 0.4;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -MAP_WIDTH / 2 - margin + t * (MAP_WIDTH + 2 * margin);
      const y = baseY + Math.sin(phase + t * k1) * amp + Math.sin(phase2 + t * k2) * amp2;
      out.push({ x, y });
    }
  } else {
    const baseX = (rng() - 0.5) * MAP_WIDTH * 0.4;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = -MAP_HEIGHT / 2 - margin + t * (MAP_HEIGHT + 2 * margin);
      const x = baseX + Math.sin(phase + t * k1) * amp + Math.sin(phase2 + t * k2) * amp2;
      out.push({ x, y });
    }
  }
  return out;
};

// Penalty for how badly a river layout interferes with the regular paths.
// Two terms:
//   - Parallel proximity: river segment runs close to a path segment AT a
//     small angle. Reads as the river awkwardly tracing the path.
//   - Oblique crossing: river segment crosses a path segment at a shallow
//     angle. Bridges still get built but the deck is wide and ugly, and
//     the river spends a long stretch bracketing the path.
// Right-angle crossings cost ~0; far-from-path geometry costs 0. The
// candidate-picker minimises this.
const RIVER_PROXIMITY_MARGIN = 1.5;
const RIVER_PARALLEL_COS = Math.cos((40 * Math.PI) / 180);
const scoreRiverPathInteraction = (river: Vec2[], paths: Vec2[][], riverWidth: number): number => {
  if (paths.length === 0) return 0;
  const proximityThreshold = riverWidth / 2 + PATH_WIDTH / 2 + RIVER_PROXIMITY_MARGIN;
  const proxSq = proximityThreshold * proximityThreshold;
  let cost = 0;
  for (let ri = 0; ri < river.length - 1; ri++) {
    const r1 = river[ri];
    const r2 = river[ri + 1];
    const rdx = r2.x - r1.x;
    const rdy = r2.y - r1.y;
    const rLen = Math.hypot(rdx, rdy);
    if (rLen < 1e-6) continue;
    const rtx = rdx / rLen;
    const rty = rdy / rLen;
    const rmx = (r1.x + r2.x) * 0.5;
    const rmy = (r1.y + r2.y) * 0.5;
    for (const path of paths) {
      for (let pi = 0; pi < path.length - 1; pi++) {
        const p1 = path[pi];
        const p2 = path[pi + 1];
        const pdx = p2.x - p1.x;
        const pdy = p2.y - p1.y;
        const pLen = Math.hypot(pdx, pdy);
        if (pLen < 1e-6) continue;
        const ptx = pdx / pLen;
        const pty = pdy / pLen;
        // |cos(θ)|: 1 = parallel, 0 = perpendicular.
        const cosA = Math.abs(rtx * ptx + rty * pty);
        if (segIntersect(r1, r2, p1, p2)) {
          // Crossings: cost is 0 at perpendicular (cosA=0), 6.25 at 45°
          // (cosA²=0.5), 25 at near-parallel grazing crossings.
          cost += cosA * cosA * 25;
          continue;
        }
        // Non-crossing: only penalise when the river is BOTH close AND
        // running roughly parallel to the path. Anything < 40° from the
        // path direction counts as parallel.
        if (cosA <= RIVER_PARALLEL_COS) continue;
        const d2 = distPointToSegSq(rmx, rmy, p1.x, p1.y, p2.x, p2.y);
        if (d2 >= proxSq) continue;
        const closeness = 1 - Math.sqrt(d2) / proximityThreshold;
        cost += rLen * cosA * cosA * closeness * 12;
      }
    }
  }
  return cost;
};

// Candidate-picker: try N rng-seeded river layouts, score each against the
// paths, return the lowest-cost one. The first candidate uses the shared
// `baseRng` on the preferred axis so downstream consumers (lakes,
// tributaries) see the SAME rng sequence as before — old levels are
// unchanged unless a better candidate is found. Subsequent candidates
// spin private mulberry32 sub-rngs so they don't perturb the shared
// stream. Half of the extra candidates flip to the off-axis with a small
// surcharge — flips happen only when the off-axis layout beats the
// preferred-axis best by enough to overcome the surcharge (e.g. when
// every horizontal layout would run parallel to a stack of horizontal
// paths).
const RIVER_CANDIDATES = 16;
const OFF_AXIS_PENALTY = 30;
const buildBestRiver = (
  baseRng: () => number,
  candidateSeed: number,
  preferredAxis: "h" | "v",
  paths: Vec2[][],
  riverWidth: number,
): Vec2[] => {
  let best = buildRiver(baseRng, preferredAxis);
  let bestCost = scoreRiverPathInteraction(best, paths, riverWidth);
  const otherAxis: "h" | "v" = preferredAxis === "h" ? "v" : "h";
  for (let i = 1; i < RIVER_CANDIDATES; i++) {
    const candRng = mulberry32(candidateSeed + i * 12345);
    const axis = i % 2 === 0 ? preferredAxis : otherAxis;
    const candidate = buildRiver(candRng, axis);
    const surcharge = axis === preferredAxis ? 0 : OFF_AXIS_PENALTY;
    const cost = scoreRiverPathInteraction(candidate, paths, riverWidth) + surcharge;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
};

const buildLakes = (
  rng: () => number,
  paths: Vec2[][],
  rivers: Vec2[][],
  config: FlowConfig,
): Lake[] => {
  const lakes: Lake[] = [];
  const target = config.lakeCount;
  // Tries scale with the target so dense puddle biomes get enough retries
  // to land all of them rather than capping at the old 240-attempt budget.
  const maxTries = Math.max(240, target * 60);
  let tries = 0;
  while (lakes.length < target && tries < maxTries) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH * 0.85;
    const y = (rng() - 0.5) * MAP_HEIGHT * 0.85;
    const rx = config.lakeMin + rng() * config.lakeRange;
    const ry = config.lakeMin + rng() * config.lakeRange;
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
    const riverClear = r + config.riverWidth * 0.2;
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
// covers the river's footprint along the path direction. Bridge length scales
// with river width so tributary crossings get smaller decks.
const BRIDGE_OVERHANG = 2.2;
const computeBridges = (paths: Vec2[][], rivers: River[]): Bridge[] => {
  const rects: SourcedRect[] = [];
  for (let pIdx = 0; pIdx < paths.length; pIdx++) {
    const path = paths[pIdx];
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
        const pts = river.points;
        for (let ri = 0; ri < pts.length - 1; ri++) {
          const r1 = pts[ri];
          const r2 = pts[ri + 1];
          const hit = segIntersect(a, b, r1, r2);
          if (!hit) continue;

          const rdx = r2.x - r1.x;
          const rdy = r2.y - r1.y;
          const rLen = Math.hypot(rdx, rdy);
          if (rLen < 1e-6) continue;
          const sinTheta = Math.abs(ptx * (rdy / rLen) - pty * (rdx / rLen));
          const projected = river.width / Math.max(0.25, sinTheta);
          rects.push({
            kind: "rect",
            pos: hit,
            rotY,
            length: projected + BRIDGE_OVERHANG,
            pathIdx: pIdx,
          });
        }
      }
    }
  }
  return mergeOverlappingBridges(consolidateSamePathBridges(rects));
};

// The smoothed path geometry (one polyline per path, ~50 vertices) means a
// single conceptual path×river crossing emits multiple adjacent bridges
// from successive segments of the same path. Collapse near-duplicate
// same-path bridges into the longest representative so they don't pile
// up in the X-merge phase below.
const SAME_PATH_DIST_SQ = PATH_WIDTH * PATH_WIDTH;
const consolidateSamePathBridges = (rects: SourcedRect[]): SourcedRect[] => {
  const out: SourcedRect[] = [];
  for (const b of rects) {
    let merged = false;
    for (let k = 0; k < out.length; k++) {
      const c = out[k];
      if (c.pathIdx !== b.pathIdx) continue;
      const dx = c.pos.x - b.pos.x;
      const dy = c.pos.y - b.pos.y;
      if (dx * dx + dy * dy >= SAME_PATH_DIST_SQ) continue;
      // Same crossing event for one path — keep the longer deck so the
      // river footprint stays covered when the path bends through the
      // crossing at varying angles.
      if (b.length > c.length) out[k] = b;
      merged = true;
      break;
    }
    if (!merged) out.push(b);
  }
  return out;
};

// Cluster bridges that come from DIFFERENT paths and overlap each other,
// then collapse each multi-bridge cluster into a single circular plaza.
// Restricting merges to cross-path bridges is what keeps a single path's
// own meander-crossings (which can be a few units apart and arrive at
// the river at opposite-going angles) rendering as separate decks.
//
// Distance: deck length scale, since a path-path X often emits its two
// bridges a few units apart (the paths cross slightly off the river
// segment) but their decks still physically overlap due to length.
//
// Angle: bridges from different paths can still happen to be parallel
// (e.g. two parallel paths each crossing the same V-river) — those don't
// X-overlap and shouldn't merge.
const BRIDGE_MERGE_DIST = PATH_WIDTH * 2;
const BRIDGE_MERGE_ANGLE = (30 * Math.PI) / 180;
const angleBetween = (a: number, b: number): number => {
  // Bridges are bidirectional — a deck rotated by π looks identical, so
  // collapse the diff into [0, π/2].
  let d = Math.abs(a - b) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
};
const mergeOverlappingBridges = (rects: SourcedRect[]): Bridge[] => {
  const n = rects.length;
  if (n <= 1) return rects.slice();

  // Union-find — bridges within MERGE_DIST get unioned. Transitive merging
  // means a chain of three near-collinear hits all collapses into one plaza.
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const distSq = BRIDGE_MERGE_DIST * BRIDGE_MERGE_DIST;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rects[i].pathIdx === rects[j].pathIdx) continue;
      const dx = rects[i].pos.x - rects[j].pos.x;
      const dy = rects[i].pos.y - rects[j].pos.y;
      if (dx * dx + dy * dy >= distSq) continue;
      if (angleBetween(rects[i].rotY, rects[j].rotY) < BRIDGE_MERGE_ANGLE) continue;
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[ri] = rj;
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = clusters.get(r);
    if (arr) arr.push(i);
    else clusters.set(r, [i]);
  }

  const out: Bridge[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length === 1) {
      const { pathIdx: _ignore, ...rect } = rects[idxs[0]];
      out.push(rect);
      continue;
    }
    let cx = 0;
    let cy = 0;
    let maxLen = 0;
    let maxOffset = 0;
    for (const i of idxs) {
      cx += rects[i].pos.x;
      cy += rects[i].pos.y;
      maxLen = Math.max(maxLen, rects[i].length);
    }
    cx /= idxs.length;
    cy /= idxs.length;
    // Plaza must reach every member's far end so the underlying river is
    // fully covered: max(per-bridge half-length + center→cluster-center
    // offset) is the conservative radius.
    for (const i of idxs) {
      const dx = rects[i].pos.x - cx;
      const dy = rects[i].pos.y - cy;
      const offset = Math.hypot(dx, dy);
      maxOffset = Math.max(maxOffset, offset + rects[i].length / 2);
    }
    const radius = Math.max(maxLen / 2, maxOffset) + 0.2;
    out.push({ kind: "plaza", pos: { x: cx, y: cy }, radius });
  }
  return out;
};

export const buildLavaFeatures = (paths: Vec2[][], levelId: number, biome: Biome): LavaFeatures => {
  const config = getFlowConfig(biome);
  if (!config) return { rivers: [], lakes: [], bridges: [] };

  const rng = mulberry32(levelId * 7919 + 31);

  // Pick alternating axes when there are multiple rivers so the channels
  // cross each other; for a single channel pick an axis from the seed.
  const mainPoints: Vec2[][] = [];
  for (let i = 0; i < config.riverCount; i++) {
    const axis: "h" | "v" =
      config.riverCount > 1 ? (i % 2 === 0 ? "h" : "v") : rng() < 0.5 ? "h" : "v";
    const candidateSeed = levelId * 7919 + 4001 + i * 911;
    mainPoints.push(buildBestRiver(rng, candidateSeed, axis, paths, config.riverWidth));
  }
  const rivers: River[] = mainPoints.map((points) => ({ points, width: config.riverWidth }));

  if (config.tributaries) {
    // 1–2 tributaries off each main river, branching from non-endpoint
    // indices. Each branch tries several candidates and keeps the one
    // with the lowest path-overlap cost; skipped if all candidates land
    // off-map. Only fired when the biome opts in (lava only today).
    let tribIdx = 0;
    for (const main of mainPoints) {
      const branchCount = 1 + (rng() < 0.5 ? 1 : 0);
      for (let b = 0; b < branchCount; b++) {
        const candidateSeed = levelId * 7919 + 5003 + tribIdx * 137;
        tribIdx++;
        const points = buildBestTributary(rng, candidateSeed, main, paths, config.tributaryWidth);
        if (points) rivers.push({ points, width: config.tributaryWidth });
      }
    }
  }

  const allPoints = rivers.map((r) => r.points);
  return {
    rivers,
    lakes: buildLakes(rng, paths, allPoints, config),
    bridges: config.bridges ? computeBridges(paths, rivers) : [],
  };
};

// Weighted sampling table over the lava surface (rivers + lakes). Built
// once per level so per-frame ember spawns just pick a point in O(items).
type SurfaceItem =
  | {
      kind: "river";
      ax: number;
      ay: number;
      bx: number;
      by: number;
      width: number;
      weight: number;
    }
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
      const weight = len * river.width;
      total += weight;
      items.push({
        kind: "river",
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        width: river.width,
        weight,
      });
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

const sampleOnce = (surface: LavaSurface, rand: () => number): { x: number; y: number } | null => {
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
      // Perpendicular offset within ±width/2, biased toward center
      // (square the random so embers cluster down the river spine).
      const u = rand() * 2 - 1;
      const off = Math.sign(u) * u * u * (item.width / 2);
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

// Bridge approximated as a stadium: distance-to-segment between the two
// endpoints, with radius = bridge half-width. Slight padding so embers
// don't visibly poke out from beneath the deck. Plaza bridges check a
// straight disc.
const BRIDGE_OCCLUDE_PAD = 0.2;
export const isUnderBridge = (bridges: Bridge[], x: number, y: number): boolean => {
  if (bridges.length === 0) return false;
  const halfW = (PATH_WIDTH + 0.4) / 2 + BRIDGE_OCCLUDE_PAD;
  const r2 = halfW * halfW;
  for (const b of bridges) {
    if (b.kind === "plaza") {
      const dx = x - b.pos.x;
      const dy = y - b.pos.y;
      const r = b.radius + BRIDGE_OCCLUDE_PAD;
      if (dx * dx + dy * dy < r * r) return true;
      continue;
    }
    const tx = Math.cos(b.rotY);
    const ty = -Math.sin(b.rotY);
    const halfL = b.length / 2;
    const ax = b.pos.x - tx * halfL;
    const ay = b.pos.y - ty * halfL;
    const bx = b.pos.x + tx * halfL;
    const by = b.pos.y + ty * halfL;
    if (distPointToSegSq(x, y, ax, ay, bx, by) < r2) return true;
  }
  return false;
};

// Pick a random world-space (x, y) point on the lava surface, weighted by
// area so larger features spawn proportionally more embers. Rejects samples
// that fall under a bridge so embers don't poke through the deck. Returns
// level (x, y) coords; caller maps y → -z for three.js.
export const sampleLavaSurface = (
  surface: LavaSurface,
  bridges: Bridge[],
  rand: () => number,
): { x: number; y: number } | null => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const sample = sampleOnce(surface, rand);
    if (!sample) return null;
    if (!isUnderBridge(bridges, sample.x, sample.y)) return sample;
  }
  // Give up rather than skip the spawn — keeps the pool full even if a
  // particularly bridge-heavy level rejects every try.
  return sampleOnce(surface, rand);
};

// True if (x, y) lands on any molten lava surface (lake interior OR river
// strip), padded outward by `padding` world units. Used to keep
// environmental decorations off the molten parts of lava maps. Pass null
// when the biome has no lava at all.
export const isOnLavaSurface = (
  features: LavaFeatures | null,
  x: number,
  y: number,
  padding = 0,
): boolean => {
  if (!features) return false;
  for (const l of features.lakes) {
    const dx = x - l.x;
    const dy = y - l.y;
    const c = Math.cos(-l.rot);
    const s = Math.sin(-l.rot);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    const rx = l.rx + padding;
    const ry = l.ry + padding;
    if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) return true;
  }
  for (const river of features.rivers) {
    const pts = river.points;
    const riverHalf = river.width / 2 + padding;
    const r2 = riverHalf * riverHalf;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distPointToSegSq(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < r2) return true;
    }
  }
  return false;
};
