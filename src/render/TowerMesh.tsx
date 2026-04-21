import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";
import type { TowerKind } from "../sim/types";

const MAX_TOWERS = 128;

const BODY_COLOR: Record<TowerKind, string> = {
  pulse: "#3a5068",
  chain: "#4a3868",
  cryo: "#385a6a",
  mortar: "#5a4830",
};

const ACCENT_COLOR: Record<TowerKind, string> = {
  pulse: "#9fd8ff",
  chain: "#c48cff",
  cryo: "#aaf0ff",
  mortar: "#ffb266",
};

const KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar"];

const bodyGeomFor = (kind: TowerKind): THREE.BufferGeometry => {
  switch (kind) {
    case "pulse":  return new THREE.CylinderGeometry(0.5, 0.6, 0.6, 16);
    case "chain":  return new THREE.CylinderGeometry(0.45, 0.6, 0.6, 6);
    case "cryo":   return new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12);
    case "mortar": return new THREE.BoxGeometry(1.0, 0.5, 1.0);
  }
};

const turretGeomFor = (kind: TowerKind): THREE.BufferGeometry => {
  switch (kind) {
    case "pulse": {
      const g = new THREE.BoxGeometry(1.1, 0.18, 0.18);
      g.translate(0.55, 0, 0);
      return g;
    }
    case "chain": {
      const g = new THREE.ConeGeometry(0.25, 0.9, 8);
      g.rotateZ(-Math.PI / 2);
      g.translate(0.45, 0, 0);
      return g;
    }
    case "cryo": {
      const g = new THREE.IcosahedronGeometry(0.38, 0);
      g.translate(0, 0.35, 0);
      return g;
    }
    case "mortar": {
      const g = new THREE.CylinderGeometry(0.2, 0.22, 0.9, 12);
      g.rotateZ(Math.PI / 2);
      g.rotateZ(-Math.PI / 6);
      g.translate(0.3, 0.2, 0);
      return g;
    }
  }
};

export const TowerMesh = () => {
  const bodyRefs = useRef<Record<TowerKind, THREE.InstancedMesh | null>>({
    pulse: null, chain: null, cryo: null, mortar: null,
  });
  const turretRefs = useRef<Record<TowerKind, THREE.InstancedMesh | null>>({
    pulse: null, chain: null, cryo: null, mortar: null,
  });
  const selectRingRef = useRef<THREE.Mesh>(null);

  const bodyGeoms = useMemo(() => ({
    pulse: bodyGeomFor("pulse"),
    chain: bodyGeomFor("chain"),
    cryo: bodyGeomFor("cryo"),
    mortar: bodyGeomFor("mortar"),
  }), []);

  const turretGeoms = useMemo(() => ({
    pulse: turretGeomFor("pulse"),
    chain: turretGeomFor("chain"),
    cryo: turretGeomFor("cryo"),
    mortar: turretGeomFor("mortar"),
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const { world } = useGame.getState();

    const counts: Record<TowerKind, number> = { pulse: 0, chain: 0, cryo: 0, mortar: 0 };

    for (const t of world.towers) {
      const body = bodyRefs.current[t.kind];
      const turret = turretRefs.current[t.kind];
      if (!body || !turret) continue;
      const i = counts[t.kind]++;
      if (i >= MAX_TOWERS) continue;

      dummy.position.set(t.pos.x, 0.3, -t.pos.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);

      let yaw = 0;
      if (t.kind === "cryo") {
        yaw = world.time * 1.6;
      } else if (t.targetId !== null) {
        const target = world.enemies.find(e => e.id === t.targetId);
        if (target) {
          const dx = target.pos.x - t.pos.x;
          const dy = target.pos.y - t.pos.y;
          yaw = Math.atan2(dy, dx);
        }
      }
      dummy.position.set(t.pos.x, 0.8, -t.pos.y);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      turret.setMatrixAt(i, dummy.matrix);
    }

    for (const kind of KINDS) {
      const body = bodyRefs.current[kind];
      const turret = turretRefs.current[kind];
      if (body) { body.count = counts[kind]; body.instanceMatrix.needsUpdate = true; }
      if (turret) { turret.count = counts[kind]; turret.instanceMatrix.needsUpdate = true; }
    }

    const ring = selectRingRef.current;
    if (ring) {
      const sel = world.selectedTowerId !== null
        ? world.towers.find(t => t.id === world.selectedTowerId)
        : null;
      if (sel) {
        ring.position.set(sel.pos.x, 0.04, -sel.pos.y);
        ring.visible = true;
        const pulse = 1 + Math.sin(world.time * 6) * 0.03;
        ring.scale.setScalar(sel.range * 2 * pulse);
      } else {
        ring.visible = false;
      }
    }
  });

  return (
    <group>
      {KINDS.map(kind => (
        <instancedMesh
          key={`body-${kind}`}
          ref={m => { bodyRefs.current[kind] = m; }}
          args={[bodyGeoms[kind], undefined, MAX_TOWERS]}
          castShadow receiveShadow
        >
          <meshStandardMaterial color={BODY_COLOR[kind]} roughness={0.4} metalness={0.5} />
        </instancedMesh>
      ))}
      {KINDS.map(kind => (
        <instancedMesh
          key={`turret-${kind}`}
          ref={m => { turretRefs.current[kind] = m; }}
          args={[turretGeoms[kind], undefined, MAX_TOWERS]}
          castShadow
        >
          <meshStandardMaterial color={ACCENT_COLOR[kind]} roughness={0.3} metalness={0.55} emissive={ACCENT_COLOR[kind]} emissiveIntensity={0.25} />
        </instancedMesh>
      ))}
      <mesh ref={selectRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.48, 0.5, 64]} />
        <meshBasicMaterial color="#ffd66a" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
