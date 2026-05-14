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

const TEX_SIZE = 128;

// Exported so MechanicPreview (compendium "Mechanics" tab) can mount
// the exact same texture above its preview dinosaur. When this builder
// is retuned, both the live in-game badge and the compendium preview
// update together — no second source of truth to drift from.
export const buildPlusTexture = () => {
  const c = document.createElement("canvas");
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  const cx = TEX_SIZE / 2;
  const cy = TEX_SIZE / 2;
  const armLen = 36;
  const armHalf = 8;

  // Soft outer halo so the "+" reads against busy biome textures.
  // Brighter, multi-stop gradient so the bloom pass picks it up.
  const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 58);
  halo.addColorStop(0.0, "rgba(225,255,232,0.95)");
  halo.addColorStop(0.28, "rgba(150,255,170,0.55)");
  halo.addColorStop(0.6, "rgba(96,230,128,0.22)");
  halo.addColorStop(1.0, "rgba(80,220,120,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Build the "+" as a single 12-vertex closed path. Two overlapping
  // rectangles produced strokes that crossed *through* the intersection
  // — a single outline strokes only the exterior, so the centre is
  // perfectly solid and symmetric on the origin.
  ctx.beginPath();
  ctx.moveTo(cx - armHalf, cy - armLen);
  ctx.lineTo(cx + armHalf, cy - armLen);
  ctx.lineTo(cx + armHalf, cy - armHalf);
  ctx.lineTo(cx + armLen, cy - armHalf);
  ctx.lineTo(cx + armLen, cy + armHalf);
  ctx.lineTo(cx + armHalf, cy + armHalf);
  ctx.lineTo(cx + armHalf, cy + armLen);
  ctx.lineTo(cx - armHalf, cy + armLen);
  ctx.lineTo(cx - armHalf, cy + armHalf);
  ctx.lineTo(cx - armLen, cy + armHalf);
  ctx.lineTo(cx - armLen, cy - armHalf);
  ctx.lineTo(cx - armHalf, cy - armHalf);
  ctx.closePath();

  ctx.fillStyle = "#eaffee";
  ctx.fill();
  ctx.lineJoin = "miter";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1c8a3a";
  ctx.stroke();

  // Hot core highlight along the cross — additive blend pushes the centre
  // past the bloom luminance threshold so it gets a real glow halo.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, 18);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

// HDR-tinted multiplier — values >1 push the bright cross/halo pixels past
// the App.tsx bloom threshold (0.82) so the badge actually blooms rather
// than just sitting flat against the scene.
const buildMaterialColor = () => new THREE.Color().setRGB(1.0, 1.55, 1.1);

export const RegenBadges = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tex = useMemo(buildPlusTexture, []);
  const matColor = useMemo(buildMaterialColor, []);

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
      if (!e.alive || e.leak) continue;
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
        color={matColor}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
