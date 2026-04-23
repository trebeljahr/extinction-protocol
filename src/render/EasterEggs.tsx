import { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import { EASTER_EGG_BY_ID, PRELOAD_URLS, type EasterEggDef } from "../easterEggs";
import type { EasterEgg } from "../sim/types";

const HIT_RADIUS = 0.9;

// Normalize a loaded GLB so its max dimension matches def.targetSize and
// its bottom sits on y=0.
const normalizeScene = (scene: THREE.Object3D, targetSize: number) => {
  const clone = scene.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / maxDim;
  const minY = box.min.y;
  return { clone, scale, minY };
};

const EasterEggMesh = ({ egg, def }: { egg: EasterEgg; def: EasterEggDef }) => {
  const { scene } = useGLTF(def.model);
  const clickEasterEgg = useGame(s => s.clickEasterEgg);
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  const { clone, scale, minY } = useMemo(
    () => normalizeScene(scene, def.targetSize),
    [scene, def.targetSize],
  );

  useEffect(() => {
    clone.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
  }, [clone]);

  useEffect(() => {
    if (!hovered) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "pointer";
    return () => { document.body.style.cursor = prev; };
  }, [hovered]);

  // Moving eggs (tumbleweed, rover) mutate pos/rotY every sim tick — read
  // them from the live world ref each frame rather than via Zustand props.
  useFrame(() => {
    if (!groupRef.current) return;
    if (!egg.vel) return;  // static eggs stay where they started
    groupRef.current.position.set(egg.pos.x, -minY * scale, -egg.pos.y);
    groupRef.current.rotation.y = egg.rotY;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    clickEasterEgg(egg.id);
  };

  return (
    <group
      ref={groupRef}
      position={[egg.pos.x, -minY * scale, -egg.pos.y]}
      rotation={[0, egg.rotY, 0]}
      scale={scale}
    >
      <primitive object={clone} />
      <mesh
        position={[0, HIT_RADIUS, 0]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const EasterEggs = () => {
  const eggs = useGame(s => s.world.easterEggs);
  if (eggs.length === 0) return null;
  return (
    <>
      {eggs.map(egg => {
        const def = EASTER_EGG_BY_ID[egg.defId];
        if (!def) return null;
        return <EasterEggMesh key={egg.id} egg={egg} def={def} />;
      })}
    </>
  );
};

for (const url of PRELOAD_URLS) useGLTF.preload(url);
