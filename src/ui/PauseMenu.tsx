import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { isDebug } from "../debug";
import { getLevel } from "../levels";
import { useGame } from "../store";
import { DebugMenuSection } from "./DebugMenuSection";
import { DebugProgressSettings } from "./DebugProgressSettings";
import { DifficultyButton } from "./DifficultyButton";
import { FullscreenToggle } from "./FullscreenToggle";
import { IconBook, IconMap, IconRefresh, IconTrophy } from "./MenuIcons";
import { MenuOverlay } from "./MenuOverlay";
import { SoundControls } from "./SoundControls";
import { useKeyboardHintsVisible } from "./useInputMode";

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
  const showKeyboardHints = useKeyboardHintsVisible();

  useEffect(() => {
    audio.ui("click");
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
      closeTitle={showKeyboardHints ? "Resume (Esc)" : "Resume"}
    >
      <div className="menu-panel-scroll">
        <DifficultyButton
          className="w-full mb-3 bg-surface-1 border border-border rounded-md px-3 py-2 flex items-center gap-3 cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-border-strong hover:text-white"
          title="Change difficulty"
          textStackClassName="flex-1"
          trailing={
            <span className="text-[10px] tracking-wide text-fg-faint uppercase">Change</span>
          }
        />
        <SoundControls />
        <FullscreenToggle />
        {isDebug && <DebugProgressSettings />}
        <ActionsCol>
          <button
            type="button"
            className="btn btn-ghost w-full flex items-center justify-center gap-2"
            onClick={() => setCompendiumOpen(true)}
          >
            <IconBook size={16} className="shrink-0" />
            Compendium
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full flex items-center justify-center gap-2"
            onClick={() => setAchievementsOpen(true)}
          >
            <IconTrophy size={16} className="shrink-0" />
            Achievements
          </button>
          <button
            type="button"
            className="btn btn-warn w-full flex items-center justify-center gap-2"
            onClick={() => setConfirming("restart")}
          >
            <IconRefresh size={16} className="shrink-0" />
            Restart
          </button>
          <button
            type="button"
            className="btn btn-danger w-full flex items-center justify-center gap-2"
            onClick={() => setConfirming("worldMap")}
          >
            <IconMap size={16} className="shrink-0" />
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
  <div className="menu-panel-actions">{children}</div>
);
