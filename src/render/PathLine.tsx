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
  const pathDebug = useGame((s) => s.pathDebug);
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
      {pathDebug &&
        pathsWithIds.map(({ id, path }, idx) => (
          <PathDebugOverlay key={`dbg-${id}`} path={path} pathIndex={idx} />
        ))}
    </group>
  );
};

// Debug overlay — renders the raw waypoint polyline + numbered waypoint
// markers + a centerline through the smoothed render so the source-of-
// truth shape (used by enemy traversal) is visible alongside the visual
// path. Only mounts when `pathDebug` is on; gated by isDebug at the
// store level so production builds dead-code the toggle.
const PathDebugOverlay = ({ path, pathIndex }: { path: Vec2[]; pathIndex: number }) => {
  const segments = useMemo(() => {
    const out: { id: string; pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const midX = (a.x + b.x) / 2;
      const midZ = -(a.y + b.y) / 2;
      const rotY = Math.atan2(-(b.y - a.y), b.x - a.x);
      out.push({ id: nanoid(), pos: [midX, 0.18, midZ], rotY, length });
    }
    return out;
  }, [path]);

  // Distinct color per pathIndex so multi-path levels are easy to read.
  const debugColor = pathIndex % 2 === 0 ? "#ff3aff" : "#3affff";

  return (
    <group>
      {segments.map((s) => (
        <mesh key={s.id} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]}>
          <planeGeometry args={[s.length, 0.08]} />
          <meshBasicMaterial color={debugColor} transparent opacity={0.9} />
        </mesh>
      ))}
      {path.map((p) => (
        <group
          key={`wp-${pathIndex}-${p.x.toFixed(3)}-${p.y.toFixed(3)}`}
          position={[p.x, 0.2, -p.y]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.15, 0.3, 16]} />
            <meshBasicMaterial
              color={debugColor}
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
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
  // `path` here is already the smoothed polyline produced by
  // smoothPath() in createWorld — no per-render smoothing or wobble, so
  // the painted ribbon is the exact same polyline enemies walk.
  const segments = useMemo(() => {
    const out: { id: string; pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const midX = (a.x + b.x) / 2;
      const midZ = -(a.y + b.y) / 2;
      const rotY = Math.atan2(-(b.y - a.y), b.x - a.x);
      out.push({ id: nanoid(), pos: [midX, 0.02, midZ], rotY, length });
    }
    return out;
  }, [path]);

  // Joints fill the gaps between rotated quads. With smoothing the joints
  // become visually invisible mid-path but still cap sharp turns cleanly.
  const joints = useMemo(
    () => path.map((p) => ({ id: nanoid(), pos: [p.x, 0.03, -p.y] as [number, number, number] })),
    [path],
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
