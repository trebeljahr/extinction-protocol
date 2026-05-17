// Debug-only overlay that renders the suggested "stupid-optimal" tower
// plan emitted by scripts/wave-optimal-path.ts (--emit-traces). The
// overlay reads a per-level JSON trace from /balancing-traces/ and
// projects each planned tower as a ghost mesh with an upgrade-tier
// label. Gated on `isDebug` so the trace fetch (and Drei Text mounts)
// dead-code out of production builds.
//
// Use case: load Threshold of Eschaton in dev with ?debug=true, follow
// the ghosts literally, validate whether the simulator's plan is
// actually buildable in the live sim. If the ghost overlay clears the
// level the model is calibrated; if it dies, the simulator is lying.

import { Text } from "@react-three/drei";
import { useEffect, useState } from "react";
import { isDebug } from "../debug";
import type { TowerKind } from "../sim/types";
import { useGame } from "../store";
import { GhostTower } from "./GhostTower";

type Vec2 = { x: number; y: number };
type PlannedTower = {
  id: number;
  kind: TowerKind;
  lanes: number[];
  anchor: Vec2;
  builtAtWave: number;
  finalTierA: number;
  finalTierB: number;
};
type Trace = {
  schemaVersion: number;
  levelId: number;
  difficulty: string;
  plannedTowers: PlannedTower[];
};

const KIND_LETTER: Record<TowerKind, string> = {
  pulse: "P",
  chain: "C",
  cryo: "K",
  mortar: "M",
  flame: "F",
  hive: "H",
};

export const PlannerOverlay = () => {
  if (!isDebug) return null;
  return <PlannerOverlayInner />;
};

const PlannerOverlayInner = () => {
  const levelId = useGame((s) => s.world.levelId);
  const difficulty = useGame((s) => s.progress.difficulty);
  const status = useGame((s) => s.world.status);
  const [trace, setTrace] = useState<Trace | null>(null);

  useEffect(() => {
    if (status === "won" || status === "lost") return;
    let cancelled = false;
    setTrace(null);
    fetch(`/balancing-traces/level-${levelId}-${difficulty}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (!cancelled && t && t.schemaVersion === 1) setTrace(t as Trace);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [levelId, difficulty, status]);

  if (!trace) return null;

  return (
    <>
      {trace.plannedTowers.map((t) => {
        const label = `${KIND_LETTER[t.kind]} ${t.finalTierA}/${t.finalTierB} W${t.builtAtWave}`;
        return (
          <group key={t.id}>
            <GhostTower kind={t.kind} pos={t.anchor} ok={true} />
            <Text
              position={[t.anchor.x, 2.6, -t.anchor.y]}
              fontSize={0.55}
              color="#ffd66a"
              outlineColor="#000"
              outlineWidth={0.05}
              anchorX="center"
              anchorY="middle"
            >
              {label}
            </Text>
          </group>
        );
      })}
    </>
  );
};
