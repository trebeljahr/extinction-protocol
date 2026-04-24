import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { TowerKind } from "../sim/types";
import { useGame } from "../store";

type Props = {
  kind: TowerKind;
  url: string;
  targetSize: number;
  yOffset?: number;
  baseRotY?: number;
  idleSpin?: boolean;
};

export const ModelTowerMesh = ({
  kind,
  url,
  targetSize,
  yOffset = 0,
  baseRotY = 0,
  idleSpin = false,
}: Props) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const itemsRef = useRef<Map<number, THREE.Object3D>>(new Map());

  const { normalizedScale, centerXZ, scaledMinY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = targetSize / maxDim;
    return {
      normalizedScale: s,
      centerXZ: { x: center.x * s, z: center.z * s },
      scaledMinY: box.min.y * s,
    };
  }, [scene, targetSize]);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(
    () => () => {
      const parent = groupRef.current;
      if (!parent) return;
      for (const [, item] of itemsRef.current) parent.remove(item);
      itemsRef.current.clear();
    },
    [],
  );

  useFrame(() => {
    const parent = groupRef.current;
    if (!parent) return;
    const { world } = useGame.getState();

    const live = new Set<number>();
    for (const t of world.towers) {
      if (t.kind !== kind) continue;
      live.add(t.id);
      let item = itemsRef.current.get(t.id);
      if (!item) {
        item = scene.clone(true);
        item.scale.setScalar(normalizedScale);
        parent.add(item);
        itemsRef.current.set(t.id, item);
      }

      item.position.set(t.pos.x - centerXZ.x, yOffset - scaledMinY, -t.pos.y - centerXZ.z);

      let yaw = 0;
      if (idleSpin) {
        yaw = world.time * 1.2;
      } else if (t.targetingMode === "spot" && t.targetSpot) {
        const dx = t.targetSpot.x - t.pos.x;
        const dy = t.targetSpot.y - t.pos.y;
        yaw = Math.atan2(dx, -dy);
      } else if (t.targetId !== null) {
        const target = world.enemies.find((e) => e.id === t.targetId && e.alive);
        if (target) {
          const dx = target.pos.x - t.pos.x;
          const dy = target.pos.y - t.pos.y;
          yaw = Math.atan2(dx, -dy);
        }
      }
      item.rotation.set(0, baseRotY + yaw, 0);
    }

    for (const [id, item] of itemsRef.current) {
      if (!live.has(id)) {
        parent.remove(item);
        itemsRef.current.delete(id);
      }
    }
  });

  return <group ref={groupRef} />;
};

useGLTF.preload("/models/tower_pulse.glb");
useGLTF.preload("/models/turrets/Lighting Turret.glb");
useGLTF.preload("/models/turrets/Missile Turret.glb");
useGLTF.preload("/models/turrets/Emp Turret.glb");
useGLTF.preload("/models/turrets/Flamethrower Turret.glb");
useGLTF.preload("/models/turrets/Hive Turret.glb");
useGLTF.preload("/models/turrets/Drone.glb");
