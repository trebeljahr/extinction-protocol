// Debug-only HTML overlay listing the per-wave plan emitted by
// scripts/wave-optimal-path.ts (--emit-traces). Sister to PlannerOverlay
// (the 3D ghost-tower projection) — this panel exposes the timing wiring
// the ghosts can't show: which upgrades land on which wave, suggested
// robot, per-wave reqDPS vs achieved. isDebug gates the whole thing so
// production strips it.

import { useEffect, useState } from "react";
import { isDebug } from "../debug";
import type { TowerKind } from "../sim/types";
import { useGame } from "../store";

type Vec2 = { x: number; y: number };
type Action =
  | { type: "build"; towerId: number; kind: TowerKind; lanes: number[]; anchor: Vec2; cost: number }
  | {
      type: "upgrade";
      towerId: number;
      kind: TowerKind;
      branch: "a" | "b";
      tier: 1 | 2 | 3;
      cost: number;
    };
type WaveTrace = {
  wave: number;
  archetype: string;
  reqDpsByLane: number[];
  dpsAfterByLane: number[];
  spentThisWave: number;
  goldIn: number;
  goldOut: number;
  cleared: boolean;
  actions: Action[];
};
type Trace = {
  schemaVersion: number;
  levelName: string;
  difficulty: string;
  safety: number;
  beamWidth: number;
  suggestedRobot: string;
  suggestedRobotReason: string;
  effectiveStartGold: number;
  finalPortfolio: string;
  totalSpent: number;
  success: boolean;
  failedAt?: number;
  waves: WaveTrace[];
};

const fmtLane = (vs: number[]) => vs.map((v) => Math.round(v)).join("/");
const fmtLanes = (l: number[]) => (l.length === 1 ? `L${l[0]}` : `L${l.join("+")}`);

const describeAction = (a: Action): string => {
  if (a.type === "build")
    return `+${a.kind}@${fmtLanes(a.lanes)} (${Math.round(a.anchor.x)},${Math.round(a.anchor.y)}) ${a.cost}g`;
  return `↑${a.kind} ${a.branch.toUpperCase()}→T${a.tier} ${a.cost}g`;
};

export const PlannerHud = () => {
  if (!isDebug) return null;
  return <PlannerHudInner />;
};

const PlannerHudInner = () => {
  const levelId = useGame((s) => s.world.levelId);
  const difficulty = useGame((s) => s.progress.difficulty);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
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
  }, [levelId, difficulty]);

  if (!trace) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 50,
        maxWidth: 360,
        maxHeight: "70vh",
        overflow: "auto",
        background: "rgba(8,12,18,0.88)",
        color: "#cfe5ff",
        border: "1px solid rgba(255,214,106,0.4)",
        borderRadius: 6,
        padding: "8px 10px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.35,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
          color: "#ffd66a",
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        <span>PLAN · {trace.levelName}</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "transparent",
            color: "#ffd66a",
            border: "1px solid rgba(255,214,106,0.4)",
            borderRadius: 4,
            padding: "0 6px",
            cursor: "pointer",
          }}
        >
          {collapsed ? "+" : "−"}
        </button>
      </div>
      <div style={{ color: "#9fd8ff", marginBottom: 6 }}>
        {trace.difficulty} · safety {trace.safety}× · beam {trace.beamWidth} · startGold{" "}
        {trace.effectiveStartGold}
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: "#ffd66a" }}>Robot:</span> {trace.suggestedRobot}
        <div style={{ color: "#7da3c2", fontSize: 10 }}>{trace.suggestedRobotReason}</div>
      </div>
      <div
        style={{
          marginBottom: 6,
          color: trace.success ? "#7be3a4" : "#ff7a8c",
        }}
      >
        {trace.success
          ? `CLEARED · ${trace.totalSpent}g · ${trace.finalPortfolio}`
          : `INFEASIBLE @ W${trace.failedAt} · ${trace.totalSpent}g · ${trace.finalPortfolio}`}
      </div>
      {!collapsed &&
        trace.waves.map((w) => (
          <div
            key={w.wave}
            style={{
              borderTop: "1px dashed rgba(255,214,106,0.18)",
              paddingTop: 4,
              marginTop: 4,
            }}
          >
            <div style={{ color: w.cleared ? "#7be3a4" : "#ff7a8c" }}>
              W{w.wave} · {w.archetype} · req {fmtLane(w.reqDpsByLane)} → got{" "}
              {fmtLane(w.dpsAfterByLane)} · {w.goldIn}→{w.goldOut}g
            </div>
            {w.actions.length === 0 ? (
              <div style={{ color: "#7da3c2" }}> (no actions)</div>
            ) : (
              w.actions.map((a, i) => (
                <div key={i} style={{ color: "#cfe5ff" }}>
                  {"  "}
                  {describeAction(a)}
                </div>
              ))
            )}
          </div>
        ))}
    </div>
  );
};
