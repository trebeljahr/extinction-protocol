import { useEffect } from "react";
import { useGame } from "../store";
import { StarDisplay, STAR_STAGGER_MS } from "./StarDisplay";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";
import { ACHIEVEMENT_BY_ID } from "../achievements";
import { audio } from "../audio/AudioManager";

export const ResultsScreen = () => {
  const result = useGame(s => s.lastResult);
  const progress = useGame(s => s.progress);
  const retry = useGame(s => s.retryCurrentLevel);
  const goToMap = useGame(s => s.goToWorldMap);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR") { e.preventDefault(); retry(); }
      else if (e.code === "Escape") { e.preventDefault(); goToMap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [retry, goToMap]);

  const stars = result?.stars ?? 0;
  useEffect(() => {
    if (stars <= 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < stars; i++) {
      timers.push(setTimeout(() => audio.play("star", 0.8, 30, 1.8), i * STAR_STAGGER_MS));
    }
    return () => { for (const t of timers) clearTimeout(t); };
  }, [stars]);

  if (!result) return null;

  const nextLevel = LEVELS.find(l => l.id === result.levelId + 1);
  const nextNowUnlocked =
    result.won && nextLevel !== undefined && isLevelUnlocked(nextLevel.id, progress);

  return (
    <div className="overlay">
      <div className="overlay-card results-card">
        <h1>{result.won ? "Outpost held." : "Extinction complete."}</h1>
        <div className="results-level">{result.levelName}</div>

        <div className="results-stars">
          <StarDisplay count={result.stars} size={44} animate />
        </div>

        <div className="results-stats">
          <div className="results-row">
            <span className="results-label">Lives remaining</span>
            <span className="results-value">{result.livesRemaining} / 20</span>
          </div>
          <div className="results-row">
            <span className="results-label">Best</span>
            <span className="results-value">
              <StarDisplay count={result.bestStars} size={14} />
            </span>
          </div>
          {result.improved && (
            <div className="results-new-best">NEW BEST</div>
          )}
          {nextNowUnlocked && (
            <div className="results-unlock">Unlocked: {nextLevel!.name}</div>
          )}
          {result.unlockedAchievements.length > 0 && (
            <div className="results-achievements">
              <div className="results-achievements-label">Achievements unlocked</div>
              {result.unlockedAchievements.map(id => (
                <div key={id} className="results-achievement-row">
                  {ACHIEVEMENT_BY_ID[id].name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="results-actions">
          <button onClick={goToMap} className="btn">World Map (Esc)</button>
          <button onClick={retry} className="btn btn-secondary">Retry (R)</button>
        </div>
      </div>
    </div>
  );
};
