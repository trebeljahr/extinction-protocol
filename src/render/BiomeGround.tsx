import { useMemo } from "react";
import * as THREE from "three";
import { LEVELS } from "../levels";
import { BIOME_STYLE, biomeForPos } from "../biomes";

// Soft falloff width in world units — how quickly one level node's biome
// bleeds into neighbors. Larger = more blended; smaller = sharper biome patches.
const FALLOFF = 9;

// Half-width of the edge fade — points within this distance of the plane
// boundary smoothly blend toward the fallback sky color so the rectangular
// plane edge never reads as a hard seam at any zoom.
const EDGE_FADE = 24;

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

    const nodes = LEVELS.map(l => ({
      x: l.nodePos.x,
      y: l.nodePos.y,
      color: new THREE.Color(BIOME_STYLE[biomeForPos(l.nodePos)].groundColor),
    }));

    const halfW = width / 2;
    const halfH = height / 2;
    const sky = new THREE.Color(0.72, 0.816, 0.894); // #b8d0e4 — matches WorldMap BG

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
        acc.copy(sky);
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
