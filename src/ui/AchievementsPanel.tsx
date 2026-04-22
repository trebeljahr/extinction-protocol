import { useEffect } from "react";
import { useGame } from "../store";
import { ACHIEVEMENTS, isAchievementUnlocked, totalUnlocked } from "../achievements";

export const AchievementsPanel = () => {
  const progress = useGame(s => s.progress);
  const setAchievementsOpen = useGame(s => s.setAchievementsOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAchievementsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setAchievementsOpen]);

  const unlockedCount = totalUnlocked(progress);

  return (
    <div className="overlay achievements-overlay">
      <div className="achievements-card">
        <header className="achievements-header">
          <div>
            <h1>Achievements</h1>
            <div className="achievements-subtitle">
              {unlockedCount} / {ACHIEVEMENTS.length} unlocked
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setAchievementsOpen(false)}>
            Close (Esc)
          </button>
        </header>

        <div className="achievements-grid">
          {ACHIEVEMENTS.map(def => {
            const unlocked = isAchievementUnlocked(progress, def.id);
            const ts = progress.unlocked[def.id];
            const secrecy = def.secrecy ?? "visible";
            const hideName = !unlocked && secrecy !== "visible";
            const hideDesc = !unlocked && secrecy !== "visible";
            const hideHint = !unlocked && secrecy === "hidden";
            const statusLabel = unlocked
              ? "UNLOCKED"
              : secrecy === "hidden"
                ? "???"
                : secrecy === "hint"
                  ? "SECRET"
                  : "LOCKED";
            return (
              <div
                key={def.id}
                className={`achievement-tile ${unlocked ? "unlocked" : "locked"} secrecy-${secrecy}`}
              >
                <div className="achievement-tile-status">{statusLabel}</div>
                <div className="achievement-tile-name">
                  {hideName ? "???" : def.name}
                </div>
                <div className="achievement-tile-desc">
                  {hideDesc ? "???" : def.desc}
                </div>
                <div className="achievement-tile-hint">
                  {hideHint ? "???" : def.hint}
                </div>
                {unlocked && ts && (
                  <div className="achievement-tile-date">
                    {new Date(ts).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
