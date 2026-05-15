import type React from "react";
import { useRef, useState } from "react";
import { audio } from "../audio/AudioManager";
import { isDebug } from "../debug";
import { type GamepadInputFrame, snapGamepadDirection, useGamepadInput } from "../input/gamepad";
import { useGamepadMenuNavigation } from "../input/useGamepadMenuNavigation";
import { LEVELS } from "../levels";
import { LEVEL_BRIEFING } from "../levels/briefings";
import {
  DIFFICULTY_ACCENT,
  DIFFICULTY_LABEL,
  getStars,
  isLevelUnlocked,
  totalStars,
} from "../progress";
import { spentMetaStars } from "../sim/metaSkills";
import { useGame } from "../store";
import { DebugMenuSection } from "./DebugMenuSection";
import { DebugWorldMapPanel } from "./DebugWorldMapPanel";
import { DifficultyModelIcon } from "./DifficultyModelIcon";
import { DifficultyTag } from "./DifficultyTag";
import { FullscreenToggle } from "./FullscreenToggle";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";
import { StarDisplay } from "./StarDisplay";

const WORLD_MAP_NAV_INITIAL_REPEAT_MS = 320;
const WORLD_MAP_NAV_REPEAT_MS = 140;

const gamepadMenuDirection = (frame: GamepadInputFrame): -1 | 0 | 1 => {
  const dpadX = Number(frame.buttonDown("right")) - Number(frame.buttonDown("left"));
  const dpadY = Number(frame.buttonDown("down")) - Number(frame.buttonDown("up"));
  const stickX = snapGamepadDirection(frame.axis("leftX"));
  const stickY = snapGamepadDirection(frame.axis("leftY"));
  const x = dpadX || stickX;
  const y = dpadY || stickY;

  if (Math.abs(x) >= Math.abs(y) && x !== 0) return x > 0 ? 1 : -1;
  if (y !== 0) return y > 0 ? 1 : -1;
  return 0;
};

