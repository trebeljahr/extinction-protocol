import { useState, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { useGame } from "../store";
import { MAP_WIDTH, MAP_HEIGHT } from "../level";

const snap = (n: number, step = 1) => Math.round(n / step) * step;

export const Placement = () => {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    setHover({ x: snap(e.point.x), y: snap(-e.point.z) });
  };

  const onPointerOut = () => setHover(null);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().placeTower({ x: snap(e.point.x), y: snap(-e.point.z) });
  };

  const ok =
    hover !== null &&
    status === "running" &&
    gold >= 50 &&
    useGame.getState().canPlace(hover);
  const color = ok ? "#3dff8a" : "#ff4466";

  const geom = useMemo(() => new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT), []);

  return (
    <group>
      <mesh
        geometry={geom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
        visible={false}
      />
      {hover && (
        <mesh position={[hover.x, 0.05, -hover.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
