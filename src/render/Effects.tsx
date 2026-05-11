import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

const MAX_PARTICLES = 1024;
const MAX_EXPLOSIONS = 32;
const MAX_CRYO_WAVES = 16;
const MAX_BEAMS = 32;
const MAX_BEAM_POINTS = 16;
const BEAM_SUBDIVISIONS = 6; // interior noise points per source segment
const MAX_BEAM_VERTS = (MAX_BEAM_POINTS - 1) * BEAM_SUBDIVISIONS + 1;
const BEAM_NOISE = 0.28;

type BeamPass = { line: THREE.Line; mat: THREE.LineBasicMaterial };

const makeBeamPair = (): { core: BeamPass; halo: BeamPass } => {
  const mkLine = (baseColor: string, opacity: number) => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_BEAM_VERTS * 3), 3),
    );
    geom.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    return { line, mat };
  };
  return {
    core: mkLine("#ffffff", 1),
    halo: mkLine("#9fd8ff", 0.45),
  };
};

export const Effects = () => {
  const particleRef = useRef<THREE.InstancedMesh>(null);
  const particleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const explosionRef = useRef<THREE.InstancedMesh>(null);
  const explosionMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const cryoWaveRef = useRef<THREE.InstancedMesh>(null);
  const cryoHaloRef = useRef<THREE.InstancedMesh>(null);
  const beamsGroupRef = useRef<THREE.Group>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const beamPairs = useMemo(() => {
    const arr: ReturnType<typeof makeBeamPair>[] = [];
    for (let i = 0; i < MAX_BEAMS; i++) arr.push(makeBeamPair());
    return arr;
  }, []);

  useEffect(() => {
    const group = beamsGroupRef.current;
    if (!group) return;
    for (const b of beamPairs) {
      group.add(b.halo.line);
      group.add(b.core.line);
    }
    return () => {
      for (const b of beamPairs) {
        group.remove(b.halo.line);
        group.remove(b.core.line);
      }
    };
  }, [beamPairs]);

  useFrame(() => {
    const { world } = useGame.getState();
    const now = world.time;

    // --- Particles ---
    const pMesh = particleRef.current;
    if (pMesh) {
      let i = 0;
      for (const p of world.particles) {
        if (i >= MAX_PARTICLES) break;
        const life = Math.max(0, (p.expiresAt - now) / p.maxLife);
        dummy.position.set(p.pos.x, 0.55, -p.pos.y);
        dummy.rotation.set(0, 0, 0);
        const fade = life < 0.15 ? life / 0.15 : 1;
        dummy.scale.setScalar((0.08 + (1 - life) * 0.22 + life * 0.15) * fade);
        dummy.updateMatrix();
        pMesh.setMatrixAt(i, dummy.matrix);
        color.set(p.color);
        const boost = (0.4 + life * 1.0) * fade;
        color.multiplyScalar(boost);
        pMesh.setColorAt(i, color);
        i++;
      }
      pMesh.count = i;
      pMesh.instanceMatrix.needsUpdate = true;
      if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    }

    // --- Explosions: white shockwave + warm flash ---
    const eMesh = explosionRef.current;
    const fMesh = flashRef.current;
    if (eMesh && fMesh) {
      let i = 0;
      for (const e of world.explosions) {
        if (i >= MAX_EXPLOSIONS) break;
        const life = Math.max(0, (e.expiresAt - now) / e.maxLife);
        const growth = 1 - life;
        // Outer shockwave — expanding translucent dome
        dummy.position.set(e.pos.x, 0.35, -e.pos.y);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(e.radius * (0.35 + growth * 1.0));
        dummy.updateMatrix();
        eMesh.setMatrixAt(i, dummy.matrix);
        // Cool slightly-blue cast so it reads as a shock front, not a headlight.
        color.setRGB(0.82, 0.88, 1.0);
        eMesh.setColorAt(i, color);

        // Inner flash — warm hot core that shrinks slightly
        dummy.position.set(e.pos.x, 0.35, -e.pos.y);
        dummy.scale.setScalar(e.radius * (0.55 + life * 0.35));
        dummy.updateMatrix();
        fMesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(1.0, 0.82, 0.5).multiplyScalar(0.35 + life * 0.6);
        fMesh.setColorAt(i, color);
        i++;
      }
      eMesh.count = i;
      fMesh.count = i;
      eMesh.instanceMatrix.needsUpdate = true;
      fMesh.instanceMatrix.needsUpdate = true;
      if (eMesh.instanceColor) eMesh.instanceColor.needsUpdate = true;
      if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
      // Fade shockwave opacity with the longest-lived explosion so a single
      // material still reads as "translucent and fading".
      const eMat = explosionMatRef.current;
      if (eMat && world.explosions.length > 0) {
        let maxLife = 0;
        for (const e of world.explosions) {
          const l = Math.max(0, (e.expiresAt - now) / e.maxLife);
          if (l > maxLife) maxLife = l;
        }
        eMat.opacity = 0.12 + maxLife * 0.28;
      }
    }

    // --- Beams: jagged lightning, core + halo ---
    for (let k = 0; k < beamPairs.length; k++) {
      beamPairs[k].core.line.visible = false;
      beamPairs[k].halo.line.visible = false;
    }

    // Cryo waves: two co-located instanced meshes per wave — a crisp
    // leading edge (cryoWaveRef) and a softer trailing halo (cryoHaloRef)
    // — so the ring reads as a frost band with depth instead of a single
    // pencil line. Expansion is linear in radius (constant front speed),
    // which is what "emanating outward evenly" looks like.
    const wMesh = cryoWaveRef.current;
    const hMesh = cryoHaloRef.current;
    if (wMesh && hMesh) {
      let i = 0;
      for (const w of world.cryoWaves) {
        if (i >= MAX_CRYO_WAVES) break;
        const life = Math.max(0, (w.expiresAt - now) / w.maxLife);
        const progress = 1 - life;
        const radius = w.maxRadius * progress;
        // Fade in fast (first ~8% of life) so the ring doesn't pop at the
        // degenerate r=0 origin, then linearly bleed energy as it expands —
        // the front is brightest near the tower and fades to nothing as it
        // reaches the aura edge.
        const fadeIn = Math.min(1, progress / 0.08);
        const alpha = fadeIn * life;

        dummy.position.set(w.pos.x, 0.06, -w.pos.y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(radius, radius, 1);
        dummy.updateMatrix();
        wMesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.85, 0.97, 1.0).multiplyScalar(alpha);
        wMesh.setColorAt(i, color);

        // Halo trails the front slightly (95% radius) and is dimmer + wider.
        dummy.scale.set(radius * 0.95, radius * 0.95, 1);
        dummy.updateMatrix();
        hMesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.55, 0.82, 1.0).multiplyScalar(alpha * 0.6);
        hMesh.setColorAt(i, color);
        i++;
      }
      wMesh.count = i;
      hMesh.count = i;
      wMesh.instanceMatrix.needsUpdate = true;
      hMesh.instanceMatrix.needsUpdate = true;
      if (wMesh.instanceColor) wMesh.instanceColor.needsUpdate = true;
      if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
    }

    let idx = 0;
    for (const b of world.beams) {
      if (idx >= MAX_BEAMS) break;
      if (b.points.length < 2 || b.points.length > MAX_BEAM_POINTS) {
        idx++;
        continue;
      }

      const pair = beamPairs[idx];
      const coreArr = pair.core.line.geometry.attributes.position.array as Float32Array;
      const haloArr = pair.halo.line.geometry.attributes.position.array as Float32Array;

      // For each source segment, emit a jittered polyline with BEAM_SUBDIVISIONS points.
      // Core uses tight noise; halo uses larger noise and a slight height offset for glow.
      let coreVi = 0;
      let haloVi = 0;
      const writePoint = (arr: Float32Array, vi: number, x: number, y: number, z: number) => {
        arr[vi * 3 + 0] = x;
        arr[vi * 3 + 1] = y;
        arr[vi * 3 + 2] = z;
      };

      // Seed for deterministic per-beam jitter (keeps arc shape stable within its 0.1s life).
      let seedA = (b.id * 9301 + 49297) >>> 0;
      const rng = () => {
        seedA = (seedA * 1664525 + 1013904223) >>> 0;
        return (seedA / 0xffffffff) * 2 - 1;
      };

      const firstP = b.points[0];
      writePoint(coreArr, coreVi++, firstP.x, 0.85, -firstP.y);
      writePoint(haloArr, haloVi++, firstP.x, 0.9, -firstP.y);

      for (let s = 0; s < b.points.length - 1; s++) {
        const a = b.points[s];
        const bpt = b.points[s + 1];
        const dx = bpt.x - a.x;
        const dy = bpt.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // perpendicular in XZ plane (world coords: x, -y)
        const perpX = -dy / len;
        const perpZ = -dx / len;
        for (let sub = 1; sub <= BEAM_SUBDIVISIONS; sub++) {
          const t = sub / BEAM_SUBDIVISIONS;
          const baseX = a.x + dx * t;
          const baseY = a.y + dy * t;
          // taper noise near the endpoints
          const taper = Math.sin(t * Math.PI);
          const nCore = rng() * BEAM_NOISE * taper;
          const nHalo = rng() * BEAM_NOISE * 1.9 * taper;
          writePoint(
            coreArr,
            coreVi++,
            baseX + perpX * nCore,
            0.85 + rng() * 0.05 * taper,
            -baseY + perpZ * nCore,
          );
          writePoint(
            haloArr,
            haloVi++,
            baseX + perpX * nHalo,
            0.95 + rng() * 0.12 * taper,
            -baseY + perpZ * nHalo,
          );
        }
      }

      pair.core.line.geometry.setDrawRange(0, coreVi);
      pair.core.line.geometry.attributes.position.needsUpdate = true;
      pair.halo.line.geometry.setDrawRange(0, haloVi);
      pair.halo.line.geometry.attributes.position.needsUpdate = true;

      const life = Math.max(0, b.expiresAt - now);
      const lifeNorm = Math.min(1, life * 10);
      pair.core.mat.color.set("#ffffff");
      pair.core.mat.opacity = lifeNorm;
      pair.halo.mat.color.set(b.color);
      pair.halo.mat.opacity = 0.55 * lifeNorm;
      pair.core.line.visible = true;
      pair.halo.line.visible = true;
      idx++;
    }
  });

  return (
    <group>
      <instancedMesh ref={particleRef} args={[undefined, undefined, MAX_PARTICLES]} renderOrder={2}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          ref={particleMatRef}
          toneMapped={false}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={explosionRef}
        args={[undefined, undefined, MAX_EXPLOSIONS]}
        renderOrder={2}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          ref={explosionMatRef}
          toneMapped={false}
          transparent
          opacity={0.3}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh ref={flashRef} args={[undefined, undefined, MAX_EXPLOSIONS]} renderOrder={2}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          ref={flashMatRef}
          toneMapped={false}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={cryoHaloRef}
        args={[undefined, undefined, MAX_CRYO_WAVES]}
        renderOrder={2}
      >
        <ringGeometry args={[0.78, 1.0, 64]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      <instancedMesh
        ref={cryoWaveRef}
        args={[undefined, undefined, MAX_CRYO_WAVES]}
        renderOrder={2}
      >
        <ringGeometry args={[0.94, 1.0, 64]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>

      <group ref={beamsGroupRef} renderOrder={2} />
    </group>
  );
};
