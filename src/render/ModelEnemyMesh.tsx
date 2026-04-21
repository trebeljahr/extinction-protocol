import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import type { EnemyKind } from "../sim/types";

type Props = {
  kind: EnemyKind;
  url: string;
  targetSize: number;
  yOffset?: number;
  baseRotX?: number;
  baseRotY?: number;
  baseRotZ?: number;
};

export const ModelEnemyMesh = ({
  kind, url, targetSize, yOffset = 0.4, baseRotX = 0, baseRotY = 0, baseRotZ = 0,
}: Props) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const itemsRef = useRef<Map<number, THREE.Object3D>>(new Map());

  const normalizedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    return targetSize / maxDim;
  }, [scene, targetSize]);

  const centerOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    return center;
  }, [scene]);

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
      live.add(e.id);
      let item = itemsRef.current.get(e.id);
      if (!item) {
        item = scene.clone(true);
        item.scale.setScalar(normalizedScale);
        parent.add(item);
        itemsRef.current.set(e.id, item);
      }

      const cx = centerOffset.x * normalizedScale;
      const cy = centerOffset.y * normalizedScale;
      const cz = centerOffset.z * normalizedScale;
      item.position.set(e.pos.x - cx, yOffset - cy, -e.pos.y - cz);

      const spinSpeed = kind === "swarm" ? 4 : 0.6;
      item.rotation.set(baseRotX, baseRotY + world.time * spinSpeed + e.id, baseRotZ);

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

  return <group ref={groupRef} />;
};

useGLTF.preload("/models/walker.glb");
useGLTF.preload("/models/flyer.glb");
