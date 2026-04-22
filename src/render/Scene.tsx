import { Canvas } from "@react-three/fiber";
import { Ground } from "./Ground";
import { PathLine } from "./PathLine";
import { EnemyMesh } from "./EnemyMesh";
import { ModelEnemyMesh } from "./ModelEnemyMesh";
import { TowerMesh } from "./TowerMesh";
import { ProjectileMesh } from "./ProjectileMesh";
import { SimTicker } from "./SimTicker";
import { Placement } from "./Placement";
import { Effects } from "./Effects";
import { CameraRig } from "./CameraRig";
import { MAP_HEIGHT } from "../level";

export const Scene = () => (
  <Canvas shadows dpr={[1, 2]}>
    <color attach="background" args={["#1b2a22"]} />
    <fog attach="fog" args={["#1b2a22", 32, 68]} />

    <CameraRig />

    <ambientLight intensity={0.45} />
    <directionalLight
      position={[10, 20, 10]}
      intensity={1.0}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-MAP_HEIGHT}
      shadow-camera-right={MAP_HEIGHT}
      shadow-camera-top={MAP_HEIGHT}
      shadow-camera-bottom={-MAP_HEIGHT}
    />
    <hemisphereLight args={["#b8dc9c", "#2a1f15", 0.45]} />

    <SimTicker />
    <Ground />
    <Placement />
    <PathLine />
    <EnemyMesh />
    <ModelEnemyMesh kind="allosaur" url="/models/walker.glb" targetSize={1.8} yOffset={0.9} />
    <ModelEnemyMesh kind="swarm" url="/models/flyer.glb" targetSize={0.9} yOffset={0.9} />
    <TowerMesh />
    <ProjectileMesh />
    <Effects />
  </Canvas>
);
