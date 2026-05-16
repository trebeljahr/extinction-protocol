import type React from "react";
import { useEffect } from "react";
import { ACHIEVEMENT_BY_ID } from "../achievements";
import { audio } from "../audio/AudioManager";
import { LEVELS } from "../levels";
import { isLevelUnlocked, LEVEL_MODE_LABEL } from "../progress";
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
    audio.play(won ? "victory" : "defeat", "notifications", won ? 0.48 : 0.85, 1000, 2.8);
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
        <div className="flex items-center justify-center gap-4 mb-1">
          <h1 className="!mb-0">{result.won ? "Outpost held." : "Extinction complete."}</h1>
          {result.mode === "normal" ? (
            <StarDisplay count={result.stars as 0 | 1 | 2 | 3} size={28} animate />
          ) : (
            <ModeBadge mode={result.mode} earned={result.stars >= 1} />
          )}
        </div>
        <div className="text-[13px] tracking-uber uppercase text-fg-dim mb-5">
          {result.mode !== "normal" && (
            <span className={result.mode === "heroic" ? "text-orange mr-2" : "text-red mr-2"}>
              {LEVEL_MODE_LABEL[result.mode]} ·
            </span>
          )}
          {result.levelName}
        </div>

        <div className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg px-4 py-3.5 mb-5">
          <ResultRow
            label="Lives remaining"
            value={`${result.livesRemaining} / ${result.startingLives}`}
          />
          <ResultRow
            label="Best"
            value={
              result.mode === "normal" ? (
                <StarDisplay count={result.bestStars as 0 | 1 | 2 | 3} size={14} />
              ) : (
                <ModeBadge mode={result.mode} earned={result.bestStars >= 1} compact />
              )
            }
          />
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
              Next Level<span className="kbd-only"> (Enter)</span>
            </button>
          )}
          <button
            type="button"
            onClick={goToMap}
            className={showNext ? "btn btn-secondary" : "btn"}
          >
            World Map<span className="kbd-only"> (Esc)</span>
          </button>
          <button type="button" onClick={retry} className="btn btn-secondary">
            Retry<span className="kbd-only"> (R)</span>
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

// Single-icon badge used in place of the 3-star row for heroic/iron
// runs. Earned = bright + glowing, unearned = dim outline so the player
// sees what they still owe on this map.
const ModeBadge = ({
  mode,
  earned,
  compact = false,
}: {
  mode: "heroic" | "iron";
  earned: boolean;
  compact?: boolean;
}) => {
  const icon = mode === "heroic" ? "✦" : "▣";
  const colorClass = mode === "heroic" ? "text-orange" : "text-red";
  const borderClass = mode === "heroic" ? "border-orange" : "border-red";
  const size = compact ? "text-sm px-1.5 py-0.5" : "text-2xl px-3 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border ${borderClass} ${size} ${
        earned ? `${colorClass} font-bold` : "text-fg-dim opacity-50"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="text-[10px] uppercase tracking-wide">{mode}</span>
    </span>
  );
};