export const WorldMapUI = () => {
  const progress = useGame((s) => s.progress);
  const hoveredLevelId = useGame((s) => s.hoveredLevelId);
  const startLevel = useGame((s) => s.startLevel);
  const setHoveredLevel = useGame((s) => s.setHoveredLevel);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);
  const setCreditsOpen = useGame((s) => s.setCreditsOpen);
  const setDifficultyPickerOpen = useGame((s) => s.setDifficultyPickerOpen);
  const setSkillTreeOpen = useGame((s) => s.setSkillTreeOpen);
  const goToSlots = useGame((s) => s.goToSlots);
  const [menuOpen, setMenuOpen] = useState(false);
  const difficulty = progress.difficulty;
  const navRepeatRef = useRef<{ direction: -1 | 1 | 0; nextAt: number }>({
    direction: 0,
    nextAt: 0,
  });

  const accent = DIFFICULTY_ACCENT[difficulty];

  const hovered = LEVELS.find((l) => l.id === hoveredLevelId) ?? null;
  const hoveredUnlocked = hovered ? isLevelUnlocked(hovered.id, progress) : false;
  const hoveredStars = hovered ? getStars(progress, hovered.id) : 0;

  const total = totalStars(progress);
  const maxTotal = LEVELS.length * 3;
  const completed = LEVELS.filter((l) => getStars(progress, l.id) > 0).length;
  const availableStars = Math.max(0, total - spentMetaStars(progress.metaSkills));

  useGamepadMenuNavigation(menuOpen);

  useGamepadInput((frame) => {
    if (!frame.gamepad || menuOpen) return;

    const unlocked = LEVELS.filter((level) => isLevelUnlocked(level.id, progress));
    const fallback = unlocked[0];

    const direction = gamepadMenuDirection(frame);
    if (direction === 0) {
      navRepeatRef.current = { direction: 0, nextAt: 0 };
    } else if (unlocked.length > 0) {
      const repeat = navRepeatRef.current;
      if (direction !== repeat.direction || frame.timestamp >= repeat.nextAt) {
        const currentIndex = unlocked.findIndex((level) => level.id === hoveredLevelId);
        const nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + direction + unlocked.length) % unlocked.length;
        setHoveredLevel(unlocked[nextIndex].id);
        navRepeatRef.current = {
          direction,
          nextAt:
            frame.timestamp +
            (direction === repeat.direction
              ? WORLD_MAP_NAV_REPEAT_MS
              : WORLD_MAP_NAV_INITIAL_REPEAT_MS),
        };
      }
    }

    if (frame.buttonPressed("a")) {
      const target = LEVELS.find((level) => level.id === hoveredLevelId) ?? fallback;
      if (!target || !isLevelUnlocked(target.id, progress)) return;
      audio.ensureResumed();
      audio.play("level-select", "ui", 0.7, 80);
      startLevel(target.id);
      return;
    }

    if (frame.buttonPressed("b") || frame.buttonPressed("start")) setMenuOpen(true);
  });

  return (
    <div className="hud">
      <div className="world-map-title absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-xl font-bold tracking-uber text-fg-secondary uppercase">
          Extinction Protocol
        </div>
        <div className="text-xs tracking-[0.3em] text-fg-dim mt-1 uppercase">Select Outpost</div>
      </div>

      <div className="world-map-actions absolute top-6 right-6 flex gap-2.5 items-stretch pointer-events-none flex-wrap justify-end max-w-[calc(50vw-200px)]">
        <MetaChip label="TOTAL STARS" value={total} max={maxTotal} />
        <MetaChip label="OUTPOSTS" value={completed} max={LEVELS.length} />
        <button
          type="button"
          className="world-map-utility-btn bg-surface-1 border border-gold/40 rounded-md px-3.5 py-2 backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-gold hover:text-white"
          onClick={() => setSkillTreeOpen(true)}
          aria-label="Open tower R&D"
          title={
            availableStars > 0
              ? `Tower R&D — ${availableStars} star${availableStars === 1 ? "" : "s"} unspent`
              : "Tower R&D"
          }
        >
          <span className="text-base leading-none">★</span>
          <span className="text-sm font-bold tracking-wide uppercase">R&amp;D</span>
          {availableStars > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-gold text-bg text-[11px] font-bold tabular-nums">
              {availableStars}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`world-map-utility-btn ${accent.tint} border ${accent.border} rounded-md px-3 py-1.5 backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:brightness-110`}
          onClick={() => setDifficultyPickerOpen(true)}
          aria-label="Change difficulty"
          title="Change difficulty"
        >
          <DifficultyTag difficulty={difficulty} />
        </button>
        <button
          type="button"
          className="world-map-utility-btn bg-surface-1 border border-border rounded-md px-3.5 py-2 backdrop-blur-sm flex items-center gap-2.5 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          title="Menu"
        >
          <span
            className="inline-flex flex-col justify-between w-[18px] h-[14px] [&>span]:block [&>span]:h-0.5 [&>span]:w-full [&>span]:bg-current [&>span]:rounded-[1px]"
            aria-hidden
          >
            <span />
            <span />
            <span />
          </span>
          <span className="text-sm font-bold tracking-wide uppercase">Menu</span>
        </button>
      </div>

      {menuOpen && (
        <MenuOverlay title="Menu" onClose={() => setMenuOpen(false)}>
          <div className="menu-panel-scroll">
            <SoundControls />
            <FullscreenToggle />
            <div className="menu-panel-actions">
              <button
                type="button"
                className="btn btn-ghost w-full flex items-center justify-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  setDifficultyPickerOpen(true);
                }}
              >
                <DifficultyModelIcon difficulty={difficulty} className="w-5 h-5 shrink-0" />
                Difficulty · {DIFFICULTY_LABEL[difficulty]}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setMenuOpen(false);
                  setSkillTreeOpen(true);
                }}
              >
                Tower R&amp;D {availableStars > 0 ? `(${availableStars}★)` : ""}
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setMenuOpen(false);
                  setCompendiumOpen(true);
                }}
              >
                Compendium
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setMenuOpen(false);
                  setAchievementsOpen(true);
                }}
              >
                Achievements
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setMenuOpen(false);
                  setCreditsOpen(true);
                }}
              >
                Credits
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => {
                  setMenuOpen(false);
                  goToSlots();
                }}
              >
                Change save slot
              </button>
            </div>
            {isDebug && (
              <div className="mt-5">
                <DebugMenuSection />
              </div>
            )}
          </div>
        </MenuOverlay>
      )}

      {hovered && (
        <div className="world-map-hover-card absolute left-6 bottom-20 min-w-[280px] max-w-[340px] bg-surface-2 border border-border-strong rounded-xl px-4 py-3.5 backdrop-blur-md pointer-events-none">
          <div className="flex gap-2.5 items-baseline mb-2.5 pb-2.5 border-b border-[rgba(120,160,200,0.14)]">
            <span className="text-xs font-bold text-gold tracking-mid">#{hovered.id}</span>
            <span className="text-[15px] font-bold text-fg flex-1">{hovered.name}</span>
          </div>
          {hoveredUnlocked && LEVEL_BRIEFING[hovered.id] && (
            <p className="text-[11px] leading-snug text-fg-muted italic mb-2.5 pb-2.5 border-b border-[rgba(120,160,200,0.14)]">
              {LEVEL_BRIEFING[hovered.id]}
            </p>
          )}
          <TipRow label="Waves" value={hovered.waves.length} />
          <TipRow label="Starting gold" value={`${hovered.startGold}g`} />
          <TipRow
            label="Best"
            value={
              hoveredUnlocked ? <StarDisplay count={hoveredStars} size={14} /> : "\u{1F512} Locked"
            }
          />
          {hoveredUnlocked && (
            <div className="mt-2.5 pt-2.5 border-t border-[rgba(120,160,200,0.14)] text-[11px] text-cyan tracking-wide uppercase text-center">
              Click to deploy
            </div>
          )}
        </div>
      )}

      {isDebug && <DebugWorldMapPanel />}
    </div>
  );
};

const MetaChip = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div className="world-map-meta bg-surface-1 border border-border rounded-md px-3.5 py-2 min-w-[110px] backdrop-blur-sm">
    <div className="text-[10px] font-bold tracking-wide text-gold">{label}</div>
    <div className="text-xl font-bold mt-0.5 tabular-nums">
      {value} <span className="text-fg-faint text-sm font-medium">/ {max}</span>
    </div>
  </div>
);

const TipRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center text-xs text-fg-muted my-1.5">
    <span>{label}</span>
    <span className="text-fg font-semibold inline-flex items-center">{value}</span>
  </div>
);
