import { useEffect } from "react";
import { useGame } from "../store";
import { StarDisplay } from "./StarDisplay";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";

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
        </div>

        <div className="results-actions">
          <button onClick={retry} className="btn">Retry (R)</button>
          <button onClick={goToMap} className="btn btn-secondary">World Map (Esc)</button>
        </div>
      </div>
    </div>
  );
};
