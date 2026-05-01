import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_ELITES = 64;
// Floating chevron above each elite enemy. Cheap textured plane,
// instanced — one draw call regardless of how many elites are on field.
// Drawn camera-facing via a per-instance rotation we recompute each frame
// from the camera direction.

const TEX_SIZE = 64;

const buildBadgeTexture = () => {
  const c = document.createElement("canvas");
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  // Downward chevron — points at the enemy below.
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = "#ff5a3a";
  ctx.strokeStyle = "#ffd6c8";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(8, 14);
  ctx.lineTo(32, 50);
  ctx.lineTo(56, 14);
  ctx.lineTo(46, 14);
  ctx.lineTo(32, 36);
  ctx.lineTo(18, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

export const EliteBadges = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tex = useMemo(buildBadgeTexture, []);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { world } = useGame.getState();
    const time = world.time;

    // Compute camera-facing yaw once — orthographic-ish read from any
    // angle without per-instance billboarding math.
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const yaw = Math.atan2(-camDir.x, -camDir.z);

    let hi = 0;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (!e.elite) continue;
      if (hi >= MAX_ELITES) break;
      // Bobs above the enemy, height roughly tracks silhouette via
      // sqrt(maxHp) — keeps the badge above the head of titans without
      // floating ridiculously high above a raptor.
      const height = 1.6 + Math.sqrt(e.maxHp) * 0.04;
      const bob = Math.sin(time * 2.4 + e.id) * 0.08;
      dummy.position.set(e.pos.x, height + bob, -e.pos.y);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(0.7, 0.7, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(hi, dummy.matrix);
      hi++;
    }
    mesh.count = hi;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_ELITES]} renderOrder={6}>
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
