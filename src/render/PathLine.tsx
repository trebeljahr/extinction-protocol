import { nanoid } from "nanoid";
import { useMemo } from "react";
import * as THREE from "three";
import { BIOME_STYLE } from "../biomes";
import { PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

export const PathLine = () => {
  const paths = useGame((s) => s.world.paths);
  const biome = useGame((s) => s.world.biome);
  const style = BIOME_STYLE[biome];
  const pathsWithIds = useMemo(() => paths.map((path) => ({ id: nanoid(), path })), [paths]);
  return (
    <group>
      {pathsWithIds.map(({ id, path }) => (
        <SinglePath
          key={id}
          path={path}
          pathColor={style.pathColor}
          startColor={style.startRing}
          endColor={style.endRing}
        />
      ))}
    </group>
  );
};

// Cheap deterministic hash → [-1, 1] for per-vertex jitter. Same coords always
// produce the same wobble, so paths don't shimmer between renders.
const jitterAt = (x: number, y: number, salt: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
};

// Centripetal Catmull–Rom interpolation. Pads endpoints by reflecting so the
// first/last spans get a tangent. Returns a denser polyline that follows the
// same waypoints but bends through them instead of cornering. Plus a tiny
// perpendicular wobble per vertex so the rendered strip edges read organic
// instead of laser-straight.
const smoothPath = (path: Vec2[]): Vec2[] => {
  if (path.length < 2) return path.slice();
  const SUBDIV = 10;
  const WOBBLE = 0.18; // world units; subtle so enemies still appear on-path
  const ext: Vec2[] = [];
  ext.push({ x: 2 * path[0].x - path[1].x, y: 2 * path[0].y - path[1].y });
  for (const p of path) ext.push(p);
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  ext.push({ x: 2 * last.x - prev.x, y: 2 * last.y - prev.y });

  const out: Vec2[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const p0 = ext[i - 1];
    const p1 = ext[i];
    const p2 = ext[i + 1];
    const p3 = ext[i + 2];
    const steps = i === ext.length - 3 ? SUBDIV + 1 : SUBDIV;
    for (let j = 0; j < steps; j++) {
      const t = j / SUBDIV;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      // Perpendicular wobble — taper to zero at the very ends so start/end
      // rings still sit on the original spawn/objective coords.
      const taper = Math.min(
        1,
        Math.min(j + i * SUBDIV, (ext.length - 3 - i) * SUBDIV + (SUBDIV - j)) / 4,
      );
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = jitterAt(p1.x, p1.y, j) * WOBBLE * taper;
      out.push({ x: x + nx * w, y: y + ny * w });
    }
  }
  return out;
};

const SinglePath = ({
  path,
  pathColor,
  startColor,
  endColor,
}: {
  path: Vec2[];
  pathColor: string;
  startColor: string;
  endColor: string;
}) => {
  const smoothed = useMemo(() => smoothPath(path), [path]);

  const segments = useMemo(() => {
    const out: { id: string; pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < smoothed.length - 1; i++) {
      const a = smoothed[i];
      const b = smoothed[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const midX = (a.x + b.x) / 2;
      const midZ = -(a.y + b.y) / 2;
      const rotY = Math.atan2(-(b.y - a.y), b.x - a.x);
      out.push({ id: nanoid(), pos: [midX, 0.02, midZ], rotY, length });
    }
    return out;
  }, [smoothed]);

  // Joints fill the gaps between rotated quads. With smoothing the joints
  // become visually invisible mid-path but still cap sharp turns cleanly.
  const joints = useMemo(
    () =>
      smoothed.map((p) => ({ id: nanoid(), pos: [p.x, 0.03, -p.y] as [number, number, number] })),
    [smoothed],
  );

  if (path.length < 2) return null;

  return (
    <group>
      {segments.map((s) => (
        <mesh key={s.id} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]} receiveShadow>
          <planeGeometry args={[s.length, PATH_WIDTH]} />
          <meshStandardMaterial color={pathColor} roughness={1} />
        </mesh>
      ))}
      {joints.map((j) => (
        <mesh key={j.id} position={j.pos} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[PATH_WIDTH / 2, 16]} />
          <meshStandardMaterial color={pathColor} roughness={1} />
        </mesh>
      ))}
      <mesh position={[path[0].x, 0.04, -path[0].y]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color={startColor} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[path[path.length - 1].x, 0.04, -path[path.length - 1].y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color={endColor} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
