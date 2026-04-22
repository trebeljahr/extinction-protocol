import { useMemo } from "react";
import * as THREE from "three";
import type { Vec2 } from "../sim/types";
import { PATH_WIDTH } from "../level";
import { segmentLength } from "../sim/path";
import { useGame } from "../store";

export const PathLine = () => {
  const paths = useGame(s => s.world.paths);
  return (
    <group>
      {paths.map((path, i) => (
        <SinglePath key={i} path={path} />
      ))}
    </group>
  );
};

const SinglePath = ({ path }: { path: Vec2[] }) => {
  const segments = useMemo(() => {
    const out: { pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const length = segmentLength(path, i);
      const midX = (a.x + b.x) / 2;
      const midZ = -(a.y + b.y) / 2;
      const rotY = Math.atan2(-(b.y - a.y), b.x - a.x);
      out.push({ pos: [midX, 0.02, midZ], rotY, length });
    }
    return out;
  }, [path]);

  const joints = useMemo(
    () => path.map(p => [p.x, 0.03, -p.y] as [number, number, number]),
    [path],
  );

  if (path.length < 2) return null;

  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]} receiveShadow>
          <planeGeometry args={[s.length, PATH_WIDTH]} />
          <meshStandardMaterial color="#c9a876" roughness={1} />
        </mesh>
      ))}
      {joints.map((p, i) => (
        <mesh key={`j${i}`} position={p} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[PATH_WIDTH / 2, 16]} />
          <meshStandardMaterial color="#c9a876" roughness={1} />
        </mesh>
      ))}
      <mesh
        position={[path[0].x, 0.04, -path[0].y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color="#4aff88" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[path[path.length - 1].x, 0.04, -path[path.length - 1].y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color="#ff4466" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
