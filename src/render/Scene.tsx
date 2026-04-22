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

export const PlayScene = () => (
  <>
    <color attach="background" args={["#0b1016"]} />
    <fog attach="fog" args={["#0b1016", 30, 60]} />

    <CameraRig />

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
    <ModelEnemyMesh kind="allosaur" url="/models/walker.glb" targetSize={1.8} yOffset={0.9} />
    <ModelEnemyMesh kind="swarm" url="/models/flyer.glb" targetSize={0.9} yOffset={0.9} />
    <TowerMesh />
    <ProjectileMesh />
    <Effects />
  </>
);
