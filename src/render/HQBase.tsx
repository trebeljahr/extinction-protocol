import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PATH_WIDTH } from "../level";
import { mulberry32 } from "../sim/random";
import type { Vec2 } from "../sim/types";
import { distToSegmentSq } from "../sim/vec2";
import { TOWER_FOOTPRINT } from "../sim/world";
import { useGame } from "../store";
import { DEAD_DINO_SPECS, DeadDinoInstancer, type DeadDinoItem } from "./DeadDinos";
import { type GroupItem, InstancedGroup } from "./InstancedGroup";
import type { MeshSource } from "./meshSource";

// Decorative sci-fi props placed around each HQ endpoint so the plasma
// turret reads as the centrepiece of a small research compound rather
// than a lone gun in a field. Render-only: they are culled around towers
// and the path corridor, and never participate in placement blocking.
//
// Layout convention: `fwd > 0` is along the approach corridor (where
// dinos walk). Anything with positive `fwd` must keep |right| greater
// than PATH_WIDTH/2 + its clearRadius + margin, otherwise enemies will
// path through or visibly clip into it. A path-cull pass below is the
// belt-and-braces check so curved approaches don't sneak past.

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

// Approach corridor sits at |right| <= PATH_WIDTH/2 = 1.4. For any
// prop with fwd > 0 (approach side) we need |right| >= 1.4 + clearRadius
// + small margin so dinos cleanly path past.
const BASE_PROPS: PropDef[] = [
  {
    url: "/models/scifi/hangar_smallA.glb",
    right: -1.55,
    fwd: -1.75,
    targetHeight: 1.08,
    clearRadius: 1.05,
    facesHQ: true,
  },
  {
    url: "/models/scifi/structure_detailed.glb",
    right: 1.55,
    fwd: -1.75,
    targetHeight: 1.18,
    clearRadius: 0.95,
    facesHQ: true,
  },
  {
    url: "/models/scifi/structure_closed.glb",
    right: -2.85,
    fwd: -0.35,
    targetHeight: 0.95,
    clearRadius: 0.85,
    facesHQ: true,
  },
  {
    url: "/models/scifi/gate_simple.glb",
    right: 0,
    fwd: -2.65,
    targetHeight: 0.78,
    clearRadius: 0.7,
    facesHQ: true,
  },
  {
    // Tucked inside the left fence (left fence sits at right = -3.25); the
    // dish's clearRadius (~0.8) used to extend its silhouette to -3.75,
    // poking the antenna visibly past the perimeter posts.
    url: "/models/scifi/satelliteDish_detailed.glb",
    right: -2.4,
    fwd: -1.65,
    targetHeight: 1.18,
    clearRadius: 0.8,
    facesHQ: true,
  },
  {
    url: "/models/scifi/machine_generatorLarge.glb",
    right: 2.85,
    fwd: -0.35,
    targetHeight: 1.0,
    clearRadius: 0.85,
  },
  {
    url: "/models/scifi/machine_wirelessCable.glb",
    right: -1.1,
    fwd: -2.55,
    targetHeight: 0.72,
    clearRadius: 0.6,
  },
  {
    url: "/models/scifi/machine_barrelLarge.glb",
    right: 2.55,
    fwd: -2.45,
    targetHeight: 0.62,
    clearRadius: 0.55,
  },
];

