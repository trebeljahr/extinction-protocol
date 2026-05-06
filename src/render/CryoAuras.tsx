import * as THREE from "three";
import { useGame } from "../store";

export const CryoAuras = () => {
  useGame((s) => s.ui.towerVersion);
  const towers = useGame.getState().world.towers;
  const cryos = towers.filter((t) => t.kind === "cryo");

  return (
    <group>
      {cryos.map((t) => (
        <CryoAura key={t.id} x={t.pos.x} y={t.pos.y} range={t.range} />
      ))}
    </group>
  );
};

// Static cold-aura ring + disc. No animation — the user asked for a
// quiet range indicator instead of a pulse.
const CryoAura = ({ x, y, range }: { x: number; y: number; range: number }) => (
  <group position={[x, 0.025, -y]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh>
      <circleGeometry args={[range, 48]} />
      <meshBasicMaterial
        color="#aaf0ff"
        transparent
        opacity={0.06}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
    <mesh>
      <ringGeometry args={[range - 0.06, range, 64]} />
      <meshBasicMaterial
        color="#dffbff"
        transparent
        opacity={0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  </group>
);
