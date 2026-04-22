import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

export const SlotMarkers = () => {
  const selectedKind = useGame(s => s.selectedKind);
  useGame(s => s.ui.towerVersion);

  const slots = useGame.getState().world.slots;
  const emptySlots = useMemo(() => slots.filter(s => s.towerId === null), [slots, selectedKind]);

  const groupRef = useMemo(() => ({ current: null as THREE.Group | null }), []);
  const matsRef = useMemo(() => ({ inner: [] as THREE.MeshBasicMaterial[], outer: [] as THREE.MeshBasicMaterial[] }), []);

  const idleOpacity = selectedKind !== null ? 0.55 : 0.18;
  const innerOpacity = selectedKind !== null ? 0.22 : 0.08;

  useFrame(() => {
    if (selectedKind === null) return;
    const t = useGame.getState().world.time;
    const pulse = 0.7 + Math.sin(t * 3.2) * 0.3;
    for (const m of matsRef.outer) m.opacity = idleOpacity * pulse;
    for (const m of matsRef.inner) m.opacity = innerOpacity * pulse;
  });

  return (
    <group ref={r => { groupRef.current = r; }}>
      {emptySlots.map((s, i) => (
        <group key={s.id} position={[s.pos.x, 0.018, -s.pos.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.6, 28]} />
            <meshBasicMaterial
              ref={m => { if (m) matsRef.inner[i] = m; }}
              color="#ffd66a"
              transparent
              opacity={innerOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.58, 0.66, 28]} />
            <meshBasicMaterial
              ref={m => { if (m) matsRef.outer[i] = m; }}
              color="#ffd66a"
              transparent
              opacity={idleOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};
