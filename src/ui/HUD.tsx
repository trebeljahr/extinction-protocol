import { useEffect } from "react";
import { useAudioBridge } from "../audio/useAudioBridge";
import { getLevel } from "../levels";
import type { TowerKind } from "../sim/types";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  TOWER_LABEL,
} from "../sim/world";
import { useGame } from "../store";
import { DamageIcon } from "./DamageIcon";
import { EnemyPanel } from "./EnemyPanel";
import { PauseMenu } from "./PauseMenu";
import { TowerPanel } from "./TowerPanel";
import { TowerPreview } from "./TowerPreview";
import { TreePanel } from "./TreePanel";

const KINDS: TowerKind[] = ["pulse", "chain", "flame", "hive", "mortar", "cryo"];
const HOTKEYS: Record<TowerKind, string> = {
  pulse: "1",
  chain: "2",
  flame: "3",
  hive: "4",
  mortar: "5",
  cryo: "6",
};

export const HUD = () => {
  useAudioBridge();
  // Atomic selectors so a single tick ticking down `nextWaveIn` doesn't
  // re-render the whole tower picker (and its 6 Canvas previews).
  const gold = useGame((s) => s.ui.gold);
  const lives = useGame((s) => s.ui.lives);
  const wave = useGame((s) => s.ui.wave);
  const totalWaves = useGame((s) => s.ui.totalWaves);
  const status = useGame((s) => s.ui.status);
  const waveActive = useGame((s) => s.ui.waveActive);
  const nextWaveIn = useGame((s) => s.ui.nextWaveIn);
  const canCallEarly = useGame((s) => s.ui.canCallEarly);
  const callEarlyBonus = useGame((s) => s.ui.callEarlyBonus);
  const callEarlyTimer = useGame((s) => s.ui.callEarlyTimer);
  const selectedKind = useGame((s) => s.selectedKind);
  const setSelectedKind = useGame((s) => s.setSelectedKind);
  const retry = useGame((s) => s.retryCurrentLevel);
  const togglePause = useGame((s) => s.togglePause);
  const callWaveEarly = useGame((s) => s.callWaveEarly);
  const selectedLevelId = useGame((s) => s.selectedLevelId);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";
  const paused = status === "paused";
  const compendiumOpen = useGame((s) => s.compendiumOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        callWaveEarly();
        return;
      }
      if (e.code === "KeyP") {
        togglePause();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        const s = useGame.getState();
        if (
          s.selectedKind !== null ||
          s.world.selectedTowerId !== null ||
          s.inspectedEnemy.kind !== null ||
          s.selectedTreeId !== null ||
          s.selectedRockId !== null
        ) {
          s.clearSelection();
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        if (s.world.status === "running" || s.world.status === "paused") togglePause();
        (document.activeElement as HTMLElement | null)?.blur();
        return;
      }
      if (e.code === "KeyR") {
        retry();
        return;
      }
      const digit = e.key;
      const kind = (Object.keys(HOTKEYS) as TowerKind[]).find((k) => HOTKEYS[k] === digit);
      if (kind) setSelectedKind(selectedKind === kind ? null : kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, retry, setSelectedKind, selectedKind, callWaveEarly]);

  return (
    <div className="hud">
      <div className="hud-top">
        <Stat label="GOLD" value={gold} accent="#ffd66a" />
        <Stat label="LIVES" value={lives} accent="#ff5a7a" />
        <Stat label="WAVE" value={`${wave} / ${totalWaves}`} accent="#9fd8ff" />
        {wave === 0 ? (
          <button
            type="button"
            className="stat call-wave-btn"
            onClick={callWaveEarly}
            title="Start waves (Space)"
          >
            <div className="stat-label" style={{ color: "#b4ffc9" }}>
              START WAVES [Space]
            </div>
            <div className="stat-value">Ready</div>
          </button>
        ) : canCallEarly ? (
          <button
            type="button"
            className="stat call-wave-btn"
            onClick={callWaveEarly}
            title="Call next wave early (Space)"
          >
            <div className="stat-label" style={{ color: "#b4ffc9" }}>
              CALL WAVE [Space]
            </div>
            <div className="stat-value">
              +{callEarlyBonus}g<span className="call-wave-sub"> · {callEarlyTimer}s</span>
            </div>
          </button>
        ) : (
          <Stat
            label={waveActive ? "WAVE" : "NEXT"}
            value={waveActive ? "ACTIVE" : `${nextWaveIn}s`}
            accent="#b4ffc9"
          />
        )}
        {levelName && (
          <div className="level-badge">
            <div className="level-badge-label">OUTPOST</div>
            <div className="level-badge-name">{levelName}</div>
          </div>
        )}
        <button type="button" className="hud-menu-btn" onClick={togglePause} title="Menu (Esc)">
          <span className="hud-menu-icon" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="hud-menu-label">Menu</span>
          <span className="hud-menu-key">Esc</span>
        </button>
      </div>

      <div className="tower-picker">
        {KINDS.map((kind) => {
          const cost = TOWER_COST[kind];
          const affordable = gold >= cost;
          const active = selectedKind === kind;
          const dmgType = TOWER_DAMAGE_TYPE[kind];
          return (
            <button
              type="button"
              key={kind}
              className={`tower-card ${active ? "active" : ""} ${affordable ? "" : "disabled"}`}
              onClick={(e) => {
                setSelectedKind(selectedKind === kind ? null : kind);
                e.currentTarget.blur();
              }}
              title={`${TOWER_LABEL[kind]} · ${DAMAGE_TYPE_LABEL[dmgType]} · ${cost}g [${HOTKEYS[kind]}]`}
            >
              {active && (
                <span className="card-cancel" aria-hidden>
                  ×
                </span>
              )}
              <div className="tower-preview-wrap">
                <TowerPreview kind={kind} />
                <span className="tower-hot">{HOTKEYS[kind]}</span>
                <span
                  className="tower-dmg-icon"
                  style={{ color: DAMAGE_TYPE_COLOR[dmgType] }}
                  title={DAMAGE_TYPE_LABEL[dmgType]}
                >
                  <DamageIcon type={dmgType} size={13} title={DAMAGE_TYPE_LABEL[dmgType]} />
                </span>
              </div>
              <div className="tower-meta">
                <span className="tower-name">{TOWER_LABEL[kind]}</span>
                <span className="tower-cost">{cost}g</span>
              </div>
            </button>
          );
        })}
      </div>

      <TowerPanel />
      <EnemyPanel />
      <TreePanel />

      {paused && !compendiumOpen && <PauseMenu onResume={togglePause} />}
    </div>
  );
};

const Stat = ({
  label,
  value,
  accent,
}: { label: string; value: string | number; accent: string }) => (
  <div className="stat">
    <div className="stat-label" style={{ color: accent }}>
      {label}
    </div>
    <div className="stat-value">{value}</div>
  </div>
);
