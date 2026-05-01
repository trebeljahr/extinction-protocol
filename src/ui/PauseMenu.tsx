import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { isDebug } from "../debug";
import { getLevel } from "../levels";
import { useGame } from "../store";
import { DebugMenuSection } from "./DebugMenuSection";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";

type Props = {
  onResume: () => void;
};

export const PauseMenu = ({ onResume }: Props) => {
  const selectedLevelId = useGame((s) => s.selectedLevelId);
  const goToWorldMap = useGame((s) => s.goToWorldMap);
  const retry = useGame((s) => s.retryCurrentLevel);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);
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

  return (
    <MenuOverlay
      title="Paused"
      subtitle={levelName || null}
      onClose={onResume}
      closeLabel="Resume"
      closeTitle="Resume (Esc)"
    >
      <SoundControls />
      {isDebug && <DebugMenuSection />}
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
    </MenuOverlay>
  );
};

const ActionsRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2.5 justify-center flex-wrap">{children}</div>
);

const ActionsCol = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">{children}</div>
);
