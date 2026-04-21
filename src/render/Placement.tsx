import { useState, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { useGame } from "../store";
import { MAP_WIDTH, MAP_HEIGHT } from "../level";
import { TOWER_COST, TOWER_STATS } from "../sim/world";

const snap = (n: number, step = 1) => Math.round(n / step) * step;

export const Placement = () => {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const gold = useGame(s => s.ui.gold);
  const status = useGame(s => s.ui.status);
  const selectedKind = useGame(s => s.selectedKind);

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    setHover({ x: snap(e.point.x), y: snap(-e.point.z) });
  };

  const onPointerOut = () => setHover(null);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().tryPlaceOrSelect({ x: snap(e.point.x), y: snap(-e.point.z) });
  };

  const canPlaceHere =
    hover !== null &&
    status === "running" &&
    gold >= TOWER_COST[selectedKind] &&
    useGame.getState().canPlace(hover);

  const color = canPlaceHere ? "#3dff8a" : "#ff5a7a";
  const range = TOWER_STATS[selectedKind].range;

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
      {hover && status === "running" && (
        <group position={[hover.x, 0, -hover.y]}>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.7, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          {canPlaceHere && (
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[range - 0.04, range, 64]} />
              <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
};
