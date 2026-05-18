import { useState } from "react";
import { useGame } from "../store";
import { IconRefresh } from "./MenuIcons";

export const DebugProgressSettings = () => {
  const debugResetProgress = useGame((s) => s.debugResetProgress);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="bg-[rgba(255,214,106,0.05)] border border-[rgba(255,214,106,0.22)] rounded-lg pt-3 px-4 pb-3 mb-5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-uber text-gold mb-2.5">
        <IconRefresh size={14} className="shrink-0" />
        DEBUG · SETTINGS
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-danger btn--sm flex-1"
            onClick={() => {
              debugResetProgress();
              setConfirming(false);
            }}
          >
            Reset all
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
          className="btn btn-ghost btn--sm w-full flex items-center justify-center gap-2"
          onClick={() => setConfirming(true)}
          aria-label="Reset all progress"
        >
          <IconRefresh size={14} className="shrink-0" />
          Reset all progress
        </button>
      )}
    </section>
  );
};
