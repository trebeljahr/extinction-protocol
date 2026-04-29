import { useMemo } from "react";
import * as THREE from "three";
import { BIOME_STYLE, type Biome, biomeForPos } from "../biomes";
import { LEVELS } from "../levels";

// Soft falloff width in world units — how quickly one level node's biome
// bleeds into neighbors. Larger = more blended; smaller = sharper biome patches.
const FALLOFF = 9;

// Half-width of the edge fade — points within this distance of the plane
// boundary smoothly blend toward the fallback sky color so the rectangular
// plane edge never reads as a hard seam at any zoom.
const EDGE_FADE = 24;

// Y-axis biome bands (sim coords), upper boundaries — must mirror
// `biomeForPos` in ../biomes. Used for the IDW fallback so the ground
// far from every level node still reads as the local biome instead of
// blowing out to bright sky.
const BAND_BOUNDARIES: { upper: number; biome: Biome }[] = [
  { upper: -9, biome: "forest" },
  { upper: -2, biome: "snow" },
  { upper: 5, biome: "desert" },
  { upper: 12, biome: "wasteland" },
  { upper: 19, biome: "lava" },
  { upper: Number.POSITIVE_INFINITY, biome: "alien" },
];

// Smoothing zone (sim units) on either side of each band boundary so the
// fallback color blends between adjacent biomes instead of stepping —
// otherwise the discrete biomeForPos thresholds show as horizontal stripes
// in the empty (no-level) corners of the map.
const BAND_BLEND = 3.5;

// The world map is WORLD_W x WORLD_H centred at (0,0) in xy sim coords.
// Render plane lies on the xz plane (y-up), so sim.y maps to world -z.
export const BiomeGround = ({
  width,
  height,
  segments = 160,
}: {
  width: number;
  height: number;
  segments?: number;
}) => {
  const geometry = useMemo(() => {
    const segX = segments;
    const segY = Math.max(16, Math.round(segments * (height / width)));
    const geom = new THREE.PlaneGeometry(width, height, segX, segY);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const acc = new THREE.Color();

    const nodes = LEVELS.map((l) => ({
      x: l.nodePos.x,
      y: l.nodePos.y,
      color: new THREE.Color(BIOME_STYLE[biomeForPos(l.nodePos)].groundColor),
    }));

    const halfW = width / 2;
    const halfH = height / 2;
    const sky = new THREE.Color(0.72, 0.816, 0.894); // #b8d0e4 — matches WorldMap BG

    // Pre-resolve each band's ground color once — referenced inside the
    // hot per-vertex loop below.
    const bandColors = BAND_BOUNDARIES.map(
      (b) => new THREE.Color(BIOME_STYLE[b.biome].groundColor),
    );
    const fallback = new THREE.Color();
    const fallbackNext = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      // sim-space y is -z in world
      const sy = -wz;

      // inverse distance weighting, with power 2 and epsilon
      let totalW = 0;
      acc.setRGB(0, 0, 0);
      for (const n of nodes) {
        const dx = wx - n.x;
        const dy = sy - n.y;
        const d2 = dx * dx + dy * dy;
        // gaussian-ish falloff; exp(-d2 / (2*FALLOFF^2))
        const w = Math.exp(-d2 / (2 * FALLOFF * FALLOFF));
        if (w < 0.001) continue;
        acc.r += n.color.r * w;
        acc.g += n.color.g * w;
        acc.b += n.color.b * w;
        totalW += w;
      }
      if (totalW > 0) {
        acc.r /= totalW;
        acc.g /= totalW;
        acc.b /= totalW;
      } else {
        // Far from every level node — fall back to the local biome-band's
        // own ground color rather than the bright sky tint. The previous
        // sky fallback was sampled at ~0.8 luminance, which the directional
        // light pushed past the bloom threshold and produced a white halo
        // at zoom-out + corner-pan. Adjacent bands smoothstep-blend across
        // BAND_BLEND so the fallback never steps between biomes.
        let bandIdx = BAND_BOUNDARIES.length - 1;
        for (let b = 0; b < BAND_BOUNDARIES.length; b++) {
          if (sy <= BAND_BOUNDARIES[b].upper) {
            bandIdx = b;
            break;
          }
        }
        const upper = BAND_BOUNDARIES[bandIdx].upper;
        const lower = bandIdx > 0 ? BAND_BOUNDARIES[bandIdx - 1].upper : Number.NEGATIVE_INFINITY;
        const distToUpper = upper - sy; // ≥0 since sy ≤ upper
        const distToLower = sy - lower; // ≥0 since sy > previous-upper
        if (
          distToUpper < BAND_BLEND &&
          bandIdx + 1 < BAND_BOUNDARIES.length &&
          Number.isFinite(upper)
        ) {
          // Approaching the upper boundary: blend toward next band up.
          const tn = 0.5 + (sy - upper) / (2 * BAND_BLEND); // 0..0.5
          const k = tn * tn * (3 - 2 * tn);
          fallback.copy(bandColors[bandIdx]);
          fallbackNext.copy(bandColors[bandIdx + 1]);
          acc.copy(fallback).lerp(fallbackNext, k);
        } else if (distToLower < BAND_BLEND && bandIdx > 0 && Number.isFinite(lower)) {
          // Approaching the lower boundary: blend toward band below.
          const tn = 0.5 + (sy - lower) / (2 * BAND_BLEND); // 0.5..1
          const k = tn * tn * (3 - 2 * tn);
          fallback.copy(bandColors[bandIdx - 1]);
          fallbackNext.copy(bandColors[bandIdx]);
          acc.copy(fallback).lerp(fallbackNext, k);
        } else {
          acc.copy(bandColors[bandIdx]);
        }
      }

      // Edge-fade: within EDGE_FADE of the plane boundary, crossfade to
      // the sky color so the plane edge can never read as a rectangular seam.
      const edgeDistX = halfW - Math.abs(wx);
      const edgeDistZ = halfH - Math.abs(wz);
      const edgeDist = Math.min(edgeDistX, edgeDistZ);
      if (edgeDist < EDGE_FADE) {
        // Smoothstep 0..1 across the fade band.
        const t = Math.max(0, edgeDist / EDGE_FADE);
        const k = t * t * (3 - 2 * t);
        acc.r = acc.r * k + sky.r * (1 - k);
        acc.g = acc.g * k + sky.g * (1 - k);
        acc.b = acc.b * k + sky.b * (1 - k);
      }

      colors[i * 3] = acc.r;
      colors[i * 3 + 1] = acc.g;
      colors[i * 3 + 2] = acc.b;
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [width, height, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
};
