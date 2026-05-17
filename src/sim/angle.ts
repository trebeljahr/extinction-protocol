// Smoothing & angle helpers shared by sim/robot.ts and the render layer
// (ModelEnemyMesh, ModelRobotMesh, HQTurret). dampFactor maps a frame
// dt + half-life pair to a 0..1 blend coefficient suitable for
// `x += (target - x) * k` exp-damp smoothing. shortAngleDelta returns
// the signed shortest rotation from `from` to `to` so yaw smoothing
// doesn't cross the ±π seam.

export const dampFactor = (dt: number, halflife: number) => 1 - 0.5 ** (dt / halflife);

export const shortAngleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
