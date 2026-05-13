import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { useGame } from "../store";
import { type GroupItem, InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Decorative sci-fi props placed around each HQ endpoint so the plasma
// turret reads as the centrepiece of a small compound rather than a lone
// gun in a field. Layout is fixed relative to the HQ's facing direction
// (toward incoming enemies) so props never obstruct the path.

type PropDef = {
  url: string;
  right: number;
  fwd: number;
  targetHeight: number;
  facesHQ?: boolean;
  yawOffset?: number;
};

const BASE_PROPS: PropDef[] = [
  {
    url: "/models/scifi/gate_simple.glb",
    right: 0,
    fwd: 1.85,
    targetHeight: 0.85,
  },
  {
    url: "/models/scifi/structure_detailed.glb",
    right: -1.55,
    fwd: -0.75,
    targetHeight: 1.35,
  },
  {
    url: "/models/scifi/structure_closed.glb",
    right: 1.55,
    fwd: -0.65,
    targetHeight: 1.25,
  },
  {
    url: "/models/scifi/satelliteDish_detailed.glb",
    right: -2.25,
    fwd: 0.55,
    targetHeight: 1.25,
    facesHQ: true,
  },
  { url: "/models/scifi/machine_generatorLarge.glb", right: 2.25, fwd: 0.45, targetHeight: 1.05 },
  { url: "/models/scifi/barrels.glb", right: -0.85, fwd: 1.15, targetHeight: 0.58 },
  {
    url: "/models/scifi/rover.glb",
    right: 0.95,
    fwd: 1.18,
    targetHeight: 0.62,
    yawOffset: Math.PI / 2,
  },
  { url: "/models/scifi/machine_wirelessCable.glb", right: 0, fwd: -1.45, targetHeight: 0.78 },
];

const ALL_URLS = BASE_PROPS.map((p) => p.url);

type Instance = GroupItem & { url: string };

const baseScaleFor = (source: MeshSource, url: string): number => {
  const def = BASE_PROPS.find((p) => p.url === url);
  const target = def?.targetHeight ?? 0.8;
  return target / source.height;
};

const HQBasePad = ({ position, yaw }: { position: [number, number]; yaw: number }) => (
  <group position={[position[0], 0, -position[1]]} rotation={[0, yaw, 0]}>
    <mesh position={[0, 0.014, 0]}>
      <boxGeometry args={[5.8, 0.035, 4.15]} />
      <meshStandardMaterial
        color="#303643"
        roughness={0.82}
        metalness={0.18}
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </mesh>
    <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.05, 1.32, 40]} />
      <meshBasicMaterial color="#8fb7d1" transparent opacity={0.24} />
    </mesh>
  </group>
);

export const HQBase = () => {
  const paths = useGame((s) => s.world.paths);

  const { instances, pads } = useMemo(() => {
    const insts: Instance[] = [];
    const padList: { position: [number, number]; yaw: number }[] = [];

    for (const path of paths) {
      if (path.length < 2) continue;
      const last = path[path.length - 1];
      const prev = path[path.length - 2];
      const dx = prev.x - last.x;
      const dy = prev.y - last.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const faceX = dx / len;
      const faceY = dy / len;
      const rightX = faceY;
      const rightY = -faceX;
      const yaw = Math.atan2(dx, -dy);

      padList.push({ position: [last.x, last.y], yaw });

      for (let pi = 0; pi < BASE_PROPS.length; pi++) {
        const def = BASE_PROPS[pi];
        const wx = last.x + def.right * rightX + def.fwd * faceX;
        const wy = last.y + def.right * rightY + def.fwd * faceY;
        const propYaw = yaw + (def.facesHQ ? Math.PI : 0) + (def.yawOffset ?? 0);
        insts.push({ url: def.url, pos: { x: wx, y: wy }, scale: 1, rotY: propYaw });
      }
    }
    return { instances: insts, pads: padList };
  }, [paths]);

  const grouped = useMemo(() => {
    const map = new Map<string, Instance[]>();
    for (const inst of instances) {
      let arr = map.get(inst.url);
      if (!arr) {
        arr = [];
        map.set(inst.url, arr);
      }
      arr.push(inst);
    }
    return map;
  }, [instances]);

  return (
    <>
      {pads.map((pad, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable per level
        <HQBasePad key={i} position={pad.position} yaw={pad.yaw} />
      ))}
      {[...grouped.entries()].map(([url, items]) => (
        <InstancedGroup key={url} url={url} items={items} baseScaleFor={baseScaleFor} />
      ))}
    </>
  );
};

for (const url of ALL_URLS) useGLTF.preload(url);
