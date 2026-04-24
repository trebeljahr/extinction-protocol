import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

export const SelectionRing = () => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const { world } = useGame.getState();
    const sel = world.selectedTowerId !== null ? world.towerById.get(world.selectedTowerId) : null;
    if (sel) {
      ring.position.set(sel.pos.x, 0.04, -sel.pos.y);
      ring.visible = true;
      ring.scale.setScalar(sel.range * 2);
    } else {
      ring.visible = false;
    }
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.48, 0.5, 64]} />
      <meshBasicMaterial color="#ffd66a" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
};
