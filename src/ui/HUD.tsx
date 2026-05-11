import { useEffect, useState } from "react";
import { useAudioBridge } from "../audio/useAudioBridge";
import { getLevel } from "../levels";
import { DIFFICULTY_ACCENT, DIFFICULTY_LABEL } from "../progress";
import type { TowerKind } from "../sim/types";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_LABEL,
  TOWER_COST,
  TOWER_DAMAGE_TYPE,
  TOWER_LABEL,
} from "../sim/world";
import { useGame } from "../store";
import { BossBanner } from "./BossBanner";
import { DamageIcon } from "./DamageIcon";
import { DifficultyIcon } from "./DifficultyIcon";
import { EnemyPanel } from "./EnemyPanel";
import { PauseMenu } from "./PauseMenu";
import { TowerPanel } from "./TowerPanel";
import { TowerPreview } from "./TowerPreview";
import { TreePanel } from "./TreePanel";
import { useIsMobile } from "./useMediaQuery";

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
  const togglePause = useGame((s) => s.togglePause);
  const callWaveEarly = useGame((s) => s.callWaveEarly);
  const selectedLevelId = useGame((s) => s.selectedLevelId);
  const difficulty = useGame((s) => s.progress.difficulty);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";
  const difficultyAccent = DIFFICULTY_ACCENT[difficulty];
  const paused = status === "paused";
  const levelIntroVisible = useGame((s) => s.levelIntroVisible);
  const compendiumOpen = useGame((s) => s.compendiumOpen);
  const isMobile = useIsMobile();
  // On mobile the picker collapses to a small handle to free up the
  // canvas. Auto-closes on selection (one less tap to start placing)
  // and re-opens via the handle. On desktop the picker is always
  // visible — `pickerOpen` is ignored in that branch.
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (selectedKind !== null) setPickerOpen(false);
  }, [selectedKind]);

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
      const digit = e.key;
      const kind = (Object.keys(HOTKEYS) as TowerKind[]).find((k) => HOTKEYS[k] === digit);
      if (kind) setSelectedKind(selectedKind === kind ? null : kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, setSelectedKind, selectedKind, callWaveEarly]);

  return (
    <div className="hud">
      <div className="hud-top">
        <Stat label="GOLD" value={gold} accentClass="text-gold" />
        <Stat label="LIVES" value={lives} accentClass="text-red" />
        <Stat label="WAVE" value={`${wave} / ${totalWaves}`} accentClass="text-blue" />
        {wave === 0 ? (
          <button
            type="button"
            className="stat call-wave-btn"
            onClick={callWaveEarly}
            title="Start waves (Space)"
          >
            <div className="stat-label text-mint">START WAVES [Space]</div>
            <div className="stat-value">Ready</div>
          </button>
        ) : canCallEarly ? (
          <button
            type="button"
            className="stat call-wave-btn"
            onClick={callWaveEarly}
            title="Call next wave early (Space)"
          >
            <div className="stat-label text-mint">CALL WAVE [Space]</div>
            <div className="stat-value">
              +{callEarlyBonus}g<span className="call-wave-sub"> · {callEarlyTimer}s</span>
            </div>
          </button>
        ) : (
          <Stat
            label={waveActive ? "WAVE" : "NEXT"}
            value={waveActive ? "ACTIVE" : `${nextWaveIn}s`}
            accentClass="text-mint"
          />
        )}
        {levelName && (
          <div className="bg-surface-1 border border-border rounded-md px-3.5 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-bold tracking-wide text-blue">OUTPOST</div>
            <div className="text-[15px] font-bold mt-0.5 whitespace-nowrap">{levelName}</div>
          </div>
        )}
        <div
          className={`${difficultyAccent.tint} border ${difficultyAccent.border} rounded-md px-2.5 py-2 backdrop-blur-sm flex items-center gap-2`}
          title={`Difficulty · ${DIFFICULTY_LABEL[difficulty]}`}
        >
          <DifficultyIcon difficulty={difficulty} className={`w-6 h-6 ${difficultyAccent.text}`} />
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-wide text-gold uppercase">Mode</span>
            <span className={`text-[13px] font-bold leading-tight ${difficultyAccent.text}`}>
              {DIFFICULTY_LABEL[difficulty]}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="hud-menu-btn absolute top-4 right-4"
        onClick={togglePause}
        title="Menu (Esc)"
      >
        <span
          className="inline-flex flex-col justify-between w-[18px] h-[14px] [&>span]:block [&>span]:h-0.5 [&>span]:w-full [&>span]:bg-current [&>span]:rounded-[1px]"
          aria-hidden
        >
          <span />
          <span />
          <span />
        </span>
        <span className="text-sm uppercase">Menu</span>
        <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 border border-[rgba(159,216,255,0.35)] rounded-sm text-blue bg-tint-blue-soft uppercase">
          Esc
        </span>
      </button>

      {isMobile && !pickerOpen && (
        <button
          type="button"
          className="tower-picker-handle"
          onClick={() => {
            // Tapping the handle opens the picker. If a kind is currently
            // selected for placement, treat the same tap as "cancel
            // placement and pick a different tower" — clear the selection
            // so the user isn't surprised by stale ghost cursors.
            if (selectedKind !== null) setSelectedKind(null);
            setPickerOpen(true);
          }}
          aria-expanded={false}
          aria-label="Open build menu"
          title="Build"
        >
          <span className="tower-picker-handle-icon" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="tower-picker-handle-label">Build</span>
          {selectedKind && (
            <span className="tower-picker-handle-active">{TOWER_LABEL[selectedKind]}</span>
          )}
        </button>
      )}

      {(!isMobile || pickerOpen) && (
        <div className={`tower-picker ${isMobile ? "tower-picker-mobile-open" : ""}`}>
          {isMobile && (
            <button
              type="button"
              className="tower-picker-close"
              onClick={() => setPickerOpen(false)}
              aria-label="Close build menu"
              title="Close"
            >
              ×
            </button>
          )}
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
                data-ui-sound={active ? "close" : !affordable ? "error" : "select"}
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
                </div>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <span
                    className="inline-flex items-center"
                    style={{ color: DAMAGE_TYPE_COLOR[dmgType] }}
                    title={DAMAGE_TYPE_LABEL[dmgType]}
                  >
                    <DamageIcon type={dmgType} size={13} title={DAMAGE_TYPE_LABEL[dmgType]} />
                  </span>
                  <span className="tower-cost text-[11px] font-bold tabular-nums text-gold">
                    {cost}g
                  </span>
                </div>
                <div className="tower-name text-[10px] font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis text-center">
                  {TOWER_LABEL[kind]}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TowerPanel />
      <EnemyPanel />
      <TreePanel />
      <BossBanner />

      {paused && !compendiumOpen && !levelIntroVisible && <PauseMenu onResume={togglePause} />}
    </div>
  );
};

const Stat = ({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string | number;
  accentClass: string;
}) => (
  <div className="stat">
    <div className={`stat-label ${accentClass}`}>{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);
