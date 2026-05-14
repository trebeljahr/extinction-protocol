import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type * as THREE from "three";
import type { Vec2 } from "../sim/types";
import { TOWER_FOOTPRINT } from "../sim/world";
import { useGame } from "../store";
import { type GroupItem, InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Decorative sci-fi props placed around each HQ endpoint so the plasma
// turret reads as the centrepiece of a small research compound rather
// than a lone gun in a field. Render-only: they are culled around towers
// and never participate in placement blocking.

type PropDef = {
  url: string;
  right: number;
  fwd: number;
  targetHeight: number;
  clearRadius: number;
  facesHQ?: boolean;
  yawOffset?: number;
};

type PrimitiveDef = {
  kind: "fence" | "light";
  right: number;
  fwd: number;
  clearRadius: number;
  length?: number;
  yawOffset?: number;
};

const BASE_PROPS: PropDef[] = [
  {
    url: "/models/scifi/hangar_smallA.glb",
    right: -1.45,
    fwd: -1.65,
    targetHeight: 1.08,
    clearRadius: 1.05,
    facesHQ: true,
  },
  {
    url: "/models/scifi/structure_detailed.glb",
    right: 1.35,
    fwd: -1.25,
    targetHeight: 1.18,
    clearRadius: 0.95,
    facesHQ: true,
  },
  {
    url: "/models/scifi/structure_closed.glb",
    right: -2.45,
    fwd: 0.35,
    targetHeight: 0.95,
    clearRadius: 0.85,
    facesHQ: true,
  },
  {
    url: "/models/scifi/gate_simple.glb",
    right: 0,
    fwd: 2.05,
    targetHeight: 0.78,
    clearRadius: 0.7,
  },
  {
    url: "/models/scifi/satelliteDish_detailed.glb",
    right: -2.8,
    fwd: -0.75,
    targetHeight: 1.18,
    clearRadius: 0.8,
    facesHQ: true,
  },
  {
    url: "/models/scifi/machine_generatorLarge.glb",
    right: 2.65,
    fwd: -0.25,
    targetHeight: 1.0,
    clearRadius: 0.85,
  },
  {
    url: "/models/scifi/machine_wirelessCable.glb",
    right: 0.35,
    fwd: -2.35,
    targetHeight: 0.72,
    clearRadius: 0.6,
  },
  {
    url: "/models/scifi/machine_barrelLarge.glb",
    right: 2.15,
    fwd: 1.2,
    targetHeight: 0.62,
    clearRadius: 0.55,
  },
  {
    url: "/models/scifi/barrels.glb",
    right: -1.25,
    fwd: 1.2,
    targetHeight: 0.46,
    clearRadius: 0.45,
  },
  {
    url: "/models/scifi/rover.glb",
    right: 1.05,
    fwd: 1.55,
    targetHeight: 0.56,
    clearRadius: 0.65,
    yawOffset: Math.PI / 2,
  },
];

const BASE_PRIMITIVES: PrimitiveDef[] = [
  { kind: "fence", right: -2.25, fwd: -2.45, length: 1.4, clearRadius: 0.65 },
  { kind: "fence", right: 2.25, fwd: -2.45, length: 1.4, clearRadius: 0.65 },
  {
    kind: "fence",
    right: -3.15,
    fwd: -0.8,
    length: 1.2,
    yawOffset: Math.PI / 2,
    clearRadius: 0.55,
  },
  {
    kind: "fence",
    right: 3.15,
    fwd: -0.8,
    length: 1.2,
    yawOffset: Math.PI / 2,
    clearRadius: 0.55,
  },
  { kind: "light", right: -2.9, fwd: 1.55, clearRadius: 0.35 },
  { kind: "light", right: 2.9, fwd: 1.55, clearRadius: 0.35 },
  { kind: "light", right: -2.9, fwd: -2.0, clearRadius: 0.35 },
  { kind: "light", right: 2.9, fwd: -2.0, clearRadius: 0.35 },
];

const ALL_URLS = [...new Set(BASE_PROPS.map((p) => p.url))];
const noRaycast: THREE.Mesh["raycast"] = () => {};

type Instance = GroupItem & { url: string; clearRadius: number };
type PrimitiveInstance = {
  kind: PrimitiveDef["kind"];
  pos: Vec2;
  rotY: number;
  clearRadius: number;
  length: number;
};

const baseScaleFor = (source: MeshSource, url: string): number => {
  const def = BASE_PROPS.find((p) => p.url === url);
  const target = def?.targetHeight ?? 0.8;
  return target / Math.max(source.height, 0.001);
};

const HQBasePad = ({ position, yaw }: { position: [number, number]; yaw: number }) => (
  <group position={[position[0], 0, -position[1]]} rotation={[0, yaw, 0]}>
    <mesh position={[0, 0.014, -0.1]} raycast={noRaycast}>
      <boxGeometry args={[6.7, 0.035, 5.0]} />
      <meshStandardMaterial
        color="#303643"
        roughness={0.82}
        metalness={0.18}
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </mesh>
    <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
      <ringGeometry args={[1.05, 1.32, 40]} />
      <meshBasicMaterial color="#8fb7d1" transparent opacity={0.24} />
    </mesh>
    <mesh position={[0, 0.041, 1.72]} raycast={noRaycast}>
      <boxGeometry args={[1.9, 0.012, 0.12]} />
      <meshBasicMaterial color="#f5c84b" transparent opacity={0.55} depthWrite={false} />
    </mesh>
    <mesh position={[-2.15, 0.041, -1.75]} raycast={noRaycast}>
      <boxGeometry args={[1.35, 0.012, 0.12]} />
      <meshBasicMaterial color="#86d8ff" transparent opacity={0.34} depthWrite={false} />
    </mesh>
    <mesh position={[2.15, 0.041, -1.75]} raycast={noRaycast}>
      <boxGeometry args={[1.35, 0.012, 0.12]} />
      <meshBasicMaterial color="#86d8ff" transparent opacity={0.34} depthWrite={false} />
    </mesh>
  </group>
);

const BasePrimitive = ({ item }: { item: PrimitiveInstance }) => {
  if (item.kind === "light") {
    return (
      <group position={[item.pos.x, 0, -item.pos.y]} rotation={[0, item.rotY, 0]}>
        <mesh position={[0, 0.26, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.035, 0.045, 0.52, 8]} />
          <meshStandardMaterial color="#242b34" roughness={0.78} metalness={0.28} />
        </mesh>
        <mesh position={[0, 0.57, 0]} raycast={noRaycast}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial
            color="#bdf4ff"
            emissive="#5eeaff"
            emissiveIntensity={1.4}
            roughness={0.25}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[item.pos.x, 0, -item.pos.y]} rotation={[0, item.rotY, 0]}>
      <mesh position={[0, 0.28, 0]} raycast={noRaycast}>
        <boxGeometry args={[item.length, 0.08, 0.08]} />
        <meshStandardMaterial color="#3f4752" roughness={0.72} metalness={0.18} />
      </mesh>
      <mesh position={[-item.length / 2, 0.22, 0]} raycast={noRaycast}>
        <boxGeometry args={[0.08, 0.44, 0.08]} />
        <meshStandardMaterial color="#2a313a" roughness={0.75} metalness={0.2} />
      </mesh>
      <mesh position={[item.length / 2, 0.22, 0]} raycast={noRaycast}>
        <boxGeometry args={[0.08, 0.44, 0.08]} />
        <meshStandardMaterial color="#2a313a" roughness={0.75} metalness={0.2} />
      </mesh>
    </group>
  );
};

export const HQBase = () => {
  const paths = useGame((s) => s.world.paths);
  const towerVersion = useGame((s) => s.ui.towerVersion);
  const towers = useGame.getState().world.towers;

  const { instances, pads, primitives } = useMemo(() => {
    const insts: Instance[] = [];
    const primitiveList: PrimitiveInstance[] = [];
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
        insts.push({
          url: def.url,
          pos: { x: wx, y: wy },
          scale: 1,
          rotY: propYaw,
          clearRadius: def.clearRadius,
        });
      }

      for (const def of BASE_PRIMITIVES) {
        const wx = last.x + def.right * rightX + def.fwd * faceX;
        const wy = last.y + def.right * rightY + def.fwd * faceY;
        primitiveList.push({
          kind: def.kind,
          pos: { x: wx, y: wy },
          rotY: yaw + (def.yawOffset ?? 0),
          clearRadius: def.clearRadius,
          length: def.length ?? 1,
        });
      }
    }
    return { instances: insts, pads: padList, primitives: primitiveList };
  }, [paths]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: towerVersion is the intended invalidation key
  const visible = useMemo(() => {
    if (towers.length === 0) return { instances, primitives };
    const towerR = TOWER_FOOTPRINT * 0.5;
    const clear = <T extends { pos: Vec2; clearRadius: number }>(item: T) => {
      for (const tower of towers) {
        const dx = tower.pos.x - item.pos.x;
        const dy = tower.pos.y - item.pos.y;
        const lim = towerR + item.clearRadius;
        if (dx * dx + dy * dy < lim * lim) return false;
      }
      return true;
    };
    return {
      instances: instances.filter(clear),
      primitives: primitives.filter(clear),
    };
  }, [instances, primitives, towers, towerVersion]);

  const grouped = useMemo(() => {
    const map = new Map<string, Instance[]>();
    for (const inst of visible.instances) {
      let arr = map.get(inst.url);
      if (!arr) {
        arr = [];
        map.set(inst.url, arr);
      }
      arr.push(inst);
    }
    return map;
  }, [visible.instances]);

  return (
    <>
      {pads.map((pad, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable per level
        <HQBasePad key={i} position={pad.position} yaw={pad.yaw} />
      ))}
      {visible.primitives.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: deterministic base layout
        <BasePrimitive key={i} item={item} />
      ))}
      {[...grouped.entries()].map(([url, items]) => (
        <InstancedGroup
          key={url}
          url={url}
          items={items}
          baseScaleFor={baseScaleFor}
          raycast={noRaycast}
        />
      ))}
    </>
  );
};

for (const url of ALL_URLS) useGLTF.preload(url);
