import type React from "react";
import { LEVELS } from "../levels";
import { getStars, isLevelUnlocked, totalStars } from "../progress";
import { useGame } from "../store";
import { StarDisplay } from "./StarDisplay";

export const WorldMapUI = () => {
  const progress = useGame((s) => s.progress);
  const hoveredLevelId = useGame((s) => s.hoveredLevelId);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);

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
          className="btn btn-ghost self-center pointer-events-auto"
          onClick={() => setCompendiumOpen(true)}
        >
          Compendium
        </button>
        <button
          type="button"
          className="btn btn-ghost self-center pointer-events-auto"
          onClick={() => setAchievementsOpen(true)}
        >
          Achievements
        </button>
      </div>

      {hovered && (
        <div className="absolute left-6 bottom-20 min-w-[280px] bg-surface-2 border border-border-strong rounded-xl px-4 py-3.5 backdrop-blur-md pointer-events-none">
          <div className="flex gap-2.5 items-baseline mb-2.5 pb-2.5 border-b border-[rgba(120,160,200,0.14)]">
            <span className="text-xs font-bold text-gold tracking-mid">#{hovered.id}</span>
            <span className="text-[15px] font-bold text-fg flex-1">{hovered.name}</span>
          </div>
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

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2.5 items-center px-3.5 py-2 text-xs text-fg-muted bg-[rgba(10,16,24,0.6)] border border-[rgba(120,160,200,0.14)] rounded-pill backdrop-blur-sm">
        <span>Click an outpost to deploy</span>
        <span className="opacity-40">·</span>
        <span>Clear a level with 20 lives for 3 stars</span>
      </div>
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
