import { useEffect } from "react";
import { ACHIEVEMENTS, isAchievementUnlocked, totalUnlocked } from "../achievements";
import { audio } from "../audio/AudioManager";
import { useGame } from "../store";
import { IconHiddenAchievement } from "./AchievementIcons";

export const AchievementsPanel = () => {
  const progress = useGame((s) => s.progress);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);

  useEffect(() => {
    audio.ui("click");
  }, []);

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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAchievementsOpen(false)}
          >
            Close (Esc)
          </button>
        </header>

        <div className="achievements-grid">
          {ACHIEVEMENTS.map((def) => {
            const unlocked = isAchievementUnlocked(progress, def.id);
            const secrecy = def.secrecy ?? "visible";
            const hideName = !unlocked && secrecy !== "visible";
            const hideIcon = !unlocked && secrecy !== "visible";
            const Icon = hideIcon ? IconHiddenAchievement : def.icon;
            const descText = unlocked
              ? def.desc
              : secrecy === "hidden"
                ? "???"
                : secrecy === "hint"
                  ? def.hint
                  : def.desc;
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
                <div className="achievement-tile-icon">
                  <Icon size={44} />
                </div>
                <div className="achievement-tile-body">
                  <div className="achievement-tile-status">{statusLabel}</div>
                  <div className="achievement-tile-name">{hideName ? "???" : def.name}</div>
                  <div className="achievement-tile-desc">{descText}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
