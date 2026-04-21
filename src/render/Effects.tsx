import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

const MAX_PARTICLES = 512;
const MAX_EXPLOSIONS = 32;
const MAX_BEAMS = 32;
const MAX_BEAM_POINTS = 16;

export const Effects = () => {
  const particleRef = useRef<THREE.InstancedMesh>(null);
  const explosionRef = useRef<THREE.InstancedMesh>(null);
  const beamsGroupRef = useRef<THREE.Group>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const beamLines = useMemo(() => {
    const arr: THREE.Line[] = [];
    for (let i = 0; i < MAX_BEAMS; i++) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(MAX_BEAM_POINTS * 3), 3),
      );
      geom.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        toneMapped: false,
      });
      const line = new THREE.Line(geom, mat);
      line.visible = false;
      arr.push(line);
    }
    return arr;
  }, []);

  useEffect(() => {
    const group = beamsGroupRef.current;
    if (!group) return;
    for (const l of beamLines) group.add(l);
    return () => {
      for (const l of beamLines) group.remove(l);
    };
  }, [beamLines]);

  useFrame(() => {
    const { world } = useGame.getState();

    const pMesh = particleRef.current;
    if (pMesh) {
      let i = 0;
      for (const p of world.particles) {
        if (i >= MAX_PARTICLES) break;
        const life = Math.max(0, (p.expiresAt - world.time) / p.maxLife);
        dummy.position.set(p.pos.x, 0.5, -p.pos.y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.05 + life * 0.15);
        dummy.updateMatrix();
        pMesh.setMatrixAt(i, dummy.matrix);
        color.set(p.color);
        color.multiplyScalar(0.3 + life * 0.7);
        pMesh.setColorAt(i, color);
        i++;
      }
      pMesh.count = i;
      pMesh.instanceMatrix.needsUpdate = true;
      if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    }

    const eMesh = explosionRef.current;
    if (eMesh) {
      let i = 0;
      for (const e of world.explosions) {
        if (i >= MAX_EXPLOSIONS) break;
        const life = Math.max(0, (e.expiresAt - world.time) / e.maxLife);
        const growth = 1 - life;
        dummy.position.set(e.pos.x, 0.3, -e.pos.y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(e.radius * (0.4 + growth * 0.7));
        dummy.updateMatrix();
        eMesh.setMatrixAt(i, dummy.matrix);
        color.set("#ffb266");
        color.multiplyScalar(life);
        eMesh.setColorAt(i, color);
        i++;
      }
      eMesh.count = i;
      eMesh.instanceMatrix.needsUpdate = true;
      if (eMesh.instanceColor) eMesh.instanceColor.needsUpdate = true;
    }

    for (let k = 0; k < beamLines.length; k++) beamLines[k].visible = false;
    let idx = 0;
    for (const b of world.beams) {
      if (idx >= MAX_BEAMS) break;
      if (b.points.length < 2 || b.points.length > MAX_BEAM_POINTS) { idx++; continue; }
      const line = beamLines[idx];
      const positions = line.geometry.attributes.position.array as Float32Array;
      for (let p = 0; p < b.points.length; p++) {
        positions[p * 3 + 0] = b.points[p].x;
        positions[p * 3 + 1] = 0.8;
        positions[p * 3 + 2] = -b.points[p].y;
      }
      line.geometry.setDrawRange(0, b.points.length);
      line.geometry.attributes.position.needsUpdate = true;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.set(b.color);
      const life = Math.max(0, b.expiresAt - world.time);
      mat.opacity = Math.min(1, life * 10);
      line.visible = true;
      idx++;
    }
  });

  return (
    <group>
      <instancedMesh ref={particleRef} args={[undefined, undefined, MAX_PARTICLES]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial toneMapped={false} transparent />
      </instancedMesh>

      <instancedMesh ref={explosionRef} args={[undefined, undefined, MAX_EXPLOSIONS]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.65} />
      </instancedMesh>

      <group ref={beamsGroupRef} />
    </group>
  );
};
