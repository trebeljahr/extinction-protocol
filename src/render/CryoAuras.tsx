import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

export const CryoAuras = () => {
  useGame(s => s.ui.towerVersion);
  const towers = useGame.getState().world.towers;
  const cryos = towers.filter(t => t.kind === "cryo");

  return (
    <group>
      {cryos.map(t => (
        <CryoAura key={t.id} x={t.pos.x} y={t.pos.y} range={t.range} />
      ))}
    </group>
  );
};

const CryoAura = ({ x, y, range }: { x: number; y: number; range: number }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const time = useGame.getState().world.time;
    const pulse = 0.82 + Math.sin(time * 2.1) * 0.18;
    const ringMat = ringRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const diskMat = diskRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (ringMat) ringMat.opacity = 0.22 * pulse;
    if (diskMat) diskMat.opacity = 0.06 * pulse;
  });

  return (
    <group position={[x, 0.025, -y]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={diskRef}>
        <circleGeometry args={[range, 48]} />
        <meshBasicMaterial
          color="#aaf0ff"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[range - 0.06, range, 64]} />
        <meshBasicMaterial
          color="#dffbff"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
