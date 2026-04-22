import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useGame } from "../store";
import { audio } from "../audio/AudioManager";
import type { LevelConfig } from "../levels";
import { getStars, isLevelUnlocked } from "../progress";

type Props = { level: LevelConfig };

const STAR_SHAPE = (() => {
  const shape = new THREE.Shape();
  const outer = 0.46;
  const inner = 0.2;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
})();

const STAR_GEOM = new THREE.ShapeGeometry(STAR_SHAPE);

export const LevelNode = ({ level }: Props) => {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useGame(s => s.progress);
  const startLevel = useGame(s => s.startLevel);
  const setHoveredLevel = useGame(s => s.setHoveredLevel);
  const [hovered, setHovered] = useState(false);

  const unlocked = isLevelUnlocked(level.id, progress);
  const stars = getStars(progress, level.id);
  const completed = stars > 0;
  const unplayed = unlocked && !completed;

  const { baseColor, emissive, emissiveIntensity } = useMemo(() => {
    if (!unlocked) return { baseColor: "#3a4452", emissive: "#000000", emissiveIntensity: 0 };
    if (completed) return { baseColor: "#ffd66a", emissive: "#5a4018", emissiveIntensity: 0.6 };
    return { baseColor: "#3dd1ff", emissive: "#1a6a88", emissiveIntensity: 0.8 };
  }, [unlocked, completed]);

  // Hover bumps the dome a touch. Unplayed still pulses — the hover pop
  // layers on top of the pulse.
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const hoverBoost = hovered && unlocked ? 1.12 : 1.0;
    if (unplayed) {
      const t = state.clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 3.2) * 0.08;
      g.scale.setScalar(pulse * hoverBoost);
    } else {
      g.scale.setScalar(hoverBoost);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!unlocked) return;
    audio.ensureResumed();
    audio.play("level-select", 0.7, 80);
    startLevel(level.id);
  };

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    setHoveredLevel(level.id);
    document.body.style.cursor = unlocked ? "pointer" : "not-allowed";
  };

  const handleOut = () => {
    setHovered(false);
    setHoveredLevel(null);
    document.body.style.cursor = "default";
  };

  // Stars sit ABOVE the number label (which is at y=1.3). Pulled up a bit
  // further so the two don't visually fight at our tilted ortho angle.
  const starY = 3.15;
  const labelY = completed ? 1.3 : 1.3;

  const x = level.nodePos.x;
  const z = -level.nodePos.y;

  return (
    <group position={[x, 0, z]}>
      <group ref={groupRef}>
        <mesh
          position={[0, 0.5, 0]}
          castShadow
          onPointerDown={handleClick}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
        >
          <cylinderGeometry args={[0.9, 1.1, 0.6, 24]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity + (hovered && unlocked ? 0.5 : 0)}
            roughness={0.45}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.5, 20, 20]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={emissive}
            emissiveIntensity={(emissiveIntensity + (hovered && unlocked ? 0.5 : 0)) * 1.2}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
      </group>

      <mesh
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.25, 1.5, 32]} />
        <meshBasicMaterial
          color={unlocked ? (completed ? "#ffd66a" : "#3dd1ff") : "#2a3240"}
          transparent
          opacity={unlocked ? (hovered ? 0.95 : 0.6) : 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Html center position={[0, labelY, 0]} zIndexRange={[0, 10]}>
        <div className={`map-label ${unlocked ? "" : "locked"}`}>
          {unlocked ? level.id : "\u{1F512}"}
        </div>
      </Html>

      {completed && (
        <group position={[0, starY, 0]}>
          {Array.from({ length: 3 }).map((_, i) => {
            const filled = i < stars;
            const offset = (i - 1) * 1.1;
            return (
              <mesh
                key={i}
                geometry={STAR_GEOM}
                position={[offset, 0, 0]}
                rotation={[-Math.PI / 2.4, 0, 0]}
              >
                <meshStandardMaterial
                  color={filled ? "#ffd66a" : "#2a3240"}
                  emissive={filled ? "#a66a14" : "#000000"}
                  emissiveIntensity={filled ? 1.2 : 0}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
};
