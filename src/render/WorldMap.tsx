import { Environment, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { LEVELS } from "../levels";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";
import { BiomeGround } from "./BiomeGround";
import { BiomeProps } from "./BiomeProps";

const MAP_W = 80;
const MAP_H = 48;

// Neutral daytime ambience so every biome patch reads well.
const BG = "#b8d0e4";
const FOG = "#c7dae8";
const HEMI_TOP = "#d6e6f4";
const HEMI_BOTTOM = "#7a6848";

export const WorldMapScene = () => (
  <>
    <color attach="background" args={[BG]} />
    <fog attach="fog" args={[FOG, 60, 130]} />

    <OrthographicCamera
      makeDefault
      position={[0, 30, 22]}
      rotation={[-Math.PI / 2.6, 0, 0]}
      zoom={18}
      near={0.1}
      far={200}
    />

    <OrbitControls
      makeDefault
      enablePan
      enableRotate={false}
      enableZoom
      mouseButtons={{
        LEFT: 2, // left-drag pans (PAN = 2)
        MIDDLE: 1,
        RIGHT: 2,
      }}
      panSpeed={1.6}
      zoomSpeed={0.8}
      minZoom={10}
      maxZoom={60}
      screenSpacePanning
    />

    <Environment preset="park" background={false} environmentIntensity={0.6} />

    <ambientLight intensity={0.55} color="#eaf2ff" />
    <directionalLight
      position={[14, 26, 10]}
      intensity={2.2}
      color="#fff4dc"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-MAP_H}
      shadow-camera-right={MAP_H}
      shadow-camera-top={MAP_H}
      shadow-camera-bottom={-MAP_H}
      shadow-bias={-0.0005}
    />
    <hemisphereLight args={[HEMI_TOP, HEMI_BOTTOM, 0.85]} />

    <BiomeGround width={MAP_W} height={MAP_H} />
    <BiomeProps />

    <MapRoute />

    {LEVELS.map(level => (
      <LevelNode key={level.id} level={level} />
    ))}
  </>
);
