import type React from "react";
import { useState } from "react";
import { isDebug } from "../debug";
import { LEVELS } from "../levels";
import { LEVEL_BRIEFING } from "../levels/briefings";
import {
  DIFFICULTY_ACCENT,
  DIFFICULTY_LABEL,
  getStars,
  isLevelUnlocked,
  totalStars,
} from "../progress";
import { useGame } from "../store";
import { DebugMenuSection } from "./DebugMenuSection";
import { DebugWorldMapPanel } from "./DebugWorldMapPanel";
import { DifficultyModelIcon } from "./DifficultyModelIcon";
import { DifficultyTag } from "./DifficultyTag";
import { FullscreenToggle } from "./FullscreenToggle";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";
import { StarDisplay } from "./StarDisplay";

export const WorldMapUI = () => {
  const progress = useGame((s) => s.progress);
  const hoveredLevelId = useGame((s) => s.hoveredLevelId);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);
  const setCreditsOpen = useGame((s) => s.setCreditsOpen);
  const setDifficultyPickerOpen = useGame((s) => s.setDifficultyPickerOpen);
  const goToSlots = useGame((s) => s.goToSlots);
  const [menuOpen, setMenuOpen] = useState(false);
  const difficulty = progress.difficulty;

  const accent = DIFFICULTY_ACCENT[difficulty];

  const hovered = LEVELS.find((l) => l.id === hoveredLevelId) ?? null;
  const hoveredUnlocked = hovered ? isLevelUnlocked(hovered.id, progress) : false;
  const hoveredStars = hovered ? getStars(progress, hovered.id) : 0;

  const total = totalStars(progress);
  const maxTotal = LEVELS.length * 3;
  const completed = LEVELS.filter((l) => getStars(progress, l.id) > 0).length;

  return (
    <div className="hud">
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-xl font-bold tracking-uber text-fg-secondary uppercase">
          Extinction Protocol
        </div>
        <div className="text-xs tracking-[0.3em] text-fg-dim mt-1 uppercase">Select Outpost</div>
      </div>

      <div className="absolute top-6 right-6 flex gap-2.5 items-stretch pointer-events-none flex-wrap justify-end max-w-[calc(50vw-200px)]">
        <MetaChip label="TOTAL STARS" value={total} max={maxTotal} />
        <MetaChip label="OUTPOSTS" value={completed} max={LEVELS.length} />
        <button
          type="button"
          className={`${accent.tint} border ${accent.border} rounded-md px-3 py-1.5 backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:brightness-110`}
          onClick={() => setDifficultyPickerOpen(true)}
          aria-label="Change difficulty"
          title="Change difficulty"
        >
          <DifficultyTag difficulty={difficulty} />
        </button>
        <button
          type="button"
          className="bg-surface-1 border border-border rounded-md px-3.5 py-2 backdrop-blur-sm flex items-center gap-2.5 pointer-events-auto cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
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
          <div className="max-h-[75vh] overflow-y-auto pr-1 -mr-2">
            <SoundControls />
            <FullscreenToggle />
            <div className="flex flex-col gap-2">
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
        <div className="absolute left-6 bottom-20 min-w-[280px] max-w-[340px] bg-surface-2 border border-border-strong rounded-xl px-4 py-3.5 backdrop-blur-md pointer-events-none">
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
  <div className="bg-surface-1 border border-border rounded-md px-3.5 py-2 min-w-[110px] backdrop-blur-sm">
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
