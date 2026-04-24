import { useEffect } from "react";
import type { GameEvent } from "../sim/types";
import { useGame } from "../store";
import { audio } from "./AudioManager";

const VOL_KEY = "extinction-protocol:audio:v1";

const loadPersistedAudio = () => {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as { sfx: number; music: number; muted: boolean };
    if (typeof s.sfx === "number") audio.setSfxVolume(s.sfx);
    if (typeof s.music === "number") audio.setMusicVolume(s.music);
    if (typeof s.muted === "boolean") audio.setMuted(s.muted);
  } catch {
    /* ignore */
  }
};

export const useAudioBridge = () => {
  useEffect(() => {
    let cancelled = false;
    audio.preload().then(() => {
      if (cancelled) return;
      loadPersistedAudio();
    });

    const resumeOnInteract = async () => {
      await audio.ensureResumed();
      audio.startMusic();
      window.removeEventListener("pointerdown", resumeOnInteract);
      window.removeEventListener("keydown", resumeOnInteract);
    };
    window.addEventListener("pointerdown", resumeOnInteract);
    window.addEventListener("keydown", resumeOnInteract);

    const unsub = useGame.getState().onEvent((e: GameEvent) => {
      switch (e.type) {
        case "shoot":
          audio.playShoot(e.towerKind);
          break;
        case "impact":
          audio.play("impact", 0.25, 60, 1.0);
          break;
        case "death":
          audio.play("death", 0.3, 60);
          break;
        case "wave-start":
          audio.startMusic();
          audio.play("wave-start", 0.5, 500);
          break;
        case "wave-clear":
          audio.play("wave-clear", 0.6, 500);
          break;
        case "life-lost":
          audio.play("life-lost", 0.7, 120);
          break;
        case "upgrade":
          audio.play("upgrade", 0.5, 100);
          break;
        case "game-over":
          audio.stopAllSfx();
          audio.stopMusic();
          audio.play("game-over", 0.8, 1000);
          break;
      }
    });

    return () => {
      cancelled = true;
      unsub();
      window.removeEventListener("pointerdown", resumeOnInteract);
      window.removeEventListener("keydown", resumeOnInteract);
    };
  }, []);
};