// Perimeter fence: 3 sides closed (back + left + right), front open where the
// approach path connects. Segment endpoints land under each corner torch so
// posts and lights align.
const BASE_PRIMITIVES: PrimitiveDef[] = [
  // Back row — full pad width at fwd = -2.5.
  { kind: "fence", right: -2.6, fwd: -2.5, length: 1.3, clearRadius: 0.6 },
  { kind: "fence", right: -1.3, fwd: -2.5, length: 1.3, clearRadius: 0.6 },
  { kind: "fence", right: 0, fwd: -2.5, length: 1.3, clearRadius: 0.6 },
  { kind: "fence", right: 1.3, fwd: -2.5, length: 1.3, clearRadius: 0.6 },
  { kind: "fence", right: 2.6, fwd: -2.5, length: 1.3, clearRadius: 0.6 },
  // Left side — runs from back torch to front torch along fwd-axis.
  {
    kind: "fence",
    right: -3.25,
    fwd: -1.75,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  {
    kind: "fence",
    right: -3.25,
    fwd: -0.25,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  {
    kind: "fence",
    right: -3.25,
    fwd: 1.25,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  // Right side — mirror of the left.
  {
    kind: "fence",
    right: 3.25,
    fwd: -1.75,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  {
    kind: "fence",
    right: 3.25,
    fwd: -0.25,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  {
    kind: "fence",
    right: 3.25,
    fwd: 1.25,
    length: 1.5,
    yawOffset: Math.PI / 2,
    clearRadius: 0.6,
  },
  // Torches at the four perimeter corners.
  { kind: "light", right: -3.25, fwd: -2.5, clearRadius: 0.4 },
  { kind: "light", right: 3.25, fwd: -2.5, clearRadius: 0.4 },
  { kind: "light", right: -3.25, fwd: 2.0, clearRadius: 0.4 },
  { kind: "light", right: 3.25, fwd: 2.0, clearRadius: 0.4 },
];

// Authored dead-dinosaur corpse slots ringing each HQ pad — pad-local
// (right, fwd) like BASE_PROPS. Picked to sit OUTSIDE the fence perimeter
// (sides at ±4.4, back beyond fwd ≈ -3.6, front beyond fwd ≈ 3.4) so the
// corpse silhouettes never clip into fences, buildings, or the pad rim.
// Per-HQ RNG draws from this pool with a runtime collision check that
// rejects any slot overlapping a path, building prop, pad rect, or
// previously-placed corpse — so two neighbouring corpses can't stack
// poses and a curved approach can't shave a carcass with the walking lane.
const HQ_CORPSE_SLOTS: { right: number; fwd: number }[] = [
  { right: -4.4, fwd: -0.5 },
  { right: 4.4, fwd: -0.5 },
  { right: -4.4, fwd: 1.6 },
  { right: 4.4, fwd: 1.6 },
  { right: -4.4, fwd: -2.2 },
  { right: 4.4, fwd: -2.2 },
  { right: -3.4, fwd: 3.6 },
  { right: 3.4, fwd: 3.6 },
  { right: 0, fwd: -4.2 },
  { right: -2.6, fwd: -3.8 },
  { right: 2.6, fwd: -3.8 },
];

// Corpses normalize to their species footprint (3.6–4.6 world units) which
// is way too large for the ground around the fence box — scale down so a
// Trex carcass sits at ~1.7 units long. Tighter than the old 0.42–0.56
// range so the slots farther out from the fence still feel anchored to
// the HQ vignette rather than dropped in open field.
const HQ_CORPSE_SCALE_MIN = 0.32;
const HQ_CORPSE_SCALE_MAX = 0.4;

// Pad rectangle (HQBasePad mesh: 6.7×5.0 box at local (0, -0.1)).
// Slot-vs-pad rejection uses pad-local distance from the slot to the rect
// edge, so a corpse footprint can never poke into the HQ pad itself.
const HQ_PAD_HALF_RIGHT = 3.35;
const HQ_PAD_HALF_FWD = 2.5;
const HQ_PAD_FWD_CENTER = -0.1;

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

// Shared geometries/materials for the instanced fences + lights. Built
// once at module load — every HQ pad reuses the same buffers so the
// whole base-decoration layer collapses to five draw calls regardless
// of how many paths the level has.
const PRIMITIVE_GEOMS = {
  fenceBar: new THREE.BoxGeometry(1, 0.08, 0.08),
  fencePost: new THREE.BoxGeometry(0.08, 0.44, 0.08),
  lightPole: new THREE.CylinderGeometry(0.035, 0.045, 0.52, 8),
  lightBall: new THREE.SphereGeometry(0.09, 10, 8),
};
const PRIMITIVE_MATS = {
  fenceBar: new THREE.MeshStandardMaterial({ color: "#3f4752", roughness: 0.72, metalness: 0.18 }),
  fencePost: new THREE.MeshStandardMaterial({ color: "#2a313a", roughness: 0.75, metalness: 0.2 }),
  lightPole: new THREE.MeshStandardMaterial({ color: "#242b34", roughness: 0.78, metalness: 0.28 }),
  lightBall: new THREE.MeshStandardMaterial({
    color: "#bdf4ff",
    emissive: "#5eeaff",
    emissiveIntensity: 1.4,
    roughness: 0.25,
  }),
};

type InstancedPart = {
  geom: THREE.BufferGeometry;
  mat: THREE.Material;
  // Local offset (in the primitive's own frame) before applying the
  // primitive's world position + rotY.
  localPos: [number, number, number];
  // x scale comes from the fence length; everything else stays at 1.
  scaleFromLength?: boolean;
};

const buildMatrix = (
  it: PrimitiveInstance,
  part: InstancedPart,
  dummy: THREE.Object3D,
): THREE.Matrix4 => {
  const cos = Math.cos(it.rotY);
  const sin = Math.sin(it.rotY);
  const [lx, ly, lz] = part.localPos;
  // RotateY(rotY) applied to local offset:
  //   wx =  lx * cos + lz * sin
  //   wz = -lx * sin + lz * cos
  const wx = lx * cos + lz * sin;
  const wz = -lx * sin + lz * cos;
  dummy.position.set(it.pos.x + wx, ly, -it.pos.y + wz);
  dummy.rotation.set(0, it.rotY, 0);
  const sx = part.scaleFromLength ? it.length : 1;
  dummy.scale.set(sx, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
};

const InstancedPrimitiveMesh = ({
  items,
  part,
}: {
  items: PrimitiveInstance[];
  part: InstancedPart;
}) => {
  const ref = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < items.length; i++) {
      ref.current.setMatrixAt(i, buildMatrix(items[i], part, dummy));
    }
    ref.current.count = items.length;
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, part]);

  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[part.geom, part.mat, items.length]}
      raycast={noRaycast}
      castShadow
      receiveShadow
    />
  );
};

const BasePrimitives = ({ items }: { items: PrimitiveInstance[] }) => {
  const fences = useMemo(() => items.filter((it) => it.kind === "fence"), [items]);
  const lights = useMemo(() => items.filter((it) => it.kind === "light"), [items]);

  return (
    <>
      <InstancedPrimitiveMesh
        items={fences}
        part={{
          geom: PRIMITIVE_GEOMS.fenceBar,
          mat: PRIMITIVE_MATS.fenceBar,
          localPos: [0, 0.28, 0],
          scaleFromLength: true,
        }}
      />
      <FencePostsOffset items={fences} sign={-1} />
      <FencePostsOffset items={fences} sign={1} />
      <InstancedPrimitiveMesh
        items={lights}
        part={{
          geom: PRIMITIVE_GEOMS.lightPole,
          mat: PRIMITIVE_MATS.lightPole,
          localPos: [0, 0.26, 0],
        }}
      />
      <InstancedPrimitiveMesh
        items={lights}
        part={{
          geom: PRIMITIVE_GEOMS.lightBall,
          mat: PRIMITIVE_MATS.lightBall,
          localPos: [0, 0.57, 0],
        }}
      />
    </>
  );
};

// Fence posts need a per-instance offset along the bar (±length/2). The
// localPos in InstancedPart is fixed, so we add a thin wrapper that
// shifts the localPos per render — both posts share the same geometry
// and material, only the offset sign differs.
const FencePostsOffset = ({ items, sign }: { items: PrimitiveInstance[]; sign: 1 | -1 }) => {
  const ref = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cos = Math.cos(it.rotY);
      const sin = Math.sin(it.rotY);
      const lx = (sign * it.length) / 2;
      const wx = lx * cos;
      const wz = -lx * sin;
      dummy.position.set(it.pos.x + wx, 0.22, -it.pos.y + wz);
      dummy.rotation.set(0, it.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.count = items.length;
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, sign]);

  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[PRIMITIVE_GEOMS.fencePost, PRIMITIVE_MATS.fencePost, items.length]}
      raycast={noRaycast}
      castShadow
      receiveShadow
    />
  );
};

