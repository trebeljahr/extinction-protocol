import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_REGEN = 128;
// Floating mint-green "+" badge above any enemy with the regen chip.
// Distinct from:
//   - shielded blue bubble (around the body)
//   - healAura green ring   (on the ground)
//   - fierce red halo       (around the body)
//   - elite material tint   (on the body itself)
//
// Hides when regen is paused (just took damage) so the badge tracks the
// actual healing state — players see the icon "go dark" right after a
// hit and "come back" once regen resumes.

const TEX_SIZE = 64;

const buildPlusTexture = () => {
  const c = document.createElement("canvas");
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Soft outer halo so the "+" reads against busy biome textures.
  const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, "rgba(126,255,138,0.35)");
  grd.addColorStop(1, "rgba(126,255,138,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Solid plus glyph on top.
  ctx.fillStyle = "#bbffc8";
  ctx.strokeStyle = "#2da64a";
  ctx.lineWidth = 3;
  // Horizontal bar
  ctx.fillRect(14, 28, 36, 8);
  ctx.strokeRect(14, 28, 36, 8);
  // Vertical bar
  ctx.fillRect(28, 14, 8, 36);
  ctx.strokeRect(28, 14, 8, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

export const RegenBadges = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tex = useMemo(buildPlusTexture, []);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();
    const time = world.time;

    // Camera-facing yaw — recompute once per frame, share across all
    // instances. Cheaper than per-instance billboarding math.
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const yaw = Math.atan2(-camDir.x, -camDir.z);

    let hi = 0;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (!e.regen) continue;
      if (hi >= MAX_REGEN) break;
      // Hide while regen is paused — the icon disappearing right after
      // a hit is itself the "you're getting damage through" feedback.
      if (time < e.regenPausedUntil) continue;
      // Bobs above the head; height tracks silhouette via sqrt(maxHp).
      const height = 1.7 + Math.sqrt(e.maxHp) * 0.045;
      const bob = Math.sin(time * 2.6 + e.id) * 0.08;
      // Heartbeat scale pulse so the icon feels actively healing.
      const pulse = 0.65 + 0.12 * Math.sin(time * 4 + e.id);
      dummy.position.set(e.pos.x, height + bob, -e.pos.y);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(pulse, pulse, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(hi, dummy.matrix);
      hi++;
    }
    mesh.count = hi;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_REGEN]} renderOrder={6}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
