import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import {
  HIVE_DRONE_COUNT,
  HIVE_ORBIT_HEIGHT,
  hiveDroneAngle,
  hiveDronePosition,
} from "../sim/towers";

// One instanced mesh renders every drone of every hive tower on the
// field. Each drone bobs a little, orbits the hive, and yaws toward
// whichever enemy it's firing at. Sim-side logic in towers.ts already
// owns target selection + firing — this is purely visuals.
//
// The drone mesh has multiple sub-primitives (Quaternius Enemy Flying),
// so we walk the GLB and stand up a separate InstancedMesh per primitive,
// same pattern as Rocks/Trees/BiomeCosmetics.

const DRONE_URL = "/models/turrets/Drone.glb";
const TARGET_SIZE = 0.95;
const BOB_AMP = 0.08;
const BOB_SPEED = 2.2;
const MAX_DRONES = 256;

type Part = { geom: THREE.BufferGeometry; material: THREE.Material };
type Source = { parts: Part[]; minY: number; baseScale: number };

const collectSource = (scene: THREE.Object3D): Source | null => {
  scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const union = new THREE.Box3();
  let set = false;
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach(mat => {
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      geom.computeBoundingBox();
      if (geom.boundingBox) {
        if (!set) { union.copy(geom.boundingBox); set = true; }
        else union.union(geom.boundingBox);
      }
      parts.push({ geom, material: mat as THREE.Material });
    });
  });
  if (parts.length === 0 || !set) return null;
  const size = union.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  return { parts, minY: union.min.y, baseScale: TARGET_SIZE / maxDim };
};

export const HiveDrones = () => {
  const { scene } = useGLTF(DRONE_URL);
  const source = useMemo(() => collectSource(scene), [scene]);
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!source) return;
    const { world } = useGame.getState();
    const time = world.time;

    let count = 0;
    for (const t of world.towers) {
      if (t.kind !== "hive") continue;
      if (count + HIVE_DRONE_COUNT > MAX_DRONES) break;

      for (let d = 0; d < HIVE_DRONE_COUNT; d++) {
        const pos = hiveDronePosition(t, time, d);
        const angle = hiveDroneAngle(t, time, d);
        // Find a live target the sim would have locked — cheap, one pass,
        // same radius as sim findTargetNearPos. Drones yaw toward it.
        let yaw = angle + Math.PI / 2; // tangent to orbit — idle heading
        let bestD2 = t.range * t.range;
        for (const e of world.enemies) {
          if (!e.alive) continue;
          const dx = e.pos.x - pos.x;
          const dy = e.pos.y - pos.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > bestD2) continue;
          bestD2 = d2;
          yaw = Math.atan2(dx, -dy);
        }

        const bob = Math.sin(time * BOB_SPEED + t.id + d * 1.3) * BOB_AMP;
        dummy.position.set(pos.x, HIVE_ORBIT_HEIGHT + bob, -pos.y);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(source.baseScale);
        dummy.updateMatrix();

        for (const im of partRefs.current) {
          if (!im) continue;
          im.setMatrixAt(count, dummy.matrix);
        }
        count++;
      }
    }

    for (const im of partRefs.current) {
      if (!im) continue;
      im.count = count;
      im.instanceMatrix.needsUpdate = true;
    }
  });

  if (!source) return null;

  return (
    <group>
      {source.parts.map((part, pi) => (
        <instancedMesh
          key={pi}
          ref={(el: THREE.InstancedMesh | null) => { partRefs.current[pi] = el; }}
          args={[part.geom, part.material, MAX_DRONES]}
          castShadow
        />
      ))}
    </group>
  );
};

useGLTF.preload(DRONE_URL);
