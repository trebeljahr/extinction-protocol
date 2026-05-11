import * as THREE from "three";

// World-axis-aligned bbox of an Object3D's *visible* mesh surface.
//
// Why not just `Box3.setFromObject(root)`? The default (non-precise) path
// reads each Mesh's cached `geometry.boundingBox`, which for a SkinnedMesh
// reflects the raw position attribute *before* the bind matrix is applied.
// On the Kenney dino GLBs (Triceratops in particular) the raw vertices sit
// ~5.6 units lower than where the bind-pose skin actually renders, so
// using `box.min.y` to ground-align lifts the model well above the
// ground while its shadow still anchors at y=0.
//
// `precise=true` walks each mesh's vertices through `getVertexPosition`,
// which for SkinnedMesh applies the current bone transforms — at bind pose
// that resolves to the visible silhouette. We force a recursive
// matrixWorld update first because `setFromObject` only updates the root
// non-recursively, so the bone children of a SkinnedMesh would otherwise
// keep stale matrices and the bone transform inside `getVertexPosition`
// would compute against an out-of-date skeleton.
export const measureVisibleBox = (root: THREE.Object3D): THREE.Box3 => {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, true);
};