export const HQBase = () => {
  const paths = useGame((s) => s.world.paths);
  const levelId = useGame((s) => s.world.levelId);
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
    const towerR = TOWER_FOOTPRINT * 0.5;
    const pathHalf = PATH_WIDTH * 0.5;
    const clear = <T extends { pos: Vec2; clearRadius: number }>(item: T) => {
      for (const tower of towers) {
        const dx = tower.pos.x - item.pos.x;
        const dy = tower.pos.y - item.pos.y;
        const lim = towerR + item.clearRadius;
        if (dx * dx + dy * dy < lim * lim) return false;
      }
      const pathLim = pathHalf + item.clearRadius;
      const pathLimSq = pathLim * pathLim;
      for (const path of paths) {
        for (let i = 0; i < path.length - 1; i++) {
          if (distToSegmentSq(item.pos, path[i], path[i + 1]) < pathLimSq) return false;
        }
      }
      return true;
    };
    return {
      instances: instances.filter(clear),
      primitives: primitives.filter(clear),
    };
  }, [instances, primitives, towers, paths, towerVersion]);

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

  // Per-HQ dead-dinosaur corpses. Deterministic per level so the same node
  // always shows the same aftermath, but per-path RNG so two HQs in the
  // same level get different species and slot subsets. Many levels get
  // zero corpses (clean base) — the player should still occasionally see
  // a base scrubbed and intact. Slots are filtered at runtime so a corpse
  // never overlaps a path, building, pad rim, or another corpse.
  const corpseGroups = useMemo(() => {
    const pathHalf = PATH_WIDTH * 0.5;
    // Building clearRadius is conservative for gameplay placement; for
    // visual corpse-vs-prop checks, shrink it so the carcass can sit
    // believably close without false rejects on every slot.
    const propVisualScale = 0.7;
    const byUrl = new Map<string, DeadDinoItem[]>();

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
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

      const rng = mulberry32(levelId * 17207 + pathIndex * 1297 + 53);
      // 45% no corpses, 35% two, 20% three. Skews toward the cleaner
      // visual most of the time; the mayhem reads strongest when not
      // every base looks the same.
      const roll = rng();
      const wanted = roll < 0.45 ? 0 : roll < 0.8 ? 2 : 3;
      if (wanted === 0) continue;

      // Fisher–Yates the slot pool so picks are distinct.
      const slotOrder = HQ_CORPSE_SLOTS.map((_, i) => i);
      for (let i = slotOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slotOrder[i], slotOrder[j]] = [slotOrder[j], slotOrder[i]];
      }
      const speciesOrder = DEAD_DINO_SPECS.map((_, i) => i);
      for (let i = speciesOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [speciesOrder[i], speciesOrder[j]] = [speciesOrder[j], speciesOrder[i]];
      }

      const placedHere: { x: number; y: number; r: number }[] = [];
      let placedCount = 0;
      for (let si = 0; si < slotOrder.length && placedCount < wanted; si++) {
        const slot = HQ_CORPSE_SLOTS[slotOrder[si]];
        const spec = DEAD_DINO_SPECS[speciesOrder[placedCount % DEAD_DINO_SPECS.length]];
        const scale = HQ_CORPSE_SCALE_MIN + rng() * (HQ_CORPSE_SCALE_MAX - HQ_CORPSE_SCALE_MIN);
        const rotY = rng() * Math.PI * 2;
        const corpseR = spec.footprint * scale * 0.5;
        const wx = last.x + slot.right * rightX + slot.fwd * faceX;
        const wy = last.y + slot.right * rightY + slot.fwd * faceY;
        const here: Vec2 = { x: wx, y: wy };

        // Pad rect (pad-local). Slot is already in pad-local coords, so
        // reject if the corpse circle reaches inside the rect.
        const padDx = Math.max(0, Math.abs(slot.right) - HQ_PAD_HALF_RIGHT);
        const padDy = Math.max(0, Math.abs(slot.fwd - HQ_PAD_FWD_CENTER) - HQ_PAD_HALF_FWD);
        if (padDx * padDx + padDy * padDy < corpseR * corpseR) continue;

        // Walking corridor — any path on the map.
        let blocked = false;
        const pathLim = corpseR + pathHalf + 0.05;
        const pathLimSq = pathLim * pathLim;
        for (const p of paths) {
          for (let i = 0; i < p.length - 1; i++) {
            if (distToSegmentSq(here, p[i], p[i + 1]) < pathLimSq) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }
        if (blocked) continue;

        // Base building props. Fence/light primitives are thin enough
        // visually that we don't bother checking them — slots are
        // authored well clear of the fence ring.
        for (const inst of instances) {
          const ix = inst.pos.x - wx;
          const iy = inst.pos.y - wy;
          const lim = corpseR + inst.clearRadius * propVisualScale;
          if (ix * ix + iy * iy < lim * lim) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        // Other corpses on the same HQ — primary fix for the "stacked
        // poses" bug. 0.2u extra slack so silhouettes don't kiss.
        for (const c of placedHere) {
          const cx = c.x - wx;
          const cy = c.y - wy;
          const lim = corpseR + c.r + 0.2;
          if (cx * cx + cy * cy < lim * lim) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        placedHere.push({ x: wx, y: wy, r: corpseR });
        const item: DeadDinoItem = {
          id: `hq-${levelId}-${pathIndex}-${si}-${spec.url}`,
          pos: new THREE.Vector3(wx, 0, -wy),
          rotY,
          scale,
        };
        const list = byUrl.get(spec.url) ?? [];
        list.push(item);
        byUrl.set(spec.url, list);
        placedCount++;
      }
    }
    return Array.from(byUrl.entries());
  }, [paths, levelId, instances]);

  return (
    <>
      {pads.map((pad, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable per level
        <HQBasePad key={i} position={pad.position} yaw={pad.yaw} />
      ))}
      <BasePrimitives items={visible.primitives} />
      {[...grouped.entries()].map(([url, items]) => (
        <InstancedGroup
          key={url}
          url={url}
          items={items}
          baseScaleFor={baseScaleFor}
          raycast={noRaycast}
        />
      ))}
      {corpseGroups.map(([url, items]) => (
        <DeadDinoInstancer key={url} url={url} items={items} />
      ))}
    </>
  );
};

for (const url of ALL_URLS) useGLTF.preload(url);
