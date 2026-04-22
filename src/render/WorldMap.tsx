import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { LEVELS } from "../levels";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";
import { BiomeGround } from "./BiomeGround";
import { BiomeProps } from "./BiomeProps";

const MAP_W = 80;
const MAP_H = 48;

export const WorldMapScene = () => (
  <>
    <color attach="background" args={["#08101a"]} />
    <fog attach="fog" args={["#0a1824", 60, 120]} />

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

    <ambientLight intensity={0.45} />
    <directionalLight
      position={[12, 24, 12]}
      intensity={1.0}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-MAP_H}
      shadow-camera-right={MAP_H}
      shadow-camera-top={MAP_H}
      shadow-camera-bottom={-MAP_H}
    />
    <hemisphereLight args={["#88aaff", "#1a1a20", 0.3]} />

    <BiomeGround width={MAP_W} height={MAP_H} />
    <BiomeProps />

    <MapRoute />

    {LEVELS.map(level => (
      <LevelNode key={level.id} level={level} />
    ))}
  </>
);
