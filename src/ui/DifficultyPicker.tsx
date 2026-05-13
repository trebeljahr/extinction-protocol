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
    <div className="overlay achievements-overlay">
      <div className="achievements-card">
        <header className="achievements-header">
          <div>
            <h1>Difficulty</h1>
            <div className="achievements-subtitle">Currently · {DIFFICULTY_LABEL[current]}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Close<span className="kbd-only"> (Esc)</span>
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-5 overflow-y-auto">
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
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border bg-surface-1 transition-all text-left cursor-pointer ${
                  active
                    ? `${accent.border} ${GLOW[d]}`
                    : "border-border hover:border-border-strong"
                }`}
                aria-pressed={active}
              >
                {active && (
                  <span
                    className={`absolute top-2 right-2 text-[9px] font-bold tracking-wide uppercase ${accent.text}`}
                  >
                    Active
                  </span>
                )}
                <div
                  className={`w-full aspect-square rounded-md flex items-center justify-center ${accent.tint} border border-border-faint`}
                >
                  <DifficultyModelIcon difficulty={d} className="w-full h-full" />
                </div>
                <div className={`text-base font-bold ${accent.text} tracking-mid`}>
                  {DIFFICULTY_LABEL[d]}
                </div>
                <div className="text-[11px] text-fg-muted text-center min-h-[28px]">
                  {DIFFICULTY_TAGLINE[d]}
                </div>
                <ul className="w-full text-[11px] text-fg-muted flex flex-col gap-1 mt-1 border-t border-border-faint pt-2 tabular-nums">
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
