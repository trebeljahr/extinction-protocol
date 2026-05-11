import { Environment } from "@react-three/drei";
import { BIOME_STYLE } from "../biomes";
import { MAP_HEIGHT } from "../level";
import { useGame } from "../store";
import { BiomeAmbientVfx } from "./BiomeAmbientVfx";
import { BiomeCosmetics } from "./BiomeCosmetics";
import { CameraRig } from "./CameraRig";
import { EasterEggs } from "./EasterEggs";
import { Effects } from "./Effects";
import { FierceHalos } from "./FierceHalos";
import { Ground } from "./Ground";
import { HealAuras } from "./HealAuras";
import { HealthBars } from "./HealthBars";
import { HiveDrones } from "./HiveDrones";
import { HQBase } from "./HQBase";
import { HQTurrets } from "./HQTurret";
import { LavaFeatures } from "./LavaFeatures";
import { ModelEnemyMesh } from "./ModelEnemyMesh";
import { ModelTowerMesh } from "./ModelTowerMesh";
import { OuterScenery } from "./OuterScenery";
import { PathLine } from "./PathLine";
import { Placement } from "./Placement";
import { ProjectileMesh } from "./ProjectileMesh";
import { RegenBadges } from "./RegenBadges";
import { Rocks } from "./Rocks";
import { SelectionRing } from "./SelectionRing";
import { ShaderPrewarm } from "./ShaderPrewarm";
import { ShieldBubbles } from "./ShieldBubbles";
import { SimTicker } from "./SimTicker";
import { SpotTargetMarker } from "./SpotTargetMarker";
import { TowerVfx } from "./TowerVfx";
import { Trees } from "./Trees";

export const PlayScene = () => {
  const biome = useGame((s) => s.world.biome);
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
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-MAP_HEIGHT}
        shadow-camera-right={MAP_HEIGHT}
        shadow-camera-top={MAP_HEIGHT}
        shadow-camera-bottom={-MAP_HEIGHT}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={[style.hemiTop, style.hemiBottom, 0.85]} />

      <SimTicker />
      <ShaderPrewarm />
      <Ground />
      <OuterScenery />
      <LavaFeatures />
      <Rocks />
      <Trees />
      <BiomeCosmetics />
      <EasterEggs />
      <Placement />
      <PathLine />
      <HQTurrets />
      <HQBase />

      <ModelEnemyMesh kind="raptor" url="/models/Velociraptor.glb" targetSize={1.6} />
      <ModelEnemyMesh kind="swarm" url="/models/Velociraptor.glb" targetSize={0.8} />
      <ModelEnemyMesh kind="para" url="/models/Parasaurolophus.glb" targetSize={1.7} />
      <ModelEnemyMesh kind="allosaur" url="/models/Trex.glb" targetSize={2.2} />
      <ModelEnemyMesh kind="stego" url="/models/Stegosaurus.glb" targetSize={1.9} />
      <ModelEnemyMesh kind="armored" url="/models/Triceratops.glb" targetSize={2.0} />
      <ModelEnemyMesh kind="titan" url="/models/Apatosaurus.glb" targetSize={11.0} clip="Walk" />
      <ModelEnemyMesh kind="boss" url="/models/Apatosaurus.glb" targetSize={18.0} clip="Walk" />

      <ModelTowerMesh kind="pulse" url="/models/tower_pulse.glb" targetSize={1.6} />
      <ModelTowerMesh kind="chain" url="/models/turrets/Lighting Turret.glb" targetSize={1.8} />
      <ModelTowerMesh kind="mortar" url="/models/turrets/Missile Turret.glb" targetSize={1.8} />
      <ModelTowerMesh kind="cryo" url="/models/turrets/Emp Turret.glb" targetSize={1.55} idleSpin />
      <ModelTowerMesh kind="flame" url="/models/turrets/Flamethrower Turret.glb" targetSize={1.7} />
      <ModelTowerMesh kind="hive" url="/models/turrets/Hive Turret.glb" targetSize={1.8} />
      <HiveDrones />
      <ShieldBubbles />
      <HealAuras />
      <FierceHalos />
      <RegenBadges />

      <TowerVfx />
      <HealthBars />
      <SelectionRing />
      <SpotTargetMarker />
      <ProjectileMesh />
      <Effects />
      <BiomeAmbientVfx />
    </>
  );
};
