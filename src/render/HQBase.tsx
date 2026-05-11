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
};

const BASE_PROPS: PropDef[] = [
  {
    url: "/models/scifi/satelliteDish.glb",
    right: -2.2,
    fwd: 0.6,
    targetHeight: 1.4,
    facesHQ: true,
  },
  { url: "/models/scifi/machine_generatorLarge.glb", right: 2.2, fwd: 0.4, targetHeight: 1.2 },
  { url: "/models/scifi/barrels.glb", right: -1.2, fwd: 2.2, targetHeight: 0.65 },
  { url: "/models/scifi/structure_closed.glb", right: 1.5, fwd: 2.4, targetHeight: 1.3 },
  { url: "/models/scifi/machine_wireless.glb", right: 0.0, fwd: -0.8, targetHeight: 0.9 },
];

const ALL_URLS = BASE_PROPS.map((p) => p.url);

type Instance = GroupItem & { url: string };

const baseScaleFor = (source: MeshSource, url: string): number => {
  const def = BASE_PROPS.find((p) => p.url === url);
  const target = def?.targetHeight ?? 0.8;
  return target / source.height;
};

const HQBasePad = ({ position, yaw }: { position: [number, number]; yaw: number }) => (
  <mesh position={[position[0], 0.015, -position[1]]} rotation={[-Math.PI / 2, 0, yaw]}>
    <circleGeometry args={[2.8, 32]} />
    <meshStandardMaterial
      color="#3a3e4a"
      roughness={0.85}
      metalness={0.15}
      transparent
      opacity={0.35}
      depthWrite={false}
    />
  </mesh>
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
        const propYaw = def.facesHQ ? yaw + Math.PI : yaw + ((pi * 1.3) % (Math.PI * 2));
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
