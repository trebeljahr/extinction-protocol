import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";

// In-world hero markers: pulsing range ring, move-target ping, and a
// translucent ground footprint so the player can always pick the hero
// out from the tower clutter. Cheap (a few meshes), updated by useFrame.
export const HeroHud = () => {
  const ringRef = useRef<THREE.Mesh>(null);
  const footRef = useRef<THREE.Mesh>(null);
  const moveRef = useRef<THREE.Mesh>(null);

  const ringGeom = useMemo(() => new THREE.RingGeometry(0.95, 1.08, 48), []);
  const footGeom = useMemo(() => new THREE.CircleGeometry(0.85, 36), []);
  const moveGeom = useMemo(() => new THREE.RingGeometry(0.4, 0.55, 32), []);
  const selGeom = useMemo(() => new THREE.RingGeometry(1.1, 1.32, 48), []);
  const selRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { world } = useGame.getState();
    const hero = world.hero;
    if (!ringRef.current || !footRef.current || !moveRef.current || !selRef.current) return;
    const visible = hero.alive;
    ringRef.current.visible = visible;
    footRef.current.visible = visible;
    if (visible) {
      const pulse = 1 + Math.sin(world.time * 3.6) * 0.04;
      ringRef.current.position.set(hero.pos.x, 0.05, -hero.pos.y);
      ringRef.current.scale.setScalar(pulse);
      footRef.current.position.set(hero.pos.x, 0.045, -hero.pos.y);
    }
    if (hero.moveTarget) {
      moveRef.current.visible = true;
      moveRef.current.position.set(hero.moveTarget.x, 0.06, -hero.moveTarget.y);
      const spin = world.time * 2.6;
      moveRef.current.rotation.set(-Math.PI / 2, 0, spin);
    } else {
      moveRef.current.visible = false;
    }
    if (hero.selected && hero.alive) {
      selRef.current.visible = true;
      selRef.current.position.set(hero.pos.x, 0.06, -hero.pos.y);
      const pulse = 1 + Math.sin(world.time * 5.2) * 0.07;
      selRef.current.scale.setScalar(pulse);
    } else {
      selRef.current.visible = false;
    }
  });

  return (
    <group>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeom}>
        <meshBasicMaterial color="#9fd8ff" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={footRef} rotation={[-Math.PI / 2, 0, 0]} geometry={footGeom}>
        <meshBasicMaterial color="#5ad6ff" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={moveRef} geometry={moveGeom}>
        <meshBasicMaterial color="#9fd8ff" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={selRef} rotation={[-Math.PI / 2, 0, 0]} geometry={selGeom}>
        <meshBasicMaterial color="#ffd66a" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
