// Per-enemy render-side transform published by ModelEnemyMesh each frame.
// Aura / halo / badge renderers read from here so they track the smoothed,
// bobbed mesh pose instead of jumping to the raw sim position one tick
// ahead. Cleared when a mesh is pooled, despawned, or the world swaps.

export type EnemyRenderTransform = {
  // Smoothed body-center XZ in world space (matches the rendered skeleton's
  // centroid, not the sim `e.pos`).
  x: number;
  z: number;
  // Vertical bob offset applied to the mesh this frame. Decorations add
  // this to their own base height so they ride the same up/down as the
  // model rather than hovering still while the dino bounces.
  bobY: number;
};

const map = new Map<number, EnemyRenderTransform>();

export const setEnemyRender = (id: number, t: EnemyRenderTransform): void => {
  let cur = map.get(id);
  if (!cur) {
    cur = { x: t.x, z: t.z, bobY: t.bobY };
    map.set(id, cur);
    return;
  }
  cur.x = t.x;
  cur.z = t.z;
  cur.bobY = t.bobY;
};

export const getEnemyRender = (id: number): EnemyRenderTransform | undefined => map.get(id);

export const clearEnemyRender = (id: number): void => {
  map.delete(id);
};

export const clearAllEnemyRender = (): void => {
  map.clear();
};
