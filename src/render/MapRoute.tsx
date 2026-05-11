import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";
import { useGame } from "../store";

export const MapRoute = () => {
  const progress = useGame((s) => s.progress);

  type Seg = { outline: [THREE.Vector3, THREE.Vector3]; fill: [THREE.Vector3, THREE.Vector3] };
  const { reachedSegments, lockedSegments } = useMemo(() => {
    const reached: Seg[] = [];
    const locked: Seg[] = [];

    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = LEVELS[i];
      const b = LEVELS[i + 1];
      const bothUnlocked = isLevelUnlocked(a.id, progress) && isLevelUnlocked(b.id, progress);
      const yOutline = 0.02;
      const yFill = 0.025;
      const fromOutline = new THREE.Vector3(a.nodePos.x, yOutline, -a.nodePos.y);
      const toOutline = new THREE.Vector3(b.nodePos.x, yOutline, -b.nodePos.y);
      const fromFill = new THREE.Vector3(a.nodePos.x, yFill, -a.nodePos.y);
      const toFill = new THREE.Vector3(b.nodePos.x, yFill, -b.nodePos.y);
      if (bothUnlocked) {
        reached.push({ outline: [fromOutline, toOutline], fill: [fromFill, toFill] });
      } else {
        locked.push({ outline: [fromOutline, toOutline], fill: [fromFill, toFill] });
      }
    }

    return { reachedSegments: reached, lockedSegments: locked };
  }, [progress]);

  return (
    <group>
      {reachedSegments.map((seg, i) => (
        <group key={`r-${i}`}>
          <Line
            points={seg.outline}
            color="#0a0a12"
            lineWidth={8}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
          <Line
            points={seg.fill}
            color="#ffd66a"
            lineWidth={5}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </group>
      ))}
      {lockedSegments.map((seg, i) => (
        <group key={`l-${i}`}>
          <Line
            points={seg.outline}
            color="#0a0a12"
            lineWidth={7}
            transparent
            opacity={0.6}
            depthWrite={false}
          />
          <Line
            points={seg.fill}
            color="#556070"
            lineWidth={4}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </group>
      ))}
    </group>
  );
};
