import { OrthographicCamera } from "@react-three/drei";
import { LEVELS } from "../levels";
import { LevelNode } from "./LevelNode";
import { MapRoute } from "./MapRoute";

const MAP_W = 80;
const MAP_H = 48;

export const WorldMapScene = () => (
  <>
    <color attach="background" args={["#08101a"]} />
    <fog attach="fog" args={["#08101a", 50, 90]} />

    <OrthographicCamera
      makeDefault
      position={[0, 30, 22]}
      rotation={[-Math.PI / 2.6, 0, 0]}
      zoom={18}
      near={0.1}
      far={200}
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

    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[MAP_W, MAP_H]} />
      <meshStandardMaterial color="#10202c" roughness={0.95} metalness={0} />
    </mesh>

    <gridHelper
      args={[MAP_W, MAP_W / 4, "#1a2d3a", "#0d1822"]}
      position={[0, 0.01, 0]}
    />

    <MapRoute />

    {LEVELS.map(level => (
      <LevelNode key={level.id} level={level} />
    ))}
  </>
);
