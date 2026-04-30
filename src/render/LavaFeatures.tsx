import { nanoid } from "nanoid";
import { useMemo } from "react";
import {
  ALIEN_GOO_COLOR,
  ALIEN_GOO_EMISSIVE,
  ALIEN_GOO_EMISSIVE_INTENSITY,
  buildLavaFeatures,
  hasFlowFeatures,
  LAVA_COLOR,
  LAVA_EMISSIVE,
  LAVA_EMISSIVE_INTENSITY,
} from "../lavaGeometry";
import { PATH_WIDTH } from "../level";
import type { Vec2 } from "../sim/types";
import { useGame } from "../store";

// Lava bridges are scorched timber. Alien bridges are darker stone-on-violet
// to match the goo palette underneath.
const LAVA_BRIDGE_DECK = "#2e1a10";
const LAVA_BRIDGE_TRIM = "#7a3a1e";
const ALIEN_BRIDGE_DECK = "#1f1230";
const ALIEN_BRIDGE_TRIM = "#4a2a70";

type FlowPalette = {
  fluidColor: string;
  fluidEmissive: string;
  fluidIntensity: number;
  bridgeDeck: string;
  bridgeTrim: string;
};

const LAVA_PALETTE: FlowPalette = {
  fluidColor: LAVA_COLOR,
  fluidEmissive: LAVA_EMISSIVE,
  fluidIntensity: LAVA_EMISSIVE_INTENSITY,
  bridgeDeck: LAVA_BRIDGE_DECK,
  bridgeTrim: LAVA_BRIDGE_TRIM,
};

const ALIEN_PALETTE: FlowPalette = {
  fluidColor: ALIEN_GOO_COLOR,
  fluidEmissive: ALIEN_GOO_EMISSIVE,
  fluidIntensity: ALIEN_GOO_EMISSIVE_INTENSITY,
  bridgeDeck: ALIEN_BRIDGE_DECK,
  bridgeTrim: ALIEN_BRIDGE_TRIM,
};

export const LavaFeatures = () => {
  const biome = useGame((s) => s.world.biome);
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);

  const decorated = useMemo(() => {
    if (!hasFlowFeatures(biome)) return null;
    const features = buildLavaFeatures(paths, levelId);
    return {
      rivers: features.rivers.map((r) => ({ ...r, id: nanoid() })),
      lakes: features.lakes.map((l) => ({ ...l, id: nanoid() })),
      bridges: features.bridges.map((b) => ({ ...b, id: nanoid() })),
    };
  }, [biome, paths, levelId]);

  if (!decorated) return null;

  const palette = biome === "alien" ? ALIEN_PALETTE : LAVA_PALETTE;
  const bridgeWidth = PATH_WIDTH + 0.4;

  return (
    <group>
      {decorated.rivers.map((river) => (
        <RiverMesh key={river.id} points={river.points} width={river.width} palette={palette} />
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
            color={palette.fluidColor}
            emissive={palette.fluidEmissive}
            emissiveIntensity={palette.fluidIntensity}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
      {decorated.bridges.map((b) => (
        <group key={b.id} position={[b.pos.x, 0.06, -b.pos.y]} rotation={[0, b.rotY, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.length, 0.18, bridgeWidth]} />
            <meshStandardMaterial color={palette.bridgeDeck} roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, bridgeWidth / 2 - 0.06]} castShadow>
            <boxGeometry args={[b.length, 0.22, 0.12]} />
            <meshStandardMaterial color={palette.bridgeTrim} roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, -(bridgeWidth / 2 - 0.06)]} castShadow>
            <boxGeometry args={[b.length, 0.22, 0.12]} />
            <meshStandardMaterial color={palette.bridgeTrim} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const RiverMesh = ({
  points,
  width,
  palette,
}: {
  points: Vec2[];
  width: number;
  palette: FlowPalette;
}) => {
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
          <planeGeometry args={[s.length, width]} />
          <meshStandardMaterial
            color={palette.fluidColor}
            emissive={palette.fluidEmissive}
            emissiveIntensity={palette.fluidIntensity}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
      {joints.map((j) => (
        <mesh key={j.id} position={j.pos} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[width / 2, 16]} />
          <meshStandardMaterial
            color={palette.fluidColor}
            emissive={palette.fluidEmissive}
            emissiveIntensity={palette.fluidIntensity}
            roughness={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};
