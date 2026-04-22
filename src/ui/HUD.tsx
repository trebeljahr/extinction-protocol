import { useEffect } from "react";
import { useGame } from "../store";
import type { TowerKind } from "../sim/types";
import { TOWER_COST, TOWER_LABEL, TOWER_DAMAGE_TYPE, DAMAGE_TYPE_LABEL, DAMAGE_TYPE_COLOR } from "../sim/world";
import { useAudioBridge } from "../audio/useAudioBridge";
import { TowerPanel } from "./TowerPanel";
import { TowerPreview } from "./TowerPreview";
import { EnemyPanel } from "./EnemyPanel";
import { PauseMenu } from "./PauseMenu";
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
  const callWaveEarly = useGame(s => s.callWaveEarly);
  const selectedLevelId = useGame(s => s.selectedLevelId);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";
  const paused = ui.status === "paused";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); callWaveEarly(); return; }
      if (e.code === "KeyP") { togglePause(); return; }
      if (e.code === "Escape") {
        e.preventDefault();
        const s = useGame.getState();
        if (s.world.status === "running" || s.world.status === "paused") togglePause();
        (document.activeElement as HTMLElement | null)?.blur();
        return;
      }
      if (e.code === "KeyR") { retry(); return; }
      const digit = e.key;
      const kind = (Object.keys(HOTKEYS) as TowerKind[]).find(k => HOTKEYS[k] === digit);
      if (kind) setSelectedKind(selectedKind === kind ? null : kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, retry, setSelectedKind, selectedKind, callWaveEarly]);

  return (
    <div className="hud">
      <div className="hud-top">
        <Stat label="GOLD" value={ui.gold} accent="#ffd66a" />
        <Stat label="LIVES" value={ui.lives} accent="#ff5a7a" />
        <Stat label="WAVE" value={`${ui.wave} / ${ui.totalWaves}`} accent="#9fd8ff" />
        {ui.wave === 0 ? (
          <button className="stat call-wave-btn" onClick={callWaveEarly} title="Start waves (Space)">
            <div className="stat-label" style={{ color: "#b4ffc9" }}>START WAVES [Space]</div>
            <div className="stat-value">Ready</div>
          </button>
        ) : ui.canCallEarly ? (
          <button className="stat call-wave-btn" onClick={callWaveEarly} title="Call next wave early (Space)">
            <div className="stat-label" style={{ color: "#b4ffc9" }}>CALL WAVE [Space]</div>
            <div className="stat-value">
              +{ui.callEarlyBonus}g
              <span className="call-wave-sub"> · {ui.callEarlyTimer}s</span>
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
          onClick={togglePause}
          title="Menu (Esc)"
        >
          Menu
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
              onClick={(e) => {
                setSelectedKind(selectedKind === kind ? null : kind);
                e.currentTarget.blur();
              }}
            >
              {active && (
                <span
                  className="card-cancel"
                  role="button"
                  aria-label="cancel selection"
                  onClick={(e) => { e.stopPropagation(); setSelectedKind(null); }}
                >×</span>
              )}
              <TowerPreview kind={kind} />
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
        <span>Click empty tile to build · click a tower to inspect · click a tree to clear (8g)</span>
        <span className="sep">·</span>
        <span>1–4: pick tower</span>
        <span className="sep">·</span>
        <span>Space: call wave</span>
        <span className="sep">·</span>
        <span>P: pause</span>
        <span className="sep">·</span>
        <span>R: restart</span>
        <span className="sep">·</span>
        <span>Esc: menu</span>
      </div>

      {paused && <PauseMenu onResume={togglePause} />}
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
