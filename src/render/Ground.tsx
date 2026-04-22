import { useMemo } from "react";
import * as THREE from "three";
import type { Vec2 } from "../sim/types";
import { MAP_WIDTH, MAP_HEIGHT, PATH_WIDTH } from "../level";
import { useGame } from "../store";

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const distPointToSegSq = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len = abx * abx + aby * aby;
  const t = len > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / len)) : 0;
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
};

const nearAnyPath = (paths: Vec2[][], x: number, y: number, clearance: number) => {
  const r2 = clearance * clearance;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      if (distPointToSegSq(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < r2) return true;
    }
  }
  return false;
};

type Scatter = { x: number; y: number; scale: number; rot: number; tint: number };

const buildScatter = (paths: Vec2[][], seed: number, count: number, clearance: number): Scatter[] => {
  const rng = mulberry32(seed);
  const out: Scatter[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 20) {
    tries++;
    const x = (rng() - 0.5) * MAP_WIDTH;
    const y = (rng() - 0.5) * MAP_HEIGHT;
    if (nearAnyPath(paths, x, y, clearance)) continue;
    out.push({
      x,
      y,
      scale: 0.6 + rng() * 0.8,
      rot: rng() * Math.PI * 2,
      tint: rng(),
    });
  }
  return out;
};

export const Ground = () => {
  const paths = useGame(s => s.world.paths);
  const tufts = useMemo(() => buildScatter(paths, 1337, 240, PATH_WIDTH + 0.6), [paths]);
  const rocks = useMemo(() => buildScatter(paths, 4242, 48, PATH_WIDTH + 1.0), [paths]);
  const mosses = useMemo(() => buildScatter(paths, 9001, 90, PATH_WIDTH + 0.4), [paths]);

  const tuftGeom = useMemo(() => new THREE.ConeGeometry(0.12, 0.28, 5), []);
  const rockGeom = useMemo(() => new THREE.DodecahedronGeometry(0.35, 0), []);
  const mossGeom = useMemo(() => new THREE.CircleGeometry(0.5, 10), []);

  const tuftMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      tuftGeom,
      new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
      tufts.length,
    );
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < tufts.length; i++) {
      const t = tufts[i];
      dummy.position.set(t.x, 0.14 * t.scale, -t.y);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const h = 0.24 + t.tint * 0.08;
      color.setHSL(h, 0.45 + t.tint * 0.2, 0.32 + t.tint * 0.18);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [tufts, tuftGeom]);

  const rockMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      rockGeom,
      new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02 }),
      rocks.length,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      dummy.position.set(r.x, 0.1 * r.scale, -r.y);
      dummy.rotation.set(r.tint * 0.7, r.rot, r.tint * 0.4);
      dummy.scale.setScalar(r.scale * 0.75);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const g = 0.36 + r.tint * 0.15;
      color.setRGB(g, g - 0.02, g - 0.06);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [rocks, rockGeom]);

  const mossMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      mossGeom,
      new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, transparent: true, opacity: 0.55 }),
      mosses.length,
    );
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < mosses.length; i++) {
      const m = mosses[i];
      dummy.position.set(m.x, 0.012, -m.y);
      dummy.rotation.set(-Math.PI / 2, 0, m.rot);
      dummy.scale.setScalar(m.scale * 1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const h = 0.22 + m.tint * 0.08;
      color.setHSL(h, 0.35, 0.22 + m.tint * 0.1);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [mosses, mossGeom]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
        <meshStandardMaterial color="#2b3e28" roughness={0.98} metalness={0} />
      </mesh>

      <primitive object={mossMesh} />
      <primitive object={tuftMesh} />
      <primitive object={rockMesh} />
    </group>
  );
};
