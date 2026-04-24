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
      <div className="worldmap-header">
        <div className="worldmap-title">Extinction Protocol</div>
        <div className="worldmap-subtitle">Select Outpost</div>
      </div>

      <div className="worldmap-meta">
        <div className="meta-chip">
          <div className="meta-label">TOTAL STARS</div>
          <div className="meta-value">
            {total} <span className="meta-dim">/ {maxTotal}</span>
          </div>
        </div>
        <div className="meta-chip">
          <div className="meta-label">OUTPOSTS</div>
          <div className="meta-value">
            {completed} <span className="meta-dim">/ {LEVELS.length}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost worldmap-compendium-btn"
          onClick={() => setCompendiumOpen(true)}
        >
          Compendium
        </button>
        <button
          type="button"
          className="btn btn-ghost worldmap-compendium-btn"
          onClick={() => setAchievementsOpen(true)}
        >
          Achievements
        </button>
      </div>

      {hovered && (
        <div className="worldmap-tooltip">
          <div className="tip-head">
            <span className="tip-id">#{hovered.id}</span>
            <span className="tip-name">{hovered.name}</span>
          </div>
          <div className="tip-row">
            <span>Waves</span>
            <span>{hovered.waves.length}</span>
          </div>
          <div className="tip-row">
            <span>Starting gold</span>
            <span>{hovered.startGold}g</span>
          </div>
          <div className="tip-row">
            <span>Best</span>
            <span>
              {hoveredUnlocked ? (
                <StarDisplay count={hoveredStars} size={14} />
              ) : (
                "\u{1F512} Locked"
              )}
            </span>
          </div>
          {hoveredUnlocked && <div className="tip-cta">Click to deploy</div>}
        </div>
      )}

      <div className="hud-bottom">
        <span>Click an outpost to deploy</span>
        <span className="sep">·</span>
        <span>Clear a level with 20 lives for 3 stars</span>
      </div>
    </div>
  );
};
