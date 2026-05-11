import { nanoid } from "nanoid";
import * as THREE from "three";

// Collect every primitive under a glTF scene so multi-primitive meshes
// (Quaternius snow trees: trunk + cap, sci-fi rocks: body + crystal,
// Kenney space-kit chassis + lights) render in full when instanced.
// GLTFLoader flattens multi-primitive nodes into multiple THREE.Mesh
// children — instancing only the first one drops the secondary parts.
//
// Caller decides how to use this:
//   - Renderers that match an authored size (Trees.tsx, Rocks.tsx,
//     Ground.tsx, the non-cosmetic branch of OuterScenery): render
//     each part at raw GLTF scale × instance scale.
//   - Renderers that normalize to TARGET_SIZE_BY_ROLE (BiomeCosmetics,
//     OuterScenery's cosmetic branch): compute `target / source.maxDim`
//     and multiply into the per-instance scale.

export type MeshPart = {
  id: string;
  geom: THREE.BufferGeometry;
  material: THREE.Material;
};

export type MeshSource = {
  parts: MeshPart[];
  // Union AABB of every primitive's bounding box, in scene-local space.
  boundingBox: THREE.Box3;
  // Convenience: smallest Y across the union — used to plant a glTF on
  // the ground regardless of its authored origin.
  minY: number;
  // Largest axis-aligned dimension across the union — input for
  // TARGET_SIZE_BY_ROLE normalization.
  maxDim: number;
};

export const collectMeshSource = (scene: THREE.Object3D): MeshSource | null => {
  scene.updateMatrixWorld(true);
  const parts: MeshPart[] = [];
  const union = new THREE.Box3();
  let unionSet = false;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      geom.computeBoundingBox();
      if (geom.boundingBox) {
        if (!unionSet) {
          union.copy(geom.boundingBox);
          unionSet = true;
        } else union.union(geom.boundingBox);
      }
      parts.push({ id: nanoid(), geom, material: mat as THREE.Material });
    }
  });
  if (parts.length === 0 || !unionSet) return null;
  const size = union.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  return { parts, boundingBox: union, minY: union.min.y, maxDim };
};
