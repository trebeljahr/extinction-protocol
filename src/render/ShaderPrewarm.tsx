// Mounts hidden clones of every tower/enemy/drone GLB at level start so
// three.js compiles their shader programs and uploads geometry/textures
// to the GPU immediately, instead of stuttering on the first wave spawn
// or first tower placement (~50–450ms RAF spikes in the wild).
//
// The clones live far below the map (out of frustum, no draw cost) for
// exactly two frames: long enough for the renderer to register them and
// for our explicit gl.compile() pass to prepare every material in scene.
// Then we unmount and free the references — the compiled WebGL programs
// are cached on the renderer, so subsequent real spawns reuse them.
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import type * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useGame } from "../store";

const PREWARM_URLS = [
  "/models/Velociraptor.glb",
  "/models/Trex.glb",
  "/models/Stegosaurus.glb",
  "/models/Triceratops.glb",
  "/models/Parasaurolophus.glb",
  "/models/Apatosaurus.glb",
  "/models/tower_pulse.glb",
  "/models/turrets/Lighting Turret.glb",
  "/models/turrets/Missile Turret.glb",
  "/models/turrets/Emp Turret.glb",
  "/models/turrets/Flamethrower Turret.glb",
  "/models/turrets/Hive Turret.glb",
  "/models/turrets/Drone.glb",
  "/models/turrets/Plasma Turret.glb",
];

const PrewarmModel = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  // SkeletonUtils.clone handles both static and skinned meshes correctly —
  // skinned dinos need bone graph cloning or the clone renders as a T-pose
  // with no bones (which still compiles the shader, but a plain clone
  // would silently break the actual gameplay path that uses cloneSkinned).
  const cloned = useMemo(() => cloneSkinned(scene) as THREE.Object3D, [scene]);
  return <primitive object={cloned} />;
};

export const ShaderPrewarm = () => {
  const gl = useThree((s) => s.gl);
  const sceneRoot = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const alreadyWarm = useGame((s) => s.assetsPrewarmed);
  const markWarm = useGame((s) => s.markAssetsPrewarmed);
  const [done, setDone] = useState(alreadyWarm);

  useEffect(() => {
    if (done) return;
    // Children mounted by render — compile every material now in the scene
    // (static props, lights, plus our hidden warm-up meshes).
    gl.compile(sceneRoot, camera);
    // One RAF buffer so the compile pass actually completes before we
    // strip the meshes back out.
    const id = requestAnimationFrame(() => {
      markWarm();
      setDone(true);
    });
    return () => cancelAnimationFrame(id);
  }, [gl, sceneRoot, camera, done, markWarm]);

  if (done) return null;
  return (
    <group position={[0, -1000, 0]}>
      {PREWARM_URLS.map((url) => (
        <PrewarmModel key={url} url={url} />
      ))}
    </group>
  );
};
