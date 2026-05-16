import { useEffect, useMemo } from "react";
import { audio } from "../audio/AudioManager";
import { getLevel, levelHasMode, resolveLevelMode } from "../levels";
import {
  getModeStars,
  isModeUnlocked,
  LEVEL_MODE_LABEL,
  LEVEL_MODE_TAGLINE,
  LEVEL_MODES,
  type LevelMode,
} from "../progress";
import { TOWER_LABEL } from "../sim/world";
import { useGame } from "../store";

const MODE_ACCENT: Record<LevelMode, { text: string; border: string; tint: string }> = {
  normal: { text: "text-blue", border: "border-blue", tint: "bg-tint-blue" },
  heroic: { text: "text-orange", border: "border-orange", tint: "bg-[rgba(255,178,102,0.12)]" },
  iron: { text: "text-red", border: "border-red", tint: "bg-tint-red" },
};

const MODE_GLOW: Record<LevelMode, string> = {
  normal: "shadow-[0_0_24px_rgba(159,216,255,0.22)]",
  heroic: "shadow-[0_0_24px_rgba(255,178,102,0.26)]",
  iron: "shadow-[0_0_28px_rgba(255,90,122,0.30)]",
};

const MODE_ICON: Record<LevelMode, string> = {
  normal: "◆",
  heroic: "✦",
  iron: "▣",
};

export const ModePicker = () => {
  const levelId = useGame((s) => s.modePickerLevelId);
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  const close = useGame((s) => s.closeModePicker);

  useEffect(() => {
    audio.ui("click");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const level = useMemo(() => (levelId !== null ? getLevel(levelId) : null), [levelId]);
  if (!level) return null;

  const modeStars = getModeStars(progress, level.id);

  return (
    <div className="overlay achievements-overlay">
      <div className="achievements-card">
        <header className="achievements-header">
          <div>
            <h1>{level.name}</h1>
            <div className="achievements-subtitle">Choose a challenge mode</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Close<span className="kbd-only"> (Esc)</span>
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5 overflow-y-auto">
          {LEVEL_MODES.map((mode) => {
            const defined = levelHasMode(level, mode);
            const unlocked = isModeUnlocked(progress, level.id, mode);
            const available = defined && unlocked;
            const cleared =
              mode === "normal" ? modeStars.normal === 3 : (modeStars[mode] as number) >= 1;
            const accent = MODE_ACCENT[mode];
            const cfg = resolveLevelMode(level, mode);
            const restrictions = describeMode(mode, level, cfg);
            return (
              <button
                key={mode}
                type="button"
                disabled={!available}
                onClick={() => {
                  if (!available) return;
                  audio.ui("select");
                  startLevel(level.id, mode);
                }}
                className={`relative flex flex-col items-stretch text-left gap-2 p-3 sm:p-4 rounded-lg border bg-surface-1 transition-all ${
                  available
                    ? `${accent.border} ${MODE_GLOW[mode]} cursor-pointer hover:brightness-110`
                    : "border-border-faint opacity-50 cursor-not-allowed"
                }`}
                aria-disabled={!available}
              >
                {cleared && (
                  <span
                    className={`absolute top-1 right-1 sm:top-2 sm:right-2 text-[9px] font-bold tracking-wide uppercase ${accent.text}`}
                  >
                    Cleared
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-2xl ${accent.text}`} aria-hidden>
                    {MODE_ICON[mode]}
                  </span>
                  <span className={`text-base font-bold ${accent.text} tracking-mid`}>
                    {LEVEL_MODE_LABEL[mode]}
                  </span>
                </div>
                <div className="text-[11px] text-fg-muted leading-snug min-h-[28px]">
                  {LEVEL_MODE_TAGLINE[mode]}
                </div>
                <ul className="flex flex-col gap-1 text-[11px] text-fg border-t border-border-faint pt-2 mt-1 tabular-nums">
                  <Row label="Start gold" value={`${cfg.startGold}g`} />
                  <Row label="Waves" value={String(cfg.waves.length)} />
                  {restrictions.map((r) => (
                    <Row key={r.label} label={r.label} value={r.value} />
                  ))}
                </ul>
                {!defined && <div className="text-[10px] text-fg-dim italic">Coming soon</div>}
                {defined && !unlocked && (
                  <div className="text-[10px] text-fg-dim italic">
                    {mode === "heroic"
                      ? "Earn 3 stars on Standard to unlock"
                      : "Clear Heroic to unlock"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <li className="flex justify-between">
    <span className="text-fg-muted">{label}</span>
    <span className="text-fg font-semibold">{value}</span>
  </li>
);

// Human-readable summary of the mode's rules. Reads the resolved
// ModeConfig directly so it stays accurate even if levels override
// defaults in unusual ways (e.g. iron with a 2-tower locked loadout).
const describeMode = (
  mode: LevelMode,
  _level: { id: number; name: string },
  cfg: {
    forbiddenTowers?: readonly string[];
    lockedLoadout?: readonly string[];
    singleLife?: boolean;
    noSelling?: boolean;
  },
): { label: string; value: string }[] => {
  const rows: { label: string; value: string }[] = [];
  if (mode === "iron") {
    rows.push({ label: "Lives", value: cfg.singleLife ? "1" : "20" });
    if (cfg.noSelling) rows.push({ label: "Selling", value: "Disabled" });
  }
  if (cfg.lockedLoadout && cfg.lockedLoadout.length > 0) {
    rows.push({
      label: "Loadout",
      value: cfg.lockedLoadout
        .map((k) => TOWER_LABEL[k as keyof typeof TOWER_LABEL] ?? k)
        .join(", "),
    });
  }
  if (cfg.forbiddenTowers && cfg.forbiddenTowers.length > 0) {
    rows.push({
      label: "Denied",
      value: cfg.forbiddenTowers
        .map((k) => TOWER_LABEL[k as keyof typeof TOWER_LABEL] ?? k)
        .join(", "),
    });
  }
  return rows;
};
