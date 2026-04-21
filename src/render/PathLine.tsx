import { useMemo } from "react";
import * as THREE from "three";
import { PATH, PATH_WIDTH } from "../level";
import { segmentLength } from "../sim/path";

export const PathLine = () => {
  const segments = useMemo(() => {
    const out: { pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i];
      const b = PATH[i + 1];
      const length = segmentLength(PATH, i);
      const midX = (a.x + b.x) / 2;
      const midZ = -(a.y + b.y) / 2;
      const rotY = Math.atan2(-(b.y - a.y), b.x - a.x);
      out.push({ pos: [midX, 0.02, midZ], rotY, length });
    }
    return out;
  }, []);

  const joints = useMemo(
    () => PATH.map(p => [p.x, 0.03, -p.y] as [number, number, number]),
    [],
  );

  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]} receiveShadow>
          <planeGeometry args={[s.length, PATH_WIDTH]} />
          <meshStandardMaterial color="#3a2e22" roughness={1} />
        </mesh>
      ))}
      {joints.map((p, i) => (
        <mesh key={`j${i}`} position={p} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[PATH_WIDTH / 2, 16]} />
          <meshStandardMaterial color="#3a2e22" roughness={1} />
        </mesh>
      ))}
      <mesh
        position={[PATH[0].x, 0.04, -PATH[0].y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color="#4aff88" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[PATH[PATH.length - 1].x, 0.04, -PATH[PATH.length - 1].y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.6, 1.0, 24]} />
        <meshBasicMaterial color="#ff4466" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
