import type { ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { MAP_HEIGHT, MAP_WIDTH } from "../level";
import { TOWER_COST, TOWER_STATS } from "../sim/world";
import { useGame } from "../store";
import { GhostTower } from "./GhostTower";

type Vec2 = { x: number; y: number };

export const Placement = () => {
  const [hover, setHover] = useState<Vec2 | null>(null);
  const gold = useGame((s) => s.ui.gold);
  const status = useGame((s) => s.ui.status);
  const selectedKind = useGame((s) => s.selectedKind);

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    setHover({ x: e.point.x, y: -e.point.z });
  };

  const onPointerOut = () => setHover(null);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().tryPlaceOrSelect({ x: e.point.x, y: -e.point.z });
  };

  const hoveredTower = hover !== null ? useGame.getState().towerAtPos(hover) : null;

  const showPlacement =
    hover !== null && hoveredTower === null && status === "running" && selectedKind !== null;

  const canPlaceHere =
    showPlacement && gold >= TOWER_COST[selectedKind!] && useGame.getState().canPlace(hover!);

  const placementColor = canPlaceHere ? "#3dff8a" : "#ff5a7a";
  const range = selectedKind ? TOWER_STATS[selectedKind].range : 0;

  const geom = useMemo(() => new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT), []);
  useEffect(() => () => geom.dispose(), [geom]);

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

      {hover && status === "running" && hoveredTower && (
        <group position={[hoveredTower.pos.x, 0, -hoveredTower.pos.y]}>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.9, 32]} />
            <meshBasicMaterial color="#ffd66a" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[hoveredTower.range - 0.04, hoveredTower.range, 64]} />
            <meshBasicMaterial color="#ffd66a" transparent opacity={0.22} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {showPlacement && (
        <>
          <group position={[hover!.x, 0, -hover!.y]}>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.55, 0.7, 24]} />
              <meshBasicMaterial
                color={placementColor}
                transparent
                opacity={0.9}
                side={THREE.DoubleSide}
              />
            </mesh>
            {canPlaceHere && (
              <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[range - 0.04, range, 64]} />
                <meshBasicMaterial
                  color={placementColor}
                  transparent
                  opacity={0.25}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
          <Suspense fallback={null}>
            <GhostTower kind={selectedKind!} pos={hover!} ok={canPlaceHere} />
          </Suspense>
        </>
      )}
    </group>
  );
};
