import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { TowerKind } from "../sim/types";

// Matches the kinds + sizes Scene.tsx / ModelTowerMesh renders — keep in sync.
const TOWER_MODEL: Record<TowerKind, { url: string; targetSize: number }> = {
  pulse: { url: "/models/tower_pulse.glb", targetSize: 1.6 },
  chain: { url: "/models/turrets/Lighting Turret.glb", targetSize: 1.8 },
  mortar: { url: "/models/turrets/Missile Turret.glb", targetSize: 1.8 },
  cryo: { url: "/models/turrets/Emp Turret.glb", targetSize: 1.8 },
  flame: { url: "/models/turrets/Flamethrower Turret.glb", targetSize: 1.7 },
  hive: { url: "/models/turrets/Hive Turret.glb", targetSize: 1.8 },
};

type Vec2 = { x: number; y: number };

export const GhostTower = ({ kind, pos, ok }: { kind: TowerKind; pos: Vec2; ok: boolean }) => {
  const { url, targetSize } = TOWER_MODEL[kind];
  const { scene } = useGLTF(url);

  const { cloned, material, normalizedScale, centerXZ, scaledMinY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = targetSize / maxDim;

    const mat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.45,
      emissiveIntensity: 0.6,
      roughness: 0.5,
      metalness: 0.0,
      depthWrite: false,
    });

    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = mat;
      m.castShadow = false;
      m.receiveShadow = false;
    });

    return {
      cloned: c,
      material: mat,
      normalizedScale: s,
      centerXZ: { x: center.x * s, z: center.z * s },
      scaledMinY: box.min.y * s,
    };
  }, [scene, targetSize]);

  useEffect(() => {
    const c = new THREE.Color(ok ? "#3dff8a" : "#ff5a7a");
    material.color.copy(c);
    material.emissive.copy(c);
    material.needsUpdate = true;
  }, [material, ok]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <primitive
      object={cloned}
      scale={normalizedScale}
      position={[pos.x - centerXZ.x, -scaledMinY, -pos.y - centerXZ.z]}
    />
  );
};

for (const m of Object.values(TOWER_MODEL)) useGLTF.preload(m.url);
