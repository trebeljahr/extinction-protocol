import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { TowerKind } from "../sim/types";

const TOWER_MODEL: Record<TowerKind, { url: string; targetSize: number; rotY: number }> = {
  pulse:  { url: "/models/turrets/Rail Gun Turret.glb",  targetSize: 1.5, rotY: 0 },
  chain:  { url: "/models/turrets/Lighting Turret.glb",  targetSize: 1.5, rotY: 0 },
  mortar: { url: "/models/turrets/Missile Turret.glb",   targetSize: 1.5, rotY: 0 },
  cryo:   { url: "/models/turrets/Emp Turret.glb",       targetSize: 1.5, rotY: 0 },
};

const StaticTower = ({ url, targetSize, rotY }: { url: string; targetSize: number; rotY: number }) => {
  const { scene } = useGLTF(url);
  const { invalidate } = useThree();

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
    });
    return c;
  }, [scene]);

  const { normalizedScale, centerScaled } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const s = targetSize / maxDim;
    return {
      normalizedScale: s,
      centerScaled: { x: center.x * s, y: center.y * s, z: center.z * s },
    };
  }, [scene, targetSize]);

  useEffect(() => {
    // Re-invalidate a few times so the env HDRI finishes loading before the final draw.
    const timers = [0, 60, 220, 520].map(ms => setTimeout(() => invalidate(), ms));
    return () => timers.forEach(clearTimeout);
  }, [cloned, invalidate]);

  return (
    <group
      position={[-centerScaled.x, -centerScaled.y, -centerScaled.z]}
      rotation={[0, rotY, 0]}
      scale={normalizedScale}
    >
      <primitive object={cloned} />
    </group>
  );
};

export const TowerPreview = ({ kind }: { kind: TowerKind }) => {
  const { url, targetSize, rotY } = TOWER_MODEL[kind];
  return (
    <div className={`tower-swatch kind-${kind}`}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [3.4, 0.7, 1.1], fov: 26, near: 0.1, far: 20 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <ambientLight intensity={0.9} color="#eaf2ff" />
        <directionalLight position={[14, 26, 10]} intensity={2.2} color="#fff4dc" />
        <directionalLight position={[-8, 12, -4]} intensity={0.8} color="#bcd8ff" />
        <hemisphereLight args={["#bcd8ff", "#5a4a2a", 0.95]} />
        <Suspense fallback={null}>
          <StaticTower url={url} targetSize={targetSize} rotY={rotY} />
        </Suspense>
      </Canvas>
    </div>
  );
};

for (const k of Object.keys(TOWER_MODEL) as TowerKind[]) useGLTF.preload(TOWER_MODEL[k].url);
