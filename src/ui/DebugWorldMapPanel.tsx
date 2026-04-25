// World-map debug panel: per-level star override + global reset.
// Mirrors src/ui/DebugMenuSection but for the level-select screen.
// Like the in-run version, only renders when isDebug; the gate lives
// at the call site in WorldMapUI.
import { useState } from "react";
import { LEVELS } from "../levels";
import { getStars } from "../progress";
import type { Stars } from "../progress";
import { useGame } from "../store";

const STAR_OPTIONS: Stars[] = [0, 1, 2, 3];

export const DebugWorldMapPanel = () => {
  const progress = useGame((s) => s.progress);
  const debugSetLevelStars = useGame((s) => s.debugSetLevelStars);
  const debugResetProgress = useGame((s) => s.debugResetProgress);
  const [collapsed, setCollapsed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="absolute right-6 bottom-6 w-[260px] bg-surface-3 border border-[rgba(255,214,106,0.35)] rounded-xl backdrop-blur-md pointer-events-auto shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-bold tracking-uber text-gold uppercase cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>DEBUG · Progress</span>
        <span className="text-fg-muted">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1.5 items-center text-xs">
            <div className="text-fg-faint tracking-wide font-bold col-span-3 mb-1">LEVELS</div>
            {LEVELS.map((l) => {
              const stars = getStars(progress, l.id);
              return (
                <div key={l.id} className="contents">
                  <span className="text-fg-muted tabular-nums w-5 text-right">#{l.id}</span>
                  <span
                    className="text-fg whitespace-nowrap overflow-hidden text-ellipsis"
                    title={l.name}
                  >
                    {l.name}
                  </span>
                  <div className="flex gap-0.5 justify-end">
                    {STAR_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => debugSetLevelStars(l.id, s)}
                        className={`w-5 h-5 rounded-sm text-[10px] font-bold tabular-nums leading-none ${
                          stars === s
                            ? "bg-gold text-black"
                            : "bg-[rgba(255,255,255,0.04)] text-fg-muted hover:bg-[rgba(255,255,255,0.1)]"
                        }`}
                        aria-pressed={stars === s}
                        title={`Set ${s} stars`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border-faint">
            {confirming ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="btn btn--sm flex-1"
                  style={{ background: "var(--color-pink)", color: "#1a0008" }}
                  onClick={() => {
                    debugResetProgress();
                    setConfirming(false);
                  }}
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn--sm flex-1"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn--sm w-full"
                onClick={() => setConfirming(true)}
              >
                Reset all progress
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
