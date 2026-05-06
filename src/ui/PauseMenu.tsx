import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { isDebug } from "../debug";
import { getLevel } from "../levels";
import { DIFFICULTY_LABEL, type Difficulty } from "../progress";
import { useGame } from "../store";
import { DebugMenuSection } from "./DebugMenuSection";
import { DifficultyIcon } from "./DifficultyIcon";
import { FullscreenToggle } from "./FullscreenToggle";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";

type Props = {
  onResume: () => void;
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "text-mint",
  medium: "text-blue",
  hard: "text-orange",
  extinction: "text-red",
};

export const PauseMenu = ({ onResume }: Props) => {
  const selectedLevelId = useGame((s) => s.selectedLevelId);
  const goToWorldMap = useGame((s) => s.goToWorldMap);
  const retry = useGame((s) => s.retryCurrentLevel);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);
  const setDifficultyPickerOpen = useGame((s) => s.setDifficultyPickerOpen);
  const difficulty = useGame((s) => s.progress.difficulty);
  const [confirming, setConfirming] = useState<null | "worldMap" | "restart">(null);

  useEffect(() => {
    audio.ui("open");
  }, []);

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";

  if (confirming) {
    const isRestart = confirming === "restart";
    return (
      <MenuOverlay
        title={isRestart ? "Restart Level?" : "Return to World Map?"}
        onClose={() => setConfirming(null)}
        closeLabel="Cancel"
      >
        <div className="text-center text-[13px] text-fg-muted mb-5 leading-[1.4]">
          Progress on <strong className="text-fg-secondary">{levelName}</strong> will be lost.
        </div>
        <ActionsRow>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={isRestart ? retry : goToWorldMap}
          >
            {isRestart ? "Restart" : "Return"}
          </button>
        </ActionsRow>
      </MenuOverlay>
    );
  }

  const accent = DIFFICULTY_COLOR[difficulty];

  return (
    <MenuOverlay
      title="Paused"
      subtitle={levelName || null}
      onClose={onResume}
      closeLabel="Resume"
      closeTitle="Resume (Esc)"
    >
      <div className="max-h-[75vh] overflow-y-auto pr-1 -mr-2">
        <button
          type="button"
          onClick={() => setDifficultyPickerOpen(true)}
          className="w-full mb-3 bg-surface-1 border border-border rounded-md px-3 py-2 flex items-center gap-3 cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-border-strong hover:text-white"
          aria-label="Change difficulty"
          title="Change difficulty"
        >
          <DifficultyIcon difficulty={difficulty} className={`w-7 h-7 ${accent}`} />
          <div className="flex flex-col items-start flex-1">
            <span className="text-[9px] font-bold tracking-wide text-gold uppercase">
              Difficulty
            </span>
            <span className={`text-sm font-bold leading-tight ${accent}`}>
              {DIFFICULTY_LABEL[difficulty]}
            </span>
          </div>
          <span className="text-[10px] tracking-wide text-fg-faint uppercase">Change</span>
        </button>
        <SoundControls />
        <FullscreenToggle />
        <ActionsCol>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => setCompendiumOpen(true)}
          >
            Compendium
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => setAchievementsOpen(true)}
          >
            Achievements
          </button>
          <button
            type="button"
            className="btn btn-warn w-full"
            onClick={() => setConfirming("restart")}
          >
            Restart
          </button>
          <button
            type="button"
            className="btn btn-danger w-full"
            onClick={() => setConfirming("worldMap")}
          >
            Return to World Map
          </button>
        </ActionsCol>
        {isDebug && (
          <div className="mt-5">
            <DebugMenuSection />
          </div>
        )}
      </div>
    </MenuOverlay>
  );
};

const ActionsRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2.5 justify-center flex-wrap">{children}</div>
);

const ActionsCol = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">{children}</div>
);
