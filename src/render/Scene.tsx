import { Environment } from "@react-three/drei";
import { Ground } from "./Ground";
import { Trees } from "./Trees";
import { PathLine } from "./PathLine";
import { ModelEnemyMesh } from "./ModelEnemyMesh";
import { ModelTowerMesh } from "./ModelTowerMesh";
import { HealthBars } from "./HealthBars";
import { SelectionRing } from "./SelectionRing";
import { CryoAuras } from "./CryoAuras";
import { ProjectileMesh } from "./ProjectileMesh";
import { SimTicker } from "./SimTicker";
import { Placement } from "./Placement";
import { Effects } from "./Effects";
import { CameraRig } from "./CameraRig";
import { MAP_HEIGHT } from "../level";
import { useGame } from "../store";
import { BIOME_STYLE } from "../biomes";

export const PlayScene = () => {
  const biome = useGame(s => s.world.biome);
  const style = BIOME_STYLE[biome];
  return (
    <>
      <color attach="background" args={[style.sceneBg]} />
      <fog attach="fog" args={[style.fogColor, style.fogNear, style.fogFar]} />

      <CameraRig />

      <Environment preset="park" background={false} environmentIntensity={0.6} />

      <ambientLight intensity={0.55} color="#eaf2ff" />
      <directionalLight
        position={[14, 26, 10]}
        intensity={2.2}
        color="#fff4dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-MAP_HEIGHT}
        shadow-camera-right={MAP_HEIGHT}
        shadow-camera-top={MAP_HEIGHT}
        shadow-camera-bottom={-MAP_HEIGHT}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={[style.hemiTop, style.hemiBottom, 0.85]} />

      <SimTicker />
      <Ground />
      <Trees />
      <Placement />
      <PathLine />

      <ModelEnemyMesh kind="raptor"   url="/models/Velociraptor.glb"    targetSize={1.6} />
      <ModelEnemyMesh kind="swarm"    url="/models/Velociraptor.glb"    targetSize={0.8} />
      <ModelEnemyMesh kind="para"     url="/models/Parasaurolophus.glb" targetSize={1.7} />
      <ModelEnemyMesh kind="allosaur" url="/models/Trex.glb"            targetSize={2.2} />
      <ModelEnemyMesh kind="stego"    url="/models/Stegosaurus.glb"     targetSize={1.9} />
      <ModelEnemyMesh kind="armored"  url="/models/Triceratops.glb"     targetSize={2.0} />
      <ModelEnemyMesh kind="titan"    url="/models/Apatosaurus.glb"     targetSize={3.0} clip="Walk" />

      <ModelTowerMesh kind="pulse"  url="/models/tower_pulse.glb"    targetSize={1.6} />
      <ModelTowerMesh kind="chain"  url="/models/tower_chain.glb"    targetSize={1.6} />
      <ModelTowerMesh kind="mortar" url="/models/turret_missile.glb" targetSize={1.4} />
      <ModelTowerMesh kind="cryo"   url="/models/turret_emp.glb"     targetSize={1.4} idleSpin />

      <CryoAuras />
      <HealthBars />
      <SelectionRing />
      <ProjectileMesh />
      <Effects />
    </>
  );
};
