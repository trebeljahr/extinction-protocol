import { useMemo } from "react";
import * as THREE from "three";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";
import { useGame } from "../store";

export const MapRoute = () => {
  const progress = useGame((s) => s.progress);

  const { reachedPoints, lockedPoints } = useMemo(() => {
    const reached: THREE.Vector3[] = [];
    const locked: THREE.Vector3[] = [];

    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = LEVELS[i];
      const b = LEVELS[i + 1];
      const bothUnlocked = isLevelUnlocked(a.id, progress) && isLevelUnlocked(b.id, progress);
      const from = new THREE.Vector3(a.nodePos.x, 0.02, -a.nodePos.y);
      const to = new THREE.Vector3(b.nodePos.x, 0.02, -b.nodePos.y);
      if (bothUnlocked) {
        reached.push(from, to);
      } else {
        locked.push(from, to);
      }
    }

    return { reachedPoints: reached, lockedPoints: locked };
  }, [progress]);

  return (
    <group>
      <LineSegments points={reachedPoints} color="#ffd66a" opacity={0.85} linewidth={3} />
      <LineSegments points={lockedPoints} color="#3a4452" opacity={0.5} linewidth={2} />
    </group>
  );
};

type LineProps = {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
  linewidth: number;
};

const LineSegments = ({ points, color, opacity }: LineProps) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(points);
    return g;
  }, [points]);

  if (points.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
};
