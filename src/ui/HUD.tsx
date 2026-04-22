import { useEffect } from "react";
import { useGame } from "../store";
import type { TowerKind } from "../sim/types";
import { TOWER_COST, TOWER_LABEL, TOWER_DAMAGE_TYPE, DAMAGE_TYPE_LABEL, DAMAGE_TYPE_COLOR } from "../sim/world";
import { useAudioBridge } from "../audio/useAudioBridge";
import { TowerPanel } from "./TowerPanel";
import { EnemyPanel } from "./EnemyPanel";
import { audio } from "../audio/AudioManager";
import { getLevel } from "../levels";

const KINDS: TowerKind[] = ["pulse", "chain", "cryo", "mortar"];
const HOTKEYS: Record<TowerKind, string> = { pulse: "1", chain: "2", cryo: "3", mortar: "4" };

export const HUD = () => {
  useAudioBridge();
  const ui = useGame(s => s.ui);
  const selectedKind = useGame(s => s.selectedKind);
  const setSelectedKind = useGame(s => s.setSelectedKind);
  const retry = useGame(s => s.retryCurrentLevel);
  const togglePause = useGame(s => s.togglePause);
  const goToWorldMap = useGame(s => s.goToWorldMap);
  const callWaveEarly = useGame(s => s.callWaveEarly);
  const selectedLevelId = useGame(s => s.selectedLevelId);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); return; }
      if (e.code === "KeyR") { retry(); return; }
      if (e.code === "Escape") {
        const s = useGame.getState();
        if (
          s.selectedKind !== null ||
          s.world.selectedTowerId !== null ||
          s.inspectedEnemy.kind !== null
        ) {
          s.clearSelection();
        } else {
          goToWorldMap();
        }
        return;
      }
      if (e.code === "KeyM") { audio.setMuted(!audio.isMuted()); return; }
      if (e.code === "KeyN") { callWaveEarly(); return; }
      const digit = e.key;
      const kind = (Object.keys(HOTKEYS) as TowerKind[]).find(k => HOTKEYS[k] === digit);
      if (kind) setSelectedKind(selectedKind === kind ? null : kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, retry, setSelectedKind, selectedKind, goToWorldMap, callWaveEarly]);

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
        {levelName && (
          <div className="level-badge">
            <div className="level-badge-label">OUTPOST</div>
            <div className="level-badge-name">{levelName}</div>
          </div>
        )}
        <button
          className="btn btn-ghost hud-map-btn"
          onClick={goToWorldMap}
          title="World Map (Esc)"
        >
          World Map
        </button>
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
      <EnemyPanel />

      <div className="hud-bottom">
        <span>Click empty tile to build · click a tower to inspect</span>
        <span className="sep">·</span>
        <span>1–4: pick tower</span>
        <span className="sep">·</span>
        <span>Space: pause</span>
        <span className="sep">·</span>
        <span>R: restart</span>
        <span className="sep">·</span>
        <span>N: call wave</span>
        <span className="sep">·</span>
        <span>Esc: deselect / map</span>
        <span className="sep">·</span>
        <span>M: mute</span>
      </div>

      {ui.status === "paused" && (
        <div className="overlay">
          <div className="overlay-card">
            <h1>Paused</h1>
            <button onClick={togglePause} className="btn">Resume (Space)</button>
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
