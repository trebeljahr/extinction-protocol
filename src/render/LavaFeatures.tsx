import { nanoid } from "nanoid";
import { useMemo } from "react";
import {
  LAVA_COLOR,
  LAVA_EMISSIVE,
  LAVA_EMISSIVE_INTENSITY,
  RIVER_WIDTH,
  buildLavaFeatures,
} from "../lavaGeometry";
import { PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

const BRIDGE_DECK = "#2e1a10";
const BRIDGE_TRIM = "#7a3a1e";

export const LavaFeatures = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);

  const decorated = useMemo(() => {
    if (biome !== "lava") return null;
    const features = buildLavaFeatures(paths, levelId);
    return {
      rivers: features.rivers.map((r) => ({ ...r, id: nanoid() })),
      lakes: features.lakes.map((l) => ({ ...l, id: nanoid() })),
      bridges: features.bridges.map((b) => ({ ...b, id: nanoid() })),
    };
  }, [biome, paths, levelId]);

  if (!decorated) return null;

  const bridgeWidth = PATH_WIDTH + 0.4;

  return (
    <group>
      {decorated.rivers.map((river) => (
        <RiverMesh key={river.id} points={river.points} />
      ))}
      {decorated.lakes.map((l) => (
        <mesh
          key={l.id}
          position={[l.x, 0.014, -l.y]}
          rotation={[-Math.PI / 2, 0, l.rot]}
          scale={[l.rx, l.ry, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 28]} />
          <meshStandardMaterial
            color={LAVA_COLOR}
            emissive={LAVA_EMISSIVE}
            emissiveIntensity={LAVA_EMISSIVE_INTENSITY}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
      {decorated.bridges.map((b) => (
        <group key={b.id} position={[b.pos.x, 0.06, -b.pos.y]} rotation={[0, b.rotY, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.length, 0.18, bridgeWidth]} />
            <meshStandardMaterial color={BRIDGE_DECK} roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, bridgeWidth / 2 - 0.06]} castShadow>
            <boxGeometry args={[b.length, 0.22, 0.12]} />
            <meshStandardMaterial color={BRIDGE_TRIM} roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, -(bridgeWidth / 2 - 0.06)]} castShadow>
            <boxGeometry args={[b.length, 0.22, 0.12]} />
            <meshStandardMaterial color={BRIDGE_TRIM} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const RiverMesh = ({ points }: { points: Vec2[] }) => {
  const segs = useMemo(() => {
    const out: { id: string; pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      out.push({
        id: nanoid(),
        pos: [(a.x + b.x) / 2, 0.012, -(a.y + b.y) / 2],
        rotY: Math.atan2(-dy, dx),
        length,
      });
    }
    return out;
  }, [points]);

  const joints = useMemo(
    () =>
      points.map((p) => ({ id: nanoid(), pos: [p.x, 0.013, -p.y] as [number, number, number] })),
    [points],
  );

  return (
    <group>
      {segs.map((s) => (
        <mesh key={s.id} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]} receiveShadow>
          <planeGeometry args={[s.length, RIVER_WIDTH]} />
          <meshStandardMaterial
            color={LAVA_COLOR}
            emissive={LAVA_EMISSIVE}
            emissiveIntensity={LAVA_EMISSIVE_INTENSITY}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
      {joints.map((j) => (
        <mesh key={j.id} position={j.pos} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[RIVER_WIDTH / 2, 16]} />
          <meshStandardMaterial
            color={LAVA_COLOR}
            emissive={LAVA_EMISSIVE}
            emissiveIntensity={LAVA_EMISSIVE_INTENSITY}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};
