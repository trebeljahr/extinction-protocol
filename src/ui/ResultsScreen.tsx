import type React from "react";
import { useEffect } from "react";
import { ACHIEVEMENT_BY_ID } from "../achievements";
import { audio } from "../audio/AudioManager";
import { LEVELS } from "../levels";
import { isLevelUnlocked } from "../progress";
import { useGame } from "../store";
import { STAR_STAGGER_MS, StarDisplay } from "./StarDisplay";

export const ResultsScreen = () => {
  const result = useGame((s) => s.lastResult);
  const progress = useGame((s) => s.progress);
  const retry = useGame((s) => s.retryCurrentLevel);
  const goToMap = useGame((s) => s.goToWorldMap);
  const startLevel = useGame((s) => s.startLevel);

  const nextLevel = result ? LEVELS.find((l) => l.id === result.levelId + 1) : undefined;
  const showNext =
    !!result && result.won && nextLevel !== undefined && isLevelUnlocked(nextLevel.id, progress);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR") {
        e.preventDefault();
        retry();
      } else if (e.code === "Escape") {
        e.preventDefault();
        goToMap();
      } else if (showNext && (e.code === "Enter" || e.code === "NumpadEnter")) {
        e.preventDefault();
        startLevel(nextLevel!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [retry, goToMap, startLevel, showNext, nextLevel]);

  const stars = result?.stars ?? 0;
  const won = result?.won ?? false;
  useEffect(() => {
    if (!result) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Stinger first; stars chime in on top so the moment lands as a single
    // beat rather than the per-star spray reading as the entire result cue.
    audio.play(won ? "victory" : "defeat", "notifications", 0.85, 1000, 3.5);
    if (stars > 0) {
      const starOffset = 450;
      for (let i = 0; i < stars; i++) {
        timers.push(
          setTimeout(
            () => audio.play("star", "notifications", 0.8, 30, 1.8),
            starOffset + i * STAR_STAGGER_MS,
          ),
        );
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [result, stars, won]);

  if (!result) return null;

  return (
    <div className="overlay">
      <div className="overlay-card min-w-[420px] px-10 py-8">
        <h1>{result.won ? "Outpost held." : "Extinction complete."}</h1>
        <div className="text-[13px] tracking-uber uppercase text-fg-dim -mt-2 mb-5">
          {result.levelName}
        </div>

        <div className="flex justify-center mt-2.5 mb-[18px]">
          <StarDisplay count={result.stars} size={44} animate />
        </div>

        <div className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg px-4 py-3.5 mb-5">
          <ResultRow label="Lives remaining" value={`${result.livesRemaining} / 20`} />
          <ResultRow label="Best" value={<StarDisplay count={result.bestStars} size={14} />} />
          {result.improved && (
            <div className="mt-2.5 text-center text-[11px] tracking-uber text-gold font-bold">
              NEW BEST
            </div>
          )}
          {showNext && (
            <div className="mt-1.5 text-center text-xs text-cyan tracking-[0.06em]">
              Unlocked: {nextLevel!.name}
            </div>
          )}
          {result.unlockedAchievements.length > 0 && (
            <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-tint-gold-soft border border-[rgba(255,214,106,0.35)] text-left">
              <div className="text-[10px] font-bold tracking-[0.18em] text-gold mb-1.5">
                Achievements unlocked
              </div>
              {result.unlockedAchievements.map((id) => (
                <div key={id} className="text-[13px] font-semibold text-fg py-0.5">
                  {ACHIEVEMENT_BY_ID[id].name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 justify-center">
          {showNext && (
            <button type="button" onClick={() => startLevel(nextLevel!.id)} className="btn">
              Next Level (Enter)
            </button>
          )}
          <button
            type="button"
            onClick={goToMap}
            className={showNext ? "btn btn-secondary" : "btn"}
          >
            World Map (Esc)
          </button>
          <button type="button" onClick={retry} className="btn btn-secondary">
            Retry (R)
          </button>
        </div>
      </div>
    </div>
  );
};

const ResultRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center text-[13px] my-1.5">
    <span className="text-fg-muted tracking-tight">{label}</span>
    <span className="text-fg font-bold inline-flex items-center">{value}</span>
  </div>
);
