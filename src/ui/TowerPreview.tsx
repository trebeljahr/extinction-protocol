import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { TowerKind } from "../sim/types";

const TOWER_MODEL: Record<TowerKind, { url: string; targetSize: number; rotY: number }> = {
  pulse:  { url: "/models/tower_pulse.glb",    targetSize: 1.6, rotY: Math.PI * 0.25 },
  chain:  { url: "/models/tower_chain.glb",    targetSize: 1.6, rotY: Math.PI * 0.2 },
  mortar: { url: "/models/turret_missile.glb", targetSize: 1.4, rotY: Math.PI * 0.22 },
  cryo:   { url: "/models/turret_emp.glb",     targetSize: 1.4, rotY: Math.PI * 0.25 },
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
    invalidate();
    const t = setTimeout(() => invalidate(), 32);
    return () => clearTimeout(t);
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
        camera={{ position: [1.3, 0.95, 1.8], fov: 28, near: 0.1, far: 20 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <ambientLight intensity={0.65} color="#eaf2ff" />
        <directionalLight position={[3, 4, 2]} intensity={1.8} color="#fff4dc" />
        <hemisphereLight args={["#bcd8ff", "#5a4a30", 0.6]} />
        <Suspense fallback={null}>
          <StaticTower url={url} targetSize={targetSize} rotY={rotY} />
        </Suspense>
      </Canvas>
    </div>
  );
};

for (const k of Object.keys(TOWER_MODEL) as TowerKind[]) useGLTF.preload(TOWER_MODEL[k].url);
