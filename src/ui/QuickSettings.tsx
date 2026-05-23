import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { audio } from "../audio/AudioManager";
import { loadAudioPrefs, readAudioPrefs, saveAudioPrefs } from "../audio/preferences";
import { IconFullscreen, IconFullscreenExit, IconSpeaker, IconSpeakerMute } from "./MenuIcons";
import { saveFullscreenPref, useFullscreen } from "./useFullscreen";

type Props = {
  className?: string;
};

export const QuickSettings = ({ className = "" }: Props) => {
  const { t } = useTranslation();
  const { active: fullscreenActive, toggle: toggleFullscreen } = useFullscreen();
  const [muted, setMuted] = useState<boolean>(() => readAudioPrefs().muted);

  useEffect(() => {
    setMuted(loadAudioPrefs().muted);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    audio.setMuted(next);
    saveAudioPrefs({ ...readAudioPrefs(), muted: next });
    setMuted(next);
  };

  const onFullscreen = () => {
    saveFullscreenPref(fullscreenActive ? "off" : "on");
    void toggleFullscreen();
  };

  return (
    <div className={`quick-settings flex items-center gap-1.5 pointer-events-auto ${className}`}>
      <button
        type="button"
        className="quick-settings-btn bg-surface-1 border border-border rounded-md w-9 h-9 flex items-center justify-center backdrop-blur-sm cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
        onClick={toggleMute}
        aria-pressed={!muted}
        aria-label={muted ? t("quickSettings.unmute") : t("quickSettings.mute")}
        title={muted ? t("quickSettings.unmuteTitle") : t("quickSettings.muteTitle")}
      >
        {muted ? <IconSpeakerMute size={18} /> : <IconSpeaker size={18} />}
      </button>
      <button
        type="button"
        className="quick-settings-btn bg-surface-1 border border-border rounded-md w-9 h-9 flex items-center justify-center backdrop-blur-sm cursor-pointer font-[inherit] text-fg-secondary transition-colors hover:border-blue hover:text-white"
        onClick={onFullscreen}
        aria-pressed={fullscreenActive}
        aria-label={
          fullscreenActive ? t("quickSettings.exitFullscreen") : t("quickSettings.enterFullscreen")
        }
        title={
          fullscreenActive ? t("quickSettings.exitFullscreen") : t("quickSettings.fullscreenTitle")
        }
      >
        {fullscreenActive ? <IconFullscreenExit size={18} /> : <IconFullscreen size={18} />}
      </button>
    </div>
  );
};
