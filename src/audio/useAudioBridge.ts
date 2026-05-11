import { useEffect } from "react";
import type { Biome } from "../biomes";
import type { GameEvent } from "../sim/types";
import { useGame } from "../store";
import { audio, type MusicTrack } from "./AudioManager";
import { applyAudioPrefs, loadAudioPrefs } from "./preferences";

const biomeTrack = (biome: Biome): MusicTrack => `music-${biome}` as MusicTrack;

export const useAudioBridge = () => {
  useEffect(() => {
    let cancelled = false;
    audio.preload().then(() => {
      if (cancelled) return;
      applyAudioPrefs(loadAudioPrefs());
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

    // Generic UI feedback: every button press plays a click. Buttons can
    // override the sample with `data-ui-sound` (e.g. "close" for close
    // buttons, "select" for the tower picker) — see `audio.ui` for the
    // valid set. The attribute keeps the audio contract explicit at the
    // source instead of inferred from class-name strings.
    type UiSound = "click" | "tab" | "open" | "close" | "error" | "select";
    const VALID_SOUNDS: ReadonlySet<UiSound> = new Set([
      "click",
      "tab",
      "open",
      "close",
      "error",
      "select",
    ]);
    const onUiPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button") as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const attr = btn.dataset.uiSound as UiSound | undefined;
      audio.ui(attr && VALID_SOUNDS.has(attr) ? attr : "click");
    };
    document.addEventListener("pointerdown", onUiPointerDown);

    const unsub = useGame.getState().onEvent((e: GameEvent) => {
      switch (e.type) {
        case "shoot":
          audio.playShoot(e.towerKind);
          break;
        case "impact":
          audio.play("impact", "enemies", 0.25, 60, 1.0);
          break;
        case "death":
          audio.playSplat();
          break;
        case "wave-start":
          audio.startMusic(pickTrack());
          audio.play("wave-start", "notifications", 0.5, 500);
          break;
        case "boss-wave-start":
          // Boss sting: layer "new-enemy" (dramatic announcement cue) on
          // top of the standard wave-start so the moment reads as bigger
          // than a regular wave. Reuses existing samples — no new audio
          // assets shipped with this change.
          audio.play("new-enemy", "notifications", 0.85, 500, 2.5);
          break;
        case "boss-defeated":
          // Takedown sting — repurpose victory horn as an in-run windfall
          // cue. Distinct from wave-clear so a boss kill doesn't blur
          // into the normal end-of-wave tone.
          audio.play("victory", "notifications", 0.7, 500, 3.0);
          break;
        case "life-lost":
          audio.play("life-lost", "enemies", 0.7, 120);
          break;
        case "upgrade":
          audio.play("upgrade", "towers", 0.5, 100);
          break;
        case "tower-placed":
          audio.play("tower-place", "towers", 0.55, 60, 1.2);
          break;
        case "tower-sold":
          audio.play("tower-sell", "towers", 0.6, 60, 0.8);
          break;
        case "place-failed":
          audio.ui("error");
          break;
        case "wave-called-early":
          audio.play("wave-clear", "notifications", 0.6, 500);
          break;
        case "easter-egg-click":
          audio.play("tower-sell", "ui", 0.65, 60, 0.8);
          break;
        case "flame-start":
          audio.startFlame(e.towerId);
          break;
        case "flame-stop":
          audio.stopFlame(e.towerId);
          break;
        case "game-over":
          audio.stopAllSfx();
          audio.stopMusic();
          audio.play("game-over", "notifications", 0.8, 1000);
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
