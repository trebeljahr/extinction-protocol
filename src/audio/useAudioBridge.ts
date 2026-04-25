import { useEffect } from "react";
import type { Biome } from "../biomes";
import type { GameEvent } from "../sim/types";
import { useGame } from "../store";
import { type MusicTrack, audio } from "./AudioManager";

const biomeTrack = (biome: Biome): MusicTrack => `music-${biome}` as MusicTrack;

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

    const pickTrack = (): MusicTrack => {
      const s = useGame.getState();
      if (s.screen === "playing") return biomeTrack(s.world.biome);
      return "music";
    };

    const resumeOnInteract = async () => {
      await audio.ensureResumed();
      audio.startMusic(pickTrack());
      window.removeEventListener("pointerdown", resumeOnInteract);
      window.removeEventListener("keydown", resumeOnInteract);
    };
    window.addEventListener("pointerdown", resumeOnInteract);
    window.addEventListener("keydown", resumeOnInteract);

    // Crossfade music whenever the screen changes (worldMap ↔ playing ↔
    // results) or when the player enters a level on a different biome.
    const unsubMusic = useGame.subscribe((state, prev) => {
      if (state.screen === prev.screen && state.world.biome === prev.world.biome) return;
      audio.crossfadeTo(pickTrack());
    });

    // Generic UI feedback: play a click on every button press, with a few
    // semantic overrides for tabs/closes. tower-card is a button too but
    // its activation is also a tower-kind selection, so it gets the
    // distinct "select" sample.
    const onUiPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button") as HTMLButtonElement | null;
      if (!btn) return;
      if (btn.disabled) return;
      const cls = btn.className ?? "";
      if (cls.includes("tower-card")) {
        if (cls.includes("active")) {
          audio.ui("close");
        } else if (cls.includes("disabled")) {
          audio.ui("error");
        } else {
          audio.ui("select");
        }
        return;
      }
      if (cls.includes("compendium-tab") || cls.includes("targeting-btn")) {
        audio.ui("tab");
        return;
      }
      if (cls.includes("btn-close") || cls.includes("card-cancel")) {
        audio.ui("close");
        return;
      }
      audio.ui("click");
    };
    document.addEventListener("pointerdown", onUiPointerDown);

    // Subtle hover tick on overlay/menu buttons. Scoped to the variants
    // that show up in modal flows so we don't spam the audio channel
    // when the user wags the mouse over the in-game tower bar.
    const onUiPointerOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button") as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const cls = btn.className ?? "";
      if (cls.includes("btn-ghost") || cls.includes("btn-secondary") || cls.includes("btn-close")) {
        audio.ui("tab");
      }
    };
    document.addEventListener("pointerover", onUiPointerOver);

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
          audio.startMusic(pickTrack());
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
        case "tower-placed":
          audio.play("tower-place", 0.55, 60, 1.2);
          break;
        case "tower-sold":
          audio.play("tower-sell", 0.6, 60, 0.8);
          break;
        case "place-failed":
          audio.ui("error");
          break;
        case "wave-called-early":
          audio.play("wave-call", 0.6, 200, 1.5);
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
      unsubMusic();
      document.removeEventListener("pointerdown", onUiPointerDown);
      window.removeEventListener("pointerdown", resumeOnInteract);
      window.removeEventListener("keydown", resumeOnInteract);
    };
  }, []);
};
