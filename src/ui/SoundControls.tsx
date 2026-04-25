import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";

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

export const SoundControls = () => {
  const [sfx, setSfx] = useState(audio.getSfxVolume());
  const [music, setMusic] = useState(audio.getMusicVolume());
  const [muted, setMuted] = useState(audio.isMuted());

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

  const commit = (next: { sfx: number; music: number; muted: boolean }) => {
    savePersisted(next);
  };

  const updateSfx = (v: number) => {
    setSfx(v);
    audio.setSfxVolume(v);
    commit({ sfx: v, music, muted });
  };

  const updateMusic = (v: number) => {
    setMusic(v);
    audio.setMusicVolume(v);
    commit({ sfx, music: v, muted });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    commit({ sfx, music, muted: next });
  };

  return (
    <section className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg pt-3 px-4 pb-3 mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] font-bold tracking-uber text-gold">SOUND</div>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-[5px] border text-[10px] font-bold tracking-uber font-[inherit] cursor-pointer ${
            muted
              ? "bg-tint-pink border-[rgba(255,122,154,0.45)] text-pink"
              : "bg-[rgba(61,209,255,0.12)] border-[rgba(61,209,255,0.4)] text-cyan"
          }`}
          onClick={toggleMute}
          aria-pressed={!muted}
        >
          {muted ? "MUTED" : "ON"}
        </button>
      </div>
      <Row>
        <Label htmlFor="sfx-vol">SFX</Label>
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
        <Value value={sfx} />
      </Row>
      <Row>
        <Label htmlFor="music-vol">Music</Label>
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
        <Value value={music} />
      </Row>
    </section>
  );
};

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 my-2">{children}</div>
);

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => {
  const cls = "w-16 text-xs tracking-[0.06em] text-fg-muted";
  return (
    <label className={cls} htmlFor={htmlFor}>
      {children}
    </label>
  );
};

const Value = ({ value }: { value: number }) => (
  <span className="w-[34px] text-right tabular-nums text-xs text-fg-secondary font-bold">
    {Math.round(value * 100)}
  </span>
);
