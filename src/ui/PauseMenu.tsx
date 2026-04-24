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
        <div className="overlay-card pause-card">
          <h1>Return to World Map?</h1>
          <div className="pause-confirm-text">
            Progress on <strong>{levelName}</strong> will be lost.
          </div>
          <div className="pause-actions">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="overlay-card pause-card">
        <h1>Paused</h1>
        {levelName && <div className="pause-level">{levelName}</div>}

        <section className="pause-section">
          <div className="pause-section-label">SOUND</div>
          <div className="pause-row">
            <span className="pause-label">Master</span>
            <button
              type="button"
              className={`pause-toggle ${muted ? "off" : "on"}`}
              onClick={toggleMute}
              aria-pressed={!muted}
            >
              {muted ? "Muted" : "On"}
            </button>
          </div>
          <div className="pause-row">
            <label className="pause-label" htmlFor="sfx-vol">
              SFX
            </label>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfx}
              onChange={(e) => updateSfx(Number(e.target.value))}
              disabled={muted}
              className="pause-slider"
            />
            <span className="pause-value">{Math.round(sfx * 100)}</span>
          </div>
          <div className="pause-row">
            <label className="pause-label" htmlFor="music-vol">
              Music
            </label>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music}
              onChange={(e) => updateMusic(Number(e.target.value))}
              disabled={muted}
              className="pause-slider"
            />
            <span className="pause-value">{Math.round(music * 100)}</span>
          </div>
        </section>

        <div className="pause-actions">
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
        </div>
      </div>
    </div>
  );
};
