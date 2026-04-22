import { useEffect } from "react";
import { useGame } from "../store";
import type { TowerKind } from "../sim/types";
import { TOWER_COST, TOWER_LABEL, TOWER_DAMAGE_TYPE, DAMAGE_TYPE_LABEL, DAMAGE_TYPE_COLOR } from "../sim/world";
import { getWavePlan, WAVE_ARCHETYPE_LABEL, WAVE_ARCHETYPE_HINT } from "../sim/spawner";
import { useAudioBridge } from "../audio/useAudioBridge";
import { TowerPanel } from "./TowerPanel";
import { audio } from "../audio/AudioManager";

const KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar"];
const HOTKEYS: Record<TowerKind, string> = { pulse: "1", chain: "2", cryo: "3", mortar: "4" };

export const HUD = () => {
  useAudioBridge();
  const ui = useGame(s => s.ui);
  const selectedKind = useGame(s => s.selectedKind);
  const setSelectedKind = useGame(s => s.setSelectedKind);
  const reset = useGame(s => s.reset);
  const togglePause = useGame(s => s.togglePause);
  const callWaveEarly = useGame(s => s.callWaveEarly);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); return; }
      if (e.code === "KeyR") { reset(); return; }
      if (e.code === "KeyM") { audio.setMuted(!audio.isMuted()); return; }
      if (e.code === "KeyN") { callWaveEarly(); return; }
      if (e.code === "Escape") { useGame.getState().clearSelection(); return; }
      const digit = e.key;
      const kind = (Object.keys(HOTKEYS) as TowerKind[]).find(k => HOTKEYS[k] === digit);
      if (kind) setSelectedKind(selectedKind === kind ? null : kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, reset, setSelectedKind, selectedKind, callWaveEarly]);

  const hintWave = ui.waveActive ? ui.wave : Math.min(ui.wave + 1, ui.totalWaves);
  const hintPlan = hintWave > 0 ? getWavePlan(hintWave) : null;
  const archetypeLabel = hintPlan ? WAVE_ARCHETYPE_LABEL[hintPlan.archetype] : "";
  const archetypeHint = hintPlan ? WAVE_ARCHETYPE_HINT[hintPlan.archetype] : "";

  return (
    <div className="hud">
      <div className="hud-top">
        <Stat label="GOLD" value={ui.gold} accent="#ffd66a" />
        <Stat label="LIVES" value={ui.lives} accent="#ff5a7a" />
        <Stat label="WAVE" value={`${ui.wave} / ${ui.totalWaves}`} accent="#9fd8ff" />
        {ui.canCallEarly ? (
          <button className="stat call-wave-btn" onClick={callWaveEarly} title="Call next wave early (N)">
            <div className="stat-label" style={{ color: "#b4ffc9" }}>CALL WAVE [N]</div>
            <div className="stat-value">
              +{ui.callEarlyBonus}g
              {!ui.waveActive && <span className="call-wave-sub"> · {ui.nextWaveIn}s</span>}
            </div>
          </button>
        ) : (
          <Stat
            label={ui.waveActive ? "WAVE" : "NEXT"}
            value={ui.waveActive ? "ACTIVE" : `${ui.nextWaveIn}s`}
            accent="#b4ffc9"
          />
        )}
        {hintPlan && (
          <div className="stat wave-hint">
            <div className="stat-label" style={{ color: "#d8c090" }}>{ui.waveActive ? "THIS" : "NEXT"}</div>
            <div className="stat-value" style={{ fontSize: 14 }}>{archetypeLabel}</div>
            {archetypeHint && <div className="wave-hint-sub">{archetypeHint}</div>}
          </div>
        )}
      </div>

      <div className="tower-picker">
        {KINDS.map(kind => {
          const cost = TOWER_COST[kind];
          const affordable = ui.gold >= cost;
          const active = selectedKind === kind;
          const dmgType = TOWER_DAMAGE_TYPE[kind];
          return (
            <button
              key={kind}
              className={`tower-card ${active ? "active" : ""} ${affordable ? "" : "disabled"}`}
              onClick={() => setSelectedKind(selectedKind === kind ? null : kind)}
            >
              <div className={`tower-swatch kind-${kind}`} />
              <div className="tower-name">{TOWER_LABEL[kind]}</div>
              <div className="tower-dmg" style={{ color: DAMAGE_TYPE_COLOR[dmgType] }}>
                {DAMAGE_TYPE_LABEL[dmgType]}
              </div>
              <div className="tower-cost">{cost}g</div>
              <div className="tower-hot">[{HOTKEYS[kind]}]</div>
            </button>
          );
        })}
      </div>

      <TowerPanel />

      <div className="hud-bottom">
        <span>Click empty tile to build · click a tower to inspect</span>
        <span className="sep">·</span>
        <span>1–4: pick tower</span>
        <span className="sep">·</span>
        <span>Esc: deselect</span>
        <span className="sep">·</span>
        <span>Space: pause</span>
        <span className="sep">·</span>
        <span>R: restart</span>
        <span className="sep">·</span>
        <span>M: mute</span>
        <span className="sep">·</span>
        <span>N: call wave</span>
      </div>

      {ui.status !== "running" && (
        <div className="overlay">
          <div className="overlay-card">
            <h1>
              {ui.status === "won" && "Outpost held."}
              {ui.status === "lost" && "Extinction complete."}
              {ui.status === "paused" && "Paused"}
            </h1>
            {ui.status !== "paused" && (
              <button onClick={reset} className="btn">Run it back (R)</button>
            )}
            {ui.status === "paused" && (
              <button onClick={togglePause} className="btn">Resume (Space)</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({
  label, value, accent,
}: { label: string; value: string | number; accent: string }) => (
  <div className="stat">
    <div className="stat-label" style={{ color: accent }}>{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);
