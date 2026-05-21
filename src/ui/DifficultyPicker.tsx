import { useEffect } from "react";
import { audio } from "../audio/AudioManager";
import {
  DIFFICULTIES,
  DIFFICULTY_ACCENT,
  DIFFICULTY_LABEL,
  DIFFICULTY_MULTIPLIERS,
  DIFFICULTY_TAGLINE,
  type Difficulty,
} from "../progress";
import { useGame } from "../store";
import { DifficultyModelIcon } from "./DifficultyModelIcon";

const GLOW: Record<Difficulty, string> = {
  easy: "shadow-[0_0_24px_rgba(180,255,201,0.18)]",
  medium: "shadow-[0_0_24px_rgba(159,216,255,0.18)]",
  hard: "shadow-[0_0_24px_rgba(255,178,102,0.22)]",
  extinction: "shadow-[0_0_28px_rgba(255,90,122,0.28)]",
};

const formatPercent = (mul: number, deltaOnly = true): string => {
  if (mul === 1) return "1.0×";
  if (deltaOnly) {
    const pct = Math.round((mul - 1) * 100);
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }
  return `${mul.toFixed(2)}×`;
};

export const DifficultyPicker = () => {
  const current = useGame((s) => s.progress.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const setOpen = useGame((s) => s.setDifficultyPickerOpen);

  useEffect(() => {
    audio.ui("click");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setOpen]);

  return (
    <div className="overlay difficulty-overlay">
      <div className="difficulty-card">
        <header className="difficulty-header">
          <div>
            <h1>Difficulty</h1>
            <div className="difficulty-subtitle">Currently · {DIFFICULTY_LABEL[current]}</div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setOpen(false)}
            aria-label="Close difficulty picker"
            title="Close difficulty picker"
          >
            ×
          </button>
        </header>

        <div className="difficulty-grid">
          {DIFFICULTIES.map((d) => {
            const m = DIFFICULTY_MULTIPLIERS[d];
            const accent = DIFFICULTY_ACCENT[d];
            const active = d === current;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDifficulty(d);
                  audio.ui("select");
                }}
                className={`difficulty-option ${
                  active
                    ? `${accent.border} ${GLOW[d]}`
                    : "border-border hover:border-border-strong"
                }`}
                aria-pressed={active}
              >
                {active && <span className={`difficulty-active-badge ${accent.text}`}>Active</span>}
                <div className="difficulty-option-icon">
                  <DifficultyModelIcon difficulty={d} className="w-full h-full" />
                </div>
                <div className={`difficulty-option-label ${accent.text}`}>
                  {DIFFICULTY_LABEL[d]}
                </div>
                <div className="difficulty-option-tagline">{DIFFICULTY_TAGLINE[d]}</div>
                <ul className="difficulty-option-stats">
                  <Stat label="Enemy HP" value={formatPercent(m.hp)} />
                  <Stat label="Start gold" value={formatPercent(m.startGold)} />
                  <Stat label="Gold/kill" value={formatPercent(m.goldKill)} />
                  <Stat label="Speed" value={formatPercent(m.speed)} />
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <li className="flex justify-between">
    <span>{label}</span>
    <span className="text-fg font-semibold">{value}</span>
  </li>
);
