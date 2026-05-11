import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";
import { useGame } from "../store";

export const MapRoute = () => {
  const progress = useGame((s) => s.progress);

  const { reachedSegments, lockedSegments } = useMemo(() => {
    const reached: [THREE.Vector3, THREE.Vector3][] = [];
    const locked: [THREE.Vector3, THREE.Vector3][] = [];

    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = LEVELS[i];
      const b = LEVELS[i + 1];
      const bothUnlocked = isLevelUnlocked(a.id, progress) && isLevelUnlocked(b.id, progress);
      const from = new THREE.Vector3(a.nodePos.x, 0.02, -a.nodePos.y);
      const to = new THREE.Vector3(b.nodePos.x, 0.02, -b.nodePos.y);
      if (bothUnlocked) {
        reached.push([from, to]);
      } else {
        locked.push([from, to]);
      }
    }

    return { reachedSegments: reached, lockedSegments: locked };
  }, [progress]);

  return (
    <group>
      {reachedSegments.map(([from, to], i) => (
        <group key={`r-${i}`}>
          <Line points={[from, to]} color="#0a0a12" lineWidth={8} transparent opacity={0.7} />
          <Line points={[from, to]} color="#ffd66a" lineWidth={5} transparent opacity={1} />
        </group>
      ))}
      {lockedSegments.map(([from, to], i) => (
        <group key={`l-${i}`}>
          <Line points={[from, to]} color="#0a0a12" lineWidth={7} transparent opacity={0.6} />
          <Line points={[from, to]} color="#556070" lineWidth={4} transparent opacity={0.75} />
        </group>
      ))}
    </group>
  );
};
