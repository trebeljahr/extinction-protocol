import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { useGame } from "../store";
import type { EnemyKind } from "../sim/types";

type Props = {
  kind: EnemyKind;
  url: string;
  targetSize: number;
  yOffset?: number;
  baseRotY?: number;
  bob?: boolean;
};

export const ModelEnemyMesh = ({
  kind, url, targetSize, yOffset = 0, baseRotY = 0, bob = false,
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
    scene.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => () => {
    const parent = groupRef.current;
    if (!parent) return;
    for (const [, item] of itemsRef.current) parent.remove(item);
    itemsRef.current.clear();
  }, []);

  useFrame(() => {
    const parent = groupRef.current;
    if (!parent) return;
    const { world } = useGame.getState();

    const live = new Set<number>();
    for (const e of world.enemies) {
      if (e.kind !== kind) continue;
      if (!e.alive) continue;
      live.add(e.id);
      let item = itemsRef.current.get(e.id);
      if (!item) {
        item = scene.clone(true);
        item.scale.setScalar(normalizedScale);
        item.userData.enemyId = e.id;
        item.userData.enemyMaxHp = e.maxHp;
        item.traverse(obj => {
          obj.userData.enemyId = e.id;
          obj.userData.enemyMaxHp = e.maxHp;
        });
        parent.add(item);
        itemsRef.current.set(e.id, item);
      }

      const bobY = bob ? Math.sin(world.time * 3 + e.id) * 0.12 : 0;
      item.position.set(
        e.pos.x - centerXZ.x,
        yOffset - scaledMinY + bobY,
        -e.pos.y - centerXZ.z,
      );

      const path = world.paths[e.pathIndex] ?? world.paths[0];
      const a = path[e.segment];
      const b = path[e.segment + 1] ?? a;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const pathYaw = dx * dx + dy * dy > 1e-6 ? Math.atan2(dx, -dy) : 0;
      item.rotation.set(0, baseRotY + pathYaw, 0);

      const flashing = world.time < e.flashUntil;
      const slowed = world.time < e.slowUntil;
      item.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (mm: THREE.MeshStandardMaterial) => {
          if (!mm.emissive) return;
          if (flashing) mm.emissive.setRGB(1, 1, 1);
          else if (slowed) mm.emissive.setRGB(0.2, 0.4, 0.7);
          else mm.emissive.setRGB(0, 0, 0);
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      });
    }

    for (const [id, item] of itemsRef.current) {
      if (!live.has(id)) {
        parent.remove(item);
        itemsRef.current.delete(id);
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    let obj: THREE.Object3D | null = e.object;
    while (obj && obj.userData.enemyId === undefined) obj = obj.parent;
    if (!obj) return;
    e.stopPropagation();
    useGame.getState().inspectEnemy(
      obj.userData.enemyId as number,
      kind,
      obj.userData.enemyMaxHp as number,
    );
  };

  return <group ref={groupRef} onClick={handleClick} />;
};

useGLTF.preload("/models/raptor.glb");
useGLTF.preload("/models/allosaurus.glb");
useGLTF.preload("/models/stegoknight.glb");
useGLTF.preload("/models/spinosaurobot.glb");
useGLTF.preload("/models/flyer.glb");
