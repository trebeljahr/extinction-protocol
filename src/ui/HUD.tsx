import { useEffect, useState } from "react";
import { getLevel, getLevelOrdinal } from "../levels";
import { DIFFICULTY_ACCENT, DIFFICULTY_LABEL } from "../progress";
import { effectiveTowerCost } from "../sim/metaSkills";
import type { TowerKind } from "../sim/types";
import { DAMAGE_TYPE_COLOR, DAMAGE_TYPE_LABEL, TOWER_DAMAGE_TYPE, TOWER_LABEL } from "../sim/world";
import { useGame } from "../store";
import { BasePanel } from "./BasePanel";
import { BossBanner } from "./BossBanner";
import { DamageIcon } from "./DamageIcon";
import { DifficultyTag } from "./DifficultyTag";
import { EnemyPanel } from "./EnemyPanel";
import { HeroPanel } from "./HeroPanel";
import { IconCog } from "./MenuIcons";
import { PauseMenu } from "./PauseMenu";
import { QuickSettings } from "./QuickSettings";
import { TowerPanel } from "./TowerPanel";
import { prewarmTowerIcons, TowerPreview } from "./TowerPreview";
import { TreePanel } from "./TreePanel";
import { useKeyboardHintsVisible } from "./useInputMode";
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
  const pendingTouchPlacement = useGame((s) => s.pendingTouchPlacement);
  const togglePause = useGame((s) => s.togglePause);
  const callWaveEarly = useGame((s) => s.callWaveEarly);
  const selectedLevelId = useGame((s) => s.selectedLevelId);
  const difficulty = useGame((s) => s.progress.difficulty);
  const setDifficultyPickerOpen = useGame((s) => s.setDifficultyPickerOpen);
  const progress = useGame((s) => s.progress);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";
  const levelOrdinal = selectedLevelId ? getLevelOrdinal(selectedLevelId) : null;
  const levelOrdinalLabel = levelOrdinal ? `${levelOrdinal.current}/${levelOrdinal.total}` : "";
  const difficultyAccent = DIFFICULTY_ACCENT[difficulty];
  const paused = status === "paused";
  const waveStatus =
    wave >= totalWaves ? `${wave} / ${totalWaves}` : waveActive ? "ACTIVE" : `${nextWaveIn}s`;
  const levelIntroVisible = useGame((s) => s.levelIntroVisible);
  const compendiumOpen = useGame((s) => s.compendiumOpen);
  // NewEnemyAlert auto-pauses the world but the pause-menu screen
  // should NOT render underneath it — the dossier is its own modal.
  const newEnemyAlertVisible = useGame((s) => s.newEnemyQueue.length > 0);
  const selectedTowerId = useGame((s) => s.ui.selectedTowerId);
  const inspectedEnemyKind = useGame((s) => s.ui.inspectedEnemyKind);
  const selectedTreeId = useGame((s) => s.selectedTreeId);
  const selectedRockId = useGame((s) => s.selectedRockId);
  const isMobile = useIsMobile();
  const showKeyboardHints = useKeyboardHintsVisible();
  // On mobile the picker collapses to a small handle to free up the
  // canvas. Auto-closes on selection (one less tap to start placing)
  // and re-opens via the handle. On desktop the picker is always
  // visible — `pickerOpen` is ignored in that branch.
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (selectedKind !== null) setPickerOpen(false);
  }, [selectedKind]);

  // Bake all six tower thumbnails as soon as the HUD mounts so the
  // mobile build drawer doesn't flash empty placeholders the first
  // time the player taps the build handle. No-op on desktop too —
  // bakes are idempotent, so this just warms a cache that the always-
  // visible picker would have filled anyway.
  useEffect(() => {
    prewarmTowerIcons();
  }, []);

  useEffect(() => {
    if (
      selectedTowerId !== null ||
      inspectedEnemyKind !== null ||
      selectedTreeId !== null ||
      selectedRockId !== null
    ) {
      setPickerOpen(false);
    }
  }, [selectedTowerId, inspectedEnemyKind, selectedTreeId, selectedRockId]);

  useEffect(() => {
    const cls = "mobile-build-menu-open";
    if (isMobile && pickerOpen) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [isMobile, pickerOpen]);

  // Tap outside the open mobile picker → close it. Tower selection
  // already auto-closes via the selectedKind effect above; this covers
  // the "tap the canvas/HUD to dismiss" case so the drawer doesn't
  // strand itself open after a misfire. Desktop ignores pickerOpen so
  // skip the listener entirely there.
  useEffect(() => {
    if (!isMobile || !pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".tower-picker, .tower-picker-handle")) return;
      setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMobile, pickerOpen]);

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
          s.selectedRockId !== null ||
          s.world.hero.selected
        ) {
          s.clearSelection();
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        if (s.world.status === "running" || s.world.status === "paused") togglePause();
        (document.activeElement as HTMLElement | null)?.blur();
        return;
      }
      if (e.code === "KeyZ") {
        e.preventDefault();
        useGame.getState().triggerHeroAbility(0);
        return;
      }
      if (e.code === "KeyX") {
        e.preventDefault();
        useGame.getState().triggerHeroAbility(1);
        return;
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        useGame.getState().triggerHeroAbility(2);
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
            title={showKeyboardHints ? "Start waves (Space)" : "Start waves"}
          >
            <div className="stat-label text-mint">
              START WAVES <span className="kbd-only">[Space]</span>
            </div>
            <div className="stat-value">Ready</div>
          </button>
        ) : canCallEarly ? (
          <button
            type="button"
            className="stat call-wave-btn"
            onClick={callWaveEarly}
            title={showKeyboardHints ? "Call next wave early (Space)" : "Call next wave early"}
          >
            <div className="stat-label text-mint">
              CALL NEXT WAVE <span className="kbd-only">[Space]</span>
            </div>
            <div className="stat-value">
              +{callEarlyBonus}g<span className="call-wave-sub"> · {callEarlyTimer}s</span>
            </div>
          </button>
        ) : (
          <Stat
            label={wave >= totalWaves ? "FINAL WAVE" : waveActive ? "WAVE" : "NEXT"}
            value={waveStatus}
            accentClass="text-mint"
          />
        )}
        {levelName && (
          <div className="outpost-pill">
            <div className="outpost-label">OUTPOST</div>
            <div className="outpost-name" title={`${levelOrdinalLabel} · ${levelName}`}>
              <span className="outpost-progress">{levelOrdinalLabel}</span>
              <span className="outpost-separator"> · </span>
              <span>{levelName}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setDifficultyPickerOpen(true)}
          className={`${difficultyAccent.tint} border ${difficultyAccent.border} rounded-md px-2.5 py-2 backdrop-blur-sm flex items-center gap-2 cursor-pointer font-[inherit] text-fg transition-colors hover:border-border-strong`}
          title={`Difficulty · ${DIFFICULTY_LABEL[difficulty]} · Change`}
          aria-label="Change difficulty"
        >
          <DifficultyTag difficulty={difficulty} label="Mode" size="sm" />
        </button>
      </div>

      <div className="hud-corner-cluster absolute top-4 right-4 flex items-center gap-1.5">
        <QuickSettings />
        <button
          type="button"
          className="hud-menu-btn"
          onClick={togglePause}
          aria-label="Open menu"
          title={showKeyboardHints ? "Menu (Esc)" : "Menu"}
        >
          <IconCog size={18} />
          <span className="kbd-only text-[10px] font-bold tracking-wide px-1.5 py-0.5 border border-[rgba(159,216,255,0.35)] rounded-sm text-blue bg-tint-blue-soft uppercase">
            Esc
          </span>
        </button>
      </div>

      {isMobile && !pickerOpen && selectedKind === null && (
        <button
          type="button"
          className="tower-picker-handle"
          onClick={() => {
            // Treat opening the build drawer as "leave inspection mode"
            // first so tower/tree/enemy panels don't fight the picker.
            useGame.getState().clearSelection();
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
        </button>
      )}

      {isMobile && !pickerOpen && selectedKind !== null && (
        <button
          type="button"
          className="tower-picker-handle tower-picker-handle-cancel"
          onClick={() => useGame.getState().clearSelection()}
          aria-label={`Cancel placing ${TOWER_LABEL[selectedKind]}`}
          title="Cancel placement"
          data-ui-sound="close"
        >
          <span className="tower-picker-handle-cancel-icon" aria-hidden>
            ×
          </span>
          <span className="tower-picker-handle-label">Cancel</span>
          <span className="tower-picker-handle-active">{TOWER_LABEL[selectedKind]}</span>
        </button>
      )}

      {isMobile && !pickerOpen && selectedKind !== null && pendingTouchPlacement !== null && (
        <button
          type="button"
          className="tower-picker-handle tower-picker-handle-confirm"
          onClick={() => useGame.getState().confirmTouchPlacement()}
          aria-label={`Confirm placing ${TOWER_LABEL[selectedKind]}`}
          title="Confirm placement"
          data-ui-sound="select"
        >
          <span className="tower-picker-handle-confirm-icon" aria-hidden>
            ✓
          </span>
          <span className="tower-picker-handle-label">Place</span>
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
            const cost = effectiveTowerCost(kind, progress.metaSkills);
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
                title={`${TOWER_LABEL[kind]} · ${DAMAGE_TYPE_LABEL[dmgType]} · ${cost}g${showKeyboardHints ? ` [${HOTKEYS[kind]}]` : ""}`}
              >
                {active && (
                  <span className="card-cancel" aria-hidden>
                    ×
                  </span>
                )}
                <div className="tower-preview-wrap">
                  <TowerPreview kind={kind} />
                  <span className="tower-hot kbd-only">{HOTKEYS[kind]}</span>
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
      <BasePanel />
      <EnemyPanel />
      <TreePanel />
      <HeroPanel />
      <BossBanner />

      {paused && !compendiumOpen && !levelIntroVisible && !newEnemyAlertVisible && (
        <PauseMenu onResume={togglePause} />
      )}
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
