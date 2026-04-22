import { Ground } from "./Ground";
import { PathLine } from "./PathLine";
import { ModelEnemyMesh } from "./ModelEnemyMesh";
import { ModelTowerMesh } from "./ModelTowerMesh";
import { HealthBars } from "./HealthBars";
import { SelectionRing } from "./SelectionRing";
import { ProjectileMesh } from "./ProjectileMesh";
import { SimTicker } from "./SimTicker";
import { Placement } from "./Placement";
import { Effects } from "./Effects";
import { CameraRig } from "./CameraRig";
import { MAP_HEIGHT } from "../level";

export const PlayScene = () => (
  <>
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

    <ModelEnemyMesh kind="raptor"   url="/models/raptor.glb"       targetSize={1.4} />
    <ModelEnemyMesh kind="allosaur" url="/models/allosaurus.glb"   targetSize={1.9} />
    <ModelEnemyMesh kind="stego"    url="/models/stegoknight.glb"  targetSize={1.8} />
    <ModelEnemyMesh kind="armored"  url="/models/spinosaurobot.glb" targetSize={2.2} />
    <ModelEnemyMesh kind="swarm"    url="/models/flyer.glb"        targetSize={1.0} yOffset={1.2} bob />

    <ModelTowerMesh kind="pulse"  url="/models/tower_pulse.glb"    targetSize={1.6} />
    <ModelTowerMesh kind="chain"  url="/models/tower_chain.glb"    targetSize={1.6} />
    <ModelTowerMesh kind="mortar" url="/models/turret_missile.glb" targetSize={1.4} />
    <ModelTowerMesh kind="cryo"   url="/models/turret_emp.glb"     targetSize={1.4} idleSpin />

    <HealthBars />
    <SelectionRing />
    <ProjectileMesh />
    <Effects />
  </>
);
