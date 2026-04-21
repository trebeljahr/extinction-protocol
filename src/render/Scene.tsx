import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { Ground } from "./Ground";
import { PathLine } from "./PathLine";
import { EnemyMesh } from "./EnemyMesh";
import { TowerMesh } from "./TowerMesh";
import { ProjectileMesh } from "./ProjectileMesh";
import { SimTicker } from "./SimTicker";
import { Placement } from "./Placement";
import { MAP_HEIGHT } from "../level";

export const Scene = () => {
  return (
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={["#0b1016"]} />
      <fog attach="fog" args={["#0b1016", 30, 60]} />

      <OrthographicCamera
        makeDefault
        position={[0, 24, 14]}
        rotation={[-Math.PI / 3, 0, 0]}
        zoom={28}
        near={0.1}
        far={200}
      />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-MAP_HEIGHT}
        shadow-camera-right={MAP_HEIGHT}
        shadow-camera-top={MAP_HEIGHT}
        shadow-camera-bottom={-MAP_HEIGHT}
      />
      <hemisphereLight args={["#88aaff", "#1a1a20", 0.25]} />

      <SimTicker />
      <Ground />
      <Placement />
      <PathLine />
      <EnemyMesh />
      <TowerMesh />
      <ProjectileMesh />
    </Canvas>
  );
};
