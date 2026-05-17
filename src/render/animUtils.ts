import type * as THREE from "three";

// Shared GLTF / animation helpers used by every skinned-mesh consumer
// (ModelEnemyMesh, ModelRobotMesh, HQTurret, MechanicPreview, EnemyPreview,
// EasterEggs). Behavior must stay bit-identical to the original copies
// since visual regressions here propagate everywhere.

// Clone a material and stash the original color + emissive on userData
// so per-frame tint/flash effects can lerp back to the pristine value
// after a hit reaction. Capturing both is cheap (one Color clone each)
// and lets every renderer share the same proxy material.
export const cloneAndCaptureBase = (mat: THREE.Material): THREE.Material => {
  const c = mat.clone();
  const std = c as THREE.MeshStandardMaterial;
  if (std.color) std.userData.baseColor = std.color.clone();
  if (std.emissive) std.userData.baseEmissive = std.emissive.clone();
  return c;
};

// Resolve a clip by name(s). Tries exact (case-insensitive) match across
// all candidates first, then falls back to substring match in the same
// order. Accepts a single needle or an ordered list of fallbacks; an
// undefined needle returns null (used by easter-egg defs that omit a
// clip name).
export const findClip = (
  clips: THREE.AnimationClip[],
  needle: string | string[] | undefined,
): THREE.AnimationClip | null => {
  if (!needle) return null;
  const list = (Array.isArray(needle) ? needle : [needle]).filter(Boolean);
  for (const n of list) {
    const hit = clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (hit) return hit;
  }
  for (const n of list) {
    const hit = clips.find((c) => c.name.toLowerCase().includes(n.toLowerCase()));
    if (hit) return hit;
  }
  return null;
};
