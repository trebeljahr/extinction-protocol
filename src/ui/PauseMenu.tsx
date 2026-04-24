import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import { getLevel } from "../levels";
import { useGame } from "../store";

type Props = {
  onResume: () => void;
};

const VOL_KEY = "extinction-protocol:audio:v1";

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { sfx: number; music: number; muted: boolean };
  } catch {
    return null;
  }
};

const savePersisted = (s: { sfx: number; music: number; muted: boolean }) => {
  try {
    localStorage.setItem(VOL_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const PauseMenu = ({ onResume }: Props) => {
  const selectedLevelId = useGame((s) => s.selectedLevelId);
  const goToWorldMap = useGame((s) => s.goToWorldMap);
  const retry = useGame((s) => s.retryCurrentLevel);
  const setCompendiumOpen = useGame((s) => s.setCompendiumOpen);
  const setAchievementsOpen = useGame((s) => s.setAchievementsOpen);

  const [sfx, setSfx] = useState(audio.getSfxVolume());
  const [music, setMusic] = useState(audio.getMusicVolume());
  const [muted, setMuted] = useState(audio.isMuted());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    audio.ui("open");
  }, []);

  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      audio.setSfxVolume(persisted.sfx);
      audio.setMusicVolume(persisted.music);
      audio.setMuted(persisted.muted);
      setSfx(persisted.sfx);
      setMusic(persisted.music);
      setMuted(persisted.muted);
    }
  }, []);

  const commit = (next: { sfx?: number; music?: number; muted?: boolean }) => {
    const state = {
      sfx: next.sfx ?? sfx,
      music: next.music ?? music,
      muted: next.muted ?? muted,
    };
    savePersisted(state);
  };

  const updateSfx = (v: number) => {
    setSfx(v);
    audio.setSfxVolume(v);
    commit({ sfx: v });
  };

  const updateMusic = (v: number) => {
    setMusic(v);
    audio.setMusicVolume(v);
    commit({ music: v });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    commit({ muted: next });
  };

  const levelName = selectedLevelId ? getLevel(selectedLevelId).name : "";

  if (confirming) {
    return (
      <div className="overlay">
        <div className="overlay-card min-w-[420px] pt-7 px-8 pb-6 text-left">
          <h1 className="text-center mb-1">Return to World Map?</h1>
          <div className="text-center text-[13px] text-fg-muted mb-5 leading-[1.4]">
            Progress on <strong className="text-fg-secondary">{levelName}</strong> will be lost.
          </div>
          <PauseActions>
            <button type="button" className="btn" onClick={goToWorldMap}>
              Return
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </PauseActions>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="overlay-card min-w-[420px] pt-7 px-8 pb-6 text-left">
        <h1 className="text-center mb-1">Paused</h1>
        {levelName && (
          <div className="text-center text-xs tracking-[0.22em] uppercase text-fg-dim mb-[18px]">
            {levelName}
          </div>
        )}

        <section className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg pt-3.5 px-4 pb-2.5 mb-5">
          <div className="text-[10px] font-bold tracking-uber text-gold mb-2.5">SOUND</div>
          <PauseRow>
            <PauseLabel>Master</PauseLabel>
            <button
              type="button"
              className={`flex-1 px-3 py-1.5 rounded-[5px] border text-xs font-bold tracking-mid font-[inherit] cursor-pointer ${
                muted
                  ? "bg-tint-pink border-[rgba(255,122,154,0.45)] text-pink"
                  : "bg-[rgba(61,209,255,0.15)] border-cyan text-cyan"
              }`}
              onClick={toggleMute}
              aria-pressed={!muted}
            >
              {muted ? "Muted" : "On"}
            </button>
          </PauseRow>
          <PauseRow>
            <PauseLabel htmlFor="sfx-vol">SFX</PauseLabel>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfx}
              onChange={(e) => updateSfx(Number(e.target.value))}
              disabled={muted}
              className="flex-1 accent-cyan disabled:opacity-40"
            />
            <PauseValue value={sfx} />
          </PauseRow>
          <PauseRow>
            <PauseLabel htmlFor="music-vol">Music</PauseLabel>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music}
              onChange={(e) => updateMusic(Number(e.target.value))}
              disabled={muted}
              className="flex-1 accent-cyan disabled:opacity-40"
            />
            <PauseValue value={music} />
          </PauseRow>
        </section>

        <PauseActions>
          <button type="button" className="btn" onClick={onResume}>
            Resume (Esc)
          </button>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Restart (R)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCompendiumOpen(true)}
          >
            Compendium
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAchievementsOpen(true)}
          >
            Achievements
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
            World Map
          </button>
        </PauseActions>
      </div>
    </div>
  );
};

const PauseRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 my-2">{children}</div>
);
const PauseLabel = ({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) => {
  const cls = "w-16 text-xs tracking-[0.06em] text-fg-muted";
  return htmlFor ? (
    <label className={cls} htmlFor={htmlFor}>
      {children}
    </label>
  ) : (
    <span className={cls}>{children}</span>
  );
};
const PauseValue = ({ value }: { value: number }) => (
  <span className="w-[34px] text-right tabular-nums text-xs text-fg-secondary font-bold">
    {Math.round(value * 100)}
  </span>
);
const PauseActions = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2.5 justify-center flex-wrap">{children}</div>
);
