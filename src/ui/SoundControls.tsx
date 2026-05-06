import type React from "react";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioManager";
import {
  type AudioPrefs,
  loadAudioPrefs,
  readAudioPrefs,
  saveAudioPrefs,
} from "../audio/preferences";

type BusKey = Exclude<keyof AudioPrefs, "muted">;

const SLIDERS: { key: BusKey; label: string }[] = [
  { key: "music", label: "Music" },
  { key: "ui", label: "UI" },
  { key: "towers", label: "Towers" },
  { key: "enemies", label: "Enemies" },
  { key: "notifications", label: "Alerts" },
];

const applyBus = (key: BusKey, v: number) => {
  if (key === "music") audio.setMusicVolume(v);
  else audio.setBusVolume(key, v);
};

export const SoundControls = () => {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => readAudioPrefs());

  useEffect(() => {
    const persisted = loadAudioPrefs();
    audio.setMusicVolume(persisted.music);
    audio.setBusVolume("ui", persisted.ui);
    audio.setBusVolume("towers", persisted.towers);
    audio.setBusVolume("enemies", persisted.enemies);
    audio.setBusVolume("notifications", persisted.notifications);
    audio.setMuted(persisted.muted);
    setPrefs(persisted);
  }, []);

  const updateBus = (key: BusKey, v: number) => {
    applyBus(key, v);
    setPrefs((prev) => {
      const next = { ...prev, [key]: v };
      saveAudioPrefs(next);
      return next;
    });
  };

  const toggleMute = () => {
    setPrefs((prev) => {
      const next = { ...prev, muted: !prev.muted };
      audio.setMuted(next.muted);
      saveAudioPrefs(next);
      return next;
    });
  };

  return (
    <section className="bg-[rgba(8,12,18,0.45)] border border-[rgba(120,160,200,0.14)] rounded-lg pt-3 px-4 pb-3 mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] font-bold tracking-uber text-gold">SOUND</div>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-[5px] border text-[10px] font-bold tracking-uber font-[inherit] cursor-pointer ${
            prefs.muted
              ? "bg-tint-pink border-[rgba(255,122,154,0.45)] text-pink"
              : "bg-[rgba(61,209,255,0.12)] border-[rgba(61,209,255,0.4)] text-cyan"
          }`}
          onClick={toggleMute}
          aria-pressed={!prefs.muted}
        >
          {prefs.muted ? "MUTED" : "ON"}
        </button>
      </div>
      {SLIDERS.map(({ key, label }) => (
        <Row key={key}>
          <Label htmlFor={`vol-${key}`}>{label}</Label>
          <input
            id={`vol-${key}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={prefs[key]}
            onChange={(e) => updateBus(key, Number(e.target.value))}
            className="flex-1 accent-cyan"
          />
          <Value value={prefs[key]} />
        </Row>
      ))}
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
