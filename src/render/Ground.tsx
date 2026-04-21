import { MAP_WIDTH, MAP_HEIGHT } from "../level";

export const Ground = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
      <meshStandardMaterial color="#1a2330" roughness={0.95} metalness={0} />
    </mesh>

    <gridHelper
      args={[MAP_WIDTH, MAP_WIDTH / 2, "#2a3a50", "#172230"]}
      position={[0, 0.01, 0]}
    />
  </group>
);
