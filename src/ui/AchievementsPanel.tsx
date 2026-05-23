import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ACHIEVEMENTS, isAchievementUnlocked, totalUnlocked } from "../achievements";
import { useGame } from "../store";
import { IconHiddenAchievement } from "./AchievementIcons";

export const AchievementsPanel = () => {
  const { t } = useTranslation();
  const progress = useGame((s) => s.progress);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);

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
            <h1>{t("achievements.title")}</h1>
            <div className="achievements-subtitle">
              {t("achievements.unlockedCount", {
                count: unlockedCount,
                total: ACHIEVEMENTS.length,
              })}
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setAchievementsOpen(false)}
            aria-label={t("achievements.close")}
            title={t("achievements.close")}
          >
            ×
          </button>
        </header>

        <div className="achievements-grid">
          {ACHIEVEMENTS.map((def) => {
            const unlocked = isAchievementUnlocked(progress, def.id);
            const secrecy = def.secrecy ?? "visible";
            const hideName = !unlocked && secrecy !== "visible";
            const hideIcon = !unlocked && secrecy !== "visible";
            const Icon = hideIcon ? IconHiddenAchievement : def.icon;
            const unknown = t("achievements.unknown");
            const descText = unlocked
              ? t(`achievements:${def.id}.desc`)
              : secrecy === "hidden"
                ? unknown
                : secrecy === "hint"
                  ? t(`achievements:${def.id}.hint`)
                  : t(`achievements:${def.id}.desc`);
            const statusLabel = unlocked
              ? t("achievements.statusUnlocked")
              : secrecy === "hidden"
                ? unknown
                : secrecy === "hint"
                  ? t("achievements.statusSecret")
                  : t("achievements.statusLocked");
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
                  <div className="achievement-tile-name">
                    {hideName ? unknown : t(`achievements:${def.id}.name`)}
                  </div>
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
